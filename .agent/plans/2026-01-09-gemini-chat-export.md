# Plan: Export Current Gemini Conversation via WXT Chrome Extension

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked in at `.agent/PLANS.md`. This document must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, a user can open a Gemini chat page at `https://gemini.google.com/app/{chat_id}`, click the extension popup, and export the currently open conversation to a Markdown file that downloads to their machine. The behavior is visible and verifiable: the exported file contains the visible messages from the current chat, with roles and formatting preserved as best as the DOM allows. The extension will not attempt to export multiple chats or history lists, only the single currently open chat.

## Progress

- [x] (2026-01-09 00:00Z) Created initial ExecPlan scoped to exporting the current Gemini chat via popup-triggered download.
- [x] (2026-01-09 00:20Z) Inspected Gemini chat DOM while logged in and captured candidate markers for user vs. Gemini messages and code blocks.
- [x] (2026-01-09 00:30Z) Added minimal DOM structure cues needed to guide extraction logic.
- [ ] Implement message extraction in content script and message passing to background/popup.
- [ ] Implement download flow and popup UI wiring; validate end-to-end export.

## Surprises & Discoveries

- Observation: User messages appear to be grouped with a heading element and a “プロンプトをコピー” button, while Gemini responses include a “思考プロセスを表示” button and feedback controls (“良い回答/悪い回答”), which can serve as role markers.
  Evidence: Playwright snapshot of a logged-in chat shows a user block containing heading level 2 and a copy-prompt button, followed by a response block with “思考プロセスを表示” and feedback buttons.

- Observation: Code blocks in responses appear as a container with a language label and a “コードをコピー” button, followed by a `code` element with text nodes per line.
  Evidence: Snapshot shows a “Python” label, “コードをコピー” button, and a `code` element containing multiple text nodes.

- Observation: No explicit per-message timestamps are visible in the current Gemini web UI snapshot.
  Evidence: Snapshot includes message text, controls, and headings but no time labels near each message.

- Observation: The long chat page loads with a progress bar (“会話を読み込んでいます”) but does not show an explicit “load more” marker once content is rendered; content appears in a scrollable region with large DOM output.
  Evidence: Playwright snapshot of `https://gemini.google.com/app/cbb342fdc6010a5e` shows an initial progressbar and then a large rendered message area without a visible “load more” affordance.

- Observation: The primary scroll container appears to be an `infinite-scroller.chat-history` element inside a `div.chat-history-scroll-container`.
  Evidence: Playwright evaluation on `https://gemini.google.com/app/cbb342fdc6010a5e` found the largest scrollable element with tag `infinite-scroller` and class `chat-history`.

## Decision Log

- Decision: Export only the currently open conversation and only via the extension popup, producing a file download.
  Rationale: Matches the user's requested scope and keeps permissions and UX minimal.
  Date/Author: 2026-01-09 / Codex

- Decision: Prefer Markdown output and treat DOM reality as the source of truth for what can be exported.
  Rationale: User preference is Markdown, but the Gemini UI structure must be validated to ensure feasibility.
  Date/Author: 2026-01-09 / Codex

- Decision: Identify user vs. Gemini messages using stable UI text markers (copy-prompt button and “思考プロセスを表示” / feedback controls) instead of class names.
  Rationale: Gemini’s DOM uses generated class names; aria labels and visible control text are more stable across builds and locales (Japanese UI observed).
  Date/Author: 2026-01-09 / Codex

- Decision: Treat timestamps as optional and only include them if a stable, per-message time marker is found; otherwise export null.
  Rationale: The observed UI does not show per-message timestamps, so the exporter must not fabricate them.
  Date/Author: 2026-01-09 / Codex

- Decision: Do not implement multi-locale label mapping; rely on the current UI language and structural markers.
  Rationale: User requested “UI locale as-is,” so we will not maintain a cross-locale label table in v1.
  Date/Author: 2026-01-09 / Codex

- Decision: Use Markdown format with per-message headings and optional timestamps (Markdown option 2).
  Rationale: This keeps the log readable, clearly separates roles, and can include timestamps when present.
  Date/Author: 2026-01-09 / Codex

