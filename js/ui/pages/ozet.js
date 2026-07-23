import { saveData } from '../../core/app-core-base.js';
import { addDaysStr } from '../../core/date-utils.js';
import { fmt, fmtCur, fmtCurShort, fmtDate, localDateStr } from '../../core/format.js';
import { ALL_CURRENCIES, CURRENCY_CONFIG, DB, defaultCurrency } from '../../core/state.js';
import { paraBirimiCevirGuvenli, pbRenkAl } from '../../domain/doviz.js';
import { _krediTaksitKalan, calcExtreTarihiOdemeModuyla, calcOdemeTarihi, getBireyselKrediKalan, getBireyselKrediTaksitler, getExtreDonemi, getIslemTaksitliste, getKrediKalanBorc, getKrediTaksitler, getMaasOdemeGunu, getStopajOrani } from '../../domain/hesaplamalar.js';
import { renderTcmbGecmis } from '../../services/kur-servisleri.js';
import { renderOzetBakiyeUyarilar } from '../components/mobile-nav-tema/03-bakiye-izleme-paneli.js';
import { renderOzetProvizyonUyarilar } from '../components/mobile-nav-tema/04-provizyon-uyarilari.js';
import { mevduatAksiyonErteGiz, mevduatTumunuVadesizeAktar, mevduatYenile, mevduatYenileAnaPara } from './mevduat/03-mevduat-yenileme-ve-kapama.js';
import { call, register, has } from '../../core/wrap-registry.js';
import { setDateInputValue } from '../components/money-input.js';
import { normalizeAllDeposits } from './tbk-detay.js';
import { applyHesapAksiyonChips, kartAltyapiLogoHtml } from '../components/select-to-chips.js';
import { openTransferModal } from '../components/transfer-modal.js';
import { renderOzetGrafikler } from './abonelik.js';
import { kesinlesmeyiBekleyenDonemler, kesinlestirEkstre, kesinlestirTumBekleyenler } from './ekstreler/01-ekstre-kesinlestirme.js';
import { _ekstreBekleyenKartHtml } from './ekstreler/02-ekstre-render.js';
import { openNakitLogModal } from './hesaplar/06-hesap-log.js';
import { hesapOptionMetin, hesapOtomatikGunlukKontrol } from './hesaplar/01-genel-yardimcilar.js';
import { editIslemId } from './islemler/03-islem-liste-render.js';
import { getKartCurrency, getKartDefaultCurrency, getKartKullanim, getKartRenk, getKartStatementAmount, getKartStatementCurrency, getKartToplamLimit, kartDonemHesapla, kartOdemeTarihiEfektif } from './kartlar/01-kart-data.js';
import { openKartDetayModal } from './kartlar/03-kart-detay-ortak.js';
import { getOrtakGrupKullanim } from './kartlar/07-ortak-limit-grubu.js';
import { kiraPayInMonth } from './kira.js';
import { getKmhHesap } from './krediler/03-kmh-kredi.js';
import { gunlukVadeliyeKoy, vadeliyeKoy } from './mevduat/02-mevduat-vadeliye-koyma.js';
import { mevduatOtomatikVadeKontrol, mevduatYaklasanOdemedeGoster } from './mevduat/04-mevduat-otomasyon.js';
import { _mevGizliAksiyonlar } from './mevduat/06-mevduat-hesap-secim-formu.js';
import { odFiilenGerceklesenTutar, odGetDurum, odIptalMi, odKartDonemOverride, odKartToggleBtn, odKiraMaasOverride, odOdendiMi, odPlanlananTutar, odToggleBtn } from './odeme/01-genel-yardimcilar.js';
import { _odHesapVeYon } from './odeme/06-genel-odeme-modali.js';
import { bankaIkonObj, getBanka, getTatilSet } from './tanimlamalar/01-genel-yardimcilar.js';
// Bu dosya, orijinal 02-core-app-engine.js içinden çıkarılan
// fonksiyonları içerir. İçerik değiştirilmeden taşındı.

// [ES module] Eskiden window._tbkAylikVeriler / window._tbkAylikPb ile
// tutuluyordu (tbk-detay.js'deki tbkAyDetayAc popup'ı bunları okuyordu).
// Artık gerçek modül state'i + export edilen getter'lar üzerinden
// paylaşılıyor; tbk-detay.js bunları doğrudan import eder.
export var _tbkAylikVeriler = [];
export var _tbkAylikPb = null;

export function tahminProvizyonGunFarki(kartId) {
  if(!kartId) return null;
  const farklar = [];
  (DB.islemler||[]).filter(i=>i.kart===kartId && i.id!==editIslemId).forEach(i=>{
    const ilkTarih = (i.manuelTaksitler && i.manuelTaksitler[0] && i.manuelTaksitler[0].tarih) || i.tarih;
    const ilkProv = (i.manuelTaksitler && i.manuelTaksitler[0] && i.manuelTaksitler[0].provizyonTarihi) || i.provizyonTarihi;
    if(ilkTarih && ilkProv) {
      const farkMs = new Date(ilkProv+'T00:00:00') - new Date(ilkTarih+'T00:00:00');
      farklar.push(Math.round(farkMs / 86400000));
    }
  });
  if(!farklar.length) return null;
  // Ortalama gün farkı (en yakın tam sayıya yuvarla)
  const ortalama = farklar.reduce((s,f)=>s+f,0) / farklar.length;
  return Math.round(ortalama);
}

