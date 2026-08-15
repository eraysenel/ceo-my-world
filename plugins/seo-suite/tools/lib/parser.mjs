// HTML + yanıt başlıkları → PageModel.
//
// PageModel, her kuralın gördüğü tek nesnedir. Kurallar HTML'e doğrudan
// dokunmaz; böylece kural yazmak, ayrıştırma ayrıntılarını bilmeyi gerektirmez
// ve her kural bir fixture ile test edilebilir.

import * as cheerio from 'cheerio';
import {
  resolveUrl, normalizeUrl, hostOf, sameSite, looksNonHtml, pathDepth
} from './url.mjs';
import {
  wordCount, simhash, turkishStopwordRatio, detectMojibake, measureTextPx, trLower, utf8Bytes
} from './text.mjs';

export const load = cheerio.load;

/** Türkçe "sayfa bulunamadı" imzaları — 200 dönen 404'leri yakalamak için. */
const SOFT_404_MARKERS = [
  'sayfa bulunamadı', 'aradığınız sayfa bulunamadı', 'böyle bir sayfa yok',
  'sayfa mevcut değil', 'içerik bulunamadı', 'page not found', '404 error',
  'aradığınız içeriğe ulaşılamadı'
];

/** İstemci tarafı render şüphesi uyandıran işaretler. */
const SPA_MARKERS = [
  '__next_data__', 'data-reactroot', 'ng-version', 'data-vue-meta',
  'id="root"', "id='root'", 'id="__next"', "id='__next'", 'id="app"', "id='app'"
];

/**
 * Bir sayfa modeli kurar.
 *
 * @param {object} input
 * @param {string} input.url          Sayfanın gerçek adresi
 * @param {string} input.html         Ham HTML
 * @param {number} [input.status]     HTTP durum kodu
 * @param {object} [input.headers]    Yanıt başlıkları (küçük harfli anahtarlar)
 */
export function buildPage(input) {
  const {
    url,
    html = '',
    status = 200,
    headers = {},
    redirectChain = [],
    finalUrl = url,
    timing = null,
    depth = 0,
    source = 'live',
    transferBytes = null
  } = input;

  const $ = cheerio.load(html);
  const baseHref = $('base[href]').first().attr('href') || null;
  const base = baseHref ? (resolveUrl(baseHref, url) ?? url) : url;

  const head = parseHead($, url, base, html, headers);
  const headings = parseHeadings($);
  const content = parseContent($, html);
  const links = parseLinks($, url, base);
  const media = parseMedia($, base);
  const jsonld = parseJsonLd($);
  const social = parseSocial($);
  const hreflang = parseHreflang($, base, headers);
  const perf = parsePerf($, url, html);

  const bodyText = content.text;
  const softNotFound =
    status === 200 &&
    content.wordCount < 120 &&
    SOFT_404_MARKERS.some((m) => trLower(bodyText).includes(m));

  const htmlLower = html.toLowerCase();
  const spaSuspect =
    content.mainWordCount < 200 &&
    (SPA_MARKERS.some((m) => htmlLower.includes(m)) ||
      (html.length > 0 && perf.scriptBytes / Math.max(1, html.length) > 0.5));

  return {
    url,
    normalizedUrl: normalizeUrl(url) ?? url,
    finalUrl,
    redirectChain,
    status,
    ok: status >= 200 && status < 300,
    contentType: headers['content-type'] ?? null,
    headers,
    bytes: { html: utf8Bytes(html), transfer: transferBytes },
    timing,
    depth,
    pathDepth: pathDepth(url),
    source,
    head,
    headings,
    content,
    links,
    media,
    jsonld,
    social,
    hreflang,
    perf,
    flags: { spaSuspect, softNotFound }
  };
}

