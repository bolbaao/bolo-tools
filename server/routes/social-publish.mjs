import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import { sendError } from "../lib/http-error.mjs";
import {
  MAX_PUBLISH_VIDEO_MB,
  adaptCaptionsForPlatforms,
  getSocialPublishCapabilities,
  parseCaptionsField,
  runSocialPublish,
} from "../lib/social-publish.mjs";

const router = Router();
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdtemp(path.join(os.tmpdir(), "pineapple-sp-"), (err, dir) => cb(err, dir));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".mp4";
      cb(null, `upload${ext}`);
    },
  }),
  limits: { fileSize: MAX_PUBLISH_VIDEO_MB * 1024 * 1024 },
});

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

router.post("/publish", upload.single("video"), async (req, res) => {
  const tmpDir = req.file?.destination;
  try {
    const body = req.body ?? {};
    const platformList = Array.isArray(body.platforms)
      ? body.platforms
      : typeof body.platforms === "string"
        ? body.platforms.split(",").map((s) => s.trim())
        : [];

    let douyinAuto;
    if (body.douyinAuto === "0" || body.douyinAuto === false) douyinAuto = false;
    else if (body.douyinAuto === "1" || body.douyinAuto === true) douyinAuto = true;

    const result = await runSocialPublish({
      title: body.title,
      description: body.description,
      tags: body.tags,
      platforms: platformList,
      captions: parseCaptionsField(body.captions),
      videoPath: req.file?.path ?? null,
      videoName: req.file?.originalname,
      douyinAuto,
    });

    res.json({ ok: true, ...result, message: result.summary });
  } catch (err) {
    sendError(res, err);
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

/** 仅抖音全自动发布 */
router.post("/douyin/publish", upload.single("video"), async (req, res) => {
  const tmpDir = req.file?.destination;
  try {
    const body = req.body ?? {};
    const result = await runSocialPublish({
      title: body.title,
      description: body.description,
      tags: body.tags,
      platforms: ["douyin"],
      captions: parseCaptionsField(body.captions),
      videoPath: req.file?.path ?? null,
      videoName: req.file?.originalname,
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
