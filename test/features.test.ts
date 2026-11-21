import { test } from 'node:test';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { normalize, ConfigError } from '../src/config.ts';
import { generate } from '../src/generate.ts';
import { renderDeck } from '../src/render.ts';
import { withPullRequests, githubRepo } from '../src/github.ts';
import { History } from '../src/history.ts';
import { commitLog } from '../src/prompt.ts';
import { OpenAIClient, AnthropicClient } from '../src/model.ts';
import { clientFor } from '../src/providers.ts';
import { slackMessage, postToSlack } from '../src/slack.ts';
import { readZip } from '../src/zip.ts';
import { brandFromPptx } from '../src/brand.ts';
import { renderPptx } from '../src/pptx.ts';
import { startEditor, validReview } from '../src/editor.ts';
import { handle, TOOLS } from '../src/mcp.ts';
import { screens } from '../src/screenshots.ts';
import { writeOutputs } from '../src/output.ts';
import type { Commit, Review } from '../src/types.ts';
import { demoRepo, FakeModel } from './helpers.ts';

const range = { kind: 'dates' as const, from: '2026-11-03', until: '2026-11-16' };
const config = (dir: string, extra: Record<string, unknown> = {}) =>
  normalize({ product: { name: 'Spoke' }, organization: 'Northside Cycles', productPaths: ['src/'], github: { pullRequests: false }, ...extra }, dir);

function response(status: number, body: unknown): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

// ---------- revision pass ----------

test('a flagged line is rewritten once, checked again and logged as corrected', async () => {
  const dir = demoRepo();
  const { review } = await generate(config(dir), { model: new FakeModel({ revision: 'Counts per status now show up right away' }), range });
  const planner = review.themes.find((t) => t.title === 'Workshop planner');
  assert.ok(planner?.points.includes('Counts per status now show up right away'));
  assert.ok(!review.checks.some((c) => c.kind === 'warning' && c.text === 'Status counts load with less work'));
  assert.ok(review.checks.some((c) => c.kind === 'corrected' && /Rewritten because the reader got stuck/.test(c.reason)));
});

test('a rewrite that breaks the rules is not used and the warning stays', async () => {
  const dir = demoRepo();
  const long = 'This rewrite is far too long to fit on a slide because it keeps going on and on and on without end';
  const { review } = await generate(config(dir), { model: new FakeModel({ revision: long }), range });
  assert.ok(!JSON.stringify(review.themes).includes('far too long'));
  assert.ok(review.checks.some((c) => c.kind === 'warning' && c.text === 'Status counts load with less work'));
});

test('revise: false skips the rewrite call', async () => {
  const dir = demoRepo();
  const model = new FakeModel({ revision: 'Counts per status now show up right away' });
  await generate(config(dir, { revise: false }), { model, range });
  assert.ok(!model.requests.some((r) => r.tool.name === 'revisions'));
});

// ---------- pull requests ----------

const commit = (hash: string, product = true): Commit => ({ hash, date: '2026-11-10', subject: `change ${hash}`, body: '', files: [], product });

test('pull request titles and descriptions are added, the description once per PR', async () => {
  const calls: string[] = [];
  const fake = (async (url: string) => {
    calls.push(String(url));
    return response(200, [{ number: 42, title: 'Customer timeline', body: 'Front desk asked for one page.<!-- template -->', merged_at: '2026-11-10T10:00:00Z' }]);
  }) as unknown as typeof fetch;
  const { commits, found } = await withPullRequests([commit('aaaaaaa'), commit('bbbbbbb'), commit('ccccccc', false)], 'acme/spoke', 'token', fake);
  assert.equal(found, 1);
  assert.equal(calls.length, 2, 'commits without product code are not looked up');
  assert.equal(commits[0]!.pullRequest?.body, 'Front desk asked for one page.<!-- template -->');
  assert.equal(commits[1]!.pullRequest?.body, '');
  const log = commitLog(commits);
  assert.match(log, /Pull request: Customer timeline\nFront desk asked for one page\./);
  assert.doesNotMatch(log, /template/);
});

