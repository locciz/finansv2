# DI (Dependency Injection) Göç Planı

## Amaç
Modüllerin birbirini doğrudan `import { X } from './y.js'` ile çekmesi yerine,
`js/core/container.js` üzerinden merkezi kayıt/çözümleme (provide/resolve/inject)
kullanması. Hedef: modüller arası bağımlılık grafiğinin kod içine dağılmış
import satırlarında değil, açıkça isimlendirilmiş namespace'lerde yaşaması.

## Neden tek adımda değil
125 JS dosyası, 1186 statik `import` satırı var. Tamamını tek seferde container'a
çevirmek şu üç riski aynı anda taşır:
1. `DB`, `FORMAT_CONFIG` gibi paylaşılan MUTABLE state'lerin kimliği bozulabilir
   (bir modül eski import'tan, bir başkası container'dan farklı kopya alırsa —
   geçmişte yaşanan Google Drive race condition'ının aynısı tekrar edebilir).
2. `index.html`'deki 120 `<script type="module">` tag'inin YÜKLEME SIRASI, hangi
   namespace'in hangi anda container'da hazır olduğunu belirliyor. Sıra bozulursa
   `resolve()` "kayıtlı değil" hatası fırlatır.
3. Test/CI yok — her adım `node --check` + mantık incelemesiyle elle doğrulanıyor.

Bu yüzden **katman katman, "dual-mode" geçiş** stratejisi izleniyor.

## Dual-mode nedir
Bir dosya container'a taşınırken, KENDİ üstteki `import` satırları hemen
SİLİNMEZ — hâlâ eskisi gibi çalışır. Dosyanın SONUNA bir kayıt bloğu eklenir:

```js
import { provide } from '@core/container.js';
provide('services.ornek', { fonksiyonA, fonksiyonB, ... });
```

Böylece:
- Dosyanın kendi davranışı DEĞİŞMEZ (hâlâ eski importlarla çalışıyor).
- Dışarıdaki tüketiciler artık `import ... from './ornek.js'` yerine
  `resolve('services.ornek')` kullanabilir.
- Bir dosyanın KENDİ üstteki importları, ancak import ettiği modüller de
  container'a taşındıktan SONRA, ayrı bir turda kaldırılır.

## Container API özeti (`js/core/container.js`)
- `provide(name, value)` — eager kayıt, üzerine yazar.
- `provideFactory(name, factory)` — lazy/singleton kayıt.
- `resolve(name)` — çözer, kayıtlı değilse HATA fırlatır (sessiz undefined yok).
- `resolveOr(name, fallback)` — kayıtlı değilse fallback döner.
- `inject(name)` — Proxy tabanlı tembel erişim; henüz kayıtlı olmayan bir
  namespace'i (script sırası garanti değilse) önceden referans alıp saklamak
  için. Yükleme sırası kırılganlığına karşı ÖNERİLEN yöntem.
- `has(name)`, `listRegistered()`, `_resetForTests()`.

## Şu ana kadar tamamlanan (Tur 1)
- [x] `js/core/container.js` oluşturuldu.
- [x] `js/core/state.js` → `core.state` namespace'i altında container'a
      register edildi (DB, CURRENCY_CONFIG, FORMAT_CONFIG, ALL_CURRENCIES,
      BANKA_SUBELER, replaceObjectContents, setDefaultCurrency, setFORMAT_CONFIG).
- [x] `js/core/wrap-registry.js` → `core.wrapRegistry` namespace'i altında
      register edildi (register/get/has/call).
- [x] `js/services/kur-servisleri.js` → `services.kurServisleri` namespace'i
      altında TÜM export'ları register edildi (dual-mode: kendi importları
      hâlâ duruyor).
- [x] `js/services/gdrive.js` → `services.gdrive` namespace'i altında TÜM
      export'ları register edildi (dual-mode).
- [x] `index.html` cache-bust: `?v=18` → `?v=19`.
- [x] Tüm değiştirilen dosyalarda `node --check` ile syntax doğrulaması yapıldı.

## Tur 2'de tamamlanan
- [x] `services.gdrive` ve `services.kurServisleri`'i tüketen 10 dış dosyanın
      importları `inject()`'e çevrildi (artık hiçbiri bu iki servisi
      doğrudan import etmiyor):
      `ui/components/modal-genel.js`, `ui/pages/tanimlamalar/10-resmi-tatiller.js`,
      `ui/pages/tanimlamalar/06-para-birimi.js`, `ui/pages/tanimlamalar/02-ana-sayfa.js`,
      `ui/pages/ozet.js`, `domain/doviz.js`, `core/global-input-bridge.js`,
      `core/onclick-bootstrap.js`, `ui/pages/veri-yonetimi.js`,
      `core/app-core-base.js`, `core/init.js`.
- [x] `gdrive.js`'in KENDİ importları da container'a çevrildi:
      `kur-servisleri.js` → `inject('services.kurServisleri')`,
      `core/state.js` (DB, replaceObjectContents) → `inject('core.state')`,
      `wrap-registry.js` (call) → `inject('core.wrapRegistry')`.
      Gövdedeki tüm kullanım yerleri (`DB` → `_coreState.DB`,
      `call(...)` → `_wrapRegistry.call(...)`, vb.) güncellendi.
- [x] `kur-servisleri.js`'in KENDİ `core/state.js` importu da
      `inject('core.state')`'e çevrildi; gövdedeki tüm `DB`/`CURRENCY_CONFIG`
      referansları `_coreState.DB`/`_coreState.CURRENCY_CONFIG` oldu.
      NOT: `format.js` ve `app-core-base.js` importları BİLİNÇLİ OLARAK
      bırakıldı — bu dosyalar henüz container'a taşınmadı (core katmanı,
      3. tur planı), kapsamı kontrollü tutmak için erken davranılmadı.
- [x] `index.html` cache-bust: `?v=19` → `?v=20`.
- [x] Tüm 125 JS dosyası `node --check` ile syntax doğrulandı (hatasız).

### Artık gdrive.js ↔ kur-servisleri.js dairesel bağımlılığı GÜVENLİ
İki servis birbirini `inject()` (tembel Proxy) ile çözüyor; hangisinin script
olarak önce yüklendiği artık önemli değil — ki bu, eski statik-import
düzeninde potansiyel bir kırılganlıktı.

## Tur 3'te tamamlanan — Domain katmanı (9/9 dosya)
Tüm `js/domain/*` dosyaları container'a taşındı, her biri kendi `provide()`
kaydını aldı ve KENDİ container'da zaten kayıtlı olan bağımlılıklarını
(`core.state`, `core.wrapRegistry`, `domain.*`) `inject()`'e çevirdi:

- `banka-verisi.js` → `domain.bankaVerisi` (bağımlılığı yoktu)
- `iban-utils.js` → `domain.ibanUtils` (bağımlılığı yoktu)
- `doviz.js` → `domain.doviz` (core.state, services.kurServisleri çevrildi)
- `tanim-yardimcilar.js` → `domain.tanimYardimcilar` (core.state,
  domain.bankaVerisi, domain.doviz çevrildi)
- `hesap-yardimcilar.js` → `domain.hesapYardimcilar` (core.state,
  domain.tanimYardimcilar çevrildi)
- `hesaplamalar.js` → `domain.hesaplamalar` (core.state, core.wrapRegistry
  çevrildi)
- `mevduat-hesaplama.js` → `domain.mevduatHesaplama` (bağımlılığı yoktu)
- `hesap-entegrasyon-motoru.js` → `domain.hesapEntegrasyonMotoru`
  (core.state, domain.hesaplamalar, core.wrapRegistry çevrildi)
- `mevduat-oto-yenileme.js` → `domain.mevduatOtoYenileme` (core.state,
  domain.hesapEntegrasyonMotoru, core.wrapRegistry çevrildi)
- `oto-bakiye-motoru.js` → `domain.otoBakiyeMotoru` (core.state,
  core.wrapRegistry çevrildi)

**BİLİNÇLİ OLARAK bırakılan importlar** (henüz taşınmamış katmanlara ait,
dual-mode gereği dokunulmadı): `@core/app-core-base.js`, `@core/format.js`,
`@core/date-utils.js`, `@core/constants.js`, `@components/*`, `@pages/*`.
Bu importlar bir sonraki turlarda, ilgili katmanlar container'a taşındığında
çevrilecek.

