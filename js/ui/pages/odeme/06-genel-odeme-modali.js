import { saveData } from '@core/app-core-base.js';
import { fmt, fmtCur, fmtDate, localDateStr } from '@core/format.js';
import { DB, defaultCurrency } from '@core/state.js';
import { _krediGecikmeFaizi, _krediTaksitKalan, getKrediKalanBorc, getKrediTaksitler } from '@domain/hesaplamalar.js';
import { showConfirm, showToast } from '@components/modal-genel.js';
import { getMoneyInput, setDateInputValue, setMoneyInput } from '@components/money-input.js';
import { _hesapVarsayilanVeyaBankaHesabi } from '@pages/hesaplar/01-genel-yardimcilar.js';
import { _kartOdemeHizliTransferGuncelle } from '@pages/kartlar/08-kart-odeme.js';
import { checkMevduatHesapKapat } from '@pages/mevduat/03-mevduat-yenileme-ve-kapama.js';
import { odGetDurum, odSetDurum } from '@pages/odeme/01-genel-yardimcilar.js';
import { odLogEkle } from '@pages/odeme/03-odeme-log.js';
import { odModalKapat } from '@pages/odeme/04-modal-yasam-dongusu.js';
import { _odKartModalKaydet, _odKartModalSifirla } from '@pages/odeme/07-kart-odeme-modali.js';
import { _odModal } from '@pages/odeme/08-popup-giris-noktalari.js';
import { call, register } from '@core/wrap-registry.js';
// ============================================================
// js/ui/pages/odeme/06-genel-odeme-modali.js
// Genel ödeme modalı (kira/maaş/elden/mevduat/kredi durum değiştirme akışı)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/odeme.js
// (52 export, 2097 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function odModalSifirla() {
  if(_odModal.tip === 'kart') { _odKartModalSifirla(); return; }
  const {tip,id,key} = _odModal;
  const item = call('odGetItem', tip, id);
  if(!item) return;
  // ÖNEMLİ: durum silinmeden ÖNCE bakiyeyi geri al — _otoBakiyeGuncelle eski
  // yansımayı (varsa) logdan okuyup ters işlemi uygular ve log kaydını temizler.
  // Bu çağrı olmadan "Sıfırla" sadece durumu temizliyor ama önceden hesaba
  // işlenmiş/hesaptan düşülmüş tutar hesapta kalmış oluyordu.
  call('_otoBakiyeGuncelle', tip, id, key, null, 0);
  odLogEkle(tip, id, key, 'sıfırlandı', 0, 'Durum sıfırlandı');
  odSetDurum(item, key, null);
  saveData();
  odModalKapat();
  call('odRenderPage', tip);
  showToast('Ödeme durumu sıfırlandı');
}

export function _odHesapSecilebilirMi(tip) {
  return tip === 'kira' || tip === 'maas' || tip === 'elden' || tip === 'kredi' || tip === 'kmh' || tip === 'mevduat' || tip === 'depozito' || tip === 'abonelik';
}

export function _odHesapVeYon(tip, item, key) {
  if (tip === 'kira')  return { hesapId: item.hesapId || null, yon: (item.tutar >= 0 ? 1 : -1) };
  if (tip === 'maas')  return { hesapId: item.hesapId || null, yon: 1 };
  if (tip === 'elden') return { hesapId: item.hesapId || null, yon: (item.tur === 'gelir' ? 1 : -1) };
  if (tip === 'kredi') return { hesapId: item.hesapId || _hesapVarsayilanVeyaBankaHesabi((DB.hesaplar||[]).filter(h=>h.tur!=='vadeli'&&h.durum!=='kapali'), '', item.banka || null, item.paraBirimi || defaultCurrency || 'TRY') || null, yon: -1 };
  if (tip === 'abonelik') return { hesapId: item.hesapId || null, yon: -1 };
  if (tip === 'kmh') {
    const kmhKart = (DB.kartlar || []).find(k => k.id === item.kmhId) || (DB.hesaplar || []).find(h => h.id === item.kmhId);
    const bankaId = kmhKart ? (kmhKart.banka || null) : null;
    const hesapId = item.odemeHesapId || (kmhKart ? (kmhKart.hesapId || item.kmhId) : null) || _hesapVarsayilanVeyaBankaHesabi((DB.hesaplar||[]).filter(h=>h.tur!=='vadeli'&&h.durum!=='kapali'), '', bankaId, defaultCurrency || 'TRY');
    return { hesapId: hesapId || null, yon: -1 };
  }
  if (tip === 'mevduat') {
    // Vade dolunca para "vadesizHesapId" (dönüş hesabı) alanına yatar; henüz
    // seçilmemişse kaynak hesap (hesapId) ile fallback yapılır.
    return { hesapId: item.vadesizHesapId || item.hesapId || null, yon: 1 };
  }
  if (tip === 'depozito') {
    // key 'odeme' (verilme/alınma) kontratın kendi yönünü izler; 'iade' bacağı tersidir.
    let yon = item.tutar >= 0 ? 1 : -1;
    if (key === 'iade') yon = -yon;
    return { hesapId: item.depozitoHesapId || item.hesapId || null, yon };
  }
  return { hesapId: null, yon: 0 };
}

