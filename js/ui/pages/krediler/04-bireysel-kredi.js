import { saveData } from '../../../core/app-core-base.js';
import { tblFiltreKaydet, tblFiltreMultiToggle, tblFiltreOku, tblFiltreOkuMulti } from '../../../core/app-core.js';
import { fmt, fmtDate, localDateStr, uid } from '../../../core/format.js';
import { DB } from '../../../core/state.js';
import { _krediMetrik, getBireyselKrediKalan, getBsmvOrani, getKkdfOrani, hesaplaKrediOnizleme } from '../../../domain/hesaplamalar.js';
import { phSet, showConfirm, validateRequiredFields } from '../../components/modal-genel.js';
import { getMoneyInput, setDateInputValue, setMoneyInput } from '../../components/money-input.js';
import { swizUpdateStepIndicator } from '../../components/step-wizard.js';
import { bindTblFiltreChips, tblFiltreChipsHtml, tblFiltreChipsMultiHtml, tblFiltreClearHtml, tblFiltreClearMultiHtml, tblSiralamaAyarla, tblSiralamaBarHtml, tblSiralamaOku, tblSiralamaUygula } from '../../components/tablo-filtre-sirala.js';
import { KREDI_DURUM_FILTRE_OPTS, KREDI_STEP_COUNT, _krediCurrentStep, editKrediId, setEditKrediId, set_krediCurrentStep } from './00-state.js';
import { _krediFiltreBaslikGuncelle, _krediTurEtiket, _renderKrediKart, _toggleKrediAccordion, readManuelTaksitler, renderKrediTaksitPlani, renderKrediTaksitPlaniEfektif } from './01-genel-yardimcilar.js';
import { bankaOptionMetin, getBanka } from '../tanimlamalar/01-genel-yardimcilar.js';
import { closeModal, openModal } from '../../components/modal-genel.js';
import { register } from '../../../core/wrap-registry.js';
// ============================================================
// js/ui/pages/krediler/04-bireysel-kredi.js
// Bireysel kredi (ihtiyaç/konut) akışı
//
// Bu dosya, eskiden tek parça olan js/ui/pages/krediler.js
// (87 export, 1700+ satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function calcKredi(preserveManuel=false) {
  const anaPara = getMoneyInput('kredi-anapara')||0;
  const faizYuzde = parseFloat(document.getElementById('kredi-faiz').value)||0;
  const vade = parseInt(document.getElementById('kredi-vade').value)||0;
  const kkdfYuzde = parseFloat(document.getElementById('kredi-kkdf').value)||0;
  const bsmvYuzde = parseFloat(document.getElementById('kredi-bsmv').value)||0;
  const ilkTaksit = document.getElementById('kredi-ilk-taksit').value;

  if(!anaPara||!vade) {
    document.getElementById('kredi-preview').innerHTML = 'Değerleri girin, taksit otomatik hesaplanacak.';
    document.getElementById('kredi-taksit-plani').style.display = 'none';
    return;
  }

  const toplamVergi = kkdfYuzde + bsmvYuzde;
  // ---- Saf hesaplama artık js/domain/hesaplamalar.js:hesaplaKrediOnizleme'de ----
  const onizleme = hesaplaKrediOnizleme(anaPara, faizYuzde, vade, kkdfYuzde, bsmvYuzde, ilkTaksit || null);
  const { aylikFaiz, aylikTaksit, toplamBorc, toplamFaiz } = onizleme;

  const odemeGunTipKrVal = document.getElementById('kredi-odeme-gun-tip').value;

  const tatilBadgeKr = odemeGunTipKrVal
    ? `<div class="kredi-onizleme-banner">📅 <span>Taksit tatile denk gelirse → <b>${odemeGunTipKrVal === 'ilerle' ? 'sonraki iş günü' : 'önceki iş günü'}</b></span></div>`
    : '';
  const sonTaksitKrVal = onizleme.sonTaksitISO ? fmtDate(new Date(onizleme.sonTaksitISO+'T00:00:00')) : '';
  document.getElementById('kredi-preview').innerHTML = `
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
      ${sonTaksitKrVal ? `<div class="kredi-onizleme-card"><div class="kredi-onizleme-label">Son Taksit</div><div class="kredi-onizleme-val" style="color:var(--teal)">${sonTaksitKrVal}</div></div>` : ''}
      ${tatilBadgeKr}
    </div>`;

  if(ilkTaksit && vade) {
    renderKrediTaksitPlani('kredi', ilkTaksit, vade, aylikTaksit, preserveManuel, odemeGunTipKrVal);
  }
}

