# SEO Paneli

Sayfa kaynağını yapıştırın, denetim tarayıcınızda çalışsın. Sunucu yok, kurulum yok, veri hiçbir yere gönderilmez.

## Kullanım

**Tek dosya:** `dist/index.html`'i indirip çift tıklayın. Başka hiçbir şey gerekmez — kural motoru dosyanın içine gömülüdür.

Sonra her sayfa için:

1. Sayfayı tarayıcıda açın
2. `Ctrl + U` (Mac: `Cmd + Option + U`) — sayfa kaynağı açılır
3. `Ctrl + A`, `Ctrl + C`
4. Panele yapıştırın, adresini yazın, **Denetle**

## Neyi ölçer, neyi ölçmez

Panel, CLI ile **aynı kural motorunu** çalıştırır — ayrı bir uygulama değil, aynı kodun tarayıcıya paketlenmiş hâli. Aynı girdide aynı skoru vermesi teste bağlanmıştır (`tools/test/panel.test.mjs`).

| | Kural | Neden |
|---|---:|---|
| Panelde çalışır | 81 | Yalnızca HTML gerektirir |
| Panelde çalışmaz | 26 | Yanıt başlığı ve durum kodu gerektirir |

Çalışmayan kurallar puana **sıfır olarak değil, değerlendirme dışı** olarak girer. Bir kategoride kuralların yarısından azı çalıştıysa bar kesikli çizilir ve skorun yanına `~` konur — dolu yeşil bir bar, yarısı ölçülmemişken "mükemmel" diye okunmasın diye.

Tam denetim (durum kodları, yönlendirmeler, sitemap, sıkıştırma, güvenlik başlıkları) için CLI:

```bash
cd ../tools && npm install
node seo-audit.mjs https://ornek.com --format json,md,html
```

## Geliştirme

```bash
cd ../tools
npm install
npm run build:panel   # src/ -> dist/
npm test              # panel testleri dahil (Chromium varsa)
```

`dist/` üretilmiş çıktıdır ve depoya dahildir: paneli kullanacak kişinin derleme yapması gerekmesin diye. Kaynak `src/` altındadır — düzenleme oraya yapılır, `dist/` elle değiştirilmez.

Üç çıktı:

| Dosya | Ne için |
|---|---|
| `dist/index.html` | Bağımsız sayfa — indirilip açılır |
| `dist/artifact.html` | Aynı içerik, dış iskelet olmadan (Artifact olarak yayınlamak için) |
| `dist/seo-audit.bundle.js` | Ham motor — panelsiz kullanmak veya testte enjekte etmek için |
