import { saveData } from '../../../core/app-core-base.js';
import { fmtCur, localDateStr } from '../../../core/format.js';
import { ALL_CURRENCIES, DB } from '../../../core/state.js';
import { buildCurrencyOptions } from '../../../domain/doviz.js';
import { showConfirm, showToast } from '../../components/modal-genel.js';
import { setDateInputValue, setMoneyInput } from '../../components/money-input.js';
import { calcMevduatObj } from '../abonelik.js';
import { _mevGunlukMod, set_mevGunlukMod } from './00-state.js';
import { calcMevduat } from './01-mevduat-form-wizard.js';
import { renderMevduat } from './05-mevduat-liste-render.js';
import { _fillMevVadesizSel, _mevGizliAksiyonlar, onMevStratejiChange } from './06-mevduat-hesap-secim-formu.js';
import { odOdendiMi } from '../odeme/01-genel-yardimcilar.js';
import { getBanka } from '../tanimlamalar/01-genel-yardimcilar.js';
import { renderOzet } from '../ozet.js';
import { renderHesaplar } from '../hesaplar/04-hesap-liste-render.js';
import { openModal } from '../../components/modal-genel.js';
import { call } from '../../../core/wrap-registry.js';
// ============================================================
// js/ui/pages/mevduat/03-mevduat-yenileme-ve-kapama.js
// Vade sonu yenileme (tümü/anapara) ve vadesize aktarma/kapama
//
// Bu dosya, eskiden tek parça olan js/ui/pages/mevduat.js
// (43 export, 1589 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function mevduatYenile(mevId) {
  const m = (DB.mevduatlar||[]).find(x=>x.id===mevId);
  if(!m) return;
  openModal('modal-mevduat');
  // Yeni mevduat modal'ını doldur
  setTimeout(()=>{
    set_mevGunlukMod(!!m.gunluk);
    if(m.gunluk) document.getElementById('mev-modal-title').textContent = 'Günlük Vadeli Mevduat Yenile';
    // Banka — hidden + display
    const bankaObj = m.banka ? (DB.bankalar||[]).find(b=>b.id===m.banka) : null;
    const hid = document.getElementById('mev-banka-hidden');
    if(hid) hid.value = m.banka||'';
    const dw = document.getElementById('mev-banka-display');
    const dt = document.getElementById('mev-banka-ad-text');
    if(bankaObj && dw && dt) { dt.textContent=bankaObj.kisa; dw.style.display='flex'; const lbl=dw.querySelector('span:last-child'); if(lbl)lbl.textContent='Önceki mevduattan'; }
    else if(dw) dw.style.display='none';
    setMoneyInput('mev-tutar', m.nihai != null ? m.nihai : calcMevduatObj(m).nihai);
    document.getElementById('mev-faiz').value = m.faizOran||'';
    document.getElementById('mev-stopaj').value = m.stopaj||15;
    document.getElementById('mev-vade').value = m.vade||'';
    document.getElementById('mev-valor').value = m.valor||0;
    const curSel = document.getElementById('mev-para-birimi');
    if(curSel) { if(typeof ALL_CURRENCIES!=='undefined'&&ALL_CURRENCIES.length){curSel.innerHTML=buildCurrencyOptions();}else{curSel.innerHTML='<option value="TRY">TRY ₺</option><option value="USD">USD $</option><option value="EUR">EUR €</option>';} curSel.value=m.paraBirimi||'TRY'; }
    const stratejiSel = document.getElementById('mev-strateji');
    if(stratejiSel) { stratejiSel.value = 'yenile_tum'; onMevStratejiChange(); }
    setDateInputValue('mev-baslangic', m.bitis || localDateStr(new Date()));
    calcMevduat();
    showToast(`${getBanka(m.banka)||'?'} mevduatı yenileniyor — yeni IBAN ve vadeyi girin`, 'info');
  }, 80);
}

