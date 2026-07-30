import { inject } from '@core/container.js';
const _coreState = inject('core.state');
const _kurServisleri = inject('services.kurServisleri');
const _wrapRegistry = inject('core.wrapRegistry');
// core.appCoreBase container'da kayıtlı (Tur 4) — bu turda çevrildi.
const _appCoreBase = inject('core.appCoreBase');
const applyMigrations = (...a) => _appCoreBase.applyMigrations(...a);
import { showToast } from '@components/modal-genel.js';
import { _asgariKuralPbFiltreRestored, set_asgariKuralPbFiltreRestored } from '@pages/asgari-odeme.js';
import { _extreFiltreRestored, _katFiltreRestored, set_extreFiltreRestored, set_katFiltreRestored } from '@pages/ekstreler/02-ekstre-render.js';
import { _hesapFiltreRestored, set_hesapFiltreRestored } from '@pages/hesaplar/04-hesap-liste-render.js';
import { _islemFiltreRestored, set_islemFiltreRestored } from '@pages/islemler/03-islem-liste-render.js';
import { VY_OZET_ALANLAR, vyDoldurOnayModal, vyRevSecAlan } from '@pages/veri-yonetimi.js';
import { closeModal, openModal } from '@components/modal-genel.js';
// ============================================================
// js/services/gdrive.js — Google Drive senkronizasyon servisi
// (OAuth token yönetimi, veri yükleme/kaydetme, sürüm geçmişi)
// ============================================================

// ── Modül state'i ─────────────────────────────────────────────
// Google Drive sürüm geçmişi (revisions) — yanlışlıkla silinen/üzerine yazılan veriyi kurtarmak için
export var _gDriveRevizyonListesi = [];
export var _gDriveSeciliRevizyonId = null;
// [ES module] Eskiden window._gDriveOnizlemeData ile tutuluyordu;
// veri-yonetimi.js (vyRevSecAlan) bunu okuyor. Artık gerçek export
// edilen modül state'i üzerinden paylaşılıyor.
export var _gDriveOnizlemeData = null;
// Client ID koda gömülü — kullanıcıdan istenmiyor.
export var GDRIVE_CLIENT_ID_DEFAULT = '211586055468-lrfi955ne1jpp2c3ffjt4g0e0dfkoad4.apps.googleusercontent.com';
export var GDRIVE_CLIENT_ID   = GDRIVE_CLIENT_ID_DEFAULT;
export var GDRIVE_SCOPES    = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
export var GDRIVE_FILE_NAME = 'finans_data.json';
export var gTokenClient = null;
export var gAccessToken  = null;
export var gDriveFileId  = null;
export var gDirty        = false; // true = yerelde kaydedilmemiş değişiklik var
// İlk Drive yüklemesi (gDriveLoadFromDrive) tamamlanmadan HİÇBİR şekilde Drive'a
// yazma izni verilmez. Token localStorage'dan SENKRON restore edildiği için
// gDriveReady() sayfa açılır açılmaz true dönebiliyor — ama gerçek veri henüz
// ASENKRON olarak gelmemiş olabilir (DB hâlâ loadData()'nın boş iskeleti).
// Bu aradaki boşlukta tetiklenen herhangi bir saveData() (örn. bir filtre
// render'ı) eskiden bu boş/eksik DB'yi Drive'a yazıp gerçek veriyi SİLİYORDU —
// "bağlandıktan sonra tüm verileri siliyor" bug'ının asıl kök nedeni buydu.
export var gInitialLoadDone = false;
export var gSaving = false;
export var gSaveRetryTimer = null;

// ── Yerel yedekten geri yükleme ───────────────────────────────
export function gDriveGeriYukleYerelYedek() {
  let raw = null;
  try { raw = localStorage.getItem('finans_local_backup'); } catch(e) {}
  if(!raw) { showToast('Yerel yedek bulunamadı', 'error'); return; }
  let parsed;
  try { parsed = JSON.parse(raw); } catch(e) { showToast('Yerel yedek okunamadı', 'error'); return; }
  const ustBilgi = `<div style="margin-bottom:8px">Yerel yedek tarihi: <b>${new Date(parsed.tarih).toLocaleString('tr-TR')}</b></div>`;
  vyDoldurOnayModal(parsed.data, ustBilgi);
}

