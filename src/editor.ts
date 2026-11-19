import { createServer, type IncomingMessage, type Server } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from './config.ts';
import type { Review } from './types.ts';
import { render } from './generate.ts';
import { writeOutputs } from './output.ts';
import { ICONS } from './icons-data.ts';
import { VALUE_KEYS } from './icons.ts';
import { labelsFor } from './i18n.ts';
import { EFFECT_WORDS_MAX, NOTES_WORDS_MAX, POINT_WORDS_MAX, TITLE_WORDS_MAX } from './writer.ts';

const PAGE = readFileSync(fileURLToPath(new URL('../assets/editor.html', import.meta.url)), 'utf8');
const MAX_BODY = 60 * 1024 * 1024;

export interface EditorServer {
  url: string;
  server: Server;
  close(): Promise<void>;
}

/**
 * A small editor for review.json on this computer: a form beside the live deck. It listens on
 * 127.0.0.1 only and every API call must carry a random token that only the opened page knows,
 * so other websites in the same browser can't read or change the review.
 */
export async function startEditor(file: string, config: Config, port = 4321): Promise<EditorServer> {
  const token = randomBytes(18).toString('base64url');
  const read = () => JSON.parse(readFileSync(file, 'utf8')) as Review;
  read(); // fail now, not in the browser, when the file is not JSON
  const t = labelsFor(config.language, config.labels);
  const boot = {
    token,
    file,
    icons: Object.entries(ICONS).map(([k, v]) => [k, v.label]),
    values: VALUE_KEYS.map((k) => [k, t[`value_${k}` as keyof typeof t]]),
    limits: { point: POINT_WORDS_MAX, effect: EFFECT_WORDS_MAX, notes: NOTES_WORDS_MAX, title: TITLE_WORDS_MAX },
  };
  const page = PAGE.replace('__BOOT__', JSON.stringify(boot).replace(/</g, '\\u003c'));

  const server = createServer(async (req, res) => {
    const send = (status: number, type: string, body: string) => {
      res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      res.end(body);
    };
    try {
      const host = req.headers.host ?? '';
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return send(403, 'text/plain', 'Wrong host.');
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname === '/favicon.ico') {
        res.writeHead(204).end();
        return;
      }
      if (url.pathname === '/' && req.method === 'GET') {
        return send(200, 'text/html; charset=utf-8', page);
      }
      if (!url.pathname.startsWith('/api/')) return send(404, 'text/plain', 'Not found.');
      if (req.headers['x-sprint-review-token'] !== token) return send(403, 'text/plain', 'Missing token.');

      if (url.pathname === '/api/review' && req.method === 'GET') return send(200, 'application/json', JSON.stringify(read()));
      if (url.pathname === '/api/preview' && req.method === 'POST') {
        const review = validReview(await body(req));
        return send(200, 'text/html; charset=utf-8', render(review, config).html);
      }
      if (url.pathname === '/api/review' && req.method === 'PUT') {
        const review = validReview(await body(req));
        await writeOutputs(review, config, dirname(file));
        return send(200, 'application/json', '{"ok":true}');
      }
      return send(404, 'text/plain', 'Not found.');
    } catch (e) {
      return send(400, 'text/plain', (e as Error).message);
    }
  });
  await new Promise<void>((ok, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', () => ok());
  });
  const address = server.address();
  const actual = typeof address === 'object' && address ? address.port : port;
  return { url: `http://127.0.0.1:${actual}/`, server, close: () => new Promise((ok) => server.close(() => ok())) };
}

function body(req: IncomingMessage): Promise<unknown> {
  return new Promise((ok, fail) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        fail(new Error('Too large.'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        ok(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        fail(new Error('Not JSON.'));
      }
    });
    req.on('error', fail);
  });
}

/** Enough of a check that a broken edit can't produce a broken deck. */
export function validReview(v: unknown): Review {
  const r = v as Review;
  const strings = (a: unknown) => Array.isArray(a) && a.every((x) => typeof x === 'string');
  if (!r || r.version !== 1) throw new Error('Not a review made by sprint-review.');
  if (typeof r.title !== 'string' || typeof r.period !== 'string') throw new Error('The review needs a title and a period.');
  if (!Array.isArray(r.summary) || !r.summary.every((p) => typeof p?.text === 'string')) throw new Error('Every summary point needs text.');
  if (!Array.isArray(r.themes) || !r.themes.every((t) => typeof t?.title === 'string' && strings(t.points))) throw new Error('Every theme needs a title and a list of points.');
  if (!strings(r.underTheHood)) throw new Error('Under the hood must be a list of lines.');
  for (const k of ['screens', 'milestones', 'usage', 'checks'] as const) if (!Array.isArray(r[k])) throw new Error(`${k} must be a list.`);
  return {
    ...r,
    summary: r.summary.filter((p) => p.text.trim()),
    themes: r.themes.map((t) => ({ ...t, points: t.points.filter((p) => p.trim()) })),
    underTheHood: r.underTheHood.filter((p) => p.trim()),
  };
}
