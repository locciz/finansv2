import { saveData } from '../../../core/app-core-base.js';
import { fmtCur, fmtDate, localDateStr, uid } from '../../../core/format.js';
import { DB, defaultCurrency } from '../../../core/state.js';
import { _bakiyeDelta } from '../../../domain/hesap-entegrasyon-motoru.js';
import { calcExtreTarihiOdemeModuyla, calcOdemeTarihi } from '../../../domain/hesaplamalar.js';
import { _markFieldError, phSet, showToast } from '../../components/modal-genel.js';
import { getMoneyInput, setDateInputValue, setMoneyInput } from '../../components/money-input.js';
import { swizBakiyeHintGuncelle, swizOzetSatirHtml, swizUpdateStepIndicator } from '../../components/step-wizard.js';
import { _populateTransferHesaplar, onTransferHedefChange, onTransferKaynakChange, openTransferModal, transferStepGoto } from '../../components/transfer-modal.js';
import { renderExtreler } from '../ekstreler/02-ekstre-render.js';
import { _hesapOptgroupHtml } from '../hesaplar/01-genel-yardimcilar.js';
import { renderIslemler } from '../islemler/03-islem-liste-render.js';
import { KART_ODEME_STEP_COUNT, _kartOdemeCurrentStep, _kartOdemeKalanBorc, set_kartOdemeCurrentStep, set_kartOdemeKalanBorc } from './00-state.js';
import { kd2RenderOzetBanner } from './05-kart-detay-v2.js';
import { _kd2KartId } from './09-kart-altyapi.js';
import { call, register } from '../../../core/wrap-registry.js';
import { _odHesapSecimListesiHazirla } from '../odeme/01-genel-yardimcilar.js';
import { _odModalSuspendForTransfer } from '../odeme/04-modal-yasam-dongusu.js';
import { _odPopSeciliHesapId } from '../odeme/05-hesap-secim-popup.js';
import { _odHesapVeYon } from '../odeme/06-genel-odeme-modali.js';
import { _odModal } from '../odeme/08-popup-giris-noktalari.js';
import { getTatilSet } from '../tanimlamalar/01-genel-yardimcilar.js';
import { renderOzet } from '../ozet.js';
import { closeModal, openModal } from '../../components/modal-genel.js';
// ============================================================
// js/ui/pages/kartlar/08-kart-odeme.js
// Kart ödeme akışı (step wizard + hızlı transfer)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/kartlar.js (145
// export, 3600+ satır) dosyasının, fonksiyon isim/işlev
// kümelerine göre bölünmüş bir parçasıdır. Kod SATIR SATIR
// AYNI kaldı — sadece dosya sınırı ve gruplama değişti.
// ============================================================
export function kartOdemeHizliTransferAc(kind) {
  const ctx = _kartOdemeQuickTransferContext(kind);
  if(!ctx || !ctx.kaynak) { showToast('Transfer için uygun kaynak hesap bulunamadı', 'error'); return; }
  if(kind === 'od-modal' && typeof _odModalSuspendForTransfer === 'function') _odModalSuspendForTransfer();
  openTransferModal(ctx.kaynak.id);
  setTimeout(() => {
    const kSel = document.getElementById('transfer-kaynak');
    const hSel = document.getElementById('transfer-hedef');
    if(kSel) {
      kSel.value = ctx.kaynak.id;
      if(typeof onTransferKaynakChange === 'function') onTransferKaynakChange();
    }
    setTimeout(() => {
      if(hSel) {
        hSel.value = ctx.targetId;
        if(hSel.value !== ctx.targetId && typeof _populateTransferHesaplar === 'function') {
          _populateTransferHesaplar();
          hSel.value = ctx.targetId;
        }
        if(typeof onTransferHedefChange === 'function') onTransferHedefChange();
      }
      setMoneyInput('transfer-tutar', ctx.tutar);
      document.getElementById('transfer-tutar')?.dispatchEvent(new Event('input', { bubbles:true }));
      if(typeof transferStepGoto === 'function') transferStepGoto(3);
    }, 80);
  }, 160);
}

export function kartOdemeKalanTamaminiDoldur() {
  if (!(_kartOdemeKalanBorc > 0.01)) { showToast('Kalan borç bulunamadı', 'error'); return; }
  const pb = document.getElementById('kart-odeme-pb')?.value || 'TRY';
  setMoneyInput('kart-odeme-tutar', _kartOdemeKalanBorc);
  _updateKartOdemeTutarHint();
}

