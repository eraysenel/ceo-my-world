// Görsel ve medya kuralları.

import { defineRule } from '../lib/rules.mjs';
import { trLower, tokenize } from '../lib/text.mjs';

const BAD_FILENAME = /(?:^|\/)(?:img[_-]?\d+|dsc[_-]?\d+|image\d*|photo\d*|adsiz|untitled|screenshot)[^/]*$/i;

export default [
  defineRule({
    id: 'img-missing-alt',
    category: 'media', scope: 'page', severity: 'error',
    weight: 8, impact: 4, effort: 'low', needs: ['html'],
    description: 'alt özniteliği hiç olmayan görsel',
    appliesTo: (page) => page.ok && page.media.images.length > 0,
    check: (page, site, ctx) => {
      const missing = page.media.images.filter((i) => !i.hasAltAttr);
      if (missing.length === 0) return null;
      return ctx.fail({
        evidence: { count: missing.length, total: page.media.images.length, samples: missing.slice(0, 5).map((i) => i.src) },
        message: `${page.media.images.length} görselin ${missing.length} tanesinde alt özniteliği hiç yok.`,
        fix: 'Her görsele alt ekleyin. Dekoratifse alt="" bırakın (bu bilinçli bir beyandır), içerik taşıyorsa görselin ne anlattığını yazın. Eksik alt, ekran okuyucuda dosya adının okunmasına yol açar.'
      });
    }
  }),

  defineRule({
    id: 'img-alt-quality',
    category: 'media', scope: 'page', severity: 'notice',
    weight: 4, impact: 2, effort: 'low', needs: ['html'],
    description: 'alt metni çok uzun, dosya adının kopyası veya kelime yığını',
    appliesTo: (page) => page.ok && page.media.images.some((i) => i.altText),
    check: (page, site, ctx) => {
      const bad = [];
      for (const img of page.media.images) {
        if (!img.altText) continue;
        const alt = img.altText;
        if (alt.length > 125) { bad.push({ src: img.src, reason: `${alt.length} karakter` }); continue; }
        const file = (img.src ?? '').split('/').pop() ?? '';
        if (file && trLower(alt) === trLower(file.replace(/\.[a-z0-9]+$/i, ''))) {
          bad.push({ src: img.src, reason: 'dosya adının kopyası' });
          continue;
        }
        const tokens = tokenize(alt);
        const counts = new Map();
        for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
        if ([...counts.values()].some((c) => c >= 3)) bad.push({ src: img.src, reason: 'kelime tekrarı' });
      }
      if (bad.length === 0) return null;
      return ctx.fail({
        evidence: { count: bad.length, samples: bad.slice(0, 5) },
        message: `${bad.length} görselin alt metni sorunlu.`,
        fix: 'Alt metni görseli gören birine tarif eder gibi yazın; 125 karakteri geçmesin, anahtar kelime doldurmayın.'
      });
    }
  }),

  defineRule({
    id: 'img-missing-dimensions',
    category: 'media', scope: 'page', severity: 'warning',
    weight: 7, impact: 4, effort: 'low', needs: ['html'],
    description: 'width/height yok — düzen kayması (CLS) riski',
    appliesTo: (page) => page.ok && page.media.images.length > 0,
    check: (page, site, ctx) => {
      const missing = page.media.images.filter((i) => !i.hasDimensions);
      if (missing.length === 0) return null;
      return ctx.fail({
        evidence: { count: missing.length, total: page.media.images.length, samples: missing.slice(0, 5).map((i) => i.src) },
        message: `${missing.length} görselde width/height (veya aspect-ratio) yok.`,
        fix: 'Her görsele width ve height yazın. Tarayıcı yeri önceden ayıramazsa görsel yüklendiğinde içerik aşağı kayar — bu doğrudan CLS puanını bozar ve kullanıcı yanlış yere tıklar.'
      });
    }
  }),

  defineRule({
    id: 'img-legacy-format',
    category: 'media', scope: 'page', severity: 'notice',
    weight: 4, impact: 3, effort: 'medium', needs: ['html'],
    description: 'Modern görsel biçimi (WebP/AVIF) kullanılmıyor',
    appliesTo: (page) => page.ok && page.media.images.some((i) => i.format),
    check: (page, site, ctx) => {
      const legacy = page.media.images.filter((i) => (i.format === 'jpg' || i.format === 'jpeg' || i.format === 'png') && !i.modernFormat);
      if (legacy.length === 0) return null;
      return ctx.fail({
        evidence: { count: legacy.length, samples: legacy.slice(0, 5).map((i) => i.src) },
        message: `${legacy.length} görsel JPEG/PNG olarak sunuluyor, modern biçim alternatifi yok.`,
        fix: 'WebP veya AVIF sunun (<picture> ile geriye dönük uyumlu). Aynı görsel kalitesinde tipik olarak %25-50 daha az bayt — LCP üzerinde doğrudan etki.'
      });
    }
  }),

  defineRule({
    id: 'img-lazy-missing',
    category: 'media', scope: 'page', severity: 'notice',
    weight: 4, impact: 3, effort: 'low', needs: ['html'],
    description: 'Ekran altındaki görsellerde loading="lazy" yok',
    appliesTo: (page) => page.ok && page.media.images.length > 3,
    check: (page, site, ctx) => {
      // İlk 2 görsel ekranın üstünde kabul edilir; gerisi tembel yüklenmeli.
      const below = page.media.images.slice(2).filter((i) => i.loading !== 'lazy');
      if (below.length === 0) return null;
      return ctx.fail({
        evidence: { count: below.length, samples: below.slice(0, 5).map((i) => i.src) },
        message: `Ekranın altında kalması muhtemel ${below.length} görselde loading="lazy" yok.`,
        fix: 'İlk ekranda görünmeyen görsellere loading="lazy" ekleyin. İlk ekrandaki görsele ASLA lazy koymayın — LCP\'yi geciktirir.'
      });
    }
  }),

  defineRule({
    id: 'img-filename-quality',
    category: 'media', scope: 'page', severity: 'notice',
    weight: 3, impact: 2, effort: 'medium', needs: ['html'],
    description: 'Anlamsız veya Türkçe karakterli görsel dosya adı',
    appliesTo: (page) => page.ok && page.media.images.length > 0,
    check: (page, site, ctx) => {
      const bad = page.media.images.filter((i) => {
        const src = i.src ?? '';
        return BAD_FILENAME.test(src) || /[ıİşŞğĞüÜöÖçÇ\s]/.test(src.split('/').pop() ?? '');
      });
      if (bad.length === 0) return null;
      return ctx.fail({
        evidence: { count: bad.length, samples: bad.slice(0, 5).map((i) => i.src) },
        message: `${bad.length} görsel dosya adı anlamsız veya Türkçe karakter/boşluk içeriyor.`,
        fix: 'Dosya adlarını ASCII slug yapın: "IMG_2043.jpg" yerine "reklam-seslendirme-studyosu.jpg". Türkçe karakterli dosya adları farklı sunucularda farklı kodlanır ve görsel aramada okunmaz.'
      });
    }
  }),

  defineRule({
    id: 'video-missing-schema',
    category: 'media', scope: 'page', severity: 'warning',
    weight: 6, impact: 4, effort: 'medium', needs: ['html'],
    description: 'Video var ama VideoObject yapısal verisi yok',
    appliesTo: (page) => page.ok && page.media.videos.length > 0,
    check: (page, site, ctx) => {
      if (page.jsonld.types.includes('VideoObject')) return null;
      return ctx.fail({
        evidence: { videos: page.media.videos.length, types: page.jsonld.types },
        message: `Sayfada ${page.media.videos.length} video var ama VideoObject yapısal verisi yok.`,
        fix: 'VideoObject ekleyin (name, description, thumbnailUrl, uploadDate, duration). Video zengin sonuçları ve Google Video sekmesinde görünürlük buna bağlıdır.'
      });
    }
  }),

  defineRule({
    id: 'audio-missing-transcript',
    category: 'media', scope: 'page', severity: 'warning',
    weight: 6, impact: 4, effort: 'medium', needs: ['html'],
    description: 'Ses içeriğinin metin karşılığı yok',
    appliesTo: (page) => page.ok && page.media.audios.length > 0,
    check: (page, site, ctx) => {
      const hasSchema = page.jsonld.types.some((t) => t === 'AudioObject' || t === 'PodcastEpisode');
      // Ses dosyası başına en az ~80 kelime metin varsa transkript sayılır.
      const enoughText = page.content.mainWordCount >= page.media.audios.length * 80;
      if (hasSchema && enoughText) return null;
      return ctx.fail({
        evidence: {
          audios: page.media.audios.length,
          words: page.content.mainWordCount,
          hasAudioSchema: hasSchema
        },
        message: `Sayfada ${page.media.audios.length} ses dosyası var ama ${enoughText ? 'AudioObject yapısal verisi yok' : 'metin karşılığı (transkript) yetersiz'}.`,
        fix: 'Ses demolarının yanına transkript veya en azından ayrıntılı açıklama koyun ve AudioObject ekleyin. Arama motorları sesi dinlemez: seslendirme örneği bir sayfanın en değerli içeriğiyse ve metni yoksa, o değer arama açısından görünmezdir.'
      });
    }
  }),

  defineRule({
    id: 'iframe-missing-title',
    category: 'media', scope: 'page', severity: 'notice',
    weight: 3, impact: 2, effort: 'low', needs: ['html'],
    description: 'iframe\'de title yok',
    appliesTo: (page) => page.ok && page.media.iframes.length > 0,
    check: (page, site, ctx) => {
      const missing = page.media.iframes.filter((f) => !f.title);
      if (missing.length === 0) return null;
      return ctx.fail({
        evidence: { count: missing.length, samples: missing.slice(0, 5).map((f) => f.src) },
        message: `${missing.length} iframe'de title özniteliği yok.`,
        fix: 'Her iframe\'e ne içerdiğini anlatan bir title ekleyin (ör. title="Tanıtım videosu"). Ekran okuyucular için gereklidir.'
      });
    }
  })
];
