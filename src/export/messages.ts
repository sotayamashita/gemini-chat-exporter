import type { ExportPayload } from "@/src/export/types";

/**
 * Request to extract the current chat content from the page.
 */
export type ExportCurrentChatRequest = { type: "export-current-chat" };
/**
 * Response for the chat export request.
 */
export type ExportCurrentChatResponse =
  | { ok: true; payload: ExportPayload }
  | { ok: false; error: string };

/**
 * Request to trigger a markdown download from the popup/background.
 */
export type DownloadExportRequest = {
  type: "download-export";
  payload: { filename: string; markdown: string };
};
/**
 * Response for the download request.
 */
export type DownloadExportResponse = { ok: true } | { ok: false; error: string };

/**
 * Union of extension message request types.
 */
export type ExtensionMessage = ExportCurrentChatRequest | DownloadExportRequest;
