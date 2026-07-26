# AI Asistanları İçin Talimatlar

Bu proje statik dosyalar olarak GitHub Pages üzerinden yayınlanıyor
(`muhammediyi.github.io/finans/finans.html`). Bu yüzden tarayıcı/CDN
cache'i özellikle önemli.

## Cache-busting kuralı (ZORUNLU)

`js/` veya `css/` altında **herhangi bir dosyayı** değiştirdiysen:

1. `index.html` dosyasını aç.
2. `<head>` altındaki `?v=N` değerini (tüm `<script>`/`<link>` etiketlerinde
   aynı sayı kullanılıyor) bir üst sayıya yükselt (örn. `?v=3` → `?v=4`).
3. Bunu **her seferinde** yap — kullanıcı hatırlatmasa bile. Dosya içeriği
   değişti ama versiyon numarası değişmediyse, GitHub Pages ve tarayıcılar
   eski dosyayı cache'ten servis etmeye devam eder ve kullanıcı değişikliği
   göremez.
4. Sadece `.md` dosyaları, `index.html`'in kendisi, veya CSS/JS dışı statik
   varlıklar (görsel, font vb.) değiştiyse versiyon artırmana gerek yok.

Bu kural hem Claude hem başka bir model (GPT, Cursor, Copilot...) bu repoda
çalışırken geçerlidir.
