import { inject, whenReady } from '@core/container.js';
const _kurServisleri = inject('services.kurServisleri');
// DUAL-MODE CONTAINER KAYDI: core.appCoreBase, core.format, core.init,
// core.renderCore, core.state, domain.doviz, domain.ibanUtils,
// core.wrapRegistry, ui.components.cpsSelect, ui.components.tarihInputOverlay,
// ui.components.kisiler, ui.components.moneyInput zaten container'a
// taşınmış katmanlara ait. iban-ui.js ve kisiler.js ile üçlü dairesel
// bağımlılık var (bkz. iban-ui.js'teki aynı yorum) — inject() ile güvenle
// çözülüyor. @pages/* importları o katman henüz taşınmadığı için
// BİLİNÇLİ OLARAK korunuyor.
const _appCoreBase = inject('core.appCoreBase');
const _format = inject('core.format');
const _init = inject('core.init');
const _renderCore = inject('core.renderCore');
const _coreState = inject('core.state');
const _doviz = inject('domain.doviz');
const _ibanUtils = inject('domain.ibanUtils');
const _wrapRegistry = inject('core.wrapRegistry');
const _cpsSelect = inject('ui.components.cpsSelect');
const _ibanUi = inject('ui.components.ibanUi');
const _tarihInputOverlay = inject('ui.components.tarihInputOverlay');
const _kisiler = inject('ui.components.kisiler');
const _moneyInput = inject('ui.components.moneyInput');
import { renderEkstreEslestir } from '@pages/ekstreler/03-ekstre-eslestirme-pdf-import.js';
import { populateEldenKisiSelect } from '@pages/elden.js';
import { populateIslemModal } from '@pages/islemler/07-islem-modal-crud.js';
import { populateKartModal } from '@pages/kartlar/06-kart-form.js';
import { editKartId } from '@pages/kartlar/09-kart-altyapi.js';
import { populateMevduatModal } from '@pages/mevduat/01-mevduat-form-wizard.js';
import { editMevduatId } from '@pages/mevduat/00-state.js';
// ============================================================
// js/ui/components/modal-genel.js — Genel modal altyapısı
// (aç/kapat/sıfırlama, alan doğrulama, toast, placeholder select
// yönetimi, sidebar dim, scroll-lock, manuel karşı taraf kaydetme)
// ============================================================

export function showConfirm(msg, onOk, opts) {
  opts = opts || {};
  const confirmModal = document.getElementById('modal-confirm');
  // .main-wrap position:relative + z-index:1 kendi stacking context'ini oluşturuyor —
  // içindeki #modal-confirm ne kadar yüksek z-index'e sahip olursa olsun, bu context
  // dışına (örn. document.body'ye doğrudan eklenen #od-modal-bg, z-index:10000) göre
  // hep "1" seviyesinde kalıyor ve onay popup'ı ödeme durumu modalının ALTINDA çıkıyordu.
  // Çözüm: onay modalını gösterirken doğrudan body'nin çocuğu yapıyoruz, böylece kendi
  // z-index'i (10060) artık gerçek anlamda en üstte karşılaştırılıyor.
  if (confirmModal.parentElement !== document.body) document.body.appendChild(confirmModal);
  document.getElementById('confirm-title').textContent = opts.title || 'Silmek istiyor musunuz?';
  document.getElementById('confirm-msg').textContent = msg;
  const btn = document.getElementById('confirm-ok-btn');
  btn.textContent = opts.okLabel || 'Sil';
  btn.className = 'btn ' + (opts.okClass || 'btn-danger');
  const newBtn = btn.cloneNode(true); // event listener temizle
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', () => {
    closeModal('modal-confirm');
    onOk();
  });
  document.getElementById('modal-confirm').classList.add('open'); document.body.classList.add('modal-open'); _sidebarDim(true);
}

