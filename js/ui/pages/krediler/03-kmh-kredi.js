import { saveData } from '../../../core/app-core-base.js';
import { tblFiltreMultiToggle, tblFiltreOkuMulti } from '../../../core/app-core.js';
import { fmt, fmtCur, fmtDate, localDateStr, uid } from '../../../core/format.js';
import { DB } from '../../../core/state.js';
import { _krediMetrik, getBsmvOrani, getKkdfOrani, getKmhFaizOrani, getKrediKalanBorc, hesaplaKrediOnizleme } from '../../../domain/hesaplamalar.js';
import { _markFieldError, phSet, showConfirm, showToast, validateRequiredFields } from '../../components/modal-genel.js';
import { getMoneyInput, setDateInputValue, setMoneyInput } from '../../components/money-input.js';
import { gecmisListesiRenderEt, swizUpdateStepIndicator } from '../../components/step-wizard.js';
import { bindTblFiltreChips, tblFiltreChipsMultiHtml, tblFiltreClearMultiHtml, tblSiralamaAyarla, tblSiralamaBarHtml, tblSiralamaOku, tblSiralamaUygula } from '../../components/tablo-filtre-sirala.js';
import { editHesapId } from '../hesaplar/04-hesap-liste-render.js';
import { KMHKREDI_STEP_COUNT, KREDI_DURUM_FILTRE_OPTS, _kmhKrediCurrentStep, editKmhKrediId, setEditKmhKrediId, set_kmhKrediCurrentStep } from './00-state.js';
import { _krediFiltreBaslikGuncelle, _renderKrediKart, _toggleKrediAccordion, readManuelTaksitler, renderKrediTaksitPlani, renderKrediTaksitPlaniEfektif } from './01-genel-yardimcilar.js';
import { getBanka } from '../tanimlamalar/01-genel-yardimcilar.js';
import { closeModal, openModal } from '../../components/modal-genel.js';
import { register } from '../../../core/wrap-registry.js';
// ============================================================
// js/ui/pages/krediler/03-kmh-kredi.js
// KMH kredisi (kredili mevduat hesabı taksitlendirme) akışı
//
// Bu dosya, eskiden tek parça olan js/ui/pages/krediler.js
// (87 export, 1700+ satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function calcKmhKredi(preserveManuel=false) {
  const anaPara = getMoneyInput('kmhkredi-anapara')||0;
  const faizYuzde = parseFloat(document.getElementById('kmhkredi-faiz').value)||0;
  const vade = parseInt(document.getElementById('kmhkredi-vade').value)||0;
  const kkdfYuzde = parseFloat(document.getElementById('kmhkredi-kkdf').value)||0;
  const bsmvYuzde = parseFloat(document.getElementById('kmhkredi-bsmv').value)||0;
  const ilkEkstre = document.getElementById('kmhkredi-ilk-ekstre').value;

  if(!anaPara||!vade) {
    document.getElementById('kmhkredi-preview').innerHTML = 'Değerleri girin, taksit otomatik hesaplanacak.';
    document.getElementById('kmhkredi-taksit-plani').style.display = 'none';
    return;
  }

  const toplamVergi = kkdfYuzde + bsmvYuzde;
  // ---- Saf hesaplama: js/domain/hesaplamalar.js:hesaplaKrediOnizleme (calcKredi ile aynı formül) ----
  const onizleme = hesaplaKrediOnizleme(anaPara, faizYuzde, vade, kkdfYuzde, bsmvYuzde, ilkEkstre || null);
  const { aylikFaiz, aylikTaksit, toplamBorc, toplamFaiz } = onizleme;

  const odemeGunTipVal = document.getElementById('kmhkredi-odeme-gun-tip').value;

  const tatilBadge = odemeGunTipVal
    ? `<div class="kredi-onizleme-banner">📅 <span>Taksit tatile denk gelirse → <b>${odemeGunTipVal === 'ilerle' ? 'sonraki iş günü' : 'önceki iş günü'}</b></span></div>`
    : '';
  const sonTaksitVal = onizleme.sonTaksitISO ? fmtDate(new Date(onizleme.sonTaksitISO+'T00:00:00')) : '';
  document.getElementById('kmhkredi-preview').innerHTML = `
    <div class="kredi-onizleme-grid">
      <div class="kredi-onizleme-card">
        <div class="kredi-onizleme-label">Efektif Aylık Faiz</div>
        <div class="kredi-onizleme-val">%${(aylikFaiz*100).toFixed(3)}</div>
      </div>
      <div class="kredi-onizleme-card">
        <div class="kredi-onizleme-label">KKDF / BSMV</div>
        <div class="kredi-onizleme-val" style="color:var(--sky)">%${kkdfYuzde} / %${bsmvYuzde}</div>
      </div>
      <div class="kredi-onizleme-card">
        <div class="kredi-onizleme-label">Aylık Taksit</div>
        <div class="kredi-onizleme-val" style="color:var(--warn)">${fmt(aylikTaksit)}</div>
      </div>
      <div class="kredi-onizleme-card">
        <div class="kredi-onizleme-label">Toplam Faiz</div>
        <div class="kredi-onizleme-val" style="color:var(--danger)">${fmt(toplamFaiz)}</div>
      </div>
      <div class="kredi-onizleme-card">
        <div class="kredi-onizleme-label">Toplam Borç</div>
        <div class="kredi-onizleme-val">${fmt(toplamBorc)}</div>
      </div>
      ${sonTaksitVal ? `<div class="kredi-onizleme-card"><div class="kredi-onizleme-label">Son Taksit</div><div class="kredi-onizleme-val" style="color:var(--teal)">${sonTaksitVal}</div></div>` : ''}
      ${tatilBadge}
    </div>`;

  if(ilkEkstre && vade) {
    renderKrediTaksitPlani('kmh', ilkEkstre, vade, aylikTaksit, preserveManuel, odemeGunTipVal);
  }
}

