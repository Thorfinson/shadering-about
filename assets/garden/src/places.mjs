// The eight places of hortus-os.html, each on a round garden plot with a
// dry-stone wall, lit low from the left by the evening sun:
//
//   hub.orchestrator    the Great Oak: a treehouse in its crown, lanterns in the
//                       branches, a sun carved on the trunk
//   station.knowledge   the seed library: a thatched stone cottage, a bay window
//                       of seed jars, roses up the wall, a smoking chimney
//   station.documents   the glasshouse herbarium: white iron, old glass, pressed
//                       specimens pinned inside
//   station.models      the topiary garden: a peacock and a hare in clipped yew
//   station.repos       the apiary: painted hives in lavender
//   station.tests       the nursery: raised beds of seedlings under cloches
//   station.memory      the lily pond, with a stone lantern
//   station.deploy      the windmill (its sails turn on the page, fx.sails*)
//
// Meta lists every lamp so the page can bloom them, and where the moving parts
// go: smoke, hive bees, koi, sails.

export default function generate(kit) {
  const { P } = kit;
  const BUILD = {
    knowledge: [cottage, P.research, 3],
    documents: [glasshouse, P.analyze, 11],
    models: [topiary, P.model, 19],
    repos: [apiary, P.build, 27],
    tests: [nursery, P.test, 35],
    memory: [pond, P.remember, 43],
    deploy: [windmill, P.deploy, 51],
  };
  const lamps = {};
  const fx = {};
  const frames = Object.entries(BUILD).map(([name, [make, accent, seed]]) => {
    const out = make(kit, accent, seed);
    lamps[name] = out.lamps;
    fx[name] = out.fx;
    return { name, buf: out.buf };
  });
  const h = oak(kit);
  return [
    { sprite: 'station', frames, meta: { base: [44, 58], prx: 30, pry: 9, lamps, fx } },
    { sprite: 'hub', frames: [{ name: 'orchestrator', buf: h.buf }], meta: { base: [66, 86], prx: 46, pry: 13, lamps: h.lamps } },
    { sprite: 'fx', frames: sails(kit, 8), meta: { sailFrames: 8 } },
  ];
}

const R = (P) => ({
  grass: [P.grass1, P.grass2, P.grass3, P.grass4, P.grass5, P.grass6],
  leaf: [P.leaf0, P.leaf1, P.leaf2, P.leaf3, P.leaf4, P.leaf5],
  stone: [P.stone0, P.stone1, P.stone2, P.stone3, P.stone4],
  soil: [P.soil0, P.soil1, P.soil2, P.soil3],
  wood: [P.wood0, P.wood1, P.wood2, P.wood3, P.wood4],
  straw: [P.straw0, P.straw1, P.straw2, P.straw3],
  pane: [P.pane0, P.pane1, P.pane2, P.pane3, P.pane4],
  pond: [P.pond0, P.pond1, P.pond2, P.pond3, P.pond4],
  warm: [P.wood2, P.honey2, P.honey3, P.lamp],
});
const FLOWERS = (P) => [P.rose2, P.sunny, P.daisy, P.lav1, P.poppy, P.rose3, P.blue1];

