# Gemini Chat DOM Guide (for Exporter Maintenance)

## Purpose and Scope

- This document is a practical guide to help the LLM self-correct when the Gemini Web UI DOM changes.
- Scope is a single thread at `https://gemini.google.com/app/{chat_id}`. History lists and multi-chat pages are out of scope.
- The extraction logic must be language-agnostic; UI labels vary by locale and are not used for role detection.

## Data to Collect

- Required per-message fields: `role` / `markdown` / `text` / `timestamp` / `order`
- Message elements: headings, paragraphs, lists, code, tables
- Code block metadata: language label and positioning relative to the copy UI
- Chat-level metadata: source URL / generation timestamp

## Gemini Page Structure Characteristics

- Common:
  - The chat history container is typically `#chat-history` or `infinite-scroller[data-test-id="chat-history-container"]`.
  - User messages are wrapped in `<user-query>` elements.
  - Gemini responses are wrapped in `<model-response>` elements.
  - Multiple response/action controls can exist within a single reply; do not use button labels to infer role.
  - When both `.response-content` and `.response-container` exist for the same reply, prefer the inner `.response-content` to avoid duplication.
  - Code blocks have a language label within `.code-block`, and the label can be a sibling of `pre > code`.
  - Class names are unstable; prefer structural tags and data-test-id attributes.
- Label notes:
  - UI labels are localized (e.g., “Copy prompt” vs 「プロンプトをコピー」), so labels should only be used for optional UI cleanup, not for block discovery or role detection.
- Observations (2026-01-10, Playwright MCP):
  - Candidate containers for Gemini reply body:
    - `.response-content` (className: `response-content ng-tns-c4226368718-11`)
    - `.response-container` (className: `response-container ng-tns-c4226368718-11 response-container-with-gpi`)
  - Code language label:
    - `.code-block-decoration` (className: `code-block-decoration header-formatted gds-title-s` / label text: `Python` / `Markdown`)
  - These classes were confirmed in both the short chat (`735afd264d35c312`) and long chat (`cbb342fdc6010a5e`).

## Infinite Scroller and Virtual Scrolling Behavior (2026-01-11)

### Scroll Container Hierarchy

- **Actual scroll container**: `infinite-scroller.chat-history` (custom element)
- **Parent container**: `div.chat-history-scroll-container` (NOT scrollable)
- **Detection**: Check `scrollHeight > clientHeight` to verify scrollability

**Verified data** (Playwright MCP, chat `cbb342fdc6010a5e`):

    div.chat-history-scroll-container:
      scrollHeight: 1026px
      clientHeight: 1026px
      → NOT scrollable (scrollHeight === clientHeight)

    infinite-scroller.chat-history:
      scrollHeight: 26801px
      clientHeight: 3748px
      → Scrollable (scrollableDistance: 23053px)

### Virtual Scrolling Mechanism

- `infinite-scroller` dynamically loads/unloads messages based on scroll position
- **Initial render**: ~10 messages visible
- **Scrolling up**: Additional messages load progressively (10 → 20 → 30)
- **Scrolling away**: Messages outside viewport get unloaded from DOM

**Impact on extraction**:

- Must scroll to target position BEFORE extracting messages
- Messages not in viewport may not exist in DOM
- Current code scrolls to top (`scrollTop = 0`) to load entire chat history

### Auto Scroll-Back Feature

- Gemini Chat automatically scrolls back to the latest message (bottom) after ~1 second
- **Observed behavior** (Playwright MCP):

      Time 0s:    scrollTop = 21495 (middle)
      Time 1s:    scrollTop = 0 (scrolled to top)
      Time 2s:    scrollTop = 23922 (auto scroll-back to bottom)

- **Impact**: Must extract messages IMMEDIATELY after scroll completes, before auto scroll-back
- **Current solution**: `extractMessages()` is synchronous (DOM read only), completes within ~300ms

### Reaching Top Does Not Always Mean Complete History

