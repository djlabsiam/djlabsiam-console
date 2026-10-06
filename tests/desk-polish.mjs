/**
 * เทสต์รอบเก็บงาน (polish) ของ desk.html — 1 ต.ค. 69
 *   รัน: node tests/desk-polish.mjs
 *
 * 1. ปุ่มเครื่องคิดเลขอยู่มุมขวาบนของพื้นที่ทำงาน ใต้เส้นแบ่งแถบบน (เจ้าของ 1 ต.ค. 69) — ไม่ทับปุ่ม/ช่องกรอก/ลิงก์
 *    ที่มองเห็นในหมวดที่เปิดอยู่ ทุกหมวด (+ ผนังสต็อกโหมดรับเข้า/นับ) · ที่ 1280×800 · 1440×900 · 1920×1080 ·
 *    ตำแหน่งเลื่อนตั้งต้น · ปุ่มอยู่กับที่ตอนเลื่อนและทึบอยู่บนสุด · แผงเปิดใต้ปุ่ม · หลบแผงรายละเอียดขวา
 *    + หน้าต่างวิดีโอลอยไม่ทับปุ่มและแผง (ทั้งสามขนาด)
 * 2. เมนูซ้ายแบบเลื่อนได้ (เจ้าของ "ใช้แบบเลื่อนได้ ไม่ติด"): ป้ายเมนูบรรทัดเดียวไม่ถูกตัดที่ 1280 / 1440 / 1366 ·
 *    เลื่อนเฉพาะรายการเมนู (โลโก้กับท้ายเมนูอยู่กับที่) · แถบเลื่อนบางกันช่องไว้ตลอด · ไม่ลามไปเลื่อนหน้า ·
 *    Alt+0 (หมวดท้ายสุด) แล้วหมวดที่เปิดโผล่ในเมนู
 *
 * --window-size=1440,900 ของ Chrome headless ได้พื้นที่หน้า 1424×805 — ใกล้กับหน้าต่างเบราว์เซอร์จริง
 * ที่มีแถบแท็บ/แถบที่อยู่ (เจ้าของวัดได้กล่องเมนู ~805px) จึงใช้ขนาดหน้าต่างตรง ๆ
 */

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runPage, HARNESS } from './lib/page-test.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { MOCK: MOCK3 } = await import(pathToFileURL(join(root, 'tests/desk-home3.mjs')).href);

// สินค้าเพิ่มอีกสองรุ่นให้ตะกร้ามีหลายบรรทัด (การ์ดชำระเงินยาวลงมาถึงมุมเครื่องคิดเลขจริง)
// + YouTube IFrame API ปลอม (ชุดเดียวกับ desk-batch5) ใช้เปิดหน้าต่างวิดีโอลอย
const EXTRA = `<script>
FAKE.products.push(
  { id: 'p2', sku: 'AT-DJM-S11', name: 'DJM-S11', brand: 'AlphaTheta', category: 'mixer', barcode_ean13: '4573211111111', sell_price: 69900, reorder_point: 1, is_active: true },
  { id: 'p3', sku: 'NEO-DP-RCA', name: 'NEO d+ RCA Class A 1m', brand: 'NEO by OYAIDE', category: 'cable', barcode_ean13: '4573211111112', sell_price: 1900, reorder_point: 2, is_active: true });
FAKE.product_stock_levels.push({ product_id: 'p2', current_qty: 3 }, { product_id: 'p3', current_qty: 12 });
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
`;

