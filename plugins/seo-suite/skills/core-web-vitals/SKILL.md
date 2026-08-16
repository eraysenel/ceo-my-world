---
name: core-web-vitals
description: Core Web Vitals (LCP, INP, CLS) ve sayfa hızı optimizasyonu — render engelleyiciler, kaynak ipuçları, görsel yükleme, önbellek stratejisi, HTTP/2-3, yazı tipi yükleme. "sayfa yavaş", "LCP", "INP", "CLS", "PageSpeed", "Core Web Vitals", "düzen kayması", "hız optimizasyonu", "TTFB", "render blocking" konularında kullanın.
---

# Core Web Vitals ve Performans

## Önce ölçüm, sonra müdahale

İki tür veri vardır ve karıştırılmamalıdır:

| | Alan verisi (field) | Laboratuvar verisi (lab) |
|---|---|---|
| Kaynak | Gerçek kullanıcılar (CrUX) | Sentetik test |
| Nerede | Search Console → Core Web Vitals, PageSpeed Insights üst bölüm | Lighthouse, PageSpeed alt bölüm |
| Ne için | **Sıralamayı bu etkiler** | Teşhis ve tekrarlanabilir karşılaştırma |

Google sıralamada **alan verisini** kullanır. Lighthouse'ta 100 alıp alan verisinde kırmızı olmak mümkündür (ve yaygındır).

Bu paketteki denetim aracı **hiçbirini ölçmez**: tarayıcı çalıştırmaz. Ölçtüğü şey, bu metrikleri bozduğu bilinen yapısal nedenlerdir. Raporda bu ayrım korunmalıdır — "LCP 3.2 sn" demek yerine "LCP adayı görsel tembel yükleniyor" denir.

## Eşikler

| Metrik | İyi | Geliştirilmeli | Kötü |
|---|---|---|---|
| LCP — en büyük içeriğin boyanması | ≤ 2,5 sn | ≤ 4,0 sn | > 4,0 sn |
| INP — etkileşimden sonraki boyamaya | ≤ 200 ms | ≤ 500 ms | > 500 ms |
| CLS — kümülatif düzen kayması | ≤ 0,1 | ≤ 0,25 | > 0,25 |
| TTFB — ilk bayt (destekleyici) | ≤ 800 ms | ≤ 1800 ms | > 1800 ms |

Eşik, sayfaların **%75'i** için sağlanmalıdır. Ortalama değil, 75. yüzdelik.

## Temel ilke: darboğaz bant genişliği değil, gecikmedir

Her istek DNS → TCP → TLS → HTTP adımlarından geçer ve her adım bir gidiş-dönüş ekler. New York-Londra arası bir paket, bant genişliğinden bağımsız olarak ~28 ms sürer. Beş kat hızlı hat kazancı azalır; beş kat az gidiş-dönüş her şeyi değiştirir.

Pratik sonuç: **istek sayısını ve gidiş-dönüşü azaltmak**, dosyaları küçültmekten daha etkilidir.

## LCP

LCP öğesi genelde ilk ekrandaki büyük görsel veya başlık bloğudur.

- LCP görseline **asla `loading="lazy"` koymayın.** Doğrudan geciktirir.
- `fetchpriority="high"` verin veya `<link rel="preload">` ile erken çekin.
- Modern biçim kullanın (WebP/AVIF): aynı kalitede tipik olarak %25-50 daha az bayt.
- TTFB'yi düşürün — LCP hiçbir zaman TTFB'den küçük olamaz.
- Render engelleyen CSS/JS'i azaltın: tarayıcı tüm stil dosyaları inene kadar tek piksel boyamaz.

```html
<link rel="preload" as="image" href="/hero.avif" fetchpriority="high">
<img src="/hero.avif" width="1600" height="900" fetchpriority="high" alt="…">
```

## INP

INP, ana iş parçacığının ne kadar meşgul olduğunu ölçer.

- Uzun görevleri bölün; `scheduler.yield()` veya `setTimeout` ile ana iş parçacığına nefes aldırın.
- Kritik olmayan JavaScript'i erteleyin veya kaldırın.
- Üçüncü taraf betikleri sayın: her yeni kaynak DNS + TLS el sıkışması ve ana iş parçacığında iş demektir.
- Büyük DOM (>1500 öğe) her stil ve düzen hesabını pahalılaştırır.

## CLS

- **Her görsele `width` ve `height` yazın** (veya CSS `aspect-ratio`). Tarayıcı yeri önceden ayıramazsa içerik aşağı kayar.
- Reklam, gömülü içerik ve dinamik bloklar için yer ayırın.
- Yazı tipi geçişinde `font-display: swap` + benzer ölçülü yedek yazı tipi.
- İçeriği mevcut içeriğin **üstüne** enjekte etmeyin (çerez bandı, duyuru çubuğu).

## Ağ katmanı

| Konu | Yapılacak |
|---|---|
| Sıkıştırma | Brotli (tercihen) veya gzip. Metin içerikte %70-80 kazanç. |
| HTTP sürümü | HTTP/2 en az; HTTP/3 varsa aktif. HTTP/2'de alan bölme (domain sharding) **zararlıdır** — çoklamayı bozar. |
| Önbellek | İçerik özetli statik varlıklar: `Cache-Control: max-age=31536000, immutable`. HTML: `no-cache` + `ETag`. |
| `stale-while-revalidate` | Önbellekteki içeriği hemen ver, arkada tazele. |
| Bağlantı ısıtma | Kritik üçüncü taraf kaynaklar için `<link rel="preconnect">`. |
| İlk yanıt | Kritik HTML'i 14 KB altında tutmak TCP yavaş başlangıcından kaçınır. |

## Yazı tipleri

```css
@font-face {
  font-family: 'Marka';
  src: url('/fonts/marka.woff2') format('woff2');
  font-display: swap;   /* olmadan metin 3 sn'ye kadar görünmez kalır */
}
```

Yazı tipi dosyalarını kendi alan adınızdan sunun (üçüncü taraf bir el sıkışması daha) ve `<link rel="preload" as="font" crossorigin>` ile erken çekin.

## Araçla ölçüm

İlgili kural kimlikleri: `render-blocking-css`, `render-blocking-js`, `lcp-candidate-lazy`, `no-compression`, `ttfb-slow`, `html-size-excessive`, `dom-node-count`, `inline-style-bloat`, `third-party-script-count`, `font-display-missing`, `preconnect-missing`, `img-missing-dimensions`, `img-legacy-format`, `img-lazy-missing`.

Gerçek metrikler için Search Console Core Web Vitals raporunu ve PageSpeed Insights'ı kullanın; araç çıktısı bunların yerine geçmez.
