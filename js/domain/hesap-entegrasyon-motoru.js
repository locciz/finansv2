import { inject } from '@core/container.js';
const _coreState = inject('core.state');
const _hesaplamalar = inject('domain.hesaplamalar');
const _wrapRegistry = inject('core.wrapRegistry');
// core.appCoreBase, core.format, core.constants container'da kayıtlı
// (Tur 4) — bu turda çevrildi (DI-MIGRATION.md madde 5).
const _appCoreBase = inject('core.appCoreBase');
const saveData = (...a) => _appCoreBase.saveData(...a);
const showPage = (...a) => _appCoreBase.showPage(...a);
const _coreFormat = inject('core.format');
const fmtCur = (...a) => _coreFormat.fmtCur(...a);
const localDateStr = (...a) => _coreFormat.localDateStr(...a);
const _coreConstants = inject('core.constants');
// [BUG FIX] Önceden top-level'da _coreConstants.BEKLEMEDE_SAYILAN_DURUMLAR /
// ODENMIS_SAYILAN_DURUMLAR olarak anında okunuyordu — bu, inject()'in tembel
// (lazy) Proxy'sini modül evaluation sırasında senkron resolve() tetikleyerek
// boşa çıkarıyordu. Kullanım noktalarında çağrılan getter'lara çevrildi.
const getBeklemedeSayilanDurumlar = () => _coreConstants.BEKLEMEDE_SAYILAN_DURUMLAR;
const getOdenmisSayilanDurumlar = () => _coreConstants.ODENMIS_SAYILAN_DURUMLAR;
import { showToast } from '@components/modal-genel.js';
import { isEkstreKesinlesmis } from '@pages/ekstreler/01-ekstre-kesinlestirme.js';
import { getKart } from '@pages/kartlar/01-kart-data.js';
import { odBeklemedeMi, odKiraMaasOverride } from '@pages/odeme/01-genel-yardimcilar.js';
import { renderOzet } from '@pages/ozet.js';
import { renderHesaplar } from '@pages/hesaplar/04-hesap-liste-render.js';
import { editIslemId } from '@pages/islemler/03-islem-liste-render.js';
// ============================================================
// js/domain/hesap-entegrasyon-motoru.js
// İş mantığı: kira/maaş/elden/mevduat/KMH/kredi ödemelerinin hesap bakiyesine otomatik yansıtılması.
// [ES module geçişi] Orijinal kodda bu blok kendi (function(){...})() içine
// sarılıydı (closure izolasyonu için). ES module'e geçişte IIFE kaldırıldı
// çünkü her dosya zaten kendi module scope'una sahip — closure paylaşımı
// module scope ile korunuyor, davranış değişmedi. entKiraYansit, entMaasYansit
// vb. artık bu dosyanın module-level export'ları; tek public arayüz olan
// `window.entegre = {...}` nesnesi de aynen korundu (bkz. app-core.js:
// window.entegre.yenile() çağrısı).
// ============================================================
'use strict';

// ─── YARDIMCI: güvenli hesap bakiyesi güncelle ─────────────────────────────
export function _bakiyeDelta(hesapId, delta) {
  if (!hesapId || Math.abs(delta || 0) < 0.0001) return false;
  const h = (DB.hesaplar || []).find(x => x.id === hesapId);
  if (!h) return false;
  h.bakiye = Math.round(((h.bakiye || 0) + delta) * 1e6) / 1e6;
  return true;
}

// ─── Hesap seçilmemiş (nakit) kalemler için: DB._nakitBakiye üzerinde aynı
// mantıkla delta uygular. Böylece "Nakit (Nakit Bakiyesi)" seçili bir ödeme
// durumu değişikliği, gerçek hesap kadar tutarlı şekilde nakit bakiyeye yansır.
export function _nakitBakiyeDelta(pb, delta) {
  if (!pb || Math.abs(delta || 0) < 0.0001) return false;
  if (!DB._nakitBakiye) DB._nakitBakiye = {};
  DB._nakitBakiye[pb] = Math.round(((DB._nakitBakiye[pb] || 0) + delta) * 1e6) / 1e6;
  return true;
}

