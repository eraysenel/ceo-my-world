---
name: local-seo
description: Yerel SEO — Google Business Profile (Google İşletme Profili), NAP tutarlılığı, harita sonuçlarında görünürlük, yerel dizinler, hizmet bölgesi hedefleme, Türkiye'ye özgü yerel sinyaller. "haritada çıkmıyoruz", "Google İşletme Profili", "yerel SEO", "şehir bazlı sıralama", "yorum yönetimi", "NAP" konularında kullanın.
---

# Yerel SEO

Yerel arama sonuçları (harita paketi) klasik organik sonuçlardan **ayrı bir sistemle** sıralanır. Sitenizin organik sıralaması iyi olabilir ve haritada hiç görünmeyebilirsiniz; ikisi farklı işlerdir.

## Üç temel sinyal

| Sinyal | Ne demek | En etkili müdahale |
|---|---|---|
| **İlgi** | İşletme aramaya uygun mu? | Kategori seçimi, hizmet listesi, profil açıklaması |
| **Mesafe** | Arayana yakınlık | Doğrulanmış adres; hizmet bölgesi tanımı |
| **Öne çıkma** | İşletme ne kadar bilinir? | Yorum sayısı/kalitesi, web'de tutarlı bahsedilme, organik otorite |

Mesafe üzerinde kontrolünüz sınırlıdır. Yatırım ilgi ve öne çıkma tarafına yapılır.

## Google İşletme Profili

Yerel görünürlüğün merkezi web siteniz değil, işletme profilinizdir.

Kontrol listesi:

- [ ] Profil **doğrulanmış** (doğrulanmamış profil harita paketinde ciddi dezavantajlıdır)
- [ ] **Birincil kategori** doğru ve dar — genel kategori yerine en spesifik olanı
- [ ] İkincil kategoriler eklenmiş ama şişirilmemiş
- [ ] İşletme adı **gerçek ad** — "Örnek Dublaj | İstanbul Seslendirme Ajansı" gibi anahtar kelime doldurma politika ihlalidir ve profil askıya alınabilir
- [ ] Adres ve harita iğnesi doğru
- [ ] Çalışma saatleri güncel, tatil günleri tanımlı
- [ ] Hizmetler ve ürünler listelenmiş
- [ ] En az 10 gerçek fotoğraf (dış cephe, iç mekân, ekip, iş örnekleri)
- [ ] Web sitesi bağlantısı ilgili sayfaya (ana sayfa değil, hizmet sayfası olabilir)
- [ ] Soru-cevap bölümü boş bırakılmamış

**Hizmet bölgesi işletmesiyseniz** (müşteriye gidiyorsanız, adrese müşteri gelmiyorsa) adresi gizleyip hizmet bölgelerini tanımlayın. Yanlış yapılandırma en yaygın yerel SEO hatasıdır.

## NAP tutarlılığı

NAP = Name, Address, Phone (Ad, Adres, Telefon). Bu üçlü, web'in her yerinde **birebir aynı** yazılmalıdır.

```
Tutarlı:
  Örnek Dublaj Prodüksiyon A.Ş.
  Bağdat Cad. No:100 Kat:3, 34710 Kadıköy/İstanbul
  +90 216 000 00 00

Tutarsız (aynı işletme, farklı yazım — sinyali böler):
  Örnek Dublaj A.Ş. / Ornek Dublaj / Örnek Dublaj Prodüksiyon
  Bağdat Caddesi 100 / Bagdat Cd. No 100 / Bağdat Cad. 100/3
  0216 000 0000 / +902160000000 / 216 000 00 00
```

Tutarlılık kontrol edilecek yerler: Google İşletme Profili, web sitesi altbilgisi ve iletişim sayfası, `LocalBusiness` şeması, sosyal medya profilleri, sektör dizinleri, harita servisleri (Yandex Haritalar, Apple Maps).

Telefon numarasını yazıyla değil, tıklanabilir yazın: `<a href="tel:+902160000000">`.

## LocalBusiness şeması

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": "https://ornek.com/#isletme",
  "name": "Örnek Dublaj Prodüksiyon A.Ş.",
  "url": "https://ornek.com/",
  "telephone": "+90-216-000-0000",
  "email": "bilgi@ornek.com",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Bağdat Cad. No:100 Kat:3",
    "addressLocality": "Kadıköy",
    "addressRegion": "İstanbul",
    "postalCode": "34710",
    "addressCountry": "TR"
  },
  "geo": { "@type": "GeoCoordinates", "latitude": 40.9812, "longitude": 29.0574 },
  "openingHoursSpecification": [{
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
    "opens": "09:00", "closes": "18:00"
  }],
  "areaServed": [{ "@type": "City", "name": "İstanbul" }],
  "sameAs": ["https://www.linkedin.com/company/ornek"]
}
```

Şemadaki NAP, profildeki ve sitedeki NAP ile **birebir** aynı olmalı.

## Yorumlar

- Yorum sayısı ve güncelliği öne çıkma sinyalinin en somut bileşenidir.
- **Yorum istemek meşrudur; yorum satın almak değildir.** Sahte yorum tespit edildiğinde profil askıya alınır.
- Olumsuz yorumlara da yanıt verin: yanıt, yorumu okuyan sonraki müşteri içindir.
- Yanıtlarda anahtar kelime doldurmayın; doğal yazın.

## Şehir bazlı sayfalar

"İstanbul seslendirme", "Ankara dublaj" gibi aramalar için ayrı sayfa açmak yaygın bir yaklaşımdır ve **çoğu zaman yanlış uygulanır**: şehir adı değiştirilmiş kopya sayfalar üretmek, yinelenen içerik olarak değerlendirilir ve hiçbiri sıralanmaz.

Şehir sayfası ancak o şehre özgü **gerçek içerik** varsa açılmalıdır: o şehirdeki ofis/stüdyo, o şehirde yapılmış işler, yerel referanslar, o bölgeye özel teslim koşulları. Yoksa tek bir güçlü hizmet sayfası daha iyidir.

## Türkiye'ye özgü notlar

- **Yandex Haritalar** ve **Yandex İşletmem** kaydı düşük maliyetli ek görünürlük sağlar.
- Sektör dizinleri ve ticaret odası kayıtları hem NAP tutarlılığı hem güven sinyali üretir.
- Web sitesinde vergi/ticaret sicil bilgisi, açık adres ve KVKK metni bulunması güven açısından anlamlıdır.

## Ölçüm

- Google İşletme Profili → Performans: arama sayısı, yol tarifi istekleri, telefon aramaları
- Search Console → marka + şehir sorgularının gösterim/tıklama değişimi
- Harita paketinde konum: farklı fiziksel konumlardan farklı sonuç gelir; tek noktadan bakıp genelleme yapmayın
