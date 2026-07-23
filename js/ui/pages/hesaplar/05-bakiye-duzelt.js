import { saveData } from '../../../core/app-core-base.js';
import { fmtCur, localDateStr, uid } from '../../../core/format.js';
import { CURRENCY_CONFIG, DB } from '../../../core/state.js';
import { _nakitBakiyeDelta } from '../../../domain/hesap-entegrasyon-motoru.js';
import { closeModal, openModal, showToast } from '../../components/modal-genel.js';
import { getMoneyInput, setMoneyInput, updateModalMoneyWraps } from '../../components/money-input.js';
import { _hesapLogId, _hesapLogNakitPb, renderHesaplar } from './04-hesap-liste-render.js';
import { openHesapLogModal, openNakitLogModal } from './06-hesap-log.js';
import { renderOzet } from '../ozet.js';
// ============================================================
// js/ui/pages/hesaplar/05-bakiye-duzelt.js
// Bakiye düzeltme (manuel fark girişi) modalı
//
// Bu dosya, eskiden tek parça olan js/ui/pages/hesaplar.js
// (49 export, 991 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function _hesapLogDuzeltAc() {
  if (_hesapLogId) openBakiyeDuzeltModal('hesap', _hesapLogId);
  else if (_hesapLogNakitPb) openBakiyeDuzeltModal('nakit', _hesapLogNakitPb);
}

// ═══ BAKİYE DÜZELT (Nakit + Banka Hesabı ortak) ═══════════════════════
export let _bakiyeDuzeltHedef = null; // {tip:'nakit'|'hesap', id, pb, eski}

export function openBakiyeDuzeltModal(hedefTip, hedefId) {
  let eski = 0, pb = 'TRY', baslik = '', altbaslik = '';
  if (hedefTip === 'nakit') {
    pb = hedefId;
    eski = (DB._nakitBakiye || {})[pb] || 0;
    const cfg = (typeof CURRENCY_CONFIG !== 'undefined' && CURRENCY_CONFIG[pb]) || {};
    baslik = `Nakit Bakiyeyi Düzelt (${pb})`;
    altbaslik = cfg.ad ? `💵 ${cfg.ad}` : 'Nakit bakiye düzeltmesi';
  } else if (hedefTip === 'hesap') {
    const h = (DB.hesaplar || []).find(x => x.id === hedefId);
    if (!h) return;
    pb = h.paraBirimi || 'TRY';
    eski = h.bakiye || 0;
    const bankaAd = ((DB.bankalar || []).find(b => b.id === h.banka) || {}).kisa || '';
    baslik = `Bakiyeyi Düzelt — ${h.ad}`;
    altbaslik = bankaAd || 'Hesap bakiye düzeltmesi';
  } else return;

  _bakiyeDuzeltHedef = { tip: hedefTip, id: hedefId, pb, eski };
  document.getElementById('bakiye-duzelt-modal-title').textContent = baslik;
  document.getElementById('bakiye-duzelt-modal-sub').textContent = altbaslik;
  updateModalMoneyWraps('modal-bakiye-duzelt', pb);
  document.getElementById('bakiye-duzelt-eski').value = fmtCur(eski, pb);
  setMoneyInput('bakiye-duzelt-yeni', eski);
  document.getElementById('bakiye-duzelt-not').value = '';
  const hint = document.getElementById('bakiye-duzelt-fark-hint');
  if (hint) { hint.style.display = 'none'; hint.textContent = ''; }
  const yeniEl = document.getElementById('bakiye-duzelt-yeni');
  if (yeniEl) yeniEl.oninput = _bakiyeDuzeltFarkGuncelle;
  openModal('modal-bakiye-duzelt');
}

export function _bakiyeDuzeltFarkGuncelle() {
  if (!_bakiyeDuzeltHedef) return;
  const hint = document.getElementById('bakiye-duzelt-fark-hint');
  if (!hint) return;
  const yeni = getMoneyInput('bakiye-duzelt-yeni');
  const fark = Math.round((yeni - _bakiyeDuzeltHedef.eski) * 1e6) / 1e6;
  if (Math.abs(fark) < 0.005) { hint.style.display = 'none'; return; }
  hint.style.display = 'block';
  hint.innerHTML = `Fark: <b style="color:${fark >= 0 ? 'var(--teal)' : 'var(--danger)'}">${fark >= 0 ? '+' : ''}${fmtCur(fark, _bakiyeDuzeltHedef.pb)}</b> olarak loglanacak`;
}

export function saveBakiyeDuzelt() {
  if (!_bakiyeDuzeltHedef) return;
  const { tip, id, pb, eski } = _bakiyeDuzeltHedef;
  const yeni = getMoneyInput('bakiye-duzelt-yeni');
  const not = (document.getElementById('bakiye-duzelt-not').value || '').trim();
  const fark = Math.round((yeni - eski) * 1e6) / 1e6;
  if (Math.abs(fark) < 0.005) { showToast('Bakiye zaten güncel — bir değişiklik yok', 'info'); closeModal('modal-bakiye-duzelt'); return; }

  if (!DB._bakiyeDuzeltmeLog) DB._bakiyeDuzeltmeLog = [];
  DB._bakiyeDuzeltmeLog.push({
    id: uid(), hedefTip: tip, hedefId: id,
    tarih: localDateStr(new Date()), eskiBakiye: eski, yeniBakiye: yeni, fark, not
  });

  if (tip === 'nakit') {
    if (typeof _nakitBakiyeDelta === 'function') _nakitBakiyeDelta(pb, fark);
  } else if (tip === 'hesap') {
    const h = (DB.hesaplar || []).find(x => x.id === id);
    if (h) h.bakiye = yeni;
  }

  saveData();
  closeModal('modal-bakiye-duzelt');
  showToast(`Bakiye düzeltildi: ${fark >= 0 ? '+' : ''}${fmtCur(fark, pb)}`, 'success');

  if (document.getElementById('page-ozet') && typeof renderOzet === 'function') renderOzet();
  if (document.getElementById('page-hesaplar') && typeof renderHesaplar === 'function') renderHesaplar();
  // Açık olan birleşik bakiye log modalı varsa aynı hedef için tazele
  const logModal = document.getElementById('modal-hesap-log');
  if (logModal && logModal.classList.contains('open')) {
    if (tip === 'nakit' && _hesapLogNakitPb === pb) openNakitLogModal(pb);
    else if (tip === 'hesap' && _hesapLogId === id) openHesapLogModal(id);
  }
}

