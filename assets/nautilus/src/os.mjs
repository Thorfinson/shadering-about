// Set pieces for nautilus-os.html, the top-down console, in a painterly
// pixel style: shading breaks up in organic clumps (rampSoft) instead of a
// Bayer checkerboard, and outlines are selective (a dark shade of whatever they
// border) instead of flat ink.
//
//   station.*   each built differently: glass domes in thin frames of dark
//               bronze (the sea shows through the glass) over a library, a
//               lamplit town, a laboratory or a garden; weathered towers with
//               onion, cone, lantern or dome caps; masts, a launch gantry
//   hub.*       the orchestrator's larger fortress with its trident seal
//   sub.*       a brass bathyscaphe per agent, banded in the agent's colour
//   ruin.*, reef.*   an arch and a column, anemones, tube coral
//   octopus, whale              ghostly creatures of the deep
//   bridge.*    the salon: Nemo at the window, Aronnax at his desk by lamplight
//
// Meta lists every lamp so the page can bloom them.

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
    const { buf, lamps: l } = station(kit, name, accent, seed);
    lamps[name] = l;
    return { name, buf };
  });
  const hubOut = hub(kit);
  return [
    { sprite: 'station', frames, meta: { base: [44, 58], prx: 30, pry: 9, lamps } },
    { sprite: 'hub', frames: [{ name: 'orchestrator', buf: hubOut.buf }], meta: { base: [66, 86], prx: 46, pry: 13, lamps: hubOut.lamps } },
    subs(kit),
    ruins(kit),
    reef(kit),
    octopus(kit),
    whale(kit),
    bridge(kit),
  ];
}

function layer(buf, x0, y0, x1, y1, fn) {
  for (let y = Math.max(0, y0); y < Math.min(buf.h, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(buf.w, x1); x++) {
      const c = fn(x, y);
      if (c) buf.set(x, y, c);
    }
  }
}

const ramps = (P) => ({
  metal: [P.patina0, P.patina1, P.patina2, P.patina3, P.patina4],
  bronze: [P.bronze0, P.bronze1, P.bronze2, P.bronze3, P.bronze4],
  pane: [P.pane0, P.pane1, P.pane2, P.pane3, P.pane4],
  rock: [P.rock0, P.rock1, P.rock2, P.rock3, P.rock4],
  leaf: [P.leaf0, P.leaf1, P.leaf2, P.leaf3, P.leaf4],
  warm: [P.bronze1, P.bronze2, P.bronze3, P.window, P.lamp],
});

// Blends two palette colours, for things seen through the glass.
function mix(kit, a, b, k) {
  const A = kit.rgba(a);
  const B = kit.rgba(b);
  return '#' + [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * k).toString(16).padStart(2, '0')).join('');
}
const opaqueAt = (buf, x, y) => {
  const i = (y * buf.w + x) * 4;
  if (!buf.inside(x, y) || buf.data[i + 3] < 255) return null;
  return '#' + [0, 1, 2].map((k) => buf.data[i + k].toString(16).padStart(2, '0')).join('');
};
const withAlpha = (hex, a) => hex.slice(0, 7) + Math.round(Math.min(1, Math.max(0, a)) * 255).toString(16).padStart(2, '0');

