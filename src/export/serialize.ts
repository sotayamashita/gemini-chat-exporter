import type { ExportPayload, ExportRole } from "@/src/export/types";

const roleLabel = (role: ExportRole) => {
  if (role === "user") {
    return "User";
  }
  if (role === "gemini") {
    return "Gemini";
  }
  return "System";
};

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
