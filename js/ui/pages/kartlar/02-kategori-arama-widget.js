import { DB } from '../../../core/state.js';
import { KD_KAT_PALET, _kd2ExtreKatFiltre, _kd2IslemKatFiltre, _kdExtreKatFiltre, _kdIslemKatFiltre, _kdKatBarCtx, set_kd2ExtreKatFiltre, set_kd2IslemKatFiltre, set_kdExtreKatFiltre, set_kdIslemKatFiltre } from './00-state.js';
import { kdRenderIslemler, kdRenderExtreler } from './04-kart-detay-v1.js';
import { kd2RenderExtreler, kd2RenderIslemler } from './05-kart-detay-v2.js';
// ============================================================
// js/ui/pages/kartlar/02-kategori-arama-widget.js
// İşlem/ekstre kategori arama & filtre bar widget'ı
//
// Bu dosya, eskiden tek parça olan js/ui/pages/kartlar.js (145
// export, 3600+ satır) dosyasının, fonksiyon isim/işlev
// kümelerine göre bölünmüş bir parçasıdır. Kod SATIR SATIR
// AYNI kaldı — sadece dosya sınırı ve gruplama değişti.
// ============================================================
// [KALDIRILDI] Eskiden burada kategori bar'ının kendi mini "arama kutusu"
// vardı: kdKatAraHtml (HTML üretici), kdKatAraBind, kdKatAraInput,
// kdKatAraRenderDropdown, kdKatAraKeydown, kdKatAraSec, kdKatAraTemizle,
// kdKatAraBlur. kdRenderKatBar içinde "aramaHtml = ''" yapılarak bu kutu
// zaten devre dışı bırakılmıştı (bkz. aşağıdaki yorum) — dolayısıyla bu 8
// fonksiyon hiçbir zaman render edilen bir DOM elemanına bağlanamıyor,
// pratikte tamamen ölü kalıyordu (ölü kod taraması, 2026-07).
// _kdKatAraCtxFromWrapId ve _kdKatAraAktifFiltre hâlâ kdKatFiltreToggle'ın
// kardeşi olarak kullanımda oldukları için korundu (bkz. aşağıda).
export function kdRenderKatBar(wrap, islemler) {
  // Not: kategori bar'ının kendi mini arama kutusu kaldırıldı — alttaki genel arama kutusu
  // (kd-islem-arama) zaten açıklama + kategori adına göre arıyor, iki ayrı "kategori ara"
  // kutusu göstermek kafa karıştırıyordu. Bar/lejant tıklanabilir filtre olarak kalıyor.
  const aramaHtml = '';

  const katToplam = new Map(); // katId -> toplam tutar (kart para biriminde, basit toplama)
  let genelToplam = 0;
  islemler.forEach(i => {
    const katId = i.kategori || '__diger';
    const tutar = Math.abs(i.tutar || 0);
    katToplam.set(katId, (katToplam.get(katId) || 0) + tutar);
    genelToplam += tutar;
  });

  if (!islemler.length || genelToplam <= 0) { wrap.innerHTML = aramaHtml; return; }

  let sirali = Array.from(katToplam.entries()).sort((a, b) => b[1] - a[1]);

  // En fazla 7 kategori göster, gerisini "Diğer" olarak topla (bar ve lejant kalabalıklaşmasın)
  const MAX_SEGMENT = 7;
  if (sirali.length > MAX_SEGMENT) {
    const ust = sirali.slice(0, MAX_SEGMENT - 1);
    const kalanToplam = sirali.slice(MAX_SEGMENT - 1).reduce((s, [, v]) => s + v, 0);
    sirali = [...ust, ['__diger_grup', kalanToplam]];
  }

  const segments = sirali.map(([katId, tutar], idx) => {
    const kat = katId === '__diger' || katId === '__diger_grup' ? null : (DB.kategoriler || []).find(x => x.id === katId);
    const ad = kat ? kat.ad : (katId === '__diger_grup' ? 'Diğer' : 'Kategorisiz');
    const ikon = kat && kat.ikon ? kat.ikon : '📦';
    const pct = (tutar / genelToplam) * 100;
    const renk = KD_KAT_PALET[idx % KD_KAT_PALET.length];
    // Filtre olarak gerçek katId kullanılır; gruplanmış "diğer" segmentine tıklamak filtre uygulamaz (anlamsız olurdu)
    const filtrelenebilir = katId !== '__diger_grup';
    return { katId, ad, ikon, pct, tutar, renk, filtrelenebilir };
  });

  const aktifFiltre = _kdKatBarAktifFiltre();
  const trackHtml = segments.map(s => {
    const dim = aktifFiltre && aktifFiltre !== s.katId ? ' dim' : '';
    const clickClass = s.filtrelenebilir ? ' kd-kat-bar-seg-clickable' : '';
    const dataAttr = s.filtrelenebilir ? ` data-katid="${s.katId}"` : '';
    return `<div class="kd-kat-bar-seg${dim}${clickClass}" style="width:${s.pct}%;background:${s.renk}"${dataAttr} title="${s.ad} · %${s.pct.toFixed(1)}"></div>`;
  }).join('');

  const legendHtml = segments.map(s => {
    const dim = aktifFiltre && aktifFiltre !== s.katId ? ' dim' : '';
    const isActive = aktifFiltre && aktifFiltre === s.katId ? ' active-filter' : '';
    const clickClass = s.filtrelenebilir ? ' kd-kat-leg-item-clickable' : '';
    const dataAttr = s.filtrelenebilir ? ` data-katid="${s.katId}"` : '';
    return `<div class="kd-kat-leg-item${dim}${isActive}${clickClass}"${dataAttr}>
      <span class="kd-kat-leg-dot" style="background:${s.renk}"></span>
      <span class="kd-kat-leg-name">${s.ikon} ${s.ad}</span>
      <span class="kd-kat-leg-pct">%${s.pct.toFixed(0)}</span>
    </div>`;
  }).join('');

  const temizleHtml = aktifFiltre ? `<div class="kd-kat-leg-clear">Filtreyi temizle ✕</div>` : '';

  wrap.innerHTML = aramaHtml + `
    <div class="kd-kat-bar-track">${trackHtml}</div>
    <div class="kd-kat-bar-legend">${legendHtml}${temizleHtml}</div>`;

  // [ES module] onclick="kdKatFiltreToggle(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
  wrap.querySelectorAll('.kd-kat-bar-seg-clickable').forEach(seg => {
    seg.addEventListener('click', () => kdKatFiltreToggle(seg.getAttribute('data-katid')));
  });
  wrap.querySelectorAll('.kd-kat-leg-item-clickable').forEach(item => {
    item.addEventListener('click', () => kdKatFiltreToggle(item.getAttribute('data-katid')));
  });
  const temizleBtn = wrap.querySelector('.kd-kat-leg-clear');
  if (temizleBtn) {
    temizleBtn.addEventListener('click', () => kdKatFiltreToggle(null));
  }
}