// ─── LOG: çift yansımayı önle ─────────────────────────────────────────────
// DB.entLog = { [logKey]: yansitilan_tutar }
// [BUG FIX] Bu fonksiyonlar eskiden doğrudan DB.entLog'a yazıyordu. abonelik.js
// (_rfAbonelikUnifyLogs) bunları register('_lGet', ...) vb. ile DB.odLog
// tabanlı bir implementasyonla override ediyor — ama o override sadece
// call('_lGet', ...) ile çağıranları etkiler. Bu dosyanın kendi gövdesindeki
// _lKey(...)/_lGet(...)/_lSet(...)/_lDel(...) çağrıları ES module scope'u
// yüzünden HER ZAMAN aşağıdaki lokal tanımlara bağlanıyordu (window'a atanan
// eski "son yazan kazanır" davranışı burada işlemiyordu), yani kira/maaş/
// elden/mevduat/KMH/kredi yansıtma mantığının tamamı odLog migration'ından
// habersiz kalıp sessizce DB.entLog'u kullanmaya devam ediyordu. Çözüm:
// lokal fonksiyonları registry'deki GÜNCEL (en dıştaki) katmana delege et.
function _lKey(tip, id, key) {
  return _wrapRegistry.call('_lKey', tip, id, key);
}
function _lGet(k)      { return _wrapRegistry.call('_lGet', k); }
function _lSet(k, v)   { return _wrapRegistry.call('_lSet', k, v); }
function _lDel(k)      { return _wrapRegistry.call('_lDel', k); }
export {
  _lKey as _lKey__hesap_entegrasyon_motoru,
  _lGet as _lGet__hesap_entegrasyon_motoru,
  _lSet as _lSet__hesap_entegrasyon_motoru
};
// [KALDIRILDI] "_lDel as _lDel__hesap_entegrasyon_motoru" export alias'ı hiçbir
// dosya tarafından import edilmiyordu (ölü kod taraması, 2026-07). _lDel
// fonksiyonunun kendisi ve _wrapRegistry.register('_lDel', ...) çağrısı hâlâ kullanımda,
// sadece bu isimlendirilmiş export gereksizdi.
// Taban implementasyonlar (abonelik.js henüz yüklenmediyse / override
// edilmeden önce _wrapRegistry.call('_lGet', ...) gibi çağrıların çalışabilmesi için)
// registry'ye ayrı isimlerle kaydediliyor ve yukarıdaki fonksiyonlar ilk
// yüklemede bu taban davranışa denk gelir.
function _lKeyBase(tip, id, key) {
  return `${tip}|${id}|${key != null ? key : '_'}`;
}
function _lGetBase(k)      { if (!_coreState.DB.entLog) _coreState.DB.entLog = {}; return _coreState.DB.entLog[k] != null ? _coreState.DB.entLog[k] : null; }
function _lSetBase(k, v)   { if (!_coreState.DB.entLog) _coreState.DB.entLog = {}; _coreState.DB.entLog[k] = v; }
function _lDelBase(k)      { if (!_coreState.DB.entLog) _coreState.DB.entLog = {}; delete _coreState.DB.entLog[k]; }
_wrapRegistry.register('_lKey', _lKeyBase);
_wrapRegistry.register('_lGet', _lGetBase);
_wrapRegistry.register('_lSet', _lSetBase);
_wrapRegistry.register('_lDel', _lDelBase);

// entKiraYansit, entMaasYansit ve entEldenYansit birebir aynı iskeleti
// kullanıyordu: durum bekliyor/iptal ise eski yansımayı geri al, odendi/kismi
// ise delta'yı hesaba/nakite uygula. Tek fark: kayıt hangi diziden bulunuyor,
// yön (yon) nasıl hesaplanıyor ve başarı mesajı ne. Ortak akış burada;
// her çağıran kendi "record bulucu + yön + mesaj" mantığını veriyor.
function _entKontratYansit(opts) {
  const kayit = opts.bul();
  if (!kayit) return;
  const isNakit = !kayit.hesapId;
  const pb = kayit.paraBirimi || _coreState.defaultCurrency || 'TRY';
  const lk = _lKey(opts.tip, opts.id, opts.anahtar);
  const eski = _lGet(lk) || 0;
  const yon = opts.yon(kayit);
  const uygula = (delta) => isNakit ? _nakitBakiyeDelta(pb, delta) : _bakiyeDelta(kayit.hesapId, delta);

  if (!opts.durum || ['bekliyor','ertelendi','gecikti'].includes(opts.durum)) {
    if (eski !== 0) { uygula(-eski * yon); _lDel(lk); _sync(); }
    return;
  }
  if (['iptal','atlandi'].includes(opts.durum)) {
    if (eski !== 0) { uygula(-eski * yon); _lDel(lk); _sync(); }
    return;
  }
  if (['odendi','kismi'].includes(opts.durum)) {
    const yeni = opts.tutar || 0;
    const delta = yeni - eski;
    if (Math.abs(delta) < 0.001) return;
    if (uygula(delta * yon)) { _lSet(lk, yeni); _sync(isNakit ? opts.mesajNakit : opts.mesajHesap); }
  }
}

