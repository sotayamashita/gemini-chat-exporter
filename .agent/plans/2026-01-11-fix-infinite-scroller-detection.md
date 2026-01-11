# Fix Infinite Scroller Detection for Complete Long Chat Export

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `.agent/PLANS.md` at the repository root.

## Purpose / Big Picture

Users cannot export complete chat histories from long Gemini conversations. Currently, only 10-20 messages (14-28%) are captured instead of the full conversation. After this change, users will be able to export 100% of messages from any length of Gemini chat. This can be verified by exporting a known long chat (such as chat ID `cbb342fdc6010a5e` with 72 messages) and confirming all messages appear in the exported file.

## Progress

- [x] (2026-01-11 12:26JST) Started implementation
- [x] (2026-01-11 12:27JST) Update `findScrollContainer()` function to prioritize `infinite-scroller.chat-history` element
- [x] (2026-01-11 12:27JST) Increase `SCROLL_DELAY` constant from 120ms to 300ms
- [x] (2026-01-11 12:27JST) Update `docs/gemini-structure-guide.md` with infinite scroller documentation
- [x] (2026-01-11 12:29JST) Run existing unit tests to verify no regressions
- [ ] Manual verification with long chat export (partial: `pnpm build` completed; browser export pending)

## Surprises & Discoveries

### Wrong Scroll Container Detected

The current code prioritizes `div.chat-history-scroll-container` which is NOT scrollable. The actual scroll container is the `infinite-scroller.chat-history` custom element.

Evidence from Playwright MCP investigation (chat `cbb342fdc6010a5e`):

    div.chat-history-scroll-container:
      scrollHeight: 1026px
      clientHeight: 1026px
      → NOT scrollable (scrollHeight === clientHeight)

    infinite-scroller.chat-history:
      scrollHeight: 26801px
      clientHeight: 3748px
      → Scrollable (scrollableDistance: 23053px)

### Virtual Scrolling Mechanism

The `infinite-scroller` element dynamically loads and unloads messages based on scroll position. Initial render shows only approximately 10 messages. As the user scrolls upward, additional messages load progressively (10 → 20 → 30). Messages outside the viewport get unloaded from the DOM.

Evidence: With `SCROLL_DELAY = 120ms`, only 10 messages remained in DOM after scroll. With `SCROLL_DELAY = 300ms`, all 72 messages (36 user + 36 Gemini) loaded successfully.

### Auto Scroll-Back Feature

Gemini Chat automatically scrolls back to the latest message (bottom) approximately 1 second after scrolling to the top completes.

Evidence from Playwright MCP observation:

    iteration 18: scrollTop=0, markerCount=20 ✅ Scroll complete
    1 second later: scrollTop=23922, markerCount=30 ❌ Auto scroll-back

This means message extraction must occur immediately after scroll completes, before the auto scroll-back triggers.

## Decision Log

- Decision: Prioritize `infinite-scroller.chat-history` over `div.chat-history-scroll-container` in scroll container detection
  Rationale: Playwright MCP investigation revealed that `div.chat-history-scroll-container` has `scrollHeight === clientHeight`, making it non-scrollable. The actual scroll container is the `infinite-scroller` custom element. Maintaining backward compatibility by keeping the old container as a fallback.
  Date: 2026-01-11

- Decision: Increase `SCROLL_DELAY` from 120ms to 300ms
  Rationale: Virtual scrolling requires approximately 200-300ms to load messages into the DOM. Testing with 120ms resulted in only 14% message retrieval, while 300ms achieved 100% retrieval. The tradeoff is slower scroll time (approximately 18 seconds for 60 iterations) but guaranteed complete message capture.
  Date: 2026-01-11

- Decision: Add explicit scrollability check (`scrollHeight > clientHeight`) in container detection
  Rationale: Prevents selecting non-scrollable elements even if they match known selectors. Makes the code more robust against future DOM structure changes.
  Date: 2026-01-11

