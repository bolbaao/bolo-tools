import { bytesHasPrefix } from "./utils";

export const FLAC_HEADER = [0x66, 0x4c, 0x61, 0x43];
export const OGG_HEADER = [0x4f, 0x67, 0x67, 0x53];

const QMOggPublicHeader1 = [
  0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff,
  0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0x01, 0x1e, 0x01, 0x76, 0x6f, 0x72,
  0x62, 0x69, 0x73, 0x00, 0x00, 0x00, 0x00, 0x02, 0x44, 0xac, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0xee, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0xb8, 0x01, 0x4f, 0x67, 0x67, 0x53, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0x01, 0x00, 0x00, 0x00,
  0xff, 0xff, 0xff, 0xff,
];
const QMOggPublicHeader2 = [
  0x03, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73, 0x2c, 0x00, 0x00, 0x00, 0x58, 0x69, 0x70, 0x68, 0x2e,
  0x4f, 0x72, 0x67, 0x20, 0x6c, 0x69, 0x62, 0x56, 0x6f, 0x72, 0x62, 0x69, 0x73, 0x20, 0x49, 0x20,
  0x32, 0x30, 0x31, 0x35, 0x30, 0x31, 0x30, 0x35, 0x20, 0x28, 0xe2, 0x9b, 0x84, 0xe2, 0x9b, 0x84,
  0xe2, 0x9b, 0x84, 0xe2, 0x9b, 0x84, 0x29, 0xff, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0x54,
  0x49, 0x54, 0x4c, 0x45, 0x3d,
];
const QMOggPublicConf1 = [
  9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 0, 0, 0, 0, 9, 9, 9, 9, 0, 0, 0, 0, 9, 9, 9, 9, 9, 9,
  9, 9, 9, 9, 9, 9, 9, 6, 3, 3, 3, 3, 6, 6, 6, 6, 3, 3, 3, 3, 6, 6, 6, 6, 6, 9, 9, 9, 9, 9, 9, 9,
  9, 9, 9, 9, 9, 9, 9, 9, 0, 0, 0, 0, 9, 9, 9, 9, 0, 0, 0, 0,
];
const QMOggPublicConf2 = [
  3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
  3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 1, 3, 3, 0, 1, 3, 3, 3,
  3, 3, 3, 3, 3,
];
const QMCDefaultMaskMatrix = [
  0xde, 0x51, 0xfa, 0xc3, 0x4a, 0xd6, 0xca, 0x90, 0x7e, 0x67, 0x5e, 0xf7, 0xd5, 0x52, 0x84, 0xd8,
  0x47, 0x95, 0xbb, 0xa1, 0xaa, 0xc6, 0x66, 0x23, 0x92, 0x62, 0xf3, 0x74, 0xa1, 0x9f, 0xf4, 0xa0,
  0x1d, 0x3f, 0x5b, 0xf0, 0x13, 0x0e, 0x09, 0x3d, 0xf9, 0xbc, 0x00, 0x11,
];

const AllMapping: number[][] = [];
const Mask128to44: number[] = [];

(function initMapping() {
  for (let i = 0; i < 128; i++) {
    const realIdx = (i * i + 27) % 256;
    if (realIdx in AllMapping) AllMapping[realIdx]!.push(i);
    else AllMapping[realIdx] = [i];
  }
  let idx44 = 0;
  AllMapping.forEach((all128) => {
    all128.forEach((_i128) => {
      Mask128to44[_i128] = idx44;
    });
    idx44++;
  });
})();

export class QmcMask {
  private readonly Matrix128: number[];

  constructor(matrix: number[] | Uint8Array) {
    let values: number[];
    if (matrix instanceof Uint8Array) values = Array.from(matrix);
    else values = matrix;
    if (values.length === 44) this.Matrix128 = this.generate128(values);
    else if (values.length === 128) this.Matrix128 = values;
    else throw new Error("invalid mask length");
  }

