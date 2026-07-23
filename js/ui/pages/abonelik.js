import { saveData } from '../../core/app-core-base.js';
import { tblFiltreKaydet, tblFiltreMultiToggle, tblFiltreOku, tblFiltreOkuMulti } from '../../core/app-core.js';
import { isIsBgunu } from '../../core/date-utils.js';
import { fmt, fmtCur, fmtDate, localDateStr, uid } from '../../core/format.js';
import { ALL_CURRENCIES, DB, defaultCurrency } from '../../core/state.js';
import { buildCurrencyOptions } from '../../domain/doviz.js';
import { _bakiyeDelta, _sync } from '../../domain/hesap-entegrasyon-motoru.js';
import { getBireyselKrediKalan, getIslemTaksitliste, getMaasOdemeGunu, hesapKullanilabilirBakiye } from '../../domain/hesaplamalar.js';
import { phSet, showConfirm, showToast, validateRequiredFields } from '../components/modal-genel.js';
import { getMoneyInput, setDateInputValue, setMoneyInput } from '../components/money-input.js';
import { swizBakiyeHintGuncelle, swizOzetSatirHtmlKisa, swizUpdateStepIndicator } from '../components/step-wizard.js';
import { bindTblFiltreChips, tblFiltreChipsHtml, tblFiltreChipsMultiHtml, tblFiltreClearHtml, tblFiltreClearMultiHtml, tblSiralamaAyarla, tblSiralamaBarHtml, tblSiralamaOku, tblSiralamaUygula } from '../components/tablo-filtre-sirala.js';
import { hesapOptionMetin } from './hesaplar/01-genel-yardimcilar.js';
import { kiraPayInMonth } from './kira.js';
import { renderMevduat } from './mevduat/05-mevduat-liste-render.js';
import { odEfektifDurum, odFiilenGerceklesenTutar, odGetDurum, odIptalMi, odKiraMaasOverride, odToggleBtn } from './odeme/01-genel-yardimcilar.js';
import { ODEME_DURUM_FILTRE_OPTS } from './odeme/08-popup-giris-noktalari.js';
import { getBanka, getTatilSet } from './tanimlamalar/01-genel-yardimcilar.js';
import { getKategoriOptsAbonelik } from './tanimlamalar/03-kategoriler.js';
import { renderOzet } from './ozet.js';
import { call, get, register } from '../../core/wrap-registry.js';
import { closeModal, openModal } from '../components/modal-genel.js';
import { renderHesaplar } from './hesaplar/04-hesap-liste-render.js';
// Orijinal 02-core-app-engine.js içinden çıkarıldı. İçerik değiştirilmedi.

export function setAbonelikKategoriFiltre(kat) {
  tblFiltreKaydet('abonelik', 'kategori', kat);
  renderAbonelik();
}

export function setAbonelikDurumFiltre(durum) {
  tblFiltreMultiToggle('abonelik', 'durum', durum);
  renderAbonelik();
}


// ==== dağıtım: js/04-abonelik.js içeriği taşındı (abonelik ek fonksiyonlar) ====

// ══════════════════════════════════════════════════════════════════════════════
// 1. ABONELİK MODÜLÜ
// ══════════════════════════════════════════════════════════════════════════════
export let editAbonelikId = null;

export function abNextDate(ab, fromDate) {
  const base = new Date(ab.tarih);
  if(isNaN(base)) return new Date(9999,0,1); // fix: geçersiz tarih → çok uzak gelecek
  const from = fromDate || new Date();
  let d = new Date(base);
  const perMap = { haftalik:7, aylik:1, '3aylik':3, '6aylik':6, yillik:12 };
  if(ab.periyot === 'haftalik') {
    while(d < from) d.setDate(d.getDate()+7);
  } else {
    const months = perMap[ab.periyot] || 1;
    while(d < from) {
      d.setMonth(d.getMonth() + months);
    }
  }
  return d;
}

export function abAylikTutar(ab) {
  const perMap = { haftalik: 52/12, aylik: 1, '3aylik': 1/3, '6aylik': 1/6, yillik: 1/12 };
  return Math.abs(ab.tutar||0) * (perMap[ab.periyot]||1); // fix: tutar negatif saklandığı için abs alınmalı
}

// Seçili "Bağlı Hesap"ın kullanılabilir bakiyesini döndürür (bakiye + KMH)
export function _abHesapKullanilabilirBakiye() {
  const hesapId = (document.getElementById('ab-hesap')||{}).value || '';
  return hesapKullanilabilirBakiye(hesapId);
}

// "Bakiyenin Tümünü Kullan" butonu — seçili bağlı hesabın tüm kullanılabilir bakiyesini tutara yazar
export function abTutarTumunuKullan() {
  const kb = _abHesapKullanilabilirBakiye();
  if (!kb) { showToast('Önce bağlı hesabı seçin', 'error'); return; }
  if (!(kb.tutar > 0)) { showToast('Kullanılabilir bakiye 0 veya negatif', 'error'); return; }
  setMoneyInput('ab-tutar', kb.tutar);
  _updateAbTutarHint();
  showToast(`${fmtCur(kb.tutar, kb.pb)} tutarı dolduruldu`, 'info');
}

// Buton görünürlüğünü hesap seçimine göre günceller
export function _updateAbTutarTumBtn() {
  const btn = document.getElementById('ab-tutar-tum-btn');
  if (!btn) return;
  const kb = _abHesapKullanilabilirBakiye();
  btn.style.display = kb ? 'flex' : 'none';
  _updateAbTutarHint();
}

// Girilen tutarı, hesabın kullanılabilir bakiyesiyle karşılaştıran ipucu
export function _updateAbTutarHint() {
  const hint = document.getElementById('ab-tutar-bakiye-hint');
  if (!hint) return;
  const kb = _abHesapKullanilabilirBakiye();
  if (!kb) { hint.style.display = 'none'; return; }
  hint.style.display = 'block';
  const tutar = getMoneyInput('ab-tutar') || 0;
  // ---- Saf DOM güncelleme: js/ui/components/step-wizard.js:swizBakiyeHintGuncelle ----
  swizBakiyeHintGuncelle(hint, tutar, kb);
}

export function openAbonelikModal(id=null) {
  editAbonelikId = id;
  abStepGoto(1);
  document.getElementById('abonelik-modal-title').textContent = id ? 'Abonelik Düzenle' : 'Abonelik Ekle';
  const ab = id ? (DB.abonelikler||[]).find(x=>x.id===id) : null;
  document.getElementById('ab-ad').value = ab?.ad || '';
  (function(){
    const ikonSel = document.getElementById('ab-ikon');
    const ikonVal = ab?.ikon || '';
    if(ikonVal && ![...ikonSel.options].some(o=>o.value===ikonVal)) {
      const opt = document.createElement('option');
      opt.value = ikonVal;
      opt.textContent = ikonVal + ' Özel İkon';
      ikonSel.insertBefore(opt, ikonSel.querySelector('option[value="__custom__"]') || null);
    }
    ikonSel.value = ikonVal;
  })();
  // Abonelige uygun işaretli kategorileri dinamik doldur (mevcut seçili kategori abonelik-dışı bırakılmışsa yine listede kalır)
  const abKatEl = document.getElementById('ab-kategori');
  abKatEl.innerHTML = getKategoriOptsAbonelik(ab?.kategori || '');
  phSet(abKatEl, 'Kategori seçin…', ab?.kategori || '', '— Kategori bulunamadı —');
  phSet('ab-periyot', 'Periyot seçin…', ab?.periyot || '');
  document.getElementById('ab-not').value = ab?.not || '';
  setDateInputValue('ab-tarih', ab?.tarih || localDateStr(new Date()));
  setMoneyInput('ab-tutar', ab?.tutar ? Math.abs(ab.tutar) : '');
  // Para birimi
  const pbSel = document.getElementById('ab-para-birimi');
  if(typeof ALL_CURRENCIES !== 'undefined' && ALL_CURRENCIES.length) {
    pbSel.innerHTML = buildCurrencyOptions();
  }
  pbSel.value = ab?.paraBirimi || defaultCurrency || 'TRY';
  // Hesap select
  const hSel = document.getElementById('ab-hesap');
  hSel.innerHTML = (DB.hesaplar||[]).filter(h=>h.durum==='aktif' && h.tur !== 'vadeli').map(h=>`<option value="${h.id}">${hesapOptionMetin(h)}</option>`).join('');
  phSet(hSel, 'Hesap seçin…', ab?.hesapId || '', '— Aktif hesap bulunamadı —');
  _updateAbTutarTumBtn();
  openModal('modal-abonelik');
}

// ── Abonelik Modal: Step Wizard ──────────────────────────────────────
export let _abCurrentStep = 1;
export const AB_STEP_COUNT = 3;

export function abStepGoto(step) {
  step = Math.max(1, Math.min(AB_STEP_COUNT, step));
  _abCurrentStep = step;
  const modal = document.getElementById('modal-abonelik');
  if (!modal) return;
  // ---- Saf DOM güncelleme: js/ui/components/step-wizard.js:swizUpdateStepIndicator ----
  swizUpdateStepIndicator(modal, step);
  const backBtn = document.getElementById('ab-step-back-btn');
  const nextBtn = document.getElementById('ab-step-next-btn');
  const saveBtn = document.getElementById('ab-step-save-btn');
  if (backBtn) backBtn.style.display = step > 1 ? '' : 'none';
  if (nextBtn) nextBtn.style.display = step < AB_STEP_COUNT ? '' : 'none';
  if (saveBtn) saveBtn.style.display = step === AB_STEP_COUNT ? '' : 'none';
  const body = modal.querySelector('.modal-body');
  if (body) body.scrollTop = 0;
  if (step === AB_STEP_COUNT) _abOzetDoldur();
}

export function _abValidateStep(step) {
  if (step === 1) {
    if (!validateRequiredFields([
      {id:'ab-ad',       msg:'Abonelik adı zorunlu'},
      {id:'ab-kategori', msg:'Kategori zorunlu'}
    ])) return false;
    return true;
  }
  if (step === 2) {
    if (!validateRequiredFields([
      {id:'ab-tutar',  msg:'Tutar zorunlu'},
      {id:'ab-periyot',msg:'Periyot zorunlu'},
      {id:'ab-tarih',  msg:'Ödeme tarihi zorunlu'},
      {id:'ab-hesap',  msg:'Bağlı hesap zorunlu'}
    ])) return false;
    return true;
  }
  return true;
}

export function abStepNext() {
  if (!_abValidateStep(_abCurrentStep)) return;
  abStepGoto(_abCurrentStep + 1);
}

export function abStepBack() {
  abStepGoto(_abCurrentStep - 1);
}

