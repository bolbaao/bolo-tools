import { Router } from "express";
import { HttpError, sendError } from "../lib/http-error.mjs";
import { HOT_FALLBACK } from "../lib/media-aggregate.mjs";
import { getMediaNav } from "../lib/media-nav.mjs";
import {
  assertSearchAllowed,
  buildCopyText,
  searchMediaResources,
} from "../lib/media-resource-fetch.mjs";

const router = Router();

/** 影视搜索导航（参考超级文档群公告模式） */
router.get("/nav", async (_req, res) => {
  res.json({ ok: true, ...getMediaNav() });
});

router.get("/hot", async (_req, res) => {
  res.json({ ok: true, keywords: HOT_FALLBACK });
});

/** 多厅并行检索网盘资源（2厅、3厅、3&4厅、5厅）— 影视资源下载 */
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
