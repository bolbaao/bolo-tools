/** Isaac64 解密（微信视频号前 128KB XOR），移植自 WechatSphDecrypt */

const ENCRYPT_LENGTH = 131072;

class RandCtx64 {
  constructor() {
    this.randCnt = 255;
    this.seed = new BigUint64Array(256);
    this.mm = new BigUint64Array(256);
    this.aa = 0n;
    this.bb = 0n;
    this.cc = 0n;
  }

  isaacRandom() {
    let result = this.seed[this.randCnt];
    if (this.randCnt === 0) {
      this.isaac64();
      this.randCnt = 255;
    } else {
      this.randCnt--;
    }
    return result;
  }

  isaac64() {
    this.cc = (this.cc + 1n) & 0xffffffffffffffffn;
    this.bb = (this.bb + this.cc) & 0xffffffffffffffffn;

    for (let i = 0; i < 256; i++) {
      switch (i % 4) {
        case 0:
          this.aa = (~(this.aa ^ (this.aa << 21n))) & 0xffffffffffffffffn;
          break;
        case 1:
          this.aa = (this.aa ^ (this.aa >> 5n)) & 0xffffffffffffffffn;
          break;
        case 2:
          this.aa = (this.aa ^ (this.aa << 12n)) & 0xffffffffffffffffn;
          break;
        case 3:
          this.aa = (this.aa ^ (this.aa >> 33n)) & 0xffffffffffffffffn;
          break;
      }

      this.aa = (this.aa + this.mm[(i + 128) % 256]) & 0xffffffffffffffffn;
      const x = this.mm[i];
      const y = (this.mm[Number((x >> 3n) & 0xffffffffn) % 256] + this.aa + this.bb) & 0xffffffffffffffffn;
      this.mm[i] = y;
      this.bb = (this.mm[Number((y >> 11n) & 0xffffffffn) % 256] + x) & 0xffffffffffffffffn;
      this.seed[i] = this.bb;
    }
  }
}

function mix(a, b, c, d, e, f, g, h) {
  a[0] = (a[0] - e[0]) & 0xffffffffffffffffn;
  f[0] = (f[0] ^ (h[0] >> 9n)) & 0xffffffffffffffffn;
  h[0] = (h[0] + a[0]) & 0xffffffffffffffffn;
  b[0] = (b[0] - f[0]) & 0xffffffffffffffffn;
  g[0] = (g[0] ^ (a[0] << 9n)) & 0xffffffffffffffffn;
  a[0] = (a[0] + b[0]) & 0xffffffffffffffffn;
  c[0] = (c[0] - g[0]) & 0xffffffffffffffffn;
  h[0] = (h[0] ^ (b[0] >> 23n)) & 0xffffffffffffffffn;
  b[0] = (b[0] + c[0]) & 0xffffffffffffffffn;
  d[0] = (d[0] - h[0]) & 0xffffffffffffffffn;
  a[0] = (a[0] ^ (c[0] << 15n)) & 0xffffffffffffffffn;
  c[0] = (c[0] + d[0]) & 0xffffffffffffffffn;
  e[0] = (e[0] - a[0]) & 0xffffffffffffffffn;
  b[0] = (b[0] ^ (d[0] >> 14n)) & 0xffffffffffffffffn;
  d[0] = (d[0] + e[0]) & 0xffffffffffffffffn;
  f[0] = (f[0] - b[0]) & 0xffffffffffffffffn;
  c[0] = (c[0] ^ (e[0] << 20n)) & 0xffffffffffffffffn;
  e[0] = (e[0] + f[0]) & 0xffffffffffffffffn;
  g[0] = (g[0] - c[0]) & 0xffffffffffffffffn;
  d[0] = (d[0] ^ (f[0] >> 17n)) & 0xffffffffffffffffn;
  f[0] = (f[0] + g[0]) & 0xffffffffffffffffn;
  h[0] = (h[0] - d[0]) & 0xffffffffffffffffn;
  e[0] = (e[0] ^ (g[0] << 14n)) & 0xffffffffffffffffn;
  g[0] = (g[0] + h[0]) & 0xffffffffffffffffn;
}

