import { fmtCur, fmtDate, localDateStr } from '../../../core/format.js';
import { _currentHashPage, _currentHashParams, _pushHashState } from '../../../core/init.js';
import { DB, defaultCurrency } from '../../../core/state.js';
import { calcExtreTarihiOdemeModuyla, calcOdemeTarihi, getExtreDonemi, getIslemTaksitliste } from '../../../domain/hesaplamalar.js';
import { cpsInit, cpsSync } from '../../components/cps-select.js';
import { _restoreKdIslemSiralamaFromDB } from '../../components/tablo-filtre-sirala.js';
import { kesinlesmeyiBekleyenDonemler, kesinlestirEkstre, kesinlestirTumBekleyenler, kesinlestirmeyiKaldir } from '../ekstreler/01-ekstre-kesinlestirme.js';
import { _ekstreBekleyenKartHtml } from '../ekstreler/02-ekstre-render.js';
import { bindIslemRowEvents, islemRowHtml } from '../islemler/03-islem-liste-render.js';
import { _kdAcikExtreDonem, _kdActiveTab, _kdIslemArama, _kdIslemKatFiltre, _kdKatBarCtx, set_kdAcikExtreDonem, set_kdActiveTab, set_kdIslemArama, set_kdKatBarCtx } from './00-state.js';
import { getKartCurrencies, getKartCurrency, getKartStatementAmount, kartOdemeTarihiEfektif } from './01-kart-data.js';
import { _kdKatBarAktifFiltre, kdRenderKatBar } from './02-kategori-arama-widget.js';
import { _kdCoreAramaSync, _kdCoreAramaTemizle, _kdCoreSiralamaPersist, _kdCoreSwitchTabToggle } from './03-kart-detay-ortak.js';
import { _kd2IslemSiralama, _kd2KartId, _kdIslemSiralama, _kdKartId, set_kd2IslemSiralama, set_kdIslemSiralama } from './09-kart-altyapi.js';
import { getTatilSet } from '../tanimlamalar/01-genel-yardimcilar.js';
import { openModal } from '../../components/modal-genel.js';
import { register } from '../../../core/wrap-registry.js';
// ============================================================
// js/ui/pages/kartlar/04-kart-detay-v1.js
// Kart Detay sayfası — v1 (modal görünüm)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/kartlar.js (145
// export, 3600+ satır) dosyasının, fonksiyon isim/işlev
// kümelerine göre bölünmüş bir parçasıdır. Kod SATIR SATIR
// AYNI kaldı — sadece dosya sınırı ve gruplama değişti.
// ============================================================
export function kdSwitchTab(tab) {
  set_kdActiveTab(tab);
  const activeEl = _kdCoreSwitchTabToggle('kd', tab);
  activeEl.style.animation = 'kdTabFadeIn .1s ease';
  if (tab === 'islem') kdRenderIslemler();
  else kdRenderExtreler();
  // Hash'e tab bilgisini yaz (restore için)
  if(_kdKartId) {
    const p = _currentHashParams();
    if(p.modal === 'modal-kart-detay') {
      p.modalTab = tab;
      _pushHashState(_currentHashPage(), p);
    }
  }
}

