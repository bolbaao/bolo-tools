import OpenAI from "openai";
import { resolveChatConfig } from "./chat-config.mjs";
import { env } from "./env.mjs";
import { addUserMemoryAuto, listUserMemories } from "./user-memory.mjs";

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
- 若无值得记住的内容，返回 {"memories":[]}
- 最多返回 3 条

已有记忆：
${existingLines}`,
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
