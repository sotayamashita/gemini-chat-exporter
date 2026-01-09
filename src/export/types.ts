export type ExportRole = "user" | "gemini" | "system";

export type ExportMessage = {
  role: ExportRole;
  markdown: string;
  text: string;
  timestamp: string | null;
  order: number;
};

export type ExportPayload = {
  chatId: string | null;
  sourceUrl: string;
  messages: ExportMessage[];
};
