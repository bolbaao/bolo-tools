import { AGENT_TOOLS } from "../../shared/agent-tools.mjs";
import { generateAppHtml } from "./app-builder.mjs";
import { generateWriting } from "./ai-writer.mjs";
import { synthesizeSearchAnswer } from "./ai-search-synthesize.mjs";
import { runWorkflow } from "./ai-workflow.mjs";
import {
  generateEditPlan,
  prepareVideoInput,
  probeVideo,
  renderEditedVideo,
  safeOutputName,
} from "./ai-video-edit.mjs";
import { generateArkImage, editArkImage, beautifyArkImage } from "./ark-image.mjs";
import { HttpError } from "./http-error.mjs";
import { formatMediaSearchReply } from "./chat-media-intent.mjs";
import { formatResourceNotFound, formatSearchNotFound } from "../../shared/public-error.mjs";
import { assertSearchAllowed, searchMediaResources } from "./media-resource-fetch.mjs";
import { fetchTrends, formatHeat } from "./trends-fetch.mjs";
import { searchWeb } from "./web-search.mjs";
import { extractVideoByUrl } from "./video-extract-service.mjs";
import { runSpider, SPIDER_PRESETS } from "./spider-run.mjs";
import { adaptCaptionsForPlatforms, runSocialPublish } from "./social-publish.mjs";
import { addUserMemory, listUserMemories, formatMemoriesForPrompt } from "./user-memory.mjs";
import { putChatArtifact, formatArtifactLink } from "./chat-tool-artifacts.mjs";
import {
  pickFirstRaw,
  getImageDataUrl,
  convertAudioFile,
  makeGifFromVideo,
  runDocConvert,
  compressImageFile,
  transcribeMediaFile,
  extractEmbeddedSubtitle,
} from "./chat-tool-media.mjs";
import fs from "fs";
import os from "os";
import path from "path";

function pickField(fields, keys, fallback = "") {
  for (const key of keys) {
    const val = String(fields?.[key] ?? "").trim();
    if (val) return val;
  }
  return String(fallback || "").trim();
}

function formatVideoExtractResult(data) {
  const lines = [
    `**${data.title}**`,
    data.uploader ? `作者：${data.uploader}` : "",
    data.duration ? `时长：${Math.round(data.duration)} 秒` : "",
    "",
    "**下载链接**",
  ].filter(Boolean);

  for (const f of data.formats.slice(0, 6)) {
    lines.push(`- ${f.resolution} · ${f.ext} → [点击下载](${f.downloadUrl})`);
  }

  lines.push("", `_来源：${data.webpageUrl}_`);
  return lines.join("\n");
}

function formatSearchResult(query, summary, results) {
  if (!summary && !results?.length) {
    return formatSearchNotFound(query);
  }
  const lines = [summary || "暂时无法生成摘要，请查看下方参考来源。", ""];
  if (results?.length) {
    lines.push("**参考来源**");
    for (const [i, r] of results.slice(0, 6).entries()) {
      lines.push(`${i + 1}. [${r.title}](${r.url})`);
    }
  }
  return lines.join("\n");
}

function formatHotTrends(platform, list) {
  const label = platform === "xiaohongshu" ? "小红书" : "抖音";
  const lines = [`**${label}热点榜**`, ""];
  for (const [i, item] of (list || []).slice(0, 15).entries()) {
    const heat = item.heat ? ` · ${formatHeat(item.heat)}` : "";
    const tag = item.tag ? ` · ${item.tag}` : "";
    lines.push(`${i + 1}. ${item.title}${heat}${tag}`);
  }
  return lines.join("\n");
}

