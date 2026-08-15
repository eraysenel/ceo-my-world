// Panelin tarayıcı giriş noktası.
//
// Burada YENİ kural yok, yeni skor mantığı yok. CLI'nin kullandığı kural
// motorunun aynısı tarayıcıya paketleniyor: aynı 107 kural, aynı skorlama,
// aynı önceliklendirme. Paneldeki sonuç ile `seo-audit.mjs` çıktısı aynı
// girdide birebir aynı olmalı — ikinci bir doğruluk kaynağı üretmemek bu
// projenin baştan beri koyduğu kural.

import { buildPage } from '../../tools/lib/parser.mjs';
import { emptySite, finalizeSite } from '../../tools/lib/site.mjs';
import { registry } from '../../tools/rules/index.mjs';
import { runRules, computeScores, prioritize, PRIORITY_LABEL } from '../../tools/lib/engine.mjs';
import {
  CATEGORY_LABEL, SEVERITY_LABEL, SEO_CATEGORIES, CATEGORIES
} from '../../tools/lib/rules.mjs';

export const labels = { CATEGORY_LABEL, SEVERITY_LABEL, PRIORITY_LABEL, SEO_CATEGORIES, CATEGORIES };

export const ruleCount = registry.all.length;

/** Kural kataloğunun parmak izi — panel ile CLI aynı katalogda mı, buradan görülür. */
export const catalogDigest = registry.digest;

/** Tarayıcıda çalışabilen kural sayısı (yanıt başlığı / canlı erişim gerektirmeyenler). */
export const offlineRuleCount = registry.all
  .filter((r) => r.needs.every((n) => n === 'html' || n === 'site')).length;

/**
 * Yapıştırılan sayfa kaynaklarını denetler.
 *
 * @param {{pages: Array<{url: string, html: string}>, minWords?: number}} input
 * @returns {{scores, actions, findings, site, meta}}
 */
export function analyze({ pages, minWords = 300 }) {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error('En az bir sayfa gerekli.');
  }

  const first = pages[0];
  let origin;
  try {
    origin = new URL(first.url).origin;
  } catch {
    throw new Error(`Geçersiz adres: ${first.url}`);
  }

  const site = emptySite(origin);
  // Yapıştırılan kaynak, sunucudan gelen HTML'dir; yanıt başlıkları ve durum
  // kodları elimizde yok. Yetenekler buna göre işaretlenir ki bunları
  // gerektiren kurallar paydaya hiç girmesin.
  site.capabilities = {
    network: false, headers: false, net: false,
    assetBytes: false, timings: false, javascript: false
  };

  const skipped = [];
  for (const { url, html } of pages) {
    if (!html || !html.trim()) continue;
    let normalizedInput;
    try {
      normalizedInput = new URL(url).toString();
    } catch {
      skipped.push({ url, reason: 'geçersiz adres' });
      continue;
    }
    const page = buildPage({ url: normalizedInput, html, status: 200, headers: {}, source: 'panel' });
    site.pages.set(page.normalizedUrl, page);
    site.counters.htmlPages += 1;
    site.urlStatus.set(page.normalizedUrl, {
      status: 200, finalUrl: page.normalizedUrl, redirects: 0, error: null
    });
  }

  if (site.pages.size === 0) {
    throw new Error('Hiçbir sayfa okunamadı. Kaynak boş veya adresler geçersiz.');
  }

  finalizeSite(site, { startUrl: first.url, singlePage: site.pages.size === 1 });

  const { findings, applicability, ruleErrors } = runRules(site, registry, { config: { minWords } });
  const scores = computeScores(findings, applicability, registry);
  const actions = prioritize(findings, applicability);

  const evaluated = [...applicability.values()].filter((r) => r.applicable > 0).length;

  return {
    scores,
    actions,
    findings,
    site,
    meta: {
      pageCount: site.pages.size,
      totalRules: registry.all.length,
      evaluatedRules: evaluated,
      rulesDigest: registry.digest,
      skipped,
      ruleErrors,
      rendering: site.rendering
    }
  };
}
