// AI aramada görünürlük kuralları.
//
// DURUŞ: Google 15 Mayıs 2026'da GEO/AEO'nun ayrı bir disiplin OLMADIĞINI,
// llms.txt'in Google Arama'da özel işlenmediğini açıkladı. Bu yüzden buradaki
// kurallar "AI SEO" pazarlamasını tekrarlamaz. Ölçtükleri şey, bir AI
// sisteminin sayfayı okuyup alıntılayabilmesi için gereken somut koşullardır:
// içeriğin sunucudan gelmesi, tarayıcının erişebilmesi, sorunun doğrudan
// yanıtlanması. Bunların hepsi zaten klasik SEO'nun da gereğidir.

import { defineRule } from '../lib/rules.mjs';

/** Türkçe soru işaretleyicileri. */
const QUESTION_MARKERS = /(\?|\bne\b|\bnasıl\b|\bneden\b|\bkaç\b|\bhangi\b|\bnedir\b|\bmı\b|\bmi\b|\bmu\b|\bmü\b)/i;

export default [
  defineRule({
    id: 'ai-crawler-blocked',
    category: 'ai-search', scope: 'site', severity: 'warning',
    weight: 5, impact: 3, effort: 'low', needs: ['net'],
    description: 'robots.txt AI tarayıcılarını engelliyor',
    appliesTo: (site) => site.robots.found,
    check: (site, _site, ctx) => {
      const blocked = site.robots.blockedAiAgents;
      if (blocked.length === 0) return null;
      return ctx.fail({
        evidence: { blocked },
        message: `robots.txt şu AI tarayıcılarını engelliyor: ${blocked.join(', ')}`,
        fix: 'Bu bilinçli bir tercih olabilir — içeriğin model eğitiminde kullanılmasını istemiyor olabilirsiniz ve bu meşru bir karardır. Ancak ChatGPT, Claude veya Perplexity yanıtlarında görünmek hedefse ilgili ajanlara izin verilmelidir. Bir hata değil, bir politika kararıdır; bilinçli olduğundan emin olun.'
      });
    }
  }),

  defineRule({
    id: 'llms-txt-missing',
    category: 'ai-search', scope: 'site', severity: 'notice',
    weight: 4, impact: 2, effort: 'low', needs: ['net'],
    description: '/llms.txt yok',
    check: (site, _site, ctx) => {
      if (site.wellKnown.llmsTxt) return null;
      return ctx.fail({
        evidence: {},
        message: 'Sitede /llms.txt dosyası yok.',
        fix: 'DÜŞÜK ÖNCELİK. Google 2026\'da llms.txt\'i özel olarak işlemediğini açıkça belirtti; bu dosya sıralamaya etki etmez. Bazı AI araçları için yararlı olabilir ama gerçek kazanç sunucu tarafında render edilmiş, iyi yapılandırılmış içerikten gelir — önce onu halledin.'
      });
    }
  }),

  defineRule({
    id: 'content-server-rendered',
    category: 'ai-search', scope: 'page', severity: 'warning',
    weight: 7, impact: 4, effort: 'high', needs: ['html'],
    description: 'İçerik HTML kaynağında yok',
    appliesTo: (page) => page.ok && page.head.metaRobots.index,
    check: (page, site, ctx) => {
      if (!page.flags.spaSuspect) return null;
      return ctx.fail({
        evidence: { mainWords: page.content.mainWordCount, domNodes: page.content.domNodeCount },
        message: `HTML kaynağında yalnızca ${page.content.mainWordCount} kelime içerik var; gerisi tarayıcıda üretiliyor gibi görünüyor.`,
        fix: 'İçeriği sunucu tarafında üretin. Googlebot JavaScript çalıştırır ama bunu ikinci bir dalgada yapar; AI tarayıcılarının çoğu ise hiç çalıştırmaz. Kaynakta olmayan içerik, o sistemler için var değildir.'
      });
    }
  }),

  defineRule({
    id: 'answerable-summary-missing',
    category: 'ai-search', scope: 'page', severity: 'notice',
    weight: 5, impact: 3, effort: 'low', needs: ['html'],
    description: 'Başlığın hemen altında doğrudan cevap yok',
    appliesTo: (page) => page.ok && page.head.metaRobots.index && page.content.mainWordCount >= 300,
    check: (page, site, ctx) => {
      const p = page.content.firstParagraph;
      if (p && p.length >= 80 && p.length <= 400) return null;
      return ctx.fail({
        evidence: { firstParagraphLength: p?.length ?? 0 },
        message: p
          ? `İlk paragraf ${p.length} karakter — özet olarak alıntılanmaya uygun değil.`
          : 'Sayfada başlığın altında özet niteliğinde bir paragraf yok.',
        fix: 'H1\'in hemen altına, sayfanın ana sorusunu 2-3 cümlede doğrudan yanıtlayan bir paragraf koyun. Hem AI özetlerinde alıntılanan hem de öne çıkan snippet olarak seçilen genelde bu bloktur.'
      });
    }
  }),

  defineRule({
    id: 'faq-block-missing',
    category: 'ai-search', scope: 'page', severity: 'notice',
    weight: 5, impact: 3, effort: 'medium', needs: ['html'],
    description: 'Hizmet/fiyat sayfasında soru-cevap bloğu yok',
    appliesTo: (page) => page.ok && page.head.metaRobots.index &&
      /(hizmet|fiyat|paket|dublaj|seslendirme|service|pricing)/i.test(page.url) &&
      page.content.mainWordCount >= 250,
    check: (page, site, ctx) => {
      const questionHeadings = page.headings.tree.filter((h) => h.level >= 2 && QUESTION_MARKERS.test(h.text));
      if (questionHeadings.length >= 2 || page.jsonld.types.includes('FAQPage')) return null;
      return ctx.fail({
        evidence: { questionHeadings: questionHeadings.length, headings: page.headings.tree.length },
        message: 'Hizmet sayfasında soru biçiminde başlık veya SSS bloğu yok.',
        fix: 'Müşterilerin gerçekten sorduğu soruları başlık yapın ("Reklam seslendirme ne kadar sürer?") ve altına kısa net cevap yazın. Arama sorgularının çoğu soru biçimindedir; başlık ile sorgunun birebir eşleşmesi alıntılanma olasılığını artırır.'
      });
    }
  }),

  defineRule({
    id: 'content-freshness-missing',
    category: 'ai-search', scope: 'page', severity: 'notice',
    weight: 4, impact: 2, effort: 'low', needs: ['html'],
    description: 'Güncellenme tarihi belirtilmemiş',
    appliesTo: (page) => page.ok && page.head.metaRobots.index && page.content.mainWordCount >= 500,
    check: (page, site, ctx) => {
      const hasSchemaDate = page.jsonld.blocks.some((b) =>
        b.raw && /"date(Modified|Published)"/.test(b.raw));
      const hasVisibleDate = /\b(20\d{2})\b/.test(page.content.mainText.slice(0, 1200)) ||
        /(güncelleme|güncellendi|yayınlanma)/i.test(page.content.mainText);
      if (hasSchemaDate || hasVisibleDate) return null;
      return ctx.fail({
        evidence: { words: page.content.mainWordCount },
        message: 'Uzun içerikte ne görünür bir tarih ne de dateModified/datePublished var.',
        fix: 'Görünür bir güncellenme tarihi ve şemada dateModified ekleyin. Tazelik, hem sıralamada hem de AI sistemlerinin hangi kaynağı alıntılayacağı seçiminde kullanılan bir sinyaldir.'
      });
    }
  }),

  defineRule({
    id: 'heading-question-form',
    category: 'ai-search', scope: 'page', severity: 'info',
    weight: 2, impact: 2, effort: 'low', needs: ['html'],
    description: 'Uzun içerikte hiç soru biçimli başlık yok',
    appliesTo: (page) => page.ok && page.content.mainWordCount >= 800,
    check: (page, site, ctx) => {
      const questions = page.headings.tree.filter((h) => h.level >= 2 && QUESTION_MARKERS.test(h.text));
      if (questions.length >= Math.floor(page.content.mainWordCount / 800)) return null;
      return ctx.fail({
        evidence: { words: page.content.mainWordCount, questionHeadings: questions.length },
        message: `${page.content.mainWordCount} kelimelik içerikte yalnızca ${questions.length} soru biçimli başlık var.`,
        fix: 'Alt başlıkların bir kısmını kullanıcıların yazdığı soru biçimine çevirin. (Bilgi amaçlı bulgu — skoru etkilemez.)'
      });
    }
  }),

  defineRule({
    id: 'toc-missing',
    category: 'ai-search', scope: 'page', severity: 'info',
    weight: 2, impact: 2, effort: 'low', needs: ['html'],
    description: 'Çok uzun içerikte sayfa içi gezinme yok',
    appliesTo: (page) => page.ok && page.content.mainWordCount >= 1500,
    check: (page, site, ctx) => {
      const anchors = page.links.filter((l) => l.href?.startsWith('#'));
      if (anchors.length >= 3) return null;
      return ctx.fail({
        evidence: { words: page.content.mainWordCount, anchors: anchors.length },
        message: `${page.content.mainWordCount} kelimelik sayfada içindekiler bağlantısı yok.`,
        fix: 'Uzun içeriklere içindekiler ekleyin. Hem kullanıcı hem de arama sonucunda "sayfaya atla" bağlantıları için yararlıdır. (Bilgi amaçlı bulgu — skoru etkilemez.)'
      });
    }
  })
];
