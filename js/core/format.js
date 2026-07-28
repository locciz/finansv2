import { saveData } from '@core/app-core-base.js';
import { inject } from '@core/container.js';
const _coreState = inject('core.state');
const _wrapRegistry = inject('core.wrapRegistry');
import { showToast } from '@components/modal-genel.js';
import { refreshDateOverlays } from '@components/mobile-nav-tema/05-tarih-input-overlay.js';
import { renderTumOranTablolari } from '@pages/tanimlamalar/05-genel-oran-tablolari.js';
// ============================================================
// js/core/format.js — Para/tarih/saat biçimlendirme + Görüntü
// Ayarları (Tanımlamalar sayfası) UI mantığı
// ============================================================

// ── Para birimi biçimlendirme ────────────────────────────────
export var _gaAutoSaveTimer = null; // Görüntü ayarları otomatik-kaydet debounce zamanlayıcısı

function fmtCurBase(n, currency, sign=false) {
  const code = (currency && _coreState.CURRENCY_CONFIG[currency]) ? currency : (_coreState.defaultCurrency || 'TRY');
  const cfg = _coreState.CURRENCY_CONFIG[code] || _coreState.CURRENCY_CONFIG['TRY'] || { symbol: '₺', locale: 'tr-TR', position: 'prefix', decimals: 2 };
  if(isNaN(n) || n===null || n===undefined) {
    return cfg.position === 'prefix' ? cfg.symbol + '0' : '0\u202f' + cfg.symbol;
  }
  const decimals = cfg.decimals !== undefined ? cfg.decimals : 2;
  const s = Math.abs(n).toLocaleString(cfg.locale, {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
  const sym = cfg.symbol;
  const neg = n < 0;
  const pos = sign && n > 0;
  if(cfg.position === 'suffix') {
    return (neg ? '-' : pos ? '+' : '') + s + '\u202f' + sym;
  } else {
    return (neg ? '-' : pos ? '+' : '') + sym + s;
  }
}

// ES module export'ları immutable binding olduğu için `export function
// fmtCur(){}` ismini doğrudan yeniden atayarak override etmek (eskiden
// `window.fmtCur = window._fmtCurFormatted` ile yapılıyordu) mümkün değil;
// bunun yerine mutable bir pointer (_currentFmtCur) tutuyoruz.
// updateFmtCurOverride() bu pointer'ı _coreState.FORMAT_CONFIG'e duyarlı sürümle
// günceller; buradan export edilen `fmtCur` her zaman en güncel pointer'ı çağırır.
let _currentFmtCur = fmtCurBase;

export function setFmtCur(fn) {
  if (typeof fn !== 'function') throw new Error('setFmtCur(fn): fn bir fonksiyon olmalı.');
  _currentFmtCur = fn;
}

export function getFmtCur() {
  return _currentFmtCur;
}

export function fmtCur(n, currency, sign=false) {
  return _currentFmtCur(n, currency, sign);
}

export function fmt(n, sign=false) {
  return fmtCur(n, _coreState.defaultCurrency, sign);
}

// ── Tarih/saat biçimlendirme ──────────────────────────────────
export function fmtDate(d) {
  if(!d) return '';
  const dt = typeof d === 'string' ? new Date(d+'T00:00:00') : d;
  if(!(dt instanceof Date) || isNaN(dt.getTime())) return '—';
  const pattern = _coreState.FORMAT_CONFIG.tarihFormat || 'dd/MM/yyyy';
  return applyFormatToken(pattern, dt);
}

export function fmtTime(d) {
  if(!d) return '';
  const dt = (d instanceof Date) ? d : new Date(d);
  const pattern = _coreState.FORMAT_CONFIG.saatFormat || 'HH:mm';
  return applyTimeToken(pattern, dt);
}

export function fmtMoneyCustom(n, decimals, ondalik, binlik) {
  if(isNaN(n) || n===null || n===undefined) n = 0;
  const dec = parseInt(decimals) || 0;
  const abs = Math.abs(n).toFixed(dec);
  const parts = abs.split('.');
  let intPart = parts[0];
  const decPart = parts[1] || '';
  // binlik ayraç
  if(binlik !== '' && binlik !== undefined) {
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, binlik);
  }
  let result = intPart;
  if(dec > 0) result += ondalik + decPart;
  return (n < 0 ? '-' : '') + result;
}

export function fmtCurShort(n, currency) {
  const cfg = (typeof _coreState.CURRENCY_CONFIG!=='undefined' && _coreState.CURRENCY_CONFIG[currency]) || {};
  const sym = cfg.symbol || '';
  const abs = Math.abs(n);
  let s;
  if(abs >= 1000000) s = (n/1000000).toFixed(abs>=10000000?0:1).replace('.',',') + 'Mn';
  else if(abs >= 1000) s = (n/1000).toFixed(abs>=10000?0:1).replace('.',',') + 'b';
  else s = Math.round(n).toString();
  return sym + s;
}

export function applyFormatToken(pattern, dt) {
  const GUNLER_KISA = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
  const GUNLER_UZUN = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  const yyyy = String(dt.getFullYear());
  const yy = yyyy.slice(-2);
  const MM = String(dt.getMonth()+1).padStart(2,'0');
  const M  = String(dt.getMonth()+1);
  const dd = String(dt.getDate()).padStart(2,'0');
  const d  = String(dt.getDate());
  return pattern
    .replace('EEEE', GUNLER_UZUN[dt.getDay()])
    .replace('EEE',  GUNLER_KISA[dt.getDay()])
    .replace('yyyy', yyyy)
    .replace('yy', yy)
    .replace('MM', MM)
    .replace('M', M)
    .replace('dd', dd)
    .replace('d', d);
}

export function applyTimeToken(pattern, dt) {
  const H = dt.getHours();
  const h = H % 12 || 12;
  const HH = String(H).padStart(2,'0');
  const hh = String(h).padStart(2,'0');
  const mm = String(dt.getMinutes()).padStart(2,'0');
  const ss = String(dt.getSeconds()).padStart(2,'0');
  const A = H < 12 ? 'AM' : 'PM';
  return pattern
    .replace('HH', HH)
    .replace('hh', hh)
    .replace('mm', mm)
    .replace('ss', ss)
    .replace('A', A);
}

// ── Genel yardımcılar (parse/escape/id/tarih-string) ─────────
export function parseTutarStr(str) {
  if(str === null || str === undefined) return 0;
  let s = String(str).trim();
  if(s === '') return 0;
  const neg = s.startsWith('-');
  s = s.replace(/[^0-9.,]/g, '');
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if(lastDot !== -1 && lastComma !== -1) {
    // Hem nokta hem virgül var — en sonda olan ondalık ayraçtır, diğeri binlik
    if(lastComma > lastDot) s = s.replace(/\./g,'').replace(',', '.');
    else s = s.replace(/,/g,'');
  } else if(lastComma !== -1) {
    // Sadece virgül var → ondalık ayraç
    s = s.replace(/\./g,'').replace(',', '.');
  }
  // Sadece nokta var ya da hiç ayraç yok → zaten "." ondalık ayracı olarak geçerli
  const n = parseFloat(s) || 0;
  return neg ? -Math.abs(n) : n;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

export function uid() { return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }

export function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}


// ── Format config yükle/kaydet ────────────────────────────────
export function loadFormatConfig() {
  // _coreState.FORMAT_CONFIG ve currency Drive'dan gelir (applyMigrations içinde uygulanır)
  // Burada sadece _coreState.DB'de zaten yüklüyse uygula (sayfa yenilemesiz geçiş için)
  if(typeof _coreState.DB !== 'undefined') {
    if(_coreState.DB._formatConfig) _coreState.setFORMAT_CONFIG({..._coreState.FORMAT_CONFIG, ..._coreState.DB._formatConfig});
    if(_coreState.DB._currency) _coreState.setDefaultCurrency(_coreState.DB._currency);
  }
}

export function saveFormatConfig() {
  // Sadece _coreState.DB'ye yaz, saveData Drive'a gönderir
  if(typeof _coreState.DB !== 'undefined') {
    _coreState.DB._formatConfig = _coreState.FORMAT_CONFIG;
    if(typeof saveData === 'function') saveData();
  }
}

// ── Görüntü Ayarları UI fonksiyonları (Tanımlamalar sayfası) ─
export function loadGoruntuAyarlariUI() {
  const tf = document.getElementById('ga-tarih-format');
  const sf = document.getElementById('ga-saat-format');
  const oa = document.getElementById('ga-ondalik-ayrac');
  const ba = document.getElementById('ga-binlik-ayrac');
  const ob = document.getElementById('ga-ondalik-basamak');
  if(tf) tf.value = _coreState.FORMAT_CONFIG.tarihFormat || 'dd/MM/yyyy';
  if(sf) sf.value = _coreState.FORMAT_CONFIG.saatFormat || 'HH:mm';
  if(oa) oa.value = _coreState.FORMAT_CONFIG.ondalikAyrac || ',';
  if(ba) ba.value = _coreState.FORMAT_CONFIG.binlikAyrac !== undefined ? _coreState.FORMAT_CONFIG.binlikAyrac : '.';
  if(ob) ob.value = _coreState.FORMAT_CONFIG.ondalikBasamak || '2';
  const gkEl = document.getElementById('ga-tarih-giris-kolay');
  if(gkEl) gkEl.checked = _coreState.FORMAT_CONFIG.tarihGirisKolay !== false;
  // Saat ayraç select'ini senkronize et
  syncSaatAyracFromFormat();
  updateGoruntuPreview();
}

export function syncSaatAyracFromFormat() {
  const sf = (document.getElementById('ga-saat-format')||{}).value || '';
  const sel = document.getElementById('ga-saat-ayrac');
  if(!sel) return;
  if(sf.includes('h')) sel.value = 'h';
  else if(sf.includes('.')) sel.value = '.';
  else sel.value = ':';
}

export function syncTarihAyrac() {
  const ayrac = document.getElementById('ga-tarih-ayrac').value;
  const input = document.getElementById('ga-tarih-format');
  if(!input) return;
  let fmt = input.value || 'dd/MM/yyyy';
  // Mevcut formatdaki ayraçları (/, ., -, boşluk) yeni ayraçla değiştir
  // Yalnızca token harfleri arasındaki ayraçları değiştir
  fmt = fmt.replace(/(?<=[dMy])([\/\.\- ])(?=[dMy])/g, ayrac);
  input.value = fmt;
  autoSaveGoruntuAyarlari();
}

export function syncSaatAyrac() {
  const ayrac = document.getElementById('ga-saat-ayrac').value;
  const input = document.getElementById('ga-saat-format');
  if(!input) return;
  // Mevcut formatı oku ve ayracı değiştir
  let fmt = input.value || 'HH:mm';
  // Tüm :, . ve h ayraçlarını yeni ayraçla değiştir (token harfleri dışında)
  fmt = fmt.replace(/(?<=[mMsHhA\d])[:\.h](?=[mMsHhA\d])/g, ayrac);
  input.value = fmt;
  autoSaveGoruntuAyarlari();
}

export function setTarihFormat(fmt) {
  const inp = document.getElementById('ga-tarih-format');
  if(inp) inp.value = fmt;
  autoSaveGoruntuAyarlari();
}

export function setSaatFormat(fmt) {
  const inp = document.getElementById('ga-saat-format');
  if(inp) inp.value = fmt;
  syncSaatAyracFromFormat();
  autoSaveGoruntuAyarlari();
}

export function updateGoruntuPreview() {
  const tarihFmt = (document.getElementById('ga-tarih-format')||{}).value || 'dd/MM/yyyy';
  const saatFmt  = (document.getElementById('ga-saat-format')||{}).value || 'HH:mm';
  const ondalik  = (document.getElementById('ga-ondalik-ayrac')||{}).value || ',';
  const binlik   = (document.getElementById('ga-binlik-ayrac')||{}).value;
  const basamak  = (document.getElementById('ga-ondalik-basamak')||{}).value || '2';

  const now = new Date();
  const tarihPrev = document.getElementById('ga-tarih-preview');
  const saatPrev  = document.getElementById('ga-saat-preview');
  const paraPrev  = document.getElementById('ga-para-preview');

  if(tarihPrev) tarihPrev.textContent = applyFormatToken(tarihFmt, now);
  if(saatPrev)  saatPrev.textContent  = applyTimeToken(saatFmt, now);
  if(paraPrev) {
    const ornekTutar = 1234567.89;
    const paraStr = fmtMoneyCustom(ornekTutar, basamak, ondalik, binlik !== undefined ? binlik : '.');
    // Mevcut _coreState.defaultCurrency sembolünü göster
    const cfg = _coreState.CURRENCY_CONFIG[_coreState.defaultCurrency] || {symbol:'₺', position:'prefix'};
    paraPrev.textContent = cfg.position === 'suffix'
      ? paraStr + '\u202f' + cfg.symbol
      : cfg.symbol + paraStr;
  }
  // Hızlı tarih girişi örneğini güncelle (format değişince örnek de değişsin)
  const ornekEl = document.getElementById('ga-tarih-kolay-ornek');
  if (ornekEl) {
    // Bugünü seçilen formatta göster
    ornekEl.textContent = applyFormatToken(tarihFmt, now);
  }
}

export function saveGoruntuAyarlari(silent) {
  _coreState.FORMAT_CONFIG.tarihFormat  = (document.getElementById('ga-tarih-format')||{}).value || 'dd/MM/yyyy';
  _coreState.FORMAT_CONFIG.saatFormat   = (document.getElementById('ga-saat-format')||{}).value  || 'HH:mm';
  _coreState.FORMAT_CONFIG.ondalikAyrac = (document.getElementById('ga-ondalik-ayrac')||{}).value || ',';
  _coreState.FORMAT_CONFIG.binlikAyrac  = (document.getElementById('ga-binlik-ayrac')||{}).value;
  if(_coreState.FORMAT_CONFIG.binlikAyrac === undefined) _coreState.FORMAT_CONFIG.binlikAyrac = '.';
  _coreState.FORMAT_CONFIG.ondalikBasamak = (document.getElementById('ga-ondalik-basamak')||{}).value || '2';
  const gkEl = document.getElementById('ga-tarih-giris-kolay');
  if(gkEl) _coreState.FORMAT_CONFIG.tarihGirisKolay = gkEl.checked;
  saveFormatConfig();
  if(!silent) showToast('Görüntü ayarları kaydedildi ✓');
  // fmtCur override'ını güncelle
  updateFmtCurOverride();
  // Topbar & sidebar saatini anında güncelle
  _wrapRegistry.call('updateClockFn');
  // Vergi tablosu ve date overlay'leri yenile
  renderTumOranTablolari();
  refreshDateOverlays();
}

export function autoSaveGoruntuAyarlari() {
  updateGoruntuPreview();
  clearTimeout(_gaAutoSaveTimer);
  _gaAutoSaveTimer = setTimeout(() => saveGoruntuAyarlari(true), 300);
}

export function resetGoruntuAyarlari() {
  _coreState.replaceObjectContents(_coreState.FORMAT_CONFIG, { tarihFormat:'dd/MM/yyyy', saatFormat:'HH:mm', ondalikAyrac:',', binlikAyrac:'.', ondalikBasamak:'2', tarihGirisKolay:true });
  saveFormatConfig();
  loadGoruntuAyarlariUI();
  updateFmtCurOverride();
  _wrapRegistry.call('updateClockFn');
  renderTumOranTablolari();
  refreshDateOverlays();
  showToast('Varsayılan ayarlara dönüldü');
}

// ── fmtCur'ü kullanıcı format ayarlarıyla override et ────────
// NOT: fmtCur'ün orijinal (_coreState.CURRENCY_CONFIG'e sabit locale ile bağlı) hali
// yukarıda tanımlı; burada asıl kullanılan fmtCur, _coreState.FORMAT_CONFIG'teki
// ondalık/binlik ayrımı ve basamak sayısını dikkate alan bir sürümle
// değiştiriliyor. saveGoruntuAyarlari/resetGoruntuAyarlari bu override'ı
// _coreState.FORMAT_CONFIG değiştikten sonra yeniden kurmak için çağırıyordu; override
// zaten _coreState.FORMAT_CONFIG'i her çağrıda taze okuduğundan yeniden kurmaya gerek
// yok — bu fonksiyon kasıtlı olarak boş bırakılmıştı, öyle kalıyor.
export function updateFmtCurOverride() {}

// [ES module] eskiden window._fmtCurFormatted = function(){...} ardından
// window.fmtCur = window._fmtCurFormatted ile export edilen `fmtCur`
// yeniden atanmaya çalışılıyordu; ES export binding'leri immutable olduğu
// için bu satır export edilen fmtCur'ı ASLA değiştirmiyordu (sessiz bug).
// Artık setFmtCur(...) ile mutable pointer güncelleniyor; export edilen
// fmtCur (yukarıda tanımlı) her zaman bu pointer'ı çağırır.
function fmtCurFormatted(n, currency, sign=false) {
  const code = (currency && _coreState.CURRENCY_CONFIG[currency]) ? currency : (_coreState.defaultCurrency || 'TRY');
  const cfg = _coreState.CURRENCY_CONFIG[code] || _coreState.CURRENCY_CONFIG['TRY'] || { symbol: '₺', position: 'prefix', decimals: 2 };
  if(isNaN(n) || n===null || n===undefined) n = 0;
  const decimals = _coreState.FORMAT_CONFIG.ondalikBasamak !== undefined ? parseInt(_coreState.FORMAT_CONFIG.ondalikBasamak) : (cfg.decimals !== undefined ? cfg.decimals : 2);
  const ondalik = _coreState.FORMAT_CONFIG.ondalikAyrac || ',';
  const binlik  = _coreState.FORMAT_CONFIG.binlikAyrac !== undefined ? _coreState.FORMAT_CONFIG.binlikAyrac : '.';
  const numStr = fmtMoneyCustom(n, decimals, ondalik, binlik);
  const sym = cfg.symbol;
  const neg = n < 0;
  const pos = sign && n > 0;
  const prefix = (neg ? '-' : pos ? '+' : '');
  if(cfg.position === 'suffix') return prefix + numStr.replace(/^-/, '') + '\u202f' + sym;
  return prefix + sym + numStr.replace(/^-/, '');
}
// fmtCur'ü format-aware versiyonla değiştir (mutable pointer üzerinden)
setFmtCur(fmtCurFormatted);

// ============================================================
// [DI-MIGRATION] core.format — container'a kayıt
// ============================================================
import { provide } from '@core/container.js';
provide('core.format', {
  setFmtCur, getFmtCur, fmtCur, fmt, fmtDate, fmtTime, fmtMoneyCustom,
  fmtCurShort, applyFormatToken, applyTimeToken, parseTutarStr, escapeHtml,
  uid, localDateStr, loadFormatConfig, saveFormatConfig, loadGoruntuAyarlariUI,
  syncSaatAyracFromFormat, syncTarihAyrac, syncSaatAyrac, setTarihFormat,
  setSaatFormat, updateGoruntuPreview, saveGoruntuAyarlari,
  autoSaveGoruntuAyarlari, resetGoruntuAyarlari, updateFmtCurOverride,
  get _gaAutoSaveTimer() { return _gaAutoSaveTimer; },
});

