// ============================================================
// js/ui/pages/kartlar/00-state.js
// Kartlar modülü — paylaşılan durum (shared state)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/kartlar.js (145
// export, 3600+ satır) dosyasının, fonksiyon isim/işlev
// kümelerine göre bölünmüş bir parçasıdır. Kod SATIR SATIR
// AYNI kaldı — sadece dosya sınırı ve gruplama değişti.
// ============================================================
// Orijinal 02-core-app-engine.js içinden çıkarıldı. İçerik değiştirilmedi.

// ==== 02-core-app-engine.js'den taşınan modül state'i ====
// Kart için renk: kullanıcı özel renk seçmemişse (renk:''/null = "Otomatik"),
// kartın listedeki sırasına göre sabit bir paletten otomatik & birbirinden farklı renk ata.
export var KART_RENK_PALET = ['#4f8ef7','#10d98a','#f0a429','#f05454','#9b7ef8','#f472b6','#22d3ee','#fb7185','#a3e635','#64748b'];
// ── Kart Modal: Step Wizard ──────────────────────────────────────────
export var _kartCurrentStep = 1;
export var KART_STEP_COUNT = 5;
// ── Ortak Limit Grubu yönetim modalı ──────────────────────────────
export var _editGrupId = null;
export var _kdActiveTab = 'islem';
export var _kdAcikExtreDonem = null;export var _kdIslemArama = '';export var _kdIslemKatFiltre = null;export var _kdExtreKatFiltre = null;export var _kd2ExtreKatFiltre = null;// kdRenderKatBar/kdKatFiltreToggle ortak bileşeni hangi bağlamda render edildiğini bilmeli ki
// tıklama doğru state'i güncelleyip doğru (görünür) listeyi yeniden çizsin.
// Olası değerler: 'kd-islem' (modal işlem), 'kd2-islem' (tam sayfa işlem), 'kd-extre' (modal ekstre), 'kd2-extre' (tam sayfa ekstre)
export var _kdKatBarCtx = 'kd-islem';
export var KD_KAT_PALET = ['var(--gold)', 'var(--teal)', 'var(--violet)', 'var(--sky)', 'var(--rose)', '#34d399', '#f472b6', '#facc15'];
// [KALDIRILDI] _kdKatAraState — ölü kategori arama widget'ının state'iydi (ölü kod taraması, 2026-07).
export var _kd2ActiveTab = 'islem';
export var _kd2IslemArama = '';
export var _kd2IslemKatFiltre = null;
export var _kd2AcikExtreDonem = null;
// ========== KART BORÇ ÖDEME ==========
export var _kartOdemeKalanBorc = 0;
// ── Kart Ödeme Modal: Step Wizard ──────────────────────────────────────
export var _kartOdemeCurrentStep = 1;
export var KART_ODEME_STEP_COUNT = 3;
// ========== KART ALTYAPILARI CRUD ==========
export var editKartAltyapiId = null;

// [ES module] Bu dosyada tanımlanan aşağıdaki değişkenler başka dosyalarda
// yeniden atanıyordu (import edilen bir binding'e doğrudan atama ES
// module'de yasaktır). Bu setter fonksiyonları o davranışı korumak için
// eklendi - ilgili dosyalar artık `X = v` yerine `setX(v)` çağırıyor.
export function set_kd2IslemKatFiltre(v) { _kd2IslemKatFiltre = v; }
export function set_kdExtreKatFiltre(v) { _kdExtreKatFiltre = v; }
export function set_kd2ExtreKatFiltre(v) { _kd2ExtreKatFiltre = v; }
export function set_kdIslemKatFiltre(v) { _kdIslemKatFiltre = v; }
export function set_kd2IslemArama(v) { _kd2IslemArama = v; }
export function set_kd2AcikExtreDonem(v) { _kd2AcikExtreDonem = v; }
export function set_kdIslemArama(v) { _kdIslemArama = v; }
export function set_kdActiveTab(v) { _kdActiveTab = v; }
export function set_kdKatBarCtx(v) { _kdKatBarCtx = v; }
export function set_kdAcikExtreDonem(v) { _kdAcikExtreDonem = v; }
export function set_kd2ActiveTab(v) { _kd2ActiveTab = v; }
export function set_kartCurrentStep(v) { _kartCurrentStep = v; }
export function set_editGrupId(v) { _editGrupId = v; }
export function set_kartOdemeCurrentStep(v) { _kartOdemeCurrentStep = v; }
export function set_kartOdemeKalanBorc(v) { _kartOdemeKalanBorc = v; }
export function setEditKartAltyapiId(v) { editKartAltyapiId = v; }
