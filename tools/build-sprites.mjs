// Sprite pipeline for the pixel-art pages. No dependencies beyond Node.
//
//   npm run sprites                 build every atlas
//   npm run sprites -- garden       build only the named sets
//   npm run sprites:check           exit 1 if a committed atlas is out of date
//   npm run sprites:watch           rebuild whenever a source file changes
//
// Each set is a directory assets/<set>/ with a src/ folder (nautilus, garden,
// neon, …); every set builds into its own atlas.
//
// Sources   assets/<set>/src/palette.txt        every colour, keyed for sprites
//           assets/<set>/src/sprites/*.sprite   hand-drawn pixel art, as text
//           assets/<set>/src/*.mjs              generators for the larger set pieces
// Outputs   assets/<set>/atlas.png              the packed sprite sheet
//           assets/<set>/atlas.json             frame rects, palette, anchor meta
//           assets/<set>/atlas.js               the same with the PNG inlined, as
//                                               window.<SET>_ATLAS — pages load this,
//                                               so file:// works
//           assets/<set>/atlas-preview.png      4× sheet on a checker, for review
//
// .sprite format
//   # comment
//   @sprite <name>                 first directive; frames become <name>[.<variant>].<frame>
//   @outline <colour>|auto         pad each frame by 1px and outline it; auto = selective
//                                  outline, a dark shade of each bordering pixel
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
const ASSETS = path.join(ROOT, 'assets');
const setDirs = (set) => {
  const out = path.join(ASSETS, set);
  return {
    src: path.join(out, 'src'),
    files: {
      png: path.join(out, 'atlas.png'),
      json: path.join(out, 'atlas.json'),
      js: path.join(out, 'atlas.js'),
      preview: path.join(out, 'atlas-preview.png'),
    },
  };
};
async function allSets() {
  const sets = [];
  for (const d of (await readdir(ASSETS, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
    const ok = await readFile(path.join(ASSETS, d, 'src', 'palette.txt')).then(() => true, () => false);
    if (ok) sets.push(d);
  }
  return sets;
}
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
          spec.outline = args[0] === 'auto' ? 'auto' : colour(args[0], where);
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

async function collect(SRC) {
  const palFile = path.join(SRC, 'palette.txt');
  const pal = parsePalette(await readFile(palFile, 'utf8'), palFile);
  const sprites = [];
  const dir = path.join(SRC, 'sprites');
  for (const name of (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.sprite')).sort()) {
    const file = path.join(dir, name);
    sprites.push(parseSprite(await readFile(file, 'utf8'), file, pal));
  }
  // Every *.mjs in src is a generator module; the query string busts Node's
  // module cache so --watch picks up edits.
  const kit = { ...pixelkit, P: pal.byName };
  for (const name of (await readdir(SRC)).filter((f) => f.endsWith('.mjs')).sort()) {
    const file = path.join(SRC, name);
    const mod = await import(`${pathToFileURL(file).href}?v=${Date.now()}`);
    for (const s of mod.default(kit)) sprites.push({ ...s, source: rel(file) });
  }
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

async function build(set) {
  const { pal, sprites } = await collect(setDirs(set).src);
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
    `// Generated by tools/build-sprites.mjs from assets/${set}/src — do not edit.\n` +
    '// A classic script (not fetch) so the pages also run from file://.\n' +
    `window.${set.toUpperCase()}_ATLAS = ${JSON.stringify({ ...json, image: `data:image/png;base64,${png.toString('base64')}` })};\n`;
  return {
    json,
    png,
    js,
    preview: encodePNG(preview(sheet, 4)),
    stats: `${sheet.w}×${sheet.h} · ${entries.length} frames from ${sprites.length} sprites · png ${(png.length / 1024).toFixed(1)} KB`,
  };
}

async function write(set) {
  const t0 = performance.now();
  const out = await build(set);
  const FILES = setDirs(set).files;
  await Promise.all([
    writeFile(FILES.png, out.png),
    writeFile(FILES.json, `${stringify(out.json)}\n`),
    writeFile(FILES.js, out.js),
    writeFile(FILES.preview, out.preview),
  ]);
  console.log(`${set}: atlas ${out.json.hash} · ${out.stats} · ${Math.round(performance.now() - t0)} ms`);
  for (const f of Object.values(FILES)) console.log(`  wrote ${rel(f)}`);
}

async function check(set) {
  const out = await build(set);
  const FILES = setDirs(set).files;
  const current = await readFile(FILES.json, 'utf8').then(JSON.parse, () => null);
  const js = await readFile(FILES.js, 'utf8').catch(() => '');
  if (current?.hash !== out.json.hash || !js.includes(`"hash":"${out.json.hash}"`)) {
    console.error(`${set}: atlas is stale (committed ${current?.hash ?? 'none'}, sources ${out.json.hash}) — run npm run sprites`);
    return false;
  }
  console.log(`${set}: atlas ${out.json.hash} is up to date · ${out.stats}`);
  return true;
}

const argv = process.argv.slice(2);
const args = new Set(argv.filter((a) => a.startsWith('--')));
const known = await allSets();
const named = argv.filter((a) => !a.startsWith('--'));
const unknown = named.filter((s) => !known.includes(s));
if (unknown.length) {
  console.error(`unknown sprite set ${unknown.join(', ')} (have ${known.join(', ')})`);
  process.exit(1);
}
const sets = named.length ? named : known;
try {
  if (args.has('--check')) {
    let ok = true;
    for (const set of sets) ok = (await check(set)) && ok;
    if (!ok) process.exit(1);
  } else for (const set of sets) await write(set);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

if (args.has('--watch')) {
  for (const set of sets) {
    let timer = null;
    const { src } = setDirs(set);
    watch(src, { recursive: true }, (_, file) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        console.log(`\n${set}: ${file ?? 'source'} changed`);
        write(set).catch((e) => console.error(e.message));
      }, 120);
    });
    console.log(`watching ${rel(src)} …`);
  }
}
