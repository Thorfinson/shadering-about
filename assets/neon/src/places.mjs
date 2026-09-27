// The eight places of neon-os.html, each on a city block rising out of the
// undercity, lit by neon and a thousand windows, wet with rain:
//
//   hub.orchestrator    the arcology: a megatower with a wireframe globe turning
//                       in holo light on its crown (fx.globe*)
//   station.knowledge   the data archive: server racks behind a glass front,
//                       dishes on the roof, a vertical sign
//   station.documents   the holo kiosk: an awning, paper stacks, vending machines
//                       (the page floats documents over it, fx.doc*)
//   station.models      the AI lab: a glass tower with a hologram head on its roof
//                       (fx.head*)
//   station.repos       container stacks: homes in painted boxes, a crane, steam
//   station.tests       the firewall: a bunker under a hexagonal force field
//   station.memory      the memory pagoda: neon eaves, paper lanterns
//   station.deploy      the skyport: a landing pad, a VTOL, a control tower
//
// Meta lists every lamp so the page can bloom them, and where the moving parts
// go: LEDs, documents, the head, steam, koi.

export default function generate(kit) {
  const { P } = kit;
  const BUILD = {
    knowledge: [archive, P.research, 3],
    documents: [kiosk, P.analyze, 11],
    models: [lab, P.model, 19],
    repos: [stacks, P.build, 27],
    tests: [firewall, P.test, 35],
    memory: [pagoda, P.remember, 43],
    deploy: [skyport, P.deploy, 51],
  };
  const lamps = {};
  const fx = {};
  const frames = Object.entries(BUILD).map(([name, [make, accent, seed]]) => {
    const out = make(kit, accent, seed);
    lamps[name] = out.lamps;
    fx[name] = out.fx;
    return { name, buf: out.buf };
  });
  const h = arcology(kit);
  return [
    { sprite: 'station', frames, meta: { base: [44, 58], prx: 30, pry: 9, lamps, fx } },
    { sprite: 'hub', frames: [{ name: 'orchestrator', buf: h.buf }], meta: { base: [66, 86], prx: 46, pry: 13, lamps: h.lamps, globe: h.globe } },
    { sprite: 'fx', frames: [...globeFrames(kit, 16), ...headFrames(kit, 12), ...docFrames(kit)], meta: { globeFrames: 16, headFrames: 12 } },
  ];
}

const R = (P) => ({
  conc: [P.conc0, P.conc1, P.conc2, P.conc3, P.conc4],
  steel: [P.steel0, P.steel1, P.steel2, P.steel3],
  holo: [P.holo0, P.holo1, P.holo2, P.holo3],
  car: [P.car0, P.car1, P.car2, P.car3],
});
const WINDOWS = (P) => [P.winWarm, P.winCool, P.winPink, P.winWarm, P.winCool];

