import { fmtCur } from '@core/format.js';
import { DB } from '@core/state.js';
import { _tutarAsiyorMu, getStopajOrani } from '@domain/hesaplamalar.js';
import { phSet } from '@components/modal-genel.js';
import { getMoneyInput } from '@components/money-input.js';
import { hesapOptionMetin } from '@pages/hesaplar/01-genel-yardimcilar.js';
import { _editMevduatEskiTutar, editMevduatId } from '@pages/mevduat/00-state.js';
import { calcMevduat } from '@pages/mevduat/01-mevduat-form-wizard.js';
// ============================================================
// js/ui/pages/mevduat/06-mevduat-hesap-secim-formu.js
// Mevduat formu içindeki hesap/kaynak/strateji seçim yardımcıları
//
// Bu dosya, eskiden tek parça olan js/ui/pages/mevduat.js
// (43 export, 1589 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function onMevHesapChange() {
  const hesapId = (document.getElementById('mev-hesap-id')||{}).value || '';
  const displayWrap = document.getElementById('mev-banka-display');
  const displayText = document.getElementById('mev-banka-ad-text');
  const hiddenInp = document.getElementById('mev-banka-hidden');
  if(!hesapId) {
    if(displayWrap) displayWrap.style.display='none';
    if(hiddenInp) hiddenInp.value='';
    _updateMevTutarBakiyeHint();
    return;
  }
  const hesap = (DB.hesaplar||[]).find(h=>h.id===hesapId);
  if(!hesap) return;
  if(hesap.banka) {
    const bankaObj = (DB.bankalar||[]).find(b=>b.id===hesap.banka);
    if(bankaObj) {
      if(displayText) displayText.textContent = bankaObj.kisa;
      if(displayWrap) { displayWrap.style.display='flex'; const lbl = displayWrap.querySelector('span:last-child'); if(lbl) lbl.textContent='Hesaptan algılandı'; }
      if(hiddenInp) hiddenInp.value = hesap.banka;
    }
  } else {
    if(displayWrap) displayWrap.style.display='none';
    if(hiddenInp) hiddenInp.value='';
  }
  const curSel = document.getElementById('mev-para-birimi');
  if(curSel && hesap.paraBirimi) curSel.value = hesap.paraBirimi;
  _updateMevTutarBakiyeHint();
}

export function _fillMevHesapSel(selectedId) {
  const hesapSel = document.getElementById('mev-hesap-id');
  if(!hesapSel) return;
  const secilenPb = (document.getElementById('mev-para-birimi')||{}).value || '';
  const otoToggle = document.getElementById('mev-oto-hesap');
  const otoAktif = otoToggle && otoToggle.checked;
  // Toggle KAPALI: sadece VADELİ hesaplar; Toggle AÇIK: vadesiz hesaplar (kaynak)
  let aktifler = (DB.hesaplar||[]).filter(h => h.durum==='aktif' && (otoAktif ? h.tur !== 'vadeli' : h.tur === 'vadeli'));
  if(secilenPb) aktifler = aktifler.filter(h=>(h.paraBirimi||'TRY') === secilenPb);
  // Zaten bir mevduatla ilişkili vadeli hesapları listeden çıkar — bir vadeli hesap yalnızca
  // bir mevduata bağlı olabilir. Düzenlenen mevduatın kendi hesabı hariç tutulur.
  if(!otoAktif) {
    const kullanilanHesapIdler = new Set(
      (DB.mevduatlar||[])
        .filter(m => m.hesapId && m.id !== editMevduatId)
        .map(m => m.hesapId)
    );
    aktifler = aktifler.filter(h => !kullanilanHesapIdler.has(h.id));
  }
  hesapSel.innerHTML = aktifler.map(h=>`<option value="${h.id}">${hesapOptionMetin(h)}</option>`).join('');
  const bosMsg = otoAktif
    ? (secilenPb ? `— ${secilenPb} cinsinden vadesiz hesap bulunamadı —` : '— Vadesiz hesap bulunamadı —')
    : (secilenPb ? `— ${secilenPb} cinsinden uygun vadeli hesap bulunamadı —` : '— Uygun vadeli hesap bulunamadı (tümü başka mevduatla ilişkili) —');
  phSet(hesapSel, otoAktif ? 'Kaynak hesap seçin…' : 'Vadeli hesap seçin…', selectedId||'', bosMsg);
}

