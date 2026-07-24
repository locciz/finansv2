import { saveData } from '../../core/app-core-base.js';
import { tblFiltreOkuMulti } from '../../core/app-core.js';
import { fmtCur, fmtDate, localDateStr } from '../../core/format.js';
import { ALL_CURRENCIES, CURRENCY_CONFIG, DB } from '../../core/state.js';
import { rebuildAllCurrencies } from '../../domain/doviz.js';
import { _updateTopbarBakiye } from '../../domain/hesap-entegrasyon-motoru.js';
import { _markFieldError, phSet, showToast } from './modal-genel.js';
import { bindMoneyInputs, getMoneyInput, setDateInputValue, setMoneyInput } from './money-input.js';
import { swizBakiyeHintGuncelle, swizOzetSatirHtmlKisa, swizUpdateStepIndicator } from './step-wizard.js';
import { hesapOptionMetin } from '../pages/hesaplar/01-genel-yardimcilar.js';
import { register, call } from '../../core/wrap-registry.js';
import { bankaIkonObj } from '../pages/tanimlamalar/01-genel-yardimcilar.js';
import { renderOzet } from '../pages/ozet.js';
import { closeModal, openModal } from './modal-genel.js';
import { renderHesaplar } from '../pages/hesaplar/04-hesap-liste-render.js';
// ============================================================
// js/ui/components/transfer-modal.js — Hesaplar arası / nakit
// transfer sihirbazı (3 adım: seçim → tutar → özet+kaydet) ve
// transfer geçmişi logu
// ============================================================

export function openTransferModal(kaynakHesapId) {
  // Kaynak olarak kullanılabilecek (bakiyesi > 0) hesap/nakit var mı kontrol et
  const aktifHesaplar = (DB.hesaplar || []).filter(h => h.durum === 'aktif' && h.tur !== 'vadeli');
  const varKaynakHesap = aktifHesaplar.some(h => (h.bakiye || 0) + (h.kmhLimit || 0) > 0);
  const nakitBakiyeler = DB._nakitBakiye || {};
  const varKaynakNakit = Object.values(nakitBakiyeler).some(b => b > 0);
  if (!varKaynakHesap && !varKaynakNakit) {
    showToast('Transfer yapılabilecek bakiyesi olan hesap bulunamadı', 'error');
    return;
  }

  // Belirli bir hesaptan açıldıysa, o hesabın (KMH dahil) kullanılabilir bakiyesi var mı kontrol et
  if (kaynakHesapId) {
    const kh = aktifHesaplar.find(h => h.id === kaynakHesapId);
    if (!kh || ((kh.bakiye || 0) + (kh.kmhLimit || 0)) <= 0) {
      showToast('Bu hesabın gönderilebilecek (KMH dahil) bakiyesi yok', 'error');
      return;
    }
  }

  transferStepGoto(1);
  setDateInputValue('transfer-tarih', localDateStr(new Date()));
  document.getElementById('transfer-kaynak-bilgi').innerHTML = '';
  document.getElementById('transfer-hedef-bilgi').innerHTML = '';
  document.getElementById('transfer-kaynak').innerHTML = '<option value="" disabled selected hidden>— Hesap Seçin —</option>';
  document.getElementById('transfer-hedef').innerHTML  = '<option value="" disabled selected hidden>— Hesap Seçin —</option>';
  _populateTransferHesaplar();
  if (kaynakHesapId) {
    const kSel = document.getElementById('transfer-kaynak');
    if (kSel) {
      kSel.value = kaynakHesapId;
      _populateTransferHesaplar();
      onTransferKaynakChange();
    }
  }
  _checkNakitNakit();
  call('renderTransferLog');
  openModal('modal-transfer');
  setTimeout(() => bindMoneyInputs(document.getElementById('modal-transfer')), 20);
}

// ── Hesap/Nakit seçim yardımcıları ────────────────────────────
// ── Hesap/Nakit seçim değerini ayrıştır ───────────────────────
// "nakit:USD" → {tip:'nakit', id:null, pb:'USD'} | "<hesapId>" → {tip:'hesap', id:..., pb:null}
export function _parseTransferSel(val) {
  if (!val) return { tip: null, id: null, pb: null };
  if (val.indexOf('nakit:') === 0) return { tip: 'nakit', id: null, pb: val.slice(6) };
  return { tip: 'hesap', id: val, pb: null };
}

// ── Nakit için gösterilecek para birimi listesi ───────────────
export function _nakitCurrencyList() {
  if (typeof ALL_CURRENCIES === 'undefined' || !ALL_CURRENCIES.length) {
    if (typeof rebuildAllCurrencies === 'function') rebuildAllCurrencies();
  }
  return (typeof ALL_CURRENCIES !== 'undefined' && ALL_CURRENCIES.length)
    ? ALL_CURRENCIES
    : [{ code: 'TRY', symbol: '₺', flag: '🇹🇷' }];
}