## Outcomes & Retrospective

(To be filled upon completion)

## Context and Orientation

This repository is a browser extension for exporting Gemini chat conversations. The extension uses a content script (`entrypoints/content.ts`) that scrolls the chat history to the top to ensure all messages are loaded into the DOM before extraction.

The scroll container detection logic is in the `findScrollContainer()` function at `entrypoints/content.ts:17-37`. This function searches for the element responsible for scrolling the chat history.

The scroll mechanism uses these constants defined at `entrypoints/content.ts:10-13`:

- `SCROLL_STEP`: Distance to scroll per iteration (1200px)
- `SCROLL_DELAY`: Wait time after each scroll step (currently 120ms)
- `SCROLL_SETTLE_DELAY`: Wait time before message extraction (300ms)
- `SCROLL_MAX_ITERATIONS`: Maximum scroll attempts (60 iterations)

Gemini uses a custom `infinite-scroller` web component that implements virtual scrolling. This component only renders messages near the current scroll position, loading more as the user scrolls and unloading those that move out of view.

The message extraction logic is in `src/export/extract.ts` and operates synchronously on the current DOM state. It must be called while messages are still loaded in the viewport.

## Plan of Work

The fix requires two changes in `entrypoints/content.ts` and documentation updates in `docs/gemini-structure-guide.md`.

### Change 1: Update findScrollContainer() Priority Order

Modify the `findScrollContainer()` function at lines 17-37 to prioritize `infinite-scroller.chat-history` and add explicit scrollability checks.

Current logic (incorrect):

    const findScrollContainer = (root: Element): ScrollContainer | null => {
      const preferred =
        root.querySelector<HTMLElement>("div.chat-history-scroll-container") ?? // ❌ Priority 1
        root.querySelector<HTMLElement>("infinite-scroller.chat-history");      // Priority 2
      if (preferred) return preferred;
      // ... fallback logic
    };

New logic (correct):

    const findScrollContainer = (root: Element): ScrollContainer | null => {
      // Priority 1: infinite-scroller (actual scroll container)
      const infiniteScroller = root.querySelector<HTMLElement>("infinite-scroller.chat-history");
      if (infiniteScroller && infiniteScroller.scrollHeight > infiniteScroller.clientHeight) {
        return infiniteScroller;
      }

      // Priority 2: legacy container (backward compatibility)
      const legacyContainer = root.querySelector<HTMLElement>("div.chat-history-scroll-container");
      if (legacyContainer && legacyContainer.scrollHeight > legacyContainer.clientHeight) {
        return legacyContainer;
      }

      // Priority 3: fallback - find largest scrollable element
      const candidates = Array.from(root.querySelectorAll<HTMLElement>("*"));
      let best: ScrollContainer | null = null;
      let bestScrollHeight = 0;
      for (const candidate of candidates) {
        if (candidate.scrollHeight > candidate.clientHeight) {
          if (candidate.scrollHeight > bestScrollHeight) {
            best = candidate;
            bestScrollHeight = candidate.scrollHeight;
          }
        }
      }
      return best;
    };

### Change 2: Increase SCROLL_DELAY Constant

Modify line 11 to increase the scroll delay from 120ms to 300ms:

    // Before
    const SCROLL_DELAY = 120;  // ❌ Insufficient for virtual scrolling

    // After
    const SCROLL_DELAY = 300;  // ✅ Sufficient time for message loading

This increase is critical because the virtual scrolling mechanism requires approximately 200-300ms to add new messages to the DOM. With 120ms, subsequent scroll iterations occur before messages finish loading, causing message loss.

### Change 3: Update Documentation

