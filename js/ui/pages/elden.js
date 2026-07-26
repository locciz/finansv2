import { saveData } from '../../core/app-core-base.js';
import { tblFiltreKaydet, tblFiltreMultiToggle, tblFiltreOku, tblFiltreOkuMulti } from '../../core/app-core.js';
import { fmt, fmtCur, fmtDate, localDateStr, uid } from '../../core/format.js';
import { ALL_CURRENCIES, CURRENCY_CONFIG, DB, defaultCurrency } from '../../core/state.js';
import { ISLEM_TUR, ODEME_YONTEM, ODEME_DURUM } from '../../core/constants.js';
import { buildCurrencyOptions } from '../../domain/doviz.js';
import { hesapKullanilabilirBakiye } from '../../domain/hesaplamalar.js';
import { formatIbanView } from '../../domain/iban-utils.js';
import { _ibanKopyalaVeToastGoster, renderIbanPicker } from '../components/iban-ui.js';
import { _sidebarDim, checkManuelKarsiTarafAndSave, phSet, showConfirm, showToast, validateRequiredFields } from '../components/modal-genel.js';
import { getMoneyInput, setDateInputValue, setMoneyInput, updateModalMoneyWraps } from '../components/money-input.js';
import { applyChipsToContainer, wireAllMoneyCurButtons } from '../components/select-to-chips.js';
import { swizBakiyeHintGuncelle, swizUpdateStepIndicator } from '../components/step-wizard.js';
import { bindTblFiltreChips, tblFiltreChipsHtml, tblFiltreChipsMultiHtml, tblFiltreClearHtml, tblFiltreClearMultiHtml, tblSiralamaAyarla, tblSiralamaBarHtml, tblSiralamaOku, tblSiralamaUygula } from '../components/tablo-filtre-sirala.js';
import { getAktifHesapOptionsByPb } from './hesaplar/01-genel-yardimcilar.js';
import { odEfektifDurum, odGetDurum, odOdendiMi, odSetDurum, odToggleBtn } from './odeme/01-genel-yardimcilar.js';
import { odLogEkle } from './odeme/03-odeme-log.js';
import { ODEME_DURUM_FILTRE_OPTS } from './odeme/08-popup-giris-noktalari.js';
import { getBanka } from './tanimlamalar/01-genel-yardimcilar.js';
import { getKategoriOpts, populateKategoriSelects } from './tanimlamalar/03-kategoriler.js';
import { closeModal, openModal } from '../components/modal-genel.js';
import { renderHesaplar } from './hesaplar/04-hesap-liste-render.js';
import { call, register } from '../../core/wrap-registry.js';
// Orijinal 02-core-app-engine.js içinden çıkarıldı. İçerik değiştirilmedi.

// ==== 02-core-app-engine.js'den taşınan modül state'i ====
// ========== ELDEN ==========
export var editEldenId = null;
// ── Elden Ödeme Modal: Step Wizard ──────────────────────────────────────
export var _eldenCurrentStep = 1;
export var ELDEN_STEP_COUNT = 3;
export function openEldenModal() {
  editEldenId = null;
  eldenStepGoto(1);
  document.getElementById('elden-modal-title').textContent = 'Elden Ödeme Ekle';
  setDateInputValue('elden-tarih', localDateStr(new Date()));
  document.getElementById('elden-tur').value = ISLEM_TUR.GIDER;
  const eldenDirektOdendiEl = document.getElementById('elden-direkt-odendi-toggle');
  if(eldenDirektOdendiEl) eldenDirektOdendiEl.checked = true;
  document.getElementById('elden-aciklama').value = '';
  populateKategoriSelects();
  document.getElementById('elden-kategori').value = '';
  setMoneyInput('elden-tutar', '');
  document.getElementById('elden-yontem').value = ODEME_YONTEM.NAKIT;
  document.getElementById('elden-hesap-wrap').style.display = 'none';
  document.getElementById('elden-karsi-iban-wrap').style.display = 'none';
  document.getElementById('elden-hesap-bilgi-wrap').style.display = 'none';
  document.getElementById('elden-karsi-iban').value = '';
  document.getElementById('elden-karsi-ad').value = '';
  const uyariEl = document.getElementById('elden-karsi-iban-uyari');
  if(uyariEl) uyariEl.style.display = 'none';
  populateEldenKisiSelect();
  // KT block sıfırla
  const eldenKtBlock = document.getElementById('elden-kt-block');
  if (eldenKtBlock) eldenKtBlock.dataset.mode = 'kayitli';
  const eldenKtToggle = document.getElementById('elden-kt-toggle');
  if (eldenKtToggle) eldenKtToggle.textContent = '✏️ Manuel gir';
  const eldenIbanField = document.getElementById('elden-iban-field');
  if (eldenIbanField) eldenIbanField.style.display = 'none';
  // Para birimi — hesap listesi bu seçime göre filtrelenecek, o yüzden önce doldur
  const pbSel = document.getElementById('elden-para-birimi');
  if(pbSel) {
    if(typeof ALL_CURRENCIES !== 'undefined' && ALL_CURRENCIES.length) {
      pbSel.innerHTML = buildCurrencyOptions();
    } else {
      pbSel.innerHTML = '<option value="TRY">TRY ₺</option><option value="USD">USD $</option><option value="EUR">EUR €</option>';
    }
    pbSel.value = defaultCurrency || 'TRY';
  }
  populateEldenHesapSelect();
  openModal('modal-elden');
}

