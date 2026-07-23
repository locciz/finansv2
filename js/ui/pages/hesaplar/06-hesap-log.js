import { fmtCur, fmtDate } from '../../../core/format.js';
import { CURRENCY_CONFIG, DB, defaultCurrency } from '../../../core/state.js';
import { _hesapLogId, _hesapLogKayitlar, _hesapLogNakitPb, set_hesapLogId, set_hesapLogKayitlar, set_hesapLogNakitPb } from './04-hesap-liste-render.js';
import { openModal } from '../../components/modal-genel.js';
// ============================================================
// js/ui/pages/hesaplar/06-hesap-log.js
// Hesap bakiye/nakit işlem geçmişi log görüntüleme
//
// Bu dosya, eskiden tek parça olan js/ui/pages/hesaplar.js
// (49 export, 991 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function openHesapLogModal(hesapId) {
  set_hesapLogId(hesapId);
  set_hesapLogNakitPb(null);
  const hesap = (DB.hesaplar || []).find(h => h.id === hesapId);
  if (!hesap) return;
  const banka = ((DB.bankalar || []).find(b => b.id === hesap.banka) || {}).kisa || '';
  document.getElementById('hesap-log-modal-title').textContent = hesap.ad + (banka ? ' — ' + banka : '');
  document.getElementById('hesap-log-modal-sub').textContent = `Bakiye: ${fmtCur(hesap.bakiye || 0, hesap.paraBirimi || 'TRY')}`;
  document.getElementById('hesap-log-ara').value = '';
  document.getElementById('hesap-log-tur').value = '';

  // Tüm kaynaklardan bu hesabı bul
  set_hesapLogKayitlar(_collectHesapLog(hesapId, hesap));
  _renderHesapLog(_hesapLogKayitlar);
  openModal('modal-hesap-log');
}

// Aynı modalı nakit (para birimi) bakiyesi için kullan

export function openNakitLogModal(pb) {
  pb = pb || defaultCurrency || 'TRY';
  set_hesapLogId(null);
  set_hesapLogNakitPb(pb);
  const cfg = (typeof CURRENCY_CONFIG !== 'undefined' && CURRENCY_CONFIG[pb]) || {};
  const bak = (DB._nakitBakiye || {})[pb] || 0;
  document.getElementById('hesap-log-modal-title').textContent = `💵 Nakit (${pb})${cfg.ad ? ' — ' + cfg.ad : ''}`;
  document.getElementById('hesap-log-modal-sub').textContent = `Bakiye: ${fmtCur(bak, pb)}`;
  document.getElementById('hesap-log-ara').value = '';
  document.getElementById('hesap-log-tur').value = '';

  set_hesapLogKayitlar(_collectBakiyeLog({ nakitPb: pb }));
  _renderHesapLog(_hesapLogKayitlar);
  openModal('modal-hesap-log');
}

// ═══ BİRLEŞİK BAKİYE LOGU ══════════════════════════════════
// Hesap ve nakit bakiyesini etkileyen TÜM kaynakları (kira, maaş, elden,
// abonelik, KMH/bireysel kredi taksitleri, kart ekstre ödemeleri, transferler)
// tek bir kronolojik listede toplar. Hem Hesap Log hem Nakit Log modalı bunu kullanır.

// KMH kredisinin bağlı olduğu gerçek hesabı çözümle (entKmhYansit ile aynı mantık)

export function _logResolveKmhHesapId(kr) {
  if (!kr || !kr.kmhId) return null;
  const kmhKart = (DB.kartlar || []).find(k => k.id === kr.kmhId) ||
                  (DB.hesaplar || []).find(h => h.id === kr.kmhId);
  return kmhKart ? (kmhKart.hesapId || kr.kmhId) : null;
}

