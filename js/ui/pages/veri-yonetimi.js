import { applyMigrations, saveData } from '@core/app-core-base.js';
import { fmtDate, fmtTime, localDateStr, uid } from '@core/format.js';
import { DB, replaceObjectContents } from '@core/state.js';
import { showConfirm, showToast } from '@components/modal-genel.js';
import { bankaLogoByKod } from '@pages/tanimlamalar/01-genel-yardimcilar.js';
import { renderTanimlamalar } from '@pages/tanimlamalar/02-ana-sayfa.js';
import { _katKey, populateKategoriSelects, renderKategoriGrid } from '@pages/tanimlamalar/03-kategoriler.js';
import { closeModal, openModal } from '@components/modal-genel.js';
import { inject } from '@core/container.js';
const _gdrive = inject('services.gdrive');
import { call } from '@core/wrap-registry.js';
// Orijinal 02-core-app-engine.js içinden çıkarıldı. İçerik değiştirilmedi.

// ==== 02-core-app-engine.js'den taşınan modül state'i ====
export var _vyBekleyenRestoreData = null;
// ── Seçim durumu: hangi kategoriler/kayıtlar geri yüklemeye dahil edilecek ──
// key -> 'all' (varsayılan, hepsi dahil) | 'none' (kategori tamamen hariç) | Set(idStr) (kısmi seçim)
export var _vySecim = {};
export function exportBankalarJSON() {
  const list = DB.bankalar || [];
  if(!list.length) { showToast('Dışa aktarılacak banka kaydı yok', 'error'); return; }
  // Şubeleri de IBAN koduna göre birlikte paketle, böylece içe aktarımda kaybolmasınlar
  const payload = {
    tip: 'finans-bankalar',
    surum: 1,
    tarih: new Date().toISOString(),
    bankalar: list.map(b => ({ tam: b.tam, kisa: b.kisa, ibanKod: b.ibanKod || '', ikon: b.ikon || '', logo: b.logo || '' })),
    subeler: list.reduce((acc, b) => {
      if(b.ibanKod && DB.subeler && DB.subeler[b.ibanKod] && DB.subeler[b.ibanKod].length) {
        acc[b.ibanKod] = DB.subeler[b.ibanKod];
      }
      return acc;
    }, {})
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const tarihStr = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `bankalar_${tarihStr}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`${list.length} banka JSON olarak dışa aktarıldı`, 'success');
}

export function importBankalarJSON(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = ''; // aynı dosyayı tekrar seçebilmek için sıfırla
  if(!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch(e) {
      showToast('Geçersiz JSON dosyası', 'error');
      return;
    }

    // Hem {bankalar:[...], subeler:{...}} paket formatını hem de düz [...] dizisini kabul et
    const gelenBankalar = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.bankalar) ? parsed.bankalar : null);
    if(!gelenBankalar) {
      showToast('JSON içinde geçerli bir "bankalar" listesi bulunamadı', 'error');
      return;
    }
    const gelenSubeler = (!Array.isArray(parsed) && parsed.subeler && typeof parsed.subeler === 'object') ? parsed.subeler : {};

    const temizler = gelenBankalar
      .filter(b => b && typeof b === 'object' && (b.tam || b.kisa))
      .map(b => ({
        tam: (b.tam || b.kisa || '').toString().trim(),
        kisa: (b.kisa || b.tam || '').toString().trim(),
        ibanKod: (b.ibanKod || b.kod || '').toString().trim(),
        ikon: (b.ikon || '').toString().trim(),
        logo: (b.logo || '').toString().trim()
      }));

    if(!temizler.length) {
      showToast('İçe aktarılacak geçerli banka kaydı yok', 'error');
      return;
    }

    showConfirm(`${temizler.length} banka içe aktarılacak. IBAN kodu mevcut bir bankayla eşleşenler güncellenecek, diğerleri yeni eklenecek. Devam edilsin mi?`, () => {
      if(!DB.bankalar) DB.bankalar = [];
      if(!DB.subeler) DB.subeler = {};
      let eklenen = 0, guncellenen = 0;

      temizler.forEach(b => {
        const mevcut = b.ibanKod ? DB.bankalar.find(x => x.ibanKod === b.ibanKod) : null;
        if(mevcut) {
          mevcut.tam = b.tam || mevcut.tam;
          mevcut.kisa = b.kisa || mevcut.kisa;
          mevcut.ikon = b.ikon || mevcut.ikon;
          mevcut.logo = b.logo || mevcut.logo || bankaLogoByKod(b.ibanKod) || '';
          guncellenen++;
        } else {
          DB.bankalar.push({ id: uid(), tam: b.tam, kisa: b.kisa, ibanKod: b.ibanKod, ikon: b.ikon || '', logo: b.logo || bankaLogoByKod(b.ibanKod) || '' });
          eklenen++;
        }
      });

      // Şube listelerini birleştir (varsa, kod bazında tekilleştirerek)
      Object.keys(gelenSubeler).forEach(ibanKod => {
        const gelenList = Array.isArray(gelenSubeler[ibanKod]) ? gelenSubeler[ibanKod] : [];
        if(!gelenList.length) return;
        if(!DB.subeler[ibanKod]) DB.subeler[ibanKod] = [];
        gelenList.forEach(s => {
          if(s && s.k && !DB.subeler[ibanKod].find(x => x.k === s.k)) {
            DB.subeler[ibanKod].push({ k: s.k, a: s.a || '' });
          }
        });
        DB.subeler[ibanKod].sort((a,b) => a.k.localeCompare(b.k));
      });

      saveData();
      renderTanimlamalar();
      showToast(`${eklenen} yeni banka eklendi, ${guncellenen} banka güncellendi`, 'success');
    }, { title: 'İçe aktarılsın mı?', okLabel: 'İçe Aktar', okClass: 'btn-primary' });
  };
  reader.onerror = () => showToast('Dosya okunamadı', 'error');
  reader.readAsText(file);
}

export function renderVeriYonetimiOzet() {
  const grid = document.getElementById('vy-ozet-grid');
  if(!grid) return;

  const grupAd = { veri:'İşlem Verileri', hesap:'Hesap & Kartlar', tanim:'Tanımlamalar', oran:'Oran Tabloları' };
  const grupIkon = { veri:'📊', hesap:'💳', tanim:'🗂️', oran:'📐' };
  const grupRenk = {
    veri:  'rgba(251,191,36,.12)',
    hesap: 'rgba(56,189,248,.1)',
    tanim: 'rgba(45,212,191,.1)',
    oran:  'rgba(167,139,250,.1)'
  };
  const grupBorder = {
    veri:  'rgba(251,191,36,.2)',
    hesap: 'rgba(56,189,248,.2)',
    tanim: 'rgba(45,212,191,.2)',
    oran:  'rgba(167,139,250,.2)'
  };
  const grupValRenk = {
    veri:  'var(--gold)',
    hesap: 'var(--sky)',
    tanim: 'var(--teal)',
    oran:  'var(--violet)'
  };

  // Grupla
  const gruplar = {};
  VY_OZET_ALANLAR.forEach(f => {
    if(!gruplar[f.grup]) gruplar[f.grup] = [];
    gruplar[f.grup].push(f);
  });

  let toplam = 0;
  VY_OZET_ALANLAR.forEach(f => {
    const list = DB[f.k];
    toplam += Array.isArray(list) ? list.length : (list && typeof list==='object' ? Object.keys(list).length : 0);
  });

  let html = `<div style="grid-column:1/-1;background:linear-gradient(90deg,rgba(251,191,36,.08),rgba(45,212,191,.06));border:1px solid rgba(251,191,36,.2);border-radius:12px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
    <div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin-bottom:4px">Toplam Kayıt</div>
      <div style="font-family:var(--mono);font-size:28px;font-weight:700;color:var(--gold);line-height:1">${toplam.toLocaleString('tr-TR')}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:10px;color:var(--text3);margin-bottom:4px">${Object.keys(gruplar).length} kategori · ${VY_OZET_ALANLAR.length} alan</div>
      <div style="font-size:11px;color:var(--text2)">Yedek dosyası tüm bu veriyi içerir</div>
    </div>
  </div>`;

  Object.entries(gruplar).forEach(([grup, alanlar]) => {
    const renk = grupRenk[grup] || 'var(--surface2)';
    const border = grupBorder[grup] || 'var(--border)';
    const valRenk = grupValRenk[grup] || 'var(--accent)';

    html += `<div style="grid-column:1/-1;margin-top:10px;margin-bottom:4px;display:flex;align-items:center;gap:6px">
      <span style="font-size:14px">${grupIkon[grup]||'📁'}</span>
      <span style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.1em">${grupAd[grup]||grup}</span>
      <div style="flex:1;height:1px;background:var(--border)"></div>
    </div>`;

    alanlar.forEach(f => {
      const list = DB[f.k];
      const count = Array.isArray(list) ? list.length
        : (list && typeof list==='object' && !Array.isArray(list) ? Object.keys(list).length : 0);
      const isEmpty = count === 0;
      html += `<div style="background:${isEmpty ? 'var(--surface2)' : renk};border:1px solid ${isEmpty ? 'var(--border)' : border};border-radius:10px;padding:10px 12px;transition:all .15s">
        <div style="font-size:13px;margin-bottom:4px">${f.ikon||'•'}</div>
        <div style="font-family:var(--mono);font-size:17px;font-weight:700;color:${isEmpty ? 'var(--text3)' : valRenk};line-height:1">${count}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.ad}</div>
      </div>`;
    });
  });

  grid.style.gridTemplateColumns = 'repeat(auto-fill,minmax(110px,1fr))';
  grid.innerHTML = html;
}

export function exportTumVeriJSON() {
  const payload = {
    tip: 'finans-tam-yedek',
    surum: 1,
    tarih: new Date().toISOString(),
    data: DB
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const tarihStr = new Date().toISOString().slice(0,10);
  const saatStr = new Date().toTimeString().slice(0,5).replace(':','');
  a.href = url;
  a.download = `finans_yedek_${tarihStr}_${saatStr}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Tüm veri yedeği indirildi ✓', 'success');
}

