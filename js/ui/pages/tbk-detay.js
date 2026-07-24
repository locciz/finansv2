import { saveData, getShowPage, setShowPage } from '../../core/app-core-base.js';
import { fmtCur, fmtDate, localDateStr } from '../../core/format.js';
import { DB, defaultCurrency } from '../../core/state.js';
import { setDateInputValue } from '../components/money-input.js';
import { renderTahminBakiye, _tbkAylikVeriler, _tbkAylikPb } from './ozet.js';
import { _tbkFaizFormButonGuncelle, renderTbkFaizListesi } from './tanimlamalar/04-tbk-faiz-oranlari.js';
import { _sidebarDim, openModal } from '../components/modal-genel.js';
import { register, get } from '../../core/wrap-registry.js';
import { FinansPaymentUiHelpers } from './odeme/patches/01-transfer-log-senkron.js';
import { FinansUiCoreRefresh } from './odeme/patches/07-genel-ui-burst-refresh.js';
// Orijinal 02-core-app-engine.js içinden çıkarıldı. İçerik değiştirilmedi.

export function tbkSetGecmis(gun, btn) {
  if(!DB.uiFiltreler) DB.uiFiltreler = {};
  if(!DB.uiFiltreler.ozet) DB.uiFiltreler.ozet = {};
  if(DB.uiFiltreler.ozet.tahminGecmisGun !== gun) { DB.uiFiltreler.ozet.tahminGecmisGun = gun; saveData(); }
  document.querySelectorAll('.tahmin-gecmis-btn').forEach(b=>b.classList.remove('tbk-period-active'));
  if(btn) btn.classList.add('tbk-period-active');
  renderTahminBakiye();
}

export function tbkSetPeriod(gun, btn) {
  if(!DB.uiFiltreler) DB.uiFiltreler = {};
  if(!DB.uiFiltreler.ozet) DB.uiFiltreler.ozet = {};
  if(DB.uiFiltreler.ozet.tahminGun !== gun) { DB.uiFiltreler.ozet.tahminGun = gun; saveData(); }
  // Başlık güncelle
  const titles = {90:'Gelecek 3 Ay Tahmini Bakiye', 180:'Gelecek 6 Ay Tahmini Bakiye', 365:'Gelecek 1 Yıl Tahmini Bakiye', 730:'Gelecek 2 Yıl Tahmini Bakiye', 1095:'Gelecek 3 Yıl Tahmini Bakiye'};
  const el = document.getElementById('tahmin-card-title');
  if(el) el.textContent = titles[gun] || 'Tahmini Bakiye';
  // Aktif buton — SADECE bu kartın buton grubu içinde (Yaklaşan Ödemeler kartındaki
  // butonlarla aynı stil sınıfını paylaştığı için global seçim onları da etkiliyordu)
  const tahminGrup = document.getElementById('tahmin-period-group');
  if(tahminGrup) tahminGrup.querySelectorAll('.tbk-period-btn').forEach(b=>b.classList.remove('tbk-period-active'));
  if(btn) btn.classList.add('tbk-period-active');
  renderTahminBakiye();
}


// ── Tahmini Bakiye Ayarları Modalı: vade yenileme aç/kapa + gelecek faiz oranı varsayımları ──
export function openTbkAyarModal() {
  if(!DB.tahminAyarlari) DB.tahminAyarlari = { vadeliYenile: true };
  const toggle = document.getElementById('tbk-vadeli-yenile-toggle');
  if(toggle) toggle.checked = DB.tahminAyarlari.vadeliYenile !== false;
  const tarihEl = document.getElementById('tbk-faiz-tarih');
  if(tarihEl) setDateInputValue(tarihEl, localDateStr(new Date()));
  const oranEl = document.getElementById('tbk-faiz-oran');
  if(oranEl) oranEl.value = '';
  const stopajEl = document.getElementById('tbk-faiz-stopaj');
  if(stopajEl) stopajEl.value = '';
  _tbkFaizDuzenlemeId = null;
  _tbkFaizFormButonGuncelle();
  renderTbkFaizListesi();
  openModal('modal-tbk-ayar');
}

export function onTbkVadeliYenileToggle() {
  if(!DB.tahminAyarlari) DB.tahminAyarlari = { vadeliYenile: true };
  const toggle = document.getElementById('tbk-vadeli-yenile-toggle');
  DB.tahminAyarlari.vadeliYenile = !!(toggle && toggle.checked);
  saveData();
  renderTahminBakiye();
}

// ---- (2. tur refactor: 02-core-app-engine.js'den taşındı) ----
export var _tbkFaizDuzenlemeId = null;

