import { saveData } from '@core/app-core-base.js';
import { fmt, fmtCur, uid } from '@core/format.js';
import { ALL_CURRENCIES, CURRENCY_CONFIG, DB, defaultCurrency } from '@core/state.js';
import { rebuildAllCurrencies } from '@domain/doviz.js';
import { showToast } from '@components/modal-genel.js';
import { getMoneyInput, setMoneyInput } from '@components/money-input.js';
import { _restoreAsgariKuralPbFiltreFromDB } from '@components/tablo-filtre-sirala.js';
// Orijinal 02-core-app-engine.js içinden çıkarıldı. İçerik değiştirilmedi.

// ==== 02-core-app-engine.js'den taşınan modül state'i ====
export var ASGARI_KOSUL_LABELS = {
  limit_max:  'Kart limiti ≤',
  limit_min:  'Kart limiti >',
  limit_gte:  'Kart limiti ≥',
  limit_lt:   'Kart limiti <',
  limit_eq:   'Kart limiti =',
  borc_max:   'Dönem borcu ≤',
  borc_min:   'Dönem borcu >',
  borc_gte:   'Dönem borcu ≥',
  borc_lt:    'Dönem borcu <',
  borc_eq:    'Dönem borcu =',
  her_zaman:  'Her zaman'
};
export function asgariSyncEsikMoneyWraps() {
  const code = getAsgariEsikPb();
  const cfg = (typeof CURRENCY_CONFIG !== 'undefined' && CURRENCY_CONFIG[code]) || {};
  const sym = cfg.symbol || code;
  ['asgari-esik', 'asgari-min-tutar'].forEach(id => {
    const inp = document.getElementById(id);
    const wrap = inp && inp.closest('.money-wrap');
    if(!wrap) return;
    wrap.dataset.symbol = sym;
    wrap.dataset.code = code;
  });
}

export function asgariEsikPbChange() {
  asgariSyncEsikMoneyWraps();
  asgariFormDegisti();
}

export function asgariFormDegisti() {
  const tur = asgariFormTur();
  const esik = tur !== 'her_zaman' ? (getMoneyInput('asgari-esik')||0) : null;
  const esikParaBirimi = tur !== 'her_zaman' ? getAsgariEsikPb() : null;
  const paraBirimleri = getAsgariCurGridValue();
  asgariUyariGuncelle({tur, esik, esikParaBirimi, paraBirimleri});
}

export function asgariKosulTurChange() {
  const alan = document.getElementById('asgari-kosul-alan').value;
  const opWrap = document.getElementById('asgari-kosul-op-wrap');
  const esikWrap = document.getElementById('asgari-esik-wrap');
  const hide = alan === 'her_zaman';
  opWrap.style.display = hide ? 'none' : '';
  esikWrap.style.display = hide ? 'none' : '';
  asgariFormDegisti();
}

export function asgariFormTur() {
  const alan = document.getElementById('asgari-kosul-alan').value;
  if(alan === 'her_zaman') return 'her_zaman';
  const op = document.getElementById('asgari-kosul-op').value; // max(≤) | min(>) | gte(≥) | lt(<) | eq(=)
  return `${alan}_${op}`;
}

export function asgariParaBirimleriKesisiyorMu(a, b) {
  const pbA = (a.paraBirimleri && a.paraBirimleri.length) ? a.paraBirimleri : null;
  const pbB = (b.paraBirimleri && b.paraBirimleri.length) ? b.paraBirimleri : null;
  if(!pbA || !pbB) return true; // biri "tüm para birimleri" ise her zaman kesişir
  return pbA.some(c=>pbB.includes(c));
}

export function asgariKurallarCakisiyorMu(a, b) {
  if(a.tur === 'her_zaman' || b.tur === 'her_zaman') return false;
  const [alanA, opA] = a.tur.split('_');
  const [alanB, opB] = b.tur.split('_');
  if(alanA !== alanB) return false;
  if(!asgariParaBirimleriKesisiyorMu(a, b)) return false;
  // Aynı eşik değeri ve aynı yön ise → birebir aynı koşul, ikincisi asla tetiklenmez
  if(a.esik === b.esik && opA === opB) return true;
  return false;
}

