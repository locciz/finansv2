import { saveData } from '@core/app-core-base.js';
import { uid } from '@core/format.js';
import { DB } from '@core/state.js';
import { inject, provide } from '@core/container.js';
const _modalGenel = inject('ui.components.modalGenel');
const _selectToChips = inject('ui.components.selectToChips');
const _kredilerState = inject('ui.pages.kredilerState');
// DAİRESEL: tanimlamalar/02-ana-sayfa.js bu dosyayı da import ediyor
// (openKrediTipModal/deleteKrediTip). renderTanimlamalar() SADECE
// fonksiyon gövdelerinde (saveKrediTip, deleteKrediTip) çağrılıyor,
// modül eval zamanında değil — bu yüzden top-level const güvenli
// (Tur 15/20/21/22/25/26 deseniyle uyumlu).
const _tanimlamalarAnaSayfa = inject('ui.pages.tanimlamalarAnaSayfa');
// ============================================================
// js/ui/pages/krediler/05-kredi-tipi-tanimlama.js
// Kredi tipi tanımlama CRUD'u
//
// Bu dosya, eskiden tek parça olan js/ui/pages/krediler.js
// (87 export, 1700+ satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function openKrediTipModal(id=null) {
  _kredilerState.setEditKrediTipId(id);
  if(id) {
    const t = (DB.krediTipleri||[]).find(x=>x.id===id);
    if(!t) return;
    document.getElementById('kredi-tip-modal-title').textContent = 'Kredi Tipi Düzenle';
    document.getElementById('kredi-tip-ad').value = t.ad;
    document.getElementById('kredi-tip-kod').value = t.kod;
    document.getElementById('kredi-tip-renk').value = t.renk || '';
  } else {
    document.getElementById('kredi-tip-modal-title').textContent = 'Kredi Tipi Ekle';
    document.getElementById('kredi-tip-ad').value = '';
    document.getElementById('kredi-tip-kod').value = '';
    document.getElementById('kredi-tip-renk').value = '';
  }
  document.getElementById('modal-kredi-tip').classList.add('open'); document.body.classList.add('modal-open'); _modalGenel._sidebarDim(true);
  setTimeout(() => _selectToChips.applyChipsToContainer(document.getElementById('modal-kredi-tip')), 80);
}

export function saveKrediTip() {
  const ad  = document.getElementById('kredi-tip-ad').value.trim();
  const kod = document.getElementById('kredi-tip-kod').value.trim().toUpperCase();
  const renk = document.getElementById('kredi-tip-renk').value || '';
  if(!_modalGenel.validateRequiredFields([{id:'kredi-tip-ad',msg:'Ad zorunlu'},{id:'kredi-tip-kod',msg:'Kod zorunlu'}])) return;
  if(!DB.krediTipleri) DB.krediTipleri = [];
  if(_kredilerState.editKrediTipId) {
    const idx = DB.krediTipleri.findIndex(t=>t.id===_kredilerState.editKrediTipId);
    if(idx>=0) DB.krediTipleri[idx] = {...DB.krediTipleri[idx], ad, kod, renk};
  } else {
    DB.krediTipleri.push({id: uid(), ad, kod, renk});
  }
  _kredilerState.setEditKrediTipId(null);
  saveData();
  _modalGenel.closeModal('modal-kredi-tip');
  _tanimlamalarAnaSayfa.renderTanimlamalar();
  _modalGenel.showToast('Kredi tipi kaydedildi');
}

export function deleteKrediTip(id) {
  _modalGenel.showConfirm('Bu kredi tipini silmek istiyor musunuz?', () => {
    DB.krediTipleri = (DB.krediTipleri||[]).filter(t=>t.id!==id);
    saveData();
    _tanimlamalarAnaSayfa.renderTanimlamalar();
  });
}

// ── DI-MIGRATION dual-mode kaydı ──────────────────────────────
provide('ui.pages.kredilerKrediTipiTanimlama', {
  openKrediTipModal,
  saveKrediTip,
  deleteKrediTip,
});

