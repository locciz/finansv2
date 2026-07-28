import { inject, provide } from '@core/container.js';
const _gdrive = inject('services.gdrive');
import { bindMoneyInputs, setDateInputValue } from '@components/money-input.js';
import { extreTypeChange, openOzelExtreModal } from '@pages/ekstreler/01-ekstre-kesinlestirme.js';
import { installMobNavShowPageWrap } from '@components/mobile-nav-tema/01-mobil-nav.js';
import { openExtreDurumModal, openExtreKartModal, openExtreKategoriModal } from '@pages/ekstreler/02-ekstre-render.js';
import { renderHesapTurTablo } from '@pages/hesaplar/02-hesap-turu-tanimlama.js';
import { renderHesapTurFiltreler } from '@pages/hesaplar/04-hesap-liste-render.js';
import { openIslemFiltreModal } from '@pages/islemler/04-islem-filtre.js';
import { getKart } from '@pages/kartlar/01-kart-data.js';
import { acKartDetaySayfa, openKartDetayModal } from '@pages/kartlar/03-kart-detay-ortak.js';
import { _kd2KartId } from '@pages/kartlar/09-kart-altyapi.js';
import { openKategoriOneriModal, populateKategoriSelects } from '@pages/tanimlamalar/03-kategoriler.js';
import { renderTumOranTablolari } from '@pages/tanimlamalar/05-genel-oran-tablolari.js';
import { loadCurrencyConfig, updateParaBirimiPreview } from '@pages/tanimlamalar/06-para-birimi.js';
import { renderOzet } from '@pages/ozet.js';
import { openModal } from '@components/modal-genel.js';

// core.appCoreBase, core.format, domain.doviz, core.wrapRegistry container'da
// zaten kayıtlı (Tur 3/4) — inject() ile çözülüyor (dairesel bağımlılık
// riski + script sırası kırılganlığına karşı, bkz. DI-MIGRATION.md).
const _appCoreBase = inject('core.appCoreBase');
const showTab = (...a) => _appCoreBase.showTab(...a);
const updateSidebarKartNav = (...a) => _appCoreBase.updateSidebarKartNav(...a);
const showPage = (...a) => _appCoreBase.showPage(...a);

const _coreFormat = inject('core.format');
const fmtDate = (...a) => _coreFormat.fmtDate(...a);
const fmtTime = (...a) => _coreFormat.fmtTime(...a);
const localDateStr = (...a) => _coreFormat.localDateStr(...a);

const _domainDoviz = inject('domain.doviz');
const populateCurrencySelects = (...a) => _domainDoviz.populateCurrencySelects(...a);

const _wrapRegistry = inject('core.wrapRegistry');
const register = (...a) => _wrapRegistry.register(...a);
const call = (...a) => _wrapRegistry.call(...a);
const get = (...a) => _wrapRegistry.get(...a);
// NOT: wizard-routing.js BURADAN DOĞRUDAN import EDİLMİYOR — modal-genel.js
// zaten init.js'i import ediyor, wizard-routing.js de modal-genel.js'i import
// ediyor; burada bir de wizard-routing.js'i import etmek init.js ↔
// wizard-routing.js ↔ modal-genel.js döngüsü yaratıp "Cannot access before
// initialization" (TDZ) hatalarına yol açıyordu. Bunun yerine wizard-routing.js
// kendi restoreWizardModalFromHash fonksiyonunu ve WIZARD_RESTORABLE_MODAL_IDS
// listesini registry'ye (register/get) kaydediyor, biz de buradan get() ile
// okuyoruz — import zinciri hiç oluşmuyor.
// ============================================================
// js/core/init.js — Uygulama başlangıç/init akışı
// ============================================================

