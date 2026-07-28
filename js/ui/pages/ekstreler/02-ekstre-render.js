import { fmtCur, fmtDate, localDateStr } from '@core/format.js';
import { DB } from '@core/state.js';
import { getExtreDonemi, getIslemTaksitliste } from '@domain/hesaplamalar.js';
import { phSet } from '@components/modal-genel.js';
import { persistExtreFiltreToDB, restoreExtreFiltreFromDB } from '@components/tablo-filtre-sirala.js';
import { calcAsgariOdeme } from '@pages/asgari-odeme.js';
import { isEkstreKesinlesmis, kesinlestirEkstre, openOzelExtreModal } from '@pages/ekstreler/01-ekstre-kesinlestirme.js';
import { _extreKartTemsiliDonem, extreKartSec } from '@pages/islemler/05-ekstre-kart-secici.js';
import { deleteKartOdeme } from '@pages/kartlar/08-kart-odeme.js';
import { odAcPopupKart } from '@pages/odeme/08-popup-giris-noktalari.js';
import { getKartCurrencies, getKartCurrency, getKartDonemBorcu, getKartKullanim, getKartRenk, getKartStatementAmount, kartDonemHesapla } from '@pages/kartlar/01-kart-data.js';
import { bankaIkonObj, getBanka, getTatilSet } from '@pages/tanimlamalar/01-genel-yardimcilar.js';
import { closeModal, openModal } from '@components/modal-genel.js';
import { register } from '@core/wrap-registry.js';
// ============================================================
// js/ui/pages/ekstreler/02-ekstre-render.js
// Ekstreler sayfası — ana liste/özet render
// Kod SATIR SATIR aynı kaldı; sadece dosya sınırı/gruplama değişti.
// ============================================================
export function _ekstreBekleyenKartHtml(kart, key, extreDt, odemeDt, opts) {
  opts = opts || {};
  const [y, m] = key.split('-').map(Number);
  const ayLabel = new Date(y, m - 1, 1).toLocaleDateString('tr-TR', {year:'numeric', month:'long'});
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const odemeDtMs = new Date(odemeDt + 'T00:00:00');
  const kalanGun = Math.round((odemeDtMs - today) / 86400000);
  const isPast = kalanGun < 0;
  const kalanStr = isPast ? `${Math.abs(kalanGun)} gün gecikti` : kalanGun === 0 ? 'Bugün!' : `${kalanGun} gün kaldı`;
  const kalanColor = isPast ? 'var(--danger)' : kalanGun <= 3 ? '#f59e0b' : 'var(--text3)';
  const renk = getKartRenk(kart);

  const pbList = getKartCurrencies(kart.id);
  const paraBoxlari = pbList.map(pb => {
    const toplamBorc = getKartDonemBorcu(kart.id, key, pb);
    if (!toplamBorc) return '';
    const asgari = calcAsgariOdeme(kart.limit || 0, toplamBorc, pb);
    const pbEtiket = pbList.length > 1 ? ` <span style="opacity:.65">· ${pb}</span>` : '';
    return `
      <div class="exk-box${isPast ? ' exk-box-past' : ''}">
        <div class="exk-box-icon">🧾</div>
        <div class="exk-box-label">Toplam Borç${pbEtiket}</div>
        <div class="exk-box-val" style="color:${isPast ? 'var(--danger)' : 'var(--warn)'}">${fmtCur(toplamBorc, pb)}</div>
      </div>
      ${asgari ? `<div class="exk-box exk-box-asgari">
        <div class="exk-box-icon">⚠️</div>
        <div class="exk-box-label">Asgari Ödeme</div>
        <div class="exk-box-val" style="color:#f59e0b">${fmtCur(asgari.tutar, pb)}</div>
        <div class="exk-box-meta">%${asgari.oran} oran</div>
      </div>` : ''}`;
  }).join('');

  const boxesHtml = `<div class="exk-boxes" style="margin:10px 0 0;grid-template-columns:repeat(auto-fit,minmax(120px,1fr))">
    <div class="exk-box">
      <div class="exk-box-icon">📅</div>
      <div class="exk-box-label">Ekstre Tarihi</div>
      <div class="exk-box-val" style="font-size:14px">${fmtDate(extreDt)}</div>
    </div>
    <div class="exk-box${isPast ? ' exk-box-urgent' : ''}">
      <div class="exk-box-icon">⏰</div>
      <div class="exk-box-label">Son Ödeme</div>
      <div class="exk-box-val" style="font-size:14px">${fmtDate(odemeDt)}</div>
      <div class="exk-box-meta" style="color:${kalanColor}">${kalanStr}</div>
    </div>
    ${paraBoxlari}
  </div>`;

  const bankaAd = opts.showKartAdi ? getBanka(kart.banka) : '';
  const baslikSol = opts.showKartAdi
    ? `<span class="card-title-icon" style="width:22px;height:22px;border-radius:6px;background:${renk};display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#0b0f16">${(kart.ad||'?').charAt(0).toUpperCase()}</span>
       <span style="font-size:13px;font-weight:700;color:var(--text)">${kart.ad}</span>
       <span style="font-size:10.5px;color:var(--text3)">${bankaAd} · ${ayLabel}</span>`
    : `<span style="font-size:13px;font-weight:700;color:var(--text)">${ayLabel}</span>`;

  return `<div class="card" style="border-left:3px solid ${renk};background:var(--surface2);padding:12px 14px 14px;margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      ${baslikSol}
      <span style="background:rgba(251,191,36,.14);color:var(--gold);border-radius:5px;padding:2px 8px;font-size:9.5px;font-weight:700;letter-spacing:.03em;white-space:nowrap">📋 KESİNLEŞTİRME BEKLİYOR</span>
      <button class="btn btn-primary btn-sm eks-bekleyen-kesinlestir-btn" data-kart-id="${kart.id}" data-key="${key}" style="font-size:11px;padding:4px 12px;margin-left:auto;white-space:nowrap">✓ Kesinleştir</button>
    </div>
    ${boxesHtml}
  </div>`;
}

