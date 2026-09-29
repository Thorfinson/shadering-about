// The NOIR city in three dimensions, for noir-3d.html (high fidelity) and
// noir-3d-pixel.html (art resolution, depth outline, a palette of sodium,
// smog and teal). The same console as NEON//3D, in a city of another film
// grammar: a few colossal things and a great many tiny ones. A stepped pyramid
// over the district, brutalist megablocks that leave the top of the frame,
// giant screens on their flanks; below them streets of sodium lamps, shop
// signs, steam and a crowd of lit umbrellas; past the plate's edge an
// industrial sprawl to the haze, flare stacks spitting fire, a hologram
// rising out of it, a blimp, spinners with searchlights, and rain.
//
// A classic script, so the pages still open from file://. The camera, the
// cars, the ICE, the post and the engine's hooks come from assets/os/city3d.js:
//
//   const world = NoirCity3D(THREE, { EffectComposer, …, mergeGeometries }, { pixel })
//   startOS({ ...NOIR_STORY, ...world })

// eslint-disable-next-line no-unused-vars
function NoirCity3D(THREE, X, opts) {
  "use strict";
  const PIXEL = !!opts?.pixel;
  const Z = 1.65;
  // the city's own colours, over the atlas's (the stations' and runners' colours stay)
  const NOIR = {
    sodium: "#ffa640", sodiumHi: "#ffd08a", flare: "#ff7a1a", ember: "#ff4a10",
    tealN: "#3cc8d0", teal2: "#1f8a96", spot: "#e4ecff", police: "#3a6cff",
    neonRed: "#ff2e3a", brass: "#c89a4a", haze: "#6f8792",
  };
  const PAL = { ...window.NEON_ATLAS.palette, ...NOIR };
  // the pixel palette: blue-grey smog, sodium and fire, teal, a little neon
  const QUANT = [
    "#040507", "#07090c", "#0a0e12", "#0e1318", "#13191f", "#181f27", "#1e2730", "#25303a", "#2d3945", "#364451", "#41505e", "#4e5e6c", "#5e6e7c", "#72828e", "#8a98a2", "#a6b2ba",
    "#0f0b08", "#1a120c", "#271a10", "#372414", "#4a3018", "#613d1c", "#7c4c1f", "#9a5c22",
    "#b86c24", "#d67e2a", "#f09434", "#ffa640", "#ffbd66", "#ffd08a", "#ffe4b4", "#fff4e0",
    "#ff7a1a", "#e05a12", "#b0400e", "#7a2a0c", "#4a1a0a", "#ff4a10",
    "#ff2e3a", "#c01a28", "#80121c", "#4a0a12",
    "#0c2a30", "#123c44", "#185a64", "#1f8a96", "#2caab4", "#3cc8d0", "#8ae4ea", "#c8f4f6",
    "#1a2a5a", "#2a4a9a", "#3a6cff", "#8aa8ff", "#c8d8ff", "#e4ecff", "#ffffff",
    "#ff4fa0", "#a0305e", "#5a1a36", "#ff9ac8",
    "#39ff8a", "#1a7a44", "#0c3a22",
    "#ffb000", "#ff5c8a", "#22e6ff", "#4d9bff", "#b36bff", "#f0e6ff", "#6a3a9a", "#2e1c48",
  ];
  const K = City3D(THREE, X, {
    pixel: PIXEL,
    story: NOIR_STORY,
    palette: PAL,
    quantize: QUANT,
    atlas: window.NEON_ATLAS,
    atlasFile: "assets/neon/atlas.js",
    seed: 2019,
    Z,
    view: { dist: 300, pitch: 29, hfov: 31, target: -8, near: 30, far: 1700 },
    // The pyramid stands behind its pad, so the hub's card goes below; the
    // blocks round it keep clear of its flanks.
    layout: {
      hub: [0.5, 0.6, ["below", "left", "right"]],
      knowledge: [0.14, 0.38, ["above", "right", "left"]],
      documents: [0.7, 0.3, ["right", "above", "left"]],
      models: [0.9, 0.45, ["above", "left"]],
      repos: [0.15, 0.74, ["right", "above", "below"]],
      tests: [0.74, 0.66, ["below", "right", "left"]],
      memory: [0.36, 0.87, ["left", "right", "above"]],
      deploy: [0.88, 0.88, ["left", "above"]],
    },
    size: { hub: [8, 10], knowledge: [6, 10], documents: [6.5, 8], models: [5, 20], repos: [7, 11], tests: [6.5, 12], memory: [6, 9], deploy: [7, 16] },
    smog: ["#27323a", "#161d23"],
    fog: { near: [250, 270], far: [1050, 1300] },
    hemi: ["#5e7888", "#0c0806", [1.25, 0.85]],
    moon: ["#b0c8e0", [0.65, 0.3], [70, 120, 20]],
    exposure: 1.45,
    bloom: [[0.2, 0.05, 0.92], [0.5, 0.45, 0.88]],
    // teal shadows and hazy blacks under warm light
    grade: {
      vignette: 0.5,
      grain: 0.016,
      glsl: /* glsl */ `
            float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
            c = mix(c, c * vec3(0.86, 1.02, 1.1), (1.0 - smoothstep(0.0, 0.3, lum)) * 0.7);
            c += vec3(0.010, 0.016, 0.020) * (1.0 - smoothstep(0.0, 0.25, lum));
            c = mix(c, c * vec3(1.06, 0.98, 0.88), smoothstep(0.35, 1.0, lum) * 0.5);`,
    },
    windows: {
      win: [[1.0, 0.6, 0.28], [0.55, 0.85, 0.88], [1.0, 0.3, 0.22]], cut: [0.8, 0.95],
      shop: [[1.0, 0.62, 0.26], [0.3, 0.9, 0.85], [1.0, 0.28, 0.32]], shopCut: [0.5, 0.74],
      gain: 1.45, shopGain: [0.6, 1.0],
    },
    tower: ["#202327", "#2b2e33"],
    ice: { dx: 9, dz: 1 }, // right of the precinct, clear of its card and its runner
    mapH: [520, undefined],
    beadDim: "#1a1c22",
    steam: "#8a9aa4",
    hud: { cam: "CAM 22 · REC", sector: "LEVEL 4", band: "rgba(6,8,10,0.62)", ink: "rgba(255,236,210,0.86)" },
    chrome: { ink: "#fff1de", accent: "#ffa640", brand: "#5fd8e0", carBody: "#2c3038" },
    // the runners fly spinners: a wedge nose, a bubble canopy, a light bar
    car: {
      shell: [[1, 9], [3, 6.8], [9, 5.6], [13, 3.6], [20, 3.1], [25, 4.6], [27, 7], [27, 9.6], [4, 10.6]],
      glass: [[12.5, 4.1], [19.5, 3.7], [21.5, 5.6], [11.5, 5.9]],
      body: "#2a2e36", glassCol: "#a8d8e0", glassEmit: "#3a5a60", size: 1.3,
      extra(g, a) {
        const blue = K.mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), K.glow("police", PIXEL ? 1.4 : 4), -0.6, 0.72, -0.3, g);
        const red = K.mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), K.glow("neonRed", PIXEL ? 1.4 : 4), -0.6, 0.72, 0.3, g);
        return (t, ag) => {
          const on = Math.floor(t * 6 + ag.slot) % 2 === 0;
          blue.visible = on;
          red.visible = !on;
        };
      },
    },
  });
  const { U, C, rand, pick, scene, camera, SITE, nearSite, glow, haze, lineGlow, std, tex, liveTex, litSeed, seeded, mesh, softDot, pointsMaterial, windowMaterial, TOWER, TOWER_HI, glyphTex, reflectors, spawn } = K;
  const SMOG = K.SMOG;
  const deg = THREE.MathUtils.degToRad;
  const SIGN = ["neonRed", "neonRed", "sodium", "sodium", "sodium", "tealN", "neonPink"];
  const M = {
    concrete: std("#2a2d31", 0.9, 0.1),
    slab: std("#34373b", 0.85, 0.1),
    metal: std("#3c4046", 0.4, 0.75),
    dark: std("#121417", 0.6, 0.5),
    rust: std("#3a2418", 0.8, 0.35),
    glass: std("#20343a", 0.06, 0.9, { transparent: true, opacity: 0.4 }),
  };
  const BRUTAL = windowMaterial("#18191c", 0.9, 0.1, 1.6); // the megablocks: bigger bays, heavier floors

  // Where the frame ends: y at which the ray through the top edge crosses depth z,
  // and y at which the ray over the plate's far lip does (below it, the plate hides the gulf).
  const cam0 = camera.position.clone();
  const topRay = new THREE.Vector3();
  K.castNdc(0, 1, -2000, topRay).sub(cam0).normalize();
  const frameTop = (z) => cam0.y + (topRay.y * (z - cam0.z)) / topRay.z;

  // ============================================================
  // The plate: wet streets, the small city, its signs and lamps
  // ============================================================
  const PLATE = { x0: -170 * Z, x1: 170 * Z, z0: -44 * Z, z1: 95 * Z };
  const lipY = (z) => cam0.y + ((0 - cam0.y) * (cam0.z - z)) / (cam0.z - PLATE.z0);
  const CELL = 7, AVE = 5; // a block's pitch; every fifth street is an avenue
  // the street grid is turned against the view: two-point perspective, not rows
  const GRID = deg(14), GC = Math.cos(GRID), GS = Math.sin(GRID);
  const toWorld = (gx, gz) => [gx * GC + gz * GS, -gx * GS + gz * GC];
  const toGrid = (x, z) => [x * GC - z * GS, x * GS + z * GC];
  const onPlate = (x, z, m = 0) => x > PLATE.x0 + m && x < PLATE.x1 - m && z > PLATE.z0 + m && z < PLATE.z1 - m;
  // a spot on the ground under a screen position of the reference view
  const groundAt = (fx, fy) => K.castNdc(fx * 2 - 1, 1 - fy * 2, 0);
  // The colossi: footprints the small city keeps clear of, in grid space
  const COLOSSI = [];
  const colossus = (x, z, w, d) => {
    const [gx, gz] = toGrid(x, z);
    COLOSSI.push({ gx, gz, w, d });
  };
  const inColossus = (x, z, pad) => {
    const [gx, gz] = toGrid(x, z);
    return COLOSSI.some((m) => Math.abs(gx - m.gx) < m.w / 2 + pad && Math.abs(gz - m.gz) < m.d / 2 + pad);
  };
  // The pyramids: the hub's stands behind its pad; its twin, larger, further back
  const PYR = { w: 50, tiers: 13, th: 3.3 };
  PYR.step = (PYR.w - 5) / 2 / PYR.tiers;
  PYR.back = -(PYR.w / 2 - PYR.step * 3 + 5); // behind the pad, which meets its third terrace
  // the twin rises out of the undercity past the plate's edge: its foot is far below
  const TWIN = { tiers: 32, th: 3.4, step: 1.9, base: -60 };
  TWIN.w = 6 + 2 * TWIN.step * TWIN.tiers;
  // the flare stacks inside the district, by screen position
  const STACKS = [[0.05, 0.22], [0.965, 0.25]];
  const signs = []; // {x, y, z, w, h, col, ry, far}
  const shopSigns = []; // small lit boards on the fronts: {x, y, z, w, h, col, ry}
  const beacons = []; // red aircraft lights: [x, y, z, phase]
  const screens = []; // giant ad screens: {x, y, z, w, h, ry, page}
  let lampSpots = [];
  const faceSpot = (gx, gz, along, out) => {
    const [x, z] = toWorld(gx + along, gz + out);
    return { x, z, ry: GRID };
  };
  function buildCity() {
    const boxes = [];
    const box = (w, h, d, gx, y, gz, seed, list = boxes) => {
      const [x, z] = toWorld(gx, gz);
      list.push(seeded(new THREE.BoxGeometry(w, h, d).rotateY(GRID).translate(x, y, z), seed));
    };
    const faceOf = (gx, gz, w, d, along, out) => faceSpot(gx, gz, along * (w / 2 - 0.4), d / 2 + out);
    const corners = [[PLATE.x0, PLATE.z0], [PLATE.x1, PLATE.z0], [PLATE.x0, PLATE.z1], [PLATE.x1, PLATE.z1]].map(([x, z]) => toGrid(x, z));
    const [gi0, gi1] = [Math.min(...corners.map((c) => c[0])), Math.max(...corners.map((c) => c[0]))].map((v) => Math.floor(v / CELL));
    const [gj0, gj1] = [Math.min(...corners.map((c) => c[1])), Math.max(...corners.map((c) => c[1]))].map((v) => Math.floor(v / CELL));
    const street = (i) => (i % AVE === 0 ? 1.5 : 0.8); // half the street's width on the block's near side
    // the small city: low, dense and dark; a mid-rise now and then, a rare thin tower
    for (let i = gi0; i <= gi1; i++) {
      for (let j = gj0; j <= gj1; j++) {
        const bx0 = i * CELL + street(i), bx1 = (i + 1) * CELL - street(i + 1);
        const bz0 = j * CELL + street(j), bz1 = (j + 1) * CELL - street(j + 1);
        const bw = bx1 - bx0, bd = bz1 - bz0;
        const split = rand();
        const lots = split < 0.25 ? [[0, 0, 1, 1]] : split < 0.6 ? [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] : split < 0.8 ? [[0, 0, 1, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] : [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]];
        for (const [u, v, uw, vw] of lots) {
          const w = bw * uw - 0.2 - rand() * 0.4, d = bd * vw - 0.2 - rand() * 0.4;
          const gx = bx0 + bw * (u + uw / 2), gz = bz0 + bd * (v + vw / 2);
          const [x, z] = toWorld(gx, gz);
          if (!onPlate(x, z, Math.max(w, d) * 0.72) || nearSite(x, z, 2.5) || inColossus(x, z, Math.max(w, d) / 2 + 0.5)) continue;
          const side = smooth(90 * Z, 170 * Z, Math.abs(x)), back = smooth(-14 * Z, -42 * Z, z);
          const r = rand();
          let h = r < 0.03 ? 16 + rand() * 16 : r < 0.15 ? 5 + rand() * 7 : lerp(1.1, 4.2, rand() ** 1.6);
          h += side * lerp(2, 24, rand() ** 2) + back * lerp(0, 8, rand() ** 2);
          const spire = r < 0.03;
          if (Object.values(SITE).some((s) => Math.hypot(x - s.x, z - s.z) < s.r + 7)) h = Math.min(h, 3 + rand() * 2.5);
          h = Math.max(1, h);
          const seed = litSeed(0.05 + rand() ** 2 * 0.4, Math.floor(rand() * 50));
          const ww = spire ? Math.min(w, 2.6) : w, dd = spire ? Math.min(d, 2.6) : d;
          box(ww, h, dd, gx, h / 2, gz, seed);
          if (h > 7 && rand() < 0.45) box(ww * 0.7, h * 0.3, dd * 0.7, gx, h + h * 0.15, gz, seed); // a setback
          // roof clutter: tanks, vents; a mast with a red light on the taller ones
          if (rand() < 0.6) box(0.4 + rand() * 0.7, 0.3 + rand() * 0.4, 0.4 + rand() * 0.7, gx + (rand() - 0.5) * ww * 0.5, h + 0.2, gz + (rand() - 0.5) * dd * 0.5, -1);
          if (h > 6 && rand() < 0.35) {
            const mh = 2 + rand() * (spire ? 8 : 3);
            box(0.1, mh, 0.1, gx, h + mh / 2, gz, -1);
            const [mx, mz] = toWorld(gx, gz);
            beacons.push([mx, h + mh + 0.1, mz, rand() * 6]);
          }
          if (h > 4 && rand() < 0.2) signs.push({ ...faceOf(gx, gz, ww, dd, rand() < 0.5 ? -1 : 1, 0.05), y: h * (0.35 + rand() * 0.35), w: 0.45 + rand() * 0.3, h: Math.min(h * 0.55, 1.5 + rand() * 3), col: pick(SIGN) });
          // shop boards over the pavement: the city's small print
          if (rand() < 0.25) shopSigns.push({ ...faceOf(gx, gz, ww, dd, (rand() - 0.5) * 1.2, 0.06), y: 0.9 + rand() * 0.5, w: 0.6 + rand() * 1.1, h: 0.2 + rand() * 0.2, col: pick(SIGN) });
        }
      }
    }
    // sodium lamps down the avenues, a few at the corners of the side streets
    lampSpots = [];
    for (let i = gi0; i <= gi1 + 1; i++) {
      for (let j = gj0; j <= gj1 + 1; j++) {
        const spots = [];
        if (i % AVE === 0 && j % 2) spots.push([i * CELL + (j % 4 === 1 ? 1.2 : -1.2), j * CELL + CELL / 2]);
        if (j % AVE === 0 && i % 2) spots.push([i * CELL + CELL / 2, j * CELL + (i % 4 === 1 ? 1.2 : -1.2)]);
        if (rand() < 0.3) spots.push([i * CELL + 0.7, j * CELL + 0.7]);
        for (const [gx, gz] of spots) {
          const [x, z] = toWorld(gx, gz);
          if (onPlate(x, z, 1) && !nearSite(x, z, 2) && !inColossus(x, z, 0)) lampSpots.push([x, z]);
        }
      }
    }
    const city = new THREE.Mesh(X.mergeGeometries(boxes), TOWER);
    scene.add(city);
    boxes.forEach((b) => b.dispose());

    // vertical signs, eight glyph columns
    for (let c = 0; c < 8; c++) {
      const list = signs.filter((_, i) => i % 8 === c);
      if (!list.length) continue;
      const t = glyphTex.clone();
      t.repeat.set(1 / 8, 1);
      t.offset.set(c / 8, 0);
      t.wrapT = THREE.RepeatWrapping;
      const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }), list.length);
      const o = new THREE.Object3D();
      list.forEach((s, i) => {
        o.position.set(s.x, s.y, s.z);
        o.rotation.set(0, s.ry, 0);
        o.scale.set(s.w, s.h, 1);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        m.setColorAt(i, C(s.col, (PIXEL ? 1.2 : 2.4) * (s.far ? 0.55 : 1)));
      });
      scene.add(m);
    }
    // shop boards
    {
      const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), shopSigns.length);
      const o = new THREE.Object3D();
      shopSigns.forEach((s, i) => {
        o.position.set(s.x, s.y, s.z);
        o.rotation.set(0, s.ry, 0);
        o.scale.set(s.w, s.h, 1);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        m.setColorAt(i, C(s.col, PIXEL ? 0.9 : 1.7));
      });
      scene.add(m);
    }
    // sodium lamps, and their pools of light on the wet street
    const lampMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.18, 0.24), glow("sodium", PIXEL ? 0.9 : 3), lampSpots.length);
    lampSpots.forEach(([x, z], i) => lampMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 1.9, z)));
    scene.add(lampMesh);
    const poolMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1.4, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: softDot, color: C("sodium", PIXEL ? 0.22 : 0.32), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), lampSpots.length);
    lampSpots.forEach(([x, z], i) => poolMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0.04, z)));
    scene.add(poolMesh);
  }

  // A stepped pyramid: lit terraces, corner buttresses, a warm hall on the
  // summit and lifts climbing its faces. Returns its height and its update.
  function pyramid(parent, x, z, P, seed) {
    const { w, tiers, th, step } = P;
    const pyr = new THREE.Group();
    pyr.position.set(x, P.base ?? 0, z);
    pyr.rotation.y = GRID;
    parent.add(pyr);
    const parts = [];
    for (let i = 0; i < tiers; i++) {
      const tw = w - 2 * step * i;
      parts.push(seeded(new THREE.BoxGeometry(tw, th, tw).translate(0, th / 2 + i * th, 0), litSeed(0.72 - i * 0.012, seed + i)));
    }
    const H = tiers * th;
    mesh(X.mergeGeometries(parts), TOWER_HI, 0, 0, 0, pyr);
    const lean = Math.atan2(step, th);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const bt = mesh(new THREE.BoxGeometry(3.2, H * 1.02, 3.2), M.concrete, 0, 0, 0, pyr);
      bt.position.set(sx * (w / 2 - step * tiers * 0.5), H * 0.48, sz * (w / 2 - step * tiers * 0.5));
      bt.rotation.set(-sz * lean, 0, sx * lean);
    }
    // a sodium line along every terrace's edge
    const edgePts = [];
    for (let i = 1; i <= tiers; i++) {
      const hw = w / 2 - step * i + step * 0.15, y = i * th + 0.02;
      edgePts.push(-hw, y, hw, hw, y, hw, hw, y, hw, hw, y, -hw, hw, y, -hw, -hw, y, -hw, -hw, y, -hw, -hw, y, hw);
    }
    pyr.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(edgePts, 3)), lineGlow("sodium", PIXEL ? 1.2 : 2.4, 0.9)));
    const lifts = [];
    for (let f = 0; f < 4; f++) lifts.push({ lift: mesh(new THREE.BoxGeometry(0.9, 1.2, 0.3), glow("sodiumHi", PIXEL ? 1.4 : 4), 0, 0, 0, pyr), a: (f * Math.PI) / 2, ph: f * 0.27 });
    const topW = w - 2 * step * tiers;
    mesh(new THREE.BoxGeometry(topW + 0.4, 2.4, topW + 0.4), glow("sodiumHi", PIXEL ? 1.1 : 2.2), 0, H + 1.2, 0, pyr);
    mesh(new THREE.BoxGeometry(topW + 1.2, 0.4, topW + 1.2), M.dark, 0, H + 2.6, 0, pyr);
    mesh(new THREE.CylinderGeometry(0.08, 0.25, 7, 6), M.metal, 0, H + 6, 0, pyr);
    const beacon = mesh(new THREE.SphereGeometry(0.4, 8, 6), glow("neonRed", PIXEL ? 1.4 : 4), 0, H + 9.6, 0, pyr);
    // the glow of the city on its flanks, and two searchlights from the summit
    const sweeps = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * topW * 0.4, H + 2.2, 0);
      pyr.add(pivot);
      pivot.add(new THREE.Mesh(new THREE.ConeGeometry(5, 130, 24, 1, true).rotateX(Math.PI).translate(0, 65, 0), shaftMat(C("#e8eeff", PIXEL ? 0.2 : 0.26))));
      sweeps.push({ pivot, s });
    }
    return {
      H,
      update(t) {
        for (const L of lifts) {
          const k = (t * 0.05 + L.ph) % 1;
          const y = k * (H - 1.2), inset = w / 2 - Math.floor(y / th) * step + 0.2;
          L.lift.position.set(Math.sin(L.a) * inset, y + 0.6, Math.cos(L.a) * inset);
          L.lift.rotation.y = L.a;
        }
        beacon.visible = Math.sin(t * 3 + seed) > -0.2;
        for (const S of sweeps) S.pivot.rotation.set(Math.sin(t * 0.13 + S.s + seed) * 0.55 - 0.15, 0, S.s * (0.35 + Math.sin(t * 0.21 + seed) * 0.3));
      },
    };
  }

  // A flare stack: a chimney burning off gas, now and then in a burst of fire,
  // a refinery of tanks and pipes at its foot
  const flares = []; // { fire, mat, light, ph, period, at, s }
  function flareStack(x, z, base, height, firePx, parts, r) {
    const top = base + height;
    const r0 = height / 22;
    parts.push(new THREE.CylinderGeometry(r0 * 0.6, r0, height, 10).translate(x, base + height / 2, z));
    for (let k = 0; k < 4; k++) {
      const rr = r0 * (1.6 + r() * 2), hh = height * (0.1 + r() * 0.15);
      parts.push(new THREE.CylinderGeometry(rr, rr, hh, 14).translate(x + (r() - 0.5) * r0 * 14, base + hh / 2, z + (r() - 0.5) * r0 * 8));
    }
    const s = firePx;
    const mat = fireMat(r() * 20);
    const fire = mesh(new THREE.PlaneGeometry(s * 0.55, s), mat, x, top + s * 0.47, z, scene);
    fire.lookAt(cam0.x, top + s * 0.47, cam0.z);
    const light = mesh(new THREE.CircleGeometry(s * (PIXEL ? 0.6 : 0.9), 24), new THREE.MeshBasicMaterial({ map: softDot, color: C("flare", PIXEL ? 0.2 : 0.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), x, top + s * 0.3, z + 1, scene);
    light.lookAt(cam0);
    flares.push({ fire, mat, light, ph: r() * 20, period: 7 + r() * 9, at: new THREE.Vector3(x, top, z), s });
    return top;
  }
  function buildColossi() {
    // the twin pyramid, back and to the left of the hub's; where it meets the plate
    const hub = SITE.hub;
    TWIN.at = { x: -28 * Z, z: -34 * Z };
    const plateW = TWIN.w - 2 * TWIN.step * Math.ceil(-TWIN.base / TWIN.th);
    colossus(TWIN.at.x, TWIN.at.z, plateW + 4, plateW + 4);
    // the hub's pyramid (built with the hub), kept clear here
    const [px, pz] = toWorld(0, PYR.back);
    PYR.at = { x: hub.x + px, z: hub.z + pz };
    colossus(PYR.at.x, PYR.at.z, PYR.w + 4, PYR.w + 4);
    // the flare stacks in the district
    const parts = [];
    const r = rng(41);
    for (const [fx, fy] of STACKS) {
      const g = groundAt(fx, fy);
      colossus(g.x, g.z, 16, 12);
      flareStack(g.x, g.z, 0, 24 + r() * 6, 12, parts, r);
    }
    scene.add(new THREE.Mesh(X.mergeGeometries(parts), std("#1c1d20", 0.8, 0.4)));
    buildMegablocks();
  }

  // The megablocks: brutalist slabs at the district's sides, too tall for the
  // frame, with giant screens and neon down their flanks.
  function buildMegablocks() {
    const boxes = [];
    const defs = [
      // x, z (× Z), width, depth, height
      [-152, -30, 44, 36, 260], [-118, -62, 30, 30, 300], [134, -52, 40, 34, 280], [168, -14, 36, 44, 240],
    ];
    for (const [x0, z0, w, d, h] of defs) {
      const x = x0 * Z, z = z0 * Z;
      const [gx, gz] = toGrid(x, z);
      const seed = litSeed(0.22 + rand() * 0.2, 40 + boxes.length);
      const add = (bw, bh, bd, ox, y, oz) => {
        const [wx, wz] = toWorld(gx + ox, gz + oz);
        boxes.push(seeded(new THREE.BoxGeometry(bw, bh, bd).rotateY(GRID).translate(wx, y, wz), seed));
      };
      add(w, h, d, 0, h / 2 - 1, 0);
      // buttresses and a stepped base: the brutalist foot
      add(w + 6, 10, d + 6, 0, 4, 0);
      for (const s of [-1, 1]) add(3, h * 0.8, 4, s * (w / 2 + 1.5), h * 0.4, d / 2 - 2);
      // a screen on the face toward the camera, and a neon ribbon down one edge
      const front = faceSpot(gx, gz, 0, d / 2 + 0.3);
      const top = frameTop(z) - 4;
      screens.push({ ...front, y: Math.min(top - 12, 34 + rand() * 10), w: w * 0.62, h: w * 0.36, page: screens.length });
      const edge = faceSpot(gx, gz, (rand() < 0.5 ? -1 : 1) * (w / 2 - 1.2), d / 2 + 0.25);
      signs.push({ ...edge, y: 14 + rand() * 6, w: 1.6, h: 18 + rand() * 8, col: pick(["neonRed", "sodium", "tealN"]), far: false });
      colossus(x, z, w + 6, d + 6);
    }
    scene.add(new THREE.Mesh(X.mergeGeometries(boxes), BRUTAL));
    boxes.forEach((b) => b.dispose());
  }

  // ============================================================
  // The ground: a wet street that mirrors the city
  // ============================================================
  let ground = null;
  function buildGround() {
    const shader = {
      name: "WetStreet",
      uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTime: U.time, fogCol: { value: SMOG }, fogNear: { value: scene.fog.near }, fogFar: { value: scene.fog.far } },
      vertexShader: /* glsl */ `
        uniform mat4 textureMatrix;
        varying vec4 vUv;
        varying vec3 vWorld;
        void main() {
          vUv = textureMatrix * vec4(position, 1.0);
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform vec3 fogCol;
        uniform float fogNear, fogFar;
        varying vec4 vUv;
        varying vec3 vWorld;
        float gh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float gn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gh(i), gh(i + vec2(1, 0)), f.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), f.x), f.y); }
        void main() {
          vec2 w = vWorld.xz;
          float wet = smoothstep(0.38, 0.6, gn(w * 0.09) * 0.6 + gn(w * 0.41) * 0.4);
          vec2 gw = vec2(w.x * ${GC.toFixed(5)} - w.y * ${GS.toFixed(5)}, w.x * ${GS.toFixed(5)} + w.y * ${GC.toFixed(5)});
          vec2 c = abs(fract(gw / ${CELL.toFixed(1)} + 0.5) - 0.5) * ${CELL.toFixed(1)};
          float curb = step(c.x, 1.35) * step(1.2, c.x) + step(c.y, 1.35) * step(1.2, c.y);
          vec3 asphalt = mix(vec3(0.010, 0.012, 0.014), vec3(0.030, 0.032, 0.034), gn(w * 1.3));
          // rain rings on the puddles
          vec2 cell = floor(w * 1.5);
          float ph = fract(uTime * 0.9 + gh(cell) * 7.0);
          float ring = smoothstep(0.08, 0.0, abs(length(fract(w * 1.5) - 0.5) - ph * 0.45)) * (1.0 - ph) * wet;
          vec2 ripple = vec2(gn(w * 0.45 + uTime * 0.25), gn(w * 0.45 - uTime * 0.2)) - 0.5;
          vec4 uv = vUv;
          uv.xy += ripple * uv.w * mix(0.008, 0.002, wet);
          vec2 b = vec2(0.004, 0.0) * uv.w;
          vec3 refl = (texture2DProj(tDiffuse, uv).rgb * 2.0 + texture2DProj(tDiffuse, uv + vec4(b, 0.0, 0.0)).rgb + texture2DProj(tDiffuse, uv - vec4(b, 0.0, 0.0)).rgb + texture2DProj(tDiffuse, uv + vec4(b.yx, 0.0, 0.0)).rgb + texture2DProj(tDiffuse, uv - vec4(b.yx, 0.0, 0.0)).rgb) / 6.0;
          vec3 col = asphalt + refl * mix(${PIXEL ? "0.05, 0.3" : "0.14, 0.6"}, wet) + curb * ${PIXEL ? "0.0" : "0.04"} + ring * vec3(0.12, 0.13, 0.14);
          col = mix(col, fogCol, smoothstep(fogNear, fogFar, length(vWorld - cameraPosition)));
          gl_FragColor = vec4(col, 1.0);
        }`,
    };
    const w = PLATE.x1 - PLATE.x0, d = PLATE.z1 - PLATE.z0;
    ground = new X.Reflector(new THREE.PlaneGeometry(w, d), { shader, textureWidth: 512, textureHeight: 256, clipBias: 0.003, multisample: PIXEL ? 0 : 4 });
    reflectors.push(ground);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((PLATE.x0 + PLATE.x1) / 2, 0, (PLATE.z0 + PLATE.z1) / 2);
    scene.add(ground);
    // the plate's far edge: a wall of girders with a strip of sodium
    mesh(new THREE.BoxGeometry(w, 5, 2), M.dark, ground.position.x, -2.4, PLATE.z0 - 1, scene);
    mesh(new THREE.BoxGeometry(w, 0.22, 0.3), glow("sodium", PIXEL ? 1.1 : 2.2), ground.position.x, -0.6, PLATE.z0 - 2.05, scene);
  }

  // ============================================================
  // The sprawl: past the plate's edge, an industrial plain to the haze
  // ============================================================
  const SPRAWL_Y = -200 * Z;
  let holo = null;
  function buildSprawl() {
    // the plain: a carpet of tiny lights in street patterns, too far for detail
    const carpet = tex(PIXEL ? 256 : 1024, PIXEL ? 256 : 1024, (c, w, h) => {
      c.fillStyle = "#000";
      c.fillRect(0, 0, w, h);
      const r = rng(31), s = w / 256;
      for (let y = 0; y < h; y += 8 * s) {
        for (let x = 0; x < w; x += 2 * s) {
          const block = hash2(Math.floor(x / (32 * s)), Math.floor(y / (32 * s)), 4);
          if (r() > 0.25 + block * 0.5) continue;
          c.fillStyle = r() < 0.8 ? `rgba(255,${150 + r() * 60 | 0},70,${0.4 + r() * 0.6})` : r() < 0.5 ? "rgba(200,230,255,0.8)" : "rgba(255,60,50,0.8)";
          c.fillRect(x, y, s, s);
        }
      }
      for (let x = 0; x < w; x += 8 * s) {
        for (let y = 0; y < h; y += 3 * s) {
          if (r() < 0.55) continue;
          c.fillStyle = `rgba(255,${140 + r() * 60 | 0},60,${0.3 + r() * 0.5})`;
          c.fillRect(x, y, s, s);
        }
      }
    }, true);
    carpet.repeat.set(6, 3);
    const plain = mesh(new THREE.PlaneGeometry(3400 * Z, 1700 * Z), new THREE.MeshBasicMaterial({ map: carpet, color: C("#ffffff", PIXEL ? 1.1 : 1.9), fog: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), 0, SPRAWL_Y, -900 * Z, scene);
    plain.rotation.x = -Math.PI / 2;
    // the haze over it, lit orange from below: the silhouettes stand dark against it
    const rise = tex(4, 128, (c, w, h) => {
      const grd = c.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(0.4, "rgba(60,60,60,0.25)");
      grd.addColorStop(0.75, "rgba(200,120,40,0.6)");
      grd.addColorStop(1, "rgba(255,170,70,0.9)");
      c.fillStyle = grd;
      c.fillRect(0, 0, w, h);
    });
    const smogGlow = mesh(new THREE.PlaneGeometry(2600 * Z, 420 * Z), new THREE.MeshBasicMaterial({ map: rise, color: C("#ffffff", PIXEL ? 0.45 : 0.5), fog: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 0, SPRAWL_Y + 90 * Z, -520 * Z, scene);
    smogGlow.rotation.x = -0.2;

    // blocks, tanks and stacks rising out of the plain; tops within the frame
    const boxes = [];
    const r = rng(88);
    for (let n = 0; n < 150; n++) {
      const z = lerp(-80, -560, r() ** 0.75) * Z, spread = lerp(260, 900, (-z / Z - 80) / 480) * Z;
      const x = (r() - 0.5) * spread;
      const [gx, gz] = toGrid(x, z);
      const band = frameTop(z) - lipY(z);
      const big = r() < 0.18;
      const w = big ? 26 + r() * 20 : 8 + r() * 14, d = big ? 22 + r() * 18 : 8 + r() * 12;
      const top = lipY(z) + band * (big ? lerp(0.5, 1.4, r()) : lerp(-0.4, 0.55, r()));
      const base = SPRAWL_Y - 4;
      if (top < base + 4) continue;
      const seed = litSeed(0.2 + r() * 0.35, 60 + n);
      boxes.push(seeded(new THREE.BoxGeometry(w, top - base, d).rotateY(GRID).translate(x, (top + base) / 2, z), seed));
      if (big && r() < 0.6) {
        const [tx, tz] = toWorld(gx, gz);
        beacons.push([tx, top + 0.5, tz, r() * 6]);
      }
    }
    scene.add(new THREE.Mesh(X.mergeGeometries(boxes), BRUTAL));
    boxes.forEach((b) => b.dispose());

    // flare stacks: tall chimneys that burn off gas, now and then in a burst of fire
    const stackGeo = [];
    const fr = rng(12);
    for (let n = 0; n < 11; n++) {
      const z = lerp(-110, -470, fr()) * Z, x = (fr() - 0.5) * lerp(300, 900, (-z / Z - 110) / 360) * Z;
      const top = lipY(z) + (frameTop(z) - lipY(z)) * lerp(0.25, 0.6, fr());
      flareStack(x, z, SPRAWL_Y, top - SPRAWL_Y, (frameTop(z) - lipY(z)) * 0.9 * (0.6 + fr() * 0.5), stackGeo, fr);
    }
    scene.add(new THREE.Mesh(X.mergeGeometries(stackGeo), std("#1a1b1e", 0.8, 0.4)));

    // the hologram: a woman's head and shoulders, rising out of the sprawl
    const hz = -250 * Z, hy0 = lipY(hz), hy1 = frameTop(hz);
    const holoTex = liveTex(PIXEL ? 96 : 384, PIXEL ? 128 : 512);
    const holoH = (hy1 - hy0) * 1.25, holoW = holoH * 0.75;
    const holoMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uMap: { value: holoTex.t }, uTime: U.time, uGain: { value: PIXEL ? 1.0 : 1.8 }, uA: { value: C("neonPink") }, uB: { value: C("tealN") } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform float uTime, uGain; uniform vec3 uA, uB; varying vec2 vUv;
        void main() {
          vec2 uv = vUv;
          float glitch = step(0.985, fract(sin(floor(uTime * 9.0) * 12.9898) * 43758.5)) * 0.03;
          uv.x += glitch * sin(uv.y * 80.0);
          vec4 t = texture2D(uMap, uv);
          float scan = 0.65 + 0.35 * step(0.5, fract(uv.y * ${PIXEL ? "64.0" : "180.0"} - uTime * 2.0));
          vec3 col = mix(uA, uB, smoothstep(0.2, 0.9, uv.y + sin(uTime * 0.3) * 0.2)) * t.r + vec3(1.0, 0.9, 0.95) * t.g;
          gl_FragColor = vec4(col * scan * uGain * (0.85 + 0.15 * sin(uTime * 13.0)), 1.0);
        }`,
    });
    const holoMesh = mesh(new THREE.PlaneGeometry(holoW, holoH), holoMat, 60 * Z, hy0 - holoH * 0.08 + holoH / 2, hz, scene);
    holoMesh.lookAt(cam0.x, holoMesh.position.y, cam0.z);
    holo = { tex: holoTex, mesh: holoMesh, last: -1 };
    drawHolo(0);
  }
  // the hologram's portrait: a profile under a high chignon, an earring, a fan
  // of glyphs behind her. Red channel: the figure's light; green: its highlights.
  function drawHolo(t) {
    const { c, g, t: tx } = holo.tex, w = c.width, h = c.height, s = w / 96;
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    g.save();
    g.scale(s, s);
    const blink = hash2(Math.floor(t * 2), 3, 1) < 0.08;
    const turn = Math.sin(t * 0.25) * 2;
    // the fan behind her
    g.fillStyle = "rgba(255,0,0,0.35)";
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI * 0.95 + (k / 8) * Math.PI * 0.7;
      g.beginPath();
      g.moveTo(52, 44);
      g.arc(52, 44, 40, a, a + 0.07);
      g.closePath();
      g.fill();
    }
    // shoulders and neck
    g.fillStyle = "rgba(255,0,0,0.75)";
    g.beginPath();
    g.moveTo(8, 128);
    g.bezierCurveTo(12, 104, 30, 96, 44, 94);
    g.lineTo(46, 78);
    g.lineTo(58, 78);
    g.lineTo(60, 94);
    g.bezierCurveTo(74, 96, 88, 104, 92, 128);
    g.closePath();
    g.fill();
    // the head in profile, facing left
    g.beginPath();
    g.moveTo(60 + turn, 30);
    g.bezierCurveTo(66 + turn, 40, 66 + turn, 64, 58, 80);
    g.lineTo(46, 84);
    g.bezierCurveTo(42, 78, 40, 74, 40, 72);
    g.lineTo(36 + turn, 70); // chin
    g.bezierCurveTo(34 + turn, 66, 36 + turn, 64, 36 + turn, 62); // lips
    g.lineTo(33 + turn, 58); // nose tip
    g.bezierCurveTo(34 + turn, 54, 37 + turn, 50, 38 + turn, 46); // brow
    g.bezierCurveTo(38 + turn, 36, 46 + turn, 30, 60 + turn, 30);
    g.closePath();
    g.fill();
    // the chignon and its pins
    g.beginPath();
    g.ellipse(58 + turn, 26, 13, 11, 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,0,0,1)";
    g.fillRect(50 + turn, 12, 22, 1.2);
    g.fillRect(52 + turn, 18, 20, 1);
    // highlights: lips, the eye, the earring (green channel)
    g.globalCompositeOperation = "lighter";
    g.fillStyle = "rgba(0,255,0,0.9)";
    g.fillRect(35 + turn, 63, 3, 2);
    g.fillRect(40 + turn, 50, 4, blink ? 0.6 : 1.6);
    g.beginPath();
    g.arc(52 + turn * 0.5, 66 + Math.sin(t * 2) * 0.8, 2.2, 0, Math.PI * 2);
    g.fill();
    g.restore();
    tx.needsUpdate = true;
  }

  // ============================================================
  // The places, each on its own base
  // ============================================================
  const places = {};
  const STATION_COLOR = { hub: "sodium", knowledge: "research", documents: "analyze", models: "model", repos: "build", tests: "test", memory: "remember", deploy: "deploy" };
  function plinth(k, group, tall = 1.2) {
    const { r } = SITE[k];
    mesh(new THREE.BoxGeometry(r * 2, tall, r * 2), M.slab, 0, tall / 2, 0, group).rotation.y = GRID;
    // a thin rim in the station's colour, and sodium corner lamps
    const rim = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(r * 2 + 0.1, 0.01, r * 2 + 0.1)), lineGlow(STATION_COLOR[k], PIXEL ? 1.3 : 2.6));
    rim.position.y = tall;
    rim.rotation.y = GRID;
    group.add(rim);
    const pool = mesh(new THREE.CircleGeometry(r * 1.5, 40), haze(STATION_COLOR[k], 0.28, 0.2), 0, 0.04, 0, group);
    pool.rotation.x = -Math.PI / 2;
    pool.material.map = softDot;
  }
  function buildPlaces() {
    for (const k of Object.keys(SITE)) {
      const group = new THREE.Group();
      group.position.set(SITE[k].x, 0, SITE[k].z);
      scene.add(group);
      if (k !== "hub") plinth(k, group);
      places[k] = { group, update: () => {}, top: new THREE.Vector3(SITE[k].x, SITE[k].h * 0.6, SITE[k].z) };
      BUILD[k](places[k], group);
      const light = new THREE.PointLight(C(STATION_COLOR[k]), PIXEL ? 80 : 130, 34, 1.5);
      light.position.set(0, 6, 3);
      group.add(light);
    }
  }
  // a spot in a block's own frame (along its street, out from it), turned with the street grid
  const along = (g, lx, lz) => toWorld(lx, lz);
  const BUILD = {
    // The pyramid: a stepped ziggurat of lit terraces over its landing pad, a
    // warm crown on top, lights climbing its faces.
    hub(p, g) {
      const { w, step, back } = PYR;
      const [px, pz] = along(g, 0, back);
      const pyr = pyramid(g, px, pz, PYR, 70);
      // the pad: a deck out from the third terrace, where the runners set down
      const padY = DOCK_PAD;
      mesh(new THREE.BoxGeometry(16, 0.6, 12), M.metal, 0, padY - 0.3, 0, g).rotation.y = GRID;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const [lx, lz] = along(g, sx * 6.5, sz * 4.5);
        mesh(new THREE.CylinderGeometry(0.5, 0.7, padY - 0.6, 8), M.concrete, lx, (padY - 0.6) / 2, lz, g);
      }
      const padLights = [];
      for (let i = 0; i < 16; i++) {
        const side = i < 8 ? 1 : -1, f = ((i % 8) / 7 - 0.5) * 15;
        const [lx, lz] = along(g, f, side * 5.8);
        padLights.push(mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), glow("sodiumHi", PIXEL ? 1.3 : 3.5), lx, padY + 0.1, lz, g));
      }
      const marks = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(12, 0.01, 8)), lineGlow("sodium", PIXEL ? 1.1 : 2.2));
      marks.position.y = padY + 0.02;
      marks.rotation.y = GRID;
      g.add(marks);
      // the hangar mouth behind the pad
      const [hx, hz] = along(g, 0, back + w / 2 - step * 3 + 0.2);
      const mouth = mesh(new THREE.PlaneGeometry(10, 3.4), glow("sodiumHi", PIXEL ? 1.2 : 2.6), hx, padY + 1.7, hz, g);
      mouth.rotation.y = GRID;
      p.top.set(SITE.hub.x, padY + 1, SITE.hub.z);
      p.update = (t) => {
        pyr.update(t);
        const lead = Math.floor(t * 10) % 8;
        padLights.forEach((l, i) => l.scale.setScalar(i % 8 === lead ? 1.9 : 1));
      };
    },
    // The archive: a windowless concrete vault, racks glowing in its open face, a mast
    knowledge(p, g) {
      const body = mesh(new THREE.BoxGeometry(9, 7, 7), M.concrete, 0, 1.2 + 3.5, 0, g);
      body.rotation.y = GRID;
      const racks = liveTex(PIXEL ? 48 : 192, PIXEL ? 24 : 96);
      const [fx, fz] = along(g, 0, 3.52);
      const front = mesh(new THREE.PlaneGeometry(7.4, 3.6), new THREE.MeshBasicMaterial({ map: racks.t, toneMapped: false, color: C("#ffffff", PIXEL ? 1.1 : 1.8) }), fx, 3.6, fz, g);
      front.rotation.y = GRID;
      const drawRacks = (t) => {
        const c = racks.g, w = racks.c.width, h = racks.c.height, s = w / 48;
        c.fillStyle = "#0a0806";
        c.fillRect(0, 0, w, h);
        for (let r = 0; r < 6; r++) {
          c.fillStyle = "#1e1812";
          c.fillRect((1 + r * 8) * s, 1 * s, 6 * s, 22 * s);
          for (let u = 0; u < 10; u++) {
            for (let l = 0; l < 3; l++) {
              const on = hash2(r * 31 + l, u + Math.floor(t * 5 + r * 3.3 + l), 3) < 0.45;
              c.fillStyle = on ? (hash2(r, u, 4) < 0.75 ? NOIR.sodium : NOIR.tealN) : "#2a2218";
              c.fillRect((2 + r * 8 + l * 1.7) * s, (2 + u * 2) * s, Math.max(1, s), Math.max(1, s));
            }
          }
        }
        racks.t.needsUpdate = true;
      };
      drawRacks(0);
      // slit windows along the flank, a heavy cornice, the mast
      for (let i = 0; i < 5; i++) {
        const [sx, sz] = along(g, 4.52, -2.6 + i * 1.3);
        const slit = mesh(new THREE.PlaneGeometry(0.2, 4.5), glow("sodium", PIXEL ? 1 : 1.8), sx, 5, sz, g);
        slit.rotation.y = GRID + Math.PI / 2;
      }
      mesh(new THREE.BoxGeometry(10, 0.6, 8), M.slab, 0, 8.5, 0, g).rotation.y = GRID;
      const [mx, mz] = along(g, -3, -2);
      mesh(new THREE.CylinderGeometry(0.1, 0.22, 9, 6), M.metal, mx, 13, mz, g);
      for (const y of [11, 14, 17.3]) mesh(new THREE.BoxGeometry(1.4 - (y - 11) * 0.12, 0.08, 0.08), M.metal, mx, y, mz, g).rotation.y = GRID;
      const blink = mesh(new THREE.SphereGeometry(0.22, 8, 6), glow("neonRed", PIXEL ? 1.4 : 4), mx, 17.6, mz, g);
      p.top.set(SITE.knowledge.x, 8.8, SITE.knowledge.z);
      let last = 0;
      p.update = (t) => {
        if (t - last > 0.15) {
          last = t;
          drawRacks(t);
        }
        blink.visible = Math.sin(t * 2.4) > 0;
      };
    },
    // The night market: stalls under tarps, a noodle counter, lanterns, a
    // board of notices, pages turning in holo light over it all
    documents(p, g) {
      const TARP = ["#1f5a5e", "#6a1e22", "#2a3a4a", "#5a4a20"];
      const lanterns = [];
      [[-3, -1.6, 0], [0.4, -2.2, 1], [3.2, -1, 2], [-1.6, 2, 3], [2.2, 2.4, 0]].forEach(([lx, lz, c], i) => {
        const [x, z] = along(g, lx, lz);
        mesh(new THREE.BoxGeometry(2.6, 1.8, 2), M.dark, x, 1.2 + 0.9, z, g).rotation.y = GRID;
        const tarp = mesh(new THREE.BoxGeometry(3.2, 0.1, 2.6), std(TARP[c], 0.8, 0.1, { emissive: C(TARP[c], 0.25) }), x, 3.3, z, g);
        tarp.rotation.set(0.2, GRID, 0);
        const [cx, cz] = along(g, lx, lz + 1.05);
        const counter = mesh(new THREE.BoxGeometry(2.4, 0.35, 0.1), glow(i % 2 ? "sodiumHi" : "tealN", PIXEL ? 1.2 : 2.4), cx, 2.2, cz, g);
        counter.rotation.y = GRID;
        lanterns.push(mesh(new THREE.SphereGeometry(0.22, 8, 6), glow(i % 2 ? "neonRed" : "sodium", PIXEL ? 1.3 : 3.2), cx + 0.8, 3, cz + 0.2, g));
      });
      // the notice board: a lit wall of pinned sheets
      const board = tex(PIXEL ? 32 : 128, PIXEL ? 20 : 80, (c, w, h) => {
        c.fillStyle = "#15120e";
        c.fillRect(0, 0, w, h);
        const r = rng(8), s = w / 32;
        for (let k = 0; k < 14; k++) {
          c.fillStyle = r() < 0.7 ? "#e8dcc0" : r() < 0.5 ? NOIR.sodium : NOIR.tealN;
          const x = r() * (w - 6 * s), y = r() * (h - 7 * s);
          c.fillRect(x, y, 5 * s, 6 * s);
          c.fillStyle = "#6a5a40";
          for (let l = 1; l < 5; l++) c.fillRect(x + s, y + l * 1.2 * s, 3 * s * r() + s, Math.max(1, s * 0.4));
        }
      });
      const [bx, bz] = along(g, 0, -3.4);
      mesh(new THREE.BoxGeometry(6, 4.4, 0.4), M.concrete, bx, 1.2 + 2.2, bz, g).rotation.y = GRID;
      const [fx, fz] = along(g, 0, -3.18);
      mesh(new THREE.PlaneGeometry(5.4, 3.6), new THREE.MeshBasicMaterial({ map: board, toneMapped: false, color: C("#ffffff", PIXEL ? 0.9 : 1.4) }), fx, 3.5, fz, g).rotation.y = GRID;
      const [sx, sz] = along(g, 3.4, -3.2);
      mesh(new THREE.PlaneGeometry(0.9, 4.6), new THREE.MeshBasicMaterial({ map: glyphTex, toneMapped: false, color: C("neonRed", PIXEL ? 1.3 : 2.6) }), sx, 4, sz, g).rotation.y = GRID;
      const page = tex(PIXEL ? 12 : 64, PIXEL ? 16 : 84, (c, w, h) => {
        c.fillStyle = "#e8f6f4";
        c.fillRect(0, 0, w, h);
        c.fillStyle = NOIR.teal2;
        c.fillRect(0, 0, w, h * 0.12);
        c.fillStyle = "#4a6a6a";
        for (let y = h * 0.22; y < h * 0.92; y += h * 0.1) c.fillRect(w * 0.12, y, w * (0.5 + hash2(y | 0, 1, 2) * 0.35), Math.max(1, h * 0.035));
      });
      const docs = [];
      for (let i = 0; i < 5; i++) {
        const d = mesh(new THREE.PlaneGeometry(1.4, 1.9), new THREE.MeshBasicMaterial({ map: page, toneMapped: false, color: C("#ffffff", PIXEL ? 0.9 : 1.3), side: THREE.DoubleSide, transparent: true, opacity: 0.85 }), 0, 0, 0, g);
        d.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.5, 2)), lineGlow("tealN", PIXEL ? 1.2 : 2.4)));
        docs.push(d);
      }
      p.top.set(SITE.documents.x, 6, SITE.documents.z);
      const [vx, vz] = along(g, 0.4, -1.2);
      p.steam = [new THREE.Vector3(SITE.documents.x + vx, 3.4, SITE.documents.z + vz)];
      p.update = (t) => {
        docs.forEach((d, i) => {
          const a = t * 0.3 + (i / docs.length) * Math.PI * 2;
          d.position.set(Math.cos(a) * 3.4, 7 + Math.sin(t * 1.2 + i) * 0.5 + (i % 2) * 1.1, Math.sin(a) * 3.4);
          d.rotation.y = -a + Math.PI / 2;
        });
        lanterns.forEach((l, i) => l.scale.setScalar(0.9 + 0.12 * Math.sin(t * 2 + i)));
      };
    },
    // The Eye Works: a ribbed round tower under a giant eye that looks about and blinks
    models(p, g) {
      const H = 14;
      mesh(seeded(new THREE.CylinderGeometry(2.6, 3.2, H, PIXEL ? 12 : 24), litSeed(0.55, 8)), TOWER_HI, 0, 1.2 + H / 2, 0, g);
      for (let y = 3; y < H; y += 2.2) {
        const band = mesh(new THREE.TorusGeometry(3.05 - (y / H) * 0.5, 0.07, 4, PIXEL ? 20 : 40), glow("model", PIXEL ? 0.9 : 1.6), 0, 1.2 + y, 0, g);
        band.rotation.x = Math.PI / 2;
      }
      mesh(new THREE.CylinderGeometry(3.4, 2.6, 1, PIXEL ? 12 : 24), M.metal, 0, 1.2 + H + 0.5, 0, g);
      // the eye: an iris drawn to a canvas, on a disc turned to the camera
      const eyeTex = liveTex(PIXEL ? 32 : 128, PIXEL ? 32 : 128);
      const eye = new THREE.Group();
      eye.position.set(0, 1.2 + H + 5.2, 0);
      g.add(eye);
      mesh(new THREE.CircleGeometry(4, PIXEL ? 20 : 48), new THREE.MeshBasicMaterial({ map: eyeTex.t, toneMapped: false, color: C("#ffffff", PIXEL ? 1.1 : 1.9), transparent: true }), 0, 0, 0, eye);
      const ring = mesh(new THREE.TorusGeometry(4.15, 0.12, 4, PIXEL ? 24 : 64), glow("model", PIXEL ? 1.3 : 3), 0, 0, 0.02, eye);
      eye.lookAt(cam0);
      const drawEye = (t, open) => {
        const c = eyeTex.g, w = eyeTex.c.width, s = w / 32;
        c.clearRect(0, 0, w, w);
        c.save();
        c.beginPath();
        c.ellipse(w / 2, w / 2, w * 0.48, w * 0.48 * open, 0, 0, Math.PI * 2);
        c.clip();
        c.fillStyle = "#e8e4dc";
        c.fillRect(0, 0, w, w);
        const lx = Math.sin(t * 0.7) * 3 * s, ly = Math.sin(t * 0.43) * 1.2 * s;
        const grd = c.createRadialGradient(w / 2 + lx, w / 2 + ly, 0, w / 2 + lx, w / 2 + ly, 9 * s);
        grd.addColorStop(0, "#050608");
        grd.addColorStop(0.35, "#050608");
        grd.addColorStop(0.38, "#1f8a96");
        grd.addColorStop(0.75, "#3cc8d0");
        grd.addColorStop(0.95, "#0c2a30");
        grd.addColorStop(1, "#e8e4dc");
        c.fillStyle = grd;
        c.beginPath();
        c.arc(w / 2 + lx, w / 2 + ly, 9 * s, 0, Math.PI * 2);
        c.fill();
        // the flares, caught in the eye
        c.fillStyle = NOIR.flare;
        c.fillRect(w / 2 + lx - 4 * s, w / 2 + ly - 3 * s, 2 * s, 1.2 * s);
        c.fillStyle = "#fff4e0";
        c.fillRect(w / 2 + lx + 2 * s, w / 2 + ly - 4 * s, 1.4 * s, 1.4 * s);
        c.restore();
        eyeTex.t.needsUpdate = true;
      };
      drawEye(0, 1);
      p.top.set(SITE.models.x, 1.2 + H, SITE.models.z);
      let last = -1;
      p.update = (t) => {
        if (t - last < 0.12) return;
        last = t;
        const b = (t % 6.5) / 6.5;
        const open = b > 0.96 ? Math.abs(b - 0.98) / 0.02 : 1;
        drawEye(t, Math.max(0.05, open));
        ring.scale.setScalar(1 + 0.03 * Math.sin(t * 4));
      };
    },
    // The foundry: tanks, pipes, a stack burning off, container stacks in rust
    repos(p, g) {
      const COLS = ["#6a2e1c", "#1f4a4e", "#5a4a1a", "#3a2a3e", "#2a3a2a"];
      const ribs = tex(32, 16, (c, w, h) => {
        for (let x = 0; x < w; x++) {
          c.fillStyle = x % 4 < 2 ? "#ffffff" : "#a8a8b0";
          c.fillRect(x, 0, 1, h);
        }
      }, true);
      ribs.repeat.set(4, 1);
      const r = rng(23);
      for (let sx = -1; sx <= 0; sx++) {
        for (let sz = -1; sz <= 1; sz++) {
          const n = 1 + Math.floor(r() * 3);
          for (let k = 0; k < n; k++) {
            const [x, z] = along(g, sx * 3 + 0.5, sz * 1.8);
            const c = mesh(new THREE.BoxGeometry(2.8, 1.3, 1.6), new THREE.MeshStandardMaterial({ map: ribs, color: C(COLS[Math.floor(r() * COLS.length)]), roughness: 0.8, metalness: 0.3, flatShading: PIXEL }), x, 1.2 + 0.65 + k * 1.32, z, g);
            c.rotation.y = GRID;
          }
        }
      }
      // tanks and the stack
      for (const [lx, lz, rr, hh] of [[3.6, -2.4, 1.7, 5], [3.4, 1.6, 1.3, 3.6]]) {
        const [x, z] = along(g, lx, lz);
        mesh(new THREE.CylinderGeometry(rr, rr, hh, PIXEL ? 12 : 24), M.rust, x, 1.2 + hh / 2, z, g);
        mesh(new THREE.TorusGeometry(rr + 0.02, 0.06, 4, 24), glow("sodium", PIXEL ? 0.9 : 1.6), x, 1.2 + hh - 0.4, z, g).rotation.x = Math.PI / 2;
      }
      const [kx, kz] = along(g, -4.6, -3.4);
      mesh(new THREE.CylinderGeometry(0.55, 0.8, 16, 10), M.dark, kx, 1.2 + 8, kz, g);
      const fire = mesh(new THREE.PlaneGeometry(2.4, 4.4), null, kx, 1.2 + 16 + 2, kz, g);
      fire.material = fireMat(3.1, PIXEL ? 1.2 : 2.8);
      fire.lookAt(cam0.x, fire.position.y, cam0.z);
      const fireLight = new THREE.PointLight(C("flare"), PIXEL ? 60 : 90, 26, 1.6);
      fireLight.position.set(kx, 17, kz);
      g.add(fireLight);
      // pipes between them
      for (const [a, b] of [[[3.6, -2.4], [-4.6, -3.4]], [[3.4, 1.6], [3.6, -2.4]]]) {
        const [ax, az] = along(g, ...a), [bx, bz] = along(g, ...b);
        const len = Math.hypot(bx - ax, bz - az);
        const pipe = mesh(new THREE.CylinderGeometry(0.18, 0.18, len, 6), M.metal, (ax + bx) / 2, 4.2, (az + bz) / 2, g);
        pipe.rotation.set(Math.PI / 2, 0, 0);
        pipe.lookAt(new THREE.Vector3(bx + SITE.repos.x, 4.2, bz + SITE.repos.z));
        pipe.rotateX(Math.PI / 2);
      }
      const [gx, gz] = along(g, 5.2, 3.6);
      mesh(new THREE.PlaneGeometry(0.9, 3.8), new THREE.MeshBasicMaterial({ map: glyphTex, toneMapped: false, color: C("build", PIXEL ? 1.2 : 2.4) }), gx, 4, gz, g).rotation.y = GRID;
      p.top.set(SITE.repos.x, 5.5, SITE.repos.z);
      p.steam = [new THREE.Vector3(SITE.repos.x + along(g, 3.6, -2.4)[0], 7, SITE.repos.z + along(g, 3.6, -2.4)[1])];
      p.update = (t) => {
        fireLight.intensity = (PIXEL ? 60 : 90) * (0.8 + 0.25 * Math.sin(t * 9) * Math.sin(t * 3.7));
      };
    },
    // The precinct: a bunker under a scanning dome, a slim tower with a spinner pad
    // and a searchlight, blue and red on the roof
    tests(p, g) {
      mesh(new THREE.BoxGeometry(6, 2.8, 4.4), M.concrete, 0, 1.2 + 1.4, 0, g).rotation.y = GRID;
      const [ex, ez] = along(g, 0, 2.22);
      const eye = mesh(new THREE.BoxGeometry(2.6, 0.26, 0.08), glow("test", PIXEL ? 1.3 : 3), ex, 3.4, ez, g);
      eye.rotation.y = GRID;
      const field = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uTime: U.time, uAlarm: U.alarm, uCol: { value: C("test") }, uBad: { value: C("red") }, uGain: { value: PIXEL ? 1.2 : 2.4 } },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vP; varying vec3 vV;
          void main() {
            vP = position;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vN = normalize(mat3(modelMatrix) * normal);
            vV = normalize(cameraPosition - wp.xyz);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime, uAlarm, uGain; uniform vec3 uCol, uBad;
          varying vec3 vN; varying vec3 vP; varying vec3 vV;
          void main() {
            float lat = asin(clamp(vP.y / length(vP), -1.0, 1.0));
            float lines = smoothstep(0.85, 1.0, sin(lat * 60.0)) * 0.4;
            float rim = pow(1.0 - abs(dot(vN, vV)), 2.5);
            float sweep = smoothstep(0.93, 1.0, sin(lat * 6.0 - uTime * 2.0));
            vec3 col = mix(uCol, uBad, uAlarm);
            float flicker = 1.0 - uAlarm * step(0.7, fract(sin(floor(uTime * 14.0)) * 43758.5));
            gl_FragColor = vec4(col * (lines + rim * 0.9 + sweep * 0.5 + 0.02) * uGain * flicker, 1.0);
          }`,
      });
      mesh(new THREE.SphereGeometry(SITE.tests.r - 0.3, PIXEL ? 24 : 64, PIXEL ? 12 : 32, 0, Math.PI * 2, 0, Math.PI / 2), field, 0, 1.2, 0, g);
      // the tower
      const [tx, tz] = along(g, 3.6, -3.2);
      mesh(seeded(new THREE.BoxGeometry(2.2, 12, 2.2).rotateY(GRID), litSeed(0.4, 9)), TOWER, tx, 1.2 + 6, tz, g);
      mesh(new THREE.BoxGeometry(4.2, 0.4, 4.2), M.metal, tx, 13.4, tz, g).rotation.y = GRID;
      const strobes = [mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), glow("police", PIXEL ? 1.4 : 4.5), tx - 1.6, 13.8, tz, g), mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), glow("neonRed", PIXEL ? 1.4 : 4.5), tx + 1.6, 13.8, tz, g)];
      // a parked spinner on the pad
      const parked = mesh(new THREE.BoxGeometry(2.6, 0.6, 1.2), std("#2a2e36", 0.3, 0.7), tx, 14, tz, g);
      parked.rotation.y = GRID + 0.4;
      const beam = new THREE.Group();
      beam.position.set(tx, 13.9, tz);
      g.add(beam);
      beam.add(new THREE.Mesh(new THREE.ConeGeometry(3, 40, 24, 1, true).translate(0, -20, 0).rotateX(Math.PI), shaftMat(C("spot", PIXEL ? 0.3 : 0.4))));
      p.top.set(SITE.tests.x, 5, SITE.tests.z);
      p.update = (t) => {
        eye.scale.x = 0.6 + 0.4 * Math.abs(Math.sin(t * 2));
        const on = Math.floor(t * 4) % 2;
        strobes[0].visible = !!on;
        strobes[1].visible = !on;
        beam.rotation.set(Math.cos(t * 0.3) * 0.5 + 0.9, 0, Math.sin(t * 0.37) * 0.6);
      };
    },
    // The memory dome: a glass bubble, warm inside, with snow falling on a small tree
    memory(p, g) {
      const R = SITE.memory.r - 0.6;
      const dome = mesh(new THREE.SphereGeometry(R, PIXEL ? 20 : 48, PIXEL ? 10 : 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: C("#9ab8c0"), roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.22, depthWrite: false, flatShading: PIXEL }), 0, 1.2, 0, g);
      dome.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.SphereGeometry(R, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2)), lineGlow("remember", PIXEL ? 0.9 : 1.4, 0.6)));
      const warm = mesh(new THREE.CircleGeometry(R * 0.9, 32), haze("sodium", 0.5, 0.5), 0, 1.25, 0, g);
      warm.rotation.x = -Math.PI / 2;
      warm.material.map = softDot;
      // the tree: a trunk and three cones of dark green, a star of light
      mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.6, 6), std("#3a2418"), 0, 2, 0, g);
      for (let i = 0; i < 3; i++) mesh(new THREE.ConeGeometry(1.8 - i * 0.45, 1.6, PIXEL ? 6 : 12), std("#1a3a2a", 0.8, 0.05), 0, 3 + i * 1, 0, g);
      mesh(new THREE.SphereGeometry(0.18, 8, 6), glow("sodiumHi", PIXEL ? 1.3 : 3), 0, 5.8, 0, g);
      const light = new THREE.PointLight(C("sodium"), PIXEL ? 50 : 80, 12, 1.4);
      light.position.set(0, 4, 0);
      g.add(light);
      // snow inside the dome
      const n = PIXEL ? 60 : 180;
      const snowPos = new Float32Array(n * 3), seeds = [];
      for (let i = 0; i < n; i++) seeds.push([rand() * Math.PI * 2, Math.sqrt(rand()) * R * 0.85, rand()]);
      const snowGeo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
      g.add(new THREE.Points(snowGeo, pointsMaterial(C("#ffffff", PIXEL ? 1 : 1.6), PIXEL ? 1 : 0.14)));
      p.top.set(SITE.memory.x, 6, SITE.memory.z);
      p.update = (t) => {
        seeds.forEach(([a, r, ph], i) => {
          const k = (ph + t * 0.06) % 1;
          const y = (1 - k) * R;
          const lim = Math.sqrt(Math.max(0, R * R - y * y)) * 0.92;
          const rr = Math.min(r, lim);
          snowPos.set([Math.cos(a + t * 0.2) * rr, 1.2 + y, Math.sin(a + t * 0.2) * rr], i * 3);
        });
        snowGeo.attributes.position.needsUpdate = true;
      };
    },
    // The off-world port: a launch gantry, a shuttle upright beside it, floodlights
    deploy(p, g) {
      const [gx, gz] = along(g, -3.6, -1.5);
      for (const [ox, oz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
        const [x, z] = along(g, -3.6 + ox, -1.5 + oz);
        mesh(new THREE.BoxGeometry(0.2, 18, 0.2), M.metal, x, 1.2 + 9, z, g);
      }
      for (let y = 3; y < 19; y += 2) mesh(new THREE.BoxGeometry(1.8, 0.14, 1.8), M.metal, gx, 1.2 + y, gz, g).rotation.y = GRID;
      const arms = [];
      for (const y of [8, 14]) {
        const [ax, az] = along(g, -1.8, -1.5);
        const arm = mesh(new THREE.BoxGeometry(2.4, 0.3, 0.5), M.metal, ax, 1.2 + y, az, g);
        arm.rotation.y = GRID;
        arms.push(arm);
      }
      // the shuttle
      const [sx, sz] = along(g, 0.6, -1.5);
      const ship = new THREE.Group();
      ship.position.set(sx, 1.2, sz);
      g.add(ship);
      mesh(new THREE.CylinderGeometry(1.3, 1.5, 11, PIXEL ? 12 : 24), std("#c8ccd0", 0.4, 0.5), 0, 5.8, 0, ship);
      mesh(new THREE.ConeGeometry(1.3, 3.4, PIXEL ? 12 : 24), std("#c8ccd0", 0.4, 0.5), 0, 13, 0, ship);
      mesh(new THREE.CylinderGeometry(1.32, 1.32, 1, PIXEL ? 12 : 24), glow("deploy", PIXEL ? 1.1 : 2.2), 0, 9.5, 0, ship);
      for (let k = 0; k < 4; k++) {
        const fin = mesh(new THREE.BoxGeometry(0.15, 2.6, 1.6), M.dark, 0, 1.4, 0, ship);
        fin.rotation.y = (k * Math.PI) / 2;
        fin.translateZ(1.5);
      }
      const exhaust = mesh(new THREE.PlaneGeometry(2.4, 3.2), null, 0, -1, 0, ship);
      exhaust.material = fireMat(7.3, PIXEL ? 0.8 : 1.6);
      exhaust.lookAt(cam0.x, 0.2, cam0.z);
      exhaust.rotateZ(Math.PI);
      // floodlights from the pad's corners, up the hull
      for (const s of [-1, 1]) {
        const [fx, fz] = along(g, 0.6 + s * 4.5, 3.8);
        const pivot = new THREE.Group();
        pivot.position.set(fx, 1.4, fz);
        g.add(pivot);
        pivot.add(new THREE.Mesh(new THREE.ConeGeometry(2.4, 18, 20, 1, true).translate(0, -9, 0).rotateX(Math.PI), shaftMat(C("spot", PIXEL ? 0.26 : 0.34))));
        pivot.lookAt(new THREE.Vector3(sx + SITE.deploy.x, 12, sz + SITE.deploy.z));
        pivot.rotateX(Math.PI / 2);
        mesh(new THREE.BoxGeometry(0.6, 0.4, 0.6), glow("spot", PIXEL ? 1.3 : 3.5), fx, 1.5, fz, g);
      }
      const beacon = mesh(new THREE.SphereGeometry(0.3, 8, 6), glow("neonRed", PIXEL ? 1.3 : 4), gx, 1.2 + 19.4, gz, g);
      p.top.set(SITE.deploy.x, 9, SITE.deploy.z);
      p.steam = [new THREE.Vector3(SITE.deploy.x + sx + 1.5, 1.6, SITE.deploy.z + sz), new THREE.Vector3(SITE.deploy.x + sx - 1.5, 1.6, SITE.deploy.z + sz)];
      p.update = (t) => {
        beacon.visible = Math.sin(t * 5) > 0;
        exhaust.visible = Math.sin(t * 0.4) > 0.3;
      };
    },
  };
  // the pad's height: the dock, less the height the runners hover at
  const DOCK_PAD = K.DOCK - 0.6;

  // a volume of light: bright along its axis, fading to the tip, soft at the sides
  function shaftMat(col) {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uCol: { value: col } },
      vertexShader: /* glsl */ `varying float vY; varying vec3 vN; varying vec3 vV;
        void main() { vY = uv.y; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */ `uniform vec3 uCol; varying float vY; varying vec3 vN; varying vec3 vV;
        void main() { float side = pow(abs(dot(vN, vV)), 1.5); gl_FragColor = vec4(uCol * vY * vY * side, 1.0); }`,
    });
  }
  // fire on a billboard: a flare stack's plume, bursting when uBurst rises
  function fireMat(ph, gain = PIXEL ? 1.3 : 3.2) {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: U.time, uPh: { value: ph }, uBurst: { value: 0 }, uGain: { value: gain } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: /* glsl */ `
        uniform float uTime, uPh, uBurst, uGain; varying vec2 vUv;
        float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
        float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
        void main() {
          vec2 p = vUv - vec2(0.5, 0.06);
          float t = uTime * 1.7 + uPh;
          float w = 0.1 + p.y * (0.35 + uBurst * 0.25);
          float d = abs(p.x + (n(vec2(p.y * 3.0, t * 0.7)) - 0.5) * 0.2 * p.y) / w;
          float f = fbm(vec2(p.x * 5.0, p.y * 3.5 - t * 2.2));
          float shape = (1.0 - d) + (f - 0.5) * 1.3 - p.y * (1.9 - uBurst * 1.1);
          float a = smoothstep(0.05, 0.7, shape) * smoothstep(-0.04, 0.02, p.y);
          vec3 col = mix(vec3(0.9, 0.18, 0.02), vec3(1.0, 0.62, 0.2), smoothstep(0.3, 0.9, shape));
          col = mix(col, vec3(1.0, 0.95, 0.78), smoothstep(0.85, 1.3, shape));
          gl_FragColor = vec4(col * a * uGain, 1.0);
        }`,
    });
  }

  // ============================================================
  // Life in the air: spinners, searchlights, the blimp, rain, a crowd below
  // ============================================================
  const lanes = [];
  let traffic = null, trafficLights = null, police = [];
  function buildTraffic() {
    const defs = [
      { axis: "x", c: -30 * Z, y: 20, dir: 1, n: 12, speed: 20 }, { axis: "x", c: -27 * Z, y: 23, dir: -1, n: 12, speed: 24 },
      { axis: "x", c: 22 * Z, y: 27, dir: 1, n: 10, speed: 22 },
      { axis: "x", c: -110 * Z, y: -30 * Z, dir: 1, n: 12, speed: 28 }, { axis: "x", c: -118 * Z, y: -36 * Z, dir: -1, n: 12, speed: 26 },
      { axis: "x", c: -170 * Z, y: -60 * Z, dir: 1, n: 14, speed: 32 }, { axis: "x", c: -230 * Z, y: -86 * Z, dir: -1, n: 14, speed: 30 },
      { axis: "z", c: -100 * Z, y: 17, dir: 1, n: 12, speed: 19 }, { axis: "z", c: 110 * Z, y: 18, dir: -1, n: 12, speed: 21 },
    ];
    let total = 0;
    for (const d of defs) {
      const cars = [];
      for (let i = 0; i < d.n; i++) cars.push({ o: rand(), lane: rand() - 0.5, cop: rand() < 0.15 });
      lanes.push({ ...d, cars, span: d.axis === "x" ? (440 + Math.max(0, -d.c / Z) * 1.2) * Z : 230 * Z });
      total += d.n;
    }
    // a spinner's hull: a wedge, longer than it is wide
    const hull = new THREE.BoxGeometry(2.4, 0.55, 1.1);
    const pos = hull.attributes.position;
    for (let i = 0; i < pos.count; i++) if (pos.getX(i) > 0 && pos.getY(i) > 0) pos.setY(i, 0.05);
    hull.computeVertexNormals();
    traffic = new THREE.InstancedMesh(hull, std("#24272e", 0.35, 0.7), total);
    trafficLights = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.26, 0.8), new THREE.MeshBasicMaterial({ toneMapped: false }), total * 3);
    let li = 0;
    for (const L of lanes) for (const car of L.cars) {
      trafficLights.setColorAt(li++, C("#ffffff", PIXEL ? 1.3 : 3.5));
      trafficLights.setColorAt(li++, C("neonRed", PIXEL ? 1.3 : 3));
      car.li = li;
      trafficLights.setColorAt(li++, car.cop ? C("police", PIXEL ? 1.4 : 4) : C("sodium", PIXEL ? 0.6 : 1));
      if (car.cop) police.push(car);
    }
    scene.add(traffic, trafficLights);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(1, 1, 1);
  const yUp = new THREE.Vector3(0, 1, 0);
  const copBlue = C("police", PIXEL ? 1.4 : 4), copRed = C("neonRed", PIXEL ? 1.4 : 4);
  function updateTraffic(t) {
    let i = 0, li = 0;
    for (const L of lanes) {
      const heading = L.axis === "x" ? (L.dir > 0 ? 0 : Math.PI) : L.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      q.setFromAxisAngle(yUp, heading);
      for (const car of L.cars) {
        const f = ((car.o + (t * L.speed * L.dir) / L.span) % 1 + 1) % 1;
        const al = (f - 0.5) * L.span;
        const x = L.axis === "x" ? al : L.c + car.lane * 3, z = L.axis === "x" ? L.c + car.lane * 3 : al * 0.6 + 10 * Z;
        const y = L.y + car.lane * (L.y < 0 ? 8 : 1.5);
        traffic.setMatrixAt(i++, m4.compose(v3.set(x, y, z), q, s3));
        const fx = Math.cos(heading), fz = -Math.sin(heading);
        trafficLights.setMatrixAt(li++, m4.compose(v3.set(x + fx * 1.2, y, z + fz * 1.2), q, s3));
        trafficLights.setMatrixAt(li++, m4.compose(v3.set(x - fx * 1.2, y, z - fz * 1.2), q, s3));
        trafficLights.setMatrixAt(li++, m4.compose(v3.set(x - fx * 0.2, y + 0.35, z - fz * 0.2), q, s3));
      }
    }
    for (const car of police) trafficLights.setColorAt(car.li, Math.floor(t * 5 + car.o * 20) % 2 ? copBlue : copRed);
    traffic.instanceMatrix.needsUpdate = true;
    trafficLights.instanceMatrix.needsUpdate = true;
    trafficLights.instanceColor.needsUpdate = true;
  }

  // Police spinners hovering over the streets, each with a searchlight on the ground
  const patrols = [];
  function buildPatrols() {
    const hullMat = std("#24272e", 0.35, 0.7);
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      mesh(new THREE.BoxGeometry(3, 0.7, 1.4), hullMat, 0, 0, 0, g);
      mesh(new THREE.BoxGeometry(1.2, 0.5, 1), M.glass, 0.4, 0.5, 0, g);
      const blue = mesh(new THREE.BoxGeometry(0.4, 0.2, 0.3), glow("police", PIXEL ? 1.4 : 4.5), -0.4, 0.55, -0.4, g);
      const red = mesh(new THREE.BoxGeometry(0.4, 0.2, 0.3), glow("neonRed", PIXEL ? 1.4 : 4.5), -0.4, 0.55, 0.4, g);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(4, 1, 24, 1, true).translate(0, -0.5, 0).rotateX(Math.PI), shaftMat(C("spot", PIXEL ? 0.28 : 0.36)));
      scene.add(cone);
      const spot = mesh(new THREE.CircleGeometry(4.5, 28), new THREE.MeshBasicMaterial({ map: softDot, color: C("spot", PIXEL ? 0.5 : 0.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), 0, 0.06, 0, scene);
      spot.rotation.x = -Math.PI / 2;
      g.scale.setScalar(1.2);
      scene.add(g);
      patrols.push({ g, blue, red, cone, spot, ph: i * 2.1, cx: (i - 1) * 60 * Z, cz: (i === 1 ? 45 : 10) * Z });
    }
  }
  const aimV = new THREE.Vector3();
  function updatePatrols(t) {
    for (const P of patrols) {
      const x = P.cx + Math.sin(t * 0.07 + P.ph) * 30 * Z, z = P.cz + Math.cos(t * 0.05 + P.ph * 1.3) * 18 * Z, y = 30 + Math.sin(t * 0.4 + P.ph) * 1.5;
      P.g.position.set(x, y, z);
      P.g.rotation.y = t * 0.07 + P.ph;
      // the light sweeps a little ahead and around
      const gx = x + Math.sin(t * 0.5 + P.ph) * 9, gz = z + Math.cos(t * 0.37 + P.ph) * 7;
      P.spot.position.set(gx, 0.06, gz);
      aimV.set(gx - x, -y, gz - z);
      const len = aimV.length();
      P.cone.position.set(x, y - 0.5, z);
      P.cone.scale.set(1, len, 1);
      P.cone.quaternion.setFromUnitVectors(yUp, aimV.normalize());
      const on = Math.floor(t * 5 + P.ph) % 2 === 0;
      P.blue.visible = on;
      P.red.visible = !on;
    }
  }

  // Searchlights from the sprawl, sweeping the smog
  const searchlights = [];
  function buildSearchlights() {
    const mat = shaftMat(C("#d8e4ff", PIXEL ? 0.32 : 0.42));
    for (const [x, z, ph] of [[-140, -170, 0], [-60, -260, 1.3], [90, -210, 2.6], [170, -150, 4]]) {
      const pivot = new THREE.Group();
      pivot.position.set(x * Z, SPRAWL_Y + 20, z * Z);
      pivot.add(new THREE.Mesh(new THREE.ConeGeometry(14 * Z, 300 * Z, 32, 1, true).translate(0, -150 * Z, 0).rotateX(Math.PI), mat));
      scene.add(pivot);
      searchlights.push({ pivot, ph });
    }
  }

  // The blimp: a long hull with a screen down its flank and lights on the city
  let blimp = null;
  const adCanvases = [];
  function buildBlimp() {
    const ad = liveTex(PIXEL ? 96 : 384, PIXEL ? 24 : 96);
    adCanvases.push({ ...ad, kind: "blimp" });
    blimp = new THREE.Group();
    const hull = mesh(new THREE.SphereGeometry(1, 32, 16), std("#3a3c40", 0.55, 0.5), 0, 0, 0, blimp);
    hull.scale.set(30, 7, 7);
    const screen = mesh(new THREE.PlaneGeometry(34, 8.5), new THREE.MeshBasicMaterial({ map: ad.t, toneMapped: false, color: C("#ffffff", PIXEL ? 1.1 : 1.5) }), 0, 0.5, 6.9, blimp);
    screen.rotation.x = -0.06;
    mesh(new THREE.BoxGeometry(9, 2.2, 3.4), M.dark, 0, -7.6, 0, blimp);
    for (const sz of [-1, 1]) mesh(new THREE.BoxGeometry(5, 0.4, 6), M.dark, -27, 0, sz * 3.2, blimp);
    for (const x of [-26, 0, 26]) mesh(new THREE.SphereGeometry(0.5, 8, 6), glow(x ? "neonRed" : "spot", PIXEL ? 1.3 : 3.5), x, x ? 0 : -8.8, x ? 0 : 0, blimp);
    // two lights hung under the gondola, down into the haze
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(10, 90, 24, 1, true).translate(0, -45, 0).rotateX(Math.PI), shaftMat(C("spot", PIXEL ? 0.22 : 0.3)));
      c.position.set(s * 4, -8.5, 0);
      c.rotation.set(Math.PI + 0.25, 0, s * 0.25);
      blimp.add(c);
    }
    scene.add(blimp);
  }

  // The giant screens: a face, an eye, a slogan, glyphs; each screen on its own page
  const ADS = [
    ["COLONY LINES", "a new world is hiring"],
    ["KIRIN SHOTO", "ice cold · all night"],
    ["SERENE", "sleep, then work"],
  ];
  function buildScreens() {
    for (const s of screens) {
      const ad = liveTex(PIXEL ? 64 : 256, PIXEL ? 36 : 144);
      adCanvases.push({ ...ad, kind: "screen", page: s.page });
      const m = mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshBasicMaterial({ map: ad.t, toneMapped: false, color: C("#ffffff", PIXEL ? 1.0 : 1.35) }), s.x, s.y, s.z, scene);
      m.rotation.y = s.ry;
      // the frame and its glow on the concrete
      const glowPlane = mesh(new THREE.PlaneGeometry(s.w * 1.6, s.h * 1.9), new THREE.MeshBasicMaterial({ map: softDot, color: C("#ff9a5a", PIXEL ? 0.25 : 0.35), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), s.x, s.y, s.z - 0.1, scene);
      glowPlane.rotation.y = s.ry;
    }
  }
  function drawAds(t) {
    for (const A of adCanvases) {
      const g = A.g, w = A.c.width, h = A.c.height, s = w / 64;
      if (A.kind === "blimp") {
        const k = Math.floor(t / 5) % ADS.length;
        g.fillStyle = "#080606";
        g.fillRect(0, 0, w, h);
        g.fillStyle = k === 0 ? NOIR.sodium : k === 1 ? NOIR.neonRed : NOIR.tealN;
        g.font = `bold ${Math.round(h * 0.46)}px sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(ADS[k][0], w / 2, h * 0.4);
        g.fillStyle = "#f0e6d8";
        g.font = `${Math.round(h * 0.22)}px sans-serif`;
        g.fillText(ADS[k][1], w / 2, h * 0.8);
        A.t.needsUpdate = true;
        continue;
      }
      const page = (Math.floor(t / 6) + A.page) % 4;
      g.fillStyle = "#070505";
      g.fillRect(0, 0, w, h);
      if (page === 0) {
        // a face in close-up, lips parting in a smile
        const grd = g.createLinearGradient(0, 0, w, 0);
        grd.addColorStop(0, "#3a1a10");
        grd.addColorStop(0.5, "#c07a50");
        grd.addColorStop(1, "#3a1a10");
        g.fillStyle = grd;
        g.beginPath();
        g.ellipse(w / 2, h * 0.62, w * 0.3, h * 0.62, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#101010";
        g.beginPath();
        g.ellipse(w / 2, h * 0.1, w * 0.34, h * 0.3, 0, Math.PI, Math.PI * 2);
        g.fill();
        g.fillRect(w * 0.16, h * 0.08, w * 0.68, h * 0.12);
        g.fillStyle = "#1a0c08";
        g.fillRect(w * 0.36, h * 0.42, w * 0.08, h * 0.05);
        g.fillRect(w * 0.56, h * 0.42, w * 0.08, h * 0.05);
        g.fillStyle = "#d8202a";
        const smile = 0.5 + 0.5 * Math.sin(t * 1.5);
        g.beginPath();
        g.ellipse(w / 2, h * 0.8, w * 0.07, h * (0.03 + smile * 0.04), 0, 0, Math.PI * 2);
        g.fill();
      } else if (page === 1) {
        // an eye, looking out over the city
        g.fillStyle = "#d8d0c4";
        g.beginPath();
        g.ellipse(w / 2, h / 2, w * 0.4, h * 0.3, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#1f8a96";
        g.beginPath();
        g.arc(w / 2 + Math.sin(t) * w * 0.08, h / 2, h * 0.24, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#050505";
        g.beginPath();
        g.arc(w / 2 + Math.sin(t) * w * 0.08, h / 2, h * 0.1, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = NOIR.flare;
        g.fillRect(w / 2 + Math.sin(t) * w * 0.08 - 4 * s, h / 2 - 3 * s, 2 * s, 2 * s);
      } else {
        const [a, b] = ADS[(page + A.page) % ADS.length];
        g.fillStyle = page === 2 ? NOIR.neonRed : NOIR.sodium;
        g.font = `bold ${Math.round(h * 0.26)}px sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(a, w / 2, h * 0.42);
        g.fillStyle = "#f0e6d8";
        g.font = `${Math.round(h * 0.13)}px sans-serif`;
        g.fillText(b, w / 2, h * 0.72);
      }
      // scanlines and a rolling bar
      g.fillStyle = "rgba(0,0,0,0.25)";
      for (let y = 0; y < h; y += 2 * s) g.fillRect(0, y, w, s * 0.8);
      g.fillStyle = "rgba(255,255,255,0.06)";
      g.fillRect(0, ((t * 20 * s) % (h + 10 * s)) - 10 * s, w, 6 * s);
      A.t.needsUpdate = true;
    }
  }

  let rain = null;
  function buildRain() {
    const n = PIXEL ? 1600 : 3600;
    const pos = new Float32Array(n * 6), end = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const x = (rand() - 0.5) * 260 * Z, y = rand() * 90, z = lerp(-100, 100, rand()) * Z;
      pos.set([x, y, z, x, y, z], i * 6);
      end[i * 2] = 0;
      end[i * 2 + 1] = 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
    rain = new THREE.LineSegments(geo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: U.time, uCol: { value: C("#b8c8d8", PIXEL ? 0.2 : 0.12) } },
      vertexShader: /* glsl */ `
        attribute float aEnd; uniform float uTime; varying float vA;
        void main() {
          vec3 p = position;
          p.y = mod(p.y - uTime * 60.0, 90.0);
          p += vec3(-0.5, 2.0, 0.2) * aEnd;
          vA = aEnd;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCol; varying float vA;
        void main() { gl_FragColor = vec4(uCol * (0.35 + vA * 0.65), 1.0); }`,
    }));
    rain.frustumCulled = false;
    scene.add(rain);
  }

  // The crowd: a lit umbrella for every walker, drifting along the pavements
  function buildCrowd() {
    const n = PIXEL ? 1400 : 2600;
    const pos = new Float32Array(n * 3), dir = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const tints = [C("#dff4ff"), C("tealN"), C("#ffffff"), C("neonPink"), C("sodiumHi")];
    let k = 0;
    for (let tries = 0; k < n && tries < n * 6; tries++) {
      // a point on a pavement: beside a street's centre line, in grid space
      const alongX = rand() < 0.5;
      const line = Math.round((rand() - 0.5) * 56) * CELL, off = (rand() < 0.5 ? -1 : 1) * 0.65, run = (rand() - 0.5) * 400;
      const [gx, gz] = alongX ? [run, line + off] : [line + off, run];
      const [x, z] = toWorld(gx, gz);
      if (!onPlate(x, z, 2) || nearSite(x, z, 1) || inColossus(x, z, 0)) continue;
      pos.set([x, 0.7, z], k * 3);
      const sp = (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.7);
      const [dx, dz] = toWorld(alongX ? sp : 0, alongX ? 0 : sp);
      dir.set([dx, dz, rand() * 100], k * 3);
      pick(tints).toArray(col, k * 3);
      k++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos.subarray(0, k * 3), 3));
    geo.setAttribute("aDir", new THREE.BufferAttribute(dir.subarray(0, k * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col.subarray(0, k * 3), 3));
    const crowd = new THREE.Points(geo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      uniforms: { uTime: U.time, uSize: { value: PIXEL ? 1 : 2.2 }, uGain: { value: PIXEL ? 0.9 : 1.6 } },
      vertexShader: /* glsl */ `
        attribute vec3 aDir; uniform float uTime, uSize; varying vec3 vCol;
        void main() {
          // walk to and fro along the pavement, a few metres each way
          float s = sin(uTime * 0.12 * length(aDir.xy) + aDir.z) * 3.5;
          vec3 p = position + vec3(aDir.x, 0.0, aDir.y) * s;
          vCol = color;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uSize;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uGain; varying vec3 vCol;
        void main() { gl_FragColor = vec4(vCol * uGain, 1.0); }`,
    }));
    crowd.frustumCulled = false;
    scene.add(crowd);
  }

  // the red lights on masts and roofs, blinking out of step
  let beaconMesh = null;
  function buildBeacons() {
    beaconMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), glow("neonRed", PIXEL ? 1.3 : 3.5), beacons.length);
    beacons.forEach(([x, y, z], i) => beaconMesh.setMatrixAt(i, m4.makeTranslation(x, y, z)));
    scene.add(beaconMesh);
  }
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  function updateBeacons(t) {
    beacons.forEach(([x, y, z, ph], i) => {
      const s = y > 20 ? 1 + y / 60 : 1; // the tall ones read from far off
      beaconMesh.setMatrixAt(i, Math.sin(t * 1.8 + ph) > 0.2 ? m4.makeScale(s, s, s).setPosition(x, y, z) : hidden);
    });
    beaconMesh.instanceMatrix.needsUpdate = true;
  }

  // ============================================================
  // Build everything once
  // ============================================================
  // the pyramid's spot first, so the small city keeps clear of it
  buildColossi();
  const twin = pyramid(scene, TWIN.at.x, TWIN.at.z, TWIN, 90);
  buildCity();
  buildGround();
  buildSprawl();
  buildPlaces();
  buildScreens();
  buildTraffic();
  buildPatrols();
  buildSearchlights();
  buildBlimp();
  buildRain();
  buildCrowd();
  buildBeacons();
  drawAds(0);

  // the CCTV camera for the corner: on a pole by the pad, looking up the pyramid
  const cctvAt = new THREE.Vector3(SITE.hub.x - 16, 7, SITE.hub.z + 22);

  let lastUi = -1, lastHolo = -1;
  return K.world({
    places,
    cctv: { position: cctvAt, lookAt: new THREE.Vector3(PYR.at.x, 26, PYR.at.z) },
    update(t) {
      updateTraffic(t);
      updatePatrols(t);
      updateBeacons(t);
      twin.update(t);
      for (const sl of searchlights) {
        sl.pivot.rotation.z = Math.sin(t * 0.19 + sl.ph) * 0.5;
        sl.pivot.rotation.x = Math.cos(t * 0.15 + sl.ph) * 0.3 - 0.2;
      }
      for (const F of flares) {
        const k = ((t + F.ph) % F.period) / F.period;
        const burst = k > 0.82 ? Math.sin(((k - 0.82) / 0.18) * Math.PI) : 0;
        F.mat.uniforms.uBurst.value = burst;
        F.fire.scale.set(1 + burst * 0.5, 1 + burst * 0.9, 1);
        F.light.scale.setScalar(1 + burst * 0.8);
        if (burst > 0.5 && Math.random() < 0.3) spawn("ember", F.at.clone().setY(F.at.y + F.s * 0.5), new THREE.Vector3((Math.random() - 0.5) * 8, 10 + Math.random() * 10, 0), NOIR.flare, 1.5);
      }
      const bx = (((t * 5 + 200) % 700) - 350) * Z;
      blimp.position.set(bx, -30 * Z, -150 * Z);
      if (t - lastUi > 0.25) {
        lastUi = t;
        drawAds(t);
      }
      if (t - lastHolo > 0.1) {
        lastHolo = t;
        drawHolo(t);
      }
      // steam from the street vents
      if (Math.random() < 0.5) {
        const [x, z] = pick(lampSpots);
        spawn("steam", new THREE.Vector3(x + 0.6, 0.3, z + 0.6), new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.4 + Math.random(), (Math.random() - 0.5) * 0.4), "#9aa8b0", 3.5);
      }
    },
  });
}
