import type { ExportMessage, ExportRole } from "@/src/export/types";
import { findMessageBlocks, splitMixedBlock } from "@/src/export/discovery";

/**
 * Describes a parsed block item within a chat segment.
 */
type BlockItem =
  | { type: "paragraph"; element: Element }
  | { type: "heading"; element: Element }
  | { type: "list"; element: Element }
  | { type: "code"; element: Element; code: string; lang: string | null }
  | { type: "table"; element: Element; rows: string[][] | null };

/**
 * Options for message extraction.
 */
export type ExtractOptions = { maxCharsPerMessage?: number };

/**
 * Normalizes text by collapsing whitespace and trimming.
 */
const normalizeText = (value: string | null | undefined) =>
  value?.replace(/\s+/g, " ").trim() ?? "";

/**
 * Normalizes extracted text for display and export.
 */
const normalizeOutput = (value: string) => normalizeText(value);

/**
 * Clone the block and strip UI controls so text extraction is language-agnostic.
 */
const cloneAndStripUi = (block: Element) => {
  const clone = block.cloneNode(true) as Element;
  const selectors = [
    "button",
    '[role="button"]',
    "message-actions",
    "mat-menu",
    "mat-icon",
    ".response-container-header",
    ".response-container-header-controls",
    ".response-container-header-status",
    ".response-container-header-processing-state",
    ".response-tts-container",
    ".menu-button-wrapper",
    ".more-menu-button-container",
    "copy-button",
    "thumb-up-button",
    "thumb-down-button",
    "regenerate-button",
    '[data-test-id="copy-button"]',
    '[data-test-id="more-menu-button"]',
    '[data-test-id="actions-menu-button"]',
    '[data-test-id="thoughts-header-button"]',
  ];

  for (const selector of selectors) {
    clone.querySelectorAll(selector).forEach((element) => element.remove());
  }

  return clone;
};

/**
 * Comparator that sorts elements by document order.
 */
const compareDocumentOrder = (a: Element, b: Element) => {
  if (a === b) {
    return 0;
  }
  const position = a.compareDocumentPosition(b);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
    return -1;
  }
  if (position & Node.DOCUMENT_POSITION_PRECEDING) {
    return 1;
  }
  return 0;
};

/**
 * Attempts to find a timestamp label within a block.
 */
const findTimestamp = (block: Element): string | null => {
  const timeElement = block.querySelector("time");
  if (timeElement) {
    const text = normalizeText(timeElement.textContent);
    if (text) {
      return text;
    }
  }

  const labeled = Array.from(block.querySelectorAll<HTMLElement>("[aria-label]"));
  const timePattern = /(\d{1,2}:\d{2})|(\d{1,2}時\d{2}分)/;
  for (const element of labeled) {
    const label = normalizeText(element.getAttribute("aria-label"));
    if (label && timePattern.test(label)) {
      return label;
    }
  }
  return null;
};

/**
 * Checks if the element is equal to or within a container.
 */
const isWithin = (element: Element, container: Element) =>
  element === container || container.contains(element);

/**
 * Finds a language label in a code block container.
 */
