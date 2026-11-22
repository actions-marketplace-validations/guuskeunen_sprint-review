# AGENTS.md

Rules for AI agents (and people) changing this repository. The full guide is
[CONTRIBUTING.md](CONTRIBUTING.md): its "Where things are" section says where every file goes,
and its guidelines apply to every change.

- Put new code in the folder of its area (`src/git`, `src/screens`, `src/ai`, `src/review`,
  `src/deck`, `src/brand`, `src/surfaces`) and its test in the matching `test/` folder.
- Search for existing code before writing new code; reuse the fakes in `test/helpers.ts`.
- Write the test first for a fix. Run `npm test`, `npm run typecheck` and `npm run lint` before you
  finish; all three must pass.
- Never call a paid model API from a test. Live checks (`npm run bench`, a real run) cost money:
  ask first.
- Never commit or push unless asked. Moves go in their own commit, made with `git mv`.
- Keep user-facing text in plain US English; update the docs in `docs/` when behavior changes.
