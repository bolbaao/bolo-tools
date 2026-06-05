import { getLatestChatUpload } from "./user-media-library.mjs";
import { pickFirstRaw } from "./chat-tool-media.mjs";
import { executeAgentTool } from "./chat-tool-runner.mjs";

const ATTACHMENT_NOTE_RE = /\n\[已附加 \d+ 个文件\]$/;

function stripAttachmentNote(text) {
  return String(text || "").replace(ATTACHMENT_NOTE_RE, "").trim();
}

/** @returns {"extract" | "transcribe" | null} */
export function detectSubtitleIntent(text) {
  const msg = stripAttachmentNote(text);
  if (!msg || msg.length > 120) return null;

  if (/提取.*字[幕母]|内嵌字幕|硬字幕|字幕轨|提取内嵌|扒字幕|导出字幕|下载字幕/.test(msg)) {
    return "extract";
  }
  if (/转写|语音转|生成字幕|转文字|听写|识别语音|加字幕|出字幕|做字幕|转字幕|听译/.test(msg)) {
    return "transcribe";
  }
  if (/字幕/.test(msg) && /提取|拿|弄|搞|导出|下载|要|帮/.test(msg)) {
    return "extract";
  }
  return null;
}

function resolveMediaFiles(rawFiles, userId) {
  const list = Array.isArray(rawFiles) ? rawFiles.filter((f) => f?.buffer?.length) : [];
  if (list.length) return list;
  const cached = getLatestChatUpload(userId, ["video", "audio"]);
  return cached ? [cached] : [];
}

/**
 * 用户明确要求字幕时，直接在对话内执行，不依赖 LLM 输出 agent JSON。
 * @returns {Promise<string | null>}
 */
export async function trySubtitleToolReply(userMessage, { rawFiles, userId } = {}) {
  const intent = detectSubtitleIntent(userMessage);
  if (!intent) return null;

  const files = resolveMediaFiles(rawFiles, userId);
  const media = pickFirstRaw(files, ["video", "audio"]);
  if (!media) return null;

  const result = await executeAgentTool(
    { toolId: "subtitle-workshop", fields: { tab: intent } },
    { rawFiles: files, userId, lastUserMessage: userMessage },
  );

  if (result.ok) {
    return result.text;
  }
  return result.error ? `⚠️ ${result.error}` : null;
}
