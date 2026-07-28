// core/global-input-bridge.js
//
// index.html içindeki inline oninput="..." / onchange="..." handler'ları
// (ve wizard-routing.js'nin _wrRestoreModalForm ile formu geri yüklerken
// tetiklediği sentetik input/change event'leri) burada import edilen
// fonksiyonları window üzerinden çağırıyor. ES module export'ları
// otomatik olarak window'a yazılmadığı için, onclick-bootstrap.js'nin
// onclick için yaptığının bir benzeri burada oninput/onchange için
// yapılıyor: her fonksiyon import edilip window'a bağlanıyor.
//
// NOT: onclick-bootstrap.js'nin aksine burada addEventListener'a
// geçilmedi çünkü index.html'deki inline ifadeler çoğunlukla
// `this.value` / `this.checked` kullanıyor; window köprüsü bunu
// bozmadan en düşük riskli çözüm.

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
import { onIslemKartChange, onIslemProvizyonManuelDegisti } from '@pages/islemler/02-islem-form-degisiklikleri.js';
import { renderIslemler } from '@pages/islemler/03-islem-liste-render.js';
import { renderIslemKategoriChips } from '@pages/islemler/06-islem-kategori-secici.js';
import { kdIslemAramaDegisti, kdIslemSiralamaDegisti } from '@pages/kartlar/04-kart-detay-v1.js';
import { kd2IslemAramaDegisti, kd2IslemSiralamaDegisti } from '@pages/kartlar/05-kart-detay-v2.js';
import { onKartOrtakGrupChange } from '@pages/kartlar/07-ortak-limit-grubu.js';
import { _updateKartOdemeTutarHint, onKartOdemeHesapChange } from '@pages/kartlar/08-kart-odeme.js';
import { _updateKiraDepozitoTutarHint, onKiraGunChange, onKiraHesapFullChange, onKiraKisiChange, onKiraPbManualChange, onKiraYontemChange, syncKiraManuelIban, toggleKiraDepozito } from '@pages/kira.js';
import { autoSaveNakitAvansLimitKural, calcNakitAvans, onNaKartChange, onNaPbChange, onNaTarihChange } from '@pages/krediler/02-nakit-avans.js';
import { calcKmhKredi, onKmhToggleChange } from '@pages/krediler/03-kmh-kredi.js';
import { calcKredi } from '@pages/krediler/04-bireysel-kredi.js';
import { maasTypeChange, onMaasGunChange, onMaasHesapChange, onMaasKisiChange, onMaasPbManualChange, onMaasYontemChange, syncMaasManuelIban } from '@pages/maas.js';
import { calcMevduat } from '@pages/mevduat/01-mevduat-form-wizard.js';
import { onMevBaslangicChange, onMevHesapChange, onMevOtoHesapToggle, onMevStratejiChange } from '@pages/mevduat/06-mevduat-hesap-secim-formu.js';
import { ozetOdSetBugunScroll } from '@pages/ozet.js';
import { filterSubeList } from '@pages/tanimlamalar/08-subeler.js';
import { onTbkVadeliYenileToggle, tbkAyDetayFiltreUygula } from '@pages/tbk-detay.js';
import { importBankalarJSON, importKategorilerJSON, importTumVeriJSON, vyDoldurOnizlemeDetay } from '@pages/veri-yonetimi.js';
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
