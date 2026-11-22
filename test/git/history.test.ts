import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { History } from '../../src/git/history.ts';
import { demoRepo } from '../helpers.ts';

test('a shallow clone is fine when it reaches back to before the sprint; otherwise it says how far to fetch', () => {
  const source = demoRepo();
  const dates = execFileSync('git', ['log', '--format=%cs'], { cwd: source }).toString().trim().split('\n');
  const clone = join(mkdtempSync(join(tmpdir(), 'sprint-review-shallow-')), 'repo');
  execFileSync('git', ['clone', '-q', '--depth', '3', `file://${source}`, clone], { stdio: 'pipe' });
  const history = new History(clone);
  const cut = dates[2]!;
  const after = new Date(Date.parse(`${cut}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  assert.doesNotThrow(() => history.assertUsable({ kind: 'dates', from: after, until: dates[0]! }));
  assert.throws(() => history.assertUsable({ kind: 'dates', from: '2026-01-01', until: dates[0]! }), new RegExp(`starts on ${cut}.*git fetch --shallow-since=2025-12-25`));
  assert.throws(() => history.assertUsable(), /shallow history/);
  assert.throws(() => history.assertUsable({ kind: 'refs', from: 'v0.0.0-missing', to: 'HEAD' }), /not in this checkout's shallow history/);
  assert.doesNotThrow(() => new History(source).assertUsable({ kind: 'dates', from: '2000-01-01', until: dates[0]! }), 'a full history is always fine');
});
