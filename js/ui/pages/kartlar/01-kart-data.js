import { saveData, updateSidebarKartNav } from '../../../core/app-core-base.js';
import { localDateStr } from '../../../core/format.js';
import { DB, defaultCurrency } from '../../../core/state.js';
import { paraBirimiCevirGuvenli } from '../../../domain/doviz.js';
import { calcExtreTarihiOdemeModuyla, calcOdemeTarihi, getExtreDonemi, getIslemTaksitliste, getKrediKalanBorc, getNakitAvansTaksitAnaParalari } from '../../../domain/hesaplamalar.js';
import { showConfirm } from '../../components/modal-genel.js';
import { setDateInputValue, setMoneyInput } from '../../components/money-input.js';
import { tblSiralamaAyarla } from '../../components/tablo-filtre-sirala.js';
import { KART_RENK_PALET } from './00-state.js';
import { kartStepGoto, populateKartModal, renderKartLimitGecmis } from './06-kart-form.js';
import { getOrtakGrupKullanim } from './07-ortak-limit-grubu.js';
import { editKartId, setEditKartId } from './09-kart-altyapi.js';
import { renderKartlar } from './10-kart-liste.js';
import { odKartDonemOverride } from '../odeme/01-genel-yardimcilar.js';
import { tanimRenkAl } from '../tanimlamalar/01-genel-yardimcilar.js';
import { openModal } from '../../components/modal-genel.js';
// ============================================================
// js/ui/pages/kartlar/01-kart-data.js
// Kart veri erişimi — getter/hesaplama fonksiyonları, temel CRUD
//
// Bu dosya, eskiden tek parça olan js/ui/pages/kartlar.js (145
// export, 3600+ satır) dosyasının, fonksiyon isim/işlev
// kümelerine göre bölünmüş bir parçasıdır. Kod SATIR SATIR
// AYNI kaldı — sadece dosya sınırı ve gruplama değişti.
// ============================================================
export function kartAltyapiRenk(id) {
  const liste = DB.kartAltyapilari || [];
  const t = liste.find(x => x.id === id);
  return tanimRenkAl(liste, id, t && t.renk);
}

export function kartLimitGecmisSonSil() {
  if(!editKartId) return;
  const idx = (DB.kartlar||[]).findIndex(k=>k.id===editKartId);
  if(idx<0) return;
  const k = DB.kartlar[idx];
  const gecmis = (k.limitGecmisi||[]).slice().sort((a,b)=>b.tarih.localeCompare(a.tarih));
  if(gecmis.length <= 1) {
    showConfirm('Tek kayıt kaldı. Limit geçmişi tamamen silinsin mi?', ()=>{
      k.limitGecmisi = [];
      k.limit = 0;
      k.limitTarih = '';
      saveData();
      renderKartLimitGecmis([]);
      setMoneyInput('kart-limit', '');
      setDateInputValue('kart-limit-tarih', localDateStr(new Date()));
      renderKartlar();
    });
    return;
  }
  showConfirm('Son limit kaydı silinsin mi? Bir önceki limite dönülecek.', ()=>{
    const yeniGecmis = gecmis.slice(1); // tarihe göre sıralı, 0.indeks en yeni
    k.limitGecmisi = yeniGecmis;
    const onceki = yeniGecmis[0];
    k.limit = onceki ? onceki.limit : 0;
    k.limitTarih = onceki ? onceki.tarih : '';
    saveData();
    renderKartLimitGecmis(yeniGecmis);
    setMoneyInput('kart-limit', k.limit || '');
    setDateInputValue('kart-limit-tarih', k.limitTarih || '');
    renderKartlar();
  });
}

