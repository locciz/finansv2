import { saveData } from '../../core/app-core-base.js';
import { tblFiltreKaydet, tblFiltreMultiToggle, tblFiltreOku, tblFiltreOkuMulti } from '../../core/app-core.js';
import { isIsBgunu } from '../../core/date-utils.js';
import { fmtCur, fmtDate, localDateStr, uid } from '../../core/format.js';
import { DB, defaultCurrency } from '../../core/state.js';
import { _fillPbManualSelect } from '../../domain/doviz.js';
import { hesapKullanilabilirBakiye } from '../../domain/hesaplamalar.js';
import { formatIbanView } from '../../domain/iban-utils.js';
import { _ibanKopyalaVeToastGoster, renderIbanPicker } from '../components/iban-ui.js';
import { _markFieldError, checkManuelKarsiTarafAndSave, phSet, phUpdate, showConfirm, showToast, validateRequiredFields } from '../components/modal-genel.js';
import { bindMoneyInputs, getMoneyInput, setDateInputValue, setMoneyInput, updateModalMoneyWraps } from '../components/money-input.js';
import { swizBakiyeHintGuncelle, swizOzetSatirHtmlKisa, swizUpdateStepIndicator } from '../components/step-wizard.js';
import { bindTblFiltreChips, tblFiltreChipsHtml, tblFiltreChipsMultiHtml, tblFiltreClearHtml, tblFiltreClearMultiHtml, tblSiralamaAyarla, tblSiralamaBarHtml, tblSiralamaOku, tblSiralamaUygula } from '../components/tablo-filtre-sirala.js';
import { getAktifHesapOptionsByPb } from './hesaplar/01-genel-yardimcilar.js';
import { openKontratPlan } from '../components/kontrat-plani.js';
import { odEfektifDurum, odGetDurum, odKiraMaasOverride, odPlanlananTutar, odToggleBtn } from './odeme/01-genel-yardimcilar.js';
import { ODEME_DURUM_FILTRE_OPTS } from './odeme/08-popup-giris-noktalari.js';
import { getTatilSet } from './tanimlamalar/01-genel-yardimcilar.js';
import { closeModal, openModal } from '../components/modal-genel.js';
import { call, register } from '../../core/wrap-registry.js';
// Orijinal 02-core-app-engine.js içinden çıkarıldı. İçerik değiştirilmedi.

// ==== 02-core-app-engine.js'den taşınan modül state'i ====
// ========== KİRA ==========
export var editKiraId = null;
// ── Kira Modal: Step Wizard ──────────────────────────────────────────
export var _kiraCurrentStep = 1;
export var KIRA_STEP_COUNT = 4;
export function _kiraDepozitoHesapKullanilabilirBakiye() {
  const yontem = (document.getElementById('kira-yontem')||{}).value || 'nakit';
  if (yontem !== 'havale') return null;
  const hesapId = (document.getElementById('kira-hesap')||{}).value || '';
  return hesapKullanilabilirBakiye(hesapId);
}

export function kiraDepozitoTutarTumunuKullan() {
  const kb = _kiraDepozitoHesapKullanilabilirBakiye();
  if (!kb) { showToast('Önce banka hesabı seçin', 'error'); return; }
  if (!(kb.tutar > 0)) { showToast('Kullanılabilir bakiye 0 veya negatif', 'error'); return; }
  setMoneyInput('kira-depozito-tutar', kb.tutar);
  _updateKiraDepozitoTutarHint();
}

