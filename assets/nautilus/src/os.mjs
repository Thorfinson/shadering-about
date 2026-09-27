// Set pieces for nautilus-os.html, the top-down console: station fortresses
// (a glass dome on a stepped platform, flanked by towers with pointed roofs and
// lit windows), the orchestrator's hub, rock pinnacles and ruins for the deep
// background, anemones and tube coral, a humpback, an octopus, and the bridge
// scene for the navigation rail.
//
// Architecture uses the blue "abyss" stone so it sits in the water; brass
// trims it and lamp-coloured windows light it. Meta lists every lamp so the
// page can bloom them.

export default function generate(kit) {
  const { P } = kit;
  const STATIONS = {
    knowledge: [P.research, 3],
    documents: [P.analyze, 11],
    models: [P.model, 19],
    repos: [P.build, 27],
    tests: [P.test, 35],
    memory: [P.remember, 43],
    deploy: [P.deploy, 51],
  };
  const lamps = {};
  const frames = Object.entries(STATIONS).map(([name, [accent, seed]]) => {
    const { buf, lamps: l } = station(kit, accent, seed);
    lamps[name] = l;
    return { name, buf };
  });
  const hubOut = hub(kit);
  return [
    { sprite: 'station', frames, meta: { base: [44, 56], prx: 30, pry: 9, lamps } },
    { sprite: 'hub', frames: [{ name: 'orchestrator', buf: hubOut.buf }], meta: { base: [66, 82], prx: 46, pry: 13, lamps: hubOut.lamps } },
    pinnacles(kit),
    ruins(kit),
    reef(kit),
    octopus(kit),
    whale(kit),
    bridge(kit),
  ];
}

// Paint fn(x, y) -> colour | null over a rectangle of an existing buffer.
function layer(buf, x0, y0, x1, y1, fn) {
  for (let y = Math.max(0, y0); y < Math.min(buf.h, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(buf.w, x1); x++) {
      const c = fn(x, y);
      if (c) buf.set(x, y, c);
    }
  }
}

// A stone tower with a lit window every few courses and a pointed brass roof.
function tower(buf, kit, { x, w, top, bottom, roof, lit, seed }, lamps) {
  const { P, hash2 } = kit;
  const mid = Math.floor(w / 2);
  for (let y = top; y < bottom; y++) {
    for (let i = 0; i < w; i++) {
      let c = i === 0 ? P.abyss6 : i === w - 1 ? P.abyss1 : i < mid ? P.abyss4 : P.abyss3;
      if ((y - top) % 8 === 7) c = i === 0 ? P.abyss5 : P.abyss2; // string course
      if (i === mid && (y - top) % 5 === 2 && y < bottom - 4 && hash2(x, y, seed) < lit) c = P.lamp;
      buf.set(x + i, y, c);
    }
  }
  const cx = x + (w - 1) / 2;
  for (let r = 1; r <= roof; r++) {
    const half = (w / 2 + 0.6) * (1 - r / (roof + 1));
    for (let i = Math.ceil(cx - half); i <= Math.floor(cx + half); i++) buf.set(i, top - r, i <= cx ? P.brass2 : P.brass0);
  }
  buf.set(Math.round(cx), top - roof - 1, P.brass2);
  buf.set(Math.round(cx), top - roof - 2, P.lamp);
  lamps.push([Math.round(cx), top - roof - 2]);
}