export function openKrediModal(id=null) {
  setEditKrediId(id);
  krediStepGoto(1);
  const bankaSel = document.getElementById('kredi-banka');
  bankaSel.innerHTML = DB.bankalar.map(b=>`<option value="${b.id}">${bankaOptionMetin(b)}</option>`).join('');
  phSet(bankaSel, 'Banka seçin…', '', '— Banka bulunamadı —');

  // Kredi türü dropdown'u DB.krediTipleri'nden doldur
  const krediTurSel = document.getElementById('kredi-tur');
  krediTurSel.innerHTML = (DB.krediTipleri||[]).map(t=>`<option value="${t.id}">${t.ad} (${t.kod})</option>`).join('');
  phSet(krediTurSel, 'Tür seçin…', '', '— Kredi türü bulunamadı —');

  if(id) {
    const kr = (DB.bireyselKrediler||[]).find(x=>x.id===id);
    if(kr) {
      document.getElementById('kredi-modal-title').textContent = 'Kredi Düzenle';
      phSet(bankaSel, 'Banka seçin…', kr.banka||'', '— Banka bulunamadı —');
      phSet(krediTurSel, 'Tür seçin…', kr.tur||'ihtiyac', '— Kredi türü bulunamadı —');
      document.getElementById('kredi-aciklama').value = kr.aciklama||'';
      setMoneyInput('kredi-anapara', kr.anaPara);
      document.getElementById('kredi-faiz').value = kr.faizOran;
      document.getElementById('kredi-vade').value = kr.vade;
      document.getElementById('kredi-kkdf').value = kr.kkdf||0;
      document.getElementById('kredi-bsmv').value = kr.bsmv||0;
      setDateInputValue('kredi-ilk-taksit', kr.ilkTaksit||'');
      document.getElementById('kredi-odeme-gun-tip').value = kr.odemeGunTip||'';
      calcKredi(true);
      // calcKredi(true) tablo satırları henüz DOM'da olmadığı için manuel/öteleme
      // verilerini koruyamaz (readManuelTaksitler boş döner) — bu yüzden ardından
      // güncel (manuelTaksitler + taksitOverrides uygulanmış) planı üstüne yazıyoruz.
      renderKrediTaksitPlaniEfektif('kredi', kr, kr.aylikTaksit);
    }
  } else {
    document.getElementById('kredi-modal-title').textContent = 'Bireysel Kredi Ekle';
    phSet(bankaSel, 'Banka seçin…', '', '— Banka bulunamadı —');
    phSet(krediTurSel, 'Tür seçin…', '', '— Kredi türü bulunamadı —');
    document.getElementById('kredi-aciklama').value = '';
    setMoneyInput('kredi-anapara', '');
    document.getElementById('kredi-faiz').value = '';
    document.getElementById('kredi-vade').value = '';
    document.getElementById('kredi-kkdf').value = getKkdfOrani(localDateStr(new Date()));
    document.getElementById('kredi-bsmv').value = getBsmvOrani(localDateStr(new Date()));
    setDateInputValue('kredi-ilk-taksit', '');
    document.getElementById('kredi-odeme-gun-tip').value = '';
    document.getElementById('kredi-taksit-plani').style.display = 'none';
    document.getElementById('kredi-preview').textContent = 'Değerleri girin, taksit otomatik hesaplanacak.';
  }
  openModal('modal-kredi');
}

export function krediStepGoto(step) {
  step = Math.max(1, Math.min(KREDI_STEP_COUNT, step));
  set_krediCurrentStep(step);
  const modal = document.getElementById('modal-kredi');
  if (!modal) return;
  // ---- Saf DOM güncelleme: js/ui/components/step-wizard.js:swizUpdateStepIndicator ----
  swizUpdateStepIndicator(modal, step);
  const backBtn = document.getElementById('kredi-step-back-btn');
  const nextBtn = document.getElementById('kredi-step-next-btn');
  const saveBtn = document.getElementById('kredi-step-save-btn');
  if (backBtn) backBtn.style.display = step > 1 ? '' : 'none';
  if (nextBtn) nextBtn.style.display = step < KREDI_STEP_COUNT ? '' : 'none';
  if (saveBtn) saveBtn.style.display = step === KREDI_STEP_COUNT ? '' : 'none';
  const body = modal.querySelector('.modal-body');
  if (body) body.scrollTop = 0;
  if (step === KREDI_STEP_COUNT) calcKredi(true);
}