// A round garden plot seen from above at an angle: a lawn on top with flowers
// at its rim, and a dry-stone wall (or bare earth) below it.
function plot(buf, kit, { cx, top, rx, ry, face, seed, earth = false, flowers = 0.05 }) {
  const { P, rampSoft, hash2, layer } = kit;
  const r = R(P);
  const FL = FLOWERS(P);
  layer(buf, cx - rx - 1, top - ry - 1, cx + rx + 1, top + ry + face + 2, (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    const ex = (px - cx) / rx;
    if (Math.abs(ex) > 1) return null;
    const frontY = top + ry * Math.sqrt(1 - ex * ex);
    if (py > frontY && py <= frontY + face) {
      const fy = py - frontY;
      if (earth) {
        if (fy < 1.2 && hash2(x, 1, seed) < 0.6) return hash2(x, 2, seed) < 0.5 ? P.grass2 : P.grass3; // turf lip
        return rampSoft(r.soil, 0.6 - ex * 0.3 - (fy / face) * 0.4 + (hash2(x, y, seed) - 0.5) * 0.2, x, y, seed);
      }
      // dry stone: courses of rough stones, mortar-less gaps in shadow
      const course = Math.floor(fy / 2.6);
      const k = Math.floor((x + course * 3 + 400) / 5.5);
      const gap = (x + course * 3 + 400) % 5.5 < 0.9 || fy % 2.6 < 0.7;
      if (fy < 1) return hash2(x, 3, seed) < 0.45 ? P.grass3 : P.stone3;
      if (gap) return P.stone0;
      const v = 0.62 - ex * 0.3 - (fy / face) * 0.25 + (hash2(k, course, seed) - 0.5) * 0.35;
      if (hash2(x, y, seed + 4) < 0.08) return P.grass2; // moss
      return rampSoft(r.stone, v, x, y, seed);
    }
    const ey = (py - top) / ry;
    if (ex * ex + ey * ey > 1) return null;
    const rr = Math.hypot(ex, ey);
    // flowers grow in clumps along the rim, one colour to a clump
    if (rr > 0.78 && kit.vnoise(x * 0.25, y * 0.5, seed + 7) > 0.62 && hash2(x, y, seed + 5) < flowers * 5) return FL[Math.floor(kit.vnoise(x * 0.1, y * 0.2, seed + 8) * FL.length)];
    const lit = 0.52 - ey * 0.12 - ex * 0.18 + (kit.vnoise(x * 0.5, y * 0.7, seed) - 0.5) * 0.35 + (hash2(x, y, seed) - 0.5) * 0.12;
    return rampSoft(r.grass, rr > 0.93 && ey > 0 ? lit + 0.2 : lit, x, y, seed + 3);
  });
}
function platform(buf, kit, seed, cx = 44) {
  plot(buf, kit, { cx, top: 64, rx: 36, ry: 11, face: 5, seed, earth: true });
  plot(buf, kit, { cx, top: 58, rx: 30, ry: 9, face: 6, seed: seed + 1 });
}
function steps(buf, kit, cx, y) {
  const { P } = kit;
  for (let k = 0; k < 4; k++) buf.rect(cx - 4 + k, y + k * 2, 9 - k * 2, 1, k % 2 ? P.stone2 : P.stone3);
}
function lantern(buf, kit, x, y, h, lamps) {
  const { P } = kit;
  for (let k = 0; k < h; k++) buf.set(x, y - k, k % 3 ? P.wood1 : P.wood2);
  buf.set(x - 1, y - h - 1, P.wood1);
  buf.set(x + 1, y - h - 1, P.wood1);
  buf.set(x, y - h - 1, P.lamp);
  buf.set(x, y - h - 2, P.honey2);
  lamps.push([x, y - h - 1]);
}
// a bush or a clump of flowers, darkest at the root
function bush(buf, kit, x, y, size, ramp, seed, blooms = null) {
  const { rampSoft, hash2, mulberry32 } = kit;
  const rng = mulberry32(seed);
  for (let k = 0; k < 2 + size; k++) {
    const bx = x + (rng() - 0.5) * size * 3;
    const by = y - rng() * size * 1.4 - 1;
    const r = 1 + rng() * (0.6 + size * 0.45);
    for (let j = -Math.ceil(r); j <= Math.ceil(r); j++) {
      for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) {
        if (i * i + j * j > r * r) continue;
        const X = Math.round(bx + i);
        const Y = Math.round(by + j);
        if (blooms && hash2(X, Y, seed) < 0.22) buf.set(X, Y, blooms[Math.floor(hash2(X, Y, seed + 1) * blooms.length)]);
        else buf.set(X, Y, rampSoft(ramp, 0.55 - (i + j) / (r * 3) + (hash2(X, Y, seed) - 0.5) * 0.3, X, Y, seed));
      }
    }
  }
}
// planks: a wooden box face, lit from the left
function planks(buf, kit, x0, y0, w, h, seed, tone = 0.55) {
  const { P, rampSoft, hash2 } = kit;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const seam = (y - y0) % 3 === 2;
      const v = tone - ((x - x0) / w) * 0.35 + (hash2(Math.floor((x - x0 + (y - y0) * 7) / 9), y, seed) - 0.5) * 0.2;
      buf.set(x, y, seam ? P.wood0 : x === x0 ? P.wood3 : rampSoft(R(P).wood, v, x, y, seed));
    }
  }
}

// ---------------------------------------------------------------- places --

// The seed library: a stone cottage under thatch, its bay window full of jars.
function cottage(kit, accent, seed) {
  const { P, PixelBuffer, rampSoft, hash2, mixHex } = kit;
  const r = R(P);
  const buf = new PixelBuffer(88, 88);
  const lamps = [];
  bush(buf, kit, 72, 52, 5, r.leaf, seed + 9);
  platform(buf, kit, seed);
  // stone walls
  for (let y = 38; y < 61; y++) {
    for (let x = 20; x < 68; x++) {
      const course = Math.floor((y - 38) / 3);
      const gap = (y - 38) % 3 === 2 || (x + course * 4) % 7 === 0;
      let c = gap ? P.stone1 : rampSoft(r.stone, 0.7 - ((x - 20) / 48) * 0.35 + (hash2(Math.floor((x + course * 4) / 7), course, seed) - 0.5) * 0.3, x, y, seed);
      if (x === 20) c = P.stone4;
      if (y === 60) c = P.stone0;
      buf.set(x, y, c);
    }
  }
  // the bay window: shelves of seed jars in lamplight
  const JARS = [P.sunny, P.rose1, P.grass4, P.lav1, P.soil3, P.poppy, P.daisy, P.blue1];
  for (let y = 43; y < 58; y++) {
    for (let x = 25; x < 47; x++) {
      const edge = x === 25 || x === 46 || y === 43 || y === 57;
      if (edge) { buf.set(x, y, x < 30 || y === 43 ? P.wood3 : P.wood1); continue; }
      if (x === 32 || x === 39) { buf.set(x, y, P.wood2); continue; } // mullions
      if ((y - 44) % 4 === 3) { buf.set(x, y, P.wood1); continue; } // shelves
      const warm = Math.max(0, 1 - Math.hypot(x - 36, y - 52) / 14);
      const jar = (x % 2 === 0) && (y - 44) % 4 !== 0;
      const c = jar ? JARS[Math.floor(hash2(x >> 1, (y - 44) >> 2, seed) * JARS.length)] : (y - 44) % 4 === 0 ? P.pane3 : P.honey2;
      buf.set(x, y, mixHex(c, P.lamp, 0.15 + warm * 0.4));
    }
  }
  lamps.push([36, 52]);
  // the door and a small lit window
  for (let y = 46; y < 60; y++) for (let x = 53; x < 60; x++) buf.set(x, y, x === 53 ? P.wood3 : y === 46 ? P.wood3 : (x - 53) % 3 === 2 ? P.wood0 : P.wood2);
  buf.set(58, 53, P.honey3);
  for (let y = 44; y < 49; y++) for (let x = 62; x < 66; x++) buf.set(x, y, x === 62 || y === 44 ? P.wood3 : y < 46 ? P.lamp : P.honey3);
  lamps.push([63, 46]);
  // thatch: a deep, rounded roof hanging over the walls
  for (let y = 18; y < 41; y++) {
    const t = (y - 18) / 23;
    const half = 12 + t * 16 + Math.sin(t * Math.PI) * 3;
    for (let x = Math.round(44 - half); x <= Math.round(44 + half); x++) {
      const u = (x - (44 - half)) / (half * 2);
      const strand = hash2(x, y >> 1, seed) * 0.25 + ((x + y * 0.3) % 3 < 1 ? 0.1 : 0);
      let c = rampSoft(r.straw, 0.85 - u * 0.55 - t * 0.2 + strand, x, y, seed);
      if (y > 38) c = rampSoft(r.straw, 0.25 - u * 0.2, x, y, seed); // the eaves in shadow
      if (y === 18 || x === Math.round(44 - half)) c = P.straw3;
      buf.set(x, y, c);
    }
  }
  // chimney
  for (let y = 12; y < 26; y++) for (let x = 58; x < 64; x++) buf.set(x, y, y === 12 ? P.stone4 : rampSoft(r.stone, 0.62 - (x - 58) * 0.08, x, y, seed));
  for (let x = 59; x < 63; x++) buf.set(x, 11, P.stone0);
  // roses up the left wall
  bush(buf, kit, 19, 50, 3, r.leaf, seed + 3, [P.rose1, P.rose2, P.rose3]);
  bush(buf, kit, 21, 40, 2, r.leaf, seed + 4, [P.rose2, P.rose3]);
  lantern(buf, kit, 30, 68, 4, lamps);
  lantern(buf, kit, 58, 68, 4, lamps);
  steps(buf, kit, 56, 61);
  bush(buf, kit, 14, 64, 2, r.leaf, seed + 5, [P.sunny, P.daisy]);
  bush(buf, kit, 74, 64, 2, r.leaf, seed + 6, [P.lav1, P.lav2]);
  lamps.push([36, 50]);
  return { buf: buf.outline('auto'), lamps, fx: { smoke: [[61, 10]] } };
}