// A weathered tower: aged metal lit from the upper left, uneven cornices, a
// few warm windows among dark ones, weed at its foot, and a cap.
function tower(buf, kit, { x, w, top, bottom, cap = 'cone', lit = 0.45, seed, beacon }, lamps) {
  const { P, hash2, rampSoft, mulberry32 } = kit;
  const R = ramps(P);
  const rng = mulberry32(seed);
  const courses = [];
  for (let y = top + 3 + Math.floor(rng() * 3); y < bottom - 4; y += 6 + Math.floor(rng() * 6)) courses.push(y);
  for (let y = top; y < bottom; y++) {
    for (let i = 0; i < w; i++) {
      const X = x + i;
      const v = 0.6 - (i / Math.max(1, w - 1)) * 0.55 - ((y - top) / (bottom - top)) * 0.12 + (hash2(X, y, seed) - 0.5) * 0.14;
      let c = rampSoft(R.metal, v, X, y, seed);
      if (i === 0 && hash2(X, y >> 1, seed + 1) < 0.7) c = P.patina4;
      if (i === w - 1) c = P.patina0;
      if (y > bottom - 6 && hash2(X, y, seed + 2) < 0.3) c = hash2(X, y, seed + 3) < 0.5 ? P.moss2 : P.moss3;
      buf.set(X, y, c);
    }
  }
  for (const y of courses) {
    const over = w >= 6 ? 1 : 0;
    for (let i = -over; i < w + over; i++) buf.set(x + i, y, i <= 0 ? P.bronze3 : i < w / 2 ? P.bronze2 : P.bronze1);
  }
  const cols = w >= 8 ? [2, w - 3] : [Math.floor((w - 1) / 2)];
  for (let y = top + 3; y < bottom - 5; y += 5) {
    if (courses.some((c) => c === y || c === y + 1)) continue;
    for (const i of cols) {
      const on = hash2(x + i, y, seed + 4) < lit;
      buf.set(x + i, y, on ? P.window : P.patina0);
      buf.set(x + i, y + 1, on ? P.bronze3 : P.ink2);
    }
  }
  const tip = capOn(buf, kit, cap, x + (w - 1) / 2, top, w, seed, lamps);
  if (beacon) {
    buf.set(Math.round(x + (w - 1) / 2), tip, beacon);
    lamps.push([Math.round(x + (w - 1) / 2), tip]);
  }
}

// Caps for towers: a cone, an onion, an open lantern room or a small dome, in
// bronze gone green in patches. Returns the row above the finial.
function capOn(buf, kit, cap, cx, top, w, seed, lamps) {
  const { P, hash2 } = kit;
  const mid = Math.round(cx);
  const verd = (x, y, c) => (hash2(x, y, seed + 7) < 0.22 ? P.patina3 : c);
  const shade = (x, half) => (x < cx - half * 0.35 ? P.bronze3 : x <= cx + half * 0.3 ? P.bronze2 : P.bronze1);
  if (cap === 'none') return top - 1;
  let tip = top;
  if (cap === 'cone') {
    const h = Math.round(w * 0.9) + 2;
    for (let r = 0; r < h; r++) {
      const half = (w / 2 + 0.5) * (1 - r / h);
      for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) buf.set(x, top - 1 - r, verd(x, r, shade(x, half)));
    }
    tip = top - 1 - h;
  } else if (cap === 'onion') {
    const h = w + 3;
    const R0 = w / 2 + 1;
    for (let r = 0; r < h; r++) {
      const t = r / (h - 1);
      const half = R0 * Math.sin(Math.PI * (0.2 + 0.8 * t)) * Math.sqrt(1 - t) + 0.3;
      for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) buf.set(x, top - 1 - r, verd(x, r, shade(x, half)));
    }
    tip = top - 1 - h;
  } else if (cap === 'lantern') {
    const half = Math.max(1, Math.floor(w / 2) - 1);
    for (let r = 0; r < 5; r++) {
      for (let x = mid - half; x <= mid + half; x++) {
        const post = x === mid - half || x === mid + half;
        buf.set(x, top - 1 - r, r === 0 || r === 4 ? P.bronze1 : post ? P.bronze2 : r === 2 ? P.lamp : P.window);
      }
    }
    lamps.push([mid, top - 3]);
    for (let r = 0; r < half + 2; r++) {
      for (let x = mid - (half + 1 - r); x <= mid + (half + 1 - r); x++) buf.set(x, top - 6 - r, verd(x, r, shade(x, half + 1 - r)));
    }
    tip = top - 6 - (half + 2);
  } else if (cap === 'dome') {
    const rx = w / 2 + 0.5;
    const ry = Math.max(2, Math.round(w / 2));
    for (let r = 0; r < ry; r++) {
      const half = rx * Math.sqrt(1 - (r / ry) ** 2);
      for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) buf.set(x, top - 1 - r, verd(x, r, shade(x, half)));
    }
    tip = top - 1 - ry;
  }
  buf.set(mid, tip, P.bronze2);
  buf.set(mid, tip - 1, P.bronze4);
  return tip - 2;
}

// A radio mast: a thin pole with crossbars and a light at the top.
function mast(buf, kit, { x, top, bottom, light }, lamps) {
  const { P } = kit;
  for (let y = top; y < bottom; y++) buf.set(x, y, (y - top) % 5 === 2 ? P.bronze2 : P.patina3);
  for (let y = top + 2; y < bottom - 3; y += 5) for (const d of [-1, 1]) buf.set(x + d, y, P.bronze1);
  buf.set(x, top - 1, light);
  lamps.push([x, top - 1]);
}

