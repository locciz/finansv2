import { _kartOdemeHizliTransferGuncelle } from '@pages/kartlar/08-kart-odeme.js';
import { _odHesapTriggerGuncelle } from '@pages/odeme/05-hesap-secim-popup.js';
import { register } from '@core/wrap-registry.js';
// ============================================================
// js/ui/pages/odeme/patches/06-bakiye-bilgi-kutusu-kaldirildi.js
// Hesap bakiye-bilgi kutusu kaldırıldı (yalnızca yan etkiler)
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

  // [ES module] window.__odBalanceInfoElementRemoved bayrağı kaldırıldı —
  // ES modülleri zaten yalnızca bir kez evaluate edilir.

  function removeInfoElement(){
    const el = document.getElementById('od-hesap-bakiye-info');
    if(el && el.parentNode) el.parentNode.removeChild(el);
  }

  function refreshTransferButton(){
    try {
      _kartOdemeHizliTransferGuncelle('od-modal');
    } catch(e) {}
  }

  // [ES module] eskiden window._odHesapBilgiGuncelle/window.odRefreshSelectedAccountLive
  // atamalarıydı; artık wrap-registry'ye register ediliyor. NOT (davranış
  // korunuyor): bu install() DOMContentLoaded'a ertelenmiş durumda çalışır;
  // 03-canli-bakiye-render.js'nin _odHesapBilgiGuncelle wrap'i TOP-LEVEL'da
  // (hemen) çalıştığı için bu register çağrıları ondan SONRA gelip tabanı
  // EZER — bu, orijinal koddaki gerçek çalışma zamanı davranışıyla birebir
  // aynı (03'ün wrap'i script sırası nedeniyle zaten hiç devrede olmuyordu).
  function install(){
    removeInfoElement();

    // Orijinal görev: hesap değişince alt bilgi yazmak.
    // Artık o bilgi tamamen kaldırıldığı için fonksiyon yalnızca yan etkileri korur.
    const odHesapBilgiGuncelle = function(){
      removeInfoElement();
      refreshTransferButton();
    };
    odHesapBilgiGuncelle._odBalanceInfoRemoveWrapped = true;
    register('_odHesapBilgiGuncelle', odHesapBilgiGuncelle);

    register('odRefreshSelectedAccountLive', function(){
      removeInfoElement();
      try {
        const hesapSel = document.getElementById('od-pop-hesap');
        if(hesapSel && typeof _odHesapTriggerGuncelle === 'function') {
          _odHesapTriggerGuncelle(hesapSel.value || '');
        }
      } catch(e) {}
      refreshTransferButton();
    });
  }

  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once:true });
  } else {
    install();
  }

  window.addEventListener('load', install, { once:true });
})();
