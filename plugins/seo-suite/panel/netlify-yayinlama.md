# Paneli Netlify'a yayınlama

Panel şu an ya Claude'un penceresinde ya da bilgisayarınızdaki bir dosyada çalışıyor. Kendi adresine taşımanın üç kazancı var:

| | Şimdi | Yayından sonra |
|---|---|---|
| Kalıcılık | Artifact bağlantısı hesaba bağlı | Kendi adresiniz, kendi hesabınızda |
| "Sayfayı Yakala" | Pano kipine düşüyor (çerçeve içinde çalışıyor) | **Tek tıkla** çalışır |
| Güvenlik başlıkları | Yok | Katı CSP dahil hepsi açık |

Terminal gerekmiyor. Her şey tarayıcıdan.

---

## Önce bilmeniz gerekenler

**Adres herkese açık olur.** Sakıncası yok: panel bir araçtır, içinde sizin verileriniz yoktur. Analiz tarayıcınızda koşar — girdiğiniz sayfa hiçbir sunucuya gitmez, Netlify'a da gitmez. Başkası adresi açsa boş bir araç görür.

**Ücretsiz plan yeter.** Panel tek bir HTML dosyası; sunucu tarafı hiçbir şey çalışmıyor.

---

## Yol 1 — GitHub deposunu bağlayın (önerilen)

Bir kez kurulur, sonra kendi kendine güncellenir: depoya her yeni sürüm girdiğinde Netlify paneli yeniden yayınlar.

1. **https://app.netlify.com** adresine girin.
2. **Add new project** (Yeni proje ekle) → **Import an existing project** (Var olan bir projeyi içe aktar).
3. **GitHub**'ı seçin. İlk kez yapıyorsanız Netlify GitHub hesabınıza erişim izni ister; isterseniz izni yalnızca bu depoya verebilirsiniz (**Only select repositories**).
4. Listeden **ceo-my-world** deposunu seçin.
5. Açılan ayar ekranında:
   - **Branch to deploy** (Yayınlanacak dal): şu an `claude/seo-analysis-setup-xfxfvj`. Pull request birleştikten sonra bunu `main` yapın.
   - **Build command** ve **Publish directory** alanlarına **dokunmayın**. Depodaki `netlify.toml` dosyası ikisini de söylüyor: derleme yok, yayın klasörü `plugins/seo-suite/panel/dist`.
6. **Deploy** deyin. Bir dakika içinde `rastgele-isim-123.netlify.app` gibi bir adres verir.
7. İsterseniz **Project configuration → General → Change site name** ile adı düzeltin (`seo-paneli` gibi).

Bitti. Adresi tarayıcınızda açın — panelin altında artık "yer imi pano kipinde" uyarısı **görünmez**, çünkü tek tık kipi devrededir.

---

## Yol 2 — Klasörü sürükleyip bırakın (kurulumsuz)

GitHub bağlamak istemiyorsanız. Anında yayına alır, ama her güncellemede tekrarlamanız gerekir.

1. Depodaki `plugins/seo-suite/panel/dist` klasörünü bilgisayarınıza indirin.
2. **https://app.netlify.com** → **Add new project** → **Deploy manually**.
3. Klasörü sayfadaki alana sürükleyip bırakın.

`dist` içindeki `_headers` dosyası da yüklenir; güvenlik başlıkları bu yolda da uygulanır.

---

## Kendi alan adınızı bağlamak (isteğe bağlı)

`seo.ornek.com` gibi bir adres istiyorsanız:

1. Netlify'da projeyi açın → **Domain management** → **Add a domain**.
2. Alan adını yazın (`seo.ornek.com`).
3. Netlify size bir hedef verir (`rastgele-isim-123.netlify.app` gibi).
4. Alan adınızın DNS panelinde (Cloudflare kullanıyorsanız orada) bir **CNAME** kaydı açın:
   - **Ad:** `seo`
   - **Hedef:** Netlify'ın verdiği adres
   - Cloudflare kullanıyorsanız bulut simgesini **gri** yapın (proxy kapalı) — Netlify sertifikayı kendisi verecek.
5. Netlify'a dönüp **Verify** deyin. Sertifika birkaç dakikada kendiliğinden çıkar.

---

## Güvenlik başlıkları neden hazır geliyor

Panel, sitelerin güvenlik başlıklarını denetleyen bir araç. Kendi yayınında o başlıkları taşımaması tutarsız olurdu — bu yüzden `dist/_headers` derleme sırasında üretiliyor ve şunları veriyor:

- **Content-Security-Policy** — `unsafe-inline` olmadan. Panelin bütün kodu satır içi olduğu için her bloğun SHA-256 özeti hesaplanıp beyaz listeye alınıyor.
- **Strict-Transport-Security** — 1 yıl, alt alan adları dahil.
- **X-Content-Type-Options: nosniff**, **X-Frame-Options: DENY**, **Referrer-Policy**, **Permissions-Policy**, **Cross-Origin-Opener-Policy**.

`_headers` dosyası **elle düzenlenmez**: CSP özetleri panelin koduna bağlı, kod değişince özetler de değişir. İkisi tek yerden (`tools/build-panel.mjs`) üretiliyor; ayrı tutulsalardı biri eskir ve panel canlıda açılmazdı.

Bir test bunu her koşuda doğruluyor (`tools/test/deploy.test.mjs`): panel tam o başlıklarla servis edilip tarayıcıda çalıştırılıyor, ve üretilen başlıklar aracın kendi güvenlik kurallarından geçiriliyor.

---

## Yayından sonra

Panelin adresi değiştiği için "Sayfayı Yakala" yer imini **yeniden kurmanız gerekir** — eski yer imi eski adrese işaret ediyor. Yeni adreste paneli açıp düğmeyi tekrar yer imi çubuğuna sürükleyin. Bu sefer tek tık kipinde olacak: kendi sitenizde tıklayınca panel açılır ve denetim kendiliğinden başlar.
