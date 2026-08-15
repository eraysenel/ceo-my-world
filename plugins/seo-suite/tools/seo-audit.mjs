#!/usr/bin/env node
// seo-audit — Türkçe raporlayan SEO denetim aracı.
//
// Canlı tarama ve çevrimdışı analiz aynı kural motorunu kullanır.

import { parseArgs } from 'node:util';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { crawlLive, loadDirectory, loadSingleFile } from './lib/sources.mjs';
import { registry } from './rules/index.mjs';
import { runRules, computeScores, prioritize } from './lib/engine.mjs';
import { buildAuditJson, buildMarkdown, buildHtml } from './lib/report.mjs';
import { DEFAULT_USER_AGENT } from './lib/http.mjs';
import { CATEGORY_LABEL, CATEGORIES, SEVERITY_LABEL } from './lib/rules.mjs';

const OPTIONS = {
  'input-dir': { type: 'string' },
  'input-file': { type: 'string' },
  'base-url': { type: 'string' },
  'page-url': { type: 'string' },
  'from-audit': { type: 'string' },
  'max-pages': { type: 'string', default: '150' },
  depth: { type: 'string', default: '4' },
  concurrency: { type: 'string', default: '4' },
  delay: { type: 'string', default: '500' },
  timeout: { type: 'string', default: '15000' },
  'user-agent': { type: 'string' },
  'check-external': { type: 'boolean', default: false },
  'ignore-robots': { type: 'boolean', default: false },
  'i-own-this-site': { type: 'boolean', default: false },
  'min-words': { type: 'string', default: '300' },
  out: { type: 'string' },
  format: { type: 'string', default: 'json,md' },
  'fail-on': { type: 'string' },
  'min-score': { type: 'string' },
  quiet: { type: 'boolean', default: false },
  verbose: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false }
};

const HELP = `
seo-audit — Türkçe SEO denetim aracı

KULLANIM
  seo-audit <url> [seçenekler]                          canlı tarama
  seo-audit --input-dir <dizin> --base-url <url>        kayıtlı HTML dizini
  seo-audit --input-file <dosya> --page-url <url>       tek kayıtlı sayfa
  seo-audit --from-audit <audit.json>                   mevcut veriden rapor üret

KAYNAK
  --input-dir <dizin>      Kayıtlı .html dosyaları (ağ gerekmez)
  --base-url <url>         --input-dir için kök adres; dosya yolu → URL eşlemesi
  --input-file <dosya>     Tek bir kayıtlı HTML dosyası
  --page-url <url>         --input-file için sayfanın gerçek adresi
  --from-audit <dosya>     Taramayı atla, mevcut audit.json'dan rapor üret

TARAMA (yalnızca canlı)
  --max-pages <n>          Varsayılan 150
  --depth <n>              Maksimum derinlik, varsayılan 4
  --concurrency <n>        Eşzamanlı istek, varsayılan 4
  --delay <ms>             İstekler arası nezaket gecikmesi, varsayılan 500
  --timeout <ms>           İstek zaman aşımı, varsayılan 15000
  --user-agent <metin>     Varsayılan: ${DEFAULT_USER_AGENT}
  --check-external         Dış bağlantıların durum kodunu da doğrula (yavaş)
  --ignore-robots          robots.txt'i yok say (--i-own-this-site ile birlikte)
  --i-own-this-site        Sahiplik beyanı

KURALLAR
  --min-words <n>          İnce içerik eşiği, varsayılan 300

ÇIKTI
  --out <dizin>            Çıktı dizini, varsayılan ./seo-rapor/<host>
  --format <liste>         json,md,html — varsayılan json,md
  --fail-on <şiddet>       critical|error|warning → bulunursa çıkış kodu 2
  --min-score <n>          Genel skor bu değerin altındaysa çıkış kodu 2
  --quiet / --verbose      Günlük seviyesi
  -h, --help               Bu yardım

ÇIKIŞ KODLARI
  0 başarılı · 1 kullanım/araç hatası · 2 eşik aşıldı · 3 hedefe ulaşılamadı

NOTLAR
  JavaScript çalıştırılmaz; içeriğini tarayıcıda üreten siteler tespit edilip
  raporda düşük güven olarak işaretlenir. Core Web Vitals ölçülmez; performans
  bulguları bu metrikleri bozan yapısal nedenleri gösterir.
`;

