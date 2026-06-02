/** 可分发平台定义（创作者中心链接 + Cookie 路径） */
export const SOCIAL_PUBLISH_PLATFORMS = {
  douyin: {
    id: "douyin",
    label: "抖音",
    contentTypes: ["video", "text"],
    needsVideoForAuto: true,
    creatorUrl: "https://creator.douyin.com/creator-micro/content/upload",
    cookieFiles: ["./cookies/douyin.txt"],
    cookieEnv: ["YTDLP_COOKIES", "DOUYIN_COOKIES"],
    cookieBrowserEnv: "YTDLP_COOKIES_FROM_BROWSER",
    titleMax: 30,
    descMax: 1000,
    adaptHint: "抖音：标题抓眼球、正文口语化，话题用 # 标签，避免外链堆砌。",
  },
  "weixin-channels": {
    id: "weixin-channels",
    label: "微信视频号",
    contentTypes: ["video", "text"],
    needsVideoForAuto: true,
    creatorUrl: "https://channels.weixin.qq.com/platform/post/create",
    cookieFiles: ["./cookies/yuanbao.txt"],
    cookieEnv: ["YUANBAO_SPH_COOKIES", "YUANBAO_COOKIES"],
    cookieBrowserEnv: "YUANBAO_COOKIES_FROM_BROWSER",
    titleMax: 40,
    descMax: 1000,
    adaptHint: "视频号：语气真诚、适合朋友圈传播，少用夸张标题党。",
  },
  xiaohongshu: {
    id: "xiaohongshu",
    label: "小红书",
    contentTypes: ["video", "text"],
    needsVideoForAuto: true,
    creatorUrl: "https://creator.xiaohongshu.com/publish/publish",
    cookieFiles: ["./cookies/xiaohongshu.txt"],
    cookieEnv: ["XHS_COOKIES"],
    cookieBrowserEnv: "XHS_COOKIES_FROM_BROWSER",
    titleMax: 20,
    descMax: 1000,
    adaptHint: "小红书：标题含关键词与 emoji，正文分段+清单感，结尾引导收藏评论。",
  },
  bilibili: {
    id: "bilibili",
    label: "哔哩哔哩",
    contentTypes: ["video"],
    needsVideoForAuto: true,
    creatorUrl: "https://member.bilibili.com/platform/upload/video/frame",
    cookieFiles: ["./cookies/bilibili.txt"],
    cookieEnv: ["BILIBILI_COOKIES"],
    cookieBrowserEnv: "BILIBILI_COOKIES_FROM_BROWSER",
    titleMax: 80,
    descMax: 2000,
    adaptHint: "B站：标题可带梗，简介含时间轴或看点条目，语气偏年轻二次元也可严肃。",
  },
  kuaishou: {
    id: "kuaishou",
    label: "快手",
    contentTypes: ["video", "text"],
    needsVideoForAuto: true,
    creatorUrl: "https://cp.kuaishou.com/article/publish/video",
    cookieFiles: ["./cookies/kuaishou.txt"],
    cookieEnv: ["KUAISHOU_COOKIES"],
    cookieBrowserEnv: "KUAISHOU_COOKIES_FROM_BROWSER",
    titleMax: 30,
    descMax: 500,
    adaptHint: "快手：接地气、短句、强调真实生活感。",
  },
};

export function listPlatformIds() {
  return Object.keys(SOCIAL_PUBLISH_PLATFORMS);
}

export function getPlatform(id) {
  return SOCIAL_PUBLISH_PLATFORMS[id] ?? null;
}

export function normalizePlatformIds(raw) {
  const ids = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const id of ids) {
    const key = String(id ?? "").trim();
    if (key && getPlatform(key) && !out.includes(key)) out.push(key);
  }
  return out;
}
