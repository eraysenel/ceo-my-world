// Güvenlik başlıkları ve güven hijyeni.
//
// Bu kategori, MDN HTTP Observatory'nin (eski adıyla Mozilla Observatory)
// değerlendirdiği kontrollerin yerel karşılığıdır. Neden bu araca dahil:
// yanıt başlıkları tarama sırasında zaten toplanıyor, yani ek istek maliyeti
// sıfır.
//
// DÜRÜSTLÜK NOTU: buradaki kuralların çoğu sıralama faktörü DEĞİLDİR. CSP veya
// X-Frame-Options eksikliği Google sıralamasını düşürmez. Bu yüzden güvenlik
// skoru genel SEO skoruna KATILMAZ; ayrı raporlanır. Karıştırmak, SEO skorunu
// ölçtüğünü iddia ettiği şeyi ölçmez hâle getirirdi.
//
// SEO ile gerçekten kesişenler ayrıca işaretlidir: HTTPS ve karışık içerik
// (bkz. technical/mixed-content), HSTS'in http→https yönlendirme zincirini
// kısaltması, ve güvensiz görünen bir sitenin dönüşüm kaybı.

import { defineRule } from '../lib/rules.mjs';
import { hostOf, resolveUrl } from '../lib/url.mjs';

const hasHeaders = (page) => page.ok && Object.keys(page.headers ?? {}).length > 0;
const isHttps = (page) => page.url.startsWith('https://');

/** Sürüm numarası sızdıran sunucu imzaları. */
const VERSION_PATTERN = /\d+\.\d+/;

