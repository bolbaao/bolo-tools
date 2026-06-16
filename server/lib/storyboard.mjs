import OpenAI from "openai";
import { arkImageConfigured, generateArkImage } from "./ark-image.mjs";
import { getChatProviderLabel, resolveChatConfig } from "./chat-config.mjs";
import { HttpError } from "./http-error.mjs";
import { env } from "./env.mjs";
import { parseJsonBlock } from "./parse-json-block.mjs";

export const STYLE_PRESETS = [
  { id: "cinematic", label: "电影感", hint: "光影层次丰富、镜头感强" },
  { id: "realistic", label: "写实", hint: "真实摄影质感" },
  { id: "illustration", label: "插画", hint: "扁平或手绘插画风" },
  { id: "anime", label: "动漫", hint: "日系动漫画风" },
  { id: "minimal", label: "极简", hint: "干净留白、少元素" },
];

const ASPECT_RATIOS = ["9:16", "16:9", "1:1", "4:3", "3:4"];

export function storyboardCapabilities() {
  const aiConfigured = Boolean(resolveChatConfig());
  const imageConfigured = arkImageConfigured();
  return {
    aiConfigured,
    imageConfigured,
    ready: aiConfigured && imageConfigured,
    styles: STYLE_PRESETS,
    aspectRatios: ASPECT_RATIOS,
    sceneCountRange: { min: 2, max: 8, default: 4 },
  };
}

function clampSceneCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 4;
  return Math.min(8, Math.max(2, Math.round(n)));
}

function normalizeScenes(raw, sceneCount) {
  const scenes = Array.isArray(raw?.scenes) ? raw.scenes : [];
  if (!scenes.length) throw new HttpError(502, "分镜规划未返回有效镜头");

  return scenes.slice(0, sceneCount).map((scene, i) => {
    const index = Number(scene?.index) || i + 1;
    const title = String(scene?.title || `镜头 ${index}`).trim();
    const narration = String(scene?.narration || scene?.dialogue || "").trim();
    const visual = String(scene?.visual || scene?.description || "").trim();
    const imagePrompt = String(scene?.imagePrompt || scene?.prompt || visual || title).trim();
    if (!imagePrompt) throw new HttpError(502, `镜头 ${index} 缺少生图描述`);
    return { index, title, narration, visual, imagePrompt };
  });
}

async function planStoryboardScenes({ topic, script, sceneCount, style }) {
  const chatConfig = resolveChatConfig();
  if (!chatConfig) {
    throw new HttpError(503, "未配置 DEEPSEEK_API_KEY 或 ARK_API_KEY，无法规划分镜");
  }

  const stylePreset = STYLE_PRESETS.find((s) => s.id === style);
  const styleHint = stylePreset ? `${stylePreset.label}（${stylePreset.hint}）` : style || "电影感";

  const userParts = [
    `请为以下视频主题规划 ${sceneCount} 个分镜镜头。`,
    "",
    `画面风格：${styleHint}`,
    "",
    "要求：",
    "1. 按时间顺序输出镜头，适合短视频口播或旁白",
    "2. 每个镜头包含：镜号标题、口播要点、画面描述、生图提示词",
    "3. 生图提示词要具体，包含主体、场景、构图、光线、氛围，可直接用于文生图",
    "4. 只输出 JSON，不要其他说明",
    "",
    "JSON 格式：",
    `{"title":"视频标题","scenes":[{"index":1,"title":"镜头标题","narration":"口播要点","visual":"画面描述","imagePrompt":"生图提示词"}]}`,
    "",
  ];

  if (script?.trim()) {
    userParts.push("用户提供的脚本/素材：", script.trim(), "");
  }
  if (topic?.trim()) {
    userParts.push("主题：", topic.trim());
  }

  const timeoutMs = Number(env("STORYBOARD_PLAN_TIMEOUT_MS", "90000")) || 90000;
  const client = new OpenAI({
    apiKey: chatConfig.apiKey,
    baseURL: chatConfig.baseURL,
    timeout: timeoutMs,
    maxRetries: 0,
  });

  const completion = await client.chat.completions.create({
    model: chatConfig.model,
    messages: [
      {
        role: "system",
        content:
          "你是专业短视频分镜策划。根据主题或脚本输出结构化分镜 JSON，镜头节奏清晰，画面描述适合后续 AI 生图。",
      },
      { role: "user", content: userParts.join("\n") },
    ],
    temperature: 0.7,
    max_tokens: 4096,
  });

  let parsed;
  try {
    parsed = parseJsonBlock(completion.choices?.[0]?.message?.content || "");
  } catch {
    throw new HttpError(502, "分镜规划返回格式无效，请重试");
  }

  const title = String(parsed?.title || topic || script || "分镜").trim().slice(0, 120);
  const scenes = normalizeScenes(parsed, sceneCount);

  return {
    title,
    scenes,
    provider: getChatProviderLabel(chatConfig.provider),
  };
}

/**
 * @param {{ topic?: string, script?: string, sceneCount?: number, aspectRatio?: string, style?: string, resolution?: string }} opts
 */
export async function generateStoryboard(opts) {
  if (!arkImageConfigured()) {
    throw new HttpError(503, "未配置 ARK_API_KEY，无法生成图片");
  }

  const topic = String(opts.topic || "").trim();
  const script = String(opts.script || "").trim();
  if (!topic && !script) throw new HttpError(400, "请填写视频主题或脚本");

  const sceneCount = clampSceneCount(opts.sceneCount);
  const aspectRatio = ASPECT_RATIOS.includes(opts.aspectRatio) ? opts.aspectRatio : "9:16";
  const resolution = opts.resolution === "2k" ? "2k" : "1k";
  const style = String(opts.style || "cinematic").trim() || "cinematic";

  const plan = await planStoryboardScenes({ topic, script, sceneCount, style });
  const results = [];

  for (const scene of plan.scenes) {
    const image = await generateArkImage({
      prompt: scene.imagePrompt,
      aspectRatio,
      resolution,
      style: STYLE_PRESETS.find((s) => s.id === style)?.label,
    });

    results.push({
      ...scene,
      imageBase64: image.imageBase64,
      imageUrl: image.imageUrl,
      mimeType: image.mimeType || "image/png",
    });
  }

  return {
    title: plan.title,
    scenes: results,
    aspectRatio,
    style,
    provider: plan.provider,
  };
}
