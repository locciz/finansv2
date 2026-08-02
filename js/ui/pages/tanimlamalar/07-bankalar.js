import { saveData } from '@core/app-core-base.js';
import { uid } from '@core/format.js';
import { DB } from '@core/state.js';
import { BANKA_LOGOLAR, BANK_ICON_MAP } from '@domain/banka-verisi.js';
import { inject, provide } from '@core/container.js';
const _ibanUi = inject('ui.components.ibanUi');
const _modalGenel = inject('ui.components.modalGenel');
const _tanimlamalarState = inject('ui.pages.tanimlamalarState');
const _tanimlamalarGenelYardimcilar = inject('ui.pages.tanimlamalarGenelYardimcilar');
// DAİRESEL: tanimlamalar/02-ana-sayfa.js bu dosyayı da import ediyor
// (openBankaModal/deleteBanka). renderTanimlamalar() SADECE fonksiyon
// gövdelerinde (saveBanka, seedPresetBankalar, deleteBanka) çağrılıyor,
// modül eval zamanında değil — bu yüzden top-level const güvenli
// (Tur 15/20/21/22/25 deseniyle uyumlu).
const _tanimlamalarAnaSayfa = inject('ui.pages.tanimlamalarAnaSayfa');
// ============================================================
// js/ui/pages/tanimlamalar/07-bankalar.js
// Banka tanımlama CRUD'u
//
// Bu dosya, eskiden tek parça olan js/ui/pages/tanimlamalar.js
// (81 export, 1440+ satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function openBankaModal(id=null) {
  _tanimlamalarState.setEditBankaId(id || null);
  document.getElementById('banka-modal-title').textContent = id ? 'Banka Düzenle' : 'Banka Ekle';
  const b = id ? (DB.bankalar||[]).find(x=>x.id===id) : null;
  document.getElementById('banka-tam').value      = b?.tam || '';
  document.getElementById('banka-kisa').value     = b?.kisa || '';
  document.getElementById('banka-iban-kod').value = b?.ibanKod || '';
  document.getElementById('banka-ikon').value     = b?.ikon || '';
  const kodPad = (b?.ibanKod || '').padStart(4,'0');
  const startLogo = b?.logo || (b ? _tanimlamalarGenelYardimcilar.bankaLogoByKod(kodPad) : '') || '';
  document.getElementById('banka-logo').value = startLogo;
  _ibanUi._renderBankaLogoPicker(startLogo);
  _ibanUi.onBankaIbanKodInput(); // öneri güncelle
  _modalGenel.openModal('modal-banka');
}

// Picker'daki bir öğeye tıklanınca çağrılır — index üzerinden çalışır,
// böylece logo markup'ı (img/svg + tırnaklar) HTML attribute'a gömülmez.

export function _pickBankaLogo(idx) {
  const logo = BANKA_LOGOLAR[idx];
  _ibanUi._selectBankaLogo(logo ? logo.svg : '');
}

// [KALDIRILDI] editBanka(id) — hiçbir yerden çağrılmıyordu; işlevi zaten
// openBankaModal(id) tarafından üstlenilmiş (o fonksiyon id parametresi
// verildiğinde düzenleme moduna geçiyor). Bu eski kopya modalı doğrudan
// açıp modal-genel açma çağrısını da tekrarlıyordu (ölü kod taraması, 2026-07).

export function saveBanka() {
  const tam     = document.getElementById('banka-tam').value.trim();
  const kisa    = document.getElementById('banka-kisa').value.trim();
  const ibanKod = document.getElementById('banka-iban-kod').value.trim();
  // Kullanıcı emoji girmediyse, IBAN koduna göre preset emoji kullan
  const ikonInput = (document.getElementById('banka-ikon')||{}).value?.trim() || '';
  const kodPad = ibanKod.padStart(4,'0');
  const ikon = ikonInput || (BANK_ICON_MAP[kodPad]?.emoji) || '';
  const logo = (document.getElementById('banka-logo')||{}).value || '';
  if(!_modalGenel.validateRequiredFields([{id:'banka-tam',msg:'Tam ad zorunlu'},{id:'banka-kisa',msg:'Kısa ad zorunlu'}])) return;
  if(_tanimlamalarState.editBankaId) {
    const idx = DB.bankalar.findIndex(b=>b.id===_tanimlamalarState.editBankaId);
    if(idx>=0) DB.bankalar[idx]={...DB.bankalar[idx], tam, kisa, ibanKod, ikon, logo};
  } else {
    DB.bankalar.push({id:uid(), tam, kisa, ibanKod, ikon, logo});
  }
  _tanimlamalarState.setEditBankaId(null);
  saveData();
  _modalGenel.closeModal('modal-banka');
  _tanimlamalarAnaSayfa.renderTanimlamalar();
}

export function seedPresetBankalar() {
  if(!DB.bankalar) DB.bankalar = [];
  let eklenen = 0, tamamlanan = 0;
  _tanimlamalarState.PRESET_BANKALAR.forEach(p => {
    const logo = _tanimlamalarGenelYardimcilar.bankaLogoByKod(p.ibanKod) || '';
    const mevcut = DB.bankalar.find(b => b.ibanKod === p.ibanKod);
    if(mevcut) {
      if(!mevcut.logo && logo) { mevcut.logo = logo; tamamlanan++; }
    } else {
      DB.bankalar.push({ id: uid(), tam: p.tam, kisa: p.kisa, ibanKod: p.ibanKod, ikon: '', logo });
      eklenen++;
    }
  });
  if(!eklenen && !tamamlanan) {
    _modalGenel.showToast('16 banka zaten kayıtlı ve logoları tam', 'success');
    return;
  }
  saveData();
  _tanimlamalarAnaSayfa.renderTanimlamalar();
  _modalGenel.showToast(`${eklenen} banka eklendi${tamamlanan ? `, ${tamamlanan} bankanın logosu tamamlandı` : ''}`, 'success');
}

export function deleteBanka(id) {
  _modalGenel.showConfirm('Bu bankayı silmek istiyor musunuz?', () => {
    DB.bankalar = DB.bankalar.filter(b=>b.id!==id);
    saveData();
    _tanimlamalarAnaSayfa.renderTanimlamalar();
  });
}

// ── DI-MIGRATION dual-mode kaydı ──────────────────────────────
provide('ui.pages.tanimlamalarBankalar', {
  openBankaModal,
  _pickBankaLogo,
  saveBanka,
  seedPresetBankalar,
  deleteBanka,
});