// ── TBK ay-detay tablosu: satır render, sıralama, filtre, "daha fazla göster" ──
// (6. tur refactor / tbkAyDetayAc zincir konsolidasyonu notu) Bu blok
// js/ui/pages/odeme.js'den buraya taşındı — TBK ay-detay mantığı zaten bu
// dosyanın (tbk-detay.js) konusu, ödeme modalıyla ilgisi yoktu. Taşıma
// nedeniyle window.tbkAyDetayAc, odeme.js'nin genel UI-refresh wrap
// listesinden çıkarıldı; onun yerine aynı efekt (scheduleTbkUiRefresh —
// bkz. odeme.js'deki window.FinansUiCoreRefresh) doğrudan
// openMonthlyDetail/tbkAyDetayFiltreUygula içine gömüldü. Bu dosyanın
// aşağıdaki mobil scroll/kozmetik wrap'leri ve app-core.js'nin ikon
// temizleme wrap'i hâlâ aynı window.tbkAyDetayAc referansını, dosya
// yükleme sırası korunduğu için sorunsuz wrap'liyor.
// [ES module geçişi] Bu blok birden fazla adaşı olan iç fonksiyonlar
// (boot, renderMonthly vb.) içerdiği için IIFE koruniyor — module top-level'a
// düz taşımak isim çakışmasına yol açar (dosyada aynı isimli 3 ayrı "boot"
// var). Dışa açılması gereken tek şey `openMonthlyDetail`; bunu IIFE
// dönüş değeri üzerinden export ediyoruz.
const _tbkMonthlyDetailApi = (function(){
  'use strict';

  function scheduleTbkUiRefresh(){
    try{
      if(FinansUiCoreRefresh && typeof FinansUiCoreRefresh.schedule === 'function'){
        FinansUiCoreRefresh.schedule();
      }
    }catch(e){}
  }

  const CFG = {
    storageKey: 'tbkAyDetaySiralamaV49',
    legacyStorageKey: 'tbkAyDetaySiralamaV47',
    defaultSort: 'tur-ozel',
    initialLimit: 180,
    loadStep: 180,
    hardLimit: 500,
    currency: 'TRY'
  };

  const TYPE_LIST = [
    type('maas', 10, 'Maaş', '💼', 'tbk-row-maas', function(c){ return hasAny(c.text, ['maaş','maas','💼']); }),
    type('kira-gelir', 20, 'Kira geliri', '🏠', 'tbk-row-kira-gelir', function(c){ return has(c.text, 'kira geliri'); }),
    type('elden-gelir', 30, 'Elden gelir', '✋', 'tbk-row-elden-gelir', function(c){ return c.amount > 0 && hasAny(c.text, ['elden','✋']); }),
    type('mevduat', 40, 'Mevduat', '🏦', 'tbk-row-mevduat', function(c){ return hasAny(c.text, ['mevduat faizi','ana para']); }),
    type('degerlendirme', 50, 'Değerlendirme', '📈', 'tbk-row-degerlendirme', function(c){ return hasAny(c.text, ['değerlendirme faizi','degerlendirme faizi','varsayım','varsayim']); }),
    type('kart-odeme', 60, 'Kart ödemesi', '💳', 'tbk-row-kart-odeme', function(c){ return has(c.text, 'kredi kartı ödemesi'); }),
    type('kart-ekstre', 70, 'Ekstre', '💳', 'tbk-row-kart-ekstre', function(c){ return has(c.text, 'ekstre ödemesi') || (has(c.text, 'ekstre') && has(c.text, 'kart')); }),
    type('kira-gider', 80, 'Kira gideri', '🏠', 'tbk-row-kira-gider', function(c){ return c.amount < 0 && has(c.text, 'kira'); }),
    type('abonelik', 90, 'Abonelik', '↻', 'tbk-row-abonelik', function(c){ return hasAny(c.text, ['abonelik','↻']); }),
    type('kredi', 100, 'Kredi', '💰', 'tbk-row-kredi', function(c){ return has(c.text, 'kredi taksiti'); }),
    type('kmh', 110, 'KMH', '📄', 'tbk-row-kmh', function(c){ return has(c.text, 'kmh'); }),
    type('elden-gider', 120, 'Elden gider', '✋', 'tbk-row-elden-gider', function(c){ return c.amount < 0 && hasAny(c.text, ['elden','✋']); }),
    type('bilgi', 130, 'Bilgi', 'ℹ️', 'tbk-row-bilgi', function(c){ return c.info; })
  ];

  const FALLBACK_TYPE = {
    income: type('gelir', 30, 'Gelir', '+', 'tbk-row-elden-gelir'),
    expense: type('gider', 120, 'Gider', '−', 'tbk-row-elden-gider'),
    other: type('diger', 999, 'Diğer', '•', 'tbk-row-diger')
  };

  const SORT_GROUPS = [
    group('Akıllı sıralama', [
      sort('tur-ozel', 'Türe göre özel sıra', 'Maaş, kira, elden, kart, kredi ve bilgi kayıtları kendi mantığında dizilir.', '✨'),
      sort('gelir-once', 'Gelirler önce', 'Pozitif kayıtlar üstte, kalanlar tarih sırasıyla devam eder.', '↗'),
      sort('gider-once', 'Giderler önce', 'Negatif kayıtlar üstte, kalanlar tarih sırasıyla devam eder.', '↘'),
      sort('bilgi-once', 'Bilgi kayıtları önce', 'Bakiyeyi değiştirmeyen bilgi satırlarını öne alır.', 'ℹ️'),
      sort('bilgi-sona', 'Bilgi kayıtları sonda', 'Bilgi satırlarını listenin sonuna taşır.', '⌄')
    ]),
    group('Tarih', [
      sort('tarih-yeni', 'En yeni tarih', 'Güncel kayıtlar en üstte görünür.', '🕘'),
      sort('tarih-eski', 'En eski tarih', 'Eski kayıtlar en üstte görünür.', '🕰')
    ]),
    group('Tutar', [
      sort('tutar-buyuk', 'Tutar büyükten küçüğe', 'Mutlak tutarı yüksek olan kayıtları öne alır.', '₺'),
      sort('tutar-kucuk', 'Tutar küçükten büyüğe', 'Mutlak tutarı düşük olan kayıtları öne alır.', '₺')
    ]),
    group('Metin', [
      sort('ad', 'Açıklama A-Z', 'Açıklamaya göre alfabetik sıralar.', 'A')
    ])
  ];

  const SORT_MAP = buildSortMap(SORT_GROUPS);
  let runtimeSort = '';
  // [ES module] Eskiden tbkLimit / _tbkAyDetayVeri /
  // _tbkAyDetayPb / _tbkAyDetayTumIslemler global'leri
  // üzerinden tutuluyordu; bu IIFE'nin tamamı tek bir closure olduğu için
  // (boot, renderMonthly, tbkAyDetayAc vb. hepsi burada) bunlar sadece
  // closure-scoped değişken olarak tutulabilir — window'a hiç gerek yok.
  let tbkLimit = CFG.initialLimit;
  let _tbkAyDetayVeri = null;
  let _tbkAyDetayPb = null;
  let _tbkAyDetayTumIslemler = [];

  function type(key, order, label, icon, cls, match){ return { key:key, order:order, label:label, icon:icon, cls:cls, match:match || function(){ return false; } }; }
  function sort(key, title, sub, icon){ return { key:key, title:title, sub:sub, icon:icon }; }
  function group(label, options){ return { label:label, options:options }; }
  function buildSortMap(groups){
    return groups.reduce(function(map, item){
      item.options.forEach(function(opt){ map[opt.key] = opt; opt.group = item.label; });
      return map;
    }, {});
  }
  function byId(id){ return document.getElementById(id); }
  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
    });
  }
  function lowerTR(value){ return String(value || '').toLocaleLowerCase('tr-TR'); }
  function has(text, needle){ return text.indexOf(needle) !== -1; }
  function hasAny(text, needles){ return needles.some(function(needle){ return has(text, needle); }); }
  function num(value){ const n = Number(value); return isFinite(n) ? n : 0; }
  function itemText(item){ return lowerTR([item && item.aciklama, item && item.detay].filter(Boolean).join(' ')); }
  function currency(){ return _tbkAyDetayPb || _tbkAylikPb || defaultCurrency || CFG.currency; }
  function fmtMoney(value, cur, signed){
    if(typeof fmtCur === 'function') return fmtCur(value, cur, !!signed);
    return num(value).toLocaleString('tr-TR', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' ' + (cur || CFG.currency);
  }
  function fmtDateSafe(dateText){
    try{
      return typeof fmtDate === 'function' ? fmtDate(new Date(String(dateText || '') + 'T00:00:00')) : String(dateText || '');
    }catch(err){ return String(dateText || ''); }
  }
  function dateCardHtml(dateText){
    const raw = String(dateText || '');
    const parts = raw.split('-');
    const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
    const day = parts.length >= 3 ? parts[2] : '';
    const monthIdx = parts.length >= 2 ? Number(parts[1]) - 1 : -1;
    const mon = monthIdx >= 0 && monthIdx < months.length ? months[monthIdx] : '';
    if(!day || !mon){
      const safe = esc(fmtDateSafe(raw));
      return '<span class="tbk-date-card tbk-date-card-fallback"><span class="tbk-date-day">' + safe + '</span></span>';
    }
    return '<span class="tbk-date-card"><span class="tbk-date-day">' + esc(day) + '</span><span class="tbk-date-mon">' + esc(mon) + '</span></span>';
  }
  function monthRange(data){
    if(!data || data.y == null || data.m == null) return null;
    const year = Number(data.y);
    const month = Number(data.m);
    if(!isFinite(year) || !isFinite(month)) return null;
    const mm = String(month + 1).padStart(2, '0');
    const lastDay = new Date(year, month + 1, 0).getDate();
    return {
      start: year + '-' + mm + '-01',
      end: year + '-' + mm + '-' + String(lastDay).padStart(2, '0')
    };
  }
  function findDateInput(id){
    return document.querySelector('#' + id + '[type="date"]') || byId(id);
  }
  function setSpecialDateInput(id, value){
    const el = findDateInput(id);
    if(!el) return false;
    el.removeAttribute('min');
    el.removeAttribute('max');
    if(typeof setDateInputValue === 'function'){
      try{ setDateInputValue(el, value || ''); }
      catch(err){ setDateInputValue(id, value || ''); }
    } else {
      el.value = value || '';
    }
    return true;
  }
  function fillDateInputs(force){
    const range = monthRange(_tbkAyDetayVeri);
    if(!range) return false;
    const basEl = findDateInput('tbk-ay-detay-bas');
    const bitEl = findDateInput('tbk-ay-detay-bit');
    if(!basEl && !bitEl) return false;
    const basEmpty = !basEl || !basEl.value;
    const bitEmpty = !bitEl || !bitEl.value;
    if(!force && !(basEmpty && bitEmpty)) return false;
    let ok = false;
    ok = setSpecialDateInput('tbk-ay-detay-bas', range.start) || ok;
    ok = setSpecialDateInput('tbk-ay-detay-bit', range.end) || ok;
    return ok;
  }
  function ensureDbSortStore(){
    if(!DB) return null;
    if(!DB.uiFiltreler || typeof DB.uiFiltreler !== 'object') DB.uiFiltreler = {};
    if(!DB.uiFiltreler.tbkAyDetay || typeof DB.uiFiltreler.tbkAyDetay !== 'object') DB.uiFiltreler.tbkAyDetay = {};
    if(!DB.uiFiltreler.transferLog || typeof DB.uiFiltreler.transferLog !== 'object') DB.uiFiltreler.transferLog = { filtre:[], status:'' };
    if(!Array.isArray(DB.uiFiltreler.transferLog.filtre)) DB.uiFiltreler.transferLog.filtre = DB.uiFiltreler.transferLog.filtre ? [DB.uiFiltreler.transferLog.filtre] : [];
    if(typeof DB.uiFiltreler.transferLog.status !== 'string') DB.uiFiltreler.transferLog.status = '';
    return DB.uiFiltreler.tbkAyDetay;
  }
  function currentSort(){
    const store = ensureDbSortStore();
    let value = store && store.sirala;
    if(!SORT_MAP[value] && DB && DB.uiFiltreler && DB.uiFiltreler.tbkAylikOzet) value = DB.uiFiltreler.tbkAylikOzet.sirala;
    if(SORT_MAP[value]){
      runtimeSort = value;
      return value;
    }
    if(SORT_MAP[runtimeSort]) return runtimeSort;
    try{
      value = localStorage.getItem(CFG.storageKey) || localStorage.getItem(CFG.legacyStorageKey) || '';
    }catch(err){ value = ''; }
    if(SORT_MAP[value]){
      runtimeSort = value;
      if(store){
        store.sirala = value;
        if(typeof saveData === 'function') saveData();
      }
      return value;
    }
    return CFG.defaultSort;
  }
  function saveSort(value){
    const safe = SORT_MAP[value] ? value : CFG.defaultSort;
    runtimeSort = safe;
    const store = ensureDbSortStore();
    if(store){
      store.sirala = safe;
      // Geriye dönük/olası eski okuyucular için aynı tercih alias olarak da tutulur.
      // Ana kaynak yine DB.uiFiltreler.tbkAyDetay.sirala'dır.
      DB.uiFiltreler.tbkAylikOzet = DB.uiFiltreler.tbkAylikOzet || {};
      DB.uiFiltreler.tbkAylikOzet.sirala = safe;
    }
    try{
      localStorage.removeItem(CFG.storageKey);
      localStorage.removeItem(CFG.legacyStorageKey);
    }catch(err){}
    if(store && typeof saveData === 'function') saveData();
    return safe;
  }
  function getType(item){
    item = item || {};
    const ctx = { item:item, text:itemText(item), amount:num(item.tutar), info:!!item.bilgiKalemi };
    if(ctx.info && has(ctx.text, 'kredi kartı ödemesi')) return TYPE_LIST.filter(function(t){ return t.key === 'kart-odeme'; })[0] || FALLBACK_TYPE.other;
    for(let i = 0; i < TYPE_LIST.length; i++) if(TYPE_LIST[i].match(ctx)) return TYPE_LIST[i];
    return ctx.amount > 0 ? FALLBACK_TYPE.income : (ctx.amount < 0 ? FALLBACK_TYPE.expense : FALLBACK_TYPE.other);
  }
  function displayAmount(item){ return item && item.bilgiKalemi ? Math.abs(num(item.gosterilenTutar != null ? item.gosterilenTutar : item.tutar)) : num(item && item.tutar); }
  function absDisplayAmount(item){ return Math.abs(displayAmount(item)); }
  function mevduatDayRank(item){
    const text = itemText(item);
    // Aynı gün içinde: önce Ana Para (dönüşü/yenilemesi), hemen altında Mevduat
    // Faizi, sonra o günün diğer kayıtları — böylece ilişkili çift alt alta ve
    // günün en üstünde görünür.
    if(has(text, 'ana para')) return 0;
    if(has(text, 'mevduat faizi')) return 1;
    return 2;
  }
  function baseCompare(a, b){
    const ad = String(a && a.tarih || ''), bd = String(b && b.tarih || '');
    if(ad !== bd) return ad.localeCompare(bd);
    const ar = mevduatDayRank(a), br = mevduatDayRank(b);
    if(ar !== br) return ar - br;
    return String(a && a.aciklama || '').localeCompare(String(b && b.aciklama || ''), 'tr');
  }
  function compareRows(a, b){
    const mode = currentSort();
    const at = getType(a), bt = getType(b);
    const aa = num(a && a.tutar), ba = num(b && b.tutar);
    const ai = !!(a && a.bilgiKalemi), bi = !!(b && b.bilgiKalemi);
    const comparators = {
      'tur-ozel': function(){ return (at.order - bt.order) || baseCompare(a, b); },
      'gelir-once': function(){ return ((ba > 0) - (aa > 0)) || (at.order - bt.order) || baseCompare(a, b); },
      'gider-once': function(){ return ((aa >= 0) - (ba >= 0)) || (at.order - bt.order) || baseCompare(a, b); },
      'bilgi-once': function(){ return ((bi ? 1 : 0) - (ai ? 1 : 0)) || baseCompare(a, b); },
      'bilgi-sona': function(){ return ((ai ? 1 : 0) - (bi ? 1 : 0)) || baseCompare(a, b); },
      'tarih-yeni': function(){ return String(b && b.tarih || '').localeCompare(String(a && a.tarih || '')) || baseCompare(a, b); },
      'tarih-eski': function(){ return baseCompare(a, b); },
      'tutar-buyuk': function(){ return (absDisplayAmount(b) - absDisplayAmount(a)) || baseCompare(a, b); },
      'tutar-kucuk': function(){ return (absDisplayAmount(a) - absDisplayAmount(b)) || baseCompare(a, b); },
      'ad': function(){ return String(a && a.aciklama || '').localeCompare(String(b && b.aciklama || ''), 'tr') || baseCompare(a, b); }
    };
    return (comparators[mode] || comparators[CFG.defaultSort])();
  }
  function normalizeRange(){
    const basEl = findDateInput('tbk-ay-detay-bas');
    const bitEl = findDateInput('tbk-ay-detay-bit');
    let bas = basEl ? basEl.value : '';
    let bit = bitEl ? bitEl.value : '';
    if(bas && bit && bas > bit){
      const tmp = bas; bas = bit; bit = tmp;
      if(basEl && typeof setDateInputValue === 'function') setDateInputValue(basEl, bas); else if(basEl) basEl.value = bas;
      if(bitEl && typeof setDateInputValue === 'function') setDateInputValue(bitEl, bit); else if(bitEl) bitEl.value = bit;
    }
    return { start:bas, end:bit };
  }
  function collectRows(source, range){
    const summary = { income:0, expense:0 };
    const rows = [];
    (source || []).forEach(function(item){
      if(!item) return;
      const date = String(item.tarih || '');
      if((range.start && date < range.start) || (range.end && date > range.end)) return;
      const amount = num(item.tutar);
      if(amount > 0) summary.income += amount;
      else if(amount < 0) summary.expense += Math.abs(amount);
      if(rows.length < CFG.hardLimit) rows.push(item);
    });
    rows.sort(compareRows);
    return { rows:rows, summary:summary, limited:rows.length >= CFG.hardLimit };
  }
  function amountHtml(item, cur){
    const isInfo = !!(item && item.bilgiKalemi);
    const raw = displayAmount(item);
    const cls = isInfo ? 'info' : (raw < 0 ? 'neg' : (raw > 0 ? 'pos' : ''));
    const text = isInfo ? fmtMoney(Math.abs(raw), cur, false) : fmtMoney(raw, cur, true);
    return '<span class="mono ' + cls + '">' + esc(text) + '</span>'
      + (isInfo ? '<div class="tbk-ay-detay-detay" style="text-align:right;margin-top:2px">Bakiyeyi değiştirmez</div>' : '');
  }
  function rowHtml(item, cur){
    const t = getType(item);
    const title = item && item.aciklama ? item.aciklama : '-';
    const sub = item && item.detay ? item.detay : '';
    const rowCls = ['tbk-row-item', t.cls, item && item.bilgiKalemi ? 'tbk-ay-detay-info-row' : ''].join(' ');
    return '<tr class="' + esc(rowCls) + '">'
      + '<td>' + dateCardHtml(item && item.tarih) + '</td>'
      + '<td><div class="tbk-ay-detay-main">'
      + '<div class="tbk-ay-detay-title-row"><div class="tbk-ay-detay-title">' + esc(title) + '</div>'
      + '<span class="tbk-type-chip"><span class="tbk-type-chip-ico">' + esc(t.icon) + '</span><span class="tbk-type-chip-text">' + esc(t.label) + '</span></span></div>'
      + (sub ? '<div class="tbk-ay-detay-sub">' + esc(sub) + '</div>' : '')
      + '</div></td>'
      + '<td class="tbk-ay-detay-amount">' + amountHtml(item, cur) + '</td>'
      + '</tr>';
  }
  function renderSummary(el, data, summary, cur){
    if(!el) return;
    const net = summary.income - summary.expense;
    el.innerHTML = '<div class="tbk-ay-detay-stat"><span>Gelir</span><b style="color:var(--teal)">+' + esc(fmtMoney(summary.income, cur, false)) + '</b></div>'
      + '<div class="tbk-ay-detay-stat"><span>Gider</span><b style="color:var(--rose)">-' + esc(fmtMoney(summary.expense, cur, false)) + '</b></div>'
      + '<div class="tbk-ay-detay-stat"><span>Net</span><b style="color:' + (net >= 0 ? 'var(--teal)' : 'var(--rose)') + '">' + esc(fmtMoney(net, cur, true)) + '</b></div>'
      + '<div class="tbk-ay-detay-stat"><span>Dönem Sonu Bakiye</span><b>' + esc(fmtMoney(data && data.bitisBakiye, cur, false)) + '</b></div>';
  }
  function renderMonthly(){
    ensureSortField();
    const data = _tbkAyDetayVeri;
    const tbody = byId('tbk-ay-detay-tbody');
    if(!data || !tbody) return;
    fillDateInputs(false);
    const range = normalizeRange();
    const cur = currency();
    const source = _tbkAyDetayTumIslemler || data.islemler || [];
    const result = collectRows(source, range);
    const limit = typeof tbkLimit === 'number' ? tbkLimit : CFG.initialLimit;
    const shown = result.rows.slice(0, limit);
    let html = shown.map(function(item){ return rowHtml(item, cur); }).join('');
    if(result.rows.length > limit){
      html += '<tr><td colspan="3"><button class="tbk-list-more-btn">+ ' + Math.min(CFG.loadStep, result.rows.length - limit) + ' kayıt daha göster</button></td></tr>';
    }
    if(result.limited){
      html += '<tr><td colspan="3"><div class="tbk-list-note">Liste sınırlandı. Tarihi daraltırsan daha hızlı açılır.</div></td></tr>';
    }
    tbody.innerHTML = html || '<tr><td colspan="3"><div class="tbk-list-note">Seçili tarih aralığında işlem bulunamadı.</div></td></tr>';
    // [ES module] onclick="tbkAyDetayDahaFazlaGoster()" kaldırıldı.
    const moreBtn = tbody.querySelector('.tbk-list-more-btn');
    if (moreBtn) moreBtn.addEventListener('click', () => tbkAyDetayDahaFazlaGoster());
    renderSummary(byId('tbk-ay-detay-ozet'), data, result.summary, cur);
    refreshSortTrigger();
  }
  function removeSortSelectIcon(){
    const field = byId('tbk-ay-detay-sort-field');
    if(!field) return;
    field.querySelectorAll('span.sel-icon').forEach(function(icon){ icon.remove(); });
    field.querySelectorAll('.select-wrap').forEach(function(wrap){
      if(wrap.querySelector('#tbk-ay-detay-sirala')) wrap.style.display = 'none';
    });
  }
  function ensureSortField(){
    const bar = document.querySelector('#modal-tbk-ay-detay .tbk-ay-detay-tarih-bar');
    if(!bar) return null;
    let field = byId('tbk-ay-detay-sort-field');
    if(!field){
      field = document.createElement('div');
      field.id = 'tbk-ay-detay-sort-field';
      field.className = 'tbk-ay-detay-sort-field';
      field.innerHTML = '';
      bar.appendChild(field);
    }
    let select = byId('tbk-ay-detay-sirala');
    if(!select){
      select = document.createElement('select');
      select.id = 'tbk-ay-detay-sirala';
      select.setAttribute('data-no-reset', '');
      field.appendChild(select);
    }
    select.innerHTML = sortOptionsHtml();
    select.value = currentSort();
    if(!select._tbkV49Bound){
      select.addEventListener('change', function(){ chooseSort(this.value, false); });
      select._tbkV49Bound = true;
    }
    let trigger = byId('tbk-sort-trigger');
    if(!trigger){
      trigger = document.createElement('button');
      trigger.id = 'tbk-sort-trigger';
      trigger.type = 'button';
      trigger.className = 'tbk-sort-trigger';
      trigger.addEventListener('click', function(event){
        event.preventDefault();
        event.stopPropagation();
        openSortPopup();
      });
      field.appendChild(trigger);
    }
    refreshSortTrigger();
    removeSortSelectIcon();
    setTimeout(removeSortSelectIcon, 0);
    return field;
  }
  function sortOptionsHtml(){
    let html = '';
    SORT_GROUPS.forEach(function(g){
      html += '<optgroup label="' + esc(g.label) + '">';
      g.options.forEach(function(o){ html += '<option value="' + esc(o.key) + '">' + esc(o.title) + '</option>'; });
      html += '</optgroup>';
    });
    return html;
  }
  function refreshSortTrigger(){
    const trigger = byId('tbk-sort-trigger');
    if(!trigger) return;
    const meta = SORT_MAP[currentSort()] || SORT_MAP[CFG.defaultSort];
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = '<span class="tbk-sort-trigger-left">'
      + '<span class="tbk-sort-trigger-copy"><span class="tbk-sort-trigger-title">' + esc(meta.title) + '</span><span class="tbk-sort-trigger-sub">' + esc(meta.sub) + '</span></span></span>'
      + '<span class="tbk-sort-trigger-chevron">⌄</span>';
  }
  function ensurePopup(){
    let popup = byId('tbk-sort-popup');
    if(popup) return popup;
    popup = document.createElement('div');
    popup.id = 'tbk-sort-popup';
    popup.className = 'tbk-sort-popup-backdrop';
    popup.addEventListener('click', function(event){ if(event.target === popup) closeSortPopup(); });
    document.body.appendChild(popup);
    document.addEventListener('keydown', function(event){ if(event.key === 'Escape') closeSortPopup(); });
    return popup;
  }
  function popupOptionsHtml(){
    const active = currentSort();
    return SORT_GROUPS.map(function(g){
      const options = g.options.map(function(o){
        return '<button type="button" class="tbk-sort-option ' + (o.key === active ? 'active' : '') + '" data-sort="' + esc(o.key) + '">'
          + '<span class="tbk-sort-option-left"><span class="tbk-sort-option-icon">' + esc(o.icon) + '</span><span class="tbk-sort-option-main"><span class="tbk-sort-option-title">' + esc(o.title) + '</span><span class="tbk-sort-option-sub">' + esc(o.sub) + '</span></span></span>'
          + '<span class="tbk-sort-option-check">✓</span></button>';
      }).join('');
      return '<div class="tbk-sort-popup-group"><div class="tbk-sort-popup-group-title">' + esc(g.label) + '</div>' + options + '</div>';
    }).join('');
  }
  function openSortPopup(){
    const popup = ensurePopup();
    const trigger = byId('tbk-sort-trigger');
    if(trigger) trigger.setAttribute('aria-expanded', 'true');
    popup.innerHTML = '<div class="tbk-sort-popup-panel" role="dialog" aria-modal="true" aria-label="Sıralama seç">'
      + '<div class="tbk-sort-popup-head"><div><div class="tbk-sort-popup-kicker">Aylık detay</div><div class="tbk-sort-popup-title">Sıralama seç</div></div><button type="button" class="tbk-sort-popup-close" aria-label="Kapat">×</button></div>'
      + '<div class="tbk-sort-popup-list">' + popupOptionsHtml() + '</div></div>';
    popup.querySelector('.tbk-sort-popup-close').addEventListener('click', closeSortPopup);
    popup.querySelectorAll('.tbk-sort-option').forEach(function(btn){
      btn.addEventListener('click', function(event){
        event.preventDefault();
        event.stopPropagation();
        chooseSort(this.getAttribute('data-sort'), true);
      });
    });
    popup.classList.add('open');
  }
  function closeSortPopup(){
    const popup = byId('tbk-sort-popup');
    const trigger = byId('tbk-sort-trigger');
    if(popup) {
      popup.classList.remove('open');
      // normalizeSortPopup() açılışta popup.style.display = 'flex' set ediyor;
      // bu inline stil temizlenmezse dıştaki !important CSS kuralı
      // ([style*="display: flex"] eşleşmesi) popup'ı .open class'ı silinmiş
      // olsa bile açık gösterip kapanmayı engelliyordu.
      popup.style.display = 'none';
      popup.style.visibility = '';
      popup.style.pointerEvents = 'none';
    }
    if(trigger) trigger.setAttribute('aria-expanded', 'false');
  }
  function chooseSort(value, close){
    const selected = saveSort(value);
    const select = byId('tbk-ay-detay-sirala');
    if(select) select.value = selected;
    tbkLimit = CFG.initialLimit;
    refreshSortTrigger();
    if(close) closeSortPopup();
    renderMonthly();
  }
  function boot(){
    ensureSortField();
    const ths = document.querySelectorAll('#modal-tbk-ay-detay thead th');
    if(ths && ths[2]) ths[2].textContent = '';
  }

  const tbkAyDetayTurBilgisiV49 = getType;
  const tbkAyDetaySiralamaDegisti = function(value){ chooseSort(value, false); };
  const tbkAyDetayFiltreUygula = function(){ tbkLimit = CFG.initialLimit; renderMonthly(); scheduleTbkUiRefresh(); };
  const tbkAyDetayDahaFazlaGoster = function(){ tbkLimit = (typeof tbkLimit === 'number' ? tbkLimit : CFG.initialLimit) + CFG.loadStep; renderMonthly(); };
  if(FinansPaymentUiHelpers) FinansPaymentUiHelpers.renderTbkDetail = renderMonthly;

  const MONTH_NAMES = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

  function monthlyRows(){ return Array.isArray(_tbkAylikVeriler) ? _tbkAylikVeriler : []; }
  function monthDataByKey(ayKey){
    const list = monthlyRows();
    for(let i = 0; i < list.length; i++) if(list[i] && list[i].ayKey === ayKey) return list[i];
    return null;
  }
  function setMonthlyTitle(data){
    const title = byId('tbk-ay-detay-baslik');
    if(!title || !data) return;
    const monthName = MONTH_NAMES[Number(data.m)] || '';
    title.textContent = (monthName ? monthName + ' ' : '') + (data.y || '');
  }
  function setMonthlyState(data){
    tbkLimit = CFG.initialLimit;
    _tbkAyDetayVeri = data;
    _tbkAyDetayPb = _tbkAylikPb || defaultCurrency || CFG.currency;
    _tbkAyDetayTumIslemler = Array.isArray(data && data.islemler) ? data.islemler : [];
  }
  function openMonthlyModal(){
    const id = 'modal-tbk-ay-detay';
    const modal = byId(id);
    if(!modal) return false;
    try{
      if(typeof openModal === 'function') openModal(id);
      else throw new Error('openModal yok');
    }catch(err){
      modal.classList.add('open');
      document.body.classList.add('modal-open');
      try{ if(typeof _sidebarDim === 'function') _sidebarDim(true); }catch(e){}
    }
    return true;
  }
  function stabilizeMonthlyPopup(){
    boot();
    fillDateInputs(true);
    renderMonthly();
  }
  function openMonthlyDetail(ayKey){
    const data = typeof ayKey === 'object' && ayKey ? ayKey : monthDataByKey(ayKey);
    if(!data) return false;

    setMonthlyState(data);
    setMonthlyTitle(data);
    boot();
    fillDateInputs(true);
    renderMonthly();
    openMonthlyModal();

    setTimeout(stabilizeMonthlyPopup, 0);
    setTimeout(stabilizeMonthlyPopup, 80);
    if(typeof requestAnimationFrame === 'function') requestAnimationFrame(stabilizeMonthlyPopup);
    scheduleTbkUiRefresh();
    return true;
  }

  const api = {
    render: renderMonthly,
    refresh: boot,
    getType: getType,
    getSort: currentSort,
    setSort: function(value){ chooseSort(value, false); },
    fillDates: function(force){ return fillDateInputs(force !== false); },
    getDateRange: function(){ return monthRange(_tbkAyDetayVeri); },
    open: openMonthlyDetail,
    tbkAyDetayAc: openMonthlyDetail,
    tbkAyDetayTarihleriDoldur: function(force){ return fillDateInputs(force !== false); },
    tbkAyDetayTarihSifirla: function(){
      fillDateInputs(true);
      tbkLimit = CFG.initialLimit;
      renderMonthly();
    },
    tbkAyDetayTurBilgisiV49,
    tbkAyDetaySiralamaDegisti,
    tbkAyDetayFiltreUygula,
    tbkAyDetayDahaFazlaGoster
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  return api;
})();

