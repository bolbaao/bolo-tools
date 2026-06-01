"use client";

import { ImageVisionIcon } from "@/components/icons/ToolIcon";
import AgentPermissionPrompt from "@/components/tools/AgentPermissionPrompt";
import { listMissingPermissionTypes } from "@/lib/agent-permission-catalog";
import {
  formatPermissionResultForChat,
  mergeClientPermission,
  requestClientPermission,
} from "@/lib/agent-permissions";
import { executeAgentActions, formatActionResults } from "@/lib/agent-executor";
import type {
  ActionResult,
  AgentAction,
  AgentPageContext,
  AgentPermissionRequest,
  AgentPermissionType,
  AgentResponse,
  ClientPermissions,
  ClientPhotoItem,
} from "@/lib/agent-types";
import { ApiError, apiPost } from "@/lib/api";
import {
  fetchChatModels,
  formatChatModelLabel,
  pickInitialChatProvider,
  writeStoredChatProvider,
  type ChatModelOption,
} from "@/lib/chat";
import {
  imageNeedsVisionApi,
  mergeChatImageVision,
  prepareChatImagesForApi,
} from "@/lib/chat-image-vision";
import { filesToChatImages } from "@/lib/image-compress";
import { addMemory, extractMemoriesAuto } from "@/lib/memory";
import {
  createChatSession,
  getActiveChatSession,
  listChatSessions,
  loadChatSession,
  saveChatSession,
  type ChatSessionSummary,
} from "@/lib/chat-history";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const welcomeMessage =
  "嗨～想聊什么都可以，也可以直接告我你想要什么。";

const MAX_IMAGES_PER_SEND = 4;
const MAX_SESSION_IMAGES = 6;

type ChatMessage = {
  role: "user" | "ai";
  text: string;
  /** 仅发给 API 的内部系统消息，不在对话区展示 */
  hidden?: boolean;
  images?: ClientPhotoItem[];
  plan?: string[];
  actionResults?: ActionResult[];
  permissionRequests?: AgentPermissionRequest[];
  permissionsHandled?: AgentPermissionType[];
};

type AiChatPanelProps = {
  variant?: "default" | "hero";
};

function filterPendingPermissionRequests(
  requests: AgentPermissionRequest[] | undefined,
  perms: ClientPermissions,
  handled: AgentPermissionType[] | undefined,
): AgentPermissionRequest[] {
  if (!requests?.length) return [];
  const done = new Set(handled ?? []);
  return requests.filter((r) => {
    if (done.has(r.type)) return false;
    if (r.type === "geolocation" && perms.geolocation?.status === "granted") return false;
    if (r.type === "clipboard-read" && perms.clipboard?.status === "granted") return false;
    if (r.type === "notifications" && perms.notifications?.status === "granted") return false;
    if (
      r.type === "photos-picker" &&
      perms.photos?.status === "granted" &&
      (perms.photos.items?.length ?? 0) > 0
    ) {
      return false;
    }
    return true;
  });
}