// The glasshouse herbarium: a long house of white iron and old glass, pressed
// specimens pinned on the back wall, pots on the benches.
function glasshouse(kit, accent, seed) {
  const { P, PixelBuffer, rampSoft, hash2, mixHex, withAlpha, opaqueAt, layer } = kit;
  const r = R(P);
  const buf = new PixelBuffer(88, 88);
  const lamps = [];
  bush(buf, kit, 12, 54, 4, r.leaf, seed + 1);
  platform(buf, kit, seed);
  const X0 = 16, X1 = 72, Y0 = 26, Y1 = 60;
  // inside, behind the glass: the back wall of specimens, benches of pots, a lamp
  for (let y = Y0 + 8; y < Y1; y++) {
    for (let x = X0 + 2; x < X1 - 1; x++) {
      let c = null;
      if (y < 48) {
        const sheet = (x - X0 - 4) % 9 < 6 && (y - 36) % 8 < 6 && y >= 36;
        if (sheet) {
          const sx = (x - X0 - 4) % 9, sy = (y - 36) % 8;
          c = sx === 2 || (sy === 2 && sx > 0 && sx < 5) || (sy === 4 && sx > 1 && sx < 4) ? P.grass4 : P.pearl;
        } else c = rampSoft(r.pane, 0.25 + (y - Y0) / 60, x, y, seed);
      } else if (y < 51) c = y === 48 ? P.wood3 : P.wood1; // bench
      else if (y < 55 && (x % 6 === 1 || x % 6 === 2)) c = y === 51 ? P.soil3 : P.soil2; // pots
      else c = rampSoft(r.grass, 0.4 + hash2(x, y, seed) * 0.3, x, y, seed);
      if (y < 50 && y > 41 && (x % 6 === 1 || x % 6 === 2) && hash2(x, y, seed) < 0.7) c = rampSoft(r.leaf, 0.7 - (y - 41) / 20, x, y, seed); // plants
      const warm = Math.max(0, 1 - Math.hypot(x - 44, y - 44) / 22);
      buf.set(x, y, mixHex(c, P.lamp, warm * 0.3));
    }
  }
  lamps.push([44, 42]);
  // the frame and the glass, with the curved roof
  layer(buf, X0, Y0 - 12, X1 + 1, Y1, (x, y) => {
    const u = (x - X0) / (X1 - X0);
    const roofTop = Y0 - Math.sin(u * Math.PI) * 10;
    if (y < roofTop) return null;
    const wall = y >= Y0 + 8;
    const mullion = (x - X0) % 5 === 0 || x === X1;
    const bar = wall ? (y - Y0 - 8) % 7 === 0 : Math.abs(y - roofTop) < 1 || Math.abs(y - (Y0 + 8)) < 1;
    const ridge = !wall && (x - X0) % 5 === 0;
    if (y >= Y1 - 5) return y === Y1 - 5 ? P.stone4 : rampSoft(r.stone, 0.6 - u * 0.3, x, y, seed); // low wall
    if (mullion || bar || ridge) return u < 0.3 ? P.iron3 : P.iron2;
    const under = opaqueAt(buf, x, y);
    let tone = 0.55 - u * 0.25 + (hash2(x >> 2, y >> 2, seed) - 0.5) * 0.15;
    let a = wall ? 0.35 : 0.55;
    if (!wall && u < 0.45 && (x + y) % 9 < 2) { tone = 1; a = 0.8; } // the roof catches the sun
    const glass = rampSoft(r.pane, tone, x, y, seed);
    return under ? mixHex(under, glass, a) : withAlpha(glass, a);
  });
  // a vent lantern on the ridge
  for (let y = 12; y < 17; y++) for (let x = 41; x < 48; x++) buf.set(x, y, x === 41 || x === 47 ? P.iron3 : y === 12 ? P.iron2 : P.lamp);
  for (let x = 42; x < 47; x++) buf.set(x, 11, P.iron3);
  buf.set(44, 10, P.honey3);
  lamps.push([44, 14]);
  lantern(buf, kit, 13, 68, 4, lamps);
  lantern(buf, kit, 75, 68, 4, lamps);
  steps(buf, kit, 44, 61);
  bush(buf, kit, 70, 64, 2, r.leaf, seed + 2, [P.rose2, P.daisy]);
  return { buf: buf.outline('auto'), lamps, fx: {} };
}

