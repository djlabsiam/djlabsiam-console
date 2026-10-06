/**
 * เทสต์ desk.html บน iPad (เจ้าของสั่ง 1 ต.ค. 69: ใช้ได้ทั้งแนวตั้ง/แนวนอน · นิ้วเป็นหลัก ต่อคีย์บอร์ดบ้าง ·
 * สแกนด้วยกล้องของ iPad + เครื่องยิง Bluetooth)
 *   รัน: node tests/desk-ipad.mjs
 *   ถ่ายภาพหน้าจอด้วย: IPAD_SHOTS=<โฟลเดอร์> node tests/desk-ipad.mjs
 *
 * ต่างจากชุดอื่นตรงที่คุม Chrome ผ่าน DevTools Protocol (tests/lib/cdp-page.mjs) — ต้อง "หมุนจอ" กลางเทสต์
 * และได้ขนาดจอตรงเป๊ะ · จอสัมผัสจำลองด้วย pointer: coarse + hover: none (ค่าเดียวกับ iPad ที่ไม่ได้ต่อแทร็กแพด)
 * ไฟล์ที่ถูกทดสอบยังเป็นของจริงทุกบรรทัด (สลับแค่แท็ก Supabase เป็นตัวปลอม · ตัดเน็ตด้วย host-resolver)
 *
 * 1. ทุกขนาด iPad (8 ขนาด · ทุกหมวดของเจ้าของร้าน + ผนังโหมดรับเข้า/นับ): ไม่มีเลื่อนแนวนอนระดับหน้า · ไม่มีปุ่มถูกตัดนอกจอ ·
 *    เป้ากดทุกอันที่มองเห็น ≥ 44 × 44 · ช่องกรอกทุกช่อง ≥ 16px (iOS ไม่ซูมเอง) · ปุ่มเครื่องคิดเลขไม่ทับปุ่ม/ตัวหนังสือ
 *    ที่ตำแหน่งเลื่อนตั้งต้น · หน้าต่างซ้อนทุกบานพอดีจอ · หน้าต่างวิดีโอลอยอยู่ในจอและไม่ทับเครื่องคิดเลข
 * 2. ลิ้นชักเมนู (แนวตั้ง): หุบอยู่ · ปุ่มเมนูเปิดได้ · ไปได้ทุกหมวด · Esc / แตะม่าน ปิด
 * 3. หมุนจอกลางงาน: ตะกร้า · ถาดรับเข้า · ลิ้นชักเมนู · แผงสินค้า · เครื่องคิดเลข · หน้าต่างวิดีโอ อยู่ครบและอยู่ในจอ
 * 4. กล้อง: ปุ่มมีบนจอสัมผัส · อ่านได้แล้ววิ่งทางเดียวกับเครื่องยิง (routeScan → onScanned) · ปิดกล้องเมื่อเปลี่ยนหมวด/ซ่อนแอป/กดปิด
 * 5. เครื่องยิง Bluetooth (= คีย์บอร์ด) ยังใช้ได้กับทุกอย่างที่เพิ่ม (ลิ้นชักเปิด · กล้องเปิด · จอสัมผัสไม่โฟกัสช่องพิมพ์เอง) ·
 *    ของที่เคยโผล่ตอนชี้เมาส์ ("+ เพิ่มรูป" ที่จับหน้าต่างวิดีโอ) เห็นบนจอสัมผัส · แป้นพิมพ์บนจอเปิด = แจ้งเตือนยกขึ้น วิดีโอลอยหลบ
 * 6. คอมหน้าเคาน์เตอร์ (เมาส์ ≥ 1280): ไม่มีอะไรของ iPad โผล่ — ไม่มีปุ่มเมนู/ปุ่มกล้อง ปุ่มเล็กยังเล็กเท่าเดิม
 */

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { HARNESS } from './lib/page-test.mjs';
import { runCdpPage } from './lib/cdp-page.mjs';
import { OPS_MOCK } from './lib/ops-mock.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { MOCK: MOCK3 } = await import(pathToFileURL(join(root, 'tests/desk-home3.mjs')).href);
const SHOTS = process.env.IPAD_SHOTS || null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

// สินค้าหลายแบรนด์/หมวดให้ผนังมีหลายปีก (ยังไม่มีรูปสักรุ่น = ช่อง "+ เพิ่มรูป" ของเจ้าของร้านโผล่ทุกแถว)
// + YouTube IFrame API ปลอม (ชุดเดียวกับ desk-polish) ใช้เปิดหน้าต่างวิดีโอลอย
const EXTRA = `<script>
FAKE.products.push(
  { id: 'p2', sku: 'AT-DJM-S11', name: 'DJM-S11', brand: 'AlphaTheta', category: 'mixer', barcode_ean13: '4573211111111', sell_price: 69900, reorder_point: 1, is_active: true },
  { id: 'p3', sku: 'NEO-DP-RCA', name: 'NEO d+ RCA Class A 1m', brand: 'NEO by OYAIDE', category: 'cable', barcode_ean13: '4573211111112', sell_price: 1900, reorder_point: 2, is_active: true },
  { id: 'p4', sku: 'AT-CDJ-3000X', name: 'CDJ-3000X', brand: 'AlphaTheta', category: 'player', barcode_ean13: '4573211111113', sell_price: 109000, reorder_point: 1, is_active: true },
  { id: 'p5', sku: 'PIO-PLX-1000', name: 'PLX-1000', brand: 'Pioneer DJ', category: 'turntable', barcode_ean13: '4573211111114', sell_price: 27900, reorder_point: 1, is_active: true },
  { id: 'p6', sku: 'OTH-BAG', name: 'กระเป๋าหูฟัง', brand: 'Other', category: 'dj-bag', barcode_ean13: null, sell_price: 500, reorder_point: 0, is_active: true },
  { id: 'p7', sku: 'AT-XDJ-AZ', name: 'XDJ-AZ', brand: 'AlphaTheta', category: 'all-in-one', barcode_ean13: null, sell_price: 139000, reorder_point: 1, is_active: true });
FAKE.product_stock_levels.push({ product_id: 'p2', current_qty: 3 }, { product_id: 'p3', current_qty: 12 }, { product_id: 'p4', current_qty: 0 },
  { product_id: 'p5', current_qty: 1 }, { product_id: 'p6', current_qty: 4 }, { product_id: 'p7', current_qty: 2 });
window.YT = { PlayerState: { ENDED: 0 }, Player: function (id, opts) {
  const el = document.getElementById(id), f = document.createElement('iframe');
  f.id = id; f.src = 'about:blank'; el.replaceWith(f);
  this.opts = opts; this.loadVideoById = () => {}; this.loadPlaylist = () => {}; this.destroy = () => f.remove(); this.getIframe = () => f;
  setTimeout(() => opts.events.onReady && opts.events.onReady({ target: this }));
} };
window.FN.yt = () => ({ error: { code: 'not_configured', message: 'x' } });
</script>`;