// Kart görselinin doku varyantını (0-3) kart id'sinden deterministik olarak üretir —
// aynı kart her zaman aynı deseni alır, farklı kartlar genelde farklı desen alır.

export function _ekPatternIdx(kart) {
  const s = String((kart && kart.id) || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
  return h % 4;
}

export function renderExtreKartOzetListesi() {
  const wrap = document.getElementById('extre-kart-liste');
  if(!wrap) return;
  const statsWrap = document.getElementById('extre-stats');
  if(statsWrap) statsWrap.innerHTML = '';

  if(!DB.kartlar.length) {
    wrap.innerHTML = '<div class="info-box">Henüz kart eklenmedi.</div>';
    return;
  }

  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = localDateStr(today);
  const rows = DB.kartlar.map(kart => ({ kart, ozet: _extreKartTemsiliDonem(kart) }));

  // Sıralama: önce ödenmemiş (en acil son ödeme önce), sonra kayıt yok/normal
  rows.sort((a,b)=>{
    const ap = a.ozet && a.ozet.odenmemis ? 0 : 1;
    const bp = b.ozet && b.ozet.odenmemis ? 0 : 1;
    if(ap !== bp) return ap - bp;
    if(a.ozet && b.ozet) return a.ozet.period.odeme.localeCompare(b.ozet.period.odeme);
    return 0;
  });

  wrap.innerHTML = rows.map(({kart, ozet}) => {
    const renk = getKartRenk(kart);
    const banka = getBanka(kart.banka);
    const bankaObj = (DB.bankalar||[]).find(b=>b.id===kart.banka);
    const bankaIkon = bankaObj ? bankaIkonObj(bankaObj) : null;
    // Banka logosu artık kartın kendi görselinin (kc-visual) sağ üst köşesine
    // gömülü olarak gösteriliyor — önceki gibi ayrı, harici bir rozet değil.
    const bankEmbedHtml = bankaIkon
      ? `<span class="extre-kart-row-bank-embed" title="${(bankaObj.kisa||'').replace(/"/g,'&quot;')}">${bankaIkon.svg ? bankaIkon.svg : `<span style="font-size:9px;font-weight:800;color:#fff">${bankaIkon.emoji}</span>`}</span>`
      : '';
    const avatarHtml = `<div class="extre-kart-row-avatar ekp-${_ekPatternIdx(kart)}">${bankEmbedHtml}</div>`;
    if(!ozet) {
      return `<div class="extre-kart-row" style="--eks-accent:${renk}" data-kart-id="${kart.id}">
        ${avatarHtml}
        <div class="extre-kart-row-main">
          <div class="extre-kart-row-ad">${kart.ad}</div>
          <div class="extre-kart-row-sub"><span class="extre-kart-row-bank-name">${banka||''}</span></div>
        </div>
        <div class="extre-kart-row-right">
          <span style="color:var(--text3);font-size:12px">Henüz işlem yok</span>
        </div>
        <svg class="extre-kart-row-chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,4 10,8 6,12"/></svg>
      </div>`;
    }
    const { period, odenmemis, kalan, toplam, pb, coklu, isPast, isThisMonth } = ozet;
    const kalanGun = Math.ceil((new Date(period.odeme+'T00:00:00') - today) / 86400000);
    let durumEtiket, durumRenk;
    if(odenmemis) { durumEtiket = isPast ? 'ÖDENMEDİ · GEÇTİ' : 'ÖDENMEDİ'; durumRenk = 'var(--danger)'; }
    else if(isThisMonth) { durumEtiket = 'GÜNCEL DÖNEM'; durumRenk = 'var(--gold)'; }
    else { durumEtiket = 'GELECEK'; durumRenk = 'var(--teal)'; }
    const kalanStr = isPast ? 'Geçti' : kalanGun===0 ? 'Bugün' : `${kalanGun} gün kaldı`;

    // Mini kullanım barı: kartın limiti varsa güncel limit kullanım yüzdesi
    let barHtml = '';
    if(kart.limit > 0) {
      const kullanim = getKartKullanim(kart.id);
      const pct = Math.min(100, Math.round(kullanim / kart.limit * 100));
      const barRenk = pct > 90 ? 'var(--danger)' : pct > 70 ? '#f59e0b' : '#2dd4bf';
      barHtml = `<div class="extre-kart-row-bar" title="${pct}% limit kullanımı"><div class="extre-kart-row-bar-fill" style="width:${pct}%;background:${barRenk}"></div></div>`;
    }

    return `<div class="extre-kart-row${odenmemis?' is-unpaid':''}" style="--eks-accent:${renk}" data-kart-id="${kart.id}">
      ${avatarHtml}
      <div class="extre-kart-row-main">
        <div class="extre-kart-row-ad">${kart.ad}</div>
        <div class="extre-kart-row-sub"><span class="extre-kart-row-bank-name">${banka||''}</span> · ${period.label || new Date(period.year,period.month,1).toLocaleDateString('tr-TR',{year:'numeric',month:'long'})}</div>
        ${barHtml}
      </div>
      <div class="extre-kart-row-right">
        <span class="extre-kart-row-badge" style="background:color-mix(in srgb, ${durumRenk} 16%, transparent);color:${durumRenk}">${durumEtiket}</span>
        <div class="extre-kart-row-tutar">${fmtCur(odenmemis?kalan:toplam, pb)}${coklu?' <span style="font-size:9px;color:var(--text3)">+</span>':''}</div>
        <div class="extre-kart-row-meta">Son ödeme ${fmtDate(period.odeme)} · <span style="color:${isPast?'var(--danger)':kalanGun<=3?'var(--warn)':'var(--text3)'}">${kalanStr}</span></div>
      </div>
      <svg class="extre-kart-row-chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,4 10,8 6,12"/></svg>
    </div>`;
  }).join('');

  wrap.querySelectorAll('.extre-kart-row').forEach(row => {
    row.addEventListener('click', () => extreKartSec(row.getAttribute('data-kart-id')));
  });
}

export function renderExtreler() {
  // ── Kayıtlı filtre tercihlerini ilk girişte select'lere uygula ──
  restoreExtreFiltreFromDB();

  const kf = document.getElementById('extre-kart-filter');
  const kfVal = kf.value;
  kf.innerHTML = DB.kartlar.map(k=>`<option value="${k.id}">${k.ad}</option>`).join('');
  phSet(kf, 'Kart seçin…', kfVal, '— Kart bulunamadı —');

  const df = document.getElementById('extre-durum-filter');
  const dfVal = df ? df.value : '';

  const ktf = document.getElementById('extre-kategori-filter');
  const ktfVal = ktf ? ktf.value : '';

  // ── Filtre tercihlerini DB'ye yaz ve Drive'a senkronize et ──
  persistExtreFiltreToDB();

  renderExtreKartButon();
  renderExtreDurumButon();
  renderExtreKategoriButon();
  renderExtreKartModalGrid();
  renderExtreDurumModalGrid();
  renderExtreKategoriModalGrid();

  const kart = DB.kartlar.find(k=>k.id===kf.value);
  const content = document.getElementById('extre-content');
  const statsWrap = document.getElementById('extre-stats');
  const listeWrap = document.getElementById('extre-kart-liste');
  const toolbar = document.getElementById('extre-toolbar');
  const geriBtn = document.getElementById('extre-geri-btn');
  const sub = document.getElementById('extre-page-sub');

  if(!kart) {
    // Kart seçilmemiş → tüm kartların özet listesini göster (kart seçme zorunlu değil)
    if(toolbar) toolbar.style.display = 'none';
    if(geriBtn) geriBtn.style.display = 'none';
    if(content) content.innerHTML = '';
    if(sub) sub.textContent = 'Kartlarınız — ödenmemiş son ekstre varsa o, yoksa güncel dönem gösterilir';
    renderExtreKartOzetListesi();
    return;
  }

  // Bir kart seçili → detay (dönem akordeonu) görünümü
  if(toolbar) toolbar.style.display = '';
  if(geriBtn) geriBtn.style.display = 'inline-flex';
  if(listeWrap) listeWrap.innerHTML = '';
  if(sub) sub.textContent = kart.ad + ' — ekstre dönemleri ve tutarlar';

  const tatilSet = getTatilSet();
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = localDateStr(today);

  // Kartın desteklediği para birimleri
  const kartPbList = getKartCurrencies(kart.id);

  // periodMap: key(YYYY-MM) -> {key, label, extre, odeme, year, month, rowsByPb:{pb->[rows]}, totalByPb:{pb:tutar}}
  const periodMap = new Map();

  // Geniş aralık tara
  let minDate = new Date(today);
  let maxDate = new Date(today);
  DB.islemler.filter(i=>i.kart===kart.id).forEach(i=>{
    const dt = new Date(i.tarih+'T00:00:00');
    if(dt < minDate) minDate = dt;
    const lastTaksitDt = new Date(i.tarih+'T00:00:00');
    lastTaksitDt.setMonth(lastTaksitDt.getMonth() + (i.taksit||1) - 1);
    if(lastTaksitDt > maxDate) maxDate = lastTaksitDt;
  });
  const end6 = new Date(today); end6.setMonth(end6.getMonth()+6);
  if(maxDate < end6) maxDate = end6;

  const startY = minDate.getFullYear(), startM = minDate.getMonth();
  const endY   = maxDate.getFullYear(), endM   = maxDate.getMonth();

  function ensurePeriod(y, m) {
    const key = `${y}-${String(m+1).padStart(2,'0')}`;
    if(periodMap.has(key)) return key;
    const d = kartDonemHesapla(kart, y, m, tatilSet, key);
    if(!d) return null;
    const label = new Date(y,m,1).toLocaleDateString('tr-TR',{year:'numeric',month:'long'});
    periodMap.set(key, {
      key, label,
      extre: d.extre,
      odeme: d.odeme,
      odemeVarsayilan: d.odemeVarsayilan,
      ertelendi: d.ertelendi,
      year:y, month:m,
      rowsByPb: {}, totalByPb: {}
    });
    return key;
  }

  // Aylık tarama
  for(let y=startY, m=startM; y<endY||(y===endY&&m<=endM); ) {
    ensurePeriod(y, m);
    m++; if(m>11){m=0;y++;}
  }

  // İşlemleri dönemlere ve para birimlerine dağıt
  DB.islemler.filter(i=>i.kart===kart.id).forEach(islem=>{
    const islemPb = getKartCurrency(kart.id, islem.paraBirimi);
    getIslemTaksitliste(islem).forEach(tak => {
      const pd = getExtreDonemi(kart, tak.ekstreTarih);
      if(!pd) return;
      const key = ensurePeriod(pd.year, pd.month);
      if(!key) return;
      const p = periodMap.get(key);
      if(!p.rowsByPb[islemPb]) p.rowsByPb[islemPb] = [];
      p.rowsByPb[islemPb].push({
        tarih: fmtDate(islem.tarih),
        aciklama: islem.aciklama,
        taksitInfo: islem.taksit>1?`${tak.no}/${islem.taksit}`:'Peşin',
        tutar: getKartStatementAmount(kart.id, tak.tutar, islem.paraBirimi, tak.ekstreTarih || tak.tarih || islem.tarih),
        kategori: islem.kategori
      });
      p.totalByPb[islemPb] = (p.totalByPb[islemPb]||0) + getKartStatementAmount(kart.id, tak.tutar, islem.paraBirimi, tak.ekstreTarih || tak.tarih || islem.tarih);
    });
  });

  // Sadece işlem olan dönemleri al, sırala
  const periods = Array.from(periodMap.values())
    .filter(p=>Object.keys(p.rowsByPb).length>0)
    .sort((a,b)=>a.key.localeCompare(b.key));

  // Anlık kart borcu: ödeme tarihi geçmemiş (ödenmemiş) dönemlerin pb bazlı toplamı
  const kartToplamBorcByPb = {};
  Array.from(periodMap.values()).forEach(p => {
    // Ödenmemiş dönemler: odeme tarihi bugün veya gelecekte, ya da geçmişte ama ödeme kaydı yok/eksik
    Object.keys(p.totalByPb).forEach(pb => {
      const odenenTop = (DB.kartOdemeleri||[])
        .filter(o=>o.kartId===kart.id && o.paraBirimi===pb && o.donemKey===p.key)
        .reduce((s,o)=>s+o.tutar,0);
      const kalan = Math.max(0, (p.totalByPb[pb]||0) - odenenTop);
      kartToplamBorcByPb[pb] = (kartToplamBorcByPb[pb]||0) + kalan;
    });
  });

  renderExtreStatsStrip(kart, periods, kartToplamBorcByPb, todayStr, today, tatilSet);

  if(periods.length === 0) {
    content.innerHTML = '<div class="info-box">Bu kart için henüz işlem yok.</div>';
    return;
  }

  function renderExstreKart(p, pb, defaultOpen) {
    const rowsAll    = p.rowsByPb[pb] || [];
    const rows       = ktfVal ? rowsAll.filter(r=>r.kategori===ktfVal) : rowsAll;
    const toplamBorc = p.totalByPb[pb] || 0;
    const isPast     = p.odeme < todayStr;
    const isThisMonth = p.key === `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;

    let statusBadge = '';
    if(isPast)           statusBadge = `<span style="background:rgba(251,113,133,.15);color:#fb7185;border-radius:5px;padding:2px 8px;font-size:10px;font-weight:600">GEÇMİŞ</span>`;
    else if(isThisMonth) statusBadge = `<span class="exk-guncel-badge"><span class="exk-guncel-dot"></span>GÜNCEL DÖNEM</span>`;
    else                 statusBadge = `<span style="background:rgba(45,212,191,.1);color:#2dd4bf;border-radius:5px;padding:2px 8px;font-size:10px;font-weight:600">GELECEK</span>`;

    const ertelendiBadge = p.ertelendi
      ? `<span class="od-badge od-ertelendi" title="Varsayılan son ödeme: ${fmtDate(p.odemeVarsayilan)} → Yeni: ${fmtDate(p.odeme)}">↷ Ertelendi</span>`
      : '';

    // Kesinleşme durumu
    const kesin = isEkstreKesinlesmis(kart.id, p.key);
    const kesinBadge = kesin ? `<span style="background:rgba(45,212,191,.15);color:var(--teal);border-radius:5px;padding:2px 8px;font-size:10px;font-weight:600">🔒 KESİNLEŞTİ</span>` : '';
    // Kesinleştir butonu: ekstre tarihi +1 gün geçmişse ve henüz kesinleşmemişse göster
    const extreDtMs = new Date(p.extre+'T00:00:00');
    const ekstreSonrasi = new Date(extreDtMs); ekstreSonrasi.setDate(ekstreSonrasi.getDate()+1);
    const kesinlestirBtn = (!kesin && today >= ekstreSonrasi)
      ? `<button class="btn btn-ghost btn-sm exk-kesinlestir-btn" data-kart-id="${kart.id}" data-key="${p.key}" style="font-size:11px;padding:3px 10px;color:var(--teal);border-color:rgba(45,212,191,.3)">✓ Kesinleştir</button>`
      : '';

    // Para birimi rozeti — sadece kart çoklu pb destekliyorsa göster
    const pbBadge = kartPbList.length > 1
      ? `<span style="background:rgba(167,139,250,.15);color:var(--purple);border-radius:5px;padding:2px 8px;font-size:10px;font-weight:700;font-family:var(--mono)">${pb}</span>`
      : '';

    // Asgari ödeme — bu para birimi için
    const asgari = calcAsgariOdeme(kart.limit||0, toplamBorc, pb);
    const asgariBox = asgari
      ? `<div class="exk-box exk-box-asgari">
          <div class="exk-box-icon">⚠️</div>
          <div class="exk-box-label">Asgari Ödeme</div>
          <div class="exk-box-val" style="color:#f59e0b">${fmtCur(asgari.tutar, pb)}</div>
          <div class="exk-box-meta">%${asgari.oran} oran</div>
        </div>`
      : '';

    const odemeDtMs  = new Date(p.odeme+'T00:00:00');
    const kalanGun = Math.ceil((odemeDtMs - today) / 86400000);
    const kalanStr = isPast ? 'Geçti' : kalanGun === 0 ? 'Bugün!' : `${kalanGun} gün`;
    const kalanColor = isPast ? 'var(--danger)' : kalanGun <= 3 ? '#f59e0b' : 'var(--text3)';

    // Ödenmiş mi? (özet rozeti için)
    const odemelerAll = (DB.kartOdemeleri||[]).filter(o=>o.kartId===kart.id && o.paraBirimi===pb && o.donemKey===p.key);
    const odenenTopAll = odemelerAll.reduce((s,o)=>s+o.tutar,0);
    const kalanAll = Math.max(0, toplamBorc - odenenTopAll);
    const odendiBadge = kalanAll<=0 && toplamBorc>0
      ? `<span style="background:rgba(45,212,191,.15);color:#2dd4bf;border-radius:5px;padding:2px 8px;font-size:10px;font-weight:600">✓ ÖDENDİ</span>`
      : '';

    const accId = `exk-${kart.id}-${p.key}-${pb}`;
    const openCls = defaultOpen ? ' open' : '';

    return `<div class="card exk-acc-card${openCls}${isThisMonth?' exk-acc-current':''}" id="${accId}" style="margin-bottom:8px${isThisMonth?';border-color:rgba(251,191,36,.3)':''}${kesin?';border-color:rgba(45,212,191,.25)':''}">
      <div class="exk-acc-head exk-acc-toggle" data-acc-id="${accId}">
        <div class="exk-acc-left">
          <span class="exk-acc-chev">▶</span>
          <div class="exk-acc-title">${p.label}</div>
          ${pbBadge}
          ${statusBadge}
          ${odendiBadge}
          ${ertelendiBadge}
          ${kesinBadge}
          <span class="exk-acc-meta">Son ödeme: ${fmtDate(p.odeme)} · ${kalanStr}</span>
        </div>
        <div class="exk-acc-right">
          <div class="exk-acc-sum" style="color:${kalanAll<=0&&toplamBorc>0?'var(--teal)':(isPast?'var(--danger)':'var(--warn)')}">${fmtCur(toplamBorc, pb)}</div>
          ${kesinlestirBtn}
          ${!kesin ? `<button class="btn btn-ghost btn-sm exk-ozel-tarih-btn" data-key="${p.key}" style="font-size:11px;padding:3px 8px" title="Bu dönem için özel ekstre kesim tarihi belirle">📅 Özel Tarih</button>` : ''}
        </div>
      </div>
      <div class="exk-acc-body">
      <div class="exk-boxes">
        <div class="exk-box">
          <div class="exk-box-icon">✂️</div>
          <div class="exk-box-label">Ekstre Kesim</div>
          <div class="exk-box-val">${fmtDate(p.extre)}</div>
          <div class="exk-box-meta">${new Date(p.extre+'T00:00:00').toLocaleDateString('tr-TR',{weekday:'long'})}</div>
        </div>
        <div class="exk-box${isPast?' exk-box-past':kalanGun<=3&&!isPast?' exk-box-urgent':' exk-box-ok'}">
          <div class="exk-box-icon">💳</div>
          <div class="exk-box-label">Son Ödeme</div>
          <div class="exk-box-val">${fmtDate(p.odeme)}</div>
          <div class="exk-box-meta" style="color:${kalanColor}">${new Date(p.odeme+'T00:00:00').toLocaleDateString('tr-TR',{weekday:'long'})} · ${kalanStr}${p.ertelendi?` · <span style="color:var(--warn)">Eski: ${fmtDate(p.odemeVarsayilan)}</span>`:''}</div>
        </div>
        ${asgariBox}
        ${kart.limit > 0 ? (()=>{ const kb = kartToplamBorcByPb[pb]||0; const kbPct = Math.min(100,Math.round(kb/kart.limit*100)); return `<div class="exk-box">
          <div class="exk-box-icon">📊</div>
          <div class="exk-box-label">Limit Kullanımı</div>
          <div class="exk-box-val">${kbPct}%</div>
          <div class="exk-box-meta">${fmtCur(kart.limit - kb, pb)} boş</div>
          <div class="exk-box-bar"><div class="exk-box-bar-fill" style="width:${kbPct}%;background:${kb/kart.limit>0.9?'var(--danger)':kb/kart.limit>0.7?'#f59e0b':'#2dd4bf'}"></div></div>
        </div>`; })() : ''}
      </div>
      <div class="exr-tx-head"><span>Tarih</span><span>Açıklama</span><span>Taksit</span><span>Tutar</span></div>
      <div class="exr-tx-list">${rows.map(r=>`<div class="exr-tx-row">
          <div class="exr-tx-date">${r.tarih}</div>
          <div class="exr-tx-desc" title="${(r.aciklama||'').replace(/"/g,'&quot;')}">${r.aciklama||'—'}</div>
          <div class="exr-tx-taksit"><span class="badge ${r.taksitInfo==='Peşin'?'badge-blue':'badge-warn'}">${r.taksitInfo}</span></div>
          <div class="exr-tx-amount">${fmtCur(r.tutar, pb)}</div>
        </div>`).join('')}</div>
      <div class="exr-tx-total">
        <span class="exr-tx-total-label">Dönem Borcu</span>
        <span class="exr-tx-total-val">${fmtCur(toplamBorc, pb)}</span>
      </div>
      <!-- Ödemeler -->
      ${(()=>{
        const odemeler = odemelerAll;
        const odenenTop = odenenTopAll;
        const kalan = kalanAll;
        const odemelerHtml = odemeler.length ? `
          <div style="padding:8px 16px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:4px">
            ${odemeler.map(o=>`
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px">
                <span style="color:var(--text2)">✓ ${fmtDate(o.tarih)}${o.not?' · '+o.not:''}</span>
                <div style="display:flex;align-items:center;gap:8px">
                  <span class="mono" style="color:var(--teal)">${fmtCur(o.tutar, pb)}</span>
                  <button class="btn btn-ghost btn-sm exk-odeme-sil-btn" data-odeme-id="${o.id}" style="padding:1px 6px;font-size:10px;color:var(--danger)">✕</button>
                </div>
              </div>`).join('')}
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:2px;padding-top:6px;border-top:1px solid var(--border)">
              <span style="color:var(--text3)">Kalan</span>
              <span class="mono" style="color:${kalan<=0?'var(--teal)':'var(--warn)'};font-weight:600">${fmtCur(kalan, pb)}</span>
            </div>
          </div>` : '';
        return `${odemelerHtml}
          <div style="padding:10px 16px;border-top:1px solid var(--border);display:flex;justify-content:flex-end">
            <button class="btn btn-primary btn-sm exk-borc-ode-btn" data-kart-id="${kart.id}" data-pb="${pb}" data-key="${p.key}" data-toplam-borc="${toplamBorc}" data-kalan="${kalan}" data-odeme="${p.odeme}">
              💳 Borç Öde
            </button>
          </div>`;
      })()}
      </div>
    </div>`;
  }

  const cards = [];
  periods.forEach(p => {
    // Dönemdeki para birimlerini kartın tanımlı sırasına göre sırala
    const pbsInPeriod = kartPbList.filter(pb => p.rowsByPb[pb] && p.rowsByPb[pb].length > 0);
    const isThisMonth = p.key === `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
    const isPastPeriod = p.odeme < todayStr;
    const durum = isThisMonth ? 'guncel' : (isPastPeriod ? 'gecmis' : 'gelecek');
    if(dfVal && dfVal !== durum) return;
    pbsInPeriod.forEach(pb => {
      // Kategori filtresi aktifse ve bu dönem+para biriminde o kategoriye ait hiç işlem yoksa atla
      if(ktfVal && !(p.rowsByPb[pb]||[]).some(r=>r.kategori===ktfVal)) return;
      const toplamBorc = p.totalByPb[pb] || 0;
      const odenenTop = (DB.kartOdemeleri||[]).filter(o=>o.kartId===kart.id && o.paraBirimi===pb && o.donemKey===p.key).reduce((s,o)=>s+o.tutar,0);
      const kalan = Math.max(0, toplamBorc - odenenTop);
      const isPast = p.odeme < todayStr;
      // Varsayılan açık: güncel ay, veya ödenmemiş geçmiş dönem
      const defaultOpen = isThisMonth || (isPast && kalan > 0);
      cards.push(renderExstreKart(p, pb, defaultOpen));
    });
  });

  // En güncel/önemli dönemler üstte: tarihe göre ters sırala (en yeni en üstte)
  // periods zaten kronolojik sıralı geldiği için cards'ı ters çeviriyoruz
  cards.reverse();

  if(cards.length === 0) {
    content.innerHTML = '<div class="info-box">Seçilen filtreye uyan ekstre dönemi bulunamadı.</div>';
    return;
  }

  content.innerHTML = `<div style="margin-bottom:10px;font-size:11px;color:var(--text3)">${cards.length} dönem · başlığa tıklayarak detayları aç/kapat</div>` + cards.join('');

  // [ES module] onclick="document.getElementById(...).classList.toggle('open')",
  // onclick="kesinlestirEkstre(...)", onclick="openOzelExtreModal(...)",
  // onclick="deleteKartOdeme(...)", onclick="odAcPopupKart(...)" kaldırıldı -
  // gerçek addEventListener bağlanıyor.
  content.querySelectorAll('.exk-acc-toggle').forEach(head => {
    head.addEventListener('click', () => {
      document.getElementById(head.getAttribute('data-acc-id')).classList.toggle('open');
    });
  });
  content.querySelectorAll('.exk-kesinlestir-btn').forEach(btn => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      kesinlestirEkstre(btn.getAttribute('data-kart-id'), btn.getAttribute('data-key'));
    });
  });
  content.querySelectorAll('.exk-ozel-tarih-btn').forEach(btn => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      openOzelExtreModal(btn.getAttribute('data-key'));
    });
  });
  content.querySelectorAll('.exk-odeme-sil-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteKartOdeme(btn.getAttribute('data-odeme-id')));
  });
  content.querySelectorAll('.exk-borc-ode-btn').forEach(btn => {
    btn.addEventListener('click', () => odAcPopupKart(
      btn.getAttribute('data-kart-id'),
      btn.getAttribute('data-pb'),
      btn.getAttribute('data-key'),
      parseFloat(btn.getAttribute('data-toplam-borc')),
      parseFloat(btn.getAttribute('data-kalan')),
      btn.getAttribute('data-odeme')
    ));
  });
}

