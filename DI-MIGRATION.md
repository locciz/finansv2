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

## Tur 15'te tamamlanan — dairesel bağımlılıklı bir sayfa dosyası güvenle taşındı (14/78)
Tur 14'ün önerdiği 2 adaydan (`tanimlamalar/03-kategoriler.js` fan-in 12/4
kendi import, `kartlar/08-kart-odeme.js` fan-in 11/13 kendi import — yüksek)
daha yönetilebilir olan **`tanimlamalar/03-kategoriler.js`** seçildi.

**Kritik ön-tarama (yeni: bu tur eklendi):** Taşımadan ÖNCE bu dosyayı
tüketen 12 dosyanın HER BİRİNİN kendi import listesi tarandı
(`grep -rl "from '@pages/tanimlamalar/03-kategoriler.js'" js/`, ardından her
sonucun `grep -n "^import "` çıktısı). **Gerçek dairesellik bulundu:**
`elden.js` (→ `getKategoriOpts`/`populateKategoriSelects` alıyor, kendisi
`onEldenTurChange` sağlıyor) ve `islemler/06-islem-kategori-secici.js`
(→ `seçKategoriChip` alıyor, kendisi `renderIslemKategoriChips` sağlıyor)
bu dosyayı GERİ import ediyor. Bu iki modül henüz container'a taşınmadığı
için `inject()` ile çözülemiyorlardı — dual-mode gereği statik import
KORUNDU, ama üzerlerine top-level `const`/`var` SARILMADI (TDZ/circular-
reentry riskine karşı; bkz. DI-MIGRATION.md'deki format.js/state.js
geçmişindeki hatalar). `core.state` (zaten container'da, DB üzerinde
doğrudan mutasyon var) ise `getCoreState()` fonksiyon-getter'ı (hoisted
function declaration) ile okunuyor — aynı sebepten top-level const
kullanılmadı.

