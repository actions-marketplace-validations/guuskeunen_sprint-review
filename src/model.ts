export interface ToolSpec {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ModelRequest {
  system: string;
  messages: string[];
  tool: ToolSpec;
  maxTokens: number;
}

export interface ModelAnswer {
  toolInput: Record<string, unknown> | null;
  model: string;
  usage: { input: number; output: number };
}

/** What the writer needs from a model. Swap it for a fake in tests, or for another provider. */
export interface ModelClient {
  ask(request: ModelRequest): Promise<ModelAnswer>;
}

export class ModelError extends Error {}

const API = 'https://api.anthropic.com/v1/messages';
const TIMEOUT_MS = 180_000;
const RETRIES = 3;

/** The Anthropic Messages API, forced to answer through one tool, with retries and a fallback model. */
export class AnthropicClient implements ModelClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fallback: string | null;
  private readonly fetchImpl: typeof fetch;

  constructor(apiKey: string, model: string, fallback: string | null, fetchImpl: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.model = model;
    this.fallback = fallback;
    this.fetchImpl = fetchImpl;
    if (!apiKey) throw new ModelError('ANTHROPIC_API_KEY is not set. Create a key at https://console.anthropic.com and set it as an environment variable (in GitHub: a repository secret).');
  }

  async ask(request: ModelRequest): Promise<ModelAnswer> {
    try {
      return await this.call(this.model, request);
    } catch (e) {
      if (!this.fallback || this.fallback === this.model || (e instanceof ModelError && /401|403|invalid x-api-key/i.test(e.message))) throw e;
      return this.call(this.fallback, request);
    }
  }

  private async call(model: string, request: ModelRequest): Promise<ModelAnswer> {
    const body = JSON.stringify({
      model,
      max_tokens: request.maxTokens,
      system: request.system,
      messages: [{ role: 'user', content: request.messages.map((text) => ({ type: 'text', text })) }],
      tools: [request.tool],
      tool_choice: { type: 'tool', name: request.tool.name },
    });
    let last: unknown;
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      try {
        const res = await this.fetchImpl(API, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
          body,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const text = await res.text();
        if (!res.ok) {
          const err = new ModelError(`Anthropic API ${res.status}: ${text.slice(0, 300)}`);
          if (res.status === 429 || res.status >= 500) {
            last = err;
            await sleep(retryAfter(res) ?? 2 ** attempt * 2000);
            continue;
          }
          throw err;
        }
        const data = JSON.parse(text) as { content?: { type: string; name?: string; input?: unknown }[]; model?: string; usage?: { input_tokens?: number; output_tokens?: number } };
        const block = data.content?.find((b) => b.type === 'tool_use' && b.name === request.tool.name);
        return {
          toolInput: block && typeof block.input === 'object' && block.input !== null ? (block.input as Record<string, unknown>) : null,
          model: data.model ?? model,
          usage: { input: data.usage?.input_tokens ?? 0, output: data.usage?.output_tokens ?? 0 },
        };
      } catch (e) {
        if (e instanceof ModelError && !/Anthropic API (429|5\d\d)/.test(e.message)) throw e;
        last = e;
        if (attempt < RETRIES - 1) await sleep(2 ** attempt * 2000);
      }
    }
    throw last instanceof Error ? last : new ModelError(String(last));
  }
}

function retryAfter(res: Response): number | null {
  const v = Number(res.headers.get('retry-after'));
  return Number.isFinite(v) && v > 0 ? Math.min(v, 60) * 1000 : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const OPENAI_API = 'https://api.openai.com/v1/chat/completions';

/**
 * OpenAI's Chat Completions API, forced to answer through one function. Same retries and
 * fallback as the Anthropic client. Set OPENAI_BASE_URL for a compatible endpoint (Azure, a proxy).
 */
export class OpenAIClient implements ModelClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fallback: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly url: string;

  constructor(apiKey: string, model: string, fallback: string | null, fetchImpl: typeof fetch = fetch, baseUrl = process.env.OPENAI_BASE_URL) {
    this.apiKey = apiKey;
    this.model = model;
    this.fallback = fallback;
    this.fetchImpl = fetchImpl;
    this.url = baseUrl ? `${baseUrl.replace(/\/+$/, '')}/chat/completions` : OPENAI_API;
    if (!apiKey) throw new ModelError('OPENAI_API_KEY is not set. Create a key at https://platform.openai.com/api-keys and set it as an environment variable.');
  }

  async ask(request: ModelRequest): Promise<ModelAnswer> {
    try {
      return await this.call(this.model, request);
    } catch (e) {
      if (!this.fallback || this.fallback === this.model || (e instanceof ModelError && /OpenAI API (401|403)/.test(e.message))) throw e;
      return this.call(this.fallback, request);
    }
  }

  private async call(model: string, request: ModelRequest): Promise<ModelAnswer> {
    const body = JSON.stringify({
      model,
      max_completion_tokens: request.maxTokens,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.messages.join('\n\n') },
      ],
      tools: [{ type: 'function', function: { name: request.tool.name, description: request.tool.description, parameters: request.tool.input_schema } }],
      tool_choice: { type: 'function', function: { name: request.tool.name } },
    });
    let last: unknown;
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      try {
        const res = await this.fetchImpl(this.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
          body,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const text = await res.text();
        if (!res.ok) {
          const err = new ModelError(`OpenAI API ${res.status}: ${text.slice(0, 300)}`);
          if (res.status === 429 || res.status >= 500) {
            last = err;
            await sleep(retryAfter(res) ?? 2 ** attempt * 2000);
            continue;
          }
          throw err;
        }
        const data = JSON.parse(text) as {
          choices?: { message?: { tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
          model?: string;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const call = data.choices?.[0]?.message?.tool_calls?.find((t) => t.function?.name === request.tool.name);
        let input: Record<string, unknown> | null = null;
        try {
          const parsed = call?.function?.arguments ? (JSON.parse(call.function.arguments) as unknown) : null;
          input = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
        } catch {
          input = null;
        }
        return { toolInput: input, model: data.model ?? model, usage: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 } };
      } catch (e) {
        if (e instanceof ModelError && !/OpenAI API (429|5\d\d)/.test(e.message)) throw e;
        last = e;
        if (attempt < RETRIES - 1) await sleep(2 ** attempt * 2000);
      }
    }
    throw last instanceof Error ? last : new ModelError(String(last));
  }
}

/** The client for the configured provider, with its key from the environment. */
export function clientFor(config: { provider: 'anthropic' | 'openai'; name: string; fallback: string | null }, env = process.env): ModelClient {
  return config.provider === 'openai'
    ? new OpenAIClient(env.OPENAI_API_KEY ?? '', config.name, config.fallback)
    : new AnthropicClient(env.ANTHROPIC_API_KEY ?? '', config.name, config.fallback);
}
