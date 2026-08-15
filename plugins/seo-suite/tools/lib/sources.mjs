// Veri kaynakları: canlı tarama ve çevrimdışı adaptörler.
//
// Her adaptör aynı SiteModel'i üretir. Kurallar hangi kaynaktan geldiğini
// bilmez; yalnızca `site.capabilities` üzerinden hangi verinin mevcut
// olduğunu görür. Bu sayede çevrimdışı mod ikinci sınıf bir yedek değil,
// birinci sınıf bir çalışma biçimidir.

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { buildPage } from './parser.mjs';
import * as cheerio from 'cheerio';
import {
  request, RequestQueue, parseRobots, robotsGroupFor, robotsAllows,
  blockedAiAgents, parseSitemap, maybeGunzip, DEFAULT_USER_AGENT
} from './http.mjs';
import { normalizeUrl, hostOf, sameSite, looksNonHtml, registrableDomain } from './url.mjs';
import { hammingDistance, normalizeKey, NEAR_DUPLICATE_DISTANCE } from './text.mjs';

/** Boş bir SiteModel iskeleti. */
function emptySite(origin) {
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

// --- Canlı tarama ---------------------------------------------------------

export async function crawlLive(startUrl, options = {}) {
  const {
    maxPages = 150,
    maxDepth = 4,
    concurrency = 4,
    delayMs = 500,
    timeoutMs = 15000,
    userAgent = DEFAULT_USER_AGENT,
    respectRobots = true,
    checkExternal = false,
    log = () => {}
  } = options;

  const origin = new URL(startUrl).origin;
  const site = emptySite(origin);
  site.capabilities = { network: true, headers: true, net: true, assetBytes: false, timings: true, javascript: false };

  const queue = new RequestQueue({ concurrency, delayMs });
  const fetchOnce = (url, opts = {}) => queue.run(() => request(url, { userAgent, timeoutMs, ...opts }));

  // 1. robots.txt
  const robotsRes = await fetchOnce(new URL('/robots.txt', origin).toString());
  if (robotsRes.ok && robotsRes.body && !/^\s*<(!doctype|html)/i.test(robotsRes.body)) {
    site.robots.found = true;
    site.robots.raw = robotsRes.body;
    site.robots.parsed = parseRobots(robotsRes.body);
    site.robots.sitemaps = site.robots.parsed.sitemaps;
    site.robots.blockedAiAgents = blockedAiAgents(site.robots.parsed);
  }
  const group = respectRobots && site.robots.parsed
    ? robotsGroupFor(site.robots.parsed, 'SeoSuiteBot')
    : null;
  const allowed = (url) => {
    if (!respectRobots || !group) return true;
    try {
      return robotsAllows(group, new URL(url).pathname);
    } catch {
      return true;
    }
  };

  // 2. llms.txt (AI arama kuralı için)
  const llms = await fetchOnce(new URL('/llms.txt', origin).toString());
  site.wellKnown.llmsTxt = llms.ok && llms.body ? llms.body : null;

  // 3. Sitemap keşfi
  const sitemapCandidates = site.robots.sitemaps.length
    ? site.robots.sitemaps
    : [new URL('/sitemap.xml', origin).toString(), new URL('/sitemap_index.xml', origin).toString()];
  await collectSitemaps(sitemapCandidates, site, fetchOnce, log);

  // 4. BFS tarama — sitemap URL'leri + başlangıç adresi
  const frontier = [{ url: normalizeUrl(startUrl), depth: 0 }];
  for (const loc of site.sitemapUrls) {
    const n = normalizeUrl(loc);
    if (n && sameSite(n, startUrl)) frontier.push({ url: n, depth: 1 });
  }

  const seen = new Set();
  let challengeStreak = 0;

  while (frontier.length && site.pages.size < maxPages) {
    const batch = frontier.splice(0, concurrency);
    const jobs = batch.map(async ({ url, depth }) => {
      if (!url || seen.has(url) || depth > maxDepth) return;
      seen.add(url);
      if (!allowed(url)) {
        site.counters.skippedByRobots += 1;
        return;
      }
      if (looksNonHtml(url)) return;

      site.counters.requested += 1;
      const res = await fetchOnce(url);
      site.urlStatus.set(url, {
        status: res.status,
        finalUrl: res.finalUrl,
        redirects: res.redirectChain?.length ?? 0,
        error: res.error ?? null
      });

      if (res.blocked) {
        challengeStreak += 1;
        site.counters.failed += 1;
        return;
      }
      challengeStreak = 0;

      if (!res.ok || !res.body) {
        site.counters.failed += 1;
        if (res.error) site.errors.push({ url, kind: res.error, message: res.errorMessage ?? null });
        return;
      }
      if (!/text\/html|application\/xhtml/i.test(res.headers['content-type'] ?? '')) return;

      site.counters.fetched += 1;
      site.counters.htmlPages += 1;

      const page = buildPage({
        url,
        html: res.body,
        status: res.status,
        headers: res.headers,
        redirectChain: res.redirectChain,
        finalUrl: res.finalUrl,
        timing: res.timing,
        depth,
        source: 'live',
        transferBytes: res.bytes
      });
      site.pages.set(page.normalizedUrl, page);
      log(`  ${res.status}  ${url}`);

      for (const link of page.links) {
        if (!link.internal || link.nonHtml) continue;
        const n = link.normalized;
        if (!n || seen.has(n)) continue;
        if (site.pages.size + frontier.length >= maxPages * 2) break;
        frontier.push({ url: n, depth: depth + 1 });
      }
    });

    await Promise.all(jobs);

    if (challengeStreak >= 3) {
      site.status = 'blocked';
      site.errors.push({ kind: 'blocked', message: 'Bot koruması üst üste 3 istekte taramayı engelledi.' });
      break;
    }
  }

  // 5. Bağlantı ve canonical hedeflerinin durum kodları
  await probeReferencedUrls(site, fetchOnce, { checkExternal, allowed });

  finalizeSite(site, { startUrl });
  return site;
}

async function collectSitemaps(candidates, site, fetchOnce, log, depth = 0) {
  if (depth > 2) return;
  for (const url of candidates.slice(0, 50)) {
    const res = await fetchOnce(url);
    if (!res.ok || !res.body) {
      site.sitemaps.push({ url, ok: false, error: res.error ?? `HTTP ${res.status}`, urlCount: 0 });
      continue;
    }
    let xml = res.body;
    try {
      xml = await maybeGunzip(Buffer.from(res.body, 'utf8'));
    } catch { /* gzip değilmiş, gövde aynen kullanılır */ }

    let parsed;
    try {
      parsed = await parseSitemap(xml, cheerio.load);
    } catch (err) {
      site.sitemaps.push({ url, ok: false, error: `xml: ${err.message}`, urlCount: 0 });
      continue;
    }

    if (parsed.type === 'index') {
      site.sitemaps.push({ url, ok: true, kind: 'index', children: parsed.children.length, urlCount: 0 });
      log(`  sitemap index: ${url} (${parsed.children.length} alt sitemap)`);
      await collectSitemaps(parsed.children, site, fetchOnce, log, depth + 1);
      continue;
    }

    site.sitemaps.push({
      url, ok: true, kind: 'urlset', urlCount: parsed.entries.length, entries: parsed.entries
    });
    for (const e of parsed.entries) site.sitemapUrls.add(e.loc);
    log(`  sitemap: ${url} (${parsed.entries.length} URL)`);
  }
}

/** Sayfalarda geçen iç/dış bağlantıların ve canonical hedeflerinin durumunu ölçer. */
async function probeReferencedUrls(site, fetchOnce, { checkExternal, allowed }) {
  const targets = new Set();

  for (const page of site.pages.values()) {
    if (page.head.canonical) {
      const n = normalizeUrl(page.head.canonical);
      if (n) targets.add(n);
    }
    for (const alt of page.hreflang) {
      const n = alt.abs ? normalizeUrl(alt.abs) : null;
      if (n) targets.add(n);
    }
    for (const link of page.links) {
      if (!link.normalized) continue;
      if (link.internal) targets.add(link.normalized);
      else if (checkExternal) targets.add(link.normalized);
    }
  }

  const pending = [...targets].filter((u) => !site.urlStatus.has(u)).slice(0, 500);
  const chunks = [];
  for (let i = 0; i < pending.length; i += 8) chunks.push(pending.slice(i, i + 8));

  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (url) => {
      if (!allowed(url)) return;
      const res = await fetchOnce(url, { method: 'HEAD' });
      // Bazı sunucular HEAD'i reddeder; 405/501'de GET ile bir kez daha dener.
      const final = (res.status === 405 || res.status === 501) ? await fetchOnce(url) : res;
      site.urlStatus.set(url, {
        status: final.status,
        finalUrl: final.finalUrl,
        redirects: final.redirectChain?.length ?? 0,
        error: final.error ?? null
      });
    }));
  }
}