export default function AiChatPanel({ variant = "default" }: AiChatPanelProps) {
  const isHero = variant === "hero";
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [autoMemoryNotice, setAutoMemoryNotice] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", text: welcomeMessage },
  ]);
  const [loading, setLoading] = useState(false);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientPermissions, setClientPermissions] = useState<ClientPermissions>({});
  const [pendingImages, setPendingImages] = useState<ClientPhotoItem[]>([]);
  const [sessionChatImages, setSessionChatImages] = useState<ClientPhotoItem[]>([]);
  const [imageBusy, setImageBusy] = useState(false);
  const [memoryBusy, setMemoryBusy] = useState<number | null>(null);
  const [memorySaved, setMemorySaved] = useState<number | null>(null);
  const [chatModels, setChatModels] = useState<ChatModelOption[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchChatModels()
      .then((data) => {
        setChatModels(data.models);
        setSelectedProvider((prev) => {
          if (prev && data.models.some((m) => m.id === prev)) return prev;
          return pickInitialChatProvider(data.models, data.defaultProvider);
        });
      })
      .catch(() => {
        setChatModels([]);
        setSelectedProvider(null);
      });
  }, []);

  const persistableMessages = useCallback((history: ChatMessage[]) => {
    return history
      .filter(
        (m) =>
          !m.hidden &&
          !(m.role === "ai" && m.text === welcomeMessage) &&
          !m.text.startsWith("（出错了）"),
      )
      .map((m) => ({ role: m.role, text: m.text }));
  }, []);

  const maybeExtractMemories = useCallback(
    async (history: ChatMessage[]) => {
      if (!user?.emailVerified) return;
      const visible = history.filter((m) => !m.hidden);
      const lastUser = [...visible].reverse().find((m) => m.role === "user");
      const lastAi = [...visible].reverse().find((m) => m.role === "ai");
      if (!lastUser?.text.trim() || !lastAi?.text.trim()) return;
      try {
        const added = await extractMemoriesAuto(lastUser.text, lastAi.text);
        if (added.length > 0) {
          setAutoMemoryNotice(`已自动提取 ${added.length} 条记忆到记忆库`);
          setTimeout(() => setAutoMemoryNotice(null), 4000);
        }
      } catch {
        /* 静默失败，不影响对话 */
      }
    },
    [user?.emailVerified],
  );

  useEffect(() => {
    if (!user?.emailVerified) {
      setSessionId(null);
      setSessions([]);
      setHistoryReady(true);
      return;
    }

    let cancelled = false;
    setHistoryReady(false);

    (async () => {
      try {
        let session = await getActiveChatSession();
        if (!session) {
          session = await createChatSession();
        }
        if (cancelled) return;

        setSessionId(session.id);
        if (session.messages.length > 0) {
          setMessages([
            { role: "ai", text: welcomeMessage },
            ...session.messages.map((m) => ({
              role: m.role,
              text: m.text,
            })),
          ]);
        }

        const listed = await listChatSessions();
        if (!cancelled) setSessions(listed.sessions);
      } catch {
        /* 忽略加载失败 */
      } finally {
        if (!cancelled) setHistoryReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.emailVerified]);

  useEffect(() => {
    if (!user?.emailVerified || !sessionId || !historyReady) return;
    const payload = persistableMessages(messages);
    if (payload.length === 0) return;

    const timer = setTimeout(() => {
      void saveChatSession(sessionId, payload).catch(() => {});
    }, 900);

    return () => clearTimeout(timer);
  }, [messages, sessionId, user?.emailVerified, historyReady, persistableMessages]);

  const getPageContext = useCallback(
    (perms: ClientPermissions = clientPermissions, images: ClientPhotoItem[] = sessionChatImages): AgentPageContext => {
      const toolMatch = pathname?.match(/^\/tools\/([^/]+)/);
      const ctx: AgentPageContext = {
        path: pathname ?? "/",
        toolId: toolMatch?.[1],
      };
      if (typeof Intl !== "undefined") {
        try {
          ctx.clientInfo = {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            locale: typeof navigator !== "undefined" ? navigator.language : undefined,
          };
        } catch {
          /* ignore */
        }
      }
      ctx.clientPermissions = perms;
      ctx.grantablePermissions = listMissingPermissionTypes(perms);
      if (images.length > 0) {
        ctx.chatImages = images;
      }
      return ctx;
    },
    [pathname, clientPermissions, sessionChatImages],
  );

  const buildApiMessages = useCallback((history: ChatMessage[]) => {
    return history
      .filter(
        (m) =>
          m.role === "user" ||
          (m.role === "ai" && m.text !== welcomeMessage && !m.text.startsWith("（出错了）")),
      )
      .slice(-12)
      .map((m) => {
        let content = m.text.trim();
        if (m.role === "user" && m.images?.length) {
          const tag = `[用户发送了 ${m.images.length} 张图片]`;
          content = content ? `${content}\n${tag}` : tag;
        }
        return {
          role: m.role === "user" ? ("user" as const) : ("assistant" as const),
          content,
        };
      })
      .filter((m) => m.content.length > 0);
  }, []);

  const addImageFiles = useCallback(async (files: FileList | File[]) => {
    const list = [...files];
    if (!list.length) return;
    setImageBusy(true);
    setError(null);
    try {
      const remain = MAX_IMAGES_PER_SEND - pendingImages.length;
      if (remain <= 0) {
        setError(`最多附加 ${MAX_IMAGES_PER_SEND} 张图片`);
        return;
      }
      const added = await filesToChatImages(list, remain);
      if (!added.length) {
        setError("请选择图片文件（JPG、PNG 等）");
        return;
      }
      setPendingImages((prev) => [...prev, ...added].slice(0, MAX_IMAGES_PER_SEND));
    } catch (e) {
      setError(e instanceof Error ? e.message : "图片处理失败");
    } finally {
      setImageBusy(false);
    }
  }, [pendingImages.length]);

  const appendAiFromResponse = useCallback(
    async (
      data: AgentResponse,
      historyAfterUser: ChatMessage[],
    ): Promise<ChatMessage[]> => {
      let actionResults: ActionResult[] = [];
      if (data.actions?.length) {
        await new Promise((r) => setTimeout(r, 120));
        actionResults = await executeAgentActions(data.actions as AgentAction[], router);
      }

      const resultNote =
        actionResults.length > 0 ? `\n\n${formatActionResults(actionResults)}` : "";

      const aiMsg: ChatMessage = {
        role: "ai",
        text: `${data.reply}${resultNote}`,
        plan: data.intent === "operate" ? data.plan : undefined,
        actionResults,
        permissionRequests: data.permissionRequests,
      };

      return [...historyAfterUser, aiMsg];
    },
    [router],
  );

  const runChat = useCallback(
    async (
      history: ChatMessage[],
      perms: ClientPermissions,
      chatImages: ClientPhotoItem[],
      provider: string | null = selectedProvider,
    ) => {
      const apiMessages = buildApiMessages(history);
      if (!apiMessages.some((m) => m.role === "user")) {
        throw new Error("消息为空");
      }

      const apiImages = prepareChatImagesForApi(chatImages);
      const needsVision = apiImages.some(imageNeedsVisionApi);
      const data = await apiPost<AgentResponse>(
        "/api/chat",
        {
          messages: apiMessages,
          pageContext: getPageContext(perms, apiImages),
          ...(provider ? { provider } : {}),
        },
        { timeoutMs: needsVision ? 120000 : 65000, credentials: "include" },
      );

      if (data.provider && data.provider !== provider) {
        setSelectedProvider(data.provider);
        writeStoredChatProvider(data.provider);
      }

      if (data.chatImageVision?.length) {
        const cached = mergeChatImageVision(chatImages, data.chatImageVision);
        setSessionChatImages(cached);
      }

      return appendAiFromResponse(data, history);
    },
    [appendAiFromResponse, buildApiMessages, getPageContext, selectedProvider],
  );

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    writeStoredChatProvider(provider);
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && !pendingImages.length) || loading || permissionBusy || imageBusy) return;

    const msgImages = pendingImages.length ? [...pendingImages] : undefined;
    const mergedSession = msgImages
      ? [...sessionChatImages, ...msgImages].slice(-MAX_SESSION_IMAGES)
      : sessionChatImages;

    if (msgImages) {
      setSessionChatImages(mergedSession);
      setPendingImages([]);
    }

    setInput("");
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", text: text || "", images: msgImages },
    ];
    setMessages(nextMessages);
    setLoading(true);
    setError(null);

    try {
      const updated = await runChat(nextMessages, clientPermissions, mergedSession);
      setMessages(updated);
      void maybeExtractMemories(updated);
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "发送失败";
      setError(msg);
      setMessages((m) => [...m, { role: "ai", text: `（出错了）${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const continueAfterAllPermissions = async (
    messageIndex: number,
    types: AgentPermissionType[],
  ) => {
    if (loading || permissionBusy || !types.length) return;

    setPermissionBusy(true);
    setLoading(true);
    setError(null);

    try {
      let perms = clientPermissions;
      const notes: string[] = [];

      for (const type of types) {
        const result = await requestClientPermission(type);
        perms = mergeClientPermission(perms, type, result);
        notes.push(formatPermissionResultForChat(type, result));
      }

      setClientPermissions(perms);

      const history: ChatMessage[] = [
        ...messages.map((m, i) =>
          i === messageIndex
            ? { ...m, permissionsHandled: [...(m.permissionsHandled ?? []), ...types] }
            : m,
        ),
        { role: "user", text: notes.join("\n"), hidden: true },
      ];

      const updated = await runChat(history, perms, sessionChatImages);
      setMessages(updated);
      void maybeExtractMemories(updated);
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "权限处理失败";
      setError(msg);
      setMessages((m) => [...m, { role: "ai", text: `（出错了）${msg}` }]);
    } finally {
      setLoading(false);
      setPermissionBusy(false);
    }
  };

  const continueAfterPermission = async (
    messageIndex: number,
    type: AgentPermissionType,
    allow: boolean,
  ) => {
    if (loading || permissionBusy) return;

    setPermissionBusy(true);
    setLoading(true);
    setError(null);

    try {
      let perms = clientPermissions;
      let note: string;

      if (allow) {
        const result = await requestClientPermission(type);
        perms = mergeClientPermission(clientPermissions, type, result);
        note = formatPermissionResultForChat(type, result);
      } else {
        const denied = { status: "denied" as const, error: "用户选择暂不授权" };
        perms = mergeClientPermission(clientPermissions, type, denied);
        note = formatPermissionResultForChat(type, denied);
      }

      setClientPermissions(perms);

      const history: ChatMessage[] = [
        ...messages.map((m, i) =>
          i === messageIndex
            ? { ...m, permissionsHandled: [...(m.permissionsHandled ?? []), type] }
            : m,
        ),
        { role: "user", text: note, hidden: true },
      ];

      const updated = await runChat(history, perms, sessionChatImages);
      setMessages(updated);
      void maybeExtractMemories(updated);
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "权限处理失败";
      setError(msg);
      setMessages((m) => [...m, { role: "ai", text: `（出错了）${msg}` }]);
    } finally {
      setLoading(false);
      setPermissionBusy(false);
    }
  };

  const resetChatState = () => {
    setMessages([{ role: "ai", text: welcomeMessage }]);
    setInput("");
    setError(null);
    setClientPermissions({});
    setPendingImages([]);
    setSessionChatImages([]);
    setMemorySaved(null);
    setAutoMemoryNotice(null);
  };

  const startNewChat = async () => {
    if (user?.emailVerified) {
      try {
        const session = await createChatSession();
        setSessionId(session.id);
        const listed = await listChatSessions();
        setSessions(listed.sessions);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "创建对话失败");
      }
    }
    resetChatState();
  };

  const switchSession = async (id: string) => {
    if (!user?.emailVerified || id === sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const session = await loadChatSession(id);
      setSessionId(session.id);
      setMessages([
        { role: "ai", text: welcomeMessage },
        ...session.messages.map((m) => ({ role: m.role, text: m.text })),
      ]);
      setClientPermissions({});
      setPendingImages([]);
      setSessionChatImages([]);
      setMemorySaved(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载对话失败");
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    void startNewChat();
  };

  const saveToMemory = async (messageIndex: number, text: string) => {
    const content = text.trim();
    if (!user?.emailVerified || !content || memoryBusy !== null) return;
    setMemoryBusy(messageIndex);
    setError(null);
    try {
      await addMemory(content);
      setMemorySaved(messageIndex);
      setTimeout(() => setMemorySaved((v) => (v === messageIndex ? null : v)), 2000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "保存记忆失败");
    } finally {
      setMemoryBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {!isHero && (
        <p className="text-sm text-white/45 leading-relaxed">
          支持上传/粘贴图片识别（火山方舟 ARK_API_KEY + ARK_VISION_MODEL；同一会话内已识别图片不会重复调用）；也可申请定位、相册等权限。
          {user?.emailVerified ? (
            <>
              {" "}
              已启用记忆库、对话历史同步与自动记忆提取。
            </>
          ) : user ? (
            <>
              {" "}
              验证邮箱后可同步对话历史并使用记忆库。
            </>
          ) : (
            <>
              {" "}
              <Link href="/tools/memory" className="text-emerald-400/80 hover:text-emerald-300">
                登录
              </Link>
              后可使用记忆库与对话历史。
            </>
          )}
        </p>
      )}

      <div
        className={`rounded-xl border border-white/8 bg-black/20 flex flex-col ${
          isHero ? "h-[320px] sm:h-[380px]" : "h-[360px] sm:h-[420px]"
        }`}
      >
        <div className="flex items-center gap-2 border-b border-white/8 px-4 py-2.5 justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {!isHero && (
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-white/40">AI 对话</span>
                {user?.emailVerified && (
                  <Link
                    href="/tools/memory"
                    className="text-xs text-emerald-400/70 hover:text-emerald-300 transition-colors"
                  >
                    记忆库
                  </Link>
                )}
              </div>
            )}
            {isHero && user?.emailVerified && (
              <Link
                href="/tools/memory"
                className="shrink-0 text-xs text-emerald-400/70 hover:text-emerald-300 transition-colors"
              >
                记忆库
              </Link>
            )}
            {chatModels.length > 0 ? (
              <select
                value={selectedProvider ?? chatModels[0].id}
                onChange={(e) => handleProviderChange(e.target.value)}
                disabled={loading || permissionBusy || chatModels.length <= 1}
                title="切换对话模型"
                className="max-w-[min(100%,240px)] truncate rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/70 focus:border-violet-500/40 focus:outline-none disabled:opacity-60"
              >
                {chatModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {formatChatModelLabel(m)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-white/30">未配置模型</span>
            )}
            {user?.emailVerified && sessions.length > 0 && (
              <select
                value={sessionId ?? ""}
                onChange={(e) => void switchSession(e.target.value)}
                disabled={loading || permissionBusy}
                title="历史对话"
                className="max-w-[min(100%,180px)] truncate rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/70 focus:border-emerald-500/40 focus:outline-none disabled:opacity-60"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {user?.emailVerified && (
              <button
                type="button"
                onClick={() => void startNewChat()}
                disabled={loading || permissionBusy}
                className="text-xs text-emerald-400/60 hover:text-emerald-300 disabled:opacity-40"
              >
                新对话
              </button>
            )}
            <button
              type="button"
              onClick={clearChat}
              className="text-xs text-white/35 hover:text-white/60 transition-colors"
            >
              清空对话
            </button>
          </div>
        </div>

        {autoMemoryNotice && (
          <p className="border-b border-white/8 px-4 py-2 text-xs text-violet-300/80">
            {autoMemoryNotice}
          </p>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => {
            if (msg.hidden) return null;

            const pendingPermissions = filterPendingPermissionRequests(
              msg.permissionRequests,
              clientPermissions,
              msg.permissionsHandled,
            );

            return (
              <div
                key={i}
                className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                {msg.plan && msg.plan.length > 0 && (
                  <div className="max-w-[90%] rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-xs text-white/55">
                    <p className="font-medium text-violet-300/80 mb-1">助手执行计划</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                      {msg.plan.map((step, j) => (
                        <li key={j}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {msg.images && msg.images.length > 0 && (
                  <div className="max-w-[85%] flex flex-wrap gap-2 justify-end">
                    {msg.images.map((img, j) => (
                      <div
                        key={j}
                        className="relative h-20 w-20 overflow-hidden rounded-lg border border-white/15 bg-black/30"
                      >
                        {img.previewDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img.previewDataUrl}
                            alt={img.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-[10px] text-white/40 px-1 text-center">
                            {img.name}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {(msg.text || msg.role === "ai") && (
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-white/12 text-white"
                        : "bg-white/6 text-white/85"
                    }`}
                  >
                    {msg.text}
                  </div>
                )}
                {user?.emailVerified && msg.role === "user" && msg.text.trim() && (
                  <button
                    type="button"
                    disabled={memoryBusy === i}
                    onClick={() => void saveToMemory(i, msg.text)}
                    className="text-[10px] text-emerald-400/60 hover:text-emerald-300 disabled:opacity-40 transition-colors"
                  >
                    {memorySaved === i
                      ? "已存入记忆库"
                      : memoryBusy === i
                        ? "保存中…"
                        : "存入记忆库"}
                  </button>
                )}
                {msg.role === "ai" && pendingPermissions.length > 0 && (
                  <AgentPermissionPrompt
                    requests={pendingPermissions}
                    busy={loading || permissionBusy}
                    onAllow={(type) => void continueAfterPermission(i, type, true)}
                    onDeny={(type) => void continueAfterPermission(i, type, false)}
                    onAllowAll={() =>
                      void continueAfterAllPermissions(
                        i,
                        pendingPermissions.map((r) => r.type),
                      )
                    }
                  />
                )}
              </div>
            );
          })}
          {loading && (
            <p className="text-xs text-white/30 animate-pulse">
              {pendingImages.length > 0 ||
              sessionChatImages.some(imageNeedsVisionApi)
                ? "正在识别图片并回复…"
                : "正在回复…"}
            </p>
          )}
        </div>

        <div
          className="border-t border-white/8 p-3 space-y-2"
          onPaste={(e) => {
            const files = [...e.clipboardData.items]
              .map((item) => (item.kind === "file" ? item.getAsFile() : null))
              .filter((f): f is File => f !== null && f.type.startsWith("image/"));
            if (files.length) {
              e.preventDefault();
              void addImageFiles(files);
            }
          }}
        >
          {pendingImages.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              {pendingImages.map((img, j) => (
                <div
                  key={`${img.name}-${j}`}
                  className="relative h-14 w-14 overflow-hidden rounded-lg border border-violet-500/30"
                >
                  {img.previewDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img.previewDataUrl}
                      alt={img.name}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <button
                    type="button"
                    aria-label="移除图片"
                    onClick={() =>
                      setPendingImages((prev) => prev.filter((_, idx) => idx !== j))
                    }
                    className="absolute top-0 right-0 bg-black/70 text-white text-[10px] leading-none px-1 py-0.5 rounded-bl"
                  >
                    ×
                  </button>
                </div>
              ))}
              <span className="text-[10px] text-white/35">最多 {MAX_IMAGES_PER_SEND} 张</span>
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files?.length) void addImageFiles(files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              title="上传或粘贴图片，AI 识别内容"
              aria-label="上传或粘贴图片，AI 识别内容"
              disabled={loading || permissionBusy || imageBusy}
              onClick={() => fileInputRef.current?.click()}
              className="group/img-btn shrink-0 flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:border-violet-500/35 hover:bg-violet-500/8 disabled:opacity-40 transition-colors"
            >
              <ImageVisionIcon className="h-[22px] w-[22px] opacity-80 transition-opacity group-hover/img-btn:opacity-100" />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void send()}
              placeholder="输入文字，或粘贴/上传图片…"
              disabled={loading || permissionBusy || imageBusy}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={
                loading || permissionBusy || imageBusy || (!input.trim() && !pendingImages.length)
              }
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-[#0a0b14] disabled:opacity-40 hover:bg-white/92 transition-colors"
            >
              发送
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-center text-xs text-red-400/80">{error}</p>}
    </div>
  );
}