// Dashboard ekstre kesinleştirme uyarısı
export function renderOzetEkstreUyarilar() {
  const el = document.getElementById('ozet-ekstre-uyarilar');
  if(!el) return;
  const bekleyenler = kesinlesmeyiBekleyenDonemler();
  if(!bekleyenler.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'block';
  el.innerHTML = `<div class="card" style="border-color:rgba(251,191,36,.35);background:rgba(251,191,36,.04);padding:12px 16px">
    <div class="card-header ozet-ekstre-uyari-head" style="margin-bottom:8px">
      <span class="card-title-icon">📋</span>
      <span class="card-title ozet-ekstre-uyari-title" style="color:var(--gold)">Ekstre Kesinleştirme Bekliyor</span>
      <div class="ozet-ekstre-uyari-actions" style="display:flex;gap:6px;margin-left:auto">
        <button class="btn btn-primary btn-sm ozet-kesinlestir-tum-btn" style="font-size:11px">✓ Tümünü Kesinleştir (${bekleyenler.length})</button>
        <button class="btn btn-ghost btn-sm ozet-ekstrelere-git-btn" style="font-size:11px">Ekstrelere Git →</button>
      </div>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px">${bekleyenler.length} dönem ekstre kesim tarihini geçti ancak henüz kesinleştirilmedi.</div>
    <div style="display:flex;flex-direction:column;gap:0">
      ${bekleyenler.map(({kart, key, extreDt, odemeDt}) => _ekstreBekleyenKartHtml(kart, key, extreDt, odemeDt, {showKartAdi:true})).join('')}

    </div>
  </div>`;

  // [ES module] onclick="kesinlestirTumBekleyenler()", onclick="showPage('extreler')" kaldırıldı -
  // gerçek addEventListener bağlanıyor. _ekstreBekleyenKartHtml (paylaşılan yardımcı) içindeki
  // "✓ Kesinleştir" butonu için de bağlama gerekiyor (fan-out: 04-kart-detay-v1.js'de de var).
  el.querySelectorAll('.ozet-kesinlestir-tum-btn').forEach(btn => {
    btn.addEventListener('click', () => kesinlestirTumBekleyenler());
  });
  el.querySelectorAll('.ozet-ekstrelere-git-btn').forEach(btn => {
    btn.addEventListener('click', () => call('showPage', 'extreler'));
  });
  el.querySelectorAll('.eks-bekleyen-kesinlestir-btn').forEach(btn => {
    btn.addEventListener('click', () => kesinlestirEkstre(btn.getAttribute('data-kart-id'), btn.getAttribute('data-key')));
  });
}

// Hızlı aralık butonları: son N gün veya tümü (gun=null)
export function tgHizliAralik(gun) {
  const baslangicEl = document.getElementById('tg-baslangic');
  const bitisEl = document.getElementById('tg-bitis');
  const gecmis = DB.tcmbKurGecmis || [];
  if (!baslangicEl || !bitisEl) return;
  setDateInputValue(bitisEl, localDateStr(new Date()));
  if (gun === null) {
    setDateInputValue(baslangicEl, gecmis.length ? gecmis[0].tarih : '');
  } else {
    const d = new Date(); d.setDate(d.getDate() - gun);
    setDateInputValue(baslangicEl, localDateStr(d));
  }
  renderTcmbGecmis();
}

export function fillSnapshotGaps(todayStr, todayV, todayB) {
  if(!DB.snapshots) DB.snapshots = {};
  const keys = Object.keys(DB.snapshots).filter(k => k < todayStr).sort();
  if(!keys.length) return; // ilk kayıt — doldurulacak boşluk yok

  const lastKey = keys[keys.length - 1];
  const lastSnap = DB.snapshots[lastKey];

  // Aradaki gün sayısı (lastKey hariç, todayStr hariç)
  let gapDays = [];
  let cursor = addDaysStr(lastKey, 1);
  while(cursor < todayStr) {
    gapDays.push(cursor);
    cursor = addDaysStr(cursor, 1);
  }
  if(!gapDays.length) return; // ardışık gün — boşluk yok

  const n = gapDays.length + 1; // lastKey -> ... -> todayStr arasındaki adım sayısı
  const startV = lastSnap.v || 0, startB = lastSnap.b || 0;
  gapDays.forEach((dStr, idx) => {
    if(DB.snapshots[dStr]) return; // her ihtimale karşı, var olan kaydın üzerine yazma
    const t = (idx + 1) / n; // 0–1 arası interpolasyon oranı
    const v = startV + (todayV - startV) * t;
    const b = startB + (todayB - startB) * t;
    DB.snapshots[dStr] = { v: Math.round(v), b: Math.round(b), s: true };
  });
}

export function renderOzet() {
  // [BUG FIX] Eskiden tbk-detay.js'deki installRenderOzetMevduatHook()
  // window.renderOzet'i monkey-patch ederek bunu her renderOzet()
  // çağrısından önce tetikliyordu; ama renderOzet artık export function
  // olduğu ve hiç window'a atanmadığı için o hook hiç kurulmuyordu.
  // Artık normalizeAllDeposits doğrudan buradan (gerçek import ile)
  // çağrılıyor.
  try { if(typeof normalizeAllDeposits === 'function') normalizeAllDeposits(false); } catch(e) {}
  // Saat bileşeni sıfırlanmazsa "Yaklaşan Ödemeler" listesindeki gün farkı hesapları
  // (gunFarki, dt>=today gibi karşılaştırmalar) günün saatine göre kayıyordu —
  // örn. akşam saatlerinde yarının ödemesi "Bugün" görünüyor, bugünün ödemesi ise
  // listeden düşüyordu. Diğer tüm tarihler zaten T00:00:00 ile oluşturulduğu için
  // today da gün başına sabitleniyor.
  const today = new Date(); today.setHours(0,0,0,0);
  document.getElementById('ozet-date').textContent = today.toLocaleDateString('tr-TR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  const todayStr = localDateStr(today);
  const year = today.getFullYear();
  const month = today.getMonth();
  const tatilSet = getTatilSet();

  // ── BAKİYE UYARILARI ────────────────────────────────────────────
  if(typeof renderOzetBakiyeUyarilar === 'function') renderOzetBakiyeUyarilar();

  // ── EKSTRE KESİNLEŞTİRME UYARISI ─────────────────────────────────
  if(typeof renderOzetEkstreUyarilar === 'function') renderOzetEkstreUyarilar();

  // ── PROVİZYON TARİHİ EKSİK İŞLEM UYARISI ────────────────────────
  if(typeof renderOzetProvizyonUyarilar === 'function') renderOzetProvizyonUyarilar();

  // ── MEVDUAT OTOMATİK VADE KONTROLÜ ──────────────────────────────
  // Uygulama hangi gün açılırsa açılsın, son kontrolden bugüne kadar vadesi
  // dolmuş tüm vadeli hesaplar (strateji tanımlıysa) burada otomatik işlenir —
  // kullanıcı Mevduat sayfasına gitmeden, dashboard'u açar açmaz devreye girer.
  if(typeof mevduatOtomatikVadeKontrol === 'function') mevduatOtomatikVadeKontrol();
  // ── OTOMATİK GÜNLÜK VADELİ (vadesiz hesaplardan) ────────────────
  if(typeof hesapOtomatikGunlukKontrol === 'function') hesapOtomatikGunlukKontrol();

  // ── VADESİZ MEVDUAT KARTI ───────────────────────────────────────

  // ── MEVDUAT VADE AKSIYON KARTLARI ──────────────────────────────
  const mevAksiyonEl = document.getElementById('ozet-mev-aksiyonlar');
  if(mevAksiyonEl) {
    const vadeDolmus = DB.mevduatlar.filter(m => {
      if(!m.strateji) return false;
      if(m._kapatildi) return false; // otomatik/manuel olarak zaten işlenmiş — tekrar sorma
      if(typeof _mevGizliAksiyonlar !== 'undefined' && _mevGizliAksiyonlar.has(m.id)) return false;
      const bitisISO = m.bitis || '';
      return bitisISO && bitisISO <= todayStr;
    });
    if(vadeDolmus.length) {
      mevAksiyonEl.style.display = 'block';
      // Ortak kart şablonu — üç strateji de aynı, okunaklı, yüksek kontrastlı
      // görünümü kullanır (renkli ikon rozeti + solid arkaplan + belirgin metin
      // renkleri). Eski hâli çok düşük opasiteli (background .04) tonlar ve
      // var(--text3) kullandığı için açık temada neredeyse okunmuyordu.
      const _mevAksiyonKart = ({accent, accentRgb, icon, title, meta, strateji, body, actions}) => `
        <div class="card" style="border:1px solid rgba(${accentRgb},.35);border-left:4px solid ${accent};background:var(--surface2);margin-bottom:10px;padding:16px 18px">
          <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px">
            <div style="width:36px;height:36px;border-radius:10px;background:rgba(${accentRgb},.15);border:1px solid rgba(${accentRgb},.3);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0">${icon}</div>
            <div style="min-width:0;flex:1">
              <div style="font-size:14px;font-weight:700;color:var(--text)">${title}</div>
              <div style="font-size:11.5px;color:var(--text2);margin-top:2px">${meta}</div>
            </div>
          </div>
          <div style="font-size:12px;color:var(--text2);background:rgba(${accentRgb},.08);border:1px solid rgba(${accentRgb},.18);border-radius:8px;padding:9px 11px;margin-bottom:10px">
            <b style="color:var(--text)">Strateji:</b> ${strateji}
          </div>
          ${body||''}
          <div style="display:flex;gap:8px;flex-wrap:wrap">${actions}</div>
        </div>`;

      mevAksiyonEl.innerHTML = vadeDolmus.map(m => {
        const bankaAd = getBanka(m.banka) || '?';
        const cur = m.paraBirimi || 'TRY';
        const strateji = m.strateji;
        const vadesizHesaplar = (DB.hesaplar||[]).filter(h=>h.durum==='aktif'&&h.tur!=='vadeli');

        // Strateji 1: Otomatik yenile (ana para + faiz)
        if(strateji === 'yenile_tum') {
          return _mevAksiyonKart({
            accent: 'var(--gold)', accentRgb: 'var(--gold-rgb)', icon: '⏰',
            title: 'Mevduat Vadesi Doldu — Yenileme Gerekiyor',
            meta: `${bankaAd} · ${fmtCur(m.nihai,cur)} · Vade: ${fmtDate(m.bitis)}`,
            strateji: 'Ana Para + Faiz → Yeni Mevduat. Yeni vadeli hesabın IBAN ve vade bilgilerini girerek yeni mevduat oluşturun.',
            actions: `<button class="btn btn-primary btn-sm ozet-mev-yenile-btn" data-mev-id="${m.id}">🔄 Yeni Mevduat Oluştur</button>
              <button class="btn btn-ghost btn-sm ozet-mev-erte-giz-btn" data-mev-id="${m.id}">Sonra Hatırlat</button>`
          });

        // Strateji 2: Ana para yenile, faiz vadesiz'e
        } else if(strateji === 'yenile_ana_faiz_vadesiz') {
          const vadesizSel = vadesizHesaplar.length
            ? `<select id="mev-aksiyon-vadesiz-${m.id}" style="margin:0 0 10px;font-size:12px;background:var(--surface3);color:var(--text);border:1px solid var(--border2);border-radius:6px;padding:6px 8px;width:100%">
                <option value="" disabled hidden>— Faiz Aktarılacak Vadesiz Hesap —</option>
                ${vadesizHesaplar.map(h=>`<option value="${h.id}"${h.id===m.vadesizHesapId?' selected':''}>${hesapOptionMetin(h)}</option>`).join('')}
               </select>`
            : `<div style="color:var(--danger);font-size:11px;margin:0 0 10px">⚠ Vadesiz hesap bulunamadı. Önce hesap ekleyin.</div>`;
          return _mevAksiyonKart({
            accent: 'var(--teal)', accentRgb: 'var(--teal-rgb)', icon: '💸',
            title: 'Mevduat Vadesi Doldu — Ana Para Yenileme',
            meta: `${bankaAd} · Ana: ${fmtCur(m.tutar,cur)} · Faiz: ${fmtCur(m.faiz,cur)} · Vade: ${fmtDate(m.bitis)}`,
            strateji: `Ana Para → Yeni Mevduat · Net Faiz (${fmtCur(m.faiz,cur)}) → Vadesiz Hesap`,
            body: vadesizSel,
            actions: `<button class="btn btn-primary btn-sm ozet-mev-yenile-ana-para-btn" data-mev-id="${m.id}">🔄 Yeni Mevduat Oluştur</button>
              <button class="btn btn-ghost btn-sm ozet-mev-erte-giz-btn" data-mev-id="${m.id}">Sonra Hatırlat</button>`
          });

        // Strateji 3: Ana para + faiz vadesiz'e
        } else if(strateji === 'tumu_vadesiz') {
          const vadesizSel = vadesizHesaplar.length
            ? `<select id="mev-aksiyon-vadesiz-${m.id}" style="margin:0 0 10px;font-size:12px;background:var(--surface3);color:var(--text);border:1px solid var(--border2);border-radius:6px;padding:6px 8px;width:100%">
                <option value="" disabled hidden>— Ana Para + Faiz Aktarılacak Vadesiz Hesap —</option>
                ${vadesizHesaplar.map(h=>`<option value="${h.id}"${h.id===m.vadesizHesapId?' selected':''}>${hesapOptionMetin(h)}</option>`).join('')}
               </select>`
            : `<div style="color:var(--danger);font-size:11px;margin:0 0 10px">⚠ Vadesiz hesap bulunamadı. Önce hesap ekleyin.</div>`;
          return _mevAksiyonKart({
            accent: 'var(--violet)', accentRgb: 'var(--violet-rgb)', icon: '🏦',
            title: 'Mevduat Vadesi Doldu — Vadesiz Hesaba Aktar',
            meta: `${bankaAd} · Nihai: ${fmtCur(m.nihai,cur)} · Vade: ${fmtDate(m.bitis)}`,
            strateji: `Tüm tutar (${fmtCur(m.nihai,cur)}) seçilen vadesiz hesaba aktarılacak.`,
            body: vadesizSel,
            actions: `<button class="btn btn-primary btn-sm ozet-mev-tumunu-vadesize-btn" data-mev-id="${m.id}">🏦 Vadesiz Hesaba Aktar</button>
              <button class="btn btn-ghost btn-sm ozet-mev-erte-giz-btn" data-mev-id="${m.id}">Sonra Hatırlat</button>`
          });
        }
        return '';
      }).join('');
      // Dinamik id'li (mev-aksiyon-vadesiz-<id>) hesap select'lerini de
      // banka-tarzı popup chip'ine çeviriyoruz — statik config listesi bunları
      // yakalayamıyor çünkü id her mevduat kaydı için farklı.
      if (typeof applyHesapAksiyonChips === 'function') applyHesapAksiyonChips(mevAksiyonEl);
      // [ES module] onclick="mevduatYenile(...)", onclick="mevduatYenileAnaPara(...)",
      // onclick="mevduatTumunuVadesizeAktar(...)", onclick="mevduatAksiyonErteGiz(...)"
      // kaldırıldı - gerçek addEventListener bağlanıyor.
      mevAksiyonEl.querySelectorAll('.ozet-mev-yenile-btn').forEach(btn => {
        btn.addEventListener('click', () => mevduatYenile(btn.dataset.mevId));
      });
      mevAksiyonEl.querySelectorAll('.ozet-mev-yenile-ana-para-btn').forEach(btn => {
        btn.addEventListener('click', () => mevduatYenileAnaPara(btn.dataset.mevId));
      });
      mevAksiyonEl.querySelectorAll('.ozet-mev-tumunu-vadesize-btn').forEach(btn => {
        btn.addEventListener('click', () => mevduatTumunuVadesizeAktar(btn.dataset.mevId));
      });
      mevAksiyonEl.querySelectorAll('.ozet-mev-erte-giz-btn').forEach(btn => {
        btn.addEventListener('click', () => mevduatAksiyonErteGiz(btn.dataset.mevId));
      });
    } else {
      mevAksiyonEl.style.display = 'none';
      mevAksiyonEl.innerHTML = '';
    }
  }

  // Kart stats — ortak limit grubuna dahil kartlarda grup limiti kart sayısı kadar tekrar tekrar
  // sayılmasın diye her grup sadece bir kez (kendi limitiyle) toplama eklenir.
  // Kullanım, kartın kendi para birimi cinsinden hesaplanır (bkz. getKartKullanim) — TRY
  // toplamına geçerken her kartın varsayılan para birimi kuruna göre çevrilir (aşağıda).
  let toplamLimit=0, toplamKullanim=0;
  const _sayilanOrtakGruplar = new Set();
  const kartKullanimByPb = {}; // para birimi -> toplam kullanım (kendi cinsinden)
  DB.kartlar.forEach(k=>{
    if (k.ortakLimitGrupId) {
      if (!_sayilanOrtakGruplar.has(k.ortakLimitGrupId)) {
        _sayilanOrtakGruplar.add(k.ortakLimitGrupId);
        const grup = (DB.ortakLimitGruplari||[]).find(g=>g.id===k.ortakLimitGrupId);
        toplamLimit += grup ? (grup.limit||0) : (k.limit||0);
      }
    } else {
      toplamLimit += k.limit||0;
    }
    const kullanim = getKartKullanim(k.id);
    toplamKullanim += kullanim;
    const kartPb = getKartDefaultCurrency(k.id);
    kartKullanimByPb[kartPb] = (kartKullanimByPb[kartPb]||0) + kullanim;
  });

  // Mevduat
  let mevduatAktif=0;
  const mevduatByPb = {}; // para birimi -> toplam aktif mevduat (kendi cinsinden)
  DB.mevduatlar.filter(m=>m.bitis && m.bitis>=todayStr).forEach(m=>{
    mevduatAktif+=(m.nihai||0);
    const mevPb = m.paraBirimi || defaultCurrency || 'TRY';
    mevduatByPb[mevPb] = (mevduatByPb[mevPb]||0) + (m.nihai||0);
  });

  // Bu ay kira net — ödeme durumu ne olursa olsun bu ay planlanan kontrat tutarı.
  const ayKey = `${year}-${String(month+1).padStart(2,'0')}`;
  let kiraNET=0;
  DB.kiralar.forEach(k=>{
    const payDt = kiraPayInMonth ? kiraPayInMonth(k, year, month) : null;
    if(!payDt) return;
    const ov = odKiraMaasOverride(k, ayKey);
    const tutar = odPlanlananTutar(ov, Math.abs(k.tutar||0));
    kiraNET += (k.tutar||0) >= 0 ? tutar : -tutar;
  });

  // Bu ay maaş — bekliyor/ödenmiş fark etmeksizin bu ay planlanan gelir.
  let maasTop=0;
  DB.maaslar.forEach(m=>{
    const og = getMaasOdemeGunu(m, year, month);
    const payDt = og.sonraki ? new Date(year, month+1, og.gun) : new Date(year, month, og.gun);
    const payStr = localDateStr(payDt);
    if(!(payStr>=m.baslangic&&(!m.bitis||payStr<=m.bitis))) return;
    const ov = odKiraMaasOverride(m, ayKey);
    maasTop += odPlanlananTutar(ov, Math.abs(m.tutar||0));
  });

  // KMH Kredi kalan borç (krediler her zaman TRY bazlı tanımlanır — bkz. tahminGelecekBakiyeHesapla)
  const krediKalan = (DB.krediler||[]).reduce((s,kr)=>s+getKrediKalanBorc(kr), 0);
  // Bireysel kredi kalan borç
  const bireyselKrediKalan = (DB.bireyselKrediler||[]).reduce((s,kr)=>s+getBireyselKrediKalan(kr), 0);

  // Vadesiz Mevduat — vadeli olmayan, bakiyesi pozitif aktif hesaplar
  const vadesizHesaplar = (DB.hesaplar||[]).filter(h => h.durum==='aktif' && h.tur !== 'vadeli' && h.bakiye > 0);
  const vadesizToplam = vadesizHesaplar.reduce((s,h)=>s+(Number(h.bakiye)||0),0);
  const vadesizListHtml = vadesizHesaplar.length ? vadesizHesaplar.map((h,i)=>{
    const bankaObj = DB.bankalar.find(b=>b.id===h.banka) || null;
    const bankaAd = bankaObj ? bankaObj.kisa : '-';
    const bankaIkon = bankaIkonObj(bankaObj);
    const bankaLogoHtml = bankaIkon.svg
      ? `<span class="bank-logo">${bankaIkon.svg}</span>`
      : `<span class="bank-logo" style="color:${bankaIkon.renk}">${bankaIkon.emoji}</span>`;
    const lastStyle = i === vadesizHesaplar.length-1 ? 'border-bottom:none' : '';
    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 2px;border-bottom:1px solid var(--border);flex-wrap:wrap;${lastStyle}">
      <div style="min-width:0;flex:1 1 130px;display:flex;align-items:center;gap:7px">
        ${bankaLogoHtml}
        <div style="min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h.ad}</div>
          <div style="font-size:10.5px;color:var(--text3)">${bankaAd}</div>
        </div>
      </div>
      <div class="mono" style="font-size:12px;font-weight:700;color:var(--teal);white-space:nowrap;margin-right:2px">${fmtCur(h.bakiye, h.paraBirimi||'TRY')}</div>
      <div class="vds-act-row">
        <button class="vds-act-btn vadeli ozet-vadeliye-koy-btn" data-hesap-id="${h.id}" title="Bu hesaptan vadeli mevduat aç"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V5a4 4 0 0 1 8 0v2"/><rect x="3" y="7" width="10" height="7" rx="2"/><path d="M8 10v2"/></svg>Vadeli</button>
        ${h.otoGunlukVadeli ? '<span class="vds-act-badge" title="Bakiye her gün otomatik günlük vadeli mevduata aktarılır"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><path d="M8 2v2M8 12v2M2 8h2M12 8h2M3.8 3.8l1.4 1.4M10.8 10.8l1.4 1.4M12.2 3.8l-1.4 1.4M5.2 10.8l-1.4 1.4"/><circle cx="8" cy="8" r="2.3"/></svg> Günlük</span>' : `<button class="vds-act-btn gunluk ozet-gunluk-vadeliye-koy-btn" data-hesap-id="${h.id}" title="Bu hesaptan günlük vadeli mevduat aç"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8a5 5 0 1 1-1.45-3.55"/><path d="M13 3.5V7h-3.5"/><path d="M8 5.5V8l1.8 1.1"/></svg>Günlük</button>`}
        <button class="vds-act-btn transfer ozet-transfer-ac-btn" data-hesap-id="${h.id}" title="Bu hesaptan transfer yap"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5h10"/><path d="M9.5 2.5 12 5 9.5 7.5"/><path d="M14 11H4"/><path d="M6.5 8.5 4 11l2.5 2.5"/></svg>Transfer</button>
      </div>
    </div>`;
  }).join('') : '<div style="color:var(--text3);font-size:12px;padding:6px 0">Bakiyesi olan vadesiz hesap yok</div>';

  // Nakit bakiye — varsayılan para birimi öne çıkar, diğer tüm tanımlı para birimleri (0 olsa da) tek kart içinde kompakt liste halinde gösterilir
  const nakitMap = DB._nakitBakiye || {};
  const nbDefCur = defaultCurrency || 'TRY';
  let nbDigerKodlar = (typeof ALL_CURRENCIES !== 'undefined' && ALL_CURRENCIES.length)
    ? ALL_CURRENCIES.map(c=>c.code)
    : Object.keys(CURRENCY_CONFIG||{});
  Object.keys(nakitMap).forEach(pb=>{ if(!nbDigerKodlar.includes(pb)) nbDigerKodlar.push(pb); });
  nbDigerKodlar = nbDigerKodlar.filter(pb=>pb!==nbDefCur);
  // Bakiyesi olanlar üstte, sıfır olanlar altta
  nbDigerKodlar.sort((a,b)=>{
    const av=nakitMap[a]||0, bv=nakitMap[b]||0;
    if((av!==0)!==(bv!==0)) return av!==0 ? -1 : 1;
    return a.localeCompare(b);
  });
  const nbTutar = nakitMap[nbDefCur] || 0;
  const nbDefRenk = pbRenkAl(nbDefCur);
  const nbDefCfg = CURRENCY_CONFIG[nbDefCur] || {};
  const nbDigerHtml = nbDigerKodlar.map(pb=>{
    const val = nakitMap[pb]||0;
    const cfg = CURRENCY_CONFIG[pb] || {};
    const renk = pbRenkAl(pb);
    return `<span class="nb-chip ozet-nakit-log-chip" data-pb="${pb}" style="background:${renk.bg};border-color:${renk.border}" title="${cfg.ad||pb} logu">${cfg.flag?`<span class="nb-chip-flag">${cfg.flag}</span>`:''}<b style="color:${renk.text}">${pb}</b><span class="nb-chip-val${val>0?' pos':val<0?' neg':''}">${fmtCur(val,pb)}</span></span>`;
  }).join('');
  const nbLogIcon = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M2 8h8M2 12h5"/></svg>`;

  // ── NET VARLIK HESABI (hero şerit için) ──────────────────────────
  // NOT: 'vadeli' türü hesaplar, vadeli mevduat açılırken otomatik oluşturulan ve parayı tutan hesaplardır.
  // Bu paralar zaten aşağıda mevduatAktif (m.nihai) olarak sayılıyor — aksi halde aynı para iki kez sayılır
  // (mükerrer sayım net varlığın şişmesine sebep oluyordu).
  //
  // ÖNEMLİ: Hesaplar, mevduatlar, nakit ve kartlar farklı para birimlerinde olabilir.
  // Bunları doğrudan toplamak yanlış sonuç verir (örn. 100 USD + 100 EUR ≠ 200).
  // Bu yüzden her kalem önce kendi para birimi bazında toplanır, sonra TCMB günlük
  // kuruyla gösterim para birimine (defaultCurrency, genelde TRY) çevrilip toplanır.
  const gosterimPb = defaultCurrency || 'TRY';

  // Hesap bakiyelerini para birimi bazında topla
  const hesapByPb = {};
  (DB.hesaplar||[]).filter(h=>h.durum!=='kapali' && h.tur!=='vadeli').forEach(h=>{
    const pb = h.paraBirimi || gosterimPb;
    hesapByPb[pb] = (hesapByPb[pb]||0) + (Number(h.bakiye)||0);
  });

  // Tüm para birimi haritalarını (hesap, mevduat, nakit, kart kullanımı) gösterim
  // para birimine çevirip toplayan ortak yardımcı.
  function pbHaritasiniTopla(harita) {
    return Object.entries(harita).reduce((toplam, [pb, tutar]) => {
      const cevrilmis = paraBirimiCevirGuvenli(tutar, pb, gosterimPb);
      return toplam + (Number(cevrilmis) || 0);
    }, 0);
  }

  const toplamHesapBakiye = pbHaritasiniTopla(hesapByPb);
  const safeMevduatAktif = pbHaritasiniTopla(mevduatByPb);
  // Nakit: gösterim birimindeki tutar + diğer tüm para birimlerindeki nakit (çevrilerek) —
  // önceden sadece gösterim birimindeki nakit (nbTutar) sayılıyordu, diğerleri atlanıyordu.
  const safeNbTutar = pbHaritasiniTopla(nakitMap);
  const safeToplamKullanim = pbHaritasiniTopla(kartKullanimByPb);
  const safeKrediKalan = Number(krediKalan)||0; // krediler TRY bazlı — bkz. yukarıdaki not
  const safeBireyselKrediKalan = Number(bireyselKrediKalan)||0;
  const toplamVarlik = toplamHesapBakiye + safeMevduatAktif + (safeNbTutar>0?safeNbTutar:0);
  const toplamBorc = safeToplamKullanim + safeKrediKalan + safeBireyselKrediKalan + (safeNbTutar<0?-safeNbTutar:0);
  const netVarlik = toplamVarlik - toplamBorc;

  // ── GÜNLÜK SNAPSHOT: sadece bugün yazılır, gerçek (ziyaret edilmiş) geçmiş kayıtlar asla değişmez ─────
  if(!DB.snapshots) DB.snapshots = {};
  if(!DB.snapshots[todayStr]) {
    // Araya girilmemiş günler varsa (kullanıcı birkaç gün sisteme girmemiş olabilir):
    // bunları boş bırakmak yerine son gerçek kayıt ile bugünkü değer arasında
    // lineer interpolasyonla doldur ve "tahmini" (s:true) olarak işaretle.
    // Gerçek (s yok / s:false) kayıtlar asla üzerine yazılmaz.
    fillSnapshotGaps(todayStr, toplamVarlik, toplamBorc);
    DB.snapshots[todayStr] = { v: Math.round(toplamVarlik), b: Math.round(toplamBorc) };
    if(typeof saveData === 'function') setTimeout(saveData, 2000);
  }
  // NOT: Gerçek (sisteme girilmiş) geçmiş tarihli kayıtlara asla dokunulmaz —
  //      sonradan eklenen işlemler geçmiş snapshot'ları etkilemez.
  //      Sadece aradaki "girilmemiş" boşluklar tahmini olarak doldurulur.

  const heroEl = document.getElementById('ozet-hero');
  if(heroEl) {
    heroEl.innerHTML = `
      <div class="ozet-hero-main">
        <div class="ozet-hero-label">Net Varlık</div>
        <div class="ozet-hero-val ${netVarlik>=0?'pos':'neg'}">${fmt(netVarlik,true)}</div>
        <div class="ozet-hero-sub">Toplam varlık − toplam borç</div>
      </div>
      <div class="ozet-hero-split">
        <div class="ozet-hero-mini">
          <div class="ozet-hero-mini-dot pos"></div>
          <div>
            <div class="ozet-hero-mini-label">Varlıklar</div>
            <div class="ozet-hero-mini-val pos">${fmt(toplamVarlik)}</div>
          </div>
        </div>
        <div class="ozet-hero-mini">
          <div class="ozet-hero-mini-dot neg"></div>
          <div>
            <div class="ozet-hero-mini-label">Borçlar</div>
            <div class="ozet-hero-mini-val neg">${fmt(toplamBorc)}</div>
          </div>
        </div>
      </div>
      <div class="ozet-hero-bar">
        <div class="ozet-hero-bar-fill" style="width:${toplamVarlik+toplamBorc>0?Math.min(100,Math.round(toplamVarlik/(toplamVarlik+toplamBorc)*100)):50}%"></div>
      </div>`;
  }

  const vadesizHtml = `<div class="ozet-stat ozet-stat-wide os-green ozet-stat-list">
      <div class="ozet-stat-top">
        <div class="ozet-stat-icon"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
      </div>
      <div class="ozet-stat-label">Vadesiz Mevduat</div>
      <div class="ozet-stat-val">${fmt(vadesizToplam)}</div>
      <div class="ozet-stat-list-body" style="${vadesizHesaplar.length>3?'max-height:172px;overflow-y:auto;':''}margin-top:8px">${vadesizListHtml}</div>
    </div>`;

  const nakitHtml = `<div class="ozet-stat ozet-stat-wide os-${nbTutar>0?'green':nbTutar<0?'red':'blue'}">
      <div class="ozet-stat-top">
        <div class="ozet-stat-icon"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/><circle cx="12" cy="15" r="2"/></svg></div>
        <button class="nb-logbtn ozet-nakit-log-btn" data-pb="${nbDefCur}" title="Nakit İşlem Logu">${nbLogIcon}</button>
      </div>
      <div class="ozet-stat-label">Nakit Bakiye <span class="nb-def-badge" style="background:${nbDefRenk.bg};border-color:${nbDefRenk.border};color:${nbDefRenk.text}">${nbDefCfg.flag?nbDefCfg.flag+' ':''}${nbDefCur}</span></div>
      <div class="ozet-stat-val">${fmtCur(nbTutar, nbDefCur)}</div>
      ${nbDigerHtml ? `<div class="nb-chips">${nbDigerHtml}</div>` : `<div class="ozet-stat-sub">Elden / nakit işlemler</div>`}
    </div>`;

  const kartPct = toplamLimit>0 ? Math.round(toplamKullanim/toplamLimit*100) : 0;
  document.getElementById('ozet-stats').innerHTML=`
    <div class="ozet-stat os-warn">
      <div class="ozet-stat-top"><div class="ozet-stat-icon"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div><span class="ozet-stat-pct">${kartPct}%</span></div>
      <div class="ozet-stat-label">Kart Kullanımı</div>
      <div class="ozet-stat-val">${fmt(toplamKullanim)}</div>
      <div class="ozet-stat-mini-bar"><div class="ozet-stat-mini-fill" style="width:${Math.min(100,kartPct)}%"></div></div>
      <div class="ozet-stat-sub">/ ${fmt(toplamLimit)} limit</div>
    </div>
    <div class="ozet-stat os-blue">
      <div class="ozet-stat-top"><div class="ozet-stat-icon"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg></div></div>
      <div class="ozet-stat-label">Aktif Mevduat</div>
      <div class="ozet-stat-val">${fmt(mevduatAktif)}</div>
      <div class="ozet-stat-sub">${(DB.mevduatlar||[]).filter(m=>m.bitis&&m.bitis>=todayStr).length} aktif hesap</div>
    </div>
    <div class="ozet-stat os-red">
      <div class="ozet-stat-top"><div class="ozet-stat-icon"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div></div>
      <div class="ozet-stat-label">KMH Kredi Kalan</div>
      <div class="ozet-stat-val">${fmt(krediKalan)}</div>
      <div class="ozet-stat-sub">${(DB.krediler||[]).length} kredi</div>
    </div>
    <div class="ozet-stat os-red">
      <div class="ozet-stat-top"><div class="ozet-stat-icon"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div></div>
      <div class="ozet-stat-label">Bireysel Kredi Kalan</div>
      <div class="ozet-stat-val">${fmt(bireyselKrediKalan)}</div>
      <div class="ozet-stat-sub">${(DB.bireyselKrediler||[]).length} kredi</div>
    </div>
    <div class="ozet-stat ${kiraNET>=0?'os-green':'os-red'}">
      <div class="ozet-stat-top"><div class="ozet-stat-icon"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div></div>
      <div class="ozet-stat-label">Bu Ay Kira Net</div>
      <div class="ozet-stat-val">${fmt(kiraNET,true)}</div>
      <div class="ozet-stat-sub">${(DB.kiralar||[]).length} kontrat</div>
    </div>
    <div class="ozet-stat os-green">
      <div class="ozet-stat-top"><div class="ozet-stat-icon"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div></div>
      <div class="ozet-stat-label">Bu Ay Maaş</div>
      <div class="ozet-stat-val">${fmt(maasTop)}</div>
      <div class="ozet-stat-sub">${(DB.maaslar||[]).length} kaynak</div>
    </div>
    ${vadesizHtml}
    ${nakitHtml}`;

  // [ES module] onclick="vadeliyeKoy(...)", onclick="gunlukVadeliyeKoy(...)",
  // onclick="openTransferModal(...)", onclick="openNakitLogModal(...)" kaldırıldı -
  // gerçek addEventListener bağlanıyor.
  const ozetStatsEl = document.getElementById('ozet-stats');
  ozetStatsEl.querySelectorAll('.ozet-vadeliye-koy-btn').forEach(btn => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      vadeliyeKoy(btn.dataset.hesapId);
    });
  });
  ozetStatsEl.querySelectorAll('.ozet-gunluk-vadeliye-koy-btn').forEach(btn => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      gunlukVadeliyeKoy(btn.dataset.hesapId);
    });
  });
  ozetStatsEl.querySelectorAll('.ozet-transfer-ac-btn').forEach(btn => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      openTransferModal(btn.dataset.hesapId);
    });
  });
  ozetStatsEl.querySelectorAll('.ozet-nakit-log-chip').forEach(chip => {
    chip.addEventListener('click', (event) => {
      event.stopPropagation();
      openNakitLogModal(chip.dataset.pb);
    });
  });
  ozetStatsEl.querySelectorAll('.ozet-nakit-log-btn').forEach(btn => {
    btn.addEventListener('click', () => openNakitLogModal(btn.dataset.pb));
  });

  // Kart limit bars
  document.getElementById('ozet-kartlar').innerHTML = DB.kartlar.length ?
    DB.kartlar.map(k=>{
      const limit = getKartToplamLimit(k.id);
      const kull  = k.ortakLimitGrupId ? getOrtakGrupKullanim(k.ortakLimitGrupId) : getKartKullanim(k.id);
      const pct   = limit>0 ? Math.min(100,(kull/limit)*100) : 0;
      const pctRound = Math.round(pct);
      const seviye = pct>80?'danger':pct>50?'warn':'ok';
      const renkVar = {danger:'var(--danger)', warn:'var(--warn)', ok:'var(--accent2)'}[seviye];
      const kartRengi = (typeof getKartRenk === 'function') ? getKartRenk(k) : (k.renk || '#4f8ef7');
      const altyapiKL = (DB.kartAltyapilari||[]).find(a=>a.id===k.altyapiId);
      const netLogoKL = kartAltyapiLogoHtml(altyapiKL);
      const grupRozet = k.ortakLimitGrupId ? `<span class="kl-grup-badge" title="Ortak limit grubu">
        <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      </span>` : '';
      return `<div class="kl-row kl-${seviye} ozet-kart-detay-ac-row" style="cursor:pointer" data-kart-id="${k.id}" title="${k.ad} detayına git">
        <div class="kl-mini-card" style="--kl-accent:${kartRengi}">
          <span class="kl-mini-card-chip"></span>
          ${netLogoKL ? `<span class="kl-mini-card-net">${netLogoKL}</span>` : ''}
        </div>
        <div class="kl-main">
          <div class="kl-top">
            <span class="kl-name"><span class="kl-name-text">${k.ad}</span>${k.no ? `<span class="kl-name-no mono">•••• ${k.no}</span>` : ''}${grupRozet}</span>
            <span class="kl-pct kl-pct-${seviye}">%${pctRound}</span>
          </div>
          <div class="kl-bar"><div class="kl-bar-fill" style="width:${Math.max(pct,1.5)}%;background:${renkVar}"></div></div>
          <div class="kl-bottom">
            <span class="kl-used mono">${fmtCur(kull, k.paraBirimi)}</span>
            <span class="kl-sep">/</span>
            <span class="kl-limit mono">${fmtCur(limit, k.paraBirimi)}</span>
          </div>
        </div>
      </div>`;
    }).join('') : `<div class="kl-empty">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity=".5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
        <span>Kart tanımlı değil</span>
      </div>`;

  // [ES module] onclick="openKartDetayModal(...)" kaldırıldı - gerçek addEventListener bağlanıyor.
  document.getElementById('ozet-kartlar').querySelectorAll('.ozet-kart-detay-ac-row').forEach(row => {
    row.addEventListener('click', () => openKartDetayModal(row.dataset.kartId));
  });

  // Yaklaşan ödemeler (varsayılan 1 ay — ozetOdSetPeriod ile 3 ay/6 ay/1 yıl seçilebilir)
  const upcoming = [];
  const _ozetOdGun = (DB.uiFiltreler && DB.uiFiltreler.ozet && DB.uiFiltreler.ozet.odemelerGun) || 30;
  // Geçmiş kaç günün de listede gösterileceği (varsayılan 3 gün — ozetOdSetGecmis ile ayarlanabilir)
  const _ozetOdGecmisGun = (DB.uiFiltreler && DB.uiFiltreler.ozet && DB.uiFiltreler.ozet.odemelerGecmisGun !== undefined)
    ? DB.uiFiltreler.ozet.odemelerGecmisGun : 3;
  // "Bugüne Kaydır" özelliği açık mı — kayıtlı değer yoksa varsayılan açık (true).
  const _ozetOdBugunScrollAcik = !(DB.uiFiltreler && DB.uiFiltreler.ozet && DB.uiFiltreler.ozet.bugunScroll === false);
  const startBound = new Date(today); startBound.setDate(startBound.getDate() - _ozetOdGecmisGun);
  // Başlık ve aktif buton durumunu kalıcı seçime göre senkronize et (sayfa ilk
  // yüklendiğinde statik HTML varsayılanı "1 Ay" yerine gerçek kayıtlı seçim görünsün)
  {
    const _odTitles = {30:'Yaklaşan Ödemeler & Gelirler (1 Ay)', 90:'Yaklaşan Ödemeler & Gelirler (3 Ay)', 180:'Yaklaşan Ödemeler & Gelirler (6 Ay)', 365:'Yaklaşan Ödemeler & Gelirler (1 Yıl)'};
    const _odTitleEl = document.getElementById('ozet-odemeler-title');
    if(_odTitleEl) _odTitleEl.textContent = _odTitles[_ozetOdGun] || 'Yaklaşan Ödemeler & Gelirler';
    const _odGrup = document.getElementById('ozetod-period-group');
    if(_odGrup) _odGrup.querySelectorAll('.ozet-od-period-btn').forEach(b=>{
      b.classList.toggle('tbk-period-active', Number(b.dataset.gun)===_ozetOdGun);
    });
    const _odGecmisGrup = document.getElementById('ozetod-gecmis-group');
    if(_odGecmisGrup) _odGecmisGrup.querySelectorAll('.ozet-od-gecmis-btn').forEach(b=>{
      b.classList.toggle('tbk-period-active', Number(b.dataset.gun)===_ozetOdGecmisGun);
    });
    const _odBugunScrollToggle = document.getElementById('ozetod-bugun-scroll-toggle');
    if(_odBugunScrollToggle) _odBugunScrollToggle.checked = _ozetOdBugunScrollAcik;
  }
  const end30 = new Date(today); end30.setDate(end30.getDate()+_ozetOdGun);

  // Kart ödemeleri
  const _ozetOdOffsetMax = Math.max(2, Math.ceil(_ozetOdGun/28)+1); // seçilen periyoda göre kaç ay ileri taransın
  DB.kartlar.forEach(k=>{
    // offset -1: ekstre tarihi geçmiş (kesilmiş) ama son ödeme tarihi henüz gelmemiş
    // dönemleri de yakalamak için bir önceki aydan başla (ör. kesim günü 28, ödeme +10 gün
    // gibi durumlarda o dönem yalnızca "önceki ay" offsetinde bulunur ve eskiden atlanıyordu).
    for(let offset=-1; offset<=_ozetOdOffsetMax; offset++) {
      const d = new Date(year, month+offset, 1);
      const extre = calcExtreTarihiOdemeModuyla(k, d.getFullYear(), d.getMonth(), tatilSet);
      if(!extre) continue;
      const odemeVarsayilanDt = calcOdemeTarihi(extre, k.odemeSure, k.odemeGunTip, tatilSet);
      const donemKeyChk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const odemeEfektifStr = kartOdemeTarihiEfektif(k, donemKeyChk, localDateStr(odemeVarsayilanDt));
      const odeme = new Date(odemeEfektifStr+'T00:00:00');
      if(odeme>=startBound&&odeme<=end30) {
        const byPb = {};
        DB.islemler.filter(i=>i.kart===k.id).forEach(islem=>{
          const stmtPb = getKartStatementCurrency(k.id, islem.paraBirimi);
          getIslemTaksitliste(islem).forEach(tak=>{
            const pd=getExtreDonemi(k,tak.ekstreTarih);
            if(pd&&pd.year===d.getFullYear()&&pd.month===d.getMonth()) {
              byPb[stmtPb] = (byPb[stmtPb]||0) + getKartStatementAmount(k.id, tak.tutar, islem.paraBirimi, tak.ekstreTarih || tak.tarih || islem.tarih);
            }
          });
        });
        Object.entries(byPb).forEach(([kartPb, tot]) => {
          if(!(tot>0)) return;
          const donemKey = donemKeyChk;
          const odenenTop = (DB.kartOdemeleri||[]).filter(o=>o.kartId===k.id && o.paraBirimi===kartPb && o.donemKey===donemKey).reduce((s,o)=>s+o.tutar,0);
          const kalanBorc = Math.max(0, tot - odenenTop);
          const ovKart = odKartDonemOverride(k, donemKey);
          upcoming.push({tarih:odeme, aciklama:`${k.ad} Kart Ödemesi${kartPb?` (${kartPb})`:''}`, tur:'Kart', tutar:-tot, tip:'kart', id:k.id, donemKey, pb:kartPb, odendi: kalanBorc<=0.01, odenenTutar: odenenTop, kalanTutar: kalanBorc, durum: ovKart?.durum||null});
        });
      }
    }
  });

  // Mevduat bitiş
  DB.mevduatlar.forEach(m=>{
    if(typeof mevduatYaklasanOdemedeGoster === 'function' && !mevduatYaklasanOdemedeGoster(m, todayStr, today)) return;
    const dt = new Date(m.bitis+'T00:00:00');
    if(dt>=startBound&&dt<=end30) {
      const ovMev = m.odDurum || null;
      upcoming.push({tarih:dt, aciklama:`Mevduat Vadesi (${getBanka(m.banka)||'?'})`, tur:'Mevduat', tutar:m.nihai, tip:'mevduat', id:m.id, key:undefined, odendi: odOdendiMi(ovMev), durum: ovMev?.durum||null});
    }
  });

  // Kira
  DB.kiralar.forEach(k=>{
    for(let offset=(_ozetOdGecmisGun>0?-1:0);offset<=_ozetOdOffsetMax;offset++){
      const d = kiraPayInMonth(k, year, month+offset);
      if(!d) continue;
      const ds=localDateStr(d);
      const ovKey = ds.slice(0,7);
      const ovKira = odKiraMaasOverride(k, ovKey);
      if(d>=startBound&&d<=end30) upcoming.push({tarih:d, aciklama:k.aciklama||'Kira', tur:(k.tutar>=0?'Kira Geliri':'Kira Gideri'), tutar:k.tutar, tip:'kira', id:k.id, key:ovKey, odendi: odOdendiMi(ovKira), durum: ovKira?.durum||null});
    }
  });

  // Maaş
  DB.maaslar.forEach(m=>{
    for(let offset=(_ozetOdGecmisGun>0?-1:0);offset<=_ozetOdOffsetMax;offset++){
      const og=getMaasOdemeGunu(m, year, month+offset);
      const d=og.sonraki ? new Date(year,month+offset+1,og.gun) : new Date(year,month+offset,og.gun);
      const ds=localDateStr(d);
      if(!(ds>=m.baslangic&&(!m.bitis||ds<=m.bitis))) continue;
      const ovKey = ds.slice(0,7);
      const ovMaas = odKiraMaasOverride(m, ovKey);
      if(d>=startBound&&d<=end30) upcoming.push({tarih:d, aciklama:m.aciklama, tur:'Maaş', tutar:m.tutar, tip:'maas', id:m.id, key:ovKey, odendi: odOdendiMi(ovMaas), durum: ovMaas?.durum||null});
    }
  });

  // KMH Kredileri — yaklaşan taksitler
  (DB.krediler||[]).forEach(kr=>{
    const kmhKart = getKmhHesap(kr.kmhId);
    getKrediTaksitler(kr).forEach(t=>{
      const dt = new Date(t.tarih+'T00:00:00');
      if(dt>=startBound&&dt<=end30) {
        const kalan = _krediTaksitKalan(kr, t, todayStr);
        upcoming.push({tarih:dt, aciklama:`${kmhKart?kmhKart.ad:'KMH'} — ${t.no}/${kr.vade}. Taksit`, tur:'KMH Kredi', tutar:-t.tutar, tip:'kmh', id:kr.id, key:t.no, odendi: kalan<0.01, kalanTutar: kalan, durum: odGetDurum(kr, t.no)?.durum||null});
      }
    });
  });

  // Bireysel Krediler — yaklaşan taksitler
  (DB.bireyselKrediler||[]).forEach(kr=>{
    getBireyselKrediTaksitler(kr).forEach(t=>{
      const dt = new Date(t.tarih+'T00:00:00');
      if(dt>=startBound&&dt<=end30) {
        const kalan = _krediTaksitKalan(kr, t, todayStr);
        upcoming.push({tarih:dt, aciklama:`${kr.aciklama} (${getBanka(kr.banka)||'?'}) — ${t.no}/${kr.vade}. Taksit`, tur:'Kredi', tutar:-t.tutar, tip:'kredi', id:kr.id, key:t.no, odendi: kalan<0.01, kalanTutar: kalan, durum: odGetDurum(kr, t.no)?.durum||null});
      }
    });
  });

  // Abonelikler — yaklaşan 30 gün içindeki tüm tekrarlar (ödeme altyapısını kullanır)
  (DB.abonelikler||[]).forEach(ab=>{
    const baseTarih = ab.tarih ? new Date(ab.tarih+'T00:00:00') : today;
    const gun = baseTarih.getDate();
    const periyotAy = {haftalik:0, aylik:1, '3aylik':3, '6aylik':6, yillik:12}[ab.periyot];
    const abPushIfValid = (d) => {
      if(d<startBound||d>end30) return;
      const ayKey = localDateStr(d).slice(0,7);
      const ov = odKiraMaasOverride(ab, ayKey);
      upcoming.push({tarih:new Date(d), aciklama:(ab.ikon?ab.ikon+' ':'')+(ab.ad||'Abonelik'), tur:'Abonelik', tutar:ab.tutar, tip:'abonelik', id:ab.id, key:ayKey, odendi: odOdendiMi(ov), durum: ov?.durum||null});
    };
    if(ab.periyot === 'haftalik') {
      let d = new Date(baseTarih);
      while(d < startBound) d.setDate(d.getDate()+7);
      while(d<=end30) { abPushIfValid(new Date(d)); d.setDate(d.getDate()+7); }
    } else if(periyotAy) {
      let ay=0;
      while(ay<=26) { // güvenlik sınırı (~2 yıl)
        const y=baseTarih.getFullYear(), mo=baseTarih.getMonth()+ay;
        const sonGun=new Date(y,mo+1,0).getDate();
        const d=new Date(y,mo,Math.min(gun,sonGun));
        if(d>end30) break;
        abPushIfValid(d);
        ay+=periyotAy;
      }
    }
  });

  // Elden Ödemeler (gelir/gider) — ileri tarihli, henüz gerçekleşmemiş kayıtlar
  // (ödeme altyapısını kullanan tek seferlik kalemler)
  (DB.eldenler||[]).forEach(e=>{
    const dt = new Date(e.tarih+'T00:00:00');
    if(dt<startBound||dt>end30) return;
    const ov = e.odDurum || null;
    upcoming.push({tarih:dt, aciklama:'✋ '+(e.aciklama||(e.tur==='gelir'?'Elden Gelir':'Elden Gider')), tur: e.tur==='gelir'?'Elden Gelir':'Elden Gider', tutar:e.tutar, tip:'elden', id:e.id, key:undefined, odendi: odOdendiMi(ov), durum: ov?.durum||null});
  });

  upcoming.sort((a,b)=>{ const d=a.tarih-b.tarih; if(d) return d; const am=a.tip==='mevduat', bm=b.tip==='mevduat'; if(am!==bm) return am?-1:1; return 0; });

  // Her ödeme kaleminin bağlı olduğu hesabı — mümkün olduğunca ödeme durumu
  // sisteminin kendi hesap-çözümleme mantığıyla (_odHesapVeYon) tutarlı şekilde — bulur.
  function _ozetOdHesap(u) {
    // Sadece kart, kredi, KMH ve mevduat vadesi kayıtlarında banka rozeti gösterilir
    // (kira/maaş/abonelik/elden gibi diğer kalemlerde istenmiyor — bkz. kullanıcı talebi).
    if(!['kart','kredi','kmh','mevduat'].includes(u.tip)) return null;
    let hesapId = null;
    if(u.tip === 'kart') {
      const k = (DB.kartlar||[]).find(x=>x.id===u.id);
      if(k) {
        // Kartın bağlı hesabı iki şekilde tutulabilir: kart.hesapId (ileri bağlantı)
        // ya da hesaplar içinde h.kartId===kart.id (ters bağlantı) — entIslemHesabaYansit
        // fonksiyonundaki kanonik mantıkla aynı, aksi halde çoğu kartta logo çıkmıyordu.
        const hesap = (DB.hesaplar||[]).find(h => h.id === (k.hesapId||'') || h.kartId === k.id);
        hesapId = hesap ? hesap.id : null;
      }
    } else if(u.tip) {
      const item = call('odGetItem', u.tip, u.id);
      if(item) hesapId = _odHesapVeYon(u.tip, item, u.key).hesapId;
    }
    return hesapId ? (DB.hesaplar||[]).find(h=>h.id===hesapId) : null;
  }

  // Bağlı hesabın (ya da kart ise doğrudan kartın kendi bankasının) logo/emoji
  // rozeti (yoksa boş döner).
  // Not: Kart ödemelerinde eskiden _ozetOdHesap üzerinden "karta bağlı hesap" aranıyordu
  // (kart.hesapId ya da hesaplar içinde kartId eşleşmesi) — ama kartlar pratikte hangi
  // hesaptan ödeneceği kayıtlı bir "bağlı hesap"a sahip değil (bu seçim her ödemede
  // ayrı yapılıyor), bu yüzden neredeyse hiçbir kartta logo çıkmıyordu. Kartın kendisi
  // zaten bir bankaya ait (kart.banka), o yüzden kart için doğrudan bu alan kullanılıyor
  // — mevduat vadesi vb. diğer kalemlerde davranış değişmedi.
  function _ozetOdBankaLogoHtml(u) {
    let bankaId = null, ad = '';
    if(u.tip === 'kart') {
      const k = (DB.kartlar||[]).find(x=>x.id===u.id);
      if(!k) return '';
      bankaId = k.banka;
      ad = k.ad || '';
    } else if(u.tip === 'kredi') {
      // Bireysel krediler, kartlarla aynı şekilde, taksitlerin hangi hesaptan
      // ödeneceğine dair kayıtlı bir "bağlı hesap"a çoğunlukla sahip değil
      // (kr.hesapId boş/nakit olabilir) — ama kredinin kendisi zaten bir
      // bankaya ait (kr.banka, aciklamadaki "(Banka Adı)" ile aynı alan).
      // Önce onu kullan, sadece o da yoksa bağlı ödeme hesabına düş.
      const kr = (DB.bireyselKrediler||[]).find(x=>x.id===u.id);
      if(kr && kr.banka) {
        bankaId = kr.banka;
        ad = kr.aciklama || '';
      } else {
        const hesap = _ozetOdHesap(u);
        if(!hesap) return '';
        bankaId = hesap.banka;
        ad = hesap.ad || '';
      }
    } else {
      const hesap = _ozetOdHesap(u);
      if(!hesap) return '';
      bankaId = hesap.banka;
      ad = hesap.ad || '';
    }
    const bankaObj = (DB.bankalar||[]).find(b=>b.id===bankaId) || null;
    if(!bankaObj) return '';
    const ikon = bankaIkonObj(bankaObj);
    return ikon.svg
      ? `<span class="bank-logo" title="${ad}">${ikon.svg}</span>`
      : `<span class="bank-logo" style="color:${ikon.renk}" title="${ad}">${ikon.emoji}</span>`;
  }

  // Her ödeme için ilgili hesabın bakiyesini bul
  function getBakiyeYeterlilik(u) {
    let hesapId = null;
    if(u.tip === 'kira') {
      const k = (DB.kiralar||[]).find(x=>x.id===u.id);
      hesapId = k?.hesapId;
    } else if(u.tip === 'maas') {
      const m = (DB.maaslar||[]).find(x=>x.id===u.id);
      hesapId = m?.hesapId;
    } else if(u.tip === 'abonelik') {
      const ab = (DB.abonelikler||[]).find(x=>x.id===u.id);
      hesapId = ab?.hesapId;
    } else if(u.tip === 'elden') {
      const e = (DB.eldenler||[]).find(x=>x.id===u.id);
      hesapId = e?.yontem==='havale' ? e.hesapId : null;
    }
    if(!hesapId) return '';
    const h = (DB.hesaplar||[]).find(x=>x.id===hesapId);
    if(!h) return '';
    const gider = Math.abs(u.tutar);
    if(u.tutar >= 0) return ''; // gelir, kontrol gereksiz
    const kalan = h.bakiye - gider;
    if(kalan < 0) return `<span title="${h.ad}: ${fmtCur(h.bakiye,h.paraBirimi||'TRY')} bakiye, ${fmtCur(gider,h.paraBirimi||'TRY')} çıkış" style="color:var(--danger);font-size:11px;cursor:help">🚨 Yetersiz</span>`;
    const min = parseFloat(h.minBakiye)||0;
    if(min > 0 && kalan < min) return `<span title="${h.ad}: ödeme sonrası ${fmtCur(kalan,h.paraBirimi||'TRY')}" style="color:var(--warn);font-size:11px;cursor:help">⚠️ Eşik Altı</span>`;
    return `<span style="color:var(--teal);font-size:11px">✓</span>`;
  }

  document.getElementById('ozet-odemeler-list').innerHTML = upcoming.length ?
    (function(){ let _odAnchorKonuldu = false; return upcoming.map(u=>{
      const gunFarki = Math.round((u.tarih - today) / 86400000);
      const aciliyet = gunFarki<0 ? 'gecmis' : gunFarki<=1 ? 'acil' : gunFarki<=7 ? 'yakin' : 'normal';
      const gunEtiket = gunFarki<0 ? `${Math.abs(gunFarki)} gün önce` : gunFarki===0 ? 'Bugün' : gunFarki===1 ? 'Yarın' : `${gunFarki} gün sonra`;
      const turIconMap = {Kart:'💳', Mevduat:'🏦', 'Kira Geliri':'🏠', 'Kira Gideri':'🏠', Maaş:'💼', 'KMH Kredi':'📄', Kredi:'💰', Abonelik:'🔄', 'Elden Gelir':'✋', 'Elden Gider':'✋'};
      const turRenkMap = {Kart:'red', Mevduat:'gold', 'Kira Geliri':'green', 'Kira Gideri':'warn', Maaş:'teal', 'KMH Kredi':'purple', Kredi:'blue', Abonelik:'gray', 'Elden Gelir':'green', 'Elden Gider':'warn'};
      const tamOdendi = !!u.odendi;
      const kismiOdendi = !tamOdendi && u.tip==='kart' && u.odenenTutar > 0;
      const ertelendiMi = u.durum === 'ertelendi';
      // İlk "bugün veya sonrası" kaydı — kart açılınca liste geçmiş günlere değil
      // buradan başlayarak görünsün diye bir çapa (anchor) olarak işaretlenir.
      const ankorMu = !_odAnchorKonuldu && gunFarki>=0;
      if(ankorMu) _odAnchorKonuldu = true;
      // Durum artık diğer ödeme tipleriyle aynı şekilde tek bir yerde (aksiyon rozetinde) gösteriliyor,
      // burada ayrıca tekrar etmiyoruz — kısmi ödemede kalan tutar bilgisi rozetin title'ında.
      const aksiyon = u.tip==='kart'
        ? odKartToggleBtn(u.id, u.pb, u.donemKey, Math.abs(u.tutar), u.kalanTutar||0, localDateStr(u.tarih), tamOdendi ? 'odendi' : (ertelendiMi ? 'ertelendi' : (kismiOdendi ? 'kismi' : null)))
        : u.tip ? odToggleBtn(u.tip, u.id, u.key, localDateStr(u.tarih), Math.abs(u.tutar), u.aciklama) : '';
      // Banka logosu yoksa (kira/maaş/elden gibi banka bilgisi taşımayan kayıtlar),
      // sütunu boş bırakıp bir boşluk gibi göstermek yerine o sütunu tamamen kaldırıyoruz.
      const bankaHtml = _ozetOdBankaLogoHtml(u);
      const bankaColHtml = bankaHtml ? `<div class="ozet-od-banka-col">${bankaHtml}</div>` : '';
      const gridStyle = bankaHtml ? '' : ' style="--od-cols:44px 28px 1fr auto auto"';
      return `<div class="ozet-od-row ozet-od-${aciliyet}${tamOdendi?' ozet-od-odendi':''}"${ankorMu?' data-od-bugun-ankor="1"':''}${gridStyle}>
        <div class="ozet-od-date">
          <div class="ozet-od-day">${u.tarih.getDate()}</div>
          <div class="ozet-od-month">${u.tarih.toLocaleDateString('tr-TR',{month:'short'})}</div>
        </div>
        <div class="ozet-od-icon">${turIconMap[u.tur]||'📌'}</div>
        ${bankaColHtml}
        <div class="ozet-od-info">
          <div class="ozet-od-aciklama">${u.aciklama}</div>
          <div class="ozet-od-meta"><span class="ozet-od-banka-mobile">${bankaHtml}</span><span class="badge badge-${turRenkMap[u.tur]||'blue'}">${u.tur}</span><span class="ozet-od-gun ozet-od-gun-${aciliyet}">${gunEtiket}</span>${tamOdendi?'':getBakiyeYeterlilik(u)}</div>

        </div>
        <div class="ozet-od-tutar ${u.tutar>=0?'green':'red'}">${fmtCur(u.tutar, u.pb || defaultCurrency, true)}</div>
        <div class="ozet-od-aksiyon">${aksiyon}</div>
      </div>`;
    }); })().join('') :
    (function(){
      const _gelecekEtiket = {30:'önümüzdeki 1 ay',90:'önümüzdeki 3 ay',180:'önümüzdeki 6 ay',365:'önümüzdeki 1 yıl'}[_ozetOdGun] || `önümüzdeki ${_ozetOdGun} gün`;
      const _gecmisEtiket = {0:'', 3:'son 3 gün', 7:'son 1 hafta', 14:'son 2 hafta', 30:'son 1 ay'}[_ozetOdGecmisGun] || (_ozetOdGecmisGun>0 ? `son ${_ozetOdGecmisGun} gün` : '');
      const _aralikMetni = _gecmisEtiket ? `${_gecmisEtiket} ve ${_gelecekEtiket}` : _gelecekEtiket;
      return `<div class="ozet-od-empty">✓ ${_aralikMetni.charAt(0).toUpperCase()+_aralikMetni.slice(1)} için planlı ödeme yok</div>`;
    })();

  // Liste açılınca (ya da yeniden render olunca) geçmiş günler değil, "bugün"den
  // itibaren görünsün — yukarıda işaretlenen çapaya kaydır. Ancak kullanıcı "Geçmiş"
  // seçeneğini açıkça açtıysa (Yok dışında bir şey seçtiyse) bu otomatik kaydırma
  // geçmiş kayıtları her render'da tekrar gizleyip listeyi hep "bugün"den başlıyormuş
  // gibi gösteriyordu — bu durumda kaydırma yapılmaz, liste olduğu gibi (geçmişten
  // başlayarak) görünür.
  if(_ozetOdBugunScrollAcik) {
    // Not: offsetTop tek seferlik sabit bir piksel hesabı olduğu için render anında
    // konteyner boyutu henüz kesinleşmemişse (açılış animasyonu, kartların ilk mount'u,
    // banka logolarının satır yüksekliğini etkilemesi vb.) yanlış konuma kayabiliyordu.
    // Bunun yerine iki kademeli rAF + scrollIntoView kullanılıyor: scrollIntoView, DOM'un
    // o anki gerçek/güncel düzenine göre hesap yapar, yani sabit değil dinamiktir —
    // liste her yeniden render olduğunda güncel yüksekliklere göre doğru konuma kayar.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const _odListEl = document.getElementById('ozet-odemeler-list');
        const _odAnkorEl = _odListEl ? _odListEl.querySelector('[data-od-bugun-ankor="1"]') : null;
        // scrollIntoView yerine kartın kendi scrollTop'u manuel ayarlanıyor — scrollIntoView
        // sayfadaki tüm scrollable ata elemanlarını (örn. .main-wrap) da kaydırmaya çalışıyordu,
        // bu da render anında sayfanın o karta zıplamasına sebep oluyordu. Sadece bu kartın
        // içeriği kaymalı, sayfanın kendisi yerinde kalmalı.
        if(_odListEl && _odAnkorEl) {
          const _listRect = _odListEl.getBoundingClientRect();
          const _ankorRect = _odAnkorEl.getBoundingClientRect();
          _odListEl.scrollTop += (_ankorRect.top - _listRect.top);
        }
      });
    });
  }

  // Nakit akış özeti bu ay (sadece fiilen ödenmiş/kısmi ödenmiş kalemler gösterilir; iptal/bekliyor hariç)
  const cashItems = [];
  const cashAyKey = `${year}-${String(month+1).padStart(2,'0')}`;
  DB.kiralar.forEach(k=>{
    const pd = kiraPayInMonth(k, year, month);
    if(!pd) return;
    const ps=localDateStr(pd);
    if(!(ps>=k.baslangic&&ps<=k.bitis)) return;
    const ov = odKiraMaasOverride(k, cashAyKey);
    const fiilen = odFiilenGerceklesenTutar(ov, k.tutar);
    if(fiilen <= 0) return;
    cashItems.push({gun:pd.getDate(),aciklama:k.aciklama||'Kira',tutar: k.tutar>=0?fiilen:-fiilen});
  });
  DB.maaslar.forEach(m=>{
    const og=getMaasOdemeGunu(m, year, month);
    const pd=og.sonraki ? new Date(year,month+1,og.gun) : new Date(year,month,og.gun);
    const ps=localDateStr(pd);
    if(!(ps>=m.baslangic&&(!m.bitis||ps<=m.bitis))) return;
    const ov = odKiraMaasOverride(m, cashAyKey);
    const fiilen = odFiilenGerceklesenTutar(ov, m.tutar);
    if(fiilen <= 0) return;
    cashItems.push({gun:pd.getDate(),aciklama:m.aciklama,tutar:fiilen});
  });
  cashItems.sort((a,b)=>a.gun-b.gun);

  // ── NAKIT AKIŞ — Gelişmiş Görsel ─────────────────────────────────
  (function renderNakitAkisGorsel() {
    const el = document.getElementById('ozet-nakit');
    if(!el) return;

    if(!cashItems.length) {
      el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:36px 16px;color:var(--text3)">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".4"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        <div style="font-size:12.5px">Bu ay planlanmış nakit hareketi yok</div>
      </div>`;
      return;
    }

    const todayGun = today.getDate();
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const pb = defaultCurrency || 'TRY';

    // Günlük kümülatif akış hesapla (tüm ay)
    const gunlukMap = {};
    cashItems.forEach(c => {
      if(!gunlukMap[c.gun]) gunlukMap[c.gun] = { gelir: 0, gider: 0, items: [] };
      if(c.tutar >= 0) gunlukMap[c.gun].gelir += c.tutar;
      else gunlukMap[c.gun].gider += Math.abs(c.tutar);
      gunlukMap[c.gun].items.push(c);
    });

    const toplamGelir = cashItems.reduce((s,c) => s + (c.tutar > 0 ? c.tutar : 0), 0);
    const toplamGider = cashItems.reduce((s,c) => s + (c.tutar < 0 ? Math.abs(c.tutar) : 0), 0);
    const netAkis = toplamGelir - toplamGider;

    // SVG Bar Chart — ayın her günü için çubuk
    const W = 520, H = 90, padL = 8, padR = 8, padT = 12, padB = 22;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const barW = Math.max(3, Math.floor(plotW / daysInMonth) - 2);
    const barGap = plotW / daysInMonth;

    const maxVal = Math.max(...Object.values(gunlukMap).map(g => Math.max(g.gelir, g.gider)), 1);

    let bars = '';
    let dayLabels = '';
    const labelGun = daysInMonth <= 15 ? 1 : daysInMonth <= 20 ? 2 : 5;

    for(let d = 1; d <= daysInMonth; d++) {
      const cx = padL + (d - 0.5) * barGap;
      const g = gunlukMap[d];
      const isToday = d === todayGun;
      const isPast = d < todayGun;
      const isFuture = d > todayGun;

      if(isToday) {
        // Bugün: dikey referans çizgisi
        bars += `<line x1="${cx.toFixed(1)}" y1="${padT}" x2="${cx.toFixed(1)}" y2="${H-padB}" stroke="var(--gold)" stroke-width="1" stroke-dasharray="2,2" opacity="0.5"/>`;
      }

      if(g) {
        const gelirH = (g.gelir / maxVal) * plotH;
        const giderH = (g.gider / maxVal) * plotH;
        const bx = cx - barW / 2;

        if(g.gelir > 0) {
          const gy = H - padB - gelirH;
          const alpha = isFuture ? 0.45 : 0.9;
          bars += `<rect class="nka-bar" x="${bx.toFixed(1)}" y="${gy.toFixed(1)}" width="${barW}" height="${gelirH.toFixed(1)}" rx="2" fill="var(--teal)" opacity="${alpha}" data-gun="${d}" data-gelir="${g.gelir.toFixed(0)}" data-gider="${g.gider.toFixed(0)}" data-items="${encodeURIComponent(JSON.stringify(g.items))}"/>`;
        }
        if(g.gider > 0) {
          const gy = H - padB - giderH;
          const alpha = isFuture ? 0.45 : 0.9;
          bars += `<rect class="nka-bar" x="${bx.toFixed(1)}" y="${gy.toFixed(1)}" width="${barW}" height="${giderH.toFixed(1)}" rx="2" fill="var(--rose)" opacity="${alpha}" data-gun="${d}" data-gelir="${g.gelir.toFixed(0)}" data-gider="${g.gider.toFixed(0)}" data-items="${encodeURIComponent(JSON.stringify(g.items))}"/>`;
        }

        // Aktif gün için dot
        if(isToday) {
          const topY = g.gelir > 0 ? H - padB - (g.gelir/maxVal)*plotH : (g.gider > 0 ? H - padB - (g.gider/maxVal)*plotH : H - padB);
          bars += `<circle cx="${cx.toFixed(1)}" cy="${(topY - 5).toFixed(1)}" r="3" fill="var(--gold)" stroke="var(--bg)" stroke-width="1.5"/>`;
        }
      }

      if(d === 1 || d === todayGun || (d % labelGun === 0 && d !== 1)) {
        const labelColor = isToday ? 'var(--gold)' : 'var(--text3)';
        const labelText = isToday ? `${d}●` : `${d}`;
        dayLabels += `<text x="${cx.toFixed(1)}" y="${H - 4}" font-size="8" font-family="var(--mono)" fill="${labelColor}" text-anchor="middle" font-weight="${isToday?'700':'400'}">${labelText}</text>`;
      }
    }

    // Hover alanı (şeffaf üst rect)
    const hoverRect = `<rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH + padB}" fill="transparent" id="nka-hover-rect" style="cursor:crosshair"/>`;

    const svgHtml = `<svg id="nka-svg" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;overflow:visible" preserveAspectRatio="none">
      <line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" stroke="var(--border)" stroke-width="0.8"/>
      ${bars}
      ${dayLabels}
      ${hoverRect}
    </svg>
    <div id="nka-tooltip" style="position:absolute;pointer-events:none;z-index:5;background:rgba(8,10,16,.97);border:1px solid var(--border2);border-radius:9px;padding:9px 12px;min-width:160px;box-shadow:0 10px 30px rgba(0,0,0,.55);transition:opacity .1s;opacity:0;font-size:12px;left:0;top:0"></div>`;

    // Satır listesi (olay bazlı)
    const listHtml = cashItems.map(c => {
      const isPast = c.gun < todayGun;
      const isToday = c.gun === todayGun;
      const tarihLabel = isToday ? 'Bugün' : `${c.gun}. gün`;
      const icon = c.tutar >= 0 ? '💰' : '💸';
      const renkClass = c.tutar >= 0 ? 'nka-gelir' : 'nka-gider';
      return `<div class="nka-row${isToday?' nka-row-today':''}${isPast?' nka-row-past':''}">
        <div class="nka-row-icon">${icon}</div>
        <div class="nka-row-info">
          <div class="nka-row-aciklama">${c.aciklama}</div>
          <div class="nka-row-meta">${tarihLabel}</div>
        </div>
        <div class="nka-row-tutar ${renkClass}">${fmt(c.tutar, true)}</div>
      </div>`;
    }).join('');

    const netRenk = netAkis >= 0 ? 'var(--teal)' : 'var(--rose)';
    const netIcon = netAkis >= 0 ? '↑' : '↓';

    el.innerHTML = `
      <div class="nka-stats">
        <div class="nka-stat">
          <div class="nka-stat-label">Toplam Gelir</div>
          <div class="nka-stat-val nka-gelir">+${fmt(toplamGelir)}</div>
        </div>
        <div class="nka-stat-divider"></div>
        <div class="nka-stat">
          <div class="nka-stat-label">Toplam Gider</div>
          <div class="nka-stat-val nka-gider">-${fmt(toplamGider)}</div>
        </div>
        <div class="nka-stat-divider"></div>
        <div class="nka-stat">
          <div class="nka-stat-label">Net Akış</div>
          <div class="nka-stat-val" style="color:${netRenk}">${netIcon}${fmt(Math.abs(netAkis))}</div>
        </div>
      </div>
      <div class="nka-chart-wrap" style="position:relative">
        ${svgHtml}
      </div>
      <div class="nka-legend">
        <span class="nka-legend-item"><span class="nka-legend-dot" style="background:var(--teal)"></span>Gelir</span>
        <span class="nka-legend-item"><span class="nka-legend-dot" style="background:var(--rose)"></span>Gider</span>
        <span class="nka-legend-item"><span class="nka-legend-dot" style="background:var(--gold);border-radius:50%"></span>Bugün</span>
        <span class="nka-legend-item" style="margin-left:auto;color:var(--text3);font-size:10px">${daysInMonth} günlük ay · şeffaf = gelecek</span>
      </div>
      <div class="nka-list">${listHtml}</div>
    `;

    // Hover etkileşimi
    (function attachNkaHover() {
      const svg = document.getElementById('nka-svg');
      const hRect = document.getElementById('nka-hover-rect');
      const tooltip = document.getElementById('nka-tooltip');
      if(!svg || !hRect || !tooltip) return;

      hRect.addEventListener('mousemove', function(evt) {
        const rect = svg.getBoundingClientRect();
        const relX = evt.clientX - rect.left;
        const ratioX = relX / rect.width;
        const svgX = ratioX * W;
        const gun = Math.round((svgX - padL) / barGap + 0.5);
        const d = Math.max(1, Math.min(daysInMonth, gun));
        const g = gunlukMap[d];
        const cx = padL + (d - 0.5) * barGap;
        const px = (cx / W) * rect.width;

        if(!g) { tooltip.style.opacity = '0'; return; }

        const isToday = d === todayGun;
        const gunLabel = isToday ? `${d}. gün (Bugün)` : `${d}. gün`;
        const itemsHtml = g.items.map(i =>
          `<div style="display:flex;justify-content:space-between;gap:12px;margin-top:4px">
            <span style="color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px">${i.aciklama}</span>
            <span style="font-family:var(--mono);font-weight:700;color:${i.tutar>=0?'var(--teal)':'var(--rose)'}">${fmt(i.tutar,true)}</span>
          </div>`
        ).join('');

        tooltip.innerHTML = `<div style="font-size:10px;color:var(--text3);margin-bottom:5px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">${gunLabel}</div>
          ${g.gelir>0?`<div style="display:flex;justify-content:space-between;gap:12px"><span style="color:var(--text2)">Gelir</span><span style="font-family:var(--mono);color:var(--teal);font-weight:700">+${fmt(g.gelir)}</span></div>`:''}
          ${g.gider>0?`<div style="display:flex;justify-content:space-between;gap:12px"><span style="color:var(--text2)">Gider</span><span style="font-family:var(--mono);color:var(--rose);font-weight:700">-${fmt(g.gider)}</span></div>`:''}
          ${g.items.length > 1 ? `<div style="border-top:1px solid var(--border);margin-top:5px;padding-top:4px">${itemsHtml}</div>` : ''}`;

        let leftPx = px + 10;
        const ttW = 190;
        if(leftPx + ttW > rect.width) leftPx = px - ttW - 10;
        tooltip.style.left = Math.max(0, leftPx) + 'px';
        tooltip.style.top = '0px';
        tooltip.style.opacity = '1';
      });
      hRect.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });
    })();
  })();

  // ── GELECEK 1 YIL TAHMİNİ BAKİYE ────────────────────────────────
  if(typeof renderTahminBakiye === 'function') renderTahminBakiye();

  // (5. tur refactor / bugfix) 6 aylık gelir-gider çubuğu, donut ve borç
  // ring grafikleri — abonelik.js:renderOzetGrafikler(). Önceden bu, script
  // yükleme sırası yüzünden (abonelik.js, ozet.js'den ÖNCE yükleniyor ve
  // window.renderOzet'i hemen wrap etmeye çalışıyordu ama o an renderOzet
  // henüz tanımlı değildi) hiçbir zaman çalışmıyordu — grafikler render
  // edilmiyordu. Doğrudan çağrı olarak buraya taşındı.
  if(typeof renderOzetGrafikler === 'function') { try { renderOzetGrafikler(); } catch(e){ console.warn('Grafik hata:', e); } }
}