export function _odKaydedilecekHesapAlani(tip) {
  if (tip === 'mevduat') return 'vadesizHesapId';
  if (tip === 'kmh') return 'odemeHesapId';
  if (tip === 'depozito') return 'depozitoHesapId';
  return 'hesapId';
}

export function _odBakiyeOnizle(tip, item, key, newDurum, newTutar, hesapIdOverride) {
  const {hesapId: varsayilanHesapId, yon} = _odHesapVeYon(tip, item, key);
  const hesapId = hesapIdOverride !== undefined ? hesapIdOverride : varsayilanHesapId;
  if (!hesapId || !yon) return null;
  const hesap = (DB.hesaplar || []).find(h => h.id === hesapId);
  if (!hesap) return null;

  const lk = call('_lKey', tip, item.id, tip === 'elden' ? null : key);
  const eski = call('_lGet', lk) || 0;
  let delta;
  if (['odendi', 'kismi'].includes(newDurum)) {
    delta = (Number(newTutar) - eski) * yon;
  } else {
    delta = -eski * yon; // bekliyor/ertelendi/gecikti/iptal/atlandi → geri al
  }
  const mevcut = hesap.bakiye || 0;
  const sonraki = mevcut + delta;
  const kmhLimit = hesap.kmhLimit || 0;
  const yeterli = delta >= -0.001 || sonraki >= -0.005;
  return { hesap, mevcut, sonraki, kmhLimit, yeterli, delta, hesapId };
}

