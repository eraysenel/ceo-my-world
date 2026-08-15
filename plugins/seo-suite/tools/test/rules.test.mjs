// Kural testleri.
//
// Her kural için HEM pozitif HEM negatif kontrol yazılır. Negatif kontrolü
// olmayan kural, sessizce her sayfada tetiklenip raporu çöpe çevirebilir —
// ve yanlış bulgu, eksik bulgudan daha pahalıdır.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import onpage from '../rules/onpage.mjs';
import technical from '../rules/technical.mjs';
import media from '../rules/media.mjs';
import links from '../rules/links.mjs';
import i18nRules from '../rules/i18n.mjs';
import structured from '../rules/structured-data.mjs';
import performance from '../rules/performance.mjs';
import aiSearch from '../rules/ai-search.mjs';
import { doc, page, site, runRule, byId } from './helpers.mjs';

const LONG_TR = 'Reklam seslendirme ve dublaj hizmetlerimiz kapsamında marka tonuna uygun '
  + 'ses seçimi yapıyor, kayıt ve miksaj süreçlerini kendi stüdyomuzda tamamlıyoruz. '
  + 'Her proje için önce örnek okuma paylaşıyoruz, onay sonrası kayda giriyoruz. ';

// --- on-page --------------------------------------------------------------

test('title-missing: başlıksız sayfada tetiklenir, başlıklıda tetiklenmez', () => {
  const rule = byId(onpage, 'title-missing');
  const yok = page('<!doctype html><html lang="tr"><head><meta charset="utf-8"></head><body><h1>a</h1></body></html>');
  assert.equal(runRule(rule, yok).findings.length, 1);

  const var_ = page(doc('<h1>a</h1>', { head: '<title>Reklam Seslendirme Fiyatları | Marka</title>' }));
  assert.equal(runRule(rule, var_).findings.length, 0);
});

test('title-pixel-width: karakter sayısı değil piksel ölçülür', () => {
  const rule = byId(onpage, 'title-pixel-width');

  // Geniş harfli uzun başlık: sınırı aşar.
  const genis = page(doc('<h1>a</h1>', {
    head: '<title>MODERN DUBLAJ VE SESLENDİRME AJANSI KURUMSAL ÇÖZÜMLER</title>'
  }));
  const r1 = runRule(rule, genis);
  assert.equal(r1.findings.length, 1);
  assert.ok(r1.findings[0].evidence.px > 580);

  // Aynı karakter sayısında dar harfli başlık sınırın altında kalabilir.
  const dar = page(doc('<h1>a</h1>', { head: '<title>ilişkili iş ilanı listesi</title>' }));
  assert.equal(runRule(rule, dar).findings.length, 0);
});

test('h1-missing / h1-count: eksik ve fazla H1', () => {
  const missing = byId(onpage, 'h1-missing');
  const count = byId(onpage, 'h1-count');
  const head = '<title>Yeterince uzun bir sayfa başlığı buraya</title>';

  assert.equal(runRule(missing, page(doc('<h2>alt</h2>', { head }))).findings.length, 1);
  assert.equal(runRule(missing, page(doc('<h1>tek</h1>', { head }))).findings.length, 0);
  assert.equal(runRule(count, page(doc('<h1>bir</h1><h1>iki</h1>', { head }))).findings.length, 1);
  assert.equal(runRule(count, page(doc('<h1>tek</h1>', { head }))).findings.length, 0);
});

test('heading-hierarchy-skip: H2 sonrası H4 yakalanır', () => {
  const rule = byId(onpage, 'heading-hierarchy-skip');
  const head = '<title>Yeterince uzun bir sayfa başlığı buraya</title>';
  assert.equal(runRule(rule, page(doc('<h1>a</h1><h2>b</h2><h4>c</h4>', { head }))).findings.length, 1);
  assert.equal(runRule(rule, page(doc('<h1>a</h1><h2>b</h2><h3>c</h3>', { head }))).findings.length, 0);
});

test('turkish-mojibake: bozuk kodlama kritik bulgu, temiz sayfa temiz', () => {
  const rule = byId(onpage, 'turkish-mojibake');
  const bozuk = page(doc('<p>StÃ¼dyomuz Ä°stanbul KadÄ±kÃ¶y. Ã‡alÄ±ÅŸma saatleri.</p>'));
  const r = runRule(rule, bozuk);
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].severity, 'critical');
  assert.equal(runRule(rule, page(doc('<p>Stüdyomuz İstanbul Kadıköy.</p>'))).findings.length, 0);
});

