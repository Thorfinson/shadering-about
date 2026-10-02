/* A tiny attention-only transformer for chapters 8 and 9: two layers, one head
   each, learned token and position embeddings, no MLP, no LayerNorm.
   Hand-written backpropagation, Adam, deterministic for a given seed.
   Task: sequences that repeat with a random period of 3 to 8 letters. */
(function () {
  'use strict';
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }

  // C[n×m] (+)= A[n×k] · B[k×m]; all matrices are flat, row-major
  function mm(A, B, n, k, m, C = new Float64Array(n * m), acc = false) { if (!acc) C.fill(0); for (let i = 0; i < n; i++) for (let p = 0; p < k; p++) { const a = A[i * k + p]; if (a === 0) continue; const bo = p * m, co = i * m; for (let j = 0; j < m; j++) C[co + j] += a * B[bo + j]; } return C; }
  // C[n×m] (+)= A[n×k] · Bᵀ, B is [m×k]
  function mmT(A, B, n, k, m, C = new Float64Array(n * m), acc = false) { if (!acc) C.fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { let s = 0; const ao = i * k, bo = j * k; for (let p = 0; p < k; p++) s += A[ao + p] * B[bo + p]; C[i * m + j] += s; } return C; }
  // C[k×m] (+)= Aᵀ · B, A is [n×k], B is [n×m]
  function Tmm(A, B, n, k, m, C = new Float64Array(k * m), acc = false) { if (!acc) C.fill(0); for (let i = 0; i < n; i++) for (let p = 0; p < k; p++) { const a = A[i * k + p]; if (a === 0) continue; const bo = i * m, co = p * m; for (let j = 0; j < m; j++) C[co + j] += a * B[bo + j]; } return C; }

  const LETTERS = 'ABCDEFGHKLMNPRST'.split('');

  function create(cfg = {}) {
    const V = cfg.V || 16, T = cfg.T || 20, D = cfg.D || 16, DH = cfg.DH || 8, L = 2, B = cfg.B || 16, LR = cfg.LR || 0.005;
    const r = rng(cfg.seed || 3), init = (n, s) => Float64Array.from({ length: n }, () => gauss(r) * s);
    const P = { E: init(V * D, 0.5), Pos: init(T * D, 0.5), U: init(D * V, 1 / Math.sqrt(D)), H: [] };
    for (let l = 0; l < L; l++) P.H.push({ l, Q: init(D * DH, 1 / Math.sqrt(D)), K: init(D * DH, 1 / Math.sqrt(D)), V: init(D * DH, 1 / Math.sqrt(D)), O: init(DH * D, 1 / Math.sqrt(DH)) });
    const params = () => [P.E, P.Pos, P.U, ...P.H.flatMap((h) => [h.Q, h.K, h.V, h.O])];
    const gz = () => ({ E: new Float64Array(V * D), Pos: new Float64Array(T * D), U: new Float64Array(D * V), H: P.H.map(() => ({ Q: new Float64Array(D * DH), K: new Float64Array(D * DH), V: new Float64Array(D * DH), O: new Float64Array(DH * D) })) });
    const gflat = (G) => [G.E, G.Pos, G.U, ...G.H.flatMap((h) => [h.Q, h.K, h.V, h.O])];
    const M1 = gflat(gz()), M2 = gflat(gz());
    const sc = 1 / Math.sqrt(DH);

    /** opt.ablate: list of layer indices whose head output is dropped */
    function forward(seq, opt = {}) {
      const n = seq.length, x0 = new Float64Array(n * D);
      for (let i = 0; i < n; i++) for (let j = 0; j < D; j++) x0[i * D + j] = P.E[seq[i] * D + j] + P.Pos[i * D + j];
      const xs = [x0], hc = [], outs = [];
      let x = x0;
      for (const h of P.H) {
        const q = mm(x, h.Q, n, D, DH), k = mm(x, h.K, n, D, DH), v = mm(x, h.V, n, D, DH), A = mmT(q, k, n, DH, n);
        for (let i = 0; i < n; i++) {
          let m = -Infinity; for (let j = 0; j <= i; j++) { A[i * n + j] *= sc; if (A[i * n + j] > m) m = A[i * n + j]; }
          let s = 0; for (let j = 0; j < n; j++) { const e = j <= i ? Math.exp(A[i * n + j] - m) : 0; A[i * n + j] = e; s += e; }
          for (let j = 0; j <= i; j++) A[i * n + j] /= s;
        }
        const z = mm(A, v, n, n, DH), o = mm(z, h.O, n, DH, D), nx = Float64Array.from(x);
        if (!(opt.ablate && opt.ablate.includes(h.l))) for (let p = 0; p < n * D; p++) nx[p] += o[p];
        hc.push({ h, q, k, v, A, z }); outs.push(o); x = nx; xs.push(x);
      }
      const logits = mm(x, P.U, n, D, V);
      return { logits, xs, hc, outs, n };
    }
    const probsAt = (logits, i) => { let m = -Infinity; for (let j = 0; j < V; j++) m = Math.max(m, logits[i * V + j]); const e = []; let s = 0; for (let j = 0; j < V; j++) { e.push(Math.exp(logits[i * V + j] - m)); s += e[j]; } return e.map((x) => x / s); };

    function lossGrad(seq, G) {
      const { logits, xs, hc } = forward(seq), n = seq.length, dl = new Float64Array(n * V);
      let loss = 0, cnt = 0;
      for (let i = 0; i < n - 1; i++) {
        const p = probsAt(logits, i); loss -= Math.log(p[seq[i + 1]]); cnt++;
        for (let j = 0; j < V; j++) dl[i * V + j] = p[j] - (j === seq[i + 1] ? 1 : 0);
      }
      Tmm(xs[L], dl, n, D, V, G.U, true);
      let dx = mmT(dl, P.U, n, V, D);
      for (let l = L - 1; l >= 0; l--) {
        const x = xs[l], dIn = Float64Array.from(dx), { h, q, k, v, A, z } = hc[l], g = G.H[l];
        const dz = mmT(dx, h.O, n, D, DH); Tmm(z, dx, n, DH, D, g.O, true);
        const dA = mmT(dz, v, n, DH, n), dv = Tmm(A, dz, n, n, DH), ds = new Float64Array(n * n);
        for (let i = 0; i < n; i++) { let dot = 0; for (let j = 0; j <= i; j++) dot += A[i * n + j] * dA[i * n + j]; for (let j = 0; j <= i; j++) ds[i * n + j] = A[i * n + j] * (dA[i * n + j] - dot) * sc; }
        const dq = mm(ds, k, n, n, DH), dk = Tmm(ds, q, n, n, DH);
        Tmm(x, dq, n, D, DH, g.Q, true); Tmm(x, dk, n, D, DH, g.K, true); Tmm(x, dv, n, D, DH, g.V, true);
        mmT(dq, h.Q, n, DH, D, dIn, true); mmT(dk, h.K, n, DH, D, dIn, true); mmT(dv, h.V, n, DH, D, dIn, true);
        dx = dIn;
      }
      for (let i = 0; i < n; i++) for (let j = 0; j < D; j++) { G.E[seq[i] * D + j] += dx[i * D + j]; G.Pos[i * D + j] += dx[i * D + j]; }
      return [loss, cnt];
    }

    /** a sequence that repeats a block of m distinct letters (m = 3 … 8) */
    function sample(rr = r) {
      const m = 3 + Math.floor(rr() * 6), pool = Array.from({ length: V }, (_, i) => i), base = [];
      for (let i = 0; i < m; i++) base.push(pool.splice(Math.floor(rr() * pool.length), 1)[0]);
      const off = Math.floor(rr() * m), s = Array.from({ length: T }, (_, i) => base[(i + off) % m]);
      return { s, m };
    }

    const M = { V, T, D, DH, P, t: 0, hist: [], LETTERS, forward, probsAt, sample, rng };
    M.step = () => {
      const G = gz(); let Ls = 0, N = 0;
      for (let b = 0; b < B; b++) { const [l, n] = lossGrad(sample().s, G); Ls += l; N += n; }
      M.t++;
      const g = gflat(G), p = params(), c1 = 1 - 0.9 ** M.t, c2 = 1 - 0.999 ** M.t;
      p.forEach((A, k) => { for (let i = 0; i < A.length; i++) { const gg = g[k][i] / N; M1[k][i] = 0.9 * M1[k][i] + 0.1 * gg; M2[k][i] = 0.999 * M2[k][i] + 0.001 * gg * gg; A[i] -= (LR * M1[k][i] / c1) / (Math.sqrt(M2[k][i] / c2) + 1e-8); } });
      return Ls / N;
    };
    /** losses on fixed test sequences: positions in the first period (not predictable) vs. later ones,
        plus how strongly head 0 looks at the previous letter and head 1 at the letter after the last copy */
    M.evaluate = (opt = {}, n = 40) => {
      const rr = rng(4242); let lr = 0, nr = 0, lf = 0, nf = 0, acc = 0, prev = 0, np = 0, ind = 0, ni = 0;
      for (let k = 0; k < n; k++) {
        const { s, m } = sample(rr), f = forward(s, opt);
        for (let i = 0; i < T - 1; i++) {
          const p = probsAt(f.logits, i), l = -Math.log(p[s[i + 1]]);
          if (i >= m - 1) { lr += l; nr++; if (p.indexOf(Math.max(...p)) === s[i + 1]) acc++; } else { lf += l; nf++; }
        }
        const A0 = f.hc[0].A, A1 = f.hc[1].A;
        for (let i = 1; i < T; i++) { prev += A0[i * T + i - 1]; np++; if (i >= m) { for (let j = 1; j <= i; j++) if (s[j - 1] === s[i]) ind += A1[i * T + j]; ni++; } }
      }
      return { rep: lr / nr, first: lf / nf, acc: acc / nr, prev: prev / np, ind: ind / ni };
    };
    M.train = (steps) => { for (let i = 0; i < steps; i++) { M.step(); if (M.t % 20 === 0) M.hist.push({ t: M.t, ...M.evaluate({}, 12) }); } };
    return M;
  }
  window.TT = { create, rng, LETTERS, mm, mmT };
})();