// A city block seen from above at an angle: a rooftop with a neon trim, and a
// facade of windows below it (or the dim undercity).
function block(buf, kit, { cx, top, rx, ry, face, seed, trim = null, under = false, lit = 0.35 }) {
  const { P, rampSoft, hash2, layer } = kit;
  const r = R(P);
  const W = WINDOWS(P);
  const shape = (ex) => Math.pow(Math.max(0, 1 - Math.abs(ex) ** 4), 0.25); // a squarish footprint
  layer(buf, cx - rx - 1, top - ry - 1, cx + rx + 1, top + ry + face + 2, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    const ex = (px - cx) / rx;
    if (Math.abs(ex) > 1) return null;
    const frontY = top + ry * shape(ex);
    if (py > frontY && py <= frontY + face) {
      const fy = py - frontY;
      if (fy < 1) return under ? P.conc2 : trim ?? P.conc4;
      const k = x - Math.round(cx) + 400;
      const row = Math.floor((fy - 1.5) / 3);
      if ((fy - 1.5) % 3 < 1.2 && k % 3 !== 0 && fy < face - 1) {
        const h = hash2(k, row, seed);
        if (h < (under ? lit * 0.4 : lit)) return W[Math.floor(hash2(k >> 2, row, seed + 1) * W.length)];
        return P.winDim;
      }
      if (fy > face - 1.1) return P.ink;
      return rampSoft(r.conc, (under ? 0.35 : 0.55) - ex * 0.3 - (fy / face) * 0.3, x, y, seed);
    }
    const ey = (py - top) / ry;
    if (Math.abs(ey) > shape(ex)) return null;
    const edge = Math.abs(ey) > shape(ex) * 0.86 || Math.abs(ex) > 0.93;
    if (edge && !under) return trim ?? P.conc4;
    if (!under && hash2(x >> 2, y >> 1, seed + 3) < 0.04) return P.steel1; // vents on the roof
    const wet = hash2(x, y, seed + 5) < 0.04 ? 0.25 : 0; // puddles catching the light
    return rampSoft(r.conc, (under ? 0.25 : 0.42) - ey * 0.1 - ex * 0.12 + wet + (hash2(x >> 1, y, seed + 6) - 0.5) * 0.12, x, y, seed + 2);
  });
}
function platform(buf, kit, seed, trim) {
  block(buf, kit, { cx: 44, top: 64, rx: 36, ry: 11, face: 6, seed, under: true });
  block(buf, kit, { cx: 44, top: 58, rx: 30, ry: 9, face: 6, seed: seed + 1, trim });
}
// a box standing on the roof: a lit top, a front of windows or panels
function tower(buf, kit, { x, y, w, h, d = 3, seed, lit = 0.4, glass = false, trim = null }) {
  const { P, rampSoft, hash2 } = kit;
  const r = R(P);
  const W = WINDOWS(P);
  for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) buf.set(x + i, y - h - d + j, j === 0 ? trim ?? P.conc4 : rampSoft(r.conc, 0.5 - i / (w * 2), x + i, y - h - d + j, seed));
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const X = x + i, Y = y - h + j;
      let c = rampSoft(glass ? r.holo : r.conc, (glass ? 0.3 : 0.5) - (i / w) * 0.35 + (hash2(X, Y, seed) - 0.5) * 0.1, X, Y, seed);
      if (i === 0) c = trim ?? P.conc4;
      else if (i === w - 1) c = P.conc0;
      else if (j % 3 === 1 && i % 2 === 1 && i < w - 1) c = hash2(X, Y, seed + 1) < lit ? W[Math.floor(hash2(X >> 2, Y, seed + 2) * W.length)] : glass ? P.holo0 : P.winDim;
      if (glass && (i + j * 2) % 11 === 0) c = P.holo3; // reflections
      buf.set(X, Y, c);
    }
  }
}
// a neon sign: a vertical strip of glyphs, lit
function sign(buf, kit, x, y, h, col, seed, lamps) {
  const { P, hash2 } = kit;
  for (let j = 0; j < h; j++) {
    buf.set(x - 1, y + j, P.conc0);
    buf.set(x + 3, y + j, P.conc0);
    for (let i = 0; i < 3; i++) buf.set(x + i, y + j, j % 4 === 3 ? P.conc0 : hash2(i, j, seed) < 0.55 ? col : P.ink2);
  }
  lamps.push([x + 1, y + (h >> 1)]);
}
function antenna(buf, kit, x, y, h, lamps) {
  const { P } = kit;
  for (let j = 0; j < h; j++) buf.set(x, y - j, j % 4 === 0 ? P.steel2 : P.steel1);
  buf.set(x, y - h, P.red);
  lamps.push([x, y - h]);
}
function steps(buf, kit, cx, y) {
  const { P } = kit;
  for (let k = 0; k < 4; k++) buf.rect(cx - 4 + k, y + k * 2, 9 - k * 2, 1, k % 2 ? P.conc2 : P.conc3);
}

