import AES from "crypto-js/aes";
import PKCS7 from "crypto-js/pad-pkcs7";
import ModeECB from "crypto-js/mode-ecb";
import WordArray from "crypto-js/lib-typedarrays";
import Base64 from "crypto-js/enc-base64";
import EncUTF8 from "crypto-js/enc-utf8";
import EncHex from "crypto-js/enc-hex";
import {
  AudioMimeType,
  bytesHasPrefix,
  getMetaFromFilename,
  safeDownloadName,
  sniffAudioExt,
} from "./utils";
import type { UnlockResult } from "./types";

const CORE_KEY = EncHex.parse("687a4852416d736f356b496e62617857");
const META_KEY = EncHex.parse("2331346C6A6B5F215C5D2630553C2728");
const MAGIC_HEADER = [0x43, 0x54, 0x45, 0x4e, 0x46, 0x44, 0x41, 0x4d];

type NcmMusicMeta = {
  musicName?: string;
  artist?: string[][];
  format?: string;
  album?: string;
};

function wordArrayToUint8(plainText: WordArray): Uint8Array {
  const result = new Uint8Array(plainText.sigBytes);
  const words = plainText.words;
  for (let i = 0; i < plainText.sigBytes; i++) {
    result[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }
  return result;
}

function aesDecryptEcb(cipherBytes: Uint8Array, key: WordArray): Uint8Array {
  const plainText = AES.decrypt(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { ciphertext: WordArray.create(cipherBytes) } as any,
    key,
    { mode: ModeECB, padding: PKCS7 },
  );
  return wordArrayToUint8(plainText).slice(17);
}

class NcmDecrypt {
  raw: ArrayBuffer;
  view: DataView;
  offset = 0;
  filename: string;
  oriMeta: NcmMusicMeta = {};

  constructor(buf: ArrayBuffer, filename: string) {
    const prefix = new Uint8Array(buf, 0, 8);
    if (!bytesHasPrefix(prefix, MAGIC_HEADER)) throw new Error("不是有效的 NCM 文件");
    this.offset = 10;
    this.raw = buf;
    this.view = new DataView(buf);
    this.filename = filename;
  }

  getKeyBox(): Uint8Array {
    const keyLen = this.view.getUint32(this.offset, true);
    this.offset += 4;
    const cipherText = new Uint8Array(this.raw, this.offset, keyLen).map((b) => b ^ 0x64);
    this.offset += keyLen;
    const keyData = aesDecryptEcb(cipherText, CORE_KEY);

    const box = new Uint8Array(Array.from({ length: 256 }, (_, i) => i));
    const keyDataLen = keyData.length;
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (box[i]! + j + keyData[i % keyDataLen]!)! & 0xff;
      [box[i], box[j]] = [box[j]!, box[i]!];
    }
    return box.map((_, i, arr) => {
      i = (i + 1) & 0xff;
      const si = arr[i]!;
      const sj = arr[(i + si) & 0xff]!;
      return arr[(si + sj) & 0xff]!;
    });
  }

  getMetaData(): NcmMusicMeta {
    const metaDataLen = this.view.getUint32(this.offset, true);
    this.offset += 4;
    if (metaDataLen === 0) return {};

    const cipherText = new Uint8Array(this.raw, this.offset, metaDataLen).map((b) => b ^ 0x63);
    this.offset += metaDataLen;

    const plainText = AES.decrypt(
      {
        ciphertext: Base64.parse(WordArray.create(cipherText.slice(22)).toString(EncUTF8)),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      META_KEY,
      { mode: ModeECB, padding: PKCS7 },
    ).toString(EncUTF8);

    const labelIndex = plainText.indexOf(":");
    const label = plainText.slice(0, labelIndex);
    const json = plainText.slice(labelIndex + 1);
    if (label === "dj") {
      const tmp = JSON.parse(json) as { mainMusic: NcmMusicMeta };
      return tmp.mainMusic;
    }
    return JSON.parse(json) as NcmMusicMeta;
  }

  getAudio(keyBox: Uint8Array): Uint8Array {
    this.offset += this.view.getUint32(this.offset + 5, true) + 13;
    const audioData = new Uint8Array(this.raw, this.offset);
    for (let cur = 0; cur < audioData.length; ++cur) {
      audioData[cur]! ^= keyBox[cur & 0xff]!;
    }
    return audioData;
  }

  decrypt(): UnlockResult {
    const keyBox = this.getKeyBox();
    this.oriMeta = this.getMetaData();
    const audio = this.getAudio(keyBox);
    const ext = this.oriMeta.format || sniffAudioExt(audio);
    const mime = AudioMimeType[ext] ?? "application/octet-stream";

    const artists = (this.oriMeta.artist ?? []).map((a) => a[0]).filter(Boolean).join("; ");
    const fromFile = getMetaFromFilename(this.filename);
    const title = this.oriMeta.musicName || fromFile.title || "未知曲目";
    const artist = artists || fromFile.artist;

    const blob = new Blob([new Uint8Array(audio)], { type: mime });
    return {
      blob,
      filename: safeDownloadName(title, artist, ext),
      title,
      artist,
      album: this.oriMeta.album,
      ext,
      mime,
    };
  }
}

export async function decryptNcm(file: File): Promise<UnlockResult> {
  const buf = await file.arrayBuffer();
  return new NcmDecrypt(buf, file.name).decrypt();
}
