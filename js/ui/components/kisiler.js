import { inject } from '@core/container.js';
// DUAL-MODE CONTAINER KAYDI: core.appCoreBase, core.format, core.state,
// domain.bankaVerisi, domain.ibanUtils zaten container'a taşınmış
// katmanlara ait. iban-ui.js ve modal-genel.js ile üçlü dairesel bağımlılık
// var (bkz. iban-ui.js'teki aynı yorum) — inject() ile güvenle çözülüyor.
// @pages/* importları o katman henüz taşınmadığı için BİLİNÇLİ OLARAK korunuyor.
const _appCoreBase = inject('core.appCoreBase');
const _format = inject('core.format');
const _coreState = inject('core.state');
const _bankaVerisi = inject('domain.bankaVerisi');
const _ibanUtils = inject('domain.ibanUtils');
const _ibanUi = inject('ui.components.ibanUi');
const _modalGenel = inject('ui.components.modalGenel');
import { populateEldenKisiSelect } from '@pages/elden.js';
import { populateKiraKisiSelects } from '@pages/kira.js';
import { populateMaasKisiSelects } from '@pages/maas.js';
import { bankaLogoByKod } from '@pages/tanimlamalar/01-genel-yardimcilar.js';
import { populateKategoriSelects } from '@pages/tanimlamalar/03-kategoriler.js';
// ============================================================
// js/ui/components/kisiler.js — Kişiler/Karşı Taraflar yönetimi
// (Kişiler sayfası modalı + formlarda kullanılan Mini Kişi Popup'ı)
// ============================================================
export var editKisiId = null;
export var _kisiIbanlar = [];

// ── Mini Kişi Popup (formlardan hızlı kişi seç/ekle) ─────────
export var _mkpTargetSelectId = null;
export var _mkpEditId = null;
export var _mkpSearchQ = '';
export var _mkpExpanded = {}; // hangi kişinin IBAN bölümü açık, kisiId -> bool

export function openKisiModal(id=null) {
  editKisiId = id;
  _kisiIbanlar = [];
  if(id) {
    const k = (_coreState.DB.kisiler||[]).find(x=>x.id===id);
    if(!k) return;
    document.getElementById('kisi-modal-title').textContent = 'Kişi Düzenle';
    document.getElementById('kisi-ad').value = k.ad||'';
    document.getElementById('kisi-tel').value = k.tel||'';
    document.getElementById('kisi-not').value = k.not||'';
    _kisiIbanlar = (k.ibanlar||[]).map(x=>({...x}));
  } else {
    document.getElementById('kisi-modal-title').textContent = 'Kişi Ekle';
    document.getElementById('kisi-ad').value = '';
    document.getElementById('kisi-tel').value = '';
    document.getElementById('kisi-not').value = '';
  }
  document.getElementById('kisi-yeni-iban').value = '';
  document.getElementById('kisi-yeni-iban-etiket').value = '';
  renderKisiIbanList();
  _modalGenel.openModal('modal-kisi');
}

export function _kisiIbanBankaBilgi(iban) {
  const parsed = (typeof parseIban === 'function') ? _ibanUtils.parseIban(iban) : null;
  if(!parsed) return null;
  const dbMatch = (_coreState.DB.bankalar||[]).find(b => b.ibanKod === parsed.bankaKodu);
  const ad = dbMatch ? (dbMatch.kisa || dbMatch.tam || '') : ((typeof _bankaVerisi.IBAN_BANKA_MAP !== 'undefined' && _bankaVerisi.IBAN_BANKA_MAP[parsed.bankaKodu]) || '');
  const logo = (dbMatch && dbMatch.logo) || (typeof bankaLogoByKod === 'function' ? bankaLogoByKod(parsed.bankaKodu) : '') || '';
  if(!ad && !logo) return null;
  return { ad, logo };
}

