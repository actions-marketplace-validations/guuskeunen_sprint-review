import { DENSITY, defaultDeck, type DeckConfig } from '../config.ts';
import type { Milestone, Review, ReviewTheme } from '../types.ts';

/** How a theme slide is drawn: beside a screenshot, a large screenshot, a phone, or the icon. */
export type ThemeSlideLayout = 'split' | 'full' | 'phone' | 'icon';

export type PlannedSlide =
  | { kind: 'cover' }
  | { kind: 'headline' }
  | { kind: 'lastTime' }
  | { kind: 'theme'; index: number; layout: ThemeSlideLayout; flip: boolean }
  | { kind: 'cards'; indexes: number[] }
  | { kind: 'screen'; index: number }
  | { kind: 'hood' }
  | { kind: 'roadmap'; milestones: Milestone[] }
  | { kind: 'usage' }
  | { kind: 'closing' };

/** Numbers on one slide: one big number per idea, four at most. */
export const MAX_NUMBERS = 4;
/** Milestones on the roadmap: the last ones reached and the next ones, so the line stays readable. */
const MAX_MILESTONES = 6;

/**
 * Which slides the deck has, in which order, and how each theme slide is laid out. The HTML deck,
 * the PowerPoint file and the editor all follow this, so they never disagree.
 *
 * The story: cover, the sprint headline, what the last review said was next, the biggest themes one slide each, the rest on one slide
 * of cards, before and after, what else shipped, the roadmap, the numbers, and questions for the
 * audience. Executives get the numbers right after the headline (deck.order).
 */
export function planDeck(review: Review, deck: DeckConfig = defaultDeck()): PlannedSlide[] {
  const on = deck.sections;
  const plan: PlannedSlide[] = [{ kind: 'cover' }];
  if (on.headline && review.headline) plan.push({ kind: 'headline' });
  // What we said last time comes first: the audience checks promises before hearing new ones.
  if (on.lastTime && review.lastTime?.items.length) plan.push({ kind: 'lastTime' });
  const usage = on.usage && numbers(review).length ? [{ kind: 'usage' } as const] : [];
  if (deck.order === 'numbers-first') plan.push(...usage);

  const slots = DENSITY[deck.density].themeSlides;
  const own: number[] = [];
  const cards: number[] = [];
  review.themes.forEach((th, i) => {
    if (th.layout === 'card') cards.push(i);
    // A layout picked by hand gets its own slide; the rest fill the slots in order.
    else if ((th.layout && th.layout !== 'auto') || own.length < slots) own.push(i);
    else cards.push(i);
  });
  // One theme alone on the shared slide looks lost: it gets its own slide.
  if (cards.length === 1 && review.themes[cards[0]!]!.layout !== 'card') own.push(cards.pop()!);
  let previous: { layout: ThemeSlideLayout; flip: boolean } | null = null;
  for (const index of own) {
    const layout = themeLayout(review.themes[index]!);
    // Rhythm: the same picture layout twice in a row is mirrored, so paging through never feels like a loop.
    const flip: boolean = previous !== null && previous.layout === layout && (layout === 'split' || layout === 'phone') && !previous.flip;
    plan.push({ kind: 'theme', index, layout, flip });
    previous = { layout, flip };
  }
  if (cards.length) plan.push({ kind: 'cards', indexes: cards });

  if (on.screens) review.screens.forEach((_, index) => plan.push({ kind: 'screen', index }));
  if (on.hood && review.underTheHood.length) plan.push({ kind: 'hood' });
  if (on.roadmap && review.milestones.length) plan.push({ kind: 'roadmap', milestones: window(review.milestones) });
  if (deck.order === 'story') plan.push(...usage);
  plan.push({ kind: 'closing' });
  return plan;
}

/** The numbers worth a slide: those above zero, four at most. */
export function numbers(review: Review) {
  return review.usage.filter((u) => u.value > 0).slice(0, MAX_NUMBERS);
}

/** The layout a theme asked for, or the one its content suits. A layout that needs a picture falls back to the icon. */
function themeLayout(th: ReviewTheme): ThemeSlideLayout {
  if (!th.screen) return 'icon';
  if (th.screen.device === 'phone') return 'phone';
  if (th.layout === 'full') return 'full';
  if (th.layout === 'icon') return 'icon';
  return 'split';
}

/** Up to six milestones around where the team is: the last three reached and what comes next. */
function window(milestones: Milestone[]): Milestone[] {
  if (milestones.length <= MAX_MILESTONES || milestones.some((m) => m.stage)) return milestones.slice(0, MAX_MILESTONES);
  const next = milestones.findIndex((m) => !m.done);
  const at = next === -1 ? milestones.length : next;
  const start = Math.max(0, Math.min(at - 3, milestones.length - MAX_MILESTONES));
  return milestones.slice(start, start + MAX_MILESTONES);
}
