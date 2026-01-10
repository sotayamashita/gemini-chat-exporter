# Gemini Chat DOM Guide (for Exporter Maintenance)

## 目的・スコープ
- この文書は Gemini Web UI の DOM 変更に対して、LLM が自己修正できるようにするための実務ガイド。
- 対象は `https://gemini.google.com/app/{chat_id}` の単一スレッド。履歴一覧や複数チャットは対象外。
- UI ラベルは日本語 UI を前提（多言語対応はしない前提で運用）。
- Playwright MCP で確認したアカウントの表示言語は日本語。
- 英語 UI でも同構造を確認済み（2026-01-10）。英語ラベル: "Copy prompt" / "Show thinking" / "Good response" / "Bad response"。

## 収集するべき情報
- メッセージ単位の必須情報: `role` / `markdown` / `text` / `timestamp` / `order`
- 役割判定に使う UI マーカー: ユーザー用 / Gemini 用ボタンの表示文言
- メッセージ構成要素: 見出し・段落・リスト・コード・表
- コードブロックの付随情報: 言語ラベル、コピー UI の位置関係
- チャット全体のメタ: source URL / 生成日時

## Gemini ページ構造の特徴
- 共通:
  - chat root は見出し「Conversation with Gemini / Gemini との会話」に近い祖先に存在する傾向。
  - 1つの返信の中に複数の Gemini マーカーが存在し、別祖先に紐付くことがある。
  - コードブロックは `.code-block` に言語ラベルがあり、`pre > code` とは兄弟関係になることがある。
  - クラス名は変動しやすいので、テキスト/aria-label を優先する。
- 日本語 UI:
  - 見出し: 「Gemini との会話」
  - ユーザー: 「プロンプトをコピー」ボタン + `aria-level="2"` の heading
  - Gemini 返信: 「思考プロセスを表示」「良い回答」「悪い回答」
  - ボタン文言が可視テキストに出ないケースがあるため、`aria-label` を優先して読む
- 英語 UI:
  - 見出し: "Conversation with Gemini"
  - ユーザー: "Copy prompt" ボタン + `aria-level="2"` の heading
  - Gemini 返信: "Show thinking" / "Good response" / "Bad response"
  - ボタン文言は `aria-label` かテキストに出るため、`aria-label` を優先して読む
- 観測結果（2026-01-10、Playwright MCP）:
  - Gemini 返信本体の候補:
    - `.response-content`（className: `response-content ng-tns-c4226368718-11`）
    - `.response-container`（className: `response-container ng-tns-c4226368718-11 response-container-with-gpi`）
  - コード言語ラベル:
    - `.code-block-decoration`（className: `code-block-decoration header-formatted gds-title-s` / 表示文言: `Python` / `Markdown`）
  - 上記クラスは短いチャット (`735afd264d35c312`) と長いチャット (`cbb342fdc6010a5e`) の両方で確認。

## 既存実装との対応関係
- chat root 判定: `src/export/discovery.ts:147`
  - 見出し/ルート探索が変わったらここを更新。
- marker 検出: `src/export/discovery.ts:105` と `src/export/markers.ts:4`
  - UI ラベルが変わったら `markers.ts` を更新。
  - 英語 UI に対応する場合は英語ラベル（"Copy prompt" / "Show thinking" / "Good response" / "Bad response"）を追加する。
  - aria-label / textContent の優先度を変えたい場合は `buttonText()` を調整。
- message block 収集: `src/export/discovery.ts:167`
  - 二重抽出が起きる場合は `findClosestBlock()` と重複排除の戦略を見直す。
- mixed block 分割: `src/export/discovery.ts:186`
  - 1つの block に user/gemini が混在する構造変更に対応する時に修正。
- role 判定: `src/export/extract.ts:399`
  - marker の有無/順序ロジックを変える場合に修正。
- Gemini シリアライズ: `src/export/extract.ts:320`
  - paragraph/list/code/table の扱いを変える時に修正。
- User シリアライズ: `src/export/extract.ts:378`
  - 見出し構造が変わったら `heading` の取得条件を更新。
- code ブロック収集: `src/export/extract.ts:157`
  - code block コンテナが変わったら container 判定を更新。
- 言語ラベル抽出: `src/export/extract.ts:135`
  - 言語ラベルの位置が変わったらここを更新。
- markdown 生成: `src/export/serialize.ts:23`
  - 出力フォーマットを変える時に修正。

