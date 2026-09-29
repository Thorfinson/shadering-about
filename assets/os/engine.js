// The agent-orchestration console engine shared by nautilus-os.html,
// hortus-os.html and neon-os.html. It runs the scenario — an orchestrator hands
// a project to seven sub-agents who fan out to stations, read, write, train,
// test and deploy, and report back — and keeps the cards, tags, popovers,
// dock panels and minimap up to date. Everything a world looks like, and every
// word that belongs to it, comes from the world object passed to startOS().
//
// A classic script (not a module) so the pages also run from file://. Its
// top-level names are the helpers a world's own script draws with.
//
// The world object:
//   atlas              the sprite atlas (window.<SET>_ATLAS from tools/build-sprites.mjs)
//   stations           hub, knowledge, documents, models, repos, tests, memory, deploy:
//                      { name, frame, icon, color, fx, fy, prefer, sub? }
//   rowIcons, agents, who, persona, villain: { id }, quotes, projects, edits, freshState()
//   nav                [[target, icon, label], …]; the first is the map itself
//   text               the world's words (see TEXT below)
//   clockStart         minutes after midnight at t = 0
//   mapH               the map's height in art pixels (default 352); more is a finer grain
//   agentLift          how far above its route an agent rides, in art pixels
//   agentIcon(a)       sprite for the agent's row in the dock
//   agentPort(ag)      where beams and specks leave an agent
//   beamTarget(key)    where a working agent's beam points at a station
//   layoutStation(s, meta)   extra per-station layout from the atlas meta
//   placeStation(s)    instead of sprites: set s.prx, s.pry (the platform's
//                      ellipse) and s.sx, s.sy, s.w, s.h (its box on the map)
//                      from s.x, s.y; a 3D world may move s.x, s.y too
//   onResize()         after the map is laid out and scaled (map.scale, map.ox, map.oy)
//   buildStatic()      paint the unchanging world into `staticCanvas`, push
//                      glow points into `emitters`
//   render(t)          draw one frame into ctx and the glow layer
//   seedAmbient(), updateAmbient(dt)
//   onAgentStep(ag, dt)      trails: bubbles, pollen, exhaust
//   updateParticle(p, dt), drawParticle(g, p, t, age)   the world's own particle kinds
//   villainHead()      where the villain is, for its effects
//   onVillainSink()    its parting effect
//   drawStationFx(g, t, s)   moving parts drawn over a station
//   drawCorner(t)      the vignette under the nav
//   decorateChrome()   brand mark and meter icon

// ============================================================
// Utilities
// ============================================================
const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmtTok = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`);
const fmtNum = (n) => Math.round(n).toLocaleString("en-US");
const code = (s) => `<code>${esc(s)}</code>`;
const cycle = (v, n = 2) => ((Math.floor(v) % n) + n) % n;

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function flipX(src) {
  const c = makeCanvas(src.width, src.height);
  const g = c.getContext("2d");
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}
function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 144665) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi, s), hash2(xi + 1, yi, s), u), lerp(hash2(xi, yi + 1, s), hash2(xi + 1, yi + 1, s), u), v);
}
function fbm(x, y, s, oct = 3) {
  let v = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    v += a * vnoise(x * f, y * f, s + i * 17);
    n += a;
    a *= 0.5;
    f *= 2;
  }
  return v / n;
}
function rng(seed) {
  let s = (seed * 2654435761) % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const C32 = new Map();
function col32(hex) {
  let v = C32.get(hex);
  if (v === undefined) {
    const n = parseInt(hex.slice(1), 16);
    v = ((0xff << 24) | ((n & 0xff) << 16) | (n & 0xff00) | (n >> 16)) >>> 0;
    C32.set(hex, v);
  }
  return v;
}
function mix32(c, rgb, k) {
  const r = c & 0xff, g = (c >> 8) & 0xff, b = (c >> 16) & 0xff;
  return ((0xff << 24) | (Math.round(lerp(b, rgb[2], k)) << 16) | (Math.round(lerp(g, rgb[1], k)) << 8) | Math.round(lerp(r, rgb[0], k))) >>> 0;
}
const hexRGB = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgb32 = (c) => ((0xff << 24) | (clamp(Math.round(c[2]), 0, 255) << 16) | (clamp(Math.round(c[1]), 0, 255) << 8) | clamp(Math.round(c[0]), 0, 255)) >>> 0;
const mixRGB = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const mixHex = (a, b, k) => "#" + mixRGB(hexRGB(a), hexRGB(b), k).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
function rampRGB(r, v) {
  const f = clamp(v, 0, 1) * (r.length - 1);
  const i = Math.min(r.length - 2, Math.floor(f));
  return mixRGB(r[i], r[i + 1], f - i);
}
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const macrotask = () => new Promise((r) => {
  const ch = new MessageChannel();
  ch.port1.onmessage = () => r();
  ch.port2.postMessage(0);
});

// ============================================================
// Sprite atlas (built by tools/build-sprites.mjs)
// ============================================================
let W = null; // the world
let ATLAS = null;
let P = null;
const FR = new Map();
async function loadAtlas(onFrame) {
  ATLAS = W.atlas;
  if (!ATLAS) throw new Error(`${W.atlasFile} did not load.\nRun \`npm run sprites\` to build it.`);
  P = ATLAS.palette;
  const img = new Image();
  img.src = ATLAS.image;
  await img.decode();
  const names = Object.keys(ATLAS.frames);
  for (let i = 0; i < names.length; i++) {
    const f = ATLAS.frames[names[i]];
    const c = makeCanvas(f.w, f.h);
    c.getContext("2d").drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    FR.set(names[i], { c, flip: null });
    await onFrame(i + 1, names.length, names[i], f);
  }
}
function spr(name, flip = false) {
  const f = FR.get(name);
  if (!f) throw new Error(`missing sprite ${name}`);
  return flip ? (f.flip ??= flipX(f.c)) : f.c;
}
function iconCanvas(name, scale = 1) {
  const src = spr(name);
  const c = makeCanvas(src.width * scale, src.height * scale);
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
const ICON_URL = new Map();
function iconUrl(name) {
  if (!ICON_URL.has(name)) ICON_URL.set(name, spr(name).toDataURL());
  return ICON_URL.get(name);
}

// ============================================================
// Sim clock — every wait in a project goes through sleep()
// ============================================================
const clock = { t: 0, speed: 1, paused: false };
let timers = [];
class Cancelled extends Error {}
const sleep = (sec) => new Promise((res, rej) => timers.push({ at: clock.t + sec, res, rej }));
function tickTimers() {
  if (!timers.length) return;
  const due = [], keep = [];
  for (const tm of timers) (tm.at <= clock.t ? due : keep).push(tm);
  if (!due.length) return;
  timers = keep;
  for (const tm of due) tm.res();
}
function cancelAll() {
  const old = timers;
  timers = [];
  for (const tm of old) tm.rej(new Cancelled());
}
const fmtClock = (t) => {
  const m = (W?.clockStart ?? 360) + Math.floor(t);
  return `${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const fmtDay = (t) => `Day ${1 + Math.floor(((W?.clockStart ?? 360) + Math.floor(t)) / 1440)} · ${fmtClock(t)}`;

// ============================================================
// The scenario's cast, filled from the world
// ============================================================
let PHASES = [
  { key: "research", name: "Research", check: "Research & data collection" },
  { key: "analyze", name: "Analyze", check: "Analysis & planning" },
  { key: "build", name: "Build", check: "Build" },
  { key: "test", name: "Test", check: "Testing & validation" },
  { key: "deploy", name: "Deploy", check: "Deployment" },
];
let STATIONS, STATION_KEYS, SPOKES, AGENTS, A, WHO, PROJECTS, EDITS, ROW_ICON, QUOTES, TEXT;
let S = null; // what the cards and popovers show

// The words a world can change. Functions take what they need.
const TEXT_DEFAULTS = {
  run: "run", runs: "runs", crew: "agents", Crew: "Agents",
  idle: "Docked", docked: "docked at the orchestrator",
  orders: "orders", pipeNote: "From the order to the release",
  meter: (v) => fmtNum(v),
  villainRises: (fail) => `appears at the Testing Lab · ✗ ${esc(fail)}`,
  villainSinks: "withdraws",
  settled: (v) => `settled at <b>${fmtNum(v)}</b>`,
  done: "done",
  about: {},
};

// ============================================================
// Map geometry
// ============================================================
const MAP_H = 352; // art pixels high, unless the world asks for more (W.mapH: a finer grain, the city seen from further off)
const map = { W: 680, H: MAP_H, scale: 1, ox: 0, oy: 0 };
const grain = () => map.H / MAP_H; // how much finer this map's art pixels are than the default
const paths = {};

function layoutStations() {
  const { W: MW, H } = map;
  for (const s of Object.values(STATIONS)) {
    s.x = Math.round(MW * s.fx);
    s.y = Math.round(H * s.fy);
    s.col = P[s.color];
    if (W.placeStation) {
      W.placeStation(s); // a world without station sprites sizes them itself
      continue;
    }
    const m = ATLAS.meta[s.frame.split(".")[0]]; // "station.repos" → the meta of sprite "station"
    s.prx = m.prx;
    s.pry = m.pry;
    const c = spr(s.frame);
    s.sx = s.x - m.base[0];
    s.sy = s.y - m.base[1];
    s.w = c.width;
    s.h = c.height;
    s.lamps = (s.key === "hub" ? m.lamps : m.lamps[s.key]).map(([x, y]) => [s.sx + x, s.sy + y]);
    s.parts = s.key === "hub" ? {} : m.fx?.[s.key] ?? {}; // where its moving parts go
    W.layoutStation?.(s, m);
  }
  const hub = STATIONS.hub;
  SPOKES.forEach((k, i) => {
    const s = STATIONS[k];
    const onRim = (c, tx, ty, pad) => {
      const a = Math.atan2((ty - c.y) / c.pry, (tx - c.x) / c.prx);
      return { x: c.x + Math.cos(a) * (c.prx + pad), y: c.y + Math.sin(a) * (c.pry + pad) + 6 };
    };
    const a = onRim(hub, s.x, s.y, 10);
    const b = onRim(s, hub.x, hub.y, 8);
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    const side = i % 2 ? 1 : -1;
    const c = { x: (a.x + b.x) / 2 - (dy / len) * len * 0.2 * side, y: (a.y + b.y) / 2 + (dx / len) * len * 0.2 * side };
    const pts = [];
    const cum = [0];
    for (let j = 0; j <= 180; j++) {
      const t = j / 180;
      const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x;
      const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y;
      if (j) cum.push(cum[j - 1] + Math.hypot(x - pts[j - 1].x, y - pts[j - 1].y));
      pts.push({ x, y });
    }
    paths[k] = { pts, cum, L: cum[cum.length - 1], busyUntil: 0, dir: 1, beads: [] };
    s.dim = mixHex(s.col, W.beadDim ?? P.ink, 0.5);
    // beads along the route, paling toward the hub
    const p = paths[k];
    for (let d = 4; d < p.L - 3; d += 6) {
      const q = pathAt(k, d / p.L);
      const f = d / p.L;
      p.beads.push({ d, x: Math.round(q.x), y: Math.round(q.y), col: mixHex(s.col, P.pearl, (1 - f) * 0.45), dim: mixHex(s.col, W.beadDim ?? P.ink, 0.35 + (1 - f) * 0.1) });
    }
  });
}
function pathAt(k, f) {
  const p = paths[k];
  const d = clamp(f, 0, 1) * p.L;
  let lo = 0, hi = p.cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (p.cum[mid] < d) lo = mid; else hi = mid;
  }
  const t = (d - p.cum[lo]) / Math.max(1e-6, p.cum[hi] - p.cum[lo]);
  return { x: lerp(p.pts[lo].x, p.pts[hi].x, t), y: lerp(p.pts[lo].y, p.pts[hi].y, t), dx: p.pts[hi].x - p.pts[lo].x };
}

// ============================================================
// Canvases: the world at art resolution, and a half-resolution light
// layer screened over it
// ============================================================
const cv = $("#world");
const ctx = cv.getContext("2d");
const gcv = $("#glow");
const gctx = gcv.getContext("2d");
let staticCanvas = null;
let emitters = []; // static glow points, pushed by the world's buildStatic()

const GLOW = new Map();
function glowSprite(col, r) {
  const key = `${col}|${r}`;
  let c = GLOW.get(key);
  if (!c) {
    c = makeCanvas(r * 2, r * 2);
    const g = c.getContext("2d");
    const [R, G, B] = hexRGB(col);
    const grd = g.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0, `rgba(${R},${G},${B},1)`);
    grd.addColorStop(0.25, `rgba(${R},${G},${B},0.55)`);
    grd.addColorStop(1, `rgba(${R},${G},${B},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, r * 2, r * 2);
    GLOW.set(key, c);
  }
  return c;
}
function glowAt(x, y, col, r, a, g = gctx) {
  if (a <= 0.01) return;
  const rr = Math.max(2, Math.round(r / 2));
  g.globalAlpha = clamp(a, 0, 1);
  g.drawImage(glowSprite(col, rr), x / 2 - rr, y / 2 - rr);
}
// The static lights (hundreds of windows, lamps, flowers) are baked into four
// layers once; each layer flickers as a whole, out of step.
let emitterLayers = [];
function bakeEmitters() {
  emitterLayers = [0, 1, 2, 3].map(() => makeCanvas(gcv.width, gcv.height));
  const gs = emitterLayers.map((c) => {
    const g = c.getContext("2d");
    g.globalCompositeOperation = "lighter";
    return g;
  });
  emitters.forEach((e, i) => glowAt(e.x, e.y, e.col, e.r, e.a, gs[i % 4]));
}
function beginGlow() {
  gctx.globalCompositeOperation = "source-over";
  gctx.globalAlpha = 1;
  gctx.fillStyle = "#000";
  gctx.fillRect(0, 0, gcv.width, gcv.height);
  gctx.globalCompositeOperation = "lighter";
}
function endGlow() {
  gctx.globalAlpha = 1;
  gctx.globalCompositeOperation = "source-over";
}
function glowEmitters(t, depth = 0.35) {
  emitterLayers.forEach((c, k) => {
    gctx.globalAlpha = 1 - depth + depth * Math.sin(t * 1.3 + k * 1.9);
    gctx.drawImage(c, 0, 0);
  });
}
// every bead glows a little, the travelling ones brightly; packets blaze
function glowRoutes(t) {
  for (const k of SPOKES) {
    const p = paths[k];
    const busy = t < p.busyUntil;
    const flow = t * (busy ? 26 : 8) * p.dir;
    for (const b of p.beads) {
      const lead = cycle((b.d - flow) / 6, busy ? 3 : 6) === 0;
      glowAt(b.x, b.y, b.col, lead ? 10 : 6, lead ? (busy ? 0.9 : 0.6) : busy ? 0.4 : 0.22);
    }
  }
  for (const pk of packets) {
    const s = clamp((t - pk.t0) / pk.dur, 0, 1);
    const q = pathAt(pk.key, pk.fromHub ? s : 1 - s);
    glowAt(q.x, q.y, pk.col, 20, 0.9);
    glowAt(q.x, q.y, P.white, 8, 0.8);
  }
}

