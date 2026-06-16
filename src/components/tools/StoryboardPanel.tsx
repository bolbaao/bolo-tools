"use client";

import ActionButton from "@/components/ActionButton";
import AuthModal from "@/components/AuthModal";
import CopyButton from "@/components/CopyButton";
import {
  ToolChip,
  ToolChipBar,
  ToolError,
  ToolNotice,
  ToolPresetCard,
  ToolPresetGrid,
  ToolSection,
} from "@/components/tools/ToolSection";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { ApiError, apiPost, downloadBlob } from "@/lib/api";
import { buildImageZip } from "@/lib/image-processing";
import { AI_SERVICE_UNAVAILABLE } from "@/lib/service-message";
import {
  deleteStoryboardProject,
  getStoryboardProject,
  listStoryboardProjects,
  saveStoryboardProject,
  sceneDisplayUrl,
  type StoryboardProjectSummary,
  type StoryboardScene,
} from "@/lib/storyboard";
import { storyboardCapabilities } from "@/lib/storyboard-capabilities";
import { useCallback, useEffect, useMemo, useState } from "react";

type StylePreset = { id: string; label: string; hint: string };

const ASPECT_OPTIONS = [
  { id: "9:16", label: "9:16 竖屏" },
  { id: "16:9", label: "16:9 横屏" },
  { id: "1:1", label: "1:1 方形" },
];

