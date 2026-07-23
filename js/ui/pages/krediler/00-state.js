// ============================================================
// js/ui/pages/krediler/00-state.js
// Krediler modülü — paylaşılan durum (wizard step state'leri)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/krediler.js
// (87 export, 1700+ satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
// Orijinal 02-core-app-engine.js içinden çıkarıldı. İçerik değiştirilmedi.

// ==== 02-core-app-engine.js'den taşınan modül state'i ====
export var editNaId = null;
// ── Nakit Avans Modal: Step Wizard ──────────────────────────────────────
export var _naCurrentStep = 1;
export var NA_STEP_COUNT = 3;
export var editKmhKrediId = null;
// ── KMH Kredi Modal: Step Wizard ──────────────────────────────────────
export var _kmhKrediCurrentStep = 1;
export var KMHKREDI_STEP_COUNT = 4;
// KMH Kredi ve Bireysel Krediler sayfalarında ortak "Durum" filtresi (çoklu seçim:
// aktif / tamamlanmış bir arada seçilebilir). Seçim DB.uiFiltreler[sayfa].durum
// içinde dizi olarak kalıcı saklanır (Drive'a senkronize edilir, sonraki açılışta hatırlanır).
export var KREDI_DURUM_FILTRE_OPTS = [
  {value:'', label:'◆ Tümü'},
  {value:'aktif', label:'⚡ Aktif'},
  {value:'tamamlandi', label:'✓ Tamamlanmış'}
];
export var _KREDI_DURUM_ETIKET = { aktif:'⚡ Aktif', tamamlandi:'✓ Tamamlanmış' };
export var editKrediId = null;
// ── Kredi Modal: Step Wizard ──────────────────────────────────────────
export var _krediCurrentStep = 1;
export var KREDI_STEP_COUNT = 4;
// ========== KREDİ TİPLERİ CRUD ==========
export var editKrediTipId = null;
// Limit tipi/oran değiştikçe önizlemeyi güncelle ve geçerliyse sessizce kaydet
export var _naLimitAutoSaveTimer = null;

// [ES module] Bu dosyada tanımlanan aşağıdaki değişkenler başka dosyalarda
// yeniden atanıyordu (import edilen bir binding'e doğrudan atama ES
// module'de yasaktır). Bu setter fonksiyonları o davranışı korumak için
// eklendi - ilgili dosyalar artık `X = v` yerine `setX(v)` çağırıyor.
export function setEditNaId(v) { editNaId = v; }
export function set_naCurrentStep(v) { _naCurrentStep = v; }
export function set_naLimitAutoSaveTimer(v) { _naLimitAutoSaveTimer = v; }
export function setEditKmhKrediId(v) { editKmhKrediId = v; }
export function set_kmhKrediCurrentStep(v) { _kmhKrediCurrentStep = v; }
export function setEditKrediId(v) { editKrediId = v; }
export function set_krediCurrentStep(v) { _krediCurrentStep = v; }
export function setEditKrediTipId(v) { editKrediTipId = v; }