export function odModalKaydet() {
  if(_odModal.tip === 'kart') { _odKartModalKaydet(); return; }
  const {tip,id,key,tarih,tutar} = _odModal;
  const item = call('odGetItem', tip, id);
  if(!item) return;
  const ov = odGetDurum(item,key)||{};
  const seciliDurum = _odModal.seciliDurum || ov.durum || 'bekliyor';
  let newDurum = seciliDurum;
  const newTarih = document.getElementById('od-pop-tarih')?.value || localDateStr(new Date());
  const isKrediTip = (tip === 'kredi' || tip === 'kmh');

  // Taksit ertelemesi: yeni vade tarihi mevcut vadeden sonra olmalı,
  // yoksa taksit planı geriye kayar ve tutarsız bir tabloya yol açar.
  if (isKrediTip && newDurum === 'ertelendi') {
    const mevcutVade = tarih || ov.yeniTarih || '';
    if (mevcutVade && newTarih <= mevcutVade) {
      showToast('⚠ Yeni vade tarihi, mevcut vade tarihinden sonra olmalı');
      return;
    }
  }

  // od-pop-tutar artık standart money-input olduğu için parse işlemini de
  // diğer tutar alanlarıyla aynı merkezi fonksiyon (getMoneyInput) üstleniyor.
  // Alan boşsa NaN'a düşürüyoruz — aşağıdaki isNaN kontrolleri "boş bırakıldıysa
  // tam tutar/mevcut davranışa geri dön" mantığını bozmadan devam etsin.
  const _odTutarStr = (document.getElementById('od-pop-tutar')?.value || '').trim();
  const newTutarField = _odTutarStr === '' ? NaN : getMoneyInput('od-pop-tutar');
  const newNot   = document.getElementById('od-pop-not')?.value || '';
  const fullTutar = Number(tutar) || 0;
  let finalTutar;
  let bilgiMesaji = 'Ödeme durumu kaydedildi';

  if (newDurum === 'kismi') {
    // Bu ödemede girilen tutar, önceki kısmi ödemeye eklenir (birikimli).
    // Kalan borç tamamlanınca durum otomatik "Ödendi"ye döner.
    const mevcutOdenen = (ov.durum === 'kismi') ? (Number(ov.tutar) || 0) : 0;
    const buOdeme = isNaN(newTutarField) ? 0 : Math.abs(newTutarField);
    const toplamOdenen = mevcutOdenen + buOdeme;
    if (fullTutar > 0 && toplamOdenen >= fullTutar - 0.01) {
      newDurum = 'odendi';
      finalTutar = fullTutar;
      bilgiMesaji = '✓ Kalan tutar tamamlandı, "Ödendi" olarak işaretlendi';
    } else {
      finalTutar = toplamOdenen;
      bilgiMesaji = buOdeme > 0.001
        ? `⊟ Ödeme eklendi, kalan: ${fmt(Math.max(0, fullTutar - toplamOdenen))}`
        : 'Kısmi ödeme kaydedildi';
    }
  } else {
    finalTutar = isNaN(newTutarField) ? (tutar||0) : newTutarField;
  }
  if(newDurum==='iptal' && (tip==='kira'||tip==='maas'||tip==='depozito')) finalTutar=0;

  // Kredi/KMH: kullanıcı "Kalanın Tamamı" kısayoluyla bu taksitin kendi
  // tutarından FAZLASINI girdiyse (yani tek taksiti değil, kalan tüm
  // borcu kapatmak istiyorsa), bu büyük tutarı TEK bir taksite yazmak
  // hem "kalan borç" hesaplarını bozar hem de taksit planında sadece bu
  // satır "Ödendi" görünür, diğerleri hâlâ "Bekliyor" kalır. Bunun yerine
  // ödenmemiş her taksiti KENDİ tutarıyla ayrı ayrı "Ödendi" işaretleriz;
  // bu taksit de dahil olmak üzere kalan borcun tamamı gerçekten kapanır.
  let _digerTaksitKapatildi = 0;
  if (isKrediTip && newDurum === 'odendi' && item && finalTutar > fullTutar + 0.5) {
    const todayStr = localDateStr(new Date());
    const taksitler = getKrediTaksitler(item).slice().sort((a,b)=>a.no-b.no);
    let kalanOdeme = finalTutar - fullTutar; // bu taksitin kendi payı düşüldükten sonra kalan fazla ödeme
    taksitler.forEach(t => {
      if (t.no === key) return; // mevcut taksit zaten aşağıdaki genel akışla kaydedilecek
      if (kalanOdeme <= 0.5) return;
      const tKalan = _krediTaksitKalan(item, t, todayStr);
      if (tKalan <= 0.01) return; // zaten ödenmiş/etkisiz
      odSetDurum(item, t.no, { durum: 'odendi', tarih: newTarih, tutar: t.tutar, not: 'Kalan borcun tamamı ödemesiyle otomatik kapatıldı' });
      odLogEkle(tip, id, t.no, 'odendi', t.tutar, 'Kalan borcun tamamı ödemesiyle otomatik kapatıldı');
      kalanOdeme -= tKalan;
      _digerTaksitKapatildi++;
    });
    finalTutar = fullTutar; // bu taksitin override'ı kendi tutarıyla sınırlı kalsın
    if (_digerTaksitKapatildi > 0) {
      bilgiMesaji = `✓ Kalan borcun tamamı ödendi, ${_digerTaksitKapatildi + 1} taksit "Ödendi" olarak işaretlendi`;
    }
  }

  // Popup'ta seçilen hesap — kira/maaş/elden/kredi/kmh/mevduat için değiştirilebilir.
  // Her tip kendi alanına yazar (bkz. _odKaydedilecekHesapAlani): mevduat için
  // vadesizHesapId, kmh için odemeHesapId, diğerleri için hesapId. Böylece bir
  // sonraki ödeme/alacakta seçilen hesap otomatik olarak varsayılan gelir.
  const hesapSelEl = document.getElementById('od-pop-hesap');
  let secilenHesapId = null;
  if (hesapSelEl && hesapSelEl.closest('#od-hesap-field-wrap')?.style.display !== 'none') {
    secilenHesapId = hesapSelEl.value || null;
  }
  if (_odHesapSecilebilirMi(tip) && hesapSelEl) {
    const hesapAlani = _odKaydedilecekHesapAlani(tip);
    if (secilenHesapId !== (item[hesapAlani] || null)) {
      item[hesapAlani] = secilenHesapId || null; // kalıcı olarak bu kaleme bağlı hesabı güncelle
    }
  }

  const overrideData = {...ov, durum:newDurum, tarih:newTarih, tutar:finalTutar, not:newNot};
  if (isKrediTip && newDurum === 'ertelendi') {
    overrideData.yeniTarih = newTarih; // taksit planını gerçekten öteler (bkz. _krediTaksitPlanUygula)
    overrideData.sonrakileriOtele = !!document.getElementById('od-ertelendi-cascade')?.checked;
  }
  if (isKrediTip && newDurum === 'gecikti') {
    const girilenOran = document.getElementById('od-gecikme-oran')?.value;
    overrideData.gecikmeFaizOrani = (girilenOran !== undefined && girilenOran !== '') ? Number(girilenOran) : null;
  }

  const _odKaydetUygula = () => {
    odSetDurum(item, key, overrideData);
    // Log kaydet
    odLogEkle(tip, id, key, newDurum, finalTutar, newNot);
    saveData();
    odModalKapat();
    call('odRenderPage', tip);
    showToast(isKrediTip && seciliDurum === 'ertelendi' ? '↷ Taksit ertelendi, plan güncellendi' : bilgiMesaji);
    call('_otoBakiyeGuncelle', tip, id, key, newDurum, finalTutar);
    if(tip==='mevduat' && newDurum==='odendi') {
      const _ms = ((DB.mevduatlar||[]).find(x=>x.id===id)||{}).strateji;
      if(_ms && _ms!=='') setTimeout(()=>call('mevduatOtoStratejiUygula', id), 300);
      else checkMevduatHesapKapat(id);
    }
  };

  // Kaydetmeden önce bakiye kontrolü — para hesaptan çıkacaksa (gider) ve
  // hesap + varsa KMH limiti yetmeyecekse kullanıcıyı uyar, onaylarsa devam et.
  const onizleme = _odBakiyeOnizle(tip, item, key, newDurum, finalTutar, secilenHesapId !== null ? secilenHesapId : undefined);
  if (onizleme && !onizleme.yeterli) {
    _kartOdemeHizliTransferGuncelle('od-modal');
    const pb = onizleme.hesap.paraBirimi || defaultCurrency;
    showConfirm(
      `"${onizleme.hesap.ad}" hesabında yeterli bakiye yok. Bu işlemden sonra bakiye ${fmtCur(onizleme.sonraki, pb)} olacak. Yine de kaydedilsin mi?`,
      _odKaydetUygula,
      { title: 'Yine de kaydedilsin mi?', okLabel: 'Kaydet', okClass: 'btn-primary' }
    );
    return;
  }
  _odKaydetUygula();
}

