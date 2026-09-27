// Set pieces for nautilus-os.html, the top-down console: glass-domed
// stations (one per pipeline station, ringed in its route colour), the
// orchestrator's hub dome, a humpback whale, a distant lighthouse, and the
// bridge vignette for the navigation rail.

export default function generate(kit) {
  const { P } = kit;
  const STATIONS = {
    knowledge: P.research,
    documents: P.analyze,
    models: P.model,
    repos: P.build,
    tests: P.test,
    memory: P.remember,
    deploy: P.deploy,
  };
  return [
    {
      sprite: 'dome',
      frames: Object.entries(STATIONS).map(([name, accent], i) => ({
        name,
        buf: dome(kit, { w: 56, h: 48, cx: 28, baseY: 32, prx: 24, pry: 7, face: 5, drx: 19, dry: 22, accent, seed: 11 + i * 7 }),
      })),
      meta: { base: [28, 32], hub: [44, 50] },
    },
    { sprite: 'hub', frames: [{ name: 'orchestrator', buf: hub(kit) }], meta: { base: [44, 50] } },
    whale(kit),
    tower(kit),
    bridge(kit),
  ];
}

// A brass-and-stone platform (an oblique cylinder) under a glass hemisphere;
// warm-lit towers show through the glass, brass ribs hold it together, and a
// ring of lights in the station's colour runs round the rim.
function dome(kit, o) {
  const { P, paint, rampPick, hash2, mulberry32 } = kit;
  const { w, h, cx, baseY, prx, pry, face, drx, dry, accent, seed, towers: nTowers = 6 } = o;
  const rng = mulberry32(seed);
  const towers = [];
  for (let i = 0; i < nTowers; i++) {
    const tw = 3 + ((rng() * 4) | 0);
    const tx = Math.round(cx - drx * 0.72 + rng() * (drx * 1.44 - tw));
    towers.push({ x: tx, w: tw, top: Math.round(baseY - dry * (0.22 + rng() * 0.55)) });
  }
  const buf = paint(w, h, (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    const ex = (px - cx) / prx;
    const ey = (py - baseY) / pry;
    const frontY = baseY + pry * Math.sqrt(Math.max(0, 1 - ex * ex));
    if (Math.abs(ex) <= 1 && py > frontY && py <= frontY + face) {
      const fy = py - frontY;
      if (fy < 1.2) return x % 3 === 0 ? accent : P.brass2; // lit rim
      if (Math.abs(fy - face * 0.6) < 0.7 && x % 4 === 1 && Math.abs(ex) < 0.9) return P.lamp; // windows
      return rampPick([P.stone0, P.stone1, P.stone2], 0.6 - ex * 0.3 - (fy / face) * 0.25, x, y);
    }
    const dx = (px - cx) / drx;
    const dy = (py - baseY) / dry;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (dy <= 0 && r <= 1) {
      if (r > 1 - 1.3 / drx) return P.brass2; // rim
      const span = Math.sqrt(Math.max(0, 1 - dy * dy));
      if ([-0.55, 0, 0.55].some((k) => Math.abs(dx - k * span) < 0.9 / drx) || Math.abs(dy + 0.5) < 0.6 / dry) {
        return (x + y) % 2 ? P.brass1 : P.brass2; // ribs
      }
      if (dx < -0.15 && dy < -0.3 && Math.abs(r - 0.8) < 0.06) return P.white; // highlight
      if (dx < -0.05 && dy < -0.2 && Math.abs(r - 0.8) < 0.15 && (x + y) % 2 === 0) return P.glow;
      const t = towers.find((q) => x >= q.x && x < q.x + q.w && y >= q.top);
      let col;
      if (t) {
        const lit = y > t.top && (x - t.x) % 2 === 1 && (y - t.top) % 3 === 1 && hash2(x, y, seed) < 0.75;
        col = lit ? P.lamp : rampPick([P.ink2, P.stone0, P.stone1], 0.3 + ((x - t.x) / t.w) * 0.25, x, y);
      } else {
        col = rampPick([P.brass0, P.brass1, P.brass2], 0.1 + (1 - r) * 0.15 + (1 + dy) * 0.45, x, y);
      }
      // glass: a dithered tint, heavier toward the top where it catches the light
      const tintAmt = dy < -0.55 ? 0.5 : r > 0.82 ? 0.5 : 0.18;
      if (hash2(x, y, 3) < tintAmt && (x + y) % 2 === 0) col = rampPick([P.glassD, P.glass], 0.35 - dy * 0.2, x, y);
      return col;
    }
    if (ex * ex + ey * ey <= 1) {
      if (Math.abs(Math.hypot(ex, ey) - 0.88) < 0.07) return P.brass1; // inlaid ring
      return rampPick([P.stone2, P.stone3], 0.55 - ey * 0.25, x, y);
    }
    return null;
  });
  // finial and lantern
  const top = baseY - dry;
  buf.rect(cx - 1, top - 5, 2, 5, P.brass2);
  buf.set(cx - 1, top - 5, P.brass3);
  buf.rect(cx - 1, top - 7, 2, 2, P.lamp);
  buf.set(cx, top - 8, P.brass2);
  return buf.outline(P.ink);
}

