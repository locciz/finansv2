import { inject } from '@core/container.js';
// DUAL-MODE CONTAINER KAYDI: core.appCoreBase, core.format, core.state,
// domain.hesaplamalar zaten container'a taşınmış katmanlara ait. @pages/*
// importları o katman henüz taşınmadığı için BİLİNÇLİ OLARAK korunuyor.
const _appCoreBase = inject('core.appCoreBase');
const _format = inject('core.format');
const _coreState = inject('core.state');
const _hesaplamalar = inject('domain.hesaplamalar');
import { odBeklemedeMi, odIptalMi, odKiraMaasOverride } from '@pages/odeme/01-genel-yardimcilar.js';
import { getTatilSet } from '@pages/tanimlamalar/01-genel-yardimcilar.js';
import { openHesapModal } from '@pages/hesaplar/03-hesap-form-crud.js';
// ============================================================
// js/ui/components/mobile-nav-tema/03-bakiye-izleme-paneli.js
// Hesap bakiyesi izleme paneli (yaklaşan çıkış/gelir tespiti, uyarılar)
// Kod SATIR SATIR aynı kaldı; sadece dosya sınırı/gruplama değişti.
// ============================================================
export function hesapBakiyeDurumTespit(hesap) {
  const b = hesap.bakiye || 0;
  const min = hesap.minBakiye;
  const hedef = hesap.hedefBakiye;
  const kmhLimit = hesap.kmhLimit;

  // KMH: bakiye negatif bölgeye girmiş mi?
  if(kmhLimit && b < 0) {
    const kullanilanKmh = Math.abs(b);
    const kmhPct = Math.min(100, (kullanilanKmh / kmhLimit) * 100);
    if(kmhPct >= 90) return { seviye:'kritik', renk:'var(--danger)', ikon:'🚨', etiket:'KMH Kritik', pct: kmhPct, aciklama:`KMH %${kmhPct.toFixed(0)} kullanımda` };
    if(kmhPct >= 60) return { seviye:'dusuk', renk:'var(--warn)', ikon:'⚠️', etiket:'KMH Yüksek', pct: kmhPct, aciklama:`KMH %${kmhPct.toFixed(0)} kullanımda` };
    return { seviye:'normal', renk:'var(--warn)', ikon:'📊', etiket:'KMH Aktif', pct: kmhPct, aciklama:`KMH %${kmhPct.toFixed(0)} kullanımda` };
  }

  // Minimum bakiye eşiği varsa
  if(min !== undefined && min !== null && min !== '') {
    const minVal = parseFloat(min) || 0;
    if(b < 0)         return { seviye:'kritik', renk:'var(--danger)', ikon:'🚨', etiket:'Negatif Bakiye', aciklama:`Bakiye ${_format.fmtCur(b, hesap.paraBirimi||'TRY')}` };
    if(b < minVal * 0.5) return { seviye:'kritik', renk:'var(--danger)', ikon:'🚨', etiket:'Kritik Seviye', aciklama:`Min. eşiğin %50 altında` };
    if(b < minVal)       return { seviye:'dusuk',  renk:'var(--warn)',   ikon:'⚠️', etiket:'Düşük Bakiye',  aciklama:`Min. eşik: ${_format.fmtCur(minVal, hesap.paraBirimi||'TRY')}` };
    if(hedef !== undefined && hedef !== null && hedef !== '') {
      const hedefVal = parseFloat(hedef) || 0;
      if(b >= hedefVal) return { seviye:'fazla', renk:'var(--teal)', ikon:'✅', etiket:'Hedefte', aciklama:`Hedef: ${_format.fmtCur(hedefVal, hesap.paraBirimi||'TRY')}` };
    }
    return { seviye:'iyi', renk:'var(--teal)', ikon:'🟢', etiket:'Normal', aciklama:`Eşik üzerinde` };
  }

  // Sadece hedef varsa
  if(hedef !== undefined && hedef !== null && hedef !== '') {
    const hedefVal = parseFloat(hedef) || 0;
    if(b < 0)           return { seviye:'kritik', renk:'var(--danger)', ikon:'🚨', etiket:'Negatif Bakiye', aciklama:`Bakiye ${_format.fmtCur(b, hesap.paraBirimi||'TRY')}` };
    if(b >= hedefVal)   return { seviye:'fazla',  renk:'var(--teal)',   ikon:'✅', etiket:'Hedefte',        aciklama:`Hedef: ${_format.fmtCur(hedefVal, hesap.paraBirimi||'TRY')}` };
    const pct = hedefVal > 0 ? Math.round((b/hedefVal)*100) : 0;
    if(pct < 25)        return { seviye:'dusuk',  renk:'var(--warn)',   ikon:'⚠️', etiket:'Hedefe Uzak',    aciklama:`Hedefin %${pct}'inde` };
    return { seviye:'normal', renk:'var(--sky)', ikon:'📈', etiket:'Hedefe Yöneliyor', aciklama:`Hedefin %${pct}'inde` };
  }

  // Hiç eşik tanımlı değil — uyarı yapma
  return null;
}