export default [
  defineRule({
    id: 'hsts-missing',
    category: 'security', scope: 'page', severity: 'warning',
    weight: 7, impact: 4, effort: 'low', needs: ['headers'],
    description: 'Strict-Transport-Security başlığı yok',
    appliesTo: (page) => hasHeaders(page) && isHttps(page),
    check: (page, site, ctx) => {
      if (page.headers['strict-transport-security']) return null;
      return ctx.fail({
        evidence: {},
        message: 'HTTPS sunuluyor ama Strict-Transport-Security (HSTS) başlığı yok.',
        fix: 'Sunucuya `Strict-Transport-Security: max-age=31536000; includeSubDomains` ekleyin. Tarayıcı bir sonraki ziyarette doğrudan HTTPS\'e gider — hem araya girme saldırısı penceresi kapanır hem de http→https yönlendirme adımı ortadan kalkar (SEO tarafında bir gidiş-dönüş kazancı).'
      });
    }
  }),

  defineRule({
    id: 'hsts-weak',
    category: 'security', scope: 'page', severity: 'notice',
    weight: 4, impact: 2, effort: 'low', needs: ['headers'],
    description: 'HSTS max-age çok kısa',
    appliesTo: (page) => hasHeaders(page) && Boolean(page.headers['strict-transport-security']),
    check: (page, site, ctx) => {
      const raw = page.headers['strict-transport-security'];
      const maxAge = Number(/max-age\s*=\s*(\d+)/i.exec(raw)?.[1] ?? 0);
      if (maxAge >= 15552000) return null; // 180 gün
      return ctx.fail({
        evidence: { header: raw, maxAge },
        message: `HSTS max-age yalnızca ${maxAge} saniye (önerilen en az 15552000 = 180 gün).`,
        fix: 'max-age değerini en az 180 güne, tercihen 31536000 (1 yıl) değerine çıkarın.'
      });
    }
  }),

  defineRule({
    id: 'csp-missing',
    category: 'security', scope: 'page', severity: 'warning',
    weight: 7, impact: 4, effort: 'high', needs: ['headers'],
    description: 'Content-Security-Policy yok',
    appliesTo: hasHeaders,
    check: (page, site, ctx) => {
      if (page.headers['content-security-policy']) return null;
      return ctx.fail({
        evidence: {},
        message: 'Content-Security-Policy başlığı tanımlı değil.',
        fix: 'CSP, siteye enjekte edilen betiklerin çalışmasını engelleyen en etkili katmandır. Kademeli kurun: önce `Content-Security-Policy-Report-Only` ile yayınlayıp ihlalleri toplayın, gerçek trafikte kırılan bir şey olmadığını gördükten sonra zorlayıcı moda geçin.'
      });
    }
  }),

  defineRule({
    id: 'csp-unsafe',
    category: 'security', scope: 'page', severity: 'notice',
    weight: 5, impact: 3, effort: 'high', needs: ['headers'],
    description: 'CSP unsafe-inline / unsafe-eval veya joker kaynak içeriyor',
    appliesTo: (page) => hasHeaders(page) && Boolean(page.headers['content-security-policy']),
    check: (page, site, ctx) => {
      const csp = page.headers['content-security-policy'];
      const sorunlar = [];
      if (/'unsafe-inline'/i.test(csp)) sorunlar.push("'unsafe-inline'");
      if (/'unsafe-eval'/i.test(csp)) sorunlar.push("'unsafe-eval'");
      if (/script-src[^;]*\*(?!\.)/i.test(csp)) sorunlar.push('script-src *');
      if (sorunlar.length === 0) return null;
      return ctx.fail({
        evidence: { directives: sorunlar, csp: csp.slice(0, 200) },
        message: `CSP tanımlı ama koruma değerini düşüren yönergeler içeriyor: ${sorunlar.join(', ')}`,
        fix: "Satır içi betikleri nonce veya hash ile beyaz listeye alıp 'unsafe-inline' ihtiyacını kaldırın. 'unsafe-eval' gerektiren kütüphaneleri değiştirin. Joker kaynak yerine açık alan adı listesi kullanın."
      });
    }
  }),

  defineRule({
    id: 'x-content-type-options-missing',
    category: 'security', scope: 'page', severity: 'notice',
    weight: 5, impact: 3, effort: 'low', needs: ['headers'],
    description: 'X-Content-Type-Options: nosniff yok',
    appliesTo: hasHeaders,
    check: (page, site, ctx) => {
      const v = page.headers['x-content-type-options'] ?? '';
      if (/nosniff/i.test(v)) return null;
      return ctx.fail({
        evidence: { header: v || null },
        message: 'X-Content-Type-Options: nosniff başlığı yok.',
        fix: '`X-Content-Type-Options: nosniff` ekleyin. Tek satır, kırılma riski yok: tarayıcının içerik türünü tahmin edip bir metin dosyasını betik olarak çalıştırmasını engeller.'
      });
    }
  }),

  defineRule({
    id: 'clickjacking-protection-missing',
    category: 'security', scope: 'page', severity: 'notice',
    weight: 5, impact: 3, effort: 'low', needs: ['headers'],
    description: 'Çerçeveleme koruması yok (X-Frame-Options / frame-ancestors)',
    appliesTo: hasHeaders,
    check: (page, site, ctx) => {
      const xfo = page.headers['x-frame-options'];
      const csp = page.headers['content-security-policy'] ?? '';
      if (xfo || /frame-ancestors/i.test(csp)) return null;
      return ctx.fail({
        evidence: {},
        message: 'Sayfa başka bir sitenin iframe\'ine gömülmeye karşı korumasız.',
        fix: "CSP'ye `frame-ancestors 'self'` ekleyin (modern ve tercih edilen yol) veya `X-Frame-Options: SAMEORIGIN` başlığını kullanın. Aksi hâlde sayfanız görünmez bir çerçevede gömülüp kullanıcıya yanlış yere tıklatılabilir."
      });
    }
  }),

  defineRule({
    id: 'referrer-policy-missing',
    category: 'security', scope: 'page', severity: 'notice',
    weight: 4, impact: 2, effort: 'low', needs: ['headers'],
    description: 'Referrer-Policy yok',
    appliesTo: hasHeaders,
    check: (page, site, ctx) => {
      if (page.headers['referrer-policy']) return null;
      return ctx.fail({
        evidence: {},
        message: 'Referrer-Policy başlığı tanımlı değil.',
        fix: '`Referrer-Policy: strict-origin-when-cross-origin` ekleyin. Dış sitelere tam URL yerine yalnızca alan adı gider; parametre içinde taşınan bilgi sızmaz. Bu değer analitik yönlendirme raporlarını bozmaz.'
      });
    }
  }),

  defineRule({
    id: 'permissions-policy-missing',
    category: 'security', scope: 'page', severity: 'info',
    weight: 3, impact: 2, effort: 'low', needs: ['headers'],
    description: 'Permissions-Policy yok',
    appliesTo: hasHeaders,
    check: (page, site, ctx) => {
      if (page.headers['permissions-policy']) return null;
      return ctx.fail({
        evidence: {},
        message: 'Permissions-Policy başlığı tanımlı değil.',
        fix: 'Kullanılmayan tarayıcı yeteneklerini kapatın, ör. `Permissions-Policy: camera=(), microphone=(), geolocation=()`. (Bilgi amaçlı bulgu — skoru etkilemez.)'
      });
    }
  }),

  defineRule({
    id: 'cookie-flags-weak',
    category: 'security', scope: 'page', severity: 'warning',
    weight: 6, impact: 3, effort: 'low', needs: ['headers'],
    description: 'Çerezlerde Secure / HttpOnly / SameSite eksik',
    appliesTo: (page) => hasHeaders(page) && Boolean(page.headers['set-cookie']),
    check: (page, site, ctx) => {
      const raw = page.headers['set-cookie'];
      const eksik = [];
      if (!/;\s*Secure/i.test(raw)) eksik.push('Secure');
      if (!/;\s*HttpOnly/i.test(raw)) eksik.push('HttpOnly');
      if (!/;\s*SameSite/i.test(raw)) eksik.push('SameSite');
      if (eksik.length === 0) return null;
      return ctx.fail({
        evidence: { missing: eksik, sample: raw.slice(0, 120) },
        message: `Çerez tanımında eksik güvenlik bayrakları: ${eksik.join(', ')}`,
        fix: 'Oturum çerezlerine `Secure; HttpOnly; SameSite=Lax` ekleyin. HttpOnly, çerezi JavaScript\'ten okunamaz yapar; bir XSS açığı doğrudan oturum çalmaya dönüşmez.'
      });
    }
  }),

  defineRule({
    id: 'server-version-disclosure',
    category: 'security', scope: 'page', severity: 'info',
    weight: 2, impact: 1, effort: 'low', needs: ['headers'],
    description: 'Sunucu veya çatı sürümü başlıkta açıklanıyor',
    appliesTo: hasHeaders,
    check: (page, site, ctx) => {
      const acik = [];
      for (const key of ['server', 'x-powered-by', 'x-aspnet-version', 'x-generator']) {
        const v = page.headers[key];
        if (v && VERSION_PATTERN.test(v)) acik.push(`${key}: ${v}`);
      }
      if (acik.length === 0) return null;
      return ctx.fail({
        evidence: { headers: acik },
        message: `Sürüm bilgisi açıklanıyor: ${acik.join(', ')}`,
        fix: 'Sürüm numaralarını başlıklardan kaldırın. Tek başına açık değildir, ama bilinen bir zafiyeti olan sürümü duyurmak saldırganın işini kolaylaştırır. (Bilgi amaçlı bulgu — skoru etkilemez.)'
      });
    }
  }),

  defineRule({
    id: 'sri-missing',
    category: 'security', scope: 'page', severity: 'notice',
    weight: 5, impact: 3, effort: 'medium', needs: ['html'],
    description: 'Üçüncü taraf betikte integrity (SRI) yok',
    appliesTo: (page) => page.ok && page.perf.thirdPartyOrigins.length > 0,
    check: (page, site, ctx) => {
      const korumasiz = page.perf.thirdPartyScripts?.filter((s) => !s.integrity) ?? [];
      if (korumasiz.length === 0) return null;
      return ctx.fail({
        evidence: { count: korumasiz.length, samples: korumasiz.slice(0, 5).map((s) => s.src) },
        message: `${korumasiz.length} üçüncü taraf betik integrity (SRI) özniteliği olmadan yükleniyor.`,
        fix: '`integrity` ve `crossorigin` öznitelikleri ekleyin. Kaynak CDN ele geçirilirse tarayıcı özet uyuşmadığı için betiği çalıştırmaz. Sürekli güncellenen betikler için SRI uygun değildir — o durumda kaynağı kendi alan adınızdan sunmayı değerlendirin.'
      });
    }
  })
];
