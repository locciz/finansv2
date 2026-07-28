import { isIsBgunu, nextIsBgunu } from '@core/date-utils.js';
import { fmt, fmtDate, fmtMoneyCustom, localDateStr, parseTutarStr } from '@core/format.js';
import { DB, FORMAT_CONFIG } from '@core/state.js';
import { _krediMetrik, _krediTaksitOdendiMi, getBireyselKrediTaksitler, getKrediTaksitler } from '@domain/hesaplamalar.js';
import { bindMoneyInputs } from '@components/money-input.js';
import { resetTekTaksit } from '@pages/islemler/02-islem-form-degisiklikleri.js';
import { _KREDI_DURUM_ETIKET } from '@pages/krediler/00-state.js';
import { calcKmhKredi, getKmhHesap } from '@pages/krediler/03-kmh-kredi.js';
import { calcKredi } from '@pages/krediler/04-bireysel-kredi.js';
import { odBadgeHtml } from '@pages/odeme/01-genel-yardimcilar.js';
import { getTatilSet, tanimRenkAl } from '@pages/tanimlamalar/01-genel-yardimcilar.js';
// ============================================================
// js/ui/pages/krediler/01-genel-yardimcilar.js
// Genel yardımcılar — taksit planı render/hesap yardımcıları, kredi kartı bileşeni
//
// Bu dosya, eskiden tek parça olan js/ui/pages/krediler.js
// (87 export, 1700+ satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function krediTipiRenk(tur) {
  const liste = (DB.krediTipleri || []).slice();
  ['ihtiyac','konut','tasit','diger'].forEach(kod => {
    if (!liste.some(x => x.id === kod)) liste.push({ id: kod });
  });
  const t = liste.find(x => x.id === tur);
  return tanimRenkAl(liste, tur, t && t.renk);
}

export function _krediTaksitPlanUygula(baseTaksitler, kr) {
  const overrides = kr.taksitOverrides || {};
  // "Sonraki taksitleri de ötele" işaretlendiğinde kaydırılan tarihler de
  // kredinin kendi tatil/iş günü kuralına (odemeGunTip) tabi olmalı — aksi
  // hâlde kümülatif gün farkı bir hafta sonuna/resmi tatile denk gelirse
  // taksit planı banka mantığına aykırı bir günde kalırdı.
  const tatilSet = kr.odemeGunTip ? getTatilSet() : null;
  let kumulatifGun = 0;
  return baseTaksitler.map(t => {
    let tarih = t.tarih;
    if (kumulatifGun !== 0) {
      const d = new Date(tarih + 'T00:00:00');
      d.setDate(d.getDate() + kumulatifGun);
      if (kr.odemeGunTip && tatilSet) {
        tarih = localDateStr(nextIsBgunu(d, tatilSet, kr.odemeGunTip !== 'geri'));
      } else {
        tarih = localDateStr(d);
      }
    }
    const ov = overrides[t.no];
    if (ov && ov.yeniTarih) {
      const fark = Math.round((new Date(ov.yeniTarih + 'T00:00:00') - new Date(tarih + 'T00:00:00')) / 86400000);
      tarih = ov.yeniTarih;
      if (ov.sonrakileriOtele) kumulatifGun += fark; // sadece işaretliyse sonrakilere yansı
    }
    return { no: t.no, tarih, tutar: t.tutar };
  });
}

