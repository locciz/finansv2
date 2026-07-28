// core/container.js
// ============================================================
// Merkezi Dependency Injection Container
// ============================================================
// AMAÇ: Modüllerin birbirini doğrudan `import { X } from './y.js'` ile
// çekmesi yerine, tek bir merkezi noktadan (bu dosya) kayıt/çözümleme
// yapması. Böylece modüller arası bağımlılık grafiği kod içinde dağınık
// import satırlarına değil, TEK bir yere (container) yazılır.
//
// KADEMELİ GEÇİŞ STRATEJİSİ (bkz. DI-MIGRATION.md):
// 125 dosya / 1186 import'u tek adımda kırmak yerine, katman katman
// (services -> domain -> core -> ui) container'a taşınıyor. Henüz
// taşınmamış dosyalar mevcut `import` ifadeleriyle çalışmaya devam eder;
// bu container onlarla ÇAKIŞMAZ, üstüne kurulur.
//
// TEMEL FARK — wrap-registry.js'den:
//   wrap-registry: yalnızca "action" fonksiyonlarının zincirleme
//   sarmalanması (call/register/get) için var, tek bir düz isim uzayı.
//   container: servis/domain/state SEVİYESİNDE, isimlendirilmiş
//   NAMESPACE'lerle (ör. 'services.gdrive', 'domain.hesaplamalar')
//   çalışan genel amaçlı bir DI çözücüsü. wrap-registry'yi DEĞİŞTİRMEZ,
//   onu da içinde bir alt-sistem olarak barındırabilir.
//
// KULLANIM ŞEKİLLERİ:
//
// 1) Değer/servis kaydı (bir kere, modül yüklenirken):
//      import { provide } from '@core/container.js';
//      provide('services.gdrive', { gDriveInit, gDriveSyncNow, ... });
//
// 2) Tüketen taraf, import yerine resolve eder:
//      import { resolve } from '@core/container.js';
//      const { gDriveSyncNow } = resolve('services.gdrive');
//      gDriveSyncNow();
//
// 3) Lazy/factory kaydı (bağımlılıkları olan servisler için):
//      provideFactory('domain.hesaplamalar', () => {
//        const { DB } = resolve('core.state');
//        return { calcTaksit: (...) => ... };
//      });
//
// 4) Fonksiyonel bağımlılıklar için ince sarmalayıcı — modül üstte
//    resolve etmek yerine, her çağrıda güncel implementasyonu almak
//    istiyorsa (ör. hot-swap / test mock'lama):
//      import { inject } from '@core/container.js';
//      const gdrive = inject('services.gdrive'); // proxy döner
//      gdrive.gDriveSyncNow(); // her çağrıda container'dan taze çözülür
// ============================================================

const registry = Object.create(null);   // name -> { value } | { factory }
const singletons = Object.create(null); // factory sonuçlarının cache'i

/**
 * Bir namespace'e hazır bir değer/nesne kaydeder (eager).
 * Aynı isim tekrar provide edilirse ÜZERİNE YAZAR (son kayıt kazanır) —
 * bu, wrap-registry'deki "en dıştaki sarmalayıcı kazanır" davranışıyla
 * tutarlı tutulmuştur.
 */
export function provide(name, value) {
  if (!name || typeof name !== 'string') {
    throw new Error(`container: provide() geçersiz isim ile çağrıldı: ${name}`);
  }
  registry[name] = { kind: 'value', value };
  delete singletons[name];
}

/**
 * Bir namespace'i factory (lazy) olarak kaydeder. Factory yalnızca ilk
 * resolve() çağrısında çalıştırılır, sonucu singleton olarak cache'lenir.
 * Dairesel bağımlılıkları elle çözmek için (factory içinde resolve()
 * çağırıp lazy erişim) kullanılır.
 */
export function provideFactory(name, factory) {
  if (typeof factory !== 'function') {
    throw new Error(`container: provideFactory('${name}', ...) fonksiyon olmayan bir değerle çağrıldı.`);
  }
  registry[name] = { kind: 'factory', factory };
  delete singletons[name];
}

/** Namespace kayıtlı mı? */
export function has(name) {
  return Object.prototype.hasOwnProperty.call(registry, name);
}

/**
 * Bir namespace'i çözer ve değerini döner. Kayıtlı değilse hata fırlatır
 * (sessiz undefined dönmek yerine — kurulum sırası hatalarını erken
 * yakalamak için bilinçli tercih).
 */
export function resolve(name) {
  if (!has(name)) {
    throw new Error(
      `container: '${name}' namespace'i kayıtlı değil. ` +
      `Muhtemelen ilgili modül henüz yüklenmedi ya da index.html'deki ` +
      `script sırası bu resolve() çağrısından SONRA geliyor.`
    );
  }
  const entry = registry[name];
  if (entry.kind === 'value') return entry.value;
  // factory: ilk çağrıda çalıştır, sonrasını cache'le
  if (!(name in singletons)) {
    singletons[name] = entry.factory();
  }
  return singletons[name];
}

/** Kayıtlı değilse hata fırlatmak yerine fallback döner. */
export function resolveOr(name, fallback) {
  return has(name) ? resolve(name) : fallback;
}

/**
 * `inject` — resolve()'un tembel/canlı vekil (Proxy) hali.
 * Tüketen modül, henüz kayıtlı olmayan bir namespace'i (yükleme sırası
 * garanti değilse) referans alıp saklayabilir; gerçek çözümleme yalnızca
 * property erişildiğinde (ör. gdrive.gDriveSyncNow) yapılır. Bu, dairesel
 * bağımlılık / script sırası kırılganlığına karşı en güvenli kullanım
 * şeklidir ve container tabanlı geçişte VARSAYILAN yöntem olması önerilir.
 */
export function inject(name) {
  return new Proxy(Object.create(null), {
    get(_target, prop) {
      const impl = resolve(name);
      const v = impl[prop];
      return typeof v === 'function' ? v.bind(impl) : v;
    },
    has(_target, prop) {
      return prop in resolve(name);
    },
  });
}

/** Test/hot-reload amaçlı: tüm kayıtları temizler. Üretimde kullanılmaz. */
export function _resetForTests() {
  for (const k of Object.keys(registry)) delete registry[k];
  for (const k of Object.keys(singletons)) delete singletons[k];
}

/** Debug: kayıtlı tüm namespace isimlerini listeler. */
export function listRegistered() {
  return Object.keys(registry).sort();
}
