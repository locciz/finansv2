import { activePageId, installRenderOverrides, pageLooksBlank, renderDirect, scheduleRender } from '../../../../core/render-core.js';
import { _kartOdemeHizliTransferGuncelle } from '../../kartlar/08-kart-odeme.js';
import { _odHesapTriggerGuncelle } from '../05-hesap-secim-popup.js';
import { getCloseModal, setCloseModal } from '../../../components/modal-genel.js';
import { call, get, register } from '../../../../core/wrap-registry.js';
// ============================================================
// js/ui/pages/odeme/patches/04-bakiye-hooklari.js
// Bakiye-hook'ları (hesap seçince/transfer sonrası tetikleyiciler)
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

  // (15. tur refactor notu) Bu bloğun "render çekirdeği"
  // (RENDERERS/renderDirect/stableShowPage/stableRenderAll/installRenderOverrides)
  // js/core/render-core.js'ye taşındı ve index.html'de çok daha erken bir
  // pozisyona alındı — sebep için o dosyanın başındaki nota bakın. Burada
  // sadece bakiye-hook kısmı (installBalanceHooks/recover/refreshOdBalance)
  // kaldı; bunlar odeme.js'nin kendi (geç tanımlanan) _odHesapBilgiGuncelle/
  // saveTransfer/closeModal gibi fonksiyonlarını wrap ettiği için burada,
  // eski (geç) pozisyonunda kalmaları doğru.
  function el(id){ return document.getElementById(id); }
  function safe(label, cb){ try { return cb && cb(); } catch(e){ console.error('[odeme-render]' + ' ' + label, e); return undefined; } }
  // [ES module] eskiden activePageId/pageLooksBlank/renderDirect/
  // scheduleRender/installRenderOverrides burada window._rfActivePageId gibi
  // hiç var olmayan bayraklara bağımlı, KENDİ KENDİNİ ÇAĞIRAN (sonsuz döngü
  // riskli) yerel "vekil" fonksiyonlarla yeniden tanımlanıyordu - bu isimler
  // zaten bu dosyanın en üstünde render-core.js'den import ediliyor; o
  // yüzden bu yerel tanımlar tamamen kaldırıldı, doğrudan import edilenler
  // kullanılıyor.

  // (Bakiye-bilgi kutusu ("od-hesap-bakiye-info") kaldırılmıştı, ama beş
  // ayrı hesap/transfer/kaydetme tetikleyicisi hâlâ bu fonksiyonu çağırıp
  // kutuyu yeniden oluşturuyordu — kutuyu oluşturan/dolduran kısım
  // kaldırıldı, kutuyla ilgisiz yan etkiler (hesap trigger senkronu, hızlı
  // transfer butonu yenileme) korundu. Geçmişi için README'nin 12. tur
  // notuna bakılabilir.)
  function refreshOdBalance(){
    const bg = el('od-modal-bg');
    if(!bg || !bg.classList.contains('open')) return;
    const hidden = el('od-pop-hesap');
    if(!hidden) return;
    const hesapId = hidden.value || '';
    safe('od trigger', function(){ _odHesapTriggerGuncelle(hesapId || ''); });
    safe('fast transfer btn', function(){ _kartOdemeHizliTransferGuncelle('od-modal'); });
  }

  function refreshOdBurst(reason){ [0,30,90,180,360,700].forEach(function(ms){ setTimeout(refreshOdBalance, ms); }); }
  register('odRefreshSelectedAccountLive', function(){ refreshOdBalance(); refreshOdBurst('manual'); });

  // [ES module] eskiden wrapOnce(name,...) window[name]'i doğrudan okuyup
  // window[name]'e geri yazıyordu; artık get/register ile wrap-registry
  // üzerinden aynı zincirleme wrap deseni sağlanıyor.
  function wrapOnce(name, key, after){
    const old = get(name);
    if(typeof old !== 'function' || old[key]) return;
    const wrapped = function(){
      const ret = old.apply(this, arguments);
      after && after.apply(this, arguments);
      return ret;
    };
    wrapped[key] = true;
    register(name, wrapped);
  }

  function installBalanceHooks(){
    wrapOnce('_odHesapBilgiGuncelle', '_odBalanceHookWrapped', function(){ setTimeout(refreshOdBalance, 0); });
    wrapOnce('_odHesapPopupSec', '_odBalanceHookWrapped', function(){ refreshOdBurst('account-select'); });
    wrapOnce('_odModalRestoreAfterTransfer', '_odBalanceHookWrapped', function(){ refreshOdBurst('restore'); });
    wrapOnce('saveTransfer', '_odBalanceHookWrapped', function(){ refreshOdBurst('saveTransfer'); scheduleRender(activePageId(), 'saveTransfer', 80); });
    // [ES module] closeModal, wrap-registry'de değil modal-genel.js'deki
    // mutable pointer'da (setCloseModal/getCloseModal) tutuluyor - wrapOnce
    // yerine ayrıca ele alınıyor.
    const oldClose = getCloseModal();
    if(typeof oldClose === 'function' && !oldClose._odBalanceHookWrapped){
      const wrappedClose = function(id){
        const ret = oldClose.apply(this, arguments);
        if(id === 'modal-transfer') refreshOdBurst('transfer-close');
        return ret;
      };
      wrappedClose._odBalanceHookWrapped = true;
      setCloseModal(wrappedClose);
    }
    wrapOnce('saveData', '_odRenderHookWrapped', function(){ scheduleRender(activePageId(), 'saveData', 120); setTimeout(refreshOdBalance, 60); });
  }

  function recover(reason){
    const page = activePageId();
    if(pageLooksBlank(page)) renderDirect(page, reason || 'recover');
    refreshOdBalance();
  }

  installBalanceHooks();

  document.addEventListener('click', function(e){
    const nav = e.target && e.target.closest && e.target.closest('.nav-btn,.mob-nav-btn,.mob-more-item');
    if(!nav) return;
    setTimeout(function(){ recover('nav-click'); }, 20);
  }, true);

  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ installBalanceHooks(); recover('dom'); setTimeout(function(){ recover('dom-late'); }, 250); }, { once:true });
  } else {
    recover('immediate');
  }
  window.addEventListener('load', function(){ installBalanceHooks(); recover('load'); setTimeout(function(){ recover('load-late'); }, 350); }, { once:true });
  [80,250,700,1300].forEach(function(ms){ setTimeout(function(){ recover('timer-' + ms); }, ms); });
})();
