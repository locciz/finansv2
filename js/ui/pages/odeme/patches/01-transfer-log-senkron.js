import { cpsInit } from '@components/cps-select.js';
import { setMoneyInput } from '@components/money-input.js';
import { _kartOdemeQuickTransferContext } from '@pages/kartlar/08-kart-odeme.js';
import { odGetDurum } from '@pages/odeme/01-genel-yardimcilar.js';
import { _odModalSecDurum } from '@pages/odeme/06-genel-odeme-modali.js';
import { odGetItem } from '@pages/odeme/02-sayfa-render.js';
import { register, call, get } from '@core/wrap-registry.js';
import { _odModal } from '@pages/odeme/08-popup-giris-noktalari.js';
// [KALDIRILDI] "Son Transferler" render/filtre mantığı (accLabel, side,
// possible, ensureTransferLogPrefs, renderStatus, _transferLogFiltreItems,
// openTransferLogFiltrePopup, setTransferLogStatusFilter, register('renderTransferLog',...))
// artık tek parça halinde js/ui/components/transfer-log.js içinde.
// O modül kendi register('renderTransferLog', ...) ve
// register('openTransferLogFiltrePopup', ...) çağrılarını kendisi yapıyor;
// index.html'de bu dosyadan SONRA yüklendiği için registry'yi son o eziyor.
// ============================================================
// js/ui/pages/odeme/patches/01-transfer-log-senkron.js
// Transfer log senkronu, hızlı ödeme senkronu, sabit işlem sütunu
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
export const FinansPaymentUiHelpers = {};
// [ES module] Bu dört fonksiyon (_transferLogFiltreItems, openTransferLogFiltrePopup,
// rfOdTumuDoldur, setTransferLogStatusFilter) aşağıdaki IIFE'nin closure'ı
// içinde tanımlanıyor (el/UI/accLabel/ensureTransferLogPrefs gibi başka
// closure değişkenlerini kullandıkları için IIFE dışına taşınamazlar).
// Eskiden window.X = ... ile "dışa açılıyorlardı"; artık bu modül-üstü
// değişkenlere atanıp dosyanın sonunda gerçek export ile dışa açılıyorlar.
let rfOdTumuDoldur;
(function(){
  'use strict';
  const UI = FinansPaymentUiHelpers;
  function el(id){return document.getElementById(id);}
  function esc(x){return String(x==null?'':x).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
  function run(fn){try{return fn();}catch(e){console.warn('[odeme-transfer-log]',e);}}
  function later(fn){if(window.queueMicrotask)queueMicrotask(fn);else setTimeout(fn,0);}
  // [ES module] eskiden hook(name,after) window[name]'i doğrudan okuyup
  // window[name]'e geri yazıyordu. Bu dosyanın hook listesindeki fonksiyonlar
  // (renderHesaplar, renderKartlar, odAcPopup, vb.) registry'ye henüz
  // register edilmemiş `export function` taban tanımlarına sahip; bu yüzden
  // önce registry'de aranır (get), yoksa window'da aranır (eski fallback,
  // geriye dönük uyumluluk için) — hangisi bulunursa o wrap edilip HER
  // İKİ YERE de (registry + window) yazılır ki hem call(...) kullanan yeni
  // kod hem de henüz window üzerinden çağıran eski kod çalışmaya devam etsin.
  function hook(name,after){
    const old = get(name) || window[name];
    if(typeof old!=='function'||old._paymentLogWrapped)return;
    const wrapped=function(){const r=old.apply(this,arguments);run(function(){after.apply(this,arguments);});return r;};
    wrapped._paymentLogWrapped=true;
    register(name,wrapped);
    window[name]=wrapped;
  }

  /* sticky */
  UI.markActionTables=function(root){root=root||document.querySelector('.page.active')||document;if(!root.querySelectorAll)return;root.querySelectorAll('.tbl-wrap table').forEach(function(tbl){const th=tbl.querySelector('thead th:last-child');const head=/işlem|işlemler|aksiyon|aksiyonlar/i.test((th&&th.textContent||'').trim());const body=Array.prototype.slice.call(tbl.querySelectorAll('tbody tr'),0,4).some(function(tr){const td=tr.lastElementChild;return !!(td&&td.querySelector('button,.btn,.btn-act,[onclick]'));});if(head||body)tbl.classList.add('tbl-sticky-actions');});};
  ['renderHesaplar','renderMevduat','renderKartlar','renderKira','renderMaas','renderAbonelik','renderElden','renderKredi','renderKmhKredi','renderExtreler','renderTanimlamalar','renderPage','renderAll'].forEach(function(n){hook(n,function(){later(function(){UI.markActionTables();});});});

  // (5. tur refactor) fmtTRY/UI.cardValues/UI.patchCardLimit burada
  // kaldırıldı — mantığı js/ui/pages/kartlar.js:kd2RenderOzetBanner()
  // içine kaynaştırıldı (bkz. o dosyadaki "kart limit TRY düzeltmesi").
  // (5. tur refactor) kd2RenderOzetBanner'ın TRY limit düzeltmesi artık
  // doğrudan js/ui/pages/kartlar.js:kd2RenderOzetBanner() içine kaynaştırıldı.

  // (Bu bloktan kaldırılan "TBK ay detay" bölümü artık tbk-detay.js'de
  // tanımlı; kaldırılma gerekçesi için README'nin 5. tur notuna bakılabilir.)

  /* ödeme popup aksiyonları */

  rfOdTumuDoldur=function(){const m=_odModal;if(!m)return;let n=Number(m.tutar)||0;if(m.tip==='kart'&&Number(m._kartKalan)>0)n=Number(m._kartKalan)||n;if(n>0&&typeof setMoneyInput==='function'){setMoneyInput('od-pop-tutar',n);const inp=el('od-pop-tutar');if(inp)inp.dispatchEvent(new Event('input',{bubbles:true}));UI.syncPaymentActions();}};
  function payBtns(){const wrap=el('od-pop-tutar-wrap');if(!wrap)return null;const fast=el('od-hizli-transfer-btn'),all=el('od-tumu-btn'),fill=el('od-kalan-tamamini-btn');if(fast&&fast.parentNode!==wrap)wrap.appendChild(fast);if(all&&all.parentNode!==wrap)wrap.appendChild(all);if(fill&&fill.parentNode!==wrap)wrap.appendChild(fill);if(fast){fast.innerHTML='<span class="mhtb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10"/><path d="M11 4l3 3-3 3"/><path d="M20 17H10"/><path d="M13 14l-3 3 3 3"/></svg></span><span class="mhtb-label">Aktar</span>';fast.title='Hızlı Transfer';}if(all){all.innerHTML='<span class="mhtb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 10-12h-7l1-8z"/></svg></span><span class="mhtb-label">Tümü</span>';all.title='Tüm tutarı doldur';}if(fill){fill.innerHTML='<span class="mhtb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span class="mhtb-label">Kalan</span>';fill.title='Kalanın Tamamı';}return{fast:fast,all:all,fill:fill};}
  function fillOk(){const m=_odModal;if(!m)return false;const d=m.seciliDurum||'bekliyor';if(d==='ertelendi'||d==='iptal')return false;if(m.tip==='kart')return Number(m._kartKalan||0)>0.01;if(m.tip==='kredi'||m.tip==='kmh'){const item=typeof odGetItem==='function'?odGetItem(m.tip,m.id):null;if(!item)return false;const ov=typeof odGetDurum==='function'?odGetDurum(item,m.key):null;const full=Number(m.tutar)||0,paid=(ov&&ov.durum==='kismi')?(Number(ov.tutar)||0):0;return Math.max(0,full-paid)>0.01;}return false;}
  function fastOk(){const ctx=typeof _kartOdemeQuickTransferContext==='function'?_kartOdemeQuickTransferContext('od-modal'):null;return !!(ctx&&ctx.kaynak);}
  UI.syncPaymentActions=function(){const b=payBtns();if(!b)return;const field=el('od-tutar-field-wrap');if(field&&field.style.display==='none'){[b.fast,b.all,b.fill].forEach(function(x){if(x)x.style.display='none';});return;}const m=_odModal,showAll=!!(m&&Number(m.tutar)>0);const sf=fastOk(),sa=showAll,sk=fillOk();if(b.fast){b.fast.style.display=sf?'inline-flex':'none';b.fast.disabled=!sf;}if(b.all){b.all.style.display=sa?'inline-flex':'none';}if(b.fill){b.fill.style.display=sk?'inline-flex':'none';b.fill.disabled=!sk;}};
  ['_odModalSecDurum','_odModalKrediAlanlariAyarla','_kartOdemeHizliTransferGuncelle'].forEach(function(n){hook(n,function(){later(UI.syncPaymentActions);});});hook('odAcPopup',function(){later(function(){run(function(){if(_odModal&&_odModal.seciliDurum==='bekliyor'&&typeof _odModalSecDurum==='function')_odModalSecDurum('odendi');});UI.syncPaymentActions();});});hook('odAcPopupKart',function(){later(UI.syncPaymentActions);});

  /* kart detay sıralama: mevcut cps motoru */
  function initSort(){['kd-islem-sirala','kd2-islem-sirala'].forEach(function(id){const s=el(id);if(s&&typeof cpsInit==='function')cpsInit(id,{fieldStyle:true,shortLabel:function(v,o){return o.textContent;}});});}
  ['kdRenderIslemler','kd2RenderIslemler'].forEach(function(n){hook(n,function(){later(initSort);});});

  function boot(){run(function(){UI.markActionTables();});run(initSort);run(UI.syncPaymentActions);}
  // [ES module] Bu dosya (tbk-detay.js üzerinden) app-core-base.js'in
  // dolaylı import zincirinde olduğu için, document.readyState 'loading'
  // değilse (modül scriptleri genelde DOM parse bittikten sonra çalıştığı
  // için bu sıkça doğrudur) boot() SENKRON olarak modül yüklenirken hemen
  // çalışıyordu — bu da state.js'deki DB henüz initialize olmadan
  // ensureTransferLogPrefs()'in DB.uiFiltreler'e erişmeye çalışmasına
  // (TypeError: Cannot read properties of undefined) yol açıyordu.
  // setTimeout(...,0) ile bir sonraki task'a ertelenerek tüm modüllerin
  // yüklenmesi garanti ediliyor.
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else setTimeout(boot,0);
})();

// [ES module] rfOdTumuDoldur yukarıdaki IIFE tarafından modül-üstü `let`
// değişkenine atanıyor (bkz. dosya başındaki not); artık gerçek binding
// olarak export ediliyor - window köprüsüne gerek yok.
// _transferLogFiltreItems / openTransferLogFiltrePopup / setTransferLogStatusFilter
// artık burada tanımlı değil — js/ui/components/transfer-log.js'den export
// ediliyor ve openTransferLogFiltrePopup orada zaten registry'ye kaydediliyor.
export { rfOdTumuDoldur };
