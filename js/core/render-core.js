import { inject, provide } from '@core/container.js';
import { openModal } from '@components/modal-genel.js';
import { kartDetayGeriDon } from '@pages/kartlar/03-kart-detay-ortak.js';
import { closeMobileSidebar, closeMobMore, mobNavRenderDynSlots, mobNavSyncActive, mobNavTrack } from '@components/mobile-nav-tema/01-mobil-nav.js';
import { renderOzet } from '@pages/ozet.js';
import { renderTumOranTablolari } from '@pages/tanimlamalar/05-genel-oran-tablolari.js';

// core.appCoreBase, core.wrapRegistry, core.pageRenderers, core.init zaten
// container'da kayıtlı (Tur 3/4/bu tur) — inject() (tembel Proxy) ile
// çözülüyor; app-core-base.js <-> init.js dairesel bağımlılığına karşı
// resolve() değil inject() kullanılıyor (bkz. DI-MIGRATION.md).
const _appCoreBase = inject('core.appCoreBase');
// [BUG FIX] Önceden `const NAV_BTN_ID_BY_PAGE = _appCoreBase.NAV_BTN_ID_BY_PAGE;`
// top-level'da (modül yüklenirken, senkron) Proxy property'sine erişiyordu.
// inject() tembel/lazy olacak şekilde tasarlanmıştı, ama bu satır o tembelliği
// boşa çıkarıp anında resolve('core.appCoreBase') tetikliyordu — script sırası
// garanti olsa bile modül EVALUATION sırası (özellikle dairesel importlarla)
// bunu garanti etmiyor. Artık her erişimde taze okuyan bir getter kullanılıyor.
const getNavBtnIdByPage = () => _appCoreBase.NAV_BTN_ID_BY_PAGE;
const getShowPage = (...a) => _appCoreBase.getShowPage(...a);
const setShowPage = (...a) => _appCoreBase.setShowPage(...a);

const _wrapRegistry = inject('core.wrapRegistry');
const register = (...a) => _wrapRegistry.register(...a);
const get = (...a) => _wrapRegistry.get(...a);
const call = (...a) => _wrapRegistry.call(...a);
const has = (...a) => _wrapRegistry.has(...a);

const _pageRenderersNs = inject('core.pageRenderers');
const pageRenderers = new Proxy({}, { get(_t, prop){ return _pageRenderersNs.pageRenderers[prop]; } });

const _init = inject('core.init');
const _pushHashState = (...a) => _init._pushHashState(...a);
// Bu dosya "render çekirdeğini" içerir: RENDERERS tablosu, renderDirect,
// stableShowPage, stableRenderAll, installRenderOverrides. index.html'de
// app-core-base.js'nin hemen ardına, TÜM domain/ui dosyalarından
// (kartlar.js dahil) ÖNCEYE konur — bu, kartlar.js'nin (ve ondan sonra
// gelen her şeyin, mobile-nav-tema.js dahil) showPage/renderAll'ın
// üzerine doğru sırada wrap kurabilmesi için gerekli: bu dosya önce
// showPage/renderAll'ı kurar, sonra kartlar.js bunun üzerine wrap kurar,
// sonra gelen her şey de doğru şekilde üstüne biner.
//
// odeme.js'de KALAN kısım (bakiye hook'ları: installBalanceHooks/recover/
// refreshOdBalance) kasıtlı olarak eski (geç) pozisyonunda bırakıldı — onlar
// _odHesapBilgiGuncelle/saveTransfer/closeModal gibi odeme.js'nin kendi geç
// tanımlarını wrap ediyor, ters yönde bir bağımlılıkları var. O kısım bu
// dosyanın export ettiği window.installRenderOverrides/_rfActivePageId/
// _rfPageLooksBlank/_rfRenderDirect/_rfScheduleRender'ı kullanıyor.
//
// [ES module geçişi] Bu dosya eskiden tüm içeriği bir IIFE içinde
// tutuyordu (kapsam izolasyonu için). ES module'e geçişte her dosya zaten
// kendi module scope'una sahip olduğundan IIFE artık gereksiz — kaldırıldı,
// içerik doğrudan module top-level'ına taşındı. Davranış birebir aynı;
// sadece `export` eklendi ve window.X atamaları (onclick + runtime wrap
// sistemi için) AYNEN korundu.
'use strict';

