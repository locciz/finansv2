import { _kartOdemeHizliTransferGuncelle } from '@pages/kartlar/08-kart-odeme.js';
import { getCloseModal, setCloseModal } from '@components/modal-genel.js';
import { call, get, register } from '@core/wrap-registry.js';
// ============================================================
// js/ui/pages/odeme/patches/02-wizard-footer-modal-koru.js
// Wizard footer'dan transfer açılınca modal state'ini koru
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
(function(){
  'use strict';
  const STATE_KEY = '__odModalSuspendedByTransfer';
  function el(id){ return document.getElementById(id); }
  function run(fn){ try { return fn(); } catch(e) { console.warn('[odeme-wizard-footer]', e); } }
  function visible(node){ return !!(node && node.style.display !== 'none' && getComputedStyle(node).display !== 'none'); }

  function normalizeWizardFooter(root){
    root = root || document;
    if(!root.querySelectorAll) return;
    root.querySelectorAll('.modal-footer').forEach(function(footer){
      const back = footer.querySelector('[id$="-step-back-btn"]');
      const next = footer.querySelector('[id$="-step-next-btn"]');
      const save = footer.querySelector('[id$="-step-save-btn"]');
      if(!back || (!next && !save)) return;
      footer.classList.add('swiz-mobile-footer');
      const cancel = footer.querySelector('[id$="-step-cancel-btn"]');
      if(cancel) cancel.classList.add('swiz-btn-cancel');
      back.classList.add('swiz-btn-back');
      if(next) next.classList.add('swiz-btn-next');
      if(save) save.classList.add('swiz-btn-save');
    });
  }

  function reopenOdModal(){
    const bg = el('od-modal-bg');
    if(!bg) return false;
    bg.style.display = 'flex';
    bg.classList.add('open');
    document.body.classList.add('modal-open');
    run(function(){ call('_odHesapBilgiGuncelle'); });
    run(function(){ _kartOdemeHizliTransferGuncelle('od-modal'); });
    return true;
  }

  function restoreOdAfterTransfer(){
    if(!window[STATE_KEY]) return;
    window[STATE_KEY] = false;
    run(function(){ call('_odModalRestoreAfterTransfer'); });
    // Ana fonksiyon herhangi bir eski flag yüzünden çalışmazsa manuel geri aç.
    setTimeout(function(){
      const bg = el('od-modal-bg');
      if(bg && !bg.classList.contains('open')) reopenOdModal();
    }, 0);
    setTimeout(function(){
      const bg = el('od-modal-bg');
      if(bg && !bg.classList.contains('open')) reopenOdModal();
    }, 120);
  }

  // Hızlı transfer ödeme durumundan açıldıysa, transfer modalının kapanışı ödeme popupını kapatmasın.
  // [ES module] eskiden window.kartOdemeHizliTransferAc üzerinden okunup
  // window.kartOdemeHizliTransferAc'a geri yazılıyordu; artık get/register
  // ile wrap-registry üzerinden zincirleniyor.
  const oldFast = get('kartOdemeHizliTransferAc');
  if(typeof oldFast === 'function' && !oldFast._quickTransferWrapped){
    const wrappedFast = function(kind){
      if(kind === 'od-modal') window[STATE_KEY] = true;
      return oldFast.apply(this, arguments);
    };
    wrappedFast._quickTransferWrapped = true;
    register('kartOdemeHizliTransferAc', wrappedFast);
  }

  // [ES module] eskiden `closeModal = function(id){...}` ile import
  // binding'ine doğrudan atama yapılıyordu — ES module import binding'leri
  // immutable olduğu için bu tarayıcıda TypeError fırlatırdı (sessiz bug,
  // bu patch muhtemelen hiç yüklenmiyordu). Artık modal-genel.js'deki
  // mutable pointer (setCloseModal/getCloseModal) üzerinden doğru şekilde
  // wrap ediliyor.
  const oldClose = getCloseModal();
  if(typeof oldClose === 'function' && !oldClose._quickTransferWrapped){
    const wrappedClose = function(id){
      const fromOdTransfer = id === 'modal-transfer' && !!window[STATE_KEY];
      const r = oldClose.apply(this, arguments);
      if(fromOdTransfer) restoreOdAfterTransfer();
      return r;
    };
    wrappedClose._quickTransferWrapped = true;
    setCloseModal(wrappedClose);
  }

  // [ES module] eskiden window.saveTransfer üzerinden okunup
  // window.saveTransfer'a geri yazılıyordu; artık get/register ile
  // wrap-registry üzerinden zincirleniyor.
  const oldSave = get('saveTransfer');
  if(typeof oldSave === 'function' && !oldSave._quickTransferWrapped){
    const wrappedSave = function(){
      const was = !!window[STATE_KEY];
      const r = oldSave.apply(this, arguments);
      if(was) setTimeout(restoreOdAfterTransfer, 20);
      return r;
    };
    wrappedSave._quickTransferWrapped = true;
    register('saveTransfer', wrappedSave);
  }

  function boot(){ normalizeWizardFooter(document); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
  // [ES module] eskiden window[name] üzerinden okunup window[name]'e geri
  // yazılıyordu; artık get/register ile wrap-registry üzerinden zincirleniyor.
  ['openModal','transferStepGoto','kartOdemeStepGoto','kartStepGoto','mevStepGoto','kiraStepGoto','maasStepGoto','hesapStepGoto','eldenStepGoto','krediStepGoto','kmhKrediStepGoto','abStepGoto','pbStepGoto','naStepGoto'].forEach(function(name){
    const old = get(name) || window[name];
    if(typeof old !== 'function' || old._wizardFooterWrapped) return;
    const wrapped = function(){ const r = old.apply(this, arguments); setTimeout(function(){ normalizeWizardFooter(document); },0); return r; };
    wrapped._wizardFooterWrapped = true;
    register(name, wrapped);
    window[name] = wrapped;
  });
})();