// An oblique cylinder: a lit rim in the accent colour, a band of windows, and
// an inlaid brass ring on the top face.
function cylinder(buf, kit, { cx, top, rx, ry, face, accent, windows }) {
  const { P, rampPick } = kit;
  const STONE = [P.abyss1, P.abyss2, P.abyss3, P.abyss4, P.abyss5, P.abyss6];
  layer(buf, Math.floor(cx - rx - 1), Math.floor(top - ry - 1), Math.ceil(cx + rx + 1), Math.ceil(top + ry + face + 2), (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    const ex = (px - cx) / rx;
    if (Math.abs(ex) > 1) return null;
    const frontY = top + ry * Math.sqrt(1 - ex * ex);
    if (py > frontY && py <= frontY + face) {
      const fy = py - frontY;
      if (fy < 1.2) return x % 3 === 0 ? accent : P.brass2;
      if (windows && Math.abs(fy - face * 0.55) < 0.8 && x % 5 === 2 && Math.abs(ex) < 0.9) return P.lamp;
      if (fy > face - 1.1) return P.abyss1;
      return rampPick(STONE, 0.62 - ex * 0.35 - (fy / face) * 0.25, x, y);
    }
    const ey = (py - top) / ry;
    if (ex * ex + ey * ey <= 1) {
      if (Math.abs(Math.hypot(ex, ey) - 0.86) < 0.07) return P.brass1;
      return rampPick(STONE, 0.78 - ey * 0.22, x, y);
    }
    return null;
  });
}

// Glass hemisphere: a little lamp-lit city inside, brass ribs, a bright catch-light.
function glassDome(buf, kit, { cx, baseY, drx, dry, seed, towers: n }, lamps) {
  const { P, rampPick, hash2, mulberry32 } = kit;
  const rng = mulberry32(seed);
  const spires = [];
  for (let i = 0; i < n; i++) {
    const tw = 3 + ((rng() * 4) | 0);
    const tx = Math.round(cx - drx * 0.75 + rng() * (drx * 1.5 - tw));
    spires.push({ x: tx, w: tw, top: Math.round(baseY - dry * (0.2 + rng() * 0.6)) });
  }
  layer(buf, cx - drx - 1, baseY - dry - 1, cx + drx + 1, baseY + 1, (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    const dx = (px - cx) / drx;
    const dy = (py - baseY) / dry;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (dy > 0 || r > 1) return null;
    if (r > 1 - 1.3 / drx) return P.brass2;
    const span = Math.sqrt(Math.max(0, 1 - dy * dy));
    if ([-0.6, -0.2, 0.2, 0.6].some((k) => Math.abs(dx - k * span) < 0.8 / drx) || [0.35, 0.7].some((k) => Math.abs(dy + k) < 0.55 / dry)) {
      return (x + y) % 2 ? P.brass1 : P.brass2;
    }
    if (dx < -0.15 && dy < -0.3 && Math.abs(r - 0.8) < 0.06) return P.white;
    if (dx < -0.05 && dy < -0.2 && Math.abs(r - 0.8) < 0.15 && (x + y) % 2 === 0) return P.glow;
    const t = spires.find((q) => x >= q.x && x < q.x + q.w && y >= q.top);
    let col;
    if (t) {
      const lit = y > t.top && (x - t.x) % 2 === 1 && (y - t.top) % 3 === 1 && hash2(x, y, seed) < 0.85;
      col = lit ? P.lamp : rampPick([P.ink2, P.abyss2, P.abyss3], 0.35 + ((x - t.x) / t.w) * 0.3, x, y);
      if (y === t.top && (x - t.x) === (t.w >> 1)) col = P.brass3;
    } else {
      col = rampPick([P.brass0, P.brass1, P.brass2, P.brass3], 0.1 + (1 - r) * 0.2 + (1 + dy) * 0.5, x, y);
    }
    const tint = dy < -0.55 ? 0.55 : r > 0.82 ? 0.55 : 0.16;
    if (hash2(x, y, 3) < tint && (x + y) % 2 === 0) col = rampPick([P.glassD, P.glass], 0.35 - dy * 0.2, x, y);
    return col;
  });
  const top = baseY - dry;
  buf.rect(cx - 1, top - 6, 2, 6, P.brass2);
  buf.set(cx - 1, top - 6, P.brass3);
  buf.rect(cx - 1, top - 8, 2, 2, P.lamp);
  buf.set(cx, top - 9, P.brass2);
  lamps.push([cx, top - 8]);
}

function lampPost(buf, kit, x, y, h, lamps) {
  const { P } = kit;
  for (let k = 0; k < h; k++) buf.set(x, y - k, P.iron3);
  buf.rect(x - 1, y - h - 2, 3, 2, P.lamp);
  buf.set(x, y - h - 3, P.brass2);
  lamps.push([x, y - h - 1]);
}