export function openKmhKrediModal(id=null) {
  setEditKmhKrediId(id);
  kmhKrediStepGoto(1);
  const sel = document.getElementById('kmhkredi-kmh');
  const kmhKartlar = getKmhKartlar();

  if(!kmhKartlar.length && !id) {
    showToast('⚠️ KMH limiti tanımlı banka hesabı bulunamadı. Lütfen önce banka hesabına KMH limiti tanımlayın.', 'error');
    return;
  }

  sel.innerHTML = kmhKartlar.map(k=>{
      const bankaAd = getBanka(k.banka) || '';
      const limitStr = k.kmhLimit ? ' — Limit: '+fmt(k.kmhLimit) : '';
      return `<option value="${k.id}">${bankaAd ? bankaAd+' · ' : ''}${k.ad}${limitStr}</option>`;
    }).join('');

  if(id) {
    const kr = (DB.krediler||[]).find(x=>x.id===id);
    if(kr) {
      document.getElementById('kmhkredi-modal-title').textContent = 'KMH Kredisi Düzenle';
      phSet(sel, 'KMH hesabı seçin…', kr.kmhId, '— KMH hesabı bulunamadı —');
      setMoneyInput('kmhkredi-anapara', kr.anaPara);
      document.getElementById('kmhkredi-faiz').value = kr.faizOran;
      document.getElementById('kmhkredi-vade').value = kr.vade;
      document.getElementById('kmhkredi-kkdf').value = kr.kkdf||0;
      document.getElementById('kmhkredi-bsmv').value = kr.bsmv||0;
      setDateInputValue('kmhkredi-ilk-ekstre', kr.ilkEkstre||'');
      document.getElementById('kmhkredi-odeme-gun-tip').value = kr.odemeGunTip||'';
      calcKmhKredi(true);
      // calcKmhKredi(true) tablo satırları henüz DOM'da olmadığı için manuel/öteleme
      // verilerini koruyamaz (readManuelTaksitler boş döner) — bu yüzden ardından
      // güncel (manuelTaksitler + taksitOverrides uygulanmış) planı üstüne yazıyoruz.
      renderKrediTaksitPlaniEfektif('kmh', kr, kr.aylikTaksit);
    }
  } else {
    document.getElementById('kmhkredi-modal-title').textContent = 'KMH Taksitli Kredi Ekle';
    phSet(sel, 'KMH hesabı seçin…', '', '— KMH hesabı bulunamadı —');
    setMoneyInput('kmhkredi-anapara', '');
    document.getElementById('kmhkredi-faiz').value = getKmhFaizOrani(localDateStr(new Date()));
    document.getElementById('kmhkredi-vade').value = '';
    document.getElementById('kmhkredi-kkdf').value = getKkdfOrani(localDateStr(new Date()));
    document.getElementById('kmhkredi-bsmv').value = getBsmvOrani(localDateStr(new Date()));
    setDateInputValue('kmhkredi-ilk-ekstre', '');
    document.getElementById('kmhkredi-odeme-gun-tip').value = '';
    document.getElementById('kmhkredi-taksit-plani').style.display = 'none';
    document.getElementById('kmhkredi-preview').textContent = 'Değerleri girin, taksit otomatik hesaplanacak.';
  }
  openModal('modal-kmhkredi');
}

