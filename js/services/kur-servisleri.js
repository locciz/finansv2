import { inject } from '@core/container.js';
const _coreState = inject('core.state');
// core.appCoreBase ve core.format artık container'da kayıtlı (Tur 4) —
// bu turda çevrildi (DI-MIGRATION.md madde 4).
const _appCoreBase = inject('core.appCoreBase');
const saveData = (...a) => _appCoreBase.saveData(...a);
const _coreFormat = inject('core.format');
const escapeHtml = (...a) => _coreFormat.escapeHtml(...a);
const fmtDate = (...a) => _coreFormat.fmtDate(...a);
const localDateStr = (...a) => _coreFormat.localDateStr(...a);
import { showToast } from '@components/modal-genel.js';
import { getTatilSet } from '@pages/tanimlamalar/01-genel-yardimcilar.js';
import { renderTanimlamalar } from '@pages/tanimlamalar/02-ana-sayfa.js';
// ============================================================
// js/services/kur-servisleri.js — Döviz kuru servisleri
// (TCMB XML/JSON çekme, CORS proxy zinciri, özel API kaynakları,
// kur geçmişi backfill, Tanımlamalar sayfası kur ayarları UI'ı)
// ============================================================

// ── Modül state'i ─────────────────────────────────────────────
// Session bazlı proxy sağlık takibi
export var _proxyHealth = {};
// URL önbelleği (5 dk TTL)
export var _urlCache = new Map();
export var _URL_CACHE_TTL = 5 * 60 * 1000;
// Backfill için gün sayısı limiti
export var TCMB_BACKFILL_GUN_LIMIT = 90;
// Çalışma kilidi: aynı anda 2 güncelleme başlamaması için
export var _tcmbGuncellemeSuruyor = false;
// Çoklu özel API kaynağı yönetimi (Tanımlamalar > Kur Ayarları UI'ı)
export var _pbKaynaklar = [];
// Bir kaynak URL'ini test ederken JSON'u önbelleğe al (path seçici tekrar fetch atmasın)
export var _pbTestJsonCache = {};

// ── CORS proxy zinciri / önbellek ─────────────────────────────
export function _proxyHataKaydet(ad) {
  _proxyHealth[ad] = _proxyHealth[ad] || { hata: 0 };
  _proxyHealth[ad].hata++;
}

export function _proxyBasariKaydet(ad) {
  if (_proxyHealth[ad]) _proxyHealth[ad].hata = 0;
}

export function _proxySagliklimi(ad) {
  return (_proxyHealth[ad]?.hata || 0) < 3;
}

export function _cacheGet(url) {
  const c = _urlCache.get(url);
  if (!c) return null;
  if (Date.now() - c.ts > _URL_CACHE_TTL) { _urlCache.delete(url); return null; }
  return c;
}

export function _cacheSet(url, text, kaynak) {
  _urlCache.set(url, { text, kaynak, ts: Date.now() });
}

export function corsProxyZinciriOlustur(hedefUrl) {
  const workerUrl = (_coreState.DB?.ayarlar?.corsProxyWorker || '').replace(/\/$/, '');
  const enc = encodeURIComponent(hedefUrl);
  return [
    ...(workerUrl ? [{ url: `${workerUrl}?url=${enc}`,                              ad: 'Worker',         wrapped: false }] : []),
    { url: `https://api.allorigins.win/get?url=${enc}`,                             ad: 'AllOrigins',     wrapped: true  },
    { url: `https://api.allorigins.win/raw?url=${enc}`,                             ad: 'AllOriginsRaw',  wrapped: false },
    { url: `https://corsproxy.io/?url=${enc}`,                                      ad: 'CorsProxyIO',    wrapped: false },
    { url: `https://api.codetabs.com/v1/proxy/?quest=${enc}`,                       ad: 'CodeTabs',       wrapped: false },
    { url: `https://proxy.cors.sh/${hedefUrl}`,                                     ad: 'CorsShProxy',    wrapped: false },
    { url: `https://cors-proxy.fringe.zone/${hedefUrl}`,                            ad: 'FringeZone',     wrapped: false },
    { url: `https://thingproxy.freeboard.io/fetch/${hedefUrl}`,                    ad: 'ThingProxy',     wrapped: false },
    { url: `https://yacdn.org/proxy/${hedefUrl}`,                                   ad: 'YaCDN',          wrapped: false },
    { url: hedefUrl,                                                                 ad: 'Doğrudan',       wrapped: false },
  ];
}

export async function _parallelFetch(denemeler, { timeoutMs = 8000, validator = null } = {}) {
  return new Promise((resolve) => {
    let kazanan = false;
    let bekleyen = 0;
    const controllers = [];

    denemeler.forEach((d, i) => {
      if (!_proxySagliklimi(d.ad)) return; // bu proxy sağlıksız, atla
      bekleyen++;
      const ctrl = new AbortController();
      controllers.push({ ctrl, idx: i });

      const timer = setTimeout(() => { try { ctrl.abort(); } catch(e){} }, timeoutMs);

      fetch(d.url, { signal: ctrl.signal })
        .then(async (resp) => {
          clearTimeout(timer);
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          let text = await resp.text();
          if (d.wrapped) {
            const o = JSON.parse(text);
            if (typeof o?.contents !== 'string') throw new Error('wrapped boş');
            text = o.contents;
          }
          if (validator && !validator(text)) throw new Error('validator red');
          if (!kazanan) {
            kazanan = true;
            // Diğerlerini iptal et
            controllers.forEach(({ ctrl: c, idx: j }) => { if (j !== i) try { c.abort(); } catch(e){} });
            _proxyBasariKaydet(d.ad);
            resolve({ text, kaynak: d.ad });
          }
        })
        .catch(() => {
          clearTimeout(timer);
          _proxyHataKaydet(d.ad);
          bekleyen--;
          if (bekleyen === 0 && !kazanan) resolve(null);
        });
    });

    if (bekleyen === 0) resolve(null);
  });
}