// The topiary garden: a peacock and a hare clipped out of yew, balls and cones
// in pots, a ladder left against the peacock.
function topiary(kit, accent, seed) {
  const { P, PixelBuffer, rampSoft, hash2, vnoise, layer } = kit;
  const r = R(P);
  const buf = new PixelBuffer(88, 88);
  const lamps = [];
  platform(buf, kit, seed);
  const clipped = (x, y, cx, cy, rx, ry, s) => {
    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (d > 1) return null;
    const lit = 0.62 - (x - cx) / (rx * 2.2) - (y - cy) / (ry * 2.4) - d * 0.15 + (vnoise(x * 0.9, y * 0.9, s) - 0.5) * 0.3;
    return rampSoft(r.leaf, lit, x, y, s);
  };
  // the peacock's fan, then its body and neck
  layer(buf, 8, 10, 60, 58, (x, y) => {
    const dx = x + 0.5 - 30, dy = y + 0.5 - 50;
    const d = Math.hypot(dx / 22, dy / 36);
    if (d > 1 || dy > 0) return null;
    const a = Math.atan2(dy, dx);
    const rib = Math.abs(((a / (Math.PI / 9)) % 1 + 1) % 1 - 0.5) > 0.44;
    const eye = Math.abs(d - 0.8) < 0.06 && !rib;
    const lit = 0.55 - dx / 60 - (1 - d) * 0.1 + (vnoise(x * 0.8, y * 0.8, seed) - 0.5) * 0.3 + (rib ? -0.25 : 0);
    return eye ? r.leaf[5] : rampSoft(r.leaf, lit, x, y, seed);
  });
  layer(buf, 18, 30, 46, 60, (x, y) => clipped(x, y, 32, 50, 9, 8, seed + 1) ?? clipped(x, y, 36, 38, 3, 9, seed + 2) ?? clipped(x, y, 38, 30, 3.5, 3.5, seed + 3));
  buf.set(40, 29, P.honey3); // a beak
  buf.set(37, 28, P.ink);
  // the hare: a sitting hare, ears up
  layer(buf, 50, 20, 78, 62, (x, y) => clipped(x, y, 63, 52, 9, 8, seed + 4) ?? clipped(x, y, 66, 41, 6, 6, seed + 5) ?? clipped(x, y, 64, 29, 2, 7, seed + 6) ?? clipped(x, y, 69, 30, 2, 7, seed + 7));
  buf.set(69, 40, P.ink);
  // balls and cones in terracotta pots
  for (const [px, py, kind] of [[16, 64, 'ball'], [72, 65, 'cone'], [46, 66, 'ball']]) {
    for (let y = py - 3; y < py + 1; y++) for (let x = px - 3; x <= px + 3; x++) buf.set(x, y, x === px - 3 ? P.soil3 : y === py - 3 ? P.soil3 : P.soil2);
    if (kind === 'ball') layer(buf, px - 6, py - 14, px + 7, py - 2, (x, y) => clipped(x, y, px, py - 8, 5, 5, seed + px));
    else layer(buf, px - 6, py - 20, px + 7, py - 2, (x, y) => (Math.abs(x + 0.5 - px) < (y - (py - 20)) * 0.3 ? rampSoft(r.leaf, 0.6 - (x - px) / 10 + (hash2(x, y, seed) - 0.5) * 0.3, x, y, seed) : null));
  }
  // a wooden ladder against the fan, shears on the lawn
  for (let y = 30; y < 58; y++) {
    const x = Math.round(12 + (58 - y) * 0.12);
    buf.set(x, y, P.wood3);
    buf.set(x + 4, y, P.wood2);
    if (y % 5 === 0) for (let i = 1; i < 4; i++) buf.set(x + i, y, P.wood2);
  }
  for (const [x, y, c] of [[54, 64, P.iron3], [55, 63, P.iron3], [56, 62, P.iron2], [53, 65, P.poppy], [52, 66, P.poppy]]) buf.set(x, y, c);
  lantern(buf, kit, 26, 68, 4, lamps);
  lantern(buf, kit, 62, 68, 4, lamps);
  steps(buf, kit, 44, 67);
  return { buf: buf.outline('auto'), lamps, fx: {} };
}

