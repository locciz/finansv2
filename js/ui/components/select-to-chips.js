import { inject } from '@core/container.js';
// DUAL-MODE CONTAINER KAYDI: dört bağımlılık da (core.appCoreBase,
// core.format, core.state, core.wrapRegistry) zaten container'a taşınmış
// katmanlara ait, bu yüzden inject() ile tembel çözülüyor. @pages/*
// importları ise o katman henüz taşınmadığı için BİLİNÇLİ OLARAK korunuyor.
const _appCoreBase = inject('core.appCoreBase');
const _format = inject('core.format');
const _coreState = inject('core.state');
const _wrapRegistry = inject('core.wrapRegistry');
// ============================================================
// js/ui/components/select-to-chips.js
// Genel amaçlı "seç -> chip" widget'ı (para birimi/kart/banka/hesap/altyapı seçiciler). NOT: bu bileşen ekstreler.js içine gömülüydü ama ekstrelere özgü değil — kartlar, hesaplar ve diğer formlarda da kullanılıyor. Doğru yerine (components/) taşındı.
// Kod SATIR SATIR aynı kaldı; sadece dosya sınırı/gruplama değişti.
// ============================================================
export function selectToChips(sel, opts) {
  if (!sel || sel._chipsApplied) return;
  sel._chipsApplied = true;
  opts = opts || {};
  let _justSelected = false; // popup'tan yeni seçim yapıldı mı — bir sonraki render'da kısa onay flaşı göster

  // Wrapper — bir kere oluşturulur, içeriği _renderScChips ile (yeniden) doldurulur
  const wrap = document.createElement('div');
  wrap.dataset.scFor = sel.id || '';

  function getCurrentVal() {
    return sel.value;
  }

  function setVal(val) {
    sel.value = val;
    wrap.querySelectorAll('.sc-chip').forEach(c => {
      c.classList.toggle('sc-active', c.dataset.val === val);
    });
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function render() {
    const options = [...sel.options].filter(o => !o.disabled || o.value !== '');
    const realOptions = options.filter(o => !o.disabled);

    // Boş liste: popup modunda bile buton görünümünü koru (devre dışı/tıklanamaz ama
    // düz yazı değil) — aksi hâlde native select'ten farksız, "cansız" bir kutu gibi görünüyor.
    if (!realOptions.length) {
      if (opts.popup) {
        wrap.className = 'sc-wrap sc-popup-wrap';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sc-popup-trigger-btn sc-is-empty sc-popup-disabled';
        btn.disabled = true;
        btn.innerHTML = `<span class="sc-popup-placeholder">${opts.emptyMsg || opts.placeholder || 'Seçilebilecek öğe yok'}</span>`
          + '<svg class="sc-popup-trigger-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
        wrap.innerHTML = '';
        wrap.appendChild(btn);
      } else {
        wrap.className = 'sc-wrap sc-empty-state';
        wrap.innerHTML = opts.emptyMsg
          ? `<span class="sc-empty-hint">${opts.emptyMsg}</span>`
          : '';
      }
      return;
    }

    const getLabel = (o) => (opts.labelFn ? opts.labelFn(o) : o.text.trim());
    const count = realOptions.length;
    const maxLabelLen = Math.max(...realOptions.map(o => getLabel(o).length));

    // popup modu: seçili değeri gösteren bir buton — tıklanınca aranabilir tam popup açılır
    if (opts.popup) {
      wrap.className = 'sc-wrap sc-popup-wrap';
      const curVal = getCurrentVal();
      const curOpt = realOptions.find(o => o.value === curVal);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sc-popup-trigger-btn';
      btn.innerHTML = (curOpt
        ? (opts.htmlFn ? opts.htmlFn(curOpt) : `<span>${getLabel(curOpt)}</span>`)
        : `<span class="sc-popup-placeholder">${opts.placeholder || 'Seçin…'}</span>`)
        + '<svg class="sc-popup-trigger-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
      btn.classList.add(curOpt ? 'sc-has-value' : 'sc-is-empty');
      if (_justSelected) { btn.classList.add('sc-just-selected'); _justSelected = false; }
      const hasOptGroups = sel.querySelectorAll('optgroup').length > 0;
      const groupOf = hasOptGroups
        ? (o) => {
            const p = o.parentElement;
            return (p && p.tagName === 'OPTGROUP') ? p.label.replace(/^—\s*|\s*—$/g, '').trim() : null;
          }
        : null;
      btn.addEventListener('click', () => {
        _openScSearchPopup({
          title: opts.popupTitle || 'Seçin',
          placeholder: opts.searchPlaceholder || 'Ara…',
          options: realOptions,
          getLabel,
          htmlFn: opts.htmlFn,
          groupOf,
          sortValueFn: opts.sortValueFn || null,
          currentVal: getCurrentVal(),
          triggerBtn: btn,
          onSelect: (val) => { _justSelected = true; setVal(val); render(); }
        });
      });
      wrap.innerHTML = '';
      wrap.appendChild(btn);
      return;
    }

    // picker modu: kaydırılabilir kutu + optgroup başlıkları
    const isPicker = !!opts.picker;
    // optgroup'lar varsa otomatik picker'a al
    const hasGroups = sel.querySelectorAll('optgroup').length > 0;
    const forcePickerForGroups = hasGroups && (opts.variant === 'row' || !opts.variant);
    const effectivePicker = isPicker || forcePickerForGroups;

    const variant = effectivePicker ? 'row' : (opts.variant || (
      (maxLabelLen > 22 && count <= 5) ? 'row' :
      (count <= 8 && maxLabelLen <= 20) ? 'pill' : 'row'
    ));

    wrap.className = 'sc-wrap'
      + (variant === 'row' ? ' sc-col' : '')
      + (effectivePicker ? ' sc-picker' : '');

    const tealVals   = new Set(opts.teal   || []);
    const dangerVals = new Set(opts.danger || []);

    wrap.innerHTML = '';

    // Picker modunda chip'leri scroll konteynere al
    // optgroup varsa grup başlıklarıyla birlikte render et
    if (effectivePicker) {
      const grid = document.createElement('div');
      grid.className = 'sc-picker-grid sc-picker-grouped';
      wrap.appendChild(grid);

      if (hasGroups) {
        sel.querySelectorAll('optgroup').forEach(grp => {
          const grpOpts = [...grp.querySelectorAll('option')].filter(o => !o.disabled);
          if (!grpOpts.length) return;
          const hdr = document.createElement('div');
          hdr.className = 'sc-picker-group-hdr';
          hdr.textContent = grp.label.replace(/^—\s*|\s*—$/g, '').trim();
          grid.appendChild(hdr);
          grpOpts.forEach(o => _appendChip(o, grid, 'row'));
        });
      } else {
        realOptions.forEach(o => _appendChip(o, grid, 'pill'));
      }
      return;
    }

    // Normal (non-picker) render
    const chipContainer = wrap;

    function _appendChip(o, container, forceVariant) {
      const val = o.value;
      const label = getLabel(o);
      const v = forceVariant || variant;
      const chip = document.createElement('span');
      chip.className = 'sc-chip' + (v === 'row' ? ' sc-row' : '');
      if (opts.mono || /^[\/\.\-\s,]$/.test(label)) chip.classList.add('sc-mono');
      if (opts.sm) chip.classList.add('sc-sm');
      if (opts.curChip)    { chip.classList.add('sc-cur'); chip.dataset.curCode = val; }
      if (opts.kartChip)   chip.classList.add('sc-kart');
      if (opts.altyapiChip) chip.classList.add('sc-altyapi');
      if (tealVals.has(val))  chip.classList.add('sc-teal');
      if (dangerVals.has(val)) chip.classList.add('sc-danger');
      if (getCurrentVal() === val) chip.classList.add('sc-active');
      chip.dataset.val = val;
      if (opts.htmlFn) {
        chip.innerHTML = opts.htmlFn(o);
        if (opts.altyapiChip) {
          const logoSpan = chip.querySelector('.altyapi-logo[data-kod]');
          if (logoSpan) chip.dataset.altyapiKod = logoSpan.dataset.kod;
        }
      } else if (opts.colorSwatch && /^#[0-9a-f]{6}$/i.test(val)) {
        const sw = document.createElement('span');
        sw.className = 'sc-swatch';
        sw.style.background = val;
        chip.appendChild(sw);
        chip.appendChild(document.createTextNode(label));
      } else {
        chip.appendChild(document.createTextNode(label));
      }
      chip.addEventListener('click', () => setVal(val));
      container.appendChild(chip);
    }

    realOptions.forEach(o => _appendChip(o, chipContainer, null));
  }

  render();
  if (!wrap.children.length && !opts.allowEmpty) {
    // Hiç seçenek yoksa (geçici boş state) chip alanı boş kalır, sorun değil —
    // select'in innerHTML'i sonradan değişince observer render()'ı tekrar çağırır.
  }

  // Orijinal select'i gizle (değeri saklasın ama görünmesin)
  sel.classList.add('sc-hidden-select');
  sel.insertAdjacentElement('afterend', wrap);

  // Select bir .select-wrap içindeyse, artık anlamsız kalan sol ikonu (sel-icon) kaldır —
  // chip'ler kendi emoji ikonlarını taşıyor, ayrı select ikonuna gerek yok.
  const selWrapParent = sel.closest('.select-wrap');
  if (selWrapParent) {
    const leftoverIcon = selWrapParent.querySelector('.sel-icon');
    if (leftoverIcon) leftoverIcon.remove();
    selWrapParent.classList.add('select-wrap-chipified');
  }

  // Select değişirse chip'leri de güncelle (programatik set için)
  sel.addEventListener('change', () => {
    if (opts.popup) { render(); return; }
    wrap.querySelectorAll('.sc-chip').forEach(c => {
      c.classList.toggle('sc-active', c.dataset.val === sel.value);
    });
  });

  // Select'in option listesi sonradan JS ile değiştirilirse (örn. kart değişince
  // para birimi listesi yeniden dolduruluyor) chip'leri de otomatik yeniden çiz.
  // (kat-tur gibi statik select'lerde de zararsız — innerHTML hiç değişmez.)
  // Debounce: phSet/phInit arka arkaya birden fazla mutation tetikler (innerHTML sil + ekle +
  // disabled placeholder ekle). Hepsini bekleyip sadece bir kez render et — aksi hâlde
  // "aradaki boş state"de render() çalışıp wrap'i siler, gerçek seçenekler gelince de
  // tekrar render çalışmayabilir.
  let _renderTimer = null;
  new MutationObserver(() => {
    clearTimeout(_renderTimer);
    _renderTimer = setTimeout(render, 0);
  }).observe(sel, { childList: true, characterData: true, subtree: true });

  // ── BUG FİX: programatik "sel.value = ..." ataması senkron/garanti güncelleme ──
  // Önceden chip/trigger görünümü sadece 'change' event'i (manuel dispatch) veya
  // option listesi mutasyonuna (MutationObserver, debounce'lu) bağlıydı. Bu, çağrı
  // sırasına duyarlıydı — bazı akışlarda chip/buton eski değeri göstermeye devam
  // edebiliyordu ("seçtikten/düzenledikten sonra seçim inputa/butona yansımıyor").
  // Çözüm: sel.value setter'ını intercept edip HER atamadan sonra senkron olarak
  // render()'ı (ya da aktif chip sınıflarını) tetikliyoruz — artık çağrı sırası
  // önemli değil, select'in value'su nasıl değişirse değişsin chip/buton görünümü
  // HER ZAMAN anında senkron kalır.
  try {
    const nativeDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    if (nativeDesc && nativeDesc.set) {
      Object.defineProperty(sel, 'value', {
        get() { return nativeDesc.get.call(sel); },
        set(v) {
          nativeDesc.set.call(sel, v);
          if (opts.popup) { render(); }
          else {
            wrap.querySelectorAll('.sc-chip').forEach(c => {
              c.classList.toggle('sc-active', c.dataset.val === sel.value);
            });
          }
        },
        configurable: true
      });
    }
  } catch (e) { /* eski tarayıcı desteği yoksa sessizce yut, mevcut mekanizmalar devrede kalır */ }

  // Dışarıdan zorla senkronize etmek isteyen kod için (ör. toplu/özel akışlar)
  sel._scRender = render;
}

// ── Genel arama popup'ı (banka vb. seçimler için) ─────────────────────
// Tek bir overlay DOM'da lazy oluşturulur ve her çağrıda içeriği güncellenir.
export let _scPopupState = null;
export let _scPopupOwnsBodyLock = false;
export let _scPopupFocusIdx = -1;      // klavye/hover odağındaki render listesi indexi
export let _scPopupRenderList = [];    // en son render edilen [{type:'item',opt}|{type:'hdr',label}, ...]

// Sıralama modu — _coreState.DB.uiFiltreler.scPopupSiralama içinde saklanır (bkz. defaultData/
// applyMigrations), bu sayede Drive'a senkronlanır ve cihaz/oturum değişse de,
// sonraki açılışlarda kullanıcının seçtiği sıralama hatırlanır.
// 'none' → orijinal (select'teki) sıra, 'buyuk' → tutar/bakiye büyükten küçüğe,
// 'kucuk' → küçükten büyüğe. Sadece bir "sortValueFn" (bakiye/limit gibi sayısal
// bir değer döndüren fonksiyon) sağlanan popup'larda (Hesap Seç, Kart Seç…) aktiftir;
// sayısal bir karşılığı olmayan popup'larda (Kategori, Kişi, Renk…) buton gizlenir.
export const _SC_SORT_CYCLE = ['none', 'buyuk', 'kucuk'];
export const _SC_SORT_ICONS = {
  none:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h11M3 12h7M3 17h4"/><path d="M17 5v14M17 5l-3.5 3.5M17 5l3.5 3.5"/></svg>',
  buyuk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6v5M9 6v8M14 6v11"/><path d="M20 5l0 14M20 19l3.5-3.5M20 19l-3.5-3.5"/></svg>',
  kucuk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11v6M9 8v9M14 6v11"/><path d="M20 19l0 -14M20 5l3.5 3.5M20 5l-3.5 3.5"/></svg>'
};
export const _SC_SORT_TITLES = {
  none:  'Sıralama: Varsayılan (tıkla: Büyükten Küçüğe)',
  buyuk: 'Sıralama: Büyükten Küçüğe (tıkla: Küçükten Büyüğe)',
  kucuk: 'Sıralama: Küçükten Büyüğe (tıkla: Varsayılan)'
};

export function _scGetSortMode() {
  const m = _coreState.DB && _coreState.DB.uiFiltreler && _coreState.DB.uiFiltreler.scPopupSiralama;
  return _SC_SORT_CYCLE.includes(m) ? m : 'none';
}

export function _scSetSortMode(mode) {
  if (!_coreState.DB.uiFiltreler) _coreState.DB.uiFiltreler = {};
  _coreState.DB.uiFiltreler.scPopupSiralama = mode;
  _appCoreBase.saveData();
}

export function _scUpdateSortBtn() {
  const btn = document.getElementById('sc-search-popup-sort');
  if (!btn) return;
  // Bu popup'ta sıralanacak sayısal bir alan (bakiye/limit) tanımlı değilse
  // (ör. Kategori, Kişi, Renk, Para Birimi seçimleri) buton tamamen gizlenir.
  if (!_scPopupState || typeof _scPopupState.sortValueFn !== 'function') {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = 'flex';
  const mode = _scGetSortMode();
  btn.innerHTML = _SC_SORT_ICONS[mode];
  btn.title = _SC_SORT_TITLES[mode];
  btn.classList.toggle('sc-sort-active', mode !== 'none');
}

// Grup yapısını (varsa) bozmadan, her grup içinde (ya da grup yoksa tüm listede)
// sortValueFn'in döndürdüğü sayısal değere (bakiye/limit) göre sıralar.
// 'none' modunda veya sortValueFn verilmemişse listeyi olduğu gibi bırakır.

export function _scSortList(list, groupOf, sortValueFn) {
  const mode = _scGetSortMode();
  if (mode === 'none' || typeof sortValueFn !== 'function' || !list.length) return list;
  const cmp = (a, b) => (sortValueFn(a) || 0) - (sortValueFn(b) || 0);
  // 'buyuk' = büyükten küçüğe (azalan), 'kucuk' = küçükten büyüğe (artan)
  const sortFn = mode === 'buyuk' ? (a, b) => cmp(b, a) : cmp;
  if (!groupOf) return [...list].sort(sortFn);
  const groupOrder = [];
  const buckets = new Map();
  list.forEach(o => {
    const g = groupOf(o);
    if (!buckets.has(g)) { buckets.set(g, []); groupOrder.push(g); }
    buckets.get(g).push(o);
  });
  groupOrder.forEach(g => buckets.get(g).sort(sortFn));
  return groupOrder.flatMap(g => buckets.get(g));
}

export function _ensureScPopupEl() {
  let ov = document.getElementById('sc-search-popup-overlay');
  if (ov) return ov;
  ov = document.createElement('div');
  ov.id = 'sc-search-popup-overlay';
  ov.className = 'sc-popup-overlay';
  ov.innerHTML = `
    <div class="sc-popup-panel" role="dialog" aria-modal="true">
      <div class="sc-popup-drag-handle"></div>
      <div class="sc-popup-head">
        <span class="sc-popup-title" id="sc-search-popup-title"></span>
        <div class="sc-popup-search-wrap" id="sc-search-popup-search-wrap">
          <input type="text" class="sc-popup-search" id="sc-search-popup-input" placeholder="Ara…"
                 role="combobox" aria-expanded="true" aria-controls="sc-search-popup-list" autocomplete="off">
          <button type="button" class="sc-popup-clear-btn" id="sc-search-popup-clear" aria-label="Aramayı temizle">✕</button>
        </div>
        <button type="button" class="sc-popup-sort-btn" id="sc-search-popup-sort" aria-label="Sırala"></button>
        <button type="button" class="sc-popup-close" id="sc-search-popup-close-btn" aria-label="Kapat">✕</button>
      </div>
      <div class="sc-popup-count" id="sc-search-popup-count"></div>
      <div class="sc-popup-list" id="sc-search-popup-list" role="listbox"></div>
    </div>`;
  // [ES module] onclick="event.stopPropagation()" ve onclick="_closeScSearchPopup()" kaldırıldı.
  ov.querySelector('.sc-popup-panel').addEventListener('click', (event) => event.stopPropagation());
  ov.querySelector('#sc-search-popup-close-btn').addEventListener('click', () => _closeScSearchPopup());
  ov.addEventListener('click', _closeScSearchPopup);
  document.body.appendChild(ov);

  const input = document.getElementById('sc-search-popup-input');
  const clearBtn = document.getElementById('sc-search-popup-clear');
  const searchWrap = document.getElementById('sc-search-popup-search-wrap');
  const sortBtn = document.getElementById('sc-search-popup-sort');

  input.addEventListener('input', (e) => {
    searchWrap.classList.toggle('has-value', !!e.target.value);
    _renderScSearchPopupList(e.target.value);
  });
  clearBtn.addEventListener('click', () => {
    input.value = '';
    searchWrap.classList.remove('has-value');
    _renderScSearchPopupList('');
    input.focus();
  });
  sortBtn.addEventListener('click', () => {
    const idx = _SC_SORT_CYCLE.indexOf(_scGetSortMode());
    _scSetSortMode(_SC_SORT_CYCLE[(idx + 1) % _SC_SORT_CYCLE.length]);
    _scUpdateSortBtn();
    _renderScSearchPopupList(input.value);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); _scPopupMoveFocus(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); _scPopupMoveFocus(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); _scPopupSelectFocused(); }
    else if (e.key === 'Escape') { _closeScSearchPopup(); }
  });
  return ov;
}

