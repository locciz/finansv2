// ============================================================
// js/ui/components/transfer-log.js — "Son Transferler" listesi
// (Para Transferi modalının 1. adımındaki geçmiş bölümü)
//
// Bu dosya, daha önce üç ayrı katmana dağılmış olan render mantığının
// yerini alır:
//   1) transfer-modal.js:renderTransferLog()          → taban tanım, ölü kod
//   2) 01-transfer-log-senkron.js:register(...)        → hesap/nakit + durum filtresi
//   3) tbk-detay.js:normalizeTransferLogRows()          → DOM'u runtime'da
//      yeniden yazan "düzeltme" katmanı
//   4) 07-genel-ui-burst-refresh.js:normalizeTransferRows() → inline style
//      ile CSS grid'ini ezen ikinci bir "düzeltme" katmanı
// Dört katman aynı listeyi farklı class isimleri ve çelişen CSS
// kurallarıyla (bkz. eski part-036/037/038/039.css) üretmeye
// çalıştığı için satırlar üst üste biniyor, tutarlar kesiliyordu.
// Artık TEK render fonksiyonu var, TEK class seti üretiyor
// (bkz. css/transfer-log.css) ve başka hiçbir modül bu listeye
// runtime'da müdahale etmiyor.
// ============================================================
import { saveData } from '../../core/app-core-base.js';
import { tblFiltreOkuMulti } from '../../core/app-core.js';
import { fmtCur, fmtDate } from '../../core/format.js';
import { DB } from '../../core/state.js';
import { openMfFiltrePopup } from './mf-popup.js';
import { showToast } from './modal-genel.js';
import { register, call } from '../../core/wrap-registry.js';
import { tekrarlaTransfer, deleteTransfer } from './transfer-modal.js';

