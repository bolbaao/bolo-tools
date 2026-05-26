import { Router } from "express";
import { env } from "../lib/env.mjs";
import { HttpError, sendError } from "../lib/http-error.mjs";

const router = Router();

router.post("/generate", async (req, res) => {
  try {
    const token = env("REPLICATE_API_TOKEN");
    if (!token) {
      throw new HttpError(
        503,
        "未配置 REPLICATE_API_TOKEN。AI 生视频需接入 Replicate 等云服务，请在 .env 中配置后重试。",
      );
    }

    const { prompt, style, duration } = req.body ?? {};
    if (!prompt?.trim()) throw new HttpError(400, "请填写创意描述");

    const fullPrompt = `${prompt.trim()}。画面风格：${style || "电影感"}。时长约 ${duration || 15} 秒。`;

    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=60",
      },
      body: JSON.stringify({
        version: env(
          "REPLICATE_VIDEO_VERSION",
          "minimax/video-01-live",
        ),
        input: { prompt: fullPrompt },
      }),
    });

    const data = await createRes.json();
    if (!createRes.ok) {
      throw new HttpError(
        createRes.status,
        data.detail || data.error || "Replicate 请求失败",
      );
    }

    const output = data.output;
    const videoUrl = Array.isArray(output) ? output[0] : output;

    res.json({
      ok: true,
      status: data.status,
      videoUrl: typeof videoUrl === "string" ? videoUrl : null,
      predictionId: data.id,
      message:
        data.status === "succeeded"
          ? "视频已生成"
          : "任务已提交，请稍后通过 predictionId 查询状态",
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
