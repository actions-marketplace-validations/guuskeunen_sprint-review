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

## Adding a case

Copy a file in `bench/cases/`, change the commits and the expectations, run it. A good case is a sprint where a careless writer would go wrong: vague messages, noise, a tempting thing to invent. Keep the expected words loose ("ticket", "photo", "handwritten"), so a good answer in other words still counts.
