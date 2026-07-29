import { _pushHashState } from '@core/init.js';
import { inject } from '@core/container.js';
const _gdrive = inject('services.gdrive');
const _format = inject('core.format');
const _coreState = inject('core.state');
const _doviz = inject('domain.doviz');
const _wrapRegistry = inject('core.wrapRegistry');
// [BUG FIX] render-core.js importu BİLİNÇLİ OLARAK yukarıdaki const
// atamalarından SONRAYA taşındı. Sebep: render-core.js -> 03-kart-detay-ortak.js
// -> state.js döngüsü, state.js'in loadData() (top-level, senkron) çağrısını
// tetikliyor; bu da defaultKartAltyapilari() üzerinden bu dosyanın (kendi
// modülü içindeki) _format sabitini kullanmaya çalışıyor. import ifadeleri
// dosyada nerede yazılırsa yazılsın motor onları YAZILIŞ SIRASINA göre
// evaluate eder (hoisting sadece binding görünürlüğünü etkiler, yan etki
// sırasını değil) — bu yüzden render-core.js importu satır 2'deyken, henüz
// _format (eski satır 5) tanımlanmadan state.js'in loadData() zinciri
// _format'a erişip "Cannot access '_format' before initialization" TDZ
// hatası veriyordu. Artık _format vb. tüm inject() sabitleri tanımlandıktan
// SONRA render-core.js import ediliyor; aynı döngü yine oluşur ama bu kez
// _format zaten hazır olduğu için sorun çıkmaz.
import { renderPage } from '@core/render-core.js';
import { openModal } from '@components/modal-genel.js';
import { refreshDateOverlays } from '@components/mobile-nav-tema/05-tarih-input-overlay.js';
import { renderKisilerGrid } from '@components/kisiler.js';
import { closeMobileSidebar, mobNavRenderDynSlots, mobNavSyncActive } from '@components/mobile-nav-tema/01-mobil-nav.js';
import { snavMobileClose } from '@components/mobile-side-nav.js';
import { bindMoneyInputs } from '@components/money-input.js';
import { ALTYAPI_LOGOLAR, applyChipsToContainer } from '@components/select-to-chips.js';
import { asgariKosulTurChange, asgariOnizle, renderAsgariCurGrid, renderAsgariEsikPbSelect, renderAsgariKurallar } from '@pages/asgari-odeme.js';
import { populateEldenHesapSelect, populateEldenKisiSelect } from '@pages/elden.js';
import { renderHesapTurFiltreler } from '@pages/hesaplar/04-hesap-liste-render.js';
import { kartDetayGeriDon } from '@pages/kartlar/03-kart-detay-ortak.js';
import { renderNakitAvansCurGrid, renderNakitAvansLimitKural, renderNakitAvansTavanlar } from '@pages/krediler/02-nakit-avans.js';
import { renderOzet } from '@pages/ozet.js';
import { populateKategoriSelects } from '@pages/tanimlamalar/03-kategoriler.js';
import { renderTumOranTablolari } from '@pages/tanimlamalar/05-genel-oran-tablolari.js';
import { loadCurrencyConfig, updateParaBirimiPreview } from '@pages/tanimlamalar/06-para-birimi.js';
import { renderVeriYonetimiOzet, renderYerelYedekDurumu } from '@pages/veri-yonetimi.js';
// Bu dosya, temel tanımları içerir (loadData/applyMigrations/defaultData/
// saveData/showPage/renderAll/showTab). Bu tanımlar diğer dosyaların
// (kartlar.js, odeme.js, mobile-nav-tema.js gibi) üzerlerine wrap
// kurabilmesi için index.html'de erken pozisyonda, diğer core
// dosyalarının hemen ardına, tüm domain/ui dosyalarından önce yüklenir.
// js/core/app-core.js'deki genel amaçlı wrap/iyileştirme fonksiyonları
// ise kasıtlı olarak GEÇ pozisyonunda — onlar tam tersine, her şeyin
// (renderKartlar, tblSiralamaAyarla, vb.) zaten tanımlı olmasına ihtiyaç
// duyuyor.

// Orijinal çekirdek motor dosyasından çıkarılan fonksiyonları içerir.
// İçerik değiştirilmeden taşındı.

// loadData: Başlangıçta boş veri döner. Gerçek veri Drive bağlandıktan sonra async yüklenir.

