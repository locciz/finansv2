import { inject } from '@core/container.js';
const _coreState = inject('core.state');
const _kurServisleri = inject('services.kurServisleri');
import { renderParaBirimiGrid } from '@pages/tanimlamalar/06-para-birimi.js';
// ============================================================
// js/domain/doviz.js — Döviz çevrimi, para birimi renk paleti,
// para birimi select/dropdown doldurma yardımcıları
// ============================================================

// ── Para birimi vurgu renk paleti ──
// Nakit Bakiye kartında her para birimi tek bakışta ayırt edilebilsin diye
// sabit (bilinen kodlar) veya kod bazlı türetilmiş (bilinmeyen/özel kodlar) bir
// renk üretir — arka plan/kenarlık/metin tonları aynı hue'dan gelir.
export var PB_RENK_PALETI = {
  TRY: { bg:'rgba(251,191,36,.13)', border:'rgba(251,191,36,.38)', text:'#f5c451' },
  USD: { bg:'rgba(52,211,153,.13)', border:'rgba(52,211,153,.38)', text:'#34d399' },
  EUR: { bg:'rgba(96,165,250,.13)', border:'rgba(96,165,250,.38)', text:'#60a5fa' },
  GBP: { bg:'rgba(167,139,250,.13)', border:'rgba(167,139,250,.38)', text:'#a78bfa' },
  JPY: { bg:'rgba(248,113,113,.13)', border:'rgba(248,113,113,.38)', text:'#f87171' },
  XAU: { bg:'rgba(245,158,11,.15)', border:'rgba(245,158,11,.42)', text:'#f59e0b' }
};
export var _PB_RENK_FALLBACK_PALET = ['#38bdf8','#f472b6','#facc15','#4ade80','#c084fc','#fb923c','#2dd4bf','#fb7185'];
export function paraBirimiCevir(tutar, kaynakPb, hedefPb, tarihStr) {
  if (tutar === null || tutar === undefined || isNaN(tutar)) return 0;
  if (!kaynakPb || !hedefPb || kaynakPb === hedefPb) return tutar;

  // Kaynak -> TRY
  let tutarTry;
  if (kaynakPb === 'TRY') {
    tutarTry = tutar;
  } else {
    const kurKaynak = _kurServisleri.getTcmbKur(kaynakPb, tarihStr);
    const oranKaynak = kurKaynak && (kurKaynak.satis || kurKaynak.alis);
    if (!oranKaynak) return null; // kur bulunamadı — çevrilemez
    tutarTry = tutar * oranKaynak;
  }

  // TRY -> Hedef
  if (hedefPb === 'TRY') return tutarTry;
  const kurHedef = _kurServisleri.getTcmbKur(hedefPb, tarihStr);
  const oranHedef = kurHedef && (kurHedef.satis || kurHedef.alis);
  if (!oranHedef) return null;
  return tutarTry / oranHedef;
}

export function paraBirimiCevirGuvenli(tutar, kaynakPb, hedefPb, tarihStr) {
  const sonuc = paraBirimiCevir(tutar, kaynakPb, hedefPb, tarihStr);
  if (sonuc === null) {
    console.warn(`[pb-cevir] ${kaynakPb} \u2192 ${hedefPb} kuru bulunamadı, tutar çevrilmeden kullanıldı`);
    return tutar;
  }
  return sonuc;
}

export function pbRenkAl(pb) {
  const ozelRenk = _coreState.CURRENCY_CONFIG[pb] && _coreState.CURRENCY_CONFIG[pb].renk;
  if(ozelRenk) return { bg: ozelRenk+'22', border: ozelRenk+'55', text: ozelRenk };
  if(PB_RENK_PALETI[pb]) return PB_RENK_PALETI[pb];
  let hash = 0;
  for(let i=0;i<pb.length;i++) hash = (hash*31 + pb.charCodeAt(i)) >>> 0;
  const hex = _PB_RENK_FALLBACK_PALET[hash % _PB_RENK_FALLBACK_PALET.length];
  return { bg: hex+'22', border: hex+'55', text: hex };
}

export function buildCurrencyOptions(selectedCode) {
  return _coreState.ALL_CURRENCIES.map(c => {
    const cfg = _coreState.CURRENCY_CONFIG[c.code] || {};
    const ico = cfg.icon || cfg.flag || '';
    const ad  = cfg.ad || c.code;
    const sym = cfg.symbol || c.code;
    const sel = selectedCode && c.code === selectedCode ? ' selected' : '';
    return `<option value="${c.code}"${sel}>${ico} ${ad} (${sym})</option>`;
  }).join('');
}


// Bir <select>'i para birimi seçenekleriyle doldurur; mevcut seçili değeri
// korur (yoksa fallback'e döner). islem-para-birimi hariç tüm select'ler
// bu kalıbı kullanır (islem-para-birimi her zaman _coreState.defaultCurrency'e sabitlenir).
export function _fillCurrencySelectKeepingValue(id, opts, fallback) {
  const el = document.getElementById(id);
  if(!el) return;
  const prev = el.value;
  el.innerHTML = opts;
  el.value = prev || fallback;
}

export function populateCurrencySelects() {
  const opts = buildCurrencyOptions();
  // islem para birimi — her zaman _coreState.defaultCurrency'e sabitlenir (önceki değeri korumaz)
  const islemPb = document.getElementById('islem-para-birimi');
  if(islemPb) { islemPb.innerHTML = opts; islemPb.value = _coreState.defaultCurrency; }
  // varsayılan para birimi (chip grid)
  renderParaBirimiGrid();
  // diğer tüm formlar: mevcut seçimi koru, yoksa _coreState.defaultCurrency'e düş
  _fillCurrencySelectKeepingValue('mev-para-birimi', opts, _coreState.defaultCurrency);
  _fillCurrencySelectKeepingValue('kira-para-birimi-manual', opts, _coreState.defaultCurrency);
  _fillCurrencySelectKeepingValue('maas-para-birimi-manual', opts, _coreState.defaultCurrency);
  _fillCurrencySelectKeepingValue('hesap-para-birimi', opts, _coreState.defaultCurrency);
  _fillCurrencySelectKeepingValue('elden-para-birimi', opts, _coreState.defaultCurrency);
}

export function rebuildAllCurrencies() {
  _coreState.replaceObjectContents(_coreState.ALL_CURRENCIES, Object.keys(_coreState.CURRENCY_CONFIG).map(code => {
    const cfg = _coreState.CURRENCY_CONFIG[code];
    return {
      code,
      symbol: cfg.symbol || code,
      label: cfg.symbol + ' ' + code,
      flag: cfg.flag || '💱',
      ad: cfg.ad || code
    };
  }));
}

export function _fillPbManualSelect(selectId, currentCode) {
  const sel = document.getElementById(selectId);
  if(!sel) return;
  sel.innerHTML = buildCurrencyOptions();
  if(currentCode) sel.value = currentCode;
}

// ============================================================
// [DI-MIGRATION] domain.doviz — container'a kayıt
// ============================================================
import { provide } from '@core/container.js';
provide('domain.doviz', {
  paraBirimiCevir, paraBirimiCevirGuvenli, pbRenkAl, buildCurrencyOptions,
  _fillCurrencySelectKeepingValue, populateCurrencySelects, rebuildAllCurrencies,
  _fillPbManualSelect, PB_RENK_PALETI, _PB_RENK_FALLBACK_PALET,
});

