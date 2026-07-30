import { inject } from '@core/container.js';
const _coreState = inject('core.state');
const _wrapRegistry = inject('core.wrapRegistry');
// core.dateUtils ve core.format container'da kayıtlı (Tur 4) —
// bu turda çevrildi (madde 5).
const _dateUtils = inject('core.dateUtils');
const isIsBgunu = (...a) => _dateUtils.isIsBgunu(...a);
const nextIsBgunu = (...a) => _dateUtils.nextIsBgunu(...a);
const _coreFormat = inject('core.format');
const fmt = (...a) => _coreFormat.fmt(...a);
const fmtMoneyCustom = (...a) => _coreFormat.fmtMoneyCustom(...a);
const localDateStr = (...a) => _coreFormat.localDateStr(...a);
const parseTutarStr = (...a) => _coreFormat.parseTutarStr(...a);
import { bindMoneyInputs, getMoneyInput } from '@components/money-input.js';
import { _krediTaksitPlanUygula } from '@pages/krediler/01-genel-yardimcilar.js';
import { getTatilSet } from '@pages/tanimlamalar/01-genel-yardimcilar.js';
import { resetIslemTekTaksit } from '@pages/islemler/02-islem-form-degisiklikleri.js';
// ============================================================
// js/domain/hesaplamalar.js — Ekstre/taksit/kredi/mevduat/kontrat
// hesaplama mantığı (kart ekstresi, kredi taksit planı, gecikme
// faizi, mevduat durumu, kontrat ödeme planı)
// ============================================================

// ── Oran tabloları (stopaj/kkdf/bsmv vb.) — tarihe göre kayıt bul ──
export function getOranByTarih(tablo, tarihStr) {
  if(!tablo || !tablo.length) return 0;
  const sorted = [...tablo].sort((a,b)=>a.tarih.localeCompare(b.tarih));
  let sonuc = sorted[0];
  for(const row of sorted) {
    if(row.tarih <= tarihStr) sonuc = row;
    else break;
  }
  return sonuc.oran;
}

// ── Ekstre/ödeme tarihi hesaplama (kart) ──────────────────────
export function calcOdemeTarihi(extreDt, odemeSure, odemeGunTip, tatilSet) {
  const sure = parseInt(odemeSure)||30;
  if(odemeGunTip === 'extre-ilerle' || odemeGunTip === 'extre-geri') {
    // Ekstre kayar, ödeme sabit: nominal ödeme = extre + sure, tatilse ekstreyi kaydır
    const dir = odemeGunTip === 'extre-ilerle' ? -1 : 1;
    let extre = new Date(extreDt);
    let odeme = new Date(extre); odeme.setDate(odeme.getDate() + sure);
    while(!isIsBgunu(odeme, tatilSet)) {
      extre.setDate(extre.getDate() + dir);
      odeme = new Date(extre); odeme.setDate(odeme.getDate() + sure);
    }
    return odeme;
  }
  if(odemeGunTip === 'extre-odeme-ilerle' || odemeGunTip === 'extre-odeme-geri') {
    // Ekstre kayar, ödeme da onunla kayar: tatilse ekstreyi kaydır, ödeme = yeni ekstre + sure
    const dir = odemeGunTip === 'extre-odeme-ilerle' ? -1 : 1;
    let extre = new Date(extreDt);
    let odeme = new Date(extre); odeme.setDate(odeme.getDate() + sure);
    while(!isIsBgunu(odeme, tatilSet)) {
      extre.setDate(extre.getDate() + dir);
      odeme = new Date(extre); odeme.setDate(odeme.getDate() + sure);
    }
    // Ödeme da iş günü kontrolü
    while(!isIsBgunu(odeme, tatilSet)) odeme.setDate(odeme.getDate() + dir);
    return odeme;
  }
  let dt = new Date(extreDt);
  dt.setDate(dt.getDate() + sure);
  if(odemeGunTip === 'ilerle') {
    while(!isIsBgunu(dt, tatilSet)) dt.setDate(dt.getDate()+1);
  } else {
    while(!isIsBgunu(dt, tatilSet)) dt.setDate(dt.getDate()-1);
  }
  return dt;
}

