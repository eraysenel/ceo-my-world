#!/usr/bin/env node
// Panel derleyicisi.
//
// Kural motorunu tarayıcı için paketler ve şablona gömer. İki çıktı üretir:
//
//   dist/index.html     Tam, tek dosyalık sayfa — çift tıklayıp açılır.
//   dist/artifact.html  Aynı içerik, <html>/<head>/<body> iskeleti olmadan —
//                       Artifact olarak yayınlanırken iskelet dışarıdan sarılır,
//                       kendi iskeletimizi koyarsak iç içe geçer.
//
// Paket satır içine gömülür: Artifact'in içerik güvenlik politikası dış
// kaynaklara istek atmayı engelliyor, yani harici .js dosyası çalışmaz.

import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PANEL = path.join(here, '..', 'panel');
const SRC = path.join(PANEL, 'src');
const DIST = path.join(PANEL, 'dist');

const result = await build({
  entryPoints: [path.join(SRC, 'analyze.mjs')],
  bundle: true,
  format: 'iife',
  globalName: 'SeoAudit',
  minify: true,
  platform: 'browser',
  write: false,
  legalComments: 'none'
});

const bundle = result.outputFiles[0].text;
const template = await readFile(path.join(SRC, 'index.html'), 'utf8');

if (!template.includes('/*BUNDLE*/')) {
  throw new Error('Şablonda /*BUNDLE*/ yer tutucusu yok.');
}

// `</script>` dizisi satır içi betiği erken kapatır. Paket içinde bir dize
// olarak geçerse sayfa sessizce bozulur; bu yüzden kaçırılır.
const safeBundle = bundle.replace(/<\/script>/gi, '<\\/script>');
const body = template.replace('/*BUNDLE*/', () => safeBundle);

await mkdir(DIST, { recursive: true });

// Ham paket: panel testleri bunu doğrudan tarayıcıya enjekte eder ve motoru
// panelden bağımsız kullanmak isteyen için de tek dosyalık giriş noktasıdır.
await writeFile(path.join(DIST, 'seo-audit.bundle.js'), bundle, 'utf8');

// Artifact sürümü: iskelet yok.
await writeFile(path.join(DIST, 'artifact.html'), body, 'utf8');

// Bağımsız sürüm: <title> + <style> head'e, kalanı body'ye.
const styleEnd = body.indexOf('</style>');
if (styleEnd === -1) throw new Error('Şablonda </style> bulunamadı; iskelet bölünemiyor.');
const cut = styleEnd + '</style>'.length;

const standalone = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ctext y='13' font-size='13'%3E%F0%9F%94%8D%3C/text%3E%3C/svg%3E">
${body.slice(0, cut).trim()}
</head>
<body>
${body.slice(cut).trim()}
</body>
</html>
`;

await writeFile(path.join(DIST, 'index.html'), standalone, 'utf8');

// ---------------------------------------------------------------------------
// Yayın başlıkları (Netlify `_headers`).
//
// Panelin bütün kodu satır içi: paket de arayüz de <script> bloğunun içinde,
// biçimlendirme <style> içinde. Katı bir CSP'nin tek yolu bu blokların
// SHA-256 özetlerini beyaz listeye almak — 'unsafe-inline' yazmak, güvenlik
// başlıklarını denetleyen bir araçta kendi kuralımızı (csp-unsafe) çiğnemek
// olurdu. Özetler her derlemede yeniden hesaplanır: kod değişip başlık eskirse
// panel canlıda sessizce açılmaz, bu yüzden ikisi tek yerden üretilir.
// ---------------------------------------------------------------------------

const sha256 = (text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

/** Satır içi blokların içeriğini (etiketler hariç) özetler. */
function inlineHashes(html, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi');
  return [...html.matchAll(re)].map((m) => sha256(m[1]));
}

const scriptHashes = inlineHashes(standalone, 'script');
const styleHashes = inlineHashes(standalone, 'style');
if (scriptHashes.length !== 2 || styleHashes.length !== 1) {
  throw new Error(
    `Beklenen satır içi blok sayısı tutmuyor (script ${scriptHashes.length}/2, `
    + `style ${styleHashes.length}/1). CSP özetleri yanlış olur; şablon değiştiyse burası da güncellenmeli.`
  );
}

// connect-src yok: panel hiçbir ağ isteği atmaz. Blob akışları ve
// DecompressionStream ağ değildir, CSP'ye takılmaz.
const csp = [
  "default-src 'none'",
  `script-src ${scriptHashes.join(' ')}`,
  `style-src ${styleHashes.join(' ')}`,
  "img-src 'self' data:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ');

const headers = `# Bu dosya derleme sırasında üretilir — elle düzenlemeyin.
# Kaynağı: tools/build-panel.mjs. CSP özetleri satır içi bloklardan hesaplanır.

/*
  Content-Security-Policy: ${csp}
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), camera=(), microphone=(), browsing-topics=()
  Cross-Origin-Opener-Policy: same-origin
`;

await writeFile(path.join(DIST, '_headers'), headers, 'utf8');

const kb = (s) => `${Math.round(Buffer.byteLength(s, 'utf8') / 1024)} KB`;
console.log(`paket        ${kb(bundle)}`);
console.log(`artifact.html ${kb(body)}`);
console.log(`index.html    ${kb(standalone)}`);
console.log(`_headers      CSP ${scriptHashes.length} betik + ${styleHashes.length} biçim özeti`);
