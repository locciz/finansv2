import { DB } from '../../../core/state.js';
import { seçKategoriChip } from '../tanimlamalar/03-kategoriler.js';
import { openModal } from '../../components/modal-genel.js';
// ============================================================
// js/ui/pages/islemler/06-islem-kategori-secici.js
// İşlem kategori seçim widget'ı
//
// Bu dosya, eskiden tek parça olan js/ui/pages/islemler.js
// (49 export, 1087 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function renderIslemKategoriChips() {
  const grid = document.getElementById('islem-kategori-grid');
  if(!grid) {
    renderIslemKategoriButon();
    return;
  }
  const q = (document.getElementById('islem-kategori-arama')||{}).value || '';
  const secili = document.getElementById('islem-kategori').value || '';
  const tum = (DB.kategoriler||[]).filter(k => !q || k.ad.toLowerCase().includes(q.toLowerCase()));
  const temizChip = `<button type="button" class="kat-chip-clear" data-kat-id="" style="margin-bottom:10px">✕ Kategorisiz bırak</button>`;
  if(!tum.length) {
    grid.innerHTML = temizChip + `<div class="kat-chip-empty">Eşleşen kategori yok</div>`;
    bindIslemKategoriChipClicks(grid);
    renderIslemKategoriButon();
    return;
  }
  const chip = k => {
    const sel = k.id == secili ? ' selected' : '';
    const turCls = k.tur === 'gelir' ? ' kat-tur-gelir' : k.tur === 'gider' ? ' kat-tur-gider' : '';
    return `<button type="button" class="kat-chip${sel}${turCls}" data-kat-id="${k.id}" title="${k.tur}">
      <span class="kat-chip-icon">${k.ikon||'📂'}</span>${k.ad}
    </button>`;
  };
  const giderler = tum.filter(k => k.tur === 'gider');
  const gelirler = tum.filter(k => k.tur === 'gelir');
  const digerler = tum.filter(k => k.tur !== 'gider' && k.tur !== 'gelir');
  let html = temizChip;
  if(giderler.length) html += `<div class="kat-chip-group-title tur-gider">Gider</div><div class="kat-chip-group">${giderler.map(chip).join('')}</div>`;
  if(gelirler.length) html += `<div class="kat-chip-group-title tur-gelir">Gelir</div><div class="kat-chip-group">${gelirler.map(chip).join('')}</div>`;
  if(digerler.length) html += `<div class="kat-chip-group-title tur-diger">Diğer</div><div class="kat-chip-group">${digerler.map(chip).join('')}</div>`;
  grid.innerHTML = html;
  bindIslemKategoriChipClicks(grid);
  renderIslemKategoriButon();
}

// [ES module] onclick="seçKategoriChip(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
function bindIslemKategoriChipClicks(grid) {
  grid.querySelectorAll('[data-kat-id]').forEach(btn => {
    btn.addEventListener('click', () => seçKategoriChip(btn.getAttribute('data-kat-id')));
  });
}

export function openIslemKategoriModal() {
  const arama = document.getElementById('islem-kategori-arama');
  if(arama) arama.value = '';
  renderIslemKategoriChips();
  openModal('modal-islem-kategori');
}

export function renderIslemKategoriButon() {
  const hidden = document.getElementById('islem-kategori');
  const btn = document.getElementById('islem-kategori-btn');
  const icon = document.getElementById('islem-kategori-btn-icon');
  const label = document.getElementById('islem-kategori-btn-label');
  if(!hidden || !btn || !icon || !label) return;
  const kat = (DB.kategoriler||[]).find(k => k.id === hidden.value);
  if(kat) {
    icon.textContent = kat.ikon || '🏷️';
    label.textContent = kat.ad;
    btn.classList.remove('is-empty');
  } else {
    icon.textContent = '🏷️';
    label.textContent = 'Kategori seç…';
    btn.classList.add('is-empty');
  }
}