async function main() {
  let parsed;
  try {
    parsed = parseArgs({ options: OPTIONS, allowPositionals: true, strict: true });
  } catch (err) {
    console.error(`Hata: ${err.message}\n"seo-audit --help" ile seçenekleri görebilirsiniz.`);
    process.exit(1);
  }

  const { values: v, positionals } = parsed;
  if (v.help || (positionals.length === 0 && !v['input-dir'] && !v['input-file'] && !v['from-audit'])) {
    console.log(HELP.trim());
    process.exit(v.help ? 0 : 1);
  }

  const log = v.quiet ? () => {} : (msg) => console.error(msg);
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  // --- Kaynak seçimi
  let site;
  let mode;
  let existingAudit = null;

  try {
    if (v['from-audit']) {
      mode = 'from-audit';
      existingAudit = JSON.parse(await readFile(v['from-audit'], 'utf8'));
      site = siteFromAudit(existingAudit);
    } else if (v['input-dir']) {
      mode = 'dir';
      if (!v['base-url']) throw new Error('--input-dir ile birlikte --base-url zorunludur.');
      log(`Kayıtlı HTML dizini okunuyor: ${v['input-dir']}`);
      site = await loadDirectory(v['input-dir'], v['base-url'], { log: v.verbose ? log : () => {} });
    } else if (v['input-file']) {
      mode = 'single';
      if (!v['page-url']) throw new Error('--input-file ile birlikte --page-url zorunludur.');
      site = await loadSingleFile(v['input-file'], v['page-url']);
    } else {
      mode = 'live';
      const start = normalizeStartUrl(positionals[0]);
      if (v['ignore-robots'] && !v['i-own-this-site']) {
        throw new Error('--ignore-robots yalnızca --i-own-this-site ile birlikte kullanılabilir.');
      }
      log(`Taranıyor: ${start}`);
      site = await crawlLive(start, {
        maxPages: int(v['max-pages']),
        maxDepth: int(v.depth),
        concurrency: int(v.concurrency),
        delayMs: int(v.delay),
        timeoutMs: int(v.timeout),
        userAgent: v['user-agent'] ?? DEFAULT_USER_AGENT,
        respectRobots: !v['ignore-robots'],
        checkExternal: v['check-external'],
        log: v.verbose ? log : () => {}
      });
    }
  } catch (err) {
    console.error(`Hata: ${err.message}`);
    process.exit(err.code === 'ENOENT' ? 1 : 1);
  }

  if (site.pages.size === 0) {
    console.error('Hata: hiç sayfa alınamadı. Hedefe ulaşılamıyor veya tamamı engellendi.');
    if (site.errors.length) console.error(site.errors.slice(0, 5).map((e) => `  ${e.kind}: ${e.url ?? ''} ${e.message ?? ''}`).join('\n'));
    process.exit(3);
  }

  // --- Kuralları çalıştır (yeniden raporlama modunda atlanır)
  let audit;
  let findings;
  let actions;
  let scores;

  if (mode === 'from-audit') {
    // Kurallar yeniden çalıştırılmaz: amaç, mevcut ölçümü farklı biçimde sunmak.
    // Yeniden çalıştırmak, kural kataloğu değiştiyse sessizce farklı bir sonuç
    // üretir ve "aynı denetimi yeniden yazdırdım" iddiasını yalan çıkarırdı.
    audit = existingAudit;
    findings = existingAudit.findings ?? [];
    actions = (existingAudit.actions ?? []).map((a) => ({ ...a, samplePages: a.samplePages ?? [] }));
    scores = existingAudit.scores;
  } else {
    const config = { minWords: int(v['min-words']) };
    const run = runRules(site, registry, { config });
    findings = run.findings;
    scores = computeScores(findings, run.applicability, registry);
    actions = prioritize(findings, run.applicability);
    audit = buildAuditJson({
      site, scores, findings, actions, applicability: run.applicability, registry,
      run: {
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - t0,
        mode,
        command: `seo-audit ${process.argv.slice(2).join(' ')}`,
        options: {
          maxPages: int(v['max-pages']), depth: int(v.depth), concurrency: int(v.concurrency),
          delayMs: int(v.delay), respectRobots: !v['ignore-robots'], checkExternal: v['check-external']
        },
        ruleErrors: run.ruleErrors
      }
    });
  }

  // --- Çıktı
  const host = site.registrableDomain ?? new URL(site.origin).hostname;
  const outDir = v.out ?? path.join('seo-rapor', host);
  const formats = new Set(String(v.format).split(',').map((f) => f.trim()).filter(Boolean));
  await mkdir(outDir, { recursive: true });

  const written = [];
  if (formats.has('json')) {
    const p = path.join(outDir, 'audit.json');
    await writeFile(p, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
    written.push(p);
  }
  if (formats.has('md')) {
    const p = path.join(outDir, 'rapor.md');
    await writeFile(p, `${buildMarkdown(audit, { site, findings, actions })}\n`, 'utf8');
    written.push(p);
  }
  if (formats.has('html')) {
    const p = path.join(outDir, 'rapor.html');
    await writeFile(p, `${buildHtml(audit, { site, actions })}\n`, 'utf8');
    written.push(p);
  }

  printSummary(audit, site, actions, written, v.quiet);

  // --- Çıkış kodu
  const failOn = v['fail-on'];
  if (failOn) {
    const order = ['critical', 'error', 'warning', 'notice', 'info'];
    const limit = order.indexOf(failOn);
    if (limit === -1) {
      console.error(`Hata: --fail-on değeri geçersiz: ${failOn}`);
      process.exit(1);
    }
    if (findings.some((f) => order.indexOf(f.severity) <= limit)) process.exit(2);
  }
  if (v['min-score'] && scores.overall !== null && scores.overall < Number(v['min-score'])) {
    process.exit(2);
  }
  process.exit(0);
}

function printSummary(audit, site, actions, written, quiet) {
  if (quiet) return;
  const s = audit.scores;
  const lines = [];
  lines.push('');
  lines.push(`  ${site.registrableDomain ?? site.origin} — ${site.pages.size} sayfa`);
  lines.push(`  Genel skor: ${s.overall ?? '—'}/100 (${s.verdict})`);
  lines.push('');
  for (const cat of CATEGORIES) {
    const c = s.categories[cat];
    if (c.score === null) continue;
    const bar = '█'.repeat(Math.round(c.score / 10)).padEnd(10, '·');
    lines.push(`  ${CATEGORY_LABEL[cat].padEnd(28)} ${bar} ${String(c.score).padStart(3)}  (${c.findings} bulgu)`);
  }
  lines.push('');
  const sev = audit.summary.bySeverity;
  lines.push(`  Bulgular: ${['critical', 'error', 'warning', 'notice', 'info']
    .filter((k) => sev[k]).map((k) => `${sev[k]} ${SEVERITY_LABEL[k]}`).join(' · ') || 'yok'}`);
  const p0 = actions.filter((a) => a.priority === 'P0');
  if (p0.length) {
    lines.push('');
    lines.push(`  Hemen yapılmalı (${p0.length}):`);
    for (const a of p0.slice(0, 5)) lines.push(`    • ${a.id} — ${a.count} yerde`);
  }
  lines.push('');
  for (const p of written) lines.push(`  yazıldı: ${p}`);
  lines.push('');
  console.error(lines.join('\n'));
}

function normalizeStartUrl(input) {
  if (!input) throw new Error('Başlangıç adresi gerekli.');
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const u = new URL(withScheme);
  return u.toString();
}

function int(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Sayısal değer bekleniyordu: ${value}`);
  return Math.trunc(n);
}

/**
 * audit.json'dan rapor üretebilmek için asgari bir site nesnesi kurar.
 * Kural koşumu için yeterli değildir; yalnızca raporlayıcıların ihtiyacı olan
 * alanları taşır.
 */
function siteFromAudit(audit) {
  const pages = new Map();
  for (const p of audit.pages ?? []) pages.set(p.url, p);
  return {
    origin: audit.site.origin,
    hosts: audit.site.hosts ?? [],
    registrableDomain: audit.site.registrableDomain ?? null,
    locales: audit.site.locales ?? [],
    rendering: audit.site.rendering ?? 'static',
    status: audit.run?.status ?? 'ok',
    robots: {
      found: audit.site.robots?.found ?? false,
      sitemaps: audit.site.robots?.sitemaps ?? [],
      blockedAiAgents: audit.site.robots?.blockedAiAgents ?? []
    },
    sitemaps: audit.site.sitemaps ?? [],
    sitemapUrls: new Set(),
    wellKnown: { llmsTxt: audit.site.wellKnown?.llmsTxt ?? false },
    pages,
    errors: audit.run?.errors ?? [],
    counters: audit.run?.counters ?? {},
    capabilities: audit.run?.capabilities ?? { net: false },
    fromAudit: true
  };
}

main().catch((err) => {
  console.error(`Beklenmeyen hata: ${err.stack ?? err.message}`);
  process.exit(1);
});
