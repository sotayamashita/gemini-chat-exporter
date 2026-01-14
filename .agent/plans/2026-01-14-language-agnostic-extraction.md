# Make Gemini extraction language-agnostic

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

This repository has a plan guide at .agent/PLANS.md. This document must be maintained in accordance with that file.

## Purpose / Big Picture

Users can export Gemini chats regardless of UI language (English, Japanese, etc.). After this change, clicking “Export current chat” succeeds even when Gemini UI labels are not Japanese. You can see it working by running the extension, opening a Gemini chat with English UI labels, and exporting messages without the “No messages were found in the current chat.” error. A second proof is that tests using saved English and Japanese HTML fixtures both extract at least one message.

## Progress

- [x] (2026-01-14 05:40Z) Create ExecPlan and topic branch fix/language-agnostic-extraction.
- [x] (2026-01-14 05:55Z) Implement language-agnostic DOM discovery for chat root and message blocks in src/export/discovery.ts.
- [x] (2026-01-14 06:05Z) Implement role detection based on element tags (user-query/model-response) in src/export/extract.ts and remove dependence on UI label strings for role selection.
- [x] (2026-01-14 06:10Z) Remove label-string stripping as a primary mechanism; filter UI controls by element selectors before serialization.
- [x] (2026-01-14 06:15Z) Update scroll container detection in entrypoints/content.ts to prioritize data-test-id chat-history container.
- [x] (2026-01-14 06:30Z) Add fixtures and tests for English/Japanese HTML to prove extraction works across UI languages.
- [x] (2026-01-14 06:40Z) Update docs/gemini-structure-guide.md with new anchors and fallbacks.
- [x] (2026-01-14 06:45Z) Run pnpm test -- --run and pnpm compile; record outcomes.
- [x] (2026-01-14 07:35Z) Decode MHTML snapshots and inspect model-response DOM to confirm code blocks are rendered within `code-block` custom elements.
- [x] (2026-01-14 07:55Z) Add extraction fallbacks for `code-block` custom elements and `pre` without nested `code`.
- [x] (2026-01-14 08:05Z) Add sanitized fixtures for `code-block` custom elements and update fixture tests to assert code fences.
- [x] (2026-01-14 08:25Z) Run pnpm test -- --run and record outcomes for code-block fix.
- [ ] (2026-01-14 08:20Z) Commit changes with Conventional Commit message.

## Surprises & Discoveries

- Observation: The Gemini chat DOM includes stable custom elements like user-query and model-response that are present in both English and Japanese UI snapshots, while the aria-label text on buttons changes with UI language.
  Evidence: HTML snapshots show <user-query> and <model-response> tags regardless of language, but labels like “Copy prompt” or “プロンプトをコピー” differ.
- Observation: Vitest emits “Could not parse CSS stylesheet” warnings when loading the full Gemini HTML fixtures, but tests still pass.
  Evidence: pnpm test -- --run output during gemini-fixtures.test.ts execution.
- Observation: Code blocks are not extracted correctly in new MHTML snapshots for both English and Japanese UI.
  Evidence: User report with provided files: /path/to/Google Gemini-en-missing-code-block.mhtml and /path/to/Google Gemini-ja-missing-code-block.mhtml.
- Observation: New MHTML snapshots render code blocks inside the `code-block` custom element within `response-element`.
  Evidence: Decoded MHTML shows `code-block` tags wrapping `.code-block` and `pre > code` inside `model-response`.

## Decision Log

- Decision: Use structural DOM anchors (chat-history container, conversation-container, user-query, model-response) as the primary source for block discovery instead of label-based markers.
  Rationale: Structural tags are language-agnostic and present across English/Japanese snapshots; label-based matching is brittle and breaks on language changes.
  Date/Author: 2026-01-14 / Codex
- Decision: Strip UI controls by cloning blocks and removing button/action elements before text extraction.
  Rationale: UI labels are localized; removing the UI elements avoids text contamination without relying on label strings.
  Date/Author: 2026-01-14 / Codex
