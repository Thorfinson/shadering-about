// The movers of neon-os.html, and the view from the den:
//
//   car.<agent>.fly0/1   the agents: hover cars, each glowing underneath in the
//                        agent's colour; frame 1 flickers the thrusters
//   ice.head             the villain: ICE, a black mask with red eyes
//   blimp.ad             a blimp with a screen, crossing the sky
//   koi.swim0/1          a hologram koi the size of a building, drifting
//   den.window           the corner vignette: a hacker at three screens, a cat,
//                        the rain on the window and the city beyond

export default function generate(kit) {
  return [cars(kit), ice(kit), blimp(kit), koi(kit), den(kit)];
}

function cars(kit) {
  const { P, paint, rampSoft, inPoly } = kit;
  const agents = { kade: P.research, nyx: P.analyze, juno: P.build, rook: P.model, vex: P.test, sable: P.deploy, echo: P.remember };
  const BODY = [P.car0, P.car1, P.car2, P.car3];
  const frames = [];
  const shell = [[1, 8], [4, 5], [10, 3.5], [18, 3], [24, 4.5], [27, 6.5], [27, 9], [2, 10]];
  const glass = [[11, 4.5], [18, 4], [22, 5.5], [13, 6.2]];
  for (const [id, glow] of Object.entries(agents)) {
    for (const f of [0, 1]) {
      const buf = paint(28, 14, (x, y) => {
        const px = x + 0.5, py = y + 0.5;
        if (inPoly(px, py, glass)) return py < 5 ? P.holo3 : P.holo1;
        if (inPoly(px, py, shell)) {
          if (x === 26 && y >= 6 && y <= 7) return P.white; // headlight
          if (x <= 2 && y >= 8 && y <= 9) return P.red; // tail light
          if (y === 7 && x > 4 && x < 24) return kit.mixHex(glow, P.car1, 0.4); // the pinstripe
          return rampSoft(BODY, 0.8 - (py - 3) / 8 - px / 90, x, y, 2);
        }
        // the underglow and the thrusters beneath
        if (y === 10 && x > 3 && x < 25) return glow;
        if (y === 11 && x > 5 && x < 23) return f ? kit.withAlpha(glow, 0.6) : kit.withAlpha(glow, 0.35);
        if (y >= 11 && y <= 12 + f && (x === 7 || x === 21)) return f ? P.lamp : P.neonAmber;
        return null;
      });
      frames.push({ name: `${id}.fly${f}`, buf });
    }
  }
  return { sprite: 'car', frames, meta: { lamp: [26, 6], port: [26, 7] } };
}

// ICE: a mask of black code, split by glitches, two red eyes.
function ice(kit) {
  const { P, paint, hash2 } = kit;
  const buf = paint(30, 30, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    const dx = Math.abs(px - 15);
    // an angular mask: wide brow, narrowing to a pointed chin
    const half = py < 12 ? 13 - (12 - py) * 0.6 : 13 - (py - 12) * 0.62;
    if (dx > half || py < 3 || py > 29) return null;
    if (Math.abs(py - 13) < 2.2 && dx > 3 && dx < 9) return dx > 7.5 ? P.ice2 : P.iceRed; // the eyes
    if (py > 20 && dx < 5 && (x + y) % 3 === 0) return P.iceRed; // a grille of a mouth
    if (hash2(0, y, 3) < 0.18 && hash2(x, y, 4) < 0.6) return hash2(x, y, 5) < 0.5 ? P.iceRed : P.pearl; // glitch rows
    if (dx > half - 1.2) return P.ice2;
    return (x + y * 2) % 7 === 0 ? P.ice2 : py < 12 ? P.ice1 : P.ice0;
  }).padded(1).outline('auto');
  return { sprite: 'ice', frames: [{ name: 'head', buf }], meta: { roots: [[9, 25], [12, 28], [16, 30], [20, 28], [23, 25]], eyes: [[10, 14], [21, 14]] } };
}

// A blimp with an advertising screen on its flank.
function blimp(kit) {
  const { P, paint, rampSoft } = kit;
  const buf = paint(56, 20, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    const e = Math.hypot((px - 28) / 26, (py - 9) / 8);
    if (px > 22 && px < 34 && py > 16 && py < 19.5) return py < 17 ? P.steel2 : P.steel1; // the gondola
    if (px > 22 && px < 34 && py > 17 && py < 18.5 && x % 3 === 0) return P.winWarm;
    if (e > 1) {
      if (px < 5 && Math.abs(py - 9) < 5 - px) return P.car1; // the fins
      return null;
    }
    if (px > 12 && px < 44 && py > 5 && py < 13) return (x + Math.floor(y / 2)) % 5 < 3 ? P.neonPink : P.neonCyan; // the screen
    return rampSoft([P.car0, P.car1, P.car2, P.car3], 0.75 - (py - 1) / 16, x, y, 3);
  });
  return { sprite: 'blimp', frames: [{ name: 'ad', buf }], meta: {} };
}