export function renderKrediTaksitPlani(tip, ilkTarih, vade, aylikTaksit, preserveManuel, odemeGunTip) {
  const prefix = tip === 'kmh' ? 'kmhkredi' : 'kredi';
  const container = document.getElementById(prefix + '-taksit-plani');
  const rowsEl = document.getElementById(prefix + '-taksit-rows');
  if(!container || !rowsEl) return;

  let mevcutTaksitler = [];
  if(preserveManuel) mevcutTaksitler = readManuelTaksitler(tip, vade) || [];

  const aylikStr = parseFloat(aylikTaksit.toFixed(2));

  // Taksit verilerini hazırla
  const taksitData = [];
  for(let i=0; i<vade; i++) {
    let tarih, tutar;
    if(preserveManuel && mevcutTaksitler[i]) {
      tarih = mevcutTaksitler[i].tarih;
      tutar = mevcutTaksitler[i].tutar;
    } else {
      const dt = new Date(ilkTarih+'T00:00:00');
      dt.setMonth(dt.getMonth()+i);
      if(odemeGunTip && (odemeGunTip === 'ilerle' || odemeGunTip === 'geri')) {
        const tatilSet = getTatilSet();
        if(!isIsBgunu(dt, tatilSet)) {
          const shifted = nextIsBgunu(dt, tatilSet, odemeGunTip !== 'geri');
          tarih = localDateStr(shifted);
        } else {
          tarih = localDateStr(dt);
        }
      } else {
        tarih = localDateStr(dt);
      }
      tutar = aylikStr;
    }
    taksitData.push({ tarih, tutar });
  }

  _taksitPlaniRowsRender(tip, container, rowsEl, taksitData, aylikStr);
}

export function renderKrediTaksitPlaniEfektif(tip, kr, aylikTaksit) {
  const prefix = tip === 'kmh' ? 'kmhkredi' : 'kredi';
  const container = document.getElementById(prefix + '-taksit-plani');
  const rowsEl = document.getElementById(prefix + '-taksit-rows');
  if(!container || !rowsEl) return;
  const efektif = tip === 'kmh' ? getKrediTaksitler(kr) : getBireyselKrediTaksitler(kr);
  const aylikStr = parseFloat(aylikTaksit.toFixed(2));
  const taksitData = efektif.map(t => ({ tarih: t.tarih, tutar: t.tutar }));
  _taksitPlaniRowsRender(tip, container, rowsEl, taksitData, aylikStr);
}

export function _krediFiltreBaslikGuncelle(elId, durumSecili) {
  const el = document.getElementById(elId);
  if(!el) return;
  el.textContent = durumSecili.length ? ' — ' + durumSecili.map(d => _KREDI_DURUM_ETIKET[d] || d).join(' + ') : '';
}

export function _krediTurEtiket(tur) {
  const turLabel = {}; (DB.krediTipleri||[]).forEach(t => { turLabel[t.id] = t.ad; });
  turLabel['ihtiyac']='İhtiyaç'; turLabel['konut']='Konut'; turLabel['tasit']='Taşıt'; turLabel['diger']='Diğer';
  return turLabel[tur] || tur;
}

export function _krediOdemeBtn(tip, kr, t, todayStr, extraLabel) {
  const ov = (kr.taksitOverrides || {})[t.no] || null;
  const efektifDurum = ov ? ov.durum : (t.tarih < todayStr ? 'odendi' : null);
  const badge = odBadgeHtml(efektifDurum, t.tarih, t.tutar);
  const enc = encodeURIComponent(JSON.stringify({tip, id: kr.id, key: t.no, tarih: t.tarih||'', tutar: t.tutar||0, extraLabel: extraLabel||''}));
  return `<span class="od-btn" data-od="${enc}" style="cursor:pointer">${badge}</span>`;
}

