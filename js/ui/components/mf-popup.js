import { saveData } from '../../core/app-core-base.js';
import { tblFiltreMultiToggle, tblFiltreOkuMulti } from '../../core/app-core.js';
import { DB } from '../../core/state.js';
import { _scLockBodyScroll, _scUnlockBodyScroll } from './select-to-chips.js';
import { renderMevduat } from '../pages/mevduat/05-mevduat-liste-render.js';
import { bankaIkonObj } from '../pages/tanimlamalar/01-genel-yardimcilar.js';
// ============================================================
// js/ui/components/mf-popup.js — Çoklu seçimli filtre popup'ı
// ============================================================
// Banka gibi çok sayıda seçeneği olan filtreler chip satırına sığmadığı için
// bunun yerine bir "▾ Banka (n)" tetikleyici düğme + açılan bir popup (arama +
// onay işaretli liste) kullanılır. Seçimler tblFiltreMultiToggle üzerinden
// DB.uiFiltreler[sayfa][boyut] içine dizi olarak kaydedilir (kalıcı, Drive'a
// senkronize edilir) — popup her açıldığında ve her sayfa yüklendiğinde
// DB'den okunarak hatırlanır. sc-popup-* CSS sınıfları (genel arama popup'ı
// ile aynı) yeniden kullanılır, sadece kendi DOM'u ve state'i vardır.
export var _mfPopupState = null;
export function _ensureMfPopupEl() {
  let ov = document.getElementById('mf-popup-overlay');
  if(ov) return ov;
  ov = document.createElement('div');
  ov.id = 'mf-popup-overlay';
  ov.className = 'sc-popup-overlay';
  ov.innerHTML = `
    <div class="sc-popup-panel" role="dialog" aria-modal="true">
      <div class="sc-popup-drag-handle"></div>
      <div class="sc-popup-head">
        <span class="sc-popup-title" id="mf-popup-title"></span>
        <div class="sc-popup-search-wrap" id="mf-popup-search-wrap">
          <input type="text" class="sc-popup-search" id="mf-popup-input" placeholder="Ara…" autocomplete="off">
          <button type="button" class="sc-popup-clear-btn" id="mf-popup-clear" aria-label="Aramayı temizle">✕</button>
        </div>
        <button type="button" class="sc-popup-close" id="mf-popup-close-head" aria-label="Kapat">✕</button>
      </div>
      <div class="sc-popup-count" id="mf-popup-count"></div>
      <div class="sc-popup-list" id="mf-popup-list" role="listbox" aria-multiselectable="true"></div>
      <div class="mf-popup-footer">
        <button type="button" class="tbl-filtre-clear" id="mf-popup-clear-all">✕ Tümünü Temizle</button>
        <button type="button" class="btn btn-primary" id="mf-popup-close-foot">Tamam</button>
      </div>
    </div>`;
  ov.addEventListener('click', _closeMfPopup);
  document.body.appendChild(ov);
  const input = document.getElementById('mf-popup-input');
  const clearBtn = document.getElementById('mf-popup-clear');
  const searchWrap = document.getElementById('mf-popup-search-wrap');
  input.addEventListener('input', () => {
    searchWrap.classList.toggle('has-value', !!input.value);
    _renderMfPopupList(input.value);
  });
  clearBtn.addEventListener('click', () => { input.value = ''; searchWrap.classList.remove('has-value'); _renderMfPopupList(''); input.focus(); });

  // [ES module] onclick="..." kaldırıldı - gerçek addEventListener bağlanıyor.
  const panelEl = ov.querySelector('.sc-popup-panel');
  panelEl.addEventListener('click', (event) => { event.stopPropagation(); });
  document.getElementById('mf-popup-close-head').addEventListener('click', () => _closeMfPopup());
  document.getElementById('mf-popup-close-foot').addEventListener('click', () => _closeMfPopup());
  document.getElementById('mf-popup-clear-all').addEventListener('click', () => _mfPopupClearAll());
  return ov;
}