// ---------------------------------------------------------------- places --

// The data archive: a concrete block, a glass front on racks of servers.
function archive(kit, accent, seed) {
  const { P, PixelBuffer, rampSoft, hash2 } = kit;
  const r = R(P);
  const buf = new PixelBuffer(88, 88);
  const lamps = [];
  tower(buf, kit, { x: 60, y: 54, w: 12, h: 30, seed: seed + 5, lit: 0.5 });
  platform(buf, kit, seed, accent);
  tower(buf, kit, { x: 18, y: 61, w: 44, h: 36, d: 4, seed, lit: 0 });
  // the glass front, racks of servers behind it
  const leds = [24, 30, 56, 56];
  for (let y = 29; y < 58; y++) {
    for (let x = 22; x < 58; x++) {
      const rack = (x - 22) % 6;
      let c;
      if (rack === 0) c = P.conc2;
      else if ((y - 29) % 5 === 4) c = P.conc0;
      else c = hash2(x, y, seed) < 0.12 ? [P.neonGreen, P.neonAmber, P.neonCyan][Math.floor(hash2(x, y, seed + 1) * 3)] : P.ink2;
      if ((x + y) % 13 === 0) c = kit.mixHex(c, P.holo3, 0.5); // the glass catches the neon
      buf.set(x, y, c);
    }
  }
  // dishes and an antenna on the roof
  for (const [dx, dy, s] of [[26, 22, 5], [40, 21, 4]]) {
    for (let j = -s; j <= 0; j++) for (let i = -s; i <= s; i++) if (i * i + (j * 1.8) ** 2 <= s * s) buf.set(dx + i, dy + j, i < 0 ? P.steel3 : P.steel2);
    buf.set(dx, dy + 1, P.steel1);
    buf.set(dx, dy + 2, P.steel1);
  }
  antenna(buf, kit, 52, 21, 12, lamps);
  sign(buf, kit, 14, 26, 24, P.neonAmber, seed, lamps);
  steps(buf, kit, 44, 61);
  return { buf: buf.outline('auto'), lamps, fx: { leds } };
}

// The holo kiosk: an awning over a counter of paper, vending machines glowing.
function kiosk(kit, accent, seed) {
  const { P, PixelBuffer, rampSoft, hash2 } = kit;
  const buf = new PixelBuffer(88, 88);
  const lamps = [];
  tower(buf, kit, { x: 14, y: 52, w: 16, h: 26, seed: seed + 3, lit: 0.5 });
  platform(buf, kit, seed, accent);
  // the kiosk: counter, paper stacks, the awning's stripes
  for (let y = 44; y < 60; y++) for (let x = 24; x < 56; x++) buf.set(x, y, y < 47 ? P.conc3 : x === 24 ? P.conc4 : rampSoft(R(P).conc, 0.45 - (x - 24) / 70, x, y, seed));
  for (let x = 26; x < 54; x += 4) for (let y = 40; y < 47; y++) buf.set(x, y, y === 40 ? P.pearl : (y + x) % 3 ? P.pearlD : P.pearl);
  for (let y = 32; y < 38; y++) for (let x = 20 + (37 - y); x < 60 - (37 - y); x++) buf.set(x, y, Math.floor((x - 20) / 4) % 2 ? P.neonPink : P.ink2);
  for (let x = 20; x < 60; x++) buf.set(x, 38, x % 4 < 2 ? P.neonPink2 : P.neonPink);
  lamps.push([40, 38]);
  // the holo projector on the awning
  for (let x = 36; x < 45; x++) buf.set(x, 31, x === 36 ? P.steel3 : P.steel2);
  for (let x = 38; x < 43; x++) buf.set(x, 30, P.neonCyan);
  // vending machines
  for (const [vx, col] of [[58, P.neonCyan], [65, P.neonPink]]) {
    for (let y = 40; y < 58; y++) {
      for (let x = vx; x < vx + 6; x++) {
        let c = x === vx ? P.steel2 : P.steel0;
        if (y > 42 && y < 52 && x > vx && x < vx + 5) c = (y + x) % 3 === 0 ? P.pearl : col;
        buf.set(x, y, c);
      }
    }
    lamps.push([vx + 3, 46]);
  }
  steps(buf, kit, 40, 61);
  return { buf: buf.outline('auto'), lamps, fx: { docs: [[30, 20], [44, 13], [58, 21]], beam: [40, 26] } };
}

