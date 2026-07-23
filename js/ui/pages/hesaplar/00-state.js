// ============================================================
// js/ui/pages/hesaplar/00-state.js
// Hesaplar modülü — paylaşılan durum
//
// Bu dosya, eskiden tek parça olan js/ui/pages/hesaplar.js
// (49 export, 991 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
// Orijinal 02-core-app-engine.js içinden çıkarıldı. İçerik değiştirilmedi.

// ==== 02-core-app-engine.js'den taşınan modül state'i ====
// ========== HESAP TÜRLERİ CRUD ==========
export var editHesapTurId = null;
// ── Hesap Modal: Step Wizard ──────────────────────────────────────────
export var _hesapCurrentStep = 1;
export var HESAP_STEP_COUNT = 5;
export var HESAP_DURUM_BADGE = {
  aktif:  'badge-green',
  pasif:  'badge-warn',
  kapali: 'badge-red'
};

// [ES module] Bu dosyada tanımlanan aşağıdaki değişkenler başka dosyalarda
// yeniden atanıyordu (import edilen bir binding'e doğrudan atama ES
// module'de yasaktır). Bu setter fonksiyonları o davranışı korumak için
// eklendi - ilgili dosyalar artık `X = v` yerine `setX(v)` çağırıyor.
export function setEditHesapTurId(v) { editHesapTurId = v; }
export function set_hesapCurrentStep(v) { _hesapCurrentStep = v; }