export function editKart(id, scrollToLimit) {
  setEditKartId(id);
  const kart = DB.kartlar.find(k=>k.id===id);
  openModal('modal-kart');
  setTimeout(()=>populateKartModal(kart),50);
  if (scrollToLimit) {
    setTimeout(() => {
      kartStepGoto(2);
      const sec = document.getElementById('msec-toplam-limit');
      const limitInput = document.getElementById('kart-limit');
      if (sec) {
        sec.classList.add('msec-highlight');
        setTimeout(() => sec.classList.remove('msec-highlight'), 1600);
      }
      if (limitInput) limitInput.focus({ preventScroll: true });
    }, 120);
  }
}

export function deleteKart(id) {
  showConfirm('Bu kartı silmek istiyor musunuz?', () => {
    DB.kartlar = DB.kartlar.filter(k=>k.id!==id);
    saveData();
    renderKartlar();
    updateSidebarKartNav();
  });
}

export function kartAktifDonemBul(k, today, tatilSet) {
  const todayStr = localDateStr(today);
  let best = null;
  for(let offset=-2; offset<=1; offset++) {
    const d = new Date(today.getFullYear(), today.getMonth()+offset, 1);
    const extre = calcExtreTarihiOdemeModuyla(k, d.getFullYear(), d.getMonth(), tatilSet);
    if(!extre) continue;
    const odeme = calcOdemeTarihi(extre, k.odemeSure, k.odemeGunTip, tatilSet);
    if(!odeme) continue;
    if(localDateStr(odeme) >= todayStr) {
      if(!best || odeme < best.odeme) best = { extre, odeme };
    }
  }
  if(best) return best;
  // Hiçbiri bulunamadıysa (ör. eksik ayar) — eski davranışa dön
  const extre = calcExtreTarihiOdemeModuyla(k, today.getFullYear(), today.getMonth(), tatilSet);
  const odeme = extre ? calcOdemeTarihi(extre, k.odemeSure, k.odemeGunTip, tatilSet) : null;
  return { extre, odeme };
}

export function kartlarSirala(key, yon) {
  tblSiralamaAyarla('kartlar', key, yon);
  renderKartlar();
}

// [KALDIRILDI] kartDonemErtelendiMi(kart, donemKey) — hiçbir yerden
// çağrılmıyordu (ölü kod taraması, 2026-07).

export function kartOdemeTarihiEfektif(kart, donemKey, defaultTarih) {
  const ov = odKartDonemOverride(kart, donemKey);
  if(ov && ov.durum === 'ertelendi' && ov.yeniTarih) return ov.yeniTarih;
  return defaultTarih;
}

// kartDonemHesapla: bir kartın belirli bir ay/yıl dönemi için ekstre tarihi,
// varsayılan+efektif son ödeme tarihi ve "ertelendi mi" bilgisini hesaplar.
// ekstreler/02-ekstre-render.js (renderExtreler → ensurePeriod),
// islemler/05-ekstre-kart-secici.js (_extreKartTemsiliDonem → ensurePeriod)
// ve ozet.js (projeksiyon → ensurePeriod) içindeki üç `ensurePeriod`
// fonksiyonunun ÇEKİRDEK hesaplama kısmı birebir aynıydı (md5 ile
// doğrulandı) — sadece periodMap'e set edilen obje şekli (label,
// rowsByPb gibi alanların olup olmaması) her çağıran yerde farklıydı.
// Bu yüzden üç `ensurePeriod`'un TAMAMI birleştirilmedi (davranış farkı
// riski), sadece ortak hesaplama buraya çıkarıldı; her çağıran kendi
// obje şeklini bu fonksiyonun döndürdüğü değerlerden kurar.
// Döner: extreDt (Date) null ise dönem geçersiz demektir (çağıran null
// dönmeli); aksi halde { extreDt, odemeDt, odemeEfektif, ertelendi }.
export function kartDonemHesapla(kart, y, m, tatilSet, key) {
  const extreDt = calcExtreTarihiOdemeModuyla(kart, y, m, tatilSet);
  if (!extreDt) return null;
  const odemeDt = calcOdemeTarihi(extreDt, kart.odemeSure, kart.odemeGunTip, tatilSet);
  const odemeVarsayilan = localDateStr(odemeDt);
  const odemeEfektif = kartOdemeTarihiEfektif(kart, key, odemeVarsayilan);
  return {
    extreDt, odemeDt,
    extre: localDateStr(extreDt),
    odeme: odemeEfektif,
    odemeVarsayilan,
    ertelendi: odemeEfektif !== odemeVarsayilan
  };
}