// The apiary: painted hives on stands among the lavender.
function apiary(kit, accent, seed) {
  const { P, PixelBuffer, rampSoft, hash2 } = kit;
  const r = R(P);
  const buf = new PixelBuffer(88, 88);
  const lamps = [];
  platform(buf, kit, seed);
  const hives = [];
  const hive = (x, base, boxes, paint, roof) => {
    // stand
    for (let y = base - 3; y < base; y++) { buf.set(x + 1, y, P.wood1); buf.set(x + 9, y, P.wood1); }
    let y = base - 3;
    for (let b = 0; b < boxes; b++) {
      const h = b === 0 ? 6 : 4;
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < 11; i++) {
          let c = rampSoft(paint, 0.72 - i / 16 + (hash2(x + i, y - j, seed) - 0.5) * 0.12, x + i, y - j, seed);
          if (i === 0) c = paint[paint.length - 1];
          if (j === h - 1) c = P.wood0; // the seam between boxes
          if (b === 0 && j === 1 && i > 2 && i < 8) c = P.ink; // the entrance
          if (b === 0 && j === 0 && i > 1 && i < 9) c = P.wood3; // landing board
          buf.set(x + i, y - j, c);
        }
      }
      y -= h;
    }
    // a pitched roof
    for (let j = 0; j < 4; j++) for (let i = -1 + j; i < 12 - j; i++) buf.set(x + i, y - j, i < 5 ? roof[1] : roof[0]);
    hives.push([x + 5, base - 6]);
  };
  const WHITE = [P.stone2, P.iron2, P.iron3, P.pearl];
  const BLUE = [P.blue0, P.pond3, P.blue1, P.pearl];
  const YELLOW = [P.honey2, P.straw2, P.honey3, P.lamp];
  const ROSE = [P.rose1, P.rose2, P.rose3, P.pearl];
  hive(16, 55, 3, WHITE, [P.wood1, P.wood3]);
  hive(30, 53, 4, BLUE, [P.wood1, P.wood3]);
  hive(47, 53, 2, YELLOW, [P.soil1, P.soil3]);
  hive(61, 55, 3, ROSE, [P.wood1, P.wood3]);
  // lavender in rows at the front, a table with honey jars
  for (const [x, y] of [[14, 66], [24, 68], [36, 69], [52, 69], [64, 68], [74, 65]]) bush(buf, kit, x, y, 2, [P.leaf1, P.leaf2, P.leaf3], seed + x, [P.lav0, P.lav1, P.lav2]);
  for (let x = 38; x < 50; x++) buf.set(x, 62, P.wood3);
  for (let x = 38; x < 50; x++) buf.set(x, 63, P.wood1);
  for (const x of [39, 48]) for (let y = 64; y < 67; y++) buf.set(x, y, P.wood1);
  for (const x of [40, 43, 46]) for (let y = 58; y < 62; y++) buf.set(x, y, y === 58 ? P.pearl : y === 59 ? P.honey3 : P.honey2);
  lantern(buf, kit, 11, 64, 5, lamps);
  lantern(buf, kit, 78, 62, 5, lamps);
  return { buf: buf.outline('auto'), lamps, fx: { hives } };
}

// The nursery: raised beds of seedlings, glass cloches, labels, a watering can,
// and a scarecrow keeping watch.
function nursery(kit, accent, seed) {
  const { P, PixelBuffer, rampSoft, hash2, mixHex, withAlpha, opaqueAt } = kit;
  const r = R(P);
  const buf = new PixelBuffer(88, 88);
  const lamps = [];
  // the scarecrow behind
  for (let y = 16; y < 58; y++) buf.set(62, y, P.wood2);
  for (let x = 52; x < 73; x++) buf.set(x, 28, P.wood2);
  for (let y = 26; y < 42; y++) for (let x = 57; x < 68; x++) buf.set(x, y, rampSoft([P.tweed0, P.tweed1, P.straw1], 0.5 - (x - 57) / 20 + (hash2(x, y, seed) - 0.5) * 0.3, x, y, seed));
  for (let y = 18; y < 25; y++) for (let x = 59; x < 66; x++) buf.set(x, y, Math.hypot(x - 62, y - 21.5) < 3.6 ? P.straw2 : null);
  for (let x = 55; x < 70; x++) buf.set(x, 17, P.straw1);
  for (let y = 12; y < 17; y++) for (let x = 58; x < 67; x++) buf.set(x, y, P.straw0);
  for (const x of [52, 53, 71, 72]) buf.set(x, 29, P.straw2);
  platform(buf, kit, seed);
  // two raised beds of seedlings
  const bed = (x0, y0, w) => {
    for (let y = y0; y < y0 + 9; y++) {
      for (let x = x0; x < x0 + w; x++) {
        let c;
        if (y < y0 + 5) c = (x + y) % 3 === 0 ? P.soil1 : P.soil2;
        else c = y === y0 + 5 ? P.wood4 : rampSoft(r.wood, 0.6 - (x - x0) / (w * 2), x, y, seed);
        if (y < y0 + 5 && (y - y0) % 2 === 1 && x % 2 === 0) c = hash2(x, y, seed) < 0.5 ? P.grass5 : P.grass6; // seedlings
        buf.set(x, y, c);
      }
    }
    for (let x = x0 + 3; x < x0 + w; x += 7) { buf.set(x, y0 - 1, P.pearl); buf.set(x, y0 - 2, P.pearl); } // labels
  };
  bed(16, 44, 26);
  bed(46, 47, 26);
  // glass cloches over the tenderest seedlings
  for (const [cx, cy] of [[22, 47], [34, 47], [58, 50]]) {
    for (let y = cy - 8; y <= cy; y++) {
      for (let x = cx - 5; x <= cx + 5; x++) {
        const d = Math.hypot((x + 0.5 - cx) / 5, (y + 0.5 - cy) / 8);
        if (d > 1) continue;
        const under = opaqueAt(buf, x, y);
        const glass = d > 0.85 ? P.pane4 : (x < cx - 1 && y < cy - 3) ? P.pearl : P.pane3;
        const a = d > 0.85 ? 0.7 : 0.35;
        buf.set(x, y, under ? mixHex(under, glass, a) : withAlpha(glass, a));
      }
    }
    buf.set(cx, cy - 9, P.pane4);
  }
  // a watering can and a stack of pots
  for (let y = 60; y < 65; y++) for (let x = 60; x < 67; x++) buf.set(x, y, rampSoft([P.stone1, P.iron2, P.iron3], 0.7 - (x - 60) / 9, x, y, seed));
  for (let k = 0; k < 4; k++) buf.set(67 + k, 60 - k, P.iron2);
  for (let x = 61; x < 66; x++) buf.set(x, 58, P.iron2);
  for (const [x, y] of [[20, 62], [22, 64], [24, 62]]) for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) buf.set(x + i, y + j, j === 0 ? P.soil3 : P.soil2);
  lantern(buf, kit, 12, 64, 5, lamps);
  lantern(buf, kit, 76, 62, 5, lamps);
  steps(buf, kit, 44, 67);
  return { buf: buf.outline('auto'), lamps, fx: {} };
}

