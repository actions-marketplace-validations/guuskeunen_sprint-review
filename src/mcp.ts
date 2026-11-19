import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { loadConfig, normalize, type Config } from './config.ts';
import { generate, sprintRange } from './generate.ts';
import { History, type Range } from './history.ts';
import { clientFor } from './providers.ts';
import { commitLog } from './prompt.ts';
import { writeOutputs } from './output.ts';
import { doctorChecks } from './doctor.ts';
import { validReview } from './editor.ts';
import type { Review } from './types.ts';

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')) as { version: string };
const PROTOCOL = '2025-06-18';

const DIR = { type: 'string', description: 'The project folder (with sprint-review.config.yml, or a git repository). Default: the folder the server started in.' };
const RANGE = {
  since: { type: 'string', description: 'First day of the sprint, YYYY-MM-DD. Default: the configured sprint length back from until.' },
  until: { type: 'string', description: 'Last day of the sprint, YYYY-MM-DD. Default: today.' },
  from: { type: 'string', description: 'Start at a tag or commit instead of a date.' },
  to: { type: 'string', description: 'End at a tag or commit. Default: HEAD.' },
};

export const TOOLS = [
  {
    name: 'generate_sprint_review',
    description: 'Write a sprint review deck from the git history: themes in business language, checked against the real commits, with before-and-after screenshots when configured. Writes deck.html, review.json, review.md and checks.md, and returns the paths and the check log. Calls the configured model (needs ANTHROPIC_API_KEY or OPENAI_API_KEY in the server environment).',
    inputSchema: { type: 'object', properties: { directory: DIR, ...RANGE, out: { type: 'string', description: 'Folder to write to. Default: sprint-reviews/<last day>.' }, pptx: { type: 'boolean', description: 'Also write deck.pptx.' } }, additionalProperties: false },
  },
  {
    name: 'preview_sprint_commits',
    description: 'List the commits a sprint review would be written from, without calling a model. Use it to check the range before generating.',
    inputSchema: { type: 'object', properties: { directory: DIR, ...RANGE }, additionalProperties: false },
  },
  {
    name: 'render_sprint_review',
    description: 'Rebuild deck.html (and review.md) from an edited review.json, with the current brand settings. No model call.',
    inputSchema: { type: 'object', properties: { file: { type: 'string', description: 'Path to review.json.' }, directory: DIR }, required: ['file'], additionalProperties: false },
  },
  {
    name: 'check_sprint_review_setup',
    description: 'Check that the project is ready: git history, API key, screenshots, brand files.',
    inputSchema: { type: 'object', properties: { directory: DIR }, additionalProperties: false },
  },
];

type Args = Record<string, unknown>;

function configIn(dir: string): Config {
  try {
    return loadConfig(null, dir);
  } catch (e) {
    if (/No config found/.test((e as Error).message)) return normalize({}, dir);
    throw e;
  }
}

function rangeOf(a: Args, config: Config): Range {
  const s = (k: string) => (typeof a[k] === 'string' && a[k] ? (a[k] as string) : undefined);
  if (s('from')) return { kind: 'refs', from: s('from')!, to: s('to') ?? 'HEAD' };
  for (const k of ['since', 'until']) if (s(k) && !/^\d{4}-\d{2}-\d{2}$/.test(s(k)!)) throw new Error(`${k} must be a date like 2026-11-10.`);
  if (s('since')) return { kind: 'dates', from: s('since')!, until: s('until') ?? new Date().toISOString().slice(0, 10) };
  return sprintRange(config.sprint.days, s('until'));
}