export function calcExtreTarihiOdemeModuyla(kart, year, month, tatilSet) {
  const sure = parseInt(kart.odemeSure)||30;
  const tip = kart.odemeGunTip;
  const extre = calcExtreTarihi(kart, year, month);
  if(!extre) return extre;
  const isExtreMod = ['extre-ilerle','extre-geri','extre-odeme-ilerle','extre-odeme-geri'].includes(tip);
  if(!isExtreMod) return extre;
  // Ekstreyi kaydır (hem sabit hem kayar modlar aynı ekstre kaydırma mantığını kullanır)
  const dir = (tip === 'extre-ilerle' || tip === 'extre-odeme-ilerle') ? -1 : 1;
  let e = new Date(extre);
  let odeme = new Date(e); odeme.setDate(odeme.getDate() + sure);
  while(!isIsBgunu(odeme, tatilSet)) {
    e.setDate(e.getDate() + dir);
    odeme = new Date(e); odeme.setDate(odeme.getDate() + sure);
  }
  return e;
}

export function getExtreDonemi(kart, islemTarih) {
  // returns {year, month} (0-indexed month) of the period this transaction belongs to
  const dt = new Date(islemTarih+'T00:00:00');
  // try current and previous months
  for(let offset = -2; offset <= 3; offset++) {
    let checkDate = new Date(dt);
    checkDate.setMonth(checkDate.getMonth() + offset);
    const y = checkDate.getFullYear();
    const m = checkDate.getMonth();
    const extre = calcExtreTarihi(kart, y, m);
    if(!extre) continue;
    const prevM = m === 0 ? 11 : m-1;
    const prevY = m === 0 ? y-1 : y;
    const prevExtre = calcExtreTarihi(kart, prevY, prevM);
    const prevDate = prevExtre ? new Date(prevExtre) : new Date(y, m, 1);
    prevDate.setDate(prevDate.getDate()+1);
    if(dt >= prevDate && dt <= extre) return {year:y, month:m};
  }
  return null;
}

// ── Kredi taksit planı & kalan borç hesaplama ────────────────
export function calcAylikTaksit(anaPara, aylikFaizOran, vade) {
  // aylikFaizOran: oran (0.045 = %4.5)
  if(aylikFaizOran === 0) return anaPara / vade;
  const r = aylikFaizOran;
  return anaPara * r * Math.pow(1+r, vade) / (Math.pow(1+r, vade) - 1);
}

export function _krediGecikmeFaizi(kr, t, todayStr, ovOrani) {
  const oran = (ovOrani != null && ovOrani !== '') ? Number(ovOrani) : getGecikmeFaizOrani(todayStr);
  if (!oran) return 0;
  const gun = Math.round((new Date(todayStr + 'T00:00:00') - new Date(t.tarih + 'T00:00:00')) / 86400000);
  if (gun <= 0) return 0;
  const gunlukOran = oran / 30 / 100;
  const hamFaiz = t.tutar * gunlukOran * gun;
  const vergi = (Number(kr.kkdf) || 0) + (Number(kr.bsmv) || 0);
  return hamFaiz * (1 + vergi / 100);
}

export function _krediTaksitKalan(kr, t, todayStr) {
  const ov = (kr.taksitOverrides || {})[t.no] || null;
  if (ov) {
    const dur = ov.durum;
    if (dur === 'odendi') return 0;
    if (dur === 'kismi') {
      const odenen = ov.tutar != null ? Math.abs(ov.tutar) : t.tutar;
      return Math.max(0, t.tutar - odenen);
    }
    if (dur === 'iptal' || dur === 'atlandi') return 0;
    if (dur === 'gecikti') return t.tutar + _krediGecikmeFaizi(kr, t, todayStr, ov.gecikmeFaizOrani);
    return t.tutar; // bekliyor / ertelendi → tam borç duruyor
  }
  return t.tarih < todayStr ? 0 : t.tutar; // override yok → tarihe göre varsay
}

export function _krediTaksitOdendiMi(kr, t, todayStr) {
  return _krediTaksitKalan(kr, t, todayStr) < 0.01;
}

export function getKrediKalanBorc(kredi) {
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = localDateStr(today);
  const taksitler = getKrediTaksitler(kredi);
  return taksitler.reduce((s,t)=>s+_krediTaksitKalan(kredi, t, todayStr), 0);
}

