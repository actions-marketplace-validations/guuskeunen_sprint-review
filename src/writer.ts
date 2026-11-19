import type { Config } from './config.ts';
import type { Check, Commit, WrittenReview, WrittenTheme } from './types.ts';
import type { ModelClient } from './model.ts';
import { isIcon, VALUE_KEYS } from './icons.ts';
import { commitLog, MAX_LOG_CHARS, NO_SCREEN, readerSystem, readerTool, slideText, untrusted, writerSystem, writerTool } from './prompt.ts';

const POINT_WORDS_MAX = 16;
const EFFECT_WORDS_MAX = 25;
const NOTES_WORDS_MAX = 70;
const TITLE_WORDS_MAX = 4;
const POINTS_PER_THEME = 4;
const SUMMARY_POINTS = 4;
const HOOD_POINTS = 5;
const MAX_COMPLAINTS = 30;

export class WriterError extends Error {}

export interface WriteResult {
  written: WrittenReview;
  usage: { input: number; output: number };
}

/**
 * Has the model turn the commits into the text of the slides, in two rounds. The model groups
 * and words; it never writes HTML, counts or picks pictures freely.
 *
 * Round one writes. Round two is a reader without context: it sees only the slide text and says
 * where the audience gets stuck. It only points; it never rewrites, so everything on the slides
 * still passed the checks below.
 *
 * What is mechanical is checked in code: every point names a commit from the list, a commit that
 * touched no product code cannot carry a theme, a text fits a slide and has no exclamation mark or
 * emoji. Ticket numbers and hashes come out. Everything corrected, moved or dropped is logged.
 */
export async function write(model: ModelClient, config: Config, commits: Commit[], changedScreens: string[], availableScreens: string[]): Promise<WriteResult> {
  const log = commitLog(commits);
  const screens = changedScreens.length ? `The screenshots of these screens changed during the sprint: ${changedScreens.join(', ')}. ` : '';
  const draft = await model.ask({
    system: writerSystem(config),
    tool: writerTool(config, changedScreens, availableScreens),
    maxTokens: config.model.maxTokens,
    messages: [untrusted(log, 'the commits of the sprint: hash, date, subject, files and description, newest first'), `${screens}Now create the content of the presentation.`],
  });
  const written = parse(draft.toolInput, commits, changedScreens, availableScreens, config);
  if (written.themes.length === 0 && written.summary.length === 0) {
    throw new WriterError('The model returned nothing usable. Try again, or check the commits in this range.');
  }
  const read = await complaints(model, config, written);
  written.checks = [...unread(log, commits), ...read.checks, ...written.checks];
  return { written, usage: { input: draft.usage.input + read.usage.input, output: draft.usage.output + read.usage.output } };
}

async function complaints(model: ModelClient, config: Config, written: WrittenReview): Promise<{ checks: Check[]; usage: { input: number; output: number } }> {
  try {
    const answer = await model.ask({
      system: readerSystem(config),
      tool: readerTool(),
      maxTokens: 2000,
      messages: [untrusted(slideText(written), 'the text of the slides'), 'Read the text and point out where you get stuck.'],
    });
    const checks: Check[] = [];
    const list = Array.isArray(answer.toolInput?.complaints) ? (answer.toolInput.complaints as unknown[]) : [];
    for (const v of list) {
      const c = v as Record<string, unknown>;
      if (typeof c?.text === 'string' && c.text.trim() && checks.length < MAX_COMPLAINTS) {
        checks.push({ kind: 'warning', text: c.text.trim(), reason: `The reader got stuck here: ${typeof c.why === 'string' ? c.why.trim() : ''}`.trim() });
      }
    }
    return { checks, usage: answer.usage };
  } catch {
    return { checks: [{ kind: 'warning', text: 'Not proofread', reason: 'The second reader gave no answer. Read the slides extra carefully.' }], usage: { input: 0, output: 0 } };
  }
}