function hub(kit) {
  const { P } = kit;
  const w = 88;
  const h = 76;
  const cx = 44;
  const baseY = 50;
  const buf = dome(kit, { w, h, cx, baseY, prx: 40, pry: 11, face: 8, drx: 31, dry: 36, accent: P.brass3, seed: 5, towers: 9 });
  // flanking beacon towers on the platform
  for (const tx of [cx - 37, cx + 34]) {
    buf.rect(tx, baseY - 22, 4, 24, P.stone2);
    buf.rect(tx + 3, baseY - 22, 1, 24, P.stone1);
    buf.rect(tx, baseY - 22, 4, 1, P.brass2);
    buf.rect(tx + 1, baseY - 25, 2, 3, P.lamp);
    buf.set(tx + 1, baseY - 26, P.brass2);
    for (let k = 0; k < 4; k++) buf.set(tx + 1, baseY - 18 + k * 5, P.lamp);
  }
  // the orchestrator's seal: a trident in a brass medallion
  const my = baseY - 10;
  for (let y = -7; y <= 7; y++) {
    for (let x = -7; x <= 7; x++) {
      const d = Math.hypot(x, y);
      if (d <= 7.2) buf.set(cx + x - 0.5, my + y, d > 5.8 ? P.brass3 : P.ink2);
    }
  }
  for (let y = -4; y <= 5; y++) buf.set(cx - 0.5, my + y, P.brass3);
  for (const x of [-3, 2]) for (let y = -4; y <= -1; y++) buf.set(cx + x, my + y, P.brass3);
  for (let x = -3; x <= 2; x++) buf.set(cx + x, my - 1, P.brass3);
  buf.set(cx - 4, my - 5, P.brass3);
  buf.set(cx + 3, my - 5, P.brass3);
  buf.set(cx - 0.5, my - 5, P.lamp);
  return buf.outline(P.ink);
}

// Humpback, facing right, with its long pectoral fin; two tail frames.
function whale(kit) {
  const { P, paint, rampPick, inPoly } = kit;
  const frames = [-1, 1].map((flip, i) => {
    const fin = [[46, 17], [34, 26], [38, 27], [51, 19]];
    const fluke = flip < 0 ? [[0, 3], [9, 11], [9, 14], [3, 10]] : [[0, 22], [9, 14], [9, 11], [3, 15]];
    const buf = paint(78, 30, (x, y) => {
      const px = x + 0.5;
      const py = y + 0.5;
      if (inPoly(px, py, fin)) return py > 24 ? P.pearlD : P.iron3;
      if (x >= 8 && x <= 74) {
        const u = (x - 8) / 66;
        const top = 13 - 8.5 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.92 + 0.08)), 0.6);
        const bot = 13 + 6.5 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.88 + 0.12)), 0.75);
        if (py >= top && py <= bot) {
          const v = (py - top) / (bot - top);
          if (v > 0.62 && u > 0.45 && (y + (x >> 3)) % 2 === 0) return P.stone3; // throat grooves
          if (x === 66 && y === 12) return P.ink;
          if (u > 0.8 && v < 0.35 && (x * 7 + y * 3) % 11 === 0) return P.stone4; // barnacles
          return rampPick([P.iron1, P.iron2, P.iron3, P.stone2], 0.85 - v * 0.6, x, y);
        }
      }
      if (inPoly(px, py, fluke)) return P.iron2;
      return null;
    });
    return { name: `swim${i}`, buf: buf.outline(P.ink) };
  });
  return { sprite: 'whale', frames, meta: {} };
}

