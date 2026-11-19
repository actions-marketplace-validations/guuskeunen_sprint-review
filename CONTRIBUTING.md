# Contributing

Thanks for wanting to help. Bug reports, ideas and pull requests are all welcome.

## Setup

```bash
git clone https://github.com/guuskeunen/sprint-review
cd sprint-review
npm install
npm test
```

`npm test` runs the whole pipeline against a fake bike-shop repository and a fake model, so you need no API key. Node 22.18 or newer runs the TypeScript tests directly.

## Useful commands

| Command | Does |
|---|---|
| `npm test` | All tests. |
| `npm run typecheck` | Type checks without building. |
| `npm run build` | Builds `dist/`. |
| `node src/cli.ts --dry-run` | Runs the CLI from source in any repository. |
| `node scripts/build-demo.ts` | Rebuilds the demo deck in `docs/demo/`. |

## Where things are

| File | What it does |
|---|---|
| `src/history.ts` | Reads commits, files and the roadmap from git. |
| `src/screenshots.ts`, `src/compare.ts` | Finds changed screenshots and compares them. |
| `src/prompt.ts` | Everything the model is told, and the answer shapes. |
| `src/writer.ts` | The two model calls and every check on what comes back. |
| `src/generate.ts` | Puts it all together. |
| `src/render.ts`, `assets/deck.css` | The deck. |
| `src/i18n.ts` | Slide labels per language. |
| `src/cli.ts` | The command line. |
| `action.yml` | The GitHub Action. |

## Guidelines

- **Code checks, the model writes.** Anything that can be checked in code belongs in `writer.ts`, not in the prompt.
- **The prompt stays general.** No rules about one particular sprint or product.
- **The deck stays self-contained.** No outside fonts, scripts or images.
- **Errors are for people.** Say what went wrong and how to fix it.
- **Add a test** for every check or fix.
- **A new label** needs an entry in both English and Dutch in `src/i18n.ts`. Other languages are welcome as new label sets.

## Pull requests

Keep them focused, explain the why in the description, and make sure `npm test` and `npm run typecheck` pass.

## Releasing (maintainers)

1. Update `CHANGELOG.md` and the version in `package.json`.
2. `npm publish`.
3. Tag `vX.Y.Z`, move the `v0` tag to it, and publish a GitHub release (tick *Publish this Action to the GitHub Marketplace*).
