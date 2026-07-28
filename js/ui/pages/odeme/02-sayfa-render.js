import { DB } from '@core/state.js';
import { renderElden } from '@pages/elden.js';
import { renderIslemler } from '@pages/islemler/03-islem-liste-render.js';
import { renderKira } from '@pages/kira.js';
import { renderKmhKredi } from '@pages/krediler/03-kmh-kredi.js';
import { renderKredi } from '@pages/krediler/04-bireysel-kredi.js';
import { renderMaas } from '@pages/maas.js';
import { renderMevduat } from '@pages/mevduat/05-mevduat-liste-render.js';
import { renderOzet } from '@pages/ozet.js';
import { register } from '@core/wrap-registry.js';
// ============================================================
// js/ui/pages/odeme/02-sayfa-render.js
// Ödeme durumu sayfası render
//
// Bu dosya, eskiden tek parça olan js/ui/pages/odeme.js
// (52 export, 2097 satır) dosyasının, işlev kümelerine göre
// bölünmüş bir parçasıdır. Kod SATIR SATIR AYNI kaldı — sadece
// dosya sınırı ve gruplama değişti.
// ============================================================
export function odGetItem(tip, id) {
  if(tip==='islem')   return (DB.islemler||[]).find(x=>x.id===id);
  if(tip==='mevduat') return (DB.mevduatlar||[]).find(x=>x.id===id);
  if(tip==='kmh')     return (DB.krediler||[]).find(x=>x.id===id);
  if(tip==='kredi')   return (DB.bireyselKrediler||[]).find(x=>x.id===id);
  if(tip==='elden')   return (DB.eldenler||[]).find(x=>x.id===id);
  if(tip==='kira')    return (DB.kiralar||[]).find(x=>x.id===id);
  if(tip==='depozito')return (DB.kiralar||[]).find(x=>x.id===id);
  if(tip==='maas')    return (DB.maaslar||[]).find(x=>x.id===id);
  if(tip==='kart')    return (DB.kartlar||[]).find(x=>x.id===id);
  return null;
}

export function odRenderPage(tip) {
  if(tip==='islem')   renderIslemler();
  else if(tip==='mevduat') renderMevduat();
  else if(tip==='kmh')     { renderKmhKredi(); }
  else if(tip==='kredi')   renderKredi();
  else if(tip==='elden')   renderElden();
  else if(tip==='kira')    renderKira();
  else if(tip==='depozito')renderKira();
  else if(tip==='maas')    renderMaas();
  renderOzet();
}

// [ES module] eskiden window.odGetItem/window.odRenderPage köprüleri
// buradaydı; artık taban tanımlar wrap-registry'ye register edilir.
// abonelik.js gibi bu fonksiyonları sarmalayan (wrap eden) modüller
// get('odGetItem')/get('odRenderPage') ile mevcut referansı alıp kendi
// sarmalayıcısını tekrar register eder; diğer tüm çağıranlar
// call('odGetItem', ...) / call('odRenderPage', ...) ile HER ZAMAN en
// dıştaki (en güncel) sürümü kullanır.
register('odGetItem', odGetItem);
register('odRenderPage', odRenderPage);
