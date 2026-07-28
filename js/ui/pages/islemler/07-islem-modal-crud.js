import { saveData } from '@core/app-core-base.js';
import { fmt, fmtMoneyCustom, localDateStr, parseTutarStr, uid } from '@core/format.js';
import { DB, FORMAT_CONFIG } from '@core/state.js';
import { populateCurrencySelects } from '@domain/doviz.js';
import { calcTaksit, getIslemTaksitliste, herhangiTaksitKesinlesmisMi } from '@domain/hesaplamalar.js';
import { _sidebarDim, phSet, showConfirm, showToast, validateRequiredFields } from '@components/modal-genel.js';
import { getMoneyInput, setDateInputValue, setMoneyInput } from '@components/money-input.js';
import { applyToAll } from '@components/mobile-nav-tema/05-tarih-input-overlay.js';
import { applyChipsToContainer, wireAllMoneyCurButtons } from '@components/select-to-chips.js';
import { _islemProvizyonManuel, set_islemProvizyonManuel, _eeOnSaveHook } from '@pages/islemler/00-state.js';
import { renderIslemAciklamaButon } from '@pages/islemler/01-aciklama-onerileri.js';
import { onIslemKartChange, onIslemTarihiChange } from '@pages/islemler/02-islem-form-degisiklikleri.js';
import { editIslemId, renderIslemler, setEditIslemId } from '@pages/islemler/03-islem-liste-render.js';
import { renderIslemKategoriChips } from '@pages/islemler/06-islem-kategori-secici.js';
import { getKart, getKartCurrencies, getKartCurrency, getKartDefaultCurrency } from '@pages/kartlar/01-kart-data.js';
import { kdRenderIslemler } from '@pages/kartlar/04-kart-detay-v1.js';
import { kd2RenderIslemler } from '@pages/kartlar/05-kart-detay-v2.js';
import { _kd2KartId, _kdKartId } from '@pages/kartlar/09-kart-altyapi.js';
import { editNakitAvans } from '@pages/krediler/02-nakit-avans.js';
import { populateKategoriSelects } from '@pages/tanimlamalar/03-kategoriler.js';
import { closeModal } from '@components/modal-genel.js';
import { register } from '@core/wrap-registry.js';
// ============================================================
// js/ui/pages/islemler/07-islem-modal-crud.js
// İşlem ekleme/düzenleme/silme modalı (ana CRUD akışı)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/islemler.js
// (49 export, 1087 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function populateIslemModal(onceSecimKartId) {
  const el = document.getElementById('islem-kart');
  el.innerHTML = DB.kartlar.map(k=>`<option value="${k.id}">${k.ad}</option>`).join('');
  phSet(el, 'Kart / Hesap seçin…', onceSecimKartId || '', '— Kart bulunamadı —');
  setDateInputValue('islem-tarih', localDateStr(new Date()));
  document.getElementById('islem-taksit').value = 1;
  setMoneyInput('islem-tutar', '');
  document.getElementById('islem-aciklama').value = '';
  renderIslemAciklamaButon();
  populateKategoriSelects();
  document.getElementById('islem-kategori').value = '';
  const katArama = document.getElementById('islem-kategori-arama');
  if(katArama) katArama.value = '';
  renderIslemKategoriChips();
  document.getElementById('islem-taksit-alanlari').innerHTML = '';
  setDateInputValue('islem-provizyon-tarihi', '');
  set_islemProvizyonManuel(false);
  document.getElementById('islem-provizyon-hint').style.display = 'none';
  setEditIslemId(null);
  document.getElementById('islem-modal-title').textContent = 'İşlem Ekle';
  // Para birimi seçeneklerini doldur
  populateCurrencySelects();
  // Seçili kartın para birimini set et
  onIslemKartChange();
  onIslemTarihiChange();
}