function station(kit, accent, seed) {
  const { P, PixelBuffer, mulberry32 } = kit;
  const W = 88;
  const H = 86;
  const cx = 44;
  const baseY = 56;
  const rng = mulberry32(seed);
  const buf = new PixelBuffer(W, H);
  const lamps = [];
  // towers behind the dome
  const back = [
    { x: cx - 26, w: 7, top: Math.round(baseY - 24 - rng() * 12), roof: 5 },
    { x: cx + 19, w: 7, top: Math.round(baseY - 20 - rng() * 14), roof: 5 },
    { x: cx - 7 + Math.round(rng() * 10), w: 5, top: Math.round(baseY - 40 - rng() * 6), roof: 6 },
  ];
  for (const t of back) tower(buf, kit, { ...t, bottom: baseY, lit: 0.75, seed }, lamps);
  cylinder(buf, kit, { cx, top: baseY + 6, rx: 36, ry: 11, face: 5, accent, windows: true });
  cylinder(buf, kit, { cx, top: baseY, rx: 30, ry: 9, face: 6, accent, windows: true });
  glassDome(buf, kit, { cx, baseY, drx: 21, dry: 26, seed, towers: 7 }, lamps);
  // squat front towers at the platform's shoulders
  for (const x of [cx - 31, cx + 27]) tower(buf, kit, { x, w: 5, top: baseY - 6, bottom: baseY + 9, roof: 3, lit: 0.6, seed: seed + x }, lamps);
  lampPost(buf, kit, cx - 14, baseY + 10, 5, lamps);
  lampPost(buf, kit, cx + 14, baseY + 10, 5, lamps);
  // stair down the face
  for (let k = 0; k < 4; k++) buf.rect(cx - 4 + k, baseY + 9 + k * 2, 9 - k * 2, 1, P.abyss5);
  buf.outline(P.ink);
  return { buf, lamps };
}

function hub(kit) {
  const { P, PixelBuffer } = kit;
  const W = 132;
  const H = 122;
  const cx = 66;
  const baseY = 82;
  const buf = new PixelBuffer(W, H);
  const lamps = [];
  const towers = [
    { x: cx - 50, w: 9, top: baseY - 46, roof: 7 },
    { x: cx + 42, w: 9, top: baseY - 42, roof: 7 },
    { x: cx - 38, w: 7, top: baseY - 30, roof: 5 },
    { x: cx + 32, w: 7, top: baseY - 34, roof: 5 },
    { x: cx - 22, w: 5, top: baseY - 52, roof: 6 },
    { x: cx + 18, w: 5, top: baseY - 56, roof: 6 },
  ];
  for (const t of towers) tower(buf, kit, { ...t, bottom: baseY, lit: 0.85, seed: 5 + t.x }, lamps);
  cylinder(buf, kit, { cx, top: baseY + 8, rx: 54, ry: 15, face: 7, accent: P.brass3, windows: true });
  cylinder(buf, kit, { cx, top: baseY, rx: 46, ry: 13, face: 9, accent: P.brass3, windows: true });
  glassDome(buf, kit, { cx, baseY, drx: 33, dry: 40, seed: 5, towers: 11 }, lamps);
  // the orchestrator's seal: a trident in a brass medallion
  const my = baseY - 12;
  for (let y = -8; y <= 8; y++) {
    for (let x = -8; x <= 8; x++) {
      const d = Math.hypot(x, y);
      if (d <= 8.2) buf.set(cx + x, my + y, d > 6.6 ? P.brass3 : P.ink2);
    }
  }
  for (let y = -5; y <= 6; y++) buf.set(cx, my + y, P.brass3);
  for (const x of [-3, 3]) for (let y = -5; y <= -1; y++) buf.set(cx + x, my + y, P.brass3);
  for (let x = -3; x <= 3; x++) buf.set(cx + x, my - 1, P.brass3);
  for (const x of [-3, 0, 3]) buf.set(cx + x, my - 6, P.lamp);
  for (const x of [cx - 44, cx + 42]) tower(buf, kit, { x, w: 6, top: baseY - 8, bottom: baseY + 12, roof: 4, lit: 0.7, seed: x }, lamps);
  for (const x of [cx - 24, cx + 24]) lampPost(buf, kit, x, baseY + 14, 6, lamps);
  for (let k = 0; k < 5; k++) buf.rect(cx - 6 + k, baseY + 12 + k * 2, 13 - k * 2, 1, P.abyss5);
  buf.outline(P.ink);
  return { buf, lamps };
}

