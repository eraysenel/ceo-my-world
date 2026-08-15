// Yapısal veri (schema.org) kuralları.

import { defineRule } from '../lib/rules.mjs';
import { trLower, truncate } from '../lib/text.mjs';

/** Sık kullanılan türler için zorunlu sayılan alanlar. */
const REQUIRED_PROPS = {
  Article: ['headline', 'datePublished', 'author'],
  NewsArticle: ['headline', 'datePublished', 'author'],
  BlogPosting: ['headline', 'datePublished', 'author'],
  Product: ['name', 'offers'],
  Service: ['name', 'provider'],
  LocalBusiness: ['name', 'address', 'telephone'],
  Organization: ['name', 'url'],
  FAQPage: ['mainEntity'],
  BreadcrumbList: ['itemListElement'],
  VideoObject: ['name', 'thumbnailUrl', 'uploadDate'],
  Event: ['name', 'startDate', 'location']
};

/** Hizmet sayfası olduğunu düşündüren yol/başlık kalıpları. */
const SERVICE_HINTS = /(hizmet|dublaj|seslendirme|fiyat|paket|cozum|çözüm|service|pricing)/i;

function flattenNodes(parsed, acc = []) {
  if (Array.isArray(parsed)) {
    for (const item of parsed) flattenNodes(item, acc);
    return acc;
  }
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed['@graph'])) flattenNodes(parsed['@graph'], acc);
    if (parsed['@type']) acc.push(parsed);
  }
  return acc;
}

