// Kural kaydı.
//
// Statik barrel kullanılır, dosya sistemi taraması DEĞİL. Nedeni: yanlış
// yazılmış bir dosya adı sessizce kuralı düşürüp skoru şişirmek yerine import
// anında patlar. Ayrıca kural sırası deterministik olur — aynı site iki kez
// denetlendiğinde rapor birebir aynı sırayla üretilir.

import { buildRegistry } from '../lib/rules.mjs';

import technical from './technical.mjs';
import onpage from './onpage.mjs';
import structuredData from './structured-data.mjs';
import performance from './performance.mjs';
import i18n from './i18n.mjs';
import aiSearch from './ai-search.mjs';
import links from './links.mjs';
import media from './media.mjs';
import security from './security.mjs';

export const registry = buildRegistry([
  technical, onpage, structuredData, performance, i18n, aiSearch, links, media, security
]);

export default registry;