// ============================================================
// Agents on the map
// ============================================================
const fleet = {};
function initFleet() {
  AGENTS.forEach((a, i) => {
    fleet[a.id] = { a, x: 0, y: 0, visible: false, at: "hub", face: 1, travel: null, beam: null, doing: "", progress: 0, ph: i * 1.3, slot: i, emit: 0, trailT: 0, state: "idle", readTok: 0, sentTok: 0, taskTok: 0, trail: [] };
  });
}
function agentPos(ag) {
  const lift = W.agentLift ?? 10;
  if (ag.travel) {
    const tr = ag.travel;
    const k = easeInOut(clamp((clock.t - tr.t0) / tr.dur, 0, 1));
    const p = pathAt(tr.path, lerp(tr.f0, tr.f1, k));
    return { x: p.x, y: p.y - lift, face: (tr.f1 > tr.f0 ? 1 : -1) * Math.sign(p.dx || 1) };
  }
  if (ag.at === "hub") return { x: STATIONS.hub.x, y: STATIONS.hub.y - lift, face: ag.face };
  const end = pathAt(ag.at, 1);
  const s = STATIONS[ag.at];
  const off = (ag.slot % 3) - 1;
  return { x: end.x + off * 6, y: end.y - lift + off * 3, face: s.x >= end.x ? 1 : -1 };
}
function agentPort(ag) {
  return W.agentPort ? W.agentPort(ag) : { x: ag.x + ag.face * 8, y: ag.y };
}
function updateFleet(dt) {
  for (const ag of Object.values(fleet)) {
    if (!ag.visible) continue;
    const p = agentPos(ag);
    ag.x = p.x;
    ag.y = p.y;
    ag.face = p.face;
    W.onAgentStep?.(ag, dt);
    if (ag.beam?.emit) {
      ag.emit += dt * 18;
      while (ag.emit >= 1) {
        ag.emit -= 1;
        particles.push({ kind: "speck", ag, tx: ag.beam.x + (Math.random() - 0.5) * 10, ty: ag.beam.y + (Math.random() - 0.5) * 8, out: ag.beam.out, col: ag.beam.col, t0: clock.t, life: 0.6 + Math.random() * 0.3, wig: (Math.random() - 0.5) * 5 });
      }
    }
  }
}
async function travel(ag, key, f0, f1) {
  const dur = clamp((paths[key].L * Math.abs(f1 - f0)) / (68 * grain()), 0.8, 4); // the same pace on a finer map
  ag.travel = { path: key, f0, f1, t0: clock.t, dur };
  paths[key].busyUntil = clock.t + dur + 0.5;
  paths[key].dir = f1 > f0 ? 1 : -1;
  await sleep(dur);
  ag.travel = null;
}

let particles = [];
let packets = [];
async function packet(key, fromHub, col) {
  const p = paths[key];
  const pk = { key, fromHub, col, t0: clock.t, dur: clamp(p.L / (120 * grain()), 0.6, 2.2) };
  packets.push(pk);
  p.busyUntil = clock.t + pk.dur + 0.6;
  p.dir = fromHub ? 1 : -1;
  await sleep(pk.dur);
  packets = packets.filter((q) => q !== pk);
  const end = pathAt(key, fromHub ? 1 : 0);
  particles.push({ kind: "ring", x: end.x, y: end.y - 4, col, t0: clock.t, life: 0.45 });
}
function updateParticles(dt) {
  for (const p of particles) {
    W.updateParticle?.(p, dt);
    if (clock.t - p.t0 > p.life) p.dead = true;
  }
  particles = particles.filter((p) => !p.dead);
  if (particles.length > 1000) particles.splice(0, particles.length - 1000);
}

