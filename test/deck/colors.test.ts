import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sample } from '../helpers.ts';
import { contrast, readableOn } from '../../src/deck/colors.ts';
import { renderDeck } from '../../src/deck/render.ts';

test('a brand color is shifted just enough to read on the background, and left alone when it already does', () => {
  assert.equal(readableOn('#0e2459', '#ffffff'), '#0e2459', 'navy on white already reads');
  const yellowOnWhite = readableOn('#ffd400', '#ffffff');
  assert.ok(contrast(yellowOnWhite, '#ffffff') >= 3, yellowOnWhite);
  const navyOnBlack = readableOn('#0e2459', '#0a0a0d');
  assert.ok(contrast(navyOnBlack, '#0a0a0d') >= 3, navyOnBlack);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(navyOnBlack.slice(i, i + 2), 16));
  assert.ok(b! > r! && b! > g!, `still blue: ${navyOnBlack}`);
});

test('the deck uses the readable accent in both themes', () => {
  const light = renderDeck(sample(), { color: '#ffd400' });
  const accent = /:root \{ --accent: (#[0-9a-f]{6});/.exec(light)![1]!;
  assert.ok(contrast(accent, '#ffffff') >= 3);
  const dark = renderDeck(sample(), { color: '#0e2459', theme: 'dark' });
  const darkAccent = /html\[data-theme="dark"\] \{ --accent: (#[0-9a-f]{6});/.exec(dark)![1]!;
  assert.ok(contrast(darkAccent, '#0a0a0d') >= 3);
});

test('German, French and Spanish decks have their own labels, and any other language falls back to English', async () => {
  const { labelsFor } = await import('../../src/deck/i18n.ts');
  assert.equal(labelsFor('German').hoodTitle, 'Unter der Haube');
  assert.equal(labelsFor('fr-BE').questions, 'Questions');
  assert.equal(labelsFor('Spanish').summaryTitle, 'Este sprint');
  assert.equal(labelsFor('Swedish').hoodTitle, 'Under the hood');
  const html = renderDeck({ ...sample(), language: 'German' }, {});
  assert.match(html, /Unter der Haube/);
  assert.doesNotMatch(html, /Under the hood/);
});
