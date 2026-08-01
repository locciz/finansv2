import { fmtAyYil, fmtCur, fmtDate, localDateStr } from '@core/format.js';
import { DB } from '@core/state.js';
import { calcExtreTarihiOdemeModuyla, calcOdemeTarihi, getExtreDonemi, getIslemTaksitliste } from '@domain/hesaplamalar.js';
import { phSet } from '@components/modal-genel.js';
import { isEkstreKesinlesmis } from '@pages/ekstreler/01-ekstre-kesinlestirme.js';
import { call } from '@core/wrap-registry.js';
import { AY_KISA_TR, AY_UZUN_TR, GUN_UZUN_TR, _islemDonemTab, set_islemDonemTab } from '@pages/islemler/00-state.js';
import { persistIslemFiltreToDB, renderIslemFiltreBadge, renderIslemFiltreGrids, restoreIslemFiltreFromDB } from '@pages/islemler/04-islem-filtre.js';
import { getKart, getKartCurrency, getKartRenk } from '@pages/kartlar/01-kart-data.js';
import { getBanka, getTatilSet } from '@pages/tanimlamalar/01-genel-yardimcilar.js';
import { editIslem } from '@pages/islemler/07-islem-modal-crud.js';
// ============================================================
// js/ui/pages/islemler/03-islem-liste-render.js
// İşlem listesi render (gün başlıkları, satırlar, istatistik şeridi)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/islemler.js
// (49 export, 1087 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function islemKesinlenmisMi(i, taksitOverride) {
  const k = getKart(i.kart);
  if(!k) return false;
  const kontrolEt = (tak) => {
    const pd = getExtreDonemi(k, tak.ekstreTarih || tak.tarih);
    if(!pd) return false;
    return isEkstreKesinlesmis(k.id, `${pd.year}-${String(pd.month+1).padStart(2,'0')}`);
  };
  if(taksitOverride) return kontrolEt(taksitOverride);
  const taksitler = getIslemTaksitliste(i);
  return taksitler.some(kontrolEt);
}

// [KALDIRILDI] islemGunBasligi(tarihStr) — "Bugün/Dün/tarih" gün başlığı
// üreten yardımcı, hiçbir yerden çağrılmıyordu (ölü kod taraması, 2026-07).

export function renderIslemler() {
  // ── Kayıtlı filtre tercihlerini (Drive'dan gelen DB) ilk girişte select'lere uygula ──
  restoreIslemFiltreFromDB();

  // populate filter
  const fk = document.getElementById('filter-kart');
  const curKart = fk.value;
  fk.innerHTML = DB.kartlar.map(k=>`<option value="${k.id}">${k.ad}</option>`).join('');
  phSet(fk, 'Tüm Kartlar', curKart, '— Kart bulunamadı —');

  const fa = document.getElementById('filter-ay');
  const curAy = fa.value;
  // collect months
  const months = new Set();
  DB.islemler.forEach(i=>months.add(i.tarih.slice(0,7)));
  const sortedMonths = Array.from(months).sort().reverse();
  fa.innerHTML = sortedMonths.map(m=>{
    const [y,mo]=m.split('-');
    return `<option value="${m}">${fmtAyYil(new Date(y,mo-1,1))}</option>`;
  }).join('');
  phSet(fa, 'Tüm Aylar', (curAy && months.has(curAy)) ? curAy : '', '— Henüz işlem yok —');

  const fq = document.getElementById('filter-q');
  const ft = document.getElementById('filter-taksit');
  const qVal = (fq && fq.value || '').trim().toLocaleLowerCase('tr-TR');
  const tVal = ft ? ft.value : '';

  // ── Filtre tercihlerini DB'ye yaz ve Drive'a senkronize et ──────────────
  persistIslemFiltreToDB();

  renderIslemFiltreBadge();
  renderIslemFiltreGrids();

  // ── Dönem sekmesi durumunu görsel olarak güncelle ──
  document.querySelectorAll('.islem-donem-tab').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.donem === _islemDonemTab);
  });

  let islemler = [...DB.islemler];
  if(fk.value) islemler = islemler.filter(i=>i.kart===fk.value);
  if(fa.value) islemler = islemler.filter(i=>i.tarih.startsWith(fa.value));
  if(tVal === 'pesin') islemler = islemler.filter(i=>(i.taksit||1) <= 1);
  if(tVal === 'taksitli') islemler = islemler.filter(i=>(i.taksit||1) > 1);
  if(qVal) islemler = islemler.filter(i=>(i.aciklama||'').toLocaleLowerCase('tr-TR').includes(qVal));
  if(_islemDonemTab !== 'tum') {
    const donemCache = {};
    islemler = islemler.filter(i => getIslemDonemDurumlari(i, donemCache).has(_islemDonemTab));
  }
  islemler.sort((a,b)=>b.tarih.localeCompare(a.tarih));

  const tatilSet = getTatilSet();

  renderIslemStatsStrip(islemler, tatilSet);

  const list = document.getElementById('islemler-list');
  if(!list) return;

  if(!islemler.length) {
    const emptyMsg = _islemDonemTab === 'guncel' ? 'Bu dönemde işlem yok'
      : _islemDonemTab === 'onceki' ? 'Önceki dönemde işlem yok'
      : 'İşlem bulunamadı';
    const emptySub = _islemDonemTab === 'tum' ? 'Filtreleri temizleyin veya yeni bir işlem ekleyin' : 'Diğer dönemlere göz atabilir veya yeni işlem ekleyebilirsiniz';
    list.innerHTML = `<div class="islem-empty">
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
      <div class="islem-empty-title">${emptyMsg}</div>
      <div class="islem-empty-sub">${emptySub}</div>
    </div>`;
    return;
  }

  // ── Her satırın solunda kendi tarih kartı olduğu için ayrı gün başlığı yok ──
  let html = '';
  islemler.forEach(i=>{
    html += islemRowHtml(i);
  });
  list.innerHTML = html;

  // [ES module] onclick="..." kaldırıldı - gerçek addEventListener bağlanıyor.
  // deleteIslem: DUPE_NAMES listesinde (birden fazla dosyada tanımlı) -> window köprüsü kullan.
  bindIslemRowEvents(list);
}

