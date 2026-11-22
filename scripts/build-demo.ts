// Builds the demo deck in docs/demo/ from the bike-shop fixture repo, without calling an AI:
// the words are written here, as a good writer would, so the demo shows every kind of slide.
// The close-ups come from scripts/demo/ (node scripts/build-demo-screens.ts).
// Run: node scripts/build-demo.ts
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize } from '../src/config.ts';
import { generate } from '../src/review/generate.ts';
import { renderChecks } from '../src/deck/markdown.ts';
import type { ModelAnswer, ModelClient, ModelRequest } from '../src/ai/model.ts';
import { demoRepo, FakeModel } from '../test/helpers.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = demoRepo();

// This sprint also brought two close-ups of the app, and the front desk's requests.
const git = (args: string[], date: string) =>
  execFileSync('git', args, { cwd: repo, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 'Demo', GIT_AUTHOR_EMAIL: 'demo@example.test', GIT_COMMITTER_NAME: 'Demo', GIT_COMMITTER_EMAIL: 'demo@example.test', GIT_AUTHOR_DATE: `${date}T10:00:00Z`, GIT_COMMITTER_DATE: `${date}T10:00:00Z` } });
for (const name of ['bike-cards', 'ticket-scan']) copyFileSync(join(root, 'scripts/demo', `${name}.png`), join(repo, 'e2e/__screenshots__', `${name}-desktop.png`));
git(['add', '-A'], '2026-11-15');
git(['commit', '-q', '-m', 'test(e2e): screenshots of the bike cards and a scanned ticket'], '2026-11-15');
writeFileSync(join(repo, 'FEEDBACK.md'), '# Requests\n\n- Can the front desk see everything a customer had done, in one place?\n- Typing in the paper repair tickets takes forever\n- Text the customer when the bike is ready\n');
git(['add', '-A'], '2026-11-15');
git(['commit', '-q', '-m', 'docs: requests from the front desk'], '2026-11-15');

// The review two weeks ago, for "Last sprint we said".
const out = mkdtempSync(join(tmpdir(), 'sprint-review-demo-out-'));
const before = JSON.parse(readFileSync(join(root, 'test/fixtures/sample-review.json'), 'utf8'));
before.until = '2026-11-02';
before.milestones = ['Book a repair online', 'Workshop planner per branch', 'One customer page for online store, register and workshop', 'Read repair tickets from a photo', 'Text message when the bike is ready', 'Reorder parts automatically'].map((text, i) => ({ text, done: i < 2 }));
mkdirSync(join(out, '2026-11-02'));
writeFileSync(join(out, '2026-11-02/review.json'), JSON.stringify(before));

/** The words a good writer would give for this sprint; the reader and the rewrite come from the test fake. */
class DemoModel implements ModelClient {
  private readonly fake = new FakeModel();

  async ask(request: ModelRequest): Promise<ModelAnswer> {
    if (request.tool.name === 'reading_report') return { model: 'demo', usage: { input: 1000, output: 100 }, toolInput: { complaints: [] } };
    const answer = await this.fake.ask(request);
    if (request.tool.name !== 'presentation') return answer;
    const log = request.messages[0] ?? '';
    const h = (word: string) => new RegExp(`^([0-9a-f]{7,}) \\S+ [^\\n]*${word}`, 'm').exec(log)?.[1] ?? 'deadbee';
    const point = (text: string, word: string) => ({ text, commits: [h(word)] });
    return {
      ...answer,
      toolInput: {
        ...answer.toolInput,
        questions: ['Which repairs would you still type in by hand?', 'What is missing on the customer page?', 'Which bikes should get a service reminder first?'],
        answered: [
          { item: 0, text: 'One customer page with every purchase, repair and service', commits: [h('timeline')] },
          { item: 1, text: 'A photo of the ticket becomes a repair, no typing', commits: [h('tickets')] },
        ],
        themes: [
          {
            title: 'Customer page',
            icon: 'users',
            screen: 'Bike cards (desktop)',
            value: 'quality',
            effect: 'Front desk staff see everything a customer bought or had repaired on one page.',
            points: [point('Purchases, repairs and services sit in one list, each with its source', 'timeline'), point('Every bike has its own card with the next service', 'service card'), point('A card turns amber when a service is due within a month', 'service card')],
            notes: 'Open the customer page for Sarah Mitchell and point at the bike cards.',
          },
          {
            title: 'Repair tickets',
            icon: 'clipboard-list',
            screen: 'Repair ticket (desktop)',
            value: 'less_manual_work',
            effect: 'A photo of a handwritten repair ticket becomes a repair, with no retyping.',
            points: [point('Customer and bike are matched from the photo', 'tickets'), point('Fields that are hard to read are flagged to check', 'tickets'), point('One click creates the repair, ready for the planner', 'tickets')],
            notes: 'Take a photo of a paper ticket, then show the repair it became.',
          },
          {
            title: 'Workshop planner',
            icon: 'calendar',
            screen: 'none',
            value: 'faster',
            effect: 'The planner shows at a glance how many jobs are done and where work is stuck.',
            points: [point('A bar shows how much of today is done', 'planner'), point('Jobs waiting for parts stand out in amber', 'planner'), point('The counts per status show without slowing the planner down', 'planner')],
            notes: 'Open the planner for the Portland East branch and point at the progress bar.',
          },
          {
            title: 'Duplicate customers',
            icon: 'copy',
            screen: 'none',
            value: 'less_risk',
            effect: 'Merged customers stop coming back as duplicates.',
            points: [point('A merged customer no longer shows up in duplicate alerts', 'dedupe')],
            notes: 'Show the compare screen after a merge.',
          },
          {
            title: 'Look and feel',
            icon: 'palette',
            screen: 'none',
            value: 'quality',
            effect: 'Labels look the same everywhere, and tables work on a phone.',
            points: [point('Each source has a fixed color', 'badge'), point('Tables on a phone scroll sideways', 'badge')],
            notes: 'Open the repairs list on a phone and scroll the table.',
          },
        ],
      },
    };
  }
}

const config = normalize(
  {
    product: { name: 'Spoke', description: 'the planning and customer app of Northside Cycles, a chain of bike repair shops' },
    organization: 'Northside Cycles',
    goal: 'One customer page for the front desk',
    brand: { color: '#a37b35' },
    productPaths: ['src/'],
    screenshots: { source: 'git', dir: 'e2e/__screenshots__', names: { 'customer-page': 'Customer page', planner: 'Workshop planner', repairs: 'Repairs', 'bike-cards': 'Bike cards', 'ticket-scan': 'Repair ticket' }, ignore: { left: 0, top: 0 } },
    usage: join(root, 'test/fixtures/usage.json'),
    output: { dir: out },
  },
  repo,
);
const { review, html, markdown } = await generate(config, { model: new DemoModel(), range: { kind: 'dates', from: '2026-11-03', until: '2026-11-16' } });
const demo = join(root, 'docs/demo');
mkdirSync(demo, { recursive: true });
writeFileSync(join(demo, 'index.html'), html);
writeFileSync(join(demo, 'review.json'), JSON.stringify(review, null, 2) + '\n');
writeFileSync(join(demo, 'review.md'), markdown);
writeFileSync(join(demo, 'checks.md'), renderChecks(review));
console.log(`Wrote ${demo}/index.html`);
