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

