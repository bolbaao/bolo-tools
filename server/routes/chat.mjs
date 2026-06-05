import { Router } from "express";
import multer from "multer";
import { sendError } from "../lib/http-error.mjs";
import { extractDocumentText } from "../lib/chat-document-extract.mjs";
import { getChatArtifact } from "../lib/chat-tool-artifacts.mjs";
import { getAuthUserFromRequest } from "../lib/user-auth.mjs";
import { recordUserMediaUploads } from "../lib/user-media-library.mjs";
import {
  getWorkspaceChatCapabilities,
  processChatUploadFiles,
  runWorkspaceChat,
} from "../lib/workspace-chat.mjs";
import { mergeToolResultIntoReply } from "../lib/chat-tool-runner.mjs";
import { CHAT_UPLOAD_LIMITS } from "../lib/chat-file-types.mjs";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CHAT_UPLOAD_LIMITS.maxVideoBytes, files: CHAT_UPLOAD_LIMITS.maxFiles },
});

router.get("/capabilities", (_req, res) => {
  res.json({ ok: true, ...getWorkspaceChatCapabilities() });
});

router.get("/artifacts/:id", (req, res) => {
  const item = getChatArtifact(req.params.id);
  if (!item) {
    res.status(404).json({ ok: false, error: "文件不存在或已过期" });
    return;
  }
  res.setHeader("Content-Type", item.contentType);
  const forceDownload = req.query.download === "1";
  const canInline = /^image\//.test(item.contentType);
  if (forceDownload || !canInline) {
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(item.filename)}`,
    );
  } else {
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(item.filename)}`);
  }
  res.send(item.buffer);
});

router.post("/extract-document", upload.single("file"), async (req, res) => {
  try {
    if (!req.file?.buffer?.length) throw new Error("请上传文件");
    const result = await extractDocumentText(req.file.buffer, req.file.originalname);
    res.json({
      ok: true,
      file: {
        name: req.file.originalname,
        kind: result.kind,
        content: result.content,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/process-files", upload.array("files", CHAT_UPLOAD_LIMITS.maxFiles), async (req, res) => {
  try {
    if (!req.files?.length) {
      res.json({ ok: true, files: [] });
      return;
    }
    const authUser = getAuthUserFromRequest(req);
    recordUserMediaUploads(authUser?.id, req.files, "chat");
    const files = await processChatUploadFiles(req.files);
    res.json({ ok: true, files });
  } catch (err) {
    sendError(res, err);
  }
});

async function handleChat(req, res) {
  try {
    let body = req.body || {};
    if (typeof body.payload === "string") {
      body = JSON.parse(body.payload);
    }

    const messages = body.messages;
    const provider = body.provider;
    const mode = body.mode;
    const pageContext = body.pageContext;

    const rawFiles = Array.isArray(req.files) ? req.files : [];
    const authUser = getAuthUserFromRequest(req);
    recordUserMediaUploads(authUser?.id, rawFiles, "chat");
    const uploaded = rawFiles.length > 0 ? await processChatUploadFiles(rawFiles) : [];

    const result = await runWorkspaceChat(messages, {
      provider,
      mode,
      pageContext,
      chatFiles: uploaded,
      rawFiles,
      userId: authUser?.id,
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    sendError(res, err);
  }
}

router.post("/run-tool", (req, res) => {
  const contentType = String(req.headers["content-type"] || "");
  if (contentType.includes("multipart/form-data")) {
    upload.array("files", CHAT_UPLOAD_LIMITS.maxFiles)(req, res, (err) => {
      if (err) {
        sendError(res, err);
        return;
      }
      void handleRunTool(req, res);
    });
    return;
  }
  void handleRunTool(req, res);
});

async function handleRunTool(req, res) {
  try {
    let body = req.body || {};
    if (typeof body.payload === "string") {
      body = JSON.parse(body.payload);
    }
    const agentAction = body.agentAction;
    if (!agentAction?.toolId) {
      throw new Error("缺少工具参数");
    }

    const rawFiles = Array.isArray(req.files) ? req.files : [];
    const authUser = getAuthUserFromRequest(req);
    if (rawFiles.length) recordUserMediaUploads(authUser?.id, rawFiles, "chat");

    const merged = await mergeToolResultIntoReply("", agentAction, {
      rawFiles,
      userId: authUser?.id,
      lastUserMessage: String(body.lastUserMessage || agentAction.summary || ""),
    });

    res.json({ ok: true, reply: merged.reply, agentAction: merged.agentAction });
  } catch (err) {
    sendError(res, err);
  }
}

router.post("/", (req, res) => {
  const contentType = String(req.headers["content-type"] || "");
  if (contentType.includes("multipart/form-data")) {
    upload.array("files", CHAT_UPLOAD_LIMITS.maxFiles)(req, res, (err) => {
      if (err) {
        sendError(res, err);
        return;
      }
      void handleChat(req, res);
    });
    return;
  }
  void handleChat(req, res);
});

export default router;