const COMMON = `
${HARNESS}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);
const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
async function login(name) {
  $('loginEmail').value = name + '@x';
  $('loginPassword').value = 'x';
  await doLogin();
  await sleep(500);
}
function done() {
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
// ตัวรัน (cdp-page) เปลี่ยนขนาดจอให้ แล้วเรียก __rotated — รอ resize ของหน้า + เฟรมจัดเลย์เอาต์ใหม่
async function rotate(w, h) {
  await new Promise(r => { window.__rotated = r; console.log('[ROTATE] ' + w + 'x' + h); });
  await sleep(200); await frames(); await sleep(100);
}
async function shot(name) {
  await frames(); await sleep(150);
  await new Promise(r => { window.__shot = r; console.log('[SHOT] ' + name); });
}
function vis(el) {
  if (!el.getClientRects().length) return false;
  const cs = getComputedStyle(el);
  if (cs.visibility === 'hidden' || cs.display === 'none') return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
const CTRL = 'button, input:not([type=hidden]), select, textarea, a[href], [role=button], [onclick], table.data tbody tr, summary';
function controls(scope) { return [...scope.querySelectorAll(CTRL)].filter(vis); }
// ช่องติ๊กวัดจากป้ายที่ครอบมัน (แตะที่ป้ายก็ติ๊กได้ = เป้ากดจริง)
function hitRect(el) {
  if (el.matches('input[type=checkbox], input[type=radio]')) { const l = el.closest('label'); if (l) return l.getBoundingClientRect(); }
  return el.getBoundingClientRect();
}
function nm(el) {
  const r = hitRect(el);
  return el.tagName.toLowerCase() + (el.id ? '#' + el.id : el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/)[0] : '') +
    ' "' + (el.textContent || el.placeholder || el.value || el.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 24) + '" ' +
    Math.round(r.width) + '×' + Math.round(r.height);
}
function smallTargets(scope) {
  return controls(scope).filter(el => { const r = hitRect(el); return r.width < 43.5 || r.height < 43.5; }).map(nm);
}
// เลื่อนแนวนอนระดับหน้า = html/body/พื้นที่ทำงาน กว้างกว่าจอ
function pageOverflow() {
  const de = document.documentElement, ws = document.querySelector('.workspace'), out = [];
  if (de.scrollWidth > innerWidth + 1) out.push('html ' + de.scrollWidth + '>' + innerWidth);
  if (document.body.scrollWidth > innerWidth + 1) out.push('body ' + document.body.scrollWidth);
  if (ws.scrollWidth > ws.clientWidth + 1) {
    // บอกตัวการ: กล่องที่ขอบขวาเลยพื้นที่ทำงาน (ตัวในสุดก่อน)
    const wr = ws.getBoundingClientRect(), edge = wr.left + ws.clientWidth;
    const scrolled = e => { for (let p = e.parentElement; p && p !== ws; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') return true; return false; };
    const who = [...ws.querySelectorAll('*')].filter(e => e.getClientRects().length && e.getBoundingClientRect().right > edge + 1 && !scrolled(e))
      .slice(0, 4).map(e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ')[0] + ' →' + Math.round(e.getBoundingClientRect().right - edge));
    out.push('workspace ' + ws.scrollWidth + '/' + ws.clientWidth + ' ' + who.join(' '));
  }
  return out;
}
// ปุ่มที่ถูกตัด = ล้นขอบของกล่องที่ตัดทิ้ง (overflow ไม่ใช่ visible) หรือล้นจอ โดยไม่มีกล่องให้เลื่อนไปหา
function clippedCtrls(scope) {
  const ws = document.querySelector('.workspace');
  return controls(scope).filter(el => {
    const r = el.getBoundingClientRect();
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === 'visible') continue;
      if (/(auto|scroll)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 1 && p !== ws) return false;   // เลื่อนไปหาได้
      const pr = p.getBoundingClientRect();
      if (r.right > pr.right + 1 || r.left < pr.left - 1) return true;
    }
    return r.right > innerWidth + 1 || r.left < -1;
  }).map(nm);
}
function smallInputs() {
  return [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=color]), select, textarea')]
    .filter(el => parseFloat(getComputedStyle(el).fontSize) < 16).map(el => (el.id || el.className) + ' ' + getComputedStyle(el).fontSize);
}
// ของที่ "มองเห็นและกดได้" ใต้ปุ่มเครื่องคิดเลขจริง ๆ (ชุดเดียวกับ desk-polish)
function underCalc(scope) {
  const btn = $('calcBtn'), b = btn.getBoundingClientRect(), out = [];
  if (!vis(btn)) return out;
  btn.style.visibility = 'hidden';
  for (const el of controls(scope)) {
    const r = el.getBoundingClientRect();
    const x0 = Math.max(r.left, b.left), x1 = Math.min(r.right, b.right), y0 = Math.max(r.top, b.top), y1 = Math.min(r.bottom, b.bottom);
    if (x1 <= x0 || y1 <= y0) continue;
    let seen = false;
    for (let i = 0; i < 5 && !seen; i++) for (let j = 0; j < 5 && !seen; j++) {
      const hit = document.elementFromPoint(x0 + (x1 - x0) * (i + 0.5) / 5, y0 + (y1 - y0) * (j + 0.5) / 5);
      if (hit && (el === hit || el.contains(hit))) seen = true;
    }
    if (seen) out.push(nm(el));
  }
  btn.style.visibility = '';
  return out;
}
function textUnder(scope) {
  const b = $('calcBtn').getBoundingClientRect(), out = [], w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    if (!n.textContent.trim() || !n.parentElement.getClientRects().length || getComputedStyle(n.parentElement).visibility === 'hidden') continue;
    const r = document.createRange(); r.selectNodeContents(n);
    if ([...r.getClientRects()].some(q => q.left < b.right && q.right > b.left && q.top < b.bottom && q.bottom > b.top)) out.push('"' + n.textContent.trim().slice(0, 24) + '"');
  }
  return out;
}
const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const inView = r => r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
`;

