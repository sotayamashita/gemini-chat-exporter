/**
 * @type {import('lint-staged').Configuration}
 */
export default {
  "*.{ts,tsx,js,jsx,json}": ["oxfmt", "oxlint --fix", () => "pnpm compile", () => "pnpm build"],
};
