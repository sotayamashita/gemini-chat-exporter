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
