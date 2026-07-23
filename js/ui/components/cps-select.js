// ============================================================
// js/ui/components/cps-select.js — Chip Pill Select genel motoru
// Dar toolbar alanlarındaki native <select>'leri kompakt,
// tıklanınca açılan chip popover'a dönüştürür.
// ============================================================

// Gerçek <select> "data-no-reset" ile saklı kalır, state kaynağı olarak
// görev görür; pill bunu görselleştirir ve onchange tetikler.
export var _cpsOpenId = null;
export function cpsInit(selectId, opts) {
  // opts: { renderLabel(value, opt) -> string, dot(value) -> color|null, alignRight: bool, fieldStyle: bool }
  opts = opts || {};
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.setAttribute('data-no-reset', '');
  if (sel.style.display !== 'none') sel.style.display = 'none';

  let wrap = document.getElementById('cps-wrap-' + selectId);
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'cps-wrap-' + selectId;
    wrap.className = 'chip-pill-select' + (opts.alignRight ? ' align-right' : '') + (opts.fieldStyle ? ' field-style' : '');
    wrap.innerHTML =
      '<button type="button" class="cps-trigger">' +
        '<span class="cps-trigger-label"></span>' +
        '<svg class="cps-trigger-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
      '</button>' +
      '<div class="cps-panel"></div>';
    sel.insertAdjacentElement('afterend', wrap);
    // [ES module] onclick="cpsToggle('...')" kaldırıldı - gerçek addEventListener bağlanıyor.
    wrap.querySelector('.cps-trigger').addEventListener('click', () => cpsToggle(selectId));
  }
  sel._cpsOpts = opts;
  cpsSync(selectId);
}

export function cpsSync(selectId) {
  const sel = document.getElementById(selectId);
  const wrap = document.getElementById('cps-wrap-' + selectId);
  if (!sel || !wrap) return;
  const opts = sel._cpsOpts || {};
  const panel = wrap.querySelector('.cps-panel');
  const labelEl = wrap.querySelector('.cps-trigger-label');
  const options = Array.from(sel.options);
  const current = options.find(o => o.value === sel.value) || options[0];

  labelEl.textContent = current ? (opts.shortLabel ? opts.shortLabel(current.value, current) : current.textContent) : '';

  function optHtml(o) {
    const isActive = o.value === sel.value;
    const dotColor = opts.dot ? opts.dot(o.value, o) : null;
    const dotHtml = dotColor ? '<span class="chip-dot" style="background:' + dotColor + '"></span>' : '';
    return '<button type="button" class="cps-opt' + (isActive ? ' active' : '') + '" data-val="' + o.value.replace(/"/g, '&quot;') + '">' + dotHtml + o.textContent + '</button>';
  }

  // optgroup'lar varsa grup başlıklarıyla render et, yoksa düz liste
  const hasGroups = Array.from(sel.children).some(c => c.tagName === 'OPTGROUP');
  if (hasGroups) {
    panel.innerHTML = Array.from(sel.children).map(child => {
      if (child.tagName === 'OPTGROUP') {
        const groupOpts = Array.from(child.children).map(optHtml).join('');
        return '<div class="cps-group-label">' + child.label + '</div>' + groupOpts;
      }
      return optHtml(child);
    }).join('');
  } else {
    panel.innerHTML = options.map(optHtml).join('');
  }

  panel.querySelectorAll('.cps-opt').forEach(btn => {
    btn.onclick = () => {
      sel.value = btn.dataset.val;
      cpsClose();
      cpsSync(selectId);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    };
  });
}

export function cpsToggle(selectId) {
  const wrap = document.getElementById('cps-wrap-' + selectId);
  if (!wrap) return;
  if (_cpsOpenId === selectId) { cpsClose(); return; }
  cpsClose();
  wrap.classList.add('open');
  _cpsOpenId = selectId;
}

export function cpsClose() {
  if (!_cpsOpenId) return;
  const wrap = document.getElementById('cps-wrap-' + _cpsOpenId);
  if (wrap) wrap.classList.remove('open');
  _cpsOpenId = null;
}

// ── Chip Pill Select: dış tık / Escape ile kapama ──────────────
document.addEventListener('click', (e) => {
  if (!_cpsOpenId) return;
  const wrap = document.getElementById('cps-wrap-' + _cpsOpenId);
  if (wrap && !wrap.contains(e.target)) cpsClose();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cpsClose(); });