Add a new section to `docs/gemini-structure-guide.md` after "Gemini Page Structure Characteristics" titled "Infinite Scroller and Virtual Scrolling Behavior (2026-01-11)" with the following content:

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
    - Scroll detection code location: `entrypoints/content.ts:17-37` (`findScrollContainer()`)
    - Scroll parameters (updated 2026-01-11):
      - `SCROLL_STEP = 1200px` (distance per iteration)
      - `SCROLL_DELAY = 300ms` (wait after each step) **← Changed from 120ms**
        - **Rationale**: Virtual scrolling requires ~200-300ms to load messages into DOM
        - 120ms was insufficient and caused message loss (only 14% retrieved)
        - 300ms ensures 100% message retrieval
      - `SCROLL_SETTLE_DELAY = 300ms` (wait before extraction)
      - `SCROLL_MAX_ITERATIONS = 60` (max loops, ~18 seconds timeout with 300ms delay)

Also update the "Mapping to Existing Implementation" section by adding after `- chat root detection: src/export/discovery.ts:147`:

    - scroll container detection: `entrypoints/content.ts:17`
      - Update priority order when scroll container changes.
      - Always verify `scrollHeight > clientHeight` to confirm scrollability.
      - `infinite-scroller.chat-history` is the primary container as of 2026-01-11.

## Concrete Steps

All commands should be run from the repository root directory `/Users/sotayamashita/Projects/autify/gemini-chat-exporter`.

### Step 1: Read Current Implementation

    # Read the current scroll container detection logic
    cat entrypoints/content.ts

Observe lines 10-13 (scroll constants) and lines 17-37 (findScrollContainer function).

Concrete transcript (working directory: `/Users/sotayamashita/Projects/autify/gemini-chat-exporter`):

    $ cat entrypoints/content.ts
    const SCROLL_STEP = 1200;
    const SCROLL_DELAY = 120;
    const SCROLL_SETTLE_DELAY = 300;
    const SCROLL_MAX_ITERATIONS = 60;
    const findScrollContainer = (root: Element): ScrollContainer | null => {
      const preferred =
        root.querySelector<HTMLElement>("div.chat-history-scroll-container") ??
        root.querySelector<HTMLElement>("infinite-scroller.chat-history");
      if (preferred) {
        return preferred;
      }
      ...
    };

### Step 2: Modify findScrollContainer() Function

Edit `entrypoints/content.ts` lines 17-37 to implement the new priority order with scrollability checks as described in "Plan of Work".

### Step 3: Update SCROLL_DELAY Constant

Edit `entrypoints/content.ts` line 11, changing:

    const SCROLL_DELAY = 120;

to:

    const SCROLL_DELAY = 300;

### Step 4: Update Documentation

Edit `docs/gemini-structure-guide.md` to add the new section "Infinite Scroller and Virtual Scrolling Behavior" with subsections:

- Scroll Container Hierarchy
- Virtual Scrolling Mechanism
- Auto Scroll-Back Feature
- Implementation Notes

Also update the "Mapping to Existing Implementation" section to reference scroll container detection at `entrypoints/content.ts:17`.

Concrete transcript (working directory: `/Users/sotayamashita/Projects/autify/gemini-chat-exporter`):

    $ sed -n '1,200p' entrypoints/content.ts
    const SCROLL_STEP = 1200;
    const SCROLL_DELAY = 300;
    const SCROLL_SETTLE_DELAY = 300;
    const SCROLL_MAX_ITERATIONS = 60;
    const findScrollContainer = (root: Element): ScrollContainer | null => {
      const infiniteScroller = root.querySelector<HTMLElement>("infinite-scroller.chat-history");
      if (infiniteScroller && infiniteScroller.scrollHeight > infiniteScroller.clientHeight) {
        return infiniteScroller;
      }
      const legacyContainer = root.querySelector<HTMLElement>("div.chat-history-scroll-container");
      if (legacyContainer && legacyContainer.scrollHeight > legacyContainer.clientHeight) {
        return legacyContainer;
      }
      ...
    };

    $ sed -n '1,200p' docs/gemini-structure-guide.md
    ## Infinite Scroller and Virtual Scrolling Behavior (2026-01-11)
    ...
    - scroll container detection: `entrypoints/content.ts:17`
      - Update priority order when scroll container changes.
      - Always verify `scrollHeight > clientHeight` to confirm scrollability.
      - `infinite-scroller.chat-history` is the primary container as of 2026-01-11.