// A launch gantry: open lattice, a lamp at the top and one halfway down.
function gantry(buf, kit, { x, w, top, bottom }, lamps) {
  const { P } = kit;
  for (let y = top; y < bottom; y++) {
    const k = (y - top) % (w - 1);
    for (let i = 0; i < w; i++) {
      const edge = i === 0 || i === w - 1;
      const brace = i === k || i === w - 1 - k || k === 0;
      if (edge) buf.set(x + i, y, i === 0 ? P.bronze2 : P.bronze0);
      else if (brace) buf.set(x + i, y, P.patina3);
    }
  }
  for (let i = -1; i <= w; i++) buf.set(x + i, top, i < w / 2 ? P.bronze3 : P.bronze1);
  const mid = x + (w >> 1);
  buf.set(mid, top - 1, P.bronze2);
  buf.set(mid, top - 2, P.window);
  lamps.push([mid, top - 2]);
  buf.set(x + 1, top + Math.round((bottom - top) * 0.45), P.window);
}

// One tier of a platform seen from above at an angle: a terrace on top with a
// railing along its rim, and a wall with arched windows (or bare rock) below.
function tier(buf, kit, { cx, top, rx, ry, face, seed, lit = 0.4, rock = false }) {
  const { P, rampSoft, hash2 } = kit;
  const R = ramps(P);
  const wall = rock ? R.rock : R.metal;
  layer(buf, Math.floor(cx - rx - 1), Math.floor(top - ry - 1), Math.ceil(cx + rx + 1), Math.ceil(top + ry + face + 2), (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    const ex = (px - cx) / rx;
    if (Math.abs(ex) > 1) return null;
    const frontY = top + ry * Math.sqrt(1 - ex * ex);
    if (py > frontY && py <= frontY + face) {
      const fy = py - frontY;
      if (fy < 1) return rock ? (ex < -0.2 ? P.rock4 : P.rock3) : ex < -0.3 ? P.bronze3 : P.bronze1;
      const k = x - Math.round(cx) + 400;
      if (!rock && fy > 1.8 && fy < face - 1.2 && k % 5 === 1 && Math.abs(ex) < 0.92 && hash2(k, 1, seed) > 0.2) {
        const on = hash2(k, 0, seed) < lit;
        return on ? (fy < 2.8 ? P.window : P.bronze3) : P.patina0;
      }
      if (fy > face - 1.1) return P.ink2;
      if (fy > face - 2.6 && hash2(x, y, seed + 5) < 0.28) return P.moss2;
      return rampSoft(wall, (rock ? 0.45 : 0.62) - ex * 0.35 - (fy / face) * 0.3 + (hash2(x, y, seed) - 0.5) * 0.12, x, y, seed);
    }
    const ey = (py - top) / ry;
    if (ex * ex + ey * ey > 1) return null;
    const r = Math.hypot(ex, ey);
    if (!rock && ey > 0.15 && r > 0.88) return x % 3 === 0 ? P.patina4 : P.patina2; // railing
    return rampSoft(wall, (rock ? 0.36 : 0.52) - ey * 0.15 - ex * 0.12 + (hash2(x >> 1, y, seed + 6) - 0.5) * 0.18, x, y, seed + 3);
  });
}

