// ============================================================
// js/domain/banka-verisi.js — Banka ikon/logo/IBAN referans verisi
// (2. tur refactor: 02-core-app-engine.js'den taşındı)
// ============================================================

// ── Banka İkon/Logo Sistemi ──────────────────────────────────────────
// ibanKod → {emoji, renk, bg} — pre-set Türk bankaları
export var BANK_ICON_MAP = {
  '0010': { emoji:'🏦', renk:'#e30613', bg:'rgba(227,6,19,.13)',  label:'Ziraat'       },
  '0015': { emoji:'💛', renk:'#ffc200', bg:'rgba(255,194,0,.15)', label:'VakıfBank'     },
  '0064': { emoji:'🔵', renk:'#003087', bg:'rgba(0,48,135,.12)',  label:'İş Bankası'    },
  '0062': { emoji:'🟩', renk:'#007f3e', bg:'rgba(0,127,62,.12)',  label:'Garanti BBVA'  },
  '0046': { emoji:'🔴', renk:'#e8192c', bg:'rgba(232,25,44,.13)', label:'Akbank'        },
  '0032': { emoji:'🟦', renk:'#00A19A', bg:'rgba(0,161,154,.12)', label:'TEB'           },
  '0111': { emoji:'🟪', renk:'#6e1d8c', bg:'rgba(110,29,140,.12)',label:'QNB'           },
  '0134': { emoji:'🌊', renk:'#00adef', bg:'rgba(0,173,239,.13)', label:'DenizBank'     },
  '0067': { emoji:'⚫', renk:'#1a1a1a', bg:'rgba(30,30,30,.12)',  label:'Yapı Kredi'    },
  '0147': { emoji:'🟠', renk:'#ff6900', bg:'rgba(255,105,0,.13)', label:'ON'            },
  '0157': { emoji:'🟢', renk:'#00c08b', bg:'rgba(0,192,139,.13)', label:'Enpara'        },
  '0205': { emoji:'🕌', renk:'#4b8f2a', bg:'rgba(75,143,42,.12)', label:'Kuveyt Türk'   },
  '0143': { emoji:'💜', renk:'#7c2ab8', bg:'rgba(124,42,184,.13)',label:'N Kolay'       },
  '0099': { emoji:'🔶', renk:'#ff6200', bg:'rgba(255,98,0,.13)',  label:'ING'           },
  '0158': { emoji:'⭕', renk:'#e63946', bg:'rgba(230,57,70,.13)', label:'ColendiBank'   },
  '0106': { emoji:'🟧', renk:'#f4a100', bg:'rgba(244,161,0,.13)', label:'Fibabanka'     },
  '0123': { emoji:'🔴', renk:'#DB0011', bg:'rgba(219,0,17,.12)', label:'HSBC'          },
  '0213': { emoji:'🟥', renk:'#E63950', bg:'rgba(230,57,80,.12)',label:'TOM Katılım'   },
};

