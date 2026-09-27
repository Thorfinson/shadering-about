// Procedural sprites for nautilus-agents.html — the big set pieces that would be
// tedious to draw by hand. Each generator paints onto a PixelBuffer (see
// tools/pixelkit.mjs) using only palette colours, and may return `meta`: anchor
// points the page needs at runtime (airlock, lantern, shelf books, tablet slots…).
// Meta coordinates are in the sprite's own pixel space, outline included.
//
// Run `npm run sprites` after editing; the build packs everything into
// assets/nautilus/atlas.{png,json,js}.

export default function generate(kit) {
  return [
    nautilus(kit),
    library(kit),
    atlantis(kit),
    galleon(kit),
    clam(kit),
    kraken(kit),
    shark(kit),
    coral(kit),
    rocks(kit),
  ];
}

// Paints a w×h sprite with a 1px margin and outlines it; fn sees unpadded coords.
function framed(kit, w, h, fn) {
  return kit.paint(w + 2, h + 2, (x, y) => {
    const px = x - 1;
    const py = y - 1;
    return px < 0 || py < 0 || px >= w || py >= h ? null : fn(px, py);
  }).outline(kit.P.ink);
}
const pad = ([x, y]) => [x + 1, y + 1];

// ------------------------------------------------------------ Nautilus ----
// Iron cigar hull with riveted plates, the salon window (organ inside), the
// pilot house, the searchlight, the ram, and the airlock the divers use.
function nautilus(kit) {
  const { P, paint, rampPick, inPoly } = kit;
  const W = 140;
  const H = 44;
  const cy = 25;
  const x0 = 17;
  const x1 = 119;
  const tip = 137;
  const IRON = [P.iron0, P.iron1, P.iron2, P.iron3, P.iron4];
  const hullH = (x) => {
    if (x < x0 || x > x1) return 0;
    return 11 * Math.pow(Math.sin((Math.PI * (x - x0)) / (x1 - x0)), 0.62);
  };
  const rudder = [[9, cy - 13], [14, cy - 13], [25, cy - 3], [25, cy + 3], [14, cy + 13], [9, cy + 13], [12, cy]];
  const fin = [[97, cy + 5], [109, cy + 4], [106, cy + 10], [99, cy + 10]];

  const buf = paint(W, H, (x, y) => {
    const hh = hullH(x);
    if (hh > 0.6) {
      const top = cy - hh;
      const bot = cy + hh * 0.92;
      const py = y + 0.5;
      if (py >= top && py <= bot) {
        let v = 0.56 - 0.42 * ((py - cy) / hh);
        if (py - top < 1.2) v += 0.28;
        if (bot - py < 1.2) v -= 0.25;
        const seam1 = Math.round(cy - hh * 0.45);
        const seam2 = Math.round(cy + hh * 0.4);
        if ((x - x0) % 13 === 0 || y === seam1 || y === seam2) v -= 0.24;
        else if (y === seam1 - 1 && x % 3 === 0) v += 0.4; // rivets
        return rampPick(IRON, v, x, y);
      }
    }
    if (x >= x1 - 5 && x <= tip) {
      const th = 3 * (1 - (x - (x1 - 5)) / (tip - x1 + 5));
      const dy = y - cy;
      if (Math.abs(dy) <= th) return dy < 0 ? P.iron4 : dy === 0 ? P.iron3 : P.iron2;
      if (dy === Math.floor(th) + 1 && x % 4 === 0 && x < tip - 5) return P.iron2; // teeth
    }
    if (inPoly(x + 0.5, y + 0.5, fin)) return y < cy + 7 ? P.iron2 : P.iron1;
    if (inPoly(x + 0.5, y + 0.5, rudder)) {
      if (y === cy) return P.iron1;
      return rampPick([P.iron1, P.iron2, P.iron3], 0.62 - (y - cy) / 28, x, y);
    }
    return null;
  });

  // Raised platform with brass rail posts, and the dinghy set into it.
  for (let x = 55; x <= 82; x++) {
    buf.set(x, cy - 12, P.iron3);
    buf.set(x, cy - 11, P.iron2);
    if (x % 4 === 0) buf.set(x, cy - 13, P.brass2);
  }
  for (let x = 59; x <= 69; x++) buf.set(x, cy - 13, P.wood2);
  for (let x = 61; x <= 67; x++) buf.set(x, cy - 14, P.wood3);

  // Pilot house with lenticular windows, and Nemo's black flag.
  for (let y = cy - 18; y <= cy - 13; y++) {
    for (let x = 75; x <= 85; x++) {
      if (y === cy - 18 && (x === 75 || x === 85)) continue;
      buf.set(x, y, y === cy - 18 ? P.brass2 : x === 75 ? P.iron3 : x === 85 ? P.iron1 : P.iron2);
    }
  }
  const windows = [[77, cy - 16], [81, cy - 16]];
  for (const [wx, wy] of windows) buf.rect(wx, wy, 2, 2, P.lamp);
  for (let y = cy - 23; y <= cy - 19; y++) buf.set(80, y, P.iron3);
  buf.rect(81, cy - 23, 5, 3, P.ink2);
  buf.set(83, cy - 22, P.brass3);

  // Searchlight housing.
  for (let y = cy - 13; y <= cy - 10; y++) {
    for (let x = 91; x <= 97; x++) {
      if (y === cy - 13 && (x === 91 || x === 97)) continue;
      buf.set(x, y, P.brass2);
    }
  }
  buf.rect(93, cy - 12, 4, 2, P.lamp);
  buf.set(97, cy - 12, P.white);
  buf.set(97, cy - 11, P.lamp);

  // The great salon window — Nemo's organ pipes behind the glass.
  for (let y = cy - 4; y <= cy + 6; y++) {
    for (let x = 52; x <= 68; x++) {
      const dx = (x + 0.5 - 60.5) / 6.5;
      const dy = (y + 0.5 - (cy + 1.5)) / 4.2;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      if (d > 0.55) buf.set(x, y, dy < 0 || dx < -0.3 ? P.brass3 : P.brass1);
      else buf.set(x, y, rampPick([P.ink2, P.glassD, P.glass], 0.25 + 0.35 * (1 - d) - dy * 0.2, x, y));
    }
  }
  for (const [px, ph] of [[57, 2], [59, 3], [61, 4], [63, 3]]) {
    for (let k = 0; k < ph; k++) buf.set(px, cy + 4 - k, P.brass2);
  }

  // Portholes.
  const ports = [30, 40, 74, 84, 94, 105];
  const ring = [[0, 0], [1, 0], [-1, 1], [2, 1], [-1, 2], [2, 2], [0, 3], [1, 3]];
  for (const px of ports) {
    for (const [dx, dy] of ring) buf.set(px + dx, cy + dy, P.brass2);
    buf.rect(px, cy + 1, 2, 2, P.lamp);
  }

  // Airlock hatch on the belly.
  for (let x = 58; x <= 64; x++) buf.set(x, cy + 9, P.brass1);
  buf.set(58, cy + 8, P.brass2);
  buf.set(64, cy + 8, P.brass2);

  buf.outline(P.ink);
  return {
    sprite: 'nautilus',
    frames: [{ name: 'hull', buf }],
    meta: {
      cy,
      airlock: [61, cy + 10],
      lantern: [98, cy - 11],
      portholes: ports.map((x) => [x, cy + 1]),
      windows,
      prop: [8, cy],
    },
  };
}

