import { saveData } from '@core/app-core-base.js';
import { fmtDate, localDateStr, uid } from '@core/format.js';
import { DB } from '@core/state.js';
import { calcExtreTarihi, calcOdemeTarihi, getExtreDonemi, getIslemTaksitliste } from '@domain/hesaplamalar.js';
import { showConfirm, showToast, validateRequiredFields } from '@components/modal-genel.js';
import { setDateInputValue } from '@components/money-input.js';
import { renderExtreler } from '@pages/ekstreler/02-ekstre-render.js';
import { kdRenderExtreUyari, kdRenderExtreler } from '@pages/kartlar/04-kart-detay-v1.js';
import { kd2RenderExtreler } from '@pages/kartlar/05-kart-detay-v2.js';
import { _kd2KartId, _kdKartId } from '@pages/kartlar/09-kart-altyapi.js';
import { renderOzetEkstreUyarilar } from '@pages/ozet.js';
import { closeModal, openModal } from '@components/modal-genel.js';
// ============================================================
// js/ui/pages/ekstreler/01-ekstre-kesinlestirme.js
// Ekstre kesinleştirme (dönem kapatma) akışı
// Kod SATIR SATIR aynı kaldı; sadece dosya sınırı/gruplama değişti.
// ============================================================
export function extreTypeChange() {
  const v = document.getElementById('kart-extre-tip').value;
  document.getElementById('extre-gun-div').style.display = v==='gun' ? '' : 'none';
  document.getElementById('extre-hafta-div').style.display = v==='hafta' ? '' : 'none';
  document.getElementById('extre-statik-div').style.display = v==='statik' ? '' : 'none';

}

export function isEkstreKesinlesmis(kartId, donemKey) {
  return (DB.ekstreKayitlari||[]).some(k => k.kartId === kartId && k.donemKey === donemKey && k.kesinlestirildi);
}

export function kesinlesmeyiBekleyenDonemler() {
  const today = new Date(); today.setHours(0,0,0,0);
  const sonuc = [];
  (DB.kartlar||[]).forEach(kart => {
    // Son 6 ay tara
    for(let offset = 0; offset <= 6; offset++) {
      const d = new Date(today);
      d.setMonth(d.getMonth() - offset);
      const y = d.getFullYear(), m = d.getMonth();
      const key = `${y}-${String(m+1).padStart(2,'0')}`;
      if(isEkstreKesinlesmis(kart.id, key)) continue;
      const extreDt = calcExtreTarihi(kart, y, m);
      if(!extreDt) continue;
      const ekstreSonrasi = new Date(extreDt);
      ekstreSonrasi.setDate(ekstreSonrasi.getDate() + 1);
      if(today < ekstreSonrasi) continue; // henüz ekstre kesilmedi+1gün geçmedi
      // Bu kart+dönem için işlem var mı?
      const tatilSet = new Set((DB.tatiller||[]).map(t=>t.tarih));
      const odemeDt = calcOdemeTarihi(extreDt, kart.odemeSure, kart.odemeGunTip, tatilSet);
      const hasIslem = (DB.islemler||[]).some(i => {
        if(i.kart !== kart.id) return false;
        return getIslemTaksitliste(i).some(tak => {
          const pd = getExtreDonemi(kart, tak.ekstreTarih);
          return pd && `${pd.year}-${String(pd.month+1).padStart(2,'0')}` === key;
        });
      });
      if(!hasIslem) continue;
      sonuc.push({ kart, key, extreDt: localDateStr(extreDt), odemeDt: localDateStr(odemeDt) });
    }
  });
  return sonuc;
}

