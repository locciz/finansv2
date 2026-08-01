import { tblFiltreOkuMulti, filterHesap } from '@core/app-core.js';
import { fmt, fmtCur } from '@core/format.js';
import { DB } from '@core/state.js';
import { pbRenkAl } from '@domain/doviz.js';
import { _bankaFiltrePopupItems, openMfFiltrePopup } from '@components/mf-popup.js';
import { hesapBakiyeDurumTespit, renderBakiyeIzlemePanel } from '@components/mobile-nav-tema/03-bakiye-izleme-paneli.js';
import { _restoreHesapFiltreFromDB, bindTblFiltreChips, tblBankaFiltrePopupBtnHtml, tblFiltreChipsHtml, tblFiltreClearHtml, tblSiralamaAyarla, tblSiralamaBarHtml, tblSiralamaOku, tblSiralamaUygula } from '@components/tablo-filtre-sirala.js';
import { HESAP_DURUM_BADGE } from '@pages/hesaplar/00-state.js';
import { bankaIkonObj, getBanka, getHesapTurBadge, getHesapTurDotIkon, getHesapTurLabel } from '@pages/tanimlamalar/01-genel-yardimcilar.js';
import { getSubeAdFromKodlar } from '@pages/tanimlamalar/08-subeler.js';
import { openNakitLogModal, openHesapLogModal } from '@pages/hesaplar/06-hesap-log.js';
import { vadeliyeKoy, gunlukVadeliyeKoy } from '@pages/mevduat/02-mevduat-vadeliye-koyma.js';
import { openTransferModal } from '@components/transfer-modal.js';
import { openHesapModal, deleteHesap } from '@pages/hesaplar/03-hesap-form-crud.js';
import { showToast } from '@components/modal-genel.js';
import { register } from '@core/wrap-registry.js';
// ============================================================
// js/ui/pages/hesaplar/04-hesap-liste-render.js
// Hesap listesi render + filtreleme/sıralama
//
// Bu dosya, eskiden tek parça olan js/ui/pages/hesaplar.js
// (49 export, 991 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function renderHesapTurFiltreler() {
  _restoreHesapFiltreFromDB();
  const wrap = document.getElementById('hesap-filtre-wrap');
  if(!wrap) return;
  const turler = DB.hesapTurleri || [];
  const opts = [{value:'', label:'◆ Tümü'}]
    .concat(turler.map(t=>({value:t.kod, label:getHesapTurDotIkon(t.kod)+t.ad})))
    .concat([{value:'kmh', label:'💳 KMH Limiti'}]);
  const turHtml = tblFiltreChipsHtml('TÜR', opts, hesapFiltre, 'filterHesap') + tblFiltreClearHtml(hesapFiltre, 'filterHesap');

  // Banka filtresi — popup + çoklu seçim (chip listesine sığmayacak kadar çok banka olabileceği için)
  const _hesapBankaFiltre = tblFiltreOkuMulti('hesaplar', 'banka');
  const bankaIdSet = [...new Set((DB.hesaplar||[]).map(h=>h.banka).filter(Boolean))];
  const bankaHtml = bankaIdSet.length
    ? `<div class="tbl-filtre-grup">${tblBankaFiltrePopupBtnHtml('hesaplar', _hesapBankaFiltre, 'openHesaplarBankaFiltrePopup', 'renderHesaplar')}</div>`
    : '';

  wrap.innerHTML = turHtml + bankaHtml;
  // [ES module] onclick="filterHesap(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
  // filterHesap artık app-core.js'de gerçek `export function` (bkz. import).
  // "Temizle" ve banka popup butonu (openHesaplarBankaFiltrePopup + __bankaFiltreTemizle) da bağlanıyor.
  bindTblFiltreChips(wrap, {
    filterHesap: (v) => filterHesap(v),
    openHesaplarBankaFiltrePopup,
    renderHesaplar
  });
}

export function openHesaplarBankaFiltrePopup(triggerEl) {
  const idler = [...new Set((DB.hesaplar||[]).map(h=>h.banka).filter(Boolean))];
  openMfFiltrePopup('hesaplar', 'banka', 'Banka Filtrele', _bankaFiltrePopupItems(idler), renderHesaplar, triggerEl);
}

export function hesaplarSirala(key, yon) {
  tblSiralamaAyarla('hesaplar', key, yon);
  renderHesaplar();
}

