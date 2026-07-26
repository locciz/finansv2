import { saveData } from '../core/app-core-base.js';
import { DB, defaultCurrency } from '../core/state.js';
import { renderOzetBakiyeUyarilar } from '../ui/components/mobile-nav-tema/03-bakiye-izleme-paneli.js';
import { showToast } from '../ui/components/modal-genel.js';
import { renderHesaplar } from '../ui/pages/hesaplar/04-hesap-liste-render.js';
import { register } from '../core/wrap-registry.js';
// ============================================================
// js/domain/oto-bakiye-motoru.js
// İş mantığı: otomatik bakiye güncelleme log motoru. NOT: "mobile-nav-tema.js" içine gömülüydü, saf hesap/bakiye iş mantığı olduğu için js/domain/'a taşındı.
// Kod SATIR SATIR aynı kaldı; sadece dosya sınırı/gruplama değişti.
// ============================================================
export function _otoBakiyeLogKey(tip, id, key) {
  return tip + ':' + id + ':' + (key !== undefined && key !== null ? key : '_');
}

export function _otoBakiyeLogGet(logKey) {
  if(!DB.otoBakiyeLog) DB.otoBakiyeLog = {};
  return DB.otoBakiyeLog[logKey] || null;
}

export function _otoBakiyeLogSet(logKey, tutar) {
  if(!DB.otoBakiyeLog) DB.otoBakiyeLog = {};
  DB.otoBakiyeLog[logKey] = tutar;
}

export function _otoBakiyeLogDel(logKey) {
  if(!DB.otoBakiyeLog) DB.otoBakiyeLog = {};
  delete DB.otoBakiyeLog[logKey];
}

/**
 * Ödeme durumu değişince hesap bakiyesini otomatik güncelle.
 * tip: 'kira'|'maas'|'elden'|'mevduat'
 * id: kontrat/kayıt id
 * key: kira/maaş için ay ('YYYY-MM'), diğerleri için undefined/taksit no
 * durum: 'odendi'|'kismi'|'bekliyor'|diğer
 * newTutar: o ödemeye ait tutar
 */
// NOT: Kira depozitosunun ödeme/iade bacakları artık od-modal (ödeme durumu
// popup'ı) üzerinden yönetiliyor — bkz. entDepozitoYansit ve _otoBakiyeGuncelle
// dispatch'indeki 'depozito' case'i. Eskiden burada duran _depozitoBakiyeSync
// yardımcı fonksiyonu, dispatch'te hiç karşılığı olmadığı için pasif kalıyordu;
// kaldırıldı.

function _otoBakiyeGuncelle(tip, id, key, durum, newTutar) {
  // Kira ve maaş için key = ay string ('YYYY-MM')
  const logKey = _otoBakiyeLogKey(tip, id, key);
  const eskiYansima = _otoBakiyeLogGet(logKey);

  if(!durum || durum === 'bekliyor' || durum === 'ertelendi' || durum === 'gecikti') {
    if(eskiYansima !== null) {
      _otoBakiyeUygula(tip, id, key, -eskiYansima);
      _otoBakiyeLogDel(logKey);
      saveData();
      renderHesaplar();
      showToast('↩ Bakiyeye yansıtılan tutar geri alındı');
    }
    return;
  }

  if(durum === 'iptal' || durum === 'atlandi') {
    if(eskiYansima !== null) {
      _otoBakiyeUygula(tip, id, key, -eskiYansima);
      _otoBakiyeLogDel(logKey);
      saveData();
      renderHesaplar();
    }
    return;
  }

  if(durum === 'odendi' || durum === 'kismi') {
    const tutar = (newTutar !== undefined && newTutar !== null) ? newTutar : 0;
    const eskiTutar = eskiYansima !== null ? eskiYansima : 0;
    const delta = tutar - eskiTutar;
    if(Math.abs(delta) < 0.001) return;

    const uygulandi = _otoBakiyeUygula(tip, id, key, delta);
    if(uygulandi) {
      _otoBakiyeLogSet(logKey, tutar);
      saveData();
      renderHesaplar();
      // Özet sayfasındaki uyarıları da güncelle
      if(typeof renderOzetBakiyeUyarilar === 'function') renderOzetBakiyeUyarilar();
    }
  }
}
// [KALDIRILDI] "export { _otoBakiyeGuncelle as _otoBakiyeGuncelle__oto_bakiye_motoru }"
// hiçbir dosya tarafından import edilmiyordu (ölü kod taraması, 2026-07).
// Fonksiyonun kendisi ve register() çağrısı hâlâ kullanımda.
// [ES module] eskiden window._otoBakiyeGuncelle = ... ile atanıyordu; artık
// register ile wrap-registry'ye kaydediliyor. hesap-entegrasyon-motoru.js
// (script sırasına göre sonra yüklenir) bunu register(...) ile EZER — bu,
// eski "son yazan kazanır" davranışıyla birebir aynı. abonelik.js ise
// DOMContentLoaded'da get/register ile bunun üzerine wrap ekler.
register('_otoBakiyeGuncelle', _otoBakiyeGuncelle);

/**
 * Hesap bakiyesine delta uygular. delta > 0 → bakiye artar, < 0 → azalır.
 * Hangi hesap kullanılacağı tip'e göre belirlenir.
 * Returns true if applied, false if no account found.
 */

