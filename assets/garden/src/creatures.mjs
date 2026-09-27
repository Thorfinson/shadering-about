// The living things of hortus-os.html, and the view from the potting shed:
//
//   bee.<agent>.fly0/1   the agents: bumblebees in the agent's scarf, each with a
//                        little lantern hung beneath it for the dusk
//   butterfly.<kind>.*   ambient butterflies, wings open and closed
//   bramble.head         the villain: a knot of thorns with berry eyes
//   shed.window          the corner vignette: Weatherstaff and Mary in the
//                        potting shed, a lamp between them, the garden outside

export default function generate(kit) {
  return [bees(kit), butterflies(kit), bramble(kit), shed(kit)];
}

function bees(kit) {
  const { P, paint, withAlpha, hash2 } = kit;
  const agents = { mary: P.research, colin: P.analyze, dickon: P.build, martha: P.model, susan: P.test, robin: P.deploy, soot: P.remember };
  const frames = [];
  for (const [id, scarf] of Object.entries(agents)) {
    for (const f of [0, 1]) {
      const buf = paint(18, 16, (x, y) => {
        const px = x + 0.5, py = y + 0.5;
        // wings first, behind the body: translucent, veined
        const wy = f ? 5.2 : 3;
        for (const [wx, rx, ry] of [[7, 3.4, f ? 1.6 : 2.6], [10.5, 3, f ? 1.4 : 2.3]]) {
          const d = Math.hypot((px - wx) / rx, (py - wy) / ry);
          if (d <= 1 && py < 8) return d > 0.75 ? withAlpha(P.white, 0.85) : withAlpha(P.wing, 0.5);
        }
        // the head, with an eye and antennae
        const hd = Math.hypot(px - 13.5, py - 8.5);
        if (hd <= 2.6) return Math.hypot(px - 14.4, py - 7.8) < 0.8 ? P.white : hd > 2 ? P.bee0 : P.bee1;
        if ((x === 14 && y === 5) || (x === 15 && y === 4)) return P.bee0;
        // the scarf
        if (px > 10.2 && px < 11.8 && Math.abs(py - 8.8) < 3.4) return py < 8 ? scarf : kit.mixHex(scarf, P.ink, 0.35);
        // the body: fuzzy stripes, lit from above
        const bd = Math.hypot((px - 7) / 5, (py - 9) / 4);
        if (bd <= 1 + (hash2(x, y, 3) - 0.5) * 0.12) {
          const band = Math.floor((px - 2) / 2) % 2;
          if (band) return py < 8 ? P.bee1 : P.bee0;
          return py < 7.5 ? P.bee3 : py < 10.5 ? P.bee2 : P.honey2;
        }
        if (x === 1 && y === 9) return P.bee0; // the sting
        // legs, and a lantern hung beneath
        if ((x === 6 || x === 9) && y === 13) return P.bee0;
        if (x === 8 && y === 13) return P.bee0;
        if (x >= 7 && x <= 9 && y === 14) return P.honey2;
        if (x === 8 && y === 15) return P.lamp;
        if ((x === 7 || x === 9) && y === 15) return P.honey2;
        return null;
      });
      frames.push({ name: `${id}.fly${f}`, buf });
    }
  }
  return { sprite: 'bee', frames, meta: { lamp: [8, 15], port: [15, 9] } };
}

function butterflies(kit) {
  const { P, paint } = kit;
  const kinds = { rose: [P.rose1, P.rose3], lemon: [P.honey2, P.sunny], blue: [P.blue0, P.blue1], lilac: [P.lav0, P.lav2] };
  const frames = [];
  for (const [kind, [dark, light]] of Object.entries(kinds)) {
    for (const f of [0, 1]) {
      frames.push({
        name: `${kind}.fly${f}`,
        buf: paint(9, 7, (x, y) => {
          if (x === 4) return y > 1 && y < 6 ? P.ink : null;
          const w = f ? 2 : 4;
          const dx = Math.abs(x - 4);
          if (dx > w) return null;
          const upper = y < 4 && dx <= w && y >= 4 - dx * (f ? 1.2 : 0.9);
          const lower = y >= 4 && y <= 5 + (w > 2 ? 1 : 0) && dx <= w - 1;
          if (!upper && !lower) return null;
          return dx === w || y === 0 ? dark : (x + y) % 3 ? light : dark;
        }),
      });
    }
  }
  return { sprite: 'butterfly', frames, meta: {} };
}

