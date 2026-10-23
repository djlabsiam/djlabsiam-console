/**
 * เทสต์ฝั่งหน้าจอของ "บิลขายคอร์สอัตโนมัติ" (migration 069 · แผน console-workspace/PLAN-course-sales-slips.md ส่วน A)
 *   รัน: node tests/desk-coursebill.mjs        ·  COURSEBILL_ROOT=<โฟลเดอร์ที่มี desk.html ฉบับอื่น> ใช้ทำ mutation
 *
 * บิลคอร์สเกิดที่ฐาน (trigger) — หน้าจอมีหน้าที่แค่: (1) อ่านบิลที่ยอดติดลบ (คืนเงิน) ได้ทุกจุดโดยตัวเลขไม่เพี้ยน (2) ไม่เปิดทางยกเลิกบิลคอร์สจากหน้าบิล
 * (3) ป้าย "ค่าคอร์สเรียน" (4) ยังไม่รัน 069 = หน้าเดิมใช้ได้ ไม่ขึ้นแถบแดง
 * จุดที่อ่าน sales.total / v_daily_income ทั้งหมด: ยอดวันนี้/เดือน (loadStats) · ประวัติบิล · รายละเอียดบิล · หน้าลูกค้า · ยอดขายของฉัน · สรุปรายวัน
 * ฐานปลอมจำลองเฉพาะรูปข้อมูลที่หน้าอ่าน (ตัวจริงของ SQL ตรวจที่ console-workspace/sql-tests/test069.mjs)
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPage, HARNESS } from './lib/page-test.mjs';

const root = process.env.COURSEBILL_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');

const mockFor = (opts) => `<script>
const CALLS = [];
const OPT = ${JSON.stringify(opts)};
const NOW = new Date().toISOString();
const FAKE = {
  admins: [{ id: 'u1', full_name: 'เจ้าของร้าน', role: 'owner', is_active: true }],
  products: [{ id: 'p1', sku: 'NEO-RCA', name: 'สาย RCA', brand: 'NEO by OYAIDE', category: 'สายสัญญาณ', barcode_ean13: null, sell_price: 590, reorder_point: 5, is_active: true }],
  product_units: [], product_stock_levels: [{ product_id: 'p1', current_qty: 2 }], stock_movements: [],
  customers: [{ id: 'c1', full_name: 'นักเรียนทดสอบ', phone: '0812345678', line_id: null, email: null, note: null, tags: [], created_at: NOW, created_by: 'u1', admins: { full_name: 'เจ้าของร้าน' } }],
  sales: [
    { id: 's1', sale_no: 'S261023-0001', customer_id: null, admin_id: 'u1', subtotal: 590, discount: 0, total: 590, payment_method: 'เงินสด', status: 'completed', note: null, created_at: NOW, customers: null, admins: { full_name: 'เจ้าของร้าน' }, sale_sellers: [] },
    { id: 's2', sale_no: 'S261023-0002', customer_id: 'c1', admin_id: 'u1', subtotal: 12000, discount: 0, total: 12000, payment_method: 'โอน', status: 'completed', note: 'คอร์ส ทดสอบ Basic · ชำระงวดที่ 1', created_at: NOW, customers: { full_name: 'นักเรียนทดสอบ', phone: '0812345678' }, admins: { full_name: 'เจ้าของร้าน' }, sale_sellers: [{ admin_id: 'u1', role: 'primary' }] },
    { id: 's3', sale_no: 'S261023-0003', customer_id: 'c1', admin_id: 'u1', subtotal: -3000, discount: 0, total: -3000, payment_method: 'อื่นๆ', status: 'completed', note: 'คืนเงินคอร์ส ทดสอบ Basic', created_at: NOW, customers: { full_name: 'นักเรียนทดสอบ', phone: '0812345678' }, admins: { full_name: 'เจ้าของร้าน' }, sale_sellers: [{ admin_id: 'u1', role: 'primary' }] },
    { id: 's4', sale_no: 'S261023-0004', customer_id: 'c1', admin_id: 'u1', subtotal: 7000, discount: 0, total: 7000, payment_method: 'เงินสด', status: 'void', voided_reason: 'แก้รายการชำระคอร์ส', note: 'คอร์ส ทดสอบ Basic · ชำระงวดที่ 2', created_at: NOW, customers: { full_name: 'นักเรียนทดสอบ', phone: '0812345678' }, admins: { full_name: 'เจ้าของร้าน' }, sale_sellers: [] },
  ],
  sale_items: [
    { id: 'si1', sale_id: 's1', qty: 1, unit_price: 590, line_total: 590, products: { name: 'สาย RCA', sku: 'NEO-RCA' }, product_units: null },
    { id: 'si2', sale_id: 's2', qty: 1, unit_price: 12000, line_total: 12000, products: { name: 'ค่าคอร์สเรียน', sku: 'COURSE-SERVICE' }, product_units: null },
    { id: 'si3', sale_id: 's3', qty: 1, unit_price: -3000, line_total: -3000, products: { name: 'ค่าคอร์สเรียน', sku: 'COURSE-SERVICE' }, product_units: null },
    { id: 'si4', sale_id: 's4', qty: 1, unit_price: 7000, line_total: 7000, products: { name: 'ค่าคอร์สเรียน', sku: 'COURSE-SERVICE' }, product_units: null },
  ],
  course_sales: OPT.noTable ? null : [
    { sale_id: 's2', kind: 'payment', enrollment_id: 'e1', payment_id: 'pay1' },
    { sale_id: 's3', kind: 'refund', enrollment_id: 'e1', payment_id: 'pay2' },
    { sale_id: 's4', kind: 'payment', enrollment_id: 'e1', payment_id: null },
  ],
  sale_sellers: [
    { sale_id: 's2', role: 'primary', admin_id: 'u1', sales: { total: 12000, status: 'completed', created_at: NOW } },
    { sale_id: 's3', role: 'primary', admin_id: 'u1', sales: { total: -3000, status: 'completed', created_at: NOW } },
    { sale_id: 's4', role: 'primary', admin_id: 'u1', sales: { total: 7000, status: 'void', created_at: NOW } },
  ],
  v_daily_income: [
    { occurred_at: NOW, source: 'ขายสินค้า', detail: 'S261023-0001', amount: 590, payment_method: 'เงินสด', kind: 'sale', ref_id: 's1' },
    { occurred_at: NOW, source: 'ค่าคอร์สเรียน', detail: 'S261023-0002', amount: 12000, payment_method: 'โอน', kind: 'sale', ref_id: 's2' },
    { occurred_at: NOW, source: 'ค่าคอร์สเรียน', detail: 'S261023-0003', amount: -3000, payment_method: 'อื่นๆ', kind: 'sale', ref_id: 's3' },
  ],
  expenses: [],
};
function builder(table) {
  const missing = FAKE[table] === null;
  const q = {
    _rows: (FAKE[table] || []).slice(),
    select() { return q; },
    eq(col, val) { if (!String(col).includes('.')) q._rows = q._rows.filter(r => r[col] === val); return q; },
    order() { return q; }, gte() { return q; }, lt() { return q; }, lte() { return q; }, in() { return q; }, neq() { return q; }, is() { return q; }, limit() { return q; }, contains() { return q; }, or() { return q; }, ilike() { return q; }, not() { return q; },
    async maybeSingle() { return missing ? { data: null, error: { code: 'PGRST205', message: 'relation does not exist' } } : { data: q._rows[0] || null, error: null }; },
    async single() { return { data: q._rows[0] || null, error: null }; },
    then(res, rej) { return Promise.resolve(missing ? { data: null, error: { code: '42P01', message: 'relation "' + table + '" does not exist' } } : { data: q._rows, error: null }).then(res, rej); },
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
    rpc: async (fn, args) => { CALLS.push({ op: 'rpc', fn, args }); return { data: null, error: null }; },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    auth: {
      async getSession() { return { data: { session: SESSION } }; },
      onAuthStateChange(cb) { authCb = cb; },
      async signInWithPassword({ email }) { SESSION = { user: { id: 'u1' } }; setTimeout(() => authCb && authCb('SIGNED_IN', SESSION)); return { data: {}, error: null }; },
      async signOut() { SESSION = null; setTimeout(() => authCb && authCb('SIGNED_OUT', null)); return { error: null }; },
    },
  }),
};
</script>`;

const TESTS = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${HARNESS}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);
const isRed = el => !!el && getComputedStyle(el).color === 'rgb(204, 0, 26)' && Number(getComputedStyle(el).fontWeight) >= 600;
const rowOf = no => [...document.querySelectorAll('#billRows tr[data-i]')].find(r => r.textContent.includes(no));
const NEG = /^[-−]\\s*3,000\\.00$/;

async function runTests() {
  L('=== บิลค่าคอร์สบนหน้าจอ (desk.html · 069) ===' + (OPT.noTable ? ' [ยังไม่รัน 069]' : ''));
  $('loginEmail').value = 'owner@djlabsiam.com'; $('loginPassword').value = 'x';
  await doLogin(); await sleep(500);
  ok('ล็อกอินเข้าได้', $('loginOverlay').style.display === 'none');
  const alertText = () => ($('fatalError') || {}).textContent || '';

  if (OPT.noTable) {
    // ── ยังไม่รัน 069: ตาราง course_sales ไม่มี → หน้าเดิมใช้ได้ ไม่ขึ้นแถบแดง ──
    ok('ยังไม่รัน 069: ไม่มีบิลคอร์สในหน่วยความจำ', courseSaleMap.size === 0, courseSaleMap.size);
    ok('ยังไม่รัน 069: ไม่ขึ้นแถบแดง (หน้าเดิมใช้ได้)', !alertText() || $('fatalError').hidden === true || $('fatalError').style.display === 'none', alertText());
    showSection('bills'); await sleep(200);
    ok('ยังไม่รัน 069: ประวัติบิลโหลดครบ 4 ใบ', document.querySelectorAll('#billRows tr[data-i]').length === 4);
    await openBill('s2'); await sleep(200);
    ok('ยังไม่รัน 069: ไม่มีป้ายบิลคอร์ส (ยังไม่รู้ว่าเป็นบิลคอร์ส) และปุ่มยกเลิกยังอยู่เหมือนเดิม', !$('billCourseNote') && !!$('voidSaleBtn'));
    L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ==='); L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
    return;
  }

  // ── โหลดบิลคอร์ส ──
  ok('courseSaleMap โหลด 3 ใบ (ชำระ · คืนเงิน · ที่ยกเลิกแล้ว)', courseSaleMap.size === 3 && courseSaleMap.has('s2') && courseSaleMap.has('s3') && courseSaleMap.has('s4'), courseSaleMap.size);
  ok('โหลดสำเร็จ ไม่ขึ้นแถบแดง', !/โหลด/.test(alertText()) || $('fatalError').hidden === true || $('fatalError').style.display === 'none', alertText());

  // ── หน้าแรก: ยอดวันนี้ (loadStats) = ผลรวมสุทธิ ไม่นับบิลยกเลิก · บิลคืนเงินหักออก ──
  ok('ยอดขายวันนี้ = 590 + 12,000 − 3,000 = 9,590.00 (บิลคืนเงินหักออก · บิลยกเลิกไม่นับ)', $('statTodaySales').textContent === '9,590.00', $('statTodaySales').textContent);
  ok('จำนวนบิลวันนี้ = 3 (ไม่นับที่ยกเลิก)', $('statTodayCount').textContent === '3', $('statTodayCount').textContent);

  // ── ประวัติบิล ──
  showSection('bills'); await sleep(200);
  ok('ประวัติบิลแสดงครบ 4 ใบ', document.querySelectorAll('#billRows tr[data-i]').length === 4);
  const r2 = rowOf('S261023-0002'), r3 = rowOf('S261023-0003'), r1 = rowOf('S261023-0001');
  ok('บิลคอร์สมีป้าย "ค่าคอร์สเรียน" · บิลสินค้าไม่มี', !!r2 && r2.textContent.includes('ค่าคอร์สเรียน') && !!r3 && r3.textContent.includes('ค่าคอร์สเรียน') && !!r1 && !r1.textContent.includes('ค่าคอร์สเรียน'));
  const amt3 = r3.querySelector('td.num strong');
  ok('บิลคืนเงิน: ยอดติดลบแสดง −3,000.00 (ไม่ NaN)', NEG.test(amt3.textContent.trim()) && !/NaN/.test(r3.textContent), amt3.textContent);
  ok('บิลคืนเงิน: ยอดติดลบเป็นแดงตัวหนา', isRed(amt3));
  ok('บิลบวกไม่เป็นแดง', !isRed(r2.querySelector('td.num strong')) && !isRed(r1.querySelector('td.num strong')));

  // ── รายละเอียดบิล ──
  await openBill('s2'); await sleep(200);
  ok('รายละเอียดบิลคอร์ส: มีข้อความบอกทางแก้ (แดงตัวหนา)', !!$('billCourseNote') && isRed($('billCourseNote')) && /คอร์สเรียน/.test($('billCourseNote').textContent), ($('billCourseNote') || {}).textContent);
  ok('รายละเอียดบิลคอร์ส: ไม่มีปุ่ม "ยกเลิกบิล" และไม่มีข้อความ "ยกเลิกบิลได้เฉพาะ…"', !$('voidSaleBtn') && !/ยกเลิกบิลได้เฉพาะ/.test($('detailBody').textContent));
  ok('รายละเอียดบิลคอร์ส: แสดงรายการ ค่าคอร์สเรียน · COURSE-SERVICE · ยอดสุทธิ 12,000.00', /ค่าคอร์สเรียน/.test($('detailBody').textContent) && /COURSE-SERVICE/.test($('detailBody').textContent) && /12,000\\.00/.test($('detailBody').textContent));
  await openBill('s3'); await sleep(200);
  const d3 = $('detailBody').textContent;
  ok('รายละเอียดบิลคืนเงิน: ยอดรวม/สุทธิ/รายการแสดงติดลบ ไม่ NaN', /[-−]3,000\\.00/.test(d3) && !/NaN/.test(d3), d3.slice(0, 300));
  ok('รายละเอียดบิลคืนเงิน: ข้อความ "บิลคืนเงิน" แดงตัวหนา + ข้อความบิลคอร์ส · ไม่มีปุ่มยกเลิก', !!$('billNegNote') && isRed($('billNegNote')) && !!$('billCourseNote') && !$('voidSaleBtn'));
  await openBill('s4'); await sleep(200);
  ok('บิลคอร์สที่ยกเลิกแล้ว: ขึ้นแถบ "ถูกยกเลิกแล้ว" + เหตุผล · ไม่มีปุ่มยกเลิก', /ถูกยกเลิกแล้ว/.test($('detailBody').textContent) && /แก้รายการชำระคอร์ส/.test($('detailBody').textContent) && !$('voidSaleBtn'));
  await openBill('s1'); await sleep(200);
  ok('บิลสินค้าปกติ: ยังมีปุ่ม "ยกเลิกบิล" เหมือนเดิม ไม่มีข้อความบิลคอร์ส/คืนเงิน', !!$('voidSaleBtn') && !$('billCourseNote') && !$('billNegNote'));

  // ── กันเปิดหน้าต่างยกเลิกบิลคอร์สแม้ถูกเรียกตรง ──
  currentSaleDetailId = 's2';
  openVoidDialog(); await sleep(100);
  ok('เรียก openVoidDialog กับบิลคอร์สตรงๆ: หน้าต่างไม่เปิด', !$('voidDialog').open);
  const nVoid = CALLS.filter(c => c.op === 'rpc' && c.fn === 'void_sale').length;
  ok('ไม่มีการเรียก void_sale กับบิลคอร์สเลย', nVoid === 0, nVoid);
  currentSaleDetailId = 's1'; openVoidDialog(); await sleep(100);
  ok('บิลสินค้าปกติ: หน้าต่างยกเลิกบิลยังเปิดได้', $('voidDialog').open); $('voidDialog').close();

  // ── หน้าลูกค้า: ยอดซื้อรวม/ประวัติ ──
  showSection('customers'); await sleep(200);
  await openCustomer('c1'); await sleep(300);
  const cd = $('detailBody').textContent;
  ok('หน้าลูกค้า: ประวัติแสดงบิลบวก/ติดลบ ไม่ NaN', /12,000\\.00/.test(cd) && /[-−]3,000\\.00/.test(cd) && !/NaN/.test(cd), cd.slice(0, 400));
  ok('หน้าลูกค้า: ยอดซื้อรวมสุทธิ = 12,000 − 3,000 = 9,000 (ไม่นับบิลยกเลิก)', /9,000(\\.00)?/.test(cd) && !/19,000|16,000/.test(cd), cd.slice(0, 400));

  // ── ยอดขายของฉัน (หน้าแรก) ──
  await loadMySales(); await sleep(100);
  ok('ยอดขายของฉัน: วันนี้ = 12,000 − 3,000 = ฿9,000 จาก 2 บิล (ไม่นับที่ยกเลิก · ไม่ NaN)', /฿9,000/.test($('mySalesToday').textContent) && /2 บิล/.test($('mySalesToday').textContent) && !/NaN/.test($('mySalesToday').textContent), $('mySalesToday').textContent);
  ok('ยอดขายของฉัน: เดือนนี้เท่ากัน', /฿9,000/.test($('mySalesMonth').textContent), $('mySalesMonth').textContent);

  // ── สรุปรายวัน ──
  showSection('daily'); await sleep(400);
  const body = $('incomeTableBody').textContent;
  ok('สรุปรายวัน: ป้าย "ค่าคอร์สเรียน" 2 แถว · "ขายสินค้า" 1 แถว', (body.match(/ค่าคอร์สเรียน/g) || []).length === 2 && (body.match(/ขายสินค้า/g) || []).length === 1, body.slice(0, 300));
  const negCell = [...document.querySelectorAll('#incomeTableBody td.num')].find(td => /3,000\\.00/.test(td.textContent));
  ok('สรุปรายวัน: แถวคืนเงินแสดง −3,000.00 เป็นแดงตัวหนา', !!negCell && /[-−]3,000\\.00/.test(negCell.textContent) && isRed(negCell.querySelector('.wk-red') || negCell), negCell && negCell.textContent);
  ok('สรุปรายวัน: รวมรายรับ = 590 + 12,000 − 3,000 = 9,590.00 · ไม่ NaN', $('incomeTotal').textContent === '9,590.00' && $('sumNet').textContent === '9,590.00', $('incomeTotal').textContent + ' / ' + $('sumNet').textContent);
  ok('สรุปรายวัน: แถวบิลคอร์สไม่มีปุ่มแก้/ลบ (แก้ที่ต้นทาง)', ![...document.querySelectorAll('#incomeTableBody tr')].some(tr => /ค่าคอร์สเรียน/.test(tr.textContent) && tr.querySelector('button')));
  const pay = $('paymentBreakdown').textContent;
  ok('สรุปรายวัน: แยกตามวิธีชำระ โอน 12,000.00 · อื่นๆ −3,000.00 · เงินสด 590.00', /โอน12,000\\.00/.test(pay.replace(/\\s/g, '').replace('บาท', '')) && /อื่นๆ[-−]3,000\\.00/.test(pay.replace(/\\s/g, '').replace('บาท', '')) && /เงินสด590\\.00/.test(pay.replace(/\\s/g, '').replace('บาท', '')), pay);

  // ── กฎข้อ 4: หน้าจอไม่เขียน sales / sale_items / course_sales เองเลย ──
  const bad = CALLS.filter(c => ['insert', 'update', 'delete', 'upsert'].includes(c.op) && ['sales', 'sale_items', 'course_sales', 'course_sales_settings', 'sale_replacements'].includes(c.table));
  ok('หน้าจอไม่ insert/update/delete ตาราง sales · sale_items · course_sales ตรงๆ', bad.length === 0, JSON.stringify(bad));

  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ==='); L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

let allOk = true;
for (const [name, opts] of [['มีตาราง course_sales (069 รันแล้ว)', {}], ['ยังไม่รัน 069', { noTable: true }]]) {
  console.log('--- ' + name + ' ---');
  const res = runPage({ root, file: 'desk.html', mock: mockFor(opts), tests: TESTS });
  allOk = allOk && res.ok;
}
console.log(allOk ? '\n=== desk-coursebill: ผ่าน ===' : '\n=== desk-coursebill: ไม่ผ่าน ===');
process.exit(allOk ? 0 : 1);
