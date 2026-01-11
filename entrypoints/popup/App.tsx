import { useEffect, useState } from "react";
import type {
  DownloadExportResponse,
  ExportCurrentChatResponse,
  ExportStatusUpdate,
} from "@/src/export/messages";
import { formatExportMarkdown } from "@/src/export/serialize";
import { getLocalIsoTimestamp } from "@/src/export/time";
import { getChatIdFromUrl } from "@/src/export/url";
import "./App.css";

type StatusState = "idle" | "working" | "success" | "error";

type Status = {
  state: StatusState;
  message: string;
};

type DebugEntry = {
  label: string;
  value: string;
};

const idleStatus: Status = {
  state: "idle",
  message: "Ready to export the current Gemini chat.",
};

const isGeminiChatUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "gemini.google.com" && parsed.pathname.startsWith("/app");
  } catch {
    return false;
  }
};

const downloadFromPopup = async (filename: string, markdown: string) => {
  const url = `data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`;
  await browser.downloads.download({
    url,
    filename,
    saveAs: false,
  });
};

function App() {
  const [status, setStatus] = useState<Status>(idleStatus);
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([]);

  useEffect(() => {
    const handleStatusUpdate = (message: ExportStatusUpdate) => {
      if (message?.type !== "export-status") {
        return;
      }
      setStatus((current) => {
        if (current.state !== "working") {
          return current;
        }
        if (message.phase === "done") {
          return current;
        }
        return {
          state: "working",
          message: message.detail ?? "Collecting messages…",
        };
      });
    };

    browser.runtime.onMessage.addListener(handleStatusUpdate);
    return () => {
      browser.runtime.onMessage.removeListener(handleStatusUpdate);
    };
  }, []);

  const setDebug = (entries: DebugEntry[] | ((prev: DebugEntry[]) => DebugEntry[])) => {
    setDebugEntries(entries);
  };

  const handleExport = async () => {
    setStatus({ state: "working", message: "Preparing export…" });
    setDebug([]);

    try {
      const [tab] = await browser.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      console.log("[gemini-export] active tab", tab);
      setDebug([
        { label: "tabId", value: tab?.id ? String(tab.id) : "none" },
        { label: "tabUrl", value: tab?.url ?? "none" },
      ]);
      if (!tab?.id || !tab.url) {
        setStatus({ state: "error", message: "No active tab found." });
        return;
      }

      if (!isGeminiChatUrl(tab.url)) {
        setStatus({
          state: "error",
          message: "Open a Gemini chat tab to export messages.",
        });
        return;
      }

      const chatId = getChatIdFromUrl(tab.url);
      if (!chatId) {
        setStatus({
          state: "error",
          message: "Open a specific chat thread before exporting.",
        });
        return;
      }

      const response = (await browser.tabs.sendMessage(tab.id, {
        type: "export-current-chat",
      })) as ExportCurrentChatResponse | undefined;
      console.log("[gemini-export] export response", response);
      setDebug((entries: DebugEntry[]) => [
        ...entries,
        {
          label: "response",
          value: response ? JSON.stringify(response) : "undefined",
        },
      ]);

      if (!response) {
        setStatus({
          state: "error",
          message: "Content script not available. Reload the Gemini tab and try again.",
        });
        return;
      }

      if (!response.ok) {
        setStatus({ state: "error", message: response.error });
        return;
      }

      const generatedAt = getLocalIsoTimestamp();
      const markdown = formatExportMarkdown(response.payload, generatedAt);
      const filename = `${chatId}.md`;

      const downloadResponse = (await browser.runtime.sendMessage({
        type: "download-export",
        payload: { filename, markdown },
      })) as DownloadExportResponse | undefined;

      if (!downloadResponse) {
        try {
          await downloadFromPopup(filename, markdown);
          setStatus({
            state: "success",
            message: `Exported ${response.payload.messages.length} messages to ${filename}.`,
          });
          return;
        } catch (error) {
          console.warn("[gemini-export] popup download failed", error);
          setStatus({
            state: "error",
            message: "Background script not available. Reload the extension and try again.",
          });
          return;
        }
      }

      if (!downloadResponse.ok) {
        setStatus({ state: "error", message: downloadResponse.error });
        return;
      }

      setStatus({
        state: "success",
        message: `Exported ${response.payload.messages.length} messages to ${filename}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export failed.";
      console.warn("[gemini-export] export error", error);
      if (message.includes("Receiving end does not exist")) {
        setStatus({
          state: "error",
          message: "Content script not ready. Reload the Gemini tab and try again.",
        });
        return;
      }
      setStatus({
        state: "error",
        message,
      });
    }
  };

  return (
    <div className="popup">
      <header className="popup__header">
        <div className="popup__title">Gemini Chat Export</div>
        <div className="popup__subtitle">Export the open thread as Markdown.</div>
      </header>

      <section className={`popup__status popup__status--${status.state}`}>{status.message}</section>

      <button
        className="popup__button"
        onClick={handleExport}
        disabled={status.state === "working"}
        type="button"
      >
        {status.state === "working" ? "Exporting…" : "Export current chat"}
      </button>

      <footer className="popup__footer">
        <span>Tip: scroll to the very top for long chats.</span>
        {debugEntries.length > 0 ? (
          <details className="popup__debug">
            <summary>Debug: Downloaded chat content</summary>
            <div className="popup__debug-body">
              {debugEntries.map((entry) => (
                <div key={entry.label}>
                  {entry.label}: {entry.value}
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </footer>
    </div>
  );
}

export default App;
