import { Router } from "express";
import { aiMusicCapabilities, generateAiMusic } from "../lib/ai-music.mjs";
import { HttpError, sendError } from "../lib/http-error.mjs";

const router = Router();

router.get("/capabilities", (_req, res) => {
  res.json({ ok: true, ...aiMusicCapabilities() });
});

router.post("/generate", async (req, res) => {
  try {
    const { prompt, style, title, instrumental, mode } = req.body ?? {};
    const tracks = await generateAiMusic({
      prompt,
      style,
      title,
      instrumental: Boolean(instrumental),
      mode: mode === "lyrics" ? "lyrics" : "inspiration",
    });

    res.json({
      ok: true,
      tracks,
      message: `已生成 ${tracks.length} 首曲目`,
    });
  } catch (err) {
    if (err.message === "SUNO_KEYS_MISSING") {
      sendError(res, new HttpError(503, "未配置 SUNO_API_KEY"));
      return;
    }
    const msg = err?.message || String(err);
    if (/401|invalid.*key|authentication/i.test(msg)) {
      sendError(res, new HttpError(401, "Suno API Key 无效或已过期"));
      return;
    }
    sendError(res, err);
  }
});

export default router;
