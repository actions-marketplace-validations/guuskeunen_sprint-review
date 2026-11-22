# Screenshots

Before and after pictures are what make a sprint review land. sprint-review can add two kinds of pictures:

- **Before and after slides** for screens that changed during the sprint, with one line on what to look at.
- **A screenshot on a theme slide**, when one shows what the theme is about.

There are three ways to get them: from your visual tests, from two folders, or taken by the tool from URLs you choose (best on staging with demo data, so no customer data ends up on a slide). Screenshots are always optional: without them, theme slides show an icon instead and the deck still looks complete.

## Option 1: pictures from your visual tests (`git`)

If your project has visual regression tests (Playwright `toHaveScreenshot`, Cypress, Storybook, Chromatic exports…), the reference pictures live in the repository and change in the same commit as the UI. That makes them perfect: real screens, made-up test data, and a history.

```yaml
screenshots:
  source: git
  dir: e2e/__screenshots__/screens.spec.ts
  names:
    dashboard: Dashboard
    customer-page: Customer page
  ignore: { left: 240, top: 64 }
```

How it works:

1. It lists the PNG files under `dir` that changed during the sprint.
2. For each one it takes the version at the start and at the end of the sprint. A picture that only appeared during the sprint uses its first version as "before".
3. It compares them pixel by pixel, skipping `ignore.left` pixels on the left of desktop pictures (a side menu) and `ignore.top` pixels at the top (a top bar). So adding one menu item doesn't mark every screen as changed. Small differences (anti-aliasing, a moving background) stay under the tolerance.
4. On desktop it crops both pictures to where the change is, so the slide shows that part large.
5. The AI writes one line per changed screen on what to look at, or skips it when the change is too small. Only screens with such a line get a slide.

`dir` is a path from the repository root.

## Option 2: two folders (`folder`)

Export or take pictures any way you like, and put them in two folders:

```
screens/
  before/
    dashboard-desktop.png
    customer-page-desktop.png
    customer-page-phone.png
  after/
    dashboard-desktop.png
    customer-page-desktop.png
    customer-page-phone.png
```

```yaml
screenshots:
  source: folder
  before: screens/before
  after: screens/after
```

Pictures that are in both folders and differ are compared exactly as above. Pictures in `after` are also available for theme slides.

## Option 3: the tool takes them (`capture`)

No visual tests? Give sprint-review the pages and it photographs them with Playwright. Each run keeps the pictures in a folder per day; the next review compares the last pictures from before the sprint with the newest ones.

```bash
npm install --save-dev playwright
npx playwright install chromium
```

```yaml
screenshots:
  source: capture
  baseUrl: https://staging.example.com
  pages:
    customer-page: /customers/1042      # screen key: path or full URL
    planner: /planner?branch=north
  devices: [desktop, phone]             # default: desktop
  mask: [".email", "[data-private]"]    # painted over before the picture is taken
  storageState: .auth/staging.json      # optional: a logged-in session
  wait: 800                             # ms after the page settles, default 500
  storage: .sprint-review/screenshots   # default
  names:
    customer-page: Customer page
```

Take today's pictures:

```bash
npx @guuskeunen/sprint-review capture
```

Run `capture` at the end of every sprint, right before `generate` (in CI: as a step before it). Keep the storage folder between runs: commit it, or cache it in CI. The first run has nothing to compare with, so its pictures only show on theme slides.

- **Point it at staging with demo data**, never production. `mask` is a safety net, not a plan.
- **A login?** Save one with `npx playwright codegen --save-storage=.auth/staging.json https://staging.example.com`, and keep that file out of git.
- **No Playwright browser download?** Set `SPRINT_REVIEW_CHROME` to a Chrome or Chromium binary.

## File names

| File name | Screen key | Device |
|---|---|---|
| `customer-page-desktop.png` | `customer-page` | desktop |
| `customer-page-phone.png` | `customer-page` | phone |
| `customer-page-mobile.png` | `customer-page` | phone |
| `customer-page.png` | `customer-page` | desktop |
| `dashboard-mobile-chromium-linux.png` | `dashboard` | phone (Playwright's browser and platform suffix is dropped) |

The screen key turns into a readable name ("customer-page" → "Customer page") unless you set one in `names`. The order of `names` is also the order of the slides.

Phone pictures are shown upright, in a phone frame.

## Dark mode

With `brand.theme: dark`, a light screenshot glares on the black slides. If your app has a dark mode, give the deck dark pictures too:

- **Capture:** set `screenshots.darkMode: true` and every page is also photographed in the app's dark mode (Playwright's `colorScheme: dark`). It only works when the app follows the system setting.
- **Git or folders:** add the dark picture next to the light one with `-dark` in the name: `planner-desktop-dark.png`.

The dark deck uses a dark pair when both the before and the after picture have one, and the light pair otherwise, so a comparison never mixes the two (that would count every screen as changed). A light picture on the dark deck is dimmed a little.

## Tips

- **Use made-up data in your test fixtures.** Then the pictures are safe to show anywhere.
- **Set `ignore` to your layout's menu and top bar sizes**, in pixels at the screenshot's resolution.
- **Connect areas to screens** so a theme about an area shows its screen:

```yaml
areas:
  planner: { icon: calendar, label: Workshop planner, screen: planner }
```

