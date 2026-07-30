import { saveData } from '@core/app-core-base.js';
import { fmt, fmtCur, localDateStr, uid } from '@core/format.js';
import { ALL_CURRENCIES, DB, defaultCurrency } from '@core/state.js';
import { rebuildAllCurrencies } from '@domain/doviz.js';
import { _tutarAsiyorMu, getBsmvOrani, getKkdfOrani, getKmhFaizOrani, hesaplaNakitAvansOnizleme } from '@domain/hesaplamalar.js';
import { phSet, showToast, validateRequiredFields } from '@components/modal-genel.js';
import { bindMoneyInputs, getMoneyInput, setDateInputValue, setMoneyInput } from '@components/money-input.js';
import { swizUpdateStepIndicator } from '@components/step-wizard.js';
import { renderIslemler } from '@pages/islemler/03-islem-liste-render.js';
import { getKartCurrencies, getKartDefaultCurrency } from '@pages/kartlar/01-kart-data.js';
import { NA_STEP_COUNT, _naCurrentStep, _naLimitAutoSaveTimer, editNaId, setEditNaId, set_naCurrentStep, set_naLimitAutoSaveTimer } from '@pages/krediler/00-state.js';
import { closeModal, openModal } from '@components/modal-genel.js';
import { register } from '@core/wrap-registry.js';
// ============================================================
// js/ui/pages/krediler/02-nakit-avans.js
// Nakit avans akışı (ekleme/düzenleme wizard, limit kontrolleri)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/krediler.js
// (87 export, 1700+ satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function openNakitAvansModal(kartId) {
  setEditNaId(null);
  naStepGoto(1);
  const titleEl = document.getElementById('na-modal-title');
  if(titleEl) titleEl.textContent = 'Nakit Avans';
  const subEl = document.getElementById('na-modal-subtitle');
  if(subEl) subEl.textContent = 'Kredi kartından nakit para çekimi';

  const todayStr = localDateStr(new Date());
  // Kart listesi
  const kartSel = document.getElementById('na-kart');
  kartSel.innerHTML = DB.kartlar.map(k=>`<option value="${k.id}">${k.ad}</option>`).join('');
  if (kartId && DB.kartlar.some(k=>k.id===kartId)) {
    kartSel.value = kartId;
  } else {
    phSet(kartSel, 'Kart seçin…', '', '— Kart bulunamadı —');
  }

  // Tarih
  setDateInputValue('na-tarih', todayStr);

  // Para birimi: nakitAvansCurlar veya tüm
  onNaKartChange();

  // Faiz (KMH veya tavan)
  const pb = document.getElementById('na-para-birimi').value || 'TRY';
  const faiz = getNakitAvansFaizOrani(pb, todayStr);
  document.getElementById('na-faiz').value = faiz;
  const kaynakEl = document.getElementById('na-faiz-kaynak');
  if(kaynakEl) kaynakEl.textContent = `Tanımlamalardan: %${faiz} aylık (düzenlenebilir)`;

  // KKDF / BSMV
  document.getElementById('na-kkdf').value = getKkdfOrani(todayStr);
  document.getElementById('na-bsmv').value = getBsmvOrani(todayStr);

  // Taksit
  document.getElementById('na-taksit').value = 1;
  document.getElementById('na-tutar').value = '';
  document.getElementById('na-aciklama').value = '';
  document.getElementById('na-sonuc-wrap').style.display = 'none';
  document.getElementById('na-taksit-alanlari').innerHTML = '';

  openModal('modal-nakit-avans');
}

