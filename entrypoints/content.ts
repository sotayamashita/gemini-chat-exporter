import { findChatRoot } from "@/src/export/discovery";
import { extractMessages } from "@/src/export/extract";
import type {
  ExportCurrentChatRequest,
  ExportCurrentChatResponse,
  ExportStatusUpdate,
} from "@/src/export/messages";
import { getChatIdFromUrl } from "@/src/export/url";

type ScrollResult = { ok: true } | { ok: false; error: string };

type ScrollContainer = HTMLElement;

const SCROLL_STEP = 1200;
const SCROLL_DELAY = 300;
const SCROLL_SETTLE_DELAY = 300;
const SCROLL_MAX_ITERATIONS = 60;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const findScrollContainer = (root: Element): ScrollContainer | null => {
  const infiniteScroller = root.querySelector<HTMLElement>("infinite-scroller.chat-history");
  if (infiniteScroller && infiniteScroller.scrollHeight > infiniteScroller.clientHeight) {
    return infiniteScroller;
  }

  const legacyContainer = root.querySelector<HTMLElement>("div.chat-history-scroll-container");
  if (legacyContainer && legacyContainer.scrollHeight > legacyContainer.clientHeight) {
    return legacyContainer;
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

const logScrollState = (
  label: string,
  container: ScrollContainer,
  iteration?: number,
  maxIterations?: number,
) => {
  const payload = {
    label,
    iteration,
    maxIterations,
    scrollTop: container.scrollTop,
    scrollHeight: container.scrollHeight,
    clientHeight: container.clientHeight,
  };
  console.log("[gemini-export] scroll", payload);
};

const autoScrollToTop = async (
  container: ScrollContainer,
  onPhase: (update: ExportStatusUpdate) => void,
): Promise<ScrollResult> => {
  const computedMaxIterations = Math.max(
    SCROLL_MAX_ITERATIONS,
    Math.ceil(container.scrollTop / SCROLL_STEP) + 5,
  );
  let previousTop = container.scrollTop;
  for (let iteration = 0; iteration < computedMaxIterations; iteration += 1) {
    if (iteration === 0) {
      onPhase({
        type: "export-status",
        phase: "scrolling",
        detail:
          container.scrollTop === 0 ? "Checking for older messages…" : "Scrolling chat history…",
      });
      logScrollState("start", container, iteration, computedMaxIterations);
    }
    const nextTop = Math.max(0, container.scrollTop - SCROLL_STEP);
    container.scrollTop = nextTop;
    await wait(SCROLL_DELAY);
    logScrollState("step", container, iteration, computedMaxIterations);

    if (container.scrollTop === 0) {
      await wait(SCROLL_SETTLE_DELAY);
      logScrollState("reached-top", container, iteration, computedMaxIterations);
      return { ok: true };
    }

    if (container.scrollTop === previousTop) {
      await wait(SCROLL_SETTLE_DELAY);
      if (container.scrollTop === previousTop) {
        logScrollState("stalled", container, iteration, computedMaxIterations);
        return {
          ok: false,
          error: "Chat scroll position did not change. Scroll to the top manually and try again.",
        };
      }
    }
    previousTop = container.scrollTop;
  }

  logScrollState("max-iterations", container, computedMaxIterations, computedMaxIterations);
  return {
    ok: false,
    error: "Chat history did not finish loading. Scroll to the top and try again.",
  };
};

const sendStatusUpdate = (update: ExportStatusUpdate) => {
  void browser.runtime.sendMessage(update);
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

  sendStatusUpdate({
    type: "export-status",
    phase: "scrolling",
    detail: "Checking for older messages…",
  });
  const scrollResult = await autoScrollToTop(scrollContainer, sendStatusUpdate);
  if (!scrollResult.ok) {
    sendStatusUpdate({ type: "export-status", phase: "done" });
    return { ok: false, error: scrollResult.error };
  }

  sendStatusUpdate({
    type: "export-status",
    phase: "extracting",
    detail: "Collecting messages…",
  });
  const messages = extractMessages(root);
  if (messages.length === 0) {
    sendStatusUpdate({ type: "export-status", phase: "done" });
    return { ok: false, error: "No messages were found in the current chat." };
  }

  sendStatusUpdate({ type: "export-status", phase: "done" });
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