// ── Ekstreler Kart Seçim Modalı ──────────────────────────────────

export function openExtreKartModal() {
  renderExtreKartModalGrid();
  openModal('modal-extre-kart');
}

export function renderExtreKartButon() {
  const kf = document.getElementById('extre-kart-filter');
  const label = document.getElementById('extre-kart-btn-label');
  if(!label) return;
  const kart = DB.kartlar.find(k=>k.id===kf.value);
  label.textContent = kart ? kart.ad : 'Kart Seçin';
  const btn = document.getElementById('extre-kart-btn');
  if(btn) btn.classList.toggle('is-active', !!kart);
}

export function renderExtreKartModalGrid() {
  const grid = document.getElementById('extre-kart-modal-grid');
  if(!grid) return;
  const kf = document.getElementById('extre-kart-filter');
  if(!DB.kartlar.length) { grid.innerHTML = '<div class="info-box" style="margin:0">Henüz kart eklenmedi.</div>'; return; }
  grid.innerHTML = DB.kartlar.map(k=>`<button type="button" class="chip-select-opt${kf.value===k.id?' active':''}" data-val="${k.id}"><span class="chip-dot" style="background:${getKartRenk(k)}"></span>${k.ad}</button>`).join('');
  grid.querySelectorAll('.chip-select-opt').forEach(btn=>{
    btn.onclick = () => {
      kf.value = btn.dataset.val;
      renderExtreler();
      closeModal('modal-extre-kart');
    };
  });
}