- Some chats keep loading older messages even after `scrollTop = 0` is reached.
- **Impact**: `scrollTop = 0` alone is not a reliable completion signal.
- **Current solution**: wait for `scrollHeight` to remain stable for multiple checks before extracting.

### Implementation Notes

- Priority order for scroll container detection:
  1. `infinite-scroller.chat-history` (primary, actual scroll container)
  2. `div.chat-history-scroll-container` (legacy, for backward compatibility)
  3. Fallback: Find largest scrollable element
- Scroll detection code location: `entrypoints/content.ts:17` (`findScrollContainer()`)
- Scroll parameters (updated 2026-01-11):
  - `SCROLL_STEP = 1200px` (distance per iteration)
  - `SCROLL_DELAY = 300ms` (wait after each step) **← Changed from 120ms**
    - **Rationale**: Virtual scrolling requires ~200-300ms to load messages into DOM
    - 120ms was insufficient and caused message loss (only 14% retrieved)
    - 300ms ensures 100% message retrieval
  - `SCROLL_SETTLE_DELAY = 300ms` (wait before extraction)
  - `SCROLL_MAX_ITERATIONS = 60` (max loops, ~18 seconds timeout with 300ms delay)
  - `SCROLL_TOP_STABILITY_DELAY = 600ms` (wait between scroll-height checks)
  - `SCROLL_TOP_STABILITY_PASSES = 2` (stable checks required before finishing)
  - Dynamic iteration cap: `computedMaxIterations = max(SCROLL_MAX_ITERATIONS, ceil(scrollTop/SCROLL_STEP)+5)`

## Mapping to Existing Implementation

- chat root detection: `src/export/discovery.ts:147`
  - Update here if chat-history selectors change.
- scroll container detection: `entrypoints/content.ts:17`
  - Update priority order when scroll container changes.
  - Always verify `scrollHeight > clientHeight` to confirm scrollability.
  - `infinite-scroller.chat-history` is the primary container as of 2026-01-11.
- scroll loop behavior: `entrypoints/content.ts:56`
  - Uses a dynamic iteration cap (`computedMaxIterations`).
  - Requires `scrollHeight` stability after reaching `scrollTop = 0`.
- message block discovery: `src/export/discovery.ts`
  - Blocks are collected via `user-query` and `model-response` tags, with a fallback to `.conversation-container` when tags are missing.
- message block collection: `src/export/discovery.ts:167`
  - If double extraction happens, ensure nested blocks are deduped and the most specific block is kept.
- mixed block splitting: `src/export/discovery.ts:186`
  - Update when a single block mixes user/gemini after structural changes.
- role detection: `src/export/extract.ts:399`
  - Roles are inferred from tag names (`user-query` vs `model-response`).
- Gemini serialization: `src/export/extract.ts:320`
  - Update when handling of paragraph/list/code/table changes.
- User serialization: `src/export/extract.ts:378`
  - Update `heading` extraction rules if heading structure changes.
- code block collection: `src/export/extract.ts:157`
  - Code blocks are anchored by `.code-block` or the `code-block` custom element (preferred), with a `pre` fallback.
  - Code content is taken from `code`, or `pre` when `code` is absent, and must not depend on UI text.
- language label extraction: `src/export/extract.ts:135`
  - Update if language label position changes.
- markdown generation: `src/export/serialize.ts:23`
  - Update when output format changes.

## LLM Verification Procedure (Playwright MCP)

- Navigate to the target chat: `https://gemini.google.com/app/{chat_id}`
- Verify chat containers and message tags:
  - `#chat-history` or `infinite-scroller[data-test-id="chat-history-container"]` exists
  - `user-query` and `model-response` elements exist within the chat history container
- Check code block structure:
  - A language label exists under `.code-block` (or within `code-block` custom elements)
  - The label can be a sibling of `pre > code`
  - `code-block` custom elements appear within `model-response`
- Check for tables/lists:
  - `table`, `ul`, `ol` appear within message blocks

### Playwright MCP Concrete Verification Queries

