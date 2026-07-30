// core/global-input-bridge.js
//
// [ES-MODULE UYUMLU] Dinamik olarak (innerHTML ile) üretilen HTML
// şablonlarındaki input/select elemanlarının change/input olaylarını
// yönetir. Eskiden inline `onchange="fn(this, ...)"` / `oninput="fn(this)"`
// attribute'ları kullanılıyordu — bunlar `window.fn` global fonksiyonu
// gerektirir, ama ES module export'ları window'a otomatik yazılmaz. Bu
// dosya artık `window.X = X` KULLANMIYOR: şablonlar `data-oc-handler="fn"`
// (ve gerekirse `data-oc-arg="..."`) attribute'u ile işaretleniyor, burada
// TEK bir `document.addEventListener('change'/'input', ...)` delegasyon
// dinleyicisi bu attribute'u okuyup gerçek (import edilmiş, modül-scope'lu)
// fonksiyonu çağırıyor. Element her innerHTML ile yeniden üretildiğinde bile
// yeniden bağlama GEREKMEZ — delegasyon document seviyesinde tek sefer
// kuruluyor (bkz. dosyanın sonundaki HANDLERS map'i ve addEventListener
// blokları).
//
// onclick-bootstrap.js'den FARKI: o dosya STATİK (index.html'de sabit)
// elementleri DOMContentLoaded'da tek tek `getElementById` ile bulup
// addEventListener bağlıyor — bu, sayfa yüklendiğinde hep aynı elementler
// için işe yarar. Burada ise elementler taksit/nakit-avans gibi listelerde
// DİNAMİK üretiliyor (her render'da yeniden yaratılıyor), bu yüzden
// event delegation (document üzerinde dinleyip event.target'tan yukarı
// doğru ilgili elementi bulma) kullanılıyor — dinamik DOM için doğru ve
// standart yöntem, ayrıca window'a hiç dokunmuyor.

import { inject } from '@core/container.js';
const _kurServisleri = inject('services.kurServisleri');
// domain.hesaplamalar ve core.format zaten container'da kayıtlı (Tur 3/4)
const _hesaplamalar = inject('domain.hesaplamalar');
const calcTaksit = (...a) => _hesaplamalar.calcTaksit(...a);
import { onBankaIbanKodInput, onIbanInput } from '@components/iban-ui.js';
import { mkpFilterList } from '@components/kisiler.js';
import { snavFilter } from '@components/mobile-side-nav.js';
import { updateModalMoneyWraps } from '@components/money-input.js';
import { _updateTransferTutarHint, onTransferHedefChange, onTransferKaynakChange } from '@components/transfer-modal.js';
import { _updateAbTutarHint, _updateAbTutarTumBtn } from '@pages/abonelik.js';
import { asgariFormDegisti, asgariKosulTurChange, asgariOnizle } from '@pages/asgari-odeme.js';
import { extreTypeChange } from '@pages/ekstreler/01-ekstre-kesinlestirme.js';
import { renderExtreler } from '@pages/ekstreler/02-ekstre-render.js';
import { eeHandlePdfFile } from '@pages/ekstreler/03-ekstre-eslestirme-pdf-import.js';
import { _updateEldenTutarHint, onEldenHesapChange, onEldenKarsiIbanInput, onEldenKisiChange, onEldenParaBirimiChange, onEldenTurChange, onEldenYontemChange } from '@pages/elden.js';
import { onHesapOtoGunlukToggleChange, onHesapTurChange } from '@pages/hesaplar/02-hesap-turu-tanimlama.js';
import { filterHesapLog } from '@pages/hesaplar/06-hesap-log.js';
import { onIslemAciklamaModalInput } from '@pages/islemler/01-aciklama-onerileri.js';
import { onIslemKartChange, onIslemProvizyonManuelDegisti, onIslemTaksitChange } from '@pages/islemler/02-islem-form-degisiklikleri.js';
import { renderIslemler } from '@pages/islemler/03-islem-liste-render.js';
import { renderIslemKategoriChips } from '@pages/islemler/06-islem-kategori-secici.js';
import { kdIslemAramaDegisti, kdIslemSiralamaDegisti } from '@pages/kartlar/04-kart-detay-v1.js';
import { kd2IslemAramaDegisti, kd2IslemSiralamaDegisti } from '@pages/kartlar/05-kart-detay-v2.js';
import { onKartOrtakGrupChange } from '@pages/kartlar/07-ortak-limit-grubu.js';
import { _updateKartOdemeTutarHint, onKartOdemeHesapChange } from '@pages/kartlar/08-kart-odeme.js';
import { _updateKiraDepozitoTutarHint, onKiraGunChange, onKiraHesapFullChange, onKiraKisiChange, onKiraPbManualChange, onKiraYontemChange, syncKiraManuelIban, toggleKiraDepozito } from '@pages/kira.js';
import { onTaksitChange } from '@pages/krediler/01-genel-yardimcilar.js';
import { autoSaveNakitAvansLimitKural, autoSaveNakitAvansTavan, calcNakitAvans, onNaKartChange, onNaPbChange, onNaTarihChange, onNaTaksitChange } from '@pages/krediler/02-nakit-avans.js';
import { calcKmhKredi, onKmhToggleChange } from '@pages/krediler/03-kmh-kredi.js';
import { calcKredi } from '@pages/krediler/04-bireysel-kredi.js';
import { maasTypeChange, onMaasGunChange, onMaasHesapChange, onMaasKisiChange, onMaasPbManualChange, onMaasYontemChange, syncMaasManuelIban } from '@pages/maas.js';
import { calcMevduat } from '@pages/mevduat/01-mevduat-form-wizard.js';
import { onMevBaslangicChange, onMevHesapChange, onMevOtoHesapToggle, onMevStratejiChange } from '@pages/mevduat/06-mevduat-hesap-secim-formu.js';
import { _odModalKrediAlanlariAyarla } from '@pages/odeme/06-genel-odeme-modali.js';
import { ozetOdSetBugunScroll } from '@pages/ozet.js';
import { filterSubeList } from '@pages/tanimlamalar/08-subeler.js';
import { onTbkVadeliYenileToggle, tbkAyDetayFiltreUygula } from '@pages/tbk-detay.js';
import { importBankalarJSON, importKategorilerJSON, importTumVeriJSON, vyDoldurOnizlemeDetay, vyRevSecAlan } from '@pages/veri-yonetimi.js';
const _coreFormat = inject('core.format');
const autoSaveGoruntuAyarlari = (...a) => _coreFormat.autoSaveGoruntuAyarlari(...a);
const syncSaatAyrac = (...a) => _coreFormat.syncSaatAyrac(...a);
const syncTarihAyrac = (...a) => _coreFormat.syncTarihAyrac(...a);