export function _abOzetDoldur() {
  const ad      = (document.getElementById('ab-ad')||{}).value.trim() || '—';
  const ikon    = (document.getElementById('ab-ikon')||{}).value.trim() || '🔄';
  const kat     = (document.getElementById('ab-kategori')||{}).value || '—';
  const tutar   = getMoneyInput('ab-tutar') || 0;
  const pb      = (document.getElementById('ab-para-birimi')||{}).value || 'TRY';
  const periyotSel = document.getElementById('ab-periyot');
  const periyotTxt = periyotSel ? (periyotSel.options[periyotSel.selectedIndex]?.text || '—') : '—';
  const tarih   = (document.getElementById('ab-tarih')||{}).value || '';
  const hesapSel = document.getElementById('ab-hesap');
  const hesapTxt = hesapSel ? (hesapSel.options[hesapSel.selectedIndex]?.text || '—') : '—';
  const not     = (document.getElementById('ab-not')||{}).value.trim();

  const aylik = tutar * ({haftalik:52/12,aylik:1,'3aylik':1/3,'6aylik':1/6,yillik:1/12}[periyotSel?.value]||1);

  const satir = swizOzetSatirHtmlKisa;

  const el = document.getElementById('ab-ozet-icerik');
  if (!el) return;
  el.innerHTML = `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px 16px">
    ${satir('Abonelik', `<span style="font-family:inherit">${ikon} ${ad}</span>`)}
    ${satir('Kategori', `<span style="font-family:inherit">${kat}</span>`)}
    ${satir('Tutar', fmtCur(tutar, pb))}
    ${satir('Periyot', `<span style="font-family:inherit">${periyotTxt}</span>`)}
    ${satir('Aylık Eşdeğer', fmtCur(aylik, pb))}
    ${satir('İlk / Sonraki Ödeme', typeof fmtDate === 'function' ? fmtDate(tarih) : tarih)}
    ${satir('Bağlı Hesap', `<span style="font-family:inherit">${hesapTxt}</span>`)}
    ${not ? satir('Not', `<span style="font-family:inherit">${not}</span>`) : ''}
  </div>`;
}

export function saveAbonelik() {
  const banner = document.getElementById('ab-error-banner');
  // Reset
  banner.style.display = 'none';
  ['ab-ad','ab-tutar','ab-kategori','ab-periyot','ab-tarih'].forEach(id=>{
    document.getElementById(id).classList.remove('field-error');
  });

  const ad = document.getElementById('ab-ad').value.trim();
  const tutar = getMoneyInput('ab-tutar') || 0;
  const kategori = document.getElementById('ab-kategori').value;
  const periyot = document.getElementById('ab-periyot').value;
  const tarih = document.getElementById('ab-tarih').value;
  const hesapId = document.getElementById('ab-hesap').value;

  const missing = [];
  if(!ad) missing.push('Abonelik Adı');
  if(!tutar) missing.push('Tutar');
  if(!kategori) missing.push('Kategori');
  if(!periyot) missing.push('Periyot');
  if(!tarih) missing.push('Ödeme Tarihi');
  if(!hesapId) missing.push('Bağlı Hesap');

  if(missing.length) {
    banner.innerHTML = '⚠️ Zorunlu alanları doldurun: ' + missing.join(', ');
    banner.style.display = 'flex';
    // Shake invalid fields
    const idMap = {'Abonelik Adı':'ab-ad','Tutar':'ab-tutar','Kategori':'ab-kategori','Periyot':'ab-periyot','Ödeme Tarihi':'ab-tarih','Bağlı Hesap':'ab-hesap'};
    missing.forEach(f=>{
      const el = document.getElementById(idMap[f]);
      if(el){ el.classList.add('field-error','shake'); setTimeout(()=>el.classList.remove('shake'),450); }
    });
    return;
  }
  if(!DB.abonelikler) DB.abonelikler = [];
  const ab = {
    id: editAbonelikId || uid(),
    ad,
    ikon: document.getElementById('ab-ikon').value.trim() || '🔄',
    kategori: document.getElementById('ab-kategori').value,
    periyot: document.getElementById('ab-periyot').value,
    tutar: -Math.abs(tutar), // gider
    paraBirimi: document.getElementById('ab-para-birimi').value,
    tarih: document.getElementById('ab-tarih').value || localDateStr(new Date()),
    hesapId: document.getElementById('ab-hesap').value || null,
    not: document.getElementById('ab-not').value.trim(),
  };
  const isEdit = !!editAbonelikId; // fix: kaydet öncesi durumu sakla
  if(isEdit) {
    const idx = DB.abonelikler.findIndex(x=>x.id===editAbonelikId);
    if(idx>=0) DB.abonelikler[idx] = ab;
  } else {
    DB.abonelikler.push(ab);
  }
  editAbonelikId = null;
  saveData();
  closeModal('modal-abonelik');
  renderAbonelik();
  showToast(isEdit ? 'Abonelik güncellendi ✓' : 'Abonelik eklendi ✓');
}

export function deleteAbonelik(id) {
  showConfirm('Bu aboneliği silmek istiyor musunuz?', ()=>{
    DB.abonelikler = (DB.abonelikler||[]).filter(x=>x.id!==id);
    saveData(); renderAbonelik();
  });
}

export function abonelikSirala(key, yon) {
  tblSiralamaAyarla('abonelik', key, yon);
  renderAbonelik();
}
export function renderAbonelik() {
  if(!DB.abonelikler) DB.abonelikler = [];
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = localDateStr(today);
  const thisMonth = todayStr.slice(0,7);

  // Stats — para birimleri karışmasın diye aylık/yıllık toplamlar para birimine göre gruplu.
  const aktif = DB.abonelikler.filter(a => a.durum !== 'pasif' && !a.pasif);
  const abAylikMap = {};
  aktif.forEach(a=>{
    const cur = a.paraBirimi || defaultCurrency || 'TRY';
    abAylikMap[cur] = (abAylikMap[cur]||0) + abAylikTutar(a);
  });
  const abYillikMap = {};
  Object.entries(abAylikMap).forEach(([cur,v]) => { abYillikMap[cur] = v * 12; });
  const fmtMultiCurAb = (map) => {
    const entries = Object.entries(map).filter(([,v])=>v);
    if(!entries.length) return fmtCur(0, defaultCurrency);
    return entries.map(([cur,v]) => fmtCur(v, cur)).join(' + ');
  };
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth()+1, 0);
  const buAyOdenecek = aktif.filter(a=>{
    const base = new Date(a.tarih||new Date()); if(isNaN(base)) return false;
    let d = new Date(base);
    const perMap2 = {haftalik:null,aylik:1,"3aylik":3,"6aylik":6,yillik:12};
    if(a.periyot==="haftalik"){while(d<monthStart)d.setDate(d.getDate()+7);return d<=monthEnd;}
    const mo=perMap2[a.periyot]||1; while(d<monthStart)d.setMonth(d.getMonth()+mo);
    return d<=monthEnd;
  }).length;
  const statsEl = document.getElementById('abonelik-stats');
  if(statsEl) statsEl.innerHTML = `
    <div class="stat s-blue"><div class="stat-label">Aktif Abonelik</div><div class="stat-val blue">${aktif.length}</div></div>
    <div class="stat s-red"><div class="stat-label">Aylık Toplam</div><div class="stat-val red">${fmtMultiCurAb(abAylikMap)}</div></div>
    <div class="stat s-red"><div class="stat-label">Yıllık Toplam</div><div class="stat-val red">${fmtMultiCurAb(abYillikMap)}</div></div>
    <div class="stat s-warn"><div class="stat-label">Bu Ay Ödeme</div><div class="stat-val" style="color:var(--warn)">${buAyOdenecek}</div></div>`;

  const katIkon = {eglence:'🎬',muzik:'🎵',yazilim:'💻',fatura:'⚡',sigorta:'🛡️',spor:'🏋️',egitim:'📚',diger:'📦'};
  const katAd = {eglence:'Eğlence',muzik:'Müzik',yazilim:'Yazılım',fatura:'Fatura',sigorta:'Sigorta',spor:'Spor',egitim:'Eğitim',diger:'Diğer'};
  const perLabel = {haftalik:'Haftalık','aylik':'Aylık','3aylik':'3 Aylık','6aylik':'6 Aylık',yillik:'Yıllık'};

  const _abonelikKatFiltre = tblFiltreOku('abonelik', 'kategori');
  const _abonelikDurumFiltre = tblFiltreOkuMulti('abonelik', 'durum');
  const abonelikFiltreBarEl = document.getElementById('abonelik-filtre-bar');
  if(abonelikFiltreBarEl) {
    const katSet = [...new Set(aktif.map(a=>a.kategori).filter(Boolean))];
    const katOpts = [{value:'', label:'◆ Tümü'}].concat(
      katSet.map(k => ({ value:k, label: (katIkon[k]||'📦')+' '+(katAd[k]||k) }))
    );
    abonelikFiltreBarEl.innerHTML = (katSet.length
      ? tblFiltreChipsHtml('KATEGORİ', katOpts, _abonelikKatFiltre, 'setAbonelikKategoriFiltre') + tblFiltreClearHtml(_abonelikKatFiltre, 'setAbonelikKategoriFiltre')
      : '') + tblFiltreChipsMultiHtml('ÖDEME DURUMU', ODEME_DURUM_FILTRE_OPTS, _abonelikDurumFiltre, 'setAbonelikDurumFiltre') + tblFiltreClearMultiHtml(_abonelikDurumFiltre, 'setAbonelikDurumFiltre');
    // [ES module] onclick="setAbonelikKategoriFiltre(...)"/"setAbonelikDurumFiltre(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
    bindTblFiltreChips(abonelikFiltreBarEl, { setAbonelikKategoriFiltre, setAbonelikDurumFiltre });
  }
  // Bu ayki fiili ödeme durumu
  const _abonelikGuncelDurum = (ab) => odEfektifDurum(odGetDurum(ab, thisMonth), localDateStr(abNextDate(ab)));

  // ── Sıralama (DB.uiSiralama.abonelik içinde kalıcı) ──
  const _abonelikAktifSirala = tblSiralamaOku('abonelik', 'tarih', 'asc');
  const abonelikSiralamaBarEl = document.getElementById('abonelik-siralama-bar');
  if(abonelikSiralamaBarEl) {
    abonelikSiralamaBarEl.innerHTML = tblSiralamaBarHtml([
      {key:'tarih', label:'Sonraki Ödeme', ikon:'takvim', yon:'asc'},
      {key:'tutar', label:'Tutar', ikon:'tutar', yon:'desc'},
      {key:'ad', label:'İsim', ikon:'harf', yon:'asc'},
      {key:'kategori', label:'Kategori', ikon:'tur', yon:'asc'}
    ], _abonelikAktifSirala, 'abonelikSirala');
    // [ES module] onclick="abonelikSirala(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
    bindTblFiltreChips(abonelikSiralamaBarEl, { abonelikSirala });
  }
  const sorted = tblSiralamaUygula(DB.abonelikler, _abonelikAktifSirala, {
    tarih: (a,b)=>abNextDate(a)-abNextDate(b),
    tutar: (a,b)=>abAylikTutar(a)-abAylikTutar(b),
    ad: (a,b)=>String(a.ad||'').localeCompare(String(b.ad||''),'tr'),
    kategori: (a,b)=>String(a.kategori||'').localeCompare(String(b.kategori||''),'tr')
  })
    .filter(a => !_abonelikKatFiltre || a.kategori === _abonelikKatFiltre)
    .filter(a => !_abonelikDurumFiltre.length || _abonelikDurumFiltre.includes(_abonelikGuncelDurum(a)));

  const tbody = document.getElementById('abonelik-tbody');
  if(!tbody) return;
  tbody.innerHTML = sorted.map(ab=>{
    const next = abNextDate(ab);
    const nextStr = localDateStr(next);
    const daysLeft = Math.ceil((next-today)/86400000);
    const hesap = ab.hesapId ? (DB.hesaplar||[]).find(h=>h.id===ab.hesapId) : null;
    const buAyKey = thisMonth;
    const buAyOd = odGetDurum(ab, buAyKey);
    const yaklasiyor = daysLeft <= 7 && daysLeft >= 0;
    const gecikti = daysLeft < 0;
    return `<tr>
      <td><span style="margin-right:6px">${ab.ikon||'🔄'}</span><b>${ab.ad}</b>${ab.not?`<div style="font-size:10px;color:var(--text3);margin-top:2px">${ab.not}</div>`:''}</td>
      <td><span style="font-size:11px">${katIkon[ab.kategori]||'📦'} ${ab.kategori}</span></td>
      <td class="mono red">${fmtCur(Math.abs(ab.tutar),ab.paraBirimi||'TRY')}<div style="font-size:10px;color:var(--text3)">${fmtCur(abAylikTutar(ab),ab.paraBirimi||'TRY')}/ay</div></td>
      <td><span class="badge badge-purple">${perLabel[ab.periyot]||ab.periyot}</span></td>
      <td class="mono"><span class="${yaklasiyor?'orange':gecikti?'red':''}">${fmtDate(nextStr)}</span><div style="font-size:10px;color:${daysLeft<=3?'var(--rose)':daysLeft<=7?'var(--warn)':'var(--text3)'}">${daysLeft===0?'Bugün':daysLeft>0?daysLeft+' gün':Math.abs(daysLeft)+' gün gecikti'}</div></td>
      <td style="font-size:11px">${hesap?hesap.ad:'<span style="color:var(--text3)">—</span>'}</td>
      <td>${odToggleBtn('abonelik', ab.id, buAyKey, nextStr, Math.abs(ab.tutar), ab.ad)}</td>
      <td style="white-space:nowrap;position:sticky;right:0;background:var(--surface);z-index:1">
        <button class="btn btn-ghost btn-sm btn-act abonelik-edit-btn" data-id="${ab.id}" style="margin-right:4px"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/></svg></button>
        <button class="btn btn-danger btn-sm btn-act abonelik-del-btn" data-id="${ab.id}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><polyline points="3,5 13,5"/><path d="M6 5V3h4v2M5 5l1 9h4l1-9"/></svg></button>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:20px">${(_abonelikKatFiltre||_abonelikDurumFiltre.length)?'Bu filtreye uyan abonelik yok':'Abonelik bulunamadı — + Abonelik Ekle ile başlayın'}</td></tr>`;
  // [ES module] onclick="openAbonelikModal(...)" ve onclick="deleteAbonelik(...)" kaldırıldı.
  tbody.querySelectorAll('.abonelik-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openAbonelikModal(btn.getAttribute('data-id')));
  });
  tbody.querySelectorAll('.abonelik-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteAbonelik(btn.getAttribute('data-id')));
  });
}

