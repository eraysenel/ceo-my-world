# Cloudflare'da güvenlik başlıklarını uygulama

Sıralı, kopyala-yapıştır edilebilir operasyon rehberi. Her adımda: nereye gireceğiniz, ne yapıştıracağınız, nasıl doğrulayacağınız ve **nasıl geri alacağınız**.

> Arayüz notu: Cloudflare menü yapısını sık değiştiriyor. Aşağıdaki yollar yazıldığı tarihte geçerliydi. Menüde bulamazsanız **panelin üstündeki arama kutusuna ayar adını yazın** ("HSTS", "Transform Rules", "Bot Fight Mode") — en güvenilir yol budur.

---

## 0. Önce ölç

Hiçbir şey eklemeden önce **şu an ne olduğunu** görün. Zaten tanımlı bir başlığın üstüne ikinci kez yazmak, özellikle CSP'de, sessiz kırılmalara yol açar.

```bash
curl -sSI https://ornek.com/ | grep -iE 'strict-transport|content-security|x-content-type|x-frame|referrer-policy|permissions-policy|set-cookie|server|x-powered-by'
```

Çıktı boşsa hiçbiri tanımlı değil. Çıktıyı bir yere kaydedin — geri alma gerekirse başlangıç durumu bu.

Alt alan adını da ayrıca ölçün, ayarlar farklı olabilir:

```bash
curl -sSI https://alt.ornek.com/ | grep -iE 'strict-transport|content-security|x-content-type|x-frame|referrer-policy'
```

---

## Cloudflare neyi yapabilir, neyi yapamaz

Bu ayrımı baştan bilmek zaman kazandırır:

