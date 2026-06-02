import fs from "fs";
import os from "os";
import path from "path";
import OpenAI from "openai";
import { HttpError } from "./http-error.mjs";
import { resolveChatConfig, getChatProviderLabel } from "./chat-config.mjs";
import { runFfmpeg } from "./ffmpeg-run.mjs";

const NOTE_FREQ = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
};

const MELODY_PATTERNS = {
  pop: ["C4", "E4", "G4", "C5", "G4", "E4", "C4", "G4"],
  lofi: ["E4", "G4", "A4", "G4", "E4", "D4", "E4", "G4"],
  rock: ["E4", "E4", "G4", "A4", "G4", "E4", "D4", "E4"],
  folk: ["G4", "A4", "B4", "A4", "G4", "E4", "D4", "E4"],
};

function parseComposeJson(raw) {
  const text = String(raw || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : text;
  return JSON.parse(candidate);
}

function pickPattern(style) {
  const s = String(style || "").toLowerCase();
  if (s.includes("lofi") || s.includes("chill")) return MELODY_PATTERNS.lofi;
  if (s.includes("rock")) return MELODY_PATTERNS.rock;
  if (s.includes("folk") || s.includes("acoustic")) return MELODY_PATTERNS.folk;
  return MELODY_PATTERNS.pop;
}

async function llmCompose({ prompt, style, title, mode, instrumental }) {
  const chatConfig = resolveChatConfig();
  if (!chatConfig) {
    throw new HttpError(
      503,
      "未配置 Suno API，且未配置 DEEPSEEK_API_KEY 作为演示回退。请至少配置其一。",
    );
  }

  const client = new OpenAI({
    apiKey: chatConfig.apiKey,
    baseURL: chatConfig.baseURL,
    timeout: 60000,
    maxRetries: 0,
  });

  const system = `你是音乐创作助手。根据用户输入生成歌曲信息，仅输出 JSON：
{
  "title": "歌曲标题",
  "tags": "风格标签，英文逗号分隔",
  "lyrics": "完整歌词，含 [Verse]/[Chorus] 等段落；纯音乐则写简短氛围描述",
  "mood": "pop|lofi|rock|folk 之一"
}`;

  const user =
    mode === "lyrics"
      ? `歌词模式\n标题：${title || "未命名"}\n风格：${style || "pop"}\n歌词：\n${prompt}`
      : `灵感模式\n描述：${prompt}\n风格：${style || "pop"}\n纯音乐：${instrumental ? "是" : "否"}`;

  const completion = await client.chat.completions.create({
    model: chatConfig.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.7,
    max_tokens: 1500,
  });

  const raw = completion.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new HttpError(502, "AI 未返回歌曲信息");

  let parsed;
  try {
    parsed = parseComposeJson(raw);
  } catch {
    throw new HttpError(502, "AI 返回的歌曲信息格式无效");
  }

  return {
    title: String(parsed.title || title || "AI 演示曲目").slice(0, 80),
    tags: String(parsed.tags || style || "pop, demo").slice(0, 120),
    lyrics: String(parsed.lyrics || prompt).slice(0, 3000),
    mood: String(parsed.mood || "pop").toLowerCase(),
    provider: getChatProviderLabel(chatConfig.provider),
  };
}

async function synthesizeMelodyMp3(notes, noteDur = 2.8) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pineapple-music-demo-"));
  const outputPath = path.join(tmpDir, "demo.mp3");

  try {
    const args = ["-y"];
    for (const note of notes) {
      const freq = NOTE_FREQ[note] || NOTE_FREQ.C4;
      args.push("-f", "lavfi", "-i", `sine=frequency=${freq}:duration=${noteDur}`);
    }
    const concatIn = notes.map((_, i) => `[${i}:a]`).join("");
    args.push(
      "-filter_complex",
      `${concatIn}concat=n=${notes.length}:v=0:a=1,afade=t=in:st=0:d=0.15,afade=t=out:st=${Math.max(0, notes.length * noteDur - 0.4).toFixed(2)}:d=0.4,volume=0.4`,
      "-c:a",
      "libmp3lame",
      "-b:a",
      "192k",
      outputPath,
    );

    await runFfmpeg(args);
    return fs.readFileSync(outputPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Suno 未配置时的演示回退：LLM 作词 + ffmpeg 合成旋律预览
 */
export async function generateDemoMusic(opts) {
  const { prompt, style, title, instrumental = false, mode = "inspiration" } = opts;
  if (!prompt?.trim()) throw new HttpError(400, "请填写创作描述或歌词");

  const meta = await llmCompose({ prompt, style, title, mode, instrumental });
  const pattern = pickPattern(meta.mood || style);
  const mp3 = await synthesizeMelodyMp3(pattern);

  return [
    {
      id: `demo-${Date.now()}`,
      title: meta.title,
      audioBase64: mp3.toString("base64"),
      mimeType: "audio/mpeg",
      imageUrl: "",
      tags: `${meta.tags} · 演示旋律`,
      duration: pattern.length * 3,
      status: "demo",
      lyrics: meta.lyrics,
      demo: true,
      provider: meta.provider,
    },
  ];
}

export function demoMusicAvailable() {
  return Boolean(resolveChatConfig());
}
