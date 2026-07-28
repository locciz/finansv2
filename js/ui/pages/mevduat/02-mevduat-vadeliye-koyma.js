import { isIsBgunu } from '@core/date-utils.js';
import { fmtDate, localDateStr, uid } from '@core/format.js';
import { DB } from '@core/state.js';
import { getStopajOrani } from '@domain/hesaplamalar.js';
import { showToast } from '@components/modal-genel.js';
import { setMoneyInput } from '@components/money-input.js';
import { calcMevduatObj } from '@pages/abonelik.js';
import { _mevGunlukMod, set_mevGunlukMod } from '@pages/mevduat/00-state.js';
import { calcMevduat } from '@pages/mevduat/01-mevduat-form-wizard.js';
import { _fillMevVadesizSel, onMevHesapChange, onMevOtoHesapToggle, onMevStratejiChange } from '@pages/mevduat/06-mevduat-hesap-secim-formu.js';
import { getTatilSet } from '@pages/tanimlamalar/01-genel-yardimcilar.js';
import { openModal } from '@components/modal-genel.js';
// ============================================================
// js/ui/pages/mevduat/02-mevduat-vadeliye-koyma.js
// Vadesiz hesaptan vadeliye para aktarma akışı (günlük otomatik dahil)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/mevduat.js
// (43 export, 1589 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function vadeliyeKoy(hesapId) {
  const hesap = (DB.hesaplar||[]).find(h=>h.id===hesapId);
  if(!hesap) { showToast('Hesap bulunamadı', 'error'); return; }
  if(!(hesap.bakiye > 0)) { showToast('Hesap bakiyesi 0 veya negatif, vadeliye konulamaz', 'error'); return; }

  openModal('modal-mevduat'); // populateMevduatModal() ile formu sıfırlar

  // "Yeni Vadeli Hesap Kaydı Oluştur" modunu aç → kaynak hesap seçilebilsin
  const otoToggle = document.getElementById('mev-oto-hesap');
  if(otoToggle) { otoToggle.checked = true; onMevOtoHesapToggle(); }

  // Kaynak hesabı bu hesaba ayarla → banka & para birimi otomatik algılanır
  const hesapSelV = document.getElementById('mev-hesap-id');
  if(hesapSelV) { hesapSelV.value = hesapId; onMevHesapChange(); }
  // Tutar = hesabın tüm bakiyesi
  setMoneyInput('mev-tutar', hesap.bakiye);

  // Faiz oranı: bu bankadan açılmış en güncel mevduat kaydının oranını öner
  if(hesap.banka) {
    const gecmis = (DB.mevduatlar||[])
      .filter(m=>m.banka===hesap.banka && m.faizOran)
      .sort((a,b)=>(b.baslangic||'').localeCompare(a.baslangic||''));
    if(gecmis.length) document.getElementById('mev-faiz').value = gecmis[0].faizOran;
  }

  // Vade sonu stratejisi: ana para + faiz vade dolunca yine bu vadesiz hesaba dönsün
  const stratejiSel = document.getElementById('mev-strateji');
  if(stratejiSel) { stratejiSel.value = 'tumu_vadesiz'; onMevStratejiChange(); }
  _fillMevVadesizSel(hesapId, hesap.banka||'');

  calcMevduat();

  // Tek eksik alan olan "Vade (Gün)" kutusuna odaklan
  setTimeout(()=>{ const v = document.getElementById('mev-vade'); if(v) v.focus(); }, 60);
}

export function gunlukVadeliyeKoy(hesapId) {
  const hesap = (DB.hesaplar||[]).find(h=>h.id===hesapId);
  if(!hesap) { showToast('Hesap bulunamadı', 'error'); return; }
  if(!(hesap.bakiye > 0)) { showToast('Hesap bakiyesi 0 veya negatif, günlük vadeliye konulamaz', 'error'); return; }

  set_mevGunlukMod(true);
  openModal('modal-mevduat'); // populateMevduatModal() ile formu sıfırlar (ve _mevGunlukMod'u false yapar)
  set_mevGunlukMod(true); // sıfırlamadan sonra yeniden işaretle

  document.getElementById('mev-modal-title').textContent = 'Günlük Vadeli Mevduat Ekle';

  // "Yeni Vadeli Hesap Kaydı Oluştur" modunu aç → kaynak hesap seçilebilsin
  const otoToggle = document.getElementById('mev-oto-hesap');
  if(otoToggle) { otoToggle.checked = true; onMevOtoHesapToggle(); }

  // Kaynak hesabı bu hesaba ayarla → banka & para birimi otomatik algılanır
  const hesapSelG = document.getElementById('mev-hesap-id');
  if(hesapSelG) { hesapSelG.value = hesapId; onMevHesapChange(); }

  // Tutar = hesabın tüm bakiyesi
  setMoneyInput('mev-tutar', hesap.bakiye);

  // ── Faiz & stopaj: önce bu bankadan en güncel GÜNLÜK vadeli kaydına bak,
  //    yoksa bu bankadan herhangi bir mevduat, o da yoksa genel en güncel
  const todayStr = localDateStr(new Date());
  const tumMev = (DB.mevduatlar||[]).filter(m=>m.faizOran);
  const bankaMev   = tumMev.filter(m=>m.banka===hesap.banka);
  const gunlukMev  = bankaMev.filter(m=>m.gunluk);
  const kaynak =
    (gunlukMev.sort((a,b)=>(b.baslangic||'').localeCompare(a.baslangic||''))[0]) ||
    (bankaMev .sort((a,b)=>(b.baslangic||'').localeCompare(a.baslangic||''))[0]) ||
    (tumMev   .sort((a,b)=>(b.baslangic||'').localeCompare(a.baslangic||''))[0]);
  if(kaynak) {
    document.getElementById('mev-faiz').value = kaynak.faizOran;
    if(kaynak.stopaj != null) document.getElementById('mev-stopaj').value = kaynak.stopaj;
  } else {
    // Stopaj oranını güncel tablodan doldur (faiz boş kalır)
    document.getElementById('mev-stopaj').value = getStopajOrani(todayStr);
  }

  // ── Vade: bugünden sonraki ilk iş gününe kaç takvim günü varsa
  const tatilSet = getTatilSet();
  const bugun = new Date();
  // Bugünden bir gün sonrasından başlayarak ilk iş gününü bul
  let kontrol = new Date(bugun);
  kontrol.setDate(kontrol.getDate() + 1);
  while(!isIsBgunu(kontrol, tatilSet)) {
    kontrol.setDate(kontrol.getDate() + 1);
  }
  const vadeSonuMs = kontrol.getTime() - new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate()).getTime();
  const vadeGun = Math.round(vadeSonuMs / (1000*60*60*24));
  const vadeInp = document.getElementById('mev-vade');
  if(vadeInp) vadeInp.value = vadeGun;

  // Vade sonu stratejisi: ana para + faiz vade dolunca yine bu vadesiz hesaba dönsün
  const stratejiSel = document.getElementById('mev-strateji');
  if(stratejiSel) { stratejiSel.value = 'tumu_vadesiz'; onMevStratejiChange(); }
  _fillMevVadesizSel(hesapId, hesap.banka||'');

  calcMevduat();
}