export function kartOdemeTutarTumunuKullan() {
  const kb = _kartOdemeHesapKullanilabilirBakiye();
  if (!kb) { showToast('Önce ödeme hesabı seçin', 'error'); return; }
  if (!(kb.tutar > 0)) { showToast('Kullanılabilir bakiye 0 veya negatif', 'error'); return; }
  setMoneyInput('kart-odeme-tutar', kb.tutar);
  _updateKartOdemeTutarHint();
}

export function kartOdemeStepGoto(step) {
  step = Math.max(1, Math.min(KART_ODEME_STEP_COUNT, step));
  set_kartOdemeCurrentStep(step);
  const modal = document.getElementById('modal-kart-odeme');
  if (!modal) return;
  // ---- Saf DOM güncelleme: js/ui/components/step-wizard.js:swizUpdateStepIndicator ----
  swizUpdateStepIndicator(modal, step);
  const backBtn = document.getElementById('kart-odeme-step-back-btn');
  const nextBtn = document.getElementById('kart-odeme-step-next-btn');
  const saveBtn = document.getElementById('kart-odeme-step-save-btn');
  if (backBtn) backBtn.style.display = step > 1 ? '' : 'none';
  if (nextBtn) nextBtn.style.display = step < KART_ODEME_STEP_COUNT ? '' : 'none';
  if (saveBtn) saveBtn.style.display = step === KART_ODEME_STEP_COUNT ? '' : 'none';
  const body = modal.querySelector('.modal-body');
  if (body) body.scrollTop = 0;
  if (step === 1) _updateKartOdemeTutarTumBtn();
  if (step === KART_ODEME_STEP_COUNT) _kartOdemeOzetDoldur();
}
register('wizardStepGoto:modal-kart-odeme', kartOdemeStepGoto);
register('wizardCurrentStep:modal-kart-odeme', () => _kartOdemeCurrentStep);

export function kartOdemeStepNext() {
  if (!_kartOdemeValidateStep(_kartOdemeCurrentStep)) return;
  kartOdemeStepGoto(_kartOdemeCurrentStep + 1);
}

register('wizardStepNext:modal-kart-odeme', kartOdemeStepNext);


export function kartOdemeStepBack() {
  kartOdemeStepGoto(_kartOdemeCurrentStep - 1);
}

export function deleteKartOdeme(odemeId, opts) {
  const sessiz = !!(opts && opts.sessiz);
  if(!DB.kartOdemeleri) return;
  const odeme = DB.kartOdemeleri.find(o=>o.id===odemeId);
  if(!odeme) return;

  // Bakiye geri al
  if(odeme.hesapId) {
    const lk = call('_lKey', 'kartodeme', odemeId, null);
    const eski = call('_lGet', lk) || 0;
    if(eski > 0) { _bakiyeDelta(odeme.hesapId, eski); call('_lDel', lk); }
  }

  // İşlem listesinden de kaldır (_odemeRef ile eşleşeni sil)
  if(DB.islemler) {
    DB.islemler = DB.islemler.filter(i => i._odemeRef !== odemeId);
  }

  DB.kartOdemeleri = DB.kartOdemeleri.filter(o=>o.id!==odemeId);
  if(sessiz) return;
  saveData();
  renderExtreler();
  renderIslemler();
  renderOzet();
  showToast('Ödeme silindi', 'info');
}

// [KALDIRILDI] openKartOdemeModal(kartId, pb, donemKey, toplamBorc, borcSifirIzin)
// — kart ödeme modalını doğrudan parametrelerle açan eski giriş noktası,
// hiçbir yerden çağrılmıyordu. Yerini register('kartOdemeHizliTransferAc', ...)
// ile kaydedilen kartOdemeHizliTransferAc akışı almış (ölü kod taraması, 2026-07).