export function kisiIbanEkle() {
  const ibanEl = document.getElementById('kisi-yeni-iban');
  const etiketEl = document.getElementById('kisi-yeni-iban-etiket');
  const statusEl = document.getElementById('kisi-iban-status');
  const raw = ibanEl.value.replace(/\s+/g,'').toUpperCase();

  if(!raw) {
    statusEl.innerHTML = '<span style="color:var(--danger)">IBAN giriniz</span>';
    ibanEl.focus();
    return;
  }
  if(!/^TR\d{24}$/.test(raw) || !_ibanUtils.ibanMod97(raw)) {
    statusEl.innerHTML = '<span style="color:var(--danger)">⚠ Geçersiz IBAN — lütfen kontrol edin</span>';
    ibanEl.style.borderColor = 'var(--rose)';
    ibanEl.focus();
    return;
  }
  if(_kisiIbanlar.find(x=>x.iban===raw)) {
    statusEl.innerHTML = '<span style="color:var(--danger)">Bu IBAN zaten ekli</span>';
    return;
  }

  _kisiIbanlar.push({iban: raw, etiket: etiketEl.value.trim()});
  ibanEl.value = '';
  etiketEl.value = '';
  ibanEl.style.borderColor = '';
  statusEl.innerHTML = '';
  renderKisiIbanList();
  ibanEl.focus();
}

export function mkpFilterList(q) {
  _mkpSearchQ = q || '';
  const wrap = document.getElementById('mkp-search-wrap');
  if (wrap) wrap.classList.toggle('has-value', !!_mkpSearchQ);
  mkpRenderList();
}

export function openMiniKisiPopup(triggerEl, targetSelectId) {
  _mkpTargetSelectId = targetSelectId;
  _mkpEditId = null;
  const popup = document.getElementById('mini-kisi-popup');
  const backdrop = document.getElementById('mini-kisi-backdrop');

  popup.style.display = 'flex';
  backdrop.style.display = 'block';

  // Mobilde pozisyon hesaplama yok — CSS ile bottom sheet
  if (window.innerWidth > 768) {
    const rect = triggerEl.getBoundingClientRect();
    const popupW = 360;
    const popupH = Math.min(600, window.innerHeight * 0.8);
    const margin = 8;

    let left = rect.right - popupW;
    if (left < margin) left = margin;
    if (left + popupW > window.innerWidth - margin) left = window.innerWidth - popupW - margin;

    let top = rect.bottom + 6;
    if (top + popupH > window.innerHeight - margin) {
      top = rect.top - popupH - 6;
    }
    if (top < margin) top = margin;

    popup.style.left = left + 'px';
    popup.style.top  = top  + 'px';
  } else {
    popup.style.left = '';
    popup.style.top  = '';
  }

  // Form & expanded state sıfırla
  _mkpExpanded = {};
  document.getElementById('mkp-add-form').classList.remove('open');
  document.getElementById('mkp-ad').value = '';
  document.getElementById('mkp-tel').value = '';
  document.getElementById('mkp-not').value = '';
  // Arama kutusunu da sıfırla — önceki açılıştan kalan sorgu gösterilmesin
  _mkpSearchQ = '';
  const searchEl = document.getElementById('mkp-search');
  if (searchEl) searchEl.value = '';
  const searchWrapEl = document.getElementById('mkp-search-wrap');
  if (searchWrapEl) searchWrapEl.classList.remove('has-value');

  mkpRenderList();
}

export function closeMiniKisiPopup() {
  const popup = document.getElementById('mini-kisi-popup');
  const backdrop = document.getElementById('mini-kisi-backdrop');
  popup.classList.add('closing');
  setTimeout(() => {
    popup.style.display = 'none';
    popup.classList.remove('closing');
    backdrop.style.display = 'none';
    _mkpTargetSelectId = null;
    _mkpEditId = null;
  }, 140);
}