const TITLES = {
  ozet:'Finansal Özet', kartlar:'Kredi Kartları', islemler:'İşlemler', extreler:'Ekstre Görünümü',
  mevduat:'Mevduat Takibi', hesaplar:'Banka Hesapları', kira:'Kira Gelirleri & Giderleri',
  maas:'Maaş Geliri', elden:'Elden Ödemeler', kmhkredi:'KMH Taksitli Kredi', kredi:'Bireysel Krediler',
  tanimlamalar:'Tanımlamalar', abonelik:'Abonelikler & Tekrarlayan Ödemeler'
};
const ICONS = {ozet:'⊹',kartlar:'💳',islemler:'⇄',extreler:'🧾',mevduat:'◆',hesaplar:'⊙',kira:'🏠',maas:'◑',elden:'◇',kmhkredi:'▸',kredi:'▪',tanimlamalar:'⚙',abonelik:'↻'};
const RENDERERS = {
  ozet:'renderOzet', kartlar:'renderKartlar', islemler:'renderIslemler', extreler:'renderExtreler',
  mevduat:'renderMevduat', hesaplar:'renderHesaplar', kira:'renderKira', maas:'renderMaas',
  elden:'renderElden', kmhkredi:'renderKmhKredi', kredi:'renderKredi', tanimlamalar:'renderTanimlamalar', abonelik:'renderAbonelik'
};
const renderTimers = Object.create(null);

function el(id){ return document.getElementById(id); }
function fn(name){ return (name && typeof pageRenderers[name] === 'function') ? pageRenderers[name] : null; }
function safe(label, cb){ try { return cb && cb(); } catch(e){ console.error('[render-core] ' + label, e); return undefined; } }
export function activePageId(){ const p = document.querySelector('.page.active'); return p ? String(p.id || '').replace(/^page-/,'') : 'ozet'; }

// Render izni bayrakları — eskiden window.__rfRenderAllowV40 vb. isimlerle
// tutuluyordu (başka dosyaların da erişebilmesi gerektiği varsayımıyla).
// Kontrol ettiğimizde bu bayrakları başka hiçbir dosya okumuyor/yazmıyor;
// sadece bu fonksiyonun kendi save/restore mekanizması. Module-scope
// değişkene indirgendi.
let _renderAllowV40 = false, _renderAllowV38 = false, _navRenderBypassV42 = false;
function withRenderPermit(cb){
  const old40 = _renderAllowV40, old38 = _renderAllowV38, oldNav = _navRenderBypassV42;
  _renderAllowV40 = true;
  _renderAllowV38 = true;
  _navRenderBypassV42 = true;
  try { return cb(); }
  finally {
    _renderAllowV40 = old40;
    _renderAllowV38 = old38;
    _navRenderBypassV42 = oldNav;
  }
}

export function pageLooksBlank(pageId){
  const page = el('page-' + (pageId || activePageId())) || document.querySelector('.page.active');
  if(!page) return true;
  const useful = page.querySelector('.stat,.card,.tbl-wrap,tbody tr,.islem-row,.islem-row2,.extre-card,.kart-card-visual,.hesap-card,.mevduat-card,.tp-row,.section-title,.empty-state,.quick-grid,.dashboard-grid');
  if(useful) return false;
  return (page.innerText || '').replace(/\s+/g,' ').trim().length < 80;
}

function renderError(pageId, err){
  const page = el('page-' + (pageId || activePageId()));
  if(!page) return;
  page.innerHTML = '<div class="card" style="margin:16px;padding:18px;border-color:rgba(251,113,133,.35)">' +
    '<div class="card-title" style="color:var(--danger);margin-bottom:8px">Render hatası</div>' +
    '<div style="color:var(--text2);font-size:13px;line-height:1.55">Bu sayfa çizilirken hata oluştu. Sayfayı yenilemeden diğer menülere geçebilirsin. Hata: <code style="white-space:normal">' +
    String((err && err.message) || err || 'bilinmeyen hata').replace(/[<>&]/g, function(c){ return ({'<':'&lt;','>':'&gt;','&':'&amp;'})[c]; }) +
    '</code></div></div>';
}

