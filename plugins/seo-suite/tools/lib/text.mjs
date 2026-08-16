// Türkçeye özgü metin işlemleri.
//
// JavaScript'in varsayılan toLowerCase/toUpperCase'i Türkçede yanlış sonuç verir:
//   'İSTANBUL'.toLowerCase() -> 'i̇stanbul'  (i + birleşen nokta)
//   'ısı'.toUpperCase()      -> 'ISI'        (doğru, ama 'i'.toUpperCase() -> 'I', yanlış)
// Bu yüzden karşılaştırmaların tamamı buradaki eşlemelerden geçer.

const LOWER_MAP = { I: 'ı', İ: 'i', Ş: 'ş', Ğ: 'ğ', Ü: 'ü', Ö: 'ö', Ç: 'ç' };
const UPPER_MAP = { i: 'İ', ı: 'I', ş: 'Ş', ğ: 'Ğ', ü: 'Ü', ö: 'Ö', ç: 'Ç' };

/** Türkçe kurallarına göre küçük harfe çevirir. */
export function trLower(str) {
  if (!str) return '';
  return String(str).replace(/[IİŞĞÜÖÇ]/g, (ch) => LOWER_MAP[ch]).toLowerCase();
}

/** Türkçe kurallarına göre büyük harfe çevirir. */
export function trUpper(str) {
  if (!str) return '';
  return String(str).replace(/[ıişğüöç]/g, (ch) => UPPER_MAP[ch] ?? ch).toUpperCase();
}

const collator = new Intl.Collator('tr', { sensitivity: 'base' });

/** İki metnin Türkçe harmanlamaya göre eşit olup olmadığını söyler. */
export function trEquals(a, b) {
  return collator.compare(a ?? '', b ?? '') === 0;
}

/** Karşılaştırma/gruplama için normalize edilmiş anahtar üretir. */
export function normalizeKey(str) {
  return trLower(str).replace(/\s+/g, ' ').trim();
}