export function kdRenderIslemler() {
  if (!_kdKartId) return;
  _restoreKdIslemSiralamaFromDB();
  const list = document.getElementById('kd-islem-list');
  const statsWrap = document.getElementById('kd-mini-stats');
  const katBarWrap = document.getElementById('kd-kat-bar');
  if (!list) return;

  const tumIslemler = DB.islemler.filter(i => i.kart === _kdKartId);

  // Sekme badge sayısını güncelle
  const islemBadgeEl = document.getElementById('kd-tab-badge-islem');
  if (islemBadgeEl) islemBadgeEl.textContent = tumIslemler.length;

  // Üstteki mini istatistik şeridi ve kategori dağılım barı HER ZAMAN tüm kart işlemlerine göre
  // hesaplanır (arama/filtre uygulansa bile genel tabloyu göstermeye devam eder) — sadece kategori
  // barındaki tıklama bir filtre olarak listeye yansır.
  if (statsWrap) kdRenderMiniStats(statsWrap, tumIslemler);
  if (katBarWrap) {
    set_kdKatBarCtx('kd-islem');
    kdRenderKatBar(katBarWrap, tumIslemler);
  }

  // Arama kutusunun mevcut değeri ile senkron kal (DOM yeniden kurulmadıysa input'u ezme)
  const aramaInput = document.getElementById('kd-islem-arama');
  if (aramaInput && aramaInput.value !== _kdIslemArama) aramaInput.value = _kdIslemArama;
  const temizleBtn = document.getElementById('kd-islem-arama-temizle');
  if (temizleBtn) temizleBtn.style.display = _kdIslemArama ? 'flex' : 'none';
  const siraSelect = document.getElementById('kd-islem-sirala');
  if (siraSelect) {
    if (siraSelect.value !== _kdIslemSiralama) siraSelect.value = _kdIslemSiralama;
    if (!siraSelect._cpsOpts) cpsInit('kd-islem-sirala', { alignRight: true });
    else cpsSync('kd-islem-sirala');
  }

  if (!tumIslemler.length) {
    list.innerHTML = `<div class="islem-empty">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
      <div class="islem-empty-title">Bu kartta işlem yok</div>
      <div class="islem-empty-sub">Yeni işlem ekleyebilirsiniz</div>
    </div>`;
    return;
  }

  // ── Arama + kategori filtresi uygula ──
  const aramaQ = _kdIslemArama.trim().toLocaleLowerCase('tr-TR');
  let islemler = tumIslemler.filter(i => {
    if (_kdIslemKatFiltre && i.kategori !== _kdIslemKatFiltre) return false;
    if (!aramaQ) return true;
    const kat = (DB.kategoriler || []).find(x => x.id === i.kategori);
    const hay = `${i.aciklama || ''} ${kat ? kat.ad : ''}`.toLocaleLowerCase('tr-TR');
    return hay.includes(aramaQ);
  });

  if (!islemler.length) {
    list.innerHTML = `<div class="kd-islem-empty-filtered">Aramanızla eşleşen işlem bulunamadı</div>`;
    return;
  }

  // ── Sıralama uygula ──
  islemler = islemler.slice();
  switch (_kdIslemSiralama) {
    case 'tarih-eski': islemler.sort((a, b) => a.tarih.localeCompare(b.tarih)); break;
    case 'tutar-yuksek': islemler.sort((a, b) => (b.tutar || 0) - (a.tutar || 0)); break;
    case 'tutar-dusuk': islemler.sort((a, b) => (a.tutar || 0) - (b.tutar || 0)); break;
    default: islemler.sort((a, b) => b.tarih.localeCompare(a.tarih)); // tarih-yeni
  }

  // Aylık akordeon yok — basit, düz bir liste (her satır kendi tarih kartını taşıyor)
  list.innerHTML = islemler.map(i => islemRowHtml(i)).join('');
  // [ES module] islemRowHtml paylaşılan bir render yardımcısıdır - onun ürettiği
  // sınıflara bindIslemRowEvents ile (03-islem-liste-render.js'de tanımlı,
  // paylaşılan) gerçek addEventListener bağlanıyor.
  bindIslemRowEvents(list);
}

// [KALDIRILDI] kdToggleIslemAy(key) — "aya göre grupla, aç/kapa" toggle'ı
// hiçbir yerden çağrılmıyordu; render tarafı da _kdAcikIslemAy state'ini hiç
// okumadığı için özellik zaten baştan sona bağlanmamıştı (ölü kod taraması,
// 2026-07).

export function kdIslemAramaDegisti(val) {
  set_kdIslemArama(val || '');
  _kdCoreAramaSync('kd', _kdIslemArama, kdRenderIslemler);
}

export function kdIslemAramaTemizle() {
  set_kdIslemArama('');
  _kdCoreAramaTemizle('kd', kdRenderIslemler);
}

export function kdIslemSiralamaDegisti(val) {
  set_kdIslemSiralama(val || 'tarih-yeni');
  set_kd2IslemSiralama(_kdIslemSiralama);
  _kdCoreSiralamaPersist();
  kdRenderIslemler();
}

