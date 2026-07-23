import { saveData } from '../../../core/app-core-base.js';
import { fmtCur, fmtDate, localDateStr } from '../../../core/format.js';
import { DB } from '../../../core/state.js';
import { getIslemTaksitliste, islemProvizyonEksikMi } from '../../../domain/hesaplamalar.js';
import { _provizyonGizliIslemler } from './03-bakiye-izleme-paneli.js';
import { showToast } from '../modal-genel.js';
import { renderIslemler } from '../../pages/islemler/03-islem-liste-render.js';
import { getKart, getKartRenk } from '../../pages/kartlar/01-kart-data.js';
import { tahminProvizyonGunFarki } from '../../pages/ozet.js';
// ============================================================
// js/ui/components/mobile-nav-tema/04-provizyon-uyarilari.js
// Provizyonu eksik işlemler için uyarı paneli
// Kod SATIR SATIR aynı kaldı; sadece dosya sınırı/gruplama değişti.
// ============================================================
export function _provizyonEksikIslemleriBul() {
  return (DB.islemler||[]).filter(i => typeof islemProvizyonEksikMi === 'function' && islemProvizyonEksikMi(i) && !_provizyonGizliIslemler.has(i.id));
}

export function renderOzetProvizyonUyarilar() {
  const el = document.getElementById('ozet-provizyon-uyarilar');
  if(!el) return;

  const eksikler = _provizyonEksikIslemleriBul();
  if(!eksikler.length) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  el.style.display = 'block';
  // En yeni işlem en üstte
  eksikler.sort((a,b) => (b.tarih||'').localeCompare(a.tarih||''));

  el.innerHTML = `<div class="card" style="border-color:rgba(167,139,250,.35);background:rgba(167,139,250,.04);padding:10px 12px">
    <div class="card-header">
      <span class="card-title-icon">🧾</span><span class="card-title" style="color:var(--violet)">Provizyon Tarihi Girilmemiş İşlemler</span>
      <div style="display:flex;gap:6px;margin-left:auto">
        <button class="btn btn-ghost btn-sm provizyon-tumunu-islem-tarihiyle-btn" style="font-size:10px;padding:3px 8px;min-height:auto" title="Her işlemin provizyon tarihini kendi işlem tarihiyle aynı yapar">Tümünü İşlem Tarihiyle Gir</button>
        <button class="btn btn-ghost btn-sm provizyon-tumunu-gizle-btn" style="font-size:10px;padding:3px 8px;min-height:auto">Tümünü Sonraya Bırak</button>
      </div>
    </div>
    <div style="font-size:10px;color:var(--text3);margin:-10px 0 8px">${eksikler.length} işlem</div>
    <div style="display:flex;flex-direction:column;gap:3px;max-height:180px;overflow-y:auto" id="provizyon-uyari-liste">
      ${eksikler.slice(0,12).map(i => _provizyonUyariSatiri(i)).join('')}
    </div>
    ${eksikler.length > 12 ? `<div style="font-size:10px;color:var(--text3);text-align:center;padding:4px 0 0">+${eksikler.length-12} işlem daha — İşlemler sayfasından girebilirsiniz</div>` : ''}
  </div>`;

  // [ES module] onclick="..." kaldırıldı - gerçek addEventListener bağlanıyor.
  el.querySelectorAll('.provizyon-tumunu-islem-tarihiyle-btn').forEach(btn => {
    btn.addEventListener('click', () => provizyonUyariTumunuIslemTarihiIleGir());
  });
  el.querySelectorAll('.provizyon-tumunu-gizle-btn').forEach(btn => {
    btn.addEventListener('click', () => provizyonUyariTumunuGizle());
  });
  el.querySelectorAll('.prov-kaydet-btn').forEach(btn => {
    btn.addEventListener('click', () => provizyonUyariKaydet(btn.getAttribute('data-id')));
  });
  el.querySelectorAll('.prov-gizle-btn').forEach(btn => {
    btn.addEventListener('click', () => provizyonUyariGizle(btn.getAttribute('data-id')));
  });
}

