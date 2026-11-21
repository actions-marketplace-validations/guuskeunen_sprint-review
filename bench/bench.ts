/**
 * The quality benchmark: fixed sample sprints with known right answers. Each case becomes a real
 * git repository, goes through the real pipeline, and the deck is scored. Run it before and after
 * a prompt or model change and compare the numbers instead of guessing.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize } from '../src/config.ts';
import { generate } from '../src/review/generate.ts';
import type { ModelAnswer, ModelClient, ModelRequest } from '../src/ai/model.ts';
import type { Review } from '../src/types.ts';

export interface Expected {
  name: string;
  /** Any of these words or phrases (start of a word, any case) counts as covering it. */
  any: string[];
  /**
   * Under the hood only: plain words for the same change, since the writer is told to name the
   * effect, not the tool. They count for finding it under the hood, never as plumbing up front.
   */
  effect?: string[];
}

export interface BenchCase {
  name: string;
  about: string;
  config: Record<string, unknown>;
  range: { from: string; until: string };
  commits: { date: string; message: string; files: Record<string, string> }[];
  expect: { themes: Expected[]; hood: Expected[]; never: string[] };
}

export interface Score {
  case: string;
  /** Expected themes that show up in the themes or summary. */
  themes: { found: string[]; missed: string[] };
  /** Expected plumbing that wrongly shows up in the themes or summary. */
  leaked: string[];
  /** Expected plumbing that is under the hood, where it belongs. */
  hood: { found: string[]; missed: string[] };
  /** Phrases that must never be on a slide (ticket numbers, injected instructions) but are. */
  forbidden: string[];
  checks: { dropped: number; corrected: number; moved: number; warnings: number };
  themeCount: number;
  wordsPerPoint: number;
  /** 0 to 100: coverage 50, no leaks 15, hood 10, nothing forbidden 15, few warnings 10. */
  total: number;
  error?: string;
}

const CASES = join(dirname(fileURLToPath(import.meta.url)), 'cases');

export function loadCases(names: string[] = []): BenchCase[] {
  const all = readdirSync(CASES)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(CASES, f), 'utf8')) as BenchCase);
  return names.length ? all.filter((c) => names.includes(c.name)) : all;
}

