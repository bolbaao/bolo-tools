import { Router } from "express";
import { generateAppHtml, listAppTypes } from "../lib/app-builder.mjs";
import { resolveChatConfig } from "../lib/chat-config.mjs";
import { HttpError, sendError } from "../lib/http-error.mjs";

const router = Router();

router.get("/capabilities", (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(resolveChatConfig()),
    appTypes: listAppTypes(),
  });
});

router.post("/generate", async (req, res) => {
  try {
    const { description, appType, appName } = req.body ?? {};
    const result = await generateAppHtml({ description, appType, appName });

    res.json({
      ok: true,
      html: result.html,
      title: result.title,
      provider: result.provider,
      message: "应用已生成，可在下方预览或下载",
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
