import { showToast } from '../modal-genel.js';
import { refreshDateOverlayStyles } from './05-tarih-input-overlay.js';
// ============================================================
// js/ui/components/mobile-nav-tema/02-tema.js
// Açık/koyu tema seçimi ve sistem temasına uyum
// Kod SATIR SATIR aynı kaldı; sadece dosya sınırı/gruplama değişti.
// ============================================================
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('finans-theme', theme);
  const btn = document.getElementById('theme-toggle-btn');
  const icon = document.getElementById('theme-toggle-icon');
  const label = document.getElementById('theme-toggle-label');
  const isLight = theme === 'light';
  if (icon)  icon.textContent  = isLight ? '🌙' : '☀️';
  if (label) label.textContent = isLight ? 'Karanlık Tema' : 'Aydınlık Tema';
  if (btn) {
    if (isLight) {
      btn.style.background    = 'rgba(0,0,0,.06)';
      btn.style.border        = '1px solid rgba(0,0,0,.12)';
      btn.style.color         = 'rgba(15,22,41,.55)';
      btn.onmouseover = () => { btn.style.background='rgba(0,0,0,.1)'; btn.style.color='rgba(15,22,41,.85)'; };
      btn.onmouseout  = () => { btn.style.background='rgba(0,0,0,.06)'; btn.style.color='rgba(15,22,41,.55)'; };
    } else {
      btn.style.background    = 'rgba(255,255,255,.05)';
      btn.style.border        = '1px solid rgba(255,255,255,.08)';
      btn.style.color         = 'rgba(255,255,255,.4)';
      btn.onmouseover = () => { btn.style.background='var(--surface3)'; btn.style.color='var(--text)'; };
      btn.onmouseout  = () => { btn.style.background='rgba(255,255,255,.05)'; btn.style.color='rgba(255,255,255,.4)'; };
    }
  }
  // Mobil tema butonu sync
  updateMobThemeBtn();
  // "Sistemle eşleştir" linkini sadece kullanıcı manuel seçim yaptıysa göster
  const sysLink = document.getElementById('theme-system-link');
  if (sysLink) sysLink.style.display = _temaManuelSecildi ? '' : 'none';
  // Tarih input overlay'leri (fake input) ilk oluşturulduğunda o anki temayı
  // donduruyor — tema değişiminde bunları tazele (yoksa örn. dark mode'a
  // geçince eski açık tema arka planı kalır).
  refreshDateOverlayStyles();
}

export function updateMobThemeBtn() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const mobIcon  = document.getElementById('mob-theme-icon');
  const mobLabel = document.getElementById('mob-theme-label');
  if (mobIcon)  mobIcon.textContent  = isLight ? '🌙' : '☀️';
  if (mobLabel) mobLabel.textContent = isLight ? 'Karanlık' : 'Aydınlık';
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  // Kullanıcı artık elle seçim yaptı — bundan sonra sistem temasını takip etme
  _temaManuelSecildi = true;
  localStorage.setItem('finans-theme-manuel', '1');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// Sistemin o anki tercihini okur: 'dark' veya 'light'.

export function sistemTemasiniOku() {
  try {
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  } catch(e) {
    return 'dark';
  }
}

export let _temaManuelSecildi = localStorage.getItem('finans-theme-manuel') === '1';

// Sayfa açılışında: kullanıcı daha önce elle seçim yaptıysa onu kullan,
// yapmadıysa iOS/Android/Windows/macOS/Linux farketmeksizin işletim
// sisteminin o anki aydınlık/karanlık tercihini otomatik uygula.
(function() {
  const saved = localStorage.getItem('finans-theme');
  const tema = _temaManuelSecildi && saved ? saved : sistemTemasiniOku();
  applyTheme(tema);
})();

// Sistem teması canlı değişirse (örn. telefon gece moduna otomatik geçti,
// Windows/macOS'ta saatle tema değişti) ve kullanıcı hiç elle seçim
// yapmadıysa, uygulama temasını da anında günceller.
(function() {
  if (!window.matchMedia) return;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e) => {
    if (_temaManuelSecildi) return; // kullanıcı tercihi varsa sistemi takip etme
    applyTheme(e.matches ? 'dark' : 'light');
  };
  if (mq.addEventListener) mq.addEventListener('change', handler);
  else if (mq.addListener) mq.addListener(handler); // eski Safari/WebView desteği
})();

// Ayarlar ekranındaki "Sistemle Eşleştir" seçeneği için: manuel kilidi
// kaldırıp o anki sistem temasına geri döner.

export function temaSistemeDondur() {
  _temaManuelSecildi = false;
  localStorage.removeItem('finans-theme-manuel');
  applyTheme(sistemTemasiniOku());
  showToast('Tema artık sistemle otomatik eşleşiyor');
}

/* rf-v85: eski global observer ağırlıklı UX katmanı kaldırıldı; hafif prosedürel katman aşağıda. */
// ═══════════════════════════════════════════════════════════════════
// OTOMATİK BAKİYE GÜNCELLEME SİSTEMİ v1
// Kira, Maaş, Elden, Mevduat → Hesap bakiyesi otomatik yansır
// ═══════════════════════════════════════════════════════════════════

// Hangi işlemlerin bakiyeye yansıtıldığını takip eden log (çift işlemi önler)
// Her kayıt: "tip:id:key:durum" → ödenen tutar
// DB.otoBakiyeLog = {}  şeklinde saklanır

