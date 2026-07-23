import { saveData } from '../core/app-core-base.js';
import { isIsBgunu } from '../core/date-utils.js';
import { fmtCur, fmtDate, localDateStr, uid } from '../core/format.js';
import { DB } from '../core/state.js';
import { showToast } from '../ui/components/modal-genel.js';
import { calcMevduatObj } from '../ui/pages/abonelik.js';
import { mevduatTumunuVadesizeAktar, mevduatYenile, mevduatYenileAnaPara } from '../ui/pages/mevduat/03-mevduat-yenileme-ve-kapama.js';
import { renderMevduat } from '../ui/pages/mevduat/05-mevduat-liste-render.js';
import { odOdendiMi } from '../ui/pages/odeme/01-genel-yardimcilar.js';
import { getBanka, getTatilSet } from '../ui/pages/tanimlamalar/01-genel-yardimcilar.js';
import { _lGet__hesap_entegrasyon_motoru as _lGet, _lKey__hesap_entegrasyon_motoru as _lKey, _lSet__hesap_entegrasyon_motoru as _lSet } from './hesap-entegrasyon-motoru.js';
import { renderHesaplar } from '../ui/pages/hesaplar/04-hesap-liste-render.js';
import { register } from '../core/wrap-registry.js';
// ============================================================
// js/domain/mevduat-oto-yenileme.js
// İş mantığı: vadesi dolan mevduatın otomatik yenilenmesi stratejisi. "mobile-nav-tema.js" içine gömülüydü, buraya taşındı.
// Kod SATIR SATIR aynı kaldı; sadece dosya sınırı/gruplama değişti.
// ============================================================
function mevduatOtoStratejiUygula(mevId) {
  const mev = (DB.mevduatlar||[]).find(x=>x.id===mevId);
  if(!mev) return false;
  const strateji = mev.strateji;
  if(!strateji) return false;

  if(strateji === 'tumu_vadesiz' && mev.vadesizHesapId) {
    mevduatTumunuVadesizeAktar(mevId, true);
    return true;
  } else if(strateji === 'yenile_ana_faiz_vadesiz' && mev.vadesizHesapId) {
    if(typeof mevduatYenileAnaParaOtomatik === 'function') return mevduatYenileAnaParaOtomatik(mevId);
    mevduatYenileAnaPara(mevId); // yedek: otomatik yardımcı yüklenmediyse modalı aç
    return true;
  } else if(strateji === 'yenile_tum') {
    if(typeof mevduatYenileTumOtomatik === 'function') return mevduatYenileTumOtomatik(mevId);
    mevduatYenile(mevId); // yedek: otomatik yardımcı yüklenmediyse modalı aç
    return true;
  }
  return false;
}
export { mevduatOtoStratejiUygula as mevduatOtoStratejiUygula__mevduat_oto_yenileme };
// [ES module] eskiden bu fonksiyonun window.mevduatOtoStratejiUygula
// ataması mobile-nav-tema.js'de yapılıyordu; artık taban burada register
// edilir. abonelik.js (DOMContentLoaded'da) bunun üzerine kendi wrap'ini
// (yenile_tum tam otomatik mantığı) register eder; 04-mevduat-otomasyon.js
// gibi çağıranlar call('mevduatOtoStratejiUygula', ...) kullanır.
register('mevduatOtoStratejiUygula', mevduatOtoStratejiUygula);

// Strateji 1'in TAM OTOMATİK versiyonu (mevduatYenileAnaParaOtomatik'in eşleniği):
// ana para + net faiz birlikte → aynı banka/faiz/vade bilgileriyle yeni vadeli
// hesapta yeni mevduat olarak açılır. Kullanıcıdan yeni IBAN/vade istenmez —
// vade dolduğunda hiçbir manuel işlem gerekmeden zincirleme devam eder, böylece
// hesap "boşta" (vadesiz/günlük faizsiz) kalmaz. Eski mevduat kaydı geçmiş kayıt
// olarak listede kalır (Model A — bkz. mevduatYenileAnaParaOtomatik).