// Kartın desteklediği para birimlerini döndür (dizi)

export function getKartCurrencies(kartId) {
  const k = DB.kartlar.find(k=>k.id===kartId);
  if(!k) return [defaultCurrency];
  // Yeni format: paraBirimleri dizisi; eski format: paraBirimi string
  if(k.paraBirimleri && k.paraBirimleri.length) return k.paraBirimleri;
  if(k.paraBirimi) return [k.paraBirimi];
  return [defaultCurrency];
}

// Kartın varsayılan para birimini döndür

export function getKartDefaultCurrency(kartId) {
  const k = DB.kartlar.find(k=>k.id===kartId);
  if(!k) return defaultCurrency;
  if(k.varsayilanParaBirimi) return k.varsayilanParaBirimi;
  const list = getKartCurrencies(kartId);
  return list[0] || defaultCurrency;
}

// Bir para birimi bu kart tarafından destekleniyorsa onu, yoksa kartın varsayılanını döndür

export function getKartCurrency(kartId, islemParaBirimi) {
  if(!islemParaBirimi) return getKartDefaultCurrency(kartId);
  const supported = getKartCurrencies(kartId);
  return supported.includes(islemParaBirimi) ? islemParaBirimi : getKartDefaultCurrency(kartId);
}

// Kart ekstresi para birimi mantığı:
// - İşlemin para birimi kartın desteklediği para birimlerinden biriyse ekstre o para biriminden kesilir.
// - Desteklenmeyen para birimindeki işlem, kartın varsayılan para birimine çevrilerek ekstreye yansır.

export function getKartStatementCurrency(kartId, islemParaBirimi) {
  return getKartCurrency(kartId, islemParaBirimi);
}

export function getKartStatementAmount(kartId, tutar, islemParaBirimi, tarihStr) {
  const hedefPb = getKartStatementCurrency(kartId, islemParaBirimi);
  const kaynakPb = islemParaBirimi || hedefPb;
  const n = Number(tutar) || 0;
  if(!kaynakPb || kaynakPb === hedefPb) return n;
  if(typeof paraBirimiCevirGuvenli === 'function') return paraBirimiCevirGuvenli(n, kaynakPb, hedefPb, tarihStr || localDateStr(new Date()));
  return n;
}

export function getKart(id) {
  return DB.kartlar.find(k=>k.id===id);
}

export function getKartRenk(k) {
  if (!k) return KART_RENK_PALET[0];
  if (k.renk) return k.renk;
  let idx = (DB.kartlar||[]).findIndex(x=>x.id===k.id);
  if (idx < 0) idx = 0;
  return KART_RENK_PALET[idx % KART_RENK_PALET.length];
}