test('charset-declaration-late: geç charset yakalanır, erken charset temiz', () => {
  const rule = byId(onpage, 'charset-declaration-late');
  const dolgu = `<style>${'/* dolgu */'.repeat(120)}</style>`;
  const gec = `<!doctype html><html lang="tr"><head>${dolgu}<meta charset="utf-8"><title>t</title></head><body><p>x</p></body></html>`;
  assert.equal(runRule(rule, page(gec)).findings.length, 1);
  assert.equal(runRule(rule, page(doc('<p>x</p>'))).findings.length, 0);
});

test('viewport-meta-missing: sabit genişlik de bulgu sayılır', () => {
  const rule = byId(onpage, 'viewport-meta-missing');
  const yok = page('<!doctype html><html lang="tr"><head><meta charset="utf-8"></head><body>x</body></html>');
  assert.equal(runRule(rule, yok).findings.length, 1);

  const sabit = page('<!doctype html><html lang="tr"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=1024"></head><body>x</body></html>');
  assert.equal(runRule(rule, sabit).findings.length, 1);
  assert.equal(runRule(rule, page(doc('<p>x</p>'))).findings.length, 0);
});

test('title-duplicate: Türkçe harmanlama ile büyük/küçük harf farkını yakalar', () => {
  const rule = byId(onpage, 'title-duplicate');
  const a = page(doc('<h1>a</h1>', { head: '<title>DUBLAJ Hizmeti</title>' }), { url: 'https://ornek.test/a' });
  const b = page(doc('<h1>b</h1>', { head: '<title>dublaj hizmeti</title>' }), { url: 'https://ornek.test/b' });
  const s = site([a, b]);
  s.clusters.duplicateTitles.set('dublaj hizmeti', [a.normalizedUrl, b.normalizedUrl]);
  assert.equal(runRule(rule, null, s).findings.length, 1);

  const temiz = site([a, b]);
  temiz.clusters.duplicateTitles.set('dublaj hizmeti', [a.normalizedUrl]);
  assert.equal(runRule(rule, null, temiz).findings.length, 0);
});

// --- teknik ---------------------------------------------------------------

test('canonical-cross-host: farklı alan adı bulgu, www farkı bulgu değil', () => {
  const rule = byId(technical, 'canonical-cross-host');
  const capraz = page(doc('<p>x</p>', { head: '<link rel="canonical" href="https://baska.test/a">' }),
    { url: 'https://ornek.test/a' });
  assert.equal(runRule(rule, capraz).findings.length, 1);

  const wwwFarki = page(doc('<p>x</p>', { head: '<link rel="canonical" href="https://www.ornek.test/a">' }),
    { url: 'https://ornek.test/a' });
  assert.equal(runRule(rule, wwwFarki).findings.length, 0, 'www/non-www birleştirmesi normaldir');
});

test('canonical-relative-url: göreli canonical yakalanır', () => {
  const rule = byId(technical, 'canonical-relative-url');
  assert.equal(runRule(rule, page(doc('<p>x</p>', { head: '<link rel="canonical" href="/a">' }))).findings.length, 1);
  assert.equal(runRule(rule, page(doc('<p>x</p>', { head: '<link rel="canonical" href="https://ornek.test/a">' }))).findings.length, 0);
});

test('canonical-non-200: hedef 404 ise bulgu, 200 ise temiz', () => {
  const rule = byId(technical, 'canonical-non-200');
  const p = page(doc('<p>x</p>', { head: '<link rel="canonical" href="https://ornek.test/hedef">' }));

  const kirik = site([p]);
  kirik.urlStatus.set('https://ornek.test/hedef', { status: 404, finalUrl: '', redirects: 0 });
  assert.equal(runRule(rule, p, kirik).findings.length, 1);

  const saglam = site([p]);
  saglam.urlStatus.set('https://ornek.test/hedef', { status: 200, finalUrl: '', redirects: 0 });
  assert.equal(runRule(rule, p, saglam).findings.length, 0);
});

test('soft-404: 200 dönen "bulunamadı" sayfası yakalanır', () => {
  const rule = byId(technical, 'soft-404');
  const soft = page(doc('<h1>Hata</h1><p>Aradığınız sayfa bulunamadı.</p>'));
  assert.equal(runRule(rule, soft).findings.length, 1);
  assert.equal(runRule(rule, page(doc(`<h1>Hizmet</h1><p>${LONG_TR.repeat(3)}</p>`))).findings.length, 0);
});