export async function corsProxyZinciriDene(hedefUrl, { timeoutMs = 9000, validator = null } = {}) {
  // 1) Önbellek
  const cached = _cacheGet(hedefUrl);
  if (cached && (!validator || validator(cached.text))) {
    return { text: cached.text, kaynak: cached.kaynak + ' [cache]' };
  }

  const tumProxyler = corsProxyZinciriOlustur(hedefUrl);

  // 2) Worker öncelikli (varsa)
  const workerGiris = tumProxyler.find(d => d.ad === 'Worker');
  if (workerGiris && _proxySagliklimi('Worker')) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), Math.min(timeoutMs, 6000));
      const resp = await fetch(workerGiris.url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (resp.ok) {
        const text = await resp.text();
        if (!validator || validator(text)) {
          _proxyBasariKaydet('Worker');
          _cacheSet(hedefUrl, text, 'Worker');
          return { text, kaynak: 'Worker' };
        }
      }
    } catch(e) { _proxyHataKaydet('Worker'); }
  }

  // 3) Geri kalanları paralel dene
  const yedekler = tumProxyler.filter(d => d.ad !== 'Worker');
  const sonuc = await _parallelFetch(yedekler, { timeoutMs, validator });
  if (sonuc) {
    _cacheSet(hedefUrl, sonuc.text, sonuc.kaynak);
    return sonuc;
  }

  console.warn('[proxy] Tüm proxy’ler başarısız:', hedefUrl.slice(0, 60));
  return null;
}

export function jsonPathOku(obj, path) {
  if (!obj || !path) return null;
  // Önce tam key olarak dene (key içinde nokta olan durumlar için)
  if (Object.prototype.hasOwnProperty.call(obj, path)) return obj[path];
  // Noktalı path parçalama
  const parcalar = path.split('.');
  let cur = obj;
  for (const p of parcalar) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return null;
    // Önce tam eşleşme
    if (Object.prototype.hasOwnProperty.call(cur, p)) { cur = cur[p]; continue; }
    // Büyük/küçük harf ve boşluk normalize edilmiş (trim) arama
    const pNorm = p.trim().toLowerCase();
    const found = Object.keys(cur).find(k => k.trim().toLowerCase() === pNorm);
    if (found !== undefined) { cur = cur[found]; continue; }
    return null; // bulunamadı
  }
  return cur === undefined ? null : cur;
}