// Gothic rock pinnacles; far ones hazy, near ones dark. Some carry a lit ruin.
function pinnacles(kit) {
  const { P, paint, rampPick, hash2 } = kit;
  const make = (w, h, seed, far, ruin) => {
    const ramp = far ? [P.abyss3, P.abyss4, P.abyss5, P.abyss6] : [P.abyss0, P.abyss1, P.abyss2, P.abyss3];
    const rim = far ? P.abyss7 : P.abyss5;
    const hw = (y) => {
      const t = y / h;
      let v = (w / 2) * Math.pow(t, 0.55);
      v += (hash2(Math.floor(y / 3), 1, seed) - 0.5) * 2.2 * t;
      if (hash2(Math.floor(y / 9), 2, seed) < 0.25) v += 1.5 * t; // ledges
      return v;
    };
    const cx = w / 2;
    return paint(w, h, (x, y) => {
      const half = hw(y);
      const dx = x + 0.5 - cx;
      if (Math.abs(dx) > half) return null;
      if (ruin && y > h * 0.12 && y < h * 0.3 && Math.abs(dx) < 1.2 && y % 4 === 1) return P.lamp;
      if (dx < -half + 1.2) return rim;
      if (hash2(x, Math.floor(y / 2), seed + 7) < 0.05) return ramp[0];
      return rampPick(ramp, 0.62 - dx / (w * 0.9) - (y / h) * 0.25, x, y);
    });
  };
  return {
    sprite: 'pinnacle',
    frames: [
      { name: 'far0', buf: make(18, 92, 1, true, true) },
      { name: 'far1', buf: make(26, 128, 2, true, false) },
      { name: 'far2', buf: make(14, 70, 3, true, false) },
      { name: 'near0', buf: make(30, 150, 4, false, false) },
      { name: 'near1', buf: make(22, 118, 5, false, true) },
    ],
    meta: {},
  };
}

function ruins(kit) {
  const { P, paint, rampPick, hash2 } = kit;
  const STONE = [P.abyss2, P.abyss3, P.abyss4, P.abyss5];
  const arch = paint(38, 32, (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    const pillar = (px >= 4 && px <= 10) || (px >= 28 && px <= 34);
    const r = Math.hypot(px - 19, py - 17);
    const ring = py <= 17 && r >= 9 && r <= 15.5 && !(px > 27 && py < 8); // broken keystone side
    if ((pillar && py > 16) || ring) {
      if (hash2(x, y, 4) < 0.07) return P.kelp2;
      if ((pillar && (px < 5 || (px > 28 && px < 29))) || (ring && r > 14.5)) return P.abyss6;
      if (y % 5 === 0) return P.abyss2;
      return rampPick(STONE, 0.6 - (px - 19) / 50, x, y);
    }
    if (py > 29 && px > 1 && px < 37) return y === 30 ? P.abyss5 : P.abyss2; // footing
    return null;
  });
  const column = paint(10, 28, (x, y) => {
    const top = 4 + ((x * 3) % 3);
    if (y < top || x < 2 || x > 7) return y >= 24 && x >= 0 && x <= 9 ? P.abyss3 : null;
    if (x === 2) return P.abyss6;
    if (x === 4 || x === 6) return P.abyss3;
    return rampPick(STONE, 0.55 - x / 20, x, y);
  });
  return { sprite: 'ruin', frames: [{ name: 'arch', buf: arch.outline(P.ink) }, { name: 'column', buf: column.outline(P.ink) }], meta: {} };
}

