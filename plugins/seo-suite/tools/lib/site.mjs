// SiteModel kurulumu ve site düzeyi türetilmiş veriler.
//
// Bu modül bilinçli olarak Node API'si kullanmaz. Hem Node tarafındaki
// `sources.mjs` (canlı tarama, dizin okuma) hem de tarayıcı paneli aynı
// site modelini buradan kurar — böylece iki ortam arasında ikinci bir
// doğruluk kaynağı oluşmaz ve kural sonuçları birebir aynı çıkar.

import { hostOf, registrableDomain } from './url.mjs';
import { hammingDistance, normalizeKey, NEAR_DUPLICATE_DISTANCE } from './text.mjs';

/** Boş bir SiteModel iskeleti. */
export function emptySite(origin) {
  return {
    origin,
    hosts: [],
    pages: new Map(),
    urlStatus: new Map(),
    inlinks: new Map(),
    assets: new Map(),
    robots: { found: false, raw: null, parsed: null, sitemaps: [], blockedAiAgents: [] },
    sitemaps: [],
    sitemapUrls: new Set(),
    wellKnown: { llmsTxt: null },
    clusters: { duplicateTitles: new Map(), duplicateDescriptions: new Map(), duplicateContent: [] },
    locales: [],
    rendering: 'static',
    status: 'ok',
    errors: [],
    counters: { requested: 0, fetched: 0, failed: 0, skippedByRobots: 0, htmlPages: 0 },
    capabilities: { network: false, headers: false, net: false, assetBytes: false, timings: false, javascript: false }
  };
}

/** Sayfalar toplandıktan sonra site düzeyi türetilmiş verileri hesaplar. */
export function finalizeSite(site, { startUrl, singlePage = false }) {
  const pages = [...site.pages.values()];

  site.hosts = [...new Set(pages.map((p) => hostOf(p.url)).filter(Boolean))];
  site.registrableDomain = registrableDomain(startUrl);
  site.singlePage = singlePage;

  // İç link haritası (orphan-page ve broken-internal-link için)
  for (const page of pages) {
    for (const link of page.links) {
      if (!link.internal || !link.normalized) continue;
      const list = site.inlinks.get(link.normalized) ?? [];
      list.push({ from: page.normalizedUrl, anchorText: link.anchorText, area: link.area });
      site.inlinks.set(link.normalized, list);
    }
  }

  // Yinelenen başlık / açıklama kümeleri (Türkçe harmanlama ile)
  for (const page of pages) {
    if (!page.ok || !page.head.metaRobots.index) continue;
    if (page.head.title) {
      const key = normalizeKey(page.head.title);
      const list = site.clusters.duplicateTitles.get(key) ?? [];
      list.push(page.normalizedUrl);
      site.clusters.duplicateTitles.set(key, list);
    }
    if (page.head.metaDescription) {
      const key = normalizeKey(page.head.metaDescription);
      const list = site.clusters.duplicateDescriptions.get(key) ?? [];
      list.push(page.normalizedUrl);
      site.clusters.duplicateDescriptions.set(key, list);
    }
  }

  // Yakın kopya içerik kümeleri (simhash)
  const indexable = pages.filter((p) => p.ok && p.head.metaRobots.index && p.content.mainWordCount > 100);
  for (let i = 0; i < indexable.length; i += 1) {
    for (let j = i + 1; j < indexable.length; j += 1) {
      if (hammingDistance(indexable[i].content.simhash, indexable[j].content.simhash) <= NEAR_DUPLICATE_DISTANCE) {
        site.clusters.duplicateContent.push([indexable[i].normalizedUrl, indexable[j].normalizedUrl]);
      }
    }
  }

  site.locales = [...new Set(pages.map((p) => p.head.lang).filter(Boolean))];

  // İstemci tarafı render şüphesi: sayfaların çoğunda içerik yoksa.
  const spaCount = pages.filter((p) => p.flags.spaSuspect).length;
  if (pages.length > 0 && spaCount / pages.length >= 0.5) {
    site.rendering = 'client-side-suspect';
  }

  if (site.status !== 'blocked') {
    const attempted = site.counters.requested;
    if (attempted > 0 && site.counters.failed / attempted > 0.2) site.status = 'partial';
  }
}
