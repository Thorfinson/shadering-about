// The places of neon-2d-pixel.html: the same eight blocks as places.mjs, but
// seen straight from the side, each on a deck at the top of its tower. The
// towers themselves the page paints down to the street.
//
//   side.<key>            96 × 112, the deck's top edge at y 92 (base [48, 92])
//   sidehub.orchestrator  140 × 212, the arcology, its deck at y 188
//
// Meta lists every lamp so the page can bloom them, and where the moving parts
// go: rack LEDs, floating documents, the hologram head, steam, koi, the globe.

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
    const buf = new kit.PixelBuffer(96, 112);
    const l = [];
    deck(buf, kit, 48, 92, 40, accent, seed, l);
    fx[name] = make(buf, kit, accent, seed, l) ?? {};
    grime(buf, kit, seed);
    lamps[name] = l;
    return { name, buf };
  });
  const hub = arcology(kit);
  grime(hub.buf, kit, 61);
  return [
    { sprite: 'side', frames, meta: { base: [48, 92], prx: 38, pry: 4, lamps, fx } },
    { sprite: 'sidehub', frames: [{ name: 'orchestrator', buf: hub.buf }], meta: { base: [70, 188], prx: 56, pry: 5, lamps: hub.lamps, globe: [70, 24] } },
  ];
}

const WIN = (P) => [P.winWarm, P.winCool, P.winPink, P.winWarm, P.winCool];

// The deck: a slab with a neon edge, lamps under it, and the top of the tower
// that carries it (the page paints the rest of the tower down to the street).
function deck(buf, kit, cx, top, half, accent, seed, lamps) {
  const { P, rampSoft } = kit;
  const conc = [P.conc1, P.conc2, P.conc3, P.conc4];
  facade(buf, kit, cx - 30, cx + 30, top + 5, buf.h, seed, 0.35, accent);
  for (let x = cx - half; x <= cx + half; x++) {
    buf.set(x, top, accent);
    for (let j = 1; j < 5; j++) buf.set(x, top + j, j === 4 ? P.conc0 : rampSoft(conc, 0.7 - j * 0.14 - Math.abs(x - cx) / (half * 3), x, top + j, seed));
  }
  for (let x = cx - half + 4; x < cx + half - 2; x += 8) {
    buf.set(x, top + 5, P.lamp);
    lamps.push([x, top + 5]);
  }
}

// A wall of windows: floors three pixels apart, a lit edge on the left where
// the city's glow falls, a neon strip down one side in the block's colour.
function facade(buf, kit, x0, x1, y0, y1, seed, lit, strip = null, glass = false) {
  const { P, rampSoft, hash2 } = kit;
  const conc = glass ? [P.holo0, P.holo1, P.holo2] : [P.conc0, P.conc1, P.conc2, P.conc3];
  const W = WIN(P);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = x - x0, j = y - y0;
      let c = rampSoft(conc, (glass ? 0.45 : 0.55) - (i / (x1 - x0)) * 0.4 + (hash2(x >> 2, y >> 2, seed) - 0.5) * 0.12, x, y, seed);
      if (i === 0) c = glass ? P.holo3 : P.conc4;
      else if (x === x1 - 1) c = P.ink;
      else if (strip && i === 2) c = j % 5 === 4 ? P.ink2 : strip;
      else if (j % 3 === 1 && i % 2 === 1 && i > 3) {
        const floorLit = hash2(seed, (j / 3) | 0, 7) < 0.8;
        c = floorLit && hash2(x, y, seed + 1) < lit ? W[Math.floor(hash2(x >> 3, y, seed + 2) * W.length)] : glass ? P.holo0 : P.winDim;
      }
      if (glass && (i + j * 2) % 13 === 0) c = P.holo3;
      buf.set(x, y, c);
    }
  }
}
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
function box(buf, kit, x0, y0, x1, y1, ramp, seed, shade = 0.5) {
  const { rampSoft } = kit;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) buf.set(x, y, rampSoft(ramp, shade - ((x - x0) / (x1 - x0)) * 0.35 - ((y - y0) / (y1 - y0)) * 0.1, x, y, seed));
}

