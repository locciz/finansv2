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

/**
 * @typedef {(...args: any[]) => any} RegistryFn
 */

const registry = Object.create(null);

// [YENİ] Her isim için sarmalama sırasını (kim kimi, hangi sırayla wrap etti)
// takip eden debug izi. register() her çağrıldığında bir kayıt eklenir;
// normal çalışmayı ETKİLEMEZ, sadece geliştirme/hata ayıklama sırasında
// "bu action'ı kim ne zaman sarmaladı" sorusuna cevap vermek için tutulur.
// Bellek şişmesin diye isim başına son 50 kayıtla sınırlanır.
const _wrapTrace = Object.create(null);
const WRAP_TRACE_LIMIT = 50;

function _traceRegister(name, fn) {
  if (!_wrapTrace[name]) _wrapTrace[name] = [];
  const entry = {
    at: Date.now(),
    fnName: fn.name || '(anonim)',
    hadPrevious: typeof registry[name] === 'function',
  };
  _wrapTrace[name].push(entry);
  if (_wrapTrace[name].length > WRAP_TRACE_LIMIT) _wrapTrace[name].shift();
}

/**
 * Bir action'ı (yeniden) kaydeder — taban tanım ya da bir wrap katmanı olabilir.
 * @param {string} name
 * @param {RegistryFn} fn
 * @returns {void}
 */
export function register(name, fn) {
  if (typeof fn !== 'function') {
    throw new Error(`wrap-registry: register('${name}', ...) fonksiyon olmayan bir değerle çağrıldı.`);
  }
  _traceRegister(name, fn);
  registry[name] = fn;
}

/**
 * Kayıtlı ham referansı döner (wrap etmek isteyen modüller bunu alıp sarmalar).
 * @param {string} name
 * @returns {RegistryFn|undefined}
 */
export function get(name) {
  return registry[name];
}

/**
 * Action kayıtlı mı?
 * @param {string} name
 * @returns {boolean}
 */
export function has(name) {
  return typeof registry[name] === 'function';
}

/**
 * Kayıtlı en güncel (en dıştaki) fonksiyonu çağırır.
 *
 * Varsayılan davranış (opts.strict verilmezse ya da false ise) DEĞİŞMEDİ:
 * kayıtlı değilse sessizce `undefined` döner — bu, `container.js`'deki
 * resolve()'un aksine bilinçli bir tercihtir, çünkü bazı action'lar
 * (özellikle sayfa render'ları) uygulamanın ilk yüklenme anında henüz
 * register edilmemiş olabilir ve bu her zaman bir hata sayılmamalıdır.
 *
 * [YENİ] `opts.strict: true` geçilirse, kayıtlı olmayan bir isim için
 * sessiz `undefined` yerine hata fırlatılır. Bu SADECE çağıran taraf
 * açıkça isterse devreye girer (opt-in); mevcut `call(name, ...args)`
 * çağrılarının hiçbiri etkilenmez.
 *
 * @param {string} name
 * @param {...any} args
 * @returns {any}
 */
export function call(name, ...args) {
  const fn = registry[name];
  if (typeof fn === 'function') return fn(...args);
  return undefined;
}

/**
 * call()'ın strict varyantı: action kayıtlı değilse hata fırlatır.
 * Mevcut call() davranışını değiştirmemek için ayrı bir fonksiyon olarak
 * eklendi — çağıran taraf bilinçli olarak strict modu seçmiş olur.
 * @param {string} name
 * @param {...any} args
 * @returns {any}
 */
export function callStrict(name, ...args) {
  const fn = registry[name];
  if (typeof fn !== 'function') {
    throw new Error(`wrap-registry: callStrict('${name}', ...) — bu isim registry'de kayıtlı değil.`);
  }
  return fn(...args);
}

/**
 * Debug: bir action'ın sarmalama geçmişini (kim, ne zaman, kaçıncı katman
 * olarak register etti) döner. Üretim akışını etkilemez, sadece inceleme
 * amaçlıdır.
 * @param {string} name
 * @returns {Array<{at:number, fnName:string, hadPrevious:boolean}>}
 */
export function getWrapTrace(name) {
  return (_wrapTrace[name] || []).slice();
}

// ============================================================
// [DI-MIGRATION] Bu modül (action wrap zinciri) container'a
// 'core.wrapRegistry' namespace'i olarak da kaydedilir — böylece container
// üzerinden çalışan yeni servisler `resolve('core.wrapRegistry').call(...)`
// diyerek eskisiyle aynı zincire erişebilir.
// container.js hiçbir modülü import etmeyen bir yaprak (leaf) dosya olduğu
// için burada dairesel import riski yok; bu yüzden STATİK import kullanıyoruz.
// Önceden dinamik `import('@core/container.js').then(...)` kullanılıyordu,
// bu ise register'ı bir mikrotask sonrasına erteliyordu. Bu gecikme
// yüzünden, modal-genel.js gibi kendi top-level (senkron) kodunda
// `inject('core.wrapRegistry').register(...)` çağıran modüller, script
// sırası doğru olsa bile "core.wrapRegistry namespace'i kayıtlı değil"
// hatası fırlatıyordu. Statik import ile provide() bu dosyanın modül
// evaluation'ı sırasında SENKRON çalışır.
// ============================================================
import { provide } from '@core/container.js';
provide('core.wrapRegistry', { register, get, has, call, callStrict, getWrapTrace });