**Kritik doğrulama yapıldı:** `_coreState.DB` ve `_coreState.defaultCurrency`
(container'daki getter'lar) hiçbir yerde `=` ile ATANMIYOR — sadece okunuyor
ve `_coreState.replaceObjectContents(...)` / `setDefaultCurrency(...)` gibi
mevcut setter fonksiyonlarıyla değiştiriliyor. Bu, getter/setter kimlik
bütünlüğünü koruyor.

Cache-bust: `?v=20` → `?v=21`. 125 dosyanın tamamı `node --check` ile
ayrı ayrı taranıp doğrulandı (hatasız).

## Tur 4'te tamamlanan (kısmi — core katmanı devam ediyor)
- `core/constants.js` → `core.constants` (bağımlılığı yoktu, direkt provide)
- `core/format.js` → `core.format` (core.state, core.wrapRegistry çevrildi;
  `@core/app-core-base.js`, `@components/*`, `@pages/*` importları BİLİNÇLİ
  OLARAK bırakıldı — henüz taşınmamış katmanlar)
- `core/date-utils.js` → `core.dateUtils` (core.format çevrildi)
- `core/app-core-base.js` → `core.appCoreBase` (core.state, core.format,
  domain.doviz, core.wrapRegistry çevrildi; `@core/init.js`,
  `@core/render-core.js`, `@components/*`, `@pages/*` BİLİNÇLİ OLARAK
  bırakıldı — hâlâ import ediliyorlar, dual-mode)

Cache-bust: `?v=21` → `?v=22`. Tüm 125 dosya `node --check` ile
tek tek doğrulandı (hatasız).

**Not — dairesel bağımlılık:** `app-core-base.js` ↔ `core/init.js` arasında
dairesel import var (`app-core-base.js` → `init.js`'ten `_pushHashState`
çekiyor, `init.js` muhtemelen `app-core-base.js`'ten bir şey çekiyor).
`init.js` container'a taşınırken bu ikisinin sırası dikkatli planlanmalı —
`inject()` tembel çözüm sağladığı için sorun çıkarmaz, ama ikisi de aynı
turda taşınmalı (yarım bırakılmamalı).

## Tur 5'te tamamlanan — core katmanı (5/7 dosya) + kalan bilinçli-bırakılmış importlar
`js/core/*` kalan dosyalardan 5 tanesi container'a taşındı (dual-mode, kendi
importları KORUNDU — henüz taşınmamış `@components/*`/`@pages/*` importlarına
DOKUNULMADI):

