import { saveData } from '../../core/app-core-base.js';
import { tblFiltreKaydet, tblFiltreMultiToggle, tblFiltreOku, tblFiltreOkuMulti } from '../../core/app-core.js';
import { fmtCur, fmtDate, localDateStr, uid } from '../../core/format.js';
import { DB, defaultCurrency } from '../../core/state.js';
import { _fillPbManualSelect } from '../../domain/doviz.js';
import { getMaasOdemeGunu } from '../../domain/hesaplamalar.js';
import { formatIbanView } from '../../domain/iban-utils.js';
import { _ibanKopyalaVeToastGoster, renderIbanPicker } from '../components/iban-ui.js';
import { checkManuelKarsiTarafAndSave, phSet, showConfirm, showFieldError, showToast, validateRequiredFields } from '../components/modal-genel.js';
import { bindMoneyInputs, getMoneyInput, setDateInputValue, setMoneyInput, updateModalMoneyWraps } from '../components/money-input.js';
import { swizOzetSatirHtmlKisa, swizUpdateStepIndicator } from '../components/step-wizard.js';
import { openKontratPlan } from '../components/kontrat-plani.js';
import { bindTblFiltreChips, tblFiltreChipsHtml, tblFiltreChipsMultiHtml, tblFiltreClearHtml, tblFiltreClearMultiHtml, tblSiralamaAyarla, tblSiralamaBarHtml, tblSiralamaOku, tblSiralamaUygula } from '../components/tablo-filtre-sirala.js';
import { getAktifHesapOptionsByPb } from './hesaplar/01-genel-yardimcilar.js';
import { odEfektifDurum, odGetDurum, odKiraMaasOverride, odPlanlananTutar, odToggleBtn } from './odeme/01-genel-yardimcilar.js';
import { ODEME_DURUM_FILTRE_OPTS } from './odeme/08-popup-giris-noktalari.js';
import { closeModal, openModal } from '../components/modal-genel.js';
import { register } from '../../core/wrap-registry.js';
// Orijinal 02-core-app-engine.js içinden çıkarıldı. İçerik değiştirilmedi.

// ==== 02-core-app-engine.js'den taşınan modül state'i ====
// ── Maaş Modal: Step Wizard ──────────────────────────────────────────
export var _maasCurrentStep = 1;
export var MAAS_STEP_COUNT = 3;
// [ES module] editMaasId orijinal kodda var/let olmadan atanıyordu
// (implicit global) - ES module strict mode'da ReferenceError fırlatır.
// Davranış korunarak top-level değişken olarak tanımlandı.
export var editMaasId = null;
export function openMaasModal() {
  editMaasId = null;
  maasStepGoto(1);
  document.getElementById('maas-modal-title').textContent = 'Maaş Geliri Ekle';
  document.getElementById('maas-aciklama').value = '';
  setMoneyInput('maas-tutar', '');
  document.getElementById('maas-gun').value = '';
  // Kısa ay panel sıfırla
  const kisaWrapR = document.getElementById('maas-gun-kisa-ay-wrap');
  const kisaBilgiR = document.getElementById('maas-gun-kisa-ay-bilgi');
  if(kisaWrapR) kisaWrapR.style.display = 'none';
  if(kisaBilgiR) kisaBilgiR.style.display = 'none';
  const kisaDavranisEl = document.getElementById('maas-gun-kisa-ay-davranis');
  if(kisaDavranisEl) kisaDavranisEl.value = 'son-gun';
  setDateInputValue('maas-baslangic', '');
  setDateInputValue('maas-bitis', '');
  setDateInputValue('maas-tekseferlik-tarih', '');
  document.getElementById('maas-tur').value = 'surekli';
  document.getElementById('maas-gun-wrap').style.display = '';
  document.getElementById('maas-tarih-wrap').style.display = '';
  document.getElementById('maas-tekseferlik-tarih-wrap').style.display = 'none';
  // Ödeme yöntemi sıfırla
  const maasYontemEl = document.getElementById('maas-yontem');
  if(maasYontemEl) maasYontemEl.value = 'nakit';
  const maasHesapWrap = document.getElementById('maas-hesap-wrap');
  const maasKarsiWrap = document.getElementById('maas-karsi-wrap');
  const maasHesapBilgiWrap = document.getElementById('maas-hesap-bilgi-wrap');
  if(maasHesapWrap) maasHesapWrap.style.display = 'none';
  if(maasKarsiWrap) maasKarsiWrap.style.display = 'none';
  if(maasHesapBilgiWrap) maasHesapBilgiWrap.style.display = 'none';
  const maasKarsiAdEl = document.getElementById('maas-karsi-ad');
  const maasKarsiIbanEl = document.getElementById('maas-karsi-iban');
  const maasKarsiIbanManuelEl = document.getElementById('maas-karsi-iban-manuel');
  if(maasKarsiAdEl) maasKarsiAdEl.value = '';
  if(maasKarsiIbanEl) maasKarsiIbanEl.value = '';
  if(maasKarsiIbanManuelEl) maasKarsiIbanManuelEl.value = '';
  // Kişi select doldur
  const maasKisiSel = document.getElementById('maas-kisi');
  if(maasKisiSel) {
    const kisiler = DB.kisiler||[];
    maasKisiSel.innerHTML = kisiler.map(k=>`<option value="${k.id}">${k.ad}${k.ibanlar&&k.ibanlar.length?' ('+k.ibanlar.length+' IBAN)':''}</option>`).join('');
    phSet(maasKisiSel, 'Kişi seçin…', '', '— Kişi bulunamadı —');
  }
  // KT block sıfırla
  const maasKtBlockNew = document.getElementById('maas-kt-block');
  if (maasKtBlockNew) maasKtBlockNew.dataset.mode = 'kayitli';
  const maasKtToggleNew = document.getElementById('maas-kt-toggle');
  if (maasKtToggleNew) maasKtToggleNew.textContent = '✏️ Manuel gir';
  const maasIbanFieldNew = document.getElementById('maas-iban-field');
  if (maasIbanFieldNew) maasIbanFieldNew.style.display = 'none';
  // Banka hesabı ve para birimi
  _populateMaasHesapSel('', defaultCurrency || 'TRY');
  bindMoneyInputs(document.getElementById('modal-maas'));
  openModal('modal-maas');
}

