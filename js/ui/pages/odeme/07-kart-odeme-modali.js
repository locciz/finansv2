import { saveData } from '../../../core/app-core-base.js';
import { fmtCur, fmtDate, localDateStr } from '../../../core/format.js';
import { DB } from '../../../core/state.js';
import { showToast } from '../../components/modal-genel.js';
import { getMoneyInput, setDateInputValue, setMoneyInput } from '../../components/money-input.js';
import { renderExtreler } from '../ekstreler/02-ekstre-render.js';
import { renderIslemler } from '../islemler/03-islem-liste-render.js';
import { kd2RenderExtreler } from '../kartlar/05-kart-detay-v2.js';
import { kdRenderExtreler } from '../kartlar/04-kart-detay-v1.js';
import { _kartOdemeHizliTransferGuncelle, _kartOdemeUygula, deleteKartOdeme } from '../kartlar/08-kart-odeme.js';
import { _kd2KartId, _kdKartId } from '../kartlar/09-kart-altyapi.js';
import { odKartDonemOverride, odSetDurum } from './01-genel-yardimcilar.js';
import { odLogEkle } from './03-odeme-log.js';
import { odModalKapat } from './04-modal-yasam-dongusu.js';
import { _odPopSeciliHesapId } from './05-hesap-secim-popup.js';
import { _odModal } from './08-popup-giris-noktalari.js';
import { renderOzet } from '../ozet.js';
// ============================================================
// js/ui/pages/odeme/07-kart-odeme-modali.js
// Kart ödemesi özel modal akışı (ertelendi/bekliyor/ödendi)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/odeme.js
// (52 export, 2097 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function _odKartModalKaydet() {
  if(_odModal.seciliDurum === 'ertelendi') { _odKartErtelendiKaydet(); return; }
  if(_odModal.seciliDurum === 'bekliyor') { _odKartBekliyorKaydet(); return; }

  const tutarStr = (document.getElementById('od-pop-tutar')?.value || '').trim();
  let tutar = tutarStr === '' ? NaN : getMoneyInput('od-pop-tutar');
  if(isNaN(tutar)) tutar = 0;
  if(!(tutar > 0)) { showToast('Geçerli bir tutar giriniz', 'error'); return; }
  const tarih = document.getElementById('od-pop-tarih')?.value || localDateStr(new Date());
  if(!tarih) { showToast('Tarih giriniz', 'error'); return; }
  const hesapId = _odPopSeciliHesapId();

  const hesap = (DB.hesaplar||[]).find(h=>h.id===hesapId);
  const kaydet = () => {
    _kartOdemeUygula({ kartId:_odModal.id, pb:_odModal._kartPb||'TRY', donemKey:_odModal.key, tutar, tarih, hesapId });
    odModalKapat();
  };
  if(hesap) {
    const kullanilab = (hesap.bakiye||0);
    if(kullanilab < tutar) {
      const bakiyeStr = fmtCur(hesap.bakiye||0, hesap.paraBirimi||'TRY');
      const kmhStr = hesap.kmhLimit > 0 ? ` + KMH ${fmtCur(hesap.kmhLimit, hesap.paraBirimi||'TRY')}` : '';
      showToast(`Yetersiz bakiye! ${hesap.ad}: ${bakiyeStr}${kmhStr} mevcut, ${fmtCur(tutar,_odModal._kartPb||'TRY')} gerekiyor. Ödeme durumu popupındaki Hızlı Transfer butonunu kullanabilirsin.`, 'error');
      _kartOdemeHizliTransferGuncelle('od-modal');
      return;
    }
  }
  kaydet();
}

export function _odKartErtelendiKaydet() {
  const kart = (DB.kartlar||[]).find(k=>k.id===_odModal.id);
  if(!kart) return;
  const donemKey = _odModal.key;
  const yeniTarih = document.getElementById('od-pop-tarih')?.value || '';
  if(!yeniTarih) { showToast('Yeni son ödeme tarihi giriniz', 'error'); return; }
  const mevcutTarih = _odModal.tarih || '';
  if(mevcutTarih && yeniTarih <= mevcutTarih) {
    showToast('⚠ Yeni tarih, mevcut son ödeme tarihinden sonra olmalı', 'error');
    return;
  }
  const not = document.getElementById('od-pop-not')?.value || '';
  const overrideData = { durum:'ertelendi', yeniTarih, tarih: yeniTarih, not };
  odSetDurum(kart, donemKey, overrideData);
  odLogEkle('kart', kart.id, donemKey, 'ertelendi', 0, not);
  saveData();
  odModalKapat();
  renderExtreler();
  renderOzet();
  if (typeof _kdKartId !== 'undefined' && _kdKartId === kart.id) kdRenderExtreler();
  if (typeof _kd2KartId !== 'undefined' && _kd2KartId === kart.id) kd2RenderExtreler();
  showToast(`↷ Son ödeme tarihi ${fmtDate(yeniTarih)} olarak ertelendi`, 'success');
}

