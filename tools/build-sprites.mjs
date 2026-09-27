// Sprite pipeline for nautilus-agents.html. No dependencies beyond Node.
//
//   npm run sprites                 build the atlas
//   npm run sprites:check           exit 1 if the committed atlas is out of date
//   npm run sprites:watch           rebuild whenever a source file changes
//
// Sources   assets/nautilus/src/palette.txt        every colour, keyed for sprites
//           assets/nautilus/src/sprites/*.sprite   hand-drawn pixel art, as text
//           assets/nautilus/src/procedural.mjs     generated set pieces
// Outputs   assets/nautilus/atlas.png              the packed sprite sheet
//           assets/nautilus/atlas.json             frame rects, palette, anchor meta
//           assets/nautilus/atlas.js               the same with the PNG inlined — the
//                                                  page loads this, so file:// works
//           assets/nautilus/atlas-preview.png      4× sheet on a checker, for review
//
// .sprite format
//   # comment
//   @sprite <name>                 first directive; frames become <name>[.<variant>].<frame>
//   @outline <colour>              pad each frame by 1px and outline it
//   @thin <chars>                  characters drawn after the outline (hair-thin details)
//   @map K=colour …                re-key characters for this sprite
//   @variant <name> K=colour …     emit a recoloured copy of every frame
//   @point <name> x,y              anchor in row/column coords → atlas meta (outline-adjusted)
//   @frame <name>                  the following lines are pixel rows; '.' is empty
// Colours are palette names or #rrggbb.
import { createHash } from 'node:crypto';
import { watch } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as pixelkit from './pixelkit.mjs';
import { PixelBuffer, encodePNG } from './pixelkit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets/nautilus/src');
const OUT = path.join(ROOT, 'assets/nautilus');
const FILES = {
  png: path.join(OUT, 'atlas.png'),
  json: path.join(OUT, 'atlas.json'),
  js: path.join(OUT, 'atlas.js'),
  preview: path.join(OUT, 'atlas-preview.png'),
};
const rel = (p) => path.relative(ROOT, p);

// --------------------------------------------------------------- parsing ----

function parsePalette(text, file) {
  const byKey = {};
  const byName = {};
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const m = line.match(/^(\S)\s+(#[0-9a-fA-F]{6})\s+([A-Za-z][\w-]*)$/);
    if (!m) throw new Error(`${rel(file)}:${i + 1}: expected "key #rrggbb name"`);
    const [, key, hex, name] = m;
    if (byName[name]) throw new Error(`${rel(file)}:${i + 1}: colour "${name}" defined twice`);
    if (key !== '-') {
      if (byKey[key]) throw new Error(`${rel(file)}:${i + 1}: key "${key}" already used`);
      byKey[key] = hex.toLowerCase();
    }
    byName[name] = hex.toLowerCase();
  });
  return { byKey, byName };
}

