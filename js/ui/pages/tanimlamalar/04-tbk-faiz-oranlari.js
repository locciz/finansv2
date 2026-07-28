import { saveData } from '@core/app-core-base.js';
import { fmtDate, localDateStr, uid } from '@core/format.js';
import { DB } from '@core/state.js';
import { showToast } from '@components/modal-genel.js';
import { setDateInputValue } from '@components/money-input.js';
import { renderTahminBakiye } from '@pages/ozet.js';
import { _tbkFaizDuzenlemeId, set_tbkFaizDuzenlemeId } from '@pages/tbk-detay.js';
// ============================================================
// js/ui/pages/tanimlamalar/04-tbk-faiz-oranlari.js
// TBK (Tüketici kredisi) faiz oranları tanımlama
//
// Bu dosya, eskiden tek parça olan js/ui/pages/tanimlamalar.js
// (81 export, 1440+ satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function _tbkFaizFormButonGuncelle() {
  const btn = document.getElementById('tbk-faiz-submit-btn');
  const iptalBtn = document.getElementById('tbk-faiz-iptal-btn');
  if(btn) btn.textContent = _tbkFaizDuzenlemeId ? '✓ Güncelle' : '+ Faiz Oranı Ekle';
  if(iptalBtn) iptalBtn.style.display = _tbkFaizDuzenlemeId ? '' : 'none';
}

export function iptalTbkFaizDuzenle() {
  set_tbkFaizDuzenlemeId(null);
  const tarihEl = document.getElementById('tbk-faiz-tarih');
  if(tarihEl) setDateInputValue(tarihEl, localDateStr(new Date()));
  const oranEl = document.getElementById('tbk-faiz-oran');
  if(oranEl) oranEl.value = '';
  const stopajEl = document.getElementById('tbk-faiz-stopaj');
  if(stopajEl) stopajEl.value = '';
  _tbkFaizFormButonGuncelle();
  renderTbkFaizListesi();
}

export function editTbkFaizOrani(id) {
  const g = (DB.gelecekFaizOranlari||[]).find(x=>x.id===id);
  if(!g) return;
  set_tbkFaizDuzenlemeId(id);
  const tarihEl = document.getElementById('tbk-faiz-tarih');
  if(tarihEl) setDateInputValue(tarihEl, g.gecerlilikTarihi || '');
  const oranEl = document.getElementById('tbk-faiz-oran');
  if(oranEl) oranEl.value = g.oran != null ? g.oran : '';
  const stopajEl = document.getElementById('tbk-faiz-stopaj');
  if(stopajEl) stopajEl.value = g.stopaj != null ? g.stopaj : '';
  _tbkFaizFormButonGuncelle();
  renderTbkFaizListesi();
  if(tarihEl) tarihEl.focus();
}

