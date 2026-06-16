import OpenAI from "openai";
import { resolveChatConfig } from "./chat-config.mjs";
import { env } from "./env.mjs";
import { addUserMemoryAuto, addUserMemoryFromFile, listUserMemories } from "./user-memory.mjs";

function parseExtractJson(raw) {
  const text = String(raw ?? "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : text;
  return JSON.parse(candidate);
}

function normalizeForCompare(text) {
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function isDuplicate(existing, candidate) {
  const c = normalizeForCompare(candidate);
  if (!c) return true;
  return existing.some((m) => {
    const e = normalizeForCompare(m.content);
    return e === c || e.includes(c) || c.includes(e);
  });
}

export async function extractAndSaveMemories(userId, { userMessage, assistantReply }) {
  const userText = String(userMessage ?? "").trim();
  const aiText = String(assistantReply ?? "").trim();
  if (!userText || userText.length < 8) return [];

  const chatConfig = resolveChatConfig();
  if (!chatConfig) return [];

  const existing = listUserMemories(userId).slice(0, 30);
  const existingLines = existing.length
    ? existing.map((m, i) => `${i + 1}. ${m.content}`).join("\n")
    : "（暂无）";

  const client = new OpenAI({
    apiKey: chatConfig.apiKey,
    baseURL: chatConfig.baseURL,
    timeout: Number(env("MEMORY_EXTRACT_TIMEOUT_MS", "25000")) || 25000,
    maxRetries: 0,
  });

  const completion = await client.chat.completions.create({
    model: chatConfig.model,
    temperature: 0.2,
    max_tokens: 512,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `你是记忆提取助手。从用户与 AI 的对话中，提取值得长期记住的用户个人信息（偏好、身份、习惯、重要事实）。
规则：
- 只提取用户明确表达或强烈暗示的个人信息，不要猜测
- 不要提取一次性问题、工具操作指令、寒暄
- 每条记忆用简洁中文陈述，不超过 80 字
- 不要与已有记忆重复或语义相近
- 若无值得记住的内容，返回 JSON：{"memories":[]}
- 最多返回 3 条

已有记忆：
${existingLines}

只输出 JSON 对象：{"memories":["记忆1","记忆2"]}`,
      },
      {
        role: "user",
        content: `用户：${userText.slice(0, 1500)}\n\nAI：${aiText.slice(0, 1500)}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  let parsed;
  try {
    parsed = parseExtractJson(raw);
  } catch {
    return [];
  }

  const candidates = Array.isArray(parsed.memories)
    ? parsed.memories.map((m) => String(m ?? "").trim()).filter(Boolean).slice(0, 3)
    : [];

  const added = [];
  const allExisting = [...existing];
  for (const content of candidates) {
    if (isDuplicate(allExisting, content)) continue;
    try {
      const item = addUserMemoryAuto(userId, content);
      added.push(item);
      allExisting.push(item);
    } catch {
      break;
    }
  }
  return added;
}

/**
 * 从上传文件文本中提取并保存记忆。
 * @param {string} userId
 * @param {string} text
 * @param {{ filename?: string }} [opts]
 */
export async function extractMemoriesFromFileContent(userId, text, opts = {}) {
  const content = String(text ?? "").trim();
  if (!content || content.length < 8) {
    throw Object.assign(new Error("文件内容过短，无法提取记忆"), { status: 422 });
  }

  const chatConfig = resolveChatConfig();
  if (!chatConfig) {
    throw Object.assign(new Error("未配置 AI，无法从文件提取记忆"), { status: 503 });
  }

  const existing = listUserMemories(userId).slice(0, 30);
  const existingLines = existing.length
    ? existing.map((m, i) => `${i + 1}. ${m.content}`).join("\n")
    : "（暂无）";

  const filename = String(opts.filename || "上传文件").slice(0, 120);

  const client = new OpenAI({
    apiKey: chatConfig.apiKey,
    baseURL: chatConfig.baseURL,
    timeout: Number(env("MEMORY_EXTRACT_TIMEOUT_MS", "45000")) || 45000,
    maxRetries: 0,
  });

  const completion = await client.chat.completions.create({
    model: chatConfig.model,
    temperature: 0.2,
    max_tokens: 1200,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `你是记忆提取助手。从用户上传的文档中提取值得长期记住的个人信息（偏好、身份、习惯、重要事实、常用配置等）。
规则：
- 只提取文档中明确写出的个人信息，不要猜测
- 不要提取版权说明、目录、页眉页脚等无关内容
- 每条记忆用简洁中文陈述，不超过 120 字
- 不要与已有记忆重复或语义相近
- 若文档没有可用的个人信息，返回 JSON：{"memories":[]}
- 最多返回 12 条

已有记忆：
${existingLines}

只输出 JSON 对象：{"memories":["记忆1","记忆2"]}`,
      },
      {
        role: "user",
        content: `文件名：${filename}\n\n文档内容：\n${content.slice(0, 8000)}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  let parsed;
  try {
    parsed = parseExtractJson(raw);
  } catch {
    throw Object.assign(new Error("AI 未能解析文件内容"), { status: 502 });
  }

  const candidates = Array.isArray(parsed.memories)
    ? parsed.memories.map((m) => String(m ?? "").trim()).filter(Boolean).slice(0, 12)
    : [];

  if (!candidates.length) {
    throw Object.assign(new Error("未能从文件中识别出可保存的个人记忆"), { status: 422 });
  }

  const added = [];
  const allExisting = [...existing];
  for (const item of candidates) {
    if (isDuplicate(allExisting, item)) continue;
    try {
      const memory = addUserMemoryFromFile(userId, item);
      added.push(memory);
      allExisting.push(memory);
    } catch {
      break;
    }
  }

  if (!added.length) {
    throw Object.assign(new Error("提取到的内容与已有记忆重复，未新增条目"), { status: 422 });
  }

  return added;
}
