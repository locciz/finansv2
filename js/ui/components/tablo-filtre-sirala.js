import { saveData } from '../../core/app-core-base.js';
import { tblFiltreMultiToggle } from '../../core/app-core.js';
import { DB } from '../../core/state.js';
import { _asgariKuralPbFiltre, _asgariKuralPbFiltreRestored, set_asgariKuralPbFiltre, set_asgariKuralPbFiltreRestored } from '../pages/asgari-odeme.js';
import { _extreFiltreRestored, _katFilter, _katFiltreRestored, set_extreFiltreRestored, set_katFilter, set_katFiltreRestored } from '../pages/ekstreler/02-ekstre-render.js';
import { _hesapFiltreRestored, hesapFiltre, setHesapFiltre, set_hesapFiltreRestored } from '../pages/hesaplar/04-hesap-liste-render.js';
import { _kd2IslemSiralama, _kdIslemSiralama, set_kd2IslemSiralama, set_kdIslemSiralama } from '../pages/kartlar/09-kart-altyapi.js';
// ============================================================
// js/ui/components/tablo-filtre-sirala.js — Ortak tablo filtre/
// sıralama sistemi (chip filtreler, sıralama barı, DB'den restore)
// ============================================================
// Mevduat, Kira, Maaş, Elden Ödeme, Abonelikler, Banka Hesapları ve Kredi
// Kartları sayfalarındaki sıralama butonları bu yardımcı fonksiyonlar
// üzerinden üretilir — hepsi aynı ikonlu "chip" görünümüne sahiptir ve
// seçim DB.uiSiralama[sayfa] içinde kalıcı olarak saklanır (Drive'a senkronize edilir).

export var _kdIslemSiralamaRestored = false;

export var SIRALAMA_IKON = {
  takvim: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  tutar: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.3 9.3c0-1.3 1.2-2.3 2.7-2.3s2.7.8 2.7 2c0 1.4-1.2 1.9-2.7 2.3-1.5.4-2.7.9-2.7 2.3 0 1.2 1.2 2 2.7 2s2.7-1 2.7-2.3"/></svg>',
  yuzde: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.3"/><circle cx="17.5" cy="17.5" r="2.3"/></svg>',
  banka: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M4 21V9l8-5 8 5v12M9 21v-6h6v6"/></svg>',
  harf: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><line x1="4" y1="12" x2="12" y2="12"/><line x1="4" y1="18" x2="8" y2="18"/><path d="M19 8v10M19 18l3-3M19 18l-3-3"/></svg>',
  gun: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  kart: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  cuzdan: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>',
  tur: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M3 12h18M3 18h9"/></svg>',
  durum: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
};
// _restoreKdIslemSiralamaFromDB, _restoreKatFiltreFromDB, _restoreHesapFiltreFromDB
// ve _restoreAsgariKuralPbFiltreFromDB hepsi aynı kalıbı kullanıyordu: bir kez
// çalışma guard'ı + DB.uiFiltreler[x][y]'den okuyup bir global değişkene atama.
// Guard bayrağını ve atama işini tek yardımcıya topluyoruz; her çağıran kendi
// guard değişkenini ve atama fonksiyonunu (setter) veriyor.
export function _restoreFiltreFromDBOnce(guardGetSet, dbYolu, defaultDeger, setter) {
  if(guardGetSet.get()) return;
  guardGetSet.set(true);
  let deger = DB;
  for(const parca of dbYolu) { deger = deger && deger[parca]; }
  setter(deger != null ? deger : defaultDeger);
}

// ── DB'den filtre/sıralama geri yükleme (guard'lı, tek seferlik) ──
export function _restoreKdIslemSiralamaFromDB() {
  _restoreFiltreFromDBOnce(
    { get: () => _kdIslemSiralamaRestored, set: (v) => { _kdIslemSiralamaRestored = v; } },
    ['uiFiltreler', 'kartIslem', 'sirala'], 'tarih-yeni',
    (v) => { set_kdIslemSiralama(v); set_kd2IslemSiralama(v); }
  );
}

export function restoreExtreFiltreFromDB() {
  if(_extreFiltreRestored) return;
  set_extreFiltreRestored(true);
  const saved = (DB.uiFiltreler && DB.uiFiltreler.extreler) || {};
  const kf = document.getElementById('extre-kart-filter');
  const df = document.getElementById('extre-durum-filter');
  const ktf = document.getElementById('extre-kategori-filter');
  // NOT: Kart seçimi artık kasıtlı olarak geri yüklenmiyor — sayfa her girişte
  // "tüm kartlar" özet listesiyle açılmalı (kullanıcı isteği). Durum/Kategori
  // filtreleri bir kart seçildiğinde anlamlı olduğundan geri yüklenmeye devam eder.
  if(df && saved.durum) df.value = saved.durum;
  if(ktf && saved.kategori && (DB.kategoriler||[]).some(k=>k.id===saved.kategori)) ktf.value = saved.kategori;
}