// (14. tur refactor / patch melt) renderPage'e abonelik ekleyen wrap SİLİNDİ.
// Sebep: odeme.js'nin RENDERERS tablosu zaten 'abonelik':'renderAbonelik' içeriyor,
// yani window.renderPage'in GÜNCEL (installRenderOverrides'tan gelen) hâli
// renderDirect() üzerinden abonelik'i çoktan doğru render ediyordu — bu wrap
// devrede olsaydı bile renderAbonelik() İKİ KERE çağrılmış olacaktı. Üstelik
// devrede de değildi: installRenderOverrides() DOMContentLoaded'da ve
// 80/250/700/1300ms zamanlayıcılarında window.renderPage'i KOŞULSUZ olarak
// SIFIRDAN bir kapatmayla değiştiriyor (öncekini hiç referans almadan) — yani
// bu dosyanın kurduğu wrap, sayfa yüklendikten kısa süre sonra otomatik olarak
// eziliyordu. odGetItem/odRenderPage/_otoBakiyeGuncelle wrap'leri KORUNDU —
// onlar RENDERERS gibi merkezi bir tabloya sahip değil, abonelik'i ödeme
// popup'ına bağlayan tek yer onlar.
(function() {
  // [ES module] eskiden window.odGetItem/window.odRenderPage üzerinden
  // okunup window'a geri yazılıyordu; export binding'leri immutable olduğu
  // için bu, 02-sayfa-render.js'nin export ettiği gerçek odGetItem/
  // odRenderPage'i ASLA etkilemiyordu (sessiz bug — abonelik ödeme
  // popup'ına hiç bağlanmamış olabilirdi). Artık get/register ile
  // wrap-registry üzerinden doğru şekilde zincirleniyor.
  const _origOdGetItem = get('odGetItem');
  register('odGetItem', function(tip, id) {
    if(tip === 'abonelik') return (DB.abonelikler||[]).find(x=>x.id===id);
    if(typeof _origOdGetItem === 'function') return _origOdGetItem(tip, id);
    return null;
  });
  // odRenderPage'e abonelik ekle
  const _origOdRenderPage = get('odRenderPage');
  register('odRenderPage', function(tip) {
    if(tip === 'abonelik') { renderAbonelik(); return; }
    if(typeof _origOdRenderPage === 'function') _origOdRenderPage.apply(this, arguments);
  });
})();

// (17. tur refactor / davranış düzeltmesi) _otoBakiyeGuncelle wrap'i buraya
// taşındı ve DOMContentLoaded'a ertelendi. Sebep: bu fonksiyonun tabanı
// (plain `function _otoBakiyeGuncelle(){...}`) mobile-nav-tema.js'de
// tanımlı, ama o dosya index.html'de abonelik.js'den SONRA yükleniyor —
// yani anında çalışan bir wrap burada `window._otoBakiyeGuncelle`'ı henüz
// hiç bulamıyordu (undefined yakalıyordu), VE mobile-nav-tema.js daha sonra
// yüklendiğinde kendi plain tanımıyla (wrap'siz) üstüne yazıyordu — abonelik
// tipi işlemler için bakiye güncellemesi hiç çalışmıyor olabilirdi.
// DOMContentLoaded, script bloğundaki TÜM dosyalar (sıraları ne olursa
// olsun) yüklendikten sonra ateşlendiği için, hangi dosyanın önce/sonra
// geldiği artık önemli değil.
export function _rfAbonelikOtoBakiyeWrap(){
  const orig = get('_otoBakiyeGuncelle');
  if(typeof orig !== 'function' || orig._rfAbonelikWrapped) return;
  const wrapped = function(tip, id, key, durum, tutar) {
    if(tip === 'abonelik') { entAbonelikYansit(id, key, durum, tutar); return; }
    return orig(tip, id, key, durum, tutar);
  };
  wrapped._rfAbonelikWrapped = true;
  register('_otoBakiyeGuncelle', wrapped);
}
if(document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _rfAbonelikOtoBakiyeWrap, { once:true });
} else {
  _rfAbonelikOtoBakiyeWrap();
}

