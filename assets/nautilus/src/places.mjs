// The station fortresses and the orchestrator's hub for nautilus-os.html,
// each built differently, in aged metal with a green-teal patina, dark bronze
// and old glass that lets the sea show through:
//
//   station.knowledge   a library hall, its great arched door open on shelves
//   station.documents   a plaza with a circle of runes and a pedestal of light
//   station.models      a glass tank with a hologram whale, floating screens
//   station.repos       a container depot under a crane, two smokestacks
//   station.tests       a glass sphere with a glowing core in orbit rings
//   station.memory      a glass dome with a violet brain inside
//   station.deploy      a dry dock with a submarine under a portal crane
//   hub.orchestrator    a keep with a turning globe in a bronze cradle
//   fx.*                the animated parts the page lays over them: the globe
//                       turning, open books of light, the hologram whale
//
// Meta lists every lamp so the page can bloom them, and where each station's
// animated parts go.

export default function generate(kit) {
  const { P } = kit;
  const BUILD = {
    knowledge: [library, P.research, 3],
    documents: [plaza, P.analyze, 11],
    models: [tank, P.model, 19],
    repos: [depot, P.build, 27],
    tests: [reactor, P.test, 35],
    memory: [brainDome, P.remember, 43],
    deploy: [drydock, P.deploy, 51],
  };
  const lamps = {};
  const fx = {};
  const frames = Object.entries(BUILD).map(([name, [make, accent, seed]]) => {
    const out = make(kit, accent, seed);
    lamps[name] = out.lamps;
    fx[name] = out.fx;
    return { name, buf: out.buf };
  });
  const h = hub(kit);
  return [
    { sprite: 'station', frames, meta: { base: [44, 58], prx: 30, pry: 9, lamps, fx } },
    { sprite: 'hub', frames: [{ name: 'orchestrator', buf: h.buf }], meta: { base: [66, 86], prx: 46, pry: 13, lamps: h.lamps, globe: h.globe } },
    { sprite: 'fx', frames: [...globeFrames(kit, 16), ...bookFrames(kit), ...holoWhaleFrames(kit)], meta: { globeFrames: 16 } },
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
      // windows: one row on a low wall, rows of them up a tall one
      const row = face > 9 ? Math.floor((fy - 2) / 5) : 0;
      const inRow = face > 9 ? (fy - 2) % 5 < 2 && fy < face - 2 : fy > 1.8 && fy < face - 1.2;
      if (!rock && fy > 1.8 && inRow && k % 5 === 1 && Math.abs(ex) < 0.92 && hash2(k, row + 1, seed) > 0.2) {
        const on = hash2(k, row, seed) < lit;
        return on ? ((fy - 2) % 5 < 1 || (face <= 9 && fy < 2.8) ? P.window : P.bronze3) : P.patina0;
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
  if (kind === 'brain') {
    const bx = cx;
    const by = baseY - dry * 0.42;
    const brx = drx * 0.62;
    const bry = dry * 0.4;
    const BRAIN = [P.vio0, P.vio1, P.vio2, P.vio3, P.pink3];
    return (x, y, px, py) => {
      const ex = (px - bx) / brx;
      const ey = (py - by) / bry;
      const d = ex * ex + ey * ey;
      if (d <= 1) {
        if (Math.abs(ex) < 0.05 && ey < 0.7) return P.vio0; // the fissure between the halves
        const fold = Math.sin(px * 0.95 + Math.sin(py * 0.7) * 2.2 + vnoise(px * 0.3, py * 0.3, seed) * 3) * Math.sin(py * 0.85 + Math.sin(px * 0.5) * 1.5);
        return rampSoft(BRAIN, 0.7 - ey * 0.3 - ex * 0.15 - d * 0.25 + (Math.abs(fold) < 0.2 ? -0.45 : 0.05), x, y, seed);
      }
      if (Math.abs(px - bx) < 2.5 && py > by + bry - 1 && py < baseY - 1) return P.vio1; // the stem
      const h = baseY - py;
      return h < dry * 0.16 ? rampSoft([P.vio0, P.vio1, P.vio2, P.vio3], 0.85 - h / (dry * 0.16), x, y, seed) : null;
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


// An oblique box: a lit top face over a front face with a cornice, rows of
// small windows (a few lit) and optional container ribs or a painted stripe.
function box(buf, kit, { x, y, w, h, d = 3, tone = 0.5, seed, lit = 0.4, ribs = false, stripe = null, windows = true }) {
  const { P, rampSoft, hash2 } = kit;
  const R = ramps(P);
  for (let j = 0; j < d; j++) {
    for (let i = 0; i < w; i++) {
      const X = x + i;
      const Y = y - h - d + j;
      buf.set(X, Y, j === 0 && i < w * 0.4 ? P.patina4 : rampSoft(R.metal, tone + 0.28 - (i / w) * 0.2 + (hash2(X, Y, seed) - 0.5) * 0.12, X, Y, seed));
    }
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const X = x + i;
      const Y = y - h + j;
      let c = rampSoft(R.metal, tone - (i / w) * 0.3 - (j / h) * 0.15 + (hash2(X, Y, seed) - 0.5) * 0.12, X, Y, seed);
      if (i === 0) c = P.patina4;
      else if (i === w - 1) c = P.patina0;
      else if (j === 0) c = i < w / 3 ? P.bronze3 : P.bronze1;
      else if (stripe && j === 2) c = stripe;
      else if (windows && j >= 3 && j < h - 2 && (j - 3) % 3 === 0 && i % 3 === 1 && i < w - 2) c = hash2(X, Y, seed + 1) < lit ? P.window : P.patina0;
      else if (ribs && i % 3 === 0) c = P.patina1;
      if (j === h - 1) c = P.ink2;
      buf.set(X, Y, c);
    }
  }
}

// Coral in the sprite itself: a clump of round heads, darkest at the root.
function coralClump(buf, kit, x, y, fam, size, seed) {
  const { P, rampSoft, hash2, mulberry32 } = kit;
  const FAM = {
    pink: [P.pink1, P.pink2, P.pink3, P.pink4],
    violet: [P.vio1, P.vio2, P.vio3, P.pink4],
    orange: [P.coral0, P.coral1, P.coral2, P.coral3],
    teal: [P.glassD, P.glass, P.glow, P.pearl],
  }[fam];
  const rng = mulberry32(seed);
  for (let k = 0; k < 2 + size; k++) {
    const bx = x + (rng() - 0.5) * size * 3;
    const by = y - rng() * size * 1.3 - 1;
    const r = 0.8 + rng() * (0.5 + size * 0.35);
    for (let j = -Math.ceil(r); j <= Math.ceil(r); j++) {
      for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) {
        if (i * i + j * j > r * r) continue;
        buf.set(bx + i, by + j, rampSoft(FAM, 0.5 - (i + j) / (r * 3) + (hash2(Math.round(bx + i), Math.round(by + j), seed) - 0.5) * 0.3, Math.round(bx + i), Math.round(by + j), seed));
      }
    }
  }
}

// A thick bronze stroke, for cradles, arms and cranes.
function strut(buf, kit, x0, y0, x1, y1, w = 1) {
  const { P } = kit;
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let k = 0; k <= n; k++) {
    const x = x0 + ((x1 - x0) * k) / n;
    const y = y0 + ((y1 - y0) * k) / n;
    for (let d = 0; d < w; d++) buf.set(Math.round(x) + d, Math.round(y), d === 0 ? P.bronze2 : P.bronze0);
  }
}

// The platform every station stands on: a rock tier and a terrace tier.
function platform(buf, kit, seed, lit = 0.45) {
  tier(buf, kit, { cx: 44, top: 64, rx: 36, ry: 11, face: 5, seed, rock: true });
  tier(buf, kit, { cx: 44, top: 58, rx: 30, ry: 9, face: 6, seed: seed + 1, lit });
}
function frontSteps(buf, kit, cx, y) {
  const { P } = kit;
  for (let k = 0; k < 4; k++) buf.rect(cx - 4 + k, y + k * 2, 9 - k * 2, 1, k % 2 ? P.patina2 : P.patina3);
}

// Knowledge Base — a library hall with a great arched door onto lamplit
// shelves, a glass dome on its roof, towers behind.
function library(kit, accent, seed) {
  const { P, PixelBuffer, rampSoft, hash2 } = kit;
  const buf = new PixelBuffer(88, 88);
  const lamps = [];
  tower(buf, kit, { x: 10, w: 8, top: 14, bottom: 60, cap: 'onion', seed, beacon: accent }, lamps);
  tower(buf, kit, { x: 68, w: 6, top: 24, bottom: 60, cap: 'lantern', seed: seed + 7 }, lamps);
  platform(buf, kit, seed);
  box(buf, kit, { x: 19, y: 61, w: 50, h: 22, d: 4, tone: 0.5, seed, lit: 0.6, windows: false });
  glassDome(buf, kit, { cx: 44, baseY: 37, drx: 16, dry: 16, seed, interior: 'library' });
  cupola(buf, kit, 44, 21, 2, lamps);
  // a balustrade along the front of the roof
  for (let x = 19; x < 69; x++) buf.set(x, 38, x % 3 ? P.patina3 : P.bronze2);
  // the arch and the shelves behind it
  const BOOKS = [P.coral0, P.kelp1, P.coat2, P.bronze2, P.vio1, P.wood2, P.coral1];
  for (let x = 30; x <= 57; x++) {
    const top = 50 - Math.sqrt(Math.max(0, 14 * 14 - (x - 43.5) ** 2)) * 0.5;
    for (let y = Math.ceil(top); y <= 59; y++) {
      let c;
      if (y <= Math.ceil(top)) c = x < 44 ? P.bronze3 : P.bronze1;
      else if ((y - 44) % 4 === 0) c = P.bronze1;
      else {
        const warm = Math.max(0, 1 - Math.hypot(x - 43.5, y - 56) / 16);
        c = mix(kit, BOOKS[Math.floor(hash2(x, (y - 44) >> 2, seed) * BOOKS.length)], P.window, 0.15 + warm * 0.45);
        if (hash2(x, y >> 2, seed + 3) < 0.08) c = P.patina0;
      }
      buf.set(x, y, c);
    }
  }
  for (let y = 56; y <= 59; y++) for (let x = 41; x <= 46; x++) buf.set(x, y, y === 56 ? P.bronze2 : x < 43 ? P.wood2 : P.wood1); // reading desk
  buf.set(43, 55, P.lamp);
  lamps.push([43, 55]);
  // pilasters and the side bays with tall lit windows
  for (const px of [21, 28, 59, 66]) for (let y = 40; y < 60; y++) buf.set(px, y, y === 40 ? P.bronze3 : px % 2 ? P.bronze1 : P.bronze2);
  for (const bx of [23, 61]) {
    for (let r = 0; r < 2; r++) {
      const wy = 44 + r * 8;
      const on = hash2(bx, r, seed) < 0.75;
      for (let y = wy; y < wy + 5; y++) for (let x = bx; x < bx + 3; x++) buf.set(x, y, y === wy && x !== bx + 1 ? P.patina1 : on ? (y < wy + 2 ? P.lamp : P.window) : P.patina0);
    }
  }
  lampPost(buf, kit, 31, 68, 4, lamps);
  lampPost(buf, kit, 57, 68, 4, lamps);
  frontSteps(buf, kit, 44, 61);
  coralClump(buf, kit, 16, 66, 'orange', 2, seed + 1);
  coralClump(buf, kit, 72, 64, 'violet', 2, seed + 2);
  return { buf: buf.outline('auto'), lamps, fx: {} };
}

// Documents — a round plaza with a circle of runes, colonnade lanterns, and a
// pedestal whose light holds three open books aloft (the page floats them).
function plaza(kit, accent, seed) {
  const { P, PixelBuffer, hash2 } = kit;
  const buf = new PixelBuffer(88, 88);
  const lamps = [];
  tower(buf, kit, { x: 12, w: 7, top: 6, bottom: 60, cap: 'lantern', seed, beacon: accent }, lamps);
  tower(buf, kit, { x: 20, w: 5, top: 28, bottom: 60, cap: 'cone', seed: seed + 3 }, lamps);
  box(buf, kit, { x: 58, y: 54, w: 16, h: 13, d: 4, seed: seed + 5, lit: 0.55 });
  capOn(buf, kit, 'dome', 65.5, 37, 10, seed, lamps);
  platform(buf, kit, seed, 0.35);
  // the circle of runes inlaid in the terrace
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2;
    for (const [rx, ry, on] of [[21, 6.5, 2], [13, 4, 3]]) {
      const x = Math.round(44 + Math.cos(t) * rx);
      const y = Math.round(58 + Math.sin(t) * ry);
      buf.set(x, y, a % on === 0 ? P.glow : P.pane2);
    }
  }
  // colonnade: slim columns round the circle, each with a lantern
  const cols = Array.from({ length: 8 }, (_, i) => {
    const t = (i / 8) * Math.PI * 2 + 0.3;
    return { x: Math.round(44 + Math.cos(t) * 25), y: Math.round(58 + Math.sin(t) * 7.5) };
  }).sort((a, b) => a.y - b.y);
  const column = ({ x, y }) => {
    for (let k = 0; k < 8; k++) {
      buf.set(x, y - k, k === 7 ? P.bronze2 : P.patina4);
      buf.set(x + 1, y - k, k === 7 ? P.bronze1 : P.patina1);
    }
    buf.set(x, y - 8, P.window);
    buf.set(x + 1, y - 8, P.bronze3);
    lamps.push([x, y - 8]);
  };
  cols.filter((c) => c.y < 58).forEach(column);
  // the pedestal: a fluted column with a bowl of light, and the beam above it
  for (let y = 26; y < 46; y++) {
    const half = 2.5 + (46 - y) * 0.12;
    for (let x = Math.ceil(44 - half); x <= Math.floor(44 + half); x++) {
      const a = 0.08 + 0.3 * ((y - 26) / 20) * (1 - Math.abs(x - 44) / (half + 1));
      const under = opaqueAt(buf, x, y);
      buf.set(x, y, under ? mix(kit, under, P.glow, a) : withAlpha(P.glow, a));
    }
  }
  for (let y = 47; y <= 57; y++) for (let x = 41; x <= 47; x++) buf.set(x, y, x === 41 ? P.patina4 : x === 47 ? P.patina0 : (x - 41) % 2 ? P.patina2 : P.patina3);
  for (let x = 38; x <= 50; x++) {
    buf.set(x, 46, x < 44 ? P.bronze3 : P.bronze1);
    if (x > 38 && x < 50) buf.set(x, 45, Math.abs(x - 44) < 3 ? P.pearl : P.glow);
  }
  for (let x = 39; x <= 49; x++) buf.set(x, 58, x < 44 ? P.bronze2 : P.bronze1);
  cols.filter((c) => c.y >= 58).forEach(column);
  frontSteps(buf, kit, 44, 67);
  coralClump(buf, kit, 14, 65, 'pink', 2, seed + 1);
  coralClump(buf, kit, 75, 63, 'teal', 1, seed + 2);
  return { buf: buf.outline('auto'), lamps, fx: { books: [[30, 31], [44, 22], [58, 30]], beam: [44, 36] } };
}

// Model Registry — a glass tank on a projector plate where a model of a whale
// swims as a hologram (the page draws it), with floating screens either side.
function tank(kit, accent, seed) {
  const { P, PixelBuffer, hash2, rampSoft } = kit;
  const R = ramps(P);
  const buf = new PixelBuffer(88, 88);
  const lamps = [];
  tower(buf, kit, { x: 64, w: 7, top: 10, bottom: 60, cap: 'lantern', seed, beacon: accent }, lamps);
  mast(buf, kit, { x: 16, top: 20, bottom: 58, light: accent }, lamps);
  platform(buf, kit, seed, 0.5);
  // floating screens on posts, their graphs drawn in light
  const screen = (x0, y0, w, h, kind) => {
    for (let y = y0 + h; y < 58; y++) buf.set(x0 + (w >> 1), y, P.patina3);
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const edge = y === y0 || y === y0 + h - 1 || x === x0 || x === x0 + w - 1;
        const i = x - x0;
        const bar = kind === 'bars' && y > y0 + h - 2 - ((i * 7 + 3) % (h - 2)) && i % 2 === 1 && !edge;
        const line = kind === 'line' && Math.abs(y - (y0 + h / 2 + Math.sin(i * 0.9) * (h / 3))) < 0.6 && !edge;
        const under = opaqueAt(buf, x, y);
        const col = edge ? P.pane4 : bar || line ? P.pearl : P.glow;
        const a = edge || bar || line ? 0.85 : 0.3;
        buf.set(x, y, under ? mix(kit, under, col, a) : withAlpha(col, a));
      }
    }
  };
  screen(8, 30, 13, 10, 'bars');
  screen(68, 36, 12, 9, 'line');
  // the tank: a bronze frame, old glass, a plate with a ring of light
  const X0 = 22, X1 = 66, Y0 = 30, Y1 = 57;
  for (let y = Y0 - 4; y <= Y1; y++) {
    for (let x = X0; x <= X1; x++) {
      const top = y < Y0;
      const rim = y === Y0 - 4 || y === Y0 || y >= Y1 - 1;
      if (x === X0 || x === X1 || rim) {
        buf.set(x, y, x < 44 && (y === Y0 - 4 || x === X0) ? P.bronze3 : rim && y >= Y1 - 1 ? P.bronze1 : P.bronze2);
        continue;
      }
      if ((x === X0 + 3 || x === X1 - 3) && y <= Y1 - 4) {
        buf.set(x, y, mix(kit, P.bronze1, P.pane2, 0.4)); // the back posts, through the glass
        continue;
      }
      const u = (x - X0) / (X1 - X0);
      const v = (y - Y0) / (Y1 - Y0);
      let tone = 0.3 + (1 - v) * 0.15 - u * 0.1;
      let a = top ? 0.5 : 0.24;
      if (!top && Math.abs(x - X0 - 4 - (Y1 - y) * 0.35) < 1 && y < Y1 - 6) {
        tone = 1;
        a = 0.7;
      }
      const glass = rampSoft(R.pane, tone, x, y, seed);
      const under = opaqueAt(buf, x, y);
      buf.set(x, y, under ? mix(kit, under, glass, a + 0.2) : withAlpha(glass, a));
    }
  }
  for (let y = 53; y <= 56; y++) {
    for (let x = 30; x <= 58; x++) {
      const e = ((x - 44) / 13) ** 2 + ((y - 54.5) / 2) ** 2;
      if (e <= 1) buf.set(x, y, e > 0.6 ? P.glow : e > 0.3 ? P.pane3 : P.pane4);
    }
  }
  lampPost(buf, kit, 18, 68, 4, lamps);
  lampPost(buf, kit, 70, 68, 4, lamps);
  frontSteps(buf, kit, 44, 62);
  coralClump(buf, kit, 13, 64, 'violet', 2, seed + 1);
  return { buf: buf.outline('auto'), lamps, fx: { holo: [44, 43] } };
}