/**
 * Yaklaşan N gün içindeki ödemeleri hesapla — hangi hesaptan ne kadar çıkacak?
 * Returns: [ { hesapId, toplamCikis, pb, islemler:[] } ]
 */

export function hesapYaklasanCikislar(gunSayisi) {
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = _format.localDateStr(today);
  const limitStr = _format.localDateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() + gunSayisi));
  const tatilSet = getTatilSet();
  const result = {}; // hesapId → { toplamCikis, pb, islemler }

  function ekle(hesapId, tutar, aciklama, tarih, pb) {
    if(!hesapId) return;
    if(!result[hesapId]) result[hesapId] = { hesapId, toplamCikis:0, pb: pb||'TRY', islemler:[] };
    result[hesapId].toplamCikis += Math.abs(tutar);
    result[hesapId].islemler.push({ aciklama, tarih, tutar: Math.abs(tutar) });
  }

  // Kira ödemeleri
  (_coreState.DB.kiralar||[]).forEach(k => {
    if(!k.hesapId) return;
    const pb = k.paraBirimi || _coreState.defaultCurrency;
    const yil = today.getFullYear();
    const aylar = (typeof kontratAylariHesapla === 'function') ? _hesaplamalar.kontratAylariHesapla(k, yil) : [];
    aylar.forEach(a => {
      if(a.tarih >= todayStr && a.tarih <= limitStr) {
        const ov = odKiraMaasOverride(k, a.ay);
        if(odBeklemedeMi(ov)) {
          if(k.tutar < 0) ekle(k.hesapId, k.tutar, '🏠 Kira: '+(k.aciklama||''), a.tarih, pb);
        }
      }
    });
    // Bir sonraki yılın ilk ayları
    const aylarSonraki = (typeof kontratAylariHesapla === 'function') ? _hesaplamalar.kontratAylariHesapla(k, yil+1) : [];
    aylarSonraki.forEach(a => {
      if(a.tarih >= todayStr && a.tarih <= limitStr) {
        const ov = odKiraMaasOverride(k, a.ay);
        if(odBeklemedeMi(ov)) {
          if(k.tutar < 0) ekle(k.hesapId, k.tutar, '🏠 Kira: '+(k.aciklama||''), a.tarih, pb);
        }
      }
    });
  });

  // Maaş (nakit çıkışı sayılmaz — gelir)
  // Elden gider ödemeleri
  (_coreState.DB.eldenler||[]).forEach(e => {
    if(!e.hesapId || e.tur !== 'gider') return;
    if(e.tarih >= todayStr && e.tarih <= limitStr) {
      if(odBeklemedeMi(e.odDurum)) {
        ekle(e.hesapId, Math.abs(e.tutar), '📉 Elden: '+(e.aciklama||''), e.tarih, e.paraBirimi||_coreState.defaultCurrency);
      }
    }
  });

  return Object.values(result);
}

/**
 * Yaklaşan N gün içindeki gelirler — hesap bazlı
 */

