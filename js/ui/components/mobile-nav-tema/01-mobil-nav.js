import { inject } from '@core/container.js';
// DUAL-MODE CONTAINER KAYDI: üç bağımlılık da (core.appCoreBase,
// core.state, core.wrapRegistry) zaten container'a taşınmış katmanlara
// ait, bu yüzden inject() ile tembel çözülüyor.
const _appCoreBase = inject('core.appCoreBase');
const _coreState = inject('core.state');
const _wrapRegistry = inject('core.wrapRegistry');
// ============================================================
// js/ui/components/mobile-nav-tema/01-mobil-nav.js
// Mobil alt navigasyon (sekme geçişleri, profil paneli, sidebar)
// Kod SATIR SATIR aynı kaldı; sadece dosya sınırı/gruplama değişti.
// ============================================================
export function placeMobProfilePanel() {
  const isMobile = window.innerWidth <= 768;
  const content = document.getElementById('topbar-profile-content');
  const anchor = document.getElementById('sidebar-footer-anchor');
  const userPanel = document.getElementById('gdrive-user-panel');
  const signinPanel = document.getElementById('gdrive-signin-panel');
  if (!content || !anchor || !userPanel || !signinPanel) return;
  if (isMobile) {
    if (content.contains(userPanel)) return;
    content.append(userPanel, signinPanel);
  } else {
    if (anchor.nextElementSibling === userPanel) return;
    anchor.after(userPanel, signinPanel);
    document.getElementById('topbar-profile-slot')?.classList.remove('open');
  }
}

export function toggleMobProfile(e) {
  if (e) e.stopPropagation();
  document.getElementById('topbar-profile-slot')?.classList.toggle('open');
}
document.addEventListener('click', function (e) {
  const slot = document.getElementById('topbar-profile-slot');
  if (slot && slot.classList.contains('open') && !slot.contains(e.target)) {
    slot.classList.remove('open');
  }
});
export let _mobProfileResizeT;
window.addEventListener('resize', function () {
  clearTimeout(_mobProfileResizeT);
  _mobProfileResizeT = setTimeout(placeMobProfilePanel, 150);
});
document.addEventListener('DOMContentLoaded', placeMobProfilePanel);
window.addEventListener('load', placeMobProfilePanel);
// Sihirbaz adım çubuğu (.swiz-steps-bar) mobilde yatay kaydırılabilir hale
// getirildi (bkz. CSS). Aktif adım (.is-active) değiştiğinde göstergeyi
// otomatik ortalayarak kullanıcının hangi aşamada olduğunu her zaman
// görmesini sağlıyoruz — mevcut ~12 sihirbazın hiçbirinin JS'ine dokunmadan,
// class değişimini gözlemleyen tek bir merkezi mekanizma.
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.swiz-steps-bar').forEach(function(bar) {
    const mo = new MutationObserver(function() {
      const activeWrap = bar.querySelector('.swiz-step-dot-wrap.is-active');
      if (activeWrap && typeof activeWrap.scrollIntoView === 'function') {
        activeWrap.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      }
    });
    mo.observe(bar, { attributes: true, attributeFilter: ['class'], subtree: true });
  });
});
// Sihirbaz adım noktalarına (dot) tıklayarak doğrudan o adıma gitme —
// her sihirbazın kendi StepGoto fonksiyonunu (Geri butonu gibi validasyonsuz,
// serbest gezinme) çağıran tek merkezi delegasyon. Mevcut ~13 sihirbazın
// hiçbirinin JS'ine dokunmadan, steps-bar id'sinden fonksiyon adına eşleniyor.
export const WIZARD_STEP_GOTO_MAP = {
  'pb-steps-bar':         'modal-para-birimi',
  'kmhkredi-steps-bar':   'modal-kmhkredi',
  'kredi-steps-bar':      'modal-kredi',
  'kart-steps-bar':       'modal-kart',
  'na-steps-bar':         'modal-nakit-avans',
  'kira-steps-bar':       'modal-kira',
  'maas-steps-bar':       'modal-maas',
  'hesap-steps-bar':      'modal-hesap',
  'elden-steps-bar':      'modal-elden',
  'kart-odeme-steps-bar': 'modal-kart-odeme',
  'ab-steps-bar':         'modal-abonelik',
  'transfer-steps-bar':   'modal-transfer',
  'mev-steps-bar':        'modal-mevduat',
};
document.addEventListener('click', function(e) {
  const wrap = e.target.closest('.swiz-step-dot-wrap');
  if (!wrap) return;
  const bar = wrap.closest('.swiz-steps-bar');
  if (!bar || !bar.id) return;
  const modalId = WIZARD_STEP_GOTO_MAP[bar.id];
  if (!modalId) return;
  const step = Number(wrap.dataset.step);
  if (!step) return;
  // Geriye (is-done) veya mevcut adıma (is-active) doğrulamasız serbest
  // gezinme. İleri (henüz tamamlanmamış) bir adıma tıklanırsa, "İleri"
  // butonuna basılmış gibi davranılır: aradaki her adımın validasyonu
  // sırayla geçilir; bir adımda validasyon başarısız olursa orada durulur
  // ve o adımın kendi hata mesajı gösterilir.
  if (wrap.classList.contains('is-done') || wrap.classList.contains('is-active')) {
    _wrapRegistry.call('wizardStepGoto:' + modalId, step);
    return;
  }
  const getCurrent = _wrapRegistry.get('wizardCurrentStep:' + modalId);
  const stepNext = _wrapRegistry.get('wizardStepNext:' + modalId);
  if (typeof getCurrent !== 'function' || typeof stepNext !== 'function') return;
  let guard = 0;
  while (getCurrent() < step && guard < 50) {
    const before = getCurrent();
    stepNext();
    if (getCurrent() === before) break; // validasyon başarısız oldu, dur
    guard++;
  }
});

