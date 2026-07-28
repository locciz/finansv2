import { get, register } from '@core/wrap-registry.js';
import { provide as _provide } from '@core/container.js';
// ============================================================
// js/ui/pages/odeme/patches/05-ekstre-satir-normalize.js
// Kart detay: ekstre satırlarını normalize et
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
  function el(id){ return document.getElementById(id); }

  function normalizeExtreRows(scope){
    const root = scope || document;
    const lists = root.querySelectorAll('#modal-kart-detay .kd-extre-detail-list, #kartlar-detay-view .kd-extre-detail-list');
    lists.forEach(function(list){ list.classList.add('kd-islem-list'); });
  }
  // [ES module] eskiden window.kdRenderExtreler üzerinden okunup
  // window.kdRenderExtreler'a geri yazılıyordu; artık get/register ile
  // wrap-registry üzerinden zincirleniyor.
  const origKdRenderExtreler = get('kdRenderExtreler');
  if(typeof origKdRenderExtreler === 'function'){
    register('kdRenderExtreler', function(){
      const r = origKdRenderExtreler.apply(this, arguments);
      normalizeExtreRows(document);
      return r;
    });
  }
  function boot(){
    normalizeExtreRows(document);
    const ths=document.querySelectorAll('#modal-tbk-ay-detay thead th'); if(ths && ths[2]) ths[2].textContent='';
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();

  // ============================================================
  // DUAL-MODE CONTAINER KAYDI (bkz. DI-MIGRATION.md)
  // Kendi üstteki `core/wrap-registry.js` importu BİLİNÇLİ OLARAK
  // bırakıldı — bu dosya, sırayla yüklenmesi zorunlu 7 patch'lik
  // zincirin (01-07) bir parçası, davranışı değişmedi.
  // ============================================================
  _provide('ui.pages.odemePatches.ekstreSatirNormalize', { normalizeExtreRows });
})();
