import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDeck } from '../../src/deck/render.ts';
import type { Review } from '../../src/types.ts';
import { sample } from '../helpers.ts';

/**
 * The design rules, measured in a real browser at 1920 x 1080 (docs/design.md): four text sizes,
 * nothing under 24 px, every slide inside its margins, theme titles of at most two lines, and
 * nothing cut off in a smaller window. Needs Chrome; skipped where there is none.
 */

/** The demo review with a picture on most themes, so every layout is measured: split, mirrored, full and phone. */
function everyLayout(): Review {
  const r = sample();
  const [cust, plan, phone] = r.screens;
  r.themes[0]!.screen = { name: cust!.name, device: 'desktop', image: cust!.after };
  r.themes[1]!.screen = { name: plan!.name, device: 'desktop', image: plan!.after };
  r.themes[2]!.screen = { name: cust!.name, device: 'desktop', image: cust!.before };
  r.themes[2]!.layout = 'full';
  r.themes[3]!.screen = { name: phone!.name, device: 'phone', image: phone!.after };
  r.themes[3]!.layout = 'split';
  return r;
}

async function chrome() {
  try {
    const { chromium } = await import('playwright-core');
    return await chromium.launch({ channel: 'chrome' });
  } catch {
    return null;
  }
}

interface Measured {
  ref: string;
  sizes: number[];
  minLeft: number;
  minTop: number;
  maxRight: number;
  maxBottom: number;
  titleLines: number | null;
}

async function measure(html: string, width: number, height: number): Promise<Measured[]> {
  const browser = await chrome();
  if (!browser) return [];
  try {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await page.setContent(html);
    const n = await page.evaluate(() => document.querySelectorAll('.slide').length);
    const out: Measured[] = [];
    for (let i = 1; i <= n; i++) {
      await page.evaluate((k) => (location.hash = `#${k}`), i);
      await page.waitForTimeout(50);
      out.push(
        await page.evaluate(() => {
          const slide = document.querySelector('.slide.active')!;
          // The product on the cover runs off the slide on purpose.
          const visible = (e: Element) => !e.closest('.notes, .rings, .product') && e.getBoundingClientRect().width > 0;
          const all = [...slide.querySelectorAll('*')].filter(visible);
          const text = all.filter((e) => [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent!.trim()));
          const boxes = all.filter((e) => e.children.length === 0).map((e) => e.getBoundingClientRect());
          const h2 = slide.querySelector('.head h2');
          return {
            ref: slide.getAttribute('data-ref') ?? '',
            sizes: [...new Set(text.map((e) => Math.round(parseFloat(getComputedStyle(e).fontSize))))],
            minLeft: Math.min(...boxes.map((b) => b.left)),
            minTop: Math.min(...boxes.map((b) => b.top)),
            maxRight: Math.max(...boxes.map((b) => b.right)),
            maxBottom: Math.max(...boxes.map((b) => b.bottom)),
            titleLines: h2 ? Math.round(h2.getBoundingClientRect().height / parseFloat(getComputedStyle(h2).lineHeight)) : null,
          };
        }),
      );
    }
    return out;
  } finally {
    await browser.close();
  }
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: four text sizes, nothing under 24 px, inside the margins, titles of two lines at most`, async (t) => {
    const slides = await measure(renderDeck(everyLayout(), { theme, color: '#0e2459' }), 1920, 1080);
    if (!slides.length) return t.skip('no Chrome to measure in');
    const sizes = new Set(slides.flatMap((s) => s.sizes));
    assert.ok(sizes.size <= 4, `text sizes in the deck: ${[...sizes].sort((a, b) => a - b).join(', ')}`);
    for (const s of slides) {
      assert.ok(Math.min(...s.sizes) >= 24, `${s.ref}: text of ${Math.min(...s.sizes)} px`);
      assert.ok(s.minLeft >= 96 && s.minTop >= 96, `${s.ref}: content at ${Math.round(s.minLeft)}, ${Math.round(s.minTop)}; the margin is 96 px`);
      assert.ok(s.maxRight <= 1920 - 96 && s.maxBottom <= 1080 - 60, `${s.ref}: content reaches ${Math.round(s.maxRight)}, ${Math.round(s.maxBottom)}`);
      if (s.ref.startsWith('theme-')) assert.ok(s.titleLines !== null && s.titleLines <= 2, `${s.ref}: title on ${s.titleLines} lines`);
    }
  });
}

test('nothing is cut off in a laptop window or on a phone', async (t) => {
  for (const [w, h] of [[1280, 720], [1440, 900], [390, 844]] as const) {
    const slides = await measure(renderDeck(everyLayout(), {}), w, h);
    if (!slides.length) return t.skip('no Chrome to measure in');
    for (const s of slides) assert.ok(s.maxRight <= w && s.maxBottom <= h, `${s.ref} at ${w}x${h}: content reaches ${Math.round(s.maxRight)}, ${Math.round(s.maxBottom)}`);
  }
});

test('a strip is scaled to fit its slide, never cropped', async (t) => {
  const sharp = (await import('sharp')).default;
  const r = everyLayout();
  r.themes[0]!.screen = { name: 'Ticket', device: 'desktop', image: `data:image/png;base64,${(await sharp({ create: { width: 1800, height: 750, channels: 3, background: '#eee' } }).png().toBuffer()).toString('base64')}` };
  r.themes[0]!.layout = 'auto';
  const browser = await chrome();
  if (!browser) return t.skip('no Chrome to measure in');
  try {
    for (const [w, h] of [[1920, 1080], [1600, 900], [1280, 720]] as const) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
      await page.setContent(renderDeck(r, {}));
      await page.evaluate(() => (location.hash = '#3'));
      await page.waitForTimeout(50);
      const box = await page.evaluate(() => {
        const img = document.querySelector('.slide.active.strip .screen img') as HTMLImageElement;
        const b = img.getBoundingClientRect();
        const points = document.querySelector('.slide.active.strip .points')!.getBoundingClientRect();
        return { ratio: b.width / b.height, bottom: b.bottom, pointsTop: points.top, pointsBottom: points.bottom };
      });
      assert.ok(Math.abs(box.ratio - 2.4) < 0.05, `${w}x${h}: shown at ${box.ratio.toFixed(2)}:1, not 2.4:1`);
      assert.ok(box.bottom <= box.pointsTop, `${w}x${h}: the picture runs into the points (${Math.round(box.bottom)} > ${Math.round(box.pointsTop)})`);
      assert.ok(box.pointsBottom <= h, `${w}x${h}: the points reach ${Math.round(box.pointsBottom)}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
