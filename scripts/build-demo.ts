// Builds the demo deck in docs/demo/ from the bike-shop fixture repo, without calling an AI:
// the content comes from the fake model the tests use. Run: node scripts/build-demo.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize } from '../src/config.ts';
import { generate } from '../src/generate.ts';
import { renderChecks } from '../src/markdown.ts';
import { demoRepo, FakeModel } from '../test/helpers.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = demoRepo();
const config = normalize(
  {
    product: { name: 'Spoke', description: 'the planning and customer app of Northside Cycles, a chain of bike repair shops' },
    organization: 'Northside Cycles',
    goal: 'One customer page for the front desk',
    brand: { color: '#ea580c' },
    productPaths: ['src/'],
    screenshots: { source: 'git', dir: 'e2e/__screenshots__', names: { 'customer-page': 'Customer page', planner: 'Workshop planner', repairs: 'Repairs' }, ignore: { left: 0, top: 0 } },
    usage: join(root, 'test/fixtures/usage.json'),
  },
  repo,
);
const { review, html, markdown } = await generate(config, { model: new FakeModel(), range: { kind: 'dates', from: '2026-11-03', until: '2026-11-16' } });
const out = join(root, 'docs/demo');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'index.html'), html);
writeFileSync(join(out, 'review.json'), JSON.stringify(review, null, 2) + '\n');
writeFileSync(join(out, 'review.md'), markdown);
writeFileSync(join(out, 'checks.md'), renderChecks(review));
console.log(`Wrote ${out}/index.html`);
