/** 将 SRT 时间戳整体平移（秒，可为负） */
export function shiftSrt(content: string, offsetSec: number): string {
  if (!offsetSec) return content;
  return content.replace(
    /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/g,
    (_m, h1, m1, s1, ms1, h2, m2, s2, ms2) => {
      const a = shiftStamp(h1, m1, s1, ms1, offsetSec);
      const b = shiftStamp(h2, m2, s2, ms2, offsetSec);
      return `${a} --> ${b}`;
    },
  );
}

function shiftStamp(h: string, m: string, s: string, ms: string, offsetSec: number) {
  let totalMs =
    (parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10)) * 1000 +
    parseInt(ms, 10);
  totalMs = Math.max(0, totalMs + Math.round(offsetSec * 1000));
  const hh = Math.floor(totalMs / 3600000);
  const mm = Math.floor((totalMs % 3600000) / 60000);
  const ss = Math.floor((totalMs % 60000) / 1000);
  const mss = totalMs % 1000;
  return `${pad(hh)}:${pad(mm)}:${pad(ss)},${String(mss).padStart(3, "0")}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** 从 SRT 提取纯文本（去掉序号与时间轴） */
export function srtToPlainText(srt: string): string {
  return srt
    .trim()
    .replace(/\r\n/g, "\n")
    .split(/\n\n+/)
    .map((block) => {
      const lines = block.split("\n").filter((l) => l.trim());
      if (lines.length <= 1) return "";
      const textLines = lines.slice(1).filter((l) => !/-->/.test(l));
      return textLines.join(" ");
    })
    .filter(Boolean)
    .join("\n");
}

export function srtToVtt(srt: string): string {
  const body = srt
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, "$1:$2:$3.$4");
  return `WEBVTT\n\n${body}`;
}
