---
name: security-headers
description: HTTP güvenlik başlıkları ve güven hijyeni — CSP, HSTS, X-Content-Type-Options, çerçeveleme koruması, Referrer-Policy, çerez bayrakları, SRI, sürüm sızıntısı. MDN HTTP Observatory tarzı skorlama. "güvenlik başlıkları", "CSP", "HSTS", "Observatory", "güvenlik skoru", "clickjacking", "çerez güvenliği", "site güvenli mi" konularında kullanın.
---

# Güvenlik Başlıkları

Bu skill, [MDN HTTP Observatory](https://developer.mozilla.org/en-US/observatory)'nin (eski adıyla Mozilla Observatory) değerlendirdiği kontrolleri kapsar ve denetim aracında yerel karşılıklarını çalıştırır.

## Neden bir SEO takımında?

**Maliyeti sıfır olduğu için.** Tarayıcı zaten her sayfanın yanıt başlıklarını topluyor; güvenlik değerlendirmesi ek istek gerektirmiyor.

## Ama dürüst olalım: bunlar sıralama faktörü değil

CSP, X-Frame-Options, Referrer-Policy ve Permissions-Policy eksikliği Google sıralamasını **düşürmez**. "Güvenlik başlıkları ekleyin, SEO'nuz artar" demek yanlış bir vaattir.

Bu yüzden araç, güvenlik skorunu **genel SEO skoruna katmaz** — ayrı hesaplar ve ayrı gösterir. Karıştırmak, SEO skorunun ölçtüğünü iddia ettiği şeyi ölçmemesi demek olurdu.

### SEO ile gerçekten kesişen üç nokta

1. **HTTPS ve karışık içerik.** HTTPS hafif bir sıralama sinyalidir ve karışık içerik tarayıcı tarafından engellenir — görsel yüklenmez, sayfa bozuk görünür. Bu bir SEO sorunudur (`mixed-content` kuralı `technical` kategorisindedir).
2. **HSTS ve yönlendirme zinciri.** HSTS, tarayıcının bir sonraki ziyarette doğrudan HTTPS'e gitmesini sağlar; `http → https` yönlendirme adımı ortadan kalkar. Bu ölçülebilir bir gecikme kazancıdır.
3. **Güven ve dönüşüm.** Tarayıcı uyarısı çıkaran veya güvensiz görünen bir site, sıralaması ne olursa olsun dönüşüm kaybeder.

Gerisi risk hijyenidir — değerlidir, ama SEO değildir.

## Kontroller

| Başlık | Ne yapar | Önerilen değer |
|---|---|---|
| `Strict-Transport-Security` | Tarayıcıyı bu alan adında hep HTTPS kullanmaya zorlar | `max-age=31536000; includeSubDomains` |
| `Content-Security-Policy` | Hangi kaynaktan betik/stil yüklenebileceğini kısıtlar | `default-src 'self'` ile başlayıp genişletin |
| `X-Content-Type-Options` | İçerik türü tahminini kapatır | `nosniff` |
| `Content-Security-Policy: frame-ancestors` | Sayfanın iframe'e gömülmesini engeller | `frame-ancestors 'self'` |
| `Referrer-Policy` | Dış sitelere giden URL bilgisini kısar | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Kullanılmayan tarayıcı yeteneklerini kapatır | `camera=(), microphone=(), geolocation=()` |
| `Set-Cookie` bayrakları | Çerezin çalınmasını zorlaştırır | `Secure; HttpOnly; SameSite=Lax` |
| `integrity` (SRI) | CDN ele geçirilirse betiği çalıştırmaz | `integrity="sha384-…" crossorigin` |

## Uygulama sırası

Hepsini aynı anda açmayın — CSP dışındakiler neredeyse risksiz, CSP ise siteyi kırabilir.

**1. Adım — risksiz olanlar (tek satır, kırılma riski yok):**

```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**2. Adım — HSTS (dikkatli):**

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

> `includeSubDomains` **tüm alt alan adlarını** kapsar. HTTPS sunmayan bir alt alan adınız varsa (eski bir test ortamı gibi) erişilemez hâle gelir. Önce kısa `max-age` ile deneyin, tüm alt alan adlarının HTTPS sunduğunu doğrulayın, sonra süreyi uzatın. `preload` listesine girmek geri alınması çok zor bir adımdır — acele etmeyin.

**3. Adım — çerçeveleme koruması:**

```
Content-Security-Policy: frame-ancestors 'self'
```

Sayfanız bilinçli olarak başka sitelere gömülüyorsa (widget, gömülü oynatıcı) izinli alan adlarını listeleyin.

**4. Adım — CSP (kademeli):**

Doğrudan zorlayıcı CSP yayınlamak siteyi kırar. Doğru sıra:

```
# Önce yalnızca raporla — hiçbir şeyi engellemez
Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-rapor

# İhlalleri topla, gerçek trafikte kırılan bir şey olmadığını doğrula
# Sonra zorlayıcı moda geç
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-rastgele'
```

`'unsafe-inline'` ile başlayıp sonra kaldırmayı planlamak yaygın ama işe yaramayan bir yoldur — pratikte hiç kaldırılmaz. Satır içi betikleri baştan nonce/hash ile beyaz listeye alın.

## Cloudflare arkasındaysanız

Bu başlıkların çoğu Cloudflare panelinden veya bir Transform Rule ile tek yerden eklenebilir; köken sunucuya dokunmaya gerek yoktur. HSTS ayrı bir bölümde (SSL/TLS → Edge Certificates) yer alır.

Ayrıca: Cloudflare bot koruması meşru denetim araçlarını ve bazı arama tarayıcılarını da bloklayabilir. Denetimde 403 alıyorsanız bu ayarı kontrol edin — güvenlik ayarı SEO'yu kırabilir.

## Ölçüm

```bash
# Yerel: tarama sırasında zaten toplanır
node ${CLAUDE_PLUGIN_ROOT}/tools/seo-audit.mjs https://ornek.com --format md,html

# Dış doğrulama
# https://developer.mozilla.org/en-US/observatory
```

**Not:** güvenlik kuralları yanıt başlığı gerektirir, dolayısıyla **yalnızca canlı taramada** çalışır. Çevrimdışı modda (kayıtlı HTML) rapor bu kategoriyi "değerlendirilemedi" olarak işaretler — sıfır puan vermez, çünkü ölçülmemiş olmak kötü olmakla aynı şey değildir.

İlgili kural kimlikleri: `hsts-missing`, `hsts-weak`, `csp-missing`, `csp-unsafe`, `x-content-type-options-missing`, `clickjacking-protection-missing`, `referrer-policy-missing`, `permissions-policy-missing`, `cookie-flags-weak`, `server-version-disclosure`, `sri-missing`. Karışık içerik için `technical` kategorisindeki `mixed-content`.
