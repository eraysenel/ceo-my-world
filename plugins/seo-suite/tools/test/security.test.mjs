// Güvenlik başlığı kuralları + rapor enjeksiyon regresyonu.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import security from '../rules/security.mjs';
import { doc, page, site, runRule, byId } from './helpers.mjs';
import { registry } from '../rules/index.mjs';
import { runRules, computeScores } from '../lib/engine.mjs';
import { buildAuditJson, buildMarkdown, buildHtml } from '../lib/report.mjs';
import { CATEGORY_WEIGHT, SEO_CATEGORIES } from '../lib/rules.mjs';

const HTTPS = 'https://ornek.test/sayfa';

/** Tam donanımlı, güvenli başlık kümesi — negatif kontrollerin temeli. */
const GUVENLI = {
  'content-type': 'text/html; charset=utf-8',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'content-security-policy': "default-src 'self'; script-src 'self'; frame-ancestors 'self'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=()'
};

const sayfa = (headers) => page(doc('<h1>a</h1>'), { url: HTTPS, headers });

test('hsts-missing: HSTS yoksa bulgu, varsa temiz', () => {
  const rule = byId(security, 'hsts-missing');
  const { 'strict-transport-security': _, ...hstsSiz } = GUVENLI;
  assert.equal(runRule(rule, sayfa(hstsSiz)).findings.length, 1);
  assert.equal(runRule(rule, sayfa(GUVENLI)).findings.length, 0);
});

test('hsts-missing: http sayfada uygulanmaz', () => {
  const rule = byId(security, 'hsts-missing');
  const http = page(doc('<h1>a</h1>'), { url: 'http://ornek.test/a', headers: { 'content-type': 'text/html' } });
  assert.equal(runRule(rule, http).applicable, false);
});

test('hsts-weak: kısa max-age yakalanır', () => {
  const rule = byId(security, 'hsts-weak');
  const kisa = sayfa({ ...GUVENLI, 'strict-transport-security': 'max-age=86400' });
  const r = runRule(rule, kisa);
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].evidence.maxAge, 86400);
  assert.equal(runRule(rule, sayfa(GUVENLI)).findings.length, 0);
});

test('csp-missing / csp-unsafe: eksik ve zayıf CSP', () => {
  const missing = byId(security, 'csp-missing');
  const unsafe = byId(security, 'csp-unsafe');
  const { 'content-security-policy': _, ...cspSiz } = GUVENLI;

  assert.equal(runRule(missing, sayfa(cspSiz)).findings.length, 1);
  assert.equal(runRule(missing, sayfa(GUVENLI)).findings.length, 0);

  const zayif = sayfa({ ...GUVENLI, 'content-security-policy': "script-src 'self' 'unsafe-inline' 'unsafe-eval'" });
  const r = runRule(unsafe, zayif);
  assert.equal(r.findings.length, 1);
  assert.deepEqual(r.findings[0].evidence.directives, ["'unsafe-inline'", "'unsafe-eval'"]);
  assert.equal(runRule(unsafe, sayfa(GUVENLI)).findings.length, 0);
});

test('x-content-type-options-missing: nosniff kontrolü', () => {
  const rule = byId(security, 'x-content-type-options-missing');
  const { 'x-content-type-options': _, ...eksik } = GUVENLI;
  assert.equal(runRule(rule, sayfa(eksik)).findings.length, 1);
  assert.equal(runRule(rule, sayfa(GUVENLI)).findings.length, 0);
});

test('clickjacking-protection-missing: XFO veya frame-ancestors yeterli', () => {
  const rule = byId(security, 'clickjacking-protection-missing');
  const { 'content-security-policy': _, ...korumasiz } = GUVENLI;
  assert.equal(runRule(rule, sayfa(korumasiz)).findings.length, 1);

  // CSP frame-ancestors ile korunuyor
  assert.equal(runRule(rule, sayfa(GUVENLI)).findings.length, 0);
  // Eski yöntem X-Frame-Options da kabul edilir
  assert.equal(runRule(rule, sayfa({ ...korumasiz, 'x-frame-options': 'SAMEORIGIN' })).findings.length, 0);
});

test('referrer-policy-missing', () => {
  const rule = byId(security, 'referrer-policy-missing');
  const { 'referrer-policy': _, ...eksik } = GUVENLI;
  assert.equal(runRule(rule, sayfa(eksik)).findings.length, 1);
  assert.equal(runRule(rule, sayfa(GUVENLI)).findings.length, 0);
});

test('cookie-flags-weak: eksik bayraklar listelenir', () => {
  const rule = byId(security, 'cookie-flags-weak');
  const zayif = sayfa({ ...GUVENLI, 'set-cookie': 'oturum=abc123; Path=/' });
  const r = runRule(rule, zayif);
  assert.equal(r.findings.length, 1);
  assert.deepEqual(r.findings[0].evidence.missing, ['Secure', 'HttpOnly', 'SameSite']);

  const saglam = sayfa({ ...GUVENLI, 'set-cookie': 'oturum=abc123; Path=/; Secure; HttpOnly; SameSite=Lax' });
  assert.equal(runRule(rule, saglam).findings.length, 0);
});

test('server-version-disclosure: sürüm sızıntısı yakalanır, sürümsüz imza temiz', () => {
  const rule = byId(security, 'server-version-disclosure');
  const sizinti = sayfa({ ...GUVENLI, server: 'nginx/1.24.0', 'x-powered-by': 'PHP/8.2.1' });
  assert.equal(runRule(rule, sizinti).findings.length, 1);
  // Sürüm numarası olmayan imza bulgu değildir.
  assert.equal(runRule(rule, sayfa({ ...GUVENLI, server: 'cloudflare' })).findings.length, 0);
});

