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
//   1) Adım değişimini YAKALAMAK için register() sarmalamayı DENEDİK ama
//      bu çalışmadı — "İleri/Geri" butonları stepNext/stepGoto'yu registry
//      üzerinden değil doğrudan çağırıyor (bkz. aşağıdaki uzun not).
//      Onun yerine her modalin `.swiz-step-panel.is-active` DOM class'ını
//      MutationObserver ile izliyoruz; bu class hangi kod yolundan
//      tetiklenirse tetiklensin her zaman güncelleniyor.
//   2) Modal restore edilirken (sayfa yenileme/deep-link) hangi "open"
//      fonksiyonunun çağrılacağını burada bir eşleme tablosunda tutuyoruz.
//      Sadece id GEREKTİRMEYEN (yeni kayıt) açılışlar restore edilir —
//      var olan bir kaydı düzenlerken sayfa yenilenirse form kaybolur;
//      bu, modal-genel.js'deki "Yeni kayıt formları restore edilmez"
//      kuralıyla tutarlı bir davranış.
// ============================================================
import { openTransferModal } from '../ui/components/transfer-modal.js';
import { openKiraModal } from '../ui/pages/kira.js';
import { openMaasModal } from '../ui/pages/maas.js';
import { openEldenModal } from '../ui/pages/elden.js';
import { openAbonelikModal } from '../ui/pages/abonelik.js';
import { openKmhKrediModal } from '../ui/pages/krediler/03-kmh-kredi.js';
import { openKrediModal } from '../ui/pages/krediler/04-bireysel-kredi.js';
import { openNakitAvansModal } from '../ui/pages/krediler/02-nakit-avans.js';
import { openParaBirimiModal } from '../ui/pages/tanimlamalar/06-para-birimi.js';
import { openHesapModal } from '../ui/pages/hesaplar/03-hesap-form-crud.js';
import { openModal } from '../ui/components/modal-genel.js';
import { get } from './wrap-registry.js';
import { getMoneyInput, setMoneyInput, setDateInputValue } from '../ui/components/money-input.js';
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
let _wrFormSyncT = null;
function _wrScheduleFormSync(modalId) {
  clearTimeout(_wrFormSyncT);
  _wrFormSyncT = setTimeout(() => {
    const curParams = _wrCurrentHashParams();
    if (curParams.modal !== modalId) return; // hash zaten başka bir şeyi gösteriyor
    const modalEl = document.getElementById(modalId);
    if (!modalEl || !modalEl.classList.contains('open')) return;
    const formData = _wrSerializeModalForm(modalEl);
    curParams.form = Object.keys(formData).length ? JSON.stringify(formData) : '';
    if (!curParams.form) delete curParams.form;
    _wrReplaceHashState(_wrCurrentHashPage() || 'ozet', curParams);
  }, 300);
}
document.addEventListener('input', e => {
  const modalBg = e.target.closest('.modal-bg.open');
  if (modalBg && modalBg.id && WIZARD_RESTORABLE_MODAL_IDS.includes(modalBg.id)) _wrScheduleFormSync(modalBg.id);
});
document.addEventListener('change', e => {
  const modalBg = e.target.closest('.modal-bg.open');
  if (modalBg && modalBg.id && WIZARD_RESTORABLE_MODAL_IDS.includes(modalBg.id)) _wrScheduleFormSync(modalBg.id);
});


// modal-kart, modal-mevduat ve modal-kart-odeme kasıtlı olarak burada YOK:
// - modal-kart: düzenleme/yeni ayrımı editKartId global'ine bağlı, deep-link
//   ile karışmasın diye kapsam dışı bırakıldı.
// - modal-mevduat / modal-kart-odeme: zaten genel openModal(id) ile açılabiliyor
//   (bkz. modal-genel.js:_openModalBase), ayrı bir "open" fonksiyonuna gerek yok.
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
  'modal-mevduat':      () => openModal('modal-mevduat'),
  'modal-kart-odeme':   () => openModal('modal-kart-odeme'),
};

// Restore edilebilir tüm modaller (init.js'deki RESTORABLE_MODALS'a
// eklenecek isim listesi — orada da bu diziye referans veriliyor).
export const WIZARD_RESTORABLE_MODAL_IDS = Object.keys(WIZARD_RESTORE_OPENERS);

