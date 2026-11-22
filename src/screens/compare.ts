import sharp from 'sharp';
import type { Device } from '../types.ts';

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
}

/**
 * Compares two screenshots pixel by pixel, skipping the parts every screen shares (a side menu
 * on the left, a top bar), so a new menu item doesn't count as a changed screen. On desktop it
 * also finds where the change starts, so the slide can show that part large.
 * Null when a picture can't be read: then nothing is known and the caller keeps both whole.
 */
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
  if (device !== 'desktop' || changed < MIN_CHANGED_PIXELS || first === null) return { changed: true, before, after };

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
  return { changed: true, before: cropBefore ?? before, after: cropAfter ?? after };
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