// ------------------------------------------------------ Sunken library ----
// A classical ruin with an arched opening onto three shelves of books.
function library(kit) {
  const { P, rampPick, hash2, mulberry32 } = kit;
  const w = 66;
  const h = 58;
  const baseTop = 51;
  const rng = mulberry32(11);
  const archTop = (x) => 26 - Math.sqrt(Math.max(0, 400 - (x - 32.5) ** 2)) * 0.74;
  const inOpen = (x, y) => x >= 13 && x <= 52 && y >= archTop(x) && y < baseTop;
  const SHELVES = [29, 38, 47];
  const BOOKC = [P.coral1, P.kelp2, P.vio2, P.brass2, P.glassD, P.coral0, P.wood3, P.paper, P.iron3, P.vio3];
  const books = SHELVES.map((sy) => {
    const list = [];
    let x = 14;
    while (x <= 51) {
      if (rng() < 0.1) {
        x += 1 + ((rng() * 2) | 0);
        continue;
      }
      const bw = rng() < 0.35 ? 2 : 1;
      const bh = 4 + ((rng() * 3) | 0);
      if (x + bw - 1 > 51) break;
      list.push({ x, w: bw, h: bh, top: sy - bh, col: BOOKC[(rng() * BOOKC.length) | 0], band: rng() < 0.5 });
      x += bw;
    }
    return list;
  });
  const bookAt = (x, y) => {
    for (let s = 0; s < SHELVES.length; s++) {
      if (y >= SHELVES[s] || y < SHELVES[s] - 7) continue;
      for (const b of books[s]) if (x >= b.x && x < b.x + b.w && y >= b.top) return b;
    }
    return null;
  };
  const fallen = [[20, 3, P.coral1], [40, 4, P.kelp2]];

  const buf = framed(kit, w, h, (x, y) => {
    // cornice, its right corner broken away
    if (y >= 4 && y <= 8) {
      if (x > 57 && y - 4 < (x - 57) * 0.8) return null;
      if (y === 4) return P.stone4;
      if (y === 8) return P.stone1;
      if (y === 6 && x % 3 === 0) return P.stone1; // dentils
      return rampPick([P.stone2, P.stone3], 0.55, x, y);
    }
    if (y >= 9 && y < baseTop && x >= 2 && x <= 63) {
      if (inOpen(x, y)) {
        if (SHELVES.includes(y)) return P.wood2;
        if (SHELVES.includes(y - 1)) return P.wood0;
        if (y === baseTop - 1) {
          for (const [fx, fw, fc] of fallen) if (x >= fx && x < fx + fw) return fc;
        }
        const b = bookAt(x, y);
        if (b && y >= archTop(x) + 1) {
          if (b.band && y === b.top + 2) return P.brass3;
          return b.col;
        }
        return rampPick([P.ink2, P.stone0], 0.3 + 0.35 * ((y - archTop(x)) / 30), x, y);
      }
      if (inOpen(x, y + 1) || inOpen(x - 1, y) || inOpen(x + 1, y)) return P.stone4; // voussoirs
      const row = Math.floor((y - 9) / 4);
      const off = (row & 1) * 4;
      if ((y - 9) % 4 === 3 || (x + off) % 8 === 0) return P.stone0; // mortar
      if (y > 40 && hash2(x, y, 4) < 0.07) return P.kelp1;
      const bv = hash2((x + off) >> 3, row, 5);
      return rampPick([P.stone1, P.stone2, P.stone3], 0.25 + bv * 0.5 + (y < 14 ? 0.15 : 0), x, y);
    }
    if (y >= baseTop) {
      if (y === baseTop) return P.stone3;
      if ((y - baseTop) % 3 === 0 || (x + (y > baseTop + 3 ? 5 : 0)) % 10 === 0) return P.stone0;
      return rampPick([P.stone1, P.stone2], 0.5, x, y);
    }
    return null;
  });

  // A crack down the left pier, and weed on the cornice.
  let cx = 6;
  for (let y = 12; y < 34; y++) {
    cx += hash2(y, 1, 4) < 0.33 ? -1 : hash2(y, 2, 4) < 0.5 ? 1 : 0;
    cx = Math.max(4, Math.min(9, cx));
    buf.set(cx + 1, y + 1, P.stone0);
  }
  for (const tx of [6, 21, 44, 51]) {
    const len = 3 + (tx % 3);
    for (let k = 0; k < len; k++) buf.set(tx + 1 + (k % 2), 4 - k, k % 2 ? P.kelp3 : P.kelp2);
  }

  return {
    sprite: 'library',
    frames: [{ name: 'ruin', buf }],
    meta: {
      // per shelf: [x, y, w, h] of every book, so the page can light the one being read
      shelves: books.map((list) => list.map((b) => [b.x + 1, b.top + 1, b.w, b.h])),
    },
  };
}