export function openKiraModal(id=null) {
  editKiraId = id;
  kiraStepGoto(1);
  document.getElementById('kira-modal-title').textContent = id ? 'Kontrat Düzenle' : 'Kira Kontratı Ekle';

  if(id) {
    const k = DB.kiralar.find(x=>x.id===id);
    if(k) {
      setDateInputValue('kira-baslangic', k.baslangic);
      setDateInputValue('kira-bitis', k.bitis);
      document.getElementById('kira-tur').value = k.tutar >= 0 ? 'gelir' : 'gider';
      setMoneyInput('kira-tutar', Math.abs(k.tutar));
      document.getElementById('kira-gun').value = k.gun;
      document.getElementById('kira-aciklama').value = k.aciklama||'';
      // Kısa ay davranışı
      const kisaDavranisEl = document.getElementById('kira-gun-kisa-ay-davranis');
      if(kisaDavranisEl) kisaDavranisEl.value = k.kisaAyDavranis || 'son-gun';
      onKiraGunChange();
      // Banka hesabı seçimi ve para birimi
      _populateKiraHesapSel(k.hesapId||'', k.paraBirimi||defaultCurrency||'TRY');
      // Ödeme yöntemi geri yükle
      const kiraEditYontem = k.odemeYontem || (k.hesapId ? 'havale' : 'nakit');
      const kiraYontemEl = document.getElementById('kira-yontem');
      if(kiraYontemEl) kiraYontemEl.value = kiraEditYontem;
      // Kişi seçimi doldur
      const kiraKisiSelEdit = document.getElementById('kira-kisi');
      if(kiraKisiSelEdit) {
        const kisilerE = DB.kisiler||[];
        kiraKisiSelEdit.innerHTML = kisilerE.map(ki=>`<option value="${ki.id}">${ki.ad}${ki.ibanlar&&ki.ibanlar.length?' ('+ki.ibanlar.length+' IBAN)':''}</option>`).join('');
        phSet(kiraKisiSelEdit, 'Kişi seçin…', k.kisiId||'', '— Kişi bulunamadı —');
        // Kayıtlı kişi varsa IBAN field'ını göster
        if (k.kisiId) {
          const kiraIbanField = document.getElementById('kira-iban-field');
          if (kiraIbanField) kiraIbanField.style.display = '';
          renderIbanPicker(k.kisiId, 'kira-iban-picker', 'kira-iban-chips', 'kira-karsi-iban');
        }
      }
      if(kiraEditYontem === 'havale') {
        const kiraHW = document.getElementById('kira-hesap-wrap');
        const kiraKW = document.getElementById('kira-karsi-wrap');
        if(kiraHW) kiraHW.style.display = '';
        if(kiraKW) kiraKW.style.display = '';
        const kiraKAdEl = document.getElementById('kira-karsi-ad');
        const kiraKIbanEl = document.getElementById('kira-karsi-iban');
        // KT block modu: kayıtlı kişi varsa kayıtlı mod, yoksa manuel mod
        const kiraKtBlock = document.getElementById('kira-kt-block');
        const kiraKtToggle = document.getElementById('kira-kt-toggle');
        if (kiraKtBlock) {
          if (k.kisiId) {
            kiraKtBlock.dataset.mode = 'kayitli';
            if (kiraKtToggle) kiraKtToggle.textContent = '✏️ Manuel gir';
          } else if (k.karsiAd) {
            kiraKtBlock.dataset.mode = 'manuel';
            if (kiraKtToggle) kiraKtToggle.textContent = '← Kayıtlıdan seç';
          }
        }
        if(kiraKAdEl) kiraKAdEl.value = k.karsiAd||'';
        if(kiraKIbanEl) { kiraKIbanEl.value = k.karsiIban||''; if(k.karsiIban) formatIbanView(kiraKIbanEl); }
        // IBAN göster
        if(k.hesapId) {
          const kiraHesapObj = (DB.hesaplar||[]).find(h=>h.id===k.hesapId);
          const kiraIbanWrap = document.getElementById('kira-hesap-iban-wrap');
          if(kiraHesapObj && kiraHesapObj.iban && kiraIbanWrap) {
            kiraIbanWrap.style.display = '';
            const kiraIbanDisplay = document.getElementById('kira-hesap-iban-display');
            if(kiraIbanDisplay) kiraIbanDisplay.textContent = kiraHesapObj.iban.replace(/(.{4})/g,'$1 ').trim();
          }
        }
      } else {
        const kiraHW = document.getElementById('kira-hesap-wrap');
        const kiraKW = document.getElementById('kira-karsi-wrap');
        const kiraIbanWrap = document.getElementById('kira-hesap-iban-wrap');
        if(kiraHW) kiraHW.style.display = 'none';
        if(kiraKW) kiraKW.style.display = 'none';
        if(kiraIbanWrap) kiraIbanWrap.style.display = 'none';
      }
      // Depozito
      const depVar = !!k.depozito;
      document.getElementById('kira-depozito-var').checked = depVar;
      toggleKiraDepozito();
      _fillPbManualSelect('kira-depozito-pb', (k.depozito&&k.depozito.paraBirimi)||k.paraBirimi||defaultCurrency||'TRY');
      if(depVar && k.depozito) {
        setMoneyInput('kira-depozito-tutar', k.depozito.tutar||'');
        setDateInputValue('kira-depozito-odeme-tarih', k.depozito.odemeTarih||'');
        setDateInputValue('kira-depozito-geri-tarih', k.depozito.geriTarih||'');
        document.getElementById('kira-depozito-not').value = k.depozito.not||'';
      }
    }
  } else {
    document.getElementById('kira-baslangic').value='';
    document.getElementById('kira-bitis').value='';
    document.getElementById('kira-tur').value='gelir';
    setMoneyInput('kira-tutar', '');
    document.getElementById('kira-gun').value='';
    document.getElementById('kira-aciklama').value='';
    const kisaDavranisElN = document.getElementById('kira-gun-kisa-ay-davranis');
    if(kisaDavranisElN) kisaDavranisElN.value = 'son-gun';
    const kisaWrapN = document.getElementById('kira-gun-kisa-ay-wrap');
    if(kisaWrapN) kisaWrapN.style.display = 'none';
    _populateKiraHesapSel('', defaultCurrency||'TRY');
    // Ödeme yöntemi sıfırla
    const kiraNewYontemEl = document.getElementById('kira-yontem');
    if(kiraNewYontemEl) kiraNewYontemEl.value = 'nakit';
    const kiraNewHesapWrap = document.getElementById('kira-hesap-wrap');
    const kiraNewKarsiWrap = document.getElementById('kira-karsi-wrap');
    const kiraNewIbanWrap = document.getElementById('kira-hesap-iban-wrap');
    if(kiraNewHesapWrap) kiraNewHesapWrap.style.display = 'none';
    if(kiraNewKarsiWrap) kiraNewKarsiWrap.style.display = 'none';
    if(kiraNewIbanWrap) kiraNewIbanWrap.style.display = 'none';
    const kiraNewKAdEl = document.getElementById('kira-karsi-ad');
    const kiraNewKIbanEl = document.getElementById('kira-karsi-iban');
    const kiraNewKIbanManuelEl = document.getElementById('kira-karsi-iban-manuel');
    if(kiraNewKAdEl) kiraNewKAdEl.value = '';
    if(kiraNewKIbanEl) kiraNewKIbanEl.value = '';
    if(kiraNewKIbanManuelEl) kiraNewKIbanManuelEl.value = '';
    // Kişi seçimi doldur
    const kiraKisiSelNew = document.getElementById('kira-kisi');
    if(kiraKisiSelNew) {
      const kisilerN = DB.kisiler||[];
      kiraKisiSelNew.innerHTML = kisilerN.map(k=>`<option value="${k.id}">${k.ad}${k.ibanlar&&k.ibanlar.length?' ('+k.ibanlar.length+' IBAN)':''}</option>`).join('');
      phSet(kiraKisiSelNew, 'Kişi seçin…', '', '— Kişi bulunamadı —');
    }
    // KT block sıfırla
    const kiraKtBlockNew = document.getElementById('kira-kt-block');
    if (kiraKtBlockNew) kiraKtBlockNew.dataset.mode = 'kayitli';
    const kiraKtToggleNew = document.getElementById('kira-kt-toggle');
    if (kiraKtToggleNew) kiraKtToggleNew.textContent = '✏️ Manuel gir';
    const kiraIbanFieldNew = document.getElementById('kira-iban-field');
    if (kiraIbanFieldNew) kiraIbanFieldNew.style.display = 'none';
    document.getElementById('kira-depozito-var').checked=false;
    _fillPbManualSelect('kira-depozito-pb', defaultCurrency||'TRY');
    toggleKiraDepozito();
  }
  bindMoneyInputs(document.getElementById('modal-kira'));
  openModal('modal-kira');
}