// ─── KİRA: ödeme durumu değişince hesaba (ya da hesap seçili değilse nakit
// bakiyeye) yansıt ────────────────────────────────────────────────────────
export function entKiraYansit(kiraId, ayKey, durum, tutar) {
  _entKontratYansit({
    bul: () => (_coreState.DB.kiralar || []).find(x => x.id === kiraId),
    tip: 'kira', id: kiraId, anahtar: ayKey, durum, tutar,
    yon: (kira) => kira.tutar >= 0 ? 1 : -1, // gelir=+1 gider=-1
    mesajNakit: 'Kira nakit bakiyeye yansıtıldı',
    mesajHesap: 'Kira bakiyeye yansıtıldı'
  });
}

// ─── MAAŞ: ödeme durumu değişince hesaba (ya da nakit bakiyeye) yansıt ─────
export function entMaasYansit(maasId, ayKey, durum, tutar) {
  _entKontratYansit({
    bul: () => (_coreState.DB.maaslar || []).find(x => x.id === maasId),
    tip: 'maas', id: maasId, anahtar: ayKey, durum, tutar,
    yon: () => 1, // maaş her zaman gelir
    mesajNakit: 'Maaş nakit bakiyeye yansıtıldı',
    mesajHesap: 'Maaş bakiyeye yansıtıldı'
  });
}

// ─── ELDEN: ödeme durumu değişince hesaba (ya da nakit bakiyeye) yansıt ────
// Not: saveElden zaten anında günceller; bu fonksiyon od-popup üzerinden tetiklenir
export function entEldenYansit(eldenId, durum, tutar) {
  _entKontratYansit({
    bul: () => (_coreState.DB.eldenler || []).find(x => x.id === eldenId),
    tip: 'elden', id: eldenId, anahtar: null, durum, tutar,
    yon: (e) => e.tur === 'gelir' ? 1 : -1,
    mesajNakit: 'Elden nakit bakiyeye yansıtıldı',
    mesajHesap: 'Elden bakiyeye yansıtıldı'
  });
}

// ─── MEVDUAT: vade doldu → vadesiz hesaba aktar ───────────────────────────
export function entMevduatYansit(mevId, durum) {
  if (durum !== 'odendi') return;
  const m = (_coreState.DB.mevduatlar || []).find(x => x.id === mevId);
  if (!m) return;
  const lk = _lKey('mevduat', mevId, null);
  if (_lGet(lk) != null) return; // zaten yansıtıldı

  const strateji = m.strateji || 'tumu_vadesiz';
  // NOT: hedef HER ZAMAN vadesizHesapId olmalı — m.hesapId vadeli (kaynak) hesabın kendisidir,
  // buraya fallback yapılırsa para yanlışlıkla vadeli hesaba geri yazılıyordu (bkz. bildirilen hata:
  // "vadeli hesaptan vadesize aktarırken yanlış hesaba aktarıyor").
  const hedefId  = m.vadesizHesapId || null;
  let miktar = 0;

  if (strateji === 'tumu_vadesiz' && hedefId) {
    miktar = m.nihai || m.tutar || 0;
  } else if (strateji === 'yenile_ana_faiz_vadesiz' && hedefId) {
    miktar = m.faiz || 0;
  }

  const finalHedef = hedefId;
  if (miktar > 0.001 && finalHedef) {
    if (_bakiyeDelta(finalHedef, miktar)) {
      _lSet(lk, miktar);
      const hesapAd = ((_coreState.DB.hesaplar||[]).find(h=>h.id===finalHedef)||{}).ad || 'hesap';
      _sync(`Mevduat ${fmtCur(miktar, m.paraBirimi)} hesaba aktarıldı ✓`);
      setTimeout(()=>showToast(`\u{1F4B0} ${fmtCur(miktar, m.paraBirimi||'TRY')} \u2192 ${hesapAd} otomatik aktarıldı`, 4000), 400);
    }
  }
}

