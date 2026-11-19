import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EchoModel, loadCases, report, runCase, score } from '../bench/bench.ts';
import type { Review } from '../src/types.ts';

test('every benchmark case loads and runs through the real pipeline', async () => {
  const cases = loadCases();
  assert.ok(cases.length >= 3);
  for (const c of cases) {
    const { score: s, review } = await runCase(c, new EchoModel());
    assert.equal(s.error, undefined, `${c.name}: ${s.error}`);
    assert.ok(review && review.themes.length > 0, c.name);
    assert.ok(s.total > 0 && s.total <= 100);
  }
});

test('the score notices missed themes, plumbing up front and forbidden text', () => {
  const [bike] = loadCases(['bike-shop']);
  const review = JSON.parse(readFileSync(new URL('../docs/demo/review.json', import.meta.url), 'utf8')) as Review;
  review.themes[0]!.points.push('Vite is up to date');
  review.underTheHood = [];
  review.summary.push({ text: 'Every customer gets a free bike', icon: 'other' });
  const s = score(bike!, review);
  assert.ok(s.themes.missed.includes('text when the bike is ready'), 'the demo deck has no text-message theme');
  assert.deepEqual(s.leaked, ['vite upgrade']);
  assert.deepEqual(s.hood.found, []);
  assert.deepEqual(s.forbidden, ['free bike']);
  assert.ok(s.total < 80);
  assert.match(report([s], 'test'), /Plumbing on the front slides: vite upgrade/);
});
