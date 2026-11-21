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