export function _provizyonUyariSatiri(i) {
  const k = (typeof getKart === 'function') ? getKart(i.kart) : null;
  const kartAd = k ? k.ad : '—';
  const kartRenk = (typeof getKartRenk === 'function') ? getKartRenk(k) : ((k && k.renk) || 'var(--violet)');
  const tutarStr = (typeof fmtCur === 'function') ? fmtCur(i.tutar, i.paraBirimi || 'TRY') : i.tutar;
  const tarihStr = (typeof fmtDate === 'function') ? fmtDate(i.tarih) : i.tarih;
  const aciklamaSafe = (i.aciklama || '—').replace(/"/g,'&quot;');
  const taksitBadge = (i.taksit||1) > 1 ? ` · ${i.taksit} Taksit` : '';

  // Öngörülen provizyon tarihi (varsa)
  const gunFarki = (typeof tahminProvizyonGunFarki === 'function') ? tahminProvizyonGunFarki(i.kart) : null;
  let onerilenTarih = '';
  if(gunFarki !== null) {
    const dt = new Date(i.tarih+'T00:00:00');
    dt.setDate(dt.getDate() + gunFarki);
    onerilenTarih = localDateStr(dt);
  }

  return `<div class="provizyon-uyari-row" id="prov-row-${i.id}" style="display:flex;align-items:center;gap:6px;padding:4px 7px;background:var(--surface3);border-radius:6px;border:1px solid var(--border)">
    <span style="width:6px;height:6px;border-radius:50%;background:${kartRenk};flex-shrink:0"></span>
    <div style="flex:1;min-width:0;overflow:hidden">
      <span style="font-size:11px;color:var(--text);font-weight:600">${kartAd}</span>
      <span style="font-size:10.5px;color:var(--text3)"> · ${tarihStr} · </span>
      <span title="${aciklamaSafe}" style="font-size:10.5px;color:var(--text2)">${aciklamaSafe}</span>
      <span style="font-size:10px;color:var(--text3)"> · ${tutarStr}${taksitBadge}</span>
    </div>
    <input type="date" id="prov-input-${i.id}" value="${onerilenTarih}" style="font-size:11px;background:var(--surface3);color:var(--text);border:1px solid var(--border2);border-radius:5px;padding:3px 6px;width:118px;flex-shrink:0">
    <button class="btn btn-primary btn-sm prov-kaydet-btn" data-id="${i.id}" style="font-size:10px;padding:3px 7px;min-height:auto;flex-shrink:0">✓</button>
    <button class="btn btn-ghost btn-sm prov-gizle-btn" data-id="${i.id}" style="font-size:10px;padding:3px 6px;min-height:auto;flex-shrink:0" title="Sonra hatırlat">✕</button>
  </div>`;
}

export function provizyonUyariKaydet(islemId) {
  const input = document.getElementById('prov-input-' + islemId);
  if(!input) return;
  const tarih = input.value;
  if(!tarih) {
    input.classList.add('error');
    input.focus();
    return;
  }
  const idx = (DB.islemler||[]).findIndex(x => x.id === islemId);
  if(idx < 0) return;
  const islem = DB.islemler[idx];
  islem.provizyonTarihi = tarih;
  if(islem.manuelTaksitler && islem.manuelTaksitler[0]) {
    islem.manuelTaksitler[0].provizyonTarihi = tarih;
  } else if(islem.taksit > 1) {
    // manuelTaksitler henüz oluşturulmamışsa, taksit listesinden üret
    const liste = getIslemTaksitliste(islem);
    islem.manuelTaksitler = liste.map((t,idx2) => ({ tarih: t.tarih, tutar: t.tutar, provizyonTarihi: idx2===0 ? tarih : null }));
  }
  saveData();
  renderOzetProvizyonUyarilar();
  if(typeof renderIslemler === 'function' && document.getElementById('page-islemler')?.classList.contains('active')) renderIslemler();
}

export function provizyonUyariGizle(islemId) {
  _provizyonGizliIslemler.add(islemId);
  renderOzetProvizyonUyarilar();
}

export function provizyonUyariTumunuGizle() {
  _provizyonEksikIslemleriBul().forEach(i => _provizyonGizliIslemler.add(i.id));
  renderOzetProvizyonUyarilar();
}

// "Tümünü İşlem Tarihiyle Aynı Gir" — listedeki tüm eksik provizyon tarihlerini
// o işlemin kendi işlem tarihiyle aynı yaparak tek tıkla doldurur ve kaydeder.

export function provizyonUyariTumunuIslemTarihiIleGir() {
  const eksikler = _provizyonEksikIslemleriBul();
  if(!eksikler.length) return;
  eksikler.forEach(islem => {
    const tarih = islem.tarih;
    if(!tarih) return;
    islem.provizyonTarihi = tarih;
    if(islem.manuelTaksitler && islem.manuelTaksitler[0]) {
      islem.manuelTaksitler[0].provizyonTarihi = tarih;
    } else if(islem.taksit > 1) {
      const liste = getIslemTaksitliste(islem);
      islem.manuelTaksitler = liste.map((t,idx2) => ({ tarih: t.tarih, tutar: t.tutar, provizyonTarihi: idx2===0 ? tarih : null }));
    }
  });
  saveData();
  renderOzetProvizyonUyarilar();
  if(typeof renderIslemler === 'function' && document.getElementById('page-islemler')?.classList.contains('active')) renderIslemler();
  showToast(`${eksikler.length} işlemin provizyon tarihi işlem tarihiyle aynı yapıldı`, 'success');
}


// Mevduat oto-strateji: vade dolunca otomatik işlem yap (dashboard aksiyon)
// Bu fonksiyon mevcut mevduatYenile / mevduatTumunuVadesizeAktar'ı tamamlar

