import { saveData } from '../../../core/app-core-base.js';
import { fmtCur, localDateStr, uid } from '../../../core/format.js';
import { DB } from '../../../core/state.js';
import { showConfirm, showToast } from '../../components/modal-genel.js';
import { getMoneyInput, setMoneyInput } from '../../components/money-input.js';
import { _editGrupId, set_editGrupId } from './00-state.js';
import { getKartKullanim } from './01-kart-data.js';
import { editKartId } from './09-kart-altyapi.js';
import { renderKartlar } from './10-kart-liste.js';
import { closeModal, openModal } from '../../components/modal-genel.js';
// ============================================================
// js/ui/pages/kartlar/07-ortak-limit-grubu.js
// Ortak limit grubu yönetimi (birden fazla kartın limiti paylaşması)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/kartlar.js (145
// export, 3600+ satır) dosyasının, fonksiyon isim/işlev
// kümelerine göre bölünmüş bir parçasıdır. Kod SATIR SATIR
// AYNI kaldı — sadece dosya sınırı ve gruplama değişti.
// ============================================================
export function getOrtakGrupKullanim(grupId) {
  return (DB.kartlar||[])
    .filter(k => k.ortakLimitGrupId === grupId)
    .reduce((s, k) => s + getKartKullanim(k.id), 0);
}

// Bir kartın kullanılabilir limitini döndürür (ortak grup varsa grup tabanlı, yoksa bireysel)

export function saveOrtakLimitGrubu(id, ad, limit) {
  if (!DB.ortakLimitGruplari) DB.ortakLimitGruplari = [];
  if (id) {
    const idx = DB.ortakLimitGruplari.findIndex(g => g.id === id);
    if (idx >= 0) DB.ortakLimitGruplari[idx] = { id, ad, limit };
    else DB.ortakLimitGruplari.push({ id, ad, limit });
  } else {
    DB.ortakLimitGruplari.push({ id: uid(), ad, limit });
  }
  saveData();
}

// ── Kart modalı: Ortak Limit Grubu dropdown populate ─────────────
// kartId: önizlemenin "bu kart zaten grupta mı" kontrolü için hangi kartın
// düzenlendiğini AÇIKÇA belirtir. Verilmezse global editKartId'ye düşer —
// ama editKart() içinde openModal() senkron olarak populateKartModal()'ı
// (henüz gerçek kart verisi olmadan) bir kez çağırdığı için, global değişkene
// güvenmek yerine gerçek kart nesnesinin id'sini doğrudan geçirmek daha
// güvenilir: "zaten gruba dahil kartı tekrar düzenlerken önizleme yanlışlıkla
// 'bu kart eklenecek' gösteriyor" hatasının kök nedeni buydu.

export function populateOrtakGrupSelect(seciliGrupId, kartId) {
  const el = document.getElementById('kart-ortak-grup');
  if (!el) return;
  const gruplar = DB.ortakLimitGruplari || [];
  el.innerHTML = '<option value="">— Bireysel limit (grup yok) —</option>'
    + gruplar.map(g => `<option value="${g.id}"${g.id===seciliGrupId?' selected':''}>${g.ad} (${fmtCur(g.limit, 'TRY')})</option>`).join('');
  el.value = seciliGrupId || '';
  renderKartOrtakGrupOnizleme(seciliGrupId || '', kartId !== undefined ? kartId : editKartId);
}

// Dropdown değiştiğinde canlı önizlemeyi güncelle

export function onKartOrtakGrupChange() {
  const el = document.getElementById('kart-ortak-grup');
  const grupId = el ? el.value : '';
  renderKartOrtakGrupOnizleme(grupId, editKartId);
  _syncKartLimitAlaninaGrupLimit(grupId);
}

export function _syncKartLimitAlaninaGrupLimit(grupId) {
  const limitInput = document.getElementById('kart-limit');
  const limitWrap  = limitInput ? limitInput.closest('.money-wrap') : null;
  const limitLabel = limitInput ? limitInput.closest('div')?.querySelector('label') : null;
  if (!limitInput) return;
  if (grupId) {
    const grup = (DB.ortakLimitGruplari||[]).find(g => g.id === grupId);
    if (grup) {
      setMoneyInput('kart-limit', grup.limit || 0);
      limitInput.readOnly = true;
      limitInput.style.opacity = '0.5';
      limitInput.style.cursor  = 'not-allowed';
      if (limitWrap) limitWrap.title = 'Limit grup tarafından belirleniyor — grubu düzenleyerek değiştirebilirsiniz';
      if (limitLabel) limitLabel.innerHTML = 'Toplam Limit <span style="font-size:10px;color:var(--violet);font-weight:500">(grup limiti)</span>';
    }
  } else {
    limitInput.readOnly = false;
    limitInput.style.opacity = '';
    limitInput.style.cursor  = '';
    if (limitWrap) limitWrap.title = '';
    if (limitLabel) limitLabel.innerHTML = 'Güncel Toplam Limit (₺)';
  }
}