// Arama sorgusunu tek bir öğenin (htmlFn çıktısı dahil) metin kısımlarında vurgular.
// Sadece etiket metnini (> ... <) hedefler, HTML etiketlerine dokunmaz.

export function _scHighlight(html, q) {
  if (!q) return html;
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(' + esc + ')', 'gi');
  return html.replace(/>([^<]+)</g, (m, text) => '>' + text.replace(re, '<mark class="sc-popup-mark">$1</mark>') + '<');
}

export function _renderScSearchPopupList(query) {
  if (!_scPopupState) return;
  const { options, getLabel, htmlFn, currentVal, groupOf, sortValueFn } = _scPopupState;
  const q = (query || '').toLocaleLowerCase('tr').trim();
  const filteredRaw = q
    ? options.filter(o => getLabel(o).toLocaleLowerCase('tr').includes(q))
    : options;
  const filtered = _scSortList(filteredRaw, groupOf, sortValueFn);
  const listEl = document.getElementById('sc-search-popup-list');
  const countEl = document.getElementById('sc-search-popup-count');

  countEl.textContent = '';
  countEl.dataset.txt = q ? `${filtered.length} sonuç` : '';
  countEl.classList.toggle('show', !!q);

  if (!filtered.length) {
    listEl.innerHTML = `<div class="sc-popup-empty">
      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:30px;height:30px;flex-shrink:0"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M8 11h6" stroke-width="1.4"/></svg>
      <span>Sonuç bulunamadı</span>
    </div>`;
    countEl.classList.toggle('show', !!q);
    _scPopupRenderList = [];
    _scPopupFocusIdx = -1;
    return;
  }

  // Render listesini oluştur — groupOf verilmişse grup başlıklarıyla, yoksa düz.
  const renderList = [];
  if (groupOf) {
    let lastGroup = undefined;
    filtered.forEach(o => {
      const g = groupOf(o);
      if (g !== lastGroup) {
        renderList.push({ type: 'hdr', label: g || '' });
        lastGroup = g;
      }
      renderList.push({ type: 'item', opt: o });
    });
  } else {
    filtered.forEach(o => renderList.push({ type: 'item', opt: o }));
  }
  _scPopupRenderList = renderList;

  let itemIdx = 0;
  const checkSvg = '<svg class="sc-popup-item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  listEl.innerHTML = renderList.map((row) => {
    if (row.type === 'hdr') {
      return row.label ? `<div class="sc-popup-group-hdr">${row.label}</div>` : '';
    }
    const o = row.opt;
    const val = o.value;
    const idx = itemIdx++;
    let html = htmlFn ? htmlFn(o) : `<span>${getLabel(o)}</span>`;
    html = _scHighlight(html, q);
    const active = val === currentVal ? ' sc-popup-active' : '';
    return `<div class="sc-popup-item${active}" id="sc-popup-item-${idx}" role="option" data-idx="${idx}" ` +
           `data-val="${String(val).replace(/"/g,'&quot;')}" style="animation-delay:${Math.min(idx,14) * 10}ms">${html}${checkSvg}</div>`;
  }).join('');

  listEl.querySelectorAll('.sc-popup-item').forEach(item => {
    item.addEventListener('click', () => {
      const val = item.dataset.val;
      const onSelect = _scPopupState && _scPopupState.onSelect;
      _closeScSearchPopup();
      if (onSelect) onSelect(val);
    });
    item.addEventListener('mouseenter', () => {
      _scPopupSetFocus(parseInt(item.dataset.idx, 10), false);
    });
  });

  // Odağı: mevcut seçili öğeye (varsa), yoksa ilk öğeye ayarla — sadece popup yeni açıldıysa scroll et.
  const selectedIdx = renderList.findIndex(r => r.type === 'item' && r.opt.value === currentVal);
  _scPopupSetFocus(selectedIdx >= 0 ? selectedIdx : (renderList.findIndex(r => r.type === 'item')), true);
}

