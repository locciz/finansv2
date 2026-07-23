import { saveData } from '../../../core/app-core-base.js';
import { fmtCur } from '../../../core/format.js';
import { renderPage } from '../../../core/render-core.js';
import { ALL_CURRENCIES, CURRENCY_CONFIG, DB, defaultCurrency, replaceObjectContents, setDefaultCurrency } from '../../../core/state.js';
import { populateCurrencySelects, rebuildAllCurrencies } from '../../../domain/doviz.js';
import { _pbKaynaklar, _pbTestJsonCache, pbKaynakListesiRender, pbKurTipDegisti, set_pbKaynaklar, set_pbTestJsonCache } from '../../../services/kur-servisleri.js';
import { showConfirm, showToast, validateRequiredFields } from '../../components/modal-genel.js';
import { updateMoneyWrapSymbols } from '../../components/money-input.js';
import { swizUpdateStepIndicator } from '../../components/step-wizard.js';
import { DEFAULT_CURRENCY_CONFIG, PB_STEP_COUNT, _pbCurrentStep, editParaBirimiKod, setEditParaBirimiKod, set_pbCurrentStep } from './00-state.js';
import { renderTanimlamalar } from './02-ana-sayfa.js';
import { closeModal, openModal } from '../../components/modal-genel.js';
// ============================================================
// js/ui/pages/tanimlamalar/06-para-birimi.js
// Para birimi tanımlama (ekleme/düzenleme wizard + kur önizleme)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/tanimlamalar.js
// (81 export, 1440+ satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function loadCurrencyConfig() {
  // Eski xau_yahoo / tek-url ozel kayıtlarını yeni kaynaklar[] formatına migrate et
  if (DB.paraBirimleri) {
    DB.paraBirimleri.forEach(pb => {
      if (pb.kurKaynagi?.tip === 'xau_yahoo') {
        const w = (DB?.ayarlar?.corsProxyWorker||'').replace(/\/$/,'');
        pb.kurKaynagi = { tip: 'ozel', kaynaklar: w
          ? [{ url: `${w}/xau`, jsonPathAlis: 'alis', jsonPathSatis: 'satis', kurBirimi: 'TRY' }]
          : [] };
        pb.tcmbKodu = null;
      } else if (pb.kurKaynagi?.tip === 'ozel' && pb.kurKaynagi.url && !Array.isArray(pb.kurKaynagi.kaynaklar)) {
        const kk = pb.kurKaynagi;
        pb.kurKaynagi = { tip: 'ozel', kaynaklar: [{ url: kk.url, jsonPathAlis: kk.jsonPathAlis||'', jsonPathSatis: kk.jsonPathSatis||'', kurBirimi: kk.kurBirimi||'TRY' }] };
      }
    });
  }
  // Önce varsayılanları yükle
  replaceObjectContents(CURRENCY_CONFIG, {...DEFAULT_CURRENCY_CONFIG});
  // DB'deki özel para birimlerini ekle/override
  if(DB.paraBirimleri) {
    DB.paraBirimleri.forEach(pb => {
      // Geriye dönük uyumluluk: eski kayıtlarda kurKaynagi yoktu, sadece tcmbKodu vardı.
      // kurKaynagi tanımlıysa onu kullan; değilse tcmbKodu'ndan otomatik üret.
      let kurKaynagi = pb.kurKaynagi;
      if(!kurKaynagi) {
        kurKaynagi = pb.tcmbKodu ? { tip: 'tcmb', tcmbKodu: pb.tcmbKodu } : { tip: 'manuel' };
      }
      CURRENCY_CONFIG[pb.kod] = {
        symbol: pb.sembol,
        locale: pb.locale || 'tr-TR',
        position: pb.konum || 'prefix',
        decimals: pb.ondalik !== undefined ? parseInt(pb.ondalik) : 2,
        ad: pb.ad,
        flag: pb.bayrak || '💱',
        icon: pb.ikon || pb.bayrak || '💱',
        renk: pb.renk || '',
        // Eski alan — yalnızca geriye dönük uyumluluk amaçlı tutulur (kurKaynagi.tip==='tcmb' ise kurKaynagi.tcmbKodu ile aynı).
        tcmbKodu: kurKaynagi.tip === 'tcmb' ? (kurKaynagi.tcmbKodu || null) : null,
        kurKaynagi,
        custom: true
      };
    });
  }
  // ALL_CURRENCIES'i de güncelle
  rebuildAllCurrencies();
}

// Gösterim para birimi önizleme metnini ve seçim chip grid'ini günceller

export function updateParaBirimiPreview(code) {
  code = code || defaultCurrency;
  const preview = document.getElementById('para-birimi-preview');
  if(preview) preview.textContent = fmtCur(1234567.89, code);
  const grid = document.getElementById('para-birimi-grid');
  if(grid) {
    grid.querySelectorAll('.cur-chip').forEach(chip => {
      chip.classList.toggle('selected', chip.dataset.code === code);
    });
  }
}

