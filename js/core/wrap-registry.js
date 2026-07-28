// core/wrap-registry.js
// Bazı fonksiyonlar (openTransferModal, renderTransferLog, tbkAyDetayAc,
// tbkAyDetayFiltreUygula, calcKmhKredi, calcKredi, renderKmhKredi, renderKredi,
// openModal, closeModal, showPage...) uygulama açılışında birden fazla modül
// tarafından ZİNCİRLEME wrap ediliyor: modül A taban davranışı tanımlar,
// modül B onu "sonra bunu da yap" diyerek sarmalar, modül C üstüne bir kat
// daha ekler. ES module `export` binding'leri immutable olduğu için (bir
// modülün export ettiği isim başka bir modülden yeniden atanamaz), bu zincir
// eskiden yalnızca `window.X = wrap(window.X)` ile mümkündü.
//
// Bu registry aynı deseni window'a dokunmadan sağlar: taban fonksiyon
// register edilir, wrap etmek isteyen her modül mevcut referansı alıp
// kendi sarmalayıcısını tekrar register eder. Çağıranlar `call(name, ...args)`
// ile her zaman EN GÜNCEL (en dıştaki) sarmalayıcıyı çağırır.

const registry = Object.create(null);

/** Bir action'ı (yeniden) kaydeder — taban tanım ya da bir wrap katmanı olabilir. */
export function register(name, fn) {
  if (typeof fn !== 'function') {
    throw new Error(`wrap-registry: register('${name}', ...) fonksiyon olmayan bir değerle çağrıldı.`);
  }
  registry[name] = fn;
}

/** Kayıtlı ham referansı döner (wrap etmek isteyen modüller bunu alıp sarmalar). */
export function get(name) {
  return registry[name];
}

/** Action kayıtlı mı? */
export function has(name) {
  return typeof registry[name] === 'function';
}

/** Kayıtlı en güncel (en dıştaki) fonksiyonu çağırır. Kayıtlı değilse no-op. */
export function call(name, ...args) {
  const fn = registry[name];
  if (typeof fn === 'function') return fn(...args);
  return undefined;
}

// ============================================================
// [DI-MIGRATION] Bu modül (action wrap zinciri) container'a
// 'core.wrapRegistry' namespace'i olarak da kaydedilir — böylece container
// üzerinden çalışan yeni servisler `resolve('core.wrapRegistry').call(...)`
// diyerek eskisiyle aynı zincire erişebilir. Dairesel import'tan kaçınmak
// için container.js'i dinamik olarak import ediyoruz (top-level'da değil).
// ============================================================
import('@core/container.js').then(({ provide }) => {
  provide('core.wrapRegistry', { register, get, has, call });
});
