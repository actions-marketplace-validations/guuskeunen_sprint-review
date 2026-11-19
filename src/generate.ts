import { readFileSync, existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import type { Config } from './config.ts';
import type { ChangedScreen, Review, ReviewScreen, ReviewTheme, UsageMetric, WrittenTheme } from './types.ts';
import { History, type Range } from './history.ts';
import { screens as openScreens, type Screens } from './screenshots.ts';
import { write } from './writer.ts';
import { githubRepo, withPullRequests } from './github.ts';
import type { ModelClient } from './model.ts';
import { fill, labelsFor, longDate, shortDate } from './i18n.ts';
import { renderDeck } from './render.ts';
import { renderMarkdown } from './markdown.ts';
import { brandFromPptx, type Brand } from './brand.ts';

export class NothingToReview extends Error {}

export interface GenerateOptions {
  /** The range to cover. Default: the sprint ending today. */
  range?: Range;
  model: ModelClient;
  /** Called with a line for each step, for the CLI's progress output. */
  onStep?: (message: string) => void;
  /** For the GitHub API; tests pass a fake. */
  fetch?: typeof fetch;
}

export interface Generated {
  review: Review;
  html: string;
  markdown: string;
  usage: { input: number; output: number };
}

/** The sprint that ends on a day (default today): `days` days, both ends included. */
export function sprintRange(days: number, until = today()): Range {
  const end = new Date(`${until}T00:00:00Z`);
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  return { kind: 'dates', from: iso(start), until: iso(end) };
}

/**
 * Builds the review: reads the history, has the model write the words, puts every picture,
 * number and icon in place itself, and renders the deck. Nothing is published.
 */
export async function generate(config: Config, options: GenerateOptions): Promise<Generated> {
  const step = options.onStep ?? (() => {});
  const range = options.range ?? sprintRange(config.sprint.days);
  const history = new History(config.repo);
  history.assertUsable();

  step('Reading the git history');
  let commits = history.commits(range, config.productPaths, config.ignore, config.limits.commits, config.nonProductTypes);
  if (!commits.length) throw new NothingToReview(`No commits found ${describe(range)}.`);
  step(`Found ${commits.length} commit${commits.length === 1 ? '' : 's'} ${describe(range)}`);

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;
  const wantPrs = config.github.pullRequests === 'on' || (config.github.pullRequests === 'auto' && token !== null);
  const repo = wantPrs ? githubRepo(history, config.github.repo) : null;
  if (repo) {
    step(`Reading pull requests from ${repo}`);
    const withPrs = await withPullRequests(commits, repo, token, options.fetch ?? fetch);
    commits = withPrs.commits;
    step(`${withPrs.found} pull request${withPrs.found === 1 ? '' : 's'} found`);
  }

  const t = labelsFor(config.language, config.labels);
  const shots = openScreens(config.screenshots, config.root, history, range, { phone: t.phone, desktop: t.desktop });
  if (config.screenshots.source !== 'none') step('Comparing screenshots');
  const changed = await shots.changed();
  const available = shots.available();
  if (config.screenshots.source !== 'none') step(`${changed.length} screen${changed.length === 1 ? '' : 's'} changed, ${available.size} picture${available.size === 1 ? '' : 's'} available`);

  step(`Writing the slides with ${config.model.name}${config.model.provider === 'anthropic' ? '' : ` via ${config.model.provider}`}`);
  const { written, usage } = await write(options.model, config, commits, changed.map((c) => c.name), [...available.keys()]);

  const reviewScreens = explained(changed, written.screenCaptions, config.limits.changedScreens);
  const themes = withScreens(written.themes, reviewScreens, available, shots, config.limits.themeScreens);
  const { end } = history.ends(range);
  const until = range.kind === 'dates' ? range.until : (commits[0]?.date ?? today());
  const from = range.kind === 'dates' ? range.from : (commits.at(-1)?.date ?? until);

  const review: Review = {
    version: 1,
    title: `${t.sprintReview} ${longDate(until, config.language)}`,
    period: fill(t.period, { from: shortDate(from, config.language), until: longDate(until, config.language) }),
    from,
    until,
    language: config.language,
    organization: config.organization,
    product: config.product.name,
    summary: written.summary,
    summaryNotes: written.summaryNotes,
    themes,
    underTheHood: written.underTheHood,
    screens: reviewScreens,
    milestones: history.milestones(end, config.roadmap),
    usage: readUsage(config),
    checks: written.checks,
  };
  step('Building the deck');
  return { review, ...render(review, config), usage };
}

/** Render a stored review again: after editing review.json, or after a brand change. */
export function render(review: Review, config: Config): { html: string; markdown: string } {
  const brand = resolvedBrand(config);
  return {
    html: renderDeck(review, { color: brand.color, logo: brand.logo, labels: config.labels, goal: config.goal, theme: config.brand.theme, fonts: brand.fonts }),
    markdown: renderMarkdown(review, config.labels),
  };
}

/** The brand as set in the config, with anything missing taken from brand.from (a .pptx). */
export function resolvedBrand(config: Config): Brand {
  const own = { color: config.brand.color, logo: logoDataUri(config), fonts: config.brand.fonts };
  if (!config.brand.from) return own;
  const file = resolve(config.root, config.brand.from);
  if (!existsSync(file)) throw new Error(`brand.from not found: ${file}`);
  const theirs = brandFromPptx(file);
  return {
    color: own.color ?? theirs.color,
    logo: own.logo ?? theirs.logo,
    fonts: { heading: own.fonts.heading ?? theirs.fonts.heading, body: own.fonts.body ?? theirs.fonts.body },
  };
}

/** The changed screens that get a slide: those the model could say in a sentence what changed on. */
function explained(changed: ChangedScreen[], captions: Record<string, string>, max: number): ReviewScreen[] {
  return changed
    .filter((s) => captions[s.name])
    .slice(0, max)
    .map((s) => ({ name: s.name, device: s.device, before: dataUri(s.before), after: dataUri(s.after), caption: captions[s.name] ?? null }));
}

/**
 * Each theme with the screenshot it chose. A picture shows once: not on a second theme, and not
 * on a theme when it already has a desktop before-and-after slide.
 */
function withScreens(themes: WrittenTheme[], shown: ReviewScreen[], available: Map<string, { key: string; device: 'desktop' | 'phone' }>, shots: Screens, max: number): ReviewTheme[] {
  const used = new Set(shown.filter((s) => s.device === 'desktop').map((s) => `${s.name}|desktop`));
  let added = 0;
  return themes.map((th) => {
    const chosen = th.screen ? available.get(th.screen) : undefined;
    let screen: ReviewTheme['screen'] = null;
    if (chosen && added < max) {
      const name = shots.name(chosen.key);
      const id = `${name}|${chosen.device}`;
      const image = shots.picture(chosen.key, chosen.device);
      if (image && !used.has(id)) {
        used.add(id);
        added++;
        screen = { name, device: chosen.device, image: dataUri(image) };
      }
    }
    return { ...th, screen, screenKey: chosen?.key ?? null };
  });
}

/** Usage numbers come from the team, as a JSON file: `[{ "label": "orders placed", "value": 312, "previous": 268 }]`. */
function readUsage(config: Config): UsageMetric[] {
  if (!config.usage) return [];
  const file = resolve(config.root, config.usage);
  if (!existsSync(file)) return [];
  const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((u): u is { label: string; value: number; previous?: number } => typeof u?.label === 'string' && typeof u?.value === 'number')
    .slice(0, 6)
    .map((u) => ({ label: u.label, value: u.value, ...(typeof u.previous === 'number' ? { previous: u.previous } : {}) }));
}

const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif' };

function logoDataUri(config: Config): string | null {
  if (!config.brand.logo) return null;
  if (config.brand.logo.startsWith('data:image/')) return config.brand.logo;
  const file = resolve(config.root, config.brand.logo);
  const mime = MIME[extname(file).toLowerCase()];
  if (!mime || !existsSync(file)) return null;
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
}

function dataUri(png: Buffer): string {
  return `data:image/png;base64,${png.toString('base64')}`;
}

function describe(range: Range): string {
  return range.kind === 'dates' ? `from ${range.from} to ${range.until}` : `in ${range.from}..${range.to}`;
}

function today(): string {
  return iso(new Date());
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
