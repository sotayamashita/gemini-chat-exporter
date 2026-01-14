import { describe, expect, it } from "vitest";

import { findChatRoot, findMessageBlocks, splitMixedBlock } from "@/src/export/discovery";

describe("DOM discovery", () => {
  describe("findChatRoot", () => {
    it("prefers #chat-history when present", () => {
      document.body.innerHTML = `
        <main>
          <div id="chat-history" class="chat-history-scroll-container"></div>
        </main>
      `;

      const root = findChatRoot(document);

      expect(root).not.toBeNull();
      expect(root?.id).toBe("chat-history");
    });

    it("prefers data-test-id chat history container", () => {
      document.body.innerHTML = `
        <main>
          <infinite-scroller data-test-id="chat-history-container" class="chat-history"></infinite-scroller>
        </main>
      `;

      const root = findChatRoot(document);

      expect(root).not.toBeNull();
      expect(root?.tagName).toBe("INFINITE-SCROLLER");
    });

    it("falls back to main when no chat root selectors present", () => {
      document.body.innerHTML = `
        <main>
          <section class="chat-container"></section>
        </main>
      `;

      const root = findChatRoot(document);

      expect(root).not.toBeNull();
      expect(root?.tagName).toBe("MAIN");
    });

    it("returns document.body when no main element exists", () => {
      document.body.innerHTML = `
        <div>
          <section class="chat-container"></section>
        </div>
      `;

      const root = findChatRoot(document);

      expect(root).toBe(document.body);
    });
  });

  describe("findMessageBlocks", () => {
    it("finds user-query and model-response blocks in order", () => {
      document.body.innerHTML = `
        <main class="chat-root">
          <model-response></model-response>
          <user-query></user-query>
          <model-response></model-response>
        </main>
      `;

      const root = document.querySelector("main")!;
      const blocks = findMessageBlocks(root);

      expect(blocks).toHaveLength(3);
      expect(blocks[0].tagName).toBe("MODEL-RESPONSE");
      expect(blocks[1].tagName).toBe("USER-QUERY");
      expect(blocks[2].tagName).toBe("MODEL-RESPONSE");
    });

    it("falls back to conversation-container when custom tags are missing", () => {
      document.body.innerHTML = `
        <main class="chat-root">
          <div class="conversation-container"></div>
          <div class="conversation-container"></div>
        </main>
      `;

      const root = document.querySelector("main")!;
      const blocks = findMessageBlocks(root);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].className).toBe("conversation-container");
    });

    it("returns empty array when no blocks are found", () => {
      document.body.innerHTML = `
        <main class="chat-root">
          <section class="message"></section>
        </main>
      `;

      const root = document.querySelector("main")!;
      const blocks = findMessageBlocks(root);

      expect(blocks).toHaveLength(0);
    });
  });

  describe("splitMixedBlock", () => {
    it("returns the block when it is already a user-query", () => {
      document.body.innerHTML = `
        <main class="chat-root">
          <user-query></user-query>
        </main>
      `;

      const root = document.querySelector("main")!;
      const block = document.querySelector("user-query")!;
      const result = splitMixedBlock(root, block);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(block);
    });

    it("splits conversation-container into user-query and model-response", () => {
      document.body.innerHTML = `
        <main class="chat-root">
          <div class="conversation-container">
            <user-query></user-query>
            <model-response></model-response>
          </div>
        </main>
      `;

      const root = document.querySelector("main")!;
      const block = document.querySelector(".conversation-container")!;
      const result = splitMixedBlock(root, block);

      expect(result).toHaveLength(2);
      expect(result[0].tagName).toBe("USER-QUERY");
      expect(result[1].tagName).toBe("MODEL-RESPONSE");
    });

    it("returns original block when no user-query/model-response children exist", () => {
      document.body.innerHTML = `
        <main class="chat-root">
          <div class="conversation-container"><p>Content</p></div>
        </main>
      `;

      const root = document.querySelector("main")!;
      const block = document.querySelector(".conversation-container")!;
      const result = splitMixedBlock(root, block);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(block);
    });
  });
});