test('no access to the GitHub API leaves the commits as they were and stops asking', async () => {
  let n = 0;
  const fake = (async () => (n++, response(404, { message: 'Not Found' }))) as unknown as typeof fetch;
  const input = [commit('aaaaaaa'), commit('bbbbbbb')];
  const { commits, found } = await withPullRequests(input, 'acme/spoke', null, fake);
  assert.equal(found, 0);
  assert.equal(n, 1);
  assert.deepEqual(commits, input);
});

test('the GitHub repository comes from the config, GITHUB_REPOSITORY or the origin remote', () => {
  const dir = demoRepo();
  const history = new History(dir);
  assert.equal(githubRepo(history, 'a/b', {}), 'a/b');
  assert.equal(githubRepo(history, null, { GITHUB_REPOSITORY: 'c/d' }), 'c/d');
  assert.equal(githubRepo(history, null, {}), null);
  execFileSync('git', ['-C', dir, 'remote', 'add', 'origin', 'git@github.com:acme/spoke.git']);
  assert.equal(githubRepo(history, null, {}), 'acme/spoke');
});

// ---------- OpenAI ----------

test('the OpenAI client forces the function and reads its arguments', async () => {
  let sent: any;
  const fake = (async (_url: string, init: RequestInit) => {
    sent = JSON.parse(String(init.body));
    return response(200, { model: 'gpt-x', usage: { prompt_tokens: 10, completion_tokens: 5 }, choices: [{ message: { tool_calls: [{ function: { name: 'presentation', arguments: '{"summary":[]}' } }] } }] });
  }) as unknown as typeof fetch;
  const client = new OpenAIClient('key', 'gpt-x', null, fake);
  const answer = await client.ask({ system: 'sys', messages: ['a', 'b'], tool: { name: 'presentation', description: 'd', input_schema: { type: 'object' } }, maxTokens: 100 });
  assert.deepEqual(answer.toolInput, { summary: [] });
  assert.deepEqual(answer.usage, { input: 10, output: 5 });
  assert.equal(sent.tool_choice.function.name, 'presentation');
  assert.equal(sent.messages[0].role, 'system');
});

test('the provider picks the client and the key', () => {
  assert.ok(clientFor({ provider: 'anthropic', name: 'm', fallback: null }, { ANTHROPIC_API_KEY: 'k' }) instanceof AnthropicClient);
  assert.ok(clientFor({ provider: 'openai', name: 'm', fallback: null }, { OPENAI_API_KEY: 'k' }) instanceof OpenAIClient);
  assert.throws(() => clientFor({ provider: 'openai', name: 'm', fallback: null }, {}), /OPENAI_API_KEY/);
  assert.throws(() => normalize({ model: { provider: 'openai' } }, '/tmp'), /model.name is required/);
});

// ---------- Slack ----------

const sample = (): Review => JSON.parse(readFileSync(new URL('../docs/demo/review.json', import.meta.url), 'utf8')) as Review;

test('the Slack message has the summary, the themes and the link, escaped', async () => {
  const review = sample();
  review.summary[0]!.text = 'Tom & Jerry <script>';
  const msg = slackMessage(review, 'https://example.com/deck.html') as { blocks: any[] };
  const text = JSON.stringify(msg);
  assert.match(text, /Tom &amp; Jerry &lt;script&gt;/);
  assert.match(text, /Open the deck/);
  for (const t of review.themes) assert.ok(text.includes(t.title));
  await assert.rejects(postToSlack('https://evil.example.com/hook', review, null), /incoming webhook/);
  let posted = false;
  await postToSlack('https://hooks.slack.com/services/x', review, null, (async () => ((posted = true), new Response('ok'))) as unknown as typeof fetch);
  assert.ok(posted);
});

// ---------- brand from a .pptx ----------

/** A tiny zip writer, just for the test: deflated entries. */
function zip(files: Record<string, string | Buffer>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const raw = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const data = deflateRawSync(raw);
    const n = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, n, data);
    centrals.push(central, n);
    offset += 30 + n.length + data.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