- `tanimlamalar/03-kategoriler.js` → `ui.pages.tanimlamalarKategoriler`
  (dual-mode, kendi importları KORUNDU: `@core/app-core-base.js`,
  `@core/format.js`, `@components/modal-genel.js`,
  `@components/tablo-filtre-sirala.js`, `@pages/ekstreler/02-ekstre-render.js`,
  `@pages/elden.js`, `@pages/islemler/06-islem-kategori-secici.js`,
  `@pages/tanimlamalar/00-state.js` — hiçbiri henüz container'a taşınmadığı
  için BİLİNÇLİ OLARAK `inject()`'e çevrilmedi). Yalnızca `core.state`
  (zaten container'da) `getCoreState()` fonksiyon-getter'ına çevrildi;
  gövdedeki 24 `DB.` kullanımı `getCoreState().DB.` oldu (mekanik regex
  replace, sadece import bloğundan SONRASI hedeflendi ki yorum satırları
  bozulmasın).
- 15 export edilen fonksiyon (`seçKategoriChip`, `renderKategoriOzetStrip`,
  `renderKategoriGrid`, `filterKategoriTur`, `editKategori`, `deleteKategori`,
  `katOneriSelectAll`, `katOneriEkleSecili`, `getKategoriOpts`,
  `getKategoriOptsAbonelik`, `populateKategoriSelects`, `openKategoriModal`,
  `saveKategori`, `_katKey`, `openKategoriOneriModal`) tek bir obje içinde
  `provide('ui.pages.tanimlamalarKategoriler', {...})` edildi.
- Bu dosyayı tüketen 12 dosya (`core/app-core-base.js`, `core/init.js`,
  `core/onclick-bootstrap.js`, `core/page-renderers.js`,
  `ui/components/kisiler.js`, `ui/pages/abonelik.js`,
  `ui/pages/ekstreler/03-ekstre-eslestirme-pdf-import.js`, `ui/pages/elden.js`,
  `ui/pages/islemler/06-islem-kategori-secici.js`,
  `ui/pages/islemler/07-islem-modal-crud.js`,
  `ui/pages/tanimlamalar/02-ana-sayfa.js`, `ui/pages/veri-yonetimi.js`) —
  dual-mode gereği BİLİNÇLİ OLARAK dokunulmadı, kendi turlarında `inject()`'e
  çevrilecekler.

**Kritik doğrulama yapıldı (bu tur genişletildi):**
- Çift-prefix taraması (`getCoreState().getCoreState()`, `DB.DB` vb.) bu
  dosyada yapıldı — bulunmadı.
- **YENİ:** Değiştirilen dosyada kullanılan-ama-tanımsız identifier taraması
  yapıldı (import listesi + kendi `function` tanımları ile karşılaştırıldı,
  yorum satırlarından gelen yanlış-pozitifler elle elendi) — eksik import
  bulunmadı.
- `node --experimental-vm-modules` + `vm.SourceTextModule` ile TÜM proje
  (125 dosya, tek tek `fs.readdirSync` ile taranarak) syntax doğrulandı —
  0 hata.
- `grep -n "src=\".*03-kategoriler.js" index.html` ile dosyanın script tag'i
  zaten mevcuttu, doğrulandı (bu dosya yeni oluşturulmadı, sadece düzenlendi).

Cache-bust: `?v=33` → `?v=34` (index.html'deki 153 referansın tamamı
`sed` ile toplu güncellendi, öncesi/sonrası sayım ile doğrulandı: 153 → 0
eski, 153 yeni).

**Gerçek sayı doğrulaması:** `grep -rlE "provide\([\"']ui\.pages\." js/ui/pages
| wc -l` → 14 (Tur 11'deki 8 + Tur 12'deki 3 + Tur 13'teki 1 + Tur 14'teki 1
+ bu turdaki 1).

**Metodolojik not — geçmişteki 4 hata sınıfına karşı ön-tarama artık
standart:** Bu tur, taşımadan ÖNCE dairesellik taramasını checklist'e resmen
ekledi (bkz. yukarı: tüketicilerin import listeleri tek tek okundu). Bu,
önceki turlarda YOKTU ve tam olarak bu eksiklik yüzünden format.js/state.js/
app-core.js'de üst üste TDZ, circular-reentry ve `inject()` proxy'sine
sessiz yazma hataları yaşanmıştı (canlıda kullanıcı ekranında patladılar).
Bundan sonraki HER tur için: bir dosya taşınmadan önce (a) o dosyanın
tükettiği VE (b) o dosyayı tüketen dosyaların import listeleri karşılıklı
taranmalı; kesişim varsa (dairesellik), o bağımlılık ASLA top-level
const/var'a sarılmamalı.

**Sıradaki tur için not:** 78 dosyadan 14'ü tamamlandı, 64 kaldı. Kalan 3
"yüksek fan-in, çok importlu" hedef: `kartlar/08-kart-odeme.js` (fan-in 11,
13 kendi import), `hesaplar/04-hesap-liste-render.js` (fan-in 23, 6+ kendi
import), `islemler/03-islem-liste-render.js` (fan-in 18, 6+ kendi import).
Bunlardan önce, bu üç dosyanın KENDİ import listelerindeki alt-bağımlılıklar
(`@domain/*`, `@components/*` — bir kısmı zaten container'da) `inject()`'e
çevrilerek kapsam küçültülebilir mi diye önce ayrı ayrı incelenmeli
(`grep -n "^import "` her biri için). Ayrıca artık taşınan 14 dosyanın
TÜKETİCİLERİNİ (toplamda 12+14+... onlarca dosya) `inject()`'e çevirme turu
da paralel bir seçenek — DI-MIGRATION.md madde 2'deki büyük temizlik adımı
için bu, daha küçük/güvenli parçalara bölünebilir (örn. sadece
`ui.pages.tanimlamalarKategoriler`'i tüketen 12 dosyayı bir turda çevir).

**ÖNEMLİ — bu ortamda yapılamayan doğrulama:** Kategoriler sayfası (grid,
filtre chip'leri, kategori ekle/düzenle/sil modalı, öneri modalı, abonelik
kategori select'i) teslimden önce yerelde/GitHub Pages'te uçtan uca test
edilmeli — özellikle `elden.js` ve `islemler/06-islem-kategori-secici.js`
ile olan dairesel etkileşim (kategori seçince İşlemler/Elden Ödeme
formlarının doğru güncellenmesi).


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

## Tur 16'da tamamlanan — ui.pages.tanimlamalarKategoriler'in tüketicileri kısmen çevrildi (4/12)
NOT: Bu bölüm önceki oturumda bir str_replace hatası (yanlış eşleşen
old_str) yüzünden DI-MIGRATION.md'ye YAZILAMAMIŞTI, ama kod değişiklikleri
(app-core-base.js/init.js/page-renderers.js/kisiler.js) kalıcıydı — bu tur
kontrol edilip doğrulandıktan sonra kayıt SONRADAN eklendi.

Tur 15'in notundaki iki seçenekten (yeni büyük sayfa taşımak vs. Tur 15'te
taşınan `ui.pages.tanimlamalarKategoriler` namespace'inin tüketicilerini
çevirmek) İKİNCİSİ seçildi.

**Ön-tarama:** `03-kategoriler.js`'yi tüketen 12 dosyanın import listesi
okundu, iki kritere göre ayrıştırıldı: (1) tüketici zaten container'da mı
(`provide()` var mı) — sadece 4 dosya evet (`app-core-base.js`, `init.js`,
`page-renderers.js`, `kisiler.js`); (2) bu 4 dosyadan biri `03-kategoriler.js`
tarafından GERİ import ediliyor mu (dairesellik) — yalnızca `app-core-base.js`
(saveData/populateKategoriSelects karşılıklı). Kalan 8 tüketici henüz
kendileri taşınmadığı için dual-mode gereği dokunulmadı.

**Yapılan değişiklikler:**
- `core/app-core-base.js`: dairesel olduğu için `function getTanimlamalarKategoriler()
  { return inject(...); }` (fonksiyon-getter, mevcut `getFormat()` vb. ile
  aynı pattern). Kullanım: `getTanimlamalarKategoriler().populateKategoriSelects()`.
- `core/init.js`, `core/page-renderers.js`, `ui/components/kisiler.js`:
  dairesellik yok, `const _tanimlamalarKategoriler = inject(...)` + sarmalayıcı
  fonksiyon (`(...a) => _tanimlamalarKategoriler.fn(...a)`) — dosyalardaki
  diğer namespace'lerle aynı stil.

**Doğrulama:** 4 dosyada eski statik import satırının silindiği doğrulandı;
çift-prefix taraması yapıldı (temiz); `vm.SourceTextModule` ile proje geneli
syntax kontrolü (0 hata); `saveData`'nın hâlâ doğru export edildiği teyit
edildi (ilk denemede `init.js`'de `_domainDoviz`/`populateCurrencySelects`
bloğu yanlışlıkla silinmişti — büyük bir str_replace'in old_str'i niyet
edilenden fazla satırı kapsamıştı — fark edilip DÜZELTİLDİ).

**Gerçek sayı:** `grep -rl "from '@pages/tanimlamalar/03-kategoriler.js'" js/
| wc -l` → 8 (12'den 4'ü çevrildi). Taşınan sayfa sayısı (14/78) DEĞİŞMEDİ —
bu tur yeni sayfa taşımadı, sadece mevcut namespace'in tüketicilerini
`inject()`'e çevirdi.

## Tur 17'de tamamlanan — global-input-bridge.js'de eksik 6 fonksiyon eklendi (canlı hata düzeltmesi)
Kullanıcı ekranında canlı hata: `Uncaught ReferenceError: onTaksitChange is
not defined` — `krediler/01-genel-yardimcilar.js`'de taksit tarih/tutar
input'larına inline `onchange="onTaksitChange(...)"` / `oninput="onTaksitChange(...)"`
yazılmış, ama `onTaksitChange` bir ES module export'u olduğu için `window`
üzerinde görünmüyordu. Projenin bunun için özel bir mekanizması var:
`js/core/global-input-bridge.js` — inline `onchange`/`oninput` attribute'larında
çağrılan TÜM fonksiyonları import edip `window.X = X` ile global'e bağlıyor
(onclick-bootstrap.js'nin `onclick` için yaptığının oninput/onchange
karşılığı). `onTaksitChange` bu köprü dosyasında eksikti.

**Kapsamlı tarama yapıldı (tek fonksiyonla sınırlı kalınmadı):** Projedeki
TÜM `onchange="fn("` / `oninput="fn("` kalıpları regex ile çıkarıldı
(122 ham eşleşme → onclick'ler ayıklanınca 7'ye indi), `global-input-bridge.js`'deki
mevcut `window.X = ` atamalarıyla karşılaştırıldı. `kartlarAramaDegisti` bir
yorum satırından gelen sahte-pozitifti (kod artık kullanmıyor), elendi.
Gerçekten eksik olan 6 fonksiyon bulundu (`onTaksitChange` dahil):
- `onTaksitChange` ← `@pages/krediler/01-genel-yardimcilar.js`
- `_odModalKrediAlanlariAyarla` ← `@pages/odeme/06-genel-odeme-modali.js`
- `autoSaveNakitAvansTavan` ← `@pages/krediler/02-nakit-avans.js`
- `onIslemTaksitChange` ← `@pages/islemler/02-islem-form-degisiklikleri.js`
- `onNaTaksitChange` ← `@pages/krediler/02-nakit-avans.js`
- `vyRevSecAlan` ← `@pages/veri-yonetimi.js`

Hepsi `global-input-bridge.js`'ye eklendi: ya mevcut aynı-dosya import
satırına (3 tanesi: `islemler/02-islem-form-degisiklikleri.js`,
`krediler/02-nakit-avans.js` — 2 fonksiyon, `veri-yonetimi.js`) ya da yeni
satır olarak alfabetik/dizin sırasına uygun yere (`krediler/01-genel-yardimcilar.js`,
`odeme/06-genel-odeme-modali.js`) eklendi, ardından `window.X = X;`
atamaları da alfabetik sıraya eklendi.

**Doğrulama:** Her 6 fonksiyon için import+window ataması sayısının TAM 1
olduğu `grep -c` ile doğrulandı. Bu 5 kaynak dosyanın (`onTaksitChange`'in
kendi dosyası dahil) `global-input-bridge.js`'yi GERİ import etmediği
(dairesellik yok) doğrulandı. `vm.SourceTextModule` ile proje geneli syntax
kontrolü — 0 hata.

Cache-bust: index.html zaten `?v=35`'teydi (önceki oturumdan, Tur 16'nın
kod değişiklikleriyle birlikte yapılmış ama MD kaydı eksikti) → bu turda
`?v=36`'ya çıkarıldı, 153→153 sayımıyla doğrulandı.

**Metodolojik not:** Bu tur, DI-MIGRATION ile DOĞRUDAN ilgili olmayan ama
AYNI KÖKTEN (ES module export'larının window'a otomatik yazılmaması) gelen
bir hata sınıfını ele aldı. Bundan sonra yeni bir `export function` inline
`onchange`/`oninput`/`onclick` HTML'inde kullanılacaksa, MUTLAKA ilgili
köprü dosyasına (`global-input-bridge.js` ya da `onclick-bootstrap.js`)
eklendiğinden emin olunmalı — aksi halde syntax kontrolü bunu YAKALAMAZ
(çünkü hata yalnızca tarayıcıda, o input'a etkileşim olduğunda ortaya çıkar).

**Sıradaki tur için not:** DI-MIGRATION'ın ana hedefi hâlâ geçerli (78
dosyadan 14'ü tamamlandı, 64 kaldı; `ui.pages.tanimlamalarKategoriler`'in
kalan 8 tüketicisi ya da 3 büyük hedef sayfa). Ayrıca bu tur bulunan
kapsamlı-tarama yöntemi (`grep -roE 'on(change|input)="[a-zA-Z_]...'` +
`comm -23` ile bridge dosyasıyla karşılaştırma) ileride tekrar
çalıştırılabilir — yeni eklenen/değiştirilen sayfa dosyalarında benzer
eksiklikler oluşmadığından emin olmak için, özellikle DI-MIGRATION
turlarında bir dosya düzenlenirken YENİ bir inline onchange/oninput
eklenmişse.

## Tur 18'de tamamlanan — DİNAMİK onchange/oninput'lar window'dan event delegation'a geçirildi (6/6 fonksiyon)
Kullanıcı geri bildirimi: `window.X = X` deseninin (Tur 17'de eklenen 6
fonksiyon dahil) ES module mantığına aykırı olduğu, gerçek bir çözüm
istendiği belirtildi. Bu tur, Tur 17'de `window`'a bağlanan 6 fonksiyonu
(`onTaksitChange`, `_odModalKrediAlanlariAyarla`, `autoSaveNakitAvansTavan`,
`onIslemTaksitChange`, `onNaTaksitChange`, `vyRevSecAlan`) TAMAMEN
`window`'suz hale getirdi.

**Kapsam netleştirmesi (önemli ayrım):** Projede inline `onchange`/`oninput`
iki tamamen farklı kategoride:
1. **Dinamik** (JS template string'lerinde, `innerHTML` ile her render'da
   yeniden üretilen HTML) — 6 fonksiyon, 8 kullanım yeri
   (`hesaplamalar.js`, `krediler/01-genel-yardimcilar.js`,
   `krediler/02-nakit-avans.js`, `money-input.js`, `gdrive.js`). BU TUR
   BUNLARI ÇÖZDÜ.
2. **Statik** (`index.html`'de sabit, sayfa yüklenirken hep aynı elementte
   duran) — 81 benzersiz fonksiyon, 131 kullanım yeri. Bu, geriye kalan
   `window.X = X` satırlarının (yaklaşık 75) NEDENİ — `onclick-bootstrap.js`'nin
   `onclick` için yaptığı `rf-oc-N` + `DOMContentLoaded` + `getElementById`
   + `addEventListener` deseninin `onchange`/`oninput` KARŞILIĞI HENÜZ
   YAZILMADI. BU TUR BUNLARA DOKUNMADI (ayrı, daha büyük bir iş —
   `index.html`'in kendisinin düzenlenmesini gerektiriyor).

**Neden `window` kullanılıyordu:** Tarayıcı, `onchange="fn(...)"` gibi bir
HTML attribute'unu native olarak `window.fn` fonksiyonunu arayarak
çalıştırır. ES module `export function fn()` otomatik olarak `window`'a
yazılmaz — bu yüzden Tur 17 (ve önceki turlar) bir "köprü" dosyasıyla
(`global-input-bridge.js`, `onclick-bootstrap.js`) fonksiyonları elle
`window`'a bağlamıştı. Bu ÇALIŞIR ama ES module'ün kapsam izolasyonu
felsefesine aykırı ve global namespace kirliliği yaratır.

**Gerçek ES-module-native çözüm — event delegation:** `window`'a hiç
yazmadan, DOM olaylarını modül scope'unda tutmanın standart yolu, HTML'e
inline JS string'i gömmek yerine bir `data-*` attribute ile İŞARETLEMEK ve
tek bir merkezi `document.addEventListener('change'/'input', ...)`
dinleyicisiyle bu işaretleri okuyup doğru (import edilmiş, modül-scope'lu)
fonksiyonu çağırmak. `event.target.closest('[data-oc-handler]')` dinamik
olarak yeniden üretilen elementlerde bile YENİDEN BAĞLAMA gerektirmez
(document seviyesinde bir kere kurulur).

**Yapılan değişiklikler:**
- 6 kullanım yerinde `onchange="fn(this, args...)"` / `oninput="fn(this)"`
  kaldırıldı, yerine üç yeni data-attribute eklendi:
  - `data-oc-handler="fnAdi"` — hangi fonksiyonun çağrılacağı.
  - `data-oc-event="change"` veya `"input"` — orijinal event tipi (davranış
    birebir korunsun diye; örn. tarih input'u sadece `change`'de,
    tutar input'u sadece `input`'ta tetiklenmeliydi).
  - `data-oc-arg="gecikti"` — sadece `_odModalKrediAlanlariAyarla` için,
    sabit string argümanı taşımak amacıyla.
  - Diğer parametreler (idx/field/tip/cur) ZATEN mevcut data-attribute'lardı
    (`data-islem-taksit-idx`, `data-taksit-tip`, `data-cur` vb.) — yeniden
    icat edilmedi, doğrudan `el.dataset.X` ile okunuyor.
- `global-input-bridge.js`'nin başlık yorumu güncellendi (artık `window`
  köprüsü değil, delegation mekanizması olduğunu açıklıyor).
- 6 fonksiyonun `window.X = X` satırı kaldırıldı; yerine dosyanın sonuna
  bir `HANDLERS` map'i (her fonksiyonun orijinal imzasına uygun küçük bir
  sarmalayıcı: `el` → doğru argümanları `el.dataset`'ten kurup gerçek
  fonksiyonu çağırma) ve TEK bir `_dispatchOcEvent` + 2 adet
  `document.addEventListener('change'|'input', _dispatchOcEvent)` eklendi.

**Kritik doğrulama yapıldı:**
- Her 6 fonksiyon için `HANDLERS` map key'i ile obje-literal içinde AYNI
  isimli import edilen fonksiyonun çakışıp çakışmadığı `node -e` ile canlı
  test edildi — çakışma YOK (obje key'i string, import ismi ayrı scope).
- `data-*` attribute isimlerinin `.dataset` camelCase karşılıklarının
  (`data-islem-taksit-idx` → `dataset.islemTaksitIdx` vb.) `HANDLERS`
  map'indeki kullanımla birebir eşleştiği `node -e` ile simüle edilerek
  doğrulandı.
- `data-oc-event` filtresi eklendi ki `change`/`input` her ikisi de
  dinlenmesine rağmen her handler SADECE orijinal event tipinde tetiklensin
  (aksi halde `type="date"` input'u hem `change` hem potansiyel `input`
  event'inde iki kez tetiklenebilirdi — davranış değişikliği riski
  ortadan kaldırıldı).
- Bu 6 fonksiyonun tanımlı olduğu 5 kaynak dosyanın (`hesaplamalar.js`,
  `krediler/01-genel-yardimcilar.js`, `krediler/02-nakit-avans.js`,
  `odeme/06-genel-odeme-modali.js`, `veri-yonetimi.js`, `money-input.js`,
  `gdrive.js`) `global-input-bridge.js`'yi GERİ import etmediği (dairesellik
  yok) tekrar doğrulandı.
- `vm.SourceTextModule` ile proje geneli syntax kontrolü — 0 hata; ayrıca
  bu turda değişen 6 dosya ayrı ayrı doğrulandı.
- Kalan tüm gerçek (yorum olmayan) inline `onchange=`/`oninput=` kullanım
  yerlerinin (JS dosyalarında) TAMAMEN temizlendiği `grep -rn` ile
  doğrulandı (geriye sadece 2 yorum satırı + `global-input-bridge.js`'nin
  kendi açıklama yorumu kaldı).

Cache-bust: `?v=36` → `?v=37` (153→153 sayımıyla doğrulandı).

**Sıradaki tur için not — statik `window.X` temizliği (kalan ~75 fonksiyon,
131 kullanım):** Bu iş, `index.html`'in KENDİSİNİ düzenlemeyi gerektiriyor
— her statik `onchange="fn(...)"` / `oninput="fn(...)"` elementine
`onclick-bootstrap.js`'nin `rf-oc-N` deseniyle aynı mantıkta bir id
verilip (`rf-oi-N` gibi), `document.addEventListener('DOMContentLoaded', ...)`
içinde `getElementById` + `addEventListener('change'|'input', ...)` ile
bağlanması gerekiyor. Bu, Tur 18'deki delegation yaklaşımından FARKLI çünkü
statik elementler zaten DOM'da hazır — id bazlı doğrudan bağlama yeterli,
delegation'a gerek yok. Bu iş `onclick-bootstrap.js`'nin `onclick`
dönüşümüyle NEREDEYSE BİREBİR AYNI, sadece `click` yerine `change`/`input`
— muhtemelen benzer bir "otomatik üretim" (AST ile inline ifadelerin
ayrıştırılıp fonksiyon çağrılarına çevrilmesi) yaklaşımı burada da
uygulanabilir. Bu iş DI-MIGRATION'ın ana hedefinden (sayfa dosyalarını
container'a taşımak) BAĞIMSIZ bir temizlik — ayrı bir tur olarak ele
alınmalı, DI-MIGRATION sayaçlarını (14/78) etkilemez.


## Tur 19'da tamamlanan — canlı hata: eksik onIslemTarihiChange + statik-input-bridge.js başlatıldı
Kullanıcı ekranında canlı hata: `Uncaught ReferenceError: onIslemTarihiChange
is not defined`, `05-tarih-input-overlay.js:360`'daki `dispatchEvent(new
Event('change'))` üzerinden geliyordu. Kök neden Tur 17'dekiyle AYNI kategori
(eksik `window.X` ataması) ama Tur 18'de kurulan kural gereği bu sefer
`window`'a EKLEMEDİK — DOĞRU (ES-module-native) çözüm uygulandı.

**Kritik ayrım netleştirildi:** `index.html:2446`'daki
`onchange="calcTaksit(false);onIslemTarihiChange()"` — bu STATİK bir
kullanım (Tur 18'in notundaki "kalan ~75 fonksiyon, 131 kullanım" grubundan),
DİNAMİK değil. Ayrıca birden fazla ifade içeriyor (`;` ile ayrılmış 2 fonksiyon
çağrısı) — bu, Tur 18'in `data-oc-handler` (tek fonksiyon çağıran) delegasyon
mekanizmasına UYMUYOR. Bu yüzden yeni, ayrı bir mekanizma gerekti.

**Yapılan değişiklik — yeni dosya `js/core/static-input-bridge.js`:**
`onclick-bootstrap.js`'nin `onclick` için kullandığı deseni (`DOMContentLoaded`
+ `getElementById` + `addEventListener`) `change`/`input` olaylarına
uygulayan, `window` KULLANMAYAN bir bridge dosyası oluşturuldu. Bu, Tur
18'deki `global-input-bridge.js` (dinamik, event-delegation) ile
`onclick-bootstrap.js` (statik, id-bazlı click) arasındaki BOŞLUĞU dolduruyor
— statik onchange/oninput için id-bazlı doğrudan bağlama (delegation'a
gerek yok, elementler zaten DOM'da sabit).

- `index.html`'de `id="islem-tarih"` ve `id="islem-provizyon-tarihi"`
  elementlerinin inline `onchange="..."` attribute'ları KALDIRILDI (id'ler
  korundu).
- `static-input-bridge.js`, bu iki elementi `getElementById` ile bulup
  `addEventListener('change', ...)` ile bağlıyor; içeride sırasıyla
  `calcTaksit(false)` + `onIslemTarihiChange()` ve `onIslemProvizyonManuelDegisti()`
  + `calcTaksit(true)` çağrılıyor — davranış birebir korundu, sadece bağlama
  yöntemi değişti.
- `calcTaksit` `inject('domain.hesaplamalar')` üzerinden (zaten container'da,
  Tur 3/4), `onIslemProvizyonManuelDegisti`/`onIslemTarihiChange` normal ES
  `import` ile alındı (dairesellik yok, doğrulandı).
- `global-input-bridge.js`'den artık gereksiz hale gelen
  `onIslemProvizyonManuelDegisti` importu ve `window.onIslemProvizyonManuelDegisti`
  ataması KALDIRILDI (bu fonksiyon `index.html`'de artık BAŞKA hiçbir statik
  yerde kullanılmıyordu, doğrulandı). `window.onIslemKartChange` ve
  `window.calcTaksit` DOKUNULMADI çünkü hâlâ başka statik satırlarda
  (`islem-kart` select'i, `islem-tutar`/`islem-taksit` input'ları)
  kullanılıyorlar.

**Doğrulama:** Dairesellik kontrolü (`02-islem-form-degisiklikleri.js`'nin
`static-input-bridge.js`'yi geri import etmediği); `vm.SourceTextModule` ile
proje geneli syntax kontrolü (0 hata); `index.html`'deki 2 satırın
gerçekten `onchange`'siz kaldığı `grep` ile doğrulandı; `applyToAll()`'ın
`dispatchEvent(new Event('change'))` mekanizmasının hem eski inline
attribute hem yeni `addEventListener` ile eşit çalıştığı (DOM standart
event mekanizması, ikisini ayırt etmez) teyit edildi.

Cache-bust: `?v=37` → `?v=38` (154→154 sayımıyla doğrulandı — yeni eklenen
`static-input-bridge.js` script tag'i dahil 154 toplam referans).

**Gerçek sayı:** `grep -c "^window\." js/core/global-input-bridge.js` →
80 (Tur 18 sonunda 82'ydi, bu turda 2 tanesi daha — `onIslemProvizyonManuelDegisti`
kaldırıldı, `onIslemTarihiChange` zaten hiç window'a girmedi).

**Sıradaki tur için not — statik `window.X` temizliğinin gerçek kapsamı
netleşti:** Tur 18'in notundaki "81 fonksiyon, 131 kullanım" tahmini kabaca
doğruydu, ama bu turda görüldüğü gibi bunların bir kısmı (en az 7 satır,
yukarıda `grep -oE` ile bulundu) BİRDEN FAZLA `;`-ayrılmış ifade içeriyor —
bunlar `data-oc-handler` (Tur 18) yerine `static-input-bridge.js` (Tur 19)
deseniyle taşınmalı. Basit tek-fonksiyonlu statik satırlar ise
`onclick-bootstrap.js`'nin otomatik-üretim yaklaşımıyla toplu taşınabilir.
Öncelik: önce çok-ifadeli 7 satırı (`kira-depozito-tutar-wrap` IIFE'si,
`ab-tutar-wrap` IIFE'si, `calcMevduat` kombinasyonları, `onEldenKarsiIbanInput`
+ `syncEldenManuelIban` vb.) `static-input-bridge.js`'ye taşımak, sonra
kalan tek-fonksiyonlu ~74 satırı otomatik/toplu şekilde aynı dosyaya
eklemek. Bu iş DI-MIGRATION'ın ana hedefinden bağımsız, ayrı bir tur.

## Tur 20'de tamamlanan — sayaç düzeltmesi + ui/pages katmanında 2 yeni dosya (13/77 → 15/77)

**Önce sayaç doğrulaması yapıldı (önceki turlardaki iddialarla gerçek durum
karşılaştırıldı):**
- `grep -rlE "provide\(['\"]ui\.pages\." js/ui/pages | wc -l` → **13**, Tur
  19'un iddia ettiği "14/78" YANLIŞMIŞ.
- `find js/ui/pages -name "*.js" | wc -l` → **77**, iddia edilen "78"
  YANLIŞMIŞ.
- Tur 12'de bahsedilen `mevduat/patches/01-gunluk-vadeli-is-gunu-refactor.js`
  dosyası PROJEDE HİÇ YOK (`find` ile arandı, bulunamadı) — geçmiş bir
  turda ya yanlış rapor edilmiş ya da sonradan silinmiş, ama sayaç hiç
  düzeltilmemiş. Gerçek taşınan dosya sayısı hep 13'müş, 14 değil.
- Bu düzeltmeden sonraki gerçek durum: 77 dosyadan 13'ü taşınmıştı, 64 kaldı
  (Tur 19'un "64 kaldı" sonucu tesadüfen doğruydu, çünkü 78-14=64 ile
  77-13=64 aynı çıkıyor — ama ARA ADIMLAR yanlıştı).

**Bu turda taşınan 2 dosya** ("1 `@pages/*` importlu" 6 adaydan ikisi —
hedef namespace'leri ZATEN container'da olan, yani hemen `inject()`'e
çevrilebilecek olanlar seçildi; diğer 4'ün hedefi henüz taşınmamış):

- `islemler/06-islem-kategori-secici.js` → `ui.pages.islemKategoriSecici`
  (`core.state`, `ui.components.modalGenel` inject'e çevrildi). **Dairesel
  bağımlılık teyit edildi:** `tanimlamalar/03-kategoriler.js` bu dosyayı
  GERİ import ediyor (`renderIslemKategoriChips`) — Tur 15'in notuyla
  uyumlu. `ui.pages.tanimlamalarKategoriler` (Tur 15'te zaten container'a
  taşınmıştı) top-level `const`'a sarıldı ama SADECE bir event-listener
  callback'i içinde (`bindIslemKategoriChipClicks`) kullanılıyor — modül
  eval zamanında DEĞİL, tıklama anında okunuyor, bu yüzden TDZ/circular-
  reentry riski yok (`inject()` zaten lazy Proxy döndürüyor).
- `odeme/01-genel-yardimcilar.js` → `ui.pages.odemeGenelYardimcilar`
  (`core.format`, `core.state`, `ui.pages.hesaplarGenelYardimcilar`,
  `core.wrapRegistry` inject'e çevrildi). **Dairesellik kontrolü yapıldı,
  YOK** — `hesaplar/01-genel-yardimcilar.js` bu dosyayı geri import
  etmiyor (`grep` ile doğrulandı), tamamen güvenli, top-level const'lar
  sorunsuz.

**Bilinçli olarak ele alınmayan 4 aday** (hedefleri henüz container'a
taşınmadığı için): `hesaplar/06-hesap-log.js` (→
`hesaplar/04-hesap-liste-render.js`), `mevduat/04-mevduat-otomasyon.js`
(→ bu turda taşınan `odeme/01-genel-yardimcilar.js`'e artık taşınabilir,
bir SONRAKİ turda ele alınmalı), `odeme/patches/02-wizard-footer-modal-
koru.js` (→ `kartlar/08-kart-odeme.js`), `odeme/patches/07-genel-ui-burst-
refresh.js` (→ `islemler/03-islem-liste-render.js`).

**Kritik doğrulama yapıldı:**
- Çift-prefix taraması (`_coreState._coreState`, `_format._format`,
  `_wrapRegistry._wrapRegistry`, `_hesaplarGenelYardimcilar.
  _hesaplarGenelYardimcilar`, `_tanimlamalarKategoriler.
  _tanimlamalarKategoriler`, `_modalGenel._modalGenel` vb.) her iki
  dosyada da yapıldı — bulunmadı.
- Bare (prefix'siz) `DB.`/`localDateStr(`/`call('odGetItem'` kalıntısı
  taraması yapıldı — bulunmadı.
- `node --check` ile TÜM proje dosya dosya (`find js -name "*.js"`)
  taranıp doğrulandı — 0 hata.
- İki dosyanın gerçek tüketicileri (`islemler/06-...` için 6 dosya,
  `odeme/01-...` için 16 dosya) `grep -rl` ile listelendi, dual-mode
  gereği BİLİNÇLİ OLARAK dokunulmadı — kendi turlarında `inject()`'e
  çevrilecekler.

Cache-bust: `?v=38` → `?v=39` (yalnızca `<link rel="stylesheet">` tag'leri —
`<script type="module">` tag'leri artık hiç `?v=N` taşımıyor, bkz. daha
önceki oturumdaki ayrı düzeltme; 32→32 sayımıyla doğrulandı).

**Gerçek sayı doğrulaması:** `grep -rlE "provide\(['\"]ui\.pages\." js/ui/pages
| wc -l` → **15** (önceki gerçek 13 + bu turdaki 2).

**Metodolojik not — sayaç disiplini:** Bundan sonraki HER turun BAŞINDA,
önceki turun iddia ettiği sayıyı KÖRÜ KÖRÜNE kabul etmek yerine
`grep -rlE "provide\(...)"` ve `find ... | wc -l` ile YENİDEN ölçülmeli.
Bu tur, en az iki geçmiş turdan (Tur 12 hayali dosya, ardılları düzeltmeden
devralmış) kaynaklanan bir sayaç sürüklenmesini düzeltti.

**Sıradaki tur için not:** 77 dosyadan 15'i tamamlandı, 62 kaldı. Şimdi
"1 `@pages/*` importlu" kalan 4 aday (yukarıda listelendi) yeniden
taranmalı — özellikle `mevduat/04-mevduat-otomasyon.js` artık taşınabilir
durumda (hedefi bu turda container'a girdi). Onun ardından yine "2
`@pages/*` importlu" katmana geçilebilir (`islemler/01-aciklama-onerileri.js`,
`islemler/04-islem-filtre.js`, `krediler/05-kredi-tipi-tanimlama.js`,
`odeme/05-hesap-secim-popup.js`, `odeme/patches/04-bakiye-hooklari.js`,
`odeme/patches/06-bakiye-bilgi-kutusu-kaldirildi.js`,
`tanimlamalar/04-tbk-faiz-oranlari.js`, `tanimlamalar/05-genel-oran-
tablolari.js`, `tanimlamalar/06-para-birimi.js`, `tanimlamalar/08-subeler.js`,
`tanimlamalar/09-urun-tipleri.js`, `tanimlamalar/10-resmi-tatiller.js`) —
her biri taşınmadan ÖNCE kendi 2 `@pages/*` hedefinin container durumu ve
olası dairesellik `grep -n "^import "` ile TEK TEK doğrulanmalı (Tur 15'te
standartlaştırılan checklist).

**ÖNEMLİ — bu ortamda yapılamayan doğrulama:** `islemler/06-islem-kategori-
secici.js` işlem formundaki kategori chip seçici widget'ını, `odeme/01-
genel-yardimcilar.js` ödeme durumu rozet/toggle render'ının TAMAMINI (kira,
maaş, kart, kredi, KMH ödeme durumları) besliyor — teslimden önce
yerelde/GitHub Pages'te test edilmeli: işlem ekleme formunda kategori
seçici modalı (arama, chip tıklama, "kategorisiz bırak"), VE ödeme
durumu rozetlerinin (✓ Ödendi / ◉ Bekliyor / ⚠ Gecikti vb.) kira, maaş,
kart, kredi, KMH sayfalarının hepsinde doğru göründüğü.

## Tur 21'de tamamlanan — ui/pages katmanında 2 yeni dosya (15/77 → 17/77)

**Sayaç önce yeniden ölçüldü** (Tur 20'nin metodolojik dersine uygun):
`grep -rlE "provide\(['\"]ui\.pages\." js/ui/pages | wc -l` → 15,
`find js/ui/pages -name "*.js" | wc -l` → 77. Tur 20'nin bıraktığı durumla
BİREBİR eşleşti, sürüklenme yok.

**Bu turda taşınan 2 dosya:**

- `mevduat/04-mevduat-otomasyon.js` → `ui.pages.mevduatOtomasyon`
  (`core.format`, `core.state`, `ui.pages.odemeGenelYardimcilar` [Tur
  20'de taşınmıştı], `core.wrapRegistry` inject'e çevrildi — Tur 20'nin
  notunda önerilen tam bu dosyaydı, hedefi bu turda hazır olduğu için
  çevrildi). Dairesellik kontrolü yapıldı — YOK. `DB.mevduatlar = []`
  satırı `_coreState.DB`'nin KENDİSİNE değil `.mevduatlar` PROPERTY'sine
  atama yapıyor — kritik kural ihlali değil, doğrulandı.
- `islemler/01-aciklama-onerileri.js` → `ui.pages.islemAciklamaOnerileri`
  (`core.state`, `ui.pages.islemlerState`, `ui.pages.islemKategoriSecici`
  [bu turdan önceki turda taşınmıştı], `ui.components.modalGenel`
  inject'e çevrildi). Dairesellik kontrolü yapıldı — YOK (ne
  `islemler/00-state.js` ne `06-islem-kategori-secici.js` bu dosyayı geri
  import ediyor). `AC_ENGELLI_KELIMELER` hedefte `export var` ile mutable
  ama `islemler/00-state.js` zaten kendi kendini namespace-self-import
  pattern'iyle (`_self`) provide etmişti (Tur 11) — bu yüzden
  `_islemlerState.AC_ENGELLI_KELIMELER` canlı binding, ekstra önlem
  gerekmedi.

**Bu turda ele alınmayan diğer adaylar** (hedefleri henüz container'da
değil, kontrol edildi): `odeme/patches/02-wizard-footer-modal-koru.js` ve
`odeme/patches/06-bakiye-bilgi-kutusu-kaldirildi.js` (ikisi de
`kartlar/08-kart-odeme.js`'e bağımlı, o dosya hâlâ taşınmadı — `grep -c
"provide("` ile 0 olduğu doğrulandı), `islemler/04-islem-filtre.js` (→
`islemler/03-islem-liste-render.js`, taşınmadı), `odeme/05-hesap-secim-
popup.js` (→ `odeme/08-popup-giris-noktalari.js`, taşınmadı), 5
`tanimlamalar/*` dosyası (`04-tbk-faiz-oranlari.js` HARİÇ hepsi
`tanimlamalar/02-ana-sayfa.js`'ye bağımlı — o dosya taşınmadı,
`04-tbk-faiz-oranlari.js` ise `ozet.js` ve `tbk-detay.js`'ye bağımlı,
ikisi de taşınmadı), `krediler/05-kredi-tipi-tanimlama.js` (→
`tanimlamalar/02-ana-sayfa.js`, taşınmadı).

**Kritik doğrulama yapıldı:**
- Çift-prefix taraması (`_coreState._coreState`, `_format._format`,
  `_wrapRegistry._wrapRegistry`, `_odemeGenelYardimcilar.
  _odemeGenelYardimcilar`, `_islemlerState._islemlerState`,
  `_islemKategoriSecici._islemKategoriSecici`, `_modalGenel._modalGenel`)
  her iki dosyada da yapıldı — bulunmadı.
- Bare (prefix'siz) `DB.`/`localDateStr(`/`call(`/`AC_ENGELLI_KELIMELER`/
  `renderIslemKategoriButon(`/`openModal(`/`closeModal(` kalıntısı
  taraması yapıldı — bulunmadı.
- `node --check` ile TÜM proje dosya dosya taranıp doğrulandı — 0 hata.

Cache-bust: `?v=39` → `?v=40` (yalnızca `<link rel="stylesheet">` tag'leri;
32→32 sayımıyla doğrulandı).

**Gerçek sayı doğrulaması:** `grep -rlE "provide\(['\"]ui\.pages\." js/ui/pages
| wc -l` → **17** (önceki gerçek 15 + bu turdaki 2).

**Sıradaki tur için not:** 77 dosyadan 17'si tamamlandı, 60 kaldı. Şu an
"2 `@pages/*` importlu" katmandaki geri kalan adayların HEPSİ ya
`tanimlamalar/02-ana-sayfa.js`'ye ya da başka henüz taşınmamış büyük
render dosyalarına (`islemler/03-islem-liste-render.js`,
`kartlar/08-kart-odeme.js`, `odeme/08-popup-giris-noktalari.js`,
`ozet.js`, `tbk-detay.js`) bağımlı — yani "düşük-bağımlılık" stratejisi
tekrar tükendi (Tur 13'teki gibi). Bir sonraki tur için iki seçenek:
(a) fan-in'i yüksek bir hedef sayfayı (örn. `tanimlamalar/02-ana-sayfa.js`
— en az 4 `tanimlamalar/*` dosyasının beklediği hedef, kendi import
sayısı önce `grep -n "^import "` ile ölçülmeli) doğrudan taşımak, böylece
5-6 bekleyen dosya birden açılır; (b) `islemler/01-aciklama-onerileri.js`
ve `islemler/06-islem-kategori-secici.js`'in kendi tüketicilerini
`inject()`'e çevirme turuna geçmek (DI-MIGRATION madde 2, paralel seçenek
olarak Tur 15'te de önerilmişti).

**ÖNEMLİ — bu ortamda yapılamayan doğrulama:** `mevduat/04-mevduat-
otomasyon.js` otomatik vade kontrolünü ve yaklaşan ödeme tespitini,
`islemler/01-aciklama-onerileri.js` işlem açıklaması otomatik tamamlama
modalını besliyor — teslimden önce yerelde/GitHub Pages'te test
edilmeli: mevduat listesinde otomatik vade yenileme davranışı, işlem
ekleme formunda açıklama öneri modalı (arama, geçmiş öneriler, "Kullan",
Enter/Escape tuşları).

## Tur 22'de tamamlanan — yüksek fan-in'li hedef sayfa taşındı (17/77 → 18/77)

Tur 21'in önerdiği (a) seçeneği uygulandı: `tanimlamalar/02-ana-sayfa.js`
(fan-in 10, en az 4 bekleyen `tanimlamalar/*` dosyasının hedefi) taşındı.

**Kritik keşif — yanlış ilk deneme, geri alındı:** Dosyanın 13 `@pages/*`
importunun TAMAMINI hemen `inject()`'e çevirmeye başlandı (gerekçe: hepsi
SADECE `renderTanimlamalar()` fonksiyon gövdesinde/event-listener
callback'lerinde kullanılıyor, top-level çağrı yok — bu doğruydu). ANCAK
bu adımdan SONRA her 13 hedefin GERÇEKTEN container'da olup olmadığı
`grep -c "provide("` ile TEK TEK kontrol edildiğinde, sadece 2'sinin
(`tanimlamalar/01-genel-yardimcilar.js`, `tanimlamalar/03-kategoriler.js`)
gerçekten `provide()` edilmiş olduğu görüldü — kalan 11'i (`kartlar/09-
kart-altyapi.js`, `hesaplar/02-hesap-turu-tanimlama.js`, `kartlar/01-kart-
data.js`, `krediler/05-kredi-tipi-tanimlama.js`, `krediler/01-genel-
yardimcilar.js`, `tanimlamalar/06-para-birimi.js`, `07-bankalar.js`,
`08-subeler.js`, `09-urun-tipleri.js`, `10-resmi-tatiller.js`,
`tanimlamalar/05-genel-oran-tablolari.js`) `inject()` etmek, henüz var
OLMAYAN namespace'lere işaret eden bir Proxy oluşturup çalışma zamanında
"kayıtlı değil" hatası fırlatacaktı. İlk deneme TAMAMEN GERİ ALINDI, doğru
yaklaşımla yeniden yapıldı: sadece gerçekten container'da olan
bağımlılıklar `inject()`'e çevrildi, kalan 11'i (+ yeni bulunan
`@components/kisiler.js`, o da container'da çıktı) dual-mode gereği
statik import olarak BIRAKILDI.

**Bu turda yapılan gerçek değişiklik:**
- `tanimlamalar/01-genel-yardimcilar.js` → `_tanimlamalarGenelYardimcilar`
  (namespace: `ui.pages.tanimlamalarGenelYardimcilar`, `_self` pattern,
  Tur 11'den beri container'da).
- `tanimlamalar/03-kategoriler.js` → `_kategoriler` (namespace:
  `ui.pages.tanimlamalarKategoriler`, Tur 15'ten beri container'da,
  SADECE `renderKategoriGrid` kullanılıyor, `renderTanimlamalar()`
  gövdesinde — çift yönlü dairesellik olsa da callback içinde olmadığı
  için (doğrudan fonksiyon gövdesi başında çağrılıyor, ama modül EVAL
  zamanında değil, `renderTanimlamalar()` ÇAĞRILDIĞINDA — yani her ikisi
  de modülleri tamamen yüklendikten SONRA) güvenli).
- `@components/kisiler.js` → `_kisiler` (namespace: `ui.components.
  kisiler`, Tur 9'dan beri container'da; bu dosyanın `kisiler.js`'i geri
  import etmediği ayrıca doğrulandı — dairesellik yok).
- Kalan 11 `@pages/*` importu (yukarıda listelendi) + `renderTumOranTablolari`
  (`tanimlamalar/05-genel-oran-tablolari.js`, henüz taşınmadı) BİLİNÇLİ
  OLARAK statik import olarak bırakıldı.
- `DB`/`CURRENCY_CONFIG`/`defaultCurrency` (`@core/state.js`) ve `fmtDate`
  (`@core/format.js`) importlarına BU TURDA dokunulmadı — kapsamı `@pages/*`
  ve `@components/*` katmanıyla sınırlı tutmak için bilinçli tercih (Tur
  4-5'teki core-katmanı ayrımıyla tutarlı).
- Fonksiyon gövdesinde 9 kullanım yeri güncellendi: `renderKategoriGrid()`
  → `_kategoriler.renderKategoriGrid()`, `renderKisilerGrid()` →
  `_kisiler.renderKisilerGrid()`, `bankaIkonObj(b)` →
  `_tanimlamalarGenelYardimcilar.bankaIkonObj(b)`, 4× `_tanimBadgeHtml(...)`
  → `_tanimlamalarGenelYardimcilar._tanimBadgeHtml(...)` (içindeki
  `urunTipiRenk`/`paraBirimiRenk` çağrıları da uygun şekilde prefix'lendi,
  `krediTipiRenk`/`kartAltyapiRenk` İSE statik import'tan geldiği için
  DOKUNULMADI), 4× `_renkKolonHtml(...)` →
  `_tanimlamalarGenelYardimcilar._renkKolonHtml(...)`.
- `provide('ui.pages.tanimlamalarAnaSayfa', { renderTanimlamalar })`
  eklendi.

**Kritik doğrulama yapıldı:**
- İlk (yanlış) denemenin TAMAMEN geri alındığı, hiçbir `inject('ui.pages.
  kartAltyapi')` gibi var olmayan namespace çağrısının kalmadığı `grep`
  ile teyit edildi.
- Bare (prefix'siz) `renderKategoriGrid(`/`renderKisilerGrid(`/
  `bankaIkonObj(`/`_tanimBadgeHtml(`/`_renkKolonHtml(`/`urunTipiRenk(`/
  `paraBirimiRenk(` kalıntısı taraması yapıldı — bulunmadı (bir ilk
  geçişte `urunTipiRenk(t.id)` satırı prefix'siz kalmıştı, ikinci bir
  düzeltmeyle giderildi).
- Çift-prefix taraması yapıldı — bulunmadı.
- `kisiler.js`'in bu dosyayı geri import etmediği ayrıca doğrulandı
  (yeni bulunan bağımlılık olduğu için ekstra dikkat gerekti).
- `node --check` ile TÜM proje dosya dosya taranıp doğrulandı — 0 hata.
- Bu dosyanın export ettiği tek isim (`renderTanimlamalar`) DEĞİŞMEDİĞİ
  için mevcut 10 tüketicinin (dual-mode, statik import) KIRILMADIĞI
  doğrulandı.

Cache-bust: `?v=40` → `?v=41` (32→32 sayımıyla doğrulandı).

**Gerçek sayı doğrulaması:** `grep -rlE "provide\(['\"]ui\.pages\." js/ui/pages
| wc -l` → **18** (önceki gerçek 17 + bu turdaki 1).

**Metodolojik ders — YENİ checklist maddesi:** Bir dosyanın TÜM
`@pages/*`/`@components/*` importlarının "sadece fonksiyon gövdesinde
kullanılıyor, güvenli" olması, o importların `inject()`'e çevrilebileceği
anlamına GELMEZ — ayrı bir soru olan "hedef GERÇEKTEN container'da mı"
(`grep -c "provide("` ile TEK TEK) HER ZAMAN önce sorulmalı. Bu tur, bu
iki kontrolü birbirine karıştırıp yanlış bir ilk deneme yaptı, ama
teslim ETMEDEN önce fark edilip düzeltildi. Bundan sonra: (1) dairesellik
taraması (Tur 15), (2) top-level çağrı mı callback-içi mi taraması (Tur
20/21 örtük), (3) hedefin GERÇEKTEN provide edilmiş olup olmadığı taraması
(bu tur) — ÜÇÜ DE her taşımadan önce ayrı ayrı yapılmalı.

**Sıradaki tur için not:** 77 dosyadan 18'i tamamlandı, 59 kaldı. Bu
turun açtığı 4 bekleyen dosya (`06-para-birimi.js`, `08-subeler.js`,
`09-urun-tipleri.js`, `10-resmi-tatiller.js` — hepsi artık SADECE
`tanimlamalar/00-state.js` ve YENİ taşınan `tanimlamalar/02-ana-sayfa.js`'ye
bağımlı, ikisi de container'da) şimdi taşınabilir hale geldi — bunlardan
biri veya birkaçı bir sonraki turun doğal hedefi. Her biri için önce
`grep -n "^import "` ile TAM import listesi ve dairesellik (02-ana-
sayfa.js zaten dairesel olduğu biliniyor — callback-içi kullanım
garantisi her dosya için AYRI doğrulanmalı) kontrol edilmeli.

## Tur 23'te tamamlanan — ui/pages katmanında 1 yeni dosya (18/77 → 19/77)

Tur 22'nin açtığı 4 adaydan (`06-para-birimi.js`, `08-subeler.js`,
`09-urun-tipleri.js`, `10-resmi-tatiller.js`) en düşük bağımlılıklı olan
seçildi: `tanimlamalar/08-subeler.js` → `ui.pages.tanimlamalarSubeler`.

**Sayaç önce yeniden ölçüldü:** 18/77, Tur 22 ile birebir eşleşti.

**Taşınan bağımlılıklar (3):**
- `@components/modal-genel.js` (`_sidebarDim`) → `_modalGenel` (namespace:
  `ui.components.modalGenel`, uzun süredir container'da).
- `tanimlamalar/00-state.js` (`setSubeModalBankaId`, `setSubeListTumu`,
  `subeListTumu`, `subeModalBankaId`) → `_tanimlamalarState` (namespace:
  `ui.pages.tanimlamalarState`, `_self` pattern — mutable `var` export'lar
  canlı binding ile okunuyor).
- `tanimlamalar/02-ana-sayfa.js` (`renderTanimlamalar`) →
  `_tanimlamalarAnaSayfa` (namespace: `ui.pages.tanimlamalarAnaSayfa`,
  Tur 22'de taşınmıştı). **Dairesellik teyit edildi:** `02-ana-sayfa.js`
  bu dosyayı GERİ import ediyor (`openSubeModal`) — Tur 22'nin kendi
  yorumunda zaten öngörülmüştü. `renderTanimlamalar()` çağrıları SADECE
  `deleteSube`/`saveSubeForm` fonksiyon gövdelerinde, modül eval
  zamanında DEĞİL — güvenli (Tur 15/20/21/22 deseniyle tutarlı).

**Kritik doğrulama yapıldı:**
- Her 3 hedefin GERÇEKTEN container'da olduğu `grep -c "provide("` ile
  TEK TEK doğrulandı (Tur 22'nin dersi uygulandı — körü körüne
  `inject()`'e çevrilmedi).
- `x.id === subeModalBankaId` deseninin (4 farklı fonksiyonda tekrar
  eden) `sed` ile TOPLU değil, önce `python3` bulk-replace'te KAÇTIĞI
  fark edilip ayrı bir `sed` geçişiyle 4 yerde de düzeltildiği doğrulandı.
- Bare (prefix'siz) `setSubeModalBankaId(`/`setSubeListTumu(`/
  `subeListTumu`/`subeModalBankaId`/`_sidebarDim(`/`renderTanimlamalar(`
  kalıntısı taraması yapıldı — sadece bir yorum satırında (zararsız)
  eşleşme bulundu, kodda kalıntı yok.
- Çift-prefix taraması yapıldı — bulunmadı.
- Bu dosyanın export ettiği 8 fonksiyon isminin (`getSubeAdFromKodlar`,
  `openSubeModal`, `refreshSubeModal`, `filterSubeList`, `renderSubeList`,
  `editSube`, `deleteSube`, `saveSubeForm`) DEĞİŞMEDİĞİ doğrulandı —
  mevcut tüketiciler (dual-mode, statik import) kırılmadı.
- `node --check` ile TÜM proje dosya dosya taranıp doğrulandı — 0 hata.

Cache-bust: `?v=41` → `?v=42` (32→32 sayımıyla doğrulandı).

**Gerçek sayı doğrulaması:** `grep -rlE "provide\(['\"]ui\.pages\." js/ui/pages
| wc -l` → **19** (önceki gerçek 18 + bu turdaki 1).

**Sıradaki tur için not:** 77 dosyadan 19'u tamamlandı, 58 kaldı. Kalan 3
kardeş dosya (`06-para-birimi.js`, `09-urun-tipleri.js`, `10-resmi-
tatiller.js`) hâlâ uygun — hepsi `tanimlamalar/00-state.js`,
`02-ana-sayfa.js` ve `modal-genel.js`'ye bağımlı, üçü de container'da.
`06-para-birimi.js` en fazla bağımlılığa sahip (`app-core-base.js`,
`format.js`, `render-core.js`, `state.js`, `doviz.js`, `modal-genel.js`,
`money-input.js`, `step-wizard.js`, `00-state.js`, `02-ana-sayfa.js` —
10 import, çoğu `@core`/`@domain`/`@components` katmanından, bunların
container durumu AYRICA kontrol edilmeli), `09-urun-tipleri.js` ve
`10-resmi-tatiller.js` ise `08-subeler.js`'e çok benzer boyutta (5-6
import) — bir sonraki turun doğal adayları. Her biri için (1) dairesellik,
(2) top-level çağrı mı callback-içi mi, (3) hedefin GERÇEKTEN container'da
olup olmadığı — üç kontrol de AYRI AYRI tekrarlanmalı (Tur 22 dersi).

## Tur 24'te tamamlanan — ui/pages katmanında 2 yeni dosya (19/77 → 21/77)

Tur 23'ün önerdiği iki küçük kardeş dosya birlikte taşındı:
`tanimlamalar/09-urun-tipleri.js` ve `tanimlamalar/10-resmi-tatiller.js`.

**Sayaç önce yeniden ölçüldü:** 19/77, Tur 23 ile birebir eşleşti.

**`tanimlamalar/09-urun-tipleri.js` → `ui.pages.tanimlamalarUrunTipleri`:**
- `@components/modal-genel.js` (`_sidebarDim`, `showConfirm`,
  `validateRequiredFields`, `closeModal`, `openModal`) → `_modalGenel`.
- `@components/select-to-chips.js` (`applyChipsToContainer`) →
  `_selectToChips` (namespace: `ui.components.selectToChips`, container'da
  olduğu `grep -c "provide("` ile doğrulandı).
- `tanimlamalar/00-state.js` (`editUrunTipId`, `setEditUrunTipId`) →
  `_tanimlamalarState` (`_self` pattern).
- `tanimlamalar/02-ana-sayfa.js` (`renderTanimlamalar`) →
  `_tanimlamalarAnaSayfa`. **Dairesellik teyit edildi** (02-ana-sayfa.js
  bu dosyayı `deleteUrunTip`/`editUrunTip` için geri import ediyor) — tüm
  kullanımlar fonksiyon gövdesinde, güvenli.

**`tanimlamalar/10-resmi-tatiller.js` → `ui.pages.tanimlamalarResmiTatiller`:**
- Yukarıdaki aynı 2 hedef (`_modalGenel`, `_tanimlamalarState`,
  `_tanimlamalarAnaSayfa`) + `@components/money-input.js`
  (`setDateInputValue`) → `_moneyInput` (namespace: `ui.components.
  moneyInput`, container'da olduğu doğrulandı).
- **Özel durum:** `showToast` çağrıları `if(typeof showToast ===
  'function') showToast(...)` savunmacı deseniyle sarılıydı — bu, `_modalGenel.
  showToast` şeklinde güncellendi (`typeof _modalGenel.showToast ===
  'function'`), çünkü `_modalGenel` bir Proxy nesnesi ve `showToast`
  property'si her zaman fonksiyon olarak çözülüyor; orijinal savunmacı
  kontrol semantiği korunmuş oldu.
- `_kurServisleri` (Tur 23'ten önce zaten `inject()` edilmişti, bu turda
  DOKUNULMADI, olduğu gibi bırakıldı).

**Kritik doğrulama yapıldı:**
- Her hedefin (`selectToChips`, `moneyInput` dahil, ikisi de İLK KEZ bu
  projede `inject()` edilen namespace'ler) GERÇEKTEN container'da olduğu
  `grep -c "provide("` ile TEK TEK doğrulandı (Tur 22 dersi).
- İki dosyada da dairesellik (`02-ana-sayfa.js` ile) doğrulandı ve
  yorumla belgelendi.
- Bare (prefix'siz) kalıntı taraması her iki dosyada da yapıldı — sadece
  yorum satırlarında (zararsız) eşleşme bulundu.
- Çift-prefix taraması her iki dosyada da yapıldı — bulunmadı.
- Her iki dosyanın export listesi (`09-urun-tipleri.js`: 4 fonksiyon,
  `10-resmi-tatiller.js`: 5 fonksiyon) DEĞİŞMEDİĞİ doğrulandı — mevcut
  tüketiciler (dual-mode) kırılmadı.
- `node --check` ile TÜM proje dosya dosya taranıp doğrulandı — 0 hata.

Cache-bust: `?v=42` → `?v=43` (32→32 sayımıyla doğrulandı).

**Gerçek sayı doğrulaması:** `grep -rlE "provide\(['\"]ui\.pages\." js/ui/pages
| wc -l` → **21** (önceki gerçek 19 + bu turdaki 2).

**Sıradaki tur için not:** 77 dosyadan 21'i tamamlandı, 56 kaldı. Kalan
tek `tanimlamalar/*` kardeşi `06-para-birimi.js` — 10 import ile en
büyüğü, hedefleri (`app-core-base.js`, `render-core.js`, `doviz.js`,
`step-wizard.js` gibi daha önce hiç dokunulmamış modüller) TEK TEK
`grep -c "provide("` ile kontrol edilmeden taşınmamalı. Alternatif
olarak, artık `ui.components.selectToChips` ve `ui.components.moneyInput`
namespace'leri de "provider" listesine katıldığı için, bu iki bileşeni
kullanan BAŞKA `@pages/*` dosyaları da taranabilir (`grep -rl
"select-to-chips.js\|money-input.js" js/ui/pages` ile hızlı bir tarama
yeni adaylar açığa çıkarabilir).




## Tur 25'te tamamlanan — ui/pages katmanında 1 dosya (21/77 → 22/77)

`tanimlamalar/06-para-birimi.js` taşındı (Tur 23/24'te ertelenmiş, en
büyük bağımlılık setine sahip kardeş dosya).

**Sayaç önce yeniden ölçüldü:** 21/77, Tur 24 ile birebir eşleşti.

**`tanimlamalar/06-para-birimi.js` → `ui.pages.tanimlamalarParaBirimi`:**
- `@core/*` ve `@domain/*` importlarına (Tur 22'deki bilinçli kapsam
  kararıyla tutarlı olarak) DOKUNULMADI — sadece `@components/*` ve
  `@pages/*` importları `inject()`'e çevrildi.
- `@components/modal-genel.js` (`showConfirm`, `showToast`,
  `validateRequiredFields`, `closeModal`, `openModal`) → `_modalGenel`.
- `@components/money-input.js` (`updateMoneyWrapSymbols`) → `_moneyInput`.
- `@components/step-wizard.js` (`swizUpdateStepIndicator`) → `_stepWizard`.
- `tanimlamalar/00-state.js` (`DEFAULT_CURRENCY_CONFIG`, `PB_STEP_COUNT`,
  `_pbCurrentStep`, `editParaBirimiKod`, `setEditParaBirimiKod`,
  `set_pbCurrentStep`) → `_tanimlamalarState` (`_self` pattern; canlı
  değişkenler modül namespace objesi üzerinden okunuyor).
- `tanimlamalar/02-ana-sayfa.js` (`renderTanimlamalar`) →
  `_tanimlamalarAnaSayfa`. **Dairesellik teyit edildi** (02-ana-sayfa.js
  bu dosyayı `deleteParaBirimi`/`editParaBirimi`/`setGosterimParaBirimi`
  için geri import ediyor) — tüm kullanımlar `addEventListener`
  callback'i içinde, top-level çağrı yok, güvenli.
- `_kurServisleri` (önceki turdan zaten `inject()` edilmişti, bu turda
  DOKUNULMADI, olduğu gibi bırakıldı).

**Kritik doğrulama yapıldı:**
- 5 hedef namespace'in (`ui.components.modalGenel`,
  `ui.components.moneyInput`, `ui.components.stepWizard`,
  `ui.pages.tanimlamalarState`, `ui.pages.tanimlamalarAnaSayfa`) GERÇEKTEN
  container'da olduğu TEK TEK `grep -rn "provide("` ile doğrulandı; her
  provide bloğunun içeriği okunup ihtiyaç duyulan fonksiyonları
  gerçekten export ettiği teyit edildi (Tur 22 dersi).
- Dairesellik `02-ana-sayfa.js` ile doğrulandı ve yorumla belgelendi.
- **Eksik olan `provide()` çağrısı fark edildi ve eklendi:** bu dosya
  önceki turların taşıdığı kardeşlerinin aksine yalnızca `inject()`
  ediyordu, kendi export'larını container'a `provide()` etmiyordu —
  DI-MIGRATION dual-mode deseniyle tutarlılık için 14 export'u içeren
  `ui.pages.tanimlamalarParaBirimi` provide bloğu eklendi. Bu adım
  atlanmış olsaydı dosya "taşınmış" görünecek ama gerçek sayaca
  (`provide('ui.pages.` grep'i) yansımayacaktı.
- Çift-prefix taraması yapıldı — bulunmadı.
- Bare (prefix'siz) kalıntı taraması yapıldı (yorum satırları hariç) —
  kodda kalıntı yok.
- Export listesi (14 fonksiyon: `loadCurrencyConfig`,
  `updateParaBirimiPreview`, `setParaBirimi`, `renderParaBirimiGrid`,
  `selectParaBirimi`, `openParaBirimiModal`, `setGosterimParaBirimi`,
  `editParaBirimi`, `pbStepGoto`, `_pbValidateStep`, `pbStepNext`,
  `pbStepBack`, `saveParaBirimi`, `deleteParaBirimi`) DEĞİŞMEDİĞİ
  doğrulandı — mevcut tüketiciler (02-ana-sayfa.js dual-mode importu)
  kırılmadı.
- `node --check` ile TÜM proje dosya dosya taranıp doğrulandı — 0 hata.

Cache-bust: kullanıcı isteği üzerine bu turda YAPILMADI.

**Gerçek sayı doğrulaması:** `grep -rlE "provide\(['\"]ui\.pages\." js/ui/pages
| wc -l` → **22** (önceki gerçek 21 + bu turdaki 1).

**Sıradaki tur için not:** 77 dosyadan 22'si tamamlandı, 55 kaldı.
`tanimlamalar/*` kardeş kümesi artık tamamen bitti (00, 02, 06, 08, 09,
10 hepsi container'da). Sıradaki adaylar için önerilen tarama:
`ui.components.selectToChips`, `ui.components.moneyInput` ve
`ui.components.stepWizard` namespace'lerini kullanan BAŞKA `@pages/*`
dosyaları taranabilir (`grep -rl "select-to-chips.js\|money-input.js\|
step-wizard.js" js/ui/pages` ile hızlı bir tarama yeni adaylar açığa
çıkarabilir), ya da `tanimlamalar/` dışındaki başka bir alt-klasör
(`kartlar/`, `krediler/`, `mevduat/` vb.) taranarak benzer büyüklükte
(4-10 import) bir sonraki aday seçilebilir. Her aday için üç kontrol
(dairesellik, top-level/callback ayrımı, hedefin GERÇEKTEN container'da
olup olmadığı) ayrı ayrı tekrarlanmalı; ayrıca bu turda fark edildiği
gibi, taşınan dosyanın kendi `provide()` bloğunu unutmadığından da
emin olunmalı — aksi halde dosya taşınmış görünür ama gerçek sayaca
yansımaz.

## Tur 26'da tamamlanan — ui/pages katmanında 1 dosya (22/77 → 23/77)

**Önceki turun notundaki hata düzeltildi:** Tur 24'ün notu "tanimlamalar/*
kardeşi tamamen bitti" diyordu, ama yeniden tarama `04-tbk-faiz-
oranlari.js`, `05-genel-oran-tablolari.js` ve `07-bankalar.js`'nin hâlâ
container'da olmadığını gösterdi. `04` ve `05` incelendi ama ERTELENDİ:
- `04-tbk-faiz-oranlari.js` → `@pages/ozet.js` ve `@pages/tbk-detay.js`'a
  bağımlı, ikisi de `provide()` etmiyor (container'da değil) — taşınamaz.
- `05-genel-oran-tablolari.js` → `@pages/hesaplar/04-hesap-liste-
  render.js`'e bağımlı, o da container'da değil — taşınamaz.
- `07-bankalar.js` → tüm hedefleri (`ibanUi`, `modalGenel`, `00-state`,
  `01-genel-yardimcilar`, `02-ana-sayfa`) container'da doğrulandı, bu
  turda TAŞINDI.

**Sayaç önce yeniden ölçüldü:** 22/77, Tur 25 ile birebir eşleşti.

**`tanimlamalar/07-bankalar.js` → `ui.pages.tanimlamalarBankalar`:**
- `@core/*` ve `@domain/*` importlarına dokunulmadı (`saveData`, `uid`,
  `DB`, `BANKA_LOGOLAR`, `BANK_ICON_MAP` aynen kaldı).
- `@components/iban-ui.js` (`_renderBankaLogoPicker`, `_selectBankaLogo`,
  `onBankaIbanKodInput`) → `_ibanUi`.
- `@components/modal-genel.js` (`_sidebarDim` [kullanılmıyor ama zaten
  import edilmişti, tutarlılık için prefix'lendi], `showConfirm`,
  `showToast`, `validateRequiredFields`, `closeModal`, `openModal`) →
  `_modalGenel`.
- `tanimlamalar/00-state.js` (`PRESET_BANKALAR`, `editBankaId`,
  `setEditBankaId`) → `_tanimlamalarState`.
- `tanimlamalar/01-genel-yardimcilar.js` (`bankaLogoByKod`) →
  `_tanimlamalarGenelYardimcilar` (namespace:
  `ui.pages.tanimlamalarGenelYardimcilar`, `_self` pattern — bu dosya
  aslında `@domain/tanim-yardimcilar.js`'den re-export yapıyor, ama
  provide edilen isim `tanimlamalarGenelYardimcilar`).
- `tanimlamalar/02-ana-sayfa.js` (`renderTanimlamalar`) →
  `_tanimlamalarAnaSayfa`. **Dairesellik teyit edildi** (02-ana-sayfa.js
  bu dosyayı `openBankaModal`/`deleteBanka` için geri import ediyor) —
  tüm kullanımlar `addEventListener` callback'i içinde, top-level çağrı
  yok, güvenli.

**Kritik doğrulama yapıldı:**
- 5 hedef namespace'in (`ui.components.ibanUi`, `ui.components.
  modalGenel`, `ui.pages.tanimlamalarState`, `ui.pages.
  tanimlamalarGenelYardimcilar`, `ui.pages.tanimlamalarAnaSayfa`)
  GERÇEKTEN container'da olduğu TEK TEK `grep -n "provide("` ile
  doğrulandı; her provide bloğunun içeriği okunup ihtiyaç duyulan
  fonksiyonları gerçekten export ettiği teyit edildi.
- Dairesellik `02-ana-sayfa.js` ile doğrulandı ve yorumla belgelendi.
- `provide()` bloğu eklendi (Tur 25'te fark edilen eksiklik dersi
  tekrarlanmadı — bu kez baştan planlandı): 5 export'u içeren
  `ui.pages.tanimlamalarBankalar`.
- Çift-prefix taraması yapıldı — bulunmadı.
- Bare (prefix'siz) kalıntı taraması yapıldı — kodda kalıntı yok
  (yalnızca yorumlarda, biri düzeltildi çünkü replace script'i
  yanlışlıkla bir yorum satırındaki metni de değiştirmişti — kontrol
  edilip elle geri düzeltildi; bu, python bulk-replace'in yorum
  satırlarını da tarayabileceğinin bir hatırlatıcısı, Tur 23'teki sed
  kaçağı dersiyle aynı kategoride).
- Export listesi (5 fonksiyon: `openBankaModal`, `_pickBankaLogo`,
  `saveBanka`, `seedPresetBankalar`, `deleteBanka`) DEĞİŞMEDİĞİ
  doğrulandı — mevcut tüketiciler (02-ana-sayfa.js dual-mode importu)
  kırılmadı.
- `node --check` ile TÜM proje dosya dosya taranıp doğrulandı — 0 hata.

Cache-bust: bu turda da YAPILMADI (kullanıcı isteği hâlâ geçerli).

**Gerçek sayı doğrulaması:** `grep -rlE "provide\(['\"]ui\.pages\." js/ui/pages
| wc -l` → **23** (önceki gerçek 22 + bu turdaki 1).

**Sıradaki tur için not:** 77 dosyadan 23'ü tamamlandı, 54 kaldı.
`tanimlamalar/*` klasöründe GERÇEKTEN kalan: `04-tbk-faiz-oranlari.js`
ve `05-genel-oran-tablolari.js` — ikisi de şu an bağımlılıkları
(`ozet.js`, `tbk-detay.js`, `hesaplar/04-hesap-liste-render.js`)
container'da olmadığı için ERTELENMİŞ durumda. Bunları taşımanın iki
yolu var: (a) önce `ozet.js`/`tbk-detay.js`/`hesaplar/04-hesap-liste-
render.js`'i container'a taşımak (ama bunlar `@pages/*` kök dosyaları,
büyük olabilir — önce boyutlarına bakılmalı), ya da (b) `tanimlamalar/`
dışında container'da olan hedeflere bağımlı başka bir aday aramak.
**ÖNEMLİ:** Bir sonraki tur, "X klasörü tamamen bitti" gibi bir iddiada
bulunmadan önce MUTLAKA o klasördeki HER dosyayı tek tek `grep -q
"provide(" dosya` ile taramalı (Tur 24 bu adımı atlayıp yanlış iddiada
bulunmuştu). Her aday için üç kontrol (dairesellik, top-level/callback
ayrımı, hedefin container'da olup olmadığı) ayrı ayrı tekrarlanmalı.

## Tur 27'de tamamlanan — ui/pages katmanında 1 dosya (23/77 → 24/77)

Tur 26'nın önerdiği (b) yolu izlendi: `tanimlamalar/` dışında,
`@pages/*` bağımlılıklarının HEPSİ container'da olan yeni bir aday
klasör-genelinde taramayla arandı (python script: her henüz taşınmamış
dosyanın `@pages/*` importlarını çıkarıp hepsinin `provide()` eden bir
dosyaya karşılık gelip gelmediği kontrol edildi). İki aday bulundu
(`krediler/05-kredi-tipi-tanimlama.js`: 8 import/2 @pages hedefi,
`veri-yonetimi.js`: 10 import/3 @pages hedefi) — küçüğü seçildi.

**Sayaç önce yeniden ölçüldü:** 23/77, Tur 26 ile birebir eşleşti.

**Önemli düzeltme (`tanimlamalar/*` klasörü durumu netleştirildi):**
`hesaplar/`, `mevduat/`, `krediler/`, `kartlar/`, `islemler/`, `odeme/`
klasörlerinin TAMAMI tek tek tarandı (Tur 26'nın "her dosyayı kontrol
et" uyarısı bu turda tekrarlandı) — bu klasörlerdeki neredeyse tüm
henüz-taşınmamış dosyalar birbirlerine (veya kendi klasörlerindeki
henüz-taşınmamış kardeşlerine) dairesel/zincir bağımlı, bu yüzden şu an
TAŞINAMAZLAR. Sadece `@pages/*` bağımlılıkları TAMAMEN container'da
olan dosyalar taşınabilir; bu turda bulunan tek uygun küçük aday
`krediler/05-kredi-tipi-tanimlama.js` oldu.

**`krediler/05-kredi-tipi-tanimlama.js` → `ui.pages.kredilerKrediTipiTanimlama`:**
- `@core/*` importlarına dokunulmadı (`saveData`, `uid`, `DB` aynen
  kaldı; bu dosyada `@domain/*` import yoktu).
- `@components/modal-genel.js` (`_sidebarDim`, `showConfirm`,
  `showToast`, `validateRequiredFields`, `closeModal`) → `_modalGenel`.
- `@components/select-to-chips.js` (`applyChipsToContainer`) →
  `_selectToChips`. **Not:** provide bloğu 1246 satırlık dosyanın
  sonunda uzun bir obje listesiydi; `applyChipsToContainer`'ın gerçekten
  o listede olup olmadığı ilk `grep -A10` ile net görülemedi (blok daha
  uzundu), `view` ile TAM blok okunarak doğrulandı — kısayol grep'lerin
  büyük provide bloklarında yanıltıcı olabileceğinin hatırlatıcısı.
- `krediler/00-state.js` (`editKrediTipId`, `setEditKrediTipId`) →
  `_kredilerState` (namespace: `ui.pages.kredilerState`, `_self`
  pattern).
- `tanimlamalar/02-ana-sayfa.js` (`renderTanimlamalar`) →
  `_tanimlamalarAnaSayfa`. **Dairesellik teyit edildi** (02-ana-sayfa.js
  bu dosyayı `openKrediTipModal`/`deleteKrediTip` için geri import
  ediyor) — tüm kullanımlar `addEventListener` callback'i içinde,
  top-level çağrı yok, güvenli.

**Kritik doğrulama yapıldı:**
- 3 hedef namespace'in (`ui.components.modalGenel`, `ui.components.
  selectToChips`, `ui.pages.kredilerState`, `ui.pages.
  tanimlamalarAnaSayfa` — aslında 4) GERÇEKTEN container'da olduğu ve
  ihtiyaç duyulan fonksiyonları export ettiği TEK TEK doğrulandı.
- Dairesellik `02-ana-sayfa.js` ile doğrulandı ve yorumla belgelendi.
- `provide()` bloğu baştan planlanarak eklendi: 3 export'u içeren
  `ui.pages.kredilerKrediTipiTanimlama`.
- Çift-prefix taraması yapıldı — bulunmadı.
- Bare (prefix'siz) kalıntı taraması yapıldı — kodda kalıntı yok
  (yalnızca bir yorum satırında, python bulk-replace yine yorum
  satırını da değiştirmişti — Tur 26'daki gibi fark edilip elle geri
  düzeltildi; bu artık üçüncü kez tekrarlanan bir desen, bir SONRAKİ
  turda regex replace scriptine yorum satırlarını atlayan bir kontrol
  eklenmesi düşünülebilir).
- Export listesi (3 fonksiyon: `openKrediTipModal`, `saveKrediTip`,
  `deleteKrediTip`) DEĞİŞMEDİĞİ doğrulandı — mevcut tüketiciler
  (02-ana-sayfa.js dual-mode importu) kırılmadı.
- `node --check` ile TÜM proje dosya dosya taranıp doğrulandı — 0 hata.

Cache-bust: bu turda da YAPILMADI (kullanıcı isteği hâlâ geçerli).

**Gerçek sayı doğrulaması:** `grep -rlE "provide\(['\"]ui\.pages\." js/ui/pages
| wc -l` → **24** (önceki gerçek 23 + bu turdaki 1).

**Sıradaki tur için not:** 77 dosyadan 24'ü tamamlandı, 53 kaldı.
Bulunan ama henüz taşınmamış ikinci aday hâlâ geçerli:
`veri-yonetimi.js` (10 import, 3 @pages hedefi: `tanimlamalar/
01-genel-yardimcilar.js`, `tanimlamalar/02-ana-sayfa.js`,
`tanimlamalar/03-kategoriler.js` — üçü de container'da doğrulanmalı
ama Tur 26/27'deki hedeflerle örtüştüğü için büyük olasılıkla
uygundur). Bunun ötesinde, aynı python tarama scripti (bu turda
kullanılan: her henüz-taşınmamış dosyanın TÜM @pages/* hedeflerinin
provide() eden bir dosyaya karşılık gelip gelmediğini kontrol eden)
tekrar çalıştırılarak güncel aday listesi yeniden üretilmeli — her
turda bir dosya taşındıkça yeni adaylar açığa çıkabilir (ör. bu turda
`krediler/05-kredi-tipi-tanimlama.js` taşınınca, ona bağımlı olan
başka bir dosya varsa o da artık aday olabilir).
