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
   * @param {object} [opts]
   * @param {boolean} [opts.isGununeErtele] - true ise ve vade sonu hafta
   *   sonu/resmi tatile denk geliyorsa bitisTarihISO bir sonraki iş
   *   gününe ertelenir.
   * @param {Set<string>} [opts.tatilSet] - resmi tatil tarihleri (YYYY-MM-DD)
   * @param {function} [opts.isIsBgunuFn] - (Date, Set) => boolean
   * @param {function} [opts.nextIsBgunuFn] - (Date, Set) => Date
   * @returns {{
   *   faizBazis:number, brutFaiz:number, stopajTutar:number,
   *   netFaiz:number, nihai:number, kazanc:number, kazanYuzde:number,
   *   bitisTarihISO: string|null, bitisTarihOrijinalISO: string|null,
   *   bitisErtelendi: boolean
   * }}
   */
  export function hesaplaMevduatOnizleme(tutar, faizOran, stopaj, vade, valor, baslangicISO, opts) {
    opts = opts || {};
    const faizsiz = 0;
    const faizBazis = tutar - faizsiz;
    const brutFaiz = faizBazis * (faizOran / 100) * (vade / 365);
    const stopajTutar = brutFaiz * (stopaj / 100);
    const netFaiz = brutFaiz - stopajTutar;
    const nihai = tutar + netFaiz;

    let bitisTarihISO = null;
    let bitisTarihOrijinalISO = null;
    let bitisErtelendi = false;
    if (baslangicISO && vade) {
      const dt = new Date(baslangicISO + 'T00:00:00');
      dt.setDate(dt.getDate() + vade + (valor || 0));
      bitisTarihOrijinalISO = _toLocalISODate(dt);
      // [YENİ] "Vade sonunu iş gününe ertele" seçeneği: hafta sonu/resmi
      // tatile denk gelen vade sonu, kullanıcı isterse bir sonraki iş
      // gününe kaydırılır (kredi kartı ekstre/ödeme tarihi ertelemesiyle
      // aynı örüntü — bkz. js/domain/hesaplamalar.js:calcOdemeTarihi).
      if (opts.isGununeErtele && typeof opts.isIsBgunuFn === 'function' && typeof opts.nextIsBgunuFn === 'function') {
        const tatilSet = opts.tatilSet || new Set();
        if (!opts.isIsBgunuFn(dt, tatilSet)) {
          const ertelenmis = opts.nextIsBgunuFn(dt, tatilSet, true);
          bitisTarihISO = _toLocalISODate(ertelenmis);
          bitisErtelendi = true;
        } else {
          bitisTarihISO = bitisTarihOrijinalISO;
        }
      } else {
        bitisTarihISO = bitisTarihOrijinalISO;
      }
    }

    const kazanc = nihai - tutar;
    const kazanYuzde = tutar > 0 ? (kazanc / tutar * 100) : 0;

    return { faizBazis, brutFaiz, stopajTutar, netFaiz, nihai, kazanc, kazanYuzde, bitisTarihISO, bitisTarihOrijinalISO, bitisErtelendi };
  }

  /**
   * Günlük vadeli mevduat için vade (gün sayısı) ve bitiş tarihini hesaplar.
   *
   * @param {string} baslangicISO - "YYYY-MM-DD"
   * @param {object} opts
   * @param {boolean} [opts.isGununeErtele] - true ise ve ertesi gün hafta
   *   sonu/resmi tatilse bir sonraki iş gününe kadar ilerlenir. false ise
   *   her zaman tam 1 gün sonrası kullanılır (hafta sonu/tatil olsa bile).
   * @param {boolean} [opts.erteleFaizeYansisin] - isGununeErtele true iken:
   *   true ise vade (faiz günü) gerçek takvim farkına göre büyür (örn.
   *   cumadan pazartesiye = 3 gün); false ise vade sabit 1 kalır, sadece
   *   görünen bitiş tarihi ertelenir (fazladan günler faizsiz).
   * @param {Set<string>} opts.tatilSet
   * @param {function} opts.isIsBgunuFn - (Date, Set) => boolean
   * @param {function} opts.nextIsBgunuFn - (Date, Set, forward) => Date
   * @returns {{ vade:number, bitisISO:string, bitisDate:Date, ertelendi:boolean }}
   */
  export function hesaplaGunlukVadeliVade(baslangicISO, opts) {
    opts = opts || {};
    const tatilSet = opts.tatilSet || new Set();
    const baslangicD = new Date(baslangicISO + 'T00:00:00');

    // Her zaman tam 1 gün sonrası aday tarih
    const birGunSonra = new Date(baslangicD);
    birGunSonra.setDate(birGunSonra.getDate() + 1);

    if (!opts.isGununeErtele) {
      // Ertelemesin: hafta sonu/tatil olsa bile tam 1 gün sonrası, vade=1
      return { vade: 1, bitisISO: _toLocalISODate(birGunSonra), bitisDate: birGunSonra, ertelendi: false };
    }

    const birGunSonraIsGunuMu = opts.isIsBgunuFn ? opts.isIsBgunuFn(birGunSonra, tatilSet) : true;
    if (birGunSonraIsGunuMu) {
      // Zaten iş günü — ertelemeye gerek yok
      return { vade: 1, bitisISO: _toLocalISODate(birGunSonra), bitisDate: birGunSonra, ertelendi: false };
    }

    // Ertesi gün iş günü değil → bir sonraki iş gününe kadar ilerlet
    const sonrakiIsGunu = opts.nextIsBgunuFn ? opts.nextIsBgunuFn(birGunSonra, tatilSet, true) : birGunSonra;
    if (opts.erteleFaizeYansisin) {
      // Faize yansısın: vade = gerçek takvim gün farkı
      const vade = Math.max(1, Math.round((sonrakiIsGunu.getTime() - baslangicD.getTime()) / 86400000));
      return { vade, bitisISO: _toLocalISODate(sonrakiIsGunu), bitisDate: sonrakiIsGunu, ertelendi: true };
    }
    // Faize yansımasın: vade sabit 1, sadece görünen bitiş tarihi ertelenir
    return { vade: 1, bitisISO: _toLocalISODate(sonrakiIsGunu), bitisDate: sonrakiIsGunu, ertelendi: true };
  }

// ============================================================
// [DI-MIGRATION] domain.mevduatHesaplama — container'a kayıt
// ============================================================
import { provide } from '@core/container.js';
provide('domain.mevduatHesaplama', { _toLocalISODate, hesaplaMevduatOnizleme, hesaplaGunlukVadeliVade });