// Repositories — a depot of stacked containers under a crane, and two
// smokestacks (the page gives them smoke).
function depot(kit, accent, seed) {
  const { P, PixelBuffer, rampSoft, hash2 } = kit;
  const R = ramps(P);
  const buf = new PixelBuffer(88, 88);
  const lamps = [];
  const smoke = [];
  for (const [x, w, top] of [[22, 5, 12], [30, 4, 20]]) {
    for (let y = top; y < 58; y++) {
      for (let i = 0; i < w; i++) {
        let c = rampSoft([P.bronze0, P.bronze1, P.patina1, P.patina2, P.patina3], 0.62 - (i / (w - 1)) * 0.55 + (hash2(x + i, y, seed) - 0.5) * 0.15, x + i, y, seed);
        if ((y - top) % 6 === 2) c = i === 0 ? P.bronze3 : P.bronze1;
        buf.set(x + i, y, c);
      }
    }
    for (let i = -1; i <= w; i++) buf.set(x + i, top, i < w / 2 ? P.bronze3 : P.bronze1);
    for (let i = 0; i < w; i++) buf.set(x + i, top + 1, P.ink);
    smoke.push([x + (w >> 1), top - 1]);
  }
  // the crane: a lattice mast, a jib, and a crate on the hook
  for (let y = 16; y < 58; y++) {
    buf.set(70, y, P.bronze2);
    buf.set(72, y, P.bronze0);
    if ((y - 16) % 3 === 0) buf.set(71, y, P.patina3);
  }
  for (let x = 48; x <= 73; x++) {
    buf.set(x, 16, x < 60 ? P.bronze3 : P.bronze2);
    buf.set(x, 18, P.bronze1);
    if (x % 3 === 0) buf.set(x, 17, P.patina3);
  }
  for (let y = 19; y < 27; y++) buf.set(59, y, P.iron3);
  box(buf, kit, { x: 56, y: 32, w: 7, h: 4, d: 2, seed: seed + 9, stripe: accent, windows: false });
  buf.set(73, 15, P.window);
  lamps.push([73, 15]);
  platform(buf, kit, seed, 0.5);
  // containers, stacked back to front, bottom to top
  const stacks = [
    [16, 56, 14, 10, 0.45, true], [31, 55, 15, 12, 0.55, false], [47, 56, 13, 9, 0.4, true], [61, 57, 12, 11, 0.5, false],
    [19, 46, 13, 8, 0.52, false], [35, 43, 14, 9, 0.44, true], [52, 47, 12, 7, 0.5, true],
    [26, 38, 11, 7, 0.48, true], [42, 34, 10, 6, 0.55, false],
  ];
  stacks.forEach(([x, y, w, h, tone, ribs], i) => box(buf, kit, { x, y, w, h, d: 3, tone, seed: seed + i * 5, ribs, lit: ribs ? 0.2 : 0.55, stripe: i % 4 === 1 ? accent : null }));
  // the forecourt, lamplit, and a forklift's worth of crates
  box(buf, kit, { x: 24, y: 64, w: 5, h: 4, d: 2, seed: seed + 40, windows: false });
  box(buf, kit, { x: 59, y: 65, w: 6, h: 4, d: 2, seed: seed + 41, windows: false, ribs: true });
  lampPost(buf, kit, 36, 66, 4, lamps);
  lampPost(buf, kit, 52, 66, 4, lamps);
  coralClump(buf, kit, 12, 64, 'teal', 2, seed + 1);
  coralClump(buf, kit, 76, 63, 'orange', 2, seed + 2);
  return { buf: buf.outline('auto'), lamps, fx: { smoke } };
}

