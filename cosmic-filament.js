/* eslint-disable */
// cosmic-filament.js
//
// CosmicFilament — WebGL1 multi-pass renderer that draws a "cosmic web"
// of star clusters connected by glowing filaments, layered over a caustic
// atmosphere whose pattern is driven by the constellation's luminance.
//
// Public API:
//   const fx = new CosmicFilament(canvas, { palette: 2 });
//   fx.setData(clusters);
//   fx.enableInteraction();
//   fx.resetCamera();
//   fx.start();
//   // later: fx.stop(); fx.destroy();
//
// Cluster data shape:
//   [
//     {
//       id: 'project-a',
//       color: [r, g, b],                    // 0..1
//       stars: [{ x, y, id?, size? }, ...],  // world coords
//       edges?: [[i, j], ...]                // optional; auto k-NN otherwise
//     },
//     ...
//   ]

// ============================================================
// SHADERS
// ============================================================

const VERT_FULLSCREEN = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// --- Background: uBaseColor with a subtle radial brightening so the
//     empty void isn't a perfectly flat colour. Camera-independent. ---
const FRAG_BG = `
precision highp float;
varying vec2 vUv;
uniform vec3 uBaseColor;
void main() {
  vec2 d = vUv - 0.5;
  float wash = exp(-length(d) * 1.4);    // 0..1, brightest at centre
  // 0.9× at corners, 1.4× at centre — preserves user's chosen hue.
  gl_FragColor = vec4(uBaseColor * (0.9 + 0.5 * wash), 1.0);
}
`;

// --- Star quad. world → screen via uCamera = (x, y, zoom). Wobble in VS. ---
const VERT_STAR = `
attribute vec2  aQuadCoord;
attribute vec2  aStarPos;
attribute float aStarSeed;
attribute vec3  aColor;

uniform vec2  uResolution;
uniform vec3  uCamera;          // x, y, zoom
uniform float uHaloRadius;      // world units
uniform float uTime;
uniform float uWobbleAmp;       // world units of wobble

varying vec2  vLocalP;
varying float vSeed;
varying vec3  vColor;

void main() {
  // Phase + frequency vary per star → not synchronized.
  float wf  = 0.30 + 0.35 * fract(aStarSeed * 7.31);
  float wph = aStarSeed * 6.2831;
  vec2 wobble = vec2(sin(uTime * wf       + wph),
                     cos(uTime * wf * 0.9 + wph * 1.3)) * uWobbleAmp;

  vec2 worldP    = aStarPos + wobble;
  vec2 quadWorld = worldP + aQuadCoord * uHaloRadius;
  vec2 screen    = (quadWorld - uCamera.xy) * uCamera.z;

  float aspect = uResolution.x / uResolution.y;
  gl_Position = vec4(screen.x / aspect, screen.y, 0.0, 1.0);

  vLocalP = aQuadCoord * uHaloRadius;
  vSeed   = aStarSeed;
  vColor  = aColor;
}
`;

const FRAG_STAR = `
precision highp float;
varying vec2  vLocalP;
varying float vSeed;
varying vec3  vColor;
uniform float uStarBright;
uniform float uHaloFalloff;      // multiplier on exp coefficient (1.0 normal,
                                 // <1 = wider/softer halo, used by colour field)
uniform int   uForceWhite;       // 1 in heightmap pass to keep luminance even
uniform int   uHaloOnly;         // 1 in colour field pass to skip core/flare

float crossFlare(vec2 d, float thickness) {
  float h = exp(-d.y * d.y * thickness) * exp(-abs(d.x) * 0.6);
  float v = exp(-d.x * d.x * thickness) * exp(-abs(d.y) * 0.6);
  return h + v;
}

void main() {
  float r    = length(vLocalP);
  float seed = vSeed;
  float k    = 0.4 + 0.6 * seed;
  float ff   = max(uHaloFalloff, 0.05);
  float core = exp(-r * 60.0 * ff) * k * 1.3;
  // Normal halo amplitude 0.08; colour-field pass needs more so the
  // smeared field has signal — boost when uHaloOnly = 1.
  float haloAmp = (uHaloOnly == 1) ? 0.50 : 0.08;
  float halo = exp(-r * 6.0 * ff) * haloAmp * k;
  float flare = 0.0;
  if (uHaloOnly != 1 && seed > 0.55) {
    flare = crossFlare(vLocalP * 9.0, 18.0) * (seed - 0.4) * 0.6;
  }
  if (uHaloOnly == 1) { core = 0.0; }
  vec3 base = (uForceWhite == 1) ? vec3(1.0) : vColor;
  // Less white-mixing in the core → stars read as the cluster's colour.
  // Pure white reserved for the brightest highlight pixels via tonemap.
  vec3 hot  = mix(base, vec3(1.0), 0.30);
  vec3 col  = base * halo * uStarBright + hot * (core + flare) * uStarBright;
  gl_FragColor = vec4(col, 1.0);
}
`;

// --- Edge quad. Both endpoints wobble (using their per-star seeds), so
//     edges follow their stars. uHalfWidth/uEndExtend in world units. ---
const VERT_EDGE = `
attribute vec2  aQuadCoord;     // .x along [0,1], .y perp [-1,1]
attribute vec2  aEdgeA;
attribute vec2  aEdgeB;
attribute float aSeedA;
attribute float aSeedB;
attribute vec3  aColor;

uniform vec2  uResolution;
uniform vec3  uCamera;
uniform float uHalfWidth;
uniform float uEndExtend;
uniform float uTime;
uniform float uWobbleAmp;

varying vec2  vSegA;
varying vec2  vSegB;
varying vec2  vPixelP;
varying float vLab;
varying vec3  vColor;

vec2 wobbleFor(float seed) {
  float wf  = 0.30 + 0.35 * fract(seed * 7.31);
  float wph = seed * 6.2831;
  return vec2(sin(uTime * wf       + wph),
              cos(uTime * wf * 0.9 + wph * 1.3));
}

void main() {
  vec2 a = aEdgeA + wobbleFor(aSeedA) * uWobbleAmp;
  vec2 b = aEdgeB + wobbleFor(aSeedB) * uWobbleAmp;

  float lab = length(b - a);
  vec2 segDir  = (b - a) / max(lab, 1e-6);
  vec2 segPerp = vec2(-segDir.y, segDir.x);
  vec2 along   = mix(a - segDir * uEndExtend,
                     b + segDir * uEndExtend,
                     aQuadCoord.x);
  vec2 quadWorld = along + segPerp * aQuadCoord.y * uHalfWidth;
  vec2 screen    = (quadWorld - uCamera.xy) * uCamera.z;

  float aspect = uResolution.x / uResolution.y;
  gl_Position = vec4(screen.x / aspect, screen.y, 0.0, 1.0);

  vSegA   = a;
  vSegB   = b;
  vPixelP = quadWorld;
  vLab    = lab;
  vColor  = aColor;
}
`;

const FRAG_EDGE = `
precision highp float;
varying vec2  vSegA;
varying vec2  vSegB;
varying vec2  vPixelP;
varying float vLab;
varying vec3  vColor;
uniform float uLineThick;
uniform int   uForceWhite;

float distSeg(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  return length(p - (a + ab * h));
}

void main() {
  float dseg = distSeg(vPixelP, vSegA, vSegB);
  float e    = exp(-dseg * uLineThick);
  vec3 base = (uForceWhite == 1) ? vec3(1.0) : vColor;
  gl_FragColor = vec4(base * e * 0.9, 1.0);
}
`;