// ── Banka Logo Rozetleri (SVG) ── Türkiye'deki başlıca 16 banka için
// stilize, marka renklerine yakın rozet logolar. ibanKod → svg eşlemesi.
// Not: Gerçek marka logotype'ları yerine sade, tanınabilir renk+kısaltma
// rozetleri kullanılır (kartAltyapı logoları ile aynı üslup).
export var BANKA_LOGOLAR = [
  { kod:'0010', id:'ziraat', ad:'Ziraat Bankası', svg:`<span style="position:relative;width:100%;height:100%;display:flex"><img src="https://www.ziraatbank.com.tr/SiteAssets/images/favicon.ico" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:4px" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?domain=ziraatbank.com.tr&amp;sz=64';this.dataset.stage='2';this.addEventListener('error',function(){this.style.display='none';this.nextElementSibling.style.display='flex';},{once:true})"><span style="display:none;position:absolute;inset:0"><span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(145deg,#ff0716 0%,#E30613 55%,#a3040d 100%);color:#fff;font-weight:800;font-size:9px;font-family:-apple-system,Arial,sans-serif;border-radius:5px;letter-spacing:.3px;text-shadow:0 1px 1.5px rgba(0,0,0,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 2px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.15)">ZİRAAT</span></span></span>` },
  { kod:'0015', id:'vakifbank', ad:'VakıfBank', svg:`<span style="position:relative;width:100%;height:100%;display:flex"><img src="https://www.vakifbank.com.tr/favicon.ico" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:4px" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?domain=vakifbank.com.tr&amp;sz=64';this.dataset.stage='2';this.addEventListener('error',function(){this.style.display='none';this.nextElementSibling.style.display='flex';},{once:true})"><span style="display:none;position:absolute;inset:0"><span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(145deg,#ffe400 0%,#FFC200 55%,#b78b00 100%);color:#fff;font-weight:800;font-size:9px;font-family:-apple-system,Arial,sans-serif;border-radius:5px;letter-spacing:.3px;text-shadow:0 1px 1.5px rgba(0,0,0,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 2px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.15)">VAKIF</span></span></span>` },
  { kod:'0064', id:'isbankasi', ad:'İş Bankası', svg:`<span style="position:relative;width:100%;height:100%;display:flex"><img src="https://www.isbank.com.tr/StaticFiles/Isbank/images/icons/favicon.ico" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:4px" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?domain=isbank.com.tr&amp;sz=64';this.dataset.stage='2';this.addEventListener('error',function(){this.style.display='none';this.nextElementSibling.style.display='flex';},{once:true})"><span style="display:none;position:absolute;inset:0"><span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(145deg,#0047c2 0%,#003DA5 55%,#002b76 100%);color:#fff;font-weight:800;font-size:9px;font-family:-apple-system,Arial,sans-serif;border-radius:5px;letter-spacing:.3px;text-shadow:0 1px 1.5px rgba(0,0,0,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 2px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.15)">İŞ</span></span></span>` },
  { kod:'0062', id:'garanti', ad:'Garanti BBVA', svg:`<span style="position:relative;width:100%;height:100%;display:flex"><img src="https://www.garantibbva.com.tr/favicon.ico" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:4px" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?domain=garantibbva.com.tr&amp;sz=64';this.dataset.stage='2';this.addEventListener('error',function(){this.style.display='none';this.nextElementSibling.style.display='flex';},{once:true})"><span style="display:none;position:absolute;inset:0"><span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(145deg,#009c92 0%,#00857C 55%,#005f59 100%);color:#fff;font-weight:800;font-size:9px;font-family:-apple-system,Arial,sans-serif;border-radius:5px;letter-spacing:.3px;text-shadow:0 1px 1.5px rgba(0,0,0,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 2px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.15)">GRT</span></span></span>` },
  { kod:'0046', id:'akbank', ad:'Akbank', svg:`<span style="position:relative;width:100%;height:100%;display:flex"><img src="https://www.akbank.com/SiteAssets/img/favicon.ico" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:4px" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?domain=akbank.com&amp;sz=64';this.dataset.stage='2';this.addEventListener('error',function(){this.style.display='none';this.nextElementSibling.style.display='flex';},{once:true})"><span style="display:none;position:absolute;inset:0"><span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(145deg,#ff2136 0%,#EC1C2E 55%,#a91421 100%);color:#fff;font-weight:800;font-size:9px;font-family:-apple-system,Arial,sans-serif;border-radius:5px;letter-spacing:.3px;text-shadow:0 1px 1.5px rgba(0,0,0,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 2px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.15)">AK</span></span></span>` },
  { kod:'0032', id:'teb', ad:'TEB', svg:`<span style="position:relative;width:100%;height:100%;display:flex"><img src="https://www.teb.com.tr/favicon.ico" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:4px" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?domain=teb.com.tr&amp;sz=64';this.dataset.stage='2';this.addEventListener('error',function(){this.style.display='none';this.nextElementSibling.style.display='flex';},{once:true})"><span style="display:none;position:absolute;inset:0"><span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(145deg,#1ec2b8 0%,#00A19A 55%,#00746f 100%);color:#fff;font-weight:800;font-size:9px;font-family:-apple-system,Arial,sans-serif;border-radius:5px;letter-spacing:.3px;text-shadow:0 1px 1.5px rgba(0,0,0,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 2px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.15)">TEB</span></span></span>` },
  { kod:'0111', id:'qnb', ad:'QNB', svg:`<span style="position:relative;width:100%;height:100%;display:flex"><img src="https://www.qnb.com.tr/favicon.ico" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:4px" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?domain=qnb.com.tr&amp;sz=64';this.dataset.stage='2';this.addEventListener('error',function(){this.style.display='none';this.nextElementSibling.style.display='flex';},{once:true})"><span style="display:none;position:absolute;inset:0"><span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(145deg,#581047 0%,#4B0E3D 55%,#360a2b 100%);color:#fff;font-weight:800;font-size:9px;font-family:-apple-system,Arial,sans-serif;border-radius:5px;letter-spacing:.3px;text-shadow:0 1px 1.5px rgba(0,0,0,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 2px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.15)">QNB</span></span></span>` },
  { kod:'0134', id:'denizbank', ad:'DenizBank', svg:`<span style="position:relative;width:100%;height:100%;display:flex"><img src="https://play-lh.googleusercontent.com/I8jdxgIY1-nYfKPxw__4aFb3uWj6-0tB3Cs8Fj2dQ2wfxdFiA_8fgouUb0CyoUU1psIYfa9LDFK-MusY87m_mZ0=s48-rw" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:4px" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?domain=denizbank.com&amp;sz=64';this.dataset.stage='2';this.addEventListener('error',function(){this.style.display='none';this.nextElementSibling.style.display='flex';},{once:true})"><span style="display:none;position:absolute;inset:0"><span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(145deg,#00adf5 0%,#0093D0 55%,#006995 100%);color:#fff;font-weight:800;font-size:9px;font-family:-apple-system,Arial,sans-serif;border-radius:5px;letter-spacing:.3px;text-shadow:0 1px 1.5px rgba(0,0,0,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 2px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.15)">DNZ</span></span></span>` },
  { kod:'0067', id:'yapikredi', ad:'Yapı Kredi', svg:`<span style="position:relative;width:100%;height:100%;display:flex"><img src="https://www.yapikredi.com.tr/favicon.ico" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:4px" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?domain=yapikredi.com.tr&amp;sz=64';this.dataset.stage='2';this.addEventListener('error',function(){this.style.display='none';this.nextElementSibling.style.display='flex';},{once:true})"><span style="display:none;position:absolute;inset:0"><span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(145deg,#00256b 0%,#00205B 55%,#001741 100%);color:#fff;font-weight:800;font-size:9px;font-family:-apple-system,Arial,sans-serif;border-radius:5px;letter-spacing:.3px;text-shadow:0 1px 1.5px rgba(0,0,0,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 2px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.15)">YKB</span></span></span>` },
  { kod:'0147', id:'on', ad:'ON (Burgan Bank)', svg:`<span style="position:relative;width:100%;height:100%;display:flex"><img src="https://on.com.tr/assets/img/favicon-32x32.png" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:4px" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?domain=on.com.tr&amp;sz=64';this.dataset.stage='2';this.addEventListener('error',function(){this.style.display='none';this.nextElementSibling.style.display='flex';},{once:true})"><span style="display:none;position:absolute;inset:0"><span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(145deg,#ff7b00 0%,#FF6900 55%,#b74b00 100%);color:#fff;font-weight:800;font-size:9px;font-family:-apple-system,Arial,sans-serif;border-radius:5px;letter-spacing:.3px;text-shadow:0 1px 1.5px rgba(0,0,0,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 2px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.15)">ON</span></span></span>` },
  { kod:'0157', id:'enpara', ad:'Enpara', svg:`<span style="position:relative;width:100%;height:100%;display:flex"><img src="https://www.enpara.com/favicon.ico" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:4px" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?domain=enpara.com&amp;sz=64';this.dataset.stage='2';this.addEventListener('error',function(){this.style.display='none';this.nextElementSibling.style.display='flex';},{once:true})"><span style="display:none;position:absolute;inset:0"><span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(145deg,#00e2a4 0%,#00C08B 55%,#008a64 100%);color:#fff;font-weight:800;font-size:9px;font-family:-apple-system,Arial,sans-serif;border-radius:5px;letter-spacing:.3px;text-shadow:0 1px 1.5px rgba(0,0,0,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 2px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.15)">ENP</span></span></span>` },
  { kod:'0205', id:'kuveytturk', ad:'Kuveyt Türk', svg:`<span style="position:relative;width:100%;height:100%;display:flex"><img src="https://www.kuveytturk.com.tr/favicon.ico" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:4px" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?domain=kuveytturk.com.tr&amp;sz=64';this.dataset.stage='2';this.addEventListener('error',function(){this.style.display='none';this.nextElementSibling.style.display='flex';},{once:true})"><span style="display:none;position:absolute;inset:0"><span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(145deg,#00af57 0%,#00954A 55%,#006b35 100%);color:#fff;font-weight:800;font-size:9px;font-family:-apple-system,Arial,sans-serif;border-radius:5px;letter-spacing:.3px;text-shadow:0 1px 1.5px rgba(0,0,0,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 2px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.15)">KT</span></span></span>` },
  { kod:'0143', id:'nkolay', ad:'N Kolay', svg:`<span style="position:relative;width:100%;height:100%;display:flex"><img src="https://www.nkolay.com/favicon.ico" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:4px" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?domain=nkolay.com&amp;sz=64';this.dataset.stage='2';this.addEventListener('error',function(){this.style.display='none';this.nextElementSibling.style.display='flex';},{once:true})"><span style="display:none;position:absolute;inset:0"><span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(145deg,#9231d9 0%,#7C2AB8 55%,#591e84 100%);color:#fff;font-weight:800;font-size:9px;font-family:-apple-system,Arial,sans-serif;border-radius:5px;letter-spacing:.3px;text-shadow:0 1px 1.5px rgba(0,0,0,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 2px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.15)">N</span></span></span>` },
  { kod:'0099', id:'ing', ad:'ING', svg:`<span style="position:relative;width:100%;height:100%;display:flex"><img src="https://www.ing.com.tr/favicon.ico" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:4px" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?domain=ing.com.tr&amp;sz=64';this.dataset.stage='2';this.addEventListener('error',function(){this.style.display='none';this.nextElementSibling.style.display='flex';},{once:true})"><span style="display:none;position:absolute;inset:0"><span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(145deg,#ff7300 0%,#FF6200 55%,#b74600 100%);color:#fff;font-weight:800;font-size:9px;font-family:-apple-system,Arial,sans-serif;border-radius:5px;letter-spacing:.3px;text-shadow:0 1px 1.5px rgba(0,0,0,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 2px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.15)">ING</span></span></span>` },
  { kod:'0158', id:'colendi', ad:'ColendiBank', svg:`<span style="position:relative;width:100%;height:100%;display:flex"><img src="https://www.colendibank.com/wp-content/uploads/2024/11/colendibank_logo_favicon-150x150.png" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:4px" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?domain=colendibank.com&amp;sz=64';this.dataset.stage='2';this.addEventListener('error',function(){this.style.display='none';this.nextElementSibling.style.display='flex';},{once:true})"><span style="display:none;position:absolute;inset:0"><span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(145deg,#ff5849 0%,#FF4B3E 55%,#b7362c 100%);color:#fff;font-weight:800;font-size:9px;font-family:-apple-system,Arial,sans-serif;border-radius:5px;letter-spacing:.3px;text-shadow:0 1px 1.5px rgba(0,0,0,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 2px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.15)">CLN</span></span></span>` },
  { kod:'0106', id:'fibabanka', ad:'Fibabanka', svg:`<span style="position:relative;width:100%;height:100%;display:flex"><img src="https://cdn.fibabanka.com.tr/ResourcePackages/Fibabanka/assets/img/favicon.png" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:4px" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?domain=fibabanka.com.tr&amp;sz=64';this.dataset.stage='2';this.addEventListener('error',function(){this.style.display='none';this.nextElementSibling.style.display='flex';},{once:true})"><span style="display:none;position:absolute;inset:0"><span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(145deg,#ffae22 0%,#F7941D 55%,#b16a14 100%);color:#fff;font-weight:800;font-size:9px;font-family:-apple-system,Arial,sans-serif;border-radius:5px;letter-spacing:.3px;text-shadow:0 1px 1.5px rgba(0,0,0,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 2px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.15)">FIBA</span></span></span>` },
  { kod:'0123', id:'hsbc', ad:'HSBC Bank A.Ş.', svg:`<span style="position:relative;width:100%;height:100%;display:flex"><img src="https://www.hsbc.com.tr/favicon.ico" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:4px" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?domain=hsbc.com.tr&amp;sz=64';this.dataset.stage='2';this.addEventListener('error',function(){this.style.display='none';this.nextElementSibling.style.display='flex';},{once:true})"><span style="display:none;position:absolute;inset:0"><span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(145deg,#ff0014 0%,#DB0011 55%,#9d000c 100%);color:#fff;font-weight:800;font-size:9px;font-family:-apple-system,Arial,sans-serif;border-radius:5px;letter-spacing:.3px;text-shadow:0 1px 1.5px rgba(0,0,0,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 2px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.15)">HSBC</span></span></span>` },
  { kod:'0213', id:'tomkatilim', ad:'T.O.M. Katılım Bankası A.Ş.', svg:`<span style="position:relative;width:100%;height:100%;display:flex"><img src="https://www.tombank.com.tr/assets/images/fav2.png" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:4px" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?domain=tombank.com.tr&amp;sz=64';this.dataset.stage='2';this.addEventListener('error',function(){this.style.display='none';this.nextElementSibling.style.display='flex';},{once:true})"><span style="display:none;position:absolute;inset:0"><span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(145deg,#ff435e 0%,#E63950 55%,#a52939 100%);color:#fff;font-weight:800;font-size:9px;font-family:-apple-system,Arial,sans-serif;border-radius:5px;letter-spacing:.3px;text-shadow:0 1px 1.5px rgba(0,0,0,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 2px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.15)">TOM</span></span></span>` },
  { kod:'',     id:'none',    ad:'Logo Yok', svg:null }
];

