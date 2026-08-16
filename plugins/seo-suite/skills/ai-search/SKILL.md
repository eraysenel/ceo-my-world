---
name: ai-search
description: AI aramada görünürlük — Google AI Overviews'ta alıntılanma, ChatGPT/Claude/Perplexity tarayıcı erişimi, sunucu tarafı render, llms.txt gerçeği, GEO/AEO iddialarının değerlendirilmesi. "AI Overviews", "yapay zeka aramada çıkmak", "GEO", "AEO", "llms.txt", "ChatGPT'de görünmek", "AI SEO" konularında kullanın.
---

# AI Aramada Görünürlük

## Önce durum tespiti

Google, 15 Mayıs 2026'da açık biçimde şunu söyledi: **GEO ve AEO ayrı disiplinler değildir, hâlâ SEO'dur.** llms.txt, içerik parçalama (chunking) ve "AI için yeniden yazma" gibi uygulamaların Google sistemleri için gerekmediğini belirtti; llms.txt taranabilir ama özel işlem görmez.

Bu skill bu duruşu benimser. Piyasada "AI SEO" başlığıyla satılan tekniklerin çoğu ya klasik SEO'nun yeniden adlandırılmış hâlidir ya da ölçülebilir karşılığı olmayan iddialardır. Bir müşteriye "llms.txt ekleyelim, AI'da çıkarız" demek, doğrulanabilir olmayan bir vaattir.

**Gerçekten fark yaratan şeyler ölçülebilir ve zaten SEO'nun parçasıdır.**

## Bir AI sisteminin sizi alıntılayabilmesi için gereken üç koşul

### 1. İçerik HTML kaynağında olmalı

Googlebot JavaScript çalıştırır — ama bunu ikinci bir tarama dalgasında yapar ve gecikir. **AI tarayıcılarının çoğu hiç çalıştırmaz.** Kaynakta olmayan içerik, o sistemler için var değildir.

```bash
# Basit test: içerik kaynakta mı?
curl -sS https://ornek.com/hizmetler | grep -c "aradığınız cümleden bir parça"
```

Sonuç 0 ise içerik istemci tarafında üretiliyordur. Çözüm SSR/SSG'dir; "AI için özel bir şey" değil.

### 2. Tarayıcı erişebilmeli

`robots.txt` içinde bu ajanların durumunu kontrol edin:

```
GPTBot            OpenAI — ChatGPT eğitim/tarama
OAI-SearchBot     OpenAI — ChatGPT arama
ChatGPT-User      OpenAI — kullanıcı isteğiyle sayfa getirme
ClaudeBot         Anthropic
Claude-User       Anthropic — kullanıcı isteğiyle sayfa getirme
PerplexityBot     Perplexity
Google-Extended   Google — Gemini/AI eğitimi (Arama'yı etkilemez)
CCBot             Common Crawl
Applebot-Extended Apple
```

**Bunları engellemek bir hata değildir; bir politika kararıdır.** İçeriğinizin model eğitiminde kullanılmasını istemiyor olabilirsiniz ve bu meşrudur. Ama sonucu da netse: o sistemin yanıtlarında görünmezsiniz. Denetimde bu bir "hata" olarak değil, "bilinçli mi?" sorusu olarak raporlanır.

Not: `Google-Extended` engellemek **Google Arama sıralamasını etkilemez**; yalnızca Gemini tarafını etkiler.

### 3. Cevap doğrudan ve alıntılanabilir olmalı

AI sistemleri bir soruya karşılık gelen net metin bloklarını alıntılar. Pratikte işe yarayan yapı:

```
H1: Reklam Seslendirme Fiyatları
[Doğrudan cevap paragrafı — 2-3 cümle, 80-300 karakter]

H2: Reklam seslendirme ne kadar sürer?
[Kısa net cevap, sonra ayrıntı]

H2: Fiyatı ne belirler?
[Kısa net cevap, sonra ayrıntı]
```

- Başlığın hemen altında özet paragraf: hem öne çıkan snippet hem AI özeti için en çok seçilen blok budur.
- Alt başlıkları kullanıcıların **yazdığı soru biçiminde** kurun.
- Somut ol: "hızlı teslim" değil, "5 iş günü". Sayı, tarih ve koşul içeren cümleler alıntılanmaya daha uygundur.
- Tabloları ve listeleri gerçekten tablo/liste olarak işaretleyin.

## llms.txt hakkında dürüst değerlendirme

`llms.txt`, sitenin içeriğini Markdown olarak özetleyen bir kök dosya önerisidir. Durum:

- **Google özel işlem yapmıyor** (resmî açıklama, Mayıs 2026).
- Bazı AI araçları okuyabilir; ölçülebilir kazanç gösteren bağımsız bir veri yok.
- Maliyeti düşük, zararı yok.

Değerlendirme: **düşük öncelik.** Sunucu tarafı render, düzgün başlık yapısı ve `Organization` şeması yapılmadan llms.txt eklemek, kırık motorlu arabaya spoiler takmaktır. Araç bunu bilinçli olarak `notice` şiddetinde raporlar ve düzeltme metninde önceliği açıkça yazar.

## Ölçüm: AI'da görünüyor muyum?

Bu alanda araç desteği zayıftır ve kesin ölçüm zordur. Yapılabilecekler:

1. **Doğrudan sorgu.** Hizmetinizle ilgili soruları ChatGPT/Perplexity/Google AI Overviews'a sorup kaynak listesinde çıkıp çıkmadığınıza bakın. Küçük örneklem, ama sıfır veri değildir.
2. **Sunucu günlükleri.** `GPTBot`, `ClaudeBot`, `PerplexityBot` user-agent'larının erişim sayısı — sitenizin taranıp taranmadığını kesin gösterir.
3. **Yönlendiren trafik.** Analytics'te `chatgpt.com`, `perplexity.ai` gibi kaynaklardan gelen ziyaretler.

Bunların hiçbiri "AI sıralaması" vermez. Rapora yazarken bu sınırı belirtin.

## Yapılmaması gerekenler

| Uygulama | Neden |
|---|---|
| İçeriği "AI için" yeniden yazmak | Google gerekmediğini söyledi; iki ayrı içerik bakım yükü üretir |
| Yalnızca AI tarayıcılara farklı içerik sunmak | Cloaking; ceza sebebi |
| AI ile üretilmiş içeriği kontrolsüz yayınlamak | Google AI içeriğini yasaklamıyor ama **değersiz** içeriği cezalandırıyor; ayrım kalitede |
| "AI SEO paketi" satın almak | Somut çıktısı SSR + şema + içerik olmayan bir paket, klasik SEO'nun pahalı hâlidir |

## Araçla ölçüm

İlgili kural kimlikleri: `content-server-rendered`, `ai-crawler-blocked`, `answerable-summary-missing`, `faq-block-missing`, `content-freshness-missing`, `llms-txt-missing`, `heading-question-form`, `toc-missing`, `client-side-rendering`.