export function _scPopupSetFocus(idx, scrollIntoView) {
  const listEl = document.getElementById('sc-search-popup-list');
  if (!listEl) return;
  listEl.querySelectorAll('.sc-popup-item.sc-popup-kbd-focus').forEach(el => el.classList.remove('sc-popup-kbd-focus'));
  _scPopupFocusIdx = idx;
  if (idx == null || idx < 0) return;
  const el = listEl.querySelector(`.sc-popup-item[data-idx="${idx}"]`);
  if (!el) return;
  el.classList.add('sc-popup-kbd-focus');
  const input = document.getElementById('sc-search-popup-input');
  if (input) input.setAttribute('aria-activedescendant', el.id);
  if (scrollIntoView) el.scrollIntoView({ block: 'nearest' });
}

export function _scPopupMoveFocus(dir) {
  const items = _scPopupRenderList
    .map((r, i) => ({ r, i }))
    .filter(x => x.r.type === 'item');
  if (!items.length) return;
  let pos = items.findIndex(x => x.i === _scPopupFocusIdx);
  pos = pos < 0 ? 0 : Math.max(0, Math.min(items.length - 1, pos + dir));
  const next = items[pos];
  _scPopupSetFocus(next.i, true);
}

export function _scPopupSelectFocused() {
  if (_scPopupFocusIdx == null || _scPopupFocusIdx < 0) return;
  const listEl = document.getElementById('sc-search-popup-list');
  const el = listEl && listEl.querySelector(`.sc-popup-item[data-idx="${_scPopupFocusIdx}"]`);
  if (!el) return;
  const val = el.dataset.val;
  const onSelect = _scPopupState && _scPopupState.onSelect;
  _closeScSearchPopup();
  if (onSelect) onSelect(val);
}

export function _scLockBodyScroll() {
  if (!document.body.classList.contains('modal-open')) {
    document.body.classList.add('modal-open');
    _scPopupOwnsBodyLock = true;
  } else {
    _scPopupOwnsBodyLock = false;
  }
}

export function _scUnlockBodyScroll() {
  if (_scPopupOwnsBodyLock) {
    document.body.classList.remove('modal-open');
    _scPopupOwnsBodyLock = false;
  }
}

export function _openScSearchPopup(config) {
  const ov = _ensureScPopupEl();
  _scPopupState = config;
  _scPopupState._triggerEl = config.triggerBtn || document.activeElement;
  document.getElementById('sc-search-popup-title').textContent = config.title || '';
  const input = document.getElementById('sc-search-popup-input');
  const searchWrap = document.getElementById('sc-search-popup-search-wrap');
  input.value = '';
  searchWrap.classList.remove('has-value');
  input.placeholder = config.placeholder || 'Ara…';
  _scUpdateSortBtn();
  _renderScSearchPopupList('');
  ov.classList.add('open');
  _scLockBodyScroll();
  setTimeout(() => input.focus(), 30);
}

export function _closeScSearchPopup() {
  const ov = document.getElementById('sc-search-popup-overlay');
  if (ov) ov.classList.remove('open');
  _scUnlockBodyScroll();
  const trigger = _scPopupState && _scPopupState._triggerEl;
  _scPopupState = null;
  _scPopupRenderList = [];
  _scPopupFocusIdx = -1;
  if (trigger && document.body.contains(trigger) && trigger.focus) {
    setTimeout(() => trigger.focus(), 0);
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') _closeScSearchPopup();
});
// ── /Genel arama popup'ı ───────────────────────────────────────────────

// Para birimi select'leri için güzel chip HTML'i üretir.
// Bayrak emoji + monospace sembol (soluk) + kalın kod → "🇺🇸 $ USD" formatı.

export function _currencyChipHtml(o) {
  const code = o.value;
  const cfg = (typeof _coreState.CURRENCY_CONFIG !== 'undefined' && _coreState.CURRENCY_CONFIG[code]) || {};
  const sym  = cfg.symbol || '';
  const flag = cfg.flag   || '';
  const showSym = sym && sym !== code;
  return (flag ? `<span class="cur-flag">${flag}</span>` : '')
       + (showSym ? `<span class="cur-sym">${sym}</span>` : '')
       + `<span class="cur-code">${code}</span>`;
}
// labelFn varyantı (maxLabelLen hesabı için kullanılıyor — 4 char sabit, variant her zaman pill)

export function _currencyChipLabel(o) { return o.value; }

// Kart rengi popup'ı için — renk noktası + ad

export function _renkChipHtml(o) {
  const val = o.value;
  const dot = /^#[0-9a-f]{6}$/i.test(val)
    ? `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${val};margin-right:7px;flex-shrink:0;border:1px solid rgba(255,255,255,.15)"></span>`
    : `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--surface3);margin-right:7px;flex-shrink:0;border:1px dashed var(--border2)"></span>`;
  return `${dot}<span>${o.text.trim()}</span>`;
}

export function _renkChipLabel(o) { return o.text.trim(); }

// ── Kart/Hesap seçim chip HTML'i: mini kart görseli (renk gradyanı + çip + altyapı logosu)
// + kart adı + banka/son4 hane alt satırı (hesap popup'larıyla aynı iki satırlı düzen).

export function _kartVisualHtml(kart) {
  const renk = (typeof getKartRenk === 'function') ? getKartRenk(kart) : ((kart && kart.renk) || '#4f8ef7');
  const altyapi = (kart && kart.altyapiId && typeof _coreState.DB !== 'undefined')
    ? (_coreState.DB.kartAltyapilari || []).find(a => a.id === kart.altyapiId) : null;
  const logoHtml = (altyapi && altyapi.logo) ? `<span class="kc-visual-logo">${altyapi.logo}</span>` : '';
  const isHex = /^#[0-9a-f]{6}$/i.test(renk);
  const bg = isHex
    ? `linear-gradient(135deg, ${renk} 0%, ${renk}cc 60%, ${renk}88 100%)`
    : `linear-gradient(135deg, ${renk}, ${renk})`;
  return `<span class="kc-visual" style="background:${bg}"><span class="kc-visual-chip"></span>${logoHtml}</span>`;
}

