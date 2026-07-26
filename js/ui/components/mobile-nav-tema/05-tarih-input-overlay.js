import { applyFormatToken, fmtDate, localDateStr } from '../../../core/format.js';
import { FORMAT_CONFIG } from '../../../core/state.js';
// [ES module geçişi] Bu dosya eskiden tüm içeriği initDateInputOverride adlı
// bir IIFE içinde tutuyordu (kapsam izolasyonu için, dışarıya window.X ile
// açılıyordu). ES module'de her dosya zaten kendi module scope'una sahip
// olduğundan IIFE kaldırıldı, içerik module top-level'ına taşındı; dışa açılan
// fonksiyonlar artık gerçek `export` ile veriliyor.

  // Gerçek inputun hesaplanmış stillerinden fake kutuya kopyalanacaklar
  const COPY_PROPS = [
    'width','height','minWidth','maxWidth','padding',
    'paddingTop','paddingRight','paddingBottom','paddingLeft',
    'fontSize','fontFamily','fontWeight','lineHeight','letterSpacing',
    'color','background','backgroundColor','backgroundImage',
    'border','borderTop','borderRight','borderBottom','borderLeft',
    'borderRadius','borderColor','boxShadow',
    'outline','outlineOffset',
    'textAlign','verticalAlign',
    'boxSizing','flex','flexGrow','flexShrink','flexBasis',
  ];
  // Tema değişiminde yenilenecek alt küme — boyut/layout özelliklerine
  // DOKUNMAZ (real input .date-wrap içinde width:32px'e sabitlendiği için
  // tüm COPY_PROPS'u tekrar kopyalamak fake input'u o küçük genişliğe düşürür).
  const THEME_PROPS = [
    'color', 'background', 'backgroundColor', 'backgroundImage',
    'border', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft',
    'borderColor', 'boxShadow', 'outline', 'outlineOffset',
  ];

  function copyStyles(src, dst) {
    const cs = getComputedStyle(src);
    COPY_PROPS.forEach(p => {
      try { dst.style[p] = cs[p]; } catch(e) {}
    });
    // opacity ve color'ı gerçek değeriyle al
    dst.style.opacity = '1';
    dst.style.position = 'relative';
  }

  // Sadece renk/arka plan/kenarlık gibi temaya bağlı özellikleri yeniler;
  // genişlik/yükseklik gibi layout özelliklerini olduğu gibi bırakır.
  function copyThemeStyles(src, dst) {
    const cs = getComputedStyle(src);
    THEME_PROPS.forEach(p => {
      try { dst.style[p] = cs[p]; } catch(e) {}
    });
  }

  // Dar taksit tablosu hücreleri gibi yerlerde gün adı (EEEE/EEE) formatı
  // sığmadığından, data-date-compact="1" işaretli inputlarda gün adını
  // pattern'dan çıkarıp kısa (dd/MM/yyyy tarzı) gösteriyoruz.
  function stripWeekdayToken(pattern) {
    const stripped = pattern.replace(/[,\s]*EEEE[,\s]*/,' ').replace(/[,\s]*EEE[,\s]*/,' ').trim();
    return stripped || 'dd/MM/yyyy';
  }

  function activePattern(inp) {
    const base = (FORMAT_CONFIG && FORMAT_CONFIG.tarihFormat) || 'dd/MM/yyyy';
    return (inp && inp.dataset && inp.dataset.dateCompact === '1') ? stripWeekdayToken(base) : base;
  }

  function getDisplayText(inp) {
    const v = inp.value; // yyyy-MM-dd
    if(!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
    try {
      const dt = new Date(v+'T00:00:00');
      return applyFormatToken(activePattern(inp), dt);
    } catch(e) { return v; }
  }

  function updateFake(inp) {
    const txtInp = inp._dateFake; // artık text input
    if(!txtInp) return;
    const display = getDisplayText(inp);
    txtInp.value = display;
    txtInp.style.color = '';
    txtInp.placeholder = activePattern(inp);
    const wrap = txtInp.closest('.date-wrap');
    if(wrap) {
      const isEmpty = !display;
      wrap.classList.toggle('date-wrap-empty', isEmpty);
      txtInp.style.paddingRight = isEmpty ? '54px' : '28px';
    }
  }

  // FORMAT_CONFIG.tarihFormat string'ini parse edip yyyy-MM-dd döndür
  function parseDisplayToYMD(str) {
    if (!str || !str.trim()) return null;
    const s = str.trim();

    // ── Hızlı giriş: ayraçsız sayı dizisi ───────────────────────────────
    if ((!FORMAT_CONFIG || FORMAT_CONFIG.tarihGirisKolay !== false) && /^\d+$/.test(s)) {
      const pattern = (FORMAT_CONFIG && FORMAT_CONFIG.tarihFormat) || 'dd/MM/yyyy';
      // Pattern'daki token sırasını çıkar (yyyy mi önce, dd mi?)
      const tokenOrder = [];
      pattern.replace(/(yyyy|yy|MM|M|dd|d)/g, (tok) => { tokenOrder.push(tok); });
      // dd/MM/yyyy → [dd, MM, yyyy] → d:2, M:2, y:4
      const lens = tokenOrder.map(t => t === 'yyyy' ? 4 : t === 'yy' ? 2 : 2);
      const totalMin = lens.reduce((a, b) => a + b, 0) - (lens[2] === 4 ? 2 : 0); // 6 veya 8

      let D, M, Y;
      if (s.length === 8) {
        // 8 rakam: tam yıl (01012025)
        let pos = 0;
        const parts = tokenOrder.map((tok, i) => {
          const len = tok === 'yyyy' ? 4 : 2;
          const val = parseInt(s.slice(pos, pos + len), 10);
          pos += len;
          return { tok, val };
        });
        parts.forEach(({ tok, val }) => {
          if (tok === 'yyyy') Y = val;
          else if (tok === 'MM' || tok === 'M') M = val;
          else if (tok === 'dd' || tok === 'd') D = val;
        });
      } else if (s.length === 6) {
        // 6 rakam: kısa yıl (010125) — 2-2-2 sırasına göre
        let pos = 0;
        const parts = tokenOrder.map((tok) => {
          const val = parseInt(s.slice(pos, pos + 2), 10);
          pos += 2;
          return { tok, val };
        });
        parts.forEach(({ tok, val }) => {
          if (tok === 'yyyy' || tok === 'yy') Y = val < 50 ? 2000 + val : 1900 + val;
          else if (tok === 'MM' || tok === 'M') M = val;
          else if (tok === 'dd' || tok === 'd') D = val;
        });
      } else if (s.length === 4) {
        // 4 rakam: gün ve ay, yıl bu yıl (0101 → 01/01/bu yıl)
        // İlk token dd/MM, ikinci MM/dd sırasına göre
        const t0 = tokenOrder[0], t1 = tokenOrder[1];
        const v0 = parseInt(s.slice(0, 2), 10);
        const v1 = parseInt(s.slice(2, 4), 10);
        Y = new Date().getFullYear();
        if (t0 === 'dd' || t0 === 'd') { D = v0; M = v1; }
        else { M = v0; D = v1; }
      }

      if (Y && M && D && M >= 1 && M <= 12 && D >= 1 && D <= 31) {
        return `${Y}-${String(M).padStart(2,'0')}-${String(D).padStart(2,'0')}`;
      }
    }

    // ── Normal parse: format pattern ile ─────────────────────────────────
    const pattern = (FORMAT_CONFIG && FORMAT_CONFIG.tarihFormat) || 'dd/MM/yyyy';
    const tokens = [];
    let regStr = pattern.replace(/(dd|MM|yyyy|yy|d|M)/g, (tok) => {
      tokens.push(tok);
      if(tok === 'yyyy') return '(\\d{4})';
      if(tok === 'yy')   return '(\\d{2})';
      return '(\\d{1,2})';
    });
    // Ayraçları isteğe bağlı yap (hızlı giriş aktifse)
    if (!FORMAT_CONFIG || FORMAT_CONFIG.tarihGirisKolay !== false) {
      regStr = regStr.replace(/[\/\.\-]/g, (ch) => '(?:' + ch + ')?');
    }
    regStr = '^' + regStr + '$';
    try {
      const m = s.match(new RegExp(regStr));
      if(!m) return null;
      let Y, M, D;
      // Ayraç isteğe bağlıysa grup sayısı değişiyor — sadece rakam gruplarını al
      let digitGroups;
      if (!FORMAT_CONFIG || FORMAT_CONFIG.tarihGirisKolay !== false) {
        digitGroups = [];
        let g = 1;
        // token'ların konumlarını bul
        let testPat = pattern.replace(/(dd|MM|yyyy|yy|d|M)/g, (tok) => {
          tokens; // already populated
          if(tok === 'yyyy') return '(\\d{4})';
          if(tok === 'yy')   return '(\\d{2})';
          return '(\\d{1,2})';
        });
        // Ayraç sayısı kadar isteğe bağlı grup var — rakam grupları tek-numara indexed
        // Daha basit: tüm match gruplarından sadece rakam olanları al
        digitGroups = Array.from(m).slice(1).filter(v => v && /^\d+$/.test(v));
        tokens.forEach((tok, i) => {
          const v = parseInt(digitGroups[i] || '0', 10);
          if(tok==='yyyy') Y = v;
          else if(tok==='yy') Y = v < 50 ? 2000+v : 1900+v;
          else if(tok==='MM'||tok==='M') M = v;
          else if(tok==='dd'||tok==='d') D = v;
        });
      } else {
        tokens.forEach((tok, i) => {
          const v = parseInt(m[i+1], 10);
          if(tok==='yyyy') Y = v;
          else if(tok==='yy') Y = v < 50 ? 2000+v : 1900+v;
          else if(tok==='MM'||tok==='M') M = v;
          else if(tok==='dd'||tok==='d') D = v;
        });
      }
      if(!Y||!M||!D||M<1||M>12||D<1||D>31) return null;
      return `${Y}-${String(M).padStart(2,'0')}-${String(D).padStart(2,'0')}`;
    } catch(e) { return null; }
  }

  function wrapInput(inp) {
    if(inp._dateOverlayDone) return;
    inp._dateOverlayDone = true;

    const parent = inp.parentNode;
    if(!parent) return;

    const cs = getComputedStyle(inp);

    // Wrapper
    const wrap = document.createElement('div');
    wrap.className = 'date-wrap';
    wrap.style.width  = inp.style.width  || (cs.width !== 'auto' ? cs.width : '100%');
    wrap.style.height = inp.style.height || cs.height;
    wrap.style.display = 'inline-flex';
    wrap.style.verticalAlign = cs.verticalAlign || 'middle';
    if(inp.style.minWidth) wrap.style.minWidth = inp.style.minWidth;

    // Elle yazılabilir text input (görünen kutu)
    const txtInp = document.createElement('input');
    txtInp.type = 'text';
    txtInp.className = 'date-fake-input';
    txtInp.placeholder = activePattern(inp);
    txtInp.autocomplete = 'off';
    txtInp.spellcheck = false;
    copyStyles(inp, txtInp);
    txtInp.style.flex = '1';
    txtInp.style.minWidth = '0';
    txtInp.style.paddingRight = '28px';
    txtInp.style.boxSizing = 'border-box';
    txtInp.style.cursor = 'text';

    // Takvim ikonu butonu
    const iconBtn = document.createElement('button');
    iconBtn.type = 'button';
    iconBtn.className = 'date-fake-icon-btn';
    iconBtn.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 2v2.5M11 2v2.5M2 6.5h12"/></svg>';
    iconBtn.tabIndex = -1;
    iconBtn.title = 'Takvim aç';

    // Boşken görünen, arka plansız "bugün" kısayol butonu — sadece alan boş
    // olduğunda beliriyor (dolu alanlarda göze batmasın, yer kaplamasın diye).
    const todayBtn = document.createElement('button');
    todayBtn.type = 'button';
    todayBtn.className = 'date-today-btn';
    todayBtn.textContent = 'bugün';
    todayBtn.tabIndex = -1;
    todayBtn.title = 'Bugünün tarihini gir';
    todayBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      inp.value = localDateStr(new Date());
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      txtInp.focus();
    });

    inp._dateFake = txtInp;

    // Gizli gerçek date input — değer deposu, sadece ikon bölgesinde tıklanabilir
    // (boyut/opacity/pointer-events artık .date-wrap input[type="date"] CSS kuralından geliyor)
    inp.tabIndex = -1;

    // DOM yerleştir
    parent.insertBefore(wrap, inp);
    wrap.appendChild(txtInp);
    wrap.appendChild(todayBtn);
    wrap.appendChild(iconBtn);
    wrap.appendChild(inp);

    // İlk değeri göster
    updateFake(inp);

    // Takvim ikonu artık gerçek tıklanabilir hedef (32px'lik bölgeyi kaplıyor).
    // Native input'un kendi click-passthrough davranışına güvenmek yerine
    // (bazı tarayıcılarda/durumlarda ilk tıklamada picker açmıyordu) doğrudan
    // showPicker() çağırıyoruz — her tıklamada garanti şekilde açılır.
    iconBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        if (typeof inp.showPicker === 'function') inp.showPicker();
        else { inp.focus(); inp.click(); }
      } catch(ex) { /* sessizce yoksay */ }
    });

    // Native picker'dan değer gelince text'i güncelle
    inp.addEventListener('change', () => updateFake(inp));
    inp.addEventListener('input',  () => updateFake(inp));

    // Kullanıcı text inputa yazınca → parse edip gerçek inputa aktar
    txtInp.addEventListener('input', () => {
      const raw = txtInp.value;
      const ymd = parseDisplayToYMD(raw);
      if(ymd) {
        inp.value = ymd;
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        txtInp.style.color = '';
        // Geçerli tarih → görsel formatı overlay'e yaz (ayraçsız yazıldıysa düzelt)
        if ((!FORMAT_CONFIG || FORMAT_CONFIG.tarihGirisKolay !== false) && /^\d+$/.test(raw.trim())) {
          try { txtInp.value = fmtDate(ymd); } catch(e) {}
        }
      } else {
        txtInp.style.color = inp.value ? '' : 'var(--danger, #fb7185)';
        if(!txtInp.value.trim()) { inp.value = ''; inp.dispatchEvent(new Event('change', { bubbles: true })); }
      }
    });

    // Blur'da: geçerli değilse restore et
    txtInp.addEventListener('blur', () => {
      const raw = txtInp.value;
      const ymd = parseDisplayToYMD(raw);
      if(!raw.trim()) {
        inp.value = '';
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      } else if(ymd) {
        // Doğru parse edildi — görsel formatı normalize et
        inp.value = ymd;
        try { txtInp.value = fmtDate(ymd); } catch(e) {}
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        updateFake(inp); // geçersiz → eski değeri göster
      }
      txtInp.style.color = '';
    });
  }

  function applyToAll() {
    document.querySelectorAll('input[type="date"]:not([data-date-no-overlay])').forEach(wrapInput);
  }