## LLM が確認する手順（Playwright MCP）
- 対象チャットへ遷移: `https://gemini.google.com/app/{chat_id}`
- 主要マーカー確認:
  - `button` の `aria-label` / テキストに「プロンプトをコピー」「思考プロセスを表示」「良い回答」「悪い回答」
  - ユーザー見出しは `h2` 以外に `role="heading"` + `aria-level="2"` もある
- message block の祖先差分を確認:
  - `closest` で `button` から祖先を辿り、ユーザー/ Gemini で最小ブロックが違うか確認
- コードブロック構造の確認:
  - `.code-block` 配下に言語ラベルがあるか
  - `pre > code` と言語ラベルが兄弟にあるか
- テーブル/リストの存在確認:
  - `table`, `ul`, `ol` が message block に含まれているか

### Playwright MCP での具体的な確認クエリ（日本語 UI）

```ts
// 1) 主要マーカーの存在確認
await page.evaluate(() => {
  const labelText = (b) => (b.getAttribute("aria-label") || b.textContent || "");
  const markers = ["プロンプトをコピー", "思考プロセスを表示", "良い回答", "悪い回答"];
  return markers.map((label) => ({
    label,
    count: Array.from(document.querySelectorAll("button")).filter((b) =>
      labelText(b).includes(label),
    ).length,
  }));
});
```

```ts
// 2) ユーザー見出しの検出（h2 と aria-level=2 の両方）
await page.evaluate(() => {
  const h2 = document.querySelectorAll("h2").length;
  const aria = document.querySelectorAll('[role="heading"][aria-level="2"]').length;
  return { h2, aria };
});
```

```ts
// 3) Gemini マーカーの祖先差分（重複抽出の原因確認）
await page.evaluate(() => {
  const normalize = (v) => (v || "").replace(/\\s+/g, " ").trim();
  const buttons = Array.from(document.querySelectorAll("button")).filter((b) =>
    normalize(b.textContent).includes("思考プロセスを表示") ||
    normalize(b.textContent).includes("良い回答") ||
    normalize(b.textContent).includes("悪い回答"),
  );
  return buttons.slice(0, 6).map((b) => {
    let current = b.parentElement;
    const chain = [];
    let depth = 0;
    while (current && depth < 6) {
      chain.push({
        tag: current.tagName,
        className: current.className || null,
      });
      current = current.parentElement;
      depth += 1;
    }
    return { label: normalize(b.textContent), chain };
  });
});
```

```ts
// 4) コードブロックの言語ラベル位置確認
await page.evaluate(() => {
  const code = document.querySelector("pre code");
  if (!code) return null;
  const block = code.closest(".code-block");
  const label = block?.querySelector(".code-block-decoration");
  return {
    hasCodeBlock: Boolean(block),
    labelText: label ? label.textContent?.trim() : null,
    preTextSample: code.textContent?.slice(0, 80) ?? null,
  };
});
```

```ts
// 5) message block の候補数を簡易的に把握
await page.evaluate(() => {
  const isMarker = (b) => {
    const t = (b.getAttribute("aria-label") || b.textContent || "").replace(/\\s+/g, " ").trim();
    return ["プロンプトをコピー", "思考プロセスを表示", "良い回答", "悪い回答"].some((m) =>
      t.includes(m),
    );
  };
  const buttons = Array.from(document.querySelectorAll("button")).filter(isMarker);
  return { markerButtonCount: buttons.length };
});
```

### Playwright MCP での具体的な確認クエリ（英語 UI）

```ts
// 1) 主要マーカーの存在確認
await page.evaluate(() => {
  const labelText = (b) => (b.getAttribute("aria-label") || b.textContent || "");
  const markers = ["Copy prompt", "Show thinking", "Good response", "Bad response"];
  return markers.map((label) => ({
    label,
    count: Array.from(document.querySelectorAll("button")).filter((b) =>
      labelText(b).includes(label),
    ).length,
  }));
});
```

```ts
// 2) ユーザー見出しの検出（h2 と aria-level=2 の両方）
await page.evaluate(() => {
  const h2 = document.querySelectorAll("h2").length;
  const aria = document.querySelectorAll('[role="heading"][aria-level="2"]').length;
  return { h2, aria };
});
```

```ts
// 3) Gemini マーカーの祖先差分（重複抽出の原因確認）
await page.evaluate(() => {
  const normalize = (v) => (v || "").replace(/\\s+/g, " ").trim();
  const buttons = Array.from(document.querySelectorAll("button")).filter((b) =>
    normalize(b.getAttribute("aria-label") || b.textContent).includes("Show thinking") ||
    normalize(b.getAttribute("aria-label") || b.textContent).includes("Good response") ||
    normalize(b.getAttribute("aria-label") || b.textContent).includes("Bad response"),
  );
  return buttons.slice(0, 6).map((b) => {
    let current = b.parentElement;
    const chain = [];
    let depth = 0;
    while (current && depth < 6) {
      chain.push({
        tag: current.tagName,
        className: current.className || null,
      });
      current = current.parentElement;
      depth += 1;
    }
    return { label: normalize(b.getAttribute("aria-label") || b.textContent), chain };
  });
});
```