export function mevduatYenileTumOtomatik(mevId) {
  const m = (DB.mevduatlar||[]).find(x=>x.id===mevId);
  if(!m) return false;

  const lk = _lKey('mevduat', mevId, null);
  if(_lGet(lk) != null) return false; // zaten işlenmiş

  const yeniTutar = m.nihai != null ? m.nihai : calcMevduatObj(m).nihai;

  // Eski vadeli hesabı kapat + bakiyesini sıfırla (ana para + faiz yeni hesaba taşınacak)
  const eskiHesap = m.hesapId ? (DB.hesaplar||[]).find(h=>h.id===m.hesapId) : null;
  if(eskiHesap && eskiHesap.durum !== 'kapali') {
    eskiHesap.durum = 'kapali';
    eskiHesap.bakiye = 0;
  }

  // Ana para + faizi, aynı faiz/vade/banka bilgileriyle yeni bir vadeli hesapta yeni mevduat olarak aç
  const yeniHesap = {
    id: uid(),
    banka: m.banka,
    ad: (eskiHesap ? eskiHesap.ad.replace(/\s*\(yenilendi\)$/,'') : (getBanka(m.banka)||'') + ' Vadeli') + ' (yenilendi)',
    tur: 'vadeli',
    paraBirimi: m.paraBirimi || 'TRY',
    bakiye: yeniTutar,
    iban: '', bankaKodu: '', subeKodu: '', hesapNo: '', subeAd: '',
    durum: 'aktif',
    not: `Otomatik yenileme (ana para + faiz) — ${fmtDate(m.bitis)}`,
  };
  if(!DB.hesaplar) DB.hesaplar = [];
  DB.hesaplar.push(yeniHesap);

  const yeniMev = {
    id: uid(),
    banka: m.banka,
    paraBirimi: m.paraBirimi || 'TRY',
    hesapId: yeniHesap.id,
    kaynakHesapId: null,
    vadesizHesapId: m.vadesizHesapId || null,
    strateji: m.strateji,
    baslangic: m.bitis,
    tutar: yeniTutar, faizOran: m.faizOran, stopaj: m.stopaj, vade: m.vade, valor: m.valor||0,
    gunluk: m.gunluk,
  };
  // Günlük vadeli mevduatlarda vade süresi sabit kopyalanamaz (bkz. mevduatYenileAnaParaOtomatik'teki
  // aynı mantık) — her yenilemede, yeni başlangıç tarihinden sonraki ilk iş gününe göre yeniden hesaplanır.
  if(yeniMev.gunluk) {
    const tatilSet = getTatilSet();
    const baslangicD = new Date(yeniMev.baslangic+'T00:00:00');
    let kontrol = new Date(baslangicD);
    kontrol.setDate(kontrol.getDate() + 1);
    while(!isIsBgunu(kontrol, tatilSet)) {
      kontrol.setDate(kontrol.getDate() + 1);
    }
    yeniMev.vade = Math.round((kontrol.getTime() - baslangicD.getTime()) / (1000*60*60*24));
  }
  const startD = new Date(yeniMev.baslangic+'T00:00:00');
  startD.setDate(startD.getDate() + (yeniMev.vade||30) + (yeniMev.valor||0));
  yeniMev.bitis = localDateStr(startD);
  if(typeof calcMevduatObj === 'function') {
    const calc = calcMevduatObj(yeniMev);
    yeniMev.faiz = calc.faiz; yeniMev.nihai = calc.nihai;
  } else {
    const brutFaiz = yeniMev.tutar * ((yeniMev.faizOran||0)/100) * ((yeniMev.vade||30)/365);
    const stopajTutar = brutFaiz * ((yeniMev.stopaj||0)/100);
    yeniMev.faiz = brutFaiz - stopajTutar;
    yeniMev.nihai = yeniMev.tutar + yeniMev.faiz;
  }
  if(!DB.mevduatlar) DB.mevduatlar = [];
  DB.mevduatlar.push(yeniMev);

  _lSet(lk, yeniTutar);
  // Eski mevduat kaydı artık kapanmış/geçmiş — "Yaklaşan Ödemeler" ve dashboard'daki
  // "Vade Doldu" aksiyon kartında bir daha "Bekliyor" olarak görünmesin diye işaretle.
  if(!odOdendiMi(m.odDurum)) {
    m.odDurum = { durum:'odendi', tarih: localDateStr(new Date()), tutar: yeniTutar, not: 'Otomatik: ana para + faiz ile yeni mevduat açıldı' };
  }
  m._kapatildi = true;

  saveData();
  if(typeof renderMevduat==='function') renderMevduat();
  if(typeof renderHesaplar==='function') renderHesaplar();
  showToast(`🔄 ${getBanka(m.banka)||'?'} mevduatı otomatik yenilendi — ${fmtCur(yeniTutar,m.paraBirimi)} (ana para + faiz) yeniden vadeye yatırıldı`, 5000);
  return true;
}

// Strateji 2'nin TAM OTOMATİK versiyonu: ana para → aynı faiz/vade bilgileriyle
// yeni vadeli hesapta yeni mevduat, faiz → vadesiz hesaba. Eski mevduat kaydı
// geçmiş kayıt olarak listede kalır, sadece "Aktarıldı" işaretlenir (Model A).
// Not: mevduatYenileAnaPara (modal açan versiyon) kullanıcı manuel tetiklemek
// isterse hâlâ dashboard kartındaki butondan erişilebilir durumda kalır.

