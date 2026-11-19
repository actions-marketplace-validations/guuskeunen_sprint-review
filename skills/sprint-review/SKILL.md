---
name: sprint-review
description: Generate, check and edit a sprint review deck from this repository's git history with the sprint-review CLI. Use when the user asks for a sprint review, a demo deck, release slides or "what did we ship this sprint".
---

# Sprint review

Writes a presentation of what a sprint delivered, in the language of the business, from the
git history of this repository. The words come from a model; every check, picture and number
is placed by code.

## Steps

1. Check the setup: `npx @guuskeunen/sprint-review doctor`. If there is no
   `sprint-review.config.yml`, run `npx @guuskeunen/sprint-review init` and fill in
   `product.name`, `product.description` and `audience` with the user. Ask what the product
   does and who will watch; don't guess.
2. Preview what would be sent, without calling a model:
   `npx @guuskeunen/sprint-review generate --dry-run`. Tell the user how many commits and
   screens it found.
3. Generate: `npx @guuskeunen/sprint-review generate --json`. It needs `ANTHROPIC_API_KEY`
   (or `OPENAI_API_KEY` with `model.provider: openai`). Use `--since`/`--until` for dates or
   `--from`/`--to` for tags, when the user names a sprint.
4. Read `checks.md` in the output folder and tell the user, briefly, what was corrected,
   moved or dropped, and every warning. Warnings are lines the second reader got stuck on.
5. If the user wants changes, edit `review.json` (keep its shape) and run
   `npx @guuskeunen/sprint-review render <folder>/review.json`, or start the editor with
   `npx @guuskeunen/sprint-review edit <folder>/review.json`.

## Rules

- Never invent work. Every line must come from commits in the range; the tool drops lines
  that name no real commit, so don't add them back by hand.
- Don't change `checks` in review.json; it is the record of what the tool did.
- The deck is one self-contained HTML file: send that file, or publish it, as the user prefers.