// getKrediTaksitler (KMH kredisi) ve getBireyselKrediTaksitler (bireysel kredi)
// birebir aynı taksit-planı üretme mantığını kullanır; tek fark başlangıç
// tarihinin hangi alanda tutulduğu (ilkEkstre vs ilkTaksit). Ortak mantık
// burada, ikisi de aynı sonucu üretecek şekilde tek yerde tutuluyor.
export function _krediTaksitPlaniUret(kredi, ilkTarihAlan) {
  if(kredi.manuelTaksitler && kredi.manuelTaksitler.length === kredi.vade) {
    return _krediTaksitPlanUygula(kredi.manuelTaksitler.map((t,i) => ({no:i+1, tarih:t.tarih, tutar:t.tutar})), kredi);
  }
  const tatilSet = kredi.odemeGunTip ? getTatilSet() : null;
  const taksitler = [];
  const ilk = new Date(kredi[ilkTarihAlan]+'T00:00:00');
  for(let i=0; i<kredi.vade; i++) {
    const dt = new Date(ilk);
    dt.setMonth(dt.getMonth()+i);
    if(kredi.odemeGunTip && tatilSet) {
      const shifted = nextIsBgunu(dt, tatilSet, kredi.odemeGunTip !== 'geri');
      taksitler.push({ no: i+1, tarih: localDateStr(shifted), tutar: kredi.aylikTaksit });
    } else {
      taksitler.push({ no: i+1, tarih: localDateStr(dt), tutar: kredi.aylikTaksit });
    }
  }
  return _krediTaksitPlanUygula(taksitler, kredi);
}

export function getKrediTaksitler(kredi) {
  return _krediTaksitPlaniUret(kredi, 'ilkEkstre');
}

export function getBireyselKrediTaksitler(kr) {
  return _krediTaksitPlaniUret(kr, 'ilkTaksit');
}

export function getBireyselKrediKalan(kr) {
  const todayStr = localDateStr(new Date());
  return getBireyselKrediTaksitler(kr).reduce((s,t)=>s+_krediTaksitKalan(kr, t, todayStr), 0);
}

// ── Mevduat durumu hesaplama ──────────────────────────────────
export function mevduatDurumHesapla(m, todayStr, todayDate) {
  const lk = _wrapRegistry.has('_lKey') ? _wrapRegistry.call('_lKey', 'mevduat', m.id, null) : null;
  const aktarimYapildi = _wrapRegistry.has('_lGet') ? _wrapRegistry.call('_lGet', lk) != null : false;
  const kapandi = !!m._kapatildi || aktarimYapildi;
  const aktifBool = !kapandi && m.bitis >= todayStr;
  const kalanGun = Math.ceil((new Date((m.bitis||'')+'T00:00:00') - todayDate) / 86400000);
  const yaklasiyor = aktifBool && kalanGun <= 3;
  const durum = !aktifBool ? 'bitti' : (yaklasiyor ? 'yaklasiyor' : 'aktif');
  return { aktarimYapildi, kapandi, aktifBool, kalanGun, yaklasiyor, durum };
}

// ── Kontrat (kira/maaş) ödeme planı hesaplama ────────────────
export function kontratAylariHesapla(k, yil) {
  // Kontrat başlangıç ve bitiş — tam tarih (YYYY-MM-DD) ile karşılaştır
  const baslangic    = k.baslangic || null;
  const bitis        = k.bitis     || null;
  const baslangicAy  = baslangic ? baslangic.slice(0,7) : null;
  const bitisAy      = bitis     ? bitis.slice(0,7)     : null;
  const aylar = [];
  for(let ay=0; ay<12; ay++) {
    const mon = String(ay+1).padStart(2,'0');
    const ayStr = yil+'-'+mon;
    // Ay bazlı hızlı eleme
    if(baslangicAy && ayStr < baslangicAy) continue;
    if(bitisAy     && ayStr > bitisAy)     continue;
    // Ödeme tarihi hesapla — kısa ay davranışı
    const gun = k.gun || 1;
    const lastDay = new Date(yil, ay+1, 0).getDate();
    let payGun, nextMon = false;
    if(gun <= lastDay) {
      payGun = gun;
    } else {
      const davranis = k.kisaAyDavranis || 'son-gun';
      if(davranis === 'son-gun') {
        payGun = lastDay;
      } else if(davranis === 'onceki') {
        const tatilSet = getTatilSet();
        let dt = new Date(yil, ay, lastDay);
        while(!isIsBgunu(dt, tatilSet)) dt.setDate(dt.getDate()-1);
        payGun = dt.getDate();
      } else if(davranis === 'sonraki') {
        nextMon = true;
        payGun = 1;
      } else {
        payGun = lastDay;
      }
    }
    const payTarih = nextMon
      ? (yil+'-'+String(ay+2).padStart(2,'0')+'-01').replace(/(\d{4})-13-/, s => (yil+1)+'-01-')
      : ayStr+'-'+String(payGun).padStart(2,'0');
    // Tam tarih kontrolü: başlangıç/bitiş ayında ödeme günü aralık içinde mi?
    if(baslangic && ayStr === baslangicAy && payTarih < baslangic) continue;
    if(bitis     && ayStr === bitisAy     && payTarih > bitis)     continue;
    aylar.push({ ay: ayStr, tarih: payTarih, tutar: k.tutar });
  }
  return aylar;
}