export function _krediValidateStep(step) {
  if (step === 1) {
    if (!validateRequiredFields([
      {id:'kredi-banka', msg:'Banka seçimi zorunlu'},
      {id:'kredi-tur',   msg:'Kredi türü zorunlu'}
    ])) return false;
    return true;
  }
  if (step === 2) {
    if (!validateRequiredFields([
      {id:'kredi-anapara',    msg:'Ana para zorunlu'},
      {id:'kredi-faiz',       msg:'Faiz oranı zorunlu'},
      {id:'kredi-vade',       msg:'Vade zorunlu'},
      {id:'kredi-ilk-taksit', msg:'İlk taksit tarihi zorunlu'}
    ])) return false;
    return true;
  }
  return true;
}

export function krediStepNext() {
  if (!_krediValidateStep(_krediCurrentStep)) return;
  krediStepGoto(_krediCurrentStep + 1);
}

export function krediStepBack() {
  krediStepGoto(_krediCurrentStep - 1);
}

export function saveKredi() {
  const banka = document.getElementById('kredi-banka').value;
  const tur = document.getElementById('kredi-tur').value;
  const aciklama = document.getElementById('kredi-aciklama').value.trim();
  const anaPara = getMoneyInput('kredi-anapara')||0;
  const faizOran = parseFloat(document.getElementById('kredi-faiz').value)||0;
  const vade = parseInt(document.getElementById('kredi-vade').value)||0;
  const kkdf = parseFloat(document.getElementById('kredi-kkdf').value)||0;
  const bsmv = parseFloat(document.getElementById('kredi-bsmv').value)||0;
  const ilkTaksit = document.getElementById('kredi-ilk-taksit').value;
  const odemeGunTipKr = document.getElementById('kredi-odeme-gun-tip').value;


  if(!validateRequiredFields([{id:'kredi-anapara',msg:'Ana para zorunlu'},{id:'kredi-faiz',msg:'Faiz oranı zorunlu'},{id:'kredi-vade',msg:'Vade zorunlu'},{id:'kredi-ilk-taksit',msg:'İlk taksit tarihi zorunlu'}])) return;

  // ---- Saf hesaplama: js/domain/hesaplamalar.js:hesaplaKrediOnizleme
  //      (calcKredi'deki ÖNİZLEME ile AYNI kaynak) ----
  const _onizleme = hesaplaKrediOnizleme(anaPara, faizOran, vade, kkdf, bsmv, ilkTaksit || null);
  const { aylikTaksit, toplamBorc } = _onizleme;
  const manuelTaksitler = readManuelTaksitler('kredi', vade);

  const kredi = {
    id: editKrediId || uid(),
    banka, tur, aciklama, anaPara, faizOran, kkdf, bsmv, vade, ilkTaksit,
    odemeGunTip: odemeGunTipKr || '',
    aylikTaksit: parseFloat(aylikTaksit.toFixed(2)),
    toplamBorc: parseFloat(toplamBorc.toFixed(2)),
    manuelTaksitler: manuelTaksitler
  };

  if(!DB.bireyselKrediler) DB.bireyselKrediler = [];
  if(editKrediId) {
    const idx = DB.bireyselKrediler.findIndex(x=>x.id===editKrediId);
    if(idx>=0) DB.bireyselKrediler[idx]=kredi;
  } else {
    DB.bireyselKrediler.push(kredi);
  }
  setEditKrediId(null);
  saveData();
  closeModal('modal-kredi');
  renderKredi();
}

export function deleteKredi(id) {
  showConfirm('Bu krediyi silmek istiyor musunuz?', () => {
    DB.bireyselKrediler = (DB.bireyselKrediler||[]).filter(x=>x.id!==id);
    saveData();
    renderKredi();
  });
}

