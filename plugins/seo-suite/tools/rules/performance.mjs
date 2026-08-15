// Performans kuralları.
//
// Bu araç tarayıcı çalıştırmaz; dolayısıyla gerçek LCP/INP/CLS ÖLÇMEZ.
// Ölçtüğü şey, bu metrikleri bozduğu bilinen yapısal nedenlerdir. Rapor bu
// ayrımı açıkça yazar — "LCP 3.2sn" demek yerine "LCP adayı tembel yükleniyor"
// der. Gerçek alan verisi için Search Console / CrUX gerekir.

import { defineRule } from '../lib/rules.mjs';

export default [
  defineRule({
    id: 'render-blocking-css',
    category: 'performance', scope: 'page', severity: 'warning',
    weight: 7, impact: 4, effort: 'medium', needs: ['html'],
    description: '<head> içinde render engelleyen stil dosyası',
    appliesTo: (page) => page.ok,
    check: (page, site, ctx) => {
      const css = page.perf.renderBlockingCss;
      if (css.length <= 1) return null;
      return ctx.fail({
        evidence: { count: css.length, samples: css.slice(0, 5) },
        message: `<head> içinde ${css.length} render engelleyen stil dosyası var.`,
        fix: 'İlk ekranın stilini satır içine alın, kalanını ertelenmiş yükleyin. CSS render engelleyicidir: tarayıcı tüm stil dosyaları inene kadar tek piksel boyamaz.'
      });
    }
  }),

  defineRule({
    id: 'render-blocking-js',
    category: 'performance', scope: 'page', severity: 'warning',
    weight: 7, impact: 4, effort: 'low', needs: ['html'],
    description: '<head> içinde async/defer olmayan betik',
    appliesTo: (page) => page.ok,
    check: (page, site, ctx) => {
      const js = page.perf.renderBlockingJs;
      if (js.length === 0) return null;
      return ctx.fail({
        evidence: { count: js.length, samples: js.slice(0, 5) },
        message: `<head> içinde ${js.length} adet async/defer taşımayan betik var.`,
        fix: 'Betiklere defer ekleyin (veya type="module" kullanın). defer olmayan betik HTML ayrıştırmasını durdurur; sayfa indirilene kadar hiçbir şey görünmez.'
      });
    }
  }),

  defineRule({
    id: 'lcp-candidate-lazy',
    category: 'performance', scope: 'page', severity: 'error',
    weight: 8, impact: 5, effort: 'low', needs: ['html'],
    description: 'İlk ekrandaki büyük görsel tembel yükleniyor',
    appliesTo: (page) => page.ok && Boolean(page.perf.lcpCandidate),
    check: (page, site, ctx) => {
      const lcp = page.perf.lcpCandidate;
      if (lcp.loading !== 'lazy') return null;
      return ctx.fail({
        evidence: { src: lcp.src, loading: lcp.loading },
        message: `İlk görsel loading="lazy" ile yükleniyor: ${lcp.src}`,
        fix: 'İlk ekrandaki görselden lazy\'yi kaldırın ve fetchpriority="high" ekleyin. Bu görsel büyük olasılıkla LCP öğesidir; tembel yükleme onu doğrudan geciktirir.'
      });
    }
  }),

  defineRule({
    id: 'no-compression',
    category: 'performance', scope: 'page', severity: 'error',
    weight: 8, impact: 4, effort: 'low', needs: ['headers'],
    description: 'HTML sıkıştırılmadan gönderiliyor',
    appliesTo: (page) => page.ok && Object.keys(page.headers ?? {}).length > 0,
    check: (page, site, ctx) => {
      const enc = page.headers['content-encoding'] ?? '';
      if (/br|gzip|zstd|deflate/i.test(enc)) return null;
      if (page.bytes.html < 2048) return null; // çok küçük yanıtlarda sıkıştırma anlamsız
      return ctx.fail({
        evidence: { contentEncoding: enc || null, htmlBytes: page.bytes.html },
        message: `HTML sıkıştırılmadan gönderiliyor (${Math.round(page.bytes.html / 1024)} KB).`,
        fix: 'Sunucuda veya CDN\'de Brotli (tercihen) ya da gzip açın. Metin içerikte tipik olarak %70-80 boyut kazancı — TTFB ve LCP üzerinde en ucuz iyileştirme.'
      });
    }
  }),

  defineRule({
    id: 'ttfb-slow',
    category: 'performance', scope: 'page', severity: 'warning',
    weight: 6, impact: 4, effort: 'high', needs: ['headers'],
    description: 'Sunucu ilk baytı geç gönderiyor',
    appliesTo: (page) => page.ok && Number.isFinite(page.timing?.ttfbMs),
    check: (page, site, ctx) => {
      const ttfb = page.timing.ttfbMs;
      if (ttfb <= 800) return null;
      return ctx.fail({
        evidence: { ttfbMs: ttfb },
        message: `İlk bayta kadar geçen süre ${ttfb} ms (hedef < 800 ms).`,
        fix: 'Sunucu tarafı önbellek, CDN kenar önbelleği ve veritabanı sorgularını gözden geçirin. TTFB tüm diğer metriklerin tabanıdır: LCP hiçbir zaman TTFB\'den küçük olamaz. (Not: bu ölçüm tek bir denetim isteğidir, gerçek kullanıcı verisi değildir.)'
      });
    }
  }),

  defineRule({
    id: 'html-size-excessive',
    category: 'performance', scope: 'page', severity: 'warning',
    weight: 5, impact: 3, effort: 'medium', needs: ['html'],
    description: 'HTML belgesi çok büyük',
    appliesTo: (page) => page.ok,
    check: (page, site, ctx) => {
      const kb = Math.round(page.bytes.html / 1024);
      if (kb <= 250) return null;
      return ctx.fail({
        evidence: { kb },
        message: `HTML belgesi ${kb} KB (sıkıştırılmamış).`,
        fix: 'Satır içi veri, gereksiz işaretleme ve sayfada gösterilmeyen içerikleri ayıklayın. Büyük HTML hem indirmeyi hem ayrıştırmayı yavaşlatır.'
      });
    }
  }),

  defineRule({
    id: 'dom-node-count',
    category: 'performance', scope: 'page', severity: 'notice',
    weight: 4, impact: 3, effort: 'high', needs: ['html'],
    description: 'DOM çok kalabalık',
    appliesTo: (page) => page.ok,
    check: (page, site, ctx) => {
      const n = page.content.domNodeCount;
      if (n <= 1500) return null;
      return ctx.fail({
        evidence: { nodes: n },
        message: `Sayfada ${n} DOM öğesi var (eşik 1500).`,
        fix: 'İç içe sarmalayıcıları azaltın, uzun listeleri sayfalayın. Büyük DOM her stil ve düzen hesabını pahalılaştırır; INP\'yi doğrudan etkiler.'
      });
    }
  }),

  defineRule({
    id: 'inline-style-bloat',
    category: 'performance', scope: 'page', severity: 'notice',
    weight: 3, impact: 2, effort: 'medium', needs: ['html'],
    description: 'Satır içi stil bloğu çok büyük',
    appliesTo: (page) => page.ok,
    check: (page, site, ctx) => {
      const kb = Math.round(page.perf.inlineStyleBytes / 1024);
      if (kb <= 50) return null;
      return ctx.fail({
        evidence: { kb },
        message: `Satır içi <style> blokları toplam ${kb} KB.`,
        fix: 'Yalnızca ilk ekran için gereken kritik CSS satır içi olmalı (~14 KB). Gerisi önbelleklenebilir harici dosyaya taşınmalı; satır içi CSS her sayfa yüklemesinde yeniden indirilir.'
      });
    }
  }),

  defineRule({
    id: 'third-party-script-count',
    category: 'performance', scope: 'page', severity: 'warning',
    weight: 6, impact: 4, effort: 'medium', needs: ['html'],
    description: 'Çok sayıda üçüncü taraf betik kaynağı',
    appliesTo: (page) => page.ok,
    check: (page, site, ctx) => {
      const origins = page.perf.thirdPartyOrigins;
      if (origins.length <= 8) return null;
      return ctx.fail({
        evidence: { count: origins.length, origins: origins.slice(0, 10) },
        message: `Sayfa ${origins.length} farklı üçüncü taraf kaynağından betik yüklüyor.`,
        fix: 'Gerçekten gerekli olmayanları kaldırın, kalanları gecikmeli yükleyin. Her yeni kaynak DNS + TLS el sıkışması demektir ve ana iş parçacığını bloke eder.'
      });
    }
  }),

  defineRule({
    id: 'font-display-missing',
    category: 'performance', scope: 'page', severity: 'notice',
    weight: 4, impact: 3, effort: 'low', needs: ['html'],
    description: 'Web yazı tipinde font-display tanımı yok',
    appliesTo: (page) => page.ok && (page.perf.hasFontFace || page.perf.fontLinks.length > 0),
    check: (page, site, ctx) => {
      if (page.perf.hasFontDisplay) return null;
      return ctx.fail({
        evidence: { fontLinks: page.perf.fontLinks.slice(0, 3), hasFontFace: page.perf.hasFontFace },
        message: 'Web yazı tipi kullanılıyor ama font-display tanımlı değil.',
        fix: 'font-display: swap ekleyin (Google Fonts bağlantılarında &display=swap). Aksi hâlde yazı tipi inene kadar metin görünmez kalır — 3 saniyeye kadar boş sayfa.'
      });
    }
  }),

  defineRule({
    id: 'preconnect-missing',
    category: 'performance', scope: 'page', severity: 'notice',
    weight: 3, impact: 2, effort: 'low', needs: ['html'],
    description: 'Kritik üçüncü taraf kaynak için preconnect yok',
    appliesTo: (page) => page.ok && page.perf.thirdPartyOrigins.length > 0,
    check: (page, site, ctx) => {
      const preconnected = new Set(page.perf.preconnects.map((h) => {
        try { return new URL(h).hostname; } catch { return h; }
      }));
      const missing = page.perf.thirdPartyOrigins.filter((h) => !preconnected.has(h));
      if (missing.length === 0) return null;
      return ctx.fail({
        evidence: { missing: missing.slice(0, 5) },
        message: `${missing.length} üçüncü taraf kaynağa preconnect/dns-prefetch tanımlanmamış.`,
        fix: 'Kritik kaynaklar için <link rel="preconnect"> ekleyin. DNS + TCP + TLS el sıkışması tipik olarak 100-300 ms; preconnect bunu içerik gelmeden önce yapar.'
      });
    }
  })
];
