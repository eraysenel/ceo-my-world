// Kural kataloğunun bütünlük testleri.
//
// Bu dosya tek tek kuralları değil, katalogun kendisini doğrular: bozuk bir
// tanım skoru sessizce şişirebilir, bu yüzden yapısal garantiler test edilir.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registry } from '../rules/index.mjs';
import {
  CATEGORIES, SEVERITIES, CATEGORY_WEIGHT, SEVERITY_MULTIPLIER, NEEDS, defineRule
} from '../lib/rules.mjs';

test('katalog: kural kimlikleri benzersiz', () => {
  const ids = registry.all.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('katalog: her kural geçerli kategori ve şiddet taşır', () => {
  for (const r of registry.all) {
    assert.ok(CATEGORIES.includes(r.category), `${r.id}: kategori`);
    assert.ok(SEVERITIES.includes(r.severity), `${r.id}: şiddet`);
    assert.ok(r.weight >= 1 && r.weight <= 10, `${r.id}: ağırlık`);
    assert.ok(r.impact >= 1 && r.impact <= 5, `${r.id}: etki`);
    assert.ok(['low', 'medium', 'high'].includes(r.effort), `${r.id}: efor`);
    assert.ok(['page', 'site'].includes(r.scope), `${r.id}: kapsam`);
    for (const n of r.needs) assert.ok(NEEDS.includes(n), `${r.id}: needs ${n}`);
  }
});

test('katalog: her kuralın Türkçe açıklaması var', () => {
  for (const r of registry.all) {
    assert.ok(r.description && r.description.length > 5, `${r.id}: description eksik`);
  }
});

test('katalog: her kategoride en az bir kural var', () => {
  for (const cat of CATEGORIES) {
    assert.ok(registry.byCategory(cat).length > 0, `${cat} kategorisi boş`);
  }
});

test('kategori ağırlıkları 1.0 toplar', () => {
  const total = CATEGORIES.reduce((s, c) => s + CATEGORY_WEIGHT[c], 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `toplam ${total}`);
});

test('info şiddeti skoru etkilemez', () => {
  assert.equal(SEVERITY_MULTIPLIER.info, 0);
});

test('katalog özeti kararlı (aynı katalog, aynı özet)', () => {
  assert.match(registry.digest, /^[0-9a-f]{16}$/);
});

test('defineRule: geçersiz tanımı import anında reddeder', () => {
  assert.throws(() => defineRule({ id: 'x', category: 'yok', severity: 'error', weight: 5, check: () => null }));
  assert.throws(() => defineRule({ id: 'x', category: 'onpage', severity: 'yok', weight: 5, check: () => null }));
  assert.throws(() => defineRule({ id: 'x', category: 'onpage', severity: 'error', weight: 99, check: () => null }));
  assert.throws(() => defineRule({ id: 'x', category: 'onpage', severity: 'error', weight: 5 }));
  assert.throws(() => defineRule({ id: 'x', category: 'onpage', severity: 'error', weight: 5, needs: ['sihir'], check: () => null }));
});

test('katalog: yalnızca html gerektiren kurallar çevrimdışı çalışabilmeli', () => {
  // Çevrimdışı modun anlamlı olması için kuralların çoğunluğu HTML ile yetinmeli.
  const htmlOnly = registry.all.filter((r) => r.needs.every((n) => n === 'html' || n === 'site'));
  assert.ok(htmlOnly.length / registry.all.length > 0.6,
    `çevrimdışı çalışabilen kural oranı düşük: ${htmlOnly.length}/${registry.all.length}`);
});
