import { Router } from "express";
import axios from "axios";
import { sendError } from "../lib/http-error.mjs";

const router = Router();

const ENDPOINTS = {
  douyin: "https://api.vvhan.com/api/hotlist/douyin",
  xiaohongshu: "https://api.vvhan.com/api/hotlist/xiaohongshu",
};

const FALLBACK = {
  douyin: [
    { rank: 1, title: "#春日氛围感穿搭", heat: "—", tag: "时尚" },
    { rank: 2, title: "#一人食治愈料理", heat: "—", tag: "美食" },
  ],
  xiaohongshu: [
    { rank: 1, title: "早八通勤伪素颜妆", heat: "—", tag: "美妆" },
    { rank: 2, title: "租房改造低成本", heat: "—", tag: "家居" },
  ],
};

function normalizeList(raw, platform) {
  const arr = Array.isArray(raw) ? raw : raw?.data || raw?.list || [];
  return arr.slice(0, 20).map((item, i) => ({
    rank: i + 1,
    title: String(item.title || item.name || item.word || item.index || "").trim(),
    heat: String(item.hot || item.heat || item.hotValue || "—"),
    tag: String(item.category || item.label || (platform === "douyin" ? "抖音" : "小红书")),
  })).filter((x) => x.title);
}

router.get("/:platform", async (req, res) => {
  try {
    const platform = req.params.platform;
    const url = ENDPOINTS[platform];
    if (!url) {
      res.status(400).json({ ok: false, error: "不支持的平台" });
      return;
    }

    try {
      const { data } = await axios.get(url, { timeout: 10000 });
      const list = normalizeList(data?.data ?? data, platform);
      if (list.length > 0) {
        res.json({ ok: true, list, source: "live", updatedAt: new Date().toISOString() });
        return;
      }
    } catch {
      /* fallback */
    }

    res.json({
      ok: true,
      list: FALLBACK[platform] || [],
      source: "fallback",
      updatedAt: new Date().toISOString(),
      notice: "实时接口暂不可用，已显示缓存示例",
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
