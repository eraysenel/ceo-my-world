// Teknik SEO / indexlenebilirlik kuralları.
// Para burada kaybedilir: Google sayfayı bulamıyor, tarayamıyor veya
// indexlememesi gerektiğini sanıyorsa geri kalan her şey teoriktir.

import { defineRule } from '../lib/rules.mjs';
import { validLastmod } from '../lib/validate.mjs';
import {
  hostOf, stripWww, hasRawTurkishChars, hasUppercaseOrUnderscore, normalizeUrl, safeDecode, pathOf
} from '../lib/url.mjs';

const isHtmlPage = (page) => page.ok;
const isIndexable = (page) => page.ok && page.head.metaRobots.index;

export default [
  defineRule({
    id: 'soft-404',
    category: 'technical', scope: 'page', severity: 'error',
    weight: 8, impact: 4, effort: 'medium', needs: ['html'],
    description: '200 dönen ama "sayfa bulunamadı" diyen sayfalar',
    appliesTo: isHtmlPage,
    check: (page, site, ctx) => {
      if (!page.flags.softNotFound) return null;
      return ctx.fail({
        evidence: { status: page.status, wordCount: page.content.wordCount },
        message: `Sayfa 200 döndürüyor ama içeriği "bulunamadı" mesajı (${page.content.wordCount} kelime).`,
        fix: 'Bulunamayan içerikler için gerçek 404 (veya kalıcı taşındıysa 301) döndürün. 200 dönen hata sayfaları indexlenir ve arama sonuçlarını kirletir.'
      });
    }
  }),

  defineRule({
    id: 'redirect-chain',
    category: 'technical', scope: 'page', severity: 'warning',
    weight: 5, impact: 3, effort: 'low', needs: ['headers'],
    description: 'Hedefe birden fazla adımda ulaşan yönlendirmeler',
    appliesTo: (page) => Array.isArray(page.redirectChain),
    check: (page, site, ctx) => {
      if (page.redirectChain.length < 2) return null;
      return ctx.fail({
        evidence: { hops: page.redirectChain.length, chain: page.redirectChain.map((h) => `${h.status} ${h.url}`) },
        message: `Yönlendirme zinciri ${page.redirectChain.length} adım sürüyor.`,
        fix: 'Zinciri tek adıma indirin: ilk URL doğrudan son hedefe 301 versin. Her ek adım gecikme ekler ve link değerini seyreltir.'
      });
    }
  }),

  defineRule({
    id: 'canonical-missing',
    category: 'technical', scope: 'page', severity: 'warning',
    weight: 6, impact: 3, effort: 'low', needs: ['html'],
    description: 'rel=canonical etiketi yok',
    appliesTo: isIndexable,
    check: (page, site, ctx) => {
      if (page.head.canonical) return null;
      return ctx.fail({
        evidence: {},
        message: 'Sayfada rel=canonical etiketi yok.',
        fix: 'Her indexlenebilir sayfaya kendini gösteren mutlak bir canonical ekleyin: <link rel="canonical" href="https://…" />. Parametreli veya eğik çizgili kopyalarda hangi sürümün asıl olduğunu bu belirler.'
      });
    }
  }),

  defineRule({
    id: 'canonical-relative-url',
    category: 'technical', scope: 'page', severity: 'warning',
    weight: 4, impact: 3, effort: 'low', needs: ['html'],
    description: 'canonical göreli adres kullanıyor',
    appliesTo: (page) => Boolean(page.head.canonicalRaw),
    check: (page, site, ctx) => {
      if (!page.head.canonicalIsRelative) return null;
      return ctx.fail({
        evidence: { canonical: page.head.canonicalRaw },
        message: `Canonical göreli adres kullanıyor: "${page.head.canonicalRaw}".`,
        fix: 'Canonical her zaman mutlak olmalı (https:// ile başlamalı). Göreli canonical, <base> etiketi veya sunucu farklılıklarında yanlış URL\'ye çözümlenir.'
      });
    }
  }),

  defineRule({
    id: 'canonical-cross-host',
    category: 'technical', scope: 'page', severity: 'error',
    weight: 8, impact: 5, effort: 'low', needs: ['html'],
    description: 'canonical başka bir alan adını gösteriyor',
    appliesTo: (page) => Boolean(page.head.canonical),
    check: (page, site, ctx) => {
      const pageHost = hostOf(page.url);
      const canonHost = hostOf(page.head.canonical);
      if (!canonHost || canonHost === pageHost) return null;
      if (stripWww(canonHost) === stripWww(pageHost)) return null; // www/non-www birleştirmesi normaldir
      return ctx.fail({
        evidence: { pageHost, canonicalHost: canonHost, canonical: page.head.canonical },
        message: `Canonical farklı bir alan adını gösteriyor: ${canonHost} (sayfa: ${pageHost}).`,
        fix: 'Bilinçli bir birleştirme değilse canonical\'ı kendi URL\'sine çevirin. Alt alan adından ana alan adına canonical vermek, o sayfanın kendi başına indexlenmesini engeller.'
      });
    }
  }),

  defineRule({
    id: 'canonical-non-200',
    category: 'technical', scope: 'page', severity: 'error',
    weight: 9, impact: 5, effort: 'low', needs: ['html', 'net'],
    description: 'canonical hedefi 200 dönmüyor',
    appliesTo: (page, site) => Boolean(page.head.canonical) && site.urlStatus.size > 0,
    check: (page, site, ctx) => {
      const target = normalizeUrl(page.head.canonical);
      const rec = target ? site.urlStatus.get(target) : null;
      if (!rec || rec.status === 0) return null;
      if (rec.status >= 200 && rec.status < 300 && rec.redirects === 0) return null;
      return ctx.fail({
        evidence: { canonical: page.head.canonical, status: rec.status, redirects: rec.redirects },
        message: `Canonical hedefi ${rec.status}${rec.redirects ? ` (+${rec.redirects} yönlendirme)` : ''} dönüyor: ${page.head.canonical}`,
        fix: 'Canonical her zaman doğrudan 200 dönen bir adresi göstermeli. 404 veya yönlendirilen bir canonical, Google tarafından yok sayılır ve sayfa kendi başına değerlendirilir.'
      });
    }
  }),

  defineRule({
    id: 'robots-noindex-conflict',
    category: 'technical', scope: 'page', severity: 'critical',
    weight: 10, impact: 5, effort: 'low', needs: ['html', 'site'],
    description: 'İçeriden linklenen veya sitemap\'te olan sayfada noindex',
    appliesTo: (page) => page.ok && !page.head.metaRobots.index,
    check: (page, site, ctx) => {
      const inSitemap = site.sitemapUrls.has(page.url) || site.sitemapUrls.has(page.normalizedUrl);
      const inlinks = site.inlinks.get(page.normalizedUrl)?.length ?? 0;
      if (!inSitemap && inlinks === 0) return null;
      return ctx.fail({
        evidence: {
          robots: page.head.metaRobots.raw,
          inSitemap,
          inlinks,
          fromHeader: page.head.metaRobots.fromHeader
        },
        message: `Sayfa noindex ama ${inSitemap ? 'sitemap\'te listeleniyor' : ''}${inSitemap && inlinks ? ' ve ' : ''}${inlinks ? `${inlinks} iç bağlantı alıyor` : ''}.`,
        fix: 'Bu sayfa indexlenmeliyse noindex\'i kaldırın. İndexlenmemeliyse sitemap\'ten çıkarın ve iç bağlantıları gözden geçirin — aksi hâlde tarama bütçesi boşa harcanır ve çelişkili sinyal verilir.'
      });
    }
  }),

  defineRule({
    id: 'meta-robots-nofollow',
    category: 'technical', scope: 'page', severity: 'error',
    weight: 6, impact: 4, effort: 'low', needs: ['html'],
    description: 'İçerik sayfasında nofollow',
    appliesTo: (page) => page.ok,
    check: (page, site, ctx) => {
      if (page.head.metaRobots.follow) return null;
      return ctx.fail({
        evidence: { robots: page.head.metaRobots.raw },
        message: 'Sayfa genelinde nofollow tanımlı; buradaki bağlantılar takip edilmiyor.',
        fix: 'Sayfa genelinde nofollow yalnızca gerçekten güvenilmeyen içerik (kullanıcı yorumları vb.) için anlamlıdır. İçerik sayfalarında kaldırın; iç bağlantı değerinin akmasını engelliyor.'
      });
    }
  }),

  defineRule({
    id: 'mixed-content',
    category: 'technical', scope: 'page', severity: 'error',
    weight: 7, impact: 4, effort: 'medium', needs: ['html'],
    description: 'HTTPS sayfada http:// kaynak',
    appliesTo: (page) => page.url.startsWith('https://'),
    check: (page, site, ctx) => {
      const all = page.perf.insecureResources;
      if (all.length === 0) return null;
      return ctx.fail({
        evidence: { count: all.length, samples: all.slice(0, 5).map((r) => `<${r.tag}> ${r.url}`) },
        message: `HTTPS sayfada ${all.length} adet http:// üzerinden yüklenen kaynak var.`,
        fix: 'Tüm kaynakları https:// ile yükleyin. Tarayıcılar karışık içeriği engeller; görsel yüklenmez, sayfa güvensiz görünür.'
      });
    }
  }),

  defineRule({
    id: 'url-turkish-charset',
    category: 'technical', scope: 'page', severity: 'warning',
    weight: 5, impact: 3, effort: 'medium', needs: ['html'],
    description: 'URL yolunda kodlanmamış Türkçe karakter',
    appliesTo: (page) => page.ok,
    check: (page, site, ctx) => {
      if (!hasRawTurkishChars(page.url)) return null;
      return ctx.fail({
        evidence: { path: safeDecode(pathOf(page.url)) },
        message: `URL yolunda Türkçe karakter var: ${safeDecode(pathOf(page.url))}`,
        fix: 'URL\'lerde ASCII slug kullanın (ör. "dublaj-hizmeti"). Türkçe karakterli yollar farklı sistemlerde farklı kodlanır; iç link, canonical ve sitemap arasında tutarsızlık çıkarsa Google iki ayrı sayfa görür.'
      });
    }
  }),

  defineRule({
    id: 'url-uppercase-underscore',
    category: 'technical', scope: 'page', severity: 'notice',
    weight: 3, impact: 2, effort: 'medium', needs: ['html'],
    description: 'URL\'de büyük harf veya alt çizgi',
    appliesTo: (page) => page.ok,
    check: (page, site, ctx) => {
      if (!hasUppercaseOrUnderscore(page.url)) return null;
      return ctx.fail({
        evidence: { path: pathOf(page.url) },
        message: `URL yolunda büyük harf veya alt çizgi var: ${pathOf(page.url)}`,
        fix: 'Küçük harf ve tire kullanın. Sunucular büyük/küçük harfi ayırt eder; aynı sayfanın iki sürümü indexlenebilir.'
      });
    }
  }),

  defineRule({
    id: 'url-excessive-depth',
    category: 'technical', scope: 'page', severity: 'notice',
    weight: 3, impact: 2, effort: 'high', needs: ['html'],
    description: 'Çok derin URL yapısı',
    appliesTo: (page) => page.ok,
    check: (page, site, ctx) => {
      if (page.pathDepth <= 4) return null;
      return ctx.fail({
        evidence: { depth: page.pathDepth, path: pathOf(page.url) },
        message: `URL ${page.pathDepth} seviye derinlikte.`,
        fix: 'Önemli sayfaları ana sayfadan 3 tıklama içinde erişilebilir tutun. Derin sayfalar daha seyrek taranır.'
      });
    }
  }),

  // --- Site düzeyi ---------------------------------------------------------

  defineRule({
    id: 'robots-txt-missing',
    category: 'technical', scope: 'site', severity: 'warning',
    weight: 5, impact: 3, effort: 'low', needs: ['net'],
    description: 'robots.txt yok veya geçersiz',
    check: (site, _site, ctx) => {
      if (site.robots.found) return null;
      return ctx.fail({
        evidence: { origin: site.origin },
        message: 'robots.txt bulunamadı (veya HTML olarak sunuluyor).',
        fix: 'Kök dizine robots.txt ekleyin ve içine sitemap adresini yazın: "Sitemap: https://…/sitemap.xml". Yoksa arama motorları sitemap\'i keşfetmek için tahmin yürütmek zorunda kalır.'
      });
    }
  }),

  defineRule({
    id: 'sitemap-missing',
    category: 'technical', scope: 'site', severity: 'error',
    weight: 8, impact: 4, effort: 'medium', needs: ['net'],
    description: 'Hiç geçerli sitemap yok',
    check: (site, _site, ctx) => {
      if (site.sitemaps.some((s) => s.ok)) return null;
      return ctx.fail({
        evidence: { tried: site.sitemaps.map((s) => s.url) },
        message: 'Geçerli bir sitemap bulunamadı.',
        fix: 'XML sitemap üretin, robots.txt\'te "Sitemap:" satırıyla bildirin ve Google Search Console\'a gönderin. Sitemap, yeni sayfaların keşfedilme süresini belirgin şekilde kısaltır.'
      });
    }
  }),

  defineRule({
    id: 'sitemap-invalid-xml',
    category: 'technical', scope: 'site', severity: 'error',
    weight: 7, impact: 4, effort: 'low', needs: ['net'],
    description: 'Sitemap ayrıştırılamıyor',
    appliesTo: (site) => site.sitemaps.length > 0,
    check: (site, _site, ctx) => {
      const broken = site.sitemaps.filter((s) => !s.ok);
      if (broken.length === 0) return null;
      return ctx.fail({
        evidence: { broken: broken.map((s) => ({ url: s.url, error: s.error })) },
        message: `${broken.length} sitemap okunamadı.`,
        fix: 'Sitemap\'lerin geçerli XML döndürdüğünü ve 200 durum koduyla sunulduğunu doğrulayın.'
      });
    }
  }),

  defineRule({
    id: 'sitemap-url-non-indexable',
    category: 'technical', scope: 'site', severity: 'error',
    weight: 8, impact: 4, effort: 'medium', needs: ['net', 'site'],
    description: 'Sitemap 404/yönlendirme/noindex URL içeriyor',
    appliesTo: (site) => site.sitemapUrls.size > 0,
    check: (site, _site, ctx) => {
      const bad = [];
      for (const loc of site.sitemapUrls) {
        const n = normalizeUrl(loc);
        if (!n) continue;
        const rec = site.urlStatus.get(n);
        const page = site.pages.get(n);
        if (rec && rec.status >= 400) bad.push({ url: loc, reason: `HTTP ${rec.status}` });
        else if (rec && rec.redirects > 0) bad.push({ url: loc, reason: 'yönlendiriliyor' });
        else if (page && !page.head.metaRobots.index) bad.push({ url: loc, reason: 'noindex' });
      }
      if (bad.length === 0) return null;
      return ctx.fail({
        evidence: { count: bad.length, samples: bad.slice(0, 10) },
        message: `Sitemap\'te indexlenemeyecek ${bad.length} URL var (404, yönlendirme veya noindex).`,
        fix: 'Sitemap yalnızca 200 dönen, indexlenebilir, canonical\'ı kendisi olan URL\'leri içermeli. Kirli sitemap tarama bütçesini harcar ve Search Console\'da hata üretir.'
      });
    }
  }),

  defineRule({
    id: 'sitemap-orphan-pages',
    category: 'technical', scope: 'site', severity: 'warning',
    weight: 6, impact: 3, effort: 'medium', needs: ['site'],
    description: 'Taranan indexlenebilir sayfalar sitemap\'te yok',
    appliesTo: (site) => site.sitemapUrls.size > 0 && site.pages.size > 1,
    check: (site, _site, ctx) => {
      const missing = [];
      for (const page of site.pages.values()) {
        if (!page.ok || !page.head.metaRobots.index) continue;
        if (!site.sitemapUrls.has(page.url) && !site.sitemapUrls.has(page.normalizedUrl)) {
          missing.push(page.normalizedUrl);
        }
      }
      if (missing.length === 0) return null;
      return ctx.fail({
        evidence: { count: missing.length, samples: missing.slice(0, 10) },
        message: `Taramada bulunan ${missing.length} indexlenebilir sayfa sitemap'te yok.`,
        fix: 'Sitemap üretimini otomatikleştirin; yeni yayınlanan her indexlenebilir sayfa sitemap\'e girmeli.'
      });
    }
  }),

  defineRule({
    id: 'sitemap-lastmod-invalid',
    category: 'technical', scope: 'site', severity: 'notice',
    weight: 3, impact: 2, effort: 'low', needs: ['net'],
    description: 'lastmod eksik, biçimsiz veya gelecekte',
    appliesTo: (site) => site.sitemaps.some((s) => s.ok && s.entries?.length),
    check: (site, _site, ctx) => {
      const bad = [];
      for (const sm of site.sitemaps) {
        for (const e of sm.entries ?? []) {
          const v = validLastmod(e.lastmod);
          if (!v.valid) bad.push({ url: e.loc, lastmod: e.lastmod, reason: v.reason });
        }
      }
      if (bad.length === 0) return null;
      const reasons = [...new Set(bad.map((b) => b.reason))].join(', ');
      return ctx.fail({
        evidence: { count: bad.length, reasons, samples: bad.slice(0, 5) },
        message: `${bad.length} sitemap girdisinde lastmod sorunlu (${reasons}).`,
        fix: 'lastmod W3C tarih biçiminde (YYYY-MM-DD veya tam ISO 8601) ve içeriğin gerçek son güncelleme tarihi olmalı. Her yayında tüm tarihleri "bugün" yapmak sinyali değersizleştirir.'
      });
    }
  }),

  defineRule({
    id: 'http-status-error',
    category: 'technical', scope: 'site', severity: 'critical',
    weight: 10, impact: 5, effort: 'medium', needs: ['net', 'site'],
    description: 'İç URL\'lerde 4xx/5xx',
    appliesTo: (site) => site.urlStatus.size > 0,
    check: (site, _site, ctx) => {
      const bad = [];
      for (const [url, rec] of site.urlStatus) {
        if (rec.status >= 400 && hostOf(url) && site.hosts.includes(hostOf(url))) {
          bad.push({ url, status: rec.status });
        }
      }
      if (bad.length === 0) return null;
      return ctx.fail({
        evidence: { count: bad.length, samples: bad.slice(0, 10) },
        message: `Sitede ${bad.length} adet 4xx/5xx dönen iç adres var.`,
        fix: 'Her birini düzeltin: içerik taşındıysa 301 verin, kalktıysa bağlantıyı kaldırın. Kırık iç adresler hem kullanıcıyı hem tarayıcıyı çıkmaza sokar.'
      });
    }
  }),

  defineRule({
    id: 'www-https-canonicalization',
    category: 'technical', scope: 'site', severity: 'error',
    weight: 8, impact: 5, effort: 'low', needs: ['net', 'site'],
    description: 'www / www-suz ya da http / https sürümleri ayrı ayrı 200 dönüyor',
    appliesTo: (site) => site.capabilities.net && site.hosts.length > 0,
    check: (site, _site, ctx) => {
      const bare = new Set(site.hosts.map(stripWww));
      const duplicated = [...bare].filter((h) => site.hosts.includes(h) && site.hosts.includes(`www.${h}`));
      if (duplicated.length === 0) return null;
      return ctx.fail({
        evidence: { hosts: site.hosts, duplicated },
        message: `Hem www hem www'suz sürüm taranabilir durumda: ${duplicated.join(', ')}`,
        fix: 'Birini seçip diğerini ona 301 ile yönlendirin. İki sürüm de erişilebilirse aynı içerik iki kez indexlenir ve bağlantı değeri bölünür.'
      });
    }
  }),

  defineRule({
    id: 'duplicate-content-cluster',
    category: 'technical', scope: 'site', severity: 'error',
    weight: 8, impact: 4, effort: 'high', needs: ['site'],
    description: 'Neredeyse aynı içeriğe sahip sayfalar',
    appliesTo: (site) => site.pages.size > 1,
    check: (site, _site, ctx) => {
      const pairs = site.clusters.duplicateContent;
      if (pairs.length === 0) return null;
      return ctx.fail({
        evidence: { count: pairs.length, samples: pairs.slice(0, 5) },
        message: `${pairs.length} sayfa çifti neredeyse aynı içeriğe sahip.`,
        fix: 'Kopyaları birleştirin veya aralarında canonical ilişkisi kurun. Aynı içeriği birden çok URL\'de yayınlamak hangisinin sıralanacağını Google\'a bırakır.'
      });
    }
  }),

  defineRule({
    id: 'client-side-rendering',
    category: 'technical', scope: 'site', severity: 'warning',
    weight: 7, impact: 4, effort: 'high', needs: ['site'],
    description: 'İçerik sunucudan gelmiyor, tarayıcıda üretiliyor',
    appliesTo: (site) => site.pages.size > 0,
    check: (site, _site, ctx) => {
      if (site.rendering !== 'client-side-suspect') return null;
      const suspects = [...site.pages.values()].filter((p) => p.flags.spaSuspect);
      return ctx.fail({
        evidence: { suspectPages: suspects.length, totalPages: site.pages.size },
        message: `Sayfaların ${suspects.length}/${site.pages.size} kadarı içeriğini tarayıcıda üretiyor gibi görünüyor.`,
        fix: 'Kritik içeriği (başlık, ana metin, iç bağlantılar, yapısal veri) sunucu tarafında render edin (SSR/SSG). Google JavaScript çalıştırır ama bu ikinci bir tarama dalgasında olur ve gecikir; diğer arama ve AI tarayıcılarının çoğu hiç çalıştırmaz.'
      });
    }
  })
];
