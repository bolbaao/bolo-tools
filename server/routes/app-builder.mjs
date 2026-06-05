import { Router } from "express";
import {
  generateAppHtml,
  listAppPresets,
  listAppTypes,
  listDeployNotes,
  listStyleThemes,
  refineAppHtml,
} from "../lib/app-builder.mjs";
import { resolveChatConfig } from "../lib/chat-config.mjs";
import { sendError } from "../lib/http-error.mjs";

const router = Router();

router.get("/capabilities", (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(resolveChatConfig()),
    appTypes: listAppTypes(),
    presets: listAppPresets(),
    styleThemes: listStyleThemes(),
    deployNotes: listDeployNotes(),
    notes: {
      shortcuts:
        "「快捷指令配套」生成的是可通过 URL 调用的网页，供快捷指令「获取 URL 内容」使用；不能生成 .shortcut 文件。部署 HTML 后把公网 URL 填入快捷指令即可。",
    },
  });
});

router.post("/generate", async (req, res) => {
  try {
    const { description, appType, appName, presetId, styleTheme } = req.body ?? {};
    const result = await generateAppHtml({ description, appType, appName, presetId, styleTheme });

    res.json({
      ok: true,
      html: result.html,
      title: result.title,
      provider: result.provider,
      message: "应用已生成，可在下方预览、继续优化或下载",
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/refine", async (req, res) => {
  try {
    const { html, instruction, appType, appName } = req.body ?? {};
    const result = await refineAppHtml({ html, instruction, appType, appName });

    res.json({
      ok: true,
      html: result.html,
      title: result.title,
      provider: result.provider,
      message: "应用已按你的指令优化",
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