function _openModalBase(id, onceSecimKartId) {
  if(!_coreState.ALL_CURRENCIES.length) _doviz.rebuildAllCurrencies();

  // ── Açılmadan önce modal içini temizle ──
  const modalBg = document.getElementById(id);
  if (modalBg) {
    const modal = modalBg.querySelector('.modal') || modalBg;
    // Validation banner gizle
    modal.querySelectorAll('.req-error-banner').forEach(function(b) {
      clearTimeout(b._t);
      b.style.display = 'none';
      b.innerHTML = '';
    });
    // Field error stillerini temizle
    modal.querySelectorAll('input, select, textarea').forEach(function(el) {
      el.style.borderColor = '';
      el.style.boxShadow = '';
      el.classList.remove('shake', 'error', 'field-error');
      if (el._clearErrorFn) {
        el.removeEventListener('input',  el._clearErrorFn);
        el.removeEventListener('change', el._clearErrorFn);
        delete el._clearErrorFn;
      }
    });
    modal.querySelectorAll('.date-fake-input').forEach(function(el) {
      el.style.borderColor = '';
      el.style.boxShadow = '';
      el.classList.remove('shake', 'error', 'field-error');
    });
  }

  document.getElementById(id).classList.add('open');
  document.body.classList.add('modal-open');
  _sidebarDim(true);
  if(id==='modal-kart') populateKartModal(editKartId ? (_coreState.DB.kartlar||[]).find(k=>k.id===editKartId) : null);
  if(id==='modal-islem') populateIslemModal(onceSecimKartId);
  // [ES module] editMevduat() artık openModal() sarmalayıcısını kullanıyor
  // (bkz. mevduat/01-mevduat-form-wizard.js). populateMevduatModal() KOŞULSUZ
  // setEditMevduatId(null) yaptığı için, editMevduat() zaten editMevduatId'yi
  // set ETTİKTEN SONRA openModal() çağırdığında bu satır onu hemen null'a
  // geri döndürüp formu resetlerdi. modal-kart'taki desenle aynı korumayı
  // uyguluyoruz: sadece YENİ KAYIT açılışında (editMevduatId henüz boşken)
  // populateMevduatModal() çağrılır; edit modunda editMevduat() kendi
  // doldurma mantığını zaten tamamlamış olur, buradan dokunmuyoruz.
  if(id==='modal-mevduat' && !editMevduatId) populateMevduatModal();
  if(id==='modal-eslestir') renderEkstreEslestir();
  if(id==='modal-tcmb-gecmis') _kurServisleri.populateTcmbGecmisModal();
  // Money input binding — yeni açılan modalda da çalışsın
  const modalEl = document.getElementById(id);
  if(modalEl) setTimeout(()=>{
    _moneyInput.bindMoneyInputs(modalEl);
    // Büyük (hero) tutar alanı olan modallarda açılışta focus doğrudan
    // tutar alanına gitsin; içinde veri varsa hepsi seçiliymiş gibi
    // görünmesin (bkz. bindMoneyInputs focus handler'ındaki _skipAutoSelect).
    const heroInput = modalEl.querySelector('.money-hero-wrap input.money-input');
    if(heroInput && !heroInput.disabled && !heroInput.readOnly) {
      heroInput._skipAutoSelect = true;
      heroInput.focus();
    }
  }, 10);

  // Hash'e modal bilgisini ekle (mevcut sayfa korunarak)
  const curPage = _init._currentHashPage() || 'ozet';
  const curParams = _init._currentHashParams();
  curParams.modal = id;
  if(onceSecimKartId) curParams.modalKart = onceSecimKartId;
  _init._pushHashState(curPage, curParams);

  // Eskiden window.openModal patch'i (patchOpenModal) burayı ayrıca sarmalayıp
  // her açılıştan sonra IBAN validasyonlarını yeniden bağlıyordu. ES module
  // export'ları immutable binding olduğu için dışarıdan wrap edilemez;
  // davranış birebir korunarak doğrudan buraya taşındı.
  setTimeout(_ibanUi.attachAllIbanValidations, 120);
  // Aynı sebeple, tarih input overlay'lerini modal açılışında yenileyen
  // patch de (patchOpenModalForDateOverlay) buraya taşındı.
  _tarihInputOverlay.openModalDateOverlayRefresh(id);
}

