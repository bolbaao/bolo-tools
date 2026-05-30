import * as OpenCC from "opencc-js";

const converter = OpenCC.Converter({ from: "t", to: "cn" });

/** 将转写结果中的繁体中文转为简体（英文等其它字符保持不变） */
export function toSimplifiedChinese(text) {
  if (!text || typeof text !== "string") return text;
  if (!/[\u4e00-\u9fff]/.test(text)) return text;
  try {
    return converter(text);
  } catch {
    return text;
  }
}
