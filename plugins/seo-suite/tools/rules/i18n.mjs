// Dil ve uluslararasılaşma kuralları.

import { defineRule } from '../lib/rules.mjs';
import { normalizeUrl } from '../lib/url.mjs';

/** BCP-47 dil etiketi (tr, tr-TR, en-GB...). x-default özel değeri de geçerlidir. */
const BCP47 = /^(?:x-default|[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|\d{3}))?)$/;

export default [
  defineRule({
    id: 'lang-attribute-mismatch',
    category: 'i18n', scope: 'page', severity: 'error',
    weight: 8, impact: 4, effort: 'low', needs: ['html'],
    description: 'Beyan edilen dil içerikle uyuşmuyor',
    appliesTo: (page) => page.ok && Boolean(page.head.lang) && page.content.wordCount >= 50,
    check: (page, site, ctx) => {
      const ratio = page.content.turkishRatio;
      const declared = page.head.lang.toLowerCase();
      if (ratio < 0.06) return null; // Türkçe olduğuna dair yeterli kanıt yok
      if (declared.startsWith('tr')) return null;
      return ctx.fail({
        evidence: { declared: page.head.lang, turkishRatio: Math.round(ratio * 100) / 100 },
        message: `Sayfa lang="${page.head.lang}" beyan ediyor ama içerik Türkçe görünüyor.`,
        fix: '<html lang="tr"> olarak düzeltin. Yanlış dil beyanı, sayfanın yanlış ülke/dil hedefinde değerlendirilmesine ve ekran okuyucuların metni yanlış telaffuz etmesine yol açar.'
      });
    }
  }),

  defineRule({
    id: 'lang-region-format',
    category: 'i18n', scope: 'page', severity: 'notice',
    weight: 3, impact: 2, effort: 'low', needs: ['html'],
    description: 'lang değeri biçimsiz',
    appliesTo: (page) => page.ok && Boolean(page.head.lang),
    check: (page, site, ctx) => {
      if (BCP47.test(page.head.lang)) return null;
      return ctx.fail({
        evidence: { lang: page.head.lang },
        message: `lang değeri geçersiz biçimde: "${page.head.lang}"`,
        fix: 'BCP-47 kullanın: "tr" veya "tr-TR". Alt çizgi ("tr_TR"), üç harfli kod ("tur") veya yalnız ülke kodu ("TR") geçersizdir.'
      });
    }
  }),

  defineRule({
    id: 'hreflang-invalid-code',
    category: 'i18n', scope: 'page', severity: 'error',
    weight: 8, impact: 4, effort: 'low', needs: ['html'],
    description: 'hreflang değeri geçersiz',
    appliesTo: (page) => page.ok && page.hreflang.length > 0,
    check: (page, site, ctx) => {
      const bad = page.hreflang.filter((h) => !BCP47.test(h.lang));
      if (bad.length === 0) return null;
      return ctx.fail({
        evidence: { invalid: bad.map((b) => b.lang).slice(0, 5) },
        message: `Geçersiz hreflang değerleri: ${bad.map((b) => `"${b.lang}"`).join(', ')}`,
        fix: 'hreflang BCP-47 olmalı: "tr", "tr-TR", "en-US". Alt çizgi kullanılamaz. Geçersiz etiket tamamen yok sayılır — küme sessizce çalışmaz hâle gelir.'
      });
    }
  }),

  defineRule({
    id: 'hreflang-self-missing',
    category: 'i18n', scope: 'page', severity: 'error',
    weight: 7, impact: 4, effort: 'low', needs: ['html'],
    description: 'hreflang kümesinde kendine referans yok',
    appliesTo: (page) => page.ok && page.hreflang.length > 0,
    check: (page, site, ctx) => {
      const self = page.hreflang.some((h) => {
        const n = h.abs ? normalizeUrl(h.abs) : null;
        return n === page.normalizedUrl;
      });
      if (self) return null;
      return ctx.fail({
        evidence: { alternates: page.hreflang.map((h) => `${h.lang} → ${h.abs}`).slice(0, 5) },
        message: 'hreflang kümesinde sayfanın kendisine referans veren bir giriş yok.',
        fix: 'Her sayfa kendi hreflang etiketini de listelemelidir. Kendine referans olmayan küme geçersiz sayılır.'
      });
    }
  }),

  defineRule({
    id: 'hreflang-return-tag',
    category: 'i18n', scope: 'page', severity: 'error',
    weight: 9, impact: 4, effort: 'medium', needs: ['html', 'site'],
    description: 'hreflang karşılıklı değil (dönüş etiketi eksik)',
    appliesTo: (page, site) => page.ok && page.hreflang.length > 0 && site.pages.size > 1,
    check: (page, site, ctx) => {
      const broken = [];
      for (const alt of page.hreflang) {
        const targetUrl = alt.abs ? normalizeUrl(alt.abs) : null;
        if (!targetUrl || targetUrl === page.normalizedUrl) continue;
        const target = site.pages.get(targetUrl);
        if (!target) continue; // hedef taranmadıysa yargı verilmez
        const returns = target.hreflang.some((h) => {
          const n = h.abs ? normalizeUrl(h.abs) : null;
          return n === page.normalizedUrl;
        });
        if (!returns) broken.push({ lang: alt.lang, target: targetUrl });
      }
      if (broken.length === 0) return null;
      return ctx.fail({
        evidence: { count: broken.length, samples: broken.slice(0, 5) },
        message: `${broken.length} hreflang hedefi bu sayfaya geri bağlantı vermiyor.`,
        fix: 'hreflang karşılıklı olmak zorundadır: A sayfası B\'yi gösteriyorsa B de A\'yı göstermeli. Tek yönlü etiketler Google tarafından tamamen yok sayılır.'
      });
    }
  }),

  defineRule({
    id: 'hreflang-non-200',
    category: 'i18n', scope: 'page', severity: 'error',
    weight: 8, impact: 4, effort: 'low', needs: ['html', 'net'],
    description: 'hreflang hedefi 200 dönmüyor',
    appliesTo: (page, site) => page.ok && page.hreflang.length > 0 && site.urlStatus.size > 0,
    check: (page, site, ctx) => {
      const bad = [];
      for (const alt of page.hreflang) {
        const n = alt.abs ? normalizeUrl(alt.abs) : null;
        if (!n) continue;
        const rec = site.urlStatus.get(n);
        if (!rec || rec.status === 0) continue;
        if (rec.status >= 400 || rec.redirects > 0) {
          bad.push({ lang: alt.lang, url: n, status: rec.status, redirects: rec.redirects });
        }
      }
      if (bad.length === 0) return null;
      return ctx.fail({
        evidence: { count: bad.length, samples: bad.slice(0, 5) },
        message: `${bad.length} hreflang hedefi 404 dönüyor veya yönlendiriliyor.`,
        fix: 'hreflang yalnızca doğrudan 200 dönen adresleri göstermeli. Kırık hedef tüm kümeyi geçersiz kılar.'
      });
    }
  }),

  defineRule({
    id: 'hreflang-canonical-conflict',
    category: 'i18n', scope: 'page', severity: 'error',
    weight: 8, impact: 4, effort: 'medium', needs: ['html'],
    description: 'hreflang ile canonical çelişiyor',
    appliesTo: (page) => page.ok && page.hreflang.length > 0 && Boolean(page.head.canonical),
    check: (page, site, ctx) => {
      const canonical = normalizeUrl(page.head.canonical);
      if (!canonical || canonical === page.normalizedUrl) return null;
      return ctx.fail({
        evidence: { canonical, page: page.normalizedUrl, alternates: page.hreflang.length },
        message: `Sayfa hreflang kümesinde ama canonical başka bir URL'yi gösteriyor: ${canonical}`,
        fix: 'hreflang kümesindeki her sayfanın canonical\'ı kendisini göstermelidir. Aksi hâlde Google "bu sayfa asıl değil" der ve dil hedeflemesini uygulamaz.'
      });
    }
  }),

  defineRule({
    id: 'hreflang-x-default-missing',
    category: 'i18n', scope: 'site', severity: 'notice',
    weight: 3, impact: 2, effort: 'low', needs: ['site'],
    description: 'Çok dilli kümede x-default yok',
    appliesTo: (site) => {
      const langs = new Set();
      for (const p of site.pages.values()) for (const h of p.hreflang) langs.add(h.lang);
      return langs.size >= 2;
    },
    check: (site, _site, ctx) => {
      const langs = new Set();
      for (const p of site.pages.values()) for (const h of p.hreflang) langs.add(h.lang);
      if (langs.has('x-default')) return null;
      return ctx.fail({
        evidence: { langs: [...langs] },
        message: `hreflang kümesinde ${langs.size} dil var ama x-default tanımlı değil.`,
        fix: 'Hiçbir dil eşleşmediğinde gösterilecek sürüm için hreflang="x-default" ekleyin (genelde dil seçim sayfası veya İngilizce sürüm).'
      });
    }
  }),

  defineRule({
    id: 'hreflang-missing-multilocale',
    category: 'i18n', scope: 'site', severity: 'warning',
    weight: 6, impact: 4, effort: 'medium', needs: ['site'],
    description: 'Birden fazla dil var ama hiç hreflang yok',
    appliesTo: (site) => site.locales.length >= 2,
    check: (site, _site, ctx) => {
      const anyHreflang = [...site.pages.values()].some((p) => p.hreflang.length > 0);
      if (anyHreflang) return null;
      return ctx.fail({
        evidence: { locales: site.locales },
        message: `Sitede ${site.locales.length} farklı dil beyanı var (${site.locales.join(', ')}) ama hiç hreflang tanımı yok.`,
        fix: 'Dil sürümleri arasında karşılıklı hreflang kurun. Aksi hâlde Google bunları ayrı ayrı (ve muhtemelen yinelenen içerik olarak) değerlendirir.'
      });
    }
  })
];
