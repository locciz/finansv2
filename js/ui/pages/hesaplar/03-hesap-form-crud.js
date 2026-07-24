import { saveData } from '../../../core/app-core-base.js';
import { fmtCur, localDateStr, uid } from '../../../core/format.js';
import { DB, defaultCurrency } from '../../../core/state.js';
import { buildCurrencyOptions } from '../../../domain/doviz.js';
import { parseIban } from '../../../domain/iban-utils.js';
import { _markFieldError, phSet, showConfirm, showToast, validateRequiredFields } from '../../components/modal-genel.js';
import { bindMoneyInputs, getMoneyInput, setDateInputValue, setMoneyInput } from '../../components/money-input.js';
import { swizOzetSatirHtml, swizUpdateStepIndicator } from '../../components/step-wizard.js';
import { HESAP_STEP_COUNT, _hesapCurrentStep, set_hesapCurrentStep } from './00-state.js';
import { hesapOtomatikGunlukKontrol } from './01-genel-yardimcilar.js';
import { onHesapTurChange } from './02-hesap-turu-tanimlama.js';
import { editHesapId, setEditHesapId } from './04-hesap-liste-render.js';
import { readKmhLimitGecmis, renderKmhLimitGecmis } from '../krediler/03-kmh-kredi.js';
import { renderMevduat } from '../mevduat/05-mevduat-liste-render.js';
import { bankaOptionMetin } from '../tanimlamalar/01-genel-yardimcilar.js';
import { readOtoGunlukOranGecmisi, renderOtoGunlukOranGecmis } from '../tanimlamalar/05-genel-oran-tablolari.js';
import { getSubeAdFromKodlar } from '../tanimlamalar/08-subeler.js';
import { closeModal, openModal } from '../../components/modal-genel.js';
import { renderHesaplar } from './04-hesap-liste-render.js';
import { register } from '../../../core/wrap-registry.js';
// ============================================================
// js/ui/pages/hesaplar/03-hesap-form-crud.js
// Hesap ekleme/düzenleme formu (step wizard)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/hesaplar.js
// (49 export, 991 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function openHesapModal(id=null) {
  setEditHesapId(id);
  hesapStepGoto(1);
  document.getElementById('hesap-modal-title').textContent = id ? 'Hesap Düzenle' : 'Banka Hesabı Ekle';

  // Hesap türü select — tanımlamalardan doldur
  const turSel = document.getElementById('hesap-tur');
  if(turSel) {
    const turler = DB.hesapTurleri || [];
    turSel.innerHTML = turler.map(t=>`<option value="${t.kod}">${t.ad}</option>`).join('');
    phSet(turSel, 'Hesap türü…', turSel.value||'', '— Hesap türü bulunamadı —');
  }

  // Banka select
  const sel = document.getElementById('hesap-banka');
  sel.innerHTML = DB.bankalar.map(b=>`<option value="${b.id}">${bankaOptionMetin(b)}</option>`).join('');
  phSet(sel, 'Banka seçin…', '', '— Banka bulunamadı —');

  // Para birimi select — her zaman yeniden doldur
  const curSel = document.getElementById('hesap-para-birimi');
  curSel.innerHTML = buildCurrencyOptions();

  if(id) {
    const h = (DB.hesaplar||[]).find(x=>x.id===id);
    if(h) {
      document.getElementById('hesap-iban').value = h.iban ? (h.iban.replace(/\s+/g,'').match(/.{1,4}/g)||[]).join(' ') : '';
      document.getElementById('hesap-banka-kodu').value = h.bankaKodu||'';
      document.getElementById('hesap-sube-kodu').value = h.subeKodu||'';
      document.getElementById('hesap-no').value = h.hesapNo||'';
      document.getElementById('hesap-parsed-row').style.display = h.iban ? '' : 'none';
      document.getElementById('hesap-iban-status').textContent = '';
      phSet(sel, 'Banka seçin…', h.banka||'', '— Banka bulunamadı —');
      document.getElementById('hesap-ad').value = h.ad||'';
      document.getElementById('hesap-tur').value = h.tur||'vadesiz';
      curSel.value = h.paraBirimi||'TRY';
      setMoneyInput('hesap-bakiye', h.bakiye||'');
      // Şube adı: subeKodu ve banka kodundan çek
      const subeAdVal = getSubeAdFromKodlar(h.bankaKodu, h.subeKodu) || h.subeAd || '';
      document.getElementById('hesap-sube-ad').value = subeAdVal;
      const dispEl = document.getElementById('hesap-sube-ad-display');
      if(dispEl) dispEl.textContent = subeAdVal || '—';
      document.getElementById('hesap-durum').value = h.durum||'aktif';
      document.getElementById('hesap-not').value = h.not||'';
      // Bakiye izleme eşikleri
      setMoneyInput('hesap-min-bakiye', h.minBakiye !== undefined ? h.minBakiye : '');
      setMoneyInput('hesap-hedef-bakiye', h.hedefBakiye !== undefined ? h.hedefBakiye : '');
      // KMH toggle — tur'dan değil, kmhLimit tanımlı mı diye bak
      const isKmh = !!(h.kmhLimit || (h.kmhLimitGecmisi && h.kmhLimitGecmisi.length));
      document.getElementById('hesap-kmh-toggle').checked = isKmh;
      document.getElementById('hesap-kmh-panel').style.display = isKmh ? '' : 'none';
      if(isKmh) {
        setMoneyInput('hesap-kmh-limit', h.kmhLimit||'');
        setDateInputValue('hesap-kmh-limit-tarih', h.kmhLimitTarih||localDateStr(new Date()));
        renderKmhLimitGecmis(h.kmhLimitGecmisi||[], h.paraBirimi||'TRY');
      } else {
        setMoneyInput('hesap-kmh-limit', '');
        setDateInputValue('hesap-kmh-limit-tarih', localDateStr(new Date()));
        renderKmhLimitGecmis([], h.paraBirimi||'TRY');
      }
      // Otomatik günlük vadeli toggle
      document.getElementById('hesap-oto-gunluk-toggle').checked = !!h.otoGunlukVadeli;
      document.getElementById('hesap-oto-gunluk-panel').style.display = h.otoGunlukVadeli ? '' : 'none';
      document.getElementById('hesap-oto-gunluk-faiz').value = h.otoGunlukFaizOran != null ? h.otoGunlukFaizOran : '';
      document.getElementById('hesap-oto-gunluk-stopaj').value = h.otoGunlukStopaj != null ? h.otoGunlukStopaj : '';
      renderOtoGunlukOranGecmis(h.otoGunlukOranGecmisi||[]);
      onHesapTurChange();
    }
  } else {
    document.getElementById('hesap-iban').value = '';
    document.getElementById('hesap-banka-kodu').value = '';
    document.getElementById('hesap-sube-kodu').value = '';
    document.getElementById('hesap-no').value = '';
    document.getElementById('hesap-parsed-row').style.display = 'none';
    document.getElementById('hesap-iban-status').textContent = '';
    document.getElementById('hesap-ad').value = '';
    document.getElementById('hesap-tur').value = 'vadesiz';
    curSel.value = defaultCurrency || 'TRY';
    setMoneyInput('hesap-bakiye', '');
    document.getElementById('hesap-sube-ad').value = '';
    const clrDisp = document.getElementById('hesap-sube-ad-display');
    if(clrDisp) clrDisp.textContent = '—';
    document.getElementById('hesap-durum').value = 'aktif';
    document.getElementById('hesap-not').value = '';
    setMoneyInput('hesap-min-bakiye', '');
    setMoneyInput('hesap-hedef-bakiye', '');
    document.getElementById('hesap-kmh-toggle').checked = false;
    document.getElementById('hesap-kmh-panel').style.display = 'none';
    setMoneyInput('hesap-kmh-limit', '');
    setDateInputValue('hesap-kmh-limit-tarih', localDateStr(new Date()));
    renderKmhLimitGecmis([], curSel.value || defaultCurrency || 'TRY');
    document.getElementById('hesap-oto-gunluk-toggle').checked = false;
    document.getElementById('hesap-oto-gunluk-panel').style.display = 'none';
    document.getElementById('hesap-oto-gunluk-faiz').value = '';
    document.getElementById('hesap-oto-gunluk-stopaj').value = '';
    renderOtoGunlukOranGecmis([]);
    onHesapTurChange();
  }
  bindMoneyInputs(document.getElementById('modal-hesap'));
  openModal('modal-hesap');
}

