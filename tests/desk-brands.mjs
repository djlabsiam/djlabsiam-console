/**
 * เทสต์ฟอร์มเพิ่ม/แก้สินค้าในหน้าจัดการข้อมูลของ desk.html (7 ต.ค. 69 — เจ้าของสั่ง: เพิ่มยี่ห้อใหม่ได้เอง)
 *   รัน: node tests/desk-brands.mjs      (BRANDS_ROOT=<โฟลเดอร์ที่มี desk.html ฉบับอื่น> ใช้ทำ mutation · BRANDS_ONLY=<regex ชื่อหน้า> รันทีละหน้า)
 *
 * อาการที่เจ้าของเจอ: กด "+ สินค้าใหม่" แล้วบันทึกยี่ห้อใหม่ไม่ได้ (products_brand_check) · ฟอร์มไม่มีปุ่มกล้อง · เครื่องยิง USB ใส่ช่องบาร์โค้ดไม่ได้ (wrongpage)
 *   1. ยี่ห้อ = ตัวเลือกจาก product_brands (เฉพาะที่เปิดใช้งาน · ที่ปิดแล้วยังโชว์ถ้าสินค้าตัวนั้นใช้อยู่) + "+ เพิ่มยี่ห้อใหม่…" (เจ้าของ/ผู้ดูแล)
 *   2. ยังไม่มีตาราง/อ่านไม่ได้ → ตัวเลือกสำรอง 4 ยี่ห้อเดิม + แถบเหลือง (ไม่ขึ้นแถบแดงทั้งหน้า)
 *   3. error จากฐาน (unique/check/FK/RLS/not null) → ไทยแดงตัวหนาในแผง ไม่ใช่ข้อความดิบของ Postgres
 *   4. ช่องบาร์โค้ด: ปุ่ม 📷 (กล้อง → ลงช่องนี้) + เครื่องยิง USB ลงช่องตอนโฟกัสอยู่ที่ช่อง (route 'field') · ช่องอื่นของหน้านี้ยังเป็น wrongpage
 *   5. ยี่ห้อที่เพิ่มทีหลังไม่หายจากผนังสต็อก (รวมไว้ปีก "แบรนด์อื่น")
 * ทุกหน้าแยกกัน (หน้าละ 1 งบเวลาเสมือน) · ฐานข้อมูลปลอมจดทุกการเขียนไว้ใน CALLS
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPage, HARNESS } from './lib/page-test.mjs';

const root = process.env.BRANDS_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');

const MOCK = `<script>
const CALLS = [];
const FAKE = {
  admins: [
    { id: 'u1', full_name: 'เจ้าของร้าน', role: 'owner', is_active: true },
    { id: 'u2', full_name: 'พนักงานหน้าร้าน', role: 'staff', is_active: true },
  ],
  products: [
    { id: 'p1', sku: 'PIO-DDJ-FLX4', name: 'DDJ-FLX4', brand: 'Pioneer DJ', category: 'controller', barcode_ean13: '8850001112223', sell_price: 12900, cost_price: 9000, reorder_point: 1, is_active: true, image_path: null },
    { id: 'p2', sku: 'RLP-MIXON', name: 'Reloop Mixon', brand: 'Reloop', category: 'controller', barcode_ean13: null, sell_price: 15900, cost_price: 11000, reorder_point: 1, is_active: true, image_path: null },
    { id: 'p3', sku: 'OLD-1', name: 'ของยี่ห้อที่ปิดแล้ว', brand: 'OldBrand', category: 'accessory', barcode_ean13: null, sell_price: 500, cost_price: 300, reorder_point: 0, is_active: true, image_path: null },
    { id: 'p4', sku: 'XSS-1', name: '<img src=x onerror=window.XSS=1>', brand: 'Pioneer DJ', category: 'accessory', barcode_ean13: '8850004445556', sell_price: 100, cost_price: 50, reorder_point: 0, is_active: true, image_path: null },
  ],
  product_brands: [
    { name: 'AlphaTheta', is_active: true, sort_order: 10 }, { name: 'Pioneer DJ', is_active: true, sort_order: 20 }, { name: 'NEO by OYAIDE', is_active: true, sort_order: 30 },
    { name: 'Reloop', is_active: true, sort_order: 100 }, { name: 'OldBrand', is_active: false, sort_order: 150 }, { name: 'Other', is_active: true, sort_order: 900 },
  ],
  product_stock_levels: [{ product_id: 'p1', current_qty: 5 }, { product_id: 'p2', current_qty: 3 }, { product_id: 'p3', current_qty: 1 }],
  product_units: [], stock_movements: [], customers: [], sales: [], sale_items: [],
};
const COLS = { products: [['id', 'uuid', false, true], ['sku', 'text', false, false], ['name', 'text', false, false], ['brand', 'text', false, false], ['category', 'text', true, false],
  ['barcode_ean13', 'text', true, false], ['cost_price', 'numeric', false, true], ['sell_price', 'numeric', false, true], ['reorder_point', 'integer', false, true],
  ['is_active', 'boolean', false, true], ['created_at', 'timestamp with time zone', false, true], ['updated_at', 'timestamp with time zone', false, true]],
  customers: [['id', 'uuid', false, true], ['full_name', 'text', false, false], ['phone', 'text', true, false], ['note', 'text', true, false]] };
window.NEXT_ERR = null;                              // error ที่จะตอบกลับในการเขียนครั้งถัดไป (insert/update)
window.SLOW = false;                                 // true = ฐานตอบช้า 120 ms (ตรวจปุ่มที่ล็อกระหว่างรอ)
window.BRANDS_ERR = null;                            // ตั้งค่า = อ่าน product_brands แล้ว error (ยังไม่รัน 045)
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
    then(res, rej) {
      if (table === 'product_brands' && window.BRANDS_ERR) return Promise.resolve({ data: null, error: window.BRANDS_ERR }).then(res, rej);
      if (window.SLOW && q._write) return new Promise(r => setTimeout(r, 120)).then(() => ({ data: q._rows, error: q._err })).then(res, rej);
      return Promise.resolve(q._err ? { data: null, error: q._err } : { data: q._rows, error: null, count: q._rows.length }).then(res, rej);
    },
    insert(payload) {
      q._write = true;
      CALLS.push({ op: 'insert', table, payload });
      if (window.NEXT_ERR) { q._err = window.NEXT_ERR; window.NEXT_ERR = null; return q; }
      if (table === 'product_brands') FAKE.product_brands.push({ name: payload.name, is_active: true, sort_order: 100 });
      return q;
    },
    update(payload) {
      CALLS.push({ op: 'update', table, payload });
      if (window.NEXT_ERR) { q._err = window.NEXT_ERR; window.NEXT_ERR = null; }
      return q;
    },
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
const txt = id => $(id).textContent;
function key(code, k, mods, target) {
  clock += 5000;
  const ev = new KeyboardEvent('keydown', Object.assign({ code, key: k, bubbles: true, cancelable: true }, mods || {}));
  (target || document.activeElement || document).dispatchEvent(ev);
  return ev;
}
// ยิงแบบที่เบราว์เซอร์ทำจริง: ตัวอักษรที่ keydown ไม่ถูกกันจะหล่นลงช่องที่โฟกัสอยู่
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
const writesTo = t => writes().filter(c => c.table === t);
const optVals = sel => [...sel.options].map(o => o.value);
const bold = el => parseInt(getComputedStyle(el).fontWeight, 10) >= 700;
async function login(email) {
  $('loginEmail').value = email; $('loginPassword').value = 'x';
  await doLogin(); await sleep(400);
}
async function openNew() { await adGotoRow('products', null); await sleep(60); }
function fillProduct(o) {
  if (o.sku !== undefined) $('fld_sku').value = o.sku;
  if (o.name !== undefined) $('fld_name').value = o.name;
  if (o.brand !== undefined) $('fld_brand').value = o.brand;
}
`;

// ── หน้า 1: ตัวเลือกยี่ห้อ + เพิ่มยี่ห้อใหม่ ───────────────────────────────────────
const BRANDS = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== ฟอร์มสินค้า: ยี่ห้อเป็นตัวเลือกจาก product_brands + เพิ่มยี่ห้อใหม่ ===');
  try { localStorage.clear(); } catch (e) {}
  await login('owner@djlabsiam.com');
  await openNew();
  const sel = $('fld_brand');
  ok('ฟอร์มเพิ่มสินค้า: ช่องยี่ห้อเป็น select (ไม่ใช่ช่องพิมพ์อิสระ)', !!sel && sel.tagName === 'SELECT' && sel.getAttribute('data-col') === 'brand');
  ok('ตัวเลือก = ว่าง · ยี่ห้อที่เปิดใช้งานตามลำดับ sort_order · "+ เพิ่มยี่ห้อใหม่" ท้ายสุด (ยี่ห้อที่ปิดแล้วไม่โผล่)', optVals(sel).join('|') === '|AlphaTheta|Pioneer DJ|NEO by OYAIDE|Reloop|Other|__new__', optVals(sel).join('|'));
  ok('ยี่ห้อ Other แสดงเป็น "แบรนด์อื่น" (ค่ายังเป็น Other) · ตัวเลือกใหม่เขียนว่า "+ เพิ่มยี่ห้อใหม่…"', [...sel.options].find(o => o.value === 'Other').textContent === 'แบรนด์อื่น' && [...sel.options].find(o => o.value === '__new__').textContent === '+ เพิ่มยี่ห้อใหม่…');
  ok('ฟอร์มเพิ่มสินค้าใหม่: ยังไม่เลือกยี่ห้อ (ค่าว่างถูกเลือกอยู่ ไม่ใช่ยี่ห้อแรก)', sel.value === '' && [...sel.options].find(o => o.value === '').selected);
  ok('ไม่มีแถบเหลือง (ตารางยี่ห้อมีอยู่)', !$('adBrandWarn'));
  ok('ช่องเพิ่มยี่ห้อใหม่ซ่อนอยู่ตอนเริ่ม', $('adNewBrand').hidden);

  // เลือก "+ เพิ่ม" → ช่องกรอกโผล่ · โฟกัสเข้าช่อง
  sel.value = '__new__'; sel.dispatchEvent(new Event('change', { bubbles: true }));
  ok('เลือก "+ เพิ่มยี่ห้อใหม่" → ช่องกรอกโผล่และได้โฟกัส', !$('adNewBrand').hidden && document.activeElement === $('adNewBrandName'));
  ok('ช่องชื่อยี่ห้อ: maxlength 60 · ปุ่ม "เพิ่มยี่ห้อ" สูง ≥ 44px', $('adNewBrandName').maxLength === 60 && $('adNewBrandBtn').getBoundingClientRect().height >= 44, $('adNewBrandBtn').getBoundingClientRect().height);
  sel.value = 'Reloop'; sel.dispatchEvent(new Event('change', { bubbles: true }));
  ok('เปลี่ยนไปเลือกยี่ห้ออื่น → ช่องกรอกซ่อนกลับ', $('adNewBrand').hidden);
  sel.value = '__new__'; sel.dispatchEvent(new Event('change', { bubbles: true }));

  // ตรวจชื่อก่อนส่งฐาน
  CALLS.length = 0;
  $('adNewBrandName').value = '   '; await adAddBrand();
  ok('ชื่อว่าง → ข้อความแดงตัวหนา "พิมพ์ชื่อยี่ห้อก่อน" · ไม่เขียนฐาน', !$('adNewBrandErr').hidden && /พิมพ์ชื่อยี่ห้อก่อน/.test(txt('adNewBrandErr')) && bold($('adNewBrandErr').querySelector('strong')) && writes().length === 0, txt('adNewBrandErr'));
  $('adNewBrandName').value = '  reloop '; await adAddBrand();
  ok('ซ้ำกับยี่ห้อที่มี (ไม่สนตัวพิมพ์/ช่องว่าง) → บอกชื่อที่มีอยู่ "Reloop" · ไม่เขียนฐาน', /Reloop/.test(txt('adNewBrandErr')) && /มีอยู่แล้ว/.test(txt('adNewBrandErr')) && writes().length === 0, txt('adNewBrandErr'));
  $('adNewBrandName').value = 'OLDBRAND'; await adAddBrand();
  ok('ซ้ำกับยี่ห้อที่ปิดใช้งานอยู่ → บอกว่าถูกปิดอยู่ · ไม่เขียนฐาน', /ปิดใช้งาน/.test(txt('adNewBrandErr')) && writes().length === 0, txt('adNewBrandErr'));

  // ฐานปฏิเสธ → ข้อความไทย
  window.NEXT_ERR = { code: '23505', message: 'duplicate key value violates unique constraint "idx_product_brands_name_ci"' };
  $('adNewBrandName').value = 'Dup Brand'; await adAddBrand();
  ok('ฐานบอกซ้ำ (ดัชนีไม่สนตัวพิมพ์) → "ยี่ห้อนี้มีอยู่แล้ว" ภาษาไทย ไม่ใช่ข้อความดิบ', /ยี่ห้อนี้มีอยู่แล้ว/.test(txt('adNewBrandErr')) && !/duplicate key/.test(txt('adNewBrandErr')), txt('adNewBrandErr'));
  ok('...ปุ่มกลับมากดได้ · ช่องกรอกยังเปิด · ยี่ห้อไม่เข้ารายการ', !$('adNewBrandBtn').disabled && !$('adNewBrand').hidden && !brandRows.some(b => b.name === 'Dup Brand'));
  window.NEXT_ERR = { code: '23514', message: 'new row for relation "product_brands" violates check constraint "product_brands_name_check"' };
  $('adNewBrandName').value = 'Bad\\tName'; await adAddBrand();
  ok('ฐานบอกชื่อไม่ผ่านเงื่อนไข → ข้อความไทยบอกกติกาชื่อ', /ไม่ยาวเกิน 60/.test(txt('adNewBrandErr')), txt('adNewBrandErr'));
  window.NEXT_ERR = { code: '42501', message: 'new row violates row-level security policy for table "product_brands"' };
  $('adNewBrandName').value = 'Some Brand'; await adAddBrand();
  ok('ฐานบอกไม่มีสิทธิ์ (RLS) → ข้อความไทย "ไม่มีสิทธิ์"', /ไม่มีสิทธิ์/.test(txt('adNewBrandErr')) && !/row-level/.test(txt('adNewBrandErr')), txt('adNewBrandErr'));

  // เพิ่มสำเร็จ
  CALLS.length = 0;
  $('adNewBrandName').value = '  Native Instruments  ';
  await adAddBrand(); await sleep(60);
  const ib = writesTo('product_brands');
  ok('เพิ่มสำเร็จ: insert product_brands ด้วยชื่อที่ตัดช่องว่างแล้ว (ไม่ส่งช่องอื่น)', ib.length === 1 && JSON.stringify(ib[0].payload) === JSON.stringify({ name: 'Native Instruments' }), JSON.stringify(ib));
  ok('...โหลดรายการยี่ห้อใหม่ · ตัวเลือกมียี่ห้อใหม่และถูกเลือกอยู่ · ช่องกรอกซ่อน · ล้างช่อง', brandRows.some(b => b.name === 'Native Instruments') && $('fld_brand').value === 'Native Instruments' &&
    optVals($('fld_brand')).includes('Native Instruments') && optVals($('fld_brand')).includes('__new__') && $('adNewBrand').hidden && $('adNewBrandName').value === '', optVals($('fld_brand')).join('|'));
  ok('...ขึ้นข้อความ "เพิ่มยี่ห้อ ... แล้ว"', /เพิ่มยี่ห้อ "Native Instruments" แล้ว/.test(txt('toast')), txt('toast'));
  ok('...กล่องข้อความผิดค้างจากครั้งก่อน (ไม่มีสิทธิ์) ถูกซ่อนแล้ว', $('adNewBrandErr').hidden === true, txt('adNewBrandErr'));

  // บันทึกสินค้าด้วยยี่ห้อใหม่
  fillProduct({ sku: 'NI-S4', name: 'Traktor Kontrol S4' });
  CALLS.length = 0;
  await adSaveRow(); await sleep(60);
  const ip = writesTo('products');
  ok('บันทึกสินค้ายี่ห้อใหม่: insert products พร้อม brand = Native Instruments', ip.length === 1 && ip[0].payload.brand === 'Native Instruments' && ip[0].payload.sku === 'NI-S4', JSON.stringify(ip));
  ok('...แผงปิด · ขึ้น "บันทึกเรียบร้อย"', $('detail').hidden && /บันทึกเรียบร้อย/.test(txt('toast')));

  // กดบันทึกทั้งที่ยังเลือก "+ เพิ่ม" / ยังไม่เลือกยี่ห้อ
  await openNew();
  fillProduct({ sku: 'X-1', name: 'ไม่เลือกยี่ห้อ' });
  CALLS.length = 0; await adSaveRow();
  ok('ไม่เลือกยี่ห้อ → "ต้องกรอก: แบรนด์" (ชื่อไทยของคอลัมน์) · ไม่เขียนฐาน', /ต้องกรอก/.test(txt('toast')) && /แบรนด์/.test(txt('toast')) && writes().length === 0, txt('toast'));
  $('fld_brand').value = '__new__'; $('fld_brand').dispatchEvent(new Event('change', { bubbles: true }));
  CALLS.length = 0; await adSaveRow();
  ok('ค้างที่ "+ เพิ่มยี่ห้อใหม่" แล้วกดบันทึก → แดงตัวหนาให้เลือก/เพิ่มก่อน · ไม่เขียนฐาน (ไม่ส่งค่า __new__)', !$('adSaveErr').hidden && /เลือกยี่ห้อจากรายการ/.test(txt('adSaveErr')) && bold($('adSaveErr').querySelector('strong')) && writes().length === 0, txt('adSaveErr'));
  ok('...และไม่มีค่า __new__ หลุดไปที่ฐาน', !writes().some(c => JSON.stringify(c.payload || '').includes('__new__')));

  // แก้สินค้าที่ยี่ห้อถูกปิดใช้งานแล้ว → ยังเห็นค่าเดิม ไม่ถูกเปลี่ยนเงียบ ๆ
  await adGotoRow('products', 'p3'); await sleep(60);
  const s3 = $('fld_brand'), o3 = [...s3.options].find(o => o.value === 'OldBrand');
  ok('สินค้าที่ยี่ห้อถูกปิดแล้ว: ตัวเลือกเดิมยังโชว์ (ปิดใช้งานแล้ว) และถูกเลือกอยู่', !!o3 && /ปิดใช้งานแล้ว/.test(o3.textContent) && s3.value === 'OldBrand', optVals(s3).join('|'));
  ok('...ยี่ห้อที่ปิดอื่นไม่โผล่ในตัวเลือก (มีเฉพาะของสินค้านี้)', optVals(s3).filter(v => v === 'OldBrand').length === 1);
  CALLS.length = 0; await adSaveRow(); await sleep(60);
  const up = writesTo('products');
  ok('แก้ชื่ออย่างเดียวไม่ทำให้ยี่ห้อเปลี่ยน (update ส่ง brand เดิม OldBrand)', up.length === 1 && up[0].op === 'update' && up[0].payload.brand === 'OldBrand', JSON.stringify(up));

  // กดปุ่ม "เพิ่มยี่ห้อ" จริง ๆ (ไม่ใช่เรียกฟังก์ชันตรง)
  await openNew(); $('fld_brand').value = '__new__'; $('fld_brand').dispatchEvent(new Event('change', { bubbles: true }));
  CALLS.length = 0;
  $('adNewBrandName').value = 'Clicked Brand';
  $('adNewBrandBtn').click(); await sleep(80);
  ok('กดปุ่ม "เพิ่มยี่ห้อ" = เพิ่มยี่ห้อ', writesTo('product_brands').length === 1 && writesTo('product_brands')[0].payload.name === 'Clicked Brand', JSON.stringify(writes()));
  // กด Enter ในช่องชื่อยี่ห้อ = กดปุ่มเพิ่ม · ปุ่มล็อกระหว่างรอฐาน · error ที่ไม่รู้จัก · แก้สินค้าที่ยี่ห้อถูกปิดแล้วเพิ่มยี่ห้อ
  await openNew(); $('fld_brand').value = '__new__'; $('fld_brand').dispatchEvent(new Event('change', { bubbles: true }));
  CALLS.length = 0;
  $('adNewBrandName').value = 'Enter Brand';
  $('adNewBrandName').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
  await sleep(80);
  ok('กด Enter ในช่องชื่อยี่ห้อ = เพิ่มยี่ห้อ', writesTo('product_brands').length === 1 && writesTo('product_brands')[0].payload.name === 'Enter Brand', JSON.stringify(writes()));
  $('fld_brand').value = '__new__'; $('fld_brand').dispatchEvent(new Event('change', { bubbles: true }));
  window.SLOW = true;
  $('adNewBrandName').value = 'Slow Brand';
  const slow = adAddBrand();
  ok('ระหว่างรอฐานตอบ ปุ่มเพิ่มยี่ห้อถูกล็อก (กดซ้ำไม่ได้)', $('adNewBrandBtn').disabled === true);
  await slow; window.SLOW = false;
  ok('...ตอบแล้วปุ่มไม่ล็อกค้าง', !$('adNewBrandBtn').disabled);
  $('fld_brand').value = '__new__'; $('fld_brand').dispatchEvent(new Event('change', { bubbles: true }));
  window.NEXT_ERR = { code: 'XX000', message: 'boom unexpected' };
  $('adNewBrandName').value = 'Boom Brand'; await adAddBrand();
  ok('error ที่ไม่รู้จักตอนเพิ่มยี่ห้อ → "เพิ่มยี่ห้อไม่สำเร็จ: ..." พร้อมข้อความดิบ (แดงตัวหนา)', /เพิ่มยี่ห้อไม่สำเร็จ: boom unexpected/.test(txt('adNewBrandErr')) && bold($('adNewBrandErr').querySelector('strong')), txt('adNewBrandErr'));
  await adGotoRow('products', 'p3'); await sleep(60);
  $('fld_brand').value = '__new__'; $('fld_brand').dispatchEvent(new Event('change', { bubbles: true }));
  $('adNewBrandName').value = 'Added On Edit'; await adAddBrand(); await sleep(60);
  ok('แก้สินค้าที่ยี่ห้อถูกปิดแล้วเพิ่มยี่ห้อใหม่: ตัวเลือกเดิม (OldBrand) ยังอยู่ · ยี่ห้อใหม่ถูกเลือก', optVals($('fld_brand')).includes('OldBrand') && $('fld_brand').value === 'Added On Edit', optVals($('fld_brand')).join('|') + ' / ' + $('fld_brand').value);

  // ปิดแผงระหว่างรอฐานตอบ → ไม่มี error หลุด (ช่องเลือกยี่ห้อหายไปจากหน้าแล้ว)
  await openNew(); $('fld_brand').value = '__new__'; $('fld_brand').dispatchEvent(new Event('change', { bubbles: true }));
  $('adNewBrandName').value = 'Brand While Closing';
  const pending = adAddBrand();
  $('detailBody').innerHTML = '';
  await pending; await sleep(60);
  ok('ปิดแผงระหว่างเพิ่มยี่ห้อ: เพิ่มเข้าฐานแล้วแต่ไม่มี error หลุดและไม่ขึ้นแถบแดง', brandRows.some(b => b.name === 'Brand While Closing') && !$('fatalError'));

  // พนักงาน: ไม่มี "+ เพิ่ม"
  currentAdmin.role = 'staff';                          // isManager()/isWriter() อ่านจาก currentAdmin.role
  adOpenRow(null);
  ok('พนักงาน (ไม่ใช่เจ้าของ/ผู้ดูแล): ไม่มีตัวเลือก "+ เพิ่มยี่ห้อใหม่"', !optVals($('fld_brand')).includes('__new__'), optVals($('fld_brand')).join('|'));
  ok('ไม่มีข้อผิดพลาดแดงบนจอ', !$('fatalError'), $('fatalError') && $('fatalError').textContent);
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

// ── หน้า 2: ตัวเลือกสำรองตอนยังไม่มีตารางยี่ห้อ ─────────────────────────────────────
const FALLBACK = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== ยังไม่รัน 045 (อ่าน product_brands ไม่ได้) → ตัวเลือกสำรอง 4 ยี่ห้อ + แถบเหลือง ===');
  try { localStorage.clear(); } catch (e) {}
  window.BRANDS_ERR = { code: 'PGRST205', message: "Could not find the table 'public.product_brands' in the schema cache" };
  await login('owner@djlabsiam.com');
  ok('อ่านตารางยี่ห้อไม่ได้ → brandsMissing · ไม่ขึ้นแถบแดงทั้งหน้า', brandsMissing === true && brandRows.length === 0 && !$('fatalError'), $('fatalError') && $('fatalError').textContent);
  await openNew();
  const sel = $('fld_brand');
  ok('ตัวเลือกสำรอง = 4 ยี่ห้อเดิม ไม่มี "+ เพิ่มยี่ห้อใหม่"', optVals(sel).join('|') === '|Pioneer DJ|AlphaTheta|NEO by OYAIDE|Other', optVals(sel).join('|'));
  ok('แถบเหลืองบอกให้รัน migration 045 · ข้อความสำคัญแดงตัวหนา', !!$('adBrandWarn') && $('adBrandWarn').classList.contains('alert-warn') && /migration 045/.test(txt('adBrandWarn')) && bold($('adBrandWarn').querySelector('strong')) && $('adBrandWarn').querySelector('strong').classList.contains('wk-red'), $('adBrandWarn') && txt('adBrandWarn'));
  ok('ไม่มีช่องเพิ่มยี่ห้อใหม่ในโหมดสำรอง (ฐานปฏิเสธอยู่ดี)', !$('adNewBrandName') || $('adNewBrand').hidden);
  fillProduct({ sku: 'FB-1', name: 'สำรอง', brand: 'AlphaTheta' });
  CALLS.length = 0; await adSaveRow(); await sleep(60);
  ok('โหมดสำรองยังบันทึกสินค้ายี่ห้อเดิมได้เหมือนก่อน', writesTo('products').length === 1 && writesTo('products')[0].payload.brand === 'AlphaTheta');
  // แก้สินค้าที่ยี่ห้อไม่อยู่ในรายการสำรอง (เช่น Reloop) → ยังเห็นค่าเดิม
  await adGotoRow('products', 'p2'); await sleep(60);
  ok('แก้สินค้ายี่ห้อที่ไม่อยู่ในรายการสำรอง (Reloop): ค่าเดิมยังเลือกอยู่ ไม่ถูกล้าง', $('fld_brand').value === 'Reloop', optVals($('fld_brand')).join('|'));
  // ตารางมีแต่ว่างเปล่า = ถือว่ายังไม่พร้อมเหมือนกัน
  window.BRANDS_ERR = null; FAKE.product_brands.length = 0;
  await loadBrands();
  ok('ตารางว่างเปล่า (ไม่มี error) → ใช้ตัวเลือกสำรองเหมือนกัน', brandsMissing === true);
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

// ── หน้า 3: error จากฐานเป็นไทยแดงตัวหนา ─────────────────────────────────────────────
const ERRORS = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== error ของฐานตอนบันทึกสินค้า → ไทยแดงตัวหนาในแผง ===');
  try { localStorage.clear(); } catch (e) {}
  await login('owner@djlabsiam.com');
  await openNew();
  fillProduct({ sku: 'DUP-SKU', name: 'ซ้ำ SKU', brand: 'Pioneer DJ' });
  $('fld_barcode_ean13').value = '8850001112223';
  const cases = [
    ['SKU ซ้ำ', { code: '23505', message: 'duplicate key value violates unique constraint "products_sku_key"', details: 'Key (sku)=(DUP-SKU) already exists.' }, /SKU นี้มีอยู่แล้ว .DUP-SKU. — ใช้ SKU อื่น/, /duplicate key|products_sku_key/],
    ['ซ้ำที่ไม่รู้จักว่าอะไร', { code: '23505', message: 'duplicate key value violates unique constraint "some_other_key"' }, /^ข้อมูลนี้ซ้ำกับที่มีอยู่แล้ว$/, /duplicate key|some_other_key/],
    ['อ้างอิงที่ไม่รู้จัก (FK อื่น)', { code: '23503', message: 'insert or update on table "products" violates foreign key constraint "products_other_fkey"' }, /^ข้อมูลที่อ้างถึงไม่มีอยู่จริง$/, /foreign key|products_other_fkey/],
    ['CHECK ไม่ระบุชื่อ', { code: '23514', message: 'new row violates a check constraint' }, /^ค่าบางช่องไม่ผ่านเงื่อนไขของฐานข้อมูล$/, /check constraint/],
    ['not null ไม่ระบุคอลัมน์', { code: '23502', message: 'null value violates not-null constraint' }, /^ต้องกรอก ช่องที่จำเป็น$/, /not-null/],
    ['ไม่มีสิทธิ์ระดับตาราง (permission denied)', { code: '42501', message: 'permission denied for table products' }, /ไม่มีสิทธิ์บันทึกข้อมูลนี้/, /permission denied/],
    ['บาร์โค้ดซ้ำ', { code: '23505', message: 'duplicate key value violates unique constraint "products_barcode_ean13_key"' }, /บาร์โค้ดนี้ผูกกับสินค้า DDJ-FLX4 .PIO-DDJ-FLX4. แล้ว/, /duplicate key|products_barcode/],
    ['ยี่ห้อไม่อยู่ในรายการ (FK)', { code: '23503', message: 'insert or update on table "products" violates foreign key constraint "products_brand_fkey"' }, /ยี่ห้อ "Pioneer DJ" ยังไม่อยู่ในรายการยี่ห้อ/, /foreign key|products_brand_fkey/],
    ['ฐานยังเป็น CHECK เดิม (ยังไม่รัน 045)', { code: '23514', message: 'new row for relation "products" violates check constraint "products_brand_check"' }, /migration 045/, /check constraint|products_brand_check/],
    ['CHECK ช่องอื่น', { code: '23514', message: 'new row for relation "products" violates check constraint "products_model_code_check"' }, /ไม่ผ่านเงื่อนไขของฐานข้อมูล .products_model_code_check./, /new row for relation/],
    ['ไม่มีสิทธิ์ (RLS)', { code: '42501', message: 'new row violates row-level security policy for table "products"' }, /ไม่มีสิทธิ์บันทึกข้อมูลนี้/, /row-level/],
    ['ช่องจำเป็นว่าง (not null)', { code: '23502', message: 'null value in column "sku" of relation "products" violates not-null constraint' }, /ต้องกรอก: SKU/, /null value|not-null/],
    ['error ที่ไม่รู้จัก', { code: 'XX000', message: 'something unexpected happened' }, /บันทึกไม่สำเร็จ: something unexpected happened/, /^$/],
  ];
  for (const [name, err, want, notWant] of cases) {
    window.NEXT_ERR = err; CALLS.length = 0;
    adFormError(''); await adSaveRow(); await sleep(30);
    const box = $('adSaveErr'), t = txt('adSaveErr');
    ok(name + ': แสดงในแผงเป็นไทย', !box.hidden && want.test(t) && !notWant.test(t), t);
    ok(name + ': ข้อความแดงตัวหนา (strong.wk-red) + role=alert', !!box.querySelector('strong.wk-red') && bold(box.querySelector('strong')) && box.getAttribute('role') === 'alert', box.innerHTML);
    ok(name + ': ปุ่มบันทึกกลับมากดได้ · แผงไม่ปิด · ไม่ขึ้น "บันทึกเรียบร้อย" · ไม่มีแถบแดงทั้งหน้า', !$('adSaveBtn').disabled && !$('detail').hidden && !/บันทึกเรียบร้อย/.test(txt('toast')) && !$('fatalError'), txt('toast'));
  }
  window.NEXT_ERR = null;
  // ชื่อสินค้าที่เป็น HTML อยู่ในข้อความ error/คำเตือน → แสดงเป็นข้อความ ไม่ถูกตีความเป็นแท็ก
  await openNew(); fillProduct({ sku: 'XS-1', name: 'x', brand: 'Pioneer DJ' }); $('fld_barcode_ean13').value = '8850004445556';
  window.NEXT_ERR = { code: '23505', message: 'duplicate key value violates unique constraint "products_barcode_ean13_key"' };
  await adSaveRow(); await sleep(30);
  ok('ชื่อสินค้าที่เป็น HTML ในข้อความ error แสดงเป็นข้อความ ไม่สร้างแท็กหรือรันสคริปต์', txt('adSaveErr').includes('<img src=x') && !$('adSaveErr').querySelector('img') && !window.XSS, txt('adSaveErr'));
  adBarcodeHint();
  ok('...คำเตือนใต้ช่องบาร์โค้ดก็เช่นกัน', txt('adBarcodeHint').includes('<img src=x') && !$('adBarcodeHint').querySelector('img') && !window.XSS, txt('adBarcodeHint'));
  // ผิดซ้ำแล้วแก้ → ข้อความเก่าหายตอนกดบันทึกใหม่
  window.NEXT_ERR = { code: '23505', message: 'duplicate key value violates unique constraint "products_sku_key"' };
  await adSaveRow(); await sleep(30);
  ok('มีข้อความผิดค้างอยู่', !$('adSaveErr').hidden);
  CALLS.length = 0;
  fillProduct({ sku: 'NEW-SKU-OK' });
  await adSaveRow(); await sleep(60);
  ok('กดบันทึกใหม่ได้ผล: ข้อความผิดถูกล้าง · เขียนฐานแล้ว · แผงปิด', $('adSaveErr').hidden && txt('adSaveErr') === '' && writesTo('products').length === 1 && $('detail').hidden);
  // แก้สินค้าเดิม (update) ก็แปลเหมือนกัน · บาร์โค้ดซ้ำกับตัวเอง = ไม่ใช่สินค้าอื่น
  await adGotoRow('products', 'p1'); await sleep(60);
  window.NEXT_ERR = { code: '23505', message: 'duplicate key value violates unique constraint "products_barcode_ean13_key"' };
  $('fld_barcode_ean13').value = '8850001112223';
  await adSaveRow(); await sleep(30);
  ok('แก้สินค้าเดิมแล้วฐานบอกบาร์โค้ดซ้ำ: ไม่โทษสินค้าตัวเอง (ขึ้น "สินค้าอื่น")', /บาร์โค้ดนี้ผูกกับสินค้า อื่น แล้ว/.test(txt('adSaveErr')), txt('adSaveErr'));
  // ตารางอื่นไม่เปลี่ยนวิธีแสดง error (ยังเป็นแถบแดงเดิม)
  await adSelectTable('customers'); adOpenRow(null); await sleep(30);
  ok('ตารางอื่น (ลูกค้า) ยังใช้ทางเดิม ไม่มีกล่อง adSaveErr ที่ถูกใช้แสดงผล', !!$('adSaveErr') && $('adSaveErr').hidden);
  $('fld_full_name').value = 'ลูกค้าทดสอบ';
  window.NEXT_ERR = { code: '23505', message: 'duplicate key value violates unique constraint "products_sku_key"' };
  await adSaveRow(); await sleep(30);
  ok('บันทึกลูกค้าแล้วฐานปฏิเสธ: ยังขึ้นแถบแดงทั้งหน้าแบบเดิม (ไม่แปลเป็นข้อความสินค้า) · กล่องในแผงไม่ถูกใช้', !!$('fatalError') && /บันทึกไม่สำเร็จ: duplicate key/.test($('fatalError').textContent) && $('adSaveErr').hidden, $('fatalError') && $('fatalError').textContent);
  $('fatalError').remove();
  ok('ไม่มีข้อผิดพลาดแดงบนจอ', !$('fatalError'), $('fatalError') && $('fatalError').textContent);
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

// ── หน้า 4: ช่องบาร์โค้ด — กล้อง + เครื่องยิง USB ─────────────────────────────────────
const BARCODE = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== ช่องบาร์โค้ดในฟอร์มสินค้า: ปุ่มกล้อง + เครื่องยิง USB ===');
  try { localStorage.clear(); } catch (e) {}
  await login('owner@djlabsiam.com');
  await openNew();
  const bc = $('fld_barcode_ean13'), cb = $('adCamBtn');
  ok('ช่องบาร์โค้ด + ปุ่ม 📷 อยู่ด้วยกัน · ปุ่มมี aria-label · สูง/กว้าง ≥ 44px', !!bc && !!cb && cb.getAttribute('aria-label') === 'สแกนบาร์โค้ดด้วยกล้อง' && cb.getBoundingClientRect().height >= 44 && cb.getBoundingClientRect().width >= 44, cb && cb.getBoundingClientRect().width + 'x' + cb.getBoundingClientRect().height);
  ok('ช่องบาร์โค้ด: inputmode=numeric · ไม่ autocomplete · ตัวอักษร ≥ 14px', bc.inputMode === 'numeric' && bc.autocomplete === 'off' && parseFloat(getComputedStyle(bc).fontSize) >= 14);

  // คำเตือนใต้ช่อง
  bc.value = '8850001112223'; bc.dispatchEvent(new Event('input', { bubbles: true }));
  ok('พิมพ์บาร์โค้ดที่ผูกกับสินค้าอื่น → แดงตัวหนา "ผูกกับสินค้า DDJ-FLX4 (PIO-DDJ-FLX4) แล้ว"', /ผูกกับสินค้า DDJ-FLX4 .PIO-DDJ-FLX4. แล้ว/.test(txt('adBarcodeHint')) && bold($('adBarcodeHint').querySelector('strong')), txt('adBarcodeHint'));
  bc.value = '12AB'; bc.dispatchEvent(new Event('input', { bubbles: true }));
  ok('ไม่ใช่ตัวเลข 8–14 หลัก → แดงตัวหนาเตือน (ไม่บล็อก)', /ตัวเลข 8–14 หลัก/.test(txt('adBarcodeHint')) && bold($('adBarcodeHint').querySelector('strong')), txt('adBarcodeHint'));
  bc.value = '8850009998887'; bc.dispatchEvent(new Event('input', { bubbles: true }));
  ok('บาร์โค้ดใหม่ 13 หลัก → ไม่มีคำเตือน', txt('adBarcodeHint') === '', txt('adBarcodeHint'));
  const lenWarn = n => { bc.value = '9'.repeat(n); bc.dispatchEvent(new Event('input', { bubbles: true })); return txt('adBarcodeHint') !== ''; };
  ok('ขอบความยาว: 7 หลักเตือน · 8 ไม่เตือน · 14 ไม่เตือน · 15 หลักเตือน', lenWarn(7) && !lenWarn(8) && !lenWarn(14) && lenWarn(15));
  bc.value = '  8850009998887  '; bc.dispatchEvent(new Event('input', { bubbles: true }));
  ok('มีช่องว่างหัวท้ายแต่เป็นเลข 13 หลัก → ไม่เตือน (ตัดช่องว่างก่อนตรวจ)', txt('adBarcodeHint') === '', txt('adBarcodeHint'));
  bc.value = '';

  // ทิศทางของเครื่องยิง
  bc.focus();
  ok('โฟกัสที่ช่องบาร์โค้ด → wedgeRoute = field', wedgeRoute() === 'field', wedgeRoute());
  $('fld_name').focus();
  ok('โฟกัสที่ช่องอื่นของฟอร์ม → wrongpage (เหมือนเดิม)', wedgeRoute() === 'wrongpage', wedgeRoute());
  cb.focus();
  ok('โฟกัสที่ปุ่มกล้อง → wrongpage (ยังไม่เปิดกล้อง)', wedgeRoute() === 'wrongpage', wedgeRoute());
  closeDetail();
  ok('ปิดแผงแล้ว → wrongpage (ไม่มีช่องให้ลง)', wedgeRoute() === 'wrongpage', wedgeRoute());
  await openNew();

  // เครื่องยิงลงช่องบาร์โค้ด
  const el = $('fld_barcode_ean13'); el.value = '999'; el.focus();
  CALLS.length = 0;
  typedBurst(digits('8850001234567'), el); await sleep(150);
  ok('เครื่องยิง USB ตอนโฟกัสที่ช่องบาร์โค้ด → ใส่เลขที่ยิงลงช่อง (ตัวอักษรที่หล่นเข้าช่องถูกคืนก่อน แล้วค่อยใส่ค่าที่อ่านได้)', el.value === '8850001234567', el.value);
  ok('...ขึ้น "ใส่บาร์โค้ด ... ในช่องแล้ว" · ไม่เขียนฐาน · ไม่ถูกกัน (blocked)', /ใส่บาร์โค้ด 8850001234567 ในช่องแล้ว/.test(txt('toast')) && writes().length === 0, txt('toast'));
  typedBurst(digits('8850001112223'), el); await sleep(150);
  ok('ยิงเลขที่ผูกกับสินค้าอื่น → ใส่ลงช่อง + แดงตัวหนาบอกสินค้าที่ผูกอยู่', el.value === '8850001112223' && /ผูกกับสินค้า DDJ-FLX4/.test(txt('adBarcodeHint')), el.value + ' | ' + txt('adBarcodeHint'));
  // ยิงตอนโฟกัสช่องอื่น
  const nm = $('fld_name'); nm.value = 'ชื่อเดิม'; nm.focus(); el.value = '1112223334445';
  typedBurst(digits('8850007778889'), nm); await sleep(150);
  ok('ยิงตอนโฟกัสที่ช่องชื่อสินค้า → wrongpage: ช่องชื่อกลับเป็นค่าเดิม · ช่องบาร์โค้ดไม่เปลี่ยน', nm.value === 'ชื่อเดิม' && el.value === '1112223334445' && /เปลี่ยนหมวดก่อนแล้วค่อยยิง/.test(txt('toast')), nm.value + ' | ' + el.value + ' | ' + txt('toast'));
  // หน้าต่างเปิดอยู่ = blocked
  el.focus(); $('codeDialog').showModal();
  typedBurst(digits('8850000000001'), document.activeElement); await sleep(150);       // ตัวอักษรหล่นลงช่องที่โฟกัสอยู่จริง (ในหน้าต่าง) ไม่ใช่ช่องบาร์โค้ด
  ok('มี dialog เปิดอยู่ → ยิงถูกกัน (blocked) ไม่ใส่ช่อง', el.value === '1112223334445' && /ปิดหน้าต่างที่เปิดค้างอยู่ก่อน/.test(txt('toast')), el.value + ' | ' + txt('toast'));
  $('codeDialog').close();

  // กล้อง
  const realOpenCam = window.openCam;
  let camOpened = 0;
  window.openCam = async () => { camOpened++; };
  el.focus(); cb.click();
  ok('กดปุ่ม 📷 → เรียกเปิดกล้อง · ตั้งธง adCamField', camOpened === 1 && adCamField === true, camOpened + ' ' + adCamField);
  $('fld_name').focus();
  ok('กล้องเปิดจากปุ่ม: wedgeRoute = field แม้โฟกัสอยู่ที่อื่น (ผลของกล้องลงช่องบาร์โค้ดเสมอ)', wedgeRoute() === 'field', wedgeRoute());
  $('camPanel').hidden = false;                          // จำลองกล้องที่เปิดอยู่ (openCam ถูกแทนด้วยตัวปลอม) — อ่านได้แล้วต้องปิดเอง
  await camScanned('8850002223334');
  ok('กล้องอ่านได้ → ใส่ช่องบาร์โค้ด · ปิดกล้อง · ล้างธง', el.value === '8850002223334' && adCamField === false && $('camPanel').hidden, el.value + ' ' + adCamField);
  ok('...ขึ้น "ใส่บาร์โค้ด ... ในช่องแล้ว"', /ใส่บาร์โค้ด 8850002223334 ในช่องแล้ว/.test(txt('toast')), txt('toast'));
  $('fld_name').focus();
  ok('หลังปิดกล้อง: โฟกัสที่ช่องอื่น → กลับเป็น wrongpage', wedgeRoute() === 'wrongpage', wedgeRoute());
  window.openCam = realOpenCam;
  await openCam();
  ok('เปิดกล้องจากที่อื่นในหน้านี้ (ไม่ผ่านปุ่ม 📷) ยังถูกปฏิเสธเหมือนเดิม', /สแกนด้วยกล้องใช้ได้ในหมวดสต็อกสินค้าและขายหน้าร้าน/.test(txt('toast')) && $('camPanel').hidden, txt('toast'));
  document.getElementById('toast').textContent = '';
  adCamField = true;
  // กล้องปลอมที่ปฏิเสธทันที — ของจริงใน Chrome headless รอคำขออนุญาตกล้อง ทำให้เทสต์ค้างเป็นบางรอบ
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: () => Promise.reject(new Error('ไม่มีกล้องในเทสต์')) }, configurable: true });
  await openCam();                                       // ตัวเปิดกล้องจริง (ปฏิเสธ → ขึ้นข้อความผิดพลาดในแผงกล้อง)
  ok('เปิดกล้องจริงจากปุ่ม 📷: ไม่ถูกปฏิเสธ · แผงกล้องขึ้นและบอกโหมด "ใส่ช่องบาร์โค้ด"', !/สแกนด้วยกล้องใช้ได้ในหมวด/.test(txt('toast')) && !$('camPanel').hidden && txt('camMode') === 'ใส่ช่องบาร์โค้ด', txt('toast') + ' | ' + txt('camMode'));
  closeCam();
  ok('ปิดกล้อง → ล้างธง adCamField', adCamField === false);
  // แก้สินค้าที่มีบาร์โค้ดอยู่แล้ว: บาร์โค้ดของตัวเองไม่ถูกเตือนว่าซ้ำ
  await adGotoRow('products', 'p1'); await sleep(60);
  adBarcodeHint();
  ok('แก้สินค้า DDJ-FLX4 ที่มีบาร์โค้ดของตัวเอง → ไม่เตือนว่าผูกกับสินค้าอื่น', $('fld_barcode_ean13').value === '8850001112223' && txt('adBarcodeHint') === '', txt('adBarcodeHint'));
  await openNew();
  const el2 = $('fld_barcode_ean13');

  // บันทึก: บาร์โค้ดตัดช่องว่างหัวท้าย · ว่าง = null
  fillProduct({ sku: 'BC-1', name: 'ทดสอบบาร์โค้ด', brand: 'Pioneer DJ' });
  el2.value = '  8850005556667  ';
  CALLS.length = 0; await adSaveRow(); await sleep(60);
  ok('บันทึก: บาร์โค้ดถูกตัดช่องว่างหัวท้าย', writesTo('products').length === 1 && writesTo('products')[0].payload.barcode_ean13 === '8850005556667', JSON.stringify(writesTo('products')));
  await openNew(); fillProduct({ sku: 'BC-2', name: 'ไม่มีบาร์โค้ด', brand: 'Pioneer DJ' }); $('fld_barcode_ean13').value = '   ';
  CALLS.length = 0; await adSaveRow(); await sleep(60);
  ok('บาร์โค้ดเป็นช่องว่างล้วน → ส่ง null (ไม่ใช่สตริงว่างที่ชน unique)', writesTo('products').length === 1 && writesTo('products')[0].payload.barcode_ean13 === null, JSON.stringify(writesTo('products')));
  // ตารางอื่นในหน้าจัดการข้อมูล: ไม่มีช่องกล้อง/เครื่องยิงยังเป็น wrongpage
  await adSelectTable('customers'); adOpenRow(null); await sleep(30);
  ok('ตารางอื่น (ลูกค้า): ไม่มีปุ่มกล้อง · เครื่องยิงเป็น wrongpage ตามเดิม', !$('adCamBtn') && !$('fld_barcode_ean13'), '');
  document.querySelector('#adFields input').focus();
  ok('...โฟกัสช่องไหนก็ wrongpage', wedgeRoute() === 'wrongpage', wedgeRoute());
  ok('ไม่มีข้อผิดพลาดแดงบนจอ', !$('fatalError'), $('fatalError') && $('fatalError').textContent);
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

// ── หน้า 5: ยี่ห้อใหม่ไม่หายจากผนังสต็อก ───────────────────────────────────────────────
const WALL = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== ยี่ห้อที่เพิ่มทีหลังอยู่ในปีก "แบรนด์อื่น" (ไม่หายจากผนัง/หน้านับสต็อก) ===');
  try { localStorage.clear(); } catch (e) {}
  await login('owner@djlabsiam.com');
  const rl = products.find(p => p.brand === 'Reloop'), pio = products.find(p => p.brand === 'Pioneer DJ');
  ok('wallBrand: ยี่ห้อ 3 ปีกแรก/Other คืนตัวเอง · ยี่ห้อใหม่ = Other', wallBrand({ brand: 'AlphaTheta' }) === 'AlphaTheta' && wallBrand({ brand: 'Pioneer DJ' }) === 'Pioneer DJ' && wallBrand({ brand: 'NEO by OYAIDE' }) === 'NEO by OYAIDE' && wallBrand({ brand: 'Other' }) === 'Other' && wallBrand(rl) === 'Other' && wallBrand({ brand: 'ยี่ห้อไทย' }) === 'Other');
  showSection('products'); await sleep(150);
  const wallText = txt('wall');
  ok('ผนัง (จัดตามแบรนด์): รุ่นของยี่ห้อใหม่ Reloop Mixon ขึ้นบนผนัง', /Reloop Mixon/.test(wallText), wallText.slice(0, 200));
  ok('...รุ่นของ Pioneer ก็ยังขึ้นตามเดิม', /DDJ-FLX4/.test(wallText));
  const other = document.querySelector('#wall .wing[data-key="b:Other"]');
  ok('...อยู่ในปีก "แบรนด์อื่น" (b:Other) ไม่ใช่ปีกของ Pioneer', !!other && /Reloop Mixon/.test(other.textContent) && /ของยี่ห้อที่ปิดแล้ว/.test(other.textContent), other ? other.textContent.slice(0, 120) : 'ไม่พบปีก');
  ok('...ปีกของ Pioneer ไม่มีรุ่น Reloop', !/Reloop Mixon/.test(document.querySelector('#wall .wing[data-key="b:Pioneer DJ"]').textContent));
  // ตัวกรองแบบจัดตามหมวด
  setWallGroup('category'); await sleep(100);
  const chip = [...document.querySelectorAll('#wallChips .fchip[data-v]')].find(b => b.dataset.v === 'Other');
  ok('จัดตามหมวด: ตัวกรอง "แบรนด์อื่น" นับรวมยี่ห้อใหม่ = 2 (Reloop + OldBrand)', !!chip && /แบรนด์อื่น/.test(chip.textContent) && /2/.test(chip.textContent), chip && chip.textContent);
  chip.click(); await sleep(100);
  ok('กดกรอง "แบรนด์อื่น" → เห็นรุ่นยี่ห้อใหม่ · ไม่เห็น Pioneer', /Reloop Mixon/.test(txt('wall')) && !/DDJ-FLX4/.test(txt('wall')), txt('wall').slice(0, 160));
  // หน้านับสต็อก: ขอบเขตปีก "แบรนด์อื่น"
  const opts = countScopeOptions();
  ok('ขอบเขตนับสต็อก "ทั้งปีกแบรนด์" มี "แบรนด์อื่น" เมื่อมีรุ่นของยี่ห้อใหม่บนชั้น', /value="b:Other"/.test(opts) && />แบรนด์อื่น</.test(opts), opts.slice(0, 200));
  const ids = scopeIds('b:Other');
  ok('ขอบเขตปีก Other นับรวมรุ่นของยี่ห้อใหม่ (Reloop Mixon) ด้วย', ids.includes('p2') && !ids.includes('p1'), ids.join());
  ok('ไม่มีข้อผิดพลาดแดงบนจอ', !$('fatalError'), $('fatalError') && $('fatalError').textContent);
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

let bad = 0;
for (const [name, tests, flags] of [['ยี่ห้อ', BRANDS, []], ['ตัวเลือกสำรอง', FALLBACK, []], ['error ไทย', ERRORS, []], ['บาร์โค้ด', BARCODE, []], ['ผนังสต็อก', WALL, ['--window-size=1366,768']]]) {
  if (process.env.BRANDS_ONLY && !new RegExp(process.env.BRANDS_ONLY).test(name)) continue;
  console.log('\n--- ' + name + ' ---');
  const r = runPage({ root, file: 'desk.html', mock: MOCK, tests, flags });
  if (!r.ok) bad++;
}
process.exit(bad ? 1 : 0);