const findLanguageLabel = (container: Element) => {
  const codeBlock = container.classList.contains("code-block")
    ? container
    : container.closest(".code-block, code-block");
  const decorated = codeBlock?.querySelector<HTMLElement>(".code-block-decoration");
  const decoratedText = normalizeText(decorated?.textContent);
  if (decoratedText && /^[A-Za-z0-9+#_.-]{1,20}$/.test(decoratedText)) {
    return decoratedText.toLowerCase();
  }
  const candidates = Array.from(
    container.querySelectorAll<HTMLElement>("span, div, label, button"),
  );
  for (const candidate of candidates) {
    if (candidate.closest("code")) {
      continue;
    }
    const text = normalizeText(candidate.textContent);
    if (!text) {
      continue;
    }
    if (/^[A-Za-z0-9+#_.-]{1,20}$/.test(text)) {
      return text.toLowerCase();
    }
  }
  return null;
};

/**
 * Collects code blocks (including fenced code) within a block.
 */
const collectCodeBlocks = (block: Element) => {
  const codeElements = Array.from(block.querySelectorAll("code"));
  const containers = new Map<Element, { code: string; lang: string | null }>();

  const resolveContainer = (element: Element) =>
    element.closest(".code-block") ??
    element.closest("code-block") ??
    element.closest("pre") ??
    element;

  const addContainer = (container: Element, code: string, lang: string | null) => {
    if (containers.has(container)) {
      return;
    }
    containers.set(container, { code, lang });
  };

  for (const code of codeElements) {
    const codeText = code.textContent ?? "";
    const isBlock = codeText.includes("\n") || Boolean(code.closest("pre"));
    if (!isBlock) {
      continue;
    }

    const container = resolveContainer(code);
    const lang = findLanguageLabel(container);
    addContainer(container, codeText, lang);
  }

  const preElements = Array.from(block.querySelectorAll("pre"));
  for (const pre of preElements) {
    if (pre.querySelector("code")) {
      continue;
    }
    const codeText = pre.textContent ?? "";
    if (!codeText.trim()) {
      continue;
    }
    const container = resolveContainer(pre);
    const lang = findLanguageLabel(container);
    addContainer(container, codeText, lang);
  }

  const codeBlockElements = Array.from(block.querySelectorAll("code-block"));
  for (const codeBlock of codeBlockElements) {
    const container = codeBlock.querySelector<HTMLElement>(".code-block") ?? codeBlock;
    if (containers.has(container)) {
      continue;
    }
    const code = codeBlock.querySelector("code, pre");
    const codeText = code?.textContent ?? "";
    if (!codeText.trim()) {
      continue;
    }
    const lang = findLanguageLabel(container);
    addContainer(container, codeText, lang);
  }

  return Array.from(containers.entries()).map(([element, data]) => ({
    element,
    ...data,
  }));
};

/**
 * Collects table blocks within a block and parses their rows.
 */
const collectTableBlocks = (block: Element) =>
  Array.from(block.querySelectorAll("table")).map((table) => ({
    element: table,
    rows: extractTableRows(table),
  }));

/**
 * Extracts normalized text rows from a table element.
 */
const extractTableRows = (table: Element): string[][] | null => {
  const rows = Array.from(table.querySelectorAll("tr"));
  if (rows.length === 0) {
    return null;
  }
  const parsed: string[][] = [];
  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll("th, td")).map((cell) =>
      normalizeOutput(cell.textContent ?? ""),
    );
    if (cells.length === 0) {
      continue;
    }
    parsed.push(cells);
  }
  if (parsed.length === 0) {
    return null;
  }
  const maxCols = Math.max(...parsed.map((cells) => cells.length));
  if (maxCols > 20) {
    return null;
  }
  return parsed;
};

/**
 * Collects ordered items (headings, paragraphs, lists, code, tables) from a block.
 */
const collectBlockItems = (block: Element): BlockItem[] => {
  const codeBlocks = collectCodeBlocks(block);
  const tableBlocks = collectTableBlocks(block);

  const codeContainers = codeBlocks.map((item) => item.element);
  const tableContainers = tableBlocks.map((item) => item.element);

  const isInsideKnownContainer = (element: Element) =>
    codeContainers.some((container) => isWithin(element, container)) ||
    tableContainers.some((container) => isWithin(element, container));

  const items: BlockItem[] = [];

  for (const heading of Array.from(block.querySelectorAll("h3"))) {
    if (!isInsideKnownContainer(heading)) {
      items.push({ type: "heading", element: heading });
    }
  }

  for (const paragraph of Array.from(block.querySelectorAll("p"))) {
    if (!isInsideKnownContainer(paragraph) && !paragraph.closest("li")) {
      items.push({ type: "paragraph", element: paragraph });
    }
  }

  for (const list of Array.from(block.querySelectorAll("ul, ol"))) {
    if (!isInsideKnownContainer(list)) {
      items.push({ type: "list", element: list });
    }
  }

  for (const code of codeBlocks) {
    items.push({ type: "code", element: code.element, code: code.code, lang: code.lang });
  }

  for (const table of tableBlocks) {
    items.push({ type: "table", element: table.element, rows: table.rows });
  }

  items.sort((a, b) => compareDocumentOrder(a.element, b.element));
  return items;
};

/**
 * Serializes a list element into markdown.
 */
const serializeList = (list: Element) => {
  const isOrdered = list.tagName.toLowerCase() === "ol";
  const items = Array.from(list.querySelectorAll("li"));
  return items
    .map((item, index) => {
      const text = normalizeOutput(item.textContent ?? "");
      if (!text) {
        return null;
      }
      const prefix = isOrdered ? `${index + 1}. ` : "- ";
      return `${prefix}${text}`;
    })
    .filter(Boolean)
    .join("\n");
};

/**
 * Serializes table rows into a markdown table.
 */
const serializeTable = (rows: string[][] | null) => {
  if (!rows || rows.length === 0) {
    return "";
  }
  const header = rows[0];
  const body = rows.slice(1);
  const headerLine = `| ${header.join(" | ")} |`;
  const separatorLine = `| ${header.map(() => "---").join(" | ")} |`;
  const bodyLines = body.map((row) => `| ${row.join(" | ")} |`);
  return [headerLine, separatorLine, ...bodyLines].join("\n");
};