// ── Hesap + Nakit listelerini doldur (tek dropdown) ───────────
export function _populateTransferHesaplar() {
  const hesaplar = (DB.hesaplar || []).filter(h => h.durum === 'aktif' && h.tur !== 'vadeli');
  const curList  = _nakitCurrencyList();

  const kVal = document.getElementById('transfer-kaynak').value;
  const hVal = document.getElementById('transfer-hedef').value;
  const kInfo = _parseTransferSel(kVal);
  const hInfo = _parseTransferSel(hVal);

  const pbOf = (info) => {
    if (info.tip === 'hesap') { const h = hesaplar.find(x => x.id === info.id); return h ? (h.paraBirimi || 'TRY') : null; }
    if (info.tip === 'nakit') return info.pb;
    return null;
  };
  const kaynakPb = pbOf(kInfo);
  const hedefPb  = pbOf(hInfo);

  // Bir hesabın ek limit (KMH) dahil kullanılabilir bakiyesini hesapla
  const hesapKullanilabilirBakiye = (h) => (h.bakiye || 0) + (h.kmhLimit || 0);

  const makeKaynakOpts = (excludeVal, filterPb) => {
    // Kaynak: sadece ek limit dahil bakiyesi 0'dan büyük hesaplar listelenir
    const hesapOpts = hesaplar
      .filter(h => h.id !== excludeVal)
      .filter(h => !filterPb || (h.paraBirimi || 'TRY') === filterPb)
      .filter(h => hesapKullanilabilirBakiye(h) > 0)
      .map(h => `<option value="${h.id}">${hesapOptionMetin(h)}</option>`).join('');
    const nakitOpts = curList
      .filter(c => `nakit:${c.code}` !== excludeVal)
      .filter(c => !filterPb || c.code === filterPb)
      .filter(c => ((DB._nakitBakiye || {})[c.code] || 0) > 0)
      .map(c => `<option value="nakit:${c.code}">💵 Nakit — ${c.code} - Bakiye: ${fmtCur((DB._nakitBakiye || {})[c.code] || 0, c.code)}</option>`).join('');
    return (hesapOpts ? `<optgroup label="🏛️ Hesaplar">${hesapOpts}</optgroup>` : '')
      + (nakitOpts ? `<optgroup label="💵 Nakit">${nakitOpts}</optgroup>` : '');
  };

  const makeHedefOpts = (excludeVal, filterPb) => {
    const hesapOpts = hesaplar
      .filter(h => h.id !== excludeVal)
      .filter(h => !filterPb || (h.paraBirimi || 'TRY') === filterPb)
      .map(h => `<option value="${h.id}">${hesapOptionMetin(h)}</option>`).join('');
    const nakitOpts = curList
      .filter(c => `nakit:${c.code}` !== excludeVal)
      .filter(c => !filterPb || c.code === filterPb)
      .map(c => `<option value="nakit:${c.code}">💵 Nakit — ${c.code} - Bakiye: ${fmtCur((DB._nakitBakiye || {})[c.code] || 0, c.code)}</option>`).join('');
    return (hesapOpts ? `<optgroup label="🏛️ Hesaplar">${hesapOpts}</optgroup>` : '')
      + (nakitOpts ? `<optgroup label="💵 Nakit">${nakitOpts}</optgroup>` : '');
  };

  const kSel = document.getElementById('transfer-kaynak');
  const hSel = document.getElementById('transfer-hedef');
  // Kaynak: hedef seçiliyse aynı değeri ve (varsa) aynı para biriminden olanları göster; sadece bakiyesi > 0 hesaplar
  if (kSel) {
    const prev = kSel.value;
    kSel.innerHTML = makeKaynakOpts(hVal || '', hedefPb);
    phSet(kSel, '— Hesap Seçin —', prev, hedefPb ? '— Eşleşen hesap/nakit bulunamadı —' : '— Hesap bulunamadı —');
  }
  // Hedef: kaynak seçiliyse aynı değeri ve (varsa) aynı para biriminden olanları göster
  if (hSel) {
    const prev = hSel.value;
    hSel.innerHTML = makeHedefOpts(kVal || '', kaynakPb);
    phSet(hSel, '— Hesap Seçin —', prev, kaynakPb ? '— Eşleşen hesap/nakit bulunamadı —' : '— Hesap bulunamadı —');
  }
}

