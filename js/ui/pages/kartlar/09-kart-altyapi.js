import { saveData } from '@core/app-core-base.js';
import { escapeHtml, fmtCur, fmtDate, localDateStr, uid } from '@core/format.js';
import { DB, defaultCurrency } from '@core/state.js';
import { _sidebarDim, phSet, showConfirm, showToast, validateRequiredFields } from '@components/modal-genel.js';
import { _renderAltyapiLogoPicker, applyChipsToContainer } from '@components/select-to-chips.js';
import { bindTblFiltreChips, tblSiralamaBarHtml, TBL_FILTRE_IKON } from '@components/tablo-filtre-sirala.js';
import { editKartAltyapiId, setEditKartAltyapiId } from '@pages/kartlar/00-state.js';
import { populateKartModal } from '@pages/kartlar/06-kart-form.js';
import { renderKartlar } from '@pages/kartlar/10-kart-liste.js';
import { getBanka } from '@pages/tanimlamalar/01-genel-yardimcilar.js';
import { renderTanimlamalar } from '@pages/tanimlamalar/02-ana-sayfa.js';
import { cpsInit, cpsSync } from '@components/cps-select.js';
import { closeModal } from '@components/modal-genel.js';
import { call, get, has, register } from '@core/wrap-registry.js';
// ============================================================
// js/ui/pages/kartlar/09-kart-altyapi.js
// Kart altyapısı (Visa/Mastercard/Troy vb.) tanımlama CRUD'u
//
// Bu dosya, eskiden tek parça olan js/ui/pages/kartlar.js (145
// export, 3600+ satır) dosyasının, fonksiyon isim/işlev
// kümelerine göre bölünmüş bir parçasıdır. Kod SATIR SATIR
// AYNI kaldı — sadece dosya sınırı ve gruplama değişti.
// ============================================================
export function deleteKartAltyapi(id) {
  showConfirm('Bu kart altyapısını silmek istiyor musunuz?', () => {
    DB.kartAltyapilari = (DB.kartAltyapilari||[]).filter(t=>t.id!==id);
    saveData();
    renderTanimlamalar();
  });
}

export function openKartAltyapiModal(id=null) {
  setEditKartAltyapiId(id);
  if(id) {
    const t = (DB.kartAltyapilari||[]).find(x=>x.id===id);
    if(!t) return;
    document.getElementById('kart-altyapi-modal-title').textContent = 'Kart Altyapısı Düzenle';
    document.getElementById('kart-altyapi-ad').value = t.ad;
    document.getElementById('kart-altyapi-kod').value = t.kod;
    document.getElementById('kart-altyapi-logo').value = t.logo || '';
    document.getElementById('kart-altyapi-renk').value = t.renk || '';
  } else {
    document.getElementById('kart-altyapi-modal-title').textContent = 'Kart Altyapısı Ekle';
    document.getElementById('kart-altyapi-ad').value = '';
    document.getElementById('kart-altyapi-kod').value = '';
    document.getElementById('kart-altyapi-logo').value = '';
    document.getElementById('kart-altyapi-renk').value = '';
  }
  _renderAltyapiLogoPicker(document.getElementById('kart-altyapi-logo').value);
  document.getElementById('modal-kart-altyapi').classList.add('open'); document.body.classList.add('modal-open'); _sidebarDim(true);
  setTimeout(() => applyChipsToContainer(document.getElementById('modal-kart-altyapi')), 80);
}

export function saveKartAltyapi() {
  const ad  = document.getElementById('kart-altyapi-ad').value.trim();
  const kod = document.getElementById('kart-altyapi-kod').value.trim().toUpperCase();
  if(!validateRequiredFields([{id:'kart-altyapi-ad',msg:'Ad zorunlu'},{id:'kart-altyapi-kod',msg:'Kod zorunlu'}])) return;
  if(!DB.kartAltyapilari) DB.kartAltyapilari = [];
  const logo = document.getElementById('kart-altyapi-logo').value || '';
  const renk = document.getElementById('kart-altyapi-renk').value || '';
  if(editKartAltyapiId) {
    const idx = DB.kartAltyapilari.findIndex(t=>t.id===editKartAltyapiId);
    if(idx>=0) DB.kartAltyapilari[idx] = {...DB.kartAltyapilari[idx], ad, kod, logo, renk};
  } else {
    DB.kartAltyapilari.push({id: uid(), ad, kod, logo, renk});
  }
  setEditKartAltyapiId(null);
  saveData();
  closeModal('modal-kart-altyapi');
  renderTanimlamalar();
  if(typeof populateKartModal === 'function') {
    const sel = document.getElementById('kart-altyapi');
    if(sel) fillKartAltyapiSelect(sel.value);
  }
  showToast('Kart altyapısı kaydedildi');
}

