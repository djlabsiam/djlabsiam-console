/**
 * เทสต์ "ลงทะเบียนเครื่อง" ในโหมดรับเข้าของผนังสต็อก (desk.html — 6 ต.ค. 69)
 *   รัน: node tests/desk-register.mjs      (REG_ROOT=<โฟลเดอร์ที่มี desk.html ฉบับอื่น> ใช้ทำ mutation)
 *
 * เจ้าของสั่ง: พนักงานสับสนระหว่างเมนู "สินค้า" กับ "รับเข้า / ตัดออก / ปรับยอด" → งานรับเข้าทั้งหมดจบในเมนูสินค้า
 *   1. ถาดรับเข้ามีปุ่ม "ลงทะเบียนเครื่อง" → แผง (ไม่ใช่ <dialog>) เลือกรุ่น + พิมพ์ซีเรียลทีละเครื่อง เข้ารอบเดียวกับการยิง
 *   2. ยิงรหัสที่ระบบไม่รู้จักจากหมวดไหนก็ตาม → เลือกรุ่นในหน้าต่างเดิม แล้วเข้ารอบรับเข้าของผนัง (ไม่พาไปหน้าเคลื่อนไหวอีก)
 *   3. เมนู "รับเข้า / ตัดออก / ปรับยอด" ไม่อยู่ในเมนูซ้าย แต่หน้ากับ #stock-move ยังอยู่ให้ลิงก์เก่า
 *   4. เครื่องยิงยิงได้ตลอดที่แผงเปิดอยู่ (ไม่ถูก 'blocked') · ตัวอักษรที่เครื่องยิงพิมพ์ลงช่องหมายเหตุไม่ค้างใน rcv.reason
 *   5. ช่องพิมพ์ที่ถูกตัวอักษรของเครื่องยิงลงทับแล้วถูกคืนค่า → ตัวแปร/รายการที่ผู้ฟัง input ถือไว้ต้องตรงกับค่าที่คืน (7 ต.ค. — ยอดใน QR รับเงิน · ตัวกรองรายการ)
 * ทุกหน้าแยกกัน (หน้าละ 1 งบเวลาเสมือน) · ฐานข้อมูลปลอมจดทุกการเขียนไว้ใน CALLS
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPage, HARNESS } from './lib/page-test.mjs';

const root = process.env.REG_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');

const MOCK = `<script>
const CALLS = [];
const FAKE = {
  admins: [
    { id: 'u1', full_name: 'เจ้าของร้าน', role: 'owner', is_active: true },
    { id: 'u2', full_name: 'พนักงานหน้าร้าน', role: 'staff', is_active: true },
  ],
  products: [
    { id: 'p1', sku: 'PIO-DDJ-FLX4', name: 'DDJ-FLX4', brand: 'Pioneer DJ', category: 'controller', barcode_ean13: '619659216054', sell_price: 12900, reorder_point: 1, is_active: true, image_path: null },
    { id: 'p2', sku: 'NEO-USB-B1', name: 'NEO USB Class B 1.0m', brand: 'NEO by OYAIDE', category: 'cable', barcode_ean13: '4944711000011', sell_price: 2490, reorder_point: 5, is_active: true, image_path: null },
    { id: 'p3', sku: 'PIO-PLX-1000', name: 'PLX-1000', brand: 'Pioneer DJ', category: 'Turntable', barcode_ean13: null, sell_price: 27900, reorder_point: 1, is_active: true, image_path: null },
    { id: 'p4', sku: 'APT-CDJ-3000X', name: 'CDJ-3000X', brand: 'AlphaTheta', category: 'player', barcode_ean13: null, sell_price: 109000, reorder_point: 1, is_active: true, image_path: null },
    { id: 'p5', sku: 'APT-HIDDEN', name: 'รุ่นที่ไม่สต็อก', brand: 'AlphaTheta', category: 'mixer', barcode_ean13: null, sell_price: 50000, reorder_point: 1, is_active: true, stocked: false, image_path: null },
    { id: 'p6', sku: 'APT-OMNIS-DUO', name: 'OMNIS-DUO', brand: 'AlphaTheta', category: 'controller', barcode_ean13: null, sell_price: 45900, reorder_point: 1, is_active: false, image_path: null },
  ],
  product_stock_levels: [{ product_id: 'p1', current_qty: 5 }, { product_id: 'p2', current_qty: 2 }, { product_id: 'p3', current_qty: 3 }, { product_id: 'p4', current_qty: 4 }, { product_id: 'p6', current_qty: 1 }],
  product_units: [
    { id: 'u-a', product_id: 'p1', serial_no: 'CHMP123354NN', barcode_code: 'CHMP123354NN', status: 'in_stock', received_at: '2026-09-01T10:00:00Z' },
  ],
  stock_movements: [], customers: [], sales: [], sale_items: [],
};
let FAIL_MOVE = false;                              // true = ลง stock_movements ไม่สำเร็จ (ซีเรียลลงไปแล้ว) — ไว้ตรวจข้อความแนะนำ
function builder(table) {
  const q = {
    _rows: (FAKE[table] || []).slice(), _err: null,
    select() { return q; },
    eq(col, val) { q._rows = q._rows.filter(r => r[col] === val); return q; },
    in(col, vals) { q._rows = q._rows.filter(r => vals.includes(r[col])); return q; },
    is() { return q; }, neq() { return q; }, not() { return q; }, or() { return q; }, ilike() { return q; },
    order() { return q; }, gte() { return q; }, lte() { return q; }, lt() { return q; }, gt() { return q; },
    limit() { return q; }, range() { return q; }, contains() { return q; },
    async maybeSingle() { return { data: q._rows[0] || null, error: null }; },
    async single() { return { data: q._rows[0] || null, error: null }; },
    then(res, rej) { return Promise.resolve(q._err ? { data: null, error: q._err } : { data: q._rows, error: null }).then(res, rej); },
    insert(payload) { CALLS.push({ op: 'insert', table, payload }); if (FAIL_MOVE && table === 'stock_movements') q._err = { message: 'ทดสอบ: ลงยอดไม่สำเร็จ' }; return q; },
    update(payload) { CALLS.push({ op: 'update', table, payload }); return q; },
    upsert(payload) { CALLS.push({ op: 'upsert', table, payload }); return q; },
    delete() { CALLS.push({ op: 'delete', table }); return q; },
  };
  return q;
}
let SESSION = null, authCb = null;
window.supabase = {
  createClient: () => ({
    from: builder,
    rpc: async (fn, args) => { CALLS.push({ op: 'rpc', fn, args }); return { data: null, error: null }; },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    storage: { from: bucket => ({ getPublicUrl(path) { return { data: { publicUrl: 'https://img.test/' + bucket + '/' + path } }; }, async createSignedUrl() { return { data: { signedUrl: 'data:,' }, error: null }; } }) },
    auth: {
      async getSession() { return { data: { session: SESSION } }; },
      async getUser() { return { data: { user: SESSION && SESSION.user } }; },
      onAuthStateChange(cb) { authCb = cb; },
      async signInWithPassword({ email }) { SESSION = { user: { id: email.startsWith('owner') ? 'u1' : 'u2' } }; setTimeout(() => authCb && authCb('SIGNED_IN', SESSION)); return { data: {}, error: null }; },
      async signOut() { SESSION = null; setTimeout(() => authCb && authCb('SIGNED_OUT', null)); return { error: null }; },
    },
  }),
};
</script>`;

const COMMON = `
${HARNESS}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);
const txt = id => $(id).textContent;
function key(code, k, mods, target) {
  clock += 5000;                                   // คนกดปุ่ม ไม่ใช่เครื่องยิง
  const ev = new KeyboardEvent('keydown', Object.assign({ code, key: k, bubbles: true, cancelable: true }, mods || {}));
  (target || document.activeElement || document).dispatchEvent(ev);
  return ev;
}
// ยิงแบบที่เบราว์เซอร์ทำจริง: ตัวอักษรที่ keydown ไม่ถูกกันจะหล่นลงช่องที่โฟกัส (แล้วยิง input) — wedgeRestore ต้องคืนค่าเดิมตอน Enter
function typedBurst(codes, el) {
  clock += 5000;
  codes.forEach((c, i) => {
    if (i) clock += 6;
    const ev = press(c, { target: el });
    if (!ev.defaultPrevented && el && 'value' in el) { el.value += thaiKeyFor(c); el.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  clock += 6;
  return press('Enter', { target: el, key: 'Enter' });
}
const writes = () => CALLS.filter(c => ['insert', 'update', 'delete', 'upsert'].includes(c.op));
const serialsOf = pid => { const g = rcvGroup(pid); return g ? g.serials.slice() : []; };
const fs = el => parseFloat(getComputedStyle(el).fontSize);
async function login(email) {
  $('loginEmail').value = email; $('loginPassword').value = 'x';
  await doLogin(); await sleep(400);
}
`;

// ── หน้า 1: แผง "ลงทะเบียนเครื่อง" ในถาดรับเข้า ──────────────────────────────────
const PANEL = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== แผง "ลงทะเบียนเครื่อง" ในถาดรับเข้า ===');
  try { localStorage.clear(); } catch (e) {}
  await login('owner@djlabsiam.com');
  showSection('products');
  ok('โหมดหา: ไม่มีถาด → ไม่มีปุ่มลงทะเบียน', $('tray').hidden);
  setWallMode('receive'); await sleep(100);

  // ── ปุ่ม + แผง ──
  const btn = $('rcvRegBtn'), panel = $('rcvReg');
  ok('โหมดรับเข้า: มีปุ่ม "ลงทะเบียนเครื่อง" ในถาด', !!btn && btn.textContent.trim() === 'ลงทะเบียนเครื่อง' && !btn.hidden && btn.closest('#tray') !== null);
  ok('ปุ่มเป็นปุ่มเปล่า ๆ ไม่ใช่ dialog · แผงปิดอยู่ตอนเริ่ม · aria-expanded=false', !!panel && panel.hidden && btn.getAttribute('aria-expanded') === 'false' && btn.getAttribute('aria-controls') === 'rcvReg' && btn.type === 'button');
  ok('แผงไม่ใช่ <dialog>', panel.tagName !== 'DIALOG' && !panel.closest('dialog'));
  ok('แผงที่ปิดอยู่ไม่เห็นบนจอจริง (display: none ไม่ใช่แค่ attribute)', getComputedStyle(panel).display === 'none');
  ok('ถาดว่าง: คำแนะนำเริ่มต้นบอกว่ามีปุ่ม "ลงทะเบียนเครื่อง"', /ลงทะเบียนเครื่อง/.test(txt('trayBody')), txt('trayBody'));
  const basisClosed = parseFloat(getComputedStyle($('tray')).flexBasis);
  btn.click();
  ok('กดปุ่ม → แผงเปิด · aria-expanded=true · ถาดสูงขึ้น (reg-open)', !panel.hidden && btn.getAttribute('aria-expanded') === 'true' && $('tray').classList.contains('reg-open'));
  ok('ถาดสูงขึ้นจริงตอนแผงเปิด (ให้การ์ดซีเรียลยังเห็น)', parseFloat(getComputedStyle($('tray')).flexBasis) > basisClosed, basisClosed + ' → ' + getComputedStyle($('tray')).flexBasis);
  ok('แผงที่เปิดเห็นบนจอจริง (มีขนาด ไม่ใช่ display: none)', getComputedStyle(panel).display !== 'none' && panel.getBoundingClientRect().height > 20);
  ok('เปิดแผงตอนยังไม่เลือกรุ่น → โฟกัสไปที่ช่องรุ่น', document.activeElement === $('rcvRegModel'), document.activeElement && document.activeElement.id);
  ok('เปิดแผงแล้วไม่มี dialog เปิด และเครื่องยิงยังไปทาง receive (ไม่ถูก blocked)', !document.querySelector('dialog[open]') && wedgeRoute() === 'receive', wedgeRoute());
  const opts = [...$('rcvRegModel').options].map(o => o.value);
  ok('ตัวเลือกรุ่น: รุ่นที่ใช้งานและอยู่บนชั้นเท่านั้น เรียงตามชื่อ (ไม่มีรุ่นที่ไม่สต็อก p5 · ไม่มีรุ่นปิดใช้งาน p6)', opts.join() === ',p4,p1,p2,p3', opts.join());
  ok('ตัวเลือกแรกเป็นข้อความบอกให้เลือกรุ่น (ค่าว่าง)', $('rcvRegModel').options[0].value === '' && /เลือกรุ่น/.test($('rcvRegModel').options[0].textContent));
  ok('ตัวหนังสือในแผง ≥ 14px ทุกส่วน', [...panel.querySelectorAll('label, label span, select, input, button, .hint')].every(e => fs(e) >= 14), [...panel.querySelectorAll('label, label span, select, input, button, .hint')].map(e => e.tagName + fs(e)).join(' '));
  ok('ช่องรุ่น/ช่องซีเรียลมีป้ายกำกับที่อ่านได้ และไม่ถูกเติมค่าอัตโนมัติ', [...panel.querySelectorAll('label > span')].map(s => s.textContent).join() === 'รุ่น,ซีเรียล' && $('rcvRegSerial').autocomplete === 'off' && $('rcvRegSerial').spellcheck === false && $('rcvRegSerial').maxLength === 64);

  // ── เลือกรุ่น + เพิ่มทีละเครื่อง ──
  CALLS.length = 0;
  $('rcvRegModel').value = 'p3'; $('rcvRegModel').dispatchEvent(new Event('change', { bubbles: true }));
  ok('เลือกรุ่นในช่อง = ตั้งรุ่นที่กำลังรับเข้า (เหมือนคลิกรุ่นบนผนัง)', rcv.target === 'p3' && /กำลังรับเข้ารุ่นนี้/.test(txt('trayBody')) && $('rcvRegModel').value === 'p3');
  $('rcvRegSerial').value = '  PLX0000001  ';
  $('rcvRegAddBtn').click(); await sleep(150);
  ok('กด "เพิ่มเครื่องนี้" → ซีเรียล (ตัดช่องว่างหัวท้าย) เข้ารุ่นที่เลือก เป็นการ์ดในถาด', serialsOf('p3').join() === 'PLX0000001' && [...document.querySelectorAll('#trayBody .t-card .sn-t')].some(e => e.textContent === 'PLX0000001'), serialsOf('p3').join());
  ok('เพิ่มแล้วช่องซีเรียลว่าง · ไม่มี dialog · ยังไม่มีอะไรลงฐาน', $('rcvRegSerial').value === '' && !document.querySelector('dialog[open]') && !writes().length, JSON.stringify(writes()));
  ok('เพิ่มแล้วโฟกัสกลับที่ช่องซีเรียล (พิมพ์เครื่องถัดไปได้เลย)', document.activeElement === $('rcvRegSerial'), document.activeElement && document.activeElement.id);
  ok('รุ่นที่มีซีเรียล จำนวน = จำนวนซีเรียล · ปุ่มยืนยันบอกจำนวน', rcvTotal() === 1 && txt('rcvConfirmBtn') === 'ยืนยันรับเข้าทั้งรอบ (1)', txt('rcvConfirmBtn'));
  $('rcvRegSerial').focus(); $('rcvRegSerial').value = 'PLX0000002';
  const en = key('Enter', 'Enter', {}, $('rcvRegSerial')); await sleep(150);
  ok('กด Enter ในช่องซีเรียล (คนกด) = เพิ่มเครื่อง (ไม่ใช่การยิง จึงไม่ถูกกัน)', serialsOf('p3').join() === 'PLX0000001,PLX0000002' && en.defaultPrevented, serialsOf('p3').join());
  $('rcvRegSerial').value = 'PLX0000002'; $('rcvRegAddBtn').click(); await sleep(150);
  ok('ซีเรียลซ้ำในรอบนี้ ถูกปฏิเสธพร้อมข้อความ (ตรรกะเดิมของการยิง)', rcvTotal() === 2 && /ยิงซ้ำ/.test(txt('trayNote')), txt('trayNote'));
  $('rcvRegSerial').value = 'CHMP123354NN'; $('rcvRegAddBtn').click(); await sleep(150);
  ok('ซีเรียลที่มีในระบบแล้ว ถูกปฏิเสธพร้อมบอกรุ่นและสถานะ ไม่เพิ่มซ้ำ', rcvTotal() === 2 && /มีในระบบแล้ว/.test(txt('trayNote')) && /DDJ-FLX4/.test(txt('trayNote')), txt('trayNote'));
  $('rcvRegSerial').value = ''; $('rcvRegAddBtn').click(); await sleep(60);
  ok('ไม่พิมพ์ซีเรียล → บอกให้พิมพ์ ไม่เพิ่มอะไร', rcvTotal() === 2 && /พิมพ์ซีเรียล/.test(txt('toast')), txt('toast'));
  $('rcvRegModel').value = ''; $('rcvRegModel').dispatchEvent(new Event('change', { bubbles: true }));
  ok('เลือก "— เลือกรุ่น —" กลับ = ไม่มีรุ่นเป้าหมาย', rcv.target === null);
  $('rcvRegSerial').value = 'PLX0000003'; $('rcvRegAddBtn').click(); await sleep(60);
  ok('ยังไม่เลือกรุ่น → บอกให้เลือกรุ่นก่อน ไม่เพิ่มอะไร ไม่เปิด dialog', rcvTotal() === 2 && /เลือกรุ่นก่อน/.test(txt('toast')) && !document.querySelector('dialog[open]') && $('rcvRegSerial').value === 'PLX0000003', txt('toast'));
  $('rcvRegSerial').value = '';

  // ── ช่องรุ่นตามรุ่นที่กำลังรับเข้า ──
  burst(digits('619659216054')); await sleep(120);
  ok('ยิงบาร์โค้ดรุ่น → ช่องรุ่นในแผงเปลี่ยนตามเป็นรุ่นนั้น (p1)', rcv.target === 'p1' && $('rcvRegModel').value === 'p1', $('rcvRegModel').value);
  wallClick('p4'); await sleep(60);
  ok('คลิกรุ่นบนผนัง → ช่องรุ่นตามเป็น p4', rcv.target === 'p4' && $('rcvRegModel').value === 'p4', $('rcvRegModel').value);
  wallClick('p5'); await sleep(60);
  ok('รุ่นที่ไม่อยู่ในตัวเลือก (ไม่สต็อก) → ช่องรุ่นว่าง ไม่ค้างค่าเก่า', $('rcvRegModel').value === '', $('rcvRegModel').value);

  // ── เครื่องยิงยิงได้ขณะแผงเปิด · โฟกัสอยู่ที่ช่องซีเรียล/ช่องรุ่น ──
  $('rcvRegModel').value = 'p4'; $('rcvRegModel').dispatchEvent(new Event('change', { bubbles: true }));
  $('rcvRegSerial').focus(); $('rcvRegSerial').value = 'ค้าง';
  const e1 = typedBurst(digits('700100200301'), $('rcvRegSerial')); await sleep(150);
  ok('ยิงตอนโฟกัสอยู่ที่ช่องซีเรียลของแผง → ซีเรียลเข้ารุ่นที่เลือก (p4) ไม่ถูก blocked', serialsOf('p4').join() === '700100200301' && e1.defaultPrevented && !document.querySelector('dialog[open]'), serialsOf('p4').join());
  ok('ตัวอักษรที่เครื่องยิงพิมพ์ลงช่องซีเรียลถูกคืนค่าเดิม (ที่พิมพ์ค้างไว้ไม่หาย)', $('rcvRegSerial').value === 'ค้าง', $('rcvRegSerial').value);
  $('rcvRegSerial').value = '';
  $('rcvRegModel').focus();
  burst(digits('700100200302'), { target: $('rcvRegModel') }); await sleep(150);
  ok('ยิงตอนโฟกัสอยู่ที่ช่องรุ่น (select) → เข้ารุ่นที่เลือก · ช่องรุ่นไม่ถูกตัวอักษรเลื่อนตัวเลือก', serialsOf('p4').includes('700100200302') && $('rcvRegModel').value === 'p4', serialsOf('p4').join() + ' / ' + $('rcvRegModel').value);
  ok('แผงยังเปิดอยู่หลังยิง', !panel.hidden);

  // ── ช่องหมายเหตุ: ตัวอักษรที่เครื่องยิงพิมพ์ไม่ค้างใน rcv.reason (ที่ใช้ตอนยืนยัน) ──
  const rr = $('rcvReason'); rr.focus(); rr.value = 'ล็อตจากตัวแทน'; rr.dispatchEvent(new Event('input', { bubbles: true }));
  ok('พิมพ์หมายเหตุเองยังเข้า rcv.reason ตามปกติ', rcv.reason === 'ล็อตจากตัวแทน', rcv.reason);
  typedBurst(digits('700100200303'), rr); await sleep(150);
  ok('ยิงตอนโฟกัสอยู่ที่ช่องหมายเหตุ → ช่องกลับเป็นค่าเดิม และ rcv.reason ไม่มีตัวอักษรของเครื่องยิงค้าง', rr.value === 'ล็อตจากตัวแทน' && rcv.reason === 'ล็อตจากตัวแทน', rr.value + ' | ' + rcv.reason);
  ok('ซีเรียลที่ยิงตอนโฟกัสอยู่ที่หมายเหตุ เข้ารุ่นที่เป็นเป้าหมาย (p4)', serialsOf('p4').includes('700100200303'), serialsOf('p4').join());

  // ── ยืนยันทั้งรอบ: วิธีลงฐานเดิมทุกอย่าง ──
  CALLS.length = 0;
  await rcvConfirm();
  const iu = CALLS.findIndex(c => c.op === 'insert' && c.table === 'product_units'), im = CALLS.findIndex(c => c.op === 'insert' && c.table === 'stock_movements');
  ok('ยืนยัน: ลง product_units ก่อน stock_movements (วิธีเดิม)', iu !== -1 && im !== -1 && iu < im, JSON.stringify(CALLS.map(c => c.op + ':' + c.table)));
  const units = iu !== -1 ? CALLS[iu].payload : [];
  ok('ซีเรียลที่ลงทะเบียนจากแผงลงพร้อม barcode_code = serial_no และ product_id ของรุ่นที่เลือก', units.length === 5 && units.every(u => u.barcode_code === u.serial_no) &&
    units.filter(u => u.product_id === 'p3').map(u => u.serial_no).join() === 'PLX0000001,PLX0000002' &&
    units.filter(u => u.product_id === 'p4').length === 3, JSON.stringify(units));
  const mv = im !== -1 ? CALLS[im].payload : [];
  ok('ลงยอดรายรุ่น (ซีเรียล = จำนวนเครื่อง · รุ่นที่ยิงแค่บาร์โค้ด = 1 ชิ้น) · type=in · เหตุผลจากช่องหมายเหตุ (ไม่มีขยะ) · admin_id ผู้ทำรายการ', mv.length === 3 && mv.find(x => x.product_id === 'p3').qty === 2 && mv.find(x => x.product_id === 'p4').qty === 3 && mv.find(x => x.product_id === 'p1').qty === 1 &&
    mv.every(x => x.type === 'in' && x.admin_id === 'u1' && x.reason === 'ล็อตจากตัวแทน'), JSON.stringify(mv));
  ok('ไม่มี update/delete ใด ๆ ตอนรับเข้า', !CALLS.some(c => c.op === 'update' || c.op === 'delete' || c.op === 'upsert'));
  ok('ยืนยันแล้วถาดว่าง · ช่องรุ่นในแผงว่าง · แผงยังเปิดให้รอบถัดไป', rcvTotal() === 0 && $('rcvRegModel').value === '' && !panel.hidden);

  // ── ลงยอดไม่สำเร็จหลังซีเรียลลงไปแล้ว: ข้อความแนะนำไม่ชี้ไปเมนูที่ซ่อนแล้ว ──
  $('rcvRegModel').value = 'p3'; $('rcvRegModel').dispatchEvent(new Event('change', { bubbles: true }));
  $('rcvRegSerial').value = 'FAILSER01'; $('rcvRegAddBtn').click(); await sleep(120);
  FAIL_MOVE = true; CALLS.length = 0;
  await rcvConfirm();
  FAIL_MOVE = false;
  const fe = $('fatalError') ? $('fatalError').textContent : '';
  ok('ซีเรียลลงแล้วแต่ลงยอดไม่สำเร็จ: บอกให้ลงยอดอย่างเดียวด้วยโหมดรับเข้า (ไม่ชี้ไปเมนูรับเข้า / ตัดออก / ปรับยอดที่ซ่อนแล้ว)', fe.includes('ลงยอดอย่างเดียวด้วยโหมดรับเข้า') && !fe.includes('รับเข้า / ตัดออก / ปรับยอด') && fe.includes('ซีเรียล 1 เครื่องบันทึกไปแล้ว'), fe);
  if ($('fatalError')) $('fatalError').remove();
  resetRcv(); renderTrayBody();

  // ── โหมดนับ: เครื่องยิงยิงได้ ไม่มี error (ไม่มีช่องหมายเหตุของถาดรับเข้า) ──
  setWallMode('count'); await sleep(60);
  burst(digits('619659216054')); await sleep(150);
  ok('โหมดนับ: ยิงบาร์โค้ดไม่ทำให้เกิด error (ตัวซิงก์หมายเหตุไม่พังตอนไม่มีช่องหมายเหตุ)', !$('fatalError') && wedgeRoute() === 'count', $('fatalError') && $('fatalError').textContent);
  setWallMode('receive'); await sleep(60);

  // ── สลับโหมดแล้วกลับ: ซีเรียลที่ยิงค้างอยู่ครบ · แผงกลับมาตามที่เปิดไว้ ──
  $('rcvRegModel').value = 'p2'; $('rcvRegModel').dispatchEvent(new Event('change', { bubbles: true }));
  $('rcvRegSerial').value = 'USB0000001'; $('rcvRegAddBtn').click(); await sleep(120);
  setWallMode('count'); await sleep(60);
  ok('โหมดนับ: ไม่มีปุ่ม/แผงลงทะเบียน (เป็นของโหมดรับเข้า)', !$('rcvRegBtn') && !$('rcvReg'));
  setWallMode('receive'); await sleep(60);
  ok('กลับโหมดรับเข้า: รายการที่ยิงค้างอยู่ครบ · แผงยังเปิดตามที่เปิดไว้ · ช่องรุ่นตามเป้าหมาย', serialsOf('p2').join() === 'USB0000001' && !$('rcvReg').hidden && $('rcvRegModel').value === 'p2', serialsOf('p2').join());
  $('rcvRegBtn').click();
  ok('กดปุ่มอีกครั้ง = ปิดแผง · ถาดกลับขนาดเดิม', $('rcvReg').hidden && $('rcvRegBtn').getAttribute('aria-expanded') === 'false' && !$('tray').classList.contains('reg-open'));
  $('rcvRegBtn').click();
  ok('เปิดแผงตอนเลือกรุ่นไว้แล้ว → โฟกัสไปที่ช่องซีเรียล (พิมพ์ต่อได้เลย)', !$('rcvReg').hidden && document.activeElement === $('rcvRegSerial'), document.activeElement && document.activeElement.id);
  ok('ไม่มีข้อผิดพลาดแดงบนจอ', !$('fatalError'), $('fatalError') && $('fatalError').textContent);
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

// ── หน้า 2: ยิงรหัสที่ไม่รู้จักจากหมวดอื่น → เลือกรุ่นแล้วเข้ารอบรับเข้าของผนัง ──────────────
const UNKNOWN = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== รหัสที่ไม่รู้จัก → เลือกรุ่น → เข้ารอบรับเข้าของผนัง ===');
  try { localStorage.clear(); } catch (e) {}
  await login('owner@djlabsiam.com');
  ok('ไม่มี goRegisterSerial แล้ว (ทางเดิมที่พาไปหน้าเคลื่อนไหว)', typeof goRegisterSerial === 'undefined');

  // หน้าแรก
  ok('เริ่มที่หน้าแรก · เครื่องยิงไปทาง search', current === 'home' && wedgeRoute() === 'search', current + ' ' + wedgeRoute());
  burst(digits('900100200301')); await sleep(150);
  ok('ยิงรหัสที่ไม่รู้จักจากหน้าแรก → หน้าต่างถามว่าเป็นอะไร', $('codeDialog').open && /บาร์โค้ดของรุ่นสินค้า/.test(txt('codeBody')) && /ซีเรียลของเครื่อง/.test(txt('codeBody')));
  ok('ข้อซีเรียล: เลือกรุ่นได้ในหน้าต่างนี้เลย + ปุ่ม "เพิ่มเข้ารอบรับเข้า" (ไม่มีปุ่ม "ไปหน้ารับเข้า")', !!$('serialModelSel') && /เพิ่มเข้ารอบรับเข้า/.test(txt('codeBody')) && !/ไปหน้ารับเข้า/.test(txt('codeBody')));
  ok('รายการรุ่นในหน้าต่าง = รุ่นที่ใช้งานและอยู่บนชั้น เรียงตามชื่อ (เหมือนช่องในแผง)', [...$('serialModelSel').options].map(o => o.value).join() === ',p4,p1,p2,p3', [...$('serialModelSel').options].map(o => o.value).join());
  const addBtn = () => [...document.querySelectorAll('#codeBody button')].find(b => /เพิ่มเข้ารอบรับเข้า/.test(b.textContent));
  addBtn().click();
  ok('ไม่เลือกรุ่น → บอกให้เลือก หน้าต่างยังอยู่ ไม่พาไปไหน', $('codeDialog').open && current === 'home' && /เลือกรุ่นสินค้าก่อน/.test(txt('toast')), txt('toast'));
  $('serialModelSel').value = 'p3';
  addBtn().click(); await sleep(100);
  ok('เลือกรุ่นแล้วเพิ่ม → ไปหมวดสินค้า โหมดรับเข้า (ไม่ใช่หน้าเคลื่อนไหว)', !$('codeDialog').open && current === 'products' && wall.mode === 'receive' && current !== 'movement', current + ' ' + wall.mode);
  ok('ซีเรียลอยู่ในถาดเป็นของรุ่นที่เลือก · ช่องรุ่นในแผงตามเป็น p3', serialsOf('p3').join() === '900100200301' && rcv.target === 'p3' && $('rcvRegModel').value === 'p3', serialsOf('p3').join());
  ok('ยังไม่มีอะไรลงฐาน (รอยืนยันทั้งรอบ)', !writes().length);
  ok('เครื่องยิงไปทาง receive ต่อได้ทันที ไม่ถูก blocked', wedgeRoute() === 'receive' && !document.querySelector('dialog[open]'));
  burst(digits('900100200302')); await sleep(150);
  ok('ยิงซีเรียลต่อ → เข้ารุ่นเดิม (p3) ไม่ถามซ้ำ', serialsOf('p3').join() === '900100200301,900100200302' && !$('codeDialog').open, serialsOf('p3').join());
  resetRcv(); renderTrayBody();

  // โหมดรับเข้าอยู่แล้วแต่ยังไม่มีรุ่นเป้าหมาย: ยิงซีเรียลใหม่ → หน้าต่างเลือกรุ่นในที่เดิม (ไม่พาไปหมวดไหน)
  burst(digits('900100200305')); await sleep(150);
  ok('โหมดรับเข้า ยังไม่เลือกรุ่น: ยิงซีเรียลใหม่ → หน้าต่างเลือกรุ่น ยังอยู่หมวดสินค้า ไม่พาไปหน้าเคลื่อนไหว', $('codeDialog').open && !!$('serialModelSel') && current === 'products' && wall.mode === 'receive' && rcvTotal() === 0, current + ' ' + $('codeDialog').open);
  $('serialModelSel').value = 'p1'; addBtn().click(); await sleep(100);
  ok('เลือกรุ่นแล้วเพิ่ม → ซีเรียลเข้าถาดเป็นของรุ่นนั้น · ยังอยู่โหมดรับเข้า', serialsOf('p1').join() === '900100200305' && !$('codeDialog').open && current === 'products' && wall.mode === 'receive', serialsOf('p1').join());
  resetRcv(); renderTrayBody();

  // โหมดหาของผนังสินค้า
  setWallMode('find'); await sleep(60);
  burst(digits('900100200303')); await sleep(150);
  ok('โหมดหา: ยิงรหัสที่ไม่รู้จัก → หน้าต่างเดียวกัน', $('codeDialog').open && !!$('serialModelSel'));
  $('serialModelSel').value = 'p4'; rcvSerialFor(); await sleep(100);
  ok('โหมดหา → เลือกรุ่น → สลับเป็นโหมดรับเข้าให้เอง ซีเรียลเข้าถาด', wall.mode === 'receive' && serialsOf('p4').join() === '900100200303' && !$('tray').hidden, wall.mode + ' ' + serialsOf('p4').join());
  resetRcv(); renderTrayBody();

  // หมวดอื่น (ขายหน้าร้าน ยิงไม่รู้จัก = ถามในหน้าขาย ไม่เกี่ยว) · หน้าเคลื่อนไหวเดิม (ลิงก์เก่า)
  showSection('movement');
  ok('หน้าเคลื่อนไหวเดิมยังเปิดได้ (ลิงก์เก่า) · เครื่องยิงไปทาง movement', current === 'movement' && !$('sec-movement').hidden && wedgeRoute() === 'movement', current + ' ' + wedgeRoute());
  burst(digits('900100200304')); await sleep(150);
  ok('หน้าเคลื่อนไหวเดิม: ยิงรหัสที่ไม่รู้จัก → หน้าต่างเดียวกัน (ไม่มีทางไปหน้าเคลื่อนไหวเพิ่ม)', $('codeDialog').open && !!$('serialModelSel') && !/ไปหน้ารับเข้า/.test(txt('codeBody')));
  $('serialModelSel').value = 'p2'; rcvSerialFor(); await sleep(100);
  ok('เลือกรุ่นแล้ว → ออกจากหน้าเคลื่อนไหวมาผนังสินค้าโหมดรับเข้า ซีเรียลเข้าถาด', current === 'products' && wall.mode === 'receive' && serialsOf('p2').join() === '900100200304', current + ' ' + serialsOf('p2').join());
  ok('ไม่มีอะไรถูกเขียนลงหน้าเคลื่อนไหว (รายการซีเรียลค้างว่าง)', pendingSerials.length === 0 && $('movProduct').value === '');
  resetRcv(); renderTrayBody();

  // EAN ที่ยังไม่ผูกกับรุ่น: ตัวเลือกผูกบาร์โค้ดของเจ้าของยังอยู่ (ไม่เปลี่ยน)
  setWallMode('find'); await sleep(60);
  burst(digits('4944799999993')); await sleep(150);
  ok('ตัวเลือกผูกเป็นบาร์โค้ดของรุ่น (เจ้าของ) ยังอยู่ครบ', $('codeDialog').open && !!$('linkProductSel') && /ผูกเป็นบาร์โค้ดของรุ่น/.test(txt('codeBody')));
  $('codeDialog').close();
  ok('ไม่มีข้อผิดพลาดแดงบนจอ', !$('fatalError'), $('fatalError') && $('fatalError').textContent);
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

// ── หน้า 3: เมนูซ้าย ──────────────────────────────────────────────────────────────
const MENU = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== เมนู "รับเข้า / ตัดออก / ปรับยอด" ถูกซ่อน แต่หน้ายังอยู่ ===');
  try { localStorage.clear(); } catch (e) {}
  await login('owner@djlabsiam.com');
  const mv = SECTIONS.find(s => s.id === 'movement');
  ok('หมวด movement ยังอยู่ใน SECTIONS (ลิงก์เก่า) แต่ menu = false และไม่มีคีย์ลัด', !!mv && mv.menu === false && !mv.key && mv.hash === 'stock-move', JSON.stringify(mv));
  ok('ไม่มีปุ่ม "รับเข้า / ตัดออก / ปรับยอด" ในเมนูซ้าย', !document.querySelector('#navList .nav-item[data-s="movement"]') && !txt('navList').includes('รับเข้า / ตัดออก') && !txt('navList').includes('เข้า-ออก'));
  ok('เมนูซ้ายมีครบทุกหมวดที่เหลือ (เท่ากับ SECTIONS ลบ movement)', document.querySelectorAll('#navList .nav-item').length === SECTIONS.length - 1, document.querySelectorAll('#navList .nav-item').length + ' vs ' + SECTIONS.length);
  ok('เมนูกลุ่ม "สต็อกสินค้า" เหลือ สินค้า + ประวัติสต๊อก', [...document.querySelectorAll('#navList .nav-item')].filter(b => ['products', 'moves'].includes(b.dataset.s)).length === 2 &&
    [...document.querySelectorAll('#navList .nav-group')].find(g => /สต็อกสินค้า/.test(g.textContent)).querySelectorAll('.nav-item').length === 2);
  ok('คีย์ลัดของหมวดอื่นไม่เลื่อน: Alt+1 สินค้า · Alt+3 ประวัติ · Alt+4 ขายหน้าร้าน', SECTIONS.find(s => s.key === '1').id === 'products' && SECTIONS.find(s => s.key === '3').id === 'moves' && SECTIONS.find(s => s.key === '4').id === 'pos');
  key('Digit1', '1', { altKey: true });
  ok('Alt+1 ไปหมวดสินค้า', current === 'products', current);
  key('Digit2', '2', { altKey: true });
  ok('Alt+2 ไม่พาไปหน้าเคลื่อนไหวแล้ว (ไม่มีหมวดเลข 2)', current === 'products', current);
  ok('ปุ่มเปิดโหมดรับเข้าอยู่ในผนังสินค้า (ทางเดียวของงานรับเข้า)', !!document.querySelector('.modes [data-mode="receive"]') && document.querySelector('.modes [data-mode="receive"]').textContent.includes('รับเข้า'));

  // ลิงก์เก่า
  location.hash = '#stock-move'; await sleep(150);
  ok('hash #stock-move ยังชี้ไปหมวด movement (ลิงก์เก่าเปิดได้)', sectionFromHash() === 'movement', sectionFromHash());
  showSection('movement');
  ok('ลิงก์เก่า: หน้า "รับเข้า / ตัดออก / ปรับยอด" ยังเปิดและแสดงฟอร์มครบ', current === 'movement' && !$('sec-movement').hidden && !!$('movProduct') && !!$('movType') && txt('pageTitle') === 'รับเข้า / ตัดออก / ปรับยอด', current + ' ' + txt('pageTitle'));
  ok('หน้าเก่ายังบันทึกได้เหมือนเดิม: ยิงซีเรียลหลังเลือกสินค้า (ไม่แตะวิธีเขียนฐาน)', (() => { $('movProduct').value = 'p1'; onMovProductChange(); $('movType').value = 'in'; onMovTypeChange(); return wedgeRoute() === 'serial'; })());
  burst(digits('900100200311')); await sleep(150);
  ok('หน้าเก่า: ซีเรียลเข้ารายการรอบันทึก · จำนวนล็อก', pendingSerials.join() === '900100200311' && $('movQty').value === '1' && $('movQty').readOnly, pendingSerials.join());
  CALLS.length = 0;
  await submitMovement();
  const iu = CALLS.findIndex(c => c.op === 'insert' && c.table === 'product_units'), im = CALLS.findIndex(c => c.op === 'insert' && c.table === 'stock_movements');
  ok('หน้าเก่า: ลง product_units ก่อน stock_movements เหมือนเดิม', iu !== -1 && im !== -1 && iu < im, JSON.stringify(CALLS.map(c => c.op + ':' + c.table)));
  ok('หน้าเก่ายังไม่มีแผง "ลงทะเบียนเครื่อง" ซ้อน (ของโหมดรับเข้าอย่างเดียว)', !$('rcvRegBtn') || $('tray').hidden);
  ok('ไม่มีข้อผิดพลาดแดงบนจอ', !$('fatalError'), $('fatalError') && $('fatalError').textContent);
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

// ── หน้า 4: ช่องพิมพ์ที่ถูกตัวอักษรของเครื่องยิงลงทับ → ผู้ฟัง input ต้องได้ค่าที่คืนแล้ว ──────────
// wedgeRestore คืนค่าช่องด้วย .value ตรง ๆ (ไม่มี event) — ผู้ฟังที่ก๊อปค่าลงตัวแปรหรือวาดรายการใหม่ยังถือค่าที่มีตัวอักษรยิงปนอยู่
// ต้นเหตุเดียวกับช่องหมายเหตุรับเข้า (rcvReason) · ตัวอย่างที่เงินเกี่ยว: ยอดใน QR พร้อมเพย์ (ยิงตอนหน้าต่างรับเงินเปิด)
const RESYNC = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== ช่องพิมพ์ที่ถูกเครื่องยิงลงทับ: ตัวแปร/รายการต้องตรงกับค่าที่คืนแล้ว ===');
  try { localStorage.clear(); } catch (e) {}
  await login('owner@djlabsiam.com');
  const heard = [];
  document.addEventListener('input', e => heard.push(e.target.id));       // ผู้ฟังระดับหน้า (ตรวจว่า event ลอยขึ้นถึง ไม่ใช่แค่ oninput ที่ตัวช่อง)

  // ── ยอดใน QR รับเงิน (หน้าต่างเปิด → ถูกยิงเป็น 'blocked' แต่ตัวอักษรหล่นลงช่องยอดไปแล้ว) ──
  Object.assign(payState, { loaded: true, missing: false, promptpayId: '0812345678', name: 'DJ LAB SIAM' });
  await openPayQr('promptpay', 1250);
  const amt = $('payAmt');
  ok('เปิด QR รับเงิน: ช่องยอด = 1250.00 · ตัวแปร pay.amount ตรงกัน', amt.value === '1250.00' && pay.amount === '1250.00', amt.value + ' / ' + pay.amount);
  amt.focus(); amt.value = '1250'; amt.dispatchEvent(new Event('input', { bubbles: true }));
  ok('พิมพ์ยอดเองยังเข้า pay.amount และ QR ตามปกติ', pay.amount === '1250' && /฿1,250/.test($('payStage').textContent), pay.amount + ' / ' + $('payStage').textContent);
  heard.length = 0;
  typedBurst(digits('885123456789'), amt); await sleep(150);
  ok('ยิงตอนโฟกัสอยู่ที่ช่องยอด → ช่องกลับเป็นยอดเดิม', amt.value === '1250', amt.value);
  ok('ยิงตอนโฟกัสอยู่ที่ช่องยอด → pay.amount ไม่มีตัวเลขของเครื่องยิงค้าง (ยอดที่ฝังใน QR)', pay.amount === '1250', pay.amount);
  ok('ยิงตอนโฟกัสอยู่ที่ช่องยอด → QR ยังแสดงยอดเดิม ไม่ใช่ยอดจากบาร์โค้ด', /฿1,250/.test($('payStage').textContent) && !/885/.test($('payStage').textContent), $('payStage').textContent);
  ok('คืนค่าแล้วมี input event เพิ่มอีก 1 ครั้งลอยขึ้นถึงระดับหน้า (12 ตัวอักษรที่ยิง + 1 ตอนคืนค่า — ผู้ฟังแบบ delegate ก็ได้ค่าที่คืนแล้ว)', heard.length === 13 && heard.every(x => x === 'payAmt'), heard.length + ' ' + heard.join());
  ok('ยิงตอนหน้าต่างเปิด = ยังถูกกัน (blocked) ไม่เกิดรายการขาย/เขียนฐาน', writes().length === 0, JSON.stringify(writes()));
  $('payDialog').close();

  // ── ตัวกรองรายการ (ราคา/โปรโมชัน · งานทีม): ช่องค้นหากับตัวแปรตัวกรองต้องไม่เพี้ยนจากกัน ──
  showSection('catalog'); await sleep(100);
  const cs = $('catSearch'); cs.focus(); cs.value = 'flx'; cs.dispatchEvent(new Event('input', { bubbles: true }));
  ok('พิมพ์ค้นหาเองยังเข้า cat.q ตามปกติ', cat.q === 'flx', cat.q);
  typedBurst(digits('885123456789'), cs); await sleep(150);
  ok('ยิงตอนโฟกัสอยู่ที่ช่องค้นหาราคา → ช่องกลับเป็นคำค้นเดิม · cat.q ตรงกับช่อง', cs.value === 'flx' && cat.q === 'flx', cs.value + ' / ' + cat.q);
  showSection('ops'); await sleep(100);
  const os = $('opsSearch'); os.focus(); os.value = 'ซ่อม'; os.dispatchEvent(new Event('input', { bubbles: true }));
  typedBurst(digits('885123456789'), os); await sleep(150);
  ok('ยิงตอนโฟกัสอยู่ที่ช่องค้นหางานทีม → ช่องกลับเป็นคำค้นเดิม · ops.q ตรงกับช่อง', os.value === 'ซ่อม' && ops.q === 'ซ่อม', os.value + ' / ' + ops.q);

  // ── ทุกชนิดช่องพิมพ์: ตัวก๊อปค่า (oninput) ต้องกลับเป็นค่าเดิม · ชนิดที่ไม่ใช่ช่องพิมพ์ต้องไม่ถูกยิง input ซ้ำ ──
  const holder = document.createElement('div'); document.body.appendChild(holder);
  const mirror = {};
  const mk = (id, make, start) => { const el = make(); el.id = id; el.value = start; el.oninput = () => { mirror[id] = el.value; }; holder.appendChild(el); mirror[id] = el.value; return el; };
  const inputOf = type => () => { const e = document.createElement('input'); e.type = type; return e; };
  const TEXTY = [['pt-text', inputOf('text'), 'abc'], ['pt-search', inputOf('search'), 'abc'], ['pt-tel', inputOf('tel'), '0812345678'], ['pt-url', inputOf('url'), 'https://x.co'],
    ['pt-email', inputOf('email'), 'a@b.co'], ['pt-number', inputOf('number'), '12'], ['pt-password', inputOf('password'), 'abc'], ['pt-textarea', () => document.createElement('textarea'), 'abc']];
  for (const [id, make, start] of TEXTY) {
    const el = mk(id, make, start); el.focus();
    typedBurst(digits('885123456789'), el); await sleep(60);
    ok('ช่องชนิด ' + id.slice(3) + ': ยิงทับแล้วค่ากลับเป็นเดิม · ตัวก๊อปค่า (oninput) ตรงกับช่อง', el.value === start && mirror[id] === start, el.value + ' / ' + mirror[id]);
  }
  const idle = [['pt-checkbox', inputOf('checkbox')], ['pt-radio', inputOf('radio')], ['pt-range', inputOf('range')], ['pt-color', inputOf('color')], ['pt-button', inputOf('button')], ['pt-select', () => document.createElement('select')]];
  let spurious = [];
  for (const [id, make] of idle) {
    const el = make(); el.id = id; el.oninput = () => spurious.push(id); holder.appendChild(el); el.focus();
    burst(digits('885123456789')); await sleep(60);
  }
  ok('ช่องที่ไม่ใช่ช่องพิมพ์ (checkbox · radio · range · color · button · select) ไม่ถูกยิง input ซ้ำหลังเครื่องยิงทำงาน', spurious.length === 0, spurious.join());
  holder.remove();

  // ── ไม่เสี่ยงข้างเคียง: การยิงที่ไม่ได้อยู่ในช่องพิมพ์ทำงานเหมือนเดิม ──
  showSection('products'); setWallMode('find'); await sleep(60);
  (document.activeElement || document.body).blur();
  heard.length = 0;
  burst(digits('619659216054')); await sleep(150);
  ok('ยิงตอนไม่ได้โฟกัสช่องพิมพ์ → ไม่มี input event เพิ่มจากการคืนค่า', heard.length === 0, heard.join());
  ok('ไม่มีข้อผิดพลาดแดงบนจอ', !$('fatalError'), $('fatalError') && $('fatalError').textContent);
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

let bad = 0;
// หน้าแรกกว้างแบบคอม (1366×768) — เทสต์วัดความสูงถาดที่ผูกกับ vh ต้องใช้หน้าต่างกว้างกว่าเกณฑ์มือถือ (767px)
for (const [name, tests, flags] of [['แผงลงทะเบียนเครื่อง', PANEL, ['--window-size=1366,768']], ['รหัสที่ไม่รู้จัก', UNKNOWN, []], ['เมนู', MENU, []], ['ช่องพิมพ์ที่ถูกยิงทับ', RESYNC, []]]){
  if (process.env.REG_ONLY && !new RegExp(process.env.REG_ONLY).test(name)) continue;       // REG_ONLY=<regex ชื่อหน้า> รันทีละหน้า (เครื่องหนัก/ทำ mutation เฉพาะจุด)
  console.log('\n--- ' + name + ' ---');
  const r = runPage({ root, file: 'desk.html', mock: MOCK, tests, flags });
  if (!r.ok) bad++;
}
process.exit(bad ? 1 : 0);