export function mkpRenderList() {
  const list = document.getElementById('mkp-list');
  const allKisiler = _coreState.DB.kisiler || [];
  const currentVal = _mkpTargetSelectId ? (document.getElementById(_mkpTargetSelectId)||{}).value : '';

  const q = (_mkpSearchQ || '').toLocaleLowerCase('tr').trim();
  const kisiler = q
    ? allKisiler.filter(k => {
        const ibanHay = (k.ibanlar||[]).map(ib => ((ib.iban||ib||'') + ' ' + (ib.etiket||''))).join(' ');
        return ((k.ad||'') + ' ' + (k.tel||'') + ' ' + ibanHay).toLocaleLowerCase('tr').includes(q);
      })
    : allKisiler;

  if (!allKisiler.length) {
    list.innerHTML = '<div class="mkp-empty">Henüz kayıtlı kişi yok.<br>Aşağıdan ekleyebilirsiniz.</div>';
    return;
  }
  if (!kisiler.length) {
    list.innerHTML = `<div class="mkp-empty">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="opacity:.4;margin-bottom:6px"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <br>"${q}" için sonuç bulunamadı</div>`;
    return;
  }

  list.innerHTML = kisiler.map((k, renderIdx) => {
    const initials = k.ad.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const ibans = k.ibanlar || [];
    const ibanCount = ibans.length;
    const meta = [k.tel, ibanCount === 1 ? '1 IBAN' : ibanCount > 1 ? ibanCount + ' IBAN 🔽' : ''].filter(Boolean).join(' · ');
    const isSelected = currentVal === k.id;
    const isExpanded = !!_mkpExpanded[k.id];

    const ibanListHtml = ibans.map((ib, i) => `
      <div class="mkp-iban-row mkp-iban-selectable mkp-iban-select-row" data-kisi-id="${k.id}" data-iban="${ib.iban || ib}" title="Forma seç">
        <span class="mkp-iban-code" title="${ib.iban}">${ib.iban.replace(/(.{4})/g,'$1 ').trim()}</span>
        ${ib.etiket ? `<span class="mkp-iban-label">${ib.etiket}</span>` : ''}
        <button class="mkp-iban-use mkp-iban-select-btn" data-kisi-id="${k.id}" data-iban="${ib.iban || ib}" title="Forma seç">↩ Seç</button>
        <button class="mkp-iban-copy mkp-iban-copy-btn" data-iban="${ib.iban}" title="Kopyala">⎘</button>
        <button class="mkp-iban-del mkp-iban-del-btn" data-kisi-id="${k.id}" data-idx="${i}" title="Sil">✕</button>
      </div>`).join('');

    const ibanSection = isExpanded ? `
      <div class="mkp-iban-section mkp-stop-propagation">
        ${ibanListHtml}
        <div class="mkp-iban-add-row">
          <input class="mkp-iban-input" id="mkp-iban-val-${k.id}" placeholder="TR00 0000 … IBAN" autocomplete="off"
            onkeydown="if(event.key==='Enter'){mkpAddIban('${k.id}');event.preventDefault()}">
          <input class="mkp-iban-label-input" id="mkp-iban-lbl-${k.id}" placeholder="Etiket" autocomplete="off"
            onkeydown="if(event.key==='Enter'){mkpAddIban('${k.id}');event.preventDefault()}">
          <button class="mkp-iban-add-btn mkp-iban-add-click-btn" data-kisi-id="${k.id}">+ Ekle</button>
        </div>
      </div>` : '';

    return `<div class="mkp-item-wrap${isSelected?' selected':''}" style="animation-delay:${Math.min(renderIdx,10) * 22}ms">
      <div class="mkp-item mkp-select-kisi-row" data-kisi-id="${k.id}">
        <div class="mkp-avatar">${initials||'?'}</div>
        <div class="mkp-info">
          <div class="mkp-name">${k.ad}</div>
          ${meta ? `<div class="mkp-meta">${meta}</div>` : ''}
        </div>
        <div class="mkp-actions mkp-stop-propagation">
          ${ibanCount > 0 || true ? `<button class="mkp-expand-btn mkp-toggle-iban-btn" data-kisi-id="${k.id}" title="${isExpanded?'Gizle':'IBAN göster'}">${isExpanded?'▴':'▾'} IBAN</button>` : ''}
          <button class="mkp-act-btn mkp-edit-kisi-btn" data-kisi-id="${k.id}" title="Düzenle">✏</button>
          <button class="mkp-act-btn del mkp-delete-kisi-btn" data-kisi-id="${k.id}" title="Sil">✕</button>
        </div>
      </div>
      ${ibanSection}
    </div>`;
  }).join('');

  // [ES module] onclick="mkpSelectIbanToForm(...)", onclick="mkpCopyIban(...)",
  // onclick="mkpDeleteIban(...)", onclick="mkpAddIban(...)", onclick="mkpSelectKisi(...)",
  // onclick="mkpToggleIban(...)", onclick="mkpEditKisi(...)", onclick="mkpDeleteKisi(...)",
  // onclick="event.stopPropagation()" kaldırıldı - gerçek addEventListener bağlanıyor.
  list.querySelectorAll('.mkp-stop-propagation').forEach(el => {
    el.addEventListener('click', (event) => event.stopPropagation());
  });
  list.querySelectorAll('.mkp-iban-select-row').forEach(row => {
    row.addEventListener('click', (event) => {
      event.stopPropagation();
      mkpSelectIbanToForm(row.dataset.kisiId, row.dataset.iban);
    });
  });
  list.querySelectorAll('.mkp-iban-select-btn').forEach(btn => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      mkpSelectIbanToForm(btn.dataset.kisiId, btn.dataset.iban);
    });
  });
  list.querySelectorAll('.mkp-iban-copy-btn').forEach(btn => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      mkpCopyIban(btn.dataset.iban);
    });
  });
  list.querySelectorAll('.mkp-iban-del-btn').forEach(btn => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      mkpDeleteIban(btn.dataset.kisiId, parseInt(btn.dataset.idx, 10));
    });
  });
  list.querySelectorAll('.mkp-iban-add-click-btn').forEach(btn => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      mkpAddIban(btn.dataset.kisiId);
    });
  });
  list.querySelectorAll('.mkp-select-kisi-row').forEach(row => {
    row.addEventListener('click', () => mkpSelectKisi(row.dataset.kisiId));
  });
  list.querySelectorAll('.mkp-toggle-iban-btn').forEach(btn => {
    btn.addEventListener('click', () => mkpToggleIban(btn.dataset.kisiId));
  });
  list.querySelectorAll('.mkp-edit-kisi-btn').forEach(btn => {
    btn.addEventListener('click', () => mkpEditKisi(btn.dataset.kisiId));
  });
  list.querySelectorAll('.mkp-delete-kisi-btn').forEach(btn => {
    btn.addEventListener('click', () => mkpDeleteKisi(btn.dataset.kisiId));
  });
}

