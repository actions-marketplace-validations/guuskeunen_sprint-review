# Editing and presenting

## Most of the time: just present it

The deck is a draft, but it's written to be presented as it is. Read it through once, glance at `checks.md`, and go.

## Changing the content

Everything on the slides is in `review.json`, next to the deck:

```json
{
  "version": 1,
  "title": "Sprint review November 16, 2026",
  "period": "November 3 to November 16, 2026",
  "summary": [{ "text": "One customer page shows online store, register and workshop history", "icon": "users" }],
  "themes": [
    {
      "title": "Customer profile",
      "icon": "users",
      "value": "quality",
      "effect": "Front desk staff see everything a customer bought or had repaired on one page.",
      "points": ["Purchases, repairs and services sit in one list with their source"],
      "notes": "Open the customer page for Sarah Mitchell and point at the source labels.",
      "screen": null
    }
  ],
  "underTheHood": ["Vite is up to date"],
  "screens": [],
  "milestones": [{ "text": "Book a repair online", "done": true }],
  "usage": [{ "label": "repairs booked", "value": 312, "previous": 268 }]
}
```

What you can change:

| To… | Edit |
|---|---|
| Fix a word | Any `text`, `title`, `effect`, `points` or `notes`. |
| Reorder themes | Move items in `themes`. |
| Drop a slide | Remove the theme, the screen from `screens`, or empty `underTheHood`. |
| Change an icon | `icon`, see `sprint-review icons`. |
| Change what a theme brings | `value`: `faster`, `quality`, `less_manual_work`, `less_risk`, `insight`, or `null`. |
| Remove a theme's picture | Set `screen` to `null`. |
| Fix a number | `usage`. |

Then rebuild:

```bash
npx @guuskeunen/sprint-review render sprint-reviews/2026-11-16/review.json
```

`render` also picks up config changes: a new logo, color, goal or labels show up in old reviews when you render them again.

A local visual editor (`sprint-review edit`) is on the [roadmap](../README.md#roadmap).

## Presenting

Open `deck.html` in any browser. It has no outside dependencies, so it also works offline and from a USB stick.

| Key | Does |
|---|---|
| → ↓ Space Enter PageDown | Next slide |
| ← ↑ Backspace PageUp | Previous slide |
| Home / End | First / last slide |
| F | Full screen |
| P | Presenter window: speaker notes, the next slide's title and a timer, for your own screen |
| N | Show the speaker notes at the bottom of this window |

Click the right two thirds of the screen to go forward, the left third to go back. Swipe on a phone or tablet. The address ends in `#3` on slide 3, so a link can open on a specific slide.

The animations respect your system's *reduce motion* setting.

## Exporting to PDF

Print the deck (Cmd/Ctrl + P) and choose **Save as PDF**. Every slide becomes one 16:9 page, without animations or controls. Turn on **Background graphics** in the print dialog to keep the colors.

## Sharing

- **Send the file.** `deck.html` is one file, usually a few hundred kilobytes with screenshots.
- **Host it.** Any static host works: GitHub Pages (see [the GitHub Action guide](github-action.md#a-shareable-link-with-github-pages)), Netlify, S3, an intranet.
- **Paste the summary.** `review.md` is ready for a pull request, Slack or an email.
