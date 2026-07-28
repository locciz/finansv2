import { saveData } from '@core/app-core-base.js';
import { fmtCur, fmtDate, localDateStr, uid } from '@core/format.js';
import { ALL_CURRENCIES, DB, defaultCurrency } from '@core/state.js';
import { buildCurrencyOptions } from '@domain/doviz.js';
import { _tutarAsiyorMu, getStopajOrani } from '@domain/hesaplamalar.js';
import { swizOzetSatirHtml, swizUpdateStepIndicator } from '@components/step-wizard.js';
import { hesaplaMevduatOnizleme } from '@domain/mevduat-hesaplama.js';
import { _markFieldError, showToast, openModal } from '@components/modal-genel.js';
import { getMoneyInput, setDateInputValue, setMoneyInput } from '@components/money-input.js';
import { applyChipsToContainer, wireAllMoneyCurButtons } from '@components/select-to-chips.js';
import { renderIslemler } from '@pages/islemler/03-islem-liste-render.js';
import { MEV_STEP_COUNT, _editMevduatEskiTutar, _mevCurrentStep, _mevGunlukMod, editMevduatId, setEditMevduatId, set_editMevduatEskiTutar, set_mevCurrentStep, set_mevGunlukMod } from '@pages/mevduat/00-state.js';
import { renderMevduat } from '@pages/mevduat/05-mevduat-liste-render.js';
import { _fillMevHesapSel, _fillMevVadesizSel, _updateMevTutarBakiyeHint, onMevOtoHesapToggle, onMevStratejiChange } from '@pages/mevduat/06-mevduat-hesap-secim-formu.js';
import { closeModal } from '@components/modal-genel.js';
import { renderHesaplar } from '@pages/hesaplar/04-hesap-liste-render.js';
import { register } from '@core/wrap-registry.js';
// ============================================================
// js/ui/pages/mevduat/01-mevduat-form-wizard.js
// Mevduat açma formu (step wizard) + faiz hesaplayıcı + kaydetme/düzenleme
//
// Bu dosya, eskiden tek parça olan js/ui/pages/mevduat.js
// (43 export, 1589 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function mevStepGoto(step) {
  step = Math.max(1, Math.min(MEV_STEP_COUNT, step));
  set_mevCurrentStep(step);
  const modal = document.getElementById('modal-mevduat');
  if (!modal) return;

  // ---- Saf DOM güncelleme: js/ui/components/step-wizard.js:swizUpdateStepIndicator ----
  swizUpdateStepIndicator(modal, step);

  // Footer buton görünürlüğü
  const backBtn = document.getElementById('mev-step-back-btn');
  const nextBtn = document.getElementById('mev-step-next-btn');
  const saveBtn = document.getElementById('mev-step-save-btn');
  if (backBtn) backBtn.style.display = step > 1 ? '' : 'none';
  if (nextBtn) nextBtn.style.display = step < MEV_STEP_COUNT ? '' : 'none';
  if (saveBtn) saveBtn.style.display = step === MEV_STEP_COUNT ? '' : 'none';

  // Yeni adıma her geçişte üstten başla
  const body = modal.querySelector('.modal-body');
  if (body) body.scrollTop = 0;

  // Özet adımına hangi yoldan gelinirse gelinsin (İleri butonu veya adım
  // noktasına doğrudan tıklama) özet içeriği doldurulmalı — aksi halde
  // adım noktasından direkt atlanınca özet boş kalıyordu.
  if (step === MEV_STEP_COUNT && typeof _mevOzetDoldur === 'function') _mevOzetDoldur();
}
register('wizardStepGoto:modal-mevduat', mevStepGoto);
register('wizardCurrentStep:modal-mevduat', () => _mevCurrentStep);

