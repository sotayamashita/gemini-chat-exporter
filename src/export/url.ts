/**
 * Extracts the chat identifier from a Gemini app URL.
 *
 * @param url - The URL string to parse.
 * @returns The chat ID when present, otherwise null.
 */
export function getChatIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/app\/?([^/?#]+)?/);
    if (!match) {
      return null;
    }
    const id = match[1];
    if (!id) {
      return null;
    }
    return id.trim() || null;
  } catch {
    return null;
  }
}