export function mkpToggleIban(kisiId) {
  _mkpExpanded[kisiId] = !_mkpExpanded[kisiId];
  mkpRenderList();
  // Focus on iban input if just opened
  if (_mkpExpanded[kisiId]) {
    setTimeout(() => {
      const inp = document.getElementById('mkp-iban-val-' + kisiId);
      if (inp) inp.focus();
    }, 30);
  }
}

// [ES module] eskiden top-level 'function mkpAddIban(){}' klasik <script>'te otomatik
// window.mkpAddIban olurdu; modülde olmadığı için elle eklendi (satır içi onkeydown="mkpAddIban(...)" kullanıyor).
export function mkpAddIban(kisiId) {
  const valEl = document.getElementById('mkp-iban-val-' + kisiId);
  const lblEl = document.getElementById('mkp-iban-lbl-' + kisiId);
  if (!valEl) return;
  const statusEl = _ibanUi.ensureIbanStatus(valEl);
  const errIcon = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  const raw = valEl.value.replace(/\s+/g,'').toUpperCase();

  if (!raw) {
    statusEl.innerHTML = `<span class="iban-status iban-err">${errIcon} IBAN giriniz</span>`;
    valEl.style.borderColor = 'var(--rose)';
    valEl.focus();
    return;
  }
  const parsed = _ibanUtils.parseIban(raw);
  if (!parsed) {
    statusEl.innerHTML = `<span class="iban-status iban-err">${errIcon} Geçersiz IBAN — lütfen kontrol edin</span>`;
    valEl.style.borderColor = 'var(--rose)';
    valEl.focus();
    return;
  }
  const k = (_coreState.DB.kisiler||[]).find(x=>x.id===kisiId);
  if (!k) return;
  if (!k.ibanlar) k.ibanlar = [];
  if (k.ibanlar.some(x=>x.iban===raw)) {
    statusEl.innerHTML = `<span class="iban-status iban-err">${errIcon} Bu IBAN zaten ekli</span>`;
    valEl.style.borderColor = 'var(--rose)';
    return;
  }

  const lbl = lblEl ? lblEl.value.trim() : '';
  k.ibanlar.push({ iban: raw, etiket: lbl });
  _appCoreBase.saveData();
  populateEldenKisiSelect();
  try { renderKisilerGrid(); } catch(e) {}
  mkpRenderList();
  // Keep expanded after add
  _mkpExpanded[kisiId] = true;
  setTimeout(() => {
    const inp = document.getElementById('mkp-iban-val-' + kisiId);
    if (inp) inp.focus();
  }, 30);
  _modalGenel.showToast('IBAN eklendi ✓');
}