// ── 1. ทุกขนาด: ทุกหมวด ─────────────────────────────────────────────────────────
// shots = ภาพที่ต้องถ่ายที่ขนาดนี้ { หมวด: ชื่อไฟล์ }
const SWEEP = (tag, shots) => `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
const SHOTS = ${JSON.stringify(shots)};
async function runTests() {
  const T = '${tag} ' + innerWidth + '×' + innerHeight;
  L('=== ' + T + ' (จอสัมผัส) ===');
  await login('tibass');
  ok(T + ': จำลองจอสัมผัสได้จริง (pointer: coarse · hover: none)', matchMedia('(pointer: coarse)').matches && matchMedia('(hover: none)').matches);
  ok(T + ': เจ้าของร้านเห็นทุกหมวด รวมหมวดผู้จัดการ', SECTIONS.some(s => s.manager) && SECTIONS.every(s => !s.manager || isManager()));
  ok(T + ': ห้อง Discord ยังพักอยู่ (ไม่มีในเมนู)', !document.querySelector('.nav-item[data-s="discord"]'));
  const drawer = innerWidth < 1100;
  const sb = document.querySelector('.sidebar');
  ok(T + (drawer ? ': เมนูซ้ายหุบเป็นลิ้นชัก มีปุ่มเมนูบนแถบบน' : ': เมนูซ้ายเต็มอยู่กับที่ ไม่มีปุ่มเมนู'),
    drawer ? (getComputedStyle(sb).visibility === 'hidden' && vis($('navBtn'))) : (vis(sb) && Math.round(sb.getBoundingClientRect().width) === 248 && !vis($('navBtn'))));
  const scope = () => document.querySelector('.app');
  const views = SECTIONS.map(s => ({ id: s.id, label: s.label + ' (#' + s.hash + ')' }))
    .concat([{ id: 'products', mode: 'receive', label: 'ผนังสต็อก โหมดรับเข้า' }, { id: 'products', mode: 'receive', reg: true, label: 'ผนังสต็อก โหมดรับเข้า (แผงลงทะเบียนเครื่องเปิด)' }, { id: 'products', mode: 'count', label: 'ผนังสต็อก โหมดนับ' }]);
  for (const v of views) {
    showSection(v.id);
    if (v.id === 'pos') { cart.length = 0; addToCart('p1'); addToCart('p2'); addToCart('p3'); }
    if (v.id === 'products') setWallMode(v.mode || 'find');
    if (v.mode === 'receive') { rcvRegOpen = !!v.reg; rcvRegApply(); }          // แผง "ลงทะเบียนเครื่อง" (6 ต.ค. 69) ต้องผ่านเกณฑ์จอสัมผัสชุดเดียวกัน
    if (v.mode === 'receive') { scanPurpose = 'receive'; await onScanned('619659216054', true); }
    await sleep(250); await frames();
    document.querySelector('.workspace').scrollTop = 0;
    await frames();
    const sec = $('sec-' + v.id);
    const p = pageOverflow();
    ok(T + ' ' + v.label + ': ไม่มีเลื่อนแนวนอนระดับหน้า', !p.length, p.join(' | '));
    const c = clippedCtrls(scope());
    ok(T + ' ' + v.label + ': ไม่มีปุ่ม/ช่องถูกตัดนอกกรอบ', !c.length, c.slice(0, 8).join(' | '));
    const s = smallTargets(scope());
    ok(T + ' ' + v.label + ': เป้ากดที่มองเห็นทุกอัน ≥ 44×44', !s.length, s.slice(0, 10).join(' | ') + (s.length > 10 ? ' …+' + (s.length - 10) : ''));
    const u = underCalc(sec), tx = textUnder(sec);
    ok(T + ' ' + v.label + ': ปุ่มเครื่องคิดเลขไม่ทับปุ่ม/ตัวหนังสือ (ตำแหน่งเลื่อนตั้งต้น)', !u.length && !tx.length, u.concat(tx).join(' | '));
    if (v.reg) {
      rcvRegOpen = false; rcvRegApply(); rcvRegToggle(); await frames();          // กดเปิดจริง: ต้องเลื่อนให้เห็นแผง
      const pr = $('rcvReg').getBoundingClientRect();
      ok(T + ' ' + v.label + ': แผงอยู่ในจอทั้งแผง · ช่องรุ่น/ช่องซีเรียล/ปุ่มเพิ่มเห็นครบ · ปุ่มกล้องยังอยู่ในโหมดนี้', !$('rcvReg').hidden && inView(pr) && vis($('rcvRegModel')) && vis($('rcvRegSerial')) && vis($('rcvRegAddBtn')) && vis(document.querySelector('.scanbox .cam-btn')), JSON.stringify(pr));
    }
    const key = v.mode ? v.id + '-' + v.mode + (v.reg ? '-reg' : '') : v.id;
    if (SHOTS[key]) await shot(SHOTS[key]);
  }
  rcvRegOpen = false;                       // ตอนนี้ถาดเป็นโหมดนับ (ไม่มีแผง) — ตั้งแค่ค่าสถานะ ไม่เรียก rcvRegApply
  setWallMode('find');
  const si = smallInputs();
  ok(T + ': ช่องกรอกทุกช่อง (รวมในหน้าต่างซ้อน) ตัวหนังสือ ≥ 16px — iOS ไม่ซูมเองตอนแตะ', !si.length, si.slice(0, 8).join(' | '));

  // หน้าต่างซ้อนทุกบานพอดีจอ (ยาวกว่าจอ = เลื่อนในตัว) · ปุ่มในนั้น ≥ 44
  const badDlg = [], smallDlg = [];
  for (const d of document.querySelectorAll('dialog')) {
    d.showModal(); await frames();
    const r = d.getBoundingClientRect();
    const scrolls = d.scrollHeight <= d.clientHeight + 1 || /(auto|scroll)/.test(getComputedStyle(d).overflowY);
    if (!inView(r) || !scrolls) badDlg.push(d.id + ' [' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(',') + ']');
    smallTargets(d).forEach(x => smallDlg.push(d.id + ': ' + x));
    d.close();
  }
  ok(T + ': หน้าต่างซ้อนทุกบานอยู่ในจอทั้งบาน', !badDlg.length, badDlg.join(' | '));
  ok(T + ': ปุ่ม/ช่องในหน้าต่างซ้อน ≥ 44×44', !smallDlg.length, smallDlg.slice(0, 10).join(' | '));

  // เครื่องคิดเลขเปิด: แผงอยู่ในจอ ปุ่มในแผง ≥ 44
  showSection('bills'); await sleep(150);
  openCalc(false); await frames();
  const cp = $('calcPanel').getBoundingClientRect();
  ok(T + ': แผงเครื่องคิดเลขอยู่ในจอทั้งแผง', inView(cp), JSON.stringify(cp));
  const sc = smallTargets($('calcPanel'));
  ok(T + ': ปุ่มในเครื่องคิดเลข ≥ 44×44', !sc.length, sc.join(' | '));
  // หน้าต่างวิดีโอลอย: อยู่ในจอ ไม่ทับปุ่ม/แผงเครื่องคิดเลข · ปุ่มบนแถบ ≥ 44
  await ytPlayUrl('https://youtu.be/jNQXAC9IVRw', 'ทดสอบ');
  showSection('bills'); openCalc(false); await sleep(150); await frames();
  const P = $('player').getBoundingClientRect();
  ok(T + ': หน้าต่างวิดีโอลอยอยู่ในจอทั้งบาน', inView(P), JSON.stringify(P));
  ok(T + ': หน้าต่างวิดีโอไม่ทับปุ่มและแผงเครื่องคิดเลข', !overlap(P, $('calcBtn').getBoundingClientRect()) && !overlap(P, $('calcPanel').getBoundingClientRect()));
  const sp = smallTargets($('player'));
  ok(T + ': ปุ่มบนแถบหน้าต่างวิดีโอ ≥ 44×44', !sp.length, sp.join(' | '));
  closeCalc(false);
  closePlayer();
  done();
}
</script>`;