export function fillKartAltyapiSelect(selectedId) {
  const sel = document.getElementById('kart-altyapi');
  if(!sel) return;
  sel.innerHTML = (DB.kartAltyapilari||[]).map(t=>`<option value="${t.id}">${t.ad}</option>`).join('');
  phSet(sel, 'Seçilmedi (isteğe bağlı)', selectedId || '', '— Altyapı bulunamadı —');
}

// ---- (2. tur refactor: 02-core-app-engine.js'den taşındı) ----
export var editKartId = null;

// ── Kart kartından popup: İşlemler + Ekstreler (kompakt, sekmeli) ──
export var _kdKartId = null;

export var _kdIslemSiralama = 'tarih-yeni'; // İşlemler sekmesi: sıralama modu

// ── Kart detay tam sayfa ────────────────────────────────────────
export var _kd2KartId = null;

export var _kd2IslemSiralama = 'tarih-yeni';

// ── Kartlar sayfası: mobil kart görünümü, wizard kaydet butonu, TBK zenginleştirme, sıralama etiketi ──
(function(){
  'use strict';
  function el(id){ return document.getElementById(id); }
  function safe(fn){ try { return fn(); } catch(e) { console.warn('[kartlar]', e); } }
  function later(fn, ms){ setTimeout(function(){ safe(fn); }, ms || 0); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; }); }

  /* Mobil wizard: save button her adımda görünür */
  function showWizardSaveButtons(){
    if(window.innerWidth > 768) return;
    document.querySelectorAll('.modal-bg.open .modal-footer [id$="-step-save-btn"], .modal-bg.open .modal-footer .swiz-btn-save').forEach(function(btn){
      btn.style.display = '';
      btn.hidden = false;
      btn.setAttribute('aria-hidden','false');
    });
  }
  ['kartStepGoto','hesapStepGoto','pbStepGoto','kmhKrediStepGoto','krediStepGoto','naStepGoto','kiraStepGoto','maasStepGoto','abonelikStepGoto','eldenStepGoto','mevStepGoto'].forEach(function(name){
    const old = window[name];
    if(typeof old === 'function' && !old._wizardSaveWrapped){
      window[name] = function(){ const r = old.apply(this, arguments); showWizardSaveButtons(); return r; };
      window[name]._wizardSaveWrapped = true;
    }
  });
  document.addEventListener('click', function(e){
    if(e.target && e.target.closest && e.target.closest('.swiz-step-dot-wrap,[id$="-step-next-btn"],[id$="-step-back-btn"]')) later(showWizardSaveButtons, 0);
  }, true);

  // (Eski nesil toolbar üretimi buradaydı — arama kutusu, boş-durum mesajı,
  // durum çipleri; hepsi kaldırıldı, güncel toolbar dosyanın sonunda tek
  // yerde. Geçmişi için README'nin 9. tur notuna bakılabilir.)

  /* Kart işlem sıralama: kısa trigger, uzun metin picker içinde */
  function initSortPickerLabel(){
    ['kd-islem-sirala','kd2-islem-sirala'].forEach(function(id){
      const s = el(id);
      if(!s) return;
      cpsInit(id, { fieldStyle:true, alignRight:true, shortLabel:function(){ return 'Sırala'; } });
      if(typeof cpsSync === 'function') cpsSync(id);
    });
  }
  ['kdRenderIslemler','kd2RenderIslemler'].forEach(function(name){
    const old = window[name];
    if(typeof old === 'function' && !old._sortLabelWrapped){
      window[name] = function(){ const r = old.apply(this, arguments); later(initSortPickerLabel, 0); return r; };
      window[name]._sortLabelWrapped = true;
    }
  });

  /* TBK aylık detay: kart ödemeleri, mevduat faizleri ve ana para dönüşleri görünür olsun */
  function localStr(d){ return typeof localDateStr === 'function' ? localDateStr(d) : d.toISOString().slice(0,10); }
  function fmtSafe(n,pb){ return typeof fmtCur === 'function' ? fmtCur(n,pb||'TRY') : (Number(n)||0).toLocaleString('tr-TR') + ' ' + (pb||'TRY'); }
  function inRange(t, start, end){ return (!start || t >= start) && (!end || t <= end); }
  function getDay(d, tarih){
    d.gunler = d.gunler || [];
    let day = d.gunler.find(function(g){ return g.tarih === tarih; });
    if(!day){ day = {tarih:tarih, bakiye:null, olaylar:[]}; d.gunler.push(day); d.gunler.sort(function(a,b){ return String(a.tarih||'').localeCompare(String(b.tarih||'')); }); }
    if(!Array.isArray(day.olaylar)) day.olaylar = [];
    return day;
  }
  function eventExists(day, key){
    return (day.olaylar || []).some(function(o){ return (o._dedupKey === key) || ((o.aciklama||'') + '|' + (o.detay||'')).indexOf(key) >= 0; });
  }
  function recomputeBalances(d){
    let bal = Number(d.baslangic) || 0;
    (d.gunler || []).sort(function(a,b){ return String(a.tarih||'').localeCompare(String(b.tarih||'')); }).forEach(function(g, idx){
      if(idx === 0 && g.tarih && (g.olaylar||[]).length === 0){ g.bakiye = bal; return; }
      (g.olaylar || []).forEach(function(o){ if(!o.bilgiKalemi) bal += Number(o.tutar) || 0; });
      g.bakiye = bal;
    });
  }
  function addEvent(d, ev){
    const day = getDay(d, ev.tarih);
    if(eventExists(day, ev._dedupKey || ev.aciklama)) return;
    day.olaylar.push(ev);
    if(!ev.bilgiKalemi && Math.abs(Number(ev.tutar)||0) > 0.001) recomputeBalances(d);
  }
  function enrichTbk(d, gunSayisi, gecmisGunSayisi){
    if(!d || !Array.isArray(d.gunler)) return d;
    const today = new Date(); today.setHours(0,0,0,0);
    const todayStr = localStr(today);
    const start = localStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (Number(gecmisGunSayisi)||0)));
    const end = localStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() + (Number(gunSayisi)||365)));
    const pbDefault = d.pb || defaultCurrency || 'TRY';

    (DB.kartOdemeleri || []).forEach(function(o){
      if(!o || !o.tarih || !inRange(o.tarih, start, end)) return;
      const kart = (DB.kartlar || []).find(function(k){ return k.id === o.kartId; });
      const hesap = (DB.hesaplar || []).find(function(h){ return h.id === o.hesapId; });
      const pb = o.paraBirimi || (kart && (kart.varsayilanParaBirimi || kart.paraBirimi)) || pbDefault;
      addEvent(d, {
        tarih:o.tarih,
        tutar:0,
        bilgiKalemi:true,
        gosterilenTutar:Number(o.tutar)||0,
        aciklama:'💳 Kredi Kartı Ödemesi: ' + (kart ? kart.ad : 'Kart') + (o.donemKey ? ' · ' + o.donemKey : ''),
        detay:'Gerçek ödeme kaydı · ' + fmtSafe(Number(o.tutar)||0, pb) + (hesap ? ' · Hesap: ' + hesap.ad : '') + ' · ödeme zaten hesap bakiyesine işlendiği için burada bilgi olarak gösterilir.',
        _dedupKey:'kart-odeme|' + (o.id || (o.kartId + '|' + o.donemKey + '|' + o.tarih))
      });
    });

    (DB.mevduatlar || []).forEach(function(m){
      if(!m || !m.bitis || !(Number(m.tutar) > 0) || !inRange(m.bitis, start, end)) return;
      // Vadesi bitmeden erken kapatılmış/silinmiş/iptal edilmiş mevduatlar için
      // faiz/ana para olayı üretilmesin — deleteMevduat() bu bayrakları set ediyor.
      const erkenKapali = !!(m._erkenKapatildi || m.erkenKapatildi || m.kapatmaTipi === 'iptal' ||
        (m.odDurum && (m.odDurum.durum === 'iptal' || m.odDurum.durum === 'cancelled' || m.odDurum.durum === 'canceled')));
      if(erkenKapali) return;
      const pb = m.paraBirimi || pbDefault;
      const banka = (typeof getBanka === 'function' ? getBanka(m.banka) : '') || 'Mevduat';
      const ad = banka + (m.iban ? ' · ····' + String(m.iban).replace(/\s+/g,'').slice(-4) : '');
      const vadeGun = Number(m.vade)||0;
      const brut = Number(m.tutar)||0;
      const faiz = (m.faiz != null) ? (Number(m.faiz)||0) : (vadeGun > 0 ? brut * ((Number(m.faizOran)||0)/100) * (vadeGun/365) * (1 - ((Number(m.stopaj)||0)/100)) : 0);
      const day = getDay(d, m.bitis);
      const alreadyFaiz = (day.olaylar || []).some(function(x){ return /Mevduat Faizi|Değerlendirme Faizi/i.test(x.aciklama || '') && (x.aciklama || '').indexOf(banka) >= 0; });
      if(Math.abs(faiz) > 0.005 && !alreadyFaiz){
        addEvent(d, {
          tarih:m.bitis,
          tutar:faiz,
          aciklama:'🏦 Mevduat Faizi: ' + ad,
          detay:'Net faiz · ' + fmtSafe(faiz, pb) + ' · vade sonu ' + (typeof fmtDate === 'function' ? fmtDate(m.bitis) : m.bitis),
          _dedupKey:'mev-faiz|' + (m.id || ad + m.bitis)
        });
      }
      const strateji = m.strateji || 'tumu_vadesiz';
      const aciklama = strateji === 'yenile_tum' ? '🏦 Ana Para + Faiz Yenileme' : (strateji === 'yenile_ana_faiz_vadesiz' ? '🏦 Ana Para Yenileme / Faiz Dönüşü' : '🏦 Ana Para Dönüşü');
      const detay = 'Ana para: ' + fmtSafe(brut, pb) + (Math.abs(faiz)>0.005 ? ' · net faiz: ' + fmtSafe(faiz, pb) : '') + ' · ';
      addEvent(d, {
        tarih:m.bitis,
        tutar:0,
        bilgiKalemi:true,
        gosterilenTutar:brut,
        aciklama:aciklama + ': ' + ad,
        detay:detay,
        _dedupKey:'mev-ana|' + (m.id || ad + m.bitis)
      });
    });
    return d;
  }
  // [ES module] eskiden window.tahminGelecekBakiyeHesapla üzerinden okunup
  // zenginleştirilmiş sürümle window'a geri yazılıyordu; artık get/register
  // ile wrap-registry üzerinden aynı zincirleme wrap deseni sağlanıyor.
  const origTbk = get('tahminGelecekBakiyeHesapla');
  if(typeof origTbk === 'function' && !origTbk._tbkEnrichWrapped){
    const wrappedTbk = function(gunSayisi, gecmisGunSayisi){
      const d = origTbk.apply(this, arguments);
      return safe(function(){ return enrichTbk(d, gunSayisi, gecmisGunSayisi); }) || d;
    };
    wrappedTbk._tbkEnrichWrapped = true;
    register('tahminGelecekBakiyeHesapla', wrappedTbk);
  }

  function boot(){ showWizardSaveButtons(); initSortPickerLabel(); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
  window.addEventListener('resize', function(){ later(showWizardSaveButtons, 0); }, {passive:true});
  [80,250,600,1200].forEach(function(ms){ later(boot, ms); });
})();

