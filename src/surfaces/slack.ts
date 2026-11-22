import type { Review } from '../types.ts';

/** Slack's mrkdwn needs &, < and > escaped. */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The message: title, the summary points, one line per theme, and a link to the deck when there is one. */
export function slackMessage(review: Review, deckUrl: string | null): Record<string, unknown> {
  const blocks: Record<string, unknown>[] = [
    { type: 'header', text: { type: 'plain_text', text: review.title.slice(0, 150) } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: esc([review.product, review.period].filter(Boolean).join(' · ')) }] },
  ];
  if (review.summary.length) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: review.summary.map((p) => `• ${esc(p.text)}`).join('\n') } });
  if (review.themes.length) {
    blocks.push({ type: 'divider' });
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: review.themes.map((t) => `*${esc(t.title)}*${t.effect ? ` · ${esc(t.effect)}` : ''}`).join('\n') } });
  }
  if (deckUrl) blocks.push({ type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Open the deck' }, url: deckUrl, style: 'primary' }] });
  return { text: review.title, blocks };
}

/** Post to an incoming webhook. Throws with Slack's answer when it refuses. */
export async function postToSlack(webhook: string, review: Review, deckUrl: string | null, fetchImpl: typeof fetch = fetch): Promise<void> {
  if (!/^https:\/\/hooks\.slack\.com\//.test(webhook)) throw new Error('SLACK_WEBHOOK_URL must be a Slack incoming webhook (https://hooks.slack.com/...).');
  const res = await fetchImpl(webhook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(slackMessage(review, deckUrl)), signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Slack said ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
