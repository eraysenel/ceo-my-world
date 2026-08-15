---
name: content-strategy
description: İçerik stratejisi ve anahtar kelime çalışması — arama niyeti, konu otoritesi (topical authority), içerik brief'i, iç bağlantı mimarisi, Türkçe anahtar kelime nüansları, rakip içerik analizi. "anahtar kelime", "hangi içeriği yazmalıyım", "içerik planı", "arama niyeti", "blog stratejisi", "rakip analizi", "içerik takvimi" konularında kullanın.
---

# İçerik Stratejisi

## Anahtar kelime değil, arama niyeti

Bir aramayı "aylık 2.400 hacim" diye değil, **arkasındaki niyetle** ele alın. Aynı konu etrafındaki dört farklı niyet dört farklı sayfa gerektirir:

| Niyet | Örnek arama | Gereken sayfa |
|---|---|---|
| Bilgi | "seslendirme nasıl yapılır" | Rehber içerik |
| Karşılaştırma | "yapay zeka dublaj mı stüdyo dublajı mı" | Karşılaştırma yazısı |
| Ticari | "reklam seslendirme fiyatları" | Fiyat/hizmet sayfası |
| İşlem | "seslendirme ajansı istanbul" | Hizmet + iletişim sayfası |

**Niyet tespitinin en güvenilir yolu SERP'e bakmaktır.** İlk 10 sonuç blog yazısıysa, oraya hizmet sayfasıyla girmeye çalışmak boşa emektir. Google o sorgu için ne tür içeriğin doğru olduğuna zaten karar vermiştir.

## Türkçe anahtar kelime nüansları

Türkçe sondan eklemeli bir dildir; bu, anahtar kelime çalışmasını İngilizceden farklı kılar.

- **Ekli biçimler farklı sorgulardır:** "seslendirme", "seslendirmeyi", "seslendirme fiyatı", "seslendirme fiyatları". Doğal yazılmış metin bunları zaten kapsar; zorlama gerekmez ve zararlıdır.
- **Türkçe/İngilizce ikilikleri:** kullanıcılar hem "dublaj" hem "dubbing", hem "seslendirme" hem "voice over" arar. İkisini de doğal biçimde metne yedirin.
- **Yerel/argo karşılıklar:** "ses kaydı", "anons", "cast", "mikrofon kaydı" gibi sektör içi terimler gerçek aramalardır.
- **Karakter varyasyonları:** kullanıcılar "fiyatlari" (Türkçe karaktersiz) da yazar. İçeriğe zorla eklemeyin — Google bunları eşleştirir — ama URL slug'ınızın ASCII olması bu yüzden de doğrudur.

## Konu otoritesi

Tek bir "her şeyi anlatan" sayfa yerine, bir konuyu **kümesiyle** kapsayın:

```
Ana sayfa: Dublaj ve Seslendirme Hizmetleri
├── Reklam seslendirme          → fiyat, süreç, örnekler
├── Dizi/film dublajı           → dudak senkronu, kadro, teslim
├── Kurumsal tanıtım            → ses tonu, dil seçenekleri
├── E-öğrenme seslendirme       → uzun metin, tekrar/revizyon
└── Rehber içerikler
    ├── Seslendirme fiyatlarını ne belirler?
    ├── Stüdyo dublajı ile yapay zeka dublajı farkı
    └── Seslendirme için metin nasıl hazırlanır?
```

Kümenin işe yaraması **iç bağlantıya** bağlıdır: her rehber ilgili hizmet sayfasına, her hizmet sayfası ilgili rehberlere bağlanır. Bağlantısız küme, küme değil, sayfa yığınıdır.

## İçerik brief'i

Yazmadan önce şu altı soru cevaplanmalı. Cevaplanamıyorsa içerik henüz yazılmamalıdır:

1. **Hangi arama?** Birincil sorgu ve yakın varyantları.
2. **Hangi niyet?** SERP'te şu an ne tür içerik var?
3. **Kim okuyacak?** Karar verici mi, uygulayıcı mı, meraklı mı?
4. **Hangi soruların cevabı?** En az 5 alt soru — bunlar H2'leriniz olur.
5. **Neyi farklı söylüyoruz?** Rakiplerde olmayan veri, deneyim, örnek veya fiyat şeffaflığı. Bu yoksa içerik yayınlansa da sıralanmaz.
6. **Hangi eylem?** Sayfanın sonunda okuyucudan ne isteniyor?

## Rakip analizi

Doğrulanabilir olan şeyi ölçün, gerisini tahmin diye yazmayın:

- İlk 10 sonuçta kimler var, hangi **içerik türü** (rehber / hizmet / liste / video)?
- Ortalama içerik derinliği ve kapsanan alt sorular
- Yapısal veri kullanıyorlar mı, hangi türler?
- Hangi sorulara cevap veriyorlar, hangilerine vermiyorlar → **boşluk sizin fırsatınız**

Erişilebilir araç yoksa: "rakip X'in domain otoritesi 45" gibi ölçülmemiş sayılar yazmayın. "Ölçülemedi, şu araçla ölçülebilir" yazmak daha değerlidir.

## Mevcut içeriği iyileştirmek yeni yazmaktan ucuzdur

Bir sitede en yüksek getirili iş genelde yeni içerik değil, mevcut içeriğin onarılmasıdır:

1. Search Console'da **11-20. sırada** olan sorguları bulun — küçük iyileştirme ilk sayfaya taşıyabilir.
2. Gösterimi yüksek, tıklanması düşük sayfalar: başlık ve açıklama sorunu.
3. Yinelenen/rekabet eden sayfalar: birleştirin, birini 301 ile diğerine yönlendirin.
4. Eskimiş içerik: güncelleyin ve `dateModified` yazın.

## Yayın sonrası

- İlk ölçüm için 4-8 hafta bekleyin; günlük sıralama takibi gürültüdür.
- Ölçüt: gösterim, tıklama, ortalama sıra ve **dönüşüm** — yalnızca sıralama değil.
- Sıralama düştüyse önce teknik bir değişiklik olup olmadığına bakın (bkz. `technical-seo`); içerik suçlanmadan önce indexlenebilirlik doğrulanmalı.
