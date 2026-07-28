import { inject, whenReady } from '@core/container.js';
// DUAL-MODE CONTAINER KAYDI: dokuz bağımlılık da (core.appCoreBase,
// core.appCore, core.format, core.state, domain.doviz,
// domain.hesapEntegrasyonMotoru, ui.components.modalGenel,
// ui.components.moneyInput, ui.components.stepWizard, core.wrapRegistry)
// zaten container'a taşınmış katmanlara ait. @pages/* importları o katman
// henüz taşınmadığı için BİLİNÇLİ OLARAK korunuyor.
const _appCoreBase = inject('core.appCoreBase');
const _appCore = inject('core.appCore');
const _format = inject('core.format');
const _coreState = inject('core.state');
const _doviz = inject('domain.doviz');
const _hesapEntegrasyonMotoru = inject('domain.hesapEntegrasyonMotoru');
const _modalGenel = inject('ui.components.modalGenel');
const _moneyInput = inject('ui.components.moneyInput');
const _stepWizard = inject('ui.components.stepWizard');
const _wrapRegistry = inject('core.wrapRegistry');
import { hesapOptionMetin } from '@pages/hesaplar/01-genel-yardimcilar.js';
import { bankaIkonObj } from '@pages/tanimlamalar/01-genel-yardimcilar.js';
import { renderOzet } from '@pages/ozet.js';
import { renderHesaplar } from '@pages/hesaplar/04-hesap-liste-render.js';
// ============================================================
// js/ui/components/transfer-modal.js — Hesaplar arası / nakit
// transfer sihirbazı (3 adım: seçim → tutar → özet+kaydet) ve
// transfer geçmişi logu
// ============================================================

export function openTransferModal(kaynakHesapId) {
  // Kaynak olarak kullanılabilecek (bakiyesi > 0) hesap/nakit var mı kontrol et
  const aktifHesaplar = (_coreState.DB.hesaplar || []).filter(h => h.durum === 'aktif' && h.tur !== 'vadeli');
  const varKaynakHesap = aktifHesaplar.some(h => (h.bakiye || 0) + (h.kmhLimit || 0) > 0);
  const nakitBakiyeler = _coreState.DB._nakitBakiye || {};
  const varKaynakNakit = Object.values(nakitBakiyeler).some(b => b > 0);
  if (!varKaynakHesap && !varKaynakNakit) {
    _modalGenel.showToast('Transfer yapılabilecek bakiyesi olan hesap bulunamadı', 'error');
    return;
  }

  // Belirli bir hesaptan açıldıysa, o hesabın (KMH dahil) kullanılabilir bakiyesi var mı kontrol et
  if (kaynakHesapId) {
    const kh = aktifHesaplar.find(h => h.id === kaynakHesapId);
    if (!kh || ((kh.bakiye || 0) + (kh.kmhLimit || 0)) <= 0) {
      _modalGenel.showToast('Bu hesabın gönderilebilecek (KMH dahil) bakiyesi yok', 'error');
      return;
    }
  }

  transferStepGoto(1);
  _moneyInput.setDateInputValue('transfer-tarih', _format.localDateStr(new Date()));
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
  _wrapRegistry.call('renderTransferLog');
  _modalGenel.openModal('modal-transfer');
  setTimeout(() => _moneyInput.bindMoneyInputs(document.getElementById('modal-transfer')), 20);
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
  if (typeof _coreState.ALL_CURRENCIES === 'undefined' || !_coreState.ALL_CURRENCIES.length) {
    if (typeof rebuildAllCurrencies === 'function') _doviz.rebuildAllCurrencies();
  }
  return (typeof _coreState.ALL_CURRENCIES !== 'undefined' && _coreState.ALL_CURRENCIES.length)
    ? _coreState.ALL_CURRENCIES
    : [{ code: 'TRY', symbol: '₺', flag: '🇹🇷' }];
}