// Testing Lab — a glass sphere on a bronze cradle with a glowing core held in
// two orbit rings (the page spins sparks round it), corals all about.
function reactor(kit, accent, seed) {
  const { P, PixelBuffer, rampSoft, vnoise } = kit;
  const R = ramps(P);
  const buf = new PixelBuffer(88, 88);
  const lamps = [];
  tower(buf, kit, { x: 9, w: 6, top: 30, bottom: 60, cap: 'cone', seed, beacon: accent }, lamps);
  tower(buf, kit, { x: 72, w: 5, top: 36, bottom: 60, cap: 'dome', seed: seed + 4 }, lamps);
  mast(buf, kit, { x: 70, top: 16, bottom: 58, light: accent }, lamps);
  platform(buf, kit, seed, 0.4);
  const cx = 44;
  const cy = 32;
  const Rr = 19;
  for (let y = 54; y <= 60; y++) {
    for (let x = 30; x <= 58; x++) {
      const e = ((x - 44) / 13) ** 2 + ((y - 57) / 3) ** 2;
      if (e <= 1) buf.set(x, y, e > 0.7 ? (x < 44 ? P.bronze3 : P.bronze1) : rampSoft(R.metal, 0.5 - (y - 55) / 8, x, y, seed));
    }
  }
  for (let y = 50; y < 56; y++) for (let x = 42; x <= 46; x++) buf.set(x, y, x === 42 ? P.bronze3 : P.bronze1);
  layer(buf, cx - Rr - 1, cy - Rr - 1, cx + Rr + 2, cy + Rr + 2, (x, y) => {
    const px = x + 0.5 - cx;
    const py = y + 0.5 - cy;
    const dx = px / Rr;
    const dy = py / Rr;
    const r = Math.hypot(dx, dy);
    if (r > 1) return null;
    if (r > 1 - 1.3 / Rr) return dx < -0.2 && dy < -0.2 ? P.bronze3 : P.bronze1;
    const sx = Math.sqrt(Math.max(0, 1 - dx * dx));
    const sy = Math.sqrt(Math.max(0, 1 - dy * dy));
    if (Math.abs(dy - 0.24 * sx) < 0.9 / Rr) return dx < -0.3 ? P.bronze3 : P.bronze2; // the equator band, front half
    if (Math.abs(dx - 0.3 * sy) < 0.9 / Rr) return dy < -0.3 ? P.bronze3 : P.bronze1; // a meridian band
    const rc = Math.hypot(px, py);
    if (rc < 2) return P.white;
    if (rc < 3.5) return P.pearl;
    if (rc < 5) return P.glow;
    for (const [ang, rx, ry, col] of [[0.45, 0.66, 0.2, P.glow], [-0.6, 0.52, 0.16, P.pane4]]) {
      const u = dx * Math.cos(ang) + dy * Math.sin(ang);
      const v = -dx * Math.sin(ang) + dy * Math.cos(ang);
      if (Math.abs(Math.hypot(u / rx, v / ry) - 1) < 0.1) return col;
    }
    let tone = 0.28 - dy * 0.25 - dx * 0.2 + (vnoise(x * 0.3, y * 0.3, seed) - 0.5) * 0.2;
    let a = 0.3 + r ** 4 * 0.5;
    if (Math.hypot(dx + 0.45, dy + 0.5) < 0.09) return P.white;
    if (dx < 0 && dy < -0.1 && Math.abs(r - 0.8) < 0.05) {
      tone = 1;
      a = 0.9;
    }
    let glass = rampSoft(R.pane, tone, x, y, seed);
    if (rc < 10) {
      glass = mix(kit, glass, P.glow, (1 - rc / 10) * 0.6);
      a = Math.max(a, 0.6 * (1 - rc / 10) + 0.3);
    }
    const under = opaqueAt(buf, x, y);
    return under ? mix(kit, under, glass, a + 0.25) : withAlpha(glass, a);
  });
  strut(buf, kit, 32, 57, 27, 40, 2);
  strut(buf, kit, 56, 57, 60, 40, 2);
  for (const [x, y, f, s] of [[20, 62, 'pink', 3], [30, 64, 'orange', 2], [60, 64, 'violet', 3], [70, 61, 'teal', 2], [15, 55, 'violet', 2], [74, 55, 'pink', 2]]) coralClump(buf, kit, x, y, f, s, seed + x);
  frontSteps(buf, kit, 44, 67);
  return { buf: buf.outline('auto'), lamps, fx: { core: [cx, cy], orbit: [12, 4] } };
}

