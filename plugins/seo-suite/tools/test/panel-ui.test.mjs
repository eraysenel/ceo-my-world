// Panelin kendisini gerçek tarayıcıda uçtan uca sürer.
//
// `panel.test.mjs` motorun tarayıcıda doğru çalıştığını doğrular; bu dosya
// arayüzün gerçekten kullanılabildiğini: kaynak yapıştırılıyor mu, düğme
// çalışıyor mu, sonuçlar basılıyor mu, tema token'ları her iki temada da
// okunabilir renk veriyor mu.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const PANEL = path.join(here, '..', '..', 'panel', 'dist', 'index.html');
const FIXTURE = path.join(here, 'fixtures', 'site', 'hizmetler.html');

let browser;

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

before(async () => {
  const exe = await findChromium();
  if (!exe) return;
  try { browser = await chromium.launch({ executablePath: exe }); } catch { browser = null; }
});
after(async () => { await browser?.close(); });

function guard(t) {
  if (!browser) { t.skip('Chromium bulunamadı — panel arayüzü doğrulanamadı'); return true; }
  return false;
}

/** Paneli açar, konsol hatalarını toplar. */
async function openPanel(colorScheme = 'light') {
  const page = await browser.newPage({ colorScheme });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`file://${PANEL}`);
  return { page, errors };
}

test('panel hatasız yükleniyor ve motoru bildiriyor', async (t) => {
  if (guard(t)) return;
  const { page, errors } = await openPanel();
  const tag = await page.textContent('#engineTag');
  assert.match(tag, /^\d+ kural$/, `motor etiketi: ${tag}`);
  const foot = await page.textContent('#footEngine');
  assert.match(foot, /katalog [0-9a-f]{16}/, 'katalog parmak izi basılmalı');
  assert.deepEqual(errors, [], 'konsolda hata olmamalı');
  await page.close();
});

test('kaynak yapıştırılınca denetim çalışıyor ve sonuç basılıyor', async (t) => {
  if (guard(t)) return;
  const { page, errors } = await openPanel();
  const html = await readFile(FIXTURE, 'utf8');

  await page.fill('#u1', 'https://ornek.test/hizmetler');
  await page.fill('#h1', html);
  assert.equal(await page.isDisabled('#run'), false, 'kaynak girilince düğme açılmalı');

  await page.click('#run');
  await page.waitForSelector('#results:not([hidden]) .summary');

  const score = (await page.textContent('.score-num')).trim();
  assert.match(score, /^\d+$/, `skor sayısal olmalı: ${score}`);

  const findings = await page.$$('.finding');
  assert.ok(findings.length > 0, 'sorunlu fixture bulgu üretmeli');

  // Fixture'a bilinçli konulan sorunlar arayüzde görünmeli.
  const ids = await page.$$eval('.f-id', (els) => els.map((e) => e.textContent));
  for (const expected of ['h1-count', 'img-missing-alt', 'meta-description-missing']) {
    assert.ok(ids.includes(expected), `${expected} listede olmalı — gelen: ${ids.join(', ')}`);
  }

  // Dürüstlük şeridi görünmeli.
  const notice = await page.textContent('.notice-strip');
  assert.match(notice, /Yanıt başlıkları yok/);

  assert.deepEqual(errors, [], 'konsolda hata olmamalı');
  await page.close();
});

test('geçersiz girdi arayüzü çökertmiyor, hatayı gösteriyor', async (t) => {
  if (guard(t)) return;
  const { page } = await openPanel();
  await page.fill('#u1', 'bu-url-degil');
  await page.fill('#h1', '<html><body>x</body></html>');
  await page.click('#run');
  const msg = await page.textContent('#error');
  assert.match(msg, /Denetim yapılamadı/);
  assert.equal(await page.isVisible('#results'), false, 'hata durumunda sonuç gösterilmemeli');
  await page.close();
});

test('her iki temada da metin zeminden ayrışıyor', async (t) => {
  if (guard(t)) return;
  // Bu testin sebebi: token'ı yalnızca media/[data-theme] içinde tanımlamak
  // damgasız (sistem) durumda rengi hiç uygulatmaz ve sayfa bir temanın
  // metnini diğerinin zemininde gösterir.
  for (const scheme of ['light', 'dark']) {
    const { page } = await openPanel(scheme);
    const { bg, fg } = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return { bg: s.backgroundColor, fg: s.color };
    });
    assert.notEqual(bg, 'rgba(0, 0, 0, 0)', `${scheme}: body arka planı şeffaf olmamalı`);
    assert.notEqual(bg, fg, `${scheme}: metin ve zemin aynı renk olmamalı`);

    const lum = (c) => {
      const [r, g, b] = c.match(/\d+/g).map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    };
    assert.ok(Math.abs(lum(bg) - lum(fg)) > 0.4,
      `${scheme}: metin/zemin parlaklık farkı yetersiz (${bg} / ${fg})`);
    await page.close();
  }
});

test('sayfa yatay kaymıyor', async (t) => {
  if (guard(t)) return;
  const { page } = await openPanel();
  await page.setViewportSize({ width: 380, height: 800 });
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `dar ekranda yatay taşma var: ${overflow}px`);
  await page.close();
});