// ------------------------------------------------------------ Atlantis ----
// A stepped temple with a glowing doorway. The page stands file tablets on its
// steps at the slots listed in meta.
function atlantis(kit) {
  const { P, rampPick, hash2 } = kit;
  const w = 122;
  const h = 68;
  const COLS = [19, 36, 53, 69, 86, 103];
  const BROKEN = { 1: 31, 5: 26 };

  const buf = framed(kit, w, h, (x, y) => {
    // steps
    const steps = [[0, 121, 62], [6, 115, 56], [12, 109, 50]];
    for (const [sx0, sx1, sy] of steps) {
      if (x < sx0 || x > sx1 || y < sy || y > sy + 5) continue;
      if (y === sy) return hash2(x, y, 6) < 0.06 ? P.kelp2 : P.stone4;
      if (y === sy + 1) return P.stone3;
      if ((x + (sy >> 1)) % 11 === 0) return P.stone1;
      return rampPick([P.stone1, P.stone2], 0.6 - (y - sy) * 0.07, x, y);
    }
    // fallen column drum
    {
      const dx = (x + 0.5 - 113) / 4.2;
      const dy = (y + 0.5 - 53.5) / 2.6;
      if (dx * dx + dy * dy <= 1) return x === 110 ? P.stone1 : rampPick([P.stone2, P.stone3], 0.6 - dy * 0.4, x, y);
    }
    // columns
    for (let i = 0; i < COLS.length; i++) {
      const dx = x - COLS[i];
      if (Math.abs(dx) > 3) continue;
      if (y >= 48 && y <= 49) return y === 48 ? P.stone3 : P.stone2; // base
      if (!BROKEN[i] && y >= 17 && y <= 19) return y === 17 ? P.stone4 : P.stone3; // capital
      const top = BROKEN[i] ? BROKEN[i] + ((x * 5 + i) % 3) : 20;
      if (Math.abs(dx) <= 2 && y >= top && y < 48) {
        if (y > 36 && hash2(x, y, 9) < 0.08) return P.kelp1;
        if (dx === 0 && y % 3 === 0) return P.stone2; // flutes
        return [P.stone4, P.stone3, P.stone3, P.stone2, P.stone1][dx + 2];
      }
    }
    // architrave
    if (y >= 12 && y <= 16 && x >= 10 && x <= 94) {
      if (y === 12) return P.stone4;
      if (y === 16) return P.stone1;
      if (x % 6 < 2) return P.stone1; // triglyphs
      return P.stone3;
    }
    // pediment with a trident relief; the right side has fallen
    if (y >= 2 && y <= 11 && x >= 10 && x <= 94) {
      const half = (y - 2) * 4.6;
      if (Math.abs(x - 52) <= half && x <= 74 + ((y * 7) % 4) + (11 - y)) {
        if (Math.abs(x - 52) >= half - 1.2 || y === 11) return P.stone4;
        const trident = (x === 52 && y >= 5) || ((x === 50 || x === 54) && y >= 5 && y <= 7) || (y === 7 && x >= 50 && x <= 54);
        return trident ? P.stone4 : rampPick([P.stone1, P.stone2], 0.55, x, y);
      }
    }
    // cella wall and its glowing doorway
    if (x >= 22 && x <= 99 && y >= 17 && y < 50) {
      const doorTop = 30 + ((x - 60) * (x - 60)) / 12;
      if (x >= 53 && x <= 67 && y >= doorTop) {
        return rampPick([P.glassD, P.glass, P.glow], 0.15 + ((y - 30) / 20) * 0.75 - Math.abs(x - 60) * 0.05, x, y);
      }
      if ((y - 17) % 5 === 4 || (x + ((Math.floor((y - 17) / 5) & 1) * 5)) % 10 === 0) return P.ink2;
      return rampPick([P.ink2, P.stone0, P.stone1], 0.35 + hash2(x >> 2, y >> 2, 3) * 0.2, x, y);
    }
    return null;
  });

  const rowA = [0, 1, 2, 3, 4, 5].map((i) => pad([13 + i * 18, 43]));
  const rowB = [0, 1, 2, 3, 4, 5].map((i) => pad([22 + i * 18, 49]));
  return {
    sprite: 'atlantis',
    frames: [{ name: 'temple', buf }],
    meta: { slots: [...rowA, ...rowB], door: pad([60, 40]) },
  };
}

