import { GEMINI_MARKERS, USER_MARKERS } from "@/src/export/markers";

/**
 * Role associated with Gemini or user marker buttons.
 */
type MarkerRole = "user" | "gemini";

/**
 * Marker match result with role and button element.
 */
type MarkerMatch = {
  role: MarkerRole;
  element: HTMLButtonElement;
};

/**
 * Text markers that identify the conversation heading.
 */
const HEADING_MARKERS = ["Gemini との会話", "Conversation with Gemini"];

/**
 * Normalizes text by collapsing whitespace and trimming.
 */
const normalizeText = (value: string | null | undefined) =>
  value?.replace(/\s+/g, " ").trim() ?? "";

/**
 * Checks whether the text contains any of the marker strings.
 */
const textMatches = (value: string, markers: string[]) =>
  markers.some((marker) => value.includes(marker));

/**
 * Reads a button's accessible label or visible text.
 */
const buttonText = (button: HTMLButtonElement) =>
  normalizeText(button.getAttribute("aria-label") || button.textContent);

/**
 * Determines the marker role from button text.
 */
const getMarkerRole = (button: HTMLButtonElement): MarkerRole | null => {
  const text = buttonText(button);
  if (!text) {
    return null;
  }
  if (textMatches(text, USER_MARKERS)) {
    return "user";
  }
  if (textMatches(text, GEMINI_MARKERS)) {
    return "gemini";
  }
  return null;
};

/**
 * Finds the heading element that indicates the chat root.
 */
const findHeading = (doc: Document): Element | null => {
  const headings = Array.from(doc.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  for (const heading of headings) {
    const text = normalizeText(heading.textContent);
    if (!text) {
      continue;
    }
    if (HEADING_MARKERS.some((marker) => text.includes(marker))) {
      return heading;
    }
  }
  return null;
};

/**
 * Checks whether a block contains user content markers.
 */
const hasUserContent = (element: Element) =>
  Boolean(element.querySelector('h2, [role="heading"][aria-level="2"]'));

/**
 * Checks whether a block contains Gemini content markers.
 */
const hasGeminiContent = (element: Element) =>
  Boolean(element.querySelector("p, ul, ol, pre, code, table"));

/**
 * Finds the closest ancestor that represents a message block.
 */
const findClosestBlock = (start: Element, role: MarkerRole, root: Element): Element => {
  let current: Element | null = start.parentElement;
  while (current && current !== root) {
    if (role === "user" && hasUserContent(current)) {
      return current;
    }
    if (role === "gemini" && hasGeminiContent(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return start.parentElement ?? start;
};

/**
 * Collects button markers from the root element.
 */
const findMarkers = (root: Element): MarkerMatch[] => {
  const buttons = Array.from(root.querySelectorAll("button"));
  const matches: MarkerMatch[] = [];
  for (const button of buttons) {
    const role = getMarkerRole(button);
    if (role) {
      matches.push({ role, element: button });
    }
  }
  return matches;
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
 * Returns marker buttons for the specified role within the element.
 */
export const getMarkerButtons = (element: Element, role: MarkerRole) => {
  const markers = role === "user" ? USER_MARKERS : GEMINI_MARKERS;
  return Array.from(element.querySelectorAll<HTMLButtonElement>("button")).filter((button) =>
    textMatches(buttonText(button), markers),
  );
};

/**
 * Finds the root element that contains the chat content.
 */
export function findChatRoot(doc: Document): Element | null {
  const heading = findHeading(doc);
  if (heading) {
    let current: Element | null = heading.parentElement;
    while (current && current !== doc.body) {
      const markerCount = findMarkers(current).length;
      if (markerCount >= 2) {
        return current;
      }
      current = current.parentElement;
    }
    return heading.parentElement ?? doc.body;
  }

  return doc.querySelector("main") ?? doc.body;
}

/**
 * Collects message blocks for the chat, ordered by appearance.
 */
export function findMessageBlocks(root: Element): Element[] {
  const markers = findMarkers(root);
  const blockSet = new Set<Element>();

  for (const marker of markers) {
    const block = findClosestBlock(marker.element, marker.role, root);
    if (block) {
      blockSet.add(block);
    }
  }

  const blocks = Array.from(blockSet);
  blocks.sort(compareDocumentOrder);
  return blocks;
}

/**
 * Splits a block that contains both user and Gemini markers into two ordered blocks.
 */
export function splitMixedBlock(root: Element, block: Element): Element[] {
  const userMarkers = getMarkerButtons(block, "user");
  const geminiMarkers = getMarkerButtons(block, "gemini");

  if (userMarkers.length === 0 || geminiMarkers.length === 0) {
    return [block];
  }

  const userBlock = findClosestBlock(userMarkers[0], "user", root);
  const geminiBlock = findClosestBlock(geminiMarkers[0], "gemini", root);

  if (userBlock === geminiBlock) {
    return [block];
  }

  const ordered = [userBlock, geminiBlock].sort(compareDocumentOrder);
  return ordered;
}