// islemRowHtml()'in ürettiği satırlara (.islem-row-clickable /
// .islem-katline-clickable / .islem-actions-stop / .islem-edit-btn /
// .islem-delete-btn) gerçek addEventListener bağlar. 4 farklı yerde
// (bu dosyanın içindeki blok + kartlar/04-kart-detay-v1.js 2 kez +
// kartlar/05-kart-detay-v2.js) birebir aynı 15 satırlık blok olarak
// kopyalanmıştı (md5 ile doğrulandı). islemRowHtml ile aynı dosyada
// tutulur; onu render eden her yer bunu import edip innerHTML
// atamasından hemen sonra çağırabilir: bindIslemRowEvents(containerEl).
export function bindIslemRowEvents(container) {
  if (!container) return;
  container.querySelectorAll('.islem-row-clickable').forEach(row => {
    row.addEventListener('click', () => editIslem(row.getAttribute('data-id')));
  });
  container.querySelectorAll('.islem-katline-clickable').forEach(katLine => {
    katLine.addEventListener('click', (event) => { event.stopPropagation(); editIslem(katLine.getAttribute('data-id')); });
  });
  container.querySelectorAll('.islem-actions-stop').forEach(actionsEl => {
    actionsEl.addEventListener('click', (event) => { event.stopPropagation(); });
  });
  container.querySelectorAll('.islem-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editIslem(btn.getAttribute('data-id')));
  });
  container.querySelectorAll('.islem-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => call('deleteIslem', btn.getAttribute('data-id')));
  });
}