// ----------------------------------------------------- Vigo Bay galleon ----
// A tilted, half-buried wreck: planked hull, stern castle, broken mast and a
// tattered sail. Drawn in the ship's own frame, then rotated pixel by pixel.
function galleon(kit) {
  const { P, rampPick, hash2 } = kit;
  const w = 88;
  const h = 64;
  const th = -0.14;
  const cs = Math.cos(th);
  const sn = Math.sin(th);
  const ox = 8;
  const oy = 44;
  const deckV = (u) => (u < 16 ? -9 : u > 62 ? -(u - 62) * 0.55 : 0);
  const keelV = (u) => {
    const k = (u - 36) / 39;
    return k * k >= 1 ? -99 : 14 * Math.sqrt(1 - k * k);
  };
  const holes = [[46, 7, 6, 3.2], [20, 9, 4, 2.4]];

  const buf = framed(kit, w, h, (x, y) => {
    const px = x - ox + 0.5;
    const py = y - oy + 0.5;
    const u = px * cs + py * sn;
    const v = -px * sn + py * cs;
    if (u >= 38 && u < 40.6 && v < deckV(u) && v > -29 + hash2(Math.floor(u), 0, 3) * 3) {
      return u < 39.3 ? P.wood3 : P.wood1; // mast
    }
    if (v >= -26 && v < -24.8 && u >= 29 && u <= 50) return P.wood1; // yard
    if (u >= 31 && u <= 48 && v >= -24.8 && v <= -13 - 3 * hash2(Math.floor(u), 1, 5)) {
      if (hash2(Math.floor(u / 2), Math.floor(v / 2), 8) < 0.16) return null; // sail holes
      return rampPick([P.pearlD, P.paper], 0.4 + (u - 31) / 30, x, y);
    }
    const dv = deckV(u);
    if (u >= 0 && u <= 75 && v >= dv - 1 && v <= keelV(u)) {
      if (v < dv) return P.wood3; // rail
      for (const [hu, hv, ru, rv] of holes) {
        if (((u - hu) / ru) ** 2 + ((v - hv) / rv) ** 2 < 1) return Math.floor(u) % 4 === 0 ? P.wood1 : P.ink2;
      }
      if (u < 16 && v > -7 && v < -5 && Math.floor(u) % 4 >= 1 && Math.floor(u) % 4 <= 2) return P.brass1;
      if (v > 3 && v < 5.5 && u > 22 && u < 58 && Math.floor(u) % 8 < 2) return P.ink2; // gun ports
      const pv = v - dv;
      if (pv % 3 < 0.7) return P.wood0; // plank seams
      if (hash2(Math.floor(u / 3), Math.floor(pv / 3), 2) < 0.06) return P.kelp1;
      const stagger = (Math.floor((u + Math.floor(pv / 3) * 5) / 12) % 2) * 0.1;
      return rampPick([P.wood1, P.wood2, P.wood3], 0.55 - v / 40 - stagger, x, y);
    }
    return null;
  });

  return { sprite: 'galleon', frames: [{ name: 'wreck', buf }], meta: {} };
}