```ts
// 1) Verify chat history container and message tags
await page.evaluate(() => {
  const history =
    document.querySelector("#chat-history") ||
    document.querySelector('infinite-scroller[data-test-id="chat-history-container"]');
  return {
    hasHistory: Boolean(history),
    userQueries: document.querySelectorAll("user-query").length,
    modelResponses: document.querySelectorAll("model-response").length,
  };
});
```

```ts
// 2) Detect user headings (both h2 and aria-level=2)
await page.evaluate(() => {
  const h2 = document.querySelectorAll("h2").length;
  const aria = document.querySelectorAll('[role="heading"][aria-level="2"]').length;
  return { h2, aria };
});
```

```ts
// 3) Response content candidates
await page.evaluate(() => {
  return {
    responseContainers: document.querySelectorAll(".response-container").length,
    responseContents: document.querySelectorAll(".response-content").length,
  };
});
```

```ts
// 4) Confirm code block language label position
await page.evaluate(() => {
  const code = document.querySelector("pre code");
  if (!code) return null;
  const block = code.closest(".code-block") ?? code.closest("code-block");
  const label = block?.querySelector(".code-block-decoration");
  return {
    hasCodeBlock: Boolean(block),
    labelText: label ? label.textContent?.trim() : null,
    preTextSample: code.textContent?.slice(0, 80) ?? null,
  };
});
```

```ts
// 5) Quick count of message block candidates
await page.evaluate(() => {
  return {
    userQueries: document.querySelectorAll("user-query").length,
    modelResponses: document.querySelectorAll("model-response").length,
  };
});
```

### Fact-Check Policy (Playwright MCP)

- Goal: Regularly verify that the DOM characteristics described in `docs/gemini-structure-guide.md` are reproducible in the actual Gemini UI.
- When to run:
  - After changing DOM extraction logic
  - When a Gemini UI change is suspected
- Targets:
  - `https://gemini.google.com/app/735afd264d35c312` (short chat: includes code and tables)
  - `https://gemini.google.com/app/cbb342fdc6010a5e` (long chat: requires scrolling)
- Observation points (mapped to this document):
  - The class-name observations under "Gemini Page Structure Characteristics" are still present
  - `response-content` / `response-container` exist together
  - `.code-block-decoration` displays a language label
  - User headings can be captured via `h2` or `role="heading"` + `aria-level="2"`
  - The relationship between `.code-block-decoration` and `pre > code` is preserved
  - After forcing `scrollTop = 0`, `scrollHeight` should remain stable for multiple checks
- Procedure:
  - Run the "Playwright MCP Concrete Verification Queries" in this file
  - If results differ, update both this document and the implementation
  - Scroll as needed and confirm the same structure near the bottom message blocks

## Change Detection and Update Procedure

- Signals:
  - Role detection breaks (User/Gemini inverted or missing)
  - Replies are duplicated
  - Code block language is empty
  - Previously extracted elements (tables/lists) disappear
- Initial investigation:
  - Re-check chat containers, message tags, and code block structure with Playwright MCP
- Update priority:
  1. Block detection in `findMessageBlocks()` and `splitMixedBlock()`
  2. Role detection in `determineRole()` based on tag names
  3. Language detection in `collectCodeBlocks()` and `findLanguageLabel()`
  4. Extraction elements in `serializeGeminiBlock()` / `serializeUserBlock()`
- Post-update verification:
  - Run `pnpm test` to verify extraction-related units
  - Re-export the target chat and visually confirm duplicates, language, and structure

## Known Pitfalls and Mitigations

- Double extraction: response content can exist in both `.response-content` and `.response-container`.
- Language missing: Language labels are siblings of `pre`, so searching only inside `pre` misses them.
- Missing headings: Some cases use `role="heading"` + `aria-level="2"` instead of `h2`.
- UI label contamination: Remove UI button labels from extracted text.
- Regenerate replies: UI actions like “Redo” can change action button hierarchy within responses.
- Large tables: Wide tables can cause parsing failures (fallback with column limits).
- Inline code misclassification: Short inline `code` should not be treated as a block unless inside `pre`/`.code-block`.
