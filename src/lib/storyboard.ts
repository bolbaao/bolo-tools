import { apiDelete, apiGet, apiPost, ApiError } from "@/lib/api";

export type StoryboardScene = {
  index: number;
  title: string;
  narration: string;
  visual: string;
  imagePrompt: string;
  imageBase64?: string;
  imageUrl?: string;
  imageFile?: string;
  mimeType?: string;
};

export type StoryboardProjectSummary = {
  id: string;
  title: string;
  topic: string;
  style: string;
  aspectRatio: string;
  sceneCount: number;
  sceneTotal: number;
  createdAt: string;
  updatedAt: string;
};

export type StoryboardProject = StoryboardProjectSummary & {
  scenes: StoryboardScene[];
};

const cred = { credentials: "include" as const };

export async function listStoryboardProjects() {
  const data = await apiGet<{ ok: boolean; items: StoryboardProjectSummary[] }>(
    "/api/storyboard/projects",
    cred,
  );
  return data.items;
}

export async function getStoryboardProject(id: string) {
  const data = await apiGet<{ ok: boolean; project: StoryboardProject }>(
    `/api/storyboard/projects/${encodeURIComponent(id)}`,
    cred,
  );
  return data.project;
}

export async function saveStoryboardProject(input: {
  id?: string;
  title?: string;
  topic: string;
  style: string;
  aspectRatio: string;
  sceneCount: number;
  scenes: StoryboardScene[];
}) {
  const data = await apiPost<{ ok: boolean; project: StoryboardProject }>(
    "/api/storyboard/projects",
    input,
    { ...cred, timeoutMs: 120000 },
  );
  return data.project;
}

export async function deleteStoryboardProject(id: string) {
  await apiDelete(`/api/storyboard/projects/${encodeURIComponent(id)}`, cred);
}

export function storyboardProjectImageUrl(projectId: string, imageFile: string) {
  return `/api/storyboard/projects/${encodeURIComponent(projectId)}/images/${encodeURIComponent(imageFile)}`;
}

export function sceneDisplayUrl(projectId: string | null, scene: StoryboardScene) {
  if (scene.imageBase64) {
    return `data:${scene.mimeType || "image/png"};base64,${scene.imageBase64}`;
  }
  if (scene.imageUrl) return scene.imageUrl;
  if (projectId && scene.imageFile) {
    return storyboardProjectImageUrl(projectId, scene.imageFile);
  }
  return "";
}