/** The case as a git repository, commits in order with their dates. */
export function buildRepo(c: BenchCase): string {
  const dir = mkdtempSync(join(tmpdir(), `sprint-review-bench-${c.name}-`));
  const env = { ...process.env, GIT_AUTHOR_NAME: 'Bench', GIT_AUTHOR_EMAIL: 'bench@example.test', GIT_COMMITTER_NAME: 'Bench', GIT_COMMITTER_EMAIL: 'bench@example.test' };
  const git = (args: string[], date?: string) =>
    execFileSync('git', args, { cwd: dir, stdio: 'pipe', env: date ? { ...env, GIT_AUTHOR_DATE: `${date}T10:00:00Z`, GIT_COMMITTER_DATE: `${date}T10:00:00Z` } : env });
  git(['init', '-q', '-b', 'main']);
  for (const commit of c.commits) {
    for (const [path, content] of Object.entries(commit.files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), `${content}\n${commit.date}\n`);
    }
    git(['add', '-A']);
    git(['commit', '-q', '--allow-empty', '-m', commit.message], commit.date);
  }
  return dir;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const covers = (text: string, e: Expected) => e.any.some((w) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(w)}`, 'iu').test(text));

/** Score a finished review against what the case expects. */
export function score(c: BenchCase, review: Review): Score {
  const front = [
    ...review.summary.map((p) => p.text),
    ...review.themes.flatMap((t) => [t.title, t.effect ?? '', ...t.points]),
    ...review.screens.map((s) => s.caption ?? ''),
  ].join('\n');
  const hoodText = review.underTheHood.join('\n');
  const everything = [front, hoodText, review.summaryNotes ?? '', ...review.themes.map((t) => t.notes ?? '')].join('\n');

  const found = c.expect.themes.filter((e) => covers(front, e)).map((e) => e.name);
  const missed = c.expect.themes.filter((e) => !covers(front, e)).map((e) => e.name);
  const leaked = c.expect.hood.filter((e) => covers(front, e)).map((e) => e.name);
  const inHood = (e: Expected) => covers(hoodText, { ...e, any: [...e.any, ...(e.effect ?? [])] });
  const hoodFound = c.expect.hood.filter(inHood).map((e) => e.name);
  const hoodMissed = c.expect.hood.filter((e) => !inHood(e)).map((e) => e.name);
  const forbidden = c.expect.never.filter((p) => everything.toLowerCase().includes(p.toLowerCase()));
  const count = (k: string) => review.checks.filter((x) => x.kind === k).length;
  const points = [...review.summary.map((p) => p.text), ...review.themes.flatMap((t) => t.points)];
  const wordsPerPoint = points.length ? points.reduce((n, p) => n + p.split(/\s+/).filter(Boolean).length, 0) / points.length : 0;

  const coverage = c.expect.themes.length ? found.length / c.expect.themes.length : 1;
  const noLeaks = c.expect.hood.length ? 1 - leaked.length / c.expect.hood.length : 1;
  const hood = c.expect.hood.length ? hoodFound.length / c.expect.hood.length : 1;
  const warnings = count('warning');
  const total = Math.round(coverage * 50 + noLeaks * 15 + hood * 10 + (forbidden.length ? 0 : 15) + Math.max(0, 10 - warnings * 2.5));

  return {
    case: c.name,
    themes: { found, missed },
    leaked,
    hood: { found: hoodFound, missed: hoodMissed },
    forbidden,
    checks: { dropped: count('dropped'), corrected: count('corrected'), moved: count('moved'), warnings },
    themeCount: review.themes.length,
    wordsPerPoint: Math.round(wordsPerPoint * 10) / 10,
    total,
  };
}

/** Build the repository, run the pipeline with a model, score the deck. */
export async function runCase(c: BenchCase, model: ModelClient, modelConfig: Record<string, unknown> = {}): Promise<{ score: Score; review: Review | null }> {
  const dir = buildRepo(c);
  const config = normalize({ ...c.config, github: { pullRequests: false }, roadmap: false, model: modelConfig }, dir);
  try {
    const { review } = await generate(config, { model, range: { kind: 'dates', ...c.range } });
    return { score: score(c, review), review };
  } catch (e) {
    const empty: Score = { case: c.name, themes: { found: [], missed: c.expect.themes.map((t) => t.name) }, leaked: [], hood: { found: [], missed: c.expect.hood.map((h) => h.name) }, forbidden: [], checks: { dropped: 0, corrected: 0, moved: 0, warnings: 0 }, themeCount: 0, wordsPerPoint: 0, total: 0, error: (e as Error).message };
    return { score: empty, review: null };
  }
}

/** The scores as a Markdown report. */
export function report(scores: Score[], label: string): string {
  const avg = scores.length ? Math.round(scores.reduce((n, s) => n + s.total, 0) / scores.length) : 0;
  const lines = [
    `# Benchmark: ${label}`,
    '',
    `Average **${avg}/100** over ${scores.length} case${scores.length === 1 ? '' : 's'}.`,
    '',
    '| Case | Score | Themes covered | Plumbing in front | Under the hood | Forbidden | Dropped | Corrected | Warnings | Words/point |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...scores.map(
      (s) =>
        `| ${s.case} | **${s.total}** | ${s.themes.found.length}/${s.themes.found.length + s.themes.missed.length} | ${s.leaked.length} | ${s.hood.found.length}/${s.hood.found.length + s.hood.missed.length} | ${s.forbidden.length} | ${s.checks.dropped} | ${s.checks.corrected} | ${s.checks.warnings} | ${s.wordsPerPoint} |`,
    ),
    '',
  ];
  for (const s of scores) {
    const notes = [
      s.error ? `- Failed: ${s.error}` : '',
      s.themes.missed.length ? `- Missed themes: ${s.themes.missed.join(', ')}` : '',
      s.leaked.length ? `- Plumbing on the front slides: ${s.leaked.join(', ')}` : '',
      s.hood.missed.length ? `- Not under the hood: ${s.hood.missed.join(', ')}` : '',
      s.forbidden.length ? `- Forbidden text on a slide: ${s.forbidden.join(', ')}` : '',
    ].filter(Boolean);
    if (notes.length) lines.push(`### ${s.case}`, '', ...notes, '');
  }
  lines.push('Score: coverage of the expected themes 50, no plumbing on the front slides 15, plumbing under the hood 10, nothing forbidden 15, few warnings from the second reader 10.');
  return lines.join('\n') + '\n';
}

/**
 * A stand-in writer for checking the harness without an API key: one theme per product commit,
 * plumbing under the hood, using the real hashes. It scores well by construction; real models are
 * what the benchmark is for.
 */
export class EchoModel implements ModelClient {
  async ask(request: ModelRequest): Promise<ModelAnswer> {
    const usage = { input: 0, output: 0 };
    if (request.tool.name === 'reading_report') return { model: 'echo', usage, toolInput: { complaints: [] } };
    if (request.tool.name === 'revisions') return { model: 'echo', usage, toolInput: { revisions: [] } };
    const log = request.messages[0] ?? '';
    const entries = [...log.matchAll(/^([0-9a-f]{7,}) \S+ (.+?)( \[no product code\])?$/gm)].map((m) => ({ hash: m[1]!, subject: m[2]!, product: !m[3] }));
    const plumbing = /^(ci|build|test|docs|chore)(\(|:|!)|^bump |^terraform|^wip$|^merge /i;
    const clean = (s: string) => s.replace(/^[a-z]+(\([^)]*\))?!?:\s*/i, '').replace(/\s*\(#\d+\)/, '').replace(/^[A-Z]+-\d+\s+/, '');
    const front = entries.filter((e) => e.product && !plumbing.test(e.subject)).slice(0, 6);
    const back = entries.filter((e) => !front.includes(e));
    return {
      model: 'echo',
      usage,
      toolInput: {
        summary: front.slice(0, 3).map((e) => ({ text: clean(e.subject), commits: [e.hash], icon: 'sparkles' })),
        summary_notes: null,
        themes: front.map((e) => ({ title: clean(e.subject).split(/\s+/).slice(0, 3).join(' '), icon: 'other', screen: 'none', value: null, effect: clean(e.subject), points: [{ text: clean(e.subject), commits: [e.hash] }], notes: null })),
        under_the_hood: back.map((e) => ({ text: clean(e.subject), commits: [e.hash] })),
      },
    };
  }
}
