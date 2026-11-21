import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../../src/config.ts';
import { OpenAIClient, AnthropicClient } from '../../src/ai/model.ts';
import { clientFor } from '../../src/ai/providers.ts';

function response(status: number, body: unknown): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('the OpenAI client forces the function and reads its arguments', async () => {
  let sent: any;
  const fake = (async (_url: string, init: RequestInit) => {
    sent = JSON.parse(String(init.body));
    return response(200, { model: 'gpt-x', usage: { prompt_tokens: 10, completion_tokens: 5 }, choices: [{ message: { tool_calls: [{ function: { name: 'presentation', arguments: '{"summary":[]}' } }] } }] });
  }) as unknown as typeof fetch;
  const client = new OpenAIClient('key', 'gpt-x', null, fake);
  const answer = await client.ask({ system: 'sys', messages: ['a', 'b'], tool: { name: 'presentation', description: 'd', input_schema: { type: 'object' } }, maxTokens: 100 });
  assert.deepEqual(answer.toolInput, { summary: [] });
  assert.deepEqual(answer.usage, { input: 10, output: 5 });
  assert.equal(sent.tool_choice.function.name, 'presentation');
  assert.equal(sent.messages[0].role, 'system');
});

test('the provider picks the client and the key', () => {
  assert.ok(clientFor({ provider: 'anthropic', name: 'm', fallback: null }, { ANTHROPIC_API_KEY: 'k' }) instanceof AnthropicClient);
  assert.ok(clientFor({ provider: 'openai', name: 'm', fallback: null }, { OPENAI_API_KEY: 'k' }) instanceof OpenAIClient);
  assert.throws(() => clientFor({ provider: 'openai', name: 'm', fallback: null }, {}), /OPENAI_API_KEY/);
  assert.throws(() => normalize({ model: { provider: 'openai' } }, '/tmp'), /model.name is required/);
});
