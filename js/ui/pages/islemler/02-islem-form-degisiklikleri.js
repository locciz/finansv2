import { fmt, fmtMoneyCustom, localDateStr, parseTutarStr } from '../../../core/format.js';
import { FORMAT_CONFIG } from '../../../core/state.js';
import { calcTaksit } from '../../../domain/hesaplamalar.js';
import { setDateInputValue, setMoneyInput } from '../../components/money-input.js';
import { _islemProvizyonManuel, set_islemProvizyonManuel } from './00-state.js';
import { getKartCurrencies, getKartDefaultCurrency } from '../kartlar/01-kart-data.js';
import { onTaksitChange } from '../krediler/01-genel-yardimcilar.js';
import { tahminProvizyonGunFarki } from '../ozet.js';
// ============================================================
// js/ui/pages/islemler/02-islem-form-degisiklikleri.js
// İşlem formu input değişiklik yakalayıcıları (tarih/kart/taksit)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/islemler.js
// (49 export, 1087 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function onIslemTarihiChange() {
  if(_islemProvizyonManuel) return; // kullanıcı elle girdiyse otomatik öngörüyle ezme
  const kartId = document.getElementById('islem-kart').value;
  const islemTarihi = document.getElementById('islem-tarih').value;
  const hint = document.getElementById('islem-provizyon-hint');
  const provInput = document.getElementById('islem-provizyon-tarihi');
  if(!kartId || !islemTarihi) { provInput.value=''; hint.style.display='none'; return; }
  const gunFarki = tahminProvizyonGunFarki(kartId);
  if(gunFarki === null) {
    // Önceki işlem yok — boş bırak
    provInput.value = '';
    hint.style.display = 'block';
    hint.textContent = 'ℹ️ Bu kart için önceki işlem bulunamadı, provizyon tarihi otomatik öngörülemedi — boş bırakıldı.';
  } else {
    const dt = new Date(islemTarihi+'T00:00:00');
    dt.setDate(dt.getDate() + gunFarki);
    provInput.value = localDateStr(dt);
    hint.style.display = 'block';
    hint.textContent = `✓ Önceki işlemlere göre öngörüldü (ortalama ${gunFarki} gün). Gerekirse değiştirebilirsiniz.`;
  }
}

export function onIslemProvizyonManuelDegisti() {
  set_islemProvizyonManuel(true);
  const hint = document.getElementById('islem-provizyon-hint');
  const val = document.getElementById('islem-provizyon-tarihi').value;
  if(val) {
    hint.style.display = 'block';
    hint.textContent = '✓ Provizyon tarihi elle ayarlandı.';
  } else {
    hint.style.display = 'block';
    hint.textContent = '⚠️ Provizyon tarihi boş — bu işlem dashboard\'da "eksik provizyon" listesinde görünecek.';
  }
}

export function onIslemKartChange() {
  const kartId = document.getElementById('islem-kart').value;
  const pb = document.getElementById('islem-para-birimi');
  if(!pb) return;
  // Kartın desteklediği birimleri filtrele
  const supported = getKartCurrencies(kartId);
  const defCur = getKartDefaultCurrency(kartId);
  // Mevcut seçim destekleniyorsa koru, değilse kartın varsayılanını seç
  if(!supported.includes(pb.value)) pb.value = defCur;
  // Desteklenmeyen seçenekleri kısmen vurgula
  Array.from(pb.options).forEach(opt => {
    if(supported.includes(opt.value)) {
      opt.style.fontWeight = '600';
      opt.text = opt.text.replace(' ●','') + (opt.value===defCur?' ⭐':'');
    } else {
      opt.style.fontWeight = '';
      opt.text = opt.text.replace(' ⭐','').replace(' ●','');
    }
  });
  if(!pb.value || !supported.includes(pb.value)) pb.value = defCur;
  if(typeof onIslemTarihiChange === 'function') onIslemTarihiChange();
}

export function islemTaksitAdim(delta) {
  const el = document.getElementById('islem-taksit');
  if(!el) return;
  const yeni = Math.max(1, Math.min(60, (parseInt(el.value)||1) + delta));
  el.value = yeni;
  calcTaksit(false);
}

export function onIslemTaksitChange(el, idx, field) {
  if(field === 'tutar') {
    const orig = parseFloat(el.dataset.orig)||0;
    const val = parseTutarStr(el.value);
    if(Math.abs(val - orig) > 0.01) el.classList.add('tp-modified');
    else el.classList.remove('tp-modified');
    // Toplam güncelle
    const container = document.getElementById('islem-taksit-alanlari');
    const inputs = container.querySelectorAll('[data-islem-taksit-field="tutar"]');
    let toplam = 0; inputs.forEach(inp => toplam += parseTutarStr(inp.value));
    const span = document.getElementById('islem-tp-toplam');
    if(span) span.textContent = fmt(toplam);
    // Toplam tutar alanını güncelle
    setMoneyInput('islem-tutar', toplam.toFixed(2));
  }
}

export function resetIslemTekTaksit(btn, idx, origTarih, origTutar) {
  const row = btn.closest('.tp-row');
  const tarihInput = row.querySelector('[data-islem-taksit-field="tarih"]');
  const tutarInput = row.querySelector('[data-islem-taksit-field="tutar"]');
  if(tarihInput) { setDateInputValue(tarihInput, origTarih); tarihInput.dispatchEvent(new Event('change', { bubbles: true })); }
  if(tutarInput) {
    tutarInput.value = fmtMoneyCustom(origTutar, 2, FORMAT_CONFIG.ondalikAyrac||',', FORMAT_CONFIG.binlikAyrac??'.');
    tutarInput.classList.remove('tp-modified');
    onIslemTaksitChange(tutarInput, idx, 'tutar');
  }
}

export function resetTekTaksit(btn, tip, idx, origTarih, origTutar) {
  const row = btn.closest('.tp-row');
  const tarihInput = row.querySelector('[data-taksit-field="tarih"]');
  const tutarInput = row.querySelector('[data-taksit-field="tutar"]');
  const donemEl = row.querySelector('.tp-donem');
  if(tarihInput) { setDateInputValue(tarihInput, origTarih); }
  if(donemEl && origTarih) {
    const d = new Date(origTarih + 'T00:00:00');
    donemEl.textContent = d.toLocaleDateString('tr-TR', {month:'short', year:'numeric'});
  }
  if(tutarInput) {
    tutarInput.value = fmtMoneyCustom(origTutar, 2, FORMAT_CONFIG.ondalikAyrac||',', FORMAT_CONFIG.binlikAyrac??'.');
    tutarInput.classList.remove('tp-modified');
    onTaksitChange(tutarInput, tip, idx, 'tutar');
  }
}