const SCENE_COUNTS = [3, 4, 5, 6];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function StoryboardPanel() {
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [styles, setStyles] = useState<StylePreset[]>([]);
  const [ready, setReady] = useState<boolean | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [imageConfigured, setImageConfigured] = useState<boolean | null>(null);
  const [projects, setProjects] = useState<StoryboardProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("cinematic");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [sceneCount, setSceneCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);

  const resetEditor = useCallback(() => {
    setActiveProjectId(null);
    setTopic("");
    setStyle("cinematic");
    setAspectRatio("9:16");
    setSceneCount(4);
    setTitle(null);
    setScenes([]);
    setError(null);
  }, []);

  const loadProjects = useCallback(async () => {
    if (!user?.emailVerified) return;
    setProjectsLoading(true);
    try {
      setProjects(await listStoryboardProjects());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载项目失败");
    } finally {
      setProjectsLoading(false);
    }
  }, [user?.emailVerified]);

  const applyProject = useCallback((project: {
    id: string;
    title: string;
    topic: string;
    style: string;
    aspectRatio: string;
    sceneCount: number;
    scenes: StoryboardScene[];
  }) => {
    setActiveProjectId(project.id);
    setTopic(project.topic);
    setStyle(project.style || "cinematic");
    setAspectRatio(project.aspectRatio || "9:16");
    setSceneCount(project.sceneCount || project.scenes.length || 4);
    setTitle(project.title);
    setScenes(project.scenes || []);
    setError(null);
  }, []);

  const handleOpenProject = useCallback(
    async (id: string) => {
      if (loading || saving) return;
      setError(null);
      try {
        const project = await getStoryboardProject(id);
        applyProject(project);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "打开项目失败");
      }
    },
    [applyProject, loading, saving],
  );

  const handleSaveProject = useCallback(async () => {
    if (!user?.emailVerified) {
      setAuthOpen(true);
      return;
    }
    const topicVal = topic.trim();
    if (!topicVal && !scenes.length) return;
    setSaving(true);
    setError(null);
    try {
      const project = await saveStoryboardProject({
        id: activeProjectId || undefined,
        title: title || undefined,
        topic: topicVal,
        style,
        aspectRatio,
        sceneCount,
        scenes,
      });
      setActiveProjectId(project.id);
      setTitle(project.title);
      setScenes(project.scenes);
      setProjects((prev) => {
        const summary = {
          id: project.id,
          title: project.title,
          topic: project.topic,
          style: project.style,
          aspectRatio: project.aspectRatio,
          sceneCount: project.sceneCount,
          sceneTotal: project.scenes.length,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        };
        const rest = prev.filter((p) => p.id !== project.id);
        return [summary, ...rest];
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [activeProjectId, aspectRatio, sceneCount, scenes, style, title, topic, user?.emailVerified]);

  const handleDeleteProject = useCallback(
    async (id: string) => {
      if (loading || saving) return;
      setError(null);
      try {
        await deleteStoryboardProject(id);
        setProjects((prev) => prev.filter((p) => p.id !== id));
        if (activeProjectId === id) resetEditor();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "删除失败");
      }
    },
    [activeProjectId, loading, resetEditor, saving],
  );

  const handleGenerate = useCallback(
    async (overrides?: { topic?: string; style?: string; sceneCount?: number }) => {
      const topicVal = (overrides?.topic ?? topic).trim();
      if (!topicVal) return;
      if (overrides?.topic) setTopic(overrides.topic);
      if (overrides?.style) setStyle(overrides.style);
      if (overrides?.sceneCount) setSceneCount(overrides.sceneCount);

      setLoading(true);
      setError(null);
      setTitle(null);
      setScenes([]);

      try {
        const data = await apiPost<{
          ok: boolean;
          title: string;
          scenes: StoryboardScene[];
          message?: string;
        }>(
          "/api/storyboard/generate",
          {
            topic: topicVal,
            sceneCount: overrides?.sceneCount ?? sceneCount,
            aspectRatio,
            style: overrides?.style ?? style,
            resolution: "1k",
          },
          { timeoutMs: 600000, credentials: "include" },
        );
        setTitle(data.title);
        setScenes(data.scenes || []);
        setActiveProjectId(null);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "生成失败");
      } finally {
        setLoading(false);
      }
    },
    [topic, sceneCount, aspectRatio, style],
  );

  useAgentPrefill("storyboard", {
    apply: (fields) => {
      if (fields.topic || fields.script || fields.input) {
        setTopic(fields.topic || fields.script || fields.input || "");
      }
      if (fields.style) setStyle(fields.style);
      if (fields.sceneCount) setSceneCount(Number(fields.sceneCount) || 4);
    },
    canSubmit: (fields) => Boolean((fields.topic || fields.script || fields.input)?.trim()),
    submit: (fields) =>
      handleGenerate({
        topic: fields.topic || fields.script || fields.input,
        style: fields.style,
        sceneCount: fields.sceneCount ? Number(fields.sceneCount) : undefined,
      }),
  });

  useEffect(() => {
    void storyboardCapabilities()
      .then((d) => {
        setReady(d.ready);
        setAiConfigured(d.aiConfigured);
        setImageConfigured(d.imageConfigured);
        setStyles(d.styles || []);
      })
      .catch(() => {
        setReady(false);
        setAiConfigured(false);
        setImageConfigured(false);
      });
  }, []);

  useEffect(() => {
    if (user?.emailVerified) void loadProjects();
  }, [loadProjects, user?.emailVerified]);

  const notice = useMemo(() => {
    if (ready === false) {
      if (!aiConfigured) return AI_SERVICE_UNAVAILABLE;
      if (!imageConfigured) return "未配置火山方舟 API Key，无法生成图片。请在 .env 中填入 ARK_API_KEY。";
    }
    return null;
  }, [ready, aiConfigured, imageConfigured]);

  const downloadAll = async () => {
    if (!scenes.length) return;
    const files = await Promise.all(
      scenes.map(async (scene) => {
        const url = sceneDisplayUrl(activeProjectId, scene);
        if (!url) return null;
        let blob: Blob;
        if (url.startsWith("data:")) {
          const [header, base64] = url.split(",");
          const mime = header.match(/data:([^;]+)/)?.[1] || "image/png";
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          blob = new Blob([bytes], { type: mime });
        } else {
          const res = await fetch(url, { credentials: "include" });
          if (!res.ok) return null;
          blob = await res.blob();
        }
        const ext = blob.type.includes("jpeg") ? "jpg" : "png";
        return {
          blob,
          filename: `${String(scene.index).padStart(2, "0")}-${scene.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")}.${ext}`,
        };
      }),
    );

    const valid = files.filter(Boolean) as { blob: Blob; filename: string }[];
    if (!valid.length) return;
    const zip = await buildImageZip(valid);
    const safeTitle = (title || "storyboard").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
    downloadBlob(zip, `${safeTitle}-${Date.now()}.zip`);
  };

  const copyScript = () => {
    if (!scenes.length) return;
    const body = scenes
      .map(
        (s) =>
          `## 镜头 ${s.index} · ${s.title}\n\n**口播**：${s.narration || "—"}\n\n**画面**：${s.visual || "—"}`,
      )
      .join("\n\n---\n\n");
    void navigator.clipboard.writeText(`# ${title || "分镜脚本"}\n\n${body}`);
  };

  return (
    <div className="space-y-6">
      {notice && <ToolNotice>{notice}</ToolNotice>}

      <ToolSection title="项目列表" desc={user?.emailVerified ? "保存的分镜项目，点击继续编辑" : "登录后可保存分镜项目，随时继续编辑"}>
        {user?.emailVerified ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetEditor}
              disabled={loading || saving}
              className="rounded-lg bg-violet-600/25 px-4 py-2 text-xs text-violet-100 ring-1 ring-violet-500/35 hover:bg-violet-600/35 disabled:opacity-50"
            >
              新建项目
            </button>
            <button
              type="button"
              onClick={() => void handleSaveProject()}
              disabled={loading || saving || (!topic.trim() && !scenes.length)}
              className="rounded-lg bg-white/5 px-4 py-2 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50"
            >
              {saving ? "保存中…" : activeProjectId ? "保存修改" : "保存项目"}
            </button>
          </div>

          {projectsLoading ? (
            <p className="text-xs text-white/40">加载项目…</p>
          ) : projects.length === 0 ? (
            <p className="text-xs text-white/40">还没有项目，生成后可点击「保存项目」。</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {projects.map((project) => (
                <li key={project.id}>
                  <div
                    className={`rounded-xl border p-3 transition-colors ${
                      activeProjectId === project.id
                        ? "border-violet-500/40 bg-violet-500/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void handleOpenProject(project.id)}
                      className="w-full text-left"
                      disabled={loading || saving}
                    >
                      <p className="text-sm font-medium text-white/85 line-clamp-1">{project.title}</p>
                      <p className="mt-1 text-xs text-white/40 line-clamp-2">{project.topic || "无主题描述"}</p>
                      <p className="mt-2 text-[11px] text-white/35">
                        {project.sceneTotal || 0} 镜 · {formatDate(project.updatedAt)}
                      </p>
                    </button>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void handleDeleteProject(project.id)}
                        disabled={loading || saving}
                        className="text-[11px] text-red-300/80 hover:text-red-200 disabled:opacity-50"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-5 text-center">
            {user && !user.emailVerified ? (
              <p className="text-sm text-white/55">
                请先验证邮箱 <span className="text-white/80">{user.email}</span> 后再保存项目。
              </p>
            ) : (
              <>
                <p className="text-sm text-white/55">登录后可保存主题、脚本与生成画面。</p>
                <button
                  type="button"
                  onClick={() => setAuthOpen(true)}
                  className="mt-4 rounded-full btn-primary px-5 py-2 text-sm font-medium"
                >
                  登录 / 注册
                </button>
              </>
            )}
          </div>
        )}
      </ToolSection>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <div>
        <label htmlFor="storyboard-topic" className="block text-sm mb-2">
          视频主题 / 脚本
        </label>
        <textarea
          id="storyboard-topic"
          data-tool-primary-input
          value={topic}
          onChange={(e) => setTopic(e.target.value.slice(0, 4000))}
          rows={5}
          placeholder={`描述视频主题，或直接粘贴口播稿。例如：\n· 三分钟教会新手做手冲咖啡\n· 开箱测评一款降噪耳机，强调佩戴与音质\n· 职场新人试用期避坑，五条实用建议`}
          className="w-full resize-none"
        />
      </div>

      <ToolSection title="画面设置" desc="选择镜头数量、比例与整体调性">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-white/45 mb-2">镜头数量</p>
            <ToolChipBar>
              {SCENE_COUNTS.map((n) => (
                <ToolChip
                  key={n}
                  label={`${n} 镜`}
                  active={sceneCount === n}
                  onClick={() => setSceneCount(n)}
                />
              ))}
            </ToolChipBar>
          </div>

          <div>
            <p className="text-xs text-white/45 mb-2">画面比例</p>
            <ToolChipBar>
              {ASPECT_OPTIONS.map((opt) => (
                <ToolChip
                  key={opt.id}
                  label={opt.label}
                  active={aspectRatio === opt.id}
                  onClick={() => setAspectRatio(opt.id)}
                />
              ))}
            </ToolChipBar>
          </div>

          {styles.length > 0 && (
            <ToolPresetGrid>
              {styles.map((s) => (
                <ToolPresetCard
                  key={s.id}
                  title={s.label}
                  desc={s.hint}
                  active={style === s.id}
                  onClick={() => setStyle(s.id)}
                />
              ))}
            </ToolPresetGrid>
          )}
        </div>
      </ToolSection>

      {error && <ToolError>{error}</ToolError>}

      <ActionButton
        label="生成分镜图片"
        loadingLabel="正在规划分镜并出图，请稍候…"
        onClick={() => void handleGenerate()}
        disabled={!topic.trim() || ready === false}
        loading={loading}
      />

      {scenes.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white/80">{title}</p>
              <p className="text-xs text-white/45 mt-1">共 {scenes.length} 个镜头</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyScript}
                className="rounded-lg bg-white/5 px-4 py-2 text-xs text-white/70 hover:bg-white/10"
              >
                复制脚本
              </button>
              <button
                type="button"
                onClick={() => void downloadAll()}
                className="rounded-lg bg-violet-600/25 px-4 py-2 text-xs text-violet-100 ring-1 ring-violet-500/35 hover:bg-violet-600/35"
              >
                打包下载图片
              </button>
            </div>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {scenes.map((scene) => {
              const imgUrl = sceneDisplayUrl(activeProjectId, scene);
              return (
                <li
                  key={scene.index}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden"
                >
                  {imgUrl ? (
                    <div className="aspect-[9/16] max-h-80 w-full bg-black/20 sm:aspect-auto sm:max-h-none">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgUrl}
                        alt={scene.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-[9/16] items-center justify-center bg-black/20 text-sm text-white/40">
                      图片生成失败
                    </div>
                  )}
                  <div className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-white/80">
                        {scene.index}. {scene.title}
                      </p>
                      {imgUrl && (
                        <button
                          type="button"
                          onClick={async () => {
                            let blob: Blob;
                            if (imgUrl.startsWith("data:")) {
                              const [header, base64] = imgUrl.split(",");
                              const mime = header.match(/data:([^;]+)/)?.[1] || "image/png";
                              const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
                              blob = new Blob([bytes], { type: mime });
                            } else {
                              const res = await fetch(imgUrl, { credentials: "include" });
                              if (!res.ok) return;
                              blob = await res.blob();
                            }
                            const ext = blob.type.includes("jpeg") ? "jpg" : "png";
                            downloadBlob(blob, `scene-${scene.index}.${ext}`);
                          }}
                          className="shrink-0 text-xs text-violet-300 hover:text-violet-200"
                        >
                          下载
                        </button>
                      )}
                    </div>
                    {scene.narration && (
                      <p className="text-xs leading-relaxed text-white/55">
                        <span className="text-white/35">口播：</span>
                        {scene.narration}
                      </p>
                    )}
                    {scene.visual && (
                      <p className="text-xs leading-relaxed text-white/45">
                        <span className="text-white/30">画面：</span>
                        {scene.visual}
                      </p>
                    )}
                    <div className="flex justify-end">
                      <CopyButton text={scene.imagePrompt} label="复制生图词" />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
