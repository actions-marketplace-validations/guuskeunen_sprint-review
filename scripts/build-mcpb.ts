// Builds sprint-review.mcpb, the MCP server as an installable bundle (for Claude Desktop, Smithery
// and other MCP clients). The bundle is tiny: it starts this version of the npm package with npx,
// so the image library that differs per operating system is installed where it runs.
// Run: node scripts/build-mcpb.ts   (writes sprint-review.mcpb in the repository root)
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name: string; version: string; description: string; author: string; homepage: string };
const dir = join(tmpdir(), `sprint-review-mcpb-${pkg.version}`);
rmSync(dir, { recursive: true, force: true });
mkdirSync(join(dir, 'server'), { recursive: true });

const manifest = {
  manifest_version: '0.3',
  name: 'sprint-review',
  display_name: 'Sprint Review',
  version: pkg.version,
  description: 'Write a sprint review deck from git history, with every line checked against the real commits.',
  long_description: pkg.description,
  author: { name: pkg.author, url: 'https://github.com/guuskeunen' },
  repository: { type: 'git', url: 'https://github.com/guuskeunen/sprint-review' },
  homepage: pkg.homepage,
  documentation: 'https://github.com/guuskeunen/sprint-review/blob/main/docs/integrations.md',
  support: 'https://github.com/guuskeunen/sprint-review/issues',
  icon: 'icon.png',
  license: 'MIT',
  keywords: ['sprint review', 'scrum', 'git', 'presentation', 'release notes'],
  server: {
    type: 'node',
    entry_point: 'server/index.js',
    mcp_config: {
      command: 'node',
      args: ['${__dirname}/server/index.js'],
      env: { ANTHROPIC_API_KEY: '${user_config.anthropic_api_key}', GITHUB_TOKEN: '${user_config.github_token}' },
    },
  },
  user_config: {
    anthropic_api_key: { type: 'string', title: 'Anthropic API key', description: 'Writes the slides. For another provider, set model.provider in the project\'s sprint-review config and its key in your environment.', sensitive: true, required: false },
    github_token: { type: 'string', title: 'GitHub token', description: 'Optional: adds pull request descriptions as context.', sensitive: true, required: false },
  },
  compatibility: { platforms: ['darwin', 'win32', 'linux'], runtimes: { node: '>=22.0.0' } },
};
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

// The server: this exact version from npm, with the client's input and output passed through.
writeFileSync(
  join(dir, 'server/index.js'),
  `// Starts the sprint-review MCP server, version ${pkg.version}, from npm.
const { spawn } = require('node:child_process');
const windows = process.platform === 'win32';
const child = spawn(windows ? 'npx.cmd' : 'npx', ['--yes', '${pkg.name}@${pkg.version}', 'mcp'], { stdio: 'inherit', env: process.env, shell: windows });
child.on('error', (e) => { console.error('sprint-review needs Node 22 or newer with npx: ' + e.message); process.exit(1); });
child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
`,
);
copyFileSync(join(root, 'docs/assets/icon-512.png'), join(dir, 'icon.png'));

const out = join(root, 'sprint-review.mcpb');
execFileSync('npx', ['--yes', '@anthropic-ai/mcpb@2', 'pack', dir, out], { stdio: 'inherit' });
console.log(`Wrote ${out}`);
