import type { Review } from './types.ts';
import { fill, labelsFor, localeOf, type Labels } from './i18n.ts';
import sharp from 'sharp';
// Types only: erased from the build, so pptxgenjs stays an optional peer.
type PptxClass = (typeof import('pptxgenjs'))['default'];
type Slide = ReturnType<InstanceType<PptxClass>['addSlide']>;
import { VALUE_KEYS } from './icons.ts';
import { readableOn } from './colors.ts';

export class PptxError extends Error {}

export interface PptxOptions {
  color?: string | null;
  logo?: string | null;
  labels?: Record<string, string>;
  goal?: string | null;
  theme?: 'dark' | 'light';
  fonts?: { heading?: string | null; body?: string | null };
}

/** Width and height of a PNG or JPEG data URI, so pictures keep their shape. */
function imageSize(uri: string): { w: number; h: number } | null {
  const b = Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64');
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  for (let i = 2; i < b.length - 9; ) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1]!;
    if (marker >= 0xc0 && marker <= 0xc3) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

/** Place a picture inside a box: whole and centered (fit), or filling it from the top (cover). */
function place(uri: string, box: { x: number; y: number; w: number; h: number }, mode: 'fit' | 'cover') {
  const size = imageSize(uri);
  if (!size) return { data: uri, ...box };
  const ratio = size.w / size.h;
  if (mode === 'cover') {
    const h = Math.min(box.h, box.w / ratio);
    return { data: uri, x: box.x, y: box.y, w: box.w, h: box.w / ratio, sizing: { type: 'crop' as const, x: 0, y: 0, w: box.w, h } };
  }
  const w = Math.min(box.w, box.h * ratio);
  const h = w / ratio;
  return { data: uri, x: box.x + (box.w - w) / 2, y: box.y, w, h };
}

const PALETTES = {
  dark: { bg: '0A0A0D', ink: 'F4EFE6', soft: 'B8B1A4', faint: '7D776D', panel: '15151A', line: '2A2A30', accent: 'D6B36A' },
  light: { bg: 'FFFFFF', ink: '0F172A', soft: '475569', faint: '94A3B8', panel: 'F8FAFC', line: 'E2E8F0', accent: '4F46E5' },
};

/**
 * The same review as an editable PowerPoint file, for teams that present from PowerPoint or
 * Keynote or want to add a slide by hand. Speaker notes go into the notes pane. Simpler than the
 * HTML deck (no motion), but every word and picture is there.
 */