export function persistExtreFiltreToDB() {
  const kf = document.getElementById('extre-kart-filter');
  const df = document.getElementById('extre-durum-filter');
  const ktf = document.getElementById('extre-kategori-filter');
  const yeni = { kart: kf ? kf.value : '', durum: df ? df.value : '', kategori: ktf ? ktf.value : '' };
  const eski = (DB.uiFiltreler && DB.uiFiltreler.extreler) || {};
  if(eski.kart===yeni.kart && eski.durum===yeni.durum && eski.kategori===yeni.kategori) return;
  if(!DB.uiFiltreler) DB.uiFiltreler = { islemler:{}, extreler:{} };
  DB.uiFiltreler.extreler = yeni;
  saveData();
}

// tblFiltreChipsHtml (tekli seçim) ve tblFiltreChipsMultiHtml (çoklu seçim)
// birebir aynı HTML üretimini kullanır; tek fark bir chip'in "aktif" sayılıp
// sayılmayacağını nasıl belirledikleri. Ortak render burada, aktiflik
// kontrolü parametre olarak veriliyor.
// ── Chip filtre / sıralama HTML üretimi ──────────────────────
// [ES module] Bu dosyadaki HTML üretim fonksiyonları çağırana özel
// fonksiyon adını (string) `onclickFn`/`openFnName`/`renderFnName` olarak
// parametre alıyordu ve eskiden onclick="..." attribute'una gömüyordu.
// Artık onclick KALDIRILDI - bunun yerine fonksiyon adı bir data-* attribute
// olarak gömülüyor (data-tbl-fn, data-tbl-fn2 vb.) ve her ÇAĞIRAN dosya,
// kendi container'ını render ettikten HEMEN SONRA bindTblFiltreChips()
// yardımcısını çağırarak gerçek addEventListener bağlamalı. handlerMap,
// data-tbl-fn değerini (örn. 'setKiraTurFiltre') gerçek fonksiyon
// referansına eşleyen bir { [fnAdi]: fonksiyon } objesidir.
export function bindTblFiltreChips(container, handlerMap) {
  if (!container) return;
  container.querySelectorAll('[data-tbl-fn]').forEach(el => {
    const fnName = el.getAttribute('data-tbl-fn');
    if (fnName === '__bankaFiltreTemizle') {
      // [ES module] orijinal onclick="tblFiltreMultiToggle('${sayfa}','banka','');${renderFnName}()"
      // - iki ayrı fonksiyon çağrısı içeriyordu, aynı davranış korunuyor.
      const sayfa = el.getAttribute('data-tbl-arg');
      const renderFnName = el.getAttribute('data-tbl-arg2');
      el.addEventListener('click', () => {
        tblFiltreMultiToggle(sayfa, 'banka', '');
        const renderFn = handlerMap[renderFnName];
        if (renderFn) renderFn();
      });
      return;
    }
    const fn = handlerMap[fnName];
    if (!fn) return;
    if (el.hasAttribute('data-tbl-arg2')) {
      // sıralama chip'i: iki argüman (key, yon)
      el.addEventListener('click', () => fn(el.getAttribute('data-tbl-arg'), el.getAttribute('data-tbl-arg2')));
    } else if (el.hasAttribute('data-tbl-use-this')) {
      // banka filtre popup butonu: orijinal onclick(this) çağrısı
      el.addEventListener('click', () => fn(el));
    } else {
      el.addEventListener('click', () => fn(el.getAttribute('data-tbl-arg') ?? ''));
    }
  });
}

export var TBL_FILTRE_IKON = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';
export var TBL_SIRALAMA_IKON = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5h10M11 9h7M11 13h4M3 17l3 3 3-3M6 18V4"/></svg>';

export function _tblFiltreChipsRender(label, options, aktifKontrol, onclickFn) {
  const chips = options.map(o => {
    const aktif = aktifKontrol(o.value);
    const title = o.title ? ` title="${String(o.title).replace(/"/g,'&quot;')}"` : '';
    return `<button class="filter-chip${aktif?' active':''}" data-val="${o.value}" data-tbl-fn="${onclickFn}" data-tbl-arg="${o.value}"${title}>${o.label}</button>`;
  }).join('');
  return `<div class="tbl-filtre-grup">${label?`<span class="tbl-filtre-grup-label">${TBL_FILTRE_IKON}${label}</span>`:''}${chips}</div>`;
}

