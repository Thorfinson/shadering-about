// Captures screenshots of every study into screenshots/.
//
//   npm run shots             capture everything
//   npm run shots -- islands  capture only studies whose name contains "islands"
//
// Pages are served over a local HTTP server because cosmic.html loads an ES
// module, which file:// URLs block. WebGL runs on SwiftShader so captures
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

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
};

const STUDIES = [
  { name: 'index', page: 'index.html', settle: 2500 },
  { name: 'aqua', page: 'aqua.html', settle: 2500 },
  { name: 'colors', page: 'colors.html', settle: 2500 },
  { name: 'cosmic', page: 'cosmic.html', settle: 3000 },
  { name: 'poc', page: 'poc.html', settle: 2500 },
  {
    name: 'nine',
    page: 'nine.html?capture=1',
    settle: 800,
    viewport: { width: 1400, height: 2000 },
    fullPage: true,
    readySelector: 'canvas[data-ready="1"]',
    readyCount: 9,
  },
  { name: 'islands', page: 'islands.html', settle: 2000 },
  {
    name: 'islands-volcanic',
    page: 'islands.html',
    settle: 1600,
    config: { archetype: 'volcanic', island_count: 4, seed: 77 },
  },
  {
    name: 'islands-roundreef',
    page: 'islands.html',
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