export function _kartChipHtml(o) {
  const id = o.value;
  const kart = (typeof _coreState.DB !== 'undefined' && _coreState.DB.kartlar || []).find(k => k.id === id);
  if (!kart) return `<span class="hc-main"><span class="hc-name">${o.text.trim()}</span></span>`;
  const banka = (typeof _coreState.DB !== 'undefined' && _coreState.DB.bankalar || []).find(b => b.id === kart.banka);
  const bankaAd = banka ? banka.kisa : '';
  const son4 = kart.no ? '•••• ' + kart.no : '';
  const subParts = [bankaAd, son4].filter(Boolean);
  let limitGosterim = '';
  let limitTitle = '';
  if (typeof getKartToplamLimit === 'function') {
    const limit = getKartToplamLimit(kart.id) || 0;
    if (limit > 0) {
      const kull = kart.ortakLimitGrupId && typeof getOrtakGrupKullanim === 'function'
        ? getOrtakGrupKullanim(kart.ortakLimitGrupId)
        : (typeof getKartKullanim === 'function' ? getKartKullanim(kart.id) : 0);
      const kullanilabilir = Math.max(0, limit - kull);
      const pb = kart.paraBirimi || (typeof _coreState.defaultCurrency !== 'undefined' ? _coreState.defaultCurrency : 'TRY');
      const limitStr = typeof fmtCur === 'function' ? _format.fmtCur(limit, pb) : `${limit} ${pb}`;
      const kullanilabilirStr = typeof fmtCur === 'function' ? _format.fmtCur(kullanilabilir, pb) : `${kullanilabilir} ${pb}`;
      const cls = kullanilabilir <= limit * 0.1 ? 'hc-neg' : 'hc-pos';
      limitGosterim = `<span class="${cls}">Kullanılabilir: ${kullanilabilirStr}</span><span class="hc-avail"> · Limit: ${limitStr}</span>`;
      limitTitle = `Kullanılabilir: ${kullanilabilirStr} · Toplam Limit: ${limitStr}`;
    }
  }
  const subHtml = [subParts.join(' · '), limitGosterim].filter(Boolean).join(' · ');
  const subTitle = [subParts.join(' · '), limitTitle].filter(Boolean).join(' · ');
  return _kartVisualHtml(kart)
       + `<span class="hc-main"><span class="hc-name">${kart.ad}</span>`
       + (subHtml ? `<span class="hc-sub" title="${subTitle.replace(/"/g,'&quot;')}">${subHtml}</span>` : '')
       + `</span>`;
}

export function _kartChipLabel(o) {
  const kart = (typeof _coreState.DB !== 'undefined' && _coreState.DB.kartlar || []).find(k => k.id === o.value);
  if (!kart) return o.text.trim();
  const banka = (typeof _coreState.DB !== 'undefined' && _coreState.DB.bankalar || []).find(b => b.id === kart.banka);
  // Arama kutusunda ad, banka ve son 4 haneden de eşleşsin diye label'a hepsini katıyoruz
  // (görünürde sadece kart adı gösterilir, bu sadece arama/filtreleme için).
  return [kart.ad, banka ? banka.kisa : '', kart.no || ''].filter(Boolean).join(' ');
}
// Kart popup'larında "Kullanılabilir Limite Göre Sırala" özelliği için — chip'te
// gösterilen "Kullanılabilir: ..." değerinin ta kendisini (formatlanmamış sayı) döndürür.

export function _kartChipValue(o) {
  const kart = (typeof _coreState.DB !== 'undefined' && _coreState.DB.kartlar || []).find(k => k.id === o.value);
  if (!kart || typeof getKartToplamLimit !== 'function') return 0;
  const limit = getKartToplamLimit(kart.id) || 0;
  const kull = kart.ortakLimitGrupId && typeof getOrtakGrupKullanim === 'function'
    ? getOrtakGrupKullanim(kart.ortakLimitGrupId)
    : (typeof getKartKullanim === 'function' ? getKartKullanim(kart.id) : 0);
  return Math.max(0, limit - kull);
}

// ── İkon (emoji) seçim chip HTML'i: büyük emoji + etiket ─────────────

export function _ikonChipHtml(o) {
  if(o.value === '__custom__') return `<span style="font-size:19px;margin-right:2px">✏️</span><span>Özel emoji gir…</span>`;
  const label = o.textContent.replace(o.value, '').trim();
  return `<span style="font-size:19px;margin-right:2px">${o.value}</span><span>${label}</span>`;
}

export function _ikonChipLabel(o) {
  if(o.value === '__custom__') return 'Özel emoji gir…';
  return o.textContent.replace(o.value, '').trim();
}
// "Özel emoji gir…" seçilirse küçük bir prompt ile serbest emoji girişine izin ver,
// listeye o an için ekleyip seçili yap (kalıcı — bir sonraki açılışta da korunur).
document.addEventListener('change', (e) => {
  const sel = e.target;
  if(!sel || sel.id !== 'ab-ikon' || sel.value !== '__custom__') return;
  const girilen = (prompt('Bir emoji girin (örn. 🧾):', '') || '').trim();
  const customOpt = sel.querySelector('option[value="__custom__"]');
  if(girilen) {
    let opt = [...sel.options].find(o => o.value === girilen);
    if(!opt) {
      opt = document.createElement('option');
      opt.value = girilen;
      opt.textContent = girilen + ' Özel İkon';
      sel.insertBefore(opt, customOpt);
    }
    sel.value = girilen;
  } else {
    sel.value = '';
  }
});


// _coreState.DB.kartAltyapilari'ndan kod bilgisini çeker; kod CSS data attribute'una yazılır.

// ═══════════════════════════════════════════════════════════
// KART ALTYAPI LOGO SİSTEMİ
// Hazır SVG logolar — tanımlamada seçilip _coreState.DB'ye kaydedilir
// ═══════════════════════════════════════════════════════════
export const ALTYAPI_LOGOLAR = [
  {
    id: 'visa',
    ad: 'Visa',
    svg: `<svg viewBox="0 0 40 24" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="24" rx="3" fill="#1A1F71"/>
      <text x="20" y="17" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="bold" font-style="italic" fill="#FFFFFF" letter-spacing="-0.5">VISA</text>
    </svg>`
  },
  {
    id: 'mastercard',
    ad: 'Mastercard',
    svg: `<svg viewBox="0 0 40 24" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="24" rx="3" fill="#FFFFFF"/>
      <circle cx="16" cy="12" r="7" fill="#EB001B"/>
      <circle cx="24" cy="12" r="7" fill="#F79E1B"/>
      <path d="M20 6.2a7 7 0 0 1 0 11.6A7 7 0 0 1 20 6.2z" fill="#FF5F00"/>
    </svg>`
  },
  {
    id: 'troy',
    ad: 'Troy',
    svg: `<svg viewBox="0 0 40 24" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="24" rx="3" fill="#E30613"/>
      <text x="20" y="16" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="900" fill="#FFFFFF" letter-spacing="1">TROY</text>
    </svg>`
  },
  {
    id: 'amex',
    ad: 'Amex',
    svg: `<svg viewBox="0 0 40 24" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="24" rx="3" fill="#007BC1"/>
      <text x="20" y="16" text-anchor="middle" font-family="Arial,sans-serif" font-size="7.5" font-weight="900" fill="#FFFFFF" letter-spacing="0.5">AMEX</text>
    </svg>`
  },
  {
    id: 'unionpay',
    ad: 'UnionPay',
    svg: `<svg viewBox="0 0 40 24" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="24" rx="3" fill="#00447C"/>
      <rect x="0" y="19" width="13.34" height="5" fill="#E21836"/>
      <rect x="13.33" y="19" width="13.34" height="5" fill="#00447C"/>
      <rect x="26.66" y="19" width="13.34" height="5" fill="#00A651"/>
      <text x="20" y="13.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="6" font-weight="800" fill="#FFFFFF">UnionPay</text>
    </svg>`
  },
  {
    id: 'maestro',
    ad: 'Maestro',
    svg: `<svg viewBox="0 0 40 24" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="24" rx="3" fill="#FFFFFF"/>
      <circle cx="16" cy="11" r="7" fill="#CC0000"/>
      <circle cx="24" cy="11" r="7" fill="#0099DF"/>
      <path d="M20 4.8a7 7 0 0 1 0 12.4A7 7 0 0 1 20 4.8z" fill="#6C2C91"/>
      <text x="20" y="21.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="5.5" font-weight="600" font-style="italic" fill="#003A70">maestro</text>
    </svg>`
  },
  {
    id: 'jcb',
    ad: 'JCB',
    svg: `<svg viewBox="0 0 40 24" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="24" rx="3" fill="#FFFFFF" stroke="#ddd" stroke-width="0.5"/>
      <rect x="4" y="4" width="10" height="16" rx="5" fill="#003087"/>
      <rect x="15" y="4" width="10" height="16" rx="5" fill="#CC0000"/>
      <rect x="26" y="4" width="10" height="16" rx="5" fill="#007B40"/>
      <text x="9" y="16" text-anchor="middle" font-family="Arial,sans-serif" font-size="8" font-weight="900" fill="#FFFFFF">J</text>
      <text x="20" y="16" text-anchor="middle" font-family="Arial,sans-serif" font-size="8" font-weight="900" fill="#FFFFFF">C</text>
      <text x="31" y="16" text-anchor="middle" font-family="Arial,sans-serif" font-size="8" font-weight="900" fill="#FFFFFF">B</text>
    </svg>`
  },
  {
    id: 'diners',
    ad: 'Diners',
    svg: `<svg viewBox="0 0 40 24" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="24" rx="3" fill="#FFFFFF" stroke="#ddd" stroke-width="0.5"/>
      <circle cx="17" cy="12" r="7.5" fill="none" stroke="#004B87" stroke-width="1.5"/>
      <circle cx="23" cy="12" r="7.5" fill="none" stroke="#004B87" stroke-width="1.5"/>
      <text x="20" y="22.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="4.5" font-weight="600" fill="#004B87">DINERS CLUB</text>
    </svg>`
  },
  {
    id: 'discover',
    ad: 'Discover',
    svg: `<svg viewBox="0 0 40 24" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="24" rx="3" fill="#FFFFFF" stroke="#ddd" stroke-width="0.5"/>
      <text x="18" y="14" text-anchor="middle" font-family="Georgia,serif" font-size="6.5" font-weight="700" font-style="italic" fill="#1A1A1A">Discover</text>
      <ellipse cx="32.5" cy="18.5" rx="6.5" ry="4.5" fill="#F76F20"/>
    </svg>`
  },
  {
    id: 'none',
    ad: 'Logo Yok',
    svg: null
  }
];

