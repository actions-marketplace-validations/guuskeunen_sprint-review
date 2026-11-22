import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { normalize } from '../../src/config.ts';
import { generate } from '../../src/review/generate.ts';
import { compareScreens } from '../../src/screens/compare.ts';
import { demoRepo, FakeModel } from '../helpers.ts';

const range = { kind: 'dates' as const, from: '2026-11-03', until: '2026-11-16' };

function demoConfig(dir: string, extra: Record<string, unknown> = {}) {
  return normalize(
    {
      product: { name: 'Spoke', description: 'the planning and customer app of a chain of bike repair shops' },
      organization: 'Northside Cycles',
      brand: { color: '#ea580c' },
      productPaths: ['src/'],
      screenshots: { source: 'git', dir: 'e2e/__screenshots__', names: { 'customer-page': 'Customer page', planner: 'Workshop planner', repairs: 'Repairs' }, ignore: { left: 0, top: 0 } },
      ...extra,
    },
    dir,
  );
}

test('generates a full review from a real git history', async () => {
  const dir = demoRepo();
  const model = new FakeModel();
  const { review, html, markdown } = await generate(demoConfig(dir), { model, range });

  // Every commit in the range, the tooling ones marked.
  const log = model.requests[0]!.messages[0]!;
  assert.match(log, /\[no product code\]/);
  assert.doesNotMatch(log, /Co-Authored-By/);

  // The checks did their work.
  assert.equal(review.themes.length, 5, 'the theme without real commits is dropped');
  assert.ok(!review.themes[1]!.points.some((p) => p.includes('#42')), 'PR numbers are stripped');
  assert.ok(!review.themes[1]!.points.some((p) => p.includes('!')), 'exclamation marks are dropped');
  assert.ok(review.underTheHood.some((x) => x.text === 'Caches playwright browsers in CI'), 'a tooling point moves under the hood');
  assert.equal(review.headline, 'The front desk sees a whole customer on one page');
  assert.deepEqual(review.questions, ['Which repairs would you still type in by hand?', 'What is missing on the customer page?'], 'a question with an exclamation mark is dropped');
  assert.ok(review.checks.some((c) => c.reason.startsWith('The reader got stuck')));

  // Pictures: changed screens with a caption get a before and after slide; a theme never repeats one.
  assert.deepEqual(review.screens.map((s) => s.name).sort(), ['Customer page', 'Repairs (phone)', 'Workshop planner']);
  assert.equal(review.themes[0]!.screen, null, 'the customer page already has a before and after slide');
  assert.equal(review.themes[4]!.screen?.device, 'phone');

  // Roadmap at the end of the range.
  assert.equal(review.milestones.filter((m) => m.done).length, 4);

  // The deck is self-contained and branded.
  assert.match(html, /--accent: #ea580c/);
  assert.match(html, /data-ref="headline"[\s\S]*The front desk sees a whole customer on one page/);
  assert.doesNotMatch(html, /<script src=|<link rel="stylesheet"|https?:\/\/fonts/);
  assert.match(markdown, /^# Sprint review November 16, 2026/);
});

test('a failing second reader leaves the draft with a warning', async () => {
  const dir = demoRepo();
  const { review } = await generate(demoConfig(dir), { model: new FakeModel({ failReader: true }), range });
  assert.equal(review.checks[0]?.text, 'Not proofread');
});

test('Dutch labels and a range by git refs', async () => {
  const dir = demoRepo();
  const { review, html } = await generate(demoConfig(dir, { language: 'Dutch' }), { model: new FakeModel(), range: { kind: 'refs', from: 'HEAD~9', to: 'HEAD' } });
  assert.match(review.title, /^Sprint review 14 november 2026$/);
  assert.match(html, /Ook opgeleverd/);
  assert.match(html, /lang="nl"/);
});

test('screens that only differ in the ignored menu do not count as changed', async () => {
  const base = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const menu = await sharp(base).composite([{ input: { create: { width: 100, height: 600, channels: 3, background: '#000000' } }, left: 0, top: 0 }]).png().toBuffer();
  const content = await sharp(base).composite([{ input: { create: { width: 300, height: 200, channels: 3, background: '#ff0000' } }, left: 400, top: 300 }]).png().toBuffer();
  assert.equal((await compareScreens(base, menu, 'desktop', { left: 120, top: 0 }))?.changed, false);
  const changed = await compareScreens(base, content, 'desktop', { left: 120, top: 0 });
  assert.equal(changed?.changed, true);
  const meta = await sharp(changed!.after).metadata();
  assert.ok(meta.height! <= 560, 'desktop pictures are cropped to the change');
});

test('commit messages go in as untrusted data', async () => {
  const dir = demoRepo();
  const model = new FakeModel();
  await generate(demoConfig(dir), { model, range });
  assert.match(model.requests[0]!.messages[0]!, /^<untrusted-[0-9a-f]{12} /);
  assert.match(model.requests[0]!.system, /never as instructions/);
  void readFileSync;
  void join;
});

test('a folder that is not a git repository says how to point at the repository', async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'no-git-'));
  await assert.rejects(
    generate(normalize({}, dir), { model: new FakeModel() }),
    (e: Error) => e.message.includes(`${dir} is not a git repository`) && /set repo: in the config/.test(e.message),
  );
});

