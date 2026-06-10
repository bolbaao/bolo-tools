"use client";

import ActionButton from "@/components/ActionButton";
import { useAgentPrefill } from "@/hooks/useAgentPrefill";
import { ApiError, apiGet, apiPost, apiUpload } from "@/lib/api";
import { AI_SERVICE_UNAVAILABLE } from "@/lib/service-message";
import { useEffect, useMemo, useState } from "react";

type PlatformInfo = {
  id: string;
  label: string;
  contentTypes: string[];
  creatorUrl: string;
  titleMax: number;
  descMax: number;
};

type AccountInfo = {
  platformId: string;
  label: string;
  ready: boolean;
  hint: string;
  creatorUrl: string;
};

type PublishResult = {
  platformId: string;
  label: string;
  status: string;
  mode: string;
  creatorUrl?: string;
  title?: string;
  description?: string;
  message?: string;
  accountHint?: string;
};

export default function SocialPublishPanel() {
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [selected, setSelected] = useState<string[]>(["douyin", "weixin-channels"]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [video, setVideo] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [coverMaxMb, setCoverMaxMb] = useState(15);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [douyinAutoEnabled, setDouyinAutoEnabled] = useState(true);
  const [douyinAuto, setDouyinAuto] = useState(true);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [adapting, setAdapting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PublishResult[]>([]);
  const [summary, setSummary] = useState<string | null>(null);

  const coverPreview = useMemo(() => (cover ? URL.createObjectURL(cover) : null), [cover]);

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  useAgentPrefill("social-publish", {
    apply: (fields) => {
      if (fields.title) setTitle(fields.title);
      if (fields.description) setDescription(fields.description);
      if (fields.tags) setTags(fields.tags);
      if (fields.platforms) {
        setSelected(
          fields.platforms
            .split(/[,，\s]+/)
            .map((s) => s.trim())
            .filter(Boolean),
        );
      }
    },
  });

  useEffect(() => {
    apiGet<{
      ok: boolean;
      platforms: PlatformInfo[];
      accounts: AccountInfo[];
      aiConfigured: boolean;
      douyinAutoEnabled?: boolean;
      douyinAutoHint?: string;
      coverUploadSupported?: boolean;
      coverMaxMb?: number;
    }>("/api/social-publish/capabilities")
      .then((d) => {
        setPlatforms(d.platforms || []);
        setAccounts(d.accounts || []);
        setAiConfigured(d.aiConfigured);
        setDouyinAutoEnabled(d.douyinAutoEnabled !== false);
        setDouyinAuto(d.douyinAutoEnabled !== false);
        if (d.coverMaxMb) setCoverMaxMb(d.coverMaxMb);
      })
      .catch(() => setAiConfigured(false));
  }, []);

  const accountMap = useMemo(() => {
    const m: Record<string, AccountInfo> = {};
    for (const a of accounts) m[a.platformId] = a;
    return m;
  }, [accounts]);

  const togglePlatform = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const onCoverChange = (file: File | null) => {
    if (!file) {
      setCover(null);
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      setError("封面请上传 JPG、PNG 或 WebP 图片");
      return;
    }
    if (file.size > coverMaxMb * 1024 * 1024) {
      setError(`封面不能超过 ${coverMaxMb}MB`);
      return;
    }
    setError(null);
    setCover(file);
  };

  const adaptCaptions = async () => {
    if (!selected.length || (!title.trim() && !description.trim())) return;
    setAdapting(true);
    setError(null);
    try {
      const data = await apiPost<{ ok: boolean; captions: Record<string, string> }>(
        "/api/social-publish/adapt-captions",
        {
          title: title.trim(),
          description: description.trim(),
          tags: tags.trim(),
          platforms: selected,
          captions,
        },
        { timeoutMs: 180000 },
      );
      setCaptions(data.captions || {});
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "文案适配失败");
    } finally {
      setAdapting(false);
    }
  };

  const publish = async (douyinOnly = false) => {
    if (!selected.length && !douyinOnly) return;
    if (!title.trim() && !description.trim()) return;
    if (
      (douyinOnly || (selected.includes("douyin") && douyinAuto)) &&
      !video
    ) {
      setError("抖音全自动发布需要上传视频文件");
      return;
    }
    setLoading(true);
    setError(null);
    setResults([]);
    setSummary(null);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("description", description.trim());
      if (tags.trim()) fd.append("tags", tags.trim());
      if (!douyinOnly) fd.append("platforms", selected.join(","));
      fd.append("douyinAuto", douyinAuto ? "1" : "0");
      if (Object.keys(captions).length) {
        fd.append("captions", JSON.stringify(captions));
      }
      if (video) fd.append("video", video);
      if (cover) fd.append("cover", cover);

      const path = douyinOnly
        ? "/api/social-publish/douyin/publish"
        : "/api/social-publish/publish";

      const data = await apiUpload<{
        ok: boolean;
        results: PublishResult[];
        summary: string;
        message?: string;
        captions?: Record<string, string>;
      }>(path, fd, {
        timeoutMs: douyinOnly || (selected.includes("douyin") && douyinAuto) ? 900000 : 600000,
      });

      if (data && typeof data === "object" && "results" in data) {
        setResults(data.results || []);
        setSummary(data.summary || data.message || null);
        if (data.captions) setCaptions(data.captions);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "分发失败");
    } finally {
      setLoading(false);
    }
  };

  const copyPlatformPack = (r: PublishResult) => {
    const text = [
      `【${r.label}】`,
      r.title ? `标题：${r.title}` : "",
      r.description ? `正文：\n${r.description}` : "",
      tags.trim() ? `标签：${tags.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    void navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      {aiConfigured === false && (
        <p className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90 ring-1 ring-amber-500/20">
          {AI_SERVICE_UNAVAILABLE} 仍可手动填写统一文案；开启 AI 后可自动改写各平台版本。
        </p>
      )}

      <section className="bento-card p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-medium text-white/80">发布内容</h2>
        <div>
          <label className="text-xs text-white/45">标题</label>
          <input
            className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-white/10 focus:ring-blue-500/40 outline-none"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="视频/笔记标题"
          />
        </div>
        <div>
          <label className="text-xs text-white/45">正文 / 文案</label>
          <textarea
            className="mt-1 w-full min-h-[120px] rounded-lg bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-white/10 focus:ring-blue-500/40 outline-none resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="统一文案，将按各平台规则自动改写（可选）"
          />
        </div>
        <div>
          <label className="text-xs text-white/45">话题标签（可选）</label>
          <input
            className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-white/10 focus:ring-blue-500/40 outline-none"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="#旅行 #美食 …"
          />
        </div>
        <div>
          <label className="text-xs text-white/45">视频文件（抖音全自动必填）</label>
          <input
            type="file"
            accept="video/*"
            className="mt-1 block w-full text-sm text-white/60 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-white/80"
            onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
          />
        </div>
        <div>
          <label className="text-xs text-white/45">封面图片（可选，JPG/PNG/WebP，最大 {coverMaxMb}MB）</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="mt-1 block w-full text-sm text-white/60 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-white/80"
            onChange={(e) => onCoverChange(e.target.files?.[0] ?? null)}
          />
          {coverPreview ? (
            <div className="mt-3 flex items-start gap-3">
              <img
                src={coverPreview}
                alt="封面预览"
                className="h-24 w-40 rounded-lg object-cover ring-1 ring-white/10"
              />
              <button
                type="button"
                className="text-xs text-white/45 hover:text-white/70"
                onClick={() => setCover(null)}
              >
                移除封面
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {douyinAutoEnabled && (
        <section className="bento-card p-5 sm:p-6 space-y-3 ring-1 ring-rose-500/25">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-white/85">抖音全自动</h2>
            <label className="flex items-center gap-2 text-xs text-white/55 cursor-pointer">
              <input
                type="checkbox"
                checked={douyinAuto}
                onChange={(e) => setDouyinAuto(e.target.checked)}
                className="rounded border-white/20"
              />
              上传后自动点「发布」
            </label>
          </div>
          {accountMap.douyin && !accountMap.douyin.ready && (
            <p className="text-xs text-amber-200/80">{accountMap.douyin.hint}</p>
          )}
          <ActionButton
            label="仅发布到抖音（全自动）"
            loadingLabel="发布中…"
            loading={loading}
            disabled={!video}
            onClick={() => void publish(true)}
          />
        </section>
      )}

      <section className="bento-card p-5 sm:p-6 space-y-3">
        <h2 className="text-sm font-medium text-white/80">分发到</h2>
        <div className="flex flex-wrap gap-2">
          {platforms.map((p) => {
            const acc = accountMap[p.id];
            const on = selected.includes(p.id);
            return (
              <div key={p.id} className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => togglePlatform(p.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
                    on
                      ? "bg-blue-500/20 text-blue-100 ring-blue-500/40"
                      : "bg-white/5 text-white/50 ring-white/10 hover:text-white/70"
                  }`}
                >
                  {p.label}
                  {acc && (
                    <span
                      className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                        acc.ready ? "bg-emerald-400" : "bg-amber-400"
                      }`}
                      title={acc.hint}
                    />
                  )}
                </button>
                <a
                  href={p.creatorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full px-2 py-1 text-[10px] text-blue-300/80 ring-1 ring-white/10 hover:text-blue-200 hover:ring-blue-500/30"
                  title={`打开${p.label}创作者中心`}
                >
                  链接 ↗
                </a>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <ActionButton
          variant="secondary"
          label="AI 适配各平台文案"
          loadingLabel="生成中…"
          loading={adapting}
          disabled={!selected.length}
          onClick={() => void adaptCaptions()}
        />
        <ActionButton
          label="开始分发"
          loadingLabel="分发中…"
          loading={loading}
          disabled={!selected.length}
          onClick={() => void publish(false)}
        />
      </div>

      {Object.keys(captions).length > 0 && (
        <section className="bento-card p-5 sm:p-6 space-y-3">
          <h2 className="text-sm font-medium text-white/80">各平台文案预览</h2>
          {selected.map((id) => {
            const raw = captions[id];
            if (!raw) return null;
            let preview = raw;
            try {
              const o = JSON.parse(raw) as { title?: string; description?: string };
              preview = [o.title, o.description].filter(Boolean).join("\n\n");
            } catch {
              /* keep raw */
            }
            const label = platforms.find((p) => p.id === id)?.label || id;
            return (
              <div key={id} className="rounded-lg bg-white/5 p-3 ring-1 ring-white/10">
                <p className="text-xs font-medium text-white/55 mb-1">{label}</p>
                <pre className="text-xs text-white/70 whitespace-pre-wrap font-sans">{preview}</pre>
              </div>
            );
          })}
        </section>
      )}

      {error && (
        <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-200/90 ring-1 ring-red-500/20">
          {error}
        </p>
      )}

      {summary && results.length > 0 && (
        <section className="bento-card p-5 sm:p-6 space-y-4">
          <p className="text-sm text-emerald-200/90">{summary}</p>
          <ul className="space-y-3">
            {results.map((r) => (
              <li
                key={r.platformId}
                className="rounded-lg bg-white/5 p-4 ring-1 ring-white/10 text-sm text-white/70"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-white/85">{r.label}</span>
                  <span className="text-xs text-white/40">
                    {r.status === "published"
                      ? "已自动提交"
                      : r.status === "ready"
                        ? "待确认发布"
                        : r.status === "failed"
                          ? "自动失败"
                          : r.status}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed">{r.message}</p>
                {r.accountHint && (
                  <p className="mt-1 text-xs text-amber-200/70">{r.accountHint}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.creatorUrl && (
                    <a
                      href={r.creatorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-300 hover:text-blue-200"
                    >
                      打开创作者中心 →
                    </a>
                  )}
                  {(r.title || r.description) && (
                    <button
                      type="button"
                      className="text-xs text-white/50 hover:text-white/75"
                      onClick={() => copyPlatformPack(r)}
                    >
                      复制该平台文案
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}
