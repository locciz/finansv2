import { saveData, updateSidebarKartNav } from '../../../core/app-core-base.js';
import { fmtCur, fmtCurShort, fmtDate, localDateStr } from '../../../core/format.js';
import { _pushHashState } from '../../../core/init.js';
import { DB } from '../../../core/state.js';
import { calcOdemeTarihi, getExtreDonemi, getKrediKalanBorc } from '../../../domain/hesaplamalar.js';
import { cpsInit, cpsSync } from '../../components/cps-select.js';
import { showConfirm } from '../../components/modal-genel.js';
import { kartAltyapiLogoHtml } from '../../components/select-to-chips.js';
import { _restoreKdIslemSiralamaFromDB } from '../../components/tablo-filtre-sirala.js';
import { calcAsgariOdeme } from '../asgari-odeme.js';
import { EE_STATE } from '../ekstreler/02-ekstre-render.js';
import { bindIslemRowEvents, islemRowHtml } from '../islemler/03-islem-liste-render.js';
import { _kd2AcikExtreDonem, _kd2ActiveTab, _kd2ExtreKatFiltre, _kd2IslemArama, _kd2IslemKatFiltre, _kdAcikExtreDonem, _kdExtreKatFiltre, _kdIslemKatFiltre, _kdKatBarCtx, set_kd2ActiveTab, set_kd2IslemArama, set_kdAcikExtreDonem, set_kdExtreKatFiltre, set_kdIslemKatFiltre, set_kdKatBarCtx } from './00-state.js';
import { editKart, getKart, getKartCurrency, getKartDonemBorcu, getKartDonemParaBirimleri, getKartKullanilabilirLimit, getKartKullanim, getKartToplamLimit, kartAktifDonemBul, kartOdemeTarihiEfektif } from './01-kart-data.js';
import { kdRenderKatBar } from './02-kategori-arama-widget.js';
import { _kdCoreAramaSync, _kdCoreAramaTemizle, _kdCoreSiralamaPersist, _kdCoreSwitchTabToggle, kartDetayGeriDon } from './03-kart-detay-ortak.js';
import { getOrtakGrupKullanim, openOrtakGrupModal } from './07-ortak-limit-grubu.js';
import { _kd2IslemSiralama, _kd2KartId, _kdIslemSiralama, _kdKartId, set_kd2IslemSiralama, set_kdIslemSiralama, set_kdKartId } from './09-kart-altyapi.js';
import { renderKartlar } from './10-kart-liste.js';
import { kdRenderExtreler } from './04-kart-detay-v1.js';
import { odAcPopupKart } from '../odeme/08-popup-giris-noktalari.js';
import { getBanka, getTatilSet } from '../tanimlamalar/01-genel-yardimcilar.js';
import { showPage } from '../../../core/app-core-base.js';
import { register } from '../../../core/wrap-registry.js';
// ============================================================
// js/ui/pages/kartlar/05-kart-detay-v2.js
// Kart Detay sayfası — v2 (tam sayfa görünüm)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/kartlar.js (145
// export, 3600+ satır) dosyasının, fonksiyon isim/işlev
// kümelerine göre bölünmüş bir parçasıdır. Kod SATIR SATIR
// AYNI kaldı — sadece dosya sınırı ve gruplama değişti.
// ============================================================
export function kd2BorcOdeAc() {
  if (!_kd2KartId) return;
  const k = getKart(_kd2KartId);
  if (!k) return;
  const tatilSet = getTatilSet();
  const today = new Date(); today.setHours(0,0,0,0);
  const pb = getKartCurrency(k.id);
  // Kart listesindeki ile aynı mantık: "bu ayın" kesim tarihini doğrudan kullanmak,
  // kesim günü geçtiğinde henüz ödeme tarihi gelmemiş güncel dönemi atlayıp bir sonraki
  // (henüz kesilmemiş, borcu 0 olan) dönemi seçtiriyordu — bu da "Borç Öde" butonunu
  // yanlış (gelecek) döneme açıp güncel borcu "Ödendi" gibi gösteriyordu.
  const _donem = kartAktifDonemBul(k, today, tatilSet);
  const extreDt = _donem.extre;
  // Mevcut dönemin key'ini hesapla (YYYY-MM)
  let donemKey;
  if (extreDt) {
    const pd = getExtreDonemi(k, localDateStr(extreDt));
    if (pd) {
      donemKey = pd.year + '-' + String(pd.month + 1).padStart(2, '0');
    }
  }
  if (!donemKey) {
    donemKey = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  }
  // Sadece GÜNCEL dönemin ekstre borcunu hesapla — getKartKullanim() tüm dönemleri (gelecek
  // taksitler dahil) topladığı için burada kullanılırsa ödeme sonrasında bile gelecek dönem
  // borçları "kalan" gibi görünüyordu. Bunun yerine sadece bu döneme denk gelen taksitler toplanır.
  const pbList = (typeof getKartDonemParaBirimleri === 'function' ? getKartDonemParaBirimleri(k.id, donemKey) : [pb]).filter(Boolean);
  const secilebilirPb = (pbList.length ? pbList : [pb]).map(cur => {
    const borc = getKartDonemBorcu(k.id, donemKey, cur);
    const odenen = (DB.kartOdemeleri||[]).filter(o=>o.kartId===k.id && o.paraBirimi===cur && o.donemKey===donemKey).reduce((s,o)=>s+o.tutar,0);
    return { pb:cur, borc, kalan:Math.max(0, borc-odenen), odenen };
  });
  // Bu buton tek popup açtığı için borcu/kalanı olan gerçek ekstre para birimini seçer.
  // TRY harcama TRY destekleyen kartta USD default'a düşmesin diye varsayılan para birimine değil dönem borcuna bakılır.
  const sec = secilebilirPb.find(x=>x.kalan>0.01) || secilebilirPb.find(x=>x.borc>0.01) || secilebilirPb[0] || {pb,borc:0,kalan:0,odenen:0};
  const odemePb = sec.pb;
  const donemBorcu = sec.borc;
  const odenenTop = sec.odenen;
  const kalanBorc = sec.kalan;
  const odemeDt = _donem.odeme || (extreDt ? calcOdemeTarihi(extreDt, k.odemeSure, k.odemeGunTip, tatilSet) : null);
  const odemeVarsayilan = odemeDt ? localDateStr(odemeDt) : '';
  const odemeEfektif = odemeVarsayilan ? kartOdemeTarihiEfektif(k, donemKey, odemeVarsayilan) : '';
  // 0 borç olsa da izin ver (peşin/erken ödeme)
  odAcPopupKart(k.id, odemePb, donemKey, donemBorcu, kalanBorc, odemeEfektif, true);
}

