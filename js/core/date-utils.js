import { localDateStr } from './format.js';
// ============================================================
// js/core/date-utils.js — İş günü / tarih aritmetiği yardımcıları
// (localDateStr için bkz. js/core/format.js)
// ============================================================

export function isIsBgunu(d, tatilSet) {
  const day = d.getDay();
  if(day === 0 || day === 6) return false; // hafta sonu
  const key = localDateStr(d);
  if(tatilSet.has(key)) return false; // resmi tatil
  return true;
}

export function nextIsBgunu(d, tatilSet, forward = true) {
  let dt = new Date(d);
  const dir = forward ? 1 : -1;
  while(!isIsBgunu(dt, tatilSet)) {
    dt.setDate(dt.getDate() + dir);
  }
  return dt;
}

export function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}