// ============================================================
// The villain — a failing test, come for the Testing Lab
// ============================================================
const villain = {
  state: "hidden", k: 0, grab: 0, note: "",
  head() {
    return W.villainHead();
  },
  update(dt) {
    if (this.state === "rising") {
      this.k = Math.min(1, this.k + dt * 0.8);
      if (this.k > 0.7) this.grab = Math.min(1, this.grab + dt * 0.9);
    } else if (this.state === "visiting") {
      this.k = Math.min(0.85, this.k + dt * 0.3);
    } else if (this.state === "sinking") {
      this.grab = Math.max(0, this.grab - dt * 2.5);
      this.k = Math.max(0, this.k - dt * 0.7);
      if (!this.k) this.state = "hidden";
    }
  },
};

// ============================================================
// Drawing helpers
// ============================================================
function px(g, x, y, col) {
  g.fillStyle = col;
  g.fillRect(Math.round(x), Math.round(y), 1, 1);
}
function disc(g, cx, cy, r, col) {
  g.fillStyle = col;
  cx = Math.round(cx);
  cy = Math.round(cy);
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) {
    if (r * r - dy * dy < 0) continue;
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    g.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}
function ditherTri(g, ax, ay, bx, by, cx, cy, col, pattern) {
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(map.W - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(map.H - 1, Math.ceil(Math.max(ay, by, cy)));
  g.fillStyle = col;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!pattern(x, y)) continue;
      const qx = x + 0.5, qy = y + 0.5;
      const w0 = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax);
      const w1 = (cx - bx) * (qy - by) - (cy - by) * (qx - bx);
      const w2 = (ax - cx) * (qy - cy) - (ay - cy) * (qx - cx);
      if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) g.fillRect(x, y, 1, 1);
    }
  }
}
// a beam of light from an agent to what it works on, flickering
function drawBeam(g, t, ag, from) {
  const b = ag.beam;
  const dx = b.x - from.x, dy = b.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * 4, ny = (dx / len) * 4;
  const shift = Math.floor(t * 8);
  ditherTri(g, from.x, from.y, b.x + nx, b.y + ny, b.x - nx, b.y - ny, b.col, (x, y) => hash2(x >> 1, y, shift) < 0.35);
}
function ellipseDots(g, cx, cy, rx, ry, col, step, phase) {
  g.fillStyle = col;
  const n = Math.round((Math.PI * (rx + ry)) / step);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + phase;
    g.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
  }
}
// a tapering limb along a list of points: tentacles, vines, cables
function drawTentacle(g, pts, r0, r1, body, sucker, edge = P.ink) {
  const n = pts.length;
  for (let i = 0; i < n; i++) disc(g, pts[i].x, pts[i].y, lerp(r0, r1, i / (n - 1)) + 1, edge);
  for (let i = 0; i < n; i++) {
    const r = lerp(r0, r1, i / (n - 1));
    disc(g, pts[i].x, pts[i].y, r, body);
    if (i % 3 === 1 && r > 1) px(g, pts[i].x, pts[i].y + r - 0.5, sucker);
  }
}
// limbs waving down from roots on a body
function arms(g, t, x0, y0, roots, len, body, sucker, spread, seed, edge, r0 = 2.1) {
  roots.forEach(([rx, ry], j) => {
    const pts = [];
    let x = x0 + rx, y = y0 + ry, ang = Math.PI / 2 + (j - (roots.length - 1) / 2) * spread;
    for (let s = 0; s < len; s++) {
      ang += Math.sin(t * 1.8 + j * 1.3 + s * 0.35 + seed) * 0.2;
      x += Math.cos(ang) * 2.2;
      y += Math.sin(ang) * 2.2;
      pts.push({ x, y });
    }
    drawTentacle(g, pts, r0, 0.6, body, sucker, edge);
  });
}
// the villain's reach: a limb from its body to the Testing Lab, curling round it
function drawGrab(g, t, from, body, sucker, edge, r0 = 2.3) {
  if (villain.grab <= 0) return;
  const s = STATIONS.tests;
  const b = { x: s.x + s.prx * 0.25, y: s.y - 14 };
  const c = { x: (from.x + b.x) / 2 - 24, y: Math.min(from.y, b.y) - 16 };
  const N = Math.round(Math.hypot(b.x - from.x, b.y - from.y) / 2.2);
  const upto = Math.round(N * villain.grab);
  const pts = [];
  for (let i = 0; i <= upto; i++) {
    const q = i / N;
    const w = Math.sin(t * 3 + i * 0.45) * 1.2 * Math.sin(Math.PI * q);
    pts.push({ x: (1 - q) * (1 - q) * from.x + 2 * (1 - q) * q * c.x + q * q * b.x + w, y: (1 - q) * (1 - q) * from.y + 2 * (1 - q) * q * c.y + q * q * b.y + w * 0.5 });
  }
  if (villain.grab >= 1) {
    for (let k = 0; k <= 16; k++) {
      const an = -Math.PI * 0.5 + (k / 16) * Math.PI * 1.7;
      pts.push({ x: s.x + Math.cos(an) * (s.prx - 4), y: s.y - 8 + Math.sin(an) * 14 });
    }
  }
  if (pts.length > 1) drawTentacle(g, pts, r0, 0.8, body, sucker, edge);
}

// routes as round beads; a white-hot core where the pulse passes
function drawPaths(g, t) {
  for (const k of SPOKES) {
    const p = paths[k];
    const busy = t < p.busyUntil;
    const flow = t * (busy ? 26 : 8) * p.dir;
    for (const b of p.beads) {
      const lead = cycle((b.d - flow) / 6, busy ? 3 : 6) === 0;
      g.fillStyle = lead || busy ? b.col : b.dim;
      g.fillRect(b.x - 1, b.y, 3, 1);
      g.fillRect(b.x, b.y - 1, 1, 3);
      if (lead) {
        g.fillStyle = P.white;
        g.fillRect(b.x, b.y, 1, 1);
      }
    }
  }
  for (const pk of packets) {
    const s = clamp((t - pk.t0) / pk.dur, 0, 1);
    const f = pk.fromHub ? s : 1 - s;
    for (let k = 3; k >= 0; k--) {
      const q = pathAt(pk.key, pk.fromHub ? f - k * 0.02 : f + k * 0.02);
      disc(g, q.x, q.y, k ? 0.6 : 1.8, k ? pk.col : P.white);
    }
    const q = pathAt(pk.key, f);
    disc(g, q.x, q.y, 1.2, pk.col);
  }
}

function drawStations(g, t) {
  const order = [...STATION_KEYS].sort((a, b) => STATIONS[a].y - STATIONS[b].y);
  for (const k of order) {
    const s = STATIONS[k];
    const busy = S && S.busy?.[k] > 0;
    const col = k === "hub" ? P[s.color] : s.col;
    if (busy || selected?.key === k) {
      const pulse = 1 + Math.sin(t * 4) * 0.06;
      ellipseDots(g, s.x, s.y + s.pry + 6, (s.prx + 12) * pulse, (s.pry + 6) * pulse, col, 2.2, t * 0.6);
      if (selected?.key === k) ellipseDots(g, s.x, s.y + s.pry + 6, s.prx + 16, s.pry + 9, P.white, 3, -t * 0.4);
    }
    if (k === "tests" && villain.state === "rising" && villain.grab > 0.5) ellipseDots(g, s.x, s.y + s.pry + 6, s.prx + 9, s.pry + 5, P.red, 2, t * 2);
    g.drawImage(spr(s.frame), s.sx, s.sy);
    W.drawStationFx?.(g, t, s);
    for (const [lx, ly] of s.lamps) if (cycle(t * 2 + lx * 0.3, 7) === 0) px(g, lx, ly, P.white);
  }
}

// rings where packets land, specks along working beams; the world draws the rest
function drawParticles(g, t) {
  for (const p of particles) {
    const age = t - p.t0;
    if (p.kind === "speck") {
      const s = easeInOut(clamp(age / p.life, 0, 1));
      const port = agentPort(p.ag);
      const from = p.out ? port : { x: p.tx, y: p.ty };
      const to = p.out ? { x: p.tx, y: p.ty } : port;
      g.fillStyle = p.col;
      g.fillRect(Math.round(lerp(from.x, to.x, s)), Math.round(lerp(from.y, to.y, s) + Math.sin(Math.PI * s) * p.wig), 1, 1);
    } else if (p.kind === "ring") {
      const r = 1 + (age / p.life) * 7;
      ellipseDots(g, p.x, p.y, r, r * 0.6, p.col, 1.6, 0);
    } else W.drawParticle?.(g, p, t, age);
  }
}

// ============================================================
// Overlay: station cards, agent tags, popover
// ============================================================
const overlay = $("#overlay");
const mapEl = $("#map");
const cards = {};
const tags = {};
let selected = null;

function artToCss(x, y) {
  return { x: map.ox + x * map.scale, y: map.oy + y * map.scale };
}
const stationColor = (k) => (k === "hub" ? "var(--hub)" : `var(--${STATIONS[k].color})`);
function buildOverlay() {
  overlay.textContent = "";
  for (const k of STATION_KEYS) {
    const s = STATIONS[k];
    const el = document.createElement("div");
    el.className = "scard";
    el.style.setProperty("--c", stationColor(k));
    el.innerHTML = `<div class="h"></div>${k === "hub" ? `<div class="sub">${esc(s.sub)}</div>` : "<ul></ul>"}`;
    el.querySelector(".h").append(iconCanvas(s.icon), Object.assign(document.createElement("span"), { textContent: s.name }));
    el.addEventListener("click", () => openPop({ kind: "station", key: k }));
    overlay.appendChild(el);
    cards[k] = { el, ul: el.querySelector("ul"), last: "" };
  }
  for (const a of AGENTS) {
    const el = document.createElement("div");
    el.className = "tag";
    el.hidden = true;
    el.style.setProperty("--c", `var(--${a.color})`);
    el.innerHTML = `<b>Agent ${esc(a.name)}</b><span></span><div class="pips"><i></i><i></i><i></i><i></i></div>`;
    el.addEventListener("click", () => openPop({ kind: "agent", id: a.id }));
    overlay.appendChild(el);
    tags[a.id] = { el, span: el.querySelector("span"), pips: [...el.querySelectorAll(".pips i")], last: "" };
  }
  const pop = document.createElement("div");
  pop.className = "pop";
  pop.id = "pop";
  pop.hidden = true;
  overlay.appendChild(pop);
}

