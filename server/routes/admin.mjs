import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { HttpError, sendError } from "../lib/http-error.mjs";
import { getUserArchive, getUserChatSession, listUsersWithStats } from "../lib/admin-data.mjs";
import { requireAdminAuth } from "../lib/user-auth.mjs";

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

router.get("/users/:id/chat-history/:sessionId", (req, res) => {
  try {
    const session = getUserChatSession(req.params.id, req.params.sessionId);
    res.json({ ok: true, session });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

export default router;