export function mkpDeleteIban(kisiId, idx) {
  const k = (_coreState.DB.kisiler||[]).find(x=>x.id===kisiId);
  if (!k || !k.ibanlar) return;
  k.ibanlar.splice(idx, 1);
  _appCoreBase.saveData();
  populateEldenKisiSelect();
  try { renderKisilerGrid(); } catch(e) {}
  _mkpExpanded[kisiId] = true;
  mkpRenderList();
}

export function mkpCopyIban(iban) {
  navigator.clipboard.writeText(iban)
    .then(()=>_modalGenel.showToast('IBAN kopyalandı ✓'))
    .catch(()=>_modalGenel.showToast('Kopyalanamadı', 'error'));
}

export function mkpSelectKisi(id) {
  if (!_mkpTargetSelectId) return;
  const sel = document.getElementById(_mkpTargetSelectId);
  if (!sel) return;
  sel.value = id;
  sel.dispatchEvent(new Event('change'));
  // Kişinin IBAN sayısını kontrol et — birden fazlaysa popup'ı kapatmadan seçtir
  const kisi = (_coreState.DB.kisiler||[]).find(k=>k.id===id);
  if (kisi && kisi.ibanlar && kisi.ibanlar.length > 1) {
    // Popup'ı açık bırak, IBAN bölümünü aç
    _mkpExpanded[id] = true;
    mkpRenderList();
    // Scroll to item
    setTimeout(() => {
      const wrap = document.querySelector('.mkp-item-wrap.selected');
      if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
    _modalGenel.showToast('IBAN seçin ↓', 'info');
    return;
  }
  closeMiniKisiPopup();
}

export function mkpSelectIbanToForm(kisiId, iban) {
  if (!_mkpTargetSelectId) return;
  // Target select ID'den iban input ID'sini bul
  // Convention: maas-kisi → maas-karsi-iban, kira-kisi → kira-karsi-iban, elden-kisi → elden-karsi-iban
  const prefix = _mkpTargetSelectId.replace('-kisi', '');
  const ibanInputId = prefix + '-karsi-iban';
  const ibanInput = document.getElementById(ibanInputId);
  const raw = iban.replace(/\s+/g,'').toUpperCase();
  if (ibanInput) {
    ibanInput.value = raw;
    if (typeof formatIbanView === 'function') _ibanUtils.formatIbanView(ibanInput);
  }
  // Kisi zaten seçili, IBAN chip'lerini güncelle
  const kisi = (_coreState.DB.kisiler||[]).find(k=>k.id===kisiId);
  if (kisi) {
    const pickerWrapId = prefix + '-iban-picker';
    const chipsId = prefix + '-iban-chips';
    _ibanUi.renderIbanPicker(kisiId, pickerWrapId, chipsId, ibanInputId);
  }
  closeMiniKisiPopup();
  _modalGenel.showToast('IBAN seçildi ✓');
}

export function mkpToggleAddForm() {
  const form = document.getElementById('mkp-add-form');
  const isOpen = form.classList.contains('open');
  if (isOpen) {
    form.classList.remove('open');
    _mkpEditId = null;
    document.getElementById('mkp-ad').value = '';
    document.getElementById('mkp-tel').value = '';
    document.getElementById('mkp-not').value = '';
  } else {
    form.classList.add('open');
    setTimeout(() => document.getElementById('mkp-ad').focus(), 50);
  }
}

export function mkpEditKisi(id) {
  const k = (_coreState.DB.kisiler||[]).find(x=>x.id===id);
  if (!k) return;
  _mkpEditId = id;
  const form = document.getElementById('mkp-add-form');
  form.classList.add('open');
  document.getElementById('mkp-ad').value  = k.ad  || '';
  document.getElementById('mkp-tel').value = k.tel || '';
  document.getElementById('mkp-not').value = k.not || '';
  setTimeout(() => document.getElementById('mkp-ad').focus(), 50);
}

export function mkpSaveKisi() {
  const ad = document.getElementById('mkp-ad').value.trim();
  if (!ad) { document.getElementById('mkp-ad').classList.add('field-error'); setTimeout(()=>document.getElementById('mkp-ad').classList.remove('field-error'),1500); return; }
  if (!_coreState.DB.kisiler) _coreState.DB.kisiler = [];

  if (_mkpEditId) {
    const idx = _coreState.DB.kisiler.findIndex(x=>x.id===_mkpEditId);
    if (idx >= 0) {
      _coreState.DB.kisiler[idx] = { ..._coreState.DB.kisiler[idx], ad,
        tel: document.getElementById('mkp-tel').value.trim(),
        not: document.getElementById('mkp-not').value.trim()
      };
    }
    _mkpEditId = null;
  } else {
    _coreState.DB.kisiler.push({
      id: _format.uid(), ad,
      tel: document.getElementById('mkp-tel').value.trim(),
      not: document.getElementById('mkp-not').value.trim(),
      ibanlar: []
    });
  }

  _appCoreBase.saveData();
  // Tüm kişi select'lerini güncelle
  populateEldenKisiSelect();
  if (typeof populateKiraKisiSelects === 'function') populateKiraKisiSelects();
  if (typeof populateMaasKisiSelects === 'function') populateMaasKisiSelects();
  // Genel populate
  try { populateKategoriSelects(); } catch(e) {}

  // Form sıfırla
  document.getElementById('mkp-ad').value = '';
  document.getElementById('mkp-tel').value = '';
  document.getElementById('mkp-not').value = '';
  document.getElementById('mkp-add-form').classList.remove('open');
  mkpRenderList();
  _modalGenel.showToast('Kişi kaydedildi ✓');
}

export function mkpDeleteKisi(id) {
  _modalGenel.showConfirm('Bu kişiyi silmek istiyor musunuz?', () => {
    _coreState.DB.kisiler = (_coreState.DB.kisiler||[]).filter(x=>x.id!==id);
    _appCoreBase.saveData();
    populateEldenKisiSelect();
    try { populateKiraKisiSelects(); } catch(e) {}
    try { populateMaasKisiSelects(); } catch(e) {}
    renderKisilerGrid();
    mkpRenderList();
    _modalGenel.showToast('Kişi silindi');
  });
}


// ── Kişiler sayfası: grid render + CRUD ──────────────────────
export function renderKisiIbanList() {
  const el = document.getElementById('kisi-iban-list');
  const cnt = document.getElementById('kisi-iban-count');
  if(!el) return;
  if(cnt) cnt.textContent = _kisiIbanlar.length ? `${_kisiIbanlar.length} IBAN` : '';
  if(!_kisiIbanlar.length) {
    el.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:2px 0 4px">Henüz IBAN eklenmedi</div>';
    return;
  }
  el.innerHTML = _kisiIbanlar.map((ib,i) => {
    const banka = _kisiIbanBankaBilgi(ib.iban);
    const bankaHtml = banka ? `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        ${banka.logo ? `<span class="bank-logo bank-logo-sm">${banka.logo}</span>` : ''}
        ${banka.ad ? `<span style="font-size:11px;font-weight:600;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${banka.ad}</span>` : ''}
      </div>` : '';
    return `
    <div style="display:flex;align-items:flex-start;gap:8px;padding:9px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px">
      <div style="display:flex;flex-direction:column;flex:1;min-width:0">
        ${bankaHtml}
        <div style="font-family:var(--mono);font-size:12.5px;color:var(--accent2);letter-spacing:.03em;word-break:break-all;line-height:1.4">${ib.iban.replace(/(.{4})/g,'$1 ').trim()}</div>
        ${ib.etiket?`<div style="font-size:10.5px;color:var(--text3);margin-top:2px">${ib.etiket}</div>`:''}
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0">
        <button class="btn btn-ghost btn-sm kisi-iban-copy-btn" style="padding:4px 8px" title="Kopyala" data-iban="${ib.iban}">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button class="btn btn-sm kisi-iban-del-btn" style="padding:4px 8px;background:rgba(251,113,133,.1);border:1px solid rgba(251,113,133,.25);color:var(--danger)" title="Sil" data-idx="${i}">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');

  // [ES module] onclick="navigator.clipboard.writeText(...)", onclick="_kisiIbanlar.splice(...)"
  // kaldırıldı - gerçek addEventListener bağlanıyor. Silme işlemi _kisiIbanlar üzerinde doğrudan
  // mutasyon yaptığı için (module-level değişken), closure ile canlı referans kullanılıyor —
  // dizinin kendisi (index değil) tutuluyor, böylece sonraki render'larda index kayması sorun olmaz.
  el.querySelectorAll('.kisi-iban-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.iban).then(() => _modalGenel.showToast('IBAN kopyalandı ✓'));
    });
  });
  el.querySelectorAll('.kisi-iban-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _kisiIbanlar.splice(parseInt(btn.dataset.idx, 10), 1);
      renderKisiIbanList();
    });
  });
}

