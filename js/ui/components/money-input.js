import { inject, whenReady } from '@core/container.js';
// DUAL-MODE CONTAINER KAYDI: core.format, core.state, ui.components.
// tarihInputOverlay, core.wrapRegistry zaten container'a taşınmış
// katmanlara ait. @pages/* importları o katman henüz taşınmadığı için
// BİLİNÇLİ OLARAK korunuyor.
const _format = inject('core.format');
const _coreState = inject('core.state');
const _tarihInputOverlay = inject('ui.components.tarihInputOverlay');
const _wrapRegistry = inject('core.wrapRegistry');
import { odModalKapat } from '@pages/odeme/04-modal-yasam-dongusu.js';
import { _odHesapPopupToggle } from '@pages/odeme/05-hesap-secim-popup.js';
import { rfOdTumuDoldur } from '@pages/odeme/patches/01-transfer-log-senkron.js';
import { odKalanBorcTamaminiDoldur, odModalSifirla, odModalKaydet } from '@pages/odeme/06-genel-odeme-modali.js';
// ============================================================
// js/ui/components/money-input.js — Para tutarı input mantığı
// (ATM stili canlı formatlama, para birimi sembol/wrap yönetimi,
// tarih input yardımcısı) + Ödeme durumu modalı (od-modal) DOM'u
// ============================================================

// setMoneyInput (odaktayken) ve bindMoneyInputs'un focus handler'ı birebir
// aynı "ATM stili sağdan-sola, binlik ayraçlı" formatlama mantığını kullanır
// (ham rakamları decimals'e göre sağdan hizala). Tek yerde topluyoruz.
export function _moneyAtmFormatla(rawDigits, decimals, neg) {
  const ondalik = _coreState.FORMAT_CONFIG.ondalikAyrac || ',';
  const binlik  = _coreState.FORMAT_CONFIG.binlikAyrac !== undefined ? _coreState.FORMAT_CONFIG.binlikAyrac : '.';
  const str = rawDigits.padStart(decimals + 1, '0');
  const intPart = decimals > 0 ? (str.slice(0, -decimals) || '0') : str;
  const decPart = decimals > 0 ? str.slice(-decimals) : '';
  let intFmt = parseInt(intPart, 10).toLocaleString('tr-TR').replace(/\./g, binlik !== '' ? binlik : '');
  if(binlik === '') intFmt = String(parseInt(intPart, 10));
  return (neg ? '-' : '') + (decimals > 0 ? `${intFmt}${ondalik}${decPart}` : intFmt);
}

export function updateMoneyWrapSymbols(code) {
  const cfg = (typeof _coreState.CURRENCY_CONFIG !== 'undefined' && _coreState.CURRENCY_CONFIG[code]) || {};
  const sym = cfg.symbol || (code === 'TRY' ? '\u20ba' : code);
  document.querySelectorAll('.money-wrap').forEach(w => {
    // Kendi para birimi olan wrap'leri (hesap/mevduat modal gibi) atla
    if(w.dataset.ownCurrency) return;
    w.dataset.symbol = sym;
    w.dataset.code   = code;
    // Input placeholder'ını da güncelle (eğer default placeholder ise)
    const inp = w.querySelector('input.money-input');
    if(inp) {
      const decimals = parseInt(inp.dataset.decimals ?? '2');
      if(decimals === 0) {
        inp.placeholder = '0';
      } else {
        inp.placeholder = '0' + (_coreState.FORMAT_CONFIG.ondalikAyrac || ',') + '0'.repeat(decimals);
      }
    }
  });
}

export function updateModalMoneyWraps(modalId, code) {
  const modal = document.getElementById(modalId);
  if(!modal) return;
  const cfg = (typeof _coreState.CURRENCY_CONFIG !== 'undefined' && _coreState.CURRENCY_CONFIG[code]) || {};
  const sym = cfg.symbol || (code === 'TRY' ? '\u20ba' : code);
  modal.querySelectorAll('.money-wrap').forEach(w => {
    w.dataset.symbol = sym;
    w.dataset.code   = code;
  });
}

