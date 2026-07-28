// ============================================================
// js/ui/pages/odeme/00-state.js
// Ödeme modülü — paylaşılan durum (modal state)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/odeme.js
// (52 export, 2097 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
// Orijinal 02-core-app-engine.js içinden çıkarıldı. İçerik değiştirilmedi.

// ==== 02-core-app-engine.js'den taşınan modül state'i ====
// od-modal-bg 'modal-bg' class'ına sahip değil (diğer modallardan bağımsız
// dinamik popup), bu yüzden closeModal()'daki "başka modal açık mı" kontrolüne
// dahil olmuyor. Bir modal İÇİNDEN açılıp kapandığında (bkz. satır ~1481)
// ownership flag'i olmadan body.classList.remove('modal-open') şartsız
// çalışırsa, arkadaki asıl modal hâlâ açıkken scroll kilidi erken kalkıyor ve
// sayfa mobilde en başa fırlıyordu. sc-search-popup'taki gibi ownership takibi.
export var _odModalOwnsBodyLock = false;
export var _odModalSuspendedByTransfer = false;
// ── Ödeme durumu popup'ında hesap seçimi — artık diğer her yerdeki gibi (banka/kart/hesap
// seçimleriyle tutarlı) aranabilir tam ekran popup üzerinden açılıyor.
export var _odHesapPopupHesaplar = [];

// [ES module] Bu dosyada tanımlanan aşağıdaki değişkenler başka dosyalarda
// yeniden atanıyordu (import edilen bir binding'e doğrudan atama ES
// module'de yasaktır). Bu setter fonksiyonları o davranışı korumak için
// eklendi - ilgili dosyalar artık `X = v` yerine `setX(v)` çağırıyor.
export function set_odModalSuspendedByTransfer(v) { _odModalSuspendedByTransfer = v; }
export function set_odModalOwnsBodyLock(v) { _odModalOwnsBodyLock = v; }
export function set_odHesapPopupHesaplar(v) { _odHesapPopupHesaplar = v; }

// ==== DUAL-MODE CONTAINER KAYDI ====
import { provide } from "@core/container.js";
import * as _self from "./00-state.js";
provide("ui.pages.odemeState", _self);
