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

import { calcTaksit } from '../domain/hesaplamalar.js';
import { pbKurTipDegisti, renderTcmbGecmis, saveCorsProxyWorker } from '../services/kur-servisleri.js';
import { onBankaIbanKodInput, onIbanInput } from '../ui/components/iban-ui.js';
import { mkpFilterList } from '../ui/components/kisiler.js';
import { snavFilter } from '../ui/components/mobile-side-nav.js';
import { updateModalMoneyWraps } from '../ui/components/money-input.js';
import { _updateTransferTutarHint, onTransferHedefChange, onTransferKaynakChange } from '../ui/components/transfer-modal.js';
import { _updateAbTutarHint, _updateAbTutarTumBtn } from '../ui/pages/abonelik.js';
import { asgariFormDegisti, asgariKosulTurChange, asgariOnizle } from '../ui/pages/asgari-odeme.js';
import { extreTypeChange } from '../ui/pages/ekstreler/01-ekstre-kesinlestirme.js';
import { renderExtreler } from '../ui/pages/ekstreler/02-ekstre-render.js';
import { eeHandlePdfFile } from '../ui/pages/ekstreler/03-ekstre-eslestirme-pdf-import.js';
import { _updateEldenTutarHint, onEldenHesapChange, onEldenKarsiIbanInput, onEldenKisiChange, onEldenParaBirimiChange, onEldenTurChange, onEldenYontemChange } from '../ui/pages/elden.js';
import { onHesapOtoGunlukToggleChange, onHesapTurChange } from '../ui/pages/hesaplar/02-hesap-turu-tanimlama.js';
import { filterHesapLog } from '../ui/pages/hesaplar/06-hesap-log.js';
import { onIslemAciklamaModalInput } from '../ui/pages/islemler/01-aciklama-onerileri.js';
import { onIslemKartChange, onIslemProvizyonManuelDegisti } from '../ui/pages/islemler/02-islem-form-degisiklikleri.js';
import { renderIslemler } from '../ui/pages/islemler/03-islem-liste-render.js';
import { renderIslemKategoriChips } from '../ui/pages/islemler/06-islem-kategori-secici.js';
import { kdIslemAramaDegisti, kdIslemSiralamaDegisti } from '../ui/pages/kartlar/04-kart-detay-v1.js';
import { kd2IslemAramaDegisti, kd2IslemSiralamaDegisti } from '../ui/pages/kartlar/05-kart-detay-v2.js';
import { onKartOrtakGrupChange } from '../ui/pages/kartlar/07-ortak-limit-grubu.js';
import { _updateKartOdemeTutarHint, onKartOdemeHesapChange } from '../ui/pages/kartlar/08-kart-odeme.js';
import { _updateKiraDepozitoTutarHint, onKiraGunChange, onKiraHesapFullChange, onKiraKisiChange, onKiraPbManualChange, onKiraYontemChange, syncKiraManuelIban, toggleKiraDepozito } from '../ui/pages/kira.js';
import { autoSaveNakitAvansLimitKural, calcNakitAvans, onNaKartChange, onNaPbChange, onNaTarihChange } from '../ui/pages/krediler/02-nakit-avans.js';
import { calcKmhKredi, onKmhToggleChange } from '../ui/pages/krediler/03-kmh-kredi.js';
import { calcKredi } from '../ui/pages/krediler/04-bireysel-kredi.js';
import { maasTypeChange, onMaasGunChange, onMaasHesapChange, onMaasKisiChange, onMaasPbManualChange, onMaasYontemChange, syncMaasManuelIban } from '../ui/pages/maas.js';
import { calcMevduat } from '../ui/pages/mevduat/01-mevduat-form-wizard.js';
import { onMevBaslangicChange, onMevHesapChange, onMevOtoHesapToggle, onMevStratejiChange } from '../ui/pages/mevduat/06-mevduat-hesap-secim-formu.js';
import { ozetOdSetBugunScroll } from '../ui/pages/ozet.js';
import { filterSubeList } from '../ui/pages/tanimlamalar/08-subeler.js';
import { onTbkVadeliYenileToggle, tbkAyDetayFiltreUygula } from '../ui/pages/tbk-detay.js';
import { importBankalarJSON, importKategorilerJSON, importTumVeriJSON, vyDoldurOnizlemeDetay } from '../ui/pages/veri-yonetimi.js';
import { autoSaveGoruntuAyarlari, syncSaatAyrac, syncTarihAyrac } from './format.js';

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
window.pbKurTipDegisti = pbKurTipDegisti;
window.renderExtreler = renderExtreler;
window.renderIslemKategoriChips = renderIslemKategoriChips;
window.renderIslemler = renderIslemler;
window.renderTcmbGecmis = renderTcmbGecmis;
window.saveCorsProxyWorker = saveCorsProxyWorker;
window.snavFilter = snavFilter;
window.syncKiraManuelIban = syncKiraManuelIban;
window.syncMaasManuelIban = syncMaasManuelIban;
window.syncSaatAyrac = syncSaatAyrac;
window.syncTarihAyrac = syncTarihAyrac;
window.tbkAyDetayFiltreUygula = tbkAyDetayFiltreUygula;
window.toggleKiraDepozito = toggleKiraDepozito;
window.updateModalMoneyWraps = updateModalMoneyWraps;
window.vyDoldurOnizlemeDetay = vyDoldurOnizlemeDetay;