### Step 5: Run Tests

    pnpm test

Expected output: All existing tests pass. The DOM structure changes do not affect the extraction logic tests in `src/export/extract.test.ts`.

Concrete transcript (working directory: `/Users/sotayamashita/Projects/autify/gemini-chat-exporter`):

    $ git commit -m "fix: prioritize infinite scroller detection"
    [STARTED] Running tasks for staged files...
    [STARTED] pnpm compile
    [COMPLETED] pnpm compile
    [STARTED] vitest run --reporter=dot --no-coverage --maxWorkers=4
    [COMPLETED] vitest run --reporter=dot --no-coverage --maxWorkers=4
    [fix/infinite-scroller-detection 4382468] fix: prioritize infinite scroller detection

### Step 6: Manual Verification

Build and load the extension, then export a known long chat:

    pnpm build
    # Load .output/chrome-mv3 in Chrome as unpacked extension
    # Navigate to https://gemini.google.com/app/cbb342fdc6010a5e
    # Click export button
    # Verify exported file contains 72 messages (36 user + 36 Gemini)

Concrete transcript (working directory: `/Users/sotayamashita/Projects/autify/gemini-chat-exporter`):

    $ pnpm build
    WXT 0.20.13
    ℹ Building chrome-mv3 for production with Vite 7.3.1
    ✔ Built extension in 539 ms
    ✔ Finished in 558 ms

## Validation and Acceptance

After implementation, the extension must export complete chat histories from long conversations.

### Acceptance Criteria

Test with chat ID `cbb342fdc6010a5e` which contains exactly 72 messages (36 user messages and 36 Gemini responses).

Before this change:

- Exported messages: approximately 10-20 (14-28% of total)
- Scroll container detected: `div.chat-history-scroll-container` (non-scrollable)
- Result: ❌ Incomplete export

After this change:

- Exported messages: 72 (100% of total)
- Scroll container detected: `infinite-scroller.chat-history` (scrollable)
- Console should show `scrollTop = 0` achieved
- Result: ✅ Complete export

### Test Command

Run existing unit tests:

    pnpm test

Expected: All tests pass. No regressions in message extraction logic.

Prior status (2026-01-11 12:27JST): Tests not run yet.

Updated status (2026-01-11 12:29JST): Tests executed via lint-staged (`pnpm compile` and `vitest run --reporter=dot --no-coverage --maxWorkers=4`) with no failures reported.

### Observable Behavior

1. Open browser DevTools console
2. Navigate to a long Gemini chat
3. Trigger export
4. Observe console logs showing scroll progress reaching `scrollTop = 0`
5. Verify exported file contains all messages from the conversation

Current status (2026-01-11 12:27JST): Manual verification not run yet.

Updated status (2026-01-11 12:30JST): Build completed; manual browser export and message count verification still pending.

## Idempotence and Recovery

All code changes are additive and maintain backward compatibility. The legacy scroll container selector remains as a fallback, so the change is safe even if Gemini's DOM structure varies across different chat pages.

If the implementation is interrupted:

- Code changes can be re-applied safely using the Edit tool
- Tests can be run multiple times without side effects
- Manual verification can be repeated with the same test chat

To rollback if needed:

    git checkout main -- entrypoints/content.ts docs/gemini-structure-guide.md

## Artifacts and Notes

### Playwright MCP Verification Results (2026-01-11)

Test URL: https://gemini.google.com/app/cbb342fdc6010a5e (long chat with 72 messages)

Before (current code):

- Scroll container: `div.chat-history-scroll-container` detected but NOT scrollable
  - scrollHeight = clientHeight = 1026px → scrollable distance = 0
