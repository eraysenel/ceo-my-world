# SEO Suite

Türkçe web siteleri için **Claude Code SEO denetim takımı**: 12 skill + 107 kurallı çalıştırılabilir bir tarayıcı/denetleyici.

Bu depo aynı zamanda bir **Claude Code marketplace**'idir — tek komutla kurulur, `git pull` ile güncellenir.

---

## Kurulum

### Claude Code içinden (önerilen)

```
/plugin marketplace add eraysenel/ceo-my-world
/plugin install seo-suite@ceo-my-world
```

Kurulumdan sonra skill'ler `/seo-suite:seo-audit` biçiminde (çakışma yoksa kısaca `/seo-audit`) çağrılabilir.

Güncelleme:

```
/plugin marketplace update
```

### Depoyu klonlayıp üzerinde çalışıyorsanız

```bash
git clone https://github.com/eraysenel/ceo-my-world.git
cd ceo-my-world
```

Claude Code içinde:

```
/plugin marketplace add ./
/plugin install seo-suite@ceo-my-world
```

### Eklenti altyapısını kullanmak istemiyorsanız

```bash
./scripts/install.sh          # skill'leri ~/.claude/skills/ altına kopyalar
./scripts/install.sh --list   # ne kopyalanacağını gösterir, kopyalamaz
```

---

## İçindekiler

### Skill'ler

| Skill | Ne işe yarar |
|---|---|
| `seo-audit` | **Orkestratör.** Faz faz denetim yürütür, aracı çalıştırır, Türkçe raporu yazar |
| `technical-seo` | robots.txt, sitemap, canonical, durum kodları, yönlendirme zincirleri, indexlenebilirlik |
| `onpage-seo` | title/meta/başlık hiyerarşisi, iç linkleme, anchor metni, içerik derinliği, E-E-A-T |
| `structured-data` | schema.org JSON-LD üretimi ve doğrulaması, zengin sonuç uygunluğu |
| `core-web-vitals` | LCP / INP / CLS, render engelleyiciler, kaynak ipuçları, caching |
| `intl-seo` | hreflang, `tr-TR`, alt alan adı vs alt dizin, Türkçe karakter ve slug tuzakları |
| `ai-search` | AI Overviews'ta alıntılanma, AI tarayıcı erişimi, SSR, `llms.txt` gerçeği |
| `content-strategy` | Arama niyeti, topical authority, içerik brief'i, Türkçe anahtar kelime nüansları |
| `local-seo` | Google Business Profile, NAP tutarlılığı, Türkiye yerel sinyalleri |
| `security-headers` | CSP, HSTS, çerçeveleme koruması, çerez bayrakları, SRI — MDN Observatory tarzı |
| `seo-reporting` | Skorlama, etki×efor önceliklendirme, rapor formatı, KPI takibi |
| `modern-web-design` | Performans öncelikli arayüz, semantik HTML, erişilebilirlik |

### Denetim aracı

`plugins/seo-suite/tools/` altında, Node 22+ ile çalışan bir CLI.

```bash
cd plugins/seo-suite/tools
npm install          # tek seferlik (cheerio)

# Canlı tarama
node seo-audit.mjs https://ornek.com --max-pages 150 --out ../../../reports/ornek.com

# Çevrimdışı: kaydedilmiş HTML dizini (ağ erişimi olmayan ortamlar için)
node seo-audit.mjs --input-dir ./kayitlar --base-url https://ornek.com

# Tek sayfa
node seo-audit.mjs --input-file anasayfa.html --page-url https://ornek.com/

# Mevcut audit.json'dan yeniden rapor üret (tarama yok)
node seo-audit.mjs --from-audit reports/ornek.com/audit.json --format md,html
```

Çıktılar: `audit.json` (ham veri), `rapor.md` (Türkçe, skorlu), `rapor.html` (tek dosya).

Tüm seçenekler için: `node seo-audit.mjs --help`

---

## Faz modeli

`seo-audit` skill'i denetimi altı fazda yürütür. Her faz bir öncekinin çıktısına dayanır, ve her fazın sonunda ne bulunduğu **ölçümle** raporlanır:

| Faz | Ne yapılır |
|---|---|
| 0 | Kapsam: alan adları, diller, hedef kitle, iş hedefi |
| 1 | Altyapı: DNS, TLS, HTTP sürümü, CDN, sunucu başlıkları |
| 2 | Taranabilirlik: robots.txt, sitemap, durum kodları, canonical, indexlenebilirlik |
| 3 | Sayfa içi: başlıklar, meta, içerik derinliği, iç linkleme, structured data |
| 4 | Deneyim: Core Web Vitals, mobil, erişilebilirlik |
| 5 | Görünürlük: arama niyeti, rakip karşılaştırma, AI aramada alıntılanma |

Her fazın sonunda `reports/<alan-adi>/` altına dosya yazılır; hiçbir faz "tahminle" geçilmez — ölçülemeyen şey **ölçülemedi** diye raporlanır.

---

## Tasarım ilkeleri

**Ölçmediğini iddia etme.** Araç JavaScript çalıştırmaz. İçeriğini tarayıcıda üreten bir sitede bunu tespit eder, ilgili bulguları `düşük güven` olarak işaretler ve raporun başına uyarı koyar. Bot koruması taramayı engellerse rapor bunu gizlemez.

**Skor sistemik sağlığı ölçer, aciliyeti değil.** Tek bir bozuk sayfa 300 sayfalık bir sitenin skorunu çökertmez — ceza, etkilenen sayfa *oranına* göre hesaplanır. Buna karşılık her `kritik` bulgu, skordan bağımsız olarak aksiyon listesinin en üstüne sabitlenir.

**Politika kararını hata sayma.** `GPTBot`'u engellemek bilinçli bir tercih olabilir. Araç bunu bildirir ama varsayılan olarak skordan düşmez.

**Ölçmediğin kategoriye sıfır verme.** Çevrimdışı modda yanıt başlıkları olmadığı için güvenlik kuralları çalışmaz; rapor o kategoriye 0 değil "değerlendirilemedi" yazar. Ölçülmemiş olmak, kötü olmakla aynı şey değildir.

**Güvenlik ayrı ölçülür.** CSP, HSTS ve benzeri başlıklar sıralama faktörü değildir; güvenlik skoru hesaplanır ama **genel SEO skoruna katılmaz**. Karıştırmak, SEO skorunun ölçtüğünü iddia ettiği şeyi ölçmemesi olurdu.

**Türkçe birinci sınıf vatandaştır.** `İ`/`ı` büyük-küçük harf dönüşümü, `Intl.Collator('tr')` ile sıralama, URL'de yüzde kodlaması, mojibake (`Ã¼`, `ÅŸ`, `Ä±`) tespiti ve başlık genişliğinin karakter yerine **piksel** ile ölçülmesi araca gömülüdür.

---

## Geliştirme

```bash
cd plugins/seo-suite/tools
npm install
npm test                    # node:test, ağ gerektirmez
claude plugin validate ../../..   # manifest + skill frontmatter doğrulaması
```

Yeni kural eklemek: `rules/<kategori>/` altına bir `.mjs` dosyası koyun, `defineRule({...})` ile tanımlayın, `test/` altına biri pozitif biri negatif iki fixture testi yazın. Kayıt otomatiktir.

---

## Lisans

MIT — bkz. [LICENSE](LICENSE).
