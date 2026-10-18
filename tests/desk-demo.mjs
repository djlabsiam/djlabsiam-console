/**
 * เทสต์ "ย้ายเข้า DEMO" ใน desk.html (ลิ้นชักสินค้า + ปุ่ม DEMO บนผนัง + หน้าขาย/นับ) — migration 067
 *   รัน: node tests/desk-demo.mjs
 *
 * วิธีเดียวกับชุดอื่น: ไฟล์จริงทุกบรรทัด สลับเฉพาะแท็ก Supabase เป็นตัวปลอม — ตัวปลอมจำลอง unit_set_demo
 * (สถานะเครื่อง + ยอด + แถว movement) และจดทุกคำสั่งเขียนไว้ใน CALLS
 *
 * สิ่งที่ห้ามพลาดและชุดนี้พิสูจน์:
 *   - ย้ายเข้า/คืน = เรียก rpc unit_set_demo ครั้งเดียว · หน้านี้ไม่ insert/update/delete อะไรเอง (stock_movements เพิ่มอย่างเดียว กฎข้อ 5)
 *   - ปุ่มโผล่เฉพาะเครื่องที่อยู่ในสต็อก (→ DEMO) และเครื่อง DEMO (→ คืน) · เครื่องที่ขายแล้ว/จอง/ตำหนิไม่มีปุ่ม
 *   - ถามยืนยัน + โน้ตไม่บังคับ · ยกเลิกแล้วไม่ยิงอะไร
 *   - ล้มเหลวทุกแบบแจ้งตามจริง (ฐานปฏิเสธ · ยังไม่รัน 067 · เน็ตล่ม) ไม่ขึ้น "สำเร็จ" หลอก
 *   - หน้าขาย: เครื่อง DEMO ใส่ตะกร้าไม่ได้ + บอกให้คืนเข้าสต็อกก่อน · นับสต็อก: เครื่อง DEMO ไม่ถูกนับ
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPage, HARNESS } from './lib/page-test.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const MOCK = `<script>
const CALLS = [];
const FAKE = {
  admins: [
    { id: 'u1', full_name: 'เจ้าของร้าน', role: 'owner', is_active: true },
    { id: 'u2', full_name: 'พนักงานหน้าร้าน', role: 'staff', is_active: true },
  ],
  products: [
    { id: 'p1', sku: 'PIO-DDJ-FLX4', name: 'DDJ-FLX4', brand: 'Pioneer DJ', category: 'controller',
      barcode_ean13: '619659216054', sell_price: 12900, reorder_point: 1, is_active: true, image_path: null },
    { id: 'p2', sku: 'NEO-USB-B1', name: 'NEO USB Class B 1.0m', brand: 'NEO by OYAIDE', category: 'cable',
      barcode_ean13: '4944711000011', sell_price: 2490, reorder_point: 5, is_active: true, image_path: null },
    { id: 'p9', sku: 'PIO-DJM-S11', name: 'DJM-S11', brand: 'Pioneer DJ', category: 'mixer',
      barcode_ean13: null, sell_price: 85900, reorder_point: 1, is_active: true, image_path: null },
  ],
  product_stock_levels: [
    { product_id: 'p1', current_qty: 5 }, { product_id: 'p2', current_qty: 2 }, { product_id: 'p9', current_qty: 1 },
  ],
  product_units: [
    { id: 'u-a', product_id: 'p1', serial_no: 'CHMP123354NN', barcode_code: 'CHMP123354NN', status: 'in_stock', received_at: '2026-09-01T10:00:00Z' },
    { id: 'u-b', product_id: 'p1', serial_no: 'CHMP555555NN', barcode_code: 'CHMP555555NN', status: 'in_stock', received_at: '2026-09-02T10:00:00Z' },
    { id: 'u-c', product_id: 'p1', serial_no: 'CHMP999999NN', barcode_code: 'CHMP999999NN', status: 'sold', received_at: '2026-08-01T10:00:00Z' },
    { id: 'u-r', product_id: 'p1', serial_no: 'CHMPRESV01NN', barcode_code: 'CHMPRESV01NN', status: 'reserved', received_at: '2026-08-02T10:00:00Z' },
    { id: 'u-x', product_id: 'p1', serial_no: 'CHMPDEFECT1NN', barcode_code: 'CHMPDEFECT1NN', status: 'defective', received_at: '2026-08-03T10:00:00Z' },
    { id: 'u-e', product_id: 'p1', serial_no: 'CHMPDEMO001NN', barcode_code: 'CHMPDEMO001NN', status: 'demo', received_at: '2026-08-04T10:00:00Z' },
    { id: 'u-f', product_id: 'p9', serial_no: 'S11DEMO001', barcode_code: 'S11DEMO001', status: 'demo', received_at: '2026-09-03T10:00:00Z' },
  ],
  stock_movements: [
    { id: 'm1', product_id: 'p1', type: 'in', qty: 5, reason: 'รับของ', created_at: '2026-09-01T10:00:00Z',
      admin_id: 'u1', ref_sale_id: null, products: { name: 'DDJ-FLX4', sku: 'PIO-DDJ-FLX4' }, admins: { full_name: 'เจ้าของร้าน' } },
  ],
  customers: [], sales: [], sale_items: [],
};
// จำลอง unit_set_demo ฝั่งฐาน: เปลี่ยนสถานะ + ยอด + แถว movement (สัญญาเดียวกับ 067) — ล้มเหลวทุกแบบตั้งได้ผ่าน RPC_FAIL
let RPC_FAIL = null;
function fakeUnitSetDemo(a) {
  const u = FAKE.product_units.find(x => x.id === a.p_unit);
  if (!u) return { message: 'ไม่พบเครื่องนี้ในระบบแล้ว' };
  if (a.p_demo && u.status !== 'in_stock') return { message: 'ย้ายเข้า DEMO ได้เฉพาะเครื่องที่อยู่ในสต็อก — ซีเรียล ' + u.serial_no + ' สถานะ ' + u.status };
  if (!a.p_demo && u.status !== 'demo') return { message: 'ซีเรียล ' + u.serial_no + ' ไม่ได้เป็นเครื่อง DEMO (สถานะ ' + u.status + ')' };
  u.status = a.p_demo ? 'demo' : 'in_stock';
  const lv = FAKE.product_stock_levels.find(x => x.product_id === u.product_id);
  if (lv) lv.current_qty += a.p_demo ? -1 : 1;
  FAKE.stock_movements.unshift({ id: 'm' + (FAKE.stock_movements.length + 1), product_id: u.product_id, type: a.p_demo ? 'out' : 'in', qty: 1,
    reason: (a.p_demo ? 'ย้ายเข้า DEMO: ' : 'คืนจาก DEMO: ') + u.serial_no + (a.p_note ? ' — ' + a.p_note : ''), created_at: '2026-10-18T10:00:00Z',
    admin_id: 'u1', ref_sale_id: null, products: { name: 'DDJ-FLX4', sku: 'PIO-DDJ-FLX4' }, admins: { full_name: 'เจ้าของร้าน' } });
  return null;
}
function builder(table) {
  const q = {
    _rows: (FAKE[table] || []).slice(), _err: null,
    // product_units: ส่งกลับเฉพาะคอลัมน์ที่ขอ เหมือน PostgREST จริง (ไม่งั้นลืมขอ id แล้วเทสต์ไม่รู้)
    select(cols) { if (table === 'product_units' && typeof cols === 'string') q._cols = cols.split(',').map(s => s.trim()); return q; },
    eq(col, val) { q._rows = q._rows.filter(r => r[col] === val); return q; },
    in(col, vals) { q._rows = q._rows.filter(r => vals.includes(r[col])); CALLS.push({ op: 'in', table, col, vals }); return q; },
    is() { return q; }, neq() { return q; }, not() { return q; }, or() { return q; }, ilike() { return q; },
    order() { return q; }, gte() { return q; }, lte() { return q; }, lt() { return q; }, gt() { return q; },
    limit() { return q; }, range() { return q; }, contains() { return q; },
    async maybeSingle() { return { data: q._rows[0] || null, error: null }; },
    async single() { return { data: q._rows[0] || null, error: null }; },
    then(res, rej) {
      const rows = q._cols ? q._rows.map(r => Object.fromEntries(q._cols.map(c => [c, r[c]]))) : q._rows;
      return Promise.resolve(q._err ? { data: null, error: q._err } : { data: rows, error: null }).then(res, rej);
    },
    insert(payload) { CALLS.push({ op: 'insert', table, payload }); return q; },
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
    rpc: async (fn, args) => {
      CALLS.push({ op: 'rpc', fn, args });
      if (fn !== 'unit_set_demo') return { data: null, error: null };
      if (RPC_FAIL === 'throw') throw new Error('Failed to fetch');
      if (RPC_FAIL) return { data: null, error: RPC_FAIL };
      const e = fakeUnitSetDemo(args);
      return { data: null, error: e };
    },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    storage: { from: () => ({
      async upload() { return { data: {}, error: null }; }, async remove() { return { data: [], error: null }; },
      getPublicUrl(path) { return { data: { publicUrl: 'https://img.test/' + path } }; },
      async createSignedUrl() { return { data: { signedUrl: 'data:,' }, error: null }; },
    }) },
    auth: {
      async getSession() { return { data: { session: SESSION } }; },
      async getUser() { return { data: { user: SESSION && SESSION.user } }; },
      onAuthStateChange(cb) { authCb = cb; },
      async signInWithPassword({ email }) {
        SESSION = { user: { id: email.startsWith('owner') ? 'u1' : 'u2' } };
        setTimeout(() => authCb && authCb('SIGNED_IN', SESSION));
        return { data: {}, error: null };
      },
      async signOut() { SESSION = null; setTimeout(() => authCb && authCb('SIGNED_OUT', null)); return { error: null }; },
    },
  }),
};
</script>`;

const TESTS = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${HARNESS}
const sleep = ms => new Promise(r => setTimeout(r, ms));
function key(code, k, mods) {
  clock += 5000;
  const ev = new KeyboardEvent('keydown', Object.assign({ code, key: k, bubbles: true, cancelable: true }, mods || {}));
  (document.activeElement || document).dispatchEvent(ev);
  return ev;
}
const $ = id => document.getElementById(id);
const txt = id => $(id).textContent;
const writes = () => CALLS.filter(c => ['insert', 'update', 'delete', 'upsert'].includes(c.op));
const rpcs = () => CALLS.filter(c => c.op === 'rpc');
const fatal = () => ($('fatalError') ? $('fatalError').textContent : '');
function clearFatal() { const f = $('fatalError'); if (f) f.remove(); }
const groups = () => [...document.querySelectorAll('#dUnits .sn-group h4')].map(h => h.textContent).join('|');
const rowBtns = () => [...document.querySelectorAll('#dUnits .sn-row')].map(r => r.querySelector('.sn').textContent + ':' + r.querySelector('button').textContent);
const stat = id => FAKE.product_units.find(u => u.id === id).status;
async function login(email) {
  $('loginEmail').value = email;
  $('loginPassword').value = 'x';
  await doLogin();
  await sleep(400);
}
const fs = el => parseFloat(getComputedStyle(el).fontSize);

async function runTests() {
  L('=== ย้ายเข้า DEMO — desk.html ===');
  try { localStorage.clear(); } catch (e) {}
  await login('owner@djlabsiam.com');
  key('Digit1', '1', { altKey: true });
  await sleep(50);
  ok('Alt+1 เปิดผนังสต็อก', current === 'products' && !$('sec-products').hidden, current);

  // ── 1. ปุ่ม DEMO บนผนัง ───────────────────────────────────────────────
  ok('ปุ่ม DEMO บนผนังบอกจำนวนเครื่อง DEMO ทั้งร้าน (2)', txt('nDemo') === '2' && /^DEMO/.test($('flagDemo').textContent.trim()), $('flagDemo').textContent);
  ok('ปุ่ม DEMO ไม่ใช่ตัวกรอง (ไม่มี aria-pressed) · ตัวอักษร ≥ 14px', !$('flagDemo').hasAttribute('aria-pressed') && fs($('flagDemo')) >= 14, fs($('flagDemo')));
  ok('ตัวเลขใกล้หมด/หมดไม่ถูกแตะ (p2 ยอด 2/จุดสั่ง 5 · p9 ยอด 1/จุดสั่ง 1 = ใกล้หมด 2)', txt('nLow') === '2' && txt('nOut') === '0', txt('nLow') + '/' + txt('nOut'));

  // ── 2. ลิ้นชักสินค้า: กลุ่มสถานะ + ปุ่มต่อเครื่อง ─────────────────────
  await openProduct('p1');
  ok('ซีเรียลแยกกลุ่ม: อยู่ในสต็อก 2 · DEMO 1 · จองไว้ 1 · มีตำหนิ 1 · ขายแล้ว 1 (DEMO ต่อจากอยู่ในสต็อก)',
    groups() === '2อยู่ในสต็อก|1DEMO|1จองไว้|1มีตำหนิ|1ขายแล้ว', groups());
  ok('ปุ่มต่อเครื่อง: อยู่ในสต็อก → ย้ายเข้า DEMO · DEMO → คืนเข้าสต็อก',
    rowBtns().join(' ') === 'CHMP123354NN:ย้ายเข้า DEMO CHMP555555NN:ย้ายเข้า DEMO CHMPDEMO001NN:คืนเข้าสต็อก', rowBtns().join(' '));
  ok('เครื่องที่ขายแล้ว/จองไว้/มีตำหนิ ไม่มีปุ่ม (ชิปเฉย ๆ)',
    [...document.querySelectorAll('#dUnits .sn')].filter(s => /sold|reserved|defective/.test(s.className)).every(s => !s.closest('.sn-row') && !s.parentElement.querySelector('button')));
  ok('ปุ่มต่อเครื่องตัวอักษร ≥ 14px', [...document.querySelectorAll('#dUnits .sn-row button')].every(b => fs(b) >= 14));
  ok('ชิป DEMO มีคลาส demo (ขอบประ) และข้อความเป็นซีเรียลล้วน', document.querySelector('#dUnits .sn.demo').textContent === 'CHMPDEMO001NN');

  // ── 3. ย้ายเข้า DEMO: ถามยืนยัน ยกเลิกได้ ไม่ยิงอะไรจนกว่าจะยืนยัน ───────
  CALLS.length = 0;
  document.querySelector('#dUnits .sn-row button').click();
  ok('กดปุ่ม: ฟอร์มยืนยันโผล่ บอกซีเรียล + ผลที่จะเกิด + ช่องโน้ต (ไม่บังคับ)',
    /ย้ายเข้า DEMO · CHMP123354NN/.test(txt('drDemo')) && /หักออกจากยอดสต็อกขาย/.test(txt('drDemo')) && !!$('drDemoNote') && !$('drDemoNote').required && $('drDemoNote').maxLength === 200, txt('drDemo'));
  ok('ยังไม่ยิงอะไรจนกว่าจะยืนยัน', CALLS.filter(c => c.op !== 'in').length === 0, JSON.stringify(CALLS));
  ok('ตัวอักษรในฟอร์มยืนยัน ≥ 14px', [...$('drDemo').querySelectorAll('h3, p, label, input, button')].every(e => fs(e) >= 14), [...$('drDemo').querySelectorAll('h3, p, label, input, button')].map(fs).join());
  [...$('drDemo').querySelectorAll('button')].find(b => b.textContent === 'ยกเลิก').click();
  ok('ยกเลิก: ฟอร์มหาย ไม่ยิงอะไร สถานะเครื่องเดิม', txt('drDemo') === '' && !rpcs().length && stat('u-a') === 'in_stock');

  document.querySelector('#dUnits .sn-row button').click();
  $('drDemoNote').value = '  ตั้งโชว์หน้าร้าน  ';
  CALLS.length = 0;
  $('drDemo').querySelector('form').requestSubmit();
  await sleep(300);
  ok('ยืนยัน: เรียก unit_set_demo ครั้งเดียว ถูกเครื่อง/ทิศทาง/โน้ต (ตัดช่องว่างหัวท้าย)',
    rpcs().length === 1 && rpcs()[0].fn === 'unit_set_demo' && rpcs()[0].args.p_unit === 'u-a' && rpcs()[0].args.p_demo === true && rpcs()[0].args.p_note === 'ตั้งโชว์หน้าร้าน', JSON.stringify(rpcs()));
  ok('หน้านี้ไม่เขียนตารางเองเลย (ไม่มี insert/update/delete/upsert — ledger เพิ่มอย่างเดียวผ่านฟังก์ชันฐาน)', writes().length === 0, JSON.stringify(writes()));
  ok('ผลบนจอ: ลิ้นชักโหลดใหม่ เครื่อง u-a ไปอยู่กลุ่ม DEMO · อยู่ในสต็อกเหลือ 1',
    groups() === '1อยู่ในสต็อก|2DEMO|1จองไว้|1มีตำหนิ|1ขายแล้ว' && /CHMP123354NN:คืนเข้าสต็อก/.test(rowBtns().join(' ')), groups());
  ok('ยอดคงเหลือในลิ้นชักลด 5 → 4 และปุ่ม DEMO บนผนังเป็น 3', document.querySelector('#detailBody .dr-num').textContent === '4' && txt('nDemo') === '3', document.querySelector('#detailBody .dr-num').textContent + ' / ' + txt('nDemo'));
  ok('ประวัติล่าสุดในลิ้นชักมี "ย้ายเข้า DEMO: CHMP123354NN — ตั้งโชว์หน้าร้าน"', /ย้ายเข้า DEMO: CHMP123354NN — ตั้งโชว์หน้าร้าน/.test(txt('dMoves')), txt('dMoves'));
  ok('ไม่มีแถบ error', !fatal(), fatal());

  // ── 4. คืนเข้าสต็อกจากลิ้นชัก (ไม่ใส่โน้ต) ────────────────────────────
  [...document.querySelectorAll('#dUnits .sn-row')].find(r => r.querySelector('.sn').textContent === 'CHMP123354NN').querySelector('button').click();
  ok('ฟอร์มคืน: บอกว่ากลับเข้ายอดสต็อกและขายได้', /คืนเข้าสต็อก · CHMP123354NN/.test(txt('drDemo')) && /กลับเข้ายอดสต็อก/.test(txt('drDemo')), txt('drDemo'));
  CALLS.length = 0;
  $('drDemo').querySelector('form').requestSubmit();
  await sleep(300);
  ok('คืน: unit_set_demo p_demo=false p_note=null (ไม่ใส่โน้ต = ส่ง null ไม่ใช่สตริงว่าง)',
    rpcs().length === 1 && rpcs()[0].args.p_demo === false && rpcs()[0].args.p_note === null && rpcs()[0].args.p_unit === 'u-a', JSON.stringify(rpcs()));
  ok('คืนแล้ว: กลับไปกลุ่มอยู่ในสต็อก · ยอด 5 · ปุ่ม DEMO กลับเป็น 2', groups() === '2อยู่ในสต็อก|1DEMO|1จองไว้|1มีตำหนิ|1ขายแล้ว' && document.querySelector('#detailBody .dr-num').textContent === '5' && txt('nDemo') === '2', groups());
  closeDetail();

  // ── 5. รายการเครื่อง DEMO ทั้งร้าน ───────────────────────────────────
  $('flagDemo').click();
  ok('ปุ่ม DEMO เปิดรายการ: หัวบอกจำนวน · จัดตามรุ่น (DDJ-FLX4 1 · DJM-S11 1)',
    txt('detailTitle') === 'เครื่อง DEMO (2)' && [...document.querySelectorAll('#detailBody .sn-group h4')].map(h => h.textContent).join('|') === '1DDJ-FLX4|1DJM-S11',
    txt('detailTitle') + ' ' + [...document.querySelectorAll('#detailBody .sn-group h4')].map(h => h.textContent).join('|'));
  ok('ทุกแถวมีปุ่ม "คืนเข้าสต็อก" ซีเรียลตรง', [...document.querySelectorAll('#detailBody .sn-row')].map(r => r.querySelector('.sn').textContent + ':' + r.querySelector('button').textContent).join(' ') === 'CHMPDEMO001NN:คืนเข้าสต็อก S11DEMO001:คืนเข้าสต็อก');
  [...document.querySelectorAll('#detailBody .sn-row')].find(r => r.querySelector('.sn').textContent === 'S11DEMO001').querySelector('button').click();
  $('drDemoNote').value = 'ลูกค้าขอซื้อ';
  CALLS.length = 0;
  $('drDemo').querySelector('form').requestSubmit();
  await sleep(300);
  ok('คืนจากรายการ: rpc ถูกเครื่อง/โน้ต · รายการโหลดใหม่เหลือ 1 เครื่อง (ไม่ปิดแผง)',
    rpcs().length === 1 && rpcs()[0].args.p_unit === 'u-f' && rpcs()[0].args.p_demo === false && rpcs()[0].args.p_note === 'ลูกค้าขอซื้อ' && writes().length === 0 &&
    txt('detailTitle') === 'เครื่อง DEMO (1)' && txt('nDemo') === '1' && stat('u-f') === 'in_stock', txt('detailTitle') + ' ' + txt('nDemo'));
  [...document.querySelectorAll('#detailBody .sn-row')][0].querySelector('button').click();
  $('drDemo').querySelector('form').requestSubmit();
  await sleep(300);
  ok('คืนเครื่องสุดท้าย: รายการบอกว่าไม่มีเครื่อง DEMO · ปุ่มบนผนังเป็น 0', /ตอนนี้ไม่มีเครื่อง DEMO/.test(txt('detailBody')) && txt('nDemo') === '0');
  closeDetail();

  // ── 6. ล้มเหลวแจ้งตามจริง ────────────────────────────────────────────
  await openProduct('p1');
  document.querySelector('#dUnits .sn-row button').click();
  RPC_FAIL = { message: 'ย้ายเข้า DEMO ได้เฉพาะเครื่องที่อยู่ในสต็อก — ซีเรียล CHMP123354NN สถานะ sold' };
  CALLS.length = 0;
  $('drDemo').querySelector('form').requestSubmit();
  await sleep(300);
  ok('ฐานปฏิเสธ: ขึ้นแถบแดงพร้อมข้อความจากฐาน ไม่ขึ้น "สำเร็จ"', /ย้ายเข้า DEMO ไม่สำเร็จ: ย้ายเข้า DEMO ได้เฉพาะเครื่องที่อยู่ในสต็อก/.test(fatal()) && !/ย้ายเข้า DEMO แล้ว/.test(document.body.innerText), fatal());
  ok('ฐานปฏิเสธ: ไม่โหลดซ้ำ/ไม่เปลี่ยนจอ (ฟอร์มยังอยู่ ปุ่มกดได้อีก)', !!$('drDemoNote') && !$('drDemoBtn').disabled && stat('u-a') === 'in_stock');
  clearFatal();
  RPC_FAIL = { code: 'PGRST202', message: 'Could not find the function public.unit_set_demo(p_demo, p_note, p_unit) in the schema cache' };
  $('drDemo').querySelector('form').requestSubmit();
  await sleep(300);
  ok('ยังไม่รัน 067 (ไม่มีฟังก์ชัน): บอกตรง ๆ ว่าต้องรัน migration 067 ไม่โชว์ข้อความดิบ', /ฐานข้อมูลยังไม่มีคำสั่งนี้.*migration 067/.test(fatal()) && !/schema cache/.test(fatal()), fatal());
  clearFatal();
  RPC_FAIL = 'throw';
  $('drDemo').querySelector('form').requestSubmit();
  await sleep(300);
  ok('เน็ตล่ม: ขึ้นแถบแดง "ติดต่อเซิร์ฟเวอร์ไม่สำเร็จ" ปุ่มกดได้อีก', /ติดต่อเซิร์ฟเวอร์ไม่สำเร็จ: Failed to fetch/.test(fatal()) && !$('drDemoBtn').disabled, fatal());
  clearFatal();
  RPC_FAIL = null;
  closeDetail();

  // ── 7. หน้าขาย: เครื่อง DEMO ใส่ตะกร้าไม่ได้ ────────────────────────
  const prod = products.find(p => p.id === 'p1');
  const m1 = addUnitToCart(prod, { id: 'u-e', serial_no: 'CHMPDEMO001NN', status: 'demo' });
  ok('เครื่อง DEMO: ใส่ตะกร้าไม่ได้ บอกว่าเป็น DEMO ต้องคืนเข้าสต็อกก่อน', /เป็นเครื่อง DEMO.*คืนเข้าสต็อก.*ก่อนจึงจะขายได้/.test(m1 || '') && cart.length === 0, String(m1));
  const m2 = addUnitToCart(prod, { id: 'u-c', serial_no: 'CHMP999999NN', status: 'sold' });
  ok('เครื่องที่ขายแล้ว: ข้อความเดิมไม่เปลี่ยน', /ขายออกไปแล้วหรือไม่พร้อมขาย \\(สถานะ sold\\)/.test(m2 || ''), String(m2));
  const m3 = addUnitToCart(prod, { id: 'u-b', serial_no: 'CHMP555555NN', status: 'in_stock' });
  ok('เครื่องในสต็อก: ใส่ตะกร้าได้ตามเดิม', m3 === null && cart.length === 1 && cart[0].unit_ids[0] === 'u-b', String(m3));
  cart.length = 0;

  // ── 8. นับสต็อก: ยิงเครื่อง DEMO ไม่ถูกนับ ───────────────────────────
  FAKE.product_units.find(u => u.id === 'u-e').status = 'demo';          // ข้อ 5 คืนเครื่องนี้ไปแล้ว — ตั้งกลับเป็น DEMO ก่อนนับ
  setWallMode('count');
  countSetScope('b:Pioneer DJ');
  await countStart();
  await countScan('CHMPDEMO001NN');
  ok('นับ: ยิงซีเรียลเครื่อง DEMO → บอกว่าเป็นเครื่อง DEMO ไม่นับรวม ไม่นับเป็นของบนชั้น', /เป็นเครื่อง DEMO — ไม่นับรวมในยอดสต็อก/.test(trayMsg.text) && trayMsg.bad === true && !(cnt.counted.p1), JSON.stringify(trayMsg) + ' / ' + JSON.stringify(cnt.counted));
  setWallMode('find');

  // ── 9. พนักงาน (ไม่ใช่เจ้าของ) ใช้ได้ — สิทธิ์เดียวกับตัดออก/ปรับยอด ────
  await doLogout();
  await sleep(200);
  await login('staff@djlabsiam.com');
  key('Digit1', '1', { altKey: true });
  await sleep(50);
  await openProduct('p1');
  ok('พนักงานเห็นปุ่มย้ายเข้า DEMO/คืนเข้าสต็อก และปุ่ม DEMO บนผนัง', rowBtns().length === 3 && !$('flagDemo').hidden);
  document.querySelector('#dUnits .sn-row button').click();
  CALLS.length = 0;
  $('drDemo').querySelector('form').requestSubmit();
  await sleep(300);
  ok('พนักงานย้ายเข้า DEMO ได้ (rpc เดียว ไม่มี write ตรง)', rpcs().length === 1 && rpcs()[0].args.p_demo === true && writes().length === 0 && !fatal(), fatal());

  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

const pageRoot = process.env.DEMO_ROOT || root;   // ทดสอบหน้าฉบับอื่น (mutation) ได้
const res = runPage({ root: pageRoot, file: 'desk.html', mock: MOCK, tests: TESTS, flags: ['--window-size=1440,900', '--force-prefers-reduced-motion'] });
process.exit(res.ok ? 0 : 1);