// ── İşlem taksit listesi / provizyon hesaplama ───────────────
export function getNakitAvansTaksitAnaParalari(islem) {
  const taksit = islem.taksit || 1;
  const anaPara = (islem.nakitAvansBilgi && islem.nakitAvansBilgi.anaPara) || 0;
  if(taksit <= 1) return [anaPara];
  const pay = parseFloat((anaPara / taksit).toFixed(2));
  const list = Array(taksit).fill(pay);
  // Son taksitte yuvarlama farkını düzelt (toplam tam anaparaya eşitlensin)
  const araToplam = pay * (taksit - 1);
  list[taksit-1] = parseFloat((anaPara - araToplam).toFixed(2));
  return list;
}

export function getIslemTaksitliste(islem) {
  const taksit = islem.taksit || 1;

  // İlk taksitin provizyon tarihinden gün farkını hesapla (varsa), diğer taksitlere de aynı farkı uygula
  const ilkTarihStr = (islem.manuelTaksitler && islem.manuelTaksitler[0]) ? islem.manuelTaksitler[0].tarih : islem.tarih;
  const ilkProvTarih = (islem.manuelTaksitler && islem.manuelTaksitler[0] && islem.manuelTaksitler[0].provizyonTarihi) || islem.provizyonTarihi || null;
  let provGunFarki = null;
  if(ilkProvTarih && ilkTarihStr) {
    const farkMs = new Date(ilkProvTarih+'T00:00:00') - new Date(ilkTarihStr+'T00:00:00');
    provGunFarki = Math.round(farkMs / 86400000);
  }
  const ekstreTarihHesapla = (tarihStr, idx) => {
    if(idx === 0) return ilkProvTarih || tarihStr;
    if(provGunFarki === null) return tarihStr;
    const dt = new Date(tarihStr+'T00:00:00');
    dt.setDate(dt.getDate() + provGunFarki);
    return localDateStr(dt);
  };

  if(islem.manuelTaksitler && islem.manuelTaksitler.length === taksit) {
    return islem.manuelTaksitler.map((t,i) => {
      const provTarih = i===0 ? ilkProvTarih : (t.provizyonTarihi || null);
      return {
        no: i+1,
        tarih: t.tarih,
        tutar: t.tutar,
        provizyonTarihi: provTarih,
        ekstreTarih: t.provizyonTarihi || (i===0 ? ilkProvTarih : null) || ekstreTarihHesapla(t.tarih, i)
      };
    });
  }
  const tutarlar = islem.taksitTutarlari || Array(taksit).fill(islem.aylik || (islem.tutar/taksit));
  const list = [];
  for(let t=0; t<taksit; t++) {
    const dt = new Date(islem.tarih+'T00:00:00');
    dt.setMonth(dt.getMonth()+t);
    const tarihStr = localDateStr(dt);
    const provTarih = t===0 ? ilkProvTarih : null;
    list.push({ no: t+1, tarih: tarihStr, tutar: tutarlar[t] ?? islem.aylik ?? 0, provizyonTarihi: provTarih, ekstreTarih: ekstreTarihHesapla(tarihStr, t) });
  }
  return list;
}

export function islemProvizyonEksikMi(islem) {
  const taksit = islem.taksit || 1;
  if(islem.tip === 'nakitAvans') return false; // nakit avansta provizyon kavramı yok
  if(taksit === 1) {
    return !islem.provizyonTarihi;
  }
  if(islem.manuelTaksitler && islem.manuelTaksitler.length) {
    return !islem.manuelTaksitler[0].provizyonTarihi;
  }
  return !islem.provizyonTarihi;
}

