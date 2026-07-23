import { fmt, fmtCur, fmtDate, localDateStr } from '../../../core/format.js';
import { CURRENCY_CONFIG, DB, defaultCurrency } from '../../../core/state.js';
import { setDateInputValue, setMoneyInput } from '../../components/money-input.js';
import { _hesapBankayaAitMi } from '../hesaplar/01-genel-yardimcilar.js';

import { _odHesapSecimListesiHazirla, odBadgeHtml, odEfektifDurum, odGetDurum, odKartDonemOverride } from './01-genel-yardimcilar.js';
import { _odLogRender } from './03-odeme-log.js';
import { _odModalLockBodyScroll } from './04-modal-yasam-dongusu.js';
import { _odHesapPopupBuild } from './05-hesap-secim-popup.js';
import { _odHesapSecilebilirMi, _odHesapVeYon } from './06-genel-odeme-modali.js';
import { _odModalSecDurumKart } from './07-kart-odeme-modali.js';
import { call, register } from '../../../core/wrap-registry.js';
// ============================================================
// js/ui/pages/odeme/08-popup-giris-noktalari.js
// Popup açma giriş noktaları (dışarıdan çağrılan iki fonksiyon)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/odeme.js
// (52 export, 2097 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function odAcPopupKart(kartId, pb, donemKey, toplamBorc, kalanBorc, odemeTarihi, borcSifirIzin) {
  const kart = (DB.kartlar||[]).find(k=>k.id===kartId);
  if(!kart) return;
  const kalan = Math.max(0, Number(kalanBorc)||0);
  const toplam = Number(toplamBorc)||0;

  _odModal = { tip:'kart', id:kartId, key:donemKey, tarih:odemeTarihi||'', tutar:toplam, seciliDurum:null,
    _kartPb: pb||'TRY', _kartKalan: kalan, _kartBorcSifirIzin: !!borcSifirIzin };

  const pbCfg = (typeof CURRENCY_CONFIG!=='undefined' && CURRENCY_CONFIG[pb]) || {};
  const pbSym = pbCfg.symbol || (pb==='TRY' ? '₺' : pb);
  const tutarWrapEl = document.getElementById('od-pop-tutar-wrap');
  if(tutarWrapEl) { tutarWrapEl.dataset.symbol = pbSym; tutarWrapEl.dataset.code = pb || 'TRY'; }

  document.getElementById('od-modal-icon').textContent = '💳';
  document.getElementById('od-modal-icon').style.background = 'rgba(79,142,247,.15)';
  const [dy, dm] = String(donemKey).split('-').map(Number);
  const donemLabel = (dy && dm) ? new Date(dy, dm-1, 1).toLocaleDateString('tr-TR',{year:'numeric',month:'long'}) : '';
  document.getElementById('od-modal-label').textContent = donemLabel ? `${kart.ad} · ${donemLabel}` : kart.ad;
  document.getElementById('od-modal-sub').textContent   = 'Kart Ödemesi';
  document.getElementById('od-mi-tarih').textContent    = odemeTarihi ? fmtDate(odemeTarihi) : '—';
  document.getElementById('od-mi-tutar').textContent    = toplam > 0 ? fmtCur(toplam, pb) : (kalan > 0 ? fmtCur(kalan, pb) : '—');

  const mevcutOv = odKartDonemOverride(kart, donemKey);
  const ertelendiMi = !!(mevcutOv && mevcutOv.durum === 'ertelendi');
  document.getElementById('od-mi-durum').innerHTML = ertelendiMi
    ? odBadgeHtml('ertelendi')
    : (kalan <= 0.01 ? odBadgeHtml('odendi') : (kalan < toplam - 0.01 ? odBadgeHtml('kismi') : odBadgeHtml('bekliyor')));

  document.getElementById('od-modal-sifirla-btn').style.display = ertelendiMi ? '' : 'none';

  const secenekler = [
    { durum:'odendi', icon:'✓', lbl: kalan>0.01?'Kalanın Tamamı':'Ödeme Yap', sub: kalan>0.01?fmtCur(kalan,pb)+' öde':'Peşin / erken ödeme' },
    { durum:'kismi',  icon:'⊟', lbl:'Kısmi Ödeme', sub:'Özel bir tutar gir' },
    { durum:'ertelendi', icon:'↷', lbl:'Ertelendi', sub:'Son ödeme tarihini ertele' },
    { durum:'bekliyor', icon:'◉', lbl:'Bekliyor', sub:'Ödeme/erteleme geri al' },
  ];
  document.getElementById('od-status-grid').innerHTML = secenekler.map(s=>`
    <div class="od-status-card" data-dur="${s.durum}">
      <div class="od-sc-icon">${s.icon}</div>
      <div class="od-sc-text">
        <div class="od-sc-lbl">${s.lbl}</div>
        <div class="od-sc-sub">${s.sub}</div>
      </div>
    </div>`).join('');
  // [ES module] onclick="_odModalSecDurumKart(...)" kaldırıldı.
  document.getElementById('od-status-grid').querySelectorAll('.od-status-card').forEach(card => {
    card.addEventListener('click', () => _odModalSecDurumKart(card.getAttribute('data-dur')));
  });

  document.getElementById('od-modal-vadesiz-info')?.classList.remove('show');
  const hintEl = document.getElementById('od-ertelendi-hint'); if(hintEl) hintEl.style.display = 'none';
  const cascadeWrap = document.getElementById('od-ertelendi-cascade-wrap'); if(cascadeWrap) cascadeWrap.style.display = 'none';
  const oranWrap = document.getElementById('od-gecikme-oran-wrap'); if(oranWrap) oranWrap.style.display = 'none';

  document.getElementById('od-tarih-lbl').textContent = 'Ödeme Tarihi';
  setDateInputValue('od-pop-tarih', localDateStr(new Date()));

  // Hesap alanı — kart ödemesinde her zaman zorunlu; kartın bankasına ait hesaplar en üstte gelir
  document.getElementById('od-hesap-field-wrap').style.display = '';
  document.getElementById('od-hesap-lbl').textContent = 'Ödeme Hesabı';
  const hamHesaplar = (DB.hesaplar || []).filter(h => h.tur !== 'vadeli' && h.durum !== 'kapali');
  const secim = _odHesapSecimListesiHazirla('kart', kart, hamHesaplar, kart.hesapId || '', pb);
  const hesaplar = secim.hesaplar.map(h => ({ ...h, _odIlgiliBanka: _hesapBankayaAitMi(h, secim.bankaId) }));
  _odHesapPopupBuild(hesaplar, true, secim.hesapId || '');
  const _odKartHesapHidden = document.getElementById('od-pop-hesap');
  if(_odKartHesapHidden) _odKartHesapHidden.onchange = () => call('_odHesapBilgiGuncelle');
  call('_odHesapBilgiGuncelle');

  document.getElementById('od-tutar-lbl').textContent = 'Ödenecek Tutar';
  const kalanBtn = document.getElementById('od-kalan-tamamini-btn');
  if(kalanBtn) { kalanBtn.style.display = kalan > 0.01 ? 'flex' : 'none'; kalanBtn.title = kalan > 0.01 ? `Kalan Borcun Tamamı: ${fmtCur(kalan, pb)}` : 'Kalan Borcun Tamamı'; }
  const kalanTxt = document.getElementById('od-kalan-tamamini-txt'); if(kalanTxt) kalanTxt.textContent = 'Kalanın Tamamı';

  document.getElementById('od-pop-not').value = '';
  _odLogRender('kart', kartId, donemKey);

  _odModalSecDurumKart(ertelendiMi ? 'ertelendi' : (kalan > 0.01 ? 'odendi' : 'kismi'));

  const bg = document.getElementById('od-modal-bg');
  bg.classList.add('open');
  _odModalLockBodyScroll();
  setTimeout(() => call('_kartOdemeHizliTransferGuncelle', 'od-modal'), 120);
}