export function _taksitPlaniRowsRender(tip, container, rowsEl, taksitData, aylikStr) {
  const todayStr = localDateStr(new Date());
  const vade = taksitData.length;
  const toplamTutar = taksitData.reduce((s,t) => s + t.tutar, 0);

  let rows = taksitData.map((t, i) => {
    const isPast = t.tarih < todayStr;
    const isModified = (Math.abs(t.tutar - aylikStr) > 0.01);
    const tutarDisplay = fmtMoneyCustom(t.tutar, 2, FORMAT_CONFIG.ondalikAyrac||',', FORMAT_CONFIG.binlikAyrac??'.');
    return `<div class="tp-row${isPast ? ' tp-past' : ''}">
      <div class="tp-no">${i+1}</div>
      <input type="date" class="tp-input" value="${t.tarih}" data-date-compact="1"
        data-taksit-tip="${tip}" data-taksit-idx="${i}" data-taksit-field="tarih"
        onchange="onTaksitChange(this, '${tip}', ${i}, 'tarih')">
      <div class="tp-donem" data-taksit-idx="${i}" data-taksit-tip="${tip}">${t.tarih ? (()=>{ const d=new Date(t.tarih+'T00:00:00'); return d.toLocaleDateString('tr-TR',{month:'short',year:'numeric'}); })() : '—'}</div>
      <input type="text" inputmode="decimal" id="${tip}-tak-tutar-${i}" class="tp-input tp-input-tutar money-input${isModified ? ' tp-modified' : ''}" value="${tutarDisplay}" data-decimals="2"
        data-taksit-tip="${tip}" data-taksit-idx="${i}" data-taksit-field="tutar"
        oninput="onTaksitChange(this, '${tip}', ${i}, 'tutar')" data-orig="${aylikStr}">
      <button class="tp-del tp-reset-btn" title="Bu taksiti standarda sıfırla" data-taksit-tip="${tip}" data-taksit-idx="${i}" data-taksit-tarih="${t.tarih}" data-orig="${aylikStr}">↺</button>
    </div>`;
  }).join('');

  rowsEl.innerHTML = `
    <div class="tp-wrap">
      <div class="tp-header">
        <div>#</div><div>Tarih</div><div>Dönem</div><div style="text-align:right">Tutar</div><div></div>
      </div>
      ${rows}
      <div class="tp-footer">
        <span style="color:var(--text3)">Toplam: <span style="color:var(--text);font-family:var(--mono);font-weight:600">${fmt(toplamTutar)}</span>  <span style="color:var(--text3);font-size:10px">(${vade} taksit × ort. ${fmt(toplamTutar/vade)})</span></span>
        <button class="btn btn-ghost btn-sm tp-reset-all-btn" data-taksit-tip="${tip}">↺ Tümünü Sıfırla</button>
      </div>
    </div>`;
  container.style.display = 'block';
  bindMoneyInputs(rowsEl);
  // [ES module] onclick="resetTekTaksit(this,...)" ve onclick="resetKmhTaksitler/resetKrediTaksitler()"
  // kaldırıldı - gerçek addEventListener bağlanıyor.
  rowsEl.querySelectorAll('.tp-reset-btn').forEach(btn => {
    btn.addEventListener('click', () => resetTekTaksit(btn, btn.getAttribute('data-taksit-tip'), Number(btn.getAttribute('data-taksit-idx')), btn.getAttribute('data-taksit-tarih'), Number(btn.getAttribute('data-orig'))));
  });
  rowsEl.querySelectorAll('.tp-reset-all-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.getAttribute('data-taksit-tip') === 'kmh') resetKmhTaksitler();
      else resetKrediTaksitler();
    });
  });
}

export function onTaksitChange(el, tip, idx, field) {
  if(field === 'tarih') {
    // Dönem hücresini güncelle
    const row = el.closest('.tp-row');
    const donemEl = row ? row.querySelector('.tp-donem') : null;
    if(donemEl && el.value) {
      const d = new Date(el.value + 'T00:00:00');
      donemEl.textContent = d.toLocaleDateString('tr-TR', {month:'short', year:'numeric'});
    } else if(donemEl) {
      donemEl.textContent = '—';
    }
  }
  if(field === 'tutar') {
    const orig = parseFloat(el.dataset.orig) || 0;
    const val = parseTutarStr(el.value) || 0;
    if(Math.abs(val - orig) > 0.01) el.classList.add('tp-modified');
    else el.classList.remove('tp-modified');
    // Toplam güncelle
    const prefix = tip === 'kmh' ? 'kmhkredi' : 'kredi';
    const rowsEl = document.getElementById(prefix + '-taksit-rows');
    if(rowsEl) {
      const inputs = rowsEl.querySelectorAll('[data-taksit-field="tutar"]');
      let toplam = 0;
      inputs.forEach(inp => toplam += parseTutarStr(inp.value)||0);
      const footer = rowsEl.querySelector('.tp-footer span');
      if(footer) {
        const n = inputs.length;
        footer.innerHTML = `Toplam: <span style="color:var(--text);font-family:var(--mono);font-weight:600">${fmt(toplam)}</span>  <span style="color:var(--text3);font-size:10px">(${n} taksit × ort. ${fmt(toplam/n)})</span>`;
      }
    }
  }
}