// Kredi (KMH ve bireysel) başvuru önizlemesi: ana para + ham faiz yüzdesi +
// vade + KKDF/BSMV yüzdeleri verilince aylık taksit, toplam borç/faiz ve
// (varsa) ilk taksit tarihinden son taksit tarihini hesaplar.
// - faizYuzde/kkdfYuzde/bsmvYuzde: yüzde cinsinden ham girdi (örn. 4.5, 20, 15)
// - ilkTarih: ISO tarih string'i (ilk taksit/ekstre tarihi) ya da null
// KKDF+BSMV, _krediGecikmeFaizi'deki ile aynı mantıkla efektif faiz oranını
// artıran bir vergi çarpanı olarak uygulanır: efektifOran = hamOran*(1+vergi/100).
export function hesaplaKrediOnizleme(anaPara, faizYuzde, vade, kkdfYuzde, bsmvYuzde, ilkTarih) {
  const hamOran = (Number(faizYuzde) || 0) / 100;
  const vergi = (Number(kkdfYuzde) || 0) + (Number(bsmvYuzde) || 0);
  const aylikFaiz = hamOran * (1 + vergi / 100);
  const v = Math.max(1, Number(vade) || 1);
  const aylikTaksit = calcAylikTaksit(Number(anaPara) || 0, aylikFaiz, v);
  const toplamBorc = aylikTaksit * v;
  const toplamFaiz = toplamBorc - (Number(anaPara) || 0);

  let taksitPlani = [];
  let sonTaksitISO = null;
  if(ilkTarih) {
    const ilk = new Date(ilkTarih + 'T00:00:00');
    for(let i = 0; i < v; i++) {
      const dt = new Date(ilk);
      dt.setMonth(dt.getMonth() + i);
      taksitPlani.push({ no: i + 1, tarih: localDateStr(dt), tutar: parseFloat(aylikTaksit.toFixed(2)) });
    }
    sonTaksitISO = taksitPlani.length ? taksitPlani[taksitPlani.length - 1].tarih : null;
  }

  return { aylikFaiz, aylikTaksit, toplamBorc, toplamFaiz, sonTaksitISO, taksitPlani };
}

// Nakit avans önizlemesi: aynı efektif-faiz mantığını (KKDF/BSMV vergi
// çarpanı) kullanır, tek fark taksit=1 durumunda taksitPlani üretmemesi
// (tek çekimde taksit tablosu gösterilmiyor, sadece toplam tutar).
export function hesaplaNakitAvansOnizleme(tutar, taksit, faizYuzde, kkdfYuzde, bsmvYuzde, ilkTarih) {
  const onizleme = hesaplaKrediOnizleme(tutar, faizYuzde, taksit, kkdfYuzde, bsmvYuzde, taksit > 1 ? ilkTarih : null);
  return {
    aylikTaksit: onizleme.aylikTaksit,
    toplamOdeme: onizleme.toplamBorc,
    toplamFaiz: onizleme.toplamFaiz,
    taksitPlani: onizleme.taksitPlani
  };
}
// herhangi biri, kartın zaten kesinleştirilmiş bir ekstre dönemine düşüyor mu?
// (bkz. js/ui/pages/ekstreler/01-ekstre-kesinlestirme.js:isEkstreKesinlesmis —
// aynı _coreState.DB.ekstreKayitlari sorgusu, domain katmanı UI katmanına bağımlı
// olmasın diye burada bağımsız olarak tekrarlanıyor.)
export function herhangiTaksitKesinlesmisMi(kart, taksitListesi) {
  if(!kart || !taksitListesi || !taksitListesi.length) return false;
  const ekstreKayitlari = _coreState.DB.ekstreKayitlari || [];
  return taksitListesi.some(tak => {
    const donem = getExtreDonemi(kart, tak.ekstreTarih || tak.tarih);
    if(!donem) return false;
    const key = `${donem.year}-${String(donem.month+1).padStart(2,'0')}`;
    return ekstreKayitlari.some(k => k.kartId === kart.id && k.donemKey === key && k.kesinlestirildi);
  });
}

// ── Maaş ödeme günü hesaplama ────────────────────────────────
export function getMaasOdemeGunu(maas, year, month) {
  const gun = maas.gun || 1;
  const sonGun = new Date(year, month+1, 0).getDate();
  if(gun <= sonGun) return { gun, sonraki: false };
  const davranis = maas.kisaAyDavranis || 'son-gun';
  if(davranis === 'son-gun') return { gun: sonGun, sonraki: false };
  if(davranis === 'onceki') {
    const tatilSet = getTatilSet();
    let dt = new Date(year, month, sonGun);
    while(!isIsBgunu(dt, tatilSet)) dt.setDate(dt.getDate()-1);
    return { gun: dt.getDate(), sonraki: false };
  }
  if(davranis === 'sonraki') return { gun: 1, sonraki: true }; // bir sonraki ay
  return { gun: sonGun, sonraki: false };
}