- Decision: Name the downloaded file using the chat ID extracted from the URL path (e.g., `735afd264d35c312.md`).
  Rationale: The user requested that the chat ID be used as the filename for clarity and stability.
  Date/Author: 2026-01-09 / Codex

- Decision: Wrap extracted code and table blocks with HTML comment anchors that include type and stable IDs (message index + block index).
  Rationale: The user wants stable anchors for post-processing with an LLM and clear repair boundaries.
  Date/Author: 2026-01-09 / Codex

- Decision: Show errors only inside the popup UI (no system notifications).
  Rationale: User confirmed popup-only errors are sufficient.
  Date/Author: 2026-01-09 / Codex

- Decision: Include export date metadata at the top of the Markdown file.
  Rationale: User asked to include date metadata; this helps provenance.
  Date/Author: 2026-01-09 / Codex

- Decision: Ignore images in export (no URLs or alt text).
  Rationale: User requested images be ignored.
  Date/Author: 2026-01-09 / Codex

## Outcomes & Retrospective

No implementation yet. This section will be updated after milestones complete.

## Context and Orientation

This repository is a WXT-based Chrome extension with TypeScript and React. The extension entrypoints live under `entrypoints/`: `entrypoints/background.ts` for the background service worker, `entrypoints/content.ts` for content scripts, and `entrypoints/popup/` for the popup UI (React app in `App.tsx`). Static assets are in `public/` and shared UI assets in `assets/`. The WXT config is `wxt.config.ts` and tooling is defined in `package.json`.

A “content script” is code that runs inside the web page (here, `gemini.google.com`) and can read the DOM. A “background” script is the extension’s service worker that can use privileged APIs such as downloads. The popup is the small UI shown when clicking the extension icon.

The goal is to extract the visible conversation from the Gemini page DOM in the content script, send the structured data to the background/popup via runtime messaging, and trigger a file download containing Markdown.

## Plan of Work

First, confirm the Gemini DOM structure for a single chat in order to define stable selectors for message containers, roles, and message content. This was done with a logged-in Playwright snapshot. Role detection should rely on UI markers rather than class names. In the observed UI (Japanese locale), user messages are grouped with a “プロンプトをコピー” button and a heading element that mirrors the user text. Gemini responses include a “思考プロセスを表示” control and feedback buttons (“良い回答/悪い回答”). Code blocks show a language label (e.g., “Python”), a “コードをコピー” button, and a `code` element containing text nodes. If the DOM varies, prefer aria-labels and text markers over class names.

Next, implement content script extraction in `entrypoints/content.ts`. Define a function that scans the page and returns a structured array of messages, each including role, plain text, an optional timestamp, and a best-effort Markdown serialization of rich content (paragraphs, lists, code blocks, tables). Provide robust guards to avoid exporting empty or irrelevant nodes. The content script should respond to a runtime message such as `export-current-chat` and return the structured data.

The extraction algorithm should explicitly distinguish user vs. Gemini messages. The recommended approach is:

1) Find the main chat region under the “Gemini との会話” heading and iterate its direct message group containers in DOM order.
2) For each candidate group, identify role markers:
   - User marker: presence of a button with aria-label/text “プロンプトをコピー” and a nearby heading level 2 containing the user prompt text.
   - Gemini marker: presence of a button with aria-label/text “思考プロセスを表示” OR feedback controls (“良い回答”/“悪い回答”).
3) If both markers appear due to nested structure, scope to the smallest container that contains exactly one marker set and treat it as a single message block.
4) Extract content:
   - User: take the heading level 2 text as the message body; also include any paragraphs within the same block if present.
   - Gemini: serialize paragraph elements to Markdown, serialize lists to Markdown lists, and serialize code blocks by reading the `code` element and wrapping with triple backticks and the language label if present.
   - Tables: serialize to Markdown table if the structure is simple; otherwise fall back to plain text with row separators.