function parseSprite(text, file, pal) {
  const spec = { sprite: null, outline: null, thin: '', map: {}, variants: [], points: {}, frames: [] };
  const colour = (v, where) => {
    if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
    if (pal.byName[v]) return pal.byName[v];
    throw new Error(`${where}: unknown colour "${v}"`);
  };
  const pairs = (args, where) =>
    Object.fromEntries(
      args.map((a) => {
        const [k, v] = a.split('=');
        if (!k || k.length !== 1 || !v) throw new Error(`${where}: expected K=colour, got "${a}"`);
        return [k, colour(v, where)];
      }),
    );

  let frame = null;
  text.split('\n').forEach((raw, i) => {
    const where = `${rel(file)}:${i + 1}`;
    const line = raw.replace(/\s+$/, '');
    if (!line) {
      if (frame?.rows.length) frame = null;
      return;
    }
    if (line.startsWith('#')) return;
    if (line.startsWith('@')) {
      const [dir, ...args] = line.slice(1).split(/\s+/);
      frame = null;
      if (dir !== 'sprite' && !spec.sprite) throw new Error(`${where}: @sprite must come first`);
      switch (dir) {
        case 'sprite':
          spec.sprite = args[0];
          break;
        case 'outline':
          spec.outline = colour(args[0], where);
          break;
        case 'thin':
          spec.thin = args.join('');
          break;
        case 'map':
          Object.assign(spec.map, pairs(args, where));
          break;
        case 'variant':
          spec.variants.push({ name: args[0], map: pairs(args.slice(1), where) });
          break;
        case 'point': {
          const [x, y] = (args[1] ?? '').split(',').map(Number);
          if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${where}: expected @point name x,y`);
          spec.points[args[0]] = [x, y];
          break;
        }
        case 'frame':
          frame = { name: args[0], rows: [], line: i + 1 };
          spec.frames.push(frame);
          break;
        default:
          throw new Error(`${where}: unknown directive @${dir}`);
      }
      return;
    }
    if (!frame) throw new Error(`${where}: pixel row outside an @frame`);
    frame.rows.push(line);
  });

  if (!spec.sprite) throw new Error(`${rel(file)}: missing @sprite`);
  if (!spec.frames.length) throw new Error(`${rel(file)}: no frames`);

  const p = spec.outline ? 1 : 0;
  const frames = [];
  for (const variant of spec.variants.length ? spec.variants : [{ name: null, map: {} }]) {
    const map = { ...pal.byKey, ...spec.map, ...variant.map };
    for (const f of spec.frames) {
      const w = f.rows[0].length;
      const bad = f.rows.findIndex((r) => r.length !== w);
      if (bad >= 0) {
        throw new Error(`${rel(file)}:${f.line + 1 + bad}: row is ${f.rows[bad].length} wide, frame "${f.name}" is ${w}`);
      }
      const buf = new PixelBuffer(w + p * 2, f.rows.length + p * 2);
      const draw = (thinPass) =>
        f.rows.forEach((row, y) =>
          [...row].forEach((ch, x) => {
            if (ch === '.' || spec.thin.includes(ch) !== thinPass) return;
            if (!map[ch]) throw new Error(`${rel(file)}:${f.line + 1 + y}: "${ch}" is not a palette key`);
            buf.set(x + p, y + p, map[ch]);
          }),
        );
      draw(false);
      if (spec.outline) buf.outline(spec.outline);
      draw(true);
      frames.push({ name: variant.name ? `${variant.name}.${f.name}` : f.name, buf });
    }
  }
  const meta = Object.fromEntries(Object.entries(spec.points).map(([k, [x, y]]) => [k, [x + p, y + p]]));
  return { sprite: spec.sprite, frames, meta, source: rel(file) };
}

async function collect() {
  const palFile = path.join(SRC, 'palette.txt');
  const pal = parsePalette(await readFile(palFile, 'utf8'), palFile);
  const sprites = [];
  const dir = path.join(SRC, 'sprites');
  for (const name of (await readdir(dir)).filter((f) => f.endsWith('.sprite')).sort()) {
    const file = path.join(dir, name);
    sprites.push(parseSprite(await readFile(file, 'utf8'), file, pal));
  }
  // Query string busts Node's module cache so --watch picks up edits.
  const procFile = path.join(SRC, 'procedural.mjs');
  const mod = await import(`${pathToFileURL(procFile).href}?v=${Date.now()}`);
  for (const s of mod.default({ ...pixelkit, P: pal.byName })) sprites.push({ ...s, source: rel(procFile) });
  return { pal, sprites };
}

// --------------------------------------------------------------- packing ----

// Shelf packer: tallest first, 1px gutter so nearest-neighbour sampling never
// bleeds between frames.
function pack(entries) {
  const GUTTER = 1;
  const sorted = [...entries].sort((a, b) => b.buf.h - a.buf.h || b.buf.w - a.buf.w || (a.key < b.key ? -1 : 1));
  const area = entries.reduce((s, e) => s + (e.buf.w + GUTTER) * (e.buf.h + GUTTER), 0);
  const width = Math.max(
    Math.max(...entries.map((e) => e.buf.w)) + GUTTER,
    Math.ceil(Math.sqrt(area * 1.2) / 8) * 8,
  );
  const rects = new Map();
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const e of sorted) {
    if (x + e.buf.w > width) {
      x = 0;
      y += rowH + GUTTER;
      rowH = 0;
    }
    rects.set(e.key, { x, y, w: e.buf.w, h: e.buf.h });
    x += e.buf.w + GUTTER;
    rowH = Math.max(rowH, e.buf.h);
  }
  const sheet = new PixelBuffer(width, y + rowH);
  for (const e of entries) {
    const r = rects.get(e.key);
    sheet.blit(e.buf, r.x, r.y);
  }
  return { sheet, rects };
}

function preview(sheet, scale) {
  const bg = new PixelBuffer(sheet.w, sheet.h);
  for (let y = 0; y < sheet.h; y++) {
    for (let x = 0; x < sheet.w; x++) bg.set(x, y, ((x >> 2) + (y >> 2)) & 1 ? '#101c2c' : '#0b1522');
  }
  return bg.blit(sheet, 0, 0).scaled(scale);
}

// Pretty JSON, but keep numeric arrays (rects, points) on one line.
function stringify(value) {
  return JSON.stringify(value, null, 2).replace(/\[\s+([-\d.,\s]+?)\s+\]/g, (_, inner) => `[${inner.split(/,\s*/).join(', ')}]`);
}

async function build() {
  const { pal, sprites } = await collect();
  const entries = [];
  const summary = {};
  for (const s of sprites) {
    if (summary[s.sprite]) throw new Error(`sprite "${s.sprite}" is defined twice (${summary[s.sprite].source}, ${s.source})`);
    summary[s.sprite] = { source: s.source, frames: s.frames.map((f) => `${s.sprite}.${f.name}`) };
    for (const f of s.frames) entries.push({ key: `${s.sprite}.${f.name}`, buf: f.buf });
  }
  const { sheet, rects } = pack(entries);
  const body = {
    version: 1,
    size: [sheet.w, sheet.h],
    palette: pal.byName,
    sprites: summary,
    frames: Object.fromEntries(entries.map((e) => [e.key, rects.get(e.key)])),
    meta: Object.fromEntries(sprites.filter((s) => Object.keys(s.meta ?? {}).length).map((s) => [s.sprite, s.meta])),
  };
  const hash = createHash('sha256').update(JSON.stringify(body)).update(sheet.data).digest('hex').slice(0, 16);
  const json = { generator: 'tools/build-sprites.mjs', hash, ...body };
  const png = encodePNG(sheet);
  const js =
    '// Generated by tools/build-sprites.mjs from assets/nautilus/src — do not edit.\n' +
    '// A classic script (not fetch) so nautilus-agents.html also runs from file://.\n' +
    `window.NAUTILUS_ATLAS = ${JSON.stringify({ ...json, image: `data:image/png;base64,${png.toString('base64')}` })};\n`;
  return {
    json,
    png,
    js,
    preview: encodePNG(preview(sheet, 4)),
    stats: `${sheet.w}×${sheet.h} · ${entries.length} frames from ${sprites.length} sprites · png ${(png.length / 1024).toFixed(1)} KB`,
  };
}

async function write() {
  const t0 = performance.now();
  const out = await build();
  await Promise.all([
    writeFile(FILES.png, out.png),
    writeFile(FILES.json, `${stringify(out.json)}\n`),
    writeFile(FILES.js, out.js),
    writeFile(FILES.preview, out.preview),
  ]);
  console.log(`atlas ${out.json.hash} · ${out.stats} · ${Math.round(performance.now() - t0)} ms`);
  for (const f of Object.values(FILES)) console.log(`  wrote ${rel(f)}`);
}

async function check() {
  const out = await build();
  const current = await readFile(FILES.json, 'utf8').then(JSON.parse, () => null);
  const js = await readFile(FILES.js, 'utf8').catch(() => '');
  if (current?.hash !== out.json.hash || !js.includes(`"hash":"${out.json.hash}"`)) {
    console.error(`atlas is stale (committed ${current?.hash ?? 'none'}, sources ${out.json.hash}) — run npm run sprites`);
    process.exit(1);
  }
  console.log(`atlas ${out.json.hash} is up to date · ${out.stats}`);
}

const args = new Set(process.argv.slice(2));
try {
  if (args.has('--check')) await check();
  else await write();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

if (args.has('--watch')) {
  let timer = null;
  watch(SRC, { recursive: true }, (_, file) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`\n${file ?? 'source'} changed`);
      write().catch((e) => console.error(e.message));
    }, 120);
  });
  console.log(`watching ${rel(SRC)} …`);
}