// ── Sürüm geçmişi modalı ──────────────────────────────────────
export async function gDriveAcRevizyonModal() {
  openModal('modal-drive-revizyon');
  const list = document.getElementById('drive-revizyon-list');
  const onizleme = document.getElementById('drive-revizyon-onizleme');
  const footer = document.getElementById('drive-revizyon-footer');
  footer.style.display = 'none';
  _gDriveSeciliRevizyonId = null;
  onizleme.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text3);font-size:13px;gap:6px;text-align:center"><span style="font-size:26px">👈</span>Önizlemek için soldan bir sürüm seçin</div>`;
  list.innerHTML = '<div class="info-box" style="margin:0">Yükleniyor…</div>';
  if (!gDriveReady() || !gDriveFileId) {
    list.innerHTML = '<div class="info-box" style="margin:0">Google Drive\'a bağlı değilsiniz veya henüz bir dosya bulunamadı.</div>';
    return;
  }
  try {
    const res = await gApiFetch(
      'https://www.googleapis.com/drive/v3/files/' + gDriveFileId + '/revisions?fields=revisions(id,modifiedTime,size)&pageSize=200'
    );
    if (!res || !res.ok) throw new Error(res ? ('HTTP ' + res.status) : 'Yetkilendirme hatası');
    const data = await res.json();
    _gDriveRevizyonListesi = (data.revisions || []).slice().sort((a,b)=> new Date(b.modifiedTime) - new Date(a.modifiedTime));
    if (!_gDriveRevizyonListesi.length) {
      list.innerHTML = '<div class="info-box" style="margin:0">Henüz geçmiş sürüm yok. Drive, dosya birkaç kez kaydedildikten sonra sürüm tutmaya başlar.</div>';
      return;
    }
    _gDriveRenderRevizyonListesi();
  } catch(e) {
    console.error('Drive revizyon listesi hatası:', e);
    list.innerHTML = '<div class="info-box" style="margin:0">Sürüm geçmişi alınamadı: ' + (e.message||e) + '</div>';
  }
}

export async function gDriveOnizleRevizyon(revisionId) {
  if (!gDriveReady() || !gDriveFileId) return;
  _gDriveSeciliRevizyonId = revisionId;
  _gDriveRenderRevizyonListesi();

  const onizleme = document.getElementById('drive-revizyon-onizleme');
  const footer = document.getElementById('drive-revizyon-footer');
  footer.style.display = 'none';
  onizleme.innerHTML = '<div class="info-box" style="margin:0">Yükleniyor…</div>';

  try {
    const res = await gApiFetch(
      'https://www.googleapis.com/drive/v3/files/' + gDriveFileId + '/revisions/' + revisionId + '?alt=media'
    );
    if (!res || !res.ok) throw new Error(res ? ('HTTP ' + res.status) : 'Yetkilendirme hatası');
    const remoteDB = await res.json();

    const dolular = VY_OZET_ALANLAR.map(f => {
      const l = remoteDB[f.k];
      const count = Array.isArray(l) ? l.length : (l && typeof l==='object' ? Object.keys(l).length : 0);
      return { ...f, count };
    });
    const doluAlanlar = dolular.filter(f=>f.count>0);
    const rev = _gDriveRevizyonListesi.find(r=>r.id===revisionId);
    const tarih = rev ? new Date(rev.modifiedTime).toLocaleString('tr-TR', {dateStyle:'medium', timeStyle:'short'}) : '';

    onizleme.innerHTML = `
      <div style="margin-bottom:12px">
        <div style="font-size:13px;font-weight:600;color:var(--text)">${tarih}</div>
        <div style="font-size:11.5px;color:var(--text3);margin-top:2px">Bu sürüm Drive geçmişinden alındı</div>
      </div>
      <div id="vy-rev-ozet-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin-bottom:14px">
        ${dolular.map(f => `
          <div class="vy-rev-alan-chip" data-k="${f.k}" data-clickable="${f.count>0?'1':'0'}" style="cursor:${f.count>0?'pointer':'default'};background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:8px 10px;text-align:center">
            <div style="font-size:13px">${f.ikon||'•'}</div>
            <div style="font-family:var(--mono);font-size:15px;font-weight:700;color:${f.count>0?'var(--sky)':'var(--text3)'}">${f.count}</div>
            <div style="font-size:9.5px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.ad}</div>
          </div>
        `).join('')}
      </div>
      ${doluAlanlar.length ? `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          <span style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.1em;font-weight:700">Veri Önizlemesi</span>
          <select id="vy-rev-onizleme-secim" data-oc-handler="vyRevSecAlan" data-oc-event="change" style="font-size:12px;padding:4px 8px;max-width:220px">
            ${doluAlanlar.map(f=>`<option value="${f.k}">${f.ikon||''} ${f.ad} (${f.count})</option>`).join('')}
          </select>
        </div>
        <div id="vy-rev-onizleme-tablo" style="max-height:240px;overflow:auto;border:1px solid var(--border);border-radius:10px;background:var(--surface2)"></div>
      ` : '<div class="info-box" style="margin:0">Bu sürümde veri bulunamadı.</div>'}
    `;
    // [ES module] onclick="vyRevSecAlan(...)" (özet grid chip'leri) kaldırıldı.
    onizleme.querySelectorAll('.vy-rev-alan-chip[data-clickable="1"]').forEach(chip => {
      chip.addEventListener('click', () => vyRevSecAlan(chip.getAttribute('data-k')));
    });

    _gDriveOnizlemeData = remoteDB;
    if (doluAlanlar.length) vyRevSecAlan(doluAlanlar[0].k);

    footer.style.display = 'flex';
    document.getElementById('drive-revizyon-geri-yukle-btn').onclick = () => {
      const ustBilgi = `<div style="margin-bottom:8px">Bu sürüm Drive geçmişinden alındı: <b>${tarih}</b></div>`;
      closeModal('modal-drive-revizyon');
      vyDoldurOnayModal(remoteDB, ustBilgi);
    };
  } catch(e) {
    console.error('Drive revizyon önizleme hatası:', e);
    onizleme.innerHTML = '<div class="info-box" style="margin:0">Sürüm yüklenemedi: ' + (e.message||e) + '</div>';
    showToast('Sürüm yüklenemedi: ' + (e.message||e), 'error');
  }
}

