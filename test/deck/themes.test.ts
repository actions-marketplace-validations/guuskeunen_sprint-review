import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, ConfigError } from '../../src/config.ts';
import { renderDeck } from '../../src/deck/render.ts';
import { sample } from '../helpers.ts';

test('the deck is light by default and dark on request', () => {
  assert.match(renderDeck(sample()), /data-theme="light"/);
  assert.doesNotMatch(renderDeck(sample()), /Iowan Old Style/);
  assert.match(renderDeck(sample(), { theme: 'dark' }), /data-theme="dark"[\s\S]*Iowan Old Style/);
  assert.equal(normalize({}, '/tmp').brand.theme, 'light');
  assert.throws(() => normalize({ brand: { theme: 'neon' } }, '/tmp'), ConfigError);
});
