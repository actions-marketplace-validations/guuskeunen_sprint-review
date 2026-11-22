---
name: sprint-review
description: Generate, check and edit a sprint review deck from this repository's git history with the sprint-review tool. Use when the user asks for a sprint review, a demo deck, release slides or "what did we ship this sprint".
---

# Sprint review

Writes a presentation of what a sprint delivered, in the language of the business, from the
git history of this repository. The words come from a model; every check, picture and number
is placed by code.

## Before you start

If the `sprint-review` MCP tools are available (`check_sprint_review_setup`, `preview_sprint_commits`,
`generate_sprint_review`, `render_sprint_review`), use them for steps 1 to 3 and 5. Otherwise use the
`sprint-review` command in the steps below.

If neither is available, sprint-review isn't installed. Don't install it yourself: point the user to
the install instructions at https://github.com/guuskeunen/sprint-review#quick-start (it needs Node 22
or newer) and continue once they have it.

## Steps

1. Check the setup: `sprint-review doctor`. If there is no `sprint-review.config.yml`, run
   `sprint-review init` (with only the MCP tools, write the file yourself) and fill in
   `product.name`, `product.description` and `audience` with the user. Ask what the product does
   and who will watch; don't guess.
2. Preview what would be sent, without calling a model: `sprint-review generate --dry-run`. Tell the
   user how many commits and screens it found.
3. Generate: `sprint-review generate --json`. It needs `ANTHROPIC_API_KEY`, or the key for the
   provider in `model.provider` (Gemini, OpenAI and others; see
   https://github.com/guuskeunen/sprint-review/blob/main/docs/models.md); local models need none.
   Use `--since`/`--until` for dates or `--from`/`--to` for tags, when the user names a sprint.
4. Read `checks.md` in the output folder and tell the user, briefly, what was corrected, moved or
   dropped, and every warning. Warnings are lines the second reader got stuck on.
5. If the user wants changes, edit `review.json` (keep its shape) and run
   `sprint-review render <folder>/review.json`, or start the editor with
   `sprint-review edit <folder>/review.json`.

## Rules

- Never invent work. Every line must come from commits in the range; the tool drops lines that name
  no real commit, so don't add them back by hand.
- Don't change `checks` in review.json; it is the record of what the tool did.
- The deck is one self-contained HTML file: send that file, or publish it, as the user prefers.