// ── Bağlantı durumu / token yönetimi ──────────────────────────
export function gDriveReady() {
  return !!gAccessToken;
}

export function gDriveSetStatus(msg, color) {
  const el = document.getElementById('gdrive-sync-status');
  if (el) { el.textContent = msg; el.style.color = color || 'var(--text3)'; }
}

// gDriveInit, gDriveSignIn ve gDriveSilentRefresh'in initTokenClient callback'leri
// birebir aynı işi yapıyordu: token'ı kaydet, kullanıcı bilgisini çek, Drive'dan
// yükle, N dakika kala otomatik yenilemeyi planla. Tek yerde topluyoruz.
export function _gDriveTokenAlindi(resp, opts) {
  opts = opts || {};
  if (resp.error) {
    if (opts.onError) opts.onError(resp.error);
    return;
  }
  gAccessToken = resp.access_token;
  const expMs = (resp.expires_in || 3600) * 1000;
  gFetchUserInfo(expMs);
  if (opts.loadFromDrive !== false) gDriveLoadFromDrive();
  if (!isIOSSafari()) {
    setTimeout(() => gDriveSilentRefresh(), expMs - 10 * 60 * 1000);
  }
}

export function gDriveInit() {
  GDRIVE_CLIENT_ID = localStorage.getItem('gdrive_client_id') || GDRIVE_CLIENT_ID_DEFAULT;
  // Restore saved token from localStorage (short-lived, just for page refresh)
  const saved = localStorage.getItem('gdrive_token');
  let savedInfo = null;
  if (saved) {
    try {
      const t = JSON.parse(saved);
      if (t.expires > Date.now()) {
        gAccessToken = t.token;
        gDriveShowUserInfo(t.name, t.avatar);
        gDriveLoadFromDrive();
        // Token geçerli — 10 dk kala otomatik yenile
        const msLeft = t.expires - Date.now();
        const refreshIn = Math.max(msLeft - 10 * 60 * 1000, 0);
        if (!isIOSSafari()) {
          setTimeout(() => gDriveSilentRefresh(), refreshIn);
        }
        return;
      }
      // Token süresi dolmuş ama kullanıcı bilgisi var — sessiz yenileme dene
      savedInfo = { name: t.name, avatar: t.avatar };
    } catch(e) {}
  }
  if(typeof google === 'undefined' || !google.accounts) {
    gDriveSetStatus('Google Sign-In yüklenemedi — internet bağlantınızı kontrol edin', 'var(--danger)');
    return;
  }
  gTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GDRIVE_CLIENT_ID,
    scope: GDRIVE_SCOPES,
    callback: (resp) => _gDriveTokenAlindi(resp, {
      onError: (err) => gDriveSetStatus('Hata: ' + err, 'var(--danger)')
    }),
    error_callback: (err) => {
      if(err && (err.type === 'popup_failed_to_open' || err.type === 'popup_closed')) {
		gDriveSetStatus("⚠️ Tarayıcı popup'ı engelledi. Lütfen adres çubuğundaki popup izin ikonuna tıklayın ve sayfayı yenileyin.", 'var(--warn)');
      } else {
        gDriveSetStatus('Giriş hatası: ' + (err && err.type || 'bilinmiyor'), 'var(--danger)');
      }
    }
  });
  // iOS Safari popup engeline takılmamak için süresi dolmuş token'ı otomatik yenileme.
  if (savedInfo) {
    gAccessToken = null;
    localStorage.removeItem('gdrive_token');
    gDriveSetStatus('Oturum süresi doldu. Google ile girişe tekrar bas.', 'var(--warn, orange)');
  }
}