// Memory — a glass dome with a brain inside, violet and glowing (the page
// makes its synapses spark).
function brainDome(kit, accent, seed) {
  const { P, PixelBuffer } = kit;
  const buf = new PixelBuffer(88, 88);
  const lamps = [];
  tower(buf, kit, { x: 11, w: 6, top: 22, bottom: 60, cap: 'onion', seed, beacon: accent }, lamps);
  tower(buf, kit, { x: 71, w: 6, top: 29, bottom: 60, cap: 'onion', seed: seed + 5 }, lamps);
  platform(buf, kit, seed, 0.4);
  glassDome(buf, kit, { cx: 44, baseY: 59, drx: 25, dry: 30, seed, interior: 'brain' });
  cupola(buf, kit, 44, 29, 3, lamps);
  tower(buf, kit, { x: 10, w: 4, top: 58, bottom: 68, cap: 'lantern', seed: seed + 9 }, lamps);
  tower(buf, kit, { x: 74, w: 4, top: 60, bottom: 68, cap: 'lantern', seed: seed + 10 }, lamps);
  lampPost(buf, kit, 31, 68, 4, lamps);
  lampPost(buf, kit, 57, 68, 4, lamps);
  frontSteps(buf, kit, 44, 67);
  coralClump(buf, kit, 20, 67, 'violet', 2, seed + 1);
  coralClump(buf, kit, 67, 67, 'pink', 2, seed + 2);
  return { buf: buf.outline('auto'), lamps, fx: { brain: [44, 46, 15, 11] } };
}