// What stands under a dome: a little lamplit town, a library, a laboratory or
// a garden. Returns (x, y, px, py) -> colour | null.
function interiorOf(kit, kind, { cx, baseY, drx, dry, rng, seed, accent }) {
  const { P, rampSoft, hash2, vnoise } = kit;
  const R = ramps(P);
  const floorGlow = (x, y, h) => (h < dry * 0.3 ? rampSoft(R.warm, 0.95 - h / (dry * 0.3), x, y, seed + 1) : null);
  if (kind === 'garden') {
    const trees = [];
    for (let i = 0; i < Math.round(drx / 2); i++) trees.push({ x: cx - drx * 0.8 + rng() * drx * 1.6, y: baseY - dry * (0.12 + rng() * 0.4), r: 2.5 + rng() * (drx / 5) });
    trees.sort((a, b) => a.y - b.y);
    const lights = new Set();
    for (let i = 0; i < Math.round(drx / 2.5); i++) lights.add(`${Math.round(cx - drx * 0.7 + rng() * drx * 1.4)},${Math.round(baseY - 2 - rng() * dry * 0.45)}`);
    return (x, y, px, py) => {
      if (lights.has(`${x},${y}`)) return P.window;
      const t = [...trees].reverse().find((q) => Math.hypot(px - q.x, (py - q.y) * 1.15) < q.r);
      if (t) {
        const lit = 0.55 - (py - t.y) / (t.r * 2.4) - (px - t.x) / (t.r * 3) + (vnoise(x * 0.7, y * 0.7, seed) - 0.5) * 0.5;
        return rampSoft(R.leaf, lit, x, y, seed);
      }
      return floorGlow(x, y, baseY - py);
    };
  }
  if (kind === 'lab') {
    const tanks = [];
    for (let x = cx - drx * 0.75; x < cx + drx * 0.7; x += 5 + rng() * 5) tanks.push({ x0: Math.round(x), w: 3 + Math.floor(rng() * 2), h: dry * (0.3 + rng() * 0.35), fluid: rng() < 0.35 ? accent : P.glass });
    return (x, y, px, py) => {
      const h = baseY - py;
      const t = tanks.find((q) => x >= q.x0 && x < q.x0 + q.w);
      if (t && h < t.h) {
        if (h > t.h - 1.5) return P.bronze1;
        if (x === t.x0) return P.pane4;
        return h < t.h * 0.7 ? rampSoft([P.pane1, t.fluid, P.glow], 0.4 + (vnoise(x, y * 0.4 + t.x0, seed) - 0.5), x, y, seed) : P.pane2;
      }
      if (h < 3.5) return h < 1.5 ? P.patina1 : hash2(x, y, seed) < 0.25 ? P.window : P.patina2; // benches
      return floorGlow(x, y, h);
    };
  }
  if (kind === 'library') {
    const BOOKS = [P.coral0, P.kelp1, P.coat2, P.bronze2, P.vio1, P.wood2];
    return (x, y, px, py) => {
      const h = baseY - py;
      const col = (x - Math.round(cx) + 400) % 9;
      if (h < dry * 0.62 && (col === 0 || col === 8)) return col === 0 ? P.bronze2 : P.bronze0; // columns
      if (h < dry * 0.5) {
        if (Math.floor(h) % 4 === 0) return P.bronze1; // shelf boards
        const warm = 1 - h / (dry * 0.6);
        return mix(kit, BOOKS[Math.floor(hash2(x, Math.floor(h / 4), seed) * BOOKS.length)], P.window, warm * 0.35);
      }
      if (h < dry * 0.56) return P.bronze2; // the gallery
      return h < dry * 0.72 ? rampSoft(R.warm, 0.35 - (h - dry * 0.56) / (dry * 0.4), x, y, seed) : null;
    };
  }
  // 'hall': a small town under glass, lamplit from below
  const blocks = [];
  for (let x = cx - drx * 0.85; x < cx + drx * 0.85;) {
    const w = 3 + Math.floor(rng() * 5);
    blocks.push({ x0: Math.round(x), x1: Math.round(x + w), h: dry * (0.18 + rng() * 0.42), spire: rng() < 0.3 });
    x += w + (rng() < 0.5 ? 1 + Math.floor(rng() * 2) : 0);
  }
  return (x, y, px, py) => {
    const h = baseY - py;
    const b = blocks.find((q) => x >= q.x0 && x < q.x1);
    if (b) {
      const mid = (b.x0 + b.x1 - 1) / 2;
      const inSpire = b.spire && h >= b.h && h < b.h + (b.x1 - b.x0) && Math.abs(x - mid) < (b.x1 - b.x0) / 2 - (h - b.h) / 2;
      if (h < b.h || inSpire) {
        if (!inSpire && (x - b.x0) % 2 === 1 && Math.floor(h) % 3 === 1 && h < b.h - 1.5 && x < b.x1 - 1 && hash2(x, y, seed) < 0.68) return hash2(x, y, seed + 1) < 0.3 ? P.lamp : P.window;
        const warm = 1 - h / (dry * 0.75);
        return rampSoft([P.patina0, P.patina1, P.patina2, P.bronze1, P.bronze2, P.bronze3], 0.25 + warm * 0.6 - (x === b.x1 - 1 ? 0.15 : 0) + (x === b.x0 ? 0.12 : 0), x, y, seed);
      }
    }
    return floorGlow(x, y, h);
  };
}