5) Timestamp: attempt to locate a time element within the message block (e.g., `time` tag or a recognizable aria-label). If none is found, set timestamp to null; do not synthesize timestamps from ordering.

DOM traversal order and fallback rules (additive, deterministic):

- Primary container discovery:
  - Locate the first heading element with text “Gemini との会話” (locale-dependent; fallback to “Conversation with Gemini”).
  - Use its nearest ancestor that contains both the heading and multiple message blocks as the chat root.
  - If heading lookup fails, fallback to scanning `main` for repeated blocks that include either “プロンプトをコピー” or “思考プロセスを表示”.

- Message block discovery (in-order):
  - Within the chat root, find all descendants that contain either marker button text.
  - For each marker node, climb up the DOM tree to the smallest ancestor that also contains the corresponding message text (heading level 2 for user, paragraphs for Gemini).
  - De-duplicate blocks by reference equality of the ancestor element.
  - Sort blocks by their document order using `compareDocumentPosition` to preserve chat order.

- Role assignment:
  - If a block contains user marker(s) and not Gemini markers, role = user.
  - If a block contains Gemini marker(s) and not user markers, role = gemini.
  - If both are present, split into two blocks:
    - user block: nearest ancestor of the user marker that contains the heading level 2.
    - gemini block: nearest ancestor of the “思考プロセスを表示” button that contains paragraphs.
  - If neither marker is present but the block is adjacent to a user marker (previous sibling) and contains paragraphs, treat as gemini (fallback for layout variants).

- Content extraction details:
  - Use `innerText` for plain text fallback, but build Markdown by walking the block’s DOM tree and mapping tags:
    - `p` => paragraph with blank line separation
    - `h3` => “### ” prefix (avoid using h1/h2 in export to prevent collisions with message headers)
    - `ul`/`ol` => list items with “- ” or “1. ” prefixes
    - `code` inside pre-like container => fenced code block with optional language label from nearby text node, wrapped with HTML comment anchors and stable IDs
    - `table` => attempt Markdown table; if >20 columns or nested elements, fallback to plain text rows joined by “ | ”, wrapped with HTML comment anchors and stable IDs
  - For the user block, prefer the heading level 2 text as the primary body; ignore UI button labels.
  - Strip UI affordances (“プロンプトをコピー”, “思考プロセスを表示”, feedback labels) from output.
  - Ignore images entirely (do not emit Markdown image syntax or URLs).

- Timestamp extraction:
  - Search within block for `time` elements or nodes with aria-label containing a time pattern (e.g., “HH:MM” or locale-specific). If found, store the string as-is.
  - If multiple candidates, choose the first in document order.
  - If none found, leave `timestamp` as null.

- Long chat detection (best-effort):
  - Identify the primary scroll container for the chat region.
  - If the container is scrollable (`scrollHeight > clientHeight`), check whether the user is at the very top (`scrollTop === 0`) after auto-scroll completes.
  - If `scrollTop > 0`, treat as “auto-scroll incomplete” and require the user to press Export again after manual adjustment.
  - If no scroll container can be identified, do not warn; proceed to auto-scroll fallback behavior.

- Long chat handling (auto-scroll strategy, preferred):
  - Before extraction, the content script should automatically scroll the chat container to the very top in steps to force older messages to render.
  - After reaching the top, wait briefly for DOM to stabilize, then perform extraction.
  - Use a bounded loop with a max duration and step count to avoid infinite scrolling if the page virtualizes without end.
  - If auto-scroll fails to reach the top or the container cannot be found, do not export yet; show a popup message asking the user to try again after manual confirmation (same Export button).
  - Suggested bounds based on Playwright probe of a long chat:
    - Step size: 1200px per tick.
    - Delay: 120ms between ticks, plus a one-time 300ms wait when scrollTop stops changing.
    - Max iterations: 60 (≈ 7–10 seconds total).
    - Stop conditions: `scrollTop === 0`, or scrollTop unchanged after the extra wait.

User-facing flow (auto-scroll + retry):