export function renderHesaplar() {
  if(!DB.hesaplar) DB.hesaplar = [];
  renderHesapTurFiltreler();
  renderBakiyeIzlemePanel();
  const _hesapBankaFiltre = tblFiltreOkuMulti('hesaplar', 'banka');
  // ── Sıralama (DB.uiSiralama.hesaplar içinde kalıcı) ──
  const _hesapAktifSirala = tblSiralamaOku('hesaplar', 'varsayilan', 'asc');
  const hesapSiralamaBarEl = document.getElementById('hesap-siralama-bar');
  if(hesapSiralamaBarEl) {
    hesapSiralamaBarEl.innerHTML = tblSiralamaBarHtml([
      {key:'bakiye', label:'Bakiye', ikon:'tutar', yon:'desc'},
      {key:'banka', label:'Banka', ikon:'banka', yon:'asc'},
      {key:'ad', label:'Hesap Adı', ikon:'harf', yon:'asc'},
      {key:'tur', label:'Tür', ikon:'tur', yon:'asc'}
    ], _hesapAktifSirala, 'hesaplarSirala');
    // [ES module] onclick="hesaplarSirala(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
    bindTblFiltreChips(hesapSiralamaBarEl, { hesaplarSirala });
  }
  const hesapSirali = tblSiralamaUygula(DB.hesaplar, _hesapAktifSirala, {
    bakiye: (a,b)=>(a.bakiye||0)-(b.bakiye||0),
    banka: (a,b)=>String(getBanka(a.banka)||'').localeCompare(String(getBanka(b.banka)||''),'tr'),
    ad: (a,b)=>String(a.ad||'').localeCompare(String(b.ad||''),'tr'),
    tur: (a,b)=>String(getHesapTurLabel(a.tur)||'').localeCompare(String(getHesapTurLabel(b.tur)||''),'tr')
  });
  const liste = hesapSirali
    .filter(h=> !hesapFiltre || (hesapFiltre==='kmh' ? !!(h.kmhLimit||(h.kmhLimitGecmisi&&h.kmhLimitGecmisi.length)) : h.tur===hesapFiltre))
    .filter(h=> !_hesapBankaFiltre.length || _hesapBankaFiltre.includes(h.banka));

  // Stats
  const aktifler = DB.hesaplar.filter(h=>h.durum==='aktif');
  const toplamTry = aktifler.filter(h=>h.paraBirimi==='TRY').reduce((s,h)=>s+h.bakiye,0);
  const hesapSayisi = aktifler.length;
  const bankaSet = new Set(aktifler.map(h=>h.banka).filter(Boolean));

  document.getElementById('hesaplar-stats').innerHTML=`
    <div class="stat s-blue"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div><div class="stat-label">Aktif Hesap</div><div class="stat-val blue">${hesapSayisi}</div></div>
    <div class="stat s-green"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="stat-label">TRY Toplam Bakiye</div><div class="stat-val green">${fmt(toplamTry)}</div></div>
    <div class="stat s-purple"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div><div class="stat-label">Banka Çeşidi</div><div class="stat-val purple">${bankaSet.size}</div></div>
    <div class="stat s-warn"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div><div class="stat-label">Döviz Hesap</div><div class="stat-val warn">${DB.hesaplar.filter(h=>h.tur==='doviz'&&h.durum==='aktif').length}</div></div>
    ${DB._nakitBakiye && Object.keys(DB._nakitBakiye).length ? Object.entries(DB._nakitBakiye).map(([pb,val])=>`<div class="stat s-${val>=0?'green':'red'}"><button class="hesap-nakit-log-btn" data-pb="${pb}" title="${pb} Nakit İşlem Logu" style="position:absolute;top:14px;right:14px;border:none;background:var(--surface4);color:var(--text2);width:24px;height:24px;border-radius:7px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:3;opacity:.75"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:block"><path d="M2 4h12M2 8h8M2 12h5"/></svg></button><div class="stat-label">Nakit Bakiye (${pb})</div><div class="stat-val ${val>=0?'green':'red'}">${fmtCur(val,pb)}</div><div class="stat-sub">Elden/nakit işlemler</div></div>`).join('') : ''}`;

  document.getElementById('hesaplar-stats').querySelectorAll('.hesap-nakit-log-btn').forEach(btn => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      openNakitLogModal(btn.getAttribute('data-pb'));
    });
  });

  if(!liste.length) {
    document.getElementById('hesaplar-tbody').innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:24px">Kayıt yok</td></tr>';
    return;
  }

  document.getElementById('hesaplar-tbody').innerHTML = liste.map(h=>{
    const bankaObj = DB.bankalar.find(b=>b.id===h.banka) || null;
    const bankaAd = bankaObj ? bankaObj.kisa : '-';
    const bankaIkon = bankaIkonObj(bankaObj);
    const bankaLogoHtml = bankaIkon.svg
      ? `<span class="bank-logo">${bankaIkon.svg}</span>`
      : `<span class="bank-logo" style="color:${bankaIkon.renk}">${bankaIkon.emoji}</span>`;
    const ibanDisplay = h.iban ? h.iban.replace(/(.{4})/g,'$1 ').trim() : '-';
    const turBadge = getHesapTurBadge(h.tur);
    const durumBadge = HESAP_DURUM_BADGE[h.durum]||'';
    // KMH limiti
    let kmhLimitHtml = '<span style="color:var(--text3);font-size:11px">—</span>';
    if(h.kmhLimit || (h.kmhLimitGecmisi && h.kmhLimitGecmisi.length)) {
      const gecmis = (h.kmhLimitGecmisi||[]);
      // Güncel limit: geçmişin en son kaydından al
      const sorted = gecmis.length ? [...gecmis].sort((a,b)=>b.tarih.localeCompare(a.tarih)) : [];
      const limit = sorted.length ? sorted[0].limit : (h.kmhLimit || 0);
      kmhLimitHtml = `<span class="mono" style="color:var(--warn);font-weight:600">${fmt(limit)}</span>`;
      if(gecmis.length > 1) kmhLimitHtml += `<div style="font-size:10px;color:var(--text3)">${gecmis.length} değişim</div>`;
    }
    const pbRenk = pbRenkAl(h.paraBirimi||'TRY');
    const pbBadgeHtml = `<span style="background:${pbRenk.bg};color:${pbRenk.text};border:1px solid ${pbRenk.border};border-radius:5px;padding:2px 7px;font-size:10.5px;font-weight:700;white-space:nowrap">${h.paraBirimi||'TRY'}</span>`;
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:6px">${bankaLogoHtml}<span>${bankaAd}</span></div></td>
      <td><span style="font-weight:600;color:var(--text)">${h.ad}</span>${h.otoGunlukVadeli?' <span class="badge badge-gold" style="font-size:9.5px" title="Bakiye her gün otomatik günlük vadeli mevduata aktarılır">☀ Günlük</span>':''}${h.not?`<div style="font-size:10px;color:var(--text3);margin-top:2px">${h.not}</div>`:''}</td>
      <td><span class="badge ${turBadge}">${getHesapTurLabel(h.tur)}</span></td>
      <td class="mono">${pbBadgeHtml}</td>
      <td class="mono" style="font-size:11px;letter-spacing:.03em" title="${h.iban||''}">${ibanDisplay}</td>
      <td class="mono" style="font-size:11px">${h.subeKodu||'-'}${(()=>{const sn=getSubeAdFromKodlar(h.bankaKodu,h.subeKodu)||h.subeAd||''; return sn?`<div style="font-size:10px;color:var(--text2);white-space:normal;max-width:140px">${sn}</div>`:'';})()}</td>
      <td class="mono" style="font-size:11px">${h.hesapNo||'-'}</td>
      <td class="mono ${h.bakiye>=0?'green':'red'}">${fmtCur(h.bakiye, h.paraBirimi||'TRY')}${(()=>{const d=hesapBakiyeDurumTespit(h);return d&&(d.seviye==='kritik'||d.seviye==='dusuk')?` <span title="${d.etiket}: ${d.aciklama}" style="font-size:12px;cursor:help">${d.ikon}</span>`:''})()}</td>
      <td>${kmhLimitHtml}</td>
      <td><span class="badge ${durumBadge}">${h.durum||'aktif'}</span></td>
      <td style="white-space:nowrap">
        ${h.iban ? `<button class="btn btn-ghost btn-sm btn-act hesap-act-iban" data-id="${h.id}" style="margin-right:4px" title="IBAN'ı Kopyala"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><rect x="5" y="5" width="8" height="9" rx="1.5"/><path d="M3 11V3a1 1 0 0 1 1-1h7"/></svg></button>` : ''}
        ${(h.tur !== 'vadeli' && h.durum==='aktif' && h.bakiye>0) ? `<button class="btn btn-ghost btn-sm btn-act hesap-act-vadeli" data-action="vadeli" data-id="${h.id}" style="margin-right:4px" title="Vadeliye Koy"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M4 7V5a4 4 0 0 1 8 0v2"/><rect x="3" y="7" width="10" height="7" rx="2"/><path d="M8 10v2"/></svg></button>` : ''}
        ${(h.tur !== 'vadeli' && h.durum==='aktif' && h.bakiye>0 && !h.otoGunlukVadeli) ? `<button class="btn btn-ghost btn-sm btn-act hesap-act-gunluk" data-action="gunluk" data-id="${h.id}" style="margin-right:4px" title="Günlük Vadeliye Koy"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M13 8a5 5 0 1 1-1.45-3.55"/><path d="M13 3.5V7h-3.5"/><path d="M8 5.5V8l1.8 1.1"/></svg></button>` : ''}
        ${(h.tur !== 'vadeli' && h.durum==='aktif' && ((h.bakiye||0)+(h.kmhLimit||0))>0) ? `<button class="btn btn-ghost btn-sm btn-act hesap-act-transfer" data-action="transfer" data-id="${h.id}" style="margin-right:4px" title="Bu hesaptan transfer yap"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M2 5h10"/><path d="M9.5 2.5 12 5 9.5 7.5"/><path d="M14 11H4"/><path d="M6.5 8.5 4 11l2.5 2.5"/></svg></button>` : ''}
        <button class="btn btn-ghost btn-sm btn-act hesap-act-log" data-id="${h.id}" style="margin-right:4px" title="İşlem Logu"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M2 4h12M2 8h8M2 12h5"/></svg></button>
        <button class="btn btn-ghost btn-sm btn-act hesap-act-edit" data-id="${h.id}" style="margin-right:4px"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/></svg></button>
        <button class="btn btn-danger btn-sm btn-act hesap-act-delete" data-id="${h.id}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><polyline points="3,5 13,5"/><path d="M6 5V3h4v2M5 5l1 9h4l1-9"/></svg></button>
      </td>
    </tr>`;
  }).join('');

  const hesaplarTbodyEl = document.getElementById('hesaplar-tbody');
  // [ES module] onclick="navigator.clipboard...", "vadeliyeKoy(...)", "gunlukVadeliyeKoy(...)",
  // "openTransferModal(...)", "openHesapLogModal(...)", "openHesapModal(...)", "deleteHesap(...)"
  // kaldırıldı - gerçek addEventListener bağlanıyor.
  hesaplarTbodyEl.querySelectorAll('.hesap-act-iban').forEach(btn => {
    btn.addEventListener('click', () => {
      const h = DB.hesaplar.find(x=>x.id===btn.getAttribute('data-id'));
      if(h && h.iban) navigator.clipboard.writeText(h.iban).then(()=>showToast('IBAN kopyalandı ✓'));
    });
  });
  hesaplarTbodyEl.querySelectorAll('.hesap-act-vadeli').forEach(btn => {
    btn.addEventListener('click', () => vadeliyeKoy(btn.getAttribute('data-id')));
  });
  hesaplarTbodyEl.querySelectorAll('.hesap-act-gunluk').forEach(btn => {
    btn.addEventListener('click', () => gunlukVadeliyeKoy(btn.getAttribute('data-id')));
  });
  hesaplarTbodyEl.querySelectorAll('.hesap-act-transfer').forEach(btn => {
    btn.addEventListener('click', () => openTransferModal(btn.getAttribute('data-id')));
  });
  hesaplarTbodyEl.querySelectorAll('.hesap-act-log').forEach(btn => {
    btn.addEventListener('click', () => openHesapLogModal(btn.getAttribute('data-id')));
  });
  hesaplarTbodyEl.querySelectorAll('.hesap-act-edit').forEach(btn => {
    btn.addEventListener('click', () => openHesapModal(btn.getAttribute('data-id')));
  });
  hesaplarTbodyEl.querySelectorAll('.hesap-act-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteHesap(btn.getAttribute('data-id')));
  });
}

// ---- (2. tur refactor: 02-core-app-engine.js'den taşındı) ----
export var editHesapId = null;

export var hesapFiltre = '';

export var _hesapFiltreRestored = false;

// ==== dağıtım: js/06-hesap-log-duzelt.js içeriği taşındı (hesap log/bakiye duzelt) ====

// ═══ BİRLEŞİK BAKİYE LOG MODALI (Hesap + Nakit) ══════════════════════
export let _hesapLogId = null;
export let _hesapLogKayitlar = [];
export let _hesapLogNakitPb = null; // openNakitLogModal ile açıldıysa gösterilen para birimi

// [ES module] Bu dosyada tanımlanan aşağıdaki değişkenler başka dosyalarda
// yeniden atanıyordu (import edilen bir binding'e doğrudan atama ES
// module'de yasaktır). Bu setter fonksiyonları o davranışı korumak için
// eklendi - ilgili dosyalar artık `X = v` yerine `setX(v)` çağırıyor.
export function setEditHesapId(v) { editHesapId = v; }
export function set_hesapLogId(v) { _hesapLogId = v; }
export function set_hesapLogNakitPb(v) { _hesapLogNakitPb = v; }
export function set_hesapLogKayitlar(v) { _hesapLogKayitlar = v; }
export function set_hesapFiltreRestored(v) { _hesapFiltreRestored = v; }
export function setHesapFiltre(v) { hesapFiltre = v; }

// [ES module] taban render fonksiyonu(ları) odeme/patches zincirinin
// hook() ile sarmalayabilmesi için wrap-registry'ye kaydediliyor.
register('renderHesaplar', renderHesaplar);
