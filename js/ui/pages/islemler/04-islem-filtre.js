import { saveData } from '@core/app-core-base.js';
import { fmtAyYil } from '@core/format.js';
import { DB } from '@core/state.js';
import { _islemFiltreRestored, renderIslemler, set_islemFiltreRestored } from '@pages/islemler/03-islem-liste-render.js';
import { getKartRenk } from '@pages/kartlar/01-kart-data.js';
import { openModal } from '@components/modal-genel.js';
// ============================================================
// js/ui/pages/islemler/04-islem-filtre.js
// İşlem listesi filtreleme (kart/ay/kategori/arama)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/islemler.js
// (49 export, 1087 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function openIslemFiltreModal() {
  renderIslemFiltreGrids();
  openModal('modal-islem-filtre');
}

export function renderIslemFiltreBadge() {
  const fk = document.getElementById('filter-kart');
  const fa = document.getElementById('filter-ay');
  const ft = document.getElementById('filter-taksit');
  let count = 0;
  if(fk && fk.value) count++;
  if(fa && fa.value) count++;
  if(ft && ft.value) count++;
  const badge = document.getElementById('islem-filtre-badge');
  if(badge) {
    if(count > 0) { badge.style.display = 'inline-flex'; badge.textContent = count; }
    else badge.style.display = 'none';
  }
  const btn = document.getElementById('islem-filtre-btn');
  if(btn) btn.classList.toggle('is-active', count > 0);

  // Aktif filtre özet pill'leri
  const row = document.getElementById('islem-active-filtre-row');
  if(row) {
    const pills = [];
    if(fk && fk.value) {
      const kart = DB.kartlar.find(k=>k.id===fk.value);
      pills.push({ key:'kart', label: kart ? kart.ad : 'Kart' });
    }
    if(fa && fa.value) {
      const [y,mo] = fa.value.split('-');
      const label = fmtAyYil(new Date(y,mo-1,1));
      pills.push({ key:'ay', label });
    }
    if(ft && ft.value) {
      pills.push({ key:'taksit', label: ft.value==='pesin' ? 'Sadece Peşin' : 'Sadece Taksitli' });
    }
    if(pills.length) {
      row.style.display = 'flex';
      row.innerHTML = '<span class="afr-label">Filtreler:</span>' +
        pills.map(p=>`<span class="afr-pill">${p.label}<button type="button" data-key="${p.key}" title="Kaldır">✕</button></span>`).join('') +
        '<button type="button" class="afr-clear-all" id="islem-afr-clear-all">Tümünü Temizle</button>';
      row.querySelectorAll('.afr-pill button').forEach(b=>{
        b.onclick = () => {
          if(b.dataset.key==='kart') fk.value='';
          if(b.dataset.key==='ay') fa.value='';
          if(b.dataset.key==='taksit') ft.value='';
          renderIslemler();
          renderIslemFiltreGrids();
        };
      });
      const clearAll = document.getElementById('islem-afr-clear-all');
      if(clearAll) clearAll.onclick = () => { clearIslemFiltre(); };
    } else {
      row.style.display = 'none';
      row.innerHTML = '';
    }
  }
}

export function renderIslemFiltreGrids() {
  const fk = document.getElementById('filter-kart');
  const fa = document.getElementById('filter-ay');
  const ft = document.getElementById('filter-taksit');

  // Kart grid'i
  const kartGrid = document.getElementById('islem-filtre-kart-grid');
  if(kartGrid) {
    const opts = [`<button type="button" class="chip-select-opt${!fk.value?' active':''}" data-val="">Tüm Kartlar</button>`]
      .concat(DB.kartlar.map(k=>`<button type="button" class="chip-select-opt${fk.value===k.id?' active':''}" data-val="${k.id}"><span class="chip-dot" style="background:${getKartRenk(k)}"></span>${k.ad}</button>`));
    kartGrid.innerHTML = opts.join('');
    kartGrid.querySelectorAll('.chip-select-opt').forEach(btn=>{
      btn.onclick = () => { fk.value = btn.dataset.val; renderIslemler(); renderIslemFiltreGrids(); };
    });
  }

  // Ay grid'i
  const ayGrid = document.getElementById('islem-filtre-ay-grid');
  if(ayGrid) {
    const months = Array.from(fa.options).map(o=>o.value).filter(Boolean);
    const opts = [`<button type="button" class="chip-select-opt${!fa.value?' active':''}" data-val="">Tüm Aylar</button>`]
      .concat(months.map(m=>{
        const [y,mo]=m.split('-');
        const label = fmtAyYil(new Date(y,mo-1,1));
        return `<button type="button" class="chip-select-opt${fa.value===m?' active':''}" data-val="${m}">${label}</button>`;
      }));
    ayGrid.innerHTML = opts.length > 1 ? opts.join('') : '<div class="info-box" style="margin:0">Henüz işlem yok</div>';
    ayGrid.querySelectorAll('.chip-select-opt').forEach(btn=>{
      btn.onclick = () => { fa.value = btn.dataset.val; renderIslemler(); renderIslemFiltreGrids(); };
    });
  }

  // Taksit grid'i
  const taksitGrid = document.getElementById('islem-filtre-taksit-grid');
  if(taksitGrid) {
    taksitGrid.querySelectorAll('.chip-select-opt').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.val === (ft.value||''));
      btn.onclick = () => { ft.value = btn.dataset.val; renderIslemler(); renderIslemFiltreGrids(); };
    });
  }
}

export function restoreIslemFiltreFromDB() {
  if(_islemFiltreRestored) return; // bu sayfa zaten yüklendi, kullanıcı seçimini ezme
  set_islemFiltreRestored(true);
  const saved = (DB.uiFiltreler && DB.uiFiltreler.islemler) || {};
  const fk = document.getElementById('filter-kart');
  const fa = document.getElementById('filter-ay');
  const ft = document.getElementById('filter-taksit');
  const fq = document.getElementById('filter-q');
  if(fk && saved.kart)   fk.value = saved.kart;
  if(fa && saved.ay)     fa.value = saved.ay;
  if(ft && saved.taksit) ft.value = saved.taksit;
  if(fq && saved.q)      fq.value = saved.q;
}

export function persistIslemFiltreToDB() {
  const fk = document.getElementById('filter-kart');
  const fa = document.getElementById('filter-ay');
  const ft = document.getElementById('filter-taksit');
  const fq = document.getElementById('filter-q');
  const yeni = {
    kart: fk ? fk.value : '',
    ay: fa ? fa.value : '',
    taksit: ft ? ft.value : '',
    q: fq ? fq.value : ''
  };
  const eski = (DB.uiFiltreler && DB.uiFiltreler.islemler) || {};
  if(eski.kart===yeni.kart && eski.ay===yeni.ay && eski.taksit===yeni.taksit && eski.q===yeni.q) return;
  if(!DB.uiFiltreler) DB.uiFiltreler = { islemler:{}, extreler:{} };
  DB.uiFiltreler.islemler = yeni;
  saveData();
}

export function clearIslemFiltre() {
  const fk = document.getElementById('filter-kart');
  const fa = document.getElementById('filter-ay');
  const ft = document.getElementById('filter-taksit');
  const fq = document.getElementById('filter-q');
  if(fk) fk.value = '';
  if(fa) fa.value = '';
  if(ft) ft.value = '';
  if(fq) fq.value = '';
  renderIslemler();
  renderIslemFiltreGrids();
}

