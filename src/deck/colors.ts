/** WCAG contrast between two #rrggbb colors: 1 (none) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The brand color, darkened on a light background or lightened on a dark one just until it reads
 * (3:1, WCAG's bar for large text, icons and fills, which is most of what the accent colors). A
 * color that already reads comes back unchanged, so a brand's own orange stays exactly its
 * orange; a pale yellow turns ochre on white, a navy turns sky blue on black.
 */
export function readableOn(color: string, background: string, min = 3): string {
  if (contrast(color, background) >= min) return color.toLowerCase();
  const toward = luminance(background) > 0.5 ? '#000000' : '#ffffff';
  for (let step = 1; step <= 20; step++) {
    const mixed = mix(color, toward, step / 20);
    if (contrast(mixed, background) >= min) return mixed;
  }
  return toward;
}

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function mix(a: string, b: string, t: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i]! - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/** The deck's colors, all from one brand color. */
export interface Palette {
  accent: string;
  accentDeep: string;
  accentSoft: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  line: string;
  surfaceSoft: string;
}

const BASE = {
  light: { bg: '#ffffff', ink: '#0b1020', soft: '#475569', faint: '#8a94a6', line: '#e2e8f0' },
  dark: { bg: '#0a0a0d', ink: '#f4efe6', soft: '#b8b1a4', faint: '#8a8478', line: '#26262c' },
};

/**
 * A full palette from the brand color, the way design systems derive one from a seed (Radix,
 * Material): the neutrals take a little of the brand's hue, so grays and lines look like they
 * belong to it, and every color is measured against the background instead of trusted: body
 * text at least 4.5:1, labels and the accent at least 3:1 (WCAG; labels are 24 px and up).
 */
export function palette(color: string, theme: 'light' | 'dark'): Palette {
  const b = BASE[theme];
  const accent = readableOn(color, b.bg);
  return {
    accent,
    accentDeep: mix(accent, theme === 'light' ? b.ink : '#000000', theme === 'light' ? 0.3 : 0.35),
    accentSoft: mix(color, b.bg, theme === 'light' ? 0.91 : 0.88),
    ink: readableOn(mix(b.ink, color, 0.06), b.bg, 12),
    inkSoft: readableOn(mix(b.soft, color, 0.1), b.bg, 4.5),
    inkFaint: readableOn(mix(b.faint, color, 0.1), b.bg, 3),
    line: mix(b.line, color, theme === 'light' ? 0.1 : 0.08),
    surfaceSoft: mix(b.bg, color, theme === 'light' ? 0.03 : 0.04),
  };
}
