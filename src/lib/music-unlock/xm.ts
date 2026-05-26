import { AudioMimeType, bytesHasPrefix, getMetaFromFilename, readArrayBuffer, safeDownloadName } from "./utils";
import type { UnlockResult } from "./types";

const MAGIC_HEADER = [0x69, 0x66, 0x6d, 0x74];
const MAGIC_HEADER2 = [0xfe, 0xfe, 0xfe, 0xfe];
const FILE_TYPE_MAP: Record<string, string> = {
  " WAV": "wav",
  FLAC: "flac",
  " MP3": "mp3",
  " A4M": "m4a",
};

export async function decryptXm(file: File): Promise<UnlockResult> {
  const oriData = new Uint8Array(await readArrayBuffer(file));
  if (!bytesHasPrefix(oriData, MAGIC_HEADER) || !bytesHasPrefix(oriData.slice(8, 12), MAGIC_HEADER2)) {
    throw new Error("不是有效的 XM 文件");
  }

  const typeText = new TextDecoder().decode(oriData.slice(4, 8));
  const ext = FILE_TYPE_MAP[typeText];
  if (!ext) throw new Error("未知的 XM 文件类型");

  const key = oriData[0xf]!;
  const dataOffset = oriData[0xc]! | (oriData[0xd]! << 8) | (oriData[0xe]! << 16);
  const audioData = oriData.slice(0x10);
  for (let cur = dataOffset; cur < audioData.length; ++cur) {
    audioData[cur] = (audioData[cur]! - key) ^ 0xff;
  }

  const mime = AudioMimeType[ext] ?? "application/octet-stream";
  const sep = file.name.includes("_") ? "_" : "-";
  const { title, artist } = getMetaFromFilename(file.name, undefined, undefined, sep);
  const blob = new Blob([audioData], { type: mime });

  return {
    blob,
    filename: safeDownloadName(title, artist, ext),
    title,
    artist,
    ext,
    mime,
  };
}