export function hesapYaklasanGelirler(gunSayisi) {
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = _format.localDateStr(today);
  const limitStr = _format.localDateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() + gunSayisi));
  const result = {};

  function ekle(hesapId, tutar, aciklama, tarih, pb) {
    if(!hesapId) return;
    if(!result[hesapId]) result[hesapId] = { hesapId, toplamGiris:0, pb: pb||'TRY', islemler:[] };
    result[hesapId].toplamGiris += Math.abs(tutar);
    result[hesapId].islemler.push({ aciklama, tarih, tutar: Math.abs(tutar) });
  }

  // Kira gelirleri
  (_coreState.DB.kiralar||[]).forEach(k => {
    if(!k.hesapId || k.tutar <= 0) return;
    const pb = k.paraBirimi || _coreState.defaultCurrency;
    const yil = today.getFullYear();
    [yil, yil+1].forEach(y => {
      const aylar = (typeof kontratAylariHesapla === 'function') ? _hesaplamalar.kontratAylariHesapla(k, y) : [];
      aylar.forEach(a => {
        if(a.tarih >= todayStr && a.tarih <= limitStr) {
          const ov = odKiraMaasOverride(k, a.ay);
          if(odBeklemedeMi(ov)) {
            ekle(k.hesapId, k.tutar, '🏠 Kira Geliri: '+(k.aciklama||''), a.tarih, pb);
          }
        }
      });
    });
  });

  // Maaş gelirleri
  (_coreState.DB.maaslar||[]).forEach(m => {
    if(!m.hesapId) return;
    const pb = m.paraBirimi || _coreState.defaultCurrency;
    const yil = today.getFullYear();
    for(let ay = 0; ay < 3; ay++) {
      const og = _hesaplamalar.getMaasOdemeGunu(m, today.getFullYear(), today.getMonth() + ay);
      const d = og.sonraki ? new Date(today.getFullYear(), today.getMonth() + ay + 1, og.gun) : new Date(today.getFullYear(), today.getMonth() + ay, og.gun);
      const tarih = _format.localDateStr(d);
      if(tarih >= todayStr && tarih <= limitStr) {
        if(tarih >= m.baslangic && (!m.bitis || tarih <= m.bitis)) {
          const ovKey = tarih.slice(0,7);
          if(odIptalMi(odKiraMaasOverride(m, ovKey))) continue;
          ekle(m.hesapId, m.tutar, '💼 Maaş: '+(m.aciklama||''), tarih, pb);
        }
      }
    }
  });

  return Object.values(result);
}

// Bakiye uyarıları — kalem bazlı "yoksay" (kalıcı: _coreState.DB.bakiyeUyariGizli üzerinden
// Drive'a senkron olur, sayfa yenilense/cihaz değişse de dismiss edilen uyarı geri gelmez).
export var _bakiyeUyariGizli = new Set();

export function _restoreBakiyeUyariGizliFromDB() {
  // Not: bilerek her çağrıda _coreState.DB.bakiyeUyariGizli'den TAZE okunuyor (önbelleklenmiyor).
  // Önceki sürümde "sadece ilk seferde oku" bayrağı vardı; sayfa açılışında Drive
  // verisi henüz gelmeden bir render tetiklenirse boş listeyle kilitleniyor ve Drive'dan
  // gerçek liste geldikten sonra bile bir daha hiç yeniden okunmuyordu — "yoksay"
  // dediğin uyarılar bu yüzden bir süre sonra tekrar görünüyordu.
  _bakiyeUyariGizli = new Set(Array.isArray(_coreState.DB.bakiyeUyariGizli) ? _coreState.DB.bakiyeUyariGizli : []);
}

export function _bakiyeUyariAnahtar(u) { return `${u.hesap.id}::${u.tip}`; }

export function bakiyeUyariGizle(anahtar) {
  _restoreBakiyeUyariGizliFromDB();
  _bakiyeUyariGizli.add(anahtar);
  _coreState.DB.bakiyeUyariGizli = Array.from(_bakiyeUyariGizli);
  _appCoreBase.saveData();
  renderBakiyeIzlemePanel();
  renderOzetBakiyeUyarilar();
}

export function bakiyeUyariTumunuGizle() {
  _restoreBakiyeUyariGizliFromDB();
  const { uyarilar } = otoBakiyeAnalizYap();
  uyarilar.forEach(u => _bakiyeUyariGizli.add(_bakiyeUyariAnahtar(u)));
  _coreState.DB.bakiyeUyariGizli = Array.from(_bakiyeUyariGizli);
  _appCoreBase.saveData();
  renderBakiyeIzlemePanel();
  renderOzetBakiyeUyarilar();
}

/**
 * Tüm hesaplar için otomatik bakiye analizi yap.
 * Returns: { uyarilar: [], analizler: [] }
 */

