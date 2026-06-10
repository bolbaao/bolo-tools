import { HttpError } from "./http-error.mjs";
import { formatArtifactLink, putChatArtifact } from "./chat-tool-artifacts.mjs";
import { generatePptx } from "./ppt-generate.mjs";
import { resolveChatConfig } from "./chat-config.mjs";
import { formatPptGenerateUnavailable } from "../../shared/public-error.mjs";

const PPT_INTENT_RE =
  /(?:pptx?|幻灯片|演示文稿|课件|汇报材料|路演稿)/i;
const PPT_ACTION_RE =
  /(?:做|写|生成|制作|导出|整理|给我|帮我|请|要|想要|出|弄|搞)/i;

export function detectPptGenerateIntent(text) {
  const msg = String(text || "").trim();
  if (!msg || msg.length > 500) return false;
  if (!PPT_INTENT_RE.test(msg)) return false;
  return PPT_ACTION_RE.test(msg) || /PPT|ppt|幻灯|演示|课件/.test(msg);
}

const GENERIC_TOPIC_RE = /^(一个|一份|一套|这个|那个|pptx?|幻灯片?|演示文稿?|课件)$/i;

function polishPptTopic(raw) {
  let s = String(raw || "")
    .replace(/[「」『』""]/g, "")
    .trim();
  for (let i = 0; i < 4; i += 1) {
    const next = s
      .replace(/的$/g, "")
      .replace(/(?:宣传|介绍|汇报|路演|材料|方案|报告|课件)$/g, "")
      .replace(/(?:pptx?|幻灯片|演示文稿)$/gi, "")
      .trim();
    if (next === s) break;
    s = next;
  }
  return s.replace(/\s+/g, " ").trim();
}

export function extractPptTopic(text) {
  const msg = String(text || "").trim();
  const patterns = [
    /(?:关于|主题是|主题：|主题是：)\s*[「『""]?([^」』""，。！？!?\n]{2,40})/,
    /(?:做|写|生成|制作|导出)(?:一份|一个|一套)?\s*[「『""]?([^」』""，。！？!?\n]{2,40})[」』""]?(?:的)?\s*(?:ppt|pptx|幻灯片|演示文稿|课件)/i,
    /[「『""]([^」』""]{2,40})[」』""](?:的)?\s*(?:ppt|pptx|幻灯片|演示文稿|课件)/i,
  ];

  let topic = "";
  for (const re of patterns) {
    const m = msg.match(re);
    if (!m?.[1]) continue;
    topic = polishPptTopic(m[1]);
    if (topic.length >= 2 && !GENERIC_TOPIC_RE.test(topic)) break;
    topic = "";
  }

  if (!topic || GENERIC_TOPIC_RE.test(topic)) {
    topic = polishPptTopic(
      msg
        .replace(/^(?:请|帮我?|给我|麻烦)?(?:做|写|生成|制作|导出|整理)(?:一份|一个|一套)?/i, "")
        .replace(/(?:的)?(?:pptx?|幻灯片|演示文稿|课件|汇报材料|路演稿).*/i, ""),
    );
  }

  if (!topic || topic.length < 2 || GENERIC_TOPIC_RE.test(topic)) {
    return msg.slice(0, 120);
  }
  return topic.slice(0, 80);
}

/**
 * @param {string} userMessage
 * @param {{ role: string, content: string }[]} [history]
 */
export async function tryPptGenerateReply(userMessage, history = []) {
  if (!detectPptGenerateIntent(userMessage)) return null;
  if (!resolveChatConfig()) {
    return formatPptGenerateUnavailable();
  }

  const topic = extractPptTopic(userMessage);
  try {
    const result = await generatePptx(topic, { history });
    const id = putChatArtifact({
      buffer: result.buffer,
      filename: result.filename,
      contentType: result.contentType,
    });
    return [
      `**PPT 已生成：${result.title}**`,
      "",
      `_共 ${result.slideCount} 页，已导出为标准 .pptx 文件_`,
      "",
      formatArtifactLink(id, `下载 ${result.filename}`),
    ].join("\n");
  } catch (e) {
    if (e instanceof HttpError) return e.message;
    return "PPT 生成失败，请换个更具体的主题后重试。";
  }
}