// ==== 02-core-app-engine.js'den taşınan modül state'i ====
// ========== NAV ==========
export var PAGE_TITLES = {
  ozet: 'Finansal Özet', kartlar: 'Kredi Kartları', islemler: 'İşlemler',
  extreler: 'Ekstre Görünümü', mevduat: 'Mevduat Takibi', kira: 'Kira Gelirleri & Giderleri',
  maas: 'Maaş Geliri', kmhkredi: 'KMH Taksitli Kredi', kredi: 'Bireysel Krediler',
  elden: 'Elden Ödemeler', hesaplar: 'Banka Hesapları', tanimlamalar: 'Tanımlamalar',
  abonelik: 'Abonelikler & Tekrarlayan Ödemeler'
};
// [ES module] index.html'deki sidebar nav-btn id'lerini sayfa adına eşler.
// Eskiden nav butonu bulmak için onclick attribute içeriği okunuyordu; onclick
// temizliği sonrası HTML'de bu attribute yok, bu yüzden sabit bir harita
// kullanılıyor (bkz. onclick-bootstrap.js'deki aynı id'ler). showPage() ve
// mobNavGo() (mobile-nav-tema/01-mobil-nav.js) ikisi de bunu kullanır.
export var NAV_BTN_ID_BY_PAGE = {
  ozet: 'rf-oc-1', kartlar: 'rf-oc-2', islemler: 'nav-islemler',
  extreler: 'nav-extreler', ekstreeslestir: 'nav-ekstreeslestir',
  mevduat: 'rf-oc-3', hesaplar: 'rf-oc-4', kira: 'rf-oc-5',
  maas: 'rf-oc-6', elden: 'rf-oc-7', abonelik: 'rf-oc-8',
  kmhkredi: 'rf-oc-9', kredi: 'rf-oc-10', tanimlamalar: 'rf-oc-11'
};
// [ES module] Mobil "Daha fazla" menüsündeki (.mob-more-item) butonların
// id->sayfa eşlemesi (bkz. onclick-bootstrap.js'deki window.mobNavGo çağrıları).
export var MOB_MORE_ITEM_ID_BY_PAGE = {
  kartlar: 'rf-oc-224', islemler: 'rf-oc-225', extreler: 'rf-oc-226',
  kira: 'rf-oc-227', maas: 'rf-oc-228', elden: 'rf-oc-229',
  kmhkredi: 'rf-oc-230', kredi: 'rf-oc-231', mevduat: 'rf-oc-232',
  hesaplar: 'rf-oc-233', ekstreeslestir: 'rf-oc-234'
};
export var gSaveTimer    = null;
export function loadData() {
  // Standalone test/restored build. Önce yerel kayıt, yoksa bu dosyaya gömülü
  // yüklenen yedek veri kullanılır; böylece dosya tek başına açıldığında da veri dolu gelir.
  try {
    const raw = localStorage.getItem('finans_local_db_v90');
    if(raw) return applyMigrations(JSON.parse(raw));
  } catch(e) {}

  try {
    const el = document.getElementById('rf-v90-embedded-restore-data');
    if(el && el.textContent && el.textContent.trim()) return applyMigrations(JSON.parse(el.textContent));
  } catch(e) {
    console.warn('Gömülü yedek veri okunamadı:', e);
  }

  return defaultData();
}

