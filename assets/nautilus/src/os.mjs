// Set pieces for nautilus-os.html, the top-down console, in a painterly
// pixel style: shading breaks up in organic clumps (rampSoft) instead of a
// Bayer checkerboard, and outlines are selective (a dark shade of whatever they
// border) instead of flat ink.
//
// (The station fortresses and the hub are in places.mjs.)
//
//   sub.*       a brass bathyscaphe per agent, banded in the agent's colour
//   ruin.*, reef.*   an arch and a column, anemones, tube coral
//   octopus, whale              ghostly creatures of the deep
//   bridge.*    the salon: Nemo at the window, Aronnax at his desk by lamplight

export default function generate(kit) {
  return [
    subs(kit),
    ruins(kit),
    reef(kit),
    octopus(kit),
    whale(kit),
    bridge(kit),
  ];
}

// A brass bathyscaphe with a big glowing viewport, banded in the agent's colour.
function subs(kit) {
  const { P, paint, rampSoft, inPoly } = kit;
  const agents = { aronnax: P.research, conseil: P.analyze, ned: P.build, cyrus: P.model, lidenbrock: P.test, barbicane: P.deploy, axel: P.remember };
  const HULL = [P.brass0, P.brass1, P.brass2, P.brass3, P.lamp];
  const frames = [];
  for (const [id, accent] of Object.entries(agents)) {
    for (const f of [0, 1]) {
      const buf = paint(30, 20, (x, y) => {
        const px = x + 0.5;
        const py = y + 0.5;
        const pd = Math.hypot(px - 22.5, py - 11);
        if (pd <= 4.7) {
          if (pd > 3.5) return pd > 4.2 ? P.brass1 : py < 11 ? P.brass3 : P.brass2;
          if (Math.hypot(px - 21.4, py - 9.8) < 1.1) return P.white;
          return rampSoft([P.glassD, P.glass, P.glow], 0.95 - pd / 3.5 - (py - 11) / 10, x, y, 4);
        }
        const hx = (px - 14) / 11;
        const hy = (py - 11.5) / 6.6;
        const hd = hx * hx + hy * hy;
        if (hd <= 1) {
          if (Math.abs(px - 9) < 1) return accent;
          if (Math.abs(py - 14) < 0.5 && x % 3 === 0) return P.brass0;
          return rampSoft(HULL, 0.82 - hy * 0.5 - hx * 0.1 - (hd > 0.78 ? 0.18 : 0), x, y, 2);
        }
        if (px >= 11 && px <= 18 && py >= 3.5 && py < 6.5) {
          if (py < 4.5 && (px < 12 || px > 17)) return null;
          return py < 4.5 ? P.brass3 : px < 13 ? P.brass2 : P.brass1;
        }
        if (px >= 15 && px <= 16 && py >= 0.5 && py < 3.5) return py < 1.5 ? P.brass2 : P.iron3;
        if (inPoly(px, py, [[3, 6], [8, 8], [8, 9.5], [2, 8.5]])) return P.brass1;
        if (inPoly(px, py, [[3, 17], [8, 15], [8, 13.5], [2, 14.5]])) return P.brass1;
        if (px >= 0.5 && px <= 3) {
          const blade = f ? (py > 7 && py < 10) || (py > 13 && py < 16) : py > 9.5 && py < 13.5;
          if (blade) return P.iron4;
          if (px > 1.8 && py > 10 && py < 13) return P.iron2;
        }
        return null;
      }).padded(1).outline('auto');
      frames.push({ name: `${id}.run${f}`, buf });
    }
  }
  return { sprite: 'sub', frames, meta: { lamp: [27, 12] } };
}

function ruins(kit) {
  const { P, paint, rampSoft, hash2 } = kit;
  const STONE = [P.cliff2, P.cliff3, P.cliff4, P.abyss5];
  const arch = paint(38, 32, (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    const pillar = (px >= 4 && px <= 10) || (px >= 28 && px <= 34);
    const r = Math.hypot(px - 19, py - 17);
    const ring = py <= 17 && r >= 9 && r <= 15.5 && !(px > 27 && py < 8);
    if ((pillar && py > 16) || ring) {
      if (hash2(x, y, 4) < 0.1) return P.moss4;
      if ((pillar && (px < 5 || (px > 28 && px < 29))) || (ring && r > 14.5)) return P.abyss6;
      return rampSoft(STONE, 0.6 - (px - 19) / 50, x, y, 3);
    }
    if (py > 29 && px > 1 && px < 37) return y === 30 ? P.moss3 : P.cliff2;
    return null;
  });
  const column = paint(10, 28, (x, y) => {
    const top = 4 + ((x * 3) % 3);
    if (y < top || x < 2 || x > 7) return y >= 24 && x >= 0 && x <= 9 ? P.cliff3 : null;
    if (x === 2) return P.abyss6;
    return rampSoft(STONE, 0.55 - x / 20, x, y, 5);
  });
  return { sprite: 'ruin', frames: [{ name: 'arch', buf: arch.outline('auto') }, { name: 'column', buf: column.outline('auto') }], meta: {} };
}

