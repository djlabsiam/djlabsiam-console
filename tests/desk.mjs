/**
 * เทสต์หน้า desk.html (คอนโซลร้านบนคอม)
 *   รัน: node tests/desk.mjs
 *
 * วิธีเดียวกับชุดอื่น: ไฟล์จริงทุกบรรทัด สลับเฉพาะแท็ก Supabase เป็นตัวปลอม
 * ตัวปลอมชุดนี้จด rpc / insert / update ทุกครั้งไว้ใน CALLS เพื่อพิสูจน์กฎข้อ 4
 * (บิลต้องเกิดผ่าน create_sale / void_sale เท่านั้น ไม่ใช่ insert ตรง)
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPage, HARNESS } from './lib/page-test.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const MOCK = `<script>
const CALLS = [];
const FAKE = {
  admins: [{ id: 'u1', full_name: 'เจ้าของร้าน', role: 'owner', is_active: true }],
  products: [
    { id: 'p1', sku: 'PIO-DDJ-FLX4', name: 'DDJ-FLX4', brand: 'Pioneer DJ', category: 'คอนโทรลเลอร์',
      barcode_ean13: '619659216054', sell_price: 12900, reorder_point: 1, is_active: true },
    { id: 'p2', sku: 'NEO-RCA', name: 'สาย RCA', brand: 'NEO by OYAIDE', category: 'สายสัญญาณ',
      barcode_ean13: null, sell_price: 590, reorder_point: 5, is_active: true },
    { id: 'p3', sku: 'AT-OMNIS-DUO', name: 'OMNIS-DUO', brand: 'AlphaTheta', category: 'คอนโทรลเลอร์',
      barcode_ean13: null, sell_price: 45900, reorder_point: 1, is_active: false },
  ],
  product_units: [
    { id: 'u-ok',   product_id: 'p1', serial_no: 'CHMP123354NN', barcode_code: 'CHMP123354NN', status: 'in_stock', received_at: '2026-09-01T10:00:00Z' },
    { id: 'u-sold', product_id: 'p1', serial_no: 'CHMP999999NN', barcode_code: 'CHMP999999NN', status: 'sold', received_at: '2026-09-01T10:00:00Z' },
  ],
  product_stock_levels: [{ product_id: 'p1', current_qty: 5 }, { product_id: 'p2', current_qty: 2 }],
  stock_movements: [
    { id: 'm1', product_id: 'p1', type: 'in', qty: 5, reason: 'รับของ', created_at: '2026-09-01T10:00:00Z',
      admin_id: 'u1', ref_sale_id: null, products: { name: 'DDJ-FLX4', sku: 'PIO-DDJ-FLX4' }, admins: { full_name: 'เจ้าของร้าน' } },
  ],
  customers: [{ id: 'c1', full_name: 'ลูกค้าทดสอบ', phone: '0812345678' }],
  sales: [
    { id: 's1', sale_no: 'S-0001', customer_id: null, admin_id: 'u1', subtotal: 590, discount: 0, total: 590,
      payment_method: 'เงินสด', status: 'completed', note: null, created_at: '2026-09-20T10:00:00Z',
      customers: null, admins: { full_name: 'เจ้าของร้าน' } },
  ],
  sale_items: [
    { id: 'si1', sale_id: 's1', qty: 1, unit_price: 590, line_total: 590, products: { name: 'สาย RCA', sku: 'NEO-RCA' }, product_units: null },
  ],
};
function builder(table) {
  const q = {
    _rows: (FAKE[table] || []).slice(),
    select() { return q; },
    eq(col, val) { q._rows = q._rows.filter(r => r[col] === val); return q; },
    in(col, vals) { q._rows = q._rows.filter(r => vals.includes(r[col])); return q; },
    order() { return q; }, gte() { return q; }, limit() { return q; },
    async maybeSingle() { return { data: q._rows[0] || null, error: null }; },
    async single() { return { data: q._rows[0] || null, error: null }; },
    then(res, rej) { return Promise.resolve({ data: q._rows, error: null }).then(res, rej); },
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
      if (fn === 'create_sale') {
        FAKE.sales.unshift({ id: 's-new', sale_no: 'S-0002', total: 25800, status: 'completed',
          created_at: new Date().toISOString(), customers: null, admins: { full_name: 'เจ้าของร้าน' } });
        return { data: 's-new', error: null };
      }
      return { data: null, error: null };
    },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    auth: {
      async getSession() { return { data: { session: SESSION } }; },
      onAuthStateChange(cb) { authCb = cb; },
      async signInWithPassword({ email }) {
        SESSION = { user: { id: email === 'owner@djlabsiam.com' ? 'u1' : 'u9' } };
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
// ปุ่มลัด: ต้องใส่ key จริง (ไม่ใช่ตัวอักษรแป้นไทยแบบ press ของ HARNESS)
function key(code, k, mods) {
  mods = mods || {};
  clock += 5000;                 // คนกดปุ่ม ไม่ใช่เครื่องยิง
  const ev = new KeyboardEvent('keydown', Object.assign({ code, key: k, bubbles: true, cancelable: true }, mods));
  (document.activeElement || document).dispatchEvent(ev);
  return ev;
}
const vis = id => !document.getElementById(id).hidden;
const cartQty = id => { const l = cart.find(c => c.product_id === id); return l ? l.qty : 0; };
const serialSeq = s => s.split('').map(ch => /[0-9]/.test(ch) ? ['Digit' + ch, 0] : ['Key' + ch, 1]);

async function runTests() {
  L('=== คอนโซลร้าน desk.html ===');

  // ── 1. ต้องล็อกอินก่อน ─────────────────────────────────────────────────
  ok('ยังไม่ล็อกอิน เห็นหน้าเข้าสู่ระบบ', document.getElementById('loginOverlay').style.display !== 'none');
  ok('ยังไม่ล็อกอิน ไม่มีข้อมูลสินค้าหลุดมา', !document.querySelector('#productRows tr[data-i]'));

  document.getElementById('loginEmail').value = 'nobody@djlabsiam.com';
  document.getElementById('loginPassword').value = 'x';
  await doLogin();
  await sleep(200);
  ok('บัญชีที่ไม่มีแถวใน admins ถูกบอกตรง ๆ ว่ายังไม่ได้รับสิทธิ์',
    document.getElementById('loginError').textContent.indexOf('ยังไม่ได้รับสิทธิ์') !== -1,
    document.getElementById('loginError').textContent);
  ok('บัญชีที่ไม่มีสิทธิ์ยังเข้าไม่ได้', document.getElementById('loginOverlay').style.display !== 'none');

  document.getElementById('loginEmail').value = 'owner@djlabsiam.com';
  await doLogin();
  await sleep(300);
  ok('ทีมงานล็อกอินแล้วเข้าได้', document.getElementById('loginOverlay').style.display === 'none');
  ok('แสดงชื่อผู้ใช้บนแถบบน', document.getElementById('currentUserInfo').textContent.indexOf('เจ้าของร้าน') !== -1);
  // หน้าแรกพนักงานเป็นหมวดเริ่มต้นแล้ว (30 ก.ย. 69) — ชุดนี้ทดสอบหมวดสต็อก จึงกดปุ่มเข้าคอนโซลก่อน
  ok('ล็อกอินแล้วเริ่มที่หน้าแรก', current === 'home' && vis('sec-home'), current);
  // ปุ่ม "เข้าสู่คอนโซลร้าน" ถูกเอาออกแล้ว (เจ้าของสั่ง 30 ก.ย. 69) — เข้าหมวดสินค้าด้วย Alt+1 เหมือนเดิม
  key('Digit1', '1', { altKey: true });
  ok('Alt+1 พาไปหมวดสินค้า', current === 'products' && vis('sec-products'), current);

  // ── 2. ผนังสินค้า (แทนตารางเดิม 1 ต.ค. 69 · รายละเอียดทั้งหมดอยู่ใน tests/stock-wall.mjs) ──
  const rows = () => [...document.querySelectorAll('#wall .w-row')];
  ok('ผนังสินค้าแสดงครบ 3 รุ่นจากฐานข้อมูล', rows().length === 3, rows().length);
  const flx = document.getElementById('wr-p1');
  ok('ยอดคงเหลือมาจาก product_stock_levels', !!flx && flx.querySelector('.w-qty').textContent.trim() === '5',
    flx && flx.querySelector('.w-qty').textContent);
  ok('สถานะแสดงเป็นข้อความ ไม่ใช่สีอย่างเดียว', document.getElementById('wall').textContent.indexOf('ปิดใช้งาน') !== -1);
  toggleWallFlag('low');
  ok('กด "ใกล้หมด" เหลือเฉพาะรุ่นที่ใกล้หมด', rows().length === 1 && rows()[0].id === 'wr-p2', rows().map(r => r.id).join());
  toggleWallFlag('low');

  // ── 3. คีย์บอร์ด ↓ → Enter Esc ─────────────────────────────────────────
  document.getElementById('wall').focus();
  key('ArrowDown', 'ArrowDown');
  ok('↓ ครั้งแรกเลือกรุ่นแรกของปีกแรก (AlphaTheta)', wall.sel === 'p3', wall.sel);
  key('ArrowRight', 'ArrowRight');
  ok('→ ข้ามไปปีกถัดไป (Pioneer DJ)', wall.sel === 'p1', wall.sel);
  ok('แถวที่เลือกมีไฮไลต์', document.getElementById('wr-p1').classList.contains('sel'));
  key('Enter', 'Enter');
  await sleep(100);
  ok('Enter เปิดแผงรายละเอียดของรุ่นที่เลือก',
    vis('detail') && document.getElementById('detailTitle').textContent === 'DDJ-FLX4',
    document.getElementById('detailTitle').textContent);
  key('Escape', 'Escape');
  ok('Esc ปิดแผงรายละเอียด', !vis('detail'));

  document.getElementById('wall').focus();
  key('Slash', '/');
  ok('หมวดสินค้า: กด / ไปที่ช่องยิงของผนัง', document.activeElement.id === 'productSearch', document.activeElement.id);
  key('Escape', 'Escape');
  ok('Esc ออกจากช่องยิง', document.activeElement.id !== 'productSearch');

  key('Digit4', '4', { altKey: true });
  ok('Alt+4 ไปหมวดขายหน้าร้าน', current === 'pos' && vis('sec-pos'), current);
  document.activeElement.blur();
  key('Slash', '/');
  ok('หมวดอื่น: กด / ไปที่ช่องค้นหาทั้งร้าน', document.activeElement.id === 'globalSearch', document.activeElement.id);
  key('Escape', 'Escape');

  // ── 4. ยิงบาร์โค้ดเข้าตะกร้า ───────────────────────────────────────────
  cart.length = 0; renderCart();
  const enter = burst(digits('619659216054'));
  await sleep(150);
  ok('ยิงบาร์โค้ดของรุ่นเข้าตะกร้า', cartQty('p1') === 1, JSON.stringify(cart));
  ok('Enter ของเครื่องยิงถูกกัน ไม่ไปสั่งงานอื่นต่อ', enter.defaultPrevented);

  cart.length = 0; renderCart();
  burstMixed(serialSeq('CHMP123354NN'));
  await sleep(150);
  const line = cart.find(c => c.product_id === 'p1');
  ok('ยิงซีเรียลแล้วผูกเครื่องกับบรรทัดในตะกร้า',
    !!line && line.unit_ids.length === 1 && line.serials[0] === 'CHMP123354NN', JSON.stringify(cart));

  burstMixed(serialSeq('CHMP999999NN'));
  await sleep(150);
  ok('ซีเรียลที่ขายไปแล้วไม่เข้าตะกร้า และมีข้อความบอก',
    line.unit_ids.length === 1 && document.getElementById('toast').textContent.indexOf('ขายออกไปแล้ว') !== -1,
    document.getElementById('toast').textContent);

  // ── 5. คีย์ลัดในตะกร้า และห้ามทำงานระหว่างพิมพ์ ─────────────────────
  addToCart('p2');
  document.activeElement.blur();
  cartSel = cart.findIndex(c => c.product_id === 'p2');
  key('Equal', '+');
  ok('+ เพิ่มจำนวนบรรทัดที่เลือก', cartQty('p2') === 2, cartQty('p2'));
  document.getElementById('discountInput').focus();
  key('Minus', '-');
  ok('กด - ระหว่างพิมพ์ในช่องส่วนลด ไม่ไปลดจำนวนในตะกร้า', cartQty('p2') === 2, cartQty('p2'));
  document.activeElement.blur();
  key('Minus', '-');
  ok('- ลดจำนวนบรรทัดที่เลือก', cartQty('p2') === 1, cartQty('p2'));

  // รหัสที่มีขีดกลาง ยิงตอนแป้นเป็นอังกฤษ: ขีดกลางกลางรหัสต้องไม่กลายเป็นคีย์ลัด "ลดจำนวน"
  clock += 5000;
  ['Digit1','Digit2','Digit3','Digit4'].forEach((c, i) => { if (i) clock += 6; press(c, { key: c.slice(5) }); });
  clock += 6; press('Minus', { key: '-' });
  ['Digit5','Digit6','Digit7','Digit8'].forEach(c => { clock += 6; press(c, { key: c.slice(5) }); });
  clock += 6; press('Enter', { key: 'Enter' });
  await sleep(150);
  ok('ขีดกลางในรหัสที่ยิงมา ไม่ไปลดจำนวนในตะกร้า', cartQty('p2') === 1, cartQty('p2'));
  ok('รหัสที่มีขีดกลางอ่านครบทั้งก้อน', document.getElementById('toast').textContent.indexOf('1234-5678') !== -1,
    document.getElementById('toast').textContent);

  // ── 6. บันทึกการขายผ่าน create_sale เท่านั้น ─────────────────────────
  CALLS.length = 0;
  key('F9', 'F9');
  await sleep(300);
  const rpc = CALLS.find(c => c.op === 'rpc' && c.fn === 'create_sale');
  ok('F9 บันทึกการขายด้วย rpc create_sale', !!rpc, JSON.stringify(CALLS));
  ok('ไม่มีการ insert/update ตาราง sales หรือ sale_items ตรง ๆ',
    !CALLS.some(c => c.op !== 'rpc' && (c.table === 'sales' || c.table === 'sale_items')), JSON.stringify(CALLS));
  const serialItem = rpc && rpc.args.p_items.find(i => i.product_id === 'p1');
  ok('ส่ง unit_ids ของเครื่องที่ยิงไปด้วย', !!serialItem && serialItem.unit_ids[0] === 'u-ok', JSON.stringify(rpc && rpc.args));
  ok('เปิดหน้าต่างบิลสำเร็จพร้อมเลขที่บิล',
    document.getElementById('successDialog').open && document.getElementById('successSaleNo').textContent.indexOf('S-0002') !== -1);
  ok('ตะกร้าว่างหลังขาย', cart.length === 0);
  document.getElementById('successDialog').close();

  // ── 7. ยกเลิกบิลผ่าน void_sale พร้อมยืนยัน ───────────────────────────
  showSection('bills');
  await openBill('s1');
  ok('เปิดรายละเอียดบิลในแผงขวา', vis('detail') && document.getElementById('detailBody').textContent.indexOf('สาย RCA') !== -1);
  document.getElementById('voidSaleBtn').click();
  ok('กดยกเลิกแล้วต้องขึ้นหน้าต่างยืนยันก่อน', document.getElementById('voidDialog').open);

  document.getElementById('toast').textContent = '';
  burst(digits('619659216054'));
  await sleep(100);
  ok('ยิงบาร์โค้ดตอนหน้าต่างยืนยันเปิดอยู่ ไม่ทำอะไรลับหลัง',
    document.getElementById('toast').textContent.indexOf('ปิดหน้าต่าง') !== -1, document.getElementById('toast').textContent);

  CALLS.length = 0;
  await confirmVoid();
  ok('ไม่กรอกเหตุผล ยังไม่ยกเลิก', !CALLS.some(c => c.fn === 'void_sale'));
  document.getElementById('voidReason').value = 'ลูกค้าขอยกเลิก';
  await confirmVoid();
  const v = CALLS.find(c => c.op === 'rpc' && c.fn === 'void_sale');
  ok('ยกเลิกบิลด้วย rpc void_sale', !!v && v.args.p_sale_id === 's1' && v.args.p_reason === 'ลูกค้าขอยกเลิก', JSON.stringify(CALLS));
  ok('ไม่มีการแก้ตาราง sales ตรง ๆ', !CALLS.some(c => c.op !== 'rpc' && c.table === 'sales'));
  ok('หน้าต่างยืนยันปิดหลังยกเลิก', !document.getElementById('voidDialog').open);

  // ── 8. รับเข้าพร้อมซีเรียล: ลง product_units ก่อน stock_movements ─────
  showSection('movement');
  document.getElementById('movProduct').value = 'p1'; onMovProductChange();
  document.getElementById('movType').value = 'in'; onMovTypeChange();
  burstMixed(serialSeq('FCMP510073NN'));
  await sleep(150);
  ok('ยิงซีเรียลในหน้ารับเข้า นับให้เองและล็อกจำนวน',
    pendingSerials.length === 1 && document.getElementById('movQty').value === '1' && document.getElementById('movQty').readOnly,
    JSON.stringify(pendingSerials));
  CALLS.length = 0;
  await submitMovement();
  const iu = CALLS.findIndex(c => c.op === 'insert' && c.table === 'product_units');
  const im = CALLS.findIndex(c => c.op === 'insert' && c.table === 'stock_movements');
  ok('ลงซีเรียลก่อนลงยอดสต็อก', iu !== -1 && im !== -1 && iu < im, JSON.stringify(CALLS));

  // ── 9. รหัสที่ไม่รู้จัก ต้องถามว่าเป็นบาร์โค้ดรุ่นหรือซีเรียล ─────────
  showSection('products');
  burst(digits('111122223333'));
  await sleep(150);
  ok('ยิงรหัสที่ไม่รู้จัก ขึ้นหน้าต่างให้เลือกว่าเป็นอะไร',
    document.getElementById('codeDialog').open &&
    document.getElementById('codeBody').textContent.indexOf('บาร์โค้ดของรุ่นสินค้า') !== -1 &&
    document.getElementById('codeBody').textContent.indexOf('ซีเรียลของเครื่อง') !== -1);
  document.getElementById('codeDialog').close();

  // ── 10. กฎข้อ 5: ประวัติการเคลื่อนไหวไม่มีปุ่มแก้/ลบ ────────────────
  showSection('moves');
  ok('ประวัติการเคลื่อนไหวแสดงจากฐานข้อมูล', document.querySelectorAll('#moveRows tr[data-i]').length === 1);
  ok('ไม่มีปุ่มแก้หรือลบในหมวดประวัติ', !/แก้ไข|ลบ/.test(document.getElementById('sec-moves').querySelector('table').textContent));

  // ── 11. keydown เปล่า ไม่มี code (ตัวเติมอัตโนมัติ/ตัวจัดการรหัสผ่านของเบราว์เซอร์) ต้องไม่ทำให้คอนโซลพัง ──
  // เจ้าของเจอ 2 ต.ค. 69: "Cannot read properties of undefined (reading 'match')" ที่ wedgeChar — code เป็น undefined ไม่ใช่ ''
  {
    const errs = bareKeydown(document).concat(bareKeydown(document.body));
    ok('keydown ที่ไม่มี code ไม่ทำให้เกิด error', !errs.length, errs.join(' | '));
  }

  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

const res = runPage({ root, file: 'desk.html', mock: MOCK, tests: TESTS });
process.exit(res.ok ? 0 : 1);