export function _mevValidateStep(step) {
  const otoToggle = document.getElementById('mev-oto-hesap');
  const otoAktif = otoToggle && otoToggle.checked;

  if (step === 1) {
    // Her iki modda da hesap seçimi zorunlu (mev-hesap-id)
    const hesapSel = document.getElementById('mev-hesap-id');
    const hesapVal = (hesapSel || {}).value || '';
    if (!hesapVal) {
      const mesaj = otoAktif ? 'Paranın alınacağı hesabı seçin' : 'Vadeli hesap seçin';
      showToast(mesaj, 'error');
      _markFieldError('mev-hesap-id');
      if (hesapSel) { hesapSel.scrollIntoView({behavior:'smooth', block:'center'}); hesapSel.focus(); }
      return false;
    }
    const tutar = getMoneyInput('mev-tutar') || 0;
    if (!tutar) { showToast('Lütfen tutar girin', 'error'); _markFieldError('mev-tutar'); return false; }
    if (otoAktif && !editMevduatId) {
      const kaynakHesapCheck = (DB.hesaplar||[]).find(h=>h.id===hesapVal);
      if (kaynakHesapCheck && _tutarAsiyorMu(tutar, kaynakHesapCheck.bakiye||0)) {
        showToast(`Yetersiz bakiye — ${kaynakHesapCheck.ad} hesabında ${fmtCur(kaynakHesapCheck.bakiye||0, kaynakHesapCheck.paraBirimi||'TRY')} bulunuyor`, 'error');
        _markFieldError('mev-tutar');
        const tutarEl = document.getElementById('mev-tutar');
        if (tutarEl) { tutarEl.scrollIntoView({behavior:'smooth', block:'center'}); tutarEl.focus(); }
        return false;
      }
    }
    // Mevcut mevduat düzenlenirken tutar değiştirilmişse "Farkın Alınacağı/
    // Yatırılacağı Hesap" alanı görünür ve * ile zorunlu olur (bkz.
    // _updateMevTutarFarkAlani) — önceden burada denetlenmiyordu.
    const farkWrap = document.getElementById('mev-tutar-fark-wrap');
    if (farkWrap && farkWrap.style.display !== 'none') {
      const farkHesap = (document.getElementById('mev-tutar-fark-hesap-id')||{}).value || '';
      if (!farkHesap) {
        showToast('Farkın gideceği/geleceği hesabı seçin', 'error');
        _markFieldError('mev-tutar-fark-hesap-id');
        return false;
      }
    }
    return true;
  }
  if (step === 2) {
    const bas = document.getElementById('mev-baslangic').value;
    if (!bas) {
      showToast('Lütfen başlangıç tarihi girin', 'error');
      _markFieldError('mev-baslangic');
      return false;
    }
    const vade = parseInt(document.getElementById('mev-vade').value) || 0;
    if (!vade) { showToast('Lütfen vade (gün) girin', 'error'); _markFieldError('mev-vade'); return false; }
    return true;
  }
  if (step === 3) {
    return true;
  }
  if (step === 4) {
    // Strateji seçimi opsiyonel; özet sayfasına geçmeden önce özeti doldur
    _mevOzetDoldur();
    return true;
  }
  return true;
}

export function mevStepNext() {
  if (!_mevValidateStep(_mevCurrentStep)) return;
  mevStepGoto(_mevCurrentStep + 1);
  if (_mevCurrentStep === MEV_STEP_COUNT) _mevOzetDoldur();
}

register('wizardStepNext:modal-mevduat', mevStepNext);