// applyMigrations: Drive'dan gelen veriyi yükle
export function applyMigrations(d) {
  if(!d) return defaultData();

  // ── Eksik alanları varsayılanlarla tamamla (eski Drive verilerinde
  //    bulunmayan diziler/objeler için _coreState.DB.xxx undefined olmasın) ───────────
  d = {...defaultData(), ...d};

  // ── _coreState.FORMAT_CONFIG ve para birimi Drive verisinden uygula ─────────────────
  if(d._formatConfig) _coreState.setFORMAT_CONFIG({..._coreState.FORMAT_CONFIG, ...d._formatConfig});
  if(d._currency)     _coreState.setDefaultCurrency(d._currency);

  // ── Kredi kartı altyapısı tanımları yoksa varsayılanları ekle ────────────
  if(!d.kartAltyapilari || !d.kartAltyapilari.length) {
    d.kartAltyapilari = defaultKartAltyapilari();
  }

  // ── Logo özelliğinden önce oluşturulmuş altyapı kayıtlarına (Visa/Mastercard/
  //    Troy vb.) kod eşleşmesine göre hazır logo ata — kullanıcı elle seçmek
  //    zorunda kalmasın diye ─────────────────────────────────────────────────
  (d.kartlar||[]).forEach(k => { if(!k.durum) k.durum = 'aktif'; });

  if (d.kartAltyapilari && d.kartAltyapilari.length && typeof ALTYAPI_LOGOLAR !== 'undefined') {
    d.kartAltyapilari.forEach(a => {
      if (!a.logo && a.kod) {
        const eslesen = ALTYAPI_LOGOLAR.find(l => l.id === String(a.kod).toLowerCase().replace(/\s+/g, ''));
        if (eslesen && eslesen.svg) a.logo = eslesen.svg;
      }
    });
  }

  // ── UI filtre tercihleri eksikse/yarımsa varsayılanlarla tamamla ─────────
  d.uiFiltreler = {
    islemler: { kart:'', ay:'', taksit:'', q:'', ...(d.uiFiltreler && d.uiFiltreler.islemler) },
    extreler: { kart:'', durum:'', ...(d.uiFiltreler && d.uiFiltreler.extreler) },
    // Kredi kartları sayfası: arama + durum filtresi kalıcı _coreState.DB tercihi
    kartlar: { q:'', arama:'', durum:'', status:'', ...(d.uiFiltreler && d.uiFiltreler.kartlar) },
    // Özet sayfası: Gelecek Tahmini Bakiye periyodu (gün) + Yaklaşan Ödemeler & Gelirler periyodu (gün)
    ozet: { tahminGun: 365, odemelerGun: 30, ...(d.uiFiltreler && d.uiFiltreler.ozet) },
    // Mevduat sayfası durum filtresi ('' = Tümü / aktif / yaklasiyor / bitti) + banka filtresi
    mevduat: { durum:'', banka:'', ...(d.uiFiltreler && d.uiFiltreler.mevduat) },
    // Banka Hesapları sayfası tür filtresi ('' = Tümü / hesap türü kodu / 'kmh')
    hesaplar: { tur:'', ...(d.uiFiltreler && d.uiFiltreler.hesaplar) },
    // Kira sayfası: tür filtresi ('' = Tümü/gelir/gider) + ödeme durumu filtresi (çoklu seçim dizi)
    kira: { tur:'', durum:[], ...(d.uiFiltreler && d.uiFiltreler.kira) },
    // Maaş sayfası: tür filtresi ('' = Tümü/surekli/tekseferlik) + ödeme durumu filtresi (çoklu seçim dizi)
    maas: { tur:'', durum:[], ...(d.uiFiltreler && d.uiFiltreler.maas) },
    // Elden Ödeme sayfası: tür filtresi ('' = Tümü/gelir/gider) + ödeme durumu filtresi (çoklu seçim dizi)
    elden: { tur:'', durum:[], ...(d.uiFiltreler && d.uiFiltreler.elden) },
    // Abonelikler sayfası: kategori filtresi + ödeme durumu filtresi (çoklu seçim dizi)
    abonelik: { kategori:'', durum:[], ...(d.uiFiltreler && d.uiFiltreler.abonelik) },
    // KMH Kredi sayfası: durum filtresi (çoklu seçim dizi — aktif/tamamlandı)
    kmhkredi: { durum:[], ...(d.uiFiltreler && d.uiFiltreler.kmhkredi) },
    // Bireysel Krediler sayfası: tür filtresi ('' = Tümü/ihtiyaç/konut/taşıt/diğer) + durum filtresi (çoklu seçim dizi)
    kredi: { tur:'', durum:[], ...(d.uiFiltreler && d.uiFiltreler.kredi) },
    // Tanımlamalar → Kategoriler sekmesi tür filtresi ('' = Tümü / gelir / gider)
    kategoriler: { tur:'', ...(d.uiFiltreler && d.uiFiltreler.kategoriler) },
    // Tanımlamalar → Asgari Ödeme Kuralları listesi para birimi filtresi (null = Tümü)
    asgariKurallari: { pb:null, ...(d.uiFiltreler && d.uiFiltreler.asgariKurallari) },
    // Kart detayı İşlemler sekmesi sıralama tercihi (tarih-yeni/tarih-eski/tutar-buyuk/tutar-kucuk)
    kartIslem: { sirala:'tarih-yeni', ...(d.uiFiltreler && d.uiFiltreler.kartIslem) },
    // Aylık Gelir / Gider / Bakiye ay detay popup sıralama tercihi — _coreState.DB/Drive'da saklanır
    tbkAyDetay: { sirala:'tur-ozel', ...(d.uiFiltreler && d.uiFiltreler.tbkAyDetay) },
    // Son transfer geçmişi filtreleri — hesap/nakit popup filtresi + yapılabilirlik durumu
    transferLog: { filtre:[], status:'', ...(d.uiFiltreler && d.uiFiltreler.transferLog) },
    // "Hesap Seç / Kişi Seç" gibi arama popup'larındaki liste sıralama tercihi
    scPopupSiralama: (d.uiFiltreler && d.uiFiltreler.scPopupSiralama) || 'none'
  };

  // ── Sayfa ziyaret sayaçları: Drive'dan geldiyse koru, yoksa boş obje ──────
  if(!d.navStats || typeof d.navStats !== 'object') d.navStats = {};

  // ── Bakiye uyarıları: kalıcı "yoksay" listesi (Drive'a senkron olur, oturum/cihaz
  //    değişse de dismiss edilen uyarılar tekrar çıkmaz) ─────────────────────
  if(!Array.isArray(d.bakiyeUyariGizli)) d.bakiyeUyariGizli = [];

  // ── Tahmini Bakiye ayarları (vade yenileme varsayımı aç/kapa + gelecek faiz
  //    oranı varsayımları) — eski kayıtlarda yoksa varsayılanla tamamla ────────
  if(!d.tahminAyarlari || typeof d.tahminAyarlari !== 'object') d.tahminAyarlari = { vadeliYenile: true };
  if(typeof d.tahminAyarlari.vadeliYenile !== 'boolean') d.tahminAyarlari.vadeliYenile = true;
  if(!Array.isArray(d.gelecekFaizOranlari)) d.gelecekFaizOranlari = [];

  return d;
}

