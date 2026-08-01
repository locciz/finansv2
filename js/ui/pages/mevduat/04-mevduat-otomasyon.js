import { inject, provide } from '@core/container.js';
const _format = inject('core.format');
const _coreState = inject('core.state');
const _odemeGenelYardimcilar = inject('ui.pages.odemeGenelYardimcilar');
const _wrapRegistry = inject('core.wrapRegistry');
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
  if(!_coreState.DB.mevduatlar) _coreState.DB.mevduatlar = [];
  const todayCheck = _format.localDateStr(new Date());
  let degisti = false;
  (_coreState.DB.mevduatlar||[]).forEach(m=>{
    if(m._kapatildi) return; // zaten otomatik yenilenmiş/aktarılmış eski kayıt
    if(m.bitis <= todayCheck && m.strateji && m.strateji !== '') {
      const lk = _wrapRegistry.call('_lKey', 'mevduat', m.id, null);
      if(_wrapRegistry.call('_lGet', lk) == null) {
        if(_wrapRegistry.call('mevduatOtoStratejiUygula', m.id)) degisti = true;
      }
    }
  });
  return degisti;
}

export function mevduatYaklasanOdemedeGoster(m, todayStr, todayDate) {
  if(!m || !m.bitis) return false;

  const od = m.odDurum || null;
  if(od && od.durum === 'iptal') return false;

  const lk = _wrapRegistry.call('_lKey', 'mevduat', m.id, null);
  const aktarimYapildi = _wrapRegistry.call('_lGet', lk) != null || _odemeGenelYardimcilar.odOdendiMi(od);

  // _kapatildi hem manuel kapatma hem de vadesize aktarım için kullanılıyor.
  // Bu yüzden tek başına gizleme sebebi saymıyoruz; aktarım/ödendi yoksa
  // manuel kapanmış kabul edip yaklaşan ödemelerden çıkarıyoruz.
  if(m._kapatildi && !aktarimYapildi) return false;

  return true;
}

// ── DI-MIGRATION dual-mode kaydı ──────────────────────────────
provide('ui.pages.mevduatOtomasyon', {
  mevduatOtomatikVadeKontrol,
  mevduatYaklasanOdemedeGoster,
});

