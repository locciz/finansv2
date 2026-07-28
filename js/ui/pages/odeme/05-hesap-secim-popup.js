import { defaultCurrency } from '@core/state.js';
import { _closeScSearchPopup, _hesapChipHtml, _hesapChipLabel, _hesapChipValue, _openScSearchPopup } from '@components/select-to-chips.js';
import { _odHesapPopupHesaplar, set_odHesapPopupHesaplar } from '@pages/odeme/00-state.js';
import { _odModal } from '@pages/odeme/08-popup-giris-noktalari.js';
import { call, register } from '@core/wrap-registry.js';
// ============================================================
// js/ui/pages/odeme/05-hesap-secim-popup.js
// Ödeme modalı içindeki hesap seçim popup'ı
//
// Bu dosya, eskiden tek parça olan js/ui/pages/odeme.js
// (52 export, 2097 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function _odHesapPopupToggle(forceOpen) {
  if (forceOpen === false) { _closeScSearchPopup(); return; }
  const trigger = document.getElementById('od-pop-hesap-trigger');
  if (!trigger || trigger.disabled) return;
  const _odNakitPb = _odNakitPbBul();
  const options = (_odHesapPopupHesaplar || []).map(h => ({
      value: h.id,
      text: h.ad,
      grup: h._odIlgiliBanka ? '⭐ İlgili Banka Hesapları' : '🏛️ Diğer Hesaplar'
    }))
    .concat([{ value: '', text: 'Nakit (Nakit Bakiyesi)', pb: _odNakitPb, grup: '💵 Nakit' }]);
  const currentVal = document.getElementById('od-pop-hesap')?.value || '';
  _openScSearchPopup({
    title: 'Hesap Seç',
    placeholder: 'Hesap ara…',
    options,
    getLabel: _hesapChipLabel,
    htmlFn: _hesapChipHtml,
    groupOf: (o) => o.grup || null,
    sortValueFn: _hesapChipValue,
    currentVal,
    triggerBtn: trigger,
    onSelect: (val) => _odHesapPopupSec(val)
  });
}

export function _odNakitPbBul() {
  const tip = _odModal?.tip;
  const item = tip ? call('odGetItem', tip, _odModal.id) : null;
  return _odModal?._kartPb || (item && (item.paraBirimi || item.paraBirimleri?.[0])) || defaultCurrency || 'TRY';
}

export function _odHesapTriggerGuncelle(hesapId) {
  const trigger = document.getElementById('od-pop-hesap-trigger');
  if (!trigger) return;
  const opt = hesapId ? { value: hesapId, text: '' } : { value: '', pb: _odNakitPbBul(), text: 'Nakit (Nakit Bakiyesi)' };
  trigger.innerHTML = _hesapChipHtml(opt)
    + '<svg class="sc-popup-trigger-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  trigger.classList.toggle('sc-has-value', !!hesapId);
  trigger.classList.toggle('sc-is-empty', !hesapId);
}

export function _odHesapPopupBuild(hesaplar, secilebilir, mevcutHesapId) {
  const trigger = document.getElementById('od-pop-hesap-trigger');
  const hidden = document.getElementById('od-pop-hesap');
  if (!hidden) return;
  set_odHesapPopupHesaplar(hesaplar || []);
  hidden.value = mevcutHesapId || '';
  if (trigger) trigger.disabled = !secilebilir;
  _odHesapTriggerGuncelle(mevcutHesapId || '');
}

export function _odHesapPopupSec(hesapId) {
  const hidden = document.getElementById('od-pop-hesap');
  if (!hidden) return;
  hidden.value = hesapId || '';
  hidden.dispatchEvent(new Event('change', { bubbles: true }));
  _odHesapTriggerGuncelle(hesapId || '');
}
// [ES module] taban tanım, odeme/patches zincirinin hook/wrap edebilmesi
// için wrap-registry'ye kaydediliyor.
register('_odHesapPopupSec', _odHesapPopupSec);

export function _odPopSeciliHesapId() {
  return document.getElementById('od-pop-hesap')?.value || null;
}