export function _odKartBekliyorKaydet() {
  const kart = (DB.kartlar||[]).find(k=>k.id===_odModal.id);
  if(!kart) { odModalKapat(); return; }
  const donemKey = _odModal.key;

  // 1) Erteleme override'ını kaldır (varsa)
  const ertelenmisMi = !!odKartDonemOverride(kart, donemKey);
  if(ertelenmisMi) odSetDurum(kart, donemKey, null);

  // 2) Bu döneme ait tüm kart ödemelerini sil — her biri kendi bakiyesini
  // otomatik iade eder (sessiz modda: toplu işlem sonunda tek save/render yapılır).
  const odemeler = (DB.kartOdemeleri||[]).filter(o=>o.kartId===kart.id && o.donemKey===donemKey);
  odemeler.forEach(o => deleteKartOdeme(o.id, {sessiz:true}));

  if(!ertelenmisMi && odemeler.length===0) { odModalKapat(); return; }

  odLogEkle('kart', kart.id, donemKey, 'bekliyor', 0,
    [ertelenmisMi?'Erteleme iptal edildi':null, odemeler.length?`${odemeler.length} ödeme geri alındı`:null].filter(Boolean).join(', '));
  saveData();
  odModalKapat();
  renderExtreler();
  renderIslemler();
  renderOzet();
  if (typeof _kdKartId !== 'undefined' && _kdKartId === kart.id) kdRenderExtreler();
  if (typeof _kd2KartId !== 'undefined' && _kd2KartId === kart.id) kd2RenderExtreler();
  showToast('↺ Bekliyor durumuna alındı, önceki ödeme/erteleme geri alındı', 'success');
}

export function _odKartModalSifirla() {
  const kart = (DB.kartlar||[]).find(k=>k.id===_odModal.id);
  if(!kart) { odModalKapat(); return; }
  const donemKey = _odModal.key;
  const ov = odKartDonemOverride(kart, donemKey);
  if(!ov) { odModalKapat(); return; }
  odLogEkle('kart', kart.id, donemKey, 'sıfırlandı', 0, 'Erteleme geri alındı');
  odSetDurum(kart, donemKey, null);
  saveData();
  odModalKapat();
  renderExtreler();
  renderOzet();
  if (typeof _kdKartId !== 'undefined' && _kdKartId === kart.id) kdRenderExtreler();
  if (typeof _kd2KartId !== 'undefined' && _kd2KartId === kart.id) kd2RenderExtreler();
  showToast('↺ Erteleme geri alındı, son ödeme tarihi eski haline döndü', 'success');
}

export function _odModalSecDurumKart(durum) {
  _odModal.seciliDurum = durum;
  document.querySelectorAll('.od-status-card').forEach(c=>{
    const d = c.dataset.dur;
    c.className = 'od-status-card' + (d===durum ? ' sel-'+d+' selected' : '');
  });
  const tutarEl = document.getElementById('od-pop-tutar');
  const hesapWrap = document.getElementById('od-hesap-field-wrap');
  const tutarWrap = document.getElementById('od-tutar-field-wrap');
  const hintEl = document.getElementById('od-ertelendi-hint');
  const tarihLbl = document.getElementById('od-tarih-lbl');
  const tarihEl = document.getElementById('od-pop-tarih');

  if(durum === 'ertelendi') {
    // Erteleme parasal bir işlem değil — sadece son ödeme tarihini değiştirir.
    if(hesapWrap) hesapWrap.style.display = 'none';
    if(tutarWrap) tutarWrap.style.display = 'none';
    if(tarihLbl) tarihLbl.textContent = 'Yeni Son Ödeme Tarihi';
    const mevcutTarih = _odModal.tarih || localDateStr(new Date());
    if(tarihEl && (!tarihEl.value || tarihEl.value <= mevcutTarih)) {
      const yeni = new Date(mevcutTarih+'T00:00:00'); yeni.setDate(yeni.getDate()+7);
      setDateInputValue(tarihEl, localDateStr(yeni));
    }
    if(hintEl) {
      hintEl.style.display = '';
      hintEl.textContent = `Bu dönemin son ödeme tarihi ${fmtDate(mevcutTarih)} yerine seçtiğiniz tarihe ertelenir. Borç tutarı değişmez.`;
    }
    _kartOdemeHizliTransferGuncelle('od-modal');
    return;
  }

  if(durum === 'bekliyor') {
    // Bekliyor parasal bir işlem değil — tutar/hesap girilmez. Kaydedince bu
    // döneme ait erteleme ve yapılmış tüm ödemeler geri alınır (bkz. _odKartBekliyorKaydet).
    if(hesapWrap) hesapWrap.style.display = 'none';
    if(tutarWrap) tutarWrap.style.display = 'none';
    if(tarihLbl) tarihLbl.textContent = 'Ödeme Tarihi';
    if(hintEl) {
      hintEl.style.display = '';
      hintEl.textContent = 'Bu dönem "Bekliyor"a çekilir: varsa erteleme iptal edilir, yapılmış ödemeler silinir ve bakiye iade edilir.';
    }
    _kartOdemeHizliTransferGuncelle('od-modal');
    return;
  }

  // Diğer durumlara dönüldüğünde erteleme/bekliyor moduyla gizlenen alanları geri göster
  if(hesapWrap) hesapWrap.style.display = '';
  if(tutarWrap) tutarWrap.style.display = '';
  if(tarihLbl) tarihLbl.textContent = 'Ödeme Tarihi';
  if(hintEl) hintEl.style.display = 'none';
  if(tarihEl && (!tarihEl.value)) setDateInputValue(tarihEl, localDateStr(new Date()));

  if(durum === 'odendi') {
    const kalan = _odModal._kartKalan || 0;
    setMoneyInput('od-pop-tutar', kalan > 0.01 ? kalan : (_odModal._kartBorcSifirIzin ? 0 : (_odModal.tutar||0)));
  } else if(durum === 'kismi' && tutarEl) {
    tutarEl.value = '';
  }
  _kartOdemeHizliTransferGuncelle('od-modal');
}