export function _vyKayitId(item, idx) {
  if (item && typeof item === 'object' && item.id != null) return String(item.id);
  return 'idx:' + idx;
}

export function _vyTumIdler(list) {
  if (Array.isArray(list)) return list.map((item,i) => _vyKayitId(item,i));
  if (list && typeof list === 'object') return Object.keys(list);
  return [];
}

export function _vySecimDurumu(key) {
  const s = _vySecim[key];
  if (s === undefined || s === 'all') return 'all';
  if (s === 'none') return 'none';
  return 'partial';
}

export function _vyKategoriToggle(key) {
  _vySecim[key] = (_vySecimDurumu(key) === 'none') ? 'all' : 'none';
  _vyOzetGridCiz();
}

export function _vyKayitToggle(key, idStr) {
  const list = _vyBekleyenRestoreData ? _vyBekleyenRestoreData[key] : null;
  const tumIdler = _vyTumIdler(list);
  let s = _vySecim[key];
  if (s === undefined || s === 'all') s = new Set(tumIdler);
  else if (s === 'none') s = new Set();
  else s = new Set(s);
  if (s.has(idStr)) s.delete(idStr); else s.add(idStr);
  if (s.size === 0) _vySecim[key] = 'none';
  else if (s.size === tumIdler.length) _vySecim[key] = 'all';
  else _vySecim[key] = s;
  _vyOzetGridCiz();
}