// ── Hesap + Nakit listelerini doldur (tek dropdown) ───────────
export function _populateTransferHesaplar() {
  const hesaplar = (_coreState.DB.hesaplar || []).filter(h => h.durum === 'aktif' && h.tur !== 'vadeli');
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
      .filter(c => ((_coreState.DB._nakitBakiye || {})[c.code] || 0) > 0)
      .map(c => `<option value="nakit:${c.code}">💵 Nakit — ${c.code} - Bakiye: ${_format.fmtCur((_coreState.DB._nakitBakiye || {})[c.code] || 0, c.code)}</option>`).join('');
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
      .map(c => `<option value="nakit:${c.code}">💵 Nakit — ${c.code} - Bakiye: ${_format.fmtCur((_coreState.DB._nakitBakiye || {})[c.code] || 0, c.code)}</option>`).join('');
    return (hesapOpts ? `<optgroup label="🏛️ Hesaplar">${hesapOpts}</optgroup>` : '')
      + (nakitOpts ? `<optgroup label="💵 Nakit">${nakitOpts}</optgroup>` : '');
  };

  const kSel = document.getElementById('transfer-kaynak');
  const hSel = document.getElementById('transfer-hedef');
  // Kaynak: hedef seçiliyse aynı değeri ve (varsa) aynı para biriminden olanları göster; sadece bakiyesi > 0 hesaplar
  if (kSel) {
    const prev = kSel.value;
    kSel.innerHTML = makeKaynakOpts(hVal || '', hedefPb);
    _modalGenel.phSet(kSel, '— Hesap Seçin —', prev, hedefPb ? '— Eşleşen hesap/nakit bulunamadı —' : '— Hesap bulunamadı —');
  }
  // Hedef: kaynak seçiliyse aynı değeri ve (varsa) aynı para biriminden olanları göster
  if (hSel) {
    const prev = hSel.value;
    hSel.innerHTML = makeHedefOpts(kVal || '', kaynakPb);
    _modalGenel.phSet(hSel, '— Hesap Seçin —', prev, kaynakPb ? '— Eşleşen hesap/nakit bulunamadı —' : '— Hesap bulunamadı —');
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
  if (!kVal) { _modalGenel.showToast('Lütfen önce kaynak hesabı seçin', 'error'); return; }

  // Kaynak hesabın bakiyesini (ek limit dahil) kontrol et
  const kInfo = _parseTransferSel(kVal);
  if (kInfo.tip === 'hesap') {
    const kHesap = (_coreState.DB.hesaplar || []).find(h => h.id === kInfo.id);
    if (kHesap && ((kHesap.bakiye || 0) + (kHesap.kmhLimit || 0)) <= 0) {
      _modalGenel.showToast('Kaynak hesabın kullanılabilir bakiyesi yetersiz', 'error');
      return;
    }
  } else if (kInfo.tip === 'nakit') {
    const nakitBak = (_coreState.DB._nakitBakiye || {})[kInfo.pb] || 0;
    if (nakitBak <= 0) {
      _modalGenel.showToast('Kaynak nakit bakiyesi yetersiz', 'error');
      return;
    }
  }

  if (!kVal && !hVal) { _modalGenel.showToast('Değiştirilecek bir seçim yok', 'error'); return; }

  // Her iki select'i de karşılıklı filtre/exclude uygulamadan tüm seçeneklerle yeniden oluştur,
  // böylece karşı tarafın eski değeri her iki select'te de geçerli bir seçenek olur.
  const hesaplar = (_coreState.DB.hesaplar || []).filter(h => h.durum === 'aktif' && h.tur !== 'vadeli');
  const curList  = _nakitCurrencyList();

  // Swap sonrası yeni kaynak (eski hedef) bakiye kontrolü
  const hInfo = _parseTransferSel(hVal);
  if (hInfo.tip === 'hesap') {
    const hHesap = hesaplar.find(h => h.id === hInfo.id);
    if (hHesap && ((hHesap.bakiye || 0) + (hHesap.kmhLimit || 0)) <= 0) {
      _modalGenel.showToast('Hedef hesabın kullanılabilir bakiyesi yetersiz — tersine çevrilemez', 'error');
      return;
    }
  } else if (hInfo.tip === 'nakit') {
    const hBak = (_coreState.DB._nakitBakiye || {})[hInfo.pb] || 0;
    if (hBak <= 0) {
      _modalGenel.showToast('Hedef nakit bakiyesi yetersiz — tersine çevrilemez', 'error');
      return;
    }
  }

  // Kaynak için bakiyesi > 0 filtrelenmiş seçenekler, hedef için tüm seçenekler
  const kaynakFullOpts = () => {
    const ph = '<option value="" disabled selected hidden>— Hesap Seçin —</option>';
    const hesapOpts = hesaplar.filter(h => ((h.bakiye||0)+(h.kmhLimit||0)) > 0).map(h => `<option value="${h.id}">${hesapOptionMetin(h)}</option>`).join('');
    const nakitOpts = curList.filter(c => ((_coreState.DB._nakitBakiye||{})[c.code]||0) > 0).map(c => `<option value="nakit:${c.code}">💵 Nakit — ${c.code}</option>`).join('');
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
    const kH = (_coreState.DB.hesaplar || []).find(x => x.id === k.id);
    const hH = (_coreState.DB.hesaplar || []).find(x => x.id === h.id);
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
    const hesap = (_coreState.DB.hesaplar || []).find(h => h.id === info.id);
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
  _stepWizard.swizUpdateStepIndicator(modal, step);
  const backBtn = document.getElementById('transfer-step-back-btn');
  const nextBtn = document.getElementById('transfer-step-next-btn');
  const saveBtn = document.getElementById('transfer-step-save-btn');
  if (backBtn) backBtn.style.display = step > 1 ? '' : 'none';
  if (nextBtn) nextBtn.style.display = step < TRANSFER_STEP_COUNT ? '' : 'none';
  if (saveBtn) saveBtn.style.display = step === TRANSFER_STEP_COUNT ? '' : 'none';
  const body = modal.querySelector('.modal-body');
  if (body) body.scrollTop = 0;
  if (step === 2) _updateTransferTutarTumBtn();
  if (step === TRANSFER_STEP_COUNT) { _transferOzetDoldur(); _wrapRegistry.call('renderTransferLog'); }
}
// core.wrapRegistry, index.html'de bu dosyadan SONRA yüklenebiliyor;
// whenReady ile register olana kadar bekleyip sonra kaydediyoruz.
whenReady('core.wrapRegistry', () => {
  _wrapRegistry.register('wizardStepGoto:modal-transfer', transferStepGoto);
  _wrapRegistry.register('wizardCurrentStep:modal-transfer', () => _transferCurrentStep);
});

// ── Seçili kaynağın kullanılabilir bakiyesini döndürür (hesap: bakiye + KMH, nakit: nakit bakiyesi) ──
export function _transferKaynakKullanilabilirBakiye() {
  const kVal = (document.getElementById('transfer-kaynak')||{}).value || '';
  const info = _parseTransferSel(kVal);
  if (info.tip === 'hesap') {
    const hesap = (_coreState.DB.hesaplar || []).find(h => h.id === info.id);
    if (!hesap) return null;
    const pb = hesap.paraBirimi || 'TRY';
    return { tutar: (hesap.bakiye || 0) + (hesap.kmhLimit || 0), pb };
  }
  if (info.tip === 'nakit') {
    const pb = info.pb;
    return { tutar: (_coreState.DB._nakitBakiye || {})[pb] || 0, pb };
  }
  return null;
}

// "Bakiyenin Tümünü Kullan" butonu — seçili kaynağın tüm kullanılabilir bakiyesini tutara yazar
export function transferTutarTumunuKullan() {
  const kb = _transferKaynakKullanilabilirBakiye();
  if (!kb) { _modalGenel.showToast('Önce kaynak hesap veya nakit seçin', 'error'); return; }
  if (!(kb.tutar > 0)) { _modalGenel.showToast('Kullanılabilir bakiye 0 veya negatif', 'error'); return; }
  _moneyInput.setMoneyInput('transfer-tutar', kb.tutar);
  _updateTransferTutarHint();
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
  const tutar = _moneyInput.getMoneyInput('transfer-tutar') || 0;
  // ---- Saf DOM güncelleme: js/ui/components/step-wizard.js:swizBakiyeHintGuncelle ----
  _stepWizard.swizBakiyeHintGuncelle(hint, tutar, kb);
}

export function _transferValidateStep(step) {
  if (step === 1) {
    const kaynak = (document.getElementById('transfer-kaynak')||{}).value || '';
    const hedef  = (document.getElementById('transfer-hedef')||{}).value  || '';
    if (!kaynak) { _modalGenel.showToast('Kaynak hesap seçiniz', 'error'); _modalGenel._markFieldError('transfer-kaynak'); return false; }
    if (!hedef)  { _modalGenel.showToast('Hedef hesap seçiniz', 'error'); _modalGenel._markFieldError('transfer-hedef');  return false; }
    if (kaynak === hedef) { _modalGenel.showToast('Kaynak ve hedef aynı olamaz', 'error'); return false; }
    return true;
  }
  if (step === 2) {
    const tutar = _moneyInput.getMoneyInput('transfer-tutar') || 0;
    if (!tutar || tutar <= 0) { _modalGenel.showToast('Geçerli bir tutar giriniz', 'error'); _modalGenel._markFieldError('transfer-tutar'); return false; }
    const tarih = (document.getElementById('transfer-tarih')||{}).value || '';
    if (!tarih) { _modalGenel.showToast('Tarih giriniz', 'error'); _modalGenel._markFieldError('transfer-tarih'); return false; }
    return true;
  }
  return true;
}

export function transferStepNext() {
  if (!_transferValidateStep(_transferCurrentStep)) return;
  transferStepGoto(_transferCurrentStep + 1);
}

whenReady('core.wrapRegistry', () => {
  _wrapRegistry.register('wizardStepNext:modal-transfer', transferStepNext);
});


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
    const cfg = (typeof _coreState.CURRENCY_CONFIG !== 'undefined' && _coreState.CURRENCY_CONFIG[pb]) || {};
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface3);border:1px solid var(--border2);border-radius:10px">
      <span style="width:32px;height:32px;border-radius:8px;background:var(--surface4);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">💵</span>
      <div style="min-width:0">
        <div style="font-size:12.5px;font-weight:700;color:var(--text)">Nakit</div>
        <div style="font-size:10.5px;color:var(--text3)">${cfg.flag||''} ${pb}</div>
      </div>
    </div>`;
  }

  // Hesap
  const h = (_coreState.DB.hesaplar||[]).find(x=>x.id===val);
  if (!h) return bosKart;
  const bankaObj = (_coreState.DB.bankalar||[]).find(b=>b.id===h.banka) || null;
  const ikon = bankaIkonObj(bankaObj);
  const logoHtml = ikon.svg
    ? `<span class="bank-logo bank-logo-square">${ikon.svg}</span>`
    : `<span style="width:32px;height:32px;border-radius:8px;background:${ikon.bg||'var(--surface4)'};display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">${ikon.emoji||'🏦'}</span>`;
  const ibanTemiz = (h.iban||'').replace(/\s+/g,'');
  const ibanSon = ibanTemiz.length >= 4 ? '····' + ibanTemiz.slice(-4) : null;
  const pb = h.paraBirimi || 'TRY';
  const bakiye = typeof fmtCur === 'function' ? _format.fmtCur(h.bakiye||0, pb) : `${h.bakiye||0} ${pb}`;
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
  const tutar = _moneyInput.getMoneyInput('transfer-tutar') || 0;
  const tarih = (document.getElementById('transfer-tarih')||{}).value || '';
  const aciklama = (document.getElementById('transfer-aciklama')||{}).value.trim() || '—';

  const getPb = (val) => {
    if (!val) return 'TRY';
    if (val.startsWith('nakit:')) return val.slice(6);
    const h = (_coreState.DB.hesaplar||[]).find(x=>x.id===val);
    return h ? (h.paraBirimi||'TRY') : 'TRY';
  };

  const pb = getPb(kaynakVal);
  const satir = _stepWizard.swizOzetSatirHtmlKisa;

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
      ${satir('Tutar', _format.fmtCur(tutar, pb))}
      ${satir('Tarih', typeof fmtDate === 'function' ? _format.fmtDate(tarih) : tarih)}
      ${aciklama !== '—' ? satir('Açıklama', `<span style="font-family:inherit">${aciklama}</span>`) : ''}
    </div>`;
}

