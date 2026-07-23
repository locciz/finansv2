// core/page-renderers.js
// render-core.js içindeki RENDERERS tablosu (ozet -> 'renderOzet' gibi) sayfa
// id'sini bir FONKSİYON İSMİ (string) olarak tutuyor ve o ismi eskiden
// `window[name]` ile dinamik olarak fonksiyona çeviriyordu. Bu, gerçek
// `import`larla birebir değiştirilemeyecek tek desendi (isim runtime'da
// string olarak geliyor), bu yüzden burada açık bir isim -> fonksiyon
// registry'si tanımlanıyor. render-core.js artık window[name] yerine
// `pageRenderers[name]` kullanıyor.

import { renderOzet } from '../ui/pages/ozet.js';
import { renderKartlar } from '../ui/pages/kartlar/10-kart-liste.js';
import { renderIslemler } from '../ui/pages/islemler/03-islem-liste-render.js';
import { renderExtreler } from '../ui/pages/ekstreler/02-ekstre-render.js';
import { renderMevduat } from '../ui/pages/mevduat/05-mevduat-liste-render.js';
import { renderHesaplar } from '../ui/pages/hesaplar/04-hesap-liste-render.js';
import { renderKira } from '../ui/pages/kira.js';
import { renderMaas } from '../ui/pages/maas.js';
import { renderElden } from '../ui/pages/elden.js';
import { renderKmhKredi } from '../ui/pages/krediler/03-kmh-kredi.js';
import { renderKredi } from '../ui/pages/krediler/04-bireysel-kredi.js';
import { renderTanimlamalar } from '../ui/pages/tanimlamalar/02-ana-sayfa.js';
import { renderAbonelik } from '../ui/pages/abonelik.js';

// stableRenderAll içinde ayrıca isimle çağrılan "hazırlık" fonksiyonları
import { loadCurrencyConfig } from '../ui/pages/tanimlamalar/06-para-birimi.js';
import { populateCurrencySelects } from '../domain/doviz.js';
import { populateKategoriSelects } from '../ui/pages/tanimlamalar/03-kategoriler.js';
import { populateEldenHesapSelect, populateEldenKisiSelect } from '../ui/pages/elden.js';
import { renderHesapTurFiltreler } from '../ui/pages/hesaplar/04-hesap-liste-render.js';
import { updateSidebarKartNav } from './app-core-base.js';

export const pageRenderers = {
  renderOzet, renderKartlar, renderIslemler, renderExtreler, renderMevduat,
  renderHesaplar, renderKira, renderMaas, renderElden, renderKmhKredi,
  renderKredi, renderTanimlamalar, renderAbonelik,
  loadCurrencyConfig, populateCurrencySelects, populateKategoriSelects,
  populateEldenHesapSelect, populateEldenKisiSelect, renderHesapTurFiltreler,
  updateSidebarKartNav,
};