- User clicks Export.
- Extension attempts auto-scroll to the top and extracts messages if successful.
- If auto-scroll cannot reach the top, the popup instructs the user to try again, and the user re-presses Export after manual adjustment.

Markdown output format (fixed):

- Emit a small metadata header at the top of the file before messages:
  - `<!-- gemini-export: generated-at=YYYY-MM-DDTHH:MM:SS±HH:MM -->` (use ISO 8601 local time with timezone offset, e.g., `2026-01-09T12:12:45+09:00`)
  - blank line
- Each message is emitted as a heading block:
  - `## User` or `## Gemini`
  - If `timestamp` is present, append it in parentheses: `## User (2026-01-09 10:30)`
- Message body follows the heading, separated by a blank line.
- Preserve code blocks, lists, and tables using the Markdown rules described above.
- Wrap code blocks and tables with HTML comment anchors that carry type and IDs so they can be post-processed later. Use the message index (1-based) and per-message block index (1-based) to build IDs.
  - Code:
    - `<!-- gemini-export:block type=code id=msg-12-code-1 lang=python -->`
    - ```python
      ...code...
      ```
    - `<!-- /gemini-export:block -->`
  - Table:
    - `<!-- gemini-export:block type=table id=msg-12-table-1 -->`
    - (Markdown table or plaintext fallback)
    - `<!-- /gemini-export:block -->`

- Safety:
  - Skip blocks that produce empty text after removing UI labels.
  - Cap per-message extracted text length if necessary (e.g., 200k characters) to avoid huge downloads on malformed DOM.

Then, wire the popup UI in `entrypoints/popup/App.tsx` to send a message to the content script in the active tab, receive the exported data, and show basic status (idle / exporting / error). The popup should expose a single primary action, “Export current chat.” If the active tab is not a Gemini chat page, show a clear message.

Finally, implement the download flow in `entrypoints/background.ts`. When the popup receives data, it should request the background to trigger a download using the `downloads` API. The background should create a Blob URL (or use a data URL) and call `chrome.downloads.download` with a filename derived from the chat id. Ensure permissions are set in the WXT config for downloads and host access to `https://gemini.google.com/app/*`.

Update: the filename must be the chat ID from the URL path (e.g., URL `https://gemini.google.com/app/735afd264d35c312` -> filename `735afd264d35c312.md`). If no chat ID is present (e.g., `/app` without ID), show an error in the popup and skip download.

## Concrete Steps

1) Inspect Gemini DOM to define selectors and export mapping.
   - Method A (preferred): Use Playwright MCP to open `https://gemini.google.com/app/{chat_id}` and inspect nodes for message roles and content. This requires login; ask the user to log in when needed.
   - Method B (fallback): Manual inspection in a logged-in browser, then document selectors in this plan.

2) Update `wxt.config.ts` (and any required WXT manifest config) to include host permissions for `https://gemini.google.com/app/*` and the `downloads` permission.

3) Implement content extraction in `entrypoints/content.ts`.
   - Add a message handler for `export-current-chat`.
   - Return `chatId` plus an array of `{ role, markdown, text, timestamp, order }` objects.

4) Implement popup UI in `entrypoints/popup/App.tsx`.
   - Add a single export button and status text.
   - Use `chrome.tabs.query` to find the active tab and send a message to the content script.

5) Implement background download in `entrypoints/background.ts`.
   - Add a message handler for `download-export` with payload `{ filename, markdown }`.
   - Call `chrome.downloads.download` with a blob or data URL.

6) Validate end-to-end behavior by opening a Gemini chat and exporting to a Markdown file.

All steps should be executed in the repository root: `/Users/sotayamashita/Projects/autify/gemini-chat-exporter`.

## Validation and Acceptance

Acceptance is a user-visible behavior. The following must be true:

- When a user opens `https://gemini.google.com/app/{chat_id}`, opens the extension popup, and clicks “Export current chat,” a Markdown file downloads.
- The Markdown file contains the conversation in order, clearly separating user and model messages (for example with headings like “User” and “Gemini”).
- If the popup is opened on a non-Gemini page, it shows an error or guidance instead of exporting.
- The downloaded filename equals the chat ID plus `.md` (e.g., `735afd264d35c312.md`).
- The first lines of the Markdown file include an export date metadata comment.