// A knot of bramble: stems tangled round each other, thorns everywhere, two
// berries watching.
function bramble(kit) {
  const { P, paint, rampSoft, vnoise, hash2 } = kit;
  const T = [P.thorn0, P.thorn1, P.thorn2, P.thorn3];
  const buf = paint(32, 30, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    const d = Math.hypot((px - 16) / 12, (py - 16) / 11);
    const n = vnoise(x * 0.35, y * 0.35, 5);
    if (d > 1 + (n - 0.5) * 0.35) {
      // thorns sticking out of the edge
      if (d < 1.3 && hash2(x, y, 7) < 0.14) return P.thorn3;
      return null;
    }
    for (const [ex, ey] of [[11, 13], [20, 12]]) if (Math.hypot(px - ex, py - ey) < 2.2) return Math.hypot(px - ex + 0.6, py - ey + 0.6) < 0.8 ? P.pearl : P.berry;
    const stem = Math.abs(Math.sin(px * 0.6 + Math.sin(py * 0.5) * 2 + n * 3)) < 0.35;
    if (hash2(x, y, 9) < 0.05) return P.thorn3;
    if (hash2(x, y, 11) < 0.03) return P.berry;
    return rampSoft(T, 0.55 - (py - 16) / 30 - (px - 16) / 40 + (stem ? 0.3 : -0.1), x, y, 3);
  }).padded(1).outline('auto');
  return { sprite: 'bramble', frames: [{ name: 'head', buf }], meta: { roots: [[8, 26], [12, 28], [17, 29], [22, 28], [26, 25]], eyes: [[12, 14], [21, 13]] } };
}

