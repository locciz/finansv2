// core/static-input-bridge.js
//
// [ES-MODULE UYUMLU] index.html'de STATİK (sayfa yüklenirken hep aynı
// elementte duran, dinamik olarak yeniden üretilmeyen) input/select
// elemanlarının inline onchange="..."/oninput="..." attribute'larını
// bağlar. onclick-bootstrap.js'nin `onclick` için yaptığı desenin AYNISI
// (DOMContentLoaded + getElementById + addEventListener), sadece
// change/input olayları için.
//
// global-input-bridge.js'DEN FARKI: o dosya DİNAMİK (innerHTML ile her
// render'da yeniden üretilen) elementler için event delegation kullanıyor
// (data-oc-handler attribute'u + document seviyeli tek dinleyici). Burada
// ise elementler index.html'de SABİT olduğu için delegation'a gerek yok —
// onclick-bootstrap.js gibi doğrudan id ile bulup bağlamak yeterli ve daha
// basit.
//
// NOT: Bu dosya index.html'deki 131 statik onchange/oninput'un TAMAMINI
// KAPSAMIYOR — yalnızca canlıda hata veren, birden fazla ifade içeren
// (`onchange="fn1();fn2()"`) satırlar buraya taşındı. Kalan statik
// onchange/oninput'lar hâlâ eski window.X = X köprüsüyle çalışıyor
// (bkz. global-input-bridge.js'nin sonundaki window.* atamaları ve
// DI-MIGRATION.md'deki "Sıradaki tur için not — statik window.X temizliği").

import { inject } from '@core/container.js';
const _hesaplamalar = inject('domain.hesaplamalar');
import { onIslemProvizyonManuelDegisti, onIslemTarihiChange } from '@pages/islemler/02-islem-form-degisiklikleri.js';

document.addEventListener('DOMContentLoaded', function() {
  (function(){
    var el = document.getElementById('islem-tarih');
    if (!el) return;
    el.addEventListener('change', function() {
      _hesaplamalar.calcTaksit(false);
      onIslemTarihiChange();
    });
  })();
  (function(){
    var el = document.getElementById('islem-provizyon-tarihi');
    if (!el) return;
    el.addEventListener('change', function() {
      onIslemProvizyonManuelDegisti();
      _hesaplamalar.calcTaksit(true);
    });
  })();
});
