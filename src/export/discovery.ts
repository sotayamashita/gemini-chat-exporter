/**
 * Selectors that reliably identify the chat history container across UI languages.
 */
const CHAT_ROOT_SELECTORS = [
  "#chat-history",
  'infinite-scroller[data-test-id="chat-history-container"]',
];

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
 * Finds the root element that contains the chat content.
 */
export function findChatRoot(doc: Document): Element | null {
  for (const selector of CHAT_ROOT_SELECTORS) {
    const element = doc.querySelector(selector);
    if (element) {
      return element;
    }
  }
  return doc.querySelector("main") ?? doc.body;
}

/**
 * Collects message blocks for the chat, ordered by appearance.
 */
export function findMessageBlocks(root: Element): Element[] {
  const messageBlocks = Array.from(root.querySelectorAll("user-query, model-response"));
  if (messageBlocks.length > 0) {
    return messageBlocks.sort(compareDocumentOrder);
  }

  const conversationBlocks = Array.from(root.querySelectorAll(".conversation-container"));
  if (conversationBlocks.length > 0) {
    return conversationBlocks.sort(compareDocumentOrder);
  }

  return [];
}

/**
 * Splits a block that contains user-query and model-response elements into ordered blocks.
 */
export function splitMixedBlock(_root: Element, block: Element): Element[] {
  const tagName = block.tagName.toLowerCase();
  if (tagName === "user-query" || tagName === "model-response") {
    return [block];
  }

  const childBlocks = Array.from(block.querySelectorAll("user-query, model-response"));
  if (childBlocks.length === 0) {
    return [block];
  }

  return childBlocks.sort(compareDocumentOrder);
}
