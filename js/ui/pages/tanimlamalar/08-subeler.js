import { saveData } from '@core/app-core-base.js';
import { DB } from '@core/state.js';
import { inject, provide } from '@core/container.js';
const _modalGenel = inject('ui.components.modalGenel');
const _tanimlamalarState = inject('ui.pages.tanimlamalarState');
// DAİRESEL: tanimlamalar/02-ana-sayfa.js bu dosyayı da import ediyor
// (openSubeModal). renderTanimlamalar() SADECE fonksiyon gövdelerinde
// (deleteSube, saveSubeForm) çağrılıyor, modül eval zamanında değil —
// bu yüzden top-level const güvenli (Tur 15/20/21 deseniyle uyumlu).
const _tanimlamalarAnaSayfa = inject('ui.pages.tanimlamalarAnaSayfa');
// ============================================================
// js/ui/pages/tanimlamalar/08-subeler.js
// Şube tanımlama CRUD'u
//
// Bu dosya, eskiden tek parça olan js/ui/pages/tanimlamalar.js
// (81 export, 1440+ satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function getSubeAdFromKodlar(bankaKodu, subeKodu) {
  if(!bankaKodu || !subeKodu) return '';
  const list = (DB.subeler && DB.subeler[bankaKodu]) || [];
  if(!list) return '';
  const match = list.find(s => s.k === subeKodu);
  return match ? match.a : '';
}

export function openSubeModal(bankaId) {
  _tanimlamalarState.setSubeModalBankaId(bankaId);
  const b = DB.bankalar.find(x => x.id === bankaId);
  if(!b) return;
  document.getElementById('sube-modal-title').textContent = b.kisa + ' — Şubeler';
  document.getElementById('sube-arama').value = '';
  document.getElementById('modal-sube').classList.add('open'); document.body.classList.add('modal-open'); _modalGenel._sidebarDim(true);
  refreshSubeModal();
}

export function refreshSubeModal() {
  const b = DB.bankalar.find(x => x.id === _tanimlamalarState.subeModalBankaId);
  if(!b) return;
  const ibanKod = b.ibanKod || '';
  const list = (DB.subeler && DB.subeler[ibanKod]) || [];
  _tanimlamalarState.setSubeListTumu([...list]);
  document.getElementById('sube-modal-banka-info').textContent = 'IBAN Kodu: ' + (ibanKod||'—') + ' · Toplam: ' + list.length + ' şube';
  document.getElementById('sube-arama').value = '';
  renderSubeList(list);
}

export function filterSubeList() {
  const q = document.getElementById('sube-arama').value.trim().toLowerCase();
  const filtered = q ? _tanimlamalarState.subeListTumu.filter(s => s.k.includes(q) || s.a.toLowerCase().includes(q)) : _tanimlamalarState.subeListTumu;
  renderSubeList(filtered);
}

export function renderSubeList(list) {
  const tbody = document.getElementById('sube-list-tbody');
  const bos = document.getElementById('sube-bos-mesaj');
  if(!list || !list.length) {
    tbody.innerHTML = '';
    bos.style.display = '';
    return;
  }
  bos.style.display = 'none';
  tbody.innerHTML = list.map(s => `<tr style="border-bottom:1px solid var(--border)">
    <td class="mono" style="padding:5px 8px;font-size:12px;color:var(--accent);white-space:nowrap">${s.k}</td>
    <td data-label="Şube Adı" style="padding:5px 8px;font-size:12px;color:var(--text)">${s.a}</td>
    <td style="padding:5px 4px;white-space:nowrap;text-align:right">
      <button class="btn btn-ghost btn-sm btn-act sube-edit-btn" data-k="${s.k}" style="margin-right:2px;font-size:11px"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/></svg></button>
      <button class="btn btn-danger btn-sm btn-act sube-del-btn" data-k="${s.k}" style="font-size:11px"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><polyline points="3,5 13,5"/><path d="M6 5V3h4v2M5 5l1 9h4l1-9"/></svg></button>
    </td>
  </tr>`).join('');
  // [ES module] onclick="editSube(...)" ve onclick="deleteSube(...)" kaldırıldı.
  tbody.querySelectorAll('.sube-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editSube(btn.getAttribute('data-k')));
  });
  tbody.querySelectorAll('.sube-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteSube(btn.getAttribute('data-k')));
  });
}

export function editSube(kod) {
  const b = DB.bankalar.find(x => x.id === _tanimlamalarState.subeModalBankaId);
  if(!b || !b.ibanKod) return;
  const list = DB.subeler[b.ibanKod] || [];
  const s = list.find(x => x.k === kod);
  if(!s) return;
  document.getElementById('sube-yeni-kod').value = s.k;
  document.getElementById('sube-yeni-ad').value = s.a;
  document.getElementById('sube-edit-orig-kod').value = s.k;
  document.getElementById('sube-kaydet-btn').textContent = 'Güncelle';
  document.getElementById('sube-yeni-kod').focus();
}

export function deleteSube(kod) {
  const b = DB.bankalar.find(x => x.id === _tanimlamalarState.subeModalBankaId);
  if(!b || !b.ibanKod) return;
  if(!DB.subeler[b.ibanKod]) return;
  DB.subeler[b.ibanKod] = DB.subeler[b.ibanKod].filter(s => s.k !== kod);
  saveData();
  _tanimlamalarAnaSayfa.renderTanimlamalar();
  refreshSubeModal();
}

export function saveSubeForm() {
  const b = DB.bankalar.find(x => x.id === _tanimlamalarState.subeModalBankaId);
  if(!b) return;
  const ibanKod = b.ibanKod || '';
  if(!ibanKod) { alert('Bu bankanın IBAN kodu yok, önce IBAN kodunu tanımlayın.'); return; }
  const kod = document.getElementById('sube-yeni-kod').value.trim();
  const ad  = document.getElementById('sube-yeni-ad').value.trim();
  if(!kod || !ad) { alert('Şube kodu ve adı zorunludur.'); return; }
  if(!DB.subeler[ibanKod]) DB.subeler[ibanKod] = [];
  const origKod = document.getElementById('sube-edit-orig-kod').value;
  if(origKod) {
    // edit mode: remove old, add new
    DB.subeler[ibanKod] = DB.subeler[ibanKod].filter(s => s.k !== origKod);
  } else {
    // add mode: check duplicate
    if(DB.subeler[ibanKod].find(s => s.k === kod)) { alert('Bu şube kodu zaten var.'); return; }
  }
  DB.subeler[ibanKod].push({k: kod, a: ad});
  DB.subeler[ibanKod].sort((a,b) => a.k.localeCompare(b.k));
  document.getElementById('sube-yeni-kod').value = '';
  document.getElementById('sube-yeni-ad').value = '';
  document.getElementById('sube-edit-orig-kod').value = '';
  document.getElementById('sube-kaydet-btn').textContent = 'Ekle';
  saveData();
  _tanimlamalarAnaSayfa.renderTanimlamalar();
  refreshSubeModal();
}

// ── DI-MIGRATION dual-mode kaydı ──────────────────────────────
provide('ui.pages.tanimlamalarSubeler', {
  getSubeAdFromKodlar,
  openSubeModal,
  refreshSubeModal,
  filterSubeList,
  renderSubeList,
  editSube,
  deleteSube,
  saveSubeForm,
});

