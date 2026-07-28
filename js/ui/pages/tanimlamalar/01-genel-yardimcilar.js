// ============================================================
// js/ui/pages/tanimlamalar/01-genel-yardimcilar.js
// [FAZ 1 REFACTOR] Bu dosyanın içeriği @domain/tanim-yardimcilar.js'e
// taşındı (saf/yan-etkisiz fonksiyonlar). Burada sadece geriye dönük
// uyumluluk için re-export var — mevcut importlar kırılmasın diye.
// Yeni kod yazarken doğrudan @domain/tanim-yardimcilar.js'den import edin.
// ============================================================
export {
  getTatilSet,
  tanimRenkAl,
  urunTipiRenk,
  paraBirimiRenk,
  bankaLogoByKod,
  bankaIkonObj,
  bankaOptionMetin,
  getHesapTurLabel,
  getHesapTurBadge,
  getHesapTurDotIkon,
  getBanka,
  _tanimBadgeHtml,
  _renkKolonHtml,
} from '@domain/tanim-yardimcilar.js';

// ==== DUAL-MODE CONTAINER KAYDI ====
import { provide } from '@core/container.js';
import * as _self from './01-genel-yardimcilar.js';
provide('ui.pages.tanimlamalarGenelYardimcilar', _self);