export function defaultKartAltyapilari() {
  // ALTYAPI_LOGOLAR (Visa/Mastercard/Troy/Amex hazır SVG logoları) daha sonra
  // tanımlanıyor ama bu fonksiyon her zaman runtime'da çağrıldığı için erişilebilir.
  const logoOf = (id) => (typeof ALTYAPI_LOGOLAR !== 'undefined' ? (ALTYAPI_LOGOLAR.find(l => l.id === id) || {}).svg : null) || undefined;
  return [
    {id: _format.uid(), ad: 'Visa', kod: 'VISA', logo: logoOf('visa')},
    {id: _format.uid(), ad: 'Mastercard', kod: 'MASTERCARD', logo: logoOf('mastercard')},
    {id: _format.uid(), ad: 'Troy', kod: 'TROY', logo: logoOf('troy')},
    {id: _format.uid(), ad: 'American Express', kod: 'AMEX', logo: logoOf('amex')}
  ];
}

export function saveData() {
  // Drive senkronu aynen korunur; ayrıca standalone/test kullanımında veri kaybolmasın
  // diye güvenli local fallback tutulur. localStorage kapalıysa sessiz geçilir.
  try { localStorage.setItem('finans_local_db_v90', JSON.stringify(_coreState.DB)); } catch(e) {}

  _gdrive.setGDirty(true);
  if (typeof _gdrive.gDriveReady === 'function' && _gdrive.gDriveReady()) {
    clearTimeout(gSaveTimer);
    gSaveTimer = setTimeout(() => _gdrive.gDriveSaveNow(), 1500);
  }
}
// [ES module] taban tanım, odeme/patches zincirinin hook/wrap edebilmesi
// için wrap-registry'ye kaydediliyor.
_wrapRegistry.register('saveData', saveData);

