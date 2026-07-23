import { MOB_MORE_ITEM_ID_BY_PAGE, saveData } from './app-core-base.js';
import { DB } from './state.js';
import { hesapFiltre, setHesapFiltre } from '../ui/pages/hesaplar/04-hesap-liste-render.js';
import { renderHesaplar } from '../ui/pages/hesaplar/04-hesap-liste-render.js';
import { attachAllIbanValidations } from '../ui/components/iban-ui.js';
import { applyToAll } from '../ui/components/mobile-nav-tema/05-tarih-input-overlay.js';
import { bindKartlarToolbarEvents, kartlarFiltreOku, kartlarToolbarHtml } from '../ui/pages/kartlar/09-kart-altyapi.js';
import { entegre } from '../domain/hesap-entegrasyon-motoru.js';
import { call, get, has, register } from './wrap-registry.js';
// Bu dosya, temel tanımlar (loadData/applyMigrations/defaultData/saveData/
// showPage/renderAll/showTab — bkz. js/core/app-core-base.js) yerleştirildikten
// SONRA çalışması gereken genel amaçlı wrap/iyileştirme fonksiyonlarını içerir:
// ödeme popup'ı ikon/buton düzeltmeleri, tablo filtre/sıralama tercihlerinin
// kalıcı hâle getirilmesi ve DB şeklinin normalize edilmesi. index.html'de
// kasıtlı olarak geç pozisyonda — renderKartlar/tblSiralamaAyarla/showPage
// gibi isimleri wrap ediyor, o yüzden her şeyin zaten tanımlı olmasına
// ihtiyaç duyuyor.

// ── Ödeme popup'ı: transfer/ikon düzeltmeleri ──────────────────────────────
(function(){
  'use strict';
  function el(id){return document.getElementById(id);}
  function run(fn){try{fn();}catch(e){console.warn('[odeme-icon-fix]',e);}}
  // [ES module] eskiden hook(name,after) window[name]'i doğrudan okuyup
  // window[name]'e geri yazarak wrap ediyordu; artık get/register ile
  // wrap-registry üzerinden aynı zincirleme wrap deseni sağlanıyor.
  function hook(name,after){const old=get(name);if(typeof old!=='function'||old._uiIconFixWrapped)return;const wrapped=function(){const r=old.apply(this,arguments);run(after);return r;};wrapped._uiIconFixWrapped=true;register(name,wrapped);}
  function fixPaymentButtons(){
    const tum=el('od-tumu-btn');
    if(tum && !tum.querySelector('.mhtb-icon svg')){
      tum.innerHTML='<span class="mhtb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 10-12h-7l1-8z"/></svg></span><span class="mhtb-label">Tümü</span>';
    }
    const fast=el('od-hizli-transfer-btn');
    if(fast) fast.title='Hızlı Transfer';
    const fill=el('od-kalan-tamamini-btn');
    if(fill) fill.title='Kalanın Tamamı';
  }
  function fixTransferFilterIcon(){
    const btn=el('transfer-log-filtre-btn');
    if(!btn) return;
    if(btn.querySelector('.rf-bank-filter-ico')) return;
    btn.innerHTML='<svg class="rf-bank-filter-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10h18"/><path d="M5 10l7-5 7 5"/><path d="M5 10v8"/><path d="M9 10v8"/><path d="M15 10v8"/><path d="M19 10v8"/><path d="M4 18h16"/><path d="M7 21h10"/></svg><span id="transfer-log-filtre-label" class="sc-popup-placeholder" style="display:none">Tümü</span><svg class="sc-popup-trigger-chevron" style="display:none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    btn.title='Hesap/Nakit filtresi';
    btn.setAttribute('aria-label','Hesap/Nakit filtresi');
  }
  function refresh(){fixPaymentButtons();fixTransferFilterIcon();}
  ['renderTransferLog','openTransferModal','_odModalSecDurum','_odModalKrediAlanlariAyarla','_kartOdemeHizliTransferGuncelle'].forEach(function(n){hook(n,refresh);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);else refresh();
})();

// ── Tablo filtre/sıralama tercihlerini kalıcı hâle getirme ────────────────
let _tblFiltreKaydetImpl = null, _tblFiltreOkuImpl = null, _tblFiltreOkuMultiImpl = null, _tblFiltreMultiToggleImpl = null, _filterHesapImpl = null;
let _tblFiltrePersistenceInstalled = false; // sadece yazılıyor; başka dosya okumuyor, davranış korunarak module-scope'a alındı
(function(){
  'use strict';

  function ensureRoot(){
    if(typeof DB === 'undefined' || !DB) return null;
    if(!DB.uiFiltreler || typeof DB.uiFiltreler !== 'object') DB.uiFiltreler = {};
    return DB.uiFiltreler;
  }
  function ensurePage(page){
    const root = ensureRoot();
    if(!root) return null;
    if(!root[page] || typeof root[page] !== 'object') root[page] = {};
    return root[page];
  }
  function clone(v){
    if(Array.isArray(v)) return v.slice();
    if(v && typeof v === 'object') return Object.assign({}, v);
    return v;
  }
  function eq(a,b){
    if(a === b) return true;
    try { return JSON.stringify(a) === JSON.stringify(b); } catch(e) { return false; }
  }
  function save(){
    try { if(typeof saveData === 'function') saveData(); } catch(e) {}
  }
  function normalizeMulti(value){
    const arr = Array.isArray(value) ? value.slice() : (value ? [value] : []);
    const seen = Object.create(null), out = [];
    arr.forEach(function(v){
      if(v === '' || v == null) return;
      const k = String(v);
      if(seen[k]) return;
      seen[k] = 1;
      out.push(v);
    });
    return out;
  }
  function aliasWrite(page, key, value){
    if(page === 'tbkAyDetay' && key === 'sirala') {
      const a = ensurePage('tbkAylikOzet'); if(a) a.sirala = value;
    }
    if(page === 'tbkAylikOzet' && key === 'sirala') {
      const b = ensurePage('tbkAyDetay'); if(b) b.sirala = value;
    }
    if(page === 'kartlar' && key === 'durum') {
      const k = ensurePage('kartlar'); if(k) k.status = value;
    }
    if(page === 'kartlar' && key === 'q') {
      const q = ensurePage('kartlar'); if(q) q.arama = value;
    }
    if(page === 'hesaplar' && key === 'durum') {
      const h = ensurePage('hesaplar'); if(h) h.status = value;
    }
  }

  function install(){
    _tblFiltrePersistenceInstalled = true;

    _tblFiltreKaydetImpl = function(sayfa, boyut, deger){
      const p = ensurePage(sayfa);
      if(!p) return deger;
      const old = clone(p[boyut]);
      p[boyut] = clone(deger);
      aliasWrite(sayfa, boyut, p[boyut]);
      if(!eq(old, deger)) save();
      return deger;
    };

    _tblFiltreOkuImpl = function(sayfa, boyut){
      const p = ensurePage(sayfa);
      if(!p) return '';
      const v = p[boyut];
      return v == null ? '' : v;
    };

    _tblFiltreOkuMultiImpl = function(sayfa, boyut){
      const p = ensurePage(sayfa);
      if(!p) return [];
      return normalizeMulti(p[boyut]);
    };

    _tblFiltreMultiToggleImpl = function(sayfa, boyut, deger){
      const p = ensurePage(sayfa);
      if(!p) return [];
      const old = clone(p[boyut]);
      let arr = normalizeMulti(p[boyut]);
      if(deger === '' || deger == null) arr = [];
      else if(arr.indexOf(deger) >= 0) arr = arr.filter(function(x){ return x !== deger; });
      else arr.push(deger);
      p[boyut] = arr;
      aliasWrite(sayfa, boyut, arr);
      if(!eq(old, arr)) save();
      return arr;
    };

    _filterHesapImpl = function(tur){
      try { setHesapFiltre(tur || ''); } catch(e) {}
      _tblFiltreKaydetImpl('hesaplar', 'tur', tur || '');
      if(typeof renderHesaplar === 'function') renderHesaplar();
    };
  }

  install();
  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(install, 0); }, { once:true });
  } else {
    setTimeout(install, 0);
  }
  window.addEventListener('load', function(){ setTimeout(install, 0); setTimeout(install, 150); }, { once:true });
  setTimeout(install, 250);
})();


