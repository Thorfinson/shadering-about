// What every three.js city under the engine shares: the fixed camera and the
// map ↔ world mapping, the renderer and its post (bloom and grade for high
// fidelity; art resolution, depth outline and palette for pixel), the lit
// windows, the runners' cars, the ICE, the routes as glowing points, the stills
// for the minimap and the CCTV corner, and the hooks the engine calls.
// assets/neon/city3d.js (NEON//3D) and assets/noir/city3d.js (NOIR//3D) build
// their cities on it:
//
//   const K = City3D(THREE, X, { pixel, story, palette, layout, size, view, … })
//   … the city, with K.scene, K.std, K.windowMaterial, K.SITE, K.rand …
//   return K.world({ places, update(t), cctv, ground })
//
// A classic script, so the pages still open from file://.
//
// The engine runs the scenario on its flat map (art pixels, map.H high). Here
// the map is the screen of a fixed camera: each block's dock, high over its
// roof, projects to its spot on the map, and every route, runner and speck the
// engine moves across the map is cast back onto the plane of the docks.

// eslint-disable-next-line no-unused-vars
function City3D(THREE, X, cfg) {
  "use strict";
  const PIXEL = !!cfg.pixel;
  const PAL = cfg.palette;
  const STORY = cfg.story;
  // a value that differs between the two renderings: [pixel, high fidelity]
  const pv = (v) => (Array.isArray(v) ? v[PIXEL ? 0 : 1] : v);
  const C = (name, k = 1) => new THREE.Color(PAL[name] ?? name).multiplyScalar(k);
  const U = { time: { value: 0 }, alarm: { value: 0 } }; // uniforms shared by every material

  // ============================================================
  // Camera, and the map ↔ world mapping
  // ============================================================
  const DOCK = cfg.dock ?? 11; // the altitude of the routes: where the runners fly
  // Z: how far out the view is. Every distance in the layout (the camera's, the
  // blocks' spacing, the plate, the smog) grows with it; the buildings, blocks
  // and cars keep their size, so more of the city fits between them.
  const Z = cfg.Z ?? 1;
  const deg = THREE.MathUtils.degToRad;
  const VIEW = { dist: cfg.view.dist * Z, pitch: deg(cfg.view.pitch), hfov: deg(cfg.view.hfov), target: new THREE.Vector3(0, 0, cfg.view.target * Z) };
  const camera = new THREE.PerspectiveCamera(20, 2.2, cfg.view.near ?? 30, cfg.view.far * Z);
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
  const LAYOUT = cfg.layout;
  const SIZE = cfg.size; // footprint radius, height
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
  renderer.toneMappingExposure = cfg.toneExposure ?? 1.05;
  const scene = new THREE.Scene();
  const SMOG = C(pv(cfg.smog));
  scene.background = SMOG.clone();
  scene.fog = new THREE.Fog(SMOG.clone(), pv(cfg.fog.near) * Z, pv(cfg.fog.far) * Z);
  scene.add(new THREE.HemisphereLight(C(cfg.hemi[0]), C(cfg.hemi[1]), pv(cfg.hemi[2])));
  const moon = new THREE.DirectionalLight(C(cfg.moon[0]), pv(cfg.moon[1]));
  moon.position.set(...cfg.moon[2]);
  scene.add(moon);

  // ============================================================
  // Materials and small helpers
  // ============================================================
  const rand = rng(cfg.seed ?? 1971);
  const pick = (list) => list[Math.floor(rand() * list.length)];
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
  // a canvas the city redraws: its texture, and a call that marks it changed
  function liveTex(w, h) {
    const c = makeCanvas(w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (PIXEL) t.magFilter = t.minFilter = THREE.NearestFilter;
    return { c, g: c.getContext("2d"), t };
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
  const softDot = tex(64, 64, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.3, "rgba(255,255,255,0.5)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, w, w);
  });
  function pointsMaterial(color, size) {
    return new THREE.PointsMaterial({ color, size, sizeAttenuation: !PIXEL, map: PIXEL ? null : softDot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  }

  // Windows, drawn by the shader: floors and bays in world space, each tower lit
  // to its own degree, whole floors dark, a few flickering, shopfronts at the foot.
  // The city picks the three window lights and the three shop lights.
  const WIN = { win: [[1.0, 0.55, 0.22], [0.35, 0.75, 1.0], [1.0, 0.3, 0.65]], cut: [0.55, 0.85], shop: [[1.0, 0.25, 0.6], [0.2, 0.9, 1.0], [1.0, 0.7, 0.35]], shopCut: [0.6, 0.8], gain: 1.5, shopGain: [0.55, 1.0], ...cfg.windows };
  const v3s = (c) => `vec3(${c.map((v) => v.toFixed(3)).join(", ")})`;
  const f = (v) => v.toFixed(3);
  const WINDOWS = (bay, floor) => /* glsl */ `
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
      vec2 cell = floor(vec2(u / ${f(bay)}, v / ${f(floor)}));
      vec2 f = fract(vec2(u / ${f(bay)}, v / ${f(floor)}));
      float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.3, f.y) * step(f.y, 0.82);
      float s = fract(vSeed) * 97.0 + floor(vSeed) * 13.1;
      float lit = step(wh(vec3(cell, s)), fract(fract(vSeed) * 13.37) * 0.5 + 0.06);
      lit *= step(0.28, wh(vec3(1.0, cell.y, s + 3.0)));
      float hue = wh(vec3(floor(cell.x / 5.0), cell.y, s + 9.0));
      vec3 wc = hue < ${f(WIN.cut[0])} ? ${v3s(WIN.win[0])} : hue < ${f(WIN.cut[1])} ? ${v3s(WIN.win[1])} : ${v3s(WIN.win[2])};
      float flick = wh(vec3(cell, s + 1.0)) < 0.008 ? step(0.3, fract(uTime * 0.35 + s * 0.07)) : 1.0;
      if (vWPos.y < 1.2) {
        // shopfronts at street level
        win = step(0.08, fract(u / 3.1)) * step(fract(u / 3.1), 0.92) * step(0.15, vWPos.y) * step(vWPos.y, 1.0);
        float shop = wh(vec3(floor(u / 3.1), 7.0, s));
        lit = step(0.4, shop);
        wc = shop < ${f(WIN.shopCut[0])} ? ${v3s(WIN.shop[0])} : shop < ${f(WIN.shopCut[1])} ? ${v3s(WIN.shop[1])} : ${v3s(WIN.shop[2])};
      }
      base = mix(base, vec3(0.015, 0.02, 0.035), win);
      emit += win * lit * flick * wc * ${f(WIN.gain)} * (vWPos.y < 1.2 ? ${f(pv(WIN.shopGain))} : 1.0);
    }`;
  // scale: the size of a bay and a floor; a colossus can have larger windows
  function windowMaterial(color, rough = 0.75, metal = 0.25, scale = 1) {
    const m = std(color, rough, metal);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = U.time;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float aSeed;\nvarying float vSeed;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;")
        .replace("#include <fog_vertex>", "#include <fog_vertex>\nvSeed = aSeed;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNrm = normalize(mat3(modelMatrix) * objectNormal);");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\n" + WINDOWS(0.8 * scale, 1.15 * scale))
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\nwindows(diffuseColor.rgb, totalEmissiveRadiance);");
    };
    if (scale !== 1) m.customProgramCacheKey = () => `windows-${scale}`;
    return m;
  }
  const TOWER = windowMaterial(cfg.tower?.[0] ?? "#25222f");
  const TOWER_HI = windowMaterial(cfg.tower?.[1] ?? "#302c3c", 0.5, 0.5);

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
  // The runners: cars cut from a side profile (sprite pixels, 28 × 14)
  // ============================================================
  const CAR = {
    shell: [[1, 8], [4, 5], [10, 3.5], [18, 3], [24, 4.5], [27, 6.5], [27, 9], [2, 10]],
    glass: [[11, 4.5], [18, 4], [22, 5.5], [13, 6.2]],
    body: "#1d1a2e", glassCol: "#7fe8ff", glassEmit: "#1a6a8a", size: 1.3,
    ...cfg.car,
  };
  const cars = {};
  function buildCars() {
    const S = 0.16; // units per sprite pixel: a car 4.2 units long
    const shape = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2((x - 14) * S, (7 - y) * S)));
    const bodyGeo = new THREE.ExtrudeGeometry(shape(CAR.shell), { depth: 1.5, bevelEnabled: !PIXEL, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 2 }).translate(0, 0, -0.75);
    const glassGeo = new THREE.ExtrudeGeometry(shape(CAR.glass), { depth: 1.1, bevelEnabled: false }).translate(0, 0.02, -0.55);
    for (const a of STORY.agents) {
      const g = new THREE.Group();
      mesh(bodyGeo, std(CAR.body, 0.28, 0.75), 0, 0, 0, g);
      mesh(glassGeo, std(CAR.glassCol, 0.1, 0.9, { emissive: C(CAR.glassEmit, 0.6) }), 0, 0, 0, g);
      mesh(new THREE.BoxGeometry(3.4, 0.08, 0.1), glow(a.color, PIXEL ? 1.3 : 3), -0.2, -0.05, 0.8, g); // the pinstripe
      const under = mesh(new THREE.PlaneGeometry(3.8, 1.6), haze(a.color, PIXEL ? 1.2 : 2.5, 0.9), -0.2, -0.55, 0, g);
      under.rotation.x = Math.PI / 2;
      under.material.map = softDot;
      mesh(new THREE.BoxGeometry(0.12, 0.2, 1.1), glow("#ffffff", PIXEL ? 1.3 : 4), 2.1, -0.15, 0, g);
      mesh(new THREE.BoxGeometry(0.12, 0.16, 1.2), glow("red", PIXEL ? 1.3 : 3), -2.1, -0.2, 0, g);
      const extra = CAR.extra?.(g, a) ?? null; // the city's own parts; may return update(t, ag)
      g.visible = false;
      g.userData.size = CAR.size; // a little larger than life, so they read from this far out
      scene.add(g);
      cars[a.id] = { g, yaw: 0, last: null, extra };
    }
  }
  const car3 = (ag, out = new THREE.Vector3()) => cast(ag.x, ag.y, DOCK, out).setY(DOCK + 1.2);

  // ============================================================
  // ICE: a black mask with red eyes, climbing out of the Testing Lab
  // ============================================================
  let ice = null;
  const ICE = { dx: -2, dz: -2, ...cfg.ice }; // where it rises, from the lab's centre
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
    // the tendrils: red wires that reach down and grip the lab
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
  const v3 = new THREE.Vector3();
  function updateIce(t) {
    const on = villain.state !== "hidden";
    ice.g.visible = on;
    U.alarm.value = villain.state === "rising" ? Math.min(1, villain.k * 1.5) : villain.state === "sinking" ? villain.k : 0;
    for (const w of ice.wires) w.visible = on && villain.grab > 0.02;
    if (!on) return;
    const s = SITE.tests;
    iceAt.set(s.x + ICE.dx, lerp(-2, 21, villain.k) + Math.sin(t * 1.4) * 0.6, s.z + ICE.dz);
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
    // the wires fall from the chin to points round the lab's crown
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
  let places = {}; // key → { top: Vector3 (where beams point), update(t), steam?: [Vector3] }
  const MAXP = 2600;
  const fx = { pos: new Float32Array(MAXP * 3), col: new Float32Array(MAXP * 3), n: 0, obj: null };
  let beams = null;
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
  // a speck of the city's own: exhaust sparks, steam, glitch, embers
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
  // the pixel palette: the city's own, or every colour in the atlas
  const QPAL = [...new Set((cfg.quantize ?? Object.values(PAL)).filter((v) => /^#[0-9a-f]{6}$/i.test(v)))].slice(0, 128);
  const GRADE = { ca: 0.006, vignette: 0.55, grain: 0.012, glsl: "", ...cfg.grade };
  let composer = null, bloom = null, pixelRT = null, pixelQuad = null;
  function buildPost() {
    if (!PIXEL) {
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
      composer = new X.EffectComposer(renderer, rt);
      composer.addPass(new X.RenderPass(scene, camera));
      bloom = new X.UnrealBloomPass(new THREE.Vector2(256, 256), ...(cfg.bloom?.[1] ?? [0.55, 0.45, 0.9]));
      composer.addPass(bloom);
      composer.addPass(new X.ShaderPass({
        uniforms: { tDiffuse: { value: null }, uTime: U.time },
        vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: /* glsl */ `
          uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
          void main() {
            vec2 d = vUv - 0.5;
            float ca = dot(d, d) * ${f(GRADE.ca)};
            vec3 c = vec3(texture2D(tDiffuse, vUv + d * ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d * ca).b);
            ${GRADE.glsl}
            c *= mix(1.0, ${f(GRADE.vignette)}, smoothstep(0.35, 0.85, length(d * vec2(1.1, 1.3))));
            c += (fract(sin(dot(vUv * 913.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * ${f(GRADE.grain)};
            gl_FragColor = vec4(c, 1.0);
          }`,
      }));
      composer.addPass(new X.OutputPass());
      return;
    }
    const palVec = QPAL.map((h) => new THREE.Vector3(...hexRGB(h).map((v) => v / 255)));
    while (palVec.length < 128) palVec.push(palVec[0]);
    pixelRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(4, 4) });
    bloom = new X.UnrealBloomPass(new THREE.Vector2(128, 64), ...(cfg.bloom?.[0] ?? [0.18, 0.05, 0.95]));
    pixelQuad = new X.FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tColor: { value: pixelRT.texture }, tDepth: { value: pixelRT.depthTexture }, res: { value: new THREE.Vector2(4, 4) }, cn: { value: camera.near }, cf: { value: camera.far }, pal: { value: palVec }, npal: { value: QPAL.length } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: /* glsl */ `
        uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 res; uniform float cn, cf; uniform vec3 pal[128]; uniform int npal;
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
          vec3 s = srgb(aces(c * ${f(cfg.exposure ?? 1.4)}));
          float best = 1e9;
          vec3 q = s;
          for (int i = 0; i < 128; i++) {
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
  const reflectors = []; // mirrors whose targets follow the canvas
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
      for (const r of reflectors) r.getRenderTarget().setSize(map.W, map.H);
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
    for (const r of reflectors) r.getRenderTarget().setSize(Math.round(w / 2), Math.round(h / 2));
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
  const PAL_RGB = QPAL.map(hexRGB);
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
  // The world, as the engine sees it. The city hands in:
  //   places   key → { top, update(t), steam? }
  //   update   (t) → its own life, each frame
  //   cctv     { position, lookAt } for the corner's camera
  // ============================================================
  function world(city) {
    places = city.places;
    buildCars();
    buildIce();
    buildPoints();
    buildPost();
    const cctv = new THREE.PerspectiveCamera(58, 180 / 236, 0.5, 900);
    cctv.position.copy(city.cctv.position);
    cctv.lookAt(city.cctv.lookAt);
    cctv.updateMatrixWorld();
    const HUD = { cam: "CAM 07 · REC", sector: "SECTOR 7", band: "rgba(4,2,10,0.6)", ink: "rgba(234,232,255,0.85)", ...cfg.hud };
    const CHROME = cfg.chrome;
    const corner = { img: null, t: -9 };
    return {
      atlas: cfg.atlas,
      atlasFile: cfg.atlasFile,
      stations: STORY.place(LAYOUT),
      mapH: pv(cfg.mapH ?? [undefined, undefined]),
      agentLift: 0,
      beadDim: cfg.beadDim ?? "#1a1430",
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
        city.update(t);
        updateIce(t);
        for (const a of STORY.agents) {
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
          car.extra?.(t, ag);
        }
        for (const k in places) for (const sp of places[k].steam ?? []) if (Math.random() < 0.3) spawn("steam", sp, Q3.set((Math.random() - 0.5) * 0.6, 2 + Math.random(), (Math.random() - 0.5) * 0.6), cfg.steam ?? "#8a86a8", 3);
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
          const img = still(cctv, w, h, cfg.cctvExposure ?? 1.8);
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
        g.fillStyle = HUD.band;
        g.fillRect(0, 0, c.width, 38 * s);
        g.fillStyle = "rgba(0,0,0,0.22)";
        for (let y = 0; y < c.height; y += 3 * s) g.fillRect(0, y, c.width, s);
        g.font = PIXEL ? `${Math.round(7 * s)}px 'Share Tech Mono', monospace` : `500 ${Math.round(8 * s)}px 'JetBrains Mono', monospace`;
        // the timecode, centred where the panel's crop keeps it in view
        const cx = c.width * 0.45;
        g.textAlign = "center";
        g.fillStyle = HUD.ink;
        g.fillText(HUD.cam, cx + 5 * s, 20 * s);
        g.fillText(`${HUD.sector} · ${fmtClock(t)}`, cx, 32 * s);
        if (Math.floor(now * 1.5) % 2) {
          g.fillStyle = PAL.red;
          g.beginPath();
          g.arc(cx - g.measureText(HUD.cam).width / 2 - 2 * s, 17 * s, 3 * s, 0, Math.PI * 2);
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
        useHifiIcons({ ink: CHROME.ink, accent: CHROME.accent });
        const bm = $("#brand-mark"), mi = $("#meter-icon");
        drawHifiIcon(bm.getContext("2d"), "icon.observe", bm.width, bm.height, { ink: CHROME.brand, accent: CHROME.accent, weight: 1.8 });
        drawHifiIcon(mi.getContext("2d"), "icon.city", mi.width, mi.height, { ink: CHROME.accent, accent: CHROME.brand, weight: 1.8 });
        // the runners' rows: a car's profile in its colour
        for (const a of STORY.agents) {
          const c = makeCanvas(80, 40), g = c.getContext("2d");
          g.scale(80 / 28, 40 / 14);
          g.fillStyle = CHROME.carBody ?? "#2a2640";
          g.beginPath();
          CAR.shell.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
          g.fill();
          g.fillStyle = CAR.glassCol;
          g.beginPath();
          CAR.glass.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
          g.fill();
          g.fillStyle = PAL[a.color];
          g.shadowColor = PAL[a.color];
          g.shadowBlur = 3;
          g.fillRect(4, 10.4, 20, 1);
          g.fillRect(5, 6.8, 18, 0.6);
          CAR.chrome?.(g, a);
          FR.set(`hifi.car.${a.id}`, { c, flip: null });
        }
      },
    };
  }

  return {
    PIXEL, PAL, U, Z, DOCK, C, pv, rand, pick,
    scene, camera, renderer, SMOG, SITE, LAYOUT, nearSite, cast, castNdc, toMap, aim,
    glow, haze, lineGlow, std, M, tex, liveTex, litSeed, seeded, mesh, softDot, pointsMaterial,
    windowMaterial, TOWER, TOWER_HI, glyphTex, spawn, reflectors, world,
  };
}