// ── 1) Aktif adımı hash ile senkron tut — MutationObserver tabanlı ──────
// İLK TASARIM (artık terk edildi): registry'deki wizardStepGoto:X /
// wizardStepNext:X kayıtlarını sarmalayıp üzerine hash-yazma davranışı
// eklemek. BU YAKLAŞIM ÇALIŞMADI çünkü modallerin "İleri/Geri" butonları
// (bkz. js/core/onclick-bootstrap.js, örn. transfer-step-next-btn) bu
// fonksiyonları registry'nin call() fonksiyonu ÜZERİNDEN değil, import
// edilen fonksiyon referansını DOĞRUDAN çağırıyor. register() sadece
// registry'deki referansı değiştirir — modülün kendi local fonksiyon
// referansına ya da onu doğrudan tutan başka bir dosyaya dokunamaz. Yani
// sarmalama hiç tetiklenmiyordu.
//
// GERÇEK ÇÖZÜM: step-wizard.js:swizUpdateStepIndicator(modal, step), hangi
// fonksiyon (call() ile mi, doğrudan mı) tetiklerse tetiklesin HER ZAMAN
// modal içindeki `.swiz-step-panel[data-step-panel]` elemanlarına
// `is-active` class'ını ekleyip çıkarıyor. Bu, "şu an hangi adımdayız"
// sorusuna DOM üzerinden %100 güvenilir cevap veren tek sinyal. Bu yüzden
// fonksiyon çağrılarını sarmalamak yerine, her restorabilir modal için bu
// class değişimini MutationObserver ile izliyoruz — hangi kod yolu adımı
// değiştirirse değiştirsin yakalanır.
const _wrStepObservers = new Map();

function _wrGetActiveStepFromDom(modalEl) {
  const activePanel = modalEl.querySelector('.swiz-step-panel.is-active[data-step-panel]');
  return activePanel ? Number(activePanel.dataset.stepPanel) : 1;
}

function _wrSyncStepToHash(modalId, modalEl) {
  console.log('[wizard-routing DEBUG] _wrSyncStepToHash çağrıldı', modalId, 'open?', modalEl.classList.contains('open'));
  if (!modalEl.classList.contains('open')) return;
  const curParams = _wrCurrentHashParams();
  console.log('[wizard-routing DEBUG] curParams.modal:', curParams.modal, 'beklenen:', modalId);
  if (curParams.modal !== modalId) return; // hash zaten başka bir şeyi gösteriyor
  const step = _wrGetActiveStepFromDom(modalEl);
  console.log('[wizard-routing DEBUG] tespit edilen step:', step);
  if (curParams.step === String(step)) return; // değişiklik yok, gereksiz history girişi açma
  curParams.step = String(step);
  _wrPushHashState(_wrCurrentHashPage() || 'ozet', curParams);
  console.log('[wizard-routing DEBUG] hash güncellendi, yeni hash:', location.hash);
}

function _wrObserveStepsForModal(modalId) {
  if (_wrStepObservers.has(modalId)) return; // zaten izleniyor
  const modalEl = document.getElementById(modalId);
  if (!modalEl) { console.warn('[wizard-routing DEBUG] modal bulunamadı:', modalId); return; }
  const obs = new MutationObserver(muts => {
    console.log('[wizard-routing DEBUG] mutation tetiklendi', modalId, muts.map(m => m.target.className));
    // Sadece .swiz-step-panel üzerindeki class değişimleriyle ilgileniyoruz
    const relevant = muts.some(m => m.target.classList && m.target.classList.contains('swiz-step-panel'));
    console.log('[wizard-routing DEBUG] relevant?', relevant);
    if (relevant) _wrSyncStepToHash(modalId, modalEl);
  });
  obs.observe(modalEl, { attributes: true, attributeFilter: ['class'], subtree: true });
  _wrStepObservers.set(modalId, obs);
  console.log('[wizard-routing DEBUG] observer kuruldu:', modalId);
}

function installHashRoutingForAllWizards() {
  console.log('[wizard-routing DEBUG] installHashRoutingForAllWizards çalıştı, modaller:', WIZARD_RESTORABLE_MODAL_IDS);
  WIZARD_RESTORABLE_MODAL_IDS.forEach(modalId => _wrObserveStepsForModal(modalId));
}

// DOM parse sırasına göre modal elemanları script çalıştığında zaten
// mevcut olmalı (modal HTML'leri index.html'de bu script tag'inden önce
// duruyor) ama DOMContentLoaded'ı beklemek ekstra güvenlik sağlıyor —
// document.readyState kontrolü, bu modül zaten geç yüklendiyse (DOM
// hazırsa) event'i asla ateşlemeyen bir bekleyişe düşmemek için.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installHashRoutingForAllWizards, { once: true });
} else {
  installHashRoutingForAllWizards();
}

// ── 2) Modal + step restore ───────────────────────────────────────────
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
  try { opener(); } catch (e) { console.warn('[wizard-routing] restore açılış hatası', params.modal, e); return false; }
  const targetStep = Number(params.step);
  setTimeout(() => {
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
      if (typeof getCurrent !== 'function' || typeof stepNext !== 'function') return;
      let guard = 0;
      while (getCurrent() < targetStep && guard < 50) {
        const before = getCurrent();
        stepNext();
        if (getCurrent() === before) break; // validasyon başarısız oldu, olduğu adımda kal
        guard++;
      }
    }
  }, 60);
  return true;
}
