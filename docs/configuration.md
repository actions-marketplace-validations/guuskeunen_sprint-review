# Configuration reference

sprint-review works without a config. A config file makes the deck fit your product, audience and brand.

## Where the config lives

The CLI looks in the current folder for the first of:

1. `sprint-review.config.yml`
2. `sprint-review.config.yaml`
3. `sprint-review.config.json`

Or pass one: `sprint-review --config path/to/config.yml`. Relative paths inside the config (logo, screenshot folders, usage file) are resolved from the config's own folder.

`sprint-review init` writes a commented starting point. It never overwrites an existing file unless you add `--force`.

## A complete example

```yaml
repo: .
product:
  name: Spoke
  description: the planning and customer app of Northside Cycles, a chain of bike repair shops
organization: Northside Cycles
audience: business
presenter: The presenter is a developer who gives a short demo of each theme.
language: English
goal: One customer page for the front desk

sprint:
  days: 14

brand:
  color: "#ea580c"
  logo: ./assets/logo.png

productPaths: [src/, app/]
ignore: ["^chore\\(release\\)", "^Merge "]
nonProductTypes: [ci, build, test, docs, chore]
replace:
  client: customer
rules:
  - Call the mobile app "the app", never "the mobile client".

areas:
  customers: { icon: users, label: Customers, screen: customer-page }
  planner: { icon: calendar, label: Workshop planner, screen: planner }

screenshots:
  source: git
  dir: e2e/__screenshots__
  names:
    customer-page: Customer page
    planner: Workshop planner
  ignore: { left: 240, top: 64 }

roadmap: ROADMAP.md
usage: ./usage.json

labels:
  hoodTitle: Behind the curtain

limits:
  themes: 6
  themeScreens: 4
  changedScreens: 4
  commits: 1000

model:
  name: claude-opus-5-5
  fallback: claude-sonnet-5-5
  maxTokens: 8000

output:
  dir: sprint-reviews
  markdown: true
```

## Options

### `repo`
The git repository to read. Default: the config's folder.

### `product`

| Key | Default | Description |
|---|---|---|
| `name` | the folder or `package.json` name | How the product is called on the slides and in the prompt. |
| `description` | empty | One or two sentences on what the product is and who uses it. **The single most useful setting.** |

### `organization`
Your company or team name. Shown on the cover ("Sprint review Northside Cycles") and in "What Northside Cycles gains". Default empty.

### `audience`
Who watches the review. A preset, or a sentence of your own:

| Preset | Written for |
|---|---|
| `business` (default) | Colleagues without a technical background: marketing, sales, support. |
| `executives` | Management: the few changes that matter most and what they bring. |
| `customers` | People who use the product: what they can do now. |
| `team` | The product team: plain words, a bit more detail. |

```yaml
audience: Store managers who use Spoke every day but never see the code.
```

### `presenter`
Who presents. The speaker notes are written for them. Default: a technical presenter who knows the product and gives a short demo per theme.