// ── Ekstreler Dönem Filtre Modalı ────────────────────────────────

export function openExtreDurumModal() {
  renderExtreDurumModalGrid();
  openModal('modal-extre-durum');
}

export function renderExtreDurumButon() {
  const df = document.getElementById('extre-durum-filter');
  const label = document.getElementById('extre-durum-btn-label');
  if(!label) return;
  const labels = {'':'Tüm Dönemler', 'gecmis':'Geçmiş', 'guncel':'Güncel', 'gelecek':'Gelecek'};
  label.textContent = labels[df.value] || 'Tüm Dönemler';
  const btn = document.getElementById('extre-durum-btn');
  if(btn) btn.classList.toggle('is-active', !!df.value);
}

export function renderExtreDurumModalGrid() {
  const grid = document.getElementById('extre-durum-modal-grid');
  if(!grid) return;
  const df = document.getElementById('extre-durum-filter');
  grid.querySelectorAll('.chip-select-opt').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.val === (df.value||''));
    btn.onclick = () => {
      df.value = btn.dataset.val;
      renderExtreler();
      closeModal('modal-extre-durum');
    };
  });
}

// ── Ekstreler Kategori Filtre Modalı ─────────────────────────────

export function openExtreKategoriModal() {
  renderExtreKategoriModalGrid();
  openModal('modal-extre-kategori');
}

