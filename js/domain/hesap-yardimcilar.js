import { inject } from '@core/container.js';
const _coreState = inject('core.state');
const _tanimYardimcilar = inject('domain.tanimYardimcilar');
// core.format container'da kayıtlı (Tur 4) — bu turda çevrildi (madde 5).
const _coreFormat = inject('core.format');
const fmtCur = (...a) => _coreFormat.fmtCur(...a);
// ============================================================
// js/domain/hesap-yardimcilar.js
// [FAZ 1 REFACTOR] js/ui/pages/hesaplar/01-genel-yardimcilar.js'den
// buraya taşındı — bu fonksiyonlar DOM'a dokunmuyor, saf veri/HTML-string
// üretimi yapıyor. hesapOtomatikGunlukKontrol (saveData() çağırdığı, yan
// etkili olduğu için) orijinal dosyada bırakıldı. Kod SATIR SATIR AYNI.
// ============================================================
export function hesapTuruRenk(kod) {
  const liste = _coreState.DB.hesapTurleri || [];
  const t = liste.find(x => x.kod === kod);
  return _tanimYardimcilar.tanimRenkAl(liste, t ? t.id : null, t && t.renk);
}

export function _hesapBankayaAitMi(hesap, bankaId) {
  return !!(hesap && bankaId && hesap.banka === bankaId);
}

export function _hesaplariIlgiliBankayaGoreSirala(hesaplar, bankaId, paraBirimi) {
  const arr = (hesaplar || []).map((h, idx) => ({ h, idx }));
  arr.sort((a, b) => {
    const ab = _hesapBankayaAitMi(a.h, bankaId) ? 0 : 1;
    const bb = _hesapBankayaAitMi(b.h, bankaId) ? 0 : 1;
    if (ab !== bb) return ab - bb;
    if (paraBirimi) {
      const ap = (a.h.paraBirimi || _coreState.defaultCurrency || 'TRY') === paraBirimi ? 0 : 1;
      const bp = (b.h.paraBirimi || _coreState.defaultCurrency || 'TRY') === paraBirimi ? 0 : 1;
      if (ap !== bp) return ap - bp;
    }
    return a.idx - b.idx;
  });
  return arr.map(x => x.h);
}

export function _hesapVarsayilanVeyaBankaHesabi(hesaplar, mevcutHesapId, bankaId, paraBirimi) {
  const liste = hesaplar || [];
  if (mevcutHesapId && liste.some(h => h.id === mevcutHesapId)) return mevcutHesapId;
  const ayniBankaAyniPb = liste.find(h => _hesapBankayaAitMi(h, bankaId) && (!paraBirimi || (h.paraBirimi || _coreState.defaultCurrency || 'TRY') === paraBirimi));
  if (ayniBankaAyniPb) return ayniBankaAyniPb.id;
  const ayniBanka = liste.find(h => _hesapBankayaAitMi(h, bankaId));
  if (ayniBanka) return ayniBanka.id;
  return liste[0] ? liste[0].id : '';
}

export function _hesapOptgroupHtml(hesaplar, bankaId) {
  const ilgili = (hesaplar || []).filter(h => _hesapBankayaAitMi(h, bankaId));
  const diger = (hesaplar || []).filter(h => !_hesapBankayaAitMi(h, bankaId));
  const opts = (list) => list.map(h => `<option value="${h.id}" data-bakiye="${h.bakiye||0}" data-pb="${h.paraBirimi||'TRY'}" data-kmh="${h.kmhLimit||0}">${hesapOptionMetin(h)}</option>`).join('');
  if (!ilgili.length) return opts(diger);
  return `<optgroup label="⭐ İlgili Banka Hesapları">${opts(ilgili)}</optgroup>` + (diger.length ? `<optgroup label="Diğer Hesaplar">${opts(diger)}</optgroup>` : '');
}

export function hesapOptionMetin(h) {
  if(!h) return '';
  const bankaObj = (_coreState.DB.bankalar||[]).find(b=>b.id===h.banka) || null;
  const bankaGoster = bankaObj ? _tanimYardimcilar.bankaOptionMetin(bankaObj) : '';
  const pb = h.paraBirimi || 'TRY';
  const bakiye = h.bakiye || 0;
  const kmhLimit = h.kmhLimit || 0;
  const bakiyeStr = typeof fmtCur === 'function' ? fmtCur(bakiye, pb) : `${bakiye} ${pb}`;
  let bakiyeGosterim = `Bakiye: ${bakiyeStr}`;
  if(kmhLimit > 0) {
    const kullanilabilirBakiye = bakiye + kmhLimit;
    const kullanilabilirStr = typeof fmtCur === 'function' ? fmtCur(kullanilabilirBakiye, pb) : `${kullanilabilirBakiye} ${pb}`;
    bakiyeGosterim = `Bakiye: ${bakiyeStr} · Kullanılabilir: ${kullanilabilirStr}`;
  }
  const ibanTemiz = (h.iban||'').replace(/\s/g,'');
  const ibanSon = ibanTemiz.length >= 4 ? '····'+ibanTemiz.slice(-4) : '';
  const parcalar = [bankaGoster, h.ad || 'Hesap', ibanSon, bakiyeGosterim, pb].filter(Boolean);
  return parcalar.join(' - ');
}

export function getAktifHesapOptionsByPb(pb) {
  const aktifler = (_coreState.DB.hesaplar||[]).filter(h=>h.durum==='aktif' && h.tur !== 'vadeli' && (!pb || (h.paraBirimi||'TRY') === pb));
  return aktifler.map(h => `<option value="${h.id}" data-pb="${h.paraBirimi||'TRY'}">${hesapOptionMetin(h)}</option>`).join('');
}

// ============================================================
// [DI-MIGRATION] domain.hesapYardimcilar — container'a kayıt
// ============================================================
import { provide } from '@core/container.js';
provide('domain.hesapYardimcilar', {
  hesapTuruRenk, _hesapBankayaAitMi, _hesaplariIlgiliBankayaGoreSirala,
  _hesapVarsayilanVeyaBankaHesabi, _hesapOptgroupHtml, hesapOptionMetin,
  getAktifHesapOptionsByPb,
});
