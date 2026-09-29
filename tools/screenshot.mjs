// Captures screenshots of every study into screenshots/.
//
//   npm run shots          capture everything
//   npm run shots -- reef  capture only studies whose name contains "reef"
//
// Pages are served over a local HTTP server because cosmic-filament.html loads
// an ES module, which file:// URLs block. WebGL runs on SwiftShader so captures
// work headless without a GPU.
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'screenshots');
const VIEWPORT = { width: 1400, height: 900 };
const UI_IDS = ['ui', 'ui-toggle', 'legend', 'hint'];
const THREE_CDN = /^https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/]+\//;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
};

const STUDIES = [
  { name: 'index', page: 'index.html', settle: 2500 },
  { name: 'aqua-16bit', page: 'aqua-16bit.html', settle: 2500 },
  { name: 'caustic-hdr', page: 'caustic-hdr.html', settle: 2500 },
  { name: 'cosmic-filament', page: 'cosmic-filament.html', settle: 3000 },
  { name: 'constellation-caustic', page: 'constellation-caustic.html', settle: 2500 },
  {
    name: 'nine-cosmic-webs',
    page: 'nine-cosmic-webs.html?capture=1',
    settle: 800,
    viewport: { width: 1400, height: 2000 },
    fullPage: true,
    readySelector: 'canvas[data-ready="1"]',
    readyCount: 9,
  },
  {
    name: 'nautilus-agents',
    // fast-forward to the moment the kraken (a failing test) has hold of hull/plates.js
    page: 'nautilus-agents.html?at=62',
    settle: 600,
    readySelector: 'body[data-ready="1"]',
  },
  {
    name: 'nautilus-os',
    // fast-forward to the build phase: Ned writing code, Cyrus training
    page: 'nautilus-os.html?at=40',
    settle: 900,
    viewport: { width: 1700, height: 1000 },
    readySelector: 'body[data-ready="1"]',
  },
  // the four NEON variants: side-on and 3D, each in high fidelity and in pixels
  ...['neon-2d', 'neon-2d-pixel', 'neon-3d', 'neon-3d-pixel'].map((name) => ({
    name,
    page: `${name}.html?at=40`,
    settle: name.includes('3d') ? 2500 : 900,
    viewport: { width: 1700, height: 1000 },
    readySelector: 'body[data-ready="1"]',
  })),
  {
    name: 'hortus-os',
    // the build phase of the Pollinator Census: Dickon coding, Martha training
    page: 'hortus-os.html?at=40',
    settle: 900,
    viewport: { width: 1700, height: 1000 },
    readySelector: 'body[data-ready="1"]',
  },
  {
    name: 'neon-os',
    // the build phase of the Night Market Translator: Juno coding, Rook training
    page: 'neon-os.html?at=40',
    settle: 900,
    viewport: { width: 1700, height: 1000 },
    readySelector: 'body[data-ready="1"]',
  },
  { name: 'reef-islands', page: 'reef-islands.html', settle: 2000 },
  {
    name: 'reef-islands-volcanic',
    page: 'reef-islands.html',
    settle: 1600,
    config: { archetype: 'volcanic', island_count: 4, seed: 77 },
  },
  {
    name: 'reef-islands-roundreef',
    page: 'reef-islands.html',
    settle: 1600,
    config: { archetype: 'round_reef', island_count: 6, seed: 2024, prop_density: 1.1 },
  },
];

function startServer() {
  const server = createServer(async (req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^([\\/.])+/, ''));
    try {
      const body = await readFile(filePath);
      const type = MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
      res.writeHead(200, { 'content-type': type });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function captureStudy(browser, baseUrl, study) {
  const ctx = await browser.newContext({
    viewport: study.viewport ?? VIEWPORT,
    deviceScaleFactor: 1,
  });
  // neon-3d*.html import three.js from the CDN: serve it from node_modules when installed
  await ctx.route(THREE_CDN, async (route) => {
    const rel = route.request().url().replace(THREE_CDN, '');
    try {
      const body = await readFile(path.join(ROOT, 'node_modules/three', rel));
      await route.fulfill({ body, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' } });
    } catch {
      await route.continue();
    }
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${study.name}] pageerror:`, e.message));

  await page.goto(`${baseUrl}/${study.page}`, { waitUntil: 'load' });
  await page.evaluate((ids) => {
    for (const id of ids) document.getElementById(id)?.style.setProperty('display', 'none');
  }, UI_IDS);

  if (study.readySelector) {
    await page
      .waitForFunction(
        ({ sel, count }) => document.querySelectorAll(sel).length >= count,
        { sel: study.readySelector, count: study.readyCount ?? 1 },
        { timeout: 20000 },
      )
      .catch(() => console.log(`[${study.name}] ready-wait timed out, capturing anyway`));
  }
  if (study.config) {
    await page.evaluate((cfg) => {
      Object.assign(window.App.config, cfg);
      window.generate();
    }, study.config);
  }
  await page.waitForTimeout(study.settle);

  const outPath = path.join(OUT_DIR, `${study.name}.png`);
  await page.screenshot({ path: outPath, fullPage: study.fullPage ?? false });
  console.log(`saved screenshots/${study.name}.png`);
  await ctx.close();
}

const filters = process.argv.slice(2);
const selected = filters.length
  ? STUDIES.filter((s) => filters.some((f) => s.name.includes(f)))
  : STUDIES;
if (!selected.length) {
  console.error(`no study matches ${filters.join(', ')}`);
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });
const server = await startServer();
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
  ],
});

try {
  for (const study of selected) await captureStudy(browser, baseUrl, study);
} finally {
  await browser.close();
  server.close();
}
console.log('done');