export function saveIslem() {
  const taksit = Math.max(1, parseInt(document.getElementById('islem-taksit').value)||1);

  // Kesinleşmiş dönem kontrolü — edit modunda
  if(editIslemId) {
    const eskiIslem = DB.islemler.find(i=>i.id===editIslemId);
    if(eskiIslem) {
      const k = getKart(eskiIslem.kart);
      // ---- Saf kontrol: js/domain/hesaplamalar.js:herhangiTaksitKesinlesmisMi ----
      const kesinlenmis = herhangiTaksitKesinlesmisMi(k, getIslemTaksitliste(eskiIslem));
      if(kesinlenmis) { showToast('Bu işlem kesinleştirilmiş bir ekstreye ait — düzenlenemez', 'error'); return; }
    }
  }
  const container = document.getElementById('islem-taksit-alanlari');
  let tutarlar = [], tarihler = [];

  if(taksit === 1) {
    const toplarTek = getMoneyInput('islem-tutar')||0;
    tutarlar = [toplarTek];
    tarihler = [document.getElementById('islem-tarih').value];
  } else {
    const tutarInputs = container.querySelectorAll('[data-islem-taksit-field="tutar"]');
    const tarihInputs = container.querySelectorAll('[data-islem-taksit-field="tarih"]');
    tutarInputs.forEach(inp => tutarlar.push(parseTutarStr(inp.value)));
    tarihInputs.forEach(inp => tarihler.push(inp.value));
  }

  const toplamTutar = tutarlar.reduce((s,t)=>s+t,0) || (getMoneyInput('islem-tutar')||0);
  const aylik = tutarlar[0] || (toplamTutar/taksit);

  const provizyonTarihi = document.getElementById('islem-provizyon-tarihi').value || null;

  // manuelTaksitler: tarih+tutar çiftleri (ilk taksite provizyon tarihi de eklenir)
  const manuelTaksitler = tutarlar.map((t,i) => ({ tarih: tarihler[i]||'', tutar: t, provizyonTarihi: i===0 ? provizyonTarihi : null }));

  const islem = {
    id: editIslemId || uid(),
    kart: document.getElementById('islem-kart').value,
    tarih: document.getElementById('islem-tarih').value,
    aciklama: document.getElementById('islem-aciklama').value.trim(),
    kategori: document.getElementById('islem-kategori').value||null,
    tutar: toplamTutar,
    taksit,
    aylik,
    taksitTutarlari: tutarlar,
    manuelTaksitler,
    provizyonTarihi,
    paraBirimi: (()=>{ const kartId=document.getElementById('islem-kart').value; const chosen=document.getElementById('islem-para-birimi').value; return getKartCurrency(kartId, chosen); })()
  };
  if(!validateRequiredFields([{id:'islem-kart',msg:'Kart seçiniz'},{id:'islem-tutar',msg:'Tutar giriniz'}])) return;

  // Yeni işlem veya edit: düşeceği dönem kesinleşmiş mi kontrol et
  if(!editIslemId) {
    const k = getKart(islem.kart);
    // ---- Saf kontrol: js/domain/hesaplamalar.js:herhangiTaksitKesinlesmisMi ----
    const kesinlenmis = herhangiTaksitKesinlesmisMi(k, getIslemTaksitliste(islem));
    if(kesinlenmis) { showToast('Bu işlem kesinleştirilmiş bir ekstreye denk geliyor — eklenemez 🔒', 'error'); return; }
  } else {
    // Edit: hem eski hem yeni halin dönemlerini kontrol et
    const k = getKart(islem.kart);
    const yeniKesinlenmis = herhangiTaksitKesinlesmisMi(k, getIslemTaksitliste(islem));
    if(yeniKesinlenmis) { showToast('Değişiklik sonrası işlem kesinleşmiş bir ekstreye denk geliyor — kaydedilemez 🔒', 'error'); return; }
  }
  if(editIslemId) {
    const idx = DB.islemler.findIndex(i=>i.id===editIslemId);
    if(idx>=0) {
      const eski = DB.islemler[idx];
      if(eski.tip) islem.tip = eski.tip;
      if(eski.nakitAvansBilgi) islem.nakitAvansBilgi = eski.nakitAvansBilgi;
      DB.islemler[idx]=islem;
    }
  } else {
    DB.islemler.push(islem);
  }
  setEditIslemId(null);
  saveData();
  // Ekstre eşleştirme hook'u (eeSistemeEkle tarafından set edilmişse)
  if (typeof _eeOnSaveHook === 'function') { _eeOnSaveHook(); }
  closeModal('modal-islem');
  renderIslemler();
  // "İşlem" modalı kart-detay popup'ının üstünde stack olarak açılmış olabilir
  // (kdYeniIslemAc / editIslem oradan tetiklenmiş olabilir) — altta hâlâ açık
  // duran kart-detay modalının işlem listesi de burada yenilenmezse yeni/düzenlenen
  // işlem o listede görünmez (kullanıcı modalı kapatıp tekrar açana kadar).
  if (_kdKartId) kdRenderIslemler();
  if (_kd2KartId) kd2RenderIslemler();
}