window._updateAbTutarHint = _updateAbTutarHint;
window._updateAbTutarTumBtn = _updateAbTutarTumBtn;
window._updateEldenTutarHint = _updateEldenTutarHint;
window._updateKartOdemeTutarHint = _updateKartOdemeTutarHint;
window._updateKiraDepozitoTutarHint = _updateKiraDepozitoTutarHint;
window._updateTransferTutarHint = _updateTransferTutarHint;
window.asgariFormDegisti = asgariFormDegisti;
window.asgariKosulTurChange = asgariKosulTurChange;
window.asgariOnizle = asgariOnizle;
window.autoSaveGoruntuAyarlari = autoSaveGoruntuAyarlari;
window.autoSaveNakitAvansLimitKural = autoSaveNakitAvansLimitKural;
window.calcKmhKredi = calcKmhKredi;
window.calcKredi = calcKredi;
window.calcMevduat = calcMevduat;
window.calcNakitAvans = calcNakitAvans;
window.calcTaksit = calcTaksit;
window.eeHandlePdfFile = eeHandlePdfFile;
window.extreTypeChange = extreTypeChange;
window.filterHesapLog = filterHesapLog;
window.filterSubeList = filterSubeList;
window.importBankalarJSON = importBankalarJSON;
window.importKategorilerJSON = importKategorilerJSON;
window.importTumVeriJSON = importTumVeriJSON;
window.kd2IslemAramaDegisti = kd2IslemAramaDegisti;
window.kd2IslemSiralamaDegisti = kd2IslemSiralamaDegisti;
window.kdIslemAramaDegisti = kdIslemAramaDegisti;
window.kdIslemSiralamaDegisti = kdIslemSiralamaDegisti;
window.maasTypeChange = maasTypeChange;
window.mkpFilterList = mkpFilterList;
window.onBankaIbanKodInput = onBankaIbanKodInput;
window.onEldenHesapChange = onEldenHesapChange;
window.onEldenKarsiIbanInput = onEldenKarsiIbanInput;
window.onEldenKisiChange = onEldenKisiChange;
window.onEldenParaBirimiChange = onEldenParaBirimiChange;
window.onEldenTurChange = onEldenTurChange;
window.onEldenYontemChange = onEldenYontemChange;
window.onHesapOtoGunlukToggleChange = onHesapOtoGunlukToggleChange;
window.onHesapTurChange = onHesapTurChange;
window.onIbanInput = onIbanInput;
window.onIslemAciklamaModalInput = onIslemAciklamaModalInput;
window.onIslemKartChange = onIslemKartChange;
window.onIslemProvizyonManuelDegisti = onIslemProvizyonManuelDegisti;
window.onKartOdemeHesapChange = onKartOdemeHesapChange;
window.onKartOrtakGrupChange = onKartOrtakGrupChange;
window.onKiraGunChange = onKiraGunChange;
window.onKiraHesapFullChange = onKiraHesapFullChange;
window.onKiraKisiChange = onKiraKisiChange;
window.onKiraPbManualChange = onKiraPbManualChange;
window.onKiraYontemChange = onKiraYontemChange;
window.onKmhToggleChange = onKmhToggleChange;
window.onMaasGunChange = onMaasGunChange;
window.onMaasHesapChange = onMaasHesapChange;
window.onMaasKisiChange = onMaasKisiChange;
window.onMaasPbManualChange = onMaasPbManualChange;
window.onMaasYontemChange = onMaasYontemChange;
window.onMevBaslangicChange = onMevBaslangicChange;
window.onMevHesapChange = onMevHesapChange;
window.onMevOtoHesapToggle = onMevOtoHesapToggle;
window.onMevStratejiChange = onMevStratejiChange;
window.onNaKartChange = onNaKartChange;
window.onNaPbChange = onNaPbChange;
window.onNaTarihChange = onNaTarihChange;
window.onTbkVadeliYenileToggle = onTbkVadeliYenileToggle;
window.onTransferHedefChange = onTransferHedefChange;
window.onTransferKaynakChange = onTransferKaynakChange;
window.ozetOdSetBugunScroll = ozetOdSetBugunScroll;
window.pbKurTipDegisti = (...a) => _kurServisleri.pbKurTipDegisti(...a);
window.renderExtreler = renderExtreler;
window.renderIslemKategoriChips = renderIslemKategoriChips;
window.renderIslemler = renderIslemler;
window.renderTcmbGecmis = (...a) => _kurServisleri.renderTcmbGecmis(...a);
window.saveCorsProxyWorker = (...a) => _kurServisleri.saveCorsProxyWorker(...a);
window.snavFilter = snavFilter;
window.syncKiraManuelIban = syncKiraManuelIban;
window.syncMaasManuelIban = syncMaasManuelIban;
window.syncSaatAyrac = syncSaatAyrac;
window.syncTarihAyrac = syncTarihAyrac;
window.tbkAyDetayFiltreUygula = tbkAyDetayFiltreUygula;
window.toggleKiraDepozito = toggleKiraDepozito;
window.updateModalMoneyWraps = updateModalMoneyWraps;
window.vyDoldurOnizlemeDetay = vyDoldurOnizlemeDetay;