function closeModalBase(id) {
  const modalBg = document.getElementById(id);
  if (!modalBg) return;
  modalBg.classList.remove('open');
  if(!document.querySelector('.modal-bg.open')) {
    document.body.classList.remove('modal-open');
    _sidebarDim(false);
  }

  // ── Form & validation temizliği ──────────────────────────
  const modal = modalBg.querySelector('.modal') || modalBg;

  // 1) Tüm form inputlarını sıfırla (select, input, textarea)
  modal.querySelectorAll('input:not([type="hidden"]):not([data-no-reset]), select:not([data-no-reset]), textarea:not([data-no-reset])').forEach(function(el) {
    if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = false;
    } else {
      el.value = '';
    }
    // date-fake-input (overlay) sıfırla
    if (el._dateFake) el._dateFake.value = '';
  });

  // 1b) Chip-pill-select'e bağlı select'ler "data-no-reset" yüzünden yukarıda atlandı —
  // value'larını native "selected" özniteliğine göre sıfırlayıp pill görselini senkronize et.
  modal.querySelectorAll('select[data-no-reset]').forEach(function(el) {
    if (el._cpsOpts) {
      const defOpt = Array.from(el.options).find(o => o.defaultSelected) || el.options[0];
      el.value = defOpt ? defOpt.value : '';
      _cpsSelect.cpsSync(el.id);
    }
  });

  // date-wrap içindeki görsel input'ları da temizle
  modal.querySelectorAll('.date-fake-input').forEach(function(el) {
    el.value = '';
    el.style.color = '';
  });

  // 2) money-input display sıfırla
  modal.querySelectorAll('.money-input').forEach(function(el) {
    el.value = '';
    const disp = el.parentElement && el.parentElement.querySelector('.money-display');
    if (disp) disp.textContent = '';
  });

  // 3) Validation banner'ları gizle ve içini temizle
  modal.querySelectorAll('.req-error-banner').forEach(function(b) {
    clearTimeout(b._t);
    b.style.display = 'none';
    b.innerHTML = '';
  });

  // 4) field-error border/shadow temizle (inline style ile işaretlenenler)
  modal.querySelectorAll('input, select, textarea').forEach(function(el) {
    el.style.borderColor = '';
    el.style.boxShadow = '';
    el.classList.remove('shake', 'error', 'field-error');
    if (el._clearErrorFn) {
      el.removeEventListener('input',  el._clearErrorFn);
      el.removeEventListener('change', el._clearErrorFn);
      delete el._clearErrorFn;
    }
  });

  // date-fake-input'lar için de border/shadow temizle
  modal.querySelectorAll('.date-fake-input').forEach(function(el) {
    el.style.borderColor = '';
    el.style.boxShadow = '';
    el.classList.remove('shake', 'error', 'field-error');
  });

  // 5) placeholder (ph) class'larını geri yükle
  modal.querySelectorAll('select.ph').forEach(function(el) {
    if (!el.value) {
      const first = el.querySelector('option[value=""]');
      if (first) el.value = '';
    }
  });

  // Hash'ten modal bilgisini temizle
  const curPage = _init._currentHashPage() || 'ozet';
  const curParams = _init._currentHashParams();
  delete curParams.modal;
  delete curParams.modalKart;
  _init._pushHashState(curPage, curParams);

  // ── Genel tazeleme ──────────────────────────────────────
  // Popup hangi sayfadan açılmış olursa olsun (ör. Özet'teyken Mevduat popup'ı
  // açılıp kaydedilmişse), o an ekranda görünen sayfayı ve dashboard özetini
  // güncel veriyle yeniden çiz. Böylece "popup kapandı ama ekran eskisi gibi
  // kaldı" sorunu tüm sayfalarda tutarlı biçimde önlenmiş olur.
  _renderCore.refreshVisiblePage();
  if (id === 'modal-transfer') {
    setTimeout(function(){ _wrapRegistry.call('_odModalRestoreAfterTransfer'); }, 0);
  }
}

// ES module export'ları immutable binding olduğu için `export function
// closeModal(){}` ismini doğrudan yeniden atayarak wrap etmek (eskiden
// closeModal = function(id){...} ile deneniyordu — bu aslında import
// binding'ine atama olduğu için tarayıcıda TypeError fırlatırdı, sessiz
// bug) mümkün değil; bunun yerine mutable bir pointer (_currentCloseModal)
// tutuyoruz. setCloseModal(...) bu pointer'ı günceller; buradan export
// edilen `closeModal` her zaman en güncel pointer'ı çağırır.
let _currentCloseModal = closeModalBase;