function reef(kit) {
  const { P, PixelBuffer, mulberry32, paint, rampSoft } = kit;
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
    return b.padded(1).outline('auto');
  };
  const tubes = (ramp, seed) => {
    const rng = mulberry32(seed);
    const cols = [0, 1, 2, 3].map((i) => ({ x: 1 + i * 3 + (i > 1 ? 1 : 0), h: 6 + ((rng() * 8) | 0) }));
    return paint(15, 16, (x, y) => {
      for (const c of cols) {
        if (x >= c.x && x < c.x + 3 && y >= 15 - c.h) return y === 15 - c.h ? ramp[3] : y === 16 - c.h ? ramp[0] : x === c.x ? ramp[2] : rampSoft([ramp[0], ramp[1]], 0.6 - (x - c.x) * 0.3, x, y, seed);
      }
      return null;
    }).outline('auto');
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

// A pale, ghostly octopus for the far water; the page animates its arms.
function octopus(kit) {
  const { P, paint, rampSoft, hash2 } = kit;
  const GHOST = [P.ghost0, P.ghost1, P.ghost2, P.ghost3];
  const buf = paint(40, 36, (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    const mantle = ((px - 20) / 13.5) ** 2 + ((py - 14) / 13) ** 2 <= 1 && py < 24;
    const skirt = py >= 20 && py <= 32 && Math.abs(px - 20) <= 11 - (py - 20) * 0.35;
    if (!mantle && !skirt) return null;
    for (const ex of [13, 24]) {
      if (x >= ex && x <= ex + 3 && y >= 20 && y <= 22) return x === ex + 1 || x === ex + 2 ? (y === 21 ? P.ghost0 : P.stone4) : P.ghost3;
    }
    if (mantle && hash2(x >> 1, y >> 1, 9) < 0.12 && py < 20) return P.ghost3;
    return rampSoft(GHOST, 0.72 - (py - 2) / 40 - (px - 20) / 45, x, y, 6);
  });
  return {
    sprite: 'octopus',
    frames: [{ name: 'head', buf: buf.outline('auto') }],
    meta: { roots: [[10, 30], [13, 32], [16, 33], [20, 33], [24, 33], [27, 32], [30, 30], [20, 31]] },
  };
}

// Humpback, facing right, drawn from continuous shapes at any length.
function whale(kit) {
  const { P, paint, rampSoft, inPoly } = kit;
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
      if (inPoly(px, py, fin)) return uy > 24 ? P.floor5 : P.floor4;
      if (ux >= 8 && ux <= 74) {
        const u = (ux - 8) / 66;
        const top = 13 - 8.5 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.92 + 0.08)), 0.6);
        const bot = 13 + 6.5 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.88 + 0.12)), 0.75);
        if (uy >= top && uy <= bot) {
          const v = (uy - top) / (bot - top);
          if (Math.hypot(ux - 66, uy - 12) < 0.9) return P.cliff0;
          if (v > 0.62 && u > 0.42 && Math.floor(uy * 2.2) % 2 === 0) return P.floor5;
          return rampSoft([P.cliff2, P.cliff3, P.floor3, P.floor4], 0.86 - v * 0.62, x, y, 7);
        }
      }
      if (inPoly(px, py, fluke)) return P.cliff3;
      return null;
    });
    return { name: `swim${i}`, buf: buf.outline('auto') };
  });
  return { sprite: 'whale', frames, meta: {} };
}