export function editNakitAvans(id) {
  const i = DB.islemler.find(x=>x.id===id);
  if(!i) return;
  setEditNaId(id);

  const titleEl = document.getElementById('na-modal-title');
  if(titleEl) titleEl.textContent = 'Nakit Avans Düzenle';
  const subEl = document.getElementById('na-modal-subtitle');
  if(subEl) subEl.textContent = 'Kredi kartından nakit avans işlemini düzenle';

  // Kart listesi
  const kartSel = document.getElementById('na-kart');
  kartSel.innerHTML = DB.kartlar.map(k=>`<option value="${k.id}">${k.ad}</option>`).join('');
  phSet(kartSel, 'Kart seçin…', i.kart, '— Kart bulunamadı —');

  // Tarih
  setDateInputValue('na-tarih', i.tarih);

  // Para birimi — onNaKartChange faizi KMH'dan doldurur, sonra kaydedilmiş değerlerle eziyoruz
  onNaKartChange();
  const pbSel = document.getElementById('na-para-birimi');
  const supported = getKartCurrencies(i.kart);
  if(i.paraBirimi && supported.includes(i.paraBirimi)) pbSel.value = i.paraBirimi;

  // Açıklama (💵 ön ekini kaldır)
  document.getElementById('na-aciklama').value = (i.aciklama||'').replace(/^💵\s*/, '');

  // Faiz / KKDF / BSMV — onNaKartChange→onNaPbChange KMH oranını yazdı, kaydedilen oranlarla override et
  const bilgi = i.nakitAvansBilgi || {};
  document.getElementById('na-faiz').value = bilgi.faiz != null ? bilgi.faiz : 0;
  document.getElementById('na-kkdf').value = bilgi.kkdf != null ? bilgi.kkdf : 0;
  document.getElementById('na-bsmv').value = bilgi.bsmv != null ? bilgi.bsmv : 0;
  const kaynakEl = document.getElementById('na-faiz-kaynak');
  if(kaynakEl) kaynakEl.textContent = 'Bu işlem için kayıtlı oranlar (düzenlenebilir)';

  // Çekilen ana para
  document.getElementById('na-tutar').value = bilgi.anaPara != null ? bilgi.anaPara : i.tutar;

  // Taksit sayısı
  const taksit = i.taksit || 1;
  document.getElementById('na-taksit').value = taksit;

  // Taksit planını hesapla, sonra mevcut tutar/tarihleri üzerine yaz
  calcNakitAvans();
  if(taksit > 1) {
    const container = document.getElementById('na-taksit-alanlari');
    const tutarlar = i.taksitTutarlari || Array(taksit).fill(i.aylik || 0);
    const tarihler = i.manuelTaksitler ? i.manuelTaksitler.map(t=>t.tarih) : [];
    const tutarInputs = container.querySelectorAll('[data-na-taksit-field="tutar"]');
    const tarihInputs = container.querySelectorAll('[data-na-taksit-field="tarih"]');
    tutarInputs.forEach((inp, idx) => { if(tutarlar[idx] !== undefined) inp.value = tutarlar[idx]; });
    tarihInputs.forEach((inp, idx) => { if(tarihler[idx]) setDateInputValue(inp, tarihler[idx]); });
    onNaTaksitChange();
  }

  openModal('modal-nakit-avans');
}

export function onNaKartChange() {
  const kartId = document.getElementById('na-kart').value;
  const pbSel = document.getElementById('na-para-birimi');
  const naCurlar = DB.nakitAvansCurlar && DB.nakitAvansCurlar.length
    ? DB.nakitAvansCurlar
    : (ALL_CURRENCIES.length ? ALL_CURRENCIES.map(c=>c.code) : ['TRY']);
  const kartCurlar = getKartCurrencies(kartId);
  // Sadece nakit avansın desteklediği VE kartın desteklediği para birimlerinin kesişimi
  let naParaBirimleri = naCurlar.filter(c=>kartCurlar.includes(c));
  if(!naParaBirimleri.length) naParaBirimleri = kartCurlar; // kesişim boşsa kartın para birimlerine düş
  pbSel.innerHTML = naParaBirimleri.map(c=>`<option value="${c}">${c}</option>`).join('');
  phSet(pbSel, 'Para birimi seçin…', '', '— Para birimi bulunamadı —');
  const kartDef = getKartDefaultCurrency(kartId);
  if(naParaBirimleri.includes(kartDef)) pbSel.value = kartDef;
  onNaPbChange();
  updateNaLimitInfo();
}

