import { saveData, updateSidebarKartNav } from '../../../core/app-core-base.js';
import { fmtCur, localDateStr, uid } from '../../../core/format.js';
import { ALL_CURRENCIES, DB, defaultCurrency } from '../../../core/state.js';
import { rebuildAllCurrencies } from '../../../domain/doviz.js';
import { phSet, phUpdate, validateRequiredFields } from '../../components/modal-genel.js';
import { getMoneyInput, setDateInputValue, setMoneyInput } from '../../components/money-input.js';
import { gecmisListesiRenderEt, swizOzetSatirHtml, swizUpdateStepIndicator } from '../../components/step-wizard.js';
import { extreTypeChange } from '../ekstreler/01-ekstre-kesinlestirme.js';
import { KART_STEP_COUNT, _kartCurrentStep, set_kartCurrentStep } from './00-state.js';
import { _syncKartLimitAlaninaGrupLimit, populateOrtakGrupSelect, renderOrtakGrupYonetimSatiri } from './07-ortak-limit-grubu.js';
import { editKartId, fillKartAltyapiSelect, setEditKartId } from './09-kart-altyapi.js';
import { kartLimitGecmisSonSil } from './01-kart-data.js';
import { renderKartlar } from './10-kart-liste.js';
import { bankaOptionMetin } from '../tanimlamalar/01-genel-yardimcilar.js';
import { closeModal } from '../../components/modal-genel.js';
// ============================================================
// js/ui/pages/kartlar/06-kart-form.js
// Kart ekleme/düzenleme formu (step wizard)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/kartlar.js (145
// export, 3600+ satır) dosyasının, fonksiyon isim/işlev
// kümelerine göre bölünmüş bir parçasıdır. Kod SATIR SATIR
// AYNI kaldı — sadece dosya sınırı ve gruplama değişti.
// ============================================================
export function kartStepGoto(step) {
  step = Math.max(1, Math.min(KART_STEP_COUNT, step));
  set_kartCurrentStep(step);
  const modal = document.getElementById('modal-kart');
  if (!modal) return;
  // ---- Saf DOM güncelleme: js/ui/components/step-wizard.js:swizUpdateStepIndicator ----
  swizUpdateStepIndicator(modal, step);
  const backBtn = document.getElementById('kart-step-back-btn');
  const nextBtn = document.getElementById('kart-step-next-btn');
  const saveBtn = document.getElementById('kart-step-save-btn');
  if (backBtn) backBtn.style.display = step > 1 ? '' : 'none';
  if (nextBtn) nextBtn.style.display = step < KART_STEP_COUNT ? '' : 'none';
  if (saveBtn) saveBtn.style.display = step === KART_STEP_COUNT ? '' : 'none';
  const body = modal.querySelector('.modal-body');
  if (body) body.scrollTop = 0;
  if (step === KART_STEP_COUNT) _kartOzetDoldur();
}

export function kartStepNext() {
  if (!_kartValidateStep(_kartCurrentStep)) return;
  kartStepGoto(_kartCurrentStep + 1);
}

export function kartStepBack() {
  kartStepGoto(_kartCurrentStep - 1);
}