// --- Orb (flying particle): tiny bright sprite with cluster colour. ---
const VERT_ORB = `
attribute vec2 aQuadCoord;
attribute vec2 aOrbPos;
attribute vec3 aColor;
uniform vec2  uResolution;
uniform vec3  uCamera;
uniform float uOrbRadius;
varying vec2  vQuadCoord;
varying vec3  vColor;
void main() {
  vec2 quadWorld = aOrbPos + aQuadCoord * uOrbRadius;
  vec2 screen    = (quadWorld - uCamera.xy) * uCamera.z;
  float aspect = uResolution.x / uResolution.y;
  gl_Position = vec4(screen.x / aspect, screen.y, 0.0, 1.0);
  vQuadCoord = aQuadCoord;
  vColor = aColor;
}
`;
const FRAG_ORB = `
precision highp float;
varying vec2 vQuadCoord;
varying vec3 vColor;
uniform float uOrbBright;
void main() {
  float r = length(vQuadCoord);
  // Tight white-hot core + softer cluster-tinted halo.
  float core = exp(-r * r * 18.0);
  float halo = exp(-r * 2.4) * 0.55;
  // White-hot core, cluster-tinted halo — comet head look.
  vec3 hot = mix(vColor, vec3(1.0), 0.85);
  vec3 col = vColor * halo + hot * core * 2.2;
  gl_FragColor = vec4(col * uOrbBright, 1.0);
}
`;

// --- Trail: time-spaced dot sprites. Each trail sample is a small quad
//     that shrinks and fades toward the tail. Sampled at fixed time
//     intervals (not per-frame), so dots stay evenly spaced regardless of
//     framerate — gives the dashed/comet look. ---
const VERT_TRAIL = `
attribute vec2  aQuadCoord;
attribute vec2  aPos;
attribute float aAge;
attribute vec3  aColor;
uniform vec2  uResolution;
uniform vec3  uCamera;
uniform float uDotRadius;
varying vec2  vQuadCoord;
varying float vAge;
varying vec3  vColor;
void main() {
  // Shrink toward the tail (head dots are big, last dots are tiny).
  float r = uDotRadius * (0.25 + 0.75 * (1.0 - aAge));
  vec2 quadWorld = aPos + aQuadCoord * r;
  vec2 screen    = (quadWorld - uCamera.xy) * uCamera.z;
  float aspect = uResolution.x / uResolution.y;
  gl_Position = vec4(screen.x / aspect, screen.y, 0.0, 1.0);
  vQuadCoord = aQuadCoord;
  vAge = aAge;
  vColor = aColor;
}
`;
const FRAG_TRAIL = `
precision highp float;
varying vec2  vQuadCoord;
varying float vAge;
varying vec3  vColor;
uniform float uTrailBright;
void main() {
  float r = length(vQuadCoord);
  // Soft round dot.
  float dot = exp(-r * r * 8.0);
  // White-hot core for the leading dots, cluster colour as they age.
  vec3 hot   = mix(vColor, vec3(1.0), 0.55);
  vec3 tinted = mix(vColor, hot, max(1.0 - vAge * 2.0, 0.0));
  // Steep alpha falloff so the tail visibly dies.
  float alpha = pow(max(1.0 - vAge, 0.0), 1.6);
  gl_FragColor = vec4(tinted * dot * alpha * uTrailBright, 1.0);
}
`;

// --- Final tonemap + screen-space vignette + gamma ---
const FRAG_TONEMAP = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSrc;
void main() {
  vec3 col = texture2D(uSrc, vUv).rgb;
  float vig = smoothstep(1.25, 0.35, length(vUv - 0.5));
  col *= 0.55 + 0.5 * vig;
  col = col / (1.0 + col * 0.8);
  col = pow(col, vec3(0.92));
  gl_FragColor = vec4(col, 1.0);
}
`;

// --- Heightmap dilate (max-filter with soft falloff) ---
const FRAG_DILATE = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSrc;
uniform vec2  uResolution;
uniform float uHeightWidth;
uniform float uHeightSoftness;

float lumOf(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec3 center = texture2D(uSrc, vUv).rgb;
  if (uHeightWidth <= 0.001) { gl_FragColor = vec4(center, 1.0); return; }
  float maxL = lumOf(center);
  vec2 pxScale = vec2(1.0) / uResolution * uHeightWidth * 120.0;
  const int RINGS = 4;
  const int SECTORS = 8;
  for (int r = 1; r <= RINGS; r++) {
    float dist = float(r) / float(RINGS);
    float falloff = pow(max(1.0 - dist, 0.0),
                        1.0 / max(uHeightSoftness, 0.1));
    for (int s = 0; s < SECTORS; s++) {
      float ang = 6.2831 * float(s) / float(SECTORS);
      vec2 d = vec2(cos(ang), sin(ang)) * dist * pxScale;
      vec3 sm = texture2D(uSrc, vUv + d).rgb;
      maxL = max(maxL, lumOf(sm) * falloff);
    }
  }
  gl_FragColor = vec4(vec3(maxL), 1.0);
}
`;

// --- Heightmap blur (Gaussian-ish) ---
const FRAG_BLUR = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSrc;
uniform vec2  uResolution;
uniform float uBleed;
void main() {
  if (uBleed <= 0.001) { gl_FragColor = texture2D(uSrc, vUv); return; }
  vec2 px = vec2(1.0) / uResolution * uBleed * 60.0;
  vec4 c  = texture2D(uSrc, vUv) * 0.227027;
  c += texture2D(uSrc, vUv + vec2( px.x, 0.0))     * 0.1945946;
  c += texture2D(uSrc, vUv + vec2(-px.x, 0.0))     * 0.1945946;
  c += texture2D(uSrc, vUv + vec2( 0.0, px.y))     * 0.1945946;
  c += texture2D(uSrc, vUv + vec2( 0.0,-px.y))     * 0.1945946;
  c += texture2D(uSrc, vUv + vec2( 2.0*px.x, 0.0)) * 0.1216216;
  c += texture2D(uSrc, vUv + vec2(-2.0*px.x, 0.0)) * 0.1216216;
  c += texture2D(uSrc, vUv + vec2( 0.0, 2.0*px.y)) * 0.1216216;
  c += texture2D(uSrc, vUv + vec2( 0.0,-2.0*px.y)) * 0.1216216;
  c += texture2D(uSrc, vUv + vec2( 3.5*px.x, 0.0)) * 0.054054;
  c += texture2D(uSrc, vUv + vec2(-3.5*px.x, 0.0)) * 0.054054;
  c += texture2D(uSrc, vUv + vec2( 0.0, 3.5*px.y)) * 0.054054;
  c += texture2D(uSrc, vUv + vec2( 0.0,-3.5*px.y)) * 0.054054;
  gl_FragColor = c / 1.708;
}
`;

// --- Caustic: Voronoi cells + warp + cluster lift, camera-aware.
//     Cell color is sampled from uColorField (a heavily-blurred copy of
//     the constellation), so cluster colors bleed through into the
//     caustic underneath. Empty regions fall back to uBaseColor. ---
const FRAG_CAUSTIC = `
precision highp float;
varying vec2 vUv;
uniform vec2  uResolution;
uniform vec3  uCamera;
uniform float uScale;
uniform float uBase;
uniform float uHot;
uniform float uSat;
uniform float uExposure;
uniform float uCurveStr;
uniform float uCurveThick;
uniform float uMacroHill;
uniform float uMacroFloor;
uniform float uWarp;
uniform float uBeamLift;
uniform float uCurveFade;
uniform float uCurveFadeRange;
uniform float uSparkle;

uniform sampler2D uHeightmap;
uniform sampler2D uColorField;     // heavily-blurred constellation FBO
uniform vec3  uBaseColor;          // fallback for cluster-empty regions
uniform float uColorFieldGain;     // scales field saturation (0..3)
uniform float uHeightGain;
uniform float uHeightSharp;
uniform float uHeightFloor;

vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)),
           dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
float hash12(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
vec4 voronoi(vec2 x, float jitter, float t) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  vec2 mg = vec2(0.0), mr = vec2(0.0), mid = vec2(0.0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(n + g);
      o = 0.5 + jitter * (sin(t + 6.2831 * o) * 0.5);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = g; mid = n + g + o; }
    }
  }
  float ed = 8.0, ed2 = 8.0;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 g = mg + vec2(float(i), float(j));
      vec2 o = hash22(n + g);
      o = 0.5 + jitter * (sin(t + 6.2831 * o) * 0.5);
      vec2 r = g + o - f;
      if (dot(mr - r, mr - r) > 0.00001) {
        float d = dot(0.5 * (mr + r), normalize(r - mr));
        if (d < ed)       { ed2 = ed; ed = d; }
        else if (d < ed2) { ed2 = d; }
      }
    }
  }
  return vec4(ed, mid, ed2);
}