/**
 * Gelecek 365 gün için, her para birimi cinsinden, tüm aktif hesapların
 * toplam bakiyesinin nasıl değişeceğini tahmin eder.
 * Bilinen düzenli kaynaklar: maaşlar, kiralar (gelir/gider), abonelikler,
 * bireysel/KMH kredi taksitleri. Kredi kartı borçları ve tek seferlik
 * elden işlemler dahil edilmez (öngörülemez oldukları için).
 * Returns: { [paraBirimi]: { gunler: [{tarih, bakiye, olaylar:[{aciklama,tutar}]}], baslangic } }
 */
function tahminGelecekBakiyeHesapla(gunSayisi=365, gecmisGunSayisi=0) {
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = localDateStr(today);
  const bitisStr = localDateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate()+gunSayisi));
  // Geçmişe dönük gösterim penceresi — "Yaklaşan Ödemeler" kartındaki Geçmiş
  // buton grubuyla aynı mantık: seçili gün sayısı kadar geriye gidilir, o
  // tarihten önceki olaylar toplanmaz (performans + anlamsız veri önlemi).
  const gecmisBaslangicStr = localDateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate()-gecmisGunSayisi));

  // 1) Başlangıç: aktif hesapların para birimi bazlı toplam bakiyesi
  const baslangicByPb = {};
  (DB.hesaplar||[]).forEach(h=>{
    if(h.durum === 'kapali') return;
    const pb = h.paraBirimi || defaultCurrency || 'TRY';
    baslangicByPb[pb] = (baslangicByPb[pb]||0) + (Number(h.bakiye)||0);
  });

  // 2) Olayları topla: { tarih(str), tutar, pb, aciklama }
  const olaylar = []; // hepsi pb bazında ayrılacak
  // Vadesi gelip yenilenmeyen (zincirin koptuğu) mevduatların, serbest kaldığı
  // tarihten itibaren anaparasının "boşta bakiye" günlük değerlendirme
  // simülasyonuna katılması için: { tarih, tutar, pb } — bkz. aşağıdaki
  // mevduat döngüsü ve devamındaki simBakiye bloğu.
  const serbestKalanlar = [];

  // Maaşlar (gelir)
  (DB.maaslar||[]).forEach(m=>{
    const pb = m.paraBirimi || defaultCurrency || 'TRY';
    if(m.tur === 'tekseferlik') {
      if(m.baslangic >= gecmisBaslangicStr && m.baslangic <= bitisStr) {
        olaylar.push({tarih:m.baslangic, tutar:Math.abs(m.tutar), pb, aciklama:'💼 '+(m.aciklama||'Maaş')});
      }
      return;
    }
    // Sürekli: geçmiş penceresinden gunSayisi sonrasına kadar her ay tekrar eden ödeme günü
    const ayBas = -Math.ceil(gecmisGunSayisi/28)-1;
    for(let ay=ayBas; ay<=Math.ceil(gunSayisi/28)+1; ay++) {
      const y = today.getFullYear(), mo = today.getMonth()+ay;
      const og = getMaasOdemeGunu(m, new Date(y,mo,1).getFullYear(), new Date(y,mo,1).getMonth());
      const baseY = new Date(y,mo,1).getFullYear(), baseM = new Date(y,mo,1).getMonth();
      const d = og.sonraki ? new Date(baseY, baseM+1, og.gun) : new Date(baseY, baseM, og.gun);
      const tarih = localDateStr(d);
      if(tarih < gecmisBaslangicStr || tarih > bitisStr) continue;
      if(tarih < m.baslangic) continue;
      if(m.bitis && tarih > m.bitis) continue;
      const ovKey = tarih.slice(0,7);
      if(typeof odIptalMi === 'function' && odIptalMi(odKiraMaasOverride(m, ovKey))) continue;
      olaylar.push({tarih, tutar:Math.abs(m.tutar), pb, aciklama:'💼 '+(m.aciklama||'Maaş')});
    }
  });

  // Kiralar (gelir veya gider — tutar işaretine göre)
  (DB.kiralar||[]).forEach(k=>{
    const pb = k.paraBirimi || defaultCurrency || 'TRY';
    const gun = k.gun || 15;
    const ayBas = -Math.ceil(gecmisGunSayisi/28)-1;
    for(let ay=ayBas; ay<=Math.ceil(gunSayisi/28)+1; ay++) {
      const y = today.getFullYear(), mo = today.getMonth()+ay;
      const sonGun = new Date(y, mo+1, 0).getDate();
      let dGun = gun, dMo = mo, dY = y;
      if(gun > sonGun) {
        const davranis = k.kisaAyDavranis || 'son-gun';
        if(davranis === 'sonraki') { dMo = mo+1; dGun = 1; }
        else { dGun = sonGun; }
      }
      const d = new Date(dY, dMo, dGun);
      const tarih = localDateStr(d);
      if(tarih < gecmisBaslangicStr || tarih > bitisStr) continue;
      if(tarih < k.baslangic || (k.bitis && tarih > k.bitis)) continue;
      const ovKey = tarih.slice(0,7);
      const ov = typeof odKiraMaasOverride === 'function' ? odKiraMaasOverride(k, ovKey) : null;
      if(typeof odIptalMi === 'function' && odIptalMi(ov)) continue;
      const etiket = k.tutar >= 0 ? '🏠 Kira Geliri: ' : '🏠 Kira: ';
      olaylar.push({tarih, tutar:k.tutar, pb, aciklama: etiket+(k.aciklama||'')});
    }
  });

  // Abonelikler (gider, tutar zaten negatif)
  (DB.abonelikler||[]).forEach(ab=>{
    const pb = ab.paraBirimi || defaultCurrency || 'TRY';
    const baseTarih = ab.tarih ? new Date(ab.tarih+'T00:00:00') : today;
    const gun = baseTarih.getDate();
    const periyotAy = {haftalik:0, aylik:1, '3aylik':3, '6aylik':6, yillik:12}[ab.periyot];
    if(ab.periyot === 'haftalik') {
      // İlk tarihten başlayıp 7 günde bir tekrar; geçmiş penceresi seçiliyse
      // gecmisBaslangicStr'e kadar geriye, aksi halde eskisi gibi bugüne kadar ilerlet.
      let d = new Date(baseTarih);
      while(localDateStr(d) < gecmisBaslangicStr) d.setDate(d.getDate()+7);
      while(localDateStr(d) <= bitisStr) {
        const tarih = localDateStr(d);
        if(tarih >= gecmisBaslangicStr) olaylar.push({tarih, tutar:ab.tutar, pb, aciklama:'↻ '+(ab.ikon||'')+' '+(ab.ad||'Abonelik')});
        d.setDate(d.getDate()+7);
      }
    } else if(periyotAy) {
      let ay = -Math.ceil(gecmisGunSayisi/28)-2;
      // Abonelik başlangıcından önceki turları atlamak için negatif ay'ları başlangıca hizala
      while(ay <= Math.ceil(gunSayisi/28)+2) {
        const y = baseTarih.getFullYear(), mo = baseTarih.getMonth()+ay;
        const sonGun = new Date(y, mo+1, 0).getDate();
        const d = new Date(y, mo, Math.min(gun, sonGun));
        const tarih = localDateStr(d);
        if(tarih > bitisStr) break;
        if(tarih >= gecmisBaslangicStr) olaylar.push({tarih, tutar:ab.tutar, pb, aciklama:'↻ '+(ab.ikon||'')+' '+(ab.ad||'Abonelik')});
        ay += periyotAy;
      }
    }
  });

  // Bireysel krediler (gider — taksit planından)
  (DB.bireyselKrediler||[]).forEach(kr=>{
    if(typeof getBireyselKrediTaksitler !== 'function') return;
    const pb = 'TRY'; // krediler TL bazlı tanımlanıyor
    getBireyselKrediTaksitler(kr).forEach(t=>{
      if(t.tarih >= gecmisBaslangicStr && t.tarih <= bitisStr) {
        olaylar.push({tarih:t.tarih, tutar:-Math.abs(t.tutar), pb, aciklama:'💰 Kredi Taksiti'+(kr.aciklama?': '+kr.aciklama:'')});
      }
    });
  });

  // KMH taksitli krediler
  (DB.krediler||[]).forEach(kr=>{
    if(typeof getBireyselKrediTaksitler !== 'function') return;
    const fakeKr = Object.assign({}, kr, {ilkTaksit: kr.ilkEkstre});
    try {
      getBireyselKrediTaksitler(fakeKr).forEach(t=>{
        if(t.tarih >= gecmisBaslangicStr && t.tarih <= bitisStr) {
          olaylar.push({tarih:t.tarih, tutar:-Math.abs(t.tutar), pb:'TRY', aciklama:'📄 KMH Kredi Taksiti'});
        }
      });
    } catch(e) {}
  });

  // Kredi kartı ekstreleri — her kart için dönem borcu, son ödeme tarihinde tek kalem olarak düşer
  if(typeof getExtreDonemi === 'function' && typeof calcExtreTarihiOdemeModuyla === 'function') {
    const tatilSet = typeof getTatilSet === 'function' ? getTatilSet() : new Set();
    (DB.kartlar||[]).forEach(kart=>{
      // Bu karta ait işlemlerden dönem haritası kur (rendExtreler'deki mantıkla aynı)
      const periodMap = new Map();
      function ensurePeriod(y, m) {
        const key = `${y}-${String(m+1).padStart(2,'0')}`;
        if(periodMap.has(key)) return key;
        const d = kartDonemHesapla(kart, y, m, tatilSet, key);
        if(!d) return null;
        periodMap.set(key, { key, odeme: d.odeme, odemeVarsayilan: d.odemeVarsayilan, year:y, month:m, totalByPb:{} });
        return key;
      }
      const kartIslemleri = (DB.islemler||[]).filter(i=>i.kart===kart.id);
      if(!kartIslemleri.length) return;
      let minDate = new Date(today), maxDate = new Date(today);
      const gecmisSinirDt = new Date(gecmisBaslangicStr+'T00:00:00');
      if(gecmisSinirDt < minDate) minDate = gecmisSinirDt;
      kartIslemleri.forEach(i=>{
        const dt = new Date(i.tarih+'T00:00:00');
        if(dt < minDate) minDate = dt;
        const lastTaksitDt = new Date(i.tarih+'T00:00:00');
        lastTaksitDt.setMonth(lastTaksitDt.getMonth() + (i.taksit||1) - 1);
        if(lastTaksitDt > maxDate) maxDate = lastTaksitDt;
      });
      const endLimit = new Date(today); endLimit.setDate(endLimit.getDate()+gunSayisi+45);
      if(maxDate > endLimit) maxDate = endLimit;
      const startY = minDate.getFullYear(), startM = minDate.getMonth();
      const endY = maxDate.getFullYear(), endM = maxDate.getMonth();
      for(let y=startY, m=startM; y<endY||(y===endY&&m<=endM); ) { ensurePeriod(y,m); m++; if(m>11){m=0;y++;} }

      kartIslemleri.forEach(islem=>{
        const islemPb = getKartCurrency(kart.id, islem.paraBirimi);
        getIslemTaksitliste(islem).forEach(tak=>{
          const pd = getExtreDonemi(kart, tak.ekstreTarih);
          if(!pd) return;
          const key = ensurePeriod(pd.year, pd.month);
          if(!key) return;
          const p = periodMap.get(key);
          p.totalByPb[islemPb] = (p.totalByPb[islemPb]||0) + getKartStatementAmount(kart.id, tak.tutar, islem.paraBirimi, tak.ekstreTarih || tak.tarih || islem.tarih);
        });
      });

      // Her dönem+pb için: ödeme tarihi seçili gösterim aralığındaysa (geçmiş
      // penceresi dahil), kalan borcu (ödemeler düşülmüş) o günde gider olarak ekle
      periodMap.forEach(p=>{
        if(!p.odeme || p.odeme < gecmisBaslangicStr || p.odeme > bitisStr) return;
        Object.keys(p.totalByPb).forEach(pb=>{
          const odenenTop = (DB.kartOdemeleri||[])
            .filter(o=>o.kartId===kart.id && o.paraBirimi===pb && o.donemKey===p.key)
            .reduce((s,o)=>s+o.tutar,0);
          const kalan = (p.totalByPb[pb]||0) - odenenTop;
          if(kalan > 0.01) {
            olaylar.push({tarih:p.odeme, tutar:-kalan, pb, aciklama:'💳 '+(kart.ad||'Kart')+' Ekstre Ödemesi'});
          }
        });
      });
    });
  }

  // Mevduatlar (vadeli hesaplar) — vade sonunda tahakkuk eden net faiz gelir
  // olayı olarak eklenir. Vadesi projeksiyon penceresi (ör. 2 yıl) içinde kalan
  // mevduatlar, "yenile_ana_faiz_vadesiz" / "yenile_tum" stratejisi seçiliyse
  // ya da hiç strateji belirtilmemişse — aynı tutar/vade/oranla tekrar vadeye
  // yatırıldığı varsayılarak zincirleme (vade sonu → yeni vade → ...) hesaplanır.
  // Gelecekteki gerçek faiz oranı bilinemeyeceğinden en iyi tahmin, mevcut
  // orandaki bir mevduatın aynı oranla yenilenmeye devam ettiği varsayımıdır.
  // "tumu_vadesiz" stratejisi seçiliyse kullanıcı vade sonunda parayı tamamen
  // çekmeyi/vadesize aktarmayı planladığını belirtmiş demektir — zincir ilk
  // vade sonunda durur, mevduat bir daha faiz üretmez.
  // Vade sonu yeniden yatırım (yenileme) varsayımı dinamik olarak kapatılabilir
  // (bkz. openTbkAyarModal / DB.tahminAyarlari.vadeliYenile). Kapalıysa hiçbir
  // mevduat zincirlemesi kurulmaz — sadece ilk/gerçek vade sonu faizi sayılır.
  const tbkVadeliYenileAktif = !DB.tahminAyarlari || DB.tahminAyarlari.vadeliYenile !== false;

  // Kullanıcının girdiği ileriye dönük faiz oranı varsayımlarından (gecerlilikTarihi
  // <= verilen tarih olan) en güncelini döndürür; tanımlı değilse null (mevduatın
  // kendi oranı kullanılmaya devam eder).
  function tbkGelecekFaizOraniBul(tarihStr) {
    const list = (DB.gelecekFaizOranlari||[]).filter(g=>g && g.gecerlilikTarihi && g.gecerlilikTarihi <= tarihStr && Number(g.oran) >= 0);
    if(!list.length) return null;
    list.sort((a,b)=>b.gecerlilikTarihi.localeCompare(a.gecerlilikTarihi));
    return Number(list[0].oran);
  }
  // Aynı varsayım kaydına girilmiş stopaj oranı — tanımlı değilse null (mevduatın
  // kendi/varsayılan stopaj oranı kullanılmaya devam eder).
  function tbkGelecekStopajOraniBul(tarihStr) {
    const list = (DB.gelecekFaizOranlari||[]).filter(g=>g && g.gecerlilikTarihi && g.gecerlilikTarihi <= tarihStr && g.stopaj != null && Number(g.stopaj) >= 0);
    if(!list.length) return null;
    list.sort((a,b)=>b.gecerlilikTarihi.localeCompare(a.gecerlilikTarihi));
    return Number(list[0].stopaj);
  }

  (DB.mevduatlar||[]).forEach(mev=>{
    if(!mev.bitis || !(Number(mev.tutar) > 0)) return;
    // Zaten kapanmış/otomatik yenilenmiş (tarihsel) kayıtları tekrar sayma —
    // gerçek yenileme gerçekleştiyse ya bağlı hesap kapatılmıştır ya da entLog'a işlenmiştir.
    const eskiHesap = mev.hesapId ? (DB.hesaplar||[]).find(h=>h.id===mev.hesapId) : null;
    if(eskiHesap && eskiHesap.durum === 'kapali') return;
    // deleteMevduat() ile vadesi bitmeden erken kapatılmış/iptal edilmiş kayıtlar —
    // ilişkili hesap bulunamasa bile (bozuk/eksik hesapId gibi durumlarda) faiz sayılmasın.
    if(mev._erkenKapatildi || mev.erkenKapatildi || mev.kapatmaTipi === 'iptal' ||
       (mev.odDurum && (mev.odDurum.durum === 'iptal' || mev.odDurum.durum === 'cancelled' || mev.odDurum.durum === 'canceled'))) return;
    if(has('_lKey') && has('_lGet') && call('_lGet', call('_lKey', 'mevduat', mev.id, null)) != null) return;

    const vadeGun = Number(mev.vade) || 0;
    if(vadeGun <= 0) return;
    const pb = mev.paraBirimi || defaultCurrency || 'TRY';
    const faizOran = Number(mev.faizOran) || 0;
    const stopajOran = Number(mev.stopaj) || 0;
    const zincirTekSeferlik = (mev.strateji || 'tumu_vadesiz') === 'tumu_vadesiz' || !tbkVadeliYenileAktif;
    const hesapAdi = (eskiHesap && eskiHesap.ad) || (getBanka(mev.banka) + ' Vadeli Hesap');

    let anapara = Number(mev.tutar) || 0;
    let vadeSonu = mev.bitis;
    let ilkTur = true;
    let guvenlik = 0;

    while(vadeSonu && vadeSonu <= bitisStr && guvenlik < 500) {
      guvenlik++;
      if(vadeSonu >= todayStr) {
        // İlk vade için gerçekte kayıtlı net faiz kullanılır (tutarlılık için);
        // zincirdeki sonraki (varsayımsal) yenileme turlarında — kullanıcı bu
        // yenilemenin başladığı tarih için bir faiz oranı varsayımı girdiyse o
        // kullanılır, girilmediyse mevduatın kendi güncel oranıyla devam edilir.
        let netFaiz;
        if(ilkTur && mev.faiz != null) {
          netFaiz = Number(mev.faiz) || 0;
        } else {
          const varsayimOran = !ilkTur ? tbkGelecekFaizOraniBul(vadeSonu) : null;
          const varsayimStopaj = !ilkTur ? tbkGelecekStopajOraniBul(vadeSonu) : null;
          const efektifOran = varsayimOran != null ? varsayimOran : faizOran;
          const efektifStopaj = varsayimStopaj != null ? varsayimStopaj : stopajOran;
          const brutFaiz = anapara * (efektifOran/100) * (vadeGun/365);
          netFaiz = brutFaiz - brutFaiz * (efektifStopaj/100);
        }
        if(Math.abs(netFaiz) > 0.001) {
          olaylar.push({
            tarih: vadeSonu,
            tutar: netFaiz,
            pb,
            aciklama: (ilkTur ? '🏦 Mevduat Faizi: ' : '🏦 Mevduat Faizi (yenilenen): ') + hesapAdi,
            // Zincir burada kopmuyorsa (yeniden yatırılıyorsa) bu faiz anaparaya
            // eklenip vadeli hesapta kilitli kalmaya devam ediyor (bkz. "anapara +=
            // netFaiz" aşağıda) — serbest/boşta nakit haline gelmiyor. Bu yüzden
            // aşağıdaki "boşta bakiye" (simBakiye) simülasyonuna DAHİL EDİLMEMELİ;
            // aksi halde hâlâ vadeli hesapta kilitli duran bu tutar, aynı anda hem
            // kendi mevduat zincirinde hem de Değerlendirme Faizi simülasyonunda
            // iki kez faiz kazanmış gibi hesaplanır (çifte sayım).
            simDahilDegil: !zincirTekSeferlik
          });
        }
        if(zincirTekSeferlik) {
          // Zincir burada kopuyor — bu mevduat bir daha yenilenmeyecek, yani
          // vade sonunda anapara vadesize/boşta bakiyeye dönüşüyor demektir.
          // (Bu son faiz zaten yukarıda ayrı bir olay olarak eklendi ve genel
          // gün-bazlı akış üzerinden simBakiye'ye de yansıyacak — burada sadece
          // anaparayı, o tarihten itibaren "Gelecek Faiz Oranı Varsayımları"na
          // göre günlük değerlenmeye başlasın diye serbest bırakıyoruz.)
          serbestKalanlar.push({ tarih: vadeSonu, tutar: anapara, pb });
        }
        anapara += netFaiz; // sonraki (varsayımsal) tur, faiziyle birleşmiş anaparadan hesaplanır
      }
      if(zincirTekSeferlik) break;
      const d = new Date(vadeSonu + 'T00:00:00');
      d.setDate(d.getDate() + vadeGun);
      vadeSonu = localDateStr(d);
      ilkTur = false;
    }
  });

  // Elden ödemeler — havale (hesaba bağlı) ve nakit (fiziksel) hareketlerin hepsi
  // birleşik toplam varlık projeksiyonuna dahil edilir (TRY'ye çevrilerek).
  (DB.eldenler||[]).forEach(e=>{
    if(e.tarih < gecmisBaslangicStr || e.tarih > bitisStr) return;
    const pb = e.paraBirimi || defaultCurrency || 'TRY';
    olaylar.push({tarih:e.tarih, tutar:e.tutar, pb, aciklama:'✋ '+(e.aciklama||(e.tur==='gelir'?'Elden Gelir':'Elden Gider'))});
  });

  // Nakit bakiyesi için başlangıç değerini de ekle (varsa) — banka hesaplarıyla aynı şekilde,
  // ayrı bir pb anahtarı olmadan doğrudan kendi para birimiyle.
  if(DB._nakitBakiye) {
    Object.entries(DB._nakitBakiye).forEach(([pb,val])=>{
      baslangicByPb[pb] = (baslangicByPb[pb]||0) + val;
    });
  }

  // 3) Tüm para birimlerini gösterim para birimine (TCMB kuruyla) çevirip BİRLEŞİK
  //    tek bir günlük kümülatif bakiye serisi oluştur. Geçmiş/bugün için o günün
  //    TCMB kuru, henüz bülteni yayınlanmamış gelecek tarihler için en güncel
  //    (bugünkü) kur kullanılır — TCMB ileri tarihli kur yayınlamadığından bu,
  //    yapılabilecek en iyi tahmindir.
  const gosterimPb = defaultCurrency || 'TRY';
  function cevirGosterime(tutar, pb, tarihStr) {
    const hedefTarih = tarihStr && tarihStr <= todayStr ? tarihStr : null; // gelecek tarih -> en güncel kur
    const cevrilmis = paraBirimiCevirGuvenli(tutar, pb, gosterimPb, hedefTarih);
    return Number(cevrilmis) || 0;
  }

  const baslangicTRY = Object.entries(baslangicByPb).reduce((s,[pb,val])=>s+cevirGosterime(val, pb, todayStr), 0);
  const olaylarTRY = olaylar
    .map(o=>({ tarih:o.tarih, tutar:cevirGosterime(o.tutar, o.pb, o.tarih), aciklama:o.aciklama, simDahilDegil:o.simDahilDegil }))
    .sort((a,b)=>a.tarih.localeCompare(b.tarih));

  const gunler = [];
  let bakiye = baslangicTRY;
  const byTarih = {};
  olaylarTRY.forEach(o=>{
    if(!byTarih[o.tarih]) byTarih[o.tarih] = [];
    byTarih[o.tarih].push(o);
  });
  gunler.push({tarih: todayStr, bakiye, olaylar:[]});

  // Vade sonu yeniden yatırım varsayımı AÇIK'ken: sadece mevcut mevduatların kendi
  // vade sonu faizi değil, o anda vadesiz hesapta/nakitte boşta duran TÜM bakiyenin de
  // hiç boş bırakılmadan her gün vadeliymiş gibi değerlendirildiği varsayılır — yani
  // seçili tarih aralığındaki her gün, o günkü (henüz herhangi bir vadeliye bağlanmamış)
  // toplam bakiye üzerinden günlük bileşik faiz işletilir. Referans oran: o tarih için
  // tanımlı özel bir gelecek faiz varsayımı varsa o kullanılır; tanımlı değilse
  // kullanıcının mevcut vadeli mevduatlarının tutar ağırlıklı ortalama oranı kullanılır
  // (hiç mevduat da yoksa uydurma bir oran varsayılmaz — bu ek faiz simülasyonu atlanır).
  if(tbkVadeliYenileAktif) {
    let toplamMevduatTutar = 0, agirlikliOranToplam = 0;
    let agirlikliStopajToplam = 0;
    (DB.mevduatlar||[]).forEach(m=>{
      const t = Number(m.tutar)||0, o = Number(m.faizOran)||0, s = Number(m.stopaj)||0;
      if(t > 0 && o > 0) { toplamMevduatTutar += t; agirlikliOranToplam += t*o; agirlikliStopajToplam += t*s; }
    });
    const ortalamaMevduatOrani = toplamMevduatTutar > 0 ? agirlikliOranToplam/toplamMevduatTutar : null;
    // Stopaj için de aynı tutar-ağırlıklı ortalama kullanılır; hiç mevduat yoksa
    // (dolayısıyla ortalama alınamıyorsa) o tarih için geçerli genel stopaj oranı
    // (Ayarlar > Stopaj Oranları geçmişi) varsayılan olarak kullanılır.
    function tbkNakitDegerlendirmeStopaji(tarihStr) {
      const varsayim = tbkGelecekStopajOraniBul(tarihStr);
      if(varsayim != null) return varsayim;
      if(toplamMevduatTutar > 0) return agirlikliStopajToplam/toplamMevduatTutar;
      return (typeof getStopajOrani === 'function') ? (Number(getStopajOrani(tarihStr))||0) : 0;
    }
    function tbkNakitDegerlendirmeOrani(tarihStr) {
      const varsayim = tbkGelecekFaizOraniBul(tarihStr);
      return varsayim != null ? varsayim : ortalamaMevduatOrani;
    }

    // Şu an fiilen bir vadeli hesapta duran bakiyeyi (gösterim birimine çevrilmiş)
    // simülasyonun dışında tutuyoruz — bu tutar zaten kendi gerçek vade sonu
    // faiziyle (yukarıdaki mevduat zincirleme döngüsü) projeksiyona ekleniyor.
    // Aşağıdaki "boşta bakiye" simülasyonuna bir de o dahil edilirse aynı para
    // hem gerçek vade sonu faiziyle hem de bu varsayımsal günlük faizle iki
    // kez değerlenmiş olur.
    const vadeliBakiyeByPb = {};
    (DB.hesaplar||[]).forEach(h=>{
      if(h.durum === 'kapali' || h.tur !== 'vadeli') return;
      const pb = h.paraBirimi || defaultCurrency || 'TRY';
      vadeliBakiyeByPb[pb] = (vadeliBakiyeByPb[pb]||0) + (Number(h.bakiye)||0);
    });
    const vadeliBakiyeTRY = Object.entries(vadeliBakiyeByPb).reduce((s,[pb,val])=>s+cevirGosterime(val, pb, todayStr), 0);

    // Vadesi gelip yenilenmeyen mevduatlar (bkz. serbestKalanlar) — serbest
    // kaldıkları tarihten itibaren anaparaları artık kilitli değil, bu yüzden
    // o tarihten başlayarak "boşta bakiye" simülasyonuna (simBakiye) dahil
    // edilip Gelecek Faiz Oranı Varsayımları'na göre günlük değerlenmeye
    // başlarlar. Not: bu sadece simBakiye'yi (varsayımsal ek faiz akışını)
    // büyütür — gerçek toplam bakiye zaten baslangicTRY'den beri bu tutarı
    // içeriyordu, burada sadece "artık kilitli değil" durumuna geçiyor.
    const serbestKalanByTarih = {};
    serbestKalanlar.forEach(s=>{
      serbestKalanByTarih[s.tarih] = (serbestKalanByTarih[s.tarih]||0) + cevirGosterime(s.tutar, s.pb, s.tarih);
    });

    let simBakiye = baslangicTRY - vadeliBakiyeTRY + (serbestKalanByTarih[todayStr]||0);
    // Bugüne ait planlı ödeme/gelirler gerçek toplam bakiyeye aşağıdaki genel
    // günlük akışta yansıyor; varsayımsal günlük faiz simülasyonu ise yarından
    // başladığı için bugünün hareketlerini burada ayrıca simBakiye'ye işleriz.
    // Aksi halde bugün yapılacak ödemeler faiz matrahından düşmeden, sonraki
    // günlerde de simülasyon içinde fazla bakiye varmış gibi faiz üretirdi.
    (byTarih[todayStr]||[]).forEach(o=>{ if(!o.simDahilDegil) simBakiye += o.tutar; });
    let d = new Date(today); d.setDate(d.getDate()+1);
    const bitisDt = new Date(bitisStr+'T00:00:00');
    let guvenlikGun = 0;
    // Bir günün sonunda hesaplanan faiz o gün henüz nemalanmamıştır — parayı
    // "gece boyunca elde tutmanın" karşılığı olduğu için gerçekte ERTESİ günün
    // tarihiyle bakiyeye eklenir. pendingFaiz bir gün önceki hesaplamayı taşır.
    let pendingFaiz = null;
    while(d <= bitisDt && guvenlikGun < 3660) {
      guvenlikGun++;
      const tarih = localDateStr(d);
      if(pendingFaiz) {
        if(!byTarih[tarih]) byTarih[tarih] = [];
        byTarih[tarih].push({ tarih, tutar:pendingFaiz.tutar, aciklama:pendingFaiz.aciklama, detay:pendingFaiz.detay });
        pendingFaiz = null;
      }
      if(serbestKalanByTarih[tarih]) simBakiye += serbestKalanByTarih[tarih];
      // Faiz, gün başı bakiyesi değil o günün diğer gelir/gider işlemleri
      // uygulandıktan SONRAKİ (gün sonu) bakiyesi üzerinden hesaplanır — yani
      // sanki o gün sonunda elde kalan tutar vadeliye yatırılıyormuş gibi.
      // Not: bu forEach, yukarıda pushlanan bir önceki günün pendingFaiz'ini de
      // (artık byTarih[tarih] içinde) kapsayıp simBakiye'ye ekler.
      (byTarih[tarih]||[]).forEach(o=>{ if(!o.simDahilDegil) simBakiye += o.tutar; });
      if(simBakiye > 0) {
        const oran = tbkNakitDegerlendirmeOrani(tarih);
        if(oran != null && oran > 0) {
          const stopajOran = tbkNakitDegerlendirmeStopaji(tarih);
          const gunlukFaizBrut = simBakiye * (oran/100) / 365;
          const gunlukFaiz = gunlukFaizBrut - gunlukFaizBrut * (stopajOran/100);
          if(gunlukFaiz > 0.005) {
            // Ertesi gün booking yapılmak üzere sakla, simBakiye'ye HENÜZ ekleme.
            pendingFaiz = {
              tutar: gunlukFaiz,
              aciklama:'🏦 Değerlendirme Faizi (varsayım)',
              detay: `Oran: %${Number(oran).toLocaleString('tr-TR',{maximumFractionDigits:2})} · Stopaj: %${Number(stopajOran).toLocaleString('tr-TR',{maximumFractionDigits:2})} · Değerlenen: ${fmtCur(simBakiye, 'TRY')}`
            };
          }
        }
      }
      d.setDate(d.getDate()+1);
    }
  }

  // Sadece bugün ve sonrası (gunler dizisi hep "bugünden itibaren" anlamına gelir —
  // aylık özet/dip nokta/uyarı hesapları buna göre kurulu). Geçmiş tarihli olaylar
  // burada atlanır, aşağıdaki ayrı geriye dönük (backward) blokta işlenir.
  Object.keys(byTarih).sort().forEach(tarih=>{
    if(tarih < todayStr) return;
    byTarih[tarih].forEach(o=>{ bakiye += o.tutar; });
    gunler.push({tarih, bakiye, olaylar: byTarih[tarih]});
  });

  // ── Geriye dönük (geçmiş) günlük bakiye — "Geçmiş" buton grubu seçiliyse ──
  // Bugünkü gerçek bakiyeden başlayıp gün gün geriye doğru, o günün toplanan
  // olaylarını çıkararak önceki günün (gün sonu) bakiyesini yeniden kurar:
  // bakiye(gün-1) = bakiye(gün) - olaylar(gün). Böylece grafik geçmişi de
  // (yaklaşık, aynı kategori setiyle) kapsayan tek bir zaman çizgisi sunar.
  //
  // Not: bu geriye dönük yeniden kurma, tekrar eden (maaş/kira gibi) olayları
  // sonsuza kadar geriye doğru varsayımsal olarak üretebiliyordu — kullanıcının
  // gerçekte hiç verisi olmadığı (uygulamayı henüz kullanmadığı) tarihler için
  // bile "geçmiş" görünüyordu. Bunu önlemek için, elimizdeki en eski GERÇEK
  // kayıt (işlem) tarihinden önceye geçmiyoruz — seçili geçmiş penceresi daha
  // büyük olsa bile.
  let _enEskiVeriTarihi = null;
  (DB.islemler||[]).forEach(i=>{
    if(i.tarih && (!_enEskiVeriTarihi || i.tarih < _enEskiVeriTarihi)) _enEskiVeriTarihi = i.tarih;
  });

  const gecmisGunler = [];
  if(gecmisGunSayisi > 0 && _enEskiVeriTarihi) {
    let curDate = new Date(today);
    let curBal = baslangicTRY;
    for(let i=0; i<gecmisGunSayisi; i++) {
      const curStr = localDateStr(curDate);
      let eSum = 0;
      (byTarih[curStr]||[]).forEach(o=>{ eSum += o.tutar; });
      curBal -= eSum;
      curDate.setDate(curDate.getDate()-1);
      const prevStr = localDateStr(curDate);
      if(prevStr < _enEskiVeriTarihi) break; // veri olmayan geçmişe sarkma
      gecmisGunler.push({tarih: prevStr, bakiye: curBal, olaylar: byTarih[prevStr] || []});
    }
    gecmisGunler.reverse();
  }

  return {
    gunler,
    gecmisGunler,
    baslangic: baslangicTRY,
    toplamGelir: olaylarTRY.filter(o=>o.tutar>0 && o.tarih>=todayStr).reduce((s,o)=>s+o.tutar,0),
    toplamGider: olaylarTRY.filter(o=>o.tutar<0 && o.tarih>=todayStr).reduce((s,o)=>s+Math.abs(o.tutar),0),
    olaylar: olaylarTRY.filter(o=>o.tarih>=todayStr),
    pb: gosterimPb
  };
}
export { tahminGelecekBakiyeHesapla as tahminGelecekBakiyeHesapla__ozet };
// [ES module] eskiden 09-kart-altyapi.js window.tahminGelecekBakiyeHesapla
// üzerinden bu fonksiyonu okuyup zenginleştirilmiş (enrichTbk eklenmiş) bir
// sürümle window.tahminGelecekBakiyeHesapla'yı yeniden atıyordu; artık taban
// tanım burada register edilir, kart-altyapi.js kendi wrap'ini register
// eder, aşağıdaki çağrı call(...) ile her zaman en güncel (en dıştaki)
// sürümü kullanır.
register('tahminGelecekBakiyeHesapla', tahminGelecekBakiyeHesapla);

