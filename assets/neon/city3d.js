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
// The engine runs the scenario on its flat map (art pixels, MAP_H high). Here
// the map is the screen of a fixed camera: each block's dock, high over its
// roof, projects to its spot on the map, and every route, runner and speck the
// engine moves across the map is cast back onto the plane of the docks. The
// district stands on a plate; past its far edge the megatowers rise out of the
// undercity into the smog, which is the skyline at the top of the view.

// eslint-disable-next-line no-unused-vars
function NeonCity3D(THREE, X, opts) {
  "use strict";
  const PIXEL = !!opts?.pixel;
  const PAL = window.NEON_ATLAS.palette;
  const C = (name, k = 1) => new THREE.Color(PAL[name] ?? name).multiplyScalar(k);
  const U = { time: { value: 0 }, alarm: { value: 0 } }; // uniforms shared by every material

  // ============================================================
  // Camera, and the map ↔ world mapping
  // ============================================================
  const DOCK = 11; // the altitude of the routes: where the runners fly
  // Z: how far out the view is. Every distance in the layout (the camera's, the
  // blocks' spacing, the plate, the gulf, the smog) grows with it; the buildings,
  // blocks and cars keep their size, so more of the city fits between them.
  const Z = 1.65;
  const VIEW = { dist: 300 * Z, pitch: THREE.MathUtils.degToRad(33), hfov: THREE.MathUtils.degToRad(31), target: new THREE.Vector3(0, 0, -6 * Z) };
  const camera = new THREE.PerspectiveCamera(20, 2.2, 30, 1400 * Z);
  let aspectNow = 0;
  function aim(aspect) {
    if (aspect === aspectNow) return;
    aspectNow = aspect;
    camera.aspect = aspect;
    // the width of the view stays put; a narrow screen sees more depth instead
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(VIEW.hfov / 2) / aspect));
    const { dist, pitch, target } = VIEW;
    camera.position.set(target.x, target.y + Math.sin(pitch) * dist, target.z + Math.cos(pitch) * dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }
  const ray = new THREE.Raycaster();
  const flat = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();
  function castNdc(nx, ny, h, out = new THREE.Vector3()) {
    ndc.set(nx, ny);
    ray.setFromCamera(ndc, camera);
    flat.constant = -h;
    return ray.ray.intersectPlane(flat, out) ?? out.set(0, h, 0);
  }
  // a map point (art pixels) cast onto the plane at height h
  const cast = (x, y, h, out) => castNdc((x / map.W) * 2 - 1, 1 - (y / map.H) * 2, h, out);
  const tmpV = new THREE.Vector3();
  function toMap(v) {
    tmpV.copy(v).project(camera);
    return { x: ((tmpV.x + 1) / 2) * map.W, y: ((1 - tmpV.y) / 2) * map.H };
  }

  // Where the blocks stand: screen fractions of the reference view (aspect 2.2),
  // cast down to the ground once, so the city itself never moves.
  // Each block stands below its dock, so a card goes above it or to one side.
  const LAYOUT = {
    hub: [0.49, 0.55, ["below", "above"]],
    knowledge: [0.17, 0.37, ["above", "right", "left"]],
    documents: [0.6, 0.29, ["right", "left", "above"]],
    models: [0.86, 0.35, ["above", "left"]],
    repos: [0.15, 0.72, ["right", "above", "below"]],
    tests: [0.76, 0.65, ["below", "right", "left"]],
    memory: [0.38, 0.86, ["left", "right", "above"]],
    deploy: [0.88, 0.86, ["left", "above"]],
  };
  const SIZE = { hub: [8.5, 30], knowledge: [6.5, 9], documents: [6, 11], models: [6, 19], repos: [6.5, 12], tests: [6.5, 9], memory: [6, 15], deploy: [7, 13] }; // footprint radius, height
  aim(2.2);
  const SITE = {};
  for (const [k, [fx, fy]] of Object.entries(LAYOUT)) {
    const p = castNdc(fx * 2 - 1, 1 - fy * 2, DOCK);
    SITE[k] = { x: p.x, z: p.z, r: SIZE[k][0], h: SIZE[k][1] };
  }
  const nearSite = (x, z, pad) => Object.values(SITE).some((s) => Math.hypot(x - s.x, z - s.z) < s.r + pad);

  // ============================================================
  // Renderer and scene
  // ============================================================
  const canvas = document.createElement("canvas");
  canvas.className = "city3d";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", $("#world").getAttribute("aria-label"));
  $("#world").setAttribute("aria-hidden", "true");
  $("#map").insertBefore(canvas, $("#world"));
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = PIXEL ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  // the pixel city is quantized to the palette's darks, so it gets more light and a paler smog
  const SMOG = C(PIXEL ? "#3e1a58" : "#2a1036");
  scene.background = SMOG.clone();
  scene.fog = new THREE.Fog(SMOG.clone(), (PIXEL ? 230 : 300) * Z, (PIXEL ? 900 : 1150) * Z);
  scene.add(new THREE.HemisphereLight(C("#6a4ab0"), C("#0a0a18"), PIXEL ? 1.15 : 0.9));
  const moon = new THREE.DirectionalLight(C("#8fb4ff"), PIXEL ? 0.7 : 0.35);
  moon.position.set(-60, 120, 40);
  scene.add(moon);

  // ============================================================
  // Materials and small helpers
  // ============================================================
  const rand = rng(1971);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const NEON = ["neonPink", "neonCyan", "neonAmber", "neonViolet", "neonGreen"];
  const glow = (c, k = 2.5) => new THREE.MeshBasicMaterial({ color: C(c, k), toneMapped: false, fog: true });
  const haze = (c, k = 1, opacity = 1) => new THREE.MeshBasicMaterial({ color: C(c, k), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const lineGlow = (c, k = 2, opacity = 1) => new THREE.LineBasicMaterial({ color: C(c, k), transparent: opacity < 1, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const std = (color, rough = 0.7, metal = 0.3, extra = {}) => new THREE.MeshStandardMaterial({ color: C(color), roughness: rough, metalness: metal, flatShading: PIXEL, ...extra });
  const M = {
    concrete: std("#2c2838", 0.85, 0.15),
    metal: std("#454360", 0.35, 0.8),
    dark: std("#15131f", 0.55, 0.5),
    wood: std("#2e1a22", 0.8, 0.1),
    tile: std("#1d1828", 0.5, 0.4),
    glass: std("#1a4a5a", 0.08, 0.9, { transparent: true, opacity: 0.45 }),
  };
  function tex(w, h, draw, repeat) {
    const c = makeCanvas(w, h);
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (PIXEL) t.magFilter = t.minFilter = THREE.NearestFilter;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  const litSeed = (share, k = 0) => (share - 0.06) / 0.5 / 13.37 + k; // k: a whole number, to vary the pattern
  function seeded(geo, seed) {
    geo.setAttribute("aSeed", new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count).fill(seed), 1));
    return geo;
  }
  function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent?.add(m);
    return m;
  }

  // Windows, drawn by the shader: floors and bays in world space, each tower lit
  // to its own degree, whole floors dark, a few flickering, shopfronts at the foot.
  const WINDOWS = /* glsl */ `
    uniform float uTime;
    varying float vSeed;
    varying vec3 vWPos;
    varying vec3 vWNrm;
    float wh(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    void windows(inout vec3 base, inout vec3 emit) {
      if (vSeed < 0.0) return;
      vec3 n = normalize(vWNrm);
      if (abs(n.y) > 0.5) return;
      float u = dot(vWPos.xz, normalize(vec2(-n.z, n.x))); // along the facade
      float v = vWPos.y - floor(fract(vSeed) * 3.0) * 0.37;
      vec2 cell = floor(vec2(u / 0.8, v / 1.15));
      vec2 f = fract(vec2(u / 0.8, v / 1.15));
      float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.3, f.y) * step(f.y, 0.82);
      float s = fract(vSeed) * 97.0 + floor(vSeed) * 13.1;
      float lit = step(wh(vec3(cell, s)), fract(fract(vSeed) * 13.37) * 0.5 + 0.06);
      lit *= step(0.28, wh(vec3(1.0, cell.y, s + 3.0)));
      float hue = wh(vec3(floor(cell.x / 5.0), cell.y, s + 9.0));
      vec3 wc = hue < 0.55 ? vec3(1.0, 0.55, 0.22) : hue < 0.85 ? vec3(0.35, 0.75, 1.0) : vec3(1.0, 0.3, 0.65);
      float flick = wh(vec3(cell, s + 1.0)) < 0.008 ? step(0.3, fract(uTime * 0.35 + s * 0.07)) : 1.0;
      if (vWPos.y < 1.2) {
        // shopfronts at street level, some in neon
        win = step(0.08, fract(u / 3.1)) * step(fract(u / 3.1), 0.92) * step(0.15, vWPos.y) * step(vWPos.y, 1.0);
        float shop = wh(vec3(floor(u / 3.1), 7.0, s));
        lit = step(0.4, shop);
        wc = shop < 0.6 ? vec3(1.0, 0.25, 0.6) : shop < 0.8 ? vec3(0.2, 0.9, 1.0) : vec3(1.0, 0.7, 0.35);
      }
      base = mix(base, vec3(0.015, 0.02, 0.035), win);
      emit += win * lit * flick * wc * ${PIXEL ? "1.5" : "1.5"} * (vWPos.y < 1.2 ? ${PIXEL ? "0.55" : "1.0"} : 1.0);
    }`;
  function windowMaterial(color, rough = 0.75, metal = 0.25) {
    const m = std(color, rough, metal);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = U.time;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float aSeed;\nvarying float vSeed;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;")
        .replace("#include <fog_vertex>", "#include <fog_vertex>\nvSeed = aSeed;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNrm = normalize(mat3(modelMatrix) * objectNormal);");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\n" + WINDOWS)
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\nwindows(diffuseColor.rgb, totalEmissiveRadiance);");
    };
    return m;
  }
  const TOWER = windowMaterial("#25222f");
  const TOWER_HI = windowMaterial("#302c3c", 0.5, 0.5);

  // A vertical sign's glyphs: eight columns of made-up characters, white on black
  const glyphTex = tex(PIXEL ? 64 : 256, PIXEL ? 256 : 1024, (g, w, h) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    const cw = w / 8, r = rng(5);
    g.fillStyle = "#fff";
    for (let c = 0; c < 8; c++) {
      for (let y = cw * 0.3; y < h - cw; y += cw * 1.1) {
        // each glyph: a few strokes on a 4 × 4 grid
        const s = cw * 0.18;
        for (let k = 0; k < 4 + r() * 3; k++) {
          const gx = c * cw + cw * 0.18 + Math.floor(r() * 4) * s, gy = y + Math.floor(r() * 4) * s;
          if (r() < 0.5) g.fillRect(gx, gy, s * (1 + Math.floor(r() * 3)), Math.max(1, s * 0.45));
          else g.fillRect(gx, gy, Math.max(1, s * 0.45), s * (1 + Math.floor(r() * 3)));
        }
      }
    }
  });

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
  const softDot = tex(64, 64, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.3, "rgba(255,255,255,0.5)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, w, w);
  });
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

  function pointsMaterial(color, size) {
    return new THREE.PointsMaterial({ color, size, sizeAttenuation: !PIXEL, map: PIXEL ? null : softDot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  }
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
  // The runners: hover cars cut from the pixel sprite's profile
  // ============================================================
  const cars = {};
  function buildCars() {
    const shell = [[1, 8], [4, 5], [10, 3.5], [18, 3], [24, 4.5], [27, 6.5], [27, 9], [2, 10]];
    const glass = [[11, 4.5], [18, 4], [22, 5.5], [13, 6.2]];
    const S = 0.16; // units per sprite pixel: a car 4.2 units long
    const shape = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2((x - 14) * S, (7 - y) * S)));
    const bodyGeo = new THREE.ExtrudeGeometry(shape(shell), { depth: 1.5, bevelEnabled: !PIXEL, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 2 }).translate(0, 0, -0.75);
    const glassGeo = new THREE.ExtrudeGeometry(shape(glass), { depth: 1.1, bevelEnabled: false }).translate(0, 0.02, -0.55);
    for (const a of NEON_STORY.agents) {
      const g = new THREE.Group();
      mesh(bodyGeo, std("#1d1a2e", 0.28, 0.75), 0, 0, 0, g);
      mesh(glassGeo, std("#7fe8ff", 0.1, 0.9, { emissive: C("#1a6a8a", 0.6) }), 0, 0, 0, g);
      mesh(new THREE.BoxGeometry(3.4, 0.08, 0.1), glow(a.color, PIXEL ? 1.3 : 3), -0.2, -0.05, 0.8, g); // the pinstripe
      const under = mesh(new THREE.PlaneGeometry(3.8, 1.6), haze(a.color, PIXEL ? 1.2 : 2.5, 0.9), -0.2, -0.55, 0, g);
      under.rotation.x = Math.PI / 2;
      under.material.map = softDot;
      mesh(new THREE.BoxGeometry(0.12, 0.2, 1.1), glow("#ffffff", PIXEL ? 1.3 : 4), 2.1, -0.15, 0, g);
      mesh(new THREE.BoxGeometry(0.12, 0.16, 1.2), glow("red", PIXEL ? 1.3 : 3), -2.1, -0.2, 0, g);
      g.visible = false;
      g.userData.size = 1.3; // a little larger than life, so they read from this far out
      scene.add(g);
      cars[a.id] = { g, yaw: 0, last: null };
    }
  }
  const car3 = (ag, out = new THREE.Vector3()) => cast(ag.x, ag.y, DOCK, out).setY(DOCK + 1.2);

  // ============================================================
  // ICE: a black mask with red eyes, climbing out of the firewall
  // ============================================================
  let ice = null;
  function buildIce() {
    const outline = [[-1, 0.55], [-0.86, 0.98], [0, 1.12], [0.86, 0.98], [1, 0.55], [0.76, -0.2], [0.36, -0.78], [0, -1.02], [-0.36, -0.78], [-0.76, -0.2]];
    const S = 3.2;
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x * S, y * S)));
    for (const sx of [-1, 1]) {
      const eye = [[0.22, 0.44], [0.78, 0.5], [0.72, 0.3], [0.26, 0.26]].map(([x, y]) => new THREE.Vector2(sx * x * S, y * S));
      shape.holes.push(new THREE.Path(sx > 0 ? eye : eye.reverse()));
    }
    const g = new THREE.Group();
    const face = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: !PIXEL, bevelThickness: 0.3, bevelSize: 0.25, bevelSegments: 2 }), std("#08070e", 0.22, 0.9), 0, 0, -0.4, g);
    face.castShadow = false;
    const eyes = mesh(new THREE.PlaneGeometry(S * 1.8, S * 0.4), glow("red", PIXEL ? 1.4 : 5), 0, 0.38 * S, -0.3, g);
    // a red wire traced round the mask, so it reads against the dark city
    const rim = outline.map(([x, y]) => new THREE.Vector3(x * S * 1.04, y * S * 1.04, 0.75));
    g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(rim), lineGlow("red", PIXEL ? 1.4 : 3.5)));
    const halo = new THREE.PointLight(C("red"), PIXEL ? 120 : 200, 40, 1.4);
    halo.position.set(0, 0, 4);
    g.add(halo);
    const grille = [];
    for (let i = -2; i <= 2; i++) grille.push(mesh(new THREE.BoxGeometry(0.28, 0.12, 0.2), glow("red", PIXEL ? 1.3 : 3), i * 0.45, -0.45 * S, 0.5, g));
    const slices = [];
    for (let i = 0; i < 6; i++) slices.push(mesh(new THREE.BoxGeometry(S * 2.4, 0.12, 0.1), glow(i % 3 ? "red" : "#ffffff", PIXEL ? 1.3 : 3), 0, 0, 0.7, g));
    // the tendrils: red wires that reach down and grip the dome
    const wires = [];
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(24 * 3), 3));
      const line = new THREE.Line(geo, lineGlow("red", PIXEL ? 1.3 : 3));
      line.frustumCulled = false;
      scene.add(line);
      wires.push(line);
    }
    g.visible = false;
    scene.add(g);
    ice = { g, eyes, slices, wires, grille };
  }
  const iceAt = new THREE.Vector3();
  function updateIce(t) {
    const on = villain.state !== "hidden";
    ice.g.visible = on;
    U.alarm.value = villain.state === "rising" ? Math.min(1, villain.k * 1.5) : villain.state === "sinking" ? villain.k : 0;
    for (const w of ice.wires) w.visible = on && villain.grab > 0.02;
    if (!on) return;
    const s = SITE.tests;
    iceAt.set(s.x - 2, lerp(-2, 21, villain.k) + Math.sin(t * 1.4) * 0.6, s.z - 2);
    ice.g.position.copy(iceAt);
    ice.g.rotation.y = Math.atan2(camera.position.x - iceAt.x, camera.position.z - iceAt.z);
    ice.g.rotation.x = -0.35;
    ice.g.scale.setScalar(0.5 + villain.k * 1.1);
    const beat = Math.floor(t * 10);
    ice.slices.forEach((sl, i) => {
      sl.visible = hash2(beat, i, 5) < 0.3 + villain.grab * 0.3;
      sl.position.set((hash2(beat, i, 6) - 0.5) * 1.6, (hash2(beat, i, 7) - 0.5) * 6, 0.7);
    });
    ice.eyes.scale.y = hash2(beat, 9, 1) < 0.08 ? 0.2 : 1;
    // the wires fall from the chin to points round the dome's crown
    ice.wires.forEach((w, i) => {
      const a = (i / ice.wires.length) * Math.PI * 2 + 0.4;
      const reach = villain.grab;
      const end = v3.set(s.x + Math.cos(a) * (s.r - 1.2) * 0.8, 1.4 + (s.r - 1.4) * 0.72, s.z + Math.sin(a) * (s.r - 1.2) * 0.8);
      const pos = w.geometry.attributes.position;
      for (let j = 0; j < 24; j++) {
        const f = (j / 23) * reach;
        const x = lerp(iceAt.x, end.x, f), y = lerp(iceAt.y - 4.5, end.y, f) + Math.sin(f * Math.PI) * 3, z = lerp(iceAt.z, end.z, f);
        const wob = Math.sin(t * 6 + j * 0.7 + i) * 0.35 * Math.sin(f * Math.PI);
        pos.setXYZ(j, x + wob, y, z + wob * 0.6);
      }
      pos.needsUpdate = true;
    });
  }

  // ============================================================
  // Routes, packets, specks and trails, all as glowing points
  // ============================================================
  const MAXP = 2600;
  const fx = { pos: new Float32Array(MAXP * 3), col: new Float32Array(MAXP * 3), n: 0, obj: null };
  function buildPoints() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(fx.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("color", new THREE.BufferAttribute(fx.col, 3).setUsage(THREE.DynamicDrawUsage));
    fx.obj = new THREE.Points(geo, new THREE.PointsMaterial({ size: PIXEL ? 2 : 1.1, sizeAttenuation: !PIXEL, vertexColors: true, map: PIXEL ? null : softDot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    fx.obj.frustumCulled = false;
    scene.add(fx.obj);
    // the beams from a working runner to its block
    beams = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(16 * 6), 3)).setAttribute("color", new THREE.BufferAttribute(new Float32Array(16 * 6), 3)), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    beams.frustumCulled = false;
    scene.add(beams);
  }
  let beams = null;
  const tmpC = new THREE.Color();
  function dot(p, colHex, k) {
    if (fx.n >= MAXP) return;
    p.toArray(fx.pos, fx.n * 3);
    tmpC.set(colHex).multiplyScalar(k * (PIXEL ? 0.6 : 1)).toArray(fx.col, fx.n * 3);
    fx.n++;
  }
  // the beads of every route, cast onto the dock plane once per layout
  let beadPos = {};
  function castBeads() {
    beadPos = {};
    for (const k of SPOKES) beadPos[k] = paths[k].beads.map((b) => cast(b.x, b.y, DOCK - 0.4));
  }
  const world3 = [];
  function spawn(kind, p, v, col, life, size = 1) {
    world3.push({ kind, p: p.clone(), v: v.clone(), col, t0: clock.t, life, size });
    if (world3.length > 900) world3.splice(0, world3.length - 900);
  }
  const P3 = new THREE.Vector3(), Q3 = new THREE.Vector3();
  function drawPoints(t) {
    fx.n = 0;
    for (const k of SPOKES) {
      const p = paths[k];
      const busy = t < p.busyUntil;
      const flow = t * (busy ? 26 : 8) * p.dir;
      p.beads.forEach((b, i) => {
        const lead = cycle((b.d - flow) / 6, busy ? 3 : 6) === 0;
        dot(beadPos[k][i], b.col, lead ? (busy ? 3.2 : 1.8) : busy ? 1.1 : 0.55);
      });
    }
    for (const pk of packets) {
      const s = clamp((t - pk.t0) / pk.dur, 0, 1);
      const q = pathAt(pk.key, pk.fromHub ? s : 1 - s);
      cast(q.x, q.y, DOCK, P3);
      dot(P3, pk.col, 5);
      dot(P3.setY(P3.y + 0.01), "#ffffff", 3);
    }
    for (const p of particles) {
      const age = (t - p.t0) / p.life;
      if (p.kind === "speck") {
        const key = (p.key ??= p.ag.beam?.key);
        if (!key) continue;
        car3(p.ag, P3);
        Q3.copy(places[key].top);
        const f = p.out ? 1 - age : age;
        P3.lerp(Q3, f);
        P3.y += Math.sin(age * Math.PI) * p.wig * 0.3;
        dot(P3, p.col, 2.5 * (1 - age * 0.5));
      } else if (p.kind === "ring") {
        cast(p.x, p.y + 4, DOCK, P3);
        const r = 0.6 + age * 3.2;
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          dot(Q3.set(P3.x + Math.cos(a) * r, P3.y, P3.z + Math.sin(a) * r), p.col, 2.4 * (1 - age));
        }
      }
    }
    // the world's own: exhaust sparks, steam, glitch
    for (const w of world3) {
      const age = (t - w.t0) / w.life;
      if (age >= 1) continue;
      Q3.copy(w.p).addScaledVector(w.v, t - w.t0);
      dot(Q3, w.col, (w.kind === "steam" ? 0.35 : 2.2) * (1 - age));
    }
    for (let i = world3.length - 1; i >= 0; i--) if ((t - world3[i].t0) / world3[i].life >= 1) world3.splice(i, 1);
    const g = fx.obj.geometry;
    g.setDrawRange(0, fx.n);
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    // beams
    const bp = beams.geometry.attributes.position, bc = beams.geometry.attributes.color;
    let bn = 0;
    for (const ag of Object.values(fleet)) {
      if (!ag.visible || !ag.beam?.key) continue;
      car3(ag, P3);
      Q3.copy(places[ag.beam.key].top);
      const flick = 0.6 + 0.4 * Math.sin(t * 20 + ag.slot);
      tmpC.set(ag.beam.col).multiplyScalar((PIXEL ? 0.8 : 1.6) * flick);
      bp.setXYZ(bn, P3.x, P3.y - 0.4, P3.z);
      bc.setXYZ(bn++, tmpC.r, tmpC.g, tmpC.b);
      bp.setXYZ(bn, Q3.x, Q3.y, Q3.z);
      bc.setXYZ(bn++, tmpC.r * 0.4, tmpC.g * 0.4, tmpC.b * 0.4);
    }
    beams.geometry.setDrawRange(0, bn);
    bp.needsUpdate = bc.needsUpdate = true;
  }

  // ============================================================
  // Post: bloom and grade (high fidelity) or palette and outline (pixel)
  // ============================================================
  let composer = null, bloom = null, pixelRT = null, pixelQuad = null;
  function buildPost() {
    if (!PIXEL) {
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
      composer = new X.EffectComposer(renderer, rt);
      composer.addPass(new X.RenderPass(scene, camera));
      bloom = new X.UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.45, 0.9);
      composer.addPass(bloom);
      composer.addPass(new X.ShaderPass({
        uniforms: { tDiffuse: { value: null }, uTime: U.time },
        vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: /* glsl */ `
          uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
          void main() {
            vec2 d = vUv - 0.5;
            float ca = dot(d, d) * 0.006;
            vec3 c = vec3(texture2D(tDiffuse, vUv + d * ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d * ca).b);
            c *= mix(1.0, 0.55, smoothstep(0.35, 0.85, length(d * vec2(1.1, 1.3))));
            c += (fract(sin(dot(vUv * 913.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.012;
            gl_FragColor = vec4(c, 1.0);
          }`,
      }));
      composer.addPass(new X.OutputPass());
      return;
    }
    const pal = Object.values(PAL).filter((v, i, a) => /^#[0-9a-f]{6}$/i.test(v) && a.indexOf(v) === i).slice(0, 96);
    const palVec = pal.map((h) => new THREE.Vector3(...hexRGB(h).map((v) => v / 255)));
    while (palVec.length < 96) palVec.push(palVec[0]);
    pixelRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(4, 4) });
    bloom = new X.UnrealBloomPass(new THREE.Vector2(128, 64), 0.18, 0.05, 0.95);
    pixelQuad = new X.FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tColor: { value: pixelRT.texture }, tDepth: { value: pixelRT.depthTexture }, res: { value: new THREE.Vector2(4, 4) }, cn: { value: camera.near }, cf: { value: camera.far }, pal: { value: palVec }, npal: { value: Math.min(96, pal.length) } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: /* glsl */ `
        uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 res; uniform float cn, cf; uniform vec3 pal[96]; uniform int npal;
        varying vec2 vUv;
        float lin(vec2 uv) { float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return 2.0 * cn * cf / (cf + cn - z * (cf - cn)); }
        vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
        vec3 srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
        void main() {
          vec2 px = 1.0 / res;
          vec3 c = texture2D(tColor, vUv).rgb;
          float d = lin(vUv);
          float dn = min(min(lin(vUv + vec2(px.x, 0.0)), lin(vUv - vec2(px.x, 0.0))), min(lin(vUv + vec2(0.0, px.y)), lin(vUv - vec2(0.0, px.y))));
          // just behind a nearer edge: the ink outline of pixel art
          c *= mix(1.0, 0.3, step(0.8 + d * 0.012, d - dn));
          vec3 s = srgb(aces(c * 1.4));
          float best = 1e9;
          vec3 q = s;
          for (int i = 0; i < 96; i++) {
            if (i >= npal) break;
            vec3 e = s - pal[i];
            float rm = (s.r + pal[i].r) * 0.5;
            float dd = (2.0 + rm) * e.r * e.r + 4.0 * e.g * e.g + (3.0 - rm) * e.b * e.b;
            if (dd < best) { best = dd; q = pal[i]; }
          }
          gl_FragColor = vec4(q, 1.0);
        }`,
    }));
  }
  let size = { w: 0, h: 0 };
  // A device that can't keep up gets a lower resolution, stepping down only:
  // stepping back up would make it hunt, and every step resizes the canvas.
  // It runs before the frame is drawn, never after (a resize clears the canvas).
  let quality = 1, lastFrame = 0;
  const recent = [];
  function adapt() {
    const now = performance.now(), dt = now - lastFrame;
    lastFrame = now;
    if (PIXEL || dt > 250) return; // the pixel city is cheap; a long gap is a hidden tab
    recent.push(dt > 34 ? 1 : 0);
    if (recent.length > 90) recent.shift();
    if (recent.length === 90 && recent.reduce((a, b) => a + b, 0) > 70 && quality > 0.6) {
      quality = Math.max(0.6, quality * 0.8);
      recent.length = 0;
      resizeRender();
    }
  }
  function resizeRender() {
    const k = map.scale;
    const cw = map.W * k, ch = map.H * k;
    Object.assign(canvas.style, { left: `${map.ox}px`, top: `${map.oy}px`, width: `${cw}px`, height: `${ch}px` });
    if (PIXEL) {
      if (size.w === map.W && size.h === map.H) return;
      size = { w: map.W, h: map.H };
      renderer.setPixelRatio(1);
      renderer.setSize(map.W, map.H, false);
      pixelRT.setSize(map.W, map.H);
      bloom.setSize(map.W, map.H);
      pixelQuad.material.uniforms.res.value.set(map.W, map.H);
      ground.getRenderTarget().setSize(map.W, map.H);
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * quality;
    const w = Math.round(cw * dpr), h = Math.round(ch * dpr);
    if (size.w === w && size.h === h) return;
    size = { w, h };
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(Math.round(w / 2), Math.round(h / 2));
    ground.getRenderTarget().setSize(Math.round(w / 2), Math.round(h / 2));
  }
  function draw() {
    if (PIXEL) {
      renderer.setRenderTarget(pixelRT);
      renderer.render(scene, camera);
      bloom.render(renderer, null, pixelRT, 0, false);
      renderer.setRenderTarget(null);
      pixelQuad.render(renderer);
    } else {
      composer.render();
    }
  }

  // A still of any camera, read back as pixels: the minimap and the CCTV feed.
  const stillRT = new Map();
  function still(cam, w, h, exposure = 1.1) {
    let rt = stillRT.get(`${w}x${h}`);
    if (!rt) stillRT.set(`${w}x${h}`, (rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType })));
    const save = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    const px = new Float32Array(w * h * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
    renderer.setRenderTarget(save);
    const img = new ImageData(w, h);
    const tone = (v) => {
      v = Math.max(0, v) * exposure;
      v = (v * (2.51 * v + 0.03)) / (v * (2.43 * v + 0.59) + 0.14);
      v = Math.min(1, v);
      return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = ((h - 1 - y) * w + x) * 4, o = (y * w + x) * 4;
        img.data[o] = tone(px[i]);
        img.data[o + 1] = tone(px[i + 1]);
        img.data[o + 2] = tone(px[i + 2]);
        img.data[o + 3] = 255;
      }
    }
    return img;
  }
  const PAL_RGB = Object.values(PAL).filter((v) => /^#[0-9a-f]{6}$/i.test(v)).map(hexRGB);
  function quantize(img) {
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      let best = Infinity, b = PAL_RGB[0];
      for (const c of PAL_RGB) {
        const rm = (d[i] + c[0]) / 510, er = d[i] - c[0], eg = d[i + 1] - c[1], eb = d[i + 2] - c[2];
        const dd = (2 + rm) * er * er + 4 * eg * eg + (3 - rm) * eb * eb;
        if (dd < best) {
          best = dd;
          b = c;
        }
      }
      d[i] = b[0];
      d[i + 1] = b[1];
      d[i + 2] = b[2];
    }
    return img;
  }

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
  buildCars();
  buildIce();
  buildPoints();
  buildPost();

  // the CCTV camera for the corner: on a pole at a street corner by the arcology, looking up
  const cctv = new THREE.PerspectiveCamera(58, 180 / 236, 0.5, 900);
  {
    const [gx, gz] = toGrid(SITE.hub.x - 14, SITE.hub.z + 20);
    const [x, z] = toWorld(Math.round(gx / CELL) * CELL, Math.round(gz / CELL) * CELL);
    cctv.position.set(x, 8, z); // on a pole, over the low roofs
  }
  cctv.lookAt(SITE.hub.x, 23, SITE.hub.z);
  cctv.updateMatrixWorld();

  // ============================================================
  // The world, as the engine sees it
  // ============================================================
  let lastUi = -1;
  const corner = { img: null, t: -9 };
  return {
    atlas: window.NEON_ATLAS,
    atlasFile: "assets/neon/atlas.js",
    stations: NEON_STORY.place(LAYOUT),
    mapH: PIXEL ? 520 : undefined, // the pixel city from further out needs a finer grain
    agentLift: 0,
    beadDim: "#1a1430",
    agentIcon: (a) => (PIXEL ? `car.${a.id}.fly0` : `hifi.car.${a.id}`),
    agentPort: (c) => ({ x: c.x, y: c.y }),
    beamTarget(key) {
      const m = toMap(places[key].top);
      return { x: m.x, y: m.y, key };
    },
    placeStation(s) {
      aim(map.W / map.H);
      const site = SITE[s.key];
      const dock = new THREE.Vector3(site.x, DOCK, site.z);
      const c = toMap(dock);
      s.x = c.x;
      s.y = c.y;
      const ex = toMap(dock.clone().setX(site.x + site.r)), ez = toMap(dock.clone().setZ(site.z + site.r));
      s.prx = Math.max(8, Math.abs(ex.x - c.x));
      s.pry = Math.max(5, Math.abs(ez.y - c.y));
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        for (const y of [0, site.h]) {
          const m = toMap(new THREE.Vector3(site.x + dx * site.r, y, site.z + dz * site.r));
          x0 = Math.min(x0, m.x);
          y0 = Math.min(y0, m.y);
          x1 = Math.max(x1, m.x);
          y1 = Math.max(y1, m.y);
        }
      }
      // the box the cards keep clear of: the building, not its whole plinth
      s.sx = x0 + (x1 - x0) * 0.1;
      s.sy = y0;
      s.w = (x1 - x0) * 0.8;
      s.h = (y1 - y0) * 0.85;
      s.lamps = [];
      s.parts = {};
    },
    onResize() {
      resizeRender();
      castBeads();
    },
    buildStatic() {
      // the minimap: a still of the whole view
      const w = Math.round(map.W / 3), h = Math.round(map.H / 3);
      const img = still(camera, w * 2, h * 2);
      const c = makeCanvas(w * 2, h * 2);
      c.getContext("2d").putImageData(PIXEL ? quantize(img) : img, 0, 0);
      staticCanvas = c;
    },
    render(t) {
      U.time.value = t;
      for (const k in places) places[k].update(t);
      updateTraffic(t);
      updateIce(t);
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
      for (const a of NEON_STORY.agents) {
        const ag = fleet[a.id], car = cars[a.id];
        car.g.visible = ag.visible;
        if (!ag.visible) continue;
        car3(ag, P3);
        if (car.last) {
          const dx = P3.x - car.last.x, dz = P3.z - car.last.z;
          if (dx * dx + dz * dz > 1e-5) {
            const want = Math.atan2(-dz, dx);
            let d = want - car.yaw;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            car.yaw += d * 0.25;
          }
        } else car.last = new THREE.Vector3();
        car.last.copy(P3);
        car.g.position.copy(P3);
        car.g.position.y += Math.sin(t * 2.2 + ag.slot) * 0.15;
        car.g.rotation.set(0, car.yaw, Math.sin(t * 1.7 + ag.slot) * 0.04);
        car.g.scale.setScalar(car.g.userData.size);
      }
      for (const sp of places.repos.steam ?? []) if (Math.random() < 0.3) spawn("steam", sp, Q3.set((Math.random() - 0.5) * 0.6, 2 + Math.random(), (Math.random() - 0.5) * 0.6), "#8a86a8", 3);
      drawPoints(t);
      adapt();
      draw();
    },
    seedAmbient() {},
    updateAmbient() {},
    onAgentStep(c) {
      if (!c.travel || Math.random() > 0.35) return;
      const car = cars[c.a.id];
      if (!car?.last) return;
      const back = new THREE.Vector3(-Math.cos(car.yaw) * 2.2, -0.2, Math.sin(car.yaw) * 2.2);
      spawn("spark", car.last.clone().add(back), back.multiplyScalar(0.8).setY(-0.5), PAL[c.a.color], 0.7);
    },
    villainHead: () => toMap(iceAt),
    onVillainSink() {
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 8;
        spawn("glitch", iceAt, new THREE.Vector3(Math.cos(a) * s, (Math.random() - 0.3) * s, Math.sin(a) * s), Math.random() < 0.7 ? PAL.red : "#ffffff", 1.2 + Math.random() * 0.8);
      }
    },
    drawCorner(now) {
      const c = $("#corner-art");
      const g = c.getContext("2d");
      const t = clock.t;
      if (t - corner.t > 0.45 || !corner.img) {
        corner.t = t;
        const w = PIXEL ? 90 : c.width, h = PIXEL ? 118 : c.height;
        cctv.aspect = w / h;
        cctv.updateProjectionMatrix();
        const img = still(cctv, w, h, 1.8);
        corner.img = makeCanvas(w, h);
        corner.img.getContext("2d").putImageData(PIXEL ? quantize(img) : img, 0, 0);
      }
      g.imageSmoothingEnabled = !PIXEL;
      g.drawImage(corner.img, 0, 0, c.width, c.height);
      if (!PIXEL) {
        // a little bloom, then the monitor: scanlines and a timecode
        g.globalCompositeOperation = "lighter";
        g.filter = "blur(8px)";
        g.globalAlpha = 0.5;
        g.drawImage(corner.img, 0, 0, c.width, c.height);
        g.filter = "none";
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
      }
      const s = c.width / 180;
      g.fillStyle = "rgba(4,2,10,0.6)";
      g.fillRect(0, 0, c.width, 38 * s);
      g.fillStyle = "rgba(0,0,0,0.22)";
      for (let y = 0; y < c.height; y += 3 * s) g.fillRect(0, y, c.width, s);
      g.font = PIXEL ? `${Math.round(7 * s)}px 'Share Tech Mono', monospace` : `500 ${Math.round(8 * s)}px 'JetBrains Mono', monospace`;
      // the timecode, centred where the panel's crop keeps it in view
      const cx = c.width * 0.45;
      g.textAlign = "center";
      g.fillStyle = "rgba(234,232,255,0.85)";
      g.fillText("CAM 07 · REC", cx + 5 * s, 20 * s);
      g.fillText(`SECTOR 7 · ${fmtClock(t)}`, cx, 32 * s);
      if (Math.floor(now * 1.5) % 2) {
        g.fillStyle = PAL.red;
        g.beginPath();
        g.arc(cx - g.measureText("CAM 07 · REC").width / 2 - 2 * s, 17 * s, 3 * s, 0, Math.PI * 2);
        g.fill();
      }
      g.textAlign = "left";
    },
    decorateChrome() {
      if (PIXEL) {
        $("#brand-mark").getContext("2d").drawImage(spr("ri.eye"), 0, 0);
        $("#meter-icon").getContext("2d").drawImage(spr("icon.city"), 0, 0);
        return;
      }
      useHifiIcons({ ink: "#eef2ff", accent: "#3ef0ff" });
      const bm = $("#brand-mark"), mi = $("#meter-icon");
      drawHifiIcon(bm.getContext("2d"), "icon.observe", bm.width, bm.height, { ink: "#ff8ac0", accent: "#3ef0ff", weight: 1.8 });
      drawHifiIcon(mi.getContext("2d"), "icon.city", mi.width, mi.height, { ink: "#3ef0ff", accent: "#ff8ac0", weight: 1.8 });
      // the runners' rows: a car's profile in its colour
      for (const a of NEON_STORY.agents) {
        const c = makeCanvas(80, 40), g = c.getContext("2d");
        g.scale(80 / 28, 40 / 14);
        g.fillStyle = "#2a2640";
        g.beginPath();
        [[1, 8], [4, 5], [10, 3.5], [18, 3], [24, 4.5], [27, 6.5], [27, 9], [2, 10]].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.fill();
        g.fillStyle = "#7fe8ff";
        g.beginPath();
        [[11, 4.5], [18, 4], [22, 5.5], [13, 6.2]].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.fill();
        g.fillStyle = PAL[a.color];
        g.shadowColor = PAL[a.color];
        g.shadowBlur = 3;
        g.fillRect(4, 10.4, 20, 1);
        g.fillRect(5, 6.8, 18, 0.6);
        FR.set(`hifi.car.${a.id}`, { c, flip: null });
      }
    },
  };
}
