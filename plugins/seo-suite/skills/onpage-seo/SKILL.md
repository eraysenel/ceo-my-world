---
name: onpage-seo
description: Sayfa içi SEO — başlık etiketi, meta description, H1-H6 hiyerarşisi, iç linkleme, bağlantı metni, içerik derinliği ve E-E-A-T sinyalleri. "title etiketi", "meta description", "H1", "başlık optimizasyonu", "iç linkleme", "anchor text", "içerik yetersiz", "sayfa optimizasyonu", "tıklanma oranı düşük" konularında kullanın.
---

# Sayfa İçi SEO

## Başlık etiketi

Başlık, arama sonucunda tıklanan bağlantının kendisidir. Tek bir alanda üç iş birden yapar: konuyu beyan eder, aramayla eşleşir, tıklanmayı sağlar.

**Uzunluk piksel ile ölçülür, karakterle değil.** Google masaüstünde ~580px'de keser. Türkçede bu ayrım kritiktir: `ı`, `i`, `l` dar; `m`, `ğ`, `ş` geniştir. 55 karakterlik bir başlık sığabilirken 50 karakterlik başka bir başlık kesilebilir.

```bash
# Araç bunu ölçer:
node ${CLAUDE_PLUGIN_ROOT}/tools/seo-audit.mjs --input-file sayfa.html --page-url https://... 
# kural: title-pixel-width
```

Kalıp:

```
<Ana konu> <ayırt edici nitelik> | <Marka>

Reklam Seslendirme Fiyatları ve Süreç | Örnek Dublaj
Dizi Dublajı: 40+ Sanatçı, 5 Günde Teslim | Örnek Dublaj
```

Yanlışlar:

| Yanlış | Neden |
|---|---|
| `Ana Sayfa` | Hiçbir arama ile eşleşmez |
| `Örnek Dublaj \| Örnek Dublaj \| Seslendirme` | Marka tekrarı alanı yer, değer katmaz |
| `SESLENDİRME DUBLAJ SES KAYIT STÜDYO AJANS` | Kelime yığını; Google başlığı yeniden yazar |
| Tüm sayfalarda aynı başlık | Google "bu sayfalar aynı" der, birini seçer |

**Google başlığınızı yeniden yazabilir.** Bu genelde başlık sayfayla uyumsuz, çok uzun veya kelime yığını olduğunda olur. Sık yeniden yazılıyorsa bu bir bulgudur.

## Meta description

Sıralamayı doğrudan etkilemez. Tıklanma oranını belirgin şekilde etkiler; tıklanma oranı da uzun vadede etkiler.

- 120-155 karakter civarı (yine piksel sınırı var, ~990px)
- En önemli bilgi başta — sonu kesilebilir
- Sayfada gerçekten olan bir vaat: "24 saatte teslim" yazıp sayfada bundan bahsetmemek tıklanan kullanıcıyı geri döndürür
- Her sayfaya özgü; şablon açıklama boşa gider

## Başlık hiyerarşisi

```
H1  Sayfanın konusu (tek tane)
├── H2  Ana bölüm
│   └── H3  Alt bölüm
└── H2  Ana bölüm
```

- **Tek H1.** Birden fazla H1 sayfanın ana konusunu belirsizleştirir.
- **Seviye atlanmaz.** H2'den sonra H4 gelmez. Görsel boyut için CSS kullanın; başlık etiketi anlam taşır, stil değil.
- **Başlıklar okunabilir olmalı.** İkon-only veya boş başlık etiketi ekran okuyucuda gürültü üretir.
- Alt başlıkları kullanıcıların yazdığı soru biçimine çevirmek, hem öne çıkan snippet hem de AI özetlerinde alıntılanma şansını artırır.

## İçerik derinliği

**Kelime sayısı bir hedef değildir, sonuçtur.** "300 kelimenin altı ince içerik" kuralı bir kısayoldur; asıl soru şudur:

> Bu sayfa hangi aramaya hizmet ediyor ve o aramayı yapan kişinin hangi sorusu cevapsız kalıyor?

Bir hizmet sayfasında tipik olarak cevapsız kalanlar: fiyat aralığı, teslim süresi, süreç adımları, hangi durumlarda uygun olmadığı, referanslar, sık sorulanlar.

E-E-A-T sinyalleri (Deneyim, Uzmanlık, Otorite, Güven) somut şeylerdir:

- Yazar adı ve gerçek bir künye sayfası
- İletişim bilgisi, fiziksel adres, vergi/ticaret sicil bilgisi
- Gerçek referans ve vaka çalışmaları
- Güncellenme tarihi
- Kaynak gösterimi

## İç linkleme

İç bağlantılar iki iş yapar: kullanıcıyı yönlendirir ve sayfalar arası önem/konu ilişkisi kurar.

- **İçerik içinden bağlantı verin.** Menü bağlantıları her sayfada aynıdır; ayırt edici sinyal metnin içinden gelir.
- **Bağlantı metni hedefi anlatsın.** "Devamı" değil, "reklam seslendirme fiyatları".
- **Yetim sayfa bırakmayın.** Hiç iç bağlantı almayan sayfa hem kullanıcı için görünmezdir hem de önemsiz sayılır.
- **İç bağlantıda `nofollow` kullanmayın.** Tarama bütçesi yönetimi için tasarlanmamıştır; yalnızca değeri yok eder.
- Önemli sayfalar ana sayfadan 3 tıklama içinde erişilebilir olsun.

## Türkçe içerikte dikkat

- **Kodlama.** `Ã¼`, `ÅŸ`, `Ä±` dizileri sayfada görünüyorsa kodlama bozuktur; bu, anahtar kelimelerin tanınmaz hâle gelmesi demektir. Kritik bulgudur.
- **`<meta charset="utf-8">` ilk 1024 baytta olmalı.** Geç gelirse tarayıcı tahmin yürütür.
- **Büyük harf dönüşümü.** `İ` ve `ı` yanlış işlenirse arama ve karşılaştırma bozulur.
- **Ek çekimleri.** Türkçe sondan eklemeli: "seslendirme", "seslendirmeyi", "seslendirmenin" farklı sorgulardır. Doğal metin bunları zaten kapsar; zorlama gerekmez.

## Araçla ölçüm

İlgili kural kimlikleri: `title-missing`, `title-pixel-width`, `title-too-short`, `title-duplicate`, `meta-description-missing`, `meta-description-length`, `meta-description-duplicate`, `h1-missing`, `h1-count`, `heading-hierarchy-skip`, `heading-empty`, `thin-content`, `turkish-mojibake`, `charset-declaration-late`, `viewport-meta-missing`, `lang-attribute-missing`, `anchor-text-generic`, `anchor-text-empty`, `orphan-page`, `internal-links-few`.
