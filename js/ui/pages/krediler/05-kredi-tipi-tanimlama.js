import { saveData } from '@core/app-core-base.js';
import { uid } from '@core/format.js';
import { DB } from '@core/state.js';
import { _sidebarDim, showConfirm, showToast, validateRequiredFields } from '@components/modal-genel.js';
import { applyChipsToContainer } from '@components/select-to-chips.js';
import { editKrediTipId, setEditKrediTipId } from '@pages/krediler/00-state.js';
import { renderTanimlamalar } from '@pages/tanimlamalar/02-ana-sayfa.js';
import { closeModal } from '@components/modal-genel.js';
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
  setEditKrediTipId(id);
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
  document.getElementById('modal-kredi-tip').classList.add('open'); document.body.classList.add('modal-open'); _sidebarDim(true);
  setTimeout(() => applyChipsToContainer(document.getElementById('modal-kredi-tip')), 80);
}

export function saveKrediTip() {
  const ad  = document.getElementById('kredi-tip-ad').value.trim();
  const kod = document.getElementById('kredi-tip-kod').value.trim().toUpperCase();
  const renk = document.getElementById('kredi-tip-renk').value || '';
  if(!validateRequiredFields([{id:'kredi-tip-ad',msg:'Ad zorunlu'},{id:'kredi-tip-kod',msg:'Kod zorunlu'}])) return;
  if(!DB.krediTipleri) DB.krediTipleri = [];
  if(editKrediTipId) {
    const idx = DB.krediTipleri.findIndex(t=>t.id===editKrediTipId);
    if(idx>=0) DB.krediTipleri[idx] = {...DB.krediTipleri[idx], ad, kod, renk};
  } else {
    DB.krediTipleri.push({id: uid(), ad, kod, renk});
  }
  setEditKrediTipId(null);
  saveData();
  closeModal('modal-kredi-tip');
  renderTanimlamalar();
  showToast('Kredi tipi kaydedildi');
}

export function deleteKrediTip(id) {
  showConfirm('Bu kredi tipini silmek istiyor musunuz?', () => {
    DB.krediTipleri = (DB.krediTipleri||[]).filter(t=>t.id!==id);
    saveData();
    renderTanimlamalar();
  });
}

