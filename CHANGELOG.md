# Changelog

All notable changes are listed here, written per release from the commit messages ([Conventional Commits](https://www.conventionalcommits.org)). Versions follow [Semantic Versioning](https://semver.org).

## [0.4.0](https://github.com/guuskeunen/sprint-review/compare/sprint-review-v0.3.0...sprint-review-v0.4.0) (2026-11-22)


### Added

* component screenshots, embedded fonts, You asked, product cover and zoom ([336c2aa](https://github.com/guuskeunen/sprint-review/commit/336c2aa363f26a4bba8abe9012615c7e83857988))
* **deck:** fitting close-ups, strips across the slide, a clean cover, and the editor after a review ([e01b488](https://github.com/guuskeunen/sprint-review/commit/e01b488cca4080a686b10f069a9f53604793a2d1))
* **deck:** fitting close-ups, strips across the slide, a clean cover, the editor after a review ([2731f68](https://github.com/guuskeunen/sprint-review/commit/2731f68e303456347ca14b197f0724dccde856da))
* **screens:** capture when a review is made, and a login that lasts ([2156ea0](https://github.com/guuskeunen/sprint-review/commit/2156ea058f84991d7025d1cb25f94d42d66b7852))
* **screens:** take today's pictures when a review is made; a login that lasts ([80119e5](https://github.com/guuskeunen/sprint-review/commit/80119e5b0c44c144191f517a963a53892097512e))


### Fixed

* **git:** a shallow clone that reaches back to before the sprint is fine ([ea9cc52](https://github.com/guuskeunen/sprint-review/commit/ea9cc52dcf9ed2b81752071193c2070c3db307be))
* **git:** a shallow clone that reaches back to before the sprint is fine ([3fe7ebe](https://github.com/guuskeunen/sprint-review/commit/3fe7ebee51d36d5c20c31b4c9c7ba3c4d299f737))

## [0.3.0](https://github.com/guuskeunen/sprint-review/compare/sprint-review-v0.2.2...sprint-review-v0.3.0) (2026-11-22)


### Added

* **config:** the audience sets the deck's density; aliases for the presets ([4a913cf](https://github.com/guuskeunen/sprint-review/commit/4a913cf6f09afad3bae6255ab609b2fc67b00205))
* **deck:** a deck that tells the sprint as a story, by presentation rules ([d420951](https://github.com/guuskeunen/sprint-review/commit/d420951e5538fed82dac0aa81caa8d5c50694b62))
* **deck:** a deck that tells the sprint as a story, by presentation rules ([56c2dc9](https://github.com/guuskeunen/sprint-review/commit/56c2dc9d2059ba2244c9c94ed403763b89aa051d))
* **deck:** frame what changed on the after picture; a motion budget ([d232c3b](https://github.com/guuskeunen/sprint-review/commit/d232c3b0ea9bf11ddc4b043485e43928786151c3))
* **deck:** frame what changed, dark screenshots, trends, palette, last sprint, Now/Next roadmap ([94c4e1a](https://github.com/guuskeunen/sprint-review/commit/94c4e1afd36cb4372df9e34f401daa1e1172f8f1))
* **deck:** last sprint we said; short video clips per screen ([fa0aacf](https://github.com/guuskeunen/sprint-review/commit/fa0aacf5137569c8e1dc7c2a332d6a64bd224533))
* **deck:** numbers show their change and a trend line ([9c2d5df](https://github.com/guuskeunen/sprint-review/commit/9c2d5df0289076d7f9dda9186ce235922c1bccb4))
* **deck:** the whole palette from the brand color, measured; type details ([129d363](https://github.com/guuskeunen/sprint-review/commit/129d363731eae28ac5b6dfbf23b8ad0f37a7f762))
* **roadmap:** read Now and Next roadmaps, in the audience's words ([94e98e0](https://github.com/guuskeunen/sprint-review/commit/94e98e017b8ba7fb97e6a039a966768e64b0e6b9))
* **screens:** dark-mode screenshots for the dark deck ([1916260](https://github.com/guuskeunen/sprint-review/commit/191626027b0017d16219f5005cab0f184cf61f92))


### Fixed

* **deck:** a list-like headline gets a warning; roadmap columns use the width ([3b40011](https://github.com/guuskeunen/sprint-review/commit/3b4001144cfb7bc25999516673c479ea34e9d22f))


### Docs

* how the deck is designed, the deck options, demo and benchmark ([7bd5811](https://github.com/guuskeunen/sprint-review/commit/7bd5811574389dbfb88daf62a72de27cc1fc4552))

## [0.2.2](https://github.com/guuskeunen/sprint-review/compare/sprint-review-v0.2.1...sprint-review-v0.2.2) (2026-11-21)


### Fixed

* **security:** a git ref can no longer act as a git option; clear errors before any model call ([be3122a](https://github.com/guuskeunen/sprint-review/commit/be3122a4a7d0fefa5260eb1924767ce35329fbd4))
* **security:** git option injection, script through review.json, key leaks, and hostile inputs ([3e56edb](https://github.com/guuskeunen/sprint-review/commit/3e56edb8359dab6dc921316e63836fb0bff88ee8))
* **security:** keys stay on https and this machine; bounded downloads, parsing and unzipping; MCP stays in the project ([1d66f25](https://github.com/guuskeunen/sprint-review/commit/1d66f25ac755d7b837d66747c9e11db5c992922e))
* **security:** no script through review.json, labels or Markdown; real hashes only ([657b362](https://github.com/guuskeunen/sprint-review/commit/657b362ad289a55b77c7c9b1b34f264d6aecf57f))


### Docs

* delete branches once their pull request is merged ([88a0ab9](https://github.com/guuskeunen/sprint-review/commit/88a0ab9fdd8b016c528e800e583ddfceb2dca77a))
* what the security fixes guarantee ([2029c0b](https://github.com/guuskeunen/sprint-review/commit/2029c0b2bf41c4409b848590d063b8a41a8c76a8))

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