export function renderExtreKategoriButon() {
  const ktf = document.getElementById('extre-kategori-filter');
  const label = document.getElementById('extre-kategori-btn-label');
  if(!label || !ktf) return;
  const kat = (DB.kategoriler||[]).find(k=>k.id===ktf.value);
  label.textContent = kat ? `${kat.ikon||'🏷️'} ${kat.ad}` : 'Tüm Kategoriler';
  const btn = document.getElementById('extre-kategori-btn');
  if(btn) btn.classList.toggle('is-active', !!ktf.value);
}

export function renderExtreKategoriModalGrid() {
  const grid = document.getElementById('extre-kategori-modal-grid');
  if(!grid) return;
  const ktf = document.getElementById('extre-kategori-filter');
  const kategoriler = DB.kategoriler || [];
  if(!kategoriler.length) { grid.innerHTML = '<div class="info-box" style="margin:0">Henüz kategori tanımlanmadı.</div>'; return; }
  const temizBtn = `<button type="button" class="chip-select-opt${!ktf.value?' active':''}" data-val="">Tüm Kategoriler</button>`;
  const katBtns = kategoriler.map(k=>`<button type="button" class="chip-select-opt${ktf.value===k.id?' active':''}" data-val="${k.id}">${k.ikon||'🏷️'} ${k.ad}</button>`).join('');
  grid.innerHTML = temizBtn + katBtns;
  grid.querySelectorAll('.chip-select-opt').forEach(btn=>{
    btn.onclick = () => {
      ktf.value = btn.dataset.val;
      renderExtreler();
      closeModal('modal-extre-kategori');
    };
  });
}