// Years of rain: streaks running down from the sills, rust, dirt. Lights and
// neon (bright or saturated pixels) stay as they are.
function grime(buf, kit, seed) {
  const { hash2 } = kit;
  const d = buf.data;
  for (let x = 0; x < buf.w; x++) {
    const streaks = [0, 1].filter((k) => hash2(x, seed + k, 1) < 0.3).map((k) => [Math.floor(hash2(x, seed + k, 2) * buf.h), 4 + Math.floor(hash2(x, seed + k, 3) * 20), hash2(x, seed + k, 5) < 0.3]);
    for (let y = 0; y < buf.h; y++) {
      const i = (y * buf.w + x) * 4;
      if (!d[i + 3]) continue;
      const lum = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      const sat = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
      if (lum > 110 || sat > 90) continue;
      let k = 0, rust = false;
      for (const [y0, len, r] of streaks) {
        if (y >= y0 && y < y0 + len) {
          k = Math.max(k, 0.35 * (1 - (y - y0) / len));
          rust ||= r;
        }
      }
      if (hash2(x, y, seed + 4) < 0.05) k = Math.max(k, 0.3);
      if (!k) continue;
      const [tr, tg, tb] = rust ? [80, 34, 20] : [7, 6, 15];
      d[i] = Math.round(d[i] + (tr - d[i]) * k);
      d[i + 1] = Math.round(d[i + 1] + (tg - d[i + 1]) * k);
      d[i + 2] = Math.round(d[i + 2] + (tb - d[i + 2]) * k);
    }
  }
}

// ---------------------------------------------------------------- places --

// The data archive: a concrete block, a glass front on racks, dishes on the roof.
function archive(buf, kit, accent, seed, lamps) {
  const { P, hash2 } = kit;
  box(buf, kit, 14, 56, 82, 92, [P.conc1, P.conc2, P.conc3, P.conc4], seed, 0.62);
  buf.rect(14, 56, 68, 1, accent);
  // the glass front: six racks behind it, LEDs in columns
  for (let y = 62; y < 89; y++) {
    for (let x = 19; x < 77; x++) {
      const r = (x - 19) % 10;
      let c = P.holo0;
      if (r >= 1 && r <= 7) {
        c = P.steel0;
        if ((y - 62) % 2 === 0 && (r === 2 || r === 4 || r === 6)) c = hash2(x, y, seed) < 0.45 ? (hash2(x, y, seed + 1) < 0.7 ? P.neonAmber : P.neonGreen) : P.winDim;
      }
      if (y === 62 || y === 88) c = P.steel1;
      buf.set(x, y, c);
    }
  }
  // two dishes, tilted to the sky
  for (const [cx, cy, r] of [[30, 48, 8], [62, 50, 6]]) {
    for (let a = 0; a < 40; a++) {
      const t = (a / 40) * Math.PI;
      const x = cx + Math.cos(t + 0.5) * r, y = cy - Math.sin(t + 0.5) * r * 0.45;
      buf.set(x, y, P.steel4);
      buf.set(x, y + 1, P.steel2);
    }
    buf.rect(cx, cy, 1, 56 - cy, P.steel1);
    buf.set(cx - 1, cy - 3, P.research);
    lamps.push([cx - 1, cy - 3]);
  }
  antenna(buf, kit, 74, 55, 18, lamps);
  sign(buf, kit, 84, 60, 26, accent, seed, lamps);
  return { leds: [20, 63, 76, 88] };
}

// The holo kiosk: a striped awning, a glowing counter, vending machines.
function kiosk(buf, kit, accent, seed, lamps) {
  const { P } = kit;
  box(buf, kit, 30, 70, 66, 92, [P.conc1, P.conc2, P.conc3], seed, 0.55);
  buf.rect(33, 77, 30, 6, P.neonPink2);
  buf.rect(33, 78, 30, 4, accent);
  lamps.push([48, 80]);
  for (let y = 64; y < 71; y++) {
    const inset = (70 - y) * 0.6;
    for (let x = Math.round(26 + inset); x < Math.round(70 - inset); x++) buf.set(x, y, Math.floor((x - 26) / 4) % 2 ? P.pearl : accent);
  }
  for (let x = 26; x < 70; x += 2) buf.set(x, 71, Math.floor((x - 26) / 4) % 2 ? P.pearl : accent);
  // vending machines, one cyan, one pink
  for (const [x0, y0, col] of [[14, 72, P.neonCyan], [72, 74, P.neonPink]]) {
    box(buf, kit, x0, y0, x0 + 10, 92, [P.steel0, P.steel1, P.steel2], seed + x0, 0.6);
    buf.rect(x0 + 2, y0 + 2, 6, 9, col);
    for (let k = 0; k < 3; k++) buf.rect(x0 + 2, y0 + 3 + k * 3, 6, 1, P.ink2);
    buf.rect(x0 + 3, y0 + 14, 4, 2, P.ink);
    lamps.push([x0 + 5, y0 + 6]);
  }
  // the holo emitter on the roof
  buf.rect(44, 62, 8, 2, P.steel2);
  buf.rect(46, 60, 4, 2, P.neonCyan);
  lamps.push([48, 60]);
  return { docs: [[34, 42], [48, 32], [62, 44], [42, 52], [56, 54]] };
}