export function kmhKrediStepGoto(step) {
  step = Math.max(1, Math.min(KMHKREDI_STEP_COUNT, step));
  set_kmhKrediCurrentStep(step);
  const modal = document.getElementById('modal-kmhkredi');
  if (!modal) return;
  // ---- Saf DOM güncelleme: js/ui/components/step-wizard.js:swizUpdateStepIndicator ----
  swizUpdateStepIndicator(modal, step);
  const backBtn = document.getElementById('kmhkredi-step-back-btn');
  const nextBtn = document.getElementById('kmhkredi-step-next-btn');
  const saveBtn = document.getElementById('kmhkredi-step-save-btn');
  if (backBtn) backBtn.style.display = step > 1 ? '' : 'none';
  if (nextBtn) nextBtn.style.display = step < KMHKREDI_STEP_COUNT ? '' : 'none';
  if (saveBtn) saveBtn.style.display = step === KMHKREDI_STEP_COUNT ? '' : 'none';
  const body = modal.querySelector('.modal-body');
  if (body) body.scrollTop = 0;
  if (step === KMHKREDI_STEP_COUNT) calcKmhKredi(true);
}

export function _kmhKrediValidateStep(step) {
  if (step === 1) {
    if (!validateRequiredFields([{id:'kmhkredi-kmh', msg:'KMH hesabı seçiniz'}])) return false;
    return true;
  }
  if (step === 2) {
    if (!validateRequiredFields([
      {id:'kmhkredi-anapara',    msg:'Ana para zorunlu'},
      {id:'kmhkredi-faiz',       msg:'Faiz oranı zorunlu'},
      {id:'kmhkredi-vade',       msg:'Vade zorunlu'},
      {id:'kmhkredi-ilk-ekstre', msg:'İlk ekstre tarihi zorunlu'}
    ])) return false;
    // Ana para, hesabın kullanılabilir KMH limitini aşmamalı — daha önce burada
    // hiç kontrol edilmiyordu, hesap zaten eksideyken veya limiti dolu iken bile
    // yeni bir KMH kredisi eklenebiliyordu.
    if (!_kmhKrediLimitKontrol()) return false;
    return true;
  }
  return true;
}

export function _kmhKrediKullanilabilirLimit(kmhId, haricTutulacakKrediId) {
  const hesap = getKmhHesap(kmhId);
  if (!hesap) return 0;
  const kmhLimit = hesap.kmhLimit || 0;
  let negatifKullanim = (hesap.bakiye || 0) < 0 ? Math.abs(hesap.bakiye) : 0;
  // Düzenlenmekte olan kredinin kendi ödenmiş taksitleri hesabı zaten eksiye
  // çekmiş olabilir (bkz. entKmhYansit). Bu kendi payını "yeni kullanım" gibi
  // tekrar düşersek, tutarı hiç değiştirmeden düzenleyip kaydetmek bile
  // yetersiz limit hatası verir. Bu yüzden kendi geçmiş ödemelerini geri ekliyoruz.
  if (haricTutulacakKrediId) {
    const oncekiOdenen = Object.keys(DB.entLog || {})
      .filter(k => k.startsWith(`kmh|${haricTutulacakKrediId}|`))
      .reduce((s, k) => s + (DB.entLog[k] || 0), 0);
    negatifKullanim = Math.max(0, negatifKullanim - oncekiOdenen);
    // Düzenlenmekte olan kredinin kendi ana parası da (kredi hiç ödenmemiş olsa
    // bile) hesabı zaten eksiye çekmiş olabilir — bu kredi KMH limitinin
    // kullanılmasıyla açılmıştır. Kendi anaparasını da geri eklemezsek, tutarda
    // hiçbir değişiklik yapmadan düzenleyip kaydetmek bile "yetersiz limit"
    // hatası verir (anapara hem "mevcut kullanım" hem de "yeni talep" olarak
    // iki kez sayılmış olur).
    const editKredi = (DB.krediler || []).find(kr => kr.id === haricTutulacakKrediId);
    if (editKredi) {
      negatifKullanim = Math.max(0, negatifKullanim - (editKredi.anaPara || 0));
    }
  }
  const digerKredilerKalan = (DB.krediler || [])
    .filter(kr => kr.kmhId === kmhId && kr.id !== haricTutulacakKrediId)
    .reduce((s, kr) => s + getKrediKalanBorc(kr), 0);
  return kmhLimit - negatifKullanim - digerKredilerKalan;
}