export function _otoBakiyeUygula(tip, id, key, delta) {
  let hesapId = null;
  let isNakit = false;
  let pb = null;
  let kontratTutar = 0; // kira/maas için kontrat yönü (gelir +, gider -)

  if(tip === 'kira') {
    const kira = (DB.kiralar||[]).find(x=>x.id===id);
    if(!kira) return false;
    hesapId = kira.hesapId || null;
    isNakit = !hesapId || kira.odemeYontem === 'nakit';
    pb = kira.paraBirimi || defaultCurrency;
    // kira.tutar: gelir ise pozitif, gider ise negatif
    kontratTutar = kira.tutar;
  } else if(tip === 'maas') {
    const maas = (DB.maaslar||[]).find(x=>x.id===id);
    if(!maas) return false;
    hesapId = maas.hesapId || null;
    isNakit = !hesapId || maas.yontem === 'nakit';
    pb = maas.paraBirimi || defaultCurrency;
    kontratTutar = Math.abs(maas.tutar); // maaş daima gelir
  } else if(tip === 'elden') {
    const elden = (DB.eldenler||[]).find(x=>x.id===id);
    if(!elden) return false;
    hesapId = elden.hesapId || null;
    isNakit = !hesapId || elden.yontem === 'nakit';
    pb = elden.paraBirimi || defaultCurrency;
    kontratTutar = elden.tutar; // elden: gelir pozitif, gider negatif
  } else if(tip === 'depozito') {
    // Depozito: kira kontratına bağlı — hesap/para birimi/yön kontratın kendisinden gelir.
    // key='odeme' → depozito ödendiğinde/alındığında kontrat yönünde;
    // key='iade'  → depozito geri alındığında/verildiğinde ters yönde uygulanır.
    const kiraD = (DB.kiralar||[]).find(x=>x.id===id);
    if(!kiraD) return false;
    hesapId = kiraD.hesapId || null;
    isNakit = !hesapId || kiraD.odemeYontem === 'nakit';
    pb = (kiraD.depozito && kiraD.depozito.paraBirimi) || kiraD.paraBirimi || defaultCurrency;
    kontratTutar = kiraD.tutar;
  } else if(tip === 'mevduat') {
    const mev = (DB.mevduatlar||[]).find(x=>x.id===id);
    if(!mev) return false;
    // Mevduat ödendi = vade doldu, strateji varsa otomatik uygula
    if(mev.vadesizHesapId) {
      hesapId = mev.vadesizHesapId;
      pb = mev.paraBirimi || 'TRY';
      const hesap = (DB.hesaplar||[]).find(h=>h.id===hesapId);
      if(hesap) {
        const strateji = mev.strateji || 'tumu_vadesiz';
        let aktarilacak = 0;
        if(strateji === 'tumu_vadesiz') {
          aktarilacak = mev.nihai * (delta > 0 ? 1 : -1);
        } else if(strateji === 'yenile_ana_faiz_vadesiz') {
          aktarilacak = mev.faiz * (delta > 0 ? 1 : -1);
        }
        if(Math.abs(aktarilacak) > 0.001) {
          hesap.bakiye = (hesap.bakiye||0) + aktarilacak;
          return true;
        }
      }
    } else if(mev.hesapId) {
      // Vadeli hesaba nihai tutarı ekle
      hesapId = mev.hesapId;
      pb = mev.paraBirimi || 'TRY';
      const hesap = (DB.hesaplar||[]).find(h=>h.id===hesapId);
      if(hesap) {
        hesap.bakiye = (hesap.bakiye||0) + mev.nihai * (delta > 0 ? 1 : -1);
        return true;
      }
    }
    return false;
  }

  if(isNakit) {
    // Nakit → nakitBakiye alanını güncelle (hesap yok)
    // Yön: kontratTutar'ın işaretiyle belirle (depozito'nun 'iade' bacağı tersine döner)
    let yon = kontratTutar >= 0 ? 1 : -1;
    if(tip === 'depozito' && key === 'iade') yon = -yon;
    if(!DB._nakitBakiye) DB._nakitBakiye = {};
    const curKey = pb || 'TRY';
    DB._nakitBakiye[curKey] = (DB._nakitBakiye[curKey]||0) + (delta * yon);
    return true;
  }

  if(!hesapId) return false;
  const hesap = (DB.hesaplar||[]).find(h=>h.id===hesapId);
  if(!hesap) return false;

  // Yön: kira gelir ise +, gider ise -; maaş daima +; elden'in işareti zaten var;
  // depozito kontrat yönünü izler, 'iade' bacağında tersine döner (para geri gider/gelir)
  let yon = 1;
  if(tip === 'kira') yon = kontratTutar >= 0 ? 1 : -1;
  else if(tip === 'maas') yon = 1;
  else if(tip === 'elden') yon = kontratTutar >= 0 ? 1 : -1;
  else if(tip === 'depozito') { yon = kontratTutar >= 0 ? 1 : -1; if(key === 'iade') yon = -yon; }

  hesap.bakiye = (hesap.bakiye||0) + (delta * yon);
  return true;
}

// ═══════════════════════════════════════════════════════════════════
// OTOMATİK BAKİYE YÖNETİM SİSTEMİ v2 — Durum Tespiti & İzleme
// ═══════════════════════════════════════════════════════════════════

/**
 * Hesap bakiyesi için durum tespiti.
 * Döner: { seviye: 'kritik'|'dusuk'|'normal'|'iyi'|'fazla', renk, ikon, etiket, pct? }
 */