// A hologram koi, swimming through the air over the city.
function koi(kit) {
  const { P, paint, inPoly, withAlpha } = kit;
  return {
    sprite: 'koi',
    frames: [0, 1].map((f) => {
      const tail = f ? [[8, 9], [2, 4], [0, 6], [3, 10], [0, 15], [2, 16]] : [[8, 9], [2, 6], [0, 9], [3, 11], [1, 16], [4, 15]];
      const body = [[46, 10], [44, 6], [38, 4], [28, 4], [18, 6], ...tail, [18, 14], [28, 16], [38, 15.5], [44, 13]];
      const fin = [[28, 15], [32, 20], [35, 15]];
      const inside = (qx, qy) => inPoly(qx, qy, body) || inPoly(qx, qy, fin);
      return {
        name: `swim${f}`,
        buf: paint(48, 22, (x, y) => {
          const px = x + 0.5, py = y + 0.5;
          if (!inside(px, py)) return null;
          const edge = !inside(px, py - 1) || !inside(px, py + 1) || !inside(px - 1, py) || !inside(px + 1, py);
          if (x === 42 && y === 8) return P.white;
          if (edge) return withAlpha(P.neonPink2, 0.9);
          const spot = Math.hypot(px - 30, py - 8) < 4 || Math.hypot(px - 20, py - 11) < 3;
          return withAlpha(spot ? P.neonPink : y % 2 ? P.holo3 : P.holo2, spot ? 0.7 : y % 2 ? 0.55 : 0.35);
        }),
      };
    }),
    meta: {},
  };
}

// The den: a hacker at three screens, a cat asleep on the desk, a ramen cup,
// the rain on the window and the city beyond.
function den(kit) {
  const { P, paint, rampSoft, inPoly, hash2, vnoise } = kit;
  const w = 180, h = 236;
  const lamp = [96, 148]; // the middle screen: the light in this room
  const hacker = [[46, 236], [50, 186], [60, 172], [90, 170], [102, 186], [106, 236]];
  const hood = (qx, qy) => Math.hypot((qx - 76) / 13, (qy - 164) / 14) <= 1;
  const inHacker = (qx, qy) => inPoly(qx, qy, hacker) || hood(qx, qy);
  const buf = paint(w, h, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    // the hacker, hooded, seen from behind, in front of the desk, lit by the screens
    if (inHacker(px, py)) {
      const toLight = !inHacker(px + 1.5, py) || !inHacker(px, py - 1.5);
      if (toLight) return hood(px, py) ? P.holo2 : P.holo1;
      return rampSoft([P.coat0, P.coat1, P.coat2], 0.4 + (px - 60) / 100 - (py - 164) / 300, x, y, 4);
    }
    // three screens on the desk, green and cyan text
    for (const [sx, sy, sw, sh, col] of [[62, 120, 30, 22, P.neonCyan], [96, 116, 38, 26, P.neonGreen], [138, 122, 28, 20, P.neonPink]]) {
      if (px >= sx && px < sx + sw && py >= sy && py < sy + sh) {
        if (px < sx + 1.5 || px > sx + sw - 1.5 || py < sy + 1.5 || py > sy + sh - 1.5) return P.steel1;
        const line = Math.floor((py - sy - 2) / 2);
        return (py - sy) % 2 < 1 && px < sx + 4 + ((line * 7) % (sw - 8)) ? col : kit.mixHex(col, P.ink, 0.82);
      }
      if (px >= sx + sw / 2 - 2 && px < sx + sw / 2 + 2 && py >= sy + sh && py < 150) return P.steel0;
    }
    // the desk, a keyboard's glow, a cat, a ramen cup
    if (py >= 150 && py < 158) {
      if (px > 104 && px < 132 && py < 153) return (x % 2) ? P.neonCyan : P.holo1;
      if (Math.hypot((px - 150) / 12, (py - 150) / 5) < 1 && py < 152) return rampSoft([P.ink2, P.coat1, P.conc3], 0.5 - (px - 140) / 30, x, y, 5); // the cat
      if (px > 30 && px < 40 && py < 156) return py < 152 ? P.pearl : P.neonPink;
      return py < 151 ? P.steel2 : rampSoft([P.car0, P.car1, P.car2], 0.4, x, y, 6);
    }
    if (py >= 158) return rampSoft([P.ink, P.ink2, P.car0], 0.3 + (py - 158) / 300, x, y, 7);
    // the window: rain on the glass, the city beyond, a pink sign's glow
    if (px > 10 && px < 170 && py > 16 && py < 116) {
      if (px < 12 || px > 168 || py < 18 || py > 114 || Math.abs(px - 90) < 1) return P.steel1;
      const rain = hash2(x, Math.floor((y + x * 0.3) / 5), 9) < 0.06;
      const sky = rampSoft([P.night1, P.night2, P.night3, P.smog], (py - 18) / 110, x, y, 10);
      let c = sky;
      for (const [bx, bw, bh] of [[14, 22, 60], [38, 18, 80], [58, 26, 46], [92, 20, 72], [114, 30, 54], [146, 22, 84]]) {
        if (px >= bx && px < bx + bw && py > 114 - bh) {
          c = (x - bx) % 3 === 1 && (y % 4 === 1) && hash2(x, y, 11) < 0.45 ? [P.winWarm, P.winCool, P.winPink][Math.floor(hash2(x >> 2, y, 12) * 3)] : P.night1;
          if (bx === 58 && py > 70 && py < 96 && px > bx + 8 && px < bx + 14) c = (y % 3) ? P.neonPink : P.neonPink2; // a vertical sign
        }
      }
      return rain ? kit.mixHex(c, P.holo3, 0.5) : c;
    }
    // the wall, pinned with printouts, cables down it
    if (py > 30 && py < 60 && px < 8 && (y % 10) < 7) return P.pearlD;
    if (Math.abs(px - 176 + Math.sin(py * 0.05) * 2) < 1) return P.car1;
    return rampSoft([P.ink, P.ink2, P.night1], 0.4 + (hash2(x >> 3, y >> 3, 13) - 0.5) * 0.2, x, y, 14);
  });
  return { sprite: 'den', frames: [{ name: 'window', buf }], meta: { lamp } };
}
