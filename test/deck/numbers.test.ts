import { test } from 'node:test';
import assert from 'node:assert/strict';
import { change, trendPoints } from '../../src/deck/numbers.ts';

test('the change says how much and whether it went the better way', () => {
  assert.deepEqual(change({ label: 'repairs', value: 312, previous: 268 }, 'en'), { text: '+16%', good: true });
  assert.deepEqual(change({ label: 'waiting', value: 52, previous: 61, better: 'down' }, 'en'), { text: '−15%', good: true });
  assert.deepEqual(change({ label: 'errors', value: 21, previous: 20, better: 'down' }, 'en'), { text: '+5%', good: false });
  assert.equal(change({ label: 'new', value: 4, previous: 0 }, 'en'), null);
  assert.equal(change({ label: 'new', value: 4 }, 'en'), null);
  assert.deepEqual(change({ label: 'from history', value: 110, history: [90, 100] }, 'en'), { text: '+10%', good: true });
});

test('a trend line needs three sprints and fits its box', () => {
  assert.equal(trendPoints({ label: 'x', value: 3, history: [1] }), null);
  const line = trendPoints({ label: 'x', value: 312, history: [190, 221, 240, 268] })!;
  assert.equal(line.length, 5);
  assert.ok(line.every((p) => p.x >= 3 && p.x <= 117 && p.y >= 3 && p.y <= 27));
  assert.equal(line.at(-1)!.y, 3, 'the highest value at the top');
});
