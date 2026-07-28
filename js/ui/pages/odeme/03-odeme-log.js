import { fmt } from '@core/format.js';
import { DB } from '@core/state.js';
// ============================================================
// js/ui/pages/odeme/03-odeme-log.js
// Ödeme log kaydı (kim/ne zaman/ne kadar ödedi geçmişi)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/odeme.js
// (52 export, 2097 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function odLogEkle(tip, id, key, durum, tutar, not, bakiyeDelta) {
  if(!DB.odLog) DB.odLog = {};
  const lk = `${tip}|${id}|${key!=null?key:'_'}`;
  if(!DB.odLog[lk]) DB.odLog[lk] = [];
  DB.odLog[lk].push({
    ts: new Date().toISOString(),
    durum: durum || 'sıfırlandı',
    tutar: tutar || 0,
    not: not || '',
    bakiyeDelta: bakiyeDelta || 0
  });
  // Sadece son 50 kaydı tut (overflow önle)
  if(DB.odLog[lk].length > 50) DB.odLog[lk] = DB.odLog[lk].slice(-50);
}

export function odLogGetir(tip, id, key) {
  if(!DB.odLog) return [];
  const lk = `${tip}|${id}|${key!=null?key:'_'}`;
  return (DB.odLog[lk] || []).slice().reverse(); // en yeni önce
}

export function _odLogRender(tip, id, key) {
  const kayitlar = odLogGetir(tip, id, key);
  const el = document.getElementById('od-modal-log');
  if(!el) return;
  if(!kayitlar.length) { el.innerHTML=''; return; }
  const durumDot = {
    odendi:'#2dd4bf', kismi:'#a78bfa', ertelendi:'#fb923c',
    bekliyor:'#38bdf8', gecikti:'#fb7185', iptal:'#6b7280', 'sıfırlandı':'#6b7280'
  };
  el.innerHTML = `<div class="od-log-title">Geçmiş (${kayitlar.length})</div>` +
    kayitlar.map(k=>{
      const dt = new Date(k.ts);
      const dtStr = dt.toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric'}) + ' ' +
                    dt.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
      const dot = durumDot[k.durum] || '#6b7280';
      return `<div class="od-log-item">
        <div class="od-log-dot" style="background:${dot}"></div>
        <div class="od-log-meta">
          <div class="od-log-durum">${k.durum.charAt(0).toUpperCase()+k.durum.slice(1)}${k.not?' · <span class="od-log-not">'+k.not+'</span>':''}</div>
          <div class="od-log-tarih">${dtStr}</div>
        </div>
        ${k.tutar ? `<div class="od-log-tutar">${fmt(k.tutar)}</div>` : ''}
      </div>`;
    }).join('');
}

// ============================================================
// DUAL-MODE CONTAINER KAYDI (bkz. DI-MIGRATION.md)
// Kendi üstteki importlar (core.format, core.state) BİLİNÇLİ OLARAK
// bırakıldı — dosyanın davranışı değişmedi, sadece dışa export'lar
// container'a da kaydedildi.
// ============================================================
import { provide } from '@core/container.js';
provide('ui.pages.odemeLog', { odLogEkle, odLogGetir, _odLogRender });