export function _renderAltyapiLogoPicker(selectedSvg) {
  const picker = document.getElementById('altyapi-logo-picker');
  if (!picker) return;
  picker.innerHTML = ALTYAPI_LOGOLAR.map((logo, i) => {
    const isSelected = logo.svg === selectedSvg || (logo.id === 'none' && !selectedSvg);
    return `<div class="altyapi-logo-picker-item${isSelected ? ' selected' : ''}" data-idx="${i}"
      title="${logo.ad}">
      ${logo.svg
        ? `<span style="display:flex;align-items:center;justify-content:center;width:40px;height:24px">${logo.svg}</span>`
        : `<span style="width:40px;height:24px;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:18px">✕</span>`
      }
      <span>${logo.ad}</span>
    </div>`;
  }).join('');
  // [ES module] onclick="_pickAltyapiLogo(...)" kaldırıldı.
  picker.querySelectorAll('.altyapi-logo-picker-item').forEach(item => {
    item.addEventListener('click', () => _pickAltyapiLogo(Number(item.getAttribute('data-idx'))));
  });
}

// Picker'daki bir öğeye tıklanınca çağrılır — index üzerinden çalışır,
// böylece logo markup'ı (svg + tırnaklar) HTML attribute'a gömülmez.

export function _pickAltyapiLogo(idx) {
  const logo = ALTYAPI_LOGOLAR[idx];
  _selectAltyapiLogo(logo ? logo.svg : '');
}

export function _selectAltyapiLogo(svg) {
  document.getElementById('kart-altyapi-logo').value = svg || '';
  document.querySelectorAll('#altyapi-logo-picker .altyapi-logo-picker-item').forEach((el, i) => {
    const logo = ALTYAPI_LOGOLAR[i];
    const match = logo.svg === svg || (logo.id === 'none' && !svg);
    el.classList.toggle('selected', match);
  });
}

// ── Kart altyapısı logosu — kart listesi/plaka gibi yerlerde kullanılan küçük rozet ──
// altyapi.logo tanımlıysa SVG rozetini döner, tanımlı değilse null (çağıran yer o zaman metne düşer).

export function kartAltyapiLogoHtml(altyapi) {
  if (!altyapi || !altyapi.logo) return null;
  return `<span class="kart-altyapi-logo-badge">${altyapi.logo}</span>`;
}

// ── Kart altyapısı chip HTML'i: logo badge + ad ──────────────────────

export function _altyapiChipHtml(o) {
  const id = o.value;
  const altyapi = (typeof _coreState.DB !== 'undefined' && _coreState.DB.kartAltyapilari || []).find(a => a.id === id);
  const ad  = altyapi ? altyapi.ad  : o.text.trim();
  const logoSvg = altyapi && altyapi.logo ? altyapi.logo : '';
  const logoHtml = logoSvg
    ? `<span class="altyapi-logo">${logoSvg}</span>`
    : `<span class="altyapi-logo" style="font-size:9px;font-weight:800;font-family:var(--mono);color:var(--text2)">${(altyapi&&altyapi.kod||'').slice(0,4)}</span>`;
  return logoHtml + `<span>${ad}</span>`;
}

export function _altyapiChipLabel(o) {
  const altyapi = (typeof _coreState.DB !== 'undefined' && _coreState.DB.kartAltyapilari || []).find(a => a.id === o.value);
  return altyapi ? altyapi.ad : o.text.trim();
}

// ── Banka chip HTML'i: logo rozeti (varsa) + banka kısa adı ─────────

export function _bankaChipHtml(o) {
  const id = o.value;
  const banka = (typeof _coreState.DB !== 'undefined' && _coreState.DB.bankalar || []).find(b => b.id === id);
  const ad = banka ? banka.kisa : o.text.trim();
  const ikon = banka ? bankaIkonObj(banka) : null;
  const ikonHtml = ikon && ikon.svg
    ? `<span class="bank-logo">${ikon.svg}</span>`
    : `<span class="bank-icon">${ikon ? ikon.emoji : '🏦'}</span>`;
  return `${ikonHtml}<span class="sc-chip-label">${ad}</span>`;
}

export function _bankaChipLabel(o) {
  const banka = (typeof _coreState.DB !== 'undefined' && _coreState.DB.bankalar || []).find(b => b.id === o.value);
  return banka ? banka.kisa : o.text.trim();
}

// ── Hesap seçim chip HTML'i: banka logosu + hesap adı + IBAN/bakiye (2 satır) ──
// Bazı select'lerde (transfer-kaynak/hedef) "nakit:USD" gibi nakit değerleri de
// karışık gelebilir — bu durumda para birimi chip görünümüne düşer.

export function _hesapChipHtml(o) {
  const val = o.value || '';
  if (val.indexOf('nakit:') === 0) {
    const code = val.slice(6);
    const cfg = (typeof _coreState.CURRENCY_CONFIG !== 'undefined' && _coreState.CURRENCY_CONFIG[code]) || {};
    const flag = cfg.flag || '💵';
    return `<span class="bank-icon">${flag}</span>`
         + `<span class="hc-main"><span class="hc-name">Nakit</span><span class="hc-sub">${code}</span></span>`;
  }
  // "Nakit (Nakit Bakiyesi)" seçeneği (od-pop-hesap) — value boş, o.pb ile hangi para
  // biriminde gösterileceği belirtilir. Diğer banka hesaplarıyla aynı görünüm (ikon +
  // isim + bakiye) için burada da bir chip üretiyoruz.
  if (!val && o && o.pb) {
    const pb = o.pb;
    const cfg = (typeof _coreState.CURRENCY_CONFIG !== 'undefined' && _coreState.CURRENCY_CONFIG[pb]) || {};
    const flag = cfg.flag || '💵';
    const bakiyeVal = (typeof _coreState.DB !== 'undefined' && _coreState.DB._nakitBakiye || {})[pb] || 0;
    const bakiyeStr = typeof fmtCur === 'function' ? _format.fmtCur(bakiyeVal, pb) : `${bakiyeVal} ${pb}`;
    const bakiyeCls = bakiyeVal < 0 ? 'hc-neg' : 'hc-pos';
    return `<span class="bank-icon">${flag}</span>`
         + `<span class="hc-main"><span class="hc-name">Nakit (Nakit Bakiyesi)</span>`
         + `<span class="hc-sub"><span class="${bakiyeCls}">Bakiye: ${bakiyeStr}</span></span></span>`;
  }
  const h = (typeof _coreState.DB !== 'undefined' && _coreState.DB.hesaplar || []).find(x => x.id === val);
  if (!h) return `<span class="hc-main"><span class="hc-name">${o.text.trim()}</span></span>`;
  const banka = (typeof _coreState.DB !== 'undefined' && _coreState.DB.bankalar || []).find(b => b.id === h.banka);
  const ikon = banka ? bankaIkonObj(banka) : null;
  const ikonHtml = ikon && ikon.svg
    ? `<span class="bank-logo">${ikon.svg}</span>`
    : `<span class="bank-icon">${ikon ? ikon.emoji : '🏦'}</span>`;
  const pb = h.paraBirimi || 'TRY';
  const bakiyeVal = h.bakiye || 0;
  const kmhLimit = h.kmhLimit || 0;
  const bakiyeStr = typeof fmtCur === 'function' ? _format.fmtCur(bakiyeVal, pb) : `${bakiyeVal} ${pb}`;
  const bakiyeCls = bakiyeVal < 0 ? 'hc-neg' : 'hc-pos';
  let bakiyeGosterim = `Bakiye: ${bakiyeStr}`;
  let subTitleGosterim = bakiyeGosterim;
  if (kmhLimit > 0) {
    const kullanilabilirVal = bakiyeVal + kmhLimit;
    const kullanilabilirStr = typeof fmtCur === 'function' ? _format.fmtCur(kullanilabilirVal, pb) : `${kullanilabilirVal} ${pb}`;
    // "Kullanılabilir" ayrı bir span'e sarılıyor: dar (cols-2) mobil satırlarda
    // bu kısım CSS ile gizlenip sadece Bakiye gösteriliyor (bkz. .hc-avail kuralı),
    // tam metin popup listesinde ve title tooltip'inde her zaman görünür kalıyor.
    bakiyeGosterim = `Bakiye: ${bakiyeStr}<span class="hc-avail"> · Kullanılabilir: ${kullanilabilirStr}</span>`;
    subTitleGosterim = `Bakiye: ${bakiyeStr} · Kullanılabilir: ${kullanilabilirStr}`;
  }
  const ibanTemiz = (h.iban || '').replace(/\s/g, '');
  const ibanSon = ibanTemiz.length >= 4 ? '····' + ibanTemiz.slice(-4) : '';
  const bankaAd = banka ? banka.kisa : '';
  const subParts = [bankaAd, ibanSon, bakiyeGosterim ? `<span class="${bakiyeCls}">${bakiyeGosterim}</span>` : ''].filter(Boolean);
  const subTitle = [bankaAd, ibanSon, subTitleGosterim].filter(Boolean).join(' · ');
  return ikonHtml
       + `<span class="hc-main"><span class="hc-name">${h.ad || 'Hesap'}</span>`
       + (subParts.length ? `<span class="hc-sub" title="${subTitle.replace(/"/g,'&quot;')}">${subParts.join(' · ')}</span>` : '')
       + `</span>`;
}

export function _hesapChipLabel(o) {
  const val = o.value || '';
  if (val.indexOf('nakit:') === 0) return 'Nakit ' + val.slice(6);
  if (!val && o && o.pb) return 'Nakit (Nakit Bakiyesi) ' + o.pb;
  const h = (typeof _coreState.DB !== 'undefined' && _coreState.DB.hesaplar || []).find(x => x.id === val);
  if (!h) return o.text.trim();
  const banka = (typeof _coreState.DB !== 'undefined' && _coreState.DB.bankalar || []).find(b => b.id === h.banka);
  return [banka ? banka.kisa : '', h.ad || '', h.iban || ''].filter(Boolean).join(' ');
}
// Hesap popup'larında "Bakiyeye Göre Sırala" özelliği için — chip'te gösterilen
// bakiye değerinin ta kendisini (formatlanmamış sayı) döndürür.