export function _mevOzetDoldur() {
  const cur = (document.getElementById('mev-para-birimi')||{}).value || 'TRY';
  const tutar = getMoneyInput('mev-tutar') || 0;
  const vade = parseInt(document.getElementById('mev-vade').value) || 0;
  const faizOran = parseFloat(document.getElementById('mev-faiz').value) || 0;
  const stopaj = parseFloat(document.getElementById('mev-stopaj').value) || 0;
  const valor = parseInt(document.getElementById('mev-valor').value) || 0;
  const bas = document.getElementById('mev-baslangic').value;
  const bitisTxt = (document.getElementById('mev-bitis-goster')||{}).value || '—';
  const brutFaiz = tutar * (faizOran/100) * (vade/365);
  const stopajTutar = brutFaiz * (stopaj/100);
  const netFaiz = brutFaiz - stopajTutar;
  const nihai = tutar + netFaiz;
  const kazanYuzde = tutar > 0 ? (netFaiz / tutar * 100) : 0;

  // Hesap bilgisi
  const otoToggle = document.getElementById('mev-oto-hesap');
  const otoAktif = otoToggle && otoToggle.checked;
  let hesapBilgi = '—';
  if (otoAktif) {
    const kaynakId = (document.getElementById('mev-hesap-id')||{}).value || '';
    const h = (DB.hesaplar||[]).find(x=>x.id===kaynakId);
    if (h) hesapBilgi = h.ad + (h.banka ? (' — ' + ((DB.bankalar||[]).find(b=>b.id===h.banka)||{}).kisa||'') : '');
    hesapBilgi += ' <span style="font-size:10px;color:var(--teal);background:rgba(45,212,191,.1);padding:1px 6px;border-radius:5px;margin-left:4px">Yeni vadeli hesap oluşturulacak</span>';
  } else {
    const hesapSel = document.getElementById('mev-hesap-id');
    const hesapId = (hesapSel||{}).value || '';
    const h = (DB.hesaplar||[]).find(x=>x.id===hesapId);
    if (h) hesapBilgi = h.ad;
  }

  // Strateji
  const stratejiVal = (document.getElementById('mev-strateji')||{}).value || '';
  const stratejiMap = {
    yenile_tum: 'Ana Para + Faiz → Yeni Mevduat',
    yenile_ana_faiz_vadesiz: 'Ana Para → Yeni Mevduat, Faiz → Vadesiz',
    tumu_vadesiz: 'Ana Para + Faiz → Vadesiz Hesap'
  };
  const stratejiTxt = stratejiMap[stratejiVal] || '—';

  const satir = swizOzetSatirHtml;

  const ozetEl = document.getElementById('mev-ozet-icerik');
  if (!ozetEl) return;
  ozetEl.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px 16px;margin-bottom:12px">
      ${satir('Hesap', `<span style="font-family:inherit">${hesapBilgi}</span>`)}
      ${satir('Para Birimi', cur)}
      ${satir('Tutar', fmtCur(tutar, cur))}
      ${satir('Başlangıç', bas || '—')}
      ${satir('Vade', vade + ' gün')}
      ${valor ? satir('Valör', valor + ' gün') : ''}
      ${satir('Vade Sonu', bitisTxt)}
      ${satir('Faiz Oranı', faizOran ? '%' + faizOran : '—')}
      ${satir('Stopaj', '%' + stopaj)}
      ${satir('Vade Sonu Stratejisi', `<span style="font-family:inherit;font-weight:500">${stratejiTxt}</span>`)}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div style="background:linear-gradient(135deg,rgba(45,212,191,.08),rgba(45,212,191,.03));border:1px solid rgba(45,212,191,.2);border-radius:10px;padding:11px 13px">
        <div style="font-size:10px;color:var(--accent2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Net Faiz Kazancı</div>
        <div style="font-size:15px;font-weight:700;color:var(--accent2);font-family:var(--mono)">${fmtCur(netFaiz, cur)}</div>
        <div style="font-size:10.5px;color:var(--text3);margin-top:2px">Brüt: ${fmtCur(brutFaiz,cur)} · Stopaj: -${fmtCur(stopajTutar,cur)}</div>
      </div>
      <div style="background:linear-gradient(135deg,rgba(251,191,36,.10),rgba(251,191,36,.04));border:1px solid rgba(251,191,36,.25);border-radius:10px;padding:11px 13px">
        <div style="font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Vade Sonu Tutar</div>
        <div style="font-size:15px;font-weight:700;color:var(--gold);font-family:var(--mono)">${fmtCur(nihai, cur)}</div>
        <div style="font-size:10.5px;color:var(--text3);margin-top:2px">+%${kazanYuzde.toFixed(2)} getiri</div>
      </div>
    </div>`;
}

export function mevStepBack() {
  mevStepGoto(_mevCurrentStep - 1);
}

export function calcMevduat() {
  const tutar = getMoneyInput('mev-tutar')||0;
  const faizOran = parseFloat(document.getElementById('mev-faiz').value)||0;
  const stopaj = parseFloat(document.getElementById('mev-stopaj').value)||0;
  const vade = parseInt(document.getElementById('mev-vade').value)||0;
  const bas = document.getElementById('mev-baslangic').value;
  const valor = parseInt(document.getElementById('mev-valor').value)||0;

  // ---- Saf hesaplama artık js/domain/mevduat-hesaplama.js'de ----
  const hesap = hesaplaMevduatOnizleme(tutar, faizOran, stopaj, vade, valor, bas || null);
  const { faizBazis, brutFaiz, stopajTutar, netFaiz, nihai, kazanc, kazanYuzde } = hesap;

  let bitisTarih = '';
  if(bas && vade) {
    bitisTarih = fmtDate(new Date(hesap.bitisTarihISO+'T00:00:00'));
    const bitisGoster = document.getElementById('mev-bitis-goster');
    if(bitisGoster) bitisGoster.value = bitisTarih;
  } else {
    const bitisGoster = document.getElementById('mev-bitis-goster');
    if(bitisGoster) bitisGoster.value = '';
  }

  const cur = (document.getElementById('mev-para-birimi')||{}).value || 'TRY';
  document.getElementById('mev-preview').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px">
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 12px">
        <div style="font-size:10px;color:var(--text2);margin-bottom:3px;letter-spacing:.04em;text-transform:uppercase">Faizli Tutar</div>
        <div style="font-size:13px;font-weight:600;color:var(--text);font-family:var(--mono)">${fmtCur(faizBazis,cur)}</div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 12px">
        <div style="font-size:10px;color:var(--text2);margin-bottom:3px;letter-spacing:.04em;text-transform:uppercase">Brüt Faiz</div>
        <div style="font-size:13px;font-weight:600;color:var(--text);font-family:var(--mono)">${fmtCur(brutFaiz,cur)}</div>
      </div>
      <div style="background:var(--surface2);border:1px solid rgba(251,113,133,.2);border-radius:10px;padding:10px 12px">
        <div style="font-size:10px;color:var(--text2);margin-bottom:3px;letter-spacing:.04em;text-transform:uppercase">Stopaj Kesintisi</div>
        <div style="font-size:13px;font-weight:600;color:var(--danger);font-family:var(--mono)">-${fmtCur(stopajTutar,cur)}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr${bitisTarih?' 1fr':''};gap:8px">
      <div style="background:linear-gradient(135deg,rgba(45,212,191,.08) 0%,rgba(45,212,191,.03) 100%);border:1px solid rgba(45,212,191,.2);border-radius:10px;padding:10px 12px">
        <div style="font-size:10px;color:var(--accent2);margin-bottom:3px;letter-spacing:.04em;text-transform:uppercase;opacity:.8">Net Faiz</div>
        <div style="font-size:14px;font-weight:700;color:var(--accent2);font-family:var(--mono)">${fmtCur(netFaiz,cur)}</div>
      </div>
      <div style="background:linear-gradient(135deg,rgba(251,191,36,.1) 0%,rgba(251,191,36,.04) 100%);border:1px solid rgba(251,191,36,.25);border-radius:10px;padding:10px 12px">
        <div style="font-size:10px;color:var(--gold);margin-bottom:3px;letter-spacing:.04em;text-transform:uppercase;opacity:.8">Nihai Tutar</div>
        <div style="font-size:14px;font-weight:700;color:var(--gold);font-family:var(--mono)">${fmtCur(nihai,cur)}</div>
        <div style="font-size:10px;color:var(--accent2);margin-top:2px">+%${kazanYuzde.toFixed(2)} kazanç</div>
      </div>
      ${bitisTarih?`
      <div style="background:linear-gradient(135deg,rgba(167,139,250,.08) 0%,rgba(167,139,250,.03) 100%);border:1px solid rgba(167,139,250,.22);border-radius:10px;padding:10px 12px">
        <div style="font-size:10px;color:var(--violet);margin-bottom:3px;letter-spacing:.04em;text-transform:uppercase;opacity:.8">Vade Sonu</div>
        <div style="font-size:13px;font-weight:700;color:var(--violet);font-family:var(--mono);white-space:nowrap">${bitisTarih}</div>
      </div>`:''}
    </div>`;
  _updateMevTutarBakiyeHint();
}

