# Sprint review template

A slide-by-slide structure for a sprint review that works for a non-technical audience. Use it by hand, or let [sprint-review](https://github.com/guuskeunen/sprint-review) fill it from your git history ([see a generated example](https://guuskeunen.github.io/sprint-review/demo/)).

| # | Slide | What goes on it |
|---|---|---|
| 1 | **Cover** | Product, sprint dates, the sprint goal in one line |
| 2 | **What it brings** | The themes grouped by value: faster, better quality, less manual work, less risk, more insight |
| 3 | **In use** | Two to six numbers that moved, with last sprint for comparison |
| 4 | **This sprint in short** | Three to four one-line highlights |
| 5–10 | **One slide per theme** | A title of a few words, one sentence on the effect for the audience, two to four points, a screenshot; speaker notes on what to demo |
| 11–13 | **Before and after** | The screens that changed, side by side, with one line on what to look at |
| 14 | **Roadmap** | Milestones reached and open |
| 15 | **Under the hood** | Maintenance, upgrades, tests, CI: one slide |
| 16 | **Questions** | And what's next |

## Writing rules that make it land

- Write for the person in the room, not the person who wrote the code: "Front desk staff see a customer's whole history on one page", not "Added timeline endpoint".
- At most 16 words per point, 25 for the effect sentence.
- No ticket numbers, hashes or branch names on slides.
- Every claim must match something that was actually merged.

## Generate it instead

```bash
npx @guuskeunen/sprint-review --dry-run   # see what it would read
npx @guuskeunen/sprint-review             # write the deck
```

The rules above are the checks sprint-review runs in code on every line.