export function eldenStepGoto(step) {
  step = Math.max(1, Math.min(ELDEN_STEP_COUNT, step));
  _eldenCurrentStep = step;
  const modal = document.getElementById('modal-elden');
  if (!modal) return;
  // ---- Saf DOM güncelleme: js/ui/components/step-wizard.js:swizUpdateStepIndicator ----
  swizUpdateStepIndicator(modal, step);
  const backBtn = document.getElementById('elden-step-back-btn');
  const nextBtn = document.getElementById('elden-step-next-btn');
  const saveBtn = document.getElementById('elden-step-save-btn');
  if (backBtn) backBtn.style.display = step > 1 ? '' : 'none';
  if (nextBtn) nextBtn.style.display = step < ELDEN_STEP_COUNT ? '' : 'none';
  if (saveBtn) saveBtn.style.display = step === ELDEN_STEP_COUNT ? '' : 'none';
  const body = modal.querySelector('.modal-body');
  if (body) body.scrollTop = 0;
  if (step === 2) _updateEldenTutarTumBtn();
}
register('wizardStepGoto:modal-elden', eldenStepGoto);
register('wizardCurrentStep:modal-elden', () => _eldenCurrentStep);

export function _eldenValidateStep(step) {
  if (step === 1) {
    if (!validateRequiredFields([{id:'elden-tarih', msg:'Tarih giriniz'}])) return false;
    return true;
  }
  if (step === 2) {
    if (!validateRequiredFields([{id:'elden-tutar', msg:'Tutar giriniz'}])) return false;
    return true;
  }
  return true;
}

export function eldenStepNext() {
  if (!_eldenValidateStep(_eldenCurrentStep)) return;
  eldenStepGoto(_eldenCurrentStep + 1);
}

register('wizardStepNext:modal-elden', eldenStepNext);


export function eldenStepBack() {
  eldenStepGoto(_eldenCurrentStep - 1);
}

export function saveElden() {
  // Önce validasyon
  const _elden_tur0 = document.getElementById('elden-tur').value;
  const _elden_tut0 = getMoneyInput('elden-tutar')||0;
  if(!validateRequiredFields([{id:'elden-tutar',msg:'Tutar giriniz'},{id:'elden-tarih',msg:'Tarih giriniz'}])) return;
  const _elden_tarih0 = document.getElementById('elden-tarih').value;
  const _elden_yon0 = document.getElementById('elden-yontem').value;
  if(_elden_yon0 === ODEME_YONTEM.HAVALE) {
    // "Havale" + manuel giriş modundayken "Ad / Şirket" alanı ekranda * ile
    // zorunlu gösteriliyor ama adım-3 son adım olduğu için (İleri butonu yok,
    // sadece Kaydet) _eldenValidateStep hiç çalışmıyordu — bu yüzden burada,
    // kaydetmeden önce ayrıca denetleniyor.
    const _eldenKtBlock0 = document.getElementById('elden-kt-block');
    if (_eldenKtBlock0 && _eldenKtBlock0.dataset.mode === 'manuel') {
      if (!validateRequiredFields([{id:'elden-karsi-ad', msg:'Karşı taraf adı zorunlu'}])) return;
    }
    checkManuelKarsiTarafAndSave('elden', _doSaveElden); return;
  }
  _doSaveElden();
}