export function _gunlukVadeliAcOtomatik(hesap) {
  if(!hesap || !(hesap.bakiye > 0)) return false;
  const tutar = hesap.bakiye;
  const bankaObj = (DB.bankalar||[]).find(b=>b.id===hesap.banka);
  const bankaKisa = bankaObj ? bankaObj.kisa : '';
  const paraBirimi = hesap.paraBirimi || 'TRY';
  const bas = localDateStr(new Date());

  // Faiz/stopaj: hesaba özel tanımlıysa onu kullan, yoksa aynı bankadan en
  // güncel günlük vadeli kaydına, o da yoksa güncel stopaj tablosuna bak.
  let faizOran = hesap.otoGunlukFaizOran != null ? parseFloat(hesap.otoGunlukFaizOran) : null;
  let stopaj   = hesap.otoGunlukStopaj   != null ? parseFloat(hesap.otoGunlukStopaj)   : null;
  if(faizOran == null || stopaj == null) {
    const bankaMev = (DB.mevduatlar||[]).filter(m=>m.faizOran && m.banka===hesap.banka)
      .sort((a,b)=>(b.baslangic||'').localeCompare(a.baslangic||''));
    const kaynak = bankaMev[0];
    if(faizOran == null) faizOran = kaynak ? kaynak.faizOran : 0;
    if(stopaj == null)   stopaj   = kaynak && kaynak.stopaj != null ? kaynak.stopaj : getStopajOrani(bas);
  }

  // Vade: bugünden sonraki ilk iş gününe kaç takvim günü varsa (hafta sonu/tatil aşımı)
  const tatilSet = getTatilSet();
  const baslangicD = new Date(bas+'T00:00:00');
  let kontrol = new Date(baslangicD);
  kontrol.setDate(kontrol.getDate() + 1);
  while(!isIsBgunu(kontrol, tatilSet)) kontrol.setDate(kontrol.getDate() + 1);
  const vade = Math.round((kontrol.getTime() - baslangicD.getTime()) / (1000*60*60*24));

  const yeniHesap = {
    id: uid(), banka: hesap.banka,
    ad: `${bankaKisa} Günlük Vadeli ${paraBirimi}`.trim() || 'Günlük Vadeli Hesap',
    tur: 'vadeli', paraBirimi, bakiye: tutar,
    iban: '', bankaKodu: '', subeKodu: '', hesapNo: '', subeAd: '',
    durum: 'aktif', not: `Otomatik günlük vadeli — ${fmtDate(bas)}`,
  };
  if(!DB.hesaplar) DB.hesaplar = [];
  DB.hesaplar.push(yeniHesap);

  const yeniMev = {
    id: uid(), banka: hesap.banka, paraBirimi,
    hesapId: yeniHesap.id, kaynakHesapId: hesap.id, vadesizHesapId: hesap.id,
    strateji: 'tumu_vadesiz', baslangic: bas, tutar, faizOran, stopaj, vade, valor: 0,
    gunluk: true,
  };
  const startD = new Date(bas+'T00:00:00');
  startD.setDate(startD.getDate() + vade);
  yeniMev.bitis = localDateStr(startD);
  if(typeof calcMevduatObj === 'function') {
    const c = calcMevduatObj(yeniMev);
    yeniMev.faiz = c.faiz; yeniMev.nihai = c.nihai;
  } else {
    const brutFaiz = tutar * (faizOran/100) * (vade/365);
    const netFaiz = brutFaiz - brutFaiz*(stopaj/100);
    yeniMev.faiz = parseFloat(netFaiz.toFixed(2));
    yeniMev.nihai = parseFloat((tutar+netFaiz).toFixed(2));
  }
  if(!DB.mevduatlar) DB.mevduatlar = [];
  DB.mevduatlar.push(yeniMev);

  // Bakiye tamamı vadeliye aktı — kaynak hesap arka planda sıfırlanır
  hesap.bakiye = 0;
  return true;
}