export function editIslem(id) {
  const i0 = DB.islemler.find(x=>x.id===id);
  if(i0 && i0.tip === 'nakitAvans') { editNakitAvans(id); return; }
  // Kesinleşmiş dönem kontrolü
  if(i0) {
    const k = getKart(i0.kart);
    // ---- Saf kontrol: js/domain/hesaplamalar.js:herhangiTaksitKesinlesmisMi ----
    const kesinlenmis = herhangiTaksitKesinlesmisMi(k, getIslemTaksitliste(i0));
    if(kesinlenmis) { showToast('Bu işlem kesinleştirilmiş bir ekstreye ait — düzenlenemez 🔒', 'error'); return; }
  }
  setEditIslemId(id);
  set_islemProvizyonManuel(true); // mevcut işlemde kayıtlı provizyon tarihi varsa otomatik öngörüyle ezilmesin
  const i = DB.islemler.find(x=>x.id===id);
  if(!i) return;
  document.getElementById('islem-modal-title').textContent = 'İşlem Düzenle';
  const el = document.getElementById('islem-kart');
  el.innerHTML = DB.kartlar.map(k=>`<option value="${k.id}">${k.ad}</option>`).join('');
  phSet(el, 'Kart / Hesap seçin…', i.kart, '— Kart bulunamadı —');
  setDateInputValue('islem-tarih', i.tarih);
  setDateInputValue('islem-provizyon-tarihi', i.provizyonTarihi || (i.manuelTaksitler && i.manuelTaksitler[0] && i.manuelTaksitler[0].provizyonTarihi) || '');
  document.getElementById('islem-provizyon-hint').style.display = 'none';
  document.getElementById('islem-aciklama').value = i.aciklama||'';
  renderIslemAciklamaButon();
  document.getElementById('islem-kategori').value = i.kategori||'';
  renderIslemKategoriChips();
  setMoneyInput('islem-tutar', i.tutar);
  document.getElementById('islem-taksit').value = i.taksit;
  const pbEl = document.getElementById('islem-para-birimi');
  if(pbEl) {
    populateCurrencySelects();
    pbEl.value = i.paraBirimi || getKartDefaultCurrency(i.kart);
    onIslemKartChange();
    // override to saved value if still valid
    const supported = getKartCurrencies(i.kart);
    if(i.paraBirimi && supported.includes(i.paraBirimi)) pbEl.value = i.paraBirimi;
  }

  // Taksit planını doldur
  const taksit = i.taksit||1;
  const tutarlar = i.taksitTutarlari || Array(taksit).fill(i.aylik||0);
  const tarihler = i.manuelTaksitler ? i.manuelTaksitler.map(t=>t.tarih) : [];

  if(taksit > 1) {
    // Önce calcTaksit ile temel planı kur, sonra mevcutları yükle
    calcTaksit(false);
    // Şimdi mevcut değerleri üzerine yaz
    const container = document.getElementById('islem-taksit-alanlari');
    const tutarInputs = container.querySelectorAll('[data-islem-taksit-field="tutar"]');
    const tarihInputs = container.querySelectorAll('[data-islem-taksit-field="tarih"]');
    tutarInputs.forEach((inp, idx) => {
      if(tutarlar[idx] !== undefined) inp.value = fmtMoneyCustom(tutarlar[idx], 2, FORMAT_CONFIG.ondalikAyrac||',', FORMAT_CONFIG.binlikAyrac??'.');
      const orig = parseFloat(inp.dataset.orig)||0;
      if(Math.abs(parseTutarStr(inp.value) - orig) > 0.01) inp.classList.add('tp-modified');
    });
    tarihInputs.forEach((inp, idx) => {
      if(tarihler[idx]) setDateInputValue(inp, tarihler[idx]);
    });
    // Toplam güncelle
    let top = 0; tutarInputs.forEach(inp => top += parseTutarStr(inp.value));
    const span = document.getElementById('islem-tp-toplam');
    if(span) span.textContent = fmt(top);
  } else {
    // Taksitsiz işlem: bir önceki düzenleme/ekleme modalından kalmış olabilecek
    // taksit panelini temizle, yoksa taksitli bir işlemden sonra açıldığında
    // eski panel ekranda kalmaya devam ediyordu.
    document.getElementById('islem-taksit-alanlari').innerHTML = '';
  }

  document.getElementById('modal-islem').classList.add('open'); document.body.classList.add('modal-open'); _sidebarDim(true);

  // Tarih input'larının görsel overlay'i (date-fake-input), editIslem modalı
  // openModal() üzerinden açmadığı için otomatik senkronize olmuyor — bu yüzden
  // burada manuel senkronize ediyoruz. onchange tetiklemeden (calcTaksit'i
  // tekrar çağırıp taksit planını sıfırlamasın diye) sadece overlay metnini güncelliyoruz.
  // Aynı nedenle chip/popup dönüşümü de (openModal()'ın patch'lediği applyChipsToContainer
  // çağrısı) burada tetiklenmiyor — modal-islem daha önce hiç "openModal" ile açılmadıysa
  // (ör. uygulama açılır açılmaz doğrudan bir işlem düzenlenirse) kart/hesap select'i popup'a
  // dönüşmeden native select olarak kalıyordu. Burada da manuel tetikliyoruz.
  setTimeout(() => {
    applyToAll();
    const modalEl = document.getElementById('modal-islem');
    if(modalEl) {
      modalEl.querySelectorAll('input[type="date"]').forEach(inp => {
        if(typeof setDateInputValue === 'function') setDateInputValue(inp, inp.value);
      });
      if(typeof applyChipsToContainer === 'function') applyChipsToContainer(modalEl);
      if(typeof wireAllMoneyCurButtons === 'function') wireAllMoneyCurButtons();
    }
  }, 90);
}

