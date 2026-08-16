// Panelin kendisini gerçek tarayıcıda uçtan uca sürer.
//
// `panel.test.mjs` motorun tarayıcıda doğru çalıştığını doğrular; bu dosya
// arayüzün gerçekten kullanılabildiğini: kaynak yapıştırılıyor mu, düğme
// çalışıyor mu, sonuçlar basılıyor mu, tema token'ları her iki temada da
// okunabilir renk veriyor mu.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const PANEL = path.join(here, '..', '..', 'panel', 'dist', 'index.html');
const FIXTURE = path.join(here, 'fixtures', 'site', 'hizmetler.html');

let browser;

async function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const candidates = [
    process.env.CHROMIUM_PATH,
    base && path.join(base, 'chromium-1194', 'chrome-linux', 'chrome'),
    base && path.join(base, 'chromium', 'chrome-linux', 'chrome'),
    '/usr/bin/chromium', '/usr/bin/google-chrome'
  ].filter(Boolean);
  for (const c of candidates) {
    try { await access(c); return c; } catch { /* sıradaki */ }
  }
  try { return chromium.executablePath(); } catch { return null; }
}

// Yer iminin hangi kipte üretildiği protokole ve çerçeveye bağlı, bu yüzden
// paneli `file://` dışında gerçek bir http adresinden de servis etmek gerekiyor.
let server;
let origin;

before(async () => {
  const exe = await findChromium();
  if (exe) {
    try { browser = await chromium.launch({ executablePath: exe }); } catch { browser = null; }
  }

  const html = await readFile(PANEL, 'utf8');
  server = createServer((req, res) => {
    if (req.url.startsWith('/frame')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><meta charset="utf-8"><title>gomulu</title>'
        + '<iframe src="/index.html" width="900" height="700" style="border:0"></iframe>');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
});

function guard(t) {
  if (!browser) { t.skip('Chromium bulunamadı — panel arayüzü doğrulanamadı'); return true; }
  return false;
}

/** Paneli açar, konsol hatalarını toplar. */
async function openPanel(colorScheme = 'light', hash = '') {
  const page = await browser.newPage({ colorScheme });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`file://${PANEL}${hash}`);
  return { page, errors };
}

/** Yer iminin ürettiği yükü Node tarafında taklit eder: gzip + base64url. */
function captureFragment(html, url) {
  const data = gzipSync(Buffer.from(html, 'utf8'))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `#seo=${data}&u=${encodeURIComponent(url)}`;
}

test('panel hatasız yükleniyor ve motoru bildiriyor', async (t) => {
  if (guard(t)) return;
  const { page, errors } = await openPanel();
  const tag = await page.textContent('#engineTag');
  assert.match(tag, /^\d+ kural$/, `motor etiketi: ${tag}`);
  const foot = await page.textContent('#footEngine');
  assert.match(foot, /katalog [0-9a-f]{16}/, 'katalog parmak izi basılmalı');
  assert.deepEqual(errors, [], 'konsolda hata olmamalı');
  await page.close();
});

test('kaynak yapıştırılınca denetim çalışıyor ve sonuç basılıyor', async (t) => {
  if (guard(t)) return;
  const { page, errors } = await openPanel();
  const html = await readFile(FIXTURE, 'utf8');

  await page.fill('#u1', 'https://ornek.test/hizmetler');
  await page.fill('#h1', html);
  assert.equal(await page.isDisabled('#run'), false, 'kaynak girilince düğme açılmalı');

  await page.click('#run');
  await page.waitForSelector('#results:not([hidden]) .summary');

  const score = (await page.textContent('.score-num')).trim();
  assert.match(score, /^\d+$/, `skor sayısal olmalı: ${score}`);

  const findings = await page.$$('.finding');
  assert.ok(findings.length > 0, 'sorunlu fixture bulgu üretmeli');

  // Fixture'a bilinçli konulan sorunlar arayüzde görünmeli.
  const ids = await page.$$eval('.f-id', (els) => els.map((e) => e.textContent));
  for (const expected of ['h1-count', 'img-missing-alt', 'meta-description-missing']) {
    assert.ok(ids.includes(expected), `${expected} listede olmalı — gelen: ${ids.join(', ')}`);
  }

  // Dürüstlük şeridi görünmeli.
  const notice = await page.textContent('.notice-strip');
  assert.match(notice, /Yanıt başlıkları yok/);

  assert.deepEqual(errors, [], 'konsolda hata olmamalı');
  await page.close();
});

test('geçersiz girdi arayüzü çökertmiyor, hatayı gösteriyor', async (t) => {
  if (guard(t)) return;
  const { page } = await openPanel();
  await page.fill('#u1', 'bu-url-degil');
  await page.fill('#h1', '<html><body>x</body></html>');
  await page.click('#run');
  const msg = await page.textContent('#error');
  assert.match(msg, /Denetim yapılamadı/);
  assert.equal(await page.isVisible('#results'), false, 'hata durumunda sonuç gösterilmemeli');
  await page.close();
});

test('her iki temada da metin zeminden ayrışıyor', async (t) => {
  if (guard(t)) return;
  // Bu testin sebebi: token'ı yalnızca media/[data-theme] içinde tanımlamak
  // damgasız (sistem) durumda rengi hiç uygulatmaz ve sayfa bir temanın
  // metnini diğerinin zemininde gösterir.
  for (const scheme of ['light', 'dark']) {
    const { page } = await openPanel(scheme);
    const { bg, fg } = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return { bg: s.backgroundColor, fg: s.color };
    });
    assert.notEqual(bg, 'rgba(0, 0, 0, 0)', `${scheme}: body arka planı şeffaf olmamalı`);
    assert.notEqual(bg, fg, `${scheme}: metin ve zemin aynı renk olmamalı`);

    const lum = (c) => {
      const [r, g, b] = c.match(/\d+/g).map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    };
    assert.ok(Math.abs(lum(bg) - lum(fg)) > 0.4,
      `${scheme}: metin/zemin parlaklık farkı yetersiz (${bg} / ${fg})`);
    await page.close();
  }
});