// ── Kaynak ve hedefi birbiriyle değiştir ──────────────────────
export function swapTransferHesaplar() {
  const kSel = document.getElementById('transfer-kaynak');
  const hSel = document.getElementById('transfer-hedef');
  if (!kSel || !hSel) return;
  const kVal = kSel.value;
  const hVal = hSel.value;

  // Kaynak seçili değilse engelle
  if (!kVal) { showToast('Lütfen önce kaynak hesabı seçin', 'error'); return; }

  // Kaynak hesabın bakiyesini (ek limit dahil) kontrol et
  const kInfo = _parseTransferSel(kVal);
  if (kInfo.tip === 'hesap') {
    const kHesap = (DB.hesaplar || []).find(h => h.id === kInfo.id);
    if (kHesap && ((kHesap.bakiye || 0) + (kHesap.kmhLimit || 0)) <= 0) {
      showToast('Kaynak hesabın kullanılabilir bakiyesi yetersiz', 'error');
      return;
    }
  } else if (kInfo.tip === 'nakit') {
    const nakitBak = (DB._nakitBakiye || {})[kInfo.pb] || 0;
    if (nakitBak <= 0) {
      showToast('Kaynak nakit bakiyesi yetersiz', 'error');
      return;
    }
  }

  if (!kVal && !hVal) { showToast('Değiştirilecek bir seçim yok', 'error'); return; }

  // Her iki select'i de karşılıklı filtre/exclude uygulamadan tüm seçeneklerle yeniden oluştur,
  // böylece karşı tarafın eski değeri her iki select'te de geçerli bir seçenek olur.
  const hesaplar = (DB.hesaplar || []).filter(h => h.durum === 'aktif' && h.tur !== 'vadeli');
  const curList  = _nakitCurrencyList();

  // Swap sonrası yeni kaynak (eski hedef) bakiye kontrolü
  const hInfo = _parseTransferSel(hVal);
  if (hInfo.tip === 'hesap') {
    const hHesap = hesaplar.find(h => h.id === hInfo.id);
    if (hHesap && ((hHesap.bakiye || 0) + (hHesap.kmhLimit || 0)) <= 0) {
      showToast('Hedef hesabın kullanılabilir bakiyesi yetersiz — tersine çevrilemez', 'error');
      return;
    }
  } else if (hInfo.tip === 'nakit') {
    const hBak = (DB._nakitBakiye || {})[hInfo.pb] || 0;
    if (hBak <= 0) {
      showToast('Hedef nakit bakiyesi yetersiz — tersine çevrilemez', 'error');
      return;
    }
  }

  // Kaynak için bakiyesi > 0 filtrelenmiş seçenekler, hedef için tüm seçenekler
  const kaynakFullOpts = () => {
    const ph = '<option value="" disabled selected hidden>— Hesap Seçin —</option>';
    const hesapOpts = hesaplar.filter(h => ((h.bakiye||0)+(h.kmhLimit||0)) > 0).map(h => `<option value="${h.id}">${hesapOptionMetin(h)}</option>`).join('');
    const nakitOpts = curList.filter(c => ((DB._nakitBakiye||{})[c.code]||0) > 0).map(c => `<option value="nakit:${c.code}">💵 Nakit — ${c.code}</option>`).join('');
    return ph
      + (hesapOpts ? `<optgroup label="🏛️ Hesaplar">${hesapOpts}</optgroup>` : '')
      + (nakitOpts ? `<optgroup label="💵 Nakit">${nakitOpts}</optgroup>` : '');
  };
  const hedefFullOpts = () => {
    const ph = '<option value="" disabled selected hidden>— Hesap Seçin —</option>';
    const hesapOpts = hesaplar.map(h => `<option value="${h.id}">${hesapOptionMetin(h)}</option>`).join('');
    const nakitOpts = curList.map(c => `<option value="nakit:${c.code}">💵 Nakit — ${c.code}</option>`).join('');
    return ph
      + (hesapOpts ? `<optgroup label="🏛️ Hesaplar">${hesapOpts}</optgroup>` : '')
      + (nakitOpts ? `<optgroup label="💵 Nakit">${nakitOpts}</optgroup>` : '');
  };
  kSel.innerHTML = kaynakFullOpts();
  hSel.innerHTML = hedefFullOpts();
  kSel.value = hVal;
  hSel.value = kVal;

  // Karşılıklı filtre/exclude mantığını ve bilgi alanlarını/tutar para birimini güncelle
  onTransferKaynakChange();
  onTransferHedefChange();

  // Buton dönme animasyonu
  const btn = document.getElementById('transfer-swap-btn');
  if (btn) {
    btn.classList.remove('spin');
    requestAnimationFrame(() => btn.classList.add('spin'));
  }
}

export function _checkNakitNakit() {
  const k = _parseTransferSel(document.getElementById('transfer-kaynak').value);
  const h = _parseTransferSel(document.getElementById('transfer-hedef').value);
  const sub = document.getElementById('transfer-modal-subtitle');
  if (!sub) return;
  if (!k.tip || !h.tip) {
    sub.textContent = 'Hesap veya nakit arası hareket'; sub.style.color = '';
  } else if (k.tip === 'nakit' && h.tip === 'nakit') {
    sub.textContent = '⚠️ İki nakit arasında transfer yapılamaz'; sub.style.color = 'var(--danger)';
  } else if (k.tip === 'hesap' && h.tip === 'hesap') {
    // Para birimi uyumu kontrolü
    const kH = (DB.hesaplar || []).find(x => x.id === k.id);
    const hH = (DB.hesaplar || []).find(x => x.id === h.id);
    if (kH && hH && (kH.paraBirimi || 'TRY') !== (hH.paraBirimi || 'TRY')) {
      sub.textContent = `⚠️ Para birimi uyuşmuyor: ${kH.paraBirimi||'TRY'} ↔ ${hH.paraBirimi||'TRY'}`;
      sub.style.color = 'var(--danger)';
    } else {
      sub.textContent = 'Hesaplar arası transfer'; sub.style.color = '';
    }
  } else if (k.tip === 'hesap' && h.tip === 'nakit') {
    sub.textContent = 'Hesaptan nakite çekme'; sub.style.color = '';
  } else {
    sub.textContent = 'Hesaba Nakit Yatırma'; sub.style.color = '';
  }
}

export function onTransferKaynakChange() {
  const info  = _parseTransferSel(document.getElementById('transfer-kaynak').value);
  const infoEl = document.getElementById('transfer-kaynak-bilgi');
  // NOT: bakiye / kullanılabilir bakiye artık seçim kutusunun (option) içinde
  // gösteriliyor (bkz. hesapOptionMetin / nakit option metni) — burada ayrıca
  // dışarıya label olarak tekrar yazılmıyor.
  infoEl.innerHTML = '';
  let pb = null;
  if (info.tip === 'hesap') {
    const hesap = (DB.hesaplar || []).find(h => h.id === info.id);
    if (hesap) pb = hesap.paraBirimi || 'TRY';
  } else if (info.tip === 'nakit') {
    pb = info.pb;
  }
  if (pb) {
    const wrap = document.getElementById('transfer-tutar-wrap');
    if (wrap) { wrap.dataset.symbol = pb === 'TRY' ? '₺' : pb; wrap.dataset.code = pb; }
  }
  // Hedef listesinden bu seçimi çıkar
  _populateTransferHesaplar();
  _checkNakitNakit();
  _updateTransferTutarTumBtn();
}