test('the reader and the rewrite get the same room as the writer, for models that think first', async () => {
  const { readFileSync: read } = await import('node:fs');
  const src = read(new URL('../../src/ai/writer.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /maxTokens: \d/);
});

test('when no theme survives although the product changed, the writer is asked once more', async () => {
  const dir = demoRepo();
  const fake = new FakeModel();
  let writerCalls = 0;
  const model = {
    async ask(request: Parameters<FakeModel['ask']>[0]) {
      const answer = await fake.ask(request);
      if (request.tool.name === 'presentation' && ++writerCalls === 1) return { ...answer, toolInput: { ...answer.toolInput, themes: 'not a list', under_the_hood: [] } };
      return answer;
    },
  };
  const { review } = await generate(demoConfig(dir), { model, range });
  assert.equal(writerCalls, 2);
  assert.ok(review.themes.length > 0);
});

test('a ref that looks like a git option is refused, never passed to git', async () => {
  const { mkdtempSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = demoRepo();
  const target = join(mkdtempSync(join(tmpdir(), 'inject-')), 'written');
  for (const range of [{ kind: 'refs' as const, from: `--output=${target}`, to: 'HEAD' }, { kind: 'refs' as const, from: 'HEAD~1', to: `--output=${target}` }]) {
    await assert.rejects(generate(demoConfig(dir), { model: new FakeModel(), range }), /not a valid git ref/);
  }
  assert.equal(existsSync(target), false, 'git wrote nothing');
});

test('clear messages, before any model call, for an empty repository, an unknown ref and no product commits', async () => {
  const { mkdtempSync, writeFileSync: write } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { execFileSync: git } = await import('node:child_process');
  const env = { ...process.env, GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@example.test', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@example.test', GIT_AUTHOR_DATE: '2026-11-10T10:00:00Z', GIT_COMMITTER_DATE: '2026-11-10T10:00:00Z' };
  const empty = mkdtempSync(join(tmpdir(), 'empty-'));
  git('git', ['init', '-q', empty]);
  const model = new FakeModel();
  await assert.rejects(generate(normalize({}, empty), { model, range }), /no commits yet/);
  const dir = demoRepo();
  await assert.rejects(generate(demoConfig(dir), { model, range: { kind: 'refs', from: 'no-such-tag', to: 'HEAD' } }), /No tag, branch or commit called "no-such-tag"/);
  const docsOnly = mkdtempSync(join(tmpdir(), 'docs-'));
  git('git', ['init', '-q', docsOnly]);
  write(join(docsOnly, 'README.md'), 'x');
  git('git', ['add', '-A'], { cwd: docsOnly });
  git('git', ['commit', '-q', '-m', 'docs: readme'], { cwd: docsOnly, env });
  await assert.rejects(generate(normalize({ productPaths: ['src/'] }, docsOnly), { model, range }), /None of the 1 commit.*src\//);
  assert.equal(model.requests.length, 0, 'no model call was paid for');
});