// A glass dome in a thin frame of dark bronze. The glass is only partly
// opaque, so the sea behind shows through; what stands inside is seen through
// a tint, and a sheen runs along the upper left.
function glassDome(buf, kit, { cx, baseY, drx, dry, seed, interior, accent }) {
  const { P, rampSoft, mulberry32, vnoise } = kit;
  const R = ramps(P);
  const rng = mulberry32(seed);
  const inside = interiorOf(kit, interior, { cx, baseY, drx, dry, rng, seed, accent });
  const n = drx > 30 ? 6 : drx > 20 ? 4 : 3;
  const ribs = Array.from({ length: n }, (_, i) => -0.86 + (1.72 * (i + 0.5)) / n + (rng() - 0.5) * 0.04);
  const rings = dry > 30 ? [0.34, 0.68] : [0.5];
  layer(buf, Math.floor(cx - drx - 1), Math.floor(baseY - dry - 1), Math.ceil(cx + drx + 1), baseY + 1, (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    const dx = (px - cx) / drx;
    const dy = (py - baseY) / dry;
    const r = Math.hypot(dx, dy);
    if (dy > 0 || r > 1) return null;
    if (r > 1 - 1.2 / Math.min(drx, dry)) return dx < -0.2 && dy < -0.3 ? P.bronze3 : P.bronze1;
    if (py > baseY - 1) return dx < -0.3 ? P.bronze3 : P.bronze2;
    const span = Math.sqrt(Math.max(0, 1 - dy * dy));
    const onRib = ribs.some((k) => Math.abs(dx - k * span) < 0.55 / drx);
    const onRing = rings.some((k) => Math.abs(dy + k) < 0.5 / dry);
    if (onRib && onRing) return P.bronze3;
    if (onRib || onRing) return dx < -0.2 && dy < -0.2 ? P.bronze2 : P.bronze1;
    let tone = 0.28 - dy * 0.22 - dx * 0.16 + (vnoise(x * 0.3, y * 0.3, seed) - 0.5) * 0.2;
    let a = 0.34 + r ** 4 * 0.5;
    if (dx < 0.05 && dy < -0.25 && Math.abs(r - 0.76) < 0.06) {
      tone = 1;
      a = 0.92;
    } else if (dx > 0.35 && dy < -0.35 && Math.abs(r - 0.84) < 0.035) {
      tone = 0.7;
      a = 0.6;
    }
    const glass = rampSoft(R.pane, tone, x, y, seed + 9);
    const inner = inside(x, y, px, py) ?? opaqueAt(buf, x, y); // what stands inside, or a tower behind
    if (inner) return a > 0.85 ? glass : mix(kit, inner, glass, 0.12 + a * 0.25);
    return withAlpha(glass, a);
  });
}

// The lantern crowning a dome: a drum of lit windows, a cornice, a bell gone
// green in patches, and a finial with a light.
function cupola(buf, kit, cx, top, s, lamps) {
  const { P, hash2 } = kit;
  for (let r = 0; r <= s; r++) {
    for (let x = cx - s; x <= cx + s; x++) {
      const edge = x === cx - s || x === cx + s;
      const win = !edge && r > 0 && r < s && (x - cx) % 2 === 0;
      buf.set(x, top - r, r === 0 || edge ? P.bronze1 : win ? (r === 1 ? P.bronze3 : P.window) : x < cx ? P.patina3 : P.patina1);
    }
  }
  for (let x = cx - s - 1; x <= cx + s + 1; x++) buf.set(x, top - s - 1, x < cx ? P.bronze3 : P.bronze1);
  const bh = s + 2;
  for (let r = 0; r < bh; r++) {
    const half = (s + 0.5) * Math.cos(((r / bh) * Math.PI) / 2) ** 0.8;
    for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) {
      buf.set(x, top - s - 2 - r, hash2(x, r, 5) < 0.25 ? P.patina3 : x < cx - half * 0.3 ? P.bronze3 : x <= cx + half * 0.4 ? P.bronze2 : P.bronze1);
    }
  }
  const tip = top - s - 2 - bh;
  buf.set(cx, tip, P.bronze2);
  buf.set(cx, tip - 1, P.bronze4);
  lamps.push([cx, top - Math.ceil(s / 2)]);
}