function parseHead($, url, base, html, headers) {
  const titleRaw = $('head > title').first().html();
  const title = $('head > title').first().text().trim() || null;

  const metaDescription = attrOf($, 'meta[name="description"]', 'content');
  const canonicalRaw = $('link[rel="canonical"]').first().attr('href') ?? null;
  const canonical = canonicalRaw ? resolveUrl(canonicalRaw, base) : null;

  const robotsContent = [
    attrOf($, 'meta[name="robots"]', 'content'),
    attrOf($, 'meta[name="googlebot"]', 'content'),
    headers['x-robots-tag'] ?? null
  ].filter(Boolean).join(',');
  const robotsLower = trLower(robotsContent);

  // <meta charset> ilk 1024 baytta olmalı; yoksa tarayıcı yanlış kodlamayla
  // ayrıştırmaya başlayıp Türkçe karakterleri bozabilir.
  const charsetMatch = html.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i);
  const charsetBytePos = charsetMatch ? utf8Bytes(html.slice(0, charsetMatch.index)) : null;
  const headerCharset = /charset=([\w-]+)/i.exec(headers['content-type'] ?? '')?.[1] ?? null;

  return {
    title,
    titleRaw: titleRaw ? `<title>${titleRaw}</title>` : null,
    titlePx: title ? measureTextPx(title) : 0,
    metaDescription,
    metaDescriptionPx: metaDescription ? measureTextPx(metaDescription) : 0,
    canonical,
    canonicalRaw,
    canonicalIsRelative: Boolean(canonicalRaw) && !/^https?:\/\//i.test(canonicalRaw.trim()),
    metaRobots: {
      index: !robotsLower.includes('noindex'),
      follow: !robotsLower.includes('nofollow'),
      raw: robotsContent || null,
      fromHeader: Boolean(headers['x-robots-tag'])
    },
    charset: charsetMatch?.[1] ?? headerCharset,
    charsetBytePos,
    viewport: attrOf($, 'meta[name="viewport"]', 'content'),
    lang: $('html').attr('lang') ?? null,
    baseHref: $('base[href]').first().attr('href') ?? null,
    generator: attrOf($, 'meta[name="generator"]', 'content'),
    favicon: $('link[rel~="icon"]').first().attr('href') ?? null
  };
}

function attrOf($, selector, attr) {
  const v = $(selector).first().attr(attr);
  return v === undefined ? null : String(v).trim() || null;
}

function parseHeadings($) {
  const tree = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const level = Number(el.tagName.slice(1));
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    tree.push({ level, text, empty: text.length === 0 });
  });

  const jumps = [];
  let prev = null;
  for (let i = 0; i < tree.length; i += 1) {
    const node = tree[i];
    if (prev !== null && node.level > prev + 1) {
      jumps.push({ from: prev, to: node.level, index: i, text: node.text });
    }
    prev = node.level;
  }

  return {
    h1: tree.filter((n) => n.level === 1).map((n) => n.text),
    tree,
    jumps,
    counts: tree.reduce((acc, n) => {
      acc[`h${n.level}`] = (acc[`h${n.level}`] ?? 0) + 1;
      return acc;
    }, {})
  };
}

function parseContent($, html) {
  const $clone = $.root().clone();
  $clone.find('script, style, noscript, template, svg').remove();

  const text = $clone.text().replace(/\s+/g, ' ').trim();

  // Ana içerik: main/article varsa onu al, yoksa gövdeyi kullan.
  const $main = $('main').first().length ? $('main').first()
    : $('article').first().length ? $('article').first()
      : $('body').first();
  const $mainClone = $main.clone();
  $mainClone.find('script, style, noscript, nav, header, footer, aside').remove();
  const mainText = $mainClone.text().replace(/\s+/g, ' ').trim();

  // H1 ile ilk H2 arasındaki ilk anlamlı paragraf — AI aramada "cevap bloğu".
  let firstParagraph = null;
  const $p = $('main p, article p, body p').filter((_, el) => $(el).text().trim().length > 40).first();
  if ($p.length) firstParagraph = $p.text().replace(/\s+/g, ' ').trim();

  return {
    text,
    mainText,
    wordCount: wordCount(text),
    mainWordCount: wordCount(mainText),
    firstParagraph,
    simhash: simhash(mainText || text),
    turkishRatio: turkishStopwordRatio(text),
    mojibake: detectMojibake(html),
    domNodeCount: $('*').length
  };
}

const GENERIC_ANCHORS = new Set([
  'buraya tıklayın', 'tıklayın', 'tıkla', 'devamı', 'devamını oku', 'daha fazla',
  'daha fazlası', 'detaylar', 'detaylı bilgi', 'incele', 'buradan', 'link',
  'click here', 'read more', 'more', 'here', 'learn more'
]);