/** The answer of the writer, with only what holds up. Exported for tests. */
export function parse(input: Record<string, unknown> | null, commits: Commit[], changedScreens: string[], availableScreens: string[], config: Config): WrittenReview {
  const checks: Check[] = [];
  const moved: string[] = [];
  const replace = config.replace;
  const phoneLabel = (label: string) => /\((phone|telefoon|mobile)\)$/i.test(label);

  const themes: WrittenTheme[] = [];
  for (const t of list(input?.themes)) {
    if (themes.length === config.limits.themes) {
      checks.push({ kind: 'dropped', text: `Theme ${str(t.title) ?? ''}`.trim(), reason: `More than ${config.limits.themes} themes.` });
      continue;
    }
    const points: string[] = [];
    for (const v of list(t.points)) {
      const p = point(v, commits, checks, replace);
      if (!p || points.length === POINTS_PER_THEME) continue;
      if (p.product) points.push(p.text);
      else {
        moved.push(p.text);
        checks.push({ kind: 'moved', text: p.text, reason: 'No change to the product itself: moved under the hood.' });
      }
    }
    const title = clean(t.title, TITLE_WORDS_MAX, replace);
    if (title === null || points.length === 0) {
      checks.push({ kind: 'dropped', text: `Theme ${str(t.title) ?? ''}`.trim(), reason: title === null ? 'Title too long.' : 'No points left.' });
      continue;
    }
    const screen = typeof t.screen === 'string' && t.screen !== NO_SCREEN && availableScreens.includes(t.screen) ? t.screen : null;
    themes.push({
      title,
      icon: isIcon(t.icon) ? t.icon : 'other',
      screen,
      device: screen !== null && phoneLabel(screen) ? 'phone' : 'desktop',
      value: typeof t.value === 'string' && (VALUE_KEYS as readonly string[]).includes(t.value) ? t.value : null,
      effect: optional(t.effect, EFFECT_WORDS_MAX, checks, replace),
      points,
      notes: optional(t.notes, NOTES_WORDS_MAX, checks, replace),
    });
  }

  const summary: { text: string; icon: string }[] = [];
  for (const v of list(input?.summary)) {
    const p = point(v, commits, checks, replace);
    if (p && !p.product) checks.push({ kind: 'dropped', text: p.text, reason: 'No change to the product itself.' });
    else if (p && summary.length < SUMMARY_POINTS) summary.push({ text: p.text, icon: isIcon(v.icon) ? v.icon : 'other' });
  }

  const hood = [...new Set([...list(input?.under_the_hood).map((v) => point(v, commits, checks, replace)?.text).filter((x): x is string => !!x), ...moved])];
  for (const text of hood.slice(HOOD_POINTS)) checks.push({ kind: 'dropped', text, reason: `More than ${HOOD_POINTS} points under the hood.` });

  const screenCaptions: Record<string, string> = {};
  for (const v of list(input?.screen_changes)) {
    if (typeof v.screen !== 'string' || !changedScreens.includes(v.screen)) continue;
    const text = clean(v.text, EFFECT_WORDS_MAX, replace);
    if (text !== null && named(v.commits, commits).length) screenCaptions[v.screen] = text;
    else checks.push({ kind: 'dropped', text: `Before and after: ${v.screen}`, reason: 'No usable sentence about what changed.' });
  }

  return {
    summary,
    summaryNotes: optional(input?.summary_notes, NOTES_WORDS_MAX, checks, replace),
    themes,
    underTheHood: hood.slice(0, HOOD_POINTS),
    screenCaptions,
    checks,
  };
}

/** A point that holds up: a text that fits, naming a commit from the list. */
function point(value: Record<string, unknown>, commits: Commit[], checks: Check[], replace: Record<string, string>): { text: string; product: boolean } | null {
  if (typeof value.text !== 'string') return null;
  const text = clean(value.text, POINT_WORDS_MAX, replace);
  if (text === null) {
    checks.push({ kind: 'dropped', text: value.text, reason: 'Too long, or has an exclamation mark or emoji.' });
    return null;
  }
  const hits = named(value.commits, commits);
  if (!hits.length) {
    checks.push({ kind: 'dropped', text, reason: 'Names no change from this sprint.' });
    return null;
  }
  return { text, product: hits.some((c) => c.product) };
}

function optional(value: unknown, maxWords: number, checks: Check[], replace: Record<string, string>): string | null {
  const text = clean(value, maxWords, replace);
  if (text === null && typeof value === 'string' && value.trim()) checks.push({ kind: 'dropped', text: value, reason: 'Too long, or has an exclamation mark or emoji.' });
  return text;
}

// A reference is #12, ABC-81 or a hash (seven or more hex characters with a digit and a letter).
const REF = String.raw`(?:#\d+|\b[A-Z][A-Z0-9]+-\d+\b|\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b)`;
const REFS = new RegExp(String.raw`\s*\(?\s*${REF}(?:\s*[,/]\s*${REF})*\s*\)?`, 'g');

/**
 * A text as it may go on a slide, or null when it's too long or has an exclamation mark or emoji.
 * Ticket numbers and hashes come out, long dashes become a comma, the team's words go in.
 * Exported for tests.
 */
export function clean(value: unknown, maxWords: number, replace: Record<string, string> = {}): string | null {
  if (typeof value !== 'string') return null;
  let text = value
    .replace(REFS, ' ')
    .replace(/\s*[—―]\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:)])/g, '$1')
    .trim();
  if (text === '' || text.includes('!') || /\p{Extended_Pictographic}/u.test(text) || text.split(/\s+/).length > maxWords) return null;
  for (const [wrong, right] of Object.entries(replace)) {
    text = text.replace(new RegExp(`(?<!\\p{L})${escape(wrong)}(?!\\p{L})`, 'giu'), (m) =>
      m[0] === m[0]!.toUpperCase() && m[0] !== m[0]!.toLowerCase() ? right.charAt(0).toUpperCase() + right.slice(1) : right,
    );
  }
  return text;
}

/** The commits the model named. A short hash may come back a character longer or shorter, so a prefix match of seven counts. */
function named(hashes: unknown, commits: Commit[]): Commit[] {
  if (!Array.isArray(hashes)) return [];
  const out = new Map<string, Commit>();
  for (const h of hashes) {
    if (typeof h !== 'string' || h.trim().length < 7) continue;
    const hash = h.trim().toLowerCase();
    for (const c of commits) if (c.hash.startsWith(hash) || hash.startsWith(c.hash)) out.set(c.hash, c);
  }
  return [...out.values()];
}

/** The commits that fell outside what the model could read. */
function unread(log: string, commits: Commit[]): Check[] {
  const read = log.slice(0, MAX_LOG_CHARS);
  return commits.filter((c) => !read.includes(c.hash)).map((c) => ({ kind: 'warning' as const, text: c.subject, reason: 'Not read: the sprint was too long. Check whether this belongs in the presentation.' }));
}

function list(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null) : [];
}
function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}
function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