export function otoBakiyeAnalizYap() {
  const hesaplar = (_coreState.DB.hesaplar||[]).filter(h => h.durum === 'aktif');
  const uyarilar = [];
  const analizler = [];

  const cikislar30 = hesapYaklasanCikislar(30);
  const gelirler30 = hesapYaklasanGelirler(30);
  const cikislar7  = hesapYaklasanCikislar(7);

  hesaplar.forEach(h => {
    const durum = hesapBakiyeDurumTespit(h);
    const pb = h.paraBirimi || 'TRY';
    const bankaAd = (_coreState.DB.bankalar||[]).find(b=>b.id===h.banka)?.kisa || '';

    // 30 gün cıkış/giriş hesapla
    const cikis30 = cikislar30.find(c=>c.hesapId===h.id);
    const gelir30  = gelirler30.find(g=>g.hesapId===h.id);
    const cikis7   = cikislar7.find(c=>c.hesapId===h.id);

    const toplCikis30 = cikis30?.toplamCikis || 0;
    const toplGelir30 = gelir30?.toplamGiris  || 0;
    const toplCikis7  = cikis7?.toplamCikis   || 0;

    const tahminiiBakiye30 = h.bakiye - toplCikis30 + toplGelir30;
    const tahminiiBakiye7  = h.bakiye - toplCikis7;

    const analiz = {
      id: h.id,
      ad: h.ad,
      bankaAd,
      pb,
      mevcutBakiye: h.bakiye,
      minBakiye: h.minBakiye,
      hedefBakiye: h.hedefBakiye,
      durum,
      tahminiiBakiye30,
      tahminiiBakiye7,
      toplCikis30,
      toplGelir30,
      toplCikis7,
      cikisIslemleri: cikis30?.islemler || [],
      gelirIslemleri: gelir30?.islemler || [],
    };
    analizler.push(analiz);

    // Durum bazlı uyarılar
    if(durum) {
      if(durum.seviye === 'kritik' || durum.seviye === 'dusuk') {
        uyarilar.push({ tip: durum.seviye, hesap: h, analiz, mesaj: `${durum.ikon} ${h.ad}${bankaAd?' · '+bankaAd:''}: ${durum.etiket} — ${durum.aciklama}` });
      }
    }

    // Yaklaşan 7 gün içinde kritik noktaya düşecek mi?
    if(tahminiiBakiye7 !== h.bakiye && h.minBakiye !== undefined && h.minBakiye !== null) {
      const minVal = parseFloat(h.minBakiye)||0;
      if(tahminiiBakiye7 < minVal && h.bakiye >= minVal) {
        uyarilar.push({ tip: 'gelecek-kritik', hesap: h, analiz,
          mesaj: `📅 ${h.ad}: 7 gün içinde minimum bakiye eşiğinin altına düşecek (Tahmini: ${_format.fmtCur(tahminiiBakiye7, pb)})` });
      }
    }

    // 30 gün sonunda negatife mi düşecek?
    if(tahminiiBakiye30 < 0 && h.bakiye >= 0 && toplCikis30 > 0) {
      const kmhKapak = h.kmhLimit || 0;
      if(Math.abs(tahminiiBakiye30) > kmhKapak) {
        uyarilar.push({ tip: 'gelecek-negatif', hesap: h, analiz,
          mesaj: `📉 ${h.ad}: 30 gün içinde KMH limitini aşabilir (Tahmini: ${_format.fmtCur(tahminiiBakiye30, pb)})` });
      } else if(tahminiiBakiye30 < 0) {
        uyarilar.push({ tip: 'gelecek-dusuk', hesap: h, analiz,
          mesaj: `📊 ${h.ad}: 30 gün içinde bakiye negatife düşebilir (Tahmini: ${_format.fmtCur(tahminiiBakiye30, pb)})` });
      }
    }
  });

  _restoreBakiyeUyariGizliFromDB();
  const uyarilarGorunur = uyarilar.filter(u => !_bakiyeUyariGizli.has(_bakiyeUyariAnahtar(u)));
  return { uyarilar: uyarilarGorunur, analizler };
}

/**
 * Bakiye izleme panelini render et (hesaplar sayfası)
 */