export function mevTutarTumunuKullan() {
  const hesapSel = document.getElementById('mev-hesap-id');
  const hesapId = hesapSel ? hesapSel.value : '';
  const hesap = hesapId ? (DB.hesaplar||[]).find(h=>h.id===hesapId) : null;
  if(!hesap) { showToast('Önce paranın alınacağı hesabı seçin', 'error'); return; }
  if(!(hesap.bakiye > 0)) { showToast('Hesap bakiyesi 0 veya negatif', 'error'); return; }
  setMoneyInput('mev-tutar', hesap.bakiye);
  calcMevduat();
}

export function populateMevduatModal() {
  setEditMevduatId(null);
  set_editMevduatEskiTutar(null);
  const farkWrap = document.getElementById('mev-tutar-fark-wrap');
  if(farkWrap) farkWrap.style.display = 'none';
  set_mevGunlukMod(false);
  mevStepGoto(1);
  document.getElementById('mev-modal-title').textContent = 'Mevduat Ekle';
  setTimeout(() => { const t = document.getElementById('mev-tutar'); if(t) t.focus(); }, 120);

  // Oto hesap toggle sıfırla
  const otoToggle = document.getElementById('mev-oto-hesap');
  if(otoToggle) { otoToggle.checked = false; onMevOtoHesapToggle(); }

  // Banka hesap select (mevcut)
  _fillMevHesapSel('');
  // Vadesiz hesap select
  _fillMevVadesizSel('', '');
  // Strateji sıfırla
  const stratejiSel = document.getElementById('mev-strateji');
  if(stratejiSel) { stratejiSel.value = ''; onMevStratejiChange(); }

  setDateInputValue('mev-baslangic', localDateStr(new Date()));
  setMoneyInput('mev-tutar', '');
  document.getElementById('mev-faiz').value='';
  document.getElementById('mev-stopaj').value = getStopajOrani(localDateStr(new Date()));
  document.getElementById('mev-vade').value='';
  document.getElementById('mev-valor').value='0';
  document.getElementById('mev-preview').innerHTML='<div class="mev-preview-empty" style="padding:11px 14px;background:var(--surface3);border-radius:10px;border:1px solid var(--border);font-size:12px;color:var(--text2);text-align:center">Değerleri girin, faiz otomatik hesaplanacak.</div>';
  const bitisGoster = document.getElementById('mev-bitis-goster');
  if(bitisGoster) bitisGoster.value = '';
  // Banka pill sıfırla
  const displayWrap = document.getElementById('mev-banka-display');
  if(displayWrap) displayWrap.style.display='none';
  const hiddenInp = document.getElementById('mev-banka-hidden');
  if(hiddenInp) hiddenInp.value='';
  const adInp = document.getElementById('mev-oto-hesap-ad');
  if(adInp) adInp.value = '';
  // Para birimi doldur
  const curSel = document.getElementById('mev-para-birimi');
  if(curSel) {
    if(typeof ALL_CURRENCIES !== 'undefined' && ALL_CURRENCIES.length) {
      curSel.innerHTML = buildCurrencyOptions();
    } else {
      curSel.innerHTML = '<option value="TRY">TRY ₺</option><option value="USD">USD $</option><option value="EUR">EUR €</option>';
    }
    curSel.value = defaultCurrency || 'TRY';
  }
}

