// ============================================================
// js/domain/iban-utils.js — TR IBAN doğrulama/parse/format
// ============================================================

export function ibanMod97(iban) {
  // 1. 4 karakteri sona taşı: BBAN + ülke kodu + kontrol haneler
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  // 2. Harfleri sayıya çevir (A=10, B=11, ... Z=35)
  const numStr = rearranged.replace(/[A-Z]/g, ch => ch.charCodeAt(0) - 55);
  // 3. BigInt ile mod 97
  let remainder = 0n;
  for (const ch of numStr) remainder = (remainder * 10n + BigInt(ch)) % 97n;
  return remainder === 1n;
}

export function parseIban(raw) {
  const iban = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^TR\d{24}$/.test(iban)) return null;
  if (!ibanMod97(iban)) return null;
  // TR IBAN yapısı: TR(2) + kontrol(2) + rezerv(1) + bankaKodu(4) + subeKodu(4) + hesapNo(15) = 26
  return {
    iban,
    ulke: 'TR',
    kontrolHane: iban.slice(2, 4),
    bankaKodu:   iban.slice(5, 9),
    rezerv:      iban.slice(9, 10),
    subeKodu:    iban.slice(10, 14),
    hesapNo:     iban.slice(14, 26),
    formatli:    iban.replace(/(.{4})/g, '$1 ').trim()
  };
}

export function formatIbanView(el) {
  const raw = el.value.replace(/\s+/g,'').toUpperCase();
  el.value = raw; // boşluksuz sakla — sadece görsel gruplandırma için
  if(raw.length >= 4) {
    // Gruplu göster (4'lü)
    el.dataset.rawIban = raw;
    el.value = raw.replace(/(.{4})/g,'$1 ').trim();
  }
}

export function unformatIbanView(el) {
  const raw = (el.dataset.rawIban || el.value.replace(/\s+/g,'')).toUpperCase();
  el.dataset.rawIban = '';
  el.value = raw;
}