function saveTransfer() {
  const tutar    = _moneyInput.getMoneyInput('transfer-tutar');
  const tarih    = document.getElementById('transfer-tarih').value;
  const aciklama = (document.getElementById('transfer-aciklama').value || '').trim();

  if (!tarih) { _modalGenel.showToast('Tarih seçimi zorunludur', 'error'); return; }

  const kInfo = _parseTransferSel(document.getElementById('transfer-kaynak').value);
  const hInfo = _parseTransferSel(document.getElementById('transfer-hedef').value);
  const kTip = kInfo.tip, hTip = hInfo.tip;

  if (!kTip) { _modalGenel.showToast('Kaynak seçin', 'error'); return; }
  if (!hTip) { _modalGenel.showToast('Hedef seçin', 'error'); return; }
  if (!tutar || tutar <= 0) { _modalGenel.showToast('Geçerli bir tutar girin', 'error'); return; }
  if (kTip === 'nakit' && hTip === 'nakit') { _modalGenel.showToast('İki nakit arasında transfer yapılamaz', 'error'); return; }

  // ── Para birimi uyumu kontrolü ──
  {
    let _kPb = 'TRY', _hPb = 'TRY';
    if (kTip === 'hesap') {
      const _kHesap = (_coreState.DB.hesaplar || []).find(h => h.id === kInfo.id);
      if (_kHesap) _kPb = _kHesap.paraBirimi || 'TRY';
    } else {
      _kPb = kInfo.pb || 'TRY';
    }
    if (hTip === 'hesap') {
      const _hHesap = (_coreState.DB.hesaplar || []).find(h => h.id === hInfo.id);
      if (_hHesap) _hPb = _hHesap.paraBirimi || 'TRY';
    } else {
      _hPb = hInfo.pb || 'TRY';
    }
    if (_kPb !== _hPb) {
      _modalGenel.showToast(`⚠️ Para birimi uyuşmuyor: ${_kPb} → ${_hPb}. Sadece aynı para birimleri arasında transfer yapılabilir.`, 'error');
      return;
    }
  }

  if (!_coreState.DB.transferler) _coreState.DB.transferler = [];

  // ── Kaynak bilgisi ──
  let kaynakHesap = null, kaynakPb = 'TRY';
  if (kTip === 'hesap') {
    if (!kInfo.id) { _modalGenel.showToast('Kaynak hesap seçin', 'error'); return; }
    kaynakHesap = (_coreState.DB.hesaplar || []).find(h => h.id === kInfo.id);
    if (!kaynakHesap) { _modalGenel.showToast('Kaynak hesap bulunamadı', 'error'); return; }
    kaynakPb = kaynakHesap.paraBirimi || 'TRY';
    const kaynakKullanilabilir = (kaynakHesap.bakiye || 0) + (kaynakHesap.kmhLimit || 0);
    if (kaynakKullanilabilir < tutar) {
      const kmhStr = kaynakHesap.kmhLimit > 0 ? ` (KMH dahil kullanılabilir: ${_format.fmtCur(kaynakKullanilabilir, kaynakPb)})` : '';
      _modalGenel.showToast(`Yetersiz bakiye! ${kaynakHesap.ad}: ${_format.fmtCur(kaynakHesap.bakiye || 0, kaynakPb)}${kmhStr}`, 'error'); return;
    }
  } else {
    kaynakPb = kInfo.pb || 'TRY';
    const nakitBak = (_coreState.DB._nakitBakiye || {})[kaynakPb] || 0;
    if (nakitBak < tutar) {
      _modalGenel.showToast(`Yetersiz nakit! ${kaynakPb} bakiye: ${_format.fmtCur(nakitBak, kaynakPb)}`, 'error'); return;
    }
  }

  // ── Hedef bilgisi ──
  let hedefHesap = null, hedefPb = 'TRY';
  if (hTip === 'hesap') {
    if (!hInfo.id) { _modalGenel.showToast('Hedef hesap seçin', 'error'); return; }
    hedefHesap = (_coreState.DB.hesaplar || []).find(h => h.id === hInfo.id);
    if (!hedefHesap) { _modalGenel.showToast('Hedef hesap bulunamadı', 'error'); return; }
    hedefPb = hedefHesap.paraBirimi || 'TRY';
  } else {
    hedefPb = hInfo.pb || 'TRY';
  }

  // ── Bakiye güncelle ──
  if (kTip === 'hesap') kaynakHesap.bakiye = (kaynakHesap.bakiye || 0) - tutar;
  else { if (!_coreState.DB._nakitBakiye) _coreState.DB._nakitBakiye = {}; _coreState.DB._nakitBakiye[kaynakPb] = (_coreState.DB._nakitBakiye[kaynakPb] || 0) - tutar; }

  if (hTip === 'hesap') hedefHesap.bakiye = (hedefHesap.bakiye || 0) + tutar;
  else { if (!_coreState.DB._nakitBakiye) _coreState.DB._nakitBakiye = {}; _coreState.DB._nakitBakiye[hedefPb] = (_coreState.DB._nakitBakiye[hedefPb] || 0) + tutar; }

  // ── Log kaydı ──
  const kaynakLabel = kTip === 'nakit' ? `Nakit (${kaynakPb})` : kaynakHesap.ad;
  const hedefLabel  = hTip === 'nakit' ? `Nakit (${hedefPb})`  : hedefHesap.ad;
  _coreState.DB.transferler.push({
    id: 'tr_' + Date.now(),
    tarih,
    kTip, hTip,
    kaynakId: kaynakHesap ? kaynakHesap.id : null,
    hedefId:  hedefHesap  ? hedefHesap.id  : null,
    kaynakPb, hedefPb,
    tutar,
    aciklama: aciklama || `${kaynakLabel} → ${hedefLabel}`,
  });

  _appCoreBase.saveData();
  _modalGenel.closeModal('modal-transfer');
  try { _modalGenel.showToast(`✅ ${_format.fmtCur(tutar, kaynakPb)} transfer edildi`, 'success'); } catch(e) {}
  try { _wrapRegistry.call('renderTransferLog'); } catch(e) {}
  try { if (typeof renderHesaplar === 'function') renderHesaplar(); } catch(e) {}
  try { if (typeof renderOzet === 'function') renderOzet(); } catch(e) {}
  try { _hesapEntegrasyonMotoru._updateTopbarBakiye(); } catch(e) {}
}
// [KALDIRILDI] "export { saveTransfer as saveTransfer__transfer_modal }" hiçbir
// dosya tarafından import edilmiyordu (ölü kod taraması, 2026-07). Fonksiyonun
// kendisi ve _wrapRegistry.register('saveTransfer', ...) çağrısı hâlâ kullanımda.
// [ES module] taban tanım, odeme/patches zincirinin hook/wrap edebilmesi
// için wrap-registry'ye kaydediliyor.
whenReady('core.wrapRegistry', () => {
  _wrapRegistry.register('saveTransfer', saveTransfer);
});

