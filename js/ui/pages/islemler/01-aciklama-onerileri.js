import { DB } from '@core/state.js';
import { AC_ENGELLI_KELIMELER } from '@pages/islemler/00-state.js';
import { renderIslemKategoriButon } from '@pages/islemler/06-islem-kategori-secici.js';
import { closeModal, openModal } from '@components/modal-genel.js';
// ============================================================
// js/ui/pages/islemler/01-aciklama-onerileri.js
// İşlem açıklaması otomatik tamamlama/geçmiş öneri modalı
//
// Bu dosya, eskiden tek parça olan js/ui/pages/islemler.js
// (49 export, 1087 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function openIslemAciklamaModal() {
  const hidden = document.getElementById('islem-aciklama');
  const input = document.getElementById('islem-aciklama-modal-input');
  if(input) input.value = hidden ? hidden.value : '';
  renderIslemAciklamaModalList();
  openModal('modal-islem-aciklama');
  setTimeout(()=>{ if(input) { input.focus(); input.select(); } }, 60);
}

export function renderIslemAciklamaModalList() {
  const list = document.getElementById('islem-aciklama-modal-list');
  const input = document.getElementById('islem-aciklama-modal-input');
  if(!list) return;
  const qRaw = input ? input.value.trim() : '';
  const q = qRaw.toLocaleLowerCase('tr');
  let veriler;
  if(!q) {
    veriler = _acGecmisVerisi().sort((a,b)=>b.count-a.count).slice(0,8);
  } else {
    veriler = _acGecmisVerisi()
      .filter(v => v.ad.toLocaleLowerCase('tr').includes(q))
      .sort((a,b)=> b.count-a.count)
      .slice(0,8);
  }
  if(!veriler.length) {
    list.innerHTML = `<div class="ac-suggest-hint">${q ? 'Eşleşen geçmiş açıklama yok — yazdığınızı "Kullan" ile ekleyebilirsiniz' : 'Henüz geçmiş açıklama yok'}</div>`;
    return;
  }
  const hint = `<div class="ac-suggest-hint">${q ? 'Eşleşen geçmiş açıklamalar' : 'Sık kullanılanlar'}</div>`;
  const rows = veriler.map((v,idx) =>
    `<div class="ac-suggest-item" data-idx="${idx}" data-ac-ad="${_acEsc(v.ad)}" data-ac-kat="${_acEsc(v.kategori||'')}">
      <span class="ac-item-icon">${idx===0 && !q ?'⭐':'🕒'}</span>
      <span class="ac-item-text">${_acHighlight(v.ad, qRaw)}</span>
      <span class="ac-meta">${v.count}× kullanıldı</span>
    </div>`
  ).join('');
  list.innerHTML = hint + rows;
  // [ES module] onclick="islemAciklamaModalSec(this)" kaldırıldı - gerçek addEventListener bağlanıyor.
  list.querySelectorAll('.ac-suggest-item').forEach(item => {
    item.addEventListener('click', () => islemAciklamaModalSec(item));
  });
}

export function islemAciklamaModalSec(el) {
  const ad = el.getAttribute('data-ac-ad') || '';
  const kat = el.getAttribute('data-ac-kat') || '';
  _islemAciklamaUygula(ad, kat);
  closeModal('modal-islem-aciklama');
}

export function islemAciklamaModalOnayla() {
  const input = document.getElementById('islem-aciklama-modal-input');
  const ad = input ? input.value.trim() : '';
  if(!ad) { closeModal('modal-islem-aciklama'); return; }
  // Yazılan metin geçmişte kayıtlıysa kategoriyi de hatırlat
  const eslesen = _acGecmisVerisi().find(v => v.ad.toLocaleLowerCase('tr') === ad.toLocaleLowerCase('tr'));
  _islemAciklamaUygula(ad, eslesen ? (eslesen.kategori||'') : '');
  closeModal('modal-islem-aciklama');
}

export function _islemAciklamaUygula(ad, kat) {
  const hidden = document.getElementById('islem-aciklama');
  if(!hidden) return;
  hidden.value = ad;
  if(kat) {
    const katEl = document.getElementById('islem-kategori');
    if(katEl && !katEl.value) { katEl.value = kat; renderIslemKategoriButon(); } // sadece kategori boşsa otomatik doldur
  }
  renderIslemAciklamaButon();
}

export function renderIslemAciklamaButon() {
  const hidden = document.getElementById('islem-aciklama');
  const btn = document.getElementById('islem-aciklama-btn');
  const label = document.getElementById('islem-aciklama-btn-label');
  if(!hidden || !btn || !label) return;
  const val = hidden.value || '';
  if(val) {
    label.textContent = val;
    btn.classList.remove('is-empty');
  } else {
    label.textContent = 'Açıklama seç veya yaz…';
    btn.classList.add('is-empty');
  }
}

export function onIslemAciklamaModalInput() {
  renderIslemAciklamaModalList();
}

export function onIslemAciklamaModalKeydown(e) {
  if(e.key === 'Enter') { e.preventDefault(); islemAciklamaModalOnayla(); }
  else if(e.key === 'Escape') { e.preventDefault(); closeModal('modal-islem-aciklama'); }
}

export function _acEngelliMi(ad) {
  const l = (ad||'').toLocaleLowerCase('tr');
  return AC_ENGELLI_KELIMELER.some(kw => l.includes(kw));
}

export function _acGecmisVerisi() {
  const map = {};
  (DB.islemler||[]).forEach(i=>{
    const ac = (i.aciklama||'').trim();
    if(!ac) return;
    if(_acEngelliMi(ac)) return;
    const key = ac.toLocaleLowerCase('tr');
    if(!map[key]) map[key] = { ad: ac, count: 0, kategori: null, tarih: '' };
    map[key].count++;
    if((i.tarih||'') >= map[key].tarih) {
      map[key].tarih = i.tarih || map[key].tarih;
      map[key].kategori = i.kategori || map[key].kategori;
      map[key].ad = ac; // en son yazılan büyük/küçük harf hâliyle göster
    }
  });
  return Object.values(map);
}

export function _acEsc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Açıklama metninde aranan kısmı <mark> ile vurgular (büyük/küçük harf duyarsız, Türkçe)

export function _acHighlight(text, query) {
  const esc = _acEsc(text);
  if(!query) return esc;
  const lowerText = text.toLocaleLowerCase('tr');
  const lowerQuery = query.toLocaleLowerCase('tr');
  const idx = lowerText.indexOf(lowerQuery);
  if(idx < 0) return esc;
  const before = _acEsc(text.slice(0, idx));
  const match = _acEsc(text.slice(idx, idx + query.length));
  const after = _acEsc(text.slice(idx + query.length));
  return `${before}<mark>${match}</mark>${after}`;
}

