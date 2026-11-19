# Sprint Review Deck

Turn a sprint's git history into a sprint review deck anyone can follow. The AI writes the words; code checks every line against the real commits, adds before-and-after screenshots, and builds one self-contained HTML deck.

**[Website and live demo](https://guuskeunen.github.io/sprint-review/)** · **[Docs](https://github.com/guuskeunen/sprint-review#readme)**

```yaml
name: Sprint review
on:
  schedule:
    - cron: '0 7 * * 5'   # the morning of review day
  workflow_dispatch:

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0            # the full history is needed
      - uses: guuskeunen/sprint-review-action@v0
        id: review
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
      - uses: actions/upload-artifact@v4
        with:
          name: sprint-review
          path: ${{ steps.review.outputs.dir }}
```

All inputs and outputs are described in the [GitHub Action guide](https://github.com/guuskeunen/sprint-review/blob/main/docs/github-action.md). This repository lists the action on GitHub Marketplace; the code, issues and releases live in [guuskeunen/sprint-review](https://github.com/guuskeunen/sprint-review). `guuskeunen/sprint-review@v0` works the same.

MIT license.
