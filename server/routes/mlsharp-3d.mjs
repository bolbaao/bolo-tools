import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import JSZip from "jszip";
import { HttpError, sendError } from "../lib/http-error.mjs";
import { getAuthUserFromRequest } from "../lib/user-auth.mjs";
import { recordUserMediaUploads } from "../lib/user-media-library.mjs";
import { getMlsharpStatus, isMlsharpAvailable, MLSHARP_QUALITY_PRESETS, resolveQuality, runSharpPredict } from "../lib/mlsharp-3d.mjs";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

router.get("/status", (_req, res) => {
  res.json({
    ok: true,
    ...getMlsharpStatus(),
    qualityPresets: Object.entries(MLSHARP_QUALITY_PRESETS).map(([id, p]) => ({
      id,
      label: p.label,
      internalSize: p.internalSize,
    })),
  });
});

router.post("/generate", upload.single("file"), async (req, res) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pineapple-mlsharp-"));
  try {
    if (!isMlsharpAvailable()) {
      throw new HttpError(503, "MLSharp 3D Maker 未安装，请先运行 ./scripts/download-mlsharp-3d-maker.sh");
    }
    if (!req.file?.buffer?.length) throw new HttpError(400, "请上传图片");

    recordUserMediaUploads(getAuthUserFromRequest(req)?.id, req.file, "mlsharp-3d");

    const mime = req.file.mimetype || "";
    if (!/^image\//.test(mime)) throw new HttpError(400, "请上传 JPG / PNG 等图片文件");

    const ext = path.extname(req.file.originalname) || (mime.includes("png") ? ".png" : ".jpg");
    const inputDir = path.join(tmpDir, "input");
    const outputDir = path.join(tmpDir, "output");
    fs.mkdirSync(inputDir, { recursive: true });

    const inputName = `photo${ext}`;
    const inputPath = path.join(inputDir, inputName);
    fs.writeFileSync(inputPath, req.file.buffer);

    const render = req.body.render === "1" || req.body.render === "true";
    const quality = resolveQuality(req.body.quality);
    const result = await runSharpPredict({ inputPath: inputDir, outputDir, render, quality });

    const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname)) || "model";
    const safeBase = baseName.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "model";

    if (render && result.videoFiles.length > 0) {
      const zip = new JSZip();
      zip.file(`${safeBase}.ply`, fs.readFileSync(result.plyPath));
      for (const video of result.videoFiles) {
        zip.file(path.basename(video), fs.readFileSync(video));
      }
      const zipBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(`${safeBase}-3d.zip`)}`,
      );
      res.send(zipBuf);
      return;
    }

    const plyBuf = fs.readFileSync(result.plyPath);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(`${safeBase}.ply`)}`,
    );
    res.send(plyBuf);
  } catch (err) {
    sendError(res, err);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

export default router;
