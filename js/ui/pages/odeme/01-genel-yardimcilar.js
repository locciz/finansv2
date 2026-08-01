import { inject, provide } from '@core/container.js';
const _format = inject('core.format');
const _coreState = inject('core.state');
const _hesaplarGenelYardimcilar = inject('ui.pages.hesaplarGenelYardimcilar');
const _wrapRegistry = inject('core.wrapRegistry');
// ============================================================
// js/ui/pages/odeme/01-genel-yardimcilar.js
// Genel yardımcılar — durum hesaplama, badge/toggle render, hesap seçim listesi
//
// Bu dosya, eskiden tek parça olan js/ui/pages/odeme.js
// (52 export, 2097 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function _odIlgiliBankaId(tip, item) {
  if (!item) return null;
  if (tip === 'kart') return item.banka || null;
  if (tip === 'kredi') return item.banka || null;
  if (tip === 'kmh') {
    const kaynak = (_coreState.DB.kartlar || []).find(k => k.id === item.kmhId) || (_coreState.DB.hesaplar || []).find(h => h.id === item.kmhId);
    return kaynak ? (kaynak.banka || null) : null;
  }
  return item.banka || null;
}

export function _odHesapSecimListesiHazirla(tip, item, hesaplar, mevcutHesapId, paraBirimi) {
  const bankaId = _odIlgiliBankaId(tip, item);
  const sirali = _hesaplarGenelYardimcilar._hesaplariIlgiliBankayaGoreSirala(hesaplar || [], bankaId, paraBirimi);
  const secili = _hesaplarGenelYardimcilar._hesapVarsayilanVeyaBankaHesabi(sirali, mevcutHesapId || '', bankaId, paraBirimi);
  return { hesaplar: sirali, hesapId: secili, bankaId };
}

export function odDurumFiltreNormalize(d) {
  return d === 'atlandi' ? 'iptal' : d;
}

export function odEfektifDurum(ov, tarih) {
  if(ov && ov.durum) return odDurumFiltreNormalize(ov.durum);
  const todayStr = _format.localDateStr(new Date());
  return (tarih && tarih.length === 10 && tarih < todayStr) ? 'gecikti' : 'bekliyor';
}

export function odGetDurum(item, key) {
  // kira ve maas odemeOverrides[ay] kullanır; diğerleri taksitOverrides[key] veya odDurum
  if(key !== undefined) {
    // key YYYY-MM formatındaysa (string, 7 karakter) → kira/maas odemeOverrides
    if(typeof key === 'string' && /^\d{4}-\d{2}$/.test(key)) {
      return (item.odemeOverrides||{})[key] || null;
    }
    return (item.taksitOverrides||{})[key] || null;
  }
  return item.odDurum || null;
}

export function odPlanlananTutar(ov, varsayilanTutar) {
  if (typeof odIptalMi === 'function' && odIptalMi(ov)) return 0;
  if (ov && ov.durum === 'kismi') return Math.abs(ov.tutar !== undefined ? ov.tutar : varsayilanTutar || 0);
  return Math.abs(varsayilanTutar || 0);
}

export function odFiilenGerceklesenTutar(ov, varsayilanTutar) {
  const dur = ov?.durum;
  if(dur === 'odendi' || dur === 'kismi') {
    return ov.tutar !== undefined ? Math.abs(ov.tutar) : Math.abs(varsayilanTutar || 0);
  }
  return 0; // iptal/atlandi/bekliyor/gecikti/ertelendi/tanımsız → henüz gerçekleşmedi
}

export function odIptalMi(ov) {
  const dur = ov?.durum;
  return dur === 'iptal' || dur === 'atlandi';
}

export function odOdendiMi(ov) {
  const dur = ov?.durum;
  return dur === 'odendi' || dur === 'kismi';
}

export function odBeklemedeMi(ov) {
  if(!ov || !ov.durum) return true;
  return ov.durum === 'bekliyor' || ov.durum === 'gecikti' || ov.durum === 'ertelendi';
}

