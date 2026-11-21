import type { Commit } from './types.ts';
import type { History } from './history.ts';

const API = 'https://api.github.com';
const MAX_LOOKUPS = 150;

/** owner/name from GITHUB_REPOSITORY, or from the origin remote when it points at github.com. */
export function githubRepo(history: History, configured: string | null, env = process.env): string | null {
  if (configured) return configured;
  if (env.GITHUB_REPOSITORY) return env.GITHUB_REPOSITORY;
  const url = history.git(['remote', 'get-url', 'origin'], true).trim();
  const m = url.match(/github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/**
 * Adds the pull request each commit came in with. A team's PR descriptions often say why a
 * change was made, which a commit subject rarely does. One request per pull request found, at
 * most MAX_LOOKUPS commits; any failure leaves the commits as they were, so this never breaks
 * a run. PR text is treated as untrusted, like the commits themselves.
 */
export async function withPullRequests(
  commits: Commit[],
  repo: string,
  token: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<{ commits: Commit[]; found: number }> {
  const headers: Record<string, string> = { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'sprint-review' };
  if (token) headers.authorization = `Bearer ${token}`;
  const byNumber = new Map<number, { number: number; title: string; body: string }>();
  const out: Commit[] = [];
  let lookups = 0;
  let failed = false;
  for (const c of commits) {
    if (failed || lookups >= MAX_LOOKUPS || !c.product) {
      out.push(c);
      continue;
    }
    lookups++;
    try {
      const res = await fetchImpl(`${API}/repos/${repo}/commits/${c.hash}/pulls`, { headers, signal: AbortSignal.timeout(15_000) });
      if (!res.ok) {
        // 401/403/404 mean no access or no such repo: stop asking. Rate limits too.
        if ([401, 403, 404, 422, 429].includes(res.status)) failed = true;
        out.push(c);
        continue;
      }
      const list = (await res.json()) as { number?: number; title?: string; body?: string | null; merged_at?: string | null }[];
      // Merged pull requests only: an open one (maybe from a fork) is text anyone could write.
      const pr = Array.isArray(list) ? list.find((p) => p.merged_at) : undefined;
      if (pr && typeof pr.number === 'number' && typeof pr.title === 'string') {
        const seen = byNumber.get(pr.number);
        // The description goes with the first commit of a pull request only, to keep the log short.
        const entry = seen ? { number: pr.number, title: pr.title, body: '' } : { number: pr.number, title: pr.title, body: pr.body ?? '' };
        byNumber.set(pr.number, entry);
        out.push({ ...c, pullRequest: entry });
      } else {
        out.push(c);
      }
    } catch {
      failed = true;
      out.push(c);
    }
  }
  return { commits: out, found: byNumber.size };
}
