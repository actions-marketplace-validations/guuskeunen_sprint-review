import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { normalize } from '../../src/config.ts';
import { History } from '../../src/git/history.ts';
import { screens } from '../../src/screens/screenshots.ts';
import { demoRepo } from '../helpers.ts';

const range = { kind: 'dates' as const, from: '2026-11-03', until: '2026-11-16' };

test('captured screenshots are compared between the last day before the sprint and its end', async () => {
  const dir = demoRepo();
  const fixtures = new URL('../fixtures/screens/', import.meta.url).pathname;
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


test('a page entry with a selector photographs just that element; one that is missing is skipped', async (t) => {
  const { capture } = await import('../../src/screens/capture.ts');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const sharp = (await import('sharp')).default;
  const dir = mkdtempSync(join(tmpdir(), 'sprint-review-capture-'));
  writeFileSync(join(dir, 'app.html'), '<body style="margin:0"><div style="height:300px">header</div><section class="card" style="width:320px;height:180px;background:#eef">Signals <span class="email">a@b.test</span></section></body>');
  const c = normalize({ screenshots: { source: 'capture', pages: { app: `file://${join(dir, 'app.html')}`, signals: { url: `file://${join(dir, 'app.html')}`, selector: 'section.card' }, gone: { url: `file://${join(dir, 'app.html')}`, selector: '.nothing' } }, mask: ['.email'], wait: 0 } }, dir);
  if (c.screenshots.source !== 'capture') throw new Error('capture expected');
  const steps: string[] = [];
  let files: string[];
  try {
    files = await capture(c.screenshots.capture, dir, '2026-11-22', (m) => steps.push(m), 1000);
  } catch (e) {
    return t.skip(`no browser: ${(e as Error).message.slice(0, 60)}`);
  }
  assert.deepEqual(files.map((f) => f.split('/').pop()), ['app-desktop.png', 'signals-desktop.png']);
  const { width, height } = await sharp(readFileSync(files[1]!)).metadata();
  assert.deepEqual([width, height], [320, 180], 'only the element');
  assert.ok(steps.some((m) => m.includes('Not found on gone')));
});
