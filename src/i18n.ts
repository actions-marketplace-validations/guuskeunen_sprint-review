/**
 * The fixed words on the slides. The model writes the content in the configured language; these
 * are the labels around it. English and Dutch ship; any other language falls back to English,
 * and every label can be overridden in the config under `labels`.
 */
const EN = {
  sprintReview: 'Sprint review',
  period: '{from} to {until}',
  goalLabel: 'Sprint goal',
  valuesLabel: 'What it brings',
  valuesTitle: 'What {org} gains',
  valuesTitleNoOrg: 'What we gain',
  usageLabel: 'In use',
  usageTitle: 'How {product} was used',
  previous: 'last sprint',
  summaryLabel: 'In short',
  summaryTitle: 'This sprint',
  themeCount: '{n} of {total}',
  screensLabel: 'What it looks like',
  before: 'Before',
  after: 'After',
  beforeAlt: '{name} before this sprint',
  afterAlt: '{name} after this sprint',
  onPhone: '{name} on a phone',
  roadmapLabel: 'Roadmap',
  roadmapTitle: 'Milestones',
  roadmapReached: '{n} of {total} milestones reached',
  hoodLabel: 'Behind the scenes',
  hoodTitle: 'Under the hood',
  questions: 'Questions',
  notesLabel: 'How to tell it',
  hintBrowse: 'browse',
  hintFullscreen: 'full screen',
  hintPresenter: 'presenter',
  hintNotes: 'notes',
  presenter: 'Presenter',
  previousSlide: 'Previous',
  nextSlide: 'Next',
  slideOf: 'Slide {n} of {total}',
  noNotes: 'No notes for this slide.',
  upNext: 'Next: {title}',
  lastSlide: 'Last slide',
  phone: 'phone',
  desktop: 'desktop',
  value_faster: 'Faster work',
  value_quality: 'Better quality',
  value_less_manual_work: 'Less manual work',
  value_less_risk: 'Less risk',
  value_insight: 'More insight',
};

export type LabelKey = keyof typeof EN;
export type Labels = Record<LabelKey, string>;

const NL: Labels = {
  sprintReview: 'Sprint review',
  period: 'Van {from} tot {until}',
  goalLabel: 'Sprintdoel',
  valuesLabel: 'Opbrengst',
  valuesTitle: 'Wat {org} wint',
  valuesTitleNoOrg: 'Wat het oplevert',
  usageLabel: 'In gebruik',
  usageTitle: 'Zo werd {product} gebruikt',
  previous: 'vorige sprint',
  summaryLabel: 'In het kort',
  summaryTitle: 'Deze sprint',
  themeCount: '{n} van {total}',
  screensLabel: 'Zo ziet het eruit',
  before: 'Voor',
  after: 'Na',
  beforeAlt: '{name} voor deze sprint',
  afterAlt: '{name} na deze sprint',
  onPhone: '{name} op een telefoon',
  roadmapLabel: 'Roadmap',
  roadmapTitle: 'Mijlpalen',
  roadmapReached: '{n} van de {total} mijlpalen bereikt',
  hoodLabel: 'Achter de schermen',
  hoodTitle: 'Onder de motorkap',
  questions: 'Vragen',
  notesLabel: 'Zo vertel je het',
  hintBrowse: 'bladeren',
  hintFullscreen: 'volledig scherm',
  hintPresenter: 'presentator',
  hintNotes: 'notities',
  presenter: 'Presentator',
  previousSlide: 'Vorige',
  nextSlide: 'Volgende',
  slideOf: 'Dia {n} van {total}',
  noNotes: 'Geen notitie bij deze dia.',
  upNext: 'Hierna: {title}',
  lastSlide: 'Laatste dia',
  phone: 'telefoon',
  desktop: 'desktop',
  value_faster: 'Sneller werken',
  value_quality: 'Betere kwaliteit',
  value_less_manual_work: 'Minder handwerk',
  value_less_risk: 'Minder risico',
  value_insight: 'Meer inzicht',
};

const NAMES: Record<string, string> = { english: 'en', dutch: 'nl', nederlands: 'nl', german: 'de', deutsch: 'de', french: 'fr', 'français': 'fr', spanish: 'es', 'español': 'es' };

/** A BCP 47 locale for a language given as a name ("Dutch") or a code ("nl", "nl-BE"). */
export function localeOf(language: string): string {
  const l = language.trim().toLowerCase();
  if (NAMES[l]) return NAMES[l];
  try {
    return Intl.getCanonicalLocales(language)[0] ?? 'en';
  } catch {
    return 'en';
  }
}

export function labelsFor(language: string, overrides: Record<string, string> = {}): Labels {
  const base = localeOf(language).split('-')[0] === 'nl' ? NL : EN;
  const out = { ...base };
  for (const [k, v] of Object.entries(overrides)) if (k in out) out[k as LabelKey] = v;
  return out;
}

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}

/** "10 November 2026" in the slides' language. */
export function longDate(iso: string, language: string): string {
  return new Intl.DateTimeFormat(localeOf(language), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}

export function shortDate(iso: string, language: string): string {
  return new Intl.DateTimeFormat(localeOf(language), { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}