export const TbkMonthlyDetailUI = _tbkMonthlyDetailApi;
export const tbkAyDetayAc = _tbkMonthlyDetailApi.tbkAyDetayAc;
export const tbkAyDetayTarihleriDoldur = _tbkMonthlyDetailApi.tbkAyDetayTarihleriDoldur;
export const tbkAyDetayTarihSifirla = _tbkMonthlyDetailApi.tbkAyDetayTarihSifirla;
export const tbkAyDetayTurBilgisiV49 = _tbkMonthlyDetailApi.tbkAyDetayTurBilgisiV49;
export const tbkAyDetaySiralamaDegisti = _tbkMonthlyDetailApi.tbkAyDetaySiralamaDegisti;
export const tbkAyDetayFiltreUygula = _tbkMonthlyDetailApi.tbkAyDetayFiltreUygula;
export const tbkAyDetayDahaFazlaGoster = _tbkMonthlyDetailApi.tbkAyDetayDahaFazlaGoster;

// Bu fonksiyonlar app-core.js ve odeme patch'leri tarafından zincirleme wrap
// ediliyor (bkz. core/wrap-registry.js). Taban tanımlar burada register
// ediliyor; wrap eden modüller get() ile mevcut hâli alıp yeniden register
// eder, çağıranlar call('tbkAyDetayAc', ...) ile her zaman en güncel katmanı
// çalıştırır.
register('tbkAyDetayAc', tbkAyDetayAc);
register('tbkAyDetaySiralamaDegisti', tbkAyDetaySiralamaDegisti);
register('tbkAyDetayFiltreUygula', tbkAyDetayFiltreUygula);

