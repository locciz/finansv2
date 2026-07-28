// ============================================================
// js/ui/pages/islemler/00-state.js
// İşlemler modülü — paylaşılan durum (filtre/modal state)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/islemler.js
// (49 export, 1087 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
// Orijinal 02-core-app-engine.js içinden çıkarıldı. İçerik değiştirilmedi.

// ==== 02-core-app-engine.js'den taşınan modül state'i ====
// ── Açıklama otomatik tamamlama & sık kullanılanlar ──────────────
// DB.islemler içindeki geçmiş açıklamaları sayar, her açıklama için
// en sık kullanıldığı kategoriyi (en son kullanılana göre) hatırlar.
// Bu kelimeleri içeren açıklamalar (örn. otomatik "Kart Ödemesi — Tem 2026" ya da
// hesaba/karta "aktarılan" tutar kayıtları) sık kullanılanlar/otomatik tamamlamada
// önerilmez — bunlar sistem tarafından üretilen, tekrar seçilmesi anlamsız kayıtlardır.
export var AC_ENGELLI_KELIMELER = ['aktarılan', 'kart ödemesi'];
// ── Provizyon tarihi öngörüsü ──────────────────────────────────
// Aynı karttaki geçmiş işlemlerden (provizyon tarihi girilmiş olanlardan)
// ortalama "provizyon - işlem tarihi" gün farkını hesaplar.
export var _islemProvizyonManuel = false;export var AY_KISA_TR = ['OCA','ŞUB','MAR','NİS','MAY','HAZ','TEM','AĞU','EYL','EKİ','KAS','ARA'];
export var AY_UZUN_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
export var GUN_UZUN_TR = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
// ── Dönem sekmeleri (Bu Dönem / Önceki Dönem / Tümü) ────────────────
export var _islemDonemTab = 'guncel';

// [ES module] Bu dosyada tanımlanan aşağıdaki değişkenler başka dosyalarda
// yeniden atanıyordu (import edilen bir binding'e doğrudan atama ES
// module'de yasaktır). Bu setter fonksiyonları o davranışı korumak için
// eklendi - ilgili dosyalar artık `X = v` yerine `setX(v)` çağırıyor.
export function set_islemProvizyonManuel(v) { _islemProvizyonManuel = v; }
export function set_islemDonemTab(v) { _islemDonemTab = v; }

// [ES module] Eskiden window._eeOnSaveHook ile tutulan tek-seferlik "işlem
// kaydedilince çalış" hook'u (ekstre eşleştirme importundan gelir, işlem
// modalı CRUD'u tarafından çağrılır). Doğrudan birbirini import etmeleri
// döngüsel bağımlılığa yol açacağı için (03-ekstre-eslestirme-pdf-import.js
// zaten 07-islem-modal-crud.js'i import ediyor) nötr bu state dosyasında
// tutuluyor; her iki taraf da buradan import eder.
export var _eeOnSaveHook = null;
export function set_eeOnSaveHook(fn) { _eeOnSaveHook = fn; }

// ==== DUAL-MODE CONTAINER KAYDI ====
import { provide } from "@core/container.js";
import * as _self from "./00-state.js";
provide("ui.pages.islemlerState", _self);