// The AI lab: a glass tower with floors of teal light; the page sets a
// hologram head turning on its roof.
function lab(buf, kit, accent, seed, lamps) {
  const { P } = kit;
  facade(buf, kit, 32, 64, 34, 92, seed, 0.45, null, true);
  for (let y = 38; y < 92; y += 6) buf.rect(33, y, 30, 1, accent);
  buf.rect(44, 34, 8, 58, P.holo2);
  for (let y = 36; y < 92; y += 2) buf.rect(46, y, 4, 1, P.holo3);
  buf.rect(30, 30, 36, 4, P.steel1);
  buf.rect(30, 30, 36, 1, P.steel2);
  buf.rect(40, 27, 16, 3, P.steel2);
  buf.rect(42, 26, 12, 1, accent);
  lamps.push([48, 26], [33, 38], [62, 38]);
  antenna(buf, kit, 62, 29, 10, lamps);
  return { head: [48, -8] };
}

// Container stacks: homes in painted boxes, a crane swinging one over them.
function stacks(buf, kit, accent, seed, lamps) {
  const { P, hash2 } = kit;
  const PAINT = [[P.rust0, P.rust1, P.rust2], [P.teal0, P.teal1, P.holo2], [P.mustard0, P.mustard1, P.lamp], [P.conc1, P.conc3, P.steel2], [P.holo0, P.holo1, P.holo2]];
  const container = (x0, y0, k) => {
    const [a, b, c] = PAINT[k % PAINT.length];
    for (let y = y0; y < y0 + 9; y++) for (let x = x0; x < x0 + 22; x++) buf.set(x, y, y === y0 ? c : y === y0 + 8 ? a : (x - x0) % 2 ? a : b);
    if (hash2(x0, y0, seed) < 0.6) {
      const wx = x0 + 4 + Math.floor(hash2(x0, y0, seed + 1) * 12);
      buf.rect(wx, y0 + 3, 3, 3, hash2(x0, y0, seed + 2) < 0.7 ? P.winWarm : accent);
      lamps.push([wx + 1, y0 + 4]);
    }
  };
  [[14, 3], [38, 2], [62, 4]].forEach(([x, n], s) => {
    for (let k = 0; k < n; k++) container(x, 83 - k * 9, s * 3 + k);
  });
  // the crane: a lattice mast, a jib, a container on the hook
  for (let y = 14; y < 92; y++) {
    buf.set(10, y, P.mustard1);
    buf.set(12, y, P.mustard1);
    if ((y % 4) < 2) buf.set(11, y, P.mustard0);
  }
  for (let x = 4; x < 84; x++) {
    buf.set(x, 13, P.mustard1);
    buf.set(x, 15, P.mustard1);
    if (x % 4 < 2) buf.set(x, 14, P.mustard0);
  }
  buf.rect(4, 10, 8, 3, P.conc2);
  buf.set(11, 9, P.red);
  lamps.push([11, 9]);
  for (let y = 16; y < 30; y++) buf.set(74, y, P.steel2);
  container(63, 30, 1);
  // a steam vent on the middle stack
  buf.rect(48, 60, 3, 5, P.steel1);
  sign(buf, kit, 88, 56, 22, accent, seed, lamps);
  return { smoke: [[49, 58]] };
}