// Anemones with bright tips, and tube coral.
function reef(kit) {
  const { P, PixelBuffer, mulberry32, paint, rampPick } = kit;
  const anemone = (ramp, seed) => {
    const rng = mulberry32(seed);
    const b = new PixelBuffer(15, 13);
    for (let i = 0; i < 9; i++) {
      let x = 3 + i * 1.1 + (rng() - 0.5);
      const h = 5 + rng() * 5;
      const lean = (i - 4) * 0.28 + (rng() - 0.5) * 0.3;
      for (let k = 0; k < h; k++) {
        x += lean * 0.35;
        b.set(x, 10 - k, k > h - 2 ? ramp[3] : ramp[1 + (k > h * 0.6 ? 1 : 0)]);
      }
    }
    for (let x = 3; x <= 11; x++) for (let y = 10; y <= 12; y++) if (Math.abs(x - 7) + (y - 10) * 2 < 6) b.set(x, y, y === 10 ? ramp[1] : ramp[0]);
    return b.padded(1).outline(P.ink);
  };
  const tubes = (ramp, seed) => {
    const rng = mulberry32(seed);
    const cols = [0, 1, 2, 3].map((i) => ({ x: 1 + i * 3 + (i > 1 ? 1 : 0), h: 6 + ((rng() * 8) | 0) }));
    return paint(15, 16, (x, y) => {
      for (const c of cols) {
        if (x >= c.x && x < c.x + 3 && y >= 15 - c.h) return y === 15 - c.h ? ramp[3] : y === 16 - c.h ? ramp[0] : x === c.x ? ramp[2] : rampPick([ramp[0], ramp[1]], 0.6 - (x - c.x) * 0.3, x, y);
      }
      return null;
    }).outline(P.ink);
  };
  return {
    sprite: 'reef',
    frames: [
      { name: 'anemonePink', buf: anemone([P.pink0, P.pink2, P.pink3, P.pink4], 1) },
      { name: 'anemoneViolet', buf: anemone([P.vio0, P.vio2, P.vio3, P.pearl], 2) },
      { name: 'anemoneOrange', buf: anemone([P.coral0, P.coral1, P.coral2, P.lamp], 3) },
      { name: 'anemoneTeal', buf: anemone([P.kelp0, P.glassD, P.glass, P.glow], 4) },
      { name: 'tubesViolet', buf: tubes([P.vio0, P.vio1, P.vio2, P.pink3], 5) },
      { name: 'tubesOrange', buf: tubes([P.coral0, P.coral1, P.coral2, P.coral3], 6) },
    ],
    meta: {},
  };
}

// Front-facing octopus mantle; the page animates its arms.
function octopus(kit) {
  const { P, paint, rampPick, hash2 } = kit;
  const buf = paint(40, 36, (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    const mantle = ((px - 20) / 13.5) ** 2 + ((py - 14) / 13) ** 2 <= 1 && py < 24;
    const skirt = py >= 20 && py <= 32 && Math.abs(px - 20) <= 11 - (py - 20) * 0.35;
    if (!mantle && !skirt) return null;
    for (const ex of [13, 24]) {
      if (x >= ex && x <= ex + 3 && y >= 20 && y <= 22) return x === ex + 1 || x === ex + 2 ? (y === 21 ? P.ink : P.brass3) : P.lamp;
    }
    if (mantle && hash2(x >> 1, y >> 1, 9) < 0.14 && py < 20) return P.pink4;
    return rampPick([P.pink0, P.pink1, P.pink2, P.pink3], 0.72 - (py - 2) / 40 - (px - 20) / 45, x, y);
  });
  return {
    sprite: 'octopus',
    frames: [{ name: 'head', buf: buf.outline(P.ink) }],
    meta: { roots: [[10, 30], [13, 32], [16, 33], [20, 33], [24, 33], [27, 32], [30, 30], [20, 31]].map(([x, y]) => [x + 0, y + 0]) },
  };
}

