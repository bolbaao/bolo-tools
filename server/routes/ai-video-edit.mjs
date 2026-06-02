import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import { HttpError, sendError } from "../lib/http-error.mjs";
import { resolveChatConfig } from "../lib/chat-config.mjs";
import {
  MAX_VIDEO_EDIT_MB,
  MAX_VIDEO_EDIT_SEC,
  generateEditPlan,
  normalizeEditPlan,
  probeVideo,
  renderEditedVideo,
  safeOutputName,
} from "../lib/ai-video-edit.mjs";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_EDIT_MB * 1024 * 1024 },
});

function withTmpDir(fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pineapple-aivid-"));
  try {
    return fn(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function saveUpload(file, tmpDir) {
  if (!file) throw new HttpError(400, "请上传视频文件");
  const ext = path.extname(file.originalname) || ".mp4";
  const inputPath = path.join(tmpDir, `input${ext}`);
  fs.writeFileSync(inputPath, file.buffer);
  return inputPath;
}

router.get("/capabilities", (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(resolveChatConfig()),
    maxDurationSec: MAX_VIDEO_EDIT_SEC,
    maxFileMb: MAX_VIDEO_EDIT_MB,
    hints: [
      "去掉前 5 秒，保留后面内容",
      "裁成 9:16 竖屏并加速 1.25 倍",
      "最后 2 秒淡出，音量降到 50%",
      "静音并导出 720p",
    ],
  });
});

router.post("/plan", upload.single("file"), async (req, res) => {
  try {
    const instruction = req.body?.instruction ?? req.body?.prompt;
    const result = await withTmpDir(async (tmpDir) => {
      const inputPath = await saveUpload(req.file, tmpDir);
      const meta = await probeVideo(inputPath);
      const plan = await generateEditPlan({ instruction, meta });
      return { meta, plan };
    });

    res.json({
      ok: true,
      summary: result.plan.summary,
      operations: result.plan.operations,
      provider: result.plan.provider,
      meta: {
        duration: result.meta.duration,
        width: result.meta.width,
        height: result.meta.height,
        hasAudio: result.meta.hasAudio,
      },
      message: "剪辑方案已生成",
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/render", upload.single("file"), async (req, res) => {
  try {
    let planRaw = req.body?.plan;
    if (typeof planRaw === "string") {
      try {
        planRaw = JSON.parse(planRaw);
      } catch {
        throw new HttpError(400, "剪辑方案 JSON 无效");
      }
    }
    if (!planRaw?.operations) throw new HttpError(400, "请先获取剪辑方案");

    await withTmpDir(async (tmpDir) => {
      const inputPath = await saveUpload(req.file, tmpDir);
      const meta = await probeVideo(inputPath);
      if (meta.duration > MAX_VIDEO_EDIT_SEC) {
        throw new HttpError(400, `视频时长超过 ${MAX_VIDEO_EDIT_SEC} 秒上限`);
      }

      const plan = normalizeEditPlan(planRaw, meta);
      const outputPath = path.join(tmpDir, "output.mp4");
      await renderEditedVideo({ inputPath, outputPath, plan, meta });

      const outBuf = fs.readFileSync(outputPath);
      const filename = safeOutputName(req.file.originalname);
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.setHeader("X-Edit-Summary", encodeURIComponent(plan.summary));
      res.send(outBuf);
    });
  } catch (err) {
    sendError(res, err);
  }
});

/** 一步完成：生成方案并渲染（适合简单流程） */
router.post("/edit", upload.single("file"), async (req, res) => {
  try {
    const instruction = req.body?.instruction ?? req.body?.prompt;
    await withTmpDir(async (tmpDir) => {
      const inputPath = await saveUpload(req.file, tmpDir);
      const meta = await probeVideo(inputPath);
      const plan = await generateEditPlan({ instruction, meta });
      const outputPath = path.join(tmpDir, "output.mp4");
      await renderEditedVideo({ inputPath, outputPath, plan, meta });

      const outBuf = fs.readFileSync(outputPath);
      const filename = safeOutputName(req.file.originalname);
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.setHeader("X-Edit-Summary", encodeURIComponent(plan.summary));
      res.send(outBuf);
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