export function kesinlestirTumBekleyenler(kartId) {
  let bekleyenler = kesinlesmeyiBekleyenDonemler();
  if(kartId) bekleyenler = bekleyenler.filter(b => b.kart.id === kartId);
  if(!bekleyenler.length) { showToast('Kesinleştirilecek bekleyen dönem yok', 'info'); return; }
  const adet = bekleyenler.length;
  showConfirm(`${adet} dönem kesinleştirilsin mi? Bu dönemlere ait işlemler artık düzenlenemeyecek.`, () => {
    if(!DB.ekstreKayitlari) DB.ekstreKayitlari = [];
    bekleyenler.forEach(({kart, key}) => {
      const var_ = DB.ekstreKayitlari.find(k => k.kartId === kart.id && k.donemKey === key);
      if(var_) { var_.kesinlestirildi = true; var_.kesinlesmeTarih = localDateStr(new Date()); }
      else DB.ekstreKayitlari.push({ id: uid(), kartId: kart.id, donemKey: key, kesinlestirildi: true, kesinlesmeTarih: localDateStr(new Date()) });
    });
    saveData();
    renderOzetEkstreUyarilar();
    renderExtreler();
    if (typeof _kdKartId !== 'undefined' && _kdKartId) {
      const kart = DB.kartlar.find(k => k.id === _kdKartId);
      if (kart) { kdRenderExtreUyari(kart); kdRenderExtreler(); }
    }
    if (typeof _kd2KartId !== 'undefined' && _kd2KartId) kd2RenderExtreler();
    showToast(`✓ ${adet} dönem kesinleştirildi`, 'success');
  }, { title: 'Kesinleştirilsin mi?', okLabel: '✓ Kesinleştir', okClass: 'btn-primary' });
}

export function kesinlestirEkstre(kartId, donemKey) {
  if(!DB.ekstreKayitlari) DB.ekstreKayitlari = [];
  const var_ = DB.ekstreKayitlari.find(k => k.kartId === kartId && k.donemKey === donemKey);
  if(var_) { var_.kesinlestirildi = true; var_.kesinlesmeTarih = localDateStr(new Date()); }
  else DB.ekstreKayitlari.push({ id: uid(), kartId, donemKey, kesinlestirildi: true, kesinlesmeTarih: localDateStr(new Date()) });
  saveData();
  renderOzetEkstreUyarilar();
  renderExtreler();
  if (typeof _kdKartId !== 'undefined' && _kdKartId === kartId) {
    const kart = DB.kartlar.find(k => k.id === kartId);
    if (kart) { kdRenderExtreUyari(kart); kdRenderExtreler(); }
  }
  if (typeof _kd2KartId !== 'undefined' && _kd2KartId === kartId) kd2RenderExtreler();
  showToast('Ekstre kesinleştirildi — bu döneme ait işlemler artık düzenlenemez', 'success');
}

export function kesinlestirmeyiKaldir(kartId, donemKey) {
  showConfirm('Bu dönemin ekstre kesinleştirmesi kaldırılsın mı? İşlemler tekrar düzenlenebilir hale gelir.', () => {
    const var_ = (DB.ekstreKayitlari || []).find(k => k.kartId === kartId && k.donemKey === donemKey);
    if (var_) { var_.kesinlestirildi = false; var_.kesinlesmeTarih = null; }
    saveData();
    renderOzetEkstreUyarilar();
    renderExtreler();
    if (typeof _kdKartId !== 'undefined' && _kdKartId === kartId) {
      const kart = DB.kartlar.find(k => k.id === kartId);
      if (kart) { kdRenderExtreUyari(kart); kdRenderExtreler(); }
    }
    if (typeof _kd2KartId !== 'undefined' && _kd2KartId === kartId) kd2RenderExtreler();
    showToast('Kesinleştirme kaldırıldı', 'success');
  }, { title: 'Kesinleştirme kaldırılsın mı?', okLabel: '↺ Geri Al', okClass: 'btn-primary' });
}