export function renderBakiyeIzlemePanel() {
  const el = document.getElementById('bakiye-izleme-panel');
  if(!el) return;

  const { uyarilar, analizler } = otoBakiyeAnalizYap();
  const izlenenHesaplar = analizler.filter(a => a.minBakiye !== undefined || a.hedefBakiye !== undefined || a.durum);

  if(izlenenHesaplar.length === 0 && uyarilar.length === 0) {
    el.style.display = 'none';
    return;
  }

  el.style.display = 'block';

  // Renk/seviye kartları
  const seviyeRenk = { kritik:'rgba(251,113,133,.12)', dusuk:'rgba(251,146,60,.12)', normal:'rgba(56,189,248,.08)', iyi:'rgba(45,212,191,.08)', fazla:'rgba(45,212,191,.08)' };
  const seviyeBorder = { kritik:'rgba(251,113,133,.4)', dusuk:'rgba(251,146,60,.4)', normal:'rgba(56,189,248,.25)', iyi:'rgba(45,212,191,.3)', fazla:'rgba(45,212,191,.4)' };

  let uyariHtml = '';
  if(uyarilar.length) {
    uyariHtml = `<div class="card" style="border-color:rgba(251,113,133,.35);background:rgba(251,113,133,.04);margin-bottom:12px">
      <div class="card-header" style="margin-bottom:10px">
        <span class="card-title card-title-emoji" style="color:var(--danger)">🔔 Bakiye Uyarıları (${uyarilar.length})</span>
        <button class="btn btn-ghost btn-sm bakiye-uyari-tumunu-gizle-btn" style="font-size:10px;padding:3px 8px;min-height:auto">Tümünü Yoksay</button>
      </div>
      ${uyarilar.map(u => {
        const tipRenk = u.tip === 'kritik' ? 'var(--danger)' : u.tip === 'dusuk' ? 'var(--warn)' : 'var(--sky)';
        return `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.03);margin-bottom:6px;border:1px solid rgba(255,255,255,.05)">
          <div style="flex:1;font-size:12px;color:${tipRenk}">${u.mesaj}</div>
          <button class="btn btn-ghost btn-sm bakiye-uyari-duzenle-btn" data-hesapid="${u.hesap.id}" style="font-size:10px;padding:3px 8px;flex-shrink:0;min-height:auto">Düzenle</button>
          <button class="btn btn-ghost btn-sm bakiye-uyari-gizle-btn" data-anahtar="${_bakiyeUyariAnahtar(u)}" title="Bu uyarıyı yoksay" style="font-size:10px;padding:3px 8px;flex-shrink:0;min-height:auto">✕ Yoksay</button>
        </div>`;
      }).join('')}
    </div>`;
  }

  let kartlarHtml = '';
  const durumluHesaplar = analizler.filter(a => a.durum || a.minBakiye !== undefined || a.hedefBakiye !== undefined);
  if(durumluHesaplar.length) {
    kartlarHtml = `<div class="card">
      <div class="card-header" style="margin-bottom:14px">
        <span class="card-title card-title-emoji">📊 Bakiye Durum Analizi</span>
        <span style="font-size:10px;color:var(--text3)">30 günlük projeksiyon</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">
        ${durumluHesaplar.map(a => {
          const d = a.durum;
          const pb = a.pb;
          const _lt = document.documentElement.getAttribute('data-theme') === 'light';
          const _defBg = _lt ? 'rgba(0,0,0,.02)' : 'rgba(255,255,255,.03)';
          const bgCol = d ? (seviyeRenk[d.seviye]||_defBg) : _defBg;
          const bdCol = d ? (seviyeBorder[d.seviye]||'var(--border)') : 'var(--border)';

          // Progress bar (hedef varsa)
          let progressHtml = '';
          if(a.hedefBakiye !== undefined && a.hedefBakiye !== null) {
            const hedefVal = parseFloat(a.hedefBakiye)||0;
            if(hedefVal > 0) {
              const pct = Math.min(100, Math.max(0, (a.mevcutBakiye/hedefVal)*100));
              const barCol = pct >= 100 ? 'var(--teal)' : pct >= 50 ? 'var(--gold)' : 'var(--danger)';
              progressHtml = `<div style="margin-top:8px">
                <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);margin-bottom:3px">
                  <span>Hedefe ilerleme</span><span>%${pct.toFixed(0)}</span>
                </div>
                <div style="height:4px;background:var(--surface4);border-radius:2px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:${barCol};border-radius:2px;transition:width .3s"></div>
                </div>
              </div>`;
            }
          }

          // Min bakiye bar
          let minBarHtml = '';
          if(a.minBakiye !== undefined && a.minBakiye !== null) {
            const minVal = parseFloat(a.minBakiye)||0;
            if(minVal > 0 && a.mevcutBakiye >= 0) {
              const pct = Math.min(200, (a.mevcutBakiye/minVal)*100);
              const barCol = pct < 100 ? 'var(--danger)' : pct < 150 ? 'var(--warn)' : 'var(--teal)';
              minBarHtml = `<div style="margin-top:6px">
                <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);margin-bottom:3px">
                  <span>Min. eşik: ${_format.fmtCur(minVal,pb)}</span><span style="color:${barCol}">%${Math.min(200,pct).toFixed(0)}</span>
                </div>
                <div style="height:4px;background:var(--surface4);border-radius:2px;overflow:hidden">
                  <div style="height:100%;width:${Math.min(100,pct)}%;background:${barCol};border-radius:2px;transition:width .3s"></div>
                </div>
              </div>`;
            }
          }

          // Projeksiyon
          let projHtml = '';
          if(a.toplCikis30 > 0 || a.toplGelir30 > 0) {
            const proj30Col = a.tahminiiBakiye30 < 0 ? 'var(--danger)' : a.tahminiiBakiye30 < (parseFloat(a.minBakiye)||0) ? 'var(--warn)' : 'var(--teal)';
            projHtml = `<div style="display:flex;gap:8px;margin-top:8px;font-size:10.5px;flex-wrap:wrap">
              ${a.toplCikis30 > 0 ? `<span style="color:var(--danger)">▼ ${_format.fmtCur(a.toplCikis30,pb)} çıkış</span>` : ''}
              ${a.toplGelir30 > 0 ? `<span style="color:var(--teal)">▲ ${_format.fmtCur(a.toplGelir30,pb)} giriş</span>` : ''}
              <span style="color:${proj30Col};font-weight:600">→ ${_format.fmtCur(a.tahminiiBakiye30,pb)}</span>
            </div>`;
          }

          return `<div style="background:${bgCol};border:1px solid ${bdCol};border-radius:10px;padding:12px 14px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
              <div>
                <div style="font-size:12px;font-weight:700;color:var(--text)">${a.ad}${a.bankaAd?' <span style="color:var(--text3);font-weight:400">· '+a.bankaAd+'</span>':''}</div>
                ${d ? `<div style="font-size:10px;color:${d.renk};margin-top:2px">${d.ikon} ${d.etiket}</div>` : ''}
              </div>
              <div style="text-align:right">
                <div class="mono" style="font-size:13px;font-weight:700;color:${a.mevcutBakiye>=0?'var(--teal)':'var(--danger)'}">${_format.fmtCur(a.mevcutBakiye,pb)}</div>
                <div style="font-size:10px;color:var(--text3)">${pb}</div>
              </div>
            </div>
            ${minBarHtml}
            ${progressHtml}
            ${projHtml}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  el.innerHTML = uyariHtml + kartlarHtml;

  // [ES module] onclick="..." kaldırıldı - gerçek addEventListener bağlanıyor.
  el.querySelectorAll('.bakiye-uyari-tumunu-gizle-btn').forEach(btn => {
    btn.addEventListener('click', () => bakiyeUyariTumunuGizle());
  });
  el.querySelectorAll('.bakiye-uyari-duzenle-btn').forEach(btn => {
    btn.addEventListener('click', () => openHesapModal(btn.getAttribute('data-hesapid')));
  });
  el.querySelectorAll('.bakiye-uyari-gizle-btn').forEach(btn => {
    btn.addEventListener('click', () => bakiyeUyariGizle(btn.getAttribute('data-anahtar')));
  });
}

