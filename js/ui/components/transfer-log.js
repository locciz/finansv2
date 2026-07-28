// ============================================================
// js/ui/components/transfer-log.js — "Son Transferler" listesi
// (Para Transferi modalının 1. adımındaki geçmiş bölümü)
//
// Sıfırdan yeniden yazıldı (2026-07). Eski dört katmanlı render
// mantığı (transfer-modal.js taban tanım + 01-transfer-log-senkron.js
// + tbk-detay.js DOM normalizasyonu + 07-genel-ui-burst-refresh.js
// inline-style ezmesi) kaldırılmıştı; bu dosya artık TEK render
// fonksiyonu, TEK HTML şablonu ve TEK class seti üretir
// (bkz. css/transfer-log.css). Başka hiçbir modül bu listeye
// runtime'da müdahale etmiyor.
//
// Yeni görünüm eklentileri:
//   - Başlıkta canlı kayıt sayacı ("12 kayıt")
//   - Gün bazlı gruplama ("Bugün" / "Dün" / tarih)
//   - Rota satırının solunda yapılabilirlik rozeti (yeşil/kırmızı ikon)
//   - Boş durum için ikonlu, bağlama duyarlı mesaj (filtre/arama farkı)
// ============================================================
import { inject } from '@core/container.js';
// DUAL-MODE CONTAINER KAYDI: altı bağımlılık da (core.appCoreBase,
// core.appCore, core.format, core.state, ui.components.mfPopup,
// ui.components.modalGenel, core.wrapRegistry, ui.components.transferModal)
// zaten container'a taşınmış katmanlara ait.
const _appCoreBase = inject('core.appCoreBase');
const _appCore = inject('core.appCore');
const _format = inject('core.format');
const _coreState = inject('core.state');
const _mfPopup = inject('ui.components.mfPopup');
const _modalGenel = inject('ui.components.modalGenel');
const _wrapRegistry = inject('core.wrapRegistry');
const _transferModal = inject('ui.components.transferModal');

