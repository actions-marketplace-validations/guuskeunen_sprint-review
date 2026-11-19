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
- One automatic rewrite of the lines the second reader flags; rewrites pass every check again and are logged as corrected (`revise`).
- Pull request titles and descriptions as context, from the GitHub API, when a token is set (`github`).
- More providers: Amazon Bedrock (API key or AWS signature), Azure OpenAI, OpenAI, OpenRouter, Gemini, Mistral, and local models with Ollama and LM Studio (`model.provider`, `baseUrl`, `mode`, `maxInputChars`, `region`).
- A model that answers in text instead of through the tool still works: the JSON is taken from the answer and checked as usual.
- `doctor` checks the key for the chosen provider, and whether a local model server answers and has the model.
- `sprint-review edit`: a local editor beside the live deck, saving `review.json` and rebuilding the deck.
- `sprint-review capture` and `screenshots.source: capture`: screenshots of your pages with Playwright, per device, with masks and a logged-in session.
- PowerPoint export with speaker notes (`--pptx`, `output.pptx`).
- Brand from an existing presentation: color, fonts and logo from a `.pptx` (`brand.from`), font settings (`brand.fonts`), and an optional dark deck (`brand.theme: dark`).
- Slack posting (`--slack`, `slack`).
- `sprint-review mcp`: an MCP server for Claude Code, Cursor and other clients, and a Claude Code skill.
- GitLab CI example.
- The deck can be embedded and driven by the page around it (`sprint-review:go` / `sprint-review:slide` messages).
- A website with a live demo, `llms.txt` and structured data.
- Security and privacy page, and a security policy.