export function _kmhKrediLimitKontrol() {
  const kmhId = document.getElementById('kmhkredi-kmh').value;
  const anaPara = getMoneyInput('kmhkredi-anapara') || 0;
  const kullanilabilir = _kmhKrediKullanilabilirLimit(kmhId, editKmhKrediId);
  if (anaPara > kullanilabilir) {
    const hesap = getKmhHesap(kmhId);
    const pb = (hesap && hesap.paraBirimi) || 'TRY';
    showToast(`Yetersiz KMH limiti — kullanılabilir: ${fmtCur(Math.max(kullanilabilir,0), pb)}`, 'error');
    _markFieldError('kmhkredi-anapara');
    const el = document.getElementById('kmhkredi-anapara');
    if (el) { el.scrollIntoView({behavior:'smooth', block:'center'}); el.focus(); }
    return false;
  }
  return true;
}

export function kmhKrediStepNext() {
  if (!_kmhKrediValidateStep(_kmhKrediCurrentStep)) return;
  kmhKrediStepGoto(_kmhKrediCurrentStep + 1);
}

export function kmhKrediStepBack() {
  kmhKrediStepGoto(_kmhKrediCurrentStep - 1);
}

export function deleteKmhKredi(id) {
  showConfirm('Bu KMH kredisini silmek istiyor musunuz?', () => {
    DB.krediler = DB.krediler.filter(x=>x.id!==id);
    saveData();
    renderKmhKredi();
  });
}

