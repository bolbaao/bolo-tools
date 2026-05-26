export const AudioMimeType: Record<string, string> = {
  mp3: "audio/mpeg",
  flac: "audio/flac",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  wma: "audio/x-ms-wma",
  wav: "audio/wav",
  aac: "audio/aac",
};

const FLAC_HEADER = [0x66, 0x4c, 0x61, 0x43];
const MP3_HEADER = [0x49, 0x44, 0x33];
const OGG_HEADER = [0x4f, 0x67, 0x67, 0x53];
const M4A_HEADER = [0x66, 0x74, 0x79, 0x70];
const WAV_HEADER = [0x52, 0x49, 0x46, 0x46];
const AAC_HEADER = [0xff, 0xf1];

export function bytesHasPrefix(data: Uint8Array, prefix: number[]): boolean {
  if (prefix.length > data.length) return false;
  return prefix.every((val, idx) => val === data[idx]);
}

export function sniffAudioExt(data: Uint8Array, fallback = "mp3"): string {
  if (bytesHasPrefix(data, MP3_HEADER)) return "mp3";
  if (bytesHasPrefix(data, FLAC_HEADER)) return "flac";
  if (bytesHasPrefix(data, OGG_HEADER)) return "ogg";
  if (data.length >= 8 && bytesHasPrefix(data.slice(4), M4A_HEADER)) return "m4a";
  if (bytesHasPrefix(data, WAV_HEADER)) return "wav";
  if (bytesHasPrefix(data, AAC_HEADER)) return "aac";
  return fallback;
}

export async function readArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  if (file.arrayBuffer) return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const rs = reader.result;
      if (rs instanceof ArrayBuffer) resolve(rs);
      else reject(new Error("读取文件失败"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("读取文件失败"));
    reader.readAsArrayBuffer(file);
  });
}

export function getMetaFromFilename(
  filename: string,
  existTitle?: string,
  existArtist?: string,
  separator = "-",
): { title: string; artist?: string } {
  const meta = { title: existTitle ?? "", artist: existArtist };
  const base = filename.replace(/\.[^.]+$/, "");
  const items = base.split(separator);
  if (items.length > 1) {
    if (!meta.artist) meta.artist = items[0].trim();
    if (!meta.title) meta.title = items.slice(1).join(separator).trim();
  } else if (!meta.title) {
    meta.title = base.trim();
  }
  return meta;
}

export function safeDownloadName(title: string, artist: string | undefined, ext: string): string {
  const part = artist ? `${artist} - ${title}` : title;
  const safe = part.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || "music";
  return `${safe}.${ext}`;
}