Edge and failure flows to validate:

- If the active tab is `https://gemini.google.com/app` without a chat ID, the popup shows an error (“Open a chat first”) and no download occurs.
- If the active tab is not on `gemini.google.com`, the popup disables export and explains the requirement.
- If the page has not fully rendered messages (long chats or lazy loading), auto-scroll attempts to load more; if it cannot reach the top, the popup requests a retry instead of exporting partial content.
- If DOM markers cannot be found (UI changes or locale mismatch), the popup shows a clear error and does not download an empty file.
- If Markdown conversion fails for tables or code blocks, the export still completes with fallback text wrapped in anchors.
- If auto-scroll cannot reach the top, the popup instructs the user to scroll and press Export again; no file is downloaded in that attempt.
- If the scroll container cannot be found (DOM changes), show a clear error and suggest retrying later.
- If extraction yields zero messages, show a “no messages found” error and do not download.
- If the user interacts with the page during auto-scroll and the scroll position stops changing, stop and prompt for retry.

Manual validation steps:

- Run `pnpm compile` and expect no TypeScript errors.
- Load the extension in Chrome and open a Gemini chat page.
- Click the popup export button and verify a file downloads and content matches the page.

## Idempotence and Recovery

All steps are additive and can be repeated without side effects. If downloads fail, retry from the popup and inspect the background console for errors. If DOM selectors change, update only the content script extraction function and re-run the manual export validation.

## Artifacts and Notes

When the DOM inspection is done, record the key selectors here in prose with minimal examples. For example, note the container that wraps a single message and the element that indicates the speaker role. Include a short snippet of a sample message tree as plain indented text, not a fenced code block.

Sample DOM cues observed in a logged-in chat (Japanese UI, simplified):

    heading "Gemini との会話"
      (user message block)
        button "プロンプトをコピー"
        heading level 2: <user message text>
      (gemini response block)
        button "思考プロセスを表示"
        paragraphs with response text
        button "良い回答" / button "悪い回答"
        (code block)
          label: "Python"
          button "コードをコピー"
          code: <code lines>

Minimal DOM structure (only what the plan relies on):

    main
      (chat region)
        heading "Gemini との会話"
        (message group container)*
          (user block)
            button "プロンプトをコピー"
            heading level=2 (user text)
          (gemini block)
            button "思考プロセスを表示"
            paragraph+
            button "良い回答" / "悪い回答"
          (optional rich content)
            code block: label + "コードをコピー" + code element
            table element with optional export/copy buttons

The extraction should treat each user block and each gemini block as individual messages in order.

## Interfaces and Dependencies

Use only the existing WXT, React, and Chrome extension APIs. No new libraries are required.

In `entrypoints/content.ts`, define a handler with this shape:

    type ExportMessage = {
      role: "user" | "gemini" | "system";
      markdown: string;
      text: string;
      timestamp: string | null;
      order: number;
    };

    type ExportPayload = {
      chatId: string | null;
      messages: ExportMessage[];
    };

    // responds to runtime message: { type: "export-current-chat" }
    // returns ExportPayload

In `entrypoints/background.ts`, handle:

    // runtime message: { type: "download-export", payload: { filename: string, markdown: string } }

In `entrypoints/popup/App.tsx`, implement the UI and the message dispatch to the active tab, then forward the result to the background download handler.

---

Plan change note: Initial plan created on 2026-01-09 to focus on export of the current Gemini chat via popup-triggered Markdown download, with DOM inspection as the first milestone.

Plan change note: Added minimal DOM structure cues and clarified where user vs. Gemini blocks appear to guide extraction logic without relying on full DOM dumps.

Plan change note: Added explicit auto-scroll retry flow, aligned long-chat handling with “retry instead of partial export,” and clarified export payload fields.
    scroll container (observed):
      infinite-scroller.chat-history
      div.chat-history-scroll-container