export function _doSaveElden() {
  const tur = document.getElementById('elden-tur').value;
  let tutar = getMoneyInput('elden-tutar')||0;
  if(tur===ISLEM_TUR.GIDER) tutar = -Math.abs(tutar);
  else tutar = Math.abs(tutar);

  const yontem = document.getElementById('elden-yontem').value;
  const hesapId = yontem===ODEME_YONTEM.HAVALE ? (document.getElementById('elden-hesap').value||null) : null;
  const karsiIban = yontem===ODEME_YONTEM.HAVALE ? (document.getElementById('elden-karsi-iban').value.replace(/\s+/g,'').toUpperCase()||null) : null;
  const karsiAd = yontem===ODEME_YONTEM.HAVALE ? (document.getElementById('elden-karsi-ad').value.trim()||null) : null;
  const karsiKisiId = yontem===ODEME_YONTEM.HAVALE ? (document.getElementById('elden-kisi').value||null) : null;
  const _eldenEskiKayit = editEldenId ? (DB.eldenler||[]).find(x=>x.id===editEldenId) : null;
  const _eldenEskiDurum = _eldenEskiKayit ? _eldenEskiKayit.odDurum : null;
  const _eldenDirektOdendi = !!document.getElementById('elden-direkt-odendi-toggle')?.checked;

  const elden = {
    id: editEldenId || uid(),
    tarih: document.getElementById('elden-tarih').value,
    aciklama: document.getElementById('elden-aciklama').value.trim(),
    kategori: document.getElementById('elden-kategori').value||null,
    tur,
    tutar,
    paraBirimi: (()=>{
      // Havale + hesap seçiliyse hesabın para birimini al
      if(yontem===ODEME_YONTEM.HAVALE && hesapId) {
        const h = (DB.hesaplar||[]).find(x=>x.id===hesapId);
        if(h && h.paraBirimi) return h.paraBirimi;
      }
      return (document.getElementById('elden-para-birimi')||{}).value || defaultCurrency || 'TRY';
    })(),
    yontem,
    hesapId,
    karsiIban,
    karsiAd,
    karsiKisiId,
    odDurum: _eldenEskiDurum || null
  };
  if(editEldenId) {
    // Düzenleme: bakiye etkisi artık kayıt anında değil, ödeme durumu (od-popup)
    // üzerinden entEldenYansit ile yönetiliyor — burada sadece kaydı güncelle.
    const idx = DB.eldenler.findIndex(e=>e.id===editEldenId);
    if(idx>=0) DB.eldenler[idx]=elden;
  } else {
    DB.eldenler.push(elden);
  }
  editEldenId = null;

  // Ödeme durumu: modal'daki "Direkt Ödendi Olarak Kaydet" toggle'ına göre uygula.
  // Açıksa: "Ödendi" olarak işaretle ve tutarı hemen bakiyeye yansıt (od-modal'a
  // ayrıca girmeye gerek kalmadan). Kapalıysa ve kayıt önceden ödendi/kısmiyken
  // şimdi kapatıldıysa: "Bekliyor"a döndür ve yansıtılan bakiyeyi geri al.
  const _eldenYeniTutarAbs = Math.abs(elden.tutar);
  if (_eldenDirektOdendi) {
    odSetDurum(elden, undefined, { durum: ODEME_DURUM.ODENDI, tarih: elden.tarih, tutar: _eldenYeniTutarAbs, not: '' });
    odLogEkle('elden', elden.id, undefined, ODEME_DURUM.ODENDI, _eldenYeniTutarAbs, '');
    call('_otoBakiyeGuncelle', 'elden', elden.id, undefined, ODEME_DURUM.ODENDI, _eldenYeniTutarAbs);
  } else if (odOdendiMi(_eldenEskiDurum)) {
    odSetDurum(elden, undefined, null);
    odLogEkle('elden', elden.id, undefined, ODEME_DURUM.BEKLIYOR, 0, '');
    call('_otoBakiyeGuncelle', 'elden', elden.id, undefined, ODEME_DURUM.BEKLIYOR, 0);
  }

  saveData();
  closeModal('modal-elden');
  renderElden();
}

export function deleteElden(id) {
  showConfirm('Bu kaydı silmek istiyor musunuz?', () => {
    const e = DB.eldenler.find(x=>x.id===id);
    if(e) {
      // Bakiyeyi geri al
      if(e.yontem === ODEME_YONTEM.HAVALE && e.hesapId) {
        const hesap = (DB.hesaplar||[]).find(h=>h.id===e.hesapId);
        if(hesap) hesap.bakiye = (hesap.bakiye||0) - e.tutar;
      } else if(e.yontem === ODEME_YONTEM.NAKIT) {
        const pb = e.paraBirimi || defaultCurrency || 'TRY';
        if(!DB._nakitBakiye) DB._nakitBakiye = {};
        DB._nakitBakiye[pb] = (DB._nakitBakiye[pb]||0) - e.tutar;
      }
    }
    DB.eldenler = DB.eldenler.filter(e=>e.id!==id);
    saveData();
    renderElden();
    renderHesaplar();
  });
}