export function defaultData() {
  return {
    bankalar: [], hesapTurleri: [], urunTipler: [], krediTipleri: [], kartAltyapilari: defaultKartAltyapilari(),
    tatiller: [], kartlar: [], islemler: [], mevduatlar: [], kiralar: [],
    maaslar: [], eldenler: [], ozelExtreler: [], krediler: [],
    bireyselKrediler: [], paraBirimleri: [], kategoriler: [], abonelikler: [],
    stopajOranlari: [], kkdfOranlari: [], bsmvOranlari: [], kmhFaizOranlari: [], gecikmeFaizOranlari: [],
    hesaplar: [], subeler: {}, kisiler: [],
    asgariOdemeKurallari: [],
    kartOdemeleri: [],
    ekstreKayitlari: [],   // {id, kartId, donemKey, kesinlestirildi, kesinlesmeTarih}
    ortakLimitGruplari: [],
    nakitAvansCurlar: [],
    nakitAvansTavanlar: [],
    nakitAvansLimitTip: 'kullanilabilir',
    nakitAvansMaxOran: 50,
    snapshots: {},
    uiFiltreler: { islemler: { kart:'', ay:'', taksit:'', q:'' }, extreler: { kart:'', durum:'' }, kartlar: { q:'', arama:'', durum:'', status:'' }, ozet: { tahminGun: 365, odemelerGun: 30 }, mevduat: { durum:'', banka:'' }, hesaplar: { tur:'' }, kira: { tur:'', durum:[] }, maas: { tur:'', durum:[] }, elden: { tur:'', durum:[] }, abonelik: { kategori:'', durum:[] }, kmhkredi: { durum:[] }, kredi: { tur:'', durum:[] }, kategoriler: { tur:'' }, asgariKurallari: { pb:null }, kartIslem: { sirala:'tarih-yeni' }, tbkAyDetay: { sirala:'tur-ozel' }, transferLog: { filtre:[], status:'' }, scPopupSiralama: 'none' },
    bakiyeUyariGizli: [],
    navStats: {},  // sayfa ziyaret sayaçları (Drive'a kaydedilir, mobil footer dinamik slotlar için)
    // TCMB döviz kurları — her gün otomatik çekilir (bkz. tcmbKurlariniGuncelle)
    tcmbKur: { tarih: null, guncellendi: null, sonKontrol: null, kurlar: {} },
    // Günlük TCMB kur geçmişi: [{tarih:'YYYY-MM-DD', guncellendi, kurlar:{KOD:{alis,satis,isim}}}, ...]
    // tarihe göre artan sırada — geçmişe dönük servet/dönüşüm hesaplarında kullanılır (bkz. getTcmbKur)
    // Tahmini Bakiye projeksiyonunda vadeli hesap yenilemelerinde (vade sonunda otomatik
    // tekrar vadeye yatırıldığı varsayılan turlarda) kullanılacak ileriye dönük faiz oranı
    // varsayımları: [{id, gecerlilikTarihi:'YYYY-MM-DD', oran:number}]. Girilmezse mevduatın
    // kendi güncel oranı kullanılmaya devam eder (bkz. tahminGelecekBakiyeHesapla).
    gelecekFaizOranlari: [],
    // Tahmini Bakiye projeksiyonunda vade sonu yeniden yatırım (yenileme) varsayımının
    // dinamik olarak açılıp kapatılabilmesini sağlayan ayar. Kapalıysa hiçbir mevduat
    // projeksiyonda "yeniden vadeye yatırıldı" varsayılmaz — sadece gerçek/ilk vade
    // sonu faizi hesaba katılır (bkz. tahminGelecekBakiyeHesapla, openTbkAyarModal).
    tahminAyarlari: { vadeliYenile: true },
    tcmbKurGecmis: []
  };
}

export function updateSidebarKartNav() {
  const hasKart = _coreState.DB.kartlar && _coreState.DB.kartlar.length > 0;
  const navIslemler = document.getElementById('nav-islemler');
  const navExtreler = document.getElementById('nav-extreler');
  if(navIslemler) navIslemler.style.display = hasKart ? '' : 'none';
  if(navExtreler) navExtreler.style.display = hasKart ? '' : 'none';
}

// ─────────────────────────────────────────────────────────────