// (Eski nesil kart toolbar'ının durum-filtresi buradaydı; toolbar'ın
// kendisi kaldırıldığı için bu kısım da kaldırıldı — geçmişi için
// README'nin 9. tur notuna bakılabilir.)

// ── Kartlar sayfası: boş-durum kutusunu süsleme ────────────────────────────
(function(){
  'use strict';
  // [ES module] window.__kartlarEmptyStateDecorInstalled bayrağı kaldırıldı —
  // ES modülleri zaten yalnızca bir kez evaluate edilir.
  const W = window, D = document;
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]; }); }
  function byId(id){ return D.getElementById(id); }
  function decorateBox(box, title, sub){
    if(!box) return;
    if(box.dataset.emptyStateDecorated === '1' && box.dataset.emptyStateTitle === title) return;
    box.dataset.emptyStateDecorated = '1';
    box.dataset.emptyStateTitle = title || '';
    box.classList.add('kartlar-empty-state');
    box.innerHTML = '<div class="kartlar-empty-icon">💳</div>'
      + '<div class="kartlar-empty-copy">'
      + '<div class="kartlar-empty-title">'+esc(title || 'Henüz kart eklenmedi.')+'</div>'
      + '<div class="kartlar-empty-sub">'+esc(sub || 'Yeni Kart butonuyla ilk kartını ekleyebilirsin.')+'</div>'
      + '</div>';
  }
  function refreshEmptyStates(){
    const list = byId('kartlar-list');
    if(!list) return;
    const info = list.querySelector(':scope > .info-box');
    if(!info) return;
    const text = (info.textContent || '').trim();
    const isSearchEmpty = /arama|filtre/i.test(text);
    decorateBox(
      info,
      isSearchEmpty ? 'Seçili arama veya filtreye uyan kart bulunamadı.' : (text || 'Henüz kart eklenmedi.'),
      isSearchEmpty ? 'Arama ya da durum filtresini değiştirip tekrar deneyebilirsin.' : 'Yeni Kart butonuyla ilk kartını ekleyebilirsin.'
    );
  }
  function runSoon(fn){ setTimeout(fn, 0); if(typeof W.requestAnimationFrame === 'function') W.requestAnimationFrame(fn); }
  const list = byId('kartlar-list');
  if(list && typeof MutationObserver === 'function'){
    const obs = new MutationObserver(function(){ runSoon(refreshEmptyStates); });
    obs.observe(list, { childList: true, subtree: false });
  }
  if(D.readyState === 'loading') D.addEventListener('DOMContentLoaded', function(){ runSoon(refreshEmptyStates); }, {once:true});
  else runSoon(refreshEmptyStates);
  W.addEventListener('load', function(){ runSoon(refreshEmptyStates); }, {once:true});
})();