// The firewall: a bunker under a dome of hexagonal force field.
function firewall(buf, kit, accent, seed, lamps) {
  const { P, withAlpha } = kit;
  const R = 40, cx = 48, cy = 92;
  const hexEdge = (x, y) => {
    const s = 6;
    const q = x / (s * 1.5);
    const col = Math.floor(q);
    const yy = y / (s * 0.866 * 2) + (col % 2) * 0.5;
    const fx = q - col, fy = yy - Math.floor(yy);
    return fx < 0.12 || Math.abs(fy - 0.5) > 0.44;
  };
  for (let y = cy - R; y < cy; y++) {
    for (let x = cx - R; x <= cx + R; x++) {
      const d = Math.hypot(x - cx, (y - cy) * 1.05);
      if (d > R) continue;
      if (d > R - 1.2) buf.set(x, y, accent);
      else if (hexEdge(x + 200, y + 200)) buf.set(x, y, withAlpha(accent, 0.55));
      else buf.set(x, y, withAlpha(P.holo1, 0.16));
    }
  }
  // the bunker, chamfered, a band of hazard stripes, a slit of an eye
  for (let y = 72; y < 92; y++) {
    const inset = Math.max(0, 76 - y);
    for (let x = 22 + inset; x < 74 - inset; x++) buf.set(x, y, kit.rampSoft([P.conc0, P.conc1, P.conc2, P.conc3], 0.6 - (x - 22) / 80 - (y - 72) / 60, x, y, seed));
  }
  for (let x = 22; x < 74; x++) for (let y = 84; y < 88; y++) buf.set(x, y, Math.floor((x + y) / 3) % 2 ? P.mustard1 : P.ink);
  buf.rect(34, 77, 28, 2, accent);
  buf.rect(40, 77, 16, 1, P.pearl);
  lamps.push([48, 77], [20, 60], [76, 60]);
  return {};
}

// The memory pagoda: three tiers under flared roofs, lanterns at the eaves.
function pagoda(buf, kit, accent, seed, lamps) {
  const { P } = kit;
  const wood = [P.rust0, P.rust1, P.conc2];
  const tiers = [[26, 70, 74, 92, 14, 82, 66], [32, 64, 56, 66, 20, 76, 48], [38, 58, 40, 48, 28, 68, 32]];
  tiers.forEach(([x0, x1, y0, y1, r0, r1, ry], i) => {
    box(buf, kit, x0, y0, x1, y1, wood, seed + i, 0.5);
    // paper windows, lit from inside
    for (let x = x0 + 3; x < x1 - 4; x += 8) {
      buf.rect(x, y0 + 2, 5, y1 - y0 - 4, P.winWarm);
      buf.rect(x + 2, y0 + 2, 1, y1 - y0 - 4, P.rust1);
      lamps.push([x + 2, y0 + 4]);
    }
    // the roof: a flared band, tips turned up, a neon line along each edge
    const h = y0 - ry;
    for (let y = ry; y < y0; y++) {
      const f = (y - ry) / h;
      const inset = (1 - f) * (1 - f) * 10;
      for (let x = Math.round(r0 + inset); x < Math.round(r1 - inset); x++) buf.set(x, y, y === ry ? (i % 2 ? P.neonPink : accent) : (x + y) % 4 === 0 ? P.conc2 : P.conc1);
    }
    for (let x = r0; x < r1; x++) buf.set(x, y0, i % 2 ? accent : P.neonPink);
    for (const tx of [r0, r1 - 1]) {
      buf.set(tx, y0 - 1, accent);
      buf.set(tx, y0 - 2, accent);
      buf.set(tx, y0 + 2, i % 2 ? P.neonAmber : P.red);
      buf.set(tx, y0 + 3, i % 2 ? P.neonAmber : P.red);
      lamps.push([tx, y0 + 2]);
    }
  });
  for (let y = 16; y < 32; y++) buf.set(48, y, y % 3 ? P.steel2 : P.neonPink);
  buf.rect(47, 14, 3, 2, P.neonAmber);
  lamps.push([48, 15]);
  return { koi: [48, 60, 40, 7] };
}