function stationRows(k) {
  if (!S) return [];
  const hot = S.hot[k];
  const on = (key) => hot && hot.key === key && clock.t < hot.until;
  const icon = (key, fallback) => (ROW_ICON[k] && ROW_ICON[k][key]) || fallback;
  switch (k) {
    case "knowledge":
    case "documents":
    case "memory":
      return Object.entries(S[k].rows).map(([key, [label, n]]) => [icon(key, "ri.paper"), label, fmtNum(n), on(key)]);
    case "models":
      return S.models.list.map((m) => [icon("model", "ri.model"), m.name, m.status === "training" ? `<span class="run">v${m.v} ${m.pct}%</span>` : m.status === "evaluating" ? `<span class="run">v${m.v} eval</span>` : m.status === "draft" ? `<span class="dim">v${m.v} draft</span>` : `v${m.v}`, on(m.name)]);
    case "repos":
      return S.repos.list.map((r) => [icon("repo", "ri.repo"), r.name, r.branch === "main" || r.branch === "dev" ? `<span class="dim">${r.branch}</span>` : `<span class="ok">${esc(r.branch.replace("feature/", "⎇ "))}</span>`, on(r.name)]);
    case "tests":
      return Object.entries(S.tests.suites).map(([key, s]) => {
        const v = s.state === "queued" ? `<span class="dim">queued</span>` : s.state === "run" ? `<span class="run">▸ ${s.done}/${s.total}</span>` : s.state === "fail" ? `<span class="bad">✗ ${s.done}/${s.total}</span>` : s.state === "pass" ? `<span class="ok">✓ ${s.done}/${s.total}</span>` : `<span class="dim">${s.done}/${s.total}</span>`;
        return [icon(key, "ri.check"), s.name, v, on(key)];
      });
    case "deploy":
      return Object.entries(S.deploy.envs).map(([key, e]) => [icon("env", "ri.env"), e.name, e.status === "healthy" ? `<span class="ok">● Healthy</span>` : e.status === "syncing" ? `<span class="run">● Syncing</span>` : e.status === "deploying" ? `<span class="run">▸ Deploying</span>` : `<span class="bad">● ${esc(e.status)}</span>`, on(key)]);
  }
  return [];
}
function updateCards() {
  for (const k of STATION_KEYS) {
    const c = cards[k];
    if (c.ul) {
      const html = stationRows(k).map(([ic, l, v, hot]) => `<li${hot ? ' class="hot"' : ""}><i class="ri" style="background-image:url(${iconUrl(ic)})"></i><span>${esc(l)}</span><em>${v}</em></li>`).join("");
      if (html !== c.last) {
        c.ul.innerHTML = html;
        c.last = html;
      }
    }
    c.el.classList.toggle("busy", !!(S?.busy?.[k] > 0));
    c.el.classList.toggle("alarm", k === "tests" && villain.state === "rising");
  }
}

// Try each preferred side; keep the spot that stays on the map and covers
// the least of the stations and of the cards already placed.
let cardRects = [];
function placeCards() {
  cardRects = [];
  const MW = mapEl.clientWidth, MH = mapEl.clientHeight;
  mapEl.classList.toggle("compact", MW < 860);
  const cardK = clamp((map.scale * grain()) / 1.9, 0.7, 1);
  mapEl.style.setProperty("--card-k", cardK.toFixed(3));
  const places = STATION_KEYS.map((key) => {
    const s = STATIONS[key];
    const a = artToCss(s.sx + 8, s.sy + 10), b = artToCss(s.sx + s.w - 8, s.sy + s.h - 8);
    return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  });
  const area = (r, list) => list.reduce((sum, o) => sum + Math.max(0, Math.min(r.x + r.w, o.x + o.w) - Math.max(r.x, o.x)) * Math.max(0, Math.min(r.y + r.h, o.y + o.h) - Math.max(r.y, o.y)), 0);
  const overlap = (r) => area(r, places) + area(r, cardRects) * 3;
  const order = ["hub", "documents", "knowledge", "models", "tests", "repos", "memory", "deploy"];
  for (const k of order) {
    const s = STATIONS[k];
    const el = cards[k].el;
    const w = el.offsetWidth * cardK, h = el.offsetHeight * cardK;
    const top = artToCss(s.x, s.sy + 4), base = artToCss(s.x, s.y + s.pry + 14), left = artToCss(s.sx + 6, s.y - 10), right = artToCss(s.sx + s.w - 6, s.y - 10);
    const cand = {
      below: { x: base.x - w / 2, y: base.y - 4 },
      above: { x: top.x - w / 2, y: top.y - h - 2 },
      right: { x: right.x - 4, y: right.y - h / 2 },
      left: { x: left.x - w + 4, y: left.y - h / 2 },
      belowLeft: { x: base.x - w + 16, y: base.y - 4 },
      belowRight: { x: base.x - 16, y: base.y - 4 },
      aboveLeft: { x: top.x - w + 16, y: top.y - h - 2 },
      aboveRight: { x: top.x - 16, y: top.y - h - 2 },
    };
    let best = null, bestScore = Infinity;
    [...s.prefer, "below", "right", "left", "above", "belowLeft", "belowRight", "aboveLeft", "aboveRight"].forEach((side, i) => {
      const c = cand[side];
      const r = { x: clamp(c.x, 6, MW - w - 6), y: clamp(c.y, 6, MH - h - 6), w, h };
      const score = overlap(r) + i * 25 + Math.hypot(r.x - c.x, r.y - c.y) * 2;
      if (score < bestScore) { bestScore = score; best = r; }
    });
    el.style.left = `${Math.round(best.x)}px`;
    el.style.top = `${Math.round(best.y)}px`;
    cardRects.push(best);
  }
}

