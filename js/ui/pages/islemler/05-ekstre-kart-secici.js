import { localDateStr } from '../../../core/format.js';
import { DB } from '../../../core/state.js';
import { getExtreDonemi, getIslemTaksitliste } from '../../../domain/hesaplamalar.js';
import { renderExtreler } from '../ekstreler/02-ekstre-render.js';
import { getKartCurrency, getKartStatementAmount, kartDonemHesapla } from '../kartlar/01-kart-data.js';
import { getTatilSet } from '../tanimlamalar/01-genel-yardimcilar.js';
// ============================================================
// js/ui/pages/islemler/05-ekstre-kart-secici.js
// Ekstre görünümünde temsili kart seçici
//
// Bu dosya, eskiden tek parça olan js/ui/pages/islemler.js
// (49 export, 1087 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function _extreKartTemsiliDonem(kart) {
  const tatilSet = getTatilSet();
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = localDateStr(today);
  const islemler = DB.islemler.filter(i=>i.kart===kart.id);
  if(!islemler.length) return null;

  let minDate = new Date(today);
  islemler.forEach(i=>{ const dt = new Date(i.tarih+'T00:00:00'); if(dt < minDate) minDate = dt; });
  const startY = minDate.getFullYear(), startM = minDate.getMonth();
  const endDate = new Date(today); endDate.setMonth(endDate.getMonth()+1);
  const endY = endDate.getFullYear(), endM = endDate.getMonth();

  const periodMap = new Map();
  function ensurePeriod(y, m) {
    const key = `${y}-${String(m+1).padStart(2,'0')}`;
    if(periodMap.has(key)) return key;
    const d = kartDonemHesapla(kart, y, m, tatilSet, key);
    if(!d) return null;
    periodMap.set(key, { key, year:y, month:m, extre: d.extre, odeme: d.odeme, odemeVarsayilan: d.odemeVarsayilan, ertelendi: d.ertelendi, totalByPb:{} });
    return key;
  }
  for(let y=startY, m=startM; y<endY||(y===endY&&m<=endM); ) { ensurePeriod(y,m); m++; if(m>11){m=0;y++;} }

  islemler.forEach(islem=>{
    const islemPb = getKartCurrency(kart.id, islem.paraBirimi);
    getIslemTaksitliste(islem).forEach(tak=>{
      const pd = getExtreDonemi(kart, tak.ekstreTarih);
      if(!pd) return;
      const key = ensurePeriod(pd.year, pd.month);
      if(!key) return;
      const p = periodMap.get(key);
      p.totalByPb[islemPb] = (p.totalByPb[islemPb]||0) + getKartStatementAmount(kart.id, tak.tutar, islem.paraBirimi, tak.ekstreTarih || tak.tarih || islem.tarih);
    });
  });

  const periods = Array.from(periodMap.values()).filter(p=>Object.keys(p.totalByPb).length>0).sort((a,b)=>a.key.localeCompare(b.key));
  if(!periods.length) return null;

  function kalanBorc(p) {
    let odenen = 0, toplam = 0;
    Object.keys(p.totalByPb).forEach(pb=>{
      toplam += p.totalByPb[pb];
      odenen += (DB.kartOdemeleri||[]).filter(o=>o.kartId===kart.id && o.paraBirimi===pb && o.donemKey===p.key).reduce((s,o)=>s+o.tutar,0);
    });
    return Math.max(0, toplam - odenen);
  }

  // Ekstresi zaten kesilmiş (kesim tarihi bugüne kadar gelmiş) dönemler arasında en yeni
  // ÖDENMEMİŞ olanı ara. Not: burada ödeme (son ödeme) tarihine değil, ekstrenin kesilip
  // kesilmediğine bakılır — çünkü son ödeme tarihi henüz gelmemiş olsa bile ekstre kesilmişse
  // ve borç ödenmemişse bu dönem hâlâ "ödenmemiş ekstre" olarak gösterilmelidir.
  const gecmisVeGuncel = periods.filter(p=>p.extre <= todayStr).sort((a,b)=>b.key.localeCompare(a.key));
  let secili = gecmisVeGuncel.find(p=>kalanBorc(p) > 0.005);
  let odenmemis = !!secili;

  if(!secili) {
    // Ödenmemiş dönem yok → içinde bulunulan ayın dönemini göster (yoksa en yakın geleceği)
    const guncelKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
    secili = periods.find(p=>p.key===guncelKey)
      || periods.filter(p=>p.key>=guncelKey).sort((a,b)=>a.key.localeCompare(b.key))[0]
      || periods[periods.length-1];
  }
  if(!secili) return null;

  const pbList = Object.keys(secili.totalByPb);
  const anaPb = pbList[0] || getKartCurrency(kart.id);
  const toplam = secili.totalByPb[anaPb] || 0;
  const kalan = kalanBorc(secili);

  return {
    period: secili,
    odenmemis,
    kalan,
    toplam,
    pb: anaPb,
    coklu: pbList.length > 1,
    isPast: secili.odeme < todayStr,
    isThisMonth: secili.key === `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`
  };
}

export function extreKartSec(kartId) {
  const kf = document.getElementById('extre-kart-filter');
  if(!kf) return;
  kf.value = kartId;
  renderExtreler();
  const content = document.getElementById('extre-content');
  if(content) content.scrollIntoView({behavior:'smooth', block:'start'});
}

export function extreKartGeriDon() {
  const kf = document.getElementById('extre-kart-filter');
  if(!kf) return;
  kf.value = '';
  renderExtreler();
}

