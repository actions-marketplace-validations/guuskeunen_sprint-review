import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../../src/config.ts';
import { planDeck } from '../../src/deck/plan.ts';
import { validReview } from '../../src/review/review.ts';
import type { Review } from '../../src/types.ts';
import { sample } from '../helpers.ts';

const kinds = (r: Review, deck = normalize({}, '/tmp').deck) => planDeck(r, deck).map((s) => (s.kind === 'theme' ? `theme-${s.index}:${s.layout}${s.flip ? ':flip' : ''}` : s.kind));

test('the story: cover, headline, three theme slides, cards for the rest, then before and after, the rest and questions', () => {
  assert.deepEqual(kinds(sample()), ['cover', 'headline', 'theme-0:icon', 'theme-1:icon', 'theme-2:icon', 'cards', 'screen', 'screen', 'screen', 'hood', 'roadmap', 'usage', 'closing']);
});

test('density sets how many themes get a slide of their own; one theme left over gets its own slide too', () => {
  const brief = normalize({ deck: { density: 'brief' } }, '/tmp').deck;
  assert.deepEqual(planDeck(sample(), brief).filter((s) => s.kind === 'theme').length, 2);
  const r = sample();
  r.themes = r.themes.slice(0, 4);
  assert.ok(!kinds(r).includes('cards'), 'a shared slide with one card is never made');
  assert.equal(kinds(r).filter((k) => k.startsWith('theme-')).length, 4);
});

test('the same picture layout twice in a row is mirrored; a layout picked by hand wins', () => {
  const r = sample();
  const shot = { name: 'x', device: 'desktop' as const, image: r.screens[0]!.after };
  r.themes[0]!.screen = shot;
  r.themes[1]!.screen = shot;
  r.themes[2]!.screen = shot;
  r.themes[2]!.layout = 'full';
  r.themes[3]!.layout = 'card';
  assert.deepEqual(kinds(r).slice(2, 5), ['theme-0:split', 'theme-1:split:flip', 'theme-2:full']);
  const cards = planDeck(r).find((s) => s.kind === 'cards');
  assert.deepEqual(cards && cards.kind === 'cards' && cards.indexes, [3, 4]);
});

test('sections can be left out, and executives get the numbers first and no work they cannot see', () => {
  const off = normalize({ deck: { sections: { hood: false, roadmap: false, headline: false } } }, '/tmp').deck;
  const k = kinds(sample(), off);
  assert.ok(!k.includes('hood') && !k.includes('roadmap') && !k.includes('headline'));
  const exec = normalize({ audience: 'executives' }, '/tmp').deck;
  assert.deepEqual(kinds(sample(), exec).slice(0, 3), ['cover', 'headline', 'usage']);
  assert.ok(!kinds(sample(), exec).includes('hood'));
  assert.throws(() => normalize({ deck: { sections: { agenda: true } } }, '/tmp'), /not a section/);
  assert.throws(() => normalize({ deck: { density: 'huge' } }, '/tmp'), /brief, standard, detailed/);
});

test('the roadmap shows six milestones around where the team is', () => {
  const r = sample();
  r.milestones = Array.from({ length: 12 }, (_, i) => ({ text: `M${i}`, done: i < 8 }));
  const road = planDeck(r).find((s) => s.kind === 'roadmap');
  assert.deepEqual(road && road.kind === 'roadmap' && road.milestones.map((m) => m.text), ['M5', 'M6', 'M7', 'M8', 'M9', 'M10']);
});

test('a review from an older version still opens: the first summary point becomes the headline', () => {
  const { headline, questions, ...old } = sample();
  void headline;
  void questions;
  const v = validReview({ ...old, summary: [{ text: 'One page per customer', icon: 'users' }], underTheHood: ['Faster builds'] });
  assert.equal(v.headline, 'One page per customer');
  assert.deepEqual(v.questions, []);
  assert.deepEqual(v.underTheHood, [{ text: 'Faster builds', kind: 'maintenance' }]);
  assert.throws(() => validReview({ ...sample(), themes: [{ ...sample().themes[0], layout: 'diagonal' }] }), /layout/);
});

test('the audience sets the default density and has aliases; deck.density still wins', () => {
  assert.equal(normalize({ audience: 'executives' }, '/tmp').deck.density, 'brief');
  assert.equal(normalize({ audience: 'engineers' }, '/tmp').deck.density, 'detailed');
  assert.equal(normalize({ audience: 'Marketing' }, '/tmp').audience, normalize({ audience: 'business' }, '/tmp').audience);
  assert.equal(normalize({}, '/tmp').deck.density, 'standard');
  assert.equal(normalize({ audience: 'Our sales team' }, '/tmp').deck.density, 'standard', 'a description of your own keeps the default');
  assert.equal(normalize({ audience: 'executives', deck: { density: 'detailed' } }, '/tmp').deck.density, 'detailed');
});
