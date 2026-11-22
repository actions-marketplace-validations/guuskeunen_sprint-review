// Runs the quality benchmark. Usage:
//   node scripts/bench.ts                       # the configured default (Claude), needs ANTHROPIC_API_KEY
//   node scripts/bench.ts --provider ollama --model qwen3:32b
//   node scripts/bench.ts --cases bike-shop,cli-library
//   node scripts/bench.ts --echo                # no API: checks the harness itself
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { EchoModel, loadCases, report, runCase, type Score } from '../bench/bench.ts';
import { normalize } from '../src/config.ts';
import { clientFor } from '../src/ai/providers.ts';

const { values } = parseArgs({ options: { provider: { type: 'string' }, model: { type: 'string' }, cases: { type: 'string' }, echo: { type: 'boolean' }, label: { type: 'string' } } });
const modelConfig: Record<string, unknown> = { ...(values.provider ? { provider: values.provider } : {}), ...(values.model ? { name: values.model } : {}), fallback: null };
const resolved = normalize({ model: modelConfig }, process.cwd()).model;
const model = values.echo ? new EchoModel() : clientFor(resolved);
const label = values.label ?? (values.echo ? 'echo (harness check)' : `${resolved.provider} ${resolved.name}`);
const cases = loadCases(values.cases ? values.cases.split(',') : []);

const scores: Score[] = [];
for (const c of cases) {
  process.stderr.write(`› ${c.name}… `);
  const started = Date.now();
  const { score } = await runCase(c, model, modelConfig);
  process.stderr.write(`${score.total}/100 (${((Date.now() - started) / 1000).toFixed(0)}s)\n`);
  scores.push(score);
}

const md = report(scores, label);
process.stdout.write(md);
if (!values.echo) {
  const dir = fileURLToPath(new URL('../bench/results/', import.meta.url));
  mkdirSync(dir, { recursive: true });
  const file = `${dir}${new Date().toISOString().slice(0, 10)}-${label.replace(/[^\w.-]+/g, '-')}.md`;
  writeFileSync(file, md);
  process.stderr.write(`\nSaved ${file}\n`);
}
