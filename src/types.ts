export type Device = 'desktop' | 'phone';

export interface Commit {
  hash: string;
  date: string;
  subject: string;
  body: string;
  files: string[];
  /** Whether the commit touched product code (see `productPaths` in the config). */
  product: boolean;
  /** The pull request that brought the commit in, when the GitHub API was reachable. */
  pullRequest?: { number: number; title: string; body: string };
}

export interface Screenshot {
  /** The screen's key, from its file name without the device suffix: `customer-page`. */
  key: string;
  device: Device;
  /** PNG bytes. */
  image: Buffer;
}

export interface ChangedScreen {
  /** The label the model and the slide use: "Customer page" or "Customer page (phone)". */
  name: string;
  key: string;
  device: Device;
  before: Buffer;
  after: Buffer;
}

export interface Milestone {
  text: string;
  done: boolean;
}

export interface UsageMetric {
  label: string;
  value: number;
  previous?: number;
}

export type CheckKind = 'corrected' | 'moved' | 'dropped' | 'warning';

export interface Check {
  kind: CheckKind;
  text: string;
  reason: string;
}

export interface WrittenTheme {
  title: string;
  icon: string;
  /** The label of the screenshot the model chose, or null. */
  screen: string | null;
  device: Device;
  value: string | null;
  effect: string | null;
  points: string[];
  notes: string | null;
}

export interface WrittenReview {
  summary: { text: string; icon: string }[];
  summaryNotes: string | null;
  themes: WrittenTheme[];
  underTheHood: string[];
  /** What changed per changed screen, by the screen's label. */
  screenCaptions: Record<string, string>;
  checks: Check[];
}

/** A picture as stored in the review: a data URI, so the JSON is self-contained. */
export interface StoredPicture {
  name: string;
  device: Device;
  image: string;
}

export interface ReviewTheme extends Omit<WrittenTheme, 'screen'> {
  screen: StoredPicture | null;
  /** The screen the theme is about, kept so the picture can be switched between devices later. */
  screenKey: string | null;
}

export interface ReviewScreen {
  name: string;
  device: Device;
  before: string;
  after: string;
  caption: string | null;
}

/** Everything the deck is rendered from. Editing a review means editing this, then rendering again. */
export interface Review {
  version: 1;
  title: string;
  period: string;
  from: string;
  until: string;
  language: string;
  organization: string;
  product: string;
  summary: { text: string; icon: string }[];
  summaryNotes: string | null;
  themes: ReviewTheme[];
  underTheHood: string[];
  screens: ReviewScreen[];
  milestones: Milestone[];
  usage: UsageMetric[];
  checks: Check[];
}
