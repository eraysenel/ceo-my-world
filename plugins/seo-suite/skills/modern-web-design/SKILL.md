---
name: modern-web-design
description: Performans öncelikli modern web arayüzü — semantik HTML, erişilebilirlik, tipografi, düzen kaymasını önleyen bileşen tasarımı, mikro etkileşimler, karanlık mod. "arayüz tasarımı", "sayfa tasarımı", "semantik HTML", "erişilebilirlik", "responsive", "hero bölümü", "tasarım sistemi", "animasyon" konularında kullanın.
---

# Modern Web Tasarımı

Bu skill, tasarımı SEO ve performans kısıtlarıyla birlikte ele alır. Bir arayüz kararı aynı anda üç şeyi etkiler: kullanıcının anlaması, tarayıcının ayrıştırması, tarayıcının boyaması.

## Semantik HTML

Etiket seçimi bir stil kararı değil, bir **anlam** kararıdır.

```html
<!-- Anlamsız: ekran okuyucu ve içerik çıkaran sistemler için düz kutu yığını -->
<div class="header">
  <div class="title">Reklam Seslendirme</div>
  <div class="nav"><div class="link">Hizmetler</div></div>
</div>

<!-- Anlamlı -->
<header>
  <nav aria-label="Ana menü"><a href="/hizmetler">Hizmetler</a></nav>
</header>
<main>
  <h1>Reklam Seslendirme</h1>
  <article>…</article>
</main>
<footer>…</footer>
```

Kurallar:

- Sayfada **tek `<main>`**, tek `<h1>`.
- Başlık seviyeleri atlanmaz; görsel boyut CSS ile ayarlanır.
- Tıklanabilir şey `<button>` veya `<a>` olmalı — `onclick` taşıyan `<div>` klavyeyle erişilemez.
- Liste liste, tablo tablodur. Tabloyu `<div>` ızgarasıyla kurmak veriyi makineye görünmez yapar.
- `<figure>` + `<figcaption>` görsel ile açıklamasını birbirine bağlar.

## Düzen kaymasını önleyen tasarım

CLS bir ölçüm sonucu değil, bir tasarım kararıdır. Kayma, alan önceden ayrılmadığında olur.

```css
/* Görsel yer tutucusu */
img, video { max-width: 100%; height: auto; }
.hero-img { aspect-ratio: 16 / 9; }   /* boyut bilinmese de yer ayrılır */

/* Yazı tipi geçişinde kayma olmaması için benzer ölçülü yedek */
:root { font-family: 'Marka', system-ui, -apple-system, 'Segoe UI', sans-serif; }
```

```html
<img src="/hero.avif" width="1600" height="900" alt="Ses kayıt stüdyosu">
```

Kayma üreten yaygın kalıplar: sonradan yüklenen çerez bandı, üstten inen duyuru çubuğu, boyutu belirsiz gömülü içerik, yüklendikçe yükselen reklam alanı. Hepsinin çözümü aynı: **yeri baştan ayır.**

## Tipografi

- Gövde metni 16px'in altına inmesin; satır yüksekliği 1.5-1.7.
- Satır uzunluğu 60-80 karakter (`max-width: 65ch`).
- Türkçe metinde `ı`, `İ`, `ğ`, `ş` karakterlerinin seçilen yazı tipinde düzgün göründüğünü kontrol edin — bazı web fontları Türkçe genişletilmiş Latin setini eksik taşır ve harfler yedek yazı tipinden düşer.
- `font-display: swap` olmadan metin 3 saniyeye kadar görünmez kalabilir.

## Erişilebilirlik

Erişilebilirlik bir ek özellik değil, doğru kurulmuş HTML'in yan ürünüdür. Minimum:

- **Renk kontrastı** 4.5:1 (normal metin), 3:1 (büyük metin ve arayüz öğeleri).
- **Klavye erişimi:** her etkileşimli öğeye Tab ile ulaşılabilmeli, odak görünür olmalı. `outline: none` yazıp yerine bir şey koymamak erişilebilirliği kırar.
- **Görsellerde alt metni:** içerik taşıyorsa açıklayıcı, dekoratifse `alt=""`.
- **Form etiketleri:** her girdinin `<label>`'ı olmalı; placeholder etiket yerine geçmez.
- **Hareket tercihi:**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- **Dil beyanı:** `<html lang="tr">`.

## Karanlık mod

```css
:root {
  color-scheme: light dark;
  --bg: #ffffff; --fg: #111111; --muted: #666666;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #14161a; --fg: #e8e8e8; --muted: #9aa0a6; }
}
body { background: var(--bg); color: var(--fg); }
```

Karanlık modda saf siyah (#000) yerine hafif kırık siyah kullanın; saf beyaz metin yerine biraz kısılmış beyaz. Kontrast kuralları karanlık modda da geçerlidir ve genelde ayrıca kontrol edilmesi gerekir.

## Mikro etkileşimler

Amaç süsleme değil, geri bildirimdir: kullanıcı bir eylemin gerçekleştiğini anlamalı.

- Geçişler 150-300 ms; daha uzunu yavaş hissettirir.
- Yalnızca `transform` ve `opacity` animasyonlayın — `width`, `top`, `margin` her karede düzen hesabı tetikler.
- Yükleme durumlarında iskelet (skeleton) kullanın; ama iskeletin boyutu gelecek içerikle aynı olsun, yoksa CLS üretirsiniz.

## Tasarım kararlarının SEO karşılığı

| Tasarım kararı | SEO/performans etkisi |
|---|---|
| Tam ekran hero videosu | LCP ve veri kullanımı; mobilde ağır |
| Sonsuz kaydırma | Sayfalama olmadan içerik taranamaz — `<a href>` ile de erişilebilir tutun |
| Metnin görsel içine gömülmesi | Metin indexlenmez; gerçek metin kullanın |
| İçeriğin sekmeler/akordeonlar arkasında olması | İndexlenir ama görünürlük sinyali zayıflar; ana içeriği açık bırakın |
| Yalnızca ikondan oluşan gezinme | Bağlantı metni yok — `aria-label` şart |
| İstemci tarafı render | İçerik HTML kaynağında yoksa AI tarayıcıları göremez (bkz. `ai-search`) |

## İlgili skill'ler

Performans ayrıntısı için `core-web-vitals`, sayfa yapısı ve başlık hiyerarşisi için `onpage-seo`.
