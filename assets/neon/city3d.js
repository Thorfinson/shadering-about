// The NEON city in three dimensions, for neon-3d.html (high fidelity: bloom,
// wet streets that mirror the neon, soft smog) and neon-3d-pixel.html (the same
// city rendered at the map's art resolution, outlined by depth and reduced to
// the NEON palette, with no dithering).
//
// A classic script, so the pages still open from file://. The page's module
// imports three.js from the CDN and hands it in:
//
//   const world = NeonCity3D(THREE, { EffectComposer, RenderPass, UnrealBloomPass,
//                                     OutputPass, ShaderPass, FullScreenQuad,
//                                     Reflector, mergeGeometries }, { pixel })
//   startOS({ ...NEON_STORY, ...world })
//
// The camera, the cars, the ICE, the post and the engine's hooks come from
// assets/os/city3d.js; this is the city. The district stands on a plate; past
// its far edge the megatowers rise out of the undercity into the smog, which
// is the skyline at the top of the view.

// eslint-disable-next-line no-unused-vars
function NeonCity3D(THREE, X, opts) {
  "use strict";
  const PIXEL = !!opts?.pixel;
  const Z = 1.65;
  const K = City3D(THREE, X, {
    pixel: PIXEL,
    story: NEON_STORY,
    palette: window.NEON_ATLAS.palette,
    atlas: window.NEON_ATLAS,
    atlasFile: "assets/neon/atlas.js",
    Z,
    view: { dist: 300, pitch: 33, hfov: 31, target: -6, near: 30, far: 1400 },
    // Each block stands below its dock, so a card goes above it or to one side.
    layout: {
      hub: [0.49, 0.55, ["below", "above"]],
      knowledge: [0.17, 0.37, ["above", "right", "left"]],
      documents: [0.6, 0.29, ["right", "left", "above"]],
      models: [0.86, 0.35, ["above", "left"]],
      repos: [0.15, 0.72, ["right", "above", "below"]],
      tests: [0.76, 0.65, ["below", "right", "left"]],
      memory: [0.38, 0.86, ["left", "right", "above"]],
      deploy: [0.88, 0.86, ["left", "above"]],
    },
    size: { hub: [8.5, 30], knowledge: [6.5, 9], documents: [6, 11], models: [6, 19], repos: [6.5, 12], tests: [6.5, 9], memory: [6, 15], deploy: [7, 13] },
    // the pixel city is quantized to the palette's darks, so it gets more light and a paler smog
    smog: ["#3e1a58", "#2a1036"],
    fog: { near: [230, 300], far: [900, 1150] },
    hemi: ["#6a4ab0", "#0a0a18", [1.15, 0.9]],
    moon: ["#8fb4ff", [0.7, 0.35], [-60, 120, 40]],
    mapH: [520, undefined], // the pixel city from further out needs a finer grain
    chrome: { ink: "#eef2ff", accent: "#3ef0ff", brand: "#ff8ac0" },
  });
  const { PAL, U, C, rand, pick, scene, SITE, nearSite, glow, haze, lineGlow, std, M, tex, litSeed, seeded, mesh, softDot, pointsMaterial, TOWER, TOWER_HI, glyphTex, reflectors } = K;
  const NEON = ["neonPink", "neonCyan", "neonAmber", "neonViolet", "neonGreen"];
  const SMOG = K.SMOG;

  // ============================================================
  // The plate: wet streets, blocks of towers, signs and crowns
  // ============================================================
  const PLATE = { x0: -150 * Z, x1: 150 * Z, z0: -46 * Z, z1: 90 * Z };
  const CELL = 12;
  // the street grid is turned against the view: two-point perspective, not rows
  const GRID = THREE.MathUtils.degToRad(28), GC = Math.cos(GRID), GS = Math.sin(GRID);
  const toWorld = (gx, gz) => [gx * GC + gz * GS, -gx * GS + gz * GC];
  const toGrid = (x, z) => [x * GC - z * GS, x * GS + z * GC];
  const onPlate = (x, z, m = 0) => x > PLATE.x0 + m && x < PLATE.x1 - m && z > PLATE.z0 + m && z < PLATE.z1 - m;
  const signs = []; // {x, y, z, w, h, col, ry}
  const crowns = []; // {x, y, z, w, d, col}
  const screens = []; // big ad screens: {x, y, z, w, h, ry}
  function buildCity() {
    const boxes = [];
    // a box on the grid: (gx, gz) in grid space, turned into the world
    const box = (w, h, d, gx, y, gz, seed) => {
      const [x, z] = toWorld(gx, gz);
      boxes.push(seeded(new THREE.BoxGeometry(w, h, d).rotateY(GRID).translate(x, y, z), seed));
    };
    const faceOf = (gx, gz, w, d, along, out) => {
      // a point on the lot's front face (+gz, the side that looks toward the camera)
      const [x, z] = toWorld(gx + along * (w / 2 - 0.5), gz + d / 2 + out);
      return { x, z, ry: GRID };
    };
    // the grid cells that cover the plate
    const corners = [[PLATE.x0, PLATE.z0], [PLATE.x1, PLATE.z0], [PLATE.x0, PLATE.z1], [PLATE.x1, PLATE.z1]].map(([x, z]) => toGrid(x, z));
    const [gi0, gi1] = [Math.min(...corners.map((c) => c[0])), Math.max(...corners.map((c) => c[0]))].map((v) => Math.floor(v / CELL));
    const [gj0, gj1] = [Math.min(...corners.map((c) => c[1])), Math.max(...corners.map((c) => c[1]))].map((v) => Math.floor(v / CELL));
    // blocks on the plate: low near the docks, taller to the sides and the back
    for (let i = gi0; i <= gi1; i++) {
      for (let j = gj0; j <= gj1; j++) {
        const bx = i * CELL + 1.6, bz = j * CELL + 1.6, bw = CELL - 3.2;
        const split = rand();
        const lots = split < 0.3 ? [[0, 0, 1, 1]] : split < 0.65 ? [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] : [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]];
        for (const [u, v, uw, vw] of lots) {
          const w = bw * uw - 0.5 - rand() * 0.8, d = bw * vw - 0.5 - rand() * 0.8;
          const gx = bx + bw * (u + uw / 2), gz = bz + bw * (v + vw / 2);
          const [x, z] = toWorld(gx, gz);
          if (!onPlate(x, z, Math.max(w, d) * 0.72) || nearSite(x, z, 3.5)) continue;
          const side = smooth(70 * Z, 150 * Z, Math.abs(x)), back = smooth(-16 * Z, -44 * Z, z), front = smooth(30 * Z, 70 * Z, z);
          let h = lerp(2.2, 9, rand() ** 1.6) + side * lerp(4, 40, rand() ** 2) + back * lerp(0, 18, rand() ** 2) - front * 3;
          // keep the air over the docks clear
          if (Object.values(SITE).some((s) => Math.hypot(x - s.x, z - s.z) < s.r + 12)) h = Math.min(h, 6 + rand() * 3);
          h = Math.max(1.6, h);
          const seed = rand();
          box(w, h, d, gx, h / 2, gz, seed);
          if (h > 10 && rand() < 0.5) box(w * 0.66, h * 0.35, d * 0.66, gx, h + h * 0.175, gz, seed); // a setback
          if (rand() < 0.5) box(0.8 + rand(), 0.6, 0.8 + rand(), gx + (rand() - 0.5) * w * 0.5, h + 0.3, gz + (rand() - 0.5) * d * 0.5, -1); // roof clutter
          if (h > 5 && rand() < 0.24) signs.push({ ...faceOf(gx, gz, w, d, rand() < 0.5 ? -1 : 1, 0.06), y: h * (0.35 + rand() * 0.35), w: 0.7 + rand() * 0.4, h: Math.min(h * 0.5, 2.5 + rand() * 4), col: pick(NEON) });
          if (h > 16 && rand() < 0.6) crowns.push({ gx, gz, y: h, w, d, col: pick(NEON) });
        }
      }
    }
    // the plate's street lamps: a warm dot at every corner
    lampSpots = [];
    for (let i = gi0; i <= gi1 + 1; i++) {
      for (let j = gj0; j <= gj1 + 1; j++) {
        const [x, z] = toWorld(i * CELL + 1.3, j * CELL + 1.3);
        if (onPlate(x, z, 1) && !nearSite(x, z, 2)) lampSpots.push([x, z]);
      }
    }
    // the megatowers: rising out of the undercity past the plate's far edge
    const r = rng(77);
    for (let n = 0; n < 150; n++) {
      const z = lerp(-80, -520, r() ** 0.8) * Z, x = (r() - 0.5) * lerp(360, 900, (-z / Z - 80) / 440) * Z;
      const [gx, gz] = toGrid(x, z);
      const w = 12 + r() * 22, d = 12 + r() * 18;
      // some stop short, so their roofs and crowns show in the gulf below the plate
      const top = (r() < 0.4 ? lerp(-120, -25, r()) - smooth(-100 * Z, -400 * Z, z) * 40 : lerp(-10, 70, r())) * Z;
      const base = -320 * Z;
      const seed = litSeed(0.25 + r() * 0.35, 20 + n);
      box(w, top - base, d, gx, (top + base) / 2, gz, seed);
      if (r() < 0.5) box(w * 0.6, 18 + r() * 30, d * 0.6, gx, top + 9 + r() * 15, gz, seed);
      if (r() < 0.7) crowns.push({ gx, gz, y: top, w, d, col: pick(NEON) });
      if (r() < 0.22) screens.push({ ...faceOf(gx, gz, 0, d, 0, 0.2), y: top - 18 - r() * 30, w: Math.min(w * 0.5, 12), h: 5 + r() * 4 });
      if (r() < 0.4) signs.push({ ...faceOf(gx, gz, w, d, r() < 0.5 ? -1 : 1, 0.2), y: top - 10 - r() * 40, w: 1 + r() * 0.8, h: 6 + r() * 10, col: pick(NEON), far: true });
    }
    const city = new THREE.Mesh(X.mergeGeometries(boxes), TOWER);
    scene.add(city);
    boxes.forEach((b) => b.dispose());

    // crowns: a neon line round the top of the tall towers
    const crownGeo = [];
    for (const c of crowns) {
      const t = 0.35;
      const col = C(c.col, PIXEL ? 1.4 : 3);
      const [x, z] = toWorld(c.gx, c.gz);
      for (const g0 of [new THREE.BoxGeometry(c.w + t, t, t).translate(0, 0, c.d / 2), new THREE.BoxGeometry(c.w + t, t, t).translate(0, 0, -c.d / 2), new THREE.BoxGeometry(t, t, c.d).translate(-c.w / 2, 0, 0), new THREE.BoxGeometry(t, t, c.d).translate(c.w / 2, 0, 0)]) {
        const g = g0.rotateY(GRID).translate(x, c.y, z);
        const cols = new Float32Array(g.attributes.position.count * 3);
        for (let i = 0; i < cols.length; i += 3) col.toArray(cols, i);
        g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
        g.deleteAttribute("uv");
        g.deleteAttribute("normal");
        crownGeo.push(g);
      }
    }
    scene.add(new THREE.Mesh(X.mergeGeometries(crownGeo), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));

    // vertical signs: eight InstancedMeshes, one per glyph column
    signMeshes = [];
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
        o.rotation.y = s.ry;
        o.scale.set(s.w, s.h, 1);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        m.setColorAt(i, C(s.col, (PIXEL ? 1.3 : 2.6) * (s.far ? 0.5 : 1)));
        s.mesh = m;
        s.i = i;
      });
      scene.add(m);
      signMeshes.push(m);
    }

    const lamps = lampSpots;
    const lampMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), glow("winWarm", PIXEL ? 0.8 : 3), lamps.length);
    lamps.forEach(([x, z], i) => lampMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 2.2, z)));
    scene.add(lampMesh);
  }
  let signMeshes = [], lampSpots = [];

  // The wet street: a mirror roughened by puddles and rain, lane marks down the
  // middle of every street, the smog laid over it with distance.
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
          float wet = smoothstep(0.42, 0.62, gn(w * 0.08) * 0.6 + gn(w * 0.37) * 0.4);
          vec2 gw = vec2(w.x * ${GC.toFixed(5)} - w.y * ${GS.toFixed(5)}, w.x * ${GS.toFixed(5)} + w.y * ${GC.toFixed(5)}); // grid space
          vec2 c = abs(fract(gw / ${CELL.toFixed(1)} + 0.5) - 0.5) * ${CELL.toFixed(1)}; // distance from the nearest street's centre line
          float dash = step(c.x, 0.07) * step(0.55, fract(gw.y * 0.35)) + step(c.y, 0.07) * step(0.55, fract(gw.x * 0.35));
          vec3 asphalt = mix(vec3(0.010, 0.010, 0.018), vec3(0.028, 0.026, 0.04), gn(w * 1.3));
          vec2 ripple = vec2(gn(w * 0.4 + uTime * 0.22), gn(w * 0.4 - uTime * 0.18)) - 0.5;
          vec4 uv = vUv;
          uv.xy += ripple * uv.w * mix(0.007, 0.002, wet);
          vec2 b = vec2(0.0035, 0.0) * uv.w;
          vec3 refl = (texture2DProj(tDiffuse, uv).rgb * 2.0 + texture2DProj(tDiffuse, uv + vec4(b, 0.0, 0.0)).rgb + texture2DProj(tDiffuse, uv - vec4(b, 0.0, 0.0)).rgb + texture2DProj(tDiffuse, uv + vec4(b.yx, 0.0, 0.0)).rgb + texture2DProj(tDiffuse, uv - vec4(b.yx, 0.0, 0.0)).rgb) / 6.0;
          vec3 col = asphalt + refl * mix(0.22, 0.8, wet) + dash * vec3(0.16, 0.14, 0.1);
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
    // the undercity, far below: streets of sodium and neon, blurred by the smog
    const under = tex(256, 256, (c, w, h) => {
      c.fillStyle = "#000";
      c.fillRect(0, 0, w, h);
      const r2 = rng(3);
      c.filter = "blur(2px)";
      for (let i = 0; i < 26; i++) {
        c.fillStyle = r2() < 0.7 ? "rgba(255,150,60,0.8)" : r2() < 0.5 ? "rgba(255,60,160,0.8)" : "rgba(60,220,255,0.8)";
        if (r2() < 0.5) c.fillRect(0, r2() * h, w, 1 + r2() * 2);
        else c.fillRect(r2() * w, 0, 1 + r2() * 2, h);
      }
      c.filter = "none";
    }, true);
    under.repeat.set(4, 3);
    const deep = mesh(new THREE.PlaneGeometry(1400 * Z, 900 * Z), new THREE.MeshBasicMaterial({ map: under, color: C("#ffffff", PIXEL ? 1.2 : 2.2), fog: false, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }), 0, -300 * Z, -420 * Z, scene);
    deep.rotation.x = -Math.PI / 2;
    // the smog in the gulf, lit from below: towers stand dark against it
    const rise = tex(4, 128, (c, w, h) => {
      const grd = c.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(0.45, "rgba(120,30,140,0.35)");
      grd.addColorStop(0.8, "rgba(255,70,150,0.8)");
      grd.addColorStop(1, "rgba(255,140,90,1)");
      c.fillStyle = grd;
      c.fillRect(0, 0, w, h);
    });
    const smogGlow = mesh(new THREE.PlaneGeometry(2000 * Z, 520 * Z), new THREE.MeshBasicMaterial({ map: rise, color: C("#ffffff", PIXEL ? 0.8 : 0.5), fog: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 0, -200 * Z, -430 * Z, scene);
    smogGlow.rotation.x = -0.25;
    // the plate's far edge: a lip of girders with a strip of lights
    mesh(new THREE.BoxGeometry(w, 3, 2), M.dark, ground.position.x, -1.4, PLATE.z0 - 1, scene);
    mesh(new THREE.BoxGeometry(w, 0.25, 0.3), glow("neonAmber", PIXEL ? 1.2 : 2.4), ground.position.x, -0.5, PLATE.z0 - 2.05, scene);
  }
  let ground = null;

  // ============================================================
  // The eight places, each on a raised block with a neon rim
  // ============================================================
  const places = {}; // key → { group, top: Vector3 (where beams point), update(t) }
  function plinth(k, group) {
    const { r } = SITE[k];
    const col = STATION_COLOR[k];
    mesh(new THREE.CylinderGeometry(r, r + 0.4, 1.4, PIXEL ? 20 : 48), M.concrete, 0, 0.7, 0, group);
    const rim = mesh(new THREE.TorusGeometry(r + 0.05, 0.12, 6, PIXEL ? 32 : 72), glow(col, PIXEL ? 1.3 : 3), 0, 1.4, 0, group);
    rim.rotation.x = Math.PI / 2;
    // light pooling on the plate round the block
    const pool = mesh(new THREE.CircleGeometry(r * 1.6, 48), haze(col, 0.3, 0.22), 0, 0.03, 0, group);
    pool.rotation.x = -Math.PI / 2;
    pool.material.map = softDot;
    return rim;
  }
  const STATION_COLOR = { hub: "cyan3", knowledge: "research", documents: "analyze", models: "model", repos: "build", tests: "test", memory: "remember", deploy: "deploy" };

  function buildPlaces() {
    for (const k of Object.keys(SITE)) {
      const group = new THREE.Group();
      group.position.set(SITE[k].x, 0, SITE[k].z);
      scene.add(group);
      plinth(k, group);
      places[k] = { group, update: () => {}, top: new THREE.Vector3(SITE[k].x, SITE[k].h * 0.6, SITE[k].z) };
      BUILD[k](places[k], group);
      const light = new THREE.PointLight(C(STATION_COLOR[k]), PIXEL ? 90 : 150, 36, 1.5);
      light.position.set(0, 6, 3);
      group.add(light);
    }
  }
  const BUILD = {
    // the arcology: a stepped megatower, a halo deck, a wireframe globe turning in holo light
    hub(p, g) {
      const tiers = [[6.8, 7.4, 4], [5.2, 5.8, 5], [3.8, 4.2, 6]];
      let y = 1.4;
      tiers.forEach(([rt, rb, h], i) => {
        mesh(seeded(new THREE.CylinderGeometry(rt, rb, h, 8), litSeed(0.5, i + 1)), TOWER_HI, 0, y + h / 2, 0, g).rotation.y = Math.PI / 8;
        const band = mesh(new THREE.TorusGeometry(rt + 0.02, 0.09, 4, 8), glow("cyan3", PIXEL ? 1.3 : 3), 0, y + h, 0, g);
        band.rotation.set(Math.PI / 2, 0, Math.PI / 8);
        y += h;
      });
      mesh(seeded(new THREE.BoxGeometry(3.4, 11, 3.4), litSeed(0.55, 5)), TOWER_HI, 0, y + 5.5, 0, g);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(new THREE.BoxGeometry(0.18, 11, 0.18), glow(sx * sz > 0 ? "cyan3" : "neonPink", PIXEL ? 1.3 : 3), sx * 1.72, y + 5.5, sz * 1.72, g);
      y += 11;
      const deck = mesh(new THREE.TorusGeometry(5.2, 0.16, 6, 64), glow("cyan3", PIXEL ? 1.4 : 3.5), 0, y - 3.5, 0, g);
      deck.rotation.x = Math.PI / 2;
      mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.3, 48), M.metal, 0, y - 3.6, 0, g);
      mesh(new THREE.CylinderGeometry(0.1, 0.5, 3, 8), M.metal, 0, y + 1.5, 0, g);
      // the holo beam and the globe
      const beam = mesh(new THREE.CylinderGeometry(3.2, 0.6, 5, 32, 1, true), haze("cyan3", 0.35, 0.35), 0, y + 3.5, 0, g);
      const globe = new THREE.Group();
      globe.position.set(0, y + 9, 0);
      g.add(globe);
      const R = 4.2;
      const pts = [];
      for (let la = -60; la <= 60; la += 30) {
        const rr = R * Math.cos((la * Math.PI) / 180), yy = R * Math.sin((la * Math.PI) / 180);
        for (let a = 0; a < 48; a++) {
          const a0 = (a / 48) * Math.PI * 2, a1 = ((a + 1) / 48) * Math.PI * 2;
          pts.push(rr * Math.cos(a0), yy, rr * Math.sin(a0), rr * Math.cos(a1), yy, rr * Math.sin(a1));
        }
      }
      for (let lo = 0; lo < 12; lo++) {
        const a = (lo / 12) * Math.PI * 2;
        for (let s = 0; s < 24; s++) {
          const b0 = (s / 24) * Math.PI - Math.PI / 2, b1 = ((s + 1) / 24) * Math.PI - Math.PI / 2;
          pts.push(R * Math.cos(b0) * Math.cos(a), R * Math.sin(b0), R * Math.cos(b0) * Math.sin(a), R * Math.cos(b1) * Math.cos(a), R * Math.sin(b1), R * Math.cos(b1) * Math.sin(a));
        }
      }
      const wire = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)), lineGlow("cyan3", PIXEL ? 1.2 : 2.2, 0.8));
      globe.add(wire);
      // continents as a field of dots
      const dots = [];
      for (let i = 0; i < 1400; i++) {
        const u = rand() * 2 - 1, a = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
        const lat = Math.asin(u), lon = a;
        if (fbm(Math.cos(lon) * 1.6 + 3, lat * 1.8 + Math.sin(lon) * 1.6, 11, 3) < 0.52) continue;
        dots.push(R * 0.98 * s * Math.cos(a), R * 0.98 * u, R * 0.98 * s * Math.sin(a));
      }
      globe.add(new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(dots, 3)), pointsMaterial(C("neonPink", PIXEL ? 1.2 : 2.4), PIXEL ? 1 : 0.35)));
      const halo = mesh(new THREE.TorusGeometry(R * 1.35, 0.06, 4, 96), glow("neonPink", PIXEL ? 1.2 : 2.5), 0, 0, 0, globe);
      halo.rotation.x = Math.PI / 2.3;
      p.top.set(SITE.hub.x, y + 9, SITE.hub.z);
      p.update = (t) => {
        wire.rotation.y = t * 0.25;
        globe.children[1].rotation.y = t * 0.25;
        halo.rotation.z = t * 0.4;
        beam.material.opacity = 0.28 + Math.sin(t * 3) * 0.06;
      };
    },
    // the data archive: racks behind a glass front, dishes on the roof
    knowledge(p, g) {
      mesh(new THREE.BoxGeometry(9, 5, 6), M.dark, 0, 3.9, 0, g);
      mesh(new THREE.BoxGeometry(9.4, 0.4, 6.4), M.metal, 0, 6.6, 0, g);
      const racks = makeCanvas(PIXEL ? 48 : 192, PIXEL ? 24 : 96);
      const rt = new THREE.CanvasTexture(racks);
      rt.colorSpace = THREE.SRGBColorSpace;
      if (PIXEL) rt.magFilter = rt.minFilter = THREE.NearestFilter;
      const front = mesh(new THREE.PlaneGeometry(8.2, 4), new THREE.MeshBasicMaterial({ map: rt, toneMapped: false, color: C("#ffffff", PIXEL ? 1.1 : 1.8) }), 0, 3.9, 3.02, g);
      const drawRacks = (t) => {
        const c = racks.getContext("2d"), w = racks.width, h = racks.height, s = w / 48;
        c.fillStyle = "#07060d";
        c.fillRect(0, 0, w, h);
        for (let r = 0; r < 6; r++) {
          c.fillStyle = "#16142a";
          c.fillRect((1 + r * 8) * s, 1 * s, 6 * s, 22 * s);
          for (let u = 0; u < 10; u++) {
            for (let l = 0; l < 3; l++) {
              const on = hash2(r * 31 + l, u + Math.floor(t * 6 + r * 3.3 + l), 3) < 0.45;
              c.fillStyle = on ? (hash2(r, u, 4) < 0.7 ? PAL.research : PAL.neonGreen) : "#2a2436";
              c.fillRect((2 + r * 8 + l * 1.7) * s, (2 + u * 2) * s, Math.max(1, s), Math.max(1, s));
            }
          }
        }
        rt.needsUpdate = true;
      };
      drawRacks(0);
      for (const [x, z, a] of [[-2.6, -1, 0.5], [2.4, 0.6, -0.6]]) {
        const dish = mesh(new THREE.SphereGeometry(1.5, 20, 8, 0, Math.PI * 2, 0, Math.PI / 3.2), std("#9a98b0", 0.4, 0.7, { side: THREE.DoubleSide }), x, 8.2, z, g);
        dish.rotation.set(Math.PI - 0.7, a, 0);
        mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.4, 8), M.metal, x, 7.4, z, g);
        mesh(new THREE.SphereGeometry(0.16, 8, 6), glow("research", PIXEL ? 1.3 : 3), x, 8.5, z, g);
      }
      mesh(new THREE.PlaneGeometry(1, 4.6), new THREE.MeshBasicMaterial({ map: glyphTex, toneMapped: false, color: C("research", PIXEL ? 1.3 : 2.6) }), 4.75, 4.2, 1.5, g).rotation.y = Math.PI / 2;
      p.top.set(SITE.knowledge.x, 6.8, SITE.knowledge.z);
      let last = 0;
      p.update = (t) => {
        if (t - last > 0.15) {
          last = t;
          drawRacks(t);
        }
        front.material.color.setScalar(PIXEL ? 1.1 : 1.8);
      };
    },
    // the holo kiosk: an awning, vending machines, documents floating above
    documents(p, g) {
      mesh(new THREE.BoxGeometry(5.5, 3.2, 3.8), M.concrete, 0, 3, -0.6, g);
      const stripes = tex(64, 16, (c, w, h) => {
        for (let x = 0; x < w; x += 8) {
          c.fillStyle = x % 16 ? "#f2e8ff" : PAL.analyze;
          c.fillRect(x, 0, 8, h);
        }
      }, true);
      stripes.repeat.set(3, 1);
      const awning = mesh(new THREE.BoxGeometry(6.4, 0.14, 2.4), new THREE.MeshStandardMaterial({ map: stripes, emissive: C("analyze", 0.25), emissiveMap: stripes, roughness: 0.6 }), 0, 4.2, 1.9, g);
      awning.rotation.x = 0.28;
      mesh(new THREE.BoxGeometry(5, 1.2, 0.2), glow("analyze", PIXEL ? 1.2 : 2), 0, 2.2, 1.35, g);
      for (const [x, c] of [[-3.6, "neonCyan"], [3.6, "neonPink"]]) {
        mesh(new THREE.BoxGeometry(1.1, 2.4, 0.9), M.metal, x, 2.6, 0.6, g);
        mesh(new THREE.PlaneGeometry(0.8, 1.6), glow(c, PIXEL ? 1.2 : 2.2), x, 2.8, 1.06, g);
      }
      const page = tex(PIXEL ? 12 : 64, PIXEL ? 16 : 84, (c, w, h) => {
        c.fillStyle = "#f4ecff";
        c.fillRect(0, 0, w, h);
        c.fillStyle = PAL.analyze;
        c.fillRect(0, 0, w, h * 0.12);
        c.fillStyle = "#6a5a88";
        for (let y = h * 0.22; y < h * 0.92; y += h * 0.1) c.fillRect(w * 0.12, y, w * (0.5 + hash2(y | 0, 1, 2) * 0.35), Math.max(1, h * 0.035));
      });
      const docs = [];
      for (let i = 0; i < 6; i++) {
        const d = mesh(new THREE.PlaneGeometry(1.5, 2), new THREE.MeshBasicMaterial({ map: page, toneMapped: false, color: C("#ffffff", PIXEL ? 1 : 1.5), side: THREE.DoubleSide, transparent: true, opacity: 0.92 }), 0, 0, 0, g);
        const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.6, 2.1)), lineGlow("analyze", PIXEL ? 1.2 : 2.5));
        d.add(edge);
        docs.push(d);
      }
      p.top.set(SITE.documents.x, 6.5, SITE.documents.z);
      p.update = (t) => {
        docs.forEach((d, i) => {
          const a = t * 0.35 + (i / docs.length) * Math.PI * 2;
          d.position.set(Math.cos(a) * 3.6, 7.2 + Math.sin(t * 1.3 + i) * 0.6 + (i % 2) * 1.3, Math.sin(a) * 3.6);
          d.rotation.y = -a + Math.PI / 2;
        });
      };
    },
    // the AI lab: a glass tower with a hologram head on its roof
    models(p, g) {
      const tower = mesh(new THREE.BoxGeometry(4.6, 12, 4.6), M.glass, 0, 7.4, 0, g);
      mesh(seeded(new THREE.BoxGeometry(2.6, 11.6, 2.6), litSeed(0.5, 7)), TOWER_HI, 0, 7.4, 0, g);
      tower.add(new THREE.LineSegments(new THREE.EdgesGeometry(tower.geometry), lineGlow("model", PIXEL ? 1.3 : 2.6)));
      for (let y = 3; y < 13; y += 2.4) mesh(new THREE.BoxGeometry(4.7, 0.08, 4.7), glow("model", PIXEL ? 1 : 1.4), 0, y, 0, g);
      mesh(new THREE.CylinderGeometry(1.8, 2.2, 0.5, 24), M.metal, 0, 13.6, 0, g);
      // the head: a sphere pulled into a skull, drawn as points and scan rings
      const head = new THREE.Group();
      head.position.set(0, 17, 0);
      g.add(head);
      const sph = new THREE.SphereGeometry(2, PIXEL ? 18 : 36, PIXEL ? 14 : 28);
      const pos = sph.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        y *= 1.2;
        if (y < 0) {
          const k = 1 + (y / 2.4) * 0.35; // the jaw narrows
          x *= k;
          z *= k;
        }
        if (z > 1.4 && Math.abs(x) < 0.4 && y > -0.8 && y < 0.4) z += 0.35; // the nose
        pos.setXYZ(i, x * 0.88, y, z);
      }
      const face = new THREE.Points(sph, pointsMaterial(C("model", PIXEL ? 1.2 : 1.3), PIXEL ? 1 : 0.12));
      head.add(face);
      for (const sx of [-0.6, 0.6]) mesh(new THREE.SphereGeometry(0.14, 8, 6), glow("model", PIXEL ? 1.3 : 2.5), sx, 0.3, 1.72, head);
      const scan = mesh(new THREE.TorusGeometry(2.1, 0.04, 4, 48), glow("model", PIXEL ? 1.3 : 3), 0, 0, 0, head);
      scan.rotation.x = Math.PI / 2;
      const cone = mesh(new THREE.CylinderGeometry(2.4, 1.6, 2.6, 32, 1, true), haze("model", 0.3, 0.3), 0, 15, 0, g);
      p.top.set(SITE.models.x, 12, SITE.models.z);
      p.update = (t) => {
        head.rotation.y = Math.sin(t * 0.4) * 0.9;
        scan.position.y = Math.sin(t * 1.7) * 2.2;
        cone.material.opacity = 0.22 + 0.08 * Math.sin(t * 5);
      };
    },
    // container stacks: homes in painted boxes, a crane, steam
    repos(p, g) {
      const ribs = tex(32, 16, (c, w, h) => {
        for (let x = 0; x < w; x++) {
          c.fillStyle = x % 4 < 2 ? "#ffffff" : "#b8b8c4";
          c.fillRect(x, 0, 1, h);
        }
      }, true);
      ribs.repeat.set(4, 1);
      const COLS = ["#8a3b2a", "#1f6b6b", "#a07a1e", "#2c7a3c", "#2a4a8a", "#6a2a5a"];
      const r = rng(19);
      const homes = [];
      for (let sx = -1; sx <= 1; sx++) {
        for (let sz = -1; sz <= 0; sz++) {
          const n = 1 + Math.floor(r() * 3.2);
          for (let k = 0; k < n; k++) {
            const x = sx * 3.1 + (r() - 0.5) * 0.4, z = sz * 1.9 + 0.6, y = 1.4 + 0.7 + k * 1.42;
            const cmat = new THREE.MeshStandardMaterial({ map: ribs, color: C(COLS[Math.floor(r() * COLS.length)]), roughness: 0.7, metalness: 0.3, flatShading: PIXEL });
            mesh(new THREE.BoxGeometry(2.9, 1.4, 1.7), cmat, x, y, z, g);
            if (r() < 0.6) homes.push(mesh(new THREE.PlaneGeometry(0.5, 0.45), glow(r() < 0.7 ? "winWarm" : "build", PIXEL ? 1.2 : 2.4), x + (r() - 0.5) * 1.6, y + 0.1, z + 0.86, g));
          }
        }
      }
      // the crane
      const crane = new THREE.Group();
      crane.position.set(-4.4, 0, -2.4);
      g.add(crane);
      mesh(new THREE.BoxGeometry(0.4, 12, 0.4), std("#c9a227", 0.6, 0.4), 0, 7.4, 0, crane);
      const jib = new THREE.Group();
      jib.position.y = 13.2;
      crane.add(jib);
      mesh(new THREE.BoxGeometry(9, 0.35, 0.35), std("#c9a227", 0.6, 0.4), 3.6, 0, 0, jib);
      mesh(new THREE.BoxGeometry(1.2, 0.8, 0.8), M.dark, -1.4, -0.2, 0, jib);
      mesh(new THREE.BoxGeometry(0.05, 5, 0.05), M.metal, 6.5, -2.5, 0, jib);
      mesh(new THREE.BoxGeometry(2.4, 1.1, 1.3), new THREE.MeshStandardMaterial({ map: ribs, color: C("#1f6b6b"), roughness: 0.7 }), 6.5, -5.4, 0, jib);
      mesh(new THREE.SphereGeometry(0.2, 8, 6), glow("red", PIXEL ? 1.3 : 3), 0, 0.6, 0, jib);
      mesh(new THREE.PlaneGeometry(0.9, 3.6), new THREE.MeshBasicMaterial({ map: glyphTex, toneMapped: false, color: C("build", PIXEL ? 1.3 : 2.6) }), 4.9, 4.2, 1.2, g).rotation.y = Math.PI / 2;
      p.top.set(SITE.repos.x, 6, SITE.repos.z);
      p.steam = [new THREE.Vector3(SITE.repos.x + 2.5, 7, SITE.repos.z - 0.8)];
      p.update = (t) => {
        jib.rotation.y = Math.sin(t * 0.15) * 0.9 - 0.3;
      };
    },
    // the firewall: a bunker under a hexagonal force field
    tests(p, g) {
      mesh(new THREE.BoxGeometry(6.2, 2.6, 4.4), M.dark, 0, 2.7, 0, g);
      const hazard = tex(64, 8, (c, w, h) => {
        c.fillStyle = "#111";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#f2c200";
        for (let x = -h; x < w; x += 8) {
          c.beginPath();
          c.moveTo(x, h);
          c.lineTo(x + 4, h);
          c.lineTo(x + 4 + h, 0);
          c.lineTo(x + h, 0);
          c.fill();
        }
      }, true);
      hazard.repeat.set(3, 1);
      mesh(new THREE.PlaneGeometry(6.2, 0.6), new THREE.MeshStandardMaterial({ map: hazard, emissive: C("#f2c200", 0.2), emissiveMap: hazard }), 0, 2, 2.21, g);
      const eye = mesh(new THREE.BoxGeometry(2.4, 0.3, 0.1), glow("test", PIXEL ? 1.3 : 3), 0, 3.3, 2.22, g);
      const field = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uTime: U.time, uAlarm: U.alarm, uCol: { value: C("test") }, uBad: { value: C("red") }, uGain: { value: PIXEL ? 1.2 : 2.6 } },
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
          float hexEdge(vec2 p) {
            p.x *= 1.1547; p.y += mod(floor(p.x), 2.0) * 0.5;
            vec2 f = abs(fract(p) - 0.5);
            return max(abs(max(f.x * 1.5 + f.y, f.y * 2.0) - 1.0), 0.0);
          }
          void main() {
            float lon = atan(vP.z, vP.x), lat = asin(clamp(vP.y / length(vP), -1.0, 1.0));
            vec2 uv = vec2(lon * 3.2, lat * 5.0);
            float e = smoothstep(0.1, 0.0, abs(hexEdge(uv) - 0.02) - 0.02);
            float rim = pow(1.0 - abs(dot(vN, vV)), 2.5);
            float wave = smoothstep(0.9, 1.0, sin(lat * 8.0 - uTime * 2.5));
            vec3 col = mix(uCol, uBad, uAlarm);
            float flicker = 1.0 - uAlarm * step(0.7, fract(sin(floor(uTime * 14.0)) * 43758.5));
            gl_FragColor = vec4(col * (e * 0.55 + rim * 0.9 + wave * 0.25 + 0.03) * uGain * flicker, 1.0);
          }`,
      });
      const dome = mesh(new THREE.SphereGeometry(SITE.tests.r - 0.3, PIXEL ? 24 : 64, PIXEL ? 12 : 32, 0, Math.PI * 2, 0, Math.PI / 2), field, 0, 1.4, 0, g);
      p.top.set(SITE.tests.x, 5, SITE.tests.z);
      p.update = (t) => {
        eye.scale.x = 0.6 + 0.4 * Math.abs(Math.sin(t * 2));
        dome.rotation.y = t * 0.05;
      };
    },
    // the memory pagoda: three tiers under flared roofs, lanterns at the eaves
    memory(p, g) {
      const tiers = [[4.6, 2.3], [3.6, 2], [2.6, 1.8]];
      let y = 1.4;
      const lanterns = [];
      const roofMat = std("#1b1626", 0.5, 0.4, { flatShading: true });
      tiers.forEach(([w, h], i) => {
        mesh(new THREE.BoxGeometry(w, h, w), M.wood, 0, y + h / 2, 0, g);
        for (const a of [0, 1, 2, 3]) {
          const screen = mesh(new THREE.PlaneGeometry(w * 0.7, h * 0.55), glow("winWarm", PIXEL ? 1.1 : 1.8), 0, y + h / 2, 0, g);
          screen.rotation.y = (a * Math.PI) / 2;
          screen.translateZ(w / 2 + 0.02);
        }
        y += h;
        const rw = w * 0.95 + 1.8;
        const roof = mesh(new THREE.ConeGeometry(rw, 1.4, 4, 1), roofMat, 0, y + 0.55, 0, g);
        roof.rotation.y = Math.PI / 4;
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(roof.geometry), lineGlow(i % 2 ? "neonPink" : "remember", PIXEL ? 1.3 : 2.8));
        roof.add(edges);
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lanterns.push(mesh(new THREE.SphereGeometry(0.28, 8, 6), glow(i % 2 ? "neonAmber" : "red", PIXEL ? 1.3 : 3), (sx * rw) / Math.SQRT2 * 0.98, y - 0.5, (sz * rw) / Math.SQRT2 * 0.98, g));
        y += 0.5;
      });
      mesh(new THREE.CylinderGeometry(0.05, 0.14, 2.4, 6), M.metal, 0, y + 1.8, 0, g);
      // two hologram koi circling the pagoda
      const koi = [0, 1].map((i) => {
        const k = koiLine(1.6, i ? "neonCyan" : "neonPink");
        g.add(k.obj);
        return k;
      });
      p.top.set(SITE.memory.x, 7, SITE.memory.z);
      p.update = (t) => {
        koi.forEach((k, i) => {
          const a = t * 0.5 + i * Math.PI;
          k.obj.position.set(Math.cos(a) * 5.4, 7 + i * 2 + Math.sin(t + i) * 0.5, Math.sin(a) * 5.4);
          k.obj.rotation.y = -a - Math.PI / 2;
          k.swim(t * 3 + i);
        });
        lanterns.forEach((l, i) => l.scale.setScalar(0.9 + 0.12 * Math.sin(t * 2 + i)));
      };
    },
    // the skyport: a pad on pillars, a VTOL, a control tower with a beacon
    deploy(p, g) {
      const deck = 6.2;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(new THREE.CylinderGeometry(0.35, 0.45, deck - 1.4, 8), M.metal, sx * 2.8, 1.4 + (deck - 1.4) / 2, sz * 2.8, g);
      const marks = tex(PIXEL ? 48 : 256, PIXEL ? 48 : 256, (c, w) => {
        c.fillStyle = "#15131f";
        c.fillRect(0, 0, w, w);
        c.strokeStyle = PAL.deploy;
        c.lineWidth = w * 0.03;
        c.beginPath();
        c.arc(w / 2, w / 2, w * 0.36, 0, Math.PI * 2);
        c.stroke();
        c.fillStyle = PAL.deploy;
        const s = w * 0.06;
        c.fillRect(w / 2 - s * 2.2, w / 2 - s * 2.5, s, s * 5);
        c.fillRect(w / 2 + s * 1.2, w / 2 - s * 2.5, s, s * 5);
        c.fillRect(w / 2 - s * 1.2, w / 2 - s * 0.5, s * 2.4, s);
      });
      const pad = mesh(new THREE.CylinderGeometry(5.4, 5.4, 0.5, PIXEL ? 24 : 64), [M.metal, new THREE.MeshStandardMaterial({ map: marks, emissive: C("#ffffff", PIXEL ? 0.9 : 1.6), emissiveMap: marks, roughness: 0.4 }), M.metal], 0, deck, 0, g);
      const edge = [];
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        edge.push(mesh(new THREE.SphereGeometry(0.16, 6, 4), glow("deploy", PIXEL ? 1.3 : 3), Math.cos(a) * 5.3, deck + 0.3, Math.sin(a) * 5.3, g));
      }
      // the VTOL
      const vtol = new THREE.Group();
      vtol.position.set(0.4, deck + 0.9, 0.2);
      vtol.rotation.y = 0.5;
      g.add(vtol);
      mesh(new THREE.CapsuleGeometry(0.75, 2.6, 4, 12).rotateZ(Math.PI / 2), std("#d8d6e8", 0.35, 0.6), 0, 0, 0, vtol);
      mesh(new THREE.SphereGeometry(0.62, 12, 8), M.glass, 1.2, 0.3, 0, vtol);
      const rotors = [];
      for (const [x, z] of [[-1, -1.5], [-1, 1.5], [1, -1.5], [1, 1.5]]) {
        mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 12), M.dark, x, 0.2, z, vtol);
        rotors.push(mesh(new THREE.BoxGeometry(1.8, 0.04, 0.14), M.metal, x, 0.5, z, vtol));
      }
      mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), glow("deploy", PIXEL ? 1.3 : 3), -1.9, 0, 0, vtol);
      // the control tower
      mesh(new THREE.CylinderGeometry(0.6, 0.8, 10, 12), M.concrete, -4.2, 6.4, -3, g);
      mesh(new THREE.CylinderGeometry(1.4, 1.0, 1.4, 8), M.glass, -4.2, 12, -3, g);
      mesh(new THREE.CylinderGeometry(1.25, 0.9, 1.1, 8), glow("model", PIXEL ? 0.9 : 1.2), -4.2, 12, -3, g);
      const beacon = mesh(new THREE.SphereGeometry(0.3, 8, 6), glow("red", PIXEL ? 1.3 : 4), -4.2, 13.3, -3, g);
      p.top.set(SITE.deploy.x, deck + 1, SITE.deploy.z);
      p.update = (t) => {
        rotors.forEach((r, i) => (r.rotation.y = t * 6 + i));
        const lead = Math.floor(t * 12) % edge.length;
        edge.forEach((e, i) => e.scale.setScalar(i === lead || (i + 10) % edge.length === lead ? 1.8 : 1));
        beacon.visible = Math.sin(t * 5) > 0;
      };
    },
  };

  // A koi drawn as one glowing line; swim(t) ripples it.
  function koiLine(len, colName) {
    const n = 26;
    const base = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * len, bodyW = Math.sin(a) * len * 0.32 * (Math.cos(a) > 0 ? 1 : 0.6 + 0.4 * (1 + Math.cos(a)));
      base.push([x, bodyW]);
    }
    // the tail fork
    base.splice(n / 2, 0, [-len * 1.25, len * 0.35], [-len * 1.05, 0], [-len * 1.25, -len * 0.35]);
    const geo = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(base.length * 3), 3));
    const obj = new THREE.LineLoop(geo, lineGlow(colName, PIXEL ? 1.3 : 2.6));
    const swim = (t) => {
      const a = geo.attributes.position;
      base.forEach(([x, w], i) => a.setXYZ(i, x, Math.sin(t) * 0.05 * len, w + Math.sin(t - x / len * 2.2) * 0.22 * len * (1 - x / len) * 0.5));
      a.needsUpdate = true;
    };
    swim(0);
    return { obj, swim };
  }

  // ============================================================
  // Life in the air: traffic, rain, searchlights, the blimp, the koi
  // ============================================================
  const lanes = [];
  let traffic = null, trafficLights = null;
  function buildTraffic() {
    // x-lanes over the plate's back and between the megatowers; z-lanes along two avenues
    const defs = [
      { axis: "x", c: -36 * Z, y: 19, dir: 1, n: 16, speed: 22 }, { axis: "x", c: -33 * Z, y: 21, dir: -1, n: 16, speed: 26 },
      { axis: "x", c: 20 * Z, y: 24, dir: 1, n: 14, speed: 24 },
      { axis: "x", c: -120 * Z, y: -26 * Z, dir: 1, n: 30, speed: 30 }, { axis: "x", c: -125 * Z, y: -30 * Z, dir: -1, n: 30, speed: 28 },
      { axis: "x", c: -190 * Z, y: -62 * Z, dir: 1, n: 34, speed: 34 }, { axis: "x", c: -250 * Z, y: -92 * Z, dir: -1, n: 36, speed: 32 },
      { axis: "z", c: -96 * Z, y: 16, dir: 1, n: 14, speed: 20 }, { axis: "z", c: 104 * Z, y: 17, dir: -1, n: 14, speed: 22 },
    ];
    let total = 0;
    for (const d of defs) {
      const cars = [];
      for (let i = 0; i < d.n; i++) cars.push({ o: i / d.n + rand() * 0.02, lane: rand() - 0.5 });
      lanes.push({ ...d, cars, span: d.axis === "x" ? (420 + Math.max(0, -d.c / Z) * 1.2) * Z : 220 * Z });
      total += d.n;
    }
    traffic = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.55, 1), std("#1c1a2c", 0.35, 0.7), total);
    trafficLights = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.3, 0.8), new THREE.MeshBasicMaterial({ toneMapped: false }), total * 2);
    let li = 0;
    for (const L of lanes) for (let i = 0; i < L.cars.length; i++) {
      trafficLights.setColorAt(li++, C("#ffffff", PIXEL ? 1.3 : 3.5));
      trafficLights.setColorAt(li++, C("red", PIXEL ? 1.3 : 3));
    }
    scene.add(traffic, trafficLights);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(1, 1, 1);
  const yUp = new THREE.Vector3(0, 1, 0);
  function updateTraffic(t) {
    let i = 0, li = 0;
    for (const L of lanes) {
      const heading = L.axis === "x" ? (L.dir > 0 ? 0 : Math.PI) : L.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      q.setFromAxisAngle(yUp, heading);
      for (const car of L.cars) {
        const f = ((car.o + (t * L.speed * L.dir) / L.span) % 1 + 1) % 1;
        const along = (f - 0.5) * L.span;
        const x = L.axis === "x" ? along : L.c + car.lane * 3, z = L.axis === "x" ? L.c + car.lane * 3 : along * 0.6 + 10 * Z;
        v3.set(x, L.y + car.lane * 1.5, z);
        traffic.setMatrixAt(i++, m4.compose(v3, q, s3));
        const fx = Math.cos(heading), fz = -Math.sin(heading);
        trafficLights.setMatrixAt(li++, m4.compose(v3.set(x + fx * 1.15, L.y + car.lane * 1.5, z + fz * 1.15), q, s3));
        trafficLights.setMatrixAt(li++, m4.compose(v3.set(x - fx * 1.15, L.y + car.lane * 1.5, z - fz * 1.15), q, s3));
      }
    }
    traffic.instanceMatrix.needsUpdate = true;
    trafficLights.instanceMatrix.needsUpdate = true;
  }

  let rain = null;
  function buildRain() {
    const n = PIXEL ? 1800 : 2600;
    const pos = new Float32Array(n * 6), seed = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const x = (rand() - 0.5) * 240 * Z, y = rand() * 90, z = lerp(-110, 95, rand()) * Z;
      pos.set([x, y, z, x, y, z], i * 6);
      seed[i * 2] = 0;
      seed[i * 2 + 1] = 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aEnd", new THREE.BufferAttribute(seed, 1));
    rain = new THREE.LineSegments(geo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: U.time, uCol: { value: C("#9ab8ff", PIXEL ? 0.3 : 0.11) } },
      vertexShader: /* glsl */ `
        attribute float aEnd; uniform float uTime; varying float vA;
        void main() {
          vec3 p = position;
          p.y = mod(p.y - uTime * 55.0, 90.0);
          p += vec3(-0.35, 1.6, 0.25) * aEnd;
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

  const searchlights = [];
  function buildSearchlights() {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uCol: { value: C("#c8b8ff", PIXEL ? 0.35 : 0.45) } },
      vertexShader: /* glsl */ `varying float vY; varying vec3 vN; varying vec3 vV;
        void main() { vY = uv.y; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */ `uniform vec3 uCol; varying float vY; varying vec3 vN; varying vec3 vV;
        void main() { float side = pow(abs(dot(vN, vV)), 1.5); gl_FragColor = vec4(uCol * vY * vY * side, 1.0); }`,
    });
    for (const [x, z, y, ph] of [[-120 * Z, -150 * Z, -70 * Z, 0], [40 * Z, -210 * Z, -100 * Z, 2.1], [150 * Z, -130 * Z, -60 * Z, 4]]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, z);
      // apex at the lamp, opening upward
      pivot.add(new THREE.Mesh(new THREE.ConeGeometry(16 * Z, 240 * Z, 32, 1, true).translate(0, -120 * Z, 0).rotateX(Math.PI), mat));
      scene.add(pivot);
      searchlights.push({ pivot, ph });
    }
  }

  let blimp = null, adTex = null;
  const adCanvas = makeCanvas(PIXEL ? 64 : 256, PIXEL ? 24 : 96);
  function drawAd(t) {
    const g = adCanvas.getContext("2d"), w = adCanvas.width, h = adCanvas.height, s = w / 64;
    const page = Math.floor(t / 4) % 3;
    g.fillStyle = "#0a0614";
    g.fillRect(0, 0, w, h);
    if (page === 0) {
      for (let x = 0; x < w; x += 2 * s) {
        g.fillStyle = x / s % 8 < 4 ? PAL.neonPink : PAL.neonCyan;
        g.fillRect(x, h * 0.5 + Math.sin(x / s / 5 + t * 3) * h * 0.25, 2 * s, 2 * s);
      }
    } else {
      g.fillStyle = page === 1 ? PAL.neonPink : PAL.neonCyan;
      g.font = `bold ${Math.round(h * 0.42)}px sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(page === 1 ? "LINGO-NET" : "MAGLEV 9", w / 2, h * 0.42);
      g.fillStyle = PAL.pearl ?? "#fff";
      g.font = `${Math.round(h * 0.18)}px sans-serif`;
      g.fillText(page === 1 ? "talk to the city" : "600 km/h · soon", w / 2, h * 0.78);
    }
    if (adTex) adTex.needsUpdate = true;
  }
  function buildSkyStuff() {
    drawAd(0);
    adTex = new THREE.CanvasTexture(adCanvas);
    adTex.colorSpace = THREE.SRGBColorSpace;
    if (PIXEL) adTex.magFilter = adTex.minFilter = THREE.NearestFilter;
    const adMat = new THREE.MeshBasicMaterial({ map: adTex, toneMapped: false, color: C("#ffffff", PIXEL ? 1.1 : 1.4) });
    for (const s of screens) mesh(new THREE.PlaneGeometry(s.w, s.h), adMat, s.x, s.y, s.z, scene).rotation.y = s.ry;
    blimp = new THREE.Group();
    const hull = mesh(new THREE.SphereGeometry(1, 32, 16), std("#3a3650", 0.5, 0.5), 0, 0, 0, blimp);
    hull.scale.set(18, 5, 5);
    const screen = mesh(new THREE.PlaneGeometry(18, 5.6), adMat, 0, 0, 4.9, blimp);
    screen.rotation.x = -0.08;
    mesh(new THREE.BoxGeometry(6, 1.6, 2.4), M.dark, 0, -5.4, 0, blimp);
    for (const sz of [-1, 1]) mesh(new THREE.BoxGeometry(3, 0.3, 4), M.dark, -16, 0, sz * 2.4, blimp);
    mesh(new THREE.SphereGeometry(0.4, 8, 6), glow("red", PIXEL ? 1.3 : 3), 18.2, 0, 0, blimp);
    scene.add(blimp);
    bigKoi = koiLine(14, "neonPink");
    scene.add(bigKoi.obj);
  }
  let bigKoi = null;

  // ============================================================
  // Build everything once
  // ============================================================
  buildCity();
  buildGround();
  buildPlaces();
  buildTraffic();
  buildRain();
  buildSearchlights();
  buildSkyStuff();

  // the CCTV camera for the corner: on a pole at a street corner by the arcology, looking up
  const cctvAt = new THREE.Vector3();
  {
    const [gx, gz] = toGrid(SITE.hub.x - 14, SITE.hub.z + 20);
    const [x, z] = toWorld(Math.round(gx / CELL) * CELL, Math.round(gz / CELL) * CELL);
    cctvAt.set(x, 8, z); // on a pole, over the low roofs
  }

  let lastUi = -1;
  return K.world({
    places,
    cctv: { position: cctvAt, lookAt: new THREE.Vector3(SITE.hub.x, 23, SITE.hub.z) },
    update(t) {
      updateTraffic(t);
      for (const sl of searchlights) {
        sl.pivot.rotation.z = Math.sin(t * 0.21 + sl.ph) * 0.45;
        sl.pivot.rotation.x = Math.cos(t * 0.17 + sl.ph) * 0.3 - 0.15;
      }
      const bx = (((t * 6 + 240) % 640) - 320) * Z;
      blimp.position.set(bx, -34 * Z, -150 * Z);
      blimp.rotation.y = 0;
      bigKoi.obj.position.set(Math.sin(t * 0.05) * 150 * Z, (-70 + Math.sin(t * 0.3) * 4) * Z, (-205 + Math.cos(t * 0.08) * 20) * Z);
      bigKoi.obj.rotation.y = Math.cos(t * 0.05) > 0 ? 0 : Math.PI;
      bigKoi.swim(t * 2);
      if (t - lastUi > 0.25) {
        lastUi = t;
        drawAd(t);
      }
    },
  });
}
