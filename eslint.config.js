// Lint: the recommended JavaScript and TypeScript rules. The typecheck (npm run typecheck)
// covers types; this catches what types don't, such as unused code and risky patterns.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'docs/', 'coverage/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // An empty catch is how this code says "optional, carry on": an import that may be missing, a best-effort read.
  { rules: { 'no-empty': ['error', { allowEmptyCatch: true }] } },
  // Tests read untyped JSON (API answers, MCP messages) with any.
  { files: ['test/**'], rules: { '@typescript-eslint/no-explicit-any': 'off' } },
);
