// Rapor üretimi: audit.json, rapor.md, rapor.html
//
// Raporun birinci kuralı: ölçülmeyen şey ölçülmüş gibi gösterilmez.
// Kısmi tarama, bot engeli veya istemci tarafı render varsa bu raporun
// başında yazar; kategori skorlarının kaç kural üzerinden hesaplandığı
// her satırda görünür.

import { CATEGORY_LABEL, SEVERITY_LABEL, CATEGORIES, SEO_CATEGORIES } from './rules.mjs';
import { PRIORITY_LABEL, SCORING_VERSION } from './engine.mjs';

const SEVERITY_ORDER = ['critical', 'error', 'warning', 'notice', 'info'];

/**
 * Denetlenen siteden gelen metni Markdown'a güvenle gömer.
 *
 * Bulgu mesajları taranan sayfanın başlığını, bağlantı metnini ve URL'lerini
 * içerir — yani DENETLENEN SİTENİN KONTROLÜNDEKİ metni. Bu metin ham hâlde
 * rapora yazılırsa, rapor bir Markdown→HTML dönüştürücüden geçirildiğinde
 * (müşteriye PDF/HTML sunumu yaygın bir iş akışıdır) içindeki <script> çalışır.
 * Raporun kendisi bir saldırı yüzeyine dönüşmemeli.
 *
 * `&lt;` Markdown'da düz `<` olarak görünür, yani okunabilirlik korunur.
 */
function mdSafe(value, { inTable = false } = {}) {
  let s = String(value ?? '').replace(/[\r\n]+/g, ' ');
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (inTable) s = s.replace(/\|/g, '\\|');
  return s;
}

/** Makine okunur çıktı. Anahtar sırası sabittir ki iki denetimin git farkı okunabilsin. */
export function buildAuditJson({ site, scores, findings, actions, applicability, registry, run }) {
  return {
    schemaVersion: 1,
    tool: { name: 'seo-audit', version: '0.1.0', node: process.version },
    run: {
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      durationMs: run.durationMs,
      mode: run.mode,
      status: site.status,
      command: run.command,
      options: run.options,
      capabilities: site.capabilities,
      counters: site.counters,
      errors: site.errors.slice(0, 100),
      ruleErrors: run.ruleErrors ?? []
    },
    site: {
      origin: site.origin,
      hosts: site.hosts,
      registrableDomain: site.registrableDomain,
      locales: site.locales,
      rendering: site.rendering,
      robots: {
        found: site.robots.found,
        sitemaps: site.robots.sitemaps,
        blockedAiAgents: site.robots.blockedAiAgents
      },
      sitemaps: site.sitemaps.map((s) => ({
        url: s.url, ok: s.ok, kind: s.kind ?? null, urlCount: s.urlCount ?? 0, error: s.error ?? null
      })),
      wellKnown: { llmsTxt: Boolean(site.wellKnown.llmsTxt) },
      pageCount: site.pages.size
    },
    scores: {
      overall: scores.overall,
      verdict: scores.verdict,
      categories: scores.categories,
      model: { ...scores.model, scoringVersion: SCORING_VERSION, ruleCount: registry.all.length }
    },
    summary: {
      bySeverity: countBy(findings, (f) => f.severity),
      byCategory: countBy(findings, (f) => f.category),
      totalFindings: findings.length
    },
    actions: actions.map((a) => ({
      id: a.id, category: a.category, severity: a.severity, priority: a.priority,
      priorityScore: a.priorityScore, count: a.count, prevalence: a.prevalence,
      message: a.message, fix: a.fix, samplePages: a.samplePages
    })),
    pages: [...site.pages.values()]
      .sort((a, b) => (a.normalizedUrl < b.normalizedUrl ? -1 : 1))
      .map(serializePage),
    findings: [...findings]
      .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) ||
        String(a.page).localeCompare(String(b.page)))
      .map((f) => ({
        id: f.id, category: f.category, severity: f.severity, scope: f.scope,
        page: f.page, pages: f.pages, confidence: f.confidence,
        message: f.message, fix: f.fix, evidence: f.evidence
      })),
    applicability: Object.fromEntries([...applicability.entries()].sort())
  };
}

