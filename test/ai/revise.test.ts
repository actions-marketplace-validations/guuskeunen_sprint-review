import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../../src/config.ts';
import { generate } from '../../src/review/generate.ts';
import { demoRepo, FakeModel } from '../helpers.ts';

const range = { kind: 'dates' as const, from: '2026-11-03', until: '2026-11-16' };

const config = (dir: string, extra: Record<string, unknown> = {}) =>
  normalize({ product: { name: 'Spoke' }, organization: 'Northside Cycles', productPaths: ['src/'], github: { pullRequests: false }, ...extra }, dir);

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
