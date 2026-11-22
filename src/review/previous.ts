import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Config } from '../config.ts';
import type { Milestone, Review } from '../types.ts';
import { validReview } from './review.ts';

/** What the previous review said was next: its first open milestones. */
const PROMISES = 3;

/** The review before this one: the newest dated folder in the output folder that ends before `until`. */
export function previousReview(config: Config, until: string): Review | null {
  const base = resolve(config.root, config.output.dir);
  if (!existsSync(base)) return null;
  const days = readdirSync(base).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d < until).sort().reverse();
  for (const day of days) {
    const file = join(base, day, 'review.json');
    if (!existsSync(file)) continue;
    try {
      return validReview(JSON.parse(readFileSync(file, 'utf8')));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * "Last sprint we said": the milestones the previous review showed as next, and whether the
 * roadmap marks them done now. Only from the team's own roadmap, never from the model.
 */
export function lastTime(previous: Review | null, now: Milestone[]): Review['lastTime'] {
  if (!previous) return undefined;
  const said = previous.milestones.filter((m) => !m.done).slice(0, PROMISES);
  if (!said.length) return undefined;
  const done = new Set(now.filter((m) => m.done).map((m) => m.text.trim().toLowerCase()));
  return { until: previous.until, items: said.map((m) => ({ text: m.text, done: done.has(m.text.trim().toLowerCase()) })) };
}