export function onTransferHedefChange() {
  const info  = _parseTransferSel(document.getElementById('transfer-hedef').value);
  const infoEl = document.getElementById('transfer-hedef-bilgi');
  // NOT: bakiye artık seçim kutusunun içinde gösteriliyor, dışarıda tekrar yazılmıyor.
  infoEl.innerHTML = '';
  // Kaynak listesinden bu seçimi çıkar
  _populateTransferHesaplar();
  _checkNakitNakit();
}

// ── Kaydet ───────────────────────────────────────────────────
// ── Transfer Modal: Step Wizard ──────────────────────────────────────
export let _transferCurrentStep = 1;
export const TRANSFER_STEP_COUNT = 3;

// ── Sihirbaz adımları, doğrulama, özet, kaydet ───────────────
export function transferStepGoto(step) {
  step = Math.max(1, Math.min(TRANSFER_STEP_COUNT, step));
  _transferCurrentStep = step;
  const modal = document.getElementById('modal-transfer');
  if (!modal) return;
  // ---- Saf DOM güncelleme: js/ui/components/step-wizard.js:swizUpdateStepIndicator ----
  swizUpdateStepIndicator(modal, step);
  const backBtn = document.getElementById('transfer-step-back-btn');
  const nextBtn = document.getElementById('transfer-step-next-btn');
  const saveBtn = document.getElementById('transfer-step-save-btn');
  if (backBtn) backBtn.style.display = step > 1 ? '' : 'none';
  if (nextBtn) nextBtn.style.display = step < TRANSFER_STEP_COUNT ? '' : 'none';
  if (saveBtn) saveBtn.style.display = step === TRANSFER_STEP_COUNT ? '' : 'none';
  const body = modal.querySelector('.modal-body');
  if (body) body.scrollTop = 0;
  if (step === 2) _updateTransferTutarTumBtn();
  if (step === TRANSFER_STEP_COUNT) { _transferOzetDoldur(); call('renderTransferLog'); }
}
register('wizardStepGoto:modal-transfer', transferStepGoto);
register('wizardCurrentStep:modal-transfer', () => _transferCurrentStep);

// ── Seçili kaynağın kullanılabilir bakiyesini döndürür (hesap: bakiye + KMH, nakit: nakit bakiyesi) ──
export function _transferKaynakKullanilabilirBakiye() {
  const kVal = (document.getElementById('transfer-kaynak')||{}).value || '';
  const info = _parseTransferSel(kVal);
  if (info.tip === 'hesap') {
    const hesap = (DB.hesaplar || []).find(h => h.id === info.id);
    if (!hesap) return null;
    const pb = hesap.paraBirimi || 'TRY';
    return { tutar: (hesap.bakiye || 0) + (hesap.kmhLimit || 0), pb };
  }
  if (info.tip === 'nakit') {
    const pb = info.pb;
    return { tutar: (DB._nakitBakiye || {})[pb] || 0, pb };
  }
  return null;
}

// "Bakiyenin Tümünü Kullan" butonu — seçili kaynağın tüm kullanılabilir bakiyesini tutara yazar
export function transferTutarTumunuKullan() {
  const kb = _transferKaynakKullanilabilirBakiye();
  if (!kb) { showToast('Önce kaynak hesap veya nakit seçin', 'error'); return; }
  if (!(kb.tutar > 0)) { showToast('Kullanılabilir bakiye 0 veya negatif', 'error'); return; }
  setMoneyInput('transfer-tutar', kb.tutar);
  _updateTransferTutarHint();
  showToast(`${fmtCur(kb.tutar, kb.pb)} tutarı dolduruldu`, 'info');
}

// Buton görünürlüğünü ve ipucunu kaynak seçimine göre günceller
export function _updateTransferTutarTumBtn() {
  const btn = document.getElementById('transfer-tutar-tum-btn');
  if (!btn) return;
  const kb = _transferKaynakKullanilabilirBakiye();
  if (!kb) { btn.style.display = 'none'; }
  else { btn.style.display = 'flex'; }
  _updateTransferTutarHint();
}

// Girilen tutarı, kaynağın kullanılabilir bakiyesiyle karşılaştıran ipucu
export function _updateTransferTutarHint() {
  const hint = document.getElementById('transfer-tutar-bakiye-hint');
  if (!hint) return;
  const kb = _transferKaynakKullanilabilirBakiye();
  if (!kb) { hint.style.display = 'none'; return; }
  hint.style.display = 'block';
  const tutar = getMoneyInput('transfer-tutar') || 0;
  // ---- Saf DOM güncelleme: js/ui/components/step-wizard.js:swizBakiyeHintGuncelle ----
  swizBakiyeHintGuncelle(hint, tutar, kb);
}

