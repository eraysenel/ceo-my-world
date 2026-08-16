// Yayın yapılandırmasını gerçekten sürer.
//
// Katı bir CSP'nin en sinsi tarafı, yalnızca canlıda bozulmasıdır: yerelde
// `file://` ile açılan panel başlıkları hiç görmez, her şey yolunda görünür,
// sonra Netlify'da beyaz sayfa gelir. Bu yüzden burada `dist/_headers`
// okunuyor, panel **tam o başlıklarla** servis ediliyor ve tarayıcıda uçtan
// uca çalıştırılıyor. Ayrıca üretilen başlıklar kendi güvenlik kurallarımızdan
// geçiriliyor: güvenlik başlıklarını denetleyen bir aracın kendi yayını o
// denetimden kalıyorsa, tavsiye ettiğimiz şeye kendimiz uymuyoruz demektir.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

import { registry } from '../rules/index.mjs';
import { runRules } from '../lib/engine.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..', '..', '..', '..');
const DIST = path.join(here, '..', '..', 'panel', 'dist');
const FIXTURE = path.join(here, 'fixtures', 'site', 'hizmetler.html');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

let browser;
let server;
let origin;
let headerPairs;

async function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const candidates = [
    process.env.CHROMIUM_PATH,
    base && path.join(base, 'chromium-1194', 'chrome-linux', 'chrome'),
    base && path.join(base, 'chromium', 'chrome-linux', 'chrome'),
    '/usr/bin/chromium', '/usr/bin/google-chrome'
  ].filter(Boolean);
  for (const c of candidates) {
    try { await access(c); return c; } catch { /* sıradaki */ }
  }
  try { return chromium.executablePath(); } catch { return null; }
}

/** `_headers` dosyasının `/*` bloğunu ad/değer çiftlerine ayırır. */
function parseHeaders(text) {
  const pairs = [];
  let inGlob = false;
  for (const line of text.split('\n')) {
    if (/^\S/.test(line)) { inGlob = line.trim() === '/*'; continue; }
    if (!inGlob) continue;
    const m = /^\s+([A-Za-z-]+):\s*(.+?)\s*$/.exec(line);
    if (m) pairs.push([m[1], m[2]]);
  }
  return pairs;
}

before(async () => {
  headerPairs = parseHeaders(await readFile(path.join(DIST, '_headers'), 'utf8'));

  const exe = await findChromium();
  if (exe) {
    try { browser = await chromium.launch({ executablePath: exe }); } catch { browser = null; }
  }

  server = createServer(async (req, res) => {
    const rel = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    let file;
    try {
      file = await readFile(path.join(DIST, path.basename(rel)));
    } catch {
      res.writeHead(404).end('yok');
      return;
    }
    const head = { 'content-type': TYPES[path.extname(rel)] ?? 'application/octet-stream' };
    for (const [k, v] of headerPairs) head[k] = v;
    res.writeHead(200, head);
    res.end(file);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
});

test('netlify.toml yayın yolu gerçekten var ve panel içeriyor', async () => {
  const toml = await readFile(path.join(ROOT, 'netlify.toml'), 'utf8');
  const publish = /publish\s*=\s*"([^"]+)"/.exec(toml)?.[1];
  assert.ok(publish, 'publish yolu tanımlı olmalı');
  await access(path.join(ROOT, publish, 'index.html'));
});

test('üretilen başlıklar kendi güvenlik kurallarımızdan geçiyor', () => {
  // Yayınladığımız başlıkları, denetlediğimiz sitelere uyguladığımız
  // kuralların aynısından geçiriyoruz.
  const headers = Object.fromEntries(headerPairs.map(([k, v]) => [k.toLowerCase(), v]));
  const page = {
    url: 'https://ornek.com/', status: 200, headers,
    html: '', links: [], images: [], scripts: []
  };
  const site = {
    origin: 'https://ornek.com',
    pages: new Map([[page.url, page]]),
    capabilities: { headers: true }
  };

  const securityRules = registry.all.filter((r) => r.category === 'security');
  const { findings } = runRules(site, { all: securityRules });

  assert.deepEqual(findings.map((f) => f.id), [],
    `kendi yayınımız kendi denetimimizden kalıyor: ${findings.map((f) => f.id).join(', ')}`);
});

test('CSP satır içi kodu unsafe-inline olmadan çalıştırıyor', async (t) => {
  if (!browser) { t.skip('Chromium bulunamadı'); return; }
  const csp = headerPairs.find(([k]) => k.toLowerCase() === 'content-security-policy')?.[1] ?? '';
  assert.ok(!/unsafe-inline|unsafe-eval/.test(csp), 'özet kullanıldığı için gevşetmeye gerek yok');
  assert.match(csp, /script-src 'sha256-[^']+' 'sha256-[^']+'/, 'iki betik bloğu da beyaz listede olmalı');

  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`${origin}/`);

  // CSP betikleri engelleseydi motor hiç yüklenmez, etiket "—" kalırdı.
  assert.match(await page.textContent('#engineTag'), /^\d+ kural$/);

  // Ve denetim gerçekten koşmalı — yalnızca yüklenmesi yetmez.
  await page.fill('#u1', 'https://ornek.test/hizmetler');
  await page.fill('#h1', await readFile(FIXTURE, 'utf8'));
  await page.click('#run');
  await page.waitForSelector('#results:not([hidden]) .summary');
  assert.match((await page.textContent('.score-num')).trim(), /^\d+$/);

  assert.deepEqual(errors, [], 'CSP altında konsolda hata olmamalı');
  await page.close();
});

test('gerçek adreste yer imi tek-tık kipinde üretiliyor', async (t) => {
  if (!browser) { t.skip('Chromium bulunamadı'); return; }
  // Yayının asıl kazancı bu: panel kendi adresinde, en üst seviyede
  // çalıştığında `location.href` kullanıcının açabileceği bir adres olur.
  const page = await browser.newPage();
  await page.goto(`${origin}/`);
  const body = decodeURIComponent((await page.getAttribute('#bmk', 'href')).slice('javascript:'.length));
  assert.match(body, /CompressionStream/, 'yayında pano kipine düşmemeli');
  assert.ok(body.includes(origin), 'yer imi yayın adresine dönmeli');
  assert.equal(await page.textContent('#intakeStatus'), '', 'kip uyarısı çıkmamalı');
  await page.close();
});
