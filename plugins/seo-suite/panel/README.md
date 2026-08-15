# SEO Paneli

Sayfayı panele verin, denetim tarayıcınızda çalışsın. Sunucu yok, kurulum yok, veri hiçbir yere gönderilmez.

## Kullanım

**Tek dosya:** `dist/index.html`'i indirip çift tıklayın. Başka hiçbir şey gerekmez — kural motoru dosyanın içine gömülüdür.

Sayfayı vermenin üç yolu var; hepsi aynı yere bağlanır. İlk ikisi hiçbir kurulum istemez.

### 1. "Dosya seç" ya da sürükle-bırak — en kolayı

Kendi sitenizde `Ctrl + S` (Mac: `⌘ + S`) → **Kaydet** → dosyayı panele verin. Seçerek ya da panelin herhangi bir yerine sürükleyip bırakarak. Hiçbir izin gerektirmez, her tarayıcıda çalışır.

Birden fazla dosya verebilirsiniz: her biri ayrı sayfa kartı olur ve site geneli kurallar (yinelenen başlık, öksüz sayfa, iç link derinliği) tek hamlede devreye girer.

Adres alanı, kaynaktaki `<link rel="canonical">` ya da `og:url` etiketinden kendiliğinden doldurulur; ikisi de yoksa elle yazmanız istenir.

### 2. "Panodan al" ya da `Ctrl + V`

Kaynağı zaten kopyaladıysanız. Panelin herhangi bir yerine yapıştırmak da aynı işi yapar. Tarayıcı pano izni vermezse panel sessiz kalmaz, sizi kutuya yönlendirir.

### 3. "Sayfayı Yakala" yer imi — ileri seviye, bir kez kurulur

Düğmeyi **bir kez** yer imi çubuğuna sürüklersiniz; sonra kendi sitenizin herhangi bir sayfasındayken ona tıklamanız yeterli olur.

Panelin içinde açılır bir **"Nasıl kurulur?"** bölümü var: yer imi çubuğunun nasıl görünür yapılacağı (`Ctrl + Shift + B`), sürüklemenin nasıl yapılacağı, ve bunu gösteren bir çizim. Sürükleme tutmazsa kodu kopyalayıp yer imini elle oluşturabilirsiniz. Bu yolu bilmiyorsanız gerek de yok — yukarıdaki iki yol aynı sonucu verir.

Bilinmesi gerekenler:

- Yakalanan `view-source` çıktısı değil, **render edilmiş DOM**'dur. JavaScript ile sonradan eklenen içerik de dahil olur. Arama motorları da render edilmiş hâli gördüğü için bu genelde daha doğru bir girdidir.
- **Panel kendi sekmesinde, bir `http(s)` adresinde açıksa** yer imi tek tıkla çalışır: veri gzip'lenip adres fragmanında taşınır (`#seo=…`), panel açılır, denetim kendiliğinden koşar. Fragman **sunucuya gönderilmez**; sayfanız tarayıcınızdan çıkmaz.
- **Panel bir çerçeve içindeyse (Claude'un penceresi) ya da diskten `file://` ile açıldıysa** panele adresle dönülemez. Yer imi bunu bilir ve kipini değiştirir: sayfayı panoya kopyalar, siz panele dönüp "Panodan al"a basarsınız. Panel hangi kipte olduğunu açılışta yazar.
- Sitenizde `script-src` içeren bir CSP varsa tarayıcı yer imlerini engelleyebilir. (İronik biçimde bunu bizim güvenlik rehberimiz öneriyor.) O durumda 1. yolu kullanın.

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
