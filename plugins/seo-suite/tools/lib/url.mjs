// URL normalleştirme ve karşılaştırma.
//
// Bir denetim aracında URL normalleştirmesi doğrudan bulgu kalitesini belirler:
// aynı sayfayı iki farklı URL sanmak yinelenen içerik yanılgısı üretir, farklı
// sayfaları aynı sanmak ise gerçek sorunları gizler.

/** Karşılaştırmadan çıkarılan takip parametreleri. */
export const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'yclid', 'ttclid',
  'ref', 'mc_cid', 'mc_eid', '_ga', 'igshid'
]);

/**
 * Karşılaştırma için URL'yi kanonik biçime getirir.
 *
 * Yapılanlar: şema/host küçük harfe, varsayılan port atılır, fragment atılır,
 * takip parametreleri silinir, kalan parametreler sıralanır, yüzde kodlaması
 * büyük harfe çevrilir (%c4%b1 ile %C4%B1 aynı URL'dir).
 *
 * Yapılmayan: sondaki eğik çizgi KORUNUR. `/a` ile `/a/` sunucuya göre farklı
 * sayfa olabilir; ikisi de 200 dönüyorsa bu bir bulgudur, sessizce birleştirilmez.
 */
export function normalizeUrl(input, base) {
  let u;
  try {
    u = new URL(input, base);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

  u.hash = '';
  u.hostname = u.hostname.toLowerCase();
  if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) {
    u.port = '';
  }

  const params = [...u.searchParams.entries()].filter(([k]) => !TRACKING_PARAMS.has(k.toLowerCase()));
  params.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  u.search = '';
  for (const [k, v] of params) u.searchParams.append(k, v);

  return normalizePercentEncoding(u.toString());
}

/** Yüzde kodlamasındaki onaltılık basamakları büyük harfe çevirir. */
export function normalizePercentEncoding(str) {
  return str.replace(/%[0-9a-fA-F]{2}/g, (m) => m.toUpperCase());
}

/** Göreli adresi mutlak adrese çevirir; başarısızsa null. */
export function resolveUrl(href, base) {
  if (!href) return null;
  const trimmed = String(href).trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  if (/^(mailto|tel|javascript|data|sms|whatsapp):/i.test(trimmed)) return null;
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return null;
  }
}

/** İki URL aynı kayıtlı alan adına mı ait? (basit son-iki-etiket yaklaşımı) */
export function sameSite(a, b) {
  const ra = registrableDomain(a);
  const rb = registrableDomain(b);
  return Boolean(ra) && ra === rb;
}

// Türkiye'de yaygın iki seviyeli uzantılar; bunlarda son ÜÇ etiket alınır.
const MULTI_LEVEL_TLDS = new Set([
  'com.tr', 'net.tr', 'org.tr', 'gov.tr', 'edu.tr', 'k12.tr', 'av.tr', 'bel.tr',
  'co.uk', 'org.uk', 'com.au', 'co.jp', 'com.br'
]);

/** Kayıtlı alan adını döndürür (ornek.com.tr, ornek.com gibi). */
export function registrableDomain(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_LEVEL_TLDS.has(lastTwo)) return parts.slice(-3).join('.');
  return lastTwo;
}

/** URL'nin host kısmı. */
export function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** URL'nin yol kısmı (sorgu ve fragment olmadan). */
export function pathOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
}

/** Yoldaki bölüm sayısı — derinlik göstergesi. */
export function pathDepth(url) {
  return pathOf(url).split('/').filter(Boolean).length;
}

/** `www.` önekini kaldırır. */
export function stripWww(host) {
  return String(host ?? '').replace(/^www\./i, '');
}

/**
 * Yolda ham (kodlanmamış) Türkçe karakter var mı?
 * Tarayıcılar bunu kodlar, ama canonical/sitemap/iç linkler arasında
 * tutarsızlık olduğunda Google iki ayrı URL görür.
 */
export function hasRawTurkishChars(url) {
  const decoded = safeDecode(pathOf(url));
  return /[ıİşŞğĞüÜöÖçÇ]/.test(decoded);
}

/** Yüzde kodlamasını güvenli çözer; bozuksa girdiyi aynen döndürür. */
export function safeDecode(str) {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

/** Yolda büyük harf ya da alt çizgi var mı? */
export function hasUppercaseOrUnderscore(url) {
  const p = pathOf(url);
  return /[A-Z]/.test(p) || p.includes('_');
}

/** Sondaki eğik çizgiyi kaldırılmış hâlini verir (kök hariç). */
export function withoutTrailingSlash(url) {
  try {
    const u = new URL(url);
    if (u.pathname !== '/' && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.replace(/\/+$/, '');
    }
    return u.toString();
  } catch {
    return url;
  }
}

/** Dosya uzantısına bakarak HTML dışı bir kaynak mı diye bakar. */
const NON_HTML_EXT = /\.(?:jpg|jpeg|png|gif|webp|avif|svg|ico|css|js|mjs|json|xml|pdf|zip|rar|mp3|mp4|wav|ogg|webm|woff2?|ttf|eot|txt|csv|xlsx?|docx?)$/i;

export function looksNonHtml(url) {
  return NON_HTML_EXT.test(pathOf(url));
}