// ── 1) Tema init (senkron, DOM boyanmadan önce) ──────────────
// Sayfa render olmadan ÖNCE temayı belirler — yanlış temanın bir anlığına
// görünüp sonra değişmesini (flash) engeller. iOS/Android/Windows/macOS/
// Linux'taki tüm tarayıcılar prefers-color-scheme'i standart destekler.
// NOT: Bu blok dosyanın en başında olmalı; DOMContentLoaded'dan önce,
// mümkün olduğunca erken çalışması flash-önleme amacı için kritik.
(function() {
  try {
    const manuel = localStorage.getItem('finans-theme-manuel') === '1';
    const saved  = localStorage.getItem('finans-theme');
    const sistem = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    const tema = (manuel && saved) ? saved : sistem;
    document.documentElement.setAttribute('data-theme', tema);
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

// ── 2) Hash state yardımcıları (deep-link desteği) ───────────
// _pushHashState / _currentHashPage / _currentHashParams burada tek
// tanımla veriliyor; DOMContentLoaded akışı (navigateToHash) bunları kullanır.
export function _pushHashState(page, params) {
  let hash = '#' + page;
  const parts = [];
  Object.entries(params || {}).forEach(([k, v]) => { if(v != null && v !== '') parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); });
  if(parts.length) hash += '?' + parts.join('&');
  if(location.hash !== hash) {
    try { history.pushState({page, params}, '', hash); }
    catch(e) { location.hash = hash.slice(1); }
  }
}


export function _currentHashPage() {
  return (location.hash.replace('#', '').split('?')[0]) || 'ozet';
}

export function _currentHashParams() {
  const qIdx = location.hash.indexOf('?');
  if(qIdx < 0) return {};
  const qs = location.hash.slice(qIdx + 1);
  const params = {};
  qs.split('&').forEach(pair => {
    const [k, v] = pair.split('=').map(decodeURIComponent);
    if(k) params[k] = v || '';
  });
  return params;
}

// [ES module] Eskiden window._pendingKartDeepLink ile tutuluyordu; sadece
// bu dosya içinde (navigateToHash + register('_retryKartDeepLink',...))
// okunup yazıldığı için modül-üstü closure değişkenine çevrildi.
let _pendingKartDeepLink = null;

// ── 3) DOMContentLoaded ana akışı ────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  installMobNavShowPageWrap(); // showPage wrap'ini burada kur (bkz. 01-mobil-nav.js'deki not)
  _gdrive.gDriveInit();
  loadCurrencyConfig(); // DOM hazır olduktan sonra tekrar yükle
  bindMoneyInputs(); // Para formatı inputlarını bağla
  populateKategoriSelects();
  extreTypeChange();
  populateCurrencySelects();
  renderOzet();
  renderTumOranTablolari();
  renderHesapTurTablo();
  renderHesapTurFiltreler(); // Hesap filtre butonları
  updateSidebarKartNav();

  // Elden ve işlem formları için varsayılan tarih
  setDateInputValue('elden-tarih', localDateStr(new Date()));
  setDateInputValue('islem-tarih', localDateStr(new Date()));

  updateParaBirimiPreview(); // Para birimi önizleme

  // ── Hash tabanlı gelişmiş sayfa yönlendirme ────────────────
  const VALID_PAGES = ['ozet', 'kartlar', 'islemler', 'extreler', 'ekstreeslestir', 'mevduat', 'hesaplar',
                       'kira', 'maas', 'elden', 'kmhkredi', 'kredi', 'tanimlamalar', 'abonelik'];

  function navigateToHash() {
    const page = _currentHashPage();
    const params = _currentHashParams();
    const validPage = VALID_PAGES.includes(page) ? page : 'ozet';

    // showPage() hash'i kendi _pushHashState('kartlar', {}) çağrısıyla hemen
    // sıfırlıyor (alt-state'i siliyor) — bu yüzden deep-link param'larını
    // (kart/tab) showPage çağrılmadan önce burada bir global'de saklıyoruz.
    // _retryKartDeepLink, Drive verisi geldiğinde location.hash'i değil bu
    // saklanan değeri kullanacak.
    _pendingKartDeepLink = (validPage === 'kartlar' && params.kart)
      ? { kart: params.kart, tab: params.tab || 'islem' }
      : null;

    // Önce sayfayı göster (renderPage çalışsın, kart listesi hazır olsun)
    showPage(validPage, null);

    // Kart detayı geri yükle
    if(validPage === 'kartlar' && params.kart) {
      const k = typeof getKart === 'function' ? getKart(params.kart) : null;
      if(k) {
        _pendingKartDeepLink = null; // hemen açıldı, retry'a gerek yok
        setTimeout(() => acKartDetaySayfa(params.kart, params.tab || 'islem'), 60);
      }
    }

    // Tanımlamalar tab'ı geri yükle
    if(validPage === 'tanimlamalar' && params.tab) {
      const tabEl = document.getElementById(params.tab);
      if(tabEl) setTimeout(() => showTab(params.tab, null), 30);
    }

    // Modal geri yükle — sadece belirli "form dışı" / "okuma" modalleri restore et
    // (Yeni kayıt formları restore edilmez — kullanıcı formu yarıda bırakmış sayılır)
    const wizardIdsGetter = get('WIZARD_RESTORABLE_MODAL_IDS');
    const wizardRestorableIds = typeof wizardIdsGetter === 'function' ? wizardIdsGetter() : [];
    const RESTORABLE_MODALS = [
      'modal-hesap-log',
      'modal-iban-popup',
      'modal-kategori-oneri',
      'modal-kart-detay',
      'modal-drive-revizyon',
      'modal-islem-filtre',
      'modal-extre-kart',
      'modal-extre-durum',
      'modal-extre-kategori',
      'modal-ozel-extre',
      ...wizardRestorableIds, // modal-transfer, modal-kira, modal-maas, modal-elden, modal-abonelik, modal-kmhkredi, modal-kredi, modal-nakit-avans, modal-para-birimi, modal-hesap, modal-kart, modal-mevduat, modal-kart-odeme
    ];
    if(params.modal && RESTORABLE_MODALS.includes(params.modal)) {
      setTimeout(() => {
        const modalEl = document.getElementById(params.modal);
        if(!modalEl) return;
        // Wizard modalleri (transfer, kira, maaş, elden, abonelik, kmh/kredi,
        // nakit avans, para birimi, hesap, mevduat) — kendi "open" fonksiyonlarını
        // çağırıp gerekiyorsa doğru adıma (params.step) gider. bkz. wizard-routing.js
        if(wizardRestorableIds.includes(params.modal) && params.modal !== 'modal-kart-odeme') {
          const restoreFn = get('restoreWizardModalFromHash');
          if(typeof restoreFn === 'function' && restoreFn(params)) return;
        }
        switch(params.modal) {
          case 'modal-kategori-oneri':
            openKategoriOneriModal();
            break;
          case 'modal-kart-detay':
            if(params.modalKart) openKartDetayModal(params.modalKart, params.modalTab || 'islem');
            break;
          case 'modal-drive-revizyon':
            if(typeof _gdrive.gDriveAcRevizyonModal === 'function') _gdrive.gDriveAcRevizyonModal();
            break;
          case 'modal-islem-filtre':
            if(typeof openIslemFiltreModal === 'function') openIslemFiltreModal();
            break;
          case 'modal-extre-kart':
            if(typeof openExtreKartModal === 'function') openExtreKartModal();
            break;
          case 'modal-extre-durum':
            if(typeof openExtreDurumModal === 'function') openExtreDurumModal();
            break;
          case 'modal-extre-kategori':
            if(typeof openExtreKategoriModal === 'function') openExtreKategoriModal();
            break;
          case 'modal-ozel-extre':
            if(typeof openOzelExtreModal === 'function') openOzelExtreModal();
            break;
          default:
            openModal(params.modal, params.modalKart || undefined);
        }
      }, 180);
    }
  }

  // Drive senkronizasyonu tamamlandığında (sayfa ilk açılışta DB.kartlar henüz
  // gelmemiş olabileceğinden) #kartlar?kart=...&tab=... deep-link'i ilk denemede
  // başarısız olmuş olabilir — taze veri geldikten sonra bunu tekrar denemek için kullanılır.
  // NOT: location.hash'i değil _pendingKartDeepLink'i okur, çünkü showPage()
  // ilk denemede zaten hash'teki kart/tab parametrelerini silmiş oluyor.
  // [ES module] eskiden window._retryKartDeepLink = function(){...} olarak
  // tanımlanıp gdrive.js gibi başka dosyalardan window._retryKartDeepLink()
  // ile çağrılıyordu; artık wrap-registry üzerinden register/call ile.
  register('_retryKartDeepLink', function() {
    const pending = _pendingKartDeepLink;
    if(!pending) return;
    const k = typeof getKart === 'function' ? getKart(pending.kart) : null;
    if(!k) return;
    if(_kd2KartId === pending.kart) { _pendingKartDeepLink = null; return; } // zaten açık
    // Kullanıcı hâlâ kartlar (liste) sayfasındaysa kart detayını aç — başka bir
    // sayfaya geçtiyse müdahale etmeyelim
    const pageEl = document.getElementById('page-kartlar');
    if(pageEl && pageEl.classList.contains('active')) {
      _pendingKartDeepLink = null;
      setTimeout(() => acKartDetaySayfa(pending.kart, pending.tab || 'islem'), 60);
    }
  });

  window.addEventListener('popstate', navigateToHash); // Geri/ileri tarayıcı tuşu
  navigateToHash(); // İlk yükleme: hash varsa o sayfaya git, yoksa ozet

  // ── Clock (tek otoriter güncelleyici — sidebar saat + topbar tarih) ──
  // NOT: updateClock() ve setInterval çağrıları bilinçli olarak devre dışı;
  // saat/tarih UI'da gösterilmiyor. Fonksiyon yine de window.updateClockFn
  // üzerinden dışarıya açık tutuluyor (başka bir yerden tetiklenebilir diye).
  function updateClock() {
    const now = new Date();
    const t = fmtTime(now);
    const d = fmtDate(now);
    const cl = document.getElementById('sidebar-clock');
    const td = document.getElementById('topbar-date');
    if(cl) cl.textContent = t;
    if(td) {
      td.textContent = d;
      const h = now.getHours();
      if(h >= 8 && h <= 20) td.classList.add('today-mark');
      else td.classList.remove('today-mark');
    }
  }
  // [ES module] eskiden window.updateClockFn = updateClock; olarak
  // tanımlanıp format.js gibi başka dosyalardan window.updateClockFn()
  // ile çağrılıyordu; artık wrap-registry üzerinden register/call ile.
  register('updateClockFn', updateClock);
});