function updateTags() {
  for (const a of AGENTS) {
    const ag = fleet[a.id];
    const tg = tags[a.id];
    if (!ag.visible) {
      if (!tg.el.hidden) tg.el.hidden = true;
      continue;
    }
    if (tg.el.hidden) {
      tg.el.hidden = false;
      tg.last = "";
    }
    const key = `${ag.doing}|${Math.round(ag.progress * 4)}|${mapEl.classList.contains("compact")}`;
    if (key !== tg.last) {
      tg.last = key;
      tg.span.textContent = `${ag.doing}…`;
      tg.pips.forEach((pp, i) => pp.classList.toggle("on", i < Math.max(1, Math.round(ag.progress * 4))));
      tg.w = tg.el.offsetWidth;
      tg.h = tg.el.offsetHeight;
    }
    const p = artToCss(ag.x, ag.y - 9);
    const gap = 10 * map.scale * grain();
    const spots = {
      above: { x: p.x - tg.w / 2, y: p.y - tg.h - 2 },
      below: { x: p.x - tg.w / 2, y: p.y + gap },
      left: { x: p.x - tg.w - gap * 1.2, y: p.y - tg.h / 2 },
      right: { x: p.x + gap * 1.2, y: p.y - tg.h / 2 },
    };
    const hits = (r) => cardRects.some((c) => r.x < c.x + c.w && r.x + tg.w > c.x && r.y < c.y + c.h && r.y + tg.h > c.y);
    if (!tg.side || hits(spots[tg.side])) tg.side = ["above", "right", "left", "below"].find((k) => !hits(spots[k])) ?? "above";
    const at = spots[tg.side];
    const x = clamp(at.x, 4, mapEl.clientWidth - tg.w - 4), y = clamp(at.y, 4, mapEl.clientHeight - tg.h - 4);
    tg.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
}

// Popover — the station or agent in detail
const popEl = () => $("#pop");
function openPop(what) {
  selected = what.kind === "station" ? { kind: "station", key: what.key } : what;
  for (const b of document.querySelectorAll("#nav button")) b.classList.toggle("on", b.dataset.target === (what.key ?? "") || (what.kind === "agent" && b.dataset.target === "agents"));
  renderPop(true);
}
function closePop() {
  selected = null;
  popEl().hidden = true;
  for (const b of document.querySelectorAll("#nav button")) b.classList.toggle("on", b.dataset.target === W.nav[0][0]);
}
let popLast = "";
function renderPop(place) {
  const el = popEl();
  if (!selected || !S) return;
  let title, color, body;
  if (selected.kind === "agent") {
    const a = A[selected.id], ag = fleet[a.id];
    title = `Agent ${a.name}`;
    color = `var(--${a.color})`;
    body = `<p>${esc(a.role)} — ${esc(a.blurb)}.</p>
      <table><tr><td>Home station</td><td>${esc(STATIONS[a.home].name)}</td></tr>
      <tr><td>Now</td><td>${ag.visible ? esc(ag.doing || "travelling") : esc(TEXT.docked)}</td></tr>
      <tr><td>Read this ${TEXT.run}</td><td>${fmtTok(ag.readTok)} tok</td></tr><tr><td>Reported back</td><td>${fmtTok(ag.sentTok)} tok</td></tr></table>
      <div><h3>Recent</h3>${ag.trail.length ? `<ul>${ag.trail.slice(-6).reverse().map((x) => `<li>${x}</li>`).join("")}</ul>` : `<p>Nothing yet this ${TEXT.run}.</p>`}</div>`;
  } else {
    const k = selected.key, s = STATIONS[k];
    title = s.name;
    color = stationColor(k);
    body = stationDetail(k);
  }
  const html = `<header><h2>${esc(title)}</h2><button type="button" aria-label="Close">×</button></header><div class="body">${body}</div>`;
  if (html !== popLast) {
    const scroll = el.scrollTop;
    el.innerHTML = html;
    el.querySelector("header button").addEventListener("click", closePop);
    el.scrollTop = scroll;
    popLast = html;
  }
  el.style.setProperty("--c", color);
  el.hidden = false;
  if (place) {
    const frame = $("#map-frame");
    const vx = frame.scrollLeft, vw = frame.clientWidth;
    let anchor;
    if (selected.kind === "agent") anchor = artToCss(fleet[selected.id].visible ? fleet[selected.id].x : STATIONS.hub.x, STATIONS.hub.y);
    else anchor = artToCss(STATIONS[selected.key].x, STATIONS[selected.key].y);
    el.style.top = "12px";
    el.style.left = `${anchor.x - vx > vw / 2 ? vx + 12 : vx + vw - el.offsetWidth - 12}px`;
  }
}
function stationDetail(k) {
  const tbl = (rows) => `<table>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</table>`;
  const list = (items, empty) => (items.length ? `<ul>${items.map((x) => `<li>${x}</li>`).join("")}</ul>` : `<p>${empty}</p>`);
  const about = `<p>${TEXT.about[k] ?? ""}</p>`;
  const run = TEXT.run;
  switch (k) {
    case "hub": {
      const read = Object.values(fleet).reduce((n, ag) => n + ag.readTok, 0);
      return `${about}
        <div><h3>Order</h3><p>“${esc(mission.project?.order ?? "")}”</p></div>
        <div><h3>Plan</h3>${S.hub.plan.length ? `<ol>${S.hub.plan.map((p) => `<li class="${p.state === "done" ? "ok" : p.state === "on" ? "run" : ""}">${esc(p.text)} <span style="color:var(--${A[p.agent].color})">· ${esc(A[p.agent].name)}</span></li>`).join("")}</ol>` : "<p>Drafted after the research reports are in.</p>"}</div>
        <div><h3>Context ledger</h3>${tbl([[`Read by the ${TEXT.crew}`, `${fmtTok(read)} tok`], ["Held by the orchestrator", `${fmtTok(S.hub.ctx)} tok`], ["Reports received", S.hub.reports], ["Compression", read && S.hub.ctx ? `${Math.max(1, Math.round(read / S.hub.ctx))}×` : "—"]])}</div>`;
    }
    case "knowledge":
      return `${about}${tbl(Object.values(S.knowledge.rows).map(([l, n]) => [l, fmtNum(n)]))}
        <div><h3>Read this ${run}</h3>${list(S.knowledge.read.map((r) => `${esc(r.title)} <span style="color:var(--faint)">· ${fmtTok(r.tok)} tok · ${esc(A[r.by].name)}</span>`), "Nothing read yet.")}</div>`;
    case "documents":
      return `${about}${tbl(Object.values(S.documents.rows).map(([l, n]) => [l, fmtNum(n)]))}
        <div><h3>Written this ${run}</h3>${list(S.documents.written.map((d) => `<span class="ok">+</span> ${esc(d)}`), "Nothing written yet.")}</div>
        <div><h3>Read this ${run}</h3>${list(S.documents.read.map((d) => esc(d)), "Nothing read yet.")}</div>`;
    case "models":
      return `${about}${tbl(S.models.list.map((m) => [m.name, `v${m.v} <span class="${m.status === "live" ? "ok" : m.status === "draft" ? "" : "run"}">${m.status}${m.status === "training" ? ` ${m.pct}%` : ""}</span>`]))}
        <div><h3>Training log</h3>${list(S.models.log.slice(-6).map((x) => esc(x)), `No runs yet this ${run}.`)}</div>`;
    case "repos":
      return `${about}${tbl(S.repos.list.map((r) => [code(r.name), `${esc(r.branch)}${r.add || r.del ? ` <span class="ok">+${r.add}</span> <span class="bad">−${r.del}</span>` : ""}`]))}
        <div><h3>Recent commits</h3>${list(S.repos.commits.slice(-4).reverse().map(([h, r, m]) => `${code(h)} ${esc(r)}: ${esc(m)}`), "")}</div>
        <p>Line-by-line changes are in the <b>Changes</b> tab below.</p>`;
    case "tests":
      return `${about}${tbl(Object.values(S.tests.suites).map((s) => [s.name, s.state === "queued" ? "queued" : `<span class="${s.state === "pass" ? "ok" : s.state === "fail" ? "bad" : s.state === "run" ? "run" : ""}">${s.done}/${s.total}</span>`]))}
        ${villain.state === "rising" ? `<p class="bad">✗ ${esc(villain.note)}</p>` : ""}<p>Full output is in the <b>Tests</b> tab below.</p>`;
    case "memory":
      return `${about}${tbl(Object.values(S.memory.rows).map(([l, n, u]) => [l, `${fmtNum(n)} ${u}`]))}
        <div><h3>Lessons</h3>${list(S.memory.lessons.slice(-6).reverse().map((x) => `“${esc(x)}”`), "")}</div>`;
    case "deploy":
      return `${about}${tbl(Object.values(S.deploy.envs).map((e) => [e.name, `${esc(e.v)} · <span class="${e.status === "healthy" ? "ok" : "run"}">${esc(e.status)}</span>`]))}
        <div><h3>Release log</h3>${list(S.deploy.log.slice(-6).reverse().map((x) => esc(x)), `No releases yet this ${run}.`)}</div>`;
  }
  return "";
}

// ============================================================
// Dock panels
// ============================================================
const feedEl = $("#feed");
function logAct(who, html, meta) {
  const li = document.createElement("li");
  li.className = "fresh";
  const [name, color] = WHO[who];
  li.style.setProperty("--c", color);
  li.innerHTML = `<time>${fmtClock(clock.t)}</time><span class="who">${esc(name)}</span><span class="msg">${html}${meta ? ` <span class="meta">${meta}</span>` : ""}</span>`;
  const box = $("#tab-feed");
  const stick = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  feedEl.appendChild(li);
  while (feedEl.children.length > 220) feedEl.firstChild.remove();
  if (stick) box.scrollTop = box.scrollHeight;
  if (AGENTS.some((a) => a.id === who)) {
    const ag = fleet[who];
    ag.trail.push(html);
    if (ag.trail.length > 20) ag.trail.shift();
  }
}
function logPhase(text) {
  const li = document.createElement("li");
  li.className = "phase";
  li.textContent = text;
  feedEl.appendChild(li);
  $("#tab-feed").scrollTop = $("#tab-feed").scrollHeight;
}

let tabPinnedUntil = 0;
function showTab(name, byUser) {
  if (!byUser && performance.now() < tabPinnedUntil) return;
  if (byUser) tabPinnedUntil = performance.now() + 20000;
  for (const b of document.querySelectorAll(".tabs button")) b.setAttribute("aria-selected", String(b.dataset.tab === name));
  for (const id of ["feed", "diff", "tests"]) $(`#tab-${id}`).hidden = id !== name;
}
for (const b of document.querySelectorAll(".tabs button")) b.addEventListener("click", () => showTab(b.dataset.tab, true));

const homeOf = (station) => AGENTS.find((a) => a.home === station);
const diffEl = $("#tab-diff");
const diffUI = {
  files: new Map(),
  clear() {
    this.files.clear();
    diffEl.innerHTML = `<p class="empty">No changes yet. Edits appear here line by line as ${esc(homeOf("repos").name)} writes them into the repositories.</p>`;
    $("#diff-n").textContent = "";
  },
  file(repo, path, hunk, created) {
    if (!this.files.size) diffEl.textContent = "";
    const key = `${repo}/${path}`;
    let f = this.files.get(key);
    if (!f) {
      const box = document.createElement("div");
      box.className = "file";
      box.innerHTML = `<div class="fh"><span class="path"><span class="badge">${created ? "A" : "M"}</span>${esc(repo)}/${esc(path)}</span><span class="stat"></span></div><pre></pre>`;
      diffEl.appendChild(box);
      f = { box, pre: box.querySelector("pre"), add: 0, del: 0 };
      this.files.set(key, f);
      $("#diff-n").textContent = this.files.size;
    }
    this.line(f, hunk, "hunk");
    return f;
  },
  line(f, text, cls) {
    for (const el of f.pre.querySelectorAll(".live")) el.classList.remove("live");
    const span = document.createElement("span");
    span.className = `l ${cls} live`;
    span.textContent = cls === "hunk" ? text : `${text[0]} ${text.slice(1)}`;
    f.pre.appendChild(span);
    if (cls === "add") f.add++;
    if (cls === "del") f.del++;
    f.box.querySelector(".stat").innerHTML = `<span class="a">+${f.add}</span> <span class="d">−${f.del}</span>`;
    diffEl.scrollTop = diffEl.scrollHeight;
  },
  settle() {
    for (const el of diffEl.querySelectorAll(".live")) el.classList.remove("live");
  },
  commit(hash, repo, msg) {
    const d = document.createElement("div");
    d.className = "commit";
    d.innerHTML = `merged <b>${esc(hash)}</b> into ${esc(repo)}/main — ${esc(msg)}`;
    diffEl.appendChild(d);
    diffEl.scrollTop = diffEl.scrollHeight;
  },
};
const testsEl = $("#tab-tests");
const testsUI = {
  runs: 0,
  clear() {
    this.runs = 0;
    testsEl.innerHTML = `<p class="empty">No runs yet. ${esc(homeOf("tests").name)} runs the suites once the build is in.</p>`;
    $("#tests-n").textContent = "";
  },
  run(cmd) {
    if (!this.runs) testsEl.textContent = "";
    this.runs++;
    $("#tests-n").textContent = this.runs;
    const d = document.createElement("div");
    d.className = "run";
    d.innerHTML = `<div class="cmd">$ ${esc(cmd)}</div>`;
    testsEl.appendChild(d);
    return d;
  },
  line(run, html) {
    run.insertAdjacentHTML("beforeend", html);
    testsEl.scrollTop = testsEl.scrollHeight;
  },
};

function buildAgentsPanel() {
  const ul = $("#agents");
  ul.textContent = "";
  for (const a of AGENTS) {
    const li = document.createElement("li");
    li.style.setProperty("--c", `var(--${a.color})`);
    li.appendChild(iconCanvas(W.agentIcon(a)));
    li.insertAdjacentHTML("beforeend", `<span class="nm">${esc(a.name)}</span><span class="dot"></span><span class="state"></span><span class="what"></span>`);
    li.title = `${a.name} — ${a.role}: ${a.blurb}`;
    li.addEventListener("click", () => openPop({ kind: "agent", id: a.id }));
    ul.appendChild(li);
    a.row = { li, state: li.querySelector(".state"), what: li.querySelector(".what"), last: "" };
  }
}
function updateAgentsPanel() {
  let active = 0;
  for (const a of AGENTS) {
    const ag = fleet[a.id];
    const on = ag.visible;
    if (on) active++;
    const key = `${on}|${ag.state}|${ag.doing}`;
    if (key === a.row.last) continue;
    a.row.last = key;
    a.row.li.classList.toggle("idle", !on);
    a.row.state.textContent = on ? ag.state : TEXT.idle;
    a.row.what.textContent = on ? ag.doing : "";
  }
  $("#agents-n").textContent = `(${active}/${AGENTS.length})`;
}

function buildPipeline() {
  $("#pipeline").innerHTML = PHASES.map((p, i) => `<li style="--c:var(--${p.key})"><span class="n">${i + 1}</span><span class="lbl">${p.name}</span></li>`).join("");
  $("#checks").innerHTML = PHASES.map((p) => `<li style="--c:var(--${p.key})">${p.check}</li>`).join("");
}
function setPhaseUI(p) {
  [...$("#pipeline").children].forEach((li, i) => {
    li.classList.toggle("done", i < p);
    li.classList.toggle("on", i === p);
  });
  [...$("#checks").children].forEach((li, i) => {
    li.classList.toggle("done", i < p);
    li.classList.toggle("on", i === p);
  });
  const [q, src] = QUOTES[clamp(p, 0, 4)];
  $("#quote").textContent = q;
  $("#quote-src").textContent = src;
  $("#phase-n").textContent = p < 0 ? TEXT.orders : p > 4 ? "done" : `${p + 1}/5`;
  $("#pipe-note").textContent = mission.project ? mission.project.ticket : TEXT.pipeNote;
}
function updateProgress() {
  const p = mission.phase;
  const frac = p < 0 ? 0 : p > 4 ? 1 : (p + clamp(mission.phaseFrac, 0, 0.95)) / 5;
  const pct = Math.round(frac * 100);
  const bar = $("#prog-bar");
  bar.style.width = `${pct}%`;
  bar.style.setProperty("--full", `${frac > 0 ? (100 / frac).toFixed(1) : 100}%`);
  $("#prog-pct").textContent = `${pct}%`;
  const read = Object.values(fleet).reduce((n, ag) => n + ag.readTok, 0);
  $("#ledger").innerHTML = read
    ? `${TEXT.Crew} read <b>${fmtTok(read)}</b> tok; the orchestrator holds <b>${fmtTok(S.hub.ctx)}</b> — about ${Math.max(1, Math.round(read / Math.max(1, S.hub.ctx)))}× less.`
    : `${TEXT.Crew} read in their own contexts; only short reports reach the orchestrator.`;
  $("#clock").textContent = fmtDay(clock.t);
  $("#meter").textContent = TEXT.meter(mission.meter);
}

// Minimap: the static map in miniature, stations marked by status.
const mini = $("#minimap");
const mctx = mini.getContext("2d");
let miniBase = null;
function drawMinimapBase() {
  const w = Math.round(map.W / 3), h = Math.round(map.H / 3);
  mini.width = w;
  mini.height = h;
  miniBase = makeCanvas(w, h);
  const g = miniBase.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.drawImage(staticCanvas, 0, 0, w, h);
  g.fillStyle = "rgba(4, 9, 20, 0.35)";
  g.fillRect(0, 0, w, h);
}
function drawMinimap(t) {
  if (!miniBase || !S) return;
  mctx.drawImage(miniBase, 0, 0);
  for (const k of SPOKES) {
    const p = paths[k];
    mctx.fillStyle = S.visited.has(k) ? "rgba(94,224,138,.6)" : "rgba(226,233,242,.2)";
    for (let d = 0; d < p.L; d += 9) {
      const q = pathAt(k, d / p.L);
      mctx.fillRect(Math.round(q.x / 3), Math.round(q.y / 3), 1, 1);
    }
  }
  const planned = new Set((S.hub.plan || []).filter((x) => x.state !== "done").map((x) => A[x.agent].home));
  for (const k of STATION_KEYS) {
    const s = STATIONS[k];
    const x = Math.round(s.x / 3), y = Math.round((s.y - 8) / 3);
    if (S.busy?.[k] > 0) {
      mctx.fillStyle = cycle(t * 3) ? "#f2b13b" : "#fff0a8";
      mctx.fillRect(x - 2, y - 2, 5, 5);
    } else if (S.visited.has(k) || k === "hub") {
      mctx.fillStyle = k === "hub" ? P[STATIONS.hub.color] : "#5ee08a";
      mctx.fillRect(x - 1, y - 1, 3, 3);
    } else if (planned.has(k)) {
      mctx.strokeStyle = "rgba(226,233,242,.7)";
      mctx.strokeRect(x - 1.5, y - 1.5, 4, 4);
    } else {
      mctx.fillStyle = "rgba(226,233,242,.35)";
      mctx.fillRect(x, y, 1, 1);
    }
  }
  for (const ag of Object.values(fleet)) {
    if (!ag.visible) continue;
    mctx.fillStyle = P.lamp;
    mctx.fillRect(Math.round(ag.x / 3), Math.round(ag.y / 3), 1, 1);
  }
}

// ============================================================
// Director — dispatch, work, report, return
// ============================================================
const mission = { project: null, index: 0, phase: -1, phaseFrac: 0, meter: 0 };
const hubCol = () => P[STATIONS.hub.color];

function busy(k, d) {
  S.busy ??= {};
  S.busy[k] = Math.max(0, (S.busy[k] || 0) + d);
}
function hot(k, key, dur = 2.5) {
  S.hot[k] = { key, until: clock.t + dur };
}
function beamAt(key, col, out = false) {
  const s = STATIONS[key];
  const at = W.beamTarget ? W.beamTarget(key) : { x: s.x, y: s.y - (key === "hub" ? 36 : 20) };
  return { ...at, col, emit: true, out };
}

async function dispatch(ag, key, task) {
  ag.state = ag.a.verb;
  ag.doing = `Heading to ${STATIONS[key].name.toLowerCase()}`;
  ag.progress = 0;
  logAct(W.persona, `dispatch → <b>${esc(ag.a.name)}</b> · ${esc(task)}`, "fresh context");
  if (ag.at !== "hub") await goHub(ag);
  ag.visible = true;
  ag.face = 1;
  const start = pathAt(key, 0);
  particles.push({ kind: "ring", x: start.x, y: start.y - 6, col: hubCol(), t0: clock.t, life: 0.5 });
  await travel(ag, key, 0, 1);
  ag.at = key;
  S.visited.add(key);
  busy(key, 1);
}
async function goHub(ag) {
  if (ag.at === "hub") return;
  busy(ag.at, -1);
  const key = ag.at;
  ag.beam = null;
  ag.doing = "Returning";
  await travel(ag, key, 1, 0);
  ag.at = "hub";
}
async function comeHome(ag) {
  await goHub(ag);
  ag.visible = false;
  ag.state = "idle";
  ag.doing = "";
}
async function report(ag, text, tok, bad) {
  ag.doing = bad ? "Reporting a failure" : "Reporting back";
  ag.beam = null;
  await packet(ag.at, false, bad ? P.red : P[ag.a.color]);
  ag.sentTok += tok;
  S.hub.ctx += tok;
  S.hub.reports++;
  S.memory.rows.short[1]++;
  logAct(ag.a.id, `report → ${esc(WHO[W.persona][0])} · ${esc(text)}`, `${fmtTok(ag.taskTok)} read → ${tok} sent`);
}
async function work(ag, doing, dur, tok, beam) {
  ag.doing = doing;
  if (beam) ag.beam = beam;
  const n = Math.max(1, Math.round(dur / 0.1));
  for (let i = 1; i <= n; i++) {
    await sleep(dur / n);
    ag.progress = i / n;
    ag.readTok += (tok || 0) / n;
    ag.taskTok += (tok || 0) / n;
  }
  ag.beam = null;
}

const STEPS = {
  async read(ag, kind, title, tok) {
    hot("knowledge", kind, 3);
    await work(ag, `Reading ${title.split(" · ")[0]}`, 2.6, tok, beamAt("knowledge", P.lamp));
    S.knowledge.read.push({ title, tok, by: ag.a.id });
    logAct(ag.a.id, `read <b>${esc(title)}</b>`, `+${fmtTok(tok)} tok`);
  },
  async docread(ag, kind, title, tok) {
    hot("documents", kind, 2.6);
    await work(ag, `Reading ${title.split(" · ")[0]}`, 2.2, tok, beamAt("documents", P.lamp));
    S.documents.read.push(title);
    logAct(ag.a.id, `read <b>${esc(title)}</b>`, `+${fmtTok(tok)} tok`);
  },
  async docwrite(ag, kind, title) {
    await work(ag, `Writing ${title.split(" · ")[0].toLowerCase()}`, 2.4, 300, beamAt("documents", P.analyze, true));
    S.documents.rows[kind][1]++;
    hot("documents", kind, 3);
    S.documents.written.push(title);
    logAct(ag.a.id, `filed <b>${esc(title)}</b>`, `${S.documents.rows[kind][0]} +1`);
  },
  async plan(ag) {
    ag.doing = "Classifying into a plan";
    S.hub.plan = [];
    for (const [text, agent, phase] of mission.project.plan) {
      await work(ag, "Classifying into a plan", 0.9, 80);
      S.hub.plan.push({ text, agent, phase, state: "todo" });
    }
    logAct(ag.a.id, `plan · ${S.hub.plan.length} steps for ${new Set(S.hub.plan.map((p) => p.agent)).size} agents`);
  },
  async recall(ag, text, tok) {
    hot("memory", "long", 2.6);
    await work(ag, "Recalling a lesson", 2, tok, beamAt("memory", P.pearl));
    logAct(ag.a.id, `recall · <q>${esc(text)}</q>`, `+${fmtTok(tok)} tok`);
  },
  async remember(ag, text) {
    await work(ag, "Storing the lesson", 2.2, 0, beamAt("memory", P.pearl, true));
    S.memory.rows.long[1]++;
    S.memory.rows.episodic[1]++;
    S.memory.rows.vector[1] += 12;
    hot("memory", "long", 3);
    S.memory.lessons.push(text);
    logAct(ag.a.id, `remember · <q>${esc(text)}</q>`, `${fmtNum(S.memory.rows.long[1])} lessons`);
  },
  async grep(ag, repo, pattern, files) {
    hot("repos", repo, 3);
    await work(ag, `Searching ${repo}`, 2.4, 1500, beamAt("repos", P.glow));
    logAct(ag.a.id, `grep ${code(pattern)} in <b>${esc(repo)}</b> → ${files.map(code).join(", ")}`, "+1.5k tok");
  },
  async edit(ag, repo, branch, id) {
    const e = EDITS[id];
    const r = S.repos.list.find((x) => x.name === repo);
    r.branch = branch;
    hot("repos", repo, 4);
    if (!e.create) await work(ag, `Reading ${e.file}`, 1.1, 1100, beamAt("repos", P.glow));
    ag.doing = `${e.create ? "Creating" : "Editing"} ${e.file}`;
    ag.beam = beamAt("repos", P.build, true);
    showTab("diff");
    logAct(ag.a.id, `${e.create ? "create" : "edit"} ${code(`${repo}/${e.file}`)} on <b>${esc(branch)}</b>`);
    const f = diffUI.file(repo, e.file, e.hunk, e.create);
    let add = 0, del = 0;
    for (let i = 0; i < e.lines.length; i++) {
      const line = e.lines[i];
      const kind = line[0] === "+" ? "add" : line[0] === "-" ? "del" : "ctx";
      diffUI.line(f, line, kind);
      ag.progress = (i + 1) / e.lines.length;
      if (kind === "add") { add++; r.add++; await sleep(0.5); } else if (kind === "del") { del++; r.del++; await sleep(0.4); } else await sleep(0.16);
    }
    diffUI.settle();
    ag.beam = null;
    logAct(ag.a.id, `wrote ${code(e.file)}`, `<span class="a">+${add}</span> <span class="d">−${del}</span>`);
  },
  async merge(ag, repo, hash, msg) {
    const r = S.repos.list.find((x) => x.name === repo);
    hot("repos", repo, 3);
    await work(ag, `Merging into ${repo}/main`, 1.8, 200, beamAt("repos", P.build, true));
    r.branch = "main";
    r.add = r.del = 0;
    S.repos.commits.push([hash, repo, msg]);
    diffUI.commit(hash, repo, msg);
    logAct(ag.a.id, `merged ${code(hash)} into <b>${esc(repo)}/main</b> · ${esc(msg)}`);
  },
  async train(ag, name, v, note) {
    const m = S.models.list.find((x) => x.name === name);
    m.v = v;
    m.status = "training";
    m.pct = 0;
    hot("models", name, 99);
    logAct(ag.a.id, `train <b>${esc(name)} v${esc(v)}</b> · ${esc(note)}`);
    ag.beam = beamAt("models", P.model, true);
    for (let i = 1; i <= 10; i++) {
      ag.doing = `Training ${name} ${i * 10}%`;
      m.pct = i * 10;
      ag.progress = i / 10;
      ag.readTok += 90;
      ag.taskTok += 90;
      await sleep(0.45);
    }
    m.status = "evaluating";
    ag.doing = `Evaluating ${name}`;
    await sleep(1.2);
    m.status = "candidate";
    hot("models", name, 2);
    S.models.log.push(`${name} v${v} — ${note}`);
    ag.beam = null;
  },
  async deploy(ag, env, version) {
    const e = S.deploy.envs[env];
    e.status = "deploying";
    hot("deploy", env, 99);
    await work(ag, `Deploying to ${e.name}`, 1.4, 150, beamAt("deploy", P.deploy, true));
    e.status = "syncing";
    e.v = version;
    ag.doing = `${e.name} syncing`;
    await sleep(1);
    e.status = "healthy";
    hot("deploy", env, 2);
    S.deploy.log.push(`${e.name} ← ${version}`);
    logAct(ag.a.id, `deployed <b>${esc(version)}</b> to ${esc(e.name)}`, "healthy");
  },
};

async function runTask(t) {
  const ag = fleet[t.agent];
  ag.taskTok = 0;
  await dispatch(ag, t.station, t.task);
  for (const [op, ...args] of t.steps) await STEPS[op](ag, ...args);
  await report(ag, t.report, t.rtok);
  await comeHome(ag);
}

async function runSuites(ag, list) {
  const failures = [];
  for (const [, key, total, fail] of list) {
    const s = S.tests.suites[key];
    s.total = total;
    s.done = 0;
    s.state = "run";
    hot("tests", key, 99);
    const run = testsUI.run(`run ${s.name.toLowerCase()}`);
    showTab("tests");
    ag.doing = `Running ${s.name.toLowerCase()}`;
    ag.beam = beamAt("tests", P.test);
    const steps = 12;
    const upto = fail ? total - 1 : total;
    for (let i = 1; i <= steps; i++) {
      await sleep(0.22);
      s.done = Math.round((upto * i) / steps);
      ag.progress = i / steps;
      ag.readTok += 40;
      ag.taskTok += 40;
    }
    if (fail) {
      s.state = "fail";
      testsUI.line(run, `<div class="ok">✓ ${upto} passing</div><div class="bad">✗ 1 failing</div><div class="why">${esc(fail)}</div>`);
      logAct(ag.a.id, `${esc(s.name)} · <b>${upto}/${total}</b>, 1 failing`);
      failures.push(fail);
    } else {
      s.state = "pass";
      testsUI.line(run, `<div class="ok">✓ ${total}/${total} passing</div>`);
      logAct(ag.a.id, `${esc(s.name)} · ${total}/${total} passing`);
    }
    hot("tests", key, 1.5);
  }
  ag.beam = null;
  return failures;
}

async function phase(i) {
  mission.phase = i;
  mission.phaseFrac = 0;
  setPhaseUI(i);
  for (const p of S.hub.plan) p.state = p.phase < i ? "done" : p.phase === i ? "on" : "todo";
  logPhase(`${i + 1} · ${PHASES[i].name}`);
  await sleep(1);
}
async function tracked(list) {
  let done = 0;
  await Promise.all(list.map((fn) => fn().then(() => { mission.phaseFrac = ++done / list.length; })));
}

async function runProject(p, idx) {
  beginProject(p, idx);
  logAct(W.persona, `order received · <q>${esc(p.order)}</q>`, `ticket: ${esc(p.ticket)}`);
  await sleep(2);

  await phase(0);
  await tracked(p.research.map((t, i) => () => sleep(i * 0.7).then(() => runTask(t))));

  await phase(1);
  await tracked([() => runTask(p.analyze)]);
  for (const x of S.hub.plan) x.state = x.phase === 1 ? "done" : "todo";

  await phase(2);
  await tracked(p.build.map((t, i) => () => sleep(i * 0.7).then(() => runTask(t))));

  await phase(3);
  const T = p.test;
  const tester = fleet[T.agent];
  tester.taskTok = 0;
  await dispatch(tester, "tests", T.task);
  mission.phaseFrac = 0.2;
  const fails = await runSuites(tester, T.first);
  mission.phaseFrac = 0.5;
  if (fails.length) {
    villain.state = "rising";
    villain.note = fails[0];
    logAct(W.villain.id, TEXT.villainRises(fails[0]));
    await sleep(1.6);
    await report(tester, `1 failing — ${fails[0]}`, 90, true);
    tester.doing = "Holding the suite";
    const fx = T.fix;
    const fixer = fleet[fx.agent];
    fixer.taskTok = 0;
    await dispatch(fixer, fx.station, fx.task);
    for (const [op, ...args] of fx.steps) await STEPS[op](fixer, ...args);
    await report(fixer, fx.report, fx.rtok);
    const home = comeHome(fixer);
    home.catch(() => {});
    await packet("tests", true, hubCol());
    logAct(W.persona, `→ <b>${esc(tester.a.name)}</b> · run the suite again`);
    await runSuites(tester, T.rerun);
    villain.state = "sinking";
    W.onVillainSink?.();
    logAct(W.villain.id, TEXT.villainSinks);
    await home;
  }
  mission.phaseFrac = 0.85;
  await report(tester, T.report, T.rtok);
  await comeHome(tester);

  await phase(4);
  await tracked(p.deploy.map((t, i) => () => sleep(i * 0.8).then(() => runTask(t))));
  if (p.finalMeter !== undefined) {
    const from = mission.meter;
    for (let i = 1; i <= 30; i++) {
      mission.meter = Math.round(lerp(from, p.finalMeter, easeInOut(i / 30)) / (W.meterStep ?? 10)) * (W.meterStep ?? 10);
      await sleep(0.1);
    }
    logAct(W.persona, TEXT.settled(p.finalMeter));
  }
  if (p.finale) {
    villain.state = "visiting";
    for (const [who, line, meta] of p.finale) logAct(who === "persona" ? W.persona : who, line, meta);
    await sleep(4);
    villain.state = "sinking";
  }
  mission.phase = 5;
  setPhaseUI(5);
  for (const x of S.hub.plan) x.state = "done";
  logAct(W.persona, TEXT.done, `held ${fmtTok(S.hub.ctx)} tok`);
  await sleep(5);
}

function beginProject(p, idx) {
  mission.project = p;
  mission.index = idx;
  mission.phase = -1;
  mission.phaseFrac = 0;
  mission.meter = p.meter;
  $("#project").value = String(idx);
  S.hub = { plan: [], ctx: 60, reports: 0 };
  S.visited = new Set();
  S.busy = {};
  S.knowledge.read = [];
  S.documents.written = [];
  S.documents.read = [];
  S.models.log = [];
  S.deploy.log = [];
  for (const ag of Object.values(fleet)) Object.assign(ag, { visible: false, at: "hub", travel: null, beam: null, doing: "", progress: 0, state: "idle", readTok: 0, sentTok: 0, taskTok: 0, trail: [] });
  villain.state = "hidden";
  villain.k = 0;
  villain.grab = 0;
  packets = [];
  diffUI.clear();
  testsUI.clear();
  setPhaseUI(-1);
  logPhase(`Project · ${p.name}`);
}

let missionToken = 0;
function startMission(idx) {
  cancelAll();
  const token = ++missionToken;
  S = W.freshState();
  initFleet();
  (async () => {
    let i = idx;
    try {
      for (;;) {
        await runProject(PROJECTS[i], i);
        if (token !== missionToken) return;
        i = (i + 1) % PROJECTS.length;
      }
    } catch (e) {
      if (!(e instanceof Cancelled)) {
        console.error(e);
        logAct("sys", `error: ${esc(e.message)}`);
      }
    }
  })();
}

// ============================================================
// Controls, navigation, resize
// ============================================================
function buildControls() {
  const sel = $("#project");
  sel.innerHTML = PROJECTS.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join("");
  sel.addEventListener("change", () => startMission(+sel.value));
  const play = $("#play");
  const setPaused = (v) => {
    clock.paused = v;
    play.textContent = v ? "▶" : "❚❚";
    play.title = v ? "Play" : "Pause";
    play.setAttribute("aria-pressed", String(v));
  };
  play.addEventListener("click", () => setPaused(!clock.paused));
  for (const b of document.querySelectorAll(".ctl [data-speed]")) {
    b.addEventListener("click", () => {
      clock.speed = +b.dataset.speed;
      for (const o of document.querySelectorAll(".ctl [data-speed]")) o.classList.toggle("on", o === b);
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePop();
    if (e.code === "Space" && !e.target.closest("button, select, input, textarea")) {
      e.preventDefault();
      setPaused(!clock.paused);
    }
  });
  const nav = $("#nav");
  const motto = nav.querySelector(".motto");
  const home = W.nav[0][0];
  for (const [target, icon, label] of W.nav) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.target = target;
    b.append(iconCanvas(icon, 2), Object.assign(document.createElement("span"), { textContent: label }));
    b.classList.toggle("on", target === home);
    b.addEventListener("click", () => {
      if (target === home) closePop();
      else if (target === "agents") {
        closePop();
        const panel = $("#agents-panel");
        panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
        panel.animate([{ boxShadow: "0 0 0 2px var(--cyan)" }, { boxShadow: "0 0 0 0 transparent" }], { duration: 1200 });
      } else openPop({ kind: "station", key: target });
    });
    nav.insertBefore(b, motto);
  }
}

let assetsReady = false;
let staticReady = false;
function resize() {
  if (!assetsReady) return;
  const r = mapEl.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const MW = clamp(Math.round((map.H * r.width) / r.height), Math.round(560 * grain()), Math.round(820 * grain()));
  if (MW !== map.W || !staticReady) {
    map.W = MW;
    cv.width = MW;
    cv.height = map.H;
    layoutStations();
    emitters = [];
    W.buildStatic();
    gcv.width = Math.round(MW / 2);
    gcv.height = Math.round(map.H / 2);
    bakeEmitters();
    drawMinimapBase();
    if (staticReady) W.seedAmbient();
    staticReady = true;
  }
  map.scale = Math.min(r.width / map.W, r.height / map.H);
  map.ox = (r.width - map.W * map.scale) / 2;
  map.oy = (r.height - map.H * map.scale) / 2;
  W.onResize?.();
  placeCards();
  if (selected) renderPop(true);
}
let resizeTimer = 0;
new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resize, staticReady ? 120 : 0);
}).observe(mapEl);

