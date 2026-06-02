import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import { HttpError, sendError } from "../lib/http-error.mjs";
import { resolveChatConfig } from "../lib/chat-config.mjs";
import {
  MAX_VIDEO_EDIT_COUNT,
  MAX_VIDEO_EDIT_MB,
  MAX_VIDEO_EDIT_SEC,
  generateEditPlan,
  normalizeEditPlan,
  prepareVideoInput,
  renderEditedVideo,
  safeOutputName,
} from "../lib/ai-video-edit.mjs";
import {
  generateVoiceoverPlan,
  getVoiceoverStatus,
  normalizeScript,
  normalizeVoiceoverPlan,
  probeClipLibrary,
  renderVoiceoverVideo,
} from "../lib/ai-voiceover.mjs";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_EDIT_MB * 1024 * 1024 },
});

async function withTmpDir(fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pineapple-aivid-"));
  try {
    return await fn(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/** @param {import("express").Request} req */
function getUploadedFiles(req) {
  const list = [];
  if (req.files) {
    if (Array.isArray(req.files)) {
      list.push(...req.files);
    } else {
      for (const key of ["files", "file"]) {
        if (Array.isArray(req.files[key])) list.push(...req.files[key]);
      }
    }
  }
  if (req.file) list.push(req.file);
  return list;
}

async function saveUploads(files, tmpDir) {
  if (!files.length) throw new HttpError(400, "请上传视频文件");
  if (files.length > MAX_VIDEO_EDIT_COUNT) {
    throw new HttpError(400, `最多上传 ${MAX_VIDEO_EDIT_COUNT} 个视频`);
  }
  const paths = [];
  for (let i = 0; i < files.length; i++) {
    const ext = path.extname(files[i].originalname) || ".mp4";
    const inputPath = path.join(tmpDir, `input-${i}${ext}`);
    fs.writeFileSync(inputPath, files[i].buffer);
    paths.push(inputPath);
  }
  return paths;
}

function clipSummaries(clips) {
  return clips.map((c) => ({
    index: c.index,
    name: c.name,
    duration: c.duration,
    width: c.width,
    height: c.height,
    hasAudio: c.hasAudio,
  }));
}

const uploadFields = upload.fields([
  { name: "files", maxCount: MAX_VIDEO_EDIT_COUNT },
  { name: "file", maxCount: 1 },
  { name: "scriptFile", maxCount: 1 },
]);

function getScriptFromRequest(req) {
  const raw = req.body?.script ?? req.body?.scriptText ?? "";
  if (String(raw).trim()) return normalizeScript(raw);
  const scriptFiles = req.files?.scriptFile;
  const f = Array.isArray(scriptFiles) ? scriptFiles[0] : null;
  if (f?.buffer) return normalizeScript(f.buffer.toString("utf8"));
  return null;
}

router.get("/capabilities", (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(resolveChatConfig()),
    maxDurationSec: MAX_VIDEO_EDIT_SEC,
    maxFileMb: MAX_VIDEO_EDIT_MB,
    maxVideoCount: MAX_VIDEO_EDIT_COUNT,
    voiceover: getVoiceoverStatus(),
    hints: [
      "去掉前 5 秒，保留后面内容",
      "裁成 9:16 竖屏并加速 1.25 倍",
      "最后 2 秒淡出，音量降到 50%",
      "静音并导出 720p",
      "多段视频按上传顺序自动拼接后再剪辑",
    ],
    voiceoverHints: [
      "产品介绍口播，匹配产品特写与使用画面",
      "知识科普，按段落匹配 B-roll 素材",
      "竖屏 9:16 短视频口播",
    ],
  });
});

router.post("/plan", uploadFields, async (req, res) => {
  try {
    const instruction = req.body?.instruction ?? req.body?.prompt;
    const uploads = getUploadedFiles(req);
    const result = await withTmpDir(async (tmpDir) => {
      const inputPaths = await saveUploads(uploads, tmpDir);
      const prepared = await prepareVideoInput(inputPaths, tmpDir, uploads);
      const plan = await generateEditPlan({
        instruction,
        meta: prepared.meta,
        clips: prepared.clips,
      });
      return { prepared, plan };
    });

    res.json({
      ok: true,
      summary: result.plan.summary,
      operations: result.plan.operations,
      provider: result.plan.provider,
      clipCount: result.prepared.clips.length,
      clips: clipSummaries(result.prepared.clips),
      meta: {
        duration: result.prepared.meta.duration,
        width: result.prepared.meta.width,
        height: result.prepared.meta.height,
        hasAudio: result.prepared.meta.hasAudio,
      },
      message: "剪辑方案已生成",
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/render", uploadFields, async (req, res) => {
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

    const uploads = getUploadedFiles(req);
    await withTmpDir(async (tmpDir) => {
      const inputPaths = await saveUploads(uploads, tmpDir);
      const prepared = await prepareVideoInput(inputPaths, tmpDir, uploads);
      const plan = normalizeEditPlan(planRaw, prepared.meta);
      const outputPath = path.join(tmpDir, "output.mp4");
      await renderEditedVideo({
        inputPath: prepared.inputPath,
        outputPath,
        plan,
        meta: prepared.meta,
      });

      const outBuf = fs.readFileSync(outputPath);
      const filename = safeOutputName(uploads[0]?.originalname, uploads.length);
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
router.post("/edit", uploadFields, async (req, res) => {
  try {
    const instruction = req.body?.instruction ?? req.body?.prompt;
    const uploads = getUploadedFiles(req);
    await withTmpDir(async (tmpDir) => {
      const inputPaths = await saveUploads(uploads, tmpDir);
      const prepared = await prepareVideoInput(inputPaths, tmpDir, uploads);
      const plan = await generateEditPlan({
        instruction,
        meta: prepared.meta,
        clips: prepared.clips,
      });
      const outputPath = path.join(tmpDir, "output.mp4");
      await renderEditedVideo({
        inputPath: prepared.inputPath,
        outputPath,
        plan,
        meta: prepared.meta,
      });

      const outBuf = fs.readFileSync(outputPath);
      const filename = safeOutputName(uploads[0]?.originalname, uploads.length);
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.setHeader("X-Edit-Summary", encodeURIComponent(plan.summary));
      res.send(outBuf);
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/voiceover/plan", uploadFields, async (req, res) => {
  try {
    const script = getScriptFromRequest(req);
    if (!script) throw new HttpError(400, "请粘贴或上传口播文稿");
    const instruction = req.body?.instruction ?? req.body?.prompt;
    const uploads = getUploadedFiles(req);
    const result = await withTmpDir(async (tmpDir) => {
      const inputPaths = await saveUploads(uploads, tmpDir);
      const clips = await probeClipLibrary(inputPaths, uploads);
      const plan = await generateVoiceoverPlan({ script, clips, instruction });
      return { clips, plan };
    });

    res.json({
      ok: true,
      summary: result.plan.summary,
      voice: result.plan.voice,
      aspect: result.plan.aspect,
      segments: result.plan.segments,
      provider: result.plan.provider,
      clips: clipSummaries(
        result.clips.map((c, i) => ({ ...c, index: i + 1 })),
      ),
      message: "口播匹配方案已生成",
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/voiceover/render", uploadFields, async (req, res) => {
  try {
    const script = getScriptFromRequest(req);
    let planRaw = req.body?.plan;
    if (typeof planRaw === "string") {
      try {
        planRaw = JSON.parse(planRaw);
      } catch {
        throw new HttpError(400, "口播方案 JSON 无效");
      }
    }
    if (!planRaw?.segments?.length) throw new HttpError(400, "请先生成口播匹配方案");

    const uploads = getUploadedFiles(req);
    await withTmpDir(async (tmpDir) => {
      const inputPaths = await saveUploads(uploads, tmpDir);
      const clips = await probeClipLibrary(inputPaths, uploads);
      const plan = normalizeVoiceoverPlan(planRaw, clips);
      const outputPath = path.join(tmpDir, "voiceover.mp4");
      await renderVoiceoverVideo({ plan, clips, tmpDir, outputPath });
      const outBuf = fs.readFileSync(outputPath);
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent("voiceover.mp4")}`,
      );
      res.setHeader("X-Edit-Summary", encodeURIComponent(plan.summary));
      res.send(outBuf);
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/voiceover/edit", uploadFields, async (req, res) => {
  try {
    const script = getScriptFromRequest(req);
    if (!script) throw new HttpError(400, "请粘贴或上传口播文稿");
    const instruction = req.body?.instruction ?? req.body?.prompt;
    const uploads = getUploadedFiles(req);
    await withTmpDir(async (tmpDir) => {
      const inputPaths = await saveUploads(uploads, tmpDir);
      const clips = await probeClipLibrary(inputPaths, uploads);
      const plan = await generateVoiceoverPlan({ script, clips, instruction });
      const outputPath = path.join(tmpDir, "voiceover.mp4");
      await renderVoiceoverVideo({ plan, clips, tmpDir, outputPath });
      const outBuf = fs.readFileSync(outputPath);
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent("voiceover.mp4")}`,
      );
      res.setHeader("X-Edit-Summary", encodeURIComponent(plan.summary));
      res.send(outBuf);
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