function el(id) { return document.getElementById(id); }
function esc(x) {
  return String(x == null ? '' : x).replace(/[&<>"']/g, m => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}

function accLabel(h) {
  if (!h) return 'Hesap';
  const b = (DB.bankalar || []).find(x => x.id === h.banka);
  const bank = (b && (b.kisa || b.ad)) || 'Banka';
  const last = (h.iban || '').replace(/\s+/g, '').slice(-4);
  return bank + ' · ' + (h.ad || 'Hesap') + (last ? ' · ····' + last : '');
}

function side(t, w) {
  if (w === 'k') {
    if (t.kTip === 'nakit') return ('Nakit ' + (t.kaynakPb || '')).trim();
    return accLabel((DB.hesaplar || []).find(h => h.id === t.kaynakId));
  }
  if (t.hTip === 'nakit') return ('Nakit ' + (t.hedefPb || '')).trim();
  return accLabel((DB.hesaplar || []).find(h => h.id === t.hedefId));
}

// Bu transfer şu an tekrar yapılabilir mi? (yeterli bakiye + hesap aktif mi)
function possible(t) {
  const tut = Number(t.tutar) || 0;
  let src = false, dst = false;
  if (t.kTip === 'nakit') {
    src = ((DB._nakitBakiye || {})[t.kaynakPb] || 0) >= tut - 0.005;
  } else {
    const h = (DB.hesaplar || []).find(x => x.id === t.kaynakId);
    src = !!(h && h.durum === 'aktif' && h.tur !== 'vadeli' && ((Number(h.bakiye) || 0) + (Number(h.kmhLimit) || 0)) >= tut - 0.005);
  }
  if (t.hTip === 'nakit') {
    dst = !!t.hedefPb;
  } else {
    const hh = (DB.hesaplar || []).find(x => x.id === t.hedefId);
    dst = !!(hh && hh.durum === 'aktif' && hh.tur !== 'vadeli');
  }
  return src && dst;
}

function ensurePrefs() {
  DB.uiFiltreler = DB.uiFiltreler || {};
  DB.uiFiltreler.transferLog = DB.uiFiltreler.transferLog || {};
  const p = DB.uiFiltreler.transferLog;
  if (!Array.isArray(p.filtre)) p.filtre = p.filtre ? [p.filtre] : [];
  if (typeof p.status !== 'string') p.status = '';
  return p;
}
function currentStatus() { return ensurePrefs().status || ''; }

export function setTransferLogStatusFilter(v) {
  ensurePrefs().status = v || '';
  if (typeof saveData === 'function') saveData();
  call('renderTransferLog');
}

function renderStatusFilterBar() {
  const bar = el('rf-transfer-status-filter');
  if (!bar) return;
  const cur = currentStatus();
  const iconAll = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>';
  const opts = [
    ['', iconAll, 'Tüm transferler', 'all'],
    ['ok', '<span class="dot ok"></span>', 'Şu an yapılabilir', 'ok'],
    ['no', '<span class="dot no"></span>', 'Şu an yapılamaz', 'no'],
  ];
  bar.innerHTML = opts.map(o => (
    `<button type="button" class="${cur === o[0] ? 'active ' : ''}${o[3]} rf-transfer-status-btn" data-val="${o[0]}" title="${o[2]}" aria-label="${o[2]}">${o[1]}</button>`
  )).join('');
  bar.querySelectorAll('.rf-transfer-status-btn').forEach(btn => {
    btn.addEventListener('click', () => setTransferLogStatusFilter(btn.getAttribute('data-val')));
  });
}

export function _transferLogFiltreItems() {
  const used = new Set(), cash = new Set();
  (DB.transferler || []).forEach(t => {
    if (t.kTip === 'hesap' && t.kaynakId) used.add(t.kaynakId);
    if (t.hTip === 'hesap' && t.hedefId) used.add(t.hedefId);
    if (t.kTip === 'nakit' && t.kaynakPb) cash.add(t.kaynakPb);
    if (t.hTip === 'nakit' && t.hedefPb) cash.add(t.hedefPb);
  });
  const a = Array.from(used).map(id => {
    const h = (DB.hesaplar || []).find(x => x.id === id);
    return h ? { value: 'h:' + id, label: accLabel(h), icon: '<span class="bank-icon">🏦</span>' } : null;
  }).filter(Boolean);
  const c = Array.from(cash).filter(Boolean).map(pb => (
    { value: 'n:' + pb, label: 'Nakit (' + pb + ')', icon: '<span class="bank-icon">💵</span>' }
  ));
  return a.concat(c).sort((x, y) => x.label.localeCompare(y.label, 'tr'));
}

export function openTransferLogFiltrePopup(triggerEl) {
  const items = _transferLogFiltreItems();
  if (!items.length) { showToast('Filtrelenecek transfer geçmişi yok', 'info'); return; }
  openMfFiltrePopup('transferLog', 'filtre', 'Son Transferleri Filtrele', items, () => call('renderTransferLog'), triggerEl);
}

export function _transferLogFiltreLabelGuncelle(hesapMap, seciliFiltreler) {
  const btn = el('transfer-log-filtre-btn');
  const label = el('transfer-log-filtre-label');
  if (!btn || !label) return;
  if (!seciliFiltreler || !seciliFiltreler.length) {
    label.textContent = 'Tümü';
    label.className = 'sc-popup-placeholder';
    btn.classList.add('sc-is-empty');
    btn.classList.remove('sc-has-value');
    return;
  }
  btn.classList.remove('sc-is-empty');
  btn.classList.add('sc-has-value');
  label.className = '';
  if (seciliFiltreler.length === 1) {
    const f = seciliFiltreler[0];
    label.textContent = f.startsWith('h:') ? (hesapMap[f.slice(2)] || 'Hesap') : ('Nakit (' + f.slice(2) + ')');
  } else {
    label.textContent = seciliFiltreler.length + ' seçili';
  }
}

const ARROW_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M3 8h9"/><path d="M9 4.5 12.5 8 9 11.5"/></svg>';
const REPEAT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
const TRASH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';

function renderTransferLog() {
  ensurePrefs();
  DB.transferler = DB.transferler || [];
  const liste = el('transfer-log-liste');
  const sec = el('transfer-log-msec');
  if (!liste) return;

  if (sec) sec.style.display = DB.transferler.length ? '' : 'none';
  renderStatusFilterBar();
  if (!DB.transferler.length) {
    liste.innerHTML = '<div class="rf-transfer-empty">Henüz transfer yok</div>';
    return;
  }

  const hesapMap = {};
  (DB.hesaplar || []).forEach(h => { hesapMap[h.id] = h.ad; });
  const selected = typeof tblFiltreOkuMulti === 'function' ? tblFiltreOkuMulti('transferLog', 'filtre') : [];
  _transferLogFiltreLabelGuncelle(hesapMap, selected);

  let rows = DB.transferler.slice().reverse();
  if (selected.length) {
    rows = rows.filter(t => selected.some(f => {
      if (f.startsWith('h:')) {
        const id = f.slice(2);
        return t.kaynakId === id || t.hedefId === id;
      }
      const pb = f.slice(2);
      return (t.kTip === 'nakit' && t.kaynakPb === pb) || (t.hTip === 'nakit' && t.hedefPb === pb);
    }));
  }
  const filter = currentStatus();
  if (filter) rows = rows.filter(t => possible(t) === (filter === 'ok'));

  if (!rows.length) {
    liste.innerHTML = '<div class="rf-transfer-empty">Kayıt yok</div>';
    return;
  }

  liste.innerHTML = rows.map(t => {
    const ok = possible(t);
    const pb = t.kaynakPb || t.hedefPb || 'TRY';
    const noteHtml = t.aciklama ? esc(t.aciklama) : fmtDate(t.tarih);
    return `<div class="rf-transfer-row ${ok ? 'state-ok' : 'state-no'}" title="${ok ? 'Şu an tekrar yapılabilir' : 'Şu an tekrar yapılamaz'}">
      <div class="rf-transfer-main">
        <div class="rf-transfer-route"><span class="rf-transfer-seg">${esc(side(t, 'k'))}</span><span class="rf-transfer-arrow">${ARROW_SVG}</span><span class="rf-transfer-seg">${esc(side(t, 'h'))}</span></div>
        <div class="rf-transfer-note">${noteHtml}</div>
      </div>
      <div class="rf-transfer-amount">
        <div class="mono">${fmtCur(t.tutar, pb)}</div>
        ${t.aciklama ? `<div class="rf-transfer-date">${fmtDate(t.tarih)}</div>` : ''}
      </div>
      <div class="rf-transfer-actions">
        <button class="rf-transfer-tekrar-btn" data-id="${t.id}" title="Bu transferi tekrarla" aria-label="Bu transferi tekrarla">${REPEAT_SVG}</button>
        <button class="rf-transfer-sil-btn danger" data-id="${t.id}" title="Sil" aria-label="Sil">${TRASH_SVG}</button>
      </div>
    </div>`;
  }).join('');

  liste.querySelectorAll('.rf-transfer-tekrar-btn').forEach(btn => {
    btn.addEventListener('click', () => tekrarlaTransfer(btn.getAttribute('data-id')));
  });
  liste.querySelectorAll('.rf-transfer-sil-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTransfer(btn.getAttribute('data-id')));
  });
}

register('renderTransferLog', renderTransferLog);
register('openTransferLogFiltrePopup', openTransferLogFiltrePopup);

export { renderTransferLog };