export function onMevStratejiChange() {
  const s = (document.getElementById('mev-strateji')||{}).value || '';
  const vadesizWrap = document.getElementById('mev-vadesiz-wrap');
  const yenilemeBilgi = document.getElementById('mev-yenileme-bilgi');
  const vadesizLabel = document.getElementById('mev-vadesiz-label');
  const vadesizHint  = document.getElementById('mev-vadesiz-hint');

  // Vadesiz hesap seçimi: strateji 2 veya 3'te göster
  const showVadesiz = s === 'yenile_ana_faiz_vadesiz' || s === 'tumu_vadesiz';
  if(vadesizWrap) vadesizWrap.style.display = showVadesiz ? 'block' : 'none';

  // Etiket ve hint
  if(s === 'yenile_ana_faiz_vadesiz') {
    if(vadesizLabel) vadesizLabel.textContent = 'Faizin Aktarılacağı Vadesiz Hesap';
    if(vadesizHint)  vadesizHint.textContent  = 'Vade sonunda sadece net faiz bu hesaba geçer, ana para yeni mevduat olarak yenilenir.';
  } else if(s === 'tumu_vadesiz') {
    if(vadesizLabel) vadesizLabel.textContent = 'Ana Para + Faizin Aktarılacağı Vadesiz Hesap';
    if(vadesizHint)  vadesizHint.textContent  = 'Vade sonunda tüm tutar (ana para + net faiz) bu hesaba aktarılır.';
  }

  // Yenileme bildirimi notu: strateji 1 veya 2'de göster
  const showBilgi = s === 'yenile_tum' || s === 'yenile_ana_faiz_vadesiz';
  if(yenilemeBilgi) yenilemeBilgi.style.display = showBilgi ? 'block' : 'none';

  // Eğer strateji gösteriliyorsa ve banka biliniyorsa listeyi filtrele
  if(showVadesiz) {
    const bankaId = (document.getElementById('mev-banka-hidden')||{}).value || '';
    const otoAktif = (document.getElementById('mev-oto-hesap')||{}).checked;
    const currentVal = (document.getElementById('mev-vadesiz-hesap-id')||{}).value || '';
    _fillMevVadesizSel(currentVal, otoAktif ? bankaId : '');
  }
}

export function _fillMevVadesizSel(selectedId, bankaId) {
  const sel = document.getElementById('mev-vadesiz-hesap-id');
  if(!sel) return;
  const secilenPb = (document.getElementById('mev-para-birimi')||{}).value || '';
  let vadesizler = (DB.hesaplar||[]).filter(h=>h.durum==='aktif' && h.tur !== 'vadeli');
  // Eğer banka biliniyorsa önce o bankadan filtrele, yoksa hepsini göster
  if(bankaId) vadesizler = vadesizler.filter(h=>h.banka === bankaId);
  // Para birimine göre filtrele
  if(secilenPb) vadesizler = vadesizler.filter(h=>(h.paraBirimi||'TRY') === secilenPb);
  sel.innerHTML = vadesizler.map(h=>`<option value="${h.id}">${hesapOptionMetin(h)}</option>`).join('');
  const bosMsg = secilenPb ? `— ${secilenPb} cinsinden vadesiz hesap bulunamadı —` : '— Vadesiz hesap bulunamadı —';
  phSet(sel, 'Hesap seçin…', selectedId||'', bosMsg);
}

export function onMevOtoHesapToggle() {
  const checked = document.getElementById('mev-oto-hesap').checked;
  const otoWrap = document.getElementById('mev-oto-hesap-wrap');
  const hesapLabel = document.getElementById('mev-hesap-label');
  const hesapSel = document.getElementById('mev-hesap-id');
  const dw = document.getElementById('mev-banka-display');
  const hid = document.getElementById('mev-banka-hidden');

  // Yeni hesap adı + IBAN alanı: sadece oto=açık modda
  if(otoWrap) otoWrap.style.display = checked ? 'block' : 'none';

  // Etiket güncelle
  if(hesapLabel) hesapLabel.innerHTML = checked
    ? 'Paranın Alınacağı Hesap <span style="color:var(--danger)">*</span>'
    : 'Vadeli Hesap <span style="color:var(--danger)">*</span>';

  // Placeholder güncelle
  if(hesapSel) {
    const ph = hesapSel.querySelector('option[value=""][disabled]');
    if(ph) ph.textContent = checked ? '— Kaynak hesap seçin (zorunlu) —' : '— Vadeli hesap seçin (zorunlu) —';
    hesapSel.value = '';
  }
  if(dw) dw.style.display='none';
  if(hid) hid.value = '';
  if(checked) {
    const ibanM = document.getElementById('mev-iban-manuel');
    if(ibanM) ibanM.value = '';
  }
  // Listeyi moda göre yeniden doldur
  _fillMevHesapSel('');
  _updateMevTutarBakiyeHint();
}

// Kaynak hesap seçilince banka otomatik algıla