// ── DB şekli normalizasyonu + tablo filtre wrap'leri ───────────────────────
// NOT: Bu blok bir IIFE olarak yorumlanmıştı ama açılış "(function(){" satırı
// eksikti — kod, module top-level scope'unda sarmalayıcısız çalışıyordu.
// Pratikte çalışma zamanı davranışını bozmuyordu (ES module zaten dosya
// bazlı izole scope sağlıyor, isim çakışması yoktu) ama yorum/niyetle kod
// tutarsızdı ve riskliydi (W, DOC, db, save, clone, eq gibi çok genel adlar
// modül top-level'ına sızmıştı). Eksik açılış eklendi, blok artık gerçekten
// kendi IIFE'sinde izole çalışıyor.
(function(){
  'use strict';

  const W = window;
  const DOC = document;

  const DEFAULT_PREFS = {
    islemler: { kart:'', ay:'', taksit:'', q:'' },
    extreler: { kart:'', durum:'' },
    ozet: { tahminGun:365, odemelerGun:30 },
    mevduat: { durum:'', banka:'' },
    hesaplar: { tur:'' },
    kira: { tur:'', durum:[] },
    maas: { tur:'', durum:[] },
    elden: { tur:'', durum:[] },
    abonelik: { kategori:'', durum:[] },
    kmhkredi: { durum:[] },
    kredi: { tur:'', durum:[] },
    kategoriler: { tur:'' },
    asgariKurallari: { pb:null },
    kartIslem: { sirala:'tarih-yeni' },
    tbkAyDetay: { sirala:'tur-ozel' },
    tbkAylikOzet: { sirala:'tur-ozel' },
    transferLog: { filtre:[], status:'' },
    scPopupSiralama: 'none'
  };

  const MULTI_PATHS = {
    'kira.durum': 1,
    'maas.durum': 1,
    'elden.durum': 1,
    'abonelik.durum': 1,
    'kmhkredi.durum': 1,
    'kredi.durum': 1,
    'transferLog.filtre': 1
  };

  const ALIASES = {
    'tbkAyDetay.sirala': ['tbkAylikOzet.sirala'],
    'tbkAylikOzet.sirala': ['tbkAyDetay.sirala']
  };

  function isObj(v){ return !!v && typeof v === 'object' && !Array.isArray(v); }
  function isArr(v){ return Array.isArray(v); }
  function clone(v){
    if(isArr(v)) return v.slice();
    if(isObj(v)) return Object.assign({}, v);
    return v;
  }
  function eq(a,b){
    if(a === b) return true;
    try{ return JSON.stringify(a) === JSON.stringify(b); }catch(e){ return false; }
  }
  function onceFlag(fn, name){ return !!(fn && fn[name]); }
  function mark(fn, name){ try{ fn[name] = true; }catch(e){} return fn; }
  function safe(label, fn, fallback){
    try{ return fn(); }
    catch(err){
      try{ console.warn('[FinansRefactor]', label, err); }catch(e){}
      return fallback;
    }
  }
  function split(path){ return String(path || '').split('.').filter(Boolean); }
  function pathGet(obj, path, fallback){
    let cur = obj, parts = split(path);
    for(let i=0;i<parts.length;i++){
      if(cur == null) return fallback;
      cur = cur[parts[i]];
    }
    return cur == null ? fallback : cur;
  }
  function pathSet(obj, path, value){
    let parts = split(path), cur = obj;
    for(let i=0;i<parts.length-1;i++){
      const key = parts[i];
      if(!isObj(cur[key])) cur[key] = {};
      cur = cur[key];
    }
    if(parts.length) cur[parts[parts.length-1]] = value;
    return obj;
  }
  function removeDupes(arr){
    const seen = {}, out = [];
    (isArr(arr) ? arr : []).forEach(function(v){
      const k = String(v);
      if(!seen[k]){ seen[k] = 1; out.push(v); }
    });
    return out;
  }
  function deepMergeDefaults(current, defaults){
    if(isArr(defaults)) return isArr(current) ? current.slice() : defaults.slice();
    if(isObj(defaults)){
      const out = isObj(current) ? Object.assign({}, current) : {};
      Object.keys(defaults).forEach(function(k){ out[k] = deepMergeDefaults(out[k], defaults[k]); });
      return out;
    }
    return current == null ? defaults : current;
  }
  function asMulti(value){
    if(isArr(value)) return removeDupes(value.filter(function(v){ return v !== '' && v != null; }));
    return value ? [value] : [];
  }

  let renderQueue = Object.create(null);
  let rafPending = false;
  function flushRenderQueue(){
    rafPending = false;
    const names = Object.keys(renderQueue);
    renderQueue = Object.create(null);
    names.forEach(function(name){
      const fn = W[name];
      if(typeof fn === 'function') safe('render ' + name, function(){ fn(); });
    });
  }
  function queueRender(name){
    if(!name) return;
    renderQueue[name] = 1;
    if(rafPending) return;
    rafPending = true;
    if(typeof W.requestAnimationFrame === 'function') W.requestAnimationFrame(flushRenderQueue);
    else setTimeout(flushRenderQueue, 0);
  }

  function normalizeDb(db){
    db = db || {};
    db.uiFiltreler = deepMergeDefaults(db.uiFiltreler, DEFAULT_PREFS);

    Object.keys(MULTI_PATHS).forEach(function(path){
      pathSet(db.uiFiltreler, path, asMulti(pathGet(db.uiFiltreler, path, [])));
    });

    const sort = pathGet(db.uiFiltreler, 'tbkAyDetay.sirala') || pathGet(db.uiFiltreler, 'tbkAylikOzet.sirala') || DEFAULT_PREFS.tbkAyDetay.sirala;
    pathSet(db.uiFiltreler, 'tbkAyDetay.sirala', sort);
    pathSet(db.uiFiltreler, 'tbkAylikOzet.sirala', sort);

    if(typeof pathGet(db.uiFiltreler, 'transferLog.status') !== 'string') pathSet(db.uiFiltreler, 'transferLog.status', '');
    pathSet(db.uiFiltreler, 'transferLog.filtre', asMulti(pathGet(db.uiFiltreler, 'transferLog.filtre', [])));
    return db;
  }
  function db(){
    // [BUG FIX] Eskiden `if(!W.DB) W.DB = {}; return normalizeDb(W.DB);` idi.
    // window.DB projede artık hiç set edilmediği için (gerçek DB, state.js'in
    // export ettiği modül binding'i olarak yaşıyor) bu her çağrıda W.DB hep
    // boş kalıyor, fonksiyon her seferinde YENİ, KALICI OLMAYAN bir {} objesi
    // yaratıp onu normalize ediyordu — prefGet/prefSet/tblFiltreKaydet/
    // transferLogStatusFiltre gibi bu bloğun tüm tercih/filtre kaydetme
    // mekanizması sessizce gerçek DB'ye değil bu çöp objeye yazıyordu.
    // Artık gerçek (import edilen) DB binding'i normalize edilip kullanılıyor.
    return normalizeDb(DB);
  }
  function save(changed){
    if(!changed) return;
    // [BUG FIX] Eskiden `if(typeof W.saveData==='function') safe('saveData',function(){W.saveData();});`
    // idi. window.saveData artık hiç set edilmediği için bu her zaman false
    // dönüyordu — prefSet() ile değiştirilen tercih/filtre ayarları
    // (transferLog durumu, tablo filtreleri vb.) hiçbir zaman diske
    // kaydedilmiyordu. saveData zaten dosya başında gerçek import olarak
    // mevcut, doğrudan çağrılıyor.
    safe('saveData', function(){ saveData(); });
  }

  function prefGet(page, key, fallback){
    const root = db().uiFiltreler;
    const val = pathGet(root, page + '.' + key, fallback);
    return val == null ? fallback : val;
  }
  function prefSet(page, key, value, opts){
    opts = opts || {};
    const root = db().uiFiltreler;
    const path = page + '.' + key;
    if(MULTI_PATHS[path]) value = asMulti(value);
    let changed = !eq(pathGet(root, path), value);
    pathSet(root, path, clone(value));

    (ALIASES[path] || []).forEach(function(aliasPath){
      changed = !eq(pathGet(root, aliasPath), value) || changed;
      pathSet(root, aliasPath, clone(value));
    });

    save(changed && opts.save !== false);
    return value;
  }
  function prefGetMulti(page, key){ return asMulti(prefGet(page, key, [])); }
  function prefToggleMulti(page, key, value, opts){
    let arr = prefGetMulti(page, key);
    if(value === '' || value == null) arr = [];
    else if(arr.indexOf(value) >= 0) arr = arr.filter(function(v){ return v !== value; });
    else arr.push(value);
    return prefSet(page, key, arr, opts);
  }

  function setDateField(idOrEl, value){
    if(!idOrEl) return false;
    const el = typeof idOrEl === 'string' ? DOC.getElementById(idOrEl) : idOrEl;
    if(!el) return false;
    if(typeof W.setDateInputValue === 'function'){
      return safe('setDateInputValue', function(){
        if(typeof idOrEl === 'string') W.setDateInputValue(idOrEl, value);
        else W.setDateInputValue(el.id, value);
        return true;
      }, false);
    }
    el.value = value || '';
    el.dispatchEvent(new Event('input', { bubbles:true }));
    el.dispatchEvent(new Event('change', { bubbles:true }));
    return true;
  }

  function ensureSelectIconRemoved(scope){
    const root = scope || DOC;
    safe('remove select popup icon', function(){
      const modal = root.querySelector ? (root.querySelector('#modal-tbk-ay-detay') || root) : DOC;
      Array.prototype.forEach.call(modal.querySelectorAll('#tbk-ay-detay-sort .sel-icon, .tbk-ay-detail-sort .sel-icon, [data-tbk-sort] .sel-icon'), function(node){
        node.remove();
      });
    });
  }

  function patchFactories(){
    if(typeof W.applyMigrations === 'function' && !onceFlag(W.applyMigrations, '_dbShapeFix')){
      const oldApply = W.applyMigrations;
      W.applyMigrations = mark(function(data){ return normalizeDb(oldApply.apply(this, arguments)); }, '_dbShapeFix');
    }
    if(typeof W.defaultData === 'function' && !onceFlag(W.defaultData, '_dbShapeFix')){
      const oldDefault = W.defaultData;
      W.defaultData = mark(function(){ return normalizeDb(oldDefault.apply(this, arguments)); }, '_dbShapeFix');
    }
    if(typeof W.saveData === 'function' && !onceFlag(W.saveData, '_dbShapeFix')){
      const oldSave = W.saveData;
      W.saveData = mark(function(){ normalizeDb(DB); return oldSave.apply(this, arguments); }, '_dbShapeFix');
    }
  }

  function tblFiltreKaydet(sayfa, boyut, deger){ return prefSet(sayfa, boyut, deger); }
  function tblFiltreOku(sayfa, boyut){ return prefGet(sayfa, boyut, '') || ''; }
  function tblFiltreOkuMulti(sayfa, boyut){ return prefGetMulti(sayfa, boyut); }
  function tblFiltreMultiToggle(sayfa, boyut, deger){ return prefToggleMulti(sayfa, boyut, deger); }

  function patchFilterHelpers(){
    W.tblFiltreKaydet = mark(tblFiltreKaydet, '_dbShapeFix');
    W.tblFiltreOku = mark(tblFiltreOku, '_dbShapeFix');
    W.tblFiltreOkuMulti = mark(tblFiltreOkuMulti, '_dbShapeFix');
    W.tblFiltreMultiToggle = mark(tblFiltreMultiToggle, '_dbShapeFix');
  }

  function patchMonthlyDetailApi(){
    const oldSortChange = W.tbkAyDetaySiralamaDegisti;
    W.tbkAyDetaySiralamaDegisti = mark(function(value){
      const selected = prefSet('tbkAyDetay', 'sirala', value || DEFAULT_PREFS.tbkAyDetay.sirala);
      if(W.TbkMonthlyDetailUI && typeof W.TbkMonthlyDetailUI.setSort === 'function') W.TbkMonthlyDetailUI.setSort(selected);
      else if(typeof oldSortChange === 'function') oldSortChange(selected);
      ensureSelectIconRemoved(DOC);
      return selected;
    }, '_dbShapeFix');

    const oldOpen = W.tbkAyDetayAc;
    if(typeof oldOpen === 'function' && !onceFlag(oldOpen, '_dbShapeFixOpenModal')){
      W.tbkAyDetayAc = mark(function(ayKey){
        const result = oldOpen.apply(this, arguments);
        setTimeout(function(){ ensureSelectIconRemoved(DOC); }, 0);
        setTimeout(function(){ ensureSelectIconRemoved(DOC); }, 80);
        return result;
      }, '_dbShapeFixOpenModal');
    }
  }

  function patchTransferLogApi(){
    W.getTransferLogPrefs = function(){ return prefGet('transferLog', 'filtre', []), db().uiFiltreler.transferLog; };
    W.transferLogStatusFiltre = W.setTransferLogStatusFiltre = mark(function(value){
      const selected = prefSet('transferLog', 'status', value || '');
      queueRender('renderTransferLog');
      return selected;
    }, '_dbShapeFix');
    const oldPopup = get('openTransferLogFiltrePopup');
    if(typeof oldPopup === 'function' && !onceFlag(oldPopup, '_dbShapeFix')){
      register('openTransferLogFiltrePopup', mark(function(){ normalizeDb(DB); return oldPopup.apply(this, arguments); }, '_dbShapeFix'));
    }
  }

  function patchMevduatVisibility(){
    W.mevduatYaklasanOdemedeGoster = mark(function(m){
      if(!m) return false;
      const durum = m.odDurum && m.odDurum.durum;
      if(durum === 'iptal') return false;
      if(m._silindi || m.silindi) return false;
      // Vadesize aktarılan / vadesi bitmiş mevduat listede kalır; sadece erken iptal gizlenir.
      if(m._kapatildi && (m._erkenKapatildi || m.erkenKapatildi || m.kapatmaTipi === 'erken' || m.kapatmaTipi === 'iptal')) return false;
      return !!(m.bitisTarihi || m.vadeTarihi || m.tarih);
    }, '_dbShapeFix');
  }

  function boot(){
    normalizeDb(DB);
    patchFactories();
    patchFilterHelpers();
    patchMonthlyDetailApi();
    patchTransferLogApi();
    patchMevduatVisibility();
    ensureSelectIconRemoved(DOC);
  }

  W.FinansCore = Object.assign(W.FinansCore || {}, {
    safe: safe,
    isObj: isObj,
    clone: clone,
    pathGet: pathGet,
    pathSet: pathSet,
    normalizeDb: normalizeDb,
    queueRender: queueRender,
    setDateField: setDateField,
    removeTbkSelectIcon: ensureSelectIconRemoved
  });

  W.FinansUiPrefs = {
    defaults: DEFAULT_PREFS,
    normalize: normalizeDb,
    get: prefGet,
    set: prefSet,
    getMulti: prefGetMulti,
    toggleMulti: prefToggleMulti,
    page: function(pageName){ return db().uiFiltreler[pageName]; }
  };
  W.normalizeDbPrefs = function(){ return normalizeDb(DB); };

  if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
  W.addEventListener('load', boot, { once:true });
})();

