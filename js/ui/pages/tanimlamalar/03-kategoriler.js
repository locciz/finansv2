import { saveData } from '@core/app-core-base.js';
import { uid } from '@core/format.js';
import { inject } from '@core/container.js';
// [DI-MIGRATION] core.state zaten container'da kayıtlı. Bu dosyada
// DB.kategoriler.push(...) / DB.kategoriler = ... gibi doğrudan MUTASYONLAR
// var, bu yüzden container'daki gerçek nesneyle aynı kimlikte kalmak kritik
// (bkz. Tur 3'teki "kritik doğrulama" notu). `const _coreState = inject(...)`
// YERİNE fonksiyon-getter kullanılıyor: bu dosya elden.js ve
// islemler/06-islem-kategori-secici.js ile DAİRESEL olduğu için (aşağıdaki
// nota bakın), top-level const/var TDZ/circular-reentry riskine açık olurdu
// (bkz. DI-MIGRATION.md'deki geçmiş format.js/state.js hataları). Function
// declaration hoisted olduğu için döngüsel yeniden-girişte bile güvenli.
function getCoreState() { return inject('core.state'); }
import { phSet, showConfirm, showToast } from '@components/modal-genel.js';
import { _restoreKatFiltreFromDB } from '@components/tablo-filtre-sirala.js';
import { _katFilter, set_katFilter } from '@pages/ekstreler/02-ekstre-render.js';
// [NOT] elden.js VE islemler/06-islem-kategori-secici.js, BU dosyayı da
// geri import ediyor (dairesel: elden.js → onEldenTurChange, 06-islem-...js
// → renderIslemKategoriChips). Bu importların KENDİSİ sorun değil — ES
// module "live binding" TDZ'ye tabi değildir, isim modül evaluation'ı
// bitmeden çağrılsa bile (fonksiyon gövdesi içinde, top-level'da değil)
// güncel değeri okur. Asıl risk bunları top-level bir const/var'a YENİDEN
// ATAMAK olurdu (bkz. yukarıdaki core.state notu) — o yüzden burada
// SARMALAMADAN, doğrudan import edilen isimleriyle kullanılıyorlar.
import { onEldenTurChange } from '@pages/elden.js';
import { renderIslemKategoriChips } from '@pages/islemler/06-islem-kategori-secici.js';
import { KAT_ONERILER, KAT_TUR_STIL, editKategoriId, setEditKategoriId } from '@pages/tanimlamalar/00-state.js';
import { closeModal, openModal } from '@components/modal-genel.js';
// ============================================================
// js/ui/pages/tanimlamalar/03-kategoriler.js
// Gelir/gider kategorileri CRUD + kategori önerisi
//
// Bu dosya, eskiden tek parça olan js/ui/pages/tanimlamalar.js
// (81 export, 1440+ satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function seçKategoriChip(id) {
  const hidden = document.getElementById('islem-kategori');
  if(!hidden) return;
  hidden.value = id || '';
  renderIslemKategoriChips();
  closeModal('modal-islem-kategori');
}

export function renderKategoriOzetStrip() {
  const strip = document.getElementById('kategori-ozet-strip');
  if(!strip) return;
  const tum = getCoreState().DB.kategoriler||[];
  const gider = tum.filter(k=>k.tur==='gider').length;
  const gelir = tum.filter(k=>k.tur==='gelir').length;
  const diger = tum.length - gider - gelir;
  const aktif = (v) => _katFilter === v ? ' active' : '';
  strip.innerHTML = `
    <button type="button" class="kat-ozet-chip kat-ozet-chip-btn${aktif('')}" data-kat-tur="">Toplam <b>${tum.length}</b></button>
    <button type="button" class="kat-ozet-chip kat-ozet-chip-btn chip-gider${aktif('gider')}" data-kat-tur="gider">💸 Gider <b>${gider}</b></button>
    <button type="button" class="kat-ozet-chip kat-ozet-chip-btn chip-gelir${aktif('gelir')}" data-kat-tur="gelir">💹 Gelir <b>${gelir}</b></button>
    ${diger > 0 ? `<button type="button" class="kat-ozet-chip kat-ozet-chip-btn${aktif('diger')}" data-kat-tur="diger">📦 Diğer <b>${diger}</b></button>` : ''}
  `;
  strip.querySelectorAll('[data-kat-tur]').forEach(btn => {
    btn.addEventListener('click', () => filterKategoriTur(btn.dataset.katTur, btn));
  });
}

