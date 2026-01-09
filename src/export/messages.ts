import type { ExportPayload } from "@/src/export/types";

export type ExportCurrentChatRequest = { type: "export-current-chat" };
export type ExportCurrentChatResponse =
  | { ok: true; payload: ExportPayload }
  | { ok: false; error: string };

export type DownloadExportRequest = {
  type: "download-export";
  payload: { filename: string; markdown: string };
};
export type DownloadExportResponse = { ok: true } | { ok: false; error: string };

export type ExtensionMessage = ExportCurrentChatRequest | DownloadExportRequest;
