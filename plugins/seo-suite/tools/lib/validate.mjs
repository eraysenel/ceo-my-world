// Saf doğrulama yardımcıları.
//
// Bu modül bilinçli olarak hiçbir Node API'si kullanmaz. Kural dosyaları
// buradan import edebilir ve kural motoru tarayıcıda da çalışabilir —
// `lib/http.mjs` `node:zlib` çektiği için oradan import etmek tüm kural
// zincirini Node'a bağlıyordu.

/**
 * Sitemap `lastmod` değeri W3C tarih biçimine uyuyor mu ve gelecekte değil mi?
 * @returns {{valid: boolean, reason?: 'missing'|'format'|'future'}}
 */
export function validLastmod(value, now = Date.now()) {
  if (!value) return { valid: false, reason: 'missing' };
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(value)) {
    return { valid: false, reason: 'format' };
  }
  const t = Date.parse(value);
  if (Number.isNaN(t)) return { valid: false, reason: 'format' };
  if (t > now + 86400000) return { valid: false, reason: 'future' };
  return { valid: true };
}