// (Sıralama tercihi kalıcılığı kartlar sayfasına özel ikinci bir
// mekanizmayla tekrar ediliyordu; ortak tblSiralamaAyarla() zaten aynı işi
// yaptığı için kaldırıldı — geçmişi için README'nin 9. tur notuna
// bakılabilir.)

// ── Kartlar sayfası: arama/durum filtresi + toolbar (native — bkz. dosya sonundaki not) ──
let _kartToolbarInstalled = false;
(function(){
  'use strict';

  if(_kartToolbarInstalled) return;
  _kartToolbarInstalled = true;

  let _kartlarAramaSaveTimer = null;

  // (Bu 3 fonksiyonun eski, DB henüz hazır değilken eksik alanlı bir
  // fallback dönen bir kopyası vardı — düzeltme buraya işlendi. Geçmişi
  // için README'nin 7. tur notuna bakılabilir.)
  function kartlarFiltreOku(){
    if(typeof DB === 'undefined' || !DB) return { q:'', durum:'', arama:'', status:'' };
    if(!DB.uiFiltreler || typeof DB.uiFiltreler !== 'object') DB.uiFiltreler = {};
    if(!DB.uiFiltreler.kartlar || typeof DB.uiFiltreler.kartlar !== 'object') DB.uiFiltreler.kartlar = {};

    const p = DB.uiFiltreler.kartlar;
    p.q = typeof p.q === 'string' ? p.q : (typeof p.arama === 'string' ? p.arama : '');
    p.arama = p.q;

    let durum = String(p.durum || p.status || '').toLocaleLowerCase('tr-TR').trim();
    if(durum === 'active') durum = 'aktif';
    if(durum === 'inactive' || durum === 'kapalı' || durum === 'kapali') durum = 'pasif';
    if(durum !== 'aktif' && durum !== 'pasif') durum = '';

    p.durum = durum;
    p.status = durum;

    return p;
  }

  function kartAramaText(item){
    const k = item && item.k ? item.k : (item || {});
    const banka = item && item.banka !== undefined ? item.banka : (typeof getBanka === 'function' ? getBanka(k.banka) : '');
    const tip = item && item.tip !== undefined ? item.tip : ((typeof DB !== 'undefined' && DB.urunTipler || []).find(function(t){ return t.id === k.tip; }) || null);
    const altyapi = item && item.altyapi !== undefined ? item.altyapi : ((typeof DB !== 'undefined' && DB.kartAltyapilari || []).find(function(a){ return a.id === k.altyapiId; }) || null);
    const paraBirimleri = (k.paraBirimleri && k.paraBirimleri.length) ? k.paraBirimleri.join(' ') : (k.paraBirimi || k.varsayilanParaBirimi || '');

    return [
      k.ad,
      banka,
      tip && tip.ad,
      k.no,
      altyapi && altyapi.ad,
      paraBirimleri,
      (k.durum || 'aktif')
    ].filter(Boolean).join(' ');
  }

  function kartlarFiltreMatch(item, filtre){
    filtre = filtre || kartlarFiltreOku();

    const k = item.k || item;
    const q = String(filtre.q || '').toLocaleLowerCase('tr-TR').trim();
    const durum = String(filtre.durum || '').toLocaleLowerCase('tr-TR').trim();
    const kartDurum = (k.durum || 'aktif') === 'pasif' ? 'pasif' : 'aktif';

    if(durum && kartDurum !== durum) return false;
    if(!q) return true;

    const arama = kartAramaText(item).toLocaleLowerCase('tr-TR');
    return arama.indexOf(q) >= 0;
  }

  function saveNow(){
    try {
      if(typeof saveData === 'function') saveData();
      else if(typeof saveDB === 'function') saveDB();
    } catch(e) {}
  }

  function saveSoon(){
    clearTimeout(_kartlarAramaSaveTimer);
    _kartlarAramaSaveTimer = setTimeout(saveNow, 250);
  }

  function kartlarToolbarHtml(aktifSirala, filtre, sayac){
    filtre = filtre || kartlarFiltreOku();
    sayac = sayac || { tumu:0, aktif:0, pasif:0 };

    const q = escapeHtml(filtre.q || '');
    const durum = filtre.durum || '';

    const durumChip = (val, label, count) => {
      const active = durum === val;
      return `<button type="button" class="filter-chip${active ? ' active' : ''} kartlar-durum-chip" data-kart-durum="${val}">
        <span>${label}</span><span class="tbl-filtre-chip-count">${count || 0}</span>
      </button>`;
    };

    const siralamaHtml = tblSiralamaBarHtml([
      {key:'ad', label:'İsim', ikon:'harf', yon:'asc'},
      {key:'musait', label:'Kullanılabilir Limit', ikon:'cuzdan', yon:'desc'},
      {key:'limit', label:'Toplam Limit', ikon:'tutar', yon:'desc'},
      {key:'kullanim', label:'Kullanım %', ikon:'yuzde', yon:'desc'},
      {key:'ekstre', label:'Ekstre Kesim', ikon:'takvim', yon:'asc'},
      {key:'odeme', label:'Son Ödeme', ikon:'gun', yon:'asc'}
    ], aktifSirala, 'kartlarSirala').replace('tbl-siralama-bar', 'tbl-siralama-bar kartlar-siralama-wrap');

    return `<div class="tbl-filtre-bar kartlar-filtre-bar">
        <div class="tbl-filtre-grup kartlar-arama-grup">
          <span class="tbl-filtre-grup-label"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>Ara</span>
          <div class="kartlar-arama-box${q ? ' has-value' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" style="width:14px;height:14px;flex-shrink:0"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input id="kartlar-arama-input" class="kartlar-arama-input" type="text" autocomplete="off" spellcheck="false" value="${q}" placeholder="Kart, banka, ürün tipi ara...">
            <button type="button" class="kartlar-arama-clear" title="Aramayı temizle">×</button>
          </div>
        </div>
        <div class="tbl-filtre-grup kartlar-durum-grup">
          <span class="tbl-filtre-grup-label">${TBL_FILTRE_IKON}Durum</span>
          ${durumChip('', 'Tümü', sayac.tumu)}
          ${durumChip('aktif', 'Aktif', sayac.aktif)}
          ${durumChip('pasif', 'Pasif', sayac.pasif)}
        </div>
      </div>
      ${siralamaHtml}`;
  }

  function kartlarAramaKaydet(){
    clearTimeout(_kartlarAramaSaveTimer);
    _kartlarAramaSaveTimer = null;
    saveNow();
  }

  // (Arama/durum filtresi eskiden ayrı bir DOM-toggle mekanizmasıyla
  // (kartlarFiltreUygulaDom: kartları gizle/göster + kendi empty-state
  // elementini oluştur) uygulanıyordu; bu, renderKartlar()'ın kendi
  // filtreleme + boş-durum mantığıyla çakışıp iki farklı görünüm
  // üretebiliyordu. Artık tüm arama/durum/sıralama değişiklikleri tek
  // kaynaktan — renderKartlar() — geçiyor; kart sayısı için performans
  // farkı yok, ama görünüm artık her zaman tutarlı.)
  function kartlarAramaDegisti(value){
    const p = kartlarFiltreOku();
    p.q = String(value || '');
    p.arama = p.q;
    saveSoon();

    const box = document.querySelector('#kartlar-siralama-bar .kartlar-arama-box');
    if(box) box.classList.toggle('has-value', !!p.q);

    // skipToolbar:true — toolbar (arama input'u dahil) DOM'da aynı kalır,
    // sadece kart listesi yeniden filtrelenir. Toolbar'ı da basmak input'u
    // yok edip yeniden yaratıyordu, bu da her tuşta focus kaybına yol
    // açıyordu.
    if(typeof renderKartlar === 'function') renderKartlar({ skipToolbar:true });
  }

  function kartlarAramaTemizle(){
    const p = kartlarFiltreOku();
    p.q = '';
    p.arama = '';
    saveNow();

    const input = document.getElementById('kartlar-arama-input');
    if(input) input.value = '';

    const box = document.querySelector('#kartlar-siralama-bar .kartlar-arama-box');
    if(box) box.classList.remove('has-value');

    if(typeof renderKartlar === 'function') renderKartlar({ skipToolbar:true });
  }

  function kartlarDurumFiltre(value){
    const p = kartlarFiltreOku();
    let durum = String(value || '').toLocaleLowerCase('tr-TR').trim();
    if(durum !== 'aktif' && durum !== 'pasif') durum = '';
    p.durum = durum;
    p.status = durum;
    saveNow();

    if(typeof renderKartlar === 'function') renderKartlar();
  }

  // Eski ayrı DOM-toggle uygulayıcısı kaldırıldı; geriye dönük uyumluluk
  // için renderKartlar()'a yönlendiren ince bir köprü bırakıldı (başka bir
  // dosya hâlâ kartlarFiltreUygulaDom() çağırıyorsa kırılmasın diye).
  function kartlarFiltreUygulaDom(){
    if(typeof renderKartlar === 'function') renderKartlar();
  }

  function kartlarSeciliSiralamaKaydir(smooth){
    const row = document.querySelector('#kartlar-siralama-bar .kartlar-siralama-wrap');
    const active = row && row.querySelector('.sort-chip.active');
    if(!row || !active) return;

    const max = Math.max(0, row.scrollWidth - row.clientWidth);
    if(max <= 1) return;

    let target = active.offsetLeft - row.clientWidth / 2 + active.offsetWidth / 2;
    target = Math.max(0, Math.min(max, target));

    try {
      row.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'auto' });
    } catch(e) {
      row.scrollLeft = target;
    }
  }

  // [ES module] Bu fonksiyonlar başka dosyalar (export proxy'leri, HTML'deki
  // event handler bootstrap'ı vb.) tarafından çağrılabildiği için registry'ye
  // kaydediliyor — çıplak isimle çağrı yalnızca bu closure içinde çalışır.
  register('kartlarFiltreOku', kartlarFiltreOku);
  register('kartAramaText', kartAramaText);
  register('kartlarFiltreMatch', kartlarFiltreMatch);
  register('kartlarToolbarHtml', kartlarToolbarHtml);
  register('kartlarAramaKaydet', kartlarAramaKaydet);
  register('kartlarAramaDegisti', kartlarAramaDegisti);
  register('kartlarAramaTemizle', kartlarAramaTemizle);
  register('kartlarDurumFiltre', kartlarDurumFiltre);
  register('kartlarFiltreUygulaDom', kartlarFiltreUygulaDom);
  register('kartlarSeciliSiralamaKaydir', kartlarSeciliSiralamaKaydir);

  // Sıralama sonrası mobilde seçili chip'e kay.
  const oldKartlarSirala = get('kartlarSirala');
  if(typeof oldKartlarSirala === 'function' && !oldKartlarSirala._kartToolbarWrapped) {
    const wrappedKartlarSirala = function(key, yon){
      const result = oldKartlarSirala.apply(this, arguments);
      setTimeout(function(){ kartlarSeciliSiralamaKaydir(true); }, 30);
      return result;
    };
    wrappedKartlarSirala._kartToolbarWrapped = true;
    register('kartlarSirala', wrappedKartlarSirala);
  }

  if(document.readyState !== 'loading') {
    setTimeout(function(){ kartlarSeciliSiralamaKaydir(false); }, 0);
  } else {
    document.addEventListener('DOMContentLoaded', function(){
      setTimeout(function(){ kartlarSeciliSiralamaKaydir(false); }, 0);
    }, { once:true });
  }
})();

