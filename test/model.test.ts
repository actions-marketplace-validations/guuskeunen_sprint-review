import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnthropicClient, ModelError } from '../src/model.ts';

const tool = { name: 'presentation', description: 'x', input_schema: { type: 'object' } };
const request = { system: 's', messages: ['m'], tool, maxTokens: 100 };

function fakeFetch(responses: { status: number; body: unknown }[]) {
  const calls: { model: string }[] = [];
  const impl = (async (_url: string, init: { body: string }) => {
    calls.push({ model: (JSON.parse(init.body) as { model: string }).model });
    const r = responses.shift() ?? { status: 500, body: {} };
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'retry-after': '0.01' } });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const ok = (model: string) => ({
  status: 200,
  body: { model, content: [{ type: 'tool_use', name: 'presentation', input: { themes: [] } }], usage: { input_tokens: 10, output_tokens: 5 } },
});

test('reads the tool answer and the usage', async () => {
  const f = fakeFetch([ok('m1')]);
  const answer = await new AnthropicClient('key', 'm1', null, f.impl).ask(request);
  assert.deepEqual(answer.toolInput, { themes: [] });
  assert.deepEqual(answer.usage, { input: 10, output: 5 });
});

test('retries an overloaded API, then falls back to the second model', async () => {
  const f = fakeFetch([{ status: 529, body: {} }, { status: 529, body: {} }, { status: 529, body: {} }, ok('m2')]);
  const answer = await new AnthropicClient('key', 'm1', 'm2', f.impl).ask(request);
  assert.equal(answer.model, 'm2');
  assert.deepEqual(f.calls.map((c) => c.model), ['m1', 'm1', 'm1', 'm2']);
});

test('a bad key fails at once, without the fallback', async () => {
  const f = fakeFetch([{ status: 401, body: { error: { message: 'invalid x-api-key' } } }]);
  await assert.rejects(new AnthropicClient('key', 'm1', 'm2', f.impl).ask(request), ModelError);
  assert.equal(f.calls.length, 1);
});

test('no key is a clear error', () => {
  assert.throws(() => new AnthropicClient('', 'm1', null), /ANTHROPIC_API_KEY is not set/);
});

test('Claude is asked to call the tool, not forced: current Claude models refuse forced tool use', async () => {
  const sent: { tool_choice?: unknown; system?: string }[] = [];
  const impl = (async (_url: string, init: { body: string }) => {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify(ok('m1').body), { status: 200 });
  }) as unknown as typeof fetch;
  await new AnthropicClient('key', 'claude-opus-5-5', null, impl).ask(request);
  assert.deepEqual(sent[0]!.tool_choice, { type: 'auto' });
  assert.match(sent[0]!.system!, /calling the presentation tool/);
});

test('a list the model sent as JSON text is read as a list', async () => {
  const body = { model: 'm1', content: [{ type: 'tool_use', name: 'presentation', input: { summary: [{ text: 'a' }], themes: '[{"title":"T","points":[]}]', note: 'plain text stays text' } }], usage: {} };
  const impl = (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
  const answer = await new AnthropicClient('key', 'm1', null, impl).ask(request);
  assert.deepEqual(answer.toolInput, { summary: [{ text: 'a' }], themes: [{ title: 'T', points: [] }], note: 'plain text stays text' });
});

test('Claude gets the tool in strict mode, so its arguments always match the schema', async () => {
  const sent: { tools?: { strict?: boolean }[] }[] = [];
  const impl = (async (_url: string, init: { body: string }) => {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify(ok('m1').body), { status: 200 });
  }) as unknown as typeof fetch;
  await new AnthropicClient('key', 'claude-sonnet-5-5', null, impl).ask(request);
  assert.equal(sent[0]!.tools![0]!.strict, true);
});

test('an answer cut off at maxTokens is an error even with a half-written tool call', async () => {
  const body = { model: 'm1', stop_reason: 'max_tokens', content: [{ type: 'thinking', thinking: '' }, { type: 'tool_use', name: 'presentation', input: {} }], usage: {} };
  const impl = (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
  await assert.rejects(new AnthropicClient('key', 'm1', null, impl).ask(request), /cut off/);
});