export function openOzelExtreModal(periodKey) {
  const kartId = document.getElementById('extre-kart-filter').value;
  const kart = DB.kartlar.find(k=>k.id===kartId);
  if(!kart) { showToast('Önce bir kart seçiniz', 'error'); return; }

  document.getElementById('ozel-extre-sub').textContent = kart.ad;

  const ayInput = document.getElementById('ozel-extre-ay');
  const tarihInput = document.getElementById('ozel-extre-tarih');

  if(periodKey) {
    ayInput.value = periodKey; // 'YYYY-MM'
    const mevcut = (DB.ozelExtreler||[]).find(x=>x.kartId===kartId && x.ay===periodKey);
    setDateInputValue(tarihInput, mevcut ? mevcut.tarih : '');
  } else {
    ayInput.value = '';
    setDateInputValue(tarihInput, '');
  }

  renderOzelExtreList(kartId);
  openModal('modal-ozel-extre');
}

export function saveOzelExtre() {
  const kartId = document.getElementById('extre-kart-filter').value;
  const ay = document.getElementById('ozel-extre-ay').value; // '2025-06'
  const tarih = document.getElementById('ozel-extre-tarih').value;
  if(!validateRequiredFields([{id:'extre-kart-filter',msg:'Kart seçiniz'},{id:'ozel-extre-ay',msg:'Ay seçiniz'},{id:'ozel-extre-tarih',msg:'Tarih giriniz'}])) return;
  // Remove existing for same kart+ay
  DB.ozelExtreler = DB.ozelExtreler.filter(x=>!(x.kartId===kartId&&x.ay===ay));
  DB.ozelExtreler.push({kartId, ay, tarih});
  saveData();
  renderOzelExtreList(kartId);
  renderExtreler();
  showToast('Özel ekstre tarihi kaydedildi');
  closeModal('modal-ozel-extre');
}

export function clearOzelExtre() {
  const kartId = document.getElementById('extre-kart-filter').value;
  const ay = document.getElementById('ozel-extre-ay').value;
  if(!ay) {
    // Clear all for this card
    if(kartId) DB.ozelExtreler = DB.ozelExtreler.filter(x=>x.kartId!==kartId);
  } else {
    DB.ozelExtreler = DB.ozelExtreler.filter(x=>!(x.kartId===kartId&&x.ay===ay));
  }
  saveData();
  renderOzelExtreList(kartId);
  renderExtreler();
  setDateInputValue('ozel-extre-tarih', '');
}

export function renderOzelExtreList(kartId) {
  const list = document.getElementById('ozel-extre-list');
  const items = DB.ozelExtreler.filter(x=>x.kartId===kartId);
  if(!items.length) { list.innerHTML=''; return; }
  list.innerHTML = '<div style="font-size:11px;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Bu Kart İçin Özel Tarihler</div>' +
    items.sort((a,b)=>a.ay.localeCompare(b.ay)).map(x=>`
    <div style="display:flex;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid rgba(42,58,82,.4);font-size:12px">
      <span class="mono" style="color:var(--text2)">${x.ay}</span>
      <span style="color:var(--accent)">→</span>
      <span class="mono" style="color:var(--accent2)">${fmtDate(x.tarih)}</span>
      <button class="btn btn-danger btn-sm ozel-extre-sil-btn" style="margin-left:auto;padding:3px 8px" data-ay="${x.ay}">✕</button>
    </div>`).join('');
  // [ES module] onclick="deleteOzelExtre(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
  list.querySelectorAll('.ozel-extre-sil-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteOzelExtre(kartId, btn.getAttribute('data-ay')));
  });
}

export function deleteOzelExtre(kartId, ay) {
  DB.ozelExtreler = DB.ozelExtreler.filter(x=>!(x.kartId===kartId&&x.ay===ay));
  saveData();
  renderOzelExtreList(kartId);
  renderExtreler();
  const ayInput = document.getElementById('ozel-extre-ay');
  if(ayInput.value === ay) setDateInputValue('ozel-extre-tarih', '');
}


// Bir bekleyen ekstre kesinleştirme kaydı için: toplam borç, asgari ödeme, ekstre ve
// son ödeme tarihini gösteren zengin mini-istatistik kutuları + kart üstü satırı üretir.
// Extreler sayfasındaki dönem akordeonuyla aynı .exk-box görsel dilini kullanır.