export function openMfFiltrePopup(sayfa, boyut, title, items, renderFn, triggerEl) {
  const ov = _ensureMfPopupEl();
  _mfPopupState = { sayfa, boyut, items, renderFn, triggerEl: triggerEl || document.activeElement };
  document.getElementById('mf-popup-title').textContent = title || '';
  const input = document.getElementById('mf-popup-input');
  input.value = '';
  document.getElementById('mf-popup-search-wrap').classList.remove('has-value');
  _renderMfPopupList('');
  ov.classList.add('open');
  _scLockBodyScroll();
  setTimeout(() => input.focus(), 30);
}

export function _renderMfPopupList(q) {
  const st = _mfPopupState;
  if(!st) return;
  const ql = (q||'').trim().toLocaleLowerCase('tr');
  const secili = tblFiltreOkuMulti(st.sayfa, st.boyut);
  const filtered = !ql ? st.items : st.items.filter(it => it.label.toLocaleLowerCase('tr').includes(ql));
  const countEl = document.getElementById('mf-popup-count');
  if(countEl) {
    if(secili.length) { countEl.classList.add('show'); countEl.setAttribute('data-txt', secili.length + ' seçili'); }
    else countEl.classList.remove('show');
  }
  const clearAllBtn = document.getElementById('mf-popup-clear-all');
  if(clearAllBtn) clearAllBtn.style.visibility = secili.length ? 'visible' : 'hidden';
  const listEl = document.getElementById('mf-popup-list');
  listEl.innerHTML = filtered.length ? filtered.map((it,i) => {
    const active = secili.includes(it.value);
    return `<div class="sc-popup-item${active?' sc-popup-active':''}" role="option" aria-selected="${active}" style="animation-delay:${Math.min(i,12)*13}ms" data-value="${it.value}">
      ${it.icon || ''}
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${it.label}</span>
      <svg class="sc-popup-item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    </div>`;
  }).join('') : `<div class="sc-popup-empty"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" style="width:30px;height:30px;flex-shrink:0"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><span>Sonuç bulunamadı</span></div>`;

  // [ES module] onclick="_mfPopupToggle(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
  listEl.querySelectorAll('.sc-popup-item').forEach(itemEl => {
    itemEl.addEventListener('click', () => _mfPopupToggle(itemEl.getAttribute('data-value')));
  });
}

export function _mfPopupToggle(val) {
  const st = _mfPopupState;
  if(!st) return;
  tblFiltreMultiToggle(st.sayfa, st.boyut, val);
  _renderMfPopupList(document.getElementById('mf-popup-input').value);
  if(typeof st.renderFn === 'function') st.renderFn();
}

export function _mfPopupClearAll() {
  const st = _mfPopupState;
  if(!st) return;
  if(!DB.uiFiltreler) DB.uiFiltreler = {};
  if(!DB.uiFiltreler[st.sayfa]) DB.uiFiltreler[st.sayfa] = {};
  DB.uiFiltreler[st.sayfa][st.boyut] = [];
  saveData();
  _renderMfPopupList(document.getElementById('mf-popup-input').value);
  if(typeof st.renderFn === 'function') st.renderFn();
}

export function _closeMfPopup() {
  const ov = document.getElementById('mf-popup-overlay');
  if(ov) ov.classList.remove('open');
  _scUnlockBodyScroll();
  const trigger = _mfPopupState && _mfPopupState.triggerEl;
  _mfPopupState = null;
  if(trigger && document.body.contains(trigger) && trigger.focus) setTimeout(() => trigger.focus(), 0);
}

export function _bankaFiltrePopupItems(bankaIdList) {
  return bankaIdList.map(id => {
    const b = (DB.bankalar||[]).find(x=>x.id===id);
    const ikon = bankaIkonObj(b);
    const icon = ikon.svg
      ? `<span class="bank-logo">${ikon.svg}</span>`
      : `<span class="bank-logo">${ikon.emoji}</span>`;
    return { value: id, label: b ? b.kisa : '?', icon };
  }).sort((a,b) => a.label.localeCompare(b.label, 'tr'));
}

export function openMevduatBankaFiltrePopup(triggerEl) {
  const idler = [...new Set((DB.mevduatlar||[]).map(m=>m.banka).filter(Boolean))];
  openMfFiltrePopup('mevduat', 'banka', 'Banka Filtrele', _bankaFiltrePopupItems(idler), renderMevduat, triggerEl);
}

// mf-popup: Escape ile kapama
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape' && document.getElementById('mf-popup-overlay')?.classList.contains('open')) _closeMfPopup();
});


