import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { Config } from './config.ts';
import { History } from './history.ts';

export interface DoctorLine {
  ok: boolean;
  text: string;
  fix?: string;
}

/** Everything that has to be right before generate can work, as a list the CLI and the MCP server both show. */
export async function doctorChecks(config: Config, cwd = process.cwd(), env = process.env): Promise<DoctorLine[]> {
  const lines: DoctorLine[] = [];
  const add = (ok: boolean, text: string, fix?: string) => lines.push({ ok, text, ...(ok || !fix ? {} : { fix }) });
  try {
    new History(config.repo).assertUsable();
    add(true, `Git history readable in ${relative(cwd, config.repo) || '.'}`);
  } catch (e) {
    add(false, (e as Error).message, 'Run inside a git repository, or set repo in the config.');
  }
  const s = config.screenshots;
  if (s.source === 'folder') add(existsSync(resolve(config.root, s.before)) && existsSync(resolve(config.root, s.after)), 'Screenshot folders exist', 'Check screenshots.before and screenshots.after.');
  if (s.source === 'capture') {
    let playwright = false;
    try {
      await import('playwright' as string);
      playwright = true;
    } catch {}
    add(playwright, 'Playwright is installed for screenshots', 'npm install --save-dev playwright && npx playwright install chromium');
  }
  if (config.output.pptx) {
    let pptx = false;
    try {
      await import('pptxgenjs' as string);
      pptx = true;
    } catch {}
    add(pptx, 'pptxgenjs is installed for PowerPoint export', 'npm install --save-dev pptxgenjs');
  }
  if (config.brand.logo && !config.brand.logo.startsWith('data:')) add(existsSync(resolve(config.root, config.brand.logo)), 'Logo file exists', `Check brand.logo: ${config.brand.logo}`);
  if (config.brand.from) add(existsSync(resolve(config.root, config.brand.from)), 'Brand presentation exists', `Check brand.from: ${config.brand.from}`);
  if (config.model.provider === 'openai') add(!!env.OPENAI_API_KEY, 'OPENAI_API_KEY is set', 'Create a key at https://platform.openai.com/api-keys and export OPENAI_API_KEY=...');
  else add(!!env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY is set', 'Create a key at https://console.anthropic.com and export ANTHROPIC_API_KEY=...');
  if (config.slack) add(!!env.SLACK_WEBHOOK_URL, 'SLACK_WEBHOOK_URL is set', 'Create an incoming webhook in Slack and export SLACK_WEBHOOK_URL=...');
  const token = env.GITHUB_TOKEN || env.GH_TOKEN;
  if (config.github.pullRequests === 'on') add(!!token, 'GITHUB_TOKEN is set for pull requests', 'Export GITHUB_TOKEN, or set github.pullRequests: auto.');
  const major = Number(process.versions.node.split('.')[0]);
  add(major >= 20, `Node ${process.versions.node}`, 'sprint-review needs Node 20 or newer.');
  return lines;
}
