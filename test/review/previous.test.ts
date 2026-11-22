import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalize } from '../../src/config.ts';
import { renderDeck } from '../../src/deck/render.ts';
import { lastTime, previousReview } from '../../src/review/previous.ts';
import { validReview } from '../../src/review/review.ts';
import { sample } from '../helpers.ts';

function outputs(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sprint-review-prev-'));
  const write = (day: string, done: boolean[]) => {
    mkdirSync(join(dir, 'sprint-reviews', day), { recursive: true });
    const r = { ...sample(), until: day, milestones: ['Book online', 'Planner', 'Text message', 'Reorder parts', 'Loyalty'].map((text, i) => ({ text, done: done[i] ?? false })) };
    writeFileSync(join(dir, 'sprint-reviews', day, 'review.json'), JSON.stringify(r));
  };
  write('2026-10-19', [true]);
  write('2026-11-02', [true, true]);
  write('2026-11-16', [true, true, true, true]);
  return dir;
}

test('last sprint we said: the previous review\'s next milestones, and whether they are done now', () => {
  const dir = outputs();
  const config = normalize({}, dir);
  const prev = previousReview(config, '2026-11-16');
  assert.equal(prev?.until, '2026-11-02', 'the newest review before this one, not this one itself');
  const now = ['Book online', 'Planner', 'Text message', 'Reorder parts', 'Loyalty'].map((text, i) => ({ text, done: i < 3 }));
  const said = lastTime(prev, now)!;
  assert.deepEqual(said.items, [{ text: 'Text message', done: true }, { text: 'Reorder parts', done: false }, { text: 'Loyalty', done: false }]);
  assert.equal(lastTime(null, now), undefined);
  assert.equal(previousReview(normalize({}, mkdtempSync(join(tmpdir(), 'sr-empty-'))), '2026-11-16'), null);

  const html = renderDeck({ ...sample(), lastTime: said });
  assert.match(html, /1 of 3 things we said were next are done/);
  assert.ok(html.indexOf('data-ref="lastTime"') < html.indexOf('data-ref="theme-0"'), 'before the new work');
});

test('a theme with a clip plays it muted in a loop, its picture as the poster; anything but a video is refused', () => {
  const r = sample();
  r.themes[0]!.screen = { name: 'Planner', device: 'desktop', image: r.screens[1]!.after, video: 'data:video/mp4;base64,AAAA' };
  const html = renderDeck(r);
  assert.match(html, /<video src="data:video\/mp4;base64,AAAA" poster="data:image\/png;base64,[^"]+" muted loop playsinline/);
  assert.throws(() => validReview({ ...r, themes: [{ ...r.themes[0], screen: { ...r.themes[0]!.screen, video: 'javascript:alert(1)' } }] }), /video/);
  assert.throws(() => normalize({ screenshots: { source: 'folder', before: 'a', after: 'b', videos: { planner: 'clip.gif' } } }, '/tmp'), /mp4 or .webm/);
});
