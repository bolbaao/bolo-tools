import { Router } from "express";
import { synthesizeSearchAnswer } from "../lib/ai-search-synthesize.mjs";
import { HttpError, sendError } from "../lib/http-error.mjs";
import { fetchDouyinTrends } from "../lib/trends-fetch.mjs";
import { getWebSearchCapabilities, searchWeb } from "../lib/web-search.mjs";
import { resolveChatConfig } from "../lib/chat-config.mjs";
import { formatSearchNotFound } from "../../shared/public-error.mjs";

const router = Router();

router.get("/capabilities", (_req, res) => {
  const search = getWebSearchCapabilities();
  res.json({
    ok: true,
    ...search,
    aiSynthesis: Boolean(resolveChatConfig()),
  });
});

/** 当下时事热点（抖音热搜，供搜索页快捷入口） */
router.get("/hot-topics", async (_req, res) => {
  try {
    const { list, updatedAt, source } = await fetchDouyinTrends();
    const topics = (list || []).slice(0, 8).map((item) => ({
      title: item.title,
      heat: item.heat,
      tag: item.tag,
      searchQuery: `${item.title} 最新动态 时事热点`,
    }));
    res.json({
      ok: true,
      topics,
      updatedAt,
      source,
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/search", async (req, res) => {
  try {
    const query = String(req.body?.query || "").trim();
    const depth = req.body?.depth === "basic" ? "basic" : "advanced";
    const topic = req.body?.topic === "news" ? "news" : "general";
    const synthesize =
      req.body?.synthesize !== false &&
      req.body?.synthesize !== "false" &&
      req.body?.synthesize !== 0;

    const searchPayload = await searchWeb(query, {
      depth,
      topic,
      days: topic === "news" ? 3 : undefined,
    });

    let summary = searchPayload.answer || null;
    let synthesized = false;

    if (synthesize && resolveChatConfig()) {
      try {
        summary = await synthesizeSearchAnswer(query, searchPayload, { topic });
        synthesized = true;
      } catch (e) {
        if (!searchPayload.answer && (!searchPayload.results?.length)) throw e;
        summary =
          searchPayload.answer ||
          (e instanceof HttpError ? e.message : "AI 摘要失败，请查看下方来源链接");
      }
    }

    if (!summary && !searchPayload.results?.length) {
      throw new HttpError(422, formatSearchNotFound(query));
    }

    res.json({
      ok: true,
      query: searchPayload.query,
      provider: searchPayload.provider,
      summary,
      synthesized,
      results: searchPayload.results,
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
