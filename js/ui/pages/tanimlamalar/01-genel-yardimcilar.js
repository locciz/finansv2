import { DB } from '../../../core/state.js';
import { BANKA_LOGOLAR, BANK_ICON_MAP } from '../../../domain/banka-verisi.js';
import { pbRenkAl } from '../../../domain/doviz.js';
import { HESAP_TUR_BADGE_LIST, HESAP_TUR_DOT_RENK_LIST, TANIM_RENK_PALET, _RENK_ADLARI } from './00-state.js';
// ============================================================
// js/ui/pages/tanimlamalar/01-genel-yardimcilar.js
// Genel yardımcılar — tatil seti, renk/ikon/etiket lookup fonksiyonları
//
// Bu dosya, eskiden tek parça olan js/ui/pages/tanimlamalar.js
// (81 export, 1440+ satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function getTatilSet() {
  const s = new Set();
  DB.tatiller.forEach(t => s.add(t.tarih));
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
  const liste = DB.urunTipler || [];
  const t = liste.find(x => x.id === id);
  return tanimRenkAl(liste, id, t && t.renk);
}

export function paraBirimiRenk(kod) {
  const r = pbRenkAl(kod);
  return r.text;
}

export function bankaLogoByKod(kod) {
  const k = (kod||'').padStart(4,'0');
  const found = BANKA_LOGOLAR.find(l => l.kod === k);
  return found ? found.svg : null;
}

export function bankaIkonObj(b) {
  if(!b) return { emoji:'🏛️', renk:'var(--accent)', bg:'rgba(99,102,241,.1)', svg:null };
  const kod = (b.ibanKod||'').padStart(4,'0');
  const preset = BANK_ICON_MAP[kod];
  const svg = (b.logo || bankaLogoByKod(kod)) || null;
  if(b.ikon) return { emoji: b.ikon, renk: preset?.renk || 'var(--accent)', bg: preset?.bg || 'rgba(99,102,241,.1)', svg };
  return { ...(preset || { emoji:'🏛️', renk:'var(--accent)', bg:'rgba(99,102,241,.1)' }), svg };
}

export function bankaOptionMetin(b) {
  if(!b) return '';
  const ikon = bankaIkonObj(b);
  return `${ikon.emoji} ${b.kisa}`;
}

// [KALDIRILDI] bankaKisaById(id) — hiçbir yerden çağrılmıyordu (ölü kod
// taraması, 2026-07).

export function getHesapTurLabel(kod) {
  const t = (DB.hesapTurleri||[]).find(x=>x.kod===kod);
  return t ? t.ad : (kod||'—');
}

export function getHesapTurBadge(kod) {
  const idx = (DB.hesapTurleri||[]).findIndex(x=>x.kod===kod);
  return HESAP_TUR_BADGE_LIST[idx % HESAP_TUR_BADGE_LIST.length] || '';
}

export function getHesapTurDotIkon(kod) {
  const idx = (DB.hesapTurleri||[]).findIndex(x=>x.kod===kod);
  const renk = HESAP_TUR_DOT_RENK_LIST[idx % HESAP_TUR_DOT_RENK_LIST.length] || '#94a3b8';
  return `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${renk};margin-right:1px;flex-shrink:0"></span>`;
}

export function getBanka(id) {
  const b = DB.bankalar.find(b=>b.id===id);
  return b ? b.kisa : (id || '-');
}

// liste: kayıtların bulunduğu dizi (ör. DB.urunTipler), id: aranacak kaydın id'si,
// ozelRenk: kayıtta kullanıcı tarafından özel seçilmiş renk varsa (renk alanı).

// Ürün Tipleri (kart ürün tipi: Kredi Kartı, Ticari Kart, KMH vb.)

// Kredi Tipleri — hem DB.krediTipleri içindeki kullanıcı tanımlı kayıtlar hem de
// eski/varsayılan sabit türler (ihtiyac/konut/tasit/diger) aynı tutarlı sırayla renklendirilir.

// Kart Altyapıları (Visa/Mastercard/Troy vb.)

// Hesap Türleri için de aynı paletten renk lazım olan yerlerde (mevcut
// getHesapTurBadge/getHesapTurDotIkon sınıf-tabanlı sistemi hâlâ kullanılıyor,
// ama hex renk gereken yerlerde bu fonksiyon aynı sıralamayla tutarlı sonuç verir).

// Para birimleri için zaten tutarlı bir renk fonksiyonu var: pbRenkAl(kod) → {bg,border,text}
// (bilinen kodlar için sabit, özel kodlar için hash tabanlı renk üretir). Aşağıdaki
// yardımcı, tek bir hex ihtiyacı olan yerlerde (badge arka planı vb.) kullanılabilir.

// Tanımlamalar için tutarlı görünümlü, otomatik renkli badge — arka plan/kenarlık
// aynı hex'ten türetilir (kart rozetleriyle aynı görsel dil).

export function _tanimBadgeHtml(text, hex, mono) {
  return `<span class="badge" style="background:${hex}22;color:${hex};border:1px solid ${hex}55${mono?';font-family:var(--mono)':''}">${text}</span>`;
}

// "Renk" tablo kolonu için hücre HTML'i. Manuel renk seçilmişse düz renk noktası + ad/hex
// gösterir; seçilmemişse (otomatik paletten geliyorsa) soluk "— Otomatik —" yazısı gösterir.

export function _renkKolonHtml(manualHex) {
  if (!manualHex) return `<span style="color:var(--text3);font-size:11px">— Otomatik —</span>`;
  const ad = _RENK_ADLARI[manualHex.toLowerCase()] || manualHex.toUpperCase();
  return `<span style="display:inline-flex;align-items:center;gap:6px">`
       + `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${manualHex};border:1px solid rgba(255,255,255,.15);flex-shrink:0"></span>`
       + `<span style="font-size:12px">${ad}</span></span>`;
}

