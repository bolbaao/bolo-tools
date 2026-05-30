import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { HttpError, sendError } from "../lib/http-error.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FEEDBACK_DIR = path.join(__dirname, "..", "..", "data", "feedback");
const FEEDBACK_PATH = path.join(FEEDBACK_DIR, "feedback.jsonl");

const MAX_MESSAGE_LEN = 2000;
const MIN_MESSAGE_LEN = 5;
const MAX_CONTACT_LEN = 200;

const router = Router();

if (!fs.existsSync(FEEDBACK_DIR)) {
  fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
}

router.post("/", (req, res) => {
  try {
    const { message, contact } = req.body ?? {};
    const text = typeof message === "string" ? message.trim() : "";
    const contactText = typeof contact === "string" ? contact.trim() : "";

    if (!text) throw new HttpError(400, "请填写反馈内容");
    if (text.length < MIN_MESSAGE_LEN) {
      throw new HttpError(400, `反馈内容至少 ${MIN_MESSAGE_LEN} 个字`);
    }
    if (text.length > MAX_MESSAGE_LEN) {
      throw new HttpError(400, `反馈内容不能超过 ${MAX_MESSAGE_LEN} 字`);
    }
    if (contactText.length > MAX_CONTACT_LEN) {
      throw new HttpError(400, `联系方式不能超过 ${MAX_CONTACT_LEN} 字`);
    }

    const entry = {
      id: randomUUID(),
      message: text,
      contact: contactText || undefined,
      createdAt: new Date().toISOString(),
      userAgent: req.get("user-agent")?.slice(0, 300) || undefined,
    };

    fs.appendFileSync(FEEDBACK_PATH, `${JSON.stringify(entry)}\n`, "utf8");

    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