export function kd2RenderOzetBanner(k, renk) {
  const banner = document.getElementById('kd2-ozet-banner');
  if (!banner) return;
  const tatilSet = getTatilSet();
  const today = new Date(); today.setHours(0,0,0,0);
  const kullanim = getKartKullanim(k.id);
  const musait = getKartKullanilabilirLimit(k.id);
  const toplamLimit = getKartToplamLimit(k.id);
  const pct = toplamLimit > 0 ? Math.min(100, kullanim / toplamLimit * 100) : 0;
  const pctColor = pct > 80 ? 'var(--danger)' : pct > 50 ? 'var(--warn)' : 'var(--accent2)';
  const pb = getKartCurrency(k.id);
  // Kart listesiyle (renderKartlar) tutarlı olması için aynı aktif-dönem bulma mantığı
  // kullanılıyor; aksi halde bu banner kesim gününden sonra bir sonraki (henüz kesilmemiş)
  // dönemi gösterip liste ile tutarsız bir "Son Ödeme" tarihi veriyordu.
  const _donem = kartAktifDonemBul(k, today, tatilSet);
  const extreDt = _donem.extre;
  const odemeDt = _donem.odeme;
  const odemeStr = odemeDt ? localDateStr(odemeDt) : null;
  const kalanGun = odemeStr ? Math.ceil((new Date(odemeStr + 'T00:00:00') - today) / 86400000) : null;
  const odemeUrgent = kalanGun !== null && kalanGun <= 3;
  const odemePast = odemeStr !== null && odemeStr < localDateStr(today);
  const odemeColor = odemePast ? 'var(--danger)' : odemeUrgent ? 'var(--warn)' : 'var(--text)';
  const kalanStr = kalanGun === null ? '' : odemePast ? '⚠️ Geçti!' : kalanGun === 0 ? '🔴 Bugün!' : kalanGun <= 3 ? '⚠️ ' + kalanGun + ' gün kaldı' : kalanGun + ' gün kaldı';

  // Kart görsel (mini kredi kartı)
  const sonanNo = k.no ? ('·· ' + String(k.no).replace(/\s/g,'').slice(-4)) : '·· ····';
  const banka = getBanka(k.banka);
  const tip = (DB.urunTipler || []).find(t => t.id === k.tip);
  const tipAd = tip ? tip.ad : '';
  const cardVisual = `<div class="kd2-card-visual" style="background:linear-gradient(135deg,${renk}dd,${renk}88)">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div class="kd2-card-chip"></div>
      <span class="kd2-pb-chip" style="padding:1px 5px;font-size:7.5px">${pb}</span>
    </div>
    <div>
      <div class="kd2-card-no">${sonanNo}</div>
      <div class="kd2-card-logo">${banka || k.ad}</div>
    </div>
  </div>`;

  // Asgari ödeme
  const asgari = kullanim > 0 ? calcAsgariOdeme(toplamLimit, kullanim, pb) : null;
  const asgariHTML = asgari ? `<div class="kd2-asgari-banner">
    <span style="font-size:13px">💳</span>
    <span class="label">Asgari Ödeme (kural: %${asgari.oran})</span>
    <span class="val">${fmtCur(asgari.tutar, pb)}</span>
  </div>` : '';

  // Ortak limit grubu
  let ortakHTML = '';
  if (k.ortakLimitGrupId) {
    const grup = (DB.ortakLimitGruplari || []).find(g => g.id === k.ortakLimitGrupId);
    if (grup) {
      const grupKullanim = getOrtakGrupKullanim(k.ortakLimitGrupId);
      const grupPct = grup.limit > 0 ? Math.min(100, grupKullanim / grup.limit * 100) : 0;
      const grupKartlar = (DB.kartlar || []).filter(x => x.ortakLimitGrupId === k.ortakLimitGrupId);
      ortakHTML = `<div class="kd2-ortak-grup-bilgi">
        <span style="font-size:12px">🔗</span>
        <span class="og-label">Ortak Limit Grubu: <b style="color:var(--violet)">${grup.ad}</b></span>
        <span class="og-val">${fmtCur(grupKullanim, pb)} / ${fmtCur(grup.limit, pb)}</span>
        <span style="font-size:10px;color:var(--text3)">(${grupKartlar.length} kart)</span>
      </div>`;
    }
  }

  banner.innerHTML = `<div style="background:linear-gradient(135deg, ${renk}14, var(--surface) 55%);border:1px solid var(--border2);border-radius:var(--radius);padding:18px 20px;border-top:3px solid ${renk}">
    <div class="kd2-ozet-grid">
      ${cardVisual}
      <div>
        <div class="kd2-ozet-rakamlar">
          <div class="kd2-ozet-rakam-item is-warn">
            <div class="kd2-ozet-rakam-label">Kullanimda</div>
            <div class="kd2-ozet-rakam-val" style="color:#fbbf24;font-size:16px">${fmtCur(kullanim, pb)}</div>
            <div class="kd2-ozet-rakam-sub">%${pct.toFixed(0)} kullanıldı</div>
          </div>
          <div class="kd2-ozet-rakam-item is-teal">
            <div class="kd2-ozet-rakam-label">Kullanılabilir</div>
            <div class="kd2-ozet-rakam-val" style="color:#10e0a8;font-size:16px">${fmtCur(musait, pb)}</div>
            <div class="kd2-ozet-rakam-sub">Kalan limit</div>
          </div>
          <div class="kd2-ozet-rakam-item is-neutral">
            <div class="kd2-ozet-rakam-label">Toplam Limit</div>
            <div class="kd2-ozet-rakam-val" style="color:var(--text);font-size:16px">${fmtCur(toplamLimit, pb)}</div>
            <div class="kd2-ozet-rakam-sub">${tipAd || 'Kredi Kartı'}</div>
          </div>
          <div class="kd2-ozet-rakam-item ${odemePast || odemeUrgent ? 'is-danger' : 'is-neutral'}">
            <div class="kd2-ozet-rakam-label">Son Ödeme</div>
            <div class="kd2-ozet-rakam-val" style="color:${odemeColor};font-size:15px">${odemeDt ? fmtDate(odemeDt) : '—'}</div>
            <div class="kd2-ozet-rakam-sub" style="color:${odemeColor}">${kalanStr}</div>
          </div>
        </div>
        <div class="progress-bar" style="margin:10px 0 4px"><div class="progress-fill" style="width:${pct}%;background:${pctColor}"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3)">
          <span>Ekstre: ${extreDt ? fmtDate(extreDt) : '—'}</span>
          <span style="color:${pctColor};font-weight:700">%${pct.toFixed(1)} kullanıldı</span>
        </div>
        ${asgariHTML}
        ${ortakHTML}
      </div>
    </div>
  </div>`;

  // Ayarlar ve trend satırını da render et
  kd2RenderAyarlarRow(k, renk, pb, extreDt, toplamLimit);
  kd2RenderTrendRow(k, renk, pb);

  // Kart limitleri (Kullanımda / Kullanılabilir / Toplam limit) yukarıda
  // kartın kendi para birimiyle (pb) yazıldı; burada özellikle TRY'ye
  // çevirip üzerine yazıyoruz — kart limitleri her zaman TRY bazında
  // karşılaştırılıyor.
  try {
    const kdTryKullanim = getKartKullanim(k.id);
    const kdTryMusait = getKartKullanilabilirLimit(k.id);
    const kdTryToplam = getKartToplamLimit(k.id);
    const kdTryFmt = n => (typeof fmtCur === 'function') ? fmtCur(Number(n)||0, 'TRY') : '₺' + (Number(n)||0).toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2});
    const kdTryMap = [['kullanimda', kdTryKullanim], ['kullanılabilir', kdTryMusait], ['toplam limit', kdTryToplam]];
    document.querySelectorAll('#kd2-ozet-banner .kd2-ozet-rakam-item').forEach(item => {
      let lab = (item.querySelector('.kd2-ozet-rakam-label') || {}).textContent || '';
      lab = lab.trim().toLocaleLowerCase('tr-TR');
      const hit = kdTryMap.find(m => lab.indexOf(m[0]) > -1);
      const val = item.querySelector('.kd2-ozet-rakam-val');
      if (hit && val) val.textContent = kdTryFmt(hit[1]);
    });
    document.querySelectorAll('#kd2-ayarlar-row .kd2-ayar-kart').forEach(card => {
      let lab = (card.querySelector('.kd2-ayar-label') || {}).textContent || '';
      lab = lab.toLocaleLowerCase('tr-TR');
      if (lab.indexOf('limit geçmişi') > -1) {
        const val = card.querySelector('.kd2-ayar-val');
        if (val) val.textContent = kdTryFmt(kdTryToplam);
      }
    });
  } catch(e) { console.warn('[kart limit TRY düzeltmesi]', e); }
}

