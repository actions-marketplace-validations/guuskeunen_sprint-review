import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareScreens } from '../../src/screens/compare.ts';

const png = (name: string) => readFileSync(new URL(`../fixtures/screens/${name}.png`, import.meta.url));

test('the comparison finds where a change starts: the new progress bar, not the rows it pushed down', async () => {
  const cmp = await compareScreens(png('planner-desktop.before'), png('planner-desktop.after'), 'desktop', { left: 0, top: 0 });
  assert.ok(cmp?.changed && cmp.focus);
  assert.ok(cmp.focus.y < 0.1 && cmp.focus.h < 0.4, `framed ${JSON.stringify(cmp.focus)}`);
  for (const k of ['x', 'y', 'w', 'h'] as const) assert.ok(cmp.focus[k] >= 0 && cmp.focus[k] <= 1);
});

test('the same picture twice has nothing to frame', async () => {
  const cmp = await compareScreens(png('planner-desktop.after'), png('planner-desktop.after'), 'desktop', { left: 0, top: 0 });
  assert.equal(cmp?.changed, false);
  assert.equal(cmp?.focus, undefined);
});

test('a picture taken at twice the sharpness is not a change', async () => {
  const sharp = (await import('sharp')).default;
  const before = png('planner-desktop.before');
  const { width } = await sharp(before).metadata();
  const sharper = await sharp(before).resize({ width: width! * 2 }).png().toBuffer();
  const cmp = await compareScreens(before, sharper, 'desktop', { left: 0, top: 0 });
  assert.equal(cmp?.changed, false);
});
