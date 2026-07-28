// ============================================================
// js/core/wizard-routing.js
// "Son Transferler" widget'ı ve step-wizard modalleri (transfer,
// kira, maaş, elden, KMH/kredi, nakit avans, kredi, kart, kart-ödeme,
// abonelik, mevduat, hesap, para birimi) için URL (hash) routing.
//
// Amaç: bir wizard modalini AÇIP belirli bir ADIMA gittiğinde,
// tarayıcının adres çubuğu bunu yansıtsın (#ozet?modal=modal-transfer&step=2
// gibi) — sayfa yenilendiğinde veya link paylaşıldığında aynı modal aynı
// adımda tekrar açılabilsin. Geri/ileri tarayıcı tuşları da adımlar
// arasında gezinsin.
//
// Tasarım kararı — mevcut 13 dosyaya TEK SATIR bile dokunmadan:
//   1) MODAL AÇILIŞ/KAPANIŞ: modal-genel.js zaten iki merkezi köprü
//      barındırıyor — openModal() → call('openModal', ...) registry'sini,
//      closeModal() → setCloseModal(fn) ile değiştirilebilen bir pointer'ı
//      kullanıyor. İkisi de "gerçek, canlı, TEK export" — 13 dosyanın
//      hepsi bu ikisini import edip kullanıyor, MutationObserver'a hiç
//      gerek yok: register('openModal', ...) ve setCloseModal(...) ile
//      doğrudan hook'luyoruz.
//   2) ADIM DEĞİŞİMİ: "İleri/Geri" butonları (wizardStepNext/StepGoto)
//      DOM DEĞİL, doğrudan yerel fonksiyon referansı çağırıyor — bu yüzden
//      register() sarmalamak işe yaramıyor (ayrıntı için bkz. aşağıdaki not).
//      Bunun için MutationObserver yerine document-level CLICK delegasyonu
//      kullanıyoruz: id'si "-step-next-btn"/"-step-back-btn" ile biten bir
//      elemente tıklanınca, bir sonraki mikro-task'te (DOM güncellendikten
//      hemen sonra) o modalin güncel adımını okuyup hash'e yazıyoruz. Bu,
//      sürekli çalışan bir DOM gözlemcisinden ÇOK daha ucuz — sadece
//      gerçek tıklama anında, tek seferlik çalışır.
//   3) Modal restore edilirken (sayfa yenileme/deep-link) hangi "open"
//      fonksiyonunun çağrılacağını burada bir eşleme tablosunda tutuyoruz
//      (WIZARD_RESTORE_OPENERS). Ayrıca hash'e modalin o anki DÜZENLEME
//      id'sini de yazıyoruz (WIZARD_EDIT_SUPPORT / params.editId) — böylece
//      var olan bir kaydı düzenlerken sayfa yenilenirse de kayıp yaşanmaz:
//      restore sırasında kayıt hâlâ mevcutsa openEdit(id) ile aynı kayıt
//      düzenleme modunda tekrar açılır; kayıt silinmişse (bayat deep-link)
//      sessizce "yeni kayıt" opener'ına düşülür.
// ============================================================
import { openTransferModal } from '@components/transfer-modal.js';
import { openKiraModal, editKiraId } from '@pages/kira.js';
import { openMaasModal, editMaas, editMaasId } from '@pages/maas.js';
import { openEldenModal, editElden, editEldenId } from '@pages/elden.js';
import { openAbonelikModal, editAbonelikId } from '@pages/abonelik.js';
import { openKmhKrediModal } from '@pages/krediler/03-kmh-kredi.js';
import { openKrediModal } from '@pages/krediler/04-bireysel-kredi.js';
import { editKmhKrediId, editKrediId, editNaId } from '@pages/krediler/00-state.js';
import { openNakitAvansModal, editNakitAvans } from '@pages/krediler/02-nakit-avans.js';
import { openParaBirimiModal } from '@pages/tanimlamalar/06-para-birimi.js';
import { editParaBirimiKod } from '@pages/tanimlamalar/00-state.js';
import { openHesapModal } from '@pages/hesaplar/03-hesap-form-crud.js';
import { editHesapId } from '@pages/hesaplar/04-hesap-liste-render.js';
import { editKart } from '@pages/kartlar/01-kart-data.js';
import { editKartId, setEditKartId } from '@pages/kartlar/09-kart-altyapi.js';
import { editMevduat } from '@pages/mevduat/01-mevduat-form-wizard.js';
import { editMevduatId, setEditMevduatId } from '@pages/mevduat/00-state.js';
import { inject, provide } from '@core/container.js';
import { openModal, getCloseModal, setCloseModal } from '@components/modal-genel.js';
import { getMoneyInput, setMoneyInput, setDateInputValue } from '@components/money-input.js';