// The potting shed at dusk: a timber window on the garden, Weatherstaff
// standing at it, Mary at the bench with a seed tray, the lamp between them.
function shed(kit) {
  const { P, paint, rampSoft, inPoly, hash2, vnoise } = kit;
  const w = 180, h = 236;
  const lamp = [84, 150];
  const ben = [[24, 236], [27, 148], [34, 126], [62, 126], [70, 148], [72, 236]];
  const benArm = [[64, 140], [80, 168], [74, 172], [60, 148]];
  const mary = [[92, 186], [94, 154], [100, 146], [114, 146], [119, 156], [120, 186]];
  const coat = [P.coat0, P.coat1, P.coat2];
  const tweed = [P.coat0, P.tweed0, P.tweed1];
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
    const px = x + 0.5, py = y + 0.5;
    const lampD = Math.hypot(px - lamp[0], py - lamp[1]);
    // the oil lamp on the bench
    if (px >= lamp[0] - 3 && px <= lamp[0] + 3 && py >= lamp[1] - 7 && py <= lamp[1] + 3) {
      if (Math.abs(px - lamp[0]) < 1.6 && Math.abs(py - lamp[1] + 1) < 3) return P.white;
      return Math.abs(px - lamp[0]) > 2.4 || py < lamp[1] - 6 ? P.honey2 : P.lamp;
    }
    if (px >= lamp[0] - 2 && px <= lamp[0] + 2 && py > lamp[1] + 3 && py < 176) return py < lamp[1] + 6 ? P.honey2 : P.wood3;
    // flower pots and a watering can on the bench, seed packets pinned above
    if (py >= 166 && py < 176 && ((px >= 124 && px < 132) || (px >= 136 && px < 142))) return py < 168 ? P.soil3 : px < 127 || (px >= 136 && px < 138) ? P.soil3 : P.soil2;
    if (py >= 158 && py < 166 && px >= 125 && px < 131) return rampSoft([P.leaf2, P.leaf3, P.leaf4], 0.6 - (py - 158) / 12, x, y, 4);
    if (px >= 146 && px < 160 && py >= 162 && py < 176) return py < 164 ? P.iron3 : rampSoft([P.stone2, P.iron2, P.iron3], 0.8 - (px - 146) / 16, x, y, 5);
    if (px >= 160 && px < 168 && Math.abs(py - (164 - (px - 160) * 0.6)) < 1) return P.iron2;
    // Mary at the bench, seen from behind, a ribbon in her hair, and her stool
    const inMary = (qx, qy) => inPoly(qx, qy, mary) || Math.hypot(qx - 107, qy - 136) <= 8;
    if (inMary(px, py)) {
      if (Math.hypot(px - 107, py - 136) <= 8) {
        if (Math.abs(py - 131) < 1 && px > 100 && px < 114) return P.rose1; // the ribbon
        return lit(px, py, inMary, P.soil2, P.skin1) ?? rampSoft([P.soil0, P.soil1, P.soil2], 0.35, x, y, 1);
      }
      return lit(px, py, inMary, P.coat2, P.honey2) ?? rampSoft([P.rose0, P.rose1, P.rose2], 0.3 + (px - 94) / 80, x, y, 1);
    }
    if (px >= 90 && px <= 122 && py >= 186 && py < 236 && (px < 94 || px > 118 || (py > 186 && py < 190))) return rampSoft([P.wood0, P.wood1, P.wood2], 0.5 + (lampD < 60 ? 0.3 : 0), x, y, 3);
    // Weatherstaff at the window, flat cap and waistcoat
    const inCap = (qx, qy) => (qy >= 98 && qy <= 106 && qx >= 36 && qx <= 60) || (qy > 106 && qy <= 108 && qx >= 34 && qx <= 64);
    const inHead = (qx, qy) => Math.hypot(qx - 48, qy - 114) <= 9;
    const inBen = (qx, qy) => inPoly(qx, qy, ben) || inPoly(qx, qy, benArm) || inHead(qx, qy) || inCap(qx, qy) || (qy > 120 && qy < 130 && Math.abs(qx - 48) < 6);
    if (inBen(px, py)) {
      if (inCap(px, py)) return lit(px, py, inBen, P.tweed1, P.honey2) ?? rampSoft(tweed, 0.35, x, y, 2);
      if (inHead(px, py)) {
        if (py > 115 && px < 54) return hash2(x, y, 4) < 0.7 ? P.pearlD : P.stone3; // the beard
        return px > 52 ? P.skin0 : lit(px, py, inBen, P.coat2, P.skin1) ?? P.skin0;
      }
      const vest = px > 36 && px < 60 && py > 128 && py < 176;
      return lit(px, py, inBen, P.coat2, P.honey2) ?? (vest ? rampSoft(tweed, 0.5 + (px - 48) / 60, x, y, 4) : rampSoft(coat, 0.45 + (px - 48) / 60 - (py - 130) / 300, x, y, 4));
    }
    // the potting bench
    if (py >= 176) {
      if (py < 178) return lampD < 60 ? P.wood4 : P.wood3;
      if (py < 181) return rampSoft([P.wood2, P.wood3, P.wood4], 0.3 + Math.max(0, 1 - lampD / 70) * 0.7, x, y, 5);
      if ((x % 30 === 0 && py > 186) || y === 210) return P.wood0;
      return rampSoft([P.wood0, P.wood1, P.wood2, P.wood3], 0.25 + Math.max(0, 1 - lampD / 90) * 0.55 - (py - 182) / 160, x, y, 6);
    }
    // the window: a timber arch, glazing bars, the garden in the last light
    const wc = [98, 186];
    const R = 176;
    const d = Math.hypot(px - wc[0], py - wc[1]);
    if (d <= R) {
      const a = Math.atan2(py - wc[1], px - wc[0]);
      const warmth = Math.max(0, 1 - lampD / 90) * 0.35;
      if (d >= R - 10) return rampSoft([P.wood0, P.wood1, P.wood2, P.wood3], 0.3 - (py - 60) / 300 + warmth + (d > R - 2 ? -0.2 : 0), x, y, 7);
      if (Math.abs(d - 100) < 2.5) return rampSoft([P.wood1, P.wood2, P.wood3], 0.4 + warmth, x, y, 11);
      if (Math.abs(((a / (Math.PI / 5)) % 1 + 1) % 1 - 0.5) > 0.487 && d > 30) return P.wood1;
      // outside: sunset sky, far hills, trees, flowers at the sill
      const horizon = 118 + Math.sin(px * 0.05) * 4;
      if (py > 140 + Math.sin(px * 0.2) * 2) {
        const fl = hash2(x >> 1, y >> 1, 9);
        return fl < 0.18 ? [P.rose2, P.sunny, P.lav1, P.daisy][Math.floor(fl * 22) % 4] : rampSoft([P.grass1, P.grass2, P.grass3, P.grass4], 0.7 - (py - 140) / 30, x, y, 8);
      }
      for (const [tx, ty, tr] of [[30, 112, 18], [62, 104, 22], [150, 108, 20], [176, 118, 16]]) {
        if (Math.hypot(px - tx, (py - ty) * 1.2) < tr * (0.8 + 0.3 * vnoise(x * 0.3, y * 0.3, tx))) return rampSoft([P.leaf1, P.leaf2, P.leaf3, P.leafLit], 0.55 - (px - tx) / (tr * 2) - (py - ty) / (tr * 2), x, y, 12);
      }
      if (py > horizon) return rampSoft([P.hill1, P.hill2, P.hill3], 0.5 - (py - horizon) / 40, x, y, 13);
      if (Math.hypot(px - 128, py - 110) < 9) return P.sun;
      return rampSoft([P.sky0, P.sky1, P.sky2, P.sky3, P.sky4, P.sky5], (py - 10) / 110 + Math.max(0, 1 - Math.hypot(px - 128, py - 110) / 60) * 0.3, x, y, 9);
    }
    // shed wall: planks, a shelf of pots, seed packets
    if (py > 70 && py < 74 && px > 150) return P.wood3;
    if (py > 62 && py < 70 && px > 152 && (px % 8) < 5) return (px % 8) < 1 ? P.soil3 : P.soil2;
    if (px < 20 && py > 60 && py < 90 && (py % 12) < 8 && (px % 9) < 6) return [P.sunny, P.rose2, P.grass4][Math.floor(py / 12) % 3];
    if (x % 14 === 6) return P.wood0;
    return rampSoft([P.wood0, P.wood1, P.wood2], 0.35 + (py / h) * 0.3 + (hash2(x >> 2, y >> 3, 10) - 0.5) * 0.15, x, y, 10);
  });
  // a robin on the sill
  for (const [x, y, c] of [[136, 138, P.soil1], [137, 138, P.soil1], [135, 139, P.soil2], [136, 139, P.poppy], [137, 139, P.poppy], [138, 139, P.soil1], [135, 140, P.soil2], [136, 140, P.poppy], [137, 140, P.soil2], [138, 140, P.soil2], [139, 140, P.soil1], [137, 137, P.soil1], [138, 137, P.ink]]) buf.set(x, y, c);
  return { sprite: 'shed', frames: [{ name: 'window', buf }], meta: { lamp } };
}