// ── 4) Dashboard açık-kalma kurtarma yaması ──────────────────
// Sayfa hiç açılmamışsa (hiçbir .page.active yoksa) dashboard'ı zorla gösterir.
(function() {
  'use strict';
  // [ES module] window.__rfV80DashboardOpenFix bayrağı kaldırıldı — ES
  // modülleri yalnızca bir kez evaluate edilir.

  function openDash() {
    try {
      if(document.querySelector('.page.active')) return;
      if(typeof showPage === 'function') { showPage('ozet'); return; }
      const dash = document.getElementById('page-ozet') || document.getElementById('ozet');
      if(dash) dash.classList.add('active');
    } catch(e) {}
  }

  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { openDash(); setTimeout(openDash, 100); }, { once: true });
  } else {
    openDash();
    setTimeout(openDash, 100);
  }
  window.addEventListener('load', openDash, { once: true });
})();

// ============================================================
// DUAL-MODE CONTAINER KAYDI (bkz. DI-MIGRATION.md)
// @components/*, @pages/* importları HENÜZ silinmedi (ui katmanı henüz
// taşınmadı). render-core.js bu namespace'i inject('core.init') ile
// dairesel bağımlılık riski olmadan çözer.
// ============================================================
provide('core.init', { _pushHashState, _currentHashPage, _currentHashParams });