// core.state ve core.wrapRegistry zaten container'da kayıtlı (Tur 1) —
// inject() ile çözülüyor. DB SADECE OKUNUYOR burada (findRecord sorguları),
// hiçbir yerde `=` ile atanmıyor — bkz. DI-MIGRATION.md kritik kural.
const _coreState = inject('core.state');
const DB = new Proxy({}, { get(_t, prop){ return _coreState.DB[prop]; } });
const _wrapRegistry = inject('core.wrapRegistry');
const register = (...a) => _wrapRegistry.register(...a);
const get = (...a) => _wrapRegistry.get(...a);
// NOT: _currentHashPage/_currentHashParams/_pushHashState burada import
// EDİLMİYOR — init.js zaten wizard-routing.js'i import ediyor; ters yönde
// bir import döngüsel bağımlılık yaratıp script sıralamasına gereksiz
// hassasiyet katardı. Bu üç yardımcı zaten çok basit (location.hash okuma/
// history.pushState) olduğu için burada bağımsız birer kopyası tutuluyor.
function _wrCurrentHashPage() {
  return (location.hash.replace('#', '').split('?')[0]) || 'ozet';
}
function _wrCurrentHashParams() {
  const qIdx = location.hash.indexOf('?');
  if (qIdx < 0) return {};
  const qs = location.hash.slice(qIdx + 1);
  const params = {};
  qs.split('&').forEach(pair => {
    const [k, v] = pair.split('=').map(decodeURIComponent);
    if (k) params[k] = v || '';
  });
  return params;
}
function _wrPushHashState(page, params) {
  let hash = '#' + page;
  const parts = [];
  Object.entries(params || {}).forEach(([k, v]) => { if (v != null && v !== '') parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); });
  if (parts.length) hash += '?' + parts.join('&');
  if (location.hash !== hash) {
    try { history.pushState({ page, params }, '', hash); }
    catch (e) { location.hash = hash.slice(1); }
  }
}
// Form alanı senkronu için: her tuş vuruşunda pushState çağırmak tarayıcı
// geçmişini spam'ler (geri tuşu harf harf geri gider gibi tuhaf bir deneyime
// yol açar). Bu yüzden form verisi güncellemesi replaceState kullanır — aynı
// geçmiş girişini günceller, yeni giriş EKLEMEZ. Adım (step) değişimi ise
// hâlâ pushState kullanır (_wrPushHashState) — geri tuşuyla bir önceki adıma
// dönebilmek kullanıcı için mantıklı bir davranış.
function _wrReplaceHashState(page, params) {
  let hash = '#' + page;
  const parts = [];
  Object.entries(params || {}).forEach(([k, v]) => { if (v != null && v !== '') parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); });
  if (parts.length) hash += '?' + parts.join('&');
  if (location.hash !== hash) {
    try { history.replaceState({ page, params }, '', hash); }
    catch (e) { location.hash = hash.slice(1); }
  }
}

// ── 0) Form alanlarını serialize/restore etme (jenerik, tüm 13 modal için) ──
// Her modalin kendi HTML'ine/JS'ine dokunmadan, modal kökü içindeki TÜM
// input/select/textarea elemanlarını id'leriyle tarayıp değerlerini
// topluyoruz. Böylece kullanıcı formu doldurdukça hash otomatik güncellenir
// ve F5 sonrası aynı adımda, aynı verilerle devam edilebilir.
//
// Kapsam dışı bırakılanlar:
//   - id'si olmayan elemanlar (hedefe geri yazılamaz, atlanır)
//   - [data-no-hash-restore] işaretli elemanlar (gerekirse ileride bir
//     modal kendi hassas/geçici alanını hariç tutmak isterse diye)
//   - readonly/disabled input'lar (genelde hesaplanmış/salt-okunur alanlar)
const FORM_FIELD_SELECTOR = 'input:not([data-no-hash-restore]):not([readonly]):not([disabled]), select:not([data-no-hash-restore]):not([disabled]), textarea:not([data-no-hash-restore]):not([disabled])';