export function eldenSirala(key, yon) {
  tblSiralamaAyarla('elden', key, yon);
  renderElden();
}

export function populateEldenKisiSelect() {
  const sel = document.getElementById('elden-kisi');
  if(!sel) return;
  const kisiler = DB.kisiler||[];
  sel.innerHTML = kisiler.map(k=>`<option value="${k.id}">${k.ad}${k.ibanlar&&k.ibanlar.length?' ('+k.ibanlar.length+' IBAN)':''}</option>`).join('');
  phSet(sel, 'Kişi seçin…', sel.value||'', '— Kişi bulunamadı —');
}

export function onEldenKisiChange() {
  const kisiId = document.getElementById('elden-kisi').value;
  const uyariEl = document.getElementById('elden-karsi-iban-uyari');
  if (uyariEl) uyariEl.style.display = 'none';
  const ibanField = document.getElementById('elden-iban-field');
  if (!kisiId) {
    if (ibanField) ibanField.style.display = 'none';
    document.getElementById('elden-karsi-iban').value = '';
    const p = document.getElementById('elden-iban-picker');
    if (p) p.style.display = 'none';
    return;
  }
  const k = (DB.kisiler||[]).find(x=>x.id===kisiId);
  if (!k) return;
  if (ibanField) ibanField.style.display = '';
  document.getElementById('elden-karsi-iban').value = '';
  renderIbanPicker(kisiId, 'elden-iban-picker', 'elden-iban-chips', 'elden-karsi-iban');
}

export function onEldenTurChange() {
  const tur = (document.getElementById('elden-tur')||{}).value || ISLEM_TUR.GIDER;
  const katEl = document.getElementById('elden-kategori');
  if(katEl) { katEl.innerHTML = getKategoriOpts(tur); phSet(katEl, 'Kategori seçin…', katEl.value||'', '— Kategori bulunamadı —'); }
  _updateEldenTutarTumBtn();
}

export function _eldenHesapKullanilabilirBakiye() {
  const tur = (document.getElementById('elden-tur')||{}).value || ISLEM_TUR.GIDER;
  const yontem = (document.getElementById('elden-yontem')||{}).value || ODEME_YONTEM.NAKIT;
  if (tur !== ISLEM_TUR.GIDER || yontem !== ODEME_YONTEM.HAVALE) return null;
  const hesapId = (document.getElementById('elden-hesap')||{}).value || '';
  return hesapKullanilabilirBakiye(hesapId);
}

export function eldenTutarTumunuKullan() {
  const kb = _eldenHesapKullanilabilirBakiye();
  if (!kb) { showToast('Önce kendi hesabınızı seçin', 'error'); return; }
  if (!(kb.tutar > 0)) { showToast('Kullanılabilir bakiye 0 veya negatif', 'error'); return; }
  setMoneyInput('elden-tutar', kb.tutar);
  _updateEldenTutarHint();
}

export function _updateEldenTutarTumBtn() {
  const btn = document.getElementById('elden-tutar-tum-btn');
  if (!btn) return;
  const kb = _eldenHesapKullanilabilirBakiye();
  btn.style.display = kb ? 'flex' : 'none';
  _updateEldenTutarHint();
}

export function _updateEldenTutarHint() {
  const hint = document.getElementById('elden-tutar-bakiye-hint');
  if (!hint) return;
  const kb = _eldenHesapKullanilabilirBakiye();
  if (!kb) { hint.style.display = 'none'; return; }
  hint.style.display = 'block';
  const tutar = getMoneyInput('elden-tutar') || 0;
  // ---- Saf DOM güncelleme: js/ui/components/step-wizard.js:swizBakiyeHintGuncelle ----
  swizBakiyeHintGuncelle(hint, tutar, kb);
}

export function onEldenHesapChangePb() {
  // Para birimi badge/select toggle based on selected elden-hesap
  const hesapId = document.getElementById('elden-hesap').value;
  const badge = document.getElementById('elden-para-birimi-badge');
  const sel   = document.getElementById('elden-para-birimi');
  if(hesapId && badge && sel) {
    const hesap = (DB.hesaplar||[]).find(h=>h.id===hesapId);
    const pb = (hesap && hesap.paraBirimi) || defaultCurrency || 'TRY';
    const cfg = CURRENCY_CONFIG[pb] || { symbol: pb };
    badge.textContent = pb + ' ' + cfg.symbol;
    badge.style.display = '';
    sel.style.display = 'none';
  } else if(badge && sel) {
    badge.style.display = 'none';
    sel.style.display = '';
  }
}