// The lily pond: still water holding the evening sky, lily pads and flowers,
// reeds at the back and a stone lantern on the rim.
function pond(kit, accent, seed) {
  const { P, PixelBuffer, rampSoft, hash2, layer } = kit;
  const r = R(P);
  const buf = new PixelBuffer(88, 88);
  const lamps = [];
  // reeds and cattails behind the water
  for (let k = 0; k < 16; k++) {
    const x = 18 + Math.round(hash2(k, 1, seed) * 52);
    const h = 12 + Math.round(hash2(k, 2, seed) * 14);
    for (let j = 0; j < h; j++) buf.set(x + (j > h * 0.6 ? 1 : 0), 52 - j, j % 4 ? P.grass3 : P.grass4);
    if (k % 3 === 0) for (let j = 0; j < 3; j++) buf.set(x + 1, 52 - h + j, P.soil2);
  }
  plot(buf, kit, { cx: 44, top: 64, rx: 36, ry: 11, face: 5, seed, earth: true });
  // the rim of stones and the water inside it
  layer(buf, 12, 46, 77, 72, (x, y) => {
    const ex = (x + 0.5 - 44) / 31, ey = (y + 0.5 - 58) / 10;
    const d = Math.hypot(ex, ey);
    if (d > 1) return null;
    if (d > 0.84) {
      const k = Math.floor(Math.atan2(ey, ex) * 7);
      return hash2(k, 0, seed) < 0.15 ? P.grass3 : rampSoft(r.stone, 0.7 - ey * 0.2 - ex * 0.2 + (hash2(k, 1, seed) - 0.5) * 0.3, x, y, seed);
    }
    // the sky, reflected: pale near the far bank, deep near us, with ripples
    const ripple = Math.sin(x * 0.6 + y * 1.7) > 0.93 ? 0.25 : 0;
    return rampSoft(r.pond, 0.8 - (ey + 1) * 0.35 + ripple + (hash2(x, y, seed) - 0.5) * 0.08, x, y, seed);
  });
  // lily pads and flowers
  for (const [lx, ly, s] of [[28, 57, 3], [36, 62, 4], [55, 55, 3], [60, 61, 4], [46, 59, 2], [22, 61, 2]]) {
    for (let y = -s; y <= s; y++) {
      for (let x = -s - 1; x <= s + 1; x++) {
        if (Math.hypot(x / (s + 1), y / (s * 0.6)) > 1) continue;
        if (x > 0 && Math.abs(y) < 0.6) continue; // the notch
        buf.set(lx + x, ly + y, rampSoft([P.leaf2, P.leaf3, P.leaf4, P.leaf5], 0.5 - x / 10 - y / 8, lx + x, ly + y, seed));
      }
    }
    if (s > 2) {
      buf.set(lx - 1, ly - 1, P.rose3);
      buf.set(lx, ly - 2, P.rose2);
      buf.set(lx + 1, ly - 1, P.rose3);
      buf.set(lx, ly - 1, P.sunny);
    }
  }
  // a stone lantern on the rim
  const tx = 70, ty = 56;
  for (let y = ty - 3; y < ty; y++) for (let x = tx - 2; x <= tx + 2; x++) buf.set(x, y, x === tx - 2 ? P.stone4 : P.stone2);
  for (let y = ty - 8; y < ty - 3; y++) buf.set(tx, y, P.stone2);
  for (let y = ty - 13; y < ty - 8; y++) for (let x = tx - 3; x <= tx + 3; x++) buf.set(x, y, x === tx - 3 || x === tx + 3 ? P.stone3 : y === ty - 13 ? P.stone3 : P.lamp);
  for (let j = 0; j < 3; j++) for (let x = tx - 5 + j; x <= tx + 5 - j; x++) buf.set(x, ty - 14 - j, j === 0 ? P.stone2 : P.stone3);
  lamps.push([tx, ty - 10]);
  bush(buf, kit, 14, 56, 3, r.leaf, seed + 1, [P.lav1, P.rose3]);
  bush(buf, kit, 76, 64, 2, r.leaf, seed + 2, [P.daisy]);
  lantern(buf, kit, 24, 70, 4, lamps);
  return { buf: buf.outline('auto'), lamps, fx: { koi: [44, 58, 22, 6] } };
}