export function renderKategoriGrid() {
  _restoreKatFiltreFromDB();
  renderKategoriOzetStrip();
  const cats = (getCoreState().DB.kategoriler||[]).filter(k => !_katFilter || k.tur === _katFilter);
  const grid = document.getElementById('kategori-grid');
  if(!grid) return;

  if(!cats.length) {
    const bosMesaj = _katFilter ? 'Bu türde henüz kategori tanımlanmamış.' : 'Henüz hiç kategori oluşturulmamış.';
    const bosAlt = _katFilter ? 'Filtreyi değiştirmeyi deneyin.' : 'Harcama ve gelirlerinizi kategorilere ayırarak daha net raporlar alabilirsiniz.';
    grid.innerHTML = `<div class="kat-empty">
      <div class="kat-empty-icon">🗂️</div>
      <div class="kat-empty-title">${bosMesaj}</div>
      <div class="kat-empty-sub">${bosAlt}</div>
      ${!_katFilter ? `<button class="btn btn-primary btn-sm" data-kat-ekle="1">+ İlk Kategorini Ekle</button>` : ''}
    </div>`;
    grid.querySelectorAll('[data-kat-ekle]').forEach(btn => {
      btn.addEventListener('click', () => openKategoriModal());
    });
    return;
  }

  grid.innerHTML = cats.map(k => {
    const tur = k.tur || 'diger';
    const stil = KAT_TUR_STIL[tur] || KAT_TUR_STIL.diger;
    const isDefault = k.id.startsWith('kg');
    const abUygun = k.aboneligeUygun !== false;
    const adSafe = (k.ad || '').replace(/"/g, '&quot;');
    const badgeCls = tur === 'gelir' ? 'kat-badge-gelir' : tur === 'gider' ? 'kat-badge-gider' : 'kat-badge-diger';
    return `<div class="kat-card" style="--kat-accent:${stil.accent};--kat-accent-glow:${stil.glow}">
      <div class="kat-card-icon">${k.ikon||'📦'}</div>
      <div class="kat-card-body">
        <div class="kat-card-ad" title="${adSafe}">${k.ad}</div>
        <div class="kat-card-meta">
          <span class="${badgeCls}">${stil.etiket}</span>
          ${abUygun ? `<span class="kat-card-ab">🔄 Abonelik</span>` : ''}
        </div>
      </div>
      <div class="kat-card-actions">
        <button class="btn btn-ghost btn-sm btn-act kat-edit-btn" data-id="${k.id}" title="Düzenle"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/></svg></button>
        ${!isDefault ? `<button class="btn btn-danger btn-sm btn-act kat-delete-btn" data-id="${k.id}" title="Sil"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block"><polyline points="3,5 13,5"/><path d="M6 5V3h4v2M5 5l1 9h4l1-9"/></svg></button>` : ''}
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.kat-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editKategori(btn.dataset.id));
  });
  grid.querySelectorAll('.kat-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteKategori(btn.dataset.id));
  });
}

export function filterKategoriTur(tur, btnEl) {
  set_katFilter(tur);
  if(!getCoreState().DB.uiFiltreler) getCoreState().DB.uiFiltreler = {};
  if(!getCoreState().DB.uiFiltreler.kategoriler) getCoreState().DB.uiFiltreler.kategoriler = {};
  if(getCoreState().DB.uiFiltreler.kategoriler.tur !== tur) { getCoreState().DB.uiFiltreler.kategoriler.tur = tur; saveData(); }
  renderKategoriGrid();
}

export function editKategori(id) { openKategoriModal(id); }

export function deleteKategori(id) {
  showConfirm('Bu kategoriyi silmek istiyor musunuz?', () => {
    getCoreState().DB.kategoriler = (getCoreState().DB.kategoriler||[]).filter(k=>k.id!==id);
    saveData();
    renderKategoriGrid();
    populateKategoriSelects();
  });
}

export function katOneriSelectAll(val) {
  document.querySelectorAll('.kat-oneri-check').forEach(cb => cb.checked = val);
}