export function saveMevduat() {
  const tutar = getMoneyInput('mev-tutar')||0;
  const faizsiz = 0;
  const faizOran = parseFloat(document.getElementById('mev-faiz').value)||0;
  const stopaj = parseFloat(document.getElementById('mev-stopaj').value)||0;
  const vade = parseInt(document.getElementById('mev-vade').value)||0;
  const valor = parseInt(document.getElementById('mev-valor').value)||0;
  const bas = document.getElementById('mev-baslangic').value;

  // ── OTO HESAP OLUŞTUR ──────────────────────────────
  const otoToggle = document.getElementById('mev-oto-hesap');
  const otoAktif = otoToggle && otoToggle.checked;

  // Validasyon
  if(!tutar) { showToast('Lütfen tutar girin', 'error'); return; }
  if(!vade)  { showToast('Lütfen vade (gün) girin', 'error'); return; }
  if(!bas)   { showToast('Lütfen başlangıç tarihi girin', 'error'); return; }

  // Her iki modda da hesap seçimi zorunlu
  const hesapSelCheck = (document.getElementById('mev-hesap-id')||{}).value || '';
  if(!hesapSelCheck) {
    const mesaj = otoAktif ? 'Lütfen paranın alınacağı hesabı seçin' : 'Lütfen vadeli hesap seçin';
    showToast(mesaj, 'error');
    _markFieldError('mev-hesap-id');
    return;
  }
  if(otoAktif && !editMevduatId) {
    // Girilen tutar, kaynak hesabın bakiyesini aşıyor mu?
    const kaynakHesapCheck = (DB.hesaplar||[]).find(h=>h.id===hesapSelCheck);
    if(kaynakHesapCheck && _tutarAsiyorMu(tutar, kaynakHesapCheck.bakiye||0)) {
      showToast(`Yetersiz bakiye — ${kaynakHesapCheck.ad} hesabında ${fmtCur(kaynakHesapCheck.bakiye||0, kaynakHesapCheck.paraBirimi||'TRY')} bulunuyor`, 'error');
      _markFieldError('mev-tutar');
      const tutarEl = document.getElementById('mev-tutar');
      if(tutarEl) { tutarEl.scrollIntoView({behavior:'smooth', block:'center'}); tutarEl.focus(); }
      return;
    }
  }

  // ── DÜZENLEME MODUNDA TUTAR DEĞİŞİKLİĞİ ──────────────────────────
  // Mevduat tutarı artırılıp/azaltılıyorsa fark bir hesaba gidip gelmeli.
  // Bu yüzden düzenleme modunda tutar değiştiyse fark hesabı seçimini zorunlu tut.
  const eskiMevKontrol = editMevduatId ? (DB.mevduatlar||[]).find(m=>m.id===editMevduatId) : null;
  const tutarDegisti = !!(eskiMevKontrol && tutar !== eskiMevKontrol.tutar);
  if(tutarDegisti) {
    const farkCheck = (document.getElementById('mev-tutar-fark-hesap-id')||{}).value || '';
    if(!farkCheck) {
      const artti = tutar > eskiMevKontrol.tutar;
      showToast(artti ? 'Tutarı artırdınız — farkın hangi hesaptan alınacağını seçin' : 'Tutarı azalttınız — farkın hangi hesaba yatırılacağını seçin', 'error');
      _markFieldError('mev-tutar-fark-hesap-id');
      return;
    }
  }

  // ---- Saf hesaplama: js/domain/mevduat-hesaplama.js:hesaplaMevduatOnizleme
  //      (calcMevduat'taki ÖNİZLEME ile AYNI kaynak — daha önce burada
  //      aynı formül ayrıca kopyalanmıştı, artık tek yerden okunuyor) ----
  const _onizleme = hesaplaMevduatOnizleme(tutar, faizOran, stopaj, vade, valor, bas || null);
  const { brutFaiz, netFaiz, nihai } = _onizleme;

  let bitis = '';
  if(bas && vade) {
    bitis = localDateStr(new Date(_onizleme.bitisTarihISO+'T00:00:00'));
  }

  let hesapId = null;

  if(otoAktif && !editMevduatId) {
    const kaynakId = hesapSelCheck; // mev-hesap-id oto modunda kaynak hesaptır
    const kaynakHesap = kaynakId ? (DB.hesaplar||[]).find(h=>h.id===kaynakId) : null;
    // Banka: kaynak hesaptan al, yoksa hidden input'tan
    const bankaId = (kaynakHesap && kaynakHesap.banka) ||
                    (document.getElementById('mev-banka-hidden')||{}).value || '';
    const paraBirimi = document.getElementById('mev-para-birimi').value || 'TRY';
    const bankaObj = (DB.bankalar||[]).find(b=>b.id===bankaId);
    const bankaKisa = bankaObj ? bankaObj.kisa : '';
    let adInp = (document.getElementById('mev-oto-hesap-ad')||{}).value.trim();
    if(!adInp) adInp = _mevGunlukMod ? `${bankaKisa} Günlük Vadeli ${paraBirimi}`.trim() || 'Günlük Vadeli Hesap' : `${bankaKisa} Vadeli ${paraBirimi}`.trim() || 'Vadeli Hesap';

    const ibanManuel = ((document.getElementById('mev-iban-manuel')||{}).value || '').replace(/\s/g,'').toUpperCase();
    const yeniHesap = {
      id: uid(),
      banka: bankaId,
      ad: adInp,
      tur: 'vadeli',
      paraBirimi,
      bakiye: tutar,
      iban: ibanManuel,
      bankaKodu: '',
      subeKodu:  '',
      hesapNo:   '',
      subeAd: '',
      durum: 'aktif',
      not: `Mevduat ile otomatik oluşturuldu — ${fmtDate(bas)}`,
    };
    if(!DB.hesaplar) DB.hesaplar = [];
    DB.hesaplar.push(yeniHesap);
    hesapId = yeniHesap.id;
  } else {
    hesapId = hesapSelCheck || null;
  }

  const kaynakHesapId = otoAktif ? (hesapSelCheck || null) : null;
  const vadesizHesapId = (document.getElementById('mev-vadesiz-hesap-id')||{}).value || null;
  const tutarFarkHesapId = (document.getElementById('mev-tutar-fark-hesap-id')||{}).value || null;
  const strateji = (document.getElementById('mev-strateji')||{}).value || '';

  const mev = {
    id: editMevduatId || uid(),
    banka: (document.getElementById('mev-banka-hidden')||{}).value || '',
    paraBirimi: document.getElementById('mev-para-birimi').value || 'TRY',
    hesapId: hesapId || null,
    kaynakHesapId: kaynakHesapId || null,
    vadesizHesapId: vadesizHesapId || null,
    strateji: strateji || null,
    baslangic: bas, bitis,
    tutar, faizOran, stopaj, vade, valor,
    faiz: parseFloat(netFaiz.toFixed(2)),
    nihai: parseFloat(nihai.toFixed(2)),
    gunluk: _mevGunlukMod
  };
  if(editMevduatId) {
    const idx = DB.mevduatlar.findIndex(m=>m.id===editMevduatId);
    if(idx>=0) DB.mevduatlar[idx]=mev;
  } else {
    DB.mevduatlar.push(mev);
  }
  setEditMevduatId(null);
  set_editMevduatEskiTutar(null);
  set_mevGunlukMod(false);

  // ── OTOMATİK TRANSFER: Vadesiz → Vadeli ──────────────────────────
  // NOT: Yeni vadeli hesap zaten "bakiye: tutar" ile oluşturuldu (yukarıda),
  // bu yüzden burada hedef hesaba TEKRAR tutar eklenmez — sadece kaynak
  // hesaptan düşülür. (Önceki sürümde hedefe de ekleniyordu, bu da vadeli
  // hesabın bakiyesinin yanlışlıkla 2 katına çıkmasına yol açıyordu.)
  if(otoAktif && kaynakHesapId && hesapId && tutar > 0) {
    const kaynakHesap = (DB.hesaplar||[]).find(h=>h.id===kaynakHesapId);
    const hedefHesap  = (DB.hesaplar||[]).find(h=>h.id===hesapId);
    if(kaynakHesap && hedefHesap) {
      // Bakiye transferi — arka planda otomatik yapılır, İşlemler listesine kayıt eklenmez
      kaynakHesap.bakiye = (kaynakHesap.bakiye||0) - tutar;
      showToast(`✓ ${fmtCur(tutar, kaynakHesap.paraBirimi||'TRY')} — ${kaynakHesap.ad} → ${hedefHesap.ad} transfer edildi`, 'success');
    }
  }

  // ── DÜZENLEMEDE TUTAR FARKI: Vadeli ⇄ Vadesiz Hesap ──────────────
  // Mevduat tutarı düzenleme sırasında artırıldıysa fark vadesiz hesaptan
  // alınıp vadeliye eklenir; azaltıldıysa fark vadeliden düşülüp vadesize
  // geri yatırılır. (Yukarıdaki validasyon zaten vadesiz hesap seçimini
  // zorunlu kıldığı için buraya vadesizHesapId dolu gelir.)
  if(tutarDegisti) {
    const fark = tutar - eskiMevKontrol.tutar; // + ise artış, - ise azalış
    const vadeliHesap  = hesapId ? (DB.hesaplar||[]).find(h=>h.id===hesapId) : null;
    const farkHesap = tutarFarkHesapId ? (DB.hesaplar||[]).find(h=>h.id===tutarFarkHesapId) : null;
    if(vadeliHesap) vadeliHesap.bakiye = (vadeliHesap.bakiye||0) + fark;
    if(farkHesap)   farkHesap.bakiye   = (farkHesap.bakiye||0) - fark;
    if(vadeliHesap && farkHesap) {
      const miktar = fmtCur(Math.abs(fark), mev.paraBirimi||'TRY');
      showToast(fark > 0
        ? `✓ ${miktar} — ${farkHesap.ad} → ${vadeliHesap.ad} transfer edildi`
        : `✓ ${miktar} — ${vadeliHesap.ad} → ${farkHesap.ad} transfer edildi`, 'success');
    }
  }

  saveData();
  closeModal('modal-mevduat');
  renderMevduat();
  if(typeof renderHesaplar==='function') renderHesaplar();
  if(typeof renderIslemler==='function') renderIslemler();
  if(otoAktif && !kaynakHesapId) showToast('Mevduat ve vadeli hesap oluşturuldu ✓', 'success');
}

