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

/**
 * The answer as JSON when a model wrote it as text instead of through the tool: the whole text,
 * a fenced block, or the outermost object in it. Whatever comes out still goes through every check.
 */
export function extractJson(text: string | null | undefined): Record<string, unknown> | null {
  if (!text) return null;
  const tries = [text.trim()];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced?.[1]) tries.push(fenced[1].trim());
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) tries.push(text.slice(start, end + 1));
  for (const t of tries) {
    try {
      const v = JSON.parse(t) as unknown;
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch {}
  }
  return null;
}

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
        const answerText = data.content?.filter((b) => b.type === 'text').map((b) => (b as { text?: string }).text ?? '').join('\n') ?? '';
        return {
          toolInput: block && typeof block.input === 'object' && block.input !== null ? (block.input as Record<string, unknown>) : extractJson(answerText),
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


/** How an OpenAI-compatible endpoint is called. Presets for known services are in providers.ts. */
export interface CompatibleOptions {
  /** Base URL up to /v1 (or the service's equivalent). */
  baseUrl?: string;
  /** tools: forced function call. json: ask for JSON matching the schema, for servers that don't force tools well. */
  mode?: 'tools' | 'json';
  /** How the one tool is forced: the OpenAI object form, or "required"/"any" for services that only take a word. */
  toolChoice?: 'function' | 'required' | 'any';
  /** Header for the key: Authorization: Bearer (default) or Azure's api-key. */
  keyHeader?: 'bearer' | 'api-key';
  /** A key is not needed for local servers. */
  keyRequired?: boolean;
  /** Name in error messages. */
  label?: string;
  /** The environment variable for the key, for the error message. */
  keyEnv?: string;
  timeoutMs?: number;
}

const OPENAI_API = 'https://api.openai.com/v1';

/**
 * OpenAI's Chat Completions API and everything that speaks it: OpenRouter, Gemini, Mistral, Azure,
 * Ollama, LM Studio. Forced to answer through one function, with the same retries and fallback
 * as the Anthropic client. A model that answers in text instead still works: the JSON is taken
 * from the text, and checked like any other answer.
 */
export class OpenAIClient implements ModelClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fallback: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly url: string;
  private readonly options: Required<Omit<CompatibleOptions, 'baseUrl'>>;

  constructor(apiKey: string, model: string, fallback: string | null, fetchImpl: typeof fetch = fetch, baseUrl = process.env.OPENAI_BASE_URL, options: Omit<CompatibleOptions, 'baseUrl'> = {}) {
    this.apiKey = apiKey;
    this.model = model;
    this.fallback = fallback;
    this.fetchImpl = fetchImpl;
    this.url = `${(baseUrl || OPENAI_API).replace(/\/+$/, '')}/chat/completions`;
    this.options = {
      mode: options.mode ?? 'tools',
      toolChoice: options.toolChoice ?? 'function',
      keyHeader: options.keyHeader ?? 'bearer',
      keyRequired: options.keyRequired ?? true,
      label: options.label ?? 'OpenAI',
      keyEnv: options.keyEnv ?? 'OPENAI_API_KEY',
      timeoutMs: options.timeoutMs ?? TIMEOUT_MS,
    };
    if (!apiKey && this.options.keyRequired) throw new ModelError(`${this.options.keyEnv} is not set. Set it as an environment variable with your ${this.options.label} API key.`);
  }

  async ask(request: ModelRequest): Promise<ModelAnswer> {
    try {
      return await this.call(this.model, request);
    } catch (e) {
      if (!this.fallback || this.fallback === this.model || (e instanceof ModelError && / API (401|403)/.test(e.message))) throw e;
      return this.call(this.fallback, request);
    }
  }

  private body(model: string, request: ModelRequest): string {
    const { mode, toolChoice } = this.options;
    if (mode === 'json') {
      // No tools: the schema goes in the prompt and, for servers that support it, in response_format.
      return JSON.stringify({
        model,
        max_tokens: request.maxTokens,
        messages: [
          { role: 'system', content: `${request.system}\n\n${request.tool.description}\nAnswer with one JSON object and nothing else. It must match this JSON schema:\n${JSON.stringify(request.tool.input_schema)}` },
          { role: 'user', content: request.messages.join('\n\n') },
        ],
        response_format: { type: 'json_schema', json_schema: { name: request.tool.name, schema: request.tool.input_schema, strict: false } },
      });
    }
    return JSON.stringify({
      model,
      max_completion_tokens: request.maxTokens,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.messages.join('\n\n') },
      ],
      tools: [{ type: 'function', function: { name: request.tool.name, description: request.tool.description, parameters: request.tool.input_schema } }],
      tool_choice: toolChoice === 'function' ? { type: 'function', function: { name: request.tool.name } } : toolChoice,
    });
  }

  private async call(model: string, request: ModelRequest): Promise<ModelAnswer> {
    const body = this.body(model, request);
    const label = this.options.label;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.apiKey) {
      if (this.options.keyHeader === 'api-key') headers['api-key'] = this.apiKey;
      else headers.authorization = `Bearer ${this.apiKey}`;
    }
    let last: unknown;
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      try {
        const res = await this.fetchImpl(this.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(this.options.timeoutMs) });
        const text = await res.text();
        if (!res.ok) {
          const err = new ModelError(`${label} API ${res.status}: ${text.slice(0, 300)}`);
          if (res.status === 429 || res.status >= 500) {
            last = err;
            await sleep(retryAfter(res) ?? 2 ** attempt * 2000);
            continue;
          }
          throw err;
        }
        const data = JSON.parse(text) as {
          choices?: { message?: { content?: string | null; tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
          model?: string;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const message = data.choices?.[0]?.message;
        const call = message?.tool_calls?.find((t) => t.function?.name === request.tool.name) ?? message?.tool_calls?.[0];
        const input = extractJson(call?.function?.arguments) ?? extractJson(message?.content);
        return { toolInput: input, model: data.model ?? model, usage: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 } };
      } catch (e) {
        if (e instanceof ModelError && !new RegExp(`${label} API (429|5\\d\\d)`).test(e.message)) throw e;
        if (e instanceof Error && e.name === 'TypeError' && /fetch failed/.test(e.message)) {
          last = new ModelError(`Could not reach ${label} at ${this.url}. ${this.options.keyRequired ? 'Check your network.' : 'Is the server running?'}`);
        } else last = e;
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

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