function el(id) { return document.getElementById(id); }
function esc(x) {
  return String(x == null ? '' : x).replace(/[&<>"']/g, m => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}

function accLabel(h) {
  if (!h) return 'Hesap';
  const b = (_coreState.DB.bankalar || []).find(x => x.id === h.banka);
  const bank = (b && (b.kisa || b.ad)) || 'Banka';
  const last = (h.iban || '').replace(/\s+/g, '').slice(-4);
  return bank + ' · ' + (h.ad || 'Hesap') + (last ? ' · ····' + last : '');
}

function side(t, w) {
  if (w === 'k') {
    if (t.kTip === 'nakit') return ('Nakit ' + (t.kaynakPb || '')).trim();
    return accLabel((_coreState.DB.hesaplar || []).find(h => h.id === t.kaynakId));
  }
  if (t.hTip === 'nakit') return ('Nakit ' + (t.hedefPb || '')).trim();
  return accLabel((_coreState.DB.hesaplar || []).find(h => h.id === t.hedefId));
}

// Bu transfer şu an tekrar yapılabilir mi? (yeterli bakiye + hesap aktif mi)
function possible(t) {
  const tut = Number(t.tutar) || 0;
  let src = false, dst = false;
  if (t.kTip === 'nakit') {
    src = ((_coreState.DB._nakitBakiye || {})[t.kaynakPb] || 0) >= tut - 0.005;
  } else {
    const h = (_coreState.DB.hesaplar || []).find(x => x.id === t.kaynakId);
    src = !!(h && h.durum === 'aktif' && h.tur !== 'vadeli' && ((Number(h.bakiye) || 0) + (Number(h.kmhLimit) || 0)) >= tut - 0.005);
  }
  if (t.hTip === 'nakit') {
    dst = !!t.hedefPb;
  } else {
    const hh = (_coreState.DB.hesaplar || []).find(x => x.id === t.hedefId);
    dst = !!(hh && hh.durum === 'aktif' && hh.tur !== 'vadeli');
  }
  return src && dst;
}

function ensurePrefs() {
  _coreState.DB.uiFiltreler = _coreState.DB.uiFiltreler || {};
  _coreState.DB.uiFiltreler.transferLog = _coreState.DB.uiFiltreler.transferLog || {};
  const p = _coreState.DB.uiFiltreler.transferLog;
  if (!Array.isArray(p.filtre)) p.filtre = p.filtre ? [p.filtre] : [];
  if (typeof p.status !== 'string') p.status = '';
  return p;
}
function currentStatus() { return ensurePrefs().status || ''; }

export function setTransferLogStatusFilter(v) {
  ensurePrefs().status = v || '';
  if (typeof saveData === 'function') _appCoreBase.saveData();
  _wrapRegistry.call('renderTransferLog');
}

function renderStatusFilterBar() {
  const bar = el('rf-transfer-status-filter');
  if (!bar) return;
  const cur = currentStatus();
  const iconAllColor = cur === '' ? '#38bdf8' : '#94a3b8';
  const iconAll = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="${iconAllColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>`;
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
  (_coreState.DB.transferler || []).forEach(t => {
    if (t.kTip === 'hesap' && t.kaynakId) used.add(t.kaynakId);
    if (t.hTip === 'hesap' && t.hedefId) used.add(t.hedefId);
    if (t.kTip === 'nakit' && t.kaynakPb) cash.add(t.kaynakPb);
    if (t.hTip === 'nakit' && t.hedefPb) cash.add(t.hedefPb);
  });
  const a = Array.from(used).map(id => {
    const h = (_coreState.DB.hesaplar || []).find(x => x.id === id);
    return h ? { value: 'h:' + id, label: accLabel(h), icon: '<span class="bank-icon">🏦</span>' } : null;
  }).filter(Boolean);
  const c = Array.from(cash).filter(Boolean).map(pb => (
    { value: 'n:' + pb, label: 'Nakit (' + pb + ')', icon: '<span class="bank-icon">💵</span>' }
  ));
  return a.concat(c).sort((x, y) => x.label.localeCompare(y.label, 'tr'));
}

export function openTransferLogFiltrePopup(triggerEl) {
  const items = _transferLogFiltreItems();
  if (!items.length) { _modalGenel.showToast('Filtrelenecek transfer geçmişi yok', 'info'); return; }
  _mfPopup.openMfFiltrePopup('transferLog', 'filtre', 'Son Transferleri Filtrele', items, () => _wrapRegistry.call('renderTransferLog'), triggerEl);
}

export function _transferLogFiltreLabelGuncelle(hesapMap, seciliFiltreler) {
  const btn = el('transfer-log-filtre-btn');
  const label = el('transfer-log-filtre-label');
  if (!btn || !label) return;
  const ico = btn.querySelector('.rf-transfer-filtre-ico');
  const chev = btn.querySelector('.rf-transfer-filtre-chevron');
  if (!seciliFiltreler || !seciliFiltreler.length) {
    label.textContent = 'Tümü';
    label.className = 'sc-popup-placeholder';
    btn.classList.remove('sc-has-value');
    if (ico) ico.setAttribute('stroke', '#94a3b8');
    if (chev) chev.setAttribute('stroke', '#94a3b8');
    return;
  }
  btn.classList.add('sc-has-value');
  label.className = '';
  if (ico) ico.setAttribute('stroke', '#38bdf8');
  if (chev) chev.setAttribute('stroke', '#38bdf8');
  if (seciliFiltreler.length === 1) {
    const f = seciliFiltreler[0];
    label.textContent = f.startsWith('h:') ? (hesapMap[f.slice(2)] || 'Hesap') : ('Nakit (' + f.slice(2) + ')');
  } else {
    label.textContent = seciliFiltreler.length + ' seçili';
  }
}

const ARROW_SVG = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M3 8h9"/><path d="M9 4.5 12.5 8 9 11.5"/></svg>';
const REPEAT_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
const TRASH_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
const EMPTY_SVG = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;opacity:.5"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';

// t.tarih bir "YYYY-MM-DD" string ise gün grubu etiketi üretir.
function dayGroupLabel(tarih) {
  if (!tarih || typeof tarih !== 'string') return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  const toKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const key = tarih.slice(0, 10);
  if (key === toKey(today)) return 'Bugün';
  if (key === toKey(yest)) return 'Dün';
  return _format.fmtDate(tarih);
}

function renderTransferLog() {
  ensurePrefs();
  _coreState.DB.transferler = _coreState.DB.transferler || [];
  const liste = el('transfer-log-liste');
  const sec = el('transfer-log-msec');
  const countBadge = el('transfer-log-count');
  if (!liste) return;

  if (sec) sec.style.display = _coreState.DB.transferler.length ? '' : 'none';
  renderStatusFilterBar();
  if (!_coreState.DB.transferler.length) {
    liste.innerHTML = `<div class="rf-transfer-empty">${EMPTY_SVG}<div>Henüz transfer yok</div></div>`;
    if (countBadge) countBadge.textContent = '';
    return;
  }

  const hesapMap = {};
  (_coreState.DB.hesaplar || []).forEach(h => { hesapMap[h.id] = h.ad; });
  const selected = typeof tblFiltreOkuMulti === 'function' ? _appCore.tblFiltreOkuMulti('transferLog', 'filtre') : [];
  _transferLogFiltreLabelGuncelle(hesapMap, selected);

  let rows = _coreState.DB.transferler.slice().reverse();
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

  if (countBadge) countBadge.textContent = rows.length ? (rows.length + (rows.length === 1 ? ' kayıt' : ' kayıt')) : '';

  if (!rows.length) {
    liste.innerHTML = `<div class="rf-transfer-empty">${EMPTY_SVG}<div>Bu filtreye uyan kayıt yok</div></div>`;
    return;
  }

  let lastGroup = null;
  const html = [];
  rows.forEach(t => {
    const grp = dayGroupLabel(t.tarih);
    if (grp && grp !== lastGroup) {
      html.push(`<div class="rf-transfer-daygroup">${esc(grp)}</div>`);
      lastGroup = grp;
    }
    const ok = possible(t);
    const pb = t.kaynakPb || t.hedefPb || 'TRY';
    const noteHtml = t.aciklama ? esc(t.aciklama) : _format.fmtDate(t.tarih);
    html.push(`<div class="rf-transfer-row ${ok ? 'state-ok' : 'state-no'}" title="${ok ? 'Şu an tekrar yapılabilir' : 'Şu an tekrar yapılamaz'}">
      <div class="rf-transfer-route"><span class="rf-transfer-seg">${esc(side(t, 'k'))}</span><span class="rf-transfer-arrow">${ARROW_SVG}</span><span class="rf-transfer-seg">${esc(side(t, 'h'))}</span></div>
      <div class="rf-transfer-bottom">
        <div class="rf-transfer-note">${noteHtml}</div>
        <div class="rf-transfer-amount"><span class="mono">${_format.fmtCur(t.tutar, pb)}</span></div>
        <div class="rf-transfer-actions">
          <button class="rf-transfer-tekrar-btn" data-id="${t.id}" title="Bu transferi tekrarla" aria-label="Bu transferi tekrarla">${REPEAT_SVG}</button>
          <button class="rf-transfer-sil-btn danger" data-id="${t.id}" title="Sil" aria-label="Sil">${TRASH_SVG}</button>
        </div>
      </div>
    </div>`);
  });
  liste.innerHTML = html.join('');

  liste.querySelectorAll('.rf-transfer-tekrar-btn').forEach(btn => {
    btn.addEventListener('click', () => _transferModal.tekrarlaTransfer(btn.getAttribute('data-id')));
  });
  liste.querySelectorAll('.rf-transfer-sil-btn').forEach(btn => {
    btn.addEventListener('click', () => _transferModal.deleteTransfer(btn.getAttribute('data-id')));
  });
}

_wrapRegistry.register('renderTransferLog', renderTransferLog);
_wrapRegistry.register('openTransferLogFiltrePopup', openTransferLogFiltrePopup);

export { renderTransferLog };

// ============================================================
// [DI-MIGRATION] ui.components.transferLog — container'a kayıt
// ============================================================
import { provide } from '@core/container.js';
provide('ui.components.transferLog', {
  setTransferLogStatusFilter, _transferLogFiltreItems,
  openTransferLogFiltrePopup, _transferLogFiltreLabelGuncelle,
  renderTransferLog,
});
