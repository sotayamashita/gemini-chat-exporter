# Gemini Chat DOM Guide (for Exporter Maintenance)

## Purpose and Scope

- This document is a practical guide to help the LLM self-correct when the Gemini Web UI DOM changes.
- Scope is a single thread at `https://gemini.google.com/app/{chat_id}`. History lists and multi-chat pages are out of scope.
- UI labels assume the Japanese UI (operationally, no multi-language support).
- The account checked via Playwright MCP is set to Japanese display language.
- The same structure was also confirmed in the English UI (2026-01-10). English labels: "Copy prompt" / "Show thinking" / "Good response" / "Bad response".

## Data to Collect

- Required per-message fields: `role` / `markdown` / `text` / `timestamp` / `order`
- UI markers used for role detection: visible labels for user and Gemini buttons
- Message elements: headings, paragraphs, lists, code, tables
- Code block metadata: language label and positioning relative to the copy UI
- Chat-level metadata: source URL / generation timestamp

## Gemini Page Structure Characteristics

- Common:
  - The chat root tends to be near the ancestor of the heading "Conversation with Gemini / Gemini との会話".
  - Multiple Gemini markers can exist within a single reply and may map to different ancestors.
  - When both `.response-content` and `.response-container` exist for the same reply, prefer the inner `.response-content` to avoid duplication.
  - Code blocks have a language label within `.code-block`, and the label can be a sibling of `pre > code`.
  - Class names are unstable; prefer text and aria-label.
- Japanese UI:
  - Heading: 「Gemini との会話」
  - User: 「プロンプトをコピー」 button + heading with `aria-level="2"`
  - Gemini replies: 「思考プロセスを表示」「良い回答」「悪い回答」
  - Button labels may not appear as visible text, so prefer `aria-label`.
- English UI:
  - Heading: "Conversation with Gemini"
  - User: "Copy prompt" button + heading with `aria-level="2"`
  - Gemini replies: "Show thinking" / "Good response" / "Bad response"
  - Button labels appear in `aria-label` or visible text, so prefer `aria-label`.
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

## Mapping to Existing Implementation

- chat root detection: `src/export/discovery.ts:147`
  - Update here if the heading/root search changes.
- scroll container detection: `entrypoints/content.ts:17`
  - Update priority order when scroll container changes.
  - Always verify `scrollHeight > clientHeight` to confirm scrollability.
  - `infinite-scroller.chat-history` is the primary container as of 2026-01-11.
- marker detection: `src/export/discovery.ts:105` and `src/export/markers.ts:4`
  - Update `markers.ts` when UI labels change.
  - When supporting English UI, add English labels ("Copy prompt" / "Show thinking" / "Good response" / "Bad response").
  - Adjust `buttonText()` if you want to change the priority of aria-label vs textContent.
- message block collection: `src/export/discovery.ts:167`
  - If double extraction happens, ensure nested blocks are deduped and the most specific block is kept.
- mixed block splitting: `src/export/discovery.ts:186`
  - Update when a single block mixes user/gemini after structural changes.
- role detection: `src/export/extract.ts:399`
  - Update when marker presence/order logic changes.
- Gemini serialization: `src/export/extract.ts:320`
  - Update when handling of paragraph/list/code/table changes.
- User serialization: `src/export/extract.ts:378`
  - Update `heading` extraction rules if heading structure changes.
- code block collection: `src/export/extract.ts:157`
  - Code blocks are anchored by `.code-block` (preferred) or `pre` and must not depend on UI text.
- language label extraction: `src/export/extract.ts:135`
  - Update if language label position changes.
- markdown generation: `src/export/serialize.ts:23`
  - Update when output format changes.

## LLM Verification Procedure (Playwright MCP)

- Navigate to the target chat: `https://gemini.google.com/app/{chat_id}`
- Verify primary markers:
  - `button` `aria-label` / text includes 「プロンプトをコピー」「思考プロセスを表示」「良い回答」「悪い回答」
  - User heading can be `h2` or `role="heading"` + `aria-level="2"`
- Check message block ancestor differences:
  - Use `closest` from `button` to walk ancestors and confirm the minimal block differs between user/Gemini
- Check code block structure:
  - A language label exists under `.code-block`
  - The label can be a sibling of `pre > code`
- Check for tables/lists:
  - `table`, `ul`, `ol` appear within message blocks

### Playwright MCP Concrete Verification Queries (Japanese UI)