// ── Mevduat vade yaklaşınca hesap durumu/rozet düzeltmeleri ────────────────
// [BUG FIX] normalizeAllDeposits aşağıdaki IIFE'nin closure'ı içinde tanımlı
// (export edilemez); eskiden installRenderOzetMevduatHook() window.renderOzet'i
// monkey-patch ederek her renderOzet() çağrısından önce bunu tetikliyordu.
// Ama renderOzet artık ozet.js'de gerçek export function ve hiç window'a
// atanmıyor (window.renderOzet = ... satırı önceki temizlik turunda kaldırıldı
// çünkü kimsenin okumadığı sanılmıştı) — bu yüzden typeof W.renderOzet ===
// 'function' hep false dönüyor ve hook HİÇ kurulmuyordu: mevduatlar özet
// ekranına yaklaşan ödeme olarak düşmeden önce hiç normalize edilmiyordu.
// Artık normalizeAllDeposits modül-üstü let değişkenine atanıp export
// ediliyor; ozet.js kendi renderOzet()'inin başında doğrudan çağırıyor.
let normalizeAllDeposits;
(function(){
  'use strict';

  const W = window;
  const DOC = document;
  const DAY_MS = 86400000;

  // [BUG FIX] Eskiden `function db(){ return W.DB || {}; }` idi. window.DB
  // artık hiç set edilmediği için (gerçek DB, state.js'in export ettiği
  // modül binding'i) bu her zaman {} dönüyordu — list() de bu yüzden hep
  // boş dizi dönüyor, mevduat vade/rozet düzeltmeleri hiç çalışmıyordu.
  function db(){ return DB || {}; }
  function list(){ return Array.isArray(db().mevduatlar) ? db().mevduatlar : []; }
  function todayKey(){ return localDateStr(new Date()); }
  function dateKey(d){
    if(!(d instanceof Date) || isNaN(d)) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return y + '-' + m + '-' + day;
  }
  function normalizeDate(value){
    if(!value) return '';
    if(value instanceof Date) return dateKey(value);
    const s = String(value).trim();
    if(!s) return '';
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(iso) return iso[1] + '-' + iso[2] + '-' + iso[3];
    const tr = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if(tr) return tr[3] + '-' + String(tr[2]).padStart(2,'0') + '-' + String(tr[1]).padStart(2,'0');
    const d = new Date(s);
    return isNaN(d) ? '' : dateKey(d);
  }
  function maturityKey(m){
    return normalizeDate(m && (m.bitis || m.bitisTarihi || m.vadeTarihi || m.vadeSonu || m.sonTarih || m.tarih));
  }
  function statusValue(m){
    return String((m && m.odDurum && m.odDurum.durum) || m.durum || '').toLowerCase();
  }
  function ledgerTransferValue(m){
    if(!m || !m.id || typeof W._lKey !== 'function' || typeof W._lGet !== 'function') return null;
    try { return W._lGet(W._lKey('mevduat', m.id, null)); }
    catch(e){ return null; }
  }
  function isPaidStatus(m){
    const od = m && m.odDurum;
    if(typeof W.odOdendiMi === 'function') {
      try { if(W.odOdendiMi(od)) return true; } catch(e) {}
    }
    const st = statusValue(m);
    return st === 'odendi' || st === 'ödendi' || st === 'tamamlandi' || st === 'tamamlandı';
  }
  function hasTransferEvidence(m){
    if(!m) return false;
    if(isPaidStatus(m)) return true;
    if(ledgerTransferValue(m) != null) return true;
    return !!(m.vadesizeAktarildi || m.vadesizeAktarıldı || m.aktarildi || m.aktarıldı || m.vadesizeAktarimTarihi || m.vadesizeAktarımTarihi);
  }
  function isExplicitCancel(m){
    if(!m) return false;
    const st = statusValue(m);
    return st === 'iptal' || st === 'cancelled' || st === 'canceled';
  }
  function isDeletedFlag(m){
    return !!(m && (m._silindi || m.silindi || m.deleted || m._deleted));
  }
  function isManualEarlyClose(m, todayStr){
    if(!m) return false;
    if(isDeletedFlag(m)) return true;
    if(isExplicitCancel(m)) return true;
    if(m._erkenKapatildi || m.erkenKapatildi || m.erkenKapandi || m.erkenKapandı) return true;
    const closeType = String(m.kapatmaTipi || m.kapanisTipi || m.kapanışTipi || m.closeType || '').toLowerCase();
    if(closeType === 'erken' || closeType === 'iptal' || closeType === 'manual' || closeType === 'manuel') return true;

    // _kapatildi çok anlamlı kullanılıyor: vadesi dolan/vadesize aktarılan kayıtta da set ediliyor.
    // Bu yüzden sadece henüz vade günü gelmeden kapanmış ve aktarım/ödendi kanıtı yoksa erken kapatma say.
    const bitis = maturityKey(m);
    if(m._kapatildi && !hasTransferEvidence(m) && bitis && bitis > todayStr) return true;
    return false;
  }
  function ensurePaidForTransferred(m){
    if(!m || !hasTransferEvidence(m)) return false;
    if(isPaidStatus(m)) return false;
    if(isExplicitCancel(m)) return false;
    const amount = m.nihai != null ? m.nihai : (m.tutar != null ? m.tutar : 0);
    m.odDurum = {
      durum: 'odendi',
      tarih: normalizeDate(m.bitis) || todayKey(),
      tutar: amount,
      not: 'Vadesize aktarıldı'
    };
    return true;
  }
  function normalizeDeposit(m){
    if(!m) return false;
    let changed = false;
    const bitis = maturityKey(m);
    if(bitis && m.bitis !== bitis) { m.bitis = bitis; changed = true; }

    // Eski/bozuk kayıtlarda deleteMevduat sadece odDurum=iptal bırakmış olabilir.
    // Bunu açık erken kapatma bayrağına çeviriyoruz ki ileride helper değişse bile sızmasın.
    if(isExplicitCancel(m)) {
      if(!m._erkenKapatildi) { m._erkenKapatildi = true; changed = true; }
      if(!m.kapatmaTipi) { m.kapatmaTipi = 'iptal'; changed = true; }
    }

    if(ensurePaidForTransferred(m)) changed = true;
    return changed;
  }
  normalizeAllDeposits = function(save){
    let changed = false;
    list().forEach(function(m){ if(normalizeDeposit(m)) changed = true; });
    if(changed && save) {
      try { saveData(); } catch(e) { console.warn('Mevduat normalize save hata:', e); }
    }
    return changed;
  };
  function visibleInUpcoming(m, todayStr){
    todayStr = todayStr || todayKey();
    if(!m) return false;
    const bitis = maturityKey(m);
    if(!bitis) return false;

    // Gerçekten silinen / vade bitmeden kapatılan / iptal edilen kayıt yaklaşan ödemeye düşmez.
    if(isManualEarlyClose(m, todayStr)) return false;

    // Vadesi biten, vadesize aktarılan veya ödendi işaretli kayıtlar görünür.
    // Aktif gelecekteki mevduatlar da vade satırı olarak görünür.
    return true;
  }
  function installRenderOzetMevduatHook(){
    if(typeof W.renderOzet !== 'function' || W.renderOzet._mevduatUpcomingWrapped) return;
    const oldRender = W.renderOzet;
    W.renderOzet = function(){
      normalizeAllDeposits(false);
      return oldRender.apply(this, arguments);
    };
    W.renderOzet._mevduatUpcomingWrapped = true;
  }
  function boot(){
    W.mevduatYaklasanOdemedeGoster = function(m, todayStr){
      return visibleInUpcoming(m, todayStr || todayKey());
    };
    W.mevduatYaklasanOdemedeGoster._mevduatUpcomingWrapped = true;
    W.mevduatYaklasanNormalizeEt = function(save){ return normalizeAllDeposits(save !== false); };
    W.mevduatYaklasanDurum = function(m){
      const t = todayKey();
      return {
        bitis: maturityKey(m),
        odendi: isPaidStatus(m),
        aktarildi: hasTransferEvidence(m),
        iptal: isExplicitCancel(m),
        erkenKapandi: isManualEarlyClose(m, t),
        gorunur: visibleInUpcoming(m, t)
      };
    };
    normalizeAllDeposits(false);
    installRenderOzetMevduatHook();
  }

  if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
  W.addEventListener('load', boot, { once:true });
})();
export { normalizeAllDeposits };