export function islemRowHtml(i, taksitOverride) {
  const k = getKart(i.kart);
  const tutarlar = i.taksitTutarlari || Array(i.taksit||1).fill(i.aylik||0);
  const iCur = i.paraBirimi || getKartCurrency(i.kart);
  const isTaksitli = (i.taksit||1) > 1;
  const kat = (DB.kategoriler||[]).find(x=>x.id===i.kategori);
  const ikon = i._mahsup ? '💳' : (kat && kat.ikon ? kat.ikon : '💳');
  const aciklamaSafe = (i.aciklama||'—').replace(/"/g,'&quot;');
  // Ekstre bağlamında (taksitOverride verilmişse) o döneme ait spesifik taksidin tarih/tutarı
  // gösterilir; aksi halde işlemin kendi tarihi ve toplam tutarı kullanılır.
  const rowTutar = taksitOverride ? taksitOverride.tutar : i.tutar;
  const rowTarih = taksitOverride ? taksitOverride.tarih : i.tarih;
  // Renk: kategori türüne bak (gelir=yeşil, gider=kırmızı), yoksa tutar işaretine göre
  const amtClass = i._mahsup ? 'pos'
                 : kat && kat.tur === 'gelir' ? 'pos'
                 : kat && kat.tur === 'gider' ? 'neg'
                 : rowTutar < 0 ? 'neg' : rowTutar > 0 ? 'pos' : 'neutral';
  const renk = getKartRenk(k);
  const bankaAd = k ? getBanka(k.banka) : '';
  const bankaColHtml = '';
  const dObj = new Date(rowTarih+'T00:00:00');
  const dateCardHtml = `<div class="islem-date-card"><div class="islem-date-day">${dObj.getDate()}</div><div class="islem-date-mon">${AY_KISA_TR[dObj.getMonth()]}</div></div>`;

  let taksitSub = '';
  if(isTaksitli) {
    if (taksitOverride) {
      taksitSub = `<div class="islem-row2-amount-sub">${taksitOverride.no}/${i.taksit} taksit</div>`;
    } else {
      const todayStr = localDateStr(new Date());
      const taksitler = getIslemTaksitliste(i);
      let mevcutNo = taksitler.filter(t=>t.tarih <= todayStr).length;
      if(mevcutNo < 1) mevcutNo = 1;
      if(mevcutNo > i.taksit) mevcutNo = i.taksit;
      taksitSub = `<div class="islem-row2-amount-sub">${mevcutNo}/${i.taksit} taksit · ${fmtCur(tutarlar[0]||0, iCur)}/ay</div>`;
    }
  }

  // Kesinleşmiş ekstreye ait işlemler artık düzenlenemez/silinemez — bu satırda
  // düzenle/sil butonları hiç gösterilmez ve satır tıklanınca düzenleme modalı açılmaz.
  const kesinlenmis = islemKesinlenmisMi(i, taksitOverride);
  const rowClass = `islem-row2${kesinlenmis ? ' islem-row2-locked' : ' islem-row-clickable'}`;
  const rowDataAttr = kesinlenmis ? '' : ` data-id="${i.id}"`;
  const katLineHtml = kat ? `<div class="islem-row2-kat-line${kesinlenmis ? '' : ' islem-katline-clickable'}"${kesinlenmis ? '' : ` data-id="${i.id}"`}><span class="islem-row2-kat-chip" title="${(kat.ad||'').replace(/"/g,'&quot;')}">${kat.ikon||'🏷️'} ${kat.ad}</span></div>` : '';

  return `<div class="islem-row2-wrap">
  <div class="${rowClass}"${rowDataAttr}>
    ${dateCardHtml}
    <div class="islem-row2-icon-wrap">
      <div class="islem-row2-icon" style="background:${renk}18;border:1px solid ${renk}30">${ikon}</div>
    </div>
    ${bankaColHtml}
    <div class="islem-row2-body">
      <div class="islem-row2-title" title="${aciklamaSafe}">${aciklamaSafe}</div>
      <div class="islem-row2-sub">
        <span class="islem-kart-dot" style="background:${renk};box-shadow:0 0 5px ${renk}88"></span><span class="islem-row2-bankaad" title="${(bankaAd||'').replace(/"/g,'&quot;')}">${bankaAd||'-'}</span><span class="islem-row2-sep">·</span><span class="islem-row2-kartad">${k?k.ad:'-'}</span>${i._mahsup ? ' <span style="font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:20px;background:rgba(45,212,191,.12);color:var(--teal);margin-left:4px">Ödeme</span>' : ''}
      </div>
      ${katLineHtml}
    </div>
    <div class="islem-row2-amount">
      <div class="islem-row2-amount-val ${amtClass}">${fmtCur(rowTutar, iCur)}</div>
      ${taksitSub}
    </div>
    <div class="islem-row2-actions islem-actions-stop">
      ${kesinlenmis
        ? `<span class="islem-kesin-lock" title="Ekstre kesinleşti — bu işlem düzenlenemez/silinemez">🔒</span>`
        : `<button class="btn btn-ghost btn-sm btn-act islem-edit-btn" data-id="${i.id}" title="Düzenle"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:block"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/></svg></button>
      <button class="btn btn-danger btn-sm btn-act islem-delete-btn" data-id="${i.id}" title="Sil"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:block"><polyline points="3,5 13,5"/><path d="M6 5V3h4v2M5 5l1 9h4l1-9"/></svg></button>`}
    </div>
  </div>
  </div>`;
}

export function renderIslemStatsStrip(islemler, tatilSet) {
  const wrap = document.getElementById('islem-stats');
  if(!wrap) return;

  const count = islemler.length;
  const taksitliCount = islemler.filter(i=>(i.taksit||1) > 1).length;

  // Para birimine göre toplam tutar
  const totals = {};
  islemler.forEach(i=>{
    const cur = i.paraBirimi || getKartCurrency(i.kart);
    totals[cur] = (totals[cur]||0) + (i.tutar||0);
  });
  const totalStr = Object.keys(totals).length
    ? Object.entries(totals).map(([c,v])=>fmtCur(v,c)).join(' + ')
    : '—';

  // En yakın gelecek ödeme tarihi
  let nearest = null;
  const todayMid = new Date(); todayMid.setHours(0,0,0,0);
  islemler.forEach(i=>{
    const k = getKart(i.kart);
    if(!k) return;
    getIslemTaksitliste(i).forEach(t=>{
      const pd = getExtreDonemi(k, t.ekstreTarih);
      if(!pd) return;
      const extreDt = calcExtreTarihiOdemeModuyla(k, pd.year, pd.month, tatilSet);
      const odemeDt = extreDt ? calcOdemeTarihi(extreDt, k.odemeSure, k.odemeGunTip, tatilSet) : null;
      if(odemeDt && odemeDt >= todayMid && (!nearest || odemeDt < nearest.date)) {
        nearest = { date: odemeDt, kart: k.ad };
      }
    });
  });

  wrap.innerHTML = `
    <div class="islem-chip c-gold">
      <div class="islem-chip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div>
      <div class="islem-chip-body"><div class="islem-chip-label">Toplam İşlem</div><div class="islem-chip-val">${count}</div></div>
    </div>
    <div class="islem-chip c-teal">
      <div class="islem-chip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
      <div class="islem-chip-body"><div class="islem-chip-label">Toplam Tutar</div><div class="islem-chip-val">${totalStr}</div></div>
    </div>
    <div class="islem-chip c-warn">
      <div class="islem-chip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
      <div class="islem-chip-body"><div class="islem-chip-label">Taksitli İşlem</div><div class="islem-chip-val">${taksitliCount}</div></div>
    </div>
    <div class="islem-chip c-rose">
      <div class="islem-chip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
      <div class="islem-chip-body"><div class="islem-chip-label">En Yakın Ödeme</div><div class="islem-chip-val" style="font-size:13px">${nearest?fmtDate(nearest.date):'—'}</div>${nearest?`<div class="islem-chip-sub">${nearest.kart}</div>`:''}</div>
    </div>
  `;
}

export function setIslemDonemTab(tab) {
  set_islemDonemTab(tab);
  renderIslemler();
}

// Bir işlemin (taksitleri üzerinden) hangi dönem(ler)e düştüğünü bulur.
// Birden fazla taksiti olan bir işlem, aynı anda "güncel" ve "önceki" gibi
// birden fazla döneme yayılabilir — bu yüzden Set döner.

export function getIslemDonemDurumlari(islem, donemCache) {
  const k = getKart(islem.kart);
  const set = new Set();
  if(!k) return set;
  if(!donemCache[k.id]) {
    const todayStr = localDateStr(new Date());
    const guncel = getExtreDonemi(k, todayStr);
    let onceki = null;
    if(guncel) {
      let py = guncel.year, pm = guncel.month - 1;
      if(pm < 0) { pm = 11; py -= 1; }
      onceki = {year:py, month:pm};
    }
    donemCache[k.id] = {guncel, onceki};
  }
  const {guncel, onceki} = donemCache[k.id];
  if(!guncel) return set;
  getIslemTaksitliste(islem).forEach(t=>{
    const d = getExtreDonemi(k, t.ekstreTarih);
    if(!d) return;
    if(d.year===guncel.year && d.month===guncel.month) set.add('guncel');
    else if(onceki && d.year===onceki.year && d.month===onceki.month) set.add('onceki');
    else set.add('eski');
  });
  return set;
}

// ---- (2. tur refactor: 02-core-app-engine.js'den taşındı) ----
export var editIslemId = null;

// ── İşlemler filtre tercihlerini DB.uiFiltreler.islemler ile senkronize et ──
// (DB her değiştiğinde saveData() Drive'a debounce'lu kaydeder; bir sonraki
//  açılışta / Drive senkronundan sonra restoreIslemFiltreFromDB() geri yükler.)
export var _islemFiltreRestored = false;

// [ES module] Bu dosyada tanımlanan aşağıdaki değişkenler başka dosyalarda
// yeniden atanıyordu (import edilen bir binding'e doğrudan atama ES
// module'de yasaktır). Bu setter fonksiyonları o davranışı korumak için
// eklendi - ilgili dosyalar artık `X = v` yerine `setX(v)` çağırıyor.
export function set_islemFiltreRestored(v) { _islemFiltreRestored = v; }
export function setEditIslemId(v) {
  editIslemId = v;
}

