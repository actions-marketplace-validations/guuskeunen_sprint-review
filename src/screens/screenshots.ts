import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import type { ScreenshotConfig } from '../config.ts';
import type { ChangedScreen, Device } from '../types.ts';
import type { History, Range } from '../git/history.ts';
import { compareScreens } from './compare.ts';

/** Reading more changed screens than get a slide: a menu change rewrites every picture, and the model picks the ones worth showing. */
const MAX_SCREENS = 16;

export interface ScreenLabels {
  phone: string;
  desktop: string;
}

export interface Screens {
  /** Screens whose picture changed between the start and the end, cropped to the change on desktop. */
  changed(): Promise<ChangedScreen[]>;
  /** Every picture at the end, by the label the model chooses from: "Customer page (desktop)". */
  available(): Map<string, { key: string; device: Device }>;
  /** A picture at the end. */
  picture(key: string, device: Device): Buffer | null;
  /** The readable name of a screen key. */
  name(key: string): string;
}

/** `customer-page-desktop.png`, `customer-page-phone.png`, and Playwright's `-chromium-linux` suffix. */
export function parseFile(file: string): { key: string; device: Device } | null {
  if (!file.toLowerCase().endsWith('.png')) return null;
  let stem = basename(file, '.png').replace(/-(chromium|firefox|webkit|chrome|msedge)(-(linux|darwin|win32))?$/i, '');
  let device: Device = 'desktop';
  const m = /-(desktop|phone|mobile)$/i.exec(stem);
  if (m) {
    device = m[1]!.toLowerCase() === 'desktop' ? 'desktop' : 'phone';
    stem = stem.slice(0, m.index);
  }
  return stem ? { key: stem, device } : null;
}

export function screens(config: ScreenshotConfig, root: string, history: History, range: Range, labels: ScreenLabels): Screens {
  if (config.source === 'none') {
    return { changed: async () => [], available: () => new Map(), picture: () => null, name: (k) => humanize(k) };
  }
  const names = config.names;
  const name = (key: string) => names[key] ?? humanize(key);
  const order = Object.keys(names);
  const sortKey = (key: string) => {
    const i = order.indexOf(key);
    return i === -1 ? order.length : i;
  };
  const label = (key: string, device: Device) => (device === 'phone' ? `${name(key)} (${labels.phone})` : name(key));

  // Where each picture lives: by "key|device", the path at the start and at the end.
  let startPics: Map<string, () => Buffer | null>;
  let endPics: Map<string, () => Buffer | null>;
  let firstInRange: (id: string) => Buffer | null = () => null;
  let changedIds: string[];

  if (config.source === 'git') {
    const { start, end } = history.ends(range);
    const index = (rev: string | null) => {
      const map = new Map<string, () => Buffer | null>();
      if (!rev) return map;
      for (const path of history.listFiles(rev, config.dir)) {
        const p = parseFile(path);
        if (p) map.set(`${p.key}|${p.device}`, () => history.show(rev, path));
      }
      return map;
    };
    startPics = index(start);
    endPics = index(end);
    const pathOf = new Map<string, string>();
    changedIds = [];
    for (const path of history.changedPaths(range, config.dir)) {
      const p = parseFile(path);
      if (!p) continue;
      const id = `${p.key}|${p.device}`;
      pathOf.set(id, path);
      if (!changedIds.includes(id)) changedIds.push(id);
    }
    firstInRange = (id) => (pathOf.has(id) ? history.oldestInRange(range, pathOf.get(id)!) : null);
  } else if (config.source === 'capture') {
    // One folder per day of pictures: the last one before the sprint started, and the last one by its end.
    const base = resolve(root, config.capture.dir);
    const { from, until } = rangeDays(range, history);
    const days = existsSync(base) ? readdirSync(base).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort() : [];
    const beforeDay = [...days].reverse().find((d) => d < from) ?? null;
    const afterDay = [...days].reverse().find((d) => d <= until && d !== beforeDay) ?? null;
    startPics = beforeDay ? folderPics(join(base, beforeDay)) : new Map();
    endPics = afterDay ? folderPics(join(base, afterDay)) : new Map();
    changedIds = [...endPics.keys()].filter((id) => startPics.has(id));
  } else {
    const folder = (dir: string) => {
      const abs = resolve(root, dir);
      const map = new Map<string, () => Buffer | null>();
      if (!existsSync(abs)) return map;
      for (const file of readdirSync(abs)) {
        const p = parseFile(file);
        if (p) map.set(`${p.key}|${p.device}`, () => readFileSync(join(abs, file)));
      }
      return map;
    };
    startPics = folder(config.before);
    endPics = folder(config.after);
    changedIds = [...endPics.keys()].filter((id) => startPics.has(id));
  }

  const byScreenOrder = (ids: string[]) =>
    [...ids].sort((x, y) => {
      const [kx = ''] = x.split('|');
      const [ky = ''] = y.split('|');
      return sortKey(kx) - sortKey(ky) || x.localeCompare(y);
    });

  return {
    name,
    async changed() {
      const out: ChangedScreen[] = [];
      for (const id of byScreenOrder(changedIds)) {
        const [key = '', dev = 'desktop'] = id.split('|');
        const device = dev as Device;
        // A picture without an earlier version may be a new screen, or a screen that only got its first picture now: no slide.
        const before = startPics.get(id)?.() ?? firstInRange(id);
        const after = endPics.get(id)?.();
        if (!before || !after || before.equals(after)) continue;
        const cmp = await compareScreens(before, after, device, config.ignore);
        if (cmp && !cmp.changed) continue;
        out.push({ name: label(key, device), key, device, before: cmp?.before ?? before, after: cmp?.after ?? after });
        if (out.length === MAX_SCREENS) break;
      }
      return out;
    },
    available() {
      const map = new Map<string, { key: string; device: Device }>();
      for (const id of byScreenOrder([...endPics.keys()])) {
        const [key = '', dev = 'desktop'] = id.split('|');
        const device = dev as Device;
        map.set(device === 'phone' ? label(key, device) : `${name(key)} (${labels.desktop})`, { key, device });
      }
      return map;
    },
    picture(key, device) {
      return endPics.get(`${key}|${device}`)?.() ?? null;
    },
  };
}

function folderPics(abs: string): Map<string, () => Buffer | null> {
  const map = new Map<string, () => Buffer | null>();
  if (!existsSync(abs)) return map;
  for (const file of readdirSync(abs)) {
    const p = parseFile(file);
    if (p) map.set(`${p.key}|${p.device}`, () => readFileSync(join(abs, file)));
  }
  return map;
}

/** The first and last day of a range; for refs, the dates of the commits at both ends. */
export function rangeDays(range: Range, history: History): { from: string; until: string } {
  if (range.kind === 'dates') return { from: range.from, until: range.until };
  const { start, end } = history.ends(range);
  const day = (rev: string | null) => (rev ? history.git(['show', '-s', '--format=%cs', rev], true).trim() : '');
  const today = new Date().toISOString().slice(0, 10);
  return { from: day(start) || today, until: day(end) || today };
}

export function humanize(key: string): string {
  const words = key.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
