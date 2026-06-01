import { Router } from "express";
import { HttpError, sendError } from "../lib/http-error.mjs";
import { getUserArchive, getUserChatSession, listUsersWithStats } from "../lib/admin-data.mjs";
import { requireAdminAuth } from "../lib/user-auth.mjs";

const router = Router();

router.use(requireAdminAuth);

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
