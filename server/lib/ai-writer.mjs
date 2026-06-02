import OpenAI from "openai";
import { HttpError } from "./http-error.mjs";
import { getChatProviderLabel, resolveChatConfig } from "./chat-config.mjs";
import { env } from "./env.mjs";

export const WRITING_MODES = {
  article: {
    label: "写文章",
    hint: "根据主题生成完整文章",
    system: "你是专业中文写作者。根据用户给出的主题与要求，写一篇结构清晰、可读性强的文章。使用 Markdown 标题与段落，语言自然，避免空洞套话。",
  },
  rewrite: {
    label: "改写",
    hint: "换种说法，保留原意",
    system: "你是文字编辑。在保留原意与关键信息的前提下，改写用户提供的文本，使表达更流畅或更符合指定风格。直接输出改写结果，不要解释。",
  },
  polish: {
    label: "润色",
    hint: "修正语病，提升文采",
    system: "你是资深文字编辑。润色用户文本：修正语病、标点与逻辑，提升可读性与文采，不改变核心观点。直接输出润色后的全文。",
  },
  expand: {
    label: "扩写",
    hint: "补充细节与论述",
    system: "你是内容创作者。在用户提供文本基础上扩写：补充细节、例子与论述，使内容更充实。保持原有结构与语气，直接输出扩写结果。",
  },
  summarize: {
    label: "摘要",
    hint: "提炼要点",
    system: "你是信息提炼专家。将用户文本浓缩为简洁摘要，保留关键论点与结论。可用条目或短段落，直接输出摘要。",
  },
  social: {
    label: "社媒文案",
    hint: "小红书 / 公众号风格",
    system: "你是新媒体运营。根据主题撰写适合中文社媒发布的文案：开头有吸引力，段落短，可加适量 emoji，结尾可有互动引导。直接输出文案正文。",
  },
  email: {
    label: "邮件",
    hint: "商务或日常邮件",
    system: "你是商务沟通助手。根据用户描述撰写得体的中文邮件：含合适称呼、正文与结尾敬语。直接输出邮件全文。",
  },
  translate: {
    label: "翻译",
    hint: "中英互译",
    system: "你是专业翻译。准确翻译用户提供的内容，保持语气与格式。若原文为中文则译成英文，若为英文则译成中文；若用户指定目标语言则按指定语言输出。只输出译文。",
  },
};

const TONE_HINTS = {
  formal: "语气正式、专业",
  casual: "语气轻松、口语化",
  professional: "语气专业、简洁",
  warm: "语气温暖、有亲和力",
  persuasive: "语气有说服力、适合营销",
};

const LENGTH_HINTS = {
  short: "篇幅简短（约 200–400 字）",
  medium: "篇幅适中（约 500–800 字）",
  long: "篇幅较长（约 1000–1500 字）",
};

function buildUserMessage({ input, topic, tone, length, targetLang }) {
  const parts = [];
  if (topic?.trim()) parts.push(`主题/场景：${topic.trim()}`);
  if (tone && TONE_HINTS[tone]) parts.push(`语气要求：${TONE_HINTS[tone]}`);
  if (length && LENGTH_HINTS[length]) parts.push(`篇幅要求：${LENGTH_HINTS[length]}`);
  if (targetLang?.trim()) parts.push(`目标语言：${targetLang.trim()}`);
  parts.push("", "正文或素材：", input.trim());
  return parts.join("\n");
}

export function listWritingModes() {
  return Object.entries(WRITING_MODES).map(([id, m]) => ({
    id,
    label: m.label,
    hint: m.hint,
  }));
}

/**
 * @param {{ mode: string, input: string, topic?: string, tone?: string, length?: string, targetLang?: string }} opts
 */
export async function generateWriting(opts) {
  const chatConfig = resolveChatConfig();
  if (!chatConfig) {
    throw new HttpError(
      503,
      "未配置 DEEPSEEK_API_KEY 或 ARK_API_KEY。请在 .env 配置后重启。",
    );
  }

  const mode = WRITING_MODES[opts.mode];
  if (!mode) throw new HttpError(400, "不支持的写作模式");

  const input = opts.input?.trim();
  if (!input) throw new HttpError(400, "请填写主题或待处理文本");

  const timeoutMs = Number(env("AI_WRITER_TIMEOUT_MS", "120000")) || 120000;
  const client = new OpenAI({
    apiKey: chatConfig.apiKey,
    baseURL: chatConfig.baseURL,
    timeout: timeoutMs,
    maxRetries: 0,
  });

  try {
    const completion = await client.chat.completions.create({
      model: chatConfig.model,
      messages: [
        { role: "system", content: mode.system },
        {
          role: "user",
          content: buildUserMessage(opts),
        },
      ],
      temperature: opts.mode === "translate" ? 0.3 : 0.65,
      max_tokens: 4096,
    });

    const text = completion.choices?.[0]?.message?.content?.trim();
    if (!text) throw new HttpError(502, "AI 未返回有效内容");

    return {
      text,
      mode: opts.mode,
      modeLabel: mode.label,
      provider: getChatProviderLabel(chatConfig.provider),
    };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    const msg = e?.message || String(e);
    if (/401|invalid.*key/i.test(msg)) {
      throw new HttpError(503, `${getChatProviderLabel(chatConfig.provider)} API Key 无效`);
    }
    if (/timeout|timed out|AbortError/i.test(msg)) {
      throw new HttpError(408, "生成超时，请缩短输入后重试");
    }
    throw new HttpError(502, `写作生成失败：${msg.slice(0, 200)}`);
  }
}
