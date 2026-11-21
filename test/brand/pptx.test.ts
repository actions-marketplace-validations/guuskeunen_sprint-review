import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { renderDeck } from '../../src/deck/render.ts';
import { readZip } from '../../src/brand/zip.ts';
import { brandFromPptx } from '../../src/brand/brand.ts';
import { sample } from '../helpers.ts';

function zip(files: Record<string, string | Buffer>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const raw = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const data = deflateRawSync(raw);
    const n = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, n, data);
    centrals.push(central, n);
    offset += 30 + n.length + data.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

/** A tiny zip writer, just for the test: deflated entries. */


test('the brand is read from a presentation: accent color, fonts and the logo on the master', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brand-'));
  const file = join(dir, 'brand.pptx');
  writeFileSync(file, zip({
    'ppt/theme/theme1.xml': '<a:theme><a:clrScheme><a:accent1><a:srgbClr val="0B7A75"/></a:accent1></a:clrScheme><a:fontScheme><a:majorFont><a:latin typeface="Playfair Display"/></a:majorFont><a:minorFont><a:latin typeface="Inter"/></a:minorFont></a:fontScheme></a:theme>',
    'ppt/slideMasters/slideMaster1.xml': '<p:sldMaster><p:pic><a:blip r:embed="rId2"/><a:ext cx="100" cy="50"/></p:pic><p:pic><a:blip r:embed="rId3"/><a:ext cx="9000000" cy="5000000"/></p:pic></p:sldMaster>',
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': '<Relationships><Relationship Id="rId2" Target="../media/logo.png"/><Relationship Id="rId3" Target="../media/background.png"/></Relationships>',
    'ppt/media/logo.png': PNG,
    'ppt/media/background.png': Buffer.concat([PNG, Buffer.from('x')]),
  }));
  assert.equal(readZip(readFileSync(file)).size, 5);
  const brand = brandFromPptx(file);
  assert.equal(brand.color, '#0b7a75');
  assert.deepEqual(brand.fonts, { heading: 'Playfair Display', body: 'Inter' });
  assert.equal(brand.logo, `data:image/png;base64,${PNG.toString('base64')}`);

  const html = renderDeck(sample(), { color: brand.color, fonts: brand.fonts });
  assert.match(html, /--font-heading: "Playfair Display"/);
  assert.match(html, /--accent: #0b7a75/);
});

test('font names cannot break out of the style sheet', () => {
  const html = renderDeck(sample(), { fonts: { heading: 'X"; } body { display:none } /*' } });
  const rule = /html\[data-theme\] \{[^\n]*/.exec(html)?.[0] ?? '';
  assert.doesNotMatch(rule, /display:none|\/\*|\} body/);
  assert.match(html, /--font-heading: "X body displaynone"/);
});
