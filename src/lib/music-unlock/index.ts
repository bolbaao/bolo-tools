import { decryptNcm } from "./ncm";
import { decryptKgm } from "./kgm";
import { decryptKwm } from "./kwm";
import { decryptXm } from "./xm";
import { decryptQmc } from "./qmc";
import {
  ENCRYPTED_EXTENSIONS,
  FORMAT_LABELS,
  type EncryptedFormat,
  type UnlockResult,
} from "./types";

export type { UnlockResult, EncryptedFormat };
export { ENCRYPTED_EXTENSIONS, FORMAT_LABELS };

export function detectEncryptedFormat(filename: string): EncryptedFormat | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ENCRYPTED_EXTENSIONS[ext] ?? null;
}

export function isEncryptedMusicFile(file: File): boolean {
  return detectEncryptedFormat(file.name) !== null;
}

export const ENCRYPTED_ACCEPT =
  ".ncm,.kgm,.vpr,.kwm,.xm,.qmc0,.qmc2,.qmc3,.qmcflac,.qmcogg,.mflac,.mflac0,.mgg,.mgg1,.mggl,.tkm,.tkms";

export async function unlockMusicFile(file: File): Promise<UnlockResult> {
  const format = detectEncryptedFormat(file.name);
  if (!format) {
    throw new Error("不支持的加密格式，请使用 .ncm / .kgm / .kwm / .xm / .qmc / .mflac 等文件");
  }

  switch (format) {
    case "ncm":
      return decryptNcm(file);
    case "kgm":
    case "vpr":
      return decryptKgm(file, format);
    case "kwm":
      return decryptKwm(file);
    case "xm":
      return decryptXm(file);
    case "qmc":
      return decryptQmc(file);
    default:
      throw new Error(`暂不支持 ${FORMAT_LABELS[format]}`);
  }
}
