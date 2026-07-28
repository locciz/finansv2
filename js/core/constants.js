// ============================================================
// js/core/constants.js — Uygulama genelinde kullanılan sabitler
// ============================================================
// AMAÇ: Kod içinde tekrar tekrar elle yazılan durum/tip string'lerini
// (örn. 'aktif', 'gider', 'havale') tek bir yerden yönetilebilir hale
// getirmek. Böylece bir değer değiştiğinde (örn. 'kapali' yerine
// 'kapandi' kullanmak istersen) SADECE bu dosyada değiştirmen yeterli
// olur; her yerde arama-değiştirme yapmana gerek kalmaz.
//
// ÖNEMLİ — DEĞERLERİ DEĞİŞTİRME:
// Bu sabitlerin DEĞERLERİ (sağ taraftaki string'ler), kullanıcının
// localStorage/Drive'da halihazırda kayıtlı verisiyle birebir eşleşiyor.
// Örn. eski bir hesap kaydında durum: "aktif" yazıyorsa, DURUM.AKTIF'in
// değeri de "aktif" OLMAK ZORUNDA. Bu dosyadaki bir değeri değiştirirsen
// eski kayıtlar artık eşleşmez ve veri "bozulmuş" gibi görünür.
// -> Yeni bir durum eklemek serbest, ama var olanların STRING DEĞERİNİ
//    değiştirmeden önce bir migration (applyMigrations içinde) yazman gerekir.
//
// KULLANIM:
//   import { DURUM, ISLEM_TUR, ODEME_YONTEM } from '@core/constants.js';
//   if (hesap.durum === DURUM.AKTIF) { ... }
//   kayit.tur = ISLEM_TUR.GIDER;
//
// Bu dosya, mevcut kodu tek seferde değiştirmek yerine KADEMELİ geçiş
// içindir: yeni yazılan/dokunulan kod bloklarında sabitleri kullan,
// eski 'aktif' gibi literal string'ler hâlâ çalışmaya devam eder çünkü
// değerler birebir aynı.

// ---------- Genel varlık durumu (hesap, kart, mevduat vb.) ----------
export const DURUM = {
  AKTIF: 'aktif',
  KAPALI: 'kapali',
};

// ---------- Ödeme / taksit / kira / maaş / elden kaydı durumu ----------
export const ODEME_DURUM = {
  BEKLIYOR: 'bekliyor',
  ODENDI: 'odendi',
  GECIKTI: 'gecikti',
  KISMI: 'kismi',
  ERTELENDI: 'ertelendi',
  IPTAL: 'iptal',
};

// ---------- Gelir / gider / diğer (kategori ve işlem türü) ----------
export const ISLEM_TUR = {
  GELIR: 'gelir',
  GIDER: 'gider',
  DIGER: 'diger',
};

// ---------- Ödeme yöntemi ----------
export const ODEME_YONTEM = {
  HAVALE: 'havale',
  NAKIT: 'nakit',
};

// ---------- Hesap türü ----------
export const HESAP_TUR = {
  VADESIZ: 'vadesiz',
  VADELI: 'vadeli',
};

// ---------- Kredi ürün kategorisi (sayfa/menü ayrımı için) ----------
export const KREDI_TIP = {
  KMH: 'kmh',
  KREDI: 'kredi',
};

// ---------- Sıralama yönü (uiSiralama / uiFiltreler için) ----------
export const SIRALAMA_YON = {
  ASC: 'asc',
  DESC: 'desc',
};

// ---------- Sıklık / tekrar türü (maaş vb.) ----------
export const TEKRAR_TUR = {
  SUREKLI: 'surekli',
  TEK_SEFERLIK: 'tekseferlik',
};

// Filtrelerde sık kullanılan "aktif ödeme durumları" grubu — birden çok
// sayfada (kira/maas/elden/abonelik) aynı varsayılan liste tekrarlanıyordu.
export const AKTIF_ODEME_DURUMLARI = [
  ODEME_DURUM.BEKLIYOR,
  ODEME_DURUM.GECIKTI,
  ODEME_DURUM.KISMI,
  ODEME_DURUM.ERTELENDI,
  ODEME_DURUM.IPTAL,
];

// hesap-entegrasyon-motoru.js içinde 3 farklı fonksiyonda (KMH, depozito,
// bireysel kredi) birebir aynı şekilde tekrarlanan "henüz ödenmemiş sayılır,
// bakiyeye yansıtma" durum grubu.
export const BEKLEMEDE_SAYILAN_DURUMLAR = [
  ODEME_DURUM.BEKLIYOR,
  ODEME_DURUM.IPTAL,
  ODEME_DURUM.ERTELENDI,
  ODEME_DURUM.GECIKTI,
];

// Aynı 3 fonksiyonda kullanılan "ödendi/kısmi ödendi" durum grubu.
export const ODENMIS_SAYILAN_DURUMLAR = [
  ODEME_DURUM.ODENDI,
  ODEME_DURUM.KISMI,
];

// ============================================================
// [DI-MIGRATION] core.constants — container'a kayıt
// ============================================================
import { provide } from '@core/container.js';
provide('core.constants', {
  DURUM, ODEME_DURUM, ISLEM_TUR, ODEME_YONTEM, HESAP_TUR, KREDI_TIP,
  SIRALAMA_YON, TEKRAR_TUR, AKTIF_ODEME_DURUMLARI, BEKLEMEDE_SAYILAN_DURUMLAR,
  ODENMIS_SAYILAN_DURUMLAR,
});