export function renderDirect(pageId, reason){
  pageId = (pageId || activePageId() || 'ozet').replace(/^page-/,'');
  const renderer = RENDERERS[pageId];
  return withRenderPermit(function(){
    const f = fn(renderer);
    if(!f) return false;
    let ok = true;
    safe('render ' + pageId + ' / ' + (reason || ''), function(){ f(); });
    // Yukarıdaki safe hata yutuyor; sayfa hâlâ boşsa bir kez doğrudan hata göstermeden bırakma.
    if(pageLooksBlank(pageId)) {
      try { f(); } catch(e){ ok = false; renderError(pageId, e); }
    }
    safe('after render overlays', function(){ call('_refreshDateOverlays'); });
    return ok;
  });
}

export function scheduleRender(pageId, reason, delay){
  pageId = (pageId || activePageId() || 'ozet').replace(/^page-/,'');
  clearTimeout(renderTimers[pageId]);
  renderTimers[pageId] = setTimeout(function(){ renderDirect(pageId, reason || 'scheduled'); }, delay == null ? 35 : delay);
}

function syncNavActive(pageId, btn){
  document.querySelectorAll('.nav-btn').forEach(function(b){ b.classList.remove('active'); });
  if(btn && btn.classList && btn.classList.contains('nav-btn')) btn.classList.add('active');
  else {
    // [ES module] Eskiden onclick attribute içeriği okunarak eşleştiriliyordu;
    // onclick temizliği sonrası HTML'de bu attribute yok, sabit id haritası
    // (NAV_BTN_ID_BY_PAGE) kullanılıyor.
    const navBtnId = getNavBtnIdByPage()[pageId];
    const navBtn = navBtnId ? document.getElementById(navBtnId) : null;
    if(navBtn) navBtn.classList.add('active');
  }
  document.querySelectorAll('.mob-nav-btn,.mob-more-item').forEach(function(b){ b.classList.remove('active'); });
  safe('mob active', function(){ mobNavSyncActive(pageId); });
}

function activatePage(pageId, btn){
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
  const page = el('page-' + pageId);
  if(!page) return false;
  page.classList.add('active');
  syncNavActive(pageId, btn);
  const iconEl = el('topbar-icon'), labelEl = el('topbar-label');
  if(iconEl && ICONS[pageId]) iconEl.textContent = ICONS[pageId];
  if(labelEl) labelEl.textContent = TITLES[pageId] || pageId;
  return true;
}

export function stableShowPage(pageId, btn){
  pageId = String(pageId || 'ozet').replace(/^page-/,'');
  if(pageId === 'ekstreeslestir') {
    if(!document.querySelector('.page.active')) stableShowPage('ozet', null);
    safe('open eslestir modal', function(){ openModal('modal-eslestir'); });
    return;
  }
  if(pageId === 'kartlar') {
    safe('kart detay geri', function(){
      const detay = el('kartlar-detay-view');
      if(detay && detay.style.display !== 'none') kartDetayGeriDon();
    });
  }
  if(!activatePage(pageId, btn)) return;
  safe('hash', function(){ _pushHashState(pageId, {}); });
  if(window.innerWidth <= 1024) safe('close sidebar', function(){ closeMobileSidebar(); });
  safe('track nav', function(){ mobNavTrack(pageId); });
  renderDirect(pageId, 'showPage');
  requestAnimationFrame(function(){ if(pageLooksBlank(pageId)) renderDirect(pageId, 'showPage-raf'); });
  setTimeout(function(){ if(pageLooksBlank(pageId)) renderDirect(pageId, 'showPage-120'); }, 120);
}

export function stableRenderAll(){
  withRenderPermit(function(){
    ['loadCurrencyConfig','populateCurrencySelects','populateKategoriSelects','populateEldenHesapSelect','populateEldenKisiSelect','renderHesapTurFiltreler','updateSidebarKartNav'].forEach(function(name){
      const f = fn(name); if(f) safe(name, function(){ f(); });
    });
    safe('mob slots', function(){ mobNavRenderDynSlots(false); });
    const page = activePageId();
    renderDirect(page, 'renderAll');
    if(page !== 'ozet' && fn('renderOzet')) safe('hidden ozet refresh', function(){ renderOzet(); });
    if(page !== 'tanimlamalar' && fn('renderTumOranTablolari')) safe('oran tablolari', function(){ renderTumOranTablolari(); });
    safe('date overlays', function(){ call('_refreshDateOverlays'); });
  });
}

