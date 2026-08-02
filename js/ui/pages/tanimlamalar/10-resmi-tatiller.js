import { saveData } from '@core/app-core-base.js';
import { uid } from '@core/format.js';
import { DB } from '@core/state.js';
import { inject, provide } from '@core/container.js';
const _kurServisleri = inject('services.kurServisleri');
const _modalGenel = inject('ui.components.modalGenel');
const _moneyInput = inject('ui.components.moneyInput');
const _tanimlamalarState = inject('ui.pages.tanimlamalarState');
// DAİRESEL: tanimlamalar/02-ana-sayfa.js bu dosyayı da import ediyor
// (deleteTatil, editTatil). renderTanimlamalar() SADECE fonksiyon
// gövdelerinde çağrılıyor, modül eval zamanında değil — top-level const
// güvenli (Tur 15/20/21/22/23/24 deseniyle tutarlı).
const _tanimlamalarAnaSayfa = inject('ui.pages.tanimlamalarAnaSayfa');
// ============================================================
// js/ui/pages/tanimlamalar/10-resmi-tatiller.js
// Resmi tatil listesi (otomatik güncelleme + CRUD)
//
// Bu dosya, eskiden tek parça olan js/ui/pages/tanimlamalar.js
// (81 export, 1440+ satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export async function resmiTatilleriGuncelle() {
  const btn = document.getElementById('btn-tatil-guncelle');
  const status = document.getElementById('tatil-guncelle-status');
  const buYil = new Date().getFullYear();
  const yillar = [buYil, buYil + 1];

  btn.disabled = true;
  btn.textContent = '⏳ Yükleniyor...';
  status.textContent = '';

  // Türkçe tatil adı eşleştirme
  const adMap = {
    "New Year's Day":              "Yılbaşı",
    "National Sovereignty and Children's Day": "Ulusal Egemenlik ve Çocuk Bayramı",
    "Labour Day":                  "İşçi Bayramı",
    "Commemoration of Atatürk, Youth and Sports Day": "Atatürk'ü Anma, Gençlik ve Spor Bayramı",
    "Democracy and National Unity Day": "Demokrasi ve Millî Birlik Günü",
    "Victory Day":                 "Zafer Bayramı",
    "Republic Day":                "Cumhuriyet Bayramı",
    "Ramadan Feast":               "Ramazan Bayramı 1. Günü",
    "Ramadan Feast Holiday":       "Ramazan Bayramı",
    "Sacrifice Feast":             "Kurban Bayramı 1. Günü",
    "Sacrifice Feast Holiday":     "Kurban Bayramı",
  };

  try {
    let eklenen = 0, atlanan = 0;
    const mevcutTarihler = new Set(DB.tatiller.map(t => t.tarih));

    for (const yil of yillar) {
      // Nager.Date API'si CORS destekliyor olsa da, kapanma/rate-limit gibi
      // geçici kesintilere karşı merkezi proxy zincirinden geçiyoruz
      // (Worker varsa önce o denenir, sonra ücretsiz yedekler).
      const TARGET = `https://date.nager.at/api/v3/PublicHolidays/${yil}/TR`;
      const sonuc = await _kurServisleri.corsProxyZinciriDene(TARGET, {
        timeoutMs: 6000,
        validator: (text) => {
          try { const p = JSON.parse(text); return Array.isArray(p) && p.length > 0; }
          catch(e) { return false; }
        }
      });
      const data = sonuc ? JSON.parse(sonuc.text) : null;
      if (!data) throw new Error('Worker ve tüm yedek proxy\u2019ler başarısız — internet bağlantısını kontrol edin');

      for (const h of data) {
        if (mevcutTarihler.has(h.date)) { atlanan++; continue; }
        const ad = adMap[h.name] || adMap[h.localName] || h.localName || h.name;
        DB.tatiller.push({ id: uid(), tarih: h.date, aciklama: ad });
        mevcutTarihler.add(h.date);
        eklenen++;
      }
    }

    saveData();
    _tanimlamalarAnaSayfa.renderTanimlamalar();
    status.style.color = 'var(--teal)';
    status.textContent = `✓ ${eklenen} yeni tatil eklendi${atlanan ? `, ${atlanan} zaten vardı` : ''} (${yillar.join(' & ')})`;
    if(typeof _modalGenel.showToast === 'function') _modalGenel.showToast(`${eklenen} yeni tatil eklendi${atlanan ? `, ${atlanan} zaten vardı` : ''}`, 'success');
  } catch (e) {
    status.style.color = 'var(--danger)';
    status.textContent = '✗ API bağlantı hatası: ' + e.message;
    if(typeof _modalGenel.showToast === 'function') _modalGenel.showToast('API bağlantı hatası: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Resmi Tatilleri Güncelle';
    setTimeout(() => { status.textContent = ''; }, 6000);
  }
}

export function openTatilModal() {
  _tanimlamalarState.setEditTatilId(null);
  document.getElementById('tatil-modal-title').textContent = 'Resmi Tatil Günü Ekle';
  _moneyInput.setDateInputValue('tatil-tarih', '');
  document.getElementById('tatil-aciklama').value = '';
  _modalGenel.openModal('modal-tatil');
}

export function editTatil(id) {
  _tanimlamalarState.setEditTatilId(id);
  const t = DB.tatiller.find(x=>x.id===id);
  if(!t) return;
  document.getElementById('tatil-modal-title').textContent = 'Tatil Günü Düzenle';
  _moneyInput.setDateInputValue('tatil-tarih', t.tarih);
  document.getElementById('tatil-aciklama').value = t.aciklama;
  document.getElementById('modal-tatil').classList.add('open'); document.body.classList.add('modal-open'); _modalGenel._sidebarDim(true);
}

export function saveTatil() {
  const tarih = document.getElementById('tatil-tarih').value;
  const aciklama = document.getElementById('tatil-aciklama').value.trim();
  if(!_modalGenel.validateRequiredFields([{id:'tatil-tarih',msg:'Tarih zorunlu'}])) return;
  if(_tanimlamalarState.editTatilId) {
    const idx = DB.tatiller.findIndex(t=>t.id===_tanimlamalarState.editTatilId);
    if(idx>=0) DB.tatiller[idx]={...DB.tatiller[idx], tarih, aciklama};
  } else {
    DB.tatiller.push({id:uid(), tarih, aciklama});
  }
  _tanimlamalarState.setEditTatilId(null);
  saveData();
  _modalGenel.closeModal('modal-tatil');
  _tanimlamalarAnaSayfa.renderTanimlamalar();
}

export function deleteTatil(id) {
  DB.tatiller = DB.tatiller.filter(t=>t.id!==id);
  saveData();
  _tanimlamalarAnaSayfa.renderTanimlamalar();
}

// ── DI-MIGRATION dual-mode kaydı ──────────────────────────────
provide('ui.pages.tanimlamalarResmiTatiller', {
  resmiTatilleriGuncelle,
  openTatilModal,
  editTatil,
  saveTatil,
  deleteTatil,
});

