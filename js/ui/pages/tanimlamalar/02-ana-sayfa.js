import { fmtDate } from '@core/format.js';
import { CURRENCY_CONFIG, DB, defaultCurrency } from '@core/state.js';
import { inject } from '@core/container.js';
const _kurServisleri = inject('services.kurServisleri');
import { renderKisilerGrid } from '@components/kisiler.js';
import { deleteKartAltyapi, openKartAltyapiModal } from '@pages/kartlar/09-kart-altyapi.js';
import { renderHesapTurTablo } from '@pages/hesaplar/02-hesap-turu-tanimlama.js';
import { kartAltyapiRenk } from '@pages/kartlar/01-kart-data.js';
import { deleteKrediTip, openKrediTipModal } from '@pages/krediler/05-kredi-tipi-tanimlama.js';
import { krediTipiRenk } from '@pages/krediler/01-genel-yardimcilar.js';
import { _renkKolonHtml, _tanimBadgeHtml, bankaIkonObj, paraBirimiRenk, urunTipiRenk } from '@pages/tanimlamalar/01-genel-yardimcilar.js';
import { deleteParaBirimi, editParaBirimi, setGosterimParaBirimi } from '@pages/tanimlamalar/06-para-birimi.js';
import { deleteBanka, openBankaModal } from '@pages/tanimlamalar/07-bankalar.js';
import { openSubeModal } from '@pages/tanimlamalar/08-subeler.js';
import { deleteUrunTip, editUrunTip } from '@pages/tanimlamalar/09-urun-tipleri.js';
import { deleteTatil, editTatil } from '@pages/tanimlamalar/10-resmi-tatiller.js';
import { renderKategoriGrid } from '@pages/tanimlamalar/03-kategoriler.js';
import { renderTumOranTablolari } from '@pages/tanimlamalar/05-genel-oran-tablolari.js';
import { register } from '@core/wrap-registry.js';
// ============================================================
// js/ui/pages/tanimlamalar/02-ana-sayfa.js
// Tanımlamalar ana sayfası render
//
// Bu dosya, eskiden tek parça olan js/ui/pages/tanimlamalar.js
// (81 export, 1440+ satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function renderTanimlamalar() {
  renderKategoriGrid();
  renderHesapTurTablo();
  renderTumOranTablolari();
  renderKisilerGrid();
  _kurServisleri.loadCorsProxyWorkerInput();

  document.getElementById('banka-tbody').innerHTML = (DB.bankalar||[]).map((b,i)=>{
    const ikon = bankaIkonObj(b);
    const ikonHtml = ikon.svg
      ? `<span class="bank-logo bank-logo-lg" style="margin-right:6px;vertical-align:middle">${ikon.svg}</span>`
      : `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;font-size:18px;background:${ikon.bg};margin-right:6px;vertical-align:middle">${ikon.emoji}</span>`;
    return `<tr>
    <td class="mono">${i+1}</td>
    <td>${ikonHtml}<span style="vertical-align:middle">${b.tam || b.kisa || '—'}</span></td>
    <td><b>${b.kisa || b.tam || '—'}</b></td>
    <td class="mono" style="letter-spacing:.05em;color:var(--accent)">${b.ibanKod||'<span style="color:var(--text3)">—</span>'}</td>
    <td style="font-size:11px;color:var(--text3)">${b.ibanKod && DB.subeler && DB.subeler[b.ibanKod] && DB.subeler[b.ibanKod].length ? DB.subeler[b.ibanKod].length + ' şube' : '—'}</td>
    <td style="white-space:nowrap">
      <button class="btn btn-ghost btn-sm btn-act tnm-banka-sube-btn" data-id="${b.id}" style="margin-right:4px" title="Şube Tanımlamaları"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><rect x="1" y="8" width="5" height="5" rx="1"/><rect x="10" y="8" width="5" height="5" rx="1"/><rect x="5" y="2" width="6" height="4" rx="1"/><path d="M8 6v2M3.5 8V7a4.5 4.5 0 0 1 9 0v1"/></svg></button>
      <button class="btn btn-ghost btn-sm btn-act tnm-banka-edit-btn" data-id="${b.id}" style="margin-right:4px"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/></svg></button>
      <button class="btn btn-danger btn-sm btn-act tnm-banka-delete-btn" data-id="${b.id}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><polyline points="3,5 13,5"/><path d="M6 5V3h4v2M5 5l1 9h4l1-9"/></svg></button>
    </td>
  </tr>`;}).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:16px">Kayıt yok</td></tr>';

  document.getElementById('urun-tip-tbody').innerHTML = (DB.urunTipler||[]).map(t=>`<tr>
    <td>${t.ad}</td>
    <td>${_tanimBadgeHtml(t.kod, urunTipiRenk(t.id))}</td>
    <td>${_renkKolonHtml(t.renk)}</td>
    <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm btn-act tnm-urun-edit-btn" data-id="${t.id}" style="margin-right:4px"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/></svg></button><button class="btn btn-danger btn-sm btn-act tnm-urun-delete-btn" data-id="${t.id}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><polyline points="3,5 13,5"/><path d="M6 5V3h4v2M5 5l1 9h4l1-9"/></svg></button></td>
  </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:16px">Kayıt yok</td></tr>';

  const krediTipTbody = document.getElementById('kredi-tip-tbody');
  if(krediTipTbody) {
    krediTipTbody.innerHTML = (DB.krediTipleri||[]).map(t=>`<tr>
      <td>${t.ad}</td>
      <td>${_tanimBadgeHtml(t.kod, krediTipiRenk(t.id))}</td>
      <td>${_renkKolonHtml(t.renk)}</td>
      <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm btn-act tnm-kredi-tip-edit-btn" data-id="${t.id}" style="margin-right:4px"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/></svg></button><button class="btn btn-danger btn-sm btn-act tnm-kredi-tip-delete-btn" data-id="${t.id}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><polyline points="3,5 13,5"/><path d="M6 5V3h4v2M5 5l1 9h4l1-9"/></svg></button></td>
    </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:16px">Kayıt yok</td></tr>';
  }

  const kartAltyapiTbody = document.getElementById('kart-altyapi-tbody');
  if(kartAltyapiTbody) {
    kartAltyapiTbody.innerHTML = (DB.kartAltyapilari||[]).map(t=>{
      const logoHtml = t.logo
        ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:20px;border-radius:4px;overflow:hidden;margin-right:8px;vertical-align:middle;flex-shrink:0">${t.logo}</span>`
        : '';
      return `<tr>
      <td>${logoHtml}<span style="vertical-align:middle">${t.ad}</span></td>
      <td>${_tanimBadgeHtml(t.kod, kartAltyapiRenk(t.id))}</td>
      <td>${_renkKolonHtml(t.renk)}</td>
      <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm btn-act tnm-kart-altyapi-edit-btn" data-id="${t.id}" style="margin-right:4px"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/></svg></button><button class="btn btn-danger btn-sm btn-act tnm-kart-altyapi-delete-btn" data-id="${t.id}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><polyline points="3,5 13,5"/><path d="M6 5V3h4v2M5 5l1 9h4l1-9"/></svg></button></td>
    </tr>`;}).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:16px">Kayıt yok</td></tr>';
  }

  const sorted = [...(DB.tatiller||[])].sort((a,b)=>a.tarih.localeCompare(b.tarih));
  document.getElementById('tatil-tbody').innerHTML = sorted.map(t=>`<tr>
    <td class="mono">${fmtDate(t.tarih)}</td>
    <td>${t.aciklama}</td>
    <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm btn-act tnm-tatil-edit-btn" data-id="${t.id}" style="margin-right:4px"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/></svg></button><button class="btn btn-danger btn-sm btn-act tnm-tatil-delete-btn" data-id="${t.id}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><polyline points="3,5 13,5"/><path d="M6 5V3h4v2M5 5l1 9h4l1-9"/></svg></button></td>
  </tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:16px">Kayıt yok</td></tr>';

  // Para birimi yönetim tablosu
  const pbTbody = document.getElementById('para-birimi-tbody');
  if(pbTbody) {
    const allCodes = Object.keys(CURRENCY_CONFIG);
    const tcmbKurlar = (DB.tcmbKur && DB.tcmbKur.kurlar) || {};
    pbTbody.innerHTML = allCodes.map(code => {
      const cfg = CURRENCY_CONFIG[code];
      const isCustom = cfg.custom || false;
      const isDefault = code === defaultCurrency;
      const gosteimBtn = isDefault
        ? '<span style="font-size:10px;font-weight:700;color:var(--accent2);background:rgba(16,185,129,.15);padding:2px 8px;border-radius:4px;white-space:nowrap">&#11088; Gösterim</span>'
        : `<button class="btn btn-ghost btn-sm btn-act tnm-pb-gosterim-btn" data-code="${code}" title="Gösterim birimi yap">&#11088;</button>`;
      const kk = cfg.kurKaynagi || { tip: 'manuel' };
      const kur = tcmbKurlar[code];
      let kaynakEtiket = '';
      if (kk.tip === 'tcmb') kaynakEtiket = `<div style="font-size:9.5px;color:var(--text3);margin-top:2px">TCMB${kk.tcmbKodu && kk.tcmbKodu!==code ? ': '+kk.tcmbKodu : ''}</div>`;
      else if (kk.tip === 'xau_yahoo') kaynakEtiket = `<div style="font-size:9.5px;color:var(--text3);margin-top:2px">Yahoo Finance (GC=F)</div>`;
      else if (kk.tip === 'ozel') kaynakEtiket = `<div style="font-size:9.5px;color:var(--text3);margin-top:2px" title="${kk.url||''}">Özel API</div>`;
      else if (kk.tip === 'manuel' && code !== 'TRY') kaynakEtiket = `<div style="font-size:9.5px;color:var(--text3);margin-top:2px">Manuel</div>`;
      const kurHucresi = code === 'TRY'
        ? '<span style="color:var(--text3)">—</span>'
        : (kur
            ? `<span class="mono" style="font-size:11.5px" title="Alış: ${kur.alis} · Satış: ${kur.satis}">${kur.satis ?? kur.alis}</span>${kaynakEtiket}`
            : (kk.tip === 'manuel'
                ? `<span style="color:var(--text3);font-size:11px">Otomatik çekilmiyor</span>${kaynakEtiket}`
                : `<span style="color:var(--text3);font-size:11px">Henüz çekilemedi</span>${kaynakEtiket}`));
      return `<tr${isDefault ? ' style="background:rgba(16,185,129,.06)"' : ''}>
        <td>${_tanimBadgeHtml(code, paraBirimiRenk(code), true)}</td>
        <td>${_renkKolonHtml(cfg.renk)}</td>
        <td class="mono" style="font-size:16px">${cfg.symbol}</td>
        <td>${cfg.ad || code}</td>
        <td style="font-size:16px">${cfg.flag || '—'}</td>
        <td style="font-size:16px">${cfg.icon || '—'}</td>
        <td><span class="badge ${cfg.position==='prefix'?'badge-green':'badge-purple'}">${cfg.position==='prefix'?'Önde':'Sonda'}</span></td>
        <td class="mono">${cfg.decimals !== undefined ? cfg.decimals : 2}</td>
        <td style="font-size:11px;color:var(--text3)">${cfg.locale}</td>
        <td class="mono">${kurHucresi}</td>
        <td style="white-space:nowrap">
          <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">
            ${gosteimBtn}
            <button class="btn btn-ghost btn-sm btn-act tnm-pb-edit-btn" data-code="${code}" title="Düzenle"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:block"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/></svg></button>
            ${isCustom ? `<button class="btn btn-danger btn-sm btn-act tnm-pb-delete-btn" data-code="${code}" title="Sil"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:block"><polyline points="3,5 13,5"/><path d="M6 5V3h4v2M5 5l1 9h4l1-9"/></svg></button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="11" style="text-align:center;color:var(--text3);padding:16px">Kayıt yok</td></tr>';
    const sonGuncEl = document.getElementById('tcmb-son-guncelleme');
    if(sonGuncEl) {
      sonGuncEl.textContent = (DB.tcmbKur && DB.tcmbKur.tarih)
        ? `Son güncelleme: ${fmtDate(DB.tcmbKur.tarih)}`
        : 'Kurlar henüz çekilmedi';
    }
  }

  // [ES module] onclick="openSubeModal(...)", onclick="openBankaModal(...)",
  // onclick="deleteBanka(...)", onclick="editUrunTip(...)", onclick="deleteUrunTip(...)",
  // onclick="openKrediTipModal(...)", onclick="deleteKrediTip(...)",
  // onclick="openKartAltyapiModal(...)", onclick="deleteKartAltyapi(...)",
  // onclick="editTatil(...)", onclick="deleteTatil(...)",
  // onclick="setGosterimParaBirimi(...)", onclick="editParaBirimi(...)",
  // onclick="deleteParaBirimi(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
  // Bu fonksiyonlar başka dosyalarda tanımlı ve o dosyalar zaten bu dosyayı (renderTanimlamalar
  // için) import ediyor — döngüsel import var ama fonksiyon export'ları hoisted olduğu için sorun çıkmıyor.
  document.querySelectorAll('.tnm-banka-sube-btn').forEach(btn => {
    btn.addEventListener('click', () => openSubeModal(btn.dataset.id));
  });
  document.querySelectorAll('.tnm-banka-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openBankaModal(btn.dataset.id));
  });
  document.querySelectorAll('.tnm-banka-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteBanka(btn.dataset.id));
  });
  document.querySelectorAll('.tnm-urun-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editUrunTip(btn.dataset.id));
  });
  document.querySelectorAll('.tnm-urun-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteUrunTip(btn.dataset.id));
  });
  document.querySelectorAll('.tnm-kredi-tip-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openKrediTipModal(btn.dataset.id));
  });
  document.querySelectorAll('.tnm-kredi-tip-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteKrediTip(btn.dataset.id));
  });
  document.querySelectorAll('.tnm-kart-altyapi-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openKartAltyapiModal(btn.dataset.id));
  });
  document.querySelectorAll('.tnm-kart-altyapi-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteKartAltyapi(btn.dataset.id));
  });
  document.querySelectorAll('.tnm-tatil-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editTatil(btn.dataset.id));
  });
  document.querySelectorAll('.tnm-tatil-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTatil(btn.dataset.id));
  });
  document.querySelectorAll('.tnm-pb-gosterim-btn').forEach(btn => {
    btn.addEventListener('click', () => setGosterimParaBirimi(btn.dataset.code));
  });
  document.querySelectorAll('.tnm-pb-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editParaBirimi(btn.dataset.code));
  });
  document.querySelectorAll('.tnm-pb-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteParaBirimi(btn.dataset.code));
  });
}

// [ES module] taban render fonksiyonu(ları) odeme/patches zincirinin
// hook() ile sarmalayabilmesi için wrap-registry'ye kaydediliyor.
register('renderTanimlamalar', renderTanimlamalar);