function parseLinks($, pageUrl, base) {
  const out = [];
  $('a[href]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    const abs = resolveUrl(href, base);
    if (!abs) return;

    const anchorText = $el.text().replace(/\s+/g, ' ').trim();
    const rel = ($el.attr('rel') ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    const hasImage = $el.find('img').length > 0;
    const imgAlt = $el.find('img[alt]').first().attr('alt')?.trim() ?? '';
    const ariaLabel = $el.attr('aria-label')?.trim() ?? '';

    out.push({
      href,
      abs,
      normalized: normalizeUrl(abs) ?? abs,
      anchorText,
      accessibleText: anchorText || imgAlt || ariaLabel,
      rel,
      nofollow: rel.includes('nofollow'),
      internal: sameSite(abs, pageUrl),
      sameHost: hostOf(abs) === hostOf(pageUrl),
      targetBlank: ($el.attr('target') ?? '') === '_blank',
      isImageOnly: hasImage && anchorText.length === 0,
      generic: GENERIC_ANCHORS.has(trLower(anchorText)) || /^https?:\/\//i.test(anchorText),
      area: linkArea($, el),
      nonHtml: looksNonHtml(abs),
      insecure: abs.startsWith('http://')
    });
  });
  return out;
}

function linkArea($, el) {
  const $el = $(el);
  if ($el.closest('nav, [role="navigation"]').length) return 'nav';
  if ($el.closest('footer').length) return 'footer';
  if ($el.closest('header').length) return 'header';
  if ($el.closest('aside').length) return 'aside';
  return 'main';
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i;

function parseMedia($, base) {
  const images = [];
  $('img').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('src') ?? $el.attr('data-src') ?? null;
    const abs = src ? resolveUrl(src, base) : null;
    const alt = $el.attr('alt');
    const hasPicture = $el.closest('picture').length > 0;
    const modernSource = hasPicture &&
      $el.closest('picture').find('source[type="image/webp"], source[type="image/avif"]').length > 0;
    const format = IMAGE_EXT.exec(abs ?? '')?.[1]?.toLowerCase() ?? null;

    images.push({
      src,
      abs,
      alt: alt === undefined ? null : alt,
      hasAltAttr: alt !== undefined,
      altText: (alt ?? '').trim(),
      width: $el.attr('width') ?? null,
      height: $el.attr('height') ?? null,
      hasDimensions: Boolean($el.attr('width') && $el.attr('height')) ||
        /aspect-ratio/i.test($el.attr('style') ?? ''),
      loading: $el.attr('loading') ?? null,
      fetchpriority: $el.attr('fetchpriority') ?? null,
      format,
      modernFormat: format === 'webp' || format === 'avif' || modernSource,
      inFigure: $el.closest('figure').length > 0,
      decorative: (alt ?? '').trim() === '' && alt !== undefined,
      index: images.length
    });
  });

  const videos = [];
  $('video').each((_, el) => {
    videos.push({ src: $(el).attr('src') ?? $(el).find('source').first().attr('src') ?? null, kind: 'video' });
  });
  $('iframe[src]').each((_, el) => {
    const src = $(el).attr('src') ?? '';
    if (/youtube\.com|youtu\.be|vimeo\.com|dailymotion/i.test(src)) {
      videos.push({ src, kind: 'embed' });
    }
  });

  const audios = [];
  $('audio').each((_, el) => {
    audios.push({ src: $(el).attr('src') ?? $(el).find('source').first().attr('src') ?? null });
  });

  const iframes = [];
  $('iframe').each((_, el) => {
    iframes.push({ src: $(el).attr('src') ?? null, title: $(el).attr('title') ?? null });
  });

  return { images, videos, audios, iframes };
}

function parseJsonLd($) {
  const blocks = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    try {
      const parsed = JSON.parse(raw);
      blocks.push({ raw, parsed, error: null, types: collectTypes(parsed) });
    } catch (err) {
      blocks.push({ raw, parsed: null, error: String(err.message), types: [] });
    }
  });
  return {
    blocks,
    types: [...new Set(blocks.flatMap((b) => b.types))],
    hasError: blocks.some((b) => b.error)
  };
}

function collectTypes(node, acc = []) {
  if (Array.isArray(node)) {
    for (const item of node) collectTypes(item, acc);
    return acc;
  }
  if (node && typeof node === 'object') {
    const t = node['@type'];
    if (typeof t === 'string') acc.push(t);
    else if (Array.isArray(t)) acc.push(...t.filter((x) => typeof x === 'string'));
    if (Array.isArray(node['@graph'])) collectTypes(node['@graph'], acc);
    for (const key of ['mainEntity', 'itemListElement', 'hasPart']) {
      if (node[key]) collectTypes(node[key], acc);
    }
  }
  return acc;
}