export function setParaBirimi(code) {
  setDefaultCurrency(code);
  // DB'ye yaz ve Drive'a sync et
  if(typeof DB !== 'undefined') {
    DB._currency = code;
    if(typeof saveData === 'function') saveData();
  }
  updateParaBirimiPreview(code);
  // money-wrap sembol ve kod güncelle
  updateMoneyWrapSymbols(code);
  const activePage = document.querySelector('.page.active');
  if(activePage) renderPage(activePage.id.replace('page-',''));
}

// Gösterim para birimi seçim chip grid'i

export function renderParaBirimiGrid() {
  if(!ALL_CURRENCIES.length) rebuildAllCurrencies();
  const grid = document.getElementById('para-birimi-grid');
  if(!grid) return;
  grid.innerHTML = ALL_CURRENCIES.map(c => {
    const isSel = c.code === defaultCurrency;
    return `<div class="cur-chip${isSel?' selected':''}" data-code="${c.code}">${c.flag} ${c.label}</div>`;
  }).join('');
  // [ES module] onclick="selectParaBirimi(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
  grid.querySelectorAll('.cur-chip').forEach(chip => {
    chip.addEventListener('click', () => selectParaBirimi(chip.getAttribute('data-code')));
  });
}

export function selectParaBirimi(code) {
  setParaBirimi(code);
  renderParaBirimiGrid();
}

export function openParaBirimiModal(kod=null) {
  setEditParaBirimiKod(kod);
  pbStepGoto(1);
  set_pbTestJsonCache({});
  const title = document.getElementById('para-birimi-modal-title');
  const setBase = (cfg, k) => {
    document.getElementById('pb-sembol').value = cfg.symbol || '';
    document.getElementById('pb-ad').value = cfg.ad || '';
    document.getElementById('pb-bayrak').value = cfg.flag || '';
    document.getElementById('pb-ikon').value = cfg.icon || '';
    document.getElementById('pb-renk').value = cfg.renk || '';
    document.getElementById('pb-konum').value = cfg.position || 'prefix';
    document.getElementById('pb-ondalik').value = cfg.decimals !== undefined ? cfg.decimals : 2;
    document.getElementById('pb-locale').value = cfg.locale || 'tr-TR';
    // Kur kaynağı
    const tip = k.tip || 'manuel';
    // xau_yahoo / eski tek-url ozel → normalize
    const normalTip = (tip === 'xau_yahoo') ? 'ozel' : tip;
    document.getElementById('pb-kur-tip').value = normalTip;
    document.getElementById('pb-tcmb-kodu').value = tip === 'tcmb' ? (k.tcmbKodu || '') : '';
    // Çoklu kaynak listesi
    if (normalTip === 'ozel') {
      if (Array.isArray(k.kaynaklar) && k.kaynaklar.length) {
        set_pbKaynaklar(k.kaynaklar.map(s => ({...s})));
      } else if (k.url) {
        // Eski tek-kaynak formatından migrate
        set_pbKaynaklar([{ url: k.url, jsonPathAlis: k.jsonPathAlis||'', jsonPathSatis: k.jsonPathSatis||'', kurBirimi: k.kurBirimi||'TRY' }]);
      } else if (tip === 'xau_yahoo') {
        // Worker endpoint'ini kaynak olarak ekle
        const w = (DB?.ayarlar?.corsProxyWorker||'').replace(/\/$/,'');
        set_pbKaynaklar(w ? [{ url: `${w}/xau`, jsonPathAlis: 'alis', jsonPathSatis: 'satis', kurBirimi: 'TRY' }] : []);
      } else {
        set_pbKaynaklar([]);
      }
    } else {
      set_pbKaynaklar([]);
    }
    pbKaynakListesiRender();
  };
  if (kod) {
    title.textContent = 'Para Birimi Düzenle';
    const cfg = CURRENCY_CONFIG[kod];
    document.getElementById('pb-kod').value = kod;
    document.getElementById('pb-kod').readOnly = true;
    const kk = cfg.kurKaynagi || (cfg.tcmbKodu ? { tip: 'tcmb', tcmbKodu: cfg.tcmbKodu } : { tip: 'manuel' });
    setBase(cfg, kk);
  } else {
    title.textContent = 'Para Birimi Ekle';
    document.getElementById('pb-kod').value = '';
    document.getElementById('pb-kod').readOnly = false;
    set_pbKaynaklar([]);
    setBase({ symbol:'', ad:'', flag:'', icon:'', position:'prefix', decimals:2, locale:'tr-TR' }, { tip:'manuel' });
  }
  pbKurTipDegisti();
  openModal('modal-para-birimi');
}