// ── 2. ลิ้นชักเมนู (แนวตั้ง) ───────────────────────────────────────────────────
const NAV = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== ลิ้นชักเมนู ' + innerWidth + '×' + innerHeight + ' ===');
  await login('tibass');
  const sb = $('sidebar'), btn = $('navBtn'), main = document.querySelector('.main');
  ok('เริ่มต้นลิ้นชักหุบ: เมนูอยู่นอกจอและซ่อนจากลำดับ Tab', getComputedStyle(sb).visibility === 'hidden' && sb.getBoundingClientRect().right <= 0.5);
  ok('พื้นที่ทำงานเต็มความกว้างจอ (ไม่มีช่องว่างของเมนู)', Math.round(main.getBoundingClientRect().left) === 0 && Math.round(main.getBoundingClientRect().width) === innerWidth);
  const br = btn.getBoundingClientRect();
  ok('ปุ่มเมนูอยู่ซ้ายสุดของแถบบน ≥ 44×44 · aria-expanded=false', br.width >= 44 && br.height >= 44 && br.left < 40 && btn.getAttribute('aria-expanded') === 'false');
  btn.click(); await sleep(350);
  const r = sb.getBoundingClientRect();
  ok('แตะปุ่มเมนู → ลิ้นชักเลื่อนเข้ามาเต็มตัว อยู่บนสุด', document.body.classList.contains('nav-open') && getComputedStyle(sb).visibility === 'visible' &&
    Math.round(r.left) === 0 && r.right <= innerWidth && document.elementFromPoint(r.left + 40, r.top + 200) && sb.contains(document.elementFromPoint(r.left + 40, r.top + 200)));
  ok('aria-expanded=true · พื้นที่ข้างหลัง inert · โฟกัสอยู่ที่หมวดปัจจุบันในเมนู', btn.getAttribute('aria-expanded') === 'true' && main.inert &&
    document.activeElement && document.activeElement.classList.contains('nav-item') && document.activeElement.classList.contains('active'));
  const scrim = document.querySelector('.nav-scrim');
  ok('มีม่านมืดทับพื้นที่ทำงาน', vis(scrim) && document.elementFromPoint(innerWidth - 20, innerHeight / 2) === scrim);
  ok('เมนูในลิ้นชักเลื่อนได้ในตัว ไม่ลามไปเลื่อนหน้า', getComputedStyle($('navList')).overscrollBehaviorY === 'contain');
  const small = smallTargets(sb);
  ok('ปุ่มในลิ้นชักทุกอัน ≥ 44×44', !small.length, small.join(' | '));
  await shot('nav-open-portrait-820.png');
  // แตะม่าน = ปิด
  scrim.click(); await sleep(350);
  ok('แตะม่าน → ลิ้นชักหุบ · โฟกัสกลับปุ่มเมนู', !document.body.classList.contains('nav-open') && getComputedStyle(sb).visibility === 'hidden' && !main.inert &&
    document.activeElement === btn);
  // Esc = ปิด (ต่อคีย์บอร์ด)
  btn.click(); await sleep(50);
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
  await sleep(350);
  ok('Esc → ลิ้นชักหุบ โฟกัสกลับปุ่มเมนู', !document.body.classList.contains('nav-open') && document.activeElement === btn);
  // ไปได้ทุกหมวดผ่านลิ้นชัก
  const bad = [];
  const MENU = SECTIONS.filter(s => s.menu !== false);        // หมวดที่เก็บไว้ให้ลิงก์เก่า (รับเข้า / ตัดออก / ปรับยอด) ไม่อยู่ในเมนู
  for (const s of MENU) {
    btn.click(); await sleep(60);
    const item = document.querySelector('#navList .nav-item[data-s="' + s.id + '"]');
    item.click(); await sleep(120);
    if (current !== s.id || $('sec-' + s.id).hidden || document.body.classList.contains('nav-open')) bad.push(s.id);
  }
  ok('แตะหมวดในลิ้นชัก → เปิดหมวดนั้นและลิ้นชักหุบเอง ครบทุกหมวดในเมนู (' + MENU.length + ')', !bad.length && MENU.length === SECTIONS.length - 1, bad.join(','));
  // คีย์ลัดยังใช้ได้เมื่อต่อคีย์บอร์ด
  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit4', key: '4', altKey: true, bubbles: true, cancelable: true }));
  await sleep(100);
  ok('ต่อคีย์บอร์ด: Alt+4 ยังเปิดหน้าขาย', current === 'pos');
  // แตะไปหน้าขายบนจอสัมผัส: ไม่ดึงโฟกัสเข้าช่องพิมพ์ (แป้นบนจอไม่เด้งบังครึ่งจอ)
  btn.click(); await sleep(60);
  document.querySelector('#navList .nav-item[data-s="home"]').click(); await sleep(80);
  btn.click(); await sleep(60);
  document.querySelector('#navList .nav-item[data-s="pos"]').click(); await sleep(120);
  ok('จอสัมผัส: เปิดหน้าขายแล้วไม่โฟกัสช่องค้นหาเอง (แป้นพิมพ์บนจอไม่เด้ง)', document.activeElement !== $('posSearch') && !isField(document.activeElement));
  launchGo('pos'); await sleep(80);
  ok('จอสัมผัส: ไอคอนลัดขายหน้าร้านก็ไม่โฟกัสช่องค้นหาเอง', document.activeElement !== $('posSearch'));
  showSection('products'); setWallMode('receive'); await sleep(80);
  ok('จอสัมผัส: สลับโหมดผนังไม่โฟกัสช่องยิงเอง', document.activeElement !== $('productSearch'));
  setWallMode('find');
  done();
}
</script>`;

// ── 3. หมุนจอกลางงาน ────────────────────────────────────────────────────────────
const ROTATE = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
function state(tag) {
  const P = $('player').getBoundingClientRect(), cp = $('calcPanel').getBoundingClientRect(), cb = $('calcBtn').getBoundingClientRect();
  const D = $('detail').getBoundingClientRect();
  ok(tag + ': ตะกร้ายังมี 2 รายการ (DDJ-FLX4 · DJM-S11)', cart.length === 2 && cart[0].name === 'DDJ-FLX4' && cart[1].name === 'DJM-S11', cart.map(c => c.name).join(','));
  ok(tag + ': ถาดรับเข้ายังมี 2 ชิ้นและโชว์อยู่', rcvTotal() === 2 && !$('tray').hidden && $('tray').querySelectorAll('.t-card').length === 2, rcvTotal() + ' / ' + $('tray').querySelectorAll('.t-card').length);
  ok(tag + ': แผงสินค้ายังเปิดอยู่และอยู่ในจอ', detailOpen() && inView(D), JSON.stringify(D));
  ok(tag + ': เครื่องคิดเลขยังเปิดอยู่ แผงอยู่ในจอ', !$('calcPanel').hidden && inView(cp) && inView(cb), JSON.stringify(cp));
  ok(tag + ': หน้าต่างวิดีโอยังเล่นอยู่ อยู่ในจอทั้งบาน ไม่ทับเครื่องคิดเลข', !$('player').hidden && inView(P) && !overlap(P, cb) && !overlap(P, cp), JSON.stringify(P));
  const p = pageOverflow();
  ok(tag + ': ไม่มีเลื่อนแนวนอนระดับหน้า', !p.length, p.join(' | '));
}
async function runTests() {
  L('=== หมุนจอกลางงาน (เริ่ม ' + innerWidth + '×' + innerHeight + ') ===');
  await login('tibass');
  showSection('pos'); addToCart('p1'); addToCart('p2');
  showSection('products'); setWallMode('receive');
  scanPurpose = 'receive'; await onScanned('619659216054', true); await onScanned('4573211111111', true);
  openProduct('p1'); await sleep(200);
  openCalc(false);
  await ytPlayUrl('https://youtu.be/jNQXAC9IVRw', 'ทดสอบ'); await sleep(100);
  miniPos = { x: 5000, y: 5000 }; playerLayout();          // ลากไปมุมขวาล่างสุด
  setNav(true); await sleep(350);
  state('แนวตั้ง 820×1180');
  await rotate(1180, 820);
  state('หมุนเป็นแนวนอน 1180×820');
  ok('แนวนอน: เมนูซ้ายเต็มอยู่กับที่ ไม่มีม่าน พื้นที่ข้างหลังไม่ inert', vis($('sidebar')) && $('sidebar').getBoundingClientRect().left === 0 &&
    !vis(document.querySelector('.nav-scrim')) && !document.querySelector('.main').inert);
  await rotate(820, 1180);
  state('หมุนกลับแนวตั้ง 820×1180');
  ok('แนวตั้งอีกครั้ง: ลิ้นชักเมนูที่เปิดค้างไว้ยังเปิดอยู่ (ม่าน + inert กลับมา)', document.body.classList.contains('nav-open') &&
    getComputedStyle($('sidebar')).visibility === 'visible' && vis(document.querySelector('.nav-scrim')) && document.querySelector('.main').inert);
  setNav(false);
  await rotate(1366, 1024);
  state('iPad Pro 12.9 แนวนอน 1366×1024');
  await rotate(744, 1133);
  state('iPad mini แนวตั้ง 744×1133');
  showSection('pos'); await sleep(150);
  ok('กลับมาหน้าขาย: ตะกร้าโชว์ 2 บรรทัด', document.querySelectorAll('#cartList tbody tr').length === 2);
  done();
}
</script>`;