export function onMaasGunChange() {
  const gun = parseInt(document.getElementById('maas-gun').value)||0;
  const kisaWrap = document.getElementById('maas-gun-kisa-ay-wrap');
  const kisaBilgi = document.getElementById('maas-gun-kisa-ay-bilgi');
  if(gun > 28) {
    if(kisaWrap) kisaWrap.style.display = '';
    const etkilenenAylar = [];
    if(gun >= 29) etkilenenAylar.push('Şubat');
    if(gun === 31) etkilenenAylar.push('Nisan, Haziran, Eylül, Kasım');
    if(kisaBilgi) {
      kisaBilgi.style.display = '';
      kisaBilgi.textContent = `⚠ ${gun}. gün bazı aylarda (${etkilenenAylar.join('; ')}) yoktur.`;
    }
  } else {
    if(kisaWrap) kisaWrap.style.display = 'none';
    if(kisaBilgi) kisaBilgi.style.display = 'none';
  }
}

export function maasTypeChange() {
  const tur = document.getElementById('maas-tur').value;
  const isTekSeferlik = tur === 'tekseferlik';
  document.getElementById('maas-gun-wrap').style.display = isTekSeferlik ? 'none' : '';
  document.getElementById('maas-tarih-wrap').style.display = isTekSeferlik ? 'none' : '';
  document.getElementById('maas-tekseferlik-tarih-wrap').style.display = isTekSeferlik ? '' : 'none';
}

export function maasStepGoto(step) {
  step = Math.max(1, Math.min(MAAS_STEP_COUNT, step));
  _maasCurrentStep = step;
  const modal = document.getElementById('modal-maas');
  if (!modal) return;
  // ---- Saf DOM güncelleme: js/ui/components/step-wizard.js:swizUpdateStepIndicator ----
  swizUpdateStepIndicator(modal, step);
  const backBtn = document.getElementById('maas-step-back-btn');
  const nextBtn = document.getElementById('maas-step-next-btn');
  const saveBtn = document.getElementById('maas-step-save-btn');
  if (backBtn) backBtn.style.display = step > 1 ? '' : 'none';
  if (nextBtn) nextBtn.style.display = step < MAAS_STEP_COUNT ? '' : 'none';
  if (saveBtn) saveBtn.style.display = step === MAAS_STEP_COUNT ? '' : 'none';
  const body = modal.querySelector('.modal-body');
  if (body) body.scrollTop = 0;
  if (step === MAAS_STEP_COUNT) _maasOzetDoldur();
}
register('wizardStepGoto:modal-maas', maasStepGoto);
register('wizardCurrentStep:modal-maas', () => _maasCurrentStep);

export function maasStepNext() {
  if (!_maasValidateStep(_maasCurrentStep)) return;
  maasStepGoto(_maasCurrentStep + 1);
}

register('wizardStepNext:modal-maas', maasStepNext);


export function maasStepBack() {
  maasStepGoto(_maasCurrentStep - 1);
}

export function saveMaas() {
  // Tüm validasyonlar burada — checkManuelKarsiTarafAndSave öncesinde
  const _maas_acik0 = document.getElementById('maas-aciklama').value.trim();
  const _maas_tut0 = getMoneyInput('maas-tutar')||0;
  if(!validateRequiredFields([{id:'maas-tutar',msg:'Tutar zorunlu'}])) return;
  const _maas_tur0 = document.getElementById('maas-tur').value;
  if(_maas_tur0 === 'tekseferlik') {
    if(!document.getElementById('maas-tekseferlik-tarih').value) { showFieldError('maas-tekseferlik-tarih', 'Ödeme tarihi zorunlu'); return; }
  } else {
    const _maas_gun0 = parseInt(document.getElementById('maas-gun').value)||0;
    if(!_maas_gun0 || _maas_gun0 < 1 || _maas_gun0 > 31) { showFieldError('maas-gun', 'Ödeme günü zorunlu (1-31)'); return; }
    if(!document.getElementById('maas-baslangic').value) { showFieldError('maas-baslangic', 'Başlangıç tarihi zorunlu'); return; }
  }
  const _maas_yon0 = (document.getElementById('maas-yontem')||{}).value || 'nakit';
  if(_maas_yon0 === 'havale') {
    checkManuelKarsiTarafAndSave('maas', _doSaveMaas); return;
  }
  _doSaveMaas();
}