export function kiraStepGoto(step) {
  step = Math.max(1, Math.min(KIRA_STEP_COUNT, step));
  _kiraCurrentStep = step;
  const modal = document.getElementById('modal-kira');
  if (!modal) return;
  // ---- Saf DOM güncelleme: js/ui/components/step-wizard.js:swizUpdateStepIndicator ----
  swizUpdateStepIndicator(modal, step);
  const backBtn = document.getElementById('kira-step-back-btn');
  const nextBtn = document.getElementById('kira-step-next-btn');
  const saveBtn = document.getElementById('kira-step-save-btn');
  if (backBtn) backBtn.style.display = step > 1 ? '' : 'none';
  if (nextBtn) nextBtn.style.display = step < KIRA_STEP_COUNT ? '' : 'none';
  if (saveBtn) saveBtn.style.display = step === KIRA_STEP_COUNT ? '' : 'none';
  const body = modal.querySelector('.modal-body');
  if (body) body.scrollTop = 0;
  if (step === KIRA_STEP_COUNT) _kiraOzetDoldur();
}
register('wizardStepGoto:modal-kira', kiraStepGoto);
register('wizardCurrentStep:modal-kira', () => _kiraCurrentStep);

export function _kiraValidateStep(step) {
  if (step === 1) {
    if (!validateRequiredFields([
      {id:'kira-baslangic', msg:'Başlangıç tarihi zorunlu'},
      {id:'kira-bitis',     msg:'Bitiş tarihi zorunlu'},
      {id:'kira-tutar',     msg:'Aylık tutar zorunlu'}
    ])) return false;
    return true;
  }
  // "Havale" seçiliyken karşı taraf manuel giriş moduna geçilmişse Ad/Şirket
  // alanı ekranda * ile zorunlu gösteriliyor ama daha önce burada kontrol
  // edilmiyordu — boş bırakılıp bir sonraki adıma geçilebiliyordu.
  if (step === 2) {
    const yontem = (document.getElementById('kira-yontem')||{}).value || '';
    if (yontem === 'havale') {
      const ktBlock = document.getElementById('kira-kt-block');
      if (ktBlock && ktBlock.dataset.mode === 'manuel') {
        if (!validateRequiredFields([{id:'kira-karsi-ad', msg:'Karşı taraf adı zorunlu'}])) return false;
      }
    }
    return true;
  }
  // "Depozito Var" işaretliyken Depozito Tutarı da * ile zorunlu gösteriliyor,
  // aynı şekilde daha önce burada denetlenmiyordu.
  if (step === 3) {
    const depoVar = document.getElementById('kira-depozito-var')?.checked;
    if (depoVar) {
      const tutar = getMoneyInput('kira-depozito-tutar') || 0;
      if (!tutar || tutar <= 0) {
        showToast('Depozito tutarı zorunlu', 'error');
        _markFieldError('kira-depozito-tutar');
        return false;
      }
    }
    return true;
  }
  return true;
}

export function kiraStepNext() {
  if (!_kiraValidateStep(_kiraCurrentStep)) return;
  kiraStepGoto(_kiraCurrentStep + 1);
}

register('wizardStepNext:modal-kira', kiraStepNext);

export function kiraStepBack() {
  kiraStepGoto(_kiraCurrentStep - 1);
}

export function _kiraOzetDoldur() {
  const tur = (document.getElementById('kira-tur')||{}).value || 'gelir';
  const tutar = getMoneyInput('kira-tutar') || 0;
  const pb = (document.getElementById('kira-para-birimi-manual')||{}).value || 'TRY';
  const bas = (document.getElementById('kira-baslangic')||{}).value || '—';
  const bit = (document.getElementById('kira-bitis')||{}).value || '—';
  const gun = (document.getElementById('kira-gun')||{}).value || '—';
  const yontem = (document.getElementById('kira-yontem')||{}).value || 'nakit';
  const depVar = document.getElementById('kira-depozito-var')?.checked;
  const depTutar = depVar ? (getMoneyInput('kira-depozito-tutar')||0) : 0;
  const depPb = (document.getElementById('kira-depozito-pb')||{}).value || pb;

  const satir = swizOzetSatirHtmlKisa;

  const el = document.getElementById('kira-ozet-icerik');
  if (!el) return;
  el.innerHTML = `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px 16px">
    ${satir('Tür', tur === 'gelir' ? '📈 Gelir' : '📉 Gider')}
    ${satir('Aylık Tutar', fmtCur(tutar, pb))}
    ${satir('Dönem', `<span style="font-family:inherit">${fmtDate?fmtDate(bas):bas} → ${fmtDate?fmtDate(bit):bit}</span>`)}
    ${gun !== '—' ? satir('Ödeme Günü', `Her ayın ${gun}. günü`) : ''}
    ${satir('Ödeme Yöntemi', yontem === 'havale' ? '🏦 Havale/EFT' : '💵 Nakit')}
    ${depVar ? satir('Depozito', fmtCur(depTutar, depPb)) : ''}
  </div>`;
}

