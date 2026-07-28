// core/page-renderers.js
// render-core.js içindeki RENDERERS tablosu (ozet -> 'renderOzet' gibi) sayfa
// id'sini bir FONKSİYON İSMİ (string) olarak tutuyor ve o ismi eskiden
// `window[name]` ile dinamik olarak fonksiyona çeviriyordu. Bu, gerçek
// `import`larla birebir değiştirilemeyecek tek desendi (isim runtime'da
// string olarak geliyor), bu yüzden burada açık bir isim -> fonksiyon
// registry'si tanımlanıyor. render-core.js artık window[name] yerine
// `pageRenderers[name]` kullanıyor.

import { renderOzet } from '@pages/ozet.js';
import { renderKartlar } from '@pages/kartlar/10-kart-liste.js';
import { renderIslemler } from '@pages/islemler/03-islem-liste-render.js';
import { renderExtreler } from '@pages/ekstreler/02-ekstre-render.js';
import { renderMevduat } from '@pages/mevduat/05-mevduat-liste-render.js';
import { renderHesaplar } from '@pages/hesaplar/04-hesap-liste-render.js';
import { renderKira } from '@pages/kira.js';
import { renderMaas } from '@pages/maas.js';
import { renderElden } from '@pages/elden.js';
import { renderKmhKredi } from '@pages/krediler/03-kmh-kredi.js';
import { renderKredi } from '@pages/krediler/04-bireysel-kredi.js';
import { renderTanimlamalar } from '@pages/tanimlamalar/02-ana-sayfa.js';
import { renderAbonelik } from '@pages/abonelik.js';

// stableRenderAll içinde ayrıca isimle çağrılan "hazırlık" fonksiyonları
import { loadCurrencyConfig } from '@pages/tanimlamalar/06-para-birimi.js';
import { populateKategoriSelects } from '@pages/tanimlamalar/03-kategoriler.js';
import { populateEldenHesapSelect, populateEldenKisiSelect } from '@pages/elden.js';
import { renderHesapTurFiltreler } from '@pages/hesaplar/04-hesap-liste-render.js';
import { provide, inject } from '@core/container.js';

// core.appCoreBase ve domain.doviz zaten container'da kayıtlı (Tur 3/4);
// dairesel bağımlılık riskine karşı inject() (tembel Proxy) ile çözülüyor.
const _domainDoviz = inject('domain.doviz');
const _appCoreBase = inject('core.appCoreBase');
const populateCurrencySelects = (...args) => _domainDoviz.populateCurrencySelects(...args);
const updateSidebarKartNav = (...args) => _appCoreBase.updateSidebarKartNav(...args);

export const pageRenderers = {
  renderOzet, renderKartlar, renderIslemler, renderExtreler, renderMevduat,
  renderHesaplar, renderKira, renderMaas, renderElden, renderKmhKredi,
  renderKredi, renderTanimlamalar, renderAbonelik,
  loadCurrencyConfig, populateCurrencySelects, populateKategoriSelects,
  populateEldenHesapSelect, populateEldenKisiSelect, renderHesapTurFiltreler,
  updateSidebarKartNav,
};

// ============================================================
// DUAL-MODE CONTAINER KAYDI (bkz. DI-MIGRATION.md)
// Bu dosyanın importları HENÜZ silinmedi (@pages/* katmanı henüz
// taşınmadı). Dışarıdaki tüketiciler artık resolve('core.pageRenderers')
// veya inject('core.pageRenderers') kullanabilir.
// ============================================================
provide('core.pageRenderers', { pageRenderers });