export function _doSaveMaas() {
  const tur = document.getElementById('maas-tur').value;
  const isTekSeferlik = tur === 'tekseferlik';
  const aciklama = document.getElementById('maas-aciklama').value.trim() || 'Maaş';
  const tutar = getMoneyInput('maas-tutar')||0;

  const odemeYontem = (document.getElementById('maas-yontem')||{}).value || 'nakit';
  const hesapIdVal = odemeYontem === 'havale' ? ((document.getElementById('maas-hesap')||{}).value || null) : null;
  const karsiAd = odemeYontem === 'havale' ? ((document.getElementById('maas-karsi-ad')||{}).value || '') : '';
  const karsiIban = odemeYontem === 'havale' ? ((document.getElementById('maas-karsi-iban')||{}).value.replace(/\s+/g,'').toUpperCase() || '') : '';
  const kisiId = odemeYontem === 'havale' ? ((document.getElementById('maas-kisi')||{}).value || null) : null;

  let maas;
  if(isTekSeferlik) {
    const tekseferlikTarih = document.getElementById('maas-tekseferlik-tarih').value;
    maas = {
      id: editMaasId || uid(),
      aciklama, tutar,
      paraBirimi: getMaasPb(),
      hesapId: hesapIdVal,
      odemeYontem, karsiAd, karsiIban, kisiId,
      tur: 'tekseferlik',
      gun: new Date(tekseferlikTarih+'T00:00:00').getDate(),
      baslangic: tekseferlikTarih,
      bitis: tekseferlikTarih
    };
  } else {
    const gun = parseInt(document.getElementById('maas-gun').value)||0;
    const baslangic = document.getElementById('maas-baslangic').value;
    maas = {
      id: editMaasId || uid(),
      aciklama, tutar,
      paraBirimi: getMaasPb(),
      hesapId: hesapIdVal,
      odemeYontem, karsiAd, karsiIban, kisiId,
      tur: 'surekli',
      gun,
      kisaAyDavranis: gun > 28 ? ((document.getElementById('maas-gun-kisa-ay-davranis')||{}).value || 'son-gun') : undefined,
      baslangic,
      bitis: document.getElementById('maas-bitis').value || null
    };
  }
  if(editMaasId) {
    const idx = DB.maaslar.findIndex(m=>m.id===editMaasId);
    if(idx>=0) DB.maaslar[idx]=maas;
  } else {
    DB.maaslar.push(maas);
  }
  editMaasId = null;
  saveData();
  closeModal('modal-maas');
  renderMaas();
}

export function deleteMaas(id) {
  showConfirm('Bu maaş kaydını silmek istiyor musunuz?', () => {
    DB.maaslar = DB.maaslar.filter(m=>m.id!==id);
    saveData();
    renderMaas();
  });
}

export function maasSirala(key, yon) {
  tblSiralamaAyarla('maas', key, yon);
  renderMaas();
}

export function populateMaasKisiSelects() {
  const sel = document.getElementById('maas-kisi');
  if(!sel) return;
  const kisiler = DB.kisiler||[];
  const prev = sel.value;
  sel.innerHTML = kisiler.map(k=>`<option value="${k.id}">${k.ad}${k.ibanlar&&k.ibanlar.length?' ('+k.ibanlar.length+' IBAN)':''}</option>`).join('');
  if(prev) sel.value = prev;
  phSet(sel, 'Kişi seçin…', sel.value||'', '— Kişi bulunamadı —');
}

export function onMaasHesapChange() {
  const hesapId = document.getElementById('maas-hesap').value;
  const manualRow = document.getElementById('maas-pb-manual-row');
  if(hesapId) {
    const hesap = (DB.hesaplar||[]).find(h=>h.id===hesapId);
    const pb = (hesap && hesap.paraBirimi) || defaultCurrency || 'TRY';
    updateModalMoneyWraps('modal-maas', pb);
    if(manualRow) manualRow.style.display = 'none';
  } else {
    if(manualRow) manualRow.style.display = '';
  }
}

export function onMaasPbManualChange() {
  const val = (document.getElementById('maas-para-birimi-manual')||{}).value || defaultCurrency || 'TRY';
  updateModalMoneyWraps('modal-maas', val);
  // Banka Hesabı listesini de yeni para birimine göre yeniden filtrele —
  // sadece seçilen para birimine ait vadesiz hesaplar görünsün.
  const hesapSel = document.getElementById('maas-hesap');
  if(hesapSel) {
    const prevVal = hesapSel.value;
    hesapSel.innerHTML = getAktifHesapOptionsByPb(val);
    const stillValid = [...hesapSel.options].some(o => o.value === prevVal && prevVal !== '');
    phSet(hesapSel, 'Hesap seçin…', stillValid ? prevVal : '', `— ${val} cinsinden vadesiz hesap bulunamadı —`);
    onMaasHesapChange();
  }
}