function createIsaacInst(encKey) {
  const ctx = new RandCtx64();
  const golden = 0x9e3779b97f4a7c13n;
  const a = [golden];
  const b = [golden];
  const c = [golden];
  const d = [golden];
  const e = [golden];
  const f = [golden];
  const g = [golden];
  const h = [golden];

  ctx.seed[0] = BigInt(encKey);

  for (let i = 0; i < 4; i++) {
    mix(a, b, c, d, e, f, g, h);
  }

  for (let i = 0; i < 256; i += 8) {
    a[0] = (a[0] + ctx.seed[i]) & 0xffffffffffffffffn;
    b[0] = (b[0] + ctx.seed[i + 1]) & 0xffffffffffffffffn;
    c[0] = (c[0] + ctx.seed[i + 2]) & 0xffffffffffffffffn;
    d[0] = (d[0] + ctx.seed[i + 3]) & 0xffffffffffffffffn;
    e[0] = (e[0] + ctx.seed[i + 4]) & 0xffffffffffffffffn;
    f[0] = (f[0] + ctx.seed[i + 5]) & 0xffffffffffffffffn;
    g[0] = (g[0] + ctx.seed[i + 6]) & 0xffffffffffffffffn;
    h[0] = (h[0] + ctx.seed[i + 7]) & 0xffffffffffffffffn;
    mix(a, b, c, d, e, f, g, h);
    ctx.mm[i] = a[0];
    ctx.mm[i + 1] = b[0];
    ctx.mm[i + 2] = c[0];
    ctx.mm[i + 3] = d[0];
    ctx.mm[i + 4] = e[0];
    ctx.mm[i + 5] = f[0];
    ctx.mm[i + 6] = g[0];
    ctx.mm[i + 7] = h[0];
  }

  for (let i = 0; i < 256; i += 8) {
    a[0] = (a[0] + ctx.mm[i]) & 0xffffffffffffffffn;
    b[0] = (b[0] + ctx.mm[i + 1]) & 0xffffffffffffffffn;
    c[0] = (c[0] + ctx.mm[i + 2]) & 0xffffffffffffffffn;
    d[0] = (d[0] + ctx.mm[i + 3]) & 0xffffffffffffffffn;
    e[0] = (e[0] + ctx.mm[i + 4]) & 0xffffffffffffffffn;
    f[0] = (f[0] + ctx.mm[i + 5]) & 0xffffffffffffffffn;
    g[0] = (g[0] + ctx.mm[i + 6]) & 0xffffffffffffffffn;
    h[0] = (h[0] + ctx.mm[i + 7]) & 0xffffffffffffffffn;
    mix(a, b, c, d, e, f, g, h);
    ctx.mm[i] = a[0];
    ctx.mm[i + 1] = b[0];
    ctx.mm[i + 2] = c[0];
    ctx.mm[i + 3] = d[0];
    ctx.mm[i + 4] = e[0];
    ctx.mm[i + 5] = f[0];
    ctx.mm[i + 6] = g[0];
    ctx.mm[i + 7] = h[0];
  }

  ctx.isaac64();
  return ctx;
}

/** 对 Buffer 前 encLen 字节 XOR 解密（原地修改） */
export function decryptWeixinVideo(data, decodeKey, encLen = ENCRYPT_LENGTH) {
  if (!data?.length || !decodeKey) return data;
  const key = BigInt(decodeKey);
  const len = Math.min(encLen, data.length);
  const inst = createIsaacInst(key);

  for (let i = 0; i < len; i += 8) {
    const rand = inst.isaacRandom();
    const temp = Buffer.alloc(8);
    temp.writeBigUInt64BE(rand);
    for (let j = 0; j < 8; j++) {
      const idx = i + j;
      if (idx >= len) return data;
      data[idx] ^= temp[j];
    }
  }
  return data;
}

export { ENCRYPT_LENGTH };