export function renderKmhKredi() {
  if(!DB.krediler) DB.krediler = [];
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = localDateStr(today);

  let toplamAna=0, toplamBorc=0, toplamKalan=0, aktifSayisi=0;
  DB.krediler.forEach(kr=>{
    toplamAna += kr.anaPara;
    toplamBorc += kr.toplamBorc;
    const kalan = getKrediKalanBorc(kr);
    toplamKalan += kalan;
    if(kalan > 0) aktifSayisi++;
  });

  document.getElementById('kmhkredi-stats').innerHTML = `
    <div class="stat s-blue"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg></div><div class="stat-label">Toplam Ana Para</div><div class="stat-val blue">${fmt(toplamAna)}</div></div>
    <div class="stat s-warn"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div><div class="stat-label">Toplam Borç</div><div class="stat-val warn">${fmt(toplamBorc)}</div></div>
    <div class="stat s-red"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><div class="stat-label">Kalan Borç</div><div class="stat-val red">${fmt(toplamKalan)}</div></div>
    <div class="stat s-blue"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div><div class="stat-label">Aktif KMH Kredisi</div><div class="stat-val blue">${aktifSayisi}</div></div>`;

  const wrap = document.getElementById('kmhkredi-karti-wrap');
  if(!DB.krediler.length) {
    wrap.innerHTML = '<div class="card" style="padding:32px;text-align:center;color:var(--text3)">KMH kredi kaydı yok</div>';
    document.getElementById('kmhkredi-plan').innerHTML = '';
    const _kmhDurumElBos = document.getElementById('kmhkredi-durum-filtre');
    if(_kmhDurumElBos) _kmhDurumElBos.innerHTML = '';
    const _kmhSiraElBos = document.getElementById('kmhkredi-siralama-bar');
    if(_kmhSiraElBos) _kmhSiraElBos.innerHTML = '';
    return;
  }

  // ── Durum filtresi (Tümü / Aktif / Tamamlanmış) — DB.uiFiltreler.kmhkredi.durum içinde kalıcı ──
  const _kmhDurumFiltre = tblFiltreOkuMulti('kmhkredi', 'durum');
  const kmhDurumEl = document.getElementById('kmhkredi-durum-filtre');
  if(kmhDurumEl) {
    kmhDurumEl.innerHTML = tblFiltreChipsMultiHtml('', KREDI_DURUM_FILTRE_OPTS, _kmhDurumFiltre, 'setKmhKrediDurumFiltre')
      + tblFiltreClearMultiHtml(_kmhDurumFiltre, 'setKmhKrediDurumFiltre');
    // [ES module] onclick="setKmhKrediDurumFiltre(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
    bindTblFiltreChips(kmhDurumEl, { setKmhKrediDurumFiltre });
  }
  _krediFiltreBaslikGuncelle('kmhkredi-filtre-title-suffix', _kmhDurumFiltre);

  // ── Sıralama (DB.uiSiralama.kmhkredi içinde kalıcı) ──
  const _kmhAktifSirala = tblSiralamaOku('kmhkredi', 'eklenme', 'asc');
  const kmhSiralamaBarEl = document.getElementById('kmhkredi-siralama-bar');
  if(kmhSiralamaBarEl) {
    kmhSiralamaBarEl.innerHTML = tblSiralamaBarHtml([
      {key:'eklenme', label:'Eklenme Sırası', ikon:'takvim', yon:'asc'},
      {key:'kalan', label:'Kalan Borç', ikon:'tutar', yon:'desc'},
      {key:'anapara', label:'Ana Para', ikon:'tutar', yon:'desc'},
      {key:'aylik', label:'Aylık Taksit', ikon:'tutar', yon:'desc'},
      {key:'faiz', label:'Faiz Oranı', ikon:'yuzde', yon:'desc'},
      {key:'vade', label:'Vade', ikon:'gun', yon:'desc'},
      {key:'ilerleme', label:'İlerleme %', ikon:'yuzde', yon:'desc'},
      {key:'bitis', label:'Bitiş Tarihi', ikon:'takvim', yon:'asc'},
      {key:'siradaki', label:'Sıradaki Ödeme', ikon:'takvim', yon:'asc'}
    ], _kmhAktifSirala, 'kmhKrediSirala');
    // [ES module] onclick="kmhKrediSirala(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
    bindTblFiltreChips(kmhSiralamaBarEl, { kmhKrediSirala });
  }

  const _kmhListe = DB.krediler.map(kr => ({ kr, m: _krediMetrik(kr, 'kmh', todayStr) }));
  const kmhSirali = tblSiralamaUygula(_kmhListe, _kmhAktifSirala, {
    eklenme: (a,b)=>0,
    kalan: (a,b)=>a.m.kalan-b.m.kalan,
    anapara: (a,b)=>(a.kr.anaPara||0)-(b.kr.anaPara||0),
    aylik: (a,b)=>(a.kr.aylikTaksit||0)-(b.kr.aylikTaksit||0),
    faiz: (a,b)=>(parseFloat(a.kr.faizOran)||0)-(parseFloat(b.kr.faizOran)||0),
    vade: (a,b)=>(a.kr.vade||0)-(b.kr.vade||0),
    ilerleme: (a,b)=>a.m.ilerleme-b.m.ilerleme,
    bitis: (a,b)=>String(a.m.sonTarih||'').localeCompare(String(b.m.sonTarih||'')),
    siradaki: (a,b)=>String(a.m.siradakiOdemeTarihi||'9999-99-99').localeCompare(String(b.m.siradakiOdemeTarihi||'9999-99-99'))
  });
  const kmhFiltreli = kmhSirali.filter(x => !_kmhDurumFiltre.length || _kmhDurumFiltre.includes(x.m.bitti ? 'tamamlandi' : 'aktif'));

  wrap.innerHTML = kmhFiltreli.length
    ? kmhFiltreli.map(x => _renderKrediKart(x.kr, 'kmh', todayStr)).join('')
    : '<div class="card" style="padding:32px;text-align:center;color:var(--text3)">Filtreye uyan KMH kredisi yok</div>';
  document.getElementById('kmhkredi-plan').innerHTML = '';
  // [ES module] _renderKrediKart paylaşılan bir render yardımcısıdır - onun
  // ürettiği .kredi-kart-edit-btn / .kredi-kart-delete-btn / .kredi-accordion-toggle
  // class'larına burada gerçek addEventListener bağlanıyor.
  wrap.querySelectorAll('.kredi-kart-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openKmhKrediModal(btn.getAttribute('data-id')));
  });
  wrap.querySelectorAll('.kredi-kart-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteKmhKredi(btn.getAttribute('data-id')));
  });
  wrap.querySelectorAll('.kredi-accordion-toggle').forEach(header => {
    header.addEventListener('click', () => _toggleKrediAccordion(header));
  });
}