export function onMaasYontemChange() {
  const yontem = document.getElementById('maas-yontem').value;
  const havale = yontem === 'havale';
  const hesapWrap = document.getElementById('maas-hesap-wrap');
  const karsiWrap = document.getElementById('maas-karsi-wrap');
  if(hesapWrap) hesapWrap.style.display = havale ? '' : 'none';
  if(karsiWrap) karsiWrap.style.display = havale ? '' : 'none';
  if(!havale) {
    document.getElementById('maas-hesap-bilgi-wrap').style.display = 'none';
    const sel = document.getElementById('maas-hesap');
    if(sel) sel.value = '';
    onMaasHesapChange();
  } else {
    onMaasHesapFullChange();
  }
}

export function onMaasHesapFullChange() {
  const hesapId = document.getElementById('maas-hesap').value;
  const bilgiWrap = document.getElementById('maas-hesap-bilgi-wrap');
  onMaasHesapChange();
  if(!hesapId) { if(bilgiWrap) bilgiWrap.style.display = 'none'; return; }
  const hesap = (DB.hesaplar||[]).find(h=>h.id===hesapId);
  if(!hesap) { if(bilgiWrap) bilgiWrap.style.display = 'none'; return; }
  const ibanFormatted = hesap.iban ? hesap.iban.replace(/(.{4})/g,'$1 ').trim() : '—';
  const ibanDisplayEl = document.getElementById('maas-hesap-iban-display');
  if(ibanDisplayEl) ibanDisplayEl.textContent = ibanFormatted;
  if(bilgiWrap) bilgiWrap.style.display = hesap.iban ? '' : 'none';
}

export function copyMaasHesapIban() {
  const el = document.getElementById('maas-hesap-iban-display');
  if(!el) return;
  const raw = el.textContent.replace(/\s+/g,'');
  if(!raw || raw==='—') return;
  _ibanKopyalaVeToastGoster(raw);
}

export function onMaasKisiChange() {
  const kisiId = document.getElementById('maas-kisi').value;
  const ibanField = document.getElementById('maas-iban-field');
  if (!kisiId) {
    if (ibanField) ibanField.style.display = 'none';
    document.getElementById('maas-karsi-iban').value = '';
    const p = document.getElementById('maas-iban-picker');
    if (p) p.style.display = 'none';
    return;
  }
  const kisi = (DB.kisiler||[]).find(k=>k.id===kisiId);
  if (!kisi) return;
  if (ibanField) ibanField.style.display = '';
  document.getElementById('maas-karsi-iban').value = '';
  renderIbanPicker(kisiId, 'maas-iban-picker', 'maas-iban-chips', 'maas-karsi-iban');
}

export function syncMaasManuelIban() {
  const manuel = document.getElementById('maas-karsi-iban-manuel');
  const hedef  = document.getElementById('maas-karsi-iban');
  if (manuel && hedef) hedef.value = manuel.value.replace(/\s+/g,'').toUpperCase();
}


export function setMaasTurFiltre(tur) {
  tblFiltreKaydet('maas', 'tur', tur);
  renderMaas();
}

export function setMaasDurumFiltre(durum) {
  tblFiltreMultiToggle('maas', 'durum', durum);
  renderMaas();
}

export function _maasValidateStep(step) {
  if (step === 1) {
    const tur = (document.getElementById('maas-tur')||{}).value || 'surekli';
    const fields = [
      {id:'maas-tutar',    msg:'Tutar zorunlu'},
    ];
    if (tur === 'surekli') {
      fields.push({id:'maas-baslangic', msg:'Başlangıç tarihi zorunlu'});
    } else {
      fields.push({id:'maas-tekseferlik-tarih', msg:'Ödeme tarihi zorunlu'});
    }
    if (!validateRequiredFields(fields)) return false;
    // "Sürekli" seçiliyken Ödeme Günü (1-31) da zorunlu (bkz. maas-gun-wrap,
    // etikette * ile işaretli) — ama bu alan validateRequiredFields listesinde
    // olmadığından boş bırakılıp "İleri"ye geçilebiliyordu. Kayıt anında zaten
    // aynı kontrol yapılıyor (bkz. saveMaas), burada da adım geçişinde uygula.
    if (tur === 'surekli') {
      const gun = parseInt(document.getElementById('maas-gun').value) || 0;
      if (!gun || gun < 1 || gun > 31) {
        showFieldError('maas-gun', 'Ödeme günü zorunlu (1-31)');
        return false;
      }
    }
    return true;
  }
  return true;
}

