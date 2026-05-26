import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { HttpError, sendError } from "../lib/http-error.mjs";
import {
  clearSessionCookie,
  createSessionToken,
  getAssetsPassword,
  getSessionFromRequest,
  requireAssetsAuth,
  setSessionCookie,
  verifySessionToken,
} from "../lib/assets-auth.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, "..", "..", "data", "assets");
const META_PATH = path.join(ASSETS_DIR, "meta.json");

const router = Router();

if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ASSETS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || "";
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
});

function loadMeta() {
  if (!fs.existsSync(META_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(META_PATH, "utf8"));
  } catch {
    return [];
  }
}

function saveMeta(items) {
  fs.writeFileSync(META_PATH, JSON.stringify(items, null, 2));
}

function fileKind(mime) {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

router.post("/login", (req, res) => {
  try {
    const { password } = req.body ?? {};
    if (!password) throw new HttpError(400, "请输入密码");
    if (password !== getAssetsPassword()) {
      throw new HttpError(401, "密码错误");
    }
    const token = createSessionToken();
    setSessionCookie(res, token);
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get("/session", (req, res) => {
  const token = getSessionFromRequest(req);
  res.json({ ok: true, authenticated: verifySessionToken(token) });
});

router.get("/list", requireAssetsAuth, (_req, res) => {
  const items = loadMeta().sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  );
  res.json({ ok: true, items });
});

router.post("/upload", requireAssetsAuth, upload.array("files", 20), (req, res) => {
  try {
    if (!req.files?.length) throw new HttpError(400, "请选择文件");
    const meta = loadMeta();
    const added = req.files.map((f) => {
      const item = {
        id: path.basename(f.filename, path.extname(f.filename)),
        storedName: f.filename,
        name: f.originalname,
        mime: f.mimetype,
        size: f.size,
        kind: fileKind(f.mimetype),
        uploadedAt: new Date().toISOString(),
      };
      meta.push(item);
      return item;
    });
    saveMeta(meta);
    res.json({ ok: true, items: added });
  } catch (err) {
    sendError(res, err);
  }
});

router.get("/file/:storedName", requireAssetsAuth, (req, res) => {
  const stored = path.basename(req.params.storedName);
  const filePath = path.join(ASSETS_DIR, stored);
  if (!filePath.startsWith(ASSETS_DIR) || !fs.existsSync(filePath)) {
    res.status(404).json({ ok: false, error: "文件不存在" });
    return;
  }
  const item = loadMeta().find((m) => m.storedName === stored);
  if (item?.mime) res.setHeader("Content-Type", item.mime);
  res.sendFile(filePath);
});

router.delete("/item/:id", requireAssetsAuth, (req, res) => {
  try {
    const id = req.params.id;
    let meta = loadMeta();
    const item = meta.find((m) => m.id === id);
    if (!item) throw new HttpError(404, "素材不存在");
    const filePath = path.join(ASSETS_DIR, item.storedName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    meta = meta.filter((m) => m.id !== id);
    saveMeta(meta);
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