export function kdRenderExtreler() {
  if (!_kdKartId) return;
  const wrap = document.getElementById('kd-extre-list');
  if (!wrap) return;
  const kart = DB.kartlar.find(k => k.id === _kdKartId);
  if (!kart) { wrap.innerHTML = '<div class="info-box">Kart bulunamadı</div>'; return; }

  kdRenderExtreUyari(kart);

  const tumIslemler = DB.islemler.filter(i => i.kart === kart.id);
  const katBarWrap = document.getElementById('kd-extre-kat-bar');
  set_kdKatBarCtx((katBarWrap && katBarWrap.id === 'kd2-extre-kat-bar') ? 'kd2-extre' : 'kd-extre');
  if (katBarWrap) kdRenderKatBar(katBarWrap, tumIslemler);
  const aktifEkstreKat = _kdKatBarAktifFiltre();

  const tatilSet = getTatilSet();
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = localDateStr(today);
  const kartPbList = getKartCurrencies(kart.id);

  const periodMap = new Map();
  let minDate = new Date(today), maxDate = new Date(today);
  DB.islemler.filter(i => i.kart === kart.id).forEach(i => {
    const dt = new Date(i.tarih + 'T00:00:00');
    if (dt < minDate) minDate = dt;
    const lastTaksitDt = new Date(i.tarih + 'T00:00:00');
    lastTaksitDt.setMonth(lastTaksitDt.getMonth() + (i.taksit || 1) - 1);
    if (lastTaksitDt > maxDate) maxDate = lastTaksitDt;
  });
  const end6 = new Date(today); end6.setMonth(end6.getMonth() + 6);
  if (maxDate < end6) maxDate = end6;

  const startY = minDate.getFullYear(), startM = minDate.getMonth();
  const endY = maxDate.getFullYear(), endM = maxDate.getMonth();

  function ensurePeriod(y, m) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    if (periodMap.has(key)) return key;
    const extreDt = calcExtreTarihiOdemeModuyla(kart, y, m, tatilSet);
    if (!extreDt) return null;
    const odemeDt = calcOdemeTarihi(extreDt, kart.odemeSure, kart.odemeGunTip, tatilSet);
    const label = new Date(y, m, 1).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' });
    // Ertelenmiş dönemlerde son ödeme tarihi kullanıcının belirlediği yeni tarihe göre yansır.
    const odemeEfektif = kartOdemeTarihiEfektif(kart, key, localDateStr(odemeDt));
    periodMap.set(key, {
      key, label, extre: localDateStr(extreDt),
      odeme: odemeEfektif,
      odemeVarsayilan: localDateStr(odemeDt),
      ertelendi: odemeEfektif !== localDateStr(odemeDt),
      totalByPb: {}, items: []
    });
    return key;
  }
  for (let y = startY, m = startM; y < endY || (y === endY && m <= endM);) {
    ensurePeriod(y, m);
    m++; if (m > 11) { m = 0; y++; }
  }

  DB.islemler.filter(i => i.kart === kart.id).forEach(islem => {
    const islemPb = getKartCurrency(kart.id, islem.paraBirimi);
    getIslemTaksitliste(islem).forEach(tak => {
      const pd = getExtreDonemi(kart, tak.ekstreTarih);
      if (!pd) return;
      const key = ensurePeriod(pd.year, pd.month);
      if (!key) return;
      const p = periodMap.get(key);
      p.totalByPb[islemPb] = (p.totalByPb[islemPb] || 0) + getKartStatementAmount(kart.id, tak.tutar, islem.paraBirimi, tak.ekstreTarih || tak.tarih || islem.tarih);
      p.items.push({ islem, tak, pb: islemPb });
    });
  });

  const periods = Array.from(periodMap.values())
    .filter(p => Object.keys(p.totalByPb).length > 0)
    .sort((a, b) => b.key.localeCompare(a.key)); // en yeni dönem üstte

  if (!periods.length) {
    wrap.innerHTML = '<div class="islem-empty"><div class="islem-empty-title">Bu kart için henüz ekstre yok</div></div>';
    return;
  }

  set_kdAcikExtreDonem(null); // her render'da temiz başla — DOM yeniden kurulduğu için eski açık durum geçersiz

  // Sekme badge sayısını güncelle
  const badgeEl = document.getElementById('kd-tab-badge-extre');
  if (badgeEl) badgeEl.textContent = periods.length;

  wrap.innerHTML = periods.map(p => {
    const isPast = p.odeme < todayStr;
    const isThisMonth = p.key === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    let badge, badgeStyle, statusClass, progressColor, progressPct;
    if (isPast) {
      badge = '✓ Geçmiş'; badgeStyle = 'background:rgba(251,113,133,.18);color:#fb7185';
      statusClass = 'status-past'; progressColor = '#fb7185'; progressPct = 100;
    } else if (isThisMonth) {
      badge = '● Güncel'; badgeStyle = 'background:rgba(251,191,36,.18);color:#fbbf24';
      statusClass = 'status-current'; progressColor = '#fbbf24';
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      progressPct = Math.round((today.getDate() / daysInMonth) * 100);
    } else {
      badge = '◌ Gelecek'; badgeStyle = 'background:rgba(45,212,191,.12);color:#2dd4bf';
      statusClass = 'status-future'; progressColor = '#2dd4bf'; progressPct = 0;
    }

    const toplamHtml = kartPbList.map(pb => p.totalByPb[pb] ? fmtCur(p.totalByPb[pb], pb) : null)
      .filter(Boolean).join(' · ') || fmtCur(0, kartPbList[0] || defaultCurrency);

    // Kesinleşme durumu
    const kesinKayit = (DB.ekstreKayitlari || []).find(rk => rk.kartId === kart.id && rk.donemKey === p.key);
    const kesin = !!(kesinKayit && kesinKayit.kesinlestirildi);
    const kesinBadge = kesin
      ? `<span class="kd-extre-kesin-badge" title="${kesinKayit.kesinlesmeTarih ? 'Kesinleşme tarihi: ' + fmtDate(kesinKayit.kesinlesmeTarih) : ''}">🔒 Kesinleşti</span>`
      : '';
    const ertelendiBadge = p.ertelendi
      ? `<span class="od-badge od-ertelendi" title="Varsayılan son ödeme: ${fmtDate(p.odemeVarsayilan)} → Yeni: ${fmtDate(p.odeme)}">↷ Ertelendi</span>`
      : '';
    const extreDtMs = new Date(p.extre + 'T00:00:00');
    const ekstreSonrasi = new Date(extreDtMs); ekstreSonrasi.setDate(ekstreSonrasi.getDate() + 1);
    const kesinlestirBtn = (!kesin && today >= ekstreSonrasi)
      ? `<button class="btn btn-sm kd-extre-kesin-btn-confirm kd-extre-kesinlestir-btn" data-kart-id="${kart.id}" data-donem-key="${p.key}" style="font-size:11px;padding:5px 12px">✓ Kesinleştir</button>`
      : (!kesin ? `<span style="font-size:10px;color:var(--text3)" title="Ekstre kesim tarihinden bir gün sonra kesinleştirilebilir">Henüz kesinleştirilemez</span>` : '');
    const kesinKaldirBtn = kesin
      ? `<button class="btn btn-sm kd-extre-kesin-btn-undo kd-extre-kesin-kaldir-btn" data-kart-id="${kart.id}" data-donem-key="${p.key}" style="font-size:11px;padding:5px 12px" title="Kesinleştirmeyi kaldır — işlemler tekrar düzenlenebilir olur">↺ Geri Al</button>`
      : '';

    // Bu döneme dahil olan her işlem/taksit kaydını (en yeni üstte) detay listesi olarak hazırla
    const detayItemsAll = p.items.slice().sort((a, b) => b.tak.tarih.localeCompare(a.tak.tarih));
    const detayItems = aktifEkstreKat ? detayItemsAll.filter(({ islem }) => islem.kategori === aktifEkstreKat) : detayItemsAll;
    const detayHtml = detayItems.length ? detayItems.map(({ islem, tak }) => islemRowHtml(islem, tak)).join('')
      : `<div class="kd-extre-detail-empty">${aktifEkstreKat ? 'Seçili kategoriye ait işlem bulunamadı' : 'Bu döneme ait işlem bulunamadı'}</div>`;

    return `<div class="kd-extre-card ${statusClass}${kesin ? ' status-kesin' : ''}" id="kd-extre-card-${p.key}">
      <div class="kd-extre-progress"><div class="kd-extre-progress-fill" style="width:${progressPct}%;background:${progressColor}"></div></div>
      <div class="kd-extre-row kd-extre-row-toggle" data-donem-key="${p.key}">
        <div class="kd-extre-meta">
          <div class="kd-extre-period">${p.label} ${kesinBadge} ${ertelendiBadge}</div>
          <div class="kd-extre-dates">
            <span class="kd-extre-date-chip">✂ ${fmtDate(p.extre)}</span>
            <span style="color:var(--border2)">·</span>
            <span class="kd-extre-date-chip">💳 ${fmtDate(p.odeme)}</span>
            ${p.ertelendi ? `<span style="font-size:10px;color:var(--text3);text-decoration:line-through">${fmtDate(p.odemeVarsayilan)}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <div class="kd-extre-amt">
            <div class="kd-extre-amt-val">${toplamHtml}</div>
            <div class="kd-extre-badge" style="${badgeStyle}">${badge}</div>
          </div>
          <svg class="kd-extre-chevron" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4,6 8,10 12,6"/></svg>
        </div>
      </div>
      <div class="kd-extre-body" id="kd-extre-body-${p.key}">
        <div class="kd-extre-kesin-row kd-extre-stop-propagation ${kesin ? 'is-kesin' : 'is-acik'}">
          <div class="kd-extre-kesin-info">
            ${kesin
              ? `<span style="color:#10e0a8;font-weight:800">🔒 Bu ekstre kesinleştirildi${kesinKayit.kesinlesmeTarih ? ' — ' + fmtDate(kesinKayit.kesinlesmeTarih) : ''}</span><span style="color:var(--text2);font-size:10.5px">İşlemler düzenlenemez/silinemez</span>`
              : `<span style="color:#fbbf24;font-weight:800">🔓 Bu dönem henüz kesinleşmedi</span><span style="color:var(--text2);font-size:10.5px">İşlemler hâlâ düzenlenebilir</span>`}
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">${kesinlestirBtn}${kesinKaldirBtn}</div>
        </div>
        <div class="kd-extre-detail-list">${detayHtml}</div>
      </div>
    </div>`;
  }).join('');

  // [ES module] onclick="kesinlestirEkstre(...)", onclick="kesinlestirmeyiKaldir(...)",
  // onclick="kdToggleExtreDonem(...)", onclick="event.stopPropagation()" kaldırıldı -
  // gerçek addEventListener bağlanıyor. Ayrıca islemRowHtml() içindeki (paylaşılan
  // yardımcı) .islem-row-clickable / .islem-katline-clickable / .islem-actions-stop /
  // .islem-edit-btn / .islem-delete-btn class'larına da burada bağlanıyor.
  wrap.querySelectorAll('.kd-extre-kesinlestir-btn').forEach(btn => {
    btn.addEventListener('click', (event) => { event.stopPropagation(); kesinlestirEkstre(btn.getAttribute('data-kart-id'), btn.getAttribute('data-donem-key')); });
  });
  wrap.querySelectorAll('.kd-extre-kesin-kaldir-btn').forEach(btn => {
    btn.addEventListener('click', (event) => { event.stopPropagation(); kesinlestirmeyiKaldir(btn.getAttribute('data-kart-id'), btn.getAttribute('data-donem-key')); });
  });
  wrap.querySelectorAll('.kd-extre-row-toggle').forEach(row => {
    row.addEventListener('click', () => kdToggleExtreDonem(row.getAttribute('data-donem-key')));
  });
  wrap.querySelectorAll('.kd-extre-stop-propagation').forEach(el => {
    el.addEventListener('click', (event) => { event.stopPropagation(); });
  });
  bindIslemRowEvents(wrap);
}

export function kdToggleExtreDonem(key) {
  const card = document.getElementById('kd-extre-card-' + key);
  const body = document.getElementById('kd-extre-body-' + key);
  if (!card || !body) return;
  const willOpen = _kdAcikExtreDonem !== key;

  if (_kdAcikExtreDonem && _kdAcikExtreDonem !== key) {
    const prevCard = document.getElementById('kd-extre-card-' + _kdAcikExtreDonem);
    const prevBody = document.getElementById('kd-extre-body-' + _kdAcikExtreDonem);
    if (prevCard) prevCard.classList.remove('open');
    if (prevBody) prevBody.style.maxHeight = '0px';
  }

  if (willOpen) {
    card.classList.add('open');
    body.style.maxHeight = body.scrollHeight + 'px';
    set_kdAcikExtreDonem(key);
  } else {
    card.classList.remove('open');
    body.style.maxHeight = '0px';
    set_kdAcikExtreDonem(null);
  }
}

export function kdRenderMiniStats(wrap, islemler) {
  const count = islemler.length;
  if (!count) { wrap.innerHTML = ''; return; }

  // Para birimi başına toplam, gider, gelir
  const pb = getKartCurrency(_kdKartId);
  let harcama = 0, gelir = 0;
  islemler.forEach(i => {
    const v = i.tutar || 0;
    if (v < 0) gelir += Math.abs(v);
    else harcama += v;
  });
  const ort = (harcama + gelir) / count;

  wrap.innerHTML = `
    <div class="kd-mini-stats">
      <div class="kd-mini-stat accent">
        <div class="kd-mini-stat-label">İşlem</div>
        <div class="kd-mini-stat-val">${count} adet</div>
        <div class="kd-mini-stat-sub">Ort. ${fmtCur(ort, pb)}</div>
      </div>
      <div class="kd-mini-stat danger">
        <div class="kd-mini-stat-label">Harcama</div>
        <div class="kd-mini-stat-val">${fmtCur(harcama, pb)}</div>
        <div class="kd-mini-stat-sub">Gider işlemleri</div>
      </div>
      <div class="kd-mini-stat teal">
        <div class="kd-mini-stat-label">Gelir / İade</div>
        <div class="kd-mini-stat-val">${gelir > 0 ? fmtCur(gelir, pb) : '—'}</div>
        <div class="kd-mini-stat-sub">İade / Eksi işlemler</div>
      </div>
    </div>`;
}

export function kdYeniIslemAc() {
  const kartId = _kd2KartId || _kdKartId;
  if (!kartId) return;
  // Modal-kart-detay kapatılmıyor — işlem modalı üstüne stack olarak açılıyor
  // (editIslem'deki gibi). Böylece "Yeni İşlem" modalı kapatılınca kart detay
  // modalı hâlâ altta açık kalıp tekrar görünür; önceden burası kapatılıp
  // sonradan yeniden açılmadığı için kullanıcı kart detayına geri dönemiyordu.
  openModal('modal-islem', kartId);
}

export function kdRenderExtreUyari(kart) {
  const el = document.getElementById('kd-extre-uyari');
  if (!el) return;
  const bekleyenler = kesinlesmeyiBekleyenDonemler().filter(b => b.kart.id === kart.id);
  if (!bekleyenler.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'block';
  el.innerHTML = `<div class="card" style="border-color:rgba(251,191,36,.35);background:rgba(251,191,36,.04);padding:12px 16px">
    <div class="card-header ozet-ekstre-uyari-head" style="margin-bottom:10px">
      <span class="card-title-icon">📋</span>
      <span class="card-title ozet-ekstre-uyari-title" style="color:var(--gold);font-size:12.5px">Ekstre Kesinleştirme Bekliyor</span>
      <button class="btn btn-primary btn-sm ozet-ekstre-uyari-actions kd-extre-tumunu-kesinlestir-btn" data-kart-id="${kart.id}" style="font-size:11px;margin-left:auto">✓ Tümünü Kesinleştir</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:0">
      ${bekleyenler.map(({key, extreDt, odemeDt}) => _ekstreBekleyenKartHtml(kart, key, extreDt, odemeDt, {showKartAdi:false})).join('')}
    </div>
  </div>`;
  // [ES module] onclick="kesinlestirTumBekleyenler(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
  el.querySelectorAll('.kd-extre-tumunu-kesinlestir-btn').forEach(btn => {
    btn.addEventListener('click', () => kesinlestirTumBekleyenler(btn.getAttribute('data-kart-id')));
  });
  // _ekstreBekleyenKartHtml (paylaşılan yardımcı, ekstreler/02-ekstre-render.js) içindeki
  // "✓ Kesinleştir" butonu için de bağlama gerekiyor (fan-out: ozet.js'de de kullanılıyor).
  el.querySelectorAll('.eks-bekleyen-kesinlestir-btn').forEach(btn => {
    btn.addEventListener('click', () => kesinlestirEkstre(btn.getAttribute('data-kart-id'), btn.getAttribute('data-key')));
  });
}

// [ES module] taban render fonksiyonu(ları) odeme/patches zincirinin
// hook() ile sarmalayabilmesi için wrap-registry'ye kaydediliyor.
register('kdRenderIslemler', kdRenderIslemler);
register('kdRenderExtreler', kdRenderExtreler);