// Look up cell color from the dedicated colour-field pass (wide soft
// star halos, low brightness, additive). Normalize by MAX channel rather
// than luminance so hue is preserved even when some channels saturate.
// Strength = max channel → blends from uBaseColor toward cluster hue.
vec3 sampleClusterColor(vec2 cellUv, vec2 cellId) {
  vec2 jitter = (hash22(cellId * 7.31) - 0.5) * 0.018;
  vec3 fieldColor = texture2D(uColorField, clamp(cellUv + jitter, 0.0, 1.0)).rgb;
  float maxC = max(fieldColor.r, max(fieldColor.g, fieldColor.b));
  vec3 hue = (maxC > 0.001) ? fieldColor / maxC : vec3(0.0);
  float strength = clamp(maxC * uColorFieldGain, 0.0, 1.0);
  float blend = smoothstep(0.03, 0.30, strength);
  return mix(uBaseColor, hue, blend);
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / uResolution.y;

  // Pixel → world via camera, then world → cell space via uScale.
  vec2 worldP = vec2((uv.x - 0.5) * aspect, uv.y - 0.5) / uCamera.z + uCamera.xy;
  vec2 p      = worldP * uScale;
  float t = 0.0;

  vec2 q = vec2(sin(p.y * 0.8 + 1.3),  cos(p.x * 0.9 + 0.7));
  vec2 r = vec2(sin(p.x * 1.3 + 2.0 * q.x + 0.5),
                cos(p.y * 1.6 + 2.0 * q.y + 1.2));
  vec2 warp = (q * 0.40 + r * 1.00) * uWarp;
  vec4 v = voronoi(p + warp, 0.55, t);
  float edge   = v.x;
  vec2  cellId = v.yz;
  float edge2  = v.w;

  float r1 = hash12(cellId * 7.31);
  float r2 = hash12(cellId * 7.31 + 19.0);
  float r3 = hash12(cellId * 7.31 + 47.0);
  float r4 = hash12(cellId * 7.31 + 73.0);

  float cellBright = 0.30 + 0.95 * r1;
  float interior   = cellBright * 0.95;

  // ===== Heightmap sampling at the same uv =====
  vec3  hmRGB     = texture2D(uHeightmap, uv).rgb;
  float heightLum = dot(hmRGB, vec3(0.299, 0.587, 0.114));
  float h         = uHeightFloor + uHeightGain * pow(max(heightLum, 0.0), uHeightSharp);
  float dCurve    = clamp(1.0 - heightLum, 0.0, 1.0);

  // Per-cell heightmap sample — convert cell world position back to uv.
  vec2 cellWorldP = cellId / uScale;
  vec2 cellUv     = clamp((cellWorldP - uCamera.xy) * uCamera.z
                          * vec2(1.0 / aspect, 1.0) + 0.5, 0.0, 1.0);
  vec3  hmCell    = texture2D(uHeightmap, cellUv).rgb;
  float cellLum   = dot(hmCell, vec3(0.299, 0.587, 0.114));

  vec3 cellColor = sampleClusterColor(cellUv, cellId);
  // Per-cell saturation wobble — some cells more vivid, others muted.
  float cellSat = 0.65 + 0.65 * r4;
  float ccLum   = dot(cellColor, vec3(0.299, 0.587, 0.114));
  cellColor     = mix(vec3(ccLum), cellColor, cellSat);

  float hPositive   = max(h, 0.0);
  float macroBright = max(uMacroFloor, 0.55 + uMacroHill * hPositive);

  float curveGain  = uCurveStr;
  float curveSharp = uCurveThick / 31.5;

  vec3 col = cellColor * macroBright * (uBase + 0.55 * interior);

  float cellHot   = pow(r1, 3.0);
  float cellLight = clamp(cellBright * macroBright * 0.55 - 0.15, 0.0, 1.0);
  float fieldHot  = 0.5 + 0.5 * sin(p.x * 1.10 + 0.7) * cos(p.y * 1.55 - 0.3);
  fieldHot        = pow(fieldHot, 2.5);
  float hotness   = max(cellLight, fieldHot);
  float gateSpace = smoothstep(0.6, 1.4, macroBright);
  float cellPunch = mix(0.30, 2.40, cellHot);
  float baseGlow  = exp(-edge * 70.0) * (0.15 + cellHot * 0.55);
  float bleedExp  = mix(50.0, 4.0, hotness);
  float bleedAmp  = 0.15 + hotness * 1.80;
  float bleed     = exp(-edge * bleedExp) * bleedAmp * cellPunch;
  float hotspot   = (baseGlow + bleed) * gateSpace;
  // Hot blowout tinted by cluster colour (was hardcoded warm-white). 20%
  // white-mix keeps "hot" feel; tonemap handles channel-clipping toward
  // white at the brightest spots.
  vec3  hotTint   = mix(cellColor, vec3(1.0), 0.20) * 1.6;
  col += hotspot * hotTint * uHot;

  vec3 hazeColor = mix(cellColor, vec3(1.0, 0.75, 0.85), 0.40);
  col += hazeColor * h * 0.18;

  float beamLift = exp(-dCurve * 4.5  * curveSharp) * 0.80 * curveGain;
  col *= 1.0 + beamLift * uBeamLift;
  float beamHint = exp(-dCurve * 35.0 * curveSharp) * 0.80 * curveGain;
  col += vec3(1.00, 0.62, 0.80) * beamHint * 0.20;

  // Sparkles at cell corners
  float hilite     = max(0.0, (macroBright - 0.55) * 2.8) + hotspot * 4.50;
  float h01        = clamp(hilite, 0.0, 1.0);
  float armNarrow  = mix(70.0, 18.0, h01);
  float armWide    = mix( 5.0,  1.6, h01);
  float sparkH     = exp(-edge2 * armNarrow) * exp(-edge  * armWide);
  float sparkV     = exp(-edge  * armNarrow) * exp(-edge2 * armWide);
  float haloFall   = mix(20.0, 5.0, h01);
  float haloAmp    = mix(0.30, 1.80, h01);
  float sparkHalo  = exp(-(edge + edge2) * haloFall) * haloAmp;
  float sparkShape = sparkH + sparkV + sparkHalo;
  float sparkSeed  = hash12(cellId * 11.7 + 31.0);
  float cornerEdge = mix(0.035, 0.10, h01);
  float cornerMask = smoothstep(cornerEdge, 0.0, max(edge, edge2));
  float sparkGate  = step(0.40, sparkSeed) * cornerMask;
  float sparkLit   = (exp(-dCurve * 2.5 * curveSharp) + 0.18) * (1.0 + hilite * 3.0);
  // Sparkle tinted by cluster colour (was hardcoded warm-white). Higher
  // multiplier keeps sparkles luminous in cool clusters too — without it
  // a deep-blue cluster's sparkles read flat.
  vec3 sparkCol = mix(cellColor, vec3(1.0), 0.30) * 1.7;
  col += sparkCol * sparkShape * sparkGate * sparkLit * uSparkle;

  // Per-cell curve fade — pow on cellLum, range = exponent.
  float fadeStr   = clamp(uCurveFadeRange * (1.0 / 30.0), 0.0, 1.0);
  float fadePwr   = mix(0.3, 3.0, fadeStr);
  float curveProx = pow(clamp(cellLum, 0.0, 1.0), fadePwr);
  float cellDim   = 0.45 + 0.55 * r3;
  curveProx      *= cellDim;
  col *= mix(1.0, curveProx, uCurveFade);

  vec2 np = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float vig = smoothstep(1.30, 0.40, length(np));
  col *= 0.85 + 0.20 * vig;

  col = vec3(1.0) - exp(-col * uExposure);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, uSat);
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  gl_FragColor = vec4(col, 1.0);
}
`;

// --- Composite: caustic + visible top, three blend modes, optional blur ---
const FRAG_COMPOSITE = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uCaustic;
uniform sampler2D uTop;
uniform vec2  uResolution;
uniform float uOverlayMix;
uniform float uBlur;
uniform int   uBlendMode;

vec4 sampleBlurred(sampler2D tex, vec2 uv) {
  if (uBlur <= 0.001) return texture2D(tex, uv);
  vec2 px = vec2(1.0) / uResolution * uBlur * 30.0;
  vec4 c  = texture2D(tex, uv) * 0.227027;
  c += texture2D(tex, uv + vec2( px.x, 0.0))     * 0.1945946;
  c += texture2D(tex, uv + vec2(-px.x, 0.0))     * 0.1945946;
  c += texture2D(tex, uv + vec2( 0.0, px.y))     * 0.1945946;
  c += texture2D(tex, uv + vec2( 0.0,-px.y))     * 0.1945946;
  c += texture2D(tex, uv + vec2( 2.0*px.x, 0.0)) * 0.1216216;
  c += texture2D(tex, uv + vec2(-2.0*px.x, 0.0)) * 0.1216216;
  c += texture2D(tex, uv + vec2( 0.0, 2.0*px.y)) * 0.1216216;
  c += texture2D(tex, uv + vec2( 0.0,-2.0*px.y)) * 0.1216216;
  c += texture2D(tex, uv + vec2( 3.5*px.x, 0.0)) * 0.054054;
  c += texture2D(tex, uv + vec2(-3.5*px.x, 0.0)) * 0.054054;
  c += texture2D(tex, uv + vec2( 0.0, 3.5*px.y)) * 0.054054;
  c += texture2D(tex, uv + vec2( 0.0,-3.5*px.y)) * 0.054054;
  return c / 1.708;
}

void main() {
  vec3 a = sampleBlurred(uCaustic, vUv).rgb;
  vec3 b = texture2D(uTop, vUv).rgb;
  vec3 bm = b * uOverlayMix;
  vec3 final;
  if (uBlendMode == 0) final = a + bm;
  else if (uBlendMode == 1) final = vec3(1.0) - (vec3(1.0) - a) * (vec3(1.0) - clamp(bm, 0.0, 1.0));
  else final = mix(a, a + b, uOverlayMix);
  gl_FragColor = vec4(final, 1.0);
}
`;