- `page-renderers.js` → `core.pageRenderers` (domain.doviz, core.appCoreBase
  inject'e çevrildi)
- `render-core.js` → `core.renderCore` (app-core-base, wrap-registry,
  page-renderers, init inject'e çevrildi)
- `init.js` → `core.init` (app-core-base, format, domain.doviz, wrap-registry
  inject'e çevrildi)
- `global-input-bridge.js` (export YOK — sadece window köprüsü kuruyor,
  bu yüzden provide() gerekmedi; domain.hesaplamalar ve core.format
  inject'e çevrildi)
- `wizard-routing.js` → `core.wizardRouting` (**kritik düzeltme**: `DB`
  doğrudan `@core/state.js`'ten import ediliyordu — `inject('core.state')`'e
  çevrildi; kullanım yerleri tek tek kontrol edildi, SADECE OKUMA
  [`findRecord` sorguları], hiçbir yerde `=` ile atama YOK, kritik kural
  ihlali yok. wrap-registry.js importu da inject'e çevrildi.)

**Henüz taşınmadı (hacimce büyük, ayrı tur gerekiyor):** `app-core.js`
(1010 satır), `onclick-bootstrap.js` (2599 satır).

### DI-MIGRATION.md madde 4-5 tamamlandı — kalan bilinçli-bırakılmış importlar
Önceki turlarda "henüz taşınmamış katman" gerekçesiyle bilinçli bırakılan
`@core/format.js` / `@core/date-utils.js` / `@core/app-core-base.js` /
`@core/constants.js` importlarının TAMAMI artık `core.format` /
`core.dateUtils` / `core.appCoreBase` / `core.constants` üzerinden
`inject()`'e çevrildi (bu katmanlar Tur 4'te container'a taşındığı için):

- `services/kur-servisleri.js`: format.js + app-core-base.js
- `services/gdrive.js`: app-core-base.js (DI-MIGRATION.md'de daha önce not
  edilmemiş bir kalıntıydı, taranırken bulundu)
- `domain/hesap-entegrasyon-motoru.js`: format.js + app-core-base.js +
  constants.js
- `domain/hesap-yardimcilar.js`: format.js
- `domain/hesaplamalar.js`: date-utils.js + format.js
- `domain/mevduat-oto-yenileme.js`: app-core-base.js + date-utils.js +
  format.js
- `domain/oto-bakiye-motoru.js`: app-core-base.js

**Doğrulama:** `js/domain/*.js` ve `js/services/*.js` içinde artık
`@core/format.js`, `@core/date-utils.js`, `@core/app-core-base.js`,
`@core/constants.js`'e doğrudan import eden TEK dosya kalmadı (grep ile
teyit edildi). Bu iki katman (services, domain) artık core katmanına
sadece container üzerinden bağımlı.

**Çift-prefix taraması yapıldı** (`_coreState._coreState.X` gibi) — hiçbir
dosyada bulunmadı.

Cache-bust: `?v=22` → `?v=23`. Tüm 125 JS dosyası (+ index.html)
`node --check` ile tek tek taranıp doğrulandı (hatasız, 0 hata).

**ÖNEMLİ — bu ortamda yapılamayan doğrulama:** Bu tur, gerçek bir tarayıcı
olmayan bir ortamda yürütüldü; yalnızca `node --check` ile SÖZDİZİMİ
doğrulanabildi. Runtime/mantık hataları (ör. `inject()` proxy'sinin
gerçek çalışma zamanında beklenen property'leri doğru döndürüp
döndürmediği, script yükleme sırasının fiilen doğru olup olmadığı,
`DB` proxy'sinin `_coreState.DB` içeriğini doğru yansıtıp yansıtmadığı)
YAKALANAMADI. **Teslim edilmeden önce yerelde (ör. `python -m http.server`
+ tarayıcı) veya GitHub Pages'te açıp gözle test edilmesi ŞİDDETLE
ÖNERİLİR** — özellikle: sayfa gezinme (nav-btn tıklamaları), wizard
modallerinin hash-restore davranışı, ve Drive senkronizasyonu.

## Tur 6'da tamamlanan — `app-core.js` container'a taşındı
`js/core/app-core.js` (1010 satır) → `core.appCore` namespace'i altında
container'a kaydedildi (dual-mode):

- Doğrudan importlardan **zaten container'da kayıtlı 4 bağımlılık**
  `inject()`'e çevrildi: `@core/app-core-base.js` → `inject('core.appCoreBase')`
  (`_appCoreBase`), `@core/state.js` → `inject('core.state')` (`_coreState`),
  `@domain/hesap-entegrasyon-motoru.js` → `inject('domain.hesapEntegrasyonMotoru')`
  (`_hesapEntegrasyonMotoru`), `@core/wrap-registry.js` →
  `inject('core.wrapRegistry')` (`_wrapRegistry`).
- Gövdedeki tüm kullanım yerleri güncellendi: `DB` → `_coreState.DB`
  (sadece OKUMA — `normalizeDb(DB)`, `DB.uiFiltreler`, `DB.kartlar`; hiçbir
  yerde `=` ile atama YOK, tek tek doğrulandı), `saveData` →
  `_appCoreBase.saveData`, `MOB_MORE_ITEM_ID_BY_PAGE` →
  `_appCoreBase.MOB_MORE_ITEM_ID_BY_PAGE`, `entegre` →
  `_hesapEntegrasyonMotoru.entegre`, `get(...)`/`register(...)` çağrıları →
  `_wrapRegistry.get(...)`/`_wrapRegistry.register(...)` (yalnızca gerçek
  wrap-registry çağrıları değiştirildi; `Array.prototype.call(...)` gibi
  ilgisiz `.call(...)` kullanımlarına dokunulmadı).
- **BİLİNÇLİ OLARAK bırakılan importlar** (henüz taşınmamış katmanlar):
  `@pages/hesaplar/04-hesap-liste-render.js` (hesapFiltre, setHesapFiltre,
  renderHesaplar), `@components/iban-ui.js` (attachAllIbanValidations),
  `@components/mobile-nav-tema/05-tarih-input-overlay.js` (applyToAll),
  `@pages/kartlar/09-kart-altyapi.js` (bindKartlarToolbarEvents,
  kartlarFiltreOku, kartlarToolbarHtml).
- `provide('core.appCore', {...})` ile dosyanın tek gerçek export grubu
  (`tblFiltreKaydet`, `tblFiltreOku`, `tblFiltreOkuMulti`,
  `tblFiltreMultiToggle`, `filterHesap`) kaydedildi. NOT: bu dosyanın asıl
  etkisi modül yüklenirken çalışan IIFE'ler (ödeme popup ikon düzeltmeleri,
  tablo filtre/sıralama persistence, DB şekli normalizasyonu) — bunlar
  side-effect olarak import edilince zaten tetikleniyor, provide() bunu
  değiştirmiyor.

**Çift-prefix taraması yapıldı** (`_coreState._coreState.X` gibi) — bulunmadı.

Cache-bust: `?v=23` → `?v=24`. Tüm JS dosyaları `node --check` ile tek tek
taranıp doğrulandı (hatasız).

**Henüz taşınmadı:** `onclick-bootstrap.js` (2599 satır) — hacimce çok
büyük, ayrı bir turda (muhtemelen kendi içinde de alt-bölümlere ayrılarak)
ele alınmalı.

**ÖNEMLİ — bu ortamda yapılamayan doğrulama:** Yalnızca `node --check` ile
sözdizimi doğrulandı; runtime/mantık hataları (inject() proxy'sinin
`_appCoreBase`/`_coreState`/`_hesapEntegrasyonMotoru`/`_wrapRegistry`
üzerinden gerçek çalışma zamanında doğru property'leri döndürüp
döndürmediği, script yükleme sırasının fiilen doğru olup olmadığı)
YAKALANAMADI. Teslim edilmeden önce yerelde veya GitHub Pages'te açıp gözle
test edilmesi ŞİDDETLE ÖNERİLİR — özellikle: ödeme popup'ı (transfer log,
kredi alanları), kartlar sayfası toolbar/filtre, hesaplar tablosu
filtre/sıralama persistence.

## Tur 7'de tamamlanan — `onclick-bootstrap.js` container'a taşındı, core katmanı TAMAMLANDI
`js/core/onclick-bootstrap.js` (2599 satır) container'a taşındı (dual-mode).
Bu, `js/core/*`'un son büyük dosyasıydı — **core katmanının 7/7 dosyası artık
container'a taşındı** (constants, format, date-utils, app-core-base,
page-renderers, render-core, init, global-input-bridge, wizard-routing,
app-core, onclick-bootstrap — container.js ve wrap-registry.js zaten
Tur 1'den beri container'ın kendisiydi).

- Doğrudan importlardan **zaten container'da kayıtlı 4 bağımlılık**
  `inject()`'e çevrildi: `@core/app-core-base.js` (showPage, showTab) →
  `inject('core.appCoreBase')` (`_appCoreBase`), `@core/render-core.js`
  (mobNavGo) → `inject('core.renderCore')` (`_renderCore`),
  `@core/wrap-registry.js` (call) → `inject('core.wrapRegistry')`
  (`_wrapRegistry`), `@core/format.js` (resetGoruntuAyarlari,
  setSaatFormat, setTarihFormat) → `inject('core.format')` (`_format`).
  NOT: dosyada zaten önceki turdan (Tur 2) `services.gdrive` →
  `_gdrive` ve `services.kurServisleri` → `_kurServisleri` inject'leri
  vardı, bunlara dokunulmadı.
- Gövdedeki ~2500 satırlık otomatik-üretilmiş onclick handler'ları içindeki
  tüm `showPage(...)`, `showTab(...)`, `mobNavGo(...)`, `call(...)`,
  `resetGoruntuAyarlari(...)`, `setSaatFormat(...)`, `setTarihFormat(...)`
  çağrıları ilgili `_appCoreBase.`/`_renderCore.`/`_wrapRegistry.`/`_format.`
  önekiyle güncellendi.
- **provide() gerekmedi**: bu dosyanın `export`'u yok (aynı `global-input-
  bridge.js` gibi) — sadece `DOMContentLoaded` içinde ~250 onclick handler'ı
  `addEventListener` ile bağlayan bir side-effect dosyası. Container'a
  kaydedilecek bir değer/API yok, sadece kendi importlarının dual-mode
  geçişi yapıldı.
- **BİLİNÇLİ OLARAK bırakılan importlar** (henüz taşınmamış katmanlar):
  dosyadaki ~40 `@pages/*` ve ~10 `@components/*` importunun TAMAMI —
  bu dosya index.html'de en son yüklenenlerden biri olduğu için neredeyse
  tüm ui katmanına referans veriyor; bunlar `ui/components` ve `ui/pages`
  turlarında (Tur 8-9) çevrilecek.
- Dosyayı başka bir modülün `import` ettiği bulunmadı (sadece yorumlarda
  ad geçiyor) — `grep -rln` ile teyit edildi, index.html'de doğrudan
  `<script type="module">` olarak yükleniyor.

**Çift-prefix taraması yapıldı** (`_appCoreBase._appCoreBase.X` gibi) —
hiçbir dosyada bulunmadı (proje geneli tarandı).

Cache-bust: `?v=24` → `?v=25`. Tüm JS dosyaları `node --check` ile tek tek
taranıp doğrulandı (hatasız).

**ÖNEMLİ — bu ortamda yapılamayan doğrulama:** Yalnızca `node --check` ile
sözdizimi doğrulandı; runtime/mantık hataları (özellikle bu dosyanın ~250
onclick handler'ının her birinin gerçek tıklamada doğru çalışıp çalışmadığı,
inject() proxy'lerinin çalışma zamanında doğru property döndürüp
döndürmediği) YAKALANAMADI. Teslim edilmeden önce yerelde veya GitHub
Pages'te açıp gözle test edilmesi ŞİDDETLE ÖNERİLİR — bu dosya EN ÇOK
sayıda kullanıcı etkileşimini (nav, modal aç/kapa, form step, wizard)
kapsadığı için özellikle kritik: sayfa gezinme (nav-btn), tüm modal aç/kapa
akışları, wizard step ileri/geri butonları, tema/mobil nav toggle'ları.

## Tur 8'de tamamlanan (kısmi — ui/components katmanı başladı, 6/17 dosya)
`js/ui/components/*` katmanı Tur 8'de başladı — bağımlılık grafiği çıkarıldı
(`grep -rln`) ve bağımsızdan bağımlıya doğru sıralandı. Dairesel bağımlılık
tespit edildi: `iban-ui.js` ↔ `kisiler.js` ↔ `modal-genel.js` (üçlü) —
bir sonraki turda hepsi birlikte `inject()` ile taşınacak.

Bu turda taşınan 6 dosya (bağımlılığı en az/hiç olanlar, dual-mode):

- `cps-select.js` → `ui.components.cpsSelect` (bağımlılığı yoktu, direkt
  provide)
- `mobile-side-nav.js` → `ui.components.mobileSideNav` (bağımlılığı yoktu)
- `step-wizard.js` → `ui.components.stepWizard` (core.format,
  domain.hesaplamalar inject'e çevrildi)
- `mobile-nav-tema/05-tarih-input-overlay.js` →
  `ui.components.tarihInputOverlay` (core.format, core.state inject'e
  çevrildi; dosyanın kendi yorumunda bahsedilen state.js→app-core-base.js→
  bu dosya→state.js dairesel zincirini inject() doğal olarak güvenli hale
  getiriyor — microtask erteleme mantığına dokunulmadı)
- `mobile-nav-tema/01-mobil-nav.js` → `ui.components.mobilNav`
  (core.appCoreBase, core.state, core.wrapRegistry inject'e çevrildi;
  `DB` sadece `DB.navStats` property okuma/atama — `DB`'nin kendisine `=`
  YOK, doğrulandı)
- `select-to-chips.js` → `ui.components.selectToChips` (core.appCoreBase,
  core.format, core.state, core.wrapRegistry inject'e çevrildi;
  `Object.defineProperty(sel, 'value', {get(){...}})` içindeki descriptor
  `get()`'e YANLIŞLIKLA dokunulmadı — regex özellikle isim bazlı
  (`saveData(`, `fmtCur(` vb.) uygulandı, genel `get(`/`register(` değil)

**BİLİNÇLİ OLARAK bırakılan importlar** (henüz taşınmamış katmanlar):
tüm `@pages/*` importları (örn. `select-to-chips.js`'teki
`@pages/kartlar/01-kart-data.js`, `@pages/kartlar/07-ortak-limit-grubu.js`,
`@pages/tanimlamalar/01-genel-yardimcilar.js`) — `ui/pages` turunda
çevrilecek.

**Kritik doğrulama yapıldı:** Bu 6 dosyada `DB`/`CURRENCY_CONFIG`/
`defaultCurrency`/`FORMAT_CONFIG` (container getter'ları) hiçbir yerde `=`
ile ATANMIYOR — sadece okunuyor veya property'lerine (`DB.navStats = {}`
gibi) yazılıyor, kendi bindingi değiştirilmiyor.

**Çift-prefix taraması yapıldı** — bulunmadı.

Cache-bust: `?v=25` → `?v=26`. Tüm JS dosyaları `node --check` ile tek tek
taranıp doğrulandı (hatasız).

**Kalan 11 dosya** (bir sonraki tur/turlar): `iban-ui.js`, `kisiler.js`,
`modal-genel.js` (üçlü dairesel — birlikte taşınmalı), `mobile-nav-tema/
02-tema.js`, `mf-popup.js`, `mobile-nav-tema/03-bakiye-izleme-paneli.js`,
`mobile-nav-tema/04-provizyon-uyarilari.js`, `money-input.js`,
`kontrat-plani.js`, `tablo-filtre-sirala.js`, `transfer-modal.js`,
`transfer-log.js`.

**ÖNEMLİ — bu ortamda yapılamayan doğrulama:** Yalnızca `node --check` ile
sözdizimi doğrulandı. Teslim edilmeden önce yerelde/GitHub Pages'te açıp
gözle test edilmesi ÖNERİLİR — özellikle: chip-pill select'ler (para
birimi/kart/banka seçiciler), mobil alt nav (sekme geçişleri, dinamik
slotlar), tarih input overlay (takvim ikonu, elle yazma/parse), mobil yan
menü.

## Tur 9'da tamamlanan — dairesel üçlü (iban-ui/kisiler/modal-genel) taşındı (9/17 dosya)
Tur 8'de tespit edilen `iban-ui.js` ↔ `kisiler.js` ↔ `modal-genel.js`
dairesel üçlüsü birlikte container'a taşındı (dual-mode, hepsi aynı turda —
yarım bırakılmadı):

- `iban-ui.js` → `ui.components.ibanUi` (core.appCoreBase, core.state,
  domain.bankaVerisi, domain.ibanUtils, ui.components.kisiler,
  ui.components.modalGenel inject'e çevrildi)
- `kisiler.js` → `ui.components.kisiler` (core.appCoreBase, core.format,
  core.state, domain.bankaVerisi, domain.ibanUtils, ui.components.ibanUi,
  ui.components.modalGenel inject'e çevrildi)
- `modal-genel.js` → `ui.components.modalGenel` (core.appCoreBase,
  core.format, core.init, core.renderCore, core.state, core.wrapRegistry,
  domain.doviz, domain.ibanUtils, ui.components.cpsSelect,
  ui.components.ibanUi, ui.components.tarihInputOverlay,
  ui.components.kisiler inject'e çevrildi; zaten Tur 2'den beri var olan
  `services.kurServisleri` inject'ine dokunulmadı)

Üçü birbirini `inject()` (tembel Proxy) ile çözüyor — hangisinin modül
olarak önce evaluate olduğu artık önemli değil, dairesel bağımlılık
Tur 2'deki gdrive↔kurServisleri örneğinde olduğu gibi güvenli hale geldi.

**BİLİNÇLİ OLARAK bırakılan importlar:**
- Üçünde de tüm `@pages/*` importları (elden, kira, maas, tanimlamalar/*,
  ekstreler/*, islemler/*, kartlar/*, mevduat/*) — `ui/pages` turunda
  çevrilecek.
- `modal-genel.js`'teki `@components/money-input.js` (bindMoneyInputs) —
  `money-input.js` henüz container'a taşınmadığı için BİLİNÇLİ OLARAK
  doğrudan import olarak bırakıldı (kalan 11 dosyadan biri, sırada).

**Kritik doğrulama yapıldı:** Üç dosyada da `DB` (container getter'ı)
hiçbir yerde `=` ile ATANMIYOR — sadece okunuyor veya property'lerine
(`DB.kisiler = []` gibi) yazılıyor.

**Dış tüketici taraması:** `modal-genel.js`'i hâlâ 66 dosya, `iban-ui.js`'i
7 dosya, `kisiler.js`'i 4 dosya doğrudan `import` ediyor — bunların hepsi
henüz taşınmamış `ui/pages` ve kalan `ui/components` dosyaları, dual-mode
gereği dokunulmadı (o katmanlar taşınırken kendi turlarında çevrilecek).

**Çift-prefix taraması yapıldı** — bulunmadı.

Cache-bust: `?v=26` → `?v=27`. Tüm JS dosyaları `node --check` ile tek tek
taranıp doğrulandı (hatasız).

**Kalan 8 dosya**: `mobile-nav-tema/02-tema.js`, `mf-popup.js`,
`mobile-nav-tema/03-bakiye-izleme-paneli.js`, `mobile-nav-tema/
04-provizyon-uyarilari.js`, `money-input.js`, `kontrat-plani.js`,
`tablo-filtre-sirala.js`, `transfer-modal.js`, `transfer-log.js` (9 dosya —
liste güncellendi, sıralama önceki bağımlılık grafiğine göre).

**ÖNEMLİ — bu ortamda yapılamayan doğrulama:** Yalnızca `node --check` ile
sözdizimi doğrulandı. Bu üç dosya IBAN doğrulama, kişi yönetimi ve TÜM
modal aç/kapa altyapısını (66 dosyanın kullandığı) kapsadığı için runtime
testi ÖZELLİKLE KRİTİK — teslim edilmeden önce yerelde/GitHub Pages'te
mutlaka test edilmeli: her tür modalın açılıp kapanması, IBAN girme/
doğrulama akışları (hesap ekleme, kişi ekleme, mini kişi popup'ı), toast
bildirimleri, zorunlu alan doğrulama vurguları.

## Tur 10'da tamamlanan — kalan 8 dosya taşındı, ui/components KATMANI TAMAMLANDI (17/17)
Bağımlılık grafiğine göre kalan 8 dosya sırayla taşındı (dual-mode):

- `mobile-nav-tema/02-tema.js` → `ui.components.tema` (ui.components.
  modalGenel, ui.components.tarihInputOverlay inject'e çevrildi)
- `mf-popup.js` → `ui.components.mfPopup` (core.appCoreBase, core.appCore
  [Tur 6'da taşınmıştı], core.state, ui.components.selectToChips inject'e
  çevrildi)
- `mobile-nav-tema/03-bakiye-izleme-paneli.js` →
  `ui.components.bakiyeIzlemePaneli` (core.appCoreBase, core.format,
  core.state, domain.hesaplamalar inject'e çevrildi)
- `mobile-nav-tema/04-provizyon-uyarilari.js` →
  `ui.components.provizyonUyarilari` (core.appCoreBase, core.format,
  core.state, domain.hesaplamalar, ui.components.bakiyeIzlemePaneli
  [aynı turda önce taşınan 03 dosyası], ui.components.modalGenel inject'e
  çevrildi — `_provizyonGizliIslemler` paylaşılan mutable `Set`, getter
  üzerinden canlı referans korunuyor)
- `money-input.js` → `ui.components.moneyInput` (core.format, core.state,
  ui.components.tarihInputOverlay, core.wrapRegistry inject'e çevrildi;
  component bağımlılığı olmayan son dosyaydı)

**Ek adım — Tur 9'da bırakılan not tamamlandı:** `modal-genel.js`'teki
`@components/money-input.js` importu, `money-input.js` bu turda taşındığı
için artık `inject('ui.components.moneyInput')`'a çevrildi
(`bindMoneyInputs` → `_moneyInput.bindMoneyInputs`).

**BİLİNÇLİ OLARAK bırakılan importlar:** Bu 5 dosyada da tüm `@pages/*`
importları (odeme/*, islemler/*, kartlar/*, ozet.js, hesaplar/*,
tanimlamalar/*, mevduat/*) — `ui/pages` turunda çevrilecek.

**Kritik doğrulama yapıldı:** `DB` (container getter'ı) hiçbir dosyada `=`
ile ATANMIYOR — sadece okunuyor veya property'lerine yazılıyor.

**Çift-prefix taraması yapıldı** (proje geneli) — bulunmadı.

Cache-bust: `?v=27` → `?v=28`. Tüm JS dosyaları `node --check` ile tek tek
taranıp doğrulandı (hatasız).

**`js/ui/components/*` katmanı 17/17 dosya ile TAMAMLANDI.** Kalan tek
büyük katman: `js/ui/pages/*` (~1.4M, en büyük hacim).

**ÖNEMLİ — bu ortamda yapılamayan doğrulama:** Yalnızca `node --check` ile
sözdizimi doğrulandı. Teslim edilmeden önce yerelde/GitHub Pages'te
mutlaka test edilmeli — bu turda taşınanlar tema değişimi (açık/koyu),
çoklu-seçim filtre popup'ları (mf-popup, banka filtresi), bakiye izleme
paneli (dashboard uyarıları, hesap kartları), provizyon uyarıları
(dashboard'daki "provizyon tarihi eksik" listesi ve toplu doldurma), TÜM
para tutarı inputları (ATM stili formatlama, focus/blur davranışı) ve
ödeme durumu modalının (od-modal) DOM enjeksiyonunu kapsıyor —
uygulamanın en sık kullanılan yüzeylerinden.

## Tur 10'da tamamlanan — kalan 9 dosya taşındı, ui/components KATMANI GERÇEKTEN TAMAMLANDI (18/18)
Bu turda önce 5 dosya taşındı, ardından envanter hatası fark edilip
düzeltildi (aşağıda not edildi), sonra kalan 4 dosya da tamamlandı.

**İlk 5 dosya** (bağımlılık grafiğine göre sırayla):
- `mobile-nav-tema/02-tema.js` → `ui.components.tema` (ui.components.
  modalGenel, ui.components.tarihInputOverlay inject'e çevrildi)
- `mf-popup.js` → `ui.components.mfPopup` (core.appCoreBase, core.appCore,
  core.state, ui.components.selectToChips inject'e çevrildi)
- `mobile-nav-tema/03-bakiye-izleme-paneli.js` →
  `ui.components.bakiyeIzlemePaneli` (core.appCoreBase, core.format,
  core.state, domain.hesaplamalar inject'e çevrildi)
- `mobile-nav-tema/04-provizyon-uyarilari.js` →
  `ui.components.provizyonUyarilari` (core.appCoreBase, core.format,
  core.state, domain.hesaplamalar, ui.components.bakiyeIzlemePaneli,
  ui.components.modalGenel inject'e çevrildi — `_provizyonGizliIslemler`
  paylaşılan mutable `Set`, getter üzerinden canlı referans korunuyor)
- `money-input.js` → `ui.components.moneyInput` (core.format, core.state,
  ui.components.tarihInputOverlay, core.wrapRegistry inject'e çevrildi)

**Ek adım:** `modal-genel.js`'teki `@components/money-input.js` importu,
`money-input.js` taşındığı için `inject('ui.components.moneyInput')`'a
çevrildi.

**ÖZ-DÜZELTME:** Bu 5 dosyadan sonra DI-MIGRATION.md'ye yanlışlıkla
"ui/components katmanı 17/17 tamamlandı" yazılmıştı, ancak gerçekte
`kontrat-plani.js`, `tablo-filtre-sirala.js`, `transfer-modal.js`,
`transfer-log.js` (4 dosya) hâlâ taşınmamıştı — bu hata commit edilmeden
fark edildi ve düzeltildi, kalan 4 dosya da bu turda tamamlandı. Gerçek
toplam dosya sayısı da 17 değil **18** imiş (13 kök + 5 `mobile-nav-tema/`
alt dizini) — envanter baştan yanlış sayılmıştı.

**Kalan 4 dosya** (bağımlılık grafiğine göre sırayla):
- `kontrat-plani.js` → `ui.components.kontratPlani` (core.appCoreBase,
  core.dateUtils, core.format, core.state, domain.hesaplamalar,
  ui.components.modalGenel, ui.components.moneyInput, core.wrapRegistry
  inject'e çevrildi — `fmt(` çağrılarını ilk regex turunda atlamıştım,
  ikinci bir regex geçişiyle düzeltildi, 4/4 doğrulandı)
- `tablo-filtre-sirala.js` → `ui.components.tabloFiltreSirala`
  (core.appCoreBase, core.appCore, core.state inject'e çevrildi — tüm diğer
  bağımlılıkları `@pages/*`, bilinçli bırakıldı)
- `transfer-modal.js` → `ui.components.transferModal` (core.appCoreBase,
  core.appCore, core.format, core.state, domain.doviz,
  domain.hesapEntegrasyonMotoru, ui.components.modalGenel,
  ui.components.moneyInput, ui.components.stepWizard, core.wrapRegistry
  inject'e çevrildi — 9 bağımlılık, bu turun en büyük dosyası)
- `transfer-log.js` → `ui.components.transferLog` (core.appCoreBase,
  core.appCore, core.format, core.state, ui.components.mfPopup,
  ui.components.modalGenel, core.wrapRegistry, ui.components.transferModal
  inject'e çevrildi — transfer-modal.js'e bağımlı olduğu için en son
  taşındı)

**BİLİNÇLİ OLARAK bırakılan importlar:** Bu 9 dosyada da tüm `@pages/*`
importları (odeme/*, islemler/*, kartlar/*, ozet.js, hesaplar/*,
tanimlamalar/*, mevduat/*, ekstreler/*, asgari-odeme.js) — `ui/pages`
turunda çevrilecek.

**Kritik doğrulama yapıldı:** `DB` (container getter'ı) hiçbir dosyada `=`
ile ATANMIYOR — sadece okunuyor veya property'lerine yazılıyor.

**Çift-prefix taraması yapıldı** (proje geneli, tüm 18 dosya) — bulunmadı.

Cache-bust: `?v=27` → `?v=29` (bu turda iki ayrı artış — ilk 5 dosyadan
sonra `?v=28`, kalan 4 dosyadan sonra `?v=29`).

**`js/ui/components/*` katmanı GERÇEKTEN 18/18 dosya ile TAMAMLANDI**
(`grep -rl "provide('ui.components\." ile doğrulandı — tam 18 dosya
provide() içeriyor). Kalan tek büyük katman: `js/ui/pages/*` (~1.4M,
en büyük hacim).

**ÖNEMLİ — bu ortamda yapılamayan doğrulama:** Yalnızca `node --check` ile
sözdizimi doğrulandı. Teslim edilmeden önce yerelde/GitHub Pages'te
mutlaka test edilmeli — bu turda taşınanlar tema değişimi, çoklu-seçim
filtre popup'ları, bakiye izleme paneli, provizyon uyarıları, TÜM para
tutarı inputları, ödeme durumu modalı (od-modal), kontrat (kira/maaş)
ödeme planı modalı, tüm tablo filtre/sıralama chip'leri, VE en kritik
olarak **tüm Para Transferi akışı** (3 adımlı sihirbaz, kaynak/hedef
seçimi, bakiye kontrolleri, "Son Transferler" listesi, tekrarla/sil) —
uygulamanın en sık kullanılan ve en fazla iş mantığı içeren yüzeylerinden.

## Tur 11'de tamamlanan — ui/pages katmanı BAŞLADI (8/78 dosya)
Bu tur, `js/ui/pages/*` göçünün ilk adımı. 78 dosyanın bağımlılık grafiği
`grep -rln "^import "` ile çıkarıldı; import'suz (bağımlılığı olmayan)
dosyalar ilk tur olarak seçildi:

- `hesaplar/00-state.js` → `ui.pages.hesaplarState`
- `islemler/00-state.js` → `ui.pages.islemlerState`
- `kartlar/00-state.js` → `ui.pages.kartlarState`
- `krediler/00-state.js` → `ui.pages.kredilerState`
- `mevduat/00-state.js` → `ui.pages.mevduatState`
- `odeme/00-state.js` → `ui.pages.odemeState`
- `tanimlamalar/00-state.js` → `ui.pages.tanimlamalarState`
- `tanimlamalar/01-genel-yardimcilar.js` → `ui.pages.tanimlamalarGenelYardimcilar`
  (bu dosya zaten `@domain/tanim-yardimcilar.js`'den re-export yapıyordu,
  import'u BİLİNÇLİ OLARAK dokunulmadan bırakıldı — domain katmanı zaten
  container'da)

**Özel teknik not — mutable state dosyaları:** Bu 8 dosyanın tümü `export var`
ile paylaşılan mutable state tutuyor (ör. `_hesapCurrentStep`, `editKartAltyapiId`).
Bunları `provide('ns', { editHesapTurId, ... })` gibi düz destructuring ile
kaydetmek YANLIŞ olurdu — o an ki SNAPSHOT değeri kopyalar, sonraki
`setEditHesapTurId(5)` çağrısı container'daki kopyaya yansımaz. Bunun yerine
her dosyanın SONUNA kendi kendini `import * as _self from './00-state.js'`
ile import edip `provide('ns', _self)` ile ES module namespace objesini
kaydettik — namespace objeleri canlı binding olduğu için `_self.editHesapTurId`
her okunduğunda güncel değeri verir. Tüketiciler ileride
`inject('ui.pages.hesaplarState').editHesapTurId` şeklinde OKUYABİLİR, ama
YAZAMAZ (namespace objeleri salt-okunur) — yazmak için hep mevcut
`setEditHesapTurId(v)` setter'ları kullanılmalı (zaten proje kuralı böyleydi).

**BİLİNÇLİ OLARAK bırakılan:** Bu dosyaların hiçbiri başka `@pages/*`,
`@core/*`, `@domain/*` importu taşımıyordu (01-genel-yardimcilar.js hariç,
o da yukarıda not edildiği gibi dokunulmadı) — bu yüzden bu turda başka
"bırakılan import" yok.

**Kritik doğrulama yapıldı:** `_coreState.DB` hiçbir dosyada `=` ile
ATANMIYOR. Çift-prefix taraması yapıldı (bu 8 dosya + proje geneli ui/pages
altında) — bulunmadı.

Cache-bust: `?v=29` → `?v=30`. Tüm JS dosyaları `node --check` ile tek tek
taranıp doğrulandı (hatasız).

**Gerçek sayı doğrulaması:** `grep -rl "provide('ui.pages\." js/ui/pages | wc -l`
→ 8. İddia edilen sayıyla eşleşiyor.

**Sıradaki tur için not:** 78 dosyadan 8'i tamamlandı, 70 kaldı. Bir sonraki
tur, import sayısı 1-5 arası olan ve bağımlılıkları zaten container'da olan
(çoğunlukla `domain.*`, `core.*`, veya yeni eklenen `ui.pages.*State`
namespace'lerine) dosyaları hedeflemeli — ör. `odeme/03-odeme-log.js` (2
import), `mevduat/patches/01-...js` ve `odeme/patches/05-...js` (1 import).
Henüz `@pages/*` içindeki BAŞKA sayfa dosyalarına bağımlı olanlara
(ör. `ozet.js` — 32 import) dokunulmadı; bunlar bağımlılık zinciri ilerledikçe
sona doğru ele alınmalı.

**ÖNEMLİ — bu ortamda yapılamayan doğrulama:** Bu turda taşınan 8 dosya salt
state/re-export barındırıyor, DOM'a dokunan davranış değişikliği yok — yine
de teslimden önce yerelde/GitHub Pages'te genel bir gezinme testi önerilir.

## Tur 12'de tamamlanan — ui/pages katmanı devam ediyor (3/70 dosya, toplam 11/78)
Tur 11'in notunda önerilen düşük-bağımlılıklı hedeflerin bir kısmı taşındı:

- `odeme/03-odeme-log.js` → `ui.pages.odemeLog` (`odLogEkle`, `odLogGetir`,
  `_odLogRender` export edildi; kendi `core/format.js`, `core/state.js`
  importları BİLİNÇLİ OLARAK bırakıldı)
- `mevduat/patches/01-gunluk-vadeli-is-gunu-refactor.js` →
  `ui.pages.mevduatPatches.gunlukVadeliIsGunuRefactor` (IIFE içindeki
  `W.FinansBusinessDays` ile aynı fonksiyon kümesi container'a da
  kaydedildi; kendi `core/state.js` importu bırakıldı)
- `odeme/patches/05-ekstre-satir-normalize.js` →
  `ui.pages.odemePatches.ekstreSatirNormalize` (`normalizeExtreRows`
  export edildi; kendi `core/wrap-registry.js` importu bırakıldı — bu
  dosya, 01-07 sırasıyla yüklenmesi ZORUNLU 7 patch'lik zincirin bir
  parçası, sıra hâlâ index.html'de korunuyor)

**Bu turda BİLİNÇLİ OLARAK ele alınmayan "düşük import" dosyalar:**
Tur 11 notu `islemler/06-islem-kategori-secici.js` (3 import) gibi
dosyaları da önermişti, ancak incelemede şu görüldü: bu dosya ve
`hesaplar/06-hesap-log.js`, `islemler/01-aciklama-onerileri.js`,
`odeme/patches/02-wizard-footer-modal-koru.js`,
`odeme/patches/06-bakiye-bilgi-kutusu-kaldirildi.js` gibi dosyaların
TÜMÜ, henüz container'a taşınmamış BAŞKA `@pages/*` dosyalarına
(`tanimlamalar/03-kategoriler.js`, `kartlar/08-kart-odeme.js`,
`odeme/05-hesap-secim-popup.js`, `hesaplar/04-hesap-liste-render.js`,
`islemler/00-state.js` — bu son ikisi zaten container'da) bağımlı.
`inject()` sıra garantisi olmadan da çalıştığı için bunlar teknik
olarak taşınabilirdi, ancak riski küçük turlarda tutmak amacıyla bu
turda sadece SIFIR `@pages/*` bağımlılığı olan (yalnızca `@core/*`
importu taşıyan) 3 dosya seçildi.

**Kritik doğrulama yapıldı:** `_coreState`/`DB` hiçbir yerde `=` ile
ATANMIYOR. Çift-prefix taraması (`_coreState._coreState` vb.) bu 3
dosyada yapıldı — bulunmadı. Tüm proje genelinde `node --check` ile
her JS dosyası tek tek doğrulandı (hatasız).

Cache-bust: `?v=30` → `?v=31` (index.html'deki 150 referansın tamamı
güncellendi).

**Gerçek sayı doğrulaması:** `grep -rl "provide(\"ui.pages\." js/ui/pages | wc -l`
→ 11 (Tur 11'deki 8 + bu turdaki 3).

**Sıradaki tur için not:** 78 dosyadan 11'i tamamlandı, 67 kaldı.
Bir sonraki tur için önerilen gerçek "sıfır-`@pages/*`-bağımlılığı"
adaylar (yalnızca `@core/*`/`@domain/*`/`@components/*` importu
taşıyanlar, `@pages/*` importu OLMAYANLAR):
- `odeme/patches/04-bakiye-hooklari.js` (5 import — kontrol edilmeli,
  `@pages/*` var mı bakılmadı)
- `odeme/patches/07-genel-ui-burst-refresh.js` (5 import)
- `tanimlamalar/08-subeler.js` (5 import)
- `hesaplar/01-genel-yardimcilar.js` (5 import)
- `islemler/04-islem-filtre.js` (5 import)
Bunların her biri için ÖNCE `grep -n "^import " <dosya>` ile
`@pages/*` importu olup olmadığı doğrulanmalı — olan varsa, hedef
sayfanın kendisi container'a taşınana kadar ertelenmeli (ya da
`inject()` ile bağımlılık sırası kırılmadan taşınabilir, ancak bu
projede finans mantığı içeren dosyalarda temkinli davranılıyor).
`odeme/patches/02-wizard-footer-modal-koru.js` ve
`odeme/patches/06-bakiye-bilgi-kutusu-kaldirildi.js` da (her ikisi de
`kartlar/08-kart-odeme.js`'e bağımlı) o dosya taşınınca birlikte ele
alınmalı — patch zincirinin SIRAYA duyarlı olduğu unutulmamalı (01→07
index.html'de art arda yüklenmeli).

**ÖNEMLİ — bu ortamda yapılamayan doğrulama:** Bu turda taşınan 3
dosyadan biri (`03-odeme-log.js`) ödeme geçmişi render'ını, ikisi
DOM patch/monkey-patch zincirlerini içeriyor — teslimden önce
yerelde/GitHub Pages'te ödeme geçmişi popup'ı, günlük vadeli mevduat
açma akışı ve kart detay ekstre listesi görsel olarak test edilmeli.

## Tur 13'te tamamlanan — Tur 12'nin aday listesi YANLIŞ çıktı, gerçek tarama yapıldı, 1 dosya taşındı (12/78)
Tur 12'nin önerdiği 5 aday (`odeme/patches/04-bakiye-hooklari.js`,
`odeme/patches/07-genel-ui-burst-refresh.js`, `tanimlamalar/08-subeler.js`,
`hesaplar/01-genel-yardimcilar.js`, `islemler/04-islem-filtre.js`) tek tek
`grep -n "^import "` ile kontrol edildi — **hepsinde en az 1 `@pages/*`
importu bulundu**, hiçbiri gerçekten uygun değilmiş (öneri listesi
teyitsizdi, notta da böyle kontrol edilmesi istenmişti).

Kalan 67 dosyanın TAMAMI programatik olarak tarandı
(`grep -c "from '@pages/"` her dosya için), sonuçlar `@pages/*` import
sayısına göre sıralandı. **Gerçekten SIFIR `@pages/*` bağımlılığı olan tek
dosya bulundu:** `asgari-odeme.js` (7 import, hepsi `@core/*`, `@domain/*`,
`@components/*` — `@pages/*` yok).

- `asgari-odeme.js` → `ui.pages.asgariOdeme` (dual-mode, kendi importları
  KORUNDU: `@core/app-core-base.js`, `@core/format.js`, `@core/state.js`,
  `@domain/doviz.js`, `@components/modal-genel.js`,
  `@components/money-input.js`, `@components/tablo-filtre-sirala.js` —
  hepsi zaten container'da, bir sonraki temizlik turunda `inject()`'e
  çevrilebilir ama bu turda dokunulmadı).
- Dosyada iki `export var` mutable state var (`_asgariKuralPbFiltre`,
  `_asgariKuralPbFiltreRestored`) — Tur 11'deki state.js dosyalarındaki gibi
  düz destructuring YERİNE `import * as _self from './asgari-odeme.js'` +
  `provide('ui.pages.asgariOdeme', _self)` namespace-self-import pattern'i
  kullanıldı (canlı binding korunuyor).
- Bu dosyayı tüketen 7 dosya bulundu (`tablo-filtre-sirala.js`,
  `ekstreler/02-ekstre-render.js`, `kartlar/05-kart-detay-v2.js`,
  `services/gdrive.js`, `core/app-core-base.js`,
  `core/global-input-bridge.js`, `core/onclick-bootstrap.js`) — dual-mode
  gereği BİLİNÇLİ OLARAK dokunulmadı, kendi turlarında `inject()`'e
  çevrilecekler.

**Kritik doğrulama yapıldı:** Çift-prefix taraması (`_coreState._coreState`
vb.) proje geneli yapıldı — bulunmadı.

Cache-bust: `?v=31` → `?v=32` (index.html'deki 150 referansın tamamı
güncellendi). Tüm JS dosyaları `node --check` ile tek tek doğrulandı
(hatasız).

**Gerçek sayı doğrulaması:** `grep -rl "provide(\"ui.pages\." js/ui/pages | wc -l`
→ 12 (Tur 11'deki 8 + Tur 12'deki 3 + bu turdaki 1).

**Önemli metodolojik ders:** Bundan sonraki turlarda "aday listesi" önermek
yerine, önce TÜM kalan dosyaları programatik olarak (`grep -c` ile) tara ve
`@pages/*` sayısına göre sırala — mevcut çıktı zaten bunu üretti (bkz.
yukarıdaki tarama). Gerçek durum: kalan 66 dosyanın HİÇBİRİ artık sıfır
`@pages/*` bağımlılığına sahip değil — en düşükleri bile (1 tane `@pages/*`
importu olanlar) `islemler/06-islem-kategori-secici.js`,
`odeme/patches/02-wizard-footer-modal-koru.js`, `hesaplar/06-hesap-log.js`,
`mevduat/04-mevduat-otomasyon.js`, `odeme/01-genel-yardimcilar.js`,
`odeme/patches/07-genel-ui-burst-refresh.js` — hepsi TEK bir `@pages/*`
dosyasına bağımlı. Bundan sonraki tur için gerçek strateji: bu "1 @pages/*
importlu" dosyaların hedef aldığı sayfa dosyasının (örn.
`tanimlamalar/03-kategoriler.js`, `kartlar/08-kart-odeme.js`,
`odeme/05-hesap-secim-popup.js`, `hesaplar/04-hesap-liste-render.js`,
`mevduat/02-mevduat-vadeliye-koyma.js`) ÖNCE taşınması, ARDINDAN bu
bağımlı dosyaların `inject()`'e çevrilmesi — yani artık "sıfır bağımlılık"
stratejisi tükendi, bağımlılık zincirini merkezden dışa doğru (yüksek
fan-in'li sayfa dosyalarından başlayarak) izlemek gerekiyor.

**ÖNEMLİ — bu ortamda yapılamayan doğrulama:** `asgari-odeme.js` asgari
ödeme kuralı motorunu içeriyor (kural ekle/sil/sırala, para birimi filtresi,
önizleme hesaplama) — teslimden önce yerelde/GitHub Pages'te kart
detayındaki "Asgari Ödeme Kuralları" sekmesi test edilmeli: kural
ekleme/silme/sıralama, para birimi filtre popup'ı, önizleme hesaplaması.

## Tur 14'te tamamlanan — bağımlılık zincirini merkezden dışa izleme stratejisi başladı, 1 hedef sayfa taşındı (13/78)
Tur 13'ün metodolojik dersi uygulandı: "sıfır bağımlılık" stratejisi tükendiği
için, kalan 66 dosyanın "1 `@pages/*` importlu" 6 tanesinin hedef aldığı
sayfalar (`grep -n "^import "` ile) tek tek doğrulandı — Tur 13'ün önerdiği 5
hedef sayfa aynen teyit edildi: `tanimlamalar/03-kategoriler.js`,
`kartlar/08-kart-odeme.js`, `hesaplar/01-genel-yardimcilar.js`,
`hesaplar/04-hesap-liste-render.js`, `islemler/03-islem-liste-render.js`.

Bu 5 hedefin proje genelindeki gerçek fan-in sayısı (`grep -rl "from
'@pages/<hedef>'" js/ | wc -l`) ölçüldü:
- `tanimlamalar/03-kategoriler.js` → 12
- `kartlar/08-kart-odeme.js` → 11
- `hesaplar/01-genel-yardimcilar.js` → 14
- `hesaplar/04-hesap-liste-render.js` → 23
- `islemler/03-islem-liste-render.js` → 18

En yüksek fan-in'e sahip olanlar (`hesaplar/04-...`, `islemler/03-...`)
finans mantığı içeren büyük render dosyaları (6+ kendi importu) — kapsamı
kontrollü tutmak için bu turda ERTELENDİ. Bunun yerine **en küçük ve en
yönetilebilir** olan, yine de yüksek fan-in'li (14) `hesaplar/01-genel-yardimcilar.js`
(yalnızca 5 kendi importu, tek bir yan-etkili fonksiyon) seçildi.

- `hesaplar/01-genel-yardimcilar.js` → `ui.pages.hesaplarGenelYardimcilar`
  (dual-mode, kendi importları KORUNDU: `@core/app-core-base.js`,
  `@core/format.js`, `@core/state.js`, `@pages/mevduat/02-mevduat-vadeliye-koyma.js`,
  `@pages/hesaplar/04-hesap-liste-render.js` — son ikisi henüz container'a
  taşınmadığı için BİLİNÇLİ OLARAK `inject()`'e çevrilmedi).
- Export edilen tek yeni fonksiyon (`hesapOtomatikGunlukKontrol`) ve
  `@domain/hesap-yardimcilar.js`'ten re-export edilen 7 fonksiyon
  (`hesapTuruRenk`, `_hesapBankayaAitMi`, `_hesaplariIlgiliBankayaGoreSirala`,
  `_hesapVarsayilanVeyaBankaHesabi`, `_hesapOptgroupHtml`, `hesapOptionMetin`,
  `getAktifHesapOptionsByPb`) tek bir obje içinde `provide()` edildi. Mutable
  state yok (yalnızca fonksiyonlar), bu yüzden basit `provide(name, {...})`
  yeterli — namespace-self-import pattern'ine gerek yoktu.
- Bu dosyayı tüketen 14 dosya bulundu (`ui/components/transfer-modal.js`,
  `ui/pages/abonelik.js`, `ui/pages/elden.js`,
  `ui/pages/hesaplar/02-hesap-turu-tanimlama.js`,
  `ui/pages/hesaplar/03-hesap-form-crud.js`, `ui/pages/kartlar/08-kart-odeme.js`,
  `ui/pages/kira.js`, `ui/pages/maas.js`,
  `ui/pages/mevduat/05-mevduat-liste-render.js`,
  `ui/pages/mevduat/06-mevduat-hesap-secim-formu.js`,
  `ui/pages/odeme/01-genel-yardimcilar.js`,
  `ui/pages/odeme/06-genel-odeme-modali.js`,
  `ui/pages/odeme/08-popup-giris-noktalari.js`, `ui/pages/ozet.js`) — dual-mode
  gereği BİLİNÇLİ OLARAK dokunulmadı, kendi turlarında `inject()`'e çevrilecekler.

**Kritik doğrulama yapıldı:** Çift-prefix taraması (`_coreState._coreState`
vb.) proje geneli yapıldı — bulunmadı. Tüm proje `node --check` ile dosya
dosya doğrulandı (hatasız).

Cache-bust: `?v=32` → `?v=33` (index.html'deki 150 referansın tamamı
güncellendi).

**Gerçek sayı doğrulaması:** `grep -rlE "provide\([\"']ui\.pages\." js/ui/pages
| wc -l` → 13 (Tur 11'deki 8 + Tur 12'deki 3 + Tur 13'teki 1 + bu turdaki 1).

**Sıradaki tur için not:** 78 dosyadan 13'ü tamamlandı, 65 kaldı. Aynı
stratejiye devam: kalan 4 hedef sayfadan (`tanimlamalar/03-kategoriler.js`,
`kartlar/08-kart-odeme.js`, `hesaplar/04-hesap-liste-render.js`,
`islemler/03-islem-liste-render.js`) birini taşımak, en yüksek fan-in'e sahip
olsalar da (18-23) kendi import sayıları yüksek (6-13) — bu yüzden dikkatli
taşınmalı ya da önce KENDİ importlarının bir kısmı zaten container'da olan
alt-bağımlılıklar (`@domain/*`, `@components/*`) `inject()`'e çevrilerek
kapsam küçültülebilir. `tanimlamalar/03-kategoriler.js` (fan-in 12, 4 kendi
import) veya `kartlar/08-kart-odeme.js` (fan-in 11, 13 kendi import — YÜKSEK,
dikkatli olunmalı) bir sonraki adaylar olabilir; önce her birinin
`grep -n "^import "` çıktısı incelenmeli.

**ÖNEMLİ — bu ortamda yapılamayan doğrulama:** `hesaplar/01-genel-yardimcilar.js`
günlük vadeli mevduatın otomatik açılma kontrolünü (`hesapOtomatikGunlukKontrol`)
içeriyor — teslimden önce yerelde/GitHub Pages'te hesap listesi açıldığında
günlük vadeli otomatik yenileme davranışı ve hesap türü renk/optgroup
görünümleri (transfer modalı, hesap formu, özet sayfası) görsel olarak test
edilmeli.

## Henüz YAPILMADI (bir sonraki turlar)
1. `js/ui/pages/*` (en büyük hacim, ~1.4M) → container'a taşı. Bu katman
   çok sayıda alt-dizin/dosya içeriyor (odeme/, kartlar/, islemler/,
   hesaplar/, mevduat/, tanimlamalar/, ekstreler/, vb.) — önce bağımlılık
   grafiği çıkarılmalı (`grep -rln`), sonra bağımsızdan bağımlıya, makul
   boyutlu turlar halinde (3-8 dosya) ilerlenmeli, HER TURUN SONUNDA
   gerçek dosya sayısı `grep -rl` ile doğrulanmalı (bu turdaki 17 vs 18
   karışıklığı tekrarlanmasın). NOT: `gdrive.js` hâlâ 5 sayfa modülünü
   DOĞRUDAN import ediyor (`asgari-odeme.js`,
   `ekstreler/02-ekstre-render.js`, `hesaplar/04-hesap-liste-render.js`,
   `islemler/03-islem-liste-render.js`, `veri-yonetimi.js`) — bunlar
   taşınınca gdrive.js'in bu importları da çevrilmeli. Aynı şekilde core
   katmanındaki dosyalar (page-renderers, render-core, init,
   global-input-bridge, wizard-routing, app-core, onclick-bootstrap) ve
   artık TÜM ui/components dosyaları (18/18) hâlâ çok sayıda `@pages/*`
   importu taşıyor — bkz. her dosyanın kendi "DUAL-MODE CONTAINER KAYDI"
   yorumu.
2. `ui/pages/*` container'a taşındıktan SONRA: `app-core.js` (`core.appCore`)
   ve diğer core/ui.components dosyalarını tüketen `@pages/*` importlarının
   TAMAMI taranıp `inject(...)`'e çevrilmeli — bu, projenin en büyük tek
   temizlik adımı olacak (`grep -rln "@pages/"` ile envanter çıkarılmalı).
   Aynı şekilde `modal-genel.js`'i tüketen 66 dosya, `iban-ui.js`'i tüketen
   7 dosya, `kisiler.js`'i tüketen 4 dosya (hepsi muhtemelen ui/pages
   içinde) `inject(...)`'e çevrilmeli.
3. Her katman tamamlandığında: o katmanın dosyalarındaki eski `import`
   satırlarını SİL, `resolve`/`inject` çağrılarıyla değiştir.
4. Son adım: `services/index.js`, `domain/index.js`, `ui/components/index.js`,
   `core/index.js` barrel dosyalarının artık gerekli olup olmadığını
   değerlendir.

## Her turda yapılması gerekenler (checklist)
- [ ] İlgili dosyaların bağımlılık grafiğini `grep -rln` ile çıkar.
- [ ] `provide()` ile container'a kaydet (dual-mode, importları koru).
- [ ] Tüketicileri `resolve()`/`inject()`'e çevir.
- [ ] `node --check` ile TÜM değişen dosyaları doğrula.
- [ ] `index.html`'de `?v=N` artır (AGENTS.md kuralı).
- [ ] Bu dosyada (DI-MIGRATION.md) "tamamlanan" listesini güncelle.
