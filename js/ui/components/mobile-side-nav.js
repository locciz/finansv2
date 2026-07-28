// ============================================================
// js/ui/components/mobile-side-nav.js
// Mobil yan menü (hamburger nav) aç/kapat/filtrele. NOT: ekstreler.js içine gömülüydü, sayfaya özgü değil — genel navigasyon bileşeni olduğu için components/ altına taşındı.
// Kod SATIR SATIR aynı kaldı; sadece dosya sınırı/gruplama değişti.
// ============================================================
export function snavMobileOpen() {
  const sb = document.getElementById('snav-sidebar');
  if(sb) {
    if (!sb._snavHomeMarker) {
      const marker = document.createComment('snav-sidebar-home');
      sb.parentNode.insertBefore(marker, sb);
      sb._snavHomeMarker = marker;
    }
    if (sb.parentNode !== document.body) document.body.appendChild(sb);
    sb.classList.add('mobile-open');
  }
  let ov = document.getElementById('snav-overlay');
  if(!ov) {
    ov = document.createElement('div');
    ov.id = 'snav-overlay';
    ov.className = 'snav-overlay';
    ov.onclick = snavMobileClose;
    document.body.appendChild(ov);
  }
  ov.classList.add('open');
}

export function snavMobileClose() {
  const sb = document.getElementById('snav-sidebar');
  if(sb) {
    sb.classList.remove('mobile-open');
    // Kayma animasyonu bitince (220ms) orijinal yerine geri taşı, DOM'u temiz tut
    setTimeout(() => {
      if (!sb.classList.contains('mobile-open') && sb._snavHomeMarker && sb._snavHomeMarker.parentNode) {
        sb._snavHomeMarker.parentNode.insertBefore(sb, sb._snavHomeMarker);
      }
    }, 260);
  }
  const ov = document.getElementById('snav-overlay');
  if(ov) ov.classList.remove('open');
}

export function snavMobileBack() { snavMobileOpen(); }

export function snavFilter(q) {
  const term = q.toLowerCase().trim();
  document.querySelectorAll('.snav-item').forEach(item => {
    const text = item.textContent.toLowerCase();
    item.dataset.hidden = (term && !text.includes(term)) ? 'true' : 'false';
  });
  // Hide group labels if all items hidden
  document.querySelectorAll('.snav-group').forEach(grp => {
    const visible = [...grp.querySelectorAll('.snav-item')].some(i => i.dataset.hidden !== 'true');
    grp.dataset.hidden = visible ? 'false' : 'true';
  });
}

// ============================================================
// [DI-MIGRATION] ui.components.mobileSideNav — container'a kayıt
// ============================================================
import { provide } from '@core/container.js';
provide('ui.components.mobileSideNav', {
  snavMobileOpen, snavMobileClose, snavMobileBack, snavFilter,
});