// ============================================================
// GL HELPERS
// ============================================================

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("Shader compile error: " + log);
  }
  return sh;
}
function linkWith(gl, vs, fs, attribLocs) {
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  for (const name in attribLocs) gl.bindAttribLocation(p, attribLocs[name], name);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error("Link error: " + gl.getProgramInfoLog(p));
  }
  return p;
}
function getLocs(gl, prog, names) {
  const out = {};
  for (const n of names) out[n] = gl.getUniformLocation(prog, n);
  return out;
}

// ============================================================
// DEFAULTS
// ============================================================

export const DEFAULT_UNIFORMS = {
  caustic: {
    uScale: 23.2, uBase: 0.12,
    uHot: 2.46, uSat: 1.60, uExposure: 0.39,
    uCurveStr: 1.35, uCurveThick: 55.5,
    uMacroHill: 1.00, uMacroFloor: 0.20,
    uWarp: 0.30,     uBeamLift: 1.08,
    uCurveFade: 0.99, uCurveFadeRange: 14.60,
    uSparkle: 6.00,
    uColorFieldGain: 1.25,
    uHeightGain: 0.75, uHeightSharp: 0.80, uHeightFloor: 0.10,
    uHeightWidth: 0.49, uHeightSoftness: 0.93, uHeightBleed: 0.03,
  },
  constellation: {
    uLineThick: 215, uStarBright: 0.85, uHaloRadius: 0.35, uWobbleAmp: 0.082,
  },
  composite: { uOverlayMix: 1.00, uBlur: 0.00, uBlendMode: 2 /* mix */ },
  baseColor: [0.0, 0.0, 0.0],
  colorFieldBleed: 4.52,
  orbs: {
    count: 8,
    speed: 0.55,                // slower flight = trail spans more space
    radius: 0.060,              // world units, sprite quad size
    bright: 1.80,               // shader brightness multiplier on orb
    trailWidth: 0.040,          // world units, dot radius at the head
    trailLifetime: 1.40,        // seconds — long, sweeping trails
    trailBright: 1.60,
    interClusterChance: 0.7,    // fraction of flights that cross clusters
  },
};

// ============================================================
// CosmicFilament
// ============================================================

export class CosmicFilament {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl", {
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL not available");
    this.gl = gl;

    this.dprMax       = opts.dpr        ?? 1;
    this.heightScale  = opts.heightScale ?? 0.5;

    // Uniforms (deep-copy of defaults, overridden by opts.uniforms)
    const cloneDefaults = JSON.parse(JSON.stringify(DEFAULT_UNIFORMS));
    this.values = cloneDefaults;
    if (opts.uniforms) {
      for (const k of Object.keys(opts.uniforms)) {
        if (Array.isArray(this.values[k])) this.values[k] = opts.uniforms[k];
        else if (typeof this.values[k] === "object") Object.assign(this.values[k], opts.uniforms[k]);
        else this.values[k] = opts.uniforms[k];
      }
    }
    if (opts.baseColor)       this.values.baseColor = opts.baseColor;
    if (opts.colorFieldBleed !== undefined) this.values.colorFieldBleed = opts.colorFieldBleed;

    this.camera = { x: 0, y: 0, zoom: 0.5 };

    // Compile programs.
    const vsFs    = compile(gl, gl.VERTEX_SHADER,   VERT_FULLSCREEN);
    const vsStar  = compile(gl, gl.VERTEX_SHADER,   VERT_STAR);
    const vsEdge  = compile(gl, gl.VERTEX_SHADER,   VERT_EDGE);
    const vsOrb   = compile(gl, gl.VERTEX_SHADER,   VERT_ORB);
    const vsTrail = compile(gl, gl.VERTEX_SHADER,   VERT_TRAIL);

    this.progBg       = linkWith(gl, vsFs,   compile(gl, gl.FRAGMENT_SHADER, FRAG_BG),       { aPosition: 0 });
    this.progStar     = linkWith(gl, vsStar, compile(gl, gl.FRAGMENT_SHADER, FRAG_STAR),     { aQuadCoord: 0, aStarPos: 1, aStarSeed: 2, aColor: 3 });
    this.progEdge     = linkWith(gl, vsEdge, compile(gl, gl.FRAGMENT_SHADER, FRAG_EDGE),     { aQuadCoord: 0, aEdgeA: 1, aEdgeB: 2, aSeedA: 3, aSeedB: 4, aColor: 5 });
    this.progOrb      = linkWith(gl, vsOrb,  compile(gl, gl.FRAGMENT_SHADER, FRAG_ORB),      { aQuadCoord: 0, aOrbPos: 1, aColor: 2 });
    this.progTrail    = linkWith(gl, vsTrail,compile(gl, gl.FRAGMENT_SHADER, FRAG_TRAIL),    { aQuadCoord: 0, aPos: 1, aAge: 2, aColor: 3 });
    this.progTonemap  = linkWith(gl, vsFs,   compile(gl, gl.FRAGMENT_SHADER, FRAG_TONEMAP),  { aPosition: 0 });
    this.progDilate   = linkWith(gl, vsFs,   compile(gl, gl.FRAGMENT_SHADER, FRAG_DILATE),   { aPosition: 0 });
    this.progBlur     = linkWith(gl, vsFs,   compile(gl, gl.FRAGMENT_SHADER, FRAG_BLUR),     { aPosition: 0 });
    this.progCaustic  = linkWith(gl, vsFs,   compile(gl, gl.FRAGMENT_SHADER, FRAG_CAUSTIC),  { aPosition: 0 });
    this.progComp     = linkWith(gl, vsFs,   compile(gl, gl.FRAGMENT_SHADER, FRAG_COMPOSITE),{ aPosition: 0 });