// ─── KMH KREDİ: taksit ödendi → KMH hesabı bakiyesi düşer ───────────────
export function entKmhYansit(krediId, taksitNo, durum, tutar) {
  const kr = (_coreState.DB.krediler || []).find(x => x.id === krediId);
  if (!kr || !kr.kmhId) return;
  const kmhKart = (_coreState.DB.kartlar || []).find(k => k.id === kr.kmhId) ||
                  (_coreState.DB.hesaplar || []).find(h => h.id === kr.kmhId);
  // Kullanıcı ödeme popup'ından farklı bir hesap seçtiyse (kr.odemeHesapId)
  // onu kullan; seçilmemişse varsayılan olarak KMH'nin kendi bağlı hesabı.
  const hesapId = kr.odemeHesapId || (kmhKart ? (kmhKart.hesapId || kr.kmhId) : null);
  if (!hesapId) return;

  const lk = _lKey('kmh', krediId, taksitNo);
  const eski = _lGet(lk) || 0;

  if (!durum || getBeklemedeSayilanDurumlar().includes(durum)) {
    if (eski !== 0) { _bakiyeDelta(hesapId, eski); _lDel(lk); _sync(); } // geri ver
    return;
  }
  if (getOdenmisSayilanDurumlar().includes(durum)) {
    const yeni = tutar || kr.aylikTaksit || 0;
    const delta = yeni - eski;
    if (Math.abs(delta) < 0.001) return;
    if (_bakiyeDelta(hesapId, -delta)) { _lSet(lk, yeni); _sync('KMH taksit ödendi — bakiye düşüldü'); }
  }
}

// ─── KİRA DEPOZİTO: verilme/alınma ('odeme') ve iade ('iade') bacaklarının
// hesaba yansıması. Yön kontratın kendi yönünü izler: kira geliri ise
// depozito da bize gelir (+), kira gideri ise depozito bizden çıkar (−).
// 'iade' bacağı bunun tam tersi yöndedir (para geri gider/gelir).
export function entDepozitoYansit(kiraId, key, durum, tutar) {
  const kira = (_coreState.DB.kiralar || []).find(x => x.id === kiraId);
  if (!kira) return;
  const hesapId = kira.depozitoHesapId || kira.hesapId || null;
  const isNakit = !hesapId;
  const pb = (kira.depozito && kira.depozito.paraBirimi) || kira.paraBirimi || _coreState.defaultCurrency || 'TRY';
  let yon = kira.tutar >= 0 ? 1 : -1;
  if (key === 'iade') yon = -yon;

  const lk = _lKey('depozito', kiraId, key);
  const eski = _lGet(lk) || 0;
  const uygula = (delta) => isNakit ? _nakitBakiyeDelta(pb, delta) : _bakiyeDelta(hesapId, delta);

  if (!durum || getBeklemedeSayilanDurumlar().includes(durum)) {
    if (eski !== 0) { uygula(-eski * yon); _lDel(lk); _sync(); }
    return;
  }
  if (getOdenmisSayilanDurumlar().includes(durum)) {
    const yeni = (tutar !== undefined && tutar !== null) ? tutar : ((kira.depozito && kira.depozito.tutar) || 0);
    const delta = yeni - eski;
    if (Math.abs(delta) < 0.001) return;
    if (uygula(delta * yon)) {
      _lSet(lk, yeni);
      _sync(key === 'iade' ? 'Depozito iade edildi — bakiye güncellendi' : 'Depozito alındı/verildi — bakiye güncellendi');
    }
  }
}
export function entKrediYansit(krediId, taksitNo, durum, tutar) {
  const kr = (_coreState.DB.bireyselKrediler || []).find(x => x.id === krediId);
  if (!kr) return;
  const isNakit = !kr.hesapId;
  const pb = kr.paraBirimi || kr.paraBirimleri?.[0] || _coreState.defaultCurrency || 'TRY';

  const lk = _lKey('kredi', krediId, taksitNo);
  const eski = _lGet(lk) || 0;
  const uygula = (delta) => isNakit ? _nakitBakiyeDelta(pb, delta) : _bakiyeDelta(kr.hesapId, delta);

  if (!durum || getBeklemedeSayilanDurumlar().includes(durum)) {
    if (eski !== 0) { uygula(eski); _lDel(lk); _sync(); }
    return;
  }
  if (getOdenmisSayilanDurumlar().includes(durum)) {
    const yeni = tutar || kr.aylikTaksit || 0;
    const delta = yeni - eski;
    if (Math.abs(delta) < 0.001) return;
    if (uygula(-delta)) { _lSet(lk, yeni); _sync(isNakit ? 'Kredi taksit ödendi — nakit bakiye düşüldü' : 'Kredi taksit ödendi — bakiye düşüldü'); }
  }
}