// Ekstreler sayfası üst kısmındaki kompakt özet şeridi (seçili kart için)

export function renderExtreStatsStrip(kart, periods, kartToplamBorcByPb, todayStr, today, tatilSet) {
  const wrap = document.getElementById('extre-stats');
  if(!wrap) return;

  const totalStr = Object.keys(kartToplamBorcByPb).length
    ? Object.entries(kartToplamBorcByPb).map(([c,v])=>fmtCur(v,c)).join(' + ')
    : '—';

  // Limit kullanımı (ilk para birimi üzerinden, kartın limiti tek pb varsayımıyla)
  let limitStr = '—', limitPct = null;
  if(kart.limit > 0) {
    const pbAna = Object.keys(kartToplamBorcByPb)[0];
    const kb = pbAna ? (kartToplamBorcByPb[pbAna]||0) : 0;
    limitPct = Math.min(100, Math.round(kb / kart.limit * 100));
    limitStr = limitPct + '%';
  }

  // En yakın gelecek ödeme tarihi
  let nearestOdeme = null;
  periods.forEach(p => {
    const odemeDt = new Date(p.odeme+'T00:00:00');
    if(odemeDt >= today && (!nearestOdeme || odemeDt < nearestOdeme)) nearestOdeme = odemeDt;
  });

  const donemSayisi = periods.length;

  wrap.innerHTML = `
    <div class="islem-chip c-warn">
      <div class="islem-chip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
      <div class="islem-chip-body"><div class="islem-chip-label">Toplam Borç</div><div class="islem-chip-val">${totalStr}</div></div>
    </div>
    <div class="islem-chip c-teal">
      <div class="islem-chip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg></div>
      <div class="islem-chip-body"><div class="islem-chip-label">Limit Kullanımı</div><div class="islem-chip-val">${limitStr}</div></div>
    </div>
    <div class="islem-chip c-rose">
      <div class="islem-chip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
      <div class="islem-chip-body"><div class="islem-chip-label">Yaklaşan Ödeme</div><div class="islem-chip-val" style="font-size:13px">${nearestOdeme?fmtDate(localDateStr(nearestOdeme)):'—'}</div></div>
    </div>
    <div class="islem-chip c-gold">
      <div class="islem-chip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
      <div class="islem-chip-body"><div class="islem-chip-label">Ekstre Dönemi</div><div class="islem-chip-val">${donemSayisi}</div></div>
    </div>
  `;
}