// The AI lab: a tower of dark glass with cyan edges; the model's head turns in
// hologram on its roof.
function lab(kit, accent, seed) {
  const { P, PixelBuffer } = kit;
  const buf = new PixelBuffer(88, 88);
  const lamps = [];
  tower(buf, kit, { x: 64, y: 50, w: 10, h: 22, seed: seed + 4, lit: 0.5 });
  platform(buf, kit, seed, accent);
  tower(buf, kit, { x: 26, y: 61, w: 36, h: 30, d: 4, seed, lit: 0.55, glass: true, trim: P.neonCyan });
  // the projector on the roof
  for (let y = 24; y < 27; y++) for (let x = 36; x < 53; x++) buf.set(x, y, y === 24 ? P.neonCyan : P.steel1);
  for (let x = 40; x < 49; x++) buf.set(x, 23, P.holo3);
  antenna(buf, kit, 60, 26, 8, lamps);
  sign(buf, kit, 18, 36, 18, P.neonCyan, seed, lamps);
  steps(buf, kit, 44, 61);
  return { buf: buf.outline('auto'), lamps, fx: { head: [44, 8] } };
}

// Container stacks: homes in painted steel boxes, a crane, steam from the vents.
function stacks(kit, accent, seed) {
  const { P, PixelBuffer, rampSoft, hash2 } = kit;
  const buf = new PixelBuffer(88, 88);
  const lamps = [];
  // the crane behind
  for (let y = 12; y < 58; y++) { buf.set(70, y, P.steel2); buf.set(72, y, P.steel0); if ((y - 12) % 3 === 0) buf.set(71, y, P.neonAmber); }
  for (let x = 46; x <= 73; x++) { buf.set(x, 12, P.steel3); buf.set(x, 14, P.steel1); if (x % 3 === 0) buf.set(x, 13, P.steel2); }
  for (let y = 15; y < 22; y++) buf.set(52, y, P.steel2);
  buf.set(73, 11, P.red);
  lamps.push([73, 11]);
  platform(buf, kit, seed, accent);
  const PAINT = [[P.rust0, P.rust1, P.rust2], [P.teal0, P.teal1, P.holo2], [P.mustard0, P.mustard1, P.neonAmber], [P.conc1, P.neonPink, P.neonPink2]];
  const box = (x, y, w, h, k) => {
    const paint = PAINT[k % PAINT.length];
    for (let j = 0; j < 3; j++) for (let i = 0; i < w; i++) buf.set(x + i, y - h - 3 + j, j === 0 ? paint[2] : paint[1]);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let c = rampSoft(paint, 0.7 - i / (w * 1.4), x + i, y - h + j, seed + k);
        if (i % 3 === 0) c = paint[0]; // corrugation
        if (j === Math.floor(h / 2) && i > 1 && i < w - 2 && i % 4 === 2) c = hash2(x + i, y, seed) < 0.7 ? [P.winWarm, P.winCool, P.winPink][k % 3] : P.winDim;
        if (j === h - 1) c = P.ink;
        buf.set(x + i, y - h + j, c);
      }
    }
  };
  const list = [[16, 56, 14, 9, 0], [31, 55, 15, 10, 1], [47, 56, 13, 8, 2], [61, 57, 12, 9, 3], [19, 47, 13, 8, 1], [35, 45, 14, 8, 3], [52, 48, 12, 7, 0], [26, 39, 11, 7, 2], [42, 37, 10, 6, 1]];
  list.forEach(([x, y, w, h, k]) => box(x, y, w, h, k));
  // neon signs on the stack, AC units, a ladder
  for (let x = 20; x < 30; x++) buf.set(x, 34, x % 2 ? P.neonGreen : P.neonCyan);
  lamps.push([25, 34]);
  for (const [x, y] of [[29, 43], [50, 42], [64, 51]]) for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) buf.set(x + i, y + j, (i + j) % 2 ? P.steel1 : P.steel2);
  for (let y = 38; y < 56; y++) { buf.set(59, y, P.steel2); if (y % 3 === 0) buf.set(60, y, P.steel2); buf.set(61, y, P.steel2); }
  steps(buf, kit, 44, 61);
  return { buf: buf.outline('auto'), lamps, fx: { smoke: [[31, 36], [55, 40]] } };
}