test('the brand is read from a presentation: accent color, fonts and the logo on the master', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brand-'));
  const file = join(dir, 'brand.pptx');
  writeFileSync(file, zip({
    'ppt/theme/theme1.xml': '<a:theme><a:clrScheme><a:accent1><a:srgbClr val="0B7A75"/></a:accent1></a:clrScheme><a:fontScheme><a:majorFont><a:latin typeface="Playfair Display"/></a:majorFont><a:minorFont><a:latin typeface="Inter"/></a:minorFont></a:fontScheme></a:theme>',
    'ppt/slideMasters/slideMaster1.xml': '<p:sldMaster><p:pic><a:blip r:embed="rId2"/><a:ext cx="100" cy="50"/></p:pic><p:pic><a:blip r:embed="rId3"/><a:ext cx="9000000" cy="5000000"/></p:pic></p:sldMaster>',
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': '<Relationships><Relationship Id="rId2" Target="../media/logo.png"/><Relationship Id="rId3" Target="../media/background.png"/></Relationships>',
    'ppt/media/logo.png': PNG,
    'ppt/media/background.png': Buffer.concat([PNG, Buffer.from('x')]),
  }));
  assert.equal(readZip(readFileSync(file)).size, 5);
  const brand = brandFromPptx(file);
  assert.equal(brand.color, '#0b7a75');
  assert.deepEqual(brand.fonts, { heading: 'Playfair Display', body: 'Inter' });
  assert.equal(brand.logo, `data:image/png;base64,${PNG.toString('base64')}`);

  const html = renderDeck(sample(), { color: brand.color, fonts: brand.fonts });
  assert.match(html, /--font-heading: "Playfair Display"/);
  assert.match(html, /--accent: #0b7a75/);
});

test('font names cannot break out of the style sheet', () => {
  const html = renderDeck(sample(), { fonts: { heading: 'X"; } body { display:none } /*' } });
  const rule = /html\[data-theme\] \{[^\n]*/.exec(html)?.[0] ?? '';
  assert.doesNotMatch(rule, /display:none|\/\*|\} body/);
  assert.match(html, /--font-heading: "X body displaynone"/);
});

// ---------- themes ----------

test('the deck is light by default and dark on request', () => {
  assert.match(renderDeck(sample()), /data-theme="light"/);
  assert.doesNotMatch(renderDeck(sample()), /Iowan Old Style/);
  assert.match(renderDeck(sample(), { theme: 'dark' }), /data-theme="dark"[\s\S]*Iowan Old Style/);
  assert.equal(normalize({}, '/tmp').brand.theme, 'light');
  assert.throws(() => normalize({ brand: { theme: 'neon' } }, '/tmp'), ConfigError);
});

// ---------- PowerPoint ----------

test('the review exports to an editable PowerPoint with speaker notes', async () => {
  const review = sample();
  const buf = await renderPptx(review, { color: '#ea580c' });
  const entries = readZip(buf);
  const slides = [...entries.keys()].filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k));
  assert.equal(slides.length, 15);
  const all = slides.map((k) => entries.get(k)!().toString('utf8')).join('');
  for (const t of review.themes) assert.ok(all.includes(t.title.replace(/&/g, '&amp;')), t.title);
  const notes = [...entries.keys()].filter((k) => /notesSlide\d+\.xml$/.test(k)).map((k) => entries.get(k)!().toString('utf8')).join('');
  assert.ok(notes.includes(review.themes[0]!.notes!.slice(0, 30)));
});