export function _transferValidateStep(step) {
  if (step === 1) {
    const kaynak = (document.getElementById('transfer-kaynak')||{}).value || '';
    const hedef  = (document.getElementById('transfer-hedef')||{}).value  || '';
    if (!kaynak) { showToast('Kaynak hesap seçiniz', 'error'); _markFieldError('transfer-kaynak'); return false; }
    if (!hedef)  { showToast('Hedef hesap seçiniz', 'error'); _markFieldError('transfer-hedef');  return false; }
    if (kaynak === hedef) { showToast('Kaynak ve hedef aynı olamaz', 'error'); return false; }
    return true;
  }
  if (step === 2) {
    const tutar = getMoneyInput('transfer-tutar') || 0;
    if (!tutar || tutar <= 0) { showToast('Geçerli bir tutar giriniz', 'error'); _markFieldError('transfer-tutar'); return false; }
    const tarih = (document.getElementById('transfer-tarih')||{}).value || '';
    if (!tarih) { showToast('Tarih giriniz', 'error'); _markFieldError('transfer-tarih'); return false; }
    return true;
  }
  return true;
}

export function transferStepNext() {
  if (!_transferValidateStep(_transferCurrentStep)) return;
  transferStepGoto(_transferCurrentStep + 1);
}

register('wizardStepNext:modal-transfer', transferStepNext);


export function transferStepBack() {
  transferStepGoto(_transferCurrentStep - 1);
}

export function _transferOzetHesapKarti(val, baslik) {
  const bosKart = `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface3);border:1px dashed var(--border2);border-radius:10px">
    <span style="font-size:11.5px;color:var(--text3);font-style:italic">Seçilmedi</span>
  </div>`;
  if (!val) return bosKart;

  // Nakit
  if (val.startsWith('nakit:')) {
    const pb = val.slice(6);
    const cfg = (typeof CURRENCY_CONFIG !== 'undefined' && CURRENCY_CONFIG[pb]) || {};
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface3);border:1px solid var(--border2);border-radius:10px">
      <span style="width:32px;height:32px;border-radius:8px;background:var(--surface4);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">💵</span>
      <div style="min-width:0">
        <div style="font-size:12.5px;font-weight:700;color:var(--text)">Nakit</div>
        <div style="font-size:10.5px;color:var(--text3)">${cfg.flag||''} ${pb}</div>
      </div>
    </div>`;
  }

  // Hesap
  const h = (DB.hesaplar||[]).find(x=>x.id===val);
  if (!h) return bosKart;
  const bankaObj = (DB.bankalar||[]).find(b=>b.id===h.banka) || null;
  const ikon = bankaIkonObj(bankaObj);
  const logoHtml = ikon.svg
    ? `<span class="bank-logo bank-logo-square">${ikon.svg}</span>`
    : `<span style="width:32px;height:32px;border-radius:8px;background:${ikon.bg||'var(--surface4)'};display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">${ikon.emoji||'🏦'}</span>`;
  const ibanTemiz = (h.iban||'').replace(/\s+/g,'');
  const ibanSon = ibanTemiz.length >= 4 ? '····' + ibanTemiz.slice(-4) : null;
  const pb = h.paraBirimi || 'TRY';
  const bakiye = typeof fmtCur === 'function' ? fmtCur(h.bakiye||0, pb) : `${h.bakiye||0} ${pb}`;
  return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface3);border:1px solid var(--border2);border-radius:10px">
    ${logoHtml}
    <div style="min-width:0;flex:1">
      <div style="font-size:12.5px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h.ad}</div>
      <div style="font-size:10.5px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${bankaObj ? bankaObj.kisa : '—'}${ibanSon ? ' · '+ibanSon : ''}</div>
    </div>
    <div style="text-align:right;flex-shrink:0">
      <div class="mono" style="font-size:12px;font-weight:700;color:${(h.bakiye||0)>=0?'var(--teal)':'var(--danger)'}">${bakiye}</div>
      <div style="font-size:9.5px;color:var(--text3)">Bakiye</div>
    </div>
  </div>`;
}

