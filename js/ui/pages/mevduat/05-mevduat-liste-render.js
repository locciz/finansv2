import { tblFiltreMultiToggle, tblFiltreOkuMulti } from '@core/app-core.js';
import { fmt, fmtCur, fmtDate, localDateStr } from '@core/format.js';
import { DB } from '@core/state.js';
import { mevduatDurumHesapla } from '@domain/hesaplamalar.js';
import { bindTblFiltreChips, tblBankaFiltrePopupBtnHtml, tblFiltreChipsMultiHtml, tblFiltreClearMultiHtml, tblSiralamaAyarla, tblSiralamaBarHtml, tblSiralamaOku, tblSiralamaUygula } from '@components/tablo-filtre-sirala.js';
import { hesapOtomatikGunlukKontrol } from '@pages/hesaplar/01-genel-yardimcilar.js';
import { MEVDUAT_DURUM_FILTRE_OPTS, _MEV_FILTRE_ETIKET } from '@pages/mevduat/00-state.js';
import { mevduatOtomatikVadeKontrol } from '@pages/mevduat/04-mevduat-otomasyon.js';
import { deleteMevduat } from '@pages/mevduat/03-mevduat-yenileme-ve-kapama.js';
import { editMevduat } from '@pages/mevduat/01-mevduat-form-wizard.js';
import { bankaIkonObj, getBanka } from '@pages/tanimlamalar/01-genel-yardimcilar.js';
import { openMevduatBankaFiltrePopup } from '@components/mf-popup.js';
import { call, register } from '@core/wrap-registry.js';
// ============================================================
// js/ui/pages/mevduat/05-mevduat-liste-render.js
// Mevduat listesi render + filtre/sıralama
//
// Bu dosya, eskiden tek parça olan js/ui/pages/mevduat.js
// (43 export, 1589 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function _mevduatFiltreBaslikGuncelle(secili) {
  const el = document.getElementById('mevduat-filtre-title-suffix');
  if(!el) return;
  el.textContent = secili.length ? ' — ' + secili.map(d => _MEV_FILTRE_ETIKET[d] || d).join(' + ') : '';
}

export function mevduatSirala(key, yon) {
  tblSiralamaAyarla('mevduat', key, yon);
  renderMevduat();
}

export function setMevduatDurumFiltre(durum) {
  tblFiltreMultiToggle('mevduat', 'durum', durum);
  renderMevduat();
}

