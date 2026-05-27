import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import { HttpError, sendError } from "../lib/http-error.mjs";
import { runFfmpeg } from "../lib/ffmpeg-run.mjs";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

router.post("/from-video", upload.single("file"), async (req, res) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pineapple-gif-"));
  try {
    if (!req.file) throw new HttpError(400, "请上传视频文件");

    const start = clamp(Number(req.body.start) || 0, 0, 36000);
    const duration = clamp(Number(req.body.duration) || 3, 0.5, 30);
    const fps = clamp(Number(req.body.fps) || 10, 5, 20);
    const width = clamp(Number(req.body.width) || 480, 160, 1280);

    const ext = path.extname(req.file.originalname) || ".mp4";
    const inputPath = path.join(tmpDir, `input${ext}`);
    const palettePath = path.join(tmpDir, "palette.png");
    const outputPath = path.join(tmpDir, "output.gif");

    fs.writeFileSync(inputPath, req.file.buffer);

    const scaleFilter = `fps=${fps},scale=${width}:-1:flags=lanczos`;

    await runFfmpeg([
      "-y",
      "-ss",
      String(start),
      "-t",
      String(duration),
      "-i",
      inputPath,
      "-vf",
      `${scaleFilter},split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer`,
      "-loop",
      "0",
      outputPath,
    ]);

    const outBuf = fs.readFileSync(outputPath);
    const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    res.setHeader("Content-Type", "image/gif");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(baseName)}.gif"`,
    );
    res.send(outBuf);
  } catch (err) {
    sendError(res, err);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

export default router;