export function mevduatYenileAnaPara(mevId) {
  const m = (DB.mevduatlar||[]).find(x=>x.id===mevId);
  if(!m) return;
  const selEl = document.getElementById(`mev-aksiyon-vadesiz-${mevId}`);
  const vadesizId = selEl ? selEl.value : (m.vadesizHesapId||'');
  if(!vadesizId) { showToast('Lütfen faizin aktarılacağı vadesiz hesabı seçin', 'error'); return; }
  openModal('modal-mevduat');
  setTimeout(()=>{
    // Banka — hidden + display
    const bankaObj = m.banka ? (DB.bankalar||[]).find(b=>b.id===m.banka) : null;
    const hid = document.getElementById('mev-banka-hidden');
    if(hid) hid.value = m.banka||'';
    const dw = document.getElementById('mev-banka-display');
    const dt = document.getElementById('mev-banka-ad-text');
    if(bankaObj && dw && dt) { dt.textContent=bankaObj.kisa; dw.style.display='flex'; const lbl=dw.querySelector('span:last-child'); if(lbl)lbl.textContent='Önceki mevduattan'; }
    else if(dw) dw.style.display='none';
    setMoneyInput('mev-tutar', m.tutar);
    document.getElementById('mev-faiz').value = m.faizOran||'';
    document.getElementById('mev-stopaj').value = m.stopaj||15;
    document.getElementById('mev-vade').value = m.vade||'';
    document.getElementById('mev-valor').value = m.valor||0;
    const curSel = document.getElementById('mev-para-birimi');
    if(curSel) { if(typeof ALL_CURRENCIES!=='undefined'&&ALL_CURRENCIES.length){curSel.innerHTML=buildCurrencyOptions();}else{curSel.innerHTML='<option value="TRY">TRY ₺</option><option value="USD">USD $</option><option value="EUR">EUR €</option>';} curSel.value=m.paraBirimi||'TRY'; }
    const stratejiSel = document.getElementById('mev-strateji');
    if(stratejiSel) { stratejiSel.value = 'yenile_ana_faiz_vadesiz'; onMevStratejiChange(); }
    _fillMevVadesizSel(vadesizId);
    setDateInputValue('mev-baslangic', m.bitis || localDateStr(new Date()));
    calcMevduat();
    showToast(`Ana para yenileniyor, faiz (${fmtCur(m.faiz, m.paraBirimi)}) vadesiz hesaba aktarılacak`, 'info');
  }, 80);
}

export function mevduatTumunuVadesizeAktar(mevId, silent) {
  const m = (DB.mevduatlar||[]).find(x=>x.id===mevId);
  if(!m) return;
  const selEl = document.getElementById(`mev-aksiyon-vadesiz-${mevId}`);
  const vadesizId = selEl ? selEl.value : (m.vadesizHesapId||'');
  if(!vadesizId) { if(!silent) showToast('Lütfen aktarım yapılacak vadesiz hesabı seçin', 'error'); return; }
  const hesap = (DB.hesaplar||[]).find(h=>h.id===vadesizId);
  if(!hesap) { if(!silent) showToast('Hesap bulunamadı', 'error'); return; }
  const _yap = () => {
    const lk = call('_lKey', 'mevduat', mevId, null);
    // nihai kaydedilmemişse (eski veri) calcMevduatObj ile hesapla
    const nihaiTutar = m.nihai != null ? m.nihai : calcMevduatObj(m).nihai;
    if(call('_lGet', lk) == null) {
      hesap.bakiye = (hesap.bakiye||0) + nihaiTutar;
      call('_lSet', lk, nihaiTutar);
    }
    // Ödeme durumu sistemine de yansıt — böylece "Yaklaşan Ödemeler" listesinde
    // ve dashboard'daki "Vade Doldu" aksiyon kartında bu mevduat artık "Bekliyor"
    // değil "Ödendi" görünür ve aksiyon kartı bir daha çıkmaz (bkz. renderOzet
    // vadeDolmus filtresi ve upcoming listesindeki mevduat push'u).
    if(!odOdendiMi(m.odDurum)) {
      m.odDurum = { durum:'odendi', tarih: localDateStr(new Date()), tutar: nihaiTutar, not: silent ? 'Otomatik: vadesiz hesaba aktarıldı' : 'Vadesiz hesaba aktarıldı' };
    }
    m._kapatildi = true; // geçmiş/kapanmış kayıt — otomatik vade kontrolü bir daha dokunmaz
    // Mevduat kaydı geçmiş kayıt olarak listede kalır (silinmez), sadece "Aktarıldı" işaretlenir.
    // İlişkili vadeli hesap varsa silinmez — bakiyesi sıfırlanıp "kapalı" durumuna
    // alınır (para zaten vadesize aktarıldı, hesap/mevduat ilişkisi geçmiş kayıt olarak korunur).
    if(m.hesapId) {
      const vadeliHesap = (DB.hesaplar||[]).find(h=>h.id===m.hesapId);
      if(vadeliHesap) {
        vadeliHesap.durum = 'kapali';
        vadeliHesap.bakiye = 0;
      }
    }
    saveData();
    renderOzet();
    if(typeof renderMevduat==='function') renderMevduat();
    if(typeof renderHesaplar==='function') renderHesaplar();
    showToast(`${fmtCur(nihaiTutar,m.paraBirimi)} → ${hesap.ad} aktarıldı ✓`, 'success');
  };
  if(silent) {
    _yap();
  } else {
    const _nihaiGoster = m.nihai != null ? m.nihai : calcMevduatObj(m).nihai;
    showConfirm(`${fmtCur(_nihaiGoster, m.paraBirimi)} tutarını "${hesap.ad}" hesabına aktarmak istiyor musunuz?\nVadeli hesap kapatılacak.`, _yap, { title: 'Aktarılsın mı?', okLabel: 'Aktar', okClass: 'btn-primary' });
  }
}

