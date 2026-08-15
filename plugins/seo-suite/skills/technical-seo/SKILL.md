---
name: technical-seo
description: Taranabilirlik ve indexlenebilirlik sorunlarını teşhis eder ve düzeltir. robots.txt, sitemap.xml, canonical etiketleri, noindex, durum kodları, yönlendirme zincirleri, www/https birleştirme, yinelenen içerik, URL yapısı ve tarama bütçesi konularında kullanın. "Google sayfamı indexlemiyor", "Search Console hatası", "canonical", "robots.txt", "sitemap", "301 yönlendirme", "yinelenen içerik", "tarama bütçesi" gibi ifadelerde tetiklenir.
---

# Teknik SEO

Para burada kaybedilir. Google sayfayı bulamıyor, tarayamıyor veya indexlememesi gerektiğini sanıyorsa; içerik, hız ve yapısal veri üzerine yapılan her şey teoriktir.

## Teşhis sırası

Bir sayfa arama sonuçlarında yoksa, sırayla eleyin. Bu sıra tesadüfi değil — her adım bir öncekine bağlıdır:

1. **Erişilebilir mi?** 200 mü dönüyor, yoksa 404/500/zaman aşımı mı?
2. **Taranabiliyor mu?** robots.txt engelliyor mu?
3. **İndexlenebilir mi?** `noindex` var mı (meta ya da `X-Robots-Tag` başlığı)?
4. **Kanonik mi?** `rel=canonical` başka bir sayfayı mı gösteriyor?
5. **Keşfedilebilir mi?** Sitemap'te var mı, iç bağlantı alıyor mu?
6. **Değerli mi?** İçerik özgün mü, yoksa başka bir sayfanın kopyası mı?

İlk beş adımdan biri "hayır" ise, altıncıyı tartışmak anlamsızdır.

## robots.txt

`robots.txt` **taramayı** engeller, **indexlemeyi** değil. Bu ayrım en sık yapılan hatanın kaynağıdır:

> Bir sayfayı arama sonuçlarından çıkarmak istiyorsanız `robots.txt` ile engellemeyin. Engellenmiş sayfa, dış bağlantılar üzerinden yine indexlenebilir — üstelik Google içeriğini okuyamadığı için `noindex` etiketinizi de göremez. Doğru yol: sayfanın taranmasına izin verin, `noindex` verin. Google okusun ve çıkarsın.

Kontrol listesi:

- [ ] `robots.txt` 200 dönüyor ve `text/plain` (HTML dönen robots.txt yok sayılır)
- [ ] `Sitemap:` satırı var
- [ ] CSS ve JS dosyaları engellenmemiş (engellenirse Google sayfayı bozuk render eder)
- [ ] `Disallow: /` yanlışlıkla kalmamış (test ortamından canlıya taşınan klasik hata)
- [ ] AI tarayıcı kuralları bilinçli (bkz. `ai-search`)

## Canonical

`rel=canonical` bir **öneridir**, emir değil. Google çelişkili sinyal görürse yok sayar.

| Durum | Doğru davranış |
|---|---|
| Normal içerik sayfası | Kendini gösteren mutlak canonical |
| Parametreli sürüm (`?renk=mavi`) | Parametresiz asıl sayfayı göster |
| Sayfalama (`/blog/sayfa/2`) | **Kendini** göster — ilk sayfayı değil |
| Alt alan adı ile ana alan adı aynı içerik | Birini seç, diğeri onu göstersin |
| A/B test varyantı | Asıl sürümü göster |

Canonical'ı bozan yaygın hatalar:

- **Göreli canonical.** `<base>` etiketi veya farklı sunucu yapılandırması yanlış URL'ye çözümler. Her zaman mutlak yazın.
- **Canonical hedefi 404 veya yönlendirme.** Google bunu yok sayar ve sayfayı kendi başına değerlendirir.
- **Canonical + noindex birlikte.** Çelişkili sinyal: "bu sayfa aslında şu, ama şunu da indexleme". Google'ın nasıl yorumlayacağı öngörülemez.
- **Tüm sayfalarda ana sayfayı gösteren canonical.** Genelde şablon hatası; sitenin tamamını tek sayfaya indirger.