// (Toolbar'ı DOM'a tam basan render mantığı burada iki ayrı yerde
// tekrarlanıyordu: yukarıdaki "native" IIFE ve aşağıda kaldırılan bir
// "sync" IIFE'i. İkincisi window.kartlarFiltreOku / kartlarToolbarHtml /
// kartlarFiltreMatch fonksiyonlarını üstüne yazıp toolbar'ı class
// isimlerini -native postfix'iyle değiştirerek İKİNCİ KEZ render ediyordu
// — arama/sıralama header'ının tutarsız ("saçma") görünmesinin asıl
// sebebi buydu. Duplicate blok tamamen kaldırıldı, tek kaynak olarak
// yukarıdaki "native" IIFE bırakıldı.)

// (Arama/durum filtresi fonksiyonlarının fallback davranışındaki bir
// eksiklik yukarıdaki toolbar bloğuna doğrudan işlendi — geçmişi için
// README'nin 7. tur notuna bakılabilir.)

// [ES module] kartAramaText/kartlarFiltreMatch/kartlarFiltreOku/
// kartlarSeciliSiralamaKaydir/kartlarToolbarHtml yukarıdaki IIFE içinde
// register(...) ile wrap-registry'ye kaydediliyor. Bu köprü fonksiyonlar,
// her çağrıldıklarında registry'deki EN GÜNCEL (kurulum tamamlandıktan
// sonraki) versiyonu çağırır — davranış birebir aynı kalır, sadece diğer
// modüllerin statik `import` ile erişebilmesi sağlanır.
export function kartAramaText(...args) { return call('kartAramaText', ...args); }
export function kartlarFiltreMatch(...args) { return call('kartlarFiltreMatch', ...args); }
export function kartlarFiltreOku(...args) { return call('kartlarFiltreOku', ...args); }
export function kartlarSeciliSiralamaKaydir(...args) { return call('kartlarSeciliSiralamaKaydir', ...args); }
export function kartlarToolbarHtml(...args) { return call('kartlarToolbarHtml', ...args); }