// ── TBK ay-detay tablosu / plan tablosu satır normalize etme (mobil) ──────
(function(){
  'use strict';

  // [ES module] window.__tbkMobileScrollTransferPlanInstalled bayrağı
  // kaldırıldı — ES modülleri yalnızca bir kez evaluate edilir.

  // Bu bloktan kaldırılan scroll-lock (hasOpenModal/lockBody/unlockBody/
  // syncScrollLock) ve transfer-modalı yıldız temizleme
  // (removeTransferRequiredBits) mantığı aşağıdaki modal-scroll-fix bloğuna
  // taşındı — orası aynı işi daha kapsamlı yapıyor (bkz. o bloğun başındaki
  // not). Burada sadece bu iki normalize fonksiyonu kaldı, çünkü aşağıdaki
  // bloğun bunlara karşılığı yok (farklı DOM hedefliyorlar).

  function normalizeTbkRows(){
    const modal = document.getElementById('modal-tbk-ay-detay');
    if(!modal) return;

    modal.querySelectorAll('.tbk-ay-row,.tbk-detail-row,.tbk-month-row,.tbk-row-item,[data-tbk-row]').forEach(function(row){
      row.style.maxWidth = '100%';
      row.style.minWidth = '0';
      row.querySelectorAll('.tbk-desc,.tbk-row-desc,.tbk-row-title,.tbk-title,.tbk-note,.tbk-aciklama,.tbk-description,.desc,.note,[data-tbk-desc],[data-tbk-aciklama]').forEach(function(el){
        el.style.overflowWrap = 'anywhere';
        el.style.wordBreak = 'break-word';
        el.style.whiteSpace = 'normal';
        el.style.minWidth = '0';
        el.style.maxWidth = '100%';
      });
    });
  }

  function normalizePlanTables(){
    document.querySelectorAll('#page-kmhkredi table,#page-kredi table,#modal-kmh table,#modal-kredi table,.kmh-modal table,.kredi-modal table').forEach(function(table){
      table.style.tableLayout = 'fixed';
      table.style.width = '100%';
      table.querySelectorAll('tr').forEach(function(tr){
        const cells = tr.children;
        if(!cells || !cells.length) return;
        cells[0].classList.add('plan-taksit');
        cells[cells.length - 1].classList.add('plan-tutar');
      });
    });
  }

  function afterUiChange(){
    normalizeTbkRows();
    normalizePlanTables();
  }

  function wrap(name){
    const old = window[name];
    if(typeof old !== 'function' || old._tbkMobileScrollWrapped) return;

    window[name] = function(){
      const result = old.apply(this, arguments);
      setTimeout(afterUiChange, 0);
      return result;
    };
    window[name]._tbkMobileScrollWrapped = true;
  }

  [
    'showPage',
    'renderTransfer',
    'renderParaTransferleri',
    'renderTransferLog',
    'openTransferModal',
    'tbkAyDetayAc',
    'renderTbkAyDetay',
    'tbkAyDetayRender',
    'renderKmhKredi',
    'renderKredi',
    'openModal',
    'closeModal',
    'modalAc',
    'modalKapat',
    'openPopup',
    'closePopup'
  ].forEach(wrap);

  document.addEventListener('click', function(){
    setTimeout(afterUiChange, 0);
  }, true);

  function boot(){
    afterUiChange();
    setTimeout(afterUiChange, 160);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  window.addEventListener('load', boot, { once:true });
})();

// ── Mobil modal scroll-lock + transfer/plan/işlem geçmişi kozmetik düzeltmeleri ──
(function(){
  'use strict';
  // [ES module] window.__tbkModalScrollFixInstalled bayrağı kaldırıldı —
  // ES modülleri yalnızca bir kez evaluate edilir.

  let lastScrollY = 0;
  function qsa(root, sel){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function visibleModalCount(){ return qsa(document, '.modal-bg.open,.modal.open,.popup.open,.drawer.open,.modal-bg[style*="display: flex"],.modal-bg[style*="display:flex"]').length; }

  function unlockBody(){
    const body=document.body; if(!body) return;
    body.classList.remove('rf-modal-scroll-locked');
    if(!visibleModalCount()) body.classList.remove('modal-open');
    const top=body.style.top;
    body.style.position=''; body.style.inset=''; body.style.top=''; body.style.left=''; body.style.right=''; body.style.width=''; body.style.height=''; body.style.overflow='';
    if(top && /^-\d+px$/.test(top)){ try{ window.scrollTo(0, Math.abs(parseInt(top,10)) || lastScrollY || 0); }catch(e){} }
  }
  function lockBody(){
    const body=document.body; if(!body || window.innerWidth>768) return;
    if(body.classList.contains('rf-modal-scroll-locked')) return;
    lastScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    body.classList.add('rf-modal-scroll-locked');
    body.style.position='fixed'; body.style.top='-'+lastScrollY+'px'; body.style.left='0'; body.style.right='0'; body.style.width='100%'; body.style.height='100dvh'; body.style.overflow='hidden';
  }
  function syncBodyLock(){
    if(window.innerWidth>768){ unlockBody(); return; }
    if(visibleModalCount()) lockBody(); else unlockBody();
  }

  function removeTransferAsterisks(){
    const modal=document.getElementById('modal-transfer');
    if(!modal) return;
    qsa(modal,'.transfer-hidden-account-label').forEach(function(el){ el.remove(); });
    qsa(modal,'label,.field-label,.form-label,.msec-label').forEach(function(el){
      const txt=(el.textContent||'').trim();
      if(txt==='*'){ el.classList.add('rf-required-star-only'); el.remove(); return; }
      if((/Kaynak|Hedef/i).test(txt) && txt.indexOf('*')>-1){
        qsa(el,'span').forEach(function(sp){ if((sp.textContent||'').trim()==='*') sp.remove(); });
        el.innerHTML = el.innerHTML.replace(/\s*\*\s*/g,' ');
      }
    });
  }

  function normalizeTransferLogRows(){
    const list=document.getElementById('transfer-log-liste');
    if(!list) return;
    qsa(list,':scope > div').forEach(function(row){
      if(!row.querySelector || !row.querySelector('button')) return;
      // Eski (pre-compact) sistemin class'ını sil — aksi halde part-039.css'teki
      // .rf-transfer-row !important grid kuralları, part-037.css'teki
      // .rf-transfer-row-compact grid kurallarıyla aynı elemanda çakışıyor.
      row.classList.remove('rf-transfer-row');
      row.classList.add('rf-transfer-row-compact');
      row.removeAttribute('style');
      const kids=Array.prototype.slice.call(row.children);
      const main=kids[0], amount=kids[1], act=kids[2];
      if(main){
        main.classList.remove('main');
        main.classList.add('rf-transfer-compact-main');
        main.style.cssText='';
        if(main.children[0]) { main.children[0].classList.remove('route'); main.children[0].classList.add('rf-transfer-compact-route'); main.children[0].style.cssText=''; }
        if(main.children[1]) { main.children[1].classList.remove('note'); main.children[1].classList.add('rf-transfer-compact-note'); main.children[1].style.cssText=''; }
      }
      if(amount){ amount.classList.remove('amount'); amount.classList.add('rf-transfer-compact-amount'); amount.style.cssText=''; }
      // Butonlar satırın doğrudan çocuğu değil, üçüncü çocuk olan .act DIV'inin
      // içinde (torun). Eski filtre bunu hiç yakalamıyordu; artık .act div'inin
      // kendisini rf-transfer-compact-actions'a çeviriyoruz ve stale class'ı siliyoruz.
      if(act){
        act.classList.remove('act');
        act.classList.add('rf-transfer-compact-actions');
        act.style.cssText='';
        Array.prototype.slice.call(act.querySelectorAll('button')).forEach(function(b){ b.style.cssText=''; });
      } else {
        const buttons=kids.filter(function(x){ return x && x.tagName==='BUTTON'; });
        if(buttons.length && !row.querySelector('.rf-transfer-compact-actions')){
          const wrap=document.createElement('div'); wrap.className='rf-transfer-compact-actions';
          buttons[0].parentNode.insertBefore(wrap, buttons[0]);
          buttons.forEach(function(b){ b.style.cssText=''; wrap.appendChild(b); });
        }
      }
    });
  }

  function normalizeTbkLongText(){
    const modal=document.getElementById('modal-tbk-ay-detay'); if(!modal) return;
    qsa(modal,'.tbk-ay-detay-scroll td:nth-child(2),.tbk-ay-detay-detay').forEach(function(el){
      el.style.overflowWrap='anywhere'; el.style.wordBreak='break-word'; el.style.whiteSpace='normal'; el.style.minWidth='0'; el.style.maxWidth='100%';
    });
  }

  function normalizePlanRows(){
    qsa(document,'.tp-wrap .tp-row').forEach(function(row){
      row.classList.add('rf-taksit-row-compact');
      const amount=row.querySelector('input[data-taksit-field="tutar"],.tp-input-tutar');
      if(amount){ amount.classList.add('rf-taksit-amount-compact'); amount.setAttribute('inputmode','decimal'); }
      const no=row.querySelector('.tp-no'); if(no) no.classList.add('rf-taksit-no-compact');
    });
  }

  function refresh(){
    removeTransferAsterisks();
    normalizeTransferLogRows();
    normalizeTbkLongText();
    normalizePlanRows();
    syncBodyLock();
  }

  // [ES module] Eskiden burada 11 fonksiyon window[name] üzerinden dinamik
  // olarak wrap ediliyordu. Hepsi core/wrap-registry.js üzerinden — taban
  // tanımları register eden modüller zaten kendi dosyalarında register()
  // çağırıyor (bkz. transfer-modal.js, krediler/03-kmh-kredi.js,
  // krediler/04-bireysel-kredi.js, tbk-detay.js üstü, modal-genel.js);
  // openModal/closeModal/showPage ise kendi mevcut mekanizmaları üzerinden
  // (modal-genel.js export'ları sabit, showPage ise getShowPage/setShowPage
  // mutable pointer'ı ile) ayrıca wrap ediliyor.
  function wrapDirect(fn){
    if(typeof fn !== 'function' || fn._tbkModalScrollFixWrapped) return fn;
    const wrapped = function(){
      const r = fn.apply(this, arguments);
      setTimeout(refresh,0); setTimeout(refresh,120);
      return r;
    };
    wrapped._tbkModalScrollFixWrapped = true;
    return wrapped;
  }
  function wrapRegistryAction(name){
    const old = get(name);
    if(typeof old !== 'function' || old._tbkModalScrollFixWrapped) return;
    register(name, wrapDirect(old));
  }

  // [ES module] Bu kurulum bloğu (wrapRegistryAction çağrıları +
  // wrapShowPage) eskiden senkron/top-level çalışıyordu. tbk-detay.js,
  // app-core-base.js'in dolaylı import zincirinde olduğu için (04-tbk-faiz-
  // oranlari.js üzerinden çift yönlü import var), bu blok modül grafiği tam
  // değerlendirilmeden çalışırsa getShowPage/setShowPage (_currentShowPage)
  // henüz initialize olmamış olabiliyor → "Cannot access ... before
  // initialization". setTimeout(...,0) ile bir sonraki task'a erteleyerek
  // tüm modüllerin yüklenmesini garanti ediyoruz.
  setTimeout(function installTbkModalScrollFixWraps(){
    ['openTransferModal','renderTransferLog','tbkAyDetayAc','tbkAyDetayFiltreUygula','calcKmhKredi','calcKredi','renderKmhKredi','renderKredi'].forEach(wrapRegistryAction);
    (function wrapShowPage(){
      const old = getShowPage();
      if(typeof old !== 'function' || old._tbkModalScrollFixWrapped) return;
      setShowPage(wrapDirect(old));
    })();
    wrapRegistryAction('openModal');
    wrapRegistryAction('closeModal');
  }, 0);

  document.addEventListener('click', function(){ setTimeout(refresh,0); }, true);
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') setTimeout(refresh,80); }, true);
  window.addEventListener('resize', function(){ setTimeout(refresh,60); }, {passive:true});
  window.addEventListener('orientationchange', function(){ setTimeout(refresh,120); }, {passive:true});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ refresh(); setTimeout(refresh,200); }, {once:true});
  else { refresh(); setTimeout(refresh,200); }
  window.addEventListener('load', function(){ refresh(); setTimeout(refresh,250); }, {once:true});
})();

// [ES module] Bu dosyada tanımlanan aşağıdaki değişkenler başka dosyalarda
// yeniden atanıyordu (import edilen bir binding'e doğrudan atama ES
// module'de yasaktır). Bu setter fonksiyonları o davranışı korumak için
// eklendi - ilgili dosyalar artık `X = v` yerine `setX(v)` çağırıyor.
export function set_tbkFaizDuzenlemeId(v) { _tbkFaizDuzenlemeId = v; }