// ── 4. กล้อง ────────────────────────────────────────────────────────────────────
// getUserMedia ปลอม = ภาพจาก canvas จริง (captureStream) · ZXing ปลอมอ่านได้ตามที่เทสต์ตั้ง __code
// ไม่มี BarcodeDetector (เหมือน Safari บน iPad) — ต้องตกไปทาง ZXing ชุดเดียวกับ stock.html
const CAMERA = `<script>
delete window.BarcodeDetector;
window.__code = null;
let ZX_DECODES = 0;
window.ZXing = {
  DecodeHintType: { POSSIBLE_FORMATS: 2, TRY_HARDER: 3 },
  BarcodeFormat: { CODE_128: 4, CODE_39: 2, EAN_13: 7, QR_CODE: 11 },
  MultiFormatReader: function () { this.setHints = h => { this.hints = h; }; this.reset = () => {};
    this.decode = () => { ZX_DECODES++; if (window.__code) { const c = window.__code; window.__code = null; return { getText: () => c }; } throw new Error('NotFound'); }; },
  HTMLCanvasElementLuminanceSource: function () {}, BinaryBitmap: function () {}, HybridBinarizer: function () {},
};
const STREAMS = [];
navigator.mediaDevices.getUserMedia = async (c) => {
  const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720;
  const g = cv.getContext('2d');
  const paint = () => {
    g.fillStyle = '#8a8478'; g.fillRect(0, 0, 1280, 720);
    g.fillStyle = '#fff'; g.fillRect(360, 240, 560, 240);           // กล่องสินค้า (สติกเกอร์บาร์โค้ด)
    g.fillStyle = '#0f0f0f';
    for (let x = 400, i = 0; x < 880; i++) { const w = [3, 6, 3, 9, 3, 6][i % 6]; g.fillRect(x, 280, w, 140); x += w + [4, 3, 6, 3][i % 4]; }
    g.font = 'bold 26px sans-serif'; g.fillText('6 19659 21605 4', 470, 455);
  };
  paint(); setInterval(paint, 200);
  const s = cv.captureStream(15);
  s.__constraints = c;
  s.getVideoTracks().forEach(t => { t.getCapabilities = () => ({}); });
  STREAMS.push(s);
  return s;
};
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
const live = () => STREAMS.filter(s => s.getTracks().some(t => t.readyState === 'live')).length;
async function read(code) { clock += 5000; window.__code = code; for (let i = 0; i < 30 && window.__code; i++) await sleep(50); await sleep(150); }
async function runTests() {
  L('=== กล้อง ' + innerWidth + '×' + innerHeight + ' ===');
  await login('tibass');
  showSection('pos'); cart.length = 0; renderCart(); await sleep(100);
  const posCam = document.querySelector('#sec-pos .cam-btn'), wallCam = document.querySelector('#sec-products .cam-btn');
  ok('จอสัมผัส: มีปุ่มกล้องที่ช่องค้นหาหน้าขาย ≥ 44×44', posCam && vis(posCam) && posCam.getBoundingClientRect().height >= 44 && posCam.getBoundingClientRect().width >= 44);
  // ตัวสอดแนม: รหัสจากกล้องต้องเข้า onScanned ด้วยจุดประสงค์เดียวกับที่ wedgeRoute ให้เครื่องยิง
  const seen = [], orig = window.onScanned;
  window.onScanned = async (code, viaGun) => { seen.push({ code, purpose: scanPurpose, route: wedgeRoute(), viaGun }); return orig(code, viaGun); };
  posCam.click(); await sleep(600);
  const v = $('camVideo');
  ok('แตะกล้อง → แผงกล้องโผล่ ภาพจากกล้องเล่นอยู่ (กล้องหลัง)', !$('camPanel').hidden && v.readyState >= 2 && !v.paused && live() === 1 &&
    STREAMS[0].__constraints.video.facingMode.ideal === 'environment');
  ok('ไม่มี BarcodeDetector → ใช้ ZXing ค่าเดียวกับ stock.html (EAN-13 · CODE-128 · CODE-39 · QR · TRY_HARDER)', cam.reader && !cam.detector &&
    JSON.stringify(cam.reader.hints.get(2)) === JSON.stringify([4, 2, 7, 11]) && cam.reader.hints.get(3) === true && ZX_DECODES > 0);
  const cr = $('camPanel').getBoundingClientRect();
  ok('แผงกล้องอยู่ในจอทั้งแผง · ปุ่มในแผง ≥ 44×44', inView(cr) && !smallTargets($('camPanel')).length, smallTargets($('camPanel')).join(' | '));
  ok('แผงกล้องไม่ใช่หน้าต่างซ้อน (dialog) — เครื่องยิงยังยิงเข้าได้', $('camPanel').tagName !== 'DIALOG' && !document.querySelector('dialog[open]') && wedgeRoute() === 'cart');
  await read('619659216054');
  ok('อ่านบาร์โค้ดรุ่นได้ → ลงตะกร้า (ทางเดียวกับเครื่องยิง: onScanned ด้วยจุดประสงค์ cart = wedgeRoute)', cart.length === 1 && cart[0].name === 'DDJ-FLX4' &&
    seen.length === 1 && seen[0].code === '619659216054' && seen[0].purpose === 'cart' && seen[0].route === 'cart', JSON.stringify(seen));
  ok('หน้าขาย: กล้องเปิดค้างอ่านชิ้นต่อไป · บอกจำนวนในตะกร้าบนแผง', !$('camPanel').hidden && live() === 1 && /ในตะกร้า 1 รายการ/.test($('camHint').textContent), $('camHint').textContent);
  await sleep(700);
  clock += 100; window.__code = '619659216054'; await sleep(700);
  ok('จ่อกล่องเดิมค้างไว้ (ภายใน 2 วิ) ไม่นับซ้ำ', cart.length === 1 && cart[0].qty === 1, JSON.stringify(cart.map(c => c.qty)));
  window.__code = null;
  await read('4573211111111');
  ok('ชิ้นถัดไป (DJM-S11) ลงตะกร้า', cart.length === 2 && cart[1].name === 'DJM-S11');
  // เครื่องยิง Bluetooth ระหว่างกล้องเปิดอยู่
  burst(digits('4573211111112')); await sleep(300);
  ok('กล้องเปิดอยู่แล้วยิงด้วยเครื่องยิง Bluetooth (= คีย์บอร์ด) → ลงตะกร้าได้ตามปกติ', cart.length === 3 && cart[2].name === 'NEO d+ RCA Class A 1m');
  await shot('camera-portrait-820.png');
  // เปลี่ยนหมวด = ปิดกล้องจริง
  showSection('home'); await sleep(100);
  ok('เปลี่ยนหมวด → แผงกล้องปิด และกล้องหยุดจริง (track ended)', $('camPanel').hidden && live() === 0 && !cam.stream && !v.srcObject);
  // ผนังโหมดรับเข้า
  showSection('products'); setWallMode('receive'); await sleep(100);
  ok('ผนังสต็อก: มีปุ่มกล้องในช่องยิง ≥ 44×44', wallCam && vis(wallCam) && wallCam.getBoundingClientRect().height >= 44);
  seen.length = 0;
  wallCam.click(); await sleep(600);
  await read('619659216054');
  ok('ผนังโหมดรับเข้า: อ่านได้ → เข้าถาดรับเข้า (จุดประสงค์ receive เหมือนยิง)', rcvTotal() === 1 && seen.length === 1 && seen[0].purpose === 'receive', rcvTotal() + ' ' + JSON.stringify(seen));
  ok('รับเข้า: กล้องเปิดค้าง บอกจำนวนในถาด', !$('camPanel').hidden && /ในถาดรับเข้า 1 ชิ้น/.test($('camHint').textContent), $('camHint').textContent);
  // แอปถูกซ่อน (สลับแอป/ล็อกจอ) = ปิดกล้อง
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
  delete document.hidden;
  await sleep(50);
  ok('สลับแอป/ล็อกจอ (visibilitychange) → กล้องปิดจริง', $('camPanel').hidden && live() === 0 && !cam.stream);
  // โหมดนับ
  setWallMode('count'); await sleep(50);
  wallCam.click(); await sleep(600);
  await read('4573211111113');
  ok('ผนังโหมดนับ: อ่านได้ → นับรุ่นนั้น (จุดประสงค์ count)', seen.some(x => x.purpose === 'count' && x.code === '4573211111113') && !$('camPanel').hidden);
  // ปุ่มเสร็จแล้ว
  $('camDoneBtn').click(); await sleep(50);
  ok('กด "เสร็จแล้ว" → กล้องปิดจริง', $('camPanel').hidden && live() === 0);
  // โหมดหา: อ่านได้แล้วเปิดแผงสินค้า ปิดกล้องเอง
  setWallMode('find'); await sleep(50);
  wallCam.click(); await sleep(600);
  await read('4573211111114');
  ok('ผนังโหมดหา: อ่านได้ → เปิดแผงสินค้ารุ่นนั้น แล้วปิดกล้องเอง', detailOpen() && $('detailTitle').textContent.includes('PLX-1000') && $('camPanel').hidden && live() === 0,
    $('detailTitle').textContent);
  // รหัสที่ไม่รู้จัก: หน้าต่างถาม "บาร์โค้ดรุ่นหรือซีเรียล?" แล้วปิดกล้อง (ไม่อ่านต่อลับหลัง)
  wallCam.click(); await sleep(600);
  await read('ZZTEST000001');
  ok('รหัสที่ไม่รู้จัก → ถามแบบเดียวกับยิง และปิดกล้อง', $('codeDialog').open && $('camPanel').hidden && live() === 0);
  $('codeDialog').close();
  // ปิดแผงระหว่างรอคนกดอนุญาตกล้อง — กล้องที่ได้มาทีหลังต้องถูกปิดทิ้ง
  const slow = navigator.mediaDevices.getUserMedia;
  let release; navigator.mediaDevices.getUserMedia = c => new Promise(r => { release = () => r(slow(c)); });
  wallCam.click(); await sleep(50);
  $('camDoneBtn').click();
  release(); await sleep(300);
  ok('ปิดแผงระหว่างรอขออนุญาตกล้อง → กล้องที่ได้มาทีหลังถูกปิดทิ้งทันที', $('camPanel').hidden && live() === 0 && !cam.stream);
  navigator.mediaDevices.getUserMedia = slow;
  // ไม่ได้รับอนุญาต: บอกบนจอ (กฎข้อ 8)
  navigator.mediaDevices.getUserMedia = async () => { const e = new Error('denied'); e.name = 'NotAllowedError'; throw e; };
  wallCam.click(); await sleep(200);
  ok('ไม่ได้รับอนุญาตกล้อง → แจ้งบนแผงพร้อมวิธีเปิดสิทธิ์ (ไม่เงียบ)', !$('camPanel').hidden && /ไม่ได้รับอนุญาตให้ใช้กล้อง/.test($('camError').textContent));
  closeCam();
  window.onScanned = orig;
  done();
}
</script>`;

