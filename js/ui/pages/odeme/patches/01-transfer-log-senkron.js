import { saveData } from '../../../../core/app-core-base.js';
import { tblFiltreOkuMulti } from '../../../../core/app-core.js';
import { fmtCur, fmtDate } from '../../../../core/format.js';
import { DB } from '../../../../core/state.js';
import { cpsInit } from '../../../components/cps-select.js';
import { openMfFiltrePopup } from '../../../components/mf-popup.js';
import { showToast } from '../../../components/modal-genel.js';
import { setMoneyInput } from '../../../components/money-input.js';
import { _kartOdemeQuickTransferContext } from '../../kartlar/08-kart-odeme.js';
import { odGetDurum } from '../01-genel-yardimcilar.js';
import { _odModalSecDurum } from '../06-genel-odeme-modali.js';
import { odGetItem } from '../02-sayfa-render.js';
import { register, call, get, has } from '../../../../core/wrap-registry.js';
import { _odModal } from '../08-popup-giris-noktalari.js';
import { tekrarlaTransfer, deleteTransfer, _transferLogFiltreLabelGuncelle } from '../../../components/transfer-modal.js';
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
let _transferLogFiltreItems, openTransferLogFiltrePopup, rfOdTumuDoldur, setTransferLogStatusFilter;
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

  /* transfer log */
  function accLabel(h){if(!h)return 'Hesap';const b=(DB.bankalar||[]).find(function(x){return x.id===h.banka;});const bank=(b&&(b.kisa||b.ad))||'Banka';const last=(h.iban||'').replace(/\s+/g,'').slice(-4);return bank+' · '+(h.ad||'Hesap')+(last?' · ····'+last:'');}
  function side(t,w){if(w==='k'){if(t.kTip==='nakit')return('Nakit '+(t.kaynakPb||'')).trim();return accLabel((DB.hesaplar||[]).find(function(h){return h.id===t.kaynakId;}));}if(t.hTip==='nakit')return('Nakit '+(t.hedefPb||'')).trim();return accLabel((DB.hesaplar||[]).find(function(h){return h.id===t.hedefId;}));}
  function possible(t){let tut=Number(t.tutar)||0,src=false,dst=false;if(t.kTip==='nakit')src=((DB._nakitBakiye||{})[t.kaynakPb]||0)>=tut-.005;else{const h=(DB.hesaplar||[]).find(function(x){return x.id===t.kaynakId;});src=!!(h&&h.durum==='aktif'&&h.tur!=='vadeli'&&((Number(h.bakiye)||0)+(Number(h.kmhLimit)||0))>=tut-.005);}if(t.hTip==='nakit')dst=!!t.hedefPb;else{const hh=(DB.hesaplar||[]).find(function(x){return x.id===t.hedefId;});dst=!!(hh&&hh.durum==='aktif'&&hh.tur!=='vadeli');}return src&&dst;}
  function ensureTransferLogPrefs(){DB.uiFiltreler=DB.uiFiltreler||{};DB.uiFiltreler.transferLog=DB.uiFiltreler.transferLog||{};if(!Array.isArray(DB.uiFiltreler.transferLog.filtre))DB.uiFiltreler.transferLog.filtre=DB.uiFiltreler.transferLog.filtre?[DB.uiFiltreler.transferLog.filtre]:[];if(typeof DB.uiFiltreler.transferLog.status!=='string')DB.uiFiltreler.transferLog.status='';return DB.uiFiltreler.transferLog;}
  function st(){const p=ensureTransferLogPrefs();return p.status||'';}
  setTransferLogStatusFilter=function(v){const p=ensureTransferLogPrefs();p.status=v||'';if(typeof saveData==='function')saveData();call('renderTransferLog');};
  function renderStatus(){const bar=el('rf-transfer-status-filter');if(!bar)return;const cur=st();const iconAll='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>';const opts=[['',iconAll,'Tüm transferler','all'],['ok','<span class="dot ok"></span>','Şu an yapılabilir','ok'],['no','<span class="dot no"></span>','Şu an yapılamaz','no']];bar.innerHTML=opts.map(function(o){return '<button type="button" class="'+(cur===o[0]?'active ':'')+o[3]+' rf-transfer-status-btn" data-val="'+o[0]+'" title="'+o[2]+'" aria-label="'+o[2]+'">'+o[1]+'</button>';}).join('');bar.querySelectorAll('.rf-transfer-status-btn').forEach(function(btn){btn.addEventListener('click',function(){setTransferLogStatusFilter(btn.getAttribute('data-val'));});});}
  _transferLogFiltreItems=function(){const used=new Set(),cash=new Set();(DB.transferler||[]).forEach(function(t){if(t.kTip==='hesap'&&t.kaynakId)used.add(t.kaynakId);if(t.hTip==='hesap'&&t.hedefId)used.add(t.hedefId);if(t.kTip==='nakit'&&t.kaynakPb)cash.add(t.kaynakPb);if(t.hTip==='nakit'&&t.hedefPb)cash.add(t.hedefPb);});const a=Array.from(used).map(function(id){const h=(DB.hesaplar||[]).find(function(x){return x.id===id;});return h?{value:'h:'+id,label:accLabel(h),icon:'<span class="bank-icon">🏦</span>'}:null;}).filter(Boolean);const c=Array.from(cash).filter(Boolean).map(function(pb){return{value:'n:'+pb,label:'Nakit ('+pb+')',icon:'<span class="bank-icon">💵</span>'};});return a.concat(c).sort(function(x,y){return x.label.localeCompare(y.label,'tr');});};
  openTransferLogFiltrePopup=function(triggerEl){const items=_transferLogFiltreItems();if(!items.length){showToast('Filtrelenecek transfer geçmişi yok','info');return;}openMfFiltrePopup('transferLog','filtre','Son Transferleri Filtrele',items,function(){return call('renderTransferLog');},triggerEl);};
  // [ES module] Eskiden window.renderTransferLog = function(){...} ile
  // transfer-modal.js'deki taban tanımı kalıcı olarak override ediyordu.
  // ES export'ları immutable binding olduğu için aynı davranış artık
  // core/wrap-registry.js üzerinden: bu, register('renderTransferLog', ...)
  // ile taban tanımın üstüne yeni bir katman ekliyor; çağıranlar
  // call('renderTransferLog') ile her zaman bu en güncel katmanı kullanır.
  register('renderTransferLog', function(){ensureTransferLogPrefs();DB.transferler=DB.transferler||[];const list=el('transfer-log-liste'),sec=el('transfer-log-msec');if(!list)return;if(sec)sec.style.display=DB.transferler.length?'':'none';renderStatus();if(!DB.transferler.length){list.innerHTML='<div style="color:var(--text3);font-size:12px;padding:8px">Henüz transfer yok</div>';return;}const map={};(DB.hesaplar||[]).forEach(function(h){map[h.id]=h.ad;});const selected=typeof tblFiltreOkuMulti==='function'?tblFiltreOkuMulti('transferLog','filtre'):[];_transferLogFiltreLabelGuncelle(map,selected);let rows=DB.transferler.slice().reverse();if(selected.length)rows=rows.filter(function(t){return selected.some(function(f){if(f.indexOf('h:')===0){const id=f.slice(2);return t.kaynakId===id||t.hedefId===id;}const pb=f.slice(2);return(t.kTip==='nakit'&&t.kaynakPb===pb)||(t.hTip==='nakit'&&t.hedefPb===pb);});});const filter=st();if(filter)rows=rows.filter(function(t){return possible(t)===(filter==='ok');});if(!rows.length){list.innerHTML='<div style="color:var(--text3);font-size:12px;padding:8px 4px">Kayıt yok</div>';return;}
    const arrowSvg='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M3 8h9"/><path d="M9 4.5 12.5 8 9 11.5"/></svg>';
    const repeatSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
    const trashSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
    list.innerHTML=rows.map(function(t){const ok=possible(t),pb=t.kaynakPb||t.hedefPb||'TRY';return '<div class="rf-transfer-row '+(ok?'state-ok':'state-no')+'" title="'+(ok?'Şu an tekrar yapılabilir':'Şu an tekrar yapılamaz')+'"><div class="main"><div class="route"><span class="seg">'+esc(side(t,'k'))+'</span>'+arrowSvg+'<span class="seg">'+esc(side(t,'h'))+'</span></div>'+(t.aciklama?'<div class="note">'+esc(t.aciklama)+'</div>':'<div class="note">'+fmtDate(t.tarih)+'</div>')+'</div><div class="amount"><div class="mono" style="font-weight:800;color:var(--teal)">'+fmtCur(t.tutar,pb)+'</div>'+(t.aciklama?'<div style="color:var(--text3);font-size:10px">'+fmtDate(t.tarih)+'</div>':'')+'</div><div class="act"><button class="ib rf-transfer-tekrar-btn" data-id="'+t.id+'" title="Bu transferi tekrarla" aria-label="Bu transferi tekrarla">'+repeatSvg+'</button><button class="ib danger rf-transfer-sil-btn" data-id="'+t.id+'" title="Sil" aria-label="Sil">'+trashSvg+'</button></div></div>';}).join('');list.querySelectorAll('.rf-transfer-tekrar-btn').forEach(function(btn){btn.addEventListener('click',function(){tekrarlaTransfer(btn.getAttribute('data-id'));});});list.querySelectorAll('.rf-transfer-sil-btn').forEach(function(btn){btn.addEventListener('click',function(){deleteTransfer(btn.getAttribute('data-id'));});});});

  /* kart detay sıralama: mevcut cps motoru */
  function initSort(){['kd-islem-sirala','kd2-islem-sirala'].forEach(function(id){const s=el(id);if(s&&typeof cpsInit==='function')cpsInit(id,{fieldStyle:true,shortLabel:function(v,o){return o.textContent;}});});}
  ['kdRenderIslemler','kd2RenderIslemler'].forEach(function(n){hook(n,function(){later(initSort);});});

  function boot(){run(function(){UI.markActionTables();});run(initSort);run(UI.syncPaymentActions);run(renderStatus);}
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

// [ES module] Bu dört fonksiyon yukarıdaki IIFE tarafından modül-üstü
// let değişkenlerine atanıyor (bkz. dosya başındaki not); artık gerçek
// binding'ler olarak export ediliyor - window köprüsüne gerek yok.
export { _transferLogFiltreItems, openTransferLogFiltrePopup, rfOdTumuDoldur, setTransferLogStatusFilter };
// app-core.js:patchTransferLogApi() bu fonksiyonu wrap-registry üzerinden
// (call/get ile) monkey-patch edebilsin diye kaydediyoruz - eskiden
// window.openTransferLogFiltrePopup üzerinden yapılan aynı işlem.
register('openTransferLogFiltrePopup', openTransferLogFiltrePopup);
