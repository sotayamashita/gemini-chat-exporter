import { describe, expect, it } from "vitest";

import {
  findChatRoot,
  findMessageBlocks,
  getMarkerButtons,
  splitMixedBlock,
} from "@/src/export/discovery";

describe("DOM discovery", () => {
  describe("findChatRoot", () => {
    // 等価分割 - 日本語見出し
    it("finds root with Japanese heading", () => {
      document.body.innerHTML = `
        <main>
          <section class="chat-container">
            <h2>Gemini との会話</h2>
            <button aria-label="プロンプトをコピー">Copy</button>
            <button aria-label="思考プロセスを表示">Show</button>
          </section>
        </main>
      `;

      const root = findChatRoot(document);

      expect(root).not.toBeNull();
      expect(root?.tagName).toBe("SECTION");
    });

    // 等価分割 - 英語見出し
    it("finds root with English heading", () => {
      document.body.innerHTML = `
        <main>
          <section class="chat-container">
            <h2>Conversation with Gemini</h2>
            <button aria-label="プロンプトをコピー">Copy</button>
            <button aria-label="思考プロセスを表示">Show</button>
          </section>
        </main>
      `;

      const root = findChatRoot(document);

      expect(root).not.toBeNull();
      expect(root?.tagName).toBe("SECTION");
    });

    // 境界値分析 - マーカー数 0個
    it("returns heading parent when no markers present", () => {
      document.body.innerHTML = `
        <main>
          <section class="chat-container">
            <h2>Gemini との会話</h2>
          </section>
        </main>
      `;

      const root = findChatRoot(document);

      expect(root).not.toBeNull();
      expect(root?.tagName).toBe("SECTION");
    });

    // 境界値分析 - マーカー数 1個
    it("returns heading parent when only one marker present", () => {
      document.body.innerHTML = `
        <main>
          <section class="chat-container">
            <h2>Gemini との会話</h2>
            <button aria-label="プロンプトをコピー">Copy</button>
          </section>
        </main>
      `;

      const root = findChatRoot(document);

      expect(root).not.toBeNull();
      expect(root?.tagName).toBe("SECTION");
    });

    // ブランチカバレッジ - 見出しが見つからない場合
    it("returns main element when heading not found", () => {
      document.body.innerHTML = `
        <main>
          <section class="chat-container">
            <h2>Some other heading</h2>
          </section>
        </main>
      `;

      const root = findChatRoot(document);

      expect(root).not.toBeNull();
      expect(root?.tagName).toBe("MAIN");
    });

    // エッジケース - 空のドキュメント
    it("returns document.body when DOM is empty", () => {
      document.body.innerHTML = "";

      const root = findChatRoot(document);

      expect(root).toBe(document.body);
    });

    // エッジケース - main要素がない場合
    it("returns document.body when no main element exists", () => {
      document.body.innerHTML = `
        <div>
          <section class="chat-container">
            <h2>Some heading</h2>
          </section>
        </div>
      `;

      const root = findChatRoot(document);

      expect(root).toBe(document.body);
    });

    // 等価分割 - マーカーボタンの aria-label 検出
    it("detects markers via aria-label attribute", () => {
      document.body.innerHTML = `
        <main>
          <section class="chat-container">
            <h2>Gemini との会話</h2>
            <button aria-label="プロンプトをコピー"></button>
            <button aria-label="思考プロセスを表示"></button>
          </section>
        </main>
      `;

      const root = findChatRoot(document);

      expect(root).not.toBeNull();
      expect(root?.tagName).toBe("SECTION");
    });

    // 等価分割 - 複数の見出しレベル
    it("finds heading at different levels (h1, h2, h3)", () => {
      document.body.innerHTML = `
        <main>
          <section class="chat-container">
            <h3>Gemini との会話</h3>
            <button aria-label="プロンプトをコピー"></button>
            <button aria-label="思考プロセスを表示"></button>
          </section>
        </main>
      `;

      const root = findChatRoot(document);

      expect(root).not.toBeNull();
      expect(root?.tagName).toBe("SECTION");
    });

    // ブランチカバレッジ - マーカーが2個以上の最初の祖先
    it("returns first ancestor with 2 or more markers", () => {
      document.body.innerHTML = `
        <main>
          <div class="outer">
            <div class="inner">
              <h2>Gemini との会話</h2>
            </div>
            <button aria-label="プロンプトをコピー"></button>
            <button aria-label="思考プロセスを表示"></button>
          </div>
        </main>
      `;

      const root = findChatRoot(document);

      expect(root).not.toBeNull();
      expect(root?.className).toBe("outer");
    });
  });

  describe("findMessageBlocks", () => {
    // ブランチカバレッジ - user と gemini のブロックを取得
    it("finds user and gemini message blocks", () => {
      document.body.innerHTML = `
        <main class="chat-root">
          <section class="message user">
            <button aria-label="プロンプトをコピー"></button>
            <h2>User message</h2>
          </section>
          <section class="message gemini">
            <button aria-label="思考プロセスを表示"></button>
            <p>Gemini response</p>
          </section>
        </main>
      `;

      const root = document.querySelector("main")!;
      const blocks = findMessageBlocks(root);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].className).toBe("message user");
      expect(blocks[1].className).toBe("message gemini");
    });

    // 境界値分析 - マーカーが存在しない (0個)
    it("returns empty array when no markers present", () => {
      document.body.innerHTML = `
        <main class="chat-root">
          <section class="message">
            <h2>No markers here</h2>
          </section>
        </main>
      `;

      const root = document.querySelector("main")!;
      const blocks = findMessageBlocks(root);

      expect(blocks).toHaveLength(0);
    });

    // 境界値分析 - 複数の会話ターン (4個以上)
    it("finds multiple conversation turns", () => {
      document.body.innerHTML = `
        <main class="chat-root">
          <section class="turn1">
            <button aria-label="プロンプトをコピー"></button>
            <h2>Turn 1</h2>
          </section>
          <section class="turn2">
            <button aria-label="思考プロセスを表示"></button>
            <p>Turn 2</p>
          </section>
          <section class="turn3">
            <button aria-label="プロンプトをコピー"></button>
            <h2>Turn 3</h2>
          </section>
          <section class="turn4">
            <button aria-label="思考プロセスを表示"></button>
            <p>Turn 4</p>
          </section>
        </main>
      `;

      const root = document.querySelector("main")!;
      const blocks = findMessageBlocks(root);

      expect(blocks).toHaveLength(4);
    });

    // 重複排除ロジック - 同じブロック内に複数マーカー
    it("deduplicates blocks when multiple markers point to same block", () => {
      document.body.innerHTML = `
        <main class="chat-root">
          <section class="message">
            <button aria-label="プロンプトをコピー"></button>
            <button aria-label="プロンプトをコピー"></button>
            <h2>User message</h2>
          </section>
        </main>
      `;

      const root = document.querySelector("main")!;
      const blocks = findMessageBlocks(root);

      expect(blocks).toHaveLength(1);
    });

    // ソートロジック - ドキュメント順序の検証
    it("returns blocks in document order", () => {
      document.body.innerHTML = `
        <main class="chat-root">
          <section class="first">
            <button aria-label="思考プロセスを表示"></button>
            <p>First</p>
          </section>
          <section class="second">
            <button aria-label="プロンプトをコピー"></button>
            <h2>Second</h2>
          </section>
        </main>
      `;

      const root = document.querySelector("main")!;
      const blocks = findMessageBlocks(root);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].className).toBe("first");
      expect(blocks[1].className).toBe("second");
    });
  });

  describe("splitMixedBlock", () => {
    // ブランチカバレッジ - 混在ブロックを分割
    it("splits block with both user and gemini markers", () => {
      document.body.innerHTML = `
        <main class="chat-root">
          <section class="mixed">
            <div class="user-part">
              <button aria-label="プロンプトをコピー"></button>
              <h2>User prompt</h2>
            </div>
            <div class="gemini-part">
              <button aria-label="思考プロセスを表示"></button>
              <p>Gemini response</p>
            </div>
          </section>
        </main>
      `;

      const root = document.querySelector("main")!;
      const block = document.querySelector(".mixed")!;
      const result = splitMixedBlock(root, block);

      expect(result).toHaveLength(2);
      expect(result[0].className).toBe("user-part");
      expect(result[1].className).toBe("gemini-part");
    });

    // ブランチカバレッジ - userマーカーのみ
    it("returns original block when only user markers present", () => {
      document.body.innerHTML = `
        <main class="chat-root">
          <section class="user-only">
            <button aria-label="プロンプトをコピー"></button>
            <h2>User message</h2>
          </section>
        </main>
      `;

      const root = document.querySelector("main")!;
      const block = document.querySelector(".user-only")!;
      const result = splitMixedBlock(root, block);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(block);
    });

    // ブランチカバレッジ - geminiマーカーのみ
    it("returns original block when only gemini markers present", () => {
      document.body.innerHTML = `
        <main class="chat-root">
          <section class="gemini-only">
            <button aria-label="思考プロセスを表示"></button>
            <p>Gemini response</p>
          </section>
        </main>
      `;

      const root = document.querySelector("main")!;
      const block = document.querySelector(".gemini-only")!;
      const result = splitMixedBlock(root, block);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(block);
    });

    // エッジケース - マーカーなし
    it("returns original block when no markers present", () => {
      document.body.innerHTML = `
        <main class="chat-root">
          <section class="no-markers">
            <p>Some content</p>
          </section>
        </main>
      `;

      const root = document.querySelector("main")!;
      const block = document.querySelector(".no-markers")!;
      const result = splitMixedBlock(root, block);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(block);
    });

    // ソートロジック - 分割後の順序検証
    it("returns blocks in document order after splitting", () => {
      document.body.innerHTML = `
        <main class="chat-root">
          <section class="mixed">
            <div class="gemini-part">
              <button aria-label="思考プロセスを表示"></button>
              <p>Gemini response</p>
            </div>
            <div class="user-part">
              <button aria-label="プロンプトをコピー"></button>
              <h2>User prompt</h2>
            </div>
          </section>
        </main>
      `;

      const root = document.querySelector("main")!;
      const block = document.querySelector(".mixed")!;
      const result = splitMixedBlock(root, block);

      // Should be sorted by document order
      expect(result).toHaveLength(2);
      expect(result[0].className).toBe("gemini-part");
      expect(result[1].className).toBe("user-part");
    });

    // エッジケース - 分割できない構造 (同じ親要素)
    it("returns original block when markers point to same element", () => {
      document.body.innerHTML = `
        <main class="chat-root">
          <section class="same-parent">
            <button aria-label="プロンプトをコピー"></button>
            <button aria-label="思考プロセスを表示"></button>
            <h2>Heading</h2>
            <p>Content</p>
          </section>
        </main>
      `;

      const root = document.querySelector("main")!;
      const block = document.querySelector(".same-parent")!;
      const result = splitMixedBlock(root, block);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(block);
    });
  });

  describe("getMarkerButtons", () => {
    // 等価分割 - user マーカーボタンを取得
    it("finds user marker buttons", () => {
      document.body.innerHTML = `
        <section class="message">
          <button aria-label="プロンプトをコピー"></button>
          <button aria-label="思考プロセスを表示"></button>
          <h2>Content</h2>
        </section>
      `;

      const element = document.querySelector(".message")!;
      const userButtons = getMarkerButtons(element, "user");

      expect(userButtons).toHaveLength(1);
      expect(userButtons[0].getAttribute("aria-label")).toBe("プロンプトをコピー");
    });

    // 等価分割 - gemini マーカーボタンを取得
    it("finds gemini marker buttons", () => {
      document.body.innerHTML = `
        <section class="message">
          <button aria-label="プロンプトをコピー"></button>
          <button aria-label="思考プロセスを表示"></button>
          <p>Content</p>
        </section>
      `;

      const element = document.querySelector(".message")!;
      const geminiButtons = getMarkerButtons(element, "gemini");

      expect(geminiButtons).toHaveLength(1);
      expect(geminiButtons[0].getAttribute("aria-label")).toBe("思考プロセスを表示");
    });

    // 境界値分析 - 複数のマーカーボタン
    it("finds multiple marker buttons of same role", () => {
      document.body.innerHTML = `
        <section class="message">
          <button aria-label="プロンプトをコピー"></button>
          <button aria-label="プロンプトをコピー"></button>
          <h2>Content</h2>
        </section>
      `;

      const element = document.querySelector(".message")!;
      const userButtons = getMarkerButtons(element, "user");

      expect(userButtons).toHaveLength(2);
    });

    // 境界値分析 - マーカーが存在しない (0個)
    it("returns empty array when no markers present", () => {
      document.body.innerHTML = `
        <section class="message">
          <button>Some button</button>
          <h2>Content</h2>
        </section>
      `;

      const element = document.querySelector(".message")!;
      const userButtons = getMarkerButtons(element, "user");

      expect(userButtons).toHaveLength(0);
    });

    // 等価分割 - textContent からの検出
    it("detects markers from button textContent when aria-label is missing", () => {
      document.body.innerHTML = `
        <section class="message">
          <button>プロンプトをコピー</button>
          <h2>Content</h2>
        </section>
      `;

      const element = document.querySelector(".message")!;
      const userButtons = getMarkerButtons(element, "user");

      expect(userButtons).toHaveLength(1);
    });

    // エッジケース - gemini の他のマーカー（良い回答、悪い回答）
    it("detects other gemini markers (good/bad response)", () => {
      document.body.innerHTML = `
        <section class="message">
          <button aria-label="良い回答"></button>
          <button aria-label="悪い回答"></button>
          <p>Content</p>
        </section>
      `;

      const element = document.querySelector(".message")!;
      const geminiButtons = getMarkerButtons(element, "gemini");

      expect(geminiButtons).toHaveLength(2);
    });
  });
});
