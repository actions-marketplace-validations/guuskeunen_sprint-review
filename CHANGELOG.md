# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com), and versions follow [Semantic Versioning](https://semver.org).

## [0.1.0] - unreleased

The first public version.

### Added
- `sprint-review generate`: a sprint review deck from the git history, by dates or between two tags or commits.
- Two AI calls: a writer with a fixed answer shape, and a second reader that sees only the slide text and flags what the audience wouldn't understand.
- Checks in code: every point must name a real commit, tooling commits go under the hood, word limits, no exclamation marks or emoji, ticket numbers and hashes removed, team words applied. All logged in `checks.md`.
- Commit messages are passed as untrusted data, so instructions inside them are ignored.
- Conventional Commit types (`ci`, `build`, `test`, `docs`, `chore`) never count as product work.
- Before and after slides from screenshots in git (visual tests) or two folders, with a pixel diff that skips the side menu and top bar, and crops desktop pictures to the change.
- The deck: one self-contained HTML file with cover, sprint goal, value slide, usage numbers, summary, themes, before and after, roadmap, under the hood and a closing slide. Presenter window with notes and timer, full screen, print to PDF, keyboard, click and swipe, reduced motion.
- `review.json` to edit, and `sprint-review render` to rebuild the deck from it.
- `review.md` summary and `checks.md` check log.
- Brand color and logo, English and Dutch labels, content in any language, every label overridable.
- `sprint-review init`, `doctor`, `icons` and `--dry-run`.
- Works without a config file.
- GitHub Action with outputs and a job summary.
- Node API: `generate`, `render`, `loadConfig` and the building blocks.
