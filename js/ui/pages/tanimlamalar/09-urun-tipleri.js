import { saveData } from '../../../core/app-core-base.js';
import { uid } from '../../../core/format.js';
import { DB } from '../../../core/state.js';
import { _sidebarDim, showConfirm, validateRequiredFields } from '../../components/modal-genel.js';
import { applyChipsToContainer } from '../../components/select-to-chips.js';
import { editUrunTipId, setEditUrunTipId } from './00-state.js';
import { renderTanimlamalar } from './02-ana-sayfa.js';
import { closeModal, openModal } from '../../components/modal-genel.js';
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
  setEditUrunTipId(null);
  document.getElementById('urun-tip-modal-title').textContent = 'Ürün Tipi Ekle';
  document.getElementById('urun-tip-ad').value = '';
  document.getElementById('urun-tip-kod').value = '';
  document.getElementById('urun-tip-renk').value = '';
  openModal('modal-urun-tip');
}

export function editUrunTip(id) {
  setEditUrunTipId(id);
  const t = DB.urunTipler.find(x=>x.id===id);
  if(!t) return;
  document.getElementById('urun-tip-modal-title').textContent = 'Ürün Tipi Düzenle';
  document.getElementById('urun-tip-ad').value = t.ad;
  document.getElementById('urun-tip-kod').value = t.kod;
  document.getElementById('urun-tip-renk').value = t.renk || '';
  document.getElementById('modal-urun-tip').classList.add('open'); document.body.classList.add('modal-open'); _sidebarDim(true);
  setTimeout(() => applyChipsToContainer(document.getElementById('modal-urun-tip')), 80);
}

export function saveUrunTip() {
  const ad = document.getElementById('urun-tip-ad').value.trim();
  const kod = document.getElementById('urun-tip-kod').value.trim();
  const renk = document.getElementById('urun-tip-renk').value || '';
  if(!validateRequiredFields([{id:'urun-tip-ad',msg:'Ad zorunlu'},{id:'urun-tip-kod',msg:'Kısa kod zorunlu'}])) return;
  if(editUrunTipId) {
    const idx = DB.urunTipler.findIndex(t=>t.id===editUrunTipId);
    if(idx>=0) DB.urunTipler[idx]={...DB.urunTipler[idx], ad, kod, renk};
  } else {
    DB.urunTipler.push({id:uid(), ad, kod, renk});
  }
  setEditUrunTipId(null);
  saveData();
  closeModal('modal-urun-tip');
  renderTanimlamalar();
}

export function deleteUrunTip(id) {
  showConfirm('Bu ürün tipini silmek istiyor musunuz?', () => {
    DB.urunTipler = DB.urunTipler.filter(t=>t.id!==id);
    saveData();
    renderTanimlamalar();
  });
}