export function asgariUyariGuncelle(yeniKural) {
  const el = document.getElementById('asgari-uyari-wrap');
  if(!el) return;
  const list = DB.asgariOdemeKurallari||[];
  let msgs = [];

  if(yeniKural) {
    list.forEach((k, i) => {
      if(asgariKurallarCakisiyorMu(yeniKural, k)) {
        msgs.push(`Bu kural, <b>${i+1}. sıradaki</b> "${ASGARI_KOSUL_LABELS[k.tur]||k.tur}${k.esik!=null?' '+fmt(k.esik):''}" kuralıyla aynı koşulu kapsıyor. ${i===0?'O kural önce çalışacağı için bu kural hiç tetiklenmeyebilir.':''}`);
      }
    });
    // her_zaman kuralından sonra eklenen kurallar (ortak para biriminde) hiç çalışmaz
    const herZamanIdx = list.findIndex(k=>k.tur==='her_zaman' && asgariParaBirimleriKesisiyorMu(k, yeniKural));
    if(herZamanIdx > -1) {
      msgs.push(`Listede <b>"Her zaman"</b> kuralı (${herZamanIdx+1}. sırada) bulunuyor — bu kural ondan sonra geleceği için hiçbir zaman çalışmayacak. "Her zaman" kuralını en alta taşıyın.`);
    }

    // Eşik tutarı para birimi, kuralın geçerli olduğu para birimlerinden biri değilse uyar
    if(yeniKural.esikParaBirimi && yeniKural.paraBirimleri && yeniKural.paraBirimleri.length
       && !yeniKural.paraBirimleri.includes(yeniKural.esikParaBirimi)) {
      msgs.push(`Eşik tutarı <b>${yeniKural.esikParaBirimi}</b> olarak girildi, ancak kural sadece <b>${yeniKural.paraBirimleri.join(', ')}</b> için geçerli. Karşılaştırma, kartın ilgili dönemdeki tutarıyla <b>doğrudan</b> (birim çevrimi yapılmadan) yapılacaktır — eşik tutarını ${yeniKural.paraBirimleri.join('/')} cinsinden girmeniz önerilir.`);
    }
  }

  if(!msgs.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div style="margin-bottom:12px;padding:10px 12px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.25);border-radius:var(--radius-sm);font-size:12px;color:#fbbf24;display:flex;gap:8px;align-items:flex-start">
    <span style="flex-shrink:0">⚠️</span><div>${msgs.join('<br>')}</div>
  </div>`;
}

export function asgariShake(id) {
  const el = document.getElementById(id);
  if(!el) return;
  el.classList.add('field-error', 'shake');
  setTimeout(()=>el.classList.remove('shake'), 400);
  el.addEventListener('input', () => el.classList.remove('field-error'), { once: true });
}

export function asgariKuralEkle() {
  const tur       = asgariFormTur();
  const esikEl    = document.getElementById('asgari-esik');
  const oranEl    = document.getElementById('asgari-oran');
  const esikBos   = (esikEl.value || '').trim() === '';
  const oran      = parseFloat(oranEl.value);
  const esik      = tur !== 'her_zaman' ? (getMoneyInput('asgari-esik')||0) : null;
  const minTut    = getMoneyInput('asgari-min-tutar')||0;
  const acik      = document.getElementById('asgari-aciklama').value.trim();
  const esikPb    = getAsgariEsikPb();
  const paraBirimleri = getAsgariCurGridValue();

  let hataVar = false;
  if(isNaN(oran) || oran <= 0) { asgariShake('asgari-oran'); hataVar = true; }
  if(tur !== 'her_zaman' && esikBos) { asgariShake('asgari-esik'); hataVar = true; }
  if(hataVar) { showToast('Lütfen zorunlu alanları (*) doldurun', 'warn'); return; }

  const kural = { id: uid(), tur, esik, esikParaBirimi: tur!=='her_zaman' ? esikPb : null, oran, minTut, acik, paraBirimleri };
  if(!DB.asgariOdemeKurallari) DB.asgariOdemeKurallari = [];
  DB.asgariOdemeKurallari.push(kural);
  saveData();

  // Formu temizle
  setMoneyInput('asgari-esik', '');
  document.getElementById('asgari-oran').value = '';
  setMoneyInput('asgari-min-tutar', '');
  document.getElementById('asgari-aciklama').value = '';
  document.getElementById('asgari-uyari-wrap').innerHTML = '';
  renderAsgariCurGrid();
  renderAsgariEsikPbSelect();

  renderAsgariKurallar();
  asgariOnizle();
}

export function asgariKuralSil(id) {
  DB.asgariOdemeKurallari = (DB.asgariOdemeKurallari||[]).filter(k=>k.id!==id);
  saveData();
  renderAsgariKurallar();
  asgariOnizle();
}

export function asgariKuralYukar(id) {
  const list = DB.asgariOdemeKurallari||[];
  const idx = list.findIndex(k=>k.id===id);
  if(idx <= 0) return;
  [list[idx-1], list[idx]] = [list[idx], list[idx-1]];
  saveData(); renderAsgariKurallar(); asgariOnizle();
}

export function asgariKuralAsagi(id) {
  const list = DB.asgariOdemeKurallari||[];
  const idx = list.findIndex(k=>k.id===id);
  if(idx < 0 || idx >= list.length-1) return;
  [list[idx+1], list[idx]] = [list[idx], list[idx+1]];
  saveData(); renderAsgariKurallar(); asgariOnizle();
}

export function asgariKurallariTemizle() {
  if(!confirm('Tüm asgari ödeme kuralları silinsin mi?')) return;
  DB.asgariOdemeKurallari = [];
  saveData(); renderAsgariKurallar(); asgariOnizle();
}

export function asgariOnizle() {
  const el = document.getElementById('asgari-prev-sonuc');
  if(!el) return;
  const limit = getMoneyInput('asgari-prev-limit');
  const borc  = getMoneyInput('asgari-prev-borc');
  if(!limit && !borc) {
    el.innerHTML = '<span style="color:var(--text3)">Limit ve borç girerek kural sonucunu görün.</span>';
    return;
  }
  const sonuc = calcAsgariOdeme(limit, borc, document.getElementById('asgari-prev-pb')?.value || defaultCurrency);
  if(!sonuc) {
    el.innerHTML = '<span style="color:var(--text3)">⚠️ Hiçbir kural eşleşmedi — asgari ödeme gösterilmeyecek.</span>';
    return;
  }
  const kosulLabel = ASGARI_KOSUL_LABELS[sonuc.kural.tur]||sonuc.kural.tur;
  const esikStr = sonuc.kural.esik != null ? ` ${fmtCur(sonuc.kural.esik, sonuc.kural.esikParaBirimi || defaultCurrency)}` : '';
  const pbStr = (sonuc.kural.paraBirimleri && sonuc.kural.paraBirimleri.length) ? sonuc.kural.paraBirimleri.join(', ') : 'Tüm para birimleri';
  el.innerHTML = `<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
    <div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Eşleşen Kural</div>
      <span style="background:var(--surface3);border:1px solid var(--border2);border-radius:5px;padding:3px 10px;font-size:12px;font-family:var(--mono)">${kosulLabel}${esikStr}</span>
      <span style="font-size:11px;color:var(--text3);margin-left:8px">💱 ${pbStr}</span>
      ${sonuc.kural.acik ? `<span style="font-size:11px;color:var(--text3);margin-left:8px">${sonuc.kural.acik}</span>` : ''}
    </div>
    <div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Uygulanan Oran</div>
      <span style="font-family:var(--mono);font-weight:700;font-size:16px;color:#818cf8">%${sonuc.oran}</span>
    </div>
    <div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Asgari Ödeme Tutarı</div>
      <span style="font-family:var(--mono);font-weight:700;font-size:20px;color:var(--warn)">${fmtCur(sonuc.tutar, document.getElementById('asgari-prev-pb')?.value || defaultCurrency)}</span>
      ${sonuc.kural.minTut > 0 && (borc*(sonuc.oran/100)) < sonuc.kural.minTut ? `<span style="font-size:10px;color:var(--text3);margin-left:6px">(min. tutar uygulandı)</span>` : ''}
    </div>
  </div>`;
}


// Para birimi seçim chip grid (kural formu için)
export function renderAsgariCurGrid(selected=[]) {
  if(!ALL_CURRENCIES.length) rebuildAllCurrencies();
  const grid = document.getElementById('asgari-cur-grid');
  if(!grid) return;
  grid.innerHTML = ALL_CURRENCIES.map(c => {
    const isSel = selected.includes(c.code);
    return `<div class="cur-chip${isSel?' selected':''}" data-code="${c.code}">${c.flag} ${c.label}</div>`;
  }).join('');
  grid.querySelectorAll('.cur-chip').forEach(el => {
    el.addEventListener('click', () => toggleAsgariCur(el.dataset.code));
  });
}

export function toggleAsgariCur(code) {
  const chip = document.querySelector(`#asgari-cur-grid [data-code="${code}"]`);
  if(chip) chip.classList.toggle('selected');
  asgariFormDegisti();
}

export function getAsgariCurGridValue() {
  const chips = document.querySelectorAll('#asgari-cur-grid .cur-chip.selected');
  return Array.from(chips).map(c=>c.dataset.code);
}

// Eşik tutarı / minimum tutar para birimi seçici
export function renderAsgariEsikPbSelect(selected=null) {
  if(!ALL_CURRENCIES.length) rebuildAllCurrencies();
  const grid = document.getElementById('asgari-esik-pb-grid');
  if(!grid) return;
  const sel = selected || defaultCurrency;
  grid.dataset.selected = sel;
  grid.innerHTML = ALL_CURRENCIES.map(c =>
    `<div class="esik-pb-chip${c.code===sel?' selected':''}" data-code="${c.code}">${c.flag} ${c.code}</div>`
  ).join('');
  grid.querySelectorAll('.esik-pb-chip').forEach(el => {
    el.addEventListener('click', () => selectAsgariEsikPb(el.dataset.code));
  });
  asgariSyncEsikMoneyWraps();
}

export function selectAsgariEsikPb(code) {
  const grid = document.getElementById('asgari-esik-pb-grid');
  if(!grid) return;
  grid.dataset.selected = code;
  grid.querySelectorAll('.esik-pb-chip').forEach(c => c.classList.toggle('selected', c.dataset.code === code));
  asgariEsikPbChange();
}

export function getAsgariEsikPb() {
  const grid = document.getElementById('asgari-esik-pb-grid');
  return (grid && grid.dataset.selected) || defaultCurrency;
}

export function renderAsgariKuralPbFiltre() {
  _restoreAsgariKuralPbFiltreFromDB();
  const grid = document.getElementById('asgari-kural-pb-filtre-grid');
  if(!grid) return;
  if(!ALL_CURRENCIES.length) rebuildAllCurrencies();
  const tumChip = `<div class="esik-pb-chip${!_asgariKuralPbFiltre?' selected':''}" data-code="">Tümü</div>`;
  const chips = ALL_CURRENCIES.map(c =>
    `<div class="esik-pb-chip${_asgariKuralPbFiltre===c.code?' selected':''}" data-code="${c.code}">${c.flag} ${c.code}</div>`
  ).join('');
  grid.innerHTML = tumChip + chips;
  grid.querySelectorAll('.esik-pb-chip').forEach(el => {
    el.addEventListener('click', () => selectAsgariKuralPbFiltre(el.dataset.code));
  });
}

export function selectAsgariKuralPbFiltre(code) {
  _asgariKuralPbFiltre = code || null;
  if(!DB.uiFiltreler) DB.uiFiltreler = {};
  if(!DB.uiFiltreler.asgariKurallari) DB.uiFiltreler.asgariKurallari = {};
  if(DB.uiFiltreler.asgariKurallari.pb !== _asgariKuralPbFiltre) { DB.uiFiltreler.asgariKurallari.pb = _asgariKuralPbFiltre; saveData(); }
  renderAsgariKurallar();
}

export function renderAsgariKurallar() {
  renderAsgariKuralPbFiltre();
  const el = document.getElementById('asgari-kural-listesi');
  if(!el) return;
  const list = DB.asgariOdemeKurallari||[];
  if(!list.length) {
    el.innerHTML = '<div style="padding:28px;text-align:center;color:var(--text3);font-size:13px">Henüz kural eklenmedi. Yukarıdan kural ekleyin.</div>';
    return;
  }
  const pbFiltre = _asgariKuralPbFiltre;

  const rows = list.map((k, i) => {
    const isFirst = i === 0;
    const isLast  = i === list.length - 1;
    const kosulLabel = ASGARI_KOSUL_LABELS[k.tur] || k.tur;
    const esikStr = k.esik != null ? ` ${fmtCur(k.esik, k.esikParaBirimi || defaultCurrency)}` : '';
    const pbBadge = (k.paraBirimleri && k.paraBirimleri.length)
      ? k.paraBirimleri.map(c=>`<span style="background:rgba(45,212,191,.1);color:#2dd4bf;border:1px solid rgba(45,212,191,.2);border-radius:5px;padding:2px 7px;font-size:10px;font-weight:600;white-space:nowrap;margin-right:3px">${c}</span>`).join('')
      : `<span style="color:var(--text3);font-size:11px">Tümü</span>`;

    // Seçili önizleme para birimine göre bu kural değerlendirmeye girer mi?
    const calisirMi = !pbFiltre || !k.paraBirimleri || !k.paraBirimleri.length || k.paraBirimleri.includes(pbFiltre);
    const calismaRozeti = pbFiltre
      ? (calisirMi
          ? `<div style="margin-top:3px"><span style="font-size:9.5px;font-weight:600;color:var(--teal)">✓ ${pbFiltre} için değerlendirilir</span></div>`
          : `<div style="margin-top:3px"><span style="font-size:9.5px;font-weight:600;color:var(--text3)">✕ ${pbFiltre} için atlanır</span></div>`)
      : '';

    // Öncelik rozeti — 1. kural en yüksek
    let priBadge;
    if(i === 0)
      priBadge = `<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(251,191,36,.18);color:#fbbf24;border:1px solid rgba(251,191,36,.3);border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700;white-space:nowrap">★ P1 En Yüksek</span>`;
    else if(i === list.length - 1 && list.length > 1)
      priBadge = `<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(100,116,139,.12);color:var(--text3);border:1px solid var(--border2);border-radius:5px;padding:2px 7px;font-size:10px;font-weight:600;white-space:nowrap">P${i+1} En Düşük</span>`;
    else
      priBadge = `<span style="display:inline-flex;align-items:center;background:rgba(79,110,247,.1);color:#818cf8;border:1px solid rgba(79,110,247,.2);border-radius:5px;padding:2px 7px;font-size:10px;font-weight:600;white-space:nowrap">P${i+1}</span>`;

    // Ok butonları — SVG ikonlu, disabled durumda soluk
    const upBtn = `<button class="asgari-kural-yukar" data-id="${k.id}"
      ${isFirst ? 'disabled' : ''}
      title="Önceliği Artır (Yukarı Taşı)"
      style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;background:${isFirst?'transparent':'var(--surface3)'};border:1px solid ${isFirst?'transparent':'var(--border2)'};border-radius:6px;cursor:${isFirst?'default':'pointer'};opacity:${isFirst?'.25':'1'};transition:all .15s;color:var(--text2)"
      onmouseover="if(!this.disabled)this.style.background='var(--surface2)'"
      onmouseout="this.style.background='${isFirst?'transparent':'var(--surface3)'}'">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 9.5V2.5M6 2.5L2.5 6M6 2.5L9.5 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>`;

    const downBtn = `<button class="asgari-kural-asagi" data-id="${k.id}"
      ${isLast ? 'disabled' : ''}
      title="Önceliği Azalt (Aşağı Taşı)"
      style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;background:${isLast?'transparent':'var(--surface3)'};border:1px solid ${isLast?'transparent':'var(--border2)'};border-radius:6px;cursor:${isLast?'default':'pointer'};opacity:${isLast?'.25':'1'};transition:all .15s;color:var(--text2)"
      onmouseover="if(!this.disabled)this.style.background='var(--surface2)'"
      onmouseout="this.style.background='${isLast?'transparent':'var(--surface3)'}'">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2.5V9.5M6 9.5L9.5 6M6 9.5L2.5 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>`;

    const delBtn = `<button class="asgari-kural-sil" data-id="${k.id}"
      title="Kuralı Sil"
      style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;background:transparent;border:1px solid transparent;border-radius:6px;cursor:pointer;color:var(--text3);transition:all .15s"
      onmouseover="this.style.background='rgba(251,113,133,.12)';this.style.color='var(--danger)';this.style.borderColor='rgba(251,113,133,.2)'"
      onmouseout="this.style.background='transparent';this.style.color='var(--text3)';this.style.borderColor='transparent'">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M5 3V2h2v1M4.5 3v6.5h3V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>`;

    return `<tr style="border-bottom:1px solid var(--border);${isFirst?'background:rgba(251,191,36,.03)':''}${pbFiltre && !calisirMi ? ';opacity:.4' : ''}">
      <td style="padding:10px 12px;vertical-align:middle">${priBadge}</td>
      <td style="padding:10px 12px;vertical-align:middle">
        <span style="background:var(--surface3);border:1px solid var(--border2);border-radius:5px;padding:3px 9px;font-size:11px;font-family:var(--mono);white-space:nowrap">${kosulLabel}${esikStr}</span>
      </td>
      <td style="padding:10px 12px;vertical-align:middle;white-space:nowrap">${pbBadge}${calismaRozeti}</td>
      <td style="padding:10px 12px;text-align:center;vertical-align:middle">
        <span style="background:rgba(79,110,247,.15);color:#818cf8;border-radius:5px;padding:3px 10px;font-weight:700;font-family:var(--mono);font-size:13px">%${k.oran}</span>
      </td>
      <td style="padding:10px 12px;text-align:right;font-family:var(--mono);font-size:12px;color:var(--text2);vertical-align:middle">${k.minTut > 0 ? fmtCur(k.minTut, k.esikParaBirimi || defaultCurrency) : '<span style="color:var(--text3)">—</span>'}</td>
      <td style="padding:10px 12px;font-size:12px;color:var(--text3);vertical-align:middle">${k.acik || '<span style="opacity:.4">—</span>'}</td>
      <td style="padding:10px 8px;vertical-align:middle">
        <div style="display:flex;align-items:center;gap:3px;justify-content:flex-end">
          ${upBtn}${downBtn}${delBtn}
        </div>
      </td>
    </tr>`;
  }).join('');

  const filtreOzet = pbFiltre
    ? (() => {
        const calisanSayi = list.filter(k => !k.paraBirimleri || !k.paraBirimleri.length || k.paraBirimleri.includes(pbFiltre)).length;
        const atlananSayi = list.length - calisanSayi;
        return ` &nbsp;·&nbsp; <b style="color:var(--gold)">${pbFiltre}</b> önizlemesi: <b style="color:var(--teal)">${calisanSayi} kural değerlendirilir</b>${atlananSayi ? `, <b>${atlananSayi} kural atlanır</b>` : ''}`;
      })()
    : '';

  el.innerHTML = `
    <div style="padding:8px 12px;background:var(--surface3);border-bottom:1px solid var(--border);font-size:10px;color:var(--text3);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.4"/><path d="M6 5v3M6 4h.01" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      Kurallar <b style="color:var(--text2)">yukarıdan aşağıya</b> değerlendirilir. İlk eşleşen kural uygulanır, geri kalanlar kontrol edilmez.${filtreOzet}
    </div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:var(--surface3);border-bottom:1px solid var(--border)">
        <th style="padding:8px 12px;text-align:left;color:var(--text3);font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700">Öncelik</th>
        <th style="padding:8px 12px;text-align:left;color:var(--text3);font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700">Koşul</th>
        <th style="padding:8px 12px;text-align:left;color:var(--text3);font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700">Para Birimi</th>
        <th style="padding:8px 12px;text-align:center;color:var(--text3);font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700">Oran</th>
        <th style="padding:8px 12px;text-align:right;color:var(--text3);font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700">Min. Tutar</th>
        <th style="padding:8px 12px;text-align:left;color:var(--text3);font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700">Açıklama</th>
        <th style="padding:8px 12px;text-align:right;color:var(--text3);font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700">Sıra</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;

  el.querySelectorAll('.asgari-kural-yukar').forEach(btn => {
    btn.addEventListener('click', () => asgariKuralYukar(btn.dataset.id));
  });
  el.querySelectorAll('.asgari-kural-asagi').forEach(btn => {
    btn.addEventListener('click', () => asgariKuralAsagi(btn.dataset.id));
  });
  el.querySelectorAll('.asgari-kural-sil').forEach(btn => {
    btn.addEventListener('click', () => asgariKuralSil(btn.dataset.id));
  });
}

// Verilen limit, borç ve para birimi için hangi kuralın uygulandığını hesapla
export function calcAsgariOdeme(limit, borc, paraBirimi=null) {
  const list = DB.asgariOdemeKurallari||[];
  for(const k of list) {
    // Para birimi filtresi: kuralda seçili para birimi yoksa tüm para birimleri için geçerlidir
    if(paraBirimi && k.paraBirimleri && k.paraBirimleri.length && !k.paraBirimleri.includes(paraBirimi)) continue;
    let eslesir = false;
    if(k.tur === 'her_zaman')   eslesir = true;
    else if(k.tur === 'limit_max') eslesir = limit <= k.esik;
    else if(k.tur === 'limit_min') eslesir = limit >  k.esik;
    else if(k.tur === 'limit_gte') eslesir = limit >= k.esik;
    else if(k.tur === 'limit_lt')  eslesir = limit <  k.esik;
    else if(k.tur === 'limit_eq')  eslesir = limit === k.esik;
    else if(k.tur === 'borc_max')  eslesir = borc  <= k.esik;
    else if(k.tur === 'borc_min')  eslesir = borc  >  k.esik;
    else if(k.tur === 'borc_gte')  eslesir = borc  >= k.esik;
    else if(k.tur === 'borc_lt')   eslesir = borc  <  k.esik;
    else if(k.tur === 'borc_eq')   eslesir = borc  === k.esik;
    if(eslesir) {
      const hesap = borc * (k.oran / 100);
      const tutar = k.minTut > 0 ? Math.max(hesap, k.minTut) : hesap;
      return { tutar, oran: k.oran, kural: k };
    }
  }
  return null;
}

// ---- (2. tur refactor: 02-core-app-engine.js'den taşındı) ----
// Tanımlı Kurallar tablosunda para birimine göre önizleme filtresi
export var _asgariKuralPbFiltre = null; // null = filtre kapalı (Tümü)

export var _asgariKuralPbFiltreRestored = false;

// [ES module] Bu dosyada tanımlanan aşağıdaki değişkenler başka dosyalarda
// yeniden atanıyordu (import edilen bir binding'e doğrudan atama ES
// module'de yasaktır). Bu setter fonksiyonları o davranışı korumak için
// eklendi - ilgili dosyalar artık `X = v` yerine `setX(v)` çağırıyor.
export function set_asgariKuralPbFiltreRestored(v) { _asgariKuralPbFiltreRestored = v; }
export function set_asgariKuralPbFiltre(v) { _asgariKuralPbFiltre = v; }

// ==== DUAL-MODE CONTAINER KAYDI ====
import { provide } from "@core/container.js";
import * as _self from "./asgari-odeme.js";
provide("ui.pages.asgariOdeme", _self);