function runTextToolbox(fields, fallbackText) {
  const tab = pickField(fields, ["tab"], "stats");
  const input = pickField(fields, ["input"], fallbackText);
  if (!input) throw new HttpError(400, "请提供待处理文本");

  if (tab === "dedupe") {
    const lines = input.split("\n");
    const seen = new Set();
    const out = [];
    for (const line of lines) {
      const key = line.trim();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(line);
    }
    return `**去重结果**\n\n\`\`\`\n${out.join("\n")}\n\`\`\``;
  }

  if (tab === "json") {
    try {
      const parsed = JSON.parse(input);
      return `**JSON 格式化**\n\n\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\``;
    } catch (e) {
      throw new HttpError(400, e instanceof Error ? e.message : "JSON 解析失败");
    }
  }

  if (tab === "markdown") {
    const preview = input.slice(0, 2000);
    return `**Markdown 预览**（原文 ${input.length} 字）\n\n\`\`\`markdown\n${preview}${input.length > 2000 ? "\n…" : ""}\n\`\`\``;
  }

  const trimmed = input.trim();
  const words = (trimmed.match(/[\u4e00-\u9fff]|[a-zA-Z0-9]+/g) || []).length;
  return [
    "**文本统计**",
    "",
    `- 字符数：${input.length}`,
    `- 不含空格：${input.replace(/\s/g, "").length}`,
    `- 词数：${words}`,
    `- 行数：${trimmed ? trimmed.split("\n").length : 0}`,
    `- 段落：${trimmed ? trimmed.split(/\n\s*\n/).filter(Boolean).length : 0}`,
  ].join("\n");
}

function formatSpiderResult(data) {
  const lines = [`**${data.pageTitle}**`, ""];
  for (const [i, item] of data.items.slice(0, 25).entries()) {
    lines.push(item.link ? `${i + 1}. [${item.title}](${item.link})` : `${i + 1}. ${item.title}`);
  }
  if (!data.items.length) lines.push("_暂未抓取到内容，可换网址或关键词重试_");
  return lines.join("\n");
}

function formatWorkflowResult(result) {
  const lines = ["**工作流已完成**", ""];
  for (const step of result.results || []) {
    lines.push(`### ${step.stepTitle}`, "", step.output, "");
  }
  return lines.join("\n").trim();
}

function formatSocialAdapt(captions, platforms) {
  const lines = ["**各平台文案已生成**", ""];
  for (const id of platforms) {
    try {
      const o = JSON.parse(captions[id] || "{}");
      lines.push(`**${id}**`, `- 标题：${o.title || "—"}`, `- 正文：${(o.description || "—").slice(0, 300)}`, "");
    } catch {
      lines.push(`**${id}**`, captions[id] || "—", "");
    }
  }
  return lines.join("\n");
}

function formatSocialPublishResult(data) {
  const lines = [data.summary || "发布任务已处理", ""];
  for (const r of data.results || []) {
    lines.push(`- **${r.label}**：${r.message || r.status}`);
    if (r.url) lines.push(`  ${r.url}`);
  }
  return lines.join("\n");
}

