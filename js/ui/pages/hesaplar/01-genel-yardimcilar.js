import { saveData } from '../../../core/app-core-base.js';
import { fmtCur, localDateStr } from '../../../core/format.js';
import { DB, defaultCurrency } from '../../../core/state.js';
import { _gunlukVadeliAcOtomatik } from '../mevduat/02-mevduat-vadeliye-koyma.js';
import { bankaOptionMetin, tanimRenkAl } from '../tanimlamalar/01-genel-yardimcilar.js';
import { renderHesaplar } from './04-hesap-liste-render.js';
// ============================================================
// js/ui/pages/hesaplar/01-genel-yardimcilar.js
// Genel yardımcılar — hesap option/optgroup render, banka eşleştirme, sıralama
//
// Bu dosya, eskiden tek parça olan js/ui/pages/hesaplar.js
// (49 export, 991 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function hesapTuruRenk(kod) {
  const liste = DB.hesapTurleri || [];
  const t = liste.find(x => x.kod === kod);
  return tanimRenkAl(liste, t ? t.id : null, t && t.renk);
}

export function _hesapBankayaAitMi(hesap, bankaId) {
  return !!(hesap && bankaId && hesap.banka === bankaId);
}

export function _hesaplariIlgiliBankayaGoreSirala(hesaplar, bankaId, paraBirimi) {
  const arr = (hesaplar || []).map((h, idx) => ({ h, idx }));
  arr.sort((a, b) => {
    const ab = _hesapBankayaAitMi(a.h, bankaId) ? 0 : 1;
    const bb = _hesapBankayaAitMi(b.h, bankaId) ? 0 : 1;
    if (ab !== bb) return ab - bb;
    if (paraBirimi) {
      const ap = (a.h.paraBirimi || defaultCurrency || 'TRY') === paraBirimi ? 0 : 1;
      const bp = (b.h.paraBirimi || defaultCurrency || 'TRY') === paraBirimi ? 0 : 1;
      if (ap !== bp) return ap - bp;
    }
    return a.idx - b.idx;
  });
  return arr.map(x => x.h);
}

export function _hesapVarsayilanVeyaBankaHesabi(hesaplar, mevcutHesapId, bankaId, paraBirimi) {
  const liste = hesaplar || [];
  if (mevcutHesapId && liste.some(h => h.id === mevcutHesapId)) return mevcutHesapId;
  const ayniBankaAyniPb = liste.find(h => _hesapBankayaAitMi(h, bankaId) && (!paraBirimi || (h.paraBirimi || defaultCurrency || 'TRY') === paraBirimi));
  if (ayniBankaAyniPb) return ayniBankaAyniPb.id;
  const ayniBanka = liste.find(h => _hesapBankayaAitMi(h, bankaId));
  if (ayniBanka) return ayniBanka.id;
  return liste[0] ? liste[0].id : '';
}

export function _hesapOptgroupHtml(hesaplar, bankaId) {
  const ilgili = (hesaplar || []).filter(h => _hesapBankayaAitMi(h, bankaId));
  const diger = (hesaplar || []).filter(h => !_hesapBankayaAitMi(h, bankaId));
  const opts = (list) => list.map(h => `<option value="${h.id}" data-bakiye="${h.bakiye||0}" data-pb="${h.paraBirimi||'TRY'}" data-kmh="${h.kmhLimit||0}">${hesapOptionMetin(h)}</option>`).join('');
  if (!ilgili.length) return opts(diger);
  return `<optgroup label="⭐ İlgili Banka Hesapları">${opts(ilgili)}</optgroup>` + (diger.length ? `<optgroup label="Diğer Hesaplar">${opts(diger)}</optgroup>` : '');
}

export function hesapOtomatikGunlukKontrol() {
  if(!DB.hesaplar) return false;
  const todayStr = localDateStr(new Date());
  let degisti = false;
  (DB.hesaplar||[]).forEach(h=>{
    if(!h.otoGunlukVadeli || h.durum !== 'aktif') return;
    const acikMev = (DB.mevduatlar||[]).some(m=>m.gunluk && m.vadesizHesapId===h.id && m.bitis >= todayStr);
    if(acikMev) return; // zaten döngüde açık bir günlük mevduatı var
    if(_gunlukVadeliAcOtomatik(h)) degisti = true;
  });
  if(degisti) {
    saveData();
    if(typeof renderHesaplar === 'function') renderHesaplar();
  }
  return degisti;
}

export function hesapOptionMetin(h) {
  if(!h) return '';
  const bankaObj = (DB.bankalar||[]).find(b=>b.id===h.banka) || null;
  const bankaGoster = bankaObj ? bankaOptionMetin(bankaObj) : '';
  const pb = h.paraBirimi || 'TRY';
  const bakiye = h.bakiye || 0;
  const kmhLimit = h.kmhLimit || 0;
  const bakiyeStr = typeof fmtCur === 'function' ? fmtCur(bakiye, pb) : `${bakiye} ${pb}`;
  // KMH'i olan hesaplarda dropdown'da kullanılabilir bakiye de gösterilir
  // (hesaptaki para + kullanılabilir KMH limiti) — sadece bakiyeye bakıp
  // "param yok" denmesin diye.
  let bakiyeGosterim = `Bakiye: ${bakiyeStr}`;
  if(kmhLimit > 0) {
    const kullanilabilirBakiye = bakiye + kmhLimit;
    const kullanilabilirStr = typeof fmtCur === 'function' ? fmtCur(kullanilabilirBakiye, pb) : `${kullanilabilirBakiye} ${pb}`;
    bakiyeGosterim = `Bakiye: ${bakiyeStr} · Kullanılabilir: ${kullanilabilirStr}`;
  }
  const ibanTemiz = (h.iban||'').replace(/\s/g,'');
  const ibanSon = ibanTemiz.length >= 4 ? '····'+ibanTemiz.slice(-4) : '';
  const parcalar = [bankaGoster, h.ad || 'Hesap', ibanSon, bakiyeGosterim, pb].filter(Boolean);
  return parcalar.join(' - ');
}

// [KALDIRILDI] getAktifHesapOptions() — parametresiz eski sürüm, hiçbir yerden
// çağrılmıyordu (ölü kod taraması, 2026-07). Yerini para-birimi filtreli
// getAktifHesapOptionsByPb() almış.

export function getAktifHesapOptionsByPb(pb) {
  const aktifler = (DB.hesaplar||[]).filter(h=>h.durum==='aktif' && h.tur !== 'vadeli' && (!pb || (h.paraBirimi||'TRY') === pb));
  return aktifler.map(h => `<option value="${h.id}" data-pb="${h.paraBirimi||'TRY'}">${hesapOptionMetin(h)}</option>`).join('');
}