test('güvenlik skoru kapsamını gizlemiyor', async (t) => {
  if (guard(t)) return;
  // Gerçek bir koşuda ortaya çıktı: yanıt başlığı olmadan 11 güvenlik
  // kuralının 10'u çalışmaz, kalan tek kuraldan gelen "100/100" ise
  // başlıklar sağlammış gibi okunuyordu. Kapsam her zaman yazılmalı.
  const { page } = await openPanel();
  const html = '<!doctype html><html lang="tr"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width">'
    + '<title>Yeterince uzun bir başlık buraya yazıldı</title>'
    + '<script src="https://cdn.baska.test/a.js"><\/script></head>'
    + '<body><main><h1>Baş</h1><p>içerik</p></main></body></html>';

  await page.fill('#u1', 'https://ornek.test/a');
  await page.fill('#h1', html);
  await page.click('#run');
  await page.waitForSelector('.sep-note');

  // textContent satır sonlarını korur; şablon çok satırlı olduğu için
  // eşleştirmeden önce boşluklar tekilleştirilir.
  const notes = await page.$$eval('.sep-note',
    (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  const sec = notes.find((n) => n.includes('Güvenlik'));
  assert.ok(sec, 'güvenlik satırı basılmalı');
  assert.match(sec, /1\/11 kural/, 'kaç kuralın çalıştığı yazılmalı');
  assert.match(sec, /güvenlik başlıklarınızın sağlam olduğu anlamına gelmez/,
    'kısmi kapsamda açık uyarı olmalı');
  await page.close();
});

test('yer imi fragmanı sayfayı doldurup denetimi kendiliğinden başlatıyor', async (t) => {
  if (guard(t)) return;
  const html = await readFile(FIXTURE, 'utf8');
  const { page, errors } = await openPanel('light', captureFragment(html, 'https://ornek.test/hizmetler'));

  // Denetim kullanıcı hiçbir düğmeye basmadan koşmalı.
  await page.waitForSelector('#results:not([hidden]) .summary');
  assert.equal(await page.inputValue('#u1'), 'https://ornek.test/hizmetler');
  assert.ok((await page.inputValue('#h1')).length > 100, 'kaynak karta yazılmalı');
  assert.match(await page.textContent('#intakeStatus'), /Sayfa yakalandı/);

  // Fragman adres çubuğunda kalmamalı: hem çok uzun hem yenilemede tekrar koşar.
  assert.equal(await page.evaluate(() => location.hash), '', 'fragman temizlenmeli');

  assert.deepEqual(errors, [], 'konsolda hata olmamalı');
  await page.close();
});

test('bozuk fragman paneli çökertmiyor', async (t) => {
  if (guard(t)) return;
  const { page, errors } = await openPanel('light', '#seo=bu-gzip-degil&u=https%3A%2F%2Fornek.test%2F');
  await page.waitForFunction(() => document.getElementById('intakeStatus').textContent.trim() !== '');
  assert.match(await page.textContent('#intakeStatus'), /çözülemedi/);
  assert.equal(await page.isVisible('#results'), false, 'sonuç bölümü açılmamalı');
  assert.deepEqual(errors, [], 'konsolda hata olmamalı');
  await page.close();
});

test('dosya seçmek kartları dolduruyor, adres kaynaktan okunuyor', async (t) => {
  if (guard(t)) return;
  const { page, errors } = await openPanel();
  const html = await readFile(FIXTURE, 'utf8');

  await page.setInputFiles('#fileInput', [
    { name: 'hizmetler.html', mimeType: 'text/html', buffer: Buffer.from(html) },
    {
      name: 'iletisim.html',
      mimeType: 'text/html',
      buffer: Buffer.from('<!doctype html><html lang="tr"><head><meta charset="utf-8">'
        + '<link rel="canonical" href="https://ornek.test/iletisim">'
        + '<title>İletişim sayfası başlığı buraya</title></head>'
        + '<body><main><h1>İletişim</h1><p>metin</p></main></body></html>')
    }
  ]);

  await page.waitForFunction(() => document.querySelectorAll('.page-card').length >= 2);
  assert.match(await page.textContent('#intakeStatus'), /2 sayfa eklendi/);
  // İkinci dosyada canonical var; adres elle yazılmadan dolmalı.
  assert.equal(await page.inputValue('#u2'), 'https://ornek.test/iletisim');
  assert.deepEqual(errors, [], 'konsolda hata olmamalı');
  await page.close();
});

test('gerçek adreste yer imi geçerli JavaScript ve panel adresini taşıyor', async (t) => {
  if (guard(t)) return;
  const page = await browser.newPage();
  await page.goto(`${origin}/index.html`);
  const href = await page.getAttribute('#bmk', 'href');
  assert.ok(href.startsWith('javascript:'), `javascript: URL olmalı: ${href.slice(0, 40)}`);

  // Tarayıcının URL'yi çözdüğü gibi çözüp ayrıştırılabilirliğini doğrula.
  const body = decodeURIComponent(href.slice('javascript:'.length));
  assert.ok(!body.includes('#'), 'ham # fragman sayılıp kodu keser');
  assert.match(body, /CompressionStream/, 'gerçek adreste tek-tık kipi üretilmeli');
  assert.ok(body.includes(`${origin}/index.html`), 'panel adresi gömülü olmalı');
  await page.evaluate((src) => { new Function(src); }, body); // ayrıştırılamazsa atar

  // Panelde tıklanırsa çalışmaz; kullanıcı yönlendirilir ve öğretici açılır.
  await page.click('#bmk');
  assert.match(await page.textContent('#intakeStatus'), /yer imi çubuğuna sürüklenir/);
  assert.equal(await page.evaluate(() => document.getElementById('bmkHow').open), true,
    'tıklayan kişiye kurulum adımları gösterilmeli');
  await page.close();
});

test('kurulum öğreticisi adımları ve çizimi gösteriyor', async (t) => {
  if (guard(t)) return;
  // Kullanıcı "ne yapacağımı anlamadım" dedi: yer imi çubuğunun ne olduğu ve
  // sürüklemenin nasıl yapılacağı panelin içinde yazmalı, dışarıda değil.
  const { page, errors } = await openPanel();
  assert.equal(await page.isVisible('.steps'), true, 'dosya yolu adımları en başta görünmeli');

  await page.click('#bmkHow > summary');
  const how = (await page.textContent('#bmkHow')).replace(/\s+/g, ' ');
  assert.match(how, /Ctrl\+Shift\+B/, 'yer imi çubuğunun nasıl açılacağı yazmalı');
  assert.match(how, /basılı tutun/, 'sürüklemenin nasıl yapıldığı yazmalı');
  assert.equal(await page.isVisible('.bmk-fig svg'), true, 'sürükleme çizimi görünmeli');
  assert.ok((await page.getAttribute('.bmk-fig svg', 'aria-label')).length > 20,
    'çizimin metin karşılığı olmalı');

  assert.deepEqual(errors, [], 'konsolda hata olmamalı');
  await page.close();
});

test('sürükleme tutmayanlar için kod kopyalanabiliyor', async (t) => {
  if (guard(t)) return;
  const page = await browser.newPage({ permissions: ['clipboard-read', 'clipboard-write'] });
  await page.goto(`file://${PANEL}`);
  await page.click('#bmkHow > summary');
  await page.click('#copyBmk');

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(copied.startsWith('javascript:'), `panoya yer imi kodu yazılmalı: ${copied.slice(0, 30)}`);
  assert.match(await page.textContent('#intakeStatus'), /Ctrl\+D/);
  await page.close();
});

test('panel bir çerçeve içindeyse yer imi pano kipine düşüyor', async (t) => {
  if (guard(t)) return;
  // Claude'un penceresi paneli iframe içinde çalıştırır; orada `location.href`
  // sandbox adresidir ve yer imi o adrese dönemez. Panele dönmeye çalışmak
  // yerine sayfayı panoya kopyalamalı — yoksa yer imi hiçbir işe yaramaz.
  const page = await browser.newPage();
  await page.goto(`${origin}/frame`);
  const frame = page.frames().find((f) => f !== page.mainFrame());
  await frame.waitForSelector('#bmk');

  const href = await frame.getAttribute('#bmk', 'href');
  const body = decodeURIComponent(href.slice('javascript:'.length));
  assert.match(body, /clipboard\.writeText/, 'çerçeve içinde pano kipi üretilmeli');
  assert.ok(!body.includes('seo='), 'panele dönüş adresi gömülmemeli');

  assert.match((await frame.textContent('#intakeStatus')).replace(/\s+/g, ' '),
    /panoya kopyalar/, 'kullanıcıya ne olacağı baştan söylenmeli');
  await page.close();
});

test('sayfa yatay kaymıyor', async (t) => {
  if (guard(t)) return;
  const { page } = await openPanel();
  await page.setViewportSize({ width: 380, height: 800 });
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `dar ekranda yatay taşma var: ${overflow}px`);
  await page.close();
});