export function deleteIslem(id) {
  const islem = DB.islemler.find(i=>i.id===id);
  if(islem) {
    const k = getKart(islem.kart);
    // ---- Saf kontrol: js/domain/hesaplamalar.js:herhangiTaksitKesinlesmisMi ----
    const kesinlenmis = herhangiTaksitKesinlesmisMi(k, getIslemTaksitliste(islem));
    if(kesinlenmis) { showToast('Kesinleşmiş ekstreye ait işlem silinemez', 'error'); return; }
  }
  showConfirm('Bu işlemi silmek istiyor musunuz?', () => {
    DB.islemler = DB.islemler.filter(i=>i.id!==id);
    saveData();
    renderIslemler();
    if (_kdKartId) kdRenderIslemler();
    if (_kd2KartId) kd2RenderIslemler();
  });
}

// [ES module] eskiden window.deleteIslem = deleteIslem köprüsüydü; artık
// wrap-registry'ye register ediliyor. hesap-entegrasyon-motoru.js bu taban
// tanımı get('saveIslem')/get('deleteIslem') ile alıp kendi wrap'ini
// register eder — export binding immutable olduğu için window.X=... ile
// yapılan eski atama gerçek export'u ASLA etkilemiyordu (sessiz bug).
register('saveIslem', saveIslem);
register('deleteIslem', deleteIslem);