// The firewall: a bunker in hazard stripes under a dome of hexagonal light.
function firewall(kit, accent, seed) {
  const { P, PixelBuffer, rampSoft, mixHex, withAlpha, opaqueAt, layer } = kit;
  const buf = new PixelBuffer(88, 88);
  const lamps = [];
  platform(buf, kit, seed, accent);
  // the bunker: sloped concrete walls, a slot of light, hazard stripes at its foot
  for (let y = 38; y < 60; y++) {
    const inset = Math.round((60 - y) * 0.35);
    for (let x = 22 + inset; x < 66 - inset; x++) {
      let c = rampSoft(R(P).conc, 0.55 - (x - 22) / 70 - (y - 38) / 90, x, y, seed);
      if (y > 55) c = Math.floor((x + y) / 3) % 2 ? P.neonAmber : P.ink;
      if (y === 46 && x > 30 && x < 58) c = P.neonCyan;
      buf.set(x, y, c);
    }
  }
  lamps.push([44, 46]);
  // turrets with red eyes
  for (const tx of [26, 62]) {
    for (let y = 30; y < 38; y++) for (let x = tx - 2; x <= tx + 2; x++) buf.set(x, y, x === tx - 2 ? P.steel2 : P.steel1);
    buf.set(tx, 32, P.red);
    lamps.push([tx, 32]);
  }
  // the force field: a dome of hexagons, only partly there
  const cx = 44, cy = 58, rx = 30, ry = 34;
  layer(buf, cx - rx, cy - ry, cx + rx + 1, cy + 1, (x, y) => {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    const d = Math.hypot(dx, dy);
    if (d > 1 || dy > 0) return null;
    // hex grid in screen space
    const q = (x + 0.5) / 5, rr = (y + 0.5) / 4.33;
    const col = Math.floor(q + (Math.floor(rr) % 2) * 0.5);
    const fx = q + (Math.floor(rr) % 2) * 0.5 - col, fy = rr - Math.floor(rr);
    const edge = fx < 0.14 || fx > 0.86 || fy < 0.16;
    const rim = d > 0.95;
    if (!edge && !rim) return null;
    const under = opaqueAt(buf, x, y);
    const c = rim ? P.neonCyan : dy < -0.5 && dx < 0 ? P.glow : P.test;
    const a = rim ? 0.8 : 0.35 + (1 - d) * 0.2;
    return under ? mixHex(under, c, a) : withAlpha(c, a);
  });
  steps(buf, kit, 44, 61);
  return { buf: buf.outline('auto'), lamps, fx: { field: [44, 40] } };
}

