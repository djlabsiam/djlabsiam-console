/**
 * เทสต์ "ค้นหาลูกค้าด้วยรหัสสมาชิกได้" (desk.html หมวดลูกค้า — 26 ต.ค. 69 เจ้าของสั่ง)
 *   รัน: node tests/desk-custcode.mjs      (CUST_ROOT=<โฟลเดอร์ที่มี desk.html ฉบับอื่น> ใช้ทำ mutation)
 *
 * รหัสสมาชิกอยู่ที่ members.code ลูกค้าผูกผ่าน customers.member_id (ตั้งแต่ 032/071) →
 *   loadCustomers ต้องดึง members:member_id(code) พ่วงมา · ช่องค้นหาต้องค้นรหัสได้ · แถวต้องโชว์ป้ายรหัส
 *   ลูกค้าที่ไม่ผูกสมาชิก (members = null) ต้องไม่พัง ไม่มีป้าย และยังค้นด้วยชื่อ/เบอร์ได้ตามเดิม
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPage, HARNESS } from './lib/page-test.mjs';

const root = process.env.CUST_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');

const MOCK = `<script>
const CALLS = [];
window.CUST_SELECTS = [];                                // คอลัมน์ที่ขอจากตาราง customers ทุกครั้ง
const FAKE = {
  admins: [{ id: 'u1', full_name: 'เจ้าของร้าน', role: 'owner', is_active: true }, { id: 'u2', full_name: 'พนักงาน', role: 'staff', is_active: true }],
  products: [{ id: 'p1', sku: 'PIO-DDJ-FLX4', name: 'DDJ-FLX4', brand: 'Pioneer DJ', category: 'controller', barcode_ean13: '8850001112223', sell_price: 12900, cost_price: 9000, reorder_point: 1, is_active: true, image_path: null }],
  product_brands: [{ name: 'Pioneer DJ', is_active: true, sort_order: 20 }],
  product_stock_levels: [{ product_id: 'p1', current_qty: 5 }],
  product_units: [], stock_movements: [], sales: [], sale_items: [],
  customers: [
    { id: 'c1', full_name: 'สมาชิก หนึ่ง', phone: '0811111111', line_id: null, email: null, note: null, tags: ['สมาชิก'], created_at: '2026-10-26T01:00:00Z', created_by: null, admins: null, members: { code: '125093' } },
    { id: 'c2', full_name: 'สมาชิก สอง', phone: '0822222222', line_id: null, email: null, note: null, tags: ['สมาชิก'], created_at: '2026-10-26T01:00:00Z', created_by: null, admins: null, members: { code: '25001' } },
    { id: 'c3', full_name: 'ลูกค้า ทั่วไป', phone: '0833333333', line_id: null, email: null, note: null, tags: [], created_at: '2026-10-26T01:00:00Z', created_by: null, admins: null, members: null },
    { id: 'c4', full_name: 'ลูกค้า ไม่มีคีย์ members', phone: '0844444444', line_id: null, email: null, note: null, tags: [], created_at: '2026-10-26T01:00:00Z', created_by: null, admins: null },
  ],
};
function builder(table) {
  const q = {
    _rows: (FAKE[table] || []).slice(),
    select(cols) { if (table === 'customers') window.CUST_SELECTS.push(String(cols)); return q; },
    eq(col, val) { q._rows = q._rows.filter(r => r[col] === val); return q; },
    in(col, vals) { q._rows = q._rows.filter(r => vals.includes(r[col])); return q; },
    is() { return q; }, neq() { return q; }, not() { return q; }, or() { return q; }, ilike() { return q; },
    order() { return q; }, gte() { return q; }, lte() { return q; }, lt() { return q; }, gt() { return q; },
    limit() { return q; }, range() { return q; }, contains() { return q; },
    async maybeSingle() { return { data: q._rows[0] || null, error: null }; },
    async single() { return { data: q._rows[0] || null, error: null }; },
    then(res, rej) { return Promise.resolve({ data: q._rows, error: null, count: q._rows.length }).then(res, rej); },
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
    functions: { async invoke(name) { return { data: name === 'mail' ? { messages: [], total: 0, unseen: 0, counts: {} } : {}, error: null }; } },
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

const PAGE = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${HARNESS}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);
async function login(email) { $('loginEmail').value = email; $('loginPassword').value = 'x'; await doLogin(); await sleep(400); }
async function search(text) { $('customerSearch').value = text; $('customerSearch').dispatchEvent(new Event('input', { bubbles: true })); await sleep(80); }
const names = () => [...document.querySelectorAll('#customerRows tr')].map(tr => tr.querySelector('strong') ? tr.querySelector('strong').textContent : tr.textContent.trim());
const rowOf = name => [...document.querySelectorAll('#customerRows tr')].find(tr => tr.textContent.includes(name));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function runTests() {
  L('=== ค้นหาลูกค้าด้วยรหัสสมาชิก (' + window.innerWidth + 'px) ===');
  try { localStorage.clear(); } catch (e) {}
  await login('owner@djlabsiam.com');
  showSection('customers'); await sleep(300);

  ok('โหลดลูกค้าแล้ว ขอรหัสสมาชิกพ่วงมาด้วย (members:member_id(code))',
     window.CUST_SELECTS.length > 0 && window.CUST_SELECTS.every(s => s.includes('members:member_id(code)')), JSON.stringify(window.CUST_SELECTS));
  ok('ไม่ค้นหา: เห็นลูกค้าครบ 4 ราย (รวมคนที่ไม่ผูกสมาชิก/ไม่มีคีย์ members)', names().length === 4, JSON.stringify(names()));
  ok('ช่องค้นหาบอกว่าค้นด้วยรหัสสมาชิกได้', $('customerSearch').placeholder.includes('รหัสสมาชิก'), $('customerSearch').placeholder);

  await search('125093');
  ok('ค้นรหัส 125093 → เจอเฉพาะสมาชิกหนึ่ง', same(names(), ['สมาชิก หนึ่ง']), JSON.stringify(names()));
  await search('25001');
  ok('ค้นรหัส 25001 → เจอเฉพาะสมาชิกสอง (ไม่ปนรหัส 125093)', same(names(), ['สมาชิก สอง']), JSON.stringify(names()));
  await search('1250');
  ok('ค้นรหัสบางส่วน (1250) → เจอสมาชิกหนึ่ง', same(names(), ['สมาชิก หนึ่ง']), JSON.stringify(names()));
  await search('999999');
  ok('ค้นรหัสที่ไม่มี → ไม่เจอใคร ขึ้นข้อความว่าไม่พบ', names().length === 1 && /ไม่พบ/.test(names()[0]), JSON.stringify(names()));

  await search('');
  const r1 = rowOf('สมาชิก หนึ่ง'), r3 = rowOf('ลูกค้า ทั่วไป'), r4 = rowOf('ไม่มีคีย์ members');
  ok('แถวสมาชิกโชว์ป้ายรหัส "รหัส 125093" ข้างชื่อ', !!r1 && /รหัส 125093/.test(r1.textContent), r1 && r1.textContent);
  ok('แถวที่ไม่ผูกสมาชิก (members = null) ไม่มีป้ายรหัส ไม่พัง', !!r3 && !/รหัส/.test(r3.textContent), r3 && r3.textContent);
  ok('แถวที่ไม่มีคีย์ members เลย ไม่มีป้ายรหัส ไม่พัง', !!r4 && !/รหัส/.test(r4.textContent), r4 && r4.textContent);

  // ของเดิมต้องไม่หาย
  await search('สมาชิก สอง');
  ok('ค้นด้วยชื่อ ยังทำงานตามเดิม', same(names(), ['สมาชิก สอง']), JSON.stringify(names()));
  await search('0833333333');
  ok('ค้นด้วยเบอร์โทร ยังทำงานตามเดิม', same(names(), ['ลูกค้า ทั่วไป']), JSON.stringify(names()));
  await search('สมาชิก');
  ok('ค้นด้วยแท็ก "สมาชิก" ยังทำงานตามเดิม (ได้ 2 ราย)', names().length === 2, JSON.stringify(names()));
  ok('ไม่มีแถบข้อผิดพลาดแดงบนจอ', !$('fatalError'), $('fatalError') && $('fatalError').textContent);

  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

let bad = 0;
for (const [name, flags] of [['คอม 1400px', ['--window-size=1400,900']], ['จอแคบแบบมือถือ 500px', ['--window-size=500,900']]]) {
  console.log('\n--- ค้นลูกค้าด้วยรหัสสมาชิก · ' + name + ' ---');
  const r = runPage({ root, file: 'desk.html', mock: MOCK, tests: PAGE, flags });
  if (!r.ok) bad++;
}
process.exit(bad ? 1 : 0);