// Deployments — a dry dock: a flooded basin under a portal crane, and in it a
// submarine made ready to launch.
function drydock(kit, accent, seed) {
  const { P, PixelBuffer, rampSoft, hash2 } = kit;
  const R = ramps(P);
  const buf = new PixelBuffer(88, 88);
  const lamps = [];
  // the portal crane behind
  for (const lx of [14, 72]) {
    for (let y = 22; y < 58; y++) {
      buf.set(lx, y, P.bronze2);
      buf.set(lx + 2, y, P.bronze0);
      if ((y - 22) % 3 === 0) buf.set(lx + 1, y, P.patina3);
    }
  }
  for (let x = 12; x <= 76; x++) {
    buf.set(x, 20, x < 40 ? P.bronze3 : P.bronze2);
    buf.set(x, 23, P.bronze1);
    if (x % 3 === 0) {
      buf.set(x, 21, P.patina3);
      buf.set(x, 22, P.patina3);
    }
  }
  box(buf, kit, { x: 38, y: 27, w: 9, h: 4, d: 2, seed: seed + 3, windows: false, stripe: accent });
  for (let y = 27; y < 42; y++) buf.set(42, y, P.iron3);
  for (const x of [12, 76]) {
    buf.set(x, 19, P.window);
    lamps.push([x, 19]);
  }
  tower(buf, kit, { x: 4, w: 6, top: 30, bottom: 60, cap: 'cone', seed, beacon: accent }, lamps);
  platform(buf, kit, seed, 0.45);
  // the basin, and the water in it
  for (let y = 50; y <= 64; y++) {
    for (let x = 18; x <= 70; x++) {
      if (y === 50 || x === 18 || x === 70) buf.set(x, y, y === 50 && x < 44 ? P.bronze3 : P.bronze1);
      else if (y < 53) buf.set(x, y, rampSoft(R.metal, 0.3 - (y - 50) * 0.08, x, y, seed));
      else if (y === 64) buf.set(x, y, x % 6 === 0 ? P.bronze2 : P.patina3);
      else {
        const glint = hash2(x >> 1, y, seed) < 0.06;
        buf.set(x, y, glint ? P.pane4 : rampSoft(R.pane, 0.55 - (y - 53) / 22 + (hash2(x, y, seed + 1) - 0.5) * 0.15, x, y, seed));
      }
    }
  }
  // the submarine: an iron hull with a ram, portholes, a wheelhouse and a screw
  const IRON = [P.iron0, P.iron1, P.iron2, P.iron3, P.iron4];
  for (let y = 46; y <= 60; y++) {
    for (let x = 22; x <= 69; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const ex = (px - 44) / 21;
      const ey = (py - 55) / 4.6;
      const ram = px > 64 && Math.abs(py - 55.5) < (69 - px) * 0.5;
      const hull = ex * ex + ey * ey <= 1 || ram;
      const house = px >= 47 && px <= 55 && py >= 46.5 && py < 51.5;
      if (!hull && !house) continue;
      let c;
      if (house) c = py < 47.5 ? P.iron3 : px === 49.5 || px === 52.5 ? (py < 49.5 ? P.lamp : P.window) : rampSoft(IRON, 0.45 - (px - 47) / 14, x, y, seed);
      else {
        c = rampSoft(IRON, 0.5 - ey * 0.4 - ex * 0.15, x, y, seed);
        if (Math.abs(py - 53.5) < 0.5 && x % 5 === 0 && Math.abs(ex) < 0.8) c = P.window;
        else if (Math.abs(py - 57.5) < 0.5 && x % 3 === 0) c = P.iron1;
      }
      if (py > 57.5 && !house) c = mix(kit, c, P.pane2, 0.55); // under the water line
      buf.set(x, y, c);
    }
  }
  for (let y = 52; y <= 58; y++) buf.set(21, y, y % 2 ? P.bronze2 : P.bronze0);
  for (const x of [49, 53]) lamps.push([x, 48]);
  lampPost(buf, kit, 16, 70, 4, lamps);
  lampPost(buf, kit, 72, 70, 4, lamps);
  coralClump(buf, kit, 10, 66, 'orange', 2, seed + 1);
  coralClump(buf, kit, 79, 63, 'teal', 2, seed + 2);
  return { buf: buf.outline('auto'), lamps, fx: { dock: [44, 57] } };
}