// ─── KART İŞLEMİ: kart banka hesabına bağlıysa işlem bakiyeyi etkiler ─────
// Kart kaydedilirken / silinirken çağrılır
export function entIslemHesabaYansit(islem, isEski) {
  if (!islem) return;
  // Kartın bağlı hesabını bul: kart.hesapId veya hesaplar içinde kartId eşleşen
  const kart = (_coreState.DB.kartlar || []).find(k => k.id === islem.kart);
  if (!kart) return;
  const hesap = (_coreState.DB.hesaplar || []).find(h =>
    h.id === (kart.hesapId || '') || h.kartId === kart.id
  );
  if (!hesap) return;

  const lk = _lKey('islem', islem.id, 0);
  const eski = _lGet(lk) || 0;

  if (isEski) {
    // Silme: geri al
    if (eski !== 0) { _bakiyeDelta(hesap.id, eski); _lDel(lk); _sync(); }
    return;
  }

  // Kaydetme: ilk taksitin hesaba etkisi (kart işlemleri genellikle gider)
  const taksitTutar = islem.aylik || (islem.tutar / Math.max(1, islem.taksit || 1));
  const delta = taksitTutar - eski;
  if (Math.abs(delta) < 0.001) return;
  if (_bakiyeDelta(hesap.id, -delta)) { _lSet(lk, taksitTutar); _sync(); }
}
// [ES module] eskiden bu fonksiyon sadece export ediliyordu; abonelik.js
// window.entIslemHesabaYansit = function(){...} ile ÇOKLU TAKSİT mantığını
// içeren bir sürümle bunu "değiştirmeye" çalışıyordu — ama saveIslem/
// deleteIslem wrap'leri bu dosyanın kendi modül-scope'undaki
// entIslemHesabaYansit'i (yukarıdaki, TEK taksit mantığı) çağırdığı için
// abonelik.js'nin window ataması hiçbir zaman gerçekte kullanılmıyordu
// (ölü kod, sessiz bug). Artık taban register edilir; abonelik.js kendi
// (daha yeni/doğru) çoklu-taksit sürümünü get/register ile ÜZERİNE YAZAR,
// saveIslem/deleteIslem ise _wrapRegistry.call('entIslemHesabaYansit', ...) kullanarak
// her zaman en güncel (çoklu-taksit) sürümü çağırır.
_wrapRegistry.register('entIslemHesabaYansit', entIslemHesabaYansit);

// ─── MERKEZ DISPATCH: _otoBakiyeGuncelle override ─────────────────────────
// Orijinal fonksiyon zaten var, bunu tam olarak yerine koyuyoruz
// [ES module] Diğer dosyalarda da aynı isim var (abonelik.js,
// oto-bakiye-motoru.js) - alias ile export edilir. window.X ataması
// (script sırasına göre son yüklenen kazanır) AYNEN korunur.
function _otoBakiyeGuncelle__hesap_entegrasyon_motoru(tip, id, key, durum, tutar) {
  try {
    switch (tip) {
      case 'kira':    entKiraYansit(id, key, durum, tutar);    break;
      case 'maas':    entMaasYansit(id, key, durum, tutar);    break;
      case 'elden':   entEldenYansit(id, durum, tutar);        break;
      case 'mevduat': entMevduatYansit(id, durum);             break;
      case 'kmh':     entKmhYansit(id, key, durum, tutar);     break;
      case 'kredi':   entKrediYansit(id, key, durum, tutar);   break;
      case 'depozito': entDepozitoYansit(id, key, durum, tutar); break;
    }
  } catch(err) { console.warn('entOtoBakiye hata:', err); }
}
export { _otoBakiyeGuncelle__hesap_entegrasyon_motoru };
_wrapRegistry.register('_otoBakiyeGuncelle', _otoBakiyeGuncelle__hesap_entegrasyon_motoru);

