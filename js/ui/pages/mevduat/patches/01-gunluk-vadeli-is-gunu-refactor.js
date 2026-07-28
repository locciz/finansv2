// ============================================================
// js/ui/pages/mevduat/patches/01-gunluk-vadeli-is-gunu-refactor.js
// Günlük vadeli hesap açma — iş günü/hafta sonu refactor patch'i
// (orijinal adı: patch-rf-v57-daily-deposit-business-day-refactor.js)
//
// Kendi kendine yeten tek bir (function(){...})() olduğu için
// BÖLÜNMEDEN, olduğu gibi aktarıldı.
// ============================================================
import { DB } from '@core/state.js';
import { provide as _provide } from '@core/container.js';
(function(){
  'use strict';

  const W = window;
  const DOC = document;
  const DAY_MS = 86400000;
  const CFG = {
    startInputId: 'mev-baslangic',
    maturityInputId: 'mev-vade',
    maxHolidayRangeDays: 370,
    maxBusinessDayScan: 370,
    stabilizeDelays: [0, 80]
  };

  function pad2(value){ return String(value).padStart(2, '0'); }
  // [BUG FIX] Eskiden `function db(){ return W.DB || {}; }` idi. window.DB
  // artık hiç set edilmediği için (gerçek DB, state.js'in export ettiği
  // modül binding'i) bu her zaman {} dönüyordu — db().tatiller ve
  // db().mevduatlar da bu yüzden hep boş/undefined kalıyor, iş günü/hafta
  // sonu hesaplamaları ve mevduat listesi güncellemeleri hiç çalışmıyordu.
  function db(){ return DB || {}; }
  function isObj(value){ return !!value && typeof value === 'object' && !Array.isArray(value); }

  function dateOnly(value){
    if(!value) return null;
    if(value instanceof Date && !isNaN(value)) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    if(typeof value === 'number'){
      const fromNumber = new Date(value);
      return isNaN(fromNumber) ? null : new Date(fromNumber.getFullYear(), fromNumber.getMonth(), fromNumber.getDate());
    }
    if(typeof value === 'string'){
      const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if(iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
      const parsed = new Date(value);
      return isNaN(parsed) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
    return null;
  }

  function dateKey(value){
    const d = dateOnly(value);
    if(!d) return '';
    if(typeof W.localDateStr === 'function') return W.localDateStr(d);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function addDays(value, amount){
    const d = dateOnly(value) || dateOnly(new Date());
    d.setDate(d.getDate() + Number(amount || 0));
    return d;
  }

  function eachDate(startValue, endValue, callback){
    let start = dateOnly(startValue);
    if(!start) return;
    let end = dateOnly(endValue) || start;
    if(end < start){ const tmp = start; start = end; end = tmp; }
    const cursor = new Date(start);
    let guard = 0;
    while(cursor <= end && guard < CFG.maxHolidayRangeDays){
      callback(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }
  }

  function holidayRangeOf(item){
    if(!item) return null;
    if(typeof item === 'string') return { start:item, end:item };
    if(!isObj(item)) return null;
    const start = item.tarih || item.date || item.baslangic || item.baslangicTarihi || item.start || item.startDate;
    const end = item.bitis || item.bitisTarihi || item.end || item.endDate || start;
    return start ? { start:start, end:end } : null;
  }

  function holidaySet(){
    const set = new Set();
    const list = Array.isArray(db().tatiller) ? db().tatiller : [];
    list.forEach(function(item){
      const range = holidayRangeOf(item);
      if(!range) return;
      eachDate(range.start, range.end, function(day){ set.add(dateKey(day)); });
    });
    return set;
  }

  function isWeekend(value){
    const d = dateOnly(value);
    if(!d) return true;
    const day = d.getDay();
    return day === 0 || day === 6;
  }

  function isBusinessDay(value, holidays){
    const d = dateOnly(value);
    if(!d) return false;
    return !isWeekend(d) && !(holidays || holidaySet()).has(dateKey(d));
  }

  function nextBusinessDayAfter(value){
    const holidays = holidaySet();
    const cursor = addDays(value || new Date(), 1);
    let guard = 0;
    while(!isBusinessDay(cursor, holidays) && guard < CFG.maxBusinessDayScan){
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }
    return cursor;
  }

  function calendarDaysBetween(startValue, endValue){
    const start = dateOnly(startValue);
    const end = dateOnly(endValue);
    if(!start || !end) return 1;
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
  }

  function field(id){ return DOC.getElementById(id); }
  function fieldValue(id){ const el = field(id); return el ? el.value : ''; }

  function emitFieldEvents(el){
    if(!el) return;
    el.dispatchEvent(new Event('input', { bubbles:true }));
    el.dispatchEvent(new Event('change', { bubbles:true }));
  }

  function setDateField(id, value){
    const key = dateKey(value);
    if(!key) return '';
    if(typeof W.setDateInputValue === 'function') W.setDateInputValue(id, key);
    else {
      const el = field(id);
      if(el){ el.value = key; emitFieldEvents(el); }
    }
    return key;
  }

  function setValueField(id, value){
    const el = field(id);
    if(!el) return false;
    el.value = String(value == null ? '' : value);
    emitFieldEvents(el);
    return true;
  }

  function resolveStartDate(startValue){
    const start = dateOnly(startValue || fieldValue(CFG.startInputId) || new Date()) || dateOnly(new Date());
    if(!fieldValue(CFG.startInputId)) setDateField(CFG.startInputId, start);
    return start;
  }

  function calculateDailyMaturity(startValue){
    const start = resolveStartDate(startValue);
    const end = nextBusinessDayAfter(start);
    return {
      baslangicDate: start,
      bitisDate: end,
      baslangic: dateKey(start),
      bitis: dateKey(end),
      vade: calendarDaysBetween(start, end)
    };
  }

  function applyDailyMaturity(startValue, options){
    const result = calculateDailyMaturity(startValue);
    setValueField(CFG.maturityInputId, result.vade);
    if(!options || options.calc !== false){
      if(typeof W.calcMevduat === 'function') W.calcMevduat();
    }
    return result;
  }

  function stabilizeApply(startValue){
    applyDailyMaturity(startValue);
    CFG.stabilizeDelays.forEach(function(delay){
      setTimeout(function(){ applyDailyMaturity(startValue); }, delay);
    });
    if(typeof W.requestAnimationFrame === 'function') W.requestAnimationFrame(function(){ applyDailyMaturity(startValue); });
  }

  function updateDailyDepositObject(m){
    if(!m || !m.gunluk) return m;
    const start = dateOnly(m.baslangic || m.baslangicTarihi || m.tarih || new Date()) || dateOnly(new Date());
    const end = nextBusinessDayAfter(start);
    m.vade = calendarDaysBetween(start, end);
    m.bitis = dateKey(end);
    m.bitisTarihi = m.bitisTarihi || m.bitis;
    if(typeof W.calcMevduatObj === 'function'){
      const calc = W.calcMevduatObj(m);
      if(calc){
        m.faiz = calc.faiz;
        m.nihai = calc.nihai;
      }
    }
    return m;
  }

  function patchDailyButton(){
    if(typeof W.gunlukVadeliyeKoy !== 'function' || W.gunlukVadeliyeKoy._rfV57DailyBusiness) return;
    const oldGunluk = W.gunlukVadeliyeKoy;
    W.gunlukVadeliyeKoy = function(){
      const result = oldGunluk.apply(this, arguments);
      stabilizeApply();
      return result;
    };
    W.gunlukVadeliyeKoy._rfV57DailyBusiness = true;
  }

  function patchAutoDailyEngine(){
    if(typeof W._gunlukVadeliAcOtomatik !== 'function' || W._gunlukVadeliAcOtomatik._rfV57DailyBusiness) return;
    const oldAuto = W._gunlukVadeliAcOtomatik;
    W._gunlukVadeliAcOtomatik = function(){
      const beforeCount = Array.isArray(db().mevduatlar) ? db().mevduatlar.length : 0;
      const result = oldAuto.apply(this, arguments);
      const list = Array.isArray(db().mevduatlar) ? db().mevduatlar : [];
      for(let i = beforeCount; i < list.length; i++) updateDailyDepositObject(list[i]);
      return result;
    };
    W._gunlukVadeliAcOtomatik._rfV57DailyBusiness = true;
  }

  function boot(){
    patchDailyButton();
    patchAutoDailyEngine();
  }

  W.FinansBusinessDays = Object.assign(W.FinansBusinessDays || {}, {
    dateOnly: dateOnly,
    dateKey: dateKey,
    holidaySet: holidaySet,
    isWeekend: isWeekend,
    isBusinessDay: isBusinessDay,
    nextBusinessDayAfter: nextBusinessDayAfter,
    dailyMaturity: calculateDailyMaturity,
    applyDailyMaturity: applyDailyMaturity,
    updateDailyDepositObject: updateDailyDepositObject
  });

  W.gunlukMevduatVadesiniIlkIsGununeAyarla = applyDailyMaturity;
  W.mevduatSonrakiIlkIsGunu = nextBusinessDayAfter;
  W.mevduatIsGunuMu = isBusinessDay;
  W.mevduatTatilSeti = holidaySet;

  if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
  W.addEventListener('load', boot, { once:true });

  // ============================================================
  // DUAL-MODE CONTAINER KAYDI (bkz. DI-MIGRATION.md)
  // Kendi üstteki `core/state.js` importu BİLİNÇLİ OLARAK bırakıldı.
  // Bu dosyanın dış API'si zaten window.FinansBusinessDays + birkaç
  // window.* fonksiyon üzerinden; container'a da aynı namespace'i
  // yansıtıyoruz.
  // ============================================================
  _provide('ui.pages.mevduatPatches.gunlukVadeliIsGunuRefactor', {
    dateOnly: dateOnly,
    dateKey: dateKey,
    holidaySet: holidaySet,
    isWeekend: isWeekend,
    isBusinessDay: isBusinessDay,
    nextBusinessDayAfter: nextBusinessDayAfter,
    dailyMaturity: calculateDailyMaturity,
    applyDailyMaturity: applyDailyMaturity,
    updateDailyDepositObject: updateDailyDepositObject
  });
})();