// The orchestrator — a keep of two drums under a bronze cradle, where a great
// globe turns (the page draws the globe from fx.globe*), towers all round.
function hub(kit) {
  const { P, PixelBuffer } = kit;
  const W = 132;
  const H = 126;
  const cx = 66;
  const baseY = 86;
  const buf = new PixelBuffer(W, H);
  const lamps = [];
  const back = [
    { x: -56, w: 9, h: 50, cap: 'onion' },
    { x: 47, w: 9, h: 54, cap: 'lantern' },
    { x: -44, w: 7, h: 34, cap: 'cone' },
    { x: 36, w: 6, h: 38, cap: 'dome' },
    { x: -31, w: 5, h: 44, cap: 'lantern' },
    { x: 26, w: 5, h: 46, cap: 'cone' },
  ];
  back.forEach((t, i) => tower(buf, kit, { x: cx + t.x, w: t.w, top: baseY - t.h, bottom: baseY + 2, cap: t.cap, seed: 60 + i * 11 }, lamps));
  tier(buf, kit, { cx, top: baseY + 8, rx: 54, ry: 15, face: 7, seed: 7, rock: true });
  tier(buf, kit, { cx, top: baseY, rx: 46, ry: 13, face: 9, seed: 8, lit: 0.5 });
  tier(buf, kit, { cx, top: 68, rx: 27, ry: 8, face: 18, seed: 9, lit: 0.55 });
  tier(buf, kit, { cx, top: 55, rx: 16, ry: 5, face: 12, seed: 10, lit: 0.6 });
  // the cradle the globe turns in
  for (let y = 48; y < 55; y++) for (let x = cx - 2; x <= cx + 2; x++) buf.set(x, y, x === cx - 2 ? P.bronze3 : P.bronze1);
  strut(buf, kit, cx - 3, 50, cx - 14, 43, 2);
  strut(buf, kit, cx + 3, 50, cx + 13, 43, 2);
  // the seal on the keep: a pale trident on a dark disc in a riveted ring
  const my = 82;
  for (let y = -7; y <= 7; y++) {
    for (let x = -7; x <= 7; x++) {
      const d = Math.hypot(x, y);
      if (d > 7.2) continue;
      const rivet = d > 5.6 && Math.abs(((Math.atan2(y, x) / (Math.PI / 4)) % 1 + 1) % 1 - 0.5) > 0.4;
      buf.set(cx + x, my + y, d > 5.2 ? (rivet ? P.bronze4 : x + y < -2 ? P.bronze3 : P.bronze1) : d > 4.6 ? P.bronze0 : P.ink2);
    }
  }
  for (let y = -3; y <= 4; y++) buf.set(cx, my + y, P.pearlD);
  for (const x of [-2, 2]) for (let y = -3; y <= 0; y++) buf.set(cx + x, my + y, P.pearlD);
  for (let x = -2; x <= 2; x++) buf.set(cx + x, my + 1, P.pearlD);
  [{ x: -50, w: 6, h: 20, cap: 'lantern' }, { x: 44, w: 6, h: 18, cap: 'onion' }].forEach((t, i) => {
    tower(buf, kit, { x: cx + t.x, w: t.w, top: baseY + 12 - t.h, bottom: baseY + 12, cap: t.cap, seed: 90 + i }, lamps);
  });
  for (const x of [cx - 26, cx + 26]) lampPost(buf, kit, x, baseY + 14, 5, lamps);
  for (let k = 0; k < 5; k++) buf.rect(cx - 6 + k, baseY + 12 + k * 2, 13 - k * 2, 1, k % 2 ? P.patina2 : P.patina3);
  for (const [x, y, f, s] of [[18, 100, 'pink', 3], [30, 106, 'orange', 2], [104, 104, 'violet', 3], [114, 98, 'teal', 2]]) coralClump(buf, kit, x, y, f, s, x + y);
  buf.outline('auto');
  return { buf, lamps, globe: [cx, 30] };
}

