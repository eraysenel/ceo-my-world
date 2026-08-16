---
name: intl-seo
description: Çok dilli ve çok bölgeli SEO — hreflang kurulumu ve hataları, tr-TR hedefleme, alt alan adı vs alt dizin kararı, ccTLD seçimi, Türkçe karakter ve slug tuzakları, Yandex/Bing. "hreflang", "çok dilli site", "İngilizce versiyon", "alt alan adı mı klasör mü", "subdomain", "ülke hedefleme", "yurt dışı SEO" konularında kullanın.
---

# Uluslararası SEO

## Yapı kararı: alt alan adı mı, alt dizin mi?

Bu karar sonradan değiştirilmesi en pahalı kararlardan biridir.

| Yapı | Örnek | Ne zaman |
|---|---|---|
| Alt dizin | `ornek.com/en/` | **Varsayılan tercih.** Alan adının biriktirdiği otoriteyi paylaşır, tek altyapı, tek Search Console mülkü |
| Alt alan adı | `en.ornek.com` | Ayrı altyapı/ekip zorunluysa, ya da içerik gerçekten ayrı bir ürünse |
| ccTLD | `ornek.de` | Güçlü yerel varlık, ayrı tüzel kişilik, bütçe varsa |

Google alt alan adlarını ayrı siteler gibi değerlendirebilir. Pratik sonuç: `dublaj.ornek.com` kurmak, `ornek.com/dublaj` kurmaya göre otorite açısından sıfırdan başlamak demektir.

**Zaten alt alan adı varsa** yapılacaklar (taşımak her zaman doğru cevap değildir):

1. İki site arasında **karşılıklı, içerik içinden** bağlantı kurun — menü bağlantısı yeterli sinyal değildir.
2. Her ikisini Search Console'a ayrı mülk olarak ekleyin, bir de alan adı mülkü açın.
3. `Organization` şemasını tek `@id` ile paylaşın; iki site aynı varlığa bağlansın.
4. İçerik çakışmasını önleyin: aynı hizmeti iki alan adında anlatmak birbirinizle rekabet ettirir.
5. Taşıma düşünülüyorsa: kalıcı 301 eşleme tablosu + Search Console adres değişikliği bildirimi + en az 6 ay izleme.

## hreflang

hreflang bir **sıralama faktörü değildir**; doğru dil sürümünün doğru kullanıcıya gösterilmesini sağlar ve dil sürümlerinin birbirinin kopyası sayılmasını önler.

### Kurallar

1. **Karşılıklılık zorunlu.** A, B'yi gösteriyorsa B de A'yı göstermeli. Tek yönlü etiket **tamamen yok sayılır**.
2. **Kendine referans zorunlu.** Her sayfa kendi hreflang girdisini de listelemeli.
3. **Mutlak URL.** Göreli adres kabul edilmez.
4. **Canonical ile çelişmemeli.** Kümedeki her sayfanın canonical'ı kendisini göstermeli.
5. **Hedefler 200 dönmeli.** 404 veya yönlendirilen hedef kümeyi geçersiz kılar.
6. **BCP-47 biçimi.** `tr`, `tr-TR`, `en-US`. `tr_TR` (alt çizgi), `tur`, `TR` geçersizdir.

### Doğru kurulum

```html
<!-- https://ornek.com/hizmetler sayfasında -->
<link rel="alternate" hreflang="tr" href="https://ornek.com/hizmetler">
<link rel="alternate" hreflang="en" href="https://ornek.com/en/services">
<link rel="alternate" hreflang="x-default" href="https://ornek.com/hizmetler">

<!-- https://ornek.com/en/services sayfasında AYNI kümenin tamamı tekrar eder -->
<link rel="alternate" hreflang="tr" href="https://ornek.com/hizmetler">
<link rel="alternate" hreflang="en" href="https://ornek.com/en/services">
<link rel="alternate" hreflang="x-default" href="https://ornek.com/hizmetler">
```

`hreflang` HTTP `Link` başlığıyla veya sitemap içinde de verilebilir; HTML dışı içerikler (PDF) için tek yol başlıktır.

### `tr` mi `tr-TR` mi?

- Yalnızca Türkçe tek sürüm varsa: `tr` yeterli.
- Türkiye ve Almanya'daki Türkçe konuşanlara farklı içerik sunuluyorsa: `tr-TR` ve `tr-DE`.
- Dil kodu zorunlu, ülke kodu isteğe bağlı. Yalnız ülke kodu (`TR`) **geçersizdir**.

## Türkçe karakter ve slug

Türkçe karakterli URL'ler teknik olarak geçerlidir ama üç yerde farklı kodlanabilir: iç bağlantıda ham, canonical'da kodlanmış, sitemap'te başka türlü. Google bunları ayrı URL sayar.

```
ı → i    ş → s    ğ → g    ü → u    ö → o    ç → c
İ → i    Ş → s    Ğ → g    Ü → u    Ö → o    Ç → c
```

```
Kötü:  /hizmetler/seslendirme-fiyatları
İyi:   /hizmetler/seslendirme-fiyatlari
```

`<html lang="tr">` ve `<meta charset="utf-8">` (ilk 1024 baytta) her sayfada bulunmalı.

## Diğer arama motorları

Türkiye'de Google payı çok yüksektir, ancak:

- **Yandex** — Türkçe içerikte kayda değer bir azınlık payına sahip. Yandex Webmaster'a site eklemek ve sitemap göndermek düşük maliyetli, makul getirili bir adımdır.
- **Bing** — Windows ve Copilot üzerinden gelen trafik; Bing Webmaster Tools, Search Console'dan içe aktarma yapabilir.

Bu ikisi için ayrı bir "SEO stratejisi" gerekmez; temel teknik hijyen ikisinde de aynı işi görür.

## Araçla ölçüm

İlgili kural kimlikleri: `lang-attribute-mismatch`, `lang-region-format`, `hreflang-invalid-code`, `hreflang-self-missing`, `hreflang-return-tag`, `hreflang-non-200`, `hreflang-canonical-conflict`, `hreflang-x-default-missing`, `hreflang-missing-multilocale`, `url-turkish-charset`.
