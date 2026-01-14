import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { findChatRoot } from "@/src/export/discovery";
import { extractMessages } from "@/src/export/extract";

const loadFixture = (name: string) => {
  const fixturePath = path.resolve(process.cwd(), "src/export/__fixtures__", name);
  return readFileSync(fixturePath, "utf-8");
};

const loadHtml = (html: string) => {
  document.open();
  document.write(html);
  document.close();
};

describe("Gemini HTML fixtures", () => {
  it("extracts messages from English UI snapshot", () => {
    loadHtml(loadFixture("gemini-en.html"));

    const root = findChatRoot(document);
    expect(root).not.toBeNull();

    const messages = extractMessages(root!);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some((message) => message.role === "user")).toBe(true);
    expect(messages.some((message) => message.role === "gemini")).toBe(true);
  });

  it("extracts messages from Japanese UI snapshot", () => {
    loadHtml(loadFixture("gemini-ja.html"));

    const root = findChatRoot(document);
    expect(root).not.toBeNull();

    const messages = extractMessages(root!);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some((message) => message.role === "user")).toBe(true);
    expect(messages.some((message) => message.role === "gemini")).toBe(true);
  });

  it("extracts code blocks from code-block custom elements (English)", () => {
    loadHtml(loadFixture("gemini-code-block-en.html"));

    const root = findChatRoot(document);
    expect(root).not.toBeNull();

    const messages = extractMessages(root!);
    const gemini = messages.find((message) => message.role === "gemini");
    expect(gemini?.markdown).toContain("```markdown");
    expect(gemini?.markdown).toContain('console.log("ok");');
  });

  it("extracts code blocks from code-block custom elements (Japanese)", () => {
    loadHtml(loadFixture("gemini-code-block-ja.html"));

    const root = findChatRoot(document);
    expect(root).not.toBeNull();

    const messages = extractMessages(root!);
    const gemini = messages.find((message) => message.role === "gemini");
    expect(gemini?.markdown).toContain("```");
    expect(gemini?.markdown).toContain('console.log("ok");');
  });
});