## Yönlendirmeler

- **301** kalıcı, **302** geçici. Kalıcı taşımada 302 kullanmak sinyal aktarımını geciktirir.
- **Zincir yok.** `A → B → C` yerine `A → C` ve `B → C`. Her adım gecikme ekler.
- **Döngü yok.** Tarayıcı vazgeçer, sayfa hiç indexlenmez.
- **Toplu taşımada eşleme tablosu tutun.** "Hepsini ana sayfaya yönlendir" yaklaşımı, taşınan her sayfanın birikmiş değerini çöpe atar ve Google bunu yumuşak 404 sayar.

## Birleştirme (canonicalization)

Aynı içeriğe giden her farklı URL bir kopyadır:

```
http://ornek.com        https://ornek.com
http://www.ornek.com    https://www.ornek.com
https://ornek.com/a     https://ornek.com/a/
https://ornek.com/A     https://ornek.com/a
https://ornek.com/a     https://ornek.com/a?utm_source=x
```

Birini seçin, kalanları 301 ile ona yönlendirin. Test yöntemi: her varyanta istek atıp durum kodunu görün.

```bash
for u in http://ornek.com https://ornek.com http://www.ornek.com https://www.ornek.com; do
  printf '%-30s' "$u"; curl -sS -o /dev/null -w '%{http_code} -> %{redirect_url}\n' "$u"
done
```

## Sitemap

- Yalnızca **200 dönen, indexlenebilir, canonical'ı kendisi olan** URL'ler girer.
- 50.000 URL veya 50 MB üstünde sitemap index kullanın.
- `lastmod` gerçek son güncelleme tarihi olmalı. Her yayında tüm tarihleri bugüne çekmek sinyali değersizleştirir — Google bunu öğrenir ve alanı yok saymaya başlar.
- Sitemap'te olup iç bağlantı almayan sayfalar "yetim"dir: sitemap onların keşfedilmesini sağlar ama önem sinyali vermez.

## URL yapısı ve Türkçe

Türkçe karakterli URL'ler teknik olarak geçerlidir ama pratikte sorun üretir: aynı adres iç bağlantıda ham, canonical'da kodlanmış, sitemap'te farklı kodlanmış hâlde görünebilir ve Google üç ayrı URL sayar.

```
Kötü:  /hizmetler/reklam-seslendirme-fiyatları
Kötü:  /hizmetler/Reklam_Seslendirme
İyi:   /hizmetler/reklam-seslendirme-fiyatlari
```

Kural: küçük harf, tire, ASCII. Türkçe karakterler slug'a çevrilirken `ı→i, ş→s, ğ→g, ü→u, ö→o, ç→c`.

## Tarama bütçesi

Küçük sitelerde (< 10.000 sayfa) tarama bütçesi genellikle sorun değildir. Sorun olduğunda belirtileri:

- Search Console'da "Tarandı - şu anda indexlenmedi" sayısı yüksek
- Yeni sayfaların indexlenmesi günler sürüyor
- Sunucu günlüklerinde Googlebot'un zamanının çoğunu değersiz URL'lerde geçirmesi (filtre kombinasyonları, takvim sayfaları, arama sonuçları)

Çözüm sırası: değersiz URL'leri üretmeyi bırak → `robots.txt` ile engelle → hızlı sunucu yanıtı ver.

## Araçla ölçüm

```bash
cd ${CLAUDE_PLUGIN_ROOT}/tools
node seo-audit.mjs https://<alan-adi> --max-pages 300 --check-external
```

İlgili kural kimlikleri: `robots-noindex-conflict`, `canonical-missing`, `canonical-non-200`, `canonical-cross-host`, `canonical-relative-url`, `redirect-chain`, `www-https-canonicalization`, `soft-404`, `sitemap-url-non-indexable`, `sitemap-orphan-pages`, `http-status-error`, `url-turkish-charset`, `duplicate-content-cluster`, `client-side-rendering`.