export function renderTahminBakiye() {
  const elWrap = document.getElementById('ozet-tahmin-bakiye');
  const elChips = document.getElementById('tahmin-pb-chips');
  if(!elWrap) return;
  if(elChips) elChips.style.display = 'none'; // Para birimleri artık birleşik gösterildiği için chip seçimi gerekmiyor

  const gunSayisi = (DB.uiFiltreler && DB.uiFiltreler.ozet && DB.uiFiltreler.ozet.tahminGun) || 365;
  const gecmisGunSayisi = (DB.uiFiltreler && DB.uiFiltreler.ozet && DB.uiFiltreler.ozet.tahminGecmisGun) || 0;
  // Başlığı da kalıcı seçime göre senkronize et (sayfa ilk yüklendiğinde/DB'den
  // geri yüklendiğinde statik HTML varsayılanı "1 Yıl" yerine gerçek seçim görünsün)
  const _tbkTitles = {90:'Gelecek 3 Ay Tahmini Bakiye', 180:'Gelecek 6 Ay Tahmini Bakiye', 365:'Gelecek 1 Yıl Tahmini Bakiye', 730:'Gelecek 2 Yıl Tahmini Bakiye', 1095:'Gelecek 3 Yıl Tahmini Bakiye'};
  const _tbkTitleEl = document.getElementById('tahmin-card-title');
  if(_tbkTitleEl) _tbkTitleEl.textContent = _tbkTitles[gunSayisi] || 'Tahmini Bakiye';
  // Aktif period butonunu senkronize et (sayfa yenilemelerinde) — SADECE bu karta ait
  // butonlar (Yaklaşan Ödemeler kartındaki butonlarla aynı ".tbk-period-btn" stil sınıfı
  // paylaşılıyor; global seçim yapılırsa oradaki periyot seçimi de yanlışlıkla değişiyordu).
  const tahminGrup = document.getElementById('tahmin-period-group');
  if(tahminGrup) tahminGrup.querySelectorAll('.tbk-period-btn').forEach(b=>{
    b.classList.toggle('tbk-period-active', Number(b.dataset.gun)===gunSayisi);
  });
  const tahminGecmisGrup = document.getElementById('tahmin-gecmis-group');
  if(tahminGecmisGrup) tahminGecmisGrup.querySelectorAll('.tbk-period-btn').forEach(b=>{
    b.classList.toggle('tbk-period-active', Number(b.dataset.gun)===gecmisGunSayisi);
  });
  const d = call('tahminGelecekBakiyeHesapla', gunSayisi, gecmisGunSayisi);
  if(!d.gunler || d.gunler.length < 2) {
    elWrap.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:36px 16px;color:var(--text3)">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity=".5"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18"/></svg>
      <div style="font-size:12.5px">Hesap bulunamadı — önce bir hesap ekleyin.</div>
    </div>`;
    return;
  }

  const pbGercek = d.pb;
  const safeId = 'birlesik';
  const gunler = d.gunler;
  const gecmisGunlerArr = d.gecmisGunler || [];
  const tumGunler = gecmisGunlerArr.concat(gunler);
  // Kullanıcının seçtiği geçmiş penceresi (gecmisGunSayisi, ör. "1 Yıl") ile
  // gerçekten döndürülen geçmiş veri (gecmisGunlerArr) farklı olabilir —
  // tahminGelecekBakiyeHesapla, en eski GERÇEK işlem tarihinden öncesine
  // sarkmıyor (bkz. _enEskiVeriTarihi), yani hiç kart işlemi yoksa veya en
  // eski işlem seçili pencereden daha yakınsa gecmisGunlerArr kısa/boş kalır.
  // Grafiğin x ekseni/ay etiketleri eskiden HER ZAMAN ham gecmisGunSayisi'na
  // göre genişletiliyordu — veri olmasa bile solda boş, veri içermeyen bir
  // alan açılıyordu. Artık sadece GERÇEKTEN dönen geçmiş gün sayısı kadar
  // genişletiliyor; veri yoksa (0 gün) grafik "Yok" seçiliymiş gibi bugünden
  // başlar.
  const gecmisGunSayisiEfektif = gecmisGunlerArr.length;
  const sonBakiye = gunler[gunler.length-1].bakiye;
  const netDegisim = sonBakiye - d.baslangic;
  const yuzdeDegisim = d.baslangic !== 0 ? (netDegisim / Math.abs(d.baslangic)) * 100 : null;
  const cizgiRenk = netDegisim >= 0 ? 'var(--teal)' : 'var(--rose)';

  // ── SVG koordinat sistemi ──────────────────────────────────────
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStrLocal = localDateStr(today);
  const isMobile = window.innerWidth <= 640;
  // viewBox genişliğini konteynerin gerçek piksel genişliğine sabitliyoruz.
  // Aksi halde sabit 800 birimlik viewBox geniş ekranlarda (ör. 1200px+ kart)
  // oranlı büyütülüyor (preserveAspectRatio="none" olsa da x/y aynı oranda
  // büyür) ve font/çizgi kalınlığı diğer arayüz elemanlarına göre "zoomlu"
  // görünüyordu. Gerçek genişliği kullanınca 1 viewBox birimi = 1 piksel olur.
  const measuredW = elWrap.getBoundingClientRect().width;
  const W = isMobile ? 360 : Math.max(640, Math.round(measuredW) || 800), H = isMobile ? 220 : 250;
  const yAxisW = isMobile ? 0 : 52;
  const padL = (isMobile ? 6 : 10) + yAxisW, padR = isMobile ? 10 : 14, padT = 26, padB = 30;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const allVals = tumGunler.map(g=>g.bakiye).concat([d.baslangic]);
  let minB = Math.min(...allVals), maxB = Math.max(...allVals);
  const dataSpan = (maxB - minB) || Math.max(1, Math.abs(maxB) * 0.15) || 1;
  // Veri hiç negatife düşmüyorsa (gerçek minimum >= 0), sıfırı taban olarak kilitle —
  // padding asla minimumu negatife düşürmesin (yanıltıcı "-40b" gibi sahte referans önlenir).
  const gercekMinPozitif = minB >= 0;
  minB -= dataSpan * 0.08; maxB += dataSpan * 0.12;
  if(gercekMinPozitif) minB = Math.max(minB, 0);
  const range = (maxB - minB) || 1;

  // Geçmiş penceresi seçiliyse x ekseni [-gecmisGunSayisi, +gunSayisi] aralığını kapsar;
  // seçili değilse (0) eskisiyle birebir aynı davranış (sadece bugün→ileri).
  const gunSayisiToplam = gunSayisi + gecmisGunSayisiEfektif;
  function xFor(tarihStr) {
    const t = new Date(tarihStr+'T00:00:00');
    const gunFarki = Math.round((t - today) / 86400000);
    const oran = (gunFarki + gecmisGunSayisiEfektif) / gunSayisiToplam;
    return padL + Math.max(0, Math.min(1, oran)) * plotW;
  }
  function yFor(bakiye) {
    return padT + (1 - (bakiye-minB)/range) * plotH;
  }

  // Çizgi noktaları (geçmiş + gelecek birleşik; son gün seçili periyoda sabit uzatılır)
  const pts = tumGunler.map(g=>({x:xFor(g.tarih), y:yFor(g.bakiye), tarih:g.tarih, bakiye:g.bakiye, olaylar:g.olaylar}));
  pts.push({x: W-padR, y: yFor(sonBakiye), tarih:null, bakiye:sonBakiye, olaylar:[]});
  let pathD = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  pts.forEach((p,i)=>{ if(i>0) pathD += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`; });
  const areaTop = `${pathD} L ${(W-padR).toFixed(1)} ${(H-padB).toFixed(1)} L ${padL} ${(H-padB).toFixed(1)} Z`;

  // ── Son gerçek olaydan sonraki "düz uzantı" kısmını ayır ──────────
  // Son gerçek olay günüyle 365. gün arasında hiçbir hareket yoksa, bu
  // kısım sadece "veri/planlı işlem yok" demektir — gerçek bir hesaplama
  // değil. Görsel olarak bunu soluk + kesik çizgi yaparak ayırt ediyoruz,
  // aksi halde "grafik bozulmuş" gibi yanıltıcı bir izlenim oluşuyor.
  const sonGercekIdx = pts.length - 2; // pts'in son elemanı zaten sentetik uzatma
  const sonGercekPt = pts[sonGercekIdx];
  const projeksiyonBitisTarihi = new Date(today.getFullYear(), today.getMonth(), today.getDate()+gunSayisi);
  const bosGunSayisi = sonGercekPt && sonGercekPt.tarih
    ? Math.round((projeksiyonBitisTarihi - new Date(sonGercekPt.tarih+'T00:00:00')) / 86400000)
    : 0;
  // "Anlamlı boşluk" eşiği: toplam aralığın en az %15'i ve en az 21 gün
  const uzantiVarMi = sonGercekIdx >= 0 && bosGunSayisi >= Math.max(21, gunSayisi*0.15);
  let pathDSolid = pathD, pathDUzanti = null;
  if(uzantiVarMi) {
    pathDSolid = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for(let i=1;i<=sonGercekIdx;i++) pathDSolid += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
    pathDUzanti = `M ${sonGercekPt.x.toFixed(1)} ${sonGercekPt.y.toFixed(1)}`;
    for(let i=sonGercekIdx+1;i<pts.length;i++) pathDUzanti += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  }

  // ── Y ekseni: 4 referans seviyesi + gerçek bakiye değerleri ─────
  const levelCount = isMobile ? 3 : 4;
  const gridLevels = Array.from({length:levelCount+1}, (_,i)=> minB + (i/levelCount)*range);
  let gridLines = '', yLabels = '';
  gridLevels.forEach(val=>{
    const y = yFor(val);
    if(y < padT-2 || y > H-padB+2) return;
    const _isDark1 = document.documentElement.getAttribute('data-theme') !== 'light';
    gridLines += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="${_isDark1 ? 'rgba(255,255,255,.045)' : 'rgba(0,0,0,.07)'}" stroke-width="1"/>`;
    if(!isMobile) {
      const kisaltilmis = fmtCurShort(val, pbGercek);
      yLabels += `<text x="${(padL-8).toFixed(1)}" y="${(y+3).toFixed(1)}" font-size="9.5" font-family="var(--mono)" fill="var(--text3)" text-anchor="end">${kisaltilmis}</text>`;
    }
  });

  // Sıfır çizgisi (sadece aralığa dahilse, ayrı ve net şekilde)
  const zeroY = yFor(0);
  const sıfırGoster = minB < 0 && maxB > 0;

  // ── Ay etiketleri: çakışmayı önlemek için dinamik adım ──────────
  let ayEtiketleri = '';
  const ayKisaTr = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  const minPxPerLabel = isMobile ? 56 : 58;
  const maxLabelCount = Math.max(2, Math.floor(plotW / minPxPerLabel));
  // Toplam ay sayısı seçili döneme göre değişir (3 Ay → ~4, 2 Yıl → ~25) —
  // önceden 12 ile sabitlenmişti, bu da 1 yıldan uzun dönemlerde (ör. "2 Yıl")
  // grafiğin ilk yılından sonrasında hiç ay etiketi görünmemesine sebep oluyordu.
  // Geçmiş penceresi seçiliyse (gecmisGunSayisi>0), sol tarafa doğru negatif ay
  // indeksleri de eklenir — ay etiketleri hem geçmişi hem geleceği kapsar.
  const gecmisAySayisi = gecmisGunSayisiEfektif > 0 ? Math.ceil(gecmisGunSayisiEfektif/30) + 1 : 0;
  const toplamAySayisi = Math.ceil(gunSayisi/30) + 1;
  const ayAraligiToplam = gecmisAySayisi + toplamAySayisi;
  let ayAdimi = Math.ceil((ayAraligiToplam+1) / maxLabelCount);
  if(ayAdimi < 1) ayAdimi = 1;
  for(let i=-gecmisAySayisi; i<=toplamAySayisi; i+=ayAdimi) {
    const dt = new Date(today.getFullYear(), today.getMonth()+i, 1);
    const x = xFor(localDateStr(dt));
    if(x < padL - 2 && i !== -gecmisAySayisi) continue;
    if(x > W - padR - 14 && i !== 0) continue;
    const yilEtiket = (i===0 || dt.getMonth()===0) ? ` '${String(dt.getFullYear()).slice(2)}` : '';
    ayEtiketleri += `<text x="${x.toFixed(1)}" y="${H-10}" font-size="9.5" font-family="var(--sans)" fill="var(--text3)" text-anchor="middle">${ayKisaTr[dt.getMonth()]}${yilEtiket}</text>`;
  }

  // Dip nokta (en düşük bakiye) ve negatife düşüş anı — sadece bugün ve sonrası
  // (tahmin/uyarı anlamı taşıdığı için geçmiş, zaten gerçekleşmiş bir düşüşü
  // "düşecek" gibi yanlış göstermesin diye burada hâlâ sadece "gunler" kullanılır).
  let dipNokta = gunler[0];
  gunler.forEach(g=>{ if(g.bakiye < dipNokta.bakiye) dipNokta = g; });
  const negatifeDusuyor = dipNokta.bakiye < 0;
  let negatifGecisGunu = null;
  for(let i=1; i<gunler.length; i++) {
    if(gunler[i-1].bakiye >= 0 && gunler[i].bakiye < 0) { negatifGecisGunu = gunler[i]; break; }
  }

  const gradId = 'tahminGrad_' + safeId;
  const glowId = 'tahminGlow_' + safeId;

  // Ay sınırı dikey çizgileri (hafif) — geçmiş + gelecek birlikte
  let ayBolmeleri = '';
  for(let i=-gecmisAySayisi+1; i<=Math.ceil(gunSayisi/30)+1; i++) {
    const dt = new Date(today.getFullYear(), today.getMonth()+i, 1);
    const x = xFor(localDateStr(dt));
    if(x <= padL || x >= W-padR) continue;
    const _isDarkAy = document.documentElement.getAttribute('data-theme') !== 'light';
  ayBolmeleri += `<line x1="${x.toFixed(1)}" y1="${padT}" x2="${x.toFixed(1)}" y2="${H-padB}" stroke="${_isDarkAy ? 'rgba(255,255,255,.055)' : 'rgba(0,0,0,.08)'}" stroke-width="1" stroke-dasharray="2,4"/>`;
  }

  // İşaretçiler
  let markers = '';
  if(negatifeDusuyor && negatifGecisGunu) {
    const mx = xFor(negatifGecisGunu.tarih), my = yFor(negatifGecisGunu.bakiye);
    markers += `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="10" fill="var(--rose)" opacity="0.16"><animate attributeName="r" values="9;15;9" dur="2.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.2;0.04;0.2" dur="2.2s" repeatCount="indefinite"/></circle>`;
    markers += `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="4" fill="var(--bg)" stroke="var(--rose)" stroke-width="2"/>`;
  }
  // Dip nokta işaretçisi (negatife düşmese bile en düşük noktayı göster)
  const dipX = xFor(dipNokta.tarih), dipY = yFor(dipNokta.bakiye);
  const dipRenk = dipNokta.bakiye < 0 ? 'var(--rose)' : 'var(--gold)';
  if(dipNokta.tarih !== gunler[0].tarih && dipNokta.tarih !== gunler[gunler.length-1]?.tarih) {
    markers += `<circle cx="${dipX.toFixed(1)}" cy="${dipY.toFixed(1)}" r="3.5" fill="${dipRenk}" stroke="var(--bg)" stroke-width="1.5" opacity="0.85"/>`;
    if(!isMobile) {
      const labelX = dipX > W*0.75 ? dipX-4 : dipX+4;
      const anchor = dipX > W*0.75 ? 'end' : 'start';
      markers += `<text x="${labelX.toFixed(1)}" y="${(dipY-7).toFixed(1)}" font-size="9" font-family="var(--mono)" fill="${dipRenk}" text-anchor="${anchor}" opacity="0.85">${fmtCurShort(dipNokta.bakiye, pbGercek)}</text>`;
    }
  }
  const bugunPt = pts.find(p=>p.tarih===todayStrLocal) || pts[0];
  markers += `<circle cx="${bugunPt.x.toFixed(1)}" cy="${bugunPt.y.toFixed(1)}" r="4.5" fill="var(--bg)" stroke="var(--gold)" stroke-width="2.25"/>`;
  const lastPt = pts[pts.length-1];
  markers += `<circle cx="${lastPt.x.toFixed(1)}" cy="${lastPt.y.toFixed(1)}" r="5" fill="${cizgiRenk}" opacity="0.18"><animate attributeName="r" values="5;9;5" dur="2.6s" repeatCount="indefinite"/></circle>`;
  markers += `<circle cx="${lastPt.x.toFixed(1)}" cy="${lastPt.y.toFixed(1)}" r="4" fill="${cizgiRenk}" stroke="var(--bg)" stroke-width="1.75"/>`;
  if(!isMobile) {
    const lastLabelY = lastPt.y < padT+14 ? lastPt.y+16 : lastPt.y-10;
    markers += `<text x="${(lastPt.x-7).toFixed(1)}" y="${lastLabelY.toFixed(1)}" font-size="9.5" font-family="var(--mono)" fill="${cizgiRenk}" text-anchor="end" opacity="0.85">${fmtCurShort(sonBakiye, pbGercek)}</text>`;
  }

  // "Bugün" dikey referans çizgisi — sadece geçmiş de gösterildiğinde anlamlı
  // (geçmiş yoksa grafik zaten bugünde başlıyor, ayrı bir çizgiye gerek yok).
  let bugunCizgisi = '';
  if(gecmisGunSayisiEfektif > 0) {
    const bx = xFor(todayStrLocal);
    if(bx > padL + 1 && bx < W - padR - 1) {
      bugunCizgisi = `<line x1="${bx.toFixed(1)}" y1="${padT}" x2="${bx.toFixed(1)}" y2="${H-padB}" stroke="var(--gold)" stroke-width="1.2" stroke-dasharray="3,3" opacity="0.4"/>`;
    }
  }

  // Hover için tüm gerçek olay günleri (geçmiş + gelecek) + son sentetik nokta
  const olayNoktalari = tumGunler.map(g=>({x:xFor(g.tarih), y:yFor(g.bakiye), tarih:g.tarih, bakiye:g.bakiye, olaylar:g.olaylar}));
  // Son sentetik noktayı (pts'in son elemanı) da hover listesine ekle
  const _sonPt = pts[pts.length-1];
  if(_sonPt && (!olayNoktalari.length || _sonPt.x > olayNoktalari[olayNoktalari.length-1].x + 1)) {
    olayNoktalari.push(_sonPt);
  }

  // ── Aylık Breakdown Hesabı ───────────────────────────────────────
  const AY_KISATR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const aylikVeriler = [];
  {
    const ayMap = new Map(); // 'YYYY-MM' -> {gelir, gider, baslangicBakiye}
    let oncekiBakiye = d.baslangic;
    // Her olay gününü ilgili aya ata
    const gunlerTumButIlk = gunler.slice(1); // ilk nokta bugün, olay değil
    gunlerTumButIlk.forEach(g => {
      const ayKey = g.tarih.slice(0, 7);
      if (!ayMap.has(ayKey)) {
        const y = parseInt(ayKey.slice(0,4)), m = parseInt(ayKey.slice(5,7))-1;
        ayMap.set(ayKey, { ayKey, y, m, gelir: 0, gider: 0, baslangicBakiye: oncekiBakiye, islemler: [] });
      }
      const ay = ayMap.get(ayKey);
      g.olaylar.forEach(o => {
        if (o.tutar > 0) ay.gelir += o.tutar;
        else ay.gider += Math.abs(o.tutar);
        ay.islemler.push({ tarih: g.tarih, aciklama: o.aciklama, tutar: o.tutar, detay: o.detay, bilgiKalemi: !!o.bilgiKalemi, gosterilenTutar: o.gosterilenTutar });
      });
      oncekiBakiye = g.bakiye;
    });
    // Ayları sıralı diz
    let birikimli = d.baslangic;
    Array.from(ayMap.values()).sort((a,b)=>a.ayKey.localeCompare(b.ayKey)).forEach(ay => {
      const net = ay.gelir - ay.gider;
      birikimli += net;
      aylikVeriler.push({ ...ay, net, bitisBakiye: birikimli });
    });
  }
  const kritikAy = aylikVeriler.length ? aylikVeriler.reduce((a,b)=>b.bitisBakiye<a.bitisBakiye?b:a) : null;
  // Popup'ta (tbkAyDetayAc) kullanılmak üzere aylık işlem detaylarını sakla
  _tbkAylikVeriler = aylikVeriler;
  _tbkAylikPb = pbGercek;

  // ── Aylık Tablo HTML ─────────────────────────────────────────────
  let tbkAylikHtml = '';
  if (aylikVeriler.length > 0) {
    const satirlar = aylikVeriler.map(ay => {
      const isKritik = kritikAy && ay.ayKey === kritikAy.ayKey;
      const netRenk = ay.net >= 0 ? 'var(--teal)' : 'var(--rose)';
      const bitisRenk = ay.bitisBakiye < 0 ? 'var(--rose)' : ay.bitisBakiye < d.baslangic * 0.3 ? 'var(--gold)' : 'var(--text)';
      const ayLabel = `${AY_KISATR[ay.m]} ${ay.y}`;
      return `<tr class="tbk-ay-row ozet-tbk-ay-detay-ac ${isKritik ? 'tbk-ay-kritik' : ''}" data-ay-key="${ay.ayKey}" title="${ayLabel} ayındaki tüm işlemleri gör">
        <td data-label="">${isKritik ? '⚠️ ' : ''}${ayLabel}</td>
        <td data-label="Gelir" style="color:var(--teal)">+${fmtCur(ay.gelir, pbGercek)}</td>
        <td data-label="Gider" style="color:var(--rose)">-${fmtCur(ay.gider, pbGercek)}</td>
        <td data-label="Net" style="color:${netRenk};font-weight:600">${fmtCur(ay.net, pbGercek, true)}</td>
        <td data-label="Bakiye" style="color:${bitisRenk};font-weight:700">${fmtCur(ay.bitisBakiye, pbGercek)}</td>
      </tr>`;
    }).join('');
    tbkAylikHtml = `<div class="tbk-aylik-wrap">
      <div class="tbk-aylik-title tbk-section-toggle ozet-tbk-section-toggle">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        Aylık Gelir / Gider / Bakiye Özeti
      </div>
      <div class="tbk-aylik-body">
        <table class="tbk-aylik-table">
          <thead><tr>
            <th>Ay</th>
            <th>Gelir</th>
            <th>Gider</th>
            <th>Net</th>
            <th>Bakiye (Dönem Sonu)</th>
          </tr></thead>
          <tbody>${satirlar}</tbody>
        </table>
      </div>
    </div>`;
  }

  // ── En Büyük Kalemler ────────────────────────────────────────────
  let tbkKalemlerHtml = '';
  {
    const kalemMap = {}; // aciklama -> {gelir, gider}
    (d.olaylar||[]).forEach(o=>{
      if(!kalemMap[o.aciklama]) kalemMap[o.aciklama] = {ad:o.aciklama, gelir:0, gider:0};
      if(o.tutar>0) kalemMap[o.aciklama].gelir += o.tutar;
      else kalemMap[o.aciklama].gider += Math.abs(o.tutar);
    });
    const kalemler = Object.values(kalemMap);
    const topGelir = kalemler.filter(k=>k.gelir>0).sort((a,b)=>b.gelir-a.gelir).slice(0,5);
    const topGider = kalemler.filter(k=>k.gider>0).sort((a,b)=>b.gider-a.gider).slice(0,5);
    if(topGelir.length || topGider.length) {
      const gelirSatir = topGelir.map(k=>`<div class="tbk-kalem-row">
        <span class="tbk-kalem-ad" title="${k.ad}">${k.ad}</span>
        <span class="tbk-kalem-tutar" style="color:var(--teal)">+${fmtCur(k.gelir,pbGercek)}</span>
      </div>`).join('');
      const giderSatir = topGider.map(k=>`<div class="tbk-kalem-row">
        <span class="tbk-kalem-ad" title="${k.ad}">${k.ad}</span>
        <span class="tbk-kalem-tutar" style="color:var(--rose)">-${fmtCur(k.gider,pbGercek)}</span>
      </div>`).join('');
      tbkKalemlerHtml = `<div class="tbk-kalemler">
        ${topGelir.length ? `<div class="tbk-kalem-col">
          <div class="tbk-kalem-col-title"><span style="color:var(--teal)">▲</span> En Büyük Gelirler</div>
          ${gelirSatir}
        </div>` : ''}
        ${topGider.length ? `<div class="tbk-kalem-col">
          <div class="tbk-kalem-col-title"><span style="color:var(--rose)">▼</span> En Büyük Giderler</div>
          ${giderSatir}
        </div>` : ''}
      </div>`;
    }
  }

  const _vadeliYenileAktif = !DB.tahminAyarlari || DB.tahminAyarlari.vadeliYenile !== false;
  const _gelecekFaizSayisi = (DB.gelecekFaizOranlari||[]).length;
  // Vade sonu yeniden yatırım varsayımının açık/kapalı durumu artık geniş bir
  // bilgi satırı yerine, karttaki dişli (ayarlar) ikonunun üzerine konan küçük
  // renkli bir noktayla (yeşil=açık, kırmızı=kapalı) gösteriliyor — bkz. tbk-settings-dot.
  const tbkSettingsBtn = document.getElementById('tbk-settings-btn');
  if(tbkSettingsBtn) {
    let dot = document.getElementById('tbk-settings-dot');
    if(!dot) {
      dot = document.createElement('span');
      dot.id = 'tbk-settings-dot';
      dot.className = 'tbk-settings-dot';
      tbkSettingsBtn.appendChild(dot);
    }
    dot.style.background = _vadeliYenileAktif ? 'var(--teal)' : 'var(--rose)';
    const durumAciklama = _vadeliYenileAktif
      ? (_gelecekFaizSayisi ? `Açık · ${_gelecekFaizSayisi} özel faiz oranı tanımlı` : 'Açık · mevduatların kendi güncel oranı kullanılıyor')
      : 'Kapalı';
    tbkSettingsBtn.title = `Vade yenileme / faiz varsayımı ayarları — ${durumAciklama}`;
  }
  elWrap.innerHTML = `
    <div class="tbk-stats-grid">
      <div class="tbk-stat">
        <div class="tbk-stat-icon" style="background:var(--gold-glow2);color:var(--gold)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
        </div>
        <div class="tbk-stat-label">Şu Anki Bakiye</div>
        <div class="tbk-stat-val mono">${fmtCur(d.baslangic, pbGercek)}</div>
      </div>
      <div class="tbk-stat">
        <div class="tbk-stat-icon" style="background:${sonBakiye>=d.baslangic?'var(--teal-glow)':'var(--rose-glow)'};color:${sonBakiye>=d.baslangic?'var(--teal)':'var(--rose)'}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>
        </div>
        <div class="tbk-stat-label">${({90:'3 Ay',180:'6 Ay',365:'1 Yıl',730:'2 Yıl',1095:'3 Yıl'})[gunSayisi] || (gunSayisi+' Gün')} Sonra Tahmini</div>
        <div class="tbk-stat-val mono" style="color:${sonBakiye>=d.baslangic?'var(--teal)':'var(--rose)'}">${fmtCur(sonBakiye, pbGercek)}</div>
      </div>
      <div class="tbk-stat">
        <div class="tbk-stat-icon" style="background:${netDegisim>=0?'var(--teal-glow)':'var(--rose-glow)'};color:${netDegisim>=0?'var(--teal)':'var(--rose)'}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${netDegisim>=0?'<polyline points="18 15 12 9 6 15"/>':'<polyline points="6 9 12 15 18 9"/>'}</svg>
        </div>
        <div class="tbk-stat-label">Net Değişim</div>
        <div class="tbk-stat-val mono" style="color:${netDegisim>=0?'var(--teal)':'var(--rose)'}">${fmtCur(netDegisim, pbGercek, true)}${yuzdeDegisim!==null?`<span style="font-size:10.5px;opacity:.7;margin-left:4px">(${yuzdeDegisim>=0?'+':''}${yuzdeDegisim.toFixed(0)}%)</span>`:''}</div>
      </div>
      <div class="tbk-stat">
        <div class="tbk-stat-icon" style="background:var(--purple-glow);color:var(--violet)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-6 4 3 5-8"/></svg>
        </div>
        <div class="tbk-stat-label">Toplam Gelir / Gider</div>
        <div class="tbk-stat-val mono" style="font-size:13px;display:flex;flex-wrap:wrap;align-items:baseline;gap:0"><span style="color:var(--teal)">+${fmtCur(d.toplamGelir, pbGercek)}</span><span style="color:var(--text3);margin:0 4px">/</span><span style="color:var(--rose)">-${fmtCur(d.toplamGider, pbGercek)}</span></div>
      </div>
    </div>

    ${negatifeDusuyor ? `<div class="tbk-alert">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span>Tahmine göre <b>${fmtDate(new Date(dipNokta.tarih+'T00:00:00'))}</b> civarında bakiye <b>${fmtCur(dipNokta.bakiye, pbGercek)}</b>'ye düşüyor. Gelir/gider planınızı gözden geçirin.</span>
    </div>` : ''}

    <div class="tbk-chart-wrap">
      <svg id="tbk-svg-${safeId}" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;overflow:visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${cizgiRenk}" stop-opacity="0.4"/>
            <stop offset="55%" stop-color="${cizgiRenk}" stop-opacity="0.08"/>
            <stop offset="100%" stop-color="${cizgiRenk}" stop-opacity="0"/>
          </linearGradient>
          <filter id="${glowId}" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        ${ayBolmeleri}
        ${gridLines}
        ${yLabels}
        ${bugunCizgisi}
        ${sıfırGoster ? `<line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${W-padR}" y2="${zeroY.toFixed(1)}" stroke="var(--rose)" stroke-width="1.1" stroke-dasharray="4,3" opacity="0.55"/>` : ''}
        <path d="${areaTop}" fill="url(#${gradId})" stroke="none"/>
        <path d="${pathDSolid}" fill="none" stroke="${cizgiRenk}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" filter="url(#${glowId})"/>
        ${pathDUzanti ? `<path d="${pathDUzanti}" fill="none" stroke="${cizgiRenk}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="6,5" opacity="0.4"/>` : ''}
        ${uzantiVarMi ? `<circle cx="${sonGercekPt.x.toFixed(1)}" cy="${sonGercekPt.y.toFixed(1)}" r="3" fill="var(--bg)" stroke="${cizgiRenk}" stroke-width="1.5" opacity="0.7"/>` : ''}
        ${markers}
        ${ayEtiketleri}
        <line id="tbk-hoverline-${safeId}" x1="0" y1="${padT}" x2="0" y2="${H-padB}" stroke="var(--text2)" stroke-width="1" stroke-dasharray="2,3" opacity="0"/>
        <circle id="tbk-hoverdot-${safeId}" cx="0" cy="0" r="5" fill="${cizgiRenk}" stroke="var(--bg)" stroke-width="2" opacity="0"/>
        <rect x="${padL}" y="${padT}" width="${plotW + padR}" height="${plotH}" fill="transparent" style="cursor:crosshair" id="tbk-hoverarea-${safeId}"/>
      </svg>
      <div id="tbk-tooltip-${safeId}" class="tbk-tooltip" style="opacity:0"></div>
    </div>

    <div class="tbk-legend">
      <span><span class="tbk-dot" style="background:var(--gold)"></span>Bugün</span>
      ${negatifeDusuyor ? `<span><span class="tbk-dot" style="background:var(--rose)"></span>Eksiye geçiş</span>` : ''}
      ${(dipNokta.tarih !== gunler[0].tarih) ? `<span><span class="tbk-dot" style="background:${dipNokta.bakiye<0?'var(--rose)':'var(--gold)'}"></span>En düşük (${fmtDate(new Date(dipNokta.tarih+'T00:00:00'))})</span>` : ''}
      ${uzantiVarMi ? `<span style="display:inline-flex;align-items:center;gap:5px"><svg width="14" height="8" viewBox="0 0 14 8"><line x1="0" y1="4" x2="14" y2="4" stroke="${cizgiRenk}" stroke-width="2" stroke-dasharray="3,2.5" opacity="0.5"/></svg>Planlı işlem yok</span>` : ''}
      <span style="margin-left:auto;font-size:10px;color:var(--text3)">${gecmisGunSayisiEfektif>0 ? `${gecmisGunSayisiEfektif} gün geçmiş + ${gunSayisi} gün gelecek` : `${gunSayisi} günlük projeksiyon`}</span>
    </div>

    ${uzantiVarMi ? `<div class="tbk-uyari-bos">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
      <span><strong>${fmtDate(new Date(sonGercekPt.tarih+'T00:00:00'))}</strong> sonrası için tanımlı bir gelir/gider bulunmuyor — çizgi bu noktadan sonra sabit kaldığı için kesik çizgiyle gösteriliyor. Maaş, kira veya abonelik ekleyerek tahmini güncelleyebilirsin.</span>
    </div>` : ''}

    <div class="tbk-footnote">
      Maaş, kira, abonelik, kredi taksitleri, kredi kartı ekstre ödemeleri (son ödeme tarihinde tek kalem) ve kayıtlı elden işlemlere göre hesaplanır. Henüz girilmemiş yeni harcamalar tahmine yansımaz.
    </div>

    ${tbkAylikHtml}
    ${tbkKalemlerHtml}
  `;

  // [ES module] onclick="tbkAyDetayAc(...)", onclick="this.closest(...).classList.toggle(...)"
  // kaldırıldı - gerçek addEventListener bağlanıyor. tbkAyDetayAc birden fazla
  // modül tarafından zincirleme wrap edildiği için core/wrap-registry.js
  // üzerinden en güncel katman çağrılıyor (bkz. tbk-detay.js, app-core.js).
  elWrap.querySelectorAll('.ozet-tbk-ay-detay-ac').forEach(row => {
    row.addEventListener('click', () => call('tbkAyDetayAc', row.dataset.ayKey));
  });
  elWrap.querySelectorAll('.ozet-tbk-section-toggle').forEach(el => {
    el.addEventListener('click', () => {
      el.closest('.tbk-aylik-wrap').classList.toggle('tbk-section-collapsed');
    });
  });

  // ── Hover etkileşimi ────────────────────────────────────────────
  (function attachHover(){
    const svg = document.getElementById('tbk-svg-'+safeId);
    const hoverArea = document.getElementById('tbk-hoverarea-'+safeId);
    const hoverLine = document.getElementById('tbk-hoverline-'+safeId);
    const hoverDot = document.getElementById('tbk-hoverdot-'+safeId);
    const tooltip = document.getElementById('tbk-tooltip-'+safeId);
    if(!svg || !hoverArea || !tooltip) return;

    function findNearest(svgX) {
      let nearest = olayNoktalari[0];
      let minDist = Infinity;
      olayNoktalari.forEach(p=>{
        const dist = Math.abs(p.x - svgX);
        if(dist < minDist) { minDist = dist; nearest = p; }
      });
      return nearest;
    }

    function onMove(evt) {
      const rect = svg.getBoundingClientRect();
      const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
      const svgX = ((clientX - rect.left) / rect.width) * W;
      const p = findNearest(svgX);
      hoverLine.setAttribute('x1', p.x); hoverLine.setAttribute('x2', p.x); hoverLine.setAttribute('opacity', '0.55');
      hoverDot.setAttribute('cx', p.x); hoverDot.setAttribute('cy', p.y); hoverDot.setAttribute('opacity', '1');

      const tarihLabel = p.tarih === todayStrLocal ? 'Bugün' : fmtDate(new Date(p.tarih+'T00:00:00'));
      const olayHtml = (p.olaylar||[]).slice(0,4).map(o=>
        `<div class="tbk-tt-row"><span>${o.aciklama}</span><span class="mono" style="color:${o.tutar>=0?'var(--teal)':'var(--rose)'}">${fmtCur(o.tutar, pbGercek, true)}</span></div>${o.detay?`<div class="tbk-tt-detay">${o.detay}</div>`:''}`
      ).join('');
      const fazlaOlay = (p.olaylar||[]).length > 4 ? `<div class="tbk-tt-more">+${p.olaylar.length-4} işlem daha</div>` : '';
      const gunNetTutar = (p.olaylar||[]).reduce((s,o)=>s+(Number(o.tutar)||0), 0);
      const gunBasiBakiye = p.bakiye - gunNetTutar;
      tooltip.innerHTML = `<div class="tbk-tt-date">${tarihLabel}</div>
        <div class="tbk-tt-baki-line"><span>Gün başı</span><b class="mono">${fmtCur(gunBasiBakiye, pbGercek)}</b></div>
        <div class="tbk-tt-baki-line"><span>Gün sonu</span><span class="tbk-tt-bakiye mono">${fmtCur(p.bakiye, pbGercek)}</span></div>
        ${olayHtml ? `<div class="tbk-tt-divider"></div>${olayHtml}${fazlaOlay}` : ''}`;

      const pxRatio = rect.width / W;
      let leftPx = p.x * pxRatio;
      const ttWidth = 184;
      if(leftPx + ttWidth > rect.width) leftPx = leftPx - ttWidth - 14;
      else leftPx = leftPx + 14;
      tooltip.style.left = Math.max(4, leftPx) + 'px';
      const pyRatio = (svg.clientHeight||rect.height||H) / H;
      tooltip.style.top = Math.max(0, (p.y*pyRatio) - 10) + 'px';
      tooltip.style.opacity = '1';
    }
    function onLeave() {
      hoverLine.setAttribute('opacity','0');
      hoverDot.setAttribute('opacity','0');
      tooltip.style.opacity = '0';
    }
    hoverArea.addEventListener('mousemove', onMove);
    hoverArea.addEventListener('mouseleave', onLeave);
    hoverArea.addEventListener('touchmove', function(e){ onMove(e); }, {passive:true});
    hoverArea.addEventListener('touchend', onLeave);
  })();
}

// Aylık Gelir/Gider/Bakiye Özeti tablosunda bir aya tıklanınca o ayın tüm
// işlemlerini (gelir + gider) listeleyen detay popup'ını açar. Tarih aralığı
// varsayılan olarak tıklanan ayın başı/sonu ile doldurulur; kullanıcı
// tbk-ay-detay-bas / -bit inputlarından manuel olarak daraltabilir.
/* rf-refactor Faz1: tbkAyDetayAc() burada tanımlıydı — artık ölü kod; aktif tanım js/ui/pages/tbk-detay.js'de (export const tbkAyDetayAc + register('tbkAyDetayAc', ...) ile wrap-registry üzerinden çağrılıyor). */

// Tarih aralığı inputları değiştiğinde işlem listesini ve özet kartlarını
// (Gelir/Gider/Net) seçili aralığa göre yeniden hesaplayıp çizer. "Dönem Sonu
// Bakiye" her zaman ayın tamamına göre gösterilir çünkü akan bir bakiye
// değeridir, kısmi bir aralığa göre anlamlı bir "dönem sonu" ifade etmez.
/* rf-refactor Faz1: tbkAyDetayFiltreUygula() burada tanımlıydı — artık ölü kod; aktif tanım js/ui/pages/tbk-detay.js'de (export const tbkAyDetayFiltreUygula + register('tbkAyDetayFiltreUygula', ...) ile wrap-registry üzerinden çağrılıyor). */

// "Ay Tümü" butonu — tarih aralığını sıfırlayıp tıklanan ayın başı/sonuna döner.
/* rf-refactor Faz1: tbkAyDetayTarihSifirla() burada tanımlıydı — artık ölü kod; aktif tanım js/ui/pages/tbk-detay.js'de (export const tbkAyDetayTarihSifirla, _tbkMonthlyDetailApi üzerinden). */

// Yaklaşan Ödemeler & Gelirler kartı için periyot seçici — Gelecek Tahmini
// Bakiye kartındaki aynı mekanizma (buton grubu + kalıcı seçim, DB.uiFiltreler.ozet.odemelerGun).
export function ozetOdSetGecmis(gun, btn) {
  if(!DB.uiFiltreler) DB.uiFiltreler = {};
  if(!DB.uiFiltreler.ozet) DB.uiFiltreler.ozet = {};
  if(DB.uiFiltreler.ozet.odemelerGecmisGun !== gun) { DB.uiFiltreler.ozet.odemelerGecmisGun = gun; saveData(); }
  document.querySelectorAll('.ozet-od-gecmis-btn').forEach(b=>b.classList.remove('tbk-period-active'));
  if(btn) btn.classList.add('tbk-period-active');
  renderOzet();
}

// "Bugüne Kaydır" özelliğinin açık/kapalı durumu — kalıcı olarak DB.uiFiltreler.ozet.bugunScroll
// içinde saklanır, sayfa her yeniden açıldığında/yüklendiğinde bu kayıtlı değerle başlatılır.
export function ozetOdSetBugunScroll(acikMi) {
  if(!DB.uiFiltreler) DB.uiFiltreler = {};
  if(!DB.uiFiltreler.ozet) DB.uiFiltreler.ozet = {};
  DB.uiFiltreler.ozet.bugunScroll = !!acikMi;
  saveData();
  renderOzet();
}

export function ozetOdSetPeriod(gun, btn) {
  if(!DB.uiFiltreler) DB.uiFiltreler = {};
  if(!DB.uiFiltreler.ozet) DB.uiFiltreler.ozet = {};
  if(DB.uiFiltreler.ozet.odemelerGun !== gun) { DB.uiFiltreler.ozet.odemelerGun = gun; saveData(); }
  const titles = {30:'Yaklaşan Ödemeler & Gelirler (1 Ay)', 90:'Yaklaşan Ödemeler & Gelirler (3 Ay)', 180:'Yaklaşan Ödemeler & Gelirler (6 Ay)', 365:'Yaklaşan Ödemeler & Gelirler (1 Yıl)'};
  const el = document.getElementById('ozet-odemeler-title');
  if(el) el.textContent = titles[gun] || 'Yaklaşan Ödemeler & Gelirler';
  document.querySelectorAll('.ozet-od-period-btn').forEach(b=>b.classList.remove('tbk-period-active'));
  if(btn) btn.classList.add('tbk-period-active');
  renderOzet();
}
// Pencere genişliği değişince grafiği gerçek piksel genişliğine göre
// yeniden çiz (viewBox = konteyner genişliği mantığı için gerekli).
export var _tbkResizeT = null;
window.addEventListener('resize', function () {
  clearTimeout(_tbkResizeT);
  _tbkResizeT = setTimeout(function () {
    if (document.getElementById('ozet-tahmin-bakiye') && typeof renderTahminBakiye === 'function') {
      renderTahminBakiye();
    }
  }, 200);
});
