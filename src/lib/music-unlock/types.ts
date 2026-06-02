export type UnlockResult = {
  blob: Blob;
  filename: string;
  title: string;
  artist?: string;
  album?: string;
  ext: string;
  mime: string;
};

export type EncryptedFormat = "ncm" | "kgm" | "vpr" | "kwm" | "xm" | "qmc";

export const ENCRYPTED_EXTENSIONS: Record<string, EncryptedFormat> = {
  ncm: "ncm",
  kgm: "kgm",
  vpr: "vpr",
  kwm: "kwm",
  xm: "xm",
  qmc0: "qmc",
  qmc2: "qmc",
  qmc3: "qmc",
  qmcflac: "qmc",
  qmcogg: "qmc",
  mflac: "qmc",
  mflac0: "qmc",
  mgg: "qmc",
  mgg1: "qmc",
  mggl: "qmc",
  tkm: "qmc",
  tkms: "qmc",
  bkcmp3: "qmc",
  bkcflac: "qmc",
  "666c6163": "qmc",
  "6d7033": "qmc",
  "6f6767": "qmc",
  "6d3461": "qmc",
  "776176": "qmc",
};

export const FORMAT_LABELS: Record<EncryptedFormat, string> = {
  ncm: "网易云 NCM",
  kgm: "酷狗 KGM",
  vpr: "酷狗 VPR",
  kwm: "酷我 KWM",
  xm: "虾米 XM",
  qmc: "QQ 音乐 QMC",
};