// ── 5. เครื่องยิง Bluetooth · ของที่เคยต้องชี้เมาส์ · แป้นพิมพ์บนจอ ─────────────────
const TOUCH = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== จอสัมผัส ' + innerWidth + '×' + innerHeight + ': เครื่องยิง Bluetooth · ของที่เคยต้องชี้ · แป้นพิมพ์บนจอ ===');
  await login('tibass');
  // "+ เพิ่มรูป" (เจ้าของร้าน) — บนคอมโผล่เมื่อชี้/เลือกแถว · บนจอสัมผัสต้องเห็นตลอด
  showSection('products'); await sleep(200);
  const rows = [...document.querySelectorAll('#wall .w-row')].filter(r => !r.classList.contains('sel'));
  const adds = rows.map(r => r.querySelector('.ph-add')).filter(Boolean);
  const shown = adds.filter(a => vis(a.querySelector('.cta')) && /เพิ่มรูป/.test(a.querySelector('.cta').textContent) && !vis(a.querySelector('.idle')));
  ok('เจ้าของร้าน: "+ เพิ่มรูป" เห็นทุกแถวที่ยังไม่มีรูป โดยไม่ต้องชี้/เลือกแถว (' + shown.length + '/' + adds.length + ')', adds.length >= 5 && shown.length === adds.length);
  ok('ช่อง "+ เพิ่มรูป" ≥ 44×44', adds.every(a => a.getBoundingClientRect().width >= 44 && a.getBoundingClientRect().height >= 44));
  // ที่จับหน้าต่างวิดีโอ: บนคอมคือเคอร์เซอร์มือ — จอสัมผัสต้องเห็นเป็นภาพ
  await ytPlayUrl('https://youtu.be/jNQXAC9IVRw', 'ทดสอบ'); showSection('bills'); await sleep(150);
  const grip = document.querySelector('#playerBar .player-grip');
  ok('หน้าต่างวิดีโอลอย: ที่จับ (จุดหกจุด) เห็นบนจอสัมผัส', grip && vis(grip));
  // ลากด้วยนิ้ว (pointer events ชนิด touch)
  const bar = $('playerBar'), P0 = $('player').getBoundingClientRect();
  const pe = (type, x, y) => bar.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true, cancelable: true }));
  pe('pointerdown', P0.left + 120, P0.top + 20); pe('pointermove', P0.left - 80, P0.top - 220); pe('pointerup', P0.left - 80, P0.top - 220);
  await sleep(50);
  const P1 = $('player').getBoundingClientRect();
  ok('ลากหน้าต่างวิดีโอด้วยนิ้วได้', Math.abs((P1.left - P0.left) + 200) <= 2 && Math.abs((P1.top - P0.top) + 240) <= 2, JSON.stringify([P0.left, P0.top, P1.left, P1.top]));
  ok('touch-action: none ที่แถบลาก (นิ้วลากหน้าต่าง ไม่เลื่อนหน้า)', getComputedStyle(bar).touchAction === 'none');
  // กล่องที่เลื่อนในตัวไม่ลามไปเลื่อนหน้าข้างหลัง (ปัดจนสุดแล้วหยุด)
  const chain = ['navList', 'detail', 'globalResults', 'posResults', 'calcPanel', 'wall'].map(id => $(id))
    .concat([document.querySelector('.wing-b')]).filter(el => el && getComputedStyle(el).overscrollBehaviorY !== 'contain');
  ok('เมนู · แผงขวา · ผลค้นหา · เครื่องคิดเลข · ผนัง · ปีก: ปัดจนสุดแล้วไม่ลามไปเลื่อนหน้า (overscroll contain)', !chain.length, chain.map(e => e.id || e.className).join(','));
  ok('ทั้งหน้าไม่เด้ง/ไม่ดึงรีเฟรช (overscroll none ที่ html)', getComputedStyle(document.documentElement).overscrollBehaviorY === 'none');
  ok('แตะรัว ๆ ไม่กลายเป็นแตะสองทีซูม (touch-action: manipulation ที่ปุ่ม) — ถ่างนิ้วซูมยังได้', getComputedStyle($('backBtn')).touchAction === 'manipulation');
  // ข้อความที่บนคอมอ่านเต็มจากป้ายตอนชี้ (title) — จอสัมผัสต้องตัดบรรทัดให้เห็นครบ
  showSection('products'); setWallMode('receive'); scanPurpose = 'receive'; await onScanned('619659216054', true); await sleep(100);
  ok('ข้อความล่าสุดบนถาดรับเข้า: ตัดบรรทัด ไม่ตัดเป็น …', $('trayNote').textContent && getComputedStyle($('trayNote')).whiteSpace === 'normal');
  rcv.groups.length = 0; setWallMode('find');
  showSection('home'); await sleep(50);
  const ttl = document.querySelector('#tileCal .ttl');
  ok('ชื่อกิจกรรมในกล่อง "วันนี้" (หน้าแรก): ตัดบรรทัด ไม่ตัดเป็น …', ttl && getComputedStyle(ttl).whiteSpace === 'normal');
  showSection('bills');
  // ไม่มีอะไรต้องคลิกขวา/ดับเบิลคลิก
  const dbl = [...document.querySelectorAll('[ondblclick], [oncontextmenu]')].map(e => e.id || e.className);
  ok('ไม่มีอะไรที่ต้องดับเบิลคลิกหรือคลิกขวา', !dbl.length && !/addEventListener\\(['"](dblclick|contextmenu)/.test(document.documentElement.innerHTML), dbl.join(','));

  // แป้นพิมพ์บนจอเปิด (visualViewport หด) → แจ้งเตือนลอยเหนือแป้น · หน้าต่างวิดีโอลอยหลบ · ปิดแป้นแล้วกลับมา
  const realVV = window.visualViewport, fake = new EventTarget();
  Object.assign(fake, { width: innerWidth, height: innerHeight - 400, offsetTop: 0, offsetLeft: 0, scale: 1 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => fake });
  syncKeyboard();
  showToast('ทดสอบแจ้งเตือน'); await sleep(350);
  const tr = $('toast').getBoundingClientRect();
  ok('แป้นพิมพ์บนจอเปิด (สูง 400px): แจ้งเตือนลอยเหนือแป้น ไม่จมใต้แป้น', tr.bottom <= innerHeight - 400 && tr.bottom > innerHeight - 460, JSON.stringify(tr));
  ok('แป้นพิมพ์เปิด: หน้าต่างวิดีโอลอยหลบ (ซ่อนภาพ ไม่ถอด iframe เพลงเล่นต่อ)', getComputedStyle($('player')).visibility === 'hidden' && !$('player').hidden && $('playerBody').querySelector('iframe'));
  Object.assign(fake, { height: innerHeight - 60 });          // แถบเครื่องมือ Safari กาง/หุบ ไม่ใช่แป้น
  syncKeyboard();
  ok('ความสูงหายไปแค่ 60px (แถบเครื่องมือ) ไม่นับเป็นแป้นพิมพ์', !document.body.classList.contains('kb-open') && getComputedStyle($('player')).visibility === 'visible');
  Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => realVV });
  syncKeyboard();
  ok('แป้นพิมพ์ปิด: ทุกอย่างกลับที่เดิม', !document.body.classList.contains('kb-open') && document.documentElement.style.getPropertyValue('--kb') === '0px');
  closePlayer();

  // เครื่องยิง Bluetooth = คีย์บอร์ด: ตัวตรวจเครื่องยิงชุดเดิมต้องจับได้ทุกสภาพของจอสัมผัส
  showSection('pos'); cart.length = 0; renderCart(); await sleep(100);
  ok('เปิดหน้าขายด้วยการแตะ: ไม่มีช่องพิมพ์โฟกัส (แป้นบนจอไม่เด้ง)', !isField(document.activeElement));
  burst(digits('619659216054')); await sleep(200);
  ok('ไม่มีช่องโฟกัส (โฟกัสอยู่ที่หน้า) → ยิงเข้าตะกร้าได้', cart.length === 1);
  setNav(true); await sleep(300);
  burst(digits('4573211111111')); await sleep(200);
  ok('ลิ้นชักเมนูเปิดอยู่ (โฟกัสอยู่ในเมนู) → ยิงเข้าตะกร้าได้ ลิ้นชักไม่ขยับ', cart.length === 2 && document.body.classList.contains('nav-open'));
  setNav(false); await sleep(300);
  $('posCustomer').focus(); $('posCustomer').value = 'สม';
  burst(digits('4573211111112')); await sleep(200);
  ok('แตะช่องลูกค้าแล้วพิมพ์ค้างไว้ → ยิงเข้าตะกร้าได้ ข้อความในช่องคงเดิม', cart.length === 3 && $('posCustomer').value === 'สม', cart.length + ' ' + $('posCustomer').value);
  $('posCustomer').value = ''; $('posCustomer').blur();
  // ผนังโหมดรับเข้า + นับ
  showSection('products'); setWallMode('receive'); await sleep(100);
  burst(digits('619659216054')); await sleep(200);
  ok('ผนังโหมดรับเข้า: ยิงเข้าถาด', rcvTotal() === 1);
  setWallMode('find');
  // เครื่องคิดเลข: ปุ่มแตะได้ (ไม่ต้องใช้แป้น)
  openCalc(false); await frames();
  ['1', '2', '+', '3', '='].forEach(k => document.querySelector('#calcKeys [data-k="' + k + '"]').click());
  ok('เครื่องคิดเลข: แตะปุ่มได้ครบ 12 + 3 = 15', $('calcOut').textContent.replace(/[^0-9]/g, '') === '15', $('calcOut').textContent);
  closeCalc(false);
  // ป้ายคีย์ลัดซ่อนบนจอสัมผัส แต่หน้า "?" ยังเปิดได้
  const kbds = [...document.querySelectorAll('.nav-item .kbd, .scanbox kbd, .btn kbd, .kbd-hint')].filter(vis);
  ok('ป้ายบอกคีย์ลัด (Alt+… · / · F9 · Esc) ซ่อนบนจอสัมผัส', !kbds.length, kbds.map(k => k.textContent).join(','));
  ok('ท้ายเมนูยังมีปุ่มดูคีย์ลัดทั้งหมด (สำหรับตอนต่อคีย์บอร์ด)', !!document.querySelector('.sidebar-foot button'));
  done();
}
</script>`;

// ── 6. คอมหน้าเคาน์เตอร์ (เมาส์) — ของ iPad ต้องไม่โผล่ ──────────────────────────
const DESK = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== คอมหน้าเคาน์เตอร์ ' + innerWidth + '×' + innerHeight + ' (เมาส์) ===');
  await login('tibass');
  ok('จำลองเมาส์ได้จริง (pointer: fine · hover: hover)', matchMedia('(pointer: fine)').matches && matchMedia('(hover: hover)').matches);
  ok('ไม่มีปุ่มเมนู · เมนูซ้าย 248px อยู่กับที่', !vis($('navBtn')) && Math.round($('sidebar').getBoundingClientRect().width) === 248 && vis($('sidebar')));
  showSection('pos'); await sleep(100);
  ok('ไม่มีกล้อง: ไม่มีปุ่มกล้องที่หน้าขาย/ผนัง', [...document.querySelectorAll('.cam-btn')].every(b => !vis(b)));
  syncCamAvail.hasCam = true; syncCamAvail();
  ok('เครื่องที่มีกล้อง (เช่น โน้ตบุ๊กมีเว็บแคม): ปุ่มกล้องโผล่ ตามที่เจ้าของกำหนด', vis(document.querySelector('#sec-pos .cam-btn')));
  syncCamAvail.hasCam = false; syncCamAvail();
  ok('ปุ่มเล็กยังเล็กเท่าเดิม (32px) · ช่องกรอก 15px', Math.round($('backBtn').getBoundingClientRect().height) === 32 && getComputedStyle($('posSearch')).fontSize === '15px');
  ok('ป้ายคีย์ลัดยังอยู่ (Alt+4 ในเมนู · F9 บนปุ่มบันทึก)', vis(document.querySelector('.nav-item[data-s="pos"] .kbd')) && vis(document.querySelector('#saveSaleBtn kbd')));
  showSection('products'); await sleep(150);
  const add = document.querySelector('#wall .w-row:not(.sel) .ph-add');
  ok('"+ เพิ่มรูป" ยังเงียบจนชี้/เลือกแถว (ไม่กลายเป็นปุ่มเต็มผนัง)', add && !vis(add.querySelector('.cta')));
  ok('แป้นพิมพ์บนจอไม่เกี่ยวกับคอม: ไม่มี kb-open', !document.body.classList.contains('kb-open'));
  done();
}
</script>`;

