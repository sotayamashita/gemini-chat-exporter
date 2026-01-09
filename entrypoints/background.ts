import type { DownloadExportRequest, DownloadExportResponse } from "@/src/export/messages";

const downloadMarkdown = async (
  filename: string,
  markdown: string,
): Promise<DownloadExportResponse> => {
  try {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    await browser.downloads.download({
      url,
      filename,
      saveAs: false,
    });
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Download failed.",
    };
  }
};

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: DownloadExportRequest) => {
    if (message?.type === "download-export") {
      return downloadMarkdown(message.payload.filename, message.payload.markdown);
    }
    return undefined;
  });
});
