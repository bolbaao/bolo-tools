import { Router } from "express";
import { generateStoryboard, storyboardCapabilities } from "../lib/storyboard.mjs";
import {
  deleteStoryboardProject,
  getStoryboardProject,
  getStoryboardProjectImagePath,
  listStoryboardProjects,
  saveStoryboardProject,
} from "../lib/storyboard-projects.mjs";
import { HttpError, sendError } from "../lib/http-error.mjs";
import { requireUserAuth, requireVerifiedEmail } from "../lib/user-auth.mjs";

const router = Router();

router.get("/capabilities", (_req, res) => {
  res.json({
    ok: true,
    ...storyboardCapabilities(),
  });
});

router.get("/projects", requireUserAuth, requireVerifiedEmail, (req, res) => {
  try {
    const items = listStoryboardProjects(req.user.id);
    res.json({ ok: true, items });
  } catch (err) {
    sendError(res, err);
  }
});

router.get("/projects/:id", requireUserAuth, requireVerifiedEmail, (req, res) => {
  try {
    const project = getStoryboardProject(req.user.id, req.params.id);
    res.json({ ok: true, project });
  } catch (err) {
    sendError(res, err);
  }
});

router.get("/projects/:id/images/:filename", requireUserAuth, requireVerifiedEmail, (req, res) => {
  try {
    const filePath = getStoryboardProjectImagePath(
      req.user.id,
      req.params.id,
      req.params.filename,
    );
    res.sendFile(filePath);
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/projects", requireUserAuth, requireVerifiedEmail, (req, res) => {
  try {
    const project = saveStoryboardProject(req.user.id, req.body ?? {});
    res.json({ ok: true, project });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

router.delete("/projects/:id", requireUserAuth, requireVerifiedEmail, (req, res) => {
  try {
    deleteStoryboardProject(req.user.id, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

router.post("/generate", async (req, res) => {
  try {
    const caps = storyboardCapabilities();
    if (!caps.ready) {
      if (!caps.aiConfigured) {
        throw new HttpError(503, "未配置 DEEPSEEK_API_KEY 或 ARK_API_KEY，无法规划分镜");
      }
      throw new HttpError(503, "未配置 ARK_API_KEY，无法生成图片");
    }

    const { topic, script, sceneCount, aspectRatio, style, resolution } = req.body ?? {};
    const result = await generateStoryboard({
      topic,
      script,
      sceneCount,
      aspectRatio,
      style,
      resolution,
    });

    res.json({
      ok: true,
      ...result,
      message: `已生成 ${result.scenes.length} 个分镜画面`,
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