// [ES module] kartlarToolbarHtml'nin döndürdüğü template'teki
// onclick="kartlarDurumFiltre(...)" ve onclick="kartlarAramaTemizle()"
// kaldırıldı - bu yardımcı, template'i innerHTML'e koyan HER çağıran yerde
// hemen ardından çağrılmalı, gerçek addEventListener bağlar.
export function bindKartlarToolbarEvents(container) {
  if (!container) return;
  container.querySelectorAll('.kartlar-durum-chip').forEach(chip => {
    chip.addEventListener('click', () => call('kartlarDurumFiltre', chip.getAttribute('data-kart-durum')));
  });
  const clearBtn = container.querySelector('.kartlar-arama-clear');
  if (clearBtn) clearBtn.addEventListener('click', () => call('kartlarAramaTemizle'));
  // [ES module] eskiden template'te oninput="kartlarAramaDegisti(this.value)"
  // ve onblur="kartlarAramaKaydet()" olarak tanımlıydı - modülde global
  // fonksiyon olmadığından çalışmazdı; gerçek addEventListener'a taşındı.
  const aramaInput = container.querySelector('#kartlar-arama-input');
  if (aramaInput) {
    aramaInput.addEventListener('input', () => call('kartlarAramaDegisti', aramaInput.value));
    aramaInput.addEventListener('blur', () => call('kartlarAramaKaydet'));
  }
  // [ES module] onclick="kartlarSirala(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
  // NOT: kartlarSirala bu dosyada wrap-registry üzerinden runtime'da wrap
  // ediliyor (mobilde seçili chip'e kaydırma) - call(...) ile çağrılıyor ki
  // wrapper bypass edilmesin.
  bindTblFiltreChips(container, { kartlarSirala: (...args) => call('kartlarSirala', ...args) });
}

// [ES module] Bu dosyada tanımlanan aşağıdaki değişkenler başka dosyalarda
// yeniden atanıyordu (import edilen bir binding'e doğrudan atama ES
// module'de yasaktır). Bu setter fonksiyonları o davranışı korumak için
// eklendi - ilgili dosyalar artık `X = v` yerine `setX(v)` çağırıyor.
export function setEditKartId(v) { editKartId = v; }
export function set_kd2KartId(v) { _kd2KartId = v; }
export function set_kdKartId(v) { _kdKartId = v; }
export function set_kdIslemSiralama(v) {
  _kdIslemSiralama = v;
}
export function set_kd2IslemSiralama(v) {
  _kd2IslemSiralama = v;
}
