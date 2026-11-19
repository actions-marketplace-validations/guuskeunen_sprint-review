// Writes docs/llms-full.txt: the README and every doc in one plain file, for AI assistants and search agents.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const files = [
  'README.md',
  'docs/getting-started.md',
  'docs/configuration.md',
  'docs/screenshots.md',
  'docs/github-action.md',
  'docs/editing.md',
  'docs/integrations.md',
  'docs/how-it-works.md',
  'docs/library.md',
  'docs/troubleshooting.md',
  'docs/faq.md',
  'docs/guides/how-to-run-a-sprint-review.md',
  'docs/guides/sprint-review-template.md',
];
const strip = (md: string) => md.replace(/<p align="center">[\s\S]*?<\/p>\n*/g, '').replace(/<picture>[\s\S]*?<\/picture>/g, '');
const out = [readFileSync(`${root}docs/llms.txt`, 'utf8'), ...files.map((f) => `\n\n---\n\n<!-- ${f} -->\n\n${strip(readFileSync(root + f, 'utf8')).trim()}`)].join('');
writeFileSync(`${root}docs/llms-full.txt`, out + '\n');
console.log(`Wrote docs/llms-full.txt (${Math.round(out.length / 1024)} kB)`);
