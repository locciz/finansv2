// ============================================================
// js/domain/banka-logo-cache.js
// Banka logolarını (favicon/CDN görselleri) localStorage'da
// base64 data URL olarak önbelleğe alır. Amaç: her form/modal
// her açıldığında aynı bankalar için tekrar tekrar ağ isteği
// atılmasını önlemek — logo bir kez indirilir, sonraki tüm
// render'lar doğrudan localStorage'dan okur, hiç network yok.
//
// Kullanım: banka-verisi.js'teki her banka artık ham bir <img src="...">
// yerine data-remote-src taşıyan bir <img> üretir; bu modül sayfa
// yüklendiğinde/ihtiyaç oldukça bu img'leri tarar, cache'te varsa
// anında src'yi cache'ten doldurur, yoksa indirip cache'ler.
// ============================================================

const CACHE_PREFIX = 'bankLogoCache:v1:';
const FAIL_PREFIX = 'bankLogoFail:v1:';
// Başarısız denemeleri de kısa süreliğine hatırlıyoruz ki aynı oturumda
// (ör. aynı sayfa içinde 10 kez render edilen bir banka) her seferinde
// tekrar network denemesi yapılmasın. Bu süre dolunca tekrar denenir
// (ör. geçici bir ağ kesintisiyse kalıcı olarak bozuk kalmasın).
const FAIL_RETRY_MS = 10 * 60 * 1000; // 10 dakika

function _safeGetItem(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function _safeSetItem(key, val) {
  try { localStorage.setItem(key, val); return true; } catch { return false; }
}
function _safeRemoveItem(key) {
  try { localStorage.removeItem(key); } catch { /* no-op */ }
}

function _cacheKey(kod) { return CACHE_PREFIX + kod; }
function _failKey(kod) { return FAIL_PREFIX + kod; }

// Bir kod için önbellekte data URL var mı?
export function getCachedLogo(kod) {
  return _safeGetItem(_cacheKey(kod));
}

// Bir kod yakın zamanda başarısız oldu mu (tekrar denemeyi ertelemek için)?
function _recentlyFailed(kod) {
  const raw = _safeGetItem(_failKey(kod));
  if (!raw) return false;
  const ts = parseInt(raw, 10);
  if (!ts || (Date.now() - ts) > FAIL_RETRY_MS) {
    _safeRemoveItem(_failKey(kod));
    return false;
  }
  return true;
}

function _markFailed(kod) {
  _safeSetItem(_failKey(kod), String(Date.now()));
}

// Verilen URL'i indirip base64 data URL'e çevirir ve cache'e yazar.
// Başarılı olursa data URL'i, olmazsa null döner.
// Bazı banka sunucuları Access-Control-Allow-Origin header'ı döndürmüyor,
// bu da fetch() ile indirmeyi (dolayısıyla cache'lemeyi) CORS hatasıyla
// engelliyor — <img src="..."> ile göstermek serbest ama JS'ten veri
// olarak okumak yasak. Bunu aşmak için indirmeyi, CORS header'ı ekleyen
// herkese açık bir görsel proxy'si (images.weserv.nl) üzerinden yapıyoruz.
// Proxy hedef görseli kendi tarafında indirip bize CORS-serbest olarak
// sunuyor; böylece hangi bankanın sunucusu CORS'a izin verirse versin
// cache'leme her banka için çalışabiliyor.
function _proxiedUrl(url) {
  // weserv.nl protokolsüz (şemasız) URL bekliyor
  const stripped = url.replace(/^https?:\/\//, '');
  return 'https://images.weserv.nl/?url=' + encodeURIComponent(stripped);
}

async function _fetchAndCache(kod, url) {
  try {
    const res = await fetch(_proxiedUrl(url), { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    if (!blob || blob.size === 0) throw new Error('empty blob');
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const ok = _safeSetItem(_cacheKey(kod), dataUrl);
    if (!ok) {
      // localStorage doluysa (quota) sessizce vazgeç, cache'siz devam et
      return dataUrl; // yine de bu oturumda kullanılabilir, sadece kalıcı değil
    }
    return dataUrl;
  } catch (e) {
    _markFailed(kod);
    return null;
  }
}

// Sayfadaki tüm "data-remote-src" taşıyan banka logo <img>'lerini tarar.
// Her biri için: cache'te varsa hemen doldurur; yoksa indirip cache'ler
// ve DOM'u günceller; o da başarısız olursa <img>'in kendi onerror
// zincirine (Google favicons -> renkli rozet) düşmesine izin verir
// (src hiç değiştirilmez, tarayıcı zaten kendi onerror'ını tetikler).
export function hydrateBankLogos(root) {
  const scope = root || document;
  const imgs = scope.querySelectorAll('img[data-remote-src][data-logo-kod]');
  imgs.forEach(img => {
    if (img.dataset.hydrated === '1') return; // aynı img'i iki kere işleme
    img.dataset.hydrated = '1';
    const kod = img.dataset.logoKod;
    const remoteUrl = img.dataset.remoteSrc;
    if (!kod || !remoteUrl) return;

    const cached = getCachedLogo(kod);
    if (cached) {
      img.src = cached;
      return;
    }
    if (_recentlyFailed(kod)) {
      // Yakın zamanda başarısız olmuş, tekrar network denemeden direkt
      // orijinal (canlı) URL'e düş — img'in kendi onerror zinciri devreye girer.
      img.src = remoteUrl;
      return;
    }
    // İlk kez görülüyor: indirip cache'lemeyi dene, bu sırada geçici
    // olarak orijinal URL ile göster (kullanıcı beklerken boş kalmasın).
    img.src = remoteUrl;
    _fetchAndCache(kod, remoteUrl).then(dataUrl => {
      if (dataUrl && img.isConnected) {
        img.onerror = null;
        img.src = dataUrl;
      }
    });
  });
}

// Belirli bir bankanın cache'ini temizler (ör. banka logosunu manuel
// güncelledikten sonra, veya "logoyu yenile" gibi bir aksiyon için).
export function invalidateBankLogoCache(kod) {
  _safeRemoveItem(_cacheKey(kod));
  _safeRemoveItem(_failKey(kod));
}

// Tüm banka logo cache'ini temizler.
export function clearAllBankLogoCache() {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX) || k.startsWith(FAIL_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  } catch { /* no-op */ }
}

// ============================================================
// [DI-MIGRATION] domain.bankaLogoCache — container'a kayıt
// ============================================================
import { provide } from '@core/container.js';
import * as _self from './banka-logo-cache.js';
provide('domain.bankaLogoCache', _self);