/**
 * Builds a fenced code block with an optional language.
 */
const buildCodeBlock = (code: string, lang: string | null) => {
  const language = lang ? lang.trim() : "";
  const fence = "```";
  return `${fence}${language}\n${code.replace(/\n$/, "")}\n${fence}`;
};

/**
 * Serializes a Gemini response block into markdown and text.
 */
const serializeGeminiBlock = (block: Element, messageIndex: number) => {
  const items = collectBlockItems(block);
  const markdownParts: string[] = [];
  let codeIndex = 1;
  let tableIndex = 1;

  for (const item of items) {
    if (item.type === "paragraph") {
      const text = normalizeOutput(item.element.textContent ?? "");
      if (text) {
        markdownParts.push(text);
      }
    }

    if (item.type === "heading") {
      const text = normalizeOutput(item.element.textContent ?? "");
      if (text) {
        markdownParts.push(`### ${text}`);
      }
    }

    if (item.type === "list") {
      const text = serializeList(item.element);
      if (text) {
        markdownParts.push(text);
      }
    }

    if (item.type === "code") {
      const anchor = `<!-- gemini-export:block type=code id=msg-${messageIndex}-code-${codeIndex} lang=${item.lang ?? ""} -->`;
      const block = buildCodeBlock(item.code, item.lang);
      markdownParts.push(anchor, block, "<!-- /gemini-export:block -->");
      codeIndex += 1;
    }

    if (item.type === "table") {
      const anchor = `<!-- gemini-export:block type=table id=msg-${messageIndex}-table-${tableIndex} -->`;
      const table = serializeTable(item.rows);
      if (table) {
        markdownParts.push(anchor, table, "<!-- /gemini-export:block -->");
      } else {
        const fallback = normalizeOutput(item.element.textContent ?? "");
        if (fallback) {
          markdownParts.push(anchor, fallback, "<!-- /gemini-export:block -->");
        }
      }
      tableIndex += 1;
    }
  }

  const markdown = markdownParts.filter(Boolean).join("\n\n");
  const cleaned = cloneAndStripUi(block);
  const text = normalizeOutput((cleaned as HTMLElement).innerText ?? cleaned.textContent ?? "");
  return { markdown, text };
};

/**
 * Serializes a user prompt block into markdown/text.
 */
const serializeUserBlock = (block: Element) => {
  const heading = block.querySelector('h2, [role="heading"][aria-level="2"]');
  const mainText = heading ? normalizeOutput(heading.textContent ?? "") : "";
  const paragraphs = Array.from(block.querySelectorAll("p"))
    .map((p) => normalizeOutput(p.textContent ?? ""))
    .filter((text) => text && text !== mainText);

  const parts = [mainText, ...paragraphs].filter(Boolean);
  const markdown = parts.join("\n\n");
  return { markdown, text: markdown };
};

/**
 * Clamps a string to a maximum length.
 */
const clamp = (value: string, maxChars: number) =>
  value.length > maxChars ? value.slice(0, maxChars) : value;

/**
 * Determines the role for the current block based on tag names and history.
 */
const determineRole = (block: Element, previousRole: ExportRole | null): ExportRole | null => {
  const tagName = block.tagName.toLowerCase();
  if (tagName === "user-query") {
    return "user";
  }
  if (tagName === "model-response") {
    return "gemini";
  }
  if (previousRole === "user") {
    return "gemini";
  }
  return null;
};

/**
 * Extracts chat messages from the DOM root into exportable payload data.
 *
 * @param root - Root element containing the chat transcript.
 * @param options - Extraction options such as per-message size limit.
 * @returns Ordered list of exported messages.
 */
export function extractMessages(root: Element, options: ExtractOptions = {}): ExportMessage[] {
  const maxChars = options.maxCharsPerMessage ?? 200000;
  const blocks = findMessageBlocks(root);
  const messages: ExportMessage[] = [];
  let order = 1;
  let previousRole: ExportRole | null = null;

  for (const block of blocks) {
    const splitBlocks = splitMixedBlock(root, block);
    for (const segment of splitBlocks) {
      const role = determineRole(segment, previousRole);
      if (!role) {
        continue;
      }

      let markdown = "";
      let text = "";
      if (role === "user") {
        ({ markdown, text } = serializeUserBlock(segment));
      } else {
        ({ markdown, text } = serializeGeminiBlock(segment, order));
      }

      markdown = clamp(markdown, maxChars);
      text = clamp(text, maxChars);

      if (!markdown && !text) {
        continue;
      }

      const timestamp = findTimestamp(segment);
      messages.push({
        role,
        markdown,
        text,
        timestamp,
        order,
      });
      previousRole = role;
      order += 1;
    }
  }

  return messages;
}