- Decision: Resolve fixture paths using process.cwd() in tests.
  Rationale: Vitest’s import.meta.url resolved to a virtual /src path, so explicit cwd-based paths are reliable in this repo.
  Date/Author: 2026-01-14 / Codex
- Decision: Treat `code-block` custom elements and `pre` elements without nested `code` as code block anchors.
  Rationale: MHTML snapshots show `code-block` wrappers, and some environments may omit nested `code` tags; fallbacks avoid missing code blocks.
  Date/Author: 2026-01-14 / Codex

## Outcomes & Retrospective

Language-agnostic extraction is implemented using structural tags and chat-history containers. English and Japanese HTML fixtures are now part of the test suite, and both pass. The DOM guide has been updated to reflect the new anchors and verification checks. Code block extraction now includes `code-block` custom elements and `pre` fallbacks with new sanitized fixtures that mirror the MHTML structure.

Remaining work: run tests for the code-block fix, commit the changes, and verify behavior in a live Gemini session on Windows to confirm end-to-end export success.

## Context and Orientation

This is a browser extension with content scripts that scrape Gemini’s DOM. The export pipeline is: entrypoints/content.ts receives a message from the popup, finds the chat root, scrolls to load history, extracts messages, and sends them back to the popup. The extraction now relies on structural DOM tags (user-query/model-response) and chat-history containers, not UI label strings. The core DOM discovery functions are in src/export/discovery.ts, and the main extraction logic is in src/export/extract.ts. The document docs/gemini-structure-guide.md explains DOM anchors and must be kept in sync when DOM logic changes.

Key files:

- entrypoints/content.ts: content script entrypoint and scroll container discovery.
- src/export/discovery.ts: chat root detection and message block discovery.
- src/export/extract.ts: message serialization and role determination.
- src/export/markers.ts: UI label markers (currently Japanese).
- docs/gemini-structure-guide.md: documentation of DOM structure and extraction rules.

Key terms:

- Chat root: the DOM element that contains the conversation history list and the message blocks.
- Message block: a DOM element representing one user prompt or one Gemini response.
- Role: whether a message is authored by the user or by Gemini.

## Plan of Work

First, update discovery logic in src/export/discovery.ts to use structural anchors that do not depend on UI text. The chat root should be located by preferring #chat-history or infinite-scroller[data-test-id="chat-history-container"], and only fall back to main/body when those are missing. Message blocks should be collected by selecting user-query and model-response elements within the chat root, preserving document order.

Second, update src/export/extract.ts so determineRole uses tag names (USER-QUERY vs MODEL-RESPONSE) instead of UI label markers. The extraction of message content should operate on the block itself; remove reliance on marker buttons for determining which blocks are valid. Add a cleanup step that clones the block and removes UI controls (buttons, message-actions, toolbars) before collecting text to avoid “Copy/More” labels without using language-specific filters. Keep any existing label stripping only as a secondary cleanup, not as the primary role or block selector.

Third, update entrypoints/content.ts to prefer the data-test-id chat history container when choosing the scrollable element, and keep the existing fallbacks.

Fourth, add fixtures and tests. Store the provided English and Japanese HTML snapshots under a new test fixtures directory (for example, src/export/**fixtures**/gemini-en.html and gemini-ja.html). Add a unit test in a new or existing test file (e.g., src/export/extract.test.ts) that loads each fixture into JSDOM, finds the chat root, extracts messages, and asserts that at least one message exists and that both user and gemini roles appear.

Fifth, update docs/gemini-structure-guide.md with the new anchors (chat-history container, conversation-container, user-query, model-response) and describe the fallback path when tags are missing.

Finally, run pnpm test (or pnpm test:coverage) and pnpm compile. Capture any failures in Surprises & Discoveries and update Progress accordingly. If tests are not runnable locally, document the reason and provide manual verification steps.

## Concrete Steps