### `language`
The language of the slide content, as a name (`English`, `Dutch`, `German`) or a code (`nl`, `de-DE`). The AI writes in any language. The fixed labels ("Under the hood", "Before", "After"…) ship in English and Dutch. Other languages fall back to English labels; override them with [`labels`](#labels). Dates follow the language too: `November 16, 2026` in English, `16 november 2026` in Dutch.

### `goal`
The sprint goal. Shown on the cover, and the AI puts the work that served it first. Default none.

### `sprint.days`
How many days a review covers when you don't pass `--since` or `--from`. Both ends are included, so `14` with today being the 16th covers the 3rd to the 16th. Default `14`.

### `brand`

| Key | Description |
|---|---|
| `color` | Accent color as `#rrggbb`. Lighter and darker shades are mixed from it. Default indigo `#4f46e5`. |
| `logo` | Path to a PNG, JPG, SVG, WebP or GIF, or a `data:image/...` URI. Shown on the cover, on a white plate. |

### `productPaths`
Folders (path prefixes) that hold product code. A commit that only touches files outside them can't carry a theme or a summary point; whatever the AI writes about it moves under the hood. Default: empty, meaning every commit counts. Strongly recommended for monorepos.

```yaml
productPaths: [apps/web/src/, apps/api/app/, packages/ui/]
```

### `ignore`
Regular expressions, matched case-insensitively against commit subjects. Matching commits are left out entirely, as if they never happened. Default none.

### `nonProductTypes`
[Conventional Commit](https://www.conventionalcommits.org) types that never count as product work, whatever files they touch. Default `[ci, build, test, docs, chore]`. Set `[]` to turn this off.

### `replace`
Words the AI tends to get wrong, mapped to the word your team uses. Whole words only. A capital first letter stays a capital.

```yaml
replace:
  client: customer
  noot: notitie
```

### `rules`
Extra writing rules, one per line, in your own words. They're added to the AI's instructions.

### `areas`
The main parts of your product, so themes get the right icon (and screenshot) consistently. Each key maps to:

| Key | Description |
|---|---|
| `icon` | An icon key. Run `sprint-review icons` for the list. |
| `label` | How the area is called in the product, such as its menu label. |
| `screen` | Optional: the screenshot key that shows this area. |

### `screenshots`
Before and after slides, and pictures on theme slides. See the [screenshots guide](screenshots.md).

| Key | Description |
|---|---|
| `source` | `none` (default), `git` or `folder`. |
| `dir` | `git`: the folder in the repository with the pictures, from the repository root. |
| `before`, `after` | `folder`: two folders with the pictures at the start and end of the sprint. |
| `names` | Readable names per screen key. Also sets the order. |
| `ignore.left` | Pixels on the left to skip when comparing desktop pictures (a side menu). |
| `ignore.top` | Pixels at the top to skip (a top bar). |

### `roadmap`
A Markdown file in the repository, read as it was at the end of the sprint. Every line `- [x] text` is a reached milestone, `- [ ] text` an open one. Default `ROADMAP.md`. Set `false` to skip it. No file: no roadmap slide.

### `usage`
A JSON file with usage numbers you produce (from your analytics, database or a script):

```json
[
  { "label": "repairs booked", "value": 312, "previous": 268 },
  { "label": "repair tickets read", "value": 41 }
]
```

At most six. Numbers of zero are left out. `previous` shows under the number. The AI never sees or makes up these numbers.

### `labels`
Override any fixed label on the slides. Keys:

`sprintReview`, `period`, `goalLabel`, `valuesLabel`, `valuesTitle`, `valuesTitleNoOrg`, `usageLabel`, `usageTitle`, `previous`, `summaryLabel`, `summaryTitle`, `themeCount`, `screensLabel`, `before`, `after`, `beforeAlt`, `afterAlt`, `onPhone`, `roadmapLabel`, `roadmapTitle`, `roadmapReached`, `hoodLabel`, `hoodTitle`, `questions`, `notesLabel`, `hintBrowse`, `hintFullscreen`, `hintPresenter`, `hintNotes`, `presenter`, `previousSlide`, `nextSlide`, `slideOf`, `noNotes`, `upNext`, `lastSlide`, `phone`, `desktop`, `value_faster`, `value_quality`, `value_less_manual_work`, `value_less_risk`, `value_insight`.

Placeholders in curly braces are filled in: `{org}`, `{product}`, `{n}`, `{total}`, `{name}`, `{from}`, `{until}`, `{title}`.

```yaml
language: German
labels:
  sprintReview: Sprint-Review
  hoodTitle: Unter der Haube
  before: Vorher
  after: Nachher
```

### `limits`

| Key | Default | Description |
|---|---|---|
| `themes` | `6` | The most theme slides. |
| `themeScreens` | `4` | The most theme slides with a screenshot. |
| `changedScreens` | `4` | The most before and after slides. |
| `commits` | `1000` | The most commits read. Very long sprints are also cut to what the AI can read; `checks.md` names the commits it skipped. |

### `model`

| Key | Default | Description |
|---|---|---|
| `name` | `claude-opus-5-5` | The Anthropic model for both calls. |
| `fallback` | `claude-sonnet-5-5` | Used when the first model fails after retries. `null` to turn off. |
| `maxTokens` | `8000` | Room for the writer's answer. |

The API key always comes from the `ANTHROPIC_API_KEY` environment variable, never from the config, so the config can be committed.

### `output`

| Key | Default | Description |
|---|---|---|
| `dir` | `sprint-reviews` | Each review goes in `<dir>/<last day of the sprint>/`. `--out` overrides the whole path. |
| `markdown` | `true` | Also write `review.md`. |