test('url-turkish-charset: Türkçe karakterli yol yakalanır', () => {
  const rule = byId(technical, 'url-turkish-charset');
  assert.equal(runRule(rule, page(doc('<p>x</p>'), { url: 'https://ornek.test/fiyatları' })).findings.length, 1);
  assert.equal(runRule(rule, page(doc('<p>x</p>'), { url: 'https://ornek.test/fiyatlar' })).findings.length, 0);
});

test('mixed-content: https sayfada http kaynak yakalanır', () => {
  const rule = byId(technical, 'mixed-content');
  const karisik = page(doc('<img src="http://ornek.test/a.jpg" alt="a">'), { url: 'https://ornek.test/a' });
  assert.equal(runRule(rule, karisik).findings.length, 1);
  const temiz = page(doc('<img src="https://ornek.test/a.jpg" alt="a">'), { url: 'https://ornek.test/a' });
  assert.equal(runRule(rule, temiz).findings.length, 0);
});

test('robots-noindex-conflict: sitemap\'teki noindex sayfa kritik bulgu', () => {
  const rule = byId(technical, 'robots-noindex-conflict');
  const p = page(doc('<p>x</p>', { head: '<meta name="robots" content="noindex">' }));

  const catisan = site([p]);
  catisan.sitemapUrls.add(p.normalizedUrl);
  const r = runRule(rule, p, catisan);
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].severity, 'critical');

  // Sitemap'te de değil, iç bağlantı da almıyorsa bilinçli noindex sayılır.
  assert.equal(runRule(rule, p, site([p])).findings.length, 0);
});

// --- medya ----------------------------------------------------------------

test('img-missing-alt: alt özniteliği olmayan görsel; alt="" bulgu değil', () => {
  const rule = byId(media, 'img-missing-alt');
  assert.equal(runRule(rule, page(doc('<img src="/a.jpg">'))).findings.length, 1);
  // alt="" dekoratif beyanıdır, eksiklik değildir.
  assert.equal(runRule(rule, page(doc('<img src="/a.jpg" alt="">'))).findings.length, 0);
  assert.equal(runRule(rule, page(doc('<img src="/a.jpg" alt="stüdyo">'))).findings.length, 0);
});

test('img-missing-dimensions: width/height veya aspect-ratio', () => {
  const rule = byId(media, 'img-missing-dimensions');
  assert.equal(runRule(rule, page(doc('<img src="/a.jpg" alt="a">'))).findings.length, 1);
  assert.equal(runRule(rule, page(doc('<img src="/a.jpg" alt="a" width="8" height="6">'))).findings.length, 0);
  assert.equal(runRule(rule, page(doc('<img src="/a.jpg" alt="a" style="aspect-ratio:4/3">'))).findings.length, 0);
});

test('audio-missing-transcript: metinsiz ses demosu yakalanır', () => {
  const rule = byId(media, 'audio-missing-transcript');
  assert.equal(runRule(rule, page(doc('<audio src="/demo.mp3"></audio>'))).findings.length, 1);

  const transkriptli = page(doc(
    `<audio src="/demo.mp3"></audio><p>${LONG_TR.repeat(4)}</p>`,
    { head: '<script type="application/ld+json">{"@context":"https://schema.org","@type":"AudioObject","name":"Demo"}</script>' }
  ));
  assert.equal(runRule(rule, transkriptli).findings.length, 0);
});

test('img-alt-quality: dosya adı kopyası ve kelime yığını yakalanır', () => {
  const rule = byId(media, 'img-alt-quality');
  assert.equal(runRule(rule, page(doc('<img src="/gorsel/mikrofon.jpg" alt="mikrofon">'))).findings.length, 1);
  assert.equal(runRule(rule, page(doc('<img src="/a.jpg" alt="ses ses ses kayıt">'))).findings.length, 1);
  assert.equal(runRule(rule, page(doc('<img src="/a.jpg" alt="Stüdyoda mikrofon ve akustik panel">'))).findings.length, 0);
});

// --- bağlantılar ----------------------------------------------------------

test('anchor-text-generic: anlamsız bağlantı metni', () => {
  const rule = byId(links, 'anchor-text-generic');
  assert.equal(runRule(rule, page(doc('<a href="/a">buraya tıklayın</a>'))).findings.length, 1);
  assert.equal(runRule(rule, page(doc('<a href="/a">reklam seslendirme fiyatları</a>'))).findings.length, 0);
});