// ── TCMB kur çekme / parse etme ───────────────────────────────
export async function xauSpotCek() {
  const workerUrl = (_coreState.DB?.ayarlar?.corsProxyWorker || '').replace(/\/$/, '');
  if (!workerUrl) { console.warn('[xau] Worker URL tanımlı değil'); return null; }
  try {
    const resp = await fetch(`${workerUrl}/xau`, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const j = await resp.json();
    if (j.error) throw new Error(j.error);
    if (!j.alis || !j.satis) throw new Error('geçersiz yanıt: ' + JSON.stringify(j));
    console.log('[xau] Worker/xau:', j);
    return { alis: j.alis, satis: j.satis, _tryDirect: true };
  } catch(e) {
    console.warn('[xau] Worker/xau hata:', e.message);
    return null;
  }
}

export async function tcmbAlternatifJsonKurCek() {
  // open.er-api.com — ücretsiz, CORS açık, key yok
  const APIS = [
    {
      url: 'https://open.er-api.com/v6/latest/TRY',
      parse: (json) => {
        if (!json?.rates) return null;
        // Kurlar TRY bazında → 1 USD = X TRY demek için tersine çevir
        const rates = json.rates;
        const kurlar = {};
        // open.er-api: 1 TRY = X dolar → 1 USD = 1/rates.USD TRY
        for (const [kod, oran] of Object.entries(rates)) {
          if (!oran || oran === 0 || kod === 'TRY') continue;
          const tryKarsiligi = +(1 / oran).toFixed(6);
          kurlar[kod] = { alis: tryKarsiligi, satis: tryKarsiligi, isim: kod };
        }
        return Object.keys(kurlar).length ? kurlar : null;
      }
    },
    {
      url: 'https://api.frankfurter.app/latest?base=USD&symbols=TRY,EUR,GBP,JPY,CHF,SEK,NOK,DKK,CAD,AUD,SAR,AED,KWD,QAR',
      parse: (json) => {
        if (!json?.rates?.TRY) return null;
        const usdTry = json.rates.TRY;
        const kurlar = { USD: { alis: usdTry, satis: usdTry, isim: 'ABD Doları' } };
        for (const [kod, usdOran] of Object.entries(json.rates)) {
          if (kod === 'TRY' || !usdOran) continue;
          const tryKarsiligi = +(usdTry / usdOran).toFixed(6);
          kurlar[kod] = { alis: tryKarsiligi, satis: tryKarsiligi, isim: kod };
        }
        return kurlar;
      }
    },
    {
      // exchangerate-api.com — key gerekmez, CORS açık
      url: 'https://api.exchangerate-api.com/v4/latest/TRY',
      parse: (json) => {
        if (!json?.rates) return null;
        const rates = json.rates;
        const kurlar = {};
        for (const [kod, oran] of Object.entries(rates)) {
          if (!oran || oran === 0 || kod === 'TRY') continue;
          const tryKarsiligi = +(1 / oran).toFixed(6);
          kurlar[kod] = { alis: tryKarsiligi, satis: tryKarsiligi, isim: kod };
        }
        return Object.keys(kurlar).length ? kurlar : null;
      }
    },
  ];

  for (const api of APIS) {
    try {
      const resp = await fetch(api.url, { signal: AbortSignal.timeout(7000) });
      if (!resp.ok) continue;
      const json = await resp.json();
      const kurlar = api.parse(json);
      if (kurlar && Object.keys(kurlar).length > 3) {
        console.log('[tcmb-alt] Alternatif JSON API başarılı:', api.url.split('/')[2]);
        return { kurlar, tarihIso: json.time_last_update_utc
          ? new Date(json.time_last_update_utc).toISOString().slice(0,10)
          : localDateStr(new Date()) };
      }
    } catch(e) { /* sıradakini dene */ }
  }
  return null;
}

export function _tcmbArshivUrl(iso) {
  const [yyyy, mm, dd] = iso.split('-');
  return `https://www.tcmb.gov.tr/kurlar/${yyyy}${mm}/${dd}${mm}${yyyy}.xml`;
}

export async function tcmbKurXmlCek(targetDateIso) {
  const VALIDATOR = (text) => !!text && (text.includes('<Tarih_Date') || text.includes('<Currency'));

  if (targetDateIso) {
    const sonuc = await corsProxyZinciriDene(_tcmbArshivUrl(targetDateIso), { timeoutMs: 10000, validator: VALIDATOR });
    if (!sonuc) { console.warn('[tcmb-kur] Arşiv çekilemedi:', targetDateIso); return null; }
    return sonuc.text;
  }

  // Bugün için: today.xml + arşiv fallback + alternatif JSON (son çare)
  const todayUrl = 'https://www.tcmb.gov.tr/kurlar/today.xml';
  const todaySonuc = await corsProxyZinciriDene(todayUrl, { timeoutMs: 10000, validator: VALIDATOR });
  if (todaySonuc) return todaySonuc.text;

  // today.xml başarısız → son 3 iş gününün arşivini dene
  console.warn('[tcmb-kur] today.xml başarısız, arşiv fallback...');
  const tatilSet = typeof getTatilSet === 'function' ? getTatilSet() : new Set();
  let denenen = 0;
  const dt = new Date();
  for (let i = 1; i <= 10 && denenen < 3; i++) {
    dt.setDate(dt.getDate() - 1);
    const gun = dt.getDay();
    if (gun === 0 || gun === 6) continue;
    const iso = localDateStr(dt);
    if (tatilSet.has(iso)) continue;
    denenen++;
    const sonuc = await corsProxyZinciriDene(_tcmbArshivUrl(iso), { timeoutMs: 8000, validator: VALIDATOR });
    if (sonuc) { console.log('[tcmb-kur] Arşivden:', iso); return sonuc.text; }
  }

  // TCMB tamamen erişilemez → alternatif JSON API'yi dene
  // (XML değil JSON döneceğinden özel işlem gerekir — null döndür, üst katman handle eder)
  console.warn('[tcmb-kur] TCMB XML tamamen erişilemez, alternatif JSON deneniyor...');
  return '__USE_ALT_JSON__'; // özel işaret
}

export function tcmbKurXmlParse(xmlText) {
  if (!xmlText || !xmlText.includes('<Tarih_Date')) return null;
  try {
    const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
    if (xml.querySelector('parsererror')) return null;

    const root = xml.querySelector('Tarih_Date');
    const tarihAttr = root ? root.getAttribute('Tarih') : null; // "27.06.2026"
    let tarihIso = null;
    if (tarihAttr) {
      const parts = tarihAttr.split('.');
      if (parts.length === 3) {
        const [gg, aa, yyyy] = parts;
        if (gg && aa && yyyy) tarihIso = `${yyyy}-${aa.padStart(2,'0')}-${gg.padStart(2,'0')}`;
      }
    }
    // Tarih attribute yoksa Date attribute'u dene (MM/DD/YYYY)
    if (!tarihIso) {
      const dateAttr = root?.getAttribute('Date');
      if (dateAttr) {
        const parts = dateAttr.split('/');
        if (parts.length === 3) {
          const [mm, dd, yyyy] = parts;
          if (mm && dd && yyyy) tarihIso = `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
        }
      }
    }
    if (!tarihIso) return null;

    const kurlar = {};
    xml.querySelectorAll('Currency').forEach(node => {
      const kod = node.getAttribute('Kod') || node.getAttribute('CurrencyCode');
      if (!kod) return;
      const unit = parseFloat(node.querySelector('Unit')?.textContent) || 1;
      // Alış: ForexBuying → BanknoteBuying yedek
      const alisRaw  = parseFloat(node.querySelector('ForexBuying')?.textContent)
                    || parseFloat(node.querySelector('BanknoteBuying')?.textContent) || 0;
      const satisRaw = parseFloat(node.querySelector('ForexSelling')?.textContent)
                    || parseFloat(node.querySelector('BanknoteSelling')?.textContent) || 0;
      if (!alisRaw && !satisRaw) return;
      kurlar[kod] = {
        alis:  alisRaw  ? +(alisRaw  / unit).toFixed(6) : null,
        satis: satisRaw ? +(satisRaw / unit).toFixed(6) : null,
        isim:  node.querySelector('Isim')?.textContent || node.querySelector('CurrencyName')?.textContent || kod,
        unit,
      };
    });
    if (!Object.keys(kurlar).length) return null;
    return { tarihIso, kurlar };
  } catch(e) {
    console.warn('[tcmb-parse] XML parse hatası:', e.message);
    return null;
  }
}

export function tcmbKurGecmiseKaydet(tarihIso, kurlar) {
  _coreState.DB.tcmbKurGecmis = _coreState.DB.tcmbKurGecmis || [];
  const idx = _coreState.DB.tcmbKurGecmis.findIndex(r => r.tarih === tarihIso);
  if (idx >= 0) {
    // Mevcut kaydı güncelle: gelen kurları mevcutla birleştir (merge)
    _coreState.DB.tcmbKurGecmis[idx] = {
      tarih: tarihIso,
      guncellendi: new Date().toISOString(),
      kurlar: { ..._coreState.DB.tcmbKurGecmis[idx].kurlar, ...kurlar }
    };
  } else {
    _coreState.DB.tcmbKurGecmis.push({ tarih: tarihIso, guncellendi: new Date().toISOString(), kurlar });
    // Eklendikten sonra sırala (push sıradışı olabilir)
    _coreState.DB.tcmbKurGecmis.sort((a, b) => a.tarih.localeCompare(b.tarih));
  }
}

export function tcmbHaftaSonuMu(dt) {
  const g = dt.getDay();
  return g === 0 || g === 6;
}

// ── Ana güncelleme orkestrasyonu (TCMB + özel API + backfill) ─
export async function tcmbKurlariniGuncelle(manuel = false) {
  // Zaten çalışıyorsa yeni istek atma
  if (_tcmbGuncellemeSuruyor) {
    if (manuel && typeof showToast === 'function') showToast('Kur güncellemesi zaten devam ediyor...', 'info');
    return false;
  }
  _tcmbGuncellemeSuruyor = true;

  const btn    = document.getElementById('btn-tcmb-guncelle');
  const status = document.getElementById('tcmb-guncelle-status');
  const sonGun = document.getElementById('tcmb-son-guncelleme');
  if (manuel && btn) { btn.disabled = true; btn.textContent = '⏳ Çekiliyor...'; }
  if (status) status.textContent = '';

  _coreState.DB.tcmbKur     = _coreState.DB.tcmbKur     || { tarih: null, guncellendi: null, sonKontrol: null, kurlar: {} };
  _coreState.DB.tcmbKurGecmis = _coreState.DB.tcmbKurGecmis || [];

  try {
    // ── 1) Bugünkü TCMB bültenini çek (today.xml + arşiv + alternatif JSON) ──
    const xmlSonuc = await tcmbKurXmlCek(null);
    let bugunVeriXml = null;
    let altJsonKullanildi = false;
    let altJsonKurlar = null;

    if (xmlSonuc && xmlSonuc !== '__USE_ALT_JSON__') {
      bugunVeriXml = tcmbKurXmlParse(xmlSonuc);
    }

    // TCMB XML tamamen başarısız → alternatif JSON API'ye düş
    if (!bugunVeriXml) {
      const altSonuc = await tcmbAlternatifJsonKurCek();
      if (altSonuc) {
        altJsonKullanildi = true;
        altJsonKurlar = altSonuc.kurlar;
        console.log('[tcmb-kur] Alternatif JSON API kullanılıyor');
      } else {
        const tcmbMsg = 'TCMB ve tüm alternatif kaynaklar başarısız — internet bağlantısını kontrol edin';
        if (status) { status.style.color = 'var(--danger)'; status.textContent = '✗ ' + tcmbMsg; }
        if (manuel && typeof showToast === 'function') showToast(tcmbMsg, 'error');
      }
    }

    _coreState.DB.tcmbKur.sonKontrol = localDateStr(new Date());

    // ── 2) Kurları uygulama kodlarına eşleştir ────────────────────────
    const bugunTarih = bugunVeriXml ? bugunVeriXml.tarihIso : localDateStr(new Date());
    const bugunKurlar = {};

    if (bugunVeriXml) {
      // TCMB XML başarılı: kod eşleştirmesi yap
      Object.keys(_coreState.CURRENCY_CONFIG).forEach(code => {
        const kk = _coreState.CURRENCY_CONFIG[code].kurKaynagi;
        if (kk?.tip === 'tcmb' && kk.tcmbKodu && bugunVeriXml.kurlar[kk.tcmbKodu]) {
          bugunKurlar[code] = bugunVeriXml.kurlar[kk.tcmbKodu];
        }
      });
    } else if (altJsonKullanildi && altJsonKurlar) {
      // Alternatif JSON: TCMB kodu = uygulama kodu (USD→USD, EUR→EUR vb.)
      Object.keys(_coreState.CURRENCY_CONFIG).forEach(code => {
        const kk = _coreState.CURRENCY_CONFIG[code].kurKaynagi;
        if (kk?.tip !== 'tcmb') return;
        const tcmbKodu = kk.tcmbKodu || code;
        if (altJsonKurlar[tcmbKodu]) {
          bugunKurlar[code] = altJsonKurlar[tcmbKodu];
        } else if (altJsonKurlar[code]) {
          bugunKurlar[code] = altJsonKurlar[code];
        }
      });
    }

    // ── 3) Özel API kaynakları — PARALEL çek ──────────────────────────
    const ozelApiHatalari = [];
    const ozelCodes = Object.keys(_coreState.CURRENCY_CONFIG).filter(code => {
      const kk = _coreState.CURRENCY_CONFIG[code].kurKaynagi;
      return kk?.tip === 'ozel';
    });

    if (ozelCodes.length) {
      const ozelSonuclar = await Promise.allSettled(
        ozelCodes.map(async (code) => {
          const cfg = _coreState.CURRENCY_CONFIG[code];
          const kk = cfg.kurKaynagi;
          const kaynaklar = Array.isArray(kk.kaynaklar) && kk.kaynaklar.length
            ? kk.kaynaklar
            : (kk.url ? [{ url: kk.url, jsonPathAlis: kk.jsonPathAlis, jsonPathSatis: kk.jsonPathSatis, kurBirimi: kk.kurBirimi || 'TRY' }] : []);
          if (!kaynaklar.length) throw new Error('kaynak yok');
          const sonuc = await ozelKaynaklarKurCek(kaynaklar);
          if (!sonuc) throw new Error('çekilemedi');
          return { code, cfg, sonuc };
        })
      );

      ozelSonuclar.forEach((res, i) => {
        const code = ozelCodes[i];
        if (res.status === 'rejected') { ozelApiHatalari.push(code); return; }
        const { cfg, sonuc } = res.value;
        const kurBirimi = sonuc.kurBirimi || 'TRY';
        if (kurBirimi === 'TRY') {
          bugunKurlar[code] = { alis: sonuc.alis, satis: sonuc.satis, isim: cfg.ad || code };
        } else {
          const araKur = bugunKurlar[kurBirimi];
          const araOran = araKur ? (araKur.satis || araKur.alis) : null;
          if (araOran) {
            bugunKurlar[code] = {
              alis:  sonuc.alis  !== null ? +(sonuc.alis  * araOran).toFixed(6) : null,
              satis: sonuc.satis !== null ? +(sonuc.satis * araOran).toFixed(6) : null,
              isim: cfg.ad || code
            };
          } else { ozelApiHatalari.push(code); }
        }
      });
    }

    // ── 4) Bugünkü veriyi kaydet ───────────────────────────────────────
    tcmbKurGecmiseKaydet(bugunTarih, bugunKurlar);
    _coreState.DB.tcmbKur = {
      tarih: bugunTarih,
      guncellendi: new Date().toISOString(),
      sonKontrol: localDateStr(new Date()),
      kurlar: bugunKurlar
    };
    saveData();
    if (typeof renderTanimlamalar === 'function') renderTanimlamalar();
    if (sonGun) sonGun.textContent = 'Son: ' + bugunTarih;

    // ── 5) Geçmiş backfill — eksik iş günlerini TOPLU paralel doldur ──
    // En fazla TCMB_BACKFILL_GUN_LIMIT gün geriye gider.
    // Backfill aynı anda en fazla 3 istek paralel çalışır (proxy aşırı yüklenmesin).
    let dolduralan = 0;
    try {
      if (_coreState.DB.tcmbKurGecmis.length > 1) {
        const mevcutTarihler = new Set(_coreState.DB.tcmbKurGecmis.map(r => r.tarih));
        const tatilSet = typeof getTatilSet === 'function' ? getTatilSet() : new Set();
        const tcmbKodlar = Object.keys(_coreState.CURRENCY_CONFIG).filter(code => {
          const kk = _coreState.CURRENCY_CONFIG[code].kurKaynagi;
          return kk?.tip === 'tcmb' && kk.tcmbKodu;
        });

        const limitTarih = new Date();
        limitTarih.setDate(limitTarih.getDate() - TCMB_BACKFILL_GUN_LIMIT);
        const enEskiKayit = _coreState.DB.tcmbKurGecmis[0].tarih;
        const enEskiDt = new Date(enEskiKayit + 'T00:00:00');
        enEskiDt.setDate(enEskiDt.getDate() + 1);
        const baslangicDt = enEskiDt > limitTarih ? enEskiDt : limitTarih;
        const bitisDt = new Date(bugunTarih + 'T00:00:00');

        // Eksik iş günlerini listele
        const eksikGunler = [];
        for (let d = new Date(baslangicDt); d <= bitisDt; d.setDate(d.getDate() + 1)) {
          const iso = localDateStr(d);
          if (!mevcutTarihler.has(iso) && !tcmbHaftaSonuMu(d) && !tatilSet.has(iso)) {
            eksikGunler.push(iso);
          }
        }

        // Paralel batch (3'erli) olarak çek
        const BATCH = 3;
        for (let i = 0; i < eksikGunler.length; i += BATCH) {
          const batch = eksikGunler.slice(i, i + BATCH);
          const batchSonuclar = await Promise.allSettled(
            batch.map(iso => tcmbKurXmlCek(iso).then(xml => ({ iso, xml })))
          );
          for (const res of batchSonuclar) {
            if (res.status !== 'fulfilled' || !res.value.xml) continue;
            const { iso, xml } = res.value;
            const veri = tcmbKurXmlParse(xml);
            if (!veri || mevcutTarihler.has(veri.tarihIso)) continue;
            const eslesmis = {};
            tcmbKodlar.forEach(code => {
              const tk = _coreState.CURRENCY_CONFIG[code].kurKaynagi.tcmbKodu;
              if (veri.kurlar[tk]) eslesmis[code] = veri.kurlar[tk];
            });
            tcmbKurGecmiseKaydet(veri.tarihIso, eslesmis);
            mevcutTarihler.add(veri.tarihIso);
            dolduralan++;
          }
          // Batch'ler arası küçük bekleme (proxy rate-limit)
          if (i + BATCH < eksikGunler.length) await new Promise(r => setTimeout(r, 400));
        }
        if (dolduralan) { saveData(); if (typeof renderTanimlamalar === 'function') renderTanimlamalar(); }
      }
    } catch(e) {
      console.warn('[tcmb-kur] geçmiş doldurma hatası:', e.message);
    }

    // ── 6) Kullanıcı bildirim ─────────────────────────────────────────
    const ozelHataMsg = ozelApiHatalari.length ? ` · ${ozelApiHatalari.join(', ')} için kur çekilemedi` : '';
    const basarili = !!(bugunVeriXml || altJsonKullanildi);
    const kaynakEtiket = altJsonKullanildi ? ' (alternatif kaynak)' : '';
    if (status && basarili) {
      status.style.color = ozelApiHatalari.length ? 'var(--warn)' : 'var(--teal)';
      status.textContent = `✓ Güncellendi (${bugunTarih})${kaynakEtiket}${dolduralan ? ` · ${dolduralan} eksik gün eklendi` : ''}${ozelHataMsg}`;
    }
    if (manuel && typeof showToast === 'function' && basarili) {
      showToast(
        `Kurlar güncellendi${kaynakEtiket}${dolduralan ? ` — ${dolduralan} eksik gün` : ''}${ozelHataMsg}`,
        ozelApiHatalari.length ? 'warn' : 'success'
      );
    }

  } catch(e) {
    console.error('[tcmb-kur] beklenmedik hata:', e);
    if (status) { status.style.color = 'var(--danger)'; status.textContent = '✗ Hata: ' + e.message; }
  } finally {
    _tcmbGuncellemeSuruyor = false;
    if (manuel && btn) { btn.disabled = false; btn.textContent = '🔄 TCMB Kurlarını Güncelle'; }
    if (status) setTimeout(() => { if(status) status.textContent = ''; }, 7000);
  }
  return true;
}

// ── Günlük otomatik kontrol / kur getter'ları ────────────────
export function tcmbKurGunlukKontrolEt() {
  const bugun = localDateStr(new Date());
  const sonKontrol = _coreState.DB.tcmbKur?.sonKontrol;
  if (sonKontrol === bugun) return; // Bugün zaten çekildi

  // Hafta sonu ise: son kayıtlı verisi varsa çekme (TCMB yayınlamaz)
  const bugunDt = new Date();
  if (tcmbHaftaSonuMu(bugunDt) && _coreState.DB.tcmbKurGecmis?.length) return;

  tcmbKurlariniGuncelle(false);
}

export function getTcmbKur(code, tarihStr) {
  const gecmis = _coreState.DB.tcmbKurGecmis || [];
  if (!gecmis.length) return null;
  const hedefTarih = tarihStr || localDateStr(new Date());
  let secili = null;
  for (const row of gecmis) {
    if (row.tarih > hedefTarih) break;
    if (row.kurlar && row.kurlar[code]) secili = row;
  }
  return (secili && secili.kurlar && secili.kurlar[code]) || null;
}

// ── Tanımlamalar: Kur Geçmişi modalı ─────────────────────────
export function populateTcmbGecmisModal() {
  const sel = document.getElementById('tg-pb-filtre');
  if (sel) {
    // Otomatik bir kaynaktan (TCMB veya özel API) kuru çekilebilen birimleri listele — manuel hariç.
    const uygun = Object.keys(_coreState.CURRENCY_CONFIG).filter(c => {
      if (c === 'TRY') return false;
      const kk = _coreState.CURRENCY_CONFIG[c].kurKaynagi;
      return kk && (kk.tip === 'tcmb' || kk.tip === 'ozel');
    });
    const onceki = sel.value;
    sel.innerHTML = uygun.map(c => {
      const cfg = _coreState.CURRENCY_CONFIG[c];
      const kk = cfg.kurKaynagi || {};
      const kaynakLabel = kk.tip === 'tcmb' ? 'TCMB' : kk.tip === 'ozel' ? 'Özel API' : '';
      return `<option value="${c}">${cfg.flag || ''} ${c}${kaynakLabel ? ' (' + kaynakLabel + ')' : ''}</option>`;
    }).join('');
    if (onceki && uygun.includes(onceki)) sel.value = onceki;
    else if (uygun.includes('USD')) sel.value = 'USD';
  }
  // Varsayılan tarih aralığı: son 30 gün
  const bitisEl = document.getElementById('tg-bitis');
  const baslangicEl = document.getElementById('tg-baslangic');
  if (bitisEl && !bitisEl.value) bitisEl.value = localDateStr(new Date());
  if (baslangicEl && !baslangicEl.value) {
    const d = new Date(); d.setDate(d.getDate() - 30);
    baslangicEl.value = localDateStr(d);
  }
  renderTcmbGecmis();
}

export function renderTcmbGecmis() {
  const tbody = document.getElementById('tg-tbody');
  if (!tbody) return;
  const code = document.getElementById('tg-pb-filtre').value;
  const baslangic = document.getElementById('tg-baslangic').value || '0000-01-01';
  const bitis = document.getElementById('tg-bitis').value || '9999-12-31';

  // Kayıtlar artık doğrudan uygulama koduyla saklanıyor (bkz. tcmbKurlariniGuncelle) — tcmbKodu çevirisi gerekmez.
  const gecmis = (_coreState.DB.tcmbKurGecmis || [])
    .filter(r => r.tarih >= baslangic && r.tarih <= bitis)
    .slice()
    .sort((a, b) => b.tarih.localeCompare(a.tarih)); // en yeni üstte

  const sayacEl = document.getElementById('tg-kayit-sayisi');
  if (sayacEl) sayacEl.textContent = `${gecmis.length} gün listeleniyor`;

  if (!gecmis.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:20px">Seçilen aralıkta kayıt bulunamadı</td></tr>';
    return;
  }

  tbody.innerHTML = gecmis.map(row => {
    const kur = row.kurlar && row.kurlar[code];
    const fmtKur = (v) => (v === null || v === undefined) ? '<span style="color:var(--text3)">—</span>' : ('₺' + v.toLocaleString('tr-TR', {minimumFractionDigits:4, maximumFractionDigits:4}));
    const alis = fmtKur(kur && kur.alis);
    const satis = fmtKur(kur && kur.satis);
    return `<tr>
      <td class="mono">${fmtDate(row.tarih)}</td>
      <td><span class="badge badge-blue mono">${code}</span></td>
      <td class="mono">${alis}</td>
      <td class="mono">${satis}</td>
    </tr>`;
  }).join('');
}

// ── Tanımlamalar: Özel Kur Kaynağı yönetimi UI'ı ─────────────
export function pbKurTipDegisti() {
  const tip = document.getElementById('pb-kur-tip').value;
  document.getElementById('pb-kur-tcmb-alanlar').style.display  = tip === 'tcmb'   ? '' : 'none';
  document.getElementById('pb-kur-ozel-alanlar').style.display   = tip === 'ozel'   ? '' : 'none';
  document.getElementById('pb-kur-manuel-alanlar').style.display = tip === 'manuel' ? '' : 'none';
}

export function pbKaynakListesiRender() {
  const el = document.getElementById('pb-kaynak-listesi');
  if (!el) return;
  const kurCodes = Object.keys(_coreState.CURRENCY_CONFIG);
  el.innerHTML = _pbKaynaklar.map((k, i) => {
    const opts = kurCodes.map(c => `<option value="${c}"${k.kurBirimi===c?' selected':''}>${c}</option>`).join('');
    return `<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;gap:6px;align-items:center">
        <input placeholder="URL (https://...)" value="${(k.url||'').replace(/"/g,'&quot;')}"
          id="pb-url-${i}" data-idx="${i}" class="pb-kaynak-url-input"
          style="flex:1;font-size:12px;padding:5px 8px;border-radius:6px;border:1px solid var(--border2);background:var(--surface1);color:var(--text1)">
        <button type="button" class="pb-kaynak-test-btn" data-idx="${i}" id="pb-test-btn-${i}"
          style="background:var(--accent-glow2);border:1px solid var(--border-active);color:var(--gold);cursor:pointer;font-size:11px;font-weight:600;padding:5px 10px;border-radius:6px;flex-shrink:0;white-space:nowrap">🧪 Test Et</button>
        <button type="button" class="pb-kaynak-sil-btn" data-idx="${i}"
          style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px;padding:2px 6px;flex-shrink:0">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px;align-items:center">
        <input placeholder="JSON Path Alış" value="${(k.jsonPathAlis||'').replace(/"/g,'&quot;')}"
          id="pb-path-alis-${i}" data-idx="${i}" class="pb-kaynak-alis-input"
          style="font-size:11px;padding:4px 7px;border-radius:6px;border:1px solid var(--border2);background:var(--surface1);color:var(--text1)">
        <input placeholder="JSON Path Satış" value="${(k.jsonPathSatis||'').replace(/"/g,'&quot;')}"
          id="pb-path-satis-${i}" data-idx="${i}" class="pb-kaynak-satis-input"
          style="font-size:11px;padding:4px 7px;border-radius:6px;border:1px solid var(--border2);background:var(--surface1);color:var(--text1)">
        <select data-idx="${i}" class="pb-kaynak-birim-select"
          style="font-size:11px;padding:4px 6px;border-radius:6px;border:1px solid var(--border2);background:var(--surface1);color:var(--text1)">${opts}</select>
      </div>
      <div id="pb-test-sonuc-${i}"></div>
    </div>`;
  }).join('');
  // [ES module] onclick="pbKaynakTestEt(...)" ve onclick="_pbKaynaklar.splice(...);pbKaynakListesiRender()"
  // kaldırılmıştı; aynı şekilde oninput/onchange="window._pbKaynaklar[i]...=this.value" inline
  // attribute'ları da kaldırıldı (window._pbKaynaklar global'ine artık gerek yok - modül
  // scope'undaki _pbKaynaklar'a addEventListener ile doğrudan erişiliyor).
  el.querySelectorAll('.pb-kaynak-url-input').forEach(inp => {
    inp.addEventListener('input', () => { _pbKaynaklar[Number(inp.getAttribute('data-idx'))].url = inp.value; });
  });
  el.querySelectorAll('.pb-kaynak-alis-input').forEach(inp => {
    inp.addEventListener('input', () => { _pbKaynaklar[Number(inp.getAttribute('data-idx'))].jsonPathAlis = inp.value; });
  });
  el.querySelectorAll('.pb-kaynak-satis-input').forEach(inp => {
    inp.addEventListener('input', () => { _pbKaynaklar[Number(inp.getAttribute('data-idx'))].jsonPathSatis = inp.value; });
  });
  el.querySelectorAll('.pb-kaynak-birim-select').forEach(sel => {
    sel.addEventListener('change', () => { _pbKaynaklar[Number(sel.getAttribute('data-idx'))].kurBirimi = sel.value; });
  });
  el.querySelectorAll('.pb-kaynak-test-btn').forEach(btn => {
    btn.addEventListener('click', () => pbKaynakTestEt(Number(btn.getAttribute('data-idx'))));
  });
  el.querySelectorAll('.pb-kaynak-sil-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _pbKaynaklar.splice(Number(btn.getAttribute('data-idx')), 1);
      pbKaynakListesiRender();
    });
  });
}

export async function pbFetchJsonDenemeli(hedefUrl) {
  const sonuc = await corsProxyZinciriDene(hedefUrl, {
    timeoutMs: 8000,
    validator: (text) => { try { JSON.parse(text); return true; } catch(e) { return false; } }
  });
  if (!sonuc) return null;
  try { return { json: JSON.parse(sonuc.text), kaynak: sonuc.kaynak }; }
  catch(e) { return null; }
}

export async function tekKaynakKurCek(kaynak) {
  const hedefUrl = kaynak.url.trim();
  const sonuc = await pbFetchJsonDenemeli(hedefUrl);
  if (!sonuc) return null;
  const alis  = paraSayiyaCevir(kaynak.jsonPathAlis  ? jsonPathOku(sonuc.json, kaynak.jsonPathAlis)  : null);
  const satis = paraSayiyaCevir(kaynak.jsonPathSatis ? jsonPathOku(sonuc.json, kaynak.jsonPathSatis) : null);
  if (alis !== null || satis !== null) return { alis, satis, kurBirimi: kaynak.kurBirimi || 'TRY' };
  return null;
}

export async function ozelKaynaklarKurCek(kaynaklar) {
  if (!kaynaklar || !kaynaklar.length) return null;
  return new Promise(resolve => {
    let kalan = kaynaklar.length;
    let bitti = false;
    kaynaklar.forEach(kaynak => {
      tekKaynakKurCek(kaynak).then(sonuc => {
        if (sonuc && !bitti) { bitti = true; resolve(sonuc); }
        else if (!sonuc) { kalan--; if (kalan === 0 && !bitti) resolve(null); }
      }).catch(() => { kalan--; if (kalan === 0 && !bitti) resolve(null); });
    });
  });
}

export async function pbKaynakTestEt(i) {
  const kaynak = _pbKaynaklar[i];
  const sonucEl = document.getElementById('pb-test-sonuc-' + i);
  const btn = document.getElementById('pb-test-btn-' + i);
  if (!kaynak || !kaynak.url || !kaynak.url.trim()) {
    if (sonucEl) sonucEl.innerHTML = pbTestMesaj('Önce bir URL girin.', 'error');
    return;
  }
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Deneniyor...'; }
  if (sonucEl) sonucEl.innerHTML = pbTestMesaj('Kaynak deneniyor (proxy zinciri sırayla deneniyor)...', 'info');

  const sonuc = await pbFetchJsonDenemeli(kaynak.url.trim());

  if (btn) { btn.disabled = false; btn.textContent = '🧪 Test Et'; }

  if (!sonuc || !sonuc.json) {
    if (sonucEl) sonucEl.innerHTML = pbTestMesaj('Hiçbir yöntemle veri çekilemedi. URL\'i kontrol edin veya kaynak CORS/proxy ile uyumlu olmayabilir.', 'error');
    return;
  }

  _pbTestJsonCache[i] = sonuc.json;
  const yollar = pbJsonYollariBul(sonuc.json);

  if (!yollar.length) {
    if (sonucEl) sonucEl.innerHTML = pbTestMesaj('Bağlantı başarılı ama JSON içinde sayısal/metinsel bir alan bulunamadı.', 'error');
    return;
  }

  if (sonucEl) {
    sonucEl.innerHTML = pbTestSonucRender(i, sonuc.kaynak, yollar);
    // [ES module] onclick="pbPathSec(...)" kaldırıldı.
    sonucEl.querySelectorAll('.pb-path-sec-btn').forEach(btn => {
      btn.addEventListener('click', () => pbPathSec(Number(btn.getAttribute('data-idx')), btn.getAttribute('data-tur'), btn.getAttribute('data-path')));
    });
  }
}

export function pbJsonYollariBul(obj, maxDepth) {
  maxDepth = maxDepth || 6;
  const sonuclar = [];
  const ETIKET_ANAHTAR = /^(ad|isim|name|kod|code|currency|symbol|sembol|birim|unit)$/i;

  function gez(node, path, depth, ebeveynEtiket) {
    if (depth > maxDepth || sonuclar.length > 400) return;
    if (node === null || node === undefined) return;

    if (typeof node === 'number') {
      sonuclar.push({ path, value: node, label: ebeveynEtiket });
      return;
    }
    if (typeof node === 'string') {
      const n = paraSayiyaCevir(node);
      if (n !== null && node.trim() !== '') {
        sonuclar.push({ path, value: node, numericValue: n, label: ebeveynEtiket });
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, idx) => {
        let etiket = null;
        if (item && typeof item === 'object') {
          for (const k of Object.keys(item)) {
            if (ETIKET_ANAHTAR.test(k) && (typeof item[k] === 'string' || typeof item[k] === 'number')) {
              etiket = String(item[k]); break;
            }
          }
        }
        gez(item, path ? `${path}.${idx}` : String(idx), depth + 1, etiket);
      });
      return;
    }
    if (typeof node === 'object') {
      for (const k of Object.keys(node)) {
        if (ETIKET_ANAHTAR.test(k)) continue; // etiket alanlarını ayrı path olarak listelemeye gerek yok
        gez(node[k], path ? `${path}.${k}` : k, depth + 1, ebeveynEtiket);
      }
      return;
    }
  }
  gez(obj, '', 0, null);
  return sonuclar;
}

export function pbTestSonucRender(i, kaynakAdi, yollar) {
  const MAKS_GOSTER = 60;
  const gosterilecek = yollar.slice(0, MAKS_GOSTER);
  const satirlar = gosterilecek.map((y, idx) => {
    const pathEsc = y.path.replace(/'/g, "\\'");
    const etiketHtml = y.label ? `<span style="color:var(--text3);font-size:10px;margin-left:4px">(${escapeHtml(y.label)})</span>` : '';
    return `<div class="pb-path-row" style="display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:5px;font-size:11px" onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background='transparent'">
      <code style="flex:1;color:var(--text2);font-family:var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(y.path)}">${escapeHtml(y.path) || '(kök)'}${etiketHtml}</code>
      <span style="color:var(--accent);font-weight:600;font-family:var(--mono);white-space:nowrap">${escapeHtml(String(y.value))}</span>
      <button type="button" class="pb-path-sec-btn" data-idx="${i}" data-tur="alis" data-path="${escapeHtml(y.path)}"
        style="background:var(--teal-glow);border:1px solid var(--teal);color:var(--teal);font-size:10px;font-weight:600;padding:3px 7px;border-radius:5px;cursor:pointer;flex-shrink:0">Alış</button>
      <button type="button" class="pb-path-sec-btn" data-idx="${i}" data-tur="satis" data-path="${escapeHtml(y.path)}"
        style="background:var(--rose-glow);border:1px solid var(--rose);color:var(--rose);font-size:10px;font-weight:600;padding:3px 7px;border-radius:5px;cursor:pointer;flex-shrink:0">Satış</button>
    </div>`;
  }).join('');
  const fazlaUyari = yollar.length > MAKS_GOSTER
    ? `<div style="font-size:10.5px;color:var(--text3);padding:4px 6px">+ ${yollar.length - MAKS_GOSTER} alan daha (filtrelemek için path'i elle yazabilirsiniz)</div>` : '';
  return `<div style="background:var(--surface1);border:1px solid var(--teal);border-radius:7px;padding:8px;margin-top:2px">
    <div style="font-size:10.5px;color:var(--teal);font-weight:600;margin-bottom:6px">✓ ${escapeHtml(kaynakAdi)} ile bağlandı — ${yollar.length} alan bulundu, Alış/Satış için tıklayın:</div>
    <div style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:1px">${satirlar}</div>
    ${fazlaUyari}
  </div>`;
}