export function onNaPbChange() {
  const pb = document.getElementById('na-para-birimi').value;
  const tarih = document.getElementById('na-tarih').value || localDateStr(new Date());
  // Edit modunda kullanıcının kaydettiği faiz oranını koruyoruz; sadece yeni kayıtta otomatik doldur
  if(!editNaId) {
    const faiz = getNakitAvansFaizOrani(pb, tarih);
    document.getElementById('na-faiz').value = faiz;
    const kaynakEl = document.getElementById('na-faiz-kaynak');
    if(kaynakEl) {
      const kmh = getKmhFaizOrani(tarih);
      kaynakEl.textContent = `KMH Faiz: %${kmh} aylık (tanımlamalardan otomatik)`;
    }
  }
  updateNaLimitInfo();
  calcNakitAvans();
}

export function onNaTarihChange() {
  onNaPbChange();
}

export function updateNaLimitInfo() {
  const el = document.getElementById('na-limit-info');
  if(!el) return;
  const kartId = document.getElementById('na-kart').value;
  const kart = DB.kartlar.find(k=>k.id===kartId);
  if(!kart) { el.innerHTML = ''; return; }
  const pb = (document.getElementById('na-para-birimi')||{}).value || kart.paraBirimi || defaultCurrency;
  const tip = DB.nakitAvansLimitTip || 'kullanilabilir';
  const oran = DB.nakitAvansMaxOran != null ? DB.nakitAvansMaxOran : 50;
  const tipLabel = tip==='kullanilabilir' ? 'Kull. Limit' : 'Toplam Limit';
  const limit = tip==='kullanilabilir'
    ? ((kart.limit||0) - (kart.borc||0))
    : (kart.limit||0);
  const oranliLimit = limit * oran / 100;
  const tavanRow = (DB.nakitAvansTavanlar||[]).find(r=>r.paraBirimi===pb);
  const maxCek = tavanRow ? Math.min(oranliLimit, tavanRow.tavanMiktar) : oranliLimit;
  const tavanNot = tavanRow && tavanRow.tavanMiktar < oranliLimit
    ? `<span style="color:var(--warn)"> ↓ Tavan miktar uygulandı</span>`
    : '';
  el.innerHTML = `Max çekilebilir: <b style="color:var(--teal)">${fmtCur(maxCek, pb)}</b>${tavanNot}<br><span style="font-size:10px">${tipLabel} × %${oran}${tavanRow?' → MIN(oran, tavan)':''}</span>`;
  checkNaTutarLimit();
}

export function checkNaTutarLimit() {
  const warnEl = document.getElementById('na-tutar-warn');
  const inputEl = document.getElementById('na-tutar');
  if(!warnEl || !inputEl) return;
  const kartId = document.getElementById('na-kart').value;
  const pb = document.getElementById('na-para-birimi').value;
  const tutar = getMoneyInput('na-tutar') || 0;
  const maxCek = getNakitAvansMaxTutar(kartId, pb);
  if(tutar > 0 && maxCek != null && isFinite(maxCek) && _tutarAsiyorMu(tutar, maxCek)) {
    warnEl.textContent = `⚠ Girilen tutar maksimum çekilebilir tutarı (${fmtCur(maxCek, pb)}) aşıyor`;
    warnEl.style.display = 'block';
    inputEl.style.borderColor = 'var(--danger)';
    inputEl.style.boxShadow = '0 0 0 2px rgba(239,68,68,0.3)';
  } else {
    warnEl.style.display = 'none';
    inputEl.style.borderColor = '';
    inputEl.style.boxShadow = '';
  }
}

