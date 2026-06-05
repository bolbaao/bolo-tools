import { Router } from "express";
import { fetchTrends } from "../lib/trends-fetch.mjs";
import { sendError } from "../lib/http-error.mjs";

const router = Router();

router.get("/:platform", async (req, res) => {
  try {
    const platform = req.params.platform;
    const force = req.query.refresh === "1" || req.query.force === "1";
    const { list, source, updatedAt, notice } = await fetchTrends(platform, { force });
    res.json({
      ok: true,
      list,
      source,
      updatedAt,
      notice,
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