function showPageBase(id, btn) {
  // İşlem Eşleştir artık ayrı bir sayfa değil, hangi sayfadaysan onun üzerinde açılan bir
  // popup (modal). Mevcut sayfadan ayrılmadan (kart detayı dahil) üstte açılır.
  if (id === 'ekstreeslestir') {
    if (!document.querySelector('.page.active')) showPageBase('ozet', null);
    openModal('modal-eslestir');
    return;
  }
  // Menüden "Kredi Kartları"na tıklandığında, kart detay görünümündeysek
  // (aynı 'kartlar' sayfası içinde liste/detay geçişi yapıldığı için) listeye
  // geri dönmemiz lazım — yoksa detay açık kalıp hiçbir şey olmuyormuş gibi görünüyordu.
  if (id === 'kartlar') {
    const detayView = document.getElementById('kartlar-detay-view');
    if (detayView && detayView.style.display !== 'none') {
      kartDetayGeriDon();
    }
  }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const pageEl = document.getElementById('page-'+id);
  if(!pageEl) return;
  pageEl.classList.add('active');
  if(btn) {
    btn.classList.add('active');
  } else {
    // btn verilmemişse (hash-routing veya programatik showPage çağrısı) nav
    // butonunu id'den bul ve aktifle. [ES module] Bkz. NAV_BTN_ID_BY_PAGE
    // tanımı (bu dosyanın başında) — onclick temizliği sonrası HTML'de
    // onclick attribute'u kalmadığı için sabit id haritası kullanılıyor.
    const navBtnId = NAV_BTN_ID_BY_PAGE[id];
    const navBtn = navBtnId ? document.getElementById(navBtnId) : null;
    if(navBtn) navBtn.classList.add('active');
  }
  // Topbar icon + label update
  const _navIcons = {ozet:'⊹',kartlar:'💳',islemler:'⇄',extreler:'🧾',mevduat:'◆',hesaplar:'⊙',kira:'🏠',maas:'◑',elden:'◇',kmhkredi:'▸',kredi:'▪',tanimlamalar:'⚙',abonelik:'↻'};
  const iconEl = document.getElementById('topbar-icon');
  const labelEl = document.getElementById('topbar-label');
  if(iconEl && _navIcons[id]) iconEl.textContent = _navIcons[id];
  if(labelEl) labelEl.textContent = PAGE_TITLES[id] || id;
  // URL hash güncelle — sadece sayfa adını yaz, alt-state (tab/kart) kendi fonksiyonları yazar
  _pushHashState(id, {});
  // Mobile/Tablet: close sidebar, sync bottom nav
  if(window.innerWidth <= 1024) {
    if(typeof closeMobileSidebar === 'function') closeMobileSidebar();
  }
  if(window.innerWidth <= 768) {
    const _mobMain = ['ozet','kartlar','islemler','extreler'];
    document.querySelectorAll('.mob-nav-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.mob-more-item').forEach(b=>b.classList.remove('active'));
    // Mobil footer active durumunu güncelle (dinamik slotlar dahil)
    if(typeof mobNavSyncActive === 'function') mobNavSyncActive(id);
  }
  renderPage(id);
}

export function renderAll() {
  // Tüm populate/select'leri güncelle
  loadCurrencyConfig();
  _doviz.populateCurrencySelects();
  populateKategoriSelects();
  populateEldenHesapSelect();
  populateEldenKisiSelect();
  renderHesapTurFiltreler();
  updateSidebarKartNav();

  // Drive'dan navStats geldikten sonra footer dinamik slotları yeniden hesapla
  if(typeof mobNavRenderDynSlots === 'function') mobNavRenderDynSlots(false);

  // Aktif sayfayı render et
  const activePage = document.querySelector('.page.active');
  const activeId = activePage ? activePage.id.replace('page-', '') : 'ozet';
  renderPage(activeId);

  // Özet her zaman güncel kalsın
  if(activeId !== 'ozet') renderOzet();

  // Vergi & Faiz tabloları her zaman yenile (_coreState.FORMAT_CONFIG tarih formatı)
  if(activeId !== 'tanimlamalar') renderTumOranTablolari();

  // Date overlay'leri _coreState.FORMAT_CONFIG ile yenile
  refreshDateOverlays();
}

/* renderPage() burada tanımlıydı — artık ölü kod; aktif tanım js/core/render-core.js'de (export function renderPage + _wrapRegistry.register('renderPage', ...) ile wrap-registry üzerinden çağrılıyor). */

