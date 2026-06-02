import {
  AudioMimeType,
  getMetaFromFilename,
  readArrayBuffer,
  safeDownloadName,
  sniffAudioExt,
} from "./utils";
import {
  QmcMask,
  qmcMaskDetectMflac,
  qmcMaskDetectMgg,
  qmcMaskGetDefault,
} from "./qmc-mask";
import type { UnlockResult } from "./types";

const QMC_KEY_API = "https://stats.ixarea.com/apis/qmcmask/query";

type QmcHandler = {
  ext: string;
  detect: boolean;
  handler: (data?: Uint8Array) => QmcMask | undefined;
};

const HANDLER_MAP: Record<string, QmcHandler> = {
  mgg: { handler: qmcMaskDetectMgg, ext: "ogg", detect: true },
  mflac: { handler: qmcMaskDetectMflac, ext: "flac", detect: true },
  "mgg.cache": { handler: qmcMaskDetectMgg, ext: "ogg", detect: false },
  "mflac.cache": { handler: qmcMaskDetectMflac, ext: "flac", detect: false },
  qmc0: { handler: qmcMaskGetDefault, ext: "mp3", detect: false },
  qmc2: { handler: qmcMaskGetDefault, ext: "ogg", detect: false },
  qmc3: { handler: qmcMaskGetDefault, ext: "mp3", detect: false },
  qmcogg: { handler: qmcMaskGetDefault, ext: "ogg", detect: false },
  qmcflac: { handler: qmcMaskGetDefault, ext: "flac", detect: false },
  mflac0: { handler: qmcMaskDetectMflac, ext: "flac", detect: true },
  mgg1: { handler: qmcMaskDetectMgg, ext: "ogg", detect: true },
  mggl: { handler: qmcMaskDetectMgg, ext: "ogg", detect: true },
  bkcmp3: { handler: qmcMaskGetDefault, ext: "mp3", detect: false },
  bkcflac: { handler: qmcMaskGetDefault, ext: "flac", detect: false },
  tkm: { handler: qmcMaskGetDefault, ext: "m4a", detect: false },
  tkms: { handler: qmcMaskGetDefault, ext: "m4a", detect: false },
  "666c6163": { handler: qmcMaskGetDefault, ext: "flac", detect: false },
  "6d7033": { handler: qmcMaskGetDefault, ext: "mp3", detect: false },
  "6f6767": { handler: qmcMaskGetDefault, ext: "ogg", detect: false },
  "6d3461": { handler: qmcMaskGetDefault, ext: "m4a", detect: false },
  "776176": { handler: qmcMaskGetDefault, ext: "wav", detect: false },
};

function fileExt(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 2) return "";
  return parts.pop()!.toLowerCase();
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function queryQmcKey(
  keyData: Uint8Array,
  filename: string,
  format: string,
): Promise<QmcMask | undefined> {
  try {
    const resp = await fetch(QMC_KEY_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Format: format,
        Key: uint8ToBase64(keyData),
        Filename: filename,
        Type: 44,
      }),
    });
    if (!resp.ok) return undefined;
    const data = (await resp.json()) as { Matrix44?: string };
    if (!data.Matrix44) return undefined;
    return new QmcMask(base64ToUint8(data.Matrix44));
  } catch {
    return undefined;
  }
}

export async function decryptQmc(file: File): Promise<UnlockResult> {
  const rawExt = fileExt(file.name);
  const handler = HANDLER_MAP[rawExt];
  if (!handler) throw new Error(`不支持的 QQ 音乐格式：.${rawExt}`);

  const fileData = new Uint8Array(await readArrayBuffer(file));
  let audioData: Uint8Array;
  let seed: QmcMask | undefined;

  if (handler.detect) {
    const keyLen = new DataView(fileData.slice(fileData.length - 4).buffer).getUint32(0, true);
    const keyPos = fileData.length - 4 - keyLen;
    if (keyPos < 0 || keyLen <= 0) {
      throw new Error("QQ 音乐文件结构无效，可能为新版 QMC2 加密格式");
    }
    audioData = fileData.slice(0, keyPos);
    const keyData = fileData.slice(keyPos, keyPos + keyLen);
    seed = handler.handler(audioData);
    if (!seed) seed = await queryQmcKey(keyData, file.name, rawExt);
    if (!seed) {
      throw new Error("无法识别 QQ 音乐解密密钥，请确认文件来自 QQ 音乐客户端下载");
    }
  } else {
    audioData = fileData;
    seed = handler.handler(audioData) ?? qmcMaskGetDefault();
  }

  const decoded = seed.decrypt(audioData);
  const ext = sniffAudioExt(decoded, handler.ext);
  const mime = AudioMimeType[ext] ?? "application/octet-stream";
  const { title, artist } = getMetaFromFilename(file.name);
  const blob = new Blob([decoded], { type: mime });

  return {
    blob,
    filename: safeDownloadName(title, artist, ext),
    title,
    artist,
    ext,
    mime,
  };
}