// ── Transfer Logu ────────────────────────────────────────────
// [KALDIRILDI] Bu bölümde eskiden _transferLogFiltreLabelGuncelle() ve
// ölü renderTransferLog() taban tanımı vardı (registry'de hiç kayıtlı
// olmadığı için hiçbir zaman çalışmıyordu). "Son Transferler" render
// mantığının tamamı artık tek parça halinde
// js/ui/components/transfer-log.js içinde.

// ── Bir önceki transferi tekrarla: kaynak/hedef/tutar/açıklamayı forma doldurur ──
export function tekrarlaTransfer(id) {
  if (!_coreState.DB.transferler) return;
  const t = _coreState.DB.transferler.find(x => x.id === id);
  if (!t) { _modalGenel.showToast('Transfer kaydı bulunamadı', 'error'); return; }

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

  _moneyInput.setMoneyInput('transfer-tutar', t.tutar);
  document.getElementById('transfer-aciklama').value = t.aciklama || '';
  _moneyInput.setDateInputValue('transfer-tarih', _format.localDateStr(new Date()));
  _updateTransferTutarTumBtn();
  _updateTransferTutarHint();

  if (!kOk || !hOk) {
    _modalGenel.showToast('Kaynak/hedeften biri artık uygun değil (bakiye/durum) — lütfen yeniden seçin', 'error');
  }
}

export function deleteTransfer(id) {
  if (!_coreState.DB.transferler) return;
  _coreState.DB.transferler = _coreState.DB.transferler.filter(t => t.id !== id);
  _appCoreBase.saveData();
  _wrapRegistry.call('renderTransferLog');
}


// ============================================================
// [DI-MIGRATION] ui.components.transferModal — container'a kayıt
// ============================================================
import { provide } from '@core/container.js';
provide('ui.components.transferModal', {
  openTransferModal, _parseTransferSel, _nakitCurrencyList,
  _populateTransferHesaplar, swapTransferHesaplar, _checkNakitNakit,
  onTransferKaynakChange, onTransferHedefChange,
  get _transferCurrentStep() { return _transferCurrentStep; },
  TRANSFER_STEP_COUNT, transferStepGoto, _transferKaynakKullanilabilirBakiye,
  transferTutarTumunuKullan, _updateTransferTutarTumBtn,
  _updateTransferTutarHint, _transferValidateStep, transferStepNext,
  transferStepBack, _transferOzetHesapKarti, _transferOzetDoldur,
  tekrarlaTransfer, deleteTransfer,
});