// The memory pagoda: three tiers of roofs edged in neon, paper lanterns.
function pagoda(kit, accent, seed) {
  const { P, PixelBuffer, rampSoft, hash2 } = kit;
  const buf = new PixelBuffer(88, 88);
  const lamps = [];
  platform(buf, kit, seed, accent);
  const tiers = [[60, 30, 10], [45, 24, 9], [32, 18, 8]];
  tiers.forEach(([base, half, h], i) => {
    // the walls of this storey
    for (let y = base - h; y < base; y++) {
      for (let x = 44 - half + 6; x <= 44 + half - 6; x++) {
        let c = rampSoft([P.conc1, P.rust0, P.rust1], 0.6 - (x - 44 + half) / (half * 3), x, y, seed);
        if ((y - base + h) % 4 === 2 && (x - 44) % 3 === 0) c = hash2(x, y, seed) < 0.75 ? P.winWarm : P.winDim;
        buf.set(x, y, c);
      }
    }
    // the roof above it, eaves curling up at the ends
    for (let j = 0; j < 5; j++) {
      const w = half - j * 2;
      for (let x = 44 - w; x <= 44 + w; x++) {
        const curl = Math.abs(x - 44) > w - 2 ? -1 : 0;
        buf.set(x, base - h - j + curl, j === 0 ? (i % 2 ? P.neonCyan : P.neonPink) : rampSoft([P.ink2, P.conc1, P.conc2], 0.6 - (x - 44 + w) / (w * 3), x, base - h - j, seed));
      }
    }
    // paper lanterns at the eaves
    for (const lx of [44 - half + 1, 44 + half - 1]) {
      buf.set(lx, base - h + 1, P.red);
      buf.set(lx, base - h + 2, P.neonAmber);
      lamps.push([lx, base - h + 1]);
    }
  });
  for (let y = 4; y < 14; y++) buf.set(44, y, y % 3 ? P.steel2 : P.neonAmber);
  lamps.push([44, 4]);
  steps(buf, kit, 44, 61);
  return { buf: buf.outline('auto'), lamps, fx: { koi: [44, 40, 30, 12] } };
}

// The skyport: a landing pad ringed in lights, a VTOL waiting, a control tower.
function skyport(kit, accent, seed) {
  const { P, PixelBuffer, rampSoft, layer } = kit;
  const buf = new PixelBuffer(88, 88);
  const lamps = [];
  tower(buf, kit, { x: 62, y: 52, w: 10, h: 32, seed: seed + 2, lit: 0.6 });
  for (let x = 60; x < 74; x++) buf.set(x, 16, x < 66 ? P.neonCyan : P.holo2);
  antenna(buf, kit, 67, 15, 6, lamps);
  platform(buf, kit, seed, accent);
  // the pad: a ring of lights and a painted mark
  layer(buf, 14, 48, 75, 70, (x, y) => {
    const d = Math.hypot((x + 0.5 - 40) / 24, (y + 0.5 - 58) / 7.5);
    if (d > 1) return null;
    if (d > 0.88) return (x % 4 === 0) ? P.neonAmber : P.conc3;
    if (Math.abs(d - 0.55) < 0.06) return P.neonAmber;
    return null;
  });
  for (let a = 0; a < 4; a++) lamps.push([Math.round(40 + Math.cos((a * Math.PI) / 2 + 0.4) * 23), Math.round(58 + Math.sin((a * Math.PI) / 2 + 0.4) * 7)]);
  // the VTOL: a dark wedge with engine pods and cockpit glass
  for (let y = 46; y < 58; y++) {
    for (let x = 22; x < 62; x++) {
      const px = x + 0.5, py = y + 0.5;
      const body = Math.hypot((px - 40) / 16, (py - 53) / 4.5) <= 1;
      const pod = Math.hypot((px - 26) / 4, (py - 51) / 3) <= 1 || Math.hypot((px - 54) / 4, (py - 51) / 3) <= 1;
      const glass = Math.hypot((px - 47) / 5, (py - 50.5) / 2.2) <= 1;
      if (glass) buf.set(x, y, py < 50 ? P.holo3 : P.holo1);
      else if (body || pod) buf.set(x, y, rampSoft(R(P).car, 0.7 - (py - 48) / 12 - (px - 22) / 90, x, y, seed));
    }
  }
  buf.set(26, 54, P.neonCyan);
  buf.set(54, 54, P.neonCyan);
  buf.set(24, 53, P.red);
  buf.set(57, 53, P.white);
  lamps.push([26, 54], [54, 54]);
  steps(buf, kit, 40, 66);
  return { buf: buf.outline('auto'), lamps, fx: {} };
}