// Kart modalında seçili gruba ait canlı özet kartı: limit, doluluk çubuğu, üye kartlar

export function renderKartOrtakGrupOnizleme(grupId, kartId) {
  const el = document.getElementById('kart-ortak-grup-onizleme');
  if (!el) return;
  if (!grupId) { el.innerHTML = ''; return; }
  const grup = (DB.ortakLimitGruplari||[]).find(g => g.id === grupId);
  if (!grup) { el.innerHTML = ''; return; }
  // Hangi kartın düzenlendiği: açıkça geçildiyse onu, geçilmediyse global
  // editKartId'yi kullan (geriye dönük uyumluluk için).
  const aktifKartId = kartId !== undefined ? kartId : editKartId;
  const uyeler = (DB.kartlar||[]).filter(k => k.ortakLimitGrupId === grupId);
  const grupKullanim = getOrtakGrupKullanim(grupId);
  const pct = grup.limit > 0 ? Math.min(100, grupKullanim / grup.limit * 100) : 0;
  const duzenlenenIcerideMi = aktifKartId && uyeler.some(k => k.id === aktifKartId);
  const satirlar = uyeler.length
    ? uyeler.map(k => {
        const aktif = k.id === aktifKartId;
        return `<div class="ortak-grup-onizleme-kart-row${aktif?' aktif':''}">
          <span>${aktif ? '→ ' : ''}${k.ad}</span>
          <span class="mono">${fmtCur(getKartKullanim(k.id), k.paraBirimi||'TRY')}</span>
        </div>`;
      }).join('')
    : '';
  const buKartYeniMi = !duzenlenenIcerideMi; // bu kart henüz gruba kayıtlı değil (yeni seçim veya yeni kart)
  el.innerHTML = `<div class="ortak-grup-onizleme">
    <div class="ortak-grup-onizleme-head">
      <span class="ortak-grup-onizleme-ad">🔗 ${grup.ad}</span>
      <span class="ortak-grup-onizleme-limit">${fmtCur(grup.limit, 'TRY')}</span>
    </div>
    <div class="ortak-grup-onizleme-bar"><div class="ortak-grup-onizleme-bar-fill" style="width:${pct}%"></div></div>
    <div class="ortak-grup-onizleme-kartlar">
      ${satirlar}
      ${buKartYeniMi ? `<div class="ortak-grup-onizleme-kart-row aktif"><span>→ Bu kart (kaydedince eklenecek)</span><span class="mono">—</span></div>` : ''}
      ${!uyeler.length && !buKartYeniMi ? `<div class="ortak-grup-onizleme-empty">Bu gruba henüz başka kart eklenmedi.</div>` : ''}
    </div>
  </div>`;
}

export function openOrtakGrupModal(grupId) {
  set_editGrupId(grupId || null);
  const grup = grupId ? (DB.ortakLimitGruplari||[]).find(g=>g.id===grupId) : null;
  document.getElementById('ortak-grup-modal-title').textContent = grup ? 'Grubu Düzenle' : 'Yeni Ortak Limit Grubu';
  document.getElementById('ortak-grup-ad').value = grup ? grup.ad : '';
  setMoneyInput('ortak-grup-limit', grup ? grup.limit : '');
  renderOrtakGrupKartlar(grupId);
  openModal('modal-ortak-grup');
}

