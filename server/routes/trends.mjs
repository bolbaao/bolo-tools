import { Router } from "express";
import { fetchTrends } from "../lib/trends-fetch.mjs";
import { sendError } from "../lib/http-error.mjs";

const router = Router();

router.get("/:platform", async (req, res) => {
  try {
    const platform = req.params.platform;
    const { list, source, updatedAt, notice } = await fetchTrends(platform);
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