export function setMoneyInput(id, val) {
  const el = document.getElementById(id);
  if(!el) return;
  const n = parseFloat(String(val).replace(/[^0-9.,\-]/g,'').replace(',','.')) || 0;
  const decimals = parseInt(el.dataset.decimals ?? _coreState.FORMAT_CONFIG.ondalikBasamak ?? '2');
  if(val === '' || val === null || val === undefined) {
    el.value = '';
    el._rawVal = 0;
    return;
  }
  el._rawVal = n;
  if(document.activeElement === el) {
    // Input odakta — ATM stili (sağdan sola, binlik ayraçlı)
    const neg = n < 0;
    const raw = String(Math.round(Math.abs(n) * Math.pow(10, decimals)));
    el.value = _moneyAtmFormatla(raw, decimals, neg);
  } else {
    el.value = _format.fmtMoneyCustom(n, decimals, _coreState.FORMAT_CONFIG.ondalikAyrac || ',', _coreState.FORMAT_CONFIG.binlikAyrac ?? '.');
  }
}

export function getMoneyInput(id) {
  const el = document.getElementById(id);
  if(!el) return 0;
  // Binlik ayraçları temizle, ondalık ayracını noktaya çevir
  const raw = (el.value || '').replace(/\s/g,'')
    .replace(new RegExp('\\' + (_coreState.FORMAT_CONFIG.binlikAyrac||'.'), 'g'), '')
    .replace(_coreState.FORMAT_CONFIG.ondalikAyrac || ',', '.');
  return parseFloat(raw) || 0;
}