export function setGosterimParaBirimi(code) {
  setParaBirimi(code);
  renderTanimlamalar();
  showToast(code + ' gösterim para birimi olarak ayarlandı');
}

export function editParaBirimi(kod) { openParaBirimiModal(kod); }

export function pbStepGoto(step) {
  step = Math.max(1, Math.min(PB_STEP_COUNT, step));
  set_pbCurrentStep(step);
  const modal = document.getElementById('modal-para-birimi');
  if (!modal) return;
  // ---- Saf DOM güncelleme: js/ui/components/step-wizard.js:swizUpdateStepIndicator ----
  swizUpdateStepIndicator(modal, step);
  const backBtn = document.getElementById('pb-step-back-btn');
  const nextBtn = document.getElementById('pb-step-next-btn');
  const saveBtn = document.getElementById('pb-step-save-btn');
  if (backBtn) backBtn.style.display = step > 1 ? '' : 'none';
  if (nextBtn) nextBtn.style.display = step < PB_STEP_COUNT ? '' : 'none';
  if (saveBtn) saveBtn.style.display = step === PB_STEP_COUNT ? '' : 'none';
  const body = modal.querySelector('.modal-body');
  if (body) body.scrollTop = 0;
}

export function _pbValidateStep(step) {
  if (step === 1) {
    if (!validateRequiredFields([
      {id:'pb-kod',    msg:'Para birimi kodu zorunlu (örn. EUR)'},
      {id:'pb-sembol', msg:'Sembol zorunlu (örn. €)'},
      {id:'pb-ad',     msg:'Para birimi adı zorunlu'}
    ])) return false;
    return true;
  }
  return true;
}

export function pbStepNext() {
  if (!_pbValidateStep(_pbCurrentStep)) return;
  pbStepGoto(_pbCurrentStep + 1);
}

export function pbStepBack() {
  pbStepGoto(_pbCurrentStep - 1);
}

export function saveParaBirimi() {
  const kod = document.getElementById('pb-kod').value.trim().toUpperCase();
  const sembol = document.getElementById('pb-sembol').value.trim();
  const ad = document.getElementById('pb-ad').value.trim();
  if(!kod || !sembol || !ad) { showToast('Kod, sembol ve ad zorunlu', 'error'); return; }
  if(!editParaBirimiKod && CURRENCY_CONFIG[kod]) { showToast('Bu kod zaten mevcut, düzenlemek için ✏️ butonunu kullanın', 'error'); return; }
  if(!DB.paraBirimleri) DB.paraBirimleri = [];
  const existing = DB.paraBirimleri.findIndex(pb=>pb.kod===kod);

  // Kur kaynağı objesini oluştur
  const kurTip = document.getElementById('pb-kur-tip').value || 'manuel';
  let kurKaynagi;
  if (kurTip === 'tcmb') {
    const tcmbKoduGirilen = document.getElementById('pb-tcmb-kodu').value.trim().toUpperCase();
    kurKaynagi = { tip: 'tcmb', tcmbKodu: tcmbKoduGirilen || kod };
  } else if (kurTip === 'ozel') {
    const gecerliKaynaklar = _pbKaynaklar.filter(k => k.url && k.url.trim());
    if (!gecerliKaynaklar.length) { showToast('En az bir URL giriniz', 'error'); return; }
    kurKaynagi = { tip: 'ozel', kaynaklar: gecerliKaynaklar };
  } else {
    kurKaynagi = { tip: 'manuel' };
  }

  const pb = {
    kod,
    sembol,
    ad,
    bayrak: document.getElementById('pb-bayrak').value.trim(),
    ikon: document.getElementById('pb-ikon').value.trim(),
    renk: document.getElementById('pb-renk').value || '',
    konum: document.getElementById('pb-konum').value,
    ondalik: parseInt(document.getElementById('pb-ondalik').value),
    locale: document.getElementById('pb-locale').value.trim() || 'tr-TR',
    // Geriye dönük uyumluluk
    tcmbKodu: kurKaynagi.tip === 'tcmb' ? (kurKaynagi.tcmbKodu || null) : null,
    kurKaynagi
  };
  if(existing >= 0) DB.paraBirimleri[existing] = pb;
  else DB.paraBirimleri.push(pb);
  saveData();
  loadCurrencyConfig();
  populateCurrencySelects();
  closeModal('modal-para-birimi');
  renderTanimlamalar();
  showToast('Para birimi kaydedildi');
}

export function deleteParaBirimi(kod) {
  showConfirm(`"${kod}" para birimini silmek istiyor musunuz?`, () => {
    DB.paraBirimleri = (DB.paraBirimleri||[]).filter(pb=>pb.kod!==kod);
    saveData();
    loadCurrencyConfig();
    populateCurrencySelects();
    renderTanimlamalar();
    showToast('Para birimi silindi');
  });
}