// ------------------------------------------------------------------ fx ---
// Animated pieces the page lays over the stations.

// The orchestrator's globe: oceans and continents turning under a fixed
// meridian ring, and a tilted ring crossing in front.
function globeFrames(kit, n) {
  const { P, paint, rampSoft, vnoise } = kit;
  const S = 40;
  const c = S / 2;
  const R = 14;
  const OCEAN = [P.mist0, P.pane0, P.mist2, P.pane2, P.mist4];
  const LAND = [P.moss1, P.moss2, P.moss3, P.moss4, P.moss5, P.silt3];
  const frames = [];
  for (let f = 0; f < n; f++) {
    const rot = (f / n) * Math.PI * 2;
    const buf = paint(S, S, (x, y) => {
      const px = x + 0.5 - c;
      const py = y + 0.5 - c;
      const r = Math.hypot(px, py);
      const tilt = 0.35;
      const u = px * Math.cos(tilt) + py * Math.sin(tilt);
      const v = -px * Math.sin(tilt) + py * Math.cos(tilt);
      const onTilted = Math.abs(Math.hypot(u / 18.5, v / 5) - 1) < 0.1;
      if (onTilted && (v > 0 || r > R)) return u < 0 ? P.bronze3 : P.bronze1;
      if (Math.abs(r - 17.5) < 0.8) return Math.atan2(py, px) < -Math.PI / 2 || Math.atan2(py, px) > Math.PI * 0.9 ? P.bronze3 : P.bronze2;
      if (Math.abs(px) < 0.6 && r > R && r < 17) return P.bronze1; // the axle
      if (r > R) return null;
      const nx = px / R;
      const ny = py / R;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const lat = Math.asin(-ny);
      const lon = Math.atan2(nx, nz) + rot;
      const land = vnoise(Math.cos(lon) * 1.7 + 7, Math.sin(lon) * 1.7 + lat * 2 + 3, 21) * 0.65 + vnoise(Math.cos(lon) * 3.4 + 2, Math.sin(lon) * 3.4 + lat * 4, 22) * 0.35;
      const lit = 0.3 - nx * 0.35 - ny * 0.3 + nz * 0.35;
      if (Math.hypot(nx + 0.42, ny + 0.45) < 0.12) return P.pearl;
      if (r > R - 0.9) return P.pane0;
      if (land > 0.52) return land < 0.54 ? P.silt2 : rampSoft(LAND, lit + (land - 0.56) * 1.5, x, y, 3);
      return rampSoft(OCEAN, lit, x, y, 4);
    });
    frames.push({ name: `globe${f}`, buf });
  }
  return frames;
}