// ---- (2. tur refactor: 02-core-app-engine.js'den taşındı) ----
// ── Ekstreler filtre tercihlerini DB.uiFiltreler.extreler ile senkronize et ──
export var _extreFiltreRestored = false;

// ========== KATEGORİLER ==========
export var _katFilter = '';

export var _katFiltreRestored = false;

// ==== dağıtım: js/07-ekstre-eslestir-pdf.js içeriği taşındı (ekstre eslestir pdf + chip/popup componentleri) ====

// ═══════════════════════════════════════════════════════════════
// ═══ EKSTRE EŞLEŞTİRME (PDF → Sistem işlem karşılaştırma) ═══════
// ═══════════════════════════════════════════════════════════════

export let EE_STATE = {
  kartId: null,
  _pendingKartId: null, // kullanıcı dropdown'dan seçti ama henüz onaylamadı — Drive sync'ten korunur
  pdfIslemler: [],   // PDF'den çıkarılan: {tarih, aciklama, tutar, _key, _kaynak}
  eslesen: [],       // {pdf, sistem, kategoriSecim, aciklamaSecim}
  sadecePdf: [],      // pdf'de var, sistemde yok
  sadeceSistem: [],   // sistemde var, pdf'de yok
  dosyalar: [],       // [{ad, durum: 'ok'|'hata'|'isleniyor', sayi, hata}]
  kartOnayGosteriliyor: false,       // kart onay kutusu görünür mü
  kartAutoDetectGosteriliyor: false, // otomatik tespit satırı görünür mü (detected alt-panel)
  kartPickerGosteriliyor: false,     // manuel kart seçici görünür mü (picker alt-panel)
  sonuclarGosteriliyor: false,       // eşleştirme sonuçları açık mı
};

// [ES module] Bu dosyada tanımlanan aşağıdaki değişkenler başka dosyalarda
// yeniden atanıyordu (import edilen bir binding'e doğrudan atama ES
// module'de yasaktır). Bu setter fonksiyonları o davranışı korumak için
// eklendi - ilgili dosyalar artık `X = v` yerine `setX(v)` çağırıyor.
export function setEE_STATE(v) { EE_STATE = v; }
export function set_katFilter(v) { _katFilter = v; }
export function set_extreFiltreRestored(v) { _extreFiltreRestored = v; }
export function set_katFiltreRestored(v) { _katFiltreRestored = v; }

// [ES module] taban render fonksiyonu(ları) odeme/patches zincirinin
// hook() ile sarmalayabilmesi için wrap-registry'ye kaydediliyor.
register('renderExtreler', renderExtreler);
