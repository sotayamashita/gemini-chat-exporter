/**
 * @type {import('lint-staged').Configuration}
 */
export default {
  // https://github.com/secretlint/secretlint
  "*.{ts,tsx,js,jsx,json}": [
    "oxfmt",
    "oxlint --fix",
    "secretlint",
    () => "pnpm compile",
    () => "pnpm build",
  ],
};
