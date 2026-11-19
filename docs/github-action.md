# GitHub Action

Run sprint-review on a schedule, so the draft is ready before the meeting.

## Setup

1. Add your Anthropic API key as a repository secret named `ANTHROPIC_API_KEY` (Settings → Secrets and variables → Actions).
2. Optionally commit a `sprint-review.config.yml` to the repository root.
3. Add a workflow, such as `.github/workflows/sprint-review.yml`.

> **Important:** check out the full history with `fetch-depth: 0`. The default shallow checkout has only the last commit, and the action stops with a clear error if it finds one.

## The simplest workflow: an artifact

```yaml
name: Sprint review
on:
  schedule:
    - cron: '0 7 * * 2'   # every Tuesday at 07:00 UTC
  workflow_dispatch:       # and a button to run it by hand

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: guuskeunen/sprint-review@v0
        id: review
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
      - uses: actions/upload-artifact@v4
        with:
          name: sprint-review
          path: ${{ steps.review.outputs.dir }}
```

Download the artifact from the run, open `deck.html`, present. The summary and the check log are also in the run's job summary.

> Every two weeks instead? GitHub's cron has no "every other week". Run weekly and skip odd weeks in a step, or start it by hand with the **Run workflow** button.

## A draft as a pull request

The review becomes a pull request. Reviewing the draft means reviewing the PR; merging it means it's approved. Anyone can fix a word in GitHub's file editor before merging.

```yaml
name: Sprint review
on:
  schedule:
    - cron: '0 7 * * 2'
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: guuskeunen/sprint-review@v0
        id: review
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
      - uses: peter-evans/create-pull-request@v7
        with:
          branch: sprint-review/${{ github.run_id }}
          title: Sprint review draft
          body-path: ${{ steps.review.outputs.markdown }}
          add-paths: sprint-reviews/
          commit-message: 'docs: sprint review draft'
```

After an edit to `review.json` in the PR, rebuild the deck locally with `npx @guuskeunen/sprint-review render <path>/review.json` and push, or add a workflow that does it on push.

## A shareable link with GitHub Pages

Publish the deck so you can share one link:

```yaml
name: Sprint review
on:
  schedule:
    - cron: '0 7 * * 2'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  review:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: guuskeunen/sprint-review@v0
        id: review
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          out: site
      - run: cp site/deck.html site/index.html
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site
      - uses: actions/deploy-pages@v4
        id: deploy
```

Turn on Pages first: Settings → Pages → Source: **GitHub Actions**. Pages on a public repository are public, so only use this when the deck may be seen by anyone with the link. For a private audience use the artifact or the pull request.

## Inputs

| Input | Default | Description |
|---|---|---|
| `anthropic-api-key` | **required** | Your Anthropic API key, from a secret. |
| `config` | auto | Path to the config file. |
| `since` | | First day of the sprint, `YYYY-MM-DD`. |
| `until` | today | Last day of the sprint. |
| `from` | | Start at a tag or commit instead of a date. |
| `to` | `HEAD` | End at a tag or commit. |
| `out` | `sprint-reviews/<date>` | Folder to write to. |
| `summary` | `true` | Add the review and the check log to the job summary. |
| `version` | `0` | The npm version of `@guuskeunen/sprint-review` to run. `0` means the newest 0.x. |

## Outputs

| Output | Description |
|---|---|
| `dir` | The folder everything was written to. |
| `deck` | Path of `deck.html`. |
| `review` | Path of `review.json`. |
| `markdown` | Path of `review.md`. |
| `checks` | Path of `checks.md`. |

## Reviews per release instead of per sprint

```yaml
on:
  release:
    types: [published]
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - id: previous
        run: echo "tag=$(git describe --tags --abbrev=0 ${{ github.event.release.tag_name }}^)" >> "$GITHUB_OUTPUT"
      - uses: guuskeunen/sprint-review@v0
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          from: ${{ steps.previous.outputs.tag }}
          to: ${{ github.event.release.tag_name }}
```

The review then covers exactly what changed since the previous release.

## Other CI systems

The action is a thin wrapper around the CLI. Anywhere with Node 20 and a full git history:

```bash
npx --yes @guuskeunen/sprint-review generate --json
```

For example in GitLab CI:

```yaml
sprint-review:
  image: node:22
  variables:
    GIT_DEPTH: 0
  script:
    - npx --yes @guuskeunen/sprint-review
  artifacts:
    paths: [sprint-reviews/]
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
```