export function mevduatYenileAnaParaOtomatik(mevId) {
  const m = (DB.mevduatlar||[]).find(x=>x.id===mevId);
  if(!m || !m.vadesizHesapId) return false;
  const vadesizHesap = (DB.hesaplar||[]).find(h=>h.id===m.vadesizHesapId);
  if(!vadesizHesap) return false;

  const lk = _lKey('mevduat', mevId, null);
  if(_lGet(lk) != null) return false; // zaten işlenmiş

  // 1) Faiz net tutarını vadesiz hesaba aktar
  const faizTutar = m.faiz || 0;
  if(faizTutar > 0.001) {
    vadesizHesap.bakiye = (vadesizHesap.bakiye||0) + faizTutar;
  }
  _lSet(lk, faizTutar);

  // 2) Eski vadeli hesabı kapat + bakiyesini sıfırla (ana para yeni hesaba taşınacak)
  const eskiHesap = m.hesapId ? (DB.hesaplar||[]).find(h=>h.id===m.hesapId) : null;
  if(eskiHesap && eskiHesap.durum !== 'kapali') {
    eskiHesap.durum = 'kapali';
    eskiHesap.bakiye = 0;
  }

  // 3) Ana parayı, aynı faiz/vade/banka bilgileriyle yeni bir vadeli hesapta yeni mevduat olarak aç
  const yeniHesap = {
    id: uid(),
    banka: m.banka,
    ad: (eskiHesap ? eskiHesap.ad.replace(/\s*\(yenilendi\)$/,'') : (getBanka(m.banka)||'') + ' Vadeli') + ' (yenilendi)',
    tur: 'vadeli',
    paraBirimi: m.paraBirimi || 'TRY',
    bakiye: m.tutar,
    iban: '', bankaKodu: '', subeKodu: '', hesapNo: '', subeAd: '',
    durum: 'aktif',
    not: `Otomatik yenileme — ${fmtDate(m.bitis)}`,
  };
  if(!DB.hesaplar) DB.hesaplar = [];
  DB.hesaplar.push(yeniHesap);

  const yeniMev = {
    id: uid(),
    banka: m.banka,
    paraBirimi: m.paraBirimi || 'TRY',
    hesapId: yeniHesap.id,
    kaynakHesapId: null,
    vadesizHesapId: m.vadesizHesapId,
    strateji: m.strateji,
    baslangic: m.bitis,
    tutar: m.tutar, faizOran: m.faizOran, stopaj: m.stopaj, vade: m.vade, valor: m.valor||0,
    gunluk: m.gunluk,
  };
  // Günlük vadeli mevduatlarda vade süresi sabit kopyalanamaz: hafta sonu/tatil
  // denk gelen döngülerde vade sayısı kayar (ör. Cuma açılışta vade=3 hesaplanır,
  // bu sabit 3 her yenilemede kullanılırsa Pazartesi'den itibaren hafta içi
  // günlerle senkron bozulur). Bunun yerine her yenilemede, yeni başlangıç
  // tarihinden sonraki ilk iş gününe göre vade yeniden hesaplanır.
  if(yeniMev.gunluk) {
    const tatilSet = getTatilSet();
    const baslangicD = new Date(yeniMev.baslangic+'T00:00:00');
    let kontrol = new Date(baslangicD);
    kontrol.setDate(kontrol.getDate() + 1);
    while(!isIsBgunu(kontrol, tatilSet)) {
      kontrol.setDate(kontrol.getDate() + 1);
    }
    yeniMev.vade = Math.round((kontrol.getTime() - baslangicD.getTime()) / (1000*60*60*24));
  }
  const startD = new Date(yeniMev.baslangic+'T00:00:00');
  startD.setDate(startD.getDate() + (yeniMev.vade||30) + (yeniMev.valor||0));
  yeniMev.bitis = localDateStr(startD);
  if(typeof calcMevduatObj === 'function') {
    const calc = calcMevduatObj(yeniMev);
    yeniMev.faiz = calc.faiz; yeniMev.nihai = calc.nihai;
  } else {
    const brutFaiz = yeniMev.tutar * ((yeniMev.faizOran||0)/100) * ((yeniMev.vade||30)/365);
    const stopajTutar = brutFaiz * ((yeniMev.stopaj||0)/100);
    yeniMev.faiz = brutFaiz - stopajTutar;
    yeniMev.nihai = yeniMev.tutar + yeniMev.faiz;
  }
  if(!DB.mevduatlar) DB.mevduatlar = [];
  DB.mevduatlar.push(yeniMev);

  // Eski mevduat kaydı artık kapanmış/geçmiş — "Yaklaşan Ödemeler" ve dashboard'daki
  // "Vade Doldu" aksiyon kartında bir daha "Bekliyor" olarak görünmesin diye işaretle.
  if(!odOdendiMi(m.odDurum)) {
    m.odDurum = { durum:'odendi', tarih: localDateStr(new Date()), tutar: faizTutar, not: 'Otomatik: ana para yenilendi, faiz vadesize aktarıldı' };
  }
  m._kapatildi = true;

  saveData();
  if(typeof renderMevduat==='function') renderMevduat();
  if(typeof renderHesaplar==='function') renderHesaplar();
  showToast(`🔄 ${getBanka(m.banka)||'?'} mevduatı otomatik yenilendi — ana para ${fmtCur(m.tutar,m.paraBirimi)} yeniden vadeye yatırıldı, faiz ${fmtCur(faizTutar,m.paraBirimi)} vadesize aktarıldı`, 5000);
  return true;
}


// Bakiye işlem geçmişi paneli (hesaplar sayfasına eklenebilir)