export function saveKira() {
  // Tüm validasyonlar burada — checkManuelKarsiTarafAndSave öncesinde
  const _kira_tut0 = getMoneyInput('kira-tutar')||0;
  if(!validateRequiredFields([{id:'kira-tutar',msg:'Tutar zorunlu'},{id:'kira-baslangic',msg:'Başlangıç tarihi zorunlu'},{id:'kira-bitis',msg:'Bitiş tarihi zorunlu'}])) return;
  const _kira_yon0 = (document.getElementById('kira-yontem')||{}).value || 'nakit';
  if(_kira_yon0 === 'havale') {
    checkManuelKarsiTarafAndSave('kira', _doSaveKira); return;
  }
  _doSaveKira();
}

export function _doSaveKira() {
  const tur = document.getElementById('kira-tur').value;
  const absTutar = getMoneyInput('kira-tutar')||0;
  const tutar = tur==='gider' ? -Math.abs(absTutar) : Math.abs(absTutar);
  const paraBirimi = getKiraPb();
  const hesapId = (document.getElementById('kira-hesap')||{}).value || null;

  // Depozito — tutar/tarih/not burada düzenlenir; ödendi/iade edildi durumu artık
  // ayrı bir alan değil, kira listesindeki "Ödeme Durumu" rozetinden (od-modal) yönetilir.
  const depVar = document.getElementById('kira-depozito-var').checked;
  let depozito = null;
  if(depVar) {
    depozito = {
      tutar: getMoneyInput('kira-depozito-tutar')||0,
      paraBirimi: (document.getElementById('kira-depozito-pb')||{}).value || getKiraPb(),
      odemeTarih: document.getElementById('kira-depozito-odeme-tarih').value||'',
      geriTarih: document.getElementById('kira-depozito-geri-tarih').value||'',
      not: document.getElementById('kira-depozito-not').value.trim()
    };
  }

  const kiraOdemeYontem = (document.getElementById('kira-yontem')||{}).value || 'nakit';
  const kiraKarsiAd = kiraOdemeYontem === 'havale' ? ((document.getElementById('kira-karsi-ad')||{}).value || '') : '';
  const kiraKarsiIban = kiraOdemeYontem === 'havale' ? ((document.getElementById('kira-karsi-iban')||{}).value.replace(/\s+/g,'').toUpperCase() || '') : '';
  const kiraKisiId = kiraOdemeYontem === 'havale' ? ((document.getElementById('kira-kisi')||{}).value || null) : null;

  // Düzenleme sırasında mevcut kayda ait ödeme durumu override'ları ve hesap
  // seçimleri kaybolmasın diye (kira.odemeOverrides, kira.taksitOverrides —
  // depozito'nun 'odeme'/'iade' bacakları burada tutulur — ve depozitoHesapId)
  // eski kayıttan devralınır.
  const eskiKira = editKiraId ? (DB.kiralar||[]).find(x=>x.id===editKiraId) : null;

  const kira = {
    id: editKiraId || uid(),
    baslangic: document.getElementById('kira-baslangic').value,
    bitis: document.getElementById('kira-bitis').value,
    tutar,
    paraBirimi,
    hesapId: kiraOdemeYontem === 'havale' ? (hesapId || null) : null,
    odemeYontem: kiraOdemeYontem,
    karsiAd: kiraKarsiAd,
    karsiIban: kiraKarsiIban,
    kisiId: kiraKisiId,
    gun: parseInt(document.getElementById('kira-gun').value)||15,
    kisaAyDavranis: (()=>{
      const gun = parseInt(document.getElementById('kira-gun').value)||15;
      return gun > 28 ? ((document.getElementById('kira-gun-kisa-ay-davranis')||{}).value || 'son-gun') : undefined;
    })(),
    aciklama: document.getElementById('kira-aciklama').value.trim(),
    depozito,
    odemeOverrides: eskiKira?.odemeOverrides,
    taksitOverrides: eskiKira?.taksitOverrides,
    depozitoHesapId: eskiKira?.depozitoHesapId
  };
  if(editKiraId) {
    const idx = DB.kiralar.findIndex(x=>x.id===editKiraId);
    if(idx>=0) DB.kiralar[idx]=kira;
  } else {
    DB.kiralar.push(kira);
  }
  editKiraId = null;
  saveData();
  closeModal('modal-kira');
  renderKira();
}

export function deleteKira(id) {
  showConfirm('Bu kontratı silmek istiyor musunuz?', () => {
    // Depozito verilme/alınma ve iade bacaklarının hesaba yansımış etkisini geri al
    call('_otoBakiyeGuncelle', 'depozito', id, 'odeme', null, 0);
    call('_otoBakiyeGuncelle', 'depozito', id, 'iade', null, 0);
    DB.kiralar = DB.kiralar.filter(k=>k.id!==id);
    saveData();
    renderKira();
  });
}

