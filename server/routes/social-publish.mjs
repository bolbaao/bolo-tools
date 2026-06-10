import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import { sendError, HttpError } from "../lib/http-error.mjs";
import {
  MAX_PUBLISH_VIDEO_MB,
  MAX_PUBLISH_COVER_MB,
  adaptCaptionsForPlatforms,
  getSocialPublishCapabilities,
  parseCaptionsField,
  runSocialPublish,
} from "../lib/social-publish.mjs";

const router = Router();

function ensureUploadDir(req, _res, next) {
  fs.mkdtemp(path.join(os.tmpdir(), "pineapple-sp-"), (err, dir) => {
    if (err) {
      next(err);
      return;
    }
    req.spTempDir = dir;
    next();
  });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => cb(null, req.spTempDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || (file.fieldname === "cover" ? ".jpg" : ".mp4");
      cb(null, file.fieldname === "cover" ? `cover${ext}` : `video${ext}`);
    },
  }),
  limits: { fileSize: MAX_PUBLISH_VIDEO_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "cover") {
      const ok =
        /^image\//.test(file.mimetype || "") || /\.(jpe?g|png|webp)$/i.test(file.originalname || "");
      if (!ok) {
        cb(new Error("封面请上传 JPG、PNG 或 WebP 图片"));
        return;
      }
    }
    cb(null, true);
  },
});

function collectUploadPaths(req) {
  const files = req.files && typeof req.files === "object" ? req.files : {};
  const video = files.video?.[0] ?? req.file ?? null;
  const cover = files.cover?.[0] ?? null;
  if (cover && cover.size > MAX_PUBLISH_COVER_MB * 1024 * 1024) {
    throw new HttpError(400, `封面不能超过 ${MAX_PUBLISH_COVER_MB}MB`);
  }
  return { video, cover, tmpDir: req.spTempDir };
}

function buildPublishPayload(req) {
  const { video, cover } = collectUploadPaths(req);
  const body = req.body ?? {};
  const platformList = Array.isArray(body.platforms)
    ? body.platforms
    : typeof body.platforms === "string"
      ? body.platforms.split(",").map((s) => s.trim())
      : [];

  let douyinAuto;
  if (body.douyinAuto === "0" || body.douyinAuto === false) douyinAuto = false;
  else if (body.douyinAuto === "1" || body.douyinAuto === true) douyinAuto = true;

  return {
    title: body.title,
    description: body.description,
    tags: body.tags,
    platforms: platformList,
    captions: parseCaptionsField(body.captions),
    videoPath: video?.path ?? null,
    videoName: video?.originalname,
    coverPath: cover?.path ?? null,
    coverName: cover?.originalname,
    douyinAuto,
  };
}

router.get("/capabilities", (_req, res) => {
  res.json({ ok: true, ...getSocialPublishCapabilities() });
});

router.post("/adapt-captions", async (req, res) => {
  try {
    const { title, description, tags, platforms, captions } = req.body ?? {};
    const platformList = Array.isArray(platforms)
      ? platforms
      : typeof platforms === "string"
        ? platforms.split(",")
        : [];
    const result = await adaptCaptionsForPlatforms({
      title,
      description,
      tags,
      platforms: platformList,
      captions: parseCaptionsField(captions),
    });
    res.json({ ok: true, ...result, message: "各平台文案已生成" });
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/publish", ensureUploadDir, upload.fields([{ name: "video", maxCount: 1 }, { name: "cover", maxCount: 1 }]), async (req, res) => {
  const tmpDir = req.spTempDir;
  try {
    const result = await runSocialPublish(buildPublishPayload(req));
    res.json({ ok: true, ...result, message: result.summary });
  } catch (err) {
    sendError(res, err);
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

/** 仅抖音全自动发布 */
router.post("/douyin/publish", ensureUploadDir, upload.fields([{ name: "video", maxCount: 1 }, { name: "cover", maxCount: 1 }]), async (req, res) => {
  const tmpDir = req.spTempDir;
  try {
    const payload = buildPublishPayload(req);
    const result = await runSocialPublish({
      ...payload,
      platforms: ["douyin"],
      douyinAuto: true,
    });
    res.json({ ok: true, ...result, message: result.summary });
  } catch (err) {
    sendError(res, err);
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

export default router;