export function pbTestMesaj(msg, tip) {
  const renk = tip === 'error' ? 'var(--danger)' : (tip === 'info' ? 'var(--text2)' : 'var(--teal)');
  const bg = tip === 'error' ? 'var(--rose-glow)' : 'var(--surface1)';
  const border = tip === 'error' ? 'var(--rose)' : 'var(--border2)';
  return `<div style="font-size:11px;color:${renk};background:${bg};border:1px solid ${border};border-radius:7px;padding:8px 10px;margin-top:2px">${escapeHtml(msg)}</div>`;
}

export function pbPathSec(i, tur, path) {
  if (!_pbKaynaklar[i]) return;
  if (tur === 'alis') {
    _pbKaynaklar[i].jsonPathAlis = path;
    const inp = document.getElementById('pb-path-alis-' + i);
    if (inp) inp.value = path;
  } else {
    _pbKaynaklar[i].jsonPathSatis = path;
    const inp = document.getElementById('pb-path-satis-' + i);
    if (inp) inp.value = path;
  }
  showToast((tur === 'alis' ? 'Alış' : 'Satış') + ' alanı seçildi: ' + (path || '(kök)'));
}

export function pbKaynakEkle() {
  _pbKaynaklar.push({ url: '', jsonPathAlis: '', jsonPathSatis: '', kurBirimi: 'TRY' });
  pbKaynakListesiRender();
}

