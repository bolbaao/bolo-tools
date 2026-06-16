import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { ensureUserMemoryDir } from "./user-auth.mjs";

const MAX_PROJECTS = 50;
const MAX_TOPIC_LEN = 4000;
const MAX_TITLE_LEN = 120;

function storyboardRoot(userId) {
  return path.join(ensureUserMemoryDir(userId), "storyboard");
}

function indexPath(userId) {
  return path.join(storyboardRoot(userId), "index.json");
}

function projectDir(userId, projectId) {
  return path.join(storyboardRoot(userId), projectId);
}

function projectFile(userId, projectId) {
  return path.join(projectDir(userId, projectId), "project.json");
}

function ensureStoryboardRoot(userId) {
  const dir = storyboardRoot(userId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function loadIndex(userId) {
  const file = indexPath(userId);
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveIndex(userId, items) {
  ensureStoryboardRoot(userId);
  fs.writeFileSync(indexPath(userId), JSON.stringify(items, null, 2));
}

function safeImageFilename(index, mimeType) {
  const ext = String(mimeType || "").includes("jpeg") ? "jpg" : "png";
  return `scene-${String(index).padStart(2, "0")}.${ext}`;
}

function writeSceneImages(userId, projectId, scenes) {
  const dir = projectDir(userId, projectId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return scenes.map((scene) => {
    const index = Number(scene.index) || 1;
    const base64 = String(scene.imageBase64 || "").trim();
    const mimeType = scene.mimeType || "image/png";
    let imageFile = scene.imageFile || "";

    if (base64) {
      imageFile = safeImageFilename(index, mimeType);
      fs.writeFileSync(path.join(dir, imageFile), Buffer.from(base64, "base64"));
    } else if (imageFile) {
      const existing = path.join(dir, imageFile);
      if (!fs.existsSync(existing)) imageFile = "";
    }

    return {
      index,
      title: String(scene.title || `镜头 ${index}`).trim(),
      narration: String(scene.narration || "").trim(),
      visual: String(scene.visual || "").trim(),
      imagePrompt: String(scene.imagePrompt || "").trim(),
      imageFile: imageFile || undefined,
      mimeType: imageFile ? mimeType : undefined,
    };
  });
}

function toSummary(project) {
  return {
    id: project.id,
    title: project.title,
    topic: project.topic,
    style: project.style,
    aspectRatio: project.aspectRatio,
    sceneCount: project.sceneCount,
    sceneTotal: Array.isArray(project.scenes) ? project.scenes.length : 0,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export function listStoryboardProjects(userId) {
  return loadIndex(userId).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function getStoryboardProject(userId, projectId) {
  const file = projectFile(userId, projectId);
  if (!fs.existsSync(file)) {
    throw Object.assign(new Error("项目不存在"), { status: 404 });
  }
  try {
    const project = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!project?.id || project.id !== projectId) {
      throw Object.assign(new Error("项目不存在"), { status: 404 });
    }
    return project;
  } catch (err) {
    if (err.status) throw err;
    throw Object.assign(new Error("项目数据损坏"), { status: 500 });
  }
}

export function getStoryboardProjectImagePath(userId, projectId, filename) {
  const safeName = path.basename(String(filename || ""));
  if (!safeName || safeName !== filename) {
    throw Object.assign(new Error("无效的图片路径"), { status: 400 });
  }
  const filePath = path.join(projectDir(userId, projectId), safeName);
  const root = projectDir(userId, projectId);
  if (!filePath.startsWith(root) || !fs.existsSync(filePath)) {
    throw Object.assign(new Error("图片不存在"), { status: 404 });
  }
  return filePath;
}

/**
 * @param {string} userId
 * @param {{
 *   id?: string,
 *   title?: string,
 *   topic?: string,
 *   style?: string,
 *   aspectRatio?: string,
 *   sceneCount?: number,
 *   scenes?: Array<Record<string, unknown>>,
 * }} input
 */
export function saveStoryboardProject(userId, input) {
  const topic = String(input.topic ?? "").trim().slice(0, MAX_TOPIC_LEN);
  const title = String(input.title ?? topic ?? "未命名项目").trim().slice(0, MAX_TITLE_LEN) || "未命名项目";
  const style = String(input.style || "cinematic").trim() || "cinematic";
  const aspectRatio = String(input.aspectRatio || "9:16").trim() || "9:16";
  const sceneCount = Number(input.sceneCount) || 4;
  const scenesInput = Array.isArray(input.scenes) ? input.scenes : [];

  if (!topic && !scenesInput.length) {
    throw Object.assign(new Error("请填写主题或保存已生成的分镜"), { status: 400 });
  }

  const index = loadIndex(userId);
  const existingId = String(input.id || "").trim();
  const isUpdate = existingId && index.some((p) => p.id === existingId);
  const id = isUpdate ? existingId : randomUUID();
  const now = new Date().toISOString();
  const createdAt = isUpdate
    ? index.find((p) => p.id === id)?.createdAt || now
    : now;

  if (!isUpdate && index.length >= MAX_PROJECTS) {
    throw Object.assign(new Error(`项目已满（最多 ${MAX_PROJECTS} 个）`), { status: 400 });
  }

  const scenes = writeSceneImages(userId, id, scenesInput);
  const project = {
    id,
    title,
    topic,
    style,
    aspectRatio,
    sceneCount,
    scenes,
    createdAt,
    updatedAt: now,
  };

  ensureStoryboardRoot(userId);
  if (!fs.existsSync(projectDir(userId, id))) {
    fs.mkdirSync(projectDir(userId, id), { recursive: true });
  }
  fs.writeFileSync(projectFile(userId, id), JSON.stringify(project, null, 2));

  const summary = toSummary(project);
  const nextIndex = isUpdate
    ? index.map((p) => (p.id === id ? summary : p))
    : [summary, ...index];
  saveIndex(userId, nextIndex);
  return project;
}

export function deleteStoryboardProject(userId, projectId) {
  const index = loadIndex(userId);
  const next = index.filter((p) => p.id !== projectId);
  if (next.length === index.length) {
    throw Object.assign(new Error("项目不存在"), { status: 404 });
  }
  saveIndex(userId, next);

  const dir = projectDir(userId, projectId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
