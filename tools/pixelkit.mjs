// Tiny dependency-free pixel toolkit for the sprite pipeline: an RGBA buffer,
// the dithering / shading helpers the generators share, and a PNG encoder built
// on node:zlib.
import { deflateSync } from 'node:zlib';

const RGBA = new Map();
export function rgba(hex) {
  let c = RGBA.get(hex);
  if (!c) {
    const n = parseInt(hex.slice(1, 7), 16);
    const a = hex.length > 7 ? parseInt(hex.slice(7, 9), 16) : 255;
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
    RGBA.set(hex, c);
  }
  return c;
}

export class PixelBuffer {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  alpha(x, y) {
    return this.inside(x, y) ? this.data[(y * this.w + x) * 4 + 3] : 0;
  }

  set(x, y, color) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!color || !this.inside(x, y)) return;
    const [r, g, b, a] = rgba(color);
    const i = (y * this.w + x) * 4;
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = a;
  }

  rect(x, y, w, h, color) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, color);
  }

  // Copies every opaque pixel of src onto this buffer at (dx, dy).
  blit(src, dx, dy) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const s = (y * src.w + x) * 4;
        if (!src.data[s + 3] || !this.inside(dx + x, dy + y)) continue;
        const d = ((dy + y) * this.w + dx + x) * 4;
        this.data.set(src.data.subarray(s, s + 4), d);
      }
    }
    return this;
  }

  padded(p) {
    return new PixelBuffer(this.w + p * 2, this.h + p * 2).blit(this, p, p);
  }

  // Sprite outline: every empty pixel touching an opaque one (4-way). With
  // color 'auto' it is a selective outline ("selout"): each outline pixel is a
  // dark shade of the pixel it borders instead of one flat ink colour.
  outline(color) {
    const hit = [];
    const nb = [[0, 1], [1, 0], [-1, 0], [0, -1]];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alpha(x, y)) continue;
        const n = nb.find(([dx, dy]) => this.alpha(x + dx, y + dy));
        if (n) hit.push([x, y, x + n[0], y + n[1]]);
      }
    }
    for (const [x, y, nx, ny] of hit) {
      if (color !== 'auto') {
        this.set(x, y, color);
        continue;
      }
      const s = (ny * this.w + nx) * 4;
      const i = (y * this.w + x) * 4;
      const d = this.data;
      d[i] = Math.round(d[s] * 0.3 + 7 * 0.7);
      d[i + 1] = Math.round(d[s + 1] * 0.3 + 11 * 0.7);
      d[i + 2] = Math.round(d[s + 2] * 0.3 + 20 * 0.7);
      d[i + 3] = 255;
    }
    return this;
  }

  scaled(n) {
    const out = new PixelBuffer(this.w * n, this.h * n);
    for (let y = 0; y < out.h; y++) {
      for (let x = 0; x < out.w; x++) {
        const s = (((y / n) | 0) * this.w + ((x / n) | 0)) * 4;
        out.data.set(this.data.subarray(s, s + 4), (y * out.w + x) * 4);
      }
    }
    return out;
  }
}

// Paints a w×h buffer from fn(x, y) -> '#rrggbb' | null.
export function paint(w, h, fn) {
  const b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b.set(x, y, fn(x, y));
  return b;
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x, y) => BAYER4[(y & 3) * 4 + (x & 3)];

// Picks a colour from a dark→light ramp for value v in [0, 1], ordered-dithered
// between neighbouring steps so gradients stay inside the palette.
export function rampPick(ramp, v, x, y) {
  const f = clamp(v, 0, 1) * (ramp.length - 1);
  const i = Math.floor(f);
  return ramp[Math.min(ramp.length - 1, i + (f - i > bayer(x, y) ? 1 : 0))];
}

// Like rampPick, but thresholded with clustered value noise instead of the
// Bayer matrix: steps break up in organic, hand-placed-looking clumps rather
// than a regular checkerboard.
export function rampSoft(ramp, v, x, y, s = 0) {
  const f = clamp(v, 0, 1) * (ramp.length - 1);
  const i = Math.floor(f);
  const t = vnoise(x * 0.55, y * 0.55, s) * 0.75 + hash2(x, y, s + 1) * 0.25;
  return ramp[Math.min(ramp.length - 1, i + (f - i > t ? 1 : 0))];
}

export function vnoise(x, y, s = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s) + (hash2(xi + 1, yi, s) - hash2(xi, yi, s)) * u;
  const b = hash2(xi, yi + 1, s) + (hash2(xi + 1, yi + 1, s) - hash2(xi, yi + 1, s)) * u;
  return a + (b - a) * v;
}

// Calls fn(x, y) for every pixel of a rectangle and sets what it returns.
export function layer(buf, x0, y0, x1, y1, fn) {
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(buf.h, Math.ceil(y1)); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(buf.w, Math.ceil(x1)); x++) {
      const c = fn(x, y);
      if (c) buf.set(x, y, c);
    }
  }
}

// Blends two colours; k = 0 is a, 1 is b.
export function mixHex(a, b, k) {
  const A = rgba(a);
  const B = rgba(b);
  return '#' + [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * k).toString(16).padStart(2, '0')).join('');
}

// A colour with an alpha, as #rrggbbaa: glass, holograms, light.
export const withAlpha = (hex, a) => hex.slice(0, 7) + Math.round(clamp(a, 0, 1) * 255).toString(16).padStart(2, '0');

// The colour already at (x, y) if it is opaque, so glass can be laid over it.
export function opaqueAt(buf, x, y) {
  if (!buf.inside(x, y)) return null;
  const i = (y * buf.w + x) * 4;
  if (buf.data[i + 3] < 255) return null;
  return '#' + [0, 1, 2].map((k) => buf.data[i + k].toString(16).padStart(2, '0')).join('');
}

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 144665) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ------------------------------------------------------------------ PNG ----

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// 8-bit RGBA, no filtering (sprite sheets are mostly flat colour and compress
// well as-is).
export function encodePNG(buf) {
  const { w, h, data } = buf;
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) raw.set(data.subarray(y * w * 4, (y + 1) * w * 4), y * stride + 1);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
