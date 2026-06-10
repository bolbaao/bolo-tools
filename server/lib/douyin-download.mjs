import { extractDouyin } from "./douyin-extract.mjs";
import { extractAwemeIdFromUrl, extractDouyinWeb } from "./douyin-web.mjs";
import { buildProxyHeaders } from "./video-download.mjs";
import { buildVideoWithAudio } from "./video-merge.mjs";
import { refreshDouyinCookies } from "./refresh-douyin-cookies.mjs";
import { downloadWithYtDlp } from "./ytdlp-download.mjs";

async function fetchPlayBuffer(playUrl) {
  const headers = buildProxyHeaders("douyin", playUrl);
  headers["Accept-Language"] = "zh-CN,zh;q=0.9";
  const res = await fetch(playUrl, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(300000),
  });
  if (!res.ok) {
    throw new Error(`下载失败 (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function resolveDouyinPageUrls(pageUrl) {
  const urls = [pageUrl];
  const id = extractAwemeIdFromUrl(pageUrl);
  if (id) {
    urls.push(
      `https://www.douyin.com/video/${id}`,
      `https://www.iesdouyin.com/share/video/${id}/`,
    );
  }
  return [...new Set(urls.filter(Boolean))];
}

async function extractDouyinInfo(pageUrl) {
  try {
    return await extractDouyinWeb(pageUrl);
  } catch {
    return await extractDouyin(pageUrl);
  }
}

/**
 * 下载时重新解析抖音链接，避免 CDN 签名过期导致 403
 * @param {string} pageUrl 用户原始分享链接
 */
export async function downloadDouyinFresh(pageUrl) {
  const { info } = await extractDouyinInfo(pageUrl);
  const playUrl = info.url || info.formats?.[0]?.url;
  if (!playUrl) throw new Error("未能获取播放地址");

  if (/\.m3u8/i.test(playUrl)) {
    const merged = await buildVideoWithAudio({
      videoUrl: playUrl,
      platform: "douyin",
      ext: "m3u8",
    });
    if (!merged) throw new Error("视频合成失败");
    return merged;
  }

  try {
    return await fetchPlayBuffer(playUrl);
  } catch {
    for (const url of resolveDouyinPageUrls(pageUrl)) {
      try {
        return await downloadWithYtDlp(url, "douyin");
      } catch {
        /* try next */
      }
    }
    throw new Error("下载失败 (403)");
  }
}

/**
 * @param {string} pageUrl
 */
export async function downloadDouyinWithCookieRefresh(pageUrl) {
  try {
    return await downloadDouyinFresh(pageUrl);
  } catch (firstErr) {
    const refreshed = await refreshDouyinCookies();
    if (!refreshed) throw firstErr;
    return downloadDouyinFresh(pageUrl);
  }
}