export function odAcPopup(e, tip, id, key, tarih, tutar, extraLabel) {
  if(e) e.stopPropagation();
  const item = call('odGetItem', tip, id);
  if(!item) return;
  const ov = odGetDurum(item, key);
  const curDurum = odEfektifDurum(ov, tarih);

  _odModal = { tip, id, key, tarih: tarih||'', tutar: tutar||0, seciliDurum: curDurum };

  // Para birimi sembolünü item'dan çek
  const itemPb = item.paraBirimi || (tip==='kmh'||tip==='kredi' ? (item.paraBirimleri?.[0]||defaultCurrency) : defaultCurrency);
  const pbCfg = (typeof CURRENCY_CONFIG!=='undefined' && CURRENCY_CONFIG[itemPb]) || {};
  const pbSym = pbCfg.symbol || (itemPb==='TRY' ? '₺' : itemPb);
  const tutarWrapEl = document.getElementById('od-pop-tutar-wrap');
  if(tutarWrapEl) { tutarWrapEl.dataset.symbol = pbSym; tutarWrapEl.dataset.code = itemPb || 'TRY'; }

  // Tip ikonları
  const tipIcon = {mevduat:'🏦',kira:'🏠',maas:'💼',kredi:'💳',kmh:'💳',elden:'💵',islem:'🧾',depozito:'🔐',abonelik:'🔄'};
  const tipLbl  = {mevduat:'Mevduat',kira:'Kira',maas:'Maaş',kredi:'Kredi',kmh:'KMH Kredi',elden:'Elden Ödeme',islem:'İşlem',depozito:'Depozito',abonelik:'Abonelik'};

  document.getElementById('od-modal-icon').textContent = tipIcon[tip]||'📋';
  document.getElementById('od-modal-icon').style.background = tip==='mevduat'?'rgba(79,110,247,.15)':tip==='kira'?'rgba(16,185,129,.15)':tip==='depozito'?'rgba(167,139,250,.15)':tip==='abonelik'?'rgba(56,189,248,.15)':'rgba(251,146,60,.15)';
  document.getElementById('od-modal-label').textContent = extraLabel || (tarih ? fmtDate(tarih) : 'Ödeme Durumu');
  document.getElementById('od-modal-sub').textContent   = tipLbl[tip]||tip;
  document.getElementById('od-mi-tarih').textContent    = tarih ? fmtDate(tarih) : '—';
  document.getElementById('od-mi-tutar').textContent    = tutar ? fmt(tutar) : '—';
  document.getElementById('od-mi-durum').innerHTML      = odBadgeHtml(curDurum, tarih, tutar);

  // Tarihi bugüne default — her zaman bugün, override varsa override
  const todayStr = localDateStr(new Date());

  // Sıfırla butonu
  document.getElementById('od-modal-sifirla-btn').style.display = ov ? '' : 'none';

  // Durum kartları
  const seçenekler = [
    { durum:'odendi',    icon:'✓', lbl:'Ödendi',       sub:'Ödeme tamamlandı' },
    { durum:'kismi',     icon:'⊟', lbl:'Kısmi Ödeme',  sub:'Bir kısmı ödendi' },
    { durum:'ertelendi', icon:'↷', lbl:'Ertelendi',    sub:'Sonraya bırakıldı' },
    { durum:'bekliyor',  icon:'◉', lbl:'Bekliyor',     sub:'Henüz ödenmedi' },
    { durum:'gecikti',   icon:'⚠', lbl:'Gecikti',      sub:'Vade geçti' },
    { durum:'iptal',     icon:'⊘', lbl:(tip==='kira'||tip==='maas')?'İptal (0₺)':(tip==='depozito'?'Kesildi / İade Yok':'İptal / Atla'), sub:'Bu dönemi atla' },
  ];
  document.getElementById('od-status-grid').innerHTML = seçenekler.map(s=>`
    <div class="od-status-card ${curDurum===s.durum?'sel-'+s.durum+' selected':''}" data-dur="${s.durum}">
      <div class="od-sc-icon">${s.icon}</div>
      <div class="od-sc-text">
        <div class="od-sc-lbl">${s.lbl}</div>
        <div class="od-sc-sub">${s.sub}</div>
      </div>
    </div>`).join('');
  // [ES module] onclick="_odModalSecDurum(...)" kaldırıldı.
  document.getElementById('od-status-grid').querySelectorAll('.od-status-card').forEach(card => {
    card.addEventListener('click', () => call('_odModalSecDurum', card.getAttribute('data-dur')));
  });

  // Vadesiz bilgi (başlangıç)
  call('_odModalSecDurum', curDurum);

  // display:none CSS'ini inline style ile eziyoruz — ÖNCE display ver, SONRA value set et
  // Böylece type="date" inputu "görünür" durumdayken value alıyor (Chrome/Safari bug'ı önlemi)
  const _bg = document.getElementById('od-modal-bg');
  _bg.style.display = 'flex';
  _bg.classList.add('open');
  _odModalLockBodyScroll();

  const todayStr2 = localDateStr(new Date());
  const tarihEl = document.getElementById('od-pop-tarih');
  const tutarEl = document.getElementById('od-pop-tutar');
  const notEl   = document.getElementById('od-pop-not');
  const _tarihVal = ov?.tarih || todayStr2;
  if(tarihEl) {
    tarihEl.setAttribute('value', _tarihVal);
    tarihEl.defaultValue = _tarihVal;
    setDateInputValue(tarihEl, _tarihVal);
    tarihEl.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if(tutarEl) {
    // Kısmi ödemede alan her zaman "bu ödemede yatırılan" tutarı temsil eder,
    // önceki toplamın üzerine yazılmasın diye boş açılır (bkz. _odModalKrediAlanlariAyarla).
    const tv = curDurum === 'kismi' ? '' : (ov?.tutar !== undefined ? ov.tutar : (tutar||''));
    setMoneyInput('od-pop-tutar', tv);
  }
  if(notEl)   notEl.value = ov?.not || '';

  // Hesap seçici — paranın gideceği/çıkacağı hesap
  const hesapWrap = document.getElementById('od-hesap-field-wrap');
  const hesapSel  = document.getElementById('od-pop-hesap');
  const hesapLbl  = document.getElementById('od-hesap-lbl');
  if (hesapWrap && hesapSel) {
    const {hesapId: mevcutHesapId, yon} = _odHesapVeYon(tip, item, key);
    const gosterilsin = !!yon; // sadece hesaba yansıma ihtimali olan tipler
    if (!gosterilsin) {
      hesapWrap.style.display = 'none';
    } else {
      hesapWrap.style.display = '';
      hesapLbl.textContent = yon > 0 ? 'Paranın Yatacağı Hesap' : 'Paranın Çekileceği Hesap';
      const secilebilir = _odHesapSecilebilirMi(tip);
      const hamHesaplar = (DB.hesaplar || []).filter(h => h.tur !== 'vadeli');
      const itemPb = item.paraBirimi || (tip==='kmh'||tip==='kredi' ? (item.paraBirimleri?.[0]||defaultCurrency) : defaultCurrency);
      const secim = _odHesapSecimListesiHazirla(tip, item, hamHesaplar, mevcutHesapId || '', itemPb);
      const hesaplar = secim.hesaplar.map(h => ({ ...h, _odIlgiliBanka: _hesapBankayaAitMi(h, secim.bankaId) }));
      _odHesapPopupBuild(hesaplar, secilebilir, secim.hesapId || '');
      call('_odHesapBilgiGuncelle');
      hesapSel.onchange = () => call('_odHesapBilgiGuncelle');
    }
  }

  // Log göster
  _odLogRender(tip, id, key);
  call('_kartOdemeHizliTransferGuncelle', 'od-modal');
  setTimeout(() => call('_kartOdemeHizliTransferGuncelle', 'od-modal'), 120);
}
// Event delegation — od-btn span'ına tıklanınca modal aç
document.addEventListener('click', function(e) {
  const btn = e.target.closest('.od-btn');
  if(!btn) return;
  e.stopPropagation();
  let params;
  try { params = JSON.parse(decodeURIComponent(btn.dataset.od || '{}')); } catch(e2) { return; }
  if(!params.tip) return;
  if(params.tip === 'kart') {
    odAcPopupKart(params.id, params.pb, params.donemKey, params.toplamBorc, params.kalanBorc, params.odemeTarihi, true);
    return;
  }
  odAcPopup(e, params.tip, params.id, params.key, params.tarih, params.tutar, params.extraLabel);
});

// ---- (2. tur refactor: 02-core-app-engine.js'den taşındı) ----
// ── ORTAK ÖDEME DURUMU FİLTRESİ ──
// Kira, Maaş, Elden Ödeme ve Abonelikler sayfalarında "ödeme durumuna göre" filtreleme
// için ortak seçenek listesi ve durum hesaplama yardımcıları. Birden fazla durum
// aynı anda seçilebilir (ör. hem "Bekliyor" hem "Gecikti" birlikte seçilebilir).
export var ODEME_DURUM_FILTRE_OPTS = [
  {value:'', label:'◆ Tümü'},
  {value:'odendi', label:'✓ Ödendi'},
  {value:'bekliyor', label:'◉ Bekliyor'},
  {value:'gecikti', label:'⚠ Gecikti'},
  {value:'kismi', label:'⊟ Kısmi'},
  {value:'ertelendi', label:'↷ Ertelendi'},
  {value:'iptal', label:'⊘ İptal / Atlandı'}
];

// ══════════════════════════════════════════════════════
// ÖDEME DURUMU MODAL — popup yerine tam ekran modal
// ══════════════════════════════════════════════════════

// Modal state
export var _odModal = { tip:null, id:null, key:null, tarih:null, tutar:0, seciliDurum:null };

// ── Ödeme sayfası: transfer log, hızlı ödeme senkronu, sabit işlem sütunu ──
// (Aşağıdaki bloklar aynı paylaşılan fonksiyonlara — mobNavGo, showPage,
// renderAll, openModal/closeModal, ödeme/transfer state, TBK ay-detay
// state — dokunuyor, o yüzden dosyadaki sıraları korunmuştur.)

// [ES module] taban fonksiyonlar odeme/patches zincirinin hook() ile
// sarmalayabilmesi için wrap-registry'ye kaydediliyor.
register('odAcPopup', odAcPopup);
register('odAcPopupKart', odAcPopupKart);