export function onEldenYontemChange() {
  const yontem = document.getElementById('elden-yontem').value;
  const havale = yontem === ODEME_YONTEM.HAVALE;
  document.getElementById('elden-hesap-wrap').style.display = havale ? '' : 'none';
  document.getElementById('elden-karsi-iban-wrap').style.display = havale ? '' : 'none';
  if(!havale) {
    document.getElementById('elden-hesap-bilgi-wrap').style.display = 'none';
    // Nakit'e geçince hesap seçimini sıfırla ve para birimi dropdown'ı geri getir
    const sel = document.getElementById('elden-hesap');
    if(sel) sel.value = '';
    onEldenHesapChangePb();
    // KT block sıfırla
    const eldenKtBlockYon = document.getElementById('elden-kt-block');
    if (eldenKtBlockYon) eldenKtBlockYon.dataset.mode = 'kayitli';
    const eldenKtToggleYon = document.getElementById('elden-kt-toggle');
    if (eldenKtToggleYon) eldenKtToggleYon.textContent = '✏️ Manuel gir';
    const eldenIbanFieldYon = document.getElementById('elden-iban-field');
    if (eldenIbanFieldYon) eldenIbanFieldYon.style.display = 'none';
    const eldenKisiSelYon = document.getElementById('elden-kisi');
    if (eldenKisiSelYon) eldenKisiSelYon.value = '';
    const eldenKarsiAdYon = document.getElementById('elden-karsi-ad');
    if (eldenKarsiAdYon) eldenKarsiAdYon.value = '';
    const eldenKarsiIbanYon = document.getElementById('elden-karsi-iban');
    if (eldenKarsiIbanYon) eldenKarsiIbanYon.value = '';
    _updateEldenTutarTumBtn();
  } else {
    // Seçili hesap varsa bilgileri doldur
    onEldenHesapChange();
  }
}

export function onEldenHesapChange() {
  const hesapId = document.getElementById('elden-hesap').value;
  const bilgiWrap = document.getElementById('elden-hesap-bilgi-wrap');
  onEldenHesapChangePb(); // Para birimi badge güncelle
  if(!hesapId) {
    bilgiWrap.style.display = 'none';
    _updateEldenTutarTumBtn();
    return;
  }
  const hesap = (DB.hesaplar||[]).find(h=>h.id===hesapId);
  if(!hesap) { bilgiWrap.style.display = 'none'; _updateEldenTutarTumBtn(); return; }

  // IBAN gruplu göster (4'lü)
  const ibanFormatted = hesap.iban ? hesap.iban.replace(/(.{4})/g,'$1 ').trim() : '—';
  const ibanDisplayEl = document.getElementById('elden-hesap-iban-display');
  if(ibanDisplayEl) ibanDisplayEl.textContent = ibanFormatted;
  bilgiWrap.style.display = hesap.iban ? '' : 'none';
  _updateEldenTutarTumBtn();
}

export function copyEldenHesapIban() {
  const el = document.getElementById('elden-hesap-iban-display');
  if(!el) return;
  const raw = el.textContent.replace(/\s+/g,'');
  if(!raw || raw==='—') return;
  _ibanKopyalaVeToastGoster(raw);
}

export function copyEldenKarsiIban() {
  const el = document.getElementById('elden-karsi-iban');
  if(!el) return;
  const raw = el.value.replace(/\s+/g,'').toUpperCase();
  if(!raw) { showToast('Kopyalanacak IBAN yok', 'error'); return; }
  _ibanKopyalaVeToastGoster(raw);
}

export function onEldenKarsiIbanInput() {
  const ibanEl = document.getElementById('elden-karsi-iban');
  const uyariEl = document.getElementById('elden-karsi-iban-uyari');
  const kisiEl = document.getElementById('elden-kisi');
  if(!uyariEl) return;
  const hasIban = ibanEl && ibanEl.value.replace(/\s+/g,'').length > 0;
  const hasKisi = kisiEl && kisiEl.value;
  uyariEl.style.display = (hasIban && !hasKisi) ? '' : 'none';
}

export function populateEldenHesapSelect() {
  const sel = document.getElementById('elden-hesap');
  if(!sel) return;
  const pbSel = document.getElementById('elden-para-birimi');
  const pb = (pbSel && pbSel.value) || defaultCurrency || 'TRY';
  sel.innerHTML = getAktifHesapOptionsByPb(pb);
  phSet(sel, 'Hesap seçin…', '', `— ${pb} cinsinden vadesiz hesap bulunamadı —`);
}

export function onEldenParaBirimiChange(pb) {
  updateModalMoneyWraps('modal-elden', pb);
  populateEldenHesapSelect();
  onEldenHesapChangePb();
  const bilgiWrap = document.getElementById('elden-hesap-bilgi-wrap');
  if(bilgiWrap) bilgiWrap.style.display = 'none';
}