// ─── saveIslem WRAP: kaydetme/silme anında hesaba yansıt ──────────────────
// [ES module] eskiden window.saveIslem üzerinden okunup window.saveIslem'e
// geri yazılıyordu; export binding immutable olduğu için bu ASLA gerçek
// export edilen saveIslem'i etkilemiyordu. Artık get/register ile
// wrap-registry üzerinden doğru şekilde zincirleniyor.
const _origSaveIslem = _wrapRegistry.get('saveIslem');
if (typeof _origSaveIslem === 'function') {
  _wrapRegistry.register('saveIslem', function() {
    const eskiId = editIslemId;
    const eskiIslem = eskiId ? (_coreState.DB.islemler || []).find(i => i.id === eskiId) : null;
    // Eski işlemi geri al
    if (eskiIslem) _wrapRegistry.call('entIslemHesabaYansit', eskiIslem, true);
    // Asıl kaydet
    _origSaveIslem.apply(this, arguments);
    // Yeni işlemi uygula (_coreState.DB'ye yazıldıktan sonra)
    setTimeout(() => {
      const arr = _coreState.DB.islemler || [];
      const yeniIslem = eskiId ? arr.find(i => i.id === eskiId) : arr[arr.length - 1];
      if (yeniIslem) _wrapRegistry.call('entIslemHesabaYansit', yeniIslem, false);
    }, 50);
  });
}

const _origDeleteIslem = _wrapRegistry.get('deleteIslem');
if (typeof _origDeleteIslem === 'function') {
  _wrapRegistry.register('deleteIslem', function(id) {
    const islem = (_coreState.DB.islemler || []).find(i => i.id === id);
    // Kesinleşmiş ekstre kontrolü: önce orijinal fonksiyon çalışsın,
    // entegrasyon yansıtması yalnızca silme onaylanırsa tetiklensin
    if (islem) {
      const k = getKart(islem.kart);
      if (k) {
        const kesinlenmis = _hesaplamalar.getIslemTaksitliste(islem).some(tak => {
          const pd = _hesaplamalar.getExtreDonemi(k, tak.ekstreTarih);
          if (!pd) return false;
          return isEkstreKesinlesmis(k.id, `${pd.year}-${String(pd.month+1).padStart(2,'0')}`);
        });
        if (kesinlenmis) { showToast('Kesinleşmiş ekstreye ait işlem silinemez', 'error'); return; }
      }
      _wrapRegistry.call('entIslemHesabaYansit', islem, true);
    }
    _origDeleteIslem.apply(this, arguments);
  });
}

// ─── renderAll WRAP: Drive yüklendikten sonra paneli başlat ───────────────
// [ES module] eskiden window.renderAll üzerinden okunup window.renderAll'a
// geri yazılıyordu; render-core.js zaten wrap-registry kullandığı için
// artık get/register ile zincirleniyor.
const _origRenderAll = _wrapRegistry.get('renderAll');
if (typeof _origRenderAll === 'function') {
  _wrapRegistry.register('renderAll', function() {
    _origRenderAll.apply(this, arguments);
    setTimeout(_initEntegre, 200);
  });
}

// ─── SYNC: kaydet + yenile ─────────────────────────────────────────────────
export function _sync(toast) {
  try { saveData(); } catch(e) {}
  try {
    const activePage = document.querySelector('.page.active');
    const activeId = activePage ? activePage.id.replace('page-', '') : '';
    if (activeId === 'hesaplar' && typeof renderHesaplar === 'function') renderHesaplar();
  } catch(e) {}
  _updateTopbarBakiye();
  if (toast) { try { showToast(toast, 'success'); } catch(e) {} }
}

// ─── TOPBAR: anlık toplam bakiye ──────────────────────────────────────────
export function _updateTopbarBakiye() {
  try {
    const toplam = (_coreState.DB.hesaplar || [])
      .filter(h => h.durum !== 'kapali')
      .reduce((s, h) => s + (h.bakiye || 0), 0);
    let el = document.getElementById('ent-topbar-bakiye');
    if (!el) {
      const actions = document.querySelector('.topbar-actions');
      if (!actions) return;
      el = document.createElement('div');
      el.id = 'ent-topbar-bakiye';
      el.style.cssText = 'display:flex;align-items:center;gap:5px;padding:4px 11px;background:rgba(45,212,191,.07);border:1px solid rgba(45,212,191,.18);border-radius:8px;cursor:pointer;font-size:11.5px;font-weight:600;white-space:nowrap;transition:all .2s';
      el.title = 'Toplam hesap bakiyesi — tıkla: hesaplar';
      el.onclick = () => { try { _wrapRegistry.call('showPage', 'hesaplar'); } catch(e) {} };
      el.onmouseenter = () => el.style.background = 'rgba(45,212,191,.14)';
      el.onmouseleave = () => el.style.background = 'rgba(45,212,191,.07)';
      actions.insertBefore(el, actions.firstChild);
    }
    el.innerHTML = `<span style="opacity:.65">💰</span><span class="mono" style="color:${toplam >= 0 ? 'var(--teal)' : 'var(--danger)'}">${fmtCur(toplam)}</span>`;
  } catch(e) {}
}


