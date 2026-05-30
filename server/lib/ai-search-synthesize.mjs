import OpenAI from "openai";
import { HttpError } from "./http-error.mjs";
import { resolveChatConfig } from "./chat-config.mjs";
import { env } from "./env.mjs";

/**
 * @param {string} query
 * @param {{ answer?: string, results: Array<{ title: string, url: string, snippet: string }> }} searchPayload
 */
export async function synthesizeSearchAnswer(query, searchPayload) {
  const chatConfig = resolveChatConfig();
  if (!chatConfig) {
    throw new HttpError(
      503,
      "未配置 DEEPSEEK_API_KEY，无法生成 AI 摘要。请配置后重启，或仅查看原始搜索结果",
    );
  }

  const sources = (searchPayload.results || [])
    .slice(0, 8)
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`)
    .join("\n\n");

  const tavilyHint = searchPayload.answer
    ? `\n搜索引擎初步摘要（仅供参考，请核实并改写）：\n${searchPayload.answer}\n`
    : "";

  const system = `你是春雨集的 AI 全网搜索助手。根据用户问题与检索到的网页摘要，给出准确、有条理的中文回答。

要求：
1. 优先依据「检索来源」中的信息，不要编造无法验证的事实
2. 在正文中用 [1]、[2] 标注引用（对应来源编号）
3. 若信息不足或来源矛盾，明确说明不确定之处
4. 回答简洁实用，可用小标题与列表
5. 末尾单独一行「参考来源」列出用到的编号与标题`;

  const user = `用户问题：${query}
${tavilyHint}
检索来源：
${sources || "（无有效来源）"}`;

  const timeoutMs = Number(env("AI_SEARCH_TIMEOUT_MS", "90000")) || 90000;
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
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.35,
      max_tokens: 2048,
    });

    const text = completion.choices?.[0]?.message?.content?.trim();
    if (!text) throw new HttpError(502, "AI 未返回有效摘要");
    return text;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    const msg = e?.message || String(e);
    if (/401|invalid.*key/i.test(msg)) {
      throw new HttpError(503, "AI API Key 无效，请检查 DEEPSEEK_API_KEY");
    }
    throw new HttpError(502, `AI 摘要生成失败：${msg.slice(0, 200)}`);
  }
}
