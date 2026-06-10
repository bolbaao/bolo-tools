import { Router } from "express";
import {
  arkImageConfigured,
  beautifyArkImage,
  editArkImage,
  eraseArkImage,
  generateArkImage,
  removeWatermarkArkImage,
  replaceBackgroundArkImage,
} from "../lib/ark-image.mjs";
import { extractTextFromImageDataUrl, photoVisionConfigured } from "../lib/photo-vision.mjs";
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

router.post("/edit", async (req, res) => {
  try {
    if (!arkImageConfigured()) {
      throw new HttpError(503, "未配置 ARK_API_KEY。请在 .env 中填入火山方舟 API Key。");
    }

    const { prompt, imageDataUrl, resolution } = req.body ?? {};
    if (!prompt?.trim()) throw new HttpError(400, "请填写修图指令");
    if (!imageDataUrl?.trim()) throw new HttpError(400, "请上传参考图片");

    const result = await editArkImage({
      prompt: prompt.trim(),
      imageDataUrl: imageDataUrl.trim(),
      resolution: resolution || "2k",
    });

    if (result.imageBase64) {
      res.json({
        ok: true,
        imageBase64: result.imageBase64,
        mimeType: result.mimeType || "image/png",
        message: "修图完成",
      });
      return;
    }

    res.json({
      ok: true,
      imageUrl: result.imageUrl,
      message: "修图完成",
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

router.post("/beautify", async (req, res) => {
  try {
    if (!arkImageConfigured()) {
      throw new HttpError(503, "未配置 ARK_API_KEY。请在 .env 中填入火山方舟 API Key。");
    }

    const { imageDataUrl, level, resolution } = req.body ?? {};
    if (!imageDataUrl?.trim()) throw new HttpError(400, "请上传人像照片");

    const validLevels = ["natural", "standard", "pro"];
    const beautyLevel = validLevels.includes(level) ? level : "standard";

    const result = await beautifyArkImage({
      imageDataUrl: imageDataUrl.trim(),
      level: beautyLevel,
      resolution: resolution || "2k",
    });

    if (result.imageBase64) {
      res.json({
        ok: true,
        imageBase64: result.imageBase64,
        mimeType: result.mimeType || "image/png",
        message: "人像美化完成",
      });
      return;
    }

    res.json({
      ok: true,
      imageUrl: result.imageUrl,
      message: "人像美化完成",
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

router.post("/watermark-remove", async (req, res) => {
  try {
    if (!arkImageConfigured()) {
      throw new HttpError(503, "未配置 ARK_API_KEY。请在 .env 中填入火山方舟 API Key。");
    }

    const { imageDataUrl, level, resolution } = req.body ?? {};
    if (!imageDataUrl?.trim()) throw new HttpError(400, "请上传图片");

    const validLevels = ["light", "standard", "strong"];
    const wmLevel = validLevels.includes(level) ? level : "standard";

    const result = await removeWatermarkArkImage({
      imageDataUrl: imageDataUrl.trim(),
      level: wmLevel,
      resolution: resolution || "2k",
    });

    if (result.imageBase64) {
      res.json({
        ok: true,
        imageBase64: result.imageBase64,
        mimeType: result.mimeType || "image/png",
        message: "水印已去除",
      });
      return;
    }

    res.json({
      ok: true,
      imageUrl: result.imageUrl,
      message: "水印已去除",
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

router.post("/replace-background", async (req, res) => {
  try {
    if (!arkImageConfigured()) {
      throw new HttpError(503, "未配置 ARK_API_KEY。请在 .env 中填入火山方舟 API Key。");
    }

    const { imageDataUrl, backgroundPrompt, resolution } = req.body ?? {};
    if (!imageDataUrl?.trim()) throw new HttpError(400, "请上传图片");
    if (!backgroundPrompt?.trim()) throw new HttpError(400, "请描述目标背景");

    const result = await replaceBackgroundArkImage({
      imageDataUrl: imageDataUrl.trim(),
      backgroundPrompt: backgroundPrompt.trim(),
      resolution: resolution || "2k",
    });

    if (result.imageBase64) {
      res.json({
        ok: true,
        imageBase64: result.imageBase64,
        mimeType: result.mimeType || "image/png",
        message: "背景已替换",
      });
      return;
    }

    res.json({
      ok: true,
      imageUrl: result.imageUrl,
      message: "背景已替换",
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

router.post("/erase", async (req, res) => {
  try {
    if (!arkImageConfigured()) {
      throw new HttpError(503, "未配置 ARK_API_KEY。请在 .env 中填入火山方舟 API Key。");
    }

    const { imageDataUrl, level, hint, resolution } = req.body ?? {};
    if (!imageDataUrl?.trim()) throw new HttpError(400, "请上传图片");

    const validLevels = ["light", "standard", "strong"];
    const eraseLevel = validLevels.includes(level) ? level : "standard";

    const result = await eraseArkImage({
      imageDataUrl: imageDataUrl.trim(),
      level: eraseLevel,
      hint: hint?.trim(),
      resolution: resolution || "2k",
    });

    if (result.imageBase64) {
      res.json({
        ok: true,
        imageBase64: result.imageBase64,
        mimeType: result.mimeType || "image/png",
        message: "智能消除完成",
      });
      return;
    }

    res.json({
      ok: true,
      imageUrl: result.imageUrl,
      message: "智能消除完成",
    });
  } catch (err) {
    if (err.message === "ARK_KEYS_MISSING") {
      sendError(res, new HttpError(503, "未配置 ARK_API_KEY"));
      return;
    }
    sendError(res, err);
  }
});

router.post("/ocr", async (req, res) => {
  try {
    if (!photoVisionConfigured()) {
      throw new HttpError(
        503,
        "未配置 ARK_VISION_API_KEY 或 ARK_API_KEY。请在 .env 中填入火山方舟视觉模型 Key。",
      );
    }

    const { imageDataUrl } = req.body ?? {};
    if (!imageDataUrl?.trim()) throw new HttpError(400, "请上传图片");

    const result = await extractTextFromImageDataUrl(imageDataUrl.trim());
    if (!result?.text) throw new HttpError(422, "未能识别出文字");

    res.json({
      ok: true,
      text: result.text,
      provider: result.providerLabel,
      message: "文字提取完成",
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
