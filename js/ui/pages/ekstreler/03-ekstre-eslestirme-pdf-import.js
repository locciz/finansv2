import { saveData } from '@core/app-core-base.js';
import { fmtCur, fmtDate } from '@core/format.js';
import { DB, defaultCurrency } from '@core/state.js';
import { getExtreDonemi, getIslemTaksitliste } from '@domain/hesaplamalar.js';
import { _sidebarDim, showConfirm, showToast } from '@components/modal-genel.js';
import { applyToAll } from '@components/mobile-nav-tema/05-tarih-input-overlay.js';
import { bindMoneyInputs, setDateInputValue, setMoneyInput } from '@components/money-input.js';
import { isEkstreKesinlesmis } from '@pages/ekstreler/01-ekstre-kesinlestirme.js';
import { EE_STATE, setEE_STATE } from '@pages/ekstreler/02-ekstre-render.js';
import { onIslemKartChange, onIslemTarihiChange } from '@pages/islemler/02-islem-form-degisiklikleri.js';
import { renderIslemler } from '@pages/islemler/03-islem-liste-render.js';
import { renderIslemKategoriButon } from '@pages/islemler/06-islem-kategori-secici.js';
import { editIslem, populateIslemModal } from '@pages/islemler/07-islem-modal-crud.js';
import { getKart, getKartCurrency } from '@pages/kartlar/01-kart-data.js';
import { getKategoriOpts } from '@pages/tanimlamalar/03-kategoriler.js';
import { _eeOnSaveHook, set_eeOnSaveHook } from '@pages/islemler/00-state.js';
// ============================================================
// js/ui/pages/ekstreler/03-ekstre-eslestirme-pdf-import.js
// PDF ekstre içe aktarma ve otomatik eşleştirme (OCR/parse)
// Kod SATIR SATIR aynı kaldı; sadece dosya sınırı/gruplama değişti.
// ============================================================
export function renderEkstreEslestir() {
  const sel = document.getElementById('ee-kart-select');
  if (!sel) return;
  const kartlar = DB.kartlar || [];

  // Dropdown'u güncelle ama seçili değeri koru.
  // Öncelik sırası: (1) onaylanmış kartId, (2) kullanıcının seçtiği ama henüz onaylamadığı
  // _pendingKartId, (3) DOM'dan okunan anlık değer (Drive sync öncesi son durum).
  // ÖNEMLI: sel.value innerHTML sıfırlanmadan ÖNCE okunmalı.
  const prevDomValue = sel.value;
  const restoreId = EE_STATE.kartId || EE_STATE._pendingKartId || prevDomValue || null;

  sel.innerHTML = '<option value="" disabled hidden>— Kart seçin —</option>' +
    kartlar.map(k => {
      const banka = ((DB.bankalar || []).find(b => b.id === k.banka) || {}).kisa || '';
      return `<option value="${k.id}">${k.ad}${banka ? ' — ' + banka : ''}${k.no ? ' (•••• ' + k.no + ')' : ''}</option>`;
    }).join('');

  // Seçimi geri yükle: value set ettikten sonra DOM gerçekten güncellendiğini kontrol et.
  // ÖNEMLİ: placeholder "disabled hidden" olduğu için tarayıcı innerHTML atamasından hemen
  // sonra otomatik olarak ilk gerçek kartı seçili hale getirir (native <select> davranışı).
  // Bu yüzden restoreId yokken de value'yu açıkça '' yaparak o otomatik seçimi eziyoruz.
  if (restoreId) {
    sel.value = restoreId;
    // display:none container içinde set çalışmayabilir — en az bir option eşleşiyorsa zorla
    if (!sel.value && restoreId) {
      const opt = sel.querySelector(`option[value="${CSS.escape(restoreId)}"]`);
      if (opt) opt.selected = true;
    }
    // _pendingKartId'yi güncel tut
    if (!EE_STATE.kartId) EE_STATE._pendingKartId = sel.value || restoreId;
  } else {
    sel.value = '';
  }

  // Her değişimde _pendingKartId'yi anında kaydet (Drive sync'ten önce seçim korunur)
  if (!sel._eePendingBound) {
    sel._eePendingBound = true;
    sel.addEventListener('change', () => {
      EE_STATE._pendingKartId = sel.value || null;
    });
  }

  // Upload adımını her zaman göster
  document.getElementById('ee-step-upload').style.display = 'flex';

  // Drive sync veya başka bir renderAll tetiklemesi sırasında kullanıcının
  // mevcut adımı kaybolmamalı — EE_STATE flag'lerine göre UI'yi koru.
  if (!EE_STATE.pdfIslemler.length && !EE_STATE.kartOnayGosteriliyor) {
    // Hiç dosya yüklenmemiş, başlangıç durumu
    document.getElementById('ee-step-results').style.display = 'none';
    document.getElementById('ee-kart-confirm').style.display = 'none';
    document.getElementById('ee-kart-confirm-detected').style.display = 'none';
    document.getElementById('ee-kart-confirm-picker').style.display = 'none';
  } else {
    // Dosya yüklendi veya kart onay adımı açık — mevcut görünürlüğü tam olarak restore et
    if (EE_STATE.kartOnayGosteriliyor) {
      document.getElementById('ee-kart-confirm').style.display = 'block';
      // Alt panel: otomatik tespit mi, manuel seçici mi açık?
      document.getElementById('ee-kart-confirm-detected').style.display =
        EE_STATE.kartAutoDetectGosteriliyor ? 'flex' : 'none';
      document.getElementById('ee-kart-confirm-picker').style.display =
        EE_STATE.kartPickerGosteriliyor ? 'block' : 'none';
    }
    if (EE_STATE.sonuclarGosteriliyor) {
      document.getElementById('ee-step-results').style.display = 'block';
    }
  }

  // Drag & drop bağla (her render'da tekrar bağlamayı önlemek için flag)
  const dz = document.getElementById('ee-dropzone');
  if (dz && !dz._eeBound) {
    dz._eeBound = true;
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => {
      e.preventDefault();
      dz.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        eeProcessFiles(Array.from(e.dataTransfer.files));
      }
    });
  }
}

export function eeHandlePdfFile(evt) {
  const files = evt.target.files && Array.from(evt.target.files);
  if (files && files.length) eeProcessFiles(files);
}

export function eeSetStatus(msg, isError) {
  const el = document.getElementById('ee-upload-status');
  el.style.display = 'flex';
  el.style.color = isError ? 'var(--rose)' : 'var(--text2)';
  el.innerHTML = msg;
}

export let _eePendingParsed = null; // kart onaylanana kadar bekleyen parse sonucu
export let _eeTesseractLoading = null;
export let _eePdfJsLoading = null;

export function eeLoadTesseract() {
  if (typeof Tesseract !== 'undefined') return Promise.resolve();
  if (_eeTesseractLoading) return _eeTesseractLoading;
  _eeTesseractLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.4/tesseract.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Tesseract.js yüklenemedi'));
    document.head.appendChild(s);
  });
  return _eeTesseractLoading;
}

// pdfjsLib sayfada script tag olarak hiç include edilmemiş — worker src'i
// set eden kod pdfjsLib'in zaten yüklü olduğunu varsayıyordu, bu yüzden
// PDF okuma her zaman "PDF okuma kütüphanesi yüklenemedi" hatası veriyordu.
// Tesseract'taki gibi lazy-load ile CDN'den kütüphanenin kendisini çekiyoruz.

export function eeLoadPdfJs() {
  if (typeof pdfjsLib !== 'undefined') return Promise.resolve();
  if (_eePdfJsLoading) return _eePdfJsLoading;
  _eePdfJsLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('PDF.js yüklenemedi'));
    document.head.appendChild(s);
  });
  return _eePdfJsLoading;
}

// ── Tek dosyadan ham metni çıkar (PDF: pdf.js, Görüntü: Tesseract OCR) ──

export async function eeExtractTextFromFile(file, onProgress) {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImage = file.type.startsWith('image/');
  if (!isPdf && !isImage) {
    throw new Error('Desteklenmeyen dosya türü — PDF veya resim olmalı.');
  }

  let fullText = '';
  if (isPdf) {
    onProgress && onProgress('PDF okuma kütüphanesi yükleniyor…');
    try {
      await eeLoadPdfJs();
    } catch (e) {
      throw new Error('PDF okuma kütüphanesi yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin.');
    }
    onProgress && onProgress('PDF okunuyor…');
    const buf = await file.arrayBuffer();
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF okuma kütüphanesi yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin.');
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      // Satırları y-koordinatına göre grupla (aynı satırdaki parçaları birleştir)
      const lines = {};
      content.items.forEach(it => {
        const y = Math.round(it.transform[5]);
        if (!lines[y]) lines[y] = [];
        lines[y].push({ x: it.transform[4], str: it.str });
      });
      const ys = Object.keys(lines).map(Number).sort((a, b) => b - a);
      ys.forEach(y => {
        const rowText = lines[y].sort((a, b) => a.x - b.x).map(o => o.str).join(' ');
        fullText += rowText + '\n';
      });
    }
  } else {
    // Ekran görüntüsü → OCR
    onProgress && onProgress('OCR motoru yükleniyor…');
    try {
      await eeLoadTesseract();
    } catch (e) {
      throw new Error('OCR kütüphanesi yüklenemedi. İnternet bağlantınızı kontrol edin.');
    }
    onProgress && onProgress('Ekran görüntüsü okunuyor (OCR)… bu biraz sürebilir');
    const { data } = await Tesseract.recognize(file, 'tur+eng', {
      logger: m => {
        if (m.status === 'recognizing text' && m.progress != null) {
          onProgress && onProgress(`Ekran görüntüsü okunuyor… %${Math.round(m.progress * 100)}`);
        }
      }
    });
    fullText = data.text || '';
  }
  return { text: fullText, isImage };
}