// The bridge by lamplight: the great spoked window, Nemo standing at it in his
// hat, Aronnax at his desk with a lantern, books and a brass globe.
function bridge(kit) {
  const { P, paint, rampSoft, inPoly, hash2 } = kit;
  const w = 180;
  const h = 236;
  const wc = [98, 186];
  const R = 176;
  const lamp = [84, 152];
  const nemoBody = [[26, 236], [28, 150], [36, 128], [64, 128], [72, 150], [74, 236]];
  const nemoArm = [[66, 142], [80, 172], [74, 176], [62, 150]];
  const chair = [[84, 236], [86, 150], [120, 150], [122, 236]];
  const aron = [[92, 186], [94, 150], [100, 140], [116, 140], [120, 152], [120, 186]];
  const coat = [P.coat0, P.coat1, P.coat2];
  // figures are lit: cool window light from behind, warm lamplight on the side
  // that faces the lantern
  const lit = (px, py, inside, cool, warm) => {
    const toLamp = Math.sign(lamp[0] - px) || 1;
    const edgeL = !inside(px + 1.5 * toLamp, py);
    const edgeB = !inside(px - 1.5 * toLamp, py);
    const edgeT = !inside(px, py - 1.5);
    const d = Math.hypot(px - lamp[0], py - lamp[1]);
    if ((edgeL || (edgeT && d < 40)) && d < 70) return warm;
    if (edgeB || edgeT) return cool;
    return null;
  };
  const buf = paint(w, h, (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    const lampD = Math.hypot(px - lamp[0], py - lamp[1]);
    // the lantern itself
    if (px >= lamp[0] - 4 && px <= lamp[0] + 4 && py >= lamp[1] - 7 && py <= lamp[1] + 5) {
      if (px < lamp[0] - 3 || px > lamp[0] + 3 || py < lamp[1] - 6 || py > lamp[1] + 4) return P.brass1;
      return Math.abs(px - lamp[0]) < 1.5 && Math.abs(py - lamp[1]) < 2.5 ? P.white : P.lamp;
    }
    if (px >= lamp[0] - 1 && px <= lamp[0] + 1 && py > lamp[1] + 5 && py < 176) return P.brass2;
    // books and the globe on the desk
    if (px >= 125 + Math.floor((py - 164) / 3) % 2 && px <= 140 - Math.floor((py - 164) / 4) % 2 && py >= 164 && py < 176) {
      if ((py - 164) % 3 === 2.5) return P.wood0;
      return px < 127 + Math.floor((py - 164) / 3) % 2 ? P.paper : [P.coral0, P.kelp1, P.coat2, P.wood2][Math.floor((py - 164) / 3) % 4];
    }
    const gd = Math.hypot(px - 154, py - 154);
    if (gd <= 11) return gd > 10 ? P.brass2 : rampSoft([P.glassD, P.glass, P.brass2, P.brass3], 0.85 - (px - 143) / 26 + (lampD < 75 ? 0.1 : 0), x, y, 2);
    if (px >= 152 && px <= 156 && py > 165 && py < 176) return P.brass1;
    if (px >= 148 && px <= 160 && py >= 174 && py < 176) return P.brass2;
    // Aronnax at the desk, seen from behind, and his chair
    const inAron = (qx, qy) => inPoly(qx, qy, aron) || Math.hypot(qx - 108, qy - 132) <= 7.5;
    if (inAron(px, py)) {
      if (Math.hypot(px - 108, py - 132) <= 7.5) return lit(px, py, inAron, P.coat2, P.skin1) ?? rampSoft([P.cliff0, P.skin0], 0.2, x, y, 1);
      return lit(px, py, inAron, P.coat2, P.brass2) ?? rampSoft(coat, 0.35 + (px - 94) / 80, x, y, 1);
    }
    if (inPoly(px, py, chair)) {
      if (py < 153 || px < 88 || px > 118) return (x + y) % 5 === 0 ? P.brass3 : P.wood2;
      return rampSoft([P.wood0, P.wood1, P.wood2], 0.45 + (lampD < 50 ? 0.3 : 0) - (py - 150) / 200, x, y, 3);
    }
    // Nemo at the window, in his hat
    const inHat = (qx, qy) => (qy >= 80 && qy <= 94 && qx >= 40 && qx <= 58) || (qy > 94 && qy <= 97 && qx >= 36 && qx <= 62);
    const inHead = (qx, qy) => Math.hypot(qx - 49, qy - 106) <= 9;
    const inNemo = (qx, qy) => inPoly(qx, qy, nemoBody) || inPoly(qx, qy, nemoArm) || inHead(qx, qy) || inHat(qx, qy) || (qy > 112 && qy < 130 && Math.abs(qx - 50) < 6);
    if (inNemo(px, py)) {
      if (inHat(px, py)) return lit(px, py, inNemo, P.coat2, P.coat2) ?? (py > 92 && py < 94 ? P.brass1 : P.coat0);
      if (inHead(px, py)) return px > 53 ? P.skin0 : lit(px, py, inNemo, P.coat2, P.skin1) ?? P.cliff0;
      const fold = Math.abs(px - 50) < 0.8 && py > 132;
      return lit(px, py, inNemo, P.abyss6, P.brass1) ?? (fold ? P.coat0 : rampSoft(coat, 0.45 + (px - 50) / 60 - (py - 130) / 300, x, y, 4));
    }
    // helm wheel
    const wd = Math.hypot(px - 18, py - 200);
    if (wd <= 27) {
      if (wd >= 22) return wd > 25.5 ? P.wood1 : wd > 23.5 ? P.wood3 : P.wood2;
      const a = Math.atan2(py - 200, px - 18);
      if (wd <= 4.5) return wd <= 2.5 ? P.brass3 : P.brass1;
      if (Math.abs(((a / (Math.PI / 4)) % 1 + 1) % 1 - 0.5) > 0.45) return P.wood2;
    }
    // desk
    if (py >= 176) {
      if (py < 178) return lampD < 60 ? P.brass3 : P.brass2;
      if (py < 181) return rampSoft([P.wood2, P.wood3, P.brass2], 0.3 + Math.max(0, 1 - lampD / 70) * 0.7, x, y, 5);
      if ((x % 30 === 0 && py > 186) || y === 210) return P.wood0;
      if (x % 30 === 15 && y === 196) return P.brass2;
      return rampSoft([P.wood0, P.wood1, P.wood2, P.wood3], 0.25 + Math.max(0, 1 - lampD / 90) * 0.55 - (py - 182) / 160, x, y, 6);
    }
    // the great window: riveted arch, spokes, the lit sea beyond
    const d = Math.hypot(px - wc[0], py - wc[1]);
    if (d <= R) {
      const a = Math.atan2(py - wc[1], px - wc[0]);
      const warmth = Math.max(0, 1 - lampD / 90) * 0.35;
      if (d >= R - 12) {
        // the frame: dark bronze, a lit bevel, bolts every few degrees
        const seg = ((a / (Math.PI / 12)) % 1 + 1) % 1;
        const bolt = Math.hypot((seg - 0.5) * (Math.PI / 12) * d, d - (R - 6)) < 2.6;
        if (bolt) return Math.hypot((seg - 0.5) * (Math.PI / 12) * d + 0.8, d - (R - 6) + 0.8) < 1.2 ? P.brass3 : P.brass1;
        if (d > R - 1.5 || d < R - 10.5) return P.brass0;
        if (d < R - 9.5) return P.brass2;
        return rampSoft([P.wood0, P.brass0, P.brass1, P.brass2], 0.35 - (py - 60) / 300 + warmth, x, y, 7);
      }
      if (Math.abs(d - 100) < 4) {
        const seg = ((a / (Math.PI / 8)) % 1 + 1) % 1;
        if (Math.abs(seg - 0.5) < 0.06 && Math.abs(d - 100) < 2.5) return P.brass3;
        return d > 102.5 || d < 97.5 ? P.brass0 : rampSoft([P.brass0, P.brass1, P.brass2], 0.4 + warmth, x, y, 11);
      }
      if (Math.abs(((a / (Math.PI / 5)) % 1 + 1) % 1 - 0.5) > 0.485 && d > 30) return rampSoft([P.brass0, P.brass1], 0.5 + warmth, x, y, 12);
      // beyond the glass: spires in the mist with lit windows, violet coral close by
      const floor = 150 + Math.sin(px * 0.07) * 5;
      for (const [cx, cy, r] of [[118, 150, 13], [132, 144, 10], [150, 152, 12], [168, 140, 14], [176, 150, 9]]) {
        const cd = Math.hypot(px - cx, (py - cy) * 1.2);
        if (cd <= r * (0.8 + 0.25 * kit.vnoise(Math.atan2(py - cy, px - cx) * 3, 0, cx))) {
          const v = 0.55 - (px - cx) / (r * 2.2) - (py - cy) / (r * 2.4);
          return rampSoft([P.vio0, P.vio1, P.vio2, P.vio3], v - 0.1 + (hash2(x, y, 4) - 0.5) * 0.25, x, y, 8);
        }
      }
      if (py > floor) return rampSoft([P.rock1, P.rock2, P.silt1, P.silt2], 0.65 - (py - floor) / 30, x, y, 8);
      for (const [sx, st, sw] of [[22, 40, 9], [44, 70, 7], [86, 30, 10], [104, 84, 6], [140, 56, 9], [162, 90, 7]]) {
        const t = (py - st) / (floor - st);
        const hw = sw * Math.pow(Math.max(0, t), 0.7) + (kit.vnoise(py * 0.2, 0, sx) - 0.5) * 2.5;
        if (t > 0 && Math.abs(px - sx) < hw) {
          if (hash2(x, y, sx) < 0.012) return P.window;
          const fog = 0.35 + (sx % 3) * 0.12;
          return rampSoft([P.rock1, P.rock2, P.rock3, P.mist1, P.mist2], (px < sx - hw + 1.5 ? 0.45 : 0.15) + fog + t * 0.25, x, y, 13);
        }
      }
      const ray = Math.max(0, Math.sin((px + py * 0.45) * 0.1)) ** 8 * 0.3;
      return rampSoft([P.mist0, P.mist1, P.mist2, P.mist3, P.mist4], 0.95 - (py - 10) / 150 + ray, x, y, 9);
    }
    // bulkhead
    if (x % 44 === 6) return P.iron1;
    if (x % 44 === 7 && y % 9 === 4) return P.brass1;
    return rampSoft([P.ink, P.ink2, P.wood0], 0.35 + (py / h) * 0.3, x, y, 10);
  });
  return { sprite: 'bridge', frames: [{ name: 'salon', buf }], meta: { lamp } };
}