export function getKartKullanim(kartId) {
  const kart = DB.kartlar.find(k=>k.id===kartId);
  let total = 0;

  // Dönem bazlı (donemKey) borç toplamı — para birimi bazında.
  // Kartın varsayılan para birimi dışındaki tutarlar varsa fmtCur/limit zaten tek para biriminde
  // tutulduğundan burada da kart genel limiti tek para birimi varsayımıyla toplanır (mevcut davranışla tutarlı).
  // Nakit avans işlemleri ayrı tutulur: limit kullanımına faiz dahil taksit tutarı değil,
  // sadece ödenmemiş ANAPARA payı yansır (çekim anında anaparanın tamamı limitten düşmüş sayılır,
  // taksit ödendikçe o taksidin anapara payı kadar limit yeniden açılır).
  const donemToplam = {};      // donemKey -> normal işlemler toplamı (taksit tutarının tamamı)
  const donemNaToplam = {};    // donemKey -> nakit avans taksitleri toplamı (faiz dahil, sadece oranlama için)
  const donemNaAnaToplam = {}; // donemKey -> nakit avans taksitlerinin ANAPARA payı toplamı

  DB.islemler.filter(i=>i.kart===kartId).forEach(i=>{
    const isNakitAvans = i.tip === 'nakitAvans';
    const anaParalar = isNakitAvans ? getNakitAvansTaksitAnaParalari(i) : null;

    getIslemTaksitliste(i).forEach((tak, idx) => {
      let donemKey = null;
      if(kart) {
        const donem = getExtreDonemi(kart, tak.ekstreTarih);
        if(donem) donemKey = `${donem.year}-${String(donem.month+1).padStart(2,'0')}`;
      }
      // Dönemi çözümlenemeyen (kenar durum) taksitler eski mantıkla (kendi tarihi) ele alınır
      if(!donemKey) donemKey = `__free_${tak.tarih}`;

      if(isNakitAvans) {
        donemNaToplam[donemKey] = (donemNaToplam[donemKey] || 0) + getKartStatementAmount(kartId, tak.tutar, i.paraBirimi, tak.ekstreTarih || tak.tarih || i.tarih);
        donemNaAnaToplam[donemKey] = (donemNaAnaToplam[donemKey] || 0) + getKartStatementAmount(kartId, (anaParalar[idx] ?? 0), i.paraBirimi, tak.ekstreTarih || tak.tarih || i.tarih);
      } else {
        donemToplam[donemKey] = (donemToplam[donemKey] || 0) + getKartStatementAmount(kartId, tak.tutar, i.paraBirimi, tak.ekstreTarih || tak.tarih || i.tarih);
      }
    });
  });

  // Her dönem için: o döneme yapılan toplam ödeme, dönem borcuna ulaşmadıysa
  // kalan kısım hâlâ limiti kullanıyor demektir — ödeme tarihinin geçip geçmediğine bakılmaksızın.
  const tumDonemKeyleri = new Set([...Object.keys(donemToplam), ...Object.keys(donemNaToplam)]);
  tumDonemKeyleri.forEach(donemKey => {
    const normalBorc = donemToplam[donemKey] || 0;
    const naBorc = donemNaToplam[donemKey] || 0;     // faiz dahil — sadece oranlama için
    const naAnaBorc = donemNaAnaToplam[donemKey] || 0; // limit kullanımına yansıyacak anapara payı
    const toplamBorc = normalBorc + naBorc;
    if(toplamBorc <= 0) return; // sadece iade/eksi bakiyeli dönemler limiti artırmaz, olduğu gibi yoksayılır

    const odenenTop = (DB.kartOdemeleri||[])
      .filter(o => o.kartId === kartId && o.donemKey === donemKey)
      .reduce((s,o)=>s+(o.tutar||0), 0);

    // Ödemeyi normal/nakit-avans arasında dönem borcuna oranlı paylaştır
    const naOran = toplamBorc > 0 ? (naBorc / toplamBorc) : 0;
    const odenenNa = odenenTop * naOran;
    const odenenNormal = odenenTop - odenenNa;

    // Normal işlemler: tam taksit tutarı üzerinden kalan
    const kalanNormal = Math.max(0, normalBorc - odenenNormal);
    // Nakit avans: ödenen oranı anapara payına uygulanarak kalan anapara bulunur
    // (örn. dönem nakit-avans borcunun %40'ı ödendiyse, anapara payının da %40'ı ödenmiş sayılır)
    const naOdemeOrani = naBorc > 0 ? Math.min(1, odenenNa / naBorc) : 0;
    const kalanNaAna = Math.max(0, naAnaBorc * (1 - naOdemeOrani));

    total += kalanNormal + kalanNaAna;
  });

  // KMH kredileri — kalan borç
  (DB.krediler||[]).filter(kr=>kr.kmhId===kartId).forEach(kr=>{
    total += getKrediKalanBorc(kr);
  });

  return total;
}