export function populateKartModal(kart=null) {
  kartStepGoto(1);
  const titleEl = document.getElementById('kart-modal-title');
  if (titleEl) titleEl.textContent = kart ? 'Kart Düzenle' : 'Kart Ekle';
  const bankaEl = document.getElementById('kart-banka');
  bankaEl.innerHTML = DB.bankalar.map(b=>`<option value="${b.id}">${bankaOptionMetin(b)}</option>`).join('');
  const tipEl = document.getElementById('kart-tip');
  tipEl.innerHTML = DB.urunTipler.map(t=>`<option value="${t.id}">${t.ad} (${t.kod})</option>`).join('');
  fillKartAltyapiSelect(kart ? kart.altyapiId||'' : '');
  phSet(bankaEl, 'Banka seçin…', kart ? kart.banka||'' : '', '— Banka bulunamadı —');
  phSet(tipEl, 'Ürün tipi seçin…', kart ? kart.tip||'' : '', '— Ürün tipi bulunamadı —');
  // Para birimi chip grid oluştur
  const selectedCurs = kart
    ? (kart.paraBirimleri && kart.paraBirimleri.length ? kart.paraBirimleri : (kart.paraBirimi ? [kart.paraBirimi] : [defaultCurrency]))
    : [defaultCurrency];
  const defaultCur = kart ? (kart.varsayilanParaBirimi || selectedCurs[0] || defaultCurrency) : defaultCurrency;
  renderKartCurGrid(selectedCurs, defaultCur);

  if(kart) {
    document.getElementById('kart-ad').value = kart.ad||'';
    setMoneyInput('kart-limit', kart.limit||'');
    setDateInputValue('kart-limit-tarih', kart.limitTarih||localDateStr(new Date()));
    renderKartLimitGecmis(kart.limitGecmisi||[]);
    document.getElementById('kart-no').value = kart.no||'';
    document.getElementById('kart-renk').value = kart.renk||'';
    const kdEl = document.getElementById('kart-durum'); if(kdEl) kdEl.value = kart.durum || 'aktif';
    document.getElementById('kart-extre-tip').value = kart.extraTip||'gun';
    document.getElementById('kart-extre-gun').value = kart.extraGun||25;
    document.getElementById('kart-extre-hafta').value = kart.extraHafta||1;
    document.getElementById('kart-extre-haftagun').value = kart.extraHaftaGun||5;
    document.getElementById('kart-odeme-sure').value = kart.odemeSure||10;
    document.getElementById('kart-odeme-gun-tip').value = kart.odemeGunTip||'ilerle';
    bankaEl.value = kart.banka||'';
    tipEl.value = kart.tip||'';
    phUpdate(bankaEl);
    phUpdate(tipEl);
    const gecmis = kart.extraGunGecmis||[];
    const sonKayit = gecmis.length ? [...gecmis].sort((a,b)=>b.baslangic.localeCompare(a.baslangic))[0] : null;
    document.getElementById('kart-extre-gecerlilik-ay').value = sonKayit ? sonKayit.baslangic : '';
    renderKartAyarGecmis(gecmis);
    extreTypeChange();
    populateOrtakGrupSelect(kart.ortakLimitGrupId||'', kart.id);
    _syncKartLimitAlaninaGrupLimit(kart.ortakLimitGrupId||'');
    renderOrtakGrupYonetimSatiri();
  } else {
    document.getElementById('kart-extre-gecerlilik-ay').value = '';
    setMoneyInput('kart-limit', '');
    setDateInputValue('kart-limit-tarih', localDateStr(new Date()));
    renderKartLimitGecmis([]);
    renderKartAyarGecmis([]);
    document.getElementById('kart-ad').value = '';
    document.getElementById('kart-no').value = '';
    document.getElementById('kart-renk').value = '';
    const kdEl = document.getElementById('kart-durum'); if(kdEl) kdEl.value = 'aktif';
    bankaEl.value = '';
    tipEl.value = '';
    phUpdate(bankaEl);
    phUpdate(tipEl);
    populateOrtakGrupSelect('');
    _syncKartLimitAlaninaGrupLimit('');
    renderOrtakGrupYonetimSatiri();
  }
}

export function renderKartCurGrid(selected=[], defCur=null) {
  if(!ALL_CURRENCIES.length) rebuildAllCurrencies();
  const grid = document.getElementById('kart-cur-grid');
  if(!grid) return;
  grid.innerHTML = ALL_CURRENCIES.map(c => {
    const isSel = selected.includes(c.code);
    const isDef = c.code === (defCur || selected[0]);
    return `<div class="cur-chip${isSel?' selected':''}${isSel&&isDef?' default-mark':''}"
      data-code="${c.code}">
      ${c.flag} ${c.label}${isSel&&isDef?'<span class="cur-star">⭐</span>':''}
    </div>`;
  }).join('');
  syncKartVarsayilanRow(selected, defCur);
  // [ES module] onclick="toggleKartCur(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
  grid.querySelectorAll('.cur-chip').forEach(chip => {
    chip.addEventListener('click', () => toggleKartCur(chip.getAttribute('data-code')));
  });
}

export function toggleKartCur(code) {
  const chips = document.querySelectorAll('#kart-cur-grid .cur-chip');
  const selected = [];
  chips.forEach(c => { if(c.dataset.code===code) c.classList.toggle('selected'); });
  chips.forEach(c => { if(c.classList.contains('selected')) selected.push(c.dataset.code); });
  // Ensure at least one selected
  if(selected.length===0) {
    document.querySelector(`#kart-cur-grid [data-code="${code}"]`).classList.add('selected');
    selected.push(code);
  }
  const curDef = document.getElementById('kart-varsayilan-pb')?.value || selected[0];
  const newDef = selected.includes(curDef) ? curDef : selected[0];
  renderKartCurGrid(selected, newDef);
}