export function tblFiltreChipsHtml(label, options, aktifDeger, onclickFn) {
  aktifDeger = aktifDeger || '';
  return _tblFiltreChipsRender(label, options, (v) => String(v) === aktifDeger, onclickFn);
}

export function tblFiltreClearHtml(aktifDeger, onclickFn) {
  if(!aktifDeger) return '';
  return `<button class="tbl-filtre-clear" data-tbl-fn="${onclickFn}" data-tbl-arg="">✕ Temizle</button>`;
}

export function tblSiralamaOku(sayfa, varsayilanKey, varsayilanYon) {
  const s = (DB.uiSiralama && DB.uiSiralama[sayfa]) || null;
  return s ? s : { key: varsayilanKey, yon: varsayilanYon || 'asc' };
}

export function tblSiralamaAyarla(sayfa, key, varsayilanYon) {
  if(!DB.uiSiralama) DB.uiSiralama = {};
  const mevcut = DB.uiSiralama[sayfa];
  let yon = varsayilanYon || 'asc';
  if(mevcut && mevcut.key === key) yon = (mevcut.yon === 'asc') ? 'desc' : 'asc';
  DB.uiSiralama[sayfa] = { key, yon };
  saveData();
}

export function tblSiralamaBarHtml(kriterler, aktif, onclickFn) {
  const chips = kriterler.map(k => {
    const isActive = aktif.key === k.key;
    const okIsareti = isActive ? (aktif.yon==='asc' ? '↑' : '↓') : '';
    return `<button class="filter-chip sort-chip${isActive?' active':''}" data-tbl-fn="${onclickFn}" data-tbl-arg="${k.key}" data-tbl-arg2="${k.yon||'asc'}" title="Sırala: ${k.label}">${SIRALAMA_IKON[k.ikon]||''}<span>${k.label}</span>${isActive?`<span class="sort-arrow">${okIsareti}</span>`:''}</button>`;
  }).join('');
  return `<div class="tbl-siralama-bar"><span class="tbl-siralama-label">${TBL_SIRALAMA_IKON}Sırala</span>${chips}</div>`;
}

export function tblSiralamaUygula(liste, aktif, comparators) {
  const cmp = comparators[aktif.key];
  if(!cmp) return liste;
  const sirali = [...liste].sort(cmp);
  return aktif.yon === 'desc' ? sirali.reverse() : sirali;
}

export function tblFiltreChipsMultiHtml(label, options, aktifDegerler, onclickFn) {
  aktifDegerler = aktifDegerler || [];
  return _tblFiltreChipsRender(label, options, (v) => (v === '' ? aktifDegerler.length === 0 : aktifDegerler.includes(v)), onclickFn);
}

export function tblFiltreClearMultiHtml(aktifDegerler, onclickFn) {
  if(!aktifDegerler || !aktifDegerler.length) return '';
  return `<button class="tbl-filtre-clear" data-tbl-fn="${onclickFn}" data-tbl-arg="">✕ Temizle</button>`;
}

export function tblBankaFiltrePopupBtnHtml(sayfa, secili, openFnName, renderFnName) {
  const n = secili.length;
  return `<button type="button" class="filter-chip${n?' active':''}" data-tbl-fn="${openFnName}" data-tbl-use-this>`
    + `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="10" width="18" height="10" rx="1"/><path d="M3 10l9-6 9 6"/></svg>`
    + `Banka${n?` <span class="tbl-filtre-chip-count">${n}</span>`:''}`
    + `</button>`
    + (n ? `<button class="tbl-filtre-clear" data-tbl-fn="__bankaFiltreTemizle" data-tbl-arg="${sayfa}" data-tbl-arg2="${renderFnName}">✕ Temizle</button>` : '');
}

export function _restoreKatFiltreFromDB() {
  _restoreFiltreFromDBOnce(
    { get: () => _katFiltreRestored, set: (v) => { set_katFiltreRestored(v); } },
    ['uiFiltreler', 'kategoriler', 'tur'], '',
    (v) => { set_katFilter(v); }
  );
}

export function _restoreHesapFiltreFromDB() {
  _restoreFiltreFromDBOnce(
    { get: () => _hesapFiltreRestored, set: (v) => { set_hesapFiltreRestored(v); } },
    ['uiFiltreler', 'hesaplar', 'tur'], '',
    (v) => { setHesapFiltre(v); }
  );
}

export function _restoreAsgariKuralPbFiltreFromDB() {
  _restoreFiltreFromDBOnce(
    { get: () => _asgariKuralPbFiltreRestored, set: (v) => { set_asgariKuralPbFiltreRestored(v); } },
    ['uiFiltreler', 'asgariKurallari', 'pb'], null,
    (v) => { set_asgariKuralPbFiltre(v); }
  );
}