// URL slug'ı: Türkçe karakterler ASCII karşılığına indirgenir.
const SLUG_MAP = { ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c' };

/** Türkçe metinden SEO uyumlu ASCII slug üretir. */
export function slugify(str) {
  return trLower(String(str ?? '').replace(/[ıİşŞğĞüÜöÖçÇ]/g, (ch) => SLUG_MAP[ch]))
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Latin-1 olarak yorumlanmış UTF-8 Türkçe karakterlerin imzaları.
// Bunlar bir sayfada göründüğünde kodlama bozuktur (mojibake).
const MOJIBAKE_SEQUENCES = ['Ã¼', 'Ã¶', 'Ã§', 'ÅŸ', 'Ä±', 'ÄŸ', 'Ä°', 'Åž', 'Ã‡', 'Ã–', 'Ãœ', 'Â '];

/**
 * Bozuk kodlama tespiti.
 * Tek bir eşleşme yanıltıcı olabilir (kodlamayı anlatan bir yazı olabilir);
 * bu yüzden en az 2 farklı imza ya da toplam 4 tekrar aranır.
 */
export function detectMojibake(text) {
  if (!text) return null;
  const hits = [];
  let total = 0;
  for (const seq of MOJIBAKE_SEQUENCES) {
    let count = 0;
    let idx = text.indexOf(seq);
    while (idx !== -1) {
      count += 1;
      idx = text.indexOf(seq, idx + seq.length);
    }
    if (count > 0) {
      hits.push({ seq, count });
      total += count;
    }
  }
  if (hits.length >= 2 || total >= 4) return { sequences: hits, total };
  return null;
}

// Türkçe metin tespiti için sık kullanılan işlev sözcükleri.
const TR_STOPWORDS = new Set([
  've', 'ile', 'bir', 'bu', 'için', 'olarak', 'daha', 'çok', 'gibi', 'olan', 'da', 'de',
  'ama', 'veya', 'ya', 'her', 'en', 'ne', 'kadar', 'sonra', 'önce', 'ise', 'ki', 'mi',
  'nasıl', 'neden', 'hangi', 'tüm', 'bazı', 'kendi', 'şey', 'yok', 'var'
]);

/** Metnin Türkçe olma ihtimalini 0-1 arası bir oranla verir. */
export function turkishStopwordRatio(text) {
  const words = tokenize(text);
  if (words.length < 20) return 0;
  let hits = 0;
  for (const w of words) if (TR_STOPWORDS.has(w)) hits += 1;
  return hits / words.length;
}

/** Metni küçük harfli sözcüklere ayırır (Türkçe harfler korunur). */
export function tokenize(text) {
  return trLower(text ?? '')
    .split(/[^a-zçğıöşü0-9]+/)
    .filter((w) => w.length > 1);
}

/** Anlamlı sözcük sayısı. */
export function wordCount(text) {
  return tokenize(text).length;
}

// --- Başlık piksel genişliği ---------------------------------------------
//
// Google SERP başlığı karakterle değil piksel genişliğiyle keser (~580px masaüstü).
// Türkçede 'ı' ve 'i' dar, 'ğ' ve 'ş' ortalama genişliktedir; sadece karakter
// saymak Türkçe başlıklarda yanıltıcı olur. Aşağıdaki tablo Arial 20px için
// yaklaşık genişliklerdir (birim: piksel).

const GLYPH_WIDTH = {
  ' ': 5.6, '!': 5.6, '"': 7.1, '#': 11.1, '$': 11.1, '%': 17.8, '&': 13.3, "'": 3.8,
  '(': 6.7, ')': 6.7, '*': 7.8, '+': 11.7, ',': 5.6, '-': 6.7, '.': 5.6, '/': 5.6,
  ':': 5.6, ';': 5.6, '<': 11.7, '=': 11.7, '>': 11.7, '?': 11.1, '@': 20.3,
  '[': 5.6, ']': 5.6, '_': 11.1, '|': 5.2, '–': 11.1, '—': 20.0, '’': 3.8, '“': 7.1, '”': 7.1
};

const LOWER_NARROW = new Set(['i', 'ı', 'j', 'l', 'f', 't', 'r', 'İ']);
const LOWER_WIDE = new Set(['m', 'w']);
const UPPER_WIDE = new Set(['M', 'W']);
const UPPER_NARROW = new Set(['I', 'J']);

function glyphWidth(ch) {
  if (GLYPH_WIDTH[ch] !== undefined) return GLYPH_WIDTH[ch];
  if (/[0-9]/.test(ch)) return 11.1;
  if (LOWER_NARROW.has(ch)) return 4.8;
  if (LOWER_WIDE.has(ch)) return 16.7;
  if (UPPER_NARROW.has(ch)) return 5.6;
  if (UPPER_WIDE.has(ch)) return 16.7;
  // Türkçe büyük harfler ASCII karşılıklarıyla aynı genişliktedir.
  if (/[A-ZÇĞİÖŞÜ]/.test(ch)) return 13.3;
  if (/[a-zçğıöşü]/.test(ch)) return 11.1;
  return 11.1;
}

/** Bir metnin SERP'te kaplayacağı yaklaşık piksel genişliği. */
export function measureTextPx(text) {
  if (!text) return 0;
  let total = 0;
  for (const ch of String(text)) total += glyphWidth(ch);
  return Math.round(total);
}

// --- Yakın kopya tespiti --------------------------------------------------

/** Tohumlanmış FNV-1a. İki farklı tohum 64 bitlik parmak izi üretmek için kullanılır. */
function hash32(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Yakın kopya sayılan azami bit farkı (64 bit üzerinden). */
export const NEAR_DUPLICATE_DISTANCE = 6;

/**
 * 64 bitlik simhash (BigInt).
 *
 * 32 bit denendi ve yetersiz kaldı: bu kadar kısa bir parmak izinde birkaç
 * cümlelik fark bile onlarca biti değiştiriyor, dolayısıyla "yakın kopya"
 * eşiği ya gerçek kopyaları kaçırıyor ya da alakasız sayfaları eşleştiriyordu.
 * 64 bit, eşiğin anlamlı bir aralığa oturmasını sağlar.
 */
export function simhash(text) {
  const tokens = tokenize(text);
  if (tokens.length === 0) return 0n;

  const vector = new Array(64).fill(0);
  for (const token of tokens) {
    const lo = hash32(token, 0x811c9dc5);
    const hi = hash32(token, 0x9e3779b9);
    for (let bit = 0; bit < 32; bit += 1) {
      vector[bit] += (lo >>> bit) & 1 ? 1 : -1;
      vector[bit + 32] += (hi >>> bit) & 1 ? 1 : -1;
    }
  }

  let out = 0n;
  for (let bit = 0; bit < 64; bit += 1) {
    if (vector[bit] > 0) out |= 1n << BigInt(bit);
  }
  return out;
}

/** İki simhash arasındaki bit farkı sayısı. */
export function hammingDistance(a, b) {
  let x = BigInt(a) ^ BigInt(b);
  let count = 0;
  while (x) {
    x &= x - 1n;
    count += 1;
  }
  return count;
}

const utf8Encoder = new TextEncoder();

/**
 * Bir metnin UTF-8 bayt uzunluğu.
 *
 * `Buffer.byteLength` yerine `TextEncoder` kullanılıyor: aynı sonucu verir ama
 * tarayıcıda da çalışır. Kural motoru panel için tarayıcıya paketleniyor ve
 * `Buffer` orada tanımlı değil — bayt sayımı Türkçe metinde kritik, çünkü
 * `ş`, `ğ`, `İ` gibi harfler 2 bayt tutar ve `<meta charset>` konumu bayt
 * cinsinden ölçülür.
 */
export function utf8Bytes(str) {
  return utf8Encoder.encode(String(str ?? '')).length;
}

/** Metni verilen uzunlukta kısaltır (raporlarda kanıt göstermek için). */
export function truncate(text, max = 120) {
  const str = String(text ?? '').replace(/\s+/g, ' ').trim();
  return str.length <= max ? str : `${str.slice(0, max - 1)}…`;
}