export function _vyTumunuSecKaldir(key, hepsiSecili) {
  _vySecim[key] = hepsiSecili ? 'all' : 'none';
  _vyOzetGridCiz();
}

export function _vyHerSeySeciliMi() {
  return VY_OZET_ALANLAR.every(f => _vySecimDurumu(f.k) === 'all');
}

export function _vyAlanSatirHTML(f, list, key) {
  const tumIdler = key ? _vyTumIdler(list) : [];
  const durum = key ? _vySecimDurumu(key) : 'all';
  const secSet = key ? (durum === 'partial' ? _vySecim[key] : (durum === 'all' ? new Set(tumIdler) : new Set())) : null;

  const headerHtml = key ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-bottom:1px solid var(--border);font-size:11px;color:var(--text3);position:sticky;top:0;background:var(--surface2)">
    <span>${secSet.size} / ${tumIdler.length} kayıt seçili</span>
    <span style="display:flex;gap:12px">
      <a href="#" class="vy-tumunu-sec" data-vy-key="${key}" data-vy-hepsi="1" style="color:var(--accent2);text-decoration:none">Tümünü Seç</a>
      <a href="#" class="vy-tumunu-sec" data-vy-key="${key}" data-vy-hepsi="0" style="color:var(--danger);text-decoration:none">Tümünü Kaldır</a>
    </span>
  </div>` : '';

  if (Array.isArray(list)) {
    if (!list.length) return headerHtml + '<div class="info-box" style="margin:0">Bu alanda kayıt yok.</div>';
    return headerHtml + `<table style="width:100%;border-collapse:collapse;font-size:12px">
      <tbody>
        ${list.slice(0,500).map((item,i) => {
          let ozet;
          if (item && typeof item === 'object') {
            const anahtarlar = ['ad','aciklama','tarih','isim','baslik','kod','tip'];
            const parcalar = [];
            anahtarlar.forEach(k => { if (item[k] !== undefined && item[k] !== '') parcalar.push(String(item[k])); });
            if (!parcalar.length) {
              parcalar.push(Object.entries(item).slice(0,4).map(([k,v]) => `${k}: ${typeof v==='object' ? '…' : v}`).join(' · '));
            }
            ozet = parcalar.join(' · ');
          } else {
            ozet = String(item);
          }
          const idStr = key ? _vyKayitId(item, i) : null;
          const secili = key ? secSet.has(idStr) : true;
          return `<tr style="border-bottom:1px solid var(--border)">
            ${key ? `<td style="padding:6px 4px 6px 8px;width:20px"><input type="checkbox" ${secili?'checked':''} class="vy-kayit-toggle" data-vy-key="${key}" data-vy-id="${idStr}" style="width:14px;height:14px;cursor:pointer"></td>` : ''}
            <td style="padding:6px 10px;color:var(--text3);font-family:var(--mono);width:34px;text-align:right">${i+1}</td>
            <td style="padding:6px 10px;color:var(--text2)">${ozet.length > 140 ? ozet.slice(0,140)+'…' : ozet}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>${list.length > 500 ? `<div style="padding:8px 10px;font-size:11px;color:var(--text3)">… ve ${list.length-500} kayıt daha (yalnızca ilk 500 kayıt tek tek seçilebilir; "Tümünü Seç/Kaldır" tüm kayıtları kapsar)</div>` : ''}`;
  }
  if (list && typeof list === 'object') {
    const girdiler = Object.entries(list);
    if (!girdiler.length) return headerHtml + '<div class="info-box" style="margin:0">Bu alanda kayıt yok.</div>';
    return headerHtml + `<table style="width:100%;border-collapse:collapse;font-size:12px">
      <tbody>
        ${girdiler.slice(0,500).map(([k,v]) => {
          const secili = key ? secSet.has(k) : true;
          return `<tr style="border-bottom:1px solid var(--border)">
          ${key ? `<td style="padding:6px 4px 6px 8px;width:20px"><input type="checkbox" ${secili?'checked':''} class="vy-kayit-toggle" data-vy-key="${key}" data-vy-id="${k}" style="width:14px;height:14px;cursor:pointer"></td>` : ''}
          <td style="padding:6px 10px;color:var(--text3);font-family:var(--mono);white-space:nowrap">${k}</td>
          <td style="padding:6px 10px;color:var(--text2)">${typeof v === 'object' ? JSON.stringify(v).slice(0,140) : String(v)}</td>
        </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  }
  return headerHtml + '<div class="info-box" style="margin:0">Bu alanda kayıt yok.</div>';
}

export function _vyOzetGridCiz() {
  const data = _vyBekleyenRestoreData;
  if (!data) return;

  const dolular = VY_OZET_ALANLAR.map(f => {
    const list = data[f.k];
    const count = Array.isArray(list) ? list.length : (list && typeof list==='object' ? Object.keys(list).length : 0);
    return { ...f, count };
  });

  const ozetGrid = document.getElementById('vy-restore-onizleme-ozet');
  ozetGrid.innerHTML = dolular.map(f => {
    if (f.count === 0) {
      return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:8px 10px;text-align:center;opacity:.5">
        <div style="font-size:13px">${f.ikon||'•'}</div>
        <div style="font-family:var(--mono);font-size:15px;font-weight:700;color:var(--text3)">0</div>
        <div style="font-size:9.5px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.ad}</div>
      </div>`;
    }
    const durum = _vySecimDurumu(f.k);
    const secili = durum !== 'none';
    const kismi = durum === 'partial';
    return `<div class="vy-secim-alani" data-vy-key="${f.k}" style="position:relative;cursor:pointer;background:var(--surface2);border:1px solid ${secili?'var(--accent2)':'var(--border)'};border-radius:10px;padding:8px 10px 8px 24px;text-align:center;transition:border-color .15s">
      <input type="checkbox" ${secili?'checked':''} data-vy-indet="${kismi?'1':'0'}" class="vy-kategori-toggle" data-vy-key="${f.k}" style="position:absolute;left:6px;top:8px;width:13px;height:13px;cursor:pointer">
      <div style="font-size:13px">${f.ikon||'•'}</div>
      <div style="font-family:var(--mono);font-size:15px;font-weight:700;color:${secili?'var(--accent2)':'var(--text3)'}">${f.count}${kismi?'*':''}</div>
      <div style="font-size:9.5px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.ad}</div>
    </div>`;
  }).join('');
  ozetGrid.querySelectorAll('input[data-vy-indet="1"]').forEach(cb => { cb.indeterminate = true; });
  ozetGrid.querySelectorAll('.vy-secim-alani').forEach(el => {
    el.addEventListener('click', () => vySecOnizlemeAlani(el.dataset.vyKey));
  });
  ozetGrid.querySelectorAll('.vy-kategori-toggle').forEach(el => {
    el.addEventListener('click', (event) => {
      event.stopPropagation();
      _vyKategoriToggle(el.dataset.vyKey);
    });
  });

  // Detay seçim listesi (sadece dolu alanlar)
  const secim = document.getElementById('vy-restore-onizleme-secim');
  const doluAlanlar = dolular.filter(f=>f.count>0);
  const wrap = document.getElementById('vy-restore-onizleme-detay-wrap');
  if (!doluAlanlar.length) {
    wrap.style.display = 'none';
  } else {
    wrap.style.display = '';
    const mevcutSecim = secim ? secim.value : '';
    secim.innerHTML = doluAlanlar.map(f => `<option value="${f.k}">${f.ikon||''} ${f.ad} (${f.count})</option>`).join('');
    const hedefKey = doluAlanlar.some(f=>f.k===mevcutSecim) ? mevcutSecim : doluAlanlar[0].k;
    secim.value = hedefKey;
    vyDoldurOnizlemeDetay(hedefKey);
  }

  // Uyarı metni ve buton yazısı: kullanıcı bir şey hariç bıraktıysa "seçilenler", tutmadıysa "tüm veri"
  const herseySecili = _vyHerSeySeciliMi();
  const uyariEl = document.getElementById('vy-restore-uyari-metin');
  const btnEl = document.getElementById('vy-restore-confirm-btn');
  if (uyariEl) {
    uyariEl.innerHTML = herseySecili
      ? 'Sistemdeki mevcut <b>tüm veri silinecek</b> ve yukarıdaki yedek dosyasındaki veriyle <b>tamamen değiştirilecek</b>. Devam etmeden önce gerekiyorsa güncel veriyi de yedekleyin.'
      : 'Yalnızca işaretli kategoriler/kayıtlar geri yüklenecek; işareti kaldırdığınız kategori ve kayıtlardaki <b>mevcut veriniz olduğu gibi kalacak</b>.';
  }
  if (btnEl) btnEl.textContent = herseySecili ? 'Evet, Tüm Veriyi Değiştir' : 'Seçilenleri Geri Yükle';
}

export function vyDoldurOnayModal(data, ustBilgiHTML) {
  _vyBekleyenRestoreData = data;
  _vySecim = {}; // her yeni yedek için seçim baştan başlar (varsayılan: hepsi dahil)

  const dolular = VY_OZET_ALANLAR.map(f => {
    const list = data[f.k];
    const count = Array.isArray(list) ? list.length : (list && typeof list==='object' ? Object.keys(list).length : 0);
    return { ...f, count };
  });

  const sayilar = dolular.filter(f=>f.count>0).map(f =>
    `<span class="badge" style="margin:2px">${f.ad}: <b>${f.count}</b></span>`
  ).join(' ');

  document.getElementById('vy-restore-onay-detay').innerHTML = `
    ${ustBilgiHTML || ''}
    <div style="margin-bottom:10px">Bu kaynakta aşağıdaki veriler bulundu. İstemediğiniz kategorinin işaretini kaldırabilir, ya da bir kategoriyi açıp içindeki kayıtları tek tek seçebilirsiniz:</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">${sayilar || '<span style="color:var(--text3)">Boş yedek</span>'}</div>
  `;

  _vyOzetGridCiz();
  openModal('modal-vy-restore-onay');
}

export function vySecOnizlemeAlani(key) {
  const secim = document.getElementById('vy-restore-onizleme-secim');
  if (secim) secim.value = key;
  vyDoldurOnizlemeDetay(key);
  document.getElementById('vy-restore-onizleme-detay-wrap').scrollIntoView({block:'nearest', behavior:'smooth'});
}

export function vyDoldurOnizlemeDetay(key) {
  if (!_vyBekleyenRestoreData) return;
  const f = VY_OZET_ALANLAR.find(x=>x.k===key);
  const list = _vyBekleyenRestoreData[key];
  const tablo = document.getElementById('vy-restore-onizleme-tablo');
  tablo.innerHTML = _vyAlanSatirHTML(f, list, key);
  _vyBindAlanSatir(tablo);
}

function _vyBindAlanSatir(container) {
  container.querySelectorAll('.vy-tumunu-sec').forEach(el => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      _vyTumunuSecKaldir(el.dataset.vyKey, el.dataset.vyHepsi === '1');
    });
  });
  container.querySelectorAll('.vy-kayit-toggle').forEach(el => {
    el.addEventListener('click', () => {
      _vyKayitToggle(el.dataset.vyKey, el.dataset.vyId);
    });
  });
}

export function importTumVeriJSON(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = ''; // aynı dosyayı tekrar seçebilmek için sıfırla
  if(!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch(e) {
      showToast('Geçersiz JSON dosyası', 'error');
      return;
    }

    // Hem {tip:'finans-tam-yedek', data:{...}} paket formatını hem de düz DB objesini kabul et
    const gelenData = (parsed && typeof parsed === 'object' && parsed.data && typeof parsed.data === 'object')
      ? parsed.data
      : (parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null);

    if(!gelenData || typeof gelenData !== 'object' || Array.isArray(gelenData)) {
      showToast('JSON içinde geçerli bir yedek verisi bulunamadı', 'error');
      return;
    }

    const tarihBilgi = parsed.tarih ? `<div style="margin-bottom:8px">Yedek tarihi: <b>${fmtDate(new Date(parsed.tarih))} ${fmtTime(new Date(parsed.tarih))}</b></div>` : '';
    vyDoldurOnayModal(gelenData, tarihBilgi);
  };
  reader.onerror = () => showToast('Dosya okunamadı', 'error');
  reader.readAsText(file);
}

export function confirmTumVeriRestore() {
  if(!_vyBekleyenRestoreData) { closeModal('modal-vy-restore-onay'); return; }
  const gelen = _vyBekleyenRestoreData;

  if (_vyHerSeySeciliMi()) {
    // Hiçbir şey hariç bırakılmadı — eski davranış: veriyi tamamen değiştir
    // (yedekte tanımlı alan listesi (VY_OZET_ALANLAR) dışında kalan alanlar da dahil).
    replaceObjectContents(DB, applyMigrations(gelen));
  } else {
    // Kısmi geri yükleme: sadece işaretli kategori/kayıtları mevcut veriye uygula,
    // işareti kaldırılan kategori/kayıtlardaki mevcut veri olduğu gibi kalır.
    const birlesik = { ...DB };
    VY_OZET_ALANLAR.forEach(f => {
      const key = f.k;
      if (!(key in gelen)) return;
      const durum = _vySecimDurumu(key);
      if (durum === 'none') return; // bu kategori tamamen hariç — dokunma
      const gelenList = gelen[key];
      if (durum === 'all') { birlesik[key] = gelenList; return; }

      // partial: yalnızca seçili kayıtları mevcut veriye upsert et (id eşleşirse üzerine yaz, yoksa ekle)
      const secSet = _vySecim[key];
      if (Array.isArray(gelenList)) {
        const mevcutList = Array.isArray(DB[key]) ? DB[key].slice() : [];
        gelenList.forEach((item, i) => {
          const idStr = _vyKayitId(item, i);
          if (!secSet.has(idStr)) return;
          if (item && typeof item === 'object' && item.id != null) {
            const idx = mevcutList.findIndex(x => x && x.id === item.id);
            if (idx >= 0) mevcutList[idx] = item; else mevcutList.push(item);
          } else {
            mevcutList.push(item);
          }
        });
        birlesik[key] = mevcutList;
      } else if (gelenList && typeof gelenList === 'object') {
        const mevcutObj = { ...(DB[key] || {}) };
        Object.entries(gelenList).forEach(([k,v]) => { if (secSet.has(k)) mevcutObj[k] = v; });
        birlesik[key] = mevcutObj;
      }
    });
    replaceObjectContents(DB, applyMigrations(birlesik));
  }

  _vyBekleyenRestoreData = null;
  _vySecim = {};
  saveData();
  closeModal('modal-vy-restore-onay');
  call('renderAll');
  renderVeriYonetimiOzet();
  showToast('Veriler geri yüklendi ✓ Google Drive\'a kaydediliyor...', 'success');
}

export function renderYerelYedekDurumu() {
  const row = document.getElementById('vy-local-backup-row');
  const info = document.getElementById('vy-local-backup-info');
  if(!row || !info) return;
  let raw = null;
  try { raw = localStorage.getItem('finans_local_backup'); } catch(e) {}
  if(!raw) { row.style.display = 'none'; return; }
  try {
    const parsed = JSON.parse(raw);
    info.innerHTML = `💾 Bu tarayıcıda yerel yedek bulundu: <b>${fmtDate(new Date(parsed.tarih))} ${fmtTime(new Date(parsed.tarih))}</b>`;
    row.style.display = 'flex';
  } catch(e) { row.style.display = 'none'; }
}

export function vyRevSecAlan(key) {
  const data = _gdrive._gDriveOnizlemeData;
  if (!data) return;
  const secim = document.getElementById('vy-rev-onizleme-secim');
  if (secim) secim.value = key;
  const f = VY_OZET_ALANLAR.find(x=>x.k===key);
  const tablo = document.getElementById('vy-rev-onizleme-tablo');
  if (tablo) { tablo.innerHTML = _vyAlanSatirHTML(f, data[key]); _vyBindAlanSatir(tablo); }
}

export function exportKategorilerJSON() {
  const data = (DB.kategoriler || []).map(k => ({ ad: k.ad, ikon: k.ikon || '', tur: k.tur || 'gider' }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const tarih = localDateStr ? localDateStr(new Date()) : new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `kategoriler_${tarih}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Kategoriler JSON olarak indirildi');
}

export function importKategorilerJSON(evt) {
  const file = evt.target.files && evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let arr;
    try {
      arr = JSON.parse(reader.result);
      if (!Array.isArray(arr)) throw new Error('JSON bir dizi (array) olmalı');
    } catch (err) {
      showToast('Geçersiz JSON dosyası: ' + (err.message || err), 'error');
      evt.target.value = '';
      return;
    }
    const temiz = arr
      .filter(x => x && typeof x === 'object' && x.ad)
      .map(x => ({
        ad: String(x.ad).trim(),
        ikon: x.ikon ? String(x.ikon).trim() : '📦',
        tur: ['gider', 'gelir', 'diger'].includes(x.tur) ? x.tur : 'gider'
      }))
      .filter(x => x.ad);
    if (!temiz.length) {
      showToast('Dosyada içe aktarılabilir kategori bulunamadı', 'error');
      evt.target.value = '';
      return;
    }
    showConfirm(`${temiz.length} kategori bulundu. Mevcut listeyle birleştirilsin mi? (Aynı isim + tür eşleşenler atlanır, yenileri eklenir)`, () => {
      if (!DB.kategoriler) DB.kategoriler = [];
      let eklenen = 0, atlanan = 0;
      temiz.forEach(o => {
        const mevcut = new Set(DB.kategoriler.map(_katKey));
        if (mevcut.has(_katKey(o))) { atlanan++; return; }
        DB.kategoriler.push({ id: uid(), ad: o.ad, ikon: o.ikon, tur: o.tur });
        eklenen++;
      });
      saveData();
      renderKategoriGrid();
      populateKategoriSelects();
      showToast(`${eklenen} kategori eklendi${atlanan ? `, ${atlanan} tanesi zaten vardı` : ''}`);
    }, { title: 'Birleştirilsin mi?', okLabel: 'Birleştir', okClass: 'btn-primary' });
    evt.target.value = '';
  };
  reader.onerror = () => { showToast('Dosya okunamadı', 'error'); evt.target.value = ''; };
  reader.readAsText(file, 'utf-8');
}

// ---- (2. tur refactor: 02-core-app-engine.js'den taşındı) ----
// ═══════════════════════════════════════════════════════
// VERİ YÖNETİMİ — Tüm Sistem Yedekleme / Geri Yükleme
// ═══════════════════════════════════════════════════════

// Özet kartlarında gösterilecek kategori → etiket eşlemesi
export var VY_OZET_ALANLAR = [
  // ── Ana işlem verileri ──────────────────────────────────────────────
  {k:'islemler',             ad:'İşlemler',             ikon:'💳', grup:'veri'},
  {k:'kartOdemeleri',        ad:'Kart Ödemeleri',        ikon:'🧾', grup:'veri'},
  {k:'mevduatlar',           ad:'Mevduatlar',            ikon:'🏦', grup:'veri'},
  {k:'kiralar',              ad:'Kiralar',               ikon:'🏠', grup:'veri'},
  {k:'maaslar',              ad:'Maaşlar',               ikon:'💼', grup:'veri'},
  {k:'eldenler',             ad:'Elden İşlem',           ikon:'💵', grup:'veri'},
  {k:'krediler',             ad:'KMH Krediler',          ikon:'📊', grup:'veri'},
  {k:'bireyselKrediler',     ad:'Bireysel Krediler',     ikon:'🏧', grup:'veri'},
  {k:'abonelikler',          ad:'Abonelikler',           ikon:'🔄', grup:'veri'},
  {k:'ozelExtreler',         ad:'Özel Ekstreler',        ikon:'📋', grup:'veri'},
  // ── Hesap ve kart bilgileri ─────────────────────────────────────────
  {k:'hesaplar',             ad:'Hesaplar',              ikon:'🏦', grup:'hesap'},
  {k:'kartlar',              ad:'Kredi Kartları',        ikon:'💳', grup:'hesap'},
  {k:'kisiler',              ad:'Kişiler',               ikon:'👤', grup:'hesap'},
  // ── Tanımlamalar ────────────────────────────────────────────────────
  {k:'bankalar',             ad:'Bankalar',              ikon:'🏛️', grup:'tanim'},
  {k:'kategoriler',          ad:'Kategoriler',           ikon:'🏷️', grup:'tanim'},
  {k:'hesapTurleri',         ad:'Hesap Türleri',         ikon:'📂', grup:'tanim'},
  {k:'urunTipler',           ad:'Ürün Tipleri',          ikon:'📦', grup:'tanim'},
  {k:'krediTipleri',         ad:'Kredi Tipleri',         ikon:'📑', grup:'tanim'},
  {k:'kartAltyapilari',      ad:'Kart Altyapıları',      ikon:'🖧',  grup:'tanim'},
  {k:'paraBirimleri',        ad:'Para Birimleri',        ikon:'💱', grup:'tanim'},
  {k:'tatiller',             ad:'Tatil Günleri',         ikon:'📅', grup:'tanim'},
  {k:'subeler',              ad:'Şubeler',               ikon:'🏢', grup:'tanim'},
  // ── Oran tabloları ──────────────────────────────────────────────────
  {k:'stopajOranlari',       ad:'Stopaj Oranları',       ikon:'%',  grup:'oran'},
  {k:'kkdfOranlari',         ad:'KKDF Oranları',         ikon:'%',  grup:'oran'},
  {k:'bsmvOranlari',         ad:'BSMV Oranları',         ikon:'%',  grup:'oran'},
  {k:'kmhFaizOranlari',      ad:'KMH Faiz Oranları',     ikon:'%',  grup:'oran'},
  {k:'asgariOdemeKurallari', ad:'Asgari Ödeme Kuralları',ikon:'📐', grup:'oran'},
  {k:'ortakLimitGruplari',   ad:'Ortak Limit Grupları',  ikon:'🔗', grup:'oran'},
  {k:'nakitAvansCurlar',     ad:'Nakit Avans Kurlar',    ikon:'💹', grup:'oran'},
  {k:'nakitAvansTavanlar',   ad:'Nakit Avans Tavanlar',  ikon:'⬆️', grup:'oran'},
];