// The windmill: a tapering tower of whitewashed brick under a timber cap;
// its sails are fx.sails*, turned by the page.
function windmill(kit, accent, seed) {
  const { P, PixelBuffer, rampSoft, hash2 } = kit;
  const r = R(P);
  const buf = new PixelBuffer(88, 88);
  const lamps = [];
  platform(buf, kit, seed);
  // the tower
  for (let y = 22; y < 60; y++) {
    const t = (y - 22) / 38;
    const half = 7 + t * 7;
    for (let x = Math.round(44 - half); x <= Math.round(44 + half); x++) {
      const u = (x - (44 - half)) / (half * 2);
      let c = rampSoft([P.stone1, P.stone2, P.stone3, P.stone4, P.pearl], 0.85 - u * 0.7 + (hash2(x, y, seed) - 0.5) * 0.1, x, y, seed);
      if ((y - 22) % 4 === 3 && hash2(x >> 2, y, seed) < 0.3) c = P.stone2; // brick courses showing through
      buf.set(x, y, c);
    }
  }
  // door and windows, lit
  for (let y = 50; y < 60; y++) for (let x = 41; x < 47; x++) buf.set(x, y, y === 50 ? P.wood3 : x === 41 ? P.wood3 : P.wood1);
  buf.set(45, 55, P.honey3);
  for (const [wx, wy] of [[40, 38], [47, 30]]) {
    for (let y = wy; y < wy + 4; y++) for (let x = wx; x < wx + 3; x++) buf.set(x, y, y === wy ? P.wood2 : P.lamp);
    lamps.push([wx + 1, wy + 2]);
  }
  // the timber cap, like an upturned boat
  for (let y = 12; y < 23; y++) {
    const half = 9 * Math.sqrt(Math.max(0, 1 - ((22 - y) / 11) ** 2)) + 1;
    for (let x = Math.round(44 - half); x <= Math.round(44 + half); x++) buf.set(x, y, rampSoft(r.wood, 0.75 - (x - 44 + half) / (half * 3) - (22 - y) * 0.02, x, y, seed));
  }
  buf.set(44, 11, P.honey3);
  // sacks of seed, a cart
  for (const [x, y] of [[24, 62], [28, 63], [26, 59]]) for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) buf.set(x + i, y + j, rampSoft([P.straw0, P.straw1, P.straw2], 0.7 - i / 6 - j / 10, x + i, y + j, seed));
  for (let x = 56; x < 70; x++) { buf.set(x, 60, P.wood3); buf.set(x, 61, P.wood2); buf.set(x, 62, P.wood1); }
  for (const [cx, cy] of [[58, 64], [67, 64]]) for (let a = 0; a < 12; a++) buf.set(Math.round(cx + Math.cos(a / 2) * 2.4), Math.round(cy + Math.sin(a / 2) * 2.4), P.wood1);
  lantern(buf, kit, 16, 66, 5, lamps);
  lantern(buf, kit, 74, 66, 4, lamps);
  steps(buf, kit, 44, 61);
  bush(buf, kit, 32, 66, 2, r.leaf, seed + 1, [P.sunny, P.poppy]);
  return { buf: buf.outline('auto'), lamps, fx: { sails: [44, 17] } };
}

// The windmill's four sails, a lattice of timber and canvas, turning.
function sails(kit, n) {
  const { P, PixelBuffer } = kit;
  const S = 64;
  const c = S / 2;
  const frames = [];
  for (let f = 0; f < n; f++) {
    const buf = new PixelBuffer(S, S);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + (f / n) * (Math.PI / 2);
      const ux = Math.cos(a), uy = Math.sin(a) * 0.9;
      const vx = -uy, vy = ux;
      for (let s = 2; s < 29; s += 0.5) {
        // the whip (the spar) and a lattice panel beside it
        buf.set(Math.round(c + ux * s), Math.round(c + uy * s), P.wood2);
        if (s > 7) {
          for (let w = 1; w <= 5; w++) {
            const x = Math.round(c + ux * s + vx * w), y = Math.round(c + uy * s + vy * w);
            const bar = Math.round(s) % 4 === 0 || w === 5;
            buf.set(x, y, bar ? P.wood3 : (w + Math.round(s)) % 2 ? P.pearlD : P.daisy);
          }
        }
      }
    }
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) buf.set(c + x, c + y, x + y < 0 ? P.wood3 : P.wood1);
    frames.push({ name: `sails${f}`, buf });
  }
  return frames;
}

// ------------------------------------------------------------------ hub --

