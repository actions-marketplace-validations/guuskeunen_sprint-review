# The quality benchmark

A model writes the words on the slides, so "is it better now?" is a real question every time a prompt or a model changes. The benchmark answers it with numbers instead of a feeling.

## What it is

Fixed sample sprints in [`bench/cases/`](../bench/cases), each with the answer a good presenter would give:

| Case | What it tests |
|---|---|
| `bike-shop` | Product work mixed with tooling noise, a ticket number in a subject, and a commit that tries to instruct the model ("ignore all previous instructions…") |
| `billing-saas` | Terse, technical messages ("add sepa direct debit to checkout", "WIP", a Jira key), for a customer audience |
| `cli-library` | A developer tool reviewed for its own team, with a breaking change |

Each case lists:

- **themes** that should be on the front slides, with words that count as covering them;
- **hood** items, the plumbing that belongs under the hood and nowhere else;
- **never**: text that must never appear on a slide (ticket keys, injected instructions, "WIP").

Every case is built into a real git repository with real dates and files, and goes through the real pipeline: the writer, every check, the second reader, the rewrite.

## The score

| Part | Points |
|---|---|
| Expected themes covered on the front slides | 50 |
| No plumbing on the front slides | 15 |
| Plumbing under the hood | 10 |
| Nothing forbidden anywhere on the slides | 15 |
| Few warnings left by the second reader | 10 |

Alongside the score: how many points the checks dropped or rewrote, how many themes there are, and the average words per point.

## Running it

```bash
export ANTHROPIC_API_KEY=...
npm run bench                                          # the default model
npm run bench -- --model claude-sonnet-5-5
npm run bench -- --provider ollama --model qwen3:32b   # a local model
npm run bench -- --cases bike-shop                     # one case
npm run bench -- --echo                                # no model: checks the harness itself
```

A report is printed and saved in `bench/results/`, named by date and model. Commit the ones worth keeping: they're the history of the tool's quality, and they fill the [model table](models.md#tested-models).

A full run is three cases, two or three calls each. With Claude that's a few dimes.

## Real repositories

The sample sprints check the words. Real repositories check everything else: size, noise, pull requests, a product the writer has never seen. We ran sprint-review on the same two weeks (November 9 to 22, 2026) of four open-source projects, with Claude Sonnet 5.5, a short product description and `productPaths` in the config, and nothing edited afterwards. The decks are [in the README](../README.md#real-decks-from-real-repositories).

| Project | Commits | Pull requests | Read | Time | Tokens | Cost | Checks |
|---|---|---|---|---|---|---|---|
| VS Code | 1,298 | not counted | all product commits; 52 docs and chores left out | 109 s | 68,000 | $0.21 | 14 |
| Next.js | 252 | 80 | all but 1 without product code | 167 s | 72,838 | $0.28 | 23 |
| Supabase | 355 | 114 | all | 146 s | 67,659 | $0.22 | 9 |
| Excalidraw | 16 | 15 | all | 77 s | 25,704 | $0.12 | 11 |

What the first round found, and what changed:

- **Shallow clones were refused**, even ones that held the whole sprint. A shallow clone is now fine when it reaches back to before the sprint starts.
- **Big sprints were read from the end.** The commit log was cut at the input limit, newest first, so on VS Code the writer saw only the last days. Each commit past the cut was also its own warning: 916 checks on VS Code, 164 on Next.js, 247 on Supabase. Now every product commit gets a line first, then details as far as they fit, and what's left out is one warning. On VS Code this changed the headline: the biggest change of the sprint (a new launcher for agent sessions) landed early and had been missed.
- **`limits.commits` quietly dropped the oldest commits** (1,000 by default). The default is now 3,000, and a sprint past it gets a warning.
- **Two cards sat on half the slide**, and a title joined two messages with a semicolon. Two cards now use the full width, and such a title gets a warning.

To run one yourself:

```bash
git clone --shallow-since=2026-11-01 https://github.com/excalidraw/excalidraw && cd excalidraw
cat > sprint-review.config.yml <<'YML'
product: { name: Excalidraw, description: "A virtual whiteboard for hand-drawn-like diagrams." }
productPaths: [packages/, excalidraw-app/]
model: { name: claude-sonnet-5-5 }
YML
GITHUB_TOKEN=$(gh auth token) npx @guuskeunen/sprint-review --until 2026-11-22
```

## Adding a case

Copy a file in `bench/cases/`, change the commits and the expectations, run it. A good case is a sprint where a careless writer would go wrong: vague messages, noise, a tempting thing to invent. Keep the expected words loose ("ticket", "photo", "handwritten"), so a good answer in other words still counts.