test('orphan-page: kök sayfa muaf, bağlantısız alt sayfa bulgu', () => {
  const rule = byId(links, 'orphan-page');
  const kok = page(doc('<a href="/a">a</a>'), { url: 'https://ornek.test/' });
  const bagli = page(doc('<p>x</p>'), { url: 'https://ornek.test/a' });
  const yetim = page(doc('<p>x</p>'), { url: 'https://ornek.test/yetim' });

  const s = site([kok, bagli, yetim]);
  s.inlinks.set(bagli.normalizedUrl, [{ from: kok.normalizedUrl, anchorText: 'a', area: 'main' }]);
  const r = runRule(rule, null, s);
  assert.equal(r.findings.length, 1);
  assert.deepEqual(r.findings[0].evidence.samples, ['https://ornek.test/yetim']);
});

test('target-blank-no-noopener', () => {
  const rule = byId(links, 'target-blank-no-noopener');
  assert.equal(runRule(rule, page(doc('<a href="https://d.test" target="_blank">d</a>'))).findings.length, 1);
  assert.equal(runRule(rule, page(doc('<a href="https://d.test" target="_blank" rel="noopener">d</a>'))).findings.length, 0);
});

// --- i18n -----------------------------------------------------------------

test('lang-attribute-mismatch: Türkçe içerikte lang="en"', () => {
  const rule = byId(i18nRules, 'lang-attribute-mismatch');
  const yanlis = page(doc(`<p>${LONG_TR.repeat(2)}</p>`, { lang: 'en' }));
  assert.equal(runRule(rule, yanlis).findings.length, 1);
  const dogru = page(doc(`<p>${LONG_TR.repeat(2)}</p>`, { lang: 'tr' }));
  assert.equal(runRule(rule, dogru).findings.length, 0);
});

test('hreflang-invalid-code: tr_TR reddedilir, tr-TR kabul edilir', () => {
  const rule = byId(i18nRules, 'hreflang-invalid-code');
  const kotu = page(doc('<p>x</p>', { head: '<link rel="alternate" hreflang="tr_TR" href="https://ornek.test/">' }));
  assert.equal(runRule(rule, kotu).findings.length, 1);
  const iyi = page(doc('<p>x</p>', { head: '<link rel="alternate" hreflang="tr-TR" href="https://ornek.test/">' }));
  assert.equal(runRule(rule, iyi).findings.length, 0);
});

test('hreflang-return-tag: karşılıklı olmayan küme yakalanır', () => {
  const rule = byId(i18nRules, 'hreflang-return-tag');
  const tr = page(doc('<p>x</p>', {
    head: '<link rel="alternate" hreflang="tr" href="https://ornek.test/tr">'
        + '<link rel="alternate" hreflang="en" href="https://ornek.test/en">'
  }), { url: 'https://ornek.test/tr' });

  const enSessiz = page(doc('<p>x</p>'), { url: 'https://ornek.test/en' });
  assert.equal(runRule(rule, tr, site([tr, enSessiz])).findings.length, 1);

  const enDonen = page(doc('<p>x</p>', {
    head: '<link rel="alternate" hreflang="tr" href="https://ornek.test/tr">'
        + '<link rel="alternate" hreflang="en" href="https://ornek.test/en">'
  }), { url: 'https://ornek.test/en' });
  assert.equal(runRule(rule, tr, site([tr, enDonen])).findings.length, 0);
});

// --- yapısal veri ---------------------------------------------------------

test('jsonld-parse-error: bozuk JSON yakalanır, geçerli JSON temiz', () => {
  const rule = byId(structured, 'jsonld-parse-error');
  const bozuk = page(doc('<p>x</p>', {
    head: '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization",}</script>'
  }));
  assert.equal(runRule(rule, bozuk).findings.length, 1);

  const gecerli = page(doc('<p>x</p>', {
    head: '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"A","url":"https://ornek.test/"}</script>'
  }));
  assert.equal(runRule(rule, gecerli).findings.length, 0);
});

test('jsonld-required-props: eksik zorunlu alan yakalanır', () => {
  const rule = byId(structured, 'jsonld-required-props');
  const eksik = page(doc('<p>x</p>', {
    head: '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Başlık"}</script>'
  }));
  const r = runRule(rule, eksik);
  assert.equal(r.findings.length, 1);
  assert.deepEqual(r.findings[0].evidence.problems[0].missing, ['datePublished', 'author']);

  const tam = page(doc('<p>x</p>', {
    head: '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"B","datePublished":"2026-01-01","author":{"@type":"Person","name":"A"}}</script>'
  }));
  assert.equal(runRule(rule, tam).findings.length, 0);
});

