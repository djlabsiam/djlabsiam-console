/**
 * เทสต์หมวดระยะที่ 2 ของ desk.html — จองห้อง · ลูกค้า · สรุปรายวัน · บันทึกการใช้งาน · จัดการข้อมูล
 *   รัน: node tests/desk-modules.mjs
 *
 * วิธีเดียวกับชุดอื่น: ไฟล์จริงทุกบรรทัด สลับเฉพาะแท็ก Supabase เป็นตัวปลอมที่จด
 * rpc / insert / update / delete / contains ทุกครั้งไว้ใน CALLS
 *
 * การยืนยันการจองต้อง "เขียนเหมือนหน้าจองเดิม" เพราะ trigger ในฐานข้อมูลส่ง LINE หาลูกค้า
 * จากการเขียนนั้น — ชุดนี้เทียบคอลัมน์ที่ desk.html เขียนกับค่าคงที่ OLD_CONFIRM_KEYS (ตรึงจากหน้าจองเดิมก่อนเลิกใช้)
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPage, HARNESS } from './lib/page-test.mjs';

const root = process.env.BK_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');   // BK_ROOT = ทดสอบหน้าฉบับอื่น (mutation)

// คอลัมน์ที่การยืนยันการจองต้องเขียน (เรียงตามตัวอักษร) — เดิมอ่านจาก confirmBooking ของหน้าจองเดิม (DJ_LAB_SIAM_BookingApp.html)
// เลิกใช้หน้านั้นแล้ว (5 ต.ค. 69 · ไฟล์เหลือเป็นหน้าพาไป) จึงตรึงเป็นค่าคงที่ — ที่มาจริงคือ trigger trg_notify_booking_confirmed
// (stock-app 004: ยิง LINE หาลูกค้าเมื่อ confirmed เปลี่ยน false → true) · confirmed_by/confirmed_at คือร่องรอยว่าใครยืนยันเมื่อไหร่
// ⚠️ ถ้าเปลี่ยนคอลัมน์ที่เขียนตอนยืนยัน ต้องแก้ทั้ง desk.html และค่าคงที่นี้ และตรวจ trigger ในฐานข้อมูลด้วย
const OLD_CONFIRM_KEYS = ['confirmed', 'confirmed_at', 'confirmed_by'];

const MOCK = `<script>
const CALLS = [];
const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
const FAKE = {
  admins: [
    { id: 'u1', full_name: 'เจ้าของร้าน', role: 'owner', is_active: true },
    { id: 'u2', full_name: 'พนักงานหน้าร้าน', role: 'staff', is_active: true },
  ],
  products: [
    { id: 'p1', sku: 'PIO-DDJ-FLX4', name: 'DDJ-FLX4', brand: 'Pioneer DJ', category: 'คอนโทรลเลอร์',
      barcode_ean13: '619659216054', sell_price: 12900, reorder_point: 1, is_active: true },
  ],
  product_stock_levels: [{ product_id: 'p1', current_qty: 5 }],
  product_units: [], stock_movements: [], sales: [], sale_items: [],
  room_bookings: [
    { id: 'b1', customer_name: 'ลูกค้า LINE', contact: '0812345678', date: TODAY, start_time: '13:00:00', hours: 2,
      room: 'Standard (CDJ3000x + DJM-A9/V10/V5/S11/S7)', cost: 1600, status: 'upcoming', confirmed: false,
      source: 'online_line', line_user_id: 'U123', customer_id: null },
    { id: 'b2', customer_name: 'ลูกค้าเว็บ', contact: '0899999999', date: TODAY, start_time: '16:00:00', hours: 1,
      room: 'Controller Setup', cost: 800, status: 'upcoming', confirmed: false,
      source: 'online_web', line_user_id: null, customer_id: null },
    { id: 'b3', customer_name: 'ลูกค้าประจำ', contact: '0812345678', date: '2026-09-01', start_time: '12:00:00', hours: 3,
      room: 'Turntable Setup (PLX-CRSS12 + DJM-S11/S7/S5/A9)', cost: 2400, status: 'done', confirmed: true,
      source: 'staff', line_user_id: null, customer_id: null },
  ],
  // ตารางสอน (041): 14:00–16:00 เวลาไทยของวันนี้ เขียนเป็น UTC (07:00Z–09:00Z) เพื่อเทสต์การแปลงเวลาไทยด้วย
  room_blocks: [{ starts_at: TODAY + 'T07:00:00Z', ends_at: TODAY + 'T09:00:00Z', all_day: false }],
  booking_settings: [{ id: true, price_per_hour: 800, points_per_hour: 1, free_hour_threshold: 10, free_hours_reward: 1, room_name: 'DJ LAB SIAM' }],
  customers: [
    { id: 'c1', full_name: 'ลูกค้าประจำ', phone: '812345678', line_id: null, email: null, note: null, tags: ['ลูกค้าประจำ'],
      created_at: '2026-09-01T10:00:00Z', created_by: 'u1', admins: { full_name: 'เจ้าของร้าน' } },
  ],
  members: [],
  loyalty_points_ledger: [],
  v_daily_income: [
    { occurred_at: TODAY + 'T03:00:00Z', source: 'ขายสินค้า', detail: 'S-0001', amount: 590, payment_method: 'เงินสด', kind: 'sale', ref_id: 's1' },
    { occurred_at: TODAY + 'T06:00:00Z', source: 'ค่าเช่าห้องซ้อม', detail: 'ลูกค้าประจำ', amount: 1600, payment_method: null, kind: 'booking', ref_id: 'b9' },
    { occurred_at: TODAY + 'T07:00:00Z', source: 'สมัครเรียน', detail: 'คอร์สไทย', amount: 500, payment_method: 'โอน', kind: 'manual', ref_id: 'i1' },
  ],
  expenses: [{ id: 'e1', spent_on: TODAY, seq: 1, description: 'ค่าน้ำแข็ง', amount: 200, receipt_path: null }],
  income_entries: [],
  activity_log: [
    { id: 'a1', action: 'UPDATE', table_name: 'products', record_id: 'p1', created_at: '2026-09-29T10:00:00Z', admin_id: 'u1',
      old_data: { name: 'DDJ-FLX4', sell_price: 12500 }, new_data: { name: 'DDJ-FLX4', sell_price: 12900 }, admins: { full_name: 'เจ้าของร้าน' } },
    { id: 'a2', action: 'DELETE', table_name: 'customers', record_id: 'c9', created_at: '2026-09-28T10:00:00Z', admin_id: null,
      old_data: { full_name: 'ลูกค้าเก่า' }, new_data: null, admins: null },
  ],
};
const COLS = {
  products: [['id','uuid',false,true],['sku','text',false,false],['name','text',false,false],['brand','text',false,false],
             ['sell_price','numeric',false,true],['is_active','boolean',false,true],['created_at','timestamp with time zone',false,true]],
  sales: [['id','uuid',false,true],['sale_no','text',false,false],['total','numeric',false,true],['status','USER-DEFINED',false,true],
          ['created_at','timestamp with time zone',false,true]],
};
FAKE.sales.push({ id: 's1', sale_no: 'S-0001', total: 590, status: 'completed', created_at: '2026-09-20T10:00:00Z', customer_id: 'c9' });
function builder(table) {
  (window.FROMS = window.FROMS || []).push(table);       // บันทึกทุกครั้งที่หน้าเปิดคำขอไปตารางไหน (ไว้นับว่า "โหลดใหม่" ไปกี่รอบ ครอบตารางไหนบ้าง)
  const q = {
    _rows: (FAKE[table] || []).slice(), _head: false,
    select(c, o) { if (o && o.head) q._head = true; return q; },
    eq(col, val) { q._rows = q._rows.filter(r => r[col] === val); return q; },
    is(col, val) { q._rows = q._rows.filter(r => r[col] === val); return q; },
    contains(col, val) { CALLS.push({ op: 'contains', table, col, val }); return q; },
    order() { return q; }, gte() { return q; }, lt() { return q; }, lte() { return q; }, limit() { return q; },
    range() { return q; }, or() { return q; }, ilike() { return q; }, in() { return q; },
    async maybeSingle() { return { data: q._rows[0] || null, error: null }; },
    async single() { return { data: q._rows[0] || null, error: null }; },
    then(res, rej) { return Promise.resolve({ data: q._head ? null : q._rows, error: (window.BLOCKS_ERR && table === 'room_blocks') ? { message: 'relation room_blocks does not exist' } : null, count: q._rows.length }).then(res, rej); },
    insert(payload) { CALLS.push({ op: 'insert', table, payload }); q._rows = [Object.assign({ id: 'new-' + CALLS.length }, payload)]; return q; },
    // RLS_BLOCK = ตารางที่ฐานข้อมูลปฏิเสธ "เงียบ ๆ": ไม่มี error แต่ไม่แก้/ไม่ลบอะไร (ขอแถวกลับมาได้ 0 แถว) — จำลองสิทธิ์ที่หายไปกลางทาง
    update(payload) { CALLS.push({ op: 'update', table, payload, q }); if (window.RLS_BLOCK && window.RLS_BLOCK.has(table)) q._rows = []; return q; },
    upsert(payload) { CALLS.push({ op: 'upsert', table, payload }); return q; },
    delete() { CALLS.push({ op: 'delete', table }); if (window.RLS_BLOCK && window.RLS_BLOCK.has(table)) q._rows = []; return q; },
  };
  const eq0 = q.eq;
  q.eq = (col, val) => { const last = CALLS[CALLS.length - 1]; if (last && last.q === q) last.where = { col, val }; return eq0(col, val); };
  return q;
}
let SESSION = null, authCb = null;
window.supabase = {
  createClient: () => ({
    from: builder,
    rpc: async (fn, args) => {
      CALLS.push({ op: 'rpc', fn, args });
      if (fn === 'admin_table_columns') {
        return { data: (COLS[args.p_table] || []).map(c => ({ column_name: c[0], data_type: c[1], is_nullable: c[2], has_default: c[3] })), error: null };
      }
      return { data: null, error: null };
    },
    channel: name => ({ on(t, f, cb) { if (f && f.table) (window.RT = window.RT || {})[f.table] = cb; return this; }, subscribe(cb) { (window.RTSUB = window.RTSUB || {})[name] = cb; return this; } }),     // RTSUB[ชื่อช่อง](สถานะ) = จำลองสถานะของ channel (SUBSCRIBED · CLOSED · CHANNEL_ERROR · TIMED_OUT)     // RT[ตาราง]() = จำลองว่า realtime แจ้งว่ามีการเปลี่ยน
    storage: { from: () => ({
      async upload() { CALLS.push({ op: 'upload' }); return { error: null }; },
      async remove() { return { error: null }; },
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
const OLD_CONFIRM_KEYS = ${JSON.stringify(OLD_CONFIRM_KEYS)};
const sleep = ms => new Promise(r => setTimeout(r, ms));
function key(code, k, mods) {
  clock += 5000;
  const ev = new KeyboardEvent('keydown', Object.assign({ code, key: k, bubbles: true, cancelable: true }, mods || {}));
  (document.activeElement || document).dispatchEvent(ev);
  return ev;
}
const txt = id => document.getElementById(id).textContent;
const writes = () => CALLS.filter(c => c.op === 'insert' || c.op === 'update' || c.op === 'delete' || c.op === 'upsert');
async function login(email) {
  document.getElementById('loginEmail').value = email;
  document.getElementById('loginPassword').value = 'x';
  await doLogin();
  await sleep(400);
}

async function runTests() {
  L('=== คอนโซลร้าน desk.html · หมวดระยะที่ 2 ===');
  await login('owner@djlabsiam.com');
  ok('ล็อกอินเจ้าของร้านแล้วเข้าได้', document.getElementById('loginOverlay').style.display === 'none');
  ok('ไม่มีป้าย "เร็ว ๆ นี้" เหลือในเมนู', txt('navList').indexOf('เร็ว ๆ นี้') === -1);

  // ── 1. จองห้องซ้อม ────────────────────────────────────────────────────
  key('Digit6', '6', { altKey: true });
  ok('Alt+6 ไปหมวดจองห้องซ้อม', current === 'booking' && !document.getElementById('sec-booking').hidden, current);
  ok('ไทม์ไลน์วันนี้แสดงการจองของวันนี้ 2 รายการ', document.querySelectorAll('#bkTimeline .tl-block').length === 2,
    document.querySelectorAll('#bkTimeline .tl-block').length);
  ok('ตารางการจองแสดงครบ 3 รายการ', document.querySelectorAll('#bookingRows tr[data-i]').length === 3);
  ok('นับรอยืนยันได้ 2', txt('bkStatPending') === '2', txt('bkStatPending'));

  // ── เลขแดงข้างเมนู "จองห้อง" = ใบรอยืนยัน (ไม่ยืนยัน + ไม่ยกเลิก) · ตรงกับสถิติและไอคอนลัดหน้าแรก · ขยับเองเมื่อ realtime แจ้งว่ามีใบเข้า/เปลี่ยน ──
  {
    const nb = () => document.getElementById('navBadge-booking');
    const launchN = () => LAUNCH_ITEMS.find(i => i.key === 'booking').badge();
    const same = n => !!nb() && nb().textContent === String(n) && launchN() === n && txt('bkStatPending') === String(n);
    ok('เมนู "จองห้อง" มีเลขแดง = ใบรอยืนยัน (2) ตรงกับสถิติและไอคอนลัดหน้าแรก · ไม่ซ่อน', !!nb() && !nb().hidden && same(2), nb() && nb().textContent + ' / ' + launchN() + ' / ' + txt('bkStatPending'));
    const cs = getComputedStyle(nb());
    ok('เลขแดงอ่านได้: พื้นแดงตัวขาวหนา ≥ 14px · มีคำกำกับให้โปรแกรมอ่านจอ "รอยืนยัน 2"', cs.backgroundColor === 'rgb(204, 0, 26)' && cs.color === 'rgb(255, 255, 255)' && parseInt(cs.fontWeight, 10) >= 700 && parseFloat(cs.fontSize) >= 14 && nb().getAttribute('aria-label') === 'รอยืนยัน 2', cs.backgroundColor + ' ' + cs.color + ' ' + cs.fontSize + ' ' + nb().getAttribute('aria-label'));
    ok('ปุ่มเมนู "จองห้อง" เป็นตัวที่มีเลขแดง (อยู่ในปุ่มเมนูหมวด booking)', nb().closest('.nav-item') && nb().closest('.nav-item').getAttribute('data-s') === 'booking');
    const rt = async () => { window.RT.room_bookings(); await sleep(300); };
    ok('มีตัวฟัง realtime ของ room_bookings อยู่จริง', typeof (window.RT && window.RT.room_bookings) === 'function');
    FAKE.room_bookings[0].confirmed = true; await rt();
    ok('พนักงานอีกเครื่องยืนยันใบหนึ่ง (realtime แจ้ง) → เลขลดเป็น 1 ทันที ไม่ต้องรีเฟรช', same(1), nb().textContent);
    FAKE.room_bookings.push({ id: 'rt1', customer_name: 'ใบเว็บเข้าใหม่', contact: '0800000009', date: TODAY, start_time: '21:00:00', hours: 1, room: 'Controller Setup', cost: 800, status: 'upcoming', confirmed: false, source: 'online_web', line_user_id: null, customer_id: null });
    await rt();
    ok('มีใบเว็บเข้าใหม่ (realtime แจ้ง) → เลขขึ้นเป็น 2 ทันที', same(2), nb().textContent);
    FAKE.room_bookings.push({ id: 'rt2', customer_name: 'ใบที่ถูกยกเลิก', contact: '0800000008', date: TODAY, start_time: '22:00:00', hours: 1, room: 'Controller Setup', cost: 800, status: 'cancelled', confirmed: false, source: 'online_web', line_user_id: null, customer_id: null });
    await rt();
    ok('ใบที่ยกเลิกแล้ว (ไม่ยืนยัน) ไม่นับ → ยัง 2', same(2), nb().textContent);
    FAKE.room_bookings.forEach(b => { b.confirmed = true; }); await rt();
    ok('ยืนยันครบหมด → เลขหายไป (ซ่อน · ข้อความว่าง · คำกำกับ "รอยืนยัน 0")', nb().hidden === true && nb().textContent === '' && nb().getAttribute('aria-label') === 'รอยืนยัน 0' && launchN() === 0, nb().hidden + ' [' + nb().textContent + ']');
    FAKE.room_bookings = FAKE.room_bookings.filter(b => b.id !== 'rt1' && b.id !== 'rt2');
    FAKE.room_bookings[0].confirmed = false; FAKE.room_bookings[1].confirmed = false; FAKE.room_bookings[2].confirmed = true;    // คืนข้อมูลตั้งต้น (b1 · b2 รอยืนยัน · b3 ยืนยันแล้ว)
    await rt();
    ok('(คืนสถานะ) กลับเป็น 2 ตามข้อมูลตั้งต้น เพื่อให้เทสต์ต่อไปเริ่มจากจุดเดิม', same(2) && document.querySelectorAll('#bkTimeline .tl-block').length === 2, nb().textContent);
  }

  openBooking('b1');
  ok('การจองผ่าน LINE ขึ้นแถบเขียว "ส่งข้อความทาง LINE อัตโนมัติ"',
    txt('detailBody').indexOf('ส่งข้อความแจ้งลูกค้าทาง LINE อัตโนมัติ') !== -1);
  openBooking('b2');
  ok('การจองที่ไม่มี LINE userId ขึ้นแถบเหลือง "ไม่มีช่องทาง LINE"',
    txt('detailBody').indexOf('ไม่มีช่องทาง LINE') !== -1);
  // b1 (13:00–15:00) ทับตารางสอน 14:00–16:00 ในข้อมูลทดสอบ → ยืนยันต้องกดสองรอบ (รอบแรกเตือน) · ไม่เขียนฐานจนกว่าจะกดรอบสอง
  openBooking('b1');
  CALLS.length = 0;
  document.getElementById('bkConfirmBtn').click();
  await sleep(300);
  ok('ใบที่ทับตารางสอน: กดยืนยันรอบแรกยังไม่เขียนฐาน (เตือนก่อน)', writes().length === 0, JSON.stringify(writes().map(c => c.table + ':' + c.op)));
  await sleep(700);
  document.getElementById('bkConfirmBtn').click();
  await sleep(300);
  const up = CALLS.find(c => c.op === 'update' && c.table === 'room_bookings');
  ok('ยืนยันการจองเขียน room_bookings.update ตรงแถว', !!up && up.where && up.where.col === 'id' && up.where.val === 'b1',
    JSON.stringify(up && { payload: up.payload, where: up.where }));
  ok('คอลัมน์ที่เขียนตอนยืนยัน = หน้าจองเดิมเป๊ะ (' + OLD_CONFIRM_KEYS.join(', ') + ')',
    !!up && JSON.stringify(Object.keys(up.payload).sort()) === JSON.stringify(OLD_CONFIRM_KEYS), up && Object.keys(up.payload).join(','));
  ok('ค่า confirmed = true และ confirmed_by = ผู้ที่ล็อกอิน', !!up && up.payload.confirmed === true && up.payload.confirmed_by === 'u1');
  ok('ไม่มีการเขียนอย่างอื่นพ่วงไปกับการยืนยัน', writes().length === 1, JSON.stringify(writes().map(c => c.table + ':' + c.op)));

  // ── ยืนยันใบที่ค้าง: เห็นคำเตือนซ้อน/ทับตารางสอนก่อน + ต้องกด "ยืนยันจองซ้อน" ซ้ำ (หัวหน้าตัดสิน 6 ต.ค. 69) ──
  {
    const el = id => document.getElementById(id);
    const upd = () => CALLS.filter(c => c.op === 'update' && c.table === 'room_bookings');
    const cbox = () => el('bkConfirmConflict'), btn = () => el('bkConfirmBtn');
    openBooking('b1');
    ok('เปิดใบ b1 (13:00–15:00 ทับตารางสอน 14:00–16:00): เห็นคำเตือนในแผงทันที · นับ 1 รายการ · ไม่นับตัวเอง · ปุ่มยังเป็น "✓ ยืนยันการจอง"',
      !!cbox() && cbox().textContent.indexOf('ซ้อนกับ 1 รายการ') !== -1 && cbox().textContent.indexOf('ทับตารางสอน (ห้องซ้อมถูกใช้สอน) 14:00–16:00') !== -1 && cbox().textContent.indexOf('ลูกค้า LINE') === -1 && btn().textContent === '✓ ยืนยันการจอง' && btn().classList.contains('btn-primary'), cbox() && cbox().textContent);
    const cs2 = getComputedStyle(cbox());
    ok('คำเตือนในแผง: แดงตัวหนา ≥ 14px · role=alert', cs2.color === 'rgb(138, 0, 18)' && parseInt(cs2.fontWeight, 10) >= 700 && parseFloat(cs2.fontSize) >= 14 && cbox().getAttribute('role') === 'alert', cs2.color + ' ' + cs2.fontWeight);
    openBooking('b2');
    ok('ใบ b2 (16:00–17:00 ติดกับตารางสอนที่จบ 16:00 พอดี) ไม่ซ้อน → ไม่มีกล่องเตือน', !cbox());
    CALLS.length = 0; btn().click(); await sleep(350);
    ok('ใบที่ไม่ซ้อนกดยืนยันรอบเดียวก็เขียน (พฤติกรรมเดิมไม่เปลี่ยน)', upd().length === 1 && upd()[0].where.val === 'b2', JSON.stringify(upd().map(u => u.where)));
    openBooking('b1'); CALLS.length = 0; btn().click(); await sleep(350);
    ok('b1 กดยืนยันรอบแรก: ไม่เขียนฐาน · ปุ่มเป็น "⚠️ ยืนยันจองซ้อน" (แดง) · แผงยังเปิดและมีคำเตือน · ขึ้นข้อความเตือน',
      upd().length === 0 && btn().textContent === '⚠️ ยืนยันจองซ้อน' && btn().classList.contains('btn-danger') && !!cbox() && detailOpen() && txt('toast').indexOf('ซ้อน') !== -1, upd().length + ' ' + btn().textContent);
    btn().click(); await sleep(150);
    ok('กดซ้ำเร็วเกิน (ดับเบิลคลิก) ไม่นับเป็นการยืนยัน', upd().length === 0);
    await sleep(700); btn().click(); await sleep(350);
    ok('กดยืนยันจองซ้อนซ้ำจริง → เขียนยืนยัน (ไม่บล็อก) ตรงแถว b1', upd().length === 1 && upd()[0].where.val === 'b1' && upd()[0].payload.confirmed === true, JSON.stringify(upd().map(u => u.where)));
    openBooking('b1'); CALLS.length = 0; btn().click(); await sleep(350);
    openBooking('b2'); openBooking('b1');
    ok('กดรอบแรกที่ b1 แล้วไปเปิดใบอื่นแล้วกลับมา → ปุ่มกลับเป็นขั้นแรก (ไม่ค้างสถานะยืนยัน)', btn().textContent === '✓ ยืนยันการจอง' && btn().classList.contains('btn-primary'), btn().textContent);
    CALLS.length = 0; openBooking('b2');
    ok('(เตรียม) b2 ไม่มีคำเตือนตอนเปิดแผง', !cbox());
    FAKE.room_blocks.push({ starts_at: TODAY + 'T09:30:00Z', ends_at: TODAY + 'T10:30:00Z', all_day: false });      // 16:30–17:30 เวลาไทย (ซิงก์เข้ามาหลังเปิดแผง)
    btn().click(); await sleep(350);
    ok('บอทซิงก์ตารางสอนใหม่ทับ b2 ระหว่างที่แผงเปิด → กดยืนยันแล้วเตือน (ไม่ยืนยันเงียบ ๆ)', upd().length === 0 && !!cbox() && cbox().textContent.indexOf('16:30–17:30') !== -1 && btn().textContent === '⚠️ ยืนยันจองซ้อน', upd().length + ' ' + btn().textContent);
    FAKE.room_blocks.pop(); await loadRoomBlocks(); bkConfAck = '';
    FAKE.room_bookings.push({ id: 'x1', customer_name: '<img src=x onerror=window.__xss3=1>', contact: '0800000007', date: TODAY, start_time: '16:30:00', hours: 1, room: 'Controller Setup', cost: 800, status: 'upcoming', confirmed: true, source: 'staff', line_user_id: null, customer_id: null });
    FAKE.room_bookings.push({ id: 'x2', customer_name: 'ใบยกเลิกซ้อน', contact: '0800000006', date: TODAY, start_time: '16:00:00', hours: 1, room: 'Controller Setup', cost: 800, status: 'cancelled', confirmed: true, source: 'staff', line_user_id: null, customer_id: null });
    await loadBookings(); openBooking('b2');
    ok('b2 ซ้อนกับ x1 (16:30–17:30 ยืนยันแล้ว): บอกชื่อ/ช่วง/สถานะ · ชื่อที่มีแท็กแสดงเป็นข้อความ · ใบยกเลิกซ้อนไม่นับ',
      !!cbox() && cbox().textContent.indexOf('ซ้อนกับ 1 รายการ') !== -1 && cbox().textContent.indexOf('16:30–17:30 (ยืนยันแล้ว)') !== -1 && !cbox().querySelector('img') && window.__xss3 === undefined && cbox().textContent.indexOf('ใบยกเลิกซ้อน') === -1, cbox() && cbox().textContent);
    FAKE.room_bookings = FAKE.room_bookings.filter(b => b.id !== 'x1' && b.id !== 'x2'); await loadBookings(); bkConfAck = '';
    openBooking('b3');
    ok('ใบที่ยืนยันแล้ว (b3): ไม่มีกล่องเตือนและไม่มีปุ่มยืนยัน', !cbox() && !btn());
    // ใบที่ยืนยันแล้วแต่ซ้อนกับใบอื่น (ยืนยันไปก่อนแล้ว): ไม่เตือนซ้ำ — คำเตือนมีไว้ก่อนกดยืนยันเท่านั้น
    FAKE.room_bookings.push({ id: 'x3', customer_name: 'ใบซ้อนใบประจำ', contact: '0800000005', date: '2026-09-01', start_time: '13:00:00', hours: 1, room: 'Controller Setup', cost: 800, status: 'upcoming', confirmed: true, source: 'staff', line_user_id: null, customer_id: null });
    await loadBookings(); openBooking('b3');
    ok('ใบที่ยืนยันแล้วและซ้อน x3 (b3 12:00–15:00 ซ้อน 13:00–14:00): ไม่มีกล่องเตือน', !cbox() && !btn());
    // ซ้อนสองรายการ: นับสอง · แจ้งครบทั้งสองบรรทัด · บอกวิธีทำต่อ
    FAKE.room_bookings.push({ id: 'x4', customer_name: 'ใบซ้อนก่อนหน้า', contact: '0800000004', date: TODAY, start_time: '13:00:00', hours: 1, room: 'Controller Setup', cost: 800, status: 'upcoming', confirmed: true, source: 'staff', line_user_id: null, customer_id: null });
    await loadBookings(); bkConfAck = ''; openBooking('b1');
    ok('b1 ซ้อน 2 รายการ (ใบ 13:00–14:00 + ตารางสอน 14:00–16:00): นับ 2 · แจ้งครบสองบรรทัด',
      !!cbox() && cbox().textContent.indexOf('ซ้อนกับ 2 รายการ') !== -1 && (cbox().textContent.match(/•/g) || []).length === 2 && cbox().textContent.indexOf('13:00–14:00') !== -1 && cbox().textContent.indexOf('14:00–16:00') !== -1, cbox() && cbox().textContent);
    ok('คำเตือนบอกวิธีทำต่อ: กดปุ่ม "ยืนยันจองซ้อน" ถ้าตั้งใจ', !!cbox() && cbox().textContent.indexOf('กดปุ่ม “ยืนยันจองซ้อน”') !== -1, cbox() && cbox().textContent);
    // ดับเบิลคลิกเร็วมาก: สองคลิกก่อนดึงข้อมูลรอบแรกเสร็จ ต้องไม่ลื่นไปยืนยันทั้งที่ยังไม่ได้เห็นคำเตือน
    CALLS.length = 0;
    btn().click(); btn().click(); await sleep(450);
    ok('สองคลิกติดกันก่อนดึงข้อมูลเสร็จ: ไม่เขียนฐาน · ปุ่มเป็นขั้น "⚠️ ยืนยันจองซ้อน"', upd().length === 0 && btn().textContent === '⚠️ ยืนยันจองซ้อน', upd().length + ' ' + btn().textContent);
    FAKE.room_bookings = FAKE.room_bookings.filter(b => b.id !== 'x3' && b.id !== 'x4'); await loadBookings(); bkConfAck = '';
    // ใบที่ถูกลบไปก่อนกดยืนยัน (แผงค้างอยู่): บอกตามจริง ไม่เขียนฐาน ไม่พัง
    FAKE.room_bookings.push({ id: 'x5', customer_name: 'ใบที่จะหายไป', contact: '0800000003', date: '2026-09-02', start_time: '12:00:00', hours: 1, room: 'Controller Setup', cost: 800, status: 'upcoming', confirmed: false, source: 'staff', line_user_id: null, customer_id: null });
    await loadBookings(); openBooking('x5');
    FAKE.room_bookings = FAKE.room_bookings.filter(b => b.id !== 'x5');
    CALLS.length = 0; el('toast').textContent = '';
    let threw5 = ''; try { await confirmBookingClick('x5'); } catch (e) { threw5 = String(e); }
    ok('ใบหายไปก่อนกดยืนยัน: ขึ้นข้อความ "ไม่พบการจองนี้" · ไม่เขียนฐาน · ฟังก์ชันไม่พัง', txt('toast').indexOf('ไม่พบการจองนี้') !== -1 && upd().length === 0 && threw5 === '', txt('toast') + ' ' + upd().length + ' ' + threw5);
    await sleep(100); await loadBookings();
  }

  CALLS.length = 0;
  openBookingForm();
  document.getElementById('bookName').value = 'ลูกค้าหน้าร้าน';
  document.getElementById('bookContact').value = '0811111111';
  document.getElementById('bookHours').value = '3';
  await submitBooking();
  const ins = CALLS.find(c => c.op === 'insert' && c.table === 'room_bookings');
  ok('จองใหม่จากคอนโซลเป็นแบบเดียวกับหน้าเดิม (staff, ยืนยันแล้ว, ราคาตามตั้งค่า)',
    !!ins && ins.payload.source === 'staff' && ins.payload.confirmed === true && ins.payload.cost === 2400 &&
    ins.payload.status === 'upcoming' && ins.payload.created_by === 'u1', JSON.stringify(ins && ins.payload));

  document.getElementById('tw-bookings').focus();
  const before = bkDate;
  key('ArrowRight', 'ArrowRight');
  ok('→ เลื่อนไทม์ไลน์ไปวันถัดไป', bkDate !== before && bkDate > before, before + ' → ' + bkDate);
  key('ArrowLeft', 'ArrowLeft');

  // ก้อนสั้นบนไทม์ไลน์ต้องยังอ่านได้: ข้อความเต็มใน title และบรรทัดแรกคือเวลา
  const blk = [...document.querySelectorAll('#bkTimeline .tl-block')].find(b => (b.title || '').indexOf('ลูกค้า LINE') !== -1);
  ok('ก้อนการจองมี title ครบทั้งชื่อและช่วงเวลา', !!blk && blk.title.indexOf('13:00–15:00') !== -1 && blk.title.indexOf('รอยืนยัน') !== -1,
    blk && blk.title);
  ok('บรรทัดแรกของก้อนคือเวลาเริ่ม (อย่างน้อยต้องเห็นเวลา)', !!blk && blk.querySelector('.tl-time').textContent.indexOf('13:00') === 0);
  ok('ข้อความในก้อนตัดท้ายด้วย … ไม่ตัดกลางตัวอักษร', !!blk &&
    [...blk.children].every(sp => getComputedStyle(sp).textOverflow === 'ellipsis' && getComputedStyle(sp).whiteSpace === 'nowrap'));

  // ── การจองที่ยืนยันแล้ว (รอเข้าใช้) = เขียว (เจ้าของสั่ง 6 ต.ค. 69): ก้อนไทม์ไลน์ + แถวตาราง · ยังมีคำกำกับ ไม่พึ่งสีอย่างเดียว · ตัวหนังสือคอนทราสต์ ≥ 4.5:1 ──
  // (เขียนโดยไม่ใช้แบ็กสแลช/แบ็กทิก/ดอลลาร์วงเล็บ เพราะอยู่ในสตริงเทมเพลตของไฟล์นี้)
  {
    const room = 'Standard (CDJ3000x + DJM-A9/V10/V5/S11/S7)';
    const mk = (id, name, hh, status, confirmed) => ({ id, customer_name: name, contact: '0800000000', date: TODAY, start_time: hh + ':00:00', hours: 1,
      room, cost: 800, status, confirmed, source: 'staff', line_user_id: null, customer_id: null });
    bookings.push(mk('g1', 'ใบเขียว', '18', 'upcoming', true), mk('g2', 'กำลังใช้ห้อง', '19', 'active', true),
      mk('g3', 'ใช้บริการแล้ว', '12', 'done', true), mk('g4', 'ยกเลิกแล้ว', '17', 'cancelled', true));
    renderBookings();
    const GREEN = 'rgb(232, 242, 235)', GREEN_LINE = 'rgb(31, 107, 58)', INK = 'rgb(15, 15, 15)', WHITE = 'rgb(255, 255, 255)';
    const css = (el, p) => getComputedStyle(el)[p];
    const num = s => (s.match(/[0-9.]+/g) || []).map(Number);
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = num(css(e, 'backgroundColor')); if (c.length === 3 || (c.length === 4 && c[3] > 0)) return c.slice(0, 3); } return [255, 255, 255]; };
    // คอนทราสต์ต่ำสุดของข้อความทุกชิ้นใน el เทียบพื้นจริง (ไล่หาพื้นขึ้นไปจากตัวข้อความเอง)
    const minContrast = el => { let m = 99; [el].concat([...el.querySelectorAll('*')]).forEach(e => {
      if ([...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) m = Math.min(m, ratio(num(css(e, 'color')).slice(0, 3), bgOf(e))); }); return m; };
    const blockOf = name => [...document.querySelectorAll('#bkTimeline .tl-block')].find(b => (b.title || '').indexOf(name) === 0);
    const rowOf = name => [...document.querySelectorAll('#bookingRows tr[data-i]')].find(r => r.querySelector('strong') && r.querySelector('strong').textContent === name);
    const g1 = blockOf('ใบเขียว'), g2 = blockOf('กำลังใช้ห้อง'), g3 = blockOf('ใช้บริการแล้ว'), g4 = blockOf('ยกเลิกแล้ว'), p1 = blockOf('ลูกค้า LINE'), p2 = blockOf('ลูกค้าเว็บ');

    ok('ก้อนไทม์ไลน์ที่ยืนยันแล้ว (รอเข้าใช้): พื้นเขียวอ่อน ขอบเขียวเข้ม',
      !!g1 && g1.classList.contains('confirmed') && css(g1, 'backgroundColor') === GREEN && css(g1, 'borderTopColor') === GREEN_LINE, g1 && css(g1, 'backgroundColor') + ' ' + css(g1, 'borderTopColor'));
    ok('ก้อนสีเขียวยังมีคำกำกับ: ✓ หน้าชื่อ · title และ aria-label บอก "ยืนยันแล้ว"',
      !!g1 && g1.textContent.indexOf('✓ ใบเขียว') !== -1 && g1.title.endsWith(' · ยืนยันแล้ว') && g1.getAttribute('aria-label').endsWith(' ยืนยันแล้ว'), g1 && g1.textContent);
    ok('ก้อนสีเขียว: ตัวหนังสือทุกชิ้นคอนทราสต์ ≥ 4.5:1 กับพื้น', !!g1 && minContrast(g1) >= 4.5, g1 && minContrast(g1));
    ok('มีก้อนเขียวเพียงก้อนเดียว (ยืนยันแล้ว + รอเข้าใช้) — ที่เหลือไม่เขียว', document.querySelectorAll('#bkTimeline .tl-block.confirmed').length === 1 &&
      [p1, p2, g2, g3, g4].every(b => !!b && !b.classList.contains('confirmed') && css(b, 'backgroundColor') !== GREEN));
    ok('สถานะอื่นคงสีเดิม: รอยืนยัน = เหลืองอ่อน · กำลังใช้ = ดำ · ใช้แล้ว = เทาอ่อน',
      css(p1, 'backgroundColor') === 'rgb(251, 241, 220)' && css(g2, 'backgroundColor') === INK && css(g3, 'backgroundColor') === 'rgb(250, 249, 246)',
      [p1, g2, g3].map(b => css(b, 'backgroundColor')).join(' | '));

    const r1 = rowOf('ใบเขียว');
    ok('แถวตารางที่ยืนยันแล้ว (รอเข้าใช้): พื้นเขียวอ่อน · แถบซ้ายเขียวเข้ม',
      !!r1 && r1.classList.contains('bk-confirmed') && css(r1, 'backgroundColor') === GREEN && css(r1.cells[0], 'boxShadow').indexOf(GREEN_LINE) !== -1, r1 && css(r1, 'backgroundColor') + ' ' + css(r1.cells[0], 'boxShadow'));
    ok('แถวเขียวยังมีคำ "ยืนยันแล้ว" (ป้ายเขียวพื้นขาว) และ "รอเข้าใช้" ครบ',
      !!r1 && r1.textContent.indexOf('✓ ยืนยันแล้ว') !== -1 && r1.textContent.indexOf('รอเข้าใช้') !== -1 && css(r1.querySelector('.st-ok'), 'backgroundColor') === WHITE, r1 && r1.textContent);
    ok('แถวเขียว: ตัวหนังสือทุกชิ้นคอนทราสต์ ≥ 4.5:1 กับพื้นจริง', !!r1 && minContrast(r1) >= 4.5, r1 && minContrast(r1));
    const rest = ['ลูกค้า LINE', 'ลูกค้าเว็บ', 'กำลังใช้ห้อง', 'ใช้บริการแล้ว', 'ยกเลิกแล้ว', 'ลูกค้าประจำ'].map(rowOf);
    ok('แถวอื่นไม่เขียว (รอยืนยัน 2 · กำลังใช้ · ใช้แล้ว 2 · ยกเลิก) และมีแถวเขียวแถวเดียว',
      rest.every(r => !!r && !r.classList.contains('bk-confirmed') && css(r, 'backgroundColor') !== GREEN) && document.querySelectorAll('#bookingRows tr.bk-confirmed').length === 1);
    ok('แถวรอยืนยันไม่มีป้าย "ยืนยันแล้ว" (เหลืองเท่านั้น)', [rest[0], rest[1]].every(r => r.textContent.indexOf('ยืนยันแล้ว') === -1 && r.textContent.indexOf('รอยืนยัน') !== -1));

    const idx = Number(r1.getAttribute('data-i'));
    selectRow('bookings', idx, true);
    const r1s = document.querySelectorAll('#bookingRows tr')[idx];
    ok('แถวเขียวที่ถูกเลือก: ยังเขียว · แถบซ้ายเปลี่ยนเป็นดำ (เห็นว่าเลือกอยู่)',
      r1s.classList.contains('sel') && css(r1s, 'backgroundColor') === GREEN && css(r1s.cells[0], 'boxShadow').indexOf(INK) !== -1 && css(r1s.cells[0], 'boxShadow').indexOf(GREEN_LINE) === -1, css(r1s, 'backgroundColor') + ' ' + css(r1s.cells[0], 'boxShadow'));
    renderBookingTable();    // วาดตารางใหม่ (เช่น พิมพ์ค้นหา) ต้องจำแถวที่เลือกไว้ — ทั้งคลาส sel และสีเขียว
    const r1r = document.querySelectorAll('#bookingRows tr')[Number(rowOf('ใบเขียว').getAttribute('data-i'))];
    ok('วาดตารางใหม่แล้ว แถวเขียวที่เลือกอยู่ยังถูกเลือก (sel) · ยังเขียว · แถบซ้ายดำ',
      r1r.classList.contains('sel') && r1r.classList.contains('bk-confirmed') && css(r1r, 'backgroundColor') === GREEN && css(r1r.cells[0], 'boxShadow').indexOf(INK) !== -1, r1r.className);
    const spec = sel => { const ids = (sel.match(/#[A-Za-z0-9_-]+/g) || []).length, cls = (sel.match(/[.][A-Za-z0-9_-]+|:[a-z-]+/g) || []).length, el = (sel.match(/(^|[ >+~])[a-z][a-z0-9]*/g) || []).length; return ids * 10000 + cls * 100 + el; };
    const rules = []; for (const ss of document.styleSheets) { try { for (const r of ss.cssRules) if (r.selectorText) rules.push(r); } catch (e) { /* ชีตข้ามโดเมน */ } }
    const greenRule = rules.find(r => r.selectorText === 'table.data tbody tr.bk-row.bk-confirmed');
    const hoverRule = rules.find(r => r.selectorText === 'table.data tbody tr:hover'), selRule = rules.find(r => r.selectorText === 'table.data tbody tr.sel');
    ok('พื้นเขียวของแถวชนะ tr:hover และ tr.sel ด้วยความเฉพาะเจาะจง (เมาส์ชี้/เลือกแล้วเขียวไม่หาย · ไม่ขึ้นกับลำดับบรรทัด)',
      !!greenRule && !!hoverRule && !!selRule && spec(greenRule.selectorText) > spec(hoverRule.selectorText) && spec(greenRule.selectorText) > spec(selRule.selectorText),
      [greenRule, hoverRule, selRule].map(r => r && spec(r.selectorText)).join(' / '));

    openBooking('g1');
    const dOnce = s => (document.getElementById('detailBody').innerHTML.match(/✓ ยืนยันแล้ว/g) || []).length === 1;
    ok('แผงรายละเอียดของใบเขียว: ป้าย "ยืนยันแล้ว" ขึ้นครั้งเดียว (ไม่ซ้ำ) · ไม่มีปุ่มยืนยัน', dOnce() && !document.getElementById('bkConfirmBtn'), document.getElementById('detailBody').innerHTML.length);
    openBooking('g3');
    ok('แผงรายละเอียดของใบที่ใช้แล้ว (ยืนยันแล้ว): ยังมีป้าย "ยืนยันแล้ว" ครั้งเดียวเหมือนเดิม', dOnce());
    ok('คำอธิบายสีใต้ไทม์ไลน์บอกว่า พื้นเขียว = ยืนยันแล้ว', [...document.querySelectorAll('p.hint')].some(p => p.textContent.indexOf('✓ พื้นเขียว = ยืนยันแล้ว') !== -1));

    bookings = bookings.filter(b => ['g1', 'g2', 'g3', 'g4'].indexOf(b.id) === -1);
    renderBookings();
    ok('เอาการจองทดสอบออกแล้ว ไม่มีแถว/ก้อนเขียวเหลือ', document.querySelectorAll('#bookingRows tr.bk-confirmed, #bkTimeline .tl-block.confirmed').length === 0);
  }

  // ── ข้อมูลของการจองที่มาจากเว็บ (migration 041): รหัสจอง · เบอร์ E.164 + ประเทศ · อีเมล · ภาษา · ที่มา · ล้างข้อมูลแล้ว + ค้นด้วยรหัสจอง ──
  // (ไม่ใช้แบ็กสแลช/แบ็กทิก/ดอลลาร์วงเล็บ เพราะอยู่ในสตริงเทมเพลตของไฟล์นี้)
  {
    const room = 'Standard (CDJ3000x + DJM-A9/V10/V5/S11/S7)';
    const EVIL = '<img src=x onerror=window.__xss=1>@mail.co';        // อีเมลที่ฐานรับได้ (ห้ามช่องว่าง/@ ซ้ำเท่านั้น) → ต้องแสดงเป็นข้อความ ไม่ใช่แท็ก
    const base = { room, hours: 1, cost: 800, line_user_id: null, customer_id: null };
    bookings.push(
      Object.assign({ id: 'w1', customer_name: 'ลูกค้าเว็บใหม่', contact: '+66812345678 · ' + EVIL, date: TODAY, start_time: '14:00:00', status: 'upcoming', confirmed: false, source: 'online_web',
        public_ref: 'DJ-ABCDE-FGHJK', contact_phone_e164: '+66812345678', contact_country: 'TH', contact_email: EVIL, contact_lang: 'en', entry_ref: 'instagram' }, base),
      Object.assign({ id: 'w2', customer_name: 'ลูกค้าออนไลน์ (ล้างข้อมูลแล้ว)', contact: null, date: '2025-01-10', start_time: '15:00:00', status: 'done', confirmed: true, source: 'online_line',
        public_ref: 'DJ-ZZZZZ-22222', contact_phone_e164: null, contact_country: null, contact_email: null, contact_lang: 'th', entry_ref: 'other', anonymized_at: '2026-03-01T18:30:00Z' }, base),
      Object.assign({ id: 'w3', customer_name: 'ลูกค้ามาจากที่ไม่รู้จัก', contact: '0800000001', date: TODAY, start_time: '17:00:00', status: 'upcoming', confirmed: true, source: 'online_web',
        public_ref: 'DJ-QQQQQ-33333', entry_ref: 'newsletter', contact_lang: 'fr' }, base),
      // เบอร์ต่างประเทศ: ช่องติดต่อเป็นข้อความอื่น (ไม่มีตัวเลขเบอร์) → ค้นเบอร์เจอได้จากคอลัมน์ contact_phone_e164 เท่านั้น
      Object.assign({ id: 'w4', customer_name: 'ลูกค้าต่างชาติ', contact: 'โทรหลัง 6 โมง', date: TODAY, start_time: '19:00:00', status: 'upcoming', confirmed: false, source: 'online_web',
        public_ref: 'DJ-MMMMM-44444', contact_phone_e164: '+14155550123', contact_country: 'US', contact_lang: 'en', entry_ref: 'tiktok' }, base));
    renderBookings();
    const kv = label => { const dt = [...document.querySelectorAll('#detailBody dt')].find(x => x.textContent === label); return dt ? dt.nextElementSibling.textContent : null; };
    const labels = () => [...document.querySelectorAll('#detailBody dt')].map(x => x.textContent);
    const names = () => [...document.querySelectorAll('#bookingRows tr[data-i] strong')].map(x => x.textContent);
    const search = v => { const el = document.getElementById('bkSearch'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); return names(); };
    const eq2 = (a, b) => JSON.stringify(a.slice().sort()) === JSON.stringify(b.slice().sort());

    openBooking('w1');
    ok('แผงรายละเอียดการจองเว็บ: รหัสจอง · เบอร์ E.164 พร้อมประเทศ · อีเมล · ภาษา · ลูกค้ามาจาก',
      kv('รหัสจอง') === 'DJ-ABCDE-FGHJK' && kv('เบอร์โทร') === '+66812345678 (TH)' && kv('อีเมล') === EVIL && kv('ภาษาลูกค้า') === 'English' && kv('ลูกค้ามาจาก') === 'Instagram',
      JSON.stringify(['รหัสจอง', 'เบอร์โทร', 'อีเมล', 'ภาษาลูกค้า', 'ลูกค้ามาจาก'].map(kv)));
    ok('อีเมลที่มีแท็ก/สคริปต์แสดงเป็นข้อความ ไม่กลายเป็นองค์ประกอบ (ไม่มี img · ไม่รันสคริปต์)', !document.querySelector('#detailBody img') && window.__xss === undefined && !document.querySelector('#bookingRows img'));
    ok('ช่องทางยังขึ้น "จองผ่านเว็บ" และแถว "ติดต่อ" เดิมยังอยู่', kv('ช่องทาง') === 'จองผ่านเว็บ' && kv('ติดต่อ') !== null);
    ok('ค่าที่ฐานไม่มีในรายการ (ที่มา/ภาษา) แสดงตามที่เก็บ ไม่ว่าง ไม่พัง', (openBooking('w3'), kv('ลูกค้ามาจาก') === 'newsletter' && kv('ภาษาลูกค้า') === 'fr'), kv('ลูกค้ามาจาก') + ' / ' + kv('ภาษาลูกค้า'));
    ok('ที่มาที่เป็นรายการอื่นของฐาน แปลเป็นชื่อ: other → อื่น ๆ', (openBooking('w2'), kv('ลูกค้ามาจาก') === 'อื่น ๆ' && kv('ภาษาลูกค้า') === 'ไทย'));
    ok('ป้ายที่มา = รายการปิดของฐาน 8 แบบ (ชื่อตามที่ตกลง) · ภาษา th/en',
      JSON.stringify(BK_ENTRY) === JSON.stringify({ instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', maps: 'Google Maps', website: 'เว็บไซต์ djlabsiam.com', line: 'LINE', other: 'อื่น ๆ' }) &&
      JSON.stringify(BK_LANG) === JSON.stringify({ th: 'ไทย', en: 'English' }));
    ok('ใบที่ล้างข้อมูลแล้ว: บอก "ล้างข้อมูลส่วนตัวแล้ว" พร้อมวันที่ไทย (เวลาไทย: 18:30 UTC = วันถัดไป) · ไม่มีเบอร์/อีเมล',
      kv('ข้อมูลส่วนตัว').indexOf('ล้างข้อมูลส่วนตัวแล้ว') !== -1 && kv('ข้อมูลส่วนตัว').indexOf('2 มี.ค.') !== -1 && labels().indexOf('เบอร์โทร') === -1 && labels().indexOf('อีเมล') === -1, kv('ข้อมูลส่วนตัว'));
    openBooking('b3');
    ok('การจองที่พนักงานบันทึก/หน้าเดิม (ไม่มีข้อมูลเว็บ): ไม่โผล่แถวรหัสจอง/เบอร์/อีเมล/ภาษา/ที่มา/ข้อมูลส่วนตัว',
      ['รหัสจอง', 'เบอร์โทร', 'อีเมล', 'ภาษาลูกค้า', 'ลูกค้ามาจาก', 'ข้อมูลส่วนตัว'].every(l => labels().indexOf(l) === -1), labels().join());

    const cell = name => [...document.querySelectorAll('#bookingRows tr[data-i]')].find(r => r.querySelector('strong').textContent === name).cells[2];
    ok('ตาราง: ใต้ชื่อมีรหัสจอง (ตัวเล็กแบบ sub) เฉพาะใบที่มีรหัส', cell('ลูกค้าเว็บใหม่').querySelector('.sub').textContent === 'DJ-ABCDE-FGHJK' && !cell('ลูกค้าประจำ').querySelector('.sub') && !cell('ลูกค้า LINE').querySelector('.sub'));
    ok('ช่องค้นหาบอกว่าค้นด้วยรหัสจองได้', document.getElementById('bkSearch').placeholder.indexOf('รหัสจอง') !== -1, document.getElementById('bkSearch').placeholder);

    const only = list => list.length === 1 && list[0] === 'ลูกค้าเว็บใหม่';
    ok('ค้นด้วยรหัสเต็ม DJ-ABCDE-FGHJK → เจอใบนั้นใบเดียว', only(search('DJ-ABCDE-FGHJK')), search('DJ-ABCDE-FGHJK').join());
    ok('ค้นด้วยรหัสตัวพิมพ์เล็ก dj-abcde-fghjk → เจอ', only(search('dj-abcde-fghjk')));
    ok('ค้นด้วยรหัสที่ไม่มี DJ- และไม่มีขีด (abcdefghjk) → เจอ', only(search('abcdefghjk')));
    ok('ค้นด้วยรหัสที่ลูกค้าพิมพ์เว้นวรรค (" DJ ABCDE FGHJK ") → เจอ', only(search(' DJ ABCDE FGHJK ')));
    ok('ค้นด้วยบางส่วนของรหัส (fghjk · 5 ตัว) → เจอ', only(search('fghjk')));
    ok('ค้นด้วยบางส่วนที่สั้นเกิน (abc · 3 ตัว) → ไม่ไปชนรหัส ไม่เจออะไร', search('abc').length === 0, search('abc').join());
    ok('ค้นด้วยรหัสของใบที่ล้างข้อมูลแล้ว → เจอใบนั้น (ใช้ตามเรื่องกับลูกค้าที่ถามย้อนหลัง)', (() => { const r = search('ZZZZZ-22222'); return r.length === 1 && r[0] === 'ลูกค้าออนไลน์ (ล้างข้อมูลแล้ว)'; })());
    ok('ค้นรหัสที่ไม่มีอยู่ → ไม่เจอ แสดงข้อความว่าไม่พบ', search('DJ-NNNNN-NNNNN').length === 0 && document.getElementById('bookingRows').textContent.indexOf('ไม่พบการจอง') !== -1);
    ok('ค้นแบบเดิมยังใช้ได้: ชื่อ (ลูกค้าเว็บ → 2 ใบ) · ข้อมูลติดต่อ · อีเมลที่อยู่ในช่องติดต่อ',
      eq2(search('ลูกค้าเว็บ'), ['ลูกค้าเว็บใหม่', 'ลูกค้าเว็บ']) && search('0800000001').join() === 'ลูกค้ามาจากที่ไม่รู้จัก' && only(search('@mail.co')), search('ลูกค้าเว็บ').join());
    // ค้นเบอร์: พนักงานพิมพ์แบบไทย แต่ฐานเก็บ E.164 (+66…)
    const has = (list, n) => list.indexOf(n) !== -1;
    ok('ค้นเบอร์แบบไทย 0812345678 → เจอใบเว็บ (+66812345678) ด้วย พร้อมใบที่เก็บเบอร์ท้องถิ่นไว้ในช่องติดต่อ · ไม่เจอเบอร์อื่น',
      (() => { const r = search('0812345678'); return has(r, 'ลูกค้าเว็บใหม่') && has(r, 'ลูกค้า LINE') && has(r, 'ลูกค้าประจำ') && !has(r, 'ลูกค้าเว็บ') && !has(r, 'ลูกค้าต่างชาติ'); })(), search('0812345678').join());
    ok('ค้นเบอร์มีขีด/วงเล็บ/เว้นวรรค และแบบสากล (081-234-5678 · (081) 234 5678 · 81 234 5678 · +66 81 234 5678 · 66812345678 · 812345678) → เจอใบเว็บ',
      ['081-234-5678', '(081) 234 5678', '81 234 5678', '+66 81 234 5678', '66812345678', '812345678'].every(q => has(search(q), 'ลูกค้าเว็บใหม่')),
      ['081-234-5678', '(081) 234 5678', '81 234 5678', '+66 81 234 5678', '66812345678', '812345678'].filter(q => !has(search(q), 'ลูกค้าเว็บใหม่')).join(' | '));
    ok('ค้นบางส่วนของเบอร์: 08123 (เลขที่เทียบ 4 ตัว) → เจอ · 0812 (เทียบได้ 3 ตัว) → ไม่เดาเบอร์ของใบเว็บ',
      has(search('08123'), 'ลูกค้าเว็บใหม่') && !has(search('0812'), 'ลูกค้าเว็บใหม่'));
    ok('เบอร์ต่างเลขท้าย (0812345679) หรือต่างเลขหน้า (9812345678 · 1812345678) ไม่เจอใบเว็บ · เบอร์อื่น (0899999999) เจอเฉพาะใบของเขา',
      ['0812345679', '9812345678', '1812345678'].every(q => !has(search(q), 'ลูกค้าเว็บใหม่')) && search('0899999999').join() === 'ลูกค้าเว็บ');
    ok('ข้อความที่ปนตัวอักษร (x812345678) ไม่นับเป็นเบอร์ → ไม่ไปเจอใบเว็บ', !has(search('x812345678'), 'ลูกค้าเว็บใหม่'));
    ok('เบอร์ต่างประเทศ (4155550123 · +1 (415) 555-0123) → เจอใบนั้นใบเดียว แม้ช่องติดต่อไม่มีเลขเบอร์',
      search('4155550123').join() === 'ลูกค้าต่างชาติ' && search('+1 (415) 555-0123').join() === 'ลูกค้าต่างชาติ', search('4155550123').join());
    search('');
    ok('ล้างช่องค้นหาแล้วเห็นครบทุกใบอีกครั้ง (7 ใบ)', names().length === 7, names().length);

    bookings = bookings.filter(b => ['w1', 'w2', 'w3', 'w4'].indexOf(b.id) === -1);
    renderBookings();
    ok('เอาการจองทดสอบออกแล้ว ไม่เหลือรหัสจองในตาราง', document.querySelectorAll('#bookingRows tr[data-i] td:nth-child(3) .sub').length === 0 && names().length === 3, names().length);
  }

  // ── พนักงานลงจองที่ซ้อนใบอื่น/ทับตารางสอน: เตือนชัด + ต้องกด "ยืนยันจองซ้อน" ซ้ำถึงบันทึก (ไม่บล็อก) ──
  // กติกาซ้อนเหมือนฐาน: ห้องเดียว · ทุกที่มา/ทุก Setup · รวมที่ยังไม่ยืนยัน · ไม่นับยกเลิก · ติดกันพอดีไม่ซ้อน · ตารางสอนแปลงเวลาไทยจาก UTC
  // (ไม่ใช้แบ็กสแลช/แบ็กทิก/ดอลลาร์วงเล็บ เพราะอยู่ในสตริงเทมเพลตของไฟล์นี้)
  {
    const el = id => document.getElementById(id);
    const setF = (t, h, d) => { el('bookDate').value = d || TODAY; el('bookTime').value = t; el('bookHours').value = String(h); el('bookDate').dispatchEvent(new Event('input', { bubbles: true })); };
    const fill = () => { el('bookName').value = 'ลูกค้าซ้อนทดสอบ'; el('bookContact').value = '0811110000'; };
    const warn = () => { const b = el('bookConflict'); return b.hidden ? null : b.textContent; };
    const inserts = () => CALLS.filter(c => c.op === 'insert' && c.table === 'room_bookings');
    const click = async ms => { el('bookSaveBtn').click(); await sleep(ms || 250); };
    const room = 'Standard (CDJ3000x + DJM-A9/V10/V5/S11/S7)';
    const mk = (id, name, hh, hrs, status, confirmed, date) => ({ id, customer_name: name, contact: '0800000000', date: date || TODAY, start_time: String(hh).padStart(2, '0') + ':00:00', hours: hrs, room, cost: 800, status, confirmed, source: 'staff', line_user_id: null, customer_id: null });
    const addBk = b => { FAKE.room_bookings.push(b); bookings.push(b); };
    const dropBk = ids => { FAKE.room_bookings = FAKE.room_bookings.filter(b => ids.indexOf(b.id) === -1); bookings = bookings.filter(b => ids.indexOf(b.id) === -1); };

    openBookingForm(); await sleep(200);
    ok('เปิดฟอร์มจอง: ปุ่มบันทึกยังเป็น "ยืนยันการจอง" · ไม่มีคำเตือน (10:00 วันนี้ไม่ซ้อน)', warn() === null && el('bookSaveBtn').textContent === 'ยืนยันการจอง', warn() + ' / ' + el('bookSaveBtn').textContent);
    setF('18:00', 1); ok('18:00 ชั่วโมงเดียว ไม่ซ้อนอะไร → ไม่มีคำเตือน', warn() === null);
    setF('14:00', 1);
    const w = warn();
    ok('14:00 ซ้อนทั้งการจอง (ลูกค้า LINE 13:00–15:00 รอยืนยัน) และตารางสอน (14:00–16:00 เวลาไทย แปลงจาก UTC) → บอกครบ 2 รายการ',
      !!w && w.indexOf('ซ้อนกับ 2 รายการ') !== -1 && w.indexOf('ซ้อนกับการจองของ ลูกค้า LINE 13:00–15:00 (รอยืนยัน)') !== -1 && w.indexOf('ทับตารางสอน (ห้องซ้อมถูกใช้สอน) 14:00–16:00') !== -1, w);
    const cs = getComputedStyle(el('bookConflict'));
    ok('คำเตือนเป็นแดงตัวหนา (ข้อความล้วน ไม่พึ่งสีอย่างเดียว) ≥ 14px · มี role=alert', parseInt(cs.fontWeight, 10) >= 700 && cs.color === 'rgb(138, 0, 18)' && parseFloat(cs.fontSize) >= 14 && el('bookConflict').getAttribute('role') === 'alert', cs.fontWeight + ' ' + cs.color + ' ' + cs.fontSize);
    ok('คำเตือนบอกวิธีทำต่อ: กด "ยืนยันจองซ้อน" อีกครั้งถ้าตั้งใจ', w.indexOf('ยืนยันจองซ้อน') !== -1 && w.indexOf('ห้องซ้อมมีห้องเดียว') !== -1);
    // ขอบ: ติดกันพอดีไม่ซ้อน · ซ้อนบางส่วนซ้อน
    const kinds = (t, h) => { setF(t, h); const x = warn(); return x === null ? 'ไม่ซ้อน' : (x.indexOf('ซ้อนกับการจอง') !== -1 ? 'จอง' : '') + (x.indexOf('ทับตารางสอน') !== -1 ? 'สอน' : ''); };
    ok('12:00–13:00 ไม่ซ้อน (ติดกับ b1 ที่เริ่ม 13:00 พอดี)', kinds('12:00', 1) === 'ไม่ซ้อน', kinds('12:00', 1));
    ok('12:00 สองชั่วโมง (12–14) ซ้อน b1 อย่างเดียว (ตารางสอนเริ่ม 14:00 พอดีไม่ซ้อน)', kinds('12:00', 2) === 'จอง', kinds('12:00', 2));
    ok('15:00–16:00 ทับตารางสอนอย่างเดียว (b1 จบ 15:00 พอดี · b2 เริ่ม 16:00 พอดี)', kinds('15:00', 1) === 'สอน', kinds('15:00', 1));
    ok('16:00–17:00 ซ้อน b2 อย่างเดียว (ตารางสอนจบ 16:00 พอดี)', kinds('16:00', 1) === 'จอง', kinds('16:00', 1));
    ok('16:30–17:30 ซ้อน b2 (ซ้อนบางส่วน) · 17:00–18:00 ไม่ซ้อน (b2 จบ 17:00 พอดี)', kinds('16:30', 1) === 'จอง' && kinds('17:00', 1) === 'ไม่ซ้อน');
    // สถานะของใบที่ซ้อน: ยกเลิก = ไม่นับ · ใช้แล้ว/ยืนยันแล้ว = นับ · ชื่อที่มีแท็ก = ข้อความ
    addBk(mk('c1', 'ยกเลิกแล้ว', 19, 2, 'cancelled', true)); addBk(mk('c2', 'ใช้ไปแล้ว', 8, 1, 'done', true)); addBk(mk('c3', 'ยืนยันแล้วคนนี้', 10, 1, 'upcoming', true));
    addBk(mk('c4', '<img src=x onerror=window.__xss2=1>', 22, 1, 'upcoming', false)); addBk(mk('c5', 'กำลังใช้อยู่', 6, 1, 'active', true));
    ok('ใบที่ยกเลิกไม่นับ: 19:30 ไม่ซ้อนกับใบ 19:00–21:00 ที่ยกเลิก', kinds('19:30', 1) === 'ไม่ซ้อน');
    ok('ใบที่ใช้บริการแล้ว / ยืนยันแล้ว ยังนับ (ห้องถูกใช้จริง): บอกสถานะในวงเล็บ', (setF('08:30', 1), warn().indexOf('ใช้ไปแล้ว 08:00–09:00 (ใช้บริการแล้ว)') !== -1) && (setF('10:30', 1), warn().indexOf('ยืนยันแล้วคนนี้ 10:00–11:00 (ยืนยันแล้ว)') !== -1), warn());
    ok('ใบที่กำลังใช้งานอยู่ก็นับ: บอก (กำลังใช้งาน)', (setF('06:30', 1), warn() !== null && warn().indexOf('กำลังใช้อยู่ 06:00–07:00 (กำลังใช้งาน)') !== -1), warn());
    setF('22:00', 1);
    ok('ชื่อที่มีแท็ก/สคริปต์แสดงเป็นข้อความ ไม่กลายเป็นองค์ประกอบ', !el('bookConflict').querySelector('img') && window.__xss2 === undefined && warn().indexOf('<img src=x') !== -1, warn());
    const tom = shiftDateStr(TODAY, 1), tom2 = shiftDateStr(TODAY, 2);
    FAKE.room_blocks.push({ starts_at: tom + 'T00:00:00+07:00', ends_at: tom2 + 'T00:00:00+07:00', all_day: true }); await loadRoomBlocks();
    setF('13:00', 1, tom);
    ok('นัดทั้งวัน (all_day) ทับทั้งวัน: บอก "ทั้งวัน" แทนช่วงเวลา', warn() !== null && warn().indexOf('ทับตารางสอน (ห้องซ้อมถูกใช้สอน) ทั้งวัน') !== -1, warn());
    FAKE.room_blocks.pop(); await loadRoomBlocks();
    dropBk(['c1', 'c2', 'c3', 'c4', 'c5']);

    // ขั้นบันทึก: กดครั้งแรกไม่บันทึก ต้องกดซ้ำ
    CALLS.length = 0; fill(); setF('14:00', 1);
    await click(250);
    ok('ซ้อนแล้วกดบันทึกครั้งแรก: ไม่บันทึก · ปุ่มเปลี่ยนเป็น "⚠️ ยืนยันจองซ้อน" (แดง) · ฟอร์มยังเปิด · มีข้อความเตือน',
      inserts().length === 0 && el('bookSaveBtn').textContent === '⚠️ ยืนยันจองซ้อน' && el('bookSaveBtn').classList.contains('btn-danger') && el('bookingDialog').open && txt('toast').indexOf('ซ้อน') !== -1, inserts().length + ' ' + el('bookSaveBtn').textContent);
    await click(60);
    ok('กดซ้ำเร็วเกินไป (ดับเบิลคลิก) ไม่นับเป็นการยืนยัน', inserts().length === 0 && el('bookingDialog').open);
    await sleep(700); await click(300);
    const ins1 = inserts()[0];
    ok('กดยืนยันจองซ้อนซ้ำจริง → บันทึก (ไม่บล็อก): ข้อมูลเหมือนการจองปกติ (14:00 · 1 ชม. · staff · ยืนยันแล้ว) · ฟอร์มปิด',
      inserts().length === 1 && ins1.payload.start_time === '14:00' && ins1.payload.date === TODAY && ins1.payload.hours === 1 && ins1.payload.source === 'staff' && ins1.payload.confirmed === true && !el('bookingDialog').open, JSON.stringify(ins1 && ins1.payload));
    openBookingForm(); await sleep(200);
    ok('เปิดฟอร์มใหม่: ปุ่มกลับเป็น "ยืนยันการจอง" ปกติ (ไม่ค้างสถานะยืนยันซ้อนของรอบก่อน)', el('bookSaveBtn').textContent === 'ยืนยันการจอง' && !el('bookSaveBtn').classList.contains('btn-danger') && el('bookSaveBtn').classList.contains('btn-primary'));
    // เปลี่ยนเวลาหลังเตือน = เป็นการจองใหม่ ยืนยันใหม่
    CALLS.length = 0; fill(); setF('14:00', 1); await click(250);
    ok('(เตรียม) ซ้อนแล้วกดครั้งแรกได้ปุ่มยืนยัน', el('bookSaveBtn').textContent === '⚠️ ยืนยันจองซ้อน' && inserts().length === 0);
    setF('18:00', 1);
    ok('เปลี่ยนเวลาไปช่วงที่ไม่ซ้อน: คำเตือนหาย · ปุ่มกลับเป็นปกติ', warn() === null && el('bookSaveBtn').textContent === 'ยืนยันการจอง' && el('bookSaveBtn').classList.contains('btn-primary'));
    await click(300);
    ok('แล้วกดบันทึกครั้งเดียวก็บันทึก (ไม่ซ้อนแล้ว) ที่ 18:00', inserts().length === 1 && inserts()[0].payload.start_time === '18:00', inserts().length + ' ' + (inserts()[0] && inserts()[0].payload.start_time));
    // ซ้อนแล้วค่อยเปลี่ยนไปซ้อนอีกช่วง: ต้องยืนยันใหม่ (ไม่ยืนยันข้ามช่วง)
    openBookingForm(); await sleep(200); CALLS.length = 0; fill(); setF('14:00', 1); await click(250); setF('16:00', 1);
    ok('ยืนยันซ้อนช่วงหนึ่งแล้วย้ายไปซ้อนอีกช่วง → ต้องเห็นคำเตือนและยืนยันใหม่ (ปุ่มกลับเป็นขั้นแรก)', warn() !== null && el('bookSaveBtn').textContent === 'ยืนยันการจอง', warn() + ' / ' + el('bookSaveBtn').textContent);
    // ใบที่เข้ามาระหว่างฟอร์มเปิดอยู่ ต้องเจอตอนกดบันทึก (ดึงข้อมูลล่าสุดก่อนตัดสิน)
    openBookingForm(); await sleep(200); CALLS.length = 0; fill(); setF('18:30', 1);
    ok('(เตรียม) ตอนเปิดฟอร์ม 18:30 ยังไม่ซ้อน', warn() === null);
    FAKE.room_bookings.push(mk('late1', 'ใบมาทีหลัง', 18, 2, 'upcoming', false));
    await click(300);
    ok('มีใบเว็บเข้ามา 18:00–20:00 ระหว่างที่ฟอร์มเปิด → กดบันทึกแล้วเตือน (ไม่บันทึกทับเงียบ ๆ)', inserts().length === 0 && warn() !== null && warn().indexOf('ใบมาทีหลัง') !== -1 && el('bookSaveBtn').textContent === '⚠️ ยืนยันจองซ้อน', inserts().length + ' ' + warn());
    dropBk(['late1']); el('bookingDialog').close();
    // ตารางสอนใหม่ที่ซิงก์เข้ามาระหว่างที่ฟอร์มเปิดอยู่ ก็ต้องเจอตอนกดบันทึก
    openBookingForm(); await sleep(200); CALLS.length = 0; fill(); setF('20:30', 1);
    ok('(เตรียม) ตอนเปิดฟอร์ม 20:30 ยังไม่ทับตารางสอน', warn() === null);
    FAKE.room_blocks.push({ starts_at: TODAY + 'T13:00:00Z', ends_at: TODAY + 'T14:00:00Z', all_day: false });      // 20:00–21:00 เวลาไทย
    await click(300);
    ok('บอทซิงก์ตารางสอน 20:00–21:00 เข้ามาระหว่างที่ฟอร์มเปิด → กดบันทึกแล้วเตือนทับตารางสอน (ไม่บันทึกทับเงียบ ๆ)', inserts().length === 0 && warn() !== null && warn().indexOf('ทับตารางสอน (ห้องซ้อมถูกใช้สอน) 20:00–21:00') !== -1, inserts().length + ' ' + warn());
    FAKE.room_blocks.pop(); await loadRoomBlocks(); el('bookingDialog').close();
    // คำเตือนตามทุกช่องที่เปลี่ยน (เปลี่ยนทีละช่อง: ชั่วโมงอย่างเดียว · เวลาอย่างเดียว)
    openBookingForm(); await sleep(200); setF('12:00', 1);
    ok('(เตรียม) 12:00 หนึ่งชั่วโมง ไม่ซ้อน', warn() === null);
    el('bookHours').value = '2'; el('bookHours').dispatchEvent(new Event('change', { bubbles: true }));
    ok('เปลี่ยนเฉพาะจำนวนชั่วโมงเป็น 2 (12–14 ซ้อน b1) → คำเตือนขึ้นทันที', warn() !== null && warn().indexOf('ลูกค้า LINE') !== -1, warn());
    el('bookTime').value = '17:00'; el('bookTime').dispatchEvent(new Event('input', { bubbles: true }));
    ok('เปลี่ยนเฉพาะเวลาเริ่มเป็น 17:00 (17–19 ไม่ซ้อน) → คำเตือนหายทันที', warn() === null, warn());
    el('bookingDialog').close();
    // ยังไม่รัน 041 / อ่านตารางสอนไม่ได้
    window.BLOCKS_ERR = true; openBookingForm(); await sleep(200); setF('14:00', 1);
    ok('อ่านตารางสอนไม่ได้ (ยังไม่รัน 041): ไม่ขึ้นแถบแดง · ยังเตือนซ้อนกับการจองได้ · ไม่มีบรรทัดตารางสอน',
      !document.getElementById('fatalError') && warn() !== null && warn().indexOf('ซ้อนกับการจองของ ลูกค้า LINE') !== -1 && warn().indexOf('ทับตารางสอน') === -1, warn() + ' / fatal=' + !!document.getElementById('fatalError'));
    window.BLOCKS_ERR = false; await loadRoomBlocks(); el('bookingDialog').close();
  }

  // ── ย้อนกลับระหว่างหมวด ────────────────────────────────────────────────
  showSection('products');
  showSection('booking');
  ok('เปลี่ยนหมวดแล้ว URL เป็น #booking', location.hash === '#booking', location.hash);
  ok('มีหมวดก่อนหน้า ปุ่มย้อนกลับกดได้', !document.getElementById('backBtn').disabled);
  document.getElementById('backBtn').click();
  await sleep(150);
  ok('ปุ่ม ← ย้อนกลับ พากลับไปหมวดก่อนหน้า', current === 'products' && location.hash === '#stock', current + ' ' + location.hash);
  key('ArrowRight', 'ArrowRight', { altKey: true });
  await sleep(150);
  ok('Alt+→ ไปข้างหน้ากลับมาหมวดจองห้อง', current === 'booking', current);
  document.getElementById('tw-bookings').focus();
  const dayBefore = bkDate;
  const altLeft = key('ArrowLeft', 'ArrowLeft', { altKey: true });
  await sleep(150);
  ok('Alt+← ในหมวดจองห้องพากลับหมวดก่อนหน้า', current === 'products', current);
  ok('Alt+← ไม่ไปเลื่อนวันที่ของไทม์ไลน์', bkDate === dayBefore, dayBefore + ' → ' + bkDate);
  ok('Alt+← ถูกกันไม่ให้เบราว์เซอร์ย้อนซ้ำอีกรอบ', altLeft.defaultPrevented);
  showSection('booking');

  // ── 2. ลูกค้า ──────────────────────────────────────────────────────────
  ok('เบอร์ 9 หลักขึ้นต้น 8 เติม 0 กลับ', normalizeThaiPhone('812345678') === '0812345678', normalizeThaiPhone('812345678'));
  ok('เบอร์ 9 หลักขึ้นต้น 6 เติม 0 กลับ', normalizeThaiPhone('612345678') === '0612345678');
  ok('เบอร์ 9 หลักขึ้นต้น 9 เติม 0 กลับ', normalizeThaiPhone('912345678') === '0912345678');
  ok('+66 แปลงเป็น 0', normalizeThaiPhone('+66 81 234 5678') === '0812345678', normalizeThaiPhone('+66 81 234 5678'));
  ok('เบอร์บ้าน 9 หลัก (ขึ้นต้น 0) ไม่ถูกแตะ', normalizeThaiPhone('021234567') === '021234567');

  showSection('customers');
  ok('ตารางลูกค้าแสดงจากฐานข้อมูล', document.querySelectorAll('#customerRows tr[data-i]').length === 1);
  CALLS.length = 0;
  await openCustomer('c1');
  const look = CALLS.find(c => c.op === 'contains' && c.table === 'members');
  ok('เช็คสมาชิกด้วยเบอร์ที่เติม 0 แล้ว', !!look && look.val[0] === '0812345678', JSON.stringify(look));
  ok('รายละเอียดลูกค้าแสดงชั่วโมงสะสมจากการจองที่เบอร์ตรงกัน', txt('detailBody').indexOf('3 ชม.') !== -1);
  ok('เจ้าของร้านเห็นปุ่มลบลูกค้า', /ลบลูกค้า/.test(txt('detailBody')));
  ok('ทะเบียนสมาชิกไม่มีปุ่มแก้ไข (อ่านอย่างเดียว)',
    ![...document.querySelectorAll('#sec-customers .card button')].some(b => /แก้ไข|บันทึก/.test(b.textContent)));

  CALLS.length = 0;
  showSection('pos');
  openCustomerForm(null, true);
  document.getElementById('cfName').value = 'ลูกค้าใหม่หน้าเคาน์เตอร์';
  document.getElementById('cfPhone').value = '0822222222';
  await saveCustomer();
  await sleep(100);
  const ci = CALLS.find(c => c.op === 'insert' && c.table === 'customers');
  ok('เพิ่มลูกค้าใหม่จากหน้าขาย บันทึกพร้อม created_by', !!ci && ci.payload.created_by === 'u1' && ci.payload.full_name === 'ลูกค้าใหม่หน้าเคาน์เตอร์');
  ok('ลูกค้าที่เพิ่งเพิ่มถูกเลือกในบิลทันที', !!selectedCustomer && selectedCustomer.full_name === 'ลูกค้าใหม่หน้าเคาน์เตอร์');

  // ── 3. สรุปรายวัน ─────────────────────────────────────────────────────
  showSection('daily');
  await sleep(200);
  ok('รายรับรวมจาก v_daily_income = 2,690.00', txt('sumIncome') === formatMoney(2690), txt('sumIncome'));
  ok('รายจ่ายรวม = 200.00', txt('sumExpense') === formatMoney(200), txt('sumExpense'));
  ok('คงเหลือสุทธิ = 2,490.00', txt('sumNet') === formatMoney(2490), txt('sumNet'));
  ok('แยกตามวิธีชำระ: ไม่ระบุ 1,600 (ค่าห้อง)', txt('paymentBreakdown').indexOf('ไม่ระบุ' + formatMoney(1600)) !== -1, txt('paymentBreakdown'));
  const incomeBtns = [...document.querySelectorAll('#incomeTableBody button')].map(b => b.textContent);
  ok('แก้/ลบได้เฉพาะรายรับที่กรอกมือ (1 แถว)', incomeBtns.length === 2, incomeBtns.join('|'));

  // ── 4. บันทึกการใช้งาน ────────────────────────────────────────────────
  key('Digit9', '9', { altKey: true });
  await sleep(200);
  ok('เจ้าของร้านเปิดบันทึกการใช้งานได้ (Alt+9)', current === 'activity', current);
  ok('แสดงบันทึก 2 รายการ', document.querySelectorAll('#activityRows tr[data-i]').length === 2);
  CALLS.length = 0;
  document.getElementById('tw-activity').focus();
  key('ArrowDown', 'ArrowDown'); key('Enter', 'Enter');
  ok('เปิดรายละเอียดแสดงค่าเดิม → ค่าใหม่', txt('detailBody').indexOf('12,500.00 บาท') !== -1 && txt('detailBody').indexOf('12,900.00 บาท') !== -1,
    txt('detailBody'));
  const actBtns = [...document.querySelectorAll('#sec-activity button, #detailBody button')].map(b => b.textContent)
    .filter(t => /แก้|ลบ|บันทึก|เพิ่ม(?!อีก)/.test(t));
  ok('หมวดบันทึกการใช้งานไม่มีปุ่มแก้/ลบ/บันทึก/เพิ่ม', actBtns.length === 0, actBtns.join('|'));
  ok('ไม่มีการเขียนฐานข้อมูลระหว่างดูบันทึก', writes().length === 0);

  // ── 5. จัดการข้อมูล ───────────────────────────────────────────────────
  key('Digit0', '0', { altKey: true });
  await sleep(200);
  ok('Alt+0 ไปหมวดจัดการข้อมูล', current === 'admin', current);
  await adSelectTable('sales');
  ok('ตารางอ่านอย่างเดียวไม่มีปุ่มเพิ่มแถว', document.getElementById('adAddBtn').hidden);
  adOpenRow(adRows[0]);
  ok('ตารางอ่านอย่างเดียวไม่มีปุ่มบันทึกในแผง', !document.getElementById('adSaveBtn'));
  ok('ตารางอ่านอย่างเดียวไม่มีช่องกรอก', !document.querySelector('#adFields [data-col]'));
  CALLS.length = 0;
  await adSaveRow();
  ok('สั่งบันทึกตารางอ่านอย่างเดียวตรง ๆ ก็ถูกปฏิเสธ ไม่มีการเขียน', writes().length === 0, JSON.stringify(writes().map(c => c.table)));
  ok('บอกเหตุผลว่าดูได้อย่างเดียว', txt('toast').indexOf('ดูได้อย่างเดียว') !== -1, txt('toast'));

  await adSelectTable('products');
  adOpenRow(adRows[0]);
  document.getElementById('fld_name').value = 'DDJ-FLX4 (ใหม่)';
  CALLS.length = 0;
  await adSaveRow();
  const pu = CALLS.find(c => c.op === 'update' && c.table === 'products');
  ok('ตารางสินค้าแก้ได้ ส่ง update ไปที่ products', !!pu && pu.payload.name === 'DDJ-FLX4 (ใหม่)', JSON.stringify(pu && pu.payload));

  // ── RLS ปฏิเสธเงียบ ๆ: ฐานข้อมูลไม่ฟ้อง error แต่ไม่แก้/ไม่ลบอะไร (0 แถว) — ห้ามขึ้นสำเร็จหลอก (กฎข้อ 8) ──
  window.RLS_BLOCK = new Set(['products']);
  document.getElementById('toast').textContent = '';
  const fe0 = document.getElementById('fatalError'); if (fe0) fe0.remove();
  adOpenRow(adRows[0]);
  document.getElementById('fld_name').value = 'ชื่อที่ฐานข้อมูลจะไม่รับ';
  await adSaveRow();
  const fe1 = document.getElementById('fatalError');
  ok('บันทึกแล้วฐานข้อมูลแก้ 0 แถว (RLS ปฏิเสธเงียบ ๆ): ขึ้นแถบแดงบอกว่าไม่ได้บันทึก', !!fe1 && /ไม่ได้แก้แถวนี้/.test(fe1.textContent), fe1 && fe1.textContent);
  ok('...ไม่ขึ้น "บันทึกเรียบร้อย" และแผงยังเปิดอยู่ให้แก้ต่อ', txt('toast').indexOf('บันทึกเรียบร้อย') === -1 && !!document.getElementById('adSaveBtn'), txt('toast'));
  if (fe1) fe1.remove();
  await adSelectTable('products');
  adOpenRow(adRows[0]);
  adDeleteRow();
  await runConfirm();
  const fe2 = document.getElementById('fatalError');
  ok('ลบแล้วฐานข้อมูลลบ 0 แถว: ขึ้นแถบแดงบอกว่าไม่ได้ลบ · ไม่ขึ้น "ลบแถวเรียบร้อย"', !!fe2 && /ไม่ได้ลบแถวนี้/.test(fe2.textContent) && txt('toast').indexOf('ลบแถวเรียบร้อย') === -1, fe2 && fe2.textContent);
  if (fe2) fe2.remove();
  closeConfirm();
  window.RLS_BLOCK = null;
  adOpenRow(adRows[0]);
  adDeleteRow();
  await runConfirm();
  ok('ลบปกติ (ฐานข้อมูลลบ 1 แถว): ขึ้น "ลบแถวเรียบร้อย" · ไม่มีแถบแดง', txt('toast').indexOf('ลบแถวเรียบร้อย') !== -1 && !document.getElementById('fatalError'), txt('toast'));

  showSection('products');
  openProduct('p1');
  await sleep(100);
  ok('เจ้าของร้านเห็นปุ่มแก้ไขข้อมูลสินค้าในแผงสินค้า', /แก้ไขข้อมูลสินค้า/.test(txt('detailBody')));
  ok('เจ้าของร้านเห็นปุ่มเพิ่มสินค้าใหม่', !document.getElementById('addProductBtn').hidden);

  // ── 6. พนักงาน ────────────────────────────────────────────────────────
  await doLogout();
  await sleep(200);
  await login('staff@djlabsiam.com');
  ok('พนักงานล็อกอินได้', document.getElementById('loginOverlay').style.display === 'none');
  ok('พนักงานไม่เห็นเมนูบันทึกการใช้งาน', !document.querySelector('.nav-item[data-s="activity"]'));
  showSection('products');
  key('Digit9', '9', { altKey: true });
  ok('พนักงานกด Alt+9 แล้วไม่เข้าหมวดบันทึกการใช้งาน', current !== 'activity' && document.getElementById('sec-activity').hidden, current);
  ok('บอกเหตุผลว่าเฉพาะเจ้าของร้าน/ผู้ดูแล', txt('toast').indexOf('เฉพาะเจ้าของร้าน') !== -1, txt('toast'));
  ok('พนักงานไม่เห็นเมนูจัดการข้อมูล', !document.querySelector('.nav-item[data-s="admin"]'));
  document.getElementById('toast').textContent = '';
  key('Digit0', '0', { altKey: true });
  ok('พนักงานกด Alt+0 แล้วไม่เข้าหมวดจัดการข้อมูล และมีข้อความบอก',
    current !== 'admin' && document.getElementById('sec-admin').hidden && txt('toast').indexOf('เฉพาะเจ้าของร้าน') !== -1, current + ' / ' + txt('toast'));
  location.hash = '#admin';
  await sleep(200);
  ok('พนักงานพิมพ์ #admin เองก็ถูกส่งกลับหมวดเริ่มต้น (หน้าแรก)', current === 'home' && location.hash === '#home' &&
    document.getElementById('sec-admin').hidden, current + ' ' + location.hash);
  location.hash = '#activity';
  await sleep(200);
  ok('พนักงานพิมพ์ #activity เองก็ถูกส่งกลับหมวดเริ่มต้น (หน้าแรก)', current === 'home' && document.getElementById('sec-activity').hidden, current);
  openProduct('p1');
  await sleep(100);
  ok('พนักงานไม่เห็นปุ่มแก้ไขข้อมูลสินค้า', !/แก้ไขข้อมูลสินค้า/.test(txt('detailBody')));
  ok('พนักงานไม่เห็นปุ่มเพิ่มสินค้าใหม่', document.getElementById('addProductBtn').hidden);
  showSection('customers');
  await openCustomer('c1');
  ok('พนักงานไม่เห็นปุ่มลบลูกค้า', !/ลบลูกค้า/.test(txt('detailBody')));

  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

const res = runPage({ root, file: 'desk.html', mock: MOCK, tests: TESTS });

// ── เปิดหน้าใหม่พร้อม hash: ต้องเข้าหมวดนั้นตรง ๆ (รีโหลด / บุ๊กมาร์ก / หน้าต่างแอป) ────────
function loadWith(hash, userId, body) {
  const mock = MOCK.replace('let SESSION = null', "let SESSION = { user: { id: '" + userId + "' } }");
  const tests = `<script>
window.addEventListener('load', () => setTimeout(runTests, 600));
${HARNESS}
async function runTests() {
  L('=== เปิดหน้าด้วย ${hash} (${userId === 'u1' ? 'เจ้าของร้าน' : 'พนักงาน'}) ===');
  ${body}
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;
  return runPage({ root, file: 'desk.html', mock, tests, hash });
}

const onBooking = loadWith('#booking', 'u1', `
  ok('เปิดหน้าด้วย #booking แล้วเข้าหมวดจองห้องซ้อมทันที', current === 'booking' && !document.getElementById('sec-booking').hidden, current);
  ok('หัวหน้าแสดงชื่อหมวดถูก', document.getElementById('pageTitle').textContent === 'จองห้องซ้อม');
  ok('เพิ่งเปิดหน้า ยังไม่มีอะไรให้ย้อน ปุ่มย้อนกลับกดไม่ได้', document.getElementById('backBtn').disabled);
  ok('URL ยังเป็น #booking', location.hash === '#booking', location.hash);`);

const staffAdmin = loadWith('#admin', 'u2', `
  ok('พนักงานเปิดหน้าด้วย #admin ถูกส่งไปหมวดเริ่มต้น (หน้าแรก)', current === 'home' && document.getElementById('sec-admin').hidden, current);
  ok('URL ถูกแก้เป็น #home ไม่ค้าง #admin', location.hash === '#home', location.hash);
  ok('บอกเหตุผลว่าเฉพาะเจ้าของร้าน/ผู้ดูแล', document.getElementById('toast').textContent.indexOf('เฉพาะเจ้าของร้าน') !== -1,
    document.getElementById('toast').textContent);`);

// ── ลิงก์เปิดใบจองตรง #booking:<id> (ลิงก์ในแจ้งเตือนการจอง) — เปิดครั้งเดียว · ไม่พบใบ = ตกไปหน้าจองห้องปกติ · hash อื่นที่มีส่วนต่อท้ายไม่ถูกพาไปไหน ──
const wait = "const sleep = ms => new Promise(r => setTimeout(r, ms)); const dh = () => document.querySelector('#detail .detail-head').textContent; await sleep(500);";
const deepOwn = loadWith('#booking:b1', 'u1', wait + `
  ok('เปิดหน้าด้วย #booking:b1 → เข้าหมวดจองห้อง + เปิดแผงใบ b1 ทันที (ไม่ต้องกดอะไร)', current === 'booking' && detailOpen() && dh().indexOf('ลูกค้า LINE') !== -1, current + ' ' + detailOpen());
  ok('ไทม์ไลน์ไปที่วันของใบนั้น · แถวของใบนั้นถูกเลือก · ปุ่มยืนยันอยู่ในแผง', bkDate === TODAY && !!document.getElementById('bkConfirmBtn') && document.querySelectorAll('#bookingRows tr.sel').length === 1, bkDate);
  closeDetail(); await loadAll(); await sleep(300);
  ok('เปิดครั้งเดียว: ปิดแผงแล้วโหลดข้อมูลรอบถัดไป (เช่น realtime สินค้า/ขาย) ไม่เปิดใบนั้นซ้ำ', !detailOpen());`);
const deepOldDate = loadWith('#booking:b3', 'u1', wait + `
  ok('ใบของวันอื่น (b3 · 1 ก.ย.): ไทม์ไลน์ย้ายไปวันนั้น + เปิดแผงใบนั้น', current === 'booking' && bkDate === '2026-09-01' && detailOpen() && dh().indexOf('ลูกค้าประจำ') !== -1, bkDate + ' ' + detailOpen());`);
const deepStaff = loadWith('#booking:b2', 'u2', wait + `
  ok('พนักงาน (ไม่ใช่เจ้าของ) เปิดลิงก์ใบจองได้เหมือนกัน', current === 'booking' && detailOpen() && dh().indexOf('ลูกค้าเว็บ') !== -1, current);`);
const deepEncoded = loadWith('#booking%3Ab1', 'u1', wait + `
  ok('ลิงก์ที่เข้ารหัส : เป็น %3A ก็เปิดใบเดียวกัน', current === 'booking' && detailOpen() && dh().indexOf('ลูกค้า LINE') !== -1);`);
const deepMissing = loadWith('#booking:no-such-id', 'u1', wait + `
  ok('ไม่พบใบ → ตกไปหน้าจองห้องปกติ (ไม่เปิดแผง) · บอกว่าไม่พบ · URL กลับเป็น #booking', current === 'booking' && !detailOpen() && document.getElementById('toast').textContent.indexOf('ไม่พบการจอง') !== -1 && location.hash === '#booking', current + ' ' + detailOpen() + ' ' + location.hash + ' ' + document.getElementById('toast').textContent);
  ok('ปุ่มย้อนกลับไม่ค้างลิงก์เสีย (hash ถูกแทน ไม่ได้ซ้อนใหม่)', document.getElementById('backBtn').disabled === true);`);
const deepColon = loadWith('#booking:x:y', 'u1', wait + `
  ok('id ที่มี : อยู่ข้างใน (#booking:x:y) ตัดที่ : ตัวแรก → หมวดจองห้อง + ไม่พบใบ (ไม่ตกไปหน้าแรก)', current === 'booking' && !detailOpen() && document.getElementById('toast').textContent.indexOf('ไม่พบการจอง') !== -1, current);`);
const deepEmpty = loadWith('#booking:', 'u1', wait + `
  ok('#booking: (ไม่มี id) = หน้าจองห้องปกติ ไม่เปิดแผง ไม่ฟ้องว่าไม่พบ', current === 'booking' && !detailOpen() && document.getElementById('toast').textContent.indexOf('ไม่พบ') === -1);`);
const deepOther = loadWith('#stock:b1', 'u1', wait + `
  ok('hash อื่นที่มีส่วนต่อท้าย (#stock:b1) ไม่ถูกตีความ → หน้าแรกตามเดิม ไม่เปิดใบจอง', current === 'home' && !detailOpen(), current);`);
const deepNav = loadWith('#home', 'u1', wait + `
  location.hash = '#booking:b2'; await sleep(400);
  ok('พิมพ์/กดลิงก์ #booking:b2 ตอนเปิดหน้าอยู่แล้ว (popstate) → ไปหมวดจองห้อง + เปิดใบนั้น', current === 'booking' && detailOpen() && dh().indexOf('ลูกค้าเว็บ') !== -1, current);
  closeDetail(); showSection('home'); await sleep(100);
  const hl = history.length; document.getElementById('toast').textContent = '';
  location.hash = '#booking:ghost2'; await sleep(400);
  ok('พิมพ์ลิงก์ใบที่ไม่มี (#booking:ghost2) ตอนเปิดหน้าอยู่ → หมวดจองห้องปกติ + บอกว่าไม่พบ + URL ถูกแทนเป็น #booking (ไม่ซ้อนประวัติเพิ่ม · ปุ่มย้อนไม่ค้างลิงก์เสีย)',
    current === 'booking' && !detailOpen() && document.getElementById('toast').textContent.indexOf('ไม่พบการจอง') !== -1 && location.hash === '#booking' && history.length === hl + 1, current + ' ' + location.hash + ' ' + history.length + '/' + hl);
  showSection('home'); await sleep(100);
  notifOnMessage({ data: { type: 'djlab-notification-click', hash: '#booking:b1' } }); await sleep(300);
  ok('แจ้งเตือนถูกกดตอนหน้าเปิดอยู่ (SW ส่ง hash #booking:b1) → เปิดใบ b1 ตรง ๆ', current === 'booking' && detailOpen() && dh().indexOf('ลูกค้า LINE') !== -1, current);
  closeDetail(); showSection('home'); await sleep(100);
  notifOnMessage({ data: { type: 'djlab-notification-click', hash: '#booking' } }); await sleep(200);
  ok('แจ้งเตือนที่ลิงก์เป็น #booking เฉย ๆ → ไปหมวดจองห้อง ไม่เปิดแผง', current === 'booking' && !detailOpen(), current);
  showSection('home'); await sleep(100);
  notifOnMessage({ data: { type: 'djlab-notification-click', hash: '#booking:ghost' } }); await sleep(300);
  ok('แจ้งเตือนชี้ใบที่ไม่มี → หมวดจองห้องปกติ + บอกว่าไม่พบ', current === 'booking' && !detailOpen() && document.getElementById('toast').textContent.indexOf('ไม่พบการจอง') !== -1, current);
  for (const h of ['#tasks', undefined, '', '#home', '#stock:b1', '#bookingx']) {
    showSection('home'); await sleep(60);
    notifOnMessage({ data: { type: 'djlab-notification-click', hash: h } }); await sleep(120);
    ok('แจ้งเตือนอื่น (hash ' + JSON.stringify(h) + ') ยังพาไป "งานของฉัน" เหมือนเดิม', current === 'tasks', current);
  }`);

// ยังไม่ล็อกอิน: ลิงก์ที่มากับ URL/popstate ต้องไม่ถูกใช้ทิ้งก่อนมีข้อมูล (ไม่งั้นล็อกอินเสร็จแล้วใบไม่เปิด) — เปิดหน้าแบบไม่มี session
const deepLoggedOut = runPage({ root, file: 'desk.html', mock: MOCK, hash: '#booking:b1', tests: `<script>
window.addEventListener('load', () => setTimeout(runTests, 600));
${HARNESS}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dh = () => document.querySelector('#detail .detail-head').textContent;
async function runTests() {
  ok('(เตรียม) ยังไม่ล็อกอิน: ไม่เปิดแผง ไม่ฟ้องว่าไม่พบใบ', document.getElementById('loginOverlay').style.display !== 'none' && !detailOpen() && document.getElementById('toast').textContent.indexOf('ไม่พบ') === -1);
  location.hash = '#booking:b2'; await sleep(300);
  ok('ยังไม่ล็อกอิน + มีลิงก์เข้ามา (popstate): ไม่ถูกใช้ทิ้ง ไม่ฟ้องว่าไม่พบใบ', !detailOpen() && document.getElementById('toast').textContent.indexOf('ไม่พบ') === -1, document.getElementById('toast').textContent);
  document.getElementById('loginEmail').value = 'owner@djlabsiam.com'; document.getElementById('loginPassword').value = 'x';
  await doLogin(); await sleep(700);
  ok('ล็อกอินเสร็จ → เปิดใบ b2 ตามลิงก์ล่าสุดทันที', current === 'booking' && detailOpen() && dh().indexOf('ลูกค้าเว็บ') !== -1, current + ' ' + detailOpen());
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>` });

// ── หน้าแยก: เก็บตกข้อมูลที่ realtime พลาด (กลับมาที่แท็บ · online · channel ต่อใหม่) ──
const resync = loadWith('#booking', 'u1', wait + `
  // ── เก็บตกที่ realtime พลาด ──
  // 6 ต.ค. 69 เจ้าของทดสอบจอง /book บนมือถือเครื่องเดียวกับที่เปิดคอนโซล → แท็บคอนโซลอยู่เบื้องหลัง websocket ถูกพัก/หลุด → พลาด event INSERT ของใบจอง
  // กลับมาแล้วไม่มีอะไรโหลดใหม่ = ใบนั้นหายจากหน้าจอ (และเลขแดง) จนกว่าจะรีเฟรช · ตอนนี้: กลับมาที่แท็บ (ซ่อน ≥ 5 วินาที) · เน็ตกลับมา · channel ต่อใหม่หลังหลุด → โหลดชุดที่ใช้ realtime ใหม่รอบเดียว
  {
    const txt = id => document.getElementById(id).textContent;
    const SETTLE = 150;
    ok('ค่าตั้งต้นของการเก็บตก: หน่วงรวบตัวกระตุ้น 400ms · ซ่อนแท็บ ≥ 5000ms ถึงโหลดใหม่', RESYNC_DEBOUNCE_MS === 400 && RESYNC_MIN_HIDDEN_MS === 5000, RESYNC_DEBOUNCE_MS + ' ' + RESYNC_MIN_HIDDEN_MS);
    RESYNC_DEBOUNCE_MS = 30;                                        // ให้เทสต์รอสั้นลง (งบเวลาของหน้าทดสอบ 15 วินาที)
    const nb = () => document.getElementById('navBadge-booking');
    const rowsN = () => document.querySelectorAll('#bookingRows tr[data-i]').length;
    const nFrom = t => window.FROMS.filter(x => x === t).length;
    const setVis = hidden => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    const away = async ms => { setVis(true); if (typeof resyncHiddenAt !== 'undefined') resyncHiddenAt -= ms; setVis(false); await sleep(SETTLE); };     // ซ่อนไป ms มิลลิวินาทีแล้วกลับมา (ถอยเวลาที่ซ่อนแทนการรอจริง)
    let seq = 0;
    const missed = () => { seq++; FAKE.room_bookings.push({ id: 'ms' + seq, customer_name: 'ใบที่พลาด ' + seq, contact: '0800000010', date: TODAY, start_time: '20:00:00', hours: 1, room: 'Controller Setup', cost: 800, status: 'upcoming', confirmed: false, source: 'online_web', line_user_id: null, customer_id: null }); };
    const base = rowsN();
    ok('(ตั้งต้น) ตารางจอง 3 รายการ · เลขแดง 2', base === 3 && nb().textContent === '2', base + ' ' + nb().textContent);
    missed();
    await sleep(SETTLE);
    ok('(ต้นเหตุ) ใบเข้าฐานแต่ realtime ไม่แจ้ง (แท็บถูกพัก): หน้าจอไม่เห็นใบนั้น เลขแดงเท่าเดิม — ไม่มีอะไรโหลดใหม่เอง', rowsN() === base && nb().textContent === '2', rowsN() + ' ' + nb().textContent);
    await away(60000);
    ok('ซ่อนแท็บไป 60 วินาทีแล้วกลับมา: เห็นใบที่พลาดทันที (แถวเพิ่ม 1) · เลขแดงตามเป็น 3 · การ์ดสรุปรอยืนยัน 3', rowsN() === base + 1 && nb().textContent === '3' && txt('bkStatPending') === '3', rowsN() + ' ' + nb().textContent + ' ' + txt('bkStatPending'));
    window.FROMS.length = 0; setVis(false); await sleep(SETTLE);
    ok('โหลดใหม่แล้ว กลับมา visible ซ้ำอีก (ไม่ได้ซ่อนรอบใหม่): ไม่โหลดซ้ำ — เวลาที่ซ่อนถูกล้างหลังใช้แล้ว', nFrom('room_bookings') === 0, String(nFrom('room_bookings')));
    missed(); window.FROMS.length = 0;
    await away(4000);
    ok('ซ่อนแค่ 4 วินาที (สลับแท็บเร็ว ๆ): ไม่โหลดใหม่ — ไม่มีคำขอ room_bookings เลย · ใบใหม่ยังไม่โผล่', nFrom('room_bookings') === 0 && rowsN() === base + 1, nFrom('room_bookings') + ' ' + rowsN());
    window.FROMS.length = 0; setVis(false); await sleep(SETTLE);
    ok('visible ซ้ำโดยไม่เคยซ่อน: ไม่โหลดใหม่', nFrom('room_bookings') === 0);
    window.FROMS.length = 0; window.dispatchEvent(new Event('online')); await sleep(SETTLE);
    ok('เน็ตกลับมา (online): โหลดใหม่รอบเดียว เห็นใบที่พลาดทั้งหมด (แถว +2) · เลขแดง 4', rowsN() === base + 2 && nb().textContent === '4' && nFrom('room_bookings') === 1, rowsN() + ' ' + nb().textContent + ' ' + nFrom('room_bookings'));
    const got = new Set(window.FROMS);
    const want = ['products', 'stock_movements', 'sales', 'room_bookings', 'booking_settings', 'customers', 'board_messages', 'calendar_events', 'work_tasks', 'work_task_events', 'work_requests'];
    ok('การโหลดใหม่ครอบทุกตารางที่ใช้ realtime (สินค้า · ความเคลื่อนไหว · ขาย · จอง · ตั้งค่าจอง · ลูกค้า · กระดาน · ปฏิทิน · งาน 3 ตาราง)', want.every(t => got.has(t)), 'ขาด: ' + want.filter(t => !got.has(t)).join());
    // หมวดสรุปรายวัน (รายรับ-รายจ่ายโหลดเมื่อเปิดหมวดนั้นอยู่) · เปิดหมวดแล้ว "กลับมา" ต้องโหลดชุดนั้นด้วย
    showSection('daily', 'replace'); await sleep(SETTLE);
    window.FROMS.length = 0; window.dispatchEvent(new Event('online')); await sleep(SETTLE);
    ok('อยู่หมวดสรุปรายวันแล้วกลับมา: โหลดรายรับ-รายจ่ายใหม่ด้วย', nFrom('v_daily_income') >= 1 && nFrom('expenses') >= 1, nFrom('v_daily_income') + ' ' + nFrom('expenses'));
    showSection('booking', 'replace'); await sleep(SETTLE);
    window.FROMS.length = 0; window.dispatchEvent(new Event('online')); await sleep(SETTLE);
    ok('อยู่หมวดอื่น (จองห้อง) แล้วกลับมา: ไม่โหลดรายรับ-รายจ่ายซ้ำโดยไม่จำเป็น', nFrom('v_daily_income') === 0 && nFrom('expenses') === 0, nFrom('v_daily_income') + ' ' + nFrom('expenses'));
    // หมวดปฏิทิน: โหลดของหน้าแรก (วันนี้) + ของหมวดเอง = 2 รอบ · หมวดอื่น = รอบเดียว (ของหน้าแรก)
    showSection('calendar', 'replace'); await sleep(SETTLE);
    window.FROMS.length = 0; window.dispatchEvent(new Event('online')); await sleep(SETTLE);
    ok('อยู่หมวดปฏิทินแล้วกลับมา: โหลดกิจกรรมปฏิทินใหม่ทั้งของหน้าแรก (วันนี้) และของหมวด = 2 รอบ', nFrom('calendar_events') === 2, String(nFrom('calendar_events')));
    showSection('booking', 'replace'); await sleep(SETTLE);
    window.FROMS.length = 0; window.dispatchEvent(new Event('online')); await sleep(SETTLE);
    ok('อยู่หมวดจองห้องแล้วกลับมา: โหลดกิจกรรมปฏิทินของหน้าแรกรอบเดียว (ไม่โหลดปฏิทินของหมวดปฏิทิน)', nFrom('calendar_events') === 1, String(nFrom('calendar_events')));
    // channel realtime หลุดแล้วต่อใหม่
    missed();
    const names = Object.keys(window.RTSUB || {}).sort();
    ok('ทั้ง 10 channel ของหน้านี้ฟังสถานะการเชื่อมต่อ (ไม่มี channel ที่สมัครโดยไม่มีตัวฟังสถานะ)', names.length === 10 && names.every(n => typeof window.RTSUB[n] === 'function'), names.join());
    window.FROMS.length = 0; window.RTSUB['desk-room-bookings']('SUBSCRIBED'); await sleep(SETTLE);
    ok('channel ตอบ SUBSCRIBED ตอนเริ่มต่อครั้งแรก (ไม่เคยหลุด): ไม่โหลดซ้ำ', nFrom('room_bookings') === 0 && rowsN() === base + 2, nFrom('room_bookings') + ' ' + rowsN());
    window.RTSUB['desk-room-bookings']('CHANNEL_ERROR'); await sleep(SETTLE);
    ok('ระหว่างที่หลุด (CHANNEL_ERROR): ยังไม่โหลด รอต่อใหม่', nFrom('room_bookings') === 0, String(nFrom('room_bookings')));
    window.RTSUB['desk-room-bookings']('SUBSCRIBED'); await sleep(SETTLE);
    ok('หลุดแล้วต่อใหม่ได้ (CHANNEL_ERROR → SUBSCRIBED): โหลดใหม่ เห็นใบที่พลาด · เลขแดง 5', rowsN() === base + 3 && nb().textContent === '5' && nFrom('room_bookings') === 1, rowsN() + ' ' + nb().textContent + ' ' + nFrom('room_bookings'));
    window.RTSUB['desk-room-bookings']('SUBSCRIBED'); window.FROMS.length = 0; await sleep(SETTLE);
    ok('SUBSCRIBED ซ้ำหลังต่อใหม่แล้ว: ไม่โหลดอีก (จำเฉพาะช่วงที่หลุด)', nFrom('room_bookings') === 0);
    for (const n of names) {
      for (const st of ['CLOSED', 'TIMED_OUT', 'CHANNEL_ERROR']) {
        if (n !== 'desk-room-bookings' && st !== 'CLOSED') continue;
        missed(); window.FROMS.length = 0;
        window.RTSUB[n](st); names.forEach(m => { if (m !== n) window.RTSUB[m]('SUBSCRIBED'); }); await sleep(60);
        const early = nFrom('room_bookings');
        window.RTSUB[n]('SUBSCRIBED'); await sleep(SETTLE);
        ok('channel ' + n + ' ' + st + ': ช่องอื่นต่อใหม่ครบ ไม่ล้างสถานะหลุดของช่องนี้ (ไม่โหลด) · ช่องนี้ต่อใหม่ → โหลดใหม่ทุกชุด (ไม่ใช่แค่ตารางของ channel นั้น)', early === 0 && nFrom('room_bookings') === 1 && nFrom('products') === 1, early + ' ' + nFrom('room_bookings') + ' ' + nFrom('products'));
      }
    }
    // ต่างช่อง: ช่องอื่นต่อ SUBSCRIBED โดยที่ตัวเองไม่เคยหลุด ไม่ทำให้โหลด
    missed(); window.FROMS.length = 0;
    window.RTSUB['desk-products']('CLOSED'); window.RTSUB['desk-customers']('SUBSCRIBED'); await sleep(SETTLE);
    ok('ช่อง A หลุด · ช่อง B (ไม่เคยหลุด) ตอบ SUBSCRIBED: ไม่โหลด (ต่อช่องไม่ปนกัน)', nFrom('room_bookings') === 0, String(nFrom('room_bookings')));
    window.RTSUB['desk-products']('SUBSCRIBED'); await sleep(SETTLE);
    ok('ช่อง A ต่อใหม่: โหลด', nFrom('room_bookings') === 1);
    // ตัวกระตุ้นหลายทางพร้อมกัน = โหลดรอบเดียว
    missed(); window.FROMS.length = 0;
    setVis(true); if (typeof resyncHiddenAt !== 'undefined') resyncHiddenAt -= 60000; setVis(false);
    window.dispatchEvent(new Event('online'));
    window.RTSUB['desk-sales']('CLOSED'); window.RTSUB['desk-sales']('SUBSCRIBED');
    await sleep(SETTLE);
    ok('กลับมาที่แท็บ + online + channel ต่อใหม่ พร้อมกัน: โหลดรวมรอบเดียว (ไม่ยิงซ้ำ 3 รอบ)', nFrom('room_bookings') === 1 && nFrom('products') === 1 && nFrom('work_tasks') === 1, nFrom('room_bookings') + ' ' + nFrom('products') + ' ' + nFrom('work_tasks'));
    // ยังไม่ได้ล็อกอิน/ออกจากระบบ: ไม่โหลดอะไรเลย
    const keepUid = currentUserId;
    currentUserId = null; window.FROMS.length = 0;
    window.dispatchEvent(new Event('online')); await away(60000);
    window.RTSUB['desk-sales']('CLOSED'); window.RTSUB['desk-sales']('SUBSCRIBED'); await sleep(SETTLE);
    ok('ยังไม่ล็อกอิน/ออกจากระบบแล้ว: กลับมาที่แท็บ · online · channel ต่อใหม่ ไม่โหลดอะไรเลย', window.FROMS.length === 0, window.FROMS.join());
    currentUserId = keepUid; await sleep(SETTLE);
    // กลับจากแคชย้อนหลังของเบราว์เซอร์ (bfcache) = หน้าถูกพักทั้งหน้า ต้องโหลดใหม่ · pageshow ตอนโหลดหน้าปกติไม่ต้อง
    missed(); window.FROMS.length = 0;
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false })); await sleep(SETTLE);
    ok('pageshow ปกติ (โหลดหน้าใหม่ ไม่ใช่กลับจากแคชย้อนหลัง): ไม่โหลดใหม่', nFrom('room_bookings') === 0, String(nFrom('room_bookings')));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); await sleep(SETTLE);
    ok('กลับจากแคชย้อนหลังของเบราว์เซอร์ (pageshow persisted): โหลดใหม่ รอบเดียว', nFrom('room_bookings') === 1 && nFrom('products') === 1, nFrom('room_bookings') + ' ' + nFrom('products'));
    // สลับบัญชี/ออกจากระบบระหว่างที่กำลังโหลดใหม่: ไม่เอาผลไปโหลดต่อของคนใหม่ (ปฏิทิน · กระดาน · งาน)
    window.FROMS.length = 0;
    const pr = resyncAll(); currentUserId = 'u-other'; await pr; await sleep(SETTLE);
    ok('สลับบัญชีระหว่างที่กำลังโหลดใหม่: ไม่โหลดชุดที่เหลือต่อ (ปฏิทิน · กระดาน · งาน)', nFrom('calendar_events') === 0 && nFrom('board_messages') === 0 && nFrom('work_tasks') === 0, window.FROMS.join());
    currentUserId = keepUid; await sleep(SETTLE);
    // คืนสถานะ: ใบที่พลาดออก เลขแดงกลับเป็น 2
    FAKE.room_bookings = FAKE.room_bookings.filter(b => !/^ms[0-9]+$/.test(b.id));
    window.RTSUB['desk-room-bookings']('CLOSED'); window.RTSUB['desk-room-bookings']('SUBSCRIBED'); await sleep(SETTLE);
    ok('(คืนสถานะ) ตารางจองกลับเป็น 3 · เลขแดง 2 เพื่อให้เทสต์ต่อไปเริ่มจากจุดเดิม', rowsN() === base && nb().textContent === '2', rowsN() + ' ' + nb().textContent);
  }