// ------------------------------------------------------------------ hub --

// The arcology: a megatower of stacked blocks, neon strips up its sides, a
// cradle on its crown where the wireframe globe turns (fx.globe*).
function arcology(kit) {
  const { P, PixelBuffer } = kit;
  const W = 132, H = 126, cx = 66, baseY = 86;
  const buf = new PixelBuffer(W, H);
  const lamps = [];
  // towers behind
  tower(buf, kit, { x: 14, y: 90, w: 16, h: 48, seed: 3, lit: 0.5 });
  tower(buf, kit, { x: 100, y: 88, w: 18, h: 54, seed: 5, lit: 0.5 });
  antenna(buf, kit, 108, 30, 10, lamps);
  block(buf, kit, { cx, top: baseY + 8, rx: 54, ry: 15, face: 8, seed: 7, under: true });
  block(buf, kit, { cx, top: baseY, rx: 46, ry: 13, face: 9, seed: 8, trim: P.neonAmber });
  // the megatower, in three setbacks
  tower(buf, kit, { x: 36, y: 90, w: 60, h: 20, d: 5, seed: 9, lit: 0.6, trim: P.neonPink });
  tower(buf, kit, { x: 44, y: 65, w: 44, h: 18, d: 4, seed: 10, lit: 0.6, trim: P.neonCyan });
  tower(buf, kit, { x: 52, y: 43, w: 28, h: 12, d: 3, seed: 11, lit: 0.6, trim: P.neonPink });
  // neon strips up its corners
  for (let y = 30; y < 88; y++) {
    if (y > 44) buf.set(45, y, y % 5 ? P.neonCyan : P.holo3);
    if (y > 44) buf.set(86, y, y % 5 ? P.neonPink : P.neonPink2);
  }
  // the cradle on the crown
  for (let y = 22; y < 28; y++) for (let x = cx - 2; x <= cx + 2; x++) buf.set(x, y, x === cx - 2 ? P.steel3 : P.steel1);
  for (let k = 0; k < 9; k++) { buf.set(cx - 3 - k, 24 - Math.round(k * 0.6), P.steel2); buf.set(cx + 3 + k, 24 - Math.round(k * 0.6), P.steel2); }
  // the seal: an eye in a ring on the tower's face
  const my = 76;
  for (let y = -6; y <= 6; y++) {
    for (let x = -6; x <= 6; x++) {
      const d = Math.hypot(x, y);
      if (d > 6.2) continue;
      const eye = Math.hypot(x / 4.5, y / 2.2) <= 1;
      buf.set(cx + x, my + y, d > 5 ? P.neonCyan : eye ? (Math.hypot(x, y) < 1.6 ? P.ink : Math.hypot(x, y) < 2.4 ? P.neonPink : P.pearl) : P.ink2);
    }
  }
  lamps.push([cx, my]);
  for (const x of [cx - 30, cx + 30]) { for (let j = 0; j < 7; j++) buf.set(x, baseY + 14 - j, P.steel2); buf.set(x, baseY + 6, P.neonAmber); lamps.push([x, baseY + 6]); }
  for (let k = 0; k < 5; k++) buf.rect(cx - 6 + k, baseY + 12 + k * 2, 13 - k * 2, 1, k % 2 ? P.conc2 : P.conc3);
  buf.outline('auto');
  return { buf, lamps, globe: [cx, 6] };
}

// ------------------------------------------------------------------ fx ---