export function renderKredi() {
  if(!DB.bireyselKrediler) DB.bireyselKrediler = [];
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = localDateStr(today);

  let toplamAna=0, toplamBorc=0, toplamKalan=0, aktifSayisi=0;
  DB.bireyselKrediler.forEach(kr=>{
    toplamAna += kr.anaPara;
    toplamBorc += kr.toplamBorc;
    const kalan = getBireyselKrediKalan(kr);
    toplamKalan += kalan;
    if(kalan > 0) aktifSayisi++;
  });

  document.getElementById('kredi-stats').innerHTML = `
    <div class="stat s-blue"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg></div><div class="stat-label">Toplam Ana Para</div><div class="stat-val blue">${fmt(toplamAna)}</div></div>
    <div class="stat s-warn"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div><div class="stat-label">Toplam Borç</div><div class="stat-val warn">${fmt(toplamBorc)}</div></div>
    <div class="stat s-red"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><div class="stat-label">Kalan Borç</div><div class="stat-val red">${fmt(toplamKalan)}</div></div>
    <div class="stat s-blue"><div class="stat-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div><div class="stat-label">Aktif Kredi</div><div class="stat-val blue">${aktifSayisi}</div></div>`;

  const wrap = document.getElementById('kredi-karti-wrap');
  if(!DB.bireyselKrediler.length) {
    wrap.innerHTML = '<div class="card" style="padding:32px;text-align:center;color:var(--text3)">Kredi kaydı yok</div>';
    document.getElementById('kredi-plan').innerHTML = '';
    const _krTurElBos = document.getElementById('kredi-tur-filtre');
    if(_krTurElBos) _krTurElBos.innerHTML = '';
    const _krDurumElBos = document.getElementById('kredi-durum-filtre');
    if(_krDurumElBos) _krDurumElBos.innerHTML = '';
    const _krSiraElBos = document.getElementById('kredi-siralama-bar');
    if(_krSiraElBos) _krSiraElBos.innerHTML = '';
    return;
  }

  // ── Tür filtresi (İhtiyaç/Konut/Taşıt/Diğer/özel tipler — sadece Bireysel Krediler'e özgü) ──
  const _krTurFiltre = tblFiltreOku('kredi', 'tur');
  const krTurEl = document.getElementById('kredi-tur-filtre');
  if(krTurEl) {
    const turSet = [...new Set(DB.bireyselKrediler.map(k=>k.tur).filter(Boolean))];
    const turOpts = [{value:'', label:'◆ Tümü'}, ...turSet.map(t=>({value:t, label:_krediTurEtiket(t)}))];
    krTurEl.innerHTML = turOpts.length > 1
      ? tblFiltreChipsHtml('TÜR', turOpts, _krTurFiltre, 'setKrediTurFiltre') + tblFiltreClearHtml(_krTurFiltre, 'setKrediTurFiltre')
      : '';
    // [ES module] onclick="setKrediTurFiltre(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
    bindTblFiltreChips(krTurEl, { setKrediTurFiltre });
  }

  // ── Durum filtresi (Tümü / Aktif / Tamamlanmış) — DB.uiFiltreler.kredi.durum içinde kalıcı ──
  const _krDurumFiltre = tblFiltreOkuMulti('kredi', 'durum');
  const krDurumEl = document.getElementById('kredi-durum-filtre');
  if(krDurumEl) {
    krDurumEl.innerHTML = tblFiltreChipsMultiHtml('', KREDI_DURUM_FILTRE_OPTS, _krDurumFiltre, 'setKrediDurumFiltre')
      + tblFiltreClearMultiHtml(_krDurumFiltre, 'setKrediDurumFiltre');
    // [ES module] onclick="setKrediDurumFiltre(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
    bindTblFiltreChips(krDurumEl, { setKrediDurumFiltre });
  }
  _krediFiltreBaslikGuncelle('kredi-filtre-title-suffix', _krDurumFiltre);

  // ── Sıralama (DB.uiSiralama.kredi içinde kalıcı) ──
  const _krAktifSirala = tblSiralamaOku('kredi', 'eklenme', 'asc');
  const krSiralamaBarEl = document.getElementById('kredi-siralama-bar');
  if(krSiralamaBarEl) {
    krSiralamaBarEl.innerHTML = tblSiralamaBarHtml([
      {key:'eklenme', label:'Eklenme Sırası', ikon:'takvim', yon:'asc'},
      {key:'kalan', label:'Kalan Borç', ikon:'tutar', yon:'desc'},
      {key:'anapara', label:'Ana Para', ikon:'tutar', yon:'desc'},
      {key:'aylik', label:'Aylık Taksit', ikon:'tutar', yon:'desc'},
      {key:'faiz', label:'Faiz Oranı', ikon:'yuzde', yon:'desc'},
      {key:'vade', label:'Vade', ikon:'gun', yon:'desc'},
      {key:'ilerleme', label:'İlerleme %', ikon:'yuzde', yon:'desc'},
      {key:'bitis', label:'Bitiş Tarihi', ikon:'takvim', yon:'asc'},
      {key:'siradaki', label:'Sıradaki Ödeme', ikon:'takvim', yon:'asc'},
      {key:'banka', label:'Banka', ikon:'banka', yon:'asc'}
    ], _krAktifSirala, 'krediSirala');
    // [ES module] onclick="krediSirala(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
    bindTblFiltreChips(krSiralamaBarEl, { krediSirala });
  }

  const _krListe = DB.bireyselKrediler.map(kr => ({ kr, m: _krediMetrik(kr, 'kredi', todayStr) }));
  const krSirali = tblSiralamaUygula(_krListe, _krAktifSirala, {
    eklenme: (a,b)=>0,
    kalan: (a,b)=>a.m.kalan-b.m.kalan,
    anapara: (a,b)=>(a.kr.anaPara||0)-(b.kr.anaPara||0),
    aylik: (a,b)=>(a.kr.aylikTaksit||0)-(b.kr.aylikTaksit||0),
    faiz: (a,b)=>(parseFloat(a.kr.faizOran)||0)-(parseFloat(b.kr.faizOran)||0),
    vade: (a,b)=>(a.kr.vade||0)-(b.kr.vade||0),
    ilerleme: (a,b)=>a.m.ilerleme-b.m.ilerleme,
    bitis: (a,b)=>String(a.m.sonTarih||'').localeCompare(String(b.m.sonTarih||'')),
    siradaki: (a,b)=>String(a.m.siradakiOdemeTarihi||'9999-99-99').localeCompare(String(b.m.siradakiOdemeTarihi||'9999-99-99')),
    banka: (a,b)=>String(getBanka(a.kr.banka)||'').localeCompare(String(getBanka(b.kr.banka)||''),'tr')
  });
  const krFiltreli = krSirali
    .filter(x => !_krTurFiltre || x.kr.tur === _krTurFiltre)
    .filter(x => !_krDurumFiltre.length || _krDurumFiltre.includes(x.m.bitti ? 'tamamlandi' : 'aktif'));

  wrap.innerHTML = krFiltreli.length
    ? krFiltreli.map(x => _renderKrediKart(x.kr, 'kredi', todayStr)).join('')
    : '<div class="card" style="padding:32px;text-align:center;color:var(--text3)">Filtreye uyan kredi yok</div>';

  document.getElementById('kredi-plan').innerHTML = '';
  // [ES module] _renderKrediKart paylaşılan bir render yardımcısıdır - onun
  // ürettiği .kredi-kart-edit-btn / .kredi-kart-delete-btn / .kredi-accordion-toggle
  // class'larına burada gerçek addEventListener bağlanıyor.
  wrap.querySelectorAll('.kredi-kart-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openKrediModal(btn.getAttribute('data-id')));
  });
  wrap.querySelectorAll('.kredi-kart-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteKredi(btn.getAttribute('data-id')));
  });
  wrap.querySelectorAll('.kredi-accordion-toggle').forEach(header => {
    header.addEventListener('click', () => _toggleKrediAccordion(header));
  });
}

export function krediSirala(key, varsayilanYon) {
  tblSiralamaAyarla('kredi', key, varsayilanYon);
  renderKredi();
}

export function setKrediTurFiltre(tur) {
  tblFiltreKaydet('kredi', 'tur', tur);
  renderKredi();
}

export function setKrediDurumFiltre(durum) {
  tblFiltreMultiToggle('kredi', 'durum', durum);
  renderKredi();
}

// ═══════════════════════════════════════════════════════════
// NAKİT AVANS TANIMLAMA FONKSİYONLARI
// ═══════════════════════════════════════════════════════════

// [ES module] taban render fonksiyonu(ları) odeme/patches zincirinin
// hook() ile sarmalayabilmesi için wrap-registry'ye kaydediliyor.
register('renderKredi', renderKredi);