export function _collectBakiyeLog(opts) {
  opts = opts || {};
  const hesapId = opts.hesapId || null;
  const nakitPb = opts.nakitPb || null;
  if (!hesapId && !nakitPb) return [];
  const hesapObj = hesapId ? (DB.hesaplar || []).find(h => h.id === hesapId) : null;
  const kayitlar = [];

  const ekle = (tarih, aciklama, tutar, kaynak, pb, id, tipOverride) => {
    if (!tutar) return;
    kayitlar.push({
      tarih: tarih || '',
      aciklama: aciklama || '—',
      tutar,
      tip: tipOverride || (tutar < 0 ? 'gider' : 'gelir'),
      kaynak,
      pb: pb || (hesapId ? defaultCurrency : nakitPb) || 'TRY',
      id
    });
  };

  if (hesapId) {
    // Elden ödemeler (havale yöntemiyle bu hesaba)
    (DB.eldenler || []).forEach(e => {
      if (e.yontem === 'havale' && e.hesapId === hesapId) {
        ekle(e.tarih, e.aciklama || 'Elden ödeme', e.tutar, 'Elden', e.paraBirimi, e.id);
      }
    });
    // Kira ödemeleri (aylık durum kayıtları)
    (DB.kiralar || []).forEach(k => {
      if (k.hesapId !== hesapId) return;
      const yon = k.tutar >= 0 ? 1 : -1;
      Object.entries(k.odemeOverrides || {}).forEach(([ay, ov]) => {
        if (ov && (ov.durum === 'odendi' || ov.durum === 'kismi') && ov.tutar) {
          ekle(ov.tarih || ay + '-01', `Kira${k.aciklama ? ': ' + k.aciklama : ''}`, Math.abs(ov.tutar) * yon, 'Kira', k.paraBirimi, `${k.id}_${ay}`);
        }
      });
    });
    // Maaş ödemeleri
    (DB.maaslar || []).forEach(m => {
      if (m.hesapId !== hesapId) return;
      Object.entries(m.odemeOverrides || {}).forEach(([ay, ov]) => {
        if (ov && (ov.durum === 'odendi' || ov.durum === 'kismi') && ov.tutar) {
          ekle(ov.tarih || ay + '-01', `Maaş${m.aciklama ? ': ' + m.aciklama : ''}`, Math.abs(ov.tutar), 'Maaş', m.paraBirimi, `${m.id}_${ay}`);
        }
      });
    });
    // Abonelik ödemeleri
    (DB.abonelikler || []).forEach(ab => {
      if (ab.hesapId !== hesapId) return;
      Object.entries(ab.odemeOverrides || {}).forEach(([ay, ov]) => {
        if (ov && (ov.durum === 'odendi' || ov.durum === 'kismi') && ov.tutar) {
          ekle(ov.tarih || ay + '-01', `Abonelik: ${ab.ad || ''}`, -Math.abs(ov.tutar), 'Abonelik', ab.paraBirimi, `${ab.id}_${ay}`);
        }
      });
    });
    // KMH Kredi taksitleri
    (DB.krediler || []).forEach(kr => {
      if (_logResolveKmhHesapId(kr) !== hesapId) return;
      Object.entries(kr.taksitOverrides || {}).forEach(([no, ov]) => {
        if (ov && (ov.durum === 'odendi' || ov.durum === 'kismi') && ov.tutar) {
          ekle(ov.tarih, `KMH Kredi Taksiti #${no}`, -Math.abs(ov.tutar), 'KMH Kredi', kr.paraBirimi, `${kr.id}_${no}`);
        }
      });
    });
    // Bireysel kredi taksitleri
    (DB.bireyselKrediler || []).forEach(kr => {
      if (kr.hesapId !== hesapId) return;
      Object.entries(kr.taksitOverrides || {}).forEach(([no, ov]) => {
        if (ov && (ov.durum === 'odendi' || ov.durum === 'kismi') && ov.tutar) {
          ekle(ov.tarih, `Bireysel Kredi Taksiti #${no}`, -Math.abs(ov.tutar), 'Bireysel Kredi', kr.paraBirimi, `${kr.id}_${no}`);
        }
      });
    });
    // Kredi kartı ekstre ödemeleri
    (DB.kartOdemeleri || []).forEach(o => {
      if (o.hesapId !== hesapId) return;
      ekle(o.tarih, 'Kredi Kartı Ekstre Ödemesi', -Math.abs(o.tutar), 'Kart Ödemesi', o.paraBirimi, o.id);
    });
    // Transferler
    (DB.transferler || []).forEach(t => {
      if (t.kaynakId === hesapId) ekle(t.tarih, t.aciklama || 'Transfer (çıkış)', -Math.abs(t.tutar), 'Transfer', t.kaynakPb, t.id, 'transfer');
      else if (t.hedefId === hesapId) ekle(t.tarih, t.aciklama || 'Transfer (giriş)', Math.abs(t.tutar), 'Transfer', t.hedefPb, t.id, 'transfer');
    });
  } else if (nakitPb) {
    // Elden ödemeler (nakit yöntemiyle)
    (DB.eldenler || []).forEach(e => {
      if (e.yontem === 'nakit' && (e.paraBirimi || defaultCurrency || 'TRY') === nakitPb) {
        ekle(e.tarih, e.aciklama || 'Elden ödeme', e.tutar, 'Elden', nakitPb, e.id);
      }
    });
    // Transferler (nakit tarafı)
    (DB.transferler || []).forEach(t => {
      if (t.kTip === 'nakit' && t.kaynakPb === nakitPb) ekle(t.tarih, t.aciklama || 'Transfer (çıkış)', -Math.abs(t.tutar), 'Transfer', nakitPb, t.id, 'transfer');
      if (t.hTip === 'nakit' && t.hedefPb === nakitPb) ekle(t.tarih, t.aciklama || 'Transfer (giriş)', Math.abs(t.tutar), 'Transfer', nakitPb, t.id, 'transfer');
    });
  }

  // Manuel bakiye düzeltmeleri (hem banka hesabı hem nakit için ortak log)
  (DB._bakiyeDuzeltmeLog || []).forEach(d => {
    const buHesap = hesapId && d.hedefTip === 'hesap' && d.hedefId === hesapId;
    const buNakit = nakitPb && d.hedefTip === 'nakit' && d.hedefId === nakitPb;
    if (!buHesap && !buNakit) return;
    const pb = buHesap ? ((hesapObj && hesapObj.paraBirimi) || defaultCurrency || 'TRY') : nakitPb;
    ekle(d.tarih, d.not ? `Bakiye Düzeltmesi — ${d.not}` : 'Bakiye Düzeltmesi', d.fark, 'Düzeltme', pb, d.id, 'duzeltme');
  });

  kayitlar.sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  return kayitlar;
}