// ── Mobil alt navigasyon ──────────────────────────────────────

/* ─── MOBİL NAVİGASYON ─────────────────────────────────── */

// Tüm sayfalar ve meta bilgileri (ikon, başlık)
export const MOB_ALL_PAGES = {
  ozet:         { icon:'📊', label:'Özet' },
  kartlar:      { icon:'💳', label:'Kartlar' },
  islemler:     { icon:'⇄',  label:'İşlemler' },
  extreler:     { icon:'🧾', label:'Ekstreler' },
  hesaplar:     { icon:'🏧', label:'Hesaplar' },
  mevduat:      { icon:'💎', label:'Mevduat' },
  kira:         { icon:'🏠', label:'Kira' },
  maas:         { icon:'💰', label:'Maaş' },
  elden:        { icon:'💵', label:'Elden' },
  kmhkredi:     { icon:'🏦', label:'KMH' },
  kredi:        { icon:'📋', label:'Kredi' },
  abonelik:     { icon:'🔄', label:'Abonelik' },
  ekstreeslestir: { icon:'🔗', label:'Eşleştir' },
  tanimlamalar: { icon:'⚙️', label:'Ayarlar' },
};

// Dinamik slotlarda gösterilebilecek sayfalar (özet hariç — o zaten sabit solda)
export const MOB_DYNAMIC_ELIGIBLE = ['kartlar','islemler','extreler','hesaplar','mevduat',
  'kira','maas','elden','kmhkredi','kredi','abonelik','ekstreeslestir','tanimlamalar'];

// Hiç kullanım verisi yoksa gösterilecek varsayılan sıralama
export const MOB_DYN_DEFAULTS = ['kartlar','islemler','hesaplar'];

// Şu an dinamik slotlarda hangi sayfalar var (sayfa id dizisi, 3 eleman)
export let _mobDynPages = [...MOB_DYN_DEFAULTS];

// Aktif slot active sınıfını izlemek için
export let _mobActivePage = 'ozet';