export function readManuelTaksitler(tip, vade) {
  const prefix = tip === 'kmh' ? 'kmhkredi' : 'kredi';
  const rowsEl = document.getElementById(prefix + '-taksit-rows');
  if(!rowsEl) return null;
  const tarihInputs = rowsEl.querySelectorAll('[data-taksit-field="tarih"]');
  const tutarInputs = rowsEl.querySelectorAll('[data-taksit-field="tutar"]');
  if(tarihInputs.length !== vade) return null;
  const result = [];
  for(let i=0; i<vade; i++) {
    result.push({
      tarih: tarihInputs[i].value,
      tutar: parseTutarStr(tutarInputs[i].value)||0
    });
  }
  return result;
}

export function resetKmhTaksitler() {
  calcKmhKredi(false);
}

export function resetKrediTaksitler() {
  calcKredi(false);
}

export function _renderKrediKart(kr, tip, todayStr) {
  const { taksitler, kalan, odenmisSayisi, bitti, sonTarih } = _krediMetrik(kr, tip, todayStr);
  const ilerleme = kr.vade > 0 ? Math.round((odenmisSayisi / kr.vade) * 100) : 0;
  const toplamFaiz = (kr.toplamBorc || 0) - kr.anaPara;
  const faizOrani = kr.anaPara > 0 ? ((toplamFaiz / kr.anaPara) * 100).toFixed(1) : '0';

  let baslik = '', bankaLabel = '';
  if(tip === 'kmh') {
    const kmhKart = getKmhHesap(kr.kmhId);
    const bk = kmhKart ? (DB.bankalar||[]).find(b=>b.id===kmhKart.banka) : null;
    baslik = kmhKart ? (bk ? bk.kisa + ' · ' : '') + kmhKart.ad : 'KMH Kredisi';
    bankaLabel = bk ? bk.kisa : '';
  } else {
    const bk = (DB.bankalar||[]).find(b=>b.id===kr.banka);
    baslik = kr.aciklama || _krediTurEtiket(kr.tur);
    bankaLabel = bk ? bk.kisa : '';
  }

  const statusColor = bitti ? 'var(--teal)' : kalan > kr.anaPara * 0.7 ? 'var(--danger)' : 'var(--warn)';
  const statusBg   = bitti ? 'rgba(45,212,191,.12)' : kalan > kr.anaPara * 0.7 ? 'rgba(251,113,133,.12)' : 'rgba(251,146,60,.12)';
  const statusTxt  = bitti ? 'Tamamlandı' : `${kr.vade - odenmisSayisi} taksit kaldı`;

  // Yaklaşan taksitler (henüz fiilen ödenmemiş olanlar — sadece tarihe değil, override'a bakar)
  const gelecek = taksitler.filter(t => !_krediTaksitOdendiMi(kr, t, todayStr));
  const gorunecek = gelecek.slice(0, 6);
  const kalanGizli = gelecek.length - gorunecek.length;

  const uid_kart = 'kk_' + (kr.id || Math.random().toString(36).slice(2));

  const taksitHtml = taksitler.map(t => {
    const odendiMi = _krediTaksitOdendiMi(kr, t, todayStr);
    const gecmisTarihli = t.tarih < todayStr;
    const gecikmis = gecmisTarihli && !odendiMi; // vadesi geçmiş ama fiilen ödenmemiş
    const buAy   = t.tarih.slice(0,7) === todayStr.slice(0,7);
    const rowCls  = odendiMi ? 'gecmis' : gecikmis ? 'gecikmis' : buAy ? 'bu-ay' : '';
    const noCls   = odendiMi ? 'gecmis-no' : gecikmis ? 'gecikmis-no' : buAy ? 'bu-ay-no' : 'gelecek-no';
    const donem   = (()=>{ const d=new Date(t.tarih+'T00:00:00'); return d.toLocaleDateString('tr-TR',{month:'short',year:'2-digit'}); })();
    // Durum her zaman değiştirilebilir — vadesi geçmiş taksit de dahil (aksi hâlde
    // "ödendi" işaretlemek isteyen kullanıcı tıklayacak bir şey bulamıyordu).
    const odemeBtn = _krediOdemeBtn(tip==='kmh'?'kmh':'kredi', kr, t, todayStr, baslik+' #'+t.no);
    return `<div class="kredi-taksit-row ${rowCls}" data-kart="${uid_kart}">
      <div class="kredi-taksit-no ${noCls}">${t.no}</div>
      <div class="mono" style="font-size:11px;color:var(--text2)">${fmtDate(t.tarih)}</div>
      <div style="font-size:10px;color:var(--text3)">${donem}</div>
      <div style="font-size:10px;color:var(--text3)">${t.no}/${kr.vade}</div>
      <div class="mono" style="font-weight:700;color:${odendiMi?'var(--text3)':gecikmis?'var(--danger)':buAy?'var(--gold)':'var(--warn)'}">₺${t.tutar.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      <div>${odemeBtn}</div>
    </div>`;
  }).join('');

  return `<div class="kredi-kart" style="border-left:3px solid ${statusColor}">
    <div class="kredi-kart-header">
      <div class="kredi-kart-title">
        <span class="kredi-kart-icon" style="background:${statusBg};color:${statusColor}">${tip==='kmh'?'🏦':'💳'}</span>
        <div>
          <div>${baslik}</div>
          ${bankaLabel ? `<div style="font-size:11px;font-weight:400;color:var(--text3);margin-top:1px">${bankaLabel}</div>` : ''}
          ${tip!=='kmh' ? (()=>{ const r = krediTipiRenk(kr.tur); return `<span class="badge" style="margin-top:3px;background:${r}1f;color:${r};border:1px solid ${r}55">${_krediTurEtiket(kr.tur)}</span>`; })() : ''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="kredi-kart-badge" style="background:${statusBg};color:${statusColor}">${statusTxt}</span>
        <button class="btn btn-ghost btn-sm btn-act kredi-kart-edit-btn" data-tip="${tip}" data-id="${kr.id}" style="margin-right:4px"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:block"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/></svg></button>
        <button class="btn btn-danger btn-sm btn-act kredi-kart-delete-btn" data-tip="${tip}" data-id="${kr.id}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:block"><polyline points="3,5 13,5"/><path d="M6 5V3h4v2M5 5l1 9h4l1-9"/></svg></button>
      </div>
    </div>

    <div class="kredi-kart-meta">
      <div class="kredi-kart-meta-item" style="padding-left:0">
        <div class="kredi-kart-meta-label">Ana Para</div>
        <div class="kredi-kart-meta-val">${fmt(kr.anaPara)}</div>
      </div>
      <div class="kredi-kart-meta-item" style="padding-left:16px">
        <div class="kredi-kart-meta-label">Aylık Taksit</div>
        <div class="kredi-kart-meta-val" style="color:var(--warn)">${fmt(kr.aylikTaksit)}</div>
      </div>
      <div class="kredi-kart-meta-item" style="padding-left:16px">
        <div class="kredi-kart-meta-label">Toplam Faiz</div>
        <div class="kredi-kart-meta-val" style="color:var(--danger)">${fmt(toplamFaiz)} <span style="font-size:10px;color:var(--text3);font-weight:400">(%${faizOrani})</span></div>
      </div>
      <div class="kredi-kart-meta-item" style="padding-left:16px">
        <div class="kredi-kart-meta-label">Toplam Borç</div>
        <div class="kredi-kart-meta-val">${fmt(kr.toplamBorc)}</div>
      </div>
      <div class="kredi-kart-meta-item" style="padding-left:16px">
        <div class="kredi-kart-meta-label">Kalan Borç</div>
        <div class="kredi-kart-meta-val" style="color:${kalan>0?'var(--danger)':'var(--teal)'}">${fmt(kalan)}</div>
      </div>
      <div class="kredi-kart-meta-item" style="padding-left:16px">
        <div class="kredi-kart-meta-label">Faiz Oranı</div>
        <div class="kredi-kart-meta-val">%${kr.faizOran} <span style="font-size:10px;color:var(--text3);font-weight:400">aylık</span></div>
      </div>
      <div class="kredi-kart-meta-item" style="padding-left:16px">
        <div class="kredi-kart-meta-label">Vade</div>
        <div class="kredi-kart-meta-val">${kr.vade} ay</div>
      </div>
      <div class="kredi-kart-meta-item" style="padding-left:16px">
        <div class="kredi-kart-meta-label">Bitiş</div>
        <div class="kredi-kart-meta-val" style="font-size:12px">${sonTarih ? fmtDate(sonTarih) : '—'}</div>
      </div>
    </div>

    <div class="kredi-kart-progress-wrap">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:11px;font-weight:600;color:var(--text2)">Ödeme İlerlemesi</span>
        <span style="font-size:11px;font-family:var(--mono);color:var(--text3)">${odenmisSayisi} / ${kr.vade} taksit · %${ilerleme}</span>
      </div>
      <div class="kredi-progress-bar-bg">
        <div class="kredi-progress-bar-fill" style="width:${ilerleme}%"></div>
      </div>
      <div class="kredi-progress-labels">
        <span>%0</span>
        <span style="color:${bitti?'var(--teal)':'var(--text3)'}">%${ilerleme} tamamlandı</span>
        <span>%100</span>
      </div>
    </div>

    <div class="kredi-accordion">
      <div class="kredi-accordion-header kredi-accordion-toggle">
        <span style="font-size:12px;font-weight:600;color:var(--text2)">📅 Taksit Planı</span>
        <div style="display:flex;align-items:center;gap:10px">
          ${gelecek.length > 0 ? `<span style="font-size:11px;color:var(--text3)">${gelecek.length} taksit kaldı</span>` : '<span style="font-size:11px;color:var(--teal)">Tamamlandı ✓</span>'}
          <span class="kredi-accordion-chevron">▼</span>
        </div>
      </div>
      <div class="kredi-accordion-body">
        <div style="display:grid;grid-template-columns:28px 90px 70px 1fr 90px auto;gap:8px;padding:4px 10px 6px;border-bottom:1px solid var(--border);margin-bottom:4px">
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;font-weight:700">#</div>
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;font-weight:700">Tarih</div>
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;font-weight:700">Dönem</div>
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;font-weight:700">No</div>
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;font-weight:700;text-align:right">Tutar</div>
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;font-weight:700">Durum</div>
        </div>
        <div class="kredi-taksit-timeline" id="timeline_${uid_kart}">
          ${taksitHtml}
        </div>
      </div>
    </div>
  </div>`;
}

export function _toggleKrediAccordion(header) {
  header.classList.toggle('open');
  const body = header.nextElementSibling;
  body.classList.toggle('open');
}

