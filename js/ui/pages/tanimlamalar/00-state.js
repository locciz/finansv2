// ============================================================
// js/ui/pages/tanimlamalar/00-state.js
// Tanımlamalar modülü — paylaşılan durum (para birimi varsayılanları vb.)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/tanimlamalar.js
// (81 export, 1440+ satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
// Orijinal 02-core-app-engine.js içinden çıkarıldı. İçerik değiştirilmedi.

// ==== 02-core-app-engine.js'den taşınan modül state'i ====
// ========== PARA BİRİMİ ==========
// Varsayılan para birimleri - DB'ye yüklenir
//
// kurKaynagi: her para biriminin kurunun NEREDEN çekileceğini belirler.
//   { tip: 'tcmb', tcmbKodu: 'USD' }                                  → TCMB günlük bülteni
//   { tip: 'ozel', url: '...', jsonPathAlis: '...', jsonPathSatis: '...', kurBirimi: 'TRY' } → herhangi bir JSON API
//   { tip: 'manuel' }                                                 → otomatik çekilmez, kur girilmez/sabit kalır
// (Not: 'tcmbKodu' alanı eski sürümlerle uyumluluk için ayrıca tutulur — loadCurrencyConfig içinde
//  kurKaynagi yoksa otomatik olarak {tip:'tcmb', tcmbKodu} biçimine çevrilir.)
export var DEFAULT_CURRENCY_CONFIG = {
  TRY: { symbol: '₺',  locale: 'tr-TR', position: 'prefix', ad: 'Türk Lirası',      flag: '🇹🇷', icon: '💵', tcmbKodu: null, kurKaynagi: { tip: 'manuel' } },
  USD: { symbol: '$',  locale: 'en-US', position: 'prefix', ad: 'Amerikan Doları',  flag: '🇺🇸', icon: '💵', tcmbKodu: 'USD', kurKaynagi: { tip: 'tcmb', tcmbKodu: 'USD' } },
  EUR: { symbol: '€',  locale: 'de-DE', position: 'suffix', ad: 'Euro',             flag: '🇪🇺', icon: '💶', tcmbKodu: 'EUR', kurKaynagi: { tip: 'tcmb', tcmbKodu: 'EUR' } },
  JPY: { symbol: '¥',  locale: 'ja-JP', position: 'prefix', decimals: 0, ad: 'Japon Yeni', flag: '🇯🇵', icon: '💴', tcmbKodu: 'JPY', kurKaynagi: { tip: 'tcmb', tcmbKodu: 'JPY' } },
  GBP: { symbol: '£',  locale: 'en-GB', position: 'prefix', ad: 'İngiliz Sterlini', flag: '🇬🇧', icon: '💷', tcmbKodu: 'GBP', kurKaynagi: { tip: 'tcmb', tcmbKodu: 'GBP' } },
  XAU: { symbol: 'XAU',locale: 'tr-TR', position: 'suffix', decimals: 4, ad: 'Altın (Troy Ons)', flag: '🥇', icon: '🥇', tcmbKodu: null,
    kurKaynagi: { tip: 'ozel', kaynaklar: [] }
  },
};
// ═══════════════════════════════════════════════════════════════
// ═══ TANIMLAMALAR RENK SİSTEMİ ════════════════════════════════
// Kartların otomatik renk mantığıyla (yukarıdaki KART_RENK_PALET/getKartRenk)
// birebir aynı prensip: bir tanım kaydı (ürün tipi, kredi tipi, kart altyapısı vb.)
// özel bir renk belirtmemişse (renk alanı boş/yok), listedeki sırasına göre sabit
// bir paletten otomatik ve birbirinden ayırt edilebilir bir renk atanır. Bu sayede
// aynı kayıt sistemin her yerinde (badge, chip, filtre vb.) hep aynı renkte görünür.
export var TANIM_RENK_PALET = ['#4f8ef7','#10d98a','#f0a429','#f05454','#9b7ef8','#f472b6','#22d3ee','#fb7185','#a3e635','#64748b'];
// Bilinen renk paleti (renk seç popup'ındaki 7 renk) için hex → Türkçe ad eşlemesi.
export var _RENK_ADLARI = {
  '#4f8ef7': 'Mavi', '#10d98a': 'Yeşil', '#f0a429': 'Altın',
  '#f05454': 'Kırmızı', '#9b7ef8': 'Mor', '#f472b6': 'Pembe', '#64748b': 'Gri',
};
export var subeModalBankaId = null;
export var subeListTumu = [];
export var editBankaId = null;
// Türkiye'deki 16 büyük bankayı (tam ad, kısa ad, IBAN kodu, logo) tek
// tıkla önceden tanımlı listeden ekler. IBAN koduyla zaten kayıtlı olanlar
// atlanır / logosu eksikse tamamlanır.
export var PRESET_BANKALAR = [
  { tam:'Türkiye Cumhuriyeti Ziraat Bankası A.Ş.', kisa:'Ziraat Bankası', ibanKod:'0010' },
  { tam:'Türkiye Vakıflar Bankası T.A.O.',          kisa:'VakıfBank',      ibanKod:'0015' },
  { tam:'Türkiye İş Bankası A.Ş.',                  kisa:'İş Bankası',     ibanKod:'0064' },
  { tam:'Türkiye Garanti Bankası A.Ş.',             kisa:'Garanti BBVA',   ibanKod:'0062' },
  { tam:'Akbank T.A.Ş.',                            kisa:'Akbank',         ibanKod:'0046' },
  { tam:'Türk Ekonomi Bankası A.Ş.',                kisa:'TEB',            ibanKod:'0032' },
  { tam:'QNB Bank A.Ş.',                            kisa:'QNB',            ibanKod:'0111' },
  { tam:'Denizbank A.Ş.',                           kisa:'DenizBank',      ibanKod:'0134' },
  { tam:'Yapı ve Kredi Bankası A.Ş.',               kisa:'Yapı Kredi',     ibanKod:'0067' },
  { tam:'Burgan Bank A.Ş.',                         kisa:'ON',             ibanKod:'0147' },
  { tam:'Enpara Bank A.Ş.',                         kisa:'Enpara',         ibanKod:'0157' },
  { tam:'Kuveyt Türk Katılım Bankası A.Ş.',         kisa:'Kuveyt Türk',    ibanKod:'0205' },
  { tam:'Aktif Yatırım Bankası A.Ş.',               kisa:'N Kolay',        ibanKod:'0143' },
  { tam:'ING Bank A.Ş.',                            kisa:'ING',            ibanKod:'0099' },
  { tam:'Colendi Bank A.Ş.',                        kisa:'ColendiBank',    ibanKod:'0158' },
  { tam:'Fibabanka A.Ş.',                           kisa:'Fibabanka',      ibanKod:'0106' },
];
export var editUrunTipId = null;
export var editTatilId = null;
// ========== PARA BİRİMİ YÖNETİMİ ==========
export var editParaBirimiKod = null;
// ── Para Birimi Modal: Step Wizard ──────────────────────────────────────
export var _pbCurrentStep = 1;
export var PB_STEP_COUNT = 3;
export var editKategoriId = null;
export var KAT_TUR_STIL = {
  gelir: { accent: 'var(--accent2)', glow: 'var(--accent2-glow)', etiket: '💹 Gelir' },
  gider: { accent: 'var(--danger)',  glow: 'var(--danger-glow)',  etiket: '💸 Gider' },
  diger: { accent: 'var(--text3)',   glow: 'rgba(125,142,170,.12)', etiket: '📦 Diğer' }
};
// ========== KATEGORİ ÖNERİLERİ / JSON İÇE-DIŞA AKTARMA ==========
// Sık kullanılan, hazır kategori önerileri (JSON). Sadece {ad, ikon, tur} alanları
// gerekli — id eklenirken otomatik üretilir. tur: 'gider' | 'gelir' | 'diger'
export var KAT_ONERILER = [
  { ad: "Market", ikon: "🛒", tur: "gider" },
  { ad: "Kira", ikon: "🏠", tur: "gider" },
  { ad: "Faturalar", ikon: "🧾", tur: "gider" },
  { ad: "Elektrik", ikon: "💡", tur: "gider" },
  { ad: "Su", ikon: "🚿", tur: "gider" },
  { ad: "Doğalgaz", ikon: "🔥", tur: "gider" },
  { ad: "İnternet", ikon: "🌐", tur: "gider" },
  { ad: "Telefon", ikon: "📱", tur: "gider" },
  { ad: "Ulaşım", ikon: "🚌", tur: "gider" },
  { ad: "Akaryakıt", ikon: "⛽", tur: "gider" },
  { ad: "Araç Bakım", ikon: "🔧", tur: "gider" },
  { ad: "Restoran / Dışarıda Yemek", ikon: "🍽️", tur: "gider" },
  { ad: "Kafe / Kahve", ikon: "☕", tur: "gider" },
  { ad: "Eğlence", ikon: "🎮", tur: "gider" },
  { ad: "Abonelikler", ikon: "🔄", tur: "gider" },
  { ad: "Sağlık", ikon: "💊", tur: "gider" },
  { ad: "Eczane", ikon: "💉", tur: "gider" },
  { ad: "Spor / Fitness", ikon: "🏋️", tur: "gider" },
  { ad: "Giyim", ikon: "👕", tur: "gider" },
  { ad: "Kişisel Bakım", ikon: "💇", tur: "gider" },
  { ad: "Eğitim", ikon: "🎓", tur: "gider" },
  { ad: "Kitap / Kırtasiye", ikon: "📚", tur: "gider" },
  { ad: "Çocuk Giderleri", ikon: "🧸", tur: "gider" },
  { ad: "Evcil Hayvan", ikon: "🐾", tur: "gider" },
  { ad: "Ev Eşyası", ikon: "🛋️", tur: "gider" },
  { ad: "Tatil / Seyahat", ikon: "✈️", tur: "gider" },
  { ad: "Hediye", ikon: "🎁", tur: "gider" },
  { ad: "Bağış", ikon: "🤝", tur: "gider" },
  { ad: "Sigorta", ikon: "🛡️", tur: "gider" },
  { ad: "Vergi", ikon: "📋", tur: "gider" },
  { ad: "Banka / İşlem Ücreti", ikon: "🏦", tur: "gider" },
  { ad: "Kredi Ödemesi", ikon: "💳", tur: "gider" },
  { ad: "Kira Geliri", ikon: "🏘️", tur: "gelir" },
  { ad: "Maaş", ikon: "💰", tur: "gelir" },
  { ad: "Ek Gelir / Yan İş", ikon: "🧑‍💻", tur: "gelir" },
  { ad: "Serbest Çalışma", ikon: "🧑‍🎨", tur: "gelir" },
  { ad: "Yatırım Geliri", ikon: "📈", tur: "gelir" },
  { ad: "Temettü", ikon: "💹", tur: "gelir" },
  { ad: "Faiz Geliri", ikon: "🏛️", tur: "gelir" },
  { ad: "Satış Geliri", ikon: "🏷️", tur: "gelir" },
  { ad: "İade / Geri Ödeme", ikon: "↩️", tur: "gelir" },
  { ad: "Hediye / Bahşiş Geliri", ikon: "🎉", tur: "gelir" },
  { ad: "Diğer", ikon: "📦", tur: "diger" }
];
export var HESAP_TUR_BADGE_LIST = ['badge-blue','badge-green','badge-warn','badge-purple','badge-teal',''];
export var HESAP_TUR_DOT_RENK_LIST = ['#7dd3fc','#5eead4','#fdba74','#c4b5fd','#5eead4','#94a3b8'];
// ========== VERGİ & FAİZ ORANLARI CRUD ==========
export var editOranTip = null;
export var editOranId  = null;
export var ORAN_CONFIG = {
  stopaj:   { label: 'Stopaj Oranı (%)', dbKey: 'stopajOranlari',  tbodyId: 'stopaj-tbody',  modalTitle: 'Stopaj Oranı' },
  kkdf:     { label: 'KKDF Oranı (%)',   dbKey: 'kkdfOranlari',    tbodyId: 'kkdf-tbody',    modalTitle: 'KKDF Oranı' },
  bsmv:     { label: 'BSMV Oranı (%)',   dbKey: 'bsmvOranlari',    tbodyId: 'bsmv-tbody',    modalTitle: 'BSMV Oranı' },
  kmhFaiz:  { label: 'Faiz Oranı (% Aylık)', dbKey: 'kmhFaizOranlari', tbodyId: 'kmhFaiz-tbody', modalTitle: 'KMH Aylık Faiz Oranı' },
  gecikmeFaiz: { label: 'Gecikme Faiz Oranı (% Aylık)', dbKey: 'gecikmeFaizOranlari', tbodyId: 'gecikmeFaiz-tbody', modalTitle: 'Gecikme Faiz Oranı' }
};

// [ES module] Bu dosyada tanımlanan aşağıdaki değişkenler başka dosyalarda
// yeniden atanıyordu (import edilen bir binding'e doğrudan atama ES
// module'de yasaktır). Bu setter fonksiyonları o davranışı korumak için
// eklendi - ilgili dosyalar artık `X = v` yerine `setX(v)` çağırıyor.
export function setEditKategoriId(v) { editKategoriId = v; }
export function setEditOranTip(v) { editOranTip = v; }
export function setEditOranId(v) { editOranId = v; }
export function setEditParaBirimiKod(v) { editParaBirimiKod = v; }
export function set_pbCurrentStep(v) { _pbCurrentStep = v; }
export function setEditBankaId(v) { editBankaId = v; }
export function setSubeModalBankaId(v) { subeModalBankaId = v; }
export function setSubeListTumu(v) { subeListTumu = v; }
export function setEditUrunTipId(v) { editUrunTipId = v; }
export function setEditTatilId(v) { editTatilId = v; }