export function kdKatFiltreToggle(katId) {
  const toggle = (cur) => (katId === null || cur === katId) ? null : katId;
  if (_kdKatBarCtx === 'kd2-islem') {
    set_kd2IslemKatFiltre(toggle(_kd2IslemKatFiltre));
    kd2RenderIslemler();
  } else if (_kdKatBarCtx === 'kd-extre') {
    set_kdExtreKatFiltre(toggle(_kdExtreKatFiltre));
    kdRenderExtreler();
  } else if (_kdKatBarCtx === 'kd2-extre') {
    set_kd2ExtreKatFiltre(toggle(_kd2ExtreKatFiltre));
    kd2RenderExtreler();
  } else {
    set_kdIslemKatFiltre(toggle(_kdIslemKatFiltre));
    kdRenderIslemler();
  }
}

export function _kdKatBarAktifFiltre() {
  switch (_kdKatBarCtx) {
    case 'kd2-islem': return _kd2IslemKatFiltre;
    case 'kd-extre':  return _kdExtreKatFiltre;
    case 'kd2-extre': return _kd2ExtreKatFiltre;
    default:          return _kdIslemKatFiltre; // 'kd-islem'
  }
}

// wrap.id'ye göre hangi _kdKatBarCtx değerine ait olduğunu çözer. Event handler'lar
// (input/klavye) render anından çok sonra tetiklenebileceği için global _kdKatBarCtx'e
// güvenmek yerine bağlamı her seferinde DOM id'sinden yeniden hesaplarız.

export function _kdKatAraCtxFromWrapId(wrapId) {
  switch (wrapId) {
    case 'kd2-kat-bar':       return 'kd2-islem';
    case 'kd-extre-kat-bar':  return 'kd-extre';
    case 'kd2-extre-kat-bar': return 'kd2-extre';
    default:                  return 'kd-islem'; // 'kd-kat-bar'
  }
}

export function _kdKatAraAktifFiltre(ctx) {
  switch (ctx) {
    case 'kd2-islem': return _kd2IslemKatFiltre;
    case 'kd-extre':  return _kdExtreKatFiltre;
    case 'kd2-extre': return _kd2ExtreKatFiltre;
    default:          return _kdIslemKatFiltre; // 'kd-islem'
  }
}

// Bağlama göre filtreyi set edip ilgili (görünür) listeyi yeniden çizer — kdKatFiltreToggle
// ile aynı state/render eşlemesini kullanır, sadece toggle değil doğrudan set eder.

// [KALDIRILDI] _kdKatAraUygula(ctx, katId) — sadece silinen kdKatAraSec/
// kdKatAraTemizle tarafından çağrılıyordu (bkz. üstteki ölü kategori arama
// widget'ı temizliği); onlarla birlikte yetim kaldığı için o da kaldırıldı
// (ölü kod taraması, 2026-07).

// ── Belirli bir ekstre dönemine ait ekstrenin fiilen hangi para birim(ler)inde kesildiğini
// döndürür. kd2BorcOdeAc bu fonksiyon tanımlı değilken kartın varsayılan para birimine
// (getKartCurrency) düşüyordu; çoklu para birimli bir kartta işlemler kartın varsayılanından
// FARKLI (ama yine desteklenen) bir para biriminde kesiliyorsa bu, o dönemin borcunu hep 0
// gibi gösterip "Borç Öde" popup'ının boş/"Ödendi" görünmesine yol açıyordu.