export function renderOrtakGrupKartlar(grupId) {
  const el = document.getElementById('ortak-grup-kartlar');
  if (!el) return;
  if (!grupId) { el.innerHTML = '<div style="font-size:12px;color:var(--text3)">Grup oluşturulduktan sonra kartlar buradan görülebilir.</div>'; return; }
  const kartlar = (DB.kartlar||[]).filter(k=>k.ortakLimitGrupId===grupId);
  if (!kartlar.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text3)">Bu gruba henüz kart eklenmedi.</div>'; return; }
  el.innerHTML = kartlar.map(k=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--surface3);border-radius:8px;margin-bottom:4px">
    <span style="font-size:13px;font-weight:600">${k.ad}</span>
    <span class="mono" style="font-size:12px;color:var(--warn)">${fmtCur(getKartKullanim(k.id), k.paraBirimi||'TRY')} kullanımda</span>
  </div>`).join('');
}

export function saveOrtakGrupModal() {
  const ad = document.getElementById('ortak-grup-ad').value.trim();
  const limit = getMoneyInput('ortak-grup-limit') || 0;
  if (!ad) { showToast('Grup adı zorunlu', 'warn'); return; }
  if (!limit) { showToast('Limit giriniz', 'warn'); return; }
  const yeniGrupId = _editGrupId || uid();

  // Eğer düzenleme modundaysa eski limiti al, değiştiyse üye kartları güncelle
  const eskiGrup = _editGrupId ? (DB.ortakLimitGruplari||[]).find(g=>g.id===_editGrupId) : null;
  const eskiLimit = eskiGrup ? eskiGrup.limit : null;
  const limitDegisti = eskiLimit !== null && eskiLimit !== limit;

  saveOrtakLimitGrubu(yeniGrupId, ad, limit);

  // Grup limiti değiştiyse üye kartların k.limit ve limitGecmisi'ni güncelle
  if (limitDegisti) {
    const bugun = localDateStr(new Date());
    (DB.kartlar||[]).forEach(k => {
      if (k.ortakLimitGrupId !== yeniGrupId) return;
      // Limit geçmişine yeni kayıt ekle (aynı mantık saveKart'taki ile aynı)
      if (!k.limitGecmisi) k.limitGecmisi = [];
      const sorted = k.limitGecmisi.slice().sort((a,b)=>b.tarih.localeCompare(a.tarih));
      const guncelLimit = sorted.length > 0 ? sorted[0].limit : null;
      if (guncelLimit !== limit) {
        if (sorted.length > 0) {
          const sonIdx = k.limitGecmisi.findIndex(g=>g.tarih===sorted[0].tarih&&g.limit===sorted[0].limit);
          if (sonIdx >= 0) k.limitGecmisi[sonIdx].bitisTarih = bugun;
        }
        k.limitGecmisi.push({ tarih: bugun, limit, kaynak: 'grup' });
        const finalSorted = k.limitGecmisi.slice().sort((a,b)=>b.tarih.localeCompare(a.tarih));
        k.limit = finalSorted[0].limit;
        k.limitTarih = finalSorted[0].tarih;
      }
    });
    saveData();
    showToast(`Grup güncellendi — ${(DB.kartlar||[]).filter(k=>k.ortakLimitGrupId===yeniGrupId).length} kartın limiti güncellendi`, 'success');
  }
  closeModal('modal-ortak-grup');
  renderKartlar();
  // Kart modalı açıksa dropdown'u güncelle ve az önce kaydedilen/oluşturulan grubu seçili getir
  populateOrtakGrupSelect(yeniGrupId);
  // Kart modal açıksa limit alanını da sync et (grup limiti değişmiş olabilir)
  _syncKartLimitAlaninaGrupLimit(document.getElementById('kart-ortak-grup')?.value || '');
  renderOrtakGrupYonetimSatiri();
  if (!limitDegisti) showToast(_editGrupId ? 'Grup güncellendi' : 'Grup oluşturuldu');
  set_editGrupId(null);
}

export function deleteOrtakGrup(grupId) {
  showConfirm('Bu grubu silmek istiyor musunuz? Kartların bireysel limitlerine dönecek.', () => {
    DB.ortakLimitGruplari = (DB.ortakLimitGruplari||[]).filter(g=>g.id!==grupId);
    // Kartlardan grubu temizle
    (DB.kartlar||[]).forEach(k=>{ if(k.ortakLimitGrupId===grupId) k.ortakLimitGrupId=''; });
    saveData();
    renderKartlar();
    // Kart modalı açıksa dropdown'u ve yönetim satırını güncelle
    const grupSelect = document.getElementById('kart-ortak-grup');
    if (grupSelect && grupSelect.value === grupId) {
      populateOrtakGrupSelect('');
    } else {
      populateOrtakGrupSelect(grupSelect ? grupSelect.value : '');
    }
    renderOrtakGrupYonetimSatiri();
    showToast('Grup silindi');
  });
}

// ── Ortak Limit Grubunu kart modalında göster/yönet ──────────────

export function renderOrtakGrupYonetimSatiri() {
  const el = document.getElementById('ortak-grup-yonetim-satiri');
  if (!el) return;
  const gruplar = DB.ortakLimitGruplari || [];
  if (!gruplar.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">
    ${gruplar.map(g=>`<div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface3);border-radius:8px;padding:5px 10px">
      <span style="font-size:12px;color:var(--text2)">${g.ad} · <span class="mono">${fmtCur(g.limit,'TRY')}</span></span>
      <div style="display:flex;gap:5px">
        <button class="btn btn-ghost btn-sm ortak-grup-edit-btn" data-id="${g.id}" style="padding:2px 8px;font-size:11px">Düzenle</button>
        <button class="btn btn-danger btn-sm ortak-grup-del-btn" data-id="${g.id}" style="padding:2px 8px;font-size:11px">Sil</button>
      </div>
    </div>`).join('')}
  </div>`;
  // [ES module] onclick="openOrtakGrupModal(...)" ve onclick="deleteOrtakGrup(...)" kaldırıldı.
  el.querySelectorAll('.ortak-grup-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openOrtakGrupModal(btn.getAttribute('data-id')));
  });
  el.querySelectorAll('.ortak-grup-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteOrtakGrup(btn.getAttribute('data-id')));
  });
}

