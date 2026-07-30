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
  { kod:'0010', id:'ziraat', ad:'Ziraat Bankası', svg:`<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#E30613;color:#fff;font-weight:800;font-size:9px;font-family:Arial,sans-serif;border-radius:4px;letter-spacing:.2px">ZİRAAT</span>` },
  { kod:'0015', id:'vakifbank', ad:'VakıfBank', svg:`<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#FFC200;color:#fff;font-weight:800;font-size:9px;font-family:Arial,sans-serif;border-radius:4px;letter-spacing:.2px">VAKIF</span>` },
  { kod:'0064', id:'isbankasi', ad:'İş Bankası', svg:`<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#003DA5;color:#fff;font-weight:800;font-size:9px;font-family:Arial,sans-serif;border-radius:4px;letter-spacing:.2px">İŞ</span>` },
  { kod:'0062', id:'garanti', ad:'Garanti BBVA', svg:`<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#00857C;color:#fff;font-weight:800;font-size:9px;font-family:Arial,sans-serif;border-radius:4px;letter-spacing:.2px">GRT</span>` },
  { kod:'0046', id:'akbank', ad:'Akbank', svg:`<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#EC1C2E;color:#fff;font-weight:800;font-size:9px;font-family:Arial,sans-serif;border-radius:4px;letter-spacing:.2px">AK</span>` },
  { kod:'0032', id:'teb', ad:'TEB', svg:`<svg viewBox="0 0 40 24" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="24" rx="4" fill="#00A19A"/><text x="20" y="16" text-anchor="middle" font-family="Arial,sans-serif" font-size="10.5" font-weight="800" fill="#FFFFFF" letter-spacing=".5">TEB</text></svg>` },
  { kod:'0111', id:'qnb', ad:'QNB', svg:`<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#4B0E3D;color:#fff;font-weight:800;font-size:9px;font-family:Arial,sans-serif;border-radius:4px;letter-spacing:.2px">QNB</span>` },
  { kod:'0134', id:'denizbank', ad:'DenizBank', svg:`<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#0093D0;color:#fff;font-weight:800;font-size:9px;font-family:Arial,sans-serif;border-radius:4px;letter-spacing:.2px">DNZ</span>` },
  { kod:'0067', id:'yapikredi', ad:'Yapı Kredi', svg:`<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#00205B;color:#fff;font-weight:800;font-size:9px;font-family:Arial,sans-serif;border-radius:4px;letter-spacing:.2px">YKB</span>` },
  { kod:'0147', id:'on', ad:'ON (Burgan Bank)', svg:`<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#FF6900;color:#fff;font-weight:800;font-size:9px;font-family:Arial,sans-serif;border-radius:4px;letter-spacing:.2px">ON</span>` },
  { kod:'0157', id:'enpara', ad:'Enpara', svg:`<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#00C08B;color:#fff;font-weight:800;font-size:9px;font-family:Arial,sans-serif;border-radius:4px;letter-spacing:.2px">ENP</span>` },
  { kod:'0205', id:'kuveytturk', ad:'Kuveyt Türk', svg:`<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#00954A;color:#fff;font-weight:800;font-size:9px;font-family:Arial,sans-serif;border-radius:4px;letter-spacing:.2px">KT</span>` },
  { kod:'0143', id:'nkolay', ad:'N Kolay', svg:`<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#7C2AB8;color:#fff;font-weight:800;font-size:9px;font-family:Arial,sans-serif;border-radius:4px;letter-spacing:.2px">N</span>` },
  { kod:'0099', id:'ing', ad:'ING', svg:`<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#FF6200;color:#fff;font-weight:800;font-size:9px;font-family:Arial,sans-serif;border-radius:4px;letter-spacing:.2px">ING</span>` },
  { kod:'0158', id:'colendi', ad:'ColendiBank', svg:`<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#FF4B3E;color:#fff;font-weight:800;font-size:9px;font-family:Arial,sans-serif;border-radius:4px;letter-spacing:.2px">CLN</span>` },
  { kod:'0106', id:'fibabanka', ad:'Fibabanka', svg:`<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#F7941D;color:#fff;font-weight:800;font-size:9px;font-family:Arial,sans-serif;border-radius:4px;letter-spacing:.2px">FIBA</span>` },
  { kod:'0123', id:'hsbc', ad:'HSBC Bank A.Ş.', svg:`<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#DB0011;color:#fff;font-weight:800;font-size:9px;font-family:Arial,sans-serif;border-radius:4px;letter-spacing:.2px">HSBC</span>` },
  { kod:'0213', id:'tomkatilim', ad:'T.O.M. Katılım Bankası A.Ş.', svg:`<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#E63950;color:#fff;font-weight:800;font-size:9px;font-family:Arial,sans-serif;border-radius:4px;letter-spacing:.2px">TOM</span>` },
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