`);

// ── หน้าแยก: ตัวสำรองโพลล์ (เบา) — websocket ตายเงียบ + แท็บเปิดมองเห็นตลอด → ทุก 5 นาทีดึงการจองใหม่ (เฉพาะ loadBookings + วาดจอง/เลขแดง เมื่อข้อมูลเปลี่ยน) ──
const poll = loadWith('#booking', 'u1', wait + `
  {
    const txt = id => document.getElementById(id).textContent;
    const nb = () => document.getElementById('navBadge-booking');
    const rowsN = () => document.querySelectorAll('#bookingRows tr[data-i]').length;
    const nFrom = t => window.FROMS.filter(x => x === t).length;
    const setVis = hidden => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    const setOnline = on => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => on });
    let seq = 0, seen = 0;
    const missed = () => { seq++; FAKE.room_bookings.push({ id: 'pl' + seq, customer_name: 'ใบที่พลาด ' + seq, contact: '0800000010', date: TODAY, start_time: '20:00:00', hours: 1, room: 'Controller Setup', cost: 800, status: 'upcoming', confirmed: false, source: 'online_web', line_user_id: null, customer_id: null }); };
    const orig = renderBookings; let nRender = 0;
    renderBookings = () => { nRender++; return orig(); };
    const origP = renderProducts, origC = renderCustomers; let nOther = 0;
    renderProducts = () => { nOther++; return origP(); }; renderCustomers = () => { nOther++; return origC(); };
    const base = rowsN();
    ok('ค่าตั้งต้น: โพลล์ทุก 300000 มิลลิวินาที (5 นาที)', BK_POLL_MS === 300000, String(BK_POLL_MS));
    ok('ตัวตั้งเวลาเริ่มเดินตั้งแต่โหลดหน้า (ไม่ต้องรอใครสั่ง)', bkPollTimer !== null, String(bkPollTimer));
    ok('(ตั้งต้น) ตารางจอง 3 รายการ · เลขแดง 2', base === 3 && nb().textContent === '2', base + ' ' + nb().textContent);
    window.FROMS.length = 0; nRender = 0; nOther = 0; await bkPoll();
    ok('โพลล์ตอนข้อมูลไม่เปลี่ยน: ดึงการจองครั้งเดียว (ไม่ดึงตารางอื่น) · วาดจอง/เลขแดงรอบเดียว · ไม่วาดสินค้า/ลูกค้า (ไม่ใช่ renderAll)', nFrom('room_bookings') === 1 && window.FROMS.length === 1 && nRender === 1 && nOther === 0, window.FROMS.join() + ' วาด ' + nRender);
    missed(); nRender = 0; window.FROMS.length = 0; await bkPoll(); seen = seq;
    ok('มีใบใหม่ที่ realtime พลาด: โพลล์ดึงมาวาด (แถว +1 · เลขแดง 3 · การ์ดสรุป 3) วาดรอบเดียว', rowsN() === base + 1 && nb().textContent === '3' && txt('bkStatPending') === '3' && nRender === 1, rowsN() + ' ' + nb().textContent + ' วาด ' + nRender);
    ok('โพลล์ไม่ใช่ loadAll: ไม่ดึงสินค้า · ลูกค้า · ขาย · ตั้งค่าจอง · งาน', ['products', 'customers', 'sales', 'booking_settings', 'work_tasks'].every(t => nFrom(t) === 0), window.FROMS.join());
    FAKE.room_bookings[0].confirmed = true; nRender = 0; await bkPoll();
    ok('มีคนยืนยันใบหนึ่ง (จำนวนแถวเท่าเดิม): วาดใหม่ · เลขแดงลดเป็น 2', rowsN() === base + 1 && nb().textContent === '2' && nRender === 1, nb().textContent + ' วาด ' + nRender);
    missed(); window.FROMS.length = 0;
    setVis(true); await bkPoll(); setVis(false);
    ok('แท็บถูกซ่อน: ไม่โพลล์ (ไม่ยิงคำขอใดเลย)', window.FROMS.length === 0, window.FROMS.join());
    const keep = currentUserId;
    currentUserId = null; await bkPoll(); currentUserId = keep;
    ok('ยังไม่ล็อกอิน/ออกจากระบบแล้ว: ไม่โพลล์', window.FROMS.length === 0, window.FROMS.join());
    setOnline(false); await bkPoll(); setOnline(true);
    ok('ออฟไลน์: ไม่โพลล์ (ไม่เด้งแถบแดงทุก 5 นาที — รอ online แล้วเก็บตกเอง)', window.FROMS.length === 0 && !document.getElementById('fatalError'), window.FROMS.join());
    const rowsBefore = rowsN();
    const pr = bkPoll(); currentUserId = 'u-other'; await pr; currentUserId = keep;
    ok('สลับบัญชีระหว่างที่โพลล์กำลังดึง: ไม่วาดผลนั้น (แถวเท่าเดิม)', rowsN() === rowsBefore, rowsN() + ' ' + rowsBefore);
    await bkPoll(); seen = seq;
    ok('โพลล์รอบถัดไปปกติ: เห็นใบที่ค้างอยู่ทั้งหมด', rowsN() === base + seen, rowsN() + ' ' + (base + seen));
    // ตัวตั้งเวลา: ครบรอบแล้วดึงเอง · ตั้งซ้ำไม่ซ้อน · ดึงต่อทุกรอบ · ซ่อนแท็บตอนครบรอบข้ามไปแต่ไม่หยุดเดิน
    BK_POLL_MS = 150; bkPollSchedule(); bkPollSchedule();
    window.FROMS.length = 0; missed(); await sleep(230); seen = seq;
    ok('ตัวตั้งเวลา: ครบรอบแล้วดึงเอง เห็นใบใหม่ · เรียกตั้งเวลาซ้ำสองครั้งก็ดึงรอบละครั้งเดียว (ไม่ซ้อนสองตัว)', rowsN() === base + seen && nFrom('room_bookings') === 1, rowsN() + ' ' + (base + seen) + ' ดึง ' + nFrom('room_bookings'));
    missed(); await sleep(200); seen = seq;
    ok('รอบถัดไปก็ดึงต่อ (ตั้งเวลารอบใหม่ทุกครั้งหลังดึง)', rowsN() === base + seen, rowsN() + ' ' + (base + seen));
    setVis(true); missed(); await sleep(250);
    ok('แท็บซ่อนอยู่ตอนครบรอบ: ข้ามรอบนั้น (แถวเท่าเดิม)', rowsN() === base + seen, rowsN() + ' ' + (base + seen));
    setVis(false); await sleep(250); seen = seq;
    ok('มองเห็นอีกครั้ง: ตัวตั้งเวลายังเดินอยู่ รอบถัดไปดึงต่อ', rowsN() === base + seen, rowsN() + ' ' + (base + seen));
    BK_POLL_MS = 300000; bkPollSchedule();
  }`);

process.exit(res.ok && resync.ok && poll.ok && deepColon.ok && deepLoggedOut.ok && onBooking.ok && staffAdmin.ok && deepOwn.ok && deepOldDate.ok && deepStaff.ok && deepEncoded.ok && deepMissing.ok && deepEmpty.ok && deepOther.ok && deepNav.ok ? 0 : 1);