function _wrSerializeModalForm(modalEl) {
  const data = {};
  if (!modalEl) return data;
  modalEl.querySelectorAll(FORM_FIELD_SELECTOR).forEach(el => {
    if (!el.id) return;
    if (el.type === 'checkbox' || el.type === 'radio') {
      data[el.id] = el.checked ? '1' : '0';
    } else if (el.classList.contains('money-input')) {
      data[el.id] = String(getMoneyInput(el.id));
    } else {
      const v = el.value;
      if (v) data[el.id] = v; // boş alanları hash'te taşımaya gerek yok
    }
  });
  return data;
}

function _wrRestoreModalForm(modalEl, data) {
  if (!modalEl || !data) return;
  Object.keys(data).forEach(id => {
    const el = modalEl.querySelector('#' + CSS.escape(id));
    if (!el) return;
    const val = data[id];
    if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = val === '1';
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el.classList.contains('money-input')) {
      setMoneyInput(el.id, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (el.type === 'date') {
      setDateInputValue(el, val);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el.tagName === 'SELECT') {
      el.value = val;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

// Kullanıcı formu doldurdukça (input/change) hash'i güncel form verisiyle
// senkron tut. Tek bir document-level delegasyon — 13 modalin hiçbirine
// ayrı ayrı listener eklemeye gerek yok. debounce: her tuş vuruşunda değil,
// 300ms sessizlikten sonra hash'e yazılır (history.pushState'i spam'lememek için).
function _wrDoFormSync(modalId) {
  if (_wrRestoring) return; // restore süresince form senkronu tetiklenmesin
  const curParams = _wrCurrentHashParams();
  if (curParams.modal !== modalId) return; // hash zaten başka bir şeyi gösteriyor
  const modalEl = document.getElementById(modalId);
  if (!modalEl || !modalEl.classList.contains('open')) return;
  const formData = _wrSerializeModalForm(modalEl);
  curParams.form = Object.keys(formData).length ? JSON.stringify(formData) : '';
  if (!curParams.form) delete curParams.form;
  _wrReplaceHashState(_wrCurrentHashPage() || 'ozet', curParams);
}
let _wrFormSyncT = null;
function _wrScheduleFormSync(modalId) {
  if (_wrRestoring) return; // restore süresince form senkronu tetiklenmesin
  clearTimeout(_wrFormSyncT);
  _wrFormSyncT = setTimeout(() => _wrDoFormSync(modalId), 300);
}
// tekrarlaTransfer gibi, alanları event dispatch ETMEDEN doğrudan .value=
// ile dolduran işlemler için: debounce beklemeden hemen senkronla (tek
// tıklamayla tetiklenen, tek seferlik bir işlem olduğu için 300ms'lik
// debounce'a gerek yok — zaten arka arkaya tetiklenmeyecek).
function _wrScheduleFormSyncImmediate(modalId) {
  clearTimeout(_wrFormSyncT);
  _wrDoFormSync(modalId);
}
document.addEventListener('input', e => {
  const modalBg = e.target.closest('.modal-bg.open');
  if (modalBg && modalBg.id && WIZARD_RESTORABLE_MODAL_IDS.includes(modalBg.id)) _wrScheduleFormSync(modalBg.id);
});
document.addEventListener('change', e => {
  const modalBg = e.target.closest('.modal-bg.open');
  if (modalBg && modalBg.id && WIZARD_RESTORABLE_MODAL_IDS.includes(modalBg.id)) _wrScheduleFormSync(modalBg.id);
});


// Her restore edilebilir modal için EDİT desteği:
//   getEditId()   → o an modalin "düzenleme" state'inde tuttuğu id/kod (yoksa null/'')
//   findRecord(id)→ o id'ye ait kayıt DB'de var mı (silinmişse restore "yeni kayıt"a düşer)
//   openEdit(id)  → kaydı düzenleme modunda açan fonksiyon (id'li opener)
// modal-transfer'ın kalıcı bir "kayıt"ı olmadığı (geçmiş işlem, düzenlenmez)
// için burada YOK — sadece yeni-transfer akışı restore edilir.
const WIZARD_EDIT_SUPPORT = {
  'modal-kira':        { getEditId: () => editKiraId,        findRecord: id => (DB.kiralar||[]).find(x=>x.id===id),        openEdit: id => openKiraModal(id) },
  'modal-maas':        { getEditId: () => editMaasId,        findRecord: id => (DB.maaslar||[]).find(x=>x.id===id),        openEdit: id => editMaas(id) },
  'modal-elden':       { getEditId: () => editEldenId,       findRecord: id => (DB.eldenler||[]).find(x=>x.id===id),       openEdit: id => editElden(id) },
  'modal-abonelik':    { getEditId: () => editAbonelikId,    findRecord: id => (DB.abonelikler||[]).find(x=>x.id===id),    openEdit: id => openAbonelikModal(id) },
  'modal-kmhkredi':    { getEditId: () => editKmhKrediId,    findRecord: id => (DB.krediler||[]).find(x=>x.id===id),       openEdit: id => openKmhKrediModal(id) },
  'modal-kredi':       { getEditId: () => editKrediId,       findRecord: id => (DB.krediler||[]).find(x=>x.id===id),       openEdit: id => openKrediModal(id) },
  'modal-nakit-avans': { getEditId: () => editNaId,          findRecord: id => (DB.islemler||[]).find(x=>x.id===id),       openEdit: id => editNakitAvans(id) },
  'modal-para-birimi': { getEditId: () => editParaBirimiKod, findRecord: kod => (DB.paraBirimleri||[]).find(x=>x.kod===kod), openEdit: kod => openParaBirimiModal(kod) },
  'modal-hesap':       { getEditId: () => editHesapId,       findRecord: id => (DB.hesaplar||[]).find(x=>x.id===id),       openEdit: id => openHesapModal(id) },
  'modal-kart':        { getEditId: () => editKartId,        findRecord: id => (DB.kartlar||[]).find(x=>x.id===id),        openEdit: id => editKart(id) },
  'modal-mevduat':     { getEditId: () => editMevduatId,      findRecord: id => (DB.mevduatlar||[]).find(x=>x.id===id),     openEdit: id => editMevduat(id) },
};

// modal-mevduat ve modal-kart-odeme kasıtlı olarak burada YOK: zaten genel
// openModal(id) ile açılabiliyor (bkz. modal-genel.js:_openModalBase), ayrı
// bir "open" fonksiyonuna gerek yok; edit ayrımı zaten o mekanizmanın içinde.
export const WIZARD_RESTORE_OPENERS = {
  'modal-transfer':     () => openTransferModal(),
  'modal-kira':         () => openKiraModal(),
  'modal-maas':         () => openMaasModal(),
  'modal-elden':        () => openEldenModal(),
  'modal-abonelik':     () => openAbonelikModal(),
  'modal-kmhkredi':     () => openKmhKrediModal(),
  'modal-kredi':        () => openKrediModal(),
  'modal-nakit-avans':  () => openNakitAvansModal(),
  'modal-para-birimi':  () => openParaBirimiModal(),
  'modal-hesap':        () => openHesapModal(),
  'modal-kart':         () => { setEditKartId(null); openModal('modal-kart'); },
  'modal-mevduat':      () => { setEditMevduatId(null); openModal('modal-mevduat'); },
  'modal-kart-odeme':   () => openModal('modal-kart-odeme'),
};

// Restore edilebilir tüm modaller (init.js'deki RESTORABLE_MODALS'a
// eklenecek isim listesi — orada da bu diziye referans veriliyor).
export const WIZARD_RESTORABLE_MODAL_IDS = Object.keys(WIZARD_RESTORE_OPENERS);
// init.js BU DEĞERİ DOĞRUDAN import ETMİYOR (döngüsel import riski —
// modal-genel.js zaten init.js'i import ediyor, wizard-routing.js de
// modal-genel.js'i import ediyor; init.js bir de wizard-routing.js'i import
// ederse üçlü döngü oluşup TDZ hatalarına yol açıyordu). Bunun yerine
// registry üzerinden okunuyor. register() sadece FONKSİYON kabul ettiği
// için (bkz. wrap-registry.js) diziyi doğrudan değil, diziyi döndüren bir
// getter fonksiyonu kaydediyoruz: get('WIZARD_RESTORABLE_MODAL_IDS')().
register('WIZARD_RESTORABLE_MODAL_IDS', () => WIZARD_RESTORABLE_MODAL_IDS);

// RESTORE MODU: restoreWizardModalFromHash() çalışırken, opener() fonksiyonu
// (örn. openTransferModal()) kendi içinde openModal('modal-transfer')'ı
// çağırır — bu da BİZİM sarmaladığımız openModal hook'unu tetikler. Eğer bu
// hook o an hash'e yazarsa, DOM'da step henüz 1'deyken (stepNext() ile
// ilerletmeden ÖNCE) hash'teki doğru step=N değerini step=1'e DÜŞÜRÜR —
// gerçek bir bug. _wrRestoring bayrağı, restore süresince tüm hash-yazma
// yan etkilerini (openModal hook + step click delegasyonu, ki restore
// stepNext() gerçek tıklama olmadığı için zaten tetiklenmez ama garanti
// olsun diye) susturur; restore bitince hash'i biz kendimiz, tek seferde,
// DOM'daki GERÇEK son durumla senkronlarız.
let _wrRestoring = false;

// ── 1) Aktif adımı hash ile senkron tut — click delegasyonu ─────────────
// İLK TASARIM (terk edildi): registry sarmalama — çalışmadı, çünkü
// "İleri/Geri" butonları wizardStepNext/StepGoto'yu registry üzerinden
// değil, doğrudan import edilen fonksiyon referansı üzerinden çağırıyor
// (bkz. js/core/onclick-bootstrap.js).
// İKİNCİ TASARIM (terk edildi): MutationObserver ile `.swiz-step-panel`
// class değişimini izlemek. Çalışıyordu ama 12 modal için sürekli DOM
// gözlemi (subtree:true) kurmak fark edilir CPU/pil maliyeti yaratıyordu.
// GÜNCEL TASARIM: adım butonlarının id'leri tutarlı bir örüntü izliyor
// (`<prefix>-step-next-btn`, `<prefix>-step-back-btn`) ve step-dot'lar da
// ortak bir `.swiz-step-dot-wrap` class'ı taşıyor — hepsi normal DOM
// tıklamaları. Tek bir document-level click listener ile — tıpkı form-sync
// için zaten kullandığımız desenle — bunlardan birine tıklanınca, DOM
// güncellendikten hemen sonra (setTimeout 0) o modalin güncel adımını
// `.swiz-step-panel.is-active` üzerinden okuyup hash'e yazıyoruz. Bu, sürekli
// çalışan bir gözlemciden ÇOK daha ucuz — sadece gerçek tıklama anında.
function _wrGetActiveStepFromDom(modalEl) {
  const activePanel = modalEl.querySelector('.swiz-step-panel.is-active[data-step-panel]');
  return activePanel ? Number(activePanel.dataset.stepPanel) : 1;
}

function _wrSyncStepToHash(modalId) {
  if (_wrRestoring) return; // restore süresince hash'i biz kendimiz yöneteceğiz
  const modalEl = document.getElementById(modalId);
  if (!modalEl || !modalEl.classList.contains('open')) return;
  const curParams = _wrCurrentHashParams();
  if (curParams.modal !== modalId) return; // hash zaten başka bir şeyi gösteriyor
  const step = _wrGetActiveStepFromDom(modalEl);
  // Edit modunda mıyız? (varsa) editId'yi hash'e ekliyoruz ki F5/deep-link
  // sonrası aynı KAYDI düzenlemeye devam edilebilsin. Yeni kayıt modundaysa
  // (getEditId() null/'' döner) editId hash'ten çıkarılır.
  const editSupport = WIZARD_EDIT_SUPPORT[modalId];
  const editId = editSupport ? editSupport.getEditId() : null;
  const editIdStr = (editId != null && editId !== '') ? String(editId) : '';
  const changed = curParams.step !== String(step) || (curParams.editId || '') !== editIdStr;
  if (!changed) return; // değişiklik yok, gereksiz history girişi açma
  curParams.step = String(step);
  if (editIdStr) curParams.editId = editIdStr; else delete curParams.editId;
  _wrPushHashState(_wrCurrentHashPage() || 'ozet', curParams);
}

document.addEventListener('click', e => {
  const btn = e.target.closest('[id$="-step-next-btn"], [id$="-step-back-btn"], .swiz-step-dot-wrap');
  if (!btn) return;
  const modalBg = btn.closest('.modal-bg');
  if (!modalBg || !modalBg.id || !WIZARD_RESTORABLE_MODAL_IDS.includes(modalBg.id)) return;
  // setTimeout(0): tıklamayı işleyen asıl handler (transferStepNext vb.)
  // önce çalışıp DOM'u (is-active class'larını) güncellesin, biz ondan
  // SONRA okuyalım. Aynı event loop turunda "sonraki task" olarak sıraya girer.
  setTimeout(() => _wrSyncStepToHash(modalBg.id), 0);
});

// "Son Transferler" widget'ındaki "tekrarla" butonu (rf-transfer-tekrar-btn,
// bkz. transfer-log.js) transferStepGoto(1)'i çağırıp transfer-kaynak/
// transfer-hedef/transfer-tutar/transfer-tarih/transfer-aciklama alanlarını
// DOĞRUDAN `el.value = ...` ile dolduruyor (bkz. transfer-modal.js:
// tekrarlaTransfer) — hiçbir input/change event'i dispatch ETMİYOR. Bizim
// form-sync mekanizmamız (aşağıdaki "0) Form alanları" bölümü) input/change
// event delegasyonuna dayandığı için bu dolduruşu hiç yakalayamıyor ve hash
// boş kalıyor. Bu yüzden bu butona özel bir click sonrası manuel senkron
// tetikliyoruz — DOM'un dolmasını bekleyip (setTimeout 0) formu kendimiz
// serialize edip hash'e yazıyoruz.
document.addEventListener('click', e => {
  const btn = e.target.closest('.rf-transfer-tekrar-btn');
  if (!btn) return;
  setTimeout(() => {
    // "Son Transferler" transfer modalinin İÇİNDE değil, ayrı bir widget'ta
    // (transfer-log.js) yaşıyor ama tekrarlaTransfer() zaten modal-transfer'i
    // dolduruyor — modal o an açık olmalı (widget zaten modal içinde).
    _wrScheduleFormSyncImmediate('modal-transfer');
  }, 0);
});

// ── 2) Modal açılış/kapanışını hash ile senkron tut ──────────────────────
// modal-genel.js'nin kendi merkezi köprülerini (openModal → registry,
// closeModal → setCloseModal pointer'ı) kullanıyoruz — 13 dosyanın hepsi
// zaten bunları import ediyor, MutationObserver'a hiç gerek yok.

// Modal kapandığında hash'teki step/form parametrelerini temizle.
// closeModal() (aşağıdaki sarmalama) zaten curParams.modal'ı siliyor
// (closeModalBase içinde) ama step/form'dan haberi yok (bu ikisi
// wizard-routing.js'e özgü) — burada tamamlıyoruz.
function _wrSyncCloseToHash(modalId) {
  if (_wrRestoring) return; // restore süresince hash'i biz kendimiz yöneteceğiz
  const curParams = _wrCurrentHashParams();
  // closeModalBase() (modal-genel.js) zaten curParams.modal'ı silip hash'i
  // güncellemiş olabilir (biz onu SARMALADIĞIMIZ için, bu her zaman ÖNCE
  // çalışır — _wrBaseCloseModal(id) çağrısı aşağıda synchronous olarak
  // tamamlanmış olur). Yani curParams.modal burada normal şartlarda zaten
  // boştur; step/form varsa bu modalId'ye ait kalıntıdır, temizleriz.
  //   a) curParams.modal hâlâ modalId  → (teorik olarak olmamalı ama) sileriz.
  //   b) curParams.modal boş/undefined → kalıntı varsa bize aittir, temizleriz.
  //   c) curParams.modal BAŞKA bir id  → başka modalin state'i, dokunma.
  if (curParams.modal && curParams.modal !== modalId) return;
  if (!curParams.step && !curParams.form && !curParams.editId && !curParams.modal) return; // zaten tertemiz
  delete curParams.step;
  delete curParams.form;
  delete curParams.editId;
  delete curParams.modal;
  _wrPushHashState(_wrCurrentHashPage() || 'ozet', curParams);
}

// select-to-chips.js'deki AYNI güvenli desen: modal-genel.js kendi içinde
// register('openModal', _openModalBase) çağırıyor — bu bizden ÖNCE
// çalışmamış olabilir (script/import sırası garanti değil). get('openModal')
// henüz undefined ise, _wrBaseOpenModal'ı YANLIŞLIKLA openModal'ın kendisine
// eşitlemek sonsuz döngü yaratırdı (openModal zaten call('openModal',...)'a
// yönleniyor — o zaman bizim wrapper'ımız kendi kendini çağırırdı). Bunun
// yerine taban kayıt gelene kadar kısa aralıklarla tekrar deniyoruz.
(function installOpenModalHook() {
  const base = get('openModal');
  if (typeof base !== 'function') { setTimeout(installOpenModalHook, 20); return; }
  register('openModal', function(...args) {
    const r = base(...args);
    const modalId = args[0];
    if (WIZARD_RESTORABLE_MODAL_IDS.includes(modalId)) {
      // Modal içeriği (select doldurma vb.) openXModal() içinde openModal()'dan
      // ÖNCE tamamlanmış olur (bkz. örn. openTransferModal), bu yüzden burada
      // ekstra bekleme gerekmiyor — sadece açılış anındaki adımı (genelde 1)
      // hash'e yazıyoruz.
      setTimeout(() => _wrSyncStepToHash(modalId), 0);
    }
    return r;
  });
})();

// AYNI döngüsel-import riski closeModal için de geçerli: modal-genel.js
// kendi içinde init.js'i import ediyor, init.js de (RESTORABLE_MODALS için)
// wizard-routing.js'i import ediyor — yani modal-genel.js → init.js →
// wizard-routing.js → modal-genel.js döngüsü oluşuyor. Bu döngüde
// getCloseModal()'ı DOĞRUDAN, modül seviyesinde çağırmak, modal-genel.js'in
// `let _currentCloseModal = closeModalBase;` satırı henüz ÇALIŞMADAN
// erişmeye çalışıp "Cannot access before initialization" (TDZ) hatası
// fırlatabiliyordu. openModal hook'unda kullandığımız güvenli retry
// desenini burada da uyguluyoruz.
(function installCloseModalHook() {
  let base;
  try { base = getCloseModal(); } catch (e) { setTimeout(installCloseModalHook, 20); return; }
  if (typeof base !== 'function') { setTimeout(installCloseModalHook, 20); return; }
  setCloseModal(function(id) {
    const r = base(id);
    if (WIZARD_RESTORABLE_MODAL_IDS.includes(id)) _wrSyncCloseToHash(id);
    return r;
  });
})();

// ── 3) Modal + step restore ───────────────────────────────────────────
// init.js:navigateToHash() tarafından çağrılır. params.modal bu dosyadaki
// WIZARD_RESTORE_OPENERS'da varsa modalini açar, ardından params.step
// verilmişse (ve 1'den büyükse) o adıma VALİDASYONLU şekilde gider.
//
// ÖNEMLİ: Doğrudan wizardStepGoto(step) ile hedef adıma zıplamıyoruz —
// bu, aradaki adımların (kaynak/hedef seçimi, tutar girişi vb.) hiç
// doldurulmamış olmasına rağmen kullanıcıyı "özet" adımına götürüp boş/
// geçersiz bir onay ekranı gösterebilirdi. Bunun yerine 01-mobil-nav.js'deki
// step-dot tıklama mantığıyla AYNI deseni kullanıyoruz: wizardStepNext'i
// sırayla çağırıp her adımın kendi validasyonundan geçiyoruz. Bir adımda
// validasyon başarısız olursa (zorunlu alan boş, tutar 0, vb.) mevcut adım
// değişmez, döngü orada durur ve kullanıcı o adımın kendi hata mesajını görür
// — hash de artık gerçekte durduğu adımı yansıtır (bir sonraki
// wizardStepGoto/hash-wrap çağrısında güncellenir).
export function restoreWizardModalFromHash(params) {
  if (!params || !params.modal) return false;
  const opener = WIZARD_RESTORE_OPENERS[params.modal];
  if (!opener) return false;
  // EDİT MODU: hash'te editId varsa, ilgili kaydın DB'de hâlâ var olduğunu
  // doğrulayıp openEdit(id) ile düzenleme moduna geçiyoruz. Kayıt silinmişse
  // (deep-link bayatlamışsa) sessizce "yeni kayıt" opener'ına düşüyoruz —
  // kullanıcıya hatalı/boş bir düzenleme ekranı göstermek yerine.
  let effectiveOpener = opener;
  const editSupport = WIZARD_EDIT_SUPPORT[params.modal];
  if (params.editId && editSupport) {
    const record = editSupport.findRecord(params.editId);
    if (record) {
      effectiveOpener = () => editSupport.openEdit(params.editId);
    } else {
      console.warn('[wizard-routing] editId için kayıt bulunamadı, yeni kayıt modunda açılıyor', params.modal, params.editId);
    }
  }
  _wrRestoring = true;
  try { effectiveOpener(); }
  catch (e) { console.warn('[wizard-routing] restore açılış hatası', params.modal, e); _wrRestoring = false; return false; }
  const targetStep = Number(params.step);
  setTimeout(() => {
    try {
      const modalEl = document.getElementById(params.modal);
      // Önce form verilerini geri yükle (step ilerlemesi bunlara bakarak
      // validasyondan geçecek) — sonra hedef adıma doğru validasyonlu ilerle.
      if (params.form) {
        try {
          const formData = JSON.parse(params.form);
          _wrRestoreModalForm(modalEl, formData);
        } catch (e) { console.warn('[wizard-routing] form restore hatası', params.modal, e); }
      }
      if (targetStep > 1) {
        const getCurrent = get('wizardCurrentStep:' + params.modal);
        const stepNext = get('wizardStepNext:' + params.modal);
        if (typeof getCurrent === 'function' && typeof stepNext === 'function') {
          let guard = 0;
          while (getCurrent() < targetStep && guard < 50) {
            const before = getCurrent();
            stepNext();
            if (getCurrent() === before) break; // validasyon başarısız oldu, olduğu adımda kal
            guard++;
          }
        }
      }
    } catch (e) {
      console.warn('[wizard-routing] restore step/form hatası', params.modal, e);
    } finally {
      // Restore tamamlandı (başarılı ya da hatalı) — bayrağı HER KOŞULDA
      // indiriyoruz; aksi halde bir hata _wrRestoring'i sonsuza kadar true
      // bırakır ve o andan sonra hiçbir hash senkronu çalışmaz.
      _wrRestoring = false;
      _wrSyncStepToHash(params.modal);
    }
  }, 60);
  return true;
}

// init.js'in döngüsel import olmadan erişebilmesi için registry'ye de
// kaydediyoruz (bkz. yukarıdaki WIZARD_RESTORABLE_MODAL_IDS notu).
register('restoreWizardModalFromHash', restoreWizardModalFromHash);

// ============================================================
// DUAL-MODE CONTAINER KAYDI (bkz. DI-MIGRATION.md)
// @components/*, @pages/* importları HENÜZ silinmedi (ui katmanı henüz
// taşınmadı).
// ============================================================
provide('core.wizardRouting', {
  WIZARD_RESTORE_OPENERS, WIZARD_RESTORABLE_MODAL_IDS, restoreWizardModalFromHash,
});