export function syncEldenManuelIban() {
  const manuel = document.getElementById('elden-karsi-iban-manuel');
  const hedef  = document.getElementById('elden-karsi-iban');
  if (manuel && hedef) hedef.value = manuel.value.replace(/\s+/g,'').toUpperCase();
}


export function setEldenTurFiltre(tur) {
  tblFiltreKaydet('elden', 'tur', tur);
  renderElden();
}

export function setEldenDurumFiltre(durum) {
  tblFiltreMultiToggle('elden', 'durum', durum);
  renderElden();
}

export function editElden(id) {
  editEldenId = id;
  eldenStepGoto(1);
  const e = DB.eldenler.find(x=>x.id===id);
  if(!e) return;
  document.getElementById('elden-modal-title').textContent = 'Kayıt Düzenle';
  setDateInputValue('elden-tarih', e.tarih);
  document.getElementById('elden-tur').value = e.tur;
  // Türe göre kategori listesini filtrele
  const katElEdit = document.getElementById('elden-kategori');
  if(katElEdit) { katElEdit.innerHTML = getKategoriOpts(e.tur); phSet(katElEdit, 'Kategori seçin…', e.kategori||'', '— Kategori bulunamadı —'); }
  document.getElementById('elden-aciklama').value = e.aciklama||'';
  setMoneyInput('elden-tutar', Math.abs(e.tutar));
  const eldenDirektOdendiEditEl = document.getElementById('elden-direkt-odendi-toggle');
  if(eldenDirektOdendiEditEl) eldenDirektOdendiEditEl.checked = odOdendiMi(odGetDurum(e));
  // Para birimi
  const pbSel = document.getElementById('elden-para-birimi');
  if(pbSel) {
    if(typeof ALL_CURRENCIES !== 'undefined' && ALL_CURRENCIES.length) {
      pbSel.innerHTML = buildCurrencyOptions();
    } else {
      pbSel.innerHTML = '<option value="TRY">TRY ₺</option><option value="USD">USD $</option><option value="EUR">EUR €</option>';
    }
    pbSel.value = e.paraBirimi || defaultCurrency || 'TRY';
  }
  // Yöntem
  const yontem = e.yontem||ODEME_YONTEM.NAKIT;
  document.getElementById('elden-yontem').value = yontem;
  populateEldenHesapSelect();
  populateEldenKisiSelect();
  document.getElementById('elden-hesap-wrap').style.display = yontem===ODEME_YONTEM.HAVALE ? '' : 'none';
  document.getElementById('elden-karsi-iban-wrap').style.display = yontem===ODEME_YONTEM.HAVALE ? '' : 'none';
  document.getElementById('elden-hesap').value = e.hesapId||'';
  document.getElementById('elden-karsi-iban').value = e.karsiIban||'';
  if(e.karsiIban) formatIbanView(document.getElementById('elden-karsi-iban'));
  document.getElementById('elden-karsi-ad').value = e.karsiAd||'';
  // Para birimi badge'ını güncelle
  onEldenHesapChangePb();
  // Hesap bilgilerini otomatik doldur
  if(yontem===ODEME_YONTEM.HAVALE && e.hesapId) onEldenHesapChange();
  else document.getElementById('elden-hesap-bilgi-wrap').style.display = 'none';
  _updateEldenTutarTumBtn();
  // KT block modu: kisiId varsa kayıtlı, karsiAd varsa manuel
  if (yontem === ODEME_YONTEM.HAVALE) {
    const eldenKtBlockEdit = document.getElementById('elden-kt-block');
    const eldenKtToggleEdit = document.getElementById('elden-kt-toggle');
    if (eldenKtBlockEdit) {
      if (e.kisiId) {
        eldenKtBlockEdit.dataset.mode = 'kayitli';
        if (eldenKtToggleEdit) eldenKtToggleEdit.textContent = '✏️ Manuel gir';
        const eldenIbanFieldEdit = document.getElementById('elden-iban-field');
        if (eldenIbanFieldEdit) eldenIbanFieldEdit.style.display = '';
        // kisiSelect'e değer set et
        const eldenKisiSel = document.getElementById('elden-kisi');
        if (eldenKisiSel) phSet(eldenKisiSel, 'Kişi seçin…', e.kisiId);
        renderIbanPicker(e.kisiId, 'elden-iban-picker', 'elden-iban-chips', 'elden-karsi-iban');
      } else if (e.karsiAd) {
        eldenKtBlockEdit.dataset.mode = 'manuel';
        if (eldenKtToggleEdit) eldenKtToggleEdit.textContent = '← Kayıtlıdan seç';
        // Manuel modda IBAN'ı manuel alana da yaz
        const eldenKarsiIbanManuelEl = document.getElementById('elden-karsi-iban-manuel');
        if (eldenKarsiIbanManuelEl) { eldenKarsiIbanManuelEl.value = e.karsiIban || ''; if(e.karsiIban) formatIbanView(eldenKarsiIbanManuelEl); }
      } else {
        eldenKtBlockEdit.dataset.mode = 'kayitli';
        if (eldenKtToggleEdit) eldenKtToggleEdit.textContent = '✏️ Manuel gir';
      }
    }
  }
  document.getElementById('modal-elden').classList.add('open'); document.body.classList.add('modal-open'); _sidebarDim(true);
  // NOT: bu fonksiyon openModal() sarmalayıcısını değil doğrudan classList.add('open')
  // kullanıyor — bu yüzden normalde modal açılışında otomatik tetiklenen popup
  // dönüşümü (applyChipsToContainer) burada manuel çağrılmazsa "Kendi Hesabım" gibi
  // alanlar düzenleme modunda düz/native select olarak kalıyordu.
  const _eldenModalEl = document.getElementById('modal-elden');
  if (_eldenModalEl) setTimeout(() => { applyChipsToContainer(_eldenModalEl); wireAllMoneyCurButtons(); }, 80);
}