test('a brand font falls back to a sans-serif stack, never to a variable that points at itself', () => {
  const html = renderDeck(sample(), { fonts: { heading: 'Space Grotesk', body: 'Inter' } });
  const body = /--font-body: ([^;]+);/.exec(html.slice(html.indexOf('html[data-theme] {')))![1]!;
  assert.ok(body.startsWith('"Inter", '));
  assert.doesNotMatch(body, /var\(--font-body/);
  assert.match(body, /sans-serif$/);
});

test('the deck has an Edit button, shown only when opened from disk, in the deck\'s language', () => {
  const html = renderDeck(sample(), {});
  assert.match(html, /<button class="edit-button" type="button" hidden>Edit<\/button>/);
  assert.match(html, /location\.protocol === 'file:' && window\.parent === window/);
  assert.match(renderDeck({ ...sample(), language: 'Dutch' }, {}), />Bewerken<\/button>/);
  for (const script of html.match(/<script>([\s\S]*?)<\/script>/g) ?? []) assert.doesNotThrow(() => new Function(script.slice(8, -9)), 'the deck script compiles');
});

test('a square logo stays square on the PowerPoint cover', async () => {
  const square = await sharp({ create: { width: 64, height: 64, channels: 4, background: '#123456' } }).png().toBuffer();
  const buf = await renderPptx(sample(), { logo: `data:image/png;base64,${square.toString('base64')}` });
  const cover = readZip(buf).get('ppt/slides/slide1.xml')!().toString('utf8');
  const ext = /<p:pic>[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"/.exec(cover)!;
  assert.equal(ext[1], ext[2]);
});

test('render --pptx rebuilds the PowerPoint too', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rerender-'));
  writeFileSync(join(dir, 'review.json'), JSON.stringify(sample()));
  const cli = new URL('../src/cli.ts', import.meta.url).pathname;
  const out = execFileSync('node', [cli, 'render', join(dir, 'review.json'), '--pptx'], { cwd: dir }).toString();
  assert.ok(existsSync(join(dir, 'deck.pptx')), out);
  assert.match(out, /deck\.pptx/);
});

test('writeOutputs writes the .pptx only when asked', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'out-'));
  const c = normalize({}, dir);
  const a = await writeOutputs(sample(), c, join(dir, 'a'));
  assert.equal(a.pptx, null);
  const b = await writeOutputs(sample(), c, join(dir, 'b'), { pptx: true });
  assert.ok(b.pptx && existsSync(b.pptx));
});

// ---------- editor ----------

test('the editor serves the form, previews, saves and rebuilds, and refuses requests without its token', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'edit-'));
  const file = join(dir, 'review.json');
  writeFileSync(file, JSON.stringify(sample()));
  const editor = await startEditor(file, normalize({}, dir), 0);
  try {
    const page = await (await fetch(editor.url)).text();
    const token = /"token":"([^"]+)"/.exec(page)?.[1];
    assert.ok(token);
    assert.equal((await fetch(`${editor.url}api/review`)).status, 403);
    const headers = { 'x-sprint-review-token': token!, 'content-type': 'application/json' };
    const review = (await (await fetch(`${editor.url}api/review`, { headers })).json()) as Review;
    review.themes[0]!.title = 'Customer page';
    const preview = await (await fetch(`${editor.url}api/preview`, { method: 'POST', headers, body: JSON.stringify(review) })).text();
    assert.match(preview, /Customer page/);
    const saved = await fetch(`${editor.url}api/review`, { method: 'PUT', headers, body: JSON.stringify(review) });
    assert.equal(saved.status, 200);
    assert.equal((JSON.parse(readFileSync(file, 'utf8')) as Review).themes[0]!.title, 'Customer page');
    assert.match(readFileSync(join(dir, 'deck.html'), 'utf8'), /Customer page/);
    const bad = await fetch(`${editor.url}api/review`, { method: 'PUT', headers, body: '{"version":2}' });
    assert.equal(bad.status, 400);
  } finally {
    await editor.close();
  }
});