// ── 0. ตรวจจากไฟล์: viewport · ติดตั้งลงหน้าจอโฮม (Add to Home Screen) ─────────────────
const html = readFileSync(join(root, 'desk.html'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'desk.webmanifest'), 'utf8'));
let sPass = 0, sFail = 0;
const sOk = (name, cond, extra) => { if (cond) { sPass++; console.log('  [PASS] ' + name); } else { sFail++; console.log('  [FAIL] ' + name + (extra ? ' — ' + extra : '')); } };
console.log('  === ไฟล์: viewport + ติดตั้งบน iPad ===');
const vp = (html.match(/<meta name="viewport" content="([^"]+)"/) || [])[1] || '';
sOk('viewport: width=device-width + viewport-fit=cover (ใช้ขอบจอเต็มแล้วเว้นด้วย safe-area เอง)', /width=device-width/.test(vp) && /viewport-fit=cover/.test(vp), vp);
sOk('viewport: ไม่ปิดการซูมของผู้ใช้ (ไม่มี user-scalable=no / maximum-scale)', !/user-scalable\s*=\s*(no|0)|maximum-scale/.test(vp), vp);
const icon = (html.match(/<link rel="apple-touch-icon"[^>]*href="([^"]+)"/) || [])[1];
sOk('apple-touch-icon ชี้ไฟล์ที่มีจริง', icon && existsSync(join(root, icon)), icon);
sOk('manifest: เปิดเต็มจอเป็นแอป (standalone) · เริ่มที่ desk.html · ไอคอนมีไฟล์จริง', manifest.display === 'standalone' && /desk\.html$/.test(manifest.start_url) &&
  manifest.icons.length >= 2 && manifest.icons.every(i => existsSync(join(root, i.src))));
