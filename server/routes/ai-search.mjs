import { Router } from "express";
import { resolveSearchModeConfig } from "../lib/ai-search-modes.mjs";
import { synthesizeSearchAnswer } from "../lib/ai-search-synthesize.mjs";
import { HttpError, sendError } from "../lib/http-error.mjs";
import { fetchDouyinTrends } from "../lib/trends-fetch.mjs";
import { getWebSearchCapabilities } from "../lib/web-search.mjs";
import { searchWebWithUnderstanding } from "../lib/web-search-understand.mjs";
import { parseMediaPlatforms } from "../lib/media-search.mjs";
import { resolveChatConfig } from "../lib/chat-config.mjs";
import { formatSearchNotFound } from "../../shared/public-error.mjs";

const router = Router();

router.get("/capabilities", (_req, res) => {
  const search = getWebSearchCapabilities();
  res.json({
    ok: true,
    ...search,
    aiSynthesis: Boolean(resolveChatConfig()),
    mediaPlatforms: ["douyin", "xiaohongshu", "wechat"],
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
    const modeConfig = resolveSearchModeConfig(req.body?.mode, query);
    const depth = req.body?.depth === "basic" ? "basic" : modeConfig.depth;
    const topic = req.body?.topic === "news" ? "news" : modeConfig.topic;
    const synthesize =
      req.body?.synthesize !== false &&
      req.body?.synthesize !== "false" &&
      req.body?.synthesize !== 0 &&
      modeConfig.synthesize;
    const forceChinese =
      req.body?.forceChinese === true ||
      req.body?.forceChinese === "true" ||
      req.body?.forceChinese === 1 ||
      modeConfig.forceChinese;
    const mediaPlatforms = parseMediaPlatforms(req.body?.mediaPlatforms);

    const searchPayload = await searchWebWithUnderstanding(query, {
      depth,
      topic,
      mode: modeConfig.mode,
      days: modeConfig.days,
      forceChinese,
      mediaPlatforms,
    });

    let summary = searchPayload.answer || null;
    let synthesized = false;

    if (synthesize && resolveChatConfig()) {
      try {
        summary = await synthesizeSearchAnswer(query, searchPayload, {
          topic: searchPayload.topic || topic,
          mode: modeConfig.mode,
        });
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
      searchQuery: searchPayload.searchQuery,
      understanding: searchPayload.understanding || null,
      mode: searchPayload.mode || modeConfig.mode,
      modeLabel: searchPayload.modeLabel || modeConfig.label,
      provider: searchPayload.provider,
      summary,
      synthesized,
      results: searchPayload.results,
      mediaPlatforms: searchPayload.platforms || (modeConfig.media ? mediaPlatforms : undefined),
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
