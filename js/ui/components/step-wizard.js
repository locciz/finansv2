import { fmtCur, fmtDate } from '../../core/format.js';
import { _tutarAsiyorMu } from '../../domain/hesaplamalar.js';
// ============================================================
// js/ui/components/step-wizard.js
// Step wizard (adım sihirbazı) modal'larındaki ortak DOM güncelleme
// mantığı: aktif panel, adım noktaları (dots) ve bağlantı çizgileri
// (lines) durumunu günceller.
//
// Bu kod 6 farklı dosyada (transfer-modal, abonelik, elden,
// hesap-form-crud, kart-form, kart-odeme) BİREBİR AYNI 12 satır
// olarak kopyalanmıştı (md5 ile doğrulandı). DOM'dan başka hiçbir
// şeye dokunmaz (DB'ye yazmaz, iş mantığı içermez) — bu yüzden
// paylaşılan bir bileşene çıkarmak düşük riskli.
// ============================================================

  /**
   * @param {HTMLElement} modal - .swiz-step-panel / .swiz-step-dot-wrap /
   *   .swiz-step-line elemanlarını içeren modal kökü
   * @param {number} step - aktif adım numarası
   */
  export function swizUpdateStepIndicator(modal, step) {
    if (!modal) return;
    modal.querySelectorAll('.swiz-step-panel').forEach(p => {
      p.classList.toggle('is-active', Number(p.dataset.stepPanel) === step);
    });
    modal.querySelectorAll('.swiz-step-dot-wrap').forEach(w => {
      const n = Number(w.dataset.step);
      w.classList.toggle('is-active', n === step);
      w.classList.toggle('is-done', n < step);
    });
    modal.querySelectorAll('.swiz-step-line').forEach(l => {
      const n = Number(l.dataset.line);
      l.classList.toggle('is-done', n < step);
    });
  }

  // ── Bakiye aşımı uyarı ipucu ──────────────────────────────────────
  // 5 farklı dosyada (transfer-modal, abonelik, elden, kart-ödeme,
  // kira) birebir kopyalanmış "girilen tutar kullanılabilir bakiyeyi
  // aşıyor mu?" ipucu güncelleme mantığından çıkarıldı (md5 ile
  // doğrulandı). DOM'a sadece verilen `hint` elemanı üzerinden
  // dokunur; hangi elemanın/hangi kullanılabilir bakiyenin
  // kullanılacağına çağıran fonksiyon karar verir.
  //
  // @param {HTMLElement} hint - ipucu metnini gösteren DOM elemanı
  // @param {number} tutar - girilen tutar
  // @param {{tutar:number, pb:string}} kb - kullanılabilir bakiye {tutar, pb (para birimi)}
  export function swizBakiyeHintGuncelle(hint, tutar, kb) {
    if (!hint || !kb) return;
    if (_tutarAsiyorMu(tutar, kb.tutar)) {
      hint.innerHTML = `⚠ Kullanılabilir bakiye <b>${fmtCur(kb.tutar, kb.pb)}</b> — girilen tutar bakiyeyi aşıyor`;
      hint.style.color = 'var(--danger)';
    } else {
      hint.innerHTML = `Kullanılabilir bakiye: <b>${fmtCur(kb.tutar, kb.pb)}</b>`;
      hint.style.color = 'var(--text3)';
    }
  }

  // ── Özet satırı (label/değer) HTML üreteci ─────────────────────────
  // 4 farklı dosyada (kart-form, kart-ödeme, mevduat-form-wizard,
  // hesap-form-crud) birebir kopyalanmış "onay/özet ekranı satırı"
  // üretecinden çıkarıldı (md5 ile doğrulandı). Saf string üretimi,
  // DOM'a veya DB'ye dokunmaz.
  //
  // @param {string} label - sol taraftaki etiket metni
  // @param {string|number} val - sağ taraftaki değer (HTML olarak basılır)
  // @param {string} [valStyle] - değer span'ine eklenecek ek CSS (örn. renk)
  // @returns {string} HTML satırı
  export function swizOzetSatirHtml(label, val, valStyle='') {
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:11.5px;color:var(--text2)">${label}</span>
      <span style="font-size:12.5px;font-weight:600;color:var(--text);font-family:var(--mono);${valStyle}">${val}</span>
    </div>`;
  }

  // ── Özet satırı (kısa varyant, padding:7px, valStyle yok) ──────────
  // 4 farklı dosyada (transfer-modal, kira, maas, abonelik) birebir
  // kopyalanmış "const satir = (lbl, val) => ..." tek-satırlık özet
  // satırı üretecinden çıkarıldı (md5 ile doğrulandı). Yukarıdaki
  // swizOzetSatirHtml'den farklı: padding 7px (8px değil), valStyle
  // parametresi yok, tek satırda üretiliyor. Görsel farkı korumak için
  // ayrı bir fonksiyon olarak tutuldu, zorla birleştirilmedi.
  //
  // @param {string} lbl - sol taraftaki etiket metni
  // @param {string|number} val - sağ taraftaki değer (HTML olarak basılır)
  // @returns {string} HTML satırı
  export function swizOzetSatirHtmlKisa(lbl, val) {
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">
    <span style="font-size:11.5px;color:var(--text2)">${lbl}</span>
    <span style="font-size:12px;font-weight:600;color:var(--text);font-family:var(--mono)">${val}</span></div>`;
  }

  // ── "Geçmiş kayıt" listesi (limit/oran geçmişi) render iskeleti ────
  // tanimlamalar/05-genel-oran-tablolari.js:renderOtoGunlukOranGecmis,
  // krediler/03-kmh-kredi.js:renderKmhLimitGecmis,
  // kartlar/06-kart-form.js:renderKartLimitGecmis fonksiyonları AYNI
  // DEĞİL (farklı panel ID'si, farklı değer formatlama — para vs yüzde,
  // farklı karşılaştırma alanı — limit vs faizOran, kart versiyonunda
  // ekstra "grup" badge'i var diğerlerinde yok). Bu yüzden üçü ZORLA
  // TEK FONKSİYONA birleştirilmedi. Ama ortak olan "boşsa mesaj göster
  // → sırala → satır+badge (artı/eksi/nötr/ilk/güncel) render et →
  // sil butonunu bağla" İSKELETİ buraya çıkarıldı; her çağıran kendi
  // değer formatlama ve karşılaştırma mantığını callback olarak verir.
  //
  // @param {HTMLElement} panel - içeriğin yazılacağı DOM elementi
  // @param {Array} gecmis - {tarih, bitisTarih?, ...} kayıt dizisi
  // @param {object} opts
  //   @param {(g:object)=>number} opts.deger - karşılaştırılacak sayısal alan (limit, faizOran, vb.)
  //   @param {(g:object)=>string} opts.degerHtml - görüntülenecek değer HTML'i (fmtCur(...) veya "%12 / %5" gibi)
  //   @param {(g:object, fark:number)=>string} [opts.farkHtml] - artı/eksi badge'indeki fark metni (varsayılan: farkı olduğu gibi gösterir)
  //   @param {(g:object, isLast:boolean)=>string} [opts.ekBadgeHtml] - ek badge (örn. kart limitindeki "grup" rozeti); yoksa boş
  //   @param {string} opts.bosMesaj - liste boşken gösterilecek metin
  //   @param {()=>void} opts.silHandler - "son kaydı sil" butonuna bağlanacak fonksiyon
  export function gecmisListesiRenderEt(panel, gecmis, opts) {
    if (!panel) return;
    const sorted = (gecmis || []).slice().sort((a, b) => b.tarih.localeCompare(a.tarih));
    if (!sorted.length) {
      panel.innerHTML = `<div class="gecmis-liste-bos">${opts.bosMesaj}</div>`;
      return;
    }
    const rows = sorted.map((g, idx) => {
      const isLast = idx === 0; // en son kayıt (en yeni)
      const onceki = sorted[idx + 1];
      const gDeger = opts.deger(g);
      const oDeger = onceki ? opts.deger(onceki) : null;
      let badge;
      if (isLast) badge = '<span class="gecmis-badge guncel">▶ Güncel</span>';
      else if (!onceki) badge = '<span class="gecmis-badge ilk">İlk</span>';
      else if (gDeger > oDeger) badge = `<span class="gecmis-badge artti">▲ +${opts.farkHtml ? opts.farkHtml(g, gDeger - oDeger) : (gDeger - oDeger)}</span>`;
      else if (gDeger < oDeger) badge = `<span class="gecmis-badge azaldi">▼ -${opts.farkHtml ? opts.farkHtml(g, oDeger - gDeger) : (oDeger - gDeger)}</span>`;
      else badge = '<span class="gecmis-badge notr">—</span>';
      const ekBadge = opts.ekBadgeHtml ? opts.ekBadgeHtml(g, isLast) : '';
      const deleteBtn = isLast
        ? `<button class="btn btn-danger btn-sm gecmis-sil-btn" title="Son kaydı sil ve öncekine dön">✕</button>`
        : `<span class="gecmis-sil-bosluk"></span>`;
      return `<div class="gecmis-satir">
      <span class="gecmis-tarih" title="${g.bitisTarih ? 'Bitiş: ' + g.bitisTarih : 'Güncel'}">${fmtDate(g.tarih)}</span>
      <span class="gecmis-deger" title="${opts.titleHtml ? opts.titleHtml(g) : opts.degerHtml(g)}">${opts.degerHtml(g)}</span>
      ${badge}
      ${ekBadge}
      ${deleteBtn}
    </div>`;
    }).join('');
    panel.innerHTML = `<div class="gecmis-liste">${rows}</div>`;
    const silBtn = panel.querySelector('.gecmis-sil-btn');
    if (silBtn && opts.silHandler) silBtn.addEventListener('click', () => opts.silHandler());
  }