| Kontrol | Nerede yapılır |
|---|---|
| `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, CSP | **Cloudflare** — Transform Rules |
| HSTS | **Cloudflare** — SSL/TLS ekranında özel bölüm |
| `Server` başlığı | **Cloudflare** zaten `cloudflare` ile değiştiriyor (proxy açıkken) |
| `X-Powered-By` | **Cloudflare** ile kaldırılabilir (Remove header) veya uygulamada kapatılır |
| **Çerez bayrakları** (`Secure`, `HttpOnly`, `SameSite`) | **Uygulamada** — çerezi üreten kod. Cloudflare'dan güvenilir biçimde eklenemez |
| **SRI** (`integrity`) | **Uygulamada** — HTML şablonunda |
| CSP için **nonce** | **Uygulamada** — her istekte üretilip hem başlığa hem `<script>` etiketine yazılmalı |

---

## Aşama 1 — Risksiz başlıklar

Bu üçü neredeyse hiçbir siteyi kırmaz. Önce bunlarla başlayın; hem hızlı kazanç hem de Transform Rules akışını öğrenmiş olursunuz.

**Yol:** `ornek.com` → **Rules → Transform Rules → Modify Response Header** → *Create rule*

- **Rule name:** `Güvenlik başlıkları — temel`
- **If... Custom filter expression** yerine **All incoming requests** seçin (tüm sayfalara uygulansın)
- **Then... Set static** ile üç başlığı tek tek ekleyin:

| Header name | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |

**Doğrulama:**

```bash
curl -sSI https://ornek.com/ | grep -iE 'x-content-type-options|referrer-policy|permissions-policy'
```

**Geri alma:** Aynı ekrandaki kuralı *Disable* edin veya silin. Etki anında.

**Kapatılan kural kimlikleri:** `x-content-type-options-missing`, `referrer-policy-missing`, `permissions-policy-missing`

---

## Aşama 2 — HSTS

**Yol:** **SSL/TLS → Edge Certificates → HTTP Strict Transport Security (HSTS)** → *Enable HSTS*

> ### Bu adımı acele etmeyin
>
> HSTS'in geri alınması diğerlerinden **farklıdır**. Tarayıcı başlığı bir kez gördüğünde belirttiğiniz süre boyunca o alan adına **yalnızca HTTPS ile** bağlanır. Kuralı silseniz bile, daha önce siteyi ziyaret etmiş tarayıcılarda süre dolana kadar geçerli kalır. Geri almanın tek yolu `max-age=0` yayınlayıp beklemektir.
>
> **`Include subdomains` seçeneği `alt.ornek.com` dahil tüm alt alan adlarını kapsar.** HTTPS sunmayan bir alt alan adınız varsa (eski test ortamı, eski panel, ayrı bir sunucudaki servis) erişilemez hâle gelir.
>
> **`Preload` kutusunu şimdilik işaretlemeyin.** Preload listesine girmek tarayıcıya siteyi derleme zamanında gömer; çıkmak aylar sürer.

**Sıra:**

1. Önce tüm alt alan adlarınızın HTTPS sunduğunu doğrulayın:
   ```bash
   for h in ornek.com www.ornek.com alt.ornek.com; do
     printf '%-28s' "$h"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 10 "https://$h/"
   done
   ```
   Hepsi 2xx/3xx dönmeli. Biri bağlanamıyorsa `Include subdomains`'i **açmayın**.

2. **Kısa süre ile başlayın:** `Max Age Header (max-age)` → **6 months** yerine mümkünse en kısa seçenek. Panel sabit seçenekler sunuyorsa en küçüğünü seçin.
3. Birkaç gün sorunsuz geçtiyse `12 months`'a çıkarın.
4. `No-Sniff Header` seçeneği aynı ekranda çıkarsa açabilirsiniz — Aşama 1'de eklediğiniz `nosniff` ile aynı işi yapar, çakışmaz.

**Hedef değer:** `max-age=31536000; includeSubDomains`

**Doğrulama:**

```bash
curl -sSI https://ornek.com/ | grep -i strict-transport-security
```

**Geri alma:** Panelden HSTS'i kapatın — ama yukarıdaki uyarıyı okuyun: mevcut ziyaretçilerde süre dolana kadar etkili kalır. Acil durumda `max-age=0` yayınlayın.

**Kapatılan kural kimlikleri:** `hsts-missing`, `hsts-weak`

---

## Aşama 3 — Çerçeveleme koruması

Sayfanızın görünmez bir iframe içine gömülüp kullanıcıya yanlış yere tıklatılmasını engeller.

**Bu aşamada `X-Frame-Options` kullanın, CSP değil.** Sebep: CSP'nin `frame-ancestors` yönergesi doğru olan yol, ama Aşama 5'te tam CSP yazacaksınız. Şimdi ayrı bir CSP başlığı eklerseniz, sonra ikinci bir CSP başlığı daha eklediğinizde **ikisi de uygulanır ve kısıtlar kesişir** — bu, teşhisi zor kırılmaların klasik kaynağıdır. Tek CSP başlığı kuralına baştan uyun.

**Yol:** Aşama 1'de oluşturduğunuz Transform Rule'a bir başlık daha ekleyin:

| Header name | Value |
|---|---|
| `X-Frame-Options` | `SAMEORIGIN` |

Sayfalarınız bilinçli olarak başka sitelere gömülüyorsa (widget, gömülü oynatıcı, iş ortağı sayfası) bu adımı atlayın ve doğrudan Aşama 5'te `frame-ancestors` ile izinli alan adlarını listeleyin.

**Doğrulama:**

```bash
curl -sSI https://ornek.com/ | grep -i x-frame-options
```

**Geri alma:** Başlığı kuraldan çıkarın. Etki anında.

**Kapatılan kural kimliği:** `clickjacking-protection-missing`

---

## Aşama 4 — CSP, önce yalnızca raporlama

**Doğrudan zorlayıcı CSP yayınlamak siteyi kırar.** Analitik, sohbet widget'ı, yazı tipi, gömülü video — hepsi ayrı bir kaynaktır ve listelenmemişse engellenir. Bu yüzden önce hiçbir şeyi engellemeyen `Report-Only` modu.

**Yol:** Aynı Transform Rule'a ekleyin:

| Header name | Value |
|---|---|
| `Content-Security-Policy-Report-Only` | *(aşağıdaki başlangıç değeri)* |

Başlangıç değeri — kendi kullandığınız servisleri ekleyerek uyarlayın:

```
default-src 'self'; script-src 'self' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://www.google-analytics.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self'
```

**İhlalleri nasıl göreceksiniz:** Cloudflare hazır bir rapor toplama noktası sunmuyor. İki seçenek:

1. **Tarayıcı konsolu (en basit).** Siteyi Chrome/Firefox'ta gezin, geliştirici araçlarında Console sekmesine bakın. Her ihlal `Content Security Policy` uyarısı olarak görünür. Küçük siteler için yeterlidir — ama yalnızca **sizin gezdiğiniz** sayfaları kapsar.
2. **Toplayıcı servis.** Değere `; report-uri https://<toplayici-adresiniz>` ekleyin. Gerçek kullanıcı trafiğindeki ihlalleri toplar; kapsam çok daha geniştir.

**En az 1 hafta bu modda kalın.** Az gezilen sayfalar (form gönderim sonucu, ödeme adımı, yönetim paneli) ancak gerçek trafikte ortaya çıkar.

**Doğrulama:**

```bash
curl -sSI https://ornek.com/ | grep -i content-security-policy-report-only
```

**Geri alma:** Başlığı kaldırın. Zaten hiçbir şeyi engellemediği için risk yok.

---

## Aşama 5 — CSP'yi zorlayıcı yapmak

