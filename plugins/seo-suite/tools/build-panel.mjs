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
${body.slice(0, cut).trim()}
</head>
<body>
${body.slice(cut).trim()}
</body>
</html>
`;

await writeFile(path.join(DIST, 'index.html'), standalone, 'utf8');

const kb = (s) => `${Math.round(Buffer.byteLength(s, 'utf8') / 1024)} KB`;
console.log(`paket        ${kb(bundle)}`);
console.log(`artifact.html ${kb(body)}`);
console.log(`index.html    ${kb(standalone)}`);