  getMatrix128() {
    return this.Matrix128;
  }

  decrypt(data: Uint8Array) {
    const dst = data.slice();
    let index = -1;
    let maskIdx = -1;
    for (let cur = 0; cur < data.length; cur++) {
      index++;
      maskIdx++;
      if (index === 0x8000 || (index > 0x8000 && (index + 1) % 0x8000 === 0)) {
        index++;
        maskIdx++;
      }
      if (maskIdx >= 128) maskIdx -= 128;
      dst[cur]! ^= this.Matrix128[maskIdx]!;
    }
    return dst;
  }

  private generate128(matrix44: number[]): number[] {
    const matrix128: number[] = [];
    let idx44 = 0;
    AllMapping.forEach((it256) => {
      it256.forEach((m) => {
        matrix128[m] = matrix44[idx44]!;
      });
      idx44++;
    });
    return matrix128;
  }
}

export function qmcMaskGetDefault() {
  return new QmcMask(QMCDefaultMaskMatrix);
}

export function qmcMaskDetectMflac(data?: Uint8Array): QmcMask | undefined {
  if (!data) return undefined;
  const searchLen = Math.min(0x8000, data.length);
  for (let blockIdx = 0; blockIdx < searchLen; blockIdx += 128) {
    try {
      const mask = new QmcMask(data.slice(blockIdx, blockIdx + 128));
      if (bytesHasPrefix(mask.decrypt(data.slice(0, FLAC_HEADER.length)), FLAC_HEADER)) {
        return mask;
      }
    } catch {
      // try next block
    }
  }
  return undefined;
}

export function qmcMaskDetectMgg(data?: Uint8Array): QmcMask | undefined {
  if (!data || data.length < 0x100) return undefined;
  const matrixConfidence: Record<number, Record<number, number>> = {};
  for (let i = 0; i < 44; i++) matrixConfidence[i] = {};

  const page2 = data[0x54]! ^ data[0xc]! ^ QMOggPublicHeader1[0xc]!;
  const spHeader = qmcGenerateOggHeader(page2);
  const spConf = qmcGenerateOggConf(page2);

  for (let idx128 = 0; idx128 < spHeader.length; idx128++) {
    if (spConf[idx128] === 0) continue;
    const idx44 = Mask128to44[idx128 % 128]!;
    const maskByte = data[idx128]! ^ spHeader[idx128]!;
    const confidence = spConf[idx128]!;
    matrixConfidence[idx44]![maskByte] = (matrixConfidence[idx44]![maskByte] ?? 0) + confidence;
  }

  const matrix: number[] = [];
  try {
    for (let i = 0; i < 44; i++) matrix[i] = calcMaskFromConfidence(matrixConfidence[i]!);
  } catch {
    return undefined;
  }

  const mask = new QmcMask(matrix);
  if (bytesHasPrefix(mask.decrypt(data.slice(0, OGG_HEADER.length)), OGG_HEADER)) {
    return mask;
  }
  return undefined;
}

function calcMaskFromConfidence(confidence: Record<number, number>) {
  const keys = Object.keys(confidence);
  if (keys.length === 0) throw new Error("can not match at least one key");
  let result = 0;
  let conf = 0;
  for (const idx of keys) {
    const value = confidence[Number(idx)]!;
    if (value > conf) {
      result = Number(idx);
      conf = value;
    }
  }
  return result;
}

function qmcGenerateOggHeader(page2: number) {
  const spec = [page2, 0xff];
  for (let i = 2; i < page2; i++) spec.push(0xff);
  spec.push(0xff);
  return QMOggPublicHeader1.concat(spec, QMOggPublicHeader2);
}

function qmcGenerateOggConf(page2: number) {
  const specConf = [6, 0];
  for (let i = 2; i < page2; i++) specConf.push(4);
  specConf.push(0);
  return QMOggPublicConf1.concat(specConf, QMOggPublicConf2);
}
