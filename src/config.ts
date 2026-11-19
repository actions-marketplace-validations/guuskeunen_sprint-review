import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import YAML from 'yaml';

/** Who the deck is for. A preset, or your own description. */
export const AUDIENCES = {
  business:
    'Colleagues without a technical background, such as marketing, sales and support. They need to understand what is new and why it matters, in plain words.',
  executives:
    'Management. They want the few changes that matter most and what they bring the business, without detail.',
  customers:
    'Customers who use the product. They want to know what they can do now that they could not before, and what got easier.',
  team: 'The product team itself. Plain words still, but they know the product well and like a bit more detail.',
} as const;

export interface Area {
  /** A key from the icon set (see `sprint-review icons`). */
  icon: string;
  /** How the area is called in the product, such as the menu label. */
  label: string;
  /** The screen key of a screenshot that shows this area. */
  screen?: string;
}

export interface Config {
  /** The folder the config was read from; relative paths resolve against it. */
  root: string;
  /** The git repository to read. Defaults to the config's folder. */
  repo: string;
  product: { name: string; description: string };
  organization: string;
  audience: string;
  presenter: string;
  /** The language of the slides, as a name or code: "English", "nl", "de-DE". */
  language: string;
  goal: string | null;
  brand: {
    color: string | null;
    logo: string | null;
    /** A .pptx whose theme color, fonts and logo fill in whatever is not set here. */
    from: string | null;
    /** light (default) or dark. */
    theme: 'dark' | 'light';
    fonts: { heading: string | null; body: string | null };
  };
  sprint: { days: number };
  /** Folders that hold product code. A commit outside them can only go under the hood. Empty: every commit counts. */
  productPaths: string[];
  /** Commits whose subject matches one of these patterns are left out entirely. */
  ignore: string[];
  /** Conventional Commit types that never count as product work (ci, build, test, docs, chore). Empty list: types are ignored. */
  nonProductTypes: string[];
  /** Words the model tends to get wrong, with what the team says instead. Whole words, case kept. */
  replace: Record<string, string>;
  /** Extra writing rules, one per line, in your own words. */
  rules: string[];
  /** Override any label on the slides, by key (see src/i18n.ts). */
  labels: Record<string, string>;
  /** Let the writer rewrite the lines the second reader flagged, once. The rewrites go through every check again. */
  revise: boolean;
  /** Pull request titles and descriptions as extra context, from the GitHub API. */
  github: { pullRequests: 'auto' | 'on' | 'off'; repo: string | null };
  areas: Record<string, Area>;
  screenshots: ScreenshotConfig;
  roadmap: string | null;
  usage: string | null;
  limits: { themes: number; themeScreens: number; changedScreens: number; commits: number };
  model: { provider: 'anthropic' | 'openai'; name: string; fallback: string | null; maxTokens: number };
  output: { dir: string; markdown: boolean; pptx: boolean };
  /** Post the summary to Slack after generating. The webhook URL comes from SLACK_WEBHOOK_URL. */
  slack: boolean;
}

export type ScreenshotConfig =
  | { source: 'none' }
  | { source: 'git'; dir: string; names: Record<string, string>; ignore: { left: number; top: number } }
  | { source: 'folder'; before: string; after: string; names: Record<string, string>; ignore: { left: number; top: number } }
  | { source: 'capture'; capture: CaptureConfig; names: Record<string, string>; ignore: { left: number; top: number } };

export interface CaptureConfig {
  /** The pages to photograph, by screen key. Relative URLs are resolved against baseUrl. */
  pages: Record<string, string>;
  baseUrl: string | null;
  devices: ('desktop' | 'phone')[];
  /** CSS selectors to black out before the picture is taken: a safety net for real data. */
  mask: string[];
  /** A Playwright storage state file with a logged-in session. */
  storageState: string | null;
  /** Milliseconds to wait after the page has loaded. */
  wait: number;
  /** Where the pictures are kept, one folder per day. Keep it between runs (commit it or cache it in CI). */
  dir: string;
}

const DEFAULT_FILES = ['sprint-review.config.yml', 'sprint-review.config.yaml', 'sprint-review.config.json'];

export class ConfigError extends Error {}

/** Find and read the config: the given path, or the first default file in `cwd`. */
export function loadConfig(path: string | null, cwd = process.cwd()): Config {
  const file = path ? resolve(cwd, path) : DEFAULT_FILES.map((f) => resolve(cwd, f)).find((f) => existsSync(f));
  if (!file) {
    throw new ConfigError(`No config found. Run \`sprint-review init\` to create ${DEFAULT_FILES[0]}.`);
  }
  if (!existsSync(file)) throw new ConfigError(`Config not found: ${file}`);
  const text = readFileSync(file, 'utf8');
  let raw: unknown;
  try {
    raw = extname(file) === '.json' ? JSON.parse(text) : YAML.parse(text);
  } catch (e) {
    throw new ConfigError(`Could not parse ${file}: ${(e as Error).message}`);
  }
  return normalize(raw ?? {}, dirname(file));
}

