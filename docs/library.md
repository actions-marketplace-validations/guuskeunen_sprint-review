# Using it as a library

Everything the CLI does is available from Node.

```bash
npm install @guuskeunen/sprint-review
```

```ts
import { writeFileSync } from 'node:fs';
import { AnthropicClient, generate, loadConfig } from '@guuskeunen/sprint-review';

const config = loadConfig('sprint-review.config.yml');
const model = new AnthropicClient(process.env.ANTHROPIC_API_KEY!, config.model.name, config.model.fallback);

const { review, html, markdown, usage } = await generate(config, {
  model,
  range: { kind: 'dates', from: '2026-11-03', until: '2026-11-16' },
  onStep: (message) => console.log(message),
});

writeFileSync('deck.html', html);
```

## Main functions

| Function | Does |
|---|---|
| `loadConfig(path?, cwd?)` | Reads and checks a config file, or finds the default one. |
| `normalize(object, root)` | Builds a config from a plain object, with every default filled in. |
| `generate(config, options)` | The whole pipeline. Returns `{ review, html, markdown, usage }`. |
| `render(review, config)` | Rebuilds `{ html, markdown }` from a stored review. |
| `sprintRange(days, until?)` | The range of the sprint that ends on a day. |
| `renderDeck(review, options)` | Just the deck, with `{ color, logo, labels, goal }`. |
| `renderMarkdown(review)`, `renderChecks(review)` | The Markdown summary and the check log. |
| `compareScreens(before, after, device, ignore)` | The screenshot comparison on its own. |
| `clean(text, maxWords, replace?)` | The text check on its own. |

## Ranges

```ts
{ kind: 'dates', from: '2026-11-03', until: '2026-11-16' }   // both days included
{ kind: 'refs', from: 'v1.4.0', to: 'HEAD' }                // what `to` has and `from` doesn't
```

## Your own model client

`generate` takes anything that implements `ModelClient`, so you can route calls through your own gateway, add logging, or test without an API:

```ts
import type { ModelClient } from '@guuskeunen/sprint-review';

const model: ModelClient = {
  async ask({ system, messages, tool, maxTokens }) {
    const input = await myGateway.callWithTool(system, messages, tool, maxTokens);
    return { toolInput: input, model: 'my-model', usage: { input: 0, output: 0 } };
  },
};
```

The model must answer through the given tool: `toolInput` is the tool's input object, or `null` when it gave none.

## Errors

All expected failures are their own class, with a message meant for people:

`ConfigError`, `GitError`, `ModelError`, `WriterError`, `NothingToReview`.

## Types

`Review`, `ReviewTheme`, `ReviewScreen`, `Commit`, `Check`, `Milestone`, `UsageMetric`, `Config` and more are exported as types.