export function renderPage(pageId){ return renderDirect(pageId || activePageId(), 'renderPage'); }
export function refreshVisiblePage(){ return renderDirect(activePageId(), 'refreshVisiblePage'); }
export function mobNavGo(pageId, btn, icon, label){
  safe('close more', function(){ closeMobMore(); });
  safe('close sidebar', function(){ closeMobileSidebar(); });
  stableShowPage(pageId, btn || null);
  safe('mob sync', function(){ mobNavSyncActive(pageId); });
}

let _rfV42RenderOverridesInstalled = false;
export function installRenderOverrides(){
  // 14. turdan: sadece ilk kurulumda tam kurulum yapar, sonrasında yalnızca
  // gerçekten bozulmuşsa (fonksiyon değilse) onarır — sağlıklı bir wrap
  // zincirinin üzerine yazmaz.
  // [ES module] showPage artık app-core-base.js'deki mutable pointer
  // (_currentShowPage) üzerinden çözülüyor; window.showPage = ... YERİNE
  // setShowPage(...) ile pointer güncellenir — aksi halde onclick-bootstrap.js
  // gibi showPage'i doğrudan import eden dosyalar bu override'ı hiç görmezdi.
  // renderAll/renderPage/refreshVisiblePage/mobNavGo için wrap-registry
  // (register/call) kullanılır.
  if(!_rfV42RenderOverridesInstalled){
    setShowPage(stableShowPage);
    register('renderAll', stableRenderAll);
    _rfV42RenderOverridesInstalled = true;
  } else {
    if(typeof getShowPage() !== 'function') setShowPage(stableShowPage);
    if(!has('renderAll')) register('renderAll', stableRenderAll);
  }
  register('renderPage', renderPage);
  register('refreshVisiblePage', refreshVisiblePage);
  register('mobNavGo', mobNavGo);
}

// odeme.js'de kalan bakiye-hook kısmının (installBalanceHooks/recover)
// kullanması için dışarı açılıyor.

// NOT: Buradaki eski `installRenderOverrides();` (senkron, top-level) çağrısı
// kaldırıldı. Sebep: render-core.js, app-core-base.js tarafından modül-üstü
// import ediliyor; bu satır modül yüklenirken hemen çalışınca setShowPage()
// içeride getShowPage()/_currentShowPage henüz tanımlanmadan (TDZ) çağrılıyor
// ve "Cannot access '_currentShowPage' before initialization" hatası
// veriyordu. Aşağıdaki setTimeout(...,80) ve DOMContentLoaded/load
// dinleyicileri zaten aynı kurulumu güvenli bir şekilde (modül grafiği
// tamamen değerlendirildikten sonra) yapıyor; ayrıca senkron çağrıya gerek yok.
document.addEventListener('click', function(e){
  const nav = e.target && e.target.closest && e.target.closest('.nav-btn,.mob-nav-btn,.mob-more-item');
  if(!nav) return;
  setTimeout(function(){ installRenderOverrides(); }, 20);
}, true);
if(document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function(){ installRenderOverrides(); }, { once:true });
}
window.addEventListener('load', function(){ installRenderOverrides(); }, { once:true });
[80,250,700,1300].forEach(function(ms){ setTimeout(installRenderOverrides, ms); });

// ============================================================
// DUAL-MODE CONTAINER KAYDI (bkz. DI-MIGRATION.md)
// @components/*, @pages/kartlar/*, @pages/ozet.js, @pages/tanimlamalar/05-*
// importları HENÜZ silinmedi (ui katmanı henüz taşınmadı).
// ============================================================
provide('core.renderCore', {
  activePageId, pageLooksBlank, renderDirect, scheduleRender,
  stableShowPage, stableRenderAll, renderPage, refreshVisiblePage,
  mobNavGo, installRenderOverrides,
});
