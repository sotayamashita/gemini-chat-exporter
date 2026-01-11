# Repository Guidelines

## ExecPlans

When writing complex features or significant refactors, use an ExecPlan (as described in .agent/PLANS.md) from design to implementation.

## Project Structure & Module Organization

- `entrypoints/` holds the extension entrypoints: background (`background.ts`), content script (`content.ts`), and popup UI (`popup/` with `App.tsx`, `main.tsx`, `index.html`, and styles).
- `public/` stores static assets (icons and `wxt.svg`).
- `assets/` contains shared assets for the React UI.
- Root config files: `wxt.config.ts`, `tsconfig.json`, and `package.json`.

## Build, Test, and Development Commands

- `pnpm dev`: Run WXT in development mode (Chrome by default).
- `pnpm dev:firefox`: Run development mode for Firefox.
- `pnpm build`: Build the extension for production.
- `pnpm build:firefox`: Build for Firefox.
- `pnpm lint`: Run oxlint on the codebase.
- `pnpm lint:fix`: Auto-fix lint issues where possible.
- `pnpm format`: Format files with oxfmt.
- `pnpm format:check`: Verify formatting without writing changes.
- `pnpm zip`: Produce a distributable ZIP package.
- `pnpm zip:firefox`: ZIP for Firefox.
- `pnpm compile`: Type-check only (`tsc --noEmit`).
- `pnpm test`: Run Vitest in watch mode.
- `pnpm test:coverage`: Run Vitest once with V8 coverage report generation.
- `pnpm install`: Triggers `postinstall` → `wxt prepare` to set up WXT.

## Coding Style & Naming Conventions

- Language: TypeScript + React (JSX runtime: `react-jsx`).
- Use the existing directory and file naming patterns (e.g., `entrypoints/popup/App.tsx`).
- Lint with `pnpm lint` (oxlint) and auto-fix with `pnpm lint:fix`.
- Format with `pnpm format` (oxfmt) and verify with `pnpm format:check`.
- When updating Gemini DOM extraction logic, keep `docs/gemini-structure-guide.md` in sync.
- Do not bypass git hooks (e.g., `HUSKY=0` or `--no-verify` is prohibited).

## Testing Guidelines

- Vitest is configured for unit tests in a JSDOM environment.
- Use `pnpm test` for watch mode, or `pnpm test:coverage` for a coverage report.
- Use `pnpm compile` for type-check validation.

## Commit & Pull Request Guidelines

- Commit messages must follow Conventional Commits (e.g., `chore: init project`, `feat: add popup state`).
- PRs should include a short description, relevant screenshots for UI changes, and any linked issues.

## Security & Configuration Tips

- Review extension permissions and host matches when adding content scripts.
- Keep secrets out of the repo; use environment variables or local-only config as needed.
