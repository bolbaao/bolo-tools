import axios from "axios";
import * as cheerio from "cheerio";
import { HttpError } from "./http-error.mjs";
import { assertPublicHttpUrlResolved } from "./url-guard.mjs";

const MAX_ITEMS = 50;

export const SPIDER_PRESETS = {
  headlines: {
    listSelector: "article, li, .item, .story, tr",
    itemSelector: "h2, h3, h4, .title, a",
  },
  links: {
    listSelector: "body",
    itemSelector: "a",
  },
  quotes: {
    listSelector: ".quote, li, .item, .product, div.quote",
    itemSelector: ".text, span, p, a",
  },
  cards: {
    listSelector: ".card, .box, section, .product, .post",
    itemSelector: "h2, h3, .name, .heading, a",
  },
};

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

/**
 * @param {{ url: string, listSelector?: string, itemSelector?: string, preset?: string, limit?: number }} opts
 */
export async function runSpider(opts) {
  const url = String(opts.url || "").trim();
  if (!url) throw new HttpError(400, "请提供目标网址");

  const preset = opts.preset && SPIDER_PRESETS[opts.preset];
  const listSelector = opts.listSelector || preset?.listSelector || "article, li";
  const itemSelector = opts.itemSelector || preset?.itemSelector || "a, h2, h3";

  const safeUrl = await assertPublicHttpUrlResolved(url);
  const listSelectors = splitSelectors(listSelector);
  const itemSelectors = splitSelectors(itemSelector);
  if (!listSelectors.length || !itemSelectors.length) {
    throw new HttpError(400, "请填写列表与字段选择器");
  }

  const { data: html } = await axios.get(safeUrl, {
    timeout: 15000,
    maxContentLength: 2 * 1024 * 1024,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PineappleToolbox/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
    responseType: "text",
  });

  const $ = cheerio.load(html);
  const pageTitle = $("title").first().text().trim() || safeUrl;
  const cap = Math.min(Math.max(Number(opts.limit) || 30, 1), MAX_ITEMS);
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
      items.push({ title: text.slice(0, 500), link });
    });
  }

  return { count: items.length, items, pageTitle, matchedSelector, url: safeUrl };
}