async function runImageStudio(fields, context) {
  const mode = pickField(fields, ["mode"], "generate") || "generate";
  const prompt = pickField(fields, ["prompt"], context.lastUserMessage);

  if (mode === "generate") {
    if (!prompt) throw new HttpError(400, "请描述要生成的画面");
    const result = await generateArkImage({ prompt, aspectRatio: "1:1", resolution: "1k" });
    if (result.imageBase64) {
      const id = putChatArtifact({
        buffer: Buffer.from(result.imageBase64, "base64"),
        filename: `generated-${Date.now()}.png`,
        contentType: result.mimeType || "image/png",
      });
      return `**图片已生成**\n\n${formatArtifactLink(id, "下载图片")}`;
    }
    return `**图片已生成**\n\n[查看图片](${result.imageUrl})`;
  }

  const imageDataUrl = getImageDataUrl(context.chatFiles, context.rawFiles);
  if (!imageDataUrl) throw new HttpError(400, "请上传图片附件");

  if (mode === "beautify") {
    const result = await beautifyArkImage({
      imageDataUrl,
      level: pickField(fields, ["level"], "standard") || "standard",
    });
    if (result.imageBase64) {
      const id = putChatArtifact({
        buffer: Buffer.from(result.imageBase64, "base64"),
        filename: `beautify-${Date.now()}.png`,
        contentType: result.mimeType || "image/png",
      });
      return `**人像美化完成**\n\n${formatArtifactLink(id, "下载图片")}`;
    }
    return `**人像美化完成**\n\n[查看图片](${result.imageUrl})`;
  }

  if (mode === "edit" || mode === "cutout") {
    const editPrompt =
      mode === "cutout"
        ? "去除背景，只保留主体，输出干净透明或纯白背景"
        : prompt || "按用户要求修图";
    const result = await editArkImage({ prompt: editPrompt, imageDataUrl, resolution: "2k" });
    if (result.imageBase64) {
      const id = putChatArtifact({
        buffer: Buffer.from(result.imageBase64, "base64"),
        filename: `${mode}-${Date.now()}.png`,
        contentType: result.mimeType || "image/png",
      });
      return `**${mode === "cutout" ? "抠图" : "修图"}完成**\n\n${formatArtifactLink(id, "下载图片")}`;
    }
    return `**处理完成**\n\n[查看图片](${result.imageUrl})`;
  }

  if (mode === "compress") {
    const file = pickFirstRaw(context.rawFiles, ["image"]);
    if (!file) throw new HttpError(400, "请上传图片");
    const r = await compressImageFile(file, Number(fields.quality) || 80);
    return r.text;
  }

  if (mode === "sharpen") {
    const result = await editArkImage({
      prompt: "提升清晰度与细节，适度锐化，保持自然",
      imageDataUrl,
      resolution: "2k",
    });
    if (result.imageBase64) {
      const id = putChatArtifact({
        buffer: Buffer.from(result.imageBase64, "base64"),
        filename: `sharpen-${Date.now()}.png`,
        contentType: result.mimeType || "image/png",
      });
      return `**清晰化完成**\n\n${formatArtifactLink(id, "下载图片")}`;
    }
    return `**清晰化完成**\n\n[查看图片](${result.imageUrl})`;
  }

  throw new HttpError(400, "不支持的图像处理模式");
}