// ── Ortak Limit Grubu yardımcı fonksiyonları ─────────────────────
// Belirli bir grubun toplam kullanımını döndürür (tüm üye kartların kullanım toplamı)

export function getKartKullanilabilirLimit(kartId) {
  const k = DB.kartlar.find(x => x.id === kartId);
  if (!k) return 0;
  const grupId = k.ortakLimitGrupId;
  if (grupId) {
    const grup = (DB.ortakLimitGruplari||[]).find(g => g.id === grupId);
    if (grup) {
      const grupKullanim = getOrtakGrupKullanim(grupId);
      return Math.max(0, (grup.limit||0) - grupKullanim);
    }
  }
  return Math.max(0, (k.limit||0) - getKartKullanim(kartId));
}

// Ortak limit grubunun toplam limitini döndürür

export function getKartToplamLimit(kartId) {
  const k = DB.kartlar.find(x => x.id === kartId);
  if (!k) return 0;
  const grupId = k.ortakLimitGrupId;
  if (grupId) {
    const grup = (DB.ortakLimitGruplari||[]).find(g => g.id === grupId);
    if (grup) return grup.limit || 0;
  }
  return k.limit || 0;
}

// ── Ortak Limit Grubu CRUD ────────────────────────────────────────

export function getKartDonemParaBirimleri(kartId, donemKey) {
  const kart = DB.kartlar.find(k => k.id === kartId);
  if (!kart) return [];
  const set = new Set();
  (DB.islemler || []).filter(i => i.kart === kartId).forEach(islem => {
    const stmtPb = getKartStatementCurrency(kartId, islem.paraBirimi);
    getIslemTaksitliste(islem).forEach(tak => {
      const pd = getExtreDonemi(kart, tak.ekstreTarih || tak.tarih || islem.tarih);
      if (!pd) return;
      const key = pd.year + '-' + String(pd.month + 1).padStart(2, '0');
      if (key === donemKey) set.add(stmtPb);
    });
  });
  return Array.from(set);
}

// ── Belirli bir ekstre dönemine ait borcu hesaplar (diğer/gelecek dönemler dahil edilmez) ──
// kdRenderExtreler / kd2RenderExtreler'deki dönem haritalama mantığıyla aynı: o döneme denk
// gelen taksitlerin tutarları toplanır (nakit avans dahil, faizi ile birlikte — ekstreye yansıyan tam tutar).

export function getKartDonemBorcu(kartId, donemKey, pb) {
  const kart = DB.kartlar.find(k => k.id === kartId);
  if (!kart) return 0;
  let toplam = 0;
  (DB.islemler || []).filter(i => i.kart === kartId).forEach(islem => {
    const stmtPb = getKartStatementCurrency(kartId, islem.paraBirimi);
    if (pb && stmtPb !== pb) return;
    getIslemTaksitliste(islem).forEach(tak => {
      const pd = getExtreDonemi(kart, tak.ekstreTarih);
      if (!pd) return;
      const key = pd.year + '-' + String(pd.month + 1).padStart(2, '0');
      if (key === donemKey) toplam += getKartStatementAmount(kartId, tak.tutar, islem.paraBirimi, tak.ekstreTarih || tak.tarih || islem.tarih);
    });
  });
  return toplam;
}

// rf-refactor Faz2: kd (modal) / kd2 (tam sayfa) kart detay görünümleri için ortak,
// yalnızca DOM/state mantığı taşıyan (render'a karışmayan) paylaşılan çekirdek yardımcılar.
// Her fonksiyon çifti (kd*/kd2*) kendi state değişkenini ve render fonksiyonunu bu
// çekirdeklere parametre olarak geçirir; orijinal davranış birebir korunur.