export function _odModalSecDurum(durum) {
  _odModal.seciliDurum = durum;
  // Grid'i güncelle
  document.querySelectorAll('.od-status-card').forEach(c => {
    const d = c.dataset.dur;
    c.className = 'od-status-card' + (d===durum ? ' sel-'+d+' selected' : '');
  });
  // Vadesiz bilgi göster
  if(durum==='odendi' && _odModal.tip==='mevduat') {
    const m = (DB.mevduatlar||[]).find(x=>x.id===_odModal.id);
    const vadesizH = m?.vadesizHesapId ? (DB.hesaplar||[]).find(h=>h.id===m.vadesizHesapId) : null;
    const src = m?.hesapId ? (DB.hesaplar||[]).find(h=>h.id===m.hesapId) : null;
    const infoEl = document.getElementById('od-modal-vadesiz-info');
    const msgEl  = document.getElementById('od-vadesiz-msg');
    if(m?.strateji && (vadesizH||src)) {
      const hedef = vadesizH?.ad || src?.ad || '?';
      const str = m.strateji==='tumu_vadesiz' ? `Ana para + faiz (${fmt(m.nihai||0)}) → "${hedef}" hesabına otomatik aktarılacak` :
                  m.strateji==='yenile_ana_faiz_vadesiz' ? `Net faiz (${fmt(m.faiz||0)}) → "${hedef}" hesabına aktarılacak, ana para yeni mevduat açacak` :
                  m.strateji==='yenile_tum' ? 'Ana para + faiz ile yeni mevduat otomatik açılacak' : '';
      if(str) { msgEl.textContent=str; infoEl.classList.add('show'); }
      else infoEl.classList.remove('show');
    } else { infoEl.classList.remove('show'); }
  } else {
    document.getElementById('od-modal-vadesiz-info')?.classList.remove('show');
  }
  _odModalKrediAlanlariAyarla(durum);
}