export function addTbkFaizOrani() {
  const tarihEl = document.getElementById('tbk-faiz-tarih');
  const oranEl = document.getElementById('tbk-faiz-oran');
  const stopajEl = document.getElementById('tbk-faiz-stopaj');
  const tarih = tarihEl ? tarihEl.value : '';
  const oran = oranEl ? parseFloat(oranEl.value) : NaN;
  const stopajStr = stopajEl ? (stopajEl.value||'').trim() : '';
  const stopaj = stopajStr === '' ? null : parseFloat(stopajStr);
  if(!tarih) { showToast('Geçerlilik tarihi girin', 'error'); return; }
  if(isNaN(oran) || oran < 0) { showToast('Geçerli bir faiz oranı girin', 'error'); return; }
  if(stopaj != null && (isNaN(stopaj) || stopaj < 0 || stopaj > 100)) { showToast('Geçerli bir stopaj oranı girin (0-100)', 'error'); return; }
  if(!Array.isArray(DB.gelecekFaizOranlari)) DB.gelecekFaizOranlari = [];

  if(_tbkFaizDuzenlemeId) {
    // Düzenleme modu: mevcut kaydı güncelle. Tarih başka bir kayıtla çakışıyorsa
    // (kendisi hariç), o kayıt bu düzenlenenle birleştirilir (eski davranışla tutarlı).
    const duzenlenen = DB.gelecekFaizOranlari.find(g=>g.id === _tbkFaizDuzenlemeId);
    if(!duzenlenen) { set_tbkFaizDuzenlemeId(null); _tbkFaizFormButonGuncelle(); return; }
    const cakisan = DB.gelecekFaizOranlari.find(g=>g.gecerlilikTarihi === tarih && g.id !== _tbkFaizDuzenlemeId);
    if(cakisan) DB.gelecekFaizOranlari = DB.gelecekFaizOranlari.filter(g=>g.id !== cakisan.id);
    duzenlenen.gecerlilikTarihi = tarih;
    duzenlenen.oran = oran;
    duzenlenen.stopaj = stopaj;
    set_tbkFaizDuzenlemeId(null);
    showToast('Faiz oranı güncellendi', 'success');
  } else {
    // Aynı tarihe ait kayıt varsa güncelle, yoksa ekle
    const mevcut = DB.gelecekFaizOranlari.find(g=>g.gecerlilikTarihi === tarih);
    if(mevcut) { mevcut.oran = oran; mevcut.stopaj = stopaj; }
    else DB.gelecekFaizOranlari.push({ id: uid(), gecerlilikTarihi: tarih, oran, stopaj });
    showToast('Faiz oranı kaydedildi', 'success');
  }
  saveData();
  if(oranEl) oranEl.value = '';
  if(stopajEl) stopajEl.value = '';
  _tbkFaizFormButonGuncelle();
  renderTbkFaizListesi();
  renderTahminBakiye();
}

export function deleteTbkFaizOrani(id) {
  DB.gelecekFaizOranlari = (DB.gelecekFaizOranlari||[]).filter(g=>g.id !== id);
  if(_tbkFaizDuzenlemeId === id) { set_tbkFaizDuzenlemeId(null); _tbkFaizFormButonGuncelle(); }
  saveData();
  renderTbkFaizListesi();
  renderTahminBakiye();
}

export function renderTbkFaizListesi() {
  const el = document.getElementById('tbk-faiz-listesi');
  if(!el) return;
  const list = [...(DB.gelecekFaizOranlari||[])].sort((a,b)=>(a.gecerlilikTarihi||'').localeCompare(b.gecerlilikTarihi||''));
  if(!list.length) {
    el.innerHTML = `<div class="tbk-faiz-empty">Henüz faiz oranı varsayımı girilmedi — girilmezse her mevduatın kendi güncel oranı kullanılır.</div>`;
    return;
  }
  el.innerHTML = `<div class="tbk-faiz-listesi-wrap">${list.map(g=>`<div class="tbk-faiz-row${g.id===_tbkFaizDuzenlemeId?' tbk-faiz-row-editing':''}">
    <div class="tbk-faiz-row-main">
      <span class="tbk-faiz-row-date"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${fmtDate(g.gecerlilikTarihi)}</span>
      <span class="badge badge-purple tbk-faiz-row-oran">%${Number(g.oran).toLocaleString('tr-TR',{maximumFractionDigits:2})}</span>
      ${g.stopaj != null ? `<span class="badge badge-gray tbk-faiz-row-stopaj">stopaj %${Number(g.stopaj).toLocaleString('tr-TR',{maximumFractionDigits:2})}</span>` : ''}
    </div>
    <div class="tbk-faiz-row-actions">
      <button type="button" class="tbk-faiz-row-btn tbk-faiz-edit-btn" data-id="${g.id}" title="Düzenle">✎</button>
      <button type="button" class="tbk-faiz-row-btn tbk-faiz-row-btn-danger tbk-faiz-del-btn" data-id="${g.id}" title="Sil">✕</button>
    </div>
  </div>`).join('')}</div>`;
  // [ES module] onclick="editTbkFaizOrani(...)" ve onclick="deleteTbkFaizOrani(...)" kaldırıldı.
  el.querySelectorAll('.tbk-faiz-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editTbkFaizOrani(btn.getAttribute('data-id')));
  });
  el.querySelectorAll('.tbk-faiz-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTbkFaizOrani(btn.getAttribute('data-id')));
  });
}