export function renderMevduat() {
  if(!DB.mevduatlar) DB.mevduatlar = [];
  // Vade dolmuş mevduatları otomatik işle (bkz. mevduatOtomatikVadeKontrol)
  mevduatOtomatikVadeKontrol();
  // Otomatik günlük vadeli toggle'ı açık hesapları da işle
  if(typeof hesapOtomatikGunlukKontrol === 'function') hesapOtomatikGunlukKontrol();
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = localDateStr(today);
  let toplamAna=0, toplamNihai=0, toplamFaiz=0, aktif=0;
  DB.mevduatlar.forEach(m=>{
    toplamAna+=m.tutar||0;
    toplamNihai+=m.nihai||0;
    toplamFaiz+=m.faiz||0;
    if(mevduatDurumHesapla(m, todayStr, today).aktifBool) aktif++;
  });

  document.getElementById('mevduat-stats').innerHTML=`
    <div class="stat s-blue"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg></div><div class="stat-label">Ana Para</div><div class="stat-val blue">${fmt(toplamAna)}</div></div>
    <div class="stat s-green"><div class="stat-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div><div class="stat-label">Net Faiz</div><div class="stat-val green">${fmt(toplamFaiz)}</div></div>
    <div class="stat s-green"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="stat-label">Nihai Toplam</div><div class="stat-val green">${fmt(toplamNihai)}</div></div>
    <div class="stat s-blue"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg></div><div class="stat-label">Aktif Mevduat</div><div class="stat-val blue">${aktif}</div></div>`;

  // Durum filtresi (çoklu seçim) — dinamik olarak render edilir
  const _mevDurumFiltre = tblFiltreOkuMulti('mevduat', 'durum');
  const durumFiltreEl = document.getElementById('mevduat-durum-filtre');
  if(durumFiltreEl) {
    durumFiltreEl.innerHTML = tblFiltreChipsMultiHtml('', MEVDUAT_DURUM_FILTRE_OPTS, _mevDurumFiltre, 'setMevduatDurumFiltre')
      + tblFiltreClearMultiHtml(_mevDurumFiltre, 'setMevduatDurumFiltre');
    // [ES module] onclick="setMevduatDurumFiltre(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
    bindTblFiltreChips(durumFiltreEl, { setMevduatDurumFiltre });
  }
  _mevduatFiltreBaslikGuncelle(_mevDurumFiltre);

  // Banka filtresi — popup + çoklu seçim (chip satırına sığmadığı için artık ▾ Banka (n) düğmesi ile açılır)
  const _mevBankaFiltre = tblFiltreOkuMulti('mevduat', 'banka');
  const bankaFiltreEl = document.getElementById('mevduat-banka-filtre');
  if(bankaFiltreEl) {
    const bankaIdSet = [...new Set(DB.mevduatlar.map(m=>m.banka).filter(Boolean))];
    bankaFiltreEl.innerHTML = bankaIdSet.length
      ? tblBankaFiltrePopupBtnHtml('mevduat', _mevBankaFiltre, 'openMevduatBankaFiltrePopup', 'renderMevduat')
      : '';
    // [ES module] onclick="openMevduatBankaFiltrePopup(this)" / "__bankaFiltreTemizle"
    // kaldırıldı - gerçek addEventListener bağlanıyor.
    bindTblFiltreChips(bankaFiltreEl, { openMevduatBankaFiltrePopup, renderMevduat });
  }

  // ── Sıralama (DB.uiSiralama.mevduat içinde kalıcı) ──
  const _mevAktifSirala = tblSiralamaOku('mevduat', 'vade', 'asc');
  const mevSiralamaBarEl = document.getElementById('mevduat-siralama-bar');
  if(mevSiralamaBarEl) {
    mevSiralamaBarEl.innerHTML = tblSiralamaBarHtml([
      {key:'vade', label:'Vade (Bitiş)', ikon:'takvim', yon:'asc'},
      {key:'anapara', label:'Ana Para', ikon:'tutar', yon:'desc'},
      {key:'nihai', label:'Nihai Tutar', ikon:'tutar', yon:'desc'},
      {key:'faiz', label:'Faiz Oranı', ikon:'yuzde', yon:'desc'},
      {key:'banka', label:'Banka', ikon:'banka', yon:'asc'}
    ], _mevAktifSirala, 'mevduatSirala');
    // [ES module] onclick="mevduatSirala(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
    bindTblFiltreChips(mevSiralamaBarEl, { mevduatSirala });
  }
  const sorted = tblSiralamaUygula(DB.mevduatlar, _mevAktifSirala, {
    vade: (a,b)=>a.bitis.localeCompare(b.bitis),
    anapara: (a,b)=>(a.tutar||0)-(b.tutar||0),
    nihai: (a,b)=>(a.nihai||0)-(b.nihai||0),
    faiz: (a,b)=>(a.faiz||0)-(b.faiz||0),
    banka: (a,b)=>String(getBanka(a.banka)||'').localeCompare(String(getBanka(b.banka)||''),'tr')
  });
  const filtreli = sorted
    .filter(m=> !_mevDurumFiltre.length || _mevDurumFiltre.includes(mevduatDurumHesapla(m, todayStr, today).durum))
    .filter(m=> !_mevBankaFiltre.length || _mevBankaFiltre.includes(m.banka));
  document.getElementById('mevduat-tbody').innerHTML = filtreli.map(m=>{
    const durumBilgi = mevduatDurumHesapla(m, todayStr, today);
    const aktif = durumBilgi.aktifBool;
    const aktarimYapildi = durumBilgi.aktarimYapildi;
    const vadeYaklasiyor = durumBilgi.yaklasiyor;
    const kalanGun = durumBilgi.kalanGun;
    const bank = getBanka(m.banka);
    const bankObj = (DB.bankalar||[]).find(b=>b.id===m.banka) || null;
    const bankIkon = bankaIkonObj(bankObj);
    const bankLogoHtml = bankIkon.svg
      ? `<span class="bank-logo">${bankIkon.svg}</span>`
      : `<span class="bank-logo">${bankIkon.emoji}</span>`;
    const cur = m.paraBirimi || 'TRY';
    const vadesizH = m.vadesizHesapId ? (DB.hesaplar||[]).find(h=>h.id===m.vadesizHesapId) : null;
    const vadesizLabel = vadesizH ? `<span class="badge badge-gray" title="Vade sonunda geçecek hesap">${vadesizH.ad}</span>` : '<span style="color:var(--text3);font-size:11px">—</span>';
    const hesapH = m.hesapId ? (DB.hesaplar||[]).find(h=>h.id===m.hesapId) : null;
    const gunlukBadge = m.gunluk ? '<span class="badge badge-gold" style="margin-right:4px" title="Günlük vadeli mevduat">☀ Günlük</span>' : '';
    const hesapLabel = hesapH ? `${gunlukBadge}<span style="font-size:11px;color:var(--text2)">${hesapH.ad}</span>` : `${gunlukBadge}<span style="color:var(--text3);font-size:11px">${gunlukBadge?'':'—'}</span>`;
    // Aktarım durumu (aynı hesaplamayı tekrar etmemek için durumBilgi kullanılıyor)
    const aktarimLabel = aktarimYapildi
      ? `<span class="badge badge-green" title="Vadesiz hesaba aktarım tamamlandı">✓ Aktarıldı</span>`
      : (aktif ? '<span style="color:var(--text3);font-size:11px">Vade bekleniyor</span>' : `<span class="badge badge-red mev-manuel-aktar-btn" style="cursor:pointer" data-id="${m.id}" title="Aktarımı manuel tetikle">Manuel Aktar</span>`);
    // Durum rengi ve vade ilerlemesi (görsel zenginleştirme)
    const statusColor = vadeYaklasiyor ? 'var(--warn)' : (aktif ? 'var(--accent2)' : 'var(--text3)');
    const toplamGun = m.vade || 1;
    const gecenGun = Math.round((today - new Date(m.baslangic+'T00:00:00')) / 86400000);
    const vadePct = Math.max(0, Math.min(100, (gecenGun/toplamGun)*100));
    return `<tr>
      <td style="border-left:3px solid ${statusColor}"><div style="display:flex;align-items:center;gap:7px">${bankLogoHtml}<span>${bank||'-'}</span></div></td>
      <td>${hesapLabel}</td>
      <td class="mono">${fmtDate(m.baslangic)}</td>
      <td class="mono">${fmtDate(m.bitis)}${(()=>{ if(!aktif) return ''; const acil=kalanGun<=3; return `<div style="font-size:9.5px;font-weight:600;margin-top:1px;color:${acil?'var(--warn)':'var(--text3)'}">${kalanGun===0?'Bugün doluyor':kalanGun+' gün kaldı'}</div>`; })()}</td>
      <td class="mono"><span class="badge badge-blue" style="font-family:var(--mono);letter-spacing:.04em;margin-right:4px;font-size:10px">${cur}</span>${fmtCur(m.tutar, cur)}</td>
      <td class="mono"><span class="mev-pct-badge mev-pct-faiz">${m.faizOran}%</span></td>
      <td class="mono"><span class="mev-pct-badge mev-pct-stopaj">${m.stopaj}%</span></td>
      <td class="mono">
        <div class="mev-vade-wrap">
          <span class="mev-vade-gun">${m.vade}g</span>
          <div class="mev-vade-bar"><div class="mev-vade-bar-fill" style="width:${vadePct}%;background:${statusColor}"></div></div>
        </div>
      </td>
      <td class="mono green">▲ ${fmtCur(m.faiz, cur)}</td>
      <td class="mono"><span class="mev-nihai-pill">${fmtCur(m.nihai, cur)}</span></td>
      <td><span class="badge ${aktif ? (vadeYaklasiyor?'badge-warn':'badge-green') : 'badge-gray'}">${aktif ? (vadeYaklasiyor?'⏰ Yaklaşıyor':'⚡ Aktif') : '✓ Bitti'}</span></td>
      <td>${vadesizLabel}</td>
      <td>${aktarimLabel}</td>
      <td style="white-space:nowrap;position:sticky;right:0;background:var(--surface);z-index:1"><button class="btn btn-ghost btn-sm btn-act mev-edit-btn" data-id="${m.id}" style="margin-right:4px"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/></svg></button><button class="btn btn-danger btn-sm btn-act mev-del-btn" data-id="${m.id}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><polyline points="3,5 13,5"/><path d="M6 5V3h4v2M5 5l1 9h4l1-9"/></svg></button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="15" style="text-align:center;color:var(--text3);padding:20px">${(_mevDurumFiltre.length || _mevBankaFiltre.length) ? 'Bu filtreyle eşleşen mevduat bulunamadı' : 'Mevduat bulunamadı'}</td></tr>`;
  // [ES module] onclick="_otoBakiyeGuncelle(...)", onclick="editMevduat(...)", onclick="deleteMevduat(...)" kaldırıldı.
  const mevTbody = document.getElementById('mevduat-tbody');
  mevTbody.querySelectorAll('.mev-manuel-aktar-btn').forEach(el => {
    el.addEventListener('click', () => { call('_otoBakiyeGuncelle', 'mevduat', el.getAttribute('data-id'), undefined, 'odendi', 0); renderMevduat(); });
  });
  mevTbody.querySelectorAll('.mev-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editMevduat(btn.getAttribute('data-id')));
  });
  mevTbody.querySelectorAll('.mev-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteMevduat(btn.getAttribute('data-id')));
  });
}

// [ES module] taban render fonksiyonu(ları) odeme/patches zincirinin
// hook() ile sarmalayabilmesi için wrap-registry'ye kaydediliyor.
register('renderMevduat', renderMevduat);
