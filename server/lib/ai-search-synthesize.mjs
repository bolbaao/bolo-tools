import OpenAI from "openai";
import { HttpError } from "./http-error.mjs";
import { resolveChatConfig } from "./chat-config.mjs";
import { env } from "./env.mjs";
import { getSearchTimeContext } from "./search-time-context.mjs";
import { getModeSynthesisHint } from "./ai-search-modes.mjs";

/**
 * @param {string} query
 * @param {{ answer?: string, results: Array<{ title: string, url: string, snippet: string }> }} searchPayload
 * @param {{ topic?: 'general'|'news', mode?: string }} opts
 */
export async function synthesizeSearchAnswer(query, searchPayload, opts = {}) {
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

  const time = searchPayload.timeContext || getSearchTimeContext();
  const effectiveTopic = searchPayload.topic || opts.topic;
  const recencyIntent = Boolean(searchPayload.recencyIntent);

  const region = searchPayload.region;
  const regionLabel = region?.label || "中国";
  const staleYear = time.year - 1;

  const newsHint =
    effectiveTopic === "news" || recencyIntent
      ? `6. 用户关注近期/当下信息。今天是 ${time.dateLabel}，今年是 ${time.year} 年。只把 ${time.year} 年信息当作「最近/很火」的答案；${staleYear} 年及更早内容只能作为背景补充，且必须标注年份，禁止把 ${staleYear} 年热播剧说成用户问的「最近很火」
7. 若来源不足以确认 ${time.year} 年近期答案，直接说明「暂未检索到 ${time.year} 年明确热播的同类作品」，不要硬答 ${staleYear} 年片单`
      : "";

  const regionHint = region?.userSpecified
    ? `8. 用户指定关注「${regionLabel}」地区信息，优先采用该地区来源`
    : `8. 默认以中国国内信息为主，优先中文来源与国内平台（豆瓣、微博、知乎、B站等）`;

  const modeHint = getModeSynthesisHint(searchPayload.mode || opts.mode);

  const liveInfoHint = opts.liveInfo
    ? `9. 这是主页实时问答：只回答问题本身，禁止在末尾添加「更新于…」「基于实时检索」「未参考历史对话」等元信息脚注
10. 禁止主动追问用户是否需要下载链接、观看链接、播放地址或网盘资源，除非用户原话明确在索要
11. 正文不要出现 [1]、[2] 等引用编号，不要输出「参考来源」段落或来源链接列表`
    : "";

  const listQueryHint =
    opts.liveInfo && /(?:有哪些|什么剧|哪些剧|片单|榜单|排行|列表)/.test(query)
      ? `12. 用户在要列表/片单：直接列作品名与一句简介即可，结尾不要加引导性问句`
      : "";

  const citationRules = opts.liveInfo
    ? `2. 依据检索来源组织答案，但正文不要标注 [1]、[2] 等引用编号
5. 不要输出「参考来源」或来源标题列表`
    : `2. 在正文中用 [1]、[2] 标注引用（对应来源编号）
5. 末尾单独一行「参考来源」列出用到的编号与标题`;

  const system = `你是春雨集的 AI 全网搜索助手。根据用户问题与检索到的网页摘要，给出准确、有条理的中文回答。
当前日期：${time.dateLabel}（今年是 ${time.year} 年，回答时效性问题必须以此时刻为准）。

要求：
1. 优先依据「检索来源」中的信息，不要编造无法验证的事实
${citationRules}
3. 若信息不足或来源矛盾，明确说明不确定之处
4. 回答简洁实用，可用小标题与列表
${newsHint}
${regionHint}
${modeHint}
${liveInfoHint}
${listQueryHint}`;

  const planHint = searchPayload.understanding
    ? `\n检索意图理解（系统已据此扩散检索，勿复述给用户）：\n${searchPayload.understanding}\n`
    : "";
  const queryHint =
    searchPayload.searchQuery && searchPayload.searchQuery !== query
      ? `\n实际检索词：${searchPayload.searchQuery}${
          searchPayload.searchVariants?.length
            ? `；扩散：${searchPayload.searchVariants.slice(0, 4).join("、")}`
            : ""
        }\n`
      : "";

  const user = `用户问题：${query}
${planHint}${queryHint}${tavilyHint}
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
