// Kural koşum motoru ve skorlama.

import {
  SEVERITY_MULTIPLIER, CATEGORY_WEIGHT, CATEGORIES, SEO_CATEGORIES, makeFinding
} from './rules.mjs';

/** Nadir ama gerçek sorunların sıfıra yuvarlanmasını engelleyen taban. */
export const PREVALENCE_FLOOR = 0.30;

/** Güven düzeyine göre ceza sönümlemesi. */
const CONFIDENCE_DAMPING = { high: 1, medium: 0.7, low: 0.4 };

export const SCORING_VERSION = 1;

/**
 * Kuralları çalıştırır.
 *
 * @param {object} site      SiteModel
 * @param {object} registry  buildRegistry() çıktısı
 * @param {object} options   { config }
 */
export function runRules(site, registry, options = {}) {
  const config = options.config ?? {};
  const findings = [];
  const applicability = new Map(); // ruleId -> { applicable, failed }
  const errors = [];

  const pages = [...site.pages.values()].sort((a, b) => (a.url < b.url ? -1 : 1));

  const bump = (ruleId, key) => {
    const rec = applicability.get(ruleId) ?? { applicable: 0, failed: 0 };
    rec[key] += 1;
    applicability.set(ruleId, rec);
  };

  for (const rule of registry.all) {
    if (!capabilitiesSatisfy(site.capabilities, rule.needs)) continue;
    if (!applicability.has(rule.id)) applicability.set(rule.id, { applicable: 0, failed: 0 });

    const ctx = {
      config,
      fail: (payload) => makeFinding(rule, payload)
    };

    if (rule.scope === 'site') {
      let applicable = true;
      try {
        applicable = rule.appliesTo ? Boolean(rule.appliesTo(site, site, ctx)) : true;
      } catch (err) {
        errors.push({ rule: rule.id, phase: 'appliesTo', message: String(err.message) });
        continue;
      }
      if (!applicable) continue;
      bump(rule.id, 'applicable');
      try {
        const result = rule.check(site, site, ctx);
        const produced = toArray(result);
        if (produced.length) bump(rule.id, 'failed');
        findings.push(...produced);
      } catch (err) {
        errors.push({ rule: rule.id, phase: 'check', message: String(err.message) });
      }
      continue;
    }

    for (const page of pages) {
      let applicable = true;
      try {
        applicable = rule.appliesTo ? Boolean(rule.appliesTo(page, site, ctx)) : true;
      } catch (err) {
        errors.push({ rule: rule.id, page: page.url, phase: 'appliesTo', message: String(err.message) });
        continue;
      }
      if (!applicable) continue;
      bump(rule.id, 'applicable');
      try {
        const produced = toArray(rule.check(page, site, ctx));
        if (produced.length) bump(rule.id, 'failed');
        for (const f of produced) findings.push({ ...f, page: f.page ?? page.url });
      } catch (err) {
        // Bozuk bir kural denetimi asla durdurmaz.
        errors.push({ rule: rule.id, page: page.url, phase: 'check', message: String(err.message) });
      }
    }
  }

  annotateConfidence(findings, site);
  return { findings, applicability, ruleErrors: errors };
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function capabilitiesSatisfy(capabilities, needs) {
  for (const need of needs) {
    if (need === 'html') continue;
    if (need === 'site') continue;
    if (!capabilities?.[need]) return false;
  }
  return true;
}

/**
 * Güven etiketleme.
 *
 * Site içeriğini tarayıcıda üretiyorsa (SPA) bu araç onu göremez. O durumda
 * içerik bağımlı bulgular SİLİNMEZ — çünkü Google'ın ilk geçişi de render
 * edilmemiş HTML'i görür, yani eksik H1 gerçekten (daha zayıf) bir sinyaldir.
 * Bunun yerine güven düşürülür ve ceza sönümlenir.
 */
const CONTENT_DEPENDENT = new Set([
  'thin-content', 'h1-missing', 'h1-count', 'heading-hierarchy-skip', 'duplicate-content-cluster',
  'img-missing-alt', 'img-missing-dimensions', 'img-alt-quality', 'jsonld-missing',
  'answerable-summary-missing', 'broken-internal-link', 'orphan-page', 'anchor-text-generic',
  'internal-links-few'
]);

function annotateConfidence(findings, site) {
  const spa = site.rendering === 'client-side-suspect';
  const partial = site.status === 'partial' || site.status === 'blocked';
  for (const f of findings) {
    let confidence = 'high';
    if (spa && CONTENT_DEPENDENT.has(f.id)) confidence = 'low';
    else if (partial) confidence = 'medium';
    f.confidence = confidence;
  }
}

/** Kategori ve genel skorları hesaplar. */
export function computeScores(findings, applicability, registry) {
  const byRule = new Map();
  for (const f of findings) {
    byRule.set(f.id, (byRule.get(f.id) ?? 0) + 1);
  }

  const categories = {};
  for (const cat of CATEGORIES) {
    let penalty = 0;
    let maxPenalty = 0;
    let evaluated = 0;
    const total = registry.byCategory(cat).length;

    for (const rule of registry.byCategory(cat)) {
      const rec = applicability.get(rule.id);
      if (!rec || rec.applicable === 0) continue;
      evaluated += 1;

      const multiplier = SEVERITY_MULTIPLIER[rule.severity];
      if (multiplier === 0) continue; // info skoru etkilemez
      maxPenalty += rule.weight * multiplier;

      if (rec.failed === 0) continue;
      const prevalence = rec.failed / rec.applicable;
      const damping = worstConfidenceDamping(findings, rule.id);
      penalty += rule.weight * multiplier *
        (PREVALENCE_FLOOR + (1 - PREVALENCE_FLOOR) * prevalence) * damping;
    }

    categories[cat] = {
      score: maxPenalty > 0 ? Math.max(0, Math.round(100 * (1 - penalty / maxPenalty))) : null,
      penalty: round2(penalty),
      maxPenalty: round2(maxPenalty),
      evaluatedRules: evaluated,
      totalRules: total,
      findings: findings.filter((f) => f.category === cat).length
    };
  }

  // Genel skor yalnızca ağırlığı olan kategorilerden hesaplanır. `security`
  // ağırlığı 0'dır: kendi skorunu alır ama SEO skorunu kaydırmaz.
  const present = SEO_CATEGORIES.filter((c) => categories[c].score !== null && CATEGORY_WEIGHT[c] > 0);
  const weightSum = present.reduce((s, c) => s + CATEGORY_WEIGHT[c], 0);
  const overall = weightSum > 0
    ? Math.round(present.reduce((s, c) => s + CATEGORY_WEIGHT[c] * categories[c].score, 0) / weightSum)
    : null;

  // Kritik hüküm yalnızca SEO kategorilerine bakar; güvenlik bulgusu ayrı raporlanır.
  const hasCritical = findings.some((f) => f.severity === 'critical' && f.category !== 'security');

  return {
    overall,
    verdict: verdictFor(overall, hasCritical),
    security: categories.security?.score ?? null,
    categories,
    model: { scoringVersion: SCORING_VERSION, rulesDigest: registry.digest }
  };
}

function worstConfidenceDamping(findings, ruleId) {
  let damping = 1;
  for (const f of findings) {
    if (f.id !== ruleId) continue;
    damping = Math.min(damping, CONFIDENCE_DAMPING[f.confidence] ?? 1);
  }
  return damping;
}

function verdictFor(overall, hasCritical) {
  if (hasCritical) return 'kritik';
  if (overall === null) return 'değerlendirilemedi';
  if (overall >= 90) return 'çok iyi';
  if (overall >= 75) return 'iyi';
  if (overall >= 60) return 'orta';
  if (overall >= 40) return 'zayıf';
  return 'kritik';
}

const EFFORT_FACTOR = { low: 1.0, medium: 0.6, high: 0.35 };
const SEVERITY_BOOST = { critical: 1.5, error: 1.2, warning: 1.0, notice: 0.8, info: 0.5 };

/**
 * Etki × efor önceliklendirmesi.
 * Kritik bulgular skordan bağımsız olarak P0'a sabitlenir: skor sistemik
 * sağlığı ölçer, aciliyeti değil. İkisini karıştırmak SEO skorlarını
 * kullanışsız yapan şeydir.
 */
export function prioritize(findings, applicability) {
  const grouped = new Map();

  for (const f of findings) {
    const entry = grouped.get(f.id) ?? {
      id: f.id,
      category: f.category,
      severity: f.severity,
      impact: f.impact,
      effort: f.effort,
      message: f.message,
      fix: f.fix,
      count: 0,
      samplePages: []
    };
    entry.count += f.pages ? f.pages.length : 1;
    if (entry.samplePages.length < 5) {
      if (f.pages) entry.samplePages.push(...f.pages.slice(0, 5 - entry.samplePages.length));
      else if (f.page) entry.samplePages.push(f.page);
    }
    grouped.set(f.id, entry);
  }

  const out = [];
  for (const entry of grouped.values()) {
    const rec = applicability.get(entry.id);
    const prevalence = rec && rec.applicable > 0 ? rec.failed / rec.applicable : 1;
    let score = entry.impact * EFFORT_FACTOR[entry.effort] *
      (0.5 + 0.5 * prevalence) * SEVERITY_BOOST[entry.severity];
    if (entry.severity === 'critical') score = Math.max(score, 5);
    out.push({ ...entry, prevalence: round2(prevalence), priorityScore: round2(score), priority: bucket(score) });
  }

  out.sort((a, b) => b.priorityScore - a.priorityScore || (a.id < b.id ? -1 : 1));
  return out;
}

function bucket(score) {
  if (score >= 5) return 'P0';
  if (score >= 3) return 'P1';
  if (score >= 1.5) return 'P2';
  return 'P3';
}

export const PRIORITY_LABEL = {
  P0: 'Hemen yapılmalı',
  P1: 'Bu sprint',
  P2: 'Planla',
  P3: 'İsteğe bağlı'
};

function round2(n) {
  return Math.round(n * 100) / 100;
}
