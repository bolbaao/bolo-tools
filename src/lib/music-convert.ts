import { ApiError, apiUpload } from "@/lib/api";
import { detectEncryptedFormat, unlockMusicFile } from "@/lib/music-unlock";

export const OUTPUT_FORMATS = ["MP3", "WAV", "FLAC", "AAC", "OGG"] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export const FORMAT_HINTS: Record<OutputFormat, string> = {
  MP3: "通用兼容",
  WAV: "无损 PCM",
  FLAC: "无损压缩",
  AAC: "体积更小",
  OGG: "开源格式",
};

const AUDIO_EXT = new Set([
  "mp3",
  "wav",
  "flac",
  "aac",
  "ogg",
  "m4a",
  "wma",
  "opus",
  "aiff",
  "aif",
]);

export type MusicKind = "encrypted" | "audio";

export type MusicProcessResult = { blob: Blob; filename: string };

export function classifyMusicFile(file: File): MusicKind | null {
  if (detectEncryptedFormat(file.name)) return "encrypted";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (AUDIO_EXT.has(ext) || file.type.startsWith("audio/")) return "audio";
  return null;
}

export function extMatchesTarget(filename: string, targetFormat: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const target = targetFormat.toLowerCase();
  return ext === target || (ext === "mpeg" && target === "mp3");
}

export function outputFilename(baseName: string, format: string): string {
  const base = baseName.replace(/\.[^.]+$/, "");
  return `${base}.${format.toLowerCase()}`;
}

async function convertWithFfmpeg(
  source: Blob,
  sourceName: string,
  format: string,
): Promise<Blob> {
  const fd = new FormData();
  fd.append("file", source, sourceName);
  fd.append("format", format);
  const blob = await apiUpload<Blob>("/api/audio/convert", fd);
  if (!(blob instanceof Blob)) throw new Error("转换失败");
  return blob;
}

export async function processMusicFile(
  file: File,
  kind: MusicKind,
  targetFormat: string,
): Promise<MusicProcessResult> {
  if (kind === "encrypted") {
    const unlocked = await unlockMusicFile(file);
    let blob = unlocked.blob;
    let name = unlocked.filename;
    if (!extMatchesTarget(name, targetFormat)) {
      blob = await convertWithFfmpeg(blob, name, targetFormat);
      name = outputFilename(name, targetFormat);
    }
    return { blob, filename: name };
  }

  if (extMatchesTarget(file.name, targetFormat)) {
    return { blob: file, filename: file.name };
  }

  const blob = await convertWithFfmpeg(file, file.name, targetFormat);
  return { blob, filename: outputFilename(file.name, targetFormat) };
}

export function toProcessError(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "处理失败";
}

export async function buildMusicZip(
  files: { blob: Blob; filename: string }[],
): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const used = new Set<string>();

  for (const { blob, filename } of files) {
    let name = filename;
    let n = 1;
    while (used.has(name)) {
      const dot = filename.lastIndexOf(".");
      const base = dot > 0 ? filename.slice(0, dot) : filename;
      const ext = dot > 0 ? filename.slice(dot) : "";
      name = `${base} (${n})${ext}`;
      n += 1;
    }
    used.add(name);
    zip.file(name, blob);
  }

  return zip.generateAsync({ type: "blob" });
}