/** Runs one tool call. Exported for tests. */
export async function callTool(name: string, a: Args, cwd = process.cwd()): Promise<string> {
  const dir = resolve(cwd, typeof a.directory === 'string' ? a.directory : '.');
  if (name === 'check_sprint_review_setup') {
    const lines = await doctorChecks(configIn(dir), dir);
    return lines.map((l) => `${l.ok ? '✓' : '✗'} ${l.text}${l.fix ? `\n  fix: ${l.fix}` : ''}`).join('\n');
  }
  if (name === 'preview_sprint_commits') {
    const config = configIn(dir);
    const range = rangeOf(a, config);
    const history = new History(config.repo);
    history.assertUsable();
    const commits = history.commits(range, config.productPaths, config.ignore, config.limits.commits, config.nonProductTypes);
    return `${commits.length} commits (${commits.filter((c) => c.product).length} touch product code)\n\n${commitLog(commits).slice(0, 20000)}`;
  }
  if (name === 'render_sprint_review') {
    if (typeof a.file !== 'string') throw new Error('file is required.');
    const file = resolve(dir, a.file);
    const review = validReview(JSON.parse(readFileSync(file, 'utf8')) as Review);
    const out = await writeOutputs(review, configIn(dir), dirname(file));
    return `Rebuilt ${out.deck}`;
  }
  if (name === 'generate_sprint_review') {
    const config = configIn(dir);
    const result = await generate(config, { model: clientFor(config.model), range: rangeOf(a, config) });
    const outDir = resolve(config.root, typeof a.out === 'string' ? a.out : join(config.output.dir, result.review.until));
    const files = await writeOutputs(result.review, config, outDir, { pptx: a.pptx === true ? true : undefined });
    const checks = result.review.checks.map((c) => `- ${c.kind}: ${c.text}${c.reason ? ` (${c.reason})` : ''}`).join('\n') || '- none';
    return [
      `Wrote ${result.review.themes.length} themes and ${result.review.screens.length} before-and-after slides.`,
      `Deck: ${files.deck}`,
      `Content (edit, then render): ${files.review}`,
      files.pptx ? `PowerPoint: ${files.pptx}` : '',
      `Checks: ${files.checks}`,
      '',
      'Themes:',
      ...result.review.themes.map((t) => `- ${t.title}: ${t.effect ?? ''}`),
      '',
      'What the checks did:',
      checks,
    ].filter((l) => l !== '').join('\n');
  }
  throw new Error(`Unknown tool ${name}.`);
}

/** Answers one JSON-RPC message; null for notifications. */
export async function handle(msg: { id?: number | string | null; method?: string; params?: Record<string, unknown> }, cwd = process.cwd()): Promise<Record<string, unknown> | null> {
  const reply = (result: unknown) => ({ jsonrpc: '2.0', id: msg.id ?? null, result });
  const fail = (code: number, message: string) => ({ jsonrpc: '2.0', id: msg.id ?? null, error: { code, message } });
  if (msg.id === undefined || msg.id === null) return null;
  switch (msg.method) {
    case 'initialize':
      return reply({
        protocolVersion: typeof msg.params?.protocolVersion === 'string' ? msg.params.protocolVersion : PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: 'sprint-review', version: pkg.version },
        instructions: 'Generates sprint review decks from git history. Check the setup first, preview the commits, then generate. Report the checks to the user.',
      });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: TOOLS });
    case 'tools/call': {
      const name = String(msg.params?.name ?? '');
      if (!TOOLS.some((t) => t.name === name)) return fail(-32602, `Unknown tool ${name}`);
      try {
        const text = await callTool(name, (msg.params?.arguments as Args) ?? {}, cwd);
        return reply({ content: [{ type: 'text', text }] });
      } catch (e) {
        return reply({ content: [{ type: 'text', text: (e as Error).message }], isError: true });
      }
    }
    default:
      return fail(-32601, `Method not found: ${msg.method}`);
  }
}

/** The MCP server over stdio: one JSON message per line in, one per line out. Logs go to stderr. */
export function serveMcp(): void {
  const rl = createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n');
      return;
    }
    handle(msg).then((answer) => {
      if (answer) process.stdout.write(JSON.stringify(answer) + '\n');
    });
  });
}
