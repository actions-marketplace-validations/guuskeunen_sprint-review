import sharp from 'sharp';
import type { Device, Focus } from '../types.ts';

/** How far one color channel may differ before a pixel counts as changed. */
const TOLERANCE = 40;
/** Every second pixel is compared, so this many changed ones is a visible change. */
const MIN_CHANGED_PIXELS = 40;
const FOCUS_HEIGHT = 560;
const FOCUS_MIN_WIDTH = 820;
const FOCUS_MARGIN = 28;

export interface Comparison {
  changed: boolean;
  /** The part to show: the same area of both pictures, or both whole for a phone. */
  before: Buffer;
  after: Buffer;
  /** The changed area on the pictures shown, when it is small enough to be worth pointing at. */
  focus?: Focus;
}

/** Past this share of the picture, a frame around the change points at nothing in particular. */
const MAX_FOCUS_AREA = 0.6;

/** Unchanged rows that end the band where a change starts. */
const GAP = 24;
/** The band never takes more than this share of the picture's height. */
const MAX_BAND = 0.4;

/**
 * The box around where the change starts, as fractions of the area shown, with a little room.
 * A new element pushes everything below it down, so every row under it differs too: the band
 * runs from the first changed row to the first gap of unchanged rows, which is usually the new
 * element itself.
 */
function focusIn(rows: Map<number, [number, number]>, area: { x: number; y: number; w: number; h: number }): Focus | undefined {
  const ys = [...rows.keys()].filter((y) => y >= area.y && y < area.y + area.h).sort((a, b) => a - b);
  if (!ys.length) return undefined;
  const y0 = ys[0]!;
  let y1 = y0;
  for (const y of ys) {
    if (y - y1 > GAP || y - y0 > area.h * MAX_BAND) break;
    y1 = y;
  }
  let x0 = Infinity, x1 = -Infinity;
  for (const y of ys) {
    if (y > y1) break;
    const [from, until] = rows.get(y)!;
    x0 = Math.min(x0, Math.max(from, area.x));
    x1 = Math.max(x1, Math.min(until, area.x + area.w - 1));
  }
  if (x0 > x1) return undefined;
  const pad = 14;
  const fx = Math.max(0, x0 - pad - area.x) / area.w;
  const fy = Math.max(0, y0 - pad - area.y) / area.h;
  const fw = Math.min(1 - fx, (x1 - x0 + 2 * pad) / area.w);
  const fh = Math.min(1 - fy, (y1 - y0 + 2 * pad) / area.h);
  if (fw * fh > MAX_FOCUS_AREA) return undefined;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return { x: r(fx), y: r(fy), w: r(fw), h: r(fh) };
}

export async function compareScreens(before: Buffer, after: Buffer, device: Device, ignore: { left: number; top: number }): Promise<Comparison | null> {
  const [a, b] = await Promise.all([decode(before), decode(after)]);
  if (!a || !b) return null;

  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const left = device === 'desktop' ? ignore.left : 0;
  const top = ignore.top;

  let changed = 0;
  let first: number | null = null;
  const rows = new Map<number, [number, number]>();
  for (let y = top; y < height; y += 2) {
    for (let x = left; x < width; x += 2) {
      const i = (y * a.width + x) * 4;
      const j = (y * b.width + x) * 4;
      if (
        Math.abs(a.data[i]! - b.data[j]!) > TOLERANCE ||
        Math.abs(a.data[i + 1]! - b.data[j + 1]!) > TOLERANCE ||
        Math.abs(a.data[i + 2]! - b.data[j + 2]!) > TOLERANCE
      ) {
        changed++;
        first ??= y;
        const row = rows.get(y);
        rows.set(y, row ? [Math.min(row[0], x), Math.max(row[1], x)] : [x, x]);
      }
    }
  }

  // A page that only grew or shrank below what both show did change, at its end.
  const grew = a.height !== b.height;
  if (changed < MIN_CHANGED_PIXELS && !grew) return { changed: false, before, after };
  if (device !== 'desktop' || changed < MIN_CHANGED_PIXELS || first === null) {
    const focus = changed >= MIN_CHANGED_PIXELS ? focusIn(rows, { x: 0, y: 0, w: b.width, h: b.height }) : undefined;
    return { changed: true, before, after, ...(focus ? { focus } : {}) };
  }

  const focusTop = Math.max(top, first - FOCUS_MARGIN);
  let from = width;
  let until = left;
  for (const [y, [rowFrom, rowUntil]] of rows) {
    if (y < focusTop + FOCUS_HEIGHT) {
      from = Math.min(from, rowFrom);
      until = Math.max(until, rowUntil);
    }
  }
  let x = Math.max(left, from - FOCUS_MARGIN);
  const focusWidth = Math.min(width - x, Math.max(FOCUS_MIN_WIDTH, until - x + FOCUS_MARGIN));
  if (x + focusWidth > width) x = Math.max(left, width - focusWidth);

  const [cropBefore, cropAfter] = await Promise.all([crop(before, a.height, x, focusTop, focusWidth), crop(after, b.height, x, focusTop, focusWidth)]);
  const shown = cropAfter ? { x, y: focusTop, w: focusWidth, h: Math.min(FOCUS_HEIGHT, b.height - focusTop) } : { x: 0, y: 0, w: b.width, h: b.height };
  const focus = focusIn(rows, shown);
  return { changed: true, before: cropBefore ?? before, after: cropAfter ?? after, ...(focus ? { focus } : {}) };
}

async function decode(png: Buffer): Promise<{ data: Buffer; width: number; height: number } | null> {
  try {
    const { data, info } = await sharp(png).removeAlpha().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    return null;
  }
}

async function crop(png: Buffer, imageHeight: number, x: number, top: number, width: number): Promise<Buffer | null> {
  const height = Math.min(FOCUS_HEIGHT, imageHeight - top);
  if (height <= 0 || width <= 0) return null;
  try {
    return await sharp(png).extract({ left: x, top, width, height }).png({ compressionLevel: 9 }).toBuffer();
  } catch {
    return null;
  }
}
