import { saveData } from '../../../core/app-core-base.js';
import { fmtDate, localDateStr, uid } from '../../../core/format.js';
import { DB } from '../../../core/state.js';
import { showConfirm, validateRequiredFields } from '../../components/modal-genel.js';
import { setDateInputValue } from '../../components/money-input.js';
import { editHesapId } from '../hesaplar/04-hesap-liste-render.js';
import { ORAN_CONFIG, editOranId, editOranTip, setEditOranId, setEditOranTip } from './00-state.js';
import { gecmisListesiRenderEt } from '../../components/step-wizard.js';
import { closeModal, openModal } from '../../components/modal-genel.js';
// ============================================================
// js/ui/pages/tanimlamalar/05-genel-oran-tablolari.js
// Genel oran tabloları — KMH/gecikme/KKDF/BSMV/stopaj + oto günlük oran geçmişi
//
// Bu dosya, eskiden tek parça olan js/ui/pages/tanimlamalar.js
// (81 export, 1440+ satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function renderOtoGunlukOranGecmis(gecmis) {
  const panel = document.getElementById('hesap-oto-gunluk-oran-gecmis-liste');
  gecmisListesiRenderEt(panel, gecmis, {
    bosMesaj: 'Henüz oran kaydı yok',
    deger: g => g.faizOran,
    degerHtml: g => `${g.faizOran}% / ${g.stopaj}%`,
    titleHtml: g => `Faiz ${g.faizOran}% / Stopaj ${g.stopaj}%`,
    farkHtml: (g, fark) => `${fark.toFixed(2)}%`,
    silHandler: () => otoGunlukOranGecmisSonSil()
  });
}

export function readOtoGunlukOranGecmisi() {
  if(!editHesapId) return [];
  const h = (DB.hesaplar||[]).find(x=>x.id===editHesapId);
  return (h && h.otoGunlukOranGecmisi) ? h.otoGunlukOranGecmisi : [];
}

export function otoGunlukOranGecmisSonSil() {
  if(!editHesapId) return;
  const idx = (DB.hesaplar||[]).findIndex(h=>h.id===editHesapId);
  if(idx<0) return;
  const h = DB.hesaplar[idx];
  const gecmis = (h.otoGunlukOranGecmisi||[]).slice().sort((a,b)=>b.tarih.localeCompare(a.tarih));
  if(gecmis.length <= 1) {
    showConfirm('Tek kayıt kaldı. Faiz/stopaj geçmişi tamamen silinsin mi?', ()=>{
      h.otoGunlukOranGecmisi = [];
      h.otoGunlukFaizOran = null;
      h.otoGunlukStopaj = null;
      saveData();
      renderOtoGunlukOranGecmis([]);
      document.getElementById('hesap-oto-gunluk-faiz').value = '';
      document.getElementById('hesap-oto-gunluk-stopaj').value = '';
    });
    return;
  }
  showConfirm('Son faiz/stopaj kaydı silinsin mi? Bir önceki orana dönülecek.', ()=>{
    const yeniGecmis = gecmis.slice(1); // tarihe göre sıralı, 0.indeks en yeni
    h.otoGunlukOranGecmisi = yeniGecmis;
    const onceki = yeniGecmis[0];
    h.otoGunlukFaizOran = onceki ? onceki.faizOran : null;
    h.otoGunlukStopaj = onceki ? onceki.stopaj : null;
    saveData();
    renderOtoGunlukOranGecmis(yeniGecmis);
    document.getElementById('hesap-oto-gunluk-faiz').value = h.otoGunlukFaizOran != null ? h.otoGunlukFaizOran : '';
    document.getElementById('hesap-oto-gunluk-stopaj').value = h.otoGunlukStopaj != null ? h.otoGunlukStopaj : '';
  });
}