/**
 * Özet sayfasındaki bakiye uyarı kutusunu render et
 */

export function renderOzetBakiyeUyarilar() {
  const el = document.getElementById('ozet-bakiye-uyarilar');
  if(!el) return;

  const { uyarilar } = otoBakiyeAnalizYap();
  if(!uyarilar.length) {
    el.style.display = 'none';
    return;
  }

  el.style.display = 'block';
  const kritikler = uyarilar.filter(u => u.tip === 'kritik' || u.tip === 'gelecek-negatif');
  const dusukler  = uyarilar.filter(u => u.tip === 'dusuk'  || u.tip === 'gelecek-kritik' || u.tip === 'gelecek-dusuk');

  el.innerHTML = `<div class="card" style="border-color:${kritikler.length?'rgba(251,113,133,.4)':'rgba(251,146,60,.35)'};background:${kritikler.length?'rgba(251,113,133,.04)':'rgba(251,146,60,.04)'}">
    <div class="card-header">
      <span class="card-title-icon">${kritikler.length?'🚨':'⚠️'}</span><span class="card-title" style="color:${kritikler.length?'var(--danger)':'var(--warn)'}">Bakiye Uyarıları</span>
      <button class="btn btn-ghost btn-sm ozet-bakiye-hesaplara-git-btn" style="font-size:11px">Hesaplara Git →</button>
    </div>
    <div style="font-size:11px;color:var(--text3);margin:-10px 0 12px">${uyarilar.length} hesap dikkat gerektiriyor</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${uyarilar.slice(0,5).map(u => {
        const c = u.tip === 'kritik' || u.tip === 'gelecek-negatif' ? 'var(--danger)' : 'var(--warn)';
        return `<div style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:${c};padding:6px 10px;background:rgba(255,255,255,.03);border-radius:7px;border:1px solid rgba(255,255,255,.05)">
          <div style="flex:1">${u.mesaj}</div>
          <button class="btn btn-ghost btn-sm ozet-bakiye-uyari-gizle-btn" data-anahtar="${_bakiyeUyariAnahtar(u)}" title="Bu uyarıyı yoksay" style="font-size:10px;padding:2px 7px;flex-shrink:0;min-height:auto;color:var(--text3)">✕</button>
        </div>`;
      }).join('')}
      ${uyarilar.length > 5 ? `<div style="font-size:11px;color:var(--text3);text-align:center;padding:4px">+${uyarilar.length-5} daha...</div>` : ''}
    </div>
  </div>`;

  // [ES module] onclick="..." kaldırıldı - gerçek addEventListener bağlanıyor.
  // showPage: DUPE_NAMES listesinde (birden fazla dosyada tanımlı) -> window köprüsü kullan.
  el.querySelectorAll('.ozet-bakiye-hesaplara-git-btn').forEach(btn => {
    btn.addEventListener('click', () => _appCoreBase.showPage('hesaplar'));
  });
  el.querySelectorAll('.ozet-bakiye-uyari-gizle-btn').forEach(btn => {
    btn.addEventListener('click', () => bakiyeUyariGizle(btn.getAttribute('data-anahtar')));
  });
}

