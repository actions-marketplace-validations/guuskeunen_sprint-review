import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('an unknown option is a short message with a pointer to --help, not a stack trace', () => {
  const cli = new URL('../src/cli.ts', import.meta.url).pathname;
  let out = '';
  try {
    execFileSync('node', [cli, '--sinse', '2026-06-01'], { stdio: 'pipe' });
  } catch (e) {
    out = String((e as { stderr: Buffer }).stderr);
  }
  assert.match(out, /Unknown option '--sinse'/);
  assert.match(out, /sprint-review --help/);
  assert.doesNotMatch(out, /\n\s+at /);
});
