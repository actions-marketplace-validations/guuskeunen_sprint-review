# Changelog

All notable changes are listed here, written per release from the commit messages ([Conventional Commits](https://www.conventionalcommits.org)). Versions follow [Semantic Versioning](https://semver.org).

## [0.2.1](https://github.com/guuskeunen/sprint-review/compare/sprint-review-v0.2.0...sprint-review-v0.2.1) (2026-11-21)


### Fixed

* Claude Opus and Sonnet 5.5 work again; strict tools; JSON mode when a model refuses tools ([3ac2059](https://github.com/guuskeunen/sprint-review/commit/3ac2059c49fc7948388a8a4db39b19555266f12b))
* no empty decks from a malformed answer; more room for thinking models ([cad3314](https://github.com/guuskeunen/sprint-review/commit/cad33147bc6d7c4cabb2f8b8d107ba32729c0679))
* the default Claude models work again; reliable tool calls across Claude, GPT and Gemini ([64adaa0](https://github.com/guuskeunen/sprint-review/commit/64adaa0e33238b6453fb5eb60181031e14e1537c))


### Docs

* how to clear the image-size audit report that pptxgenjs brings ([09d6134](https://github.com/guuskeunen/sprint-review/commit/09d61346e8d7f9265b216f729acb4a7b225e8132))
* how to clear the image-size audit report that pptxgenjs brings ([2444b01](https://github.com/guuskeunen/sprint-review/commit/2444b017024d19bf6fefae3cf3426a72179e0aa2))
* verified models and benchmark results for Claude, GPT and Gemini ([426f270](https://github.com/guuskeunen/sprint-review/commit/426f27090074d1473d34e44254a99eab1cbc37e8))

## [0.2.0](https://github.com/guuskeunen/sprint-review/compare/sprint-review-v0.1.0...sprint-review-v0.2.0) (2026-11-21)


### Added

* Edit button in the deck, live view, readable brand colors, five label languages ([090b2fa](https://github.com/guuskeunen/sprint-review/commit/090b2fa0c9538250ba48698690a020bb15b87bb0))
* estimate what each run costs and keep a ledger ([7aba3cf](https://github.com/guuskeunen/sprint-review/commit/7aba3cfd167e66f74a87d3e3283b7124ad520ddb))
* show cost and website brand in the CLI and MCP server; fix render --pptx ([d4b9409](https://github.com/guuskeunen/sprint-review/commit/d4b9409030b09de33a5d901d3cd388e6e920a9dc))
* take the brand from a website with brand.from: https://... ([1ce7c6f](https://github.com/guuskeunen/sprint-review/commit/1ce7c6f3998ed000c8ef8f3c5dd3ac0d967c91e0))


### Fixed

* Gemini reviews no longer fail, and a cut-off answer says so ([a8c4062](https://github.com/guuskeunen/sprint-review/commit/a8c4062a0e279651248dd69ee54980dcaa83c157))
* no invented reasons, no features under the hood; score plain-language plumbing ([d276c88](https://github.com/guuskeunen/sprint-review/commit/d276c88811e0e88255b34471b6bd5fb748151ea8))


### Docs

* open the demo deck in a new tab from the website ([8463a47](https://github.com/guuskeunen/sprint-review/commit/8463a4732182627e79f7f0c470848c988dc8627c))
* website branding, cost tracking, live view and Edit button, languages, Gemini ([0437537](https://github.com/guuskeunen/sprint-review/commit/043753769c1bdb2f16f2a0b1ce8510f8cbc8d800))

## 0.1.0 (2026-11-19)

The first public release: the CLI, the GitHub Action, the MCP server and Claude Code plugin, the editor, PowerPoint export, nine model providers and the quality benchmark. The full feature list is in [the 0.1.0 release notes](docs/release-notes/v0.1.0.md).
