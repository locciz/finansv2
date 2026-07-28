import { kd2IslemSiralamaDegisti } from '@pages/kartlar/05-kart-detay-v2.js';
import { kdIslemSiralamaDegisti } from '@pages/kartlar/04-kart-detay-v1.js';
import { _openScSearchPopup } from '@components/select-to-chips.js';
import { _kartOdemeHizliTransferGuncelle } from '@pages/kartlar/08-kart-odeme.js';
import { _odHesapTriggerGuncelle } from '@pages/odeme/05-hesap-secim-popup.js';
import { getCloseModal, setCloseModal } from '@components/modal-genel.js';
import { call, get, register } from '@core/wrap-registry.js';
import { _kdIslemSiralama, _kd2IslemSiralama } from '@pages/kartlar/09-kart-altyapi.js';
// ============================================================
// js/ui/pages/odeme/patches/03-canli-bakiye-render.js
// Kart/hesap işlem satırlarını okunaklı hâle getir + canlı bakiye
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
  // [ES module] window.__odLiveBalanceHooksInstalled bayrağı kaldırıldı —
  // ES modülleri zaten yalnızca bir kez evaluate edilir.

  function el(id){ return document.getElementById(id); }
  function safe(fn){ try { return fn && fn(); } catch(e){ console.warn('[odeme-card-ops]', e); } }

  function ensureOdBalanceInfo(){
    const wrap = el('od-hesap-field-wrap');
    if(!wrap) return null;
    let info = el('od-hesap-bakiye-info');
    if(!info){
      info = document.createElement('div');
      info.id = 'od-hesap-bakiye-info';
      const anchor = wrap.querySelector('.od-hesap-popup-wrap') || wrap.lastElementChild;
      if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(info, anchor.nextSibling);
      else wrap.appendChild(info);
    }
    return info;
  }

  function syncOdTrigger(){
    const hidden = el('od-pop-hesap');
    if(!hidden) return;
    safe(function(){ _odHesapTriggerGuncelle(hidden.value || ''); });
  }

  function refreshOdPaymentAccountLive(){
    const bg = el('od-modal-bg');
    if(!bg || !bg.classList.contains('open')) return;
    ensureOdBalanceInfo();
    syncOdTrigger();
    safe(function(){ call('_odHesapBilgiGuncelle'); });
    safe(function(){ _kartOdemeHizliTransferGuncelle('od-modal'); });
  }
  register('odRefreshSelectedAccountLive', refreshOdPaymentAccountLive);
  register('_odRenderHizliTransferBtn', function(){ _kartOdemeHizliTransferGuncelle('od-modal'); });

  // [ES module] eskiden window._odHesapBilgiGuncelle üzerinden okunup
  // window._odHesapBilgiGuncelle'a geri yazılıyordu; artık get/register ile
  // wrap-registry üzerinden zincirleniyor. NOT (davranış korunuyor): bu
  // IIFE top-level'da hemen çalışır; 06-bakiye-bilgi-kutusu-kaldirildi.js
  // ise install()'u DOMContentLoaded'a erteler ve script sırasına göre bu
  // dosyadan SONRA yüklenir — yani 06'nın register'ı bu wrap'i EZER (bu,
  // orijinal koddaki gerçek çalışma zamanı davranışıyla birebir aynı).
  const oldInfo = get('_odHesapBilgiGuncelle');
  if(typeof oldInfo === 'function' && !oldInfo._odLiveBalanceWrapped){
    const wrappedInfo = function(){
      const info = ensureOdBalanceInfo();
      const ret = oldInfo.apply(this, arguments);
      syncOdTrigger();
      if(info){
        const txt = info.textContent || '';
        info.classList.toggle('rf-neg', txt.indexOf('-') !== -1);
        info.classList.toggle('rf-pos', txt && txt.indexOf('-') === -1);
      }
      return ret;
    };
    wrappedInfo._odLiveBalanceWrapped = true;
    register('_odHesapBilgiGuncelle', wrappedInfo);
  }

  // [ES module] eskiden window._odModalRestoreAfterTransfer üzerinden
  // okunup window._odModalRestoreAfterTransfer'a geri yazılıyordu; artık
  // get/register ile wrap-registry üzerinden zincirleniyor.
  const oldRestore = get('_odModalRestoreAfterTransfer');
  if(typeof oldRestore === 'function' && !oldRestore._odLiveBalanceWrapped){
    const wrappedRestore = function(){
      const ret = oldRestore.apply(this, arguments);
      setTimeout(refreshOdPaymentAccountLive, 0);
      setTimeout(refreshOdPaymentAccountLive, 80);
      setTimeout(refreshOdPaymentAccountLive, 220);
      return ret;
    };
    wrappedRestore._odLiveBalanceWrapped = true;
    register('_odModalRestoreAfterTransfer', wrappedRestore);
  }

  // [ES module] eskiden `closeModal = function(id){...}` ile import
  // binding'ine doğrudan atama yapılıyordu — bu tarayıcıda TypeError
  // fırlatırdı (sessiz bug). Artık modal-genel.js'deki mutable pointer
  // (setCloseModal/getCloseModal) üzerinden doğru şekilde wrap ediliyor.
  const oldClose = getCloseModal();
  if(typeof oldClose === 'function' && !oldClose._odLiveBalanceWrapped){
    const wrappedClose = function(id){
      const ret = oldClose.apply(this, arguments);
      if(id === 'modal-transfer'){
        setTimeout(refreshOdPaymentAccountLive, 0);
        setTimeout(refreshOdPaymentAccountLive, 90);
        setTimeout(refreshOdPaymentAccountLive, 240);
      }
      return ret;
    };
    wrappedClose._odLiveBalanceWrapped = true;
    setCloseModal(wrappedClose);
  }

  function sortOptions(){
    return [
      {value:'tarih-yeni', text:'Yeni → Eski', icon:'↓'},
      {value:'tarih-eski', text:'Eski → Yeni', icon:'↑'},
      {value:'tutar-yuksek', text:'Tutar yüksekten düşüğe', icon:'₺↓'},
      {value:'tutar-dusuk', text:'Tutar düşükten yükseğe', icon:'₺↑'}
    ];
  }
  function sortLabel(v){
    const o = sortOptions().find(function(x){ return x.value === v; }) || sortOptions()[0];
    return o.text;
  }
  function sortHtml(o){
    return '<span class="bank-icon">'+(o.icon||'↕')+'</span><span class="hc-main"><span class="hc-name">'+o.text+'</span></span>';
  }
  function setSort(ctx, val){
    if(ctx === 'kd2'){
      const s2 = el('kd2-islem-sirala'); if(s2) s2.value = val;
      kd2IslemSiralamaDegisti(val);
    }else{
      const s = el('kd-islem-sirala'); if(s) s.value = val;
      kdIslemSiralamaDegisti(val);
    }
    syncSortButtons();
  }
  function kdOpenSortPicker(ctx){
    const current = ctx === 'kd2' ? ((_kd2IslemSiralama) || el('kd2-islem-sirala')?.value || 'tarih-yeni') : ((_kdIslemSiralama) || el('kd-islem-sirala')?.value || 'tarih-yeni');
    if(typeof _openScSearchPopup === 'function'){
      _openScSearchPopup({
        title:'Sıralama Seç',
        placeholder:'Sıralama ara…',
        options:sortOptions(),
        currentVal:current,
        htmlFn:sortHtml,
        getLabel:function(o){ return o.text; },
        onSelect:function(val){ setSort(ctx, val); }
      });
    }else{
      const idx = sortOptions().findIndex(function(x){ return x.value === current; });
      const next = sortOptions()[(idx + 1) % sortOptions().length].value;
      setSort(ctx, next);
    }
  }
  register('kdOpenSortPicker', kdOpenSortPicker);

  function ensureSortButton(selectId, ctx){
    const s = el(selectId);
    if(!s || !s.parentNode) return;
    const id = selectId + '-picker-btn';
    let btn = el(id);
    if(!btn){
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = id;
      btn.className = 'kd-sort-picker-btn';
      // [ES module] eskiden setAttribute('onclick', "kdOpenSortPicker(...)")
      // ile tanımlıydı - modülde global fonksiyon olmadığından çalışmazdı;
      // gerçek addEventListener'a taşındı.
      btn.addEventListener('click', () => call('kdOpenSortPicker', ctx));
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/></svg><span class="kd-sort-picker-label">Sırala</span>';
      s.parentNode.insertBefore(btn, s.nextSibling);
    }
    btn.title = 'Sıralama: ' + sortLabel(s.value || 'tarih-yeni');
  }
  function syncSortButtons(){
    ensureSortButton('kd-islem-sirala','kd');
    ensureSortButton('kd2-islem-sirala','kd2');
  }
  register('rfKdSyncSortPickerButtons', syncSortButtons);

  // [ES module] eskiden window[name] üzerinden okunup window[name]'e geri
  // yazılıyordu; artık get/register ile wrap-registry üzerinden zincirleniyor.
  ['kdRenderIslemler','kd2RenderIslemler'].forEach(function(name){
    const old = get(name);
    if(typeof old === 'function' && !old._rfSortPicker){
      const wrapped = function(){
        const ret = old.apply(this, arguments);
        setTimeout(syncSortButtons, 0);
        return ret;
      };
      wrapped._rfSortPicker = true;
      register(name, wrapped);
    }
  });

  document.addEventListener('DOMContentLoaded', function(){
    ensureOdBalanceInfo();
    syncSortButtons();
    setTimeout(refreshOdPaymentAccountLive, 100);
  });
  setTimeout(function(){ ensureOdBalanceInfo(); syncSortButtons(); }, 300);
})();