// A wireframe globe in cyan light, turning.
function globeFrames(kit, n) {
  const { P, PixelBuffer, withAlpha } = kit;
  const S = 40, c = 20, R0 = 15;
  const frames = [];
  for (let f = 0; f < n; f++) {
    const buf = new PixelBuffer(S, S);
    const rot = (f / n) * (Math.PI / 3);
    const plot = (x, y, z) => {
      const X = Math.round(c + x), Y = Math.round(c + y);
      buf.set(X, Y, z > 0 ? P.holo3 : withAlpha(P.holo2, 0.55));
    };
    for (let k = 0; k < 6; k++) {
      const lon = rot + (k / 6) * Math.PI;
      for (let a = 0; a < Math.PI * 2; a += 0.04) plot(Math.cos(a) * Math.sin(lon) * R0, Math.sin(a) * R0, Math.cos(a) * Math.cos(lon));
    }
    for (const lat of [-0.9, -0.45, 0, 0.45, 0.9]) {
      const rr = Math.cos(lat) * R0, y = Math.sin(lat) * R0;
      for (let a = 0; a < Math.PI * 2; a += 0.04) plot(Math.cos(a) * rr, y, Math.sin(a));
    }
    for (let a = 0; a < Math.PI * 2; a += 0.02) buf.set(Math.round(c + Math.cos(a) * 18), Math.round(c + Math.sin(a) * 4 + 4), withAlpha(P.neonPink, 0.8));
    frames.push({ name: `globe${f}`, buf });
  }
  return frames;
}

// The model's head in hologram: a wireframe bust, turning.
function headFrames(kit, n) {
  const { P, PixelBuffer, withAlpha, clamp } = kit;
  const S = 36, frames = [];
  for (let f = 0; f < n; f++) {
    const buf = new PixelBuffer(S, S);
    const rot = (f / n) * Math.PI * 2;
    // points on a head: an egg, a nose, a jaw, a neck
    const plot = (x, y, z, bright) => {
      const xr = x * Math.cos(rot) + z * Math.sin(rot), zr = -x * Math.sin(rot) + z * Math.cos(rot);
      buf.set(Math.round(18 + xr), Math.round(16 + y), zr > 0 || bright ? P.holo3 : withAlpha(P.holo2, 0.5));
    };
    for (let lat = -1.3; lat <= 1.3; lat += 0.26) {
      for (let a = 0; a < Math.PI * 2; a += 0.08) {
        const y = Math.sin(lat) * 12, rr = Math.cos(lat) * (lat > 0 ? 8 - lat * 2 : 9);
        plot(Math.cos(a) * rr, y, Math.sin(a) * rr * 1.1);
      }
    }
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      for (let y = -12; y <= 12; y += 0.5) {
        const lat = Math.asin(clamp(y / 12.5, -1, 1)), rr = Math.cos(lat) * (lat > 0 ? 8 - lat * 2 : 9);
        plot(Math.cos(a) * rr, y, Math.sin(a) * rr * 1.1);
      }
    }
    for (let y = -2; y <= 3; y++) plot(0, y, 10.5 + (y > 0 ? 1.2 - y * 0.3 : 0), true); // the nose
    for (let y = 12; y < 18; y++) for (const x of [-4, 4]) plot(x, y, 0);
    for (const x of [-3.5, 3.5]) plot(x, -2, 9.4, true); // eyes
    frames.push({ name: `head${f}`, buf });
  }
  return frames;
}

// A document in hologram, lines of text scrolling.
function docFrames(kit) {
  const { P, paint, withAlpha } = kit;
  return [0, 1].map((f) => ({
    name: `doc${f}`,
    buf: paint(11, 14, (x, y) => {
      if (x === 0 || x === 10 || y === 0 || y === 13) return withAlpha(P.holo3, 0.9);
      if (y === 2 && x > 1 && x < 7) return P.neonPink2;
      if ((y + f) % 2 === 0 && x > 1 && x < 9 - ((y * 3) % 4)) return withAlpha(P.glow, 0.85);
      return withAlpha(P.holo1, 0.45);
    }),
  }));
}