export function saveKisi() {
  const ad = document.getElementById('kisi-ad').value.trim();
  if(!_modalGenel.validateRequiredFields([{id:'kisi-ad',msg:'Ad zorunlu'}])) return;
  if(!_coreState.DB.kisiler) _coreState.DB.kisiler = [];
  const isYeni = !editKisiId;
  const kisi = {
    id: editKisiId || _format.uid(),
    ad,
    tel: document.getElementById('kisi-tel').value.trim(),
    not: document.getElementById('kisi-not').value.trim(),
    ibanlar: _kisiIbanlar
  };
  if(editKisiId) {
    const idx = _coreState.DB.kisiler.findIndex(x=>x.id===editKisiId);
    if(idx>=0) _coreState.DB.kisiler[idx]=kisi;
  } else {
    _coreState.DB.kisiler.push(kisi);
  }
  editKisiId = null;
  _kisiIbanlar = [];
  _appCoreBase.saveData();
  _modalGenel.closeModal('modal-kisi');
  renderKisilerGrid();
  populateEldenKisiSelect();
  const ibanAdet = kisi.ibanlar.length;
  if(isYeni) {
    _modalGenel.showToast(ibanAdet ? `Kişi eklendi · ${ibanAdet} IBAN kaydedildi ✓` : 'Kişi eklendi ✓');
  } else {
    _modalGenel.showToast(ibanAdet ? `Kişi güncellendi · ${ibanAdet} IBAN ✓` : 'Kişi güncellendi ✓');
  }
}