/* ── Dinamik slotları en çok kullanılan 3 sayfaya göre güncelle ── */
// Slot başına bekleyen animasyon timeout'unu izler (üst üste hızlı navigasyonda
// eski bir timeout'un yeni durumu ezmesini engellemek için).
export const _mobDynSlotTimers = {};

export function mobNavRenderDynSlots(animate) {
  if(!_coreState.DB) return;
  if(!_coreState.DB.navStats) _coreState.DB.navStats = {};

  // navStats'tan en çok kullanılan 3 eligible sayfayı al.
  // Hiç kullanım verisi yoksa (tüm sayaçlar 0 veya yok) varsayılan sıralamayı kullan.
  const hasAnyData = MOB_DYNAMIC_ELIGIBLE.some(p => (_coreState.DB.navStats[p]||0) > 0);
  let top3;
  if(!hasAnyData) {
    top3 = [...MOB_DYN_DEFAULTS];
  } else {
    const sorted = MOB_DYNAMIC_ELIGIBLE
      .slice()
      .sort((a, b) => (_coreState.DB.navStats[b]||0) - (_coreState.DB.navStats[a]||0));
    top3 = sorted.slice(0, 3);
  }

  // Eğer top 3 tamamen aynıysa ve animasyon istenmediyse işlem yapma
  if(!animate && top3.every((p,i)=>p===_mobDynPages[i])) return;

  _mobDynPages = top3;

  top3.forEach((pageId, i) => {
    const btn = document.getElementById('mobnav-dyn-' + i);
    if(!btn) return;
    const meta = MOB_ALL_PAGES[pageId] || { icon:'📄', label: pageId };

    // Fonksiyonel kısmı (tıklanınca nereye gideceği) HER ZAMAN hemen güncelle —
    // animasyon beklerken buton tıklamaları eski/yanlış sayfaya gitmesin diye.
    btn.setAttribute('data-page', pageId);
    btn.onclick = () => mobNavGo(pageId, btn, meta.icon, meta.label);
    btn.classList.toggle('active', pageId === _mobActivePage);

    const updateVisual = () => {
      const iconEl = btn.querySelector('.mob-nav-icon');
      const labelEl = btn.querySelector('.mob-nav-label');
      if(iconEl) iconEl.textContent = meta.icon;
      if(labelEl) labelEl.textContent = meta.label;
      if(animate) btn.classList.remove('swapping');
    };

    if(animate) {
      if(_mobDynSlotTimers[i]) clearTimeout(_mobDynSlotTimers[i]);
      btn.classList.add('swapping');
      _mobDynSlotTimers[i] = setTimeout(() => { updateVisual(); _mobDynSlotTimers[i] = null; }, 160);
    } else {
      if(_mobDynSlotTimers[i]) { clearTimeout(_mobDynSlotTimers[i]); _mobDynSlotTimers[i] = null; }
      updateVisual();
    }
  });
}

/* ── Sayfa ziyaretini kaydet ve slotları gerekirse güncelle ── */

export function mobNavTrack(pageId) {
  if(pageId === 'ozet') return; // sabit slot, sayılmasın
  if(!_coreState.DB.navStats) _coreState.DB.navStats = {};

  const prev = _coreState.DB.navStats[pageId] || 0;
  _coreState.DB.navStats[pageId] = prev + 1;

  // Drive'a kaydet (debounce zaten saveData içinde var)
  _appCoreBase.saveData();

  // Top 3 değiştiyse slotları animasyonlu güncelle
  const sorted = MOB_DYNAMIC_ELIGIBLE
    .slice()
    .sort((a,b) => (_coreState.DB.navStats[b]||0) - (_coreState.DB.navStats[a]||0));
  const newTop3 = sorted.slice(0,3);
  const changed = newTop3.some((p,i) => p !== _mobDynPages[i]);
  if(changed) mobNavRenderDynSlots(true);
}

/* ── Active durumunu senkronize et ── */

