import { saveData } from '../../core/app-core-base.js';
import { DB } from '../../core/state.js';
import { BANKA_LOGOLAR, BANK_ICON_MAP, IBAN_BANKA_MAP } from '../../domain/banka-verisi.js';
import { formatIbanView, ibanMod97, parseIban } from '../../domain/iban-utils.js';
import { renderKisilerGrid } from './kisiler.js';
import { showToast } from './modal-genel.js';
import { populateEldenKisiSelect } from '../pages/elden.js';
import { bankaLogoByKod } from '../pages/tanimlamalar/01-genel-yardimcilar.js';
import { getSubeAdFromKodlar } from '../pages/tanimlamalar/08-subeler.js';
import { _pickBankaLogo } from '../pages/tanimlamalar/07-bankalar.js';
import { closeModal, openModal } from './modal-genel.js';
// ============================================================
// js/ui/components/iban-ui.js — IBAN doğrulama/format UI'ı,
// banka logo seçici, IBAN hızlı-ekle popup'ı, IBAN chip seçici
// ============================================================

// Dört ayrı yerde birebir tekrarlanan "geçersiz IBAN" hata ikonu+metni —
// tek yerde tutulup mesaj metni parametre olarak veriliyor.
export function _ibanHataHtml(msg) {
  return '<span class="iban-status iban-err"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ' + msg + '</span>';
}

// ─── IBAN HIZLI EKLE POPUP ─────────────────────────────────────
export var _ibanPopupKisiId = null;
export function _renderBankaLogoPicker(selectedSvg) {
  const picker = document.getElementById('banka-logo-picker');
  if(!picker) return;
  picker.innerHTML = BANKA_LOGOLAR.map((logo, i) => {
    const isSelected = logo.svg === selectedSvg || (logo.id === 'none' && !selectedSvg);
    return `<div class="altyapi-logo-picker-item${isSelected ? ' selected' : ''}" data-idx="${i}"
      title="${logo.ad}">
      ${logo.svg
        ? `<span style="display:flex;align-items:center;justify-content:center;width:40px;height:24px">${logo.svg}</span>`
        : `<span style="width:40px;height:24px;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:18px">✕</span>`
      }
      <span>${logo.ad}</span>
    </div>`;
  }).join('');
  // [ES module] onclick="_pickBankaLogo(...)" kaldırıldı.
  picker.querySelectorAll('.altyapi-logo-picker-item').forEach(item => {
    item.addEventListener('click', () => _pickBankaLogo(Number(item.getAttribute('data-idx'))));
  });
}

export function _selectBankaLogo(svg) {
  document.getElementById('banka-logo').value = svg || '';
  document.querySelectorAll('#banka-logo-picker .altyapi-logo-picker-item').forEach((el, i) => {
    const logo = BANKA_LOGOLAR[i];
    const match = logo.svg === svg || (logo.id === 'none' && !svg);
    el.classList.toggle('selected', match);
  });
}

export function updateSubeAdFromIban(bankaKodu, subeKodu) {
  const ad = getSubeAdFromKodlar(bankaKodu, subeKodu);
  document.getElementById('hesap-sube-ad').value = ad;
  const disp = document.getElementById('hesap-sube-ad-display');
  if(disp) disp.textContent = ad || (subeKodu ? '(' + subeKodu + ' — bilinmiyor)' : '—');
}

export function onBankaIbanKodInput() {
  const kod = (document.getElementById('banka-iban-kod')||{}).value?.trim().padStart(4,'0') || '';
  const ikonInput = document.getElementById('banka-ikon');
  const oneriDiv = document.getElementById('banka-ikon-oneri');
  const preset = BANK_ICON_MAP[kod];
  if (preset && ikonInput && !ikonInput.value) {
    if (oneriDiv) oneriDiv.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:7px;background:rgba(45,212,191,.1);border:1px solid rgba(45,212,191,.18)">`
      + `<span style="font-size:15px;line-height:1">${preset.emoji}</span>`
      + `<span style="color:var(--teal);font-size:11px;line-height:1.3">${preset.label} için önerildi</span>`
      + `</span>`
      + `<div style="font-size:10px;color:var(--text3);margin-top:4px">Değiştirmek için soldaki kutuya yazın</div>`;
  } else if (oneriDiv) {
    oneriDiv.textContent = preset ? '' : (kod.length === 4 ? 'Bu IBAN kodu için ön tanımlı ikon yok' : 'IBAN kodu girince otomatik önerilir');
  }
  // Kullanıcı henüz manuel bir logo seçmediyse, tanınan IBAN koduna göre
  // logo rozetini otomatik öner/seç.
  const logoInput = document.getElementById('banka-logo');
  const presetLogo = bankaLogoByKod(kod);
  if (logoInput && presetLogo && !logoInput.value) {
    _selectBankaLogo(presetLogo);
  }
}

