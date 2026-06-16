"use client";

import { ApiError, apiGet, apiUpload } from "@/lib/api";
import {
  CHAT_MAX_FILES,
  pendingFileFromFile,
  type AgentAction,
  type ChatMessageAttachment,
  type PendingChatFile,
  type ProcessedChatFile,
} from "@/lib/chat-files";
import { AI_SERVICE_UNAVAILABLE } from "@/lib/service-message";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isToolPathname } from "@/lib/tool-page";
import { usePathname } from "next/navigation";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ChatMessageAttachment[];
  agentAction?: AgentAction | null;
};

type ChatModel = {
  id: string;
  label: string;
  model: string;
};

type Capabilities = {
  ok: boolean;
  available: boolean;
  models: ChatModel[];
  defaultProvider: string | null;
  vision: { configured: boolean; label: string };
  merged: boolean;
  agent: boolean;
  attachments: {
    image: boolean;
    document: boolean;
    text: boolean;
    audio: boolean;
    video: boolean;
  };
};

type WorkspaceChatContextValue = {
  messages: ChatMessage[];
  caps: Capabilities | null;
  backToChat: () => void;
  backChatTransition: boolean;
  toolPageExiting: boolean;
  dialogExpanded: boolean;
  setDialogExpanded: (expanded: boolean) => void;
  provider: string;
  setProvider: (id: string) => void;
  loading: boolean;
  error: string | null;
  pendingFiles: PendingChatFile[];
  addFiles: (files: FileList | File[]) => Promise<void>;
  removePendingFile: (id: string) => void;
  clearPendingFiles: () => void;
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
  deleteMessage: (id: string) => void;
  openAgentAction: (action: AgentAction, messageId: string) => Promise<void>;
};

const WorkspaceChatContext = createContext<WorkspaceChatContextValue | null>(null);

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 从某条消息定位其所属对话段（用户一问 + 后续助手回复），返回该段全部 id */
function turnMessageIds(messages: ChatMessage[], id: string): string[] {
  const index = messages.findIndex((m) => m.id === id);
  if (index === -1) return [];

  let start = index;
  while (start > 0 && messages[start].role !== "user") start -= 1;
  if (messages[start].role !== "user") return [id];

  let end = start + 1;
  while (end < messages.length && messages[end].role !== "user") end += 1;
  return messages.slice(start, end).map((m) => m.id);
}

const CHAT_STORAGE_KEY = "workspace-chat-messages";
const CHAT_STORAGE_MAX = 80;

type StoredChatMessage = Omit<ChatMessage, "attachments"> & {
  attachments?: Omit<ChatMessageAttachment, "previewUrl">[];
};

function loadStoredMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredChatMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-CHAT_STORAGE_MAX)
      .map((m) => ({
        id: m.id || newId(),
        role: m.role,
        content: m.content,
        attachments: m.attachments?.map((a) => ({ ...a, previewUrl: undefined })),
        agentAction: m.agentAction ?? null,
      }));
  } catch {
    return [];
  }
}

function saveStoredMessages(messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = messages.slice(-CHAT_STORAGE_MAX).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      attachments: m.attachments?.map(({ previewUrl: _p, ...rest }) => rest),
      agentAction: m.agentAction ?? null,
    }));
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota exceeded — ignore */
  }
}

const isToolPath = isToolPathname;

const BACK_EXIT_MS = 320;
const BACK_ENTER_MS = 480;

function backTransitionDelay(kind: "exit" | "enter") {
  if (typeof window === "undefined") return kind === "exit" ? BACK_EXIT_MS : BACK_ENTER_MS;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 0
    : kind === "exit"
      ? BACK_EXIT_MS
      : BACK_ENTER_MS;
}

