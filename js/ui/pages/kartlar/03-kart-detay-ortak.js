import { saveData } from '../../../core/app-core-base.js';
import { _pushHashState } from '../../../core/init.js';
import { DB } from '../../../core/state.js';
import { _restoreKdIslemSiralamaFromDB } from '../../components/tablo-filtre-sirala.js';
import { _kd2AcikExtreDonem, _kd2AcikIslemAy, _kd2IslemArama, _kd2IslemKatFiltre, _kdAcikIslemAy, _kdIslemArama, _kdIslemKatFiltre, set_kd2AcikExtreDonem, set_kd2AcikIslemAy, set_kd2IslemArama, set_kd2IslemKatFiltre, set_kdAcikIslemAy, set_kdIslemArama, set_kdIslemKatFiltre } from './00-state.js';
import { editKart, getKart, getKartRenk } from './01-kart-data.js';
import { kdSwitchTab } from './04-kart-detay-v1.js';
import { kd2RenderOzetBanner, kd2SwitchTab } from './05-kart-detay-v2.js';
import { _kd2KartId, _kdIslemSiralama, _kdKartId, set_kd2KartId, set_kdKartId } from './09-kart-altyapi.js';
import { getBanka } from '../tanimlamalar/01-genel-yardimcilar.js';
import { openModal } from '../../components/modal-genel.js';
// ============================================================
// js/ui/pages/kartlar/03-kart-detay-ortak.js
// Kart Detay sayfası — v1/v2 ortak navigasyon ve tab yardımcıları
//
// Bu dosya, eskiden tek parça olan js/ui/pages/kartlar.js (145
// export, 3600+ satır) dosyasının, fonksiyon isim/işlev
// kümelerine göre bölünmüş bir parçasıdır. Kod SATIR SATIR
// AYNI kaldı — sadece dosya sınırı ve gruplama değişti.
// ============================================================
export function gotoKartIslemleri(kartId) {
  acKartDetaySayfa(kartId, 'islem');
}

export function gotoKartEkstre(kartId) {
  acKartDetaySayfa(kartId, 'extre');
}

export function acKartDetaySayfa(kartId, tab) {
  const k = getKart(kartId);
  if (!k) return;
  if (_kd2KartId !== kartId) {
    _restoreKdIslemSiralamaFromDB();
    set_kd2IslemArama('');
    set_kd2IslemKatFiltre(null);
    set_kd2AcikIslemAy(null);
    set_kd2AcikExtreDonem(null);
  }
  set_kd2KartId(kartId);
  const banka = getBanka(k.banka);
  const renk = getKartRenk(k);
  document.getElementById('kd2-kart-adi').textContent = k.ad;
  document.getElementById('kd2-kart-sub').textContent = banka + (k.no ? ' \u00b7\u00b7 ' + k.no : '');
  document.getElementById('kd2-kart-adi').style.color = renk;
  const editBtn = document.getElementById('kd2-edit-btn');
  if (editBtn) editBtn.onclick = () => editKart(kartId);
  kd2RenderOzetBanner(k, renk);
  document.getElementById('kartlar-liste-view').style.display = 'none';
  document.getElementById('kartlar-detay-view').style.display = 'block';
  window.scrollTo(0, 0);
  // Hash: kart detay state
  _pushHashState('kartlar', {kart: kartId, tab: tab || 'islem'});
  kd2SwitchTab(tab || 'islem');
}

export function kartDetayGeriDon() {
  document.getElementById('kartlar-detay-view').style.display = 'none';
  document.getElementById('kartlar-liste-view').style.display = 'block';
  set_kd2KartId(null);
  _pushHashState('kartlar', {});
}

export function _kdCoreSwitchTabToggle(prefix, tab) {
  document.getElementById(prefix + '-tab-btn-islem').classList.toggle('active', tab === 'islem');
  document.getElementById(prefix + '-tab-btn-extre').classList.toggle('active', tab === 'extre');
  const tabIslem = document.getElementById(prefix + '-tab-islem');
  const tabExtre = document.getElementById(prefix + '-tab-extre');
  const activeEl = tab === 'islem' ? tabIslem : tabExtre;
  const hiddenEl = tab === 'islem' ? tabExtre : tabIslem;
  hiddenEl.style.display = 'none';
  activeEl.style.display = 'block';
  return activeEl;
}

export function _kdCoreToggleIslemAy(prefix, key, getAcik) {
  const card = document.getElementById(prefix + '-islem-month-card-' + key);
  const body = document.getElementById(prefix + '-islem-month-body-' + key);
  if (!card || !body) return getAcik();
  const acik = getAcik();
  const willOpen = acik !== key;
  if (acik && acik !== key) {
    const prevCard = document.getElementById(prefix + '-islem-month-card-' + acik);
    const prevBody = document.getElementById(prefix + '-islem-month-body-' + acik);
    if (prevCard) prevCard.classList.remove('open');
    if (prevBody) prevBody.style.maxHeight = '0px';
  }
  card.classList.toggle('open', willOpen);
  body.style.maxHeight = willOpen ? body.scrollHeight + 'px' : '0px';
  return willOpen ? key : null;
}

export function _kdCoreAramaSync(prefix, value, renderFn) {
  const btn = document.getElementById(prefix + '-islem-arama-temizle');
  if (btn) btn.style.display = value ? 'flex' : 'none';
  renderFn();
}

export function _kdCoreAramaTemizle(prefix, renderFn) {
  const input = document.getElementById(prefix + '-islem-arama');
  if (input) input.value = '';
  const btn = document.getElementById(prefix + '-islem-arama-temizle');
  if (btn) btn.style.display = 'none';
  renderFn();
}

export function _kdCoreSiralamaPersist() {
  if (!DB.uiFiltreler) DB.uiFiltreler = {};
  if (!DB.uiFiltreler.kartIslem) DB.uiFiltreler.kartIslem = {};
  if (DB.uiFiltreler.kartIslem.sirala !== _kdIslemSiralama) { DB.uiFiltreler.kartIslem.sirala = _kdIslemSiralama; saveData(); }
}

export function openKartDetayModal(kartId, tab) {
  const k = getKart(kartId);
  if (!k) return;
  if (_kdKartId !== kartId) {
    // Farklı bir karta geçiliyorsa önceki kartın arama/kategori-filtre durumunu sıfırla;
    // sıralama tercihi ise kalıcı (DB.uiFiltreler.kartIslem.sirala) olduğu için korunur.
    _restoreKdIslemSiralamaFromDB();
    set_kdIslemArama('');
    set_kdIslemKatFiltre(null);
    set_kdAcikIslemAy(null);
  }
  set_kdKartId(kartId);
  const banka = getBanka(k.banka);
  document.getElementById('kd-kart-adi').textContent = k.ad;
  document.getElementById('kd-kart-adi').title = k.ad;
  document.getElementById('kd-kart-sub').textContent = `${banka}${k.no ? ' ·· ' + k.no : ''}`;
  // Kart rengi ile header icon ve banner'ı renklendir
  const renk = getKartRenk(k);
  const iconEl = document.getElementById('kd-header-icon');
  if (iconEl) { iconEl.style.background = renk + '1a'; iconEl.style.borderColor = renk + '40'; }
  const bannerEl = document.getElementById('kd-header-banner');
  if (bannerEl) bannerEl.style.background = `linear-gradient(90deg, ${renk}, transparent)`;
  openModal('modal-kart-detay', kartId);
  kdSwitchTab(tab || 'islem');
}


