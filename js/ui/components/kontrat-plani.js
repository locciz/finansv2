import { inject } from '@core/container.js';
// DUAL-MODE CONTAINER KAYDI: core.appCoreBase, core.dateUtils, core.format,
// core.state, domain.hesaplamalar, ui.components.modalGenel,
// ui.components.moneyInput, core.wrapRegistry zaten container'a taşınmış
// katmanlara ait. @pages/* importları o katman henüz taşınmadığı için
// BİLİNÇLİ OLARAK korunuyor.
const _appCoreBase = inject('core.appCoreBase');
const _dateUtils = inject('core.dateUtils');
const _format = inject('core.format');
const _coreState = inject('core.state');
const _hesaplamalar = inject('domain.hesaplamalar');
const _modalGenel = inject('ui.components.modalGenel');
const _moneyInput = inject('ui.components.moneyInput');
const _wrapRegistry = inject('core.wrapRegistry');
import { getTatilSet } from '@pages/tanimlamalar/01-genel-yardimcilar.js';
import { renderHesaplar } from '@pages/hesaplar/04-hesap-liste-render.js';
// ============================================================
// js/ui/components/kontrat-plani.js — Kontrat (kira/maaş) ödeme
// planı modalı: ay bazlı ödendi/atla/ertele/taksitlendir/not
// ============================================================
export var _kpTip = null;
export var _kpId  = null;
export var _kpYil = null;
export var _kpAktifForm = null;

export function openKontratPlan(tip, id) {
  _kpTip = tip;
  _kpId  = id;
  _kpYil = new Date().getFullYear();
  kontratPlanFormKapat();
  renderKontratPlan();
  document.getElementById('modal-kontrat-plan').classList.add('open'); document.body.classList.add('modal-open'); _modalGenel._sidebarDim(true);
}

export function kontratPlanYilDegistir(d) { _kpYil += d; renderKontratPlan(); }

export function kontratPlanBugune()        { _kpYil = new Date().getFullYear(); renderKontratPlan(); }

export function getKontrat() {
  if(_kpTip==='kira') return (_coreState.DB.kiralar||[]).find(k=>k.id===_kpId);
  return (_coreState.DB.maaslar||[]).find(m=>m.id===_kpId);
}

export function getOverride(k, ay) {
  return (k.odemeOverrides||{})[ay] || null;
}