export function _odModalKrediAlanlariAyarla(durum) {
  const isKrediTip = _odModal.tip === 'kredi' || _odModal.tip === 'kmh';
  const tarihLbl = document.getElementById('od-tarih-lbl');
  const tutarLbl = document.getElementById('od-tutar-lbl');
  const tutarWrap = document.getElementById('od-tutar-field-wrap');
  const hintEl = document.getElementById('od-ertelendi-hint');
  const tarihEl = document.getElementById('od-pop-tarih');
  const tutarEl = document.getElementById('od-pop-tutar');
  const cascadeWrap = document.getElementById('od-ertelendi-cascade-wrap');
  const cascadeChk = document.getElementById('od-ertelendi-cascade');
  const item = call('odGetItem', _odModal.tip, _odModal.id);
  const ov = item ? odGetDurum(item, _odModal.key) : null;

  // Varsayılanlara dön
  if (tarihLbl) tarihLbl.textContent = 'Ödeme Tarihi';
  if (tutarLbl) tutarLbl.textContent = 'Ödenen Tutar';
  if (tutarWrap) tutarWrap.style.display = '';
  if (hintEl) hintEl.style.display = 'none';
  if (cascadeWrap) cascadeWrap.style.display = 'none';
  const oranWrapDefault = document.getElementById('od-gecikme-oran-wrap');
  if (oranWrapDefault) oranWrapDefault.style.display = 'none';

  // Kredi/KMH taksitlerinde tutar alanının yanına, o kredinin TÜM ödenmemiş
  // taksitlerinin toplamını (kalan borcun tamamı) tek tuşla dolduran bir
  // kısayol butonu ekliyoruz — erken kapama gibi durumlar için.
  const kalanBtn = document.getElementById('od-kalan-tamamini-btn');
  if (kalanBtn) {
    if (isKrediTip && item) {
      const kalanBorc = getKrediKalanBorc(item);
      if (kalanBorc > 0.01) {
        kalanBtn.style.display = 'flex';
        kalanBtn.title = `Kalan Borcun Tamamı: ${fmtCur(kalanBorc, item.paraBirimi || item.paraBirimleri?.[0] || defaultCurrency)}`;
      } else {
        kalanBtn.style.display = 'none';
      }
    } else {
      kalanBtn.style.display = 'none';
    }
  }

  if (isKrediTip && durum === 'ertelendi') {
    // Ertelendi + kredi/kmh taksiti
    if (tarihLbl) tarihLbl.textContent = 'Yeni Vade Tarihi';
    if (tutarWrap) tutarWrap.style.display = 'none';
    if (kalanBtn) kalanBtn.style.display = 'none';
    const mevcutVade = _odModal.tarih || '';
    if (tarihEl && !ov?.yeniTarih && mevcutVade) {
      // Henüz bir erteleme kaydı yoksa, mevcut vadeden 1 ay sonrasını öner
      const d = new Date(mevcutVade + 'T00:00:00');
      d.setMonth(d.getMonth() + 1);
      const oneri = localDateStr(d);
      setDateInputValue(tarihEl, oneri);
      tarihEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (cascadeWrap) cascadeWrap.style.display = 'flex';
    if (cascadeChk) cascadeChk.checked = !!ov?.sonrakileriOtele;
    if (hintEl) {
      hintEl.style.display = '';
      hintEl.textContent = mevcutVade
        ? `Mevcut vade: ${fmtDate(mevcutVade)}. Varsayılan olarak SADECE bu taksit yeni tarihe taşınır, diğerleri yerinde kalır. Sonrakileri de ötelemek isterseniz aşağıdaki kutuyu işaretleyin.`
        : 'Varsayılan olarak SADECE bu taksit yeni tarihe taşınır. Sonrakileri de ötelemek isterseniz aşağıdaki kutuyu işaretleyin.';
    }
    return;
  }

  if (isKrediTip && durum === 'gecikti') {
    const vade = _odModal.tarih || '';
    const todayStr = localDateStr(new Date());
    const oranWrap = document.getElementById('od-gecikme-oran-wrap');
    const oranEl = document.getElementById('od-gecikme-oran');
    if (oranWrap) oranWrap.style.display = '';
    if (oranEl) oranEl.value = (ov && ov.gecikmeFaizOrani != null) ? ov.gecikmeFaizOrani : '';
    if (vade && item) {
      const t = { tarih: vade, tutar: Number(_odModal.tutar) || 0 };
      const gun = Math.max(0, Math.round((new Date(todayStr + 'T00:00:00') - new Date(vade + 'T00:00:00')) / 86400000));
      const girilenOran = oranEl && oranEl.value !== '' ? oranEl.value : null;
      const faiz = _krediGecikmeFaizi(item, t, todayStr, girilenOran);
      if (hintEl) {
        hintEl.style.display = '';
        if (gun > 0 && faiz > 0.01) {
          hintEl.textContent = `Vade: ${fmtDate(vade)}. ${gun} gün gecikti. Uygulanan orana göre gecikme faizi (KKDF/BSMV dahil): ${fmt(faiz)}. Güncel toplam borç: ${fmt(t.tutar + faiz)}.`;
        } else if (gun > 0) {
          hintEl.textContent = `Vade: ${fmtDate(vade)}. ${gun} gün gecikti. Gecikme faizi hesaplanması için bir oran girin ya da Tanımlamalar > Gecikme Faiz Oranı'nı ayarlayın.`;
        } else {
          hintEl.textContent = 'Vade tarihi henüz geçmedi.';
        }
      }
    }
    return;
  }

  if (durum === 'kismi') {
    // Kısmi ödeme birikimli: bu alana girilen tutar, ÖNCEKİ kısmi ödemeye
    // eklenir (üzerine yazılmaz). Böylece aynı taksite birden fazla kez
    // kısmi ödeme girilebilir; kalan tutara ulaşınca otomatik "Ödendi" olur.
    const fullTutar = Number(_odModal.tutar) || 0;
    const mevcutOdenen = (ov && ov.durum === 'kismi') ? (Number(ov.tutar) || 0) : 0;
    const kalan = Math.max(0, fullTutar - mevcutOdenen);
    if (tutarLbl) tutarLbl.textContent = 'Bu Ödemede Yatırılan';
    if (tutarEl) tutarEl.value = '';
    if (hintEl) {
      hintEl.style.display = '';
      hintEl.textContent = mevcutOdenen > 0.001
        ? `Toplam tutar: ${fmt(fullTutar)}. Şimdiye kadar ödenen: ${fmt(mevcutOdenen)}. Kalan: ${fmt(kalan)}. Girdiğiniz tutar öncekine eklenir; kalan tutar tamamlanınca otomatik "Ödendi" olarak işaretlenir.`
        : `Toplam tutar: ${fmt(fullTutar)}. Girilen tutar borçtan düşülür; tamamı ödenince otomatik "Ödendi" olarak işaretlenir.`;
    }
    _kartOdemeHizliTransferGuncelle('od-modal');
    return;
  }

  if (durum === 'odendi' && tutarEl && !tutarEl.value) {
    setMoneyInput('od-pop-tutar', Number(_odModal.tutar) || 0);
  }
  if(_odModal?.tip) _kartOdemeHizliTransferGuncelle('od-modal');
}

export function odKalanBorcTamaminiDoldur() {
  if (_odModal.tip === 'kart') {
    const kalan = _odModal._kartKalan || 0;
    if (!(kalan > 0.01)) { showToast('Kalan borç bulunamadı', 'error'); return; }
    setMoneyInput('od-pop-tutar', kalan);
    document.getElementById('od-pop-tutar')?.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  const item = call('odGetItem', _odModal.tip, _odModal.id);
  if (!item) return;
  const ov = odGetDurum(item, _odModal.key);
  const full = Number(_odModal.tutar) || 0;
  const oncekiOdenen = (ov && ov.durum === 'kismi') ? (Number(ov.tutar) || 0) : 0;
  const kalanTaksit = Math.max(0, full - oncekiOdenen);
  if (!(kalanTaksit > 0.01)) { showToast('Bu taksit için kalan tutar bulunamadı', 'error'); return; }
  setMoneyInput('od-pop-tutar', kalanTaksit);
  const tutarEl = document.getElementById('od-pop-tutar');
  if (tutarEl) tutarEl.dispatchEvent(new Event('input', { bubbles: true }));
}

// [ES module] eskiden bu fonksiyonlar sadece export edilip başka dosyalardaki
// app-core.js: hook(name, after) mekanizması window[name] üzerinden
// wrap ediyordu; export binding'leri immutable olduğu için bu wrap export
// edilen fonksiyonu ASLA değiştirmiyordu (sessiz bug). Artık registry'ye
// kaydediliyorlar, hook() get/register ile doğru şekilde zincirleyebiliyor.
register('_odModalSecDurum', _odModalSecDurum);
register('_odModalKrediAlanlariAyarla', _odModalKrediAlanlariAyarla);

