import { Router } from "express";
import multer from "multer";
import { convertDocuments, getDocumentCapabilities } from "../lib/document-convert.mjs";
import { HttpError, sendError } from "../lib/http-error.mjs";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 30 },
});

function handleMulter(err, _req, res, next) {
  if (!err) return next();
  if (err.code === "LIMIT_FILE_SIZE") {
    return sendError(res, new HttpError(413, "单文件不能超过 50MB"));
  }
  if (err.code === "LIMIT_FILE_COUNT") {
    return sendError(res, new HttpError(400, "文件数量超出限制"));
  }
  return sendError(res, new HttpError(400, err.message || "文件上传失败"));
}

router.get("/capabilities", (_req, res) => {
  res.json({ ok: true, ...getDocumentCapabilities() });
});

router.post("/convert", upload.array("files", 30), handleMulter, async (req, res) => {
  try {
    const mode = String(req.body.mode || "");
    const scale = req.body.scale;
    const imageFormat = req.body.imageFormat;
    const files = req.files || [];

    const { buffer, filename, contentType } = await convertDocuments(mode, files, {
      scale,
      imageFormat,
    });

    const encoded = encodeURIComponent(filename);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encoded}`);
    res.setHeader("Content-Length", String(buffer.length));
    res.end(buffer);
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