export function _hesapChipValue(o) {
  const val = o.value || '';
  if (val.indexOf('nakit:') === 0) {
    const code = val.slice(6);
    return (typeof _coreState.DB !== 'undefined' && _coreState.DB._nakitBakiye || {})[code] || 0;
  }
  if (!val && o && o.pb) {
    return (typeof _coreState.DB !== 'undefined' && _coreState.DB._nakitBakiye || {})[o.pb] || 0;
  }
  const h = (typeof _coreState.DB !== 'undefined' && _coreState.DB.hesaplar || []).find(x => x.id === val);
  return h ? (h.bakiye || 0) : 0;
}

// Belirli bir container içindeki uygun select'leri chip'e çevirir

export function applyChipsToContainer(root) {
  root = root || document;

  // ── Basit 2 seçenekli (gelir/gider, aktif/pasif gibi) — popup modu ──
  [
    { id: 'kira-tur',    opts: { popup: true, popupTitle: 'Tür Seç', searchPlaceholder: 'Ara…', placeholder: 'Tür seçin…' } },
    { id: 'elden-tur',   opts: { popup: true, popupTitle: 'Tür Seç', searchPlaceholder: 'Ara…', placeholder: 'Tür seçin…' } },
    { id: 'maas-tur',    opts: { popup: true, popupTitle: 'Tür Seç', searchPlaceholder: 'Ara…', placeholder: 'Tür seçin…' } },
    { id: 'kat-tur',     opts: { popup: true, popupTitle: 'Tür Seç', searchPlaceholder: 'Ara…', placeholder: 'Tür seçin…' } },
    { id: 'hesap-durum', opts: { popup: true, popupTitle: 'Durum Seç', searchPlaceholder: 'Ara…', placeholder: 'Durum seçin…' } },
    { id: 'kart-extre-tip', opts: { popup: true, popupTitle: 'Ekstre Tipi Seç', searchPlaceholder: 'Ara…', placeholder: 'Seçin…' } },
    // Ödeme yöntemi
    { id: 'kira-yontem',  opts: { popup: true, popupTitle: 'Yöntem Seç', searchPlaceholder: 'Ara…', placeholder: 'Yöntem seçin…' } },
    { id: 'maas-yontem',  opts: { popup: true, popupTitle: 'Yöntem Seç', searchPlaceholder: 'Ara…', placeholder: 'Yöntem seçin…' } },
    { id: 'elden-yontem', opts: { popup: true, popupTitle: 'Yöntem Seç', searchPlaceholder: 'Ara…', placeholder: 'Yöntem seçin…' } },
    // Depozito
    { id: 'nakit-avans-limit-tip', opts: { popup: true, popupTitle: 'Limit Tipi Seç', searchPlaceholder: 'Ara…', placeholder: 'Seçin…' } },
    // Ayraçlar
    { id: 'ga-tarih-ayrac',   opts: { popup: true, mono: true, popupTitle: 'Tarih Ayracı Seç', searchPlaceholder: 'Ara…', placeholder: 'Seçin…' } },
    { id: 'ga-ondalik-ayrac', opts: { popup: true, mono: true, popupTitle: 'Ondalık Ayracı Seç', searchPlaceholder: 'Ara…', placeholder: 'Seçin…' } },
    { id: 'ga-binlik-ayrac',  opts: { popup: true, mono: true, popupTitle: 'Binlik Ayracı Seç', searchPlaceholder: 'Ara…', placeholder: 'Seçin…' } },
    { id: 'ga-ondalik-basamak', opts: { popup: true, mono: true, popupTitle: 'Ondalık Basamak Seç', searchPlaceholder: 'Ara…', placeholder: 'Seçin…' } },
    { id: 'ga-saat-ayrac', opts: { popup: true, mono: true, popupTitle: 'Saat Ayracı Seç', searchPlaceholder: 'Ara…', placeholder: 'Seçin…' } },
    // Para birimi ayarları
    { id: 'pb-konum',   opts: { popup: true, popupTitle: 'Sembol Konumu Seç', searchPlaceholder: 'Ara…', placeholder: 'Seçin…' } },
    { id: 'pb-ondalik', opts: { popup: true, mono: true, popupTitle: 'Ondalık Basamak Seç', searchPlaceholder: 'Ara…', placeholder: 'Seçin…' } },
    { id: 'pb-kur-tip', opts: { popup: true, popupTitle: 'Kur Tipi Seç', searchPlaceholder: 'Ara…', placeholder: 'Seçin…' } },
    // İş günü kaydırma (Tatil Ayarı)
    { id: 'kart-odeme-gun-tip',    opts: { popup: true, popupTitle: 'Tatil Ayarı Seç', searchPlaceholder: 'Ara…', placeholder: 'Tatil ayarı seçin…' } },
    { id: 'kredi-odeme-gun-tip',   opts: { popup: true, popupTitle: 'Tatil Ayarı Seç', searchPlaceholder: 'Ara…', placeholder: 'Tatil ayarı seçin…' } },
    { id: 'kmhkredi-odeme-gun-tip',opts: { popup: true, popupTitle: 'Tatil Ayarı Seç', searchPlaceholder: 'Ara…', placeholder: 'Tatil ayarı seçin…' } },
    // Abonelik periyot
    { id: 'ab-periyot', opts: { popup: true, popupTitle: 'Periyot Seç', searchPlaceholder: 'Ara…', placeholder: 'Periyot seçin…' } },
    // Kira/maaş kısa ay davranışı
    { id: 'kira-gun-kisa-ay-davranis', opts: { popup: true, popupTitle: 'Kısa Ay Davranışı Seç', searchPlaceholder: 'Ara…', placeholder: 'Seçin…' } },
    { id: 'maas-gun-kisa-ay-davranis', opts: { popup: true, popupTitle: 'Kısa Ay Davranışı Seç', searchPlaceholder: 'Ara…', placeholder: 'Seçin…' } },
    // Kart renk (swatch — popup içinde de renk noktasıyla gösterilir)
    { id: 'kart-renk', opts: { popup: true, labelFn: _renkChipLabel, htmlFn: _renkChipHtml, popupTitle: 'Renk Seç', searchPlaceholder: 'Renk ara…', placeholder: 'Renk seçin…' } },
    { id: 'hesap-tur-renk',    opts: { popup: true, labelFn: _renkChipLabel, htmlFn: _renkChipHtml, popupTitle: 'Renk Seç', searchPlaceholder: 'Renk ara…', placeholder: 'Renk seçin…' } },
    { id: 'urun-tip-renk',     opts: { popup: true, labelFn: _renkChipLabel, htmlFn: _renkChipHtml, popupTitle: 'Renk Seç', searchPlaceholder: 'Renk ara…', placeholder: 'Renk seçin…' } },
    { id: 'kredi-tip-renk',    opts: { popup: true, labelFn: _renkChipLabel, htmlFn: _renkChipHtml, popupTitle: 'Renk Seç', searchPlaceholder: 'Renk ara…', placeholder: 'Renk seçin…' } },
    { id: 'kart-altyapi-renk', opts: { popup: true, labelFn: _renkChipLabel, htmlFn: _renkChipHtml, popupTitle: 'Renk Seç', searchPlaceholder: 'Renk ara…', placeholder: 'Renk seçin…' } },
    { id: 'pb-renk',           opts: { popup: true, labelFn: _renkChipLabel, htmlFn: _renkChipHtml, popupTitle: 'Renk Seç', searchPlaceholder: 'Renk ara…', placeholder: 'Renk seçin…' } },
    // Mevduat strateji
    { id: 'mev-strateji', opts: { popup: true, popupTitle: 'Strateji Seç', searchPlaceholder: 'Strateji ara…', placeholder: 'Strateji seçin…' } },
    // Asgari ödeme koşul operatörü / alanı
    { id: 'asgari-kosul-op', opts: { popup: true, mono: true, popupTitle: 'Operatör Seç', searchPlaceholder: 'Ara…', placeholder: 'Seçin…' } },
    { id: 'asgari-kosul-alan', opts: { popup: true, popupTitle: 'Alan Seç', searchPlaceholder: 'Ara…', placeholder: 'Alan seçin…' } },
    // Kart ekstre haftası / gün
    { id: 'kart-extre-hafta',    opts: { popup: true, popupTitle: 'Hafta Seç', searchPlaceholder: 'Ara…', placeholder: 'Seçin…' } },
    { id: 'kart-extre-haftagun', opts: { popup: true, popupTitle: 'Gün Seç', searchPlaceholder: 'Ara…', placeholder: 'Seçin…' } },
    // Hesap defteri (log) işlem türü filtresi
    { id: 'hesap-log-tur', opts: { popup: true, popupTitle: 'Tür Seç', searchPlaceholder: 'Ara…', placeholder: 'Tür seçin…' } },
    // Para birimi (tekli seçim) — bayrak + sembol + kod, özel sc-cur görünümü — popup modu
    { id: 'islem-para-birimi',        opts: { popup: true, labelFn: _currencyChipLabel, htmlFn: _currencyChipHtml, curChip: true, popupTitle: 'Para Birimi Seç', searchPlaceholder: 'Para birimi ara…', placeholder: 'Para birimi seçin…' } },
    { id: 'na-para-birimi',           opts: { popup: true, labelFn: _currencyChipLabel, htmlFn: _currencyChipHtml, curChip: true, popupTitle: 'Para Birimi Seç', searchPlaceholder: 'Para birimi ara…', placeholder: 'Para birimi seçin…' } },
    { id: 'mev-para-birimi',          opts: { popup: true, labelFn: _currencyChipLabel, htmlFn: _currencyChipHtml, curChip: true, popupTitle: 'Para Birimi Seç', searchPlaceholder: 'Para birimi ara…', placeholder: 'Para birimi seçin…' } },
    { id: 'kira-para-birimi-manual',  opts: { popup: true, labelFn: _currencyChipLabel, htmlFn: _currencyChipHtml, curChip: true, popupTitle: 'Para Birimi Seç', searchPlaceholder: 'Para birimi ara…', placeholder: 'Para birimi seçin…' } },
    { id: 'maas-para-birimi-manual',  opts: { popup: true, labelFn: _currencyChipLabel, htmlFn: _currencyChipHtml, curChip: true, popupTitle: 'Para Birimi Seç', searchPlaceholder: 'Para birimi ara…', placeholder: 'Para birimi seçin…' } },
    { id: 'hesap-para-birimi',        opts: { popup: true, labelFn: _currencyChipLabel, htmlFn: _currencyChipHtml, curChip: true, popupTitle: 'Para Birimi Seç', searchPlaceholder: 'Para birimi ara…', placeholder: 'Para birimi seçin…' } },
    { id: 'elden-para-birimi',        opts: { popup: true, labelFn: _currencyChipLabel, htmlFn: _currencyChipHtml, curChip: true, popupTitle: 'Para Birimi Seç', searchPlaceholder: 'Para birimi ara…', placeholder: 'Para birimi seçin…' } },
    { id: 'ab-para-birimi',           opts: { popup: true, labelFn: _currencyChipLabel, htmlFn: _currencyChipHtml, curChip: true, popupTitle: 'Para Birimi Seç', searchPlaceholder: 'Para birimi ara…', placeholder: 'Para birimi seçin…' } },
    { id: 'kira-depozito-pb',         opts: { popup: true, labelFn: _currencyChipLabel, htmlFn: _currencyChipHtml, curChip: true, popupTitle: 'Para Birimi Seç', searchPlaceholder: 'Para birimi ara…', placeholder: 'Para birimi seçin…' } },
    { id: 'kart-varsayilan-pb',       opts: { popup: true, labelFn: _currencyChipLabel, htmlFn: _currencyChipHtml, curChip: true, popupTitle: 'Para Birimi Seç', searchPlaceholder: 'Para birimi ara…', placeholder: 'Para birimi seçin…' } },
    { id: 'asgari-prev-pb',           opts: { popup: true, labelFn: _currencyChipLabel, htmlFn: _currencyChipHtml, curChip: true, popupTitle: 'Para Birimi Seç', searchPlaceholder: 'Para birimi ara…', placeholder: 'Para birimi seçin…' } },
    { id: 'tg-pb-filtre',             opts: { popup: true, labelFn: _currencyChipLabel, htmlFn: _currencyChipHtml, curChip: true, popupTitle: 'Para Birimi Seç', searchPlaceholder: 'Para birimi ara…', placeholder: 'Para birimi seçin…' } },
    // Kart / Hesap seçimi — popup modu (banka/hesap seçimleriyle tutarlı: tıklanınca aranabilir tam popup açılır)
    { id: 'islem-kart', opts: { popup: true, labelFn: _kartChipLabel, htmlFn: _kartChipHtml, sortValueFn: _kartChipValue, kartChip: true, popupTitle: 'Kart / Hesap Seç', searchPlaceholder: 'Kart ara…', placeholder: 'Kart / Hesap seçin…', emptyMsg: "— Kart bulunamadı —" } },
    { id: 'na-kart',    opts: { popup: true, labelFn: _kartChipLabel, htmlFn: _kartChipHtml, sortValueFn: _kartChipValue, kartChip: true, popupTitle: 'Kart Seç', searchPlaceholder: 'Kart ara…', placeholder: 'Kart seçin…', emptyMsg: "— Kart bulunamadı —" } },
    { id: 'ee-kart-select', opts: { popup: true, labelFn: _kartChipLabel, htmlFn: _kartChipHtml, sortValueFn: _kartChipValue, kartChip: true, popupTitle: 'Kart Seç', searchPlaceholder: 'Kart ara…', placeholder: 'Kart seçin…', emptyMsg: "— Kart bulunamadı —" } },
    // Kart altyapısı — popup modu (logo + ad, aranabilir)
    { id: 'kart-altyapi', opts: { popup: true, labelFn: _altyapiChipLabel, htmlFn: _altyapiChipHtml, altyapiChip: true, popupTitle: 'Altyapı Seç', searchPlaceholder: 'Altyapı ara…', placeholder: 'Altyapı seçin…', emptyMsg: "Altyapı eklemek için Tanımlamalar bölümüne gidin" } },
    // Banka seçimi — popup modu (tıklanınca aranabilir tam popup açılır)
    { id: 'kart-banka',  opts: { popup: true, labelFn: _bankaChipLabel, htmlFn: _bankaChipHtml, popupTitle: 'Banka Seç', searchPlaceholder: 'Banka ara…', placeholder: 'Banka seçin…', emptyMsg: "Banka eklemek için Tanımlamalar bölümüne gidin" } },
    { id: 'kredi-banka', opts: { popup: true, labelFn: _bankaChipLabel, htmlFn: _bankaChipHtml, popupTitle: 'Banka Seç', searchPlaceholder: 'Banka ara…', placeholder: 'Banka seçin…', emptyMsg: "Banka eklemek için Tanımlamalar bölümüne gidin" } },
    { id: 'hesap-banka', opts: { popup: true, labelFn: _bankaChipLabel, htmlFn: _bankaChipHtml, popupTitle: 'Banka Seç', searchPlaceholder: 'Banka ara…', placeholder: 'Banka seçin…', emptyMsg: "Banka eklemek için Tanımlamalar bölümüne gidin" } },
    // Hesap seçimi — popup modu (banka logosu + ad + IBAN/bakiye, aranabilir)
    { id: 'kart-odeme-hesap',  opts: { popup: true, labelFn: _hesapChipLabel, htmlFn: _hesapChipHtml, sortValueFn: _hesapChipValue, popupTitle: 'Hesap Seç', searchPlaceholder: 'Hesap ara…', placeholder: 'Hesap seçin…', emptyMsg: "Ödeme yapılabilecek aktif hesap yok" } },
    { id: 'mev-hesap-id',        opts: { popup: true, labelFn: _hesapChipLabel, htmlFn: _hesapChipHtml, sortValueFn: _hesapChipValue, popupTitle: 'Hesap Seç', searchPlaceholder: 'Hesap ara…', placeholder: 'Hesap seçin…', emptyMsg: "Uygun hesap yok" } },
    { id: 'mev-vadesiz-hesap-id',opts: { popup: true, labelFn: _hesapChipLabel, htmlFn: _hesapChipHtml, sortValueFn: _hesapChipValue, popupTitle: 'Hesap Seç', searchPlaceholder: 'Hesap ara…', placeholder: 'Hesap seçin…', emptyMsg: "Uygun vadesiz hesap yok" } },
    { id: 'mev-kaynak-hesap-id', opts: { popup: true, labelFn: _hesapChipLabel, htmlFn: _hesapChipHtml, sortValueFn: _hesapChipValue, popupTitle: 'Hesap Seç', searchPlaceholder: 'Hesap ara…', placeholder: 'Hesap seçin…', emptyMsg: "Uygun kaynak hesap yok" } },
    { id: 'mev-tutar-fark-hesap-id', opts: { popup: true, labelFn: _hesapChipLabel, htmlFn: _hesapChipHtml, sortValueFn: _hesapChipValue, popupTitle: 'Hesap Seç', searchPlaceholder: 'Hesap ara…', placeholder: 'Hesap seçin…', emptyMsg: "Uygun hesap yok" } },
    { id: 'elden-hesap',  opts: { popup: true, labelFn: _hesapChipLabel, htmlFn: _hesapChipHtml, sortValueFn: _hesapChipValue, popupTitle: 'Hesap Seç', searchPlaceholder: 'Hesap ara…', placeholder: 'Hesap seçin…', emptyMsg: "Aktif hesap yok" } },
    { id: 'ab-hesap',     opts: { popup: true, labelFn: _hesapChipLabel, htmlFn: _hesapChipHtml, sortValueFn: _hesapChipValue, popupTitle: 'Hesap Seç', searchPlaceholder: 'Hesap ara…', placeholder: 'Hesap seçin…', emptyMsg: "Aktif hesap yok" } },
    { id: 'ab-ikon',      opts: { popup: true, labelFn: _ikonChipLabel, htmlFn: _ikonChipHtml, popupTitle: 'İkon Seç', searchPlaceholder: 'İkon ara…', placeholder: 'İkon seçin…' } },
    { id: 'kira-hesap',   opts: { popup: true, labelFn: _hesapChipLabel, htmlFn: _hesapChipHtml, sortValueFn: _hesapChipValue, popupTitle: 'Hesap Seç', searchPlaceholder: 'Hesap ara…', placeholder: 'Hesap seçin…', emptyMsg: "Aktif hesap yok" } },
    { id: 'maas-hesap',   opts: { popup: true, labelFn: _hesapChipLabel, htmlFn: _hesapChipHtml, sortValueFn: _hesapChipValue, popupTitle: 'Hesap Seç', searchPlaceholder: 'Hesap ara…', placeholder: 'Hesap seçin…', emptyMsg: "Aktif hesap yok" } },
    { id: 'transfer-kaynak', opts: { popup: true, labelFn: _hesapChipLabel, htmlFn: _hesapChipHtml, sortValueFn: _hesapChipValue, popupTitle: 'Kaynak Seç', searchPlaceholder: 'Hesap/nakit ara…', placeholder: 'Kaynak seçin…', emptyMsg: "Transfer yapılabilecek hesap/nakit yok" } },
    { id: 'transfer-hedef',  opts: { popup: true, labelFn: _hesapChipLabel, htmlFn: _hesapChipHtml, sortValueFn: _hesapChipValue, popupTitle: 'Hedef Seç', searchPlaceholder: 'Hesap/nakit ara…', placeholder: 'Hedef seçin…', emptyMsg: "Uygun hedef hesap/nakit yok" } },
    { id: 'kmhkredi-kmh', opts: { popup: true, labelFn: _hesapChipLabel, htmlFn: _hesapChipHtml, sortValueFn: _hesapChipValue, popupTitle: 'KMH Hesabı Seç', searchPlaceholder: 'Hesap ara…', placeholder: 'KMH hesabı seçin…', emptyMsg: "KMH limiti tanımlı hesap yok" } },
    // Ürün/hesap/kredi tipi — popup modu (tıklanınca aranabilir tam popup açılır)
    { id: 'kart-tip',  opts: { popup: true, popupTitle: 'Ürün Tipi Seç', searchPlaceholder: 'Tip ara…', placeholder: 'Tip seçin…', emptyMsg: "Tip eklemek için Tanımlamalar bölümüne gidin" } },
    { id: 'kredi-tur', opts: { popup: true, popupTitle: 'Kredi Türü Seç', searchPlaceholder: 'Tür ara…', placeholder: 'Tür seçin…', emptyMsg: "Tür eklemek için Tanımlamalar bölümüne gidin" } },
    { id: 'hesap-tur', opts: { popup: true, popupTitle: 'Hesap Türü Seç', searchPlaceholder: 'Tür ara…', placeholder: 'Tür seçin…', emptyMsg: "Hesap türü için Tanımlamalar bölümüne gidin" } },

    // ── Kategori / Kişi / diğer düz select'ler — diğer modal alanlarıyla
    // görsel tutarlılık için popup chip'e çevrildi (bkz. kullanıcı talebi) ──
    { id: 'elden-kategori', opts: { popup: true, popupTitle: 'Kategori Seç', searchPlaceholder: 'Kategori ara…', placeholder: 'Kategori seçin…', emptyMsg: "— Kategori bulunamadı —" } },
    { id: 'ab-kategori',    opts: { popup: true, popupTitle: 'Kategori Seç', searchPlaceholder: 'Kategori ara…', placeholder: 'Kategori seçin…', emptyMsg: "— Kategori bulunamadı —" } },
    { id: 'elden-kisi', opts: { popup: true, popupTitle: 'Kişi Seç', searchPlaceholder: 'Kişi ara…', placeholder: 'Kişi seçin…', emptyMsg: "— Kişi bulunamadı —" } },
    { id: 'kira-kisi',  opts: { popup: true, popupTitle: 'Kişi Seç', searchPlaceholder: 'Kişi ara…', placeholder: 'Kişi seçin…', emptyMsg: "— Kişi bulunamadı —" } },
    { id: 'maas-kisi',  opts: { popup: true, popupTitle: 'Kişi Seç', searchPlaceholder: 'Kişi ara…', placeholder: 'Kişi seçin…', emptyMsg: "— Kişi bulunamadı —" } },
    { id: 'kart-ortak-grup', opts: { popup: true, popupTitle: 'Ortak Limit Grubu Seç', searchPlaceholder: 'Grup ara…', placeholder: 'Grup seçin…', emptyMsg: "— Ortak limit grubu bulunamadı —" } },
  ].forEach(({ id, opts }) => {
    const el = root.getElementById ? root.getElementById(id) : root.querySelector('#' + id);
    if (el && !el._chipsApplied) selectToChips(el, opts);
  });
}