export function _krediMetrik(kr, tip, todayStr) {
  const taksitler = tip === 'kmh' ? getKrediTaksitler(kr) : getBireyselKrediTaksitler(kr);
  const kalan = taksitler.reduce((s,t) => s + _krediTaksitKalan(kr, t, todayStr), 0);
  const odenmisSayisi = taksitler.filter(t => _krediTaksitOdendiMi(kr, t, todayStr)).length;
  const bitti = kalan < 0.01;
  const ilerleme = kr.vade > 0 ? (odenmisSayisi / kr.vade) * 100 : 0;
  const sonTaksit = taksitler[taksitler.length - 1];
  const sonTarih = sonTaksit ? sonTaksit.tarih : '';
  // Sıradaki (henüz ödenmemiş) taksitin tarihi — "Sıradaki Ödeme" sıralaması için.
  const siradakiTaksit = taksitler.find(t => !_krediTaksitOdendiMi(kr, t, todayStr));
  const siradakiOdemeTarihi = siradakiTaksit ? siradakiTaksit.tarih : '';
  return { taksitler, kalan, odenmisSayisi, bitti, ilerleme, sonTarih, siradakiOdemeTarihi };
}


// ── Bugünkü tarih için oran döndürücü kısayollar ─────────────
export function getStopajOrani(tarihStr) { return getOranByTarih(_coreState.DB.stopajOranlari||[], tarihStr||localDateStr(new Date())); }

export function getKkdfOrani(tarihStr)   { return getOranByTarih(_coreState.DB.kkdfOranlari||[],   tarihStr||localDateStr(new Date())); }

export function getBsmvOrani(tarihStr)   { return getOranByTarih(_coreState.DB.bsmvOranlari||[],   tarihStr||localDateStr(new Date())); }

export function getKmhFaizOrani(tarihStr){ return getOranByTarih(_coreState.DB.kmhFaizOranlari||[], tarihStr||localDateStr(new Date())); }

export function getGecikmeFaizOrani(tarihStr){ return getOranByTarih(_coreState.DB.gecikmeFaizOranlari||[], tarihStr||localDateStr(new Date())); }

// _tutarAsiyorMu: "girilen tutar limiti/bakiyeyi aşıyor mu?" kontrolü.
// Bakiyeler genelde birçok işlemin toplanıp çıkarılmasıyla hesaplandığı için
// ondalıklı sayılarda küçük kayan nokta (floating point) hataları birikebiliyor
// (örn. ekranda "1.500,00" görünen bir bakiye aslında 1499.9999999999998 olabiliyor).
// Kullanıcı bakiyenin tamamını yazdığında (görsel olarak eşit) bu yüzden yanlışlıkla
// "aşıyor" uyarısı çıkabiliyordu. Yarım kuruşluk (0.005) bir tolerans payı bırakarak
// pratikte eşit sayılması gereken durumları "aşım" olarak saymıyoruz.
export function _tutarAsiyorMu(tutar, limit) {
  return (tutar - limit) > 0.005;
}

// hesapKullanilabilirBakiye: verilen hesapId'ye ait hesabın "kullanılabilir
// bakiyesini" (bakiye + KMH limiti) ve para birimini döndürür.
// kira.js, elden.js, abonelik.js içindeki *KullanilabilirBakiye
// fonksiyonlarının ortak son kısmıydı (md5 ile doğrulandı) — hesap bulma
// ve bakiye hesaplama mantığı birebir aynıydı. Hangi ön-koşullarda
// (ödeme yöntemi/tür filtreleri, hangi DOM elementi) çağrılacağına
// çağıran dosyalar kendi karar verir; bu fonksiyon sadece _coreState.DB.hesaplar
// üzerinden saf bir hesaplama yapar, DOM'a dokunmaz.
export function hesapKullanilabilirBakiye(hesapId) {
  if (!hesapId) return null;
  const hesap = (_coreState.DB.hesaplar||[]).find(h => h.id === hesapId);
  if (!hesap) return null;
  const pb = hesap.paraBirimi || 'TRY';
  return { tutar: (hesap.bakiye||0) + (hesap.kmhLimit||0), pb };
}

