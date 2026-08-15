// Sayfa içi (on-page) kurallar.

import { defineRule } from '../lib/rules.mjs';
import { truncate } from '../lib/text.mjs';

/** Google masaüstü SERP'inde başlığın kesilmeden sığdığı yaklaşık genişlik. */
export const TITLE_MAX_PX = 580;
/** Açıklama için pratik üst sınır. */
export const DESC_MAX_PX = 990;

const indexableHtml = (page) => page.ok && page.head.metaRobots.index;

export default [
  defineRule({
    id: 'title-missing',
    category: 'onpage', scope: 'page', severity: 'critical',
    weight: 10, impact: 5, effort: 'low', needs: ['html'],
    description: 'Sayfada <title> yok',
    appliesTo: indexableHtml,
    check: (page, site, ctx) => {
      if (page.head.title) return null;
      return ctx.fail({
        evidence: {},
        message: 'Sayfada <title> etiketi yok veya boş.',
        fix: 'Her sayfaya benzersiz, hedef aramayı yansıtan bir başlık yazın. Başlık, arama sonucunda tıklanan bağlantının kendisidir; eksikse Google sayfadan rastgele metin seçer.'
      });
    }
  }),

  defineRule({
    id: 'title-pixel-width',
    category: 'onpage', scope: 'page', severity: 'warning',
    weight: 7, impact: 4, effort: 'low', needs: ['html'],
    description: 'Başlık SERP genişliğini aşıyor',
    appliesTo: (page) => indexableHtml(page) && Boolean(page.head.title),
    check: (page, site, ctx) => {
      const px = page.head.titlePx;
      if (px <= TITLE_MAX_PX) return null;
      const chars = [...page.head.title].length;
      return ctx.fail({
        evidence: { px, limit: TITLE_MAX_PX, chars, title: page.head.title },
        message: `Başlık SERP'te kesilecek: ${px}px (sınır ${TITLE_MAX_PX}px), ${chars} karakter.`,
        fix: 'Başlığı kısaltın veya marka ekini ("| Marka") sadeleştirin. Ölçü karakter değil pikseldir: Türkçede "ı" ve "i" dar, "m" ve "ğ" geniştir — 55 karakterlik bir başlık sığabilir, 50 karakterlik başka bir başlık sığmayabilir.'
      });
    }
  }),

  defineRule({
    id: 'title-too-short',
    category: 'onpage', scope: 'page', severity: 'notice',
    weight: 4, impact: 3, effort: 'low', needs: ['html'],
    description: 'Başlık çok kısa',
    appliesTo: (page) => indexableHtml(page) && Boolean(page.head.title),
    check: (page, site, ctx) => {
      const chars = [...page.head.title].length;
      if (chars >= 30) return null;
      return ctx.fail({
        evidence: { chars, title: page.head.title },
        message: `Başlık yalnızca ${chars} karakter: "${page.head.title}"`,
        fix: 'Kullanılabilir alanı değerlendirin: hedef aramayı ve ayırt edici bir nitelik ekleyin (ör. "Reklam Seslendirme Fiyatları ve Süreç | Marka").'
      });
    }
  }),

  defineRule({
    id: 'title-duplicate',
    category: 'onpage', scope: 'site', severity: 'error',
    weight: 8, impact: 4, effort: 'medium', needs: ['site'],
    description: 'Aynı başlık birden çok sayfada',
    appliesTo: (site) => site.pages.size > 1,
    check: (site, _site, ctx) => {
      const out = [];
      for (const [, urls] of site.clusters.duplicateTitles) {
        if (urls.length < 2) continue;
        const title = site.pages.get(urls[0])?.head.title ?? '';
        out.push(ctx.fail({
          pages: urls,
          evidence: { title, count: urls.length, urls: urls.slice(0, 10) },
          message: `${urls.length} sayfa aynı başlığı kullanıyor: "${truncate(title, 70)}"`,
          fix: 'Her sayfaya benzersiz başlık yazın. Aynı başlık, Google\'a "bu sayfalar aynı" der; biri seçilir, diğerleri elenir.'
        }));
      }
      return out;
    }
  }),

  defineRule({
    id: 'meta-description-missing',
    category: 'onpage', scope: 'page', severity: 'warning',
    weight: 6, impact: 3, effort: 'low', needs: ['html'],
    description: 'meta description yok',
    appliesTo: indexableHtml,
    check: (page, site, ctx) => {
      if (page.head.metaDescription) return null;
      return ctx.fail({
        evidence: {},
        message: 'Sayfada meta description yok.',
        fix: 'Sayfanın ne sunduğunu ve neden tıklanması gerektiğini anlatan 120-155 karakterlik bir açıklama yazın. Sıralamayı doğrudan etkilemez ama tıklanma oranını belirgin şekilde etkiler.'
      });
    }
  }),

  defineRule({
    id: 'meta-description-length',
    category: 'onpage', scope: 'page', severity: 'notice',
    weight: 4, impact: 2, effort: 'low', needs: ['html'],
    description: 'Açıklama çok kısa veya çok uzun',
    appliesTo: (page) => indexableHtml(page) && Boolean(page.head.metaDescription),
    check: (page, site, ctx) => {
      const chars = [...page.head.metaDescription].length;
      const px = page.head.metaDescriptionPx;
      if (chars >= 70 && px <= DESC_MAX_PX) return null;
      const reason = chars < 70 ? `çok kısa (${chars} karakter)` : `çok uzun (${px}px, sınır ${DESC_MAX_PX}px)`;
      return ctx.fail({
        evidence: { chars, px, limit: DESC_MAX_PX },
        message: `Meta description ${reason}.`,
        fix: 'Açıklamayı 120-155 karakter aralığına getirin; en önemli bilgiyi başa koyun, çünkü sonu kesilebilir.'
      });
    }
  }),

  defineRule({
    id: 'meta-description-duplicate',
    category: 'onpage', scope: 'site', severity: 'warning',
    weight: 5, impact: 3, effort: 'medium', needs: ['site'],
    description: 'Aynı açıklama birden çok sayfada',
    appliesTo: (site) => site.pages.size > 1,
    check: (site, _site, ctx) => {
      const out = [];
      for (const [, urls] of site.clusters.duplicateDescriptions) {
        if (urls.length < 2) continue;
        const desc = site.pages.get(urls[0])?.head.metaDescription ?? '';
        out.push(ctx.fail({
          pages: urls,
          evidence: { description: truncate(desc, 90), count: urls.length, urls: urls.slice(0, 10) },
          message: `${urls.length} sayfa aynı meta description'ı kullanıyor.`,
          fix: 'Her sayfaya o sayfaya özgü bir açıklama yazın; şablon açıklama tıklanma oranını düşürür.'
        }));
      }
      return out;
    }
  }),

  defineRule({
    id: 'h1-missing',
    category: 'onpage', scope: 'page', severity: 'error',
    weight: 8, impact: 4, effort: 'low', needs: ['html'],
    description: 'Sayfada H1 yok',
    appliesTo: indexableHtml,
    check: (page, site, ctx) => {
      if (page.headings.h1.length > 0) return null;
      return ctx.fail({
        evidence: { headingCounts: page.headings.counts },
        message: 'Sayfada H1 başlığı yok.',
        fix: 'Her sayfada sayfanın ana konusunu söyleyen tek bir H1 bulunsun. H1, hem kullanıcı hem tarayıcı için sayfanın konu beyanıdır.'
      });
    }
  }),

  defineRule({
    id: 'h1-count',
    category: 'onpage', scope: 'page', severity: 'warning',
    weight: 5, impact: 3, effort: 'low', needs: ['html'],
    description: 'Birden fazla H1',
    appliesTo: indexableHtml,
    check: (page, site, ctx) => {
      if (page.headings.h1.length <= 1) return null;
      return ctx.fail({
        evidence: { count: page.headings.h1.length, headings: page.headings.h1.slice(0, 5) },
        message: `Sayfada ${page.headings.h1.length} adet H1 var.`,
        fix: 'Tek H1 bırakın, diğerlerini H2\'ye indirin. Birden çok H1 sayfanın ana konusunu belirsizleştirir.'
      });
    }
  }),

  defineRule({
    id: 'heading-hierarchy-skip',
    category: 'onpage', scope: 'page', severity: 'notice',
    weight: 3, impact: 2, effort: 'low', needs: ['html'],
    description: 'Başlık seviyesi atlanmış (H2 → H4)',
    appliesTo: indexableHtml,
    check: (page, site, ctx) => {
      if (page.headings.jumps.length === 0) return null;
      const j = page.headings.jumps[0];
      return ctx.fail({
        evidence: { jumps: page.headings.jumps.slice(0, 5) },
        message: `Başlık hiyerarşisinde atlama var: H${j.from} → H${j.to} ("${truncate(j.text, 50)}").`,
        fix: 'Başlıkları sırayla kullanın (H1 → H2 → H3). Hiyerarşi hem ekran okuyucular hem de içeriğin yapısını çıkaran sistemler için anlam taşır; görsel boyut için CSS kullanın.'
      });
    }
  }),

  defineRule({
    id: 'heading-empty',
    category: 'onpage', scope: 'page', severity: 'notice',
    weight: 2, impact: 2, effort: 'low', needs: ['html'],
    description: 'Metni olmayan başlık etiketi',
    appliesTo: indexableHtml,
    check: (page, site, ctx) => {
      const empties = page.headings.tree.filter((h) => h.empty);
      if (empties.length === 0) return null;
      return ctx.fail({
        evidence: { count: empties.length, levels: empties.map((e) => `h${e.level}`) },
        message: `${empties.length} başlık etiketinin içi boş.`,
        fix: 'Boş başlık etiketlerini kaldırın; yalnızca ikon veya dekoratif amaçla kullanılıyorsa <div> tercih edin.'
      });
    }
  }),

  defineRule({
    id: 'thin-content',
    category: 'onpage', scope: 'page', severity: 'warning',
    weight: 6, impact: 4, effort: 'high', needs: ['html'],
    description: 'İçerik çok az',
    appliesTo: (page) => indexableHtml(page) && !page.flags.softNotFound,
    check: (page, site, ctx) => {
      const min = ctx.config?.minWords ?? 300;
      if (page.content.mainWordCount >= min) return null;
      return ctx.fail({
        evidence: { words: page.content.mainWordCount, min },
        message: `Ana içerik yalnızca ${page.content.mainWordCount} kelime (eşik ${min}).`,
        fix: 'Sayfanın hizmet ettiği aramanın tüm alt sorularını yanıtlayın: ne, kime, nasıl, ne kadar, ne kadar sürede. Kelime sayısı hedef değil sonuçtur — eksik olan cevaplardır.'
      });
    }
  }),

  defineRule({
    id: 'turkish-mojibake',
    category: 'onpage', scope: 'page', severity: 'critical',
    weight: 9, impact: 5, effort: 'low', needs: ['html'],
    description: 'Bozuk karakter kodlaması',
    appliesTo: (page) => page.ok,
    check: (page, site, ctx) => {
      const m = page.content.mojibake;
      if (!m) return null;
      return ctx.fail({
        evidence: { sequences: m.sequences.slice(0, 6), total: m.total },
        message: `Sayfada bozuk karakter kodlaması var (${m.sequences.map((s) => s.seq).join(', ')} — toplam ${m.total} kez).`,
        fix: 'İçerik UTF-8 olarak kaydedilmeli ve UTF-8 olarak sunulmalı. Bu hata "Türkçe" yerine "TÃ¼rkÃ§e" gösterir; hem kullanıcıyı kaçırır hem de anahtar kelimeleri tanınmaz hâle getirir. Veritabanı bağlantı karakter setini ve HTTP Content-Type başlığını birlikte kontrol edin.'
      });
    }
  }),

  defineRule({
    id: 'charset-declaration-late',
    category: 'onpage', scope: 'page', severity: 'error',
    weight: 7, impact: 4, effort: 'low', needs: ['html'],
    description: '<meta charset> ilk 1024 baytta değil',
    appliesTo: (page) => page.ok,
    check: (page, site, ctx) => {
      if (page.head.charsetBytePos !== null && page.head.charsetBytePos <= 1024) return null;
      if (page.head.charsetBytePos === null && /charset=/i.test(page.headers['content-type'] ?? '')) return null;
      return ctx.fail({
        evidence: { bytePos: page.head.charsetBytePos, charset: page.head.charset },
        message: page.head.charsetBytePos === null
          ? '<meta charset> etiketi yok ve HTTP başlığında da charset belirtilmemiş.'
          : `<meta charset> belgenin ${page.head.charsetBytePos}. baytında — çok geç.`,
        fix: '<meta charset="utf-8"> etiketini <head> içinde ilk satıra koyun. Tarayıcı ilk 1024 baytta kodlamayı göremezse tahmin yürütür; Türkçe karakterler bozulur.'
      });
    }
  }),

  defineRule({
    id: 'viewport-meta-missing',
    category: 'onpage', scope: 'page', severity: 'error',
    weight: 7, impact: 4, effort: 'low', needs: ['html'],
    description: 'Mobil viewport tanımı yok',
    appliesTo: (page) => page.ok,
    check: (page, site, ctx) => {
      const vp = page.head.viewport;
      if (vp && /width\s*=\s*device-width/i.test(vp)) return null;
      return ctx.fail({
        evidence: { viewport: vp },
        message: vp ? `Viewport sabit genişlikte: "${vp}"` : 'Sayfada viewport meta etiketi yok.',
        fix: '<meta name="viewport" content="width=device-width, initial-scale=1"> ekleyin. Google mobil sürümü indexler; viewport yoksa sayfa masaüstü genişliğinde küçültülerek gösterilir.'
      });
    }
  }),

  defineRule({
    id: 'lang-attribute-missing',
    category: 'onpage', scope: 'page', severity: 'error',
    weight: 8, impact: 4, effort: 'low', needs: ['html'],
    description: '<html lang> yok',
    appliesTo: (page) => page.ok,
    check: (page, site, ctx) => {
      if (page.head.lang) return null;
      return ctx.fail({
        evidence: {},
        message: '<html> etiketinde lang özniteliği yok.',
        fix: '<html lang="tr"> yazın. Dil beyanı olmadan ekran okuyucular yanlış telaffuz eder, arama motorları hedef kitleyi yanlış tahmin eder.'
      });
    }
  })
];