export function calcNakitAvans() {
  const tutar = getMoneyInput('na-tutar') || 0;
  const taksit = Math.max(1, Math.min(12, parseInt(document.getElementById('na-taksit').value)||1));
  const faiz = parseFloat(document.getElementById('na-faiz').value) || 0;
  const kkdf = parseFloat(document.getElementById('na-kkdf').value) || 0;
  const bsmv = parseFloat(document.getElementById('na-bsmv').value) || 0;
  const tarih = document.getElementById('na-tarih').value;
  const sonucWrap = document.getElementById('na-sonuc-wrap');
  const taksitDiv = document.getElementById('na-taksit-alanlari');
  const ozetDiv = document.getElementById('na-ozet');

  checkNaTutarLimit();

  if(!tutar || tutar <= 0) { sonucWrap.style.display='none'; return; }
  sonucWrap.style.display = 'block';

  // ---- Saf hesaplama artık js/domain/hesaplamalar.js:hesaplaNakitAvansOnizleme'de ----
  const onizleme = hesaplaNakitAvansOnizleme(tutar, taksit, faiz, kkdf, bsmv, tarih || null);
  const { aylikTaksit, toplamOdeme, toplamFaiz } = onizleme;

  ozetDiv.innerHTML = `Ana para: <b>${fmt(tutar)}</b> &nbsp;|&nbsp; Aylık taksit: <b style="color:var(--warn)">${fmt(aylikTaksit)}</b> &nbsp;|&nbsp; Toplam faiz: <b class="red">${fmt(toplamFaiz)}</b> &nbsp;|&nbsp; Toplam ödeme: <b>${fmt(toplamOdeme)}</b>`;

  if(taksit === 1) {
    taksitDiv.innerHTML = `<div style="font-size:12px;color:var(--text2)">Tek çekim — toplam geri ödeme: <b style="color:var(--warn)">${fmt(aylikTaksit)}</b></div>`;
    return;
  }

  const rows = onizleme.taksitPlani.map(r => ({ tarih: r.tarih ? localDateStr(new Date(r.tarih+'T00:00:00')) : '', tutar: r.tutar }));

  const todayStr = localDateStr(new Date());
  taksitDiv.innerHTML = `<div class="tp-wrap tp-wrap-4col">
    <div class="tp-header"><div></div><div>Tarih</div><div>Tutar</div><div></div></div>
    ${rows.map((r,i)=>`<div class="tp-row${r.tarih<todayStr?' tp-past':''}">
      <div class="tp-no">${i+1}</div>
      <input type="date" class="tp-input" value="${r.tarih}" data-na-taksit-field="tarih" data-na-idx="${i}">
      <input type="number" step="0.01" class="tp-input tp-input-tutar" value="${r.tutar}" data-na-taksit-field="tutar" data-na-idx="${i}" data-oc-handler="onNaTaksitChange" data-oc-event="input">
      <button class="tp-del na-reset-tek-btn" title="Sıfırla" data-idx="${i}" data-tarih="${rows[i].tarih}" data-tutar="${rows[i].tutar}">↺</button>
    </div>`).join('')}
    <div class="tp-footer">
      <div class="tp-footer-info">
        <span class="tp-footer-total">Toplam: <span id="na-tp-toplam">${fmt(toplamOdeme)}</span></span>
        <span class="tp-footer-meta">${taksit} taksit × ort. ${fmt(aylikTaksit)}</span>
      </div>
      <button class="tp-reset-all" id="na-tp-reset-all-btn">↺ Sıfırla</button>
    </div>
  </div>`;
  // [ES module] onclick="resetNaTaksit(...)" ve onclick="calcNakitAvans()" kaldırıldı.
  taksitDiv.querySelectorAll('.na-reset-tek-btn').forEach(btn => {
    btn.addEventListener('click', () => resetNaTaksit(btn, Number(btn.getAttribute('data-idx')), btn.getAttribute('data-tarih'), Number(btn.getAttribute('data-tutar'))));
  });
  const resetAllBtn = document.getElementById('na-tp-reset-all-btn');
  if (resetAllBtn) resetAllBtn.addEventListener('click', () => calcNakitAvans());
}

export function onNaTaksitChange(el) {
  const container = document.getElementById('na-taksit-alanlari');
  const inputs = container.querySelectorAll('[data-na-taksit-field="tutar"]');
  let top = 0; inputs.forEach(i=>top+=parseFloat(i.value)||0);
  const span = document.getElementById('na-tp-toplam');
  if(span) span.textContent = fmt(top);
}

