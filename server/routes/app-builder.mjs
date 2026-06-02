import { Router } from "express";
import { generateAppHtml, listAppPresets, listAppTypes } from "../lib/app-builder.mjs";
import { resolveChatConfig } from "../lib/chat-config.mjs";
import { HttpError, sendError } from "../lib/http-error.mjs";

const router = Router();

router.get("/capabilities", (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(resolveChatConfig()),
    appTypes: listAppTypes(),
    presets: listAppPresets(),
    notes: {
      shortcuts:
        "「快捷指令配套」生成的是可通过 URL 调用的网页，供快捷指令「获取 URL 内容」使用；不能生成 .shortcut 文件。部署 HTML 后把公网 URL 填入快捷指令即可。",
    },
  });
});

router.post("/generate", async (req, res) => {
  try {
    const { description, appType, appName, presetId } = req.body ?? {};
    const result = await generateAppHtml({ description, appType, appName, presetId });

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