export function gDriveSilentRefresh() {
  if (!GDRIVE_CLIENT_ID || typeof google === 'undefined' || !google.accounts) return;

  if (isIOSSafari()) {
    gDriveSetStatus('Oturum süresi doldu. Google ile girişe tekrar bas.', 'var(--warn, orange)');
    return;
  }

  if (!gTokenClient) {
    gTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GDRIVE_CLIENT_ID,
      scope: GDRIVE_SCOPES,
      callback: (resp) => _gDriveTokenAlindi(resp, { loadFromDrive: false })
    });
  }
  gTokenClient.requestAccessToken({ prompt: '' });
}

export function gFetchUserInfo(expMs) {
  fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: 'Bearer ' + gAccessToken }
  }).then(r => {
    if (!r.ok) throw new Error('userinfo HTTP ' + r.status);
    return r.json();
  }).then(info => {
    const name   = info.name || info.email || 'Kullanıcı';
    const avatar = info.picture || '';
    localStorage.setItem('gdrive_token', JSON.stringify({
      token: gAccessToken,
      expires: Date.now() + (expMs || 3500000),
      name, avatar
    }));
    gDriveShowUserInfo(name, avatar);
  }).catch((err) => {
    console.warn('gFetchUserInfo basarisiz:', err);
    gDriveShowUserInfo('Kullanıcı', '');
  });
}

export function gDriveShowUserInfo(name, avatar) {
  document.getElementById('gdrive-signin-panel').style.display = 'none';
  document.getElementById('gdrive-user-panel').style.display   = '';
  const nameEl   = document.getElementById('gdrive-name');
  const avatarEl = document.getElementById('gdrive-avatar');
  if (nameEl)   nameEl.textContent = name;
  if (avatarEl && avatar) { avatarEl.src = avatar; avatarEl.style.display = ''; }
  gDriveSetStatus('Bağlı', 'var(--success, #4ade80)');
  const tbAvatar = document.getElementById('topbar-profile-avatar');
  const tbFallback = document.getElementById('topbar-profile-fallback');
  if (tbAvatar && avatar) { tbAvatar.src = avatar; tbAvatar.style.display = ''; if (tbFallback) tbFallback.style.display = 'none'; }
}

export function gDriveSignIn() {
  GDRIVE_CLIENT_ID = localStorage.getItem('gdrive_client_id') || GDRIVE_CLIENT_ID_DEFAULT;
  if (!gTokenClient) {
    if(typeof google === 'undefined' || !google.accounts) {
      gDriveSetStatus('Google Sign-In yüklenemedi — internet bağlantınızı kontrol edin', 'var(--danger)');
      return;
    }
    gTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GDRIVE_CLIENT_ID,
      scope: GDRIVE_SCOPES,
      callback: (resp) => _gDriveTokenAlindi(resp, {
        onError: (err) => gDriveSetStatus('Hata: ' + err, 'var(--danger)')
      }),
      error_callback: (err) => {
        if (err && err.type === 'popup_failed_to_open') {
          gDriveSetStatus("Safari popup'ı engelledi. Sayfayı http/https üzerinden açıp butona tekrar bas.", 'var(--warn, orange)');
        } else if (err && err.type === 'popup_closed') {
          gDriveSetStatus('Google giriş penceresi kapatıldı.', 'var(--warn, orange)');
        } else {
          gDriveSetStatus('Google giriş hatası: ' + ((err && err.type) || 'bilinmiyor'), 'var(--danger)');
        }
      }
    });
  }
  gTokenClient.requestAccessToken({ prompt: 'select_account' });
}