sOk('หน้าเว็บผูก manifest ของคอนโซล + แท็กแอปเต็มจอของ iOS รุ่นเก่า', /<link rel="manifest" href="desk\.webmanifest">/.test(html) && /apple-mobile-web-app-capable" content="yes"/.test(html));
const ZX = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
sOk('ZXing ไม่โหลดตอนเปิดหน้า (คอมหน้าเคาน์เตอร์ไม่มีกล้อง) — โหลดตอนกดกล้อง URL เดียวกับ stock.html',
  !html.includes('<script src="' + ZX) && html.includes("'" + ZX + "'") && readFileSync(join(root, 'stock.html'), 'utf8').includes('<script src="' + ZX));
console.log('  === สรุป: ' + sPass + ' PASS / ' + sFail + ' FAIL ===');

const net = '--host-resolver-rules=MAP * ~NOTFOUND';
const mock = MOCK3 + OPS_MOCK + EXTRA;   // + ข้อมูล Ops Board ตัวอย่าง (เลย์เอาต์ต้องถูกตรวจกับงานจริงหลายแถว ไม่ใช่หน้าว่าง)
// คอมหน้าเคาน์เตอร์ไม่มีกล้อง — เครื่องที่รันเทสต์อาจมีเว็บแคม จึงตั้งรายการอุปกรณ์ให้ว่างก่อนหน้าเว็บโหลด
const NO_CAM = '<script>if (navigator.mediaDevices) navigator.mediaDevices.enumerateDevices = async () => [];</script>';
const run = (w, h, tests, coarse = true) => () => runCdpPage({ root, file: 'desk.html', mock: coarse ? mock : NO_CAM + mock, tests, width: w, height: h, coarse, shotDir: SHOTS, flags: [net] });
const jobs = [
  run(768, 1024, SWEEP('iPad 10.2 แนวตั้ง', { calendar: 'calendar-portrait-768.png' })),
  run(1024, 768, SWEEP('iPad 10.2 แนวนอน', {})),
  run(820, 1180, SWEEP('iPad Air แนวตั้ง', { home: 'home-portrait-820.png', products: 'stock-portrait-820.png', pos: 'pos-portrait-820.png' })),
  run(1180, 820, SWEEP('iPad Air แนวนอน', { home: 'home-landscape-1180.png', products: 'stock-landscape-1180.png', pos: 'pos-landscape-1180.png' })),
  run(834, 1194, SWEEP('iPad Pro 11 แนวตั้ง', {})),
  run(1194, 834, SWEEP('iPad Pro 11 แนวนอน', {})),
  run(1024, 1366, SWEEP('iPad Pro 12.9 แนวตั้ง', {})),
  run(1366, 1024, SWEEP('iPad Pro 12.9 แนวนอน', { home: 'pro129-landscape-1366.png' })),
  run(820, 1180, NAV),
  run(820, 1180, ROTATE),
  run(820, 1180, CAMERA),
  run(820, 1180, TOUCH),
  run(1440, 900, DESK, false),
];
// สามตัวพร้อมกัน — เร็วขึ้นโดยไม่แย่ง CPU จนจังหวะเวลาในเทสต์เพี้ยน
const results = [];
for (let i = 0; i < jobs.length; i += 3) results.push(...await Promise.all(jobs.slice(i, i + 3).map(j => j())));
const okAll = results.every(r => r.ok) && !sFail;
const total = results.reduce((s, r) => { const m = r.lines.join('\n').match(/สรุป: (\d+) PASS \/ (\d+) FAIL/); return m ? [s[0] + +m[1], s[1] + +m[2]] : s; }, [sPass, sFail]);
console.log('\n=== desk-ipad รวม: ' + total[0] + ' PASS / ' + total[1] + ' FAIL' + (okAll ? '' : ' — มีชุดที่ไม่ผ่านหรือไม่ได้รันจนจบ') + ' ===');
process.exit(okAll ? 0 : 1);