async function runVideoEdit(fields, context) {
  const mode = pickField(fields, ["mode"], "edit") || "edit";
  const videoFiles = (Array.isArray(context.rawFiles) ? context.rawFiles : []).filter(
    (f) => f?.buffer?.length,
  );
  const videoFile = pickFirstRaw(context.rawFiles, ["video"]);
  if (!videoFile) throw new HttpError(400, "请上传视频附件");

  if (mode === "voiceover") {
    throw new HttpError(400, "剪口播模式较复杂，请打开 AI 视频剪辑工具完成完整流程");
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pineapple-chat-vid-"));
  try {
    const fileInfos = videoFiles.map((f) => ({
      name: f.originalname,
      size: f.buffer.length,
    }));
    const inputPaths = videoFiles.map((f, i) => {
      const p = path.join(tmpDir, `in-${i}${path.extname(f.originalname) || ".mp4"}`);
      fs.writeFileSync(p, f.buffer);
      return p;
    });

    const { mainPath, clips } = await prepareVideoInput(inputPaths, tmpDir, fileInfos);
    const meta = await probeVideo(mainPath);

    const instruction = pickField(fields, ["instruction", "prompt"], context.lastUserMessage);
    const plan = await generateEditPlan({
      instruction,
      meta,
      clips: clips.length > 1 ? clips : undefined,
    });

    const outputPath = path.join(tmpDir, safeOutputName(videoFile.originalname, clips.length));
    await renderEditedVideo({ inputPath: mainPath, outputPath, plan, meta });

    const outBuf = fs.readFileSync(outputPath);
    const id = putChatArtifact({
      buffer: outBuf,
      filename: path.basename(outputPath),
      contentType: "video/mp4",
    });

    const opSummary = (plan.operations || [])
      .map((o) => o.op)
      .filter(Boolean)
      .join(" → ");
    return [
      "**视频剪辑完成**",
      plan.summary || "",
      opSummary ? `_操作：${opSummary}_` : "",
      "",
      formatArtifactLink(id, "下载视频"),
    ]
      .filter(Boolean)
      .join("\n");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * @param {{ toolId: string, title: string, fields: Record<string, string> }} action
 * @param {{ lastUserMessage?: string, chatFiles?: object[], rawFiles?: object[], userId?: string }} context
 */
async function runAgentTool(action, context = {}) {
  const toolId = String(action?.toolId || "").trim();
  const fields = action?.fields && typeof action.fields === "object" ? action.fields : {};
  const fallback = String(context.lastUserMessage || "").replace(/\n\[已附加.*\]$/, "").trim();

  try {
    switch (toolId) {
      case "media-download": {
        const keyword = pickField(fields, ["keyword", "query", "q"], fallback);
        const allowed = assertSearchAllowed(keyword);
        if (!allowed.ok) throw new HttpError(400, allowed.error);
        const result = await searchMediaResources(keyword);
        return { ok: true, text: formatMediaSearchReply(result) };
      }

      case "ai-search": {
        const query = pickField(fields, ["query", "q"], fallback);
        const searchPayload = await searchWeb(query, { depth: "advanced" });
        let summary = searchPayload.answer || "";
        try {
          summary = await synthesizeSearchAnswer(query, searchPayload);
        } catch {
          summary = summary || "未能生成 AI 摘要，请查看下方来源。";
        }
        return { ok: true, text: formatSearchResult(query, summary, searchPayload.results) };
      }

      case "ai-writer": {
        const input = pickField(fields, ["input", "topic", "text"], fallback);
        const result = await generateWriting({
          mode: pickField(fields, ["mode"], "article") || "article",
          input,
          topic: pickField(fields, ["topic"]),
          tone: pickField(fields, ["tone"]),
          length: pickField(fields, ["length"]),
          targetLang: pickField(fields, ["targetLang"]),
        });
        return { ok: true, text: `**${result.modeLabel}**\n\n${result.text}` };
      }

      case "ai-workflow": {
        const input = pickField(fields, ["input", "topic"], fallback);
        const result = await runWorkflow({
          workflowId: pickField(fields, ["workflowId"], "content-pipeline") || "content-pipeline",
          input,
          runAll: true,
        });
        return { ok: true, text: formatWorkflowResult(result) };
      }

      case "app-builder": {
        const description = pickField(fields, ["description", "input"], fallback);
        const result = await generateAppHtml({
          description,
          appType: pickField(fields, ["appType"], "tool") || "tool",
          appName: pickField(fields, ["appName"]),
          presetId: pickField(fields, ["presetId"]),
        });
        const id = putChatArtifact({
          buffer: Buffer.from(result.html, "utf8"),
          filename: `${(result.title || "app").replace(/[^\w\u4e00-\u9fff-]+/g, "-") || "app"}.html`,
          contentType: "text/html; charset=utf-8",
        });
        return {
          ok: true,
          text: `**${result.title || "应用"}已生成**\n\n${formatArtifactLink(id, "下载 HTML 应用")}\n\n_可用浏览器打开预览_`,
        };
      }

      case "video-extract": {
        const url = pickField(fields, ["url", "link"], fallback);
        const data = await extractVideoByUrl(url);
        return { ok: true, text: formatVideoExtractResult(data) };
      }

      case "hot-trends": {
        const platform = pickField(fields, ["platform"], "douyin") || "douyin";
        const { list } = await fetchTrends(platform);
        return { ok: true, text: formatHotTrends(platform, list) };
      }

      case "text-toolbox": {
        return { ok: true, text: runTextToolbox(fields, fallback) };
      }

      case "spider-builder": {
        const url = pickField(fields, ["url"], fallback);
        const presetKey = pickField(fields, ["preset"]);
        const preset = presetKey && SPIDER_PRESETS[presetKey] ? presetKey : undefined;
        const data = await runSpider({
          url,
          preset,
          listSelector: pickField(fields, ["listSelector"]),
          itemSelector: pickField(fields, ["itemSelector"]),
          limit: Number(fields.limit) || 30,
        });
        return { ok: true, text: formatSpiderResult(data) };
      }

      case "social-publish": {
        const title = pickField(fields, ["title"], "");
        const description = pickField(fields, ["description", "input"], fallback);
        const tags = pickField(fields, ["tags"]);
        const platformsRaw = pickField(fields, ["platforms"], "douyin");
        const platforms = platformsRaw.split(/[,，\s]+/).filter(Boolean);
        const videoFile = pickFirstRaw(context.rawFiles, ["video"]);

        if (videoFile) {
          const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pineapple-chat-social-"));
          try {
            const ext = path.extname(videoFile.originalname) || ".mp4";
            const videoPath = path.join(tmpDir, `video${ext}`);
            fs.writeFileSync(videoPath, videoFile.buffer);
            const data = await runSocialPublish({
              title,
              description,
              tags,
              platforms,
              videoPath,
              videoName: videoFile.originalname,
            });
            return { ok: true, text: formatSocialPublishResult(data) };
          } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
          }
        }

        const { captions } = await adaptCaptionsForPlatforms({
          title,
          description,
          tags,
          platforms,
        });
        return { ok: true, text: formatSocialAdapt(captions, platforms) };
      }

      case "music-convert": {
        const audio = pickFirstRaw(context.rawFiles, ["audio", "video"]);
        if (!audio) throw new HttpError(400, "请上传音频或含音轨的视频");
        const r = await convertAudioFile(audio, pickField(fields, ["format"], "MP3"));
        return { ok: true, text: r.text };
      }

      case "gif-maker": {
        const video = pickFirstRaw(context.rawFiles, ["video"]);
        if (!video) throw new HttpError(400, "请上传视频");
        const r = await makeGifFromVideo(video, fields);
        return { ok: true, text: r.text };
      }

      case "doc-convert": {
        const mode = pickField(fields, ["mode"], "pdf-to-word") || "pdf-to-word";
        const r = await runDocConvert(mode, context.rawFiles);
        return { ok: true, text: r.text };
      }

      case "subtitle-workshop": {
        const tab = pickField(fields, ["tab"], "transcribe") || "transcribe";
        const media = pickFirstRaw(context.rawFiles, ["video", "audio"]);
        if (!media) throw new HttpError(400, "请上传视频或音频");
        if (tab === "extract") {
          const r = await extractEmbeddedSubtitle(media);
          return { ok: true, text: r.text };
        }
        const r = await transcribeMediaFile(media, "text");
        return { ok: true, text: r.text };
      }

      case "image-studio": {
        const text = await runImageStudio(fields, context);
        return { ok: true, text };
      }

      case "ai-video-edit": {
        const text = await runVideoEdit(fields, context);
        return { ok: true, text };
      }

      case "memory": {
        if (!context.userId) throw new HttpError(401, "请先登录后再使用记忆库");
        const content = pickField(fields, ["content"], fallback);
        if (!content) throw new HttpError(400, "请提供要记住的内容");
        if (pickField(fields, ["action"], "add") === "list") {
          const block = formatMemoriesForPrompt(context.userId, 15);
          return {
            ok: true,
            text: block
              ? `**你的记忆**\n\n${block}`
              : "**记忆库为空**，可以说「记住：…」让我帮你保存。",
          };
        }
        addUserMemory(context.userId, content, "agent");
        const total = listUserMemories(context.userId).length;
        return { ok: true, text: `**已记住**\n\n> ${content}\n\n_当前共 ${total} 条记忆_` };
      }

      default: {
        const tool = AGENT_TOOLS.find((t) => t.id === toolId);
        return {
          ok: false,
          error: tool ? `「${tool.title}」执行失败，请检查参数或附件` : "未知工具",
          keepAction: true,
        };
      }
    }
  } catch (e) {
    const msg = e instanceof HttpError ? e.message : e?.message || "工具执行失败";
    return { ok: false, error: msg, keepAction: true };
  }
}

export async function mergeToolResultIntoReply(reply, agentAction, context) {
  if (!agentAction) return { reply, agentAction: null };

  const intro = String(reply || "").trim();
  const result = await runAgentTool(agentAction, context);

  if (result.ok) {
    const parts = [intro, result.text].filter(Boolean);
    return { reply: parts.join("\n\n"), agentAction: null };
  }

  const parts = [intro, result.error ? `⚠️ ${result.error}` : ""].filter(Boolean);
  return {
    reply: parts.join("\n\n"),
    agentAction: result.keepAction ? agentAction : null,
  };
}
