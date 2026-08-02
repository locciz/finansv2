import { saveData } from '@core/app-core-base.js';
import { uid } from '@core/format.js';
import { DB } from '@core/state.js';
import { inject, provide } from '@core/container.js';
const _modalGenel = inject('ui.components.modalGenel');
const _selectToChips = inject('ui.components.selectToChips');
const _tanimlamalarState = inject('ui.pages.tanimlamalarState');
// DAİRESEL: tanimlamalar/02-ana-sayfa.js bu dosyayı da import ediyor
// (deleteUrunTip, editUrunTip). renderTanimlamalar() SADECE fonksiyon
// gövdelerinde (saveUrunTip, deleteUrunTip callback'i) çağrılıyor, modül
// eval zamanında değil — top-level const güvenli (Tur 15/20/21/22/23
// deseniyle tutarlı).
const _tanimlamalarAnaSayfa = inject('ui.pages.tanimlamalarAnaSayfa');
// ============================================================
// js/ui/pages/tanimlamalar/09-urun-tipleri.js
// Ürün tipi tanımlama CRUD'u
//
// Bu dosya, eskiden tek parça olan js/ui/pages/tanimlamalar.js
// (81 export, 1440+ satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function openUrunTipModal() {
  _tanimlamalarState.setEditUrunTipId(null);
  document.getElementById('urun-tip-modal-title').textContent = 'Ürün Tipi Ekle';
  document.getElementById('urun-tip-ad').value = '';
  document.getElementById('urun-tip-kod').value = '';
  document.getElementById('urun-tip-renk').value = '';
  _modalGenel.openModal('modal-urun-tip');
}

export function editUrunTip(id) {
  _tanimlamalarState.setEditUrunTipId(id);
  const t = DB.urunTipler.find(x=>x.id===id);
  if(!t) return;
  document.getElementById('urun-tip-modal-title').textContent = 'Ürün Tipi Düzenle';
  document.getElementById('urun-tip-ad').value = t.ad;
  document.getElementById('urun-tip-kod').value = t.kod;
  document.getElementById('urun-tip-renk').value = t.renk || '';
  document.getElementById('modal-urun-tip').classList.add('open'); document.body.classList.add('modal-open'); _modalGenel._sidebarDim(true);
  setTimeout(() => _selectToChips.applyChipsToContainer(document.getElementById('modal-urun-tip')), 80);
}

export function saveUrunTip() {
  const ad = document.getElementById('urun-tip-ad').value.trim();
  const kod = document.getElementById('urun-tip-kod').value.trim();
  const renk = document.getElementById('urun-tip-renk').value || '';
  if(!_modalGenel.validateRequiredFields([{id:'urun-tip-ad',msg:'Ad zorunlu'},{id:'urun-tip-kod',msg:'Kısa kod zorunlu'}])) return;
  if(_tanimlamalarState.editUrunTipId) {
    const idx = DB.urunTipler.findIndex(t=>t.id===_tanimlamalarState.editUrunTipId);
    if(idx>=0) DB.urunTipler[idx]={...DB.urunTipler[idx], ad, kod, renk};
  } else {
    DB.urunTipler.push({id:uid(), ad, kod, renk});
  }
  _tanimlamalarState.setEditUrunTipId(null);
  saveData();
  _modalGenel.closeModal('modal-urun-tip');
  _tanimlamalarAnaSayfa.renderTanimlamalar();
}

export function deleteUrunTip(id) {
  _modalGenel.showConfirm('Bu ürün tipini silmek istiyor musunuz?', () => {
    DB.urunTipler = DB.urunTipler.filter(t=>t.id!==id);
    saveData();
    _tanimlamalarAnaSayfa.renderTanimlamalar();
  });
}

// ── DI-MIGRATION dual-mode kaydı ──────────────────────────────
provide('ui.pages.tanimlamalarUrunTipleri', {
  openUrunTipModal,
  editUrunTip,
  saveUrunTip,
  deleteUrunTip,
});

