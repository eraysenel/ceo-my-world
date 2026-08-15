// Test yardımcıları: tek bir kuralı bir HTML parçası üzerinde koşturur.

import { buildPage } from '../lib/parser.mjs';
import { makeFinding } from '../lib/rules.mjs';

const DEFAULT_URL = 'https://ornek.test/sayfa';

/** HTML gövdesini tam bir belgeye sarar (charset erken, lang tr). */
export function doc(bodyOrHead, { head = '', lang = 'tr', bodyOnly = true } = {}) {
  if (!bodyOnly) return bodyOrHead;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">${head}</head>
<body>${bodyOrHead}</body></html>`;
}

/** Bir sayfa modeli üretir. */
export function page(html, { url = DEFAULT_URL, status = 200, headers = {}, ...rest } = {}) {
  return buildPage({ url, html, status, headers, ...rest });
}

/** Kurallar için asgari site modeli. */
export function site(pages = [], overrides = {}) {
  const map = new Map();
  for (const p of pages) map.set(p.normalizedUrl, p);
  return {
    origin: 'https://ornek.test',
    hosts: ['ornek.test'],
    registrableDomain: 'ornek.test',
    pages: map,
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
    singlePage: false,
    errors: [],
    counters: { requested: 0, fetched: 0, failed: 0, skippedByRobots: 0, htmlPages: map.size },
    capabilities: { network: true, headers: true, net: true, assetBytes: false, timings: true, javascript: false },
    ...overrides
  };
}

/**
 * Bir kuralı çalıştırır.
 * @returns {{applicable: boolean, findings: object[]}}
 */
export function runRule(rule, target, siteModel = null) {
  const s = siteModel ?? (rule.scope === 'site' ? site([target]) : site([target]));
  const subject = rule.scope === 'site' ? s : target;
  const ctx = { config: {}, fail: (payload) => makeFinding(rule, payload) };
  const applicable = rule.appliesTo ? Boolean(rule.appliesTo(subject, s, ctx)) : true;
  if (!applicable) return { applicable: false, findings: [] };
  const result = rule.check(subject, s, ctx);
  const findings = !result ? [] : Array.isArray(result) ? result.filter(Boolean) : [result];
  return { applicable: true, findings };
}

/** Kural dizisinden kimliğe göre kural bulur. */
export function byId(rules, id) {
  const rule = rules.find((r) => r.id === id);
  if (!rule) throw new Error(`Kural bulunamadı: ${id}`);
  return rule;
}