All commands run from /path/to/gemini-chat-exporter.

1. Edit src/export/discovery.ts to:
   - Prefer #chat-history or infinite-scroller[data-test-id="chat-history-container"] for findChatRoot.
   - Replace marker-based findMessageBlocks with a selection of user-query and model-response elements in document order.

2. Edit src/export/extract.ts to:
   - Determine role by tag name (user-query => user, model-response => gemini).
   - Remove or bypass marker-based role checks.
   - Before collecting text, clone the block and remove UI control elements (buttons, message-actions, toolbars) using selectors so labels do not leak into output.

3. Edit entrypoints/content.ts to prefer infinite-scroller[data-test-id="chat-history-container"] in findScrollContainer.

4. Add fixtures:
   - Create src/export/**fixtures**/gemini-en.html from /path/toGoogle Gemini-en.html.
   - Create src/export/**fixtures**/gemini-ja.html from /path/toGoogle Gemini-ja.html.

5. Add tests in src/export/extract.test.ts (or new file) to load fixtures into JSDOM, run findChatRoot and extractMessages, and assert:
   - messages.length > 0
   - at least one message has role "user"
   - at least one message has role "gemini"

6. Update docs/gemini-structure-guide.md to reflect new anchors and fallback logic.

7. Run:
   - pnpm test
   - pnpm compile
     Record results in Progress and Surprises & Discoveries.

Expected transcripts (examples):

    $ pnpm test
    ✓ src/export/extract.test.ts (2 tests)

    $ pnpm compile
    Done in Xs

## Validation and Acceptance

The change is accepted when:

- Exporting a Gemini chat with English UI no longer returns “No messages were found in the current chat.”
- Unit tests using English and Japanese HTML fixtures both pass and show at least one user and one gemini message extracted.
- pnpm compile succeeds.

Manual verification: run pnpm dev, open Gemini with English UI labels, open a chat, and click “Export current chat.” The popup should report a successful export and create a Markdown file with content. Repeat with Japanese UI to confirm parity.

## Idempotence and Recovery

Edits are safe to re-run. If a step fails, revert only the file under edit and re-apply the changes; no migrations or destructive operations are involved. Fixture files can be overwritten safely if updated snapshots are provided later.

## Artifacts and Notes

Test run excerpt:

    $ pnpm test -- --run
    ✓ src/export/gemini-fixtures.test.ts (2 tests)
    Could not parse CSS stylesheet
    ✓ src/export/extract.test.ts (14 tests)

    $ pnpm compile
    (no output, exit 0)

## Interfaces and Dependencies

Existing functions to update:

- src/export/discovery.ts: findChatRoot(doc: Document): Element | null, findMessageBlocks(root: Element): Element[]
- src/export/extract.ts: determineRole(block: Element, previousRole: ExportRole | null): ExportRole | null, extractMessages(root: Element, options?: ExtractOptions): ExportMessage[]
- entrypoints/content.ts: findScrollContainer(root: Element): HTMLElement | null

New helper functions to add (names are prescriptive for clarity):

- In src/export/extract.ts, add a helper named cloneAndStripUi(block: Element): Element that clones the block and removes UI control elements by selector before text serialization. Use selectors like button, message-actions, [data-test-id="copy-button"], [data-test-id="more-menu-button"], and any other non-content controls found in the snapshots.

Plan change note: Initial plan created to shift extraction from label-based markers to language-agnostic DOM structure, based on English/Japanese HTML snapshots provided on 2026-01-14.

Plan change note: Updated progress, decisions, and outcomes after implementing language-agnostic discovery, adding fixtures/tests, and running pnpm test -- --run and pnpm compile on 2026-01-14.

Plan change note: Logged new issue about code blocks missing in MHTML snapshots provided on 2026-01-14; see Surprises & Discoveries and Progress for follow-up work.

Plan change note: Documented MHTML inspection findings, added code-block fallback work items, and updated outcomes to reflect the code-block extraction fix progress.