export function renderOranTablo(tip) {
  const cfg = ORAN_CONFIG[tip];
  const tbody = document.getElementById(cfg.tbodyId);
  if(!tbody) return;
  const liste = [...(DB[cfg.dbKey]||[])].sort((a,b)=>a.tarih.localeCompare(b.tarih));
  if(!liste.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:16px">Kayıt yok</td></tr>';
    return;
  }
  const today = localDateStr(new Date());
  tbody.innerHTML = liste.map((row, i) => {
    // Son geçerli olan kaydı vurgula
    const isActive = row.tarih <= today && (i === liste.length-1 || liste[i+1].tarih > today);
    return `<tr>
      <td class="mono" style="${isActive?'color:var(--accent2);font-weight:600':''}">${fmtDate(row.tarih)}${isActive?' <span style="font-size:9px;background:rgba(0,232,138,.12);color:var(--accent2);padding:1px 5px;border-radius:4px;margin-left:4px">GEÇERLİ</span>':''}</td>
      <td class="mono" style="${isActive?'color:var(--accent2);font-weight:600':''}">%${row.oran}</td>
      <td style="text-align:right">
        <button class="btn btn-ghost btn-sm btn-act oran-edit-btn" data-tip="${tip}" data-id="${row.id}" style="margin-right:4px"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/></svg></button>
        <button class="btn btn-danger btn-sm btn-act oran-del-btn" data-tip="${tip}" data-id="${row.id}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><polyline points="3,5 13,5"/><path d="M6 5V3h4v2M5 5l1 9h4l1-9"/></svg></button>
      </td>
    </tr>`;
  }).join('');
  // [ES module] onclick="openOranModal(...)" ve onclick="deleteOran(...)" kaldırıldı.
  tbody.querySelectorAll('.oran-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openOranModal(btn.getAttribute('data-tip'), btn.getAttribute('data-id')));
  });
  tbody.querySelectorAll('.oran-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteOran(btn.getAttribute('data-tip'), btn.getAttribute('data-id')));
  });
}

export function renderTumOranTablolari() {
  Object.keys(ORAN_CONFIG).forEach(renderOranTablo);
}

export function openOranModal(tip, id=null) {
  setEditOranTip(tip);
  setEditOranId(id);
  const cfg = ORAN_CONFIG[tip];
  document.getElementById('oran-modal-title').textContent = (id ? 'Düzenle: ' : 'Ekle: ') + cfg.modalTitle;
  document.getElementById('oran-oran-label').innerHTML = cfg.label + ' <span style="color:var(--danger)">*</span>';
  const tarihEl = document.getElementById('oran-tarih');
  if(id) {
    const row = (DB[cfg.dbKey]||[]).find(r=>r.id===id);
    if(row) {
      setDateInputValue(tarihEl, row.tarih);
      tarihEl.dispatchEvent(new Event('change', { bubbles: true }));
      document.getElementById('oran-oran').value  = row.oran;
    }
  } else {
    setDateInputValue(tarihEl, localDateStr(new Date()));
    tarihEl.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('oran-oran').value  = '';
  }
  openModal('modal-oran');
}

export function saveOran() {
  const tarih = document.getElementById('oran-tarih').value;
  const oran  = parseFloat(document.getElementById('oran-oran').value);
  if(!validateRequiredFields([{id:'oran-tarih',msg:'Tarih zorunlu'},{id:'oran-oran',msg:'Oran zorunlu'}])) return;
  const cfg = ORAN_CONFIG[editOranTip];
  if(!DB[cfg.dbKey]) DB[cfg.dbKey] = [];
  if(editOranId) {
    const idx = DB[cfg.dbKey].findIndex(r=>r.id===editOranId);
    if(idx>=0) DB[cfg.dbKey][idx] = {id:editOranId, tarih, oran};
  } else {
    DB[cfg.dbKey].push({id:uid(), tarih, oran});
  }
  saveData();
  closeModal('modal-oran');
  renderOranTablo(editOranTip);
}

export function deleteOran(tip, id) {
  if(!confirm('Bu oran kaydı silinsin mi?')) return;
  const cfg = ORAN_CONFIG[tip];
  DB[cfg.dbKey] = (DB[cfg.dbKey]||[]).filter(r=>r.id!==id);
  saveData();
  renderOranTablo(tip);
}


