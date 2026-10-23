/**
 * เทสต์ "แถบเพิ่มสินค้า (ฟอร์มในแผงขวา) ต้องไม่ปิดเองเมื่อสลับหน้าต่างโปรแกรมแล้วกลับมา" ของ desk.html (23 ต.ค. 69 — เจ้าของแจ้งทั้งคอมและมือถือ)
 *   รัน: node tests/desk-keepform.mjs      (KEEP_ROOT=<โฟลเดอร์ที่มี desk.html ฉบับอื่น> ใช้ทำ mutation · KEEP_ONLY=<regex ชื่อหน้า>)
 *
 * ต้นเหตุที่สงสัย: supabase-js ส่ง onAuthStateChange('SIGNED_IN') ซ้ำด้วย session เดิมทุกครั้งที่กลับมาที่แท็บ →
 *   handleAuthState เรียก showSection('admin', 'none') ซ้ำ → closeDetail() ปิดแผงที่เปิดค้างและฟอร์มที่กรอกไว้หาย
 * เทสต์นี้จำลองทุกทางที่เบราว์เซอร์ส่งสัญญาณตอนสลับหน้าต่าง: visibilitychange (ซ่อน > 5 วินาที → resync) · auth ซ้ำ (SIGNED_IN / TOKEN_REFRESHED) ·
 *   pageshow · blur/focus — แล้วตรวจว่าแผงยังเปิด ค่าที่กรอกยังอยู่ และ resync ยังทำงาน (ข้อมูลยังถูกเก็บตก)
 * ทดสอบ 2 ขนาดจอ: คอม (1400×900) และจอแคบแบบมือถือ (500×900 < 768px)
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPage, HARNESS } from './lib/page-test.mjs';

const root = process.env.KEEP_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');

const MOCK = `<script>
const CALLS = [];
window.PRODUCT_READS = 0;
const FAKE = {
  admins: [{ id: 'u1', full_name: 'เจ้าของร้าน', role: 'owner', is_active: true }, { id: 'u2', full_name: 'พนักงาน', role: 'staff', is_active: true }],
  products: [{ id: 'p1', sku: 'PIO-DDJ-FLX4', name: 'DDJ-FLX4', brand: 'Pioneer DJ', category: 'controller', barcode_ean13: '8850001112223', sell_price: 12900, cost_price: 9000, reorder_point: 1, is_active: true, image_path: null }],
  product_brands: [{ name: 'Pioneer DJ', is_active: true, sort_order: 20 }, { name: 'AlphaTheta', is_active: true, sort_order: 10 }, { name: 'Other', is_active: true, sort_order: 900 }],
  product_stock_levels: [{ product_id: 'p1', current_qty: 5 }],
  product_units: [], stock_movements: [], customers: [], sales: [], sale_items: [],
};
const COLS = { products: [['id', 'uuid', false, true], ['sku', 'text', false, false], ['name', 'text', false, false], ['brand', 'text', false, false], ['category', 'text', true, false],
  ['barcode_ean13', 'text', true, false], ['cost_price', 'numeric', false, true], ['sell_price', 'numeric', false, true], ['reorder_point', 'integer', false, true],
  ['is_active', 'boolean', false, true]] };
function builder(table) {
  const q = {
    _rows: (FAKE[table] || []).slice(),
    select() { if (table === 'products') window.PRODUCT_READS++; return q; },
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
window.fireAuth = ev => authCb && authCb(ev, SESSION);          // supabase-js ส่งซ้ำด้วย session เดิมตอนกลับมาที่แท็บ / ต่ออายุ token
window.supabase = {
  createClient: () => ({
    from: builder,
    rpc: async (fn, args) => {
      CALLS.push({ op: 'rpc', fn, args });
      if (fn === 'admin_table_columns') return { data: (COLS[args.p_table] || []).map(c => ({ column_name: c[0], data_type: c[1], is_nullable: c[2], has_default: c[3] })), error: null };
      return { data: null, error: null };
    },
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
async function login(email) { $('loginEmail').value = email; $('loginPassword').value = 'x'; await doLogin(); await sleep(400); }
const setVis = hidden => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
};
// เปิดฟอร์มจากปุ่ม "+ สินค้าใหม่" บนผนังสต็อกจริง (ไม่เรียกฟังก์ชันตรง) แล้วกรอกค่า
async function openAndFill() {
  showSection('products'); await sleep(150);
  $('addProductBtn').click(); await sleep(200);
  $('fld_sku').value = 'NEW-SKU-1'; $('fld_name').value = 'สินค้าที่กรอกค้างไว้';
  $('fld_brand').value = 'AlphaTheta'; $('fld_cost_price').value = '4500'; $('fld_sell_price').value = '5900';
}
const stillOpen = () => !!$('detail') && !$('detail').hidden && !!$('fld_sku') && $('fld_sku').value === 'NEW-SKU-1' && $('fld_name').value === 'สินค้าที่กรอกค้างไว้'
  && $('fld_brand').value === 'AlphaTheta' && $('fld_cost_price').value === '4500' && $('fld_sell_price').value === '5900';
const why = () => 'detail.hidden=' + ($('detail') && $('detail').hidden) + ' sku=' + ($('fld_sku') ? $('fld_sku').value : '(ไม่มีช่อง)') + ' name=' + ($('fld_name') ? $('fld_name').value : '-');
const ensure = async () => { if (!stillOpen()) await openAndFill(); };
// ซ่อนแท็บนาน ms มิลลิวินาที แล้วกลับมา (resyncHiddenAt ถอยเวลาแทนการรอจริง)
async function awayFor(ms) { setVis(true); if (typeof resyncHiddenAt !== 'undefined') resyncHiddenAt -= ms; setVis(false); await sleep(900); }
`;

const PAGE = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== แถบเพิ่มสินค้าไม่ปิดเองเมื่อสลับหน้าต่างโปรแกรม (' + window.innerWidth + 'px) ===');
  try { localStorage.clear(); } catch (e) {}
  await login('owner@djlabsiam.com');
  await openAndFill();
  ok('เริ่มต้น: แผงเพิ่มสินค้าเปิดจากปุ่ม "+ สินค้าใหม่" · ช่องที่กรอกอยู่ครบ (' + window.innerWidth + 'px)', stillOpen() && /เพิ่มแถวใน/.test($('detailTitle') ? $('detailTitle').textContent : document.body.textContent), why());

  // 1) กลับมาที่แท็บหลังซ่อนนาน (resync) — ต้องเก็บตกข้อมูลเหมือนเดิม แต่ห้ามปิดแผง
  const reads0 = window.PRODUCT_READS;
  await awayFor(60000);
  ok('ซ่อนแท็บ 60 วินาทีแล้วกลับมา: แผงยังเปิด ค่าที่กรอกยังอยู่', stillOpen(), why());
  ok('...และ resync ยังทำงาน (โหลดสินค้าใหม่)', window.PRODUCT_READS > reads0, reads0 + ' → ' + window.PRODUCT_READS);

  // 2) supabase-js ส่ง SIGNED_IN ซ้ำด้วย session เดิมตอนกลับมาที่แท็บ
  window.fireAuth('SIGNED_IN'); await sleep(600);
  ok('auth ส่ง SIGNED_IN ซ้ำ (session เดิม): แผงยังเปิด ค่าที่กรอกยังอยู่', stillOpen(), why());
  await ensure(); window.fireAuth('TOKEN_REFRESHED'); await sleep(600);
  ok('auth ส่ง TOKEN_REFRESHED: แผงยังเปิด ค่าที่กรอกยังอยู่', stillOpen(), why());
  await ensure(); window.fireAuth('INITIAL_SESSION'); await sleep(600);
  ok('auth ส่ง INITIAL_SESSION ซ้ำ: แผงยังเปิด ค่าที่กรอกยังอยู่', stillOpen(), why());

  // 3) ลำดับจริงของเบราว์เซอร์: กลับมา → visibilitychange → auth ซ้ำ → resync
  await ensure(); await awayFor(60000);
  window.fireAuth('SIGNED_IN'); await sleep(900);
  ok('กลับมาที่แท็บ (visibilitychange + SIGNED_IN ซ้ำ + resync) พร้อมกัน: แผงยังเปิด ค่ายังอยู่', stillOpen(), why());

  // 4) pageshow / blur / focus
  await ensure(); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); await sleep(900);
  ok('pageshow (กลับจากแคชย้อนหลัง): แผงยังเปิด ค่ายังอยู่', stillOpen(), why());
  await ensure(); window.dispatchEvent(new Event('blur')); await sleep(100); window.dispatchEvent(new Event('focus')); await sleep(300);
  ok('หน้าต่างเสียโฟกัสแล้วได้คืน (blur → focus): แผงยังเปิด ค่ายังอยู่', stillOpen(), why());
  await ensure(); window.dispatchEvent(new Event('online')); await sleep(900);
  ok('เน็ตกลับมา (online → resync): แผงยังเปิด ค่ายังอยู่', stillOpen(), why());

  // 5) หลังทั้งหมดนี้ยังบันทึกได้ — และไม่มีข้อผิดพลาดแดงบนจอ
  await ensure();
  CALLS.length = 0;
  await adSaveRow(); await sleep(150);
  const ins = CALLS.filter(c => c.op === 'insert' && c.table === 'products');
  ok('หลังสลับหน้าต่างหลายรอบ บันทึกสินค้าได้ด้วยค่าที่กรอกไว้', ins.length === 1 && ins[0].payload.sku === 'NEW-SKU-1' && ins[0].payload.brand === 'AlphaTheta' && ins[0].payload.name === 'สินค้าที่กรอกค้างไว้', JSON.stringify(ins[0] && ins[0].payload));
  ok('ไม่มีแถบข้อผิดพลาดแดงบนจอ', !$('fatalError'), $('fatalError') && $('fatalError').textContent);

  // 6) ยังปิดตามที่ควรปิด: กด ✕ / เปลี่ยนหมวด ยังทำงานเหมือนเดิม
  await openAndFill();
  closeDetail();
  ok('กดปิดแผงเอง (✕) ยังปิดได้', $('detail').hidden);
  await openAndFill();
  showSection('home'); await sleep(100);
  ok('เปลี่ยนหมวด ยังปิดแผงตามเดิม', $('detail').hidden);
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

let bad = 0;
for (const [name, flags] of [['คอม 1400px', ['--window-size=1400,900']], ['จอแคบแบบมือถือ 500px', ['--window-size=500,900']]]) {
  if (process.env.KEEP_ONLY && !new RegExp(process.env.KEEP_ONLY).test(name)) continue;
  console.log('\n--- ' + name + ' ---');
  const r = runPage({ root, file: 'desk.html', mock: MOCK, tests: PAGE, flags });
  if (!r.ok) bad++;
}
process.exit(bad ? 1 : 0);