export async function renderPptx(review: Review, options: PptxOptions = {}): Promise<Buffer> {
  let PptxGenJS: PptxClass;
  try {
    PptxGenJS = ((await import('pptxgenjs' as string)) as { default: PptxClass }).default;
  } catch {
    throw new PptxError('PowerPoint export needs pptxgenjs: npm install --save-dev pptxgenjs');
  }
  const t = labelsFor(review.language, options.labels);
  const pal = { ...PALETTES[options.theme === 'dark' ? 'dark' : 'light'] };
  if (options.color && /^#[0-9a-fA-F]{6}$/.test(options.color)) pal.accent = readableOn(options.color, `#${pal.bg}`).slice(1).toUpperCase();
  const heading = options.fonts?.heading ?? (options.theme === 'dark' ? 'Georgia' : 'Calibri');
  const body = options.fonts?.body ?? 'Calibri';
  const nf = new Intl.NumberFormat(localeOf(review.language));

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in
  pptx.title = review.title;
  if (review.organization) pptx.company = review.organization;
  pptx.theme = { headFontFace: heading, bodyFontFace: body };

  const W = 13.33;
  const X = 0.9;
  const newSlide = (notes?: string | null) => {
    const s = pptx.addSlide();
    s.background = { color: pal.bg };
    if (notes) s.addNotes(notes);
    return s;
  };
  const label = (s: Slide, text: string, y = 0.9) =>
    s.addText(text.toUpperCase(), { x: X, y, w: W - 2 * X, h: 0.35, fontFace: body, fontSize: 11, bold: true, color: pal.accent, charSpacing: 4 });
  const title = (s: Slide, text: string, y = 1.25, size = 34) => s.addText(text, { x: X, y, w: W - 2 * X, h: 0.9, fontFace: heading, fontSize: size, color: pal.ink });
  const bullets = (s: Slide, items: string[], x: number, y: number, w: number, size = 18) =>
    items.length &&
    s.addText(
      items.map((text) => ({ text, options: { bullet: { code: '2713' }, paraSpaceAfter: 8 } })),
      { x, y, w, h: Math.min(4.6, 0.55 * items.length + 0.4), fontFace: body, fontSize: size, color: pal.soft, valign: 'top' },
    );

  // Cover
  {
    const s = newSlide();
    if (options.logo) s.addImage({ data: options.logo, x: X, y: 0.6, ...(await logoBox(options.logo, 2.2, 0.7)) });
    label(s, `${t.sprintReview}${review.organization ? ` ${review.organization}` : ''}`, 2.1);
    s.addText(review.title, { x: X, y: 2.5, w: W - 2 * X, h: 1.9, fontFace: heading, fontSize: 44, color: pal.ink, valign: 'top', fit: 'shrink' });
    s.addText(review.period, { x: X, y: 4.5, w: W - 2 * X, h: 0.5, fontFace: body, fontSize: 18, color: pal.soft });
    if (options.goal) s.addText(`${t.goalLabel.toUpperCase()}   ${options.goal}`, { x: X, y: 5.3, w: 8, h: 0.5, fontFace: body, fontSize: 14, color: pal.ink, fill: { color: pal.panel }, line: { color: pal.line } });
  }

  // What it brings
  const values = VALUE_KEYS.map((key) => ({ key, themes: review.themes.filter((th) => th.value === key).map((th) => th.title) })).filter((v) => v.themes.length);
  if (values.length) {
    const s = newSlide();
    label(s, t.valuesLabel);
    title(s, review.organization ? fill(t.valuesTitle, { org: review.organization }) : t.valuesTitleNoOrg);
    const w = (W - 2 * X - 0.3 * (values.length - 1)) / values.length;
    values.forEach((v, i) => {
      const x = X + i * (w + 0.3);
      s.addShape('roundRect', { x, y: 2.6, w, h: 3.2, fill: { color: pal.panel }, line: { color: pal.line }, rectRadius: 0.15 });
      s.addText(t[`value_${v.key}` as keyof Labels], { x: x + 0.25, y: 2.8, w: w - 0.5, h: 0.5, fontFace: heading, fontSize: 20, color: pal.accent });
      s.addText(v.themes.join('\n'), { x: x + 0.25, y: 3.4, w: w - 0.5, h: 2.2, fontFace: body, fontSize: 14, color: pal.soft, valign: 'top' });
    });
  }

  // Usage
  const tiles = review.usage.filter((u) => u.value > 0);
  if (tiles.length) {
    const s = newSlide();
    label(s, t.usageLabel);
    title(s, fill(t.usageTitle, { product: review.product }));
    const w = (W - 2 * X - 0.3 * (tiles.length - 1)) / tiles.length;
    tiles.forEach((u, i) => {
      const x = X + i * (w + 0.3);
      s.addShape('roundRect', { x, y: 2.6, w, h: 2.4, fill: { color: pal.panel }, line: { color: pal.line }, rectRadius: 0.15 });
      s.addText(nf.format(u.value), { x: x + 0.25, y: 2.8, w: w - 0.5, h: 1, fontFace: heading, fontSize: 44, color: pal.accent });
      s.addText(u.label, { x: x + 0.25, y: 3.8, w: w - 0.5, h: 0.5, fontFace: body, fontSize: 16, color: pal.ink });
      if (u.previous) s.addText(`${t.previous}: ${nf.format(u.previous)}`, { x: x + 0.25, y: 4.3, w: w - 0.5, h: 0.4, fontFace: body, fontSize: 12, color: pal.faint });
    });
  }

  // In short
  if (review.summary.length) {
    const s = newSlide(review.summaryNotes);
    label(s, t.summaryLabel);
    title(s, t.summaryTitle);
    const n = review.summary.length;
    const w = (W - 2 * X - 0.3 * (n - 1)) / n;
    review.summary.forEach((p, i) => {
      const x = X + i * (w + 0.3);
      s.addShape('roundRect', { x, y: 2.6, w, h: 2.6, fill: { color: pal.panel }, line: { color: pal.line }, rectRadius: 0.15 });
      s.addText(p.text, { x: x + 0.3, y: 2.8, w: w - 0.6, h: 2.2, fontFace: body, fontSize: 18, color: pal.ink, valign: 'top' });
    });
  }

  // Themes
  review.themes.forEach((th, i) => {
    const s = newSlide(th.notes);
    const pic = th.screen;
    const textW = pic ? (pic.device === 'phone' ? 8 : 5.3) : W - 2 * X;
    label(s, fill(t.themeCount, { n: i + 1, total: review.themes.length }), 1.2);
    s.addText(th.title, { x: X, y: 1.6, w: textW, h: 0.9, fontFace: heading, fontSize: 34, color: pal.ink });
    if (th.effect) s.addText(th.effect, { x: X, y: 2.6, w: textW, h: 1.1, fontFace: body, fontSize: 20, color: pal.ink, valign: 'top' });
    bullets(s, th.points, X, 3.8, textW, 16);
    if (pic) {
      const x = X + textW + 0.4;
      const w = W - x - X;
      s.addImage(place(pic.image, { x, y: 1, w, h: 5.6 }, pic.device === 'phone' ? 'fit' : 'cover'));
    }
  });

  // Before and after
  for (const sc of review.screens) {
    const s = newSlide();
    label(s, t.screensLabel);
    title(s, sc.name);
    if (sc.caption) s.addText(sc.caption, { x: X, y: 2.1, w: W - 2 * X, h: 0.6, fontFace: body, fontSize: 18, color: pal.soft });
    const w = (W - 2 * X - 0.4) / 2;
    const h = 4.0;
    for (const [i, side] of (['before', 'after'] as const).entries()) {
      const x = X + i * (w + 0.4);
      s.addText((side === 'before' ? t.before : t.after).toUpperCase(), { x, y: 2.8, w, h: 0.3, fontFace: body, fontSize: 11, bold: true, color: side === 'after' ? pal.accent : pal.faint, charSpacing: 3 });
      s.addImage(place(sc[side], { x, y: 3.15, w, h }, sc.device === 'phone' ? 'fit' : 'cover'));
    }
  }

  // Milestones
  if (review.milestones.length) {
    const s = newSlide();
    const reached = review.milestones.filter((m) => m.done).length;
    label(s, t.roadmapLabel);
    title(s, t.roadmapTitle);
    s.addText(fill(t.roadmapReached, { n: reached, total: review.milestones.length }), { x: X, y: 2.1, w: 6, h: 0.4, fontFace: body, fontSize: 16, color: pal.soft });
    s.addText(
      review.milestones.map((m) => ({ text: `${m.done ? '●' : '○'}  ${m.text}`, options: { color: m.done ? pal.ink : pal.faint, paraSpaceAfter: 6, breakLine: true } })),
      { x: X, y: 2.7, w: W - 2 * X, h: 4, fontFace: body, fontSize: 18, valign: 'top' },
    );
  }

  // Under the hood
  if (review.underTheHood.length) {
    const s = newSlide();
    label(s, t.hoodLabel);
    title(s, t.hoodTitle);
    bullets(s, review.underTheHood, X, 2.4, W - 2 * X);
  }

  // Questions
  {
    const s = newSlide();
    s.addText(t.questions, { x: X, y: 2.8, w: W - 2 * X, h: 1.2, fontFace: heading, fontSize: 54, color: pal.ink });
    s.addText(review.title, { x: X, y: 4, w: W - 2 * X, h: 0.5, fontFace: body, fontSize: 18, color: pal.soft });
  }

  const out = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer | Uint8Array;
  return Buffer.from(out);
}

/** The logo's size within a box, in its own proportions: a square icon stays square. */
async function logoBox(dataUri: string, maxW: number, maxH: number): Promise<{ w: number; h: number }> {
  let ratio = maxW / maxH;
  try {
    const { width, height } = await sharp(Buffer.from(dataUri.slice(dataUri.indexOf(',') + 1), 'base64')).metadata();
    if (width && height) ratio = width / height;
  } catch {}
  return ratio > maxW / maxH ? { w: maxW, h: maxW / ratio } : { w: maxH * ratio, h: maxH };
}
