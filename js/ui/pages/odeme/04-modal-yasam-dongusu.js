import { _kartOdemeHizliTransferGuncelle } from '../kartlar/08-kart-odeme.js';
import { _odModalOwnsBodyLock, _odModalSuspendedByTransfer, set_odModalOwnsBodyLock, set_odModalSuspendedByTransfer } from './00-state.js';
import { _odHesapPopupToggle } from './05-hesap-secim-popup.js';
import { call, register } from '../../../core/wrap-registry.js';
// ============================================================
// js/ui/pages/odeme/04-modal-yasam-dongusu.js
// Ödeme modalının açılış/kapanış yaşam döngüsü
//
// Bu dosya, eskiden tek parça olan js/ui/pages/odeme.js
// (52 export, 2097 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function _odModalSuspendForTransfer() {
  const bg = document.getElementById('od-modal-bg');
  if(!bg || !bg.classList.contains('open')) return;
  bg.classList.remove('open');
  bg.style.display = 'none';
  set_odModalSuspendedByTransfer(true);
  _odHesapPopupToggle(false);
}

export function _odModalRestoreAfterTransfer() {
  if(!_odModalSuspendedByTransfer) return;
  const bg = document.getElementById('od-modal-bg');
  if(!bg) { set_odModalSuspendedByTransfer(false); return; }
  bg.style.display = 'flex';
  bg.classList.add('open');
  _odModalLockBodyScroll();
  set_odModalSuspendedByTransfer(false);
  try { call('_odHesapBilgiGuncelle'); } catch(e) {}
  try { _kartOdemeHizliTransferGuncelle('od-modal'); } catch(e) {}
}
// [ES module] taban tanım, odeme/patches zincirinin hook/wrap edebilmesi
// için wrap-registry'ye kaydediliyor.
register('_odModalRestoreAfterTransfer', _odModalRestoreAfterTransfer);

export function _odModalLockBodyScroll() {
  if (!document.body.classList.contains('modal-open')) {
    document.body.classList.add('modal-open');
    set_odModalOwnsBodyLock(true);
  } else {
    set_odModalOwnsBodyLock(false);
  }
}

export function odModalKapat() {
  const bg = document.getElementById('od-modal-bg');
  if(bg) { bg.classList.remove('open'); bg.style.display = ''; }
  if (_odModalOwnsBodyLock) {
    document.body.classList.remove('modal-open');
    set_odModalOwnsBodyLock(false);
  }
  _odHesapPopupToggle(false);
}