export function odKiraMaasOverride(item, ayKey) {
  return (item?.odemeOverrides || {})[ayKey] || null;
}

export function odKartDonemOverride(kart, donemKey) {
  return odGetDurum(kart, donemKey);
}

export function odSetDurum(item, key, data) {
  if(key !== undefined) {
    // key YYYY-MM formatındaysa (string, 7 karakter) → kira/maas odemeOverrides
    if(typeof key === 'string' && /^\d{4}-\d{2}$/.test(key)) {
      if(!item.odemeOverrides) item.odemeOverrides = {};
      if(data === null) delete item.odemeOverrides[key];
      else item.odemeOverrides[key] = data;
    } else {
      if(!item.taksitOverrides) item.taksitOverrides = {};
      if(data === null) delete item.taksitOverrides[key];
      else item.taksitOverrides[key] = data;
    }
  } else {
    if(data === null) delete item.odDurum;
    else item.odDurum = data;
  }
}

export function odBadgeHtml(durum, tarih, tutar) {
  const todayStr = _format.localDateStr(new Date());
  const d = durum || (tarih && tarih.length === 10 && tarih < todayStr ? 'gecikti' : 'bekliyor');
  const map = {
    odendi:   ['od-odendi',   '✓ Ödendi'],
    bekliyor: ['od-bekliyor', '◉ Bekliyor'],
    gecikti:  ['od-gecikti',  '⚠ Gecikti'],
    ertelendi:['od-ertelendi','↷ Ertelendi'],
    kismi:    ['od-kismi',    '⊟ Kısmi'],
    iptal:    ['od-iptal',    '⊘ İptal'],
    atlandi:  ['od-iptal',    '⊘ Atlandı'],
    taksit:   ['od-kismi',    '⊟ Taksitli'],
  };
  let [cls, label] = map[d] || map.bekliyor;
  if (d === 'gecikti' && tarih && tarih.length === 10 && tarih < todayStr) {
    const gun = Math.round((new Date(todayStr + 'T00:00:00') - new Date(tarih + 'T00:00:00')) / 86400000);
    if (gun > 0) label = `⚠ Gecikti (${gun}g)`;
  }
  return `<span class="od-badge ${cls}">${label}</span>`;
}

export function odToggleBtn(tip, id, key, tarih, tutar, extraLabel) {
  const item = _wrapRegistry.call('odGetItem', tip, id);
  if(!item) return '';
  const ov = odGetDurum(item, key);
  const badge = odBadgeHtml(ov?.durum, tarih, tutar);
  // Parametreleri data attribute'a koy — onclick içinde tırnak/Türkçe sorun çıkarmasın
  const enc = encodeURIComponent(JSON.stringify({tip, id, key, tarih: tarih||'', tutar: tutar||0, extraLabel: extraLabel||''}));
  return `<span class="od-btn" data-od="${enc}" style="cursor:pointer">${badge}</span>`;
}

export function odKartToggleBtn(kartId, pb, donemKey, toplamBorc, kalanBorc, odemeTarihi, durum) {
  const badge = odBadgeHtml(durum, odemeTarihi, toplamBorc);
  const enc = encodeURIComponent(JSON.stringify({tip:'kart', id:kartId, pb, donemKey, toplamBorc, kalanBorc, odemeTarihi}));
  return `<span class="od-btn" data-od="${enc}" style="cursor:pointer">${badge}</span>`;
}

// ── DI-MIGRATION dual-mode kaydı ──────────────────────────────
provide('ui.pages.odemeGenelYardimcilar', {
  _odIlgiliBankaId,
  _odHesapSecimListesiHazirla,
  odDurumFiltreNormalize,
  odEfektifDurum,
  odGetDurum,
  odPlanlananTutar,
  odFiilenGerceklesenTutar,
  odIptalMi,
  odOdendiMi,
  odBeklemedeMi,
  odKiraMaasOverride,
  odKartDonemOverride,
  odSetDurum,
  odBadgeHtml,
  odToggleBtn,
  odKartToggleBtn,
});