export function syncKartVarsayilanRow(selected, defCur) {
  const row = document.getElementById('kart-cur-default-row');
  const sel = document.getElementById('kart-varsayilan-pb');
  if(!row || !sel) return;
  if(selected.length <= 1) { row.style.display='none'; return; }
  row.style.display='';
  sel.innerHTML = selected.map(c => {
    const info = ALL_CURRENCIES.find(x=>x.code===c);
    return `<option value="${c}">${info?info.flag+' ':''} ${c}</option>`;
  }).join('');
  sel.value = (defCur && selected.includes(defCur)) ? defCur : selected[0];
  // Re-render chips to reflect star
  sel.onchange = () => {
    const newSelected = [...selected]; // keep same selection
    renderKartCurGrid(newSelected, sel.value);
  };
}

export function getKartCurGridValue() {
  const chips = document.querySelectorAll('#kart-cur-grid .cur-chip.selected');
  const selected = Array.from(chips).map(c=>c.dataset.code);
  if(!selected.length) return { paraBirimleri: [defaultCurrency], varsayilanParaBirimi: defaultCurrency };
  const defSel = document.getElementById('kart-varsayilan-pb');
  const defVal = (defSel && selected.includes(defSel.value)) ? defSel.value : selected[0];
  return { paraBirimleri: selected, varsayilanParaBirimi: defVal };
}

// Kart limit geçmişini sadece görüntüleme amacıyla render eder (readonly)
// Son kayıt silinebilir; silindiğinde bir önceki limit geri yüklenir

export function renderKartLimitGecmis(gecmis) {
  const panel = document.getElementById('kart-limit-gecmis-liste');
  gecmisListesiRenderEt(panel, gecmis, {
    bosMesaj: 'Henüz limit kaydı yok',
    deger: g => g.limit,
    degerHtml: g => fmtCur(g.limit, 'TRY'),
    farkHtml: (g, fark) => fmtCur(fark, 'TRY'),
    ekBadgeHtml: (g) => g.kaynak === 'grup'
      ? '<span class="gecmis-badge" style="background:rgba(167,139,250,.15);color:var(--violet)">🔗 grup</span>'
      : '',
    silHandler: () => kartLimitGecmisSonSil()
  });
}

// Ekstre + Ödeme ayarları geçmişini görüntüleme amacıyla render eder (readonly)
// Her kayıt hem ekstre kesim bilgisini hem de o tarihte geçerli ödeme ayarlarını taşır.
// Son (en güncel) kayıt esas alınır; eskiler sadece bilgi amaçlıdır.