export function WorkspaceChatProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadStoredMessages());
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [backChatTransition, setBackChatTransition] = useState(false);
  const [toolPageExiting, setToolPageExiting] = useState(false);
  const [dialogExpanded, setDialogExpanded] = useState(true);
  const [provider, setProvider] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingChatFile[]>([]);

  useEffect(() => {
    saveStoredMessages(messages);
  }, [messages]);

  useEffect(() => {
    if (isToolPath(pathname)) {
      if (!backChatTransition) setDialogExpanded(false);
      return;
    }
    setToolPageExiting(false);
    setDialogExpanded(true);
  }, [backChatTransition, pathname]);

  useEffect(() => {
    apiGet<Capabilities>("/api/chat/capabilities")
      .then((data) => {
        setCaps(data);
        if (data.defaultProvider) setProvider(data.defaultProvider);
      })
      .catch(() => setCaps(null));
  }, []);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    const items = await Promise.all(list.map(pendingFileFromFile));
    setPendingFiles((prev) => [...prev, ...items].slice(0, CHAT_MAX_FILES));
  }, []);

  const removePendingFile = useCallback((id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearPendingFiles = useCallback(() => setPendingFiles([]), []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(CHAT_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const deleteMessage = useCallback((id: string) => {
    setMessages((prev) => {
      const remove = new Set(turnMessageIds(prev, id));
      return prev.filter((m) => !remove.has(m.id));
    });
  }, []);

  const backToChat = useCallback(() => {
    const goHome = () => {
      setBackChatTransition(true);
      router.push("/", { scroll: false });
    };

    if (isToolPath(pathname)) {
      setToolPageExiting(true);
      window.setTimeout(() => {
        goHome();
      }, backTransitionDelay("exit"));
      return;
    }

    goHome();
  }, [pathname, router]);

  useEffect(() => {
    if (!backChatTransition || pathname !== "/") return;
    const timer = window.setTimeout(
      () => setBackChatTransition(false),
      backTransitionDelay("enter"),
    );
    return () => window.clearTimeout(timer);
  }, [backChatTransition, pathname]);

  const openAgentAction = useCallback(
    async (action: AgentAction, messageId: string) => {
      if (loading) return;
      setLoading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("payload", JSON.stringify({ agentAction: action }));
        for (const item of pendingFiles) {
          form.append("files", item.file, item.file.name);
        }
        const raw = await apiUpload("/api/chat/run-tool", form, { timeoutMs: 300000 });
        if (raw instanceof Blob) {
          throw new ApiError("服务返回异常");
        }
        const result = raw as { ok: boolean; reply: string; agentAction?: AgentAction | null };
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  content: [m.content, result.reply].filter(Boolean).join("\n\n"),
                  agentAction: result.agentAction ?? null,
                }
              : m,
          ),
        );
        clearPendingFiles();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "处理失败");
      } finally {
        setLoading(false);
      }
    },
    [clearPendingFiles, loading, pendingFiles],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || loading) return;
      if (!caps?.available) {
        setError(AI_SERVICE_UNAVAILABLE);
        return;
      }

      const attachments: ChatMessageAttachment[] = pendingFiles.map((item) => ({
        id: item.id,
        name: item.file.name,
        kind: item.kind,
        previewUrl: item.previewUrl,
        size: item.file.size,
      }));
      const attachmentNote =
        attachments.length > 0 ? `\n[已附加 ${attachments.length} 个文件]` : "";
      const userMsg: ChatMessage = {
        id: newId(),
        role: "user",
        content,
        attachments: attachments.length > 0 ? attachments : undefined,
      };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      if (isToolPath(pathname)) {
        setDialogExpanded(true);
      }
      setLoading(true);
      setError(null);

      try {
        const form = new FormData();
        form.append(
          "payload",
          JSON.stringify({
            messages: nextMessages.map((m, i) => ({
              role: m.role,
              content:
                i === nextMessages.length - 1 && m.role === "user" && m.attachments?.length
                  ? `${m.content}${attachmentNote}`
                  : m.content,
            })),
            provider: provider || caps.defaultProvider,
            mode: "agent",
            pageContext: { path: pathname },
          }),
        );
        for (const item of pendingFiles) {
          form.append("files", item.file, item.file.name);
        }

        const raw = await apiUpload("/api/chat", form, { timeoutMs: 360000 });
        if (raw instanceof Blob) {
          throw new ApiError("服务返回异常");
        }
        const result = raw as {
          ok: boolean;
          reply: string;
          agentAction?: AgentAction | null;
          chatFiles?: ProcessedChatFile[];
        };

        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content: result.reply,
            agentAction: result.agentAction ?? null,
          },
        ]);
        clearPendingFiles();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "发送失败");
      } finally {
        setLoading(false);
      }
    },
    [caps, clearPendingFiles, loading, messages, pathname, pendingFiles, provider],
  );

  const value = useMemo(
    () => ({
      messages,
      caps,
      backToChat,
      backChatTransition,
      toolPageExiting,
      dialogExpanded,
      setDialogExpanded,
      provider,
      setProvider,
      loading,
      error,
      pendingFiles,
      addFiles,
      removePendingFile,
      clearPendingFiles,
      sendMessage,
      clearMessages,
      deleteMessage,
      openAgentAction,
    }),
    [
      messages,
      caps,
      backToChat,
      backChatTransition,
      toolPageExiting,
      dialogExpanded,
      provider,
      loading,
      error,
      pendingFiles,
      addFiles,
      removePendingFile,
      clearPendingFiles,
      sendMessage,
      clearMessages,
      deleteMessage,
      openAgentAction,
    ],
  );

  return (
    <WorkspaceChatContext.Provider value={value}>{children}</WorkspaceChatContext.Provider>
  );
}

export function useWorkspaceChat() {
  const ctx = useContext(WorkspaceChatContext);
  if (!ctx) throw new Error("useWorkspaceChat must be used within WorkspaceChatProvider");
  return ctx;
}

export function useOptionalWorkspaceChat() {
  return useContext(WorkspaceChatContext);
}
