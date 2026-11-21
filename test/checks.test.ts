import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clean, parse } from '../src/writer.ts';
import { normalize } from '../src/config.ts';
import { commitType, touchesProduct, withoutTrailers } from '../src/history.ts';
import { parseFile } from '../src/screenshots.ts';
import type { Commit } from '../src/types.ts';

const config = normalize({ product: { name: 'Spoke' }, replace: { noot: 'notitie' } }, '/tmp');
const commits: Commit[] = [
  { hash: 'abc1234', date: '2026-11-04', subject: 'feat: timeline', body: '', files: ['src/a.ts'], product: true },
  { hash: 'def5678', date: '2026-11-05', subject: 'ci: cache', body: '', files: ['.github/x.yml'], product: false },
];

test('clean strips ticket numbers, PR numbers and hashes', () => {
  assert.equal(clean('Faster list (#42)', 10), 'Faster list');
  assert.equal(clean('Faster list SPOKE-81', 10), 'Faster list');
  assert.equal(clean('Fixed in abc1234f the overview', 10), 'Fixed in the overview');
});

test('clean rejects exclamation marks, emoji and long text', () => {
  assert.equal(clean('Great news!', 10), null);
  assert.equal(clean('Ship it 🚀', 10), null);
  assert.equal(clean('one two three four five', 4), null);
  assert.equal(clean('', 4), null);
});

test('clean turns long dashes into a comma and applies the team words with their case', () => {
  assert.equal(clean('Faster — and calmer', 10), 'Faster, and calmer');
  assert.equal(clean('Noot op de pagina, elke noot telt', 10, { noot: 'notitie' }), 'Notitie op de pagina, elke notitie telt');
});

test('parse drops points without a real commit and moves non-product points under the hood', () => {
  const w = parse(
    {
      themes: [
        {
          title: 'Timeline',
          icon: 'users',
          screen: 'none',
          value: 'quality',
          effect: 'One page.',
          points: [
            { text: 'One list', commits: ['abc1234'] },
            { text: 'Invented thing', commits: ['9999999'] },
            { text: 'CI is faster', commits: ['def5678'] },
          ],
          notes: 'Show it.',
        },
      ],
      summary: [{ text: 'One list', commits: ['abc1234'], icon: 'nope' }],
      under_the_hood: [],
    },
    commits,
    [],
    [],
    config,
  );
  assert.deepEqual(w.themes[0]?.points, ['One list']);
  assert.equal(w.summary[0]?.icon, 'other');
  assert.deepEqual(w.underTheHood, ['CI is faster']);
  assert.ok(w.checks.some((c) => c.kind === 'dropped' && c.text === 'Invented thing'));
  assert.ok(w.checks.some((c) => c.kind === 'moved' && c.text === 'CI is faster'));
});

test('parse keeps at most the configured number of themes and only screens that exist', () => {
  const theme = (title: string) => ({ title, icon: 'users', screen: 'Ghost (desktop)', value: 'faster', effect: 'x', points: [{ text: 'y', commits: ['abc1234'] }], notes: '' });
  const small = normalize({ limits: { themes: 2 } }, '/tmp');
  const w = parse({ themes: [theme('A'), theme('B'), theme('C')], summary: [], under_the_hood: [] }, commits, [], ['Real (desktop)'], small);
  assert.equal(w.themes.length, 2);
  assert.equal(w.themes[0]?.screen, null);
  assert.ok(w.checks.some((c) => c.text === 'Theme C'));
});

test('a short hash may come back a character longer or shorter', () => {
  const w = parse({ themes: [], summary: [{ text: 'One list', commits: ['abc12345'], icon: 'users' }], under_the_hood: [] }, commits, [], [], config);
  assert.equal(w.summary.length, 1);
});

test('product paths decide what counts as product work', () => {
  assert.equal(touchesProduct(['src/a.ts'], ['src/']), true);
  assert.equal(touchesProduct(['test/a.ts'], ['src/']), false);
  assert.equal(touchesProduct(['test/a.ts'], []), true);
  assert.equal(touchesProduct([], ['src/']), true);
});

test('trailers are removed from commit bodies', () => {
  assert.equal(withoutTrailers('Real text\n\nCo-Authored-By: A <a@b.c>\nSigned-off-by: B'), 'Real text');
});

test('screenshot file names give a key and a device', () => {
  assert.deepEqual(parseFile('e2e/x/customer-page-desktop.png'), { key: 'customer-page', device: 'desktop' });
  assert.deepEqual(parseFile('repairs-phone.png'), { key: 'repairs', device: 'phone' });
  assert.deepEqual(parseFile('dashboard-mobile-chromium-linux.png'), { key: 'dashboard', device: 'phone' });
  assert.deepEqual(parseFile('settings.png'), { key: 'settings', device: 'desktop' });
  assert.equal(parseFile('notes.txt'), null);
});

test('conventional commit types are read from the subject', () => {
  assert.equal(commitType('feat(customers)!: one timeline'), 'feat');
  assert.equal(commitType('chore(deps): bump vite'), 'chore');
  assert.equal(commitType('CI: cache'), 'ci');
  assert.equal(commitType('Add a timeline'), null);
});

test('themes and points the model sent as JSON text are read, not silently lost', () => {
  const theme = { title: 'Customer page', icon: 'users', screen: 'none', value: null, effect: 'One page for every customer.', points: [{ text: 'One list for all purchases', commits: ['abc12345'] }] };
  const w = parse({ themes: [JSON.stringify(theme)], summary: [], under_the_hood: [] }, commits, [], [], config);
  assert.equal(w.themes.length, 1);
  assert.equal(w.themes[0]!.title, 'Customer page');
});

test('the default room for an answer fits models that think first', () => {
  assert.equal(normalize({}, '/tmp').model.maxTokens, 16000);
});