export function kmhKrediSirala(key, varsayilanYon) {
  tblSiralamaAyarla('kmhkredi', key, varsayilanYon);
  renderKmhKredi();
}

export function kmhLimitGecmisSonSil() {
  if(!editHesapId) return;
  const idx = (DB.hesaplar||[]).findIndex(h=>h.id===editHesapId);
  if(idx<0) return;
  const h = DB.hesaplar[idx];
  const gecmis = (h.kmhLimitGecmisi||[]).slice().sort((a,b)=>b.tarih.localeCompare(a.tarih));
  if(gecmis.length <= 1) {
    showConfirm('Tek kayıt kaldı. KMH geçmişi tamamen silinsin mi?', ()=>{
      h.kmhLimitGecmisi = [];
      h.kmhLimit = 0;
      h.kmhLimitTarih = '';
      saveData();
      renderKmhLimitGecmis([], h.paraBirimi||'TRY');
      setMoneyInput('hesap-kmh-limit', '');
      setDateInputValue('hesap-kmh-limit-tarih', localDateStr(new Date()));
    });
    return;
  }
  showConfirm('Son limit kaydı silinsin mi? Bir önceki limite dönülecek.', ()=>{
    // en yeni kaydı çıkar
    const yeniGecmis = gecmis.slice(1); // tarihe göre sıralı, 0.indeks en yeni
    h.kmhLimitGecmisi = yeniGecmis;
    // bir önceki (şimdi en yeni olan) limiti geri yükle
    const onceki = yeniGecmis[0];
    h.kmhLimit = onceki ? onceki.limit : 0;
    h.kmhLimitTarih = onceki ? onceki.tarih : '';
    saveData();
    renderKmhLimitGecmis(yeniGecmis, h.paraBirimi||'TRY');
    setMoneyInput('hesap-kmh-limit', h.kmhLimit || '');
    setDateInputValue('hesap-kmh-limit-tarih', h.kmhLimitTarih || '');
  });
}

export function getKmhKartlar() {
  // Banka hesapları içinden KMH limiti tanımlı olanları döndür
  return (DB.hesaplar||[]).filter(h=>
    h.durum !== 'kapali' &&
    (h.kmhLimit > 0 || (h.kmhLimitGecmisi && h.kmhLimitGecmisi.length > 0))
  );
}

// kmhId ile banka hesabını getir (KMH kredileri için)
// Geriye dönük uyumluluk: önce hesaplarda, bulamazsa kartlarda ara

export function getKmhHesap(id) {
  return (DB.hesaplar||[]).find(h=>h.id===id) || DB.kartlar.find(k=>k.id===id) || null;
}

