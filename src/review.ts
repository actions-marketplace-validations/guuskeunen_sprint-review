import type { Review } from './types.ts';
import { IMAGE_DATA_URI } from './render.ts';

/** Enough of a check that a broken edit can't produce a broken deck. */
export function validReview(v: unknown): Review {
  const r = v as Review;
  const strings = (a: unknown) => Array.isArray(a) && a.every((x) => typeof x === 'string');
  if (!r || r.version !== 1) throw new Error('Not a review made by sprint-review.');
  if (typeof r.title !== 'string' || typeof r.period !== 'string') throw new Error('The review needs a title and a period.');
  if (!Array.isArray(r.summary) || !r.summary.every((p) => typeof p?.text === 'string')) throw new Error('Every summary point needs text.');
  if (!Array.isArray(r.themes) || !r.themes.every((t) => typeof t?.title === 'string' && strings(t.points))) throw new Error('Every theme needs a title and a list of points.');
  if (!strings(r.underTheHood)) throw new Error('Under the hood must be a list of lines.');
  for (const k of ['screens', 'milestones', 'usage', 'checks'] as const) if (!Array.isArray(r[k])) throw new Error(`${k} must be a list.`);
  const text = (v: unknown) => v === null || v === undefined || typeof v === 'string';
  for (const t of r.themes) {
    for (const k of ['effect', 'notes', 'icon', 'value'] as const) if (!text(t[k])) throw new Error(`The ${k} of theme "${t.title}" must be text.`);
    if (t.screen && !IMAGE_DATA_URI.test(String(t.screen.image))) throw new Error(`The picture of theme "${t.title}" must be an image (a data:image URI).`);
  }
  for (const s of r.screens) if (!IMAGE_DATA_URI.test(String(s?.before)) || !IMAGE_DATA_URI.test(String(s?.after))) throw new Error(`The before and after picture of "${s?.name}" must be images (data:image URIs).`);
  return {
    ...r,
    summary: r.summary.filter((p) => p.text.trim()),
    themes: r.themes.map((t) => ({ ...t, points: t.points.filter((p) => p.trim()) })),
    underTheHood: r.underTheHood.filter((p) => p.trim()),
  };
}