export function setCloseModal(fn) {
  if (typeof fn !== 'function') throw new Error('setCloseModal(fn): fn bir fonksiyon olmalı.');
  _currentCloseModal = fn;
}

export function getCloseModal() {
  return _currentCloseModal;
}

export function closeModal(id) {
  return _currentCloseModal(id);
}

// ── Alan doğrulama (hata vurgulama, zorunlu alan kontrolü) ───
// showFieldError ve _markFieldError aynı "kırmızı border + shadow + shake"
// vurgusunu uyguluyordu, sadece hata-temizleme (input/change dinleyicisi)
// stratejileri farklıydı. Ortak vurgulama mantığı burada; hangi input'un
// hedef alınacağını (date-wrap varsa fake-input) ve temizleme stratejisini
// çağıran belirliyor.
export function _fieldErrorHedefEl(el) {
  const wrap = el.closest('.date-wrap');
  return wrap ? (wrap.querySelector('.date-fake-input') || el) : el;
}
export function _fieldErrorVurgula(target) {
  target.style.borderColor = 'var(--danger)';
  target.style.boxShadow = '0 0 0 2px rgba(239,68,68,0.3)';
}

export function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  const target = _fieldErrorHedefEl(el);
  _fieldErrorVurgula(target);
  target.classList.add('shake');
  setTimeout(() => target.classList.remove('shake'), 420);
  const clear = () => { target.style.borderColor=''; target.style.boxShadow=''; };
  target.addEventListener('input',  clear, {once:true});
  target.addEventListener('change', clear, {once:true});
  showToast(msg, 'error');
  target.scrollIntoView({behavior:'smooth', block:'center'});
  setTimeout(() => target.focus(), 120);
}

export function _isFieldEmpty(id) {
  const el = document.getElementById(id);
  if (!el) return false;
  // money-input: parse ederek kontrol et
  if (el.classList.contains('money-input')) {
    const raw = (el.value||'').replace(/\s/g,'')
      .replace(new RegExp('\\' + (_coreState.FORMAT_CONFIG.binlikAyrac||'.'), 'g'), '')
      .replace(_coreState.FORMAT_CONFIG.ondalikAyrac||',', '.');
    return !parseFloat(raw);
  }
  return !(el.value||'').trim();
}

export function _markFieldError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const target = _fieldErrorHedefEl(el);
  _fieldErrorVurgula(target);
  // Shake: önce class'ı kaldır (zaten varsa reset için), sonra force reflow, sonra ekle
  target.classList.remove('shake');
  void target.offsetWidth; // force reflow
  target.classList.add('shake');
  setTimeout(function(){ target.classList.remove('shake'); }, 450);
  if (target._clearErrorFn) {
    target.removeEventListener('input',  target._clearErrorFn);
    target.removeEventListener('change', target._clearErrorFn);
  }
  target._clearErrorFn = function(){ target.style.borderColor=''; target.style.boxShadow=''; delete target._clearErrorFn; };
  target.addEventListener('input',  target._clearErrorFn, {once:true});
  target.addEventListener('change', target._clearErrorFn, {once:true});
}

export function validateRequiredFields(fieldDefs) {
  const errors = [];
  fieldDefs.forEach(function(fd) {
    if (_isFieldEmpty(fd.id)) errors.push(fd);
  });
  if (!errors.length) return true;
  errors.forEach(function(fd){ _markFieldError(fd.id); });
  const firstEl = document.getElementById(errors[0].id);
  const modal = firstEl && firstEl.closest('.modal');
  if (modal) {
    let banner = modal.querySelector('.req-error-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'req-error-banner';
      const body = modal.querySelector('.modal-body') || modal;
      body.prepend(banner);
    }
    banner.innerHTML = '<span style="font-size:15px">\u26A0</span><span>' + errors.map(function(e){return e.msg;}).join(' • ') + '</span>';
    banner.style.display = 'flex';
    clearTimeout(banner._t);
    banner._t = setTimeout(function(){ banner.style.display='none'; }, 4500);
  }
  if (firstEl) {
    firstEl.scrollIntoView({behavior:'smooth', block:'center'});
    setTimeout(function(){ firstEl.focus(); }, 120);
  }
  return false;
}