export function gDriveSignOut() {
  if (gAccessToken && typeof google !== 'undefined' && google.accounts) google.accounts.oauth2.revoke(gAccessToken);
  gAccessToken  = null;
  gDriveFileId  = null;
  gInitialLoadDone = false;
  localStorage.removeItem('gdrive_token');
  document.getElementById('gdrive-user-panel').style.display   = 'none';
  document.getElementById('gdrive-signin-panel').style.display = '';
  const tbAvatar = document.getElementById('topbar-profile-avatar');
  const tbFallback = document.getElementById('topbar-profile-fallback');
  if (tbAvatar) { tbAvatar.removeAttribute('src'); tbAvatar.style.display = 'none'; }
  if (tbFallback) tbFallback.style.display = '';
}

export async function gApiFetch(url, opts) {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: 'Bearer ' + gAccessToken, ...(opts && opts.headers) }
  });
  if (res.status === 401) { gAccessToken = null; gDriveSetStatus('Oturum süresi doldu', 'var(--warn, orange)'); return null; }
  return res;
}

// ── Drive'dan yükle / Drive'a kaydet ──────────────────────────
export async function gDriveFindFile() {
  const res = await gApiFetch(
    "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D'" + GDRIVE_FILE_NAME + "'&fields=files(id,modifiedTime)"
  );
  if (!res) return null;
  const data = await res.json();
  return (data.files && data.files.length) ? data.files[0] : null;
}

export async function gDriveLoadFromDrive() {
  if (!gDriveReady()) return;
  gInitialLoadDone = false; // her yeni yükleme denemesinde guard'ı yeniden kur (ör. çıkış/tekrar giriş)
  gDriveSetStatus('Yükleniyor...', 'var(--accent)');
  try {
    const file = await gDriveFindFile();
    if (!file) {
      // Drive'da henüz dosya yok — boş veri ile devam et, kullanıcı veri girdikçe oluşacak
      gInitialLoadDone = true; // gerçekten "yeni kullanıcı" tespit edildi — artık Drive'a yazmak güvenli
      gDriveSetStatus('Hazır (yeni)', 'var(--success, #4ade80)');
      setTimeout(() => gDriveSetStatus('Hazır', 'var(--text3)'), 3000);
      if(typeof _kurServisleri.tcmbKurGunlukKontrolEt === 'function') _kurServisleri.tcmbKurGunlukKontrolEt();
      return;
    }
    gDriveFileId = file.id;
    const res = await gApiFetch(
      'https://www.googleapis.com/drive/v3/files/' + file.id + '?alt=media'
    );
    if (!res) {
      // 401/yetkilendirme sorunu — gAccessToken zaten null'landı (gApiFetch içinde),
      // bir sonraki gDriveReady() kontrolü false dönecek ve kayıt denemeleri zaten durur.
      gInitialLoadDone = true;
      return;
    }
    const remoteDB = await res.json();
    // applyMigrations içinde FORMAT_CONFIG ve currency da uygulanır
    _coreState.replaceObjectContents(_coreState.DB, applyMigrations(remoteDB));
    gInitialLoadDone = true; // gerçek veri başarıyla geldi — artık Drive'a yazmak güvenli
    gDirty = false; // taze veri geldi, yereldeki "kaydedilmemiş değişiklik" durumu artık geçersiz
    // Drive'dan taze veri geldi — sayfa filtrelerini de güncel DB'ye göre yeniden uygula
    set_islemFiltreRestored(false);
    set_extreFiltreRestored(false);
    set_hesapFiltreRestored(false);
    set_katFiltreRestored(false);
    set_asgariKuralPbFiltreRestored(false);
    _wrapRegistry.call('renderAll');
    // Drive verisi bu noktaya kadar gelmemiş olabileceğinden, sayfa ilk açıldığında
    // #kartlar?kart=...&tab=... gibi bir deep-link varsa ve kart o an DB'de yoktu diye
    // açılamadıysa, taze veri geldikten sonra tekrar dene.
    _wrapRegistry.call('_retryKartDeepLink');
    gDriveSetStatus('Senkronize edildi ✓', 'var(--success, #4ade80)');
    setTimeout(() => gDriveSetStatus('Hazır', 'var(--text3)'), 3000);
    // Format config yüklendikten sonra saati güncelle
    _wrapRegistry.call('updateClockFn');
    // Her gün bir defa: TCMB döviz kurlarını sessizce kontrol et / güncelle
    if(typeof _kurServisleri.tcmbKurGunlukKontrolEt === 'function') _kurServisleri.tcmbKurGunlukKontrolEt();
  } catch(e) {
    console.error('Drive load error:', e);
    gDriveSetStatus('Yükleme hatası', 'var(--danger)');
    if(typeof showToast==='function') showToast('Google Drive yükleme hatası: ' + (e.message||e), 'error');
    // Yükleme başarısız oldu bile olsa guard'ı serbest bırak — aksi halde ağ hatası
    // durumunda gDriveSaveNow sonsuza dek 800ms'de bir boşuna deneyip durur ve
    // kullanıcının yerel değişiklikleri hiçbir zaman Drive'a gidemez.
    gInitialLoadDone = true;
  }
}