test('jsonld-faq-mismatch: sayfada görünmeyen SSS sorusu politika ihlalidir', () => {
  const rule = byId(structured, 'jsonld-faq-mismatch');
  const schema = (q) => `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"${q}","acceptedAnswer":{"@type":"Answer","text":"Cevap"}}]}</script>`;

  const gizli = page(doc('<p>Farklı bir metin.</p>', { head: schema('Dublaj ne kadar sürer') }));
  assert.equal(runRule(rule, gizli).findings.length, 1);

  const gorunur = page(doc('<h2>Dublaj ne kadar sürer</h2><p>Beş iş günü.</p>', { head: schema('Dublaj ne kadar sürer') }));
  assert.equal(runRule(rule, gorunur).findings.length, 0);
});

// --- performans -----------------------------------------------------------

test('render-blocking-js: head içinde defer\'siz betik', () => {
  const rule = byId(performance, 'render-blocking-js');
  assert.equal(runRule(rule, page(doc('<p>x</p>', { head: '<script src="/a.js"></script>' }))).findings.length, 1);
  assert.equal(runRule(rule, page(doc('<p>x</p>', { head: '<script src="/a.js" defer></script>' }))).findings.length, 0);
});

test('lcp-candidate-lazy: ilk görselde lazy bulgu, sonrakinde değil', () => {
  const rule = byId(performance, 'lcp-candidate-lazy');
  assert.equal(runRule(rule, page(doc('<main><img src="/hero.jpg" alt="a" loading="lazy"></main>'))).findings.length, 1);
  assert.equal(runRule(rule, page(doc('<main><img src="/hero.jpg" alt="a" fetchpriority="high"></main>'))).findings.length, 0);
});

test('no-compression: sıkıştırılmamış büyük HTML', () => {
  const rule = byId(performance, 'no-compression');
  const govde = `<p>${'içerik '.repeat(600)}</p>`;
  const sikismamis = page(doc(govde), { headers: { 'content-type': 'text/html' } });
  assert.equal(runRule(rule, sikismamis).findings.length, 1);

  const sikisik = page(doc(govde), { headers: { 'content-type': 'text/html', 'content-encoding': 'br' } });
  assert.equal(runRule(rule, sikisik).findings.length, 0);
});

// --- AI arama -------------------------------------------------------------

test('ai-crawler-blocked: engel bildirilir ama hata değil politika olarak sunulur', () => {
  const rule = byId(aiSearch, 'ai-crawler-blocked');
  const s = site([]);
  s.robots.found = true;
  s.robots.blockedAiAgents = ['GPTBot'];
  const r = runRule(rule, null, s);
  assert.equal(r.findings.length, 1);
  assert.match(r.findings[0].fix, /politika kararı/i);

  const acik = site([]);
  acik.robots.found = true;
  assert.equal(runRule(rule, null, acik).findings.length, 0);
});

test('llms-txt-missing: düşük öncelik olduğu açıkça yazılır', () => {
  const rule = byId(aiSearch, 'llms-txt-missing');
  const r = runRule(rule, null, site([]));
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].severity, 'notice');
  assert.match(r.findings[0].fix, /DÜŞÜK ÖNCELİK/);

  const varOlan = site([]);
  varOlan.wellKnown.llmsTxt = '# Site';
  assert.equal(runRule(rule, null, varOlan).findings.length, 0);
});

// --- ayrıştırıcı sağlamlığı ----------------------------------------------

test('ayrıştırıcı: yorum içindeki sahte <title> gerçek başlığı gölgelemez', () => {
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
    <!-- <title>Önbellekten kalan eski başlık</title> -->
    <title>Gerçek Başlık</title></head><body><p>x</p></body></html>`;
  assert.equal(page(html).head.title, 'Gerçek Başlık');
});

test('ayrıştırıcı: script içindeki </div> yapıyı bozmaz', () => {
  const html = doc('<div><script>var s = "</div>"; if (a < b) {}</script><h1>Başlık</h1></div>');
  assert.deepEqual(page(html).headings.h1, ['Başlık']);
});

test('ayrıştırıcı: tırnaksız öznitelik okunur', () => {
  const p = page(doc('<img src=foto.jpg alt=Dublaj>'));
  assert.equal(p.media.images.length, 1);
  assert.equal(p.media.images[0].altText, 'Dublaj');
});

test('ayrıştırıcı: <base href> göreli adres çözümlemesini değiştirir', () => {
  const html = doc('<a href="hizmet">h</a>', { head: '<base href="https://ornek.test/alt/">' });
  const p = page(html, { url: 'https://ornek.test/sayfa' });
  assert.equal(p.links[0].abs, 'https://ornek.test/alt/hizmet');
});
