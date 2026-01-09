import { describe, expect, it } from "vitest";

import { formatExportMarkdown } from "@/src/export/serialize";
import type { ExportPayload } from "@/src/export/types";

describe("markdown serialization", () => {
  describe("formatExportMarkdown", () => {
    const generatedAt = "2026-01-09T20:30:00+09:00";
    const sourceUrl = "https://gemini.google.com/app/abc123";

    // ステートメントカバレッジ - 基本機能
    describe("basic functionality", () => {
      it("generates markdown with user and gemini messages", () => {
        const payload: ExportPayload = {
          chatId: "abc123",
          sourceUrl,
          messages: [
            {
              role: "user",
              markdown: "What is TypeScript?",
              text: "What is TypeScript?",
              timestamp: null,
              order: 1,
            },
            {
              role: "gemini",
              markdown: "TypeScript is a superset of JavaScript.",
              text: "TypeScript is a superset of JavaScript.",
              timestamp: null,
              order: 2,
            },
          ],
        };

        const result = formatExportMarkdown(payload, generatedAt);

        expect(result).toContain(`<!-- gemini-export: generated-at=${generatedAt} -->`);
        expect(result).toContain(`<!-- gemini-export: source-url=${sourceUrl} -->`);
        expect(result).toContain("## User");
        expect(result).toContain("What is TypeScript?");
        expect(result).toContain("## Gemini");
        expect(result).toContain("TypeScript is a superset of JavaScript.");
      });
    });

    // 等価分割 - タイムスタンプ
    describe("timestamp handling", () => {
      it("includes timestamp in heading when present", () => {
        const payload: ExportPayload = {
          chatId: "abc123",
          sourceUrl,
          messages: [
            {
              role: "user",
              markdown: "Hello",
              text: "Hello",
              timestamp: "12:34",
              order: 1,
            },
          ],
        };

        const result = formatExportMarkdown(payload, generatedAt);

        expect(result).toContain("## User (12:34)");
        expect(result).not.toContain("## User\n\n");
      });

      it("omits timestamp from heading when null", () => {
        const payload: ExportPayload = {
          chatId: "abc123",
          sourceUrl,
          messages: [
            {
              role: "user",
              markdown: "Hello",
              text: "Hello",
              timestamp: null,
              order: 1,
            },
          ],
        };

        const result = formatExportMarkdown(payload, generatedAt);

        expect(result).toContain("## User\n\n");
        expect(result).not.toMatch(/## User \(/);
      });
    });

    // デシジョンテーブル - markdown/text の優先順位
    describe("content priority", () => {
      it("uses markdown when both markdown and text are present", () => {
        const payload: ExportPayload = {
          chatId: "abc123",
          sourceUrl,
          messages: [
            {
              role: "user",
              markdown: "Markdown content",
              text: "Text content",
              timestamp: null,
              order: 1,
            },
          ],
        };

        const result = formatExportMarkdown(payload, generatedAt);

        expect(result).toContain("Markdown content");
        expect(result).not.toContain("Text content");
      });

      it("uses text when markdown is empty", () => {
        const payload: ExportPayload = {
          chatId: "abc123",
          sourceUrl,
          messages: [
            {
              role: "user",
              markdown: "",
              text: "Text content",
              timestamp: null,
              order: 1,
            },
          ],
        };

        const result = formatExportMarkdown(payload, generatedAt);

        expect(result).toContain("Text content");
      });

      it("outputs only heading when both markdown and text are empty", () => {
        const payload: ExportPayload = {
          chatId: "abc123",
          sourceUrl,
          messages: [
            {
              role: "user",
              markdown: "",
              text: "",
              timestamp: null,
              order: 1,
            },
          ],
        };

        const result = formatExportMarkdown(payload, generatedAt);

        expect(result).toContain("## User");
        // The result should have the heading but no content after it
        // (just metadata comments and the heading)
        const lines = result.split("\n");
        const userHeadingIndex = lines.findIndex((line) => line === "## User");
        expect(userHeadingIndex).toBeGreaterThan(-1);
        // After heading, there should only be empty lines until end
        const remainingLines = lines.slice(userHeadingIndex + 1);
        const nonEmptyLines = remainingLines.filter((line) => line.trim().length > 0);
        expect(nonEmptyLines).toHaveLength(0);
      });
    });

    // 等価分割 - ロール
    describe("role labels", () => {
      it("formats user role correctly", () => {
        const payload: ExportPayload = {
          chatId: "abc123",
          sourceUrl,
          messages: [
            {
              role: "user",
              markdown: "User message",
              text: "",
              timestamp: null,
              order: 1,
            },
          ],
        };

        const result = formatExportMarkdown(payload, generatedAt);

        expect(result).toContain("## User");
      });

      it("formats gemini role correctly", () => {
        const payload: ExportPayload = {
          chatId: "abc123",
          sourceUrl,
          messages: [
            {
              role: "gemini",
              markdown: "Gemini message",
              text: "",
              timestamp: null,
              order: 1,
            },
          ],
        };

        const result = formatExportMarkdown(payload, generatedAt);

        expect(result).toContain("## Gemini");
      });

      it("formats system role correctly", () => {
        const payload: ExportPayload = {
          chatId: "abc123",
          sourceUrl,
          messages: [
            {
              role: "system",
              markdown: "System message",
              text: "",
              timestamp: null,
              order: 1,
            },
          ],
        };

        const result = formatExportMarkdown(payload, generatedAt);

        expect(result).toContain("## System");
      });
    });

    // 境界値分析 - メッセージ数
    describe("message count", () => {
      it("handles empty message array", () => {
        const payload: ExportPayload = {
          chatId: "abc123",
          sourceUrl,
          messages: [],
        };

        const result = formatExportMarkdown(payload, generatedAt);

        expect(result).toContain(`<!-- gemini-export: generated-at=${generatedAt} -->`);
        expect(result).toContain(`<!-- gemini-export: source-url=${sourceUrl} -->`);
        expect(result).not.toContain("##");
      });

      it("handles single message", () => {
        const payload: ExportPayload = {
          chatId: "abc123",
          sourceUrl,
          messages: [
            {
              role: "user",
              markdown: "Single message",
              text: "",
              timestamp: null,
              order: 1,
            },
          ],
        };

        const result = formatExportMarkdown(payload, generatedAt);

        expect(result).toContain("## User");
        expect(result).toContain("Single message");
      });

      it("handles multiple messages correctly", () => {
        const payload: ExportPayload = {
          chatId: "abc123",
          sourceUrl,
          messages: [
            {
              role: "user",
              markdown: "Message 1",
              text: "",
              timestamp: null,
              order: 1,
            },
            {
              role: "gemini",
              markdown: "Message 2",
              text: "",
              timestamp: null,
              order: 2,
            },
            {
              role: "user",
              markdown: "Message 3",
              text: "",
              timestamp: null,
              order: 3,
            },
            {
              role: "gemini",
              markdown: "Message 4",
              text: "",
              timestamp: null,
              order: 4,
            },
            {
              role: "system",
              markdown: "Message 5",
              text: "",
              timestamp: null,
              order: 5,
            },
          ],
        };

        const result = formatExportMarkdown(payload, generatedAt);

        expect(result).toContain("Message 1");
        expect(result).toContain("Message 2");
        expect(result).toContain("Message 3");
        expect(result).toContain("Message 4");
        expect(result).toContain("Message 5");

        // Messages should appear in order
        const idx1 = result.indexOf("Message 1");
        const idx2 = result.indexOf("Message 2");
        const idx3 = result.indexOf("Message 3");
        const idx4 = result.indexOf("Message 4");
        const idx5 = result.indexOf("Message 5");

        expect(idx1).toBeLessThan(idx2);
        expect(idx2).toBeLessThan(idx3);
        expect(idx3).toBeLessThan(idx4);
        expect(idx4).toBeLessThan(idx5);
      });
    });

    // データバリデーション - フォーマット
    describe("format validation", () => {
      it("includes metadata comments at the beginning", () => {
        const payload: ExportPayload = {
          chatId: "abc123",
          sourceUrl,
          messages: [
            {
              role: "user",
              markdown: "Test",
              text: "",
              timestamp: null,
              order: 1,
            },
          ],
        };

        const result = formatExportMarkdown(payload, generatedAt);

        expect(result).toMatch(/^<!-- gemini-export: generated-at=/);
        expect(result.indexOf("<!-- gemini-export: generated-at=")).toBe(0);
      });

      it("ends with single newline", () => {
        const payload: ExportPayload = {
          chatId: "abc123",
          sourceUrl,
          messages: [
            {
              role: "user",
              markdown: "Test",
              text: "",
              timestamp: null,
              order: 1,
            },
          ],
        };

        const result = formatExportMarkdown(payload, generatedAt);

        expect(result.endsWith("\n")).toBe(true);
        expect(result.endsWith("\n\n")).toBe(false);
      });

      it("trims content before output", () => {
        const payload: ExportPayload = {
          chatId: "abc123",
          sourceUrl,
          messages: [
            {
              role: "user",
              markdown: "  Content with spaces  ",
              text: "",
              timestamp: null,
              order: 1,
            },
          ],
        };

        const result = formatExportMarkdown(payload, generatedAt);

        expect(result).toContain("Content with spaces\n");
        expect(result).not.toContain("  Content with spaces  ");
      });

      it("separates messages with blank lines", () => {
        const payload: ExportPayload = {
          chatId: "abc123",
          sourceUrl,
          messages: [
            {
              role: "user",
              markdown: "First",
              text: "",
              timestamp: null,
              order: 1,
            },
            {
              role: "gemini",
              markdown: "Second",
              text: "",
              timestamp: null,
              order: 2,
            },
          ],
        };

        const result = formatExportMarkdown(payload, generatedAt);

        // Should have blank line between messages
        expect(result).toMatch(/First\n\n## Gemini/);
      });
    });

    // エッジケース
    describe("edge cases", () => {
      it("handles very long content", () => {
        const longContent = "a".repeat(10000);
        const payload: ExportPayload = {
          chatId: "abc123",
          sourceUrl,
          messages: [
            {
              role: "user",
              markdown: longContent,
              text: "",
              timestamp: null,
              order: 1,
            },
          ],
        };

        const result = formatExportMarkdown(payload, generatedAt);

        expect(result).toContain(longContent);
      });

      it("handles special characters in content", () => {
        const payload: ExportPayload = {
          chatId: "abc123",
          sourceUrl,
          messages: [
            {
              role: "user",
              markdown: "**Bold** and _italic_ with `code`",
              text: "",
              timestamp: null,
              order: 1,
            },
          ],
        };

        const result = formatExportMarkdown(payload, generatedAt);

        expect(result).toContain("**Bold** and _italic_ with `code`");
      });

      it("handles multiline content", () => {
        const payload: ExportPayload = {
          chatId: "abc123",
          sourceUrl,
          messages: [
            {
              role: "user",
              markdown: "Line 1\nLine 2\nLine 3",
              text: "",
              timestamp: null,
              order: 1,
            },
          ],
        };

        const result = formatExportMarkdown(payload, generatedAt);

        expect(result).toContain("Line 1\nLine 2\nLine 3");
      });
    });
  });
});
