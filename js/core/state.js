import { loadData } from './app-core-base.js';
import { loadFormatConfig } from './format.js';
import { loadCurrencyConfig } from '../ui/pages/tanimlamalar/06-para-birimi.js';
// ============================================================
// js/core/state.js — Paylaşılan çekirdek modül state'i
// NOT: Bilinçli olarak IIFE'ye SARILMIYOR. DB/FORMAT_CONFIG/CURRENCY_CONFIG/
// defaultCurrency/ALL_CURRENCIES/BANKA_SUBELER birden çok dosyada "bare"
// isimle (window. öneki olmadan) okunup yazılıyor. Düz top-level script
// olarak kalınca `var X = ...` otomatik olarak gerçek bir global (window.X)
// haline geliyor — IIFE içine alınsaydı bu isimler dosya kapsamına
// hapsolur ve diğer dosyalardaki cross-file referanslar (loadData/
// applyMigrations/loadCurrencyConfig/loadFormatConfig içindeki DB,
// FORMAT_CONFIG erişimleri) ReferenceError verirdi.
// ============================================================

// localStorage artık yalnızca gdrive_client_id ve gdrive_token için kullanılır.
// Tüm finans verisi Google Drive'da saklanır.

// ========== BANKA ŞUBE VERİSİ ==========
// Yapı: { [ibanKod]: [{k: subeKodu, a: subeAdi}, ...] }
// Şube verisi yüklendiğinde bu nesneye eklenir; tanımsız bırakılırsa uygulama çöker.

// ==== Sadece bu dosyada kullanılan yerel state ====
export var BANKA_SUBELER = {};

// ==== Paylaşılan (2+ dosyada kullanılan) modül state'i ====
// CURRENCY_CONFIG ve defaultCurrency, DB=loadData() çağrılmadan ÖNCE
// tanımlanmalı; çünkü loadData() -> applyMigrations() bunları
// (ve FORMAT_CONFIG'i) bare isimle okuyup yazabiliyor.
export var CURRENCY_CONFIG = {};

// defaultCurrency = para birimi tanımsız hesaplar için varsayılan
export var defaultCurrency = 'TRY'; // Drive'dan yüklenir, localStorage kullanılmaz

// ========== GÖRÜNTÜ AYARLARI ==========
export var FORMAT_CONFIG = {
  tarihFormat: 'dd/MM/yyyy',
  saatFormat: 'HH:mm',
  ondalikAyrac: ',',
  binlikAyrac: '.',
  ondalikBasamak: '2',
  tarihGirisKolay: true   // ayraçsız tarih girişi (010125 → 01/01/2025)
};

// Para birimi seçme chip grid'ini render et
export var ALL_CURRENCIES = [];

// ==== Paylaşılan (2+ dosyada kullanılan) modül state'i — burada kalıyor ====
export var DB = loadData();

// DEFAULT_CURRENCY_CONFIG ve DB tanımlandıktan sonra yükle
loadCurrencyConfig();

loadFormatConfig();

// [ES module] DB/CURRENCY_CONFIG/FORMAT_CONFIG/ALL_CURRENCIES gibi paylaşılan
// state'ler, orijinal kodda bazı yerlerde TAMAMEN YENİ bir obje/array ile
// değiştiriliyordu (örn. `DB = applyMigrations(gelen);`). ES module'de import
// edilen bir binding'e böyle yeniden atama yapılamaz (canlı bağlama salt
// okunurdur). Davranışı korumak için: obje/array KİMLİĞİNİ sabit tutup
// içeriğini temizleyip yeni içerikle dolduran bir yardımcı kullanılıyor —
// dışarıdaki (başka dosyalardaki) tüm `DB`/`CURRENCY_CONFIG` referansları
// aynı objeye bakmaya devam ediyor, sadece içerik değişiyor. Kullanım:
// `replaceObjectContents(DB, applyMigrations(gelen))` — eski `DB = ...` yerine.
export function replaceObjectContents(target, source) {
  if (Array.isArray(target)) {
    target.length = 0;
    if (Array.isArray(source)) target.push(...source);
    return target;
  }
  for (const k of Object.keys(target)) delete target[k];
  if (source && typeof source === 'object') Object.assign(target, source);
  return target;
}

// [ES module] defaultCurrency bir primitive (string) - obje gibi mutate
// edilemez. Import eden dosyalar `import { defaultCurrency }` ile canlı
// (live) bağlama alır ve güncel değeri otomatik görür, AMA sadece BU dosya
// (state.js) içinden yapılan atamalarla güncellenebilir - başka bir dosya
// `defaultCurrency = ...` yazamaz (salt okunur import). Bu yüzden değeri
// değiştirmesi gereken tek dosya (06-para-birimi.js) bu setter'ı kullanır.
export function setDefaultCurrency(v) {
  defaultCurrency = v;
}

// [ES module] Bu dosyada tanımlanan aşağıdaki değişkenler başka dosyalarda
// yeniden atanıyordu (import edilen bir binding'e doğrudan atama ES
// module'de yasaktır). Bu setter fonksiyonları o davranışı korumak için
// eklendi - ilgili dosyalar artık `X = v` yerine `setX(v)` çağırıyor.
export function setFORMAT_CONFIG(v) { FORMAT_CONFIG = v; }
