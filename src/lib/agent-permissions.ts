import type { AgentPermissionType, ClientPermissions } from "@/lib/agent-types";
import { fileToChatImage, filesToChatImages } from "@/lib/image-compress";

export const PERMISSION_META: Record<
  AgentPermissionType,
  { title: string; hint: string; allowLabel?: string }
> = {
  geolocation: {
    title: "获取位置",
    hint: "用于核实当地天气、位置相关回答（仅本次对话，不存储）",
  },
  "clipboard-read": {
    title: "读取剪贴板",
    hint: "用于核实你刚复制、但未发到对话框里的链接或文字",
  },
  notifications: {
    title: "桌面通知",
    hint: "用于核实并开启任务完成时的系统提醒",
  },
  "photos-picker": {
    title: "访问相册",
    hint: "将打开系统相册/文件选择器，请点选你要问的那张照片（可多选，按时间最早的一张作为主图）",
    allowLabel: "选择照片",
  },
};

type PermissionResult = NonNullable<ClientPermissions[keyof ClientPermissions]>;

export async function requestClientPermission(
  type: AgentPermissionType,
): Promise<PermissionResult> {
  switch (type) {
    case "geolocation":
      return requestGeolocation();
    case "clipboard-read":
      return requestClipboardRead();
    case "notifications":
      return requestNotifications();
    case "photos-picker":
      return pickPhotosFromLibrary();
    default:
      return { status: "unsupported", error: `未知权限: ${type}` };
  }
}

const MAX_PICKED_PHOTOS = 5;

function pickPhotosFromLibrary(): Promise<NonNullable<ClientPermissions["photos"]>> {
  if (typeof document === "undefined") {
    return Promise.resolve({ status: "unsupported", error: "当前环境无法选择照片" });
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.style.display = "none";
    document.body.appendChild(input);

    const cleanup = () => {
      input.remove();
    };

    input.addEventListener("change", () => {
      void (async () => {
        const files = [...(input.files ?? [])];
        cleanup();
        if (!files.length) {
          resolve({ status: "denied", error: "未选择照片" });
          return;
        }

        const sorted = [...files].sort((a, b) => a.lastModified - b.lastModified);
        const items = await filesToChatImages(sorted, MAX_PICKED_PHOTOS);
        resolve({ status: "granted", items });
      })();
    });

    input.addEventListener("cancel", () => {
      cleanup();
      resolve({ status: "denied", error: "已取消选择" });
    });

    input.click();
  });
}

async function requestGeolocation(): Promise<NonNullable<ClientPermissions["geolocation"]>> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { status: "unsupported", error: "当前浏览器不支持定位" };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          status: "granted",
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        resolve({
          status: "denied",
          error: err.message || "定位被拒绝或不可用",
        });
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 },
    );
  });
}

async function requestClipboardRead(): Promise<NonNullable<ClientPermissions["clipboard"]>> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
    return { status: "unsupported", error: "当前环境无法读取剪贴板" };
  }

  try {
    const text = (await navigator.clipboard.readText()).trim();
    if (!text) {
      return { status: "denied", error: "剪贴板为空" };
    }
    return { status: "granted", text: text.slice(0, 4000) };
  } catch (e) {
    return {
      status: "denied",
      error: e instanceof Error ? e.message : "读取剪贴板失败",
    };
  }
}

async function requestNotifications(): Promise<NonNullable<ClientPermissions["notifications"]>> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { status: "unsupported", error: "当前浏览器不支持通知" };
  }

  try {
    const perm = await Notification.requestPermission();
    return perm === "granted"
      ? { status: "granted" }
      : { status: "denied", error: "通知权限未授予" };
  } catch (e) {
    return {
      status: "denied",
      error: e instanceof Error ? e.message : "请求通知失败",
    };
  }
}

export function mergeClientPermission(
  prev: ClientPermissions,
  type: AgentPermissionType,
  result: PermissionResult,
): ClientPermissions {
  const next = { ...prev };
  if (type === "geolocation") {
    next.geolocation = result as ClientPermissions["geolocation"];
  } else if (type === "clipboard-read") {
    next.clipboard = result as ClientPermissions["clipboard"];
  } else if (type === "notifications") {
    next.notifications = result as ClientPermissions["notifications"];
  } else if (type === "photos-picker") {
    next.photos = result as ClientPermissions["photos"];
  }
  return next;
}

/** 授权结果注入对话，供模型继续回答 */
export function formatPermissionResultForChat(
  type: AgentPermissionType,
  result: PermissionResult,
): string {
  const label = PERMISSION_META[type].title;

  if (result.status === "granted") {
    if (type === "geolocation" && "latitude" in result && result.latitude != null) {
      const lat = result.latitude.toFixed(4);
      const lon = result.longitude!.toFixed(4);
      return `（系统：用户已允许「${label}」，大致位置 纬度 ${lat}、经度 ${lon}）`;
    }
    if (type === "clipboard-read" && "text" in result && result.text) {
      const preview =
        result.text.length > 200 ? `${result.text.slice(0, 200)}…` : result.text;
      return `（系统：用户已允许「${label}」，剪贴板内容：${preview}）`;
    }
    if (type === "notifications") {
      return `（系统：用户已允许「${label}」）`;
    }
    if (type === "photos-picker" && "items" in result && result.items?.length) {
      const primary = result.items[0];
      const more =
        result.items.length > 1 ? `等共 ${result.items.length} 张` : "";
      return `（系统：用户已通过相册选择器授权，主图「${primary.name}」${more}，请结合图像识别结果回答）`;
    }
    return `（系统：用户已允许「${label}」）`;
  }

  if (result.status === "unsupported") {
    return `（系统：「${label}」在当前浏览器不可用${result.error ? `：${result.error}` : ""}）`;
  }

  return `（系统：用户未允许「${label}」${result.error ? `：${result.error}` : ""}）`;
}
