import { Router } from "express";
import { synthesizeSearchAnswer } from "../lib/ai-search-synthesize.mjs";
import { HttpError, sendError } from "../lib/http-error.mjs";
import { getWebSearchCapabilities, searchWeb } from "../lib/web-search.mjs";
import { resolveChatConfig } from "../lib/chat-config.mjs";

const router = Router();

router.get("/capabilities", (_req, res) => {
  const search = getWebSearchCapabilities();
  res.json({
    ok: true,
    ...search,
    aiSynthesis: Boolean(resolveChatConfig()),
  });
});

router.post("/search", async (req, res) => {
  try {
    const query = String(req.body?.query || "").trim();
    const depth = req.body?.depth === "basic" ? "basic" : "advanced";
    const synthesize =
      req.body?.synthesize !== false &&
      req.body?.synthesize !== "false" &&
      req.body?.synthesize !== 0;

    const searchPayload = await searchWeb(query, { depth });

    let summary = searchPayload.answer || null;
    let synthesized = false;

    if (synthesize && resolveChatConfig()) {
      try {
        summary = await synthesizeSearchAnswer(query, searchPayload);
        synthesized = true;
      } catch (e) {
        if (!searchPayload.answer && (!searchPayload.results?.length)) throw e;
        summary =
          searchPayload.answer ||
          (e instanceof HttpError ? e.message : "AI 摘要失败，请查看下方来源链接");
      }
    }

    if (!summary && !searchPayload.results?.length) {
      throw new HttpError(422, "未找到相关结果，请换个关键词试试");
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
