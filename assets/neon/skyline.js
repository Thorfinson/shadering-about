// The side-on city both 2D consoles draw, seen from far off: colossal towers
// lost in the smog, four ranks of towers in front of them with everything a
// real skyline carries (stains, pipes, air-conditioners, fire escapes, water
// tanks, billboards, broken signs), skybridges and sagging cables between
// them, an elevated highway, the maglev, and the street with its shops,
// lamps and people under umbrellas. neon-2d-pixel.html paints the plan pixel
// by pixel; neon-2d.html draws the same plan as vectors at full resolution.
// Everything is in the map's art pixels (map.W × map.H).
//
// Load after assets/os/engine.js (it uses rng, lerp and clamp).

// eslint-disable-next-line no-unused-vars
function neonSkyline(W, H) {
  "use strict";
  const street = H - 34;
  const NEON = ["neonPink", "neonCyan", "neonAmber", "neonViolet", "neonGreen"];
  const pickNeon = (r) => NEON[Math.floor(r() * NEON.length)];

  // the colossi: a handful of megastructures at the back, taller than anything
  const colossi = [];
  {
    const r = rng(5);
    for (let x = W * (0.02 + r() * 0.08); x < W; x += W * (0.16 + r() * 0.14)) {
      const w = Math.round(W * (0.05 + r() * 0.07));
      colossi.push({ x: Math.round(x), w, top: Math.round(H * (0.02 + r() * 0.12)), steps: 2 + Math.floor(r() * 3), seed: 900 + colossi.length, mast: r() < 0.6 ? Math.round(H * (0.04 + r() * 0.06)) : 0, screen: r() < 0.5 ? { y: Math.round(H * (0.2 + r() * 0.2)), h: Math.round(H * (0.05 + r() * 0.04)), col: pickNeon(r) } : null });
    }
  }

  // far to near: each rank shorter, wider, darker, less drowned in smog, busier
  const RANKS = [
    { fog: 0.8, top: [0.05, 0.36], w: [6, 18], gap: [2, 10], lit: 0.05, sign: 0.06, clutter: 0.15, seed: 11 },
    { fog: 0.6, top: [0.15, 0.5], w: [8, 22], gap: [3, 16], lit: 0.08, sign: 0.14, clutter: 0.4, seed: 23 },
    { fog: 0.38, top: [0.3, 0.64], w: [10, 28], gap: [4, 20], lit: 0.11, sign: 0.3, clutter: 0.7, seed: 37 },
    { fog: 0.1, top: [0.5, 0.8], w: [12, 36], gap: [4, 24], lit: 0.13, sign: 0.42, clutter: 1, seed: 53 },
  ];
  const ranks = RANKS.map((R, ri) => {
    const r = rng(R.seed);
    const towers = [];
    for (let x = -10 + r() * 8; x < W + 10; ) {
      const w = Math.round(lerp(R.w[0], R.w[1], r()));
      const top = Math.round(H * lerp(R.top[0], R.top[1], r() ** 0.9));
      const k = r();
      const crown = k < 0.18 ? "spire" : k < 0.38 ? "setback" : k < 0.48 ? "pyramid" : k < 0.56 ? "dome" : k < 0.64 ? "stepped" : "flat";
      const T = { x: Math.round(x), w, top, crown, seed: R.seed * 1000 + towers.length, lit: R.lit * (0.5 + r()), windows: ["grid", "sparse", "bands", "sparse", "grid", "office"][Math.floor(r() * 6)], signs: [], hsigns: [], roof: [], ac: [], pipes: [], escape: null, screen: null, antenna: r() < 0.35 ? 5 + Math.round(r() * 16) : 0 };
      // vertical neon down one side, now and then with dead letters
      if (r() < R.sign) T.signs.push({ side: r() < 0.5 ? -1 : 1, y: Math.round(top + 6 + r() * (street - top) * 0.4), h: 8 + Math.round(r() * 20), col: pickNeon(r), ph: r() * 6, dead: r() < 0.35 ? Math.round(r() * 12) : -1 });
      // a horizontal bar of neon across the face
      if (r() < R.sign * 0.6 && w > 12) T.hsigns.push({ y: Math.round(top + 4 + r() * (street - top) * 0.5), w: Math.round(w * (0.5 + r() * 0.4)), col: pickNeon(r), ph: r() * 6 });
      if (ri >= 2 && w > 22 && r() < 0.25) T.screen = { y: Math.round(top + 8 + r() * 24), h: 6 + Math.round(r() * 7), col: pickNeon(r) };
      // on the roof: water tanks, air handlers, dishes, a billboard on struts, a shed
      const nRoof = Math.floor(r() * 4 * R.clutter);
      for (let i = 0; i < nRoof; i++) {
        const kind = ["tank", "ac", "dish", "billboard", "shed", "ac"][Math.floor(r() * 6)];
        const rw = kind === "billboard" ? Math.min(w - 2, 10 + Math.round(r() * 10)) : kind === "tank" ? 4 + Math.round(r() * 3) : 2 + Math.round(r() * 4);
        T.roof.push({ kind, x: Math.round(r() * Math.max(1, w - rw)), w: rw, h: kind === "billboard" ? 5 + Math.round(r() * 4) : kind === "tank" ? 4 + Math.round(r() * 3) : 2 + Math.round(r() * 2), col: pickNeon(r) });
      }
      // on the face: air-conditioners, pipes, a fire escape on the near ranks
      const nAc = Math.floor(r() * 7 * R.clutter);
      for (let i = 0; i < nAc; i++) T.ac.push({ side: r() < 0.5 ? -1 : 1, y: Math.round(top + 6 + r() * (street - top - 10)) });
      if (r() < R.clutter * 0.7) T.pipes.push(Math.round(1 + r() * (w - 3)));
      if (ri >= 2 && r() < 0.35) T.escape = { side: r() < 0.5 ? -1 : 1, y0: Math.round(top + 10 + r() * 20), y1: street - 6 };
      towers.push(T);
      x += w + lerp(R.gap[0], R.gap[1], r());
    }
    return { ...R, towers };
  });

  // skybridges and cables between neighbours of the same rank
  const bridges = [], cables = [];
  ranks.forEach((R, ri) => {
    if (ri === 0) return;
    const r = rng(R.seed + 7);
    for (let i = 0; i < R.towers.length - 1; i++) {
      const a = R.towers[i], b = R.towers[i + 1];
      const gapX = b.x - (a.x + a.w);
      const hi = Math.max(a.top, b.top) + 6;
      if (gapX > 1 && gapX < 40 && r() < 0.28 && street - hi > 20) bridges.push({ rank: ri, x0: a.x + a.w, x1: b.x, y: Math.round(hi + r() * (street - hi) * 0.6), h: 3 + Math.round(r() * 2), seed: i });
      // cables, a tangle of them low down on the near ranks, some hung with washing
      const n = ri === 3 ? 1 + Math.floor(r() * 4) : r() < 0.5 ? 1 : 0;
      for (let k = 0; k < n; k++) {
        const c = R.towers[Math.min(R.towers.length - 1, i + 1 + (r() < 0.25 ? 1 : 0))];
        const y0 = Math.round(Math.max(a.top + 4, lerp(a.top, street, 0.3 + r() * 0.65))), y1 = Math.round(Math.max(c.top + 4, lerp(c.top, street, 0.3 + r() * 0.65)));
        cables.push({ rank: ri, x0: a.x + a.w - 1, y0, x1: c.x + 1, y1, sag: 2 + r() * (6 + (c.x - a.x - a.w) * 0.25), washing: ri === 3 && r() < 0.3 });
      }
    }
  });

  // the street: shopfronts under the near rank, lamps, people with umbrellas
  const r = rng(77);
  const shops = [];
  for (let x = r() * 6; x < W; x += 8 + r() * 18) shops.push({ x: Math.round(x), w: 6 + Math.round(r() * 12), col: r() < 0.55 ? ["winWarm", "winWarm", "winCool"][Math.floor(r() * 3)] : pickNeon(r), awning: r() < 0.5 ? pickNeon(r) : null, lit: r() < 0.85 });
  const lamps = [];
  for (let x = 8 + r() * 10; x < W; x += 34 + r() * 20) lamps.push(Math.round(x));
  const people = [];
  for (let i = 0; i < W / 9; i++) people.push({ x: r() * W, h: 3 + Math.round(r() * 2), umbrella: r() < 0.45 ? ["neonPink", "neonCyan", "pearl", "neonAmber", "car2"][Math.floor(r() * 5)] : null, speed: (r() - 0.5) * 8, ph: r() * 6 });
  const vents = [];
  for (let i = 0; i < W / 70; i++) vents.push(Math.round(r() * W));
  // smoke from the roofs of the nearer ranks
  const chimneys = [];
  for (const R of ranks.slice(2)) for (const T of R.towers) if (r() < 0.18) chimneys.push({ x: T.x + Math.round(r() * T.w), y: T.top - 1, fog: R.fog });
  // holograms hanging in the air over the middle distance
  const holos = [];
  for (let i = 0; i < Math.round(W / 280); i++) holos.push({ x: Math.round(W * (0.06 + r() * 0.88)), y: Math.round(H * (0.22 + r() * 0.3)), w: 18 + Math.round(r() * 22), h: 10 + Math.round(r() * 12), col: pickNeon(r), kind: ["koi", "face", "text", "bars"][Math.floor(r() * 4)], ph: r() * 6 });

  return {
    street,
    colossi,
    ranks,
    bridges,
    cables,
    shops,
    lamps,
    people,
    vents,
    chimneys,
    holos,
    highway: { y: Math.round(H * 0.66), pylons: Array.from({ length: Math.ceil(W / 120) }, (_, i) => 40 + i * 120) },
    maglev: { y: Math.round(H * 0.8), pylons: Array.from({ length: Math.ceil(W / 90) }, (_, i) => 30 + i * 90) },
  };
}