export function renderElden() {
  const today = new Date(); today.setHours(0,0,0,0);
  const month = today.getMonth();
  const year = today.getFullYear();
  let ayGelir=0, ayGider=0, toplamNet=0;
  DB.eldenler.forEach(e=>{
    const dt = new Date(e.tarih+'T00:00:00');
    if(dt.getMonth()===month&&dt.getFullYear()===year) {
      if(e.tutar>0) ayGelir+=e.tutar;
      else ayGider+=Math.abs(e.tutar);
    }
    toplamNet+=e.tutar;
  });

  document.getElementById('elden-stats').innerHTML=`
    <div class="stat s-green"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div><div class="stat-label">Bu Ay Gelir</div><div class="stat-val green">${fmt(ayGelir)}</div></div>
    <div class="stat s-red"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg></div><div class="stat-label">Bu Ay Gider</div><div class="stat-val red">${fmt(ayGider)}</div></div>
    <div class="stat s-${toplamNet>=0?'green':'red'}"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="stat-label">Toplam Net</div><div class="stat-val ${toplamNet>=0?'green':'red'}">${fmt(toplamNet,true)}</div></div>`;

  const _eldenTurFiltre = tblFiltreOku('elden', 'tur');
  const _eldenDurumFiltre = tblFiltreOkuMulti('elden', 'durum');
  const eldenFiltreBarEl = document.getElementById('elden-filtre-bar');
  if(eldenFiltreBarEl) {
    eldenFiltreBarEl.innerHTML = tblFiltreChipsHtml('TÜR', [
      {value:'', label:'◆ Tümü'},
      {value:ISLEM_TUR.GELIR, label:'↑ Gelir'},
      {value:ISLEM_TUR.GIDER, label:'↓ Gider'}
    ], _eldenTurFiltre, 'setEldenTurFiltre') + tblFiltreClearHtml(_eldenTurFiltre, 'setEldenTurFiltre')
    + tblFiltreChipsMultiHtml('ÖDEME DURUMU', ODEME_DURUM_FILTRE_OPTS, _eldenDurumFiltre, 'setEldenDurumFiltre') + tblFiltreClearMultiHtml(_eldenDurumFiltre, 'setEldenDurumFiltre');
    // [ES module] onclick="setEldenTurFiltre(...)"/"setEldenDurumFiltre(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
    bindTblFiltreChips(eldenFiltreBarEl, { setEldenTurFiltre, setEldenDurumFiltre });
  }
  // ── Sıralama (DB.uiSiralama.elden içinde kalıcı) ──
  const _eldenAktifSirala = tblSiralamaOku('elden', 'tarih', 'desc');
  const eldenSiralamaBarEl = document.getElementById('elden-siralama-bar');
  if(eldenSiralamaBarEl) {
    eldenSiralamaBarEl.innerHTML = tblSiralamaBarHtml([
      {key:'tarih', label:'Tarih', ikon:'takvim', yon:'desc'},
      {key:'tutar', label:'Tutar', ikon:'tutar', yon:'desc'},
      {key:'kategori', label:'Kategori', ikon:'harf', yon:'asc'}
    ], _eldenAktifSirala, 'eldenSirala');
    // [ES module] onclick="eldenSirala(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
    bindTblFiltreChips(eldenSiralamaBarEl, { eldenSirala });
  }
  const sorted = tblSiralamaUygula(DB.eldenler, _eldenAktifSirala, {
    tarih: (a,b)=>String(a.tarih||'').localeCompare(String(b.tarih||'')),
    tutar: (a,b)=>Math.abs(a.tutar||0)-Math.abs(b.tutar||0),
    kategori: (a,b)=>{
      const ka=(DB.kategoriler||[]).find(x=>x.id===a.kategori); const kb=(DB.kategoriler||[]).find(x=>x.id===b.kategori);
      return String(ka?ka.ad:a.kategori||'').localeCompare(String(kb?kb.ad:b.kategori||''),'tr');
    }
  })
    .filter(e => !_eldenTurFiltre || (e.tur===ISLEM_TUR.GELIR?ISLEM_TUR.GELIR:ISLEM_TUR.GIDER) === _eldenTurFiltre)
    .filter(e => !_eldenDurumFiltre.length || _eldenDurumFiltre.includes(odEfektifDurum(odGetDurum(e, undefined), e.tarih)));
  document.getElementById('elden-tbody').innerHTML = sorted.map(e=>{
    const katFind = (DB.kategoriler||[]).find(x=>x.id===e.kategori);
    const katLabel = katFind ? katFind.ikon+' '+katFind.ad : (e.kategori||'-');
    let yontemLabel = '💵 Nakit';
    if(e.yontem===ODEME_YONTEM.HAVALE) {
      const hesap = (DB.hesaplar||[]).find(h=>h.id===e.hesapId);
      const bankaAd = hesap ? getBanka(hesap.banka) : '';
      const hesapAd = hesap ? (bankaAd && bankaAd!=='-' ? bankaAd+' · '+hesap.ad : hesap.ad) : '';
      const karsiInfo = [e.karsiAd, e.karsiIban ? '···'+e.karsiIban.slice(-4) : ''].filter(Boolean).join(' / ');
      // Gelir: para karşı taraftan hesaba giriyor → "Karşı → Hesap"
      // Gider: para hesaptan karşı tarafa çıkıyor → "Hesap → Karşı"
      const yon = e.tur===ISLEM_TUR.GELIR
        ? (karsiInfo ? karsiInfo+' → '+(hesapAd||'?') : '')
        : (karsiInfo ? (hesapAd||'?')+' → '+karsiInfo : '');
      yontemLabel = `🏦 Havale${hesapAd && !karsiInfo ? '<div style="font-size:10px;color:var(--text3)">'+hesapAd+'</div>' : ''}${yon?'<div style="font-size:10px;color:var(--text3)">'+yon+'</div>':''}`;
    }
    return `<tr>
      <td class="mono">${fmtDate(e.tarih)}</td>
      <td>${e.aciklama||'-'}</td>
      <td><span class="badge ${e.tur===ISLEM_TUR.GELIR?'badge-green':'badge-red'}">${e.tur===ISLEM_TUR.GELIR?'Gelir':'Gider'}</span></td>
      <td class="mono ${e.tutar>=0?'green':'red'}">${fmtCur(Math.abs(e.tutar), e.paraBirimi||'TRY')}</td>
      <td><span class="badge badge-blue" style="font-family:var(--mono);letter-spacing:.03em">${e.paraBirimi||'TRY'}</span></td>
      <td>${katLabel}</td>
      <td style="font-size:12px">${yontemLabel}</td>
      <td>${odToggleBtn('elden', e.id, undefined, e.tarih, e.tutar, e.aciklama)}</td>
      <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm btn-act elden-edit-btn" data-id="${e.id}" style="margin-right:4px"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/></svg></button><button class="btn btn-danger btn-sm btn-act elden-del-btn" data-id="${e.id}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><polyline points="3,5 13,5"/><path d="M6 5V3h4v2M5 5l1 9h4l1-9"/></svg></button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:20px">${(_eldenTurFiltre||_eldenDurumFiltre.length)?'Bu filtreye uyan kayıt yok':'Kayıt yok'}</td></tr>`;
  // [ES module] onclick="editElden(...)" ve onclick="deleteElden(...)" kaldırıldı.
  const eldenTbody = document.getElementById('elden-tbody');
  eldenTbody.querySelectorAll('.elden-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editElden(btn.getAttribute('data-id')));
  });
  eldenTbody.querySelectorAll('.elden-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteElden(btn.getAttribute('data-id')));
  });
}

// [ES module] taban render fonksiyonu(ları) odeme/patches zincirinin
// hook() ile sarmalayabilmesi için wrap-registry'ye kaydediliyor.
register('renderElden', renderElden);
