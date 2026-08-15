// Tarayıcı paketinin gerçek bir tarayıcıda çalıştığını ve CLI ile AYNI
// sonucu ürettiğini doğrular.
//
// Bu testin varlık sebebi: panel ile CLI arasında sessiz bir sapma oluşursa
// kullanıcıya iki farklı "gerçek" sunmuş oluruz. Aynı fixture'lar her iki
// yoldan geçirilip skorlar karşılaştırılır.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

import { loadDirectory } from '../lib/sources.mjs';
import { registry } from '../rules/index.mjs';
import { runRules, computeScores } from '../lib/engine.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE = path.join(here, '..', '..', 'panel', 'dist', 'seo-audit.bundle.js');
const FIXTURES = path.join(here, 'fixtures', 'site');
const BASE = 'https://ornek.test';

let browser;
let page;

/**
 * Chromium'u bulur. Bulunamazsa testler atlanır — bu depo tarayıcısı olmayan
 * makinelerde de klonlanıp `npm test` çalıştırılabilmeli; eksik tarayıcı bir
 * kural hatası değildir ve testi kırmızıya çevirmesi yanıltıcı olur.
 */
async function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const candidates = [
    process.env.CHROMIUM_PATH,
    base && path.join(base, 'chromium', 'chrome-linux', 'chrome'),
    base && path.join(base, 'chromium-1194', 'chrome-linux', 'chrome'),
    base && path.join(base, 'chromium_headless_shell-1194', 'chrome-linux', 'headless_shell'),
    '/usr/bin/chromium', '/usr/bin/google-chrome'
  ].filter(Boolean);
  for (const c of candidates) {
    try { await access(c); return c; } catch { /* sıradaki */ }
  }
  // Playwright kendi çözümlemesini denesin
  try { return chromium.executablePath(); } catch { return null; }
}

before(async () => {
  const exe = await findChromium();
  if (!exe) return;
  try {
    browser = await chromium.launch({ executablePath: exe });
  } catch {
    browser = null;
    return;
  }
  page = await browser.newPage();
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
  await page.addScriptTag({ path: BUNDLE });
});

after(async () => { await browser?.close(); });

/** Tarayıcı yoksa testi atla (ve atlandığını görünür kıl). */
function needsBrowser(t) {
  if (!page) {
    t.skip('Chromium bulunamadı — panel paketi doğrulanamadı');
    return true;
  }
  return false;
}

/** Fixture mini sitesini {url, html} listesine çevirir (dir adaptörüyle aynı eşleme). */
async function fixturePages(dir = FIXTURES, prefix = '') {
  const out = [];
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...await fixturePages(full, `${prefix}${entry.name}/`));
    } else if (/\.html?$/i.test(entry.name)) {
      const slug = `${prefix}${entry.name}`.replace(/index\.html?$/i, '').replace(/\.html?$/i, '');
      out.push({ url: new URL(`/${slug}`, BASE).toString(), html: await readFile(full, 'utf8') });
    }
  }
  return out;
}

test('paket tarayıcıda yükleniyor ve API açıyor', async (t) => {
  if (needsBrowser(t)) return;
  const api = await page.evaluate(() => Object.keys(window.SeoAudit ?? {}).sort());
  assert.ok(api.includes('analyze'), `analyze yok: ${api.join(', ')}`);
  assert.ok(api.includes('labels'));
  assert.ok(api.includes('ruleCount'));
});

test('paketteki kural sayısı CLI ile aynı', async (t) => {
  if (needsBrowser(t)) return;
  const inBrowser = await page.evaluate(() => window.SeoAudit.ruleCount);
  assert.equal(inBrowser, registry.all.length);
});

test('panel ve CLI aynı girdide aynı skoru veriyor', async (t) => {
  if (needsBrowser(t)) return;
  const pages = await fixturePages();
  assert.ok(pages.length >= 4, 'fixture sitesi okunmalı');

  const fromBrowser = await page.evaluate((p) => {
    const r = window.SeoAudit.analyze({ pages: p });
    return {
      overall: r.scores.overall,
      verdict: r.scores.verdict,
      findings: r.findings.length,
      ids: [...new Set(r.findings.map((f) => f.id))].sort()
    };
  }, pages);

  // CLI tarafı: aynı fixture'lar dizin adaptörüyle
  const site = await loadDirectory(FIXTURES, BASE);
  const { findings, applicability } = runRules(site, registry, { config: {} });
  const scores = computeScores(findings, applicability, registry);
  const cliIds = [...new Set(findings.map((f) => f.id))].sort();

  assert.equal(fromBrowser.overall, scores.overall, 'genel skor CLI ile aynı olmalı');
  assert.equal(fromBrowser.verdict, scores.verdict, 'hüküm CLI ile aynı olmalı');
  assert.deepEqual(fromBrowser.ids, cliIds, 'tetiklenen kural kimlikleri CLI ile aynı olmalı');
  assert.equal(fromBrowser.findings, findings.length, 'bulgu sayısı CLI ile aynı olmalı');
});

test('Türkçe metin katmanı tarayıcıda da doğru çalışıyor', async (t) => {
  if (needsBrowser(t)) return;
  // İ/ı dönüşümü ve mojibake tespiti panelin en kritik Türkçe davranışı.
  const r = await page.evaluate(() => {
    const html = (title, body) =>
      `<!doctype html><html lang="tr"><head><meta charset="utf-8">`
      + `<meta name="viewport" content="width=device-width"><title>${title}</title></head>`
      + `<body><main><h1>Baş</h1>${body}</main></body></html>`;
    const res = window.SeoAudit.analyze({
      pages: [
        { url: 'https://ornek.test/a', html: html('DUBLAJ Hizmeti', '<p>x</p>') },
        { url: 'https://ornek.test/b', html: html('dublaj hizmeti', '<p>StÃ¼dyomuz Ä°stanbul KadÄ±kÃ¶y Ã‡alÄ±ÅŸma</p>') }
      ]
    });
    return [...new Set(res.findings.map((f) => f.id))];
  });

  assert.ok(r.includes('title-duplicate'), 'DUBLAJ ile dublaj aynı başlık sayılmalı (tr harmanlama)');
  assert.ok(r.includes('turkish-mojibake'), 'mojibake tarayıcıda da yakalanmalı');
});

test('geçersiz adres analizi çökertmez', async (t) => {
  if (needsBrowser(t)) return;
  const r = await page.evaluate(() => {
    try {
      window.SeoAudit.analyze({ pages: [{ url: 'bu-bir-url-degil', html: '<html></html>' }] });
      return 'hata-yok';
    } catch (e) {
      return e.message;
    }
  });
  assert.match(r, /Geçersiz adres/);
});