export function kd2RenderAyarlarRow(k, renk, pb, extreDt, toplamLimit) {
  const wrap = document.getElementById('kd2-ayarlar-row');
  if (!wrap) return;
  const banka = getBanka(k.banka);
  const tip = (DB.urunTipler || []).find(t => t.id === k.tip);

  // Ekstre kesim bilgisi
  let ekstreKesimStr = '—';
  if (k.extraTip === 'gun') ekstreKesimStr = 'Her ayın ' + (k.extraGun || 25) + '. günü';
  else if (k.extraTip === 'hafta') {
    const haftaAdlar = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
    ekstreKesimStr = (k.extraHafta || 1) + '. hafta ' + (haftaAdlar[k.extraHaftaGun] || '');
  } else if (k.extraTip === 'statik') ekstreKesimStr = k.extraStatik ? fmtDate(new Date(k.extraStatik + 'T00:00:00')) : '—';

  // Ödeme süresi
  const odemeSure = parseInt(k.odemeSure) || 30;
  const odemeGunTipEtk = {
    'ilerle':'Tatilde ilerle','geri':'Tatilde geri',
    'extre-ilerle':'Ekstre ileri','extre-geri':'Ekstre geri',
    'extre-odeme-ilerle':'Ekstre+ödeme ileri','extre-odeme-geri':'Ekstre+ödeme geri'
  };
  const odemeGunTipStr = odemeGunTipEtk[k.odemeGunTip] || k.odemeGunTip || '—';

  // Limit geçmişi — kaç kez değişti
  const limitGecmis = k.limitGecmisi || [];
  const limitGecmisStr = limitGecmis.length > 0 ? limitGecmis.length + ' değişim' : 'İlk limit';

  // Ekstre/ödeme ayar geçmişi — kaç kez değişti
  const ayarGecmis = k.extraGunGecmis || [];
  const ayarGecmisStr = ayarGecmis.length > 0 ? ayarGecmis.length + ' kayıt' : 'Tek dönem';

  // Para birimi — kart birden fazla destekliyorsa hepsini göster
  const tumParaBirimleri = (k.paraBirimleri && k.paraBirimleri.length) ? k.paraBirimleri : (k.paraBirimi ? [k.paraBirimi] : [pb || 'TRY']);
  const varsayilanPb = k.varsayilanParaBirimi || tumParaBirimleri[0];
  const paraBirimiStr = tumParaBirimleri.length > 1
    ? tumParaBirimleri.map(c => c === varsayilanPb ? c + ' ⭐' : c).join(' · ')
    : (pb || 'TRY');

  // Kart altyapısı (Visa/Mastercard/Troy vb.)
  const altyapi = (DB.kartAltyapilari || []).find(a => a.id === k.altyapiId);

  // KMH/kredi borcu (kart tipi KMH ise)
  const kmhTip = DB.urunTipler.find(t => t.kod === 'KMH');
  const isKmh = kmhTip && k.tip === kmhTip.id;
  const kmhKrediler = isKmh ? (DB.krediler || []).filter(kr => kr.kmhId === k.id && getKrediKalanBorc(kr) > 0) : [];
  const kmhKalanToplam = kmhKrediler.reduce((s, kr) => s + getKrediKalanBorc(kr), 0);

  wrap.innerHTML = `<div style="background:linear-gradient(160deg, var(--surface), rgba(167,139,250,.04));border:1px solid var(--border2);border-radius:var(--radius);padding:14px 16px">
    <div style="font-size:10.5px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px">📋 Kart Bilgileri & Ayarlar</div>
    <div class="kd2-ayarlar-grid">
      <div class="kd2-ayar-kart ayar-c1">
        <div class="kd2-ayar-icon">🗓️</div>
        <div class="kd2-ayar-label">Ekstre Kesim</div>
        <div class="kd2-ayar-val">${ekstreKesimStr}</div>
        <div class="kd2-ayar-sub">${extreDt ? 'Bu ay: ' + fmtDate(extreDt) : '—'}</div>
      </div>
      <div class="kd2-ayar-kart ayar-c2">
        <div class="kd2-ayar-icon">⏱️</div>
        <div class="kd2-ayar-label">Ödeme Süresi</div>
        <div class="kd2-ayar-val">${odemeSure} gün</div>
        <div class="kd2-ayar-sub">${odemeGunTipStr}</div>
      </div>
      <div class="kd2-ayar-kart ayar-c3">
        <div class="kd2-ayar-icon">💱</div>
        <div class="kd2-ayar-label">Para Birimi${tumParaBirimleri.length > 1 ? 'leri' : ''}</div>
        <div class="kd2-ayar-val" style="${tumParaBirimleri.length > 1 ? 'font-size:11px' : ''}">${paraBirimiStr}</div>
        <div class="kd2-ayar-sub">${banka || '—'} · ${tip ? tip.ad : '—'}</div>
      </div>
      <div class="kd2-ayar-kart ayar-c4 kd2-limit-gecmis-toggle" style="cursor:pointer" title="Limit geçmişini göster/gizle">
        <div class="kd2-ayar-icon">📈</div>
        <div class="kd2-ayar-label">Limit Geçmişi</div>
        <div class="kd2-ayar-val">${fmtCur(toplamLimit, pb)}</div>
        <div class="kd2-ayar-sub" style="color:#10e0a8;font-weight:700">${limitGecmisStr} — tıkla ▸</div>
      </div>
      <div class="kd2-ayar-kart ayar-c5">
        <div class="kd2-ayar-icon">🔢</div>
        <div class="kd2-ayar-label">Kart Numarası</div>
        <div class="kd2-ayar-val" style="font-family:var(--mono)">${k.no || '—'}</div>
        <div class="kd2-ayar-sub">${k.ad || '—'}</div>
      </div>
      <div class="kd2-ayar-kart ayar-c6">
        <div class="kd2-ayar-icon">🏷️</div>
        <div class="kd2-ayar-label">Kart Altyapısı</div>
        <div class="kd2-ayar-val" style="display:flex;align-items:center;gap:6px">${kartAltyapiLogoHtml(altyapi) || ''}<span>${altyapi ? altyapi.ad : '—'}</span></div>
        <div class="kd2-ayar-sub">${banka || '—'}</div>
      </div>
      <div class="kd2-ayar-kart ayar-c7 kd2-ayar-gecmis-toggle" style="cursor:pointer" title="Ekstre/ödeme ayar geçmişini göster/gizle">
        <div class="kd2-ayar-icon">🕘</div>
        <div class="kd2-ayar-label">Ekstre/Ödeme Ayar Geçmişi</div>
        <div class="kd2-ayar-val">${ayarGecmisStr}</div>
        <div class="kd2-ayar-sub" style="color:#fb923c;font-weight:700">tıkla ▸</div>
      </div>
      ${isKmh ? `<div class="kd2-ayar-kart ${kmhKrediler.length ? 'ayar-c6' : 'ayar-c4'}">
        <div class="kd2-ayar-icon">🏦</div>
        <div class="kd2-ayar-label">KMH Kredi Borcu</div>
        <div class="kd2-ayar-val" style="color:${kmhKrediler.length ? '#f87171' : 'var(--text)'}">${kmhKrediler.length ? fmtCur(kmhKalanToplam, pb) : 'Borç yok'}</div>
        <div class="kd2-ayar-sub">${kmhKrediler.length} aktif kredi</div>
      </div>` : ''}
    </div>
    <div id="kd2-limit-gecmis-panel" style="display:none;margin-top:10px">
      ${kd2BuildLimitGecmisHTML(k, pb)}
    </div>
    <div id="kd2-ayar-gecmis-panel" style="display:none;margin-top:10px">
      ${kd2BuildAyarGecmisHTML(k)}
    </div>
  </div>`;
  // [ES module] onclick="kd2LimitGecmisToggle()" ve onclick="kd2AyarGecmisToggle()" kaldırıldı.
  const limitToggle = wrap.querySelector('.kd2-limit-gecmis-toggle');
  if (limitToggle) limitToggle.addEventListener('click', () => kd2LimitGecmisToggle());
  const ayarToggle = wrap.querySelector('.kd2-ayar-gecmis-toggle');
  if (ayarToggle) ayarToggle.addEventListener('click', () => kd2AyarGecmisToggle());
}