export function katOneriEkleSecili() {
  const checks = document.querySelectorAll('.kat-oneri-check:checked');
  if (!checks.length) { showToast('Lütfen en az bir kategori seçin', 'error'); return; }
  if (!getCoreState().DB.kategoriler) getCoreState().DB.kategoriler = [];
  let eklenen = 0;
  checks.forEach(cb => {
    const o = KAT_ONERILER[+cb.dataset.idx];
    if (!o) return;
    const mevcut = new Set(getCoreState().DB.kategoriler.map(_katKey));
    if (mevcut.has(_katKey(o))) return;
    getCoreState().DB.kategoriler.push({ id: uid(), ad: o.ad, ikon: o.ikon, tur: o.tur });
    eklenen++;
  });
  saveData();
  closeModal('modal-kategori-oneri');
  renderKategoriGrid();
  populateKategoriSelects();
  showToast(eklenen ? `${eklenen} kategori eklendi` : 'Yeni kategori eklenmedi (zaten mevcuttu)');
}

export function getKategoriOpts(tur, sadeceAbonelik) {
  // tur: 'gider' | 'gelir' | '' (hepsi)
  // sadeceAbonelik: true ise sadece aboneligeUygun !== false olan kategoriler listelenir
  let cats = (getCoreState().DB.kategoriler||[]).filter(k => !tur || k.tur === tur || k.tur === 'diger');
  if (sadeceAbonelik) cats = cats.filter(k => k.aboneligeUygun !== false);
  return cats.map(k => `<option value="${k.id}">${k.ikon||''} ${k.ad}</option>`).join('');
}

export function getKategoriOptsAbonelik(seciliId) {
  // Abonelik formunda kullanılacak gider kategorileri: aboneligeUygun !== false olanlar.
  // Eğer düzenlenen kaydın mevcut kategorisi artık abonelik-dışı işaretlenmişse, listeden
  // kaybolmasın diye yine de eklenir (kapatılmasın diye).
  const cats = (getCoreState().DB.kategoriler||[]).filter(k => k.tur === 'gider' || k.tur === 'diger');
  const uygun = cats.filter(k => k.aboneligeUygun !== false);
  let list = uygun;
  if (seciliId && !uygun.some(k => k.id === seciliId)) {
    const secili = cats.find(k => k.id === seciliId);
    if (secili) list = [...uygun, secili];
  }
  return list.map(k => `<option value="${k.id}">${k.ikon||''} ${k.ad}</option>`).join('');
}

export function populateKategoriSelects() {
  // islem-kategori artık hidden input + chip grid — chip'leri render et
  renderIslemKategoriChips();
  // elden-kategori tür bazlı doldurulur (onEldenTurChange ile)
  onEldenTurChange();
  // ab-kategori: sadece abonelige uygun işaretli gider/diğer kategorileri
  const abKatEl = document.getElementById('ab-kategori');
  if(abKatEl) {
    const prev = abKatEl.value;
    abKatEl.innerHTML = getKategoriOptsAbonelik(prev);
    phSet(abKatEl, 'Kategori seçin…', prev || '', '— Kategori bulunamadı —');
  }
}

export function openKategoriModal(id) {
  setEditKategoriId(id || null);
  if(id) {
    const k = (getCoreState().DB.kategoriler||[]).find(x=>x.id===id);
    if(!k) return;
    document.getElementById('kategori-modal-title').textContent = 'Kategori Düzenle';
    document.getElementById('kat-ikon').value = k.ikon||'';
    document.getElementById('kat-ad').value   = k.ad;
    document.getElementById('kat-tur').value  = k.tur;
    document.getElementById('kat-abonelik').checked = k.aboneligeUygun !== false; // eski kayıtlarda alan yoksa varsayılan: uygun
  } else {
    document.getElementById('kategori-modal-title').textContent = 'Kategori Ekle';
    document.getElementById('kat-ikon').value = '';
    document.getElementById('kat-ad').value   = '';
    document.getElementById('kat-tur').value  = 'gider';
    document.getElementById('kat-abonelik').checked = true;
  }
  openModal('modal-kategori');
}