// [KALDIRILDI] onMevKaynakHesapChange() — "mev-kaynak-hesap-id" id'li element
// index.html'de hiç yok, hiçbir yerden çağrılmıyordu; eski bir mevduat formu
// tasarımından kalma (ölü kod taraması, 2026-07).

// Paranın alınacağı kaynak hesap listesi — tüm aktif vadesiz hesaplar

// [KALDIRILDI] _fillMevKaynakSel(bankaId) — "mev-kaynak-hesap-id" id'li element
// index.html'de hiç yok, hiçbir yerden çağrılmıyordu; onMevKaynakHesapChange
// ile aynı eski tasarımın parçasıydı (ölü kod taraması, 2026-07).

// ── Kaynak hesap bakiyesi ile girilen tutarı karşılaştırır ──────────────
// Sadece "Yeni Vadeli Hesap Kaydı Oluştur" (oto hesap) modunda, kaynak hesap
// seçiliyken anlamlıdır — o modda para gerçekten kaynak hesaptan düşülür.

export function _updateMevTutarBakiyeHint() {
  const btn = document.getElementById('mev-tutar-tum-btn');
  const hint = document.getElementById('mev-tutar-bakiye-hint');
  if(!btn || !hint) return;
  const otoToggle = document.getElementById('mev-oto-hesap');
  const otoAktif = otoToggle && otoToggle.checked;
  const hesapSel = document.getElementById('mev-hesap-id');
  const hesapId = hesapSel ? hesapSel.value : '';
  const hesap = (otoAktif && hesapId) ? (DB.hesaplar||[]).find(h=>h.id===hesapId) : null;
  if(!hesap) {
    btn.style.display = 'none';
    hint.style.display = 'none';
    return;
  }
  btn.style.display = 'flex';
  hint.style.display = 'block';
  const bakiye = hesap.bakiye || 0;
  const tutar = getMoneyInput('mev-tutar') || 0;
  const pb = hesap.paraBirimi || 'TRY';
  if(_tutarAsiyorMu(tutar, bakiye)) {
    hint.innerHTML = `⚠ Hesap bakiyesi <b>${fmtCur(bakiye, pb)}</b> — girilen tutar bakiyeyi aşıyor`;
    hint.style.color = 'var(--danger)';
  } else {
    hint.innerHTML = `Hesap bakiyesi: <b>${fmtCur(bakiye, pb)}</b>`;
    hint.style.color = 'var(--text3)';
  }
}

// Mevduat düzenlenirken tutar değiştirilirse, farkın hangi hesaba gidip/geleceğini
// sormak için gerekli alanı gösterir/gizler ve o hesap listesini doldurur.

export function _updateMevTutarFarkAlani() {
  const wrap = document.getElementById('mev-tutar-fark-wrap');
  const label = document.getElementById('mev-tutar-fark-label');
  if(!wrap) return;
  if(!editMevduatId || _editMevduatEskiTutar === null) { wrap.style.display = 'none'; return; }
  const tutar = getMoneyInput('mev-tutar') || 0;
  const fark = tutar - _editMevduatEskiTutar;
  if(!fark) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  if(label) label.innerHTML = (fark > 0
    ? 'Farkın Alınacağı Hesap'
    : 'Farkın Yatırılacağı Hesap') + ' <span style="color:var(--danger)">*</span>';
  _fillMevTutarFarkSel();
}

export function _fillMevTutarFarkSel() {
  const sel = document.getElementById('mev-tutar-fark-hesap-id');
  if(!sel) return;
  const onceki = sel.value || '';
  const secilenPb = (document.getElementById('mev-para-birimi')||{}).value || '';
  let hesaplar = (DB.hesaplar||[]).filter(h=>h.durum==='aktif' && h.tur !== 'vadeli');
  if(secilenPb) hesaplar = hesaplar.filter(h=>(h.paraBirimi||'TRY') === secilenPb);
  sel.innerHTML = hesaplar.map(h=>`<option value="${h.id}">${hesapOptionMetin(h)}</option>`).join('');
  const bosMsg = secilenPb ? `— ${secilenPb} cinsinden hesap bulunamadı —` : '— Uygun hesap bulunamadı —';
  phSet(sel, 'Hesap seçin…', onceki, bosMsg);
}

export function onMevBaslangicChange() {
  const tarih = document.getElementById('mev-baslangic').value;
  if(tarih) document.getElementById('mev-stopaj').value = getStopajOrani(tarih);
  calcMevduat();
}

// ---- (2. tur refactor: 02-core-app-engine.js'den taşındı) ----
// Aksiyon kartını geçici olarak gizle (session)
export var _mevGizliAksiyonlar = new Set();

// ---- (3. tur refactor: patch-rf-v57-daily-deposit-business-day-refactor.js'den taşındı, zincirsiz/tekil patch) ----

