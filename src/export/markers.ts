/**
 * UI labels that indicate user message actions.
 */
export const USER_MARKERS = ["プロンプトをコピー"];
/**
 * UI labels that indicate Gemini message actions.
 */
export const GEMINI_MARKERS = ["思考プロセスを表示", "良い回答", "悪い回答"];

/**
 * All UI labels that should be stripped from extracted text.
 */
export const UI_LABELS = [...USER_MARKERS, ...GEMINI_MARKERS, "コードをコピー"];
