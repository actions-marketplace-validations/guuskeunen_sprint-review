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
| `npm run typecheck` | Type checks the code, the tests and the scripts. |
| `npm run lint` | ESLint with the recommended JavaScript and TypeScript rules. |
| `npm run bench` | The [quality benchmark](docs/benchmark.md) against a real model. `-- --echo` checks the harness without one. |
| `npm run build` | Builds `dist/`. |
| `node src/cli.ts --dry-run` | Runs the CLI from source in any repository. |
| `node scripts/build-demo.ts` | Rebuilds the demo deck in `docs/demo/`. |

## Where things are

Every file has one obvious home: one folder per area, the entry points at the top.

| Folder | What lives there |
|---|---|
| `src/index.ts`, `src/cli.ts` | The library's public exports, and the command line. |
| `src/config.ts`, `src/types.ts` | The config and its defaults; the shapes every area shares. |
| `src/git/` | What is read from git and GitHub: commits, files, the roadmap, pull request text. |
| `src/screens/` | Screenshots: finding them in git or a folder, comparing them, taking them with Playwright. |
| `src/ai/` | The model: clients and provider presets, cost, the prompts, and every check on what comes back (`writer.ts`). |
| `src/review/` | The pipeline that puts it together (`generate.ts`), and the check on a stored `review.json`. |
| `src/deck/` | The outputs: the HTML deck, Markdown, PowerPoint, colors, labels per language, icons. |
| `src/brand/` | The brand from a website or a `.pptx` (and the zip reader it needs). |
| `src/surfaces/` | The other ways in: the local editor, the MCP server, `doctor`, Slack. |
| `assets/` | Files the code loads at run time: deck CSS, the editor's pages, the config template. |
| `test/` | Mirrors `src/`: `src/ai/writer.ts` is tested in `test/ai/`. Shared fakes and the demo review are in `test/helpers.ts`; `test/security.test.ts` holds the cross-cutting security checks. |
| `bench/` | The quality benchmark: cases, scoring, and results per model. |
| `scripts/` | Repo tasks: the benchmark runner, the demo and `llms-full.txt` builders. |
| `docs/` | The user docs and the website. |
| `action.yml` | The GitHub Action. |

Keeping it that way:

- **A new file goes in the folder of its area.** A new area gets a folder only when it has more than one file; otherwise find the area it belongs to.
- **Name files after what they do** (`website.ts`, `costs.ts`), never `utils.ts` or `helpers.ts` in `src/`.
- **Tests mirror the code:** a test for `src/<area>/x.ts` goes in `test/<area>/`. Reuse the fakes in `test/helpers.ts` instead of writing new ones.
- **Keep files short.** Past about 400 lines, see whether a file does more than one job, and split it by job when you change it.
- **Moves get their own commit,** made with `git mv` and without other changes, so history follows the files.
- **Areas depend inward:** `surfaces/` and `cli.ts` may use every area, `review/` uses the areas it puts together, and `deck/`, `ai/`, `git/`, `screens/` and `brand/` don't import from `review/` or `surfaces/`.

## Guidelines

- **Code checks, the model writes.** Anything that can be checked in code belongs in `src/ai/writer.ts`, not in the prompt.
- **The prompt stays general.** No rules about one particular sprint or product.
- **The deck stays self-contained.** No outside fonts, scripts or images.
- **Errors are for people.** Say what went wrong and how to fix it.
- **Add a test** for every check or fix.
- **A new label** needs an entry in every label set in `src/deck/i18n.ts` (English, Dutch, German, French, Spanish); the typecheck fails when one is missing. Other languages are welcome as new label sets.

## Pull requests

Keep them focused, explain the why in the description, and make sure `npm test`, `npm run typecheck` and `npm run lint` pass. CI also runs `npm audit` on what users install.

GitHub deletes a branch when its pull request is merged. Delete your local copy too (`git branch -D <name>` after checking the PR is merged, since squash merges don't look merged to `git branch -d`), so only branches with open work are left.

## Releasing (maintainers)

1. Update `CHANGELOG.md` and the version in `package.json`.
2. `npm publish`.
3. Tag `vX.Y.Z`, move the `v0` tag to it, and publish a GitHub release (tick *Publish this Action to the GitHub Marketplace*).

## Releases

Releases are automatic. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `docs:`…). On every push to `main`, release-please updates a release pull request with the next version and the changelog. Merging it tags the release, publishes to npm with provenance, and moves the `v0` tag. Changing the prompts? Run `npm run bench` before and after, and put both numbers in the pull request.
