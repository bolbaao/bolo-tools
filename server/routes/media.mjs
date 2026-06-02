import { Router } from "express";
import { HttpError, sendError } from "../lib/http-error.mjs";
import { HOT_FALLBACK, searchMedia } from "../lib/media-aggregate.mjs";
import {
  assertSearchAllowed,
  buildCopyText,
  searchMediaResources,
} from "../lib/media-resource-fetch.mjs";

const router = Router();

router.get("/aggregate-search", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();
    if (!query) throw new HttpError(400, "请输入搜索关键词");

    const results = await searchMedia(query);
    res.json({ ok: true, query, results, total: results.length });
  } catch (err) {
    sendError(res, err);
  }
});

router.get("/hot", async (_req, res) => {
  res.json({ ok: true, keywords: HOT_FALLBACK });
});

/** 多源并行检索网盘资源（参考公开检索聚合接口） */
router.get("/resource-search", async (req, res) => {
  try {
    const check = assertSearchAllowed(req.query.q);
    if (!check.ok) throw new HttpError(400, check.error);

    const result = await searchMediaResources(check.query);
    res.json({
      ok: true,
      query: result.query,
      sections: result.sections,
      stats: result.stats,
      copyText: buildCopyText(result),
      errors: result.errors,
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
