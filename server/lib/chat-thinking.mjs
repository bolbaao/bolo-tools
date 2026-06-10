import { env } from "./env.mjs";

export function isSelfVerifyEnabled() {
  const v = String(env("CHAT_SELF_VERIFY", "1")).trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "off";
}

/**
 * @param {import("openai").OpenAI} client
 * @param {{ model: string, provider: string }} config
 * @param {{ userMessage: string, reply: string }} input
 */
export async function verifyAssistantReply(client, config, input) {
  if (!isSelfVerifyEnabled() || !input.reply?.trim()) {
    return { reply: input.reply, verification: null };
  }

  const verifyModel =
    config.provider === "deepseek"
      ? env("DEEPSEEK_MODEL") || "deepseek-chat"
      : config.model;

  const system = `你是严格的回答审校员。检查 AI 助手的草稿回复是否：
1. 准确回答了用户问题
2. 没有编造事实、链接、工具执行结果
3. 在 agent 模式下，该调用工具时是否已输出 agent JSON（不要误判合理的纯聊天）

只输出 JSON（无 markdown）：
{"ok":true}  — 草稿可直接使用
或 {"ok":false,"issues":"问题简述","revised":"修订后的完整回复"}`;

  let raw = "";
  try {
    const completion = await client.chat.completions.create({
      model: verifyModel,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `用户：${input.userMessage.slice(0, 4000)}\n\n助手草稿：\n${input.reply.slice(0, 6000)}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 2048,
    });
    raw = completion.choices?.[0]?.message?.content?.trim() || "";
  } catch {
    return { reply: input.reply, verification: null };
  }

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { reply: input.reply, verification: null };
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.ok === true) {
      return { reply: input.reply, verification: null };
    }
    if (parsed.revised?.trim()) {
      return {
        reply: String(parsed.revised).trim(),
        verification: null,
      };
    }
    return { reply: input.reply, verification: null };
  } catch {
    return { reply: input.reply, verification: null };
  }
}