export function deleteKisi(id) {
  _modalGenel.showConfirm('Bu kişiyi silmek istiyor musunuz?', () => {
    _coreState.DB.kisiler = (_coreState.DB.kisiler||[]).filter(x=>x.id!==id);
    _appCoreBase.saveData();
    renderKisilerGrid();
    populateEldenKisiSelect();
  });
}

export function renderKisilerGrid() {
  const grid = document.getElementById('kisiler-grid');
  if(!grid) return;
  const kisiler = _coreState.DB.kisiler||[];
  if(!kisiler.length) {
    grid.innerHTML = '<div style="color:var(--text3);padding:20px;grid-column:1/-1;text-align:center">Henüz kişi eklenmedi. "+ Kişi Ekle" butonuna tıklayın.</div>';
    return;
  }
  grid.innerHTML = kisiler.map(k => {
    const ibanHtml = (k.ibanlar||[]).map(ib=>`
      <div style="display:flex;align-items:center;gap:6px;margin-top:5px">
        <code style="font-family:var(--mono);font-size:11px;color:var(--accent2);background:var(--surface3);padding:2px 6px;border-radius:4px;flex:1;word-break:break-all">${ib.iban.replace(/(.{4})/g,'$1 ').trim()}</code>
        ${ib.etiket?`<span style="font-size:10px;color:var(--text3)">${ib.etiket}</span>`:''}
        <button class="btn btn-ghost btn-sm kisi-grid-iban-copy-btn" data-iban="${ib.iban}" style="padding:2px 6px;flex-shrink:0" title="Kopyala"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><rect x="5" y="5" width="8" height="9" rx="1.5"/><path d="M3 11V3a1 1 0 0 1 1-1h7"/></svg></button>
      </div>`).join('');
    return `<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:12px;padding:14px 16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--text)">${k.ad}</div>
          ${k.tel?`<div style="font-size:11px;color:var(--text3)">📞 ${k.tel}</div>`:''}
          ${k.not?`<div style="font-size:11px;color:var(--text3);margin-top:2px">${k.not}</div>`:''}
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm btn-act kisi-grid-edit-btn" data-id="${k.id}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/></svg></button>
          <button class="btn btn-danger btn-sm btn-act kisi-grid-delete-btn" data-id="${k.id}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><polyline points="3,5 13,5"/><path d="M6 5V3h4v2M5 5l1 9h4l1-9"/></svg></button>
        </div>
      </div>
      ${ibanHtml || '<div style="font-size:11px;color:var(--text3);margin-top:4px">IBAN yok</div>'}
    </div>`;
  }).join('');

  // [ES module] onclick="navigator.clipboard.writeText(...)", onclick="openKisiModal(...)",
  // onclick="deleteKisi(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
  grid.querySelectorAll('.kisi-grid-iban-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.iban).then(() => _modalGenel.showToast('IBAN kopyalandı ✓'));
    });
  });
  grid.querySelectorAll('.kisi-grid-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openKisiModal(btn.dataset.id));
  });
  grid.querySelectorAll('.kisi-grid-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteKisi(btn.dataset.id));
  });
}