export async function gDriveSaveNow() {
  if (!gDriveReady()) return;
  if (!gInitialLoadDone) {
    // İlk yükleme (gDriveLoadFromDrive) henüz tamamlanmadı — bu noktada Drive'a
    // yazmak, oradaki GERÇEK veriyi henüz gelmemiş/boş yerel state ile ezme
    // riski taşır. Kısa bir süre sonra tekrar dene; yükleme tamamlanınca
    // (veya gerçekten "yeni kullanıcı, dosya yok" tespit edilince) izin verilir.
    clearTimeout(gSaveRetryTimer);
    gSaveRetryTimer = setTimeout(gDriveSaveNow, 800);
    return;
  }
  if (gSaving) return; // aynı anda iki kayıt göndermeyelim, bir sonrakini bekleyelim
  gSaving = true;
  gDriveSetStatus('Kaydediliyor...', 'var(--accent)');
  try {
    const body = JSON.stringify(_coreState.DB);
    const blob  = new Blob([body], { type: 'application/json' });

    let res;
    if (gDriveFileId) {
      // Update existing file
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({ name: GDRIVE_FILE_NAME })], { type: 'application/json' }));
      form.append('file', blob);
      res = await gApiFetch(
        'https://www.googleapis.com/upload/drive/v3/files/' + gDriveFileId + '?uploadType=multipart',
        { method: 'PATCH', body: form }
      );
    } else {
      // Create new file in appDataFolder
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({ name: GDRIVE_FILE_NAME, parents: ['appDataFolder'] })], { type: 'application/json' }));
      form.append('file', blob);
      res = await gApiFetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
        { method: 'POST', body: form }
      );
      if (res) {
        const d = await res.json();
        gDriveFileId = d.id;
      }
    }
    if (!res || !res.ok) throw new Error(res ? ('HTTP ' + res.status) : 'Yetkilendirme hatası');
    // Başarılı kayıt — yerel güvenlik yedeğini de güncelle ve dirty bayrağını temizle
    gDirty = false;
    clearTimeout(gSaveRetryTimer);
    try { localStorage.setItem('finans_local_backup', JSON.stringify({ tarih: new Date().toISOString(), data: _coreState.DB })); } catch(e) {}
    gDriveSetStatus('Kaydedildi ✓', 'var(--success, #4ade80)');
    setTimeout(() => gDriveSetStatus('Hazır', 'var(--text3)'), 2500);
  } catch(e) {
    console.error('Drive save error:', e);
    gDriveSetStatus('Kayıt hatası — tekrar denenecek', 'var(--danger)');
    if(typeof showToast==='function') showToast('Google Drive kayıt hatası: ' + (e.message||e) + ' — tekrar denenecek', 'error');
    // Kayıt başarısız oldu — veri hâlâ "dirty" (kaydedilmemiş), birkaç saniye sonra otomatik tekrar dene
    gDirty = true;
    clearTimeout(gSaveRetryTimer);
    gSaveRetryTimer = setTimeout(gDriveSaveNow, 6000);
  } finally {
    gSaving = false;
  }
}

export async function gDriveSyncNow() {
  if (gDirty) {
    if(typeof showToast==='function') showToast("Kaydedilmemiş değişiklikleriniz Drive'a gönderiliyor...", 'success');
    await gDriveSaveNow();
  } else {
    await gDriveLoadFromDrive();
  }
}


