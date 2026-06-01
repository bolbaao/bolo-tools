import { Router } from "express";
import { HttpError, sendError } from "../lib/http-error.mjs";
import { extractAndSaveMemories } from "../lib/memory-extract.mjs";
import { requireUserAuth, requireVerifiedEmail } from "../lib/user-auth.mjs";
import {
  addUserMemory,
  deleteUserMemory,
  listUserMemories,
  updateUserMemory,
} from "../lib/user-memory.mjs";

const router = Router();

router.get("/", requireUserAuth, requireVerifiedEmail, (req, res) => {
  try {
    const items = listUserMemories(req.user.id);
    res.json({ ok: true, items });
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/", requireUserAuth, requireVerifiedEmail, (req, res) => {
  try {
    const { content } = req.body ?? {};
    const item = addUserMemory(req.user.id, content);
    res.json({ ok: true, item });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

router.post("/extract-auto", requireUserAuth, requireVerifiedEmail, async (req, res) => {
  try {
    const { userMessage, assistantReply } = req.body ?? {};
    const added = await extractAndSaveMemories(req.user.id, { userMessage, assistantReply });
    res.json({ ok: true, added });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(502, err.message || "记忆提取失败"));
  }
});

router.put("/:id", requireUserAuth, requireVerifiedEmail, (req, res) => {
  try {
    const { content } = req.body ?? {};
    const item = updateUserMemory(req.user.id, req.params.id, content);
    res.json({ ok: true, item });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

router.delete("/:id", requireUserAuth, requireVerifiedEmail, (req, res) => {
  try {
    deleteUserMemory(req.user.id, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

export default router;