// Dinamik id'li mevduat aksiyon select'leri için ayrı uygulayıcı ──────
// (mev-aksiyon-vadesiz-<mevduatId> — statik config listesine giremiyor
// çünkü id her kayıt için farklı; dashboard'da renderOzet() her çağrıldığında
// yeniden üretiliyor, bu yüzden çağıran yerde manuel tetikleniyor.)

export function applyHesapAksiyonChips(root) {
  root = root || document;
  const sels = root.querySelectorAll ? root.querySelectorAll('select[id^="mev-aksiyon-vadesiz-"]') : [];
  sels.forEach(el => {
    if (el._chipsApplied) return;
    const phOpt = el.querySelector('option[disabled]');
    const placeholder = phOpt ? phOpt.textContent.replace(/^—\s*|\s*—$/g, '').trim() : 'Vadesiz hesap seçin…';
    selectToChips(el, {
      popup: true,
      labelFn: _hesapChipLabel,
      htmlFn: _hesapChipHtml,
      sortValueFn: _hesapChipValue,
      popupTitle: 'Hesap Seç',
      searchPlaceholder: 'Hesap ara…',
      placeholder,
      emptyMsg: "Uygun vadesiz hesap yok"
    });
  });
}

// ── Tutar kutularındaki tıklanabilir para birimi rozeti ──────────────
// Belirli bir money-wrap'i, para birimini gerçekten değiştiren bir
// <select>'e bağlar. Görünüm aynı kalır (rozet), ama artık tıklanınca
// aynı arama popup'ı açılır ve seçilen değer select'e yazılıp 'change'
// olayı tetiklenir — böylece o alanın mevcut onchange mantığı
// (hesap listesini filtreleme, hesaplama fonksiyonları vb.) olduğu
// gibi çalışmaya devam eder.

