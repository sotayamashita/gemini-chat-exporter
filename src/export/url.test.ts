import { describe, expect, it } from "vitest";

import { getChatIdFromUrl } from "@/src/export/url";

describe("url parsing", () => {
  describe("getChatIdFromUrl", () => {
    // 等価分割 - 有効なURLパターン
    describe("valid URL patterns", () => {
      it("extracts chat ID from standard URL", () => {
        const url = "https://gemini.google.com/app/abc123def456";
        expect(getChatIdFromUrl(url)).toBe("abc123def456");
      });

      it("extracts chat ID from URL with trailing slash", () => {
        const url = "https://gemini.google.com/app/abc123/";
        expect(getChatIdFromUrl(url)).toBe("abc123");
      });

      it("extracts chat ID from URL with query parameters", () => {
        const url = "https://gemini.google.com/app/chat789?hl=ja";
        expect(getChatIdFromUrl(url)).toBe("chat789");
      });

      it("extracts chat ID from URL with hash fragment", () => {
        const url = "https://gemini.google.com/app/xyz#section";
        expect(getChatIdFromUrl(url)).toBe("xyz");
      });

      it("extracts chat ID from URL with additional path segments", () => {
        const url = "https://gemini.google.com/app/abc/extra";
        expect(getChatIdFromUrl(url)).toBe("abc");
      });

      it("extracts chat ID with hyphens and underscores", () => {
        const url = "https://gemini.google.com/app/chat-id_123";
        expect(getChatIdFromUrl(url)).toBe("chat-id_123");
      });
    });

    // 境界値分析 - ID長
    describe("ID length boundary values", () => {
      it("extracts single character ID", () => {
        const url = "https://gemini.google.com/app/a";
        expect(getChatIdFromUrl(url)).toBe("a");
      });

      it("extracts standard length ID (10-20 chars)", () => {
        const url = "https://gemini.google.com/app/abc1234567890";
        expect(getChatIdFromUrl(url)).toBe("abc1234567890");
      });

      it("extracts very long ID (100+ chars)", () => {
        const longId = "a".repeat(150);
        const url = `https://gemini.google.com/app/${longId}`;
        expect(getChatIdFromUrl(url)).toBe(longId);
      });
    });

    // ブランチカバレッジ - 無効なパターン
    describe("invalid URL patterns", () => {
      it("returns null for /app without ID", () => {
        const url = "https://gemini.google.com/app";
        expect(getChatIdFromUrl(url)).toBeNull();
      });

      it("returns null for /app/ without ID", () => {
        const url = "https://gemini.google.com/app/";
        expect(getChatIdFromUrl(url)).toBeNull();
      });

      it("returns null for URL with only whitespace ID", () => {
        const url = "https://gemini.google.com/app/   ";
        expect(getChatIdFromUrl(url)).toBeNull();
      });

      it("returns null for non-/app path", () => {
        const url = "https://gemini.google.com/settings/profile";
        expect(getChatIdFromUrl(url)).toBeNull();
      });
    });

    // 例外処理 - エラーケース
    describe("error cases", () => {
      it("returns null for malformed URL string", () => {
        const url = "not-a-valid-url";
        expect(getChatIdFromUrl(url)).toBeNull();
      });

      it("returns null for empty string", () => {
        const url = "";
        expect(getChatIdFromUrl(url)).toBeNull();
      });

      it("returns null for URL without protocol", () => {
        const url = "gemini.google.com/app/abc";
        expect(getChatIdFromUrl(url)).toBeNull();
      });

      it("returns null for relative URL", () => {
        const url = "/app/abc123";
        expect(getChatIdFromUrl(url)).toBeNull();
      });
    });

    // エッジケース
    describe("edge cases", () => {
      it("handles URL with both query params and hash", () => {
        const url = "https://gemini.google.com/app/xyz123?hl=en#top";
        expect(getChatIdFromUrl(url)).toBe("xyz123");
      });

      it("handles URL with special characters in ID", () => {
        const url = "https://gemini.google.com/app/abc-123_xyz";
        expect(getChatIdFromUrl(url)).toBe("abc-123_xyz");
      });

      it("preserves encoded characters in ID", () => {
        // URL encoding doesn't automatically decode in pathname
        const url = "https://gemini.google.com/app/%20abc%20";
        const result = getChatIdFromUrl(url);
        // The pathname will contain "%20abc%20" as-is
        // trim() will be applied to the result
        expect(result).toBe("%20abc%20");
      });

      it("handles uppercase and lowercase in path", () => {
        // URL paths are case-sensitive
        const url = "https://gemini.google.com/APP/abc123";
        // /APP won't match /app pattern
        expect(getChatIdFromUrl(url)).toBeNull();
      });
    });
  });
});