function parseSocial($) {
  const og = {};
  $('meta[property^="og:"]').each((_, el) => {
    const p = $(el).attr('property')?.slice(3);
    const c = $(el).attr('content');
    if (p && c) og[p] = c;
  });
  const twitter = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const n = $(el).attr('name')?.slice(8);
    const c = $(el).attr('content');
    if (n && c) twitter[n] = c;
  });
  return { og, twitter };
}

function parseHreflang($, base, headers) {
  const out = [];
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const lang = $(el).attr('hreflang');
    const href = $(el).attr('href');
    if (!lang || !href) return;
    out.push({ lang, href, abs: resolveUrl(href, base), source: 'html' });
  });

  // HTTP Link başlığındaki alternatifler de geçerlidir.
  const linkHeader = headers?.link;
  if (linkHeader) {
    const re = /<([^>]+)>\s*;\s*rel\s*=\s*"?alternate"?\s*;\s*hreflang\s*=\s*"?([\w-]+)"?/gi;
    let m;
    while ((m = re.exec(linkHeader)) !== null) {
      out.push({ lang: m[2], href: m[1], abs: resolveUrl(m[1], base), source: 'header' });
    }
  }
  return out;
}

function parsePerf($, pageUrl, html) {
  const renderBlockingCss = [];
  $('head link[rel="stylesheet"]').each((_, el) => {
    const media = ($(el).attr('media') ?? 'all').toLowerCase();
    if (media === 'print') return;
    renderBlockingCss.push($(el).attr('href') ?? '');
  });

  const renderBlockingJs = [];
  $('head script[src]').each((_, el) => {
    const $el = $(el);
    if ($el.attr('async') !== undefined || $el.attr('defer') !== undefined) return;
    if (($el.attr('type') ?? '') === 'module') return;
    renderBlockingJs.push($el.attr('src') ?? '');
  });

  const preloads = [];
  $('link[rel="preload"]').each((_, el) => preloads.push($(el).attr('href') ?? ''));
  const preconnects = [];
  $('link[rel="preconnect"], link[rel="dns-prefetch"]').each((_, el) => {
    preconnects.push($(el).attr('href') ?? '');
  });

  const pageHost = hostOf(pageUrl);
  const thirdPartyOrigins = new Set();
  const thirdPartyScripts = [];
  const insecureResources = [];
  $('script[src], link[href], img[src], iframe[src], source[src], audio[src], video[src]').each((_, el) => {
    const $el = $(el);
    const raw = $el.attr('src') ?? $el.attr('href');
    const abs = resolveUrl(raw, pageUrl);
    if (!abs) return;
    if (abs.startsWith('http://')) insecureResources.push({ tag: el.tagName, url: abs });
    if (el.tagName === 'script') {
      const h = hostOf(abs);
      if (h && h !== pageHost) {
        thirdPartyOrigins.add(h);
        thirdPartyScripts.push({ src: abs, host: h, integrity: $el.attr('integrity') ?? null });
      }
    }
  });

  let inlineStyleBytes = 0;
  $('style').each((_, el) => { inlineStyleBytes += utf8Bytes($(el).text()); });
  let scriptBytes = 0;
  $('script').each((_, el) => { scriptBytes += utf8Bytes($(el).text()); });

  // Yazı tipi yükleme davranışı
  const fontLinks = [];
  $('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]').each((_, el) => {
    fontLinks.push($(el).attr('href') ?? '');
  });
  const hasFontFace = /@font-face/i.test(html);
  const hasFontDisplay = /font-display\s*:/i.test(html) || fontLinks.some((h) => /display=/.test(h));

  // LCP adayı: main içindeki ilk görsel
  const $lcp = $('main img, article img, body img').first();
  const lcpCandidate = $lcp.length
    ? {
      src: $lcp.attr('src') ?? null,
      loading: $lcp.attr('loading') ?? null,
      fetchpriority: $lcp.attr('fetchpriority') ?? null
    }
    : null;

  return {
    renderBlockingCss,
    renderBlockingJs,
    preloads,
    preconnects,
    insecureResources,
    thirdPartyOrigins: [...thirdPartyOrigins],
    thirdPartyScripts,
    inlineStyleBytes,
    scriptBytes,
    fontLinks,
    hasFontFace,
    hasFontDisplay,
    lcpCandidate
  };
}