// ── Ödeme planı render ────────────────────────────────────────
export function renderKontratPlan() {
  const k = getKontrat();
  if(!k) return;
  const isKira = _kpTip==='kira';
  const isGelir = k.tutar >= 0;

  // Başlık
  document.getElementById('kontrat-plan-title').textContent = (k.aciklama||'Kontrat') + ' — Ödeme Planı';
  document.getElementById('kontrat-plan-sub').textContent =
    (isKira ? (isGelir?'Kira Geliri':'Kira Gideri') : 'Maaş') +
    ' · ' + _format.fmtDate(k.baslangic) + ' – ' + (k.bitis?_format.fmtDate(k.bitis):'Süresiz') +
    ' · Her ayın ' + k.gun + '. günü';
  document.getElementById('kontrat-plan-yil').textContent = _kpYil;

  const aylar = _hesaplamalar.kontratAylariHesapla(k, _kpYil);
  const todayStr = _format.localDateStr(new Date());

  // Stats
  let odendi=0, bekliyor=0, ertelendi=0, atlandi=0, toplamTutar=0;
  aylar.forEach(a => {
    const ov = getOverride(k, a.ay);
    const tutar = ov?.tutar !== undefined ? ov.tutar : Math.abs(a.tutar);
    if(ov?.durum==='odendi')    { odendi++;   toplamTutar+=tutar; }
    else if(ov?.durum==='atlandi')  atlandi++;
    else if(ov?.durum==='ertelendi') ertelendi++;
    else { bekliyor++; toplamTutar+=Math.abs(a.tutar); }
  });
  document.getElementById('kontrat-plan-stats').innerHTML = [
    ['Toplam Dönem', aylar.length, ''],
    ['Ödendi', odendi, 'color:var(--accent2)'],
    ['Bekliyor', bekliyor, 'color:var(--accent)'],
    ['Ertelendi', ertelendi, 'color:var(--warning,#f59e0b)'],
    ['Atlandı', atlandi, 'color:var(--text3)'],
    ['Yıl Toplam', _format.fmt(toplamTutar), isGelir?'color:var(--accent2)':'color:var(--danger)'],
  ].map(([label,val,style])=>
    `<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:8px 14px;min-width:90px">
      <div style="font-size:10px;color:var(--text3);margin-bottom:3px">${label}</div>
      <div style="font-weight:700;font-size:15px;${style}">${val}</div>
    </div>`
  ).join('');

  // Tablo
  const tbody = document.getElementById('kontrat-plan-tbody');
  if(!aylar.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:20px">Bu yılda kontrat aktif değil</td></tr>';
    return;
  }
  tbody.innerHTML = aylar.map(a => {
    const ov = getOverride(k, a.ay);
    const durum = ov?.durum || 'bekliyor';
    const tarih = ov?.tarih || a.tarih;
    const tutar = ov?.tutar !== undefined ? ov.tutar : Math.abs(a.tutar);
    const not   = ov?.not || '';
    const gecti = tarih < todayStr;
    const isAktifForm = _kpAktifForm?.ay === a.ay;

    const durumBadge = {
      odendi:    '<span class="badge badge-green">✓ Ödendi</span>',
      atlandi:   '<span class="badge" style="background:rgba(107,114,128,.15);color:var(--text3)">⊘ Atlandı</span>',
      ertelendi: '<span class="badge badge-warn">↷ Ertelendi</span>',
      taksit:    '<span class="badge badge-purple">⊟ Taksitli</span>',
      bekliyor:  gecti
        ? '<span class="badge badge-red">⚠ Gecikmiş</span>'
        : '<span class="badge" style="background:rgba(59,130,246,.12);color:var(--accent)">◉ Bekliyor</span>',
    }[durum] || '';

    const rowStyle = isAktifForm ? 'background:rgba(59,130,246,.08)' :
                     durum==='odendi' ? 'background:rgba(16,185,129,.05)' :
                     durum==='atlandi' ? 'opacity:.5' : '';

    // Taksit alt-satırları
    let taksitRows = '';
    if(durum==='taksit' && ov?.taksitler) {
      taksitRows = ov.taksitler.map((t,i)=>
        `<tr style="background:rgba(139,92,246,.05)">
          <td style="padding-left:24px;color:var(--text3);font-size:11px">↳ ${i+1}. taksit</td>
          <td class="mono" style="font-size:11px">${_format.fmtDate(t.tarih)}</td>
          <td class="mono" style="font-size:11px">${_format.fmt(t.tutar)}</td>
          <td colspan="3"></td>
        </tr>`
      ).join('');
    }

    return `<tr style="${rowStyle}">
      <td class="mono" style="font-size:12px">${a.ay}</td>
      <td class="mono" style="font-size:12px${tarih!==a.tarih?' color:var(--accent)':''}">${_format.fmtDate(tarih)}</td>
      <td class="mono" style="font-size:13px;font-weight:600;${isGelir?'color:var(--accent2)':'color:var(--danger)'}">${_format.fmt(tutar)}</td>
      <td>${durumBadge}</td>
      <td style="font-size:11px;color:var(--text3);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${not}">${not}</td>
      <td style="white-space:nowrap">
        <div style="display:flex;gap:3px;flex-wrap:wrap">
          ${durum!=='odendi' ? `<button class="btn btn-ghost btn-sm kp-odendi-btn" data-ay="${a.ay}" style="font-size:10px;padding:2px 6px">✓ Ödendi</button>` : `<button class="btn btn-ghost btn-sm kp-odenmedi-btn" data-ay="${a.ay}" style="font-size:10px;padding:2px 6px">↩ Geri Al</button>`}
          ${durum!=='atlandi' ? `<button class="btn btn-ghost btn-sm kp-atla-btn" data-ay="${a.ay}" style="font-size:10px;padding:2px 6px">⊘ Atla</button>` : ''}
          <button class="btn btn-ghost btn-sm kp-form-ertele-btn" data-ay="${a.ay}" style="font-size:10px;padding:2px 6px">↷ Ertele</button>
          <button class="btn btn-ghost btn-sm kp-form-taksit-btn" data-ay="${a.ay}" style="font-size:10px;padding:2px 6px">⊟ Taksit</button>
          <button class="btn btn-ghost btn-sm kp-form-not-btn" data-ay="${a.ay}" style="font-size:10px;padding:2px 6px">✎ Not</button>
          ${ov ? `<button class="btn btn-danger btn-sm kp-sifirla-btn" data-ay="${a.ay}" style="font-size:10px;padding:2px 6px">↺</button>` : ''}
        </div>
      </td>
    </tr>${taksitRows}`;
  }).join('');
  // [ES module] onclick="kontratPlanOdendi/kontratPlanOdenmediYap/kontratPlanAtla/
  // kontratPlanFormAc/kontratPlanSifirla(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
  tbody.querySelectorAll('.kp-odendi-btn').forEach(btn => {
    btn.addEventListener('click', () => kontratPlanOdendi(btn.getAttribute('data-ay')));
  });
  tbody.querySelectorAll('.kp-odenmedi-btn').forEach(btn => {
    btn.addEventListener('click', () => kontratPlanOdenmediYap(btn.getAttribute('data-ay')));
  });
  tbody.querySelectorAll('.kp-atla-btn').forEach(btn => {
    btn.addEventListener('click', () => kontratPlanAtla(btn.getAttribute('data-ay')));
  });
  tbody.querySelectorAll('.kp-form-ertele-btn').forEach(btn => {
    btn.addEventListener('click', () => kontratPlanFormAc(btn.getAttribute('data-ay'), 'ertele'));
  });
  tbody.querySelectorAll('.kp-form-taksit-btn').forEach(btn => {
    btn.addEventListener('click', () => kontratPlanFormAc(btn.getAttribute('data-ay'), 'taksit'));
  });
  tbody.querySelectorAll('.kp-form-not-btn').forEach(btn => {
    btn.addEventListener('click', () => kontratPlanFormAc(btn.getAttribute('data-ay'), 'not'));
  });
  tbody.querySelectorAll('.kp-sifirla-btn').forEach(btn => {
    btn.addEventListener('click', () => kontratPlanSifirla(btn.getAttribute('data-ay')));
  });
}

