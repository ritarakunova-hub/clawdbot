// Покадровый рендер film.html. Использование:
//   node render.mjs frames <outDir> [fps]        — все кадры ролика
//   node render.mjs stills <outDir> t1 t2 ...    — отдельные кадры
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const [mode, out, ...rest] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
// playwright берётся из глобальной установки (npm i -g playwright)
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const here = path.dirname(fileURLToPath(import.meta.url));
// Локальный http-сервер: с file:// Chromium не отдаёт шрифты (CORS)
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  try {
    const f = path.join(here, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(here)) throw new Error('outside');
    const body = readFileSync(f);
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
if (process.env.DEBUG) page.on('requestfailed', r => console.log('FAIL', r.url(), r.failure()?.errorText)).on('response', r => console.log(r.status(), r.url()));
await page.goto(`http://127.0.0.1:${port}/film.html`);
await page.evaluate(() => window.ready);
const film = await page.evaluate(() => window.FILM || { w: 1920, h: 1080, dur: 30 });
await page.setViewportSize({ width: film.w, height: film.h });
const canvas = page.locator('canvas');
const shot = async (t, file) => {
  await page.evaluate(t => window.render(t), t);
  await canvas.screenshot({ path: file, type: 'jpeg', quality: 94 });
};
if (mode === 'stills') {
  for (const t of rest) await shot(parseFloat(t), path.join(out, `t${t}.jpg`));
} else {
  const fps = parseInt(rest[0] || '30', 10), n = fps * film.dur;
  for (let i = 0; i < n; i++) {
    await shot(i / fps, path.join(out, String(i).padStart(4, '0') + '.jpg'));
    if (i % 150 === 0) console.log(`frame ${i}/${n}`);
  }
}
await browser.close();
server.close();
