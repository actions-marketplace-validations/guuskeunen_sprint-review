import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../../src/config.ts';
import { doctorChecks } from '../../src/surfaces/doctor.ts';
import { demoRepo } from '../helpers.ts';

test('doctor counts playwright-core with the installed Chrome as Playwright, as capture does', async () => {
  const dir = demoRepo();
  const lines = await doctorChecks(normalize({ screenshots: { source: 'capture', pages: { app: '/' } } }, dir), dir, {});
  const line = lines.find((l) => /Playwright is installed/.test(l.text));
  assert.ok(line?.ok, `doctor says: ${line?.text} ${line?.fix ?? ''}`);
  assert.match(line.text, /playwright-core, with your Chrome/);
});
