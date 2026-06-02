import { Router } from "express";
import multer from "multer";
import fs from "fs";
import os from "os";
import path from "path";
import { HttpError, sendError } from "../lib/http-error.mjs";
import { requireUserAuth } from "../lib/user-auth.mjs";
import {
  clearHomeBackground,
  getHomeBackgroundFile,
  getHomeBackgroundInfo,
  saveHomeBackground,
} from "../lib/user-home-background.mjs";
import { recordUserMediaUploads } from "../lib/user-media-library.mjs";

const router = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(os.tmpdir(), "pineapple-home-bg");
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".mp4";
      cb(null, `upload-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.get("/", requireUserAuth, (req, res) => {
  try {
    const info = getHomeBackgroundInfo(req.user.id);
    res.json({
      ok: true,
      ...info,
      videoUrl: info.configured ? "/api/home-background/video" : null,
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.get("/video", requireUserAuth, (req, res) => {
  try {
    const file = getHomeBackgroundFile(req.user.id);
    if (!file) throw new HttpError(404, "尚未设置背景视频");
    res.setHeader("Content-Type", file.mime);
    res.setHeader("Cache-Control", "private, max-age=3600");
    if (file.name) {
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(file.name)}"`,
      );
    }
    fs.createReadStream(file.filePath).pipe(res);
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/", requireUserAuth, upload.single("video"), (req, res) => {
  try {
    recordUserMediaUploads(req.user.id, req.file, "home-background");
    const info = saveHomeBackground(req.user.id, req.file);
    res.json({
      ok: true,
      ...info,
      videoUrl: "/api/home-background/video",
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.delete("/", requireUserAuth, (req, res) => {
  try {
    clearHomeBackground(req.user.id);
    res.json({ ok: true, configured: false, videoUrl: null });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