export function _collectHesapLog(hesapId, hesap) {
  return _collectBakiyeLog({ hesapId });
}

export function filterHesapLog() {
  const ara = (document.getElementById('hesap-log-ara').value || '').toLowerCase();
  const tur = document.getElementById('hesap-log-tur').value;
  let liste = _hesapLogKayitlar;
  if (tur) liste = liste.filter(k => k.tip === tur);
  if (ara) liste = liste.filter(k => (k.aciklama || '').toLowerCase().includes(ara) || (k.kaynak || '').toLowerCase().includes(ara));
  _renderHesapLog(liste);
}

export function _renderHesapLog(liste) {
  const el = document.getElementById('hesap-log-liste');
  const ozet = document.getElementById('hesap-log-ozet');
  if (!liste.length) {
    el.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:24px;text-align:center">Kayıt yok</div>';
    ozet.innerHTML = '';
    ozet.style.display = 'none';
    return;
  }
  ozet.style.display = 'flex';
  const tipColors = { gelir: 'var(--teal)', gider: 'var(--danger)', transfer: 'var(--violet)', duzeltme: 'var(--warn)' };
  const tipLabels = { gelir: '↑', gider: '↓', transfer: '⇄', duzeltme: '🛠' };
  el.innerHTML = liste.map(k => {
    const c = tipColors[k.tip] || 'var(--text2)';
    const lbl = tipLabels[k.tip] || '·';
    const sign = k.tutar >= 0 ? '+' : '';
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;font-size:11.5px">
      <div style="width:22px;height:22px;border-radius:6px;background:${c}22;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;color:${c};font-weight:700">${lbl}</div>
      <div style="flex:1;min-width:0">
        <div style="color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px">${k.aciklama}</div>
        <div style="color:var(--text3);font-size:10px;margin-top:1px">${k.kaynak} · ${fmtDate ? fmtDate(k.tarih) : k.tarih}</div>
      </div>
      <div class="mono" style="font-weight:700;color:${c};flex-shrink:0">${sign}${fmtCur(Math.abs(k.tutar), k.pb)}</div>
    </div>`;
  }).join('');

  // Özet
  const ozetPb = liste[0].pb || defaultCurrency || 'TRY';
  const topGelir = liste.filter(k=>k.tutar>0).reduce((s,k)=>s+k.tutar,0);
  const topGider = liste.filter(k=>k.tutar<0).reduce((s,k)=>s+Math.abs(k.tutar),0);
  ozet.innerHTML = `
    <span>📊 <b>${liste.length}</b> kayıt</span>
    <span style="color:var(--teal)">↑ Giriş: <b class="mono">${fmtCur(topGelir,ozetPb)}</b></span>
    <span style="color:var(--danger)">↓ Çıkış: <b class="mono">${fmtCur(topGider,ozetPb)}</b></span>
    <span style="color:var(--text2)">Net: <b class="mono">${fmtCur(topGelir-topGider,ozetPb)}</b></span>`;
}