export function saveNakitAvans() {
  const kartId = document.getElementById('na-kart').value;
  const tarih = document.getElementById('na-tarih').value;
  const tutar = getMoneyInput('na-tutar') || 0;
  const taksit = Math.max(1, Math.min(12, parseInt(document.getElementById('na-taksit').value)||1));
  const pb = document.getElementById('na-para-birimi').value;
  const aciklama = document.getElementById('na-aciklama').value.trim() || 'Nakit Avans';
  const faiz = parseFloat(document.getElementById('na-faiz').value)||0;
  const kkdf = parseFloat(document.getElementById('na-kkdf').value)||0;
  const bsmv = parseFloat(document.getElementById('na-bsmv').value)||0;

  if(!validateRequiredFields([{id:'na-kart',msg:'Kart seçiniz'},{id:'na-tarih',msg:'İşlem tarihi zorunlu'},{id:'na-tutar',msg:'Çekilecek tutar zorunlu'}])) return;

  const maxCek = getNakitAvansMaxTutar(kartId, pb);
  if(maxCek != null && isFinite(maxCek) && _tutarAsiyorMu(tutar, maxCek)) {
    showToast(`Maksimum çekilebilir tutarı (${fmtCur(maxCek, pb)}) aşıyorsunuz`, 'warn');
    return;
  }

  const container = document.getElementById('na-taksit-alanlari');
  let tutarlar = [], tarihler = [];
  if(taksit === 1) {
    // Tek çekim — faizli toplam
    // ---- Saf hesaplama: js/domain/hesaplamalar.js:hesaplaNakitAvansOnizleme ----
    const toplamOdeme = hesaplaNakitAvansOnizleme(tutar, 1, faiz, kkdf, bsmv, null).aylikTaksit;
    tutarlar = [parseFloat(toplamOdeme.toFixed(2))];
    tarihler = [tarih];
  } else {
    container.querySelectorAll('[data-na-taksit-field="tutar"]').forEach(i=>tutarlar.push(parseFloat(i.value)||0));
    container.querySelectorAll('[data-na-taksit-field="tarih"]').forEach(i=>tarihler.push(i.value));
  }

  const toplamTutar = tutarlar.reduce((s,t)=>s+t,0);
  const islem = {
    id: editNaId || uid(),
    kart: kartId,
    tarih,
    aciklama: `💵 ${aciklama}`,
    kategori: null,
    tutar: toplamTutar,
    taksit,
    aylik: tutarlar[0]||0,
    taksitTutarlari: tutarlar,
    manuelTaksitler: tutarlar.map((t,i)=>({ tarih: tarihler[i]||'', tutar: t })),
    paraBirimi: pb,
    tip: 'nakitAvans',
    nakitAvansBilgi: { anaPara: tutar, faiz, kkdf, bsmv }
  };

  if(!DB.islemler) DB.islemler = [];
  if(editNaId) {
    const idx = DB.islemler.findIndex(i=>i.id===editNaId);
    if(idx>=0) DB.islemler[idx] = islem; else DB.islemler.push(islem);
  } else {
    DB.islemler.push(islem);
  }
  setEditNaId(null);
  saveData();
  closeModal('modal-nakit-avans');
  renderIslemler();
  showToast('Nakit avans kaydedildi','ok');
}

// [KALDIRILDI] saveNakitAvansCur() — geliştirici notunda zaten "artık gerekli
// değil, uyumluluk için bırakıldı" diye işaretlenmişti; hiçbir yerden
// çağrılmadığı doğrulandı (ölü kod taraması, 2026-07).

export function saveNakitAvansLimitKural(silent) {
  const tip = document.getElementById('nakit-avans-limit-tip').value;
  const oran = parseFloat(document.getElementById('nakit-avans-max-oran').value);
  if(isNaN(oran)||oran<0||oran>100) { if(!silent) showToast('Geçerli bir oran giriniz (0-100)','warn'); return; }
  DB.nakitAvansLimitTip = tip;
  DB.nakitAvansMaxOran = oran;
  saveData();
  updateNakitAvansLimitPreview();
  const st = document.getElementById('nakit-avans-limit-status');
  if(st) { st.textContent = '✓ Kaydedildi'; setTimeout(()=>st.textContent='',2000); }
}

export function updateNakitAvansLimitPreview() {
  const el = document.getElementById('nakit-avans-limit-preview');
  if(!el) return;
  const tip = (document.getElementById('nakit-avans-limit-tip')||{}).value || DB.nakitAvansLimitTip || 'kullanilabilir';
  const oran = parseFloat((document.getElementById('nakit-avans-max-oran')||{}).value);
  if(!oran) { el.innerHTML = ''; return; }
  const tipLabel = tip==='kullanilabilir' ? 'kullanılabilir limit' : 'toplam limit';
  el.innerHTML = `<span style="color:var(--teal)">📐 Kural:</span> Çekilebilir maks = MIN( <b>${tipLabel} × %${oran}</b> , para birimine tanımlı tavan miktar )`;
}