// Türk bankaları IBAN kodu → kısa ad eşlemesi (TCMB 2025)
export var IBAN_BANKA_MAP = {
  '0001': 'TCMB',
  '0004': 'İller Bankası',
  '0010': 'Ziraat Bankası',
  '0012': 'Halkbank',
  '0014': 'TSKB',
  '0015': 'VakıfBank',
  '0016': 'Türk Eximbank',
  '0017': 'Kalkınma Bankası',
  '0029': 'Birleşik Fon Bank',
  '0032': 'TEB',
  '0046': 'Akbank',
  '0059': 'Şekerbank',
  '0060': 'Türk Ticaret Bank',
  '0062': 'Garanti BBVA',
  '0064': 'İş Bankası',
  '0067': 'Yapı Kredi',
  '0091': 'Arap Türk Bank',
  '0092': 'Citibank',
  '0096': 'Turkish Bank',
  '0098': 'JPMorgan Chase',
  '0099': 'ING Bank',
  '0103': 'Fibabanka',
  '0108': 'Turkland Bank',
  '0109': 'ICBC Turkey',
  '0111': 'QNB Finansbank',
  '0115': 'Deutsche Bank',
  '0116': 'Pasha YB',
  '0121': 'Standard Chartered YB',
  '0122': 'Société Générale',
  '0123': 'HSBC',
  '0124': 'Alternatifbank',
  '0125': 'Burgan Bank',
  '0129': 'Bank of America YB',
  '0132': 'Takasbank',
  '0134': 'Denizbank',
  '0135': 'Anadolubank',
  '0137': 'Rabobank',
  '0138': 'Diler YB',
  '0139': 'GSD YB',
  '0141': 'Nurol YB',
  '0142': 'BankPozitif',
  '0143': 'Aktifbank',
  '0146': 'Odea Bank',
  '0147': 'MUFG Bank',
  '0148': 'Intesa Sanpaolo',
  '0149': 'Bank of China',
  '0150': 'Golden Global YB',
  '0151': 'D Yatırım Bank',
  '0152': 'Destek YB',
  '0153': 'Misyon YB',
  '0154': 'Tera YB',
  '0155': 'Q YB',
  '0156': 'Hedef YB',
  '0157': 'Enpara',
  '0158': 'Colendi Bank',
  '0159': 'FUPS Bank',
  '0160': 'Ziraat Dinamik',
  '0161': 'Aytemiz YB',
  '0203': 'Albaraka Türk',
  '0205': 'Kuveyt Türk',
  '0206': 'Türkiye Finans',
  '0209': 'Vakıf Katılım',
  '0210': 'Ziraat Katılım',
  '0211': 'Emlak Katılım',
  '0212': 'Hayat Finans',
  '0213': 'TOM Katılım',
  '0214': 'Dünya Katılım',
  '0806': 'MKK',
  '0807': 'PTT',
};

// ============================================================
// [DI-MIGRATION] domain.bankaVerisi — container'a kayıt
// ============================================================
import { provide } from '@core/container.js';
provide('domain.bankaVerisi', { BANK_ICON_MAP, BANKA_LOGOLAR, IBAN_BANKA_MAP });