// The skyport: a pad on struts, a VTOL parked on it, a control tower.
function skyport(buf, kit, accent, seed, lamps) {
  const { P } = kit;
  for (const x of [26, 48, 70]) for (let y = 74; y < 92; y++) buf.set(x, y, y % 3 ? P.steel1 : P.steel2);
  box(buf, kit, 18, 70, 92, 74, [P.steel0, P.steel1, P.steel2], seed, 0.7);
  for (let x = 20; x < 92; x += 4) {
    buf.set(x, 70, accent);
    lamps.push([x, 70]);
  }
  // the VTOL, nose to the right
  const hull = [[40, 64], [44, 60], [64, 59], [72, 62], [74, 66], [70, 69], [42, 69]];
  for (let y = 56; y < 70; y++) for (let x = 36; x < 76; x++) if (kit.inPoly(x + 0.5, y + 0.5, hull)) buf.set(x, y, y < 62 ? P.steel4 : y < 66 ? P.steel3 : P.steel2);
  buf.rect(64, 61, 7, 3, P.holo2);
  buf.rect(65, 61, 3, 1, P.holo3);
  for (const x of [44, 62]) {
    buf.rect(x - 2, 56, 5, 3, P.steel1);
    buf.rect(x - 7, 55, 15, 1, P.steel3);
  }
  buf.rect(36, 57, 5, 6, P.steel2);
  buf.set(36, 57, accent);
  buf.set(73, 65, P.white);
  lamps.push([36, 57], [73, 65]);
  // the control tower
  for (let y = 34; y < 92; y++) for (let x = 6; x < 14; x++) buf.set(x, y, x === 6 ? P.conc3 : x === 13 ? P.ink : (y % 6 === 0 && x % 2) ? P.winCool : P.conc1);
  box(buf, kit, 2, 26, 18, 34, [P.holo0, P.holo1, P.holo2], seed, 0.8);
  buf.rect(2, 26, 16, 1, P.steel2);
  buf.rect(3, 29, 14, 3, P.neonCyan);
  buf.set(10, 22, P.red);
  buf.rect(10, 23, 1, 3, P.steel2);
  lamps.push([10, 22], [10, 30]);
  return {};
}

// The arcology: a stepped megatower of lit floors, neon bands, a halo deck
// seen edge-on, a crown with a holo projector (the globe turns on the page).
function arcology(kit) {
  const { P } = kit;
  const buf = new kit.PixelBuffer(140, 212);
  const lamps = [];
  const cyan = P.cyan3;
  deck(buf, kit, 70, 188, 60, cyan, 61, lamps);
  const tiers = [[16, 124, 156, 188, cyan], [26, 114, 124, 156, P.neonPink], [36, 104, 92, 124, cyan]];
  tiers.forEach(([x0, x1, y0, y1, band], i) => {
    facade(buf, kit, x0, x1, y0, y1, 70 + i, 0.55, i === 1 ? P.neonPink : null);
    for (let x = x0; x < x1; x++) buf.set(x, y0, band);
    buf.set(x0, y0 - 1, band);
    buf.set(x1 - 1, y0 - 1, band);
    lamps.push([x0 + 2, y0], [x1 - 3, y0]);
  });
  facade(buf, kit, 48, 92, 44, 92, 75, 0.6);
  for (let y = 44; y < 92; y++) {
    buf.set(49, y, y % 6 === 5 ? P.ink2 : cyan);
    buf.set(90, y, y % 6 === 2 ? P.ink2 : P.neonPink);
  }
  // the halo deck, edge-on: an ellipse whose back half hides behind the tower
  for (let a = 0; a < 200; a++) {
    const t = (a / 200) * Math.PI * 2;
    const x = 70 + Math.cos(t) * 50, y = 64 + Math.sin(t) * 4;
    if (Math.sin(t) < 0 && x > 47 && x < 93) continue;
    buf.set(x, y, Math.sin(t) > 0 ? cyan : P.holo2);
  }
  buf.rect(24, 65, 92, 1, P.conc2);
  // the crown and the projector
  for (let k = 0; k < 4; k++) buf.rect(52 + k * 3, 40 - k * 2, 36 - k * 6, 2, k % 2 ? P.steel2 : P.steel1);
  buf.rect(66, 30, 8, 4, P.steel2);
  for (let y = 30; y < 34; y++) buf.rect(70 - (34 - y), y, (34 - y) * 2, 1, kit.withAlpha(P.holo3, 0.45));
  buf.set(58, 34, P.red);
  buf.set(81, 34, P.red);
  lamps.push([58, 34], [81, 34], [70, 30]);
  return { buf, lamps };
}