- SCROLL_DELAY: 120ms (insufficient for virtual scrolling)
- Messages retrieved: 10 only (14% of 72 total)

After (modified logic with SCROLL_DELAY = 300ms):

- Scroll container: `infinite-scroller.chat-history` detected ✅
  - scrollHeight = 84,811px, clientHeight = 3,748px → scrollable ✅
- SCROLL_DELAY: 300ms (sufficient for virtual scrolling) ✅
- Messages retrieved: 36 user + 36 Gemini = 72 messages (100%) ✅
- scrollTop = 0 achieved: success ✅

Verification data:

    {
      "infiniteScroller": {
        "scrollTop": 0,
        "scrollHeight": 84811,
        "clientHeight": 3748,
        "isScrollable": true
      },
      "messages": {
        "totalHeadings": 75,
        "userButtonCount": 36,
        "geminiButtonCount": 108,
        "totalMessages": 72
      }
    }

### Performance Impact

- Scroll time per iteration: 120ms → 300ms (2.5x increase)
- Total scroll time for long chat (60 iterations): approximately 7.2s → 18s
- Tradeoff: Speed vs. Reliability → Reliability prioritized (100% message capture guaranteed)

### Backward Compatibility

The change maintains backward compatibility through:

1. Keeping `div.chat-history-scroll-container` as a fallback option
2. Preserving the generic fallback search for scrollable elements
3. Adding explicit scrollability validation before accepting any container

### Risk Assessment

Low Risk:

- Limited scope (single function modification)
- Backward compatibility maintained
- No impact on existing tests

Medium Risk:

- Very long chats (hundreds of messages) might not complete extraction before auto scroll-back
- Mitigation: Current `SCROLL_SETTLE_DELAY` of 300ms provides buffer time. Message extraction is synchronous and typically completes within 300ms.

### Files Modified

1. `entrypoints/content.ts`:
   - Lines 11: `SCROLL_DELAY` constant (1 line)
   - Lines 17-37: `findScrollContainer()` function (approximately 20 lines)
   - Total: approximately 21 lines modified

2. `docs/gemini-structure-guide.md`:
   - New section: "Infinite Scroller and Virtual Scrolling Behavior"
   - Updated section: "Mapping to Existing Implementation"
   - Estimated: 80-100 lines added

### Files Unchanged

- `src/export/extract.ts`: Message extraction logic (no changes needed)
- `src/export/discovery.ts`: Block detection logic (no changes needed)
- `src/export/markers.ts`: UI marker definitions (no changes needed)
- Test files: No new tests required; existing tests remain valid

## Interfaces and Dependencies

No new dependencies are introduced. The change modifies existing internal functions.

The `ScrollContainer` type is already defined in the codebase and represents an HTML element with scroll capabilities. It must have the properties `scrollTop`, `scrollHeight`, and `clientHeight`.

The `findScrollContainer()` function signature remains unchanged:

    function findScrollContainer(root: Element): ScrollContainer | null

Input: A root DOM element (typically the chat root)
Output: The scrollable container element, or null if none found

The function now implements a three-tier priority system:

1. First check `infinite-scroller.chat-history` with scrollability validation
2. Fallback to `div.chat-history-scroll-container` with scrollability validation
3. Fallback to generic search for largest scrollable element

Each tier validates that `scrollHeight > clientHeight` before accepting the container.

## Plan Update Notes

2026-01-11 12:27JST: Marked implementation tasks for scroll container detection, SCROLL_DELAY change, and documentation updates as complete; added concrete command transcripts and current validation status after applying the code and doc edits.
2026-01-11 12:29JST: Marked tests as complete after lint-staged ran `pnpm compile` and `vitest run`; added commit/test transcript and updated validation status.
2026-01-11 12:29JST: Clarified test status wording to avoid conflicting statuses.
2026-01-11 12:30JST: Added build transcript and marked manual verification as partially complete (build done, browser export pending).
