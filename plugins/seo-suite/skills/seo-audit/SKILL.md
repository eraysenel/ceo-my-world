---
name: seo-audit
description: Bir web sitesini faz faz SEO açısından denetler ve Türkçe rapor üretir. Kullanıcı "SEO analizi", "SEO denetimi", "site analizi", "SEO raporu", "siteyi incele", "neden Google'da çıkmıyoruz", "sıralamamız düştü" dediğinde veya bir alan adı verip değerlendirme istediğinde kullanın. Tarama aracını çalıştırır, bulguları yorumlar, etki×efor sıralı aksiyon planı yazar. Tek bir konuya odaklı sorularda (yalnızca hreflang, yalnızca schema, yalnızca hız) ilgili uzman skill'i tercih edin.
argument-hint: "[alan-adı veya URL]"
---

# SEO Denetimi

Bir siteyi baştan sona denetlemenin yolu, sırayla ilerlemek ve **her fazı ölçümle kapatmaktır**. Tahminle geçilen faz, sonraki fazların tamamını çürütür.

## Temel ilke

> Ölçmediğin şeyi ölçmüş gibi raporlama.

Bu skill'in en sık yapılan hatadan kaçınması gerekir: bir sayfaya bakıp "içerik zayıf, hız yavaş, schema eksik" demek. Bunlar veri değil izlenimdir. Her iddianın arkasında ya araç çıktısı ya da doğrudan gözlemlenmiş bir kanıt olmalı; olmayan durumda "ölçülemedi" yazılır.

## Faz modeli

Fazlar sırayla yürütülür. Bir faz bitmeden sonrakine geçilmez, çünkü her faz bir sonrakinin varsayımını doğrular.

### Faz 0 — Kapsam

Denetime başlamadan önce şunlar netleşmeli. Bilinmiyorsa kullanıcıya sorun:

- Hangi alan adı/adları? Alt alan adları dahil mi?
- Site hangi dilde, hangi ülkeyi hedefliyor?
- İş hedefi ne: teklif formu mu, e-ticaret satışı mı, marka bilinirliği mi?
- Rakip olarak kimler görülüyor?
- Google Search Console erişimi var mı? (Varsa gerçek sorgu/tıklama verisi bu denetimin en değerli girdisidir; yoksa bu bir sınırdır ve raporda yazılmalıdır.)

Çıktı: `reports/<alan-adi>/00-kapsam.md`

### Faz 1 — Altyapı

DNS, TLS, HTTP sürümü, CDN, sunucu başlıkları. Bu katman HTTP isteği bile gerektirmeden kısmen ölçülebilir:

```bash
getent hosts <alan-adi>            # A/AAAA kayıtları
curl -sSI https://<alan-adi>/      # başlıklar, HTTP sürümü, sunucu
```

Bakılacaklar: nameserver sağlayıcı, CDN var mı, HTTP/2-3 açık mı, `content-encoding` (Brotli/gzip), `strict-transport-security`, `cache-control`, TXT kayıtlarında SPF/DMARC ve `google-site-verification`.

> SPF/DMARC doğrudan sıralama faktörü değildir. Ama iletişim altyapısı zayıf bir alan adı, marka güveni ve müşteriye ulaşma açısından gerçek bir eksiktir ve raporda "alan adı hijyeni" başlığı altında yer alır — sıralama vaadi olarak değil.

### Faz 2 — Taranabilirlik ve indexleme

Aracı çalıştırın:

```bash
cd ${CLAUDE_PLUGIN_ROOT}/tools
npm install                                   # ilk kullanımda
node seo-audit.mjs https://<alan-adi> \
  --max-pages 150 --format json,md,html \
  --out <depo>/reports/<alan-adi>
```

Ağ erişimi yoksa (kurumsal ortam, izin listesi, bot koruması) çevrimdışı mod:

```bash
node seo-audit.mjs --input-dir ./kayitlar --base-url https://<alan-adi>
```

`audit.json` içindeki `technical` ve `links` kategorilerini okuyun. Öncelik sırası:

1. `robots-noindex-conflict`, `http-status-error`, `broken-internal-link` — kritik, hemen
2. `canonical-*` ailesi — yinelenen içerik ve değer kaybı
3. `sitemap-*` — keşfedilebilirlik
4. `client-side-rendering` — varsa Faz 3'ün tüm bulgularının güvenini düşürür

### Faz 3 — Sayfa içi ve yapısal veri

`onpage`, `structured-data`, `media` kategorileri. Burada araç çıktısını **yorumlamak** gerekir: `thin-content` bulgusu 5 sayfada çıktıysa asıl soru "kelime sayısı az" değil, **"bu sayfa hangi aramaya hizmet ediyor ve o aramanın hangi alt sorusunu cevaplamıyor"**.

Her `title-duplicate` ve `duplicate-content-cluster` bulgusu için: bunlar bilinçli mi (sayfalama, filtre) yoksa kaza mı?

### Faz 4 — Deneyim

`performance` kategorisi + mobil + erişilebilirlik. Araç Core Web Vitals **ölçmez**; bu metrikleri bozan yapısal nedenleri gösterir. Gerçek alan verisi için:

- Google Search Console → Core Web Vitals raporu (gerçek kullanıcı verisi)
- PageSpeed Insights (laboratuvar + CrUX)

Bu verilere erişim yoksa raporda açıkça yazın: *"Core Web Vitals alan verisi alınamadı; aşağıdaki bulgular yapısal risklerdir, ölçülmüş metrik değildir."*

### Faz 5 — Görünürlük ve rekabet

- Marka araması ve ana hizmet aramalarında site görünüyor mu?
- Rakipler kimler, hangi içerik kümelerinde güçlüler?
- `ai-search` kategorisi: içerik sunucudan geliyor mu, AI tarayıcıları engellenmiş mi, sorulara doğrudan cevap veren bloklar var mı?

Arama sonuçlarını kontrol ederken kullandığınız aracın hangi ülke/dil için sonuç verdiğine dikkat edin. ABD odaklı bir arama motoru Türkiye SERP'ini yansıtmaz — bu bir sınırdır ve raporda belirtilir.

## Rapor yazımı

Ayrıntılı biçim için `seo-reporting` skill'ine bakın. Özet kurallar:

- **Skor kartıyla başla**, tek satırlık hükümle (`kritik` / `zayıf` / `orta` / `iyi` / `çok iyi`).
- **Aksiyon planını etki × efor** ile sırala; P0 maddeleri en fazla 5 tane olsun — 20 maddelik "acil" liste kimsenin işine yaramaz.
- **Her bulgunun yanına kanıt** koy: URL, ölçüm, ekran alıntısı.
- **Sınırları yaz.** Neyin ölçülemediği, neden ölçülemediği ve nasıl ölçülebileceği.

## Sık yapılan hatalar

| Hata | Neden yanlış | Yerine |
|---|---|---|
| Skoru tek gerçek sayı gibi sunmak | Skor sistemik sağlığı ölçer, aciliyeti değil | Skoru bağlamla, aciliyeti P0 listesiyle anlat |
| Tüm bulguları listelemek | 200 maddelik liste uygulanmaz | En yüksek etkili 5-10 maddeye odaklan, gerisini ek olarak ver |
| "Kelime sayısını artırın" demek | Kelime sayısı sonuçtur, hedef değil | Hangi alt sorunun cevapsız kaldığını söyle |
| JS ile gelen içeriği yok saymak | Araç göremiyor diye yok değildir | Tespit et, düşük güven işaretle, render edilmiş HTML ile tekrarla |
| AI tarayıcı engelini hata saymak | Bilinçli politika olabilir | Bildir, kararı kullanıcıya bırak |
| Rakip analizini tahminle yapmak | Doğrulanamaz iddia rapora zarar verir | Ya ölç ya "ölçülemedi" yaz |

## Diğer skill'ler

Derinleşmek gerektiğinde: `technical-seo`, `onpage-seo`, `structured-data`, `core-web-vitals`, `intl-seo`, `ai-search`, `content-strategy`, `local-seo`, `seo-reporting`.