export function _maasOzetDoldur() {
  const aciklama = (document.getElementById('maas-aciklama')||{}).value.trim() || '—';
  const tutar = getMoneyInput('maas-tutar') || 0;
  const pb = (document.getElementById('maas-para-birimi-manual')||{}).value || defaultCurrency || 'TRY';
  const tur = (document.getElementById('maas-tur')||{}).value || 'surekli';
  const gun = (document.getElementById('maas-gun')||{}).value || '';
  const bas = (document.getElementById('maas-baslangic')||{}).value || '';
  const bit = (document.getElementById('maas-bitis')||{}).value || '';
  const tekTarih = (document.getElementById('maas-tekseferlik-tarih')||{}).value || '';
  const yontem = (document.getElementById('maas-yontem')||{}).value || 'nakit';

  const satir = swizOzetSatirHtmlKisa;

  const fmtD = d => d ? (typeof fmtDate === 'function' ? fmtDate(d) : d) : '—';

  const el = document.getElementById('maas-ozet-icerik');
  if (!el) return;
  el.innerHTML = `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px 16px">
    ${satir('Açıklama', `<span style="font-family:inherit">${aciklama}</span>`)}
    ${satir('Tutar', fmtCur(tutar, pb))}
    ${satir('Tür', tur === 'surekli' ? '🔄 Sürekli (Aylık)' : '1️⃣ Tek Seferlik')}
    ${tur === 'surekli' && gun ? satir('Ödeme Günü', `Her ayın ${gun}. günü`) : ''}
    ${tur === 'surekli' ? satir('Dönem', `<span style="font-family:inherit">${fmtD(bas)} → ${bit ? fmtD(bit) : 'Süresiz'}</span>`) : ''}
    ${tur === 'tekseferlik' ? satir('Ödeme Tarihi', fmtD(tekTarih)) : ''}
    ${satir('Ödeme Yöntemi', yontem === 'havale' ? '🏦 Havale/EFT' : '💵 Nakit')}
  </div>`;
}

export function editMaas(id) {
  editMaasId = id;
  maasStepGoto(1);
  const m = DB.maaslar.find(x=>x.id===id);
  if(!m) return;
  document.getElementById('maas-modal-title').textContent = 'Maaş Düzenle';
  document.getElementById('maas-aciklama').value = m.aciklama||'';
  setMoneyInput('maas-tutar', m.tutar);
  // Banka hesabı ve para birimi
  _populateMaasHesapSel(m.hesapId||'', m.paraBirimi||defaultCurrency||'TRY');
  const isTekSeferlik = m.tur === 'tekseferlik';
  document.getElementById('maas-tur').value = isTekSeferlik ? 'tekseferlik' : 'surekli';
  if(isTekSeferlik) {
    setDateInputValue('maas-tekseferlik-tarih', m.baslangic||'');
    document.getElementById('maas-gun-wrap').style.display = 'none';
    document.getElementById('maas-tarih-wrap').style.display = 'none';
    document.getElementById('maas-tekseferlik-tarih-wrap').style.display = '';
  } else {
    document.getElementById('maas-gun').value = m.gun;
    setDateInputValue('maas-baslangic', m.baslangic);
    setDateInputValue('maas-bitis', m.bitis||'');
    document.getElementById('maas-gun-wrap').style.display = '';
    document.getElementById('maas-tarih-wrap').style.display = '';
    document.getElementById('maas-tekseferlik-tarih-wrap').style.display = 'none';
    // Kısa ay davranışı
    const gun = m.gun||1;
    const kisaWrapE = document.getElementById('maas-gun-kisa-ay-wrap');
    const kisaBilgiE = document.getElementById('maas-gun-kisa-ay-bilgi');
    const kisaDavranisElE = document.getElementById('maas-gun-kisa-ay-davranis');
    if(gun > 28) {
      if(kisaWrapE) kisaWrapE.style.display = '';
      if(kisaDavranisElE) kisaDavranisElE.value = m.kisaAyDavranis || 'son-gun';
      const etkilenenAylar = [];
      if(gun >= 29) etkilenenAylar.push('Şubat');
      if(gun === 31) etkilenenAylar.push('Nisan, Haziran, Eylül, Kasım');
      if(kisaBilgiE) { kisaBilgiE.style.display=''; kisaBilgiE.textContent=`⚠ ${gun}. gün bazı aylarda (${etkilenenAylar.join('; ')}) yoktur.`; }
    } else {
      if(kisaWrapE) kisaWrapE.style.display = 'none';
      if(kisaBilgiE) kisaBilgiE.style.display = 'none';
    }
  }
  // Kişi seçimini doldur
  const maasKisiSelEdit = document.getElementById('maas-kisi');
  if (maasKisiSelEdit) {
    const kisilerEdit = DB.kisiler || [];
    maasKisiSelEdit.innerHTML = kisilerEdit.map(ki => `<option value="${ki.id}">${ki.ad}${ki.ibanlar && ki.ibanlar.length ? ' (' + ki.ibanlar.length + ' IBAN)' : ''}</option>`).join('');
    phSet(maasKisiSelEdit, 'Kişi seçin…', m.kisiId || '', '— Kişi bulunamadı —');
  }
  // Ödeme yöntemi geri yükle
  const editYontemEl = document.getElementById('maas-yontem');
  const editYontem = m.odemeYontem || 'nakit';
  if(editYontemEl) editYontemEl.value = editYontem;
  const editHesapWrap = document.getElementById('maas-hesap-wrap');
  const editKarsiWrap = document.getElementById('maas-karsi-wrap');
  const editHesapBilgiWrap = document.getElementById('maas-hesap-bilgi-wrap');
  if(editYontem === 'havale') {
    if(editHesapWrap) editHesapWrap.style.display = '';
    if(editKarsiWrap) editKarsiWrap.style.display = '';
    // Karşı taraf alanları
    const karsiAdEl = document.getElementById('maas-karsi-ad');
    const karsiIbanEl = document.getElementById('maas-karsi-iban');
    if(karsiAdEl) karsiAdEl.value = m.karsiAd || '';
    if(karsiIbanEl) { karsiIbanEl.value = m.karsiIban || ''; if(m.karsiIban) formatIbanView(karsiIbanEl); }
    // KT block modu: kisiId varsa kayıtlı, karsiAd varsa manuel
    const maasKtBlockEdit = document.getElementById('maas-kt-block');
    const maasKtToggleEdit = document.getElementById('maas-kt-toggle');
    const maasIbanFieldEdit = document.getElementById('maas-iban-field');
    if (maasKtBlockEdit) {
      if (m.kisiId) {
        maasKtBlockEdit.dataset.mode = 'kayitli';
        if (maasKtToggleEdit) maasKtToggleEdit.textContent = '✏️ Manuel gir';
        if (maasIbanFieldEdit) maasIbanFieldEdit.style.display = '';
        renderIbanPicker(m.kisiId, 'maas-iban-picker', 'maas-iban-chips', 'maas-karsi-iban');
      } else if (m.karsiAd) {
        maasKtBlockEdit.dataset.mode = 'manuel';
        if (maasKtToggleEdit) maasKtToggleEdit.textContent = '← Kayıtlıdan seç';
        // Manuel modda IBAN'ı manuel alana da yaz
        const karsiIbanManuelEl = document.getElementById('maas-karsi-iban-manuel');
        if (karsiIbanManuelEl) { karsiIbanManuelEl.value = m.karsiIban || ''; if(m.karsiIban) formatIbanView(karsiIbanManuelEl); }
      } else {
        maasKtBlockEdit.dataset.mode = 'kayitli';
        if (maasKtToggleEdit) maasKtToggleEdit.textContent = '✏️ Manuel gir';
      }
    }
    // Hesap bilgisi - IBAN göster
    if(m.hesapId) {
      const hesap = (DB.hesaplar||[]).find(h=>h.id===m.hesapId);
      if(hesap && hesap.iban && editHesapBilgiWrap) {
        editHesapBilgiWrap.style.display = '';
        const ibanDisplayEl = document.getElementById('maas-hesap-iban-display');
        if(ibanDisplayEl) ibanDisplayEl.textContent = hesap.iban.replace(/(.{4})/g,'$1 ').trim();
      }
    }
  } else {
    if(editHesapWrap) editHesapWrap.style.display = 'none';
    if(editKarsiWrap) editKarsiWrap.style.display = 'none';
    if(editHesapBilgiWrap) editHesapBilgiWrap.style.display = 'none';
  }
  bindMoneyInputs(document.getElementById('modal-maas'));
  openModal('modal-maas');
}