// The Great Oak: a crown of leaves over a treehouse, lanterns in the
// branches, roots gripping the plot, a sun carved on the trunk.
function oak(kit) {
  const { P, PixelBuffer, rampSoft, hash2, vnoise, mulberry32, layer } = kit;
  const r = R(P);
  const W = 132, H = 126, cx = 66, baseY = 86;
  const buf = new PixelBuffer(W, H);
  const lamps = [];
  plot(buf, kit, { cx, top: baseY + 8, rx: 54, ry: 15, face: 7, seed: 7, earth: true });
  plot(buf, kit, { cx, top: baseY, rx: 46, ry: 13, face: 9, seed: 8, flowers: 0.07 });
  // roots
  for (const [dx, dy] of [[-26, 6], [-14, 10], [16, 9], [28, 5], [-4, 11]]) {
    for (let s = 0; s <= 1; s += 0.02) {
      const x = cx + dx * s, y = baseY - 2 + dy * s;
      const w = (1 - s) * 4 + 1;
      for (let i = -w; i <= w; i++) buf.set(Math.round(x + i * 0.3), Math.round(y + i * 0.2), rampSoft(r.wood, 0.55 - i / 8, Math.round(x), Math.round(y), 3));
    }
  }
  // the trunk and its limbs
  const bark = (x, y, half, cxAt) => rampSoft(r.wood, 0.7 - (x - (cxAt - half)) / (half * 2.2) + (vnoise(x * 0.9, y * 0.12, 5) - 0.5) * 0.45, x, y, 5);
  for (let y = 36; y < baseY + 2; y++) {
    const t = (y - 36) / (baseY + 2 - 36);
    const half = 6 + t * 4 + (t > 0.8 ? (t - 0.8) * 20 : 0);
    const mid = cx + Math.sin(t * 3) * 1.5;
    for (let x = Math.round(mid - half); x <= Math.round(mid + half); x++) buf.set(x, y, bark(x, y, half, mid));
  }
  for (const [x1, y1, w] of [[26, 30, 3], [108, 26, 3], [44, 16, 2.5], [90, 14, 2.5]]) {
    for (let s = 0; s <= 1; s += 0.01) {
      const x = lerp(cx, x1, s), y = lerp(46, y1, s) - Math.sin(s * Math.PI) * 6;
      const ww = lerp(w + 2, 1, s);
      for (let i = -ww; i <= ww; i++) buf.set(Math.round(x), Math.round(y + i), rampSoft(r.wood, 0.6 - i / 6, Math.round(x), Math.round(y + i), 5));
    }
  }
  // the crown: clumps of leaves, lit gold along their upper left edges
  const rng = mulberry32(21);
  const clumps = [];
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng());
    clumps.push({ x: cx + Math.cos(a) * d * 50, y: 30 + Math.sin(a) * d * 22 - 2, r: 9 + rng() * 9 });
  }
  clumps.sort((p, q) => q.y - p.y);
  layer(buf, 0, 0, W, 64, (x, y) => {
    let hit = null;
    for (const c of clumps) if (Math.hypot(x + 0.5 - c.x, (y + 0.5 - c.y) * 1.2) < c.r * (0.85 + 0.2 * vnoise(x * 0.4, y * 0.4, 9))) { hit = c; }
    if (!hit) return null;
    // leave gaps in the lower middle where the treehouse sits
    if (x > 50 && x < 82 && y > 34 && y < 58) return null;
    const dx = (x + 0.5 - hit.x) / hit.r, dy = (y + 0.5 - hit.y) / hit.r;
    const clump = vnoise(x * 0.55, y * 0.55, 11);
    let lit = 0.5 - dx * 0.35 - dy * 0.4 + (clump - 0.5) * 0.5 - (y > 44 ? (y - 44) * 0.02 : 0);
    if (dx < -0.55 && dy < 0 && clump > 0.45) return P.leafLit;
    return rampSoft(r.leaf, lit, x, y, 13);
  });
  // the treehouse: plank walls, a shingled roof, a round window and a porch
  planks(buf, kit, 52, 40, 28, 14, 17, 0.62);
  for (let j = 0; j < 9; j++) for (let i = -2 + j; i < 30 - j; i++) buf.set(52 + i, 39 - j, (i + j) % 3 === 0 ? P.soil1 : i < 12 ? P.wood3 : P.wood2);
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 10) buf.set(60 + x, 46 + y, x * x + y * y > 6 ? P.wood1 : y < 0 ? P.lamp : P.honey3);
  for (let y = 44; y < 54; y++) for (let x = 70; x < 75; x++) buf.set(x, y, x === 70 || y === 44 ? P.wood3 : P.wood0);
  for (let x = 48; x < 84; x++) { buf.set(x, 54, P.wood3); buf.set(x, 55, P.wood1); if (x % 4 === 0) for (let y = 50; y < 54; y++) buf.set(x, y, P.wood2); }
  for (let x = 48; x < 84; x++) buf.set(x, 50, P.wood2);
  lamps.push([60, 46]);
  // a rope ladder down to the lawn
  for (let y = 56; y < baseY - 2; y++) { buf.set(78, y, P.straw1); buf.set(82, y, P.straw1); if (y % 4 === 0) for (let x = 79; x < 82; x++) buf.set(x, y, P.wood3); }
  // lanterns hanging from the branches
  for (const [lx, ly] of [[30, 38], [104, 34], [44, 26], [92, 22], [18, 50], [114, 46]]) {
    for (let y = ly - 5; y < ly; y++) buf.set(lx, y, P.wood0);
    for (let y = ly; y < ly + 3; y++) for (let x = lx - 1; x <= lx + 1; x++) buf.set(x, y, x === lx && y === ly + 1 ? P.lamp : P.honey2);
    lamps.push([lx, ly + 1]);
  }
  // the sun carved on the trunk
  const sy = 70;
  for (let y = -6; y <= 6; y++) {
    for (let x = -6; x <= 6; x++) {
      const d = Math.hypot(x, y);
      const ray = d > 4 && d < 6.4 && Math.abs(((Math.atan2(y, x) / (Math.PI / 6)) % 1 + 1) % 1 - 0.5) > 0.3;
      if (d <= 3.6) buf.set(cx + x, sy + y, d < 2.4 ? P.honey3 : P.honey2);
      else if (ray) buf.set(cx + x, sy + y, P.honey2);
    }
  }
  for (const x of [cx - 28, cx + 28]) lantern(buf, kit, x, baseY + 14, 5, lamps);
  for (let k = 0; k < 5; k++) buf.rect(cx - 6 + k, baseY + 12 + k * 2, 13 - k * 2, 1, k % 2 ? P.stone2 : P.stone3);
  for (const [x, y, s, fl] of [[18, 100, 3, [P.rose2, P.rose3]], [32, 106, 2, [P.sunny]], [100, 104, 3, [P.lav1, P.lav2]], [114, 98, 2, [P.daisy]]]) bush(buf, kit, x, y, s, r.leaf, x + y, fl);
  buf.outline('auto');
  return { buf, lamps };
}
const lerp = (a, b, t) => a + (b - a) * t;