export function mobNavSyncActive(pageId) {
  _mobActivePage = pageId;
  // Özet butonu
  document.getElementById('mobnav-ozet').classList.toggle('active', pageId === 'ozet');
  // Dinamik slotlar
  document.querySelectorAll('.mob-nav-btn.dyn-slot').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-page') === pageId);
  });
  // ··· butonu
  const moreBtn = document.getElementById('mobnav-more');
  const dynPages = _mobDynPages;
  const isInDyn = dynPages.includes(pageId) || pageId === 'ozet';
  if(moreBtn) moreBtn.classList.toggle('active', !isInDyn && pageId !== null);
}

export function toggleMobileSidebar() {
  const sidebar = document.getElementById('main-sidebar');
  const backdrop = document.getElementById('mobile-sidebar-backdrop');
  const hamburger = document.getElementById('topbar-hamburger');
  const isOpen = sidebar.classList.contains('mobile-open');
  if (isOpen) {
    closeMobileSidebar();
  } else {
    sidebar.classList.add('mobile-open');
    backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (hamburger) hamburger.classList.add('open');
  }
}

export function closeMobileSidebar() {
  const sidebar = document.getElementById('main-sidebar');
  const backdrop = document.getElementById('mobile-sidebar-backdrop');
  const hamburger = document.getElementById('topbar-hamburger');
  sidebar.classList.remove('mobile-open');
  backdrop.classList.remove('active');
  document.body.style.overflow = '';
  if (hamburger) hamburger.classList.remove('open');
}

export function toggleMobMore() {
  const menu = document.getElementById('mob-more-menu');
  const backdrop = document.getElementById('mob-more-backdrop');
  const isOpen = menu.classList.contains('open');
  if (isOpen) {
    closeMobMore();
  } else {
    menu.classList.add('open');
    backdrop.classList.add('active');
  }
}

export function closeMobMore() {
  document.getElementById('mob-more-menu').classList.remove('open');
  document.getElementById('mob-more-backdrop').classList.remove('active');
  // If current page is a "more" page, keep more btn highlighted
}

function mobNavGo(pageId, btn, icon, label) {
  closeMobMore();
  closeMobileSidebar();

  // Sidebar nav butonunu bul ve showPage'i tetikle
  // [ES module] Eskiden onclick attribute içeriği okunarak bulunuyordu; onclick
  // temizliği sonrası HTML'de bu attribute yok, sabit id haritası kullanılıyor.
  const navBtnId = _appCoreBase.NAV_BTN_ID_BY_PAGE[pageId];
  const targetBtn = navBtnId ? document.getElementById(navBtnId) : null;
  if (targetBtn) {
    _appCoreBase.getShowPage()(pageId, targetBtn);
  } else {
    _appCoreBase.getShowPage()(pageId, null);
  }

  // Ziyareti kaydet → Drive'a gider, slot gerekirse güncellenir
  mobNavTrack(pageId);
  mobNavSyncActive(pageId);
}
// [KALDIRILDI] "export { mobNavGo as mobNavGo__01_mobil_nav }" hiçbir dosya
// tarafından import edilmiyordu (ölü kod taraması, 2026-07). Fonksiyonun
// kendisi hâlâ kullanımda.

// Sidebar nav tıklamalarını alt nav ile senkronla.
// [ES module] Eskiden window.showPage'i okuyup üstüne window.showPage = wrapped
// yazarak "patch" ediliyordu. ES export'ları immutable binding olduğu için
// aynısı artık _appCoreBase.getShowPage()/_appCoreBase.setShowPage() mutable pointer çifti üzerinden
// yapılıyor (bkz. app-core-base.js).
// NOT: Bu fonksiyon artık modül yüklenirken hemen (IIFE olarak) değil,
// init.js içinden DOMContentLoaded sonrasında çağrılıyor. Sebep: bu dosya
// app-core-base.js tarafından modül-üstü (top-level) import ediliyor; bu
// da bu dosyanın kodunun app-core-base.js'in kendi modül gövdesi (ve
// dolayısıyla `_currentShowPage` değişkeninin ilk atamasından ÖNCE)
// çalışmasına yol açıyordu → "Cannot access '_currentShowPage' before
// initialization" hatası. Çağrıyı DOMContentLoaded'a ertelemek, tüm
// modüllerin tam olarak initialize olmasını garanti eder.
export function installMobNavShowPageWrap() {
  const orig = _appCoreBase.getShowPage();
  _appCoreBase.setShowPage(function (pageId, btn) {
    orig(pageId, btn);
    mobNavSyncActive(pageId);
    mobNavTrack(pageId);
    if (window.innerWidth <= 1024) closeMobileSidebar();
  });
}