export function getNakitAvansMaxTutar(kartId, paraBirimi) {
  const kart = DB.kartlar.find(k=>k.id===kartId);
  if(!kart) return Infinity;
  const tip = DB.nakitAvansLimitTip || 'kullanilabilir';
  const oran = DB.nakitAvansMaxOran != null ? DB.nakitAvansMaxOran : 50;
  const limit = tip==='kullanilabilir'
    ? ((kart.limit||0) - (kart.borc||0))
    : (kart.limit||0);
  const oranliLimit = limit * oran / 100;
  const tavanRow = (DB.nakitAvansTavanlar||[]).find(r=>r.paraBirimi===paraBirimi);
  if(!tavanRow) return oranliLimit;
  return Math.min(oranliLimit, tavanRow.tavanMiktar);
}

export function resetNaTaksit(btn, idx, origTarih, origTutar) {
  const row = btn.closest('.tp-row');
  const ti = row.querySelector('[data-na-taksit-field="tarih"]');
  const tu = row.querySelector('[data-na-taksit-field="tutar"]');
  if(ti) setDateInputValue(ti, origTarih);
  if(tu) { tu.value = origTutar; onNaTaksitChange(tu); }
}

export function naStepGoto(step) {
  step = Math.max(1, Math.min(NA_STEP_COUNT, step));
  set_naCurrentStep(step);
  const modal = document.getElementById('modal-nakit-avans');
  if (!modal) return;
  // ---- Saf DOM güncelleme: js/ui/components/step-wizard.js:swizUpdateStepIndicator ----
  swizUpdateStepIndicator(modal, step);
  const backBtn = document.getElementById('na-step-back-btn');
  const nextBtn = document.getElementById('na-step-next-btn');
  const saveBtn = document.getElementById('na-step-save-btn');
  if (backBtn) backBtn.style.display = step > 1 ? '' : 'none';
  if (nextBtn) nextBtn.style.display = step < NA_STEP_COUNT ? '' : 'none';
  if (saveBtn) saveBtn.style.display = step === NA_STEP_COUNT ? '' : 'none';
  const body = modal.querySelector('.modal-body');
  if (body) body.scrollTop = 0;
  if (step === NA_STEP_COUNT) calcNakitAvans();
}
register('wizardStepGoto:modal-nakit-avans', naStepGoto);
register('wizardCurrentStep:modal-nakit-avans', () => _naCurrentStep);

export function _naValidateStep(step) {
  if (step === 1) {
    if (!validateRequiredFields([
      {id:'na-kart',  msg:'Kart seçiniz'},
      {id:'na-tarih', msg:'İşlem tarihi zorunlu'},
      {id:'na-tutar', msg:'Çekilecek tutar zorunlu'}
    ])) return false;
    return true;
  }
  return true;
}

export function naStepNext() {
  if (!_naValidateStep(_naCurrentStep)) return;
  naStepGoto(_naCurrentStep + 1);
}

register('wizardStepNext:modal-nakit-avans', naStepNext);


export function naStepBack() {
  naStepGoto(_naCurrentStep - 1);
}

export function renderNakitAvansCurGrid() {
  if(!ALL_CURRENCIES.length) rebuildAllCurrencies();
  const selected = new Set(DB.nakitAvansCurlar || []);
  const grid = document.getElementById('nakit-avans-cur-grid');
  if(!grid) return;
  grid.innerHTML = ALL_CURRENCIES.map(c => {
    const isSelected = selected.has(c.code);
    return `<span class="cur-chip${isSelected?' selected':''}" style="cursor:pointer;user-select:none" data-cur="${c.code}">${c.flag||''} ${c.code}</span>`;
  }).join('');
  // [ES module] onclick="toggleNakitAvansCur(this)" kaldırıldı.
  grid.querySelectorAll('.cur-chip').forEach(chip => {
    chip.addEventListener('click', () => toggleNakitAvansCur(chip));
  });
}

