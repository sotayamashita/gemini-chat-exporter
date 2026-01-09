import { findChatRoot } from "@/src/export/discovery";
import { extractMessages } from "@/src/export/extract";
import type { ExportCurrentChatRequest, ExportCurrentChatResponse } from "@/src/export/messages";
import { getChatIdFromUrl } from "@/src/export/url";

type ScrollResult = { ok: true } | { ok: false; error: string };

type ScrollContainer = HTMLElement;

const SCROLL_STEP = 1200;
const SCROLL_DELAY = 120;
const SCROLL_SETTLE_DELAY = 300;
const SCROLL_MAX_ITERATIONS = 60;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const findScrollContainer = (root: Element): ScrollContainer | null => {
  const preferred =
    root.querySelector<HTMLElement>("div.chat-history-scroll-container") ??
    root.querySelector<HTMLElement>("infinite-scroller.chat-history");
  if (preferred) {
    return preferred;
  }

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

const autoScrollToTop = async (container: ScrollContainer): Promise<ScrollResult> => {
  let previousTop = container.scrollTop;
  for (let iteration = 0; iteration < SCROLL_MAX_ITERATIONS; iteration += 1) {
    const nextTop = Math.max(0, container.scrollTop - SCROLL_STEP);
    container.scrollTop = nextTop;
    await wait(SCROLL_DELAY);

    if (container.scrollTop === 0) {
      await wait(SCROLL_SETTLE_DELAY);
      return { ok: true };
    }

    if (container.scrollTop === previousTop) {
      await wait(SCROLL_SETTLE_DELAY);
      if (container.scrollTop === previousTop) {
        return {
          ok: false,
          error: "Chat scroll position did not change. Scroll to the top manually and try again.",
        };
      }
    }
    previousTop = container.scrollTop;
  }

  return {
    ok: false,
    error: "Chat history did not finish loading. Scroll to the top and try again.",
  };
};

const handleExport = async (): Promise<ExportCurrentChatResponse> => {
  const chatId = getChatIdFromUrl(window.location.href);
  if (!chatId) {
    return { ok: false, error: "Open a Gemini chat thread before exporting." };
  }

  const root = findChatRoot(document);
  if (!root) {
    return { ok: false, error: "Unable to locate the chat thread on this page." };
  }

  const scrollContainer = findScrollContainer(root);
  if (!scrollContainer) {
    return {
      ok: false,
      error: "Unable to locate the chat scroll area. Reload Gemini and try again.",
    };
  }

  const scrollResult = await autoScrollToTop(scrollContainer);
  if (!scrollResult.ok) {
    return { ok: false, error: scrollResult.error };
  }

  const messages = extractMessages(root);
  if (messages.length === 0) {
    return { ok: false, error: "No messages were found in the current chat." };
  }

  return { ok: true, payload: { chatId, sourceUrl: window.location.href, messages } };
};

export default defineContentScript({
  matches: ["https://gemini.google.com/*"],
  main() {
    console.log("[gemini-export] content script loaded", window.location.href);
    browser.runtime.onMessage.addListener(
      (message: ExportCurrentChatRequest, _sender, sendResponse) => {
        if (message?.type === "export-current-chat") {
          console.log("[gemini-export] export message received");
          void handleExport()
            .then((response) => sendResponse(response))
            .catch((error) => {
              console.error("[gemini-export] export failed", error);
              sendResponse({
                ok: false,
                error: error instanceof Error ? error.message : "Export failed.",
              });
            });
          return true;
        }
        return false;
      },
    );
  },
});