// Humpback, facing right, drawn at any length from continuous shapes.
function whale(kit) {
  const { P, paint, rampPick, inPoly } = kit;
  const L = 132;
  const s = L / 78;
  const frames = [-1, 1].map((flip, i) => {
    const fin = [[46, 17], [32, 27], [37, 28], [51, 19]].map(([x, y]) => [x * s, y * s]);
    const fluke = (flip < 0 ? [[0, 3], [9, 11], [9, 14], [3, 10]] : [[0, 22], [9, 14], [9, 11], [3, 15]]).map(([x, y]) => [x * s, y * s]);
    const buf = paint(Math.round(78 * s), Math.round(30 * s), (x, y) => {
      const px = x + 0.5;
      const py = y + 0.5;
      const ux = px / s;
      const uy = py / s;
      if (inPoly(px, py, fin)) return uy > 24 ? P.pearlD : uy > 21 ? P.stone3 : P.iron3;
      if (ux >= 8 && ux <= 74) {
        const u = (ux - 8) / 66;
        const top = 13 - 8.5 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.92 + 0.08)), 0.6);
        const bot = 13 + 6.5 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.88 + 0.12)), 0.75);
        if (uy >= top && uy <= bot) {
          const v = (uy - top) / (bot - top);
          if (Math.hypot(ux - 66, uy - 12) < 0.9) return P.ink;
          if (v > 0.62 && u > 0.42 && Math.floor(uy * 2.2) % 2 === 0) return P.stone3; // throat grooves
          if (u > 0.78 && v < 0.4 && (x * 7 + y * 3) % 13 === 0) return P.stone4; // barnacles
          return rampPick([P.iron1, P.iron2, P.iron3, P.stone2], 0.86 - v * 0.62, x, y);
        }
      }
      if (inPoly(px, py, fluke)) return P.iron2;
      return null;
    });
    return { name: `swim${i}`, buf: buf.outline(P.ink) };
  });
  return { sprite: 'whale', frames, meta: {} };
}

