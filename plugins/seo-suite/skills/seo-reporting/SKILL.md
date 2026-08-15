---
name: seo-reporting
description: SEO bulgularını rapora dönüştürür — skorlama modeli, etki×efor önceliklendirme, 0-30-90 gün yol haritası, KPI seçimi, müşteriye/yönetime sunum. "SEO raporu hazırla", "bulguları önceliklendir", "yol haritası", "hangi işi önce yapalım", "KPI", "rapor formatı" konularında kullanın.
---

# SEO Raporlama

Bir denetim raporunun değeri, kaç bulgu içerdiğiyle değil, **kaç bulgunun uygulandığıyla** ölçülür. 200 maddelik liste uygulanmaz; 5 maddelik doğru liste uygulanır.

## Rapor iskeleti

```
1. Skor kartı + tek cümlelik hüküm
2. Güven uyarıları (neyin ölçülemediği)
3. Aksiyon planı (P0 → P3)
4. Kategori bazlı bulgular
5. Yöntem ve sınırlar
```

Sıra önemlidir: karar verici ilk ekranda ne durumda olduğunu ve ne yapması gerektiğini görmeli. Yöntem en sonda, çünkü onu okuyan uygulayıcıdır.

## Skorlama modeli

Bu paketteki araç şu modeli kullanır:

```
ceza = ağırlık × şiddet_çarpanı × (0,30 + 0,70 × yaygınlık) × güven_sönümlemesi
skor = 100 × (1 − toplam_ceza / ceza_tavanı)
```

Üç tasarım kararı ve gerekçeleri:

**Yaygınlık oran olarak hesaplanır, sayı olarak değil.** 300 sayfalık bir sitede tek bir bozuk canonical, skorun %1'ini bile götürmemeli. Aksi hâlde büyük siteler otomatik olarak düşük puan alır ve skor, sitelerin büyüklüğünü ölçmeye başlar.

**0,30 tabanı var.** Nadir ama gerçek bir sorun sıfıra yuvarlanmamalı. 1000 sayfada 1 kırık kritik bağlantı, oranla hesaplandığında ihmal edilebilir görünür — ama gerçek bir sorundur.

**Uygulanamayan kural paydaya girmez.** Tek dilli bir site hreflang kurallarından ceza yemez. Çevrimdışı denetimde ağ gerektiren kurallar hem paydan hem paydadan düşer; böylece çevrimdışı ve canlı skorlar karşılaştırılabilir kalır.

### Skor ne değildir

> **Skor sistemik sağlığı ölçer, aciliyeti değil.**

85 puanlık bir sitede tek bir kritik bulgu olabilir ve o bulgu sitenin yarısını indexten çıkarıyor olabilir. Bu yüzden araç, her `kritik` bulguyu skordan bağımsız olarak P0'a sabitler ve rapor hükmünü `kritik` yapar. Skoru tek gerçek sayı gibi sunmak, raporun en kolay yapılan hatasıdır.

## Önceliklendirme

```
öncelik = etki × efor_katsayısı × (0,5 + 0,5 × yaygınlık) × şiddet_çarpanı

efor_katsayısı:  düşük 1,0 · orta 0,6 · yüksek 0,35

P0 ≥ 5,0   Hemen yapılmalı
P1 ≥ 3,0   Bu sprint
P2 ≥ 1,5   Planla
P3 < 1,5   İsteğe bağlı
```

Efor katsayısı bilinçli olarak düşük eforu ödüllendirir: "üç aylık bir yeniden yazım" ile "bir satır meta etiketi" aynı listede yan yana duramaz. **P0 listesi 5 maddeyi geçmemeli.** Geçiyorsa önceliklendirme yapılmamış demektir.

## Bulgu nasıl yazılır

Her bulgu üç şeyi içermeli — biri eksikse bulgu uygulanamaz:

1. **Ne** — gözlem, kanıtıyla (URL, ölçüm, alıntı)
2. **Neden önemli** — iş etkisi, teknik jargon değil
3. **Ne yapmalı** — somut, uygulanabilir adım

```markdown
#### `canonical-cross-host` · hata · 12 sayfada

Alt alan adındaki 12 sayfa, canonical etiketiyle ana alan adını gösteriyor
ve hedef adreslerin 4'ü 404 dönüyor.
Örnek: https://dublaj.ornek.com/hizmet → https://ornek.com/hizmet (404)

**Neden önemli:** Bu sayfalar kendi başlarına indexlenmiyor. Alt alan adına
gelen tüm organik potansiyel, var olmayan bir adrese yönlendiriliyor.

**Ne yapmalı:** Canonical'ları kendi URL'lerine çevirin (self-canonical).
Birleştirme bilinçliyse hedef sayfaları yayına alın.
```

## Sınırları yazmak

Rapora güven kazandıran şey, neyi bilmediğini söylemesidir:

- "JavaScript çalıştırılmadı; içeriğini tarayıcıda üreten sayfalarda bulgular düşük güvenlidir."
- "Core Web Vitals alan verisi alınamadı; performans bulguları yapısal risklerdir, ölçülmüş metrik değildir."
- "Search Console erişimi yok; gerçek sorgu ve tıklama verisi bu denetimde kullanılamadı."
- "Rakip otorite metrikleri ölçülemedi; şu araçla ölçülebilir."

## Yol haritası

| Dönem | İçerik | Ölçüt |
|---|---|---|
| **0-30 gün** | P0 + düşük eforlu P1: indexleme engelleri, kırık bağlantılar, canonical, başlık/meta | Search Console'da hata sayısı; indexlenen sayfa sayısı |
| **30-90 gün** | Yapısal veri, içerik derinleştirme, iç link mimarisi, Core Web Vitals | Gösterim ve ortalama sıra; CWV geçen URL oranı |
| **90+ gün** | İçerik kümesi genişletme, konu otoritesi, dış bağlantı | Organik trafik ve **dönüşüm** |

## KPI seçimi

| Kullanmayın | Kullanın | Neden |
|---|---|---|
| Tek tek anahtar kelime sıralaması | Gösterim + ortalama sıra (küme bazında) | Tek sorgu sıralaması kişiselleştirme ve konuma göre değişir |
| Ham trafik | Organik oturum + dönüşüm | Trafik iş sonucu değildir |
| Domain otorite skoru | İndexlenen sayfa, CWV geçen URL oranı | Üçüncü taraf skorları Google sinyali değildir |
| Günlük sıralama takibi | 4-8 haftalık eğilim | Günlük dalgalanma gürültüdür |

## Araç çıktısını kullanma

```bash
# Denetim + üç format
node ${CLAUDE_PLUGIN_ROOT}/tools/seo-audit.mjs https://ornek.com \
  --format json,md,html --out reports/ornek.com

# Aynı veriden yeniden rapor (tarama yok, kurallar yeniden çalıştırılmaz)
node ${CLAUDE_PLUGIN_ROOT}/tools/seo-audit.mjs \
  --from-audit reports/ornek.com/audit.json --format html
```

`audit.json` içinde `actions[]` zaten önceliklendirilmiş gelir; rapor yazarken bu sıralamayı bozmayın, yalnızca iş bağlamıyla zenginleştirin.