    this.bgLocs       = getLocs(gl, this.progBg, ["uBaseColor"]);
    this.starLocs     = getLocs(gl, this.progStar, ["uResolution", "uCamera", "uHaloRadius", "uTime", "uWobbleAmp", "uStarBright", "uForceWhite", "uHaloFalloff", "uHaloOnly"]);
    this.edgeLocs     = getLocs(gl, this.progEdge, ["uResolution", "uCamera", "uHalfWidth", "uEndExtend", "uTime", "uWobbleAmp", "uLineThick", "uForceWhite"]);
    this.orbLocs      = getLocs(gl, this.progOrb,  ["uResolution", "uCamera", "uOrbRadius", "uOrbBright"]);
    this.trailLocs    = getLocs(gl, this.progTrail,["uResolution", "uCamera", "uTrailBright", "uDotRadius"]);
    this.toneLocs     = getLocs(gl, this.progTonemap, ["uSrc"]);
    this.dilateLocs   = getLocs(gl, this.progDilate, ["uSrc", "uResolution", "uHeightWidth", "uHeightSoftness"]);
    this.blurLocs     = getLocs(gl, this.progBlur, ["uSrc", "uResolution", "uBleed"]);
    this.caustLocs    = getLocs(gl, this.progCaustic, [
      "uResolution", "uCamera",
      "uScale", "uBase", "uHot", "uSat", "uExposure",
      "uCurveStr", "uCurveThick", "uMacroHill", "uMacroFloor", "uWarp",
      "uBeamLift", "uCurveFade", "uCurveFadeRange", "uSparkle",
      "uHeightmap", "uColorField", "uBaseColor", "uColorFieldGain",
      "uHeightGain", "uHeightSharp", "uHeightFloor",
    ]);
    this.compLocs     = getLocs(gl, this.progComp, ["uResolution", "uCaustic", "uTop", "uOverlayMix", "uBlur", "uBlendMode"]);