// ── Durum aksiyonları (ödendi/geri al/atla/sıfırla) ──────────
export function kontratPlanOdendi(ay) {
  const k = getKontrat(); if(!k) return;
  if(!k.odemeOverrides) k.odemeOverrides = {};
  const aylar = _hesaplamalar.kontratAylariHesapla(k, parseInt(ay.split('-')[0]));
  const ayData = aylar.find(a=>a.ay===ay);
  const tutar = ayData ? Math.abs(ayData.tutar) : Math.abs(k.tutar);
  k.odemeOverrides[ay] = {...(k.odemeOverrides[ay]||{}), durum:'odendi', tutar};
  _appCoreBase.saveData();
  // Otomatik bakiye
  _wrapRegistry.call('_otoBakiyeGuncelle', _kpTip, _kpId, ay, 'odendi', tutar);
  _appCoreBase.saveData();
  renderHesaplar();
  renderKontratPlan();
}

export function kontratPlanOdenmediYap(ay) {
  const k = getKontrat(); if(!k) return;
  if(!k.odemeOverrides) k.odemeOverrides = {};
  const ov = k.odemeOverrides[ay]||{};
  // Geri al: bakiyeden düş
  _wrapRegistry.call('_otoBakiyeGuncelle', _kpTip, _kpId, ay, 'bekliyor', 0);
  delete ov.durum;
  if(Object.keys(ov).length===0) delete k.odemeOverrides[ay];
  else k.odemeOverrides[ay]=ov;
  _appCoreBase.saveData();
  renderHesaplar();
  renderKontratPlan();
}

export function kontratPlanAtla(ay) {
  const k = getKontrat(); if(!k) return;
  if(!k.odemeOverrides) k.odemeOverrides = {};
  // İptal/atla durumunda o ay tutar 0 olsun
  k.odemeOverrides[ay] = {...(k.odemeOverrides[ay]||{}), durum:'atlandi', tutar: 0};
  _appCoreBase.saveData(); renderKontratPlan();
}

export function kontratPlanSifirla(ay) {
  const k = getKontrat(); if(!k) return;
  if(k.odemeOverrides) delete k.odemeOverrides[ay];
  _appCoreBase.saveData(); renderKontratPlan();
}