```ts
// 4) コードブロックの言語ラベル位置確認
await page.evaluate(() => {
  const code = document.querySelector("pre code");
  if (!code) return null;
  const block = code.closest(".code-block");
  const label = block?.querySelector(".code-block-decoration");
  return {
    hasCodeBlock: Boolean(block),
    labelText: label ? label.textContent?.trim() : null,
    preTextSample: code.textContent?.slice(0, 80) ?? null,
  };
});
```

```ts
// 5) message block の候補数を簡易的に把握
await page.evaluate(() => {
  const isMarker = (b) => {
    const t = (b.getAttribute("aria-label") || b.textContent || "").replace(/\\s+/g, " ").trim();
    return ["Copy prompt", "Show thinking", "Good response", "Bad response"].some((m) =>
      t.includes(m),
    );
  };
  const buttons = Array.from(document.querySelectorAll("button")).filter(isMarker);
  return { markerButtonCount: buttons.length };
});
```
### ファクトチェック方針（Playwright MCP）
- 目的: `docs/gemini-structure-guide.md` に書いている DOM 特徴が、実際の Gemini UI で再現できるかを定期的に検証する。
- 実施タイミング:
  - DOM 抽出ロジックを変更したとき
  - Gemini UI の変更が疑われるとき
- 確認対象:
  - `https://gemini.google.com/app/735afd264d35c312`（短い会話: コード・表あり）
  - `https://gemini.google.com/app/cbb342fdc6010a5e`（長い会話: スクロール必須）
- 観測ポイント（本ドキュメント内の記述に対応）:
  - 「Gemini ページ構造の特徴」にある class 名の観測結果が確認できるか
  - marker 文言の存在（「プロンプトをコピー」「思考プロセスを表示」「良い回答」「悪い回答」）
  - `response-content` / `response-container` が同時に存在する
  - `.code-block-decoration` に言語ラベルが表示される
  - `h2` か `role="heading"` + `aria-level="2"` でユーザー見出しが取れる
  - `.code-block-decoration` と `pre > code` の関係が維持されているか
  - marker 文言は `aria-label` 経由で取得できる
- 進め方:
  - 本ファイルの「Playwright MCP での具体的な確認クエリ」を実行
  - 結果が一致しない場合は、本ドキュメントと実装の両方を更新
  - 必要に応じてスクロールし、下部の message block でも同様の構造が保たれているか確認する

## 変更検知と更新手順
- 変更検知の合図:
  - 役割判定が崩れた (User/Gemini が逆転・欠落)
  - 返信が二重化した
  - コードブロック言語が空になった
  - 以前抽出できた要素（表・リスト）が消えた
- 変更時の一次調査:
  - Playwright MCP で「主要マーカー」「見出し」「コードブロック構造」を再確認
  - 祖先チェーンで marker が指す block が変わっていないかを比較
- 更新優先度:
  1) `markers.ts` の UI ラベル更新
  2) `findMessageBlocks()` と `splitMixedBlock()` のブロック判定
  3) `collectCodeBlocks()` と `findLanguageLabel()` の言語検出
  4) `serializeGeminiBlock()` / `serializeUserBlock()` の抽出要素
- 更新後の検証:
  - `pnpm test` で抽出系ユニットを確認
  - 該当チャットを再エクスポートして重複・言語・構造を目視確認

## 既知の落とし穴と回避策
- 二重抽出: Gemini マーカーが `.response-content` と `.response-container` に分散する。
- 言語未取得: 言語ラベルが `pre` の兄弟にあり、`pre` 内探索だけでは拾えない。
- 見出しの取り逃し: `h2` ではなく `role="heading"` + `aria-level="2"` のケースがある。
- UI ラベルの混入: 抽出テキストから UI ボタン文言を除去する必要がある。
- マーカー依存の脆さ: UI 文言の変更で role 判定が崩れる可能性がある。
- 返信の再生成: 「やり直す」などの UI が入ると marker 判定の祖先が変わる可能性がある。
- テーブル肥大化: 列数が多い場合は table パースが落ちる（列数制限で fallback される）。
- インライン code の誤判定: `code` が短くても copy UI が祖先にあると code block 扱いされる。
