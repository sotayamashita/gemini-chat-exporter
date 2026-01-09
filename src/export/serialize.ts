import type { ExportPayload, ExportRole } from "@/src/export/types";

/**
 * Maps an export role to its display label for markdown headings.
 */
const roleLabel = (role: ExportRole) => {
  if (role === "user") {
    return "User";
  }
  if (role === "gemini") {
    return "Gemini";
  }
  return "System";
};

/**
 * Builds a markdown document from the export payload.
 *
 * @param payload - The chat export payload to serialize.
 * @param generatedAtIso - ISO-8601 timestamp to embed in the header.
 * @returns The markdown representation of the chat.
 */
export function formatExportMarkdown(payload: ExportPayload, generatedAtIso: string): string {
  const lines: string[] = [];
  lines.push(`<!-- gemini-export: generated-at=${generatedAtIso} -->`);
  lines.push(`<!-- gemini-export: source-url=${payload.sourceUrl} -->`, "");

  for (const message of payload.messages) {
    const label = roleLabel(message.role);
    const heading = message.timestamp ? `${label} (${message.timestamp})` : label;
    lines.push(`## ${heading}`, "");
    if (message.markdown) {
      lines.push(message.markdown.trim(), "");
    } else if (message.text) {
      lines.push(message.text.trim(), "");
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}
