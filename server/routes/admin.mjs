import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { HttpError, sendError } from "../lib/http-error.mjs";
import { getUserArchive, listUsersWithStats } from "../lib/admin-data.mjs";
import { requireAdminAuth } from "../lib/user-auth.mjs";
import {
  getUserMediaFile,
  listAllUserMedia,
  setUserMediaSaved,
} from "../lib/user-media-library.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEVELOPER_MD = path.join(__dirname, "..", "..", "DEVELOPER.md");

const router = Router();

router.use(requireAdminAuth);

router.get("/developer-docs", (_req, res) => {
  try {
    if (!fs.existsSync(DEVELOPER_MD)) {
      throw new HttpError(404, "开发者手册不存在");
    }
    const content = fs.readFileSync(DEVELOPER_MD, "utf8");
    res.json({ ok: true, content });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

router.get("/users", (_req, res) => {
  try {
    res.json({ ok: true, users: listUsersWithStats() });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

router.get("/users/:id/archive", (req, res) => {
  try {
    res.json({ ok: true, ...getUserArchive(req.params.id) });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

router.get("/media", (req, res) => {
  try {
    const { userId, kind, saved } = req.query;
    let savedFilter;
    if (saved === "1" || saved === "true") savedFilter = true;
    else if (saved === "0" || saved === "false") savedFilter = false;
    const items = listAllUserMedia({
      userId: typeof userId === "string" ? userId : undefined,
      kind: typeof kind === "string" ? kind : undefined,
      saved: savedFilter,
    });
    res.json({ ok: true, items });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

router.post("/media/:id/save", (req, res) => {
  try {
    const saved = req.body?.saved !== false;
    const item = setUserMediaSaved(req.params.id, saved);
    res.json({ ok: true, item });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

router.get("/media/:id/file", (req, res) => {
  try {
    const result = getUserMediaFile(req.params.id);
    if (!result) throw new HttpError(404, "文件不存在或已清理");
    res.setHeader("Content-Type", result.item.mime || "application/octet-stream");
    const canInline = /^(image|video)\//.test(result.item.mime || "");
    if (canInline) {
      res.setHeader(
        "Content-Disposition",
        `inline; filename*=UTF-8''${encodeURIComponent(result.item.name)}`,
      );
    } else {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(result.item.name)}`,
      );
    }
    fs.createReadStream(result.filePath).pipe(res);
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

export default router;
