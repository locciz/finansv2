import { escapeHtml, fmtCur, fmtDate, localDateStr } from '@core/format.js';
import { CURRENCY_CONFIG, DB, defaultCurrency } from '@core/state.js';
import { pbRenkAl } from '@domain/doviz.js';
import { getKrediKalanBorc } from '@domain/hesaplamalar.js';
import { kartAltyapiLogoHtml } from '@components/select-to-chips.js';
import { tblSiralamaOku, tblSiralamaUygula } from '@components/tablo-filtre-sirala.js';
import { getKart, getKartKullanilabilirLimit, getKartKullanim, getKartRenk, getKartToplamLimit, kartAktifDonemBul, kartAltyapiRenk, editKart, deleteKart } from '@pages/kartlar/01-kart-data.js';
import { kd2RenderOzetBanner } from '@pages/kartlar/05-kart-detay-v2.js';
import { getOrtakGrupKullanim, openOrtakGrupModal } from '@pages/kartlar/07-ortak-limit-grubu.js';
import { _kd2KartId, bindKartlarToolbarEvents, kartAramaText, kartlarFiltreMatch, kartlarFiltreOku, kartlarSeciliSiralamaKaydir, kartlarToolbarHtml } from '@pages/kartlar/09-kart-altyapi.js';
import { bankaIkonObj, getBanka, getTatilSet, urunTipiRenk } from '@pages/tanimlamalar/01-genel-yardimcilar.js';
import { gotoKartIslemleri } from '@pages/kartlar/03-kart-detay-ortak.js';
import { register } from '@core/wrap-registry.js';
// ============================================================
// js/ui/pages/kartlar/10-kart-liste.js
// Ana kart listesi render fonksiyonu
//
// Bu dosya, eskiden tek parça olan js/ui/pages/kartlar.js (145
// export, 3600+ satır) dosyasının, fonksiyon isim/işlev
// kümelerine göre bölünmüş bir parçasıdır. Kod SATIR SATIR
// AYNI kaldı — sadece dosya sınırı ve gruplama değişti.
// ============================================================
export function renderKartlar(opts) {
  // opts.skipToolbar: true ise toolbar (arama input'u dahil) DOM'da olduğu
  // gibi bırakılır, sadece kart listesi yeniden hesaplanır. Arama kutusuna
  // her karakter yazıldığında toolbar'ın tamamını innerHTML ile basmak,
  // input elementini yok edip yeniden yaratıyordu — bu da her tuşta
  // focus'un (ve imleç konumunun) kaybolmasına sebep oluyordu. Sıralama/
  // durum-chip'i değiştiğinde toolbar'ın da güncellenmesi gerektiği için
  // varsayılan davranış (opts verilmezse) hâlâ toolbar'ı da basıyor.
  const skipToolbar = !!(opts && opts.skipToolbar);
  // Kart detay tam sayfa açıksa banner'ı güncelle
  if (_kd2KartId) {
    const k = getKart(_kd2KartId);
    if (k) kd2RenderOzetBanner(k, getKartRenk(k));
  }
  const el = document.getElementById('kartlar-list');
  if(!DB.kartlar.length) { el.innerHTML='<div class="info-box">Henüz kart eklenmedi.</div>'; const _sb=document.getElementById('kartlar-siralama-bar'); if(_sb && !skipToolbar) _sb.innerHTML=''; return; }
  const tatilSet = getTatilSet();
  const today = new Date(); today.setHours(0,0,0,0);
  const kmhTip = DB.urunTipler.find(t=>t.kod==='KMH');

  // Kart bazlı türetilmiş değerleri önden hesapla (sıralama kriterleri bunları kullanır)
  const kartlarData = DB.kartlar.map(k=>{
    const kullanim = getKartKullanim(k.id);
    const musait = getKartKullanilabilirLimit(k.id);
    const toplamLimit = getKartToplamLimit(k.id);
    const grupKullanimGosterim = k.ortakLimitGrupId ? getOrtakGrupKullanim(k.ortakLimitGrupId) : kullanim;
    const pct = toplamLimit > 0 ? Math.min(100, grupKullanimGosterim / toplamLimit * 100) : 0;
    const _donem = kartAktifDonemBul(k, today, tatilSet);
    return { k, kullanim, musait, toplamLimit, grupKullanimGosterim, pct, extreDt: _donem.extre, odemeDt: _donem.odeme };
  });

  // ── Arama + Durum filtresi + Sıralama (diğer sayfalarla aynı ortak toolbar yapısı) ──
  const _kartlarFiltre = kartlarFiltreOku();
  const _kartlarAktifSirala = tblSiralamaOku('kartlar', 'ad', 'asc');
  if(!skipToolbar) {
    const _kartlarSayac = {
      tumu: kartlarData.length,
      aktif: kartlarData.filter(x => (x.k.durum || 'aktif') !== 'pasif').length,
      pasif: kartlarData.filter(x => (x.k.durum || 'aktif') === 'pasif').length
    };
    const kartlarSiralamaBarEl = document.getElementById('kartlar-siralama-bar');
    if(kartlarSiralamaBarEl) {
      kartlarSiralamaBarEl.innerHTML = kartlarToolbarHtml(_kartlarAktifSirala, _kartlarFiltre, _kartlarSayac);
      bindKartlarToolbarEvents(kartlarSiralamaBarEl);
    }
  }
  const kartlarFiltreli = kartlarData.filter(x => kartlarFiltreMatch(x, _kartlarFiltre));
  const kartlarSirali = tblSiralamaUygula(kartlarFiltreli, _kartlarAktifSirala, {
    ad: (a,b)=>a.k.ad.localeCompare(b.k.ad,'tr'),
    musait: (a,b)=>a.musait-b.musait,
    limit: (a,b)=>a.toplamLimit-b.toplamLimit,
    kullanim: (a,b)=>a.pct-b.pct,
    ekstre: (a,b)=>(a.extreDt?a.extreDt.getTime():0)-(b.extreDt?b.extreDt.getTime():0),
    odeme: (a,b)=>(a.odemeDt?a.odemeDt.getTime():0)-(b.odemeDt?b.odemeDt.getTime():0)
  });

  if(!kartlarSirali.length) {
    el.innerHTML = '<div class="info-box">Seçili arama veya filtreye uyan kart bulunamadı.</div>';
    kartlarSeciliSiralamaKaydir(false);
    return;
  }

  el.innerHTML = kartlarSirali.map(({k, kullanim, musait, toplamLimit, grupKullanimGosterim, pct, extreDt, odemeDt})=>{
    const banka = getBanka(k.banka);
    const bankaObj = (DB.bankalar||[]).find(b=>b.id===k.banka) || null;
    const bankaIkon = bankaIkonObj(bankaObj);
    const bankaLogoKart = bankaObj ? (bankaIkon.svg ? `<span class="kart-card-bank-logo bank-logo">${bankaIkon.svg}</span>` : `<span class="kart-card-bank-logo bank-logo" style="color:${bankaIkon.renk}">${bankaIkon.emoji}</span>`) : '';
    const kartPasif = (k.durum || 'aktif') === 'pasif';
    const tip = DB.urunTipler.find(t=>t.id===k.tip);
    const pctColor = pct>80?'var(--danger)':pct>50?'var(--warn)':'var(--accent2)';

    // KMH ek bilgi
    const isKmh = kmhTip && k.tip===kmhTip.id;
    const krediKalan = isKmh ? (DB.krediler||[]).filter(kr=>kr.kmhId===k.id).reduce((s,kr)=>s+getKrediKalanBorc(kr),0) : 0;
    const krediSayisi = isKmh ? (DB.krediler||[]).filter(kr=>kr.kmhId===k.id && getKrediKalanBorc(kr)>0).length : 0;

    // Kart altyapısı (Visa/Mastercard/Troy vb.)
    const altyapi = (DB.kartAltyapilari||[]).find(a=>a.id===k.altyapiId);

    // Son ödeme yaklaşma durumu
    const todayStr0 = localDateStr(today);
    const odemeStr = odemeDt ? localDateStr(odemeDt) : null;
    const kalanGun = odemeStr ? Math.ceil((new Date(odemeStr+'T00:00:00') - today) / 86400000) : null;
    const odemeUrgent = kalanGun !== null && kalanGun <= 3;
    const odemePast = odemeStr !== null && odemeStr < todayStr0;

    const _kartAramaText = kartAramaText({k, banka, tip, altyapi});
    return `<div class="card kart-card-item" data-kart-id="${k.id}" data-kart-durum="${kartPasif ? 'pasif' : 'aktif'}" data-kart-search="${escapeHtml(_kartAramaText)}" style="border-top:3px solid ${getKartRenk(k)};--kart-accent:${getKartRenk(k)};cursor:pointer" title="Kart detayına gir">
      <div class="kart-vplate">
        <div class="kart-vplate-top">
          <span class="kart-vplate-chip"></span>
          <span class="kart-vplate-net">${kartAltyapiLogoHtml(altyapi) || (altyapi ? altyapi.ad : (tip ? tip.ad : ''))}</span>
          ${bankaLogoKart}
        </div>
        <div class="kart-vplate-num">•••• •••• •••• ${k.no || '••••'}</div>
      </div>
      <div class="card-header">
        <div style="min-width:0;flex:1;overflow:hidden">
          <div style="font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${k.ad}">${k.ad}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${banka} · ${tip?tip.ad:''} ${k.no?'·· '+k.no:''}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;margin-left:8px">
          <button class="btn btn-ghost btn-sm btn-act kart-edit-btn" data-id="${k.id}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/></svg></button>
          <button class="btn btn-danger btn-sm btn-act kart-del-btn" data-id="${k.id}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><polyline points="3,5 13,5"/><path d="M6 5V3h4v2M5 5l1 9h4l1-9"/></svg></button>
        </div>
      </div>
      <div style="margin-bottom:6px;display:flex;gap:4px;flex-wrap:wrap;min-height:22px">
        ${(()=>{ const curs = (k.paraBirimleri&&k.paraBirimleri.length)?k.paraBirimleri:(k.paraBirimi?[k.paraBirimi]:[defaultCurrency]); return curs.map(c=>{ const isDef = c===(k.varsayilanParaBirimi||curs[0]); const pbR = pbRenkAl(c); return `<span style="background:${pbR.bg};color:${pbR.text};border:1px solid ${pbR.border};border-radius:4px;padding:2px 8px;font-size:10px;font-weight:600">${CURRENCY_CONFIG[c]?.symbol||''} ${c}${curs.length>1&&isDef?' ⭐':''}</span>`; }).join(''); })()}
        ${tip ? (()=>{ const r = urunTipiRenk(tip.id); return `<span class="badge" style="background:${r}1f;color:${r};border:1px solid ${r}55">${tip.ad}</span>`; })() : ''}
        ${altyapi ? (()=>{ const r = kartAltyapiRenk(altyapi.id); return `<span class="kart-altyapi-chip" style="background:${r}1f;color:${r}">${kartAltyapiLogoHtml(altyapi) || ''}${altyapi.ad}</span>`; })() : ''}
        <span class="badge ${kartPasif ? 'badge-gray' : 'badge-green'}">${kartPasif ? 'Pasif' : 'Aktif'}</span>
        ${(()=>{
          const g = k.ortakLimitGrupId && (DB.ortakLimitGruplari||[]).find(x=>x.id===k.ortakLimitGrupId);
          if(!g) return '';
          const uyeSayisi = (DB.kartlar||[]).filter(x=>x.ortakLimitGrupId===g.id).length;
          return `<span class="ortak-grup-chip" data-grup-id="${g.id}" title="${g.ad} grubunu düzenle"><span class="ortak-grup-chip-icon">🔗</span><span class="ortak-grup-chip-text">${g.ad}</span><span class="ortak-grup-chip-count">${uyeSayisi}</span></span>`;
        })()}
      </div>
      <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px">
        <div style="min-width:0;overflow:hidden">
          <div style="font-size:10px;color:var(--text3)">${k.ortakLimitGrupId ? 'Grup Kullanımı' : 'Kullanımda'}</div>
          <div class="mono" style="font-size:16px;color:var(--warn);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${fmtCur(grupKullanimGosterim, 'TRY')}</div>
          ${k.ortakLimitGrupId ? `<div style="font-size:9.5px;color:var(--text3);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">bu kart: ${fmtCur(kullanim, 'TRY')}</div>` : ''}
        </div>
        <div style="text-align:right;min-width:0;overflow:hidden"><div style="font-size:10px;color:var(--text3)">Kullanılabilir Limit</div><div class="mono" style="font-size:16px;color:var(--accent2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${fmtCur(musait, 'TRY')}</div></div>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${pctColor}"></div></div>
      <div style="font-size:10px;color:var(--text3);text-align:right;margin-top:2px">${k.ortakLimitGrupId ? 'Grup Limiti' : 'Toplam Limit'}: ${fmtCur(toplamLimit, 'TRY')}</div>
      ${isKmh && krediSayisi > 0 ? `<div style="margin-top:8px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);border-radius:6px;padding:7px 10px;font-size:11px;display:flex;justify-content:space-between">
        <span style="color:var(--text3)">🏦 ${krediSayisi} aktif kredi borcu</span>
        <span class="mono" style="color:var(--danger)">${fmtCur(krediKalan, 'TRY')}</span>
      </div>` : ''}
      <div class="kart-extre-footer">
        <div class="kart-extre-box">
          <div class="kart-extre-icon">✂️</div>
          <div class="kart-extre-meta">
            <div class="kart-extre-label">Ekstre Kesim</div>
            <div class="kart-extre-val">${extreDt?fmtDate(extreDt):'-'}</div>
          </div>
        </div>
        <div class="kart-extre-box${odemePast?' urgent':odemeUrgent?' urgent':''}">
          <div class="kart-extre-icon">💳</div>
          <div class="kart-extre-meta">
            <div class="kart-extre-label">Son Ödeme</div>
            <div class="kart-extre-val">${odemeDt?fmtDate(odemeDt):'-'}</div>
            ${kalanGun!==null?`<div class="kart-extre-sub" style="color:${odemePast?'var(--danger)':odemeUrgent?'#f59e0b':'var(--text3)'}">${odemePast?'Geçti':kalanGun===0?'Bugün!':kalanGun+' gün kaldı'}</div>`:''}
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
  // [ES module] onclick="gotoKartIslemleri(...)", onclick="editKart(...)",
  // onclick="deleteKart(...)", onclick="openOrtakGrupModal(...)" kaldırıldı.
  el.querySelectorAll('.kart-card-item').forEach(card => {
    card.addEventListener('click', () => gotoKartIslemleri(card.getAttribute('data-kart-id')));
  });
  el.querySelectorAll('.kart-edit-btn').forEach(btn => {
    btn.addEventListener('click', (event) => { event.stopPropagation(); editKart(btn.getAttribute('data-id')); });
  });
  el.querySelectorAll('.kart-del-btn').forEach(btn => {
    btn.addEventListener('click', (event) => { event.stopPropagation(); deleteKart(btn.getAttribute('data-id')); });
  });
  el.querySelectorAll('.ortak-grup-chip').forEach(chip => {
    chip.addEventListener('click', (event) => { event.stopPropagation(); openOrtakGrupModal(chip.getAttribute('data-grup-id')); });
  });
}

// [ES module] taban render fonksiyonu(ları) odeme/patches zincirinin
// hook() ile sarmalayabilmesi için wrap-registry'ye kaydediliyor.
register('renderKartlar', renderKartlar);