export function renderKartAyarGecmis(gecmis) {
  const panel = document.getElementById('kart-ayar-gecmis-liste');
  if(!panel) return;
  panel.innerHTML = '';
  const sorted = (gecmis||[]).slice().sort((a,b)=>b.baslangic.localeCompare(a.baslangic));
  if(!sorted.length) {
    panel.innerHTML = '<div style="color:var(--text3);font-size:11px;padding:6px 2px">Henüz kayıt yok — kaydettiğinizde ilk kayıt oluşur.</div>';
    return;
  }
  const odemeGunTipEtiket = {
    'ilerle': 'Ödeme ileri', 'geri': 'Ödeme geri',
    'extre-ilerle': 'Ekstre ileri (ödeme sabit)', 'extre-geri': 'Ekstre geri (ödeme sabit)',
    'extre-odeme-ilerle': 'Ekstre ileri (ödeme kayar)', 'extre-odeme-geri': 'Ekstre geri (ödeme kayar)'
  };
  sorted.forEach((g, idx) => {
    const isLast = idx === 0;
    const satir = document.createElement('div');
    satir.style.cssText = 'background:var(--surface3);border:1px solid var(--border);border-radius:6px;padding:7px 10px;margin-bottom:6px;font-size:11.5px';
    const ekstreOzet = g.tip === 'hafta'
      ? `${g.hafta}. hafta / ${['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'][g.haftaGun]}`
      : `Her ayın ${g.gun}. günü`;
    const odemeOzet = (g.odemeSure !== undefined && g.odemeSure !== null)
      ? `${g.odemeSure} gün sonra · ${odemeGunTipEtiket[g.odemeGunTip] || g.odemeGunTip || '-'}`
      : '<span style="color:var(--text3)">(bu kayıttan önce ödeme ayarı tutulmuyordu)</span>';
    satir.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
        <span style="color:var(--text);font-weight:600">${g.baslangic === '2000-01' ? 'Başından beri' : g.baslangic}</span>
        ${isLast ? '<span style="font-size:10px;color:var(--accent);font-weight:700">▶ Güncel</span>' : ''}
      </div>
      <div style="color:var(--text2)">🗓️ ${ekstreOzet}</div>
      <div style="color:var(--text2)">💳 ${odemeOzet}</div>`;
    panel.appendChild(satir);
  });
}

// readKartLimitGecmis — sadece mevcut geçmişi data'dan döndürür

export function readKartLimitGecmis() {
  if(editKartId) {
    const k = (DB.kartlar||[]).find(x=>x.id===editKartId);
    return (k && k.limitGecmisi) ? k.limitGecmisi : [];
  }
  return [];
}

export function _kartValidateStep(step) {
  if (step === 1) {
    if (!validateRequiredFields([
      {id:'kart-banka', msg:'Banka seçimi zorunlu'},
      {id:'kart-tip',   msg:'Ürün tipi seçimi zorunlu'},
      {id:'kart-ad',    msg:'Kart adı zorunlu'}
    ])) return false;
    return true;
  }
  return true;
}

export function _kartOzetDoldur() {
  const bankaSel = document.getElementById('kart-banka');
  const bankaObj = bankaSel ? (DB.bankalar||[]).find(b=>b.id===bankaSel.value) : null;
  const tipSel = document.getElementById('kart-tip');
  const tipTxt = tipSel ? (tipSel.options[tipSel.selectedIndex]?.text || '—') : '—';
  const ad = (document.getElementById('kart-ad')||{}).value.trim() || '—';
  const no = (document.getElementById('kart-no')||{}).value.trim();
  const limit = getMoneyInput('kart-limit') || 0;
  const grupSel = document.getElementById('kart-ortak-grup');
  const grupTxt = grupSel && grupSel.value ? (grupSel.options[grupSel.selectedIndex]?.text || '—') : 'Yok';
  const curVal = getKartCurGridValue();
  const curTxt = (curVal.paraBirimleri||[]).join(', ') + ` (varsayılan: ${curVal.varsayilanParaBirimi})`;
  const extraTip = (document.getElementById('kart-extre-tip')||{}).value;
  const extraTxt = extraTip === 'hafta'
    ? `Hafta bazlı`
    : `Her ayın ${(document.getElementById('kart-extre-gun')||{}).value || '—'}. günü`;
  const odemeSure = (document.getElementById('kart-odeme-sure')||{}).value || '—';

  const satir = swizOzetSatirHtml;

  const ozetEl = document.getElementById('kart-ozet-icerik');
  if (!ozetEl) return;
  ozetEl.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px 16px;margin-bottom:12px">
      ${satir('Banka', bankaObj ? bankaObj.kisa : '—')}
      ${satir('Ürün Tipi', `<span style="font-family:inherit">${tipTxt}</span>`)}
      ${satir('Kart/Hesap Adı', `<span style="font-family:inherit">${ad}</span>`)}
      ${no ? satir('Son 4 Hane', no) : ''}
      ${satir('Durum', `<span style="font-family:inherit">${((document.getElementById('kart-durum')||{}).value||'aktif')==='pasif'?'Pasif':'Aktif'}</span>`)}
      ${satir('Toplam Limit', fmtCur(limit, curVal.varsayilanParaBirimi||'TRY'))}
      ${satir('Ortak Limit Grubu', `<span style="font-family:inherit">${grupTxt}</span>`)}
      ${satir('Para Birimleri', `<span style="font-family:inherit;font-size:11px">${curTxt}</span>`)}
      ${satir('Ekstre Kesimi', `<span style="font-family:inherit">${extraTxt}</span>`)}
      ${satir('Ödeme Süresi', odemeSure + ' gün sonrası')}
    </div>`;
}

export function saveKart() {
  const kart = {
    id: editKartId || uid(),
    banka: document.getElementById('kart-banka').value,
    tip: document.getElementById('kart-tip').value,
    ad: document.getElementById('kart-ad').value.trim(),
    no: document.getElementById('kart-no').value.trim(),
    altyapiId: document.getElementById('kart-altyapi').value || '',
    durum: (document.getElementById('kart-durum')||{}).value || 'aktif',
    renk: document.getElementById('kart-renk').value,
    extraTip: document.getElementById('kart-extre-tip').value,
    extraGun: parseInt(document.getElementById('kart-extre-gun').value)||25,
    extraHafta: parseInt(document.getElementById('kart-extre-hafta').value)||1,
    extraHaftaGun: parseInt(document.getElementById('kart-extre-haftagun').value)||5,
    extraStatik: document.getElementById('kart-extre-statik').value,
    extraGunGecmis: (()=>{
      const ay = document.getElementById('kart-extre-gecerlilik-ay').value;
      const tip = document.getElementById('kart-extre-tip').value;
      const odemeSureVal = parseInt(document.getElementById('kart-odeme-sure').value)||10;
      const odemeGunTipVal = document.getElementById('kart-odeme-gun-tip').value;
      // Mevcut kartın geçmişini al
      const mevcutKart = editKartId ? DB.kartlar.find(k=>k.id===editKartId) : null;
      const eskiGecmis = mevcutKart ? (mevcutKart.extraGunGecmis||[]) : [];
      // Yeni kayıt oluştur — ekstre + ödeme ayarları birlikte, aynı geçerlilik ayına yazılır
      let yeniKayit;
      if(tip === 'hafta') {
        const hafta = parseInt(document.getElementById('kart-extre-hafta').value)||1;
        const haftaGun = parseInt(document.getElementById('kart-extre-haftagun').value)||5;
        const _aktifAyH = ay || (function(){const n=new Date();return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0');}());
        yeniKayit = {baslangic: _aktifAyH, tip:'hafta', hafta, haftaGun, odemeSure: odemeSureVal, odemeGunTip: odemeGunTipVal};
      } else {
        const gun = parseInt(document.getElementById('kart-extre-gun').value)||25;
        const _aktifAyG = ay || (function(){const n=new Date();return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0');}());
        yeniKayit = {baslangic: _aktifAyG, tip:'gun', gun, odemeSure: odemeSureVal, odemeGunTip: odemeGunTipVal};
      }
      // Aynı ay varsa üzerine yaz (değişiklikler de güncellenmiş olur), yoksa ekle
      const filtreli = eskiGecmis.filter(r=>r.baslangic !== yeniKayit.baslangic);
      return [...filtreli, yeniKayit];
    })(),
    odemeSure: parseInt(document.getElementById('kart-odeme-sure').value)||10,
    odemeGunTip: document.getElementById('kart-odeme-gun-tip').value,
    ortakLimitGrupId: document.getElementById('kart-ortak-grup').value || '',
    ...getKartCurGridValue()
  };

  // Limit verileri — KMH ile aynı mantık: tarihe göre geçmiş tutulur, en son eklenen geçerli olur
  const yeniLimit = getMoneyInput('kart-limit')||0;
  const yeniTarih = document.getElementById('kart-limit-tarih').value || localDateStr(new Date());
  const grupSecili = document.getElementById('kart-ortak-grup')?.value || '';
  const mevcutGecmis = readKartLimitGecmis();
  const sorted = mevcutGecmis.slice().sort((a,b)=>b.tarih.localeCompare(a.tarih));
  const guncelLimit = sorted.length > 0 ? sorted[0].limit : null;
  let yeniGecmis = mevcutGecmis;
  if(yeniLimit !== guncelLimit) {
    // Önceki son kaydın bitiş tarihini güncelle
    if(sorted.length > 0) {
      const sonKayitIdx = mevcutGecmis.findIndex(g => g.tarih === sorted[0].tarih && g.limit === sorted[0].limit);
      if(sonKayitIdx >= 0) mevcutGecmis[sonKayitIdx].bitisTarih = yeniTarih;
    }
    const yeniKayit = {tarih: yeniTarih, limit: yeniLimit};
    if (grupSecili) yeniKayit.kaynak = 'grup';
    yeniGecmis = [...mevcutGecmis, yeniKayit];
  }
  const finalSorted = yeniGecmis.slice().sort((a,b)=>b.tarih.localeCompare(a.tarih));
  kart.limit = finalSorted.length ? finalSorted[0].limit : yeniLimit;
  kart.limitTarih = finalSorted.length ? finalSorted[0].tarih : yeniTarih;
  kart.limitGecmisi = yeniGecmis;

  if(!validateRequiredFields([{id:'kart-ad',msg:'Kart adı zorunlu'},{id:'kart-banka',msg:'Banka seçimi zorunlu'},{id:'kart-tip',msg:'Ürün tipi seçimi zorunlu'}])) return;
  if(editKartId) {
    const idx = DB.kartlar.findIndex(k=>k.id===editKartId);
    if(idx>=0) DB.kartlar[idx]=kart;
  } else {
    DB.kartlar.push(kart);
  }
  setEditKartId(null);
  saveData();
  closeModal('modal-kart');
  renderKartlar();
  updateSidebarKartNav();
}