// ── CORS proxy worker ayarları (kaydet/yükle) ────────────────
export function saveCorsProxyWorker(val) {
  _coreState.DB.ayarlar = _coreState.DB.ayarlar || {};
  _coreState.DB.ayarlar.corsProxyWorker = val.trim() || null;
  saveData();
}

export function loadCorsProxyWorkerInput() {
  const inp = document.getElementById('cors-proxy-worker-url');
  if (inp && _coreState.DB?.ayarlar?.corsProxyWorker) inp.value = _coreState.DB.ayarlar.corsProxyWorker;
}


// "1.234,56" / "1234.56" / "1,234.56" gibi farklı yazımları sayıya çevirir.
export function paraSayiyaCevir(v) {  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  let s = String(v).trim();
  if (!s) return null;
  // Türkçe format (1.234,56) -> önce binlik noktaları sil, virgülü noktaya çevir
  if (/,\d{1,6}$/.test(s) && s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, ''); // İngilizce binlik virgülü
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// [ES module] Bu dosyada tanımlanan aşağıdaki değişkenler başka dosyalarda
// yeniden atanıyordu (import edilen bir binding'e doğrudan atama ES
// module'de yasaktır). Bu setter fonksiyonları o davranışı korumak için
// eklendi - ilgili dosyalar artık `X = v` yerine `setX(v)` çağırıyor.
export function set_pbTestJsonCache(v) { _pbTestJsonCache = v; }
export function set_pbKaynaklar(v) { _pbKaynaklar = v; }

// ============================================================
// [DI-MIGRATION] services.kurServisleri — container'a kayıt
// ------------------------------------------------------------
// Bu dosyanın TÜM export'ları 'services.kurServisleri' namespace'i altında
// container'a da kaydedilir. Yeni/taşınan tüketiciler artık:
//   import { resolve } from '@core/container.js';
//   const { getTcmbKur } = resolve('services.kurServisleri');
// şeklinde çekebilir; `import ... from '@services/kur-servisleri.js'`
// satırlarına ihtiyaç kalmaz. Bu dosyanın KENDİ üstteki importları
// (saveData, format, state, vb.) bir sonraki DI turunda, o modüller de
// container'a taşındığında kaldırılacak — bkz. DI-MIGRATION.md.
// ============================================================
import { provide } from '@core/container.js';
provide('services.kurServisleri', {
  _proxyHataKaydet, _proxyBasariKaydet, _proxySagliklimi, _cacheGet, _cacheSet,
  corsProxyZinciriOlustur, jsonPathOku, _tcmbArshivUrl, tcmbKurXmlParse, tcmbKurGecmiseKaydet,
  tcmbHaftaSonuMu, tcmbKurGunlukKontrolEt, getTcmbKur, populateTcmbGecmisModal,
  renderTcmbGecmis, pbKurTipDegisti, pbKaynakListesiRender, pbJsonYollariBul,
  pbTestSonucRender, pbTestMesaj, pbPathSec, pbKaynakEkle, saveCorsProxyWorker,
  loadCorsProxyWorkerInput, paraSayiyaCevir, set_pbTestJsonCache, set_pbKaynaklar,
  _parallelFetch, corsProxyZinciriDene, xauSpotCek, tcmbAlternatifJsonKurCek, tcmbKurXmlCek,
  tcmbKurlariniGuncelle, pbFetchJsonDenemeli, tekKaynakKurCek, ozelKaynaklarKurCek,
  pbKaynakTestEt, TCMB_BACKFILL_GUN_LIMIT,
  get _pbKaynaklar() { return _pbKaynaklar; },
  get _pbTestJsonCache() { return _pbTestJsonCache; },
  get _proxyHealth() { return _proxyHealth; },
  get _urlCache() { return _urlCache; },
  get _tcmbGuncellemeSuruyor() { return _tcmbGuncellemeSuruyor; },
});