export function _kartOdemeQuickTransferContext(kind) {
  const isOd = kind === 'od-modal';

  // Hızlı transfer artık sadece ödeme durumu popup'ında gösterilir.
  // Eski kart ödeme sihirbazında görünmez; kullanıcı istediği gibi buton tutar alanının içine taşındı.
  if(!isOd) return null;

  const tip = _odModal?.tip || null;
  const item = tip ? call('odGetItem', tip, _odModal.id) : null;
  const seciliDurum = _odModal?.seciliDurum || 'bekliyor';
  if(!['odendi','kismi','bekliyor'].includes(seciliDurum)) return null;

  const targetId = (typeof _odPopSeciliHesapId === 'function' ? _odPopSeciliHesapId() : '') || '';
  const tutar = getMoneyInput('od-pop-tutar') || 0;
  const pb = _odModal?._kartPb || (item && (item.paraBirimi || item.paraBirimleri?.[0])) || defaultCurrency || 'TRY';
  if(!targetId || !(tutar > 0)) return null;

  // Kart, kredi, KMH ve diğer gider yönlü ödeme durumlarında çalışır.
  // Gelir yönlü kira/maaş/mevduat gibi kayıtlarda buton çıkmaz.
  if(tip !== 'kart') {
    const yonInfo = item ? _odHesapVeYon(tip, item, _odModal.key) : { yon: 0 };
    if(!yonInfo || yonInfo.yon >= 0) return null;
  }

  const target = (DB.hesaplar||[]).find(h=>h.id===targetId);
  if(!target) return null;
  const targetPb = target.paraBirimi || 'TRY';
  const kullanilabilir = (target.bakiye||0);
  if(targetPb !== pb || kullanilabilir >= tutar - 0.005) return null;

  const kaynaklar = (DB.hesaplar||[])
    .filter(h => h.id !== target.id && h.durum === 'aktif' && h.tur !== 'vadeli')
    .filter(h => (h.paraBirimi || 'TRY') === pb)
    .filter(h => (h.bakiye||0) > 0)
    .sort((a,b) => (b.bakiye||0) - (a.bakiye||0));
  const kaynak = kaynaklar[0] || null;
  return { kind, tip, target, targetId:target.id, tutar, pb, kullanilabilir, kaynak };
}

export function _kartOdemeQuickTransferBox(kind) {
  if(kind !== 'od-modal') return null;
  let btn = document.getElementById('od-hizli-transfer-btn');
  if(btn) return btn;
  const wrap = document.getElementById('od-pop-tutar-wrap');
  if(!wrap) return null;
  btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'od-hizli-transfer-btn';
  btn.className = 'money-hero-tum-btn od-fast-transfer-btn';
  btn.style.display = 'none';
  btn.title = 'Hızlı Transfer';
  // [ES module] eskiden setAttribute('onclick', "kartOdemeHizliTransferAc('od-modal')")
  // ile tanımlıydı - modülde global fonksiyon olmadığından çalışmazdı;
  // gerçek addEventListener'a taşındı.
  btn.addEventListener('click', () => kartOdemeHizliTransferAc('od-modal'));
  wrap.insertBefore(btn, wrap.firstElementChild ? wrap.firstElementChild.nextSibling : null);
  return btn;
}

export function _kartOdemeHizliTransferGuncelle(kind) {
  const btn = _kartOdemeQuickTransferBox(kind);
  if(!btn) return;
  const ctx = _kartOdemeQuickTransferContext(kind);
  const html = `<span class="mhtb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10"/><path d="M11 4l3 3-3 3"/><path d="M20 17H10"/><path d="M13 14l-3 3 3 3"/></svg></span><span class="mhtb-label">Hızlı Transfer</span>`;
  btn.innerHTML = html;
  btn.classList.remove('is-disabled-visible');

  // Hedef hesap bakiyesi yeterliyse veya ödeme tutarı/seçili hesap yoksa buton tamamen gizli kalır.
  if(!ctx) {
    btn.style.display = 'none';
    btn.disabled = true;
    btn.title = 'Hızlı Transfer';
    return;
  }

  const eksik = Math.max(0, ctx.tutar - ctx.kullanilabilir);
  btn.style.display = 'flex';

  // Yetersiz bakiye var ama aktarılabilecek başka uygun hesap yoksa buton artık
  // kaybolmaz; pasif görünür ve sebebi tooltipte yazar. Böylece kullanıcı
  // “neden çıkmadı?” diye kalmaz.
  if(!ctx.kaynak) {
    btn.disabled = true;
    btn.classList.add('is-disabled-visible');
    btn.title = `${ctx.target.ad} hesabında ${fmtCur(eksik, ctx.pb)} eksik; aynı para biriminde aktif bakiyesi olan başka kaynak hesap bulunamadı.`;
    return;
  }

  const kaynakBakiye = (ctx.kaynak.bakiye||0);
  btn.disabled = false;
  btn.title = `${ctx.target.ad} hesabında ${fmtCur(eksik, ctx.pb)} eksik. ${ctx.kaynak.ad} hesabından ${fmtCur(ctx.tutar, ctx.pb)} transfer hazırla.`
    + (kaynakBakiye < ctx.tutar - 0.005 ? ` Kaynak bakiye: ${fmtCur(kaynakBakiye, ctx.pb)}.` : '');
}