**Ön koşul:** Aşama 4'te en az bir hafta boyunca ihlal listesi temizlenmiş olmalı. Temiz değilse bu aşamaya geçmeyin.

**Yol:** Transform Rule'da başlık adını değiştirin:

- `Content-Security-Policy-Report-Only` → **`Content-Security-Policy`**
- Aşama 3'te eklediğiniz `X-Frame-Options` başlığını **kaldırın** — artık `frame-ancestors` bu işi yapıyor ve ikisini birden tutmak gereksiz.

### `'unsafe-inline'` hakkında

Yukarıdaki başlangıç değerinde `style-src` için `'unsafe-inline'` var. Betikler için **koymayın**. "Şimdilik `script-src 'self' 'unsafe-inline'` yazayım, sonra kaldırırım" planı pratikte neredeyse hiç uygulanmaz — çünkü kaldırdığınız anda site kırılır ve iş yükü ertelenir. Sonuç: CSP tanımlı görünür ama betik enjeksiyonuna karşı koruma sağlamaz.

Doğru yol, satır içi betikleri **nonce** ile beyaz listeye almaktır. Bu Cloudflare'dan değil, **uygulamadan** yapılır: her istekte rastgele bir değer üretilir, hem başlığa hem etikete yazılır.

```
Content-Security-Policy: script-src 'self' 'nonce-r4nd0m123'
```
```html
<script nonce="r4nd0m123">/* satır içi betik */</script>
```

Nonce her istekte **farklı** olmalı; sabit bir değer korumayı tamamen ortadan kaldırır.

**Doğrulama:** Siteyi gezin, konsolda engellenen kaynak var mı bakın. Bir şey kırıldıysa hemen `Report-Only`'ye geri dönün.

**Geri alma:** Başlık adını tekrar `Content-Security-Policy-Report-Only` yapın. Etki anında.

**Kapatılan kural kimlikleri:** `csp-missing`, `csp-unsafe`

---

## Uygulamada yapılacaklar (Cloudflare'dan yapılamaz)

### Çerez bayrakları — `cookie-flags-weak`

Çerezi üreten kodda düzeltilir:

```
Set-Cookie: oturum=...; Path=/; Secure; HttpOnly; SameSite=Lax
```

`HttpOnly`, çerezi JavaScript'ten okunamaz yapar — bir XSS açığı doğrudan oturum çalmaya dönüşmez. Oturum çerezleri için en değerli tek bayrak budur.

### SRI — `sri-missing`

Üçüncü taraf betiklerde:

```html
<script src="https://cdn.ornek.test/lib.js"
        integrity="sha384-..."
        crossorigin="anonymous"></script>
```

Sürekli güncellenen betiklerde (analitik etiketleri gibi) SRI uygun değildir — özet her değiştiğinde site kırılır. O durumda betiği kendi alan adınızdan sunmayı değerlendirin.

### `X-Powered-By` — `server-version-disclosure`

Uygulamada kapatın, ya da Transform Rules'da **Remove header** ile kaldırın.

---

## Cloudflare'a özgü tuzak: bot koruması SEO'yu kırabilir

**Yol:** **Security → Bots**

`Bot Fight Mode` meşru denetim araçlarını ve bazı arama motoru tarayıcılarını da bloklayabilir. Belirtisi: bu depodaki `seo-audit` aracı veya başka bir tarayıcı 403 alıyor, ya da Search Console'da "Tarama anomalisi" artıyor.

Denetimde 403 alırsanız **ilk bakılacak yer burasıdır**. Güvenlik ayarı SEO'yu kırabilir; ikisini birlikte değerlendirin.

---

## Bitirdikten sonra doğrulama

**1. Bu depodaki araçla:**

```bash
cd plugins/seo-suite/tools
node seo-audit.mjs https://ornek.com --format md,html --out ../../../reports/ornek.com
```

`security` kategorisi **yalnızca canlı taramada** çalışır (yanıt başlığı gerektirir). Çevrimdışı modda "değerlendirilemedi" yazar — sıfır değil, çünkü ölçülmemiş olmak kötü olmakla aynı şey değildir.

**2. Dış doğrulama:** [MDN HTTP Observatory](https://developer.mozilla.org/en-US/observatory)

**3. Elle:**

```bash
curl -sSI https://ornek.com/ | grep -iE 'strict-transport|content-security|x-content-type|x-frame|referrer-policy|permissions-policy'
```

---

## Cloudflare hesabına erişiminiz yoksa

Siteyi bir ajans veya geliştirici kurduysa hesap onlarda olabilir. Hesap sahibinden **Member** yetkisi isteyin (`Manage Account → Members`). Yalnızca bu işler için `Firewall` ve `DNS` yetkileri yeterlidir; tam yönetici gerekmez.
