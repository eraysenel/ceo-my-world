# SEO Paneli

Sayfayı panele verin, denetim tarayıcınızda çalışsın. Sunucu yok, kurulum yok, veri hiçbir yere gönderilmez.

## Kullanım

**Tek dosya:** `dist/index.html`'i indirip çift tıklayın. Başka hiçbir şey gerekmez — kural motoru dosyanın içine gömülüdür.

Sayfayı vermenin dört yolu var; hepsi aynı yere bağlanır.

### 1. "Sayfayı Yakala" yer imi — tek tık

Paneldeki turuncu düğmeyi **bir kez** yer imi çubuğuna sürükleyin. Sonra kendi sitenizin herhangi bir sayfasındayken o yer imine tıklayın: sayfa yakalanır, panel yeni sekmede açılır, denetim kendiliğinden koşar.

Bilinmesi gerekenler:

- Yakalanan `view-source` çıktısı değil, **render edilmiş DOM**'dur. JavaScript ile sonradan eklenen içerik de dahil olur. Arama motorları da render edilmiş hâli gördüğü için bu genelde daha doğru bir girdidir.
- Veri gzip'lenip adres fragmanında taşınır (`#seo=…`). Fragman **sunucuya gönderilmez**; sayfanız tarayıcınızdan çıkmaz.
- Sitenizde `script-src` içeren bir CSP varsa tarayıcı yer imlerini engelleyebilir. (İronik biçimde bunu bizim güvenlik rehberimiz öneriyor.) O durumda 2. yolu kullanın.
- Panel `file://` ile diskten açıldıysa yer imi çalışmaz: bir `https` sayfasından `file://` adresine gidilemez. Panel bunu açılışta söyler.

### 2. "Dosya seç" ya da sürükle-bırak — en güvenilir

Sayfayı `Ctrl + S` ile kaydedin, dosyayı seçin — ya da panelin herhangi bir yerine sürükleyip bırakın. Hiçbir izin gerektirmez, her tarayıcıda çalışır.

Birden fazla dosya verebilirsiniz: her biri ayrı sayfa kartı olur ve site geneli kurallar (yinelenen başlık, öksüz sayfa, iç link derinliği) tek hamlede devreye girer.

Adres alanı, kaynaktaki `<link rel="canonical">` ya da `og:url` etiketinden kendiliğinden doldurulur; ikisi de yoksa elle yazmanız istenir.

### 3. "Panodan al"

Kaynağı zaten kopyaladıysanız. Tarayıcı pano izni vermezse panel sessiz kalmaz, sizi kutuya yönlendirir.

### 4. Panelin herhangi bir yerine `Ctrl + V`

HTML'e benzeyen bir şey yapıştırırsanız doğrudan bir karta düşer.

### Neden "adresi yaz, getir" düğmesi yok

Bir web sayfası başka bir alan adının HTML'ini indiremez: tarayıcının same-origin kuralı, hedef site CORS başlığı göndermedikçe engeller. Bu her site için geçerli bir tarayıcı kısıtıdır, panelin eksiği değil. Her zaman hata verecek bir düğme konulmadı.

Tüm sitenizi adresten tarayan bir araç istiyorsanız o CLI'dır — aşağıya bakın.

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
