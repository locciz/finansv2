import { saveData } from '@core/app-core-base.js';
import { localDateStr } from '@core/format.js';
import { DB } from '@core/state.js';
import { _gunlukVadeliAcOtomatik } from '@pages/mevduat/02-mevduat-vadeliye-koyma.js';
import { renderHesaplar } from '@pages/hesaplar/04-hesap-liste-render.js';
// ============================================================
// js/ui/pages/hesaplar/01-genel-yardimcilar.js
// [FAZ 1 REFACTOR] Saf fonksiyonlar @domain/hesap-yardimcilar.js'e taşındı.
// Burada yalnızca yan etkili hesapOtomatikGunlukKontrol (saveData/render
// çağırdığı için) ve geriye dönük uyumluluk re-export'ları kaldı.
// ============================================================
export {
  hesapTuruRenk,
  _hesapBankayaAitMi,
  _hesaplariIlgiliBankayaGoreSirala,
  _hesapVarsayilanVeyaBankaHesabi,
  _hesapOptgroupHtml,
  hesapOptionMetin,
  getAktifHesapOptionsByPb,
} from '@domain/hesap-yardimcilar.js';

export function hesapOtomatikGunlukKontrol() {
  if(!DB.hesaplar) return false;
  const todayStr = localDateStr(new Date());
  let degisti = false;
  (DB.hesaplar||[]).forEach(h=>{
    if(!h.otoGunlukVadeli || h.durum !== 'aktif') return;
    const acikMev = (DB.mevduatlar||[]).some(m=>m.gunluk && m.vadesizHesapId===h.id && m.bitis >= todayStr);
    if(acikMev) return;
    if(_gunlukVadeliAcOtomatik(h)) degisti = true;
  });
  if(degisti) {
    saveData();
    if(typeof renderHesaplar === 'function') renderHesaplar();
  }
  return degisti;
}

// ============================================================
// DUAL-MODE CONTAINER KAYDI (Tur 14)
// Bu dosyanın KENDİ üstteki importları KORUNDU (dual-mode) — özellikle
// @pages/mevduat/02-mevduat-vadeliye-koyma.js ve
// @pages/hesaplar/04-hesap-liste-render.js henüz container'a taşınmadığı
// için `inject()`'e çevrilmedi. Bu dosya sadece kendi export'larını
// (hesapOtomatikGunlukKontrol ve domain'den re-export edilenler) container'a
// kaydediyor; dışarıdaki 14 tüketicisi artık
// resolve('ui.pages.hesaplarGenelYardimcilar') kullanabilir.
// ============================================================
import { provide } from '@core/container.js';
provide('ui.pages.hesaplarGenelYardimcilar', {
  hesapTuruRenk,
  _hesapBankayaAitMi,
  _hesaplariIlgiliBankayaGoreSirala,
  _hesapVarsayilanVeyaBankaHesabi,
  _hesapOptgroupHtml,
  hesapOptionMetin,
  getAktifHesapOptionsByPb,
  hesapOtomatikGunlukKontrol,
});
