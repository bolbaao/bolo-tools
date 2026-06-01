import { Router } from "express";
import { arkImageConfigured, generateArkImage } from "../lib/ark-image.mjs";
import { HttpError, sendError } from "../lib/http-error.mjs";

const router = Router();

router.post("/generate", async (req, res) => {
  try {
    if (!arkImageConfigured()) {
      throw new HttpError(503, "未配置 ARK_API_KEY。请在 .env 中填入火山方舟 API Key。");
    }

    const { prompt, style, aspectRatio, resolution } = req.body ?? {};
    if (!prompt?.trim()) throw new HttpError(400, "请填写画面描述");

    const result = await generateArkImage({
      prompt: prompt.trim(),
      style: style?.trim(),
      aspectRatio: aspectRatio || "1:1",
      resolution: resolution || "1k",
    });

    if (result.imageBase64) {
      res.json({
        ok: true,
        imageBase64: result.imageBase64,
        mimeType: result.mimeType || "image/png",
        message: "图片已生成",
      });
      return;
    }

    res.json({
      ok: true,
      imageUrl: result.imageUrl,
      message: "图片已生成",
    });
  } catch (err) {
    if (err.message === "ARK_KEYS_MISSING") {
      sendError(res, new HttpError(503, "未配置 ARK_API_KEY"));
      return;
    }
    const msg = err?.message || String(err);
    if (/401|invalid.*key|authentication/i.test(msg)) {
      sendError(res, new HttpError(401, "火山方舟 API Key 无效或已过期"));
      return;
    }
    if (/429|rate limit/i.test(msg)) {
      sendError(res, new HttpError(429, "火山方舟请求过于频繁，请稍后再试"));
      return;
    }
    sendError(res, err);
  }
});

export default router;