// ── Diğer yardımcılar ──────────────────────────────────────────
export function _gDriveRenderRevizyonListesi() {
  const list = document.getElementById('drive-revizyon-list');
  list.innerHTML = _gDriveRevizyonListesi.map((r,i) => {
    const tarih = new Date(r.modifiedTime).toLocaleString('tr-TR', {dateStyle:'medium', timeStyle:'short'});
    const kb = r.size ? Math.round(r.size/1024) + ' KB' : '';
    const guncelMi = i === 0;
    const seciliMi = r.id === _gDriveSeciliRevizyonId;
    return `<div class="gdrive-rev-item" data-id="${r.id}" style="cursor:pointer;padding:10px 12px;border:1px solid ${seciliMi ? 'var(--sky)' : 'var(--border)'};border-radius:10px;background:${seciliMi ? 'rgba(56,189,248,.1)' : 'var(--surface2)'};transition:border-color .15s">
      <div style="font-size:12.5px;font-weight:600;color:var(--text)">${tarih}</div>
      <div style="font-size:10.5px;color:var(--text3);margin-top:2px;display:flex;gap:6px;align-items:center">
        ${kb}
        ${guncelMi ? '<span style="color:var(--teal);font-weight:700">EN GÜNCEL</span>' : ''}
      </div>
    </div>`;
  }).join('');
  // [ES module] onclick="gDriveOnizleRevizyon(...)" kaldırıldı.
  list.querySelectorAll('.gdrive-rev-item').forEach(item => {
    item.addEventListener('click', () => gDriveOnizleRevizyon(item.getAttribute('data-id')));
  });
}

export function isIOSSafari() {
  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

  return isIOS && isSafari;
}
// Sayfa kapatılırken/yenilenirken bekleyen kaydı kaybetmemek için son bir kayıt denemesi yap
window.addEventListener('beforeunload', function(e) {
  if (gDirty && gDriveReady()) {
    // Senkron olmayan fetch tamamlanamayabilir ama denenir; ayrıca kullanıcıyı uyar
    gDriveSaveNow();
    e.preventDefault();
    e.returnValue = 'Kaydedilmemiş değişiklikler olabilir.';
    return e.returnValue;
  }
});

// [ES module] Bu dosyada tanımlanan aşağıdaki değişkenler başka dosyalarda
// yeniden atanıyordu (import edilen bir binding'e doğrudan atama ES
// module'de yasaktır). Bu setter fonksiyonları o davranışı korumak için
// eklendi - ilgili dosyalar artık `X = v` yerine `setX(v)` çağırıyor.
export function setGDirty(v) { gDirty = v; }

// ============================================================
// [DI-MIGRATION] services.gdrive — container'a kayıt
// ------------------------------------------------------------
// bkz. kur-servisleri.js'teki açıklama. Bu dosyanın da kendi üstteki
// importları (ui/pages'e geri bağımlılıklar dahil) bir sonraki turda,
// o sayfa modülleri container'a taşındığında kaldırılacak.
// ============================================================
import { provide } from '@core/container.js';
provide('services.gdrive', {
  gDriveGeriYukleYerelYedek, gDriveReady, gDriveSetStatus, _gDriveTokenAlindi,
  gDriveInit, gDriveSilentRefresh, gFetchUserInfo, gDriveShowUserInfo,
  gDriveSignIn, gDriveSignOut, _gDriveRenderRevizyonListesi, isIOSSafari,
  setGDirty, gDriveAcRevizyonModal, gDriveOnizleRevizyon, gApiFetch,
  gDriveFindFile, gDriveLoadFromDrive, gDriveSaveNow, gDriveSyncNow,
  GDRIVE_CLIENT_ID_DEFAULT, GDRIVE_SCOPES, GDRIVE_FILE_NAME,
  get _gDriveRevizyonListesi() { return _gDriveRevizyonListesi; },
  get _gDriveSeciliRevizyonId() { return _gDriveSeciliRevizyonId; },
  get _gDriveOnizlemeData() { return _gDriveOnizlemeData; },
  get GDRIVE_CLIENT_ID() { return GDRIVE_CLIENT_ID; },
  get gTokenClient() { return gTokenClient; },
  get gAccessToken() { return gAccessToken; },
  get gDriveFileId() { return gDriveFileId; },
  get gDirty() { return gDirty; },
  get gInitialLoadDone() { return gInitialLoadDone; },
  get gSaving() { return gSaving; },
  get gSaveRetryTimer() { return gSaveRetryTimer; },
});
