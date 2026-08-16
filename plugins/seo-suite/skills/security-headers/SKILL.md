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

Hepsini aynı anda açmayın. Risk sırasına göre ilerleyin; her aşama bir öncekinin kırılmadığı doğrulandıktan sonra gelir.

| Aşama | Ne | Risk |
|---|---|---|
| 1 | `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` | Yok denecek kadar az |
| 2 | HSTS — önce kısa `max-age`, sonra uzat | Alt alan adlarını da kapsar; geri alması zor |
| 3 | Çerçeveleme koruması (`X-Frame-Options`) | Sayfa bilinçli gömülüyorsa kırar |
| 4 | CSP **report-only** + ihlal toplama | Yok — hiçbir şeyi engellemez |
| 5 | CSP zorlayıcı | Yüksek — 4. aşama temizlenmeden geçilmez |

Üç nokta özellikle dikkat ister:

**HSTS'in geri alınması diğerlerinden farklıdır.** Tarayıcı başlığı bir kez gördüğünde, kuralı silseniz bile `max-age` dolana kadar o alan adına yalnızca HTTPS ile bağlanır. Geri almanın tek yolu `max-age=0` yayınlayıp beklemektir. `includeSubDomains` tüm alt alan adlarını kapsar; HTTPS sunmayan bir alt alan adı erişilemez hâle gelir. `preload` listesine girmek aylarca geri alınamaz.

**Tek CSP başlığı kuralı.** Aşama 3'te `frame-ancestors` yerine `X-Frame-Options` kullanın. Sebep: Aşama 5'te tam CSP yazacaksınız; şimdi ayrı bir CSP başlığı eklerseniz, ikinci CSP geldiğinde **ikisi de uygulanır ve kısıtlar kesişir**. Teşhisi zor kırılmaların klasik kaynağı budur. `frame-ancestors` Aşama 5'te CSP'nin içine girer, `X-Frame-Options` o zaman kaldırılır.

**`'unsafe-inline'` ile başlayıp sonra kaldırma planı işlemez.** Pratikte hiç kaldırılmaz, çünkü kaldırıldığı anda site kırılır ve iş ertelenir. Sonuç: CSP tanımlı görünür ama betik enjeksiyonuna karşı koruma sağlamaz. Satır içi betikleri baştan nonce ile beyaz listeye alın; nonce her istekte farklı olmalı.

**Adım adım uygulama, doğrulama ve geri alma:** [`references/cloudflare-uygulama.md`](references/cloudflare-uygulama.md) — Cloudflare panelinde tam ekran yolları, yapıştırılacak değerler, her aşama için `curl` doğrulaması ve geri alma adımı. Ayrıca hangi kontrolün Cloudflare'dan, hangisinin uygulama kodundan yapılması gerektiğini ayıran tablo.

## Cloudflare arkasındaysanız

Başlıkların çoğu tek bir Transform Rule ile eklenir; köken sunucuya dokunmaya gerek yoktur. HSTS ayrı bir ekrandadır (SSL/TLS → Edge Certificates). Çerez bayrakları, SRI ve CSP nonce'u ise Cloudflare'dan yapılamaz — uygulama kodunda yapılır.

**Güvenlik ayarı SEO'yu kırabilir:** Cloudflare bot koruması (`Security → Bots`) meşru denetim araçlarını ve bazı arama tarayıcılarını da bloklayabilir. Denetimde 403 alıyorsanız ilk bakılacak yer burasıdır.

## Ölçüm

```bash
# Yerel: tarama sırasında zaten toplanır
node ${CLAUDE_PLUGIN_ROOT}/tools/seo-audit.mjs https://ornek.com --format md,html

# Dış doğrulama
# https://developer.mozilla.org/en-US/observatory
```

**Not:** güvenlik kuralları yanıt başlığı gerektirir, dolayısıyla **yalnızca canlı taramada** çalışır. Çevrimdışı modda (kayıtlı HTML) rapor bu kategoriyi "değerlendirilemedi" olarak işaretler — sıfır puan vermez, çünkü ölçülmemiş olmak kötü olmakla aynı şey değildir.

İlgili kural kimlikleri: `hsts-missing`, `hsts-weak`, `csp-missing`, `csp-unsafe`, `x-content-type-options-missing`, `clickjacking-protection-missing`, `referrer-policy-missing`, `permissions-policy-missing`, `cookie-flags-weak`, `server-version-disclosure`, `sri-missing`. Karışık içerik için `technical` kategorisindeki `mixed-content`.
