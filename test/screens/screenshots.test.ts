import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize } from '../../src/config.ts';
import { History } from '../../src/git/history.ts';
import { screens } from '../../src/screens/screenshots.ts';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/screens/${name}.png`, import.meta.url));

/** Before and after folders; the planner also in dark mode, the customer page only at the end. */
function folders(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sprint-review-dark-'));
  for (const side of ['before', 'after'] as const) {
    mkdirSync(join(dir, side));
    copyFileSync(fixture(`planner-desktop.${side}`), join(dir, side, 'planner-desktop.png'));
    // The dark pictures here are the light ones swapped, so the test can tell which pair was compared.
    copyFileSync(fixture(`planner-desktop.${side === 'before' ? 'after' : 'before'}`), join(dir, side, 'planner-desktop-dark.png'));
  }
  copyFileSync(fixture('customer-page-desktop.after'), join(dir, 'after', 'customer-page-desktop-dark.png'));
  copyFileSync(fixture('customer-page-desktop.before'), join(dir, 'after', 'customer-page-desktop.png'));
  return dir;
}

test('the dark deck compares the dark pair where both ends have one, and never mixes light and dark', async () => {
  const dir = folders();
  const config = normalize({ screenshots: { source: 'folder', before: 'before', after: 'after' } }, dir);
  const open = (scheme: 'light' | 'dark') => screens(config.screenshots, dir, new History(dir), { kind: 'dates', from: '2026-11-01', until: '2026-11-14' }, { phone: 'phone', desktop: 'desktop' }, scheme);
  const [light] = await open('light').changed();
  const [dark] = await open('dark').changed();
  assert.equal(light!.name, 'Planner');
  assert.equal(dark!.name, 'Planner');
  assert.ok(!light!.after.equals(dark!.after), 'the dark deck got the dark pictures');
  assert.equal((await open('dark').changed()).length, 1, 'the customer page has no dark picture at the start: no comparison');
  const picture = open('dark').picture('customer-page', 'desktop');
  assert.ok(picture?.equals(await import('node:fs').then((fs) => fs.readFileSync(join(dir, 'after', 'customer-page-desktop-dark.png')))), 'a single picture prefers dark');
});