export function mevduatAksiyonErteGiz(mevId) {
  _mevGizliAksiyonlar.add(mevId);
  renderOzet();
}

export function checkMevduatHesapKapat(mevduatId) {
  const mev = (DB.mevduatlar||[]).find(m=>m.id===mevduatId);
  if(!mev || !mev.hesapId) return;
  const hesap = (DB.hesaplar||[]).find(h=>h.id===mev.hesapId);
  if(!hesap) return;
  const today = localDateStr(new Date());
  if(mev.bitis > today) return; // vade dolmadı
  if(hesap.tur !== 'vadeli') return;
  // Otomatik kapat — onay sorma. Para zaten ilgili vadesiz hesaba aktarıldığı
  // (entMevduatYansit) için hesap silinmez; bakiyesi sıfırlanıp "kapalı" durumuna
  // alınır (hayalet bakiye kalmaz, hesap/mevduat ilişkisi geçmiş kayıt olarak korunur).
  setTimeout(()=>{
    hesap.durum = 'kapali';
    hesap.bakiye = 0;
    mev._kapatildi = true;
    saveData();
    if(typeof renderHesaplar==='function') renderHesaplar();
    showToast(`✓ "${hesap.ad}" vadeli hesabı vadesi dolduğu için kapatıldı`, 4000);
  }, 600);
}

export function deleteMevduat(id) {
  const mev = (DB.mevduatlar||[]).find(m=>m.id===id);
  if(!mev) return;

  // (patch-rf-v58-mevduat-upcoming-bugfix.js'den kaynaştırıldı) Onay callback'i
  // çalıştığında mevcut kod zaten odDurum=iptal yazıyor. Burada intent'i de
  // saklıyoruz; kullanıcı onaylamazsa kayıt yalnızca geçici flag almış olur,
  // render görünürlüğü açısından yine erken kapatma niyeti olarak değerlendirilir.
  mev._erkenKapatildiIntent = true;

  // İlişkili vadeli hesap ve vadesiz hesap bilgilerini hazırla
  const vadelihesap = mev.hesapId ? (DB.hesaplar||[]).find(h=>h.id===mev.hesapId) : null;
  const vadesizHesap = mev.vadesizHesapId ? (DB.hesaplar||[]).find(h=>h.id===mev.vadesizHesapId) : null;

  // Onay mesajını dinamik oluştur
  let onayMesaji = 'Bu mevduatı kapatmak istiyor musunuz?';
  const anaParaTutar = mev.tutar || 0;
  if (vadelihesap && vadesizHesap && anaParaTutar > 0) {
    onayMesaji = `Bu mevduatı kapatmak istiyor musunuz?\n\n` +
      `• "${vadelihesap.ad}" vadeli hesabı kapalı durumuna alınacak\n` +
      `• Ana para (${fmtCur(anaParaTutar, mev.paraBirimi)}) → "${vadesizHesap.ad}" hesabına aktarılacak`;
  } else if (vadelihesap) {
    onayMesaji = `Bu mevduatı kapatmak istiyor musunuz?\n\n• "${vadelihesap.ad}" vadeli hesabı kapalı durumuna alınacak`;
  }

  showConfirm(onayMesaji, () => {
    // 1) İlişkili vadeli hesabı silme — bakiyesini sıfırlayıp "kapalı" durumuna al,
    // ana parayı vadesiz hesaba aktar. Böylece hesap/mevduat ilişkisi geçmiş kayıt olarak korunur.
    if (vadelihesap && vadelihesap.tur === 'vadeli') {
      if (vadesizHesap && anaParaTutar > 0) {
        vadesizHesap.bakiye = (vadesizHesap.bakiye || 0) + anaParaTutar;
        showToast(`Ana para (${fmtCur(anaParaTutar, mev.paraBirimi)}) → "${vadesizHesap.ad}" hesabına aktarıldı`, 'success');
      }
      vadelihesap.durum = 'kapali';
      vadelihesap.bakiye = 0;
    }

    // 2) Mevduat kaydını silme — "bitti" (kapanmış) durumuna al, geçmiş kayıt olarak listede kalsın.
    // Yaklaşan Ödemeler/Gelirler listesine tekrar düşmemesi için ödeme durumunu da
    // iptal olarak işaretliyoruz; asıl aktiflik kontrolü yine _kapatildi üzerinden yapılır.
    mev._kapatildi = true;
    mev._erkenKapatildi = true;
    mev.kapatmaTipi = 'iptal';
    mev.odDurum = { durum:'iptal', tarih: localDateStr(new Date()), tutar: 0, not: 'Mevduat vade bitmeden kapatıldı' };
    saveData();
    if(typeof renderHesaplar==='function') renderHesaplar();
    if(typeof renderOzet==='function') renderOzet();
    renderMevduat();
  });
}

