import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { brandFromWebsite, toHex, withWebsiteBrand } from '../../src/brand/website.ts';
import { normalize } from '../../src/config.ts';
import { resolvedBrand } from '../../src/review/generate.ts';

const png = await sharp({ create: { width: 8, height: 8, channels: 4, background: '#123456' } }).png().toBuffer();

/** A .ico with one PNG inside, as most sites serve their favicon today. */
function ico(image: Buffer): Buffer {
  const head = Buffer.alloc(22);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(1, 4);
  head.writeUInt32LE(image.length, 6 + 8);
  head.writeUInt32LE(22, 6 + 12);
  return Buffer.concat([head, image]);
}

function site(files: Record<string, string | Buffer>) {
  const asked: string[] = [];
  const impl = (async (url: string) => {
    asked.push(String(url));
    const body = files[new URL(String(url)).pathname];
    if (body === undefined) return new Response('not found', { status: 404 });
    return new Response(typeof body === 'string' ? body : new Uint8Array(body), { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, asked };
}

test('a website gives its brand color, fonts and favicon as the logo', async () => {
  const s = site({
    '/': '<html><head><meta name="theme-color" content="#ffffff"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter"><link rel="stylesheet" href="/assets/app.css"><link rel="icon" href="/favicon.ico"></head><body><a href="/"><span class="font-logo">acme</span></a></body></html>',
    '/assets/app.css': ':root{--primary:#171717;--font-sans:"Inter", system-ui, sans-serif;--font-display:"Space Grotesk", "Inter", sans-serif}.x{--accent:#0e2459}',
    '/favicon.ico': ico(png),
  });
  const brand = await brandFromWebsite('https://acme.test/', s.impl);
  assert.equal(brand.color, '#0e2459', 'white theme-color and gray primary are passed over');
  assert.deepEqual(brand.fonts, { heading: 'Space Grotesk', body: 'Inter' });
  assert.equal(brand.logo, `data:image/png;base64,${png.toString('base64')}`);
  assert.ok(!s.asked.some((u) => u.includes('fonts.googleapis.com')), 'font stylesheets are not fetched');
});

test('a logo image on the page wins over icons, and shadcn colors are read', async () => {
  const s = site({
    '/': '<html><head><style>:root{--primary: 221.2 83.2% 53.3%}</style><link rel="apple-touch-icon" href="/apple.png"></head><body><img class="h-8" src="/brand/logo.png" alt="Acme logo"></body></html>',
    '/brand/logo.png': png,
  });
  const brand = await brandFromWebsite('https://acme.test', s.impl);
  assert.equal(brand.color, '#2563eb');
  assert.ok(brand.logo?.startsWith('data:image/png;base64,'));
  assert.ok(!s.asked.some((u) => u.endsWith('/apple.png')));
});

test('an inline SVG marked as the logo is used as it is', async () => {
  const s = site({ '/': '<header><svg class="logo" viewBox="0 0 10 10"><circle r="4"/></svg></header>' });
  const brand = await brandFromWebsite('https://acme.test', s.impl);
  const svg = Buffer.from(brand.logo!.split(',')[1]!, 'base64').toString('utf8');
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" class="logo"/);
});

test('colors in every common notation become hex', () => {
  assert.equal(toHex('#AbC'), '#aabbcc');
  assert.equal(toHex('rgb(14, 36, 89)'), '#0e2459');
  assert.equal(toHex('hsl(0 100% 50%)'), '#ff0000');
  assert.equal(toHex('lab(15% 9 -35)'), null);
});

test('what the config sets itself wins over the website', async () => {
  const s = site({ '/': '<style>:root{--brand:#ea580c;--font-sans:Inter}</style>', '/favicon.ico': ico(png) });
  const config = normalize({ brand: { from: 'https://acme.test', color: '#4f46e5' } }, '/tmp');
  const branded = await withWebsiteBrand(config, s.impl);
  assert.equal(branded.brand.color, '#4f46e5');
  assert.equal(branded.brand.fonts.body, 'Inter');
  assert.ok(branded.brand.logo?.startsWith('data:image/png'));
  assert.equal(branded.brand.from, null);
  assert.equal(resolvedBrand(branded).color, '#4f46e5');
  assert.throws(() => resolvedBrand(config), /withWebsiteBrand/);
});

test('a website that cannot be read is a clear error', async () => {
  await assert.rejects(brandFromWebsite('https://down.test', site({}).impl), /could not read the website https:\/\/down.test/);
});

test('a hostile site can neither fill memory nor stall the parser', async () => {
  let pulled = 0;
  const huge = (async () => new Response(new ReadableStream({
    pull(c) { pulled += 1_000_000; c.enqueue(new Uint8Array(1_000_000)); if (pulled > 50_000_000) c.close(); },
  }))) as unknown as typeof fetch;
  await assert.rejects(brandFromWebsite('https://huge.test', huge), /could not read/);
  assert.ok(pulled <= 5_000_000, `stopped reading early (read ${pulled} bytes)`);

  const slow = site({ '/': '<svg logo'.repeat(330_000) });
  const t = Date.now();
  await brandFromWebsite('https://slow.test', slow.impl);
  assert.ok(Date.now() - t < 3000, `parsed in ${Date.now() - t} ms`);
});