function serializePage(p) {
  return {
    url: p.normalizedUrl,
    status: p.status,
    depth: p.depth,
    title: p.head.title,
    titlePx: p.head.titlePx,
    metaDescription: p.head.metaDescription,
    canonical: p.head.canonical,
    robots: { index: p.head.metaRobots.index, follow: p.head.metaRobots.follow },
    lang: p.head.lang,
    h1: p.headings.h1,
    wordCount: p.content.mainWordCount,
    counts: {
      links: p.links.length,
      internalLinks: p.links.filter((l) => l.internal).length,
      images: p.media.images.length,
      imagesNoAlt: p.media.images.filter((i) => !i.hasAltAttr).length,
      jsonldBlocks: p.jsonld.blocks.length
    },
    schemaTypes: p.jsonld.types,
    timing: p.timing,
    flags: p.flags
  };
}

function countBy(items, fn) {
  const out = {};
  for (const item of items) {
    const key = fn(item);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

// --- Markdown -------------------------------------------------------------

export function buildMarkdown(audit, { site, findings, actions }) {
  const L = [];
  const s = audit.scores;

  L.push(`# SEO Denetim Raporu — ${mdSafe(site.registrableDomain ?? site.origin)}`);
  L.push('');
  L.push(`**Tarih:** ${audit.run.startedAt.slice(0, 10)}  `);
  L.push(`**Kapsam:** ${site.pages.size} sayfa · ${audit.run.mode === 'live' ? 'canlı tarama' : 'çevrimdışı analiz'}  `);
  L.push(`**Genel skor:** ${s.overall ?? '—'}/100 (${s.verdict})`);
  L.push('');

  const warnings = confidenceWarnings(site, audit);
  if (warnings.length) {
    L.push('> [!WARNING]');
    for (const w of warnings) L.push(`> ${w}`);
    L.push('');
  }

  // Skor kartı
  L.push('## Skor kartı');
  L.push('');
  L.push('| Kategori | Skor | Bulgu | Değerlendirilen kural |');
  L.push('|---|---:|---:|---|');
  for (const cat of SEO_CATEGORIES) {
    const c = s.categories[cat];
    const score = c.score === null ? '—' : `${c.score}`;
    const coverage = c.evaluatedRules === 0 ? 'uygulanamadı'
      : `${c.evaluatedRules}/${c.totalRules}`;
    L.push(`| ${CATEGORY_LABEL[cat]} | ${score} | ${c.findings} | ${coverage} |`);
  }
  L.push('');

  const sec = s.categories.security;
  if (sec) {
    L.push(`**Güvenlik ve güven:** ${sec.score === null ? 'değerlendirilemedi (yanıt başlıkları gerekir)' : `${sec.score}/100`}`
      + ` — ${sec.findings} bulgu, ${sec.evaluatedRules}/${sec.totalRules} kural.`);
    L.push('');
    L.push('> Güvenlik skoru **genel SEO skoruna dahil değildir**. CSP, X-Frame-Options ve'
      + ' benzeri başlıklar sıralama faktörü değildir; ayrı ölçülür çünkü yanıt başlıkları'
      + ' tarama sırasında zaten toplanıyor ve marka güveni açısından gerçek bir riski gösteriyor.');
    L.push('');
  }

  const sev = audit.summary.bySeverity;
  L.push(`**Bulgu dağılımı:** ${SEVERITY_ORDER
    .filter((k) => sev[k])
    .map((k) => `${sev[k]} ${SEVERITY_LABEL[k]}`)
    .join(' · ') || 'bulgu yok'}`);
  L.push('');

  // Aksiyon planı
  L.push('## Aksiyon planı (etki × efor)');
  L.push('');
  if (actions.length === 0) {
    L.push('Bulgu üretilmedi.');
    L.push('');
  } else {
    for (const bucket of ['P0', 'P1', 'P2', 'P3']) {
      const items = actions.filter((a) => a.priority === bucket);
      if (items.length === 0) continue;
      L.push(`### ${bucket} — ${PRIORITY_LABEL[bucket]} (${items.length})`);
      L.push('');
      for (const a of items) {
        L.push(`#### \`${a.id}\` · ${SEVERITY_LABEL[a.severity]} · ${a.count} yerde`);
        L.push('');
        L.push(mdSafe(a.message));
        L.push('');
        L.push(`**Ne yapmalı:** ${mdSafe(a.fix)}`);
        if (a.samplePages.length) {
          L.push('');
          L.push('<details><summary>Örnek sayfalar</summary>');
          L.push('');
          for (const p of a.samplePages.slice(0, 5)) L.push(`- ${mdSafe(p)}`);
          L.push('');
          L.push('</details>');
        }
        L.push('');
      }
    }
  }

  // Altyapı
  L.push('## Altyapı ve taranabilirlik');
  L.push('');
  L.push(`- **robots.txt:** ${site.robots.found ? 'var' : 'YOK'}`);
  if (site.robots.blockedAiAgents.length) {
    L.push(`- **Engellenen AI tarayıcıları:** ${mdSafe(site.robots.blockedAiAgents.join(', '))}`);
  }
  const okSitemaps = site.sitemaps.filter((x) => x.ok);
  const sitemapUrlCount = site.sitemapUrls?.size ?? okSitemaps.reduce((n, x) => n + (x.urlCount ?? 0), 0);
  L.push(`- **Sitemap:** ${okSitemaps.length ? `${okSitemaps.length} adet, toplam ${sitemapUrlCount} URL` : 'YOK'}`);
  L.push(`- **llms.txt:** ${site.wellKnown.llmsTxt ? 'var' : 'yok'} *(Google özel işlemiyor — düşük öncelik)*`);
  L.push(`- **Render:** ${site.rendering === 'static' ? 'sunucu tarafı (iyi)' : 'istemci tarafı şüphesi'}`);
  L.push(`- **Diller:** ${site.locales.length ? mdSafe(site.locales.join(', ')) : 'beyan edilmemiş'}`);
  L.push('');

  // En sorunlu sayfalar
  const worst = worstPages(findings, 10);
  if (worst.length) {
    L.push('## En çok bulgu üreten sayfalar');
    L.push('');
    L.push('| Sayfa | Bulgu | Kritik/Hata |');
    L.push('|---|---:|---:|');
    for (const w of worst) {
      L.push(`| ${mdSafe(w.url, { inTable: true })} | ${w.total} | ${w.severe} |`);
    }
    L.push('');
  }

  // Yöntem
  L.push('## Yöntem ve sınırlar');
  L.push('');
  L.push(`Bu rapor \`seo-audit\` ile üretildi (kural kataloğu ${audit.scores.model.ruleCount} kural, skor modeli v${SCORING_VERSION}, katalog özeti \`${audit.scores.model.rulesDigest}\`).`);
  L.push('');
  L.push('- **JavaScript çalıştırılmadı.** Rapor, sunucudan gelen HTML kaynağını temel alır. Tarayıcıda üretilen içerik görülmez.');
  L.push('- **Core Web Vitals ölçülmedi.** Performans bulguları, bu metrikleri bozduğu bilinen yapısal nedenleri gösterir; gerçek alan verisi için Search Console (CrUX) gerekir.');
  L.push('- **Skor sistemik sağlığı ölçer, aciliyeti değil.** Ceza, etkilenen sayfa oranına göre hesaplanır; tek bir bozuk sayfa skoru çökertmez. Aciliyet için aksiyon planındaki P0 maddelerine bakın.');
  if (site.errors.length) {
    L.push(`- **${site.errors.length} adres alınamadı** (zaman aşımı, DNS veya ağ hatası); bu adresler hiçbir kuralda değerlendirilmedi.`);
  }
  L.push('');

  return L.join('\n');
}

function confidenceWarnings(site, audit) {
  const out = [];
  if (site.status === 'blocked') {
    out.push('**Tarama engellendi.** Hedef site bot korumasıyla istekleri reddetti. Kısmi veriyle üretilen skorlar güvenilir değildir. Sayfaları tarayıcıdan kaydedip `--input-dir` ile çevrimdışı modda çalıştırın.');
  }
  if (site.status === 'partial') {
    out.push(`**Kısmi tarama.** İsteklerin %${Math.round(100 * site.counters.failed / Math.max(1, site.counters.requested))} kadarı başarısız oldu; kapsam eksik.`);
  }
  if (site.rendering === 'client-side-suspect') {
    out.push('**İstemci tarafı render tespit edildi.** Bu site içeriğinin bir kısmını tarayıcıda JavaScript ile üretiyor. Bu araç JavaScript çalıştırmaz; içerik, başlık ve bağlantı bulgularının bir bölümü render sonrası geçerli olmayabilir — bu bulgular `düşük güven` olarak işaretlendi ve skora etkileri azaltıldı.');
  }
  if (!site.capabilities.net) {
    out.push('**Çevrimdışı mod.** Durum kodu, yönlendirme ve başlık gerektiren kurallar çalıştırılamadı; skor yalnızca HTML üzerinden hesaplanabilen kurallar üzerinden hesaplandı.');
  }
  if (audit.run.ruleErrors?.length) {
    out.push(`${audit.run.ruleErrors.length} kural çalışırken hata verdi ve o sayfalarda değerlendirilmedi.`);
  }
  return out;
}

function worstPages(findings, limit) {
  const map = new Map();
  for (const f of findings) {
    const urls = f.pages ?? (f.page ? [f.page] : []);
    for (const url of urls) {
      const rec = map.get(url) ?? { url, total: 0, severe: 0 };
      rec.total += 1;
      if (f.severity === 'critical' || f.severity === 'error') rec.severe += 1;
      map.set(url, rec);
    }
  }
  return [...map.values()]
    .sort((a, b) => b.severe - a.severe || b.total - a.total)
    .slice(0, limit);
}

// --- HTML -----------------------------------------------------------------

export function buildHtml(audit, { site, actions }) {
  const s = audit.scores;
  const rows = SEO_CATEGORIES.map((cat) => {
    const c = s.categories[cat];
    return `<tr><td>${esc(CATEGORY_LABEL[cat])}</td><td class="num">${c.score ?? '—'}</td><td class="num">${c.findings}</td><td class="num">${c.evaluatedRules}/${c.totalRules}</td></tr>`;
  }).join('\n');

  const sec = s.categories.security;
  const securityHtml = sec
    ? `<h2>Güvenlik ve güven</h2>
  <p><span class="score">${sec.score ?? '—'}</span><span class="verdict">/100 — ${sec.findings} bulgu, ${sec.evaluatedRules}/${sec.totalRules} kural</span></p>
  <div class="warn">Güvenlik skoru <strong>genel SEO skoruna dahil değildir</strong>. CSP, X-Frame-Options ve benzeri başlıklar sıralama faktörü değildir; ayrı ölçülür çünkü yanıt başlıkları tarama sırasında zaten toplanıyor.</div>`
    : '';

  const actionHtml = actions.map((a) => `
    <article class="action ${esc(a.severity)}">
      <h3><code>${esc(a.id)}</code> <span class="tag">${esc(a.priority)}</span> <span class="tag">${esc(SEVERITY_LABEL[a.severity])}</span> <span class="count">${a.count} yerde</span></h3>
      <p>${esc(a.message)}</p>
      <p class="fix"><strong>Ne yapmalı:</strong> ${esc(a.fix)}</p>
      ${a.samplePages.length ? `<details><summary>Örnek sayfalar</summary><ul>${a.samplePages.slice(0, 5).map((p) => `<li>${esc(p)}</li>`).join('')}</ul></details>` : ''}
    </article>`).join('\n');

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SEO Denetim — ${esc(site.registrableDomain ?? site.origin)}</title>
<style>
  :root { color-scheme: light dark; --bg:#fff; --fg:#111; --muted:#666; --line:#e3e3e3; --accent:#0b5fff; }
  @media (prefers-color-scheme: dark) { :root { --bg:#14161a; --fg:#e8e8e8; --muted:#9aa0a6; --line:#2a2e35; --accent:#7aa2ff; } }
  * { box-sizing: border-box; }
  body { margin:0; padding:2rem 1rem; background:var(--bg); color:var(--fg);
         font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif; }
  main { max-width: 60rem; margin: 0 auto; }
  h1 { font-size: 1.6rem; margin: 0 0 .25rem; }
  h2 { font-size: 1.2rem; margin: 2rem 0 .75rem; border-bottom:1px solid var(--line); padding-bottom:.3rem; }
  .meta { color: var(--muted); margin-bottom: 1.5rem; }
  .score { font-size: 3rem; font-weight: 700; line-height:1; }
  .verdict { color: var(--muted); }
  table { width:100%; border-collapse: collapse; margin: .5rem 0 1rem; }
  th,td { text-align:left; padding:.5rem .6rem; border-bottom:1px solid var(--line); }
  td.num, th.num { text-align:right; font-variant-numeric: tabular-nums; }
  .warn { border-left:4px solid #d97706; background:rgba(217,119,6,.08); padding:.75rem 1rem; margin:1rem 0; border-radius:0 4px 4px 0; }
  .action { border:1px solid var(--line); border-radius:6px; padding:.85rem 1rem; margin:.75rem 0; }
  .action.critical { border-left:4px solid #dc2626; }
  .action.error { border-left:4px solid #ea580c; }
  .action.warning { border-left:4px solid #ca8a04; }
  .action h3 { font-size:.98rem; margin:0 0 .5rem; font-weight:600; }
  .tag { display:inline-block; font-size:.72rem; padding:.1rem .45rem; border:1px solid var(--line);
         border-radius:99px; color:var(--muted); vertical-align:middle; }
  .count { color:var(--muted); font-weight:400; font-size:.85rem; }
  .fix { color:var(--muted); }
  code { background:rgba(127,127,127,.14); padding:.1rem .35rem; border-radius:3px; font-size:.9em; }
  footer { margin-top:3rem; color:var(--muted); font-size:.85rem; border-top:1px solid var(--line); padding-top:1rem; }
</style>
</head>
<body>
<main>
  <h1>SEO Denetim Raporu</h1>
  <p class="meta">${esc(site.registrableDomain ?? site.origin)} · ${esc(audit.run.startedAt.slice(0, 10))} · ${site.pages.size} sayfa</p>
  <p><span class="score">${s.overall ?? '—'}</span><span class="verdict">/100 — ${esc(s.verdict)}</span></p>
  ${confidenceWarnings(site, audit).map((w) => `<div class="warn">${esc(stripMd(w))}</div>`).join('\n')}

  <h2>Skor kartı</h2>
  <table>
    <thead><tr><th>Kategori</th><th class="num">Skor</th><th class="num">Bulgu</th><th class="num">Kural</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  ${securityHtml}

  <h2>Aksiyon planı</h2>
  ${actionHtml || '<p>Bulgu üretilmedi.</p>'}

  <footer>
    <p>seo-audit ${esc(audit.tool.version)} · ${audit.scores.model.ruleCount} kural · skor modeli v${SCORING_VERSION} · katalog <code>${esc(audit.scores.model.rulesDigest)}</code></p>
    <p>JavaScript çalıştırılmadı; rapor sunucudan gelen HTML kaynağını temel alır. Core Web Vitals ölçülmedi — performans bulguları yapısal nedenleri gösterir.</p>
  </footer>
</main>
</body>
</html>`;
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function stripMd(str) {
  return String(str).replace(/\*\*/g, '').replace(/`/g, '');
}