test('sri-missing: integrity olmayan üçüncü taraf betik', () => {
  const rule = byId(security, 'sri-missing');
  const korumasiz = page(doc('<p>x</p>', { head: '<script src="https://cdn.baska.test/a.js"></script>' }), { url: HTTPS });
  assert.equal(runRule(rule, korumasiz).findings.length, 1);

  const korumali = page(doc('<p>x</p>', {
    head: '<script src="https://cdn.baska.test/a.js" integrity="sha384-abc" crossorigin="anonymous"></script>'
  }), { url: HTTPS });
  assert.equal(runRule(rule, korumali).findings.length, 0);

  // Kendi alan adından gelen betik üçüncü taraf değildir.
  const kendi = page(doc('<p>x</p>', { head: '<script src="/a.js"></script>' }), { url: HTTPS });
  assert.equal(runRule(kendi === null ? rule : rule, kendi).applicable, false);
});

// --- Skorlama ayrımı ------------------------------------------------------

test('güvenlik skoru genel SEO skorunu kaydırmaz', () => {
  const temiz = page(doc('<h1>a</h1>', { head: '<title>Yeterince uzun bir başlık buraya yazıldı</title>' }),
    { url: HTTPS, headers: GUVENLI });
  const acikli = page(doc('<h1>a</h1>', { head: '<title>Yeterince uzun bir başlık buraya yazıldı</title>' }),
    { url: HTTPS, headers: { 'content-type': 'text/html; charset=utf-8' } });

  const skorla = (p) => {
    const s = site([p]);
    const { findings, applicability } = runRules(s, registry, { config: {} });
    return computeScores(findings, applicability, registry);
  };

  const a = skorla(temiz);
  const b = skorla(acikli);

  // Güvenlik skoru düşmeli...
  assert.ok(b.categories.security.score < a.categories.security.score,
    'güvenlik başlıkları eksikken güvenlik skoru düşmeliydi');
  // ...ama genel SEO skoru aynı kalmalı.
  assert.equal(a.overall, b.overall, 'güvenlik başlıkları genel SEO skorunu değiştirmemeli');
  assert.equal(CATEGORY_WEIGHT.security, 0);
  assert.ok(!SEO_CATEGORIES.includes('security'));
});

// --- Rapor enjeksiyon regresyonu -----------------------------------------

const KOTU_BASLIK = 'Ayni Baslik "><script>alert(1)</script>';

function kotuNiyetliSite() {
  const mk = (url) => page(doc(
    '<main><h1>Bas</h1><h2>iki</h2><h4>Atlanan "><svg onload=alert(1)> baslik</h4>'
    + '<a href="/x">buraya tıklayın "><script>alert(1)</script></a></main>',
    { head: `<title>${KOTU_BASLIK}</title>` }
  ), { url });

  const a = mk('https://kotu.test/a');
  const b = mk('https://kotu.test/b');
  const s = site([a, b], { origin: 'https://kotu.test', hosts: ['kotu.test'], registrableDomain: 'kotu.test' });
  s.clusters.duplicateTitles.set('ayni baslik', [a.normalizedUrl, b.normalizedUrl]);
  return s;
}

function raporlar() {
  const s = kotuNiyetliSite();
  const { findings, applicability, ruleErrors } = runRules(s, registry, { config: {} });
  const scores = computeScores(findings, applicability, registry);
  const actions = [...findings].map((f) => ({
    id: f.id, category: f.category, severity: f.severity, priority: 'P1',
    message: f.message, fix: f.fix, count: 1, samplePages: [f.page ?? 'https://kotu.test/a']
  }));
  const json = buildAuditJson({
    site: s, scores, findings, actions, applicability, registry,
    run: {
      startedAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:00:01.000Z',
      durationMs: 1, mode: 'dir', command: 'test', options: {}, ruleErrors
    }
  });
  return { s, json, findings, actions };
}

test('rapor: denetlenen sitenin metni Markdown\'a ham HTML olarak sızmaz', () => {
  // Bulgu mesajları taranan sayfanın başlığını taşır. Rapor bir md→html
  // dönüştürücüden geçirilirse (müşteriye sunum) o metin çalışabilir hâle gelir.
  const { s, json, findings, actions } = raporlar();
  const md = buildMarkdown(json, { site: s, findings, actions });

  assert.ok(md.includes('Ayni Baslik'), 'başlık rapora düşmeliydi (test anlamlı olsun diye)');
  assert.doesNotMatch(md, /<script>/i);
  assert.doesNotMatch(md, /onload\s*=/i);
  assert.doesNotMatch(md, /onerror\s*=/i);
  assert.match(md, /&lt;script&gt;/, 'kaçırılmış hâli görünmeli');
});

test('rapor: HTML çıktısı enjeksiyona kapalı', () => {
  const { s, json, actions } = raporlar();
  const html = buildHtml(json, { site: s, actions });

  assert.doesNotMatch(html, /<script>alert/i);
  assert.doesNotMatch(html, /onload\s*=\s*alert/i);
  assert.doesNotMatch(html, /onerror\s*=\s*alert/i);
  assert.match(html, /&lt;script&gt;/, 'kaçırılmış hâli görünmeli');
});
