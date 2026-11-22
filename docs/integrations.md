# Integrations

sprint-review is a command-line tool first. Everything else here builds on it.

## The Claude Code plugin

The skill and the MCP server in one install:

```
/plugin marketplace add guuskeunen/sprint-review
/plugin install sprint-review@sprint-review
```

Then ask Claude Code for a sprint review, or type `/sprint-review`. The plugin runs `npx @guuskeunen/sprint-review@0 mcp`, so it picks up new releases by itself. Set your API key in the environment Claude Code starts from.

## Claude Code, Cursor and other MCP clients

`sprint-review mcp` runs an [MCP](https://modelcontextprotocol.io) server over stdio. An AI assistant in your editor can then check the setup, preview a sprint's commits, write the review and rebuild it after an edit, and tell you what the checks did.

**Claude Code**

```bash
claude mcp add sprint-review -- npx -y @guuskeunen/sprint-review mcp
```

**Cursor, Windsurf, Claude Desktop and others** (their MCP config file):

```json
{
  "mcpServers": {
    "sprint-review": {
      "command": "npx",
      "args": ["-y", "@guuskeunen/sprint-review", "mcp"],
      "env": { "ANTHROPIC_API_KEY": "sk-ant-..." }
    }
  }
}
```

Then ask: *"Make our sprint review for the last two weeks"*, or *"What would the sprint review read for v1.4.0 to v1.5.0?"*.

| Tool | Does |
|---|---|
| `check_sprint_review_setup` | Runs the same checks as `doctor`. |
| `preview_sprint_commits` | Lists the commits for a range, without a model call. |
| `generate_sprint_review` | Writes the deck and returns the paths, the themes and every check. |
| `render_sprint_review` | Rebuilds the deck from an edited `review.json`. |

Every tool takes `directory` (the project folder; default where the server started) and the range arguments `since`, `until`, `from` and `to`.

## The Claude Code skill on its own

[`skills/sprint-review/SKILL.md`](../skills/sprint-review/SKILL.md) teaches Claude Code the workflow: check, preview, generate, report the checks, edit. The plugin includes it; without the plugin, copy the folder into your project's `.claude/skills/` (or `~/.claude/skills/` for all projects).

## Pull request descriptions

Commit subjects say *what*; pull requests often say *why*. With `GITHUB_TOKEN` or `GH_TOKEN` set, the title and description of the pull request behind each commit go to the writer as extra context. In GitHub Actions this is on by default. Locally:

```bash
GITHUB_TOKEN=$(gh auth token) npx @guuskeunen/sprint-review
```

See [`github`](configuration.md#github) for the options. Pull request text is treated as untrusted input, like commit messages: wrapped and marked as data in the prompt.

## Other models

Claude by default; Bedrock, Azure OpenAI, OpenAI, OpenRouter, Gemini, Mistral, and local models with Ollama or LM Studio are a config line away. See [models and providers](models.md) for setup and an honest table of what's been tested.

## Slack

```bash
export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
npx @guuskeunen/sprint-review --slack --deck-url https://acme.github.io/spoke/review/
```

Or `slack: true` in the config. See [posting to Slack from CI](github-action.md#posting-to-slack).

## GitLab, Bitbucket, Jenkins…

Anywhere with Node 22 and a git history that reaches back to before the sprint: `npx --yes @guuskeunen/sprint-review generate --json`. A GitLab job is in [`examples/gitlab-ci.yml`](../examples/gitlab-ci.yml).

## As a library

All of it is importable from TypeScript or JavaScript. See [the library guide](library.md).
