import { Router } from "express";
import { generateWriting, listWritingModes } from "../lib/ai-writer.mjs";
import { resolveChatConfig } from "../lib/chat-config.mjs";
import { HttpError, sendError } from "../lib/http-error.mjs";

const router = Router();

router.get("/capabilities", (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(resolveChatConfig()),
    modes: listWritingModes(),
  });
});

router.post("/generate", async (req, res) => {
  try {
    const { mode, input, topic, tone, length, targetLang } = req.body ?? {};
    const result = await generateWriting({ mode, input, topic, tone, length, targetLang });
    res.json({
      ok: true,
      ...result,
      message: "生成完成",
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
