import { showPage, showTab } from './app-core-base.js';
import { mobNavGo } from './render-core.js';
import { call } from './wrap-registry.js';
import { resetGoruntuAyarlari, setSaatFormat, setTarihFormat } from './format.js';
import { gDriveAcRevizyonModal, gDriveGeriYukleYerelYedek, gDriveSignIn, gDriveSignOut, gDriveSyncNow } from '../services/gdrive.js';
import { pbKaynakEkle, tcmbKurlariniGuncelle } from '../services/kur-servisleri.js';
import { _ibanPopupEkle, _ibanPopupKapat, copyFieldIban } from '../ui/components/iban-ui.js';
import { closeMiniKisiPopup, kisiIbanEkle, mkpFilterList, mkpSaveKisi, mkpToggleAddForm, openKisiModal, openMiniKisiPopup, saveKisi, toggleKtMode } from '../ui/components/kisiler.js';
import { kontratPlanBugune, kontratPlanFormKapat, kontratPlanFormKaydet, kontratPlanYilDegistir } from '../ui/components/kontrat-plani.js';
import { closeMobMore, closeMobileSidebar, toggleMobMore, toggleMobProfile, toggleMobileSidebar } from '../ui/components/mobile-nav-tema/01-mobil-nav.js';
import { temaSistemeDondur, toggleTheme, updateMobThemeBtn } from '../ui/components/mobile-nav-tema/02-tema.js';
import { snavMobileBack, snavMobileOpen } from '../ui/components/mobile-side-nav.js';
import { setMoneyFormat } from '../ui/components/money-input.js';
import { openTransferModal, swapTransferHesaplar, transferStepBack, transferStepNext, transferTutarTumunuKullan } from '../ui/components/transfer-modal.js';
import { abStepBack, abStepNext, openAbonelikModal, saveAbonelik } from '../ui/pages/abonelik.js';
import { asgariKuralEkle, asgariKurallariTemizle } from '../ui/pages/asgari-odeme.js';
import { clearOzelExtre, openOzelExtreModal, saveOzelExtre } from '../ui/pages/ekstreler/01-ekstre-kesinlestirme.js';
import { openExtreDurumModal, openExtreKartModal, openExtreKategoriModal } from '../ui/pages/ekstreler/02-ekstre-render.js';
import { eeConfirmManualKart, eeShowKartPicker } from '../ui/pages/ekstreler/03-ekstre-eslestirme-pdf-import.js';
import { copyEldenHesapIban, copyEldenKarsiIban, eldenStepBack, eldenStepNext, openEldenModal, saveElden } from '../ui/pages/elden.js';
import { openHesapTurModal, saveHesapTur } from '../ui/pages/hesaplar/02-hesap-turu-tanimlama.js';
import { hesapStepBack, hesapStepNext, openHesapModal, saveHesap } from '../ui/pages/hesaplar/03-hesap-form-crud.js';
import { _hesapLogDuzeltAc, saveBakiyeDuzelt } from '../ui/pages/hesaplar/05-bakiye-duzelt.js';
import { islemAciklamaModalOnayla, openIslemAciklamaModal } from '../ui/pages/islemler/01-aciklama-onerileri.js';
import { islemTaksitAdim } from '../ui/pages/islemler/02-islem-form-degisiklikleri.js';
import { setIslemDonemTab } from '../ui/pages/islemler/03-islem-liste-render.js';
import { clearIslemFiltre, openIslemFiltreModal } from '../ui/pages/islemler/04-islem-filtre.js';
import { extreKartGeriDon } from '../ui/pages/islemler/05-ekstre-kart-secici.js';
import { openIslemKategoriModal } from '../ui/pages/islemler/06-islem-kategori-secici.js';
import { kartDetayGeriDon } from '../ui/pages/kartlar/03-kart-detay-ortak.js';
import { kdIslemAramaTemizle, kdSwitchTab, kdYeniIslemAc } from '../ui/pages/kartlar/04-kart-detay-v1.js';
import { kd2BorcOdeAc, kd2DeleteKartFromDetay, kd2EslestirAc, kd2IslemAramaTemizle, kd2LimitGuncelleFromDetay, kd2SwitchTab, kd2ToggleMoreMenu } from '../ui/pages/kartlar/05-kart-detay-v2.js';
import { kartStepBack, kartStepNext, saveKart } from '../ui/pages/kartlar/06-kart-form.js';
import { openOrtakGrupModal, saveOrtakGrupModal } from '../ui/pages/kartlar/07-ortak-limit-grubu.js';
import { kartOdemeKalanTamaminiDoldur, kartOdemeStepBack, kartOdemeStepNext, kartOdemeTutarTumunuKullan, saveKartOdeme } from '../ui/pages/kartlar/08-kart-odeme.js';
import { _kd2KartId, openKartAltyapiModal, saveKartAltyapi, setEditKartId } from '../ui/pages/kartlar/09-kart-altyapi.js';
import { copyKiraHesapIban, kiraStepBack, kiraStepNext, openKiraModal, saveKira } from '../ui/pages/kira.js';
import { resetKmhTaksitler, resetKrediTaksitler } from '../ui/pages/krediler/01-genel-yardimcilar.js';
import { naStepBack, naStepNext, openNakitAvansModal, saveNakitAvans } from '../ui/pages/krediler/02-nakit-avans.js';
import { kmhKrediStepBack, kmhKrediStepNext, openKmhKrediModal, saveKmhKredi } from '../ui/pages/krediler/03-kmh-kredi.js';
import { krediStepBack, krediStepNext, openKrediModal, saveKredi } from '../ui/pages/krediler/04-bireysel-kredi.js';
import { openKrediTipModal, saveKrediTip } from '../ui/pages/krediler/05-kredi-tipi-tanimlama.js';
import { copyMaasHesapIban, maasStepBack, maasStepNext, openMaasModal, saveMaas } from '../ui/pages/maas.js';
import { mevStepBack, mevStepNext, mevTutarTumunuKullan, saveMevduat } from '../ui/pages/mevduat/01-mevduat-form-wizard.js';
import { ozetOdSetGecmis, ozetOdSetPeriod, tgHizliAralik } from '../ui/pages/ozet.js';
import { katOneriEkleSecili, katOneriSelectAll, openKategoriModal, openKategoriOneriModal, saveKategori } from '../ui/pages/tanimlamalar/03-kategoriler.js';
import { addTbkFaizOrani, iptalTbkFaizDuzenle } from '../ui/pages/tanimlamalar/04-tbk-faiz-oranlari.js';
import { openOranModal, saveOran } from '../ui/pages/tanimlamalar/05-genel-oran-tablolari.js';
import { openParaBirimiModal, pbStepBack, pbStepNext, saveParaBirimi } from '../ui/pages/tanimlamalar/06-para-birimi.js';
import { openBankaModal, saveBanka, seedPresetBankalar } from '../ui/pages/tanimlamalar/07-bankalar.js';
import { saveSubeForm } from '../ui/pages/tanimlamalar/08-subeler.js';
import { openUrunTipModal, saveUrunTip } from '../ui/pages/tanimlamalar/09-urun-tipleri.js';
import { openTatilModal, resmiTatilleriGuncelle, saveTatil } from '../ui/pages/tanimlamalar/10-resmi-tatiller.js';
import { openTbkAyarModal, tbkSetGecmis, tbkSetPeriod } from '../ui/pages/tbk-detay.js';
import { confirmTumVeriRestore, exportBankalarJSON, exportKategorilerJSON, exportTumVeriJSON } from '../ui/pages/veri-yonetimi.js';
import { closeModal, openModal } from '../ui/components/modal-genel.js';

