import { toggleMobMore, closeMobMore, mobNavRenderDynSlots, mobNavSyncActive, toggleMobileSidebar, closeMobileSidebar } from '@components/mobile-nav-tema/01-mobil-nav.js';
import { mobNavGo } from '@core/render-core.js';
import { closeModal, _sidebarDim } from '@components/modal-genel.js';
import { renderIslemler } from '@pages/islemler/03-islem-liste-render.js';
import { register, get } from '@core/wrap-registry.js';
// ============================================================
// js/ui/pages/odeme/patches/07-genel-ui-burst-refresh.js
// Genel UI yenileme: render sonrası burst-refresh zamanlayıcısı
//
// ÖNEMLİ — SIRAYA DUYARLI: orijinal dosyada bu patch'lerin
// (01-07) hepsi aynı paylaşılan global fonksiyonlara (mobNavGo,
// showPage, renderAll, openModal/closeModal vb.) dokunuyor ve
// birbirini zincirleme sarmalıyor (monkey-patch). Orijinal kod
// yorumu bunu açıkça belirtiyordu: "dosyadaki sıraları
// korunmuştur". Bu yüzden bu 7 dosya kendi kendine yeten birer
// IIFE olarak BÖLÜNMEDEN aktarıldı; index.html'de MUTLAKA bu
// sayısal sırayla (01→07) art arda yüklenmeli.
// ============================================================
export const FinansUiCoreRefresh = {};
(function(){
  'use strict';

  // [ES module] Eskiden window.__odUiCoreRefreshInstalled bayrağıyla
  // çoklu-çalıştırma korunuyordu. ES modülleri zaten yalnızca bir kez
  // evaluate edilir (ve bu dosya index.html'de tek bir <script type="module">
  // ile bir kez yükleniyor), bu yüzden bayrak gereksizdi.

  let raf = 0;
  const timeoutIds = [];

  function qsa(sel, root){
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function styleText(el){
    return ((el && el.getAttribute('style')) || '').replace(/\s/g, '').toLowerCase();
  }

  function inlineDisplayOpen(el){
    const raw = styleText(el);
    return raw.indexOf('display:flex') >= 0 || raw.indexOf('display:block') >= 0 || raw.indexOf('display:grid') >= 0;
  }

  function classOpen(el){
    return !!el && (el.classList.contains('open') || el.classList.contains('show') || el.classList.contains('active'));
  }

  function isVisible(el){
    if(!el) return false;
    const cs = getComputedStyle(el);
    if(cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }

  function isOpenLayer(el){
    return classOpen(el) || inlineDisplayOpen(el) || isVisible(el);
  }

  function portalToBody(el, className){
    if(!el || !document.body) return null;
    if(el.parentElement !== document.body) document.body.appendChild(el);
    if(className) el.classList.add(className);
    return el;
  }

  function normalizeTbkModal(){
    const bg = document.getElementById('modal-tbk-ay-detay');
    if(!bg) return;

    portalToBody(bg, 'tbk-modal-portal');

    const open = classOpen(bg) || inlineDisplayOpen(bg);
    if(!open && (bg.classList.contains('tbk-modal-portal-closed') || bg.classList.contains('tbk-modal-portal-closed'))) {
      bg.classList.add('tbk-modal-portal-closed');
      bg.style.display = 'none';
      bg.style.visibility = 'hidden';
      bg.style.pointerEvents = 'none';
      return;
    }

    if(open) {
      bg.classList.remove('tbk-modal-portal-closed','tbk-modal-portal-closed');
      bg.style.position = 'fixed';
      bg.style.inset = '0';
      bg.style.width = '100%';
      bg.style.height = '100dvh';
      bg.style.display = 'flex';
      bg.style.alignItems = 'center';
      bg.style.justifyContent = 'center';
      bg.style.visibility = 'visible';
      bg.style.pointerEvents = 'auto';

      const modal = bg.querySelector(':scope > .modal') || bg.querySelector('.modal');
      if(modal) {
        modal.style.position = 'relative';
        modal.style.transform = 'none';
        modal.style.margin = 'auto';
        modal.style.display = 'flex';
        modal.style.flexDirection = 'column';
        modal.style.overflow = 'hidden';
        modal.style.minWidth = '0';
      }
    }
  }

  function hardCloseTbk(){
    const bg = document.getElementById('modal-tbk-ay-detay');
    if(!bg) return;
    bg.classList.remove('open','show','active');
    bg.classList.add('tbk-modal-portal-closed');
    bg.style.display = 'none';
    bg.style.visibility = 'hidden';
    bg.style.pointerEvents = 'none';
    unlockBodyWhenNoModal();
  }

  function normalizeSortPopup(){
    const popup = document.getElementById('tbk-sort-popup');
    if(!popup) return;

    portalToBody(popup, 'tbk-sort-popup-backdrop');
    popup.style.position = 'fixed';
    popup.style.inset = '0';
    popup.style.width = '100%';
    popup.style.height = '100dvh';
    popup.style.zIndex = '2147483600';
    popup.style.isolation = 'isolate';
    popup.style.overflow = 'hidden';

    if(classOpen(popup) || inlineDisplayOpen(popup)) {
      popup.style.display = 'flex';
      popup.style.visibility = 'visible';
      popup.style.pointerEvents = 'auto';
    } else {
      // display'i de sıfırla — aksi halde eski "display:flex" inline stili
      // kalıcı olarak kalır ve aşağıdaki [style*="display: flex"] CSS
      // seçicisi popup'ı .open class'ı olmasa bile açık tutmaya devam eder,
      // bu da "sıralama popup'ı hiçbir şekilde kapanmıyor" hatasına yol açar.
      popup.style.display = 'none';
      popup.style.visibility = '';
      popup.style.pointerEvents = 'none';
    }

    const panel = popup.querySelector('.tbk-sort-popup-panel');
    if(panel) {
      panel.style.position = 'relative';
      panel.style.zIndex = '2147483601';
      panel.style.transform = 'none';
    }
  }

  function normalizePopupVisibility(){
    qsa('.modal-bg,.popup-bg,.drawer-bg,.overlay,.backdrop').forEach(function(el){
      const open = classOpen(el) || inlineDisplayOpen(el);
      if(open) {
        el.style.visibility = 'visible';
        el.style.pointerEvents = 'auto';

        const card = el.querySelector('.modal,.popup,.drawer,.modal-card,.popup-card,.drawer-card');
        if(card) {
          card.style.visibility = 'visible';
          card.style.pointerEvents = 'auto';
        }
      } else {
        if(el.id === 'modal-tbk-ay-detay' || el.id === 'tbk-sort-popup') return;
        if(getComputedStyle(el).display === 'none') {
          el.style.pointerEvents = 'none';
          el.style.visibility = '';
        }
      }
    });
  }

  function unlockBodyWhenNoModal(){
    const anyOpen = qsa('.modal-bg.open,.popup-bg.open,.drawer-bg.open,.modal.open,.popup.open,.drawer.open,.overlay.open,.backdrop.open').some(isVisible);
    const anyInlineOpen = qsa('.modal-bg,.popup-bg,.drawer-bg,.overlay,.backdrop').some(function(el){
      return inlineDisplayOpen(el) && isVisible(el);
    });

    if(anyOpen || anyInlineOpen) return;

    document.body.classList.remove('modal-open');
    ['position','top','left','right','width','height','overflow','inset','pointerEvents'].forEach(function(prop){
      document.body.style[prop] = '';
    });
  }

  function promoteNavAndAuth(){
    const modalOpen = mobileModalLayerOpenForNav();

    qsa('nav,.navbar,.topbar,.mobile-nav,.bottom-nav,.mobile-bottom-nav,.sidebar,.nav,.nav-bar,.g_id_signin,#g_id_onload,[id*="google"],[class*="google"]').forEach(function(el){
      el.style.pointerEvents = 'auto';

      const isBottomNav = el.id === 'mobile-bottom-nav' || el.classList.contains('mobile-bottom-nav') || el.classList.contains('bottom-nav');

      if(window.innerWidth <= 768 && !modalOpen && !el.closest('.modal-bg.open,.popup-bg.open,.drawer-bg.open')) {
        const cls = String(el.id || '') + ' ' + String(el.className || '');
        const isGoogle = cls.toLowerCase().indexOf('google') >= 0;

        if(isBottomNav) {
          el.style.position = 'fixed';
          el.style.left = '0';
          el.style.right = '0';
          el.style.bottom = '0';
          el.style.top = 'auto';
          el.style.width = '100%';
          el.style.zIndex = '2147482200';
        } else if(getComputedStyle(el).position === 'static') {
          el.style.position = 'relative';
          el.style.zIndex = isGoogle ? '2147482100' : '2147482000';
        } else {
          el.style.zIndex = isGoogle ? '2147482100' : '2147482000';
        }
      } else if(window.innerWidth <= 768 && modalOpen && !isBottomNav) {
        // Bir modal/popup açıkken topbar & diğer nav öğeleri normal (düşük)
        // z-index'ine dönsün — aksi halde modal'ın arka planını karartan/bulanıklaştıran
        // katmanın ÜSTÜNDE kalıyor ve modal (ya da modal üstüne açılan ikinci bir popup)
        // topbar'ın altında kalmış gibi görünüyordu. Bottom nav zaten
        // normalizeBottomNavbar() tarafından modal açıkken gizleniyor, o yüzden dokunmuyoruz.
        el.style.zIndex = '';
        if(el.style.position === 'relative') el.style.position = '';
      }
    });
  }

  function normalizeStickyTables(){
    qsa('.tbl-wrap,.table-wrap,.data-table-wrap,.rf-table-wrap').forEach(function(wrap){
      wrap.style.isolation = 'isolate';
      wrap.style.maxWidth = '100%';
      wrap.style.minWidth = '0';

      qsa('thead th', wrap).forEach(function(th){
        th.style.zIndex = '40';
        th.style.backgroundClip = 'padding-box';
      });

      qsa('tbody tr', wrap).forEach(function(tr){
        tr.style.transform = 'none';
      });
    });
  }

  function normalizeCardHeaders(){
    qsa('.card-header').forEach(function(header){
      header.classList.add('rf-card-header-smart');

      let hasAction = false;
      qsa(':scope > *', header).forEach(function(child){
        if(!child || !child.classList) return;
        if(child.classList.contains('card-title') || child.classList.contains('card-title-icon')) return;
        child.classList.add('rf-card-header-actionarea');
        hasAction = true;
      });

      header.classList.toggle('rf-card-header-has-actions', hasAction);
    });
  }

  function removeTransferAsterisks(){
    qsa('.transfer-hidden-account-label').forEach(function(el){ el.remove(); });

    qsa('#modal-transfer label,#page-transfer label').forEach(function(label){
      const txt = (label.textContent || '').trim();
      if(txt === '*') label.remove();
      else if((/kaynak|hedef/i).test(txt) && txt.indexOf('*') >= 0) {
        label.innerHTML = label.innerHTML.replace(/\s*\*\s*/g, ' ');
      }
    });
  }

  // [KALDIRILDI] normalizeTransferRows() — "Son Transferler" satırlarının
  // grid layout'unu inline style ile flex'e çevirip eziyordu; bu da
  // css/transfer-log.css'in tek, tutarlı grid tanımıyla çakışıyordu.
  // Liste artık tek bir render fonksiyonundan (js/ui/components/transfer-log.js)
  // ve tek bir CSS dosyasından geldiği için bu runtime düzeltmesine gerek yok.

  function normalizePlanTables(){
    qsa('#page-kmhkredi table,#page-kredi table,#modal-kmh table,#modal-kredi table,.kmh-modal table,.kredi-modal table').forEach(function(table){
      table.style.tableLayout = 'fixed';
      table.style.width = '100%';

      qsa('tr', table).forEach(function(tr){
        const cells = tr.children;
        if(!cells || !cells.length) return;
        cells[0].classList.add('plan-taksit');
        cells[cells.length - 1].classList.add('plan-tutar');
      });
    });
  }

  function isGosterimContext(el){
    let out = '';
    let cur = el;
    for(let i = 0; cur && i < 5; i++, cur = cur.parentElement) {
      out += ' ' + (cur.getAttribute('data-section') || '') + ' ' + (cur.className || '') + ' ' + (cur.textContent || '').slice(0, 200);
    }
    out = out.toLocaleLowerCase('tr-TR');
    return out.indexOf('gösterim') >= 0 || out.indexOf('gosterim') >= 0 || out.indexOf('display') >= 0;
  }

  function markGosterimSelected(){
    const root = document.getElementById('page-tanimlamalar') || document;
    qsa('.active,.selected,[aria-pressed="true"],[aria-selected="true"],input:checked + label,.show-option,.gosterim-option,.display-option,.view-option,.ui-pref-chip', root).forEach(function(el){
      const selected =
        el.classList.contains('active') ||
        el.classList.contains('selected') ||
        el.getAttribute('aria-pressed') === 'true' ||
        el.getAttribute('aria-selected') === 'true' ||
        el.matches('input:checked + label');

      if(selected && isGosterimContext(el)) el.classList.add('gosterim-secili');
    });
  }

  function mobileSidebarOpen(){
    const sb = document.querySelector('.sidebar.mobile-open');
    const bd = document.querySelector('.mobile-sidebar-backdrop.active');
    return !!((sb && isVisible(sb)) || (bd && isVisible(bd)));
  }

  function mobileModalLayerOpenForNav(){
    return qsa('.modal-bg,.popup-bg,.drawer-bg,.overlay,.backdrop').some(function(el){
      if(el.id === 'mob-more-backdrop') return false;
      if(el.classList.contains('mobile-sidebar-backdrop')) return false;
      return (classOpen(el) || inlineDisplayOpen(el)) && isVisible(el);
    });
  }

  function normalizeBottomNavbar(){
    const nav = document.getElementById('mobile-bottom-nav');
    if(!nav) return;

    const hasModal = mobileModalLayerOpenForNav();
    const hasSidebar = mobileSidebarOpen();

    document.body.classList.toggle('rf-body-modal-open', hasModal);
    document.body.classList.toggle('rf-body-sidebar-open', hasSidebar);

    if(window.innerWidth <= 768) {
      nav.style.display = (hasModal || hasSidebar) ? 'none' : 'flex';
      nav.style.position = 'fixed';
      nav.style.left = '0';
      nav.style.right = '0';
      nav.style.bottom = '0';
      nav.style.top = 'auto';
      nav.style.width = '100%';
      nav.style.maxWidth = '100%';
      nav.style.height = 'calc(64px + env(safe-area-inset-bottom, 0px))';
      nav.style.minHeight = 'calc(64px + env(safe-area-inset-bottom, 0px))';
      nav.style.maxHeight = 'calc(64px + env(safe-area-inset-bottom, 0px))';
      nav.style.padding = '0 6px env(safe-area-inset-bottom, 0px)';
      nav.style.alignItems = 'stretch';
      nav.style.justifyContent = 'space-between';
      nav.style.zIndex = '2147482200';
      nav.style.pointerEvents = (hasModal || hasSidebar) ? 'none' : 'auto';
      nav.style.transform = 'none';
    }

    qsa('.mob-nav-btn', nav).forEach(function(btn){
      btn.style.pointerEvents = 'auto';
      btn.style.touchAction = 'manipulation';
      btn.style.flex = '1 1 0';
      btn.style.minWidth = '0';
      btn.style.height = '64px';

      if(btn.classList.contains('dyn-slot')) {
        const pageId = btn.getAttribute('data-page');
        if(pageId) {
          btn.onclick = function(){ mobNavGo(pageId, btn); };
        }
      }
    });

    const moreBtn = document.getElementById('mobnav-more');
    if(moreBtn) {
      moreBtn.onclick = function(){ toggleMobMore(); };
    }
  }

  function normalizeMobileMoreMenu(){
    const menu = document.getElementById('mob-more-menu');
    const backdrop = document.getElementById('mob-more-backdrop');

    if(menu && menu.classList.contains('open')) {
      menu.style.position = 'fixed';
      menu.style.left = '10px';
      menu.style.right = '10px';
      menu.style.bottom = 'calc(70px + env(safe-area-inset-bottom, 0px))';
      menu.style.top = 'auto';
      menu.style.zIndex = '2147482250';
      menu.style.pointerEvents = 'auto';
      menu.style.display = 'block';
    }

    if(menu) {
      qsa('.mob-more-item', menu).forEach(function(item){
        item.style.pointerEvents = 'auto';
        item.style.touchAction = 'manipulation';
      });
    }

    if(backdrop && backdrop.classList.contains('active')) {
      backdrop.style.position = 'fixed';
      backdrop.style.inset = '0';
      backdrop.style.zIndex = '2147482240';
      backdrop.style.pointerEvents = 'auto';
      backdrop.style.display = 'block';
    }
  }

  function normalizeMobileTopbar(){
    const topbar = document.querySelector('.topbar');
    if(!topbar || window.innerWidth > 768) return;
    topbar.style.position = 'sticky';
    topbar.style.top = '0';
    topbar.style.bottom = 'auto';
    // Bir modal/popup açıkken topbar'ı dev z-index'e itmiyoruz; aksi halde
    // modal-bg'nin (z-index:1000) arkasını karartan/bulanıklaştıran katmanın
    // ÜSTÜNDE kalıp hem "topbar bulanıklaşmıyor" hem de üst üste açılan ikinci
    // bir popup'ın (örn. kart detayından "+ Yeni İşlem") üst kısmının topbar'ın
    // altında kalmış gibi görünmesine sebep oluyordu.
    topbar.style.zIndex = mobileModalLayerOpenForNav() ? '' : '2147481900';
  }

  function refresh(){
    raf = 0;
    normalizePopupVisibility();
    normalizeTbkModal();
    normalizeSortPopup();
    unlockBodyWhenNoModal();
    promoteNavAndAuth();
    normalizeStickyTables();
    normalizeCardHeaders();
    removeTransferAsterisks();
    normalizePlanTables();
    markGosterimSelected();
    normalizeBottomNavbar();
    normalizeMobileMoreMenu();
    normalizeMobileTopbar();
  }

  function schedule(delay){
    if(delay) {
      timeoutIds.push(setTimeout(schedule, delay));
      return;
    }
    if(raf) return;
    raf = requestAnimationFrame(refresh);
  }

  function scheduleBurst(){
    schedule();
    schedule(40);
    schedule(140);
  }

  // [ES module] eskiden wrap(name), window[name]'i doğrudan okuyup
  // window[name]'e geri yazıyordu (window.X global'lerine bağımlıydı).
  // Artık registry (core/wrap-registry.js) üzerinden çalışıyor: taban
  // tanım registry'de yoksa (ama bu dosyaya import edilmişse) önce
  // register edilir, sonra üstüne bu dosyanın wrap katmanı eklenir.
  // Çağıranlar call(name, ...) ile her zaman en güncel katmanı kullanır.
  const BASE_DEFS = {
    closeModal, _sidebarDim, renderIslemler,
    mobNavGo, toggleMobMore, closeMobMore,
    mobNavRenderDynSlots, mobNavSyncActive, toggleMobileSidebar, closeMobileSidebar
  };

  function wrap(name){
    if (!get(name) && typeof BASE_DEFS[name] === 'function') {
      register(name, BASE_DEFS[name]);
    }
    const old = get(name);
    if(typeof old !== 'function' || old._uiCoreRefreshWrapped) return;

    const wrapped = function(){
      const result = old.apply(this, arguments);

      if(name === 'closeModal' && arguments[0] === 'modal-tbk-ay-detay') hardCloseTbk();
      else scheduleBurst();

      return result;
    };

    wrapped._uiCoreRefreshWrapped = true;
    register(name, wrapped);
  }

  // [ES module] Aşağıdaki orijinal listeden hiçbir yerde export/register
  // edilmeyen (projede gerçekte var olmayan) isimler çıkarıldı — zaten
  // hep no-op'tu (window[name] undefined olduğu için wrap() sessizce
  // dönüyordu): modalAc, modalKapat, openPopup, closePopup, popupAc,
  // showPopup, toggleSidebar, renderBankaHesaplari, renderKrediKartlari,
  // renderEkstreler, renderParaTransferleri, renderTransfer, renderHesapLog,
  // renderAyarlar, renderKartDetay, renderAuth, renderUserArea,
  // initGoogleLogin, kartDetayAc, openKartDetay, faizVarsayimlariAc,
  // openFaizVarsayimlari.
  [
    'showPage',
    'openModal','closeModal',
    '_sidebarDim',
    'renderOzet','renderHesaplar','renderMevduat','renderKira','renderMaas',
    'renderKmhKredi','renderKredi','renderKartlar','renderIslemler',
    'renderTransferLog',
    'renderTanimlamalar',
    /* 'tbkAyDetayAc','tbkAyDetayFiltreUygula' kaldırıldı — artık tbk-detay.js'de tanımlı,
       efektleri (scheduleTbkUiRefresh) doğrudan orada gömülü, bkz. o dosyanın başındaki not. */
    'mobNavGo','toggleMobMore','closeMobMore','mobNavRenderDynSlots','mobNavSyncActive','toggleMobileSidebar','closeMobileSidebar'
  ].forEach(wrap);


  document.addEventListener('click', function(e){
    const t = e.target;
    if(t && t.closest) {
      if(t.closest('#modal-tbk-ay-detay .close-btn')) {
        setTimeout(hardCloseTbk, 0);
        return;
      }
      if(t.id === 'modal-tbk-ay-detay') {
        e.preventDefault();
        hardCloseTbk();
        return;
      }
    }
    scheduleBurst();
  }, true);

  document.addEventListener('touchstart', function(){ schedule(); }, {capture:true, passive:true});
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape') {
      setTimeout(function(){
        const tbk = document.getElementById('modal-tbk-ay-detay');
        if(tbk && (classOpen(tbk) || inlineDisplayOpen(tbk))) hardCloseTbk();
        scheduleBurst();
      }, 0);
    } else {
      schedule();
    }
  }, true);

  window.addEventListener('resize', schedule, { passive:true });
  window.addEventListener('orientationchange', function(){ schedule(120); }, { passive:true });

  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleBurst, { once:true });
  } else {
    scheduleBurst();
  }

  window.addEventListener('load', scheduleBurst, { once:true });

  Object.assign(FinansUiCoreRefresh, {
    refresh: refresh,
    schedule: scheduleBurst,
    closeTbk: hardCloseTbk
  });
})();
