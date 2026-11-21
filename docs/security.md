# Security and privacy

A one-page answer for whoever has to approve sprint-review: what it reads, what it sends where, and what it never does.

## In short

- **It runs on your machine or in your own CI.** There is no sprint-review server, no account and no telemetry. The author never sees your data.
- **It sends commit text, not code.** Commit subjects, descriptions and changed file names go to the AI provider you configure, with your own key. Source code, diffs and screenshots never leave.
- **You choose the provider,** including ones your company already approved (Azure OpenAI, Amazon Bedrock) or a local model where nothing leaves your network.
- **`--dry-run` shows exactly what would be sent,** before anything is.

## What it reads

| Source | What | When |
|---|---|---|
| Your git repository | Commit hashes, dates, subjects, descriptions and changed file names in the range; the roadmap file at the end of the sprint | Always |
| Screenshot pictures | Pixels, compared locally | When `screenshots` is set |
| Your pages (capture) | Screenshots of the URLs you list, in a local browser | Only with `screenshots.source: capture` |
| The GitHub API | Title and description of the pull request behind each commit | Only when `GITHUB_TOKEN` or `GH_TOKEN` is set (always in GitHub Actions), and `github.pullRequests` isn't `false` |
| A usage file | The numbers you put in it | When `usage` is set |

It needs **read access** to the repository only. It writes nothing to git and never pushes.

## What it sends, and where

Each run makes two or three calls to **one** AI provider: the one in `model.provider`, with the key from your environment.

| Call | Gets |
|---|---|
| Writer | Your product description, audience and rules from the config; the commit log described above (up to `model.maxInputChars`); the names of screens |
| Second reader | Only the text of the slides |
| Rewrite (when the reader flagged lines) | The text of the slides and the flagged lines |

**Never sent:** source code, diffs, file contents, screenshots or other pictures, usage numbers, environment variables, secrets.

Commit and pull request text is treated as untrusted: it's wrapped in random markers and the model is told it's data, so a commit message that says "ignore your instructions" is just a commit message. Whatever the model answers goes through checks in code, and anything that can't be traced to a real commit is dropped.

### Keeping things out

- **Sensitive commits:** `ignore` patterns skip matching commits entirely; they're never sent.
- **Customer or internal names:** `replace` rewrites words in the output; for the input, `ignore` the commits or keep names out of commit messages.
- **No pull request text:** `github: { pullRequests: false }`, or run without a token.
- **Less of the log:** `model.maxInputChars`.

### Where the data goes, per provider

Data handling follows **your** agreement with the provider you pick. sprint-review adds nothing in between.

| Provider | Data goes to | Notes |
|---|---|---|
| `anthropic` (default) | Anthropic API | API data isn't used for training by default; check your plan's terms |
| `openai` | OpenAI API | |
| `azure` | Your Azure OpenAI resource | Stays in your Azure tenant and region |
| `bedrock` | Amazon Bedrock in your AWS account and region | Uses your AWS credentials or a Bedrock API key |
| `openrouter`, `gemini`, `mistral` | That service | |
| `ollama`, `lmstudio` | A model on your own machine or server | **Nothing leaves your network** |

## Keys and secrets

- Keys are read from **environment variables only**, never from the config file, so the config can be committed safely.
- In CI, keep keys in your CI's secret store (GitHub: repository or organization secrets).
- Keys are only sent to the provider they belong to, in an HTTP header. They're never written to a file or a log.

## The outputs

`deck.html`, `review.json`, `review.md` and `checks.md` (and `deck.pptx`) are written to a local folder. They contain what's on the slides, plus screenshots if you configured them. **Nothing is published on its own:** sharing the deck is a step you take (an artifact, GitHub Pages, Slack).

The deck is a single file with no outside requests: no fonts, scripts, images or trackers are loaded from anywhere.

## The local editor

`sprint-review edit` starts a web server on `127.0.0.1` only, so it can't be reached from other machines. Every request must carry a random token that only the page it opened knows, so other websites in your browser can't read or change the review. It stops when you press Ctrl+C.

## The MCP server

`sprint-review mcp` talks over stdio with the client that started it (Claude Code, Cursor…). It doesn't open a network port. Its tools read the git history and write the outputs in the folder you point it at; the model call uses the same provider and key as the CLI.

## Dependencies

Two runtime dependencies, `sharp` (image comparison) and `yaml` (the config), plus `pptxgenjs` as an optional one for PowerPoint export, which you install yourself. A plain install has no known vulnerabilities; with `pptxgenjs`, `npm audit` reports `image-size`, which `pptxgenjs` lists but never calls ([how to clear it](editing.md#powerpoint)). Playwright is only needed if you use `capture`, and you install it yourself. HTTP calls use Node's built-in `fetch`. Releases are published to npm with [provenance](https://docs.npmjs.com/generating-provenance-statements), so you can verify a package was built from this repository.

## Reporting a vulnerability

See [SECURITY.md](../SECURITY.md).
