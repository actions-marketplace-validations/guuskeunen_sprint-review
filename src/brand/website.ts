import sharp from 'sharp';
import type { Brand } from './brand.ts';
import type { Config } from '../config.ts';

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 3_000_000;
const MAX_SHEETS = 5;
const MAX_PARSE = 500_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; sprint-review; +https://github.com/guuskeunen/sprint-review)';
const GENERIC_FONTS = /^(ui-[\w-]+|system-ui|-apple-system|BlinkMacSystemFont|sans-serif|serif|monospace|cursive|fantasy|inherit|initial|var\(.*)$/i;

/** brand.from is a website when it starts with http:// or https://. */
export function isWebsite(from: string | null): from is string {
  return !!from && /^https?:\/\//i.test(from);
}

const cache = new Map<string, Promise<Brand>>();

/**
 * The config with what it leaves out of the brand taken from the website in brand.from: color,
 * logo and fonts the config sets itself win. The site is read once per run; a config without a
 * website comes back unchanged.
 */
export async function withWebsiteBrand(config: Config, fetchImpl: typeof fetch = fetch): Promise<Config> {
  const from = config.brand.from;
  if (!isWebsite(from)) return config;
  if (!cache.has(from) || fetchImpl !== fetch) cache.set(from, brandFromWebsite(from, fetchImpl));
  const site = await cache.get(from)!;
  return {
    ...config,
    brand: {
      ...config.brand,
      from: null,
      color: config.brand.color ?? site.color,
      logo: config.brand.logo ?? site.logo,
      fonts: { heading: config.brand.fonts.heading ?? site.fonts.heading, body: config.brand.fonts.body ?? site.fonts.body },
    },
  };
}

/**
 * Takes the look of a website: its brand color from the stylesheet (a --brand or --primary
 * variable, or the theme-color), its heading and body fonts from --font-heading/--font-display
 * and --font-sans/--font-body, and its logo (a logo image or SVG on the page, else its largest
 * icon). Grays, white and black are passed over as brand colors.
 */
export async function brandFromWebsite(url: string, fetchImpl: typeof fetch = fetch): Promise<Brand> {
  const page = await get(url, fetchImpl);
  if (!page) throw new Error(`brand.from: could not read the website ${url}. Check the address, or set brand.color and brand.logo yourself.`);
  // Parse at most the first 500 KB: the brand is in the head and header, and hostile HTML can make
  // regular expressions slow (quadratic) on megabytes.
  const html = page.body.subarray(0, MAX_PARSE).toString('utf8');
  const base = page.url;
  const css = elements(html, 'style').map((e) => e.inner);
  for (const href of stylesheets(html, base).slice(0, MAX_SHEETS)) {
    const sheet = await get(href, fetchImpl);
    if (sheet) css.push(sheet.body.subarray(0, MAX_PARSE).toString('utf8'));
  }
  const styles = css.join('\n');
  return { color: brandColor(html, styles), fonts: { heading: font(styles, ['heading', 'display']), body: font(styles, ['body', 'sans']) }, logo: await logo(html, base, fetchImpl) };
}

// ---------------------------------------------------------------- color

function brandColor(html: string, css: string): string | null {
  const vars = (names: string[]) => names.flatMap((n) => matches(css, new RegExp(`--${n}\\s*:\\s*([^;}]+)`, 'gi')).map((m) => m[1] ?? ''));
  const themeColor = attr(tags(html, 'meta').find((t) => /name=["']?theme-color/i.test(t)) ?? '', 'content');
  const candidates = [...vars(['brand', 'brand-color', 'color-brand', 'brand-primary']), ...(themeColor ? [themeColor] : []), ...vars(['primary', 'color-primary', 'accent', 'color-accent', 'ring'])];
  for (const c of candidates) {
    const hex = toHex(c.trim());
    if (hex && colorful(hex)) return hex;
  }
  return null;
}

/** #rgb, #rrggbb, rgb(), hsl() and the bare "222 47% 11%" that shadcn themes use. */
export function toHex(value: string): string | null {
  const v = value.replace(/\s*!important$/i, '').trim();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (m) return `#${(m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join('') : m[1]!).toLowerCase()}`;
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(v);
  if (m) return hex(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(?:hsla?\(\s*)?(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i.exec(v);
  if (m) return hslHex(Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100);
  return null;
}

function hex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;
}

function hslHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return hex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/** Not a gray, not near white or black: a color a deck can use as its accent. */
function colorful(h: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  return s >= 0.15 && l > 0.05 && l < 0.92;
}

// ---------------------------------------------------------------- fonts

function font(css: string, names: string[]): string | null {
  for (const n of names) {
    for (const m of matches(css, new RegExp(`--font-${n}\\s*:\\s*([^;}]+)`, 'gi'))) {
      const family = (m[1] ?? '').split(',').map((f) => f.trim().replace(/^["']|["']$/g, '')).find((f) => f && !GENERIC_FONTS.test(f));
      if (family) return family;
    }
  }
  return null;
}

// ---------------------------------------------------------------- logo

async function logo(html: string, base: string, fetchImpl: typeof fetch): Promise<string | null> {
  const img = tags(html, 'img').find((t) => /logo/i.test(t));
  const src = img ? attr(img, 'src') : null;
  const candidates: string[] = src ? [src] : [];
  if (!src) {
    const svg = elements(html, 'svg').find((e) => /logo/i.test(e.open))?.whole;
    if (svg) return `data:image/svg+xml;base64,${Buffer.from(svg.includes('xmlns=') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')).toString('base64')}`;
  }
  const icons = tags(html, 'link')
    .filter((t) => /rel=["']?[^"'>]*icon/i.test(t))
    .map((t) => ({ href: attr(t, 'href'), size: Number(/sizes=["']?(\d+)/i.exec(t)?.[1] ?? 0) + (/apple-touch-icon/i.test(t) ? 1000 : 0) }))
    .filter((i): i is { href: string; size: number } => !!i.href)
    .sort((a, b) => b.size - a.size);
  candidates.push(...icons.map((i) => i.href), '/favicon.ico');
  for (const c of candidates) {
    const file = await get(absolute(c, base), fetchImpl);
    const uri = file ? await imageUri(file.body) : null;
    if (uri) return uri;
  }
  return null;
}

/** A data URI the deck and PowerPoint can both show: PNG, JPEG and SVG as they are, the rest as PNG. */
async function imageUri(data: Buffer): Promise<string | null> {
  if (data.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]))) {
    const png = icoPng(data);
    return png ? imageUri(png) : null;
  }
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return `data:image/png;base64,${data.toString('base64')}`;
  if (data[0] === 0xff && data[1] === 0xd8) return `data:image/jpeg;base64,${data.toString('base64')}`;
  const head = data.subarray(0, 300).toString('utf8');
  if (/<svg[\s>]/i.test(head) || (/^\s*<\?xml/.test(head) && data.toString('utf8').includes('<svg'))) return `data:image/svg+xml;base64,${data.toString('base64')}`;
  if (head.startsWith('GIF8') || (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP')) {
    try {
      return `data:image/png;base64,${(await sharp(data).png().toBuffer()).toString('base64')}`;
    } catch {
      return null;
    }
  }
  return null;
}

/** The largest PNG inside a .ico; icons with only bitmap images give nothing. */
function icoPng(ico: Buffer): Buffer | null {
  const count = ico.readUInt16LE(4);
  let best: { size: number; data: Buffer } | null = null;
  for (let i = 0; i < count && 6 + 16 * (i + 1) <= ico.length; i++) {
    const at = 6 + 16 * i;
    const width = ico[at] || 256;
    const length = ico.readUInt32LE(at + 8);
    const offset = ico.readUInt32LE(at + 12);
    const data = ico.subarray(offset, offset + length);
    if (data.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) && (!best || width > best.size)) best = { size: width, data };
  }
  return best?.data ?? null;
}

// ---------------------------------------------------------------- html and http

function stylesheets(html: string, base: string): string[] {
  return tags(html, 'link')
    .filter((t) => /rel=["']?stylesheet/i.test(t))
    .map((t) => attr(t, 'href'))
    .filter((h): h is string => !!h && !/fonts\.googleapis\.com/i.test(h))
    .map((h) => absolute(h, base));
}

/** The opening tags of an element, found with indexOf: linear, so hostile HTML can't stall it. */
function tags(html: string, name: string): string[] {
  const lower = html.toLowerCase();
  const out: string[] = [];
  for (let at = lower.indexOf(`<${name}`); at !== -1; at = lower.indexOf(`<${name}`, at + 1)) {
    if (/[a-z0-9-]/.test(lower[at + name.length + 1] ?? '')) continue;
    const end = lower.indexOf('>', at);
    if (end === -1) break;
    out.push(html.slice(at, end + 1));
  }
  return out;
}

/** Whole elements with their content (style, svg), in linear time; an unclosed one ends the search. */
function elements(html: string, name: string): { open: string; inner: string; whole: string }[] {
  const lower = html.toLowerCase();
  const out: { open: string; inner: string; whole: string }[] = [];
  let at = lower.indexOf(`<${name}`);
  while (at !== -1) {
    const openEnd = lower.indexOf('>', at);
    if (openEnd === -1) break;
    const close = lower.indexOf(`</${name}>`, openEnd);
    if (close === -1) break;
    if (!/[a-z0-9-]/.test(lower[at + name.length + 1] ?? '')) {
      out.push({ open: html.slice(at, openEnd + 1), inner: html.slice(openEnd + 1, close), whole: html.slice(at, close + name.length + 3) });
    }
    at = lower.indexOf(`<${name}`, close);
  }
  return out;
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '').replace(/&amp;/g, '&') : null;
}

function matches(text: string, re: RegExp): RegExpMatchArray[] {
  return [...text.matchAll(re)];
}

function absolute(href: string, base: string): string {
  return new URL(href, base).toString();
}

async function get(url: string, fetchImpl: typeof fetch): Promise<{ url: string; body: Buffer } | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetchImpl(url, { headers: { 'user-agent': USER_AGENT }, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok || !res.body) return null;
    // Read in chunks and stop at the limit: a hostile site could send gigabytes (or a gzip bomb).
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.length;
      if (size > MAX_BYTES) {
        await res.body.cancel().catch(() => {});
        return null;
      }
      chunks.push(Buffer.from(chunk));
    }
    return { url: res.url || url, body: Buffer.concat(chunks) };
  } catch {
    return null;
  }
}
