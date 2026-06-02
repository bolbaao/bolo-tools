import { Router } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { HttpError, sendError } from "../lib/http-error.mjs";
import { assertPublicHttpUrlResolved } from "../lib/url-guard.mjs";

const router = Router();
const MAX_ITEMS = 50;

function splitSelectors(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function pickListNodes($, listSelectors) {
  for (const sel of listSelectors) {
    const nodes = $(sel);
    if (nodes.length > 0) return { nodes, matchedSelector: sel };
  }
  return { nodes: null, matchedSelector: null };
}

function extractItemText($, el, itemSelectors) {
  for (const sel of itemSelectors) {
    const text = $(el).find(sel).first().text().trim();
    if (text) return text;
  }
  return $(el).text().trim();
}

router.post("/run", async (req, res) => {
  try {
    const { url, listSelector, itemSelector, limit = 30 } = req.body ?? {};
    if (!url?.trim()) throw new HttpError(400, "请提供目标网址");
    const safeUrl = await assertPublicHttpUrlResolved(url.trim());
    const listSelectors = splitSelectors(listSelector);
    const itemSelectors = splitSelectors(itemSelector);
    if (!listSelectors.length || !itemSelectors.length) {
      throw new HttpError(400, "请填写列表与字段选择器");
    }

    const { data: html } = await axios.get(safeUrl, {
      timeout: 15000,
      maxContentLength: 2 * 1024 * 1024,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PineappleToolbox/1.0; +https://github.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      responseType: "text",
    });

    const $ = cheerio.load(html);
    const pageTitle = $("title").first().text().trim() || safeUrl;
    const cap = Math.min(Math.max(Number(limit) || 30, 1), MAX_ITEMS);
    const { nodes, matchedSelector } = pickListNodes($, listSelectors);

    const items = [];
    if (nodes) {
      nodes.each((_, el) => {
        if (items.length >= cap) return false;
        const text = extractItemText($, el, itemSelectors);
        const href = $(el).find("a").first().attr("href") || "";
        if (!text) return;
        let link = "";
        if (href.startsWith("http")) link = href;
        else if (href) {
          try {
            link = new URL(href, safeUrl).href;
          } catch {
            link = href;
          }
        }
        items.push({
          title: text.slice(0, 500),
          link,
        });
      });
    }

    res.json({
      ok: true,
      count: items.length,
      items,
      pageTitle,
      matchedSelector,
      listCandidates: listSelectors.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/generate", (req, res) => {
  const { url, listSelector, itemSelector } = req.body ?? {};
  const code = `const axios = require('axios');
const cheerio = require('cheerio');

async function crawl() {
  const url = ${JSON.stringify(url || "https://example.com")};
  const res = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000,
  });
  const $ = cheerio.load(res.data);
  const items = [];
  $('${String(listSelector || ".item").replace(/'/g, "\\'")}').each((i, el) => {
    const title = $(el).find('${String(itemSelector || ".title").replace(/'/g, "\\'")}').first().text().trim();
    const link = $(el).find('a').first().attr('href') || '';
    if (title) items.push({ title, link });
  });
  return items;
}

module.exports = { crawl };`;
  res.json({ ok: true, code });
});

export default router;