// ── Ertele/Taksitlendir/Not formu (aç/kapat/kaydet) ──────────
export function kontratPlanFormAc(ay, islem) {
  _kpAktifForm = { ay, islem };
  const k = getKontrat(); if(!k) return;
  const ov = getOverride(k, ay) || {};
  const formEl = document.getElementById('kontrat-plan-form');
  const titleEl = document.getElementById('kontrat-plan-form-title');
  const bodyEl  = document.getElementById('kontrat-plan-form-body');

  // Orijinal tarih hesapla
  const [yilStr, ayStr] = ay.split('-');
  const gun = k.gun || 1;
  const lastDay = new Date(parseInt(yilStr), parseInt(ayStr), 0).getDate();
  let payGun;
  if(gun <= lastDay) {
    payGun = gun;
  } else {
    const davranis = k.kisaAyDavranis || 'son-gun';
    if(davranis === 'onceki') {
      const tatilSet = getTatilSet();
      let dt = new Date(parseInt(yilStr), parseInt(ayStr)-1, lastDay);
      while(!_dateUtils.isIsBgunu(dt, tatilSet)) dt.setDate(dt.getDate()-1);
      payGun = dt.getDate();
    } else {
      payGun = lastDay;
    }
  }
  const orijTarih = ay+'-'+String(payGun).padStart(2,'0');
  const mevcutTarih = ov.tarih || orijTarih;
  const mevcutTutar = Math.abs(ov.tutar !== undefined ? ov.tutar : k.tutar);
  const mevcutNot   = ov.not || '';

  if(islem==='ertele') {
    const ertelemeTarih = ov.tarih || _format.localDateStr(new Date());
    titleEl.textContent = '↷ Ödeme Erteleme — ' + ay;
    bodyEl.innerHTML = `
      <div class="form-row cols-2">
        <div><label>Yeni Ödeme Tarihi</label><input id="kpf-tarih" type="date"></div>
        <div><label>Tutar (değişecekse)</label><input id="kpf-tutar" type="number" step="0.01" placeholder="${mevcutTutar}"></div>
      </div>
      <div class="form-row"><div><label>Not</label><input id="kpf-not-ertele" placeholder="Erteleme nedeni..."></div></div>`;
    setTimeout(()=>{
      const el = document.getElementById('kpf-tarih'); if(el) _moneyInput.setDateInputValue(el, ertelemeTarih);
      const el2 = document.getElementById('kpf-tutar'); if(el2) el2.value = mevcutTutar;
      const el3 = document.getElementById('kpf-not-ertele'); if(el3) el3.value = mevcutNot;
    }, 0);
  } else if(islem==='taksit') {
    const t1 = ov.taksitler?.[0]?.tutar || (mevcutTutar/2).toFixed(2);
    const t2 = ov.taksitler?.[1]?.tutar || (mevcutTutar/2).toFixed(2);
    const d1 = ov.taksitler?.[0]?.tarih || mevcutTarih;
    // 2. taksit 1 ay sonra
    const dt2 = new Date(mevcutTarih+'T00:00:00'); dt2.setMonth(dt2.getMonth()+1);
    const d2 = ov.taksitler?.[1]?.tarih || _format.localDateStr(dt2);
    titleEl.textContent = '⊟ Taksitlendirme — ' + ay;
    bodyEl.innerHTML = `
      <div style="font-size:11px;color:var(--text3);margin-bottom:8px">Toplam tutar: ${_format.fmt(mevcutTutar)} — İki taksit olarak bölebilirsiniz</div>
      <div class="form-row cols-2">
        <div><label>1. Taksit Tarihi</label><input id="kpf-t1-tarih" type="date"></div>
        <div><label>1. Taksit Tutarı</label><input id="kpf-t1-tutar" type="number" step="0.01"></div>
      </div>
      <div class="form-row cols-2">
        <div><label>2. Taksit Tarihi</label><input id="kpf-t2-tarih" type="date"></div>
        <div><label>2. Taksit Tutarı</label><input id="kpf-t2-tutar" type="number" step="0.01"></div>
      </div>
      <div class="form-row"><div><label>Not</label><input id="kpf-not-taksit" placeholder="Taksit nedeni..."></div></div>`;
    setTimeout(()=>{
      const i1t = document.getElementById('kpf-t1-tarih'); if(i1t) _moneyInput.setDateInputValue(i1t, d1);
      const i1a = document.getElementById('kpf-t1-tutar'); if(i1a) i1a.value = t1;
      const i2t = document.getElementById('kpf-t2-tarih'); if(i2t) _moneyInput.setDateInputValue(i2t, d2);
      const i2a = document.getElementById('kpf-t2-tutar'); if(i2a) i2a.value = t2;
      const iN  = document.getElementById('kpf-not-taksit');      if(iN)  iN.value  = mevcutNot;
    }, 0);
  } else if(islem==='not') {
    titleEl.textContent = '✎ Not Ekle — ' + ay;
    bodyEl.innerHTML = `
      <div class="form-row">
        <div><label>Not</label><input id="kpf-not-not" placeholder="Bu ödeme için not..." style="width:100%"></div>
      </div>`;
    setTimeout(()=>{ const el = document.getElementById('kpf-not-not'); if(el) el.value = mevcutNot; }, 0);
  }

  formEl.style.display = '';
  formEl.scrollIntoView({ behavior:'smooth', block:'nearest' });
  renderKontratPlan();
}

