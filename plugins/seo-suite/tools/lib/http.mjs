// HTTP katmanı: istek, robots.txt, sitemap.
//
// Bu araç izinli denetim içindir. Bu yüzden: dürüst bir User-Agent, varsayılan
// olarak robots.txt'e uyum, origin başına eşzamanlılık sınırı ve nezaket
// gecikmesi. User-Agent taklidi ve proxy rotasyonu bilinçli olarak YOK.

import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { normalizeUrl } from './url.mjs';

const gunzip = promisify(zlib.gunzip);

export const DEFAULT_USER_AGENT =
  'SeoSuiteBot/0.1 (+https://github.com/eraysenel/ceo-my-world; SEO denetimi)';

/** Bot koruması / meydan okuma sayfası imzaları. */
const CHALLENGE_MARKERS = [
  'cdn-cgi/challenge-platform',
  'just a moment',
  'checking your browser',
  'enable javascript and cookies to continue',
  'ddos protection by',
  'attention required! | cloudflare'
];

/**
 * Origin başına eşzamanlılık + gecikme uygulayan basit kuyruk.
 * Node'un yerleşik fetch'i bunu sağlamaz; sağlamadığı için de bir denetim
 * aracının hedef siteyi dövmemesi tamamen bize kalır.
 */
export class RequestQueue {
  constructor({ concurrency = 4, delayMs = 500 } = {}) {
    this.concurrency = Math.max(1, concurrency);
    this.delayMs = Math.max(0, delayMs);
    this.active = 0;
    this.lastStart = 0;
    this.waiting = [];
  }

  async run(fn) {
    await this.#acquire();
    try {
      return await fn();
    } finally {
      this.#release();
    }
  }

  #acquire() {
    return new Promise((resolve) => {
      const attempt = () => {
        if (this.active < this.concurrency) {
          this.active += 1;
          const wait = Math.max(0, this.lastStart + this.delayMs - Date.now());
          this.lastStart = Date.now() + wait;
          setTimeout(resolve, wait);
        } else {
          this.waiting.push(attempt);
        }
      };
      attempt();
    });
  }

  #release() {
    this.active -= 1;
    const next = this.waiting.shift();
    if (next) next();
  }
}

/**
 * Tek bir HTTP isteği. Yönlendirmeleri elle takip eder ki zincirin tamamı
 * kaydedilebilsin — `redirect: 'follow'` kullanılsaydı ara adımlar kaybolurdu
 * ve `redirect-chain` / `redirect-loop` kuralları yazılamazdı.
 */
export async function request(url, options = {}) {
  const {
    method = 'GET',
    userAgent = DEFAULT_USER_AGENT,
    timeoutMs = 15000,
    maxRedirects = 5,
    maxBytes = 5 * 1024 * 1024,
    acceptLanguage = 'tr-TR,tr;q=0.9,en;q=0.5'
  } = options;

  const chain = [];
  let current = url;
  const started = Date.now();

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    let res;
    try {
      res = await fetch(current, {
        method,
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'user-agent': userAgent,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': acceptLanguage
        }
      });
    } catch (err) {
      return {
        url,
        finalUrl: current,
        ok: false,
        status: 0,
        error: classifyError(err),
        errorMessage: String(err?.message ?? err),
        redirectChain: chain,
        headers: {},
        body: null,
        timing: { totalMs: Date.now() - started }
      };
    }

    const headers = headersToObject(res.headers);

    if (res.status >= 300 && res.status < 400 && headers.location) {
      const next = normalizeUrl(headers.location, current);
      chain.push({ url: current, status: res.status, to: next });
      if (!next) break;
      if (chain.some((h) => h.url === next)) {
        return {
          url,
          finalUrl: next,
          ok: false,
          status: res.status,
          error: 'redirect-loop',
          redirectChain: chain,
          headers,
          body: null,
          timing: { totalMs: Date.now() - started }
        };
      }
      current = next;
      continue;
    }

    const ttfbMs = Date.now() - started;
    let body = null;
    let truncated = false;
    if (method !== 'HEAD') {
      const read = await readCapped(res, maxBytes);
      body = read.text;
      truncated = read.truncated;
    }

    return {
      url,
      finalUrl: current,
      ok: res.ok,
      status: res.status,
      headers,
      body,
      truncated,
      bytes: body ? Buffer.byteLength(body, 'utf8') : 0,
      redirectChain: chain,
      blocked: isChallenge(res.status, headers, body),
      timing: { ttfbMs, totalMs: Date.now() - started }
    };
  }

  return {
    url,
    finalUrl: current,
    ok: false,
    status: 0,
    error: 'too-many-redirects',
    redirectChain: chain,
    headers: {},
    body: null,
    timing: { totalMs: Date.now() - started }
  };
}

function classifyError(err) {
  const name = err?.name ?? '';
  const msg = String(err?.message ?? '').toLowerCase();
  if (name === 'TimeoutError' || msg.includes('timeout')) return 'timeout';
  if (msg.includes('enotfound') || msg.includes('dns')) return 'dns';
  if (msg.includes('certificate') || msg.includes('tls') || msg.includes('ssl')) return 'tls';
  if (msg.includes('econnrefused')) return 'connection-refused';
  return 'network';
}

function headersToObject(h) {
  const out = {};
  for (const [k, v] of h.entries()) out[k.toLowerCase()] = v;
  return out;
}