// ═══ PROVİZYON TARİHİ EKSİK İŞLEMLER (Dashboard) ═══════════════════
// Provizyon tarihi girilmemiş kredi kartı işlemlerini bulur, dashboard'da
// listeler ve tek tıkla (öngörülen tarihle) veya elle tarih girerek
// hızlıca doldurmayı sağlar.

export let _provizyonGizliIslemler = new Set(); // "Sonra" denilip gizlenen işlemler (bu oturum için)

// [KALDIRILDI] renderBakiyeIslemGecmisi(hesapId) — kira/maaş/elden ödeme
// geçmişini birleştirip döndüren yardımcı, hiçbir yerden çağrılmıyordu
// (ölü kod taraması, 2026-07).

/* rf-v86: global tablo etiketleyici observer kaldırıldı; prosedürel labelizer ekleniyor. */
/* ═══════════════════════════════════════════════════════════════════════════
   TAM ENTEGRASYON MODÜLü v36
   Tüm modüller tek bakiye motoruna bağlı. Ödeme → hesap anında güncellenir.
   ═══════════════════════════════════════════════════════════════════════════ */


// ============================================================
// [DI-MIGRATION] ui.components.bakiyeIzlemePaneli — container'a kayıt
// ============================================================
import { provide } from '@core/container.js';
provide('ui.components.bakiyeIzlemePaneli', {
  hesapBakiyeDurumTespit, hesapYaklasanCikislar, hesapYaklasanGelirler,
  get _bakiyeUyariGizli() { return _bakiyeUyariGizli; },
  _restoreBakiyeUyariGizliFromDB, _bakiyeUyariAnahtar, bakiyeUyariGizle,
  bakiyeUyariTumunuGizle, otoBakiyeAnalizYap, renderBakiyeIzlemePanel,
  renderOzetBakiyeUyarilar,
  get _provizyonGizliIslemler() { return _provizyonGizliIslemler; },
});