// ------------------------------------------------------ Giant clam ----
// Four frames of the lid opening around its hinge. The pearl is drawn by the
// page so it can grow with every memory stored.
function clam(kit) {
  const { P, rampPick } = kit;
  const w = 26;
  const h = 24;
  const cx = 13;
  const cy = 18;
  const hx = 2;
  const frames = [0, 0.24, 0.48, 0.72].map((a, i) => {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const buf = framed(kit, w, h, (x, y) => {
      const px = x + 0.5;
      const py = y + 0.5;
      let dx = (px - cx) / 11.5;
      let dy = (py - cy) / 5.2;
      if (dy >= 0 && dx * dx + dy * dy <= 1) {
        if (py - cy < 1) return x % 3 === 0 ? P.glass : P.glow; // mantle lip
        return rampPick([P.stone2, P.stone3, P.pearlD], 0.7 - dy * 0.6 - (x % 3 === 0 ? 0.25 : 0), x, y);
      }
      // undo the lid's rotation about the hinge and test the closed shape
      const rx = hx + (px - hx) * ca - (py - cy) * sa;
      const ry = cy + (px - hx) * sa + (py - cy) * ca;
      dx = (rx - cx) / 11.5;
      dy = (ry - cy) / 4.6;
      if (dy < 0 && dx * dx + dy * dy <= 1) {
        return rampPick([P.stone3, P.pearlD, P.pearl], 0.55 - dy * 0.35 - (Math.floor(rx) % 3 === 0 ? 0.3 : 0), x, y);
      }
      if (a > 0 && py < cy && ry > cy && px > hx && rx < cx + 11.5) {
        return rampPick([P.ink2, P.glassD], 0.3 + (cy - py) / 12, x, y); // open mouth
      }
      return null;
    });
    return { name: `open${i}`, buf };
  });
  return { sprite: 'clam', frames, meta: { pearl: pad([13, cy - 2]) } };
}

