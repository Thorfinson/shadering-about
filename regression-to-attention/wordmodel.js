/* Word vectors for chapters 6 and 7: a small generated German corpus and a
   skip-gram model with a full softmax, trained with Adam. Deterministic. */
(function () {
  'use strict';
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
  const dotN = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const unit = (a) => { const n = Math.hypot(...a) || 1; return a.map((x) => x / n); };
  const sub = (a, b) => a.map((x, i) => x - b[i]), add = (a, b) => a.map((x, i) => x + b[i]);

  // ── the corpus: sentences rolled from templates ────────────────
  const PEOPLE = [['der', 'Mann', 'er'], ['die', 'Frau', 'sie'], ['der', 'Vater', 'er', 'alt'], ['die', 'Mutter', 'sie', 'alt'], ['der', 'Sohn', 'er', 'jung'], ['die', 'Tochter', 'sie', 'jung']];
  const ROYAL = [['der', 'König', 'er', 'alt'], ['die', 'Königin', 'sie', 'alt'], ['der', 'Prinz', 'er', 'jung'], ['die', 'Prinzessin', 'sie', 'jung']];
  const ANIM = [['der', 'Hund'], ['die', 'Katze'], ['das', 'Pferd'], ['der', 'Vogel']];
  const FOOD = ['Brot', 'Käse', 'Suppe', 'Kuchen'];
  const SEAT = [['dem', 'Stuhl', 'der'], ['dem', 'Sofa', 'das'], ['der', 'Bank', 'die']];
  const MONEY = [['zur', 'Bank', 'die'], ['zur', 'Sparkasse', 'die']];
  function corpus(r) {
    const pick = (a) => a[Math.floor(r() * a.length)], out = [];
    const anyP = () => (r() < 0.6 ? pick(PEOPLE) : pick(ROYAL));
    const aged = [...PEOPLE, ...ROYAL].filter((q) => q[3]);
    const TPL = [
      () => { const p = anyP(); return `${p[0]} ${p[1]} isst ${pick(FOOD)}`; },
      () => { const p = anyP(); return `${p[0]} ${p[1]} ist müde und ${p[2]} schläft`; },
      () => { const p = anyP(); return `${p[0]} ${p[1]} lacht und ${p[2]} singt`; },
      () => { const p = pick(aged); return `${p[0]} ${p[1]} ist ${p[3]}`; },
      () => { const p = pick(aged); return `${p[0]} ${p[3]}e ${p[1]} lacht`; },
      () => { const p = pick(ROYAL); return `${p[0]} ${p[1]} regiert das Land`; },
      () => { const p = pick(ROYAL); return `${p[0]} ${p[1]} trägt die Krone`; },
      () => { const p = pick(ROYAL); return `${p[0]} ${p[1]} wohnt im Schloss und ${p[2]} regiert`; },
      () => { const p = anyP(), a = pick(ANIM); return `${p[0]} ${p[1]} füttert ${a[0] === 'der' ? 'den' : a[0]} ${a[1]}`; },
      () => { const a = pick(ANIM); return `${a[0]} ${a[1]} frisst Futter`; },
      () => { const a = pick(ANIM); return `${a[0]} ${a[1]} schläft im Garten`; },
      () => { const p = anyP(), m = pick(MONEY); return `${p[0]} ${p[1]} bringt Geld ${m[0]} ${m[1]}`; },
      () => { const m = pick(MONEY); return `${m[2]} ${m[1]} zahlt Zinsen auf das Geld`; },
      () => { const p = anyP(), m = pick(MONEY); return `${p[0]} ${p[1]} hat ein Konto bei der ${m[1]}`; },
      () => { const p = anyP(), q = pick(SEAT); return `${p[0]} ${p[1]} sitzt auf ${q[0]} ${q[1]}`; },
      () => { const q = pick(SEAT); return `${q[2]} ${q[1]} ist bequem`; },
      () => { const q = pick(SEAT); return `${q[2]} ${q[1]} ist aus Holz`; },
    ];
    for (let i = 0; i < 1200; i++) out.push(pick(TPL)());
    return out;
  }

  // ── skip-gram with a full softmax, trained with Adam ────────────
  const D = 12, SEED = 2;
  function makeModel() {
    const r = rng(SEED), sents = corpus(r);
    const vocab = [...new Set(sents.join(' ').split(' '))], Vn = vocab.length, id = Object.fromEntries(vocab.map((w, i) => [w, i]));
    const pairs = [];
    for (const s of sents) { const w = s.split(' ').map((x) => id[x]); w.forEach((c, i) => { for (let k = -2; k <= 2; k++) if (k && w[i + k] != null) pairs.push([c, w[i + k]]); }); }
    const init = () => Array.from({ length: Vn }, () => Array.from({ length: D }, () => gauss(r) * 0.3));
    const E = init(), U = init(), mk = (A) => A.map((x) => x.map(() => 0));
    const M = { r, sents, vocab, V: Vn, id, pairs, E, U, mE: mk(E), vE: mk(E), mU: mk(U), vU: mk(U), t: 0, loss: [], L: 0 };
    M.probs = (c) => { const e = E[c], z = U.map((u) => dotN(u, e)), mx = Math.max(...z), ex = z.map((v) => Math.exp(v - mx)), Z = ex.reduce((a, b) => a + b); return ex.map((v) => v / Z); };
    M.step = (pool = pairs, B = 64, lr = 0.02) => {
      const gE = mk(E), gU = mk(U); let loss = 0;
      for (let b = 0; b < B; b++) {
        const [c, o] = pool[Math.floor(r() * pool.length)], e = E[c], p = M.probs(c);
        loss -= Math.log(p[o]); p[o] -= 1;
        for (let j = 0; j < Vn; j++) { const g = p[j] / B; for (let i = 0; i < D; i++) { gU[j][i] += g * e[i]; gE[c][i] += g * U[j][i]; } }
      }
      M.t++;
      const c1 = 1 - 0.9 ** M.t, c2 = 1 - 0.999 ** M.t;
      const upd = (A, G, Mm, Vv) => { for (let j = 0; j < Vn; j++) for (let i = 0; i < D; i++) { Mm[j][i] = 0.9 * Mm[j][i] + 0.1 * G[j][i]; Vv[j][i] = 0.999 * Vv[j][i] + 0.001 * G[j][i] ** 2; A[j][i] -= (lr * Mm[j][i] / c1) / (Math.sqrt(Vv[j][i] / c2) + 1e-8); } };
      upd(E, gE, M.mE, M.vE); upd(U, gU, M.mU, M.vU);
      M.L = M.t === 1 ? loss / B : 0.97 * M.L + 0.03 * (loss / B);
      if (M.t % 10 === 0) M.loss.push(M.L);
    };
    M.vec = (w) => unit(E[id[w]]);
    M.cos = (a, b) => dotN(unit(a), unit(b));
    M.nearest = (v, ex = [], n = 5, among = null) => (among || vocab).filter((w) => !ex.includes(w)).map((w) => [w, M.cos(v, E[id[w]])]).sort((a, b) => b[1] - a[1]).slice(0, n);
    return M;
  }
  const STEPS = 3000;
  let FIN = null;
  const fin = () => { if (!FIN) { FIN = makeModel(); while (FIN.t < STEPS) FIN.step(); } return FIN; };
  window.WM = { rng, gauss, dotN, unit, sub, add, corpus, makeModel, fin, setFin: (M) => { FIN = FIN || M; }, D, SEED, STEPS };
})();