export function _ibanPopupAc(kisiId) {
  _ibanPopupKisiId = kisiId;
  const kisi = (DB.kisiler||[]).find(k=>k.id===kisiId);
  if(!kisi) return;

  // Başlığı ayarla
  document.getElementById('iban-popup-kisi-label').textContent = kisi.ad + ' için IBAN bilgisi ekleyin';

  // Inputları temizle
  const ibanInp = document.getElementById('iban-popup-iban');
  const etiketInp = document.getElementById('iban-popup-etiket');
  const statusEl = document.getElementById('iban-popup-status');
  ibanInp.value = '';
  etiketInp.value = '';
  statusEl.innerHTML = '';
  ibanInp.style.borderColor = '';

  // Validasyonu bağla (zaten bağlıysa tekrar bağlamaz)
  attachIbanValidation(ibanInp, { statusEl });

  // Tamam butonunu güncelle
  _ibanPopupListeGuncelle();

  openModal('modal-iban-popup');
  setTimeout(() => ibanInp.focus(), 120);
}

export function _ibanPopupListeGuncelle() {
  const kisi = (DB.kisiler||[]).find(k=>k.id===_ibanPopupKisiId);
  const ibanlar = kisi ? (kisi.ibanlar||[]) : [];
  const listEl = document.getElementById('iban-popup-list');
  const tamamBtn = document.getElementById('iban-popup-tamam-btn');

  if(!ibanlar.length) {
    listEl.innerHTML = '<div style="font-size:11.5px;color:var(--text3);margin-bottom:4px">Henüz IBAN eklenmedi.</div>';
    tamamBtn.textContent = 'Atla';
    tamamBtn.className = 'btn btn-ghost';
    return;
  }

  tamamBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px"><polyline points="20 6 9 17 4 12"/></svg>Tamam (${ibanlar.length} IBAN)`;
  tamamBtn.className = 'btn btn-primary';

  listEl.innerHTML = ibanlar.map((ib, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;margin-bottom:6px">
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--mono);font-size:12px;color:var(--accent2);letter-spacing:.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ib.iban.replace(/(.{4})/g,'$1 ').trim()}</div>
        ${ib.etiket?`<div style="font-size:10px;color:var(--text3);margin-top:1px">${ib.etiket}</div>`:''}
      </div>
      <button class="btn btn-ghost btn-sm iban-popup-kopyala-btn" style="padding:3px 7px;flex-shrink:0"
        data-iban="${ib.iban}" title="Kopyala">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
      <button class="btn btn-danger btn-sm iban-popup-sil-btn" style="padding:3px 7px;flex-shrink:0" data-idx="${i}" title="Sil">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`).join('');
  // [ES module] onclick="navigator.clipboard.writeText(...)" ve onclick="_ibanPopupSil(...)" kaldırıldı.
  listEl.querySelectorAll('.iban-popup-kopyala-btn').forEach(btn => {
    btn.addEventListener('click', () => navigator.clipboard.writeText(btn.getAttribute('data-iban')).then(() => showToast('Kopyalandı ✓')));
  });
  listEl.querySelectorAll('.iban-popup-sil-btn').forEach(btn => {
    btn.addEventListener('click', () => _ibanPopupSil(Number(btn.getAttribute('data-idx'))));
  });
}

export function _ibanPopupEkle() {
  const ibanInp = document.getElementById('iban-popup-iban');
  const etiketInp = document.getElementById('iban-popup-etiket');
  const statusEl = document.getElementById('iban-popup-status');
  const raw = (ibanInp.dataset.rawIban || ibanInp.value.replace(/\s+/g,'')).toUpperCase();

  if(!raw) { ibanInp.focus(); return; }

  // Mod-97 kontrolü
  if(!/^TR\d{24}$/.test(raw) || !ibanMod97(raw)) {
    statusEl.innerHTML = _ibanHataHtml('Geçersiz IBAN — lütfen kontrol edin');
    ibanInp.style.borderColor = 'var(--rose)';
    ibanInp.focus();
    return;
  }

  const kisi = (DB.kisiler||[]).find(k=>k.id===_ibanPopupKisiId);
  if(!kisi) return;
  if(!kisi.ibanlar) kisi.ibanlar = [];

  // Duplikat kontrolü
  if(kisi.ibanlar.find(x=>x.iban===raw)) {
    statusEl.innerHTML = '<span class="iban-status iban-err">Bu IBAN zaten ekli</span>';
    return;
  }

  const etiket = etiketInp.value.trim();
  kisi.ibanlar.push({ iban: raw, etiket });
  saveData();
  renderKisilerGrid();
  populateEldenKisiSelect();

  // Inputları temizle
  ibanInp.value = '';
  etiketInp.value = '';
  statusEl.innerHTML = '';
  ibanInp.style.borderColor = '';
  delete ibanInp.dataset.rawIban;

  _ibanPopupListeGuncelle();
  ibanInp.focus();

  showToast('IBAN eklendi ✓');
}

export function _ibanPopupSil(idx) {
  const kisi = (DB.kisiler||[]).find(k=>k.id===_ibanPopupKisiId);
  if(!kisi || !kisi.ibanlar) return;
  kisi.ibanlar.splice(idx, 1);
  saveData();
  renderKisilerGrid();
  _ibanPopupListeGuncelle();
}

export function _ibanPopupKapat(atla) {
  closeModal('modal-iban-popup');
  const kisi = (DB.kisiler||[]).find(k=>k.id===_ibanPopupKisiId);
  const adet = kisi ? (kisi.ibanlar||[]).length : 0;
  if(atla && adet === 0) {
    showToast('Kişi eklendi ✓');
  } else if(adet > 0) {
    showToast(`Kişi eklendi · ${adet} IBAN kaydedildi ✓`);
  } else {
    showToast('Kişi eklendi ✓');
  }
  _ibanPopupKisiId = null;
}

export function renderIbanPicker(kisiId, pickerWrapId, chipsId, ibanInputId) {
  const pickerWrap = document.getElementById(pickerWrapId);
  const chipsEl    = document.getElementById(chipsId);
  if (!pickerWrap || !chipsEl) return;

  if (!kisiId) { pickerWrap.style.display = 'none'; return; }

  const kisi = (DB.kisiler||[]).find(k=>k.id===kisiId);
  if (!kisi || !kisi.ibanlar || !kisi.ibanlar.length) {
    pickerWrap.style.display = 'none';
    return;
  }

  const currentIban = (document.getElementById(ibanInputId)||{}).value
    ? document.getElementById(ibanInputId).value.replace(/\s+/g,'').toUpperCase() : '';

  pickerWrap.style.display = '';
  chipsEl.innerHTML = kisi.ibanlar.map((ib) => {
    const raw = ib.iban ? ib.iban.replace(/\s+/g,'').toUpperCase() : (typeof ib === 'string' ? ib.replace(/\s+/g,'').toUpperCase() : '');
    const fmt = raw.replace(/(.{4})/g,'$1 ').trim();
    const isActive = currentIban === raw;
    const etiket = ib.etiket || '';
    return `<div class="iban-chip${isActive?' active':''}" data-raw="${raw}">
      <div class="iban-chip-dot"></div>
      <span class="iban-chip-val">${fmt}</span>
      ${etiket ? `<span class="iban-chip-lbl">${etiket}</span>` : ''}
    </div>`;
  }).join('');
  // [ES module] onclick="selectIbanChip(...)" kaldırıldı.
  chipsEl.querySelectorAll('.iban-chip').forEach(chip => {
    chip.addEventListener('click', () => selectIbanChip(ibanInputId, chip.getAttribute('data-raw'), pickerWrapId, chipsId, kisiId));
  });

  // Tek IBAN varsa otomatik seç
  if (kisi.ibanlar.length === 1 && !currentIban) {
    const raw = kisi.ibanlar[0].iban
      ? kisi.ibanlar[0].iban.replace(/\s+/g,'').toUpperCase()
      : (typeof kisi.ibanlar[0] === 'string' ? kisi.ibanlar[0].replace(/\s+/g,'').toUpperCase() : '');
    const inp = document.getElementById(ibanInputId);
    if (inp && raw) { inp.value = raw; formatIbanView(inp); }
    renderIbanPicker(kisiId, pickerWrapId, chipsId, ibanInputId);
    return;
  }
}

export function selectIbanChip(ibanInputId, rawIban, pickerWrapId, chipsId, kisiId) {
  const inp = document.getElementById(ibanInputId);
  if (!inp) return;
  inp.value = rawIban;
  formatIbanView(inp);
  renderIbanPicker(kisiId, pickerWrapId, chipsId, ibanInputId);
}

// "IBAN'ı panoya kopyala, olmazsa eski tarayıcı fallback'i kullan, sonra
// toast göster" mantığı — kira.js, elden.js (2 yer) ve maas.js'te birebir
// aynı şekilde (md5 ile doğrulandı) kopyalanmıştı. `raw` değerini elde etme
// ve boş/geçersiz kontrolü her çağıran yerde farklı olduğu için (bazıları
// sessizce çıkıyor, biri hata toast'ı gösteriyor) o kısımlara dokunulmadı —
// sadece ortak kopyalama adımı buraya taşındı.
export function _ibanKopyalaVeToastGoster(raw) {
  navigator.clipboard.writeText(raw).then(() => showToast('IBAN kopyalandı ✓')).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = raw; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    showToast('IBAN kopyalandı ✓');
  });
}

export function copyFieldIban(fieldId) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  const raw = (el.dataset.rawIban || el.value).replace(/\s+/g,'').toUpperCase();
  if (!raw) { showToast('Kopyalanacak IBAN yok'); return; }
  _ibanKopyalaVeToastGoster(raw);
}

// handleIbanInput ve onIbanInput ikisi de aynı "boşluksuz ham değeri 4'erli
// gruplara böl, imleç konumunu koru" mantığını ayrı ayrı yazıyordu. Tek yerde.
// inputEl'in değerini formatlar ve imleci uygun konuma taşır; ham (boşluksuz)
// değeri döndürür.
export function _ibanFormatlaVeImleciKoru(inputEl, maxLen) {
  const before = inputEl.value;
  const cursor = inputEl.selectionStart;
  const raw = before.replace(/\s+/g, '').toUpperCase().slice(0, maxLen || 26);
  const formatted = raw.match(/.{1,4}/g)?.join(' ') || raw;
  if (formatted !== before) {
    const rawBefore = before.slice(0, cursor).replace(/\s+/g, '').length;
    inputEl.value = formatted;
    let newPos = 0, count = 0;
    for (let i = 0; i < formatted.length && count < rawBefore; i++) {
      if (formatted[i] !== ' ') count++;
      newPos = i + 1;
    }
    inputEl.setSelectionRange(newPos, newPos);
  }
  return raw;
}

export function handleIbanInput(inputEl, statusEl, opts) {
  opts = opts || {};
  const raw = _ibanFormatlaVeImleciKoru(inputEl, 26);
  inputEl.dataset.rawIban = raw;

  if (!statusEl) return null;

  if (!raw) {
    statusEl.innerHTML = '';
    inputEl.style.borderColor = '';
    return null;
  }

  // Henüz tamamlanmamış — TR ile başlamıyorsa hemen hata
  if (raw.length < 26) {
    if (raw.length >= 2 && !raw.startsWith('TR')) {
      statusEl.innerHTML = _ibanHataHtml('TR ile başlamalıdır');
      inputEl.style.borderColor = 'var(--rose)';
    } else if (raw.length >= 4 && !/^TR\d+$/.test(raw)) {
      statusEl.innerHTML = _ibanHataHtml('TR\'den sonra yalnızca rakam giriniz');
      inputEl.style.borderColor = 'var(--rose)';
    } else {
      statusEl.innerHTML = `<span class="iban-status iban-muted">${raw.length} / 26 hane</span>`;
      inputEl.style.borderColor = '';
    }
    return null;
  }

  // 26 hane — mod-97 kontrol
  const parsed = parseIban(raw);
  if (!parsed) {
    statusEl.innerHTML = _ibanHataHtml('Geçersiz IBAN — kontrol haneleri uyuşmuyor');
    inputEl.style.borderColor = 'var(--rose)';
    return null;
  }

  // Geçerli — banka adını göster
  inputEl.style.borderColor = 'var(--teal)';
  const dbBank = (DB?.bankalar || []).find(b => b.ibanKod === parsed.bankaKodu || b.kod === parsed.bankaKodu);
  const mapBank = (typeof IBAN_BANKA_MAP !== 'undefined') ? IBAN_BANKA_MAP[parsed.bankaKodu] : null;
  const bankLabel = dbBank ? dbBank.kisa : (mapBank || ('Kod: ' + parsed.bankaKodu));
  statusEl.innerHTML = `<span class="iban-status iban-ok"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Geçerli &nbsp;·&nbsp; <b>${bankLabel}</b></span>`;

  if (opts.onValid) opts.onValid(parsed, dbBank);
  return parsed;
}

export function ensureIbanStatus(inputEl) {
  const existingId = inputEl.dataset.ibanStatusId;
  if (existingId) {
    const el = document.getElementById(existingId);
    if (el) return el;
  }
  const statusEl = document.createElement('div');
  const uid = 'iban-st-' + Math.random().toString(36).slice(2, 8);
  statusEl.id = uid;
  statusEl.className = 'iban-status-wrap';
  inputEl.dataset.ibanStatusId = uid;
  inputEl.parentNode.insertBefore(statusEl, inputEl.nextSibling);
  return statusEl;
}

export function attachAllIbanValidations() {
  // ID bazlı inputlar: mevcut statusEl veya otomatik yaratılır
  const targets = [
    // id                         statusElId (varsa)
    ['kisi-yeni-iban',            null],
    ['kira-karsi-iban',           null],
    ['kira-karsi-iban-manuel',    null],
    ['maas-karsi-iban',           null],
    ['maas-karsi-iban-manuel',    null],
    ['elden-karsi-iban',          null],
    ['elden-karsi-iban-manuel',   null],
    ['hesap-iban',                'hesap-iban-status'],
  ];

  targets.forEach(([id, statusId]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const statusEl = statusId ? document.getElementById(statusId) : null;

    // hesap-iban'ın kendi onIbanInput handler'ı var
    // Sadece mod-97 doğrulamasını ekle, mevcut handler'ı bozmadan
    if (id === 'hesap-iban') {
      if (el.dataset.ibanMod97) return;
      el.dataset.ibanMod97 = '1';
      const origOninput = el.oninput;
      el.addEventListener('input', function() {
        const raw = this.value.replace(/\s+/g, '').toUpperCase();
        const sEl = statusEl || ensureIbanStatus(this);
        if (raw.length === 26 && !/^TR\d{24}$/.test(raw)) {
          sEl.innerHTML = _ibanHataHtml('Geçersiz IBAN');
        } else if (raw.length === 26 && !ibanMod97(raw)) {
          sEl.innerHTML = _ibanHataHtml('Geçersiz IBAN — kontrol haneleri uyuşmuyor');
          this.style.borderColor = 'var(--rose)';
        } else if (raw.length === 26) {
          this.style.borderColor = 'var(--teal)';
        } else {
          this.style.borderColor = '';
        }
      });
      return;
    }

    attachIbanValidation(el, { statusEl });
  });

  // mkp-iban-input sınıflı dinamik inputlar
  document.querySelectorAll('.mkp-iban-input').forEach(el => {
    attachIbanValidation(el);
  });
}

export function onIbanInput() {
  const inp = document.getElementById('hesap-iban');
  const raw = _ibanFormatlaVeImleciKoru(inp, 26);
  const parsed = parseIban(raw);
  const statusEl = document.getElementById('hesap-iban-status');
  const parsedRow = document.getElementById('hesap-parsed-row');

  if(!raw.replace(/\s+/g,'')) {
    statusEl.textContent=''; parsedRow.style.display='none'; return;
  }
  if(!parsed) {
    statusEl.innerHTML='<span style="color:var(--danger)">⚠ Geçersiz IBAN — TR ile başlayan 26 haneli rakam giriniz</span>';
    parsedRow.style.display='none'; return;
  }

  // IBAN maskeleme yapılmıyor — girilen değer olduğu gibi bırakılır

  document.getElementById('hesap-banka-kodu').value = parsed.bankaKodu;
  document.getElementById('hesap-sube-kodu').value = parsed.subeKodu;
  document.getElementById('hesap-no').value = parsed.hesapNo;
  parsedRow.style.display='';
  // Şube adını IBAN kodundan otomatik bul
  updateSubeAdFromIban(parsed.bankaKodu, parsed.subeKodu);

  // Banka eşleştir: önce DB.bankalar'da ibanKod'a göre direkt eşleş
  const bankaAd = IBAN_BANKA_MAP[parsed.bankaKodu];
  const sel = document.getElementById('hesap-banka');
  const ibanLogoSvg = bankaLogoByKod(parsed.bankaKodu);
  const ibanLogoHtml = ibanLogoSvg ? `<span class="bank-logo bank-logo-sm" style="vertical-align:-3px;margin-right:5px">${ibanLogoSvg}</span>` : '';
  // 1. DB'deki banka ibanKod'u ile doğrudan eşleştir
  const dbMatch = (DB.bankalar||[]).find(b => b.ibanKod === parsed.bankaKodu);
  if(dbMatch) {
    sel.value = dbMatch.id;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    statusEl.innerHTML=`<span style="color:var(--accent2)">✓ Geçerli IBAN &nbsp;|&nbsp; Banka: ${ibanLogoHtml}<b>${dbMatch.kisa}</b> (kod: ${parsed.bankaKodu})</span>`;
  } else if(bankaAd) {
    // 2. IBAN_BANKA_MAP'te varsa isim benzerliğiyle dene
    const opts = [...sel.options];
    const firstWord = bankaAd.split(' ')[0].toLowerCase();
    const nameMatch = opts.find(o => o.text.toLowerCase().includes(firstWord));
    if(nameMatch) { sel.value = nameMatch.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    statusEl.innerHTML=`<span style="color:var(--accent2)">✓ Geçerli IBAN &nbsp;|&nbsp; Banka: ${ibanLogoHtml}<b>${bankaAd}</b> (kod: ${parsed.bankaKodu}${dbMatch?'':' — banka listenizdeki ibanKod ile eşleşmedi'})</span>`;
  } else {
    statusEl.innerHTML=`<span style="color:var(--accent2)">✓ Geçerli IBAN &nbsp;|&nbsp; Banka kodu: <b>${parsed.bankaKodu}</b> — lütfen bankayı manuel seçin</span>`;
  }
}


/**
 * Belirtilen input'a IBAN doğrulamasını bağlar (tek seferlik).
 * opts.statusEl: mevcut status elementi (yoksa otomatik oluşturulur)
 * opts.onValid: geçerli IBAN'da çağrılır (parsed, dbBank)
 */
export function attachIbanValidation(inputEl, opts) {
  if (!inputEl || inputEl.dataset.ibanValidated) return;
  inputEl.dataset.ibanValidated = '1';
  opts = opts || {};

  const getStatus = () => opts.statusEl || ensureIbanStatus(inputEl);

  inputEl.addEventListener('input', () => {
    // Sadece büyük harf + boşluksuz
    const v = inputEl.value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (v !== inputEl.value.replace(/\s+/g, '').toUpperCase()) {
      inputEl.value = v; // harf dışı karakter girildiyse temizle
    }
    handleIbanInput(inputEl, getStatus(), opts);
  });

  inputEl.addEventListener('blur', () => {
    const raw = (inputEl.dataset.rawIban || inputEl.value.replace(/\s+/g, '')).toUpperCase();
    if (raw.length > 0) {
      inputEl.value = raw.replace(/(.{4})/g, '$1 ').trim();
      inputEl.dataset.rawIban = raw;
    }
  });

  inputEl.addEventListener('focus', () => {
    const raw = (inputEl.dataset.rawIban || inputEl.value.replace(/\s+/g, '')).toUpperCase();
    inputEl.value = raw;
    inputEl.dataset.rawIban = raw;
  });
}

// Tüm IBAN inputlarına canlı doğrulama bağla (DOM hazır olunca)
document.addEventListener('DOMContentLoaded', () => setTimeout(attachAllIbanValidations, 300));