// --- Çevrimdışı: kayıtlı HTML dizini -------------------------------------

export async function loadDirectory(dir, baseUrl, options = {}) {
  const { log = () => {} } = options;
  const origin = new URL(baseUrl).origin;
  const site = emptySite(origin);
  site.capabilities = { network: false, headers: false, net: false, assetBytes: false, timings: false, javascript: false };

  const files = await collectHtmlFiles(dir);
  if (files.length === 0) {
    throw new Error(`${dir} altında .html/.htm dosyası bulunamadı.`);
  }

  for (const file of files) {
    const html = await readFile(file, 'utf8');
    const url = fileToUrl(file, dir, baseUrl);
    const page = buildPage({ url, html, status: 200, headers: {}, source: 'dir' });

    // Dosyanın kendi canonical'ı eşlemeyle çelişiyorsa canonical kazanır;
    // aksi hâlde her canonical kuralı sahte bulgu üretirdi.
    if (page.head.canonical && sameSite(page.head.canonical, baseUrl)) {
      const canonical = normalizeUrl(page.head.canonical);
      if (canonical && canonical !== page.normalizedUrl) {
        site.errors.push({
          kind: 'url-mapping',
          message: `${path.basename(file)}: dosya yolu ${url} ile canonical ${canonical} farklı; canonical kullanıldı.`
        });
        const remapped = buildPage({ url: canonical, html, status: 200, headers: {}, source: 'dir' });
        site.pages.set(remapped.normalizedUrl, remapped);
        site.counters.htmlPages += 1;
        log(`  ${path.relative(dir, file)} -> ${canonical}`);
        continue;
      }
    }

    site.pages.set(page.normalizedUrl, page);
    site.counters.htmlPages += 1;
    log(`  ${path.relative(dir, file)} -> ${url}`);
  }

  // Çevrimdışı modda taranan sayfalar 200 kabul edilir; başkası bilinmez.
  for (const url of site.pages.keys()) {
    site.urlStatus.set(url, { status: 200, finalUrl: url, redirects: 0, error: null });
  }

  finalizeSite(site, { startUrl: baseUrl });
  return site;
}

