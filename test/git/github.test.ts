import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { withPullRequests, githubRepo } from '../../src/git/github.ts';
import { History } from '../../src/git/history.ts';
import { commitLog } from '../../src/ai/prompt.ts';
import type { Commit } from '../../src/types.ts';
import { demoRepo } from '../helpers.ts';

function response(status: number, body: unknown): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const commit = (hash: string, product = true): Commit => ({ hash, date: '2026-11-10', subject: `change ${hash}`, body: '', files: [], product });

test('pull request titles and descriptions are added, the description once per PR', async () => {
  const calls: string[] = [];
  const fake = (async (url: string) => {
    calls.push(String(url));
    return response(200, [{ number: 42, title: 'Customer timeline', body: 'Front desk asked for one page.<!-- template -->', merged_at: '2026-11-10T10:00:00Z' }]);
  }) as unknown as typeof fetch;
  const { commits, found } = await withPullRequests([commit('aaaaaaa'), commit('bbbbbbb'), commit('ccccccc', false)], 'acme/spoke', 'token', fake);
  assert.equal(found, 1);
  assert.equal(calls.length, 2, 'commits without product code are not looked up');
  assert.equal(commits[0]!.pullRequest?.body, 'Front desk asked for one page.<!-- template -->');
  assert.equal(commits[1]!.pullRequest?.body, '');
  const log = commitLog(commits);
  assert.match(log, /Pull request: Customer timeline\nFront desk asked for one page\./);
  assert.doesNotMatch(log, /template/);
});

test('no access to the GitHub API leaves the commits as they were and stops asking', async () => {
  let n = 0;
  const fake = (async () => (n++, response(404, { message: 'Not Found' }))) as unknown as typeof fetch;
  const input = [commit('aaaaaaa'), commit('bbbbbbb')];
  const { commits, found } = await withPullRequests(input, 'acme/spoke', null, fake);
  assert.equal(found, 0);
  assert.equal(n, 1);
  assert.deepEqual(commits, input);
});

test('the GitHub repository comes from the config, GITHUB_REPOSITORY or the origin remote', () => {
  const dir = demoRepo();
  const history = new History(dir);
  assert.equal(githubRepo(history, 'a/b', {}), 'a/b');
  assert.equal(githubRepo(history, null, { GITHUB_REPOSITORY: 'c/d' }), 'c/d');
  assert.equal(githubRepo(history, null, {}), null);
  execFileSync('git', ['-C', dir, 'remote', 'add', 'origin', 'git@github.com:acme/spoke.git']);
  assert.equal(githubRepo(history, null, {}), 'acme/spoke');
});
