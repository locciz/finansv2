import { localDateStr } from '../../../core/format.js';
import { DB } from '../../../core/state.js';
import { odOdendiMi } from '../odeme/01-genel-yardimcilar.js';
import { call } from '../../../core/wrap-registry.js';
// ============================================================
// js/ui/pages/mevduat/04-mevduat-otomasyon.js
// Otomatik vade kontrolü ve yaklaşan ödeme tespiti
//
// Bu dosya, eskiden tek parça olan js/ui/pages/mevduat.js
// (43 export, 1589 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function mevduatOtomatikVadeKontrol() {
  if(!DB.mevduatlar) DB.mevduatlar = [];
  const todayCheck = localDateStr(new Date());
  let degisti = false;
  (DB.mevduatlar||[]).forEach(m=>{
    if(m._kapatildi) return; // zaten otomatik yenilenmiş/aktarılmış eski kayıt
    if(m.bitis <= todayCheck && m.strateji && m.strateji !== '') {
      const lk = call('_lKey', 'mevduat', m.id, null);
      if(call('_lGet', lk) == null) {
        if(call('mevduatOtoStratejiUygula', m.id)) degisti = true;
      }
    }
  });
  return degisti;
}

export function mevduatYaklasanOdemedeGoster(m, todayStr, todayDate) {
  if(!m || !m.bitis) return false;

  const od = m.odDurum || null;
  if(od && od.durum === 'iptal') return false;

  const lk = call('_lKey', 'mevduat', m.id, null);
  const aktarimYapildi = call('_lGet', lk) != null || odOdendiMi(od);

  // _kapatildi hem manuel kapatma hem de vadesize aktarım için kullanılıyor.
  // Bu yüzden tek başına gizleme sebebi saymıyoruz; aktarım/ödendi yoksa
  // manuel kapanmış kabul edip yaklaşan ödemelerden çıkarıyoruz.
  if(m._kapatildi && !aktarimYapildi) return false;

  return true;
}

