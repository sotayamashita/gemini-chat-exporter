/**
 * @type {import('lint-staged').Configuration}
 */
export default {
  // All files: format and security check
  "*": [
    "oxfmt --no-error-on-unmatched-pattern",
    // https://github.com/secretlint/secretlint
    "secretlint",
  ],

  // TypeScript/React/JavaScript files: additional checks
  "*.{ts,tsx,js,jsx}": [
    "oxlint --fix",
    () => "pnpm compile",
    () => "vitest run --reporter=dot --no-coverage --maxWorkers=4",
  ],
};