export default [
  defineRule({
    id: 'jsonld-parse-error',
    category: 'structured-data', scope: 'page', severity: 'error',
    weight: 9, impact: 4, effort: 'low', needs: ['html'],
    description: 'JSON-LD bloğu ayrıştırılamıyor',
    appliesTo: (page) => page.ok && page.jsonld.blocks.length > 0,
    check: (page, site, ctx) => {
      const broken = page.jsonld.blocks.filter((b) => b.error);
      if (broken.length === 0) return null;
      return ctx.fail({
        evidence: { count: broken.length, errors: broken.map((b) => b.error).slice(0, 3), sample: truncate(broken[0].raw, 160) },
        message: `${broken.length} JSON-LD bloğu geçersiz: ${broken[0].error}`,
        fix: 'JSON sözdizimini düzeltin (en sık neden: sondaki fazladan virgül veya kaçırılmamış tırnak). Bozuk blok tamamen yok sayılır — yapısal verinin hiçbiri okunmaz.'
      });
    }
  }),

  defineRule({
    id: 'jsonld-missing',
    category: 'structured-data', scope: 'page', severity: 'warning',
    weight: 6, impact: 3, effort: 'medium', needs: ['html'],
    description: 'Sayfada hiç JSON-LD yok',
    appliesTo: (page) => page.ok && page.head.metaRobots.index,
    check: (page, site, ctx) => {
      if (page.jsonld.blocks.length > 0) return null;
      return ctx.fail({
        evidence: {},
        message: 'Sayfada hiç yapısal veri (JSON-LD) yok.',
        fix: 'Sayfa türüne uygun schema.org işaretlemesi ekleyin. Yapısal veri sıralamayı doğrudan yükseltmez ama içeriğin ne olduğunu makineye açıkça söyler; zengin sonuçlarda ve AI özetlerinde alıntılanma olasılığını artırır.'
      });
    }
  }),

  defineRule({
    id: 'jsonld-context-invalid',
    category: 'structured-data', scope: 'page', severity: 'error',
    weight: 7, impact: 3, effort: 'low', needs: ['html'],
    description: '@context eksik veya schema.org değil',
    appliesTo: (page) => page.ok && page.jsonld.blocks.some((b) => b.parsed),
    check: (page, site, ctx) => {
      const bad = page.jsonld.blocks.filter((b) => {
        if (!b.parsed) return false;
        const nodes = Array.isArray(b.parsed) ? b.parsed : [b.parsed];
        return nodes.some((n) => {
          const ctxVal = n?.['@context'];
          if (!ctxVal) return true;
          return !JSON.stringify(ctxVal).includes('schema.org');
        });
      });
      if (bad.length === 0) return null;
      return ctx.fail({
        evidence: { count: bad.length },
        message: `${bad.length} JSON-LD bloğunda @context eksik veya schema.org değil.`,
        fix: 'Her blok "@context": "https://schema.org" ile başlamalı. Bağlam olmadan tipler tanınmaz.'
      });
    }
  }),

  defineRule({
    id: 'jsonld-required-props',
    category: 'structured-data', scope: 'page', severity: 'error',
    weight: 8, impact: 4, effort: 'medium', needs: ['html'],
    description: 'Şema türünün zorunlu alanları eksik',
    appliesTo: (page) => page.ok && page.jsonld.blocks.some((b) => b.parsed),
    check: (page, site, ctx) => {
      const problems = [];
      for (const block of page.jsonld.blocks) {
        if (!block.parsed) continue;
        for (const node of flattenNodes(block.parsed)) {
          const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
          for (const type of types) {
            const required = REQUIRED_PROPS[type];
            if (!required) continue;
            const missing = required.filter((p) => node[p] === undefined || node[p] === null || node[p] === '');
            if (missing.length) problems.push({ type, missing });
          }
        }
      }
      if (problems.length === 0) return null;
      return ctx.fail({
        evidence: { problems: problems.slice(0, 5) },
        message: problems.map((p) => `${p.type}: ${p.missing.join(', ')} eksik`).slice(0, 3).join('; '),
        fix: 'Eksik alanları tamamlayın. Zorunlu alanı olmayan şema zengin sonuç için uygun sayılmaz; Search Console\'da "geçersiz öğe" olarak raporlanır.'
      });
    }
  }),

  defineRule({
    id: 'jsonld-faq-mismatch',
    category: 'structured-data', scope: 'page', severity: 'error',
    weight: 7, impact: 4, effort: 'low', needs: ['html'],
    description: 'FAQPage şemasındaki soru sayfada görünmüyor',
    appliesTo: (page) => page.ok && page.jsonld.types.includes('FAQPage'),
    check: (page, site, ctx) => {
      const bodyText = trLower(page.content.text);
      const missing = [];
      for (const block of page.jsonld.blocks) {
        if (!block.parsed) continue;
        for (const node of flattenNodes(block.parsed)) {
          if (node['@type'] !== 'FAQPage') continue;
          const entities = Array.isArray(node.mainEntity) ? node.mainEntity : [node.mainEntity].filter(Boolean);
          for (const q of entities) {
            const name = typeof q?.name === 'string' ? q.name : null;
            if (!name) continue;
            const probe = trLower(name).slice(0, 40);
            if (probe && !bodyText.includes(probe)) missing.push(name);
          }
        }
      }
      if (missing.length === 0) return null;
      return ctx.fail({
        evidence: { count: missing.length, samples: missing.slice(0, 3) },
        message: `FAQPage şemasındaki ${missing.length} soru sayfanın görünür içeriğinde yok.`,
        fix: 'Yapısal veri yalnızca sayfada görünen içeriği işaretlemelidir. Görünmeyen soru-cevap işaretlemek Google\'ın yapısal veri politikasına aykırıdır ve manuel işlem riski taşır.'
      });
    }
  }),

  defineRule({
    id: 'jsonld-service-missing',
    category: 'structured-data', scope: 'page', severity: 'warning',
    weight: 6, impact: 4, effort: 'medium', needs: ['html'],
    description: 'Hizmet sayfasında Service/Offer şeması yok',
    appliesTo: (page) => page.ok && page.head.metaRobots.index &&
      (SERVICE_HINTS.test(page.url) || SERVICE_HINTS.test(page.headings.h1[0] ?? '')),
    check: (page, site, ctx) => {
      const has = page.jsonld.types.some((t) => ['Service', 'Offer', 'Product', 'ProfessionalService'].includes(t));
      if (has) return null;
      return ctx.fail({
        evidence: { types: page.jsonld.types, h1: page.headings.h1[0] ?? null },
        message: 'Hizmet sayfası görünüyor ama Service/Offer yapısal verisi yok.',
        fix: 'Service şeması ekleyin: name, provider, areaServed, serviceType ve mümkünse offers (fiyat aralığı). Hizmet sayfaları için en doğrudan makine-okunur konumlandırma budur.'
      });
    }
  }),

  defineRule({
    id: 'jsonld-breadcrumb-missing',
    category: 'structured-data', scope: 'page', severity: 'notice',
    weight: 4, impact: 2, effort: 'low', needs: ['html'],
    description: 'Derin sayfada BreadcrumbList yok',
    appliesTo: (page) => page.ok && page.head.metaRobots.index && page.pathDepth >= 2,
    check: (page, site, ctx) => {
      if (page.jsonld.types.includes('BreadcrumbList')) return null;
      return ctx.fail({
        evidence: { depth: page.pathDepth },
        message: `${page.pathDepth} seviye derinlikteki sayfada BreadcrumbList yok.`,
        fix: 'BreadcrumbList ekleyin. Arama sonucunda çıplak URL yerine site hiyerarşisi gösterilir; bu hem tıklanma oranını hem de sayfanın bağlamının anlaşılmasını iyileştirir.'
      });
    }
  }),

  defineRule({
    id: 'og-missing',
    category: 'structured-data', scope: 'page', severity: 'warning',
    weight: 5, impact: 3, effort: 'low', needs: ['html'],
    description: 'Open Graph etiketleri eksik',
    appliesTo: (page) => page.ok && page.head.metaRobots.index,
    check: (page, site, ctx) => {
      const required = ['title', 'description', 'image', 'url'];
      const missing = required.filter((k) => !page.social.og[k]);
      if (missing.length === 0) return null;
      return ctx.fail({
        evidence: { missing, present: Object.keys(page.social.og) },
        message: `Open Graph etiketleri eksik: ${missing.map((m) => `og:${m}`).join(', ')}`,
        fix: 'og:title, og:description, og:image ve og:url ekleyin. Bunlar olmadan WhatsApp, LinkedIn ve X üzerinde paylaşılan bağlantı görselsiz ve başlıksız görünür — sosyal trafikte doğrudan kayıp.'
      });
    }
  }),

  defineRule({
    id: 'twitter-card-missing',
    category: 'structured-data', scope: 'page', severity: 'notice',
    weight: 3, impact: 2, effort: 'low', needs: ['html'],
    description: 'twitter:card yok',
    appliesTo: (page) => page.ok && page.head.metaRobots.index,
    check: (page, site, ctx) => {
      if (page.social.twitter.card) return null;
      return ctx.fail({
        evidence: {},
        message: 'twitter:card etiketi yok.',
        fix: '<meta name="twitter:card" content="summary_large_image"> ekleyin; X üzerinde büyük görselli kart gösterilir.'
      });
    }
  }),

  defineRule({
    id: 'jsonld-organization-missing',
    category: 'structured-data', scope: 'site', severity: 'warning',
    weight: 6, impact: 4, effort: 'low', needs: ['site'],
    description: 'Ana sayfada Organization/LocalBusiness yok',
    check: (site, _site, ctx) => {
      const home = [...site.pages.values()].sort((a, b) => a.pathDepth - b.pathDepth)[0];
      if (!home) return null;
      const has = home.jsonld.types.some((t) => ['Organization', 'LocalBusiness', 'ProfessionalService', 'Corporation'].includes(t));
      if (has) return null;
      return ctx.fail({
        page: home.normalizedUrl,
        evidence: { types: home.jsonld.types },
        message: 'Ana sayfada Organization (veya LocalBusiness) yapısal verisi yok.',
        fix: 'Ana sayfaya Organization ekleyin: name, url, logo, sameAs (sosyal profiller), contactPoint. Bu, markanızın bilgi grafiğinde bir varlık olarak tanınmasının temel adımıdır.'
      });
    }
  }),

  defineRule({
    id: 'jsonld-sameas-missing',
    category: 'structured-data', scope: 'site', severity: 'notice',
    weight: 4, impact: 3, effort: 'low', needs: ['site'],
    description: 'Organization.sameAs yok',
    appliesTo: (site) => [...site.pages.values()].some((p) => p.jsonld.types.includes('Organization')),
    check: (site, _site, ctx) => {
      for (const page of site.pages.values()) {
        for (const block of page.jsonld.blocks) {
          if (!block.parsed) continue;
          for (const node of flattenNodes(block.parsed)) {
            const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
            if (!types.includes('Organization')) continue;
            if (node.sameAs && (Array.isArray(node.sameAs) ? node.sameAs.length : true)) return null;
          }
        }
      }
      return ctx.fail({
        evidence: {},
        message: 'Organization şemasında sameAs alanı yok.',
        fix: 'sameAs içine resmi sosyal medya ve varsa Wikidata/Vikipedi adreslerini ekleyin. Bu bağlantılar, markanın aynı varlık olarak tanınmasını sağlar ve marka aramalarında bilgi paneli olasılığını artırır.'
      });
    }
  })
];
