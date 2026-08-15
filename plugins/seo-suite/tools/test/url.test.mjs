// URL normalleştirme testleri.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUrl, resolveUrl, sameSite, registrableDomain, hasRawTurkishChars,
  hasUppercaseOrUnderscore, looksNonHtml, pathDepth, stripWww, withoutTrailingSlash
} from '../lib/url.mjs';

test('normalizeUrl: takip parametreleri atılır, kalanlar sıralanır', () => {
  assert.equal(
    normalizeUrl('https://ornek.test/sayfa?utm_source=x&b=2&a=1&fbclid=y'),
    'https://ornek.test/sayfa?a=1&b=2'
  );
});

test('normalizeUrl: fragment ve varsayılan port atılır, host küçültülür', () => {
  assert.equal(normalizeUrl('https://ORNEK.test:443/a#bolum'), 'https://ornek.test/a');
  assert.equal(normalizeUrl('http://ornek.test:80/a'), 'http://ornek.test/a');
});

test('normalizeUrl: yüzde kodlaması büyük harfe normalize edilir', () => {
  // %c4%b1 ile %C4%B1 aynı URL'dir; farklı sanmak sahte yinelenen içerik üretir.
  assert.equal(
    normalizeUrl('https://ornek.test/fiyatlar%c4%b1'),
    normalizeUrl('https://ornek.test/fiyatlar%C4%B1')
  );
});

test('normalizeUrl: sondaki eğik çizgi KORUNUR', () => {
  // /a ve /a/ sunucuya göre farklı sayfa olabilir; ikisi de 200 dönüyorsa bu bir bulgudur.
  assert.notEqual(normalizeUrl('https://ornek.test/a'), normalizeUrl('https://ornek.test/a/'));
});

test('normalizeUrl: http/https dışındaki şemalar reddedilir', () => {
  assert.equal(normalizeUrl('mailto:bilgi@ornek.test'), null);
  assert.equal(normalizeUrl('gecersiz'), null);
});

test('resolveUrl: gezinme dışı şemalar yok sayılır', () => {
  assert.equal(resolveUrl('mailto:a@b.test', 'https://ornek.test/'), null);
  assert.equal(resolveUrl('tel:+905550000000', 'https://ornek.test/'), null);
  assert.equal(resolveUrl('#bolum', 'https://ornek.test/'), null);
  assert.equal(resolveUrl('/hizmetler', 'https://ornek.test/a/b'), 'https://ornek.test/hizmetler');
});

test('registrableDomain: iki seviyeli TR uzantılarını doğru işler', () => {
  assert.equal(registrableDomain('https://www.ornek.com.tr/a'), 'ornek.com.tr');
  assert.equal(registrableDomain('https://alt.ornek.com.tr/a'), 'ornek.com.tr');
  assert.equal(registrableDomain('https://dublaj.resvido.com/a'), 'resvido.com');
});

test('sameSite: alt alan adı aynı siteye sayılır', () => {
  assert.ok(sameSite('https://dublaj.resvido.com/a', 'https://resvido.com/b'));
  assert.ok(!sameSite('https://baska.test/a', 'https://resvido.com/b'));
});

test('hasRawTurkishChars: kodlanmış ve kodlanmamış Türkçe karakteri yakalar', () => {
  assert.ok(hasRawTurkishChars('https://ornek.test/fiyatları'));
  assert.ok(hasRawTurkishChars('https://ornek.test/fiyatlar%C4%B1'));
  assert.ok(!hasRawTurkishChars('https://ornek.test/fiyatlar'));
});

test('hasUppercaseOrUnderscore', () => {
  assert.ok(hasUppercaseOrUnderscore('https://ornek.test/Hizmetler'));
  assert.ok(hasUppercaseOrUnderscore('https://ornek.test/reklam_seslendirme'));
  assert.ok(!hasUppercaseOrUnderscore('https://ornek.test/reklam-seslendirme'));
});

test('looksNonHtml: varlık uzantılarını ayırır', () => {
  assert.ok(looksNonHtml('https://ornek.test/gorsel/a.webp'));
  assert.ok(looksNonHtml('https://ornek.test/dosya.pdf'));
  assert.ok(!looksNonHtml('https://ornek.test/hizmetler'));
});

test('pathDepth / stripWww / withoutTrailingSlash', () => {
  assert.equal(pathDepth('https://ornek.test/a/b/c'), 3);
  assert.equal(pathDepth('https://ornek.test/'), 0);
  assert.equal(stripWww('www.ornek.test'), 'ornek.test');
  assert.equal(withoutTrailingSlash('https://ornek.test/a/'), 'https://ornek.test/a');
  assert.equal(withoutTrailingSlash('https://ornek.test/'), 'https://ornek.test/');
});
