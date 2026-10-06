/**
 * เทสต์ desk.html บน iPhone (เจ้าของสั่ง 2 ต.ค. 69: "บน iPhone UI เละเทะมาก ใช้งานไม่ได้" → ทำคอนโซลให้ใช้บนมือถือได้จริง)
 *   รัน: node tests/desk-iphone.mjs
 *   ถ่ายภาพหน้าจอ: PHONE_SHOTS=<โฟลเดอร์> node tests/desk-iphone.mjs
 *   รันขนาดเดียว: PHONE_ONLY=390 node tests/desk-iphone.mjs   (ตรงกับชื่อขนาดจอ)
 *
 * ใช้ตัวรัน CDP เดียวกับ desk-ipad.mjs (Chrome จริง · desk.html ตัวจริง · Supabase ปลอม · จอสัมผัส pointer: coarse + hover: none)
 * ชุดตรวจ "ทุกหมวด" ชุดเดียวกับ iPad ทุกข้อ ต่างกันแค่ขนาดจอ — iPhone ต้องผ่านเกณฑ์เดียวกับ iPad ไม่ผ่อนเกณฑ์ลง:
 *   ไม่มีเลื่อนแนวนอนระดับหน้า · ไม่มีปุ่มถูกตัดนอกกรอบ · เป้ากดทุกอัน ≥ 44×44 · ช่องกรอกทุกช่อง ≥ 16px ·
 *   ปุ่มเครื่องคิดเลขไม่ทับปุ่ม/ตัวหนังสือ · หน้าต่างซ้อนทุกบานพอดีจอ · แผงเครื่องคิดเลข/หน้าต่างวิดีโออยู่ในจอ
 */

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { HARNESS } from './lib/page-test.mjs';
import { runCdpPage } from './lib/cdp-page.mjs';
import { OPS_MOCK } from './lib/ops-mock.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { MOCK: MOCK3 } = await import(pathToFileURL(join(root, 'tests/desk-home3.mjs')).href);
const SHOTS = process.env.PHONE_SHOTS || null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const ONLY = process.env.PHONE_ONLY || '';