export function kd2BuildAyarGecmisHTML(k) {
  const gecmis = (k.extraGunGecmis || []).slice().sort((a,b) => b.baslangic.localeCompare(a.baslangic));
  if (!gecmis.length) {
    return `<div style="font-size:12px;color:var(--text3);padding:8px 4px">Ayar değişikliği kaydı yok — kart başından beri aynı ekstre/ödeme kuralını kullanıyor.</div>`;
  }
  const odemeGunTipEtiket = {
    'ilerle': 'Ödeme ileri', 'geri': 'Ödeme geri',
    'extre-ilerle': 'Ekstre ileri (ödeme sabit)', 'extre-geri': 'Ekstre geri (ödeme sabit)',
    'extre-odeme-ilerle': 'Ekstre ileri (ödeme kayar)', 'extre-odeme-geri': 'Ekstre geri (ödeme kayar)'
  };
  const rows = gecmis.map((g, idx) => {
    const isLast = idx === 0;
    const ekstreOzet = g.tip === 'hafta'
      ? `${g.hafta}. hafta / ${['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'][g.haftaGun]}`
      : `Her ayın ${g.gun}. günü`;
    const odemeOzet = (g.odemeSure !== undefined && g.odemeSure !== null)
      ? `${g.odemeSure} gün sonra · ${odemeGunTipEtiket[g.odemeGunTip] || g.odemeGunTip || '-'}`
      : '<span style="color:var(--text3)">(bu kayıttan önce ödeme ayarı tutulmuyordu)</span>';
    return `<div class="kd2-limit-gecmis-satir" style="flex-direction:column;align-items:flex-start;gap:2px">
      <div style="display:flex;align-items:center;justify-content:space-between;width:100%">
        <span class="kd2-limit-gecmis-tarih" style="color:var(--text);font-weight:600">${g.baslangic === '2000-01' ? 'Başından beri' : g.baslangic}</span>
        ${isLast ? '<span class="kd2-limit-gecmis-badge ilk">▶ Güncel</span>' : ''}
      </div>
      <div style="color:var(--text2);font-size:11px">🗓️ ${ekstreOzet}</div>
      <div style="color:var(--text2);font-size:11px">💳 ${odemeOzet}</div>
    </div>`;
  }).join('');
  return `<div class="kd2-limit-gecmis">${rows}</div>`;
}