export function kiraPayInMonth(k, year, month) {
  const lastDay = new Date(year, month+1, 0).getDate();
  let day, nextMonth = false;
  if(k.gun <= lastDay) {
    day = k.gun;
  } else {
    // Gün bu ayda yok — kisaAyDavranis uygula
    const davranis = k.kisaAyDavranis || 'son-gun';
    if(davranis === 'son-gun') {
      day = lastDay;
    } else if(davranis === 'onceki') {
      const tatilSet = getTatilSet();
      let dt = new Date(year, month, lastDay);
      while(!isIsBgunu(dt, tatilSet)) dt.setDate(dt.getDate()-1);
      day = dt.getDate();
    } else if(davranis === 'sonraki') {
      // Sonraki ayın 1'ine kaydır — o ay için ödeme yok, sonraki aya taşındı
      nextMonth = true;
      day = 1;
    }
  }
  let payDt;
  if(nextMonth) {
    payDt = new Date(year, month+1, 1);
  } else {
    payDt = new Date(year, month, day);
  }
  const payStr = localDateStr(payDt);
  if(payStr >= k.baslangic && (!k.bitis || payStr <= k.bitis)) return payDt;
  return null;
}

export function kiraSirala(key, yon) {
  tblSiralamaAyarla('kira', key, yon);
  renderKira();
}

export function populateKiraKisiSelects() {
  const sel = document.getElementById('kira-kisi');
  if(!sel) return;
  const kisiler = DB.kisiler||[];
  const prev = sel.value;
  sel.innerHTML = kisiler.map(k=>`<option value="${k.id}">${k.ad}${k.ibanlar&&k.ibanlar.length?' ('+k.ibanlar.length+' IBAN)':''}</option>`).join('');
  if(prev) sel.value = prev;
  phSet(sel, 'Kişi seçin…', sel.value||'', '— Kişi bulunamadı —');
}

export function onKiraYontemChange() {
  const yontem = document.getElementById('kira-yontem').value;
  const havale = yontem === 'havale';
  const hesapWrap = document.getElementById('kira-hesap-wrap');
  const karsiWrap = document.getElementById('kira-karsi-wrap');
  if(hesapWrap) hesapWrap.style.display = havale ? '' : 'none';
  if(karsiWrap) karsiWrap.style.display = havale ? '' : 'none';
  if(!havale) {
    document.getElementById('kira-hesap-iban-wrap').style.display = 'none';
    const sel = document.getElementById('kira-hesap');
    if(sel) sel.value = '';
    onKiraHesapChange();
  } else {
    onKiraHesapFullChange();
  }
}

export function onKiraHesapFullChange() {
  const hesapId = document.getElementById('kira-hesap').value;
  const ibanWrap = document.getElementById('kira-hesap-iban-wrap');
  onKiraHesapChange();
  if(!hesapId) { if(ibanWrap) ibanWrap.style.display = 'none'; return; }
  const hesap = (DB.hesaplar||[]).find(h=>h.id===hesapId);
  if(!hesap) { if(ibanWrap) ibanWrap.style.display = 'none'; return; }
  const ibanFormatted = hesap.iban ? hesap.iban.replace(/(.{4})/g,'$1 ').trim() : '—';
  const ibanDisplayEl = document.getElementById('kira-hesap-iban-display');
  if(ibanDisplayEl) ibanDisplayEl.textContent = ibanFormatted;
  if(ibanWrap) ibanWrap.style.display = hesap.iban ? '' : 'none';
}

export function onKiraKisiChange() {
  const kisiId = document.getElementById('kira-kisi').value;
  const ibanField = document.getElementById('kira-iban-field');
  if (!kisiId) {
    if (ibanField) ibanField.style.display = 'none';
    document.getElementById('kira-karsi-iban').value = '';
    const p = document.getElementById('kira-iban-picker');
    if (p) p.style.display = 'none';
    return;
  }
  const kisi = (DB.kisiler||[]).find(k=>k.id===kisiId);
  if (!kisi) return;
  if (ibanField) ibanField.style.display = '';
  document.getElementById('kira-karsi-iban').value = '';
  renderIbanPicker(kisiId, 'kira-iban-picker', 'kira-iban-chips', 'kira-karsi-iban');
}

export function copyKiraHesapIban() {
  const el = document.getElementById('kira-hesap-iban-display');
  if(!el) return;
  const raw = el.textContent.replace(/\s+/g,'');
  if(!raw || raw==='—') return;
  _ibanKopyalaVeToastGoster(raw);
}

export function onKiraHesapChange() {
  const hesapId = document.getElementById('kira-hesap').value;
  const pbWrap = document.getElementById('kira-pb-manual-wrap');
  if(hesapId) {
    const hesap = (DB.hesaplar||[]).find(h=>h.id===hesapId);
    const pb = (hesap && hesap.paraBirimi) || defaultCurrency || 'TRY';
    const manualSel = document.getElementById('kira-para-birimi-manual');
    if(manualSel) { manualSel.value = pb; phUpdate(manualSel); }
    if(pbWrap) pbWrap.style.display = 'none';
  } else {
    if(pbWrap) pbWrap.style.display = '';
  }
  _updateKiraDepozitoTutarTumBtn();
}

export function onKiraPbManualChange() {
  // Para birimi değişince phUpdate ile renk güncelle
  const sel = document.getElementById('kira-para-birimi-manual');
  if(sel) phUpdate(sel);
  const pb = (sel && sel.value) || defaultCurrency || 'TRY';
  updateModalMoneyWraps('modal-kira', pb);
  // Banka Hesabı listesini de yeni para birimine göre yeniden filtrele —
  // sadece seçilen para birimine ait vadesiz hesaplar görünsün.
  const hesapSel = document.getElementById('kira-hesap');
  if(hesapSel) {
    const prevVal = hesapSel.value;
    hesapSel.innerHTML = getAktifHesapOptionsByPb(pb);
    const stillValid = [...hesapSel.options].some(o => o.value === prevVal && prevVal !== '');
    phSet(hesapSel, 'Hesap seçin…', stillValid ? prevVal : '', `— ${pb} cinsinden vadesiz hesap bulunamadı —`);
    onKiraHesapFullChange();
  }
}