export function toggleNakitAvansCur(el) {
  el.classList.toggle('selected');
  // Otomatik kaydet
  const selected = [...document.querySelectorAll('#nakit-avans-cur-grid .cur-chip.selected')].map(el=>el.dataset.cur);
  DB.nakitAvansCurlar = selected;
  saveData();
  const st = document.getElementById('nakit-avans-cur-status');
  if(st) { st.textContent = '✓'; setTimeout(()=>st.textContent='',1500); }
  renderNakitAvansTavanlar();
}

export function renderNakitAvansTavanlar() {
  const grid = document.getElementById('nakit-avans-tavan-grid');
  if(!grid) return;
  if(!ALL_CURRENCIES.length) rebuildAllCurrencies();
  const naParaBirimleri = DB.nakitAvansCurlar && DB.nakitAvansCurlar.length
    ? DB.nakitAvansCurlar
    : ALL_CURRENCIES.map(c=>c.code);
  const list = DB.nakitAvansTavanlar || [];
  grid.innerHTML = naParaBirimleri.map(code => {
    const info = ALL_CURRENCIES.find(c=>c.code===code);
    const sym = (info && info.symbol) || code;
    return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;transition:border-color .15s" onmouseover="this.style.borderColor='var(--border2)'" onmouseout="this.style.borderColor='var(--border)'">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:10px">
        <span style="font-size:17px;line-height:1">${info?info.flag:'💱'}</span>
        <span style="font-size:13px;font-weight:700;color:var(--text);letter-spacing:.02em">${code}</span>
      </div>
      <div class="money-wrap" data-symbol="${sym}" data-code="" data-own-currency="1">
        <input id="na-tavan-${code}" type="text" class="money-input na-tavan-input" data-decimals="2" placeholder="Sınırsız"
          data-cur="${code}" data-oc-handler="autoSaveNakitAvansTavan" data-oc-event="input">
      </div>
    </div>`;
  }).join('');
  bindMoneyInputs(grid);
  naParaBirimleri.forEach(code => setMoneyInput('na-tavan-' + code, (list.find(r=>r.paraBirimi===code)||{}).tavanMiktar ?? ''));
}

export function autoSaveNakitAvansTavan(el) {
  const pb = el.dataset.cur;
  const miktar = getMoneyInput(el.id);
  if(!DB.nakitAvansTavanlar) DB.nakitAvansTavanlar = [];
  const idx = DB.nakitAvansTavanlar.findIndex(r=>r.paraBirimi===pb);
  if(el.value.trim() === '' || isNaN(miktar) || miktar <= 0) {
    // Boşsa/geçersizse kaydı kaldır → tavan uygulanmaz
    if(idx>=0) DB.nakitAvansTavanlar.splice(idx,1);
  } else {
    if(idx>=0) DB.nakitAvansTavanlar[idx].tavanMiktar = miktar;
    else DB.nakitAvansTavanlar.push({ paraBirimi: pb, tavanMiktar: miktar });
  }
  saveData();
  const st = document.getElementById('nakit-avans-tavan-status');
  if(st) { st.textContent = '✓ Kaydedildi'; clearTimeout(st._t); st._t = setTimeout(()=>st.textContent='',1500); }
  updateNakitAvansLimitPreview();
}

export function renderNakitAvansLimitKural() {
  const tipSel = document.getElementById('nakit-avans-limit-tip');
  const oranInp = document.getElementById('nakit-avans-max-oran');
  if(tipSel) tipSel.value = DB.nakitAvansLimitTip || 'kullanilabilir';
  if(oranInp) oranInp.value = DB.nakitAvansMaxOran != null ? DB.nakitAvansMaxOran : 50;
  renderNakitAvansTavanlar();
  updateNakitAvansLimitPreview();
}

export function autoSaveNakitAvansLimitKural() {
  updateNakitAvansLimitPreview();
  clearTimeout(_naLimitAutoSaveTimer);
  set_naLimitAutoSaveTimer(setTimeout(() => saveNakitAvansLimitKural(true), 300));
}

// Nakit avans için faiz oranı → doğrudan KMH'den alınır

export function getNakitAvansFaizOrani(paraBirimi, tarihStr) {
  return getKmhFaizOrani(tarihStr);
}

