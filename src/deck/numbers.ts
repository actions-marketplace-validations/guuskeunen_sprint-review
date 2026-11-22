import type { UsageMetric } from '../types.ts';

/**
 * The change against the sprint before, as the number slides show it: "+18%". good is whether it
 * went the way that is better for this number (up, unless better is down). Null when there is
 * nothing to compare with, or the earlier number was zero.
 */
export function change(u: UsageMetric, locale: string): { text: string; good: boolean } | null {
  const before = u.previous ?? u.history?.at(-1);
  if (before === undefined || before === 0) return null;
  const pct = ((u.value - before) / Math.abs(before)) * 100;
  const text = `${pct > 0 ? '+' : pct < 0 ? '−' : '±'}${new Intl.NumberFormat(locale, { maximumFractionDigits: Math.abs(pct) < 10 ? 1 : 0 }).format(Math.abs(pct))}%`;
  return { text, good: u.better === 'down' ? pct <= 0 : pct >= 0 };
}

/** The trend line's points in a 120 by 30 box: earlier sprints and this one, when there are three or more. */
export function trendPoints(u: UsageMetric): { x: number; y: number }[] | null {
  const series = [...(u.history ?? []), u.value];
  if (series.length < 3) return null;
  const min = Math.min(...series);
  const span = Math.max(...series) - min || 1;
  return series.map((v, i) => ({ x: Math.round((i / (series.length - 1)) * 114 + 3), y: Math.round(27 - ((v - min) / span) * 24) }));
}