export function _transferOzetDoldur() {
  const kaynakVal = (document.getElementById('transfer-kaynak')||{}).value || '';
  const hedefVal  = (document.getElementById('transfer-hedef')||{}).value  || '';
  const tutar = getMoneyInput('transfer-tutar') || 0;
  const tarih = (document.getElementById('transfer-tarih')||{}).value || '';
  const aciklama = (document.getElementById('transfer-aciklama')||{}).value.trim() || '—';

  const getPb = (val) => {
    if (!val) return 'TRY';
    if (val.startsWith('nakit:')) return val.slice(6);
    const h = (DB.hesaplar||[]).find(x=>x.id===val);
    return h ? (h.paraBirimi||'TRY') : 'TRY';
  };

  const pb = getPb(kaynakVal);
  const satir = swizOzetSatirHtmlKisa;

  const el = document.getElementById('transfer-ozet-icerik');
  if (!el) return;
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
      <div>
        <div style="font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--text3);margin-bottom:4px">Kaynak</div>
        ${_transferOzetHesapKarti(kaynakVal)}
      </div>
      <div style="display:flex;justify-content:center;color:var(--text3);font-size:14px;margin:-2px 0">↓</div>
      <div>
        <div style="font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--text3);margin-bottom:4px">Hedef</div>
        ${_transferOzetHesapKarti(hedefVal)}
      </div>
    </div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px 16px">
      ${satir('Tutar', fmtCur(tutar, pb))}
      ${satir('Tarih', typeof fmtDate === 'function' ? fmtDate(tarih) : tarih)}
      ${aciklama !== '—' ? satir('Açıklama', `<span style="font-family:inherit">${aciklama}</span>`) : ''}
    </div>`;
}

function saveTransfer() {
  const tutar    = getMoneyInput('transfer-tutar');
  const tarih    = document.getElementById('transfer-tarih').value;
  const aciklama = (document.getElementById('transfer-aciklama').value || '').trim();

  if (!tarih) { showToast('Tarih seçimi zorunludur', 'error'); return; }

  const kInfo = _parseTransferSel(document.getElementById('transfer-kaynak').value);
  const hInfo = _parseTransferSel(document.getElementById('transfer-hedef').value);
  const kTip = kInfo.tip, hTip = hInfo.tip;

  if (!kTip) { showToast('Kaynak seçin', 'error'); return; }
  if (!hTip) { showToast('Hedef seçin', 'error'); return; }
  if (!tutar || tutar <= 0) { showToast('Geçerli bir tutar girin', 'error'); return; }
  if (kTip === 'nakit' && hTip === 'nakit') { showToast('İki nakit arasında transfer yapılamaz', 'error'); return; }

  // ── Para birimi uyumu kontrolü ──
  {
    let _kPb = 'TRY', _hPb = 'TRY';
    if (kTip === 'hesap') {
      const _kHesap = (DB.hesaplar || []).find(h => h.id === kInfo.id);
      if (_kHesap) _kPb = _kHesap.paraBirimi || 'TRY';
    } else {
      _kPb = kInfo.pb || 'TRY';
    }
    if (hTip === 'hesap') {
      const _hHesap = (DB.hesaplar || []).find(h => h.id === hInfo.id);
      if (_hHesap) _hPb = _hHesap.paraBirimi || 'TRY';
    } else {
      _hPb = hInfo.pb || 'TRY';
    }
    if (_kPb !== _hPb) {
      showToast(`⚠️ Para birimi uyuşmuyor: ${_kPb} → ${_hPb}. Sadece aynı para birimleri arasında transfer yapılabilir.`, 'error');
      return;
    }
  }

  if (!DB.transferler) DB.transferler = [];

  // ── Kaynak bilgisi ──
  let kaynakHesap = null, kaynakPb = 'TRY';
  if (kTip === 'hesap') {
    if (!kInfo.id) { showToast('Kaynak hesap seçin', 'error'); return; }
    kaynakHesap = (DB.hesaplar || []).find(h => h.id === kInfo.id);
    if (!kaynakHesap) { showToast('Kaynak hesap bulunamadı', 'error'); return; }
    kaynakPb = kaynakHesap.paraBirimi || 'TRY';
    const kaynakKullanilabilir = (kaynakHesap.bakiye || 0) + (kaynakHesap.kmhLimit || 0);
    if (kaynakKullanilabilir < tutar) {
      const kmhStr = kaynakHesap.kmhLimit > 0 ? ` (KMH dahil kullanılabilir: ${fmtCur(kaynakKullanilabilir, kaynakPb)})` : '';
      showToast(`Yetersiz bakiye! ${kaynakHesap.ad}: ${fmtCur(kaynakHesap.bakiye || 0, kaynakPb)}${kmhStr}`, 'error'); return;
    }
  } else {
    kaynakPb = kInfo.pb || 'TRY';
    const nakitBak = (DB._nakitBakiye || {})[kaynakPb] || 0;
    if (nakitBak < tutar) {
      showToast(`Yetersiz nakit! ${kaynakPb} bakiye: ${fmtCur(nakitBak, kaynakPb)}`, 'error'); return;
    }
  }

  // ── Hedef bilgisi ──
  let hedefHesap = null, hedefPb = 'TRY';
  if (hTip === 'hesap') {
    if (!hInfo.id) { showToast('Hedef hesap seçin', 'error'); return; }
    hedefHesap = (DB.hesaplar || []).find(h => h.id === hInfo.id);
    if (!hedefHesap) { showToast('Hedef hesap bulunamadı', 'error'); return; }
    hedefPb = hedefHesap.paraBirimi || 'TRY';
  } else {
    hedefPb = hInfo.pb || 'TRY';
  }

  // ── Bakiye güncelle ──
  if (kTip === 'hesap') kaynakHesap.bakiye = (kaynakHesap.bakiye || 0) - tutar;
  else { if (!DB._nakitBakiye) DB._nakitBakiye = {}; DB._nakitBakiye[kaynakPb] = (DB._nakitBakiye[kaynakPb] || 0) - tutar; }

  if (hTip === 'hesap') hedefHesap.bakiye = (hedefHesap.bakiye || 0) + tutar;
  else { if (!DB._nakitBakiye) DB._nakitBakiye = {}; DB._nakitBakiye[hedefPb] = (DB._nakitBakiye[hedefPb] || 0) + tutar; }

  // ── Log kaydı ──
  const kaynakLabel = kTip === 'nakit' ? `Nakit (${kaynakPb})` : kaynakHesap.ad;
  const hedefLabel  = hTip === 'nakit' ? `Nakit (${hedefPb})`  : hedefHesap.ad;
  DB.transferler.push({
    id: 'tr_' + Date.now(),
    tarih,
    kTip, hTip,
    kaynakId: kaynakHesap ? kaynakHesap.id : null,
    hedefId:  hedefHesap  ? hedefHesap.id  : null,
    kaynakPb, hedefPb,
    tutar,
    aciklama: aciklama || `${kaynakLabel} → ${hedefLabel}`,
  });

  saveData();
  closeModal('modal-transfer');
  try { showToast(`✅ ${fmtCur(tutar, kaynakPb)} transfer edildi`, 'success'); } catch(e) {}
  try { call('renderTransferLog'); } catch(e) {}
  try { if (typeof renderHesaplar === 'function') renderHesaplar(); } catch(e) {}
  try { if (typeof renderOzet === 'function') renderOzet(); } catch(e) {}
  try { _updateTopbarBakiye(); } catch(e) {}
}
export { saveTransfer as saveTransfer__transfer_modal };
// [ES module] taban tanım, odeme/patches zincirinin hook/wrap edebilmesi
// için wrap-registry'ye kaydediliyor.
register('saveTransfer', saveTransfer);

// ── Transfer Logu ────────────────────────────────────────────
// Transfer log filtre butonunun üzerindeki etiketi (seçili hesap/nakit adı ya da
// "N seçili" / "Tümü") günceller. Popup içeriği kendini _renderMfPopupList ile
// güncelliyor, ama tetikleyici butonun kendisi ayrıca güncellenmeli.
export function _transferLogFiltreLabelGuncelle(hesapMap, seciliFiltreler) {
  const btn = document.getElementById('transfer-log-filtre-btn');
  const label = document.getElementById('transfer-log-filtre-label');
  if (!btn || !label) return;

  if (!seciliFiltreler || !seciliFiltreler.length) {
    label.textContent = 'Tümü';
    label.className = 'sc-popup-placeholder';
    btn.classList.add('sc-is-empty');
    btn.classList.remove('sc-has-value');
    return;
  }

  btn.classList.remove('sc-is-empty');
  btn.classList.add('sc-has-value');
  label.className = '';

  if (seciliFiltreler.length === 1) {
    const f = seciliFiltreler[0];
    if (f.startsWith('h:')) {
      label.textContent = hesapMap[f.slice(2)] || 'Hesap';
    } else {
      label.textContent = 'Nakit (' + f.slice(2) + ')';
    }
  } else {
    label.textContent = seciliFiltreler.length + ' seçili';
  }
}

function renderTransferLog() {
  if (!DB.transferler) DB.transferler = [];
  const liste = document.getElementById('transfer-log-liste');
  const msec = document.getElementById('transfer-log-msec');
  if (!liste) return;

  // Hiç transfer geçmişi yoksa bölümü tamamen gizle (ilk kullanımda gereksiz boşluk olmasın)
  if (msec) msec.style.display = DB.transferler.length ? '' : 'none';
  if (!DB.transferler.length) return;

  // Filtre seçenekleri: sadece transferlerde gerçekten kullanılan hesap/nakit — gruplu ve ikonlu
  const hesapMap = {};
  (DB.hesaplar || []).forEach(h => { hesapMap[h.id] = h.ad; });
  const usedHesapIds = new Set();
  const nakitPbSet = new Set();
  if (!DB.transferler) DB.transferler = [];
  DB.transferler.forEach(t => {
    if (t.hTip === 'hesap' && t.hedefId) usedHesapIds.add(t.hedefId);
    if (t.kTip === 'nakit') nakitPbSet.add(t.kaynakPb);
    if (t.hTip === 'nakit') nakitPbSet.add(t.hedefPb);
  });
  const seciliFiltreler = tblFiltreOkuMulti('transferLog', 'filtre');
  _transferLogFiltreLabelGuncelle(hesapMap, seciliFiltreler);

  let kayitlar = [...DB.transferler].reverse();
  if (seciliFiltreler.length) {
    kayitlar = kayitlar.filter(t => seciliFiltreler.some(filtre => {
      if (filtre.startsWith('h:')) {
        const hId = filtre.slice(2);
        return t.kaynakId === hId || t.hedefId === hId;
      }
      const pb = filtre.slice(2);
      return (t.kTip === 'nakit' && t.kaynakPb === pb) || (t.hTip === 'nakit' && t.hedefPb === pb);
    }));
  }

  if (!kayitlar.length) {
    liste.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px 4px">Kayıt yok</div>';
    return;
  }

  liste.innerHTML = kayitlar.map(t => {
    const kaynakLabel = t.kTip === 'nakit' ? `💵 Nakit (${t.kaynakPb})` : `🏛️ ${hesapMap[t.kaynakId] || '?'}`;
    const hedefLabel  = t.hTip === 'nakit' ? `💵 Nakit (${t.hedefPb})`  : `🏛️ ${hesapMap[t.hedefId]  || '?'}`;
    const pb = t.kaynakPb || 'TRY';
    // [CSS düzeltmesi] Bu satırlar eskiden inline-style flexbox div'ler
    // olarak üretiliyordu; ancak css/part-037.css (ve onunla çelişen
    // part-036/part-038) `.rf-transfer-row-compact` + `.rf-transfer-compact-*`
    // semantic class'larına göre grid layout kuralları bekliyordu. Class'lar
    // hiç üretilmediği için o kurallar hiç eşleşmiyor, üstüne birden fazla
    // rakip CSS dosyası aynı öğeleri farklı (çelişen) şekilde zorlamaya
    // çalışıyordu — ekranda satırların üst üste binmesi/tutarların kesilmesi
    // buradan kaynaklanıyordu. Artık part-037.css'in beklediği class'lar
    // üretiliyor.
    return `<div class="rf-transfer-row-compact">
      <div class="rf-transfer-compact-main">
        <div class="rf-transfer-compact-route">${kaynakLabel} <span style="color:var(--text3)">→</span> ${hedefLabel}</div>
        ${t.aciklama ? `<div class="rf-transfer-compact-note">${t.aciklama}</div>` : ''}
      </div>
      <div class="rf-transfer-compact-amount">
        <div class="mono" style="font-weight:700;color:var(--teal)">${fmtCur(t.tutar, pb)}</div>
        <div style="color:var(--text3);font-size:10px">${fmtDate(t.tarih)}</div>
      </div>
      <div class="rf-transfer-compact-actions">
        <button class="transfer-log-tekrar-btn" data-id="${t.id}" style="background:none;border:none;cursor:pointer;color:var(--accent2);font-size:13px;line-height:1;border-radius:4px" title="Bu transferi tekrarla">🔁</button>
        <button class="transfer-log-sil-btn" data-id="${t.id}" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:13px;line-height:1;border-radius:4px" title="Sil">✕</button>
      </div>
    </div>`;
  }).join('');
  // [ES module] onclick="tekrarlaTransfer(...)" ve onclick="deleteTransfer(...)" kaldırıldı.
  liste.querySelectorAll('.transfer-log-tekrar-btn').forEach(btn => {
    btn.addEventListener('click', () => tekrarlaTransfer(btn.getAttribute('data-id')));
  });
  liste.querySelectorAll('.transfer-log-sil-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTransfer(btn.getAttribute('data-id')));
  });
}
export { renderTransferLog as renderTransferLog__transfer_modal };
// Taban tanımları registry'ye kaydet — app-core.js / tbk-detay.js bunları
// zincirleme wrap edebilsin diye (bkz. core/wrap-registry.js).
register('openTransferModal', openTransferModal);
// [BUG FIX] register('renderTransferLog', renderTransferLog) BİLEREK
// KALDIRILDI. index.html'de bu dosya js/ui/pages/odeme/patches/
// 01-transfer-log-senkron.js'DEN SONRA yükleniyor; o dosya zaten
// register('renderTransferLog', ...) ile hem hesap/nakit filtresini HEM
// yeşil/kırmızı/tire durum filtresini (possible()/st()/renderStatus())
// uygulayan TAM versiyonu kaydediyor. Buradaki renderTransferLog() durum
// filtresi mantığını hiç içermiyor (sadece hesap/nakit filtreliyor); script
// sırası yüzünden bu eksik versiyon en son register edilip registry'yi
// eziyordu — sonuç: yeşil/kırmızı/tire butonlarına tıklamak state'i
// güncelliyordu ama render hiç bu state'i okumadığı için liste asla
// değişmiyordu ("filtreler çalışmıyor" şikayetinin kök nedeni budur).
// Aşağıdaki fonksiyon artık sadece _transferLogFiltreLabelGuncelle ve
// tekrarlaTransfer/deleteTransfer'ın diğer modüllerce kullanılabilmesi için
// burada tutuluyor; registry'ye KAYDEDİLMİYOR.
// (renderTransferLog fonksiyonunun kendisi yukarıda renderTransferLog__transfer_modal
// olarak export ediliyor; başka bir yerden ihtiyaç olursa import edilebilir.)

// ── Bir önceki transferi tekrarla: kaynak/hedef/tutar/açıklamayı forma doldurur ──
export function tekrarlaTransfer(id) {
  if (!DB.transferler) return;
  const t = DB.transferler.find(x => x.id === id);
  if (!t) { showToast('Transfer kaydı bulunamadı', 'error'); return; }

  const kVal = t.kTip === 'nakit' ? `nakit:${t.kaynakPb}` : (t.kaynakId || '');
  const hVal = t.hTip === 'nakit' ? `nakit:${t.hedefPb}`  : (t.hedefId  || '');

  transferStepGoto(1);
  const kSel = document.getElementById('transfer-kaynak');
  const hSel = document.getElementById('transfer-hedef');
  if (kSel) kSel.value = '';
  if (hSel) hSel.value = '';
  _populateTransferHesaplar();
  const kOk = kSel && kSel.querySelector(`option[value="${kVal}"]`);
  const hOk = hSel && hSel.querySelector(`option[value="${hVal}"]`);
  if (kOk) kSel.value = kVal;
  if (hOk) hSel.value = hVal;
  onTransferKaynakChange();
  onTransferHedefChange();

  setMoneyInput('transfer-tutar', t.tutar);
  document.getElementById('transfer-aciklama').value = t.aciklama || '';
  setDateInputValue('transfer-tarih', localDateStr(new Date()));
  _updateTransferTutarTumBtn();
  _updateTransferTutarHint();

  if (!kOk || !hOk) {
    showToast('Kaynak/hedeften biri artık uygun değil (bakiye/durum) — lütfen yeniden seçin', 'error');
  } else {
    showToast('Önceki transfer forma dolduruldu — kontrol edip kaydedebilirsiniz', 'info');
  }
}

export function deleteTransfer(id) {
  if (!DB.transferler) return;
  DB.transferler = DB.transferler.filter(t => t.id !== id);
  saveData();
  call('renderTransferLog');
}

