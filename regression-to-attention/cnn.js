/* A tiny convolutional network for chapter 11: 28×28 images of four shapes,
   8 filters 5×5, ReLU, 2×2 max pooling, 12 units 5×5×8, ReLU, global max,
   4 classes. Hand-written backpropagation, Adam, weight decay, deterministic. */
(function () {
  'use strict';
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
  const S = 28, K1 = 5, C1 = 8, K2 = 5, C2 = 12, NC = 4, WD = 0.003, LR = 0.01, B = 16;
  const O1 = S - K1 + 1, P1 = O1 / 2, O2 = P1 - K2 + 1, RF = 2 * K2 + K1 - 1; // 24, 12, 8, 14
  const NAMES = ['Kreis', 'Quadrat', 'Dreieck', 'Kreuz'];

  /** a filled shape, light on dark or dark on light, values in −0.5 … 0.5 */
  function shape(cls, rr, opt = {}) {
    const img = new Float32Array(S * S), cx = S * 0.3 + rr() * S * 0.4, cy = S * 0.3 + rr() * S * 0.4, R = S * (0.17 + rr() * 0.13), rot = rr() * Math.PI * 2, c = Math.cos(rot), s = Math.sin(rot);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = c * dx + s * dy, v = -s * dx + c * dy;
      let d;
      if (cls === 0) d = Math.hypot(dx, dy) - R;
      else if (cls === 1) d = Math.max(Math.abs(u), Math.abs(v)) - R * 0.85;
      else if (cls === 3) d = Math.min(Math.max(Math.abs(u) - R, Math.abs(v) - R * 0.3), Math.max(Math.abs(v) - R, Math.abs(u) - R * 0.3));
      else { let m = -Infinity; for (let i = 0; i < 3; i++) { const a = (i * 2 * Math.PI) / 3; m = Math.max(m, Math.cos(a) * u + Math.sin(a) * v); } d = m - R * 0.55; }
      img[y * S + x] = Math.min(1, Math.max(0, 0.5 - d));
    }
    const flip = rr() < 0.5;
    for (let i = 0; i < S * S; i++) img[i] = (flip ? 1 - img[i] : img[i]) - 0.5 + gauss(rr) * 0.05;
    return img;
  }

  function create(seed = 1) {
    const r = rng(seed), init = (n, sc) => Float32Array.from({ length: n }, () => gauss(r) * sc);
    const P = { W1: init(C1 * K1 * K1, 0.3), b1: new Float32Array(C1), W2: init(C2 * C1 * K2 * K2, 0.2), b2: new Float32Array(C2), W3: init(NC * C2, 0.3), b3: new Float32Array(NC) };
    const keys = Object.keys(P), M1 = {}, M2 = {}; keys.forEach((k) => { M1[k] = new Float32Array(P[k].length); M2[k] = new Float32Array(P[k].length); });

    function forward(img) {
      const a1 = new Float32Array(C1 * O1 * O1);
      for (let c = 0; c < C1; c++) for (let y = 0; y < O1; y++) for (let x = 0; x < O1; x++) { let s = P.b1[c]; for (let i = 0; i < K1; i++) for (let j = 0; j < K1; j++) s += P.W1[c * 25 + i * K1 + j] * img[(y + i) * S + x + j]; a1[(c * O1 + y) * O1 + x] = s > 0 ? s : 0; }
      const p1 = new Float32Array(C1 * P1 * P1), arg1 = new Int32Array(C1 * P1 * P1);
      for (let c = 0; c < C1; c++) for (let y = 0; y < P1; y++) for (let x = 0; x < P1; x++) { let m = -1, am = 0; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const id = (c * O1 + 2 * y + i) * O1 + 2 * x + j; if (a1[id] > m) { m = a1[id]; am = id; } } p1[(c * P1 + y) * P1 + x] = m; arg1[(c * P1 + y) * P1 + x] = am; }
      const a2 = new Float32Array(C2 * O2 * O2), z2 = new Float32Array(C2 * O2 * O2);
      for (let c = 0; c < C2; c++) for (let y = 0; y < O2; y++) for (let x = 0; x < O2; x++) { let s = P.b2[c]; for (let d = 0; d < C1; d++) for (let i = 0; i < K2; i++) for (let j = 0; j < K2; j++) s += P.W2[((c * C1 + d) * K2 + i) * K2 + j] * p1[(d * P1 + y + i) * P1 + x + j]; z2[(c * O2 + y) * O2 + x] = s; a2[(c * O2 + y) * O2 + x] = s > 0 ? s : 0; }
      const g = new Float32Array(C2), arg2 = new Int32Array(C2);
      for (let c = 0; c < C2; c++) { let m = -Infinity, am = 0; for (let k = 0; k < O2 * O2; k++) if (z2[c * O2 * O2 + k] > m) { m = z2[c * O2 * O2 + k]; am = c * O2 * O2 + k; } g[c] = m; arg2[c] = am; }
      const z = new Float32Array(NC); for (let k = 0; k < NC; k++) { let s = P.b3[k]; for (let c = 0; c < C2; c++) s += P.W3[k * C2 + c] * g[c]; z[k] = s; }
      const mx = Math.max(...z), e = Array.from(z, (v) => Math.exp(v - mx)), sum = e.reduce((p, q) => p + q), p = e.map((v) => v / sum);
      return { a1, p1, arg1, a2, z2, g, arg2, p };
    }
    function backward(img, f, y, G) {
      const dz = f.p.map((v, k) => v - (k === y ? 1 : 0)), dg = new Float32Array(C2);
      for (let k = 0; k < NC; k++) { G.b3[k] += dz[k]; for (let c = 0; c < C2; c++) { G.W3[k * C2 + c] += dz[k] * f.g[c]; dg[c] += dz[k] * P.W3[k * C2 + c]; } }
      const da2 = new Float32Array(C2 * O2 * O2); for (let c = 0; c < C2; c++) da2[f.arg2[c]] = dg[c];
      const dp1 = new Float32Array(C1 * P1 * P1);
      for (let c = 0; c < C2; c++) for (let y2 = 0; y2 < O2; y2++) for (let x2 = 0; x2 < O2; x2++) { const d = da2[(c * O2 + y2) * O2 + x2]; if (!d) continue; G.b2[c] += d; for (let dd = 0; dd < C1; dd++) for (let i = 0; i < K2; i++) for (let j = 0; j < K2; j++) { const wi = ((c * C1 + dd) * K2 + i) * K2 + j, pi = (dd * P1 + y2 + i) * P1 + x2 + j; G.W2[wi] += d * f.p1[pi]; dp1[pi] += d * P.W2[wi]; } }
      const da1 = new Float32Array(C1 * O1 * O1); for (let k = 0; k < dp1.length; k++) if (dp1[k] && f.a1[f.arg1[k]] > 0) da1[f.arg1[k]] += dp1[k];
      for (let c = 0; c < C1; c++) for (let y1 = 0; y1 < O1; y1++) for (let x1 = 0; x1 < O1; x1++) { const d = da1[(c * O1 + y1) * O1 + x1]; if (!d) continue; G.b1[c] += d; for (let i = 0; i < K1; i++) for (let j = 0; j < K1; j++) G.W1[c * 25 + i * K1 + j] += d * img[(y1 + i) * S + x1 + j]; }
    }
    const M = { P, t: 0, hist: [], forward, rng: r, seed };
    M.step = () => {
      const G = {}; keys.forEach((k) => (G[k] = new Float32Array(P[k].length))); let L = 0, acc = 0;
      for (let b = 0; b < B; b++) { const y = Math.floor(r() * NC), img = shape(y, r), f = forward(img); L -= Math.log(f.p[y] + 1e-9); if (f.p.indexOf(Math.max(...f.p)) === y) acc++; backward(img, f, y, G); }
      M.t++; const c1 = 1 - 0.9 ** M.t, c2 = 1 - 0.999 ** M.t;
      for (const k of keys) for (let i = 0; i < P[k].length; i++) { const gg = G[k][i] / B + (k === 'W1' || k === 'W2' ? WD * P[k][i] : 0); M1[k][i] = 0.9 * M1[k][i] + 0.1 * gg; M2[k][i] = 0.999 * M2[k][i] + 0.001 * gg * gg; P[k][i] -= (LR * M1[k][i] / c1) / (Math.sqrt(M2[k][i] / c2) + 1e-8); }
      M.L = M.t === 1 ? L / B : 0.97 * M.L + 0.03 * (L / B); M.acc = M.t === 1 ? acc / B : 0.97 * M.acc + 0.03 * (acc / B);
      if (M.t % 10 === 0) M.hist.push({ t: M.t, L: M.L, acc: M.acc });
    };
    /** gradient of a layer-2 unit's value (before its ReLU) at grid position (yc, xc) with respect to the image */
    M.inputGrad = (img, c, yc, xc) => {
      const f = forward(img), dimg = new Float32Array(S * S), dp1 = new Float32Array(C1 * P1 * P1);
      for (let dd = 0; dd < C1; dd++) for (let i = 0; i < K2; i++) for (let j = 0; j < K2; j++) dp1[(dd * P1 + yc + i) * P1 + xc + j] += P.W2[((c * C1 + dd) * K2 + i) * K2 + j];
      const da1 = new Float32Array(C1 * O1 * O1); for (let k = 0; k < dp1.length; k++) if (dp1[k] && f.a1[f.arg1[k]] > 0) da1[f.arg1[k]] += dp1[k];
      for (let cc = 0; cc < C1; cc++) for (let y1 = 0; y1 < O1; y1++) for (let x1 = 0; x1 < O1; x1++) { const d = da1[(cc * O1 + y1) * O1 + x1]; if (!d) continue; for (let i = 0; i < K1; i++) for (let j = 0; j < K1; j++) dimg[(y1 + i) * S + x1 + j] += d * P.W1[cc * 25 + i * K1 + j]; }
      return { act: f.a2[(c * O2 + yc) * O2 + xc], dimg };
    };
    /** feature visualisation: start from faint noise, climb the gradient, smooth a little every few steps */
    M.visualise = (c, iters = 300, state = null) => {
      const yc = Math.floor((O2 - 1) / 2), fr = rng(500 + c);
      const img = state || Float32Array.from({ length: S * S }, () => gauss(fr) * 0.1);
      for (let it = 0; it < iters; it++) {
        const { dimg } = M.inputGrad(img, c, yc, yc); let gn = 0; for (let i = 0; i < dimg.length; i++) gn += dimg[i] * dimg[i]; gn = Math.sqrt(gn) || 1;
        for (let i = 0; i < S * S; i++) img[i] = Math.max(-0.5, Math.min(0.5, img[i] + 0.2 * dimg[i] / gn));
        if (it % 4 === 3) { const b = Float32Array.from(img); for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) { let s2 = 0; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) s2 += b[(y + i) * S + x + j]; img[y * S + x] = 0.7 * b[y * S + x] + 0.3 * s2 / 9; } }
      }
      return { img, x0: 2 * yc, y0: 2 * yc };
    };
    /** the image patches that excite each layer-2 unit most, from n test images */
    M.topPatches = (n = 600, k = 8) => {
      const pr = rng(11), tops = Array.from({ length: C2 }, () => []);
      for (let i = 0; i < n; i++) { const y = i % NC, img = shape(y, pr), f = forward(img); for (let c = 0; c < C2; c++) { const id = f.arg2[c] - c * O2 * O2, y2 = Math.floor(id / O2), x2 = id % O2, patch = new Float32Array(RF * RF); for (let a = 0; a < RF; a++) for (let b = 0; b < RF; b++) patch[a * RF + b] = img[(2 * y2 + a) * S + 2 * x2 + b]; tops[c].push({ v: f.g[c], patch, y }); } }
      return tops.map((l) => l.sort((a, b) => b.v - a.v).slice(0, k));
    };
    M.accuracy = (n = 400) => { const te = rng(99); let ok = 0; for (let i = 0; i < n; i++) { const y = i % NC, f = forward(shape(y, te)); if (f.p.indexOf(Math.max(...f.p)) === y) ok++; } return ok / n; };
    return M;
  }
  window.CNN = { create, shape, rng, S, K1, C1, K2, C2, NC, O1, P1, O2, RF, NAMES };
})();
