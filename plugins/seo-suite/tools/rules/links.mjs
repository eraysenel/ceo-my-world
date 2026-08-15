// Bağlantı kuralları.

import { defineRule } from '../lib/rules.mjs';
import { truncate } from '../lib/text.mjs';
import { pathOf } from '../lib/url.mjs';

export default [
  defineRule({
    id: 'broken-internal-link',
    category: 'links', scope: 'page', severity: 'critical',
    weight: 10, impact: 5, effort: 'low', needs: ['html', 'net', 'site'],
    description: 'İç bağlantı 4xx/5xx dönüyor',
    appliesTo: (page, site) => page.ok && site.urlStatus.size > 0,
    check: (page, site, ctx) => {
      const broken = [];
      for (const link of page.links) {
        if (!link.internal || !link.normalized) continue;
        const rec = site.urlStatus.get(link.normalized);
        // Zaman aşımı kırık bağlantı DEĞİLDİR; sadece kesin 4xx/5xx sayılır.
        if (rec && rec.status >= 400) {
          broken.push({ url: link.normalized, status: rec.status, anchor: truncate(link.anchorText, 40) });
        }
      }
      if (broken.length === 0) return null;
      return ctx.fail({
        evidence: { count: broken.length, samples: broken.slice(0, 8) },
        message: `Sayfada ${broken.length} kırık iç bağlantı var.`,
        fix: 'Kırık bağlantıları düzeltin veya kaldırın. Kullanıcıyı çıkmaza sokar, tarama bütçesini harcar ve sayfa içi bağlantı değerini boşa akıtır.'
      });
    }
  }),

  defineRule({
    id: 'internal-redirect-link',
    category: 'links', scope: 'page', severity: 'warning',
    weight: 5, impact: 3, effort: 'low', needs: ['html', 'net', 'site'],
    description: 'İç bağlantı yönlendirilen bir adrese işaret ediyor',
    appliesTo: (page, site) => page.ok && site.urlStatus.size > 0,
    check: (page, site, ctx) => {
      const redirecting = [];
      for (const link of page.links) {
        if (!link.internal || !link.normalized) continue;
        const rec = site.urlStatus.get(link.normalized);
        if (rec && rec.redirects > 0 && rec.status < 400) {
          redirecting.push({ from: link.normalized, to: rec.finalUrl });
        }
      }
      if (redirecting.length === 0) return null;
      return ctx.fail({
        evidence: { count: redirecting.length, samples: redirecting.slice(0, 8) },
        message: `${redirecting.length} iç bağlantı, yönlendirilen bir adrese işaret ediyor.`,
        fix: 'Bağlantıları doğrudan son hedefe güncelleyin. Her yönlendirme gecikme ekler ve gereksiz bir istek üretir.'
      });
    }
  }),

  defineRule({
    id: 'orphan-page',
    category: 'links', scope: 'site', severity: 'error',
    weight: 8, impact: 4, effort: 'medium', needs: ['site'],
    description: 'Hiç iç bağlantı almayan indexlenebilir sayfa',
    appliesTo: (site) => site.pages.size > 2 && !site.singlePage,
    check: (site, _site, ctx) => {
      const orphans = [];
      for (const page of site.pages.values()) {
        if (!page.ok || !page.head.metaRobots.index) continue;
        // Kök sayfa doğası gereği iç bağlantı almadan da erişilebilir.
        // (Derinliğe bakılmaz: çevrimdışı modda tüm sayfalar derinlik 0'dır.)
        if (pathOf(page.normalizedUrl) === '/') continue;
        const inlinks = site.inlinks.get(page.normalizedUrl)?.length ?? 0;
        if (inlinks === 0) orphans.push(page.normalizedUrl);
      }
      if (orphans.length === 0) return null;
      return ctx.fail({
        evidence: { count: orphans.length, samples: orphans.slice(0, 10) },
        message: `${orphans.length} sayfa sitenin hiçbir yerinden bağlantı almıyor.`,
        fix: 'Bu sayfalara ilgili içeriklerden bağlantı verin. İç bağlantı almayan sayfa hem kullanıcı için görünmezdir hem de arama motoru gözünde önemsizdir.'
      });
    }
  }),

  defineRule({
    id: 'anchor-text-generic',
    category: 'links', scope: 'page', severity: 'notice',
    weight: 4, impact: 3, effort: 'low', needs: ['html'],
    description: 'Anlamsız bağlantı metni',
    appliesTo: (page) => page.ok && page.links.length > 0,
    check: (page, site, ctx) => {
      const generic = page.links.filter((l) => l.generic && l.anchorText);
      if (generic.length === 0) return null;
      return ctx.fail({
        evidence: {
          count: generic.length,
          samples: [...new Set(generic.map((l) => l.anchorText))].slice(0, 6)
        },
        message: `${generic.length} bağlantı anlamsız metin kullanıyor ("tıklayın", "devamı", çıplak URL vb.).`,
        fix: 'Bağlantı metni hedef sayfanın ne olduğunu söylemeli: "devamı" yerine "reklam seslendirme fiyatları". Bu hem erişilebilirlik hem de bağlantının taşıdığı konu sinyali için gereklidir.'
      });
    }
  }),

  defineRule({
    id: 'anchor-text-empty',
    category: 'links', scope: 'page', severity: 'warning',
    weight: 6, impact: 3, effort: 'low', needs: ['html'],
    description: 'Metni ve alt metni olmayan bağlantı',
    appliesTo: (page) => page.ok && page.links.length > 0,
    check: (page, site, ctx) => {
      const empty = page.links.filter((l) => !l.accessibleText);
      if (empty.length === 0) return null;
      return ctx.fail({
        evidence: { count: empty.length, samples: empty.slice(0, 5).map((l) => l.abs) },
        message: `${empty.length} bağlantının okunabilir hiçbir metni yok (metin, alt ya da aria-label).`,
        fix: 'İkon bağlantılarına aria-label, görsel bağlantılara anlamlı alt metni ekleyin. Metinsiz bağlantı ekran okuyucuda "bağlantı" diye okunur ve hiçbir konu sinyali taşımaz.'
      });
    }
  }),

  defineRule({
    id: 'target-blank-no-noopener',
    category: 'links', scope: 'page', severity: 'warning',
    weight: 5, impact: 2, effort: 'low', needs: ['html'],
    description: 'target="_blank" var ama rel="noopener" yok',
    appliesTo: (page) => page.ok && page.links.some((l) => l.targetBlank),
    check: (page, site, ctx) => {
      const risky = page.links.filter((l) => l.targetBlank && !l.rel.includes('noopener'));
      if (risky.length === 0) return null;
      return ctx.fail({
        evidence: { count: risky.length, samples: risky.slice(0, 5).map((l) => l.abs) },
        message: `${risky.length} bağlantı yeni sekmede açılıyor ama rel="noopener" taşımıyor.`,
        fix: 'rel="noopener noreferrer" ekleyin. Aksi hâlde açılan sayfa window.opener üzerinden kaynak sayfayı yönlendirebilir.'
      });
    }
  }),

  defineRule({
    id: 'internal-link-nofollow',
    category: 'links', scope: 'page', severity: 'notice',
    weight: 4, impact: 2, effort: 'low', needs: ['html'],
    description: 'İç bağlantıda nofollow',
    appliesTo: (page) => page.ok,
    check: (page, site, ctx) => {
      const nf = page.links.filter((l) => l.internal && l.nofollow);
      if (nf.length === 0) return null;
      return ctx.fail({
        evidence: { count: nf.length, samples: nf.slice(0, 5).map((l) => l.abs) },
        message: `${nf.length} iç bağlantı nofollow taşıyor.`,
        fix: 'İç bağlantılarda nofollow kullanmayın. Tarama bütçesi yönetimi için tasarlanmamıştır; sadece o bağlantının taşıdığı değeri yok eder.'
      });
    }
  }),

  defineRule({
    id: 'internal-links-few',
    category: 'links', scope: 'page', severity: 'notice',
    weight: 4, impact: 3, effort: 'medium', needs: ['html'],
    description: 'Ana içerikte neredeyse hiç iç bağlantı yok',
    appliesTo: (page) => page.ok && page.head.metaRobots.index && page.content.mainWordCount > 300,
    check: (page, site, ctx) => {
      const contentLinks = page.links.filter((l) => l.internal && l.area === 'main');
      if (contentLinks.length >= 3) return null;
      return ctx.fail({
        evidence: { count: contentLinks.length, words: page.content.mainWordCount },
        message: `${page.content.mainWordCount} kelimelik içerikte yalnızca ${contentLinks.length} iç bağlantı var.`,
        fix: 'Metnin içinden ilgili sayfalara bağlantı verin. Menü bağlantıları her sayfada aynıdır; konu ilişkisini asıl kuran, içerik içindeki bağlantılardır.'
      });
    }
  }),

  defineRule({
    id: 'excessive-links',
    category: 'links', scope: 'page', severity: 'notice',
    weight: 3, impact: 2, effort: 'medium', needs: ['html'],
    description: 'Sayfada aşırı bağlantı',
    appliesTo: (page) => page.ok,
    check: (page, site, ctx) => {
      if (page.links.length <= 150) return null;
      return ctx.fail({
        evidence: { count: page.links.length },
        message: `Sayfada ${page.links.length} bağlantı var.`,
        fix: 'Bağlantı sayısını azaltın veya sayfalayın. Çok sayıda bağlantı her birinin taşıdığı önemi seyreltir ve kullanıcıyı boğar.'
      });
    }
  }),

  defineRule({
    id: 'link-to-http',
    category: 'links', scope: 'page', severity: 'warning',
    weight: 5, impact: 3, effort: 'low', needs: ['html'],
    description: 'HTTPS sitede http:// iç bağlantı',
    appliesTo: (page) => page.url.startsWith('https://'),
    check: (page, site, ctx) => {
      const insecure = page.links.filter((l) => l.internal && l.insecure);
      if (insecure.length === 0) return null;
      return ctx.fail({
        evidence: { count: insecure.length, samples: insecure.slice(0, 5).map((l) => l.abs) },
        message: `${insecure.length} iç bağlantı http:// kullanıyor.`,
        fix: 'İç bağlantıları https:// ile yazın. Her http bağlantısı gereksiz bir yönlendirme adımı ekler.'
      });
    }
  })
];
