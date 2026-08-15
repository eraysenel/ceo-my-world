// Uçtan uca test: fixture mini sitesi üzerinde tam denetim akışı.
// Ağ gerektirmez — çevrimdışı modun gerçekten çalıştığının kanıtı budur.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDirectory } from '../lib/sources.mjs';
import { registry } from '../rules/index.mjs';
import { runRules, computeScores, prioritize } from '../lib/engine.mjs';
import { buildAuditJson, buildMarkdown, buildHtml } from '../lib/report.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(here, 'fixtures', 'site');
const BASE = 'https://ornek.test';

async function audit() {
  const site = await loadDirectory(FIXTURE_DIR, BASE);
  const { findings, applicability, ruleErrors } = runRules(site, registry, { config: {} });
  const scores = computeScores(findings, applicability, registry);
  const actions = prioritize(findings, applicability);
  const json = buildAuditJson({
    site, scores, findings, actions, applicability, registry,
    run: {
      startedAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:00:01.000Z',
      durationMs: 1000, mode: 'dir', command: 'test', options: {}, ruleErrors
    }
  });
  return { site, findings, actions, scores, json, ruleErrors };
}

test('e2e: fixture sitesi ağ olmadan denetlenir', async () => {
  const { site, json } = await audit();
  assert.equal(site.pages.size, 5);
  assert.equal(json.site.origin, BASE);
  assert.equal(json.run.capabilities.net, false);
});

test('e2e: hiçbir kural çalışırken hata vermez', async () => {
  const { ruleErrors } = await audit();
  assert.deepEqual(ruleErrors, [], `kural hataları: ${JSON.stringify(ruleErrors)}`);
});

test('e2e: fixture\'lara gömülen sorunların hepsi yakalanır', async () => {
  const { findings } = await audit();
  const ids = new Set(findings.map((f) => f.id));

  // Her biri belirli bir fixture dosyasına bilinçli olarak yerleştirildi.
  const beklenen = [
    'turkish-mojibake',            // iletisim.html
    'charset-declaration-late',    // iletisim.html
    'lang-attribute-mismatch',     // iletisim.html (lang="en", içerik Türkçe)
    'title-pixel-width',           // hizmetler/dublaj.html (çok uzun başlık)
    'title-duplicate',             // hizmetler.html + kopya.html
    'duplicate-content-cluster',   // hizmetler.html + kopya.html
    'orphan-page',                 // kopya.html (hiç iç bağlantı almıyor)
    'h1-missing',                  // hizmetler/dublaj.html
    'h1-count',                    // hizmetler.html (iki H1)
    'heading-hierarchy-skip',      // hizmetler.html (h1 -> h4)
    'img-missing-alt',             // hizmetler.html
    'img-missing-dimensions',
    'img-filename-quality',        // IMG_2043.jpg ve Türkçe karakterli dosya adı
    'img-alt-quality',             // kelime tekrarı
    'audio-missing-transcript',    // hizmetler/dublaj.html
    'mixed-content',               // hizmetler/dublaj.html (http:// görsel)
    'lcp-candidate-lazy',
    'render-blocking-js',
    'anchor-text-generic',         // "buraya tıklayın"
    'target-blank-no-noopener',
    'canonical-missing',
    'jsonld-missing',
    'og-missing'
  ];

  const eksik = beklenen.filter((id) => !ids.has(id));
  assert.deepEqual(eksik, [], `yakalanmayan kurallar: ${eksik.join(', ')}`);
});

test('e2e: sağlıklı ana sayfa gereksiz bulgu üretmez', async () => {
  const { findings } = await audit();
  const home = findings.filter((f) => f.page === 'https://ornek.test/');
  const beklenmeyen = home.filter((f) =>
    ['title-missing', 'h1-missing', 'img-missing-alt', 'og-missing',
      'turkish-mojibake', 'canonical-missing', 'viewport-meta-missing',
      'lang-attribute-missing', 'jsonld-missing'].includes(f.id));
  assert.deepEqual(beklenmeyen.map((f) => f.id), [],
    'düzgün kurulmuş ana sayfada bu bulgular çıkmamalıydı');
});

test('e2e: skorlar hesaplanır ve kritik bulgu hükmü belirler', async () => {
  const { scores, findings } = await audit();
  assert.ok(scores.overall > 0 && scores.overall <= 100);
  assert.ok(findings.some((f) => f.severity === 'critical'));
  assert.equal(scores.verdict, 'kritik', 'kritik bulgu varsa hüküm kritik olmalı');
});

test('e2e: kritik bulgu skordan bağımsız olarak P0\'a sabitlenir', async () => {
  const { actions } = await audit();
  const kritikler = actions.filter((a) => a.severity === 'critical');
  assert.ok(kritikler.length > 0);
  for (const a of kritikler) assert.equal(a.priority, 'P0', `${a.id} P0 olmalıydı`);
});

test('e2e: çevrimdışı modda ağ gerektiren kurallar paydaya girmez', async () => {
  const { json } = await audit();
  // net gerektiren kurallar hiç değerlendirilmemiş olmalı.
  const netRules = registry.all.filter((r) => r.needs.includes('net')).map((r) => r.id);
  for (const id of netRules) {
    assert.equal(json.applicability[id], undefined,
      `${id} ağ gerektirdiği hâlde çevrimdışı koşuda değerlendirilmiş`);
  }
  // Buna karşılık kategorilerin çoğu yine de puanlanabilmeli.
  const puanlanan = Object.values(json.scores.categories).filter((c) => c.score !== null);
  assert.ok(puanlanan.length >= 6, 'çevrimdışı modda en az 6 kategori puanlanabilmeli');
});

test('e2e: rapor çevrimdışı uyarısını gizlemez', async () => {
  const { json, site, findings, actions } = await audit();
  const md = buildMarkdown(json, { site, findings, actions });
  assert.match(md, /Çevrimdışı mod/);
  assert.match(md, /JavaScript çalıştırılmadı/);
  assert.match(md, /Core Web Vitals ölçülmedi/);
});

test('e2e: HTML raporu kendi kendine yeter (dış kaynak yok)', async () => {
  const { json, site, actions } = await audit();
  const html = buildHtml(json, { site, actions });
  assert.match(html, /<html lang="tr">/);
  assert.doesNotMatch(html, /<script\s+src=/i);
  assert.doesNotMatch(html, /<link[^>]+stylesheet/i);
  assert.match(html, /prefers-color-scheme: dark/);
});

test('e2e: audit.json deterministik (aynı girdi, aynı çıktı)', async () => {
  const a = await audit();
  const b = await audit();
  const strip = (j) => JSON.stringify({ ...j, run: null, tool: null });
  assert.equal(strip(a.json), strip(b.json));
});

test('e2e: sayfa sayısı skoru sürüklemez', async () => {
  // Aynı sitenin bir alt kümesi ile tamamı benzer skor vermeli; ceza mutlak
  // sayıya değil, etkilenen sayfa ORANINA bağlı olduğu için.
  const { scores: tam } = await audit();
  const site = await loadDirectory(FIXTURE_DIR, BASE);
  for (const key of [...site.pages.keys()].slice(3)) site.pages.delete(key);
  const { findings, applicability } = runRules(site, registry, { config: {} });
  const kismi = computeScores(findings, applicability, registry);
  assert.ok(Math.abs(tam.overall - kismi.overall) < 25,
    `skor sayfa sayısına aşırı duyarlı: tam ${tam.overall} / kısmi ${kismi.overall}`);
});