// Seçili hesabın bakiyesini göster

export function onKartOdemeHesapChange() {
  const sel = document.getElementById('kart-odeme-hesap');
  const out = document.getElementById('kart-odeme-hesap-bakiye');
  const opt = sel.selectedOptions[0];
  if(!opt || !opt.value) { out.textContent=''; _kartOdemeHizliTransferGuncelle('kart-step'); return; }
  const bakiye = parseFloat(opt.dataset.bakiye||'0');
  const pb     = opt.dataset.pb||'TRY';
  const kmh    = parseFloat(opt.dataset.kmh||'0');
  let txt = `Bakiye: ${fmtCur(bakiye, pb)}`;
  if(kmh>0) txt += ` · Kullanılabilir: ${fmtCur(bakiye + kmh, pb)} (KMH dahil)`;
  out.textContent = txt;
  out.style.color = bakiye<0 ? 'var(--danger)' : 'var(--text3)';
  _updateKartOdemeTutarTumBtn();
  _kartOdemeHizliTransferGuncelle('kart-step');
}

// Seçili ödeme hesabının kullanılabilir bakiyesini döndürür (bakiye + KMH)

export function _kartOdemeHesapKullanilabilirBakiye() {
  const sel = document.getElementById('kart-odeme-hesap');
  const opt = sel ? sel.selectedOptions[0] : null;
  if(!opt || !opt.value) return null;
  const bakiye = parseFloat(opt.dataset.bakiye||'0');
  const kmh    = parseFloat(opt.dataset.kmh||'0');
  const pb     = opt.dataset.pb||'TRY';
  return { tutar: bakiye + kmh, pb };
}

// Buton görünürlüğünü hesap seçimine göre günceller

export function _updateKartOdemeTutarTumBtn() {
  const btn = document.getElementById('kart-odeme-tutar-tum-btn');
  if (!btn) return;
  const kb = _kartOdemeHesapKullanilabilirBakiye();
  btn.style.display = kb ? 'flex' : 'none';
  _updateKartOdemeTutarHint();
}

// Girilen tutarı, hesabın kullanılabilir bakiyesiyle karşılaştıran ipucu

export function _updateKartOdemeTutarHint() {
  const hint = document.getElementById('kart-odeme-tutar-bakiye-hint');
  if (!hint) return;
  const kb = _kartOdemeHesapKullanilabilirBakiye();
  if (!kb) { hint.style.display = 'none'; _kartOdemeHizliTransferGuncelle('kart-step'); return; }
  hint.style.display = 'block';
  const tutar = getMoneyInput('kart-odeme-tutar') || 0;
  // ---- Saf DOM güncelleme: js/ui/components/step-wizard.js:swizBakiyeHintGuncelle ----
  swizBakiyeHintGuncelle(hint, tutar, kb);
  _kartOdemeHizliTransferGuncelle('kart-step');
}

export function _kartOdemeValidateStep(step) {
  if (step === 1) {
    const tutar = getMoneyInput('kart-odeme-tutar') || 0;
    if (!tutar || tutar <= 0) { showToast('Geçerli bir tutar giriniz', 'error'); _markFieldError('kart-odeme-tutar'); return false; }
    const tarih = document.getElementById('kart-odeme-tarih').value;
    if (!tarih) { showToast('Tarih giriniz', 'error'); _markFieldError('kart-odeme-tarih'); return false; }
    return true;
  }
  if (step === 2) {
    const hesapId = (document.getElementById('kart-odeme-hesap')||{}).value || '';
    if (!hesapId) {
      showToast('Ödeme yapılacak hesabı seçiniz', 'error');
      _markFieldError('kart-odeme-hesap');
      return false;
    }
    const tutar = getMoneyInput('kart-odeme-tutar') || 0;
    const pb = (document.getElementById('kart-odeme-pb')||{}).value || 'TRY';
    const hesap = (DB.hesaplar||[]).find(h=>h.id===hesapId);
    if (hesap) {
      const bakiye = hesap.bakiye || 0;
      const kmhLimit = hesap.kmhLimit || 0;
      const kullanilab = bakiye + kmhLimit;
      if (kullanilab < tutar) {
        const bakiyeStr = fmtCur(bakiye, hesap.paraBirimi||'TRY');
        const kmhStr = kmhLimit > 0 ? ` + KMH ${fmtCur(kmhLimit, hesap.paraBirimi||'TRY')}` : '';
        showToast(`Yetersiz bakiye! ${hesap.ad}: ${bakiyeStr}${kmhStr} mevcut, ${fmtCur(tutar, pb)} gerekiyor. Ödeme durumu popupındaki Hızlı Transfer butonunu kullanabilirsin.`, 'error');
        _kartOdemeHizliTransferGuncelle('kart-step');
        return false;
      }
    }
    return true;
  }
  return true;
}

