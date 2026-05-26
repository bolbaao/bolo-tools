export type UnlockResult = {
  blob: Blob;
  filename: string;
  title: string;
  artist?: string;
  album?: string;
  ext: string;
  mime: string;
};

export type EncryptedFormat = "ncm" | "kgm" | "vpr" | "kwm" | "xm";

export const ENCRYPTED_EXTENSIONS: Record<string, EncryptedFormat> = {
  ncm: "ncm",
  kgm: "kgm",
  vpr: "vpr",
  kwm: "kwm",
  xm: "xm",
};

export const FORMAT_LABELS: Record<EncryptedFormat, string> = {
  ncm: "网易云 NCM",
  kgm: "酷狗 KGM",
  vpr: "酷狗 VPR",
  kwm: "酷我 KWM",
  xm: "虾米 XM",
};