export function hesapStepGoto(step) {
  step = Math.max(1, Math.min(HESAP_STEP_COUNT, step));
  set_hesapCurrentStep(step);
  const modal = document.getElementById('modal-hesap');
  if (!modal) return;
  // ---- Saf DOM güncelleme: js/ui/components/step-wizard.js:swizUpdateStepIndicator ----
  swizUpdateStepIndicator(modal, step);
  const backBtn = document.getElementById('hesap-step-back-btn');
  const nextBtn = document.getElementById('hesap-step-next-btn');
  const saveBtn = document.getElementById('hesap-step-save-btn');
  if (backBtn) backBtn.style.display = step > 1 ? '' : 'none';
  if (nextBtn) nextBtn.style.display = step < HESAP_STEP_COUNT ? '' : 'none';
  if (saveBtn) saveBtn.style.display = step === HESAP_STEP_COUNT ? '' : 'none';
  const body = modal.querySelector('.modal-body');
  if (body) body.scrollTop = 0;
  if (step === HESAP_STEP_COUNT) _hesapOzetDoldur();
}
register('wizardStepGoto:modal-hesap', hesapStepGoto);
register('wizardCurrentStep:modal-hesap', () => _hesapCurrentStep);

export function _hesapValidateStep(step) {
  if (step === 1) {
    const bankaSel = document.getElementById('hesap-banka');
    if (!bankaSel || !bankaSel.value) {
      showToast('Banka seçiniz', 'error');
      _markFieldError('hesap-banka');
      return false;
    }
    return true;
  }
  if (step === 2) {
    const pbSel = document.getElementById('hesap-para-birimi');
    if (!pbSel || !pbSel.value) {
      showToast('Para birimi seçiniz', 'error');
      _markFieldError('hesap-para-birimi');
      return false;
    }
    return true;
  }
  return true;
}