export function onKiraGunChange() {
  const gun = parseInt(document.getElementById('kira-gun').value)||0;
  const kisaWrap = document.getElementById('kira-gun-kisa-ay-wrap');
  const kisaBilgi = document.getElementById('kira-gun-kisa-ay-bilgi');
  if(gun > 28) {
    if(kisaWrap) kisaWrap.style.display = '';
    const etkilenenAylar = [];
    if(gun >= 29) etkilenenAylar.push('Şubat');
    if(gun === 31) etkilenenAylar.push('Nisan, Haziran, Eylül, Kasım');
    if(kisaBilgi) kisaBilgi.textContent = `⚠ ${gun}. gün bazı aylarda (${etkilenenAylar.join('; ')}) yoktur.`;
  } else {
    if(kisaWrap) kisaWrap.style.display = 'none';
  }
}

export function syncKiraManuelIban() {
  const manuel = document.getElementById('kira-karsi-iban-manuel');
  const hedef  = document.getElementById('kira-karsi-iban');
  if (manuel && hedef) hedef.value = manuel.value.replace(/\s+/g,'').toUpperCase();
}


export function setKiraTurFiltre(tur) {
  tblFiltreKaydet('kira', 'tur', tur);
  renderKira();
}

export function setKiraDurumFiltre(durum) {
  tblFiltreMultiToggle('kira', 'durum', durum);
  renderKira();
}

export function toggleKiraDepozito() {
  const checked = document.getElementById('kira-depozito-var').checked;
  document.getElementById('kira-depozito-panel').style.display = checked ? '' : 'none';
  if(checked) _updateKiraDepozitoTutarTumBtn();
}

// Buton görünürlüğünü hesap seçimine göre günceller
export function _updateKiraDepozitoTutarTumBtn() {
  const btn = document.getElementById('kira-depozito-tutar-tum-btn');
  if (!btn) return;
  const kb = _kiraDepozitoHesapKullanilabilirBakiye();
  btn.style.display = kb ? 'flex' : 'none';
  _updateKiraDepozitoTutarHint();
}

// Girilen tutarı, hesabın kullanılabilir bakiyesiyle karşılaştıran ipucu
export function _updateKiraDepozitoTutarHint() {
  const hint = document.getElementById('kira-depozito-tutar-bakiye-hint');
  if (!hint) return;
  const kb = _kiraDepozitoHesapKullanilabilirBakiye();
  if (!kb) { hint.style.display = 'none'; return; }
  hint.style.display = 'block';
  const tutar = getMoneyInput('kira-depozito-tutar') || 0;
  // ---- Saf DOM güncelleme: js/ui/components/step-wizard.js:swizBakiyeHintGuncelle ----
  swizBakiyeHintGuncelle(hint, tutar, kb);
}