/** Fill in defaults and check every field, so the rest of the code can trust the shape. */
export function normalize(raw: unknown, root: string): Config {
  const r = obj(raw, 'config');
  const product = obj(r.product ?? {}, 'product');
  const brand = obj(r.brand ?? {}, 'brand');
  const sprint = obj(r.sprint ?? {}, 'sprint');
  const limits = obj(r.limits ?? {}, 'limits');
  const model = obj(r.model ?? {}, 'model');
  const output = obj(r.output ?? {}, 'output');

  const audienceRaw = str(r.audience, 'audience') ?? 'business';
  const audience = audienceRaw in AUDIENCES ? AUDIENCES[audienceRaw as keyof typeof AUDIENCES] : audienceRaw;

  const color = str(brand.color, 'brand.color');
  if (color !== null && !/^#[0-9a-fA-F]{6}$/.test(color)) throw new ConfigError('brand.color must be a hex color like #ea580c.');

  const areas: Record<string, Area> = {};
  for (const [key, value] of Object.entries(obj(r.areas ?? {}, 'areas'))) {
    const a = obj(value, `areas.${key}`);
    areas[key] = {
      icon: str(a.icon, `areas.${key}.icon`) ?? 'other',
      label: str(a.label, `areas.${key}.label`) ?? key,
      ...(str(a.screen, `areas.${key}.screen`) ? { screen: str(a.screen, `areas.${key}.screen`)! } : {}),
    };
  }

  return {
    root,
    repo: resolve(root, str(r.repo, 'repo') ?? '.'),
    product: {
      name: str(product.name, 'product.name') ?? 'the product',
      description: str(product.description, 'product.description') ?? '',
    },
    organization: str(r.organization, 'organization') ?? '',
    audience,
    presenter:
      str(r.presenter, 'presenter') ??
      'The presenter is technical, knows the product and gives a short demo of each theme.',
    language: str(r.language, 'language') ?? 'English',
    goal: str(r.goal, 'goal'),
    brand: {
      color,
      logo: str(brand.logo, 'brand.logo'),
      from: str(brand.from, 'brand.from'),
      theme: themeOf(str(brand.theme, 'brand.theme')),
      fonts: {
        heading: str(obj(brand.fonts ?? {}, 'brand.fonts').heading, 'brand.fonts.heading'),
        body: str(obj(brand.fonts ?? {}, 'brand.fonts').body, 'brand.fonts.body'),
      },
    },
    sprint: { days: int(sprint.days, 'sprint.days', 14, 1, 120) },
    productPaths: strList(r.productPaths, 'productPaths'),
    ignore: strList(r.ignore, 'ignore'),
    nonProductTypes: r.nonProductTypes === undefined ? ['ci', 'build', 'test', 'docs', 'chore'] : strList(r.nonProductTypes, 'nonProductTypes').map((t) => t.toLowerCase()),
    replace: strMap(r.replace, 'replace'),
    rules: strList(r.rules, 'rules'),
    labels: strMap(r.labels, 'labels'),
    revise: r.revise === undefined ? true : bool(r.revise, 'revise'),
    github: github(r.github),
    areas,
    screenshots: screenshots(r.screenshots),
    roadmap: r.roadmap === false ? null : (str(r.roadmap, 'roadmap') ?? 'ROADMAP.md'),
    usage: str(r.usage, 'usage'),
    limits: {
      themes: int(limits.themes, 'limits.themes', 6, 1, 12),
      themeScreens: int(limits.themeScreens, 'limits.themeScreens', 4, 0, 12),
      changedScreens: int(limits.changedScreens, 'limits.changedScreens', 4, 0, 12),
      commits: int(limits.commits, 'limits.commits', 1000, 1, 100000),
    },
    model: modelConfig(model),
    output: {
      dir: str(output.dir, 'output.dir') ?? 'sprint-reviews',
      markdown: output.markdown === undefined ? true : bool(output.markdown, 'output.markdown'),
      pptx: output.pptx === undefined ? false : bool(output.pptx, 'output.pptx'),
    },
    slack: r.slack === undefined ? false : bool(r.slack, 'slack'),
  };
}

function screenshots(value: unknown): ScreenshotConfig {
  if (value === undefined || value === null || value === false) return { source: 'none' };
  const s = obj(value, 'screenshots');
  const source = str(s.source, 'screenshots.source') ?? (s.dir ? 'git' : s.before ? 'folder' : 'none');
  const names = strMap(s.names, 'screenshots.names');
  const ig = obj(s.ignore ?? {}, 'screenshots.ignore');
  const ignore = { left: int(ig.left, 'screenshots.ignore.left', 0, 0, 4000), top: int(ig.top, 'screenshots.ignore.top', 0, 0, 4000) };
  if (source === 'none') return { source: 'none' };
  if (source === 'git') {
    const dir = str(s.dir, 'screenshots.dir');
    if (!dir) throw new ConfigError('screenshots.dir is required when screenshots.source is git.');
    return { source: 'git', dir: dir.replace(/\/+$/, ''), names, ignore };
  }
  if (source === 'folder') {
    const before = str(s.before, 'screenshots.before');
    const after = str(s.after, 'screenshots.after');
    if (!before || !after) throw new ConfigError('screenshots.before and screenshots.after are required when screenshots.source is folder.');
    return { source: 'folder', before, after, names, ignore };
  }
  if (source === 'capture') {
    const pages = strMap(s.pages, 'screenshots.pages');
    if (!Object.keys(pages).length) throw new ConfigError('screenshots.pages is required when screenshots.source is capture: a screen key per URL.');
    const devices = s.devices === undefined ? (['desktop'] as ('desktop' | 'phone')[]) : strList(s.devices, 'screenshots.devices');
    for (const d of devices) if (d !== 'desktop' && d !== 'phone') throw new ConfigError('screenshots.devices can hold desktop and phone.');
    return {
      source: 'capture',
      names,
      ignore,
      capture: {
        pages,
        baseUrl: str(s.baseUrl, 'screenshots.baseUrl'),
        devices: devices as ('desktop' | 'phone')[],
        mask: strList(s.mask, 'screenshots.mask'),
        storageState: str(s.storageState, 'screenshots.storageState'),
        wait: int(s.wait, 'screenshots.wait', 500, 0, 60000),
        dir: str(s.storage, 'screenshots.storage') ?? '.sprint-review/screenshots',
      },
    };
  }
  throw new ConfigError(`screenshots.source must be none, git, folder or capture, not "${source}".`);
}

function themeOf(v: string | null): 'dark' | 'light' {
  if (v === null || v === 'light') return 'light';
  if (v === 'dark') return 'dark';
  throw new ConfigError('brand.theme must be dark or light.');
}

function github(value: unknown): Config['github'] {
  if (value === undefined || value === null) return { pullRequests: 'auto', repo: null };
  const g = obj(value, 'github');
  const pr = g.pullRequests;
  const pullRequests = pr === undefined || pr === 'auto' ? 'auto' : pr === true ? 'on' : pr === false ? 'off' : null;
  if (pullRequests === null) throw new ConfigError('github.pullRequests must be auto, true or false.');
  const repo = str(g.repo, 'github.repo');
  if (repo !== null && !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new ConfigError('github.repo must look like owner/name.');
  return { pullRequests, repo };
}

const DEFAULT_MODELS = { anthropic: { name: 'claude-opus-5-5', fallback: 'claude-sonnet-5-5' } };

function modelConfig(model: Record<string, unknown>): Config['model'] {
  const provider = str(model.provider, 'model.provider') ?? 'anthropic';
  if (provider !== 'anthropic' && provider !== 'openai') throw new ConfigError('model.provider must be anthropic or openai.');
  const name = str(model.name, 'model.name') ?? (provider === 'anthropic' ? DEFAULT_MODELS.anthropic.name : null);
  if (!name) throw new ConfigError('model.name is required when model.provider is openai, for example the model your account uses.');
  const fallback = model.fallback === null ? null : (str(model.fallback, 'model.fallback') ?? (provider === 'anthropic' ? DEFAULT_MODELS.anthropic.fallback : null));
  return { provider, name, fallback, maxTokens: int(model.maxTokens, 'model.maxTokens', 8000, 1000, 64000) };
}

function obj(v: unknown, at: string): Record<string, unknown> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new ConfigError(`${at} must be an object.`);
  return v as Record<string, unknown>;
}
function str(v: unknown, at: string): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') throw new ConfigError(`${at} must be text.`);
  return v.trim() === '' ? null : v.trim();
}
function bool(v: unknown, at: string): boolean {
  if (typeof v !== 'boolean') throw new ConfigError(`${at} must be true or false.`);
  return v;
}
function int(v: unknown, at: string, fallback: number, min: number, max: number): number {
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new ConfigError(`${at} must be a whole number from ${min} to ${max}.`);
  return v;
}
function strList(v: unknown, at: string): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw new ConfigError(`${at} must be a list of text.`);
  return (v as string[]).map((x) => x.trim()).filter(Boolean);
}
function strMap(v: unknown, at: string): Record<string, string> {
  if (v === undefined || v === null) return {};
  const o = obj(v, at);
  for (const [k, x] of Object.entries(o)) if (typeof x !== 'string') throw new ConfigError(`${at}.${k} must be text.`);
  return o as Record<string, string>;
}