// ── Ekstre tarihi hesaplama (kart için belirli ay/yıl) ───────
export function calcExtreTarihi(kart, year, month) {
  // month 0-indexed
  // Özel ekstre tarihi var mı?
  const ay = `${year}-${String(month+1).padStart(2,'0')}`;
  const ozel = _coreState.DB.ozelExtreler && _coreState.DB.ozelExtreler.find(x=>x.kartId===kart.id&&x.ay===ay);
  if(ozel && ozel.tarih) return new Date(ozel.tarih+'T00:00:00');

  if(kart.extraTip === 'gun') {
    // Geçmiş kayıtlar: bu ay için doğru ekstre gününü bul
    let gun = parseInt(kart.extraGun)||25;
    if(kart.extraGunGecmis && kart.extraGunGecmis.length > 0) {
      const sorted = [...kart.extraGunGecmis]
        .filter(r=>!r.tip || r.tip==='gun')
        .sort((a,b)=>a.baslangic.localeCompare(b.baslangic));
      for(let idx=sorted.length-1; idx>=0; idx--) {
        if(ay >= sorted[idx].baslangic) { gun = sorted[idx].gun; break; }
      }
    }
    const lastDay = new Date(year, month+1, 0).getDate();
    return new Date(year, month, Math.min(gun, lastDay));
  } else if(kart.extraTip === 'hafta') {
    let hafta = parseInt(kart.extraHafta)||1;
    let haftaGun = parseInt(kart.extraHaftaGun)||5;
    // Geçmiş kayıtlardan hafta bazlı güncelleme var mı?
    if(kart.extraGunGecmis && kart.extraGunGecmis.length > 0) {
      const sorted = [...kart.extraGunGecmis].filter(r=>r.tip==='hafta').sort((a,b)=>a.baslangic.localeCompare(b.baslangic));
      for(let idx=sorted.length-1; idx>=0; idx--) {
        if(ay >= sorted[idx].baslangic) { hafta = sorted[idx].hafta; haftaGun = sorted[idx].haftaGun; break; }
      }
    }
    // Find nth weekday in month
    let count = 0;
    let lastFound = null;
    for(let d=1; d<=31; d++) {
      const dt = new Date(year, month, d);
      if(dt.getMonth() !== month) break;
      if(dt.getDay() === haftaGun) {
        count++;
        lastFound = new Date(dt);
        if(count === hafta) return dt;
      }
    }
    // N. hafta o ayda yoksa (örn. 5. Salı), o ayın son ilgili haftasını döndür
    return lastFound || new Date(year, month, 1);
  } else if(kart.extraTip === 'statik') {
    return kart.extraStatik ? new Date(kart.extraStatik+'T00:00:00') : null;
  }
  return new Date(year, month, 25);
}