export function renderKira() {
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = localDateStr(today);
  const year = today.getFullYear();
  const month = today.getMonth();

  // NOT: kontratlar farklı para birimlerinde olabilir (paraBirimi alanı) — tutarlar
  // ham sayı olarak tek bir toplamda karıştırılırsa (eski davranış) yanlış/"bozuk"
  // bir toplam ortaya çıkar. Bu yüzden para birimine göre ayrı ayrı topluyoruz.
  const aylikGelirMap = {}, aylikGiderMap = {};
  const thisMonthPayments = [];
  const kiraAyKey = `${year}-${String(month+1).padStart(2,'0')}`;

  DB.kiralar.forEach(k=>{
    const payDt = kiraPayInMonth(k, year, month);
    if(payDt) {
      thisMonthPayments.push({...k, payDt});
      const ov = odKiraMaasOverride(k, kiraAyKey);
      const tutar = odPlanlananTutar(ov, k.tutar);
      if(tutar > 0) {
        const cur = k.paraBirimi || defaultCurrency || 'TRY';
        if(k.tutar>0) aylikGelirMap[cur] = (aylikGelirMap[cur]||0) + tutar;
        else aylikGiderMap[cur] = (aylikGiderMap[cur]||0) + tutar;
      }
    }
  });

  // Aktif kontrat sayısı: içinde bulunulan ayda ödeme günü olan ve tarih aralığı devam eden kontratlar.
  // Böylece geçmişte bitmiş veya henüz başlamamış kontratlar "aktif" sayılmaz.
  const kiraAktifKontratSayisi = DB.kiralar.filter(k => !!kiraPayInMonth(k, year, month)).length;

  // Aktif depozito: verildi/alındı olarak işaretlenmiş ama iadesi hâlâ bekleyen depozitolar.
  // Yani tarih aralığından bağımsız olarak gerçekten aktif risk/emanet kalan depozito toplamıdır.
  const depozitoMap = {};
  DB.kiralar.forEach(k=>{
    if(!k.depozito || !k.depozito.tutar) return;
    const odemeDurum = odGetDurum(k, 'odeme')?.durum;
    const iadeDurum  = odGetDurum(k, 'iade')?.durum;
    const verildi = odemeDurum === 'odendi' || odemeDurum === 'kismi';
    const iadeBekliyor = !(iadeDurum === 'odendi' || iadeDurum === 'iptal');
    if(verildi && iadeBekliyor) {
      const cur = k.depozito.paraBirimi || k.paraBirimi || defaultCurrency || 'TRY';
      depozitoMap[cur] = (depozitoMap[cur]||0) + Math.abs(k.depozito.tutar || 0);
    }
  });

  // Birden fazla para birimi varsa "₺5.000 + $200" gibi yan yana gösterir
  const fmtMultiCur = (map, sign) => {
    const entries = Object.entries(map).filter(([,v])=>v);
    if(!entries.length) return fmtCur(0, defaultCurrency, !!sign);
    return entries.map(([cur,v]) => fmtCur(v, cur, !!sign)).join(' + ');
  };
  const kiraParaBirimleri = [...new Set([...Object.keys(aylikGelirMap), ...Object.keys(aylikGiderMap)])];
  const netMap = {};
  kiraParaBirimleri.forEach(cur => { netMap[cur] = (aylikGelirMap[cur]||0) - (aylikGiderMap[cur]||0); });
  const kiraNetPozitif = kiraParaBirimleri.every(cur => netMap[cur] >= 0);

  document.getElementById('kira-stats').innerHTML=`
    <div class="stat s-green"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div><div class="stat-label">Bu Ay Gelir</div><div class="stat-val green">${fmtMultiCur(aylikGelirMap)}</div></div>
    <div class="stat s-red"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg></div><div class="stat-label">Bu Ay Gider</div><div class="stat-val red">${fmtMultiCur(aylikGiderMap)}</div></div>
    <div class="stat s-${kiraNetPozitif?'green':'red'}"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="stat-label">Bu Ay Net</div><div class="stat-val ${kiraNetPozitif?'green':'red'}">${kiraParaBirimleri.length ? kiraParaBirimleri.map(cur=>fmtCur(netMap[cur],cur,true)).join(' + ') : fmtCur(0, defaultCurrency, true)}</div></div>
    <div class="stat s-blue"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div class="stat-label">Aktif Kontrat</div><div class="stat-val">${kiraAktifKontratSayisi}</div></div>
    <div class="stat s-purple"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg></div><div class="stat-label">Aktif Depozito</div><div class="stat-val purple">${fmtMultiCur(depozitoMap)}</div></div>`;

  const _kiraTurFiltre = tblFiltreOku('kira', 'tur');
  const _kiraDurumFiltre = tblFiltreOkuMulti('kira', 'durum');
  const kiraFiltreBarEl = document.getElementById('kira-filtre-bar');
  if(kiraFiltreBarEl) {
    kiraFiltreBarEl.innerHTML = tblFiltreChipsHtml('TÜR', [
      {value:'', label:'◆ Tümü'},
      {value:'gelir', label:'↑ Gelir'},
      {value:'gider', label:'↓ Gider'}
    ], _kiraTurFiltre, 'setKiraTurFiltre') + tblFiltreClearHtml(_kiraTurFiltre, 'setKiraTurFiltre')
    + tblFiltreChipsMultiHtml('ÖDEME DURUMU', ODEME_DURUM_FILTRE_OPTS, _kiraDurumFiltre, 'setKiraDurumFiltre') + tblFiltreClearMultiHtml(_kiraDurumFiltre, 'setKiraDurumFiltre');
    // [ES module] onclick="setKiraTurFiltre(...)"/"setKiraDurumFiltre(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
    bindTblFiltreChips(kiraFiltreBarEl, { setKiraTurFiltre, setKiraDurumFiltre });
  }
  // Kontratın bu ayki fiili ödeme durumu (bu ay ödeme yoksa null döner)
  const _kiraGuncelDurum = (k) => {
    const today = new Date();
    const pd = kiraPayInMonth(k, today.getFullYear(), today.getMonth());
    if(!pd) return null;
    const ay = localDateStr(pd).slice(0,7);
    return odEfektifDurum(odGetDurum(k, ay), localDateStr(pd));
  };
  // ── Sıralama (DB.uiSiralama.kira içinde kalıcı) ──
  const _kiraAktifSirala = tblSiralamaOku('kira', 'varsayilan', 'asc');
  const kiraSiralamaBarEl = document.getElementById('kira-siralama-bar');
  if(kiraSiralamaBarEl) {
    kiraSiralamaBarEl.innerHTML = tblSiralamaBarHtml([
      {key:'gun', label:'Ödeme Günü', ikon:'gun', yon:'asc'},
      {key:'tutar', label:'Tutar', ikon:'tutar', yon:'desc'},
      {key:'bitis', label:'Bitiş Tarihi', ikon:'takvim', yon:'asc'}
    ], _kiraAktifSirala, 'kiraSirala');
    // [ES module] onclick="kiraSirala(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
    bindTblFiltreChips(kiraSiralamaBarEl, { kiraSirala });
  }
  const kiraSirali = tblSiralamaUygula(DB.kiralar, _kiraAktifSirala, {
    gun: (a,b)=>(a.gun||0)-(b.gun||0),
    tutar: (a,b)=>Math.abs(a.tutar||0)-Math.abs(b.tutar||0),
    bitis: (a,b)=>String(a.bitis||'').localeCompare(String(b.bitis||''))
  });
  const kiralarFiltreli = kiraSirali
    .filter(k => !_kiraTurFiltre || (k.tutar>=0?'gelir':'gider') === _kiraTurFiltre)
    .filter(k => !_kiraDurumFiltre.length || _kiraDurumFiltre.includes(_kiraGuncelDurum(k)));

  document.getElementById('kira-tbody').innerHTML = kiralarFiltreli.map(k=>{
    const tur = k.tutar >= 0 ? 'Gelir' : 'Gider';
    const cur = k.paraBirimi || 'TRY';
    let depBadge = '-';
    if(k.depozito) {
      const depCur = k.depozito.paraBirimi || cur;
      const depTutar = k.depozito.tutar || 0;
      const odemeBtn = odToggleBtn('depozito', k.id, 'odeme', k.depozito.odemeTarih||'', depTutar, 'Depozito Verildi/Alındı');
      const iadeBtn  = odToggleBtn('depozito', k.id, 'iade',  k.depozito.geriTarih||'',  depTutar, 'Depozito İadesi');
      depBadge = `<div style="font-size:11px;display:flex;flex-direction:column;gap:3px">
        <div style="color:var(--text3);font-size:10px">${fmtCur(depTutar,depCur)}</div>
        <div style="display:flex;gap:4px;align-items:center"><span style="color:var(--text3);font-size:10px;width:34px">Veriş:</span>${odemeBtn}</div>
        <div style="display:flex;gap:4px;align-items:center"><span style="color:var(--text3);font-size:10px;width:34px">İade:</span>${iadeBtn}</div>
      </div>`;
    }
    return `<tr>
      <td class="mono">${fmtDate(k.baslangic)}</td>
      <td class="mono">${fmtDate(k.bitis)}</td>
      <td><span class="badge badge-blue" style="font-family:var(--mono);letter-spacing:.03em">${cur}</span></td>
      <td class="mono ${k.tutar>=0?'green':'red'}">${fmtCur(Math.abs(k.tutar),cur)}</td>
      <td class="mono">${k.gun}</td>
      <td><span class="badge ${k.tutar>=0?'badge-green':'badge-red'}">${tur}</span></td>
      <td>${k.aciklama||'-'}</td>
      <td>${depBadge}</td>
      <td>${(()=>{ const today=new Date(); const pd=kiraPayInMonth(k,today.getFullYear(),today.getMonth()); const ay=pd?localDateStr(pd).slice(0,7):''; return ay ? odToggleBtn('kira',k.id,ay,pd?localDateStr(pd):'',Math.abs(k.tutar),k.aciklama) : '<span style="color:var(--text3);font-size:11px">—</span>'; })()}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm btn-act kira-plan-btn" data-id="${k.id}" style="margin-right:4px" title="Ödeme Planı"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 3V1.5M11 3V1.5M2 7h12"/><path d="M5 10h1M8 10h1M11 10h1M5 12.5h1M8 12.5h1"/></svg></button><button class="btn btn-ghost btn-sm btn-act kira-edit-btn" data-id="${k.id}" style="margin-right:4px"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/></svg></button>
        <button class="btn btn-danger btn-sm btn-act kira-del-btn" data-id="${k.id}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><polyline points="3,5 13,5"/><path d="M6 5V3h4v2M5 5l1 9h4l1-9"/></svg></button>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:20px">${(_kiraTurFiltre||_kiraDurumFiltre.length) ? 'Bu filtreyle eşleşen kontrat bulunamadı' : 'Kontrat yok'}</td></tr>`;
  // [ES module] onclick="openKontratPlan(...)", onclick="openKiraModal(...)", onclick="deleteKira(...)" kaldırıldı.
  const kiraTbody = document.getElementById('kira-tbody');
  kiraTbody.querySelectorAll('.kira-plan-btn').forEach(btn => {
    btn.addEventListener('click', () => openKontratPlan('kira', btn.getAttribute('data-id')));
  });
  kiraTbody.querySelectorAll('.kira-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openKiraModal(btn.getAttribute('data-id')));
  });
  kiraTbody.querySelectorAll('.kira-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteKira(btn.getAttribute('data-id')));
  });

  thisMonthPayments.sort((a,b)=>a.gun-b.gun);
  document.getElementById('kira-takvim').innerHTML = thisMonthPayments.length ?
    `<div class="tbl-wrap"><table><thead><tr><th>Ödeme Tarihi</th><th>Açıklama</th><th>Tür</th><th>Para Bir.</th><th>Tutar</th><th>Durum</th></tr></thead><tbody>
    ${thisMonthPayments.map(p=>`<tr>
      <td class="mono">${fmtDate(p.payDt)}</td>
      <td>${p.aciklama||'-'}</td>
      <td><span class="badge ${p.tutar>=0?'badge-green':'badge-red'}">${p.tutar>=0?'Gelir':'Gider'}</span></td>
      <td><span class="badge badge-blue" style="font-family:var(--mono)">${p.paraBirimi||'TRY'}</span></td>
      <td class="mono ${p.tutar>=0?'green':'red'}">${fmtCur(Math.abs(p.tutar), p.paraBirimi||'TRY')}</td>
      <td>${odToggleBtn('kira', p.id, localDateStr(p.payDt).slice(0,7), localDateStr(p.payDt), Math.abs(p.tutar), p.aciklama)}</td>
    </tr>`).join('')}
    </tbody></table></div>` :
    '<div style="color:var(--text3);padding:16px;font-size:13px">Bu ay kira ödemesi bulunmuyor.</div>';
}

export function getKiraPb() {
  const hesapId = document.getElementById('kira-hesap').value;
  if(hesapId) {
    const hesap = (DB.hesaplar||[]).find(h=>h.id===hesapId);
    return (hesap && hesap.paraBirimi) || defaultCurrency || 'TRY';
  }
  return (document.getElementById('kira-para-birimi-manual')||{}).value || defaultCurrency || 'TRY';
}

export function _populateKiraHesapSel(currentHesapId, currentPb) {
  const sel = document.getElementById('kira-hesap');
  if(!sel) return;
  const pb = currentPb || defaultCurrency || 'TRY';
  sel.innerHTML = getAktifHesapOptionsByPb(pb);
  phSet(sel, 'Hesap seçin…', currentHesapId || '', `— ${pb} cinsinden vadesiz hesap bulunamadı —`);
  _fillPbManualSelect('kira-para-birimi-manual', pb);
  onKiraHesapChange();
}

// [ES module] taban render fonksiyonu(ları) odeme/patches zincirinin
// hook() ile sarmalayabilmesi için wrap-registry'ye kaydediliyor.
register('renderKira', renderKira);
