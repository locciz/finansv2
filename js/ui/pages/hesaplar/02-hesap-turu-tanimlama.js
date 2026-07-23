import { saveData } from '../../../core/app-core-base.js';
import { localDateStr, uid } from '../../../core/format.js';
import { DB } from '../../../core/state.js';
import { getStopajOrani } from '../../../domain/hesaplamalar.js';
import { showConfirm, validateRequiredFields } from '../../components/modal-genel.js';
import { editHesapTurId, setEditHesapTurId } from './00-state.js';
import { hesapTuruRenk } from './01-genel-yardimcilar.js';
import { renderHesapTurFiltreler } from './04-hesap-liste-render.js';
import { _renkKolonHtml, _tanimBadgeHtml } from '../tanimlamalar/01-genel-yardimcilar.js';
import { closeModal, openModal } from '../../components/modal-genel.js';
// ============================================================
// js/ui/pages/hesaplar/02-hesap-turu-tanimlama.js
// Hesap türü tanımlama CRUD'u
//
// Bu dosya, eskiden tek parça olan js/ui/pages/hesaplar.js
// (49 export, 991 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function openHesapTurModal(id=null) {
  setEditHesapTurId(id);
  document.getElementById('hesap-tur-modal-title').textContent = id ? 'Hesap Türü Düzenle' : 'Hesap Türü Ekle';
  if(id) {
    const t = (DB.hesapTurleri||[]).find(x=>x.id===id);
    if(t) {
      document.getElementById('hesap-tur-ad').value = t.ad;
      document.getElementById('hesap-tur-kod').value = t.kod;
      document.getElementById('hesap-tur-renk').value = t.renk || '';
    }
  } else {
    document.getElementById('hesap-tur-ad').value = '';
    document.getElementById('hesap-tur-kod').value = '';
    document.getElementById('hesap-tur-renk').value = '';
  }
  openModal('modal-hesap-tur');
}

export function saveHesapTur() {
  const ad = document.getElementById('hesap-tur-ad').value.trim();
  const kod = document.getElementById('hesap-tur-kod').value.trim();
  const renk = document.getElementById('hesap-tur-renk').value || '';
  if(!validateRequiredFields([{id:'hesap-tur-ad',msg:'Ad zorunlu'},{id:'hesap-tur-kod',msg:'Kod zorunlu'}])) return;
  if(!DB.hesapTurleri) DB.hesapTurleri = [];
  if(editHesapTurId) {
    const idx = DB.hesapTurleri.findIndex(x=>x.id===editHesapTurId);
    if(idx>=0) DB.hesapTurleri[idx] = {id:editHesapTurId, ad, kod, renk};
  } else {
    DB.hesapTurleri.push({id:uid(), ad, kod, renk});
  }
  saveData();
  closeModal('modal-hesap-tur');
  renderHesapTurTablo();
  renderHesapTurFiltreler();
}

export function deleteHesapTur(id) {
  showConfirm('Bu hesap türü silinsin mi?', ()=>{
    DB.hesapTurleri = (DB.hesapTurleri||[]).filter(x=>x.id!==id);
    saveData();
    renderHesapTurTablo();
    renderHesapTurFiltreler();
  });
}

export function renderHesapTurTablo() {
  const tbody = document.getElementById('hesap-tur-tbody');
  if(!tbody) return;
  const liste = DB.hesapTurleri||[];
  if(!liste.length) { tbody.innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:16px">Kayıt yok</td></tr>'; return; }
  tbody.innerHTML = liste.map(t=>`<tr>
    <td>${t.ad}</td>
    <td>${_tanimBadgeHtml(t.kod, hesapTuruRenk(t.kod), true)}</td>
    <td>${_renkKolonHtml(t.renk)}</td>
    <td style="white-space:nowrap">
      <button class="btn btn-ghost btn-sm btn-act hesap-tur-edit-btn" data-id="${t.id}" style="margin-right:4px"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/></svg></button>
      <button class="btn btn-danger btn-sm btn-act hesap-tur-del-btn" data-id="${t.id}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><polyline points="3,5 13,5"/><path d="M6 5V3h4v2M5 5l1 9h4l1-9"/></svg></button>
    </td>
  </tr>`).join('');
  // [ES module] onclick="openHesapTurModal(...)" ve onclick="deleteHesapTur(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
  tbody.querySelectorAll('.hesap-tur-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openHesapTurModal(btn.getAttribute('data-id')));
  });
  tbody.querySelectorAll('.hesap-tur-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteHesapTur(btn.getAttribute('data-id')));
  });
}

export function onHesapTurChange() {
  // "vadeli" türü seçiliyse otomatik günlük vadeli anlamsız (bir vadeli hesap
  // başka bir vadeliye akıtılamaz) — toggle'ı kapatıp devre dışı bırak.
  const tur = (document.getElementById('hesap-tur')||{}).value || '';
  const toggle = document.getElementById('hesap-oto-gunluk-toggle');
  const sub = document.getElementById('hesap-oto-gunluk-sub');
  if(!toggle) return;
  const engelli = tur === 'vadeli';
  toggle.disabled = engelli;
  if(engelli && toggle.checked) { toggle.checked = false; onHesapOtoGunlukToggleChange(); }
  if(sub) sub.textContent = engelli
    ? 'Vadeli hesaplarda kullanılamaz — bu özellik yalnızca vadesiz hesaplar için geçerlidir'
    : 'Bakiye her gün otomatik olarak 1 günlük vadeli mevduata aktarılır, vade dolunca ana para + faiz bu hesaba geri döner ve döngü kendini yeniler';
}

export function onHesapOtoGunlukToggleChange() {
  const checked = document.getElementById('hesap-oto-gunluk-toggle').checked;
  document.getElementById('hesap-oto-gunluk-panel').style.display = checked ? '' : 'none';
  if(checked && !document.getElementById('hesap-oto-gunluk-stopaj').value) {
    document.getElementById('hesap-oto-gunluk-stopaj').value = getStopajOrani(localDateStr(new Date()));
  }
}