export function showTab(id, btn) {
  // Hide all tab content inside snav-content
  document.querySelectorAll('#snav-content > div[id^="tab-"]').forEach(d=>d.style.display='none');
  const tabEl = document.getElementById(id);
  if(tabEl) tabEl.style.display='block';

  // Update snav-item active state
  document.querySelectorAll('.snav-item').forEach(b=>b.classList.remove('active'));
  if(btn && btn.classList.contains('snav-item')) {
    btn.classList.add('active');
  } else {
    const snavBtn = document.querySelector(`.snav-item[data-tab="${id}"]`);
    if(snavBtn) snavBtn.classList.add('active');
  }

  // Update mobile header title
  const activeItem = document.querySelector(`.snav-item[data-tab="${id}"]`);
  const titleEl = document.getElementById('snav-mobile-title');
  if(titleEl && activeItem) {
    const name = activeItem.querySelector('.snav-name');
    titleEl.textContent = name ? name.textContent : '';
  }

  // Close mobile sidebar if open
  snavMobileClose();

  _pushHashState('tanimlamalar', {tab: id});
  if(id==='tab-para-birimi' || id==='tab-para-birimi-yonetim') {
    _doviz.populateCurrencySelects();
  }
  if(id==='tab-goruntu-ayarlari') {
    _doviz.populateCurrencySelects();
    updateParaBirimiPreview();
    _format.loadGoruntuAyarlariUI();
  }
  if(id==='tab-kisiler') {
    renderKisilerGrid();
  }
  if(id==='tab-asgari-odeme') {
    renderAsgariKurallar();
    renderAsgariCurGrid();
    renderAsgariEsikPbSelect();
    asgariKosulTurChange();
    bindMoneyInputs(document.getElementById('tab-asgari-odeme'));
    if(!_coreState.ALL_CURRENCIES.length) _doviz.rebuildAllCurrencies();
    const pbSel = document.getElementById('asgari-prev-pb');
    if(pbSel) {
      pbSel.innerHTML = _coreState.ALL_CURRENCIES.map(c=>`<option value="${c.code}">${c.code}${c.symbol && c.symbol!==c.code ? ' · '+c.symbol : ''}</option>`).join('');
      pbSel.value = _coreState.defaultCurrency;
    }
    asgariOnizle();
  }
  if(id==='tab-nakit-avans') {
    renderNakitAvansCurGrid();
    renderNakitAvansTavanlar();
    renderNakitAvansLimitKural();
  }
  if(id==='tab-veri-yonetimi') {
    renderVeriYonetimiOzet();
    renderYerelYedekDurumu();
  }
  // Tab içeriği render edildikten sonra chip dönüşümünü uygula (ga-*, asgari-kosul-op, nakit-avans-limit-tip vb.)
  if (typeof applyChipsToContainer === 'function' && tabEl) {
    setTimeout(() => applyChipsToContainer(tabEl), 30);
  }
}

// showPage'in taban (base) davranışı yukarıda `showPageBase` olarak tanımlı.
// render-core.js (installRenderOverrides → stableShowPage) ve
// mobile-nav-tema/01-mobil-nav.js bunu ek davranışlarla (sidebar kapatma,
// mobil nav senkronu, "sayfa boş görünüyor mu" tekrar denemesi vb.) sarmalar.
// ES module export'ları immutable binding olduğu için `export function
// showPage(){}` ismini doğrudan yeniden atayarak wrap etmek mümkün değil;
// bunun yerine mutable bir pointer (_currentShowPage) tutuyoruz. Wrap etmek
// isteyen modüller setShowPage(...) ile pointer'ı güncelleyip, buradan export
// edilen `showPage` her zaman en güncel pointer'ı çağırır.
let _currentShowPage = showPageBase;

export function setShowPage(fn) {
  if (typeof fn !== 'function') throw new Error('setShowPage(fn): fn bir fonksiyon olmalı.');
  _currentShowPage = fn;
}

export function getShowPage() {
  return _currentShowPage;
}

export function showPage(id, btn) {
  return _currentShowPage(id, btn);
}

// ============================================================
// [DI-MIGRATION] core.appCoreBase — container'a kayıt
// ============================================================
import { provide } from '@core/container.js';
provide('core.appCoreBase', {
  PAGE_TITLES, NAV_BTN_ID_BY_PAGE, MOB_MORE_ITEM_ID_BY_PAGE, loadData,
  applyMigrations, defaultKartAltyapilari, saveData, defaultData,
  updateSidebarKartNav, renderAll, showTab, setShowPage, getShowPage,
  showPage,
  get gSaveTimer() { return gSaveTimer; },
});

