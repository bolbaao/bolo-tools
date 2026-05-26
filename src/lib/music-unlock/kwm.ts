import {
  AudioMimeType,
  bytesHasPrefix,
  getMetaFromFilename,
  readArrayBuffer,
  safeDownloadName,
  sniffAudioExt,
} from "./utils";
import type { UnlockResult } from "./types";

const MAGIC_HEADER = [
  0x79, 0x65, 0x65, 0x6c, 0x69, 0x6f, 0x6e, 0x2d, 0x6b, 0x75, 0x77, 0x6f, 0x2d, 0x74, 0x6d, 0x65,
];
const PRE_DEFINED_KEY = "MoOtOiTvINGwd2E6n0E1i7L5t2IoOoNk";

function createMaskFromKey(keyBytes: Uint8Array): Uint8Array {
  const keyView = new DataView(keyBytes.buffer, keyBytes.byteOffset, keyBytes.byteLength);
  let keyStr = keyView.getBigUint64(0, true).toString();
  if (keyStr.length > 32) keyStr = keyStr.slice(0, 32);
  else if (keyStr.length < 32) keyStr = keyStr.padEnd(32, keyStr);

  const key = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    key[i] = PRE_DEFINED_KEY.charCodeAt(i) ^ keyStr.charCodeAt(i);
  }
  return key;
}

export async function decryptKwm(file: File): Promise<UnlockResult> {
  const oriData = new Uint8Array(await readArrayBuffer(file));
  if (!bytesHasPrefix(oriData, MAGIC_HEADER)) {
    throw new Error("不是有效的 KWM 文件");
  }

  const fileKey = oriData.slice(0x18, 0x20);
  const mask = createMaskFromKey(fileKey);
  const audioData = oriData.slice(0x400);
  for (let cur = 0; cur < audioData.length; ++cur) {
    audioData[cur]! ^= mask[cur % 0x20]!;
  }

  const ext = sniffAudioExt(audioData);
  const mime = AudioMimeType[ext] ?? "application/octet-stream";
  const { title, artist } = getMetaFromFilename(file.name);
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
