# Models and providers

sprint-review works with any model that can answer in a fixed JSON shape. Claude is the default because it writes the best slides; the others are there for choice, cost and privacy.

## Which to pick

| Situation | Use |
|---|---|
| Best slides, simplest setup | `anthropic` (default), Claude Opus with Sonnet as fallback |
| Your company already has Claude through AWS | `bedrock` |
| Your company already has Azure OpenAI | `azure` |
| One key for many models, or comparing them | `openrouter` |
| Nothing may leave your network | `ollama` or `lmstudio` |

## Tested models

What "tested" means here, honestly:

- **Verified:** run end to end against the real service with this version. Nothing is marked verified yet: this table fills in as real runs come in.
- **Code tested:** the request and answer handling are covered by the test suite against recorded or fake responses, but not yet run against the live service. These should work; please [report how it went](https://github.com/guuskeunen/sprint-review/issues/new?title=Model%20report:%20).

| Provider | Model | Status | Quality of the slides |
|---|---|---|---|
| `anthropic` | `claude-opus-5-5` | The default: the prompts were developed on it | Best: clear themes, good effect sentences |
| `anthropic` | `claude-sonnet-5-5` | The fallback | Very good, cheaper and faster |
| `bedrock` | Claude through Bedrock | Code tested; request signing checked against AWS's official test vector | Same as Claude directly |
| `openai`, `azure` | Your GPT model | Code tested | Expected good |
| `openrouter` | Any | Code tested | Depends on the model |
| `gemini` | Gemini models | Code tested | Expected good |
| `mistral` | Mistral models | Code tested | Expected decent |
| `ollama`, `lmstudio` | Qwen, Llama, Mistral and others, 30B+ recommended | Code tested | Works, but plainer: fewer and flatter themes |

Whatever the model, every answer goes through the same checks: a point that can't be traced to a real commit is dropped, word limits hold, tooling goes under the hood. A weaker model gives a plainer deck, not a wrong one.

Tried a model? Open an issue with the provider, model and how the deck read, and it goes in this table.

## Setup per provider

Keys always come from environment variables, never from the config.

### Anthropic (default)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

No config needed. To pick another model: `model: { name: claude-sonnet-5-5 }`.

### Amazon Bedrock

```yaml
model:
  provider: bedrock
  name: us.anthropic.claude-opus-5-5-v1:0   # your model or inference profile id, from the Bedrock console
  region: eu-central-1                      # or set AWS_REGION
```

Credentials, one of:

- a **Bedrock API key**: `export AWS_BEARER_TOKEN_BEDROCK=...` (simplest; create one in the Bedrock console)
- **AWS access keys**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and, for temporary credentials, `AWS_SESSION_TOKEN`. This is what `aws-actions/configure-aws-credentials` sets in GitHub Actions, so OIDC roles work.

Your account needs access to the model in that region (Bedrock console → Model access).

### OpenAI

```yaml
model: { provider: openai, name: gpt-5.1 }
```

```bash
export OPENAI_API_KEY=sk-...
```

### Azure OpenAI

```yaml
model:
  provider: azure
  name: my-deployment                                   # your deployment name
  baseUrl: https://my-resource.openai.azure.com/openai/v1
```

```bash
export AZURE_OPENAI_API_KEY=...
```

### OpenRouter

```yaml
model: { provider: openrouter, name: anthropic/claude-sonnet-5.5 }
```

```bash
export OPENROUTER_API_KEY=sk-or-...
```

### Google Gemini

```yaml
model: { provider: gemini, name: gemini-3-pro }
```

```bash
export GEMINI_API_KEY=...
```

### Mistral

```yaml
model: { provider: mistral, name: mistral-large-latest }
```

```bash
export MISTRAL_API_KEY=...
```

### Ollama (local)

```bash
ollama pull qwen3:32b
OLLAMA_CONTEXT_LENGTH=32768 ollama serve     # a large context window matters
```

```yaml
model: { provider: ollama, name: "qwen3:32b" }
```

No key needed. Run `sprint-review doctor` to check that Ollama answers and the model is there.

### LM Studio (local)

Load a model, start the server (Developer tab), then:

```yaml
model: { provider: lmstudio, name: qwen3-32b }
```

### Any other OpenAI-compatible endpoint

A gateway, vLLM, LiteLLM, Groq, Together, DeepSeek…

```yaml
model:
  provider: openai
  name: the-model
  baseUrl: https://my-gateway.example.com/v1
```

## Settings for smaller and local models

| Setting | What it does |
|---|---|
| `model.mode: json` | Ask for JSON matching the schema instead of forcing a tool call. The default for Ollama and LM Studio; try it for any server whose tool calling is unreliable. |
| `model.maxInputChars` | How much of the commit log the model gets. Default 120,000 characters, 24,000 for local models. Commits past it are listed in `checks.md`. |
| `model.maxTokens` | Room for the answer. Default 8,000. |
| `model.fallback` | A second model when the first fails. Default Sonnet for Anthropic, none for others. |

If a model answers in text instead of through the tool, sprint-review looks for the JSON in its answer and checks it like any other. Local models are slow: a run can take several minutes.
