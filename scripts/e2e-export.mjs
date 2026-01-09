import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";

import { chromium } from "playwright";

const rootDir = process.cwd();
const chatUrl = process.env.GEMINI_CHAT_URL;
const extensionPath = process.env.EXTENSION_PATH
  ? path.resolve(process.env.EXTENSION_PATH)
  : path.join(rootDir, ".output", "chrome-mv3");
const downloadsDir = process.env.DOWNLOAD_DIR
  ? path.resolve(process.env.DOWNLOAD_DIR)
  : path.join(rootDir, ".e2e-downloads");

const ensureDir = async (dir) => {
  await fsp.mkdir(dir, { recursive: true });
};

const waitForEnter = (message) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${message}\n`, () => {
      rl.close();
      resolve();
    });
  });

const getChatId = (url) => {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? null;
};

const waitForFile = async (filePath, timeoutMs) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(filePath)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
};

const readFirstLine = async (filePath) => {
  const content = await fsp.readFile(filePath, "utf8");
  return content.split(/\r?\n/)[0] ?? "";
};

if (!chatUrl) {
  console.error("GEMINI_CHAT_URL is required. Example: GEMINI_CHAT_URL=\"https://gemini.google.com/app/<chat_id>\" ");
  process.exit(1);
}

if (!fs.existsSync(extensionPath)) {
  console.error(
    `Extension build not found at ${extensionPath}. Run \"pnpm build\" first or set EXTENSION_PATH.`,
  );
  process.exit(1);
}

await ensureDir(downloadsDir);

const userDataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "gemini-export-e2e-"));

let context;
try {
  context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    acceptDownloads: true,
    downloadsPath: downloadsDir,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const page = await context.newPage();
  await page.goto(chatUrl, { waitUntil: "domcontentloaded" });
  await waitForEnter("Log in to Gemini if needed, confirm the chat is visible, then press Enter to continue.");

  const serviceWorker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker", { timeout: 15000 }));
  const extensionId = await serviceWorker.evaluate(() => chrome.runtime.id);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html`, {
    waitUntil: "domcontentloaded",
  });

  const expectedChatId = getChatId(chatUrl);
  if (!expectedChatId) {
    throw new Error("Failed to derive chat ID from GEMINI_CHAT_URL.");
  }
  const expectedFilename = `${expectedChatId}.md`;
  const expectedPath = path.join(downloadsDir, expectedFilename);

  const downloadPromise = context
    .waitForEvent("download", { timeout: 15000 })
    .catch(() => null);

  await popup.getByRole("button", { name: "Export current chat" }).click();

  const download = await downloadPromise;
  if (download) {
    await download.saveAs(expectedPath);
  } else {
    const found = await waitForFile(expectedPath, 20000);
    if (!found) {
      throw new Error(`Download not detected. Expected ${expectedPath}`);
    }
  }

  const firstLine = await readFirstLine(expectedPath);
  if (!firstLine.includes("gemini-export")) {
    throw new Error("Downloaded file does not start with gemini-export metadata.");
  }

  console.log("E2E export succeeded.");
  console.log(`Downloaded: ${expectedPath}`);
  console.log(`First line: ${firstLine}`);
} finally {
  if (context) {
    await context.close();
  }
  await fsp.rm(userDataDir, { recursive: true, force: true });
}