// ─── showPage WRAP: sayfa değişince topbar güncelle ───────────────────────
// [ES module] eskiden showPage doğrudan yeniden atanıyordu (window.showPage
// = ... ile). ES import binding'leri immutable olduğu için bu artık
// mümkün değil — taban registry'de yoksa önce import edilen tanım register
// edilir, sonra üstüne wrap katmanı eklenir. Çağıranlar _wrapRegistry.call('showPage', ...)
// kullanmalı.
if (!_wrapRegistry.get('showPage')) _wrapRegistry.register('showPage', showPage);
{
  const _origShowPage2 = _wrapRegistry.get('showPage');
  _wrapRegistry.register('showPage', function(pageId, btn) {
    _origShowPage2.apply(this, arguments);
    _updateTopbarBakiye();
  });
}

// ─── renderOzet WRAP: özet render edilince hesap bloğunu da güncelle ──────
if (!_wrapRegistry.get('renderOzet')) _wrapRegistry.register('renderOzet', renderOzet);
{
  const _origRenderOzet = _wrapRegistry.get('renderOzet');
  _wrapRegistry.register('renderOzet', function() {
    _origRenderOzet.apply(this, arguments);
    _updateTopbarBakiye();
  });
}

// ─── renderHesaplar WRAP: hesap sayfası yenilenince topbar güncelle ────────
{
  const _origRenderHesaplar2 = _wrapRegistry.get('renderHesaplar') || renderHesaplar;
  _wrapRegistry.register('renderHesaplar', function() {
    _origRenderHesaplar2.apply(this, arguments);
    _updateTopbarBakiye();
  });
}

// ─── ÖZET TOPBAR SAYACI: bekleyen ödeme sayısı ────────────────────────────
function _updateBekleyenSayac() {
  try {
    const bugün = localDateStr(new Date());
    const buAy  = bugün.slice(0, 7);
    let sayac = 0;
    (_coreState.DB.kiralar || []).forEach(k => {
      if (odBeklemedeMi(odKiraMaasOverride(k, buAy))) sayac++;
    });
    (_coreState.DB.maaslar || []).forEach(m => {
      if (odBeklemedeMi(odKiraMaasOverride(m, buAy))) sayac++;
    });
    (_coreState.DB.eldenler || []).forEach(e => {
      if (odBeklemedeMi(e.odDurum)) sayac++;
    });

    // Nav badge güncelle (sidebar)
    // [ES module] Eskiden onclick attribute içeriğine göre bulunuyordu; onclick
    // temizliği sonrası HTML'de bu attribute yok, sabit id (rf-oc-1 = Özet nav
    // butonu, bkz. index.html / onclick-bootstrap.js) ile bulunuyor.
    const ozetNavBtn = document.getElementById('rf-oc-1');
    const navBtns = ozetNavBtn ? [ozetNavBtn] : [];
    navBtns.forEach(btn => {
      let badge = btn.querySelector('.ent-nav-badge');
      if (sayac > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'ent-nav-badge nav-count';
          badge.style.cssText = 'background:var(--danger);color:#fff;border-radius:5px;font-size:9px;padding:1px 5px;margin-left:auto;font-weight:700';
          btn.appendChild(badge);
        }
        badge.textContent = sayac;
      } else {
        if (badge) badge.remove();
      }
    });
  } catch(e) {}
}

