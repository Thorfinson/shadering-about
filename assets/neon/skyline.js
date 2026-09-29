// The side-on city both 2D consoles draw: ranks of towers from far to near,
// the signs on them, the maglev line, the street. neon-2d-pixel.html paints it
// pixel by pixel; neon-2d.html draws the same plan as vectors at full
// resolution. Everything is in the map's art pixels (map.W × map.H).
//
// Load after assets/os/engine.js (it uses rng and lerp).

// eslint-disable-next-line no-unused-vars
function neonSkyline(W, H) {
  "use strict";
  const street = H - 20;
  const NEON = ["neonPink", "neonCyan", "neonAmber", "neonViolet", "neonGreen"];
  // far to near: each rank shorter, wider, darker, less drowned in smog
  const RANKS = [
    { fog: 0.72, top: [0.08, 0.4], w: [9, 20], gap: [1, 8], lit: 0.12, sign: 0.08, seed: 11 },
    { fog: 0.5, top: [0.16, 0.5], w: [12, 26], gap: [3, 14], lit: 0.17, sign: 0.22, seed: 23 },
    { fog: 0.28, top: [0.32, 0.64], w: [18, 36], gap: [6, 28], lit: 0.22, sign: 0.36, seed: 37 },
  ];
  const ranks = RANKS.map((R) => {
    const r = rng(R.seed);
    const towers = [];
    for (let x = -10 + r() * 8; x < W + 10; ) {
      const w = Math.round(lerp(R.w[0], R.w[1], r()));
      const top = Math.round(H * lerp(R.top[0], R.top[1], r() ** 0.9));
      const k = r();
      const crown = k < 0.2 ? "spire" : k < 0.42 ? "setback" : k < 0.55 ? "pyramid" : k < 0.65 ? "dome" : "flat";
      const signs = [];
      if (r() < R.sign) {
        const side = r() < 0.5 ? -1 : 1;
        signs.push({ side, y: Math.round(top + 8 + r() * (street - top) * 0.3), h: 10 + Math.round(r() * 18), col: NEON[Math.floor(r() * NEON.length)], ph: r() * 6 });
      }
      // now and then a wide screen across the face
      const screen = R.seed === 37 && w > 26 && r() < 0.3 ? { y: Math.round(top + 10 + r() * 20), h: 8 + Math.round(r() * 6), col: NEON[Math.floor(r() * NEON.length)] } : null;
      towers.push({ x: Math.round(x), w, top, crown, seed: R.seed * 1000 + towers.length, lit: R.lit * (0.6 + r() * 0.8), signs, screen, antenna: r() < 0.3 ? 6 + Math.round(r() * 14) : 0 });
      x += w + lerp(R.gap[0], R.gap[1], r());
    }
    return { ...R, towers };
  });
  // the maglev: a viaduct across the city, pylons down to the street
  const maglevY = Math.round(H * 0.8);
  const pylons = [];
  for (let x = 30; x < W; x += 90) pylons.push(x);
  return { street, ranks, maglev: { y: maglevY, pylons } };
}