// สินค้าหลายแบรนด์/หมวดให้ผนังมีหลายปีก + YouTube IFrame API ปลอม (ชุดเดียวกับ desk-ipad)
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
function pageOverflow() {
  const de = document.documentElement, ws = document.querySelector('.workspace'), out = [];
  if (de.scrollWidth > innerWidth + 1) out.push('html ' + de.scrollWidth + '>' + innerWidth);
  if (document.body.scrollWidth > innerWidth + 1) out.push('body ' + document.body.scrollWidth);
  if (ws.scrollWidth > ws.clientWidth + 1) {
    const wr = ws.getBoundingClientRect(), edge = wr.left + ws.clientWidth;
    const scrolled = e => { for (let p = e.parentElement; p && p !== ws; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') return true; return false; };
    const who = [...ws.querySelectorAll('*')].filter(e => e.getClientRects().length && e.getBoundingClientRect().right > edge + 1 && !scrolled(e))
      .slice(0, 4).map(e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ')[0] + ' →' + Math.round(e.getBoundingClientRect().right - edge));
    out.push('workspace ' + ws.scrollWidth + '/' + ws.clientWidth + ' ' + who.join(' '));
  }
  return out;
}
function clippedCtrls(scope) {
  const ws = document.querySelector('.workspace');
  return controls(scope).filter(el => {
    const r = el.getBoundingClientRect();
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === 'visible') continue;
      if (/(auto|scroll)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 1 && p !== ws) return false;
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
// ตัวหนังสือเล็กกว่า 14px ที่มองเห็น (กฎเจ้าของร้าน: ห้ามเล็กกว่า 14px)
function tinyText(scope) {
  const out = new Set(), w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const p = n.parentElement;
    if (!n.textContent.trim() || !p.getClientRects().length) continue;
    const cs = getComputedStyle(p);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (parseFloat(cs.fontSize) < 13.95) out.add(p.tagName.toLowerCase() + (p.id ? '#' + p.id : '.' + String(p.className).split(' ')[0]) + ' ' + cs.fontSize + ' "' + n.textContent.trim().slice(0, 16) + '"');
  }
  return [...out];
}
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

// ── ทุกหมวด · ทุกขนาด iPhone ────────────────────────────────────────────────────
// shots: true = ถ่ายภาพทุกหมวดที่ขนาดนี้ (ชื่อไฟล์ <แท็ก>-<หมวด>.png)
const SWEEP = (tag, shots) => `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
const SHOTS = ${JSON.stringify(shots)}, TAG = ${JSON.stringify(tag.replace(/[^0-9a-zA-Zก-๙]+/g, '-'))};
async function runTests() {
  const T = '${tag} ' + innerWidth + '×' + innerHeight;
  L('=== ' + T + ' (จอสัมผัส) ===');
  await login('tibass');
  ok(T + ': จำลองจอสัมผัสได้จริง (pointer: coarse · hover: none)', matchMedia('(pointer: coarse)').matches && matchMedia('(hover: none)').matches);
  const sb = document.querySelector('.sidebar');
  ok(T + ': เมนูซ้ายหุบเป็นลิ้นชัก มีปุ่มเมนูบนแถบบน', getComputedStyle(sb).visibility === 'hidden' && vis($('navBtn')));
  const scope = () => document.querySelector('.app');
  const views = SECTIONS.map(s => ({ id: s.id, label: s.label + ' (#' + s.hash + ')' }))
    .concat([{ id: 'products', mode: 'receive', label: 'ผนังสต็อก โหมดรับเข้า' }, { id: 'products', mode: 'receive', reg: true, label: 'ผนังสต็อก โหมดรับเข้า (แผงลงทะเบียนเครื่องเปิด)' }, { id: 'products', mode: 'count', label: 'ผนังสต็อก โหมดนับ' }]);
  for (const v of views) {
    showSection(v.id);
    if (v.id === 'pos') { cart.length = 0; addToCart('p1'); addToCart('p2'); addToCart('p3'); }
    if (v.id === 'products') setWallMode(v.mode || 'find');
    if (v.mode === 'receive') { rcvRegOpen = !!v.reg; rcvRegApply(); }          // แผง "ลงทะเบียนเครื่อง" (6 ต.ค. 69) ต้องผ่านเกณฑ์มือถือชุดเดียวกัน
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
    const tt = tinyText(scope());
    ok(T + ' ' + v.label + ': ไม่มีตัวหนังสือเล็กกว่า 14px', !tt.length, tt.slice(0, 8).join(' | '));
    const u = underCalc(sec), tx = textUnder(sec);
    ok(T + ' ' + v.label + ': ปุ่มเครื่องคิดเลขไม่ทับปุ่ม/ตัวหนังสือ (ตำแหน่งเลื่อนตั้งต้น)', !u.length && !tx.length, u.concat(tx).join(' | '));
    if (v.id === 'products' && !v.mode) {
      // เกณฑ์ตัวเลขข้างบนจับไม่ได้ว่า "ผนังไม่มีที่ว่าง" — ที่ 844×390 ผนังเคยเหลือสูง 0 (ปุ่มไม่ล้นจอ จึงผ่านทุกข้อ แต่ไม่เห็นสินค้าสักรุ่น)
      const wr = $('wall').getBoundingClientRect();
      ok(T + ' ผนังสต็อก: เห็นสินค้าได้จริง (ผนังสูง ≥ 150px)', wr.height >= 150, Math.round(wr.height) + 'px');
      ok(T + ' ผนังสต็อก: ชิปกรองเลื่อนข้างได้ ไม่ถูกพับเป็น "+n หมวด"', !document.querySelector('#wallChips .fchip-more'));
    }
    if (v.reg) {
      rcvRegOpen = false; rcvRegApply(); rcvRegToggle(); await frames();          // กดเปิดจริง: ต้องเลื่อนให้เห็นแผง (จอเล็กถาดอยู่ใต้ผนัง)
      const pr = $('rcvReg').getBoundingClientRect();
      ok(T + ' ' + v.label + ': แผงอยู่ในจอทั้งแผง · ช่องรุ่น/ช่องซีเรียล/ปุ่มเพิ่มเห็นครบ · ปุ่มกล้องยังอยู่ในโหมดนี้', !$('rcvReg').hidden && inView(pr) && vis($('rcvRegModel')) && vis($('rcvRegSerial')) && vis($('rcvRegAddBtn')) && vis(document.querySelector('.scanbox .cam-btn')), JSON.stringify(pr));
    }
    if (SHOTS) await shot(TAG + '-' + (v.mode ? v.id + '-' + v.mode + (v.reg ? '-reg' : '') : v.id) + '.png');
  }
  rcvRegOpen = false;                       // ตอนนี้ถาดเป็นโหมดนับ (ไม่มีแผง) — ตั้งแค่ค่าสถานะ ไม่เรียก rcvRegApply
  setWallMode('find');
  const si = smallInputs();
  ok(T + ': ช่องกรอกทุกช่อง (รวมในหน้าต่างซ้อน) ตัวหนังสือ ≥ 16px — iOS ไม่ซูมเองตอนแตะ', !si.length, si.slice(0, 8).join(' | '));

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

  // ช่วยคิด (Ops Board): ลูปข้างบนเปิดหน้าต่างเปล่า — ตรงนี้ตรวจตอนมีคำตอบจริง (เก่า 2 + ใหม่ 1) เพราะข้อความยาวและมีปุ่มคัดลอกต่อคำตอบ
  showSection('ops'); await sleep(250); await frames();
  await openOpsAi('t1');
  await opsAiAsk('draft'); await sleep(200); await frames();
  const ad = $('opsAiDialog'), ar = ad.getBoundingClientRect();
  ok(T + ' ช่วยคิด (มีคำตอบ 3 อัน): หน้าต่างอยู่ในจอทั้งบาน · เลื่อนได้ถ้าสูงเกินจอ · ไม่ล้นข้าง',
    ad.open && document.querySelectorAll('#opsAiList .ops-ai-ans').length === 3 && inView(ar) && (ad.scrollHeight <= ad.clientHeight + 1 || /(auto|scroll)/.test(getComputedStyle(ad).overflowY)) && ad.scrollWidth <= ad.clientWidth + 1,
    JSON.stringify([ar.left, ar.top, ar.right, ar.bottom].map(Math.round)) + ' sh=' + ad.scrollHeight + '/' + ad.clientHeight + ' sw=' + ad.scrollWidth + '/' + ad.clientWidth);
  const adSmall = smallTargets(ad), adTiny = tinyText(ad);
  ok(T + ' ช่วยคิด: ปุ่มทุกอัน (ร่าง / ขั้นตอน / คัดลอก / ปิด) ≥ 44×44', !adSmall.length, adSmall.join(' | '));
  ok(T + ' ช่วยคิด: ไม่มีตัวหนังสือเล็กกว่า 14px', !adTiny.length, adTiny.join(' | '));
  ad.close(); await frames();

  // สั่ง Claude (Ops Board · 034): หน้าต่างสั่งงานที่มีตัวเลือกแนบคำตอบ + แป้นพิมพ์ — ต้องอยู่ในจอ ปุ่ม ≥ 44 ตัวหนังสือ ≥ 14 · แล้วหลังส่งเข้าคิว การ์ดมีกล่องคำสั่ง ไม่ล้นจอ
  await openOpsOrder('t1');
  $('opsOrdText').value = 'ตอบอีเมลฉบับนี้ตามร่างที่แนบ แล้วเตรียมไฟล์รายงานแอดให้ครบ ' + 'ข้อความยาวเพื่อดูการตัดบรรทัดบนจอเล็ก '.repeat(4);
  const od = $('opsOrderDialog'), orr = od.getBoundingClientRect();
  ok(T + ' สั่ง Claude: หน้าต่างอยู่ในจอทั้งบาน · เลื่อนได้ถ้าสูงเกินจอ · ไม่ล้นข้าง',
    od.open && inView(orr) && (od.scrollHeight <= od.clientHeight + 1 || /(auto|scroll)/.test(getComputedStyle(od).overflowY)) && od.scrollWidth <= od.clientWidth + 1,
    JSON.stringify([orr.left, orr.top, orr.right, orr.bottom].map(Math.round)) + ' sh=' + od.scrollHeight + '/' + od.clientHeight);
  const odSmall = smallTargets(od), odTiny = tinyText(od);
  ok(T + ' สั่ง Claude: ปุ่ม/ช่อง (ข้อความคำสั่ง · เลือกแนบ · ปิด · ส่งเข้าคิว) ≥ 44×44', !odSmall.length, odSmall.join(' | '));
  ok(T + ' สั่ง Claude: ไม่มีตัวหนังสือเล็กกว่า 14px · ช่องกรอก ≥ 16px (iOS ไม่ซูมเอง)', !odTiny.length && parseFloat(getComputedStyle($('opsOrdText')).fontSize) >= 16 && parseFloat(getComputedStyle($('opsOrdAi')).fontSize) >= 16, odTiny.join(' | '));
  $('opsOrdForm').requestSubmit(); await sleep(300); await frames();
  const oc = document.querySelector('#opsBoard .ops-task[data-id="t1"] .ops-order');
  ok(T + ' สั่ง Claude: ส่งแล้ว การ์ดมีกล่องคำสั่ง + ปุ่มยกเลิก · ไม่ล้นจอ · ปุ่มบนการ์ดทุกอัน ≥ 44',
    !od.open && !!oc && pageOverflow().length === 0 && smallTargets(document.querySelector('#opsBoard .ops-task[data-id="t1"]')).length === 0 && clippedCtrls(document.querySelector('#opsBoard .ops-task[data-id="t1"]')).length === 0,
    pageOverflow().join(' | ') + ' ' + smallTargets(document.querySelector('#opsBoard .ops-task[data-id="t1"]')).join(' | '));

  showSection('bills'); await sleep(150);
  openCalc(false); await frames();
  const cp = $('calcPanel').getBoundingClientRect();
  ok(T + ': แผงเครื่องคิดเลขอยู่ในจอทั้งแผง', inView(cp), JSON.stringify(cp));
  const sc = smallTargets($('calcPanel'));
  ok(T + ': ปุ่มในเครื่องคิดเลข ≥ 44×44', !sc.length, sc.join(' | '));
  await ytPlayUrl('https://youtu.be/jNQXAC9IVRw', 'ทดสอบ');
  showSection('bills'); openCalc(false); await sleep(150); await frames();
  const P = $('player').getBoundingClientRect();
  ok(T + ': หน้าต่างวิดีโอลอยอยู่ในจอทั้งบาน', inView(P), JSON.stringify(P));
  // จอเล็กมาก (แผงเครื่องคิดเลข + วิดีโอสูงรวมกันเกินจอ) = ไม่ทับ แต่ซ่อนภาพไว้ เสียงเล่นต่อ (iframe ยังอยู่) · ปิดแผงแล้วกลับมา
  const hid = getComputedStyle($('player')).visibility === 'hidden';
  ok(T + ': หน้าต่างวิดีโอไม่ทับปุ่มและแผงเครื่องคิดเลข (ไม่มีที่ว่างพอ = ซ่อนภาพ ไม่ใช่ทับ)', hid || (!overlap(P, $('calcBtn').getBoundingClientRect()) && !overlap(P, $('calcPanel').getBoundingClientRect())));
  ok(T + ': ถ้าซ่อนภาพ ยังไม่ถอด iframe (เสียงไม่หยุด)', !hid || !!$('playerBody').querySelector('iframe'));
  const sp = smallTargets($('player'));
  ok(T + ': ปุ่มบนแถบหน้าต่างวิดีโอ ≥ 44×44', hid || !sp.length, sp.join(' | '));
  closeCalc(false); await sleep(100); await frames();
  ok(T + ': ปิดเครื่องคิดเลขแล้ว วิดีโอลอยกลับมาเห็น', getComputedStyle($('player')).visibility === 'visible');
  closePlayer();
  done();
}
</script>`;

// ── พฤติกรรมเฉพาะ iPhone (ตั้งใจให้ตรวจสิ่งที่เกณฑ์ตัวเลขข้างบนจับไม่ได้) ─────────────────────
const BEHAVE = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== iPhone ' + innerWidth + '×' + innerHeight + ': พฤติกรรมเฉพาะมือถือ ===');
  await login('tibass');
  const bar = document.querySelector('.topbar').getBoundingClientRect();
  ok('แถบบน (เมนู · ย้อนกลับ · ชื่อหมวด · ค้นหา) สูง ≤ 125px — เคยกินจอ ~170px', bar.height <= 125, Math.round(bar.height) + 'px');
  const back = $('backBtn').getBoundingClientRect();
  ok('ปุ่มย้อนกลับเหลือลูกศรปุ่มเดียว (กว้าง 44–52px) · ยังมีป้ายอ่านออกเสียง', back.width >= 44 && back.width <= 52 && /ย้อนกลับ/.test($('backBtn').getAttribute('aria-label')), Math.round(back.width) + 'px');
  ok('ชื่อผู้ใช้ + ออกจากระบบ ไปอยู่ท้ายลิ้นชักเมนู ไม่อยู่ในแถบบน (ย้ายโหนดเดิม ไม่ทำสำเนา)',
    !!document.querySelector('.sidebar-foot .user') && !document.querySelector('.topbar .user') && document.querySelectorAll('#currentUserInfo').length === 1);
  ok('ชื่อผู้ใช้ยังบอกตำแหน่ง (เจ้าของร้าน)', $('currentUserInfo').textContent.indexOf('เจ้าของร้าน') !== -1);
  setNav(true); await sleep(350);
  const lo = document.querySelector('.sidebar-foot .user .btn');
  ok('เปิดลิ้นชัก: เห็นปุ่มออกจากระบบ ≥ 44×44 อยู่ในจอ', vis(lo) && lo.getBoundingClientRect().height >= 43.5 && inView(lo.getBoundingClientRect()), JSON.stringify(lo.getBoundingClientRect()));
  setNav(false); await sleep(350);
  ok('ช่องค้นหา: ไม่มีคำบอกคีย์ลัด (Ctrl+K) บนมือถือ', !/Ctrl/.test($('globalSearch').placeholder), $('globalSearch').placeholder);
  const cb = $('calcBtn').getBoundingClientRect();
  ok('เครื่องคิดเลขอยู่มุมขวาบนของแถวแรก (ไม่แย่งที่เนื้อหา)', cb.top <= 14 && cb.right >= innerWidth - 16 && cb.right <= innerWidth, JSON.stringify(cb));
  // ตะกร้า
  showSection('pos'); cart.length = 0; addToCart('p1'); await sleep(250); await frames();
  const tds = [...document.querySelectorAll('#cartList tbody tr:first-child td')];
  const lab = i => getComputedStyle(tds[i], '::before').content;
  ok('ตะกร้า: ช่องจำนวน/ราคา/รวม มีป้ายกำกับ (ไม่เป็นตัวเลขเปล่าๆ)', /จำนวน/.test(lab(1)) && /ราคาต่อหน่วย/.test(lab(2)) && /รวม/.test(lab(3)), [1, 2, 3].map(lab).join(' | '));
  ok('ตะกร้า: ชื่อ · ปุ่มลบ · จำนวน · ราคา · รวม อยู่ในจอครบ ไม่ล้น', tds.every(td => { const r = td.getBoundingClientRect(); return r.left >= -0.5 && r.right <= innerWidth + 0.5; }));
  ok('ตะกร้า: ไม่มีหัวตารางสี่คอลัมน์ (ใช้ป้ายในการ์ดแทน)', !vis(document.querySelector('#cartList thead')));
  // ผนัง: ปีกเต็มจอ + ปีกถัดไปโผล่แง้ม
  showSection('products'); await sleep(300); await frames();
  const wings = [...document.querySelectorAll('#wall .wing')];
  ok('ผนัง: มีหลายปีก (ข้อมูลทดสอบ)', wings.length >= 2, String(wings.length));
  const w0 = wings[0].getBoundingClientRect(), w1 = wings[1].getBoundingClientRect();
  ok('ผนัง: ปีกแรกเกือบเต็มกว้าง (≥ 300px) และปีกที่สองโผล่แง้ม 12–44px ให้รู้ว่าปัดต่อได้', w0.width >= 300 && w1.left < innerWidth - 12 && w1.left > innerWidth - 44, Math.round(w0.width) + ' / ' + Math.round(w1.left));
  ok('ปุ่มเลื่อนปีก (ลูกศรดำที่ขอบ) ซ่อนบนมือถือ — ใช้ปัด', !vis($('wallNext')) && !vis($('wallPrev')));
  // จอกว้างขึ้น = กลับไปเป็นของเดิม
  await rotate(1100, 800);
  ok('จอกว้างขึ้น (≥ 768): ชื่อผู้ใช้กลับไปแถบบน', !!document.querySelector('.topbar .user') && !document.querySelector('.sidebar-foot .user'));
  ok('จอกว้างขึ้น: คำบอกคีย์ลัดในช่องค้นหากลับมา · ปุ่มย้อนกลับมีคำ', /Ctrl/.test($('globalSearch').placeholder) && vis(document.querySelector('.lbl-back')));
  ok('จอกว้างขึ้น: ป้ายสวิตช์ "จัดตามแบรนด์" ติดกัน ไม่มีช่องว่างกลางคำ', (() => {
    const b = document.querySelector('#groupSwitch button'), s = b.querySelector('.lbl-by').getBoundingClientRect(), t = b.getBoundingClientRect();
    return b.textContent.trim() === 'จัดตามแบรนด์' && getComputedStyle(b).columnGap === '0px' && vis(b.querySelector('.lbl-by')) && s.width > 0 && t.width > 0;
  })());
  done();
}
</script>`;

const net = '--host-resolver-rules=MAP * ~NOTFOUND';
const mock = MOCK3 + OPS_MOCK + EXTRA;   // + ข้อมูล Ops Board ตัวอย่าง (เลย์เอาต์ต้องถูกตรวจกับงานจริงหลายแถว ไม่ใช่หน้าว่าง)
// PHONE_ROOT=<โฟลเดอร์ที่มี desk.html อีกฉบับ> = ทดสอบหน้าฉบับนั้นแทน (เช่น ฉบับก่อนแก้ — พิสูจน์ว่าเทสต์ตกจริงเมื่อบั๊กยังอยู่)
const pageRoot = process.env.PHONE_ROOT || root;
const run = (w, h, tests) => () => runCdpPage({ root: pageRoot, file: 'desk.html', mock, tests, width: w, height: h, coarse: true, shotDir: SHOTS, flags: [net] });
const shotAll = !!SHOTS;
const sizes = [
  ['iPhone SE แนวตั้ง', 375, 667],
  ['iPhone 14 แนวตั้ง', 390, 844],
  ['iPhone Pro Max แนวตั้ง', 430, 932],
  ['iPhone 14 แนวนอน', 844, 390],
  ['iPhone SE แนวนอน', 667, 375],
].filter(([name, w]) => !ONLY || String(w).includes(ONLY) || name.includes(ONLY));
const jobs = sizes.map(([name, w, h]) => run(w, h, SWEEP(name, shotAll)));
if (!ONLY || '390'.includes(ONLY)) jobs.push(run(390, 844, BEHAVE));

// สามตัวพร้อมกัน — เร็วขึ้นโดยไม่แย่ง CPU จนจังหวะเวลาในเทสต์เพี้ยน
const results = [];
for (let i = 0; i < jobs.length; i += 3) results.push(...await Promise.all(jobs.slice(i, i + 3).map(j => j())));
const okAll = results.every(r => r.ok);
const total = results.reduce((s, r) => { const m = r.lines.join('\n').match(/สรุป: (\d+) PASS \/ (\d+) FAIL/); return m ? [s[0] + +m[1], s[1] + +m[2]] : s; }, [0, 0]);
console.log('\n=== desk-iphone รวม: ' + total[0] + ' PASS / ' + total[1] + ' FAIL' + (okAll ? '' : ' — มีชุดที่ไม่ผ่านหรือไม่ได้รันจนจบ') + ' ===');
process.exit(okAll ? 0 : 1);