export function kontratPlanFormKapat() {
  _kpAktifForm = null;
  const f = document.getElementById('kontrat-plan-form');
  if(f) f.style.display = 'none';
}

export function kontratPlanFormKaydet() {
  if(!_kpAktifForm) return;
  const k = getKontrat(); if(!k) return;
  if(!k.odemeOverrides) k.odemeOverrides = {};
  const { ay, islem } = _kpAktifForm;
  const ov = k.odemeOverrides[ay] || {};

  if(islem==='ertele') {
    const tarih = document.getElementById('kpf-tarih')?.value;
    const tutar = parseFloat(document.getElementById('kpf-tutar')?.value);
    const not   = document.getElementById('kpf-not-ertele')?.value.trim();
    if(!tarih) { _modalGenel.showToast('Tarih zorunlu', 'error'); return; }
    k.odemeOverrides[ay] = { ...ov, durum:'ertelendi', tarih, tutar: isNaN(tutar)?Math.abs(k.tutar):tutar, not };
  } else if(islem==='taksit') {
    const t1t = document.getElementById('kpf-t1-tarih')?.value;
    const t1a = parseFloat(document.getElementById('kpf-t1-tutar')?.value);
    const t2t = document.getElementById('kpf-t2-tarih')?.value;
    const t2a = parseFloat(document.getElementById('kpf-t2-tutar')?.value);
    const not = document.getElementById('kpf-not-taksit')?.value.trim();
    if(!t1t || !t2t || isNaN(t1a) || isNaN(t2a)) { _modalGenel.showToast('Tüm alanları doldurun', 'error'); return; }
    k.odemeOverrides[ay] = { ...ov, durum:'taksit', taksitler:[{tarih:t1t,tutar:t1a},{tarih:t2t,tutar:t2a}], not };
  } else if(islem==='not') {
    const not = document.getElementById('kpf-not-not')?.value.trim();
    k.odemeOverrides[ay] = { ...ov, not };
    if(!k.odemeOverrides[ay].durum) delete k.odemeOverrides[ay].durum; // not only
  }

  _appCoreBase.saveData();
  kontratPlanFormKapat();
  renderKontratPlan();
  _modalGenel.showToast('Kaydedildi');
}



// ============================================================
// [DI-MIGRATION] ui.components.kontratPlani — container'a kayıt
// ============================================================
import { provide } from '@core/container.js';
provide('ui.components.kontratPlani', {
  get _kpTip() { return _kpTip; },
  get _kpId() { return _kpId; },
  get _kpYil() { return _kpYil; },
  get _kpAktifForm() { return _kpAktifForm; },
  openKontratPlan, kontratPlanYilDegistir, kontratPlanBugune, getKontrat,
  getOverride, renderKontratPlan, kontratPlanOdendi, kontratPlanOdenmediYap,
  kontratPlanAtla, kontratPlanSifirla, kontratPlanFormAc,
  kontratPlanFormKapat, kontratPlanFormKaydet,
});