// ── Taksit formu UI mantığı (İşlem ekleme formu) ─────────────
export function calcTaksit(preserveManuel=false) {
  const tutar = getMoneyInput('islem-tutar')||0;
  const taksit = Math.max(1, parseInt(document.getElementById('islem-taksit').value)||1);
  const aylik = taksit > 0 ? (tutar/taksit) : tutar;
  const ilkTarih = document.getElementById('islem-tarih').value;
  const container = document.getElementById('islem-taksit-alanlari');
  const todayStr = localDateStr(new Date());

  // Tek taksit: sade görünüm
  if(taksit === 1) {
    container.innerHTML = '';
    return;
  }

  // Mevcut satırları oku (preserve modda)
  let mevcutTaksitler = [];
  if(preserveManuel) {
    const inputs = container.querySelectorAll('[data-islem-taksit-field="tutar"]');
    const tarihInputs = container.querySelectorAll('[data-islem-taksit-field="tarih"]');
    for(let i=0; i<inputs.length; i++) {
      mevcutTaksitler.push({
        tarih: tarihInputs[i] ? tarihInputs[i].value : '',
        tutar: parseTutarStr(inputs[i].value)
      });
    }
  }

  const aylikStr = parseFloat(aylik.toFixed(2));
  const taksitData = [];
  for(let i=0; i<taksit; i++) {
    let tarih, t;
    if(preserveManuel && mevcutTaksitler[i]) {
      tarih = mevcutTaksitler[i].tarih || calcIslemTakTarih(ilkTarih, i);
      t = mevcutTaksitler[i].tutar;
    } else {
      tarih = calcIslemTakTarih(ilkTarih, i);
      t = i < taksit-1 ? aylikStr : parseFloat((tutar - aylikStr*(taksit-1)).toFixed(2));
    }
    taksitData.push({ tarih, tutar: t });
  }

  const toplam = taksitData.reduce((s,x) => s+x.tutar, 0);
  const rows = taksitData.map((t, i) => {
    const isPast = t.tarih < todayStr;
    const isModified = (Math.abs(t.tutar - aylikStr) > 0.01);
    const tutarDisplay = fmtMoneyCustom(t.tutar, 2, _coreState.FORMAT_CONFIG.ondalikAyrac||',', _coreState.FORMAT_CONFIG.binlikAyrac??'.');
    return `<div class="tp-row${isPast ? ' tp-past' : ''}">
      <div class="tp-no">${i+1}</div>
      <input type="date" class="tp-input" value="${t.tarih}" data-date-compact="1"
        data-islem-taksit-field="tarih" data-islem-taksit-idx="${i}" data-oc-handler="onIslemTaksitChange" data-oc-event="change">
      <input type="text" inputmode="decimal" id="islem-tak-tutar-${i}" class="tp-input tp-input-tutar money-input${isModified ? ' tp-modified' : ''}" value="${tutarDisplay}" data-decimals="2"
        data-islem-taksit-field="tutar" data-islem-taksit-idx="${i}" data-oc-handler="onIslemTaksitChange" data-oc-event="input" data-orig="${aylikStr}">
      <button class="tp-del tp-reset-tek-btn" title="Sıfırla" data-idx="${i}" data-tarih="${calcIslemTakTarih(ilkTarih, i)}" data-aylik="${aylikStr}">↺</button>
    </div>`;
  }).join('');

  const provTarihiVal = document.getElementById('islem-provizyon-tarihi').value;
  let provInfoHtml = '';
  if(provTarihiVal && ilkTarih) {
    const farkMs = new Date(provTarihiVal+'T00:00:00') - new Date(ilkTarih+'T00:00:00');
    const gunFarki = Math.round(farkMs / 86400000);
    provInfoHtml = `<div style="font-size:10.5px;color:var(--text3);padding:6px 2px 0">ℹ️ Provizyon farkı (${gunFarki} gün) tüm taksitlere otomatik uygulanır — her taksit kendi ayının ekstresine ${gunFarki} gün kaydırılarak yansır.</div>`;
  }

  container.innerHTML = `<div class="tp-wrap tp-wrap-4col">
    <div class="tp-header"><div></div><div>Tarih</div><div>Tutar</div><div></div></div>
    <div class="tp-rows-scroll">${rows}</div>
    <div class="tp-footer">
      <div class="tp-footer-info">
        <span class="tp-footer-total">Toplam: <span id="islem-tp-toplam">${fmt(toplam)}</span></span>
        <span class="tp-footer-meta">${taksit} taksit × ort. ${fmt(toplam/taksit)}</span>
      </div>
      <button class="tp-reset-all" id="islem-tp-reset-all-btn">↺ Sıfırla</button>
    </div>
    ${provInfoHtml}
  </div>`;
  // [ES module] onclick="resetIslemTekTaksit(...)" ve onclick="calcTaksit(false)" kaldırıldı - gerçek addEventListener bağlanıyor.
  container.querySelectorAll('.tp-reset-tek-btn').forEach(btn => {
    btn.addEventListener('click', () => resetIslemTekTaksit(btn, Number(btn.getAttribute('data-idx')), btn.getAttribute('data-tarih'), Number(btn.getAttribute('data-aylik'))));
  });
  const resetAllBtn = container.querySelector('#islem-tp-reset-all-btn');
  if (resetAllBtn) resetAllBtn.addEventListener('click', () => calcTaksit(false));
  bindMoneyInputs(container);
}

export function calcIslemTakTarih(ilkTarih, i) {
  if(!ilkTarih) return '';
  const dt = new Date(ilkTarih+'T00:00:00');
  dt.setMonth(dt.getMonth()+i);
  return localDateStr(dt);
}

// ============================================================
// [DI-MIGRATION] domain.hesaplamalar — container'a kayıt
// ============================================================
import { provide } from '@core/container.js';
provide('domain.hesaplamalar', {
  getOranByTarih, calcOdemeTarihi, calcExtreTarihiOdemeModuyla, getExtreDonemi,
  calcAylikTaksit, _krediGecikmeFaizi, _krediTaksitKalan, _krediTaksitOdendiMi,
  getKrediKalanBorc, _krediTaksitPlaniUret, getKrediTaksitler,
  getBireyselKrediTaksitler, getBireyselKrediKalan, mevduatDurumHesapla,
  kontratAylariHesapla, getNakitAvansTaksitAnaParalari, getIslemTaksitliste,
  islemProvizyonEksikMi, hesaplaKrediOnizleme, hesaplaNakitAvansOnizleme,
  herhangiTaksitKesinlesmisMi, getMaasOdemeGunu, _krediMetrik, getStopajOrani,
  getKkdfOrani, getBsmvOrani, getKmhFaizOrani, getGecikmeFaizOrani,
  _tutarAsiyorMu, hesapKullanilabilirBakiye, calcExtreTarihi, calcTaksit,
  calcIslemTakTarih,
});