// ============================================================
// [ES-MODULE UYUMLU] data-oc-handler delegasyonu
// ------------------------------------------------------------
// Şablonlarda `data-oc-handler="fnAdi"` (ve gerekirse `data-oc-arg="..."`)
// ile işaretlenmiş elemanların change/input olaylarını burada, TEK bir
// document-seviyeli dinleyiciyle yakalayıp doğru (import edilmiş) modül
// fonksiyonunu çağırıyoruz. Her handler kendi orijinal imzasına uygun
// küçük bir sarmalayıcı ile HANDLERS map'ine ekleniyor — böylece
// event.target ('this' yerine geçer) ve gerekli data-* attribute'lardan
// (idx/field/tip/cur vb.) orijinal argümanlar yeniden kurulur.
// window'a HİÇBİR ŞEY YAZILMIYOR.
const HANDLERS = {
  // onIslemTaksitChange(el, idx, field) — idx/field data-islem-taksit-idx/
  // data-islem-taksit-field attribute'larından okunuyor (bkz. hesaplamalar.js).
  onIslemTaksitChange: (el) => onIslemTaksitChange(
    el, Number(el.dataset.islemTaksitIdx), el.dataset.islemTaksitField
  ),
  // onTaksitChange(el, tip, idx, field) — tip/idx/field data-taksit-tip/
  // data-taksit-idx/data-taksit-field attribute'larından okunuyor
  // (bkz. krediler/01-genel-yardimcilar.js).
  onTaksitChange: (el) => onTaksitChange(
    el, el.dataset.taksitTip, Number(el.dataset.taksitIdx), el.dataset.taksitField
  ),
  // onNaTaksitChange(el) — parametresiz, doğrudan element.
  onNaTaksitChange: (el) => onNaTaksitChange(el),
  // autoSaveNakitAvansTavan(el) — parametresiz, doğrudan element.
  autoSaveNakitAvansTavan: (el) => autoSaveNakitAvansTavan(el),
  // _odModalKrediAlanlariAyarla(durum) — sabit argüman data-oc-arg'dan
  // okunuyor (bkz. money-input.js: data-oc-arg="gecikti").
  _odModalKrediAlanlariAyarla: (el) => _odModalKrediAlanlariAyarla(el.dataset.ocArg),
  // vyRevSecAlan(key) — eskiden `this.value` kullanıyordu, delegation'da
  // event.target.value ile aynı şey (bkz. gdrive.js).
  vyRevSecAlan: (el) => vyRevSecAlan(el.value),
};

function _dispatchOcEvent(event) {
  const el = event.target.closest('[data-oc-handler]');
  if (!el) return;
  // data-oc-event, elementin ORİJİNAL onchange/oninput tipini belirtir;
  // yalnızca o event tipinde tetikleniyoruz ki davranış birebir korunsun
  // (örn. tarih input'u sadece 'change'de, tutar input'u sadece 'input'ta
  // eskiden olduğu gibi çalışsın).
  if (el.dataset.ocEvent && el.dataset.ocEvent !== event.type) return;
  const handler = HANDLERS[el.dataset.ocHandler];
  if (typeof handler === 'function') handler(el);
}
document.addEventListener('change', _dispatchOcEvent);
document.addEventListener('input', _dispatchOcEvent);