export function saveKmhKredi() {
  const kmhId = document.getElementById('kmhkredi-kmh').value;
  const anaPara = getMoneyInput('kmhkredi-anapara')||0;
  const faizOran = parseFloat(document.getElementById('kmhkredi-faiz').value)||0;
  const vade = parseInt(document.getElementById('kmhkredi-vade').value)||0;
  const kkdf = parseFloat(document.getElementById('kmhkredi-kkdf').value)||0;
  const bsmv = parseFloat(document.getElementById('kmhkredi-bsmv').value)||0;
  const ilkEkstre = document.getElementById('kmhkredi-ilk-ekstre').value;
  const odemeGunTip = document.getElementById('kmhkredi-odeme-gun-tip').value;

  if(!validateRequiredFields([{id:'kmhkredi-kmh',msg:'KMH hesabı seçiniz'},{id:'kmhkredi-anapara',msg:'Ana para zorunlu'},{id:'kmhkredi-faiz',msg:'Faiz oranı zorunlu'},{id:'kmhkredi-vade',msg:'Vade zorunlu'},{id:'kmhkredi-ilk-ekstre',msg:'İlk ekstre tarihi zorunlu'}])) return;
  if(!_kmhKrediLimitKontrol()) return;

  // ---- Saf hesaplama: js/domain/hesaplamalar.js:hesaplaKrediOnizleme
  //      (calcKmhKredi'deki ÖNİZLEME ile AYNI kaynak) ----
  const _onizleme = hesaplaKrediOnizleme(anaPara, faizOran, vade, kkdf, bsmv, ilkEkstre || null);
  const { aylikTaksit, toplamBorc } = _onizleme;
  const manuelTaksitler = readManuelTaksitler('kmh', vade);

  const kredi = {
    id: editKmhKrediId || uid(),
    kmhId, anaPara, faizOran, kkdf, bsmv, vade, ilkEkstre,
    odemeGunTip: odemeGunTip || '',
    aylikTaksit: parseFloat(aylikTaksit.toFixed(2)),
    toplamBorc: parseFloat(toplamBorc.toFixed(2)),
    manuelTaksitler: manuelTaksitler
  };

  if(!DB.krediler) DB.krediler = [];
  if(editKmhKrediId) {
    const idx = DB.krediler.findIndex(x=>x.id===editKmhKrediId);
    if(idx>=0) DB.krediler[idx]=kredi;
  } else {
    DB.krediler.push(kredi);
  }
  setEditKmhKrediId(null);
  saveData();
  closeModal('modal-kmhkredi');
  renderKmhKredi();
}

export function setKmhKrediDurumFiltre(durum) {
  tblFiltreMultiToggle('kmhkredi', 'durum', durum);
  renderKmhKredi();
}

export function onKmhToggleChange() {
  const checked = document.getElementById('hesap-kmh-toggle').checked;
  document.getElementById('hesap-kmh-panel').style.display = checked ? '' : 'none';
  // KMH toggle hesap türünü değiştirmiyor, tür ayrıca seçilir
}

// kmhLimitGecmisEkle kaldırıldı — geçmiş artık sistem tarafından otomatik tutulur

// KMH limit geçmişini sadece görüntüleme amacıyla render eder (readonly)
// Son kayıt silinebilir; silindiğinde bir önceki limit geri yüklenir

export function renderKmhLimitGecmis(gecmis, paraBirimi) {
  const panel = document.getElementById('hesap-kmh-gecmis-liste');
  const pb = paraBirimi || (document.getElementById('hesap-para-birimi')||{}).value || 'TRY';
  gecmisListesiRenderEt(panel, gecmis, {
    bosMesaj: 'Henüz limit kaydı yok',
    deger: g => g.limit,
    degerHtml: g => fmtCur(g.limit, pb),
    farkHtml: (g, fark) => fmtCur(fark, pb),
    silHandler: () => kmhLimitGecmisSonSil()
  });
}

// readKmhLimitGecmis — sadece mevcut geçmişi data'dan döndürür (artık modal'dan okuma yok)

export function readKmhLimitGecmis() {
  // Geçmiş kaydedilirken DB'den alınır, modal'daki readonly alanlardan okunmaz
  if(editHesapId) {
    const h = (DB.hesaplar||[]).find(x=>x.id===editHesapId);
    return (h && h.kmhLimitGecmisi) ? h.kmhLimitGecmisi : [];
  }
  return [];
}

// [ES module] taban render fonksiyonu(ları) odeme/patches zincirinin
// hook() ile sarmalayabilmesi için wrap-registry'ye kaydediliyor.
register('renderKmhKredi', renderKmhKredi);