export function _wireMoneyCurButton(wrapId, selectId, lockHesapId) {
  const wrap = document.getElementById(wrapId);
  const sel  = document.getElementById(selectId);
  if (!wrap || !sel || wrap._curBtnWired) return;
  wrap._curBtnWired = true;
  wrap.classList.add('has-cur-btn');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'money-cur-btn';
  btn.textContent = wrap.dataset.code || sel.value || 'TRY';
  wrap.appendChild(btn);

  // Bazı alanlarda para birimi bir hesabın para birimine bağlanınca otomatik
  // kilitleniyor (o hesap seçiliyken elle değiştirilemez). lockHesapId
  // verilmişse o select'in dolu olması kilitli demektir.
  function isLocked() {
    if (sel.disabled) return true;
    if (lockHesapId) {
      const hesapSel = document.getElementById(lockHesapId);
      return !!(hesapSel && hesapSel.value);
    }
    return false;
  }
  function syncLockState() { btn.classList.toggle('locked', isLocked()); }
  syncLockState();

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    syncLockState();
    if (isLocked()) return;
    const options = [...sel.options].filter(o => !o.disabled);
    if (!options.length) return;
    _openScSearchPopup({
      title: 'Para Birimi Seç',
      placeholder: 'Para birimi ara…',
      options,
      getLabel: _currencyChipLabel,
      htmlFn: _currencyChipHtml,
      currentVal: sel.value,
      triggerBtn: btn,
      onSelect: (val) => {
        sel.value = val;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });

  // Rozet metnini wrap'in data-code'una göre güncel tut (mevcut onchange
  // fonksiyonları wrap.dataset.code'u zaten güncelliyor, biz sadece izliyoruz)
  new MutationObserver(() => { btn.textContent = wrap.dataset.code || sel.value || 'TRY'; })
    .observe(wrap, { attributes: true, attributeFilter: ['data-code'] });

  // Kilit durumunu canlı takip et (hesap seçilip kaldırılınca anında yansısın)
  if (lockHesapId) {
    const hesapSel = document.getElementById(lockHesapId);
    if (hesapSel) hesapSel.addEventListener('change', syncLockState);
  }
  /* rf-v85: per-control 700ms interval kaldırıldı; sync event/open sonrası yapılır. */
  setTimeout(syncLockState, 0);
}

export function wireAllMoneyCurButtons() {
  [
    ['elden-tutar-wrap',    'elden-para-birimi',       'elden-hesap'],
    ['islem-tutar-wrap',    'islem-para-birimi',       null],
    ['na-tutar-wrap',       'na-para-birimi',          null],
    ['hesap-bakiye-wrap',   'hesap-para-birimi',       null],
    ['maas-tutar-wrap',     'maas-para-birimi-manual', 'maas-hesap'],
    ['kira-tutar-wrap',     'kira-para-birimi-manual', 'kira-hesap'],
    ['kira-depozito-tutar-wrap', 'kira-depozito-pb',   null],
    ['ab-tutar-wrap',       'ab-para-birimi',          null],
  ].forEach(([w, s, h]) => _wireMoneyCurButton(w, s, h));
}

// Modal açıldığında da chip'leri uygula (modal içindeki select'ler için)
// Timeout 30→80ms: populateXxxModal() + phSet() + MutationObserver debounce'unun
// tamamlanmasına yetecek kadar bekliyoruz; aksi hâlde chip render sırasında
// seçenekler henüz gelmemiş (boş state) olabiliyor.
(function patchOpenModal() {
  const _orig = _wrapRegistry.get('openModal');
  if (typeof _orig !== 'function') { setTimeout(patchOpenModal, 50); return; }
  _wrapRegistry.register('openModal', function(id) {
    _orig.apply(this, arguments);
    const modal = document.getElementById(id);
    if (modal) setTimeout(() => { applyChipsToContainer(modal); wireAllMoneyCurButtons(); }, 80);
  });
})();

/* ── Settings Nav helpers ──
   NOT: .main-wrap (position:relative + z-index:1) kendi stacking context'ini
   oluşturuyor. .snav-sidebar mobilde position:fixed olsa da DOM'da .main-wrap
   içinde kaldığı sürece z-index:850'si SADECE o context içinde geçerli oluyor;
   document.body'e eklenen overlay (z-index:800 ama ROOT context'te) görsel
   olarak üstüne biniyor → ekranda sadece blur/karartma kalıyor, menü hiç
   görünmüyor. Çözüm: sidebar'ı mobil açılışta body'nin doğrudan çocuğu yap
   (root context'e taşı), kapanışta orijinal yerine geri koy. */


// ============================================================
// [DI-MIGRATION] ui.components.selectToChips — container'a kayıt
// ============================================================
import { provide } from '@core/container.js';
provide('ui.components.selectToChips', {
  selectToChips,
  get _scPopupState() { return _scPopupState; },
  get _scPopupOwnsBodyLock() { return _scPopupOwnsBodyLock; },
  get _scPopupFocusIdx() { return _scPopupFocusIdx; },
  get _scPopupRenderList() { return _scPopupRenderList; },
  _SC_SORT_CYCLE, _SC_SORT_ICONS, _SC_SORT_TITLES,
  _scGetSortMode, _scSetSortMode, _scUpdateSortBtn, _scSortList,
  _ensureScPopupEl, _scHighlight, _renderScSearchPopupList,
  _scPopupSetFocus, _scPopupMoveFocus, _scPopupSelectFocused,
  _scLockBodyScroll, _scUnlockBodyScroll, _openScSearchPopup, _closeScSearchPopup,
  _currencyChipHtml, _currencyChipLabel, _renkChipHtml, _renkChipLabel,
  _kartVisualHtml, _kartChipHtml, _kartChipLabel, _kartChipValue,
  _ikonChipHtml, _ikonChipLabel, ALTYAPI_LOGOLAR, _renderAltyapiLogoPicker,
  _pickAltyapiLogo, _selectAltyapiLogo, kartAltyapiLogoHtml,
  _altyapiChipHtml, _altyapiChipLabel, _bankaChipHtml, _bankaChipLabel,
  _hesapChipHtml, _hesapChipLabel, _hesapChipValue, applyChipsToContainer,
  applyHesapAksiyonChips, _wireMoneyCurButton, wireAllMoneyCurButtons,
});