    // Fullscreen quad VBO.
    this.fsBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fsBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1,
    ]), gl.STATIC_DRAW);

    // Geometry VBOs (re-uploaded on setData).
    this.starVbo  = gl.createBuffer();
    this.edgeVbo  = gl.createBuffer();
    this.orbVbo   = gl.createBuffer();
    this.trailVbo = gl.createBuffer();
    this.orbCount   = 0;
    this.trailVerts = 0;
    this.starCount = 0;
    this.edgeCount = 0;

    // FBOs.
    this.fboTopRaw       = this._createFBO();
    this.fboTop          = this._createFBO();
    this.fboTopHeightRaw = this._createFBO();
    this.fboTopHeight    = this._createFBO();
    this.fboColorField   = this._createFBO();   // smeared colour from clusters
    this.fboDilate       = this._createFBO();
    this.fboBlur         = this._createFBO();
    this.fboCaust        = this._createFBO();

    // Internal state.
    this._raf       = 0;
    this._running   = false;
    this._lastTime  = 0;
    this._listeners = [];
    this._bbox      = null;

    this._bindFsAttribs();
  }

  // ------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------

  setData(clusters) {
    // Build per-vertex buffers for stars + edges from clusters input.
    // edges auto-computed via k-NN within each cluster if not provided.
    const STAR_CORNERS = [[-1,-1],[+1,-1],[-1,+1],[-1,+1],[+1,-1],[+1,+1]];
    const EDGE_CORNERS = [[ 0,-1],[ 1,-1],[ 0,+1],[ 0,+1],[ 1,-1],[ 1,+1]];
    const K_NN = 3;

    // Flatten stars first; assign global seed per star.
    const flatStars = [];
    let minX=+Infinity, minY=+Infinity, maxX=-Infinity, maxY=-Infinity;
    for (let ci = 0; ci < clusters.length; ci++) {
      const c = clusters[ci];
      const color = c.color || [1, 1, 1];
      for (let si = 0; si < c.stars.length; si++) {
        const s = c.stars[si];
        const seed = (Math.sin((ci * 37 + si) * 12.9898) * 43758.5453);
        flatStars.push({
          x: s.x, y: s.y, color, clusterIdx: ci, localIdx: si,
          seed: seed - Math.floor(seed),
          starId: s.id ?? `${c.id ?? ci}-${si}`,
        });
        if (s.x < minX) minX = s.x; if (s.y < minY) minY = s.y;
        if (s.x > maxX) maxX = s.x; if (s.y > maxY) maxY = s.y;
      }
    }
    this._bbox  = (flatStars.length > 0)
      ? { minX, minY, maxX, maxY }
      : { minX: -1, minY: -1, maxX: 1, maxY: 1 };
    this._stars = flatStars;
    this._clusters = clusters;

    // Build star VBO.
    const starFloats = new Float32Array(flatStars.length * 6 * 8);
    let off = 0;
    for (const s of flatStars) {
      for (let c = 0; c < 6; c++) {
        const cc = STAR_CORNERS[c];
        starFloats[off++] = cc[0];
        starFloats[off++] = cc[1];
        starFloats[off++] = s.x;
        starFloats[off++] = s.y;
        starFloats[off++] = s.seed;
        starFloats[off++] = s.color[0];
        starFloats[off++] = s.color[1];
        starFloats[off++] = s.color[2];
      }
    }
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.starVbo);
    gl.bufferData(gl.ARRAY_BUFFER, starFloats, gl.STATIC_DRAW);
    this.starCount = flatStars.length;

    // Build edge list per cluster.
    const allEdges = [];
    let starBase = 0;
    for (let ci = 0; ci < clusters.length; ci++) {
      const c = clusters[ci];
      const stars = c.stars;
      const localBase = starBase;
      const nLocal    = stars.length;

      const cEdges = c.edges
        ? c.edges.map(([i, j]) => [i, j])
        : kNearestPairs(stars, K_NN);

      for (const [i, j] of cEdges) {
        const a = flatStars[localBase + i];
        const b = flatStars[localBase + j];
        allEdges.push({ a, b });
      }
      starBase += nLocal;
    }

    // Build edge VBO.
    const edgeFloats = new Float32Array(allEdges.length * 6 * 11);
    off = 0;
    for (const e of allEdges) {
      const ax = e.a.x, ay = e.a.y, bx = e.b.x, by = e.b.y;
      const sa = e.a.seed, sb = e.b.seed;
      const co = e.a.color;
      for (let cIdx = 0; cIdx < 6; cIdx++) {
        const cc = EDGE_CORNERS[cIdx];
        edgeFloats[off++] = cc[0]; edgeFloats[off++] = cc[1];
        edgeFloats[off++] = ax;    edgeFloats[off++] = ay;
        edgeFloats[off++] = bx;    edgeFloats[off++] = by;
        edgeFloats[off++] = sa;    edgeFloats[off++] = sb;
        edgeFloats[off++] = co[0]; edgeFloats[off++] = co[1]; edgeFloats[off++] = co[2];
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeVbo);
    gl.bufferData(gl.ARRAY_BUFFER, edgeFloats, gl.STATIC_DRAW);
    this.edgeCount = allEdges.length;

    // Reset orb system to match the new data.
    this._initOrbs();
  }

  // ------------------------------------------------------------
  // Orb system — flying particles with fading trails.
  // Each orb travels on a quadratic Bezier from one star to another
  // (intra- or inter-cluster), then picks a new target on arrival.
  // ------------------------------------------------------------
  _initOrbs() {
    this.orbs = [];
    if (!this._clusters || this._clusters.length === 0) return;
    const n = (this.values.orbs?.count ?? 0) | 0;
    for (let i = 0; i < n; i++) {
      const o = this._spawnOrb(0);
      if (o) {
        // Stagger start times so they don't all leave the gate together.
        o.startTime = -Math.random() * o.duration;
        this.orbs.push(o);
      }
    }
  }

  _spawnOrb(now) {
    const clusters = this._clusters;
    if (!clusters || clusters.length === 0) return null;

    const startC = clusters[Math.floor(Math.random() * clusters.length)];
    if (!startC.stars || startC.stars.length === 0) return null;
    const startStar = startC.stars[Math.floor(Math.random() * startC.stars.length)];

    const interChance = this.values.orbs?.interClusterChance ?? 0.5;
    let endC = startC;
    if (clusters.length > 1 && Math.random() < interChance) {
      do {
        endC = clusters[Math.floor(Math.random() * clusters.length)];
      } while (endC === startC);
    }
    if (!endC.stars || endC.stars.length === 0) return null;
    const endStar = endC.stars[Math.floor(Math.random() * endC.stars.length)];

    const a = [startStar.x, startStar.y];
    const c = [endStar.x,   endStar.y];

    // Curve: quadratic Bezier with a perpendicular control offset for an arc.
    const dx = c[0] - a[0], dy = c[1] - a[1];
    const len = Math.hypot(dx, dy) || 1e-6;
    const sign = Math.random() < 0.5 ? -1 : 1;
    const offset = len * (0.20 + Math.random() * 0.25) * sign;
    const px = -dy / len, py = dx / len;
    const b = [(a[0] + c[0]) * 0.5 + px * offset,
               (a[1] + c[1]) * 0.5 + py * offset];

    const speed = this.values.orbs?.speed ?? 1.0;
    const baseDur = (2.5 + Math.random() * 3.5) / Math.max(0.05, speed);

    return {
      color: startC.color || [1, 1, 1],
      startWorld: a, endWorld: c, controlWorld: b,
      startTime: now,
      duration: baseDur,
      trail: [],   // [{ pos:[x,y], time }]
      pos: a,
    };
  }

  _updateOrbs(t) {
    if (!this.orbs) this.orbs = [];
    // Sync orb array length to current count (so the slider takes effect
    // without a full _initOrbs call, which would reset all in-flight orbs).
    const target = Math.max(0, (this.values.orbs?.count ?? 0) | 0);
    while (this.orbs.length < target) {
      const o = this._spawnOrb(t);
      if (!o) break;
      o.startTime -= Math.random() * o.duration;
      this.orbs.push(o);
    }
    if (this.orbs.length > target) this.orbs.length = target;

    const lifetime = this.values.orbs?.trailLifetime ?? 0.65;
    for (let i = 0; i < this.orbs.length; i++) {
      const o = this.orbs[i];
      const prog = (t - o.startTime) / o.duration;
      if (prog >= 1.0) {
        const replacement = this._spawnOrb(t);
        if (replacement) this.orbs[i] = replacement;
        continue;
      }
      // Quadratic bezier B(u) = (1-u)²A + 2(1-u)uB + u²C.
      const u = 1 - prog;
      const a = o.startWorld, b = o.controlWorld, c = o.endWorld;
      const x = u * u * a[0] + 2 * u * prog * b[0] + prog * prog * c[0];
      const y = u * u * a[1] + 2 * u * prog * b[1] + prog * prog * c[1];
      o.pos = [x, y];
      // Sample trail at fixed time intervals so dots stay evenly spaced
      // regardless of framerate. Interval tuned for ~16 dots over default
      // lifetime (0.06s × 16 ≈ 1.0s).
      const SAMPLE_INTERVAL = 0.060;
      const last = o.trail[o.trail.length - 1];
      if (!last || t - last.time >= SAMPLE_INTERVAL) {
        o.trail.push({ pos: [x, y], time: t });
      }
      // Drop trail entries older than lifetime.
      while (o.trail.length > 0 && t - o.trail[0].time > lifetime) {
        o.trail.shift();
      }
    }
  }

  _buildOrbVerts() {
    // 6 verts per orb × 7 floats (quad 2, pos 2, color 3)
    const orbs = this.orbs || [];
    const STAR_CORNERS = [[-1,-1],[+1,-1],[-1,+1],[-1,+1],[+1,-1],[+1,+1]];
    const buf = new Float32Array(orbs.length * 6 * 7);
    let off = 0, n = 0;
    for (const o of orbs) {
      if (!o.pos) continue;
      const [x, y] = o.pos;
      const c = o.color;
      for (let cIdx = 0; cIdx < 6; cIdx++) {
        const cc = STAR_CORNERS[cIdx];
        buf[off++] = cc[0]; buf[off++] = cc[1];
        buf[off++] = x;     buf[off++] = y;
        buf[off++] = c[0];  buf[off++] = c[1]; buf[off++] = c[2];
      }
      n++;
    }
    if (n > 0) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.orbVbo);
      gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, n * 6 * 7), gl.STREAM_DRAW);
    }
    this.orbCount = n;
  }

  _buildTrailVerts(t) {
    const orbs = this.orbs || [];
    const lifetime = this.values.orbs?.trailLifetime ?? 0.65;
    // 6 verts per dot × 8 floats: aQuadCoord(2) + aPos(2) + aAge(1) + aColor(3)
    let totalDots = 0;
    for (const o of orbs) totalDots += (o.trail?.length || 0);
    const buf = new Float32Array(totalDots * 6 * 8);
    const CORNERS = [[-1,-1],[+1,-1],[-1,+1],[-1,+1],[+1,-1],[+1,+1]];
    let off = 0, written = 0;
    for (const o of orbs) {
      if (!o.trail || o.trail.length === 0) continue;
      const c = o.color;
      for (const tp of o.trail) {
        const age = (t - tp.time) / lifetime;
        if (age < 0 || age > 1) continue;
        const x = tp.pos[0], y = tp.pos[1];
        for (let k = 0; k < 6; k++) {
          const cc = CORNERS[k];
          buf[off++] = cc[0]; buf[off++] = cc[1];
          buf[off++] = x;     buf[off++] = y;
          buf[off++] = age;
          buf[off++] = c[0];  buf[off++] = c[1]; buf[off++] = c[2];
        }
        written++;
      }
    }
    if (written > 0) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.trailVbo);
      gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, written * 6 * 8), gl.STREAM_DRAW);
    }
    this.trailVerts = written * 6;
  }

  setOrbCount(n) {
    if (!this.values.orbs) this.values.orbs = {};
    this.values.orbs.count = (n | 0);
    this._initOrbs();
  }

  setCamera(x, y, zoom) {
    this.camera.x = x;
    this.camera.y = y;
    this.camera.zoom = zoom;
  }
  getCamera() { return { ...this.camera }; }

  resetCamera(padding = 1.2) {
    if (!this._bbox) return;
    const { minX, minY, maxX, maxY } = this._bbox;
    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;
    const w  = Math.max(0.001, (maxX - minX) * padding);
    const h  = Math.max(0.001, (maxY - minY) * padding);
    const aspect = (this.canvas.clientWidth || 1) / (this.canvas.clientHeight || 1);
    // Screen visible area at zoom=z is (2*aspect/z) wide and (2/z) tall.
    // Solve for the smaller axis.
    const zoomX = (2 * aspect) / w;
    const zoomY = 2 / h;
    this.camera = { x: cx, y: cy, zoom: Math.min(zoomX, zoomY) };
  }

  setUniform(target, name, value) {
    if (!this.values[target]) return;
    this.values[target][name] = value;
  }

  enableInteraction(opts = {}) {
    const minZoom = opts.minZoom ?? 0.05;
    const maxZoom = opts.maxZoom ?? 20;
    const zoomStep = opts.zoomStep ?? 1.15;

    const cv = this.canvas;
    let dragging = false;
    let lastX = 0, lastY = 0;

    const screenToWorld = (sx, sy) => {
      const rect = cv.getBoundingClientRect();
      const u = (sx - rect.left) / rect.width;
      const v = 1 - (sy - rect.top) / rect.height;     // flip y
      const aspect = rect.width / Math.max(1, rect.height);
      const wx = ((u - 0.5) * aspect) / this.camera.zoom + this.camera.x;
      const wy = ((v - 0.5))          / this.camera.zoom + this.camera.y;
      return { x: wx, y: wy };
    };

    const onDown = (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; cv.style.cursor = "grabbing"; };
    const onMove = (e) => {
      if (!dragging) return;
      const rect = cv.getBoundingClientRect();
      const dx = (e.clientX - lastX) / rect.height * 2 / this.camera.zoom; // x scaled by aspect via height-relative units
      const dy = (e.clientY - lastY) / rect.height * 2 / this.camera.zoom;
      this.camera.x -= dx;
      this.camera.y += dy;
      lastX = e.clientX; lastY = e.clientY;
    };
    const onUp = () => { dragging = false; cv.style.cursor = ""; };
    const onWheel = (e) => {
      e.preventDefault();
      const before = screenToWorld(e.clientX, e.clientY);
      const factor = e.deltaY < 0 ? zoomStep : 1 / zoomStep;
      this.camera.zoom = Math.max(minZoom, Math.min(maxZoom, this.camera.zoom * factor));
      const after = screenToWorld(e.clientX, e.clientY);
      this.camera.x += before.x - after.x;
      this.camera.y += before.y - after.y;
    };

    cv.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    cv.addEventListener("wheel", onWheel, { passive: false });
    cv.style.cursor = "grab";

    this._listeners.push(
      () => cv.removeEventListener("mousedown", onDown),
      () => window.removeEventListener("mousemove", onMove),
      () => window.removeEventListener("mouseup",   onUp),
      () => cv.removeEventListener("wheel", onWheel),
    );
  }

  start() {
    if (this._running) return;
    this._running = true;
    const tick = (now) => {
      this._raf = requestAnimationFrame(tick);
      const t = (now || performance.now()) / 1000;
      this.draw(t);
    };
    this._raf = requestAnimationFrame(tick);
  }
  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  destroy() {
    this.stop();
    for (const off of this._listeners) try { off(); } catch (_) {}
    this._listeners = [];
    const gl = this.gl;
    gl.deleteBuffer(this.fsBuf);
    gl.deleteBuffer(this.starVbo);
    gl.deleteBuffer(this.edgeVbo);
    gl.deleteBuffer(this.orbVbo);
    gl.deleteBuffer(this.trailVbo);
    for (const F of [this.fboTopRaw, this.fboTop, this.fboTopHeightRaw, this.fboTopHeight, this.fboColorField, this.fboDilate, this.fboBlur, this.fboCaust]) {
      gl.deleteFramebuffer(F.fbo);
      gl.deleteTexture(F.tex);
    }
    for (const p of [this.progBg, this.progStar, this.progEdge, this.progOrb, this.progTrail, this.progTonemap, this.progDilate, this.progBlur, this.progCaustic, this.progComp]) {
      gl.deleteProgram(p);
    }
  }

  // ------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------

  _createFBO() {
    return { fbo: this.gl.createFramebuffer(), tex: this.gl.createTexture(), w: 0, h: 0 };
  }
  _resizeFBO(F, w, h) {
    if (F.w === w && F.h === h) return;
    F.w = w; F.h = h;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, F.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, F.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, F.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  _resize() {
    const cv = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprMax);
    const w = Math.max(1, Math.floor(cv.clientWidth  * dpr));
    const h = Math.max(1, Math.floor(cv.clientHeight * dpr));
    if (cv.width !== w || cv.height !== h) {
      cv.width = w; cv.height = h;
    }
    const halfW  = Math.max(1, Math.floor(w * this.heightScale));
    const halfH  = Math.max(1, Math.floor(h * this.heightScale));
    // Colour field at quarter-res — it's the smeared/blurred version,
    // detail is wasted and bilinear filtering will hide the upscale.
    const cfW = Math.max(1, Math.floor(w * 0.25));
    const cfH = Math.max(1, Math.floor(h * 0.25));
    this._resizeFBO(this.fboTopRaw,       w, h);
    this._resizeFBO(this.fboTop,          w, h);
    this._resizeFBO(this.fboTopHeightRaw, halfW, halfH);
    this._resizeFBO(this.fboTopHeight,    halfW, halfH);
    this._resizeFBO(this.fboColorField,   cfW, cfH);
    this._resizeFBO(this.fboDilate,       w, h);
    this._resizeFBO(this.fboBlur,         w, h);
    this._resizeFBO(this.fboCaust,        w, h);
  }

  _bindFsAttribs() {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fsBuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disableVertexAttribArray(1);
    gl.disableVertexAttribArray(2);
    gl.disableVertexAttribArray(3);
    gl.disableVertexAttribArray(4);
    gl.disableVertexAttribArray(5);
  }
  _bindStarAttribs() {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.starVbo);
    const stride = 8 * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 16);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, stride, 20);
    gl.disableVertexAttribArray(4);
    gl.disableVertexAttribArray(5);
  }
  _bindEdgeAttribs() {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeVbo);
    const stride = 11 * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 16);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 24);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 28);
    gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 3, gl.FLOAT, false, stride, 32);
  }
  _bindOrbAttribs() {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.orbVbo);
    const stride = 7 * 4;     // aQuadCoord(2) + aOrbPos(2) + aColor(3)
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 16);
    gl.disableVertexAttribArray(3);
    gl.disableVertexAttribArray(4);
    gl.disableVertexAttribArray(5);
  }
  _bindTrailAttribs() {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.trailVbo);
    const stride = 8 * 4;     // aQuadCoord(2) + aPos(2) + aAge(1) + aColor(3)
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 16);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, stride, 20);
    gl.disableVertexAttribArray(4);
    gl.disableVertexAttribArray(5);
  }

  _renderConstellation(rawFBO, finalFBO, isHeightmap, t) {
    const gl = this.gl;
    const tw = rawFBO.w, th = rawFBO.h;
    const cam = this.camera;
    const W = this.canvas.width, H = this.canvas.height;
    const C = this.values.constellation;

    // BG. Visible pass paints deep + radial wash; heightmap pass clears
    // to pure black so empty regions sample cellLum=0 → curveFade can
    // actually reach black instead of bottoming out at the wash colour.
    gl.bindFramebuffer(gl.FRAMEBUFFER, rawFBO.fbo);
    gl.viewport(0, 0, tw, th);
    gl.disable(gl.BLEND);
    if (isHeightmap) {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    } else {
      gl.useProgram(this.progBg);
      this._bindFsAttribs();
      const bc = this.values.baseColor;
      gl.uniform3f(this.bgLocs.uBaseColor, bc[0], bc[1], bc[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // EDGES (additive).
    if (this.edgeCount > 0) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(this.progEdge);
      this._bindEdgeAttribs();
      gl.uniform2f(this.edgeLocs.uResolution, tw, th);
      gl.uniform3f(this.edgeLocs.uCamera, cam.x, cam.y, cam.zoom);
      gl.uniform1f(this.edgeLocs.uHalfWidth,  isHeightmap ? 0.45 : 0.10);
      gl.uniform1f(this.edgeLocs.uEndExtend,  isHeightmap ? 0.30 : 0.10);
      gl.uniform1f(this.edgeLocs.uTime,       t);
      gl.uniform1f(this.edgeLocs.uWobbleAmp,  C.uWobbleAmp);
      gl.uniform1f(this.edgeLocs.uLineThick,  C.uLineThick);
      gl.uniform1i(this.edgeLocs.uForceWhite, isHeightmap ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, this.edgeCount * 6);
    }

    // STARS (additive).
    if (this.starCount > 0) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(this.progStar);
      this._bindStarAttribs();
      gl.uniform2f(this.starLocs.uResolution, tw, th);
      gl.uniform3f(this.starLocs.uCamera, cam.x, cam.y, cam.zoom);
      gl.uniform1f(this.starLocs.uHaloRadius, isHeightmap ? 1.6 : C.uHaloRadius);
      gl.uniform1f(this.starLocs.uTime,       t);
      gl.uniform1f(this.starLocs.uWobbleAmp,  C.uWobbleAmp);
      gl.uniform1f(this.starLocs.uStarBright, C.uStarBright);
      gl.uniform1i(this.starLocs.uForceWhite, isHeightmap ? 1 : 0);
      gl.uniform1f(this.starLocs.uHaloFalloff, 1.0);
      gl.uniform1i(this.starLocs.uHaloOnly,    0);
      gl.drawArrays(gl.TRIANGLES, 0, this.starCount * 6);
      gl.disable(gl.BLEND);
    }

    // ORBS + TRAILS — only on the visible pass; the heightmap doesn't
    // need them (they're a foreground decoration, not a structure source).
    if (!isHeightmap) {
      const O = this.values.orbs || {};
      // Trails first, so the orb head sits on top of its own trail.
      if (this.trailVerts > 0) {
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(this.progTrail);
        this._bindTrailAttribs();
        gl.uniform2f(this.trailLocs.uResolution, tw, th);
        gl.uniform3f(this.trailLocs.uCamera, cam.x, cam.y, cam.zoom);
        gl.uniform1f(this.trailLocs.uDotRadius,   O.trailWidth  ?? 0.025);
        gl.uniform1f(this.trailLocs.uTrailBright, O.trailBright ?? 1.30);
        gl.drawArrays(gl.TRIANGLES, 0, this.trailVerts);
        gl.disable(gl.BLEND);
      }
      if (this.orbCount > 0) {
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(this.progOrb);
        this._bindOrbAttribs();
        gl.uniform2f(this.orbLocs.uResolution, tw, th);
        gl.uniform3f(this.orbLocs.uCamera, cam.x, cam.y, cam.zoom);
        gl.uniform1f(this.orbLocs.uOrbRadius, O.radius   ?? 0.040);
        gl.uniform1f(this.orbLocs.uOrbBright, O.bright   ?? 1.40);
        gl.drawArrays(gl.TRIANGLES, 0, this.orbCount * 6);
        gl.disable(gl.BLEND);
      }
    }

    // TONEMAP fullscreen → finalFBO.
    gl.bindFramebuffer(gl.FRAMEBUFFER, finalFBO.fbo);
    gl.viewport(0, 0, finalFBO.w, finalFBO.h);
    gl.disable(gl.BLEND);
    gl.useProgram(this.progTonemap);
    this._bindFsAttribs();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, rawFBO.tex);
    gl.uniform1i(this.toneLocs.uSrc, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  draw(t) {
    const gl = this.gl;
    this._resize();
    const W = this.canvas.width, H = this.canvas.height;
    const cam = this.camera;
    const K = this.values.caustic;
    const M = this.values.composite;

    // Update orb particle state and rebuild their VBOs.
    this._updateOrbs(t);
    this._buildOrbVerts();
    this._buildTrailVerts(t);

    // Pass 1: visible constellation
    this._renderConstellation(this.fboTopRaw, this.fboTop, false, t);

    // Pass 1.5: dedicated colour-field render. Stars only, very wide
    // halos, low per-star brightness so accumulation doesn't saturate.
    // Each cluster paints a soft coloured cloud at its location; the
    // caustic samples this for cell tinting downstream. Drawn at
    // quarter-res into fboColorField; bilinear upsample handles smoothing.
    {
      const F = this.fboColorField;
      const C = this.values.constellation;
      gl.bindFramebuffer(gl.FRAMEBUFFER, F.fbo);
      gl.viewport(0, 0, F.w, F.h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (this.starCount > 0) {
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(this.progStar);
        this._bindStarAttribs();
        gl.uniform2f(this.starLocs.uResolution, F.w, F.h);
        gl.uniform3f(this.starLocs.uCamera, cam.x, cam.y, cam.zoom);
        gl.uniform1f(this.starLocs.uHaloRadius, 5.0);                 // big quad to fit the wider falloff
        gl.uniform1f(this.starLocs.uTime, t);
        gl.uniform1f(this.starLocs.uWobbleAmp, 0.0);                  // no wobble in color field
        gl.uniform1f(this.starLocs.uStarBright, 0.20);                // dim per-star, halo-only & wide
        gl.uniform1i(this.starLocs.uForceWhite, 0);
        // colorFieldBleed: 1 = same as constellation halo, 5 = 5× wider, etc.
        gl.uniform1f(this.starLocs.uHaloFalloff, 1.0 / Math.max(0.1, this.values.colorFieldBleed));
        gl.uniform1i(this.starLocs.uHaloOnly,    1);                  // skip core/flare
        gl.drawArrays(gl.TRIANGLES, 0, this.starCount * 6);
        gl.disable(gl.BLEND);
      }
    }

    // Pass 1': heightmap constellation (half-res)
    this._renderConstellation(this.fboTopHeightRaw, this.fboTopHeight, true, t);

    // Pass 2: dilate
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboDilate.fbo);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.progDilate);
    this._bindFsAttribs();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fboTopHeight.tex);
    gl.uniform1i(this.dilateLocs.uSrc, 0);
    gl.uniform2f(this.dilateLocs.uResolution, W, H);
    gl.uniform1f(this.dilateLocs.uHeightWidth,    K.uHeightWidth);
    gl.uniform1f(this.dilateLocs.uHeightSoftness, K.uHeightSoftness);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Pass 3: blur
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboBlur.fbo);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.progBlur);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fboDilate.tex);
    gl.uniform1i(this.blurLocs.uSrc, 0);
    gl.uniform2f(this.blurLocs.uResolution, W, H);
    gl.uniform1f(this.blurLocs.uBleed, K.uHeightBleed);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Pass 4: caustic
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboCaust.fbo);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.progCaustic);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fboBlur.tex);
    gl.uniform1i(this.caustLocs.uHeightmap, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.fboColorField.tex);
    gl.uniform1i(this.caustLocs.uColorField, 1);
    const bc = this.values.baseColor;
    gl.uniform3f(this.caustLocs.uBaseColor, bc[0], bc[1], bc[2]);
    gl.uniform1f(this.caustLocs.uColorFieldGain, K.uColorFieldGain);
    gl.uniform2f(this.caustLocs.uResolution, W, H);
    gl.uniform3f(this.caustLocs.uCamera, cam.x, cam.y, cam.zoom);
    gl.uniform1f(this.caustLocs.uScale,          K.uScale);
    gl.uniform1f(this.caustLocs.uBase,           K.uBase);
    gl.uniform1f(this.caustLocs.uHot,            K.uHot);
    gl.uniform1f(this.caustLocs.uSat,            K.uSat);
    gl.uniform1f(this.caustLocs.uExposure,       K.uExposure);
    gl.uniform1f(this.caustLocs.uCurveStr,       K.uCurveStr);
    gl.uniform1f(this.caustLocs.uCurveThick,     K.uCurveThick);
    gl.uniform1f(this.caustLocs.uMacroHill,      K.uMacroHill);
    gl.uniform1f(this.caustLocs.uMacroFloor,     K.uMacroFloor);
    gl.uniform1f(this.caustLocs.uWarp,           K.uWarp);
    gl.uniform1f(this.caustLocs.uBeamLift,       K.uBeamLift);
    gl.uniform1f(this.caustLocs.uCurveFade,      K.uCurveFade);
    gl.uniform1f(this.caustLocs.uCurveFadeRange, K.uCurveFadeRange);
    gl.uniform1f(this.caustLocs.uSparkle,        K.uSparkle);
    gl.uniform1f(this.caustLocs.uHeightGain,     K.uHeightGain);
    gl.uniform1f(this.caustLocs.uHeightSharp,    K.uHeightSharp);
    gl.uniform1f(this.caustLocs.uHeightFloor,    K.uHeightFloor);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Pass 5: composite to canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.progComp);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fboCaust.tex);
    gl.uniform1i(this.compLocs.uCaustic, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.fboTop.tex);
    gl.uniform1i(this.compLocs.uTop, 1);
    gl.uniform2f(this.compLocs.uResolution, W, H);
    gl.uniform1f(this.compLocs.uOverlayMix, M.uOverlayMix);
    gl.uniform1f(this.compLocs.uBlur,       M.uBlur);
    gl.uniform1i(this.compLocs.uBlendMode,  M.uBlendMode | 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

// ============================================================
// k-NN edges within a single cluster
// ============================================================
function kNearestPairs(stars, k) {
  const n = stars.length;
  const seen = new Set();
  const out  = [];
  for (let i = 0; i < n; i++) {
    const dists = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dx = stars[i].x - stars[j].x;
      const dy = stars[i].y - stars[j].y;
      dists.push({ j, d: dx*dx + dy*dy });
    }
    dists.sort((a, b) => a.d - b.d);
    for (let m = 0; m < Math.min(k, dists.length); m++) {
      const j = dists[m].j;
      const a = Math.min(i, j), b = Math.max(i, j);
      const key = a * 100000 + b;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([a, b]);
    }
  }
  return out;
}