// ── Toast bildirimleri ────────────────────────────────────────
export function showToast(msg, type='success') {
  const GAP = 10;
  const BASE_BOTTOM = 24;
  // Mevcut toastların toplam yüksekliğini hesapla
  const existing = [...document.querySelectorAll('.toast')];
  const stackHeight = existing.reduce((sum, el) => sum + el.offsetHeight + GAP, 0);

  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = (type==='success'?'✓ ':type==='error'?'✕ ':type==='info'?'ℹ ':' ') + msg;
  t.style.bottom = (BASE_BOTTOM + stackHeight) + 'px';

  // Progress bar
  const prog = document.createElement('div');
  prog.className = 'toast-progress';
  prog.style.animationDuration = '2.8s';
  t.appendChild(prog);
  document.body.appendChild(t);

  // Kapanınca alttaki toastları aşağı kaydır
  function restack() {
    let offset = BASE_BOTTOM;
    [...document.querySelectorAll('.toast')].forEach(el => {
      el.style.transition = 'bottom .25s ease';
      el.style.bottom = offset + 'px';
      offset += el.offsetHeight + GAP;
    });
  }

  setTimeout(()=>{
    t.style.opacity='0';
    t.style.transform='translateY(12px)';
    t.style.transition='all .3s ease';
    setTimeout(()=>{ t.remove(); restack(); }, 300);
  }, 2800);
}

// [KALDIRILDI] openGenericModal(title, bodyHtml) — genel amaçlı, dinamik
// oluşturulan modal yardımcısı; hiçbir yerden çağrılmıyordu (ölü kod
// taraması, 2026-07).

export function initManuelKarsiObservers() {
  ['elden', 'kira', 'maas'].forEach(prefix => {
    const adEl   = document.getElementById(prefix + '-karsi-ad');
    const kisiEl = document.getElementById(prefix + '-kisi');
    if (!adEl || !kisiEl) return;

    function updateBadge() {
      const hasManuel = adEl.value.trim() && !kisiEl.value;
      let badge = document.getElementById(prefix + '-manuel-badge');
      if (hasManuel) {
        if (!badge) {
          badge = document.createElement('span');
          badge.id = prefix + '-manuel-badge';
          badge.style.cssText = `
            display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;
            padding:2px 7px;border-radius:5px;background:rgba(251,191,36,.12);
            border:1px solid rgba(251,191,36,.25);color:rgba(251,191,36,.85);
            margin-left:6px;vertical-align:middle;
          `;
          badge.title = 'Manuel girilen kişi — kayıt sırasında kaydetme önerisi sunulacak';
          badge.textContent = '📝 Manuel';
          adEl.parentNode.style.position = 'relative';
          adEl.insertAdjacentElement('afterend', badge);
        }
      } else if (badge) {
        badge.remove();
      }
    }

    adEl.addEventListener('input', updateBadge);
    kisiEl.addEventListener('change', updateBadge);
  });
}

export function checkManuelKarsiTarafAndSave(prefix, saveFn) {
  const kisiSel = document.getElementById(prefix + '-kisi');
  const adEl    = document.getElementById(prefix + '-karsi-ad');
  const ibanEl  = document.getElementById(prefix + '-karsi-iban');

  // Kişi seçilmişse direkt kaydet
  if (kisiSel && kisiSel.value) { saveFn(); return; }

  const ad   = adEl   ? adEl.value.trim()                             : '';
  const iban = ibanEl ? ibanEl.value.replace(/\s+/g,'').toUpperCase() : '';

  // Manuel hiçbir şey girilmemişse direkt kaydet
  if (!ad && !iban) { saveFn(); return; }

  // Manuel veri var — kaydetmek ister mi diye sor
  showManuelKarsiKaydetModal(ad, iban, saveFn);
}