async function readCapped(res, maxBytes) {
  if (!res.body) return { text: '', truncated: false };
  const chunks = [];
  let total = 0;
  let truncated = false;
  for await (const chunk of res.body) {
    total += chunk.length;
    if (total > maxBytes) {
      chunks.push(chunk.subarray(0, chunk.length - (total - maxBytes)));
      truncated = true;
      break;
    }
    chunks.push(chunk);
  }
  return { text: Buffer.concat(chunks).toString('utf8'), truncated };
}

/** Cloudflare/WAF meydan okuma sayfası mı? */
export function isChallenge(status, headers, body) {
  if (headers['cf-mitigated']) return true;
  if (status !== 403 && status !== 503 && status !== 429) return false;
  const hay = String(body ?? '').slice(0, 4000).toLowerCase();
  return CHALLENGE_MARKERS.some((m) => hay.includes(m));
}

// --- robots.txt -----------------------------------------------------------

/** Bilinen AI tarayıcıları — engellenip engellenmedikleri raporlanır. */
export const AI_AGENTS = [
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'Claude-User',
  'PerplexityBot', 'Google-Extended', 'CCBot', 'Applebot-Extended', 'Bytespider'
];

/**
 * robots.txt ayrıştırıcı.
 * En uzun eşleşen kural kazanır (RFC 9309); eşitlikte Allow öncelikli.
 */
export function parseRobots(text) {
  const groups = [];
  const sitemaps = [];
  let currentAgents = null;
  let currentRules = null;

  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === 'user-agent') {
      if (currentRules && currentRules.length === 0 && currentAgents) {
        currentAgents.push(value);
        continue;
      }
      currentAgents = [value];
      currentRules = [];
      groups.push({ agents: currentAgents, rules: currentRules, crawlDelay: null });
      continue;
    }
    if (field === 'sitemap') {
      sitemaps.push(value);
      continue;
    }
    if (!currentRules) continue;
    if (field === 'allow' || field === 'disallow') {
      currentRules.push({ type: field, path: value });
    } else if (field === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n)) groups[groups.length - 1].crawlDelay = n;
    }
  }

  return { groups, sitemaps };
}

/** Verilen ajan için geçerli grubu seçer (tam eşleşme > *). */
export function robotsGroupFor(robots, agentToken) {
  if (!robots?.groups?.length) return null;
  const token = String(agentToken).toLowerCase();
  let wildcard = null;
  for (const g of robots.groups) {
    for (const a of g.agents) {
      const al = a.toLowerCase();
      if (al === token) return g;
      if (al === '*') wildcard = wildcard ?? g;
    }
  }
  return wildcard;
}

/** Bir yolun verilen grup tarafından taranmasına izin var mı? */
export function robotsAllows(group, pathname) {
  if (!group) return true;
  let best = null;
  for (const rule of group.rules) {
    if (rule.path === '') continue;
    if (!robotsPathMatches(rule.path, pathname)) continue;
    const len = rule.path.length;
    if (!best || len > best.len || (len === best.len && rule.type === 'allow')) {
      best = { type: rule.type, len };
    }
  }
  if (!best) return true;
  return best.type === 'allow';
}

function robotsPathMatches(pattern, pathname) {
  // robots.txt joker karakterleri: * (herhangi) ve $ (son)
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const parts = body.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`^${parts.join('.*')}${anchored ? '$' : ''}`);
  return re.test(pathname);
}

/** robots.txt içinde hangi AI tarayıcıları tümden engellenmiş? */
export function blockedAiAgents(robots) {
  if (!robots) return [];
  return AI_AGENTS.filter((agent) => {
    const group = robotsGroupFor(robots, agent);
    if (!group) return false;
    // Yalnızca bu ajana özel bir grup varsa "bilinçli engel" sayılır.
    const isSpecific = group.agents.some((a) => a.toLowerCase() === agent.toLowerCase());
    return isSpecific && !robotsAllows(group, '/');
  });
}

// --- sitemap --------------------------------------------------------------

/**
 * Sitemap ya da sitemap index'i ayrıştırır.
 * cheerio xmlMode kullanılır: ad alanlı `xhtml:link` hreflang alternatifleri ve
 * CDATA doğru işlenir.
 */
export async function parseSitemap(xml, load) {
  const $ = load(xml, { xmlMode: true });
  const isIndex = $('sitemapindex').length > 0;

  if (isIndex) {
    const children = [];
    $('sitemap > loc').each((_, el) => {
      const loc = $(el).text().trim();
      if (loc) children.push(loc);
    });
    return { type: 'index', children, entries: [] };
  }

  const entries = [];
  $('url').each((_, el) => {
    const $el = $(el);
    const loc = $el.find('> loc').first().text().trim();
    if (!loc) return;
    const lastmod = $el.find('> lastmod').first().text().trim() || null;
    const alternates = [];
    $el.find('link[rel="alternate"]').each((__, link) => {
      const $l = $(link);
      const hreflang = $l.attr('hreflang');
      const href = $l.attr('href');
      if (hreflang && href) alternates.push({ lang: hreflang, href });
    });
    entries.push({ loc, lastmod, alternates });
  });

  return { type: 'urlset', children: [], entries };
}

/** Gzip'li gövdeyi çözer; gzip değilse aynen döndürür. */
export async function maybeGunzip(buffer) {
  if (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    return (await gunzip(buffer)).toString('utf8');
  }
  return buffer.toString('utf8');
}

// `validLastmod` buradan taşındı: kural dosyaları onu kullanıyor ve bu modül
// `node:zlib` çektiği için tüm kural zincirini Node'a bağlıyordu. Artık saf
// `lib/validate.mjs` içinde; buradan yeniden dışa aktarılıyor ki mevcut
// çağıranlar kırılmasın ve iki kopya oluşmasın.
export { validLastmod } from './validate.mjs';