export { applyToAll };

  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyToAll);
  } else {
    // Circular import zinciri (state.js → app-core-base.js →
    // 05-tarih-input-overlay.js → state.js) nedeniyle, bu modül evaluate
    // olduğu anda state.js henüz tam init olmamış olabilir (FORMAT_CONFIG
    // undefined). Top-level çağrıyı bir microtask'a erteleyerek tüm modül
    // grafiğinin evaluate'inin bitmesini bekliyoruz.
    Promise.resolve().then(applyToAll);
  }

  // Modal açılışlarında tarih overlay'lerini yenileme davranışı artık
  // doğrudan modal-genel.js içindeki openModal fonksiyonunun gövdesinde
  // (bkz. openModalDateOverlayRefresh çağrısı). ES module export'ları
  // immutable binding olduğu için buradan window.openModal = wrapped(...)
  // ile sarmalamak mümkün değildi; davranış birebir korunarak taşındı.
  export function openModalDateOverlayRefresh(id) {
    setTimeout(() => {
      applyToAll();
      // Modal içindeki tüm date inputlarının değerini fake inputa zorla
      const modalEl = document.getElementById(id);
      if(modalEl) {
        modalEl.querySelectorAll('input[type="date"]').forEach(inp => {
          if(inp.value) inp.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }
    }, 80);
  }
  /* rf-v86: date input dinamik izleyici kaldırıldı; render/openModal sonrası applyToAll çağrılır. */
  // FORMAT_CONFIG değişince tüm fake metinleri yenile
  export function refreshDateOverlays() {
    document.querySelectorAll('input[type="date"][data-date-overlay-done]').forEach(inp => {
      updateFake(inp);
    });
    // Sarmalanmış inputları da tara
    document.querySelectorAll('.date-wrap input[type="date"]').forEach(inp => {
      updateFake(inp);
    });
  }

  // Tema değişince (dark/light), copyStyles ilk sarmalamada donduğu için
  // fake input'ların arka plan/yazı rengi eski temada kalır — bunu yeniden
  // senkronize eder. Tema toggle fonksiyonundan çağrılır.
  // NOT: copyThemeStyles kullanılır (copyStyles değil) — gerçek input bu
  // noktada .date-wrap içinde width:32px'e sabitlenmiş durumda, tam
  // COPY_PROPS listesini tekrar kopyalamak fake input'u da 32px'e küçültür.
  export function refreshDateOverlayStyles() {
    document.querySelectorAll('.date-wrap').forEach(wrap => {
      const realInp = wrap.querySelector('input[type="date"]');
      const fakeInp = wrap.querySelector('.date-fake-input');
      if (realInp && fakeInp) copyThemeStyles(realInp, fakeInp);
    });
  }

// [KALDIRILDI] parseDateInput(v) — no-op yardımcı ("value zaten yyyy-MM-dd"),
// hiçbir yerden çağrılmıyordu (ölü kod taraması, 2026-07).