export function showManuelKarsiKaydetModal(ad, iban, saveFn) {
  // Önceki varsa kaldır
  const existing = document.getElementById('manuel-karsi-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'manuel-karsi-modal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,.55);backdrop-filter:blur(4px);
  `;
  modal.innerHTML = `
    <div style="
      background:var(--surface2);border:1px solid var(--border2);border-radius:16px;
      padding:24px;max-width:360px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.4);
    ">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <span style="font-size:22px;">💾</span>
        <span style="font-size:15px;font-weight:600;color:var(--text);">Kişiyi Kaydet?</span>
      </div>
      <p style="font-size:13px;color:var(--text2);margin:0 0 12px;">
        Aşağıdaki karşı taraf bilgisi manuel girildi. Kişi listesine kaydedilsin mi?
      </p>
      <div style="background:var(--surface3);border-radius:8px;padding:10px 12px;margin-bottom:18px;font-size:12px;color:var(--text2);">
        ${ad ? `<div style="margin-bottom:4px;"><strong style="color:var(--text);">İsim:</strong> ${ad}</div>` : ''}
        ${iban ? `<div><strong style="color:var(--text);">IBAN:</strong> <span style="font-family:monospace;font-size:11px;">${iban.replace(/(.{4})/g,'$1 ').trim()}</span></div>` : ''}
      </div>
      <div style="display:flex;gap:8px;">
        <button id="mkm-kaydet" style="
          flex:1;padding:9px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:600;
          background:linear-gradient(135deg,var(--accent2,#63b3ed),var(--teal,#2dd4bf));color:#0f1629;
        ">✓ Kaydet ve Devam</button>
        <button id="mkm-devam" style="
          flex:1;padding:9px;border-radius:8px;border:1px solid var(--border2);cursor:pointer;
          font-size:13px;background:transparent;color:var(--text2);
        ">Kaydetme</button>
        <button id="mkm-iptal" style="
          padding:9px 12px;border-radius:8px;border:1px solid rgba(251,113,133,.3);cursor:pointer;
          font-size:13px;background:transparent;color:var(--rose,#fb7185);
        ">✕</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('mkm-kaydet').onclick = () => {
    modal.remove();
    saveFn();
    // Kişiyi saveFn'den SONRA kaydet — böylece form hatası çıksa bile kişi fazladan eklenmez
    if (ad) {
      const ibanGecerli = !!iban && /^TR\d{24}$/.test(iban) && _ibanUtils.ibanMod97(iban);
      // Aynı IBAN zaten kayıtlıysa tekrar ekleme
      const zatenVar = ibanGecerli && (_coreState.DB.kisiler||[]).some(k => (k.ibanlar||[]).some(i => i.iban === iban));
      if (!zatenVar) {
        const newKisi = { id: _format.uid(), ad, tel: '', ibanlar: ibanGecerli ? [{iban, etiket:''}] : [], not:'' };
        if (!_coreState.DB.kisiler) _coreState.DB.kisiler = [];
        _coreState.DB.kisiler.push(newKisi);
        _appCoreBase.saveData();
        try { populateEldenKisiSelect(); } catch(e){}
        try { _kisiler.mkpRenderList(); } catch(e){}
        showToast(iban && !ibanGecerli
          ? ad + ' eklendi (IBAN geçersiz olduğu için kaydedilmedi)'
          : ad + ' kişi listesine eklendi ✓');
      }
    }
  };

  document.getElementById('mkm-devam').onclick = () => {
    modal.remove();
    saveFn();
  };

  document.getElementById('mkm-iptal').onclick = () => {
    modal.remove();
  };

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}


// ── SELECT PLACEHOLDER YÖNETİMİ ──────────────────────────
// Boş value="" option'ı disabled+hidden placeholder olarak işler,
// seçime göre rengi günceller.
export function phUpdate(sel) {
  if(!sel) return;
  const isEmpty = sel.value === '';
  sel.classList.toggle('ph', isEmpty);
}

export function phInit(sel, label, emptyLabel) {
  if(!sel) return;
  // Mevcut boş option'ı bul ya da oluştur
  let ph = sel.querySelector('option[value=""]');
  if(!ph) {
    ph = document.createElement('option');
    ph.value = '';
    sel.prepend(ph);
  }
  // Placeholder dışında gerçek seçenek var mı? (liste boşsa bilgilendirici mesaj göster)
  const hasItems = !!sel.querySelector('option[value]:not([value=""])');
  const isEmptyList = !hasItems && !!emptyLabel;
  ph.textContent = isEmptyList ? emptyLabel : (label || 'Seçiniz…');
  ph.disabled = true;
  ph.hidden = true;
  sel.classList.toggle('ph-empty', isEmptyList);
  sel.disabled = isEmptyList;
  // Başlangıç rengi
  phUpdate(sel);
  // Değişince renk güncelle
  if(!sel._phBound) {
    sel.addEventListener('change', () => phUpdate(sel));
    sel._phBound = true;
  }
}

// Bir selecte innerHTML atandıktan sonra çağır — mevcut placeholder'ı düzeltir
// emptyLabel verilirse ve listede gerçek seçenek yoksa, placeholder yerine bu bilgilendirici metin gösterilir (örn. "Hesap bulunamadı")
export function phSet(selOrId, label, currentVal, emptyLabel) {
  const sel = typeof selOrId === 'string' ? document.getElementById(selOrId) : selOrId;
  if(!sel) return;
  phInit(sel, label, emptyLabel);
  if(currentVal !== undefined && !sel.disabled) sel.value = currentVal;
  phUpdate(sel);
}

export function _sidebarDim(on) {
  const ov = document.getElementById('sidebar-modal-overlay');
  const sb = document.getElementById('main-sidebar');
  if (!ov || !sb) return;
  if (on) {
    ov.classList.add('active');
    sb.style.zIndex = '1';       // below modal-bg z-index: 1000
    // Tablet genişliğinde (769-1024px) sidebar mouse hover'la genişliyordu;
    // modal açıkken mouse sidebar üzerinde kalsa bile zorla daraltılmış kalsın.
    sb.classList.add('js-force-collapsed');
  } else {
    ov.classList.remove('active');
    sb.style.zIndex = '';
    sb.classList.remove('js-force-collapsed');
  }
}
// ========== MODAL ==========
// Popup açılınca body.modal-open -> position:fixed oluyor (bkz. CSS), bu da
// scroll pozisyonunu sıfırlıyordu; popup kapanınca da geri yüklenmediği için
// sayfa en başa fırlıyormuş gibi görünüyordu. Body class'ını izleyip scroll
// pozisyonunu kilit anında kaydedip, açılış anında aynı yere geri koyuyoruz.
// Tüm modal aç/kapa noktalarını tek tek değiştirmeye gerek kalmasın diye
// merkezi bir MutationObserver ile hallediyoruz.
//
// ÖNEMLİ: body.classList.add('modal-open') senkron çalıştığı an CSS'teki
// position:fixed !important de senkron olarak devreye giriyor (mobilde,
// özellikle Safari'de). MutationObserver callback'i ise bir microtask sonra
// çalışıyor — yani window.scrollY'yi callback İÇİNDE okumaya çalıştığımızda
// body zaten position:fixed olmuş oluyor ve tarayıcı scrollY'yi 0'a
// çökertmiş oluyor (akıştan çıkan body'nin scroll edilecek içeriği kalmıyor).
// Sonuç: "kilitlemeden önceki scroll'u kaydet" niyeti başarısız oluyor, hep
// 0 kaydediliyor ve modal açılır açılmaz sayfa en başa fırlıyor.
// Çözüm: window.scrollY'yi kilit anında değil, passive bir scroll listener
// ile SÜREKLİ güncel tutup (_lastKnownScrollY), kilit tetiklendiğinde bu
// "bir adım önceki" değeri kullanıyoruz — position:fixed'in bozduğu taze
// okumaya hiç ihtiyaç kalmıyor.
export var _scrollLockY = 0;
export var _lastKnownScrollY = window.scrollY || document.documentElement.scrollTop || 0;
window.addEventListener('scroll', function () {
  if (!document.body.classList.contains('modal-open')) {
    _lastKnownScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  }
}, { passive: true });
(function () {
  const _mo = new MutationObserver(function () {
    const isLocked = document.body.classList.contains('modal-open');
    if (isLocked && !document.body.style.top) {
      _scrollLockY = _lastKnownScrollY;
      document.body.style.top = '-' + _scrollLockY + 'px';
    } else if (!isLocked && document.body.style.top) {
      document.body.style.top = '';
      // NOT: html { scroll-behavior: smooth } yüzünden scrollTo(0,Y) iki-argümanlı
      // formu animasyonlu kayıyordu; bu sırada tablo render'ı araya girince mobilde
      // (masaüstünde repaint daha hızlı olduğu için fark edilmiyordu) kayma yarıda
      // kesilip sayfa en başta kalmış gibi görünüyordu. Restore'u instant yapıyoruz.
      const _prevSB = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo({ top: _scrollLockY, left: 0, behavior: 'instant' });
      document.documentElement.style.scrollBehavior = _prevSB;
      _lastKnownScrollY = _scrollLockY;
    }
  });
  _mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();


// Tüm .modal-bg elemanlarına dışa-tık kapatma davranışı
document.querySelectorAll('.modal-bg').forEach(m => {
  m.addEventListener('click', e => {
    if(e.target===m) {
      // IBAN popup dışına tıklanınca "atla" gibi kapat
      if(m.id === 'modal-iban-popup') {
        _ibanUi._ibanPopupKapat(true);
        return;
      }
      closeModal(m.id);
    }
  });
});

// DOMContentLoaded veya hemen çağır
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initManuelKarsiObservers);
} else {
  setTimeout(initManuelKarsiObservers, 500);
}

// openModal ve closeModal artık `export function` olarak tanımlı (yukarıda) ve
// ihtiyacı olan tüm modüller bunları doğrudan import ediyor. Eskiden burada
// window.openModal / window.closeModal atamaları ve openModal'ı sonradan
// sarmalayan bir patchOpenModal() IIFE'si vardı; IBAN validasyon bağlama işi
// artık openModal fonksiyonunun kendi gövdesine taşındı (bkz. yukarısı),
// dolayısıyla ayrı bir wrap katmanına gerek kalmadı.

// [ES module] taban tanım, odeme/patches zincirinin hook/wrap edebilmesi
// için wrap-registry'ye kaydediliyor. wrap-registry.js kendi container
// kaydını ('core.wrapRegistry') dinamik import().then(...) ile ASENKRON
// yaptığı için, bu dosya modül grafiği yüklenirken senkron/top-level olarak
// buraya doğrudan _wrapRegistry.register(...) çağırırsa (Proxy get handler
// hemen resolve() tetikler) namespace henüz kayıtlı olmayabilir ve
// "core.wrapRegistry namespace'i kayıtlı değil" hatası fırlatılır.
// whenReady ile namespace hazır olana kadar erteliyoruz.
whenReady('core.wrapRegistry', () => {
  _wrapRegistry.register('openModal', _openModalBase);
});

// [ES module] Eskiden bu dosyanın DIŞINDAKİ ~40 dosya `import { openModal }`
// ile TABAN tanımı doğrudan çağırıyordu — bu yüzden select-to-chips.js gibi
// başka modüllerin _wrapRegistry.register('openModal', wrap(...)) ile eklediği katmanlar
// (chip render, vb.) o çağrılarda hiç devreye girmiyordu (sessiz bug).
// Artık `openModal` adı altında export edilen bu köprü, HER ZAMAN registry'
// deki EN GÜNCEL (en dıştaki) katmanı çağırır — çağıran dosya değişmeden
// (hâlâ `import { openModal }` kullanabilirler) davranış otomatik doğru olur.
export function openModal(...args) {
  return _wrapRegistry.call('openModal', ...args);
}

// ============================================================
// [DI-MIGRATION] ui.components.modalGenel — container'a kayıt
// ============================================================
import { provide } from '@core/container.js';
provide('ui.components.modalGenel', {
  showConfirm, setCloseModal, getCloseModal, closeModal, _fieldErrorHedefEl,
  _fieldErrorVurgula, showFieldError, _isFieldEmpty, _markFieldError,
  validateRequiredFields, showToast, initManuelKarsiObservers,
  checkManuelKarsiTarafAndSave, showManuelKarsiKaydetModal, phUpdate,
  phInit, phSet, _sidebarDim,
  get _scrollLockY() { return _scrollLockY; },
  get _lastKnownScrollY() { return _lastKnownScrollY; },
  openModal,
});