```ts
// 1) Verify primary markers
await page.evaluate(() => {
  const labelText = (b) => b.getAttribute("aria-label") || b.textContent || "";
  const markers = ["プロンプトをコピー", "思考プロセスを表示", "良い回答", "悪い回答"];
  return markers.map((label) => ({
    label,
    count: Array.from(document.querySelectorAll("button")).filter((b) =>
      labelText(b).includes(label),
    ).length,
  }));
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
// 3) Gemini marker ancestor differences (check for duplicate extraction)
await page.evaluate(() => {
  const normalize = (v) => (v || "").replace(/\\s+/g, " ").trim();
  const buttons = Array.from(document.querySelectorAll("button")).filter(
    (b) =>
      normalize(b.textContent).includes("思考プロセスを表示") ||
      normalize(b.textContent).includes("良い回答") ||
      normalize(b.textContent).includes("悪い回答"),
  );
  return buttons.slice(0, 6).map((b) => {
    let current = b.parentElement;
    const chain = [];
    let depth = 0;
    while (current && depth < 6) {
      chain.push({
        tag: current.tagName,
        className: current.className || null,
      });
      current = current.parentElement;
      depth += 1;
    }
    return { label: normalize(b.textContent), chain };
  });
});
```

```ts
// 4) Confirm code block language label position
await page.evaluate(() => {
  const code = document.querySelector("pre code");
  if (!code) return null;
  const block = code.closest(".code-block");
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
  const isMarker = (b) => {
    const t = (b.getAttribute("aria-label") || b.textContent || "").replace(/\\s+/g, " ").trim();
    return ["プロンプトをコピー", "思考プロセスを表示", "良い回答", "悪い回答"].some((m) =>
      t.includes(m),
    );
  };
  const buttons = Array.from(document.querySelectorAll("button")).filter(isMarker);
  return { markerButtonCount: buttons.length };
});
```

### Playwright MCP Concrete Verification Queries (English UI)

```ts
// 1) Verify primary markers
await page.evaluate(() => {
  const labelText = (b) => b.getAttribute("aria-label") || b.textContent || "";
  const markers = ["Copy prompt", "Show thinking", "Good response", "Bad response"];
  return markers.map((label) => ({
    label,
    count: Array.from(document.querySelectorAll("button")).filter((b) =>
      labelText(b).includes(label),
    ).length,
  }));
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
// 3) Gemini marker ancestor differences (check for duplicate extraction)
await page.evaluate(() => {
  const normalize = (v) => (v || "").replace(/\\s+/g, " ").trim();
  const buttons = Array.from(document.querySelectorAll("button")).filter(
    (b) =>
      normalize(b.getAttribute("aria-label") || b.textContent).includes("Show thinking") ||
      normalize(b.getAttribute("aria-label") || b.textContent).includes("Good response") ||
      normalize(b.getAttribute("aria-label") || b.textContent).includes("Bad response"),
  );
  return buttons.slice(0, 6).map((b) => {
    let current = b.parentElement;
    const chain = [];
    let depth = 0;
    while (current && depth < 6) {
      chain.push({
        tag: current.tagName,
        className: current.className || null,
      });
      current = current.parentElement;
      depth += 1;
    }
    return { label: normalize(b.getAttribute("aria-label") || b.textContent), chain };
  });
});
```

```ts
// 4) Confirm code block language label position
await page.evaluate(() => {
  const code = document.querySelector("pre code");
  if (!code) return null;
  const block = code.closest(".code-block");
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
  const isMarker = (b) => {
    const t = (b.getAttribute("aria-label") || b.textContent || "").replace(/\\s+/g, " ").trim();
    return ["Copy prompt", "Show thinking", "Good response", "Bad response"].some((m) =>
      t.includes(m),
    );
  };
  const buttons = Array.from(document.querySelectorAll("button")).filter(isMarker);
  return { markerButtonCount: buttons.length };
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
  - Marker labels exist (「プロンプトをコピー」「思考プロセスを表示」「良い回答」「悪い回答」)
  - `response-content` / `response-container` exist together
  - `.code-block-decoration` displays a language label
  - User headings can be captured via `h2` or `role="heading"` + `aria-level="2"`
  - The relationship between `.code-block-decoration` and `pre > code` is preserved
  - Marker labels are retrievable via `aria-label`
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
  - Re-check primary markers, headings, and code block structure with Playwright MCP
  - Compare ancestor chains for the blocks referenced by markers
- Update priority:
  1. UI label updates in `markers.ts`
  2. Block detection in `findMessageBlocks()` and `splitMixedBlock()`
  3. Language detection in `collectCodeBlocks()` and `findLanguageLabel()`
  4. Extraction elements in `serializeGeminiBlock()` / `serializeUserBlock()`
- Post-update verification:
  - Run `pnpm test` to verify extraction-related units
  - Re-export the target chat and visually confirm duplicates, language, and structure

## Known Pitfalls and Mitigations

- Double extraction: Gemini markers are split across `.response-content` and `.response-container`.
- Language missing: Language labels are siblings of `pre`, so searching only inside `pre` misses them.
- Missing headings: Some cases use `role="heading"` + `aria-level="2"` instead of `h2`.
- UI label contamination: Remove UI button labels from extracted text.
- Marker fragility: UI label changes can break role detection.
- Regenerate replies: UI like 「やり直す」 can change marker ancestor relationships.
- Large tables: Wide tables can cause parsing failures (fallback with column limits).
- Inline code misclassification: Short inline `code` should not be treated as a block unless inside `pre`/`.code-block`.
