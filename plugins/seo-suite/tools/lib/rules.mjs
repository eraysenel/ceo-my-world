// Kural tanımı ve kaydı.
//
// Kurallar SAF ve SENKRONDUR; I/O yapmazlar. Ağdan gelmesi gereken her şey
// (canonical hedefinin durum kodu, görsel baytları, iç link haritası) tarama
// aşamasında toplanır ve kurala hazır verilir. Bunun iki sonucu var:
//   1. Her kural bir fixture ile test edilebilir, ağ gerekmez.
//   2. Çevrimdışı mod bir "veri var mı" sorusuna indirgenir, ayrı bir kod yolu olmaz.

export const CATEGORIES = [
  'technical', 'onpage', 'structured-data', 'performance', 'i18n', 'ai-search', 'links', 'media',
  'security'
];

/**
 * Genel SEO skoruna katılan kategoriler.
 *
 * `security` bilinçli olarak DIŞARIDA. Güvenlik başlıklarının çoğu (CSP,
 * X-Frame-Options, Permissions-Policy) sıralama faktörü değildir; bunları SEO
 * skoruna katmak, skorun ölçtüğünü iddia ettiği şeyi ölçmemesi demek olurdu.
 * Ayrı bir skor olarak raporlanır.
 */
export const SEO_CATEGORIES = CATEGORIES.filter((c) => c !== 'security');

export const SEVERITIES = ['critical', 'error', 'warning', 'notice', 'info'];

/** Şiddet → ceza çarpanı. `info` bilgilendirmedir, skoru etkilemez. */
export const SEVERITY_MULTIPLIER = {
  critical: 5, error: 3, warning: 1.5, notice: 0.5, info: 0
};

/**
 * Kategori ağırlıkları (uygulanamayan kategoriler düşülüp yeniden normalize edilir).
 * Ağırlığı 0 olan kategori kendi skorunu alır ama genel skora katılmaz.
 */
export const CATEGORY_WEIGHT = {
  technical: 0.22,
  onpage: 0.20,
  links: 0.12,
  performance: 0.12,
  'structured-data': 0.10,
  i18n: 0.08,
  'ai-search': 0.08,
  media: 0.08,
  security: 0
};

export const CATEGORY_LABEL = {
  technical: 'Teknik / indexlenebilirlik',
  onpage: 'Sayfa içi (on-page)',
  'structured-data': 'Yapısal veri',
  performance: 'Performans',
  i18n: 'Dil ve uluslararasılaşma',
  'ai-search': 'AI aramada görünürlük',
  links: 'Bağlantılar',
  media: 'Görsel ve medya',
  security: 'Güvenlik ve güven'
};

export const SEVERITY_LABEL = {
  critical: 'kritik', error: 'hata', warning: 'uyarı', notice: 'öneri', info: 'bilgi'
};

/** Bir kuralın çalışabilmesi için gereken veri yetenekleri. */
export const NEEDS = ['html', 'headers', 'net', 'site'];

/**
 * Kural tanımlar ve tanımı doğrular.
 * Hatalı kural import anında patlar — sessizce düşüp skoru şişirmesindense.
 */
export function defineRule(spec) {
  const {
    id, category, severity, weight, impact = 3, effort = 'medium',
    scope = 'page', needs = ['html'], appliesTo = null, check, description = ''
  } = spec;

  if (!id || typeof id !== 'string') throw new Error('defineRule: id zorunlu');
  if (!CATEGORIES.includes(category)) throw new Error(`defineRule(${id}): geçersiz category "${category}"`);
  if (!SEVERITIES.includes(severity)) throw new Error(`defineRule(${id}): geçersiz severity "${severity}"`);
  if (!Number.isFinite(weight) || weight < 1 || weight > 10) {
    throw new Error(`defineRule(${id}): weight 1-10 arasında olmalı`);
  }
  if (!['low', 'medium', 'high'].includes(effort)) {
    throw new Error(`defineRule(${id}): effort low|medium|high olmalı`);
  }
  if (!['page', 'site'].includes(scope)) throw new Error(`defineRule(${id}): scope page|site olmalı`);
  if (typeof check !== 'function') throw new Error(`defineRule(${id}): check fonksiyonu zorunlu`);
  for (const n of needs) {
    if (!NEEDS.includes(n)) throw new Error(`defineRule(${id}): bilinmeyen needs "${n}"`);
  }

  return Object.freeze({
    id, category, severity, weight, impact, effort, scope, needs, appliesTo, check, description
  });
}

/**
 * Bulgu üretmek için kısayol. Kural içinde `ctx.fail({...})` olarak kullanılır.
 * Mesajlar doğrudan Türkçe yazılır — rapor tek dilli olduğu için ayrı bir
 * çeviri katmanı gereksiz karmaşıklık olurdu.
 */
export function makeFinding(rule, { page = null, pages = null, evidence = {}, message, fix, location = null }) {
  return {
    id: rule.id,
    category: rule.category,
    severity: rule.severity,
    weight: rule.weight,
    scope: rule.scope,
    impact: rule.impact,
    effort: rule.effort,
    page,
    pages,
    evidence,
    message,
    fix,
    location
  };
}

/** Kural listesini kimlik çakışmasına karşı doğrular. */
export function buildRegistry(ruleArrays) {
  const all = ruleArrays.flat();
  const byId = new Map();
  for (const rule of all) {
    if (byId.has(rule.id)) throw new Error(`Yinelenen kural kimliği: ${rule.id}`);
    byId.set(rule.id, rule);
  }
  return {
    all,
    byId,
    byCategory: (cat) => all.filter((r) => r.category === cat),
    /** Kural kataloğunun parmak izi — skorların karşılaştırılabilirliği için. */
    digest: fingerprint(all)
  };
}

function fingerprint(rules) {
  const parts = [...rules]
    .map((r) => `${r.id}:${r.category}:${r.severity}:${r.weight}`)
    .sort()
    .join('|');
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < parts.length; i += 1) {
    const c = parts.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}