// An open book of light, pages curving up from the spine; in frame 1 a page
// stands mid-turn.
function bookFrames(kit) {
  const { P, paint } = kit;
  return [0, 1].map((f) => ({
    name: `book${f}`,
    buf: paint(17, 11, (x, y) => {
      const px = x + 0.5;
      const py = y + 0.5;
      const dx = px - 8.5;
      const ad = Math.abs(dx);
      if (f && dx > 0.5 && dx < 2.2 && py > 0.5 && py < 7.5) return dx < 1.4 ? P.white : P.pane4; // the turning page
      if (ad > 8) return null;
      const top = 4 - 2.2 * Math.sin((Math.PI * ad) / 8.5);
      const bottom = top + 5;
      if (py > bottom && py < bottom + 1.3) return ad > 7 ? null : P.coat2; // the cover's edge
      if (py < top || py > bottom) return null;
      if (ad < 0.6) return P.pane2; // the spine
      if (ad > 7.3) return P.pane3;
      const line = Math.round(py - top) % 2 === 1 && ad > 1.5 && ad < 6.5 && (x * 5 + y * 3) % 7 !== 0;
      if (line) return P.pane2;
      return dx < 0 ? P.pearl : P.pane4;
    }),
  }));
}

// A whale drawn in light for the Model Registry's tank: scanlines, a bright
// edge, the tail beating between two frames.
function holoWhaleFrames(kit) {
  const { P, paint, inPoly } = kit;
  return [0, 1].map((f) => {
    const tail = f ? [[4.5, 6.5], [2, 1.5], [0.5, 1.5], [2.5, 5.5], [1, 7.5], [4.5, 8]] : [[4.5, 6.5], [1.5, 3], [0, 3.5], [2, 6.8], [0, 10], [1.5, 10.5], [4.5, 8]];
    const body = [[29.5, 7], [28.5, 4.5], [25, 2.5], [19, 1.8], [12, 2.8], [7, 4.8], ...tail, [7, 9], [12, 10.8], [19, 11.4], [25, 10.6], [28.5, 9.2]];
    const fin = [[16, 10.5], [19.5, 12.9], [21.5, 10.5]];
    const inside = (qx, qy) => inPoly(qx, qy, body) || inPoly(qx, qy, fin);
    return {
      name: `holowhale${f}`,
      buf: paint(30, 13, (x, y) => {
        const px = x + 0.5;
        const py = y + 0.5;
        if (!inside(px, py)) return null;
        const edge = !inside(px, py - 1) || !inside(px, py + 1) || !inside(px - 1, py) || !inside(px + 1, py);
        if (x === 25 && y === 5) return P.white;
        if (edge) return withAlpha(P.pane4, 0.95);
        if (py > 8.5 && py < 10.5 && x % 2 === 0 && x > 17 && x < 28) return withAlpha(P.pearl, 0.8); // throat grooves
        return withAlpha(y % 2 ? P.glow : P.pane3, y % 2 ? 0.75 : 0.5);
      }),
    };
  });
}