// ─── HESAP SAYFASI: mevcut hesap satırlarına özet badge ekle ─────────────
function _injectHesapOzetBadge() {
  try {
    const bugün = localDateStr(new Date());
    const buAy  = bugün.slice(0, 7);

    // Hesap tablosundaki her satır için
    document.querySelectorAll('[data-hesap-id]:not([data-ent-badge])').forEach(row => {
      row.dataset.entBadge = '1';
      const hesapId = row.dataset.hesapId;
      const hesap = (_coreState.DB.hesaplar || []).find(h => h.id === hesapId);
      if (!hesap) return;

      let bekleyen = 0;
      (_coreState.DB.kiralar || []).filter(k => k.hesapId === hesapId).forEach(k => {
        if (odBeklemedeMi(odKiraMaasOverride(k, buAy))) bekleyen++;
      });
      (_coreState.DB.maaslar || []).filter(m => m.hesapId === hesapId).forEach(m => {
        if (odBeklemedeMi(odKiraMaasOverride(m, buAy))) bekleyen++;
      });

      if (bekleyen > 0) {
        const badge = document.createElement('span');
        badge.textContent = `${bekleyen} bekleyen`;
        badge.style.cssText = 'font-size:9.5px;background:rgba(251,146,60,.15);color:var(--warn);border:1px solid rgba(251,146,60,.3);border-radius:5px;padding:1px 6px;margin-left:6px;font-weight:600';
        row.appendChild(badge);
      }
    });
  } catch(e) {}
}

// ─── BAŞLATMA ──────────────────────────────────────────────────────────────
export function _initEntegre() {
  _updateTopbarBakiye();
  _updateBekleyenSayac();
}

// İlk yükleme
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(_initEntegre, 600));
} else {
  setTimeout(_initEntegre, 600);
}

// Drive yüklendikten sonra (renderAll çağrısı ile tetiklenir)
// — renderAll wrap zaten _initEntegre'yi çağırıyor

/* rf-v86: 60sn periyodik topbar güncellemesi kaldırıldı; render/save sonrası prosedürel yenilenir. */
// Global API
// [ES module] entegre nesnesi export ediliyor - app-core.js gibi dosyalar
// bunu doğrudan import edebilir.
export const entegre = {
  kiraYansit:    entKiraYansit,
  maasYansit:    entMaasYansit,
  eldenYansit:   entEldenYansit,
  mevduatYansit: entMevduatYansit,
  kmhYansit:     entKmhYansit,
  krediYansit:   entKrediYansit,
  islemYansit:   entIslemHesabaYansit,
  sync:          _sync,
  yenile:        _initEntegre
};

// ============================================================
// [DI-MIGRATION] domain.hesapEntegrasyonMotoru — container'a kayıt
// [BUG FIX] _lKey/_lGet/_lSet, `export { _lKey as _lKey__hesap_entegrasyon_motoru }`
// şeklinde bir İSİM DEĞİŞTİRME (rename) export'u ile dışa açılıyor — bu satır
// modül içinde `_lKey__hesap_entegrasyon_motoru` adında YENİ bir binding
// yaratmaz, sadece dışa açılan ismi değiştirir. O yüzden bu dosyanın kendi
// scope'unda o isim tanımlı değil ve aşağıdaki shorthand property
// (`{ _lKey__hesap_entegrasyon_motoru }`) "is not defined" hatası veriyordu.
// Gerçek lokal isimler (_lKey/_lGet/_lSet) kullanılıp obje key'i eskisiyle
// aynı tutuluyor ki container üzerinden resolve edenler etkilenmesin.
// ============================================================
import { provide } from '@core/container.js';
provide('domain.hesapEntegrasyonMotoru', {
  _bakiyeDelta, _nakitBakiyeDelta, entKiraYansit, entMaasYansit, entEldenYansit,
  entMevduatYansit, entKmhYansit, entDepozitoYansit, entKrediYansit,
  entIslemHesabaYansit, _sync, _updateTopbarBakiye, _initEntegre, entegre,
  _lKey__hesap_entegrasyon_motoru: _lKey,
  _lGet__hesap_entegrasyon_motoru: _lGet,
  _lSet__hesap_entegrasyon_motoru: _lSet,
  _otoBakiyeGuncelle__hesap_entegrasyon_motoru,
});

// ═══════════════════════════════════════════════════════════
// TARİH INPUT FORMAT ZORLAYICI — FORMAT_CONFIG.tarihFormat overlay
// ── Her type="date" inputu sarmalanır; gerçek input gizlenir,
//    üstüne FORMAT_CONFIG.tarihFormat'a göre metin gösterilir.
//    Native picker çalışmaya devam eder; value hep yyyy-MM-dd.
// ───────────────────────────────────────────────────────────