export function editMevduat(id) {
  setEditMevduatId(id);
  const m = DB.mevduatlar.find(x=>x.id===id);
  if(!m) return;
  set_editMevduatEskiTutar(m.tutar);
  set_mevGunlukMod(!!m.gunluk);
  mevStepGoto(1);
  document.getElementById('mev-modal-title').textContent = m.gunluk ? 'Günlük Vadeli Mevduat Düzenle' : 'Mevduat Düzenle';

  // Oto hesap toggle — düzenleme modunda kapalı
  const otoToggle = document.getElementById('mev-oto-hesap');
  if(otoToggle) { otoToggle.checked = false; onMevOtoHesapToggle(); }

  // Banka hesap select
  _fillMevHesapSel(m.hesapId||'');
  // Vadesiz hesap select
  _fillMevVadesizSel(m.vadesizHesapId||'');

  // Strateji geri yükle
  const stratejiSel = document.getElementById('mev-strateji');
  if(stratejiSel) { stratejiSel.value = m.strateji || ''; onMevStratejiChange(); }

  // Banka geri yükle — hidden input + display
  const hiddenInp = document.getElementById('mev-banka-hidden');
  if(hiddenInp) hiddenInp.value = m.banka||'';
  const displayWrap = document.getElementById('mev-banka-display');
  const displayText = document.getElementById('mev-banka-ad-text');
  if(m.banka) {
    const bankaObj = (DB.bankalar||[]).find(b=>b.id===m.banka);
    if(bankaObj && displayText && displayWrap) {
      displayText.textContent = bankaObj.kisa;
      displayWrap.style.display='flex';
      const lbl = displayWrap.querySelector('span:last-child'); if(lbl) lbl.textContent='Kaydedilmiş';
    }
  } else {
    if(displayWrap) displayWrap.style.display='none';
  }
  const farkWrapEdit = document.getElementById('mev-tutar-fark-wrap');
  if(farkWrapEdit) farkWrapEdit.style.display = 'none';
  setDateInputValue('mev-baslangic', m.baslangic);
  setMoneyInput('mev-tutar', m.tutar);
  document.getElementById('mev-faiz').value = m.faizOran;
  document.getElementById('mev-stopaj').value = m.stopaj;
  document.getElementById('mev-vade').value = m.vade;
  document.getElementById('mev-valor').value = m.valor||0;
  // Para birimi
  const curSel = document.getElementById('mev-para-birimi');
  if(curSel) {
    if(typeof ALL_CURRENCIES !== 'undefined' && ALL_CURRENCIES.length) {
      curSel.innerHTML = buildCurrencyOptions();
    } else {
      curSel.innerHTML = '<option value="TRY">TRY ₺</option><option value="USD">USD $</option><option value="EUR">EUR €</option>';
    }
    curSel.value = m.paraBirimi || 'TRY';
  }
  calcMevduat();
  const bitisGoster = document.getElementById('mev-bitis-goster');
  if(bitisGoster) bitisGoster.value = fmtDate(m.bitis);
  // [ES module] Eskiden burada doğrudan classList.add('open') kullanılıyordu
  // (openModal() sarmalayıcısı BYPASS ediliyordu — "formu resetlemesin diye"
  // deniyordu, çünkü modal-genel.js'deki populateMevduatModal() koşulsuz
  // setEditMevduatId(null) yapıyordu). Bunu modal-genel.js'de düzelttik:
  // artık populateMevduatModal() sadece editMevduatId BOŞKEN çağrılıyor —
  // burada zaten setEditMevduatId(id) yukarıda çağrıldığı için openModal()
  // güvenle kullanılabiliyor. Bu da wizard-routing.js'in hash senkronunu
  // (adım + düzenleme id'si) devreye sokuyor — F5/deep-link sonrası aynı
  // kayıt düzenleme modunda tekrar açılabiliyor.
  openModal('modal-mevduat');

  // editMevduat() modalı eskiden openModal() üzerinden açmıyordu, bu yüzden
  // openModal()'ın patch'lediği applyChipsToContainer çağrısı tetiklenmiyordu
  // — aynı editIslem() bug'ı: Vadeli/Kaynak Hesap, Strateji ve Vadesiz Hesap
  // select'leri popup'a dönüşmeden native select olarak kalıyordu.
  // Burada da manuel tetikliyoruz (openModal() zaten bunu yapmadığı için).
  setTimeout(() => {
    const modalEl = document.getElementById('modal-mevduat');
    if(modalEl) {
      if(typeof applyChipsToContainer === 'function') applyChipsToContainer(modalEl);
      if(typeof wireAllMoneyCurButtons === 'function') wireAllMoneyCurButtons();
    }
  }, 30);
}