// ============================================================
// Frame loop and boot
// ============================================================
let lastT = performance.now();
let uiT = 0;
let frameErrorLogged = false;
function stepSim(dt) {
  clock.t += dt;
  updateFleet(dt);
  villain.update(dt);
  W.updateAmbient(dt);
  updateParticles(dt);
  tickTimers();
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - lastT) / 1000, 0, 0.05);
  lastT = Math.max(lastT, now);
  try {
    if (!clock.paused) stepSim(dt * clock.speed);
    W.render(clock.t);
    updateTags();
    if (now - uiT > 200) {
      uiT = now;
      updateCards();
      updateAgentsPanel();
      updateProgress();
      drawMinimap(clock.t);
      W.drawCorner?.(now / 1000);
      if (selected) renderPop(false);
    }
  } catch (e) {
    if (!frameErrorLogged) console.error(e);
    frameErrorLogged = true;
  }
}

async function startOS(world) {
  W = world;
  map.H = world.mapH ?? MAP_H;
  STATIONS = world.stations;
  STATION_KEYS = Object.keys(STATIONS);
  SPOKES = STATION_KEYS.filter((k) => k !== "hub");
  for (const [k, s] of Object.entries(STATIONS)) s.key = k;
  AGENTS = world.agents;
  A = Object.fromEntries(AGENTS.map((a) => [a.id, a]));
  WHO = { ...world.who };
  for (const a of AGENTS) WHO[a.id] = [a.name, `var(--${a.color})`];
  PROJECTS = world.projects;
  EDITS = world.edits;
  ROW_ICON = world.rowIcons ?? {};
  QUOTES = world.quotes;
  if (world.phases) PHASES = world.phases;
  TEXT = { ...TEXT_DEFAULTS, ...world.text };

  const params = new URLSearchParams(location.search);
  const at = parseFloat(params.get("at")) || 0;
  const start = clamp((parseInt(params.get("project"), 10) || 1) - 1, 0, PROJECTS.length - 1);
  const fast = at > 0;
  const bar = $("#boot-bar"), blog = $("#boot-log"), lines = [];
  try {
    await loadAtlas(async (i, n, name, f) => {
      bar.style.width = `${(i / n) * 100}%`;
      lines.push(`${name.padEnd(26, " ")} ${f.w}×${f.h}`);
      blog.textContent = lines.slice(-6).join("\n");
      if (!fast && i % 5 === 0) await nextFrame();
    });
  } catch (e) {
    $("#boot-what").innerHTML = `<span class="err">${esc(e.message)}</span>`;
    return;
  }
  assetsReady = true;
  $("#boot-what").textContent = `${Object.keys(ATLAS.frames).length} frames · ${ATLAS.size[0]}×${ATLAS.size[1]} sheet · build ${ATLAS.hash}`;
  W.decorateChrome?.();
  W.drawCorner?.(0);
  buildPipeline();
  buildControls();
  buildAgentsPanel();
  diffUI.clear();
  testsUI.clear();
  S = W.freshState();
  initFleet();
  buildOverlay();
  resize();
  W.seedAmbient();
  if (document.fonts?.ready) document.fonts.ready.then(() => placeCards());
  startMission(start);
  if (fast) {
    while (clock.t < at) {
      stepSim(1 / 30);
      await macrotask();
    }
  } else {
    await new Promise((r) => setTimeout(r, 400));
  }
  updateCards();
  updateAgentsPanel();
  updateProgress();
  placeCards();
  const frameEl = $("#map-frame");
  if (frameEl.scrollWidth > frameEl.clientWidth) frameEl.scrollLeft = artToCss(STATIONS.hub.x, 0).x - frameEl.clientWidth / 2;
  $("#boot").classList.add("done");
  document.body.dataset.ready = "1";
  lastT = performance.now();
  requestAnimationFrame(frame);
}
