import { Router } from "express";
import { HttpError, sendError } from "../lib/http-error.mjs";
import { requireUserAuth, requireVerifiedEmail } from "../lib/user-auth.mjs";
import {
  createChatSession,
  deleteChatSession,
  getActiveChatSession,
  getChatSession,
  listChatSessions,
  saveChatSessionMessages,
  setActiveChatSession,
} from "../lib/user-chat-history.mjs";

const router = Router();

router.get("/", requireUserAuth, requireVerifiedEmail, (req, res) => {
  try {
    const sessions = listChatSessions(req.user.id);
    const active = getActiveChatSession(req.user.id);
    res.json({ ok: true, sessions, activeSessionId: active?.id ?? null });
  } catch (err) {
    sendError(res, err);
  }
});

router.get("/active", requireUserAuth, requireVerifiedEmail, (req, res) => {
  try {
    const session = getActiveChatSession(req.user.id);
    res.json({ ok: true, session });
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/", requireUserAuth, requireVerifiedEmail, (req, res) => {
  try {
    const { title } = req.body ?? {};
    const session = createChatSession(req.user.id, title);
    res.json({ ok: true, session });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

router.get("/:id", requireUserAuth, requireVerifiedEmail, (req, res) => {
  try {
    const session = getChatSession(req.user.id, req.params.id);
    setActiveChatSession(req.user.id, session.id);
    res.json({ ok: true, session });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

router.put("/:id", requireUserAuth, requireVerifiedEmail, (req, res) => {
  try {
    const { messages } = req.body ?? {};
    const session = saveChatSessionMessages(req.user.id, req.params.id, messages);
    res.json({ ok: true, session });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

router.post("/:id/activate", requireUserAuth, requireVerifiedEmail, (req, res) => {
  try {
    const session = setActiveChatSession(req.user.id, req.params.id);
    res.json({ ok: true, session });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

router.delete("/:id", requireUserAuth, requireVerifiedEmail, (req, res) => {
  try {
    const activeSessionId = deleteChatSession(req.user.id, req.params.id);
    res.json({ ok: true, activeSessionId });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

export default router;