// ── 1. ปุ่มเครื่องคิดเลขไม่ทับของที่กดได้ ─────────────────────────────────────────
const CALC = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
const CTRL = 'button, input:not([type=hidden]), select, textarea, a[href], [role=button], summary';
function lines(el) {
  const r = document.createRange(); r.selectNodeContents(el);
  return new Set([...r.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top))).size;
}
// ของที่ "มองเห็นและกดได้" ใต้ปุ่มจริง ๆ: กรอบซ้อนกัน + จุดในส่วนที่ซ้อนชี้ไปที่ตัวมันเมื่อซ่อนปุ่มเครื่องคิดเลข
// (ตัดของที่ถูกกล่องเลื่อนบังไว้ออก — ตัวนั้นมองไม่เห็นอยู่แล้ว)
function underCalc(scope) {
  const btn = $('calcBtn'), b = btn.getBoundingClientRect(), out = [];
  btn.style.visibility = 'hidden';
  for (const el of scope.querySelectorAll(CTRL)) {
    if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    const x0 = Math.max(r.left, b.left), x1 = Math.min(r.right, b.right), y0 = Math.max(r.top, b.top), y1 = Math.min(r.bottom, b.bottom);
    if (x1 <= x0 || y1 <= y0) continue;
    let seen = false;
    for (let i = 0; i < 5 && !seen; i++) for (let j = 0; j < 5 && !seen; j++) {
      const hit = document.elementFromPoint(x0 + (x1 - x0) * (i + 0.5) / 5, y0 + (y1 - y0) * (j + 0.5) / 5);
      if (hit && (el === hit || el.contains(hit))) seen = true;
    }
    if (seen) out.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' "' + (el.textContent || el.placeholder || el.value || '').trim().slice(0, 28) + '"');
  }
  btn.style.visibility = '';
  return out;
}
// ตัวหนังสือที่มองเห็นใต้ปุ่ม (เช่น "ร้านเปิดอยู่" บนแถบดำของหน้าแรก) — ไม่ใช่ของที่กดได้ แต่ถูกบังแล้วอ่านไม่ออก
function textUnder(scope) {
  const b = $('calcBtn').getBoundingClientRect(), out = [], w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    if (!n.textContent.trim() || !n.parentElement.getClientRects().length || getComputedStyle(n.parentElement).visibility === 'hidden') continue;
    const r = document.createRange(); r.selectNodeContents(n);
    if ([...r.getClientRects()].some(q => q.left < b.right && q.right > b.left && q.top < b.bottom && q.bottom > b.top)) {
      out.push('"' + n.textContent.trim().slice(0, 24) + '"');
    }
  }
  return out;
}
async function runTests() {
  L('=== ' + innerWidth + '×' + innerHeight + ': ปุ่มเครื่องคิดเลขไม่ทับของที่กดได้ ===');
  await login('tibass');
  ok('เจ้าของร้านเห็นทุกหมวด', SECTIONS.every(s => !s.manager || isManager()));
  for (const s of SECTIONS) {
    showSection(s.id);
    if (s.id === 'pos') { addToCart('p1'); addToCart('p2'); addToCart('p3'); }
    await sleep(250);
    if (s.id === 'pos') {
      const rows = [...document.querySelectorAll('#cartList tbody tr')];
      const nm = rows[0] && rows[0].querySelector('td strong');
      ok('ตะกร้า 3 รายการ: ชื่อรุ่น "DDJ-FLX4" อยู่บรรทัดเดียว', rows.length === 3 && nm && nm.textContent === 'DDJ-FLX4' && lines(nm) === 1, nm && String(lines(nm)));
      const broken = [...document.querySelectorAll('#cartList .nw')].filter(w => lines(w) > 1).map(w => w.textContent);
      ok('ตะกร้า: ไม่มีคำไหน (ชื่อรุ่น/SKU เช่น DJM-S11 · PIO-DDJ-FLX4) ถูกตัดกลางคำ', !broken.length, broken.join(', '));
      // คอลัมน์ จำนวน/ราคา/รวม/ลบ กว้างเท่าเนื้อใน + ระยะในข้างละ 8px เท่านั้น — ที่เหลือเป็นของชื่อสินค้า
      const fat = [...rows[0].children].slice(1).filter(td => {
        const c = [...td.children].reduce((w, k) => Math.max(w, k.getBoundingClientRect().width), 0) || td.scrollWidth - 16;
        return td.getBoundingClientRect().width > c + 16 + 2;
      }).map(td => td.cellIndex);
      ok('ตะกร้า: คอลัมน์จำนวน/ราคา/รวม/ลบ กว้างเท่าที่จำเป็น (ชื่อสินค้าได้ที่ก่อน)', !fat.length, 'คอลัมน์ ' + fat.join(','));
      // ชื่อรุ่นยาวมีขีดหลายตัว ยาวกว่าช่อง — ต้องไม่แตกที่ขีด
      const keep = cart[2].name;
      cart[2].name = 'PIO-XDJ-RX3-DEMO-UNIT-CASE'; renderCart();
      const lng = document.querySelectorAll('#cartList tbody tr')[2].querySelector('td strong');
      ok('ตะกร้า: ชื่อรุ่นยาวที่มีขีด (PIO-XDJ-RX3-DEMO-UNIT-CASE) ไม่แตกบรรทัดที่ขีด', lines(lng) === 1, String(lines(lng)));
      cart[2].name = keep; renderCart();
    }
    document.querySelector('.workspace').scrollTop = 0;
    const hits = underCalc($('sec-' + s.id));
    ok(s.label + ' (#' + s.hash + '): ไม่มีปุ่ม/ช่องกรอก/ลิงก์ใต้ปุ่มเครื่องคิดเลข', !hits.length, hits.join(' | '));
    const tx = textUnder($('sec-' + s.id));
    ok(s.label + ' (#' + s.hash + '): ไม่มีตัวหนังสือถูกปุ่มบัง', !tx.length, tx.join(' | '));
  }

  // ผนังสต็อกโหมดรับเข้า: ถาดล่างเต็มความกว้าง ปุ่มยืนยันอยู่ขวา
  showSection('products');
  setWallMode('receive');
  await sleep(250);
  let hits = underCalc($('sec-products'));
  ok('ผนังสต็อก โหมดรับเข้า (ถาดล่าง): ไม่มีปุ่มใต้ปุ่มเครื่องคิดเลข', !hits.length, hits.join(' | '));
  setWallMode('count');
  await sleep(250);
  hits = underCalc($('sec-products'));
  ok('ผนังสต็อก โหมดนับ (ถาดล่าง): ไม่มีปุ่มใต้ปุ่มเครื่องคิดเลข', !hits.length, hits.join(' | '));
  setWallMode('find');

  // ตำแหน่ง (เจ้าของ 1 ต.ค. 69: "มุมขวาบนใต้เส้นแบ่ง ให้ออกจากมุมเล็กน้อย")
  const btn = $('calcBtn'), ws = document.querySelector('.workspace');
  const B = () => btn.getBoundingClientRect(), rule = () => document.querySelector('.topbar').getBoundingClientRect().bottom;
  const edge = () => document.querySelector('.ws-wrap').getBoundingClientRect().right;
  ok('ปุ่มเครื่องคิดเลข: มุมขวาบนของพื้นที่ทำงาน ใต้เส้นแบ่งแถบบน 12–16px · ห่างขอบขวา 16–20px · ไม่อยู่ในเมนูซ้าย/ไม่อยู่ในตัวที่เลื่อน',
    !btn.closest('.sidebar') && !btn.closest('.workspace') && B().top - rule() >= 12 && B().top - rule() <= 16 &&
    edge() - B().right >= 16 && edge() - B().right <= 20, JSON.stringify([B().top, rule(), B().right, edge()]));
  ok('ปุ่มไอคอนเหลี่ยม 40–44px · มีชื่อ "เครื่องคิดเลข (Alt+K)" ทั้ง title และ aria-label', B().width >= 40 && B().width <= 44 && B().width === B().height &&
    getComputedStyle(btn).borderTopLeftRadius === '0px' && btn.title === 'เครื่องคิดเลข (Alt+K)' && btn.getAttribute('aria-label') === 'เครื่องคิดเลข (Alt+K)');

  // ปุ่มอยู่กับที่ตอนเลื่อน · ของที่เลื่อนผ่านใต้ปุ่มถูกบังด้วยปุ่มทึบ (ปุ่มอยู่บนสุดเสมอ) — กลับไปบนสุดแล้วกดได้ตามเดิม
  const passed = new Set();
  let still = true, onTop = true;
  for (const id of ['pos', 'calendar', 'booking', 'home', 'customers']) {
    showSection(id);
    if (id === 'pos') { addToCart('p1'); addToCart('p2'); addToCart('p3'); }
    await sleep(150);
    const b0 = JSON.stringify(B());
    for (let y = 0; y <= ws.scrollHeight - ws.clientHeight; y += 24) {
      ws.scrollTop = y;
      if (JSON.stringify(B()) !== b0) still = false;
      const c = document.elementFromPoint(B().left + B().width / 2, B().top + B().height / 2);
      if (!c || !btn.contains(c)) onTop = false;
      underCalc($('sec-' + id)).forEach(h => passed.add(id + ': ' + h));
    }
    ws.scrollTop = 0;
  }
  ok('เลื่อนพื้นที่ทำงานแล้วปุ่มไม่ขยับ', still);
  ok('เลื่อนแล้วปุ่มยังอยู่บนสุดและพื้นทึบ (ไม่โปร่งให้ของข้างใต้ซ้อนอ่านปนกัน)', onTop && getComputedStyle(btn).backgroundColor === 'rgb(255, 255, 255)');
  L('[INFO] ของที่กดได้ซึ่งเลื่อนผ่านใต้ปุ่ม (ตอนเลื่อนเท่านั้น): ' + ([...passed].slice(0, 12).join(' | ') || 'ไม่มี'));

  // แผง: เปิดลงล่างและไปทางซ้ายจากใต้ปุ่ม อยู่ในจอทั้งแผง
  openCalc(false);
  await sleep(50);
  const pr = $('calcPanel').getBoundingClientRect();
  ok('แผงเปิดใต้ปุ่ม (ลงล่าง · ชิดขวาเท่าปุ่ม ขยายไปทางซ้าย) และอยู่ในจอทั้งแผง',
    pr.top >= B().bottom && pr.top - B().bottom <= 16 && Math.abs(pr.right - B().right) <= 1 && pr.left < B().left &&
    pr.left >= 0 && pr.bottom <= innerHeight, JSON.stringify([pr.top, pr.right, pr.bottom, B().bottom, B().right]));
  closeCalc(false);

  // แผงรายละเอียดขวาเปิดอยู่: ปุ่มย้ายมาอยู่ซ้ายของแผง ไม่ทับปุ่มปิดของแผง
  showSection('customers');
  openDetail('ทดสอบ', '<p>x</p>');
  await sleep(50);
  const dr = $('detail').getBoundingClientRect();
  ok('เปิดแผงรายละเอียดขวา: ปุ่มเครื่องคิดเลขอยู่ซ้ายของแผง ไม่ทับอะไรในแผง', B().right <= dr.left && !underCalc($('detail')).length, JSON.stringify([B().right, dr.left]));
  closeDetail();

  // หน้าต่างวิดีโอลอย: ตำแหน่งตั้งต้นไม่ทับปุ่มและแผงเครื่องคิดเลข
  showSection('bills');
  await ytPlayUrl('https://youtu.be/jNQXAC9IVRw', 'ทดสอบ');
  await sleep(150);
  const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const P = () => $('player').getBoundingClientRect();
  ok('หน้าต่างวิดีโอ (ตำแหน่งตั้งต้น) ไม่ทับปุ่มเครื่องคิดเลข', !$('player').hidden && !overlap(P(), $('calcBtn').getBoundingClientRect()), JSON.stringify(P()));
  openCalc(false);
  await sleep(50);
  ok('เปิดแผงเครื่องคิดเลข: หน้าต่างวิดีโอหลบทั้งปุ่มและแผง', !overlap(P(), $('calcBtn').getBoundingClientRect()) && !overlap(P(), $('calcPanel').getBoundingClientRect()));
  closeCalc(false);
  closePlayer();
  done();
}
</script>`;

// ── 2. เมนูซ้ายพอดีจอ ป้ายบรรทัดเดียว ────────────────────────────────────────────
const NAV = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
// จำนวนบรรทัดจริงของตัวหนังสือ (นับกล่องบรรทัดจาก Range — .lbl เป็น flex item จึงนับจากตัวมันเองไม่ได้)
function lines(el) {
  const r = document.createRange(); r.selectNodeContents(el);
  return new Set([...r.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top))).size;
}
function fitCheck(tag) {
  const items = [...document.querySelectorAll('#navList .nav-item')];
  const multi = items.filter(it => lines(it.querySelector('.lbl')) > 1).map(it => it.querySelector('.lbl').textContent);
  ok(tag + ': ป้ายเมนูทุกอันอยู่บรรทัดเดียว', !multi.length, multi.join(', '));
  const cut = items.map(it => it.querySelector('.lbl')).filter(l => l.scrollWidth > l.clientWidth + 0.5).map(l => l.textContent + ' ' + l.scrollWidth + '/' + l.clientWidth);
  ok(tag + ': ป้ายเมนูไม่ถูกตัดท้าย (…) — ไม่มีข้อยกเว้น', !cut.length, cut.join(', '));
  const short = items.concat($('calcBtn')).filter(it => it.getBoundingClientRect().height < 36).map(it => it.querySelector('.lbl').textContent);
  ok(tag + ': ทุกปุ่มเมนู (รวมเครื่องคิดเลข) สูง ≥ 36px', !short.length, short.join(', '));
  const small = [...document.querySelectorAll('.sidebar *')].filter(e => e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) &&
    parseFloat(getComputedStyle(e).fontSize) < 14).map(e => e.className);
  ok(tag + ': ตัวหนังสือในเมนูซ้าย ≥ 14px', !small.length, small.join(', '));
}
async function runTests() {
  const W = innerWidth, H = innerHeight;
  L('=== ' + W + '×' + H + ': เมนูซ้าย ===');
  await login('tibass');
  const sb = document.querySelector('.sidebar'), nl = $('navList');
  // movement (รับเข้า / ตัดออก / ปรับยอด) เก็บไว้ให้ลิงก์เก่า แต่ไม่อยู่ในเมนู (menu: false · เจ้าของสั่ง 6 ต.ค. 69) — รายละเอียดใน tests/desk-register.mjs
  const MENU = SECTIONS.filter(s => s.menu !== false);
  ok('เจ้าของร้าน: เห็นเมนูครบ ' + MENU.length + ' หมวด (ไม่รวมหมวดที่เก็บไว้ให้ลิงก์เก่า)', MENU.length === SECTIONS.length - 1 && document.querySelectorAll('#navList .nav-item').length === MENU.length);
  ok('ตัวเลขยังไม่อ่านบนเมนูโผล่จริง (กระดาน + จดหมาย) — ป้ายต้องพอดีทั้งที่มีตัวเลข',
    !$('navBadge-board').hidden && !$('navBadge-mail').hidden);
  // ป้ายย่อที่เจ้าของตั้ง ตามตัวอักษร (ประวัติสต๊อก ใช้ไม้ตรีตั้งใจ) — ที่เหลือคือชื่อหมวดเต็ม
  const SHORT = { board: 'ข้อความ', mail: 'Mailbox', moves: 'ประวัติสต๊อก' };
  ok('ป้ายในเมนู = ป้ายย่อที่เจ้าของตั้ง 3 หมวด · หมวดอื่นชื่อเต็ม', MENU.every(s => {
    const b = document.querySelector('.nav-item[data-s="' + s.id + '"]');
    return b && b.querySelector('.lbl').textContent === (SHORT[s.id] || s.label);
  }), MENU.map(s => { const b = document.querySelector('.nav-item[data-s="' + s.id + '"]'); return b && b.querySelector('.lbl').textContent; }).join(' | '));
  const fullT = { board: 'กระดานข้อความ (Alt+B)', mail: 'กล่องจดหมายร้าน (Alt+M)', moves: 'ประวัติการเคลื่อนไหว (Alt+3)' };
  ok('ป้ายย่อทุกอัน: ชื่อเต็มอยู่ใน title ของปุ่มเมนู', Object.keys(fullT).every(k => document.querySelector('.nav-item[data-s="' + k + '"]').title === fullT[k]));
  const FULL = { board: 'กระดานข้อความ', mail: 'กล่องจดหมายร้าน', movement: 'รับเข้า / ตัดออก / ปรับยอด', moves: 'ประวัติการเคลื่อนไหว' };
  const badTitle = Object.keys(FULL).filter(k => { showSection(k); return $('pageTitle').textContent !== FULL[k]; });
  ok('เปิดหมวดที่ป้ายย่อ: ชื่อหน้า (แถบบน) ยังเป็นชื่อเต็มทุกหมวด', !badTitle.length, badTitle.join(','));
  showSection('home');
  // ตัวเลขยังไม่อ่าน 2 หลัก และ 3 หลัก (999 กว้างกว่า "99+") บนกระดาน + จดหมาย — ป้ายยังพอดี ไม่มี …
  for (const [nb, nm] of [[12, 34], [999, 999]]) {
    const mw = [mailState.unseen, mailState.status], uw = window.myUnread;
    window.myUnread = () => new Array(nb).fill({});
    mailState.status = 'ok'; mailState.unseen = nm; updateNavBadges();
    const lb = ['board', 'mail'].map(k => document.querySelector('.nav-item[data-s="' + k + '"] .lbl'));
    ok('ตัวเลข ' + nb + '/' + nm + ' บนกระดาน/จดหมาย: ป้ายบรรทัดเดียว ไม่ถูกตัด', lb.every(l => lines(l) === 1 && l.scrollWidth <= l.clientWidth + 0.5) &&
      $('navBadge-board').textContent === String(nb), lb.map(l => l.textContent + ' ' + l.scrollWidth + '/' + l.clientWidth).join(' · '));
    window.myUnread = uw; [mailState.unseen, mailState.status] = mw; updateNavBadges();
  }
  ok('เมนูซ้ายกว้าง 248px', Math.round(sb.getBoundingClientRect().width) === 248);
  fitCheck(W + '×' + H);
  ok('ตัวเมนูซ้ายทั้งก้อนไม่เลื่อน — เลื่อนได้เฉพาะรายการเมนู', getComputedStyle(sb).overflowY === 'hidden' && sb.scrollHeight <= sb.clientHeight,
    getComputedStyle(sb).overflowY + ' ' + sb.scrollHeight + '/' + sb.clientHeight);
  ok('รายการเมนูเลื่อนได้ในตัว (จอนี้เมนูยาวกว่ากรอบ)', getComputedStyle(nl).overflowY === 'auto' && nl.scrollHeight > nl.clientHeight, nl.scrollHeight + '/' + nl.clientHeight);
  ok('กันช่องแถบเลื่อนไว้ตลอด (scrollbar-gutter: stable) · แถบบาง ≤ 8px', getComputedStyle(nl).scrollbarGutter.startsWith('stable') &&
    nl.offsetWidth - nl.clientWidth > 0 && nl.offsetWidth - nl.clientWidth <= 8, String(nl.offsetWidth - nl.clientWidth));
  ok('เลื่อนเมนูจนสุดแล้วไม่ลามไปเลื่อนหน้า (overscroll-behavior: contain)', getComputedStyle(nl).overscrollBehaviorY === 'contain');

  // โลโก้อยู่กับที่ระหว่างเลื่อนเมนู
  const logo0 = document.querySelector('.brand').getBoundingClientRect(), foot0 = document.querySelector('.sidebar-foot').getBoundingClientRect();
  nl.scrollTop = 160;
  await sleep(30);
  const logo1 = document.querySelector('.brand').getBoundingClientRect(), foot1 = document.querySelector('.sidebar-foot').getBoundingClientRect();
  ok('เลื่อนรายการเมนู → รายการขยับจริง แต่โลโก้กับท้ายเมนูอยู่ที่เดิม', nl.scrollTop > 0 && sb.scrollTop === 0 &&
    logo1.top === logo0.top && foot1.top === foot0.top, JSON.stringify([nl.scrollTop, logo0.top, logo1.top, foot0.top, foot1.top]));
  fitCheck(W + '×' + H + ' (เลื่อนแล้ว)');
  nl.scrollTop = 0;

  // Alt+0 = หมวดท้ายสุด → หมวดที่เปิดต้องโผล่ในรายการเมนู
  const alt0 = new KeyboardEvent('keydown', { code: 'Digit0', key: 'จ', altKey: true, bubbles: true, cancelable: true });
  document.dispatchEvent(alt0);
  await sleep(100);
  const a = document.querySelector('#navList .nav-item.active'), nb = nl.getBoundingClientRect();
  ok('Alt+0 → เปิดหมวดจัดการข้อมูล (ท้ายสุดของเมนู)', current === 'admin' && a && a.dataset.s === 'admin', current);
  ok('Alt+0 → เมนูเลื่อนให้เห็นหมวดที่เปิดทั้งปุ่ม', a && a.getBoundingClientRect().top >= nb.top - 0.5 && a.getBoundingClientRect().bottom <= nb.bottom + 0.5,
    a && JSON.stringify([a.getBoundingClientRect().top, a.getBoundingClientRect().bottom, nb.top, nb.bottom]));
  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', key: 'ห', altKey: true, bubbles: true, cancelable: true }));
  await sleep(100);
  const h = document.querySelector('#navList .nav-item.active');
  ok('Alt+H → กลับหน้าแรก (บนสุด) เมนูเลื่อนกลับขึ้นให้เห็น', current === 'home' && h.getBoundingClientRect().top >= nl.getBoundingClientRect().top - 0.5);
  ok('ชื่อหน้า (แถบบน) ยังเป็นชื่อเต็ม', $('pageTitle').textContent === 'หน้าแรก');

  // ตัวเลขยังไม่อ่านหลักหมื่น (ไม่มีเพดาน) — ป้ายอาจถูกตัดท้ายได้ แต่ห้ามตกบรรทัดเด็ดขาด
  const mailWas = mailState.unseen, statusWas = mailState.status;
  mailState.status = 'ok'; mailState.unseen = 12345; updateNavBadges();
  const ml = document.querySelector('.nav-item[data-s="mail"] .lbl');
  ok('ตัวเลขจดหมาย 12345: ป้ายยังอยู่บรรทัดเดียว (ชื่อเต็มอยู่ใน title)', lines(ml) === 1 && ml.closest('.nav-item').title.startsWith('กล่องจดหมายร้าน'), String(lines(ml)));
  mailState.unseen = mailWas; mailState.status = statusWas; updateNavBadges();
  done();
}
</script>`;

const net = '--host-resolver-rules=MAP * ~NOTFOUND';
const runs = [
  ['1280,800', CALC], ['1440,900', CALC], ['1920,1080', CALC],
  ['1440,900', NAV], ['1280,800', NAV], ['1366,768', NAV],
].map(([size, tests]) => runPage({ root, file: 'desk.html', mock: MOCK3 + EXTRA, tests, flags: [net, '--window-size=' + size] }));
process.exit(runs.every(r => r.ok) ? 0 : 1);