// ── Birleşik "procedural pass" sistemi ───────────────────────────────────
// Aşağıdaki blok, render fonksiyonlarını sarmalayıp kendi RAF turunda bir
// DOM-temizleme/senkronizasyon "pass"ı tetikleyen birkaç alt-sistemi
// (performans ölçümü, tablo etiketleme, basit/gelişmiş chip kaydırma,
// görsel cila, dokunma hedefi/taşma denetimi) TEK bir merkezi RAF
// scheduler altında birleştirir — her alt-sistemin DOM-pass mantığı
// (sorgu/seçici/sınıf-adı/timing) birebir korunmuştur, sadece ayrı ayrı
// zamanlayıcılar yerine tek bir zamanlayıcı ve tek bir birleşik fonksiyon
// listesi kullanılıyor. Konsoldan manuel tetikleme/inceleme için
// window.FinansUiMaintenance altında tek bir debug API'si sunuluyor.
(function(){
  'use strict';
  // [ES module] window.__rfProceduralPassMerged bayrağı kaldırıldı — ES
  // modülleri, kaç dosyadan import edilirse edilsin yalnızca bir kez
  // evaluate edilir, bu yüzden bayrağa gerek yoktu.

  const W = window;
  const D = document;

  // ---- ortak yardımcılar ----
  function safe(label, fn){
    try { return fn(); }
    catch(e) { try { if(W.console && console.warn) console.warn('[procedural]', label, e); } catch(_){} }
  }
  function now(){ return (W.performance && performance.now) ? performance.now() : Date.now(); }
  function visible(el){
    if(!el) return false;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  }
  function activePage(){ return D.querySelector('.page.active') || D.getElementById('page-ozet'); }

  // ---- perfPass: modal/topbar/required-label/select-placeholder/table-label/kart-toolbar/tbk-popup ----
  const perfPass = {
    passCount: 0, lastPass: 0, slowPasses: [],
    syncModalOpenClass: function(){
      const open = !!D.querySelector('.modal-bg.open');
      if(D.body) D.body.classList.toggle('modal-open', open);
    },
    syncMoreMenuActive: function(){
      const page = D.querySelector('.page.active');
      if(!page) return;
      const pageId = (page.id || '').replace(/^page-/, '');
      // [ES module] Eskiden onclick attribute içeriği okunarak eşleştiriliyordu;
      // onclick temizliği sonrası HTML'de bu attribute yok, sabit id haritası
      // (MOB_MORE_ITEM_ID_BY_PAGE) kullanılıyor.
      const activeItemId = MOB_MORE_ITEM_ID_BY_PAGE[pageId];
      D.querySelectorAll('.mob-more-item').forEach(function(item){
        item.classList.toggle('active', !!activeItemId && item.id === activeItemId);
      });
    },
    syncTopbarTitle: function(){
      const page = D.querySelector('.page.active');
      if(!page) return;
      const pageId = (page.id || '').replace(/^page-/, '');
      const meta = {
        ozet:['📊','Finansal Özet'], kartlar:['💳','Kredi Kartları'], islemler:['⇄','İşlemler'], extreler:['🧾','Ekstreler'],
        mevduat:['🏦','Mevduat Takibi'], kira:['🏠','Kira Gelirleri'], maas:['💰','Maaş Geliri'], kmhkredi:['🏦','KMH Kredisi'],
        kredi:['💳','Bireysel Krediler'], hesaplar:['🏧','Banka Hesapları'], elden:['💵','Elden Ödemeler'], tanimlamalar:['⚙️','Tanımlamalar'], abonelik:['🔄','Abonelikler']
      }[pageId];
      if(!meta) return;
      const iconEl = D.getElementById('topbar-icon');
      const labelEl = D.getElementById('topbar-label');
      if(iconEl) iconEl.textContent = meta[0];
      if(labelEl) labelEl.textContent = meta[1];
    },
    syncRequiredLabels: function(){
      const root = D.querySelector('.modal-bg.open .modal') || D.querySelector('.page.active');
      if(!root) return;
      root.querySelectorAll('input[required],select[required],textarea[required]').forEach(function(el){
        let label = el.id ? root.querySelector('label[for="' + el.id + '"]') : null;
        if(!label) {
          const parent = el.closest('.form-group,.field,.form-field,div');
          label = parent && parent.querySelector('label');
        }
        if(!label || label.dataset.reqMark || label.textContent.indexOf('*') >= 0) return;
        label.dataset.reqMark = '1';
        const star = D.createElement('span');
        star.className = 'req-star';
        star.textContent = ' *';
        star.style.cssText = 'color:var(--danger);font-weight:700;font-size:.85em;';
        label.appendChild(star);
      });
    },
    syncSelectPlaceholder: function(){
      const root = D.querySelector('.modal-bg.open') || D.querySelector('.page.active') || D;
      root.querySelectorAll('select').forEach(function(sel){
        sel.classList.toggle('ph', sel.value === '' || sel.value === null);
        if(!sel.dataset.rf85PhBound){
          sel.dataset.rf85PhBound = '1';
          sel.addEventListener('change', function(){ sel.classList.toggle('ph', sel.value === '' || sel.value === null); }, { passive:true });
        }
      });
    },
    syncTableLabels: function(){
      const root = D.querySelector('.page.active') || D;
      root.querySelectorAll('table').forEach(function(table){
        const headers = Array.prototype.map.call(table.querySelectorAll('thead th'), function(th){ return th.textContent.trim(); });
        if(!headers.length) return;
        table.querySelectorAll('tbody tr').forEach(function(tr){
          if(tr.classList.contains('empty-row') || tr.dataset.rf85LblDone) return;
          tr.dataset.rf85LblDone = '1';
          tr.querySelectorAll('td').forEach(function(td, i){ if(headers[i] && !td.dataset.label) td.dataset.label = headers[i]; });
        });
      });
    },
    forceNativeKartToolbar: function(){
      if(typeof kartlarToolbarHtml !== 'function') return;
      const bar = D.getElementById('kartlar-siralama-bar');
      if(!bar) return;
      const cards = Array.isArray(DB.kartlar) ? DB.kartlar.filter(function(k){ return !k.silindi; }) : [];
      const sayac = {
        tumu: cards.length,
        aktif: cards.filter(function(k){ return (k.durum || 'aktif') !== 'pasif'; }).length,
        pasif: cards.filter(function(k){ return (k.durum || 'aktif') === 'pasif'; }).length
      };
      let sirala = { key:'ad', yon:'asc' };
      if(typeof W.tblSiralamaOku === 'function') {
        try { sirala = W.tblSiralamaOku('kartlar', 'ad', 'asc'); } catch(e) {}
      }
      const existingBar = bar.querySelector('.kartlar-filtre-bar');
      if(!existingBar) {
        bar.innerHTML = kartlarToolbarHtml(sirala, kartlarFiltreOku ? kartlarFiltreOku() : null, sayac);
        if (typeof bindKartlarToolbarEvents === 'function') bindKartlarToolbarEvents(bar);
      } else {
        // Toolbar zaten DOM'da: input'un focus/imleç konumunu bozmadan
        // sadece durum sayaçlarını ve aktif filtre chip'ini güncelle.
        const tumuEl = existingBar.querySelector('[data-kart-durum=""] .tbl-filtre-chip-count');
        const aktifEl = existingBar.querySelector('[data-kart-durum="aktif"] .tbl-filtre-chip-count');
        const pasifEl = existingBar.querySelector('[data-kart-durum="pasif"] .tbl-filtre-chip-count');
        if(tumuEl) tumuEl.textContent = sayac.tumu;
        if(aktifEl) aktifEl.textContent = sayac.aktif;
        if(pasifEl) pasifEl.textContent = sayac.pasif;
      }
    },
    syncKartToolbar: function(){
      perfPass.forceNativeKartToolbar();
      // NOT: burada eskiden W.kartlarFiltreUygulaDom() de çağrılıyordu.
      // O fonksiyon renderKartlar()'ı skipToolbar OLMADAN çağırıyor, yani
      // toolbar (arama input'u dahil) her RAF'ta yeniden basılıyordu.
      // renderKartlar zaten kendi input/durum-chip event handler'larından
      // tetikleniyor; burada tekrar çağırmak gereksiz ve her tuş
      // vuruşunda arama kutusunun focus'unu (ve imleç konumunu)
      // kaybettiriyordu. Kaldırıldı.
      if(typeof W.kartlarSeciliSiralamaKaydir === 'function') W.kartlarSeciliSiralamaKaydir(false);
    },
    syncTbkPopup: function(){
      const modal = D.getElementById('modal-tbk-ay-detay');
      if(!modal || !modal.classList.contains('open')) return;
      const infoText = /Bu\s+kalem\s+nakit\s+akış\s+bilgisidir;\s*toplam\s+bakiye\s+hesabında\s+çift\s+sayılmaması\s+için\s+bilgi\s+olarak\s+gösterilir\.?/i;
      modal.querySelectorAll('.info-box,.hint,.muted,.tbk-row-note,.tbk-info').forEach(function(el){ if(infoText.test(el.textContent || '')) el.remove(); });
    },
    run: function(reason){
      const t0 = now();
      perfPass.passCount++;
      safe('modal', perfPass.syncModalOpenClass);
      safe('more-menu', perfPass.syncMoreMenuActive);
      safe('topbar', perfPass.syncTopbarTitle);
      safe('required-labels', perfPass.syncRequiredLabels);
      safe('select-placeholder', perfPass.syncSelectPlaceholder);
      safe('table-labels', perfPass.syncTableLabels);
      safe('kart-toolbar', perfPass.syncKartToolbar);
      safe('tbk-popup', perfPass.syncTbkPopup);
      perfPass.lastPass = now() - t0;
      if(perfPass.lastPass > 24) perfPass.slowPasses.push({ reason:reason, ms:Math.round(perfPass.lastPass) });
    }
  };

  // ---- tableLabelPass: tablo label (ikinci geçiş), iban validasyon, date overlay, topbar entegre, kart toolbar polish ----
  const tableLabelPass = {
    updateTopbarProcedural: function(){
      if(entegre && typeof entegre.yenile === 'function') entegre.yenile();
    },
    labelizeTablesProcedural: function(){
      D.querySelectorAll('.tbl-wrap table:not([data-rf86-labeled])').forEach(function(table){
        table.dataset.rf86Labeled = '1';
        const headers = [];
        table.querySelectorAll('thead th').forEach(function(th){
          const clone = th.cloneNode(true);
          clone.querySelectorAll('button, svg, .btn').forEach(function(el){ el.remove(); });
          headers.push((clone.textContent || '').trim());
        });
        if(!headers.length) return;
        table.querySelectorAll('tbody tr').forEach(function(tr){
          if(tr.classList.contains('empty-row')) return;
          tr.querySelectorAll('td').forEach(function(td, i){
            if(headers[i] && !td.dataset.label) td.dataset.label = headers[i];
          });
        });
      });
    },
    attachDynamicIbanProcedural: function(){
      attachAllIbanValidations();
    },
    applyDateOverlaysProcedural: function(){
      applyToAll();
    },
    polishKartToolbar: function(){
      const row = D.querySelector('#kartlar-siralama-bar .kartlar-siralama-wrap, #kartlar-siralama-bar .kartlar-siralama-wrap-native');
      const active = row && row.querySelector('.sort-chip.active');
      if(!row || !active) return;
      const max = Math.max(0, row.scrollWidth - row.clientWidth);
      if(max <= 1) return;
      const target = active.offsetLeft - row.clientWidth / 2 + active.offsetWidth / 2;
      row.scrollLeft = Math.max(0, Math.min(max, target));
    },
    run: function(){
      safe('table-labels-2', tableLabelPass.labelizeTablesProcedural);
      safe('date-overlays', tableLabelPass.applyDateOverlaysProcedural);
      safe('iban-validate', tableLabelPass.attachDynamicIbanProcedural);
      safe('kart-toolbar-polish', tableLabelPass.polishKartToolbar);
    }
  };

  // ---- simpleChipScrollPass: sort/filter chip bar'ını aktif chip'e kaydır (basit sürüm) ----
  const simpleChipScrollPass = {
    run: function(){
      safe('chip-scroll', function(){
        D.querySelectorAll('.tbl-siralama-bar').forEach(function(row){
          const active = row.querySelector('.sort-chip.active, .filter-chip.active');
          if(!active) return;
          const max = Math.max(0, row.scrollWidth - row.clientWidth);
          if(max <= 1) return;
          const target = active.offsetLeft - row.clientWidth / 2 + active.offsetWidth / 2;
          row.scrollLeft = Math.max(0, Math.min(max, target));
        });
      });
    }
  };

  // ---- clickScrollPass: clickable normalize + scrollable mark + chip center (root=activePage) ----
  const clickScrollPass = {
    centerActiveChip: function(root, smooth){
      root = root || D;
      root.querySelectorAll('.tbl-siralama-bar,.kartlar-siralama-wrap,[data-rf-sort-row]').forEach(function(row){
        if(!visible(row)) return;
        const active = row.querySelector('.sort-chip.active,.filter-chip.active,[aria-pressed="true"]');
        if(!active) return;
        const max = Math.max(0, row.scrollWidth - row.clientWidth);
        if(max <= 1) return;
        let target = active.offsetLeft - row.clientWidth / 2 + active.offsetWidth / 2;
        target = Math.max(0, Math.min(max, target));
        try { row.scrollTo({left:target, behavior:smooth ? 'smooth' : 'auto'}); }
        catch(e){ row.scrollLeft = target; }
      });
    },
    markScrollable: function(root){
      root = root || D;
      root.querySelectorAll('.tbl-wrap,.tbl-filtre-bar,.tbl-siralama-bar,.mev-durum-filtre-row,.kartlar-filtre-bar,.kartlar-siralama-wrap').forEach(function(el){
        if(!visible(el)) return;
        const hasX = el.scrollWidth > el.clientWidth + 3;
        const hasY = el.scrollHeight > el.clientHeight + 3;
        el.classList.toggle('rf-scroll-x', hasX);
        el.classList.toggle('rf-scroll-y', hasY);
        if(hasX) el.setAttribute('data-scroll-x','1'); else el.removeAttribute('data-scroll-x');
        if(hasY) el.setAttribute('data-scroll-y','1'); else el.removeAttribute('data-scroll-y');
      });
    },
    normalizeClickable: function(root){
      root = root || D;
      root.querySelectorAll('button,.filter-chip,.sort-chip,.chip-select-opt,.tbk-period-btn,.islem-donem-tab,[role="button"]').forEach(function(el){
        if(!el.hasAttribute('type') && el.tagName === 'BUTTON') el.setAttribute('type','button');
        el.setAttribute('data-rf-clickable','1');
      });
    },
    run: function(){
      const root = activePage() || D;
      safe('clickScrollPass-clickable', function(){ clickScrollPass.normalizeClickable(root); });
      safe('clickScrollPass-scrollable', function(){ clickScrollPass.markScrollable(root); });
      safe('clickScrollPass-center-chip', function(){ clickScrollPass.centerActiveChip(root, false); });
    }
  };

  // ---- visualPolishPass: click-target normalize + scroll-wrap mark (ikinci, farklı seçici seti) ----
  const visualPolishPass = {
    run: function(){
      safe('visualPolishPass-visual-polish', function(){
        const root = activePage() || D;
        root.querySelectorAll('.tbl-filtre-clear,.snav-mobile-menu,.nb-logbtn,.card button,.tbl-wrap button').forEach(function(el){
          if(el.tagName === 'BUTTON' && !el.hasAttribute('type')) el.setAttribute('type','button');
          el.setAttribute('data-rf97-click-target','1');
        });
        root.querySelectorAll('.tbl-wrap').forEach(function(wrap){
          wrap.setAttribute('data-rf97-scroll-wrap', wrap.scrollWidth > wrap.clientWidth + 3 ? 'x' : '');
        });
      });
    }
  };

  // ---- qaPass: modal state + touch-target normalize + chip scroll (üçüncü) + overflow denetimi ----
  const qaPass = {
    lastOverflow: [],
    clampBodyOverflow: function(){
      const bad = [];
      const w = W.innerWidth || D.documentElement.clientWidth || 0;
      D.querySelectorAll('body *').forEach(function(el){
        if(!el || !el.getBoundingClientRect || el.closest('.modal-bg:not(.open)')) return;
        const cs = W.getComputedStyle(el);
        if(cs.display === 'none' || cs.visibility === 'hidden') return;
        const r = el.getBoundingClientRect();
        if(r.width > w + 4 || r.right > w + 6 || r.left < -6) {
          if(el.classList && (el.matches('table,.tbl-wrap,.tbl-filtre-bar,.tbl-siralama-bar,.tabs,.tab-row,.filter-row,.action-row') || el.scrollWidth > el.clientWidth + 4)) {
            el.classList.add('rf99-scroll-x');
          }
          bad.push({tag:el.tagName, id:el.id || '', cls:String(el.className || '').slice(0,80), right:Math.round(r.right), width:Math.round(r.width)});
        }
      });
      qaPass.lastOverflow = bad.slice(0,30);
      W.__rf99LastOverflow = qaPass.lastOverflow;
    },
    normalizeTouchTargets: function(root){
      root = root || activePage() || D.body;
      root.querySelectorAll('button,.btn,.filter-chip,.sort-chip,.tab-btn,.btn-act,a[onclick],[role="button"]').forEach(function(el){
        const r = el.getBoundingClientRect();
        if(r.width > 0 && r.height > 0 && r.height < 32) el.classList.add('rf99-touch-target');
      });
    },
    scrollActiveChips: function(root){
      root = root || D;
      root.querySelectorAll('.tbl-siralama-bar,.tbl-filtre-bar,.tabs,.tab-row,.filter-row,#kartlar-siralama-bar').forEach(function(row){
        if(row.scrollWidth <= row.clientWidth + 2) return;
        const active = row.querySelector('.active,[aria-pressed="true"]');
        if(!active) return;
        const target = active.offsetLeft - row.clientWidth / 2 + active.offsetWidth / 2;
        const max = Math.max(0, row.scrollWidth - row.clientWidth);
        row.scrollLeft = Math.max(0, Math.min(max, target));
      });
    },
    ensureModalState: function(){
      const open = D.querySelector('.modal-bg.open');
      D.body.classList.toggle('modal-open', !!open);
      if(open){
        const body = open.querySelector('.modal-body');
        if(body) body.scrollTop = Math.max(0, Math.min(body.scrollTop, body.scrollHeight));
      }
    },
    run: function(){
      safe('qaPass-modal-state', qaPass.ensureModalState);
      safe('qaPass-touch-targets', function(){ qaPass.normalizeTouchTargets(); });
      safe('qaPass-chip-scroll', function(){ qaPass.scrollActiveChips(); });
      safe('qaPass-overflow', qaPass.clampBodyOverflow);
    }
  };

  // ---- Merkezi RAF scheduler: tüm pass'leri tek karede, sırayla çalıştırır ----
  let rafId = 0;
  function runAllPasses(reason){
    rafId = 0;
    perfPass.run(reason);
    tableLabelPass.run();
    simpleChipScrollPass.run();
    clickScrollPass.run();
    visualPolishPass.run();
    qaPass.run();
  }
  function schedule(reason){
    if(rafId) return;
    rafId = (W.requestAnimationFrame || function(cb){ return setTimeout(cb, 16); })(function(){ runAllPasses(reason); });
  }

  // ---- Render fonksiyonlarını TEK bir listeyle, TEK seferde sarmala ----
  // (Önceki 6 patch'in ayrı ayrı sarmaladığı fonksiyon isimlerinin birleşimi.)
  const RENDER_FNS = [
    'renderAll','renderOzet','renderKartlar','renderIslemler','renderExtreler','renderMevduat','renderKira','renderMaas',
    'renderKmhKredi','renderKredi','renderHesaplar','renderElden','renderTanimlamalar','renderAbonelik',
    'showPage','showTab','renderPage','openModal','closeModal',
    'tbkAyDetayAc','renderTbkAyDetay','tbkAyDetayRender','openTransferModal','confirmTumVeriRestore'
  ];
  const SAVE_FNS = ['saveData','saveDB'];

  function wrapRender(name){
    const old = W[name];
    if(typeof old !== 'function' || old._rfProceduralWrapped) return;
    W[name] = function(){
      const result = old.apply(this, arguments);
      schedule(name);
      return result;
    };
    W[name]._rfProceduralWrapped = true;
  }
  function wrapSave(name){
    const old = W[name];
    if(typeof old !== 'function' || old._rfProceduralWrapped) return;
    W[name] = function(){
      const result = old.apply(this, arguments);
      safe('save-topbar', tableLabelPass.updateTopbarProcedural);
      return result;
    };
    W[name]._rfProceduralWrapped = true;
  }

  RENDER_FNS.forEach(wrapRender);
  SAVE_FNS.forEach(wrapSave);

  // ---- Olay dinleyicileri (önceki 6 patch'in dinleyicilerinin birleşimi) ----
  D.addEventListener('keydown', function(e){
    if(e.key !== 'Escape') return;
    const modals = Array.prototype.slice.call(D.querySelectorAll('.modal-bg.open'));
    const top = modals[modals.length - 1];
    if(top) {
      const closeBtn = top.querySelector('.close-btn, [onclick*="close"]');
      if(closeBtn) closeBtn.click();
      else if(typeof W.closeModal === 'function') W.closeModal(top.id);
      else top.classList.remove('open');
      schedule('escape-modal');
      return;
    }
    const moreMenu = D.getElementById('mob-more-menu');
    if(moreMenu && moreMenu.classList.contains('open') && typeof W.closeMobMore === 'function') W.closeMobMore();
  }, true);

  D.addEventListener('click', function(e){
    if(e.target.classList && e.target.classList.contains('modal-bg') && e.target.classList.contains('open')) {
      const closeBtn = e.target.querySelector('.close-btn');
      if(closeBtn) closeBtn.click();
    }
    if(e.target.closest && e.target.closest('.nav-btn,.mob-nav-btn,.mob-more-item,.modal-bg,.close-btn,.filter-chip,.sort-chip,.btn,button,.nav-item,.mob-nav-item,.snav-item')) {
      schedule('click');
    }
    // clickScrollPass'nın orijinal davranışı: belirli chip/sekme tıklamalarında ayrıca 40ms
    // gecikmeli, "smooth" kaydırmalı bir merkezleme yapıyordu — bu ayrı davranış
    // (RAF pass'inden bağımsız, smooth:true) olduğu için korunuyor.
    if(e.target.closest && e.target.closest('.filter-chip,.sort-chip,.tbk-period-btn,.islem-donem-tab,.chip-select-opt,.cps-opt,[data-page],.mob-nav-btn,.nav-btn')){
      setTimeout(function(){
        const root = activePage() || D;
        clickScrollPass.centerActiveChip(root, true);
        clickScrollPass.markScrollable(root);
      }, 40);
    }
  }, true);

  D.addEventListener('change', function(e){ if(e.target.matches('select,input,textarea')) schedule('change'); }, true);
  D.addEventListener('input', function(e){
    if(e.target && e.target.matches && e.target.matches('input,select,textarea')) schedule('input');
  }, true);
  window.addEventListener('resize', function(){ schedule('resize'); }, {passive:true});
  window.addEventListener('orientationchange', function(){ setTimeout(function(){ schedule('orientation'); }, 80); }, {passive:true});

  // ---- Konsoldan manuel tetikleme/inceleme için debug API'si ----
  W.FinansUiMaintenance = {
    refresh: function(){ schedule('manual'); },
    perf: {
      refresh: function(){ schedule('manual-perfPass'); },
      metrics: function(){ return { passCount:perfPass.passCount, lastPassMs:Math.round(perfPass.lastPass), slowPasses:perfPass.slowPasses.slice(-12) }; }
    },
    tables: {
      refresh: function(){ schedule('manual-tableLabelPass'); },
      labelizeTables: tableLabelPass.labelizeTablesProcedural,
      applyDateOverlays: tableLabelPass.applyDateOverlaysProcedural,
      attachIban: tableLabelPass.attachDynamicIbanProcedural
    },
    scroll: {
      refresh: function(){ schedule('manual-clickScrollPass'); },
      centerActiveChip: function(){ clickScrollPass.centerActiveChip(D, true); },
      audit: function(){
        const active = activePage() || D;
        return {
          activePage: (D.querySelector('.page.active') || {}).id,
          scrollX: Array.prototype.slice.call(active.querySelectorAll('[data-scroll-x="1"]')).length,
          scrollY: Array.prototype.slice.call(active.querySelectorAll('[data-scroll-y="1"]')).length,
          clickable: Array.prototype.slice.call(active.querySelectorAll('[data-rf-clickable="1"]')).length,
          docOverflow: D.documentElement.scrollWidth - innerWidth
        };
      }
    },
    visualPolish: { refresh: function(){ schedule('manual-visualPolishPass'); } },
    qa: {
      refresh: function(){ schedule('manual-qaPass'); },
      overflow: function(){ qaPass.clampBodyOverflow(); return qaPass.lastOverflow || []; },
      metrics: function(){
        const w = W.innerWidth || 0;
        const buttons = Array.prototype.slice.call(D.querySelectorAll('button,.btn,.filter-chip,.sort-chip,.tab-btn,.btn-act')).filter(function(el){
          const r = el.getBoundingClientRect(), cs = W.getComputedStyle(el);
          return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
        });
        const small = buttons.filter(function(el){ const r = el.getBoundingClientRect(); return r.width < 30 || r.height < 30; }).length;
        qaPass.clampBodyOverflow();
        return {
          active: (activePage() || {}).id || '',
          width: w,
          bodyOverflow: Math.max(0, D.body.scrollWidth - w),
          overflow: (qaPass.lastOverflow || []).length,
          buttons: buttons.length,
          smallTargets: small,
          modals: D.querySelectorAll('.modal-bg.open').length
        };
      }
    }
  };

  // ---- İlk çalıştırma ----
  if(D.readyState === 'loading') D.addEventListener('DOMContentLoaded', function(){ schedule('domready'); }, { once:true });
  else schedule('boot');
  W.addEventListener('load', function(){ schedule('load'); }, { once:true });
})();

// [ES module] Yukarıdaki "DB şekli normalizasyonu" IIFE'si tblFiltre*
// fonksiyonlarını kendi kapalı scope'unda tanımlayıp modül üstü
// (_tblFiltreKaydetImpl vb.) mutable pointer'lara yazıyordu. Başka dosyalar
// bunları statik `import` ile kullanabilsin diye, aynı isimlerle burada —
// modülün gerçek top-level'ında — köprü fonksiyonlar tanımlanıyor. Her
// çağrıldığında güncel pointer'ı çağırır; davranış birebir aynı kalır.
export function tblFiltreKaydet(...args) { return _tblFiltreKaydetImpl(...args); }
export function tblFiltreOku(...args) { return _tblFiltreOkuImpl(...args); }
export function tblFiltreOkuMulti(...args) { return _tblFiltreOkuMultiImpl(...args); }
export function tblFiltreMultiToggle(...args) { return _tblFiltreMultiToggleImpl(...args); }
export function filterHesap(...args) { return _filterHesapImpl(...args); }
