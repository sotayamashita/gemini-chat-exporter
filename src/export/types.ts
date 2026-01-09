/**
 * Role of a message in the export payload.
 */
export type ExportRole = "user" | "gemini" | "system";

/**
 * Serialized chat message data for export.
 */
export type ExportMessage = {
  role: ExportRole;
  markdown: string;
  text: string;
  timestamp: string | null;
  order: number;
};

/**
 * Export payload for a Gemini chat transcript.
 */
export type ExportPayload = {
  chatId: string | null;
  sourceUrl: string;
  messages: ExportMessage[];
};