// ------------------------------------------------------------- Kraken ----
// Head and mantle only; the page animates the tentacles from meta.roots.
function kraken(kit) {
  const { P, rampPick, hash2 } = kit;
  const w = 28;
  const h = 36;
  const cx = 13.5;
  const halfW = (y) => {
    let hw = 0;
    if (y <= 25) hw = 7.2 * Math.pow(Math.sin(Math.PI * Math.min(1, (y + 1.5) / 30)), 0.85);
    if (y >= 1 && y <= 10) hw = Math.max(hw, 12.5 * (1 - Math.abs(y - 5.5) / 5)); // fins
    if (y >= 23 && y <= 34) hw = Math.max(hw, 9 - (y - 23) * 0.35); // head
    return hw;
  };
  const buf = framed(kit, w, h, (x, y) => {
    const dx = x + 0.5 - cx;
    const hw = halfW(y);
    if (Math.abs(dx) > hw) return null;
    for (const ex of [7, 18]) {
      if (x >= ex && x <= ex + 2 && y >= 27 && y <= 29) return x === ex + 1 ? P.red : P.brass3;
    }
    const edge = hw - Math.abs(dx);
    let v = 0.5 - dx / 22 + (y < 23 ? 0.1 : 0);
    if (edge < 1) v -= 0.2;
    if (edge > 1.5 && hash2(x >> 1, y >> 1, 12) < 0.12) return P.vio3; // spots
    return rampPick([P.vio0, P.vio1, P.vio2], v, x, y);
  });
  return {
    sprite: 'kraken',
    frames: [{ name: 'head', buf }],
    meta: {
      roots: [[7, 33], [10, 34], [13, 34], [16, 34], [19, 33], [21, 32], [5, 32]].map(pad),
      eyes: [pad([8, 28]), pad([19, 28])],
    },
  };
}

// -------------------------------------------------------------- Shark ----
// A single-colour silhouette for the far water.
function shark(kit) {
  const { P, paint, inPoly } = kit;
  const dorsal = [[12, 4], [16, 0], [18, 4]];
  const tail = [[0, 0], [6, 5], [6, 7], [0, 11], [2, 6]];
  const pectoral = [[17, 8], [14, 11], [20, 8]];
  const buf = paint(30, 12, (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    if (x >= 3 && x <= 28) {
      const u = (x - 3) / 25;
      const hh = 3.4 * Math.pow(Math.sin(Math.PI * Math.min(u, 0.98)), 0.6);
      if (py >= 6 - hh && py <= 6 + hh * 0.8) return P.water1;
    }
    if (inPoly(px, py, dorsal) || inPoly(px, py, tail) || inPoly(px, py, pectoral)) return P.water1;
    return null;
  });
  return { sprite: 'shark', frames: [{ name: 'far', buf }], meta: {} };
}

