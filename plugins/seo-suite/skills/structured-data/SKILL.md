---
name: structured-data
description: schema.org yapısal verisi (JSON-LD) üretir, doğrular ve zengin sonuç uygunluğunu değerlendirir. "schema", "structured data", "JSON-LD", "rich snippet", "zengin sonuç", "yıldız puanı çıkmıyor", "SSS işaretlemesi", "breadcrumb", "Organization şeması", "ürün şeması" konularında kullanın.
---

# Yapısal Veri (schema.org)

Yapısal veri **sıralamayı doğrudan yükseltmez**. Yaptığı şey, içeriğin ne olduğunu makineye açıkça söylemektir. Bunun iki somut karşılığı vardır: arama sonucunda zengin gösterim (tıklanma oranı) ve AI özetlerinde doğru alıntılanma.

Bu ayrımı raporlarda koruyun. "Schema ekleyin, sıralamanız yükselir" yanlış bir vaattir.

## Biçim: JSON-LD

Microdata ve RDFa da geçerlidir ama JSON-LD tercih edilir: işaretleme ile içerik ayrışır, bakım kolaylaşır, şablon motorlarıyla üretimi basittir.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Örnek Dublaj",
  "url": "https://ornek.com/",
  "logo": "https://ornek.com/logo.png",
  "sameAs": [
    "https://www.linkedin.com/company/ornek",
    "https://www.youtube.com/@ornek"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+90-212-000-0000",
    "contactType": "customer service",
    "areaServed": "TR",
    "availableLanguage": ["Turkish", "English"]
  }
}
</script>
```

## Altın kural

> Yalnızca sayfada **görünen** içeriği işaretleyin.

Sayfada olmayan bir SSS'yi `FAQPage` olarak işaretlemek, olmayan bir yorumu `AggregateRating` yapmak Google'ın yapısal veri politikasına aykırıdır ve manuel işlem (ceza) sebebidir. Araç bunu `jsonld-faq-mismatch` ile kontrol eder.

## Hangi sayfada hangi tür

| Sayfa | Tür | Kritik alanlar |
|---|---|---|
| Ana sayfa | `Organization` veya `LocalBusiness` | `name`, `url`, `logo`, `sameAs`, `contactPoint` |
| Hizmet sayfası | `Service` | `name`, `provider`, `serviceType`, `areaServed`, `offers` |
| Ürün | `Product` | `name`, `offers` (fiyat, para birimi, stok) |
| Blog yazısı | `Article` / `BlogPosting` | `headline`, `datePublished`, `dateModified`, `author` |
| SSS bölümü | `FAQPage` | `mainEntity[].name`, `acceptedAnswer.text` |
| Her alt sayfa | `BreadcrumbList` | `itemListElement` (position, name, item) |
| Video içeren sayfa | `VideoObject` | `name`, `description`, `thumbnailUrl`, `uploadDate`, `duration` |
| Ses/demo içeren sayfa | `AudioObject` | `name`, `contentUrl`, `duration`, `transcript` |
| Yerel işletme | `LocalBusiness` | `address`, `telephone`, `openingHoursSpecification`, `geo` |

## Varlık (entity) kurmak

Markanızın bir "şey" olarak tanınması, tek tek sayfaların işaretlenmesinden daha değerlidir. Bunun yolu:

1. Ana sayfada `Organization` — tek ve tutarlı
2. `sameAs` ile doğrulanabilir profiller: LinkedIn, YouTube, varsa Vikipedi/Wikidata
3. `@id` ile sabit bir kimlik verip diğer şemalardan ona referans:

```json
{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Reklam Seslendirme",
  "serviceType": "Seslendirme",
  "areaServed": { "@type": "Country", "name": "Türkiye" },
  "provider": { "@id": "https://ornek.com/#kurulus" },
  "offers": {
    "@type": "Offer",
    "priceCurrency": "TRY",
    "priceSpecification": {
      "@type": "PriceSpecification",
      "minPrice": 2500,
      "priceCurrency": "TRY"
    }
  }
}
```

Ana sayfadaki `Organization` bloğuna `"@id": "https://ornek.com/#kurulus"` verildiğinde tüm sayfalar aynı varlığa bağlanır.

## Sık yapılan hatalar

| Hata | Sonuç |
|---|---|
| Sondaki fazladan virgül | Blok tamamen yok sayılır — hiçbir şema okunmaz |
| `@context` eksik veya yanlış | Tipler tanınmaz |
| Zorunlu alan eksik | "Geçersiz öğe" hatası; zengin sonuç uygunluğu yok |
| Görünmeyen içeriği işaretlemek | Politika ihlali, manuel işlem riski |
| Her sayfada farklı `Organization` tanımı | Varlık birliği bozulur |
| Göreli görsel URL'si | Şemada mutlak URL zorunlu |
| Fiyatı işaretleyip sayfada göstermemek | Politika ihlali |

## Doğrulama

1. **Araç:** `node ${CLAUDE_PLUGIN_ROOT}/tools/seo-audit.mjs ...` → `jsonld-parse-error`, `jsonld-required-props`, `jsonld-context-invalid`, `jsonld-faq-mismatch`
2. **Google Rich Results Test** — zengin sonuç uygunluğu
3. **Schema.org Validator** — sözdizimi ve tip doğruluğu
4. **Search Console → Geliştirmeler** — gerçek durumda ne görüldüğü

Sıra önemlidir: araç sözdizimi ve eksik alanları toplu yakalar; Google araçları tek tek sayfa doğrular; Search Console gerçekte ne olduğunu söyler.

## Araçla ölçüm

İlgili kural kimlikleri: `jsonld-parse-error`, `jsonld-missing`, `jsonld-context-invalid`, `jsonld-required-props`, `jsonld-faq-mismatch`, `jsonld-service-missing`, `jsonld-breadcrumb-missing`, `jsonld-organization-missing`, `jsonld-sameas-missing`, `og-missing`, `twitter-card-missing`, `video-missing-schema`, `audio-missing-transcript`.
