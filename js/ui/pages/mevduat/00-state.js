// ============================================================
// js/ui/pages/mevduat/00-state.js
// Mevduat modülü — paylaşılan durum (wizard step, gizli aksiyonlar)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/mevduat.js
// (43 export, 1589 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
// Orijinal 02-core-app-engine.js içinden çıkarıldı. İçerik değiştirilmedi.

// ==== 02-core-app-engine.js'den taşınan modül state'i ====
// ── Mevduat Modal: Step Wizard ──────────────────────────────────────────
export var _mevCurrentStep = 1;
export var MEV_STEP_COUNT = 5;
export var editMevduatId = null;
export var _editMevduatEskiTutar = null;export var _mevGunlukMod = false;// Mevduat sayfası durum filtresi (çoklu seçim: aktif / yaklasiyor / bitti bir arada seçilebilir).
// Seçim DB.uiFiltreler.mevduat.durum içinde dizi olarak kalıcı saklanır (Drive'a senkronize edilir).
// Not: tblFiltreOkuMulti eski (tekli string) kayıtları da otomatik diziye çevirir, geriye dönük uyumlu.
export var MEVDUAT_DURUM_FILTRE_OPTS = [
  {value:'', label:'◆ Tümü'},
  {value:'aktif', label:'⚡ Aktif'},
  {value:'yaklasiyor', label:'⏰ Yaklaşıyor'},
  {value:'bitti', label:'✓ Bitti'}
];
export var _MEV_FILTRE_ETIKET = { aktif:'⚡ Aktif', yaklasiyor:'⏰ Yaklaşıyor', bitti:'✓ Bitti' };

// [ES module] Bu dosyada tanımlanan aşağıdaki değişkenler başka dosyalarda
// yeniden atanıyordu (import edilen bir binding'e doğrudan atama ES
// module'de yasaktır). Bu setter fonksiyonları o davranışı korumak için
// eklendi - ilgili dosyalar artık `X = v` yerine `setX(v)` çağırıyor.
export function set_mevCurrentStep(v) { _mevCurrentStep = v; }
export function setEditMevduatId(v) { editMevduatId = v; }
export function set_editMevduatEskiTutar(v) { _editMevduatEskiTutar = v; }
export function set_mevGunlukMod(v) { _mevGunlukMod = v; }

// ==== DUAL-MODE CONTAINER KAYDI ====
import { provide } from "@core/container.js";
import * as _self from "./00-state.js";
provide("ui.pages.mevduatState", _self);
