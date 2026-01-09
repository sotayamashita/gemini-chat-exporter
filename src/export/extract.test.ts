import { describe, expect, it } from "vitest";

import { findChatRoot } from "@/src/export/discovery";
import { extractMessages } from "@/src/export/extract";

describe("export extraction", () => {
  it("extracts user and gemini messages with markdown", () => {
    document.body.innerHTML = `
      <main>
        <section class="chat-root">
          <h2>Gemini との会話</h2>
          <section class="message user">
            <button>プロンプトをコピー</button>
            <h2>What is Gemini?</h2>
            <time>12:34</time>
          </section>
          <section class="message gemini">
            <button>思考プロセスを表示</button>
            <p>Gemini is a multimodal model.</p>
            <ul>
              <li>Fast</li>
              <li>Helpful</li>
            </ul>
            <div class="code">
              <span>Python</span>
              <button>コードをコピー</button>
              <pre><code>print("hi")\n</code></pre>
            </div>
            <table>
              <tr><th>A</th><th>B</th></tr>
              <tr><td>1</td><td>2</td></tr>
            </table>
          </section>
        </section>
      </main>
    `;

    const root = findChatRoot(document);
    expect(root).not.toBeNull();

    const messages = extractMessages(root!);
    expect(messages).toHaveLength(2);

    expect(messages[0].role).toBe("user");
    expect(messages[0].markdown).toBe("What is Gemini?");
    expect(messages[0].timestamp).toBe("12:34");
    expect(messages[0].markdown).not.toContain("プロンプトをコピー");

    expect(messages[1].role).toBe("gemini");
    expect(messages[1].markdown).toContain("Gemini is a multimodal model.");
    expect(messages[1].markdown).toContain("- Fast");
    expect(messages[1].markdown).toContain("- Helpful");
    expect(messages[1].markdown).toContain("```python");
    expect(messages[1].markdown).toContain('print("hi")');
    expect(messages[1].markdown).toContain("| A | B |");
    expect(messages[1].markdown).toContain("<!-- gemini-export:block type=code");
    expect(messages[1].markdown).not.toContain("思考プロセスを表示");
  });

  it("orders messages based on document position", () => {
    document.body.innerHTML = `
      <main>
        <section class="chat-root">
          <h2>Gemini との会話</h2>
          <section class="message gemini">
            <button>思考プロセスを表示</button>
            <p>First response</p>
          </section>
          <section class="message user">
            <button>プロンプトをコピー</button>
            <h2>Second prompt</h2>
          </section>
        </section>
      </main>
    `;

    const root = findChatRoot(document);
    expect(root).not.toBeNull();

    const messages = extractMessages(root!);
    expect(messages).toHaveLength(2);
    expect(messages[0].markdown).toContain("First response");
    expect(messages[1].markdown).toContain("Second prompt");
  });

  it("splits mixed blocks into user and gemini segments", () => {
    document.body.innerHTML = `
      <main>
        <section class="chat-root">
          <h2>Gemini との会話</h2>
          <section class="message mixed">
            <section class="user">
              <button>プロンプトをコピー</button>
              <h2>User prompt</h2>
            </section>
            <section class="gemini">
              <button>思考プロセスを表示</button>
              <p>Assistant response</p>
            </section>
          </section>
        </section>
      </main>
    `;

    const root = findChatRoot(document);
    expect(root).not.toBeNull();

    const messages = extractMessages(root!);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[0].markdown).toBe("User prompt");
    expect(messages[1].role).toBe("gemini");
    expect(messages[1].markdown).toContain("Assistant response");
  });

  it("detects timestamp from aria-label when time tag is missing", () => {
    document.body.innerHTML = `
      <main>
        <section class="chat-root">
          <h2>Gemini との会話</h2>
          <section class="message user">
            <button>プロンプトをコピー</button>
            <div role="heading" aria-level="2">Hello</div>
            <div aria-label="09:41">meta</div>
          </section>
        </section>
      </main>
    `;

    const root = findChatRoot(document);
    expect(root).not.toBeNull();

    const messages = extractMessages(root!);
    expect(messages).toHaveLength(1);
    expect(messages[0].timestamp).toBe("09:41");
  });

  // 境界値分析 - maxCharsPerMessage オプション
  describe("maxCharsPerMessage option", () => {
    it("does not truncate when limit is not set", () => {
      document.body.innerHTML = `
        <main>
          <section class="chat-root">
            <h2>Gemini との会話</h2>
            <section class="message user">
              <button>プロンプトをコピー</button>
              <h2>${"a".repeat(200)}</h2>
            </section>
          </section>
        </main>
      `;

      const root = findChatRoot(document);
      const messages = extractMessages(root!);

      expect(messages[0].markdown).toHaveLength(200);
    });

    it("does not truncate when content is below limit", () => {
      document.body.innerHTML = `
        <main>
          <section class="chat-root">
            <h2>Gemini との会話</h2>
            <section class="message user">
              <button>プロンプトをコピー</button>
              <h2>${"a".repeat(90)}</h2>
            </section>
          </section>
        </main>
      `;

      const root = findChatRoot(document);
      const messages = extractMessages(root!, { maxCharsPerMessage: 100 });

      expect(messages[0].markdown).toHaveLength(90);
    });

    it("does not truncate when content equals limit", () => {
      document.body.innerHTML = `
        <main>
          <section class="chat-root">
            <h2>Gemini との会話</h2>
            <section class="message user">
              <button>プロンプトをコピー</button>
              <h2>${"a".repeat(100)}</h2>
            </section>
          </section>
        </main>
      `;

      const root = findChatRoot(document);
      const messages = extractMessages(root!, { maxCharsPerMessage: 100 });

      expect(messages[0].markdown).toHaveLength(100);
    });

    it("truncates when content exceeds limit by one character", () => {
      document.body.innerHTML = `
        <main>
          <section class="chat-root">
            <h2>Gemini との会話</h2>
            <section class="message user">
              <button>プロンプトをコピー</button>
              <h2>${"a".repeat(101)}</h2>
            </section>
          </section>
        </main>
      `;

      const root = findChatRoot(document);
      const messages = extractMessages(root!, { maxCharsPerMessage: 100 });

      expect(messages[0].markdown).toHaveLength(100);
    });

    it("truncates when content significantly exceeds limit", () => {
      document.body.innerHTML = `
        <main>
          <section class="chat-root">
            <h2>Gemini との会話</h2>
            <section class="message user">
              <button>プロンプトをコピー</button>
              <h2>${"a".repeat(500)}</h2>
            </section>
          </section>
        </main>
      `;

      const root = findChatRoot(document);
      const messages = extractMessages(root!, { maxCharsPerMessage: 100 });

      expect(messages[0].markdown).toHaveLength(100);
    });
  });

  // エッジケース
  describe("edge cases", () => {
    it("handles deeply nested elements", () => {
      document.body.innerHTML = `
        <main>
          <section class="chat-root">
            <h2>Gemini との会話</h2>
            <section class="message gemini">
              <button>思考プロセスを表示</button>
              <div>
                <div>
                  <div>
                    <p>Deeply nested content</p>
                  </div>
                </div>
              </div>
            </section>
          </section>
        </main>
      `;

      const root = findChatRoot(document);
      const messages = extractMessages(root!);

      expect(messages[0].markdown).toContain("Deeply nested content");
    });

    it("handles special markdown characters", () => {
      document.body.innerHTML = `
        <main>
          <section class="chat-root">
            <h2>Gemini との会話</h2>
            <section class="message user">
              <button>プロンプトをコピー</button>
              <h2>**Bold** _italic_ \`code\` #heading</h2>
            </section>
          </section>
        </main>
      `;

      const root = findChatRoot(document);
      const messages = extractMessages(root!);

      // Special characters should be preserved in markdown
      expect(messages[0].markdown).toContain("**Bold**");
      expect(messages[0].markdown).toContain("_italic_");
      expect(messages[0].markdown).toContain("`code`");
      expect(messages[0].markdown).toContain("#heading");
    });

    it("handles multiple code blocks in a message", () => {
      document.body.innerHTML = `
        <main>
          <section class="chat-root">
            <h2>Gemini との会話</h2>
            <section class="message gemini">
              <button aria-label="思考プロセスを表示"></button>
              <p>First code:</p>
              <div class="code">
                <span>Python</span>
                <pre><code>print("hello")</code></pre>
              </div>
              <p>Second code:</p>
              <div class="code">
                <span>JavaScript</span>
                <pre><code>console.log("world")</code></pre>
              </div>
            </section>
          </section>
        </main>
      `;

      const root = findChatRoot(document);
      const messages = extractMessages(root!);

      // Code blocks are present
      expect(messages[0].markdown).toContain('print("hello")');
      expect(messages[0].markdown).toContain('console.log("world")');
      expect(messages[0].markdown).toContain("```");
      // Contains code block markers
      expect(messages[0].markdown).toContain("<!-- gemini-export:block type=code");
    });

    it("handles multiple tables in a message", () => {
      document.body.innerHTML = `
        <main>
          <section class="chat-root">
            <h2>Gemini との会話</h2>
            <section class="message gemini">
              <button>思考プロセスを表示</button>
              <p>First table:</p>
              <table>
                <tr><th>A</th><th>B</th></tr>
                <tr><td>1</td><td>2</td></tr>
              </table>
              <p>Second table:</p>
              <table>
                <tr><th>X</th><th>Y</th></tr>
                <tr><td>3</td><td>4</td></tr>
              </table>
            </section>
          </section>
        </main>
      `;

      const root = findChatRoot(document);
      const messages = extractMessages(root!);

      expect(messages[0].markdown).toContain("| A | B |");
      expect(messages[0].markdown).toContain("| 1 | 2 |");
      expect(messages[0].markdown).toContain("| X | Y |");
      expect(messages[0].markdown).toContain("| 3 | 4 |");
    });

    it("handles mixed content (code + table + list)", () => {
      document.body.innerHTML = `
        <main>
          <section class="chat-root">
            <h2>Gemini との会話</h2>
            <section class="message gemini">
              <button aria-label="思考プロセスを表示"></button>
              <p>Text content</p>
              <ul>
                <li>Item 1</li>
                <li>Item 2</li>
              </ul>
              <div class="code">
                <span>Python</span>
                <pre><code>print("test")</code></pre>
              </div>
              <table>
                <tr><th>Col1</th><th>Col2</th></tr>
                <tr><td>Val1</td><td>Val2</td></tr>
              </table>
            </section>
          </section>
        </main>
      `;

      const root = findChatRoot(document);
      const messages = extractMessages(root!);

      expect(messages[0].markdown).toContain("Text content");
      expect(messages[0].markdown).toContain("- Item 1");
      expect(messages[0].markdown).toContain("- Item 2");
      expect(messages[0].markdown).toContain('print("test")');
      expect(messages[0].markdown).toContain("```");
      expect(messages[0].markdown).toContain("| Col1 | Col2 |");
      expect(messages[0].markdown).toContain("| Val1 | Val2 |");
    });
  });
});