export function hesapStepNext() {
  if (!_hesapValidateStep(_hesapCurrentStep)) return;
  hesapStepGoto(_hesapCurrentStep + 1);
}

register('wizardStepNext:modal-hesap', hesapStepNext);


export function hesapStepBack() {
  hesapStepGoto(_hesapCurrentStep - 1);
}

export function _hesapOzetDoldur() {
  const bankaSel = document.getElementById('hesap-banka');
  const bankaObj = bankaSel ? (DB.bankalar||[]).find(b=>b.id===bankaSel.value) : null;
  const ad = (document.getElementById('hesap-ad')||{}).value.trim() || '(otomatik)';
  const turSel = document.getElementById('hesap-tur');
  const turAd = turSel ? (turSel.options[turSel.selectedIndex]?.text || turSel.value) : '—';
  const pb = (document.getElementById('hesap-para-birimi')||{}).value || 'TRY';
  const bakiye = getMoneyInput('hesap-bakiye') || 0;
  const iban = (document.getElementById('hesap-iban')||{}).value || '—';
  const kmhToggle = document.getElementById('hesap-kmh-toggle');
  const kmhAktif = kmhToggle && kmhToggle.checked;
  const kmhLimit = kmhAktif ? (getMoneyInput('hesap-kmh-limit')||0) : 0;
  const otoGunlukToggle = document.getElementById('hesap-oto-gunluk-toggle');
  const otoGunlukAktif = otoGunlukToggle && otoGunlukToggle.checked;
  const durum = (document.getElementById('hesap-durum')||{}).value || 'aktif';
  const minBakiye = document.getElementById('hesap-min-bakiye').value.trim();
  const hedefBakiye = document.getElementById('hesap-hedef-bakiye').value.trim();

  const satir = swizOzetSatirHtml;

  const ozetEl = document.getElementById('hesap-ozet-icerik');
  if (!ozetEl) return;
  ozetEl.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px 16px;margin-bottom:12px">
      ${satir('Banka', bankaObj ? bankaObj.kisa : '—')}
      ${satir('Hesap Adı', `<span style="font-family:inherit">${ad}</span>`)}
      ${satir('Hesap Türü', `<span style="font-family:inherit">${turAd}</span>`)}
      ${satir('Para Birimi', pb)}
      ${satir('Mevcut Bakiye', fmtCur(bakiye, pb))}
      ${satir('IBAN', `<span style="font-size:11px">${iban}</span>`)}
      ${satir('KMH', kmhAktif ? fmtCur(kmhLimit, pb) + ' limit' : 'Pasif')}
      ${satir('Otomatik Günlük Vadeli', otoGunlukAktif ? '☀ Aktif' : 'Pasif')}
      ${satir('Durum', durum.charAt(0).toUpperCase()+durum.slice(1))}
      ${minBakiye ? satir('Min. Bakiye Eşiği', fmtCur(parseFloat(minBakiye)||0, pb)) : ''}
      ${hedefBakiye ? satir('Hedef Bakiye', fmtCur(parseFloat(hedefBakiye)||0, pb)) : ''}
    </div>`;
}

export function saveHesap() {
  let ad = document.getElementById('hesap-ad').value.trim();
  const banka = document.getElementById('hesap-banka').value;
  const paraBirimi = document.getElementById('hesap-para-birimi').value;
  if(!validateRequiredFields([{id:'hesap-banka',msg:'Banka hesabı seçiniz'},{id:'hesap-para-birimi',msg:'Para birimi seçiniz'}])) return;
  // Hesap adı boşsa otomatik üret
  if(!ad) {
    const turSel = document.getElementById('hesap-tur');
    const turAd = turSel.options[turSel.selectedIndex]?.text || turSel.value || 'Hesap';
    ad = turAd + ' ' + paraBirimi;
  }

  const ibanRaw = document.getElementById('hesap-iban').value.replace(/\s+/g,'').toUpperCase();
  const parsed = ibanRaw ? parseIban(ibanRaw) : null;

  const hesap = {
    id: editHesapId || uid(),
    banka,
    ad,
    tur: document.getElementById('hesap-tur').value,
    paraBirimi: paraBirimi || 'TRY',
    bakiye: getMoneyInput('hesap-bakiye')||0,
    iban: parsed ? parsed.iban : (ibanRaw||''),
    bankaKodu: parsed ? parsed.bankaKodu : document.getElementById('hesap-banka-kodu').value,
    subeKodu:  parsed ? parsed.subeKodu  : document.getElementById('hesap-sube-kodu').value,
    hesapNo:   parsed ? parsed.hesapNo   : document.getElementById('hesap-no').value,
    subeAd: (getSubeAdFromKodlar(parsed ? parsed.bankaKodu : document.getElementById('hesap-banka-kodu').value, parsed ? parsed.subeKodu : document.getElementById('hesap-sube-kodu').value)) || document.getElementById('hesap-sube-ad').value.trim(),
    durum: document.getElementById('hesap-durum').value,
    not: document.getElementById('hesap-not').value.trim(),
    minBakiye: document.getElementById('hesap-min-bakiye').value.trim() !== '' ? (getMoneyInput('hesap-min-bakiye')||0) : undefined,
    hedefBakiye: document.getElementById('hesap-hedef-bakiye').value.trim() !== '' ? (getMoneyInput('hesap-hedef-bakiye')||0) : undefined,
  };

  // Otomatik günlük vadeli verileri
  const otoGunlukToggle = document.getElementById('hesap-oto-gunluk-toggle');
  if(otoGunlukToggle && otoGunlukToggle.checked && hesap.tur !== 'vadeli') {
    hesap.otoGunlukVadeli = true;
    const faizVal = document.getElementById('hesap-oto-gunluk-faiz').value;
    const stopajVal = document.getElementById('hesap-oto-gunluk-stopaj').value;
    const yeniFaiz = faizVal !== '' ? parseFloat(faizVal) : 0;
    const yeniStopaj = stopajVal !== '' ? parseFloat(stopajVal) : 0;
    const yeniTarih = localDateStr(new Date());

    // Faiz/stopaj geçmişi — oran değiştiyse geçmişe yeni kayıt ekle
    const mevcutGecmis = readOtoGunlukOranGecmisi();
    const sortedOran = mevcutGecmis.slice().sort((a,b)=>b.tarih.localeCompare(a.tarih));
    const guncelFaiz = sortedOran.length > 0 ? sortedOran[0].faizOran : null;
    const guncelStopaj = sortedOran.length > 0 ? sortedOran[0].stopaj : null;
    let yeniOranGecmis = mevcutGecmis;
    if(yeniFaiz !== guncelFaiz || yeniStopaj !== guncelStopaj) {
      if(sortedOran.length > 0) {
        const sonKayitIdx = mevcutGecmis.findIndex(g => g.tarih === sortedOran[0].tarih && g.faizOran === sortedOran[0].faizOran && g.stopaj === sortedOran[0].stopaj);
        if(sonKayitIdx >= 0 && mevcutGecmis[sonKayitIdx].tarih !== yeniTarih) mevcutGecmis[sonKayitIdx].bitisTarih = yeniTarih;
      }
      yeniOranGecmis = [...mevcutGecmis, {tarih: yeniTarih, faizOran: yeniFaiz, stopaj: yeniStopaj}];
    }
    const finalSortedOran = yeniOranGecmis.slice().sort((a,b)=>b.tarih.localeCompare(a.tarih));
    hesap.otoGunlukFaizOran = finalSortedOran.length ? finalSortedOran[0].faizOran : yeniFaiz;
    hesap.otoGunlukStopaj = finalSortedOran.length ? finalSortedOran[0].stopaj : yeniStopaj;
    hesap.otoGunlukOranGecmisi = yeniOranGecmis;
  } else {
    hesap.otoGunlukVadeli = false;
    hesap.otoGunlukFaizOran = null;
    hesap.otoGunlukStopaj = null;
    hesap.otoGunlukOranGecmisi = [];
  }

  // KMH verileri
  const kmhToggle = document.getElementById('hesap-kmh-toggle');
  if(kmhToggle && kmhToggle.checked) {
    const yeniLimit = getMoneyInput('hesap-kmh-limit')||0;
    const yeniTarih = document.getElementById('hesap-kmh-limit-tarih').value || localDateStr(new Date());
    // Mevcut geçmişi al
    const mevcutGecmis = readKmhLimitGecmis();
    const sorted = mevcutGecmis.slice().sort((a,b)=>b.tarih.localeCompare(a.tarih));
    const guncelLimit = sorted.length > 0 ? sorted[0].limit : null;
    // Limit değiştiyse geçmişe yeni kayıt ekle
    let yeniGecmis = mevcutGecmis;
    if(yeniLimit !== guncelLimit) {
      // Önceki son kaydın bitiş tarihini güncelle
      if(sorted.length > 0) {
        const sonKayitIdx = mevcutGecmis.findIndex(g => g.tarih === sorted[0].tarih && g.limit === sorted[0].limit);
        if(sonKayitIdx >= 0) mevcutGecmis[sonKayitIdx].bitisTarih = yeniTarih;
      }
      yeniGecmis = [...mevcutGecmis, {tarih: yeniTarih, limit: yeniLimit}];
    }
    // Geçmişin en son kaydından güncel limiti al
    const finalSorted = yeniGecmis.slice().sort((a,b)=>b.tarih.localeCompare(a.tarih));
    hesap.kmhLimit = finalSorted.length ? finalSorted[0].limit : yeniLimit;
    hesap.kmhLimitTarih = finalSorted.length ? finalSorted[0].tarih : yeniTarih;
    hesap.kmhLimitGecmisi = yeniGecmis;
  }

  if(!DB.hesaplar) DB.hesaplar = [];
  const _eskiHesapBakiyeLog = editHesapId ? (DB.hesaplar||[]).find(h=>h.id===editHesapId) : null;
  const _eskiHesapBakiye = _eskiHesapBakiyeLog ? (Number(_eskiHesapBakiyeLog.bakiye)||0) : null;
  const _eskiHesapPb = _eskiHesapBakiyeLog ? (_eskiHesapBakiyeLog.paraBirimi || hesap.paraBirimi || 'TRY') : (hesap.paraBirimi || 'TRY');
  if(editHesapId) {
    const idx = DB.hesaplar.findIndex(h=>h.id===editHesapId);
    if(idx>=0) DB.hesaplar[idx]=hesap;
    if(_eskiHesapBakiye !== null) {
      const _yeniHesapBakiye = Number(hesap.bakiye)||0;
      const _fark = Math.round((_yeniHesapBakiye - _eskiHesapBakiye) * 1e6) / 1e6;
      if(Math.abs(_fark) >= 0.005) {
        if(!DB._bakiyeDuzeltmeLog) DB._bakiyeDuzeltmeLog = [];
        DB._bakiyeDuzeltmeLog.push({
          id: uid(), hedefTip:'hesap', hedefId: hesap.id,
          tarih: localDateStr(new Date()), eskiBakiye: _eskiHesapBakiye,
          yeniBakiye: _yeniHesapBakiye, fark: _fark,
          not: 'Hesap düzenleme wizardı bakiye düzeltmesi'
        });
      }
    }
  } else {
    DB.hesaplar.push(hesap);
  }
  saveData();
  closeModal('modal-hesap');
  if(typeof hesapOtomatikGunlukKontrol === 'function') hesapOtomatikGunlukKontrol();
  renderHesaplar();
}

export function deleteHesap(id) {
  const hesap = (DB.hesaplar||[]).find(h=>h.id===id);
  if(!hesap) return;

  // Bu hesap bir vadeli mevduatın "vadeli hesabı" ise, direkt silme, önce
  // mevduatı düzgün kapat (ana parayı vadesiz hesaba aktar) — aksi halde
  // mevduat kaydı yetim kalır ve ana para hiçbir hesapta görünmez olur.
  const iliskiliMev = (DB.mevduatlar||[]).find(m=>m.hesapId===id);
  if(iliskiliMev) {
    const vadesizHesap = iliskiliMev.vadesizHesapId ? (DB.hesaplar||[]).find(h=>h.id===iliskiliMev.vadesizHesapId) : null;
    const anaPara = iliskiliMev.tutar || 0;
    let onayMesaji;
    if(vadesizHesap && anaPara > 0) {
      onayMesaji = `Bu hesap bir vadeli mevduatla ilişkili.\n\n` +
        `• Mevduat kaydı "bitti" durumuna alınacak (silinmeyecek)\n` +
        `• Bu hesap "kapalı" durumuna alınacak (silinmeyecek)\n` +
        `• Ana para (${fmtCur(anaPara, iliskiliMev.paraBirimi)}) → "${vadesizHesap.ad}" hesabına aktarılacak\n\n` +
        `Devam edilsin mi?`;
    } else {
      onayMesaji = `Bu hesap bir vadeli mevduatla ilişkili.\n\n` +
        `⚠ Hedef vadesiz hesap tanımlı olmadığı için ana para (${fmtCur(anaPara, iliskiliMev.paraBirimi)}) hiçbir hesaba aktarılamayacak.\n` +
        `• Mevduat kaydı "bitti", bu hesap "kapalı" durumuna alınacak (ikisi de silinmeyecek)\n\n` +
        `Devam edilsin mi?`;
    }
    showConfirm(onayMesaji, () => {
      if(vadesizHesap && anaPara > 0) {
        vadesizHesap.bakiye = (vadesizHesap.bakiye || 0) + anaPara;
        showToast(`Ana para (${fmtCur(anaPara, iliskiliMev.paraBirimi)}) → "${vadesizHesap.ad}" hesabına aktarıldı`, 'success');
      }
      // Mevduat kaydı silinmez — "bitti" durumuna alınır.
      iliskiliMev._kapatildi = true;
      // Hesap da silinmez — bakiyesi sıfırlanıp "kapalı" durumuna alınır.
      hesap.durum = 'kapali';
      hesap.bakiye = 0;
      saveData();
      renderHesaplar();
      if(typeof renderMevduat==='function') renderMevduat();
    });
    return;
  }

  showConfirm('Bu hesap kaydı silinsin mi?', ()=>{
    DB.hesaplar = (DB.hesaplar||[]).filter(h=>h.id!==id);
    saveData();
    renderHesaplar();
  });
}

