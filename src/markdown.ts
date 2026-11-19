import type { Review } from './types.ts';
import { fill, labelsFor } from './i18n.ts';

/** A short Markdown version of the review: for a pull request, Slack, an email or a changelog. */
export function renderMarkdown(review: Review, labels: Record<string, string> = {}): string {
  const t = labelsFor(review.language, labels);
  const out: string[] = [`# ${review.title}`, '', `_${review.period}${review.organization ? ` · ${review.organization}` : ''}_`, ''];
  if (review.summary.length) {
    out.push(`## ${t.summaryTitle}`, '', ...review.summary.map((p) => `- ${p.text}`), '');
  }
  for (const th of review.themes) {
    out.push(`## ${th.title}`, '');
    if (th.effect) out.push(th.effect, '');
    out.push(...th.points.map((p) => `- ${p}`), '');
  }
  if (review.screens.length) {
    out.push(`## ${t.screensLabel}`, '', ...review.screens.map((s) => `- **${s.name}**${s.caption ? `: ${s.caption}` : ''}`), '');
  }
  if (review.underTheHood.length) {
    out.push(`## ${t.hoodTitle}`, '', ...review.underTheHood.map((p) => `- ${p}`), '');
  }
  if (review.milestones.length) {
    const reached = review.milestones.filter((m) => m.done).length;
    out.push(`## ${t.roadmapTitle}`, '', fill(t.roadmapReached, { n: reached, total: review.milestones.length }), '', ...review.milestones.map((m) => `- [${m.done ? 'x' : ' '}] ${m.text}`), '');
  }
  return out.join('\n');
}

/** What the checks did, for the person who reads the draft. */
export function renderChecks(review: Review): string {
  if (!review.checks.length) return 'All checks passed. Nothing was corrected, moved or dropped.\n';
  const kinds: Record<string, string> = { warning: 'Look at', dropped: 'Dropped', moved: 'Moved under the hood', corrected: 'Corrected' };
  return review.checks.map((c) => `- **${kinds[c.kind] ?? c.kind}:** ${c.text} (${c.reason})`).join('\n') + '\n';
}
