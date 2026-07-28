import { inject } from '@core/container.js';
const _coreState = inject('core.state');
const _bankaVerisi = inject('domain.bankaVerisi');
const _doviz = inject('domain.doviz');
import { HESAP_TUR_BADGE_LIST, HESAP_TUR_DOT_RENK_LIST, TANIM_RENK_PALET, _RENK_ADLARI } from '@pages/tanimlamalar/00-state.js';
// ============================================================
// js/domain/tanim-yardimcilar.js
// [FAZ 1 REFACTOR] Bu dosya js/ui/pages/tanimlamalar/01-genel-yardimcilar.js'den
// buraya taşındı, çünkü içerdiği fonksiyonlar DOM'a dokunmuyor ve yalnızca
// başka sayfalar tarafından okunan saf veri/lookup yardımcıları. Orijinal
// dosyada geriye dönük uyumluluk için re-export bırakıldı — mevcut importlar
// kırılmadı. Kod SATIR SATIR AYNI kaldı, sadece dosya konumu değişti.
// ============================================================
export function getTatilSet() {
  const s = new Set();
  _coreState.DB.tatiller.forEach(t => s.add(t.tarih));
  return s;
}

export function tanimRenkAl(liste, id, ozelRenk) {
  if (ozelRenk) return ozelRenk;
  const arr = liste || [];
  let idx = arr.findIndex(x => x.id === id);
  if (idx < 0) idx = 0;
  return TANIM_RENK_PALET[idx % TANIM_RENK_PALET.length];
}

export function urunTipiRenk(id) {
  const liste = _coreState.DB.urunTipler || [];
  const t = liste.find(x => x.id === id);
  return tanimRenkAl(liste, id, t && t.renk);
}

export function paraBirimiRenk(kod) {
  const r = _doviz.pbRenkAl(kod);
  return r.text;
}

export function bankaLogoByKod(kod) {
  const k = (kod||'').padStart(4,'0');
  const found = _bankaVerisi.BANKA_LOGOLAR.find(l => l.kod === k);
  return found ? found.svg : null;
}

export function bankaIkonObj(b) {
  if(!b) return { emoji:'🏛️', renk:'var(--accent)', bg:'rgba(99,102,241,.1)', svg:null };
  const kod = (b.ibanKod||'').padStart(4,'0');
  const preset = _bankaVerisi.BANK_ICON_MAP[kod];
  const svg = (b.logo || bankaLogoByKod(kod)) || null;
  if(b.ikon) return { emoji: b.ikon, renk: preset?.renk || 'var(--accent)', bg: preset?.bg || 'rgba(99,102,241,.1)', svg };
  return { ...(preset || { emoji:'🏛️', renk:'var(--accent)', bg:'rgba(99,102,241,.1)' }), svg };
}

export function bankaOptionMetin(b) {
  if(!b) return '';
  const ikon = bankaIkonObj(b);
  return `${ikon.emoji} ${b.kisa}`;
}

export function getHesapTurLabel(kod) {
  const t = (_coreState.DB.hesapTurleri||[]).find(x=>x.kod===kod);
  return t ? t.ad : (kod||'—');
}

export function getHesapTurBadge(kod) {
  const idx = (_coreState.DB.hesapTurleri||[]).findIndex(x=>x.kod===kod);
  return HESAP_TUR_BADGE_LIST[idx % HESAP_TUR_BADGE_LIST.length] || '';
}

export function getHesapTurDotIkon(kod) {
  const idx = (_coreState.DB.hesapTurleri||[]).findIndex(x=>x.kod===kod);
  const renk = HESAP_TUR_DOT_RENK_LIST[idx % HESAP_TUR_DOT_RENK_LIST.length] || '#94a3b8';
  return `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${renk};margin-right:1px;flex-shrink:0"></span>`;
}

export function getBanka(id) {
  const b = _coreState.DB.bankalar.find(b=>b.id===id);
  return b ? b.kisa : (id || '-');
}

export function _tanimBadgeHtml(text, hex, mono) {
  return `<span class="badge" style="background:${hex}22;color:${hex};border:1px solid ${hex}55${mono?';font-family:var(--mono)':''}">${text}</span>`;
}

export function _renkKolonHtml(manualHex) {
  if (!manualHex) return `<span style="color:var(--text3);font-size:11px">— Otomatik —</span>`;
  const ad = _RENK_ADLARI[manualHex.toLowerCase()] || manualHex.toUpperCase();
  return `<span style="display:inline-flex;align-items:center;gap:6px">`
       + `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${manualHex};border:1px solid rgba(255,255,255,.15);flex-shrink:0"></span>`
       + `<span style="font-size:12px">${ad}</span></span>`;
}

// ============================================================
// [DI-MIGRATION] domain.tanimYardimcilar — container'a kayıt
// ============================================================
import { provide } from '@core/container.js';
provide('domain.tanimYardimcilar', {
  getTatilSet, tanimRenkAl, urunTipiRenk, paraBirimiRenk, bankaLogoByKod,
  bankaIkonObj, bankaOptionMetin, getHesapTurLabel, getHesapTurBadge,
  getHesapTurDotIkon, getBanka, _tanimBadgeHtml, _renkKolonHtml,
});
