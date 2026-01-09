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
});