// The bridge: the great salon window with its spoked frame, Nemo at the helm,
// Aronnax at his desk under a lamp.
function bridge(kit) {
  const { P, paint, rampPick, inPoly, hash2 } = kit;
  const w = 180;
  const h = 236;
  const wc = [104, 96];
  const R = 86;
  const nemo = [[52, 236], [55, 150], [60, 133], [80, 133], [86, 150], [89, 236]];
  const arm = [[58, 142], [37, 170], [42, 174], [63, 150]];
  const aron = [[126, 236], [129, 172], [136, 162], [156, 162], [163, 174], [165, 236]];
  const shade = [[163, 150], [177, 150], [180, 160], [160, 160]];
  const buf = paint(w, h, (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    // Nemo
    const nemoCap = (py >= 106 && py <= 110 && px >= 62 && px <= 78) || (py > 110 && py <= 112 && px >= 59 && px <= 81);
    const nemoHead = Math.hypot(px - 70, py - 118) <= 7.5;
    if (nemoCap || nemoHead || inPoly(px, py, nemo) || inPoly(px, py, arm)) {
      const edge = !(inPoly(px + 1.3, py, nemo) || Math.hypot(px + 1.3 - 70, py - 118) <= 7.5 || nemoCap);
      return edge && py < 200 ? P.abyss6 : P.ink;
    }
    // helm wheel
    const wd = Math.hypot(px - 34, py - 186);
    if (wd <= 27) {
      if (wd >= 22) return wd > 25.5 ? P.wood1 : wd > 23.5 ? P.wood3 : P.wood2;
      const a = Math.atan2(py - 186, px - 34);
      if (wd <= 4.5) return wd <= 2.5 ? P.brass3 : P.brass1;
      if (Math.abs(((a / (Math.PI / 4)) % 1 + 1) % 1 - 0.5) > 0.45) return P.wood2;
    } else if (wd <= 31) {
      const a = Math.atan2(py - 186, px - 34);
      if (Math.abs(((a / (Math.PI / 4)) % 1 + 1) % 1 - 0.5) > 0.41) return P.wood3; // handles
    }
    // Aronnax, the desk lamp, books and the globe
    const aronHead = Math.hypot(px - 146, py - 152) <= 6.5;
    if (aronHead || inPoly(px, py, aron)) {
      const edge = !(inPoly(px - 1.3, py, aron) || Math.hypot(px - 1.3 - 146, py - 152) <= 6.5);
      return edge && py < 205 ? P.brass2 : P.ink;
    }
    if (inPoly(px, py, shade)) return py < 152 ? P.brass3 : P.brass1;
    if (px >= 169 && px <= 171 && py > 160 && py < 178) return P.brass1;
    if (py >= 160 && py < 178 && px > 150 && px < 180 && Math.hypot(px - 170, py - 162) < 14 && (x + y) % 2 === 0) return P.brass0; // lamplight
    if (px >= 110 && px <= 124 && py >= 166 && py < 178) {
      const book = Math.floor((py - 166) / 3);
      return [P.coral1, P.kelp2, P.vio2, P.brass1][book % 4];
    }
    if (Math.hypot(px - 98, py - 166) <= 9) return rampPick([P.glassD, P.glass, P.brass2], 0.75 - (py - 157) / 20, x, y);
    // desk / console
    if (py >= 178) {
      if (py < 180) return P.brass2;
      if (py < 182) return P.wood3;
      if ((x % 30 === 0 && py > 186) || (y === 208)) return P.wood0;
      if (x % 30 === 15 && y === 195) return P.brass2;
      return rampPick([P.wood0, P.wood1, P.wood2], 0.6 - (py - 182) / 90, x, y);
    }
    // the great window
    const d = Math.hypot(px - wc[0], py - wc[1]);
    if (d <= R) {
      if (d >= R - 8) {
        const a = Math.atan2(py - wc[1], px - wc[0]);
        const rivet = d > R - 5 && d < R - 3 && Math.abs(((a / (Math.PI / 12)) % 1 + 1) % 1 - 0.5) > 0.4;
        if (rivet) return P.lamp;
        return rampPick([P.brass0, P.brass1, P.brass2, P.brass3], 0.55 - (py - wc[1]) / 150 - (px - wc[0]) / 220, x, y);
      }
      if (d <= 20 && d >= 16) return P.brass1;
      const a = Math.atan2(py - wc[1], px - wc[0]);
      if (d > 20 && Math.abs(((a / (Math.PI / 4)) % 1 + 1) % 1 - 0.5) > 0.485) return P.brass1; // spokes
      // the sea: domes glowing on the floor, rays from above
      const floor = wc[1] + 36 + Math.sin(px * 0.08) * 4;
      const domeA = Math.hypot((px - 140) / 16, (py - (wc[1] + 38)) / 14);
      const domeB = Math.hypot((px - 76) / 10, (py - (wc[1] + 44)) / 9);
      if (py < wc[1] + 38 && domeA <= 1) return domeA > 0.86 ? P.glass : hash2(x, y, 2) < 0.25 ? P.lamp : P.abyss4;
      if (py < wc[1] + 44 && domeB <= 1) return domeB > 0.84 ? P.glass : hash2(x, y, 3) < 0.25 ? P.lamp : P.abyss4;
      if (py > floor) return rampPick([P.abyss1, P.abyss2, P.abyss3], 0.5 - (py - floor) / 40, x, y);
      const spire = Math.abs(px - 48) < 6 - (wc[1] + 36 - py) * 0.09 && py > wc[1] - 20;
      if (spire) return P.abyss2;
      const ray = Math.max(0, Math.sin((px + py * 0.45) * 0.12)) ** 8 * 0.3;
      return rampPick([P.abyss2, P.abyss3, P.abyss4, P.abyss5, P.abyss6, P.abyss7], 0.95 - (py - (wc[1] - R)) / (R * 1.9) + ray, x, y);
    }
    // bulkhead: iron ribs and rivets
    if (x % 44 === 6) return P.iron1;
    if (x % 44 === 7 && y % 9 === 4) return P.iron3;
    return rampPick([P.ink, P.ink2, P.wood0], 0.35 + (py / h) * 0.25, x, y);
  });
  return { sprite: 'bridge', frames: [{ name: 'salon', buf }], meta: { lamp: [170, 158] } };
}
