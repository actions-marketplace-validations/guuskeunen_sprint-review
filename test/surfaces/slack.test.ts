import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slackMessage, postToSlack } from '../../src/surfaces/slack.ts';
import { sample } from '../helpers.ts';

test('the Slack message has the headline, the themes and the link, escaped', async () => {
  const review = sample();
  review.headline = 'Tom & Jerry <script>';
  const msg = slackMessage(review, 'https://example.com/deck.html') as { blocks: any[] };
  const text = JSON.stringify(msg);
  assert.match(text, /Tom &amp; Jerry &lt;script&gt;/);
  assert.match(text, /Open the deck/);
  for (const t of review.themes) assert.ok(text.includes(t.title));
  await assert.rejects(postToSlack('https://evil.example.com/hook', review, null), /incoming webhook/);
  let posted = false;
  await postToSlack('https://hooks.slack.com/services/x', review, null, (async () => ((posted = true), new Response('ok'))) as unknown as typeof fetch);
  assert.ok(posted);
});