// ── Çoklu dosyayı sırayla işle, tüm metinleri ve ayrıştırılan işlemleri birleştir ──

export async function eeProcessFiles(files) {
  if (!files || !files.length) return;
  document.getElementById('ee-kart-confirm').style.display = 'none';
  EE_STATE.kartOnayGosteriliyor = false;
  EE_STATE.sonuclarGosteriliyor = false;
  EE_STATE.dosyalar = Array.from(files).map(f => ({ ad: f.name, durum: 'bekliyor', sayi: 0, hata: null }));
  eeRenderFileList();

  let combinedText = '';
  let combinedParsed = [];
  let anyImage = false;
  let okSayisi = 0;

  for (let idx = 0; idx < files.length; idx++) {
    const file = files[idx];
    EE_STATE.dosyalar[idx].durum = 'isleniyor';
    eeRenderFileList();
    eeSetStatus(`⏳ (${idx + 1}/${files.length}) ${file.name} işleniyor…`, false);
    try {
      const { text, isImage } = await eeExtractTextFromFile(file, (msg) => {
        eeSetStatus(`⏳ (${idx + 1}/${files.length}) ${file.name} — ${msg}`, false);
      });
      if (isImage) anyImage = true;
      const parsedFromFile = eeParsePdfText(text).map(p => ({ ...p, _kaynak: file.name }));
      combinedText += text + '\n';
      combinedParsed = combinedParsed.concat(parsedFromFile);
      EE_STATE.dosyalar[idx].durum = parsedFromFile.length ? 'ok' : 'bos';
      EE_STATE.dosyalar[idx].sayi = parsedFromFile.length;
      if (parsedFromFile.length) okSayisi++;
    } catch (err) {
      console.error(err);
      EE_STATE.dosyalar[idx].durum = 'hata';
      EE_STATE.dosyalar[idx].hata = err.message || String(err);
    }
    eeRenderFileList();
  }

  // Aynı tarih+tutar+kaynak ile tam birebir tekrar eden satırları (ör. aynı dosya iki kez seçilmişse) tekille
  const seen = new Set();
  combinedParsed = combinedParsed.filter(p => {
    const k = p.tarih + '_' + p.tutar.toFixed(2) + '_' + p.aciklama + '_' + p._kaynak;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (!combinedParsed.length) {
    const hataliVarMi = EE_STATE.dosyalar.some(d => d.durum === 'hata');
    eeSetStatus(anyImage
      ? '⚠️ Hiçbir görüntüde tarih + tutar formatında işlem satırı bulunamadı. Daha net/yüksek çözünürlüklü bir ekran görüntüsü deneyin.'
      : '⚠️ Hiçbir dosyada tarih + tutar formatında işlem satırı bulunamadı. Farklı bir ekstre formatı olabilir.', true);
    return;
  }

  eeSetStatus('⏳ Kart tespit ediliyor…', false);
  const detected = eeDetectKart(combinedText);
  _eePendingParsed = combinedParsed;

  const dosyaSayisiMetni = files.length > 1 ? ` (${files.length} dosyadan, ${okSayisi} tanesi okunabildi)` : '';

  if (detected) {
    EE_STATE.kartId = detected.id;
    EE_STATE._pendingKartId = null; // onaylandı, pending'e gerek kalmadı
    const banka = ((DB.bankalar || []).find(b => b.id === detected.banka) || {}).kisa || '';
    document.getElementById('ee-kart-confirm').style.display = 'block';
    document.getElementById('ee-kart-confirm-detected').style.display = 'flex';
    document.getElementById('ee-kart-confirm-picker').style.display = 'none';
    document.getElementById('ee-kart-confirm-name').textContent = detected.ad + (banka ? ' — ' + banka : '') + (detected.no ? ' (•••• ' + detected.no + ')' : '');
    EE_STATE.kartOnayGosteriliyor = true;
    EE_STATE.kartAutoDetectGosteriliyor = true;
    EE_STATE.kartPickerGosteriliyor = false;
    eeSetStatus(`✅ ${combinedParsed.length} işlem satırı bulundu${dosyaSayisiMetni}.`, false);
    EE_STATE.pdfIslemler = combinedParsed;
    eeRunMatch();
  } else {
    eeSetStatus(`✅ ${combinedParsed.length} işlem satırı bulundu${dosyaSayisiMetni}, ancak kart otomatik tespit edilemedi.`, false);
    eeShowKartPicker();
  }
}

// Yüklenen dosyaların durumunu küçük bir liste olarak göster

export function eeRenderFileList() {
  const el = document.getElementById('ee-file-list');
  if (!el) return;
  if (!EE_STATE.dosyalar.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'flex';
  const ikon = { bekliyor: '⏳', isleniyor: '🔄', ok: '✅', bos: '⚠️', hata: '❌' };
  el.innerHTML = EE_STATE.dosyalar.map(d => {
    let detay = '';
    if (d.durum === 'ok') detay = `<span style="color:var(--teal)">${d.sayi} işlem</span>`;
    else if (d.durum === 'bos') detay = `<span style="color:var(--warn)">işlem bulunamadı</span>`;
    else if (d.durum === 'hata') detay = `<span style="color:var(--rose)">${d.hata || 'hata'}</span>`;
    else if (d.durum === 'isleniyor') detay = `<span style="color:var(--text3)">işleniyor…</span>`;
    else detay = `<span style="color:var(--text3)">bekliyor…</span>`;
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;font-size:11.5px">
      <span>${ikon[d.durum] || '•'}</span>
      <span style="flex:1;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.ad}</span>
      ${detay}
    </div>`;
  }).join('');
}


// ── Kart tespiti: PDF metninde son-4-hane ve/veya banka adı ara ──

export function eeDetectKart(text) {
  const kartlar = DB.kartlar || [];
  if (!kartlar.length) return null;

  // 1) Maskeli kart numarası kalıplarından son 4 haneyi çek
  //    Örn: **** **** **** 1234 / 1234 56** **** 7890 / XXXX XXXX XXXX 1234 / 1234-XXXX-XXXX-5678
  const maskRe = /(?:[*Xx•]{2,4}[\s\-]*){2,3}(\d{4})\b|\b\d{4}[\s\-]+\d{2}[*Xx•]{2}[\s\-]+[*Xx•]{4}[\s\-]+(\d{4})\b/g;
  const foundLast4 = new Set();
  let m;
  while ((m = maskRe.exec(text)) !== null) {
    const v = m[1] || m[2];
    if (v) foundLast4.add(v);
  }
  // Ayrıca "kart no" / "kart numarası" geçen satırlardaki son 4 haneyi de dene
  text.split('\n').forEach(line => {
    if (/kart\s*no|kart\s*numaras/i.test(line)) {
      const nums = line.match(/\d{4}/g);
      if (nums && nums.length) foundLast4.add(nums[nums.length - 1]);
    }
  });

  // 2) Banka adı geçiyor mu?
  const lowerText = text.toLowerCase();
  const matchedBankaIds = new Set();
  (DB.bankalar || []).forEach(b => {
    const names = [b.tam, b.kisa].filter(Boolean).map(s => s.toLowerCase());
    if (names.some(n => n.length >= 3 && lowerText.includes(n))) matchedBankaIds.add(b.id);
  });

  // 3) Skorla: son4 + banka eşleşeni en yüksek puan
  let best = null, bestScore = 0;
  kartlar.forEach(k => {
    if (!k.no) return;
    if (!foundLast4.has(k.no)) return;
    let score = 1;
    if (matchedBankaIds.has(k.banka)) score += 2;
    if (score > bestScore) { bestScore = score; best = k; }
  });
  if (best) return best;

  // Son 4 hane bulunamadıysa ama tek bir banka eşleşmesi + tek kart varsa onu öner
  if (matchedBankaIds.size === 1) {
    const bankaId = [...matchedBankaIds][0];
    const adaylar = kartlar.filter(k => k.banka === bankaId);
    if (adaylar.length === 1) return adaylar[0];
  }

  return null;
}

export function eeShowKartPicker() {
  document.getElementById('ee-kart-confirm').style.display = 'block';
  document.getElementById('ee-kart-confirm-detected').style.display = 'none';
  document.getElementById('ee-kart-confirm-picker').style.display = 'block';
  EE_STATE.kartOnayGosteriliyor = true;
  EE_STATE.kartAutoDetectGosteriliyor = false;
  EE_STATE.kartPickerGosteriliyor = true;
}

export function eeConfirmManualKart() {
  const kartId = document.getElementById('ee-kart-select').value;
  if (!kartId) {
    showToast('Lütfen bir kart seçin', 'error');
    return;
  }
  EE_STATE.kartId = kartId;
  EE_STATE._pendingKartId = null; // manuel onay tamamlandı
  if (!_eePendingParsed || !_eePendingParsed.length) {
    showToast('PDF verisi bulunamadı, lütfen yeniden yükleyin', 'error');
    return;
  }
  EE_STATE.pdfIslemler = _eePendingParsed;
  eeRunMatch();
}

// ── PDF metninden işlem satırlarını çıkar ──────────────────────
// Beklenen desen: bir satırda TARİH ... AÇIKLAMA ... TUTAR

export function eeParsePdfText(text) {
  const tekSatir = eeParseTekSatirFormati(text);
  const cokSatir = eeParseCokSatirFormati(text);
  const tarihAltSatir = eeParseTarihAltSatirFormati(text);
  // Üçünü birleştir, aynı işlemi farklı stratejilerin tekrar yakalamasını ele. Anahtara
  // açıklamanın ilk birkaç karakterini de katmak kritik: aynı gün + aynı tutarlı ama
  // GERÇEKTEN FARKLI iki işlem (örn. aynı gün hem "PAYNKO 160,00 TL" hem "İndir kampanyası
  // -160,00 TL" gibi) sırf tarih+tutar aynı diye birbirini silmemeli — sadece aynı stratejinin
  // ya da farklı stratejilerin GERÇEKTEN AYNI işlemi (tarih+tutar+benzer açıklama) tekrar
  // yakaladığı durumları eleriz.
  const dedupAnahtari = p => p.tarih + '_' + Math.abs(p.tutar).toFixed(2) + '_' +
    eeAsciiSadelestir((p.aciklama || '').toLocaleLowerCase('tr-TR')).replace(/[^a-z0-9]/g, '').slice(0, 12);
  const out = [...tekSatir];
  const mevcutAnahtarlar = new Set(tekSatir.map(dedupAnahtari));
  [...cokSatir, ...tarihAltSatir].forEach(p => {
    const k = dedupAnahtari(p);
    if (mevcutAnahtarlar.has(k)) return; // başka bir strateji zaten bu işlemi yakalamış
    mevcutAnahtarlar.add(k);
    out.push(p);
  });
  // Ekstrenin sabit bilgilendirme / kampanya / yasal uyarı bloklarını (gerçek işlem
  // OLMAYAN ama içinde tarih+tutar deseni geçtiği için yanlışlıkla yakalanmış satırları) ele.
  return out.filter(p => !eeBilgilendirmeMetniMi(p.aciklama));
}

// ── Ekstrenin alt kısmındaki sabit bilgilendirme / kampanya / faiz oranı bloğu mu? ──
// Bu metinler gerçek bir işlem değildir ama OCR/metin çıkarımı sırasında satır kırılımları
// kaybolduğunda içinde tarih ve tutar benzeri sayılar geçtiği için yanlışlıkla "işlem satırı"
// gibi yakalanabilir. İki bağımsız sinyalle tespit ederiz: (1) anormal uzunluk — gerçek bir
// işlem açıklaması bu kadar uzun olmaz, (2) ekstre bilgilendirme metinlerinde sık geçen
// anahtar kelimelerden en az ikisinin birden bulunması (yanlış pozitifi azaltmak için tek
// kelime yeterli sayılmaz — örn. "Limit" gerçek bir işlem açıklamasında da geçebilir).

export function eeBilgilendirmeMetniMi(aciklama) {
  if (!aciklama) return false;
  // 1) Anormal uzunluk: gerçek işlem açıklamaları (mağaza adı, taksit bilgisi vb.)
  //    pratikte 80-90 karakteri aşmaz; ekstre bilgilendirme metinleri yüzlerce karakterdir.
  if (aciklama.length > 180) return true;

  // 2) Anahtar kelime yoğunluğu
  const anahtarKelimeler = [
    'asgari ödeme', 'hesap özeti', 'hesap kesim tarihi', 'son ödeme tarihi',
    'worldpuan', 'cepte kazan', 'kampanya', 'faiz oranı', 'faiz oranlari',
    'alışveriş faiz', 'nakit çekim faiz', 'gecikme faiz', 'müşteri hizmetleri',
    'müşteri iletişim merkezi', 'internet bankacılığı', 'mobil bankacılık',
    'şube adı', 'şube kodu', 'limitiniz', 'detaylı bilgi', 'www.',
    'kredi kartı limitiniz', 'dönem içi hareketler', 'önceki dönem hesap özeti',
    'bir sonraki hesap kesim', 'bir sonraki son ödeme', 'kart no', 'puan karşılığı',
    'üye işyerlerinden', 'aylık yıllık', 'işlem tarihi açıklama tutar'
  ];
  const lower = aciklama.toLocaleLowerCase('tr-TR');
  let isaretSayisi = 0;
  for (const kw of anahtarKelimeler) {
    if (lower.includes(kw)) {
      isaretSayisi++;
      if (isaretSayisi >= 2) return true;
    }
  }
  // 3) Tek satırda birden fazla tarih deseni geçmesi de güçlü bir sinyaldir
  //    (gerçek bir işlem satırında yalnızca 1 tarih olur; ekstre özet bloklarında
  //    "Hesap Kesim Tarihi", "Son Ödeme Tarihi" gibi birden çok tarih art arda gelir).
  const tarihSayisi = (aciklama.match(/\b\d{1,2}[.\/\-]\d{1,2}[.\/\-]\d{2,4}\b/g) || []).length;
  if (tarihSayisi >= 2 && isaretSayisi >= 1) return true;

  return false;
}

// ── Bu satır bir kart borç ÖDEMESİ mi? ("Ödemeniz İçin Teşekkürler", "Kart Ödemesi",
// "CEPTETEB ÖDEME TEŞEKKÜR EDERİZ" gibi) — gerçek bir harcama değil, kart borcuna yapılan
// ödemedir. Normal işlem gibi kaydedilir (tutar pozitif) ama tip:'odeme' ile işaretlenir,
// böylece kullanıcı sonradan bunları harcamalardan ayırt edebilir.

export function eeOdemeSatiriMi(aciklama) {
  if (!aciklama) return false;
  const lower = aciklama.toLocaleLowerCase('tr-TR');
  const odemeKaliplari = [
    'ödemeniz için teşekkür', 'ödeme için teşekkür', 'kart ödemesi',
    'şube ödeme', 'cep şube ödeme', 'teşekkür ederiz', 'hesabınıza yapılan ödeme',
    'borcunuza yapılan ödeme', 'havale ile ödeme', 'eft ile ödeme'
  ];
  return odemeKaliplari.some(kw => eeAsciiSadelestir(lower).includes(eeAsciiSadelestir(kw)));
}

// ── Bu satır bir ALACAK mı (iade, indirim kazanımı, bonus geri alımı)? ──
// Ekranda renkle (yeşil/kırmızı) ayırt edilen yön bilgisi OCR'da kaybolur ve bankaya göre
// işaret konvansiyonu tutarsızdır (bazı uygulamalarda harcamalar "-" ile, bazılarında "+"
// ile gösterilir). Bu yüzden yönü ham eksi işaretinden değil, anahtar kelimeden çıkarırız:
// iade / geri alım / kazanılan indirim gibi ifadeler geçen satırlar gerçek bir harcama değil,
// kart borcunu AZALTAN bir kayıttır — negatif tutarla kaydedilir.
// ── Bu satır bir EKSTRE ÖZETİ / SEKME BAŞLIĞI satırı mı (gerçek bir işlem DEĞİL)? ──
// Gerçek ekran görüntülerinde ("Dönem İçi Hareketler", "Provizyonda Bekleyen", "Hesap Kesim
// Tarihi 28/05/2026", "İşlem Ara" gibi) bu tür satırlar bazen rakam/tarih/tutar içerir ve
// satır-bazlı OCR ayrıştırmasında yanlışlıkla bir işlemin açıklamasına karışabilir ya da
// (tarih-ayrı-satır stratejisinde) sahte bir işlem olarak algılanabilir. Tek bir anahtar
// kelime eşleşmesi burada yeterlidir çünkü gerçek bir işlem açıklamasının bu spesifik etiket
// metinlerini içermesi pratikte neredeyse imkânsızdır (mağaza/işlem adları farklı yapıdadır).
// ── Türkçe özel karakterleri ASCII karşılıklarına çevirir ──
// OCR motoru (kullanılan dil paketine/görüntü kalitesine göre) bazen ş/ç/ğ/ı/ö/ü gibi
// harfleri düz s/c/g/i/o/u olarak okuyabilir. Anahtar kelime eşleşmesini bu duruma karşı
// dayanıklı kılmak için hem aranan metni hem de anahtar kelimeleri bu fonksiyondan geçirip
// karşılaştırıyoruz — böylece "TESEKKUR EDERIZ" da "TEŞEKKÜR EDERİZ" de aynı şekilde eşleşir.

export function eeAsciiSadelestir(s) {
  return s
    .replace(/[şŞ]/g, 's').replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g')
    .replace(/[ıİ]/g, 'i').replace(/[öÖ]/g, 'o').replace(/[üÜ]/g, 'u');
}

export function eeOzetVeyaBaslikSatiriMi(line) {
  if (!line) return true;
  const lower = line.toLocaleLowerCase('tr-TR').trim();
  if (!lower) return true;
  const kaliplar = [
    'provizyonda bekleyen', 'dönem içi hareketler', 'donem ici hareketler',
    'bekleyen taksitler', 'provizyondaki işlemler', 'provizyondaki islemler',
    'gerçekleşen', 'gerceklesen', 'gelecek dönem', 'gelecek donem',
    'hesap özeti', 'hesap ozeti', 'hesap kesim tarihi', 'son ödeme tarihi',
    'son odeme tarihi', 'sonraki hesap kesim', 'sonraki son ödeme',
    'sonraki son odeme', 'harcama tutarı', 'harcama tutari', 'toplam tl',
    'toplam usd', 'toplam worldpuan', 'işlem ara', 'islem ara',
    'ekstre böldür', 'ekstre boldur', 'hemen ekstre böldür', 'hemen ekstre boldur',
    'kredi kartı borcunu', 'kredi karti borcunu', 'harcama kategorilerinizi',
    'gelecek ekstre kesim', 'kullanılabilir limit', 'kullanilabilir limit',
    'önceki dönem', 'onceki donem', 'kart hareketleri', 'ekstre/borç bilgileri',
    'ekstre/borc bilgileri', 'döviz işlem', 'doviz islem',
    // Mobil uygulama alt gezinme çubuğu etiketleri — ekranın en altına denk geldiği için
    // OCR bazen bunları son işlem bloğunun açıklamasına ekleyebilir (blok hâlâ açıkken
    // ekran sonuna ulaşıldığında). Gerçek bir işlem açıklaması bu etiketleri içermez.
    'ana sayfa', 'hesap ve kart', 'başvurular', 'basvurular', 'durumum'
  ];
  return kaliplar.some(kw => eeAsciiSadelestir(lower).includes(eeAsciiSadelestir(kw)));
}

export function eeAlacakMi(aciklama) {
  if (!aciklama) return false;
  const lower = aciklama.toLocaleLowerCase('tr-TR');
  const alacakKaliplari = [
    'iade', 'geri alım', 'geri alim', 'geri ödeme', 'geri odeme',
    'kazanılan indirim', 'kazanilan indirim', 'indirim kazan', 'bonus geri',
    'puan iadesi', 'itiraz', 'ters ibraz'
  ];
  return alacakKaliplari.some(kw => eeAsciiSadelestir(lower).includes(eeAsciiSadelestir(kw)));
}

// ── Açıklamadan, parser sonucuna eklenecek 'tip' alanını belirler ──
// 'odeme'  : kart borç ödemesi (tutar pozitif kaydedilir)
// 'alacak' : iade / indirim kazanımı (tutar NEGATİF kaydedilir, borcu azaltır)
// 'islem'  : normal harcama (varsayılan)

export function eeIslemTipiVeTutarBelirle(aciklama, hamTutar) {
  if (eeOdemeSatiriMi(aciklama)) {
    return { tip: 'odeme', tutar: Math.abs(hamTutar) };
  }
  if (eeAlacakMi(aciklama)) {
    return { tip: 'alacak', tutar: -Math.abs(hamTutar) };
  }
  // 'islem' (normal harcama) durumunda ham tutarın işaretine dokunmuyoruz: tek-satır
  // stratejisinde DR/CR/+/- bayrağından zaten doğru işaret hesaplanmış olabilir, bunu
  // burada zorla pozitife çevirip mevcut (çalışan) davranışı bozmak istemiyoruz.
  return { tip: 'islem', tutar: hamTutar };
}

// ── Strateji 1: Klasik ekstre/PDF formatı — tarih + açıklama + tutar AYNI satırda ──

export function eeParseTekSatirFormati(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const out = [];

  // Tarih desenleri: 12.05.2026 / 12/05/2026 / 12-05-2026
  const dateRe = /\b(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})\b/;
  // Tutar deseni: 1.234,56 / 1,234.56 / 1234.56 / 1234,56  (sonunda opsiyonel TL/TRY/₺/USD/EUR ya da +/-)
  const amountRe = /(-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|-?\d+[.,]\d{2})\s*(TL|TRY|₺|USD|EUR|\$|€)?\s*(DR|CR|D|K|-)?\s*$/i;

  lines.forEach(line => {
    if (line.length < 8) return;
    const dm = line.match(dateRe);
    if (!dm) return;
    const am = line.match(amountRe);
    if (!am) return;

    // Tarihi normalize et (YYYY-MM-DD)
    let [, dd, mm, yy] = dm;
    if (yy.length === 2) yy = '20' + yy;
    dd = dd.padStart(2, '0'); mm = mm.padStart(2, '0');
    if (+dd > 31 || +mm > 12) return;
    const tarih = `${yy}-${mm}-${dd}`;

    const hamTutar = eeNormalizeTutar(am[1], am[3]);
    if (hamTutar === null) return;

    // Açıklama: tarih ile tutar arasındaki metin
    let aciklama = line
      .replace(dm[0], '')
      .replace(am[0], '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!aciklama) aciklama = 'İşlem';

    const { tip, tutar } = eeIslemTipiVeTutarBelirle(aciklama, hamTutar);

    out.push({
      tarih,
      aciklama,
      tutar,
      tip,
      _key: tarih + '_' + Math.abs(tutar).toFixed(2) + '_' + Math.random().toString(36).slice(2, 7)
    });
  });

  return out;
}

// ── Strateji 2: Mobil banka uygulaması ekran görüntüsü formatı (OCR) ────────
// Bu uygulamalarda (ör. VakıfBank, Ziraat Bankkart) işlemler görsel olarak
// "gün/ay sütunu | açıklama sütunu | tutar sütunu" şeklinde yan yana durur.
// OCR satır satır soldan sağa okuduğu için gün/ay/tutar parçaları açıklama
// metniyle AYNI satıra karışmış halde çıkar, örn:
//   "21 TOKAT VERGİ DAİRESİ TOKAT..."
//   "Haziran (**8216) MUHAMMED IYI 3.750,00 TL"
// veya:
//   "16 | TURHAL 4. Taksit ... TL"
//   "Haz"
//   "(1.190,00 TL Islemin"
//   "2026 | 4/4 Taksidi)"
// Bu yüzden satırın TAMAMINI gün/ay/tutar kalıbına zorlamak yerine, her satırı
// tarayıp İÇİNDE geçen gün/ay/tutar parçacıklarını bulur, geri kalanını
// açıklamaya ekleriz. Parantez içindeki tutarlar ("X TL'nin taksidi" gibi referans
// bilgisi) gerçek işlem tutarı SAYILMAZ. Bir sonraki "gün" görülene kadar (veya
// metin bitene kadar) blok açık tutulur ki asıl tutar birkaç satır sonra gelse bile
// yakalanabilsin; blok kapanırken son bulunan (parantez-dışı) tutar esas alınır.

export function eeParseCokSatirFormati(text) {
  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const out = [];

  const ayAdlari = {
    'ocak': '01', 'oca': '01',
    'şubat': '02', 'subat': '02', 'şub': '02', 'sub': '02',
    'mart': '03', 'mar': '03',
    'nisan': '04', 'nis': '04',
    'mayıs': '05', 'mayis': '05', 'may': '05',
    'haziran': '06', 'haz': '06',
    'temmuz': '07', 'tem': '07',
    'ağustos': '08', 'agustos': '08', 'ağu': '08', 'agu': '08',
    'eylül': '09', 'eylul': '09', 'eyl': '09',
    'ekim': '10', 'eki': '10',
    'kasım': '11', 'kasim': '11', 'kas': '11',
    'aralık': '12', 'aralik': '12', 'ara': '12'
  };
  // Satır BAŞINDA duran gün sayısı (1-31), ardından boşluk/| veya satır sonu
  // Negatif lookahead (?!\d) kritik: bu olmadan "2026" gibi tek başına bir satıra düşen
  // 4 haneli bir yıl, baştaki "20"yi geçerli bir GÜN (1-31 aralığında) sanıp yanlışlıkla
  // yeni bir işlem bloğu başlatır ve o ana kadar biriken (henüz tutarı gelmemiş) bloğu
  // sessizce siler. Lookahead, gün hanesinin hemen ardından başka bir rakam gelmemesini
  // şart koşarak bunu engeller.
  const gunBasRe = /^(\d{1,2})(?!\d)\s*[\|:.\-]?\s*/;
  // Saat damgası deseni (örn. "14:56", "09.30") — bunu GÜN ile karıştırmamak için ayrı tespit ederiz
  const saatBasRe = /^(\d{1,2})\s*[:.]\s*\d{2}\b/;
  // Satırın TAMAMI zaten bir tutar mı? (örn. "160,00 TL", "1.500,00") — bu durumda baştaki
  // rakam grubu GÜN değil, tutarın kendisidir; gün olarak yorumlanmamalı.
  const satirSafTutarRe = /^-?\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\s*(TL|TRY|₺|USD|EUR|\$|€)?\s*$/i;
  // Satır içinde herhangi bir yerde geçen ay adı (kelime sınırlarıyla)
  const ayIcindeRe = /\b([a-zçğıöşü]{3,9})\b\.?/gi;
  // Satır başında duran yıl (2000-2099)
  const yilBasRe = /^(20\d{2})\s*[\|:.\-]?\s*/;
  // Satırın TAMAMI (OCR gürültüsü hariç, en fazla 1-2 tek karakter/ikon kalıntısı dışında)
  // sadece bir yıldan ibaret mi? (örn. "2026", "2026 W", "2026 WN"). Bu mobil ekstre
  // formatında her işlem bloğu "gün → ay → yıl" sırasıyla 3 satıra yayılır ve blok
  // KESİN olarak yıl satırıyla kapanır. Gün rakamı OCR'da bozulup (§, harfle karışma vb.)
  // kaybolsa bile, bağımsız bir yıl satırı gördüğümüzde bloğu zorla kapatırız — aksi halde
  // bir sonraki işlemin (gün tespiti başarısız olursa) açıklaması öncekine yapışıp kalır.
  const sirfYilSatirRe = /^(20\d{2})\b[\sA-Za-zÇĞİÖŞÜçğıöşü©]{0,4}$/;
  // Satır içinde geçen tutar (TL/TRY/₺ etiketli olması tercih edilir)
  const amountInLineRe = /(-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))\s*(TL|TRY|₺|USD|EUR|\$|€)\b/i;
  // Etiketsiz ama açıkça ondalıklı tutar (yedek desen — TL etiketi OCR'da kaybolmuşsa, satır sonunda)
  const amountBareRe = /(-?\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*$/;
  // Bir blok parantez kapanışı OCR'da kaybolduğunda sonsuza dek "parantez içi" sayılmasını
  // önlemek için kaç satır boyunca açık kalmasına izin verildiğini sınırlarız. Gerçek
  // parantez-içi referans metni (taksit bilgisi vb.) pratikte aynı satırda veya en fazla
  // bir sonraki satırda kapanır; daha uzun süre kapanmıyorsa OCR kapanışı kaçırmış demektir.
  const PARANTEZ_MAX_SATIR = 1;

  let currentYear = new Date().getFullYear();
  let blok = null; // { gun, ay, yil, tutarAdaylari: [{tutar, parantezIci}], aciklamaParcalari: [] }
  let parantezDerinligi = 0; // satırlar arası taşan parantezleri takip etmek için
  let parantezSatirSayisi = 0; // parantez kaç satırdır açık — OCR'da kapanış kaybolduysa sonsuza dek "içeride" saymamak için
  // OCR ay kısaltmasını ("HAZ" vb.) her zaman güvenilir okuyamayabilir (örn. bulanık/düşük
  // çözünürlüklü görüntülerde "H" harfi "u"/"w" ile karışabilir). Bir blok kendi ayını
  // tespit edemezse, AYNI ekran görüntüsünde bir önceki blok için başarıyla okunmuş ayı
  // son çare olarak devralırız — tek bir ekran görüntüsündeki tüm işlemler pratikte
  // neredeyse her zaman aynı dönem/aya aittir, bu yüzden bu varsayım güvenlidir ve OCR'ın
  // bir-iki ay kısaltmasını kaçırması yüzünden tüm işlemin sessizce kaybolmasını önler.
  let sonBilinenAy = null;

  function bloguKapat() {
    if (!blok) return;
    if (blok.gun && !blok.ay && sonBilinenAy) blok.ay = sonBilinenAy;
    if (blok.gun && blok.ay && blok.tutarAdaylari.length) {
      sonBilinenAy = blok.ay;
      // Parantez-dışı adaylar varsa onları tercih et (gerçek işlem tutarı genelde
      // parantez dışındaki sütunda yer alır). Hiç parantez-dışı aday yoksa, elimizde
      // sadece parantez-içi (referans/taksit bilgisi olma ihtimali yüksek) bir tutar
      // kalmış demektir — bunu son çare olarak kullanırız ama "belirsiz" işaretleriz,
      // ki kullanıcı eşleştirme ekranında bu işlemi özellikle gözden geçirebilsin.
      const disAdaylar = blok.tutarAdaylari.filter(a => !a.parantezIci);
      const belirsiz = !disAdaylar.length;
      const adaySecimHavuzu = disAdaylar.length ? disAdaylar : blok.tutarAdaylari;
      // Birden fazla parantez-dışı aday varsa SONUNCUSUNU seçiyoruz: açıklama metni
      // içinde geçen bir referans/orijinal fiyat (örn. "Trendyol.Com Ist(6/6 TK) 15.230,04 TL")
      // genelde işlemin BAŞINDA, asıl o dönem tahsil edilen tutar ise satırın/bloğun SONUNDA
      // (sağ sütun) yer alır.
      const secilen = adaySecimHavuzu[adaySecimHavuzu.length - 1];
      const dd = String(blok.gun).padStart(2, '0');
      const tarih = `${blok.yil}-${blok.ay}-${dd}`;
      let aciklama = blok.aciklamaParcalari.join(' ').replace(/\s{2,}/g, ' ').trim();
      if (!aciklama) aciklama = 'İşlem';
      if (belirsiz) aciklama += ' ⚠️ (tutar OCR\'da net okunamadı, kontrol edin)';
      // Mobil uygulama ekran görüntülerinde işaret (renk) konvansiyonu bankaya göre
      // tutarsızdır (bkz. eeIslemTipiVeTutarBelirle yorumu), bu yüzden ham OCR işaretini
      // değil, sadece anahtar kelimeyi esas alırız: 'islem' (varsayılan) için mutlak değer,
      // 'odeme'/'alacak' için ise anahtar kelimeye göre zorlanan işaret kullanılır.
      const { tip, tutar } = eeIslemTipiVeTutarBelirle(aciklama, Math.abs(secilen.tutar));
      out.push({
        tarih,
        aciklama,
        tutar,
        tip,
        belirsizTutar: belirsiz,
        _key: tarih + '_' + Math.abs(tutar).toFixed(2) + '_' + Math.random().toString(36).slice(2, 7)
      });
    }
    blok = null;
    parantezDerinligi = 0;
    parantezSatirSayisi = 0;
  }

  for (let i = 0; i < rawLines.length; i++) {
    // OCR bazen tablo çizgilerini/ayraçlarını satıra sızdırır (örn. "__11__ Market ...").
    // Bunlar gün/tutar tespitini bozmasın diye bu süsleme karakterlerini satırın
    // HERHANGİ bir yerinden temizleriz (gerçek bir işlem açıklamasında bu karakterler
    // anlamlı şekilde geçmez); ardışık boşlukları teke indirip baş/son boşluğu kırparız.
    let line = rawLines[i].replace(/[_*~`]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

    // -1) Ekstre özeti / sekme başlığı satırı mı (örn. "Dönem İçi Hareketler",
    //     "Provizyonda Bekleyen")? Bunlar gerçek bir işlem değildir; tamamen atla ki ne
    //     yanlışlıkla bir işlemin açıklamasına karışsın ne de gün/ay/tutar tespitini bozsun.
    if (eeOzetVeyaBaslikSatiriMi(line)) continue;

    // 0) Bu satır saat damgası mı (örn. "14:56") veya zaten kendi başına bir TUTAR mı
    //    (örn. "160,00 TL")? Öyleyse satır başındaki rakam grubu GÜN değildir — bu
    //    durumlarda gün tespitini tamamen atlarız (mevcut blok varsa açık kalır,
    //    tutar ise adım 5'te zaten yakalanacaktır).
    const saatMi = saatBasRe.test(line);
    const sirfTutarMi = satirSafTutarRe.test(line);

    // 1) Satır başında gün var mı? (yeni işlem bloğu başlangıcı)
    const gunM = (!saatMi && !sirfTutarMi) ? line.match(gunBasRe) : null;
    if (gunM) {
      const gunVal = parseInt(gunM[1], 10);
      // Saf tutar satırlarıyla çakışmayı önlemek için ek güvenlik: gün eşleşmesinden
      // sonra kalan satır parçası HEMEN bir ondalıklı sayı ile başlıyorsa (örn. "16" + "0,00 TL"
      // ayrışması gibi durumlar) bunu gün değil, tutarın parçası olarak değerlendiririz.
      const kalanParca = line.slice(gunM[0].length);
      const tutarinPasrasiGibiMi = /^\d{0,1}[.,]\d{2}\b/.test(kalanParca) && !/[a-zçğıöşü]/i.test(gunM[0]);
      if (gunVal >= 1 && gunVal <= 31 && !tutarinPasrasiGibiMi) {
        bloguKapat(); // önceki blok varsa kapat (tamamlanmışsa eklenir, değilse atılır)
        blok = { gun: gunVal, ay: null, yil: currentYear, tutarAdaylari: [], aciklamaParcalari: [] };
        line = line.slice(gunM[0].length);
      }
    }

    if (!blok) continue; // henüz bir gün görülmedi, bu satırı atla (başlık/özet satırları)

    // 1.5) Bu satır TEK BAŞINA bir yıl mı (örn. "2026", "2026 W")? Bu format her bloğu
    //      kesin olarak bir yıl satırıyla kapatır. Bu sinyali gördüğümüzde yılı bloğa
    //      yazıp bloğu HEMEN kapatıyoruz — bir sonraki satırda gün rakamı OCR'da
    //      bozulmuş olsa bile (örn. tekrarlanan "11" yanlış okunduğunda) yeni işlemin
    //      açıklaması artık kapanmış bu bloğa sessizce eklenemez.
    const sirfYilM = line.match(sirfYilSatirRe);
    if (sirfYilM && !gunM) {
      blok.yil = parseInt(sirfYilM[1], 10);
      bloguKapat();
      continue;
    }

    // 2) Satır başında yıl var mı?
    const yilM = line.match(yilBasRe);
    if (yilM) {
      blok.yil = parseInt(yilM[1], 10);
      line = line.slice(yilM[0].length);
    }

    // 3) Satır içinde ay adı var mı? (henüz bulunmadıysa ara)
    if (!blok.ay) {
      ayIcindeRe.lastIndex = 0;
      let am;
      while ((am = ayIcindeRe.exec(line)) !== null) {
        const kod = ayAdlari[am[1].toLowerCase()];
        if (kod) {
          blok.ay = kod;
          line = (line.slice(0, am.index) + ' ' + line.slice(am.index + am[0].length)).trim();
          break;
        }
      }
    }

    // 4) Satırın parantez içinde başlayıp başlamadığını / parantezle bitip bitmediğini takip et.
    //    OCR kapanış parantezini kaçırırsa parantezDerinligi sonsuza dek 1'de kalıp sonraki
    //    TÜM tutarları haksız yere "parantez içi" işaretleyebilir; bunu önlemek için kaç
    //    satırdır açık kaldığını sayıp belli bir sınırdan sonra zorla sıfırlıyoruz.
    let satirBasiParantezIci = parantezDerinligi > 0;
    if (satirBasiParantezIci) {
      parantezSatirSayisi++;
      if (parantezSatirSayisi >= PARANTEZ_MAX_SATIR) {
        // OCR kapanışı muhtemelen kaçırmış: bu satırı parantez-dışı kabul et ki
        // tek geçerli tutar adayı haksız yere "belirsiz" işaretlenmesin.
        parantezDerinligi = 0;
        parantezSatirSayisi = 0;
        satirBasiParantezIci = false;
      }
    } else {
      parantezSatirSayisi = 0;
    }
    for (const ch of line) {
      if (ch === '(') parantezDerinligi++;
      else if (ch === ')') parantezDerinligi = Math.max(0, parantezDerinligi - 1);
    }

    // Bir tutarın "parantez içi" sayılıp sayılmayacağını, satırın o ana kadarki kısmındaki
    // NET açık parantez sayısına bakarak belirler (sadece '(' karakterinin VAR OLUP
    // olmadığına değil!). Örn. "(**8216) MUHAMMED İYİ 160,00 TL" satırında parantez tutardan
    // ÖNCE zaten kapanmıştır — bu yüzden tutar parantez-içi DEĞİLDİR; eski kontrol
    // (`.includes('(')`) bunu ayırt edemiyor, satırda HERHANGİ bir '(' geçmesi yeterli
    // sayılıp gerçek tutarı haksız yere "belirsiz" işaretleyebiliyordu.
    function tutarParantezIciMi(satirBaslangici) {
      let derinlik = satirBasiParantezIci ? 1 : 0;
      for (const ch of satirBaslangici) {
        if (ch === '(') derinlik++;
        else if (ch === ')') derinlik = Math.max(0, derinlik - 1);
      }
      return derinlik > 0;
    }

    // 5) Satır içinde tutar var mı? (TL etiketli + etiketsiz, her ikisini de aday olarak topla)
    let am = line.match(amountInLineRe);
    if (am) {
      blok.tutarAdaylari.push({ tutar: eeNormalizeTutar(am[1], null), parantezIci: tutarParantezIciMi(line.slice(0, am.index)) });
      line = (line.slice(0, am.index) + ' ' + line.slice(am.index + am[0].length)).trim();
    } else {
      const bareM = line.match(amountBareRe);
      if (bareM) {
        blok.tutarAdaylari.push({ tutar: eeNormalizeTutar(bareM[1], null), parantezIci: tutarParantezIciMi(line.slice(0, bareM.index)) });
        line = line.slice(0, bareM.index).trim();
      }
    }
    // Geçersiz (null) tutar adaylarını hemen ele
    blok.tutarAdaylari = blok.tutarAdaylari.filter(a => a.tutar !== null);

    // 6) Satırdan geri kalan metni açıklamaya ekle
    const kalan = line.replace(/[\|]/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (kalan && kalan.length > 1) blok.aciklamaParcalari.push(kalan);
  }
  bloguKapat(); // dosya sonunda açık kalan blok varsa kapat

  return out;
}

// ── Strateji 3: Tarih AYRI satırda (CepteTeb, Garanti BBVA tarzı liste görünümü) ──
// Bu formatta her işlem iki satıra yayılır ve Strateji 1 (tarih+açıklama+tutar AYNI satırda)
// ile Strateji 2'nin (gün/ay-adı/yıl parçaları farklı satırlara dağılmış, ay İSİM olarak
// geçer) hiçbiri bunu yakalayamaz:
//   Satır N:   "BAŞLIK ... TUTAR TL"              (açıklama ve tutar aynı satırda)
//   Satır N+1: "GG.AA.YYYY - SS:DD" / "GG/AA/YYYY - SS:DD" (+ "- Taksit: X/Y" / "X/Y Taksit")
// Tarih satırının GÜN ile BAŞLAMASI değil, satırın TAMAMEN bir tarihle başlaması (önünde
// başka metin olmaması) kritik bir güvenlik önlemidir: "Hesap Kesim Tarihi 28/05/2026" gibi
// özet satırlarında tarih satırın ORTASINDA geçer, bu yüzden hiçbir zaman yanlışlıkla işlem
// tarihi sanılmaz.

export function eeParseTarihAltSatirFormati(text) {
  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const out = [];

  const tarihSatirRe = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})\b/;
  const amountInLineRe = /(-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))\s*(TL|TRY|₺|USD|EUR|\$|€)\b/i;

  let buffer = []; // bu tarih satırından önce biriken açıklama/tutar satırları

  function bufferiIsle(dm) {
    if (!buffer.length) return;
    const birlesik = buffer.join(' ').replace(/\s{2,}/g, ' ').trim();
    const adaylar = [];
    const re = new RegExp(amountInLineRe.source, 'gi');
    let m;
    while ((m = re.exec(birlesik)) !== null) {
      const oncesi = birlesik.slice(0, m.index);
      const acikParantez = (oncesi.match(/\(/g) || []).length > (oncesi.match(/\)/g) || []).length;
      adaylar.push({ tutar: eeNormalizeTutar(m[1], null), parantezIci: acikParantez, index: m.index, raw: m[0] });
    }
    buffer = [];
    if (!adaylar.length) return;
    const disAdaylar = adaylar.filter(a => !a.parantezIci);
    const havuz = disAdaylar.length ? disAdaylar : adaylar;
    // Strateji 2'deki aynı mantık: birden fazla aday varsa SONUNCUSU (açıklamadaki olası
    // bir referans/orijinal fiyat genelde başta, gerçek tahsil tutarı sonda yer alır).
    const secilen = havuz[havuz.length - 1];
    let aciklama = (birlesik.slice(0, secilen.index) + ' ' + birlesik.slice(secilen.index + secilen.raw.length))
      .replace(/\s{2,}/g, ' ').trim();
    if (!aciklama) aciklama = 'İşlem';

    const gg = dm[1].padStart(2, '0');
    const aa = dm[2].padStart(2, '0');
    const tarih = `${dm[3]}-${aa}-${gg}`;

    const { tip, tutar } = eeIslemTipiVeTutarBelirle(aciklama, Math.abs(secilen.tutar));
    out.push({
      tarih,
      aciklama,
      tutar,
      tip,
      _key: tarih + '_' + Math.abs(tutar).toFixed(2) + '_' + Math.random().toString(36).slice(2, 7)
    });
  }

  for (const line of rawLines) {
    if (eeOzetVeyaBaslikSatiriMi(line)) continue; // ekstre özeti/sekme başlığı, atla
    const dm = line.match(tarihSatirRe);
    if (dm) {
      bufferiIsle(dm);
    } else {
      buffer.push(line);
      // Tarihsiz bir bilgilendirme bloğunun sonsuza dek büyümesini önlemek için makul
      // bir pencereyle sınırlıyoruz — gerçek bir işlemin başlığı pratikte 1-2 satırdır.
      if (buffer.length > 4) buffer.shift();
    }
  }
  // Metin sonunda tarihi hiç gelmemiş asılı bir buffer varsa atılır (gerçek bir işlemse
  // tarihi ekstrede mutlaka bir yerde görünür, varsayım yapmıyoruz).

  return out;
}

// Tutar string'ini ve DR/CR/D/K/- işaretini sayıya çevirir; geçersizse null döner

export function eeNormalizeTutar(amtStr, flagRaw) {
  const lastDot = amtStr.lastIndexOf('.');
  const lastComma = amtStr.lastIndexOf(',');
  let normalized;
  if (lastComma > lastDot) {
    // virgül ondalık ayracı: binlik nokta, ondalık virgül
    normalized = amtStr.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // nokta ondalık ayracı: binlik virgül, ondalık nokta
    normalized = amtStr.replace(/,/g, '');
  } else {
    normalized = amtStr.replace(',', '.');
  }
  let tutar = parseFloat(normalized);
  if (isNaN(tutar) || tutar === 0) return null;

  // DR/D = borç (gider, negatif); CR/K = alacak (gelir, pozitif) — kart ekstrelerinde genelde harcama pozitif yazılır
  const flag = (flagRaw || '').toUpperCase();
  if (flag === 'CR' || flag === 'K') tutar = Math.abs(tutar);
  else if (flag === 'DR' || flag === 'D' || flag === '-') tutar = -Math.abs(tutar);
  return tutar;
}

// ── Eşleştirme algoritması: kart bazında tarih + tutar ─────────

export function eeRunMatch() {
  const kartId = EE_STATE.kartId;
  const sistemIslemler = (DB.islemler || []).filter(i => i.kart === kartId);

  const eslesen = [];
  const usedSistemIds = new Set();
  const usedPdfKeys = new Set();

  const TOLERANS_GUN = 0;        // tarih birebir eşleşmeli
  const TOLERANS_TUTAR = 0.01;   // sadece ondalık yuvarlama payı

  EE_STATE.pdfIslemler.forEach(p => {
    let best = null, bestScore = Infinity;
    sistemIslemler.forEach(s => {
      if (usedSistemIds.has(s.id)) return;
      const sTutar = (s.taksit > 1 ? (s.aylik != null ? s.aylik : s.tutar) : s.tutar);
      if (Math.abs(Math.abs(sTutar) - Math.abs(p.tutar)) > TOLERANS_TUTAR) return;
      const sTarih = s.taksit > 1 ? ((s.manuelTaksitler && s.manuelTaksitler[0] && s.manuelTaksitler[0].tarih) || s.tarih) : s.tarih;
      const gunFarki = Math.abs((new Date(p.tarih) - new Date(sTarih)) / 86400000);
      if (gunFarki > TOLERANS_GUN) return;
      const score = gunFarki + Math.abs(Math.abs(sTutar) - Math.abs(p.tutar));
      if (score < bestScore) { bestScore = score; best = s; }
    });
    if (best) {
      usedSistemIds.add(best.id);
      usedPdfKeys.add(p._key);
      eslesen.push({ pdf: p, sistem: best });
    }
  });

  const sadecePdf = EE_STATE.pdfIslemler.filter(p => !usedPdfKeys.has(p._key));
  const sadeceSistem = sistemIslemler.filter(s => !usedSistemIds.has(s.id));

  EE_STATE.eslesen = eslesen;
  EE_STATE.sadecePdf = sadecePdf;
  EE_STATE.sadeceSistem = sadeceSistem;

  eeRenderResults();
}

// ── Sonuç ekranı ────────────────────────────────────────────────

export function eeRenderResults() {
  document.getElementById('ee-upload-status').style.display = 'none';
  const wrap = document.getElementById('ee-step-results');
  wrap.style.display = 'block';
  EE_STATE.sonuclarGosteriliyor = true;
  EE_STATE.kartOnayGosteriliyor = false; // kart onayı tamamlandı, artık sonuçlar var

  const kart = (DB.kartlar || []).find(k => k.id === EE_STATE.kartId);
  const pb = kart ? getKartCurrency(kart.id) : (defaultCurrency || 'TRY');

  const eEslesen = EE_STATE.eslesen.filter(e => !e.sistem.kategori || !e.sistem.aciklama);
  const eTamam = EE_STATE.eslesen.filter(e => e.sistem.kategori && e.sistem.aciklama);

  let html = '';

  // ── Özet şeridi ──
  html += `<div class="islem-stats" style="margin-bottom:18px">
    <div class="stat s-green"><div class="stat-label">✅ Eşleşen</div><div class="stat-val green">${EE_STATE.eslesen.length}</div></div>
    <div class="stat s-warn"><div class="stat-label">📥 PDF'de var, sistemde yok</div><div class="stat-val" style="color:var(--warn)">${EE_STATE.sadecePdf.length}</div></div>
    <div class="stat s-red"><div class="stat-label">📤 Sistemde var, PDF'de yok</div><div class="stat-val red">${EE_STATE.sadeceSistem.length}</div></div>
  </div>
  <div style="margin-bottom:16px"><button class="btn btn-ghost btn-sm ee-btn-reset">↺ Yeni ekstre yükle</button></div>`;

  // ── 1) Eşleşen ama tamamlanması gereken (kategori/açıklama boş) ──
  html += `<div class="ee-section">
    <div class="ee-section-head">
      <span class="ee-section-title">🧩 Eşleşti — Eksik Bilgi Tamamlanacak</span>
      <span class="ee-section-count" style="background:var(--accent-glow);color:var(--accent)">${eEslesen.length}</span>
    </div>`;
  if (!eEslesen.length) {
    html += `<div class="ee-empty">Tamamlanması gereken eşleşme yok 👍</div>`;
  } else {
    eEslesen.forEach((e, idx) => {
      const i = EE_STATE.eslesen.indexOf(e);
      const sign = e.sistem.tutar >= 0 ? '+' : '';
      html += `<div class="ee-row" id="ee-eslesen-${i}">
        <div class="ee-row-main">
          <div class="ee-row-desc">${e.pdf.aciklama}</div>
          <div class="ee-row-date">${fmtDate ? fmtDate(e.pdf.tarih) : e.pdf.tarih} · sistemdeki tarih: ${fmtDate ? fmtDate(e.sistem.tarih) : e.sistem.tarih}</div>
        </div>
        <input type="text" class="ee-inline-field" id="ee-ac-${i}" placeholder="Açıklama girin" value="${(e.sistem.aciklama || e.pdf.aciklama || '').replace(/"/g, '&quot;')}">
        <select class="ee-inline-field" id="ee-kat-${i}">
          <option value="">Kategori seçin…</option>
          ${getKategoriOpts('')}
        </select>
        <div class="ee-row-amt" style="color:${e.sistem.tutar >= 0 ? 'var(--teal)' : 'var(--text)'}">${sign}${fmtCur(Math.abs(e.sistem.tutar), pb)}</div>
        <div class="ee-actions">
          <button class="ee-btn-mini primary ee-btn-onayla" data-i="${i}">✓ Onayla</button>
        </div>
      </div>`;
    });
    // Kategorileri seçili olanlara önceden ata
    setTimeout(() => {
      eEslesen.forEach(e => {
        const i = EE_STATE.eslesen.indexOf(e);
        const sel = document.getElementById('ee-kat-' + i);
        if (sel && e.sistem.kategori) sel.value = e.sistem.kategori;
      });
    }, 0);
  }
  html += `</div>`;

  // ── 2) Tamamen eşleşmiş, sorun yok (bilgi amaçlı, katlanır) ──
  if (eTamam.length) {
    html += `<div class="ee-section">
      <div class="ee-section-head">
        <span class="ee-section-title">✅ Tam Eşleşen (bilgisi tam)</span>
        <span class="ee-section-count" style="background:var(--teal-glow);color:var(--teal)">${eTamam.length}</span>
      </div>
      <div style="color:var(--text3);font-size:11.5px">Bu işlemler PDF ile birebir uyuştu ve sistemde kategori/açıklama bilgisi zaten tam — ek aksiyon gerekmiyor.</div>
    </div>`;
  }

  // ── 3) PDF'de var, sistemde yok ──
  html += `<div class="ee-section">
    <div class="ee-section-head">
      <span class="ee-section-title">📥 PDF'de Var, Sistemde Yok</span>
      <span class="ee-section-count" style="background:var(--warn-glow);color:var(--warn)">${EE_STATE.sadecePdf.length}</span>
    </div>`;
  if (!EE_STATE.sadecePdf.length) {
    html += `<div class="ee-empty">Hepsi sistemde mevcut 👍</div>`;
  } else {
    EE_STATE.sadecePdf.forEach((p, idx) => {
      const j = EE_STATE.sadecePdf.indexOf(p);
      const sign = p.tutar >= 0 ? '+' : '';
      const tipRozet = p.tip === 'odeme'
        ? '<span class="ee-tip-badge" style="background:var(--sky-glow,rgba(56,189,248,.15));color:var(--sky,#38bdf8);font-size:10px;padding:2px 7px;border-radius:20px;margin-left:6px;white-space:nowrap">💳 Kart Ödemesi</span>'
        : p.tip === 'alacak'
          ? '<span class="ee-tip-badge" style="background:var(--teal-glow);color:var(--teal);font-size:10px;padding:2px 7px;border-radius:20px;margin-left:6px;white-space:nowrap">↩️ Alacak/İade</span>'
          : '';
      html += `<div class="ee-row" id="ee-sadecepdf-${j}">
        <div class="ee-row-main">
          <div class="ee-row-desc">${p.aciklama}${tipRozet}</div>
          <div class="ee-row-date">${fmtDate ? fmtDate(p.tarih) : p.tarih}</div>
        </div>
        <select class="ee-inline-field" id="ee-pdf-kat-${j}" style="min-width:130px">
          <option value="">Kategori (ops.)</option>
          ${getKategoriOpts('')}
        </select>
        <div class="ee-row-amt" style="color:${p.tutar >= 0 ? 'var(--teal)' : 'var(--text)'}">${sign}${fmtCur(Math.abs(p.tutar), pb)}</div>
        <div class="ee-actions">
          <button class="ee-btn-mini primary ee-btn-sisteme-ekle" data-j="${j}">+ Sisteme Ekle</button>
          <button class="ee-btn-mini ee-btn-yoksay" data-grup="sadecePdf" data-j="${j}">Yok say</button>
        </div>
      </div>`;
    });
  }
  html += `</div>`;

  // ── 4) Sistemde var, PDF'de yok ──
  html += `<div class="ee-section">
    <div class="ee-section-head">
      <span class="ee-section-title">📤 Sistemde Var, PDF'de Yok</span>
      <span class="ee-section-count" style="background:var(--danger-glow);color:var(--rose)">${EE_STATE.sadeceSistem.length}</span>
    </div>`;
  if (!EE_STATE.sadeceSistem.length) {
    html += `<div class="ee-empty">Hepsi PDF ile uyuşuyor 👍</div>`;
  } else {
    EE_STATE.sadeceSistem.forEach((s, idx) => {
      const j = EE_STATE.sadeceSistem.indexOf(s);
      const sign = s.tutar >= 0 ? '+' : '';
      html += `<div class="ee-row" id="ee-sadecesistem-${j}">
        <div class="ee-row-main">
          <div class="ee-row-desc">${s.aciklama || '(açıklama yok)'}</div>
          <div class="ee-row-date">${fmtDate ? fmtDate(s.tarih) : s.tarih}</div>
        </div>
        <div class="ee-row-amt" style="color:${s.tutar >= 0 ? 'var(--teal)' : 'var(--text)'}">${sign}${fmtCur(Math.abs(s.tutar), pb)}</div>
        <div class="ee-actions">
          <button class="ee-btn-mini ee-btn-incele" data-id="${s.id}">İncele</button>
          <button class="ee-btn-mini danger ee-btn-sil-sistemden" data-j="${j}">🗑 Sil</button>
        </div>
      </div>`;
    });
  }
  html += `</div>`;

  wrap.innerHTML = html;
  bindMoneyInputs(wrap);
  // [ES module] onclick="eeReset()"/"eeOnaylaTamamla(...)"/"eeSistemeEkle(...)"/
  // "eeYokSay(...)"/"editIslem(...)"/"eeSilSistemden(...)" kaldırıldı -
  // gerçek addEventListener bağlanıyor.
  wrap.querySelectorAll('.ee-btn-reset').forEach(btn => {
    btn.addEventListener('click', () => eeReset());
  });
  wrap.querySelectorAll('.ee-btn-onayla').forEach(btn => {
    btn.addEventListener('click', () => eeOnaylaTamamla(Number(btn.getAttribute('data-i'))));
  });
  wrap.querySelectorAll('.ee-btn-sisteme-ekle').forEach(btn => {
    btn.addEventListener('click', () => eeSistemeEkle(Number(btn.getAttribute('data-j'))));
  });
  wrap.querySelectorAll('.ee-btn-yoksay').forEach(btn => {
    btn.addEventListener('click', () => eeYokSay(btn.getAttribute('data-grup'), Number(btn.getAttribute('data-j'))));
  });
  wrap.querySelectorAll('.ee-btn-incele').forEach(btn => {
    btn.addEventListener('click', () => editIslem(btn.getAttribute('data-id')));
  });
  wrap.querySelectorAll('.ee-btn-sil-sistemden').forEach(btn => {
    btn.addEventListener('click', () => eeSilSistemden(Number(btn.getAttribute('data-j'))));
  });
}

// ── Aksiyon: eşleşen işlemi tamamla (kategori/açıklama yaz) ─────

export function eeOnaylaTamamla(i) {
  const e = EE_STATE.eslesen[i];
  if (!e) return;
  const ac = (document.getElementById('ee-ac-' + i).value || '').trim();
  const kat = document.getElementById('ee-kat-' + i).value || null;
  const idx = DB.islemler.findIndex(x => x.id === e.sistem.id);
  if (idx >= 0) {
    if (ac) DB.islemler[idx].aciklama = ac;
    if (kat) DB.islemler[idx].kategori = kat;
    saveData();
    showToast('İşlem güncellendi');
  }
  const row = document.getElementById('ee-eslesen-' + i);
  if (row) { row.style.opacity = '0.4'; row.querySelectorAll('button,input,select').forEach(el => el.disabled = true); }
  if (typeof renderIslemler === 'function') renderIslemler();
}

// ── Aksiyon: PDF'de olan işlemi sisteme ekle (modal ile) ─────────

export function eeSistemeEkle(j) {
  const p = EE_STATE.sadecePdf[j];
  if (!p) return;
  const kat = (document.getElementById('ee-pdf-kat-' + j) || {}).value || null;

  // İşlem modalını aç ve alanları doldur
  populateIslemModal(EE_STATE.kartId);

  // Kart seçimini zorla
  const kartEl = document.getElementById('islem-kart');
  if (kartEl && EE_STATE.kartId) {
    kartEl.value = EE_STATE.kartId;
    if (typeof onIslemKartChange === 'function') onIslemKartChange();
  }

  // Tarih
  const tarihEl = document.getElementById('islem-tarih');
  if (tarihEl) {
    if (typeof setDateInputValue === 'function') setDateInputValue(tarihEl, p.tarih);
    if (typeof onIslemTarihiChange === 'function') onIslemTarihiChange();
  }

  // Açıklama
  const acEl = document.getElementById('islem-aciklama');
  if (acEl) acEl.value = p.aciklama || '';

  // Tutar
  if (typeof setMoneyInput === 'function') setMoneyInput('islem-tutar', Math.abs(p.tutar));

  // Para birimi
  const pbEl = document.getElementById('islem-para-birimi');
  if (pbEl) {
    const pb = getKartCurrency(EE_STATE.kartId);
    if (pb) pbEl.value = pb;
  }

  // Kategori
  if (kat) {
    const katEl = document.getElementById('islem-kategori');
    if (katEl) katEl.value = kat;
    if (typeof renderIslemKategoriButon === 'function') renderIslemKategoriButon();
  }

  // Başlığı güncelle
  const titleEl = document.getElementById('islem-modal-title');
  if (titleEl) titleEl.textContent = 'İşlem Ekle (Ekstreden)';

  // Kaydedilince o satırı soluklaştır
  const _origSaveIslem = _eeOnSaveHook;
  set_eeOnSaveHook(function() {
    set_eeOnSaveHook(_origSaveIslem);
    const row = document.getElementById('ee-sadecepdf-' + j);
    if (row) { row.style.opacity = '0.4'; row.querySelectorAll('button,input,select').forEach(el => el.disabled = true); }
  });

  // Modalı aç
  document.getElementById('modal-islem').classList.add('open');
  document.body.classList.add('modal-open');
  if (typeof _sidebarDim === 'function') _sidebarDim(true);

  setTimeout(() => {
    applyToAll();
    const modalEl = document.getElementById('modal-islem');
    if (modalEl) {
      modalEl.querySelectorAll('input[type="date"]').forEach(inp => {
        if (typeof setDateInputValue === 'function') setDateInputValue(inp, inp.value);
      });
    }
  }, 90);
}

// ── Aksiyon: sistemden sil ───────────────────────────────────────

export function eeSilSistemden(j) {
  const s = EE_STATE.sadeceSistem[j];
  if (!s) return;
  // Kesinleşmiş ekstre kontrolü
  const islem = DB.islemler.find(i => i.id === s.id);
  if (islem) {
    const k = getKart(islem.kart);
    if (k) {
      const kesinlenmis = getIslemTaksitliste(islem).some(tak => {
        const pd = getExtreDonemi(k, tak.ekstreTarih);
        if (!pd) return false;
        return isEkstreKesinlesmis(k.id, `${pd.year}-${String(pd.month+1).padStart(2,'0')}`);
      });
      if (kesinlenmis) { showToast('Kesinleşmiş ekstreye ait işlem silinemez', 'error'); return; }
    }
  }
  showConfirm('Bu işlem PDF ekstrede bulunamadı. Sistemden silinsin mi?', () => {
    DB.islemler = DB.islemler.filter(x => x.id !== s.id);
    saveData();
    showToast('İşlem silindi');
    const row = document.getElementById('ee-sadecesistem-' + j);
    if (row) row.remove();
    if (typeof renderIslemler === 'function') renderIslemler();
  });
}

// ── Aksiyon: bir satırı yok say (sadece görsel olarak kaldır) ────

export function eeYokSay(grup, j) {
  const row = document.getElementById('ee-' + (grup === 'sadecePdf' ? 'sadecepdf' : 'sadecesistem') + '-' + j);
  if (row) { row.style.opacity = '0.3'; row.querySelectorAll('button,input,select').forEach(el => el.disabled = true); }
}

export function eeReset() {
  setEE_STATE({ kartId: null, pdfIslemler: [], eslesen: [], sadecePdf: [], sadeceSistem: [], dosyalar: [],
    kartOnayGosteriliyor: false, kartAutoDetectGosteriliyor: false, kartPickerGosteriliyor: false,
    sonuclarGosteriliyor: false });
  _eePendingParsed = null;
  document.getElementById('ee-pdf-input').value = '';
  document.getElementById('ee-upload-status').style.display = 'none';
  document.getElementById('ee-kart-confirm').style.display = 'none';
  document.getElementById('ee-step-results').style.display = 'none';
  document.getElementById('ee-step-results').innerHTML = '';
  const fl = document.getElementById('ee-file-list');
  if (fl) { fl.style.display = 'none'; fl.innerHTML = ''; }
}

// ═══════════════════════════════════════════════════════════
// SELECT → CHIP SİSTEMİ
// Bir <select> elemanını inline chip grubuna dönüştürür.
// Kullanım: selectToChips(selectEl, options?)
// options: { variant: 'auto'|'row'|'pill', colorSwatch: bool, teal: [val,...], danger: [val,...] }
// ═══════════════════════════════════════════════════════════