function lampPost(buf, kit, x, y, h, lamps) {
  const { P } = kit;
  for (let k = 0; k < h; k++) buf.set(x, y - k, k % 3 ? P.patina3 : P.bronze1);
  buf.set(x - 1, y - h - 1, P.bronze1);
  buf.set(x + 1, y - h - 1, P.bronze1);
  buf.set(x, y - h - 1, P.window);
  buf.set(x, y - h - 2, P.bronze2);
  lamps.push([x, y - h - 1]);
}

// Every station is built differently. Back towers stand behind the platform,
// front towers on its rim; x is relative to the centre, h is the height.
const LAYOUTS = {
  knowledge: {
    domes: [{ dx: 0, drx: 28, dry: 31, interior: 'library', cupola: 3 }],
    back: [{ x: -33, w: 8, h: 44, cap: 'onion' }, { x: 24, w: 6, h: 32, cap: 'lantern' }],
    front: [{ x: -34, w: 5, h: 14, cap: 'cone' }],
  },
  documents: {
    domes: [{ dx: 4, drx: 26, dry: 30, interior: 'hall', cupola: 2 }],
    back: [{ x: -31, w: 7, h: 56, cap: 'lantern' }, { x: -23, w: 5, h: 34, cap: 'cone' }, { x: 26, w: 6, h: 26, cap: 'dome' }],
    front: [{ x: 29, w: 5, h: 13, cap: 'onion' }],
  },
  models: {
    domes: [{ dx: -10, drx: 20, dry: 25, interior: 'lab', cupola: 2 }, { dx: 20, drx: 13, dry: 18, interior: 'hall', cupola: 1 }],
    back: [{ x: 2, w: 8, h: 52, cap: 'lantern' }, { x: -34, w: 5, h: 28, cap: 'onion' }],
    front: [{ x: 30, w: 5, h: 12, cap: 'cone' }],
  },
  repos: {
    domes: [{ dx: 5, drx: 25, dry: 28, interior: 'hall', cupola: 2 }],
    back: [{ x: -34, w: 9, h: 26, cap: 'dome' }, { x: -26, w: 3, h: 42, cap: 'none' }, { x: 27, w: 6, h: 36, cap: 'onion' }],
    front: [{ x: -35, w: 5, h: 12, cap: 'lantern' }],
  },
  tests: {
    domes: [{ dx: 0, drx: 31, dry: 24, interior: 'lab', cupola: 2 }],
    masts: [{ x: -26, h: 40 }, { x: 27, h: 34 }],
    back: [{ x: -34, w: 6, h: 22, cap: 'cone' }],
    front: [{ x: 30, w: 5, h: 14, cap: 'lantern' }],
  },
  memory: {
    domes: [{ dx: 0, drx: 26, dry: 31, interior: 'garden', cupola: 4 }],
    back: [{ x: -33, w: 6, h: 36, cap: 'onion' }, { x: 27, w: 6, h: 29, cap: 'onion' }],
    front: [{ x: -34, w: 4, h: 12, cap: 'lantern' }, { x: 30, w: 4, h: 10, cap: 'lantern' }],
  },
  deploy: {
    domes: [{ dx: -6, drx: 22, dry: 26, interior: 'garden', cupola: 2 }],
    gantry: { x: 20, w: 6, h: 48 },
    back: [{ x: -33, w: 6, h: 26, cap: 'cone' }],
    front: [{ x: -35, w: 5, h: 12, cap: 'dome' }],
  },
};

function station(kit, key, accent, seed) {
  const { P, PixelBuffer } = kit;
  const L = LAYOUTS[key];
  const W = 88;
  const H = 88;
  const cx = 44;
  const baseY = 58;
  const buf = new PixelBuffer(W, H);
  const lamps = [];
  L.back.forEach((t, i) => {
    const spec = { x: cx + t.x, w: t.w, top: baseY - t.h, bottom: baseY + 2, cap: t.cap, seed: seed + i * 7, beacon: i === 0 ? accent : null };
    if (t.cap === 'none') spec.lit = 0;
    tower(buf, kit, spec, lamps);
  });
  for (const m of L.masts ?? []) mast(buf, kit, { x: cx + m.x, top: baseY - m.h, bottom: baseY + 2, light: accent }, lamps);
  if (L.gantry) gantry(buf, kit, { x: cx + L.gantry.x, w: L.gantry.w, top: baseY - L.gantry.h, bottom: baseY + 2 }, lamps);
  tier(buf, kit, { cx, top: baseY + 6, rx: 36, ry: 11, face: 5, seed, rock: true });
  tier(buf, kit, { cx, top: baseY, rx: 30, ry: 9, face: 6, seed: seed + 1, lit: 0.45 });
  for (const d of L.domes) {
    const dcx = cx + d.dx;
    glassDome(buf, kit, { cx: dcx, baseY: baseY + 1, drx: d.drx, dry: d.dry, seed: seed + d.dx, interior: d.interior, accent });
    cupola(buf, kit, dcx, baseY - d.dry, d.cupola, lamps);
  }
  L.front.forEach((t, i) => tower(buf, kit, { x: cx + t.x, w: t.w, top: baseY + 10 - t.h, bottom: baseY + 10, cap: t.cap, seed: seed + 50 + i }, lamps));
  lampPost(buf, kit, cx - 13, baseY + 10, 4, lamps);
  lampPost(buf, kit, cx + 13, baseY + 10, 4, lamps);
  for (let k = 0; k < 4; k++) buf.rect(cx - 4 + k, baseY + 9 + k * 2, 9 - k * 2, 1, k % 2 ? P.patina2 : P.patina3);
  buf.outline('auto');
  return { buf, lamps };
}

