// Türkçe metin katmanı testleri.
// Bu katmandaki bir hata sessizce yanlış bulgu üretir, bu yüzden ayrıntılı test edilir.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  trLower, trUpper, normalizeKey, slugify, detectMojibake,
  turkishStopwordRatio, measureTextPx, simhash, hammingDistance, wordCount, truncate,
  NEAR_DUPLICATE_DISTANCE
} from '../lib/text.mjs';

test('trLower: İ ve I doğru küçültülür', () => {
  // JS varsayılanı 'İSTANBUL'.toLowerCase() -> 'i̇stanbul' (birleşen noktalı i)
  assert.equal(trLower('İSTANBUL'), 'istanbul');
  assert.equal(trLower('IŞIK'), 'ışık');
  assert.equal(trLower('DUBLAJ'), 'dublaj');
  assert.equal(trLower('ÇĞÖŞÜ'), 'çğöşü');
});

test('trUpper: i ve ı doğru büyütülür', () => {
  assert.equal(trUpper('istanbul'), 'İSTANBUL');
  assert.equal(trUpper('ışık'), 'IŞIK');
  assert.equal(trUpper('seslendirme'), 'SESLENDİRME');
});

test('normalizeKey: büyük/küçük harf farkı yinelenen başlığı gizlemez', () => {
  assert.equal(normalizeKey('DUBLAJ Hizmeti'), normalizeKey('dublaj hizmeti'));
  assert.equal(normalizeKey('  Fazla   Boşluk '), 'fazla boşluk');
});

test('slugify: Türkçe karakterler ASCII karşılığına iner', () => {
  assert.equal(slugify('Reklam Seslendirme Fiyatları'), 'reklam-seslendirme-fiyatlari');
  assert.equal(slugify('Şirket Çözümleri & Ürünler'), 'sirket-cozumleri-urunler');
  assert.equal(slugify('İzmir Ofisi'), 'izmir-ofisi');
});

test('detectMojibake: bozuk kodlamayı yakalar', () => {
  const m = detectMojibake('StÃ¼dyomuz Ä°stanbul KadÄ±kÃ¶y de. Ã‡alÄ±ÅŸma saatleri.');
  assert.ok(m, 'mojibake tespit edilmeliydi');
  assert.ok(m.total >= 4);
});

test('detectMojibake: tek geçişte alarm vermez (yanlış pozitif kontrolü)', () => {
  // Kodlamayı anlatan bir yazıda tek bir örnek geçebilir; bu bulgu olmamalı.
  assert.equal(detectMojibake('Örnek olarak Ã¼ dizisi görülebilir.'), null);
  assert.equal(detectMojibake('Tamamen temiz Türkçe metin, hiçbir sorun yok.'), null);
});

test('turkishStopwordRatio: Türkçe metni İngilizceden ayırır', () => {
  const tr = 'Bu sayfa reklam seslendirme ve dublaj hizmetleri için hazırlanmıştır. '
    + 'Her proje için ayrı bir ses tonu belirlenir ve müşteriye örnek okuma gönderilir. '
    + 'Bu yaklaşım ile revizyon sayısı azalır, teslim süresi kısalır.';
  const en = 'This page describes our dubbing and voice over services for advertising. '
    + 'Every project receives a dedicated tone of voice and a sample recording is shared. '
    + 'This approach reduces revisions and shortens delivery time significantly.';
  assert.ok(turkishStopwordRatio(tr) > 0.06, 'Türkçe metin eşiği geçmeli');
  assert.ok(turkishStopwordRatio(en) < 0.06, 'İngilizce metin eşiğin altında kalmalı');
});

test('turkishStopwordRatio: çok kısa metinde yargı vermez', () => {
  assert.equal(turkishStopwordRatio('Bu bir test'), 0);
});

test('measureTextPx: dar Türkçe harfler geniş harflerden az yer kaplar', () => {
  const dar = measureTextPx('ıııııııııı');
  const genis = measureTextPx('mmmmmmmmmm');
  assert.ok(dar < genis, 'ı harfi m harfinden dar olmalı');
  assert.equal(measureTextPx(''), 0);
});

test('measureTextPx: karakter sayısı aynı, piksel genişliği farklı olabilir', () => {
  // Piksel ölçümünün varlık nedeni tam olarak bu: karakter saymak yanıltır.
  const a = 'ilişki ilişki ilişki ilişki ilişki';
  const b = 'MODERN MODERN MODERN MODERN MODERN';
  assert.equal([...a].length, [...b].length);
  assert.ok(measureTextPx(b) > measureTextPx(a) * 1.3);
});

test('simhash: aynı metin aynı parmak izini verir', () => {
  const t = 'Reklam seslendirme dizi dublajı kurumsal tanıtım içerikleri';
  assert.equal(simhash(t), simhash(t));
  assert.equal(hammingDistance(simhash(t), simhash(t)), 0);
});

test('simhash: şablon farkı yakın, farklı konu uzak çıkar', () => {
  // Gerçek dünyada yakalanması gereken durum: aynı içeriğin /a ve /a/ gibi iki
  // adreste yayınlanması, ya da tek bir cümlesi değişmiş şablon sayfalar.
  const govde = ('Reklam seslendirme dizi dublajı kurumsal tanıtım ve e öğrenme içerikleri için '
    + 'profesyonel ses üretimi yapıyoruz her proje kendi ses kimliğiyle ele alınıyor marka '
    + 'tonuna uygun sanatçı seçimi yapılıyor kayıt öncesi örnek okuma paylaşılıyor ').repeat(3);
  const neredeyseAyni = `${govde} teslim süresi beş iş günüdür`;
  const farkliKonu = ('Mimarlık ofisimiz konut projeleri iç mekan tasarımı ve peyzaj düzenlemesi '
    + 'alanlarında hizmet vermektedir referans projelerimizi inceleyebilir randevu '
    + 'oluşturabilirsiniz şantiye takibi ayrıca sunulmaktadır ').repeat(3);

  const yakin = hammingDistance(simhash(govde), simhash(neredeyseAyni));
  const uzak = hammingDistance(simhash(govde), simhash(farkliKonu));
  assert.ok(yakin <= NEAR_DUPLICATE_DISTANCE, `yakın kopya uzaklığı ${yakin} olmamalıydı`);
  assert.ok(uzak > NEAR_DUPLICATE_DISTANCE, `farklı konu uzaklığı ${uzak} olmamalıydı`);
});

test('wordCount: Türkçe harfleri sözcük sınırı saymaz', () => {
  assert.equal(wordCount('ışık güneş çiçek ördek şapka'), 5);
});

test('truncate: uzun metni kısaltır, kısa metne dokunmaz', () => {
  assert.equal(truncate('kısa', 20), 'kısa');
  assert.equal(truncate('a'.repeat(50), 10).length, 10);
});
