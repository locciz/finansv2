// ============================================================
// js/domain/mevduat-hesaplama.js
// Mevduat açma formu önizleme hesaplaması — SAF fonksiyon (DOM'a
// dokunmaz, sadece sayı alır sayı/obje döner, test edilebilir).
//
// Bu mantık eskiden js/ui/pages/mevduat/01-mevduat-form-wizard.js
// içindeki calcMevduat() fonksiyonunun İÇİNE gömülüydü — form
// input'larını okuma, hesaplama ve HTML basma tek fonksiyondaydı.
// Buraya taşınan kısım SADECE hesaplama; calcMevduat() artık bu
// fonksiyonu çağırıp sonucu DOM'a basıyor (bkz. o dosyadaki değişiklik).
//
// DAVRANIŞ DEĞİŞMEDİ: aynı formüller, aynı yuvarlama, aynı sıra.
// Gerçek üretim verisiyle doğrulandı (bkz. WRAP-NOTLARI.md 8. tur).
// ============================================================

  // Saat dilimi güvenli yerel tarih formatlayıcı (bkz. js/domain/hesaplamalar.js:_toLocalISO)
  export function _toLocalISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * @param {number} tutar - Anapara
   * @param {number} faizOran - Yıllık faiz oranı (%), örn. 43
   * @param {number} stopaj - Stopaj oranı (%), örn. 17.5
   * @param {number} vade - Vade (gün)
   * @param {number} valor - Valör (gün) — vade sonuna eklenir
   * @param {string|null} baslangicISO - "YYYY-MM-DD" veya boş
   * @returns {{
   *   faizBazis:number, brutFaiz:number, stopajTutar:number,
   *   netFaiz:number, nihai:number, kazanc:number, kazanYuzde:number,
   *   bitisTarihISO: string|null
   * }}
   */
  export function hesaplaMevduatOnizleme(tutar, faizOran, stopaj, vade, valor, baslangicISO) {
    const faizsiz = 0;
    const faizBazis = tutar - faizsiz;
    const brutFaiz = faizBazis * (faizOran / 100) * (vade / 365);
    const stopajTutar = brutFaiz * (stopaj / 100);
    const netFaiz = brutFaiz - stopajTutar;
    const nihai = tutar + netFaiz;

    let bitisTarihISO = null;
    if (baslangicISO && vade) {
      const dt = new Date(baslangicISO + 'T00:00:00');
      dt.setDate(dt.getDate() + vade + (valor || 0));
      bitisTarihISO = _toLocalISODate(dt);
    }

    const kazanc = nihai - tutar;
    const kazanYuzde = tutar > 0 ? (kazanc / tutar * 100) : 0;

    return { faizBazis, brutFaiz, stopajTutar, netFaiz, nihai, kazanc, kazanYuzde, bitisTarihISO };
  }

// ============================================================
// [DI-MIGRATION] domain.mevduatHesaplama — container'a kayıt
// ============================================================
import { provide } from '@core/container.js';
provide('domain.mevduatHesaplama', { _toLocalISODate, hesaplaMevduatOnizleme });

