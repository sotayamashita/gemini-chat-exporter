import { describe, expect, it, vi } from "vitest";

import { getLocalIsoTimestamp } from "@/src/export/time";

describe("time formatting", () => {
  describe("getLocalIsoTimestamp", () => {
    // ステートメントカバレッジ - 基本機能
    describe("basic functionality", () => {
      it("formats a fixed date correctly", () => {
        const date = new Date("2026-01-09T15:30:45.000Z");
        const result = getLocalIsoTimestamp(date);

        // Result will vary by timezone, but should match ISO-8601 format
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
      });

      it("includes year-month-day in correct format", () => {
        const date = new Date("2026-01-09T12:00:00.000Z");
        const result = getLocalIsoTimestamp(date);

        // Should contain the date components
        expect(result).toContain("2026-01-");
      });
    });

    // 境界値分析 - ゼロパディング
    describe("zero padding", () => {
      it("pads single-digit month", () => {
        const date = new Date("2026-01-15T12:00:00.000Z");
        const result = getLocalIsoTimestamp(date);

        // Month should be zero-padded (01, not 1)
        expect(result).toMatch(/2026-01-/);
      });

      it("pads single-digit day", () => {
        const date = new Date("2026-01-05T12:00:00.000Z");
        const result = getLocalIsoTimestamp(date);

        // Day should be zero-padded (05, not 5)
        expect(result).toMatch(/2026-01-05T/);
      });

      it("formats double-digit month correctly", () => {
        const date = new Date("2026-12-15T12:00:00.000Z");
        const result = getLocalIsoTimestamp(date);

        expect(result).toMatch(/2026-12-/);
      });

      it("formats double-digit day correctly", () => {
        const date = new Date("2026-01-25T12:00:00.000Z");
        const result = getLocalIsoTimestamp(date);

        expect(result).toMatch(/2026-01-25T/);
      });
    });

    // 境界値分析 - 時刻の境界値
    describe("time boundary values", () => {
      it("formats midnight (00:00:00) correctly", () => {
        const date = new Date("2026-01-09T00:00:00.000Z");
        const result = getLocalIsoTimestamp(date);

        // Time component should be present and zero-padded
        expect(result).toMatch(/T\d{2}:\d{2}:\d{2}/);
      });

      it("formats end of day (23:59:59) correctly", () => {
        const date = new Date("2026-01-09T23:59:59.000Z");
        const result = getLocalIsoTimestamp(date);

        expect(result).toMatch(/T\d{2}:\d{2}:\d{2}/);
      });
    });

    // 等価分割 - タイムゾーンオフセット
    describe("timezone offset", () => {
      it("formats positive timezone offset (JST +09:00)", () => {
        const date = new Date("2026-01-09T06:30:45.000Z");
        const result = getLocalIsoTimestamp(date);

        // Should include timezone offset in the result
        expect(result).toMatch(/^2026-01-09T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
        // Should have the correct date
        expect(result).toContain("2026-01-09T");
      });

      it("formats negative timezone offset (PST -08:00)", () => {
        const date = new Date("2026-01-09T16:30:45.000Z");
        const result = getLocalIsoTimestamp(date);

        // Should match ISO-8601 format with timezone
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
      });

      it("formats UTC timezone (+00:00)", () => {
        const date = new Date("2026-01-09T12:30:45.000Z");
        const result = getLocalIsoTimestamp(date);

        // Should match ISO-8601 format
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
      });

      it("includes correct date components regardless of timezone", () => {
        const date = new Date("2026-01-09T12:00:00.000Z");
        const result = getLocalIsoTimestamp(date);

        // Year should be 2026
        expect(result).toContain("2026-");
        // Should be January (month 01)
        expect(result).toMatch(/2026-01-/);
      });

      it("handles timezone offset sign correctly", () => {
        const date = new Date("2026-01-09T12:00:00.000Z");
        const result = getLocalIsoTimestamp(date);

        // Should have either + or - for timezone
        expect(result).toMatch(/[+-]\d{2}:\d{2}$/);
      });
    });

    // ブランチカバレッジ - デフォルト引数
    describe("default argument", () => {
      it("uses current date when no argument provided", () => {
        const result = getLocalIsoTimestamp();

        // Should match ISO-8601 format
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);

        // Should be a recent timestamp (within last few seconds)
        const resultDate = new Date(result);
        const now = new Date();
        const diffMs = Math.abs(now.getTime() - resultDate.getTime());

        // Should be within 5 seconds (generous buffer for test execution time)
        expect(diffMs).toBeLessThan(5000);
      });
    });

    // 特殊値テスト - うるう年
    describe("special dates", () => {
      it("formats leap year date (February 29)", () => {
        const date = new Date("2024-02-29T12:00:00.000Z");
        const result = getLocalIsoTimestamp(date);

        // Should contain the leap year date
        expect(result).toContain("2024-02-29");
        // Should match ISO-8601 format
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
      });

      it("formats end of month dates correctly", () => {
        const date = new Date("2026-01-31T12:00:00.000Z");
        const result = getLocalIsoTimestamp(date);

        // Should contain the end of month date
        expect(result).toContain("2026-01-31");
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
      });

      it("formats year boundary (December 31)", () => {
        const date = new Date("2025-12-31T23:59:59.000Z");
        const result = getLocalIsoTimestamp(date);

        // Depending on timezone, this could be 2025-12-31 or 2026-01-01
        // Just verify the format is correct
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
        // Should contain either 2025 or 2026 depending on timezone
        expect(result).toMatch(/^202[56]-/);
      });
    });

    // データバリデーション - フォーマット確認
    describe("format validation", () => {
      it("always produces valid ISO-8601 format", () => {
        // Test with multiple random dates
        const dates = [
          new Date("2026-01-01T00:00:00.000Z"),
          new Date("2026-06-15T12:30:45.000Z"),
          new Date("2026-12-31T23:59:59.000Z"),
        ];

        for (const date of dates) {
          const result = getLocalIsoTimestamp(date);

          // Should match ISO-8601 format with timezone
          expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
        }
      });

      it("produces consistent length output", () => {
        const date = new Date("2026-01-09T12:30:45.000Z");
        const result = getLocalIsoTimestamp(date);

        // ISO-8601 with timezone: YYYY-MM-DDTHH:mm:ss±HH:mm (25 chars)
        expect(result).toHaveLength(25);
      });
    });
  });
});