// [ES module - Aşama 2] Bu dosya, index.html'de eskiden inline onclick="..."
// olarak tanımlı 359 tıklama işleyicisini addEventListener ile bağlar.
// Otomatik üretildi (onclick metinleri AST ile ayrıştırılıp fonksiyon çağrılarına
// çevrildi). Davranış korunmuştur: her handler orijinal onclick body'sindeki
// KOD'u aynen çalıştırır, sadece bağlama yöntemi değişmiştir.
document.addEventListener('DOMContentLoaded', function() {
  (function(){
    var el = document.getElementById("rf-oc-1");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showPage('ozet',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-2");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showPage('kartlar',this);
    });
  })();
  (function(){
    var el = document.getElementById("nav-islemler");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showPage('islemler',this);
    });
  })();
  (function(){
    var el = document.getElementById("nav-extreler");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showPage('extreler',this);
    });
  })();
  (function(){
    var el = document.getElementById("nav-ekstreeslestir");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showPage('ekstreeslestir',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-3");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showPage('mevduat',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-4");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showPage('hesaplar',this);
    });
  })();
  (function(){
    var el = document.getElementById("nav-transfer");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openTransferModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-5");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showPage('kira',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-6");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showPage('maas',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-7");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showPage('elden',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-8");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showPage('abonelik',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-9");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showPage('kmhkredi',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-10");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showPage('kredi',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-11");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showPage('tanimlamalar',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-12");
    if (!el) return;
    el.addEventListener('click', function(event) {
      gDriveSyncNow();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-13");
    if (!el) return;
    el.addEventListener('click', function(event) {
      gDriveSignOut();
    });
  })();
  (function(){
    var el = document.getElementById("gdrive-signin-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      gDriveSignIn();
    });
  })();
  (function(){
    var el = document.getElementById("theme-toggle-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      toggleTheme();
    });
  })();
  (function(){
    var el = document.getElementById("theme-system-link");
    if (!el) return;
    el.addEventListener('click', function(event) {
      temaSistemeDondur();
    });
  })();
  (function(){
    var el = document.getElementById("topbar-hamburger");
    if (!el) return;
    el.addEventListener('click', function(event) {
      toggleMobileSidebar();
    });
  })();
  (function(){
    var el = document.getElementById("topbar-profile-trigger");
    if (!el) return;
    el.addEventListener('click', function(event) {
      toggleMobProfile(event);
    });
  })();
  (function(){
    var el = document.getElementById("scroll-top-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      document.querySelector('.main-wrap').scrollTo({top:0,behavior:'smooth'});
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-14");
    if (!el) return;
    el.addEventListener('click', function(event) {
      ozetOdSetGecmis(0,this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-15");
    if (!el) return;
    el.addEventListener('click', function(event) {
      ozetOdSetGecmis(3,this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-16");
    if (!el) return;
    el.addEventListener('click', function(event) {
      ozetOdSetGecmis(7,this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-17");
    if (!el) return;
    el.addEventListener('click', function(event) {
      ozetOdSetGecmis(14,this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-18");
    if (!el) return;
    el.addEventListener('click', function(event) {
      ozetOdSetGecmis(30,this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-19");
    if (!el) return;
    el.addEventListener('click', function(event) {
      ozetOdSetPeriod(30,this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-20");
    if (!el) return;
    el.addEventListener('click', function(event) {
      ozetOdSetPeriod(90,this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-21");
    if (!el) return;
    el.addEventListener('click', function(event) {
      ozetOdSetPeriod(180,this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-22");
    if (!el) return;
    el.addEventListener('click', function(event) {
      ozetOdSetPeriod(365,this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-23");
    if (!el) return;
    el.addEventListener('click', function(event) {
      tbkSetGecmis(0,this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-24");
    if (!el) return;
    el.addEventListener('click', function(event) {
      tbkSetGecmis(90,this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-25");
    if (!el) return;
    el.addEventListener('click', function(event) {
      tbkSetGecmis(180,this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-26");
    if (!el) return;
    el.addEventListener('click', function(event) {
      tbkSetGecmis(365,this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-27");
    if (!el) return;
    el.addEventListener('click', function(event) {
      tbkSetGecmis(730,this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-28");
    if (!el) return;
    el.addEventListener('click', function(event) {
      tbkSetGecmis(1095,this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-29");
    if (!el) return;
    el.addEventListener('click', function(event) {
      tbkSetPeriod(90,this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-30");
    if (!el) return;
    el.addEventListener('click', function(event) {
      tbkSetPeriod(180,this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-31");
    if (!el) return;
    el.addEventListener('click', function(event) {
      tbkSetPeriod(365,this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-32");
    if (!el) return;
    el.addEventListener('click', function(event) {
      tbkSetPeriod(730,this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-33");
    if (!el) return;
    el.addEventListener('click', function(event) {
      tbkSetPeriod(1095,this);
    });
  })();
  (function(){
    var el = document.getElementById("tbk-settings-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openTbkAyarModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-34");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-tbk-ayar');
    });
  })();
  (function(){
    var el = document.getElementById("tbk-faiz-submit-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      addTbkFaizOrani();
    });
  })();
  (function(){
    var el = document.getElementById("tbk-faiz-iptal-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      iptalTbkFaizDuzenle();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-35");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setEditKartId(null);openModal('modal-kart');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-36");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kartDetayGeriDon();
    });
  })();
  (function(){
    var el = document.getElementById("kd2-more-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kd2ToggleMoreMenu();
    });
  })();
  (function(){
    var el = document.getElementById("kd2-eslestir-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kd2EslestirAc();
    });
  })();
  (function(){
    var el = document.getElementById("kd2-limit-guncelle-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kd2LimitGuncelleFromDetay();
    });
  })();
  (function(){
    var el = document.getElementById("kd2-delete-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kd2DeleteKartFromDetay();
    });
  })();
  (function(){
    var el = document.getElementById("kd2-borc-ode-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kd2BorcOdeAc();
    });
  })();
  (function(){
    var el = document.getElementById("kd2-nakit-avans-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openNakitAvansModal(_kd2KartId);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-37");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kdYeniIslemAc();
    });
  })();
  (function(){
    var el = document.getElementById("kd2-tab-btn-islem");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kd2SwitchTab('islem');
    });
  })();
  (function(){
    var el = document.getElementById("kd2-tab-btn-extre");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kd2SwitchTab('extre');
    });
  })();
  (function(){
    var el = document.getElementById("kd2-islem-arama-temizle");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kd2IslemAramaTemizle();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-38");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openModal('modal-islem');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-39");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openNakitAvansModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-40");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setIslemDonemTab('guncel');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-41");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setIslemDonemTab('onceki');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-42");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setIslemDonemTab('tum');
    });
  })();
  (function(){
    var el = document.getElementById("islem-filtre-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openIslemFiltreModal();
    });
  })();
  (function(){
    var el = document.getElementById("extre-geri-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      extreKartGeriDon();
    });
  })();
  (function(){
    var el = document.getElementById("extre-kart-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openExtreKartModal();
    });
  })();
  (function(){
    var el = document.getElementById("extre-durum-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openExtreDurumModal();
    });
  })();
  (function(){
    var el = document.getElementById("extre-kategori-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openExtreKategoriModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-43");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openOzelExtreModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-44");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-eslestir');
    });
  })();
  (function(){
    var el = document.getElementById("ee-dropzone");
    if (!el) return;
    el.addEventListener('click', function(event) {
      document.getElementById('ee-pdf-input').click();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-45");
    if (!el) return;
    el.addEventListener('click', function(event) {
      eeShowKartPicker();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-46");
    if (!el) return;
    el.addEventListener('click', function(event) {
      eeConfirmManualKart();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-47");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-islem-filtre');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-48");
    if (!el) return;
    el.addEventListener('click', function(event) {
      clearIslemFiltre();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-49");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-islem-filtre');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-50");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-extre-kart');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-51");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-extre-durum');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-52");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-extre-kategori');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-53");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-ozel-extre');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-54");
    if (!el) return;
    el.addEventListener('click', function(event) {
      clearOzelExtre();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-55");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveOzelExtre();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-56");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openModal('modal-mevduat');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-57");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openKiraModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-58");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openMaasModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-59");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openKmhKrediModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-60");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openKrediModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-61");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openTransferModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-62");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openHesapModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-63");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openEldenModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-64");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showTab('tab-bankalar',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-65");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showTab('tab-hesap-turleri',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-66");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showTab('tab-urun-tipler',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-67");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showTab('tab-kredi-tipleri',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-68");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showTab('tab-kart-altyapilari',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-69");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showTab('tab-kategoriler',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-70");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showTab('tab-kisiler',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-71");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showTab('tab-tatiller',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-72");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showTab('tab-asgari-odeme',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-73");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showTab('tab-nakit-avans',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-74");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showTab('tab-para-birimi-yonetim',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-75");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showTab('tab-vergi-faiz',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-76");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showTab('tab-goruntu-ayarlari',this);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-77");
    if (!el) return;
    el.addEventListener('click', function(event) {
      showTab('tab-veri-yonetimi',this);
    });
  })();
  (function(){
    var el = document.getElementById("snav-mobile-back");
    if (!el) return;
    el.addEventListener('click', function(event) {
      snavMobileBack();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-78");
    if (!el) return;
    el.addEventListener('click', function(event) {
      snavMobileOpen();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-79");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openBankaModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-80");
    if (!el) return;
    el.addEventListener('click', function(event) {
      seedPresetBankalar();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-81");
    if (!el) return;
    el.addEventListener('click', function(event) {
      exportBankalarJSON();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-82");
    if (!el) return;
    el.addEventListener('click', function(event) {
      document.getElementById('banka-import-file').click();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-83");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openHesapTurModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-84");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openUrunTipModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-85");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openKrediTipModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-86");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openKartAltyapiModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-87");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openTatilModal();
    });
  })();
  (function(){
    var el = document.getElementById("btn-tatil-guncelle");
    if (!el) return;
    el.addEventListener('click', function(event) {
      resmiTatilleriGuncelle();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-88");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openKategoriModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-89");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openKategoriOneriModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-90");
    if (!el) return;
    el.addEventListener('click', function(event) {
      exportKategorilerJSON();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-91");
    if (!el) return;
    el.addEventListener('click', function(event) {
      document.getElementById('kategori-import-input').click();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-92");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openKisiModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-93");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openParaBirimiModal();
    });
  })();
  (function(){
    var el = document.getElementById("btn-tcmb-guncelle");
    if (!el) return;
    el.addEventListener('click', function(event) {
      tcmbKurlariniGuncelle(true);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-94");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openModal('modal-tcmb-gecmis');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-95");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openOranModal('stopaj');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-96");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openOranModal('kkdf');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-97");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openOranModal('bsmv');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-98");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openOranModal('kmhFaiz');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-99");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openOranModal('gecikmeFaiz');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-100");
    if (!el) return;
    el.addEventListener('click', function(event) {
      asgariKuralEkle();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-101");
    if (!el) return;
    el.addEventListener('click', function(event) {
      asgariKurallariTemizle();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-102");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setTarihFormat('dd/MM/yyyy');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-103");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setTarihFormat('dd.MM.yyyy');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-104");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setTarihFormat('d.M.yyyy');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-105");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setTarihFormat('MM/dd/yyyy');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-106");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setTarihFormat('yyyy-MM-dd');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-107");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setTarihFormat('dd MM yyyy');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-108");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setTarihFormat('yy/MM/dd');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-109");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setTarihFormat('EEE dd/MM/yyyy');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-110");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setTarihFormat('dd/MM/yyyy EEE');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-111");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setTarihFormat('EEEE dd/MM/yyyy');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-112");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setTarihFormat('dd/MM/yyyy EEEE');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-113");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setSaatFormat('HH:mm');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-114");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setSaatFormat('HH:mm:ss');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-115");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setSaatFormat('hh:mm A');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-116");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setSaatFormat('HH.mm');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-117");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setMoneyFormat(',','.','2');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-118");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setMoneyFormat('.',',','2');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-119");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setMoneyFormat(',',' ','2');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-120");
    if (!el) return;
    el.addEventListener('click', function(event) {
      setMoneyFormat(',','.','0');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-121");
    if (!el) return;
    el.addEventListener('click', function(event) {
      resetGoruntuAyarlari();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-122");
    if (!el) return;
    el.addEventListener('click', function(event) {
      exportTumVeriJSON();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-123");
    if (!el) return;
    el.addEventListener('click', function(event) {
      document.getElementById('vy-restore-file').click();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-124");
    if (!el) return;
    el.addEventListener('click', function(event) {
      gDriveAcRevizyonModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-125");
    if (!el) return;
    el.addEventListener('click', function(event) {
      gDriveGeriYukleYerelYedek();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-126");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-vy-restore-onay');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-127");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-vy-restore-onay');
    });
  })();
  (function(){
    var el = document.getElementById("vy-restore-confirm-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      confirmTumVeriRestore();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-128");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-drive-revizyon');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-129");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-drive-revizyon');
    });
  })();
  (function(){
    var el = document.getElementById("drive-revizyon-geri-yukle-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      ;
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-130");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kategori');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-131");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kategori');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-132");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveKategori();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-133");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-tcmb-gecmis');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-134");
    if (!el) return;
    el.addEventListener('click', function(event) {
      tgHizliAralik(7);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-135");
    if (!el) return;
    el.addEventListener('click', function(event) {
      tgHizliAralik(30);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-136");
    if (!el) return;
    el.addEventListener('click', function(event) {
      tgHizliAralik(90);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-137");
    if (!el) return;
    el.addEventListener('click', function(event) {
      tgHizliAralik(null);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-138");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-tcmb-gecmis');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-139");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-tbk-ay-detay');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-140");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-para-birimi');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-141");
    if (!el) return;
    el.addEventListener('click', function(event) {
      pbKaynakEkle();
    });
  })();
  (function(){
    var el = document.getElementById("pb-step-cancel-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-para-birimi');
    });
  })();
  (function(){
    var el = document.getElementById("pb-step-back-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      pbStepBack();
    });
  })();
  (function(){
    var el = document.getElementById("pb-step-next-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      pbStepNext();
    });
  })();
  (function(){
    var el = document.getElementById("pb-step-save-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveParaBirimi();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-142");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kmhkredi');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-143");
    if (!el) return;
    el.addEventListener('click', function(event) {
      resetKmhTaksitler();
    });
  })();
  (function(){
    var el = document.getElementById("kmhkredi-step-cancel-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kmhkredi');
    });
  })();
  (function(){
    var el = document.getElementById("kmhkredi-step-back-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kmhKrediStepBack();
    });
  })();
  (function(){
    var el = document.getElementById("kmhkredi-step-next-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kmhKrediStepNext();
    });
  })();
  (function(){
    var el = document.getElementById("kmhkredi-step-save-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveKmhKredi();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-144");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kredi');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-145");
    if (!el) return;
    el.addEventListener('click', function(event) {
      resetKrediTaksitler();
    });
  })();
  (function(){
    var el = document.getElementById("kredi-step-cancel-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kredi');
    });
  })();
  (function(){
    var el = document.getElementById("kredi-step-back-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      krediStepBack();
    });
  })();
  (function(){
    var el = document.getElementById("kredi-step-next-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      krediStepNext();
    });
  })();
  (function(){
    var el = document.getElementById("kredi-step-save-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveKredi();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-146");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kart');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-147");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openOrtakGrupModal(null);
    });
  })();
  (function(){
    var el = document.getElementById("kart-step-cancel-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kart');
    });
  })();
  (function(){
    var el = document.getElementById("kart-step-back-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kartStepBack();
    });
  })();
  (function(){
    var el = document.getElementById("kart-step-next-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kartStepNext();
    });
  })();
  (function(){
    var el = document.getElementById("kart-step-save-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveKart();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-148");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-ortak-grup');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-149");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-ortak-grup');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-150");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveOrtakGrupModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-151");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kart-detay');
    });
  })();
  (function(){
    var el = document.getElementById("kd-tab-btn-islem");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kdSwitchTab('islem');
    });
  })();
  (function(){
    var el = document.getElementById("kd-tab-btn-extre");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kdSwitchTab('extre');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-152");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kdYeniIslemAc();
    });
  })();
  (function(){
    var el = document.getElementById("kd-islem-arama-temizle");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kdIslemAramaTemizle();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-153");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-islem');
    });
  })();
  (function(){
    var el = document.getElementById("islem-aciklama-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openIslemAciklamaModal();
    });
  })();
  (function(){
    var el = document.getElementById("islem-kategori-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openIslemKategoriModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-154");
    if (!el) return;
    el.addEventListener('click', function(event) {
      islemTaksitAdim(-1);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-155");
    if (!el) return;
    el.addEventListener('click', function(event) {
      islemTaksitAdim(1);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-156");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-islem');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-157");
    if (!el) return;
    el.addEventListener('click', function(event) {
      call('saveIslem');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-158");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-islem-kategori');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-159");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-islem-aciklama');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-160");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-islem-aciklama');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-161");
    if (!el) return;
    el.addEventListener('click', function(event) {
      islemAciklamaModalOnayla();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-162");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-nakit-avans');
    });
  })();
  (function(){
    var el = document.getElementById("na-step-cancel-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-nakit-avans');
    });
  })();
  (function(){
    var el = document.getElementById("na-step-back-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      naStepBack();
    });
  })();
  (function(){
    var el = document.getElementById("na-step-next-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      naStepNext();
    });
  })();
  (function(){
    var el = document.getElementById("na-step-save-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveNakitAvans();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-163");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-oran');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-164");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-oran');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-165");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveOran();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-166");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-mevduat');
    });
  })();
  (function(){
    var el = document.getElementById("mev-tutar-tum-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      mevTutarTumunuKullan();
    });
  })();
  (function(){
    var el = document.getElementById("mev-step-cancel-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-mevduat');
    });
  })();
  (function(){
    var el = document.getElementById("mev-step-back-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      mevStepBack();
    });
  })();
  (function(){
    var el = document.getElementById("mev-step-next-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      mevStepNext();
    });
  })();
  (function(){
    var el = document.getElementById("mev-step-save-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveMevduat();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-167");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kira');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-168");
    if (!el) return;
    el.addEventListener('click', function(event) {
      copyKiraHesapIban();
    });
  })();
  (function(){
    var el = document.getElementById("kira-kt-toggle");
    if (!el) return;
    el.addEventListener('click', function(event) {
      toggleKtMode('kira');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-169");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openMiniKisiPopup(this,'kira-kisi');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-170");
    if (!el) return;
    el.addEventListener('click', function(event) {
      copyFieldIban('kira-karsi-iban');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-171");
    if (!el) return;
    el.addEventListener('click', function(event) {
      copyFieldIban('kira-karsi-iban-manuel');
    });
  })();
  (function(){
    var el = document.getElementById("kira-step-cancel-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kira');
    });
  })();
  (function(){
    var el = document.getElementById("kira-step-back-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kiraStepBack();
    });
  })();
  (function(){
    var el = document.getElementById("kira-step-next-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kiraStepNext();
    });
  })();
  (function(){
    var el = document.getElementById("kira-step-save-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveKira();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-172");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-maas');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-173");
    if (!el) return;
    el.addEventListener('click', function(event) {
      copyMaasHesapIban();
    });
  })();
  (function(){
    var el = document.getElementById("maas-kt-toggle");
    if (!el) return;
    el.addEventListener('click', function(event) {
      toggleKtMode('maas');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-174");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openMiniKisiPopup(this,'maas-kisi');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-175");
    if (!el) return;
    el.addEventListener('click', function(event) {
      copyFieldIban('maas-karsi-iban');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-176");
    if (!el) return;
    el.addEventListener('click', function(event) {
      copyFieldIban('maas-karsi-iban-manuel');
    });
  })();
  (function(){
    var el = document.getElementById("maas-step-cancel-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-maas');
    });
  })();
  (function(){
    var el = document.getElementById("maas-step-back-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      maasStepBack();
    });
  })();
  (function(){
    var el = document.getElementById("maas-step-next-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      maasStepNext();
    });
  })();
  (function(){
    var el = document.getElementById("maas-step-save-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveMaas();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-177");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kontrat-plan');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-178");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kontratPlanYilDegistir(-1);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-179");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kontratPlanYilDegistir(1);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-180");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kontratPlanBugune();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-181");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kontratPlanFormKapat();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-182");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kontratPlanFormKaydet();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-183");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-hesap');
    });
  })();
  (function(){
    var el = document.getElementById("hesap-step-cancel-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-hesap');
    });
  })();
  (function(){
    var el = document.getElementById("hesap-step-back-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      hesapStepBack();
    });
  })();
  (function(){
    var el = document.getElementById("hesap-step-next-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      hesapStepNext();
    });
  })();
  (function(){
    var el = document.getElementById("hesap-step-save-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveHesap();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-184");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kisi');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-185");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kisiIbanEkle();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-186");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kisi');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-187");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveKisi();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-188");
    if (!el) return;
    el.addEventListener('click', function(event) {
      _ibanPopupKapat(true);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-189");
    if (!el) return;
    el.addEventListener('click', function(event) {
      _ibanPopupEkle();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-190");
    if (!el) return;
    el.addEventListener('click', function(event) {
      _ibanPopupKapat(true);
    });
  })();
  (function(){
    var el = document.getElementById("iban-popup-tamam-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      _ibanPopupKapat(false);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-191");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-elden');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-192");
    if (!el) return;
    el.addEventListener('click', function(event) {
      copyEldenHesapIban();
    });
  })();
  (function(){
    var el = document.getElementById("elden-kt-toggle");
    if (!el) return;
    el.addEventListener('click', function(event) {
      toggleKtMode('elden');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-193");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openMiniKisiPopup(this,'elden-kisi');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-194");
    if (!el) return;
    el.addEventListener('click', function(event) {
      copyEldenKarsiIban();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-195");
    if (!el) return;
    el.addEventListener('click', function(event) {
      copyEldenKarsiIban();
    });
  })();
  (function(){
    var el = document.getElementById("elden-step-cancel-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-elden');
    });
  })();
  (function(){
    var el = document.getElementById("elden-step-back-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      eldenStepBack();
    });
  })();
  (function(){
    var el = document.getElementById("elden-step-next-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      eldenStepNext();
    });
  })();
  (function(){
    var el = document.getElementById("elden-step-save-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveElden();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-196");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-hesap-tur');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-197");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-hesap-tur');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-198");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveHesapTur();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-199");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-banka');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-200");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-banka');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-201");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveBanka();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-202");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-sube');
    });
  })();
  (function(){
    var el = document.getElementById("sube-kaydet-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveSubeForm();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-203");
    if (!el) return;
    el.addEventListener('click', function(event) {
      document.getElementById('sube-yeni-kod').value='';document.getElementById('sube-yeni-ad').value='';document.getElementById('sube-edit-orig-kod').value='';document.getElementById('sube-kaydet-btn').textContent='Ekle';
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-204");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-sube');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-205");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-urun-tip');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-206");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-urun-tip');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-207");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveUrunTip();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-208");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kredi-tip');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-209");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kredi-tip');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-210");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveKrediTip();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-211");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kart-altyapi');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-212");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kart-altyapi');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-213");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveKartAltyapi();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-214");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-tatil');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-215");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-tatil');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-216");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveTatil();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-217");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-confirm');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-218");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-confirm');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-219");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kart-odeme');
    });
  })();
  (function(){
    var el = document.getElementById("kart-odeme-tutar-tum-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kartOdemeTutarTumunuKullan();
    });
  })();
  (function(){
    var el = document.getElementById("kart-odeme-kalan-tamamini-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kartOdemeKalanTamaminiDoldur();
    });
  })();
  (function(){
    var el = document.getElementById("kart-odeme-step-cancel-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kart-odeme');
    });
  })();
  (function(){
    var el = document.getElementById("kart-odeme-step-back-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kartOdemeStepBack();
    });
  })();
  (function(){
    var el = document.getElementById("kart-odeme-step-next-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      kartOdemeStepNext();
    });
  })();
  (function(){
    var el = document.getElementById("kart-odeme-step-save-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveKartOdeme();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-220");
    if (!el) return;
    el.addEventListener('click', function(event) {
      openAbonelikModal();
    });
  })();
  (function(){
    var el = document.getElementById("mini-kisi-backdrop");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeMiniKisiPopup();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-221");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeMiniKisiPopup();
    });
  })();
  (function(){
    var el = document.getElementById("mkp-search-clear");
    if (!el) return;
    el.addEventListener('click', function(event) {
      document.getElementById('mkp-search').value='';mkpFilterList('');document.getElementById('mkp-search').focus();
    });
  })();
  (function(){
    var el = document.getElementById("mkp-add-toggle");
    if (!el) return;
    el.addEventListener('click', function(event) {
      mkpToggleAddForm();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-222");
    if (!el) return;
    el.addEventListener('click', function(event) {
      mkpToggleAddForm();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-223");
    if (!el) return;
    el.addEventListener('click', function(event) {
      mkpSaveKisi();
    });
  })();
  (function(){
    var el = document.getElementById("mobile-sidebar-backdrop");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeMobileSidebar();
    });
  })();
  (function(){
    var el = document.getElementById("mob-more-backdrop");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeMobMore();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-224");
    if (!el) return;
    el.addEventListener('click', function(event) {
      mobNavGo('kartlar',this,'💳','Kartlar');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-225");
    if (!el) return;
    el.addEventListener('click', function(event) {
      mobNavGo('islemler',this,'⇄','İşlemler');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-226");
    if (!el) return;
    el.addEventListener('click', function(event) {
      mobNavGo('extreler',this,'🧾','Ekstreler');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-227");
    if (!el) return;
    el.addEventListener('click', function(event) {
      mobNavGo('kira',this,'🏠','Kira');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-228");
    if (!el) return;
    el.addEventListener('click', function(event) {
      mobNavGo('maas',this,'💰','Maaş');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-229");
    if (!el) return;
    el.addEventListener('click', function(event) {
      mobNavGo('elden',this,'💵','Elden');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-230");
    if (!el) return;
    el.addEventListener('click', function(event) {
      mobNavGo('kmhkredi',this,'🏦','KMH');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-231");
    if (!el) return;
    el.addEventListener('click', function(event) {
      mobNavGo('kredi',this,'📋','Kredi');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-232");
    if (!el) return;
    el.addEventListener('click', function(event) {
      mobNavGo('mevduat',this,'💎','Mevduat');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-233");
    if (!el) return;
    el.addEventListener('click', function(event) {
      mobNavGo('hesaplar',this,'🏧','Hesaplar');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-234");
    if (!el) return;
    el.addEventListener('click', function(event) {
      mobNavGo('ekstreeslestir',this,'🔗','İşlem Eşleştir');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-235");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeMobMore();openTransferModal();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-236");
    if (!el) return;
    el.addEventListener('click', function(event) {
      mobNavGo('abonelik',this,'🔄','Abonelik');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-237");
    if (!el) return;
    el.addEventListener('click', function(event) {
      mobNavGo('tanimlamalar',this,'⚙️','Ayarlar');
    });
  })();
  (function(){
    var el = document.getElementById("mob-theme-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      toggleTheme();updateMobThemeBtn();closeMobMore();
    });
  })();
  (function(){
    var el = document.getElementById("mobnav-ozet");
    if (!el) return;
    el.addEventListener('click', function(event) {
      mobNavGo('ozet',this,'📊','Özet');
    });
  })();
  (function(){
    var el = document.getElementById("mobnav-more");
    if (!el) return;
    el.addEventListener('click', function(event) {
      toggleMobMore();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-238");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-abonelik');
    });
  })();
  (function(){
    var el = document.getElementById("ab-step-cancel-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-abonelik');
    });
  })();
  (function(){
    var el = document.getElementById("ab-step-back-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      abStepBack();
    });
  })();
  (function(){
    var el = document.getElementById("ab-step-next-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      abStepNext();
    });
  })();
  (function(){
    var el = document.getElementById("ab-step-save-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveAbonelik();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-239");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-transfer');
    });
  })();
  (function(){
    var el = document.getElementById("transfer-log-filtre-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      call('openTransferLogFiltrePopup', this);
    });
  })();
  (function(){
    var el = document.getElementById("transfer-swap-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      swapTransferHesaplar();
    });
  })();
  (function(){
    var el = document.getElementById("transfer-tutar-tum-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      transferTutarTumunuKullan();
    });
  })();
  (function(){
    var el = document.getElementById("transfer-step-cancel-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-transfer');
    });
  })();
  (function(){
    var el = document.getElementById("transfer-step-back-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      transferStepBack();
    });
  })();
  (function(){
    var el = document.getElementById("transfer-step-next-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      transferStepNext();
    });
  })();
  (function(){
    var el = document.getElementById("transfer-step-save-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      call('saveTransfer');
    });
  })();
  (function(){
    var el = document.getElementById("hesap-log-duzelt-btn");
    if (!el) return;
    el.addEventListener('click', function(event) {
      _hesapLogDuzeltAc();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-240");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-hesap-log');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-241");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-hesap-log');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-242");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-bakiye-duzelt');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-243");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-bakiye-duzelt');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-244");
    if (!el) return;
    el.addEventListener('click', function(event) {
      saveBakiyeDuzelt();
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-245");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kategori-oneri');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-246");
    if (!el) return;
    el.addEventListener('click', function(event) {
      katOneriSelectAll(true);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-247");
    if (!el) return;
    el.addEventListener('click', function(event) {
      katOneriSelectAll(false);
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-248");
    if (!el) return;
    el.addEventListener('click', function(event) {
      closeModal('modal-kategori-oneri');
    });
  })();
  (function(){
    var el = document.getElementById("rf-oc-249");
    if (!el) return;
    el.addEventListener('click', function(event) {
      katOneriEkleSecili();
    });
  })();
});
