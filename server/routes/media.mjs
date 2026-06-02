import { Router } from "express";
import { HttpError, sendError } from "../lib/http-error.mjs";
import { HOT_FALLBACK } from "../lib/media-aggregate.mjs";
import {
  assertSearchAllowed,
  buildCopyText,
  searchMediaResources,
} from "../lib/media-resource-fetch.mjs";

const router = Router();

router.get("/hot", async (_req, res) => {
  res.json({ ok: true, keywords: HOT_FALLBACK });
});

/** 多路并行检索网盘资源（主/扩展/更多资源库）— 影视资源下载 */
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