export function entAbonelikYansit(abId, ayKey, durum, tutar) {
  const ab = (DB.abonelikler||[]).find(x=>x.id===abId);
  if(!ab || !ab.hesapId) return;
  const lk = call('_lKey', 'abonelik', abId, ayKey);
  const eski = call('_lGet', lk) || 0;
  if(!durum || ['bekliyor','ertelendi','gecikti'].includes(durum)) {
    if(eski !== 0) { _bakiyeDelta(ab.hesapId, eski); call('_lDel', lk); _sync(); }
    return;
  }
  if(['iptal'].includes(durum)) {
    if(eski !== 0) { _bakiyeDelta(ab.hesapId, eski); call('_lDel', lk); _sync(); }
    return;
  }
  if(['odendi','kismi'].includes(durum)) {
    const yeni = tutar || Math.abs(ab.tutar);
    const delta = yeni - eski;
    if(Math.abs(delta) < 0.001) return;
    if(_bakiyeDelta(ab.hesapId, -delta)) { call('_lSet', lk, yeni); _sync('Abonelik ödendi — bakiye düşüldü'); }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. GRAFİK DASHBOARD — özet sayfasına SVG grafikler
// ══════════════════════════════════════════════════════════════════════════════

(function injectGrafikStyles() {
  const s = document.createElement('style');
  s.textContent = `
    /* ═══ ÖZET SAYFASI — DASHBOARD YENİDEN TASARIM ═══════════════════ */

    /* ── Section label ── */
    .ozet-section-label {
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em;
      color: var(--text3); margin: 4px 0 12px; display: flex; align-items: center; gap: 10px;
    }
    .ozet-section-label::after { content:''; flex:1; height:1px; background: var(--border); }

    /* ── HERO: Net Varlık şeridi ── */
    .ozet-hero {
      display: grid; grid-template-columns: 1.3fr auto 1fr; align-items: center; gap: 28px;
      background: linear-gradient(135deg, rgba(251,191,36,.07) 0%, rgba(45,212,191,.04) 100%);
      border: 1px solid var(--border2);
      border-radius: 20px;
      padding: 22px 28px;
      margin-bottom: 20px;
      position: relative;
      overflow: hidden;
    }
    .ozet-hero::before {
      content:''; position:absolute; top:-40%; right:-8%; width:260px; height:260px;
      background: radial-gradient(circle, rgba(251,191,36,.1), transparent 70%);
      pointer-events:none;
    }
    .ozet-hero-label { font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--text3); margin-bottom: 6px; }
    .ozet-hero-val { font-family: var(--serif, 'Playfair Display', serif); font-size: 38px; font-weight: 700; line-height: 1; letter-spacing: -.01em; }
    .ozet-hero-val.pos { color: var(--teal); }
    .ozet-hero-val.neg { color: var(--rose); }
    .ozet-hero-sub { font-size: 11.5px; color: var(--text3); margin-top: 8px; }
    .ozet-hero-split { display:flex; flex-direction:column; gap:14px; padding: 0 24px; border-left: 1px solid var(--border); border-right: 1px solid var(--border); height: 100%; justify-content:center; }
    .ozet-hero-mini { display:flex; align-items:center; gap:10px; }
    .ozet-hero-mini-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    .ozet-hero-mini-dot.pos { background: var(--teal); box-shadow: 0 0 8px rgba(45,212,191,.6); }
    .ozet-hero-mini-dot.neg { background: var(--rose); box-shadow: 0 0 8px rgba(251,113,133,.6); }
    .ozet-hero-mini-label { font-size: 10.5px; color: var(--text3); text-transform: uppercase; letter-spacing: .06em; }
    .ozet-hero-mini-val { font-family: var(--mono); font-size: 15px; font-weight: 600; margin-top: 1px; }
    .ozet-hero-mini-val.pos { color: var(--text); }
    .ozet-hero-mini-val.neg { color: var(--text); }
    .ozet-hero-bar { height: 8px; border-radius: 99px; background: rgba(251,113,133,.25); overflow: hidden; align-self: center; }
    .ozet-hero-bar-fill { height: 100%; background: linear-gradient(90deg, var(--teal), #5eead4); border-radius: 99px; }
    @media(max-width: 900px) {
      .ozet-hero { grid-template-columns: 1fr; gap: 16px; }
      .ozet-hero-split { flex-direction: row; border-left:none; border-right:none; border-top:1px solid var(--border); border-bottom:1px solid var(--border); padding: 14px 0; justify-content: space-between; }
      .ozet-hero-bar { display:none; }
    }

    /* ── STAT KARTLARI (Özet sayfasına özel) ── */
    .ozet-stat-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; }
    @media(max-width:1300px) { .ozet-stat-grid { grid-template-columns: repeat(3, 1fr); } }
    @media(max-width:700px)  { .ozet-stat-grid { grid-template-columns: repeat(2, 1fr); } }
    .ozet-stat {
      background: var(--surface); border: 1px solid var(--border2); border-radius: 14px;
      padding: 16px 16px 14px; position: relative; overflow: hidden;
      transition: var(--transition, all .18s ease);
    }
    .ozet-stat::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; }
    .ozet-stat:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.18); border-color: var(--border-active, var(--border2)); }
    .ozet-stat.os-warn::before   { background: var(--warn); }
    .ozet-stat.os-blue::before   { background: var(--sky); }
    .ozet-stat.os-red::before    { background: var(--rose); }
    .ozet-stat.os-green::before  { background: var(--teal); }
    .ozet-stat-top { display:flex; align-items:center; justify-content:space-between; margin-bottom: 10px; }
    .ozet-stat-icon {
      width: 30px; height: 30px; border-radius: 9px; display:flex; align-items:center; justify-content:center;
      background: var(--surface3); border: 1px solid var(--border2); color: var(--text2); flex-shrink:0;
    }
    .ozet-stat.os-warn  .ozet-stat-icon { background: rgba(251,146,60,.1);  border-color: rgba(251,146,60,.25);  color: var(--warn); }
    .ozet-stat.os-blue  .ozet-stat-icon { background: rgba(56,189,248,.1);  border-color: rgba(56,189,248,.25);  color: var(--sky); }
    .ozet-stat.os-red   .ozet-stat-icon { background: rgba(251,113,133,.1); border-color: rgba(251,113,133,.25); color: var(--rose); }
    .ozet-stat.os-green .ozet-stat-icon { background: rgba(45,212,191,.1);  border-color: rgba(45,212,191,.25);  color: var(--teal); }
    .ozet-stat-pct { font-size: 11px; font-family: var(--mono); font-weight: 700; color: var(--warn); }
    .ozet-stat-label { font-size: 11px; color: var(--text3); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; }
    .ozet-stat-val { font-family: var(--mono); font-size: 20px; font-weight: 700; color: var(--text); line-height: 1.1; }
    .ozet-stat.os-warn  .ozet-stat-val { color: var(--warn); }
    .ozet-stat.os-blue  .ozet-stat-val { color: var(--sky); }
    .ozet-stat.os-red   .ozet-stat-val { color: var(--rose); }
    .ozet-stat.os-green .ozet-stat-val { color: var(--teal); }
    .ozet-stat-sub { font-size: 10.5px; color: var(--text3); margin-top: 6px; }
    .ozet-stat-mini-bar { height: 4px; border-radius: 99px; background: var(--surface3); overflow: hidden; margin-top: 8px; }
    .ozet-stat-mini-fill { height: 100%; background: var(--warn); border-radius: 99px; }
    .ozet-stat-wide { grid-column: span 2; }
    @media(max-width:1300px) { .ozet-stat-wide { grid-column: span 1; } }
    .ozet-stat .nb-chips { display:flex; flex-wrap:wrap; gap:5px; margin-top:9px; }

    /* ── Mevduat tablosu — renk/görsel zenginleştirme ────────────── */
    .mev-pct-badge {
      display: inline-flex;
      padding: 2px 7px;
      border-radius: 5px;
      font-size: 11px;
      font-weight: 700;
    }
    .mev-pct-faiz   { background: rgba(45,212,191,.1);  color: var(--accent2); }
    .mev-pct-stopaj { background: rgba(251,146,60,.1);  color: var(--warn); }
    .mev-vade-wrap {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 46px;
    }
    .mev-vade-gun { font-size: 11.5px; font-weight: 600; color: var(--text2); }
    .mev-vade-bar {
      height: 4px;
      border-radius: 99px;
      background: var(--surface3);
      overflow: hidden;
    }
    .mev-vade-bar-fill {
      height: 100%;
      border-radius: 99px;
      transition: width .4s ease;
    }
    .mev-nihai-pill {
      display: inline-flex;
      padding: 3px 9px;
      border-radius: 6px;
      background: rgba(45,212,191,.1);
      color: var(--accent2);
      font-weight: 700;
    }

    /* ── Kart Limit Kullanımı — yeniden tasarım ──────────────────── */
    .kl-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 4px;
      border-bottom: 1px solid var(--border);
      transition: background .15s;
    }
    .kl-row:last-child { border-bottom: none; padding-bottom: 4px; }
    .kl-row:hover { background: rgba(255,255,255,.018); border-radius: 10px; }
    html[data-theme="light"] .kl-row:hover { background: rgba(0,0,0,.015); }
    .kl-mini-card {
      position: relative;
      width: 42px; height: 28px;
      border-radius: 7px;
      flex-shrink: 0;
      margin-top: 1px;
      overflow: hidden;
      background:
        radial-gradient(140% 190% at 10% -15%, color-mix(in srgb, var(--kl-accent, var(--accent)) 45%, transparent) 0%, transparent 60%),
        linear-gradient(135deg, color-mix(in srgb, var(--kl-accent, var(--accent)) 24%, #0b0e17) 0%, #090c14 70%);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.06), 0 1px 3px rgba(0,0,0,.25);
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      padding: 3px;
    }
    .kl-mini-card::after {
      content: '';
      position: absolute; inset: 0;
      background: repeating-linear-gradient(115deg, rgba(255,255,255,.04) 0 1.5px, transparent 1.5px 8px);
      pointer-events: none;
    }
    .kl-mini-card-chip {
      position: absolute; top: 5px; left: 4px;
      width: 10px; height: 7.5px;
      border-radius: 2px;
      background: linear-gradient(155deg, #f5dd9f, #c99a3d);
      box-shadow: inset 0 0 0 .5px rgba(0,0,0,.3);
    }
    .kl-mini-card-net {
      position: relative; z-index: 1;
      display: inline-flex; align-items: center; justify-content: center;
      line-height: 0;
      filter: drop-shadow(0 1px 1.5px rgba(0,0,0,.4));
    }
    .kl-mini-card-net svg, .kl-mini-card-net img { display: block; width: 18px; height: auto; }
    .kl-main { flex: 1; min-width: 0; }
    .kl-top {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 7px;
    }
    .kl-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
      display: inline-flex;
      align-items: baseline;
      gap: 6px;
      min-width: 0;
      flex: 1 1 auto;
    }
    .kl-name-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      flex-shrink: 1;
    }
    .kl-name-no {
      font-size: 10px;
      font-weight: 500;
      color: var(--text3);
      letter-spacing: .03em;
      flex-shrink: 0;
      opacity: .8;
    }
    .kl-grup-badge {
      display: inline-flex;
      color: var(--violet);
      opacity: .8;
      flex-shrink: 0;
    }
    .kl-pct {
      font-family: var(--mono);
      font-size: 11.5px;
      font-weight: 700;
      flex-shrink: 0;
      padding: 1px 7px;
      border-radius: 20px;
    }
    .kl-pct-ok     { color: var(--accent2); background: rgba(45,212,191,.12); }
    .kl-pct-warn   { color: var(--warn);    background: rgba(251,191,36,.12); }
    .kl-pct-danger { color: var(--danger);  background: rgba(251,113,133,.14); }
    .kl-bar {
      height: 6px;
      border-radius: 99px;
      background: var(--surface3);
      overflow: hidden;
      margin-bottom: 7px;
    }
    .kl-bar-fill {
      height: 100%;
      border-radius: 99px;
      transition: width .55s cubic-bezier(.4,0,.2,1);
      position: relative;
    }
    .kl-bar-fill::after {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(180deg, rgba(255,255,255,.3), transparent);
    }
    .kl-bottom {
      display: flex;
      align-items: baseline;
      gap: 5px;
      font-size: 11.5px;
    }
    .kl-used { color: var(--text2); font-weight: 600; }
    .kl-sep { color: var(--text3); opacity: .5; }
    .kl-limit { color: var(--text3); }
    .kl-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 32px 16px;
      color: var(--text3);
      font-size: 12.5px;
    }

    /* ── Grafik kartları ── */
    #ozet-grafik-row { display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:16px;margin-bottom:18px; }
    #ozet-grafik-row > div:first-child { grid-column: 1 / -1; }
    @media(max-width:1300px){ #ozet-grafik-row { grid-template-columns:1fr 1fr; } }
    @media(max-width:700px){ #ozet-grafik-row { grid-template-columns:1fr; } }
    .grafik-card {
      background: linear-gradient(145deg, var(--surface) 0%, var(--bg2) 100%);
      border: 1px solid var(--border2);
      border-radius: 18px;
      padding: 20px 22px;
      transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease;
      position: relative;
      overflow: hidden;
    }
    .grafik-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,.025) 0%, transparent 60%);
      pointer-events: none;
      border-radius: inherit;
    }
    .grafik-card:hover {
      border-color: rgba(255,255,255,.16);
      transform: translateY(-2px);
      box-shadow: 0 16px 40px rgba(0,0,0,.35);
    }
    .grafik-card-wide { grid-column: span 1; }
    .grafik-title {
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .1em;
      color: var(--text3);
      margin-bottom: 18px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .grafik-title-icon { font-size: 14px; opacity: .9; }
    .grafik-legend { display:flex;gap:12px;flex-wrap:wrap;margin-top:14px;align-items:center; }
    .grafik-legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      color: var(--text2);
      padding: 2px 8px 2px 5px;
      border-radius: 20px;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.06);
    }
    .grafik-legend-dot { width:7px;height:7px;border-radius:50%;flex-shrink:0; }
    .grafik-legend-net { margin-left:auto;font-size:11.5px;font-family:var(--mono);font-weight:700;padding:3px 11px;border-radius:99px; }
    .grafik-legend-net.pos { color: var(--teal); background: rgba(45,212,191,.12); border: 1px solid rgba(45,212,191,.2); }
    .grafik-legend-net.neg { color: var(--rose); background: rgba(251,113,133,.12); border: 1px solid rgba(251,113,133,.2); }
    .grafik-empty { color:var(--text3);font-size:12px; padding: 36px 0; text-align:center; }
    .bar-chart-wrap { display:flex;align-items:flex-end;gap:5px;height:140px;padding-top:4px; }
    .bar-group { display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;min-width:0; cursor: default; border-radius: 6px; padding: 3px; transition: background .15s; }
    .bar-group:hover { background: rgba(255,255,255,.04); }
    .bar-pair { display:flex;gap:3px;align-items:flex-end;width:100%;height:110px; }
    .bar-segment { border-radius:5px 5px 0 0;min-height:2px;transition:height .5s cubic-bezier(.4,0,.2,1), opacity .15s; }
    .bar-gelir { background: linear-gradient(180deg, rgba(94,234,212,.9), var(--teal)); box-shadow: 0 -2px 8px rgba(45,212,191,.2); }
    .bar-gider { background: linear-gradient(180deg, rgba(253,164,175,.9), var(--rose)); box-shadow: 0 -2px 8px rgba(251,113,133,.2); }
    .bar-group:hover .bar-segment { opacity: .8; filter: brightness(1.1); }
    .bar-label { font-size:9.5px;color:var(--text3);text-align:center;white-space:nowrap;overflow:hidden;width:100%;text-overflow:ellipsis; }
    .bar-group-current .bar-label { color: var(--gold); font-weight: 700; }
    .bar-group-current .bar-segment { filter: brightness(1.1); }
    .donut-wrap { display:flex;align-items:center;gap:18px;flex-wrap:wrap; }
    .donut-wrap > svg { flex-shrink:0; }
    .donut-legend { display:flex;flex-direction:column;gap:8px;flex:1;min-width:140px; }
    .donut-legend-row { display:flex;align-items:center;gap:7px;font-size:11.5px;min-width:0; }
    .donut-legend-bar { height:6px;border-radius:99px;flex:1;min-width:40px;opacity:.8; }
    .donut-legend-val { font-size:11px;font-family:var(--mono);color:var(--text2);text-align:right;min-width:0;flex-shrink:0; }
    .net-servet-bar { display:flex;height:10px;border-radius:99px;overflow:hidden;margin:6px 0 3px; }
    .cash-flow-svg text { font-family:var(--mono, monospace); }

    /* ── Ring (dairesel progress) kartı ── */
    .grafik-card-ring { display:flex; flex-direction:column; }
    .ring-wrap { position: relative; width: 108px; height: 108px; margin: 0 auto 16px; filter: drop-shadow(0 4px 12px rgba(0,0,0,.3)); }
    .ring-svg circle { transition: stroke-dashoffset .5s cubic-bezier(.4,0,.2,1); }
    .ring-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0 6px; }
    .ring-net { font-family: var(--mono); font-size: 14px; font-weight: 700; max-width: 82px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.1; }
    .ring-net.sz-sm { font-size: 12px; }
    .ring-net.sz-xs { font-size: 10.5px; }
    .ring-net.sz-xxs { font-size: 9px; letter-spacing: -.2px; }
    .ring-net.pos { color: var(--teal); text-shadow: 0 0 12px rgba(45,212,191,.3); }
    .ring-net.neg { color: var(--rose); text-shadow: 0 0 12px rgba(251,113,133,.3); }
    .ring-net-label { font-size: 9px; color: var(--text3); text-transform: uppercase; letter-spacing: .07em; margin-top: 2px; }
    .ring-rows { display:flex; flex-direction:column; gap: 10px; }
    .ring-row { display:flex; align-items:center; gap: 8px; font-size: 12px; }
    .ring-row-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
    .ring-row-dot.pos { background: var(--teal); box-shadow: 0 0 6px rgba(45,212,191,.5); }
    .ring-row-dot.neg { background: var(--rose); box-shadow: 0 0 6px rgba(251,113,133,.5); }
    .ring-row-label { color: var(--text2); flex:1; }
    .ring-row-val { font-family: var(--mono); font-weight: 700; font-size: 12.5px; }
    .ring-row-val.pos { color: var(--teal); }
    .ring-row-val.neg { color: var(--rose); }

    /* ── Nakit Akış (nka) stilleri ── */
    .nka-stats { display:grid; grid-template-columns:1fr auto 1fr auto 1fr; align-items:center; gap:0; padding:14px 16px 12px; border-bottom:1px solid var(--border); }
    .nka-stat { display:flex; flex-direction:column; align-items:center; gap:3px; }
    .nka-stat-label { font-size:9.5px; font-weight:600; color:var(--text3); text-transform:uppercase; letter-spacing:.06em; white-space:nowrap; }
    .nka-stat-val { font-family:var(--mono); font-size:15px; font-weight:700; white-space:nowrap; }
    .nka-gelir { color:var(--teal); }
    .nka-gider { color:var(--rose); }
    .nka-stat-divider { width:1px; height:32px; background:var(--border); margin:0 8px; }
    .nka-chart-wrap { padding:10px 14px 2px; }
    .nka-legend { display:flex; align-items:center; gap:12px; padding:4px 14px 10px; flex-wrap:wrap; }
    .nka-legend-item { display:flex; align-items:center; gap:5px; font-size:10.5px; color:var(--text2); }
    .nka-legend-dot { width:8px; height:8px; border-radius:2px; flex-shrink:0; }
    .nka-list { border-top:1px solid var(--border); display:flex; flex-direction:column; }
    .nka-row { display:grid; grid-template-columns:28px 1fr auto; align-items:center; gap:10px; padding:9px 14px; border-bottom:1px solid var(--border); transition:background .12s; }
    .nka-row:last-child { border-bottom:none; }
    .nka-row:hover { background:var(--surface2); }
    .nka-row-today { background:rgba(251,191,36,.04); border-left:2px solid var(--gold); }
    .nka-row-today:hover { background:rgba(251,191,36,.07); }
    .nka-row-past { opacity:.65; }
    .nka-row-icon { font-size:16px; text-align:center; }
    .nka-row-info { min-width:0; }
    .nka-row-aciklama { font-size:12.5px; font-weight:500; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .nka-row-meta { font-size:10.5px; color:var(--text3); margin-top:1px; }
    .nka-row-tutar { font-family:var(--mono); font-size:13px; font-weight:700; white-space:nowrap; text-align:right; }
    .nka-bar { transition:opacity .15s; }
    .nka-bar:hover { opacity:1 !important; }
    html[data-theme="light"] .nka-row-today { background:rgba(196,122,0,.05); }
    @media(max-width:480px) { .nka-stat-val { font-size:13px; } .nka-stats { padding:12px 10px 10px; } .nka-legend { padding:4px 10px 8px; } .nka-row { padding:8px 10px; } }
    .debt-total { font-family: var(--mono); font-size: 24px; font-weight: 700; color: var(--rose); margin-bottom: 10px; }
    .debt-bar { height: 8px; border-radius: 99px; background: rgba(251,113,133,.25); overflow:hidden; margin-bottom: 4px; }
    .debt-bar-fill { height: 100%; background: var(--rose); border-radius: 99px; }

    /* ── Kartlar (Özet sayfasındaki .card override) ── */
    .ozet-card { transition: var(--transition, all .18s ease); }
    .ozet-card:hover { border-color: var(--border-active, var(--border2)); }

    /* ── Yaklaşan ödemeler — satır listesi ── */
    .ozet-od-list { display:flex; flex-direction:column; max-height: 480px; overflow-y: auto; padding-right: 4px; }
    .ozet-od-row {
      display:grid; grid-template-columns: var(--od-cols, 44px 28px 34px 1fr auto auto); align-items:center; gap: 14px;
      padding: 12px 6px; border-bottom: 1px solid var(--border);
      transition: background .15s;
    }
    .ozet-od-row:last-child { border-bottom: none; }
    .ozet-od-row:hover { background: var(--surface2); }
    .ozet-od-date { text-align:center; line-height:1.1; }
    .ozet-od-day { font-family: var(--mono); font-size: 16px; font-weight: 700; color: var(--text); }
    .ozet-od-month { font-size: 9px; color: var(--text3); text-transform:uppercase; letter-spacing:.05em; }
    .ozet-od-icon { font-size: 16px; text-align:center; opacity:.85; }
    .ozet-od-banka-col { display:flex; align-items:center; justify-content:center; }
    .ozet-od-banka-mobile { display:none; }
    .ozet-od-info { min-width: 0; }
    .ozet-od-aciklama { font-size: 13px; color: var(--text); font-weight: 500; margin-bottom: 4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ozet-od-meta { display:flex; align-items:center; gap: 8px; flex-wrap:wrap; }
    .ozet-od-gun { font-size: 10.5px; padding: 1px 7px; border-radius: 99px; font-weight: 600; }
    .ozet-od-gun-acil { background: rgba(251,113,133,.14); color: var(--rose); }
    .ozet-od-gun-yakin { background: rgba(251,191,36,.14); color: var(--gold); }
    .ozet-od-gun-normal { background: var(--surface3); color: var(--text3); }
    .ozet-od-gun-gecmis { background: rgba(148,163,184,.14); color: var(--text2); }
    .ozet-od-tutar { font-family: var(--mono); font-size: 14px; font-weight: 700; text-align:right; white-space:nowrap; }
    .ozet-od-tutar.green { color: var(--teal); }
    .ozet-od-tutar.red { color: var(--rose); }
    .ozet-od-aksiyon { text-align:right; }
    .ozet-od-acil { border-left: 2px solid var(--rose); }
    .ozet-od-gecmis { border-left: 2px dashed var(--text3); opacity: .72; }
    .ozet-od-odendi { opacity: .55; }
    .ozet-od-odendi:hover { opacity: .85; }
    .ozet-od-odendi .ozet-od-tutar { text-decoration: line-through; text-decoration-color: var(--text3); }
    .ozet-od-empty { text-align:center; color: var(--text3); font-size: 13px; padding: 32px 0; }
    @media(max-width:640px) {
      .ozet-od-row { grid-template-columns: 38px 1fr auto; grid-template-areas: "date info tutar" "date info aksiyon"; }
      .ozet-od-icon { display:none; }
      .ozet-od-banka-col { display:none; }
      .ozet-od-banka-mobile { display:inline-flex; }
      .ozet-od-date { grid-area: date; }
      .ozet-od-info { grid-area: info; }
      .ozet-od-tutar { grid-area: tutar; }
      .ozet-od-aksiyon { grid-area: aksiyon; }
    }
  `;
  document.head.appendChild(s);
})();

// ring-net metni ("+150.000,00 ₺" gibi) 108px'lik dairenin içine sığmayabiliyor;
// uzunluğa göre uygun küçültme class'ını döndürür (bkz. .ring-net.sz-* CSS'i)
export function ringNetSizeClass(str) {
  const len = (str || '').length;
  if (len <= 9) return '';
  if (len <= 11) return 'sz-sm';
  if (len <= 13) return 'sz-xs';
  return 'sz-xxs';
}

export function renderOzetGrafikler() {

  let container = document.getElementById('ozet-grafik-row');
  if(!container) {
    container = document.createElement('div');
    container.id = 'ozet-grafik-row';
    // Özet sayfasındaki stats grid'inden sonra ekle
    const statsEl = document.getElementById('ozet-stats');
    if(statsEl && statsEl.parentNode) {
      statsEl.parentNode.insertBefore(container, statsEl.nextSibling);
    }
  }

  const today = new Date(); today.setHours(0,0,0,0);
  const year = today.getFullYear();
  const month = today.getMonth();

  // ── 6 AYLIK GELİR/GİDER ÇUBUĞU ──────────────────────────────────
  const months6 = [];
  for(let i=5; i>=0; i--) {
    const d = new Date(year, month-i, 1);
    months6.push({ y: d.getFullYear(), m: d.getMonth(), label: d.toLocaleDateString('tr-TR',{month:'short'}) });
  }

  function ayGelirGider(y, m) {
    const mStr = `${y}-${String(m+1).padStart(2,'0')}`;
    let gelir = 0, gider = 0;
    // Kira (odemeOverrides kullanılır — taksitOverrides değil; sadece fiilen ödenen/kısmi ödenen sayılır)
    (DB.kiralar||[]).forEach(k=>{
      const pd = kiraPayInMonth(k, y, m);
      if(!pd) return;
      const ps = localDateStr(pd).slice(0,7);
      if(ps !== mStr) return;
      const t = odFiilenGerceklesenTutar(odKiraMaasOverride(k, mStr), k.tutar);
      if(t<=0) return;
      if(k.tutar >= 0) gelir += t; else gider += t;
    });
    // Maaş (odemeOverrides kullanılır — taksitOverrides değil; sadece fiilen ödenen/kısmi ödenen sayılır)
    (DB.maaslar||[]).forEach(ms=>{
      const og = getMaasOdemeGunu(ms, y, m);
      const pd = og.sonraki ? new Date(y, m+1, og.gun) : new Date(y, m, og.gun);
      const ps = localDateStr(pd).slice(0,7);
      if(ps !== mStr) return;
      const t = odFiilenGerceklesenTutar(odKiraMaasOverride(ms, mStr), ms.tutar);
      if(t<=0) return;
      if(ms.tutar >= 0) gelir += t; else gider += t;
    });
    // Elden
    (DB.eldenler||[]).forEach(e=>{
      if(e.tarih?.slice(0,7) !== mStr) return;
      if(odIptalMi(e.odDurum)) return;
      if(e.tutar >= 0) gelir += Math.abs(e.tutar); else gider += Math.abs(e.tutar);
    });
    // Abonelik
    (DB.abonelikler||[]).forEach(a=>{
      const next = abNextDate(a, new Date(y,m,1));
      if(localDateStr(next).slice(0,7) !== mStr) return;
      gider += Math.abs(a.tutar) * (({haftalik:52/12,aylik:1,'3aylik':1/3,'6aylik':1/6,yillik:1/12})[a.periyot]||1);
    });
    return { gelir, gider };
  }

  const data6 = months6.map(mo => ({ ...mo, ...ayGelirGider(mo.y, mo.m) }));
  const maxVal = Math.max(...data6.map(d => Math.max(d.gelir, d.gider)), 1);
  const maxH = 100;

  const barHtml = data6.map((d,idx) => {
    const gh = Math.max(d.gelir>0?2:0, Math.round((d.gelir / maxVal) * maxH));
    const eh = Math.max(d.gider>0?2:0, Math.round((d.gider / maxVal) * maxH));
    const isLast = idx === data6.length-1;
    return `<div class="bar-group${isLast?' bar-group-current':''}" title="${d.label}: Gelir ${fmt(d.gelir)} · Gider ${fmt(d.gider)}">
      <div class="bar-pair">
        <div class="bar-segment bar-gelir" style="width:46%;height:${gh}px;align-self:flex-end"></div>
        <div class="bar-segment bar-gider" style="width:46%;height:${eh}px;align-self:flex-end"></div>
      </div>
      <div class="bar-label">${d.label}</div>
    </div>`;
  }).join('');

  const thisData = data6[data6.length-1];

  // ── NET SERVET / HESAP DAĞILIMI PIE ──────────────────────────────
  const hesaplar = (DB.hesaplar||[]).filter(h=>h.durum==='aktif' && (h.bakiye||0) > 0);
  const toplamBakiye = hesaplar.reduce((s,h)=>s+(h.bakiye||0),0) || 1;
  const pieColors = ['#4f6ef7','#2dd4bf','#fb923c','#a78bfa','#38bdf8','#fb7185','#fbbf24','#86efac'];
  let cumPct = 0;
  const pieSegments = hesaplar.slice(0,6).map((h,i)=>{
    const pct = (h.bakiye||0) / toplamBakiye;
    const startAngle = cumPct * 360 - 90;
    cumPct += pct;
    const endAngle = cumPct * 360 - 90;
    const toR = a => a * Math.PI / 180;
    const r = 64, cx = 80, cy = 80;
    const x1 = cx + r * Math.cos(toR(startAngle));
    const y1 = cy + r * Math.sin(toR(startAngle));
    const x2 = cx + r * Math.cos(toR(endAngle));
    const y2 = cy + r * Math.sin(toR(endAngle));
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `<path d="M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${pieColors[i%pieColors.length]}" opacity=".85"/>`;
  }).join('');

  const pieLegend = hesaplar.slice(0,5).map((h,i)=>{
    const pct = Math.round((h.bakiye||0)/toplamBakiye*100);
    const vadeSonuHtml = h.tur === 'vadeli' && h.bitis
      ? `<div style="font-size:9.5px;color:var(--violet);margin-top:1px">📅 ${fmtDate(h.bitis)}</div>`
      : '';
    return `<div class="donut-legend-row" style="flex-direction:column;align-items:stretch;gap:1px">
      <div style="display:flex;align-items:center;gap:7px">
        <div class="grafik-legend-dot" style="background:${pieColors[i%pieColors.length]};flex-shrink:0"></div>
        <span style="flex:1;min-width:0;color:var(--text2);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h.ad}</span>
        <div class="donut-legend-val">${pct}% · ${fmt(h.bakiye||0)}</div>
      </div>
      ${vadeSonuHtml ? `<div style="padding-left:18px">${vadeSonuHtml}</div>` : ''}
    </div>`;
  }).join('');

  // ── KREDİ BORÇ DURUMU ──────────────────────────────────────────
  let toplamKrediBorc = 0;
  let toplamKartBorc = 0;
  (DB.bireyselKrediler||[]).forEach(k=>{
    toplamKrediBorc += getBireyselKrediKalan(k);
  });
  (DB.kartlar||[]).forEach(kart=>{
    // Bu ay ödenecek ekstre tahmini
    const thisMonthStr = localDateStr(new Date()).slice(0,7);
    (DB.islemler||[]).filter(i=>i.kart===kart.id).forEach(i=>{
      getIslemTaksitliste(i).forEach(t=>{
        if(t.tarih?.slice(0,7)===thisMonthStr) toplamKartBorc += t.tutar;
      });
    });
  });

  const buAyNet = thisData.gelir - thisData.gider;
  const gelirGiderToplam = thisData.gelir + thisData.gider;
  const gelirPct = gelirGiderToplam > 0 ? Math.round(thisData.gelir/gelirGiderToplam*100) : 50;
  // Dairesel progress için çevre hesabı
  const ringR = 42, ringC = 2*Math.PI*ringR;
  const ringOffset = ringC * (1 - gelirPct/100);

  const toplamBorcGenel = toplamKrediBorc + toplamKartBorc;
  const krediBorcPct = toplamBorcGenel>0 ? Math.round(toplamKrediBorc/toplamBorcGenel*100) : 0;

  // ── NET SERVET TRENDİ (snapshot verisi) ─────────────────────────────
  const snapshotHtml = (function() {
    const snaps = DB.snapshots || {};
    const keys = Object.keys(snaps).sort();
    if(keys.length < 2) {
      return `<div class="grafik-card" style="grid-column:1/-1">
        <div class="grafik-title"><span class="grafik-title-icon">📈</span>Net Servet Trendi</div>
        <div class="grafik-empty">Grafik için en az 2 günlük veri gerekli.<br>Her gün dashboard açıldığında otomatik kaydedilir.</div>
      </div>`;
    }
    // Son 90 günlük veri
    const last90 = keys.slice(-90);
    const vals = last90.map(k => ({
      t: k,
      v: snaps[k].v || 0,
      b: snaps[k].b || 0,
      n: (snaps[k].v || 0) - (snaps[k].b || 0),
      s: !!snaps[k].s // s:true → o gün sisteme girilmedi, tahmini (interpolasyon) değer
    }));
    const allV = vals.map(d=>d.v), allB = vals.map(d=>d.b), allN = vals.map(d=>d.n);
    const allVals = [...allV, ...allB, ...allN];
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    const range = maxV - minV || 1;
    const W = 600, H = 160, padL = 62, padR = 12, padT = 12, padB = 28;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const n = vals.length;
    const xOf = i => padL + (n > 1 ? (i / (n-1)) * chartW : chartW/2);
    const yOf = v => padT + chartH - ((v - minV) / range) * chartH;

    // Y ekseni tick'leri
    const ticks = 4;
    const tickVals = Array.from({length: ticks+1}, (_,i) => minV + (range/ticks)*i);
    const _svgDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const _svgTxtClr = _svgDark ? 'rgba(255,255,255,.3)' : 'rgba(0,0,0,.3)';
    const _svgLineClr = _svgDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.07)';
    const yTickHtml = tickVals.map(tv => {
      const y = yOf(tv);
      const label = Math.abs(tv) >= 1000000 ? (tv/1000000).toFixed(1)+'M' :
                    Math.abs(tv) >= 1000 ? (tv/1000).toFixed(0)+'K' : tv.toFixed(0);
      return `<text x="${padL-6}" y="${y+4}" text-anchor="end" font-size="9" fill="${_svgTxtClr}">${label}</text>
              <line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="${_svgLineClr}" stroke-width="1"/>`;
    }).join('');

    // X ekseni — tarih etiketleri (max 8 adet)
    const step = Math.ceil(n/8);
    const xTickHtml = vals.filter((_,i)=>i===0||i===n-1||i%step===0).map(d => {
      const i = vals.indexOf(d);
      const x = xOf(i);
      const lbl = d.t.slice(5); // MM-DD
      return `<text x="${x}" y="${H-4}" text-anchor="middle" font-size="9" fill="${_svgTxtClr}">${lbl}</text>`;
    }).join('');

    // Polygon fill için kapalı alan
    function polyFill(points, color, opacity) {
      if(points.length < 2) return '';
      const first = points[0], last = points[points.length-1];
      const bottom = padT + chartH;
      const d = `M${first[0]},${bottom} L${points.map(p=>p[0]+','+p[1]).join(' L')} L${last[0]},${bottom} Z`;
      return `<path d="${d}" fill="${color}" fill-opacity="${opacity}"/>`;
    }
    function polyLine(points, color, width) {
      if(points.length < 2) return '';
      const d = `M${points.map(p=>p[0]+','+p[1]).join(' L')}`;
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
    }

    const ptsV = vals.map((d,i) => [xOf(i), yOf(d.v)]);
    const ptsB = vals.map((d,i) => [xOf(i), yOf(d.b)]);
    const ptsN = vals.map((d,i) => [xOf(i), yOf(d.n)]);

    // Bugünün değerleri
    const latest = vals[vals.length-1];
    const latestNetColor = latest.n >= 0 ? '#2dd4bf' : '#fb7185';

    // Bugün ve en yüksek net servet noktasını işaretle
    const maxNetIdx = vals.reduce((mi,d,i,a)=>d.n>a[mi].n?i:mi,0);
    const dotHtml = [
      `<circle cx="${xOf(n-1)}" cy="${yOf(latest.n)}" r="4" fill="${latestNetColor}" stroke="var(--surface)" stroke-width="2"/>`,
      maxNetIdx !== n-1 ? `<circle cx="${xOf(maxNetIdx)}" cy="${yOf(vals[maxNetIdx].n)}" r="3" fill="rgba(45,212,191,.6)" stroke="var(--surface)" stroke-width="1.5"/>` : ''
    ].join('');

    // Tahmini (sisteme girilmemiş, interpolasyonla doldurulmuş) günler için küçük içi boş noktalar
    const estCount = vals.filter(d=>d.s).length;
    const estDotHtml = vals.map((d,i) => d.s
      ? `<circle cx="${xOf(i)}" cy="${yOf(d.n)}" r="2" fill="var(--surface)" stroke="${latestNetColor}" stroke-opacity=".55" stroke-width="1.2"><title>${d.t}: tahmini (sisteme girilmedi)</title></circle>`
      : ''
    ).join('');

    // Varlık & borç değişim yüzdesi
    const firstV = vals[0].v, lastV = latest.v;
    const firstB = vals[0].b, lastB = latest.b;
    const dV = firstV > 0 ? ((lastV-firstV)/firstV*100).toFixed(1) : '—';
    const dB = firstB > 0 ? ((lastB-firstB)/firstB*100).toFixed(1) : '—';
    const dN = vals[0].n !== 0 ? ((latest.n - vals[0].n) / Math.abs(vals[0].n) * 100).toFixed(1) : '—';

    return `<div class="grafik-card" style="grid-column:1/-1;margin-bottom:0">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px">
        <div class="grafik-title" style="margin-bottom:0"><span class="grafik-title-icon">📈</span>Net Servet Trendi <span style="font-size:9px;color:var(--text3);font-weight:400">(Son ${n} gün · her gün otomatik kaydedilir${estCount ? ` · ${estCount} gün tahmini (girilmedi)` : ''})</span></div>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <div style="text-align:right">
            <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">Net Varlık</div>
            <div style="font-family:var(--mono);font-size:18px;font-weight:700;color:${latestNetColor}">${latest.n>=0?'+':''}${Math.abs(latest.n)>=1000000?(latest.n/1000000).toFixed(2)+'M':Math.abs(latest.n)>=1000?(latest.n/1000).toFixed(1)+'K':latest.n.toLocaleString('tr-TR')}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">Değişim</div>
            <div style="font-family:var(--mono);font-size:14px;font-weight:600;color:${dN!=='—'&&parseFloat(dN)>=0?'var(--teal)':'var(--rose)'}">${dN!=='—'?(parseFloat(dN)>=0?'+':'')+dN+'%':'—'}</div>
          </div>
        </div>
      </div>
      <div style="overflow-x:auto">
        <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="xMidYMid meet" style="display:block;min-width:260px">
          ${yTickHtml}
          ${xTickHtml}
          ${polyFill(ptsV, '#2dd4bf', 0.06)}
          ${polyFill(ptsB, '#fb7185', 0.06)}
          ${polyLine(ptsV, 'rgba(45,212,191,.5)', 1.5)}
          ${polyLine(ptsB, 'rgba(251,113,133,.5)', 1.5)}
          ${polyLine(ptsN, latestNetColor, 2.5)}
          ${estDotHtml}
          ${dotHtml}
        </svg>
      </div>
      <div class="grafik-legend" style="margin-top:10px">
        <div class="grafik-legend-item"><div class="grafik-legend-dot" style="background:var(--teal)"></div>Toplam Varlık</div>
        <div class="grafik-legend-item"><div class="grafik-legend-dot" style="background:var(--rose)"></div>Toplam Borç</div>
        <div class="grafik-legend-item"><div class="grafik-legend-dot" style="background:${latestNetColor}"></div>Net Servet</div>
        ${estCount ? `<div class="grafik-legend-item" title="O gün sisteme girilmedi, son gerçek kayıt ile bugün arasında tahmin edildi"><span style="width:8px;height:8px;border-radius:50%;border:1.2px solid ${latestNetColor};background:var(--surface);display:inline-block"></span>Tahmini (girilmedi)</div>` : ''}
        <div style="margin-left:auto;display:flex;gap:14px;flex-wrap:wrap">
          <div style="font-size:11px;color:var(--text3)">Varlık: <span style="color:var(--teal);font-family:var(--mono)">${dV!=='—'?(parseFloat(dV)>=0?'+':'')+dV+'%':'—'}</span></div>
          <div style="font-size:11px;color:var(--text3)">Borç: <span style="color:var(--rose);font-family:var(--mono)">${dB!=='—'?(parseFloat(dB)>=0?'+':'')+dB+'%':'—'}</span></div>
        </div>
      </div>
    </div>`;
  })();

  container.innerHTML = `${snapshotHtml}
    <div class="grafik-card grafik-card-wide">
      <div class="grafik-title"><span class="grafik-title-icon">📊</span>6 Aylık Gelir / Gider</div>
      <div class="bar-chart-wrap">${barHtml}</div>
      <div class="grafik-legend">
        <div class="grafik-legend-item"><div class="grafik-legend-dot" style="background:var(--teal)"></div>Gelir</div>
        <div class="grafik-legend-item"><div class="grafik-legend-dot" style="background:var(--rose)"></div>Gider</div>
        <div class="grafik-legend-net ${buAyNet>=0?'pos':'neg'}">Bu ay net: ${buAyNet>=0?'+':''}${fmt(buAyNet)}</div>
      </div>
    </div>
    <div class="grafik-card">
      <div class="grafik-title"><span class="grafik-title-icon">🏦</span>Hesap Dağılımı</div>
      ${hesaplar.length ? `<div class="donut-wrap">
        <svg viewBox="0 0 160 160" width="138" height="138" style="flex-shrink:0">
          ${pieSegments}
          <circle cx="80" cy="80" r="38" fill="var(--surface)"/>
          <text x="80" y="74" text-anchor="middle" font-size="9.5" fill="var(--text3)">Toplam</text>
          <text x="80" y="90" text-anchor="middle" font-size="11.5" font-weight="700" fill="var(--text)">${fmt(toplamBakiye)}</text>
        </svg>
        <div class="donut-legend">${pieLegend}</div>
      </div>` : '<div class="grafik-empty">Henüz aktif hesap yok</div>'}
    </div>
    <div class="grafik-card grafik-card-ring">
      <div class="grafik-title"><span class="grafik-title-icon">💳</span>Bu Ay Özet</div>
      <div class="ring-wrap">
        <svg viewBox="0 0 100 100" width="100" height="100" class="ring-svg">
          <circle cx="50" cy="50" r="${ringR}" fill="none" stroke="var(--rose)" stroke-opacity=".25" stroke-width="9"/>
          <circle cx="50" cy="50" r="${ringR}" fill="none" stroke="var(--teal)" stroke-width="9" stroke-linecap="round"
            stroke-dasharray="${ringC}" stroke-dashoffset="${ringOffset}" transform="rotate(-90 50 50)"/>
        </svg>
        <div class="ring-center">
          <div class="ring-net ${buAyNet>=0?'pos':'neg'} ${ringNetSizeClass((buAyNet>=0?'+':'')+fmt(buAyNet))}" title="${(buAyNet>=0?'+':'')+fmt(buAyNet)}">${buAyNet>=0?'+':''}${fmt(buAyNet)}</div>
          <div class="ring-net-label">Net</div>
        </div>
      </div>
      <div class="ring-rows">
        <div class="ring-row"><span class="ring-row-dot pos"></span><span class="ring-row-label">Gelir</span><span class="ring-row-val pos">${fmt(thisData.gelir)}</span></div>
        <div class="ring-row"><span class="ring-row-dot neg"></span><span class="ring-row-label">Gider</span><span class="ring-row-val neg">${fmt(thisData.gider)}</span></div>
      </div>
    </div>
    <div class="grafik-card">
      <div class="grafik-title"><span class="grafik-title-icon">📉</span>Borç Durumu</div>
      <div class="debt-total">${fmt(toplamBorcGenel)}</div>
      <div class="debt-bar"><div class="debt-bar-fill" style="width:${krediBorcPct}%"></div></div>
      <div class="ring-rows" style="margin-top:10px">
        <div class="ring-row"><span class="ring-row-dot" style="background:var(--rose)"></span><span class="ring-row-label">Kredi Borcu</span><span class="ring-row-val neg">${fmt(toplamKrediBorc)}</span></div>
        <div class="ring-row"><span class="ring-row-dot" style="background:rgba(251,113,133,.45)"></span><span class="ring-row-label">Kart (Bu Ay)</span><span class="ring-row-val neg">${fmt(toplamKartBorc)}</span></div>
        <div class="ring-row" style="border-top:1px solid var(--border);padding-top:8px;margin-top:2px"><span class="ring-row-dot" style="background:var(--warn)"></span><span class="ring-row-label">Abonelik/Ay</span><span class="ring-row-val" style="color:var(--warn)">${fmt((DB.abonelikler||[]).reduce((s,a)=>s+abAylikTutar(a),0))}</span></div>
      </div>
    </div>`;
}

// renderOzet'i wrap ederek grafikleri de çizdirme denemesi — 5. tur refactor'da
// kaldırıldı: bu IIFE abonelik.js yüklenirken HEMEN çalışıyordu, ama abonelik.js
// script sırasında ozet.js'den ÖNCE yüklendiği için o an renderOzet henüz
// tanımsızdı ve wrap sessizce hiç uygulanmıyordu (renderOzetGrafikler asla
// çağrılmıyordu). Doğru çağrı artık js/ui/pages/ozet.js:renderOzet()'in sonunda.

// ══════════════════════════════════════════════════════════════════════════════
// 3. ÇOKLU TAKSİT HESAP BAKIYE DÜŞME FİXİ
// ══════════════════════════════════════════════════════════════════════════════
// Eski entIslemHesabaYansit sadece 1 taksiti düşüyordu.
// Yeni versiyon: o ayın toplam taksit tutarını hesaba yansıtır.
// [ES module] eskiden window.entIslemHesabaYansit = function(){...} ile
// atanıyordu; hesap-entegrasyon-motoru.js'deki saveIslem/deleteIslem
// wrap'leri kendi modül-scope'undaki (tek taksitli) entIslemHesabaYansit'i
// çağırdığı için bu window ataması ASLA gerçekte kullanılmıyordu (ölü kod,
// sessiz bug — bkz. hesap-entegrasyon-motoru.js'deki not). Artık
// register(...) ile registry'deki taban tanımın üzerine yazılıyor;
// saveIslem/deleteIslem call('entIslemHesabaYansit', ...) kullandığı için
// bu çoklu-taksit sürümü artık gerçekten devrede.
// [ES module] Kurulum DOMContentLoaded'a ertelendi. Sebep: abonelik.js
// script sırasına göre hesap-entegrasyon-motoru.js'den ÖNCE yüklenir; bu
// register çağrısı top-level'da kalsaydı, sonra yüklenen
// hesap-entegrasyon-motoru.js kendi (tek taksitli) taban tanımını register
// ederek bu çoklu-taksit sürümünü SESSİZCE EZERDİ. DOMContentLoaded, script
// bloğundaki TÜM dosyalar (sıraları ne olursa olsun) yürütüldükten sonra
// ateşlendiği için bu sürüm her zaman en son (dolayısıyla kazanan) register
// olur.
function _rfAbonelikIslemYansitWrap(){
  register('entIslemHesabaYansit', function(islem, isEski) {
  if(!islem) return;
  const kart = (DB.kartlar||[]).find(k=>k.id===islem.kart);
  if(!kart) return;
  const hesap = (DB.hesaplar||[]).find(h=>h.id===(kart.hesapId||'') || h.kartId===kart.id);
  if(!hesap) return;

  // Her taksit için ayrı log key kullan: islem|id|taksitNo
  if(isEski) {
    // Tüm taksit loglarını geri al
    const taksitler = islem.taksitler || [{no:1,tutar:islem.aylik||(islem.tutar/Math.max(1,islem.taksit||1))}];
    taksitler.forEach(t=>{
      const lk = call('_lKey', 'islem', islem.id, t.no);
      const eski = call('_lGet', lk)||0;
      if(eski !== 0) { _bakiyeDelta(hesap.id, eski); call('_lDel', lk); }
    });
    _sync();
    return;
  }

  // Kaydetme: her taksiti kendi key'iyle izle — sadece bugün ve geçmiş olanları düş
  const todayStr = localDateStr(new Date());
  const taksitler = islem.taksitler || [{no:1,tarih:islem.tarih||todayStr,tutar:islem.aylik||(islem.tutar/Math.max(1,islem.taksit||1))}];
  let changed = false;
  taksitler.forEach(t=>{
    const tTarih = t.tarih || todayStr;
    if(tTarih > todayStr) return; // gelecek taksitler henüz hesabı etkilemez
    const lk = call('_lKey', 'islem', islem.id, t.no);
    const eski = call('_lGet', lk)||0;
    const yeni = t.tutar||0;
    const delta = yeni - eski;
    if(Math.abs(delta) < 0.001) return;
    if(_bakiyeDelta(hesap.id, -delta)) { call('_lSet', lk, yeni); changed = true; }
  });
  if(changed) _sync();
  });
}
document.addEventListener('DOMContentLoaded', _rfAbonelikIslemYansitWrap, { once:true });

// ══════════════════════════════════════════════════════════════════════════════
// 4. MEVDUAT "YENİLE_TUM" TAM OTOMATİK
// ══════════════════════════════════════════════════════════════════════════════
// Eski mevduatYenile modal açıyordu. Strateji yenile_tum ise
// vade dolunca yeni mevduatı IBAN/faiz bilgisi korunarak otomatik oluştur.
// (17. tur devam / davranış düzeltmesi) Kurulum DOMContentLoaded'a ertelendi.
// Sebep: window.mevduatOtoStratejiUygula'nın tabanı mobile-nav-tema.js'de
// tanımlı, o dosya index.html'de abonelik.js'den SONRA yükleniyor. Anında
// çalışan bu wrap _origStrateji'yi undefined yakalıyordu VE mobile-nav-tema.js
// sonra yüklenince kendi plain tanımıyla üstüne yazıyordu — yani "yenile_tum"
// otomatik mevduat yenileme özelliği muhtemelen hiç çalışmıyordu.
export function _rfAbonelikMevduatStratejiWrap(){
  const orig = get('mevduatOtoStratejiUygula');
  if(typeof orig !== 'function' || orig._rfAbonelikWrapped) return;
  const wrapped = function(mevId) {
    const mev = (DB.mevduatlar||[]).find(x=>x.id===mevId);

    if(!mev) return false;
    if(mev.strateji === 'yenile_tum') {
      // Aynı mevduat tekrar tekrar otomatik yenilenmesin diye entLog ile işaretle
      // (renderMevduat / mevduatOtomatikVadeKontrol her render'da bu kontrole bakar)
      const lk = call('_lKey', 'mevduat', mevId, null);
      if(call('_lGet', lk) != null) return false; // zaten yenilenmiş

      // Eski vadeli hesabı referans al (ad/banka bilgisi için), ardından kapat + sıfırla.
      // Yeni mevduat İÇİN AYNI HESAP KULLANILMAZ — eski hesap kapanacağı için ana para
      // yeni, ayrı bir vadeli hesaba taşınır (aksi halde kapalı görünen hesapta para kalırdı).
      const eskiHesap = mev.hesapId ? (DB.hesaplar||[]).find(h=>h.id===mev.hesapId) : null;
      const yeniHesap = {
        id: uid(),
        banka: mev.banka,
        ad: (eskiHesap ? eskiHesap.ad.replace(/\s*\(yenilendi\)$/,'') : (getBanka(mev.banka)||'') + ' Vadeli') + ' (yenilendi)',
        tur: 'vadeli',
        paraBirimi: mev.paraBirimi || 'TRY',
        bakiye: mev.nihai,
        iban: '', bankaKodu: '', subeKodu: '', hesapNo: '', subeAd: '',
        durum: 'aktif',
        not: `Otomatik yenileme — ${fmtDate(mev.bitis)}`,
      };
      if(!DB.hesaplar) DB.hesaplar = [];
      DB.hesaplar.push(yeniHesap);
      if(eskiHesap && eskiHesap.durum !== 'kapali') {
        eskiHesap.durum = 'kapali';
        eskiHesap.bakiye = 0;
      }

      // Tam otomatik yenile: mevcut parametrelerle yeni mevduat oluştur
      const yeni = {
        id: uid(),
        banka: mev.banka,
        hesapId: yeniHesap.id,
        vadesizHesapId: mev.vadesizHesapId,
        baslangic: mev.bitis,
        tutar: mev.nihai,         // ana para + brüt faiz → yeni anapara
        faizOran: mev.faizOran,
        stopaj: mev.stopaj,
        vade: mev.vade,
        valor: mev.valor||0,
        paraBirimi: mev.paraBirimi||'TRY',
        strateji: mev.strateji,
        gunluk: mev.gunluk,
      };
      // Günlük vadeli mevduatlarda vade sabit kopyalanamaz (bkz. mevduatYenileAnaParaOtomatik'teki
      // aynı düzeltme) — hafta sonu/tatil denk gelen döngülerde iş günü senkronu kayar.
      if(yeni.gunluk) {
        const tatilSet = getTatilSet();
        const baslangicD = new Date(yeni.baslangic+'T00:00:00');
        let kontrol = new Date(baslangicD);
        kontrol.setDate(kontrol.getDate() + 1);
        while(!isIsBgunu(kontrol, tatilSet)) {
          kontrol.setDate(kontrol.getDate() + 1);
        }
        yeni.vade = Math.round((kontrol.getTime() - baslangicD.getTime()) / (1000*60*60*24));
      }
      // Bitiş tarihi hesapla
      const startD = new Date(yeni.baslangic+'T00:00:00');
      startD.setDate(startD.getDate() + (yeni.vade||30) + (yeni.valor||0));
      yeni.bitis = localDateStr(startD);
      // Faiz hesapla
      if(typeof calcMevduatObj === 'function') {
        const calc = calcMevduatObj(yeni);
        yeni.faiz = calc.faiz; yeni.nihai = calc.nihai;
      } else {
        const brutFaiz = yeni.tutar * (yeni.faizOran/100) * (yeni.vade/365);
        const stopajTutar = brutFaiz * (yeni.stopaj/100);
        yeni.faiz = brutFaiz - stopajTutar;
        yeni.nihai = yeni.tutar + yeni.faiz;
      }
      if(!DB.mevduatlar) DB.mevduatlar = [];
      DB.mevduatlar.push(yeni);
      // Eskiyi geçmiş kayıt olarak işaretle (silme) — hem eski _kapatildi bayrağı
      // hem de tablo "Aktarım" sütununun okuduğu entLog ile tutarlı kalsın
      mev._kapatildi = true;
      call('_lSet', lk, mev.nihai);
      saveData();
      if(typeof renderMevduat==='function') renderMevduat();
      if(typeof renderHesaplar==='function') renderHesaplar();
      showToast(`🔄 ${getBanka(mev.banka)||'?'} mevduatı otomatik yenilendi — ${fmtCur(yeni.tutar,yeni.paraBirimi)} · ${yeni.vade} gün`, 4500);
      return true;
    }
    if(typeof orig === 'function') return orig.apply(this, arguments);
    return false;
  };
  wrapped._rfAbonelikWrapped = true;
  register('mevduatOtoStratejiUygula', wrapped);
}
if(document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _rfAbonelikMevduatStratejiWrap, { once:true });
} else {
  _rfAbonelikMevduatStratejiWrap();
}