function hub(kit) {
  const { P, PixelBuffer } = kit;
  const W = 132;
  const H = 126;
  const cx = 66;
  const baseY = 86;
  const buf = new PixelBuffer(W, H);
  const lamps = [];
  const back = [
    { x: -54, w: 9, h: 46, cap: 'onion' },
    { x: 45, w: 9, h: 50, cap: 'lantern' },
    { x: -43, w: 7, h: 30, cap: 'cone' },
    { x: 36, w: 6, h: 32, cap: 'dome' },
  ];
  back.forEach((t, i) => tower(buf, kit, { x: cx + t.x, w: t.w, top: baseY - t.h, bottom: baseY + 2, cap: t.cap, seed: 60 + i * 11 }, lamps));
  tier(buf, kit, { cx, top: baseY + 8, rx: 54, ry: 15, face: 7, seed: 7, rock: true });
  tier(buf, kit, { cx, top: baseY, rx: 46, ry: 13, face: 9, seed: 8, lit: 0.5 });
  glassDome(buf, kit, { cx, baseY: baseY + 1, drx: 36, dry: 42, seed: 5, interior: 'garden', accent: P.glow });
  cupola(buf, kit, cx, baseY - 42, 5, lamps);
  // the orchestrator's seal: a pale trident on a dark disc in a riveted bronze ring
  const my = baseY - 17;
  for (let y = -11; y <= 11; y++) {
    for (let x = -11; x <= 11; x++) {
      const d = Math.hypot(x, y);
      if (d > 11.2) continue;
      const a = Math.atan2(y, x);
      const rivet = d > 9 && d < 10.6 && Math.abs(((a / (Math.PI / 6)) % 1 + 1) % 1 - 0.5) > 0.42;
      let c = P.ink2;
      if (d > 8.2) c = rivet ? P.bronze4 : d > 10.6 ? P.bronze0 : x + y < -4 ? P.bronze3 : P.bronze1;
      else if (d > 7.4) c = P.bronze0;
      else if (x + y < -6 && d > 6) c = P.patina1;
      buf.set(cx + x, my + y, c);
    }
  }
  for (let y = -5; y <= 7; y++) buf.set(cx, my + y, P.pearlD);
  for (const x of [-4, 4]) for (let y = -5; y <= -1; y++) buf.set(cx + x, my + y, P.pearlD);
  for (let x = -4; x <= 4; x++) buf.set(cx + x, my - 1 + (Math.abs(x) === 4 ? 0 : 1), P.pearlD);
  for (const x of [-4, 0, 4]) buf.set(cx + x, my - 6, P.pearl);
  [{ x: -48, w: 6, h: 20, cap: 'lantern' }, { x: 42, w: 6, h: 18, cap: 'onion' }].forEach((t, i) => {
    tower(buf, kit, { x: cx + t.x, w: t.w, top: baseY + 12 - t.h, bottom: baseY + 12, cap: t.cap, seed: 90 + i }, lamps);
  });
  for (const x of [cx - 24, cx + 24]) lampPost(buf, kit, x, baseY + 14, 5, lamps);
  for (let k = 0; k < 5; k++) buf.rect(cx - 6 + k, baseY + 12 + k * 2, 13 - k * 2, 1, k % 2 ? P.patina2 : P.patina3);
  buf.outline('auto');
  return { buf, lamps };
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