// -------------------------------------------------------------- Decor ----
function coral(kit) {
  const { P, PixelBuffer, mulberry32, rampPick, hash2 } = kit;
  const branch = (seed, ramp) => {
    const rng = mulberry32(seed);
    const b = new PixelBuffer(16, 18);
    const grow = (x, y, ang, len, depth) => {
      for (let i = 0; i < len; i++) {
        x += Math.cos(ang);
        y += Math.sin(ang);
        b.set(x, y, depth < 2 ? ramp[1] : ramp[2]);
        if (depth === 0) b.set(x + 1, y, ramp[0]);
      }
      if (depth < 3) {
        grow(x, y, ang - 0.5 - rng() * 0.3, len * 0.72, depth + 1);
        grow(x, y, ang + 0.4 + rng() * 0.3, len * 0.66, depth + 1);
      } else {
        b.set(x, y - 1, ramp[3]);
      }
    };
    grow(8, 17, -Math.PI / 2 + (rng() - 0.5) * 0.3, 5, 0);
    return b.padded(1).outline(P.ink);
  };
  const brain = framed(kit, 12, 7, (x, y) => {
    const dx = (x + 0.5 - 6) / 6;
    const dy = (y + 0.5 - 7) / 7;
    if (dx * dx + dy * dy > 1) return null;
    if (Math.sin(x * 1.3 + Math.sin(y * 1.7) * 2) > 0.55) return P.coral2;
    return rampPick([P.coral0, P.coral1], 0.7 + dy * 0.6, x, y);
  });
  const fan = framed(kit, 13, 12, (x, y) => {
    const dx = x + 0.5 - 6.5;
    const dy = 12 - (y + 0.5);
    const r = Math.hypot(dx, dy);
    if (r > 11.5 || dy < 0.5 || Math.abs(dx) > dy * 1.1 + 1) return null;
    const ang = Math.atan2(dx, dy);
    if (Math.abs(((ang * 9) % 1 + 1) % 1 - 0.5) < 0.18 || Math.abs((r % 3) - 1.5) < 0.4) {
      return r > 9 ? P.vio3 : P.vio2;
    }
    return hash2(x, y, 2) < 0.25 ? P.vio1 : null;
  });
  return {
    sprite: 'coral',
    frames: [
      { name: 'branch0', buf: branch(3, [P.coral0, P.coral1, P.coral2, P.coral3]) },
      { name: 'branch1', buf: branch(9, [P.vio1, P.vio2, P.vio3, P.pearl]) },
      { name: 'branch2', buf: branch(21, [P.brass1, P.brass2, P.brass3, P.lamp]) },
      { name: 'brain', buf: brain },
      { name: 'fan', buf: fan },
    ],
    meta: {},
  };
}

function rocks(kit) {
  const { P, rampPick, hash2 } = kit;
  const frames = [[11, 6, 1], [7, 4, 2], [15, 7, 3]].map(([w, h, s], i) => ({
    name: `r${i}`,
    buf: framed(kit, w, h, (x, y) => {
      const dx = (x + 0.5 - w / 2) / (w / 2);
      const dy = (y + 0.5 - h) / h;
      const wob = 0.12 * Math.sin(x * 1.7 + s);
      if (dx * dx + dy * dy > 1 + wob) return null;
      if (hash2(x, y, s) < 0.08) return P.kelp1;
      return rampPick([P.stone0, P.stone1, P.stone2, P.stone3], 0.75 - (y / h) * 0.6 - dx * 0.15, x, y);
    }),
  }));
  return { sprite: 'rock', frames, meta: {} };
}