test('the live view shows each edit and the slide being edited, before anything is saved', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'live-'));
  const file = join(dir, 'review.json');
  writeFileSync(file, JSON.stringify(sample()));
  const editor = await startEditor(file, normalize({}, dir), 0);
  const stop = new AbortController();
  try {
    const token = /"token":"([^"]+)"/.exec(await (await fetch(editor.url)).text())![1]!;
    assert.equal((await fetch(`${editor.url}live`)).status, 403);
    assert.match(await (await fetch(`${editor.url}live?token=${token}`)).text(), /EventSource/);
    assert.equal((await fetch(`${editor.url}api/events`)).status, 403);

    const events = await fetch(`${editor.url}api/events?token=${token}`, { signal: stop.signal });
    assert.match(events.headers.get('content-type') ?? '', /text\/event-stream/);
    const reader = events.body!.getReader();
    let seen = '';
    const until = async (re: RegExp) => {
      while (!re.test(seen)) seen += new TextDecoder().decode((await reader.read()).value);
    };
    await until(/event: deck/);
    const headers = { 'x-sprint-review-token': token, 'content-type': 'application/json' };
    const review = sample();
    review.themes[0]!.title = 'Typed just now';
    await fetch(`${editor.url}api/preview`, { method: 'POST', headers, body: JSON.stringify(review) });
    await until(/Typed just now/);
    await fetch(`${editor.url}api/slide`, { method: 'POST', headers, body: JSON.stringify({ n: 4 }) });
    await until(/event: slide\ndata: \{"n":4\}/);
    assert.notEqual((JSON.parse(readFileSync(file, 'utf8')) as Review).themes[0]!.title, 'Typed just now', 'nothing is saved');
  } finally {
    stop.abort();
    await editor.close();
  }
});

test('validReview drops empty lines and refuses a broken review', () => {
  const r = sample();
  r.themes[0]!.points.push('  ');
  r.underTheHood.push('');
  const v = validReview(r);
  assert.ok(v.themes[0]!.points.every((p) => p.trim()));
  assert.ok(v.underTheHood.every((p) => p.trim()));
  assert.throws(() => validReview({ ...r, themes: [{ title: 1 }] }), /theme/);
});

// ---------- MCP ----------

test('the MCP server answers initialize, lists its tools and runs them', async () => {
  const dir = demoRepo();
  const init = await handle({ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal((init!.result as any).serverInfo.name, 'sprint-review');
  assert.equal(await handle({ method: 'notifications/initialized' }), null);
  const list = await handle({ id: 2, method: 'tools/list' });
  assert.deepEqual((list!.result as any).tools.map((t: any) => t.name), TOOLS.map((t) => t.name));
  const preview = await handle({ id: 3, method: 'tools/call', params: { name: 'preview_sprint_commits', arguments: { directory: dir, since: '2026-11-03', until: '2026-11-16' } } });
  assert.match((preview!.result as any).content[0].text, /commits \(\d+ touch product code\)/);
  const bad = await handle({ id: 4, method: 'tools/call', params: { name: 'preview_sprint_commits', arguments: { directory: dir, since: 'last week' } } });
  assert.equal((bad!.result as any).isError, true);
  const unknown = await handle({ id: 5, method: 'nope' });
  assert.equal((unknown!.error as any).code, -32601);
});

test('the MCP server speaks JSON lines over stdio', () => {
  const cli = new URL('../src/cli.ts', import.meta.url).pathname;
  const input = [
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
  ].join('\n') + '\n';
  const out = execFileSync('node', [cli, 'mcp'], { input, timeout: 15000, killSignal: 'SIGTERM' }).toString();
  const lines = out.trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.length, 2);
  assert.equal(lines[1].result.tools.length, TOOLS.length);
});

// ---------- captured screenshots ----------

test('captured screenshots are compared between the last day before the sprint and its end', async () => {
  const dir = demoRepo();
  const fixtures = new URL('./fixtures/screens/', import.meta.url).pathname;
  const store = join(dir, '.sprint-review/screenshots');
  for (const [day, kind] of [['2026-11-01', 'before'], ['2026-11-16', 'after']] as const) {
    mkdirSync(join(store, day), { recursive: true });
    writeFileSync(join(store, day, 'planner-desktop.png'), readFileSync(join(fixtures, `planner-desktop.${kind}.png`)));
  }
  const c = normalize({ screenshots: { source: 'capture', pages: { planner: '/planner' }, baseUrl: 'http://localhost:3000' } }, dir);
  assert.equal(c.screenshots.source, 'capture');
  const shots = screens(c.screenshots, dir, new History(dir), range, { phone: 'phone', desktop: 'desktop' });
  const changed = await shots.changed();
  assert.equal(changed.length, 1);
  assert.equal(changed[0]!.device, 'desktop');
  assert.throws(() => normalize({ screenshots: { source: 'capture' } }, dir), /screenshots.pages is required/);
});