export function bindMoneyInputs(container) {
  const root = container || document;
  root.querySelectorAll('input.money-input').forEach(el => {
    if(el._moneyBound) return;
    el._moneyBound = true;
    el.addEventListener('focus', function() {
      const decimals = parseInt(this.dataset.decimals ?? _coreState.FORMAT_CONFIG.ondalikBasamak ?? '2');
      // Mevcut değerden eksi işaretini ve ham rakamları al
      const neg = (this.value || '').trim().startsWith('-');
      const raw = (this.value || '').replace(/[^\d]/g, '');
      if(!raw || parseInt(raw, 10) === 0) {
        this.value = '';
      } else {
        this.value = _moneyAtmFormatla(raw, decimals, neg);
        // Modal açılışında yapılan programatik auto-focus'ta (bkz. openModal)
        // mevcut tutar tamamen seçili görünmesin diye imleç sona konur;
        // kullanıcının kendi tıklamasıyla gelen normal focus'ta ATM tarzı
        // "hepsini seç" davranışı korunur.
        if(this._skipAutoSelect) {
          this._skipAutoSelect = false;
          const len = this.value.length;
          try { this.setSelectionRange(len, len); } catch(e) {}
        } else {
          this.select();
        }
      }
    });
    el.addEventListener('blur', function() {
      const n = getMoneyInput(this.id);
      const decimals = parseInt(this.dataset.decimals ?? _coreState.FORMAT_CONFIG.ondalikBasamak ?? '2');
      if(this.value.trim() === '') { this.value = ''; return; }
      this.value = _format.fmtMoneyCustom(n, decimals, _coreState.FORMAT_CONFIG.ondalikAyrac || ',', _coreState.FORMAT_CONFIG.binlikAyrac ?? '.');
    });
    // Yazarken canlı formatla: binlik ayraçları otomatik ekle
    el.addEventListener('input', function() {
      const ondalikAyrac = _coreState.FORMAT_CONFIG.ondalikAyrac || ',';
      const binlikAyrac  = _coreState.FORMAT_CONFIG.binlikAyrac !== undefined ? _coreState.FORMAT_CONFIG.binlikAyrac : '.';
      const decimals     = parseInt(this.dataset.decimals ?? _coreState.FORMAT_CONFIG.ondalikBasamak ?? '2');
      let raw = this.value;
      // Ondalık ayraçla başlıyorsa başına 0 ekle (soldan sağa yazım zorla)
      if(raw.startsWith(ondalikAyrac)) raw = '0' + raw;
      // İmleç pozisyonunu koru
      const cursorPos = this.selectionStart;
      const beforeCursor = raw.slice(0, cursorPos);
      // Sadece rakam, ondalık ayraç ve eksi bırak
      const cleaned = raw.replace(new RegExp('[^0-9\\' + ondalikAyrac + '\\-]', 'g'), '');
      const parts = cleaned.split(ondalikAyrac);
      let intPart  = parts[0].replace(/^-/, '');
      const neg    = cleaned.startsWith('-');
      const hasDec = cleaned.includes(ondalikAyrac);
      const decPart = parts[1] !== undefined ? parts[1].slice(0, decimals) : '';
      // Binlik ayraç ekle (boşsa ya da yok işaretliyse atla)
      if(binlikAyrac !== '' && intPart.length > 3) {
        intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, binlikAyrac);
      }
      const formatted = (neg ? '-' : '') + intPart + (hasDec ? ondalikAyrac + decPart : '');
      if(formatted !== raw) {
        this.value = formatted;
        // İmleç: silinenleri ve eklenen ayraçları hesaba kat
        const removed = beforeCursor.replace(new RegExp('[^0-9\\' + ondalikAyrac + '\\-]', 'g'), '').length;
        let newPos = 0; let cnt = 0;
        for(let i = 0; i < formatted.length; i++) {
          const ch = formatted[i];
          if(ch !== binlikAyrac || binlikAyrac === '') cnt++;
          else continue;
          if(ch === '-' || ch === ondalikAyrac || /\d/.test(ch)) cnt++;
          else continue;
          if(cnt >= removed + 1) { newPos = i + 1; break; }
          newPos = i + 1;
        }
        // Daha sade: orijinal imleç = temizlenmiş karakter sayısına en yakın konum
        let charsBefore = 0; let finalPos = 0;
        for(let i = 0; i < formatted.length && charsBefore < beforeCursor.replace(new RegExp('[^0-9\\' + ondalikAyrac + '\\-]', 'g'), '').length; i++) {
          if(formatted[i] !== binlikAyrac) charsBefore++;
          finalPos = i + 1;
        }
        this.setSelectionRange(finalPos, finalPos);
      }
    });
    // Sadece sayısal karakter, ondalık ayraç, eksi izin ver
    el.addEventListener('keypress', function(e) {
      const allowed = '0123456789' + (_coreState.FORMAT_CONFIG.ondalikAyrac || ',') + (_coreState.FORMAT_CONFIG.binlikAyrac || '.') + '-';
      if(!allowed.includes(e.key) && !['Backspace','Delete','Tab','Enter','ArrowLeft','ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
    });
  });
}

export function setMoneyFormat(ondalik, binlik, basamak) {
  const oa = document.getElementById('ga-ondalik-ayrac');
  const ba = document.getElementById('ga-binlik-ayrac');
  const ob = document.getElementById('ga-ondalik-basamak');
  if(oa) oa.value = ondalik;
  if(ba) ba.value = binlik;
  if(ob) ob.value = basamak;
  _format.autoSaveGoruntuAyarlari();
}

export function setDateInputValue(elOrId, value) {
  const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
  if(!el) return;
  el.value = value || '';
  if(el._dateFake) {
    if(!value) {
      el._dateFake.value = '';
    } else {
      try { el._dateFake.value = _format.fmtDate(value); } catch(e) { el._dateFake.value = value; }
    }
    el._dateFake.style.color = '';
  }
}

// ==== Ödeme durumu modalı (od-modal) DOM enjeksiyonu ====
// NOT: Bu blok tematik olarak odeme.js'e ait, ama içeride bindMoneyInputs()
// çağrısı var ve bindMoneyInputs money-input.js'de tanımlı; money-input.js
// script sırasında odeme.js'den SONRA yükleniyor. Bu yüzden doğru çalışma
// zamanı sırasını korumak için IIFE burada (money-input.js sonunda) duruyor.
(function injectOdModalDOM() {
  if(document.getElementById('od-modal-bg')) return;
  const style = document.createElement('style');
  style.textContent = `
    #od-modal-bg {
      display:none;position:fixed;inset:0;z-index:10000;
      background:rgba(0,0,0,.55);backdrop-filter:blur(6px);
      align-items:center;justify-content:center;padding:16px;
      animation:modalBgIn .09s ease;
    }
    #od-modal-bg.open { display:flex; }
    #od-modal-box {
      background:var(--surface);border:1px solid var(--border2);
      border-radius:20px;width:100%;max-width:460px;
      box-shadow:0 32px 80px rgba(0,0,0,.6);
      overflow:hidden;overflow-y:auto;animation:modalSlideIn .22s cubic-bezier(.22,.68,0,1.2);
      max-height:calc(100vh - 64px);
    }
    html[data-theme="light"] #od-modal-box {
      background:#fff;border-color:rgba(0,0,0,.1);box-shadow:0 20px 60px rgba(0,0,0,.2);
    }
    #od-modal-header {
      display:flex;align-items:flex-start;justify-content:space-between;
      padding:20px 20px 0;gap:12px;
    }
    #od-modal-icon {
      width:44px;height:44px;border-radius:12px;flex-shrink:0;
      display:flex;align-items:center;justify-content:center;font-size:20px;
    }
    #od-modal-titles { flex:1;min-width:0; }
    #od-modal-label {
      font-size:13px;font-weight:700;color:var(--text);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }
    #od-modal-sub { font-size:11.5px;color:var(--text3);margin-top:2px; }
    #od-modal-close {
      width:32px;height:32px;border-radius:10px;border:none;cursor:pointer;
      background:var(--surface2);color:var(--text2);font-size:16px;
      display:flex;align-items:center;justify-content:center;flex-shrink:0;
      transition:background .12s;
    }
    #od-modal-close:hover { background:var(--surface3); }
    #od-modal-info-bar {
      margin:14px 20px 0;padding:11px 14px;
      background:var(--surface2);border:1px solid var(--border);border-radius:12px;
      display:flex;align-items:center;gap:12px;
    }
    .od-info-kol { display:flex;flex-direction:column;gap:2px; }
    .od-info-lbl { font-size:10px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.06em; }
    .od-info-val { font-size:13px;font-weight:700;color:var(--text);font-family:var(--mono); }
    .od-info-sep { width:1px;height:28px;background:var(--border);margin:0 4px; }
    #od-modal-body { padding:16px 20px; }
    #od-modal-log {
      margin-top:14px;border-top:1px solid var(--border);padding-top:12px;
      max-height:160px;overflow-y:auto;
    }
    .od-log-title { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);margin-bottom:8px; }
    .od-log-item {
      display:flex;align-items:flex-start;gap:9px;padding:6px 0;
      border-bottom:1px solid var(--border);font-size:11.5px;
    }
    .od-log-item:last-child { border-bottom:none; }
    .od-log-dot { width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:3px; }
    .od-log-meta { display:flex;flex-direction:column;gap:1px;flex:1; }
    .od-log-durum { font-weight:600;color:var(--text); }
    .od-log-tarih { font-size:10.5px;color:var(--text3);font-family:var(--mono); }
    .od-log-not { font-size:11px;color:var(--text2);font-style:italic; }
    .od-log-tutar { font-size:11px;font-family:var(--mono);color:var(--text2);flex-shrink:0;align-self:center; }
    .od-log-empty { font-size:12px;color:var(--text3);text-align:center;padding:8px 0; }
    .od-status-grid {
      display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;
    }
    .od-status-card {
      padding:10px 12px;border-radius:12px;border:2px solid transparent;
      cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:9px;
      background:var(--surface2);
    }
    .od-status-card:hover { border-color:var(--border2);background:var(--surface3); }
    .od-status-card.selected { border-color:currentColor !important; }
    .od-status-card .od-sc-icon { font-size:16px;width:22px;text-align:center;flex-shrink:0; }
    .od-status-card .od-sc-text { display:flex;flex-direction:column;gap:1px;min-width:0; }
    .od-status-card .od-sc-lbl { font-size:12px;font-weight:600;line-height:1.2; }
    .od-status-card .od-sc-sub { font-size:10px;color:var(--text3);line-height:1.2; }
    .od-status-card.sel-odendi   { color:var(--teal);  background:rgba(45,212,191,.1); border-color:rgba(45,212,191,.4);}
    .od-status-card.sel-kismi    { color:var(--violet);background:rgba(167,139,250,.1);border-color:rgba(167,139,250,.4);}
    .od-status-card.sel-ertelendi{ color:var(--warn);  background:rgba(251,146,60,.1); border-color:rgba(251,146,60,.4);}
    .od-status-card.sel-iptal    { color:var(--text3); background:rgba(107,114,128,.1);border-color:rgba(107,114,128,.4);}
    .od-status-card.sel-bekliyor { color:var(--sky);   background:rgba(56,189,248,.1); border-color:rgba(56,189,248,.4);}
    .od-status-card.sel-gecikti  { color:var(--rose);  background:rgba(251,113,133,.1);border-color:rgba(251,113,133,.4);}
    #od-modal-fields { display:flex;flex-direction:column;gap:10px; }
    .od-field-row { display:flex;gap:10px; }
    .od-field-row > * { flex:1;min-width:0; }
    .od-field-lbl { font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;display:block; }
    .od-field-inp {
      width:100%;box-sizing:border-box;
      background:var(--surface2);border:1px solid var(--border);border-radius:10px;
      color:var(--text);padding:9px 11px;font-size:13px;font-family:var(--mono);
      transition:border-color .12s;
    }
    .od-field-inp:focus { outline:none;border-color:var(--accent); }
    .od-hesap-popup-wrap { position:relative; }
    .od-hesap-trigger {
      width:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:8px;
      cursor:pointer;text-align:left;font-family:inherit;
    }
    .od-hesap-trigger:disabled { cursor:default;opacity:.65; }
    .od-hesap-trigger-txt { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
    .od-hesap-trigger-caret { flex-shrink:0;opacity:.6;font-size:11px;transition:transform .12s; }
    .od-hesap-popup-wrap.open .od-hesap-trigger-caret { transform:rotate(180deg); }
    .od-hesap-popup-panel {
      display:none;position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:20;
      background:var(--surface);border:1px solid var(--border2);border-radius:12px;
      box-shadow:0 16px 40px rgba(0,0,0,.35);max-height:220px;overflow-y:auto;padding:6px;
    }
    html[data-theme="light"] .od-hesap-popup-panel { background:#fff;box-shadow:0 12px 30px rgba(0,0,0,.18); }
    .od-hesap-popup-panel.open { display:block; }
    .od-hesap-opt {
      display:flex;align-items:center;gap:9px;padding:8px 9px;border-radius:9px;cursor:pointer;
    }
    .od-hesap-opt:hover { background:var(--surface2); }
    .od-hesap-opt.selected { background:rgba(79,142,247,.12); }
    .od-hesap-opt-ikon { font-size:14px;flex-shrink:0; }
    .od-hesap-opt-txt { display:flex;flex-direction:column;gap:1px;min-width:0; }
    .od-hesap-opt-ad { font-size:12.5px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .od-hesap-opt-bakiye { font-size:10.5px;color:var(--text3);font-family:var(--mono); }
    .od-hesap-opt-empty { font-size:12px;color:var(--text3);text-align:center;padding:10px; }
    /* od-modal-box, genel .modal-body sarmalayıcısını kullanmıyor; hero tutar
       stilini burada da almak için aynı font/height kurallarını tekrar tanımlıyoruz. */
    #od-modal-box .money-hero-wrap input.money-input {
      font-size:32px !important;font-weight:700 !important;height:84px !important;
      padding:22px 46px 26px !important;text-align:center !important;letter-spacing:-1px !important;
      border-radius:16px !important;border:none !important;background:transparent !important;
      color:var(--gold) !important;box-shadow:none !important;width:100%;box-sizing:border-box;
      transition:color .2s !important;caret-color:var(--gold);
    }
    #od-modal-box .money-hero-wrap input.money-input::placeholder { text-align:center;opacity:.18;color:var(--gold);font-size:28px;letter-spacing:-1px; }
    #od-modal-box .money-hero-wrap input.money-input:focus { outline:none !important;border:none !important;box-shadow:none !important;background:transparent !important;color:var(--gold) !important; }
    #od-modal-footer {
      display:flex;align-items:center;justify-content:space-between;
      padding:0 20px 20px;gap:10px;
    }
    #od-modal-vadesiz-info {
      margin:0 20px 12px;padding:10px 12px;
      background:rgba(45,212,191,.08);border:1px solid rgba(45,212,191,.25);
      border-radius:10px;font-size:11.5px;color:var(--teal);
      display:none;align-items:center;gap:8px;
    }
    #od-modal-vadesiz-info.show { display:flex; }
    @keyframes modalSlideIn {
      from { opacity:0;transform:translateY(20px) scale(.97); }
      to   { opacity:1;transform:translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(style);

  const bg = document.createElement('div');
  bg.id = 'od-modal-bg';
  bg.innerHTML = `
    <div id="od-modal-box">
      <div id="od-modal-header">
        <div id="od-modal-icon"></div>
        <div id="od-modal-titles">
          <div id="od-modal-label"></div>
          <div id="od-modal-sub"></div>
        </div>
        <button id="od-modal-close">✕</button>
      </div>
      <div id="od-modal-info-bar">
        <div class="od-info-kol"><div class="od-info-lbl">Vade Tarihi</div><div class="od-info-val" id="od-mi-tarih">—</div></div>
        <div class="od-info-sep"></div>
        <div class="od-info-kol"><div class="od-info-lbl">Tutar</div><div class="od-info-val" id="od-mi-tutar">—</div></div>
        <div class="od-info-sep"></div>
        <div class="od-info-kol"><div class="od-info-lbl">Mevcut Durum</div><div id="od-mi-durum"></div></div>
      </div>
      <div id="od-modal-body">
        <div class="od-status-grid" id="od-status-grid"></div>
        <div id="od-modal-vadesiz-info">
          <span>⚡</span>
          <span id="od-vadesiz-msg"></span>
        </div>
        <div id="od-modal-fields">
          <div class="od-field-row">
            <div>
              <label class="od-field-lbl" id="od-tarih-lbl">Ödeme Tarihi</label>
              <input class="od-field-inp" id="od-pop-tarih" type="date">
            </div>
          </div>
          <div id="od-hesap-field-wrap" style="display:none">
            <label class="od-field-lbl" id="od-hesap-lbl">Hesap</label>
            <div class="od-hesap-popup-wrap sc-wrap sc-popup-wrap">
              <button type="button" class="sc-popup-trigger-btn sc-is-empty" id="od-pop-hesap-trigger">
                <span class="sc-popup-placeholder" id="od-pop-hesap-trigger-txt">— Nakit (Nakit Bakiyesi) —</span>
                <svg class="sc-popup-trigger-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <input type="hidden" id="od-pop-hesap" value="">
            </div>
          </div>
          <div id="od-tutar-field-wrap">
            <label class="od-field-lbl" id="od-tutar-lbl">Ödenen Tutar</label>
            <div class="money-wrap money-hero-wrap" id="od-pop-tutar-wrap" data-symbol="₺" data-code="TRY">
              <input class="money-input" id="od-pop-tutar" type="text" inputmode="decimal" data-decimals="2">
              <button type="button" id="od-hizli-transfer-btn" class="money-hero-tum-btn od-fast-transfer-btn" style="display:none" title="Hızlı Transfer">
                <span class="mhtb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10"/><path d="M11 4l3 3-3 3"/><path d="M20 17H10"/><path d="M13 14l-3 3 3 3"/></svg></span>
                <span class="mhtb-label">Hızlı Transfer</span>
              </button>
              <button type="button" id="od-tumu-btn" class="money-hero-tum-btn rf-pay-all-btn" style="display:none" title="Tüm tutarı doldur">
                <span class="mhtb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 10-12h-7l1-8z"/></svg></span>
                <span class="mhtb-label">Tümü</span>
              </button>
              <button type="button" id="od-kalan-tamamini-btn" class="money-hero-tum-btn" style="display:none" title="Kalan Borcun Tamamı">
                <span class="mhtb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg></span>
                <span class="mhtb-label" id="od-kalan-tamamini-txt">Kalanın Tamamı</span>
              </button>
            </div>
          </div>
          <div id="od-ertelendi-hint" style="display:none;font-size:11px;color:var(--text3);margin:-4px 0 4px;line-height:1.5"></div>
          <label id="od-ertelendi-cascade-wrap" style="display:none;align-items:center;gap:7px;font-size:12px;color:var(--text2);margin:-2px 0 6px;cursor:pointer;user-select:none">
            <input type="checkbox" id="od-ertelendi-cascade" style="width:15px;height:15px;cursor:pointer">
            Sonraki taksitleri de aynı miktarda ötele
          </label>
          <div id="od-gecikme-oran-wrap" style="display:none;margin:-2px 0 6px">
            <label class="od-field-lbl">Bu Taksit İçin Gecikme Faiz Oranı (% Aylık)</label>
            <input class="od-field-inp" id="od-gecikme-oran" type="number" step="0.01" min="0" placeholder="Tanımlamalar'daki genel oran kullanılır" oninput="_odModalKrediAlanlariAyarla('gecikti')">
          </div>
          <div>
            <label class="od-field-lbl">Not</label>
            <input class="od-field-inp" id="od-pop-not" type="text" placeholder="Opsiyonel not...">
          </div>
        </div>
        <div id="od-modal-log"></div>
      </div>
      <div id="od-modal-footer">
        <button class="btn btn-ghost btn-sm" id="od-modal-sifirla-btn" style="display:none">↺ Sıfırla</button>
        <div style="display:flex;gap:8px;margin-left:auto">
          <button class="btn btn-ghost btn-sm" id="od-modal-iptal-btn">İptal</button>
          <button class="btn btn-primary btn-sm" id="od-modal-kaydet-btn">✓ Kaydet</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(bg);

  // Statik od-modal butonları — gerçek addEventListener ile bağlanıyor
  // (eskiden onclick="..." attribute'u içine gömülüydü).
  document.getElementById('od-modal-close').addEventListener('click', () => odModalKapat());
  document.getElementById('od-pop-hesap-trigger').addEventListener('click', () => _odHesapPopupToggle());
  document.getElementById('od-hizli-transfer-btn').addEventListener('click', () => _wrapRegistry.call('kartOdemeHizliTransferAc', 'od-modal'));
  document.getElementById('od-tumu-btn').addEventListener('click', () => rfOdTumuDoldur());
  document.getElementById('od-kalan-tamamini-btn').addEventListener('click', () => odKalanBorcTamaminiDoldur());
  document.getElementById('od-modal-sifirla-btn').addEventListener('click', () => odModalSifirla());
  document.getElementById('od-modal-iptal-btn').addEventListener('click', () => odModalKapat());
  document.getElementById('od-modal-kaydet-btn').addEventListener('click', () => odModalKaydet());

  // od-pop-tutar artık standart money-input sistemini kullanıyor (canlı binlik
  // ayraç formatlama + focus/blur davranışı diğer tutar alanlarıyla tutarlı olsun diye).
  bindMoneyInputs(bg);
  // od-pop-tarih'i diğer date inputlar gibi date-wrap overlay'e sar
  // [BUG FIX] setTimeout(...,0) tek başına 'ui.components.tarihInputOverlay'in
  // register olduğunu garanti etmiyordu (bu IIFE modül evaluation sırasında,
  // yani diğer script'lerin provide() çağrılarından önce çalışabiliyordu).
  // whenReady ile namespace hazır olana kadar erteleniyor.
  whenReady('ui.components.tarihInputOverlay', () => { _tarihInputOverlay.applyToAll(); });
  // Dışına tıklayınca kapat
  bg.addEventListener('click', function(e){ if(e.target===bg) odModalKapat(); });
})();


// ============================================================
// [DI-MIGRATION] ui.components.moneyInput — container'a kayıt
// ============================================================
import { provide } from '@core/container.js';
provide('ui.components.moneyInput', {
  _moneyAtmFormatla, updateMoneyWrapSymbols, updateModalMoneyWraps,
  setMoneyInput, getMoneyInput, bindMoneyInputs, setMoneyFormat,
  setDateInputValue,
});