export function renderMaas() {
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = localDateStr(today);
  const year = today.getFullYear();
  const month = today.getMonth();

  const _maasTurFiltre = tblFiltreOku('maas', 'tur');
  const _maasDurumFiltre = tblFiltreOkuMulti('maas', 'durum');
  const maasFiltreBarEl = document.getElementById('maas-filtre-bar');
  if(maasFiltreBarEl) {
    maasFiltreBarEl.innerHTML = tblFiltreChipsHtml('TÜR', [
      {value:'', label:'◆ Tümü'},
      {value:'surekli', label:'🔁 Düzenli'},
      {value:'tekseferlik', label:'◇ Tek Seferlik'}
    ], _maasTurFiltre, 'setMaasTurFiltre') + tblFiltreClearHtml(_maasTurFiltre, 'setMaasTurFiltre')
    + tblFiltreChipsMultiHtml('ÖDEME DURUMU', ODEME_DURUM_FILTRE_OPTS, _maasDurumFiltre, 'setMaasDurumFiltre') + tblFiltreClearMultiHtml(_maasDurumFiltre, 'setMaasDurumFiltre');
    // [ES module] onclick="setMaasTurFiltre(...)"/"setMaasDurumFiltre(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
    bindTblFiltreChips(maasFiltreBarEl, { setMaasTurFiltre, setMaasDurumFiltre });
  }
  // Kaydın bu ayki fiili ödeme durumu (bu ay aktif ödeme yoksa null döner)
  const _maasGuncelDurum = (m) => {
    const og = getMaasOdemeGunu(m, year, month);
    const payDt = og.sonraki ? new Date(year, month+1, og.gun) : new Date(year, month, og.gun);
    const payStr = localDateStr(payDt);
    const aktifAy = payStr>=m.baslangic && (!m.bitis||payStr<=m.bitis);
    if(!aktifAy) return null;
    const ay = payStr.slice(0,7);
    return odEfektifDurum(odGetDurum(m, ay), payStr);
  };
  // ── Sıralama (DB.uiSiralama.maas içinde kalıcı) ──
  const _maasAktifSirala = tblSiralamaOku('maas', 'varsayilan', 'asc');
  const maasSiralamaBarEl = document.getElementById('maas-siralama-bar');
  if(maasSiralamaBarEl) {
    maasSiralamaBarEl.innerHTML = tblSiralamaBarHtml([
      {key:'gun', label:'Ödeme Günü', ikon:'gun', yon:'asc'},
      {key:'tutar', label:'Tutar', ikon:'tutar', yon:'desc'},
      {key:'baslangic', label:'Başlangıç', ikon:'takvim', yon:'asc'}
    ], _maasAktifSirala, 'maasSirala');
    // [ES module] onclick="maasSirala(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
    bindTblFiltreChips(maasSiralamaBarEl, { maasSirala });
  }
  const maasSirali = tblSiralamaUygula(DB.maaslar, _maasAktifSirala, {
    gun: (a,b)=>(a.gun||0)-(b.gun||0),
    tutar: (a,b)=>(a.tutar||0)-(b.tutar||0),
    baslangic: (a,b)=>String(a.baslangic||'').localeCompare(String(b.baslangic||''))
  });
  const maaslarFiltreli = maasSirali
    .filter(m => !_maasTurFiltre || (m.tur==='tekseferlik'?'tekseferlik':'surekli') === _maasTurFiltre)
    .filter(m => !_maasDurumFiltre.length || _maasDurumFiltre.includes(_maasGuncelDurum(m)));

  // ── İstatistikler (para birimine göre gruplu — farklı dövizdeki maaşlar
  // tek bir toplamda karıştırılmasın diye) ──
  const maasAyKey = `${year}-${String(month+1).padStart(2,'0')}`;
  const maasGelirMap = {};
  DB.maaslar.forEach(m=>{
    const og = getMaasOdemeGunu(m, year, month);
    const payDt = og.sonraki ? new Date(year, month+1, og.gun) : new Date(year, month, og.gun);
    const payStr = localDateStr(payDt);
    if(payStr >= m.baslangic && (!m.bitis || payStr <= m.bitis)) {
      const ay = payStr.slice(0,7);
      const ov = odKiraMaasOverride(m, ay);
      const tutar = odPlanlananTutar(ov, m.tutar);
      if(tutar > 0) {
        const cur = m.paraBirimi || defaultCurrency || 'TRY';
        maasGelirMap[cur] = (maasGelirMap[cur]||0) + tutar;
      }
    }
  });
  // Yıllık tahmini gelir — önümüzdeki 12 ayın planlanan maaşları.
  // Sürekli maaşlar aktif aylarında, tek seferlik maaşlar sadece kendi tarihleri önümüzdeki 12 aya denk gelirse sayılır.
  const maasYillikMap = {};
  for(let off=0; off<12; off++) {
    const dt = new Date(year, month + off, 1);
    const y = dt.getFullYear();
    const mIdx = dt.getMonth();
    const ayKey12 = `${y}-${String(mIdx+1).padStart(2,'0')}`;
    DB.maaslar.forEach(m=>{
      let payStr = '';
      if(m.tur === 'tekseferlik') {
        payStr = m.baslangic || m.tarih || '';
        if(!payStr || payStr.slice(0,7) !== ayKey12) return;
      } else {
        const og12 = getMaasOdemeGunu(m, y, mIdx);
        const payDt12 = og12.sonraki ? new Date(y, mIdx+1, og12.gun) : new Date(y, mIdx, og12.gun);
        payStr = localDateStr(payDt12);
        if(!(payStr >= m.baslangic && (!m.bitis || payStr <= m.bitis))) return;
      }
      const ov = odKiraMaasOverride(m, payStr.slice(0,7));
      const tutar = odPlanlananTutar(ov, Math.abs(m.tutar||0));
      if(tutar > 0) {
        const cur = m.paraBirimi || defaultCurrency || 'TRY';
        maasYillikMap[cur] = (maasYillikMap[cur]||0) + tutar;
      }
    });
  }
  const fmtMultiCurMaas = (map) => {
    const entries = Object.entries(map).filter(([,v])=>v);
    if(!entries.length) return fmtCur(0, defaultCurrency);
    return entries.map(([cur,v]) => fmtCur(v, cur)).join(' + ');
  };

  const maasStatsEl = document.getElementById('maas-stats');
  if(maasStatsEl) maasStatsEl.innerHTML = `
    <div class="stat s-green"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div><div class="stat-label">Bu Ay Gelir</div><div class="stat-val green">${fmtMultiCurMaas(maasGelirMap)}</div></div>
    <div class="stat"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><div class="stat-label">Yıllık Tahmini</div><div class="stat-val">${fmtMultiCurMaas(maasYillikMap)}</div></div>`;


  document.getElementById('maas-tbody').innerHTML = maaslarFiltreli.map(m=>{
    const isTekSeferlik = m.tur === 'tekseferlik';
    return `<tr>
      <td>${m.aciklama}</td>
      <td class="mono green">${fmtCur(m.tutar, m.paraBirimi||defaultCurrency)}</td>
      <td class="mono">${isTekSeferlik ? '—' : m.gun+'. gün'}</td>
      <td class="mono">${fmtDate(m.baslangic)}</td>
      <td class="mono">${isTekSeferlik ? '<span style="color:var(--text3)">—</span>' : (m.bitis?fmtDate(m.bitis):'Süresiz')}</td>
      <td>${isTekSeferlik ? '<span class="badge badge-purple">Tek Seferlik</span>' : '<span class="badge badge-teal">Düzenli</span>'}</td>
      <td>${(()=>{ const today=new Date(); const og=getMaasOdemeGunu(m, today.getFullYear(), today.getMonth()); const payDt=og.sonraki ? new Date(today.getFullYear(), today.getMonth()+1, og.gun) : new Date(today.getFullYear(),today.getMonth(),og.gun); const payStr=localDateStr(payDt); const aktifAy=payStr>=m.baslangic&&(!m.bitis||payStr<=m.bitis); const ay=payStr.slice(0,7); return aktifAy ? odToggleBtn('maas',m.id,ay,payStr,m.tutar,m.aciklama) : '<span style="color:var(--text3);font-size:11px">—</span>'; })()}</td>
      <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm btn-act maas-plan-btn" data-id="${m.id}" style="margin-right:4px" title="Ödeme Planı"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 3V1.5M11 3V1.5M2 7h12"/><path d="M5 10h1M8 10h1M11 10h1M5 12.5h1M8 12.5h1"/></svg></button><button class="btn btn-ghost btn-sm btn-act maas-edit-btn" data-id="${m.id}" style="margin-right:4px"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/></svg></button><button class="btn btn-danger btn-sm btn-act maas-del-btn" data-id="${m.id}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><polyline points="3,5 13,5"/><path d="M6 5V3h4v2M5 5l1 9h4l1-9"/></svg></button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:20px">${(_maasTurFiltre||_maasDurumFiltre.length) ? 'Bu filtreyle eşleşen maaş kaydı yok' : 'Maaş tanımı yok'}</td></tr>`;
  // [ES module] onclick="openKontratPlan(...)", onclick="editMaas(...)", onclick="deleteMaas(...)" kaldırıldı.
  const maasTbody = document.getElementById('maas-tbody');
  maasTbody.querySelectorAll('.maas-plan-btn').forEach(btn => {
    btn.addEventListener('click', () => openKontratPlan('maas', btn.getAttribute('data-id')));
  });
  maasTbody.querySelectorAll('.maas-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editMaas(btn.getAttribute('data-id')));
  });
  maasTbody.querySelectorAll('.maas-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteMaas(btn.getAttribute('data-id')));
  });

  // Bu ay ödemeler
  const thisMonth = [];
  DB.maaslar.forEach(m=>{
    const og = getMaasOdemeGunu(m, year, month);
    const payDt = og.sonraki ? new Date(year, month+1, og.gun) : new Date(year, month, og.gun);
    const payStr = localDateStr(payDt);
    if(payStr >= m.baslangic && (!m.bitis || payStr <= m.bitis)) {
      thisMonth.push({...m, payDt});
    }
  });

  document.getElementById('maas-takvim').innerHTML = thisMonth.length ?
    `<div class="tbl-wrap"><table><thead><tr><th>Ödeme Tarihi</th><th>Açıklama</th><th>Para Bir.</th><th>Tutar</th><th>Durum</th></tr></thead><tbody>
    ${thisMonth.sort((a,b)=>a.gun-b.gun).map(p=>`<tr><td class="mono">${fmtDate(p.payDt)}</td><td>${p.aciklama}</td><td><span class="badge badge-blue" style="font-family:var(--mono)">${p.paraBirimi||defaultCurrency}</span></td><td class="mono green">${fmtCur(p.tutar, p.paraBirimi||defaultCurrency)}</td><td>${odToggleBtn('maas', p.id, localDateStr(p.payDt).slice(0,7), localDateStr(p.payDt), p.tutar, p.aciklama)}</td></tr>`).join('')}
    </tbody></table></div>` :
    '<div style="color:var(--text3);padding:16px;font-size:13px">Bu ay maaş ödemesi bulunmuyor.</div>';
}

export function getMaasPb() {
  const hesapId = document.getElementById('maas-hesap').value;
  if(hesapId) {
    const hesap = (DB.hesaplar||[]).find(h=>h.id===hesapId);
    return (hesap && hesap.paraBirimi) || defaultCurrency || 'TRY';
  }
  return (document.getElementById('maas-para-birimi-manual')||{}).value || defaultCurrency || 'TRY';
}

export function _populateMaasHesapSel(currentHesapId, currentPb) {
  const sel = document.getElementById('maas-hesap');
  if(!sel) return;
  const pb = currentPb || defaultCurrency || 'TRY';
  sel.innerHTML = getAktifHesapOptionsByPb(pb);
  phSet(sel, 'Hesap seçin…', currentHesapId || '', `— ${pb} cinsinden vadesiz hesap bulunamadı —`);
  _fillPbManualSelect('maas-para-birimi-manual', pb);
  onMaasHesapChange();
}

// [ES module] taban render fonksiyonu(ları) odeme/patches zincirinin
// hook() ile sarmalayabilmesi için wrap-registry'ye kaydediliyor.
register('renderMaas', renderMaas);