// A far-off lighthouse on a rock spire, drawn in the haze colours of the deep.
function tower(kit) {
  const { P, paint } = kit;
  const buf = paint(14, 48, (x, y) => {
    if (y >= 1 && y <= 3 && x >= 5 && x <= 8) return y === 1 ? P.abyss5 : P.abyss4; // cap
    if (y >= 4 && y <= 8 && x >= 4 && x <= 9) return x === 4 || x === 9 ? P.abyss3 : y === 6 ? P.lamp : P.brass3; // lantern room
    if (y === 9 && x >= 3 && x <= 10) return P.abyss4;
    if (y >= 10) {
      const half = 3 + (y - 10) * 0.1;
      if (Math.abs(x + 0.5 - 7) <= half) {
        if ((y - 10) % 9 === 4) return P.abyss4;
        if (y % 12 === 6 && Math.abs(x + 0.5 - 7) < 1) return P.brass1;
        return x + 0.5 < 7 ? P.abyss3 : P.abyss2;
      }
    }
    return null;
  });
  return { sprite: 'tower', frames: [{ name: 'far', buf }], meta: {} };
}

// The bridge: the salon's great porthole, the helm, and Captain Nemo in silhouette.
function bridge(kit) {
  const { P, paint, rampPick, inPoly } = kit;
  const w = 128;
  const h = 100;
  const pc = [64, 44];
  const body = [[40, 100], [41, 60], [45, 53], [55, 53], [59, 60], [60, 100]];
  const arm = [[44, 57], [27, 70], [30, 73], [47, 62]];
  const buf = paint(w, h, (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    // captain: cap, head, coat, arm on the wheel — ink, with a rim of sea light
    const inCap = (py >= 38 && py <= 41 && px >= 45 && px <= 55) || (py > 41 && py <= 42.5 && px >= 43 && px <= 57);
    const inHead = Math.hypot(px - 50, py - 46.5) <= 4.6;
    const inBody = inPoly(px, py, body) || inPoly(px, py, arm);
    if (inCap || inHead || inBody) {
      const edge = !(inPoly(px - 1.2, py, body) || Math.hypot(px - 1.2 - 50, py - 46.5) <= 4.6 || inCap);
      return edge && py < 80 ? P.abyss6 : P.ink;
    }
    // helm wheel
    const wd = Math.hypot(px - 24, py - 74);
    if (wd <= 15.5) {
      if (wd >= 12.5) return wd > 14.3 ? P.wood1 : P.wood3;
      const ang = Math.atan2(py - 74, px - 24);
      const spoke = Math.abs(((ang / (Math.PI / 4)) % 1 + 1) % 1 - 0.5) > 0.44;
      if (wd <= 3) return wd <= 1.6 ? P.brass3 : P.brass1;
      if (spoke) return P.wood2;
    }
    // console
    if (py >= 82) {
      if (py < 83.5) return P.brass2;
      if (py < 85) return P.wood3;
      return rampPick([P.wood0, P.wood1], 0.6 - (py - 85) / 30, x, y);
    }
    // globe on the console
    if (Math.hypot(px - 98, py - 75) <= 6) return rampPick([P.glassD, P.glass, P.brass2], 0.7 - (py - 69) / 12, x, y);
    if (px >= 97 && px <= 99 && py > 81 && py < 82) return P.brass1;
    // porthole
    const d = Math.hypot(px - pc[0], py - pc[1]);
    if (d <= 42) {
      if (d >= 35) {
        const a = Math.atan2(py - pc[1], px - pc[0]);
        const rivet = d > 37.5 && d < 39.5 && Math.abs(((a / (Math.PI / 6)) % 1 + 1) % 1 - 0.5) > 0.44;
        if (rivet) return P.lamp;
        return rampPick([P.brass0, P.brass1, P.brass2, P.brass3], 0.55 - (py - pc[1]) / 70 - (px - pc[0]) / 110, x, y);
      }
      // the sea beyond: light from above, a distant dome, the floor
      const dome = Math.hypot((px - 88) / 11, (py - 62) / 10);
      if (py < 62 && dome <= 1) return dome > 0.86 ? P.glass : (x + y) % 3 === 0 ? P.lamp : P.abyss4;
      if (py > 62 + Math.sin(px * 0.2) * 1.5) return rampPick([P.abyss1, P.abyss2], 0.5, x, y);
      const ray = Math.max(0, Math.sin((px + py * 0.5) * 0.25)) ** 6 * 0.25;
      return rampPick([P.abyss2, P.abyss3, P.abyss4, P.abyss5, P.abyss6], 0.95 - (py - 2) / 64 + ray, x, y);
    }
    // lantern glow on the panelling
    const lg = Math.hypot(px - 114, py - 70);
    if (lg < 5) return lg < 2 ? P.lamp : P.brass2;
    if (lg < 13 && (x + y) % 2 === 0 && lg < 7 + (x % 5)) return P.brass0;
    return rampPick([P.ink2, P.wood0], 0.35 + (py / h) * 0.3, x, y);
  });
  return { sprite: 'bridge', frames: [{ name: 'helm', buf }], meta: {} };
}