export function _kartOdemeOzetDoldur() {
  const kartId = (document.getElementById('kart-odeme-kart-id')||{}).value || '';
  const kart = (DB.kartlar||[]).find(k=>k.id===kartId);
  const pb = (document.getElementById('kart-odeme-pb')||{}).value || 'TRY';
  const tutar = getMoneyInput('kart-odeme-tutar') || 0;
  const tarih = (document.getElementById('kart-odeme-tarih')||{}).value || '—';
  const hesapId = (document.getElementById('kart-odeme-hesap')||{}).value || '';
  const hesap = (DB.hesaplar||[]).find(h=>h.id===hesapId);

  const satir = swizOzetSatirHtml;

  const ozetEl = document.getElementById('kart-odeme-ozet-icerik');
  if (!ozetEl) return;
  ozetEl.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px 16px">
      ${satir('Kart', `<span style="font-family:inherit">${kart ? kart.ad : '—'}</span>`)}
      ${satir('Ödeme Tutarı', fmtCur(tutar, pb), 'color:var(--gold);font-weight:700')}
      ${satir('Ödeme Tarihi', fmtDate ? fmtDate(tarih) : tarih)}
      ${satir('Ödeme Yapılan Hesap', `<span style="font-family:inherit">${hesap ? hesap.ad : '—'}</span>`)}
    </div>`;
}

// Kart ödeme kaydını fiilen uygulayan paylaşılan çekirdek fonksiyon.
// Hem eski adım-sihirbazı modalı (modal-kart-odeme) hem de yeni ödeme durumu
// popup'ı (od-modal, tip='kart') bu fonksiyonu çağırır — tekrarı önler ve
// bakiye/işlem/kategori mantığının HER İKİ akışta da birebir aynı kalmasını sağlar.

export function _kartOdemeUygula({kartId, pb, donemKey, tutar, tarih, hesapId}) {
  if(!DB.kartOdemeleri) DB.kartOdemeleri = [];

  const odemeId = uid();
  const odeme = { id: odemeId, kartId, paraBirimi: pb, donemKey, tutar, tarih, hesapId: hesapId||null };
  DB.kartOdemeleri.push(odeme);

  // Seçilen ödeme hesabını karta kalıcı olarak kaydet — bir sonraki ödemede
  // bu hesap otomatik seçili gelsin diye.
  const kartForHesap = DB.kartlar.find(k=>k.id===kartId);
  if(kartForHesap && hesapId && kartForHesap.hesapId !== hesapId) kartForHesap.hesapId = hesapId;

  // Hesap bakiyesi düşür
  const hesap = hesapId ? (DB.hesaplar||[]).find(h=>h.id===hesapId) : null;
  if(hesapId && hesap) {
    if(!DB.entLog) DB.entLog = {};
    _bakiyeDelta(hesapId, -tutar);
    DB.entLog[call('_lKey', 'kartodeme', odeme.id, null)] = tutar;
  }

  // ── İşlem listesine yansıt ──────────────────────────────────
  // Kart ödemesi gelir olarak kaydedilir (karttaki borcu azaltır).
  // Tutar pozitif: ekstreye "ödeme alacağı" olarak yansır,
  // böylece borç yokken yapılan peşin ödeme gelecek dönem mahsup edilir.
  if(!DB.islemler) DB.islemler = [];
  const kart = DB.kartlar.find(k=>k.id===kartId);
  // "Kart Ödemesi" kategorisini bul ya da ilk kullanımda oluştur
  let odemeKatId = (DB.kategoriler||[]).find(k=>k.ad==='Kart Ödemesi')?.id;
  if(!odemeKatId) {
    if(!DB.kategoriler) DB.kategoriler = [];
    odemeKatId = uid();
    DB.kategoriler.push({ id: odemeKatId, ad: 'Kart Ödemesi', ikon: '💳', tur: 'gelir', sistem: true });
  }
  const odemeIslem = {
    id: uid(),
    kart: kartId,
    aciklama: `Kart Ödemesi — ${donemKey}`,
    tutar: tutar,           // pozitif = gelir (borç azaltır)
    paraBirimi: pb,
    tarih: tarih,
    provizyonTarihi: tarih, // kart ödemesi anında hesaba yansır — provizyon her zaman ödeme tarihiyle aynı gün
    kategori: odemeKatId,
    taksit: 1,
    aylik: tutar,
    _odemeRef: odemeId,     // kartOdemeleri kaydıyla bağlantı
    _mahsup: true           // işlem listesinde özel gösterim için
  };
  DB.islemler.push(odemeIslem);
  // entLog: silme sırasında geri alabilmek için
  if(!DB.entLog) DB.entLog = {};
  DB.entLog[call('_lKey', 'odemeislem', odemeIslem.id, null)] = odemeIslem.id;

  saveData();
  renderExtreler();
  renderIslemler();
  renderOzet();
  if(typeof kd2RenderOzetBanner === 'function' && _kd2KartId) {
    const _k = DB.kartlar.find(k=>k.id===_kd2KartId);
    if(_k) { const { getKartRenk: _gr } = window; kd2RenderOzetBanner(_k, typeof _gr==='function' ? _gr(_k) : '#fbbf24'); }
  }
  showToast(`✓ ${fmtCur(tutar, pb)} ödeme kaydedildi`, 'success');
  return odeme;
}

export function saveKartOdeme() {
  const kartId   = document.getElementById('kart-odeme-kart-id').value;
  const pb       = document.getElementById('kart-odeme-pb').value;
  const donemKey = document.getElementById('kart-odeme-donem-key').value;
  const tutar    = getMoneyInput('kart-odeme-tutar');
  const tarih    = document.getElementById('kart-odeme-tarih').value;
  const hesapId  = document.getElementById('kart-odeme-hesap').value;

  if(!tutar || tutar <= 0) { showToast('Geçerli bir tutar giriniz', 'error'); return; }
  if(!tarih) { showToast('Tarih giriniz', 'error'); return; }

  // Hesap seçimi zorunlu
  if(!hesapId) {
    const sel = document.getElementById('kart-odeme-hesap');
    sel.classList.add('shake');
    sel.style.borderColor = 'var(--danger)';
    sel.style.boxShadow = '0 0 0 3px rgba(251,113,133,.2)';
    setTimeout(() => { sel.classList.remove('shake'); sel.style.borderColor = ''; sel.style.boxShadow = ''; }, 800);
    showToast('Ödeme yapılacak hesabı seçiniz', 'error');
    return;
  }

  // Hesap bakiyesi / KMH limiti kontrolü
  const hesap = (DB.hesaplar||[]).find(h=>h.id===hesapId);
  if(hesap) {
    const bakiye = hesap.bakiye || 0;
    const kmhLimit = hesap.kmhLimit || 0;
    const kullanilab = bakiye + kmhLimit; // bakiye negatif olabilir, KMH bunu telafi eder
    if(kullanilab < tutar) {
      const bakiyeStr = typeof fmtCur === 'function' ? fmtCur(bakiye, hesap.paraBirimi||'TRY') : bakiye.toFixed(2);
      const kmhStr    = kmhLimit > 0 ? ` + KMH ${typeof fmtCur === 'function' ? fmtCur(kmhLimit, hesap.paraBirimi||'TRY') : kmhLimit.toFixed(2)}` : '';
      showToast(`Yetersiz bakiye! ${hesap.ad}: ${bakiyeStr}${kmhStr} mevcut, ${typeof fmtCur === 'function' ? fmtCur(tutar, pb) : tutar.toFixed(2)} gerekiyor. Ödeme durumu popupındaki Hızlı Transfer butonunu kullanabilirsin.`, 'error');
      _kartOdemeHizliTransferGuncelle('kart-step');
      return;
    }
  }

  _kartOdemeUygula({kartId, pb, donemKey, tutar, tarih, hesapId});
  closeModal('modal-kart-odeme');
}

// [ES module] eskiden window.kartOdemeHizliTransferAc = kartOdemeHizliTransferAc
// köprüsüydü; artık wrap-registry'ye register ediliyor - odeme/patches
// zincirindeki wrap'ler get('kartOdemeHizliTransferAc') ile mevcut
// referansı alıp register('kartOdemeHizliTransferAc', wrapped) ile
// sarmalayabilir; çağıranlar call(...) kullanır.
register('kartOdemeHizliTransferAc', kartOdemeHizliTransferAc);
register('_kartOdemeHizliTransferGuncelle', _kartOdemeHizliTransferGuncelle);