async function collectHtmlFiles(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await collectHtmlFiles(full, acc);
    else if (/\.html?$/i.test(entry.name)) acc.push(full);
  }
  return acc.sort();
}

function fileToUrl(file, dir, baseUrl) {
  const rel = path.relative(dir, file).split(path.sep).join('/');
  let urlPath = rel.replace(/index\.html?$/i, '').replace(/\.html?$/i, '');
  if (!urlPath.startsWith('/')) urlPath = `/${urlPath}`;
  return new URL(urlPath, baseUrl).toString();
}

// --- Çevrimdışı: tek dosya -----------------------------------------------

export async function loadSingleFile(file, pageUrl) {
  const html = await readFile(file, 'utf8');
  const site = emptySite(new URL(pageUrl).origin);
  site.capabilities = { network: false, headers: false, net: false, assetBytes: false, timings: false, javascript: false };
  const page = buildPage({ url: pageUrl, html, status: 200, headers: {}, source: 'single' });
  site.pages.set(page.normalizedUrl, page);
  site.counters.htmlPages = 1;
  site.urlStatus.set(page.normalizedUrl, { status: 200, finalUrl: page.normalizedUrl, redirects: 0, error: null });
  finalizeSite(site, { startUrl: pageUrl, singlePage: true });
  return site;
}

// --- Ortak son işlem ------------------------------------------------------

/** Sayfalar toplandıktan sonra site düzeyi türetilmiş verileri hesaplar. */
function finalizeSite(site, { startUrl, singlePage = false }) {
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