export function saveKategori() {
  const ad   = document.getElementById('kat-ad').value.trim();
  const ikon = document.getElementById('kat-ikon').value.trim();
  const tur  = document.getElementById('kat-tur').value;
  const aboneligeUygun = document.getElementById('kat-abonelik').checked;
  if(!ad) { showToast('Kategori adı zorunlu', 'error'); return; }
  if(!getCoreState().DB.kategoriler) getCoreState().DB.kategoriler = [];
  if(editKategoriId) {
    const idx = getCoreState().DB.kategoriler.findIndex(k=>k.id===editKategoriId);
    if(idx>=0) getCoreState().DB.kategoriler[idx] = {...getCoreState().DB.kategoriler[idx], ad, ikon, tur, aboneligeUygun};
  } else {
    getCoreState().DB.kategoriler.push({id: uid(), ad, ikon, tur, aboneligeUygun});
  }
  setEditKategoriId(null);
  saveData();
  closeModal('modal-kategori');
  renderKategoriGrid();
  populateKategoriSelects();
  showToast('Kategori kaydedildi');
}

export function _katKey(k) { return (k.ad||'').trim().toLocaleLowerCase('tr') + '|' + (k.tur||''); }

export function openKategoriOneriModal() {
  const mevcut = new Set((getCoreState().DB.kategoriler||[]).map(_katKey));
  const eksikler = KAT_ONERILER.filter(o => !mevcut.has(_katKey(o)));
  const list = document.getElementById('kategori-oneri-list');
  if (!list) return;

  // Seç/Kaldır butonları ve "Seçilenleri Ekle" butonu — eksik yoksa gizle
  const secBtnWrap = list.closest('.modal-body')?.querySelector('div[style*="gap:8px"]');
  const ekleBtn = list.closest('.modal')?.querySelector('.modal-footer .btn-primary');
  if (secBtnWrap) secBtnWrap.style.display = eksikler.length ? 'flex' : 'none';
  if (ekleBtn) ekleBtn.style.display = eksikler.length ? '' : 'none';

  if (!eksikler.length) {
    list.innerHTML = '<div class="ee-empty">Tüm önerilen kategoriler zaten sisteminizde mevcut 👍</div>';
  } else {
    const gruplar = [
      { tur: 'gider', baslik: '💸 Gider Kategorileri' },
      { tur: 'gelir', baslik: '💹 Gelir Kategorileri' },
      { tur: 'diger', baslik: '📦 Diğer' }
    ];
    list.innerHTML = gruplar.map(g => {
      const items = eksikler.filter(o => o.tur === g.tur);
      if (!items.length) return '';
      return `<div>
        <div class="msec-label" style="margin-bottom:8px">${g.baslik}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px">
          ${items.map((o, idx) => {
            const dataIdx = KAT_ONERILER.indexOf(o);
            return `<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;cursor:pointer;font-size:12.5px">
              <input type="checkbox" class="kat-oneri-check" data-idx="${dataIdx}" checked style="flex-shrink:0">
              <span>${o.ikon}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.ad}</span>
            </label>`;
          }).join('')}
        </div>
      </div>`;
    }).join('');
  }
  openModal('modal-kategori-oneri');
}

// ============================================================
// [DI-MIGRATION] ui.pages.tanimlamalarKategoriler — container'a kayıt
// ------------------------------------------------------------
// Dual-mode: yukarıdaki importlar KORUNDU (henüz taşınmamış katmanlar:
// @core/app-core-base.js, @core/format.js, @components/modal-genel.js,
// @components/tablo-filtre-sirala.js, @pages/ekstreler/02-ekstre-render.js,
// @pages/elden.js, @pages/islemler/06-islem-kategori-secici.js,
// @pages/tanimlamalar/00-state.js — BİLİNÇLİ OLARAK inject()'e çevrilmedi).
// Yalnızca core.state (zaten container'da) fonksiyon-getter üzerinden
// okunuyor (bkz. yukarıdaki getCoreState() notu — dairesel import riski).
// Dışarıdaki tüketiciler artık resolve('ui.pages.tanimlamalarKategoriler')
// veya inject(...) kullanabilir.
// ============================================================
import { provide } from '@core/container.js';
provide('ui.pages.tanimlamalarKategoriler', {
  seçKategoriChip, renderKategoriOzetStrip, renderKategoriGrid,
  filterKategoriTur, editKategori, deleteKategori, katOneriSelectAll,
  katOneriEkleSecili, getKategoriOpts, getKategoriOptsAbonelik,
  populateKategoriSelects, openKategoriModal, saveKategori, _katKey,
  openKategoriOneriModal,
});