// ── Kayıtlı kişi / manuel giriş toggle (Kira/Maaş/Elden formları) ──
export function toggleKtMode(prefix) {
  const block = document.getElementById(prefix + '-kt-block');
  const btn   = document.getElementById(prefix + '-kt-toggle');
  if (!block) return;
  const isManuel = block.dataset.mode === 'manuel';
  if (isManuel) {
    // Kayıtlı moda dön
    block.dataset.mode = 'kayitli';
    if (btn) btn.textContent = '✏️ Manuel gir';
    // Manuel alanları temizle
    const adEl = document.getElementById(prefix + '-karsi-ad');
    const ibanManuelEl = document.getElementById(prefix + '-karsi-iban-manuel');
    if (adEl) adEl.value = '';
    if (ibanManuelEl) ibanManuelEl.value = '';
  } else {
    // Manuel moda geç
    block.dataset.mode = 'manuel';
    if (btn) btn.textContent = '← Kayıtlıdan seç';
    // Kayıtlı seçimi temizle & IBAN alanını gizle
    const kisiSel = document.getElementById(prefix + '-kisi');
    if (kisiSel) kisiSel.value = '';
    const ibanField = document.getElementById(prefix + '-iban-field');
    if (ibanField) ibanField.style.display = 'none';
    const ibanEl = document.getElementById(prefix + '-karsi-iban');
    if (ibanEl) ibanEl.value = '';
    const picker = document.getElementById(prefix + '-iban-picker');
    if (picker) picker.style.display = 'none';
  }
}



// ============================================================
// [DI-MIGRATION] ui.components.kisiler — container'a kayıt
// ============================================================
import { provide } from '@core/container.js';
provide('ui.components.kisiler', {
  get editKisiId() { return editKisiId; },
  get _kisiIbanlar() { return _kisiIbanlar; },
  get _mkpTargetSelectId() { return _mkpTargetSelectId; },
  get _mkpEditId() { return _mkpEditId; },
  get _mkpSearchQ() { return _mkpSearchQ; },
  get _mkpExpanded() { return _mkpExpanded; },
  openKisiModal, _kisiIbanBankaBilgi, kisiIbanEkle, mkpFilterList,
  openMiniKisiPopup, closeMiniKisiPopup, mkpRenderList, mkpToggleIban,
  mkpAddIban, mkpDeleteIban, mkpCopyIban, mkpSelectKisi, mkpSelectIbanToForm,
  mkpToggleAddForm, mkpEditKisi, mkpSaveKisi, mkpDeleteKisi,
  renderKisiIbanList, saveKisi, deleteKisi, renderKisilerGrid, toggleKtMode,
});