// calcMevduatObj: mevduat nesnesinden faiz hesapla (modal bağımsız)
export function calcMevduatObj(m) {
  const brutFaiz = (m.tutar||0) * ((m.faizOran||0)/100) * ((m.vade||30)/365);
  const netFaiz = brutFaiz * (1 - (m.stopaj!=null?m.stopaj:15)/100);
  return { faiz: Math.round(netFaiz*100)/100, nihai: Math.round(((m.tutar||0)+netFaiz)*100)/100 };
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. (KALDIRILDI) ELDEN ÇİFT YANSITMA FİXİ
// Artık gerekli değil: saveElden bakiyeyi anında güncellemiyor, tek otorite olarak
// yukarıdaki genel entEldenYansit() (hem hesap/havale hem nakit için) kullanılıyor.
// Bu sayede yeni bir elden ödeme eklendiğinde bakiye hemen düşmüyor; ödeme durumu
// od-popup'tan "Ödendi"ye çekilince entEldenYansit tetiklenip bakiyeyi güncelliyor.
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// 6. ENTLOG + ODLOG BİRLEŞTİRME
// Her iki log da DB.odLog altında toplanır.
// entLog bakiye hareketleri için, odLog durum geçişleri için ayrı prefix kullanır.
// ══════════════════════════════════════════════════════════════════════════════
// (17. tur refactor / davranış düzeltmesi) DOMContentLoaded'a ertelendi.
// Sebep: bu IIFE anında çalışıyordu (abonelik.js'in kendi yüklenme anında),
// ama mobile-nav-tema.js (index.html'de abonelik.js'den SONRA yüklenen bir
// dosya) _lKey/_lGet/_lSet/_lDel için TAMAMEN entLog-tabanlı, odLog'dan
// habersiz, düz `function` tanımları içeriyor — bunlar anında çalışan bu
// birleştirmeyi HER SAYFA YÜKLEMESİNDE sessizce geri alıyordu. Yani "logları
// birleştir" migration'ı hiç etkili olmuyordu; DB.odLog'a hiç yazılmıyordu,
// her şey sessizce eski DB.entLog'a düşüyordu. DOMContentLoaded, script
// bloğundaki tüm dosyalar (sıraları ne olursa olsun) yüklendikten sonra
// ateşlendiği için bu artık dosya sırasından bağımsız çalışıyor.
let _rfAbonelikLogsUnified = false;
export function _rfAbonelikUnifyLogs(){
  if(_rfAbonelikLogsUnified) return;
  _rfAbonelikLogsUnified = true;
  // _lGet/_lSet/_lDel: DB.entLog yerine DB.odLog["ent|..."] kullan
  // Geriye dönük uyumluluk: hem eski entLog hem yeni odLog kontrol et
  register('_lKey', function(tip, id, key) {
    return `${tip}|${id}|${key!=null?key:'_'}`;
  });
  register('_lGet', function(k) {
    if(!DB.odLog) DB.odLog = {};
    if(!DB.entLog) DB.entLog = {};
    // Önce odLog'da bak (yeni), yoksa entLog'da bak (eski)
    const entK = 'ent:'+k;
    if(DB.odLog[entK] !== undefined) return DB.odLog[entK];
    if(DB.entLog[k] !== undefined) return DB.entLog[k]; // legacy
    return null;
  });
  register('_lSet', function(k, v) {
    if(!DB.odLog) DB.odLog = {};
    DB.odLog['ent:'+k] = v;
    // Aynı zamanda legacy entLog'a da yaz (eski kod okuyabilsin)
    if(!DB.entLog) DB.entLog = {};
    DB.entLog[k] = v;
  });
  register('_lDel', function(k) {
    if(DB.odLog) delete DB.odLog['ent:'+k];
    if(DB.entLog) delete DB.entLog[k];
  });
}
if(document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _rfAbonelikUnifyLogs, { once:true });
} else {
  _rfAbonelikUnifyLogs();
}


// İlk yüklemede renderAbonelik ve grafikleri de çalıştırma denemesi — 5. tur
// refactor'da kaldırıldı: aynı script-sırası sorunu (renderAll o an henüz
// tanımsızdı, app-core.js abonelik.js'den SONRA yükleniyor), bu wrap de hiç
// çalışmıyordu. Grafik çağrısı artık ozet.js:renderOzet() içinde; DB.abonelikler
// zaten tüm okuma noktalarında `||[]` ile güvenli.

// [ES module] taban render fonksiyonu odeme/patches zincirinin hook() ile
// sarmalayabilmesi için wrap-registry'ye kaydediliyor.
register('renderAbonelik', renderAbonelik);