// Sayfa yüklendiğinde dinamik slotları hemen kur (Drive verisi hazır olunca applyMigrations
// zaten _coreState.DB.navStats'ı geri yükleyecek, ardından renderAll → mobNavRenderDynSlots çağrılır)
document.addEventListener('DOMContentLoaded', function() {
  mobNavRenderDynSlots(false);
});


/* ═══ TEMA SİSTEMİ ═══════════════════════════════════════ */

// closeMobMore, closeMobileSidebar, mobNavRenderDynSlots ve mobNavTrack zaten
// yukarıda `export function` olarak tanımlı; ihtiyacı olan modüller doğrudan
// import ediyor, ayrıca window.X atamasına gerek yok.

// ── Native tarayıcı tooltip'lerini bastır ─────────────────────
// Butonlarda erişilebilirlik (ekran okuyucu) için `title="Düzenle"`,
// `title="Sil"` gibi attribute'lar bırakılmıştı, ama tarayıcı bunları
// otomatik olarak hover tooltip'i olarak gösteriyor — istenmeyen davranış.
// MutationObserver kullanmadan (bkz. part-035.css yorumu), tek bir delegated
// 'pointerover' dinleyicisiyle: elemente ilk hover anında title'ı aria-label'a
// taşıyıp title'ı DOM'dan kaldırıyoruz. Böylece:
//  - Tarayıcı tooltip'i asla tetiklenmiyor (title anlık olarak var olsa da
//    hover başlamadan önce kaldırıldığı için gösterilecek zaman bulamıyor).
//  - Ekran okuyucular için erişilebilir isim aria-label üzerinden korunuyor.
//  - Yeni render edilen butonlar da (event delegation sayesinde) otomatik kapsanıyor.
document.addEventListener('pointerover', function(e) {
  const el = e.target.closest('[title]');
  if (!el) return;
  const t = el.getAttribute('title');
  if (!t) { el.removeAttribute('title'); return; }
  if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', t);
  el.removeAttribute('title');
}, true);
// Dokunmatik cihazlarda pointerover tetiklenmeyebileceği için, tıklama anında
// da aynı temizliği garanti altına alıyoruz (tooltip zaten dokunmatikte
// genelde sorun değil, ama title kalırsa bazı tarayıcılar uzun-basmada
// context menü/tooltip gösterebiliyor).
document.addEventListener('touchstart', function(e) {
  const el = e.target.closest('[title]');
  if (!el) return;
  const t = el.getAttribute('title');
  if (t && !el.hasAttribute('aria-label')) el.setAttribute('aria-label', t);
  el.removeAttribute('title');
}, { capture: true, passive: true });

// ============================================================
// [DI-MIGRATION] ui.components.mobilNav — container'a kayıt
// ============================================================
import { provide } from '@core/container.js';
provide('ui.components.mobilNav', {
  placeMobProfilePanel, toggleMobProfile,
  get _mobProfileResizeT() { return _mobProfileResizeT; },
  WIZARD_STEP_GOTO_MAP, MOB_ALL_PAGES, MOB_DYNAMIC_ELIGIBLE, MOB_DYN_DEFAULTS,
  get _mobDynPages() { return _mobDynPages; },
  get _mobActivePage() { return _mobActivePage; },
  _mobDynSlotTimers, mobNavRenderDynSlots, mobNavTrack, mobNavSyncActive,
  toggleMobileSidebar, closeMobileSidebar, toggleMobMore, closeMobMore,
  installMobNavShowPageWrap,
});