export function kd2AyarGecmisToggle() {
  const p = document.getElementById('kd2-ayar-gecmis-panel');
  if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

export function kd2BuildLimitGecmisHTML(k, pb) {
  const gecmis = (k.limitGecmisi || []).slice().sort((a,b) => b.tarih.localeCompare(a.tarih));
  if (!gecmis.length) {
    return `<div style="font-size:12px;color:var(--text3);padding:8px 4px">Limit geçmişi kaydı yok — ilk limit ${fmtCur(k.limit||0, pb)}</div>`;
  }
  const rows = gecmis.map((g, idx) => {
    const sonraki = gecmis[idx + 1];
    let badge = '';
    if (!sonraki) badge = '<span class="kd2-limit-gecmis-badge ilk">İlk</span>';
    else if (g.tutar > sonraki.tutar) badge = `<span class="kd2-limit-gecmis-badge artti">▲ +${fmtCur(g.tutar - sonraki.tutar, pb)}</span>`;
    else if (g.tutar < sonraki.tutar) badge = `<span class="kd2-limit-gecmis-badge azaldi">▼ -${fmtCur(sonraki.tutar - g.tutar, pb)}</span>`;
    else badge = '<span class="kd2-limit-gecmis-badge" style="background:var(--surface3)">—</span>';
    return `<div class="kd2-limit-gecmis-satir">
      <span class="kd2-limit-gecmis-tarih">${g.tarih}</span>
      <span class="kd2-limit-gecmis-tutar">${fmtCur(g.tutar, pb)}</span>
      ${badge}
    </div>`;
  }).join('');
  return `<div class="kd2-limit-gecmis">${rows}</div>`;
}

export function kd2LimitGecmisToggle() {
  const p = document.getElementById('kd2-limit-gecmis-panel');
  if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

export function kd2RenderTrendRow(k, renk, pb) {
  const wrap = document.getElementById('kd2-trend-row');
  if (!wrap) return;
  const today = new Date(); today.setHours(0,0,0,0);
  // Son 6 ayın aylık harcama toplamları
  const aylar = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    aylar.push({ y: d.getFullYear(), m: d.getMonth(), key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') });
  }
  const kartIslemler = DB.islemler.filter(is => is.kart === k.id);
  const ayToplam = {};
  aylar.forEach(a => { ayToplam[a.key] = 0; });
  kartIslemler.forEach(is => {
    const key = is.tarih ? is.tarih.slice(0, 7) : null;
    if (key && ayToplam.hasOwnProperty(key) && (is.tutar || 0) > 0) {
      ayToplam[key] += is.tutar;
    }
  });
  const vals = aylar.map(a => ayToplam[a.key] || 0);
  const maxVal = Math.max(...vals, 1);
  const AY_K = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

  // Bar chart HTML
  const barHTML = aylar.map((a, idx) => {
    const v = vals[idx];
    const h = Math.max(4, Math.round((v / maxVal) * 60));
    const isThisMonth = a.key === (today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0'));
    const barColor = isThisMonth ? renk : '#818cf8';
    const valStr = v > 0 ? fmtCurShort(v, pb) : '—';
    return `<div class="kd2-bar-col">
      <div class="kd2-bar-val">${v > 0 ? valStr : ''}</div>
      <div class="kd2-bar-fill" style="height:${h}px;background:${barColor};color:${barColor};opacity:${isThisMonth?1:.8}"></div>
      <div class="kd2-bar-lbl" style="font-weight:${isThisMonth?700:400};color:${isThisMonth?'var(--text2)':'var(--text3)'}">${AY_K[a.m]}</div>
    </div>`;
  }).join('');

  // Toplam ve ortalama hesapla
  const toplamHarcama = vals.reduce((s, v) => s + v, 0);
  const aktifAy = vals.filter(v => v > 0).length || 1;
  const ortHarcama = toplamHarcama / aktifAy;

  // Son ay ekstresi özeti için işlem sayıları
  const buAyKey = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  const buAyIslemler = kartIslemler.filter(is => is.tarih && is.tarih.slice(0,7) === buAyKey);
  const buAyGider = buAyIslemler.filter(i => (i.tutar||0) > 0).reduce((s,i) => s + i.tutar, 0);
  const buAyIade = buAyIslemler.filter(i => (i.tutar||0) < 0).reduce((s,i) => s + Math.abs(i.tutar), 0);
  const buAyTaksitli = buAyIslemler.filter(i => (i.taksit||1) > 1).length;

  wrap.innerHTML = `<div class="kd2-trend-grid">
    <div class="kd2-grafik-kart is-trend">
      <div class="kd2-grafik-baslik">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        6 Aylık Harcama Trendi
      </div>
      <div class="kd2-bar-chart">${barHTML}</div>
      <div style="display:flex;gap:12px;margin-top:10px;flex-wrap:wrap">
        <div style="font-size:10px;color:var(--text3)">6 ay toplam: <b style="color:#a78bfa;font-family:var(--mono)">${fmtCur(toplamHarcama, pb)}</b></div>
        <div style="font-size:10px;color:var(--text3)">Aylık ort: <b style="color:#a78bfa;font-family:var(--mono)">${fmtCur(ortHarcama, pb)}</b></div>
      </div>
    </div>
    <div class="kd2-grafik-kart is-ozet">
      <div class="kd2-grafik-baslik">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
        Bu Ay Özeti
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:11.5px;color:var(--text2)">💸 Toplam Harcama</span>
          <span style="font-family:var(--mono);font-weight:800;font-size:13px;color:#fb7185">${buAyGider > 0 ? fmtCur(buAyGider, pb) : '—'}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:11.5px;color:var(--text2)">↩️ İade / Eksi</span>
          <span style="font-family:var(--mono);font-weight:800;font-size:13px;color:#10e0a8">${buAyIade > 0 ? fmtCur(buAyIade, pb) : '—'}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:11.5px;color:var(--text2)">📦 İşlem Sayısı</span>
          <span style="font-family:var(--mono);font-weight:800;font-size:13px;color:#38bdf8">${buAyIslemler.length} adet</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:11.5px;color:var(--text2)">🔢 Taksitli İşlem</span>
          <span style="font-family:var(--mono);font-weight:800;font-size:13px;color:#fb923c">${buAyTaksitli > 0 ? buAyTaksitli + ' adet' : '—'}</span>
        </div>
        <div style="border-top:1px solid var(--border);margin-top:2px;padding-top:8px;display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:11.5px;color:var(--text2)">📊 Net (harcama-iade)</span>
          <span style="font-family:var(--mono);font-weight:800;font-size:13px;color:${buAyGider-buAyIade > 0 ? '#fb7185' : '#10e0a8'}">${fmtCur(buAyGider - buAyIade, pb)}</span>
        </div>
      </div>
    </div>
  </div>`;
}

export function kd2ToggleMoreMenu() {
  const menu = document.getElementById('kd2-more-menu');
  if (!menu) return;
  const isOpen = menu.style.display !== 'none';
  menu.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    // Dışarı tıklanınca kapat
    setTimeout(() => {
      function outsideClick(e) {
        const wrap = document.querySelector('.kd2-action-menu-wrap');
        if (wrap && !wrap.contains(e.target)) {
          menu.style.display = 'none';
          document.removeEventListener('click', outsideClick);
        }
      }
      document.addEventListener('click', outsideClick);
    }, 10);
  }
}

export function kd2DeleteKartFromDetay() {
  const id = _kd2KartId;
  if (!id) return;
  document.getElementById('kd2-more-menu').style.display = 'none';
  showConfirm('Bu kartı silmek istiyor musunuz? Tüm işlemler de silinecek.', () => {
    kartDetayGeriDon();
    DB.kartlar = DB.kartlar.filter(k => k.id !== id);
    saveData();
    renderKartlar();
    updateSidebarKartNav();
  });
}

export function kd2LimitGuncelleFromDetay() {
  const id = _kd2KartId;
  if (!id) return;
  document.getElementById('kd2-more-menu').style.display = 'none';
  const kart = DB.kartlar.find(k => k.id === id);
  // Kart ortak limit grubuna bağlıysa kart modalındaki limit alanı salt-okunur olur —
  // gerçek değişiklik için doğrudan ortak grup limit modalını açıyoruz.
  if (kart && kart.ortakLimitGrupId) {
    openOrtakGrupModal(kart.ortakLimitGrupId);
  } else {
    editKart(id, true);
  }
}

export function kd2EslestirAc() {
  const id = _kd2KartId;
  if (!id) return;
  document.getElementById('kd2-more-menu').style.display = 'none';
  EE_STATE._pendingKartId = id;
  showPage('ekstreeslestir');
}

export function kd2SwitchTab(tab) {
  set_kd2ActiveTab(tab);
  _kdCoreSwitchTabToggle('kd2', tab);
  // Hash'e kart + tab bilgisini yaz (sadece kd2KartId varsa)
  if (_kd2KartId) _pushHashState('kartlar', {kart: _kd2KartId, tab: tab});
  if (tab === 'islem') kd2RenderIslemler();
  else kd2RenderExtreler();
}

export function kd2RenderIslemler() {
  if (!_kd2KartId) return;
  _restoreKdIslemSiralamaFromDB();
  const list = document.getElementById('kd2-islem-list');
  const statsWrap = document.getElementById('kd2-mini-stats');
  const katBarWrap = document.getElementById('kd2-kat-bar');
  if (!list) return;
  const tumIslemler = DB.islemler.filter(function(i) { return i.kart === _kd2KartId; });
  const islemBadgeEl = document.getElementById('kd2-tab-badge-islem');
  if (islemBadgeEl) islemBadgeEl.textContent = tumIslemler.length;
  if (statsWrap) {
    const count = tumIslemler.length;
    if (!count) { statsWrap.innerHTML = ''; }
    else {
      const pb = getKartCurrency(_kd2KartId);
      let harcama = 0, gelir = 0;
      tumIslemler.forEach(function(i) { const v = i.tutar || 0; if (v < 0) gelir += Math.abs(v); else harcama += v; });
      const ort = (harcama + gelir) / count;
      statsWrap.innerHTML = '<div class="kd-mini-stats">'
        + '<div class="kd-mini-stat accent"><div class="kd-mini-stat-label">Islem</div><div class="kd-mini-stat-val">' + count + ' adet</div><div class="kd-mini-stat-sub">Ort. ' + fmtCur(ort, pb) + '</div></div>'
        + '<div class="kd-mini-stat danger"><div class="kd-mini-stat-label">Harcama</div><div class="kd-mini-stat-val">' + fmtCur(harcama, pb) + '</div><div class="kd-mini-stat-sub">Gider islemleri</div></div>'
        + '<div class="kd-mini-stat teal"><div class="kd-mini-stat-label">Gelir / Iade</div><div class="kd-mini-stat-val">' + (gelir > 0 ? fmtCur(gelir, pb) : '&#x2014;') + '</div><div class="kd-mini-stat-sub">Iade / Eksi islemler</div></div>'
        + '</div>';
    }
  }
  if (katBarWrap) {
    const _prevKartId = _kdKartId; set_kdKartId(_kd2KartId);
    const _prevKatFiltre = _kdIslemKatFiltre; set_kdIslemKatFiltre(_kd2IslemKatFiltre);
    set_kdKatBarCtx('kd2-islem');
    kdRenderKatBar(katBarWrap, tumIslemler);
    set_kdKartId(_prevKartId);
    set_kdIslemKatFiltre(_prevKatFiltre);
  }
  const aramaInput = document.getElementById('kd2-islem-arama');
  if (aramaInput && aramaInput.value !== _kd2IslemArama) aramaInput.value = _kd2IslemArama;
  const temizleBtn = document.getElementById('kd2-islem-arama-temizle');
  if (temizleBtn) temizleBtn.style.display = _kd2IslemArama ? 'flex' : 'none';
  const siraSelect = document.getElementById('kd2-islem-sirala');
  if (siraSelect) {
    if (siraSelect.value !== _kd2IslemSiralama) siraSelect.value = _kd2IslemSiralama;
    if (!siraSelect._cpsOpts) cpsInit('kd2-islem-sirala', { alignRight: true });
    else cpsSync('kd2-islem-sirala');
  }
  let filtered = tumIslemler.filter(function(i) {
    if (_kd2IslemKatFiltre && i.kategori !== _kd2IslemKatFiltre) return false;
    if (_kd2IslemArama) {
      const q = _kd2IslemArama.toLowerCase();
      const kat = (DB.kategoriler || []).find(function(x) { return x.id === i.kategori; });
      if (!(i.aciklama || '').toLowerCase().includes(q) && !(kat && kat.ad.toLowerCase().includes(q))) return false;
    }
    return true;
  });
  const sira = _kd2IslemSiralama;
  filtered.sort(function(a, b) {
    if (sira === 'tarih-eski') return a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : 0;
    if (sira === 'tutar-yuksek') return Math.abs(b.tutar) - Math.abs(a.tutar);
    if (sira === 'tutar-dusuk') return Math.abs(a.tutar) - Math.abs(b.tutar);
    return a.tarih < b.tarih ? 1 : a.tarih > b.tarih ? -1 : 0;
  });
  if (!tumIslemler.length) {
    list.innerHTML = '<div class="islem-empty"><div class="islem-empty-title">Bu kartta islem yok</div><div class="islem-empty-sub">Yeni islem ekleyebilirsiniz</div></div>';
    return;
  }
  if (!filtered.length) {
    list.innerHTML = '<div class="islem-empty"><div class="islem-empty-title">Sonuc bulunamadi</div><div class="islem-empty-sub">Arama veya filtreyi degistirin</div></div>';
    return;
  }
  // Aylık akordeon yok — basit, düz bir liste (her satır kendi tarih kartını taşıyor)
  list.innerHTML = filtered.map(function(i) { return islemRowHtml(i); }).join('');
  // [ES module] islemRowHtml paylaşılan bir render yardımcısıdır - onun ürettiği
  // sınıflara bindIslemRowEvents ile (03-islem-liste-render.js'de tanımlı,
  // paylaşılan) gerçek addEventListener bağlanıyor.
  bindIslemRowEvents(list);
}

// [KALDIRILDI] kd2ToggleIslemAy(key) — kdToggleIslemAy'in v2 karşılığı, aynı
// sebeple ölü (ölü kod taraması, 2026-07).

export function kd2IslemAramaDegisti(val) {
  set_kd2IslemArama(val);
  _kdCoreAramaSync('kd2', val, kd2RenderIslemler);
}

export function kd2IslemAramaTemizle() {
  set_kd2IslemArama('');
  _kdCoreAramaTemizle('kd2', kd2RenderIslemler);
}

export function kd2IslemSiralamaDegisti(val) {
  set_kd2IslemSiralama(val);
  set_kdIslemSiralama(val || 'tarih-yeni');
  _kdCoreSiralamaPersist();
  kd2RenderIslemler();
}

export function kd2RenderExtreler() {
  if (!_kd2KartId) return;
  const wrap = document.getElementById('kd2-extre-list');
  if (!wrap) return;
  const _prev = _kdKartId;
  const _prevDonem = _kdAcikExtreDonem;
  const _prevExtreKatFiltre = _kdExtreKatFiltre;
  set_kdKartId(_kd2KartId);
  set_kdAcikExtreDonem(_kd2AcikExtreDonem);
  set_kdExtreKatFiltre(_kd2ExtreKatFiltre);
  const origGet = document.getElementById.bind(document);
  document.getElementById = function(id) {
    if (id === 'kd-extre-list') return wrap;
    if (id === 'kd-tab-badge-extre') return origGet('kd2-tab-badge-extre') || { textContent: '' };
    if (id === 'kd-extre-kat-bar') return origGet('kd2-extre-kat-bar');
    return origGet(id);
  };
  try { kdRenderExtreler(); } finally { document.getElementById = origGet; }
  set_kdKartId(_prev);
  set_kdAcikExtreDonem(_prevDonem);
  set_kdExtreKatFiltre(_prevExtreKatFiltre);
}

// [ES module] taban render fonksiyonu(ları) odeme/patches zincirinin
// hook() ile sarmalayabilmesi için wrap-registry'ye kaydediliyor.
register('kd2RenderIslemler', kd2RenderIslemler);
