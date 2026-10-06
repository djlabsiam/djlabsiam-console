/**
 * เทสต์แผง "⚙ จองออนไลน์" ในหมวดจองห้องของ desk.html — รัน: node tests/desk-webbooking.mjs
 *
 * ก้อนที่ 1 (6 ต.ค. 69 หัวหน้าสั่ง): แถบสถานะซิงก์ตารางสอน (room_blocks_state) + ช่องตั้งค่าการรับจองเว็บ (booking_settings · migration 041)
 * วิธีเดียวกับชุดอื่น: ไฟล์จริงทุกบรรทัด สลับเฉพาะแท็ก Supabase เป็นตัวปลอม · ตัวปลอมของชุดนี้จำลอง RLS ของ booking_settings
 * (ปฏิเสธเงียบ ๆ = 0 แถว) และตารางที่ยังไม่มี/โหลดล้ม · หน้าทดสอบแยกตามบทบาท/สถานะ (งบเวลาเสมือน 15 วินาทีต่อหน้า)
 *   WB_ROOT=<โฟลเดอร์ที่มี desk.html อีกฉบับ> node tests/desk-webbooking.mjs   ใช้ทำ mutation / พิสูจน์ว่าเทสต์ "ตกจริง"
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPage, HARNESS } from './lib/page-test.mjs';

const root = process.env.WB_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');

// cfg: { role, v041 } — v041 = false จำลองฐานที่ยังไม่รัน migration 041 (แถวตั้งค่าไม่มีคอลัมน์เว็บ)
const mockFor = cfg => `<script>
const CFG = ${JSON.stringify(cfg)};
const CALLS = [];
const MODE = { settingsError: null, stateError: null, denyUpdate: false, updateError: null, hold: null, holdUpdate: null, holdRpc: null, anon: null };
const NOW0 = Date.now();
const ago = min => new Date(NOW0 - min * 60000 - 20000).toISOString();
const SETTINGS = Object.assign({ id: true, price_per_hour: 800, points_per_hour: 1, free_hour_threshold: 10, free_hours_reward: 1, room_name: 'DJ LAB SIAM' },
  CFG.v041 === false ? {} : {
    web_booking_enabled: true, open_time: '12:00:00', close_time: '20:00:00', max_hours_per_booking: 4, min_lead_minutes: 60, max_days_ahead: 30,
    max_pending_per_contact_per_day: 2, max_web_bookings_per_hour: 10, room_blocks_enabled: true, room_block_keywords: ['ห้องซ้อม'], sync_stale_minutes: 30,
    equipment_sets: [], entry_refs: ['other'], anonymize_after_months: 12, auto_anonymize_enabled: false });
let STATE = { id: true, last_ok_at: ago(3), last_try_at: ago(3), last_error: null, events_seen: 12, blocks_in_window: 5 };
const FAKE = { admins: [{ id: 'u1', full_name: 'คนทดสอบ', role: CFG.role, is_active: true }], room_bookings: [] };
const clone = o => o && JSON.parse(JSON.stringify(o));
function builder(table) {
  const q = { _op: null, _payload: null, _eq: {}, _cols: undefined, _head: false };
  const rows = () => table === 'booking_settings' ? [SETTINGS] : table === 'room_blocks_state' ? (STATE ? [STATE] : []) : (FAKE[table] || []);
  const match = () => rows().filter(r => Object.keys(q._eq).every(c => r[c] === q._eq[c]));
  async function exec(single) {
    const watched = table === 'room_blocks_state' || (table === 'booking_settings' && q._cols === '*');
    if (!q._op && watched) { CALLS.push({ op: 'select', table, cols: q._cols }); if (MODE.hold) await MODE.hold; }
    if (q._op === 'update') {
      CALLS.push({ op: 'update', table, payload: clone(q._payload), eq: Object.assign({}, q._eq) });
      if (MODE.holdUpdate) await MODE.holdUpdate;
      if (MODE.updateError) return { data: null, error: MODE.updateError };
      const sel = q._cols !== undefined;              // PostgREST คืนแถวที่แก้เฉพาะเมื่อขอด้วย .select() — ไม่ขอ = data เป็น null
      if (MODE.denyUpdate) return { data: sel ? [] : null, error: null };
      const hit = match(); hit.forEach(r => Object.assign(r, q._payload));
      return { data: sel ? hit.map(r => ({ id: r.id })) : null, error: null };
    }
    if (q._op) { CALLS.push({ op: q._op, table, payload: clone(q._payload) }); return { data: null, error: null }; }
    if (table === 'booking_settings' && q._cols === '*' && MODE.settingsError) return { data: null, error: MODE.settingsError };
    if (table === 'room_blocks_state' && MODE.stateError) return { data: null, error: MODE.stateError };
    const hit = match().map(clone);
    if (single) return { data: hit[0] || null, error: null };
    return { data: q._head ? null : hit, error: null, count: hit.length };
  }
  Object.assign(q, {
    select(c, o) { q._cols = c; if (o && o.head) q._head = true; return q; },
    eq(col, val) { q._eq[col] = val; return q; },
    is() { return q; }, contains() { return q; }, order() { return q; }, gte() { return q; }, lt() { return q; }, lte() { return q; },
    limit() { return q; }, range() { return q; }, or() { return q; }, ilike() { return q; }, in() { return q; },
    single() { return exec(true); }, maybeSingle() { return exec(true); },
    then(res, rej) { return exec(false).then(res, rej); },
    insert(p) { q._op = 'insert'; q._payload = p; return q; },
    update(p) { q._op = 'update'; q._payload = p; return q; },
    upsert(p) { q._op = 'upsert'; q._payload = p; return q; },
    delete() { q._op = 'delete'; return q; },
  });
  return q;
}
let SESSION = null, authCb = null;
window.supabase = {
  createClient: () => ({
    from: builder,
    rpc: async (name, args) => {
      CALLS.push({ op: 'rpc', name, args: clone(args) });
      if (name !== 'booking_anonymize_expired') return { data: null, error: null };
      if (MODE.holdRpc) await MODE.holdRpc;
      return MODE.anon ? MODE.anon(args) : { data: null, error: { message: 'no mock' } };
    },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    storage: { from: () => ({ async upload() { return { error: null }; }, async remove() { return { error: null }; }, async createSignedUrl() { return { data: { signedUrl: 'data:,' }, error: null }; } }) },
    auth: {
      async getSession() { return { data: { session: SESSION } }; },
      async getUser() { return { data: { user: SESSION && SESSION.user } }; },
      onAuthStateChange(cb) { authCb = cb; },
      async signInWithPassword() { SESSION = { user: { id: 'u1' } }; setTimeout(() => authCb && authCb('SIGNED_IN', SESSION)); return { data: {}, error: null }; },
      async signOut() { SESSION = null; setTimeout(() => authCb && authCb('SIGNED_OUT', null)); return { error: null }; },
    },
  }),
};
</script>`;

// ส่วนร่วมของทุกหน้าทดสอบ
const PRE = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${HARNESS}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);
const dlg = $('wbDlg');
const toast = () => $('toast').textContent;
const updates = () => CALLS.filter(c => c.op === 'update');
const wbSelects = () => CALLS.filter(c => c.op === 'select').length;
async function login() {
  $('loginEmail').value = 'owner@djlabsiam.com';
  $('loginPassword').value = 'x';
  await doLogin();
  await sleep(400);
}
async function openDlg() { if (dlg.open) dlg.close(); await sleep(5); $('wbBtn').click(); await sleep(40); }
const bold = el => parseInt(getComputedStyle(el).fontWeight, 10) >= 700;
const redOf = () => { const t = document.createElement('span'); t.style.color = 'var(--red)'; document.body.appendChild(t); const c = getComputedStyle(t).color; t.remove(); return c; };
const isRed = el => getComputedStyle(el).color === redOf();
const shown = el => !!el && !el.hidden && el.offsetParent !== null;
const visibleRed = () => Array.prototype.some.call(dlg.querySelectorAll('.wk-red'), e => e.offsetParent !== null);      // คำเตือนแดงที่มองเห็นอยู่จริง (ข้อความเตือนคงที่ใต้ช่องติ๊กอยู่ในฟอร์มที่ซ่อน)
const INTS = [
  ['wbMaxHours', 'ชั่วโมงสูงสุดต่อใบจอง', 1, 12, 'max_hours_per_booking'],
  ['wbLead', 'จองล่วงหน้าอย่างน้อย (นาที)', 0, 1440, 'min_lead_minutes'],
  ['wbAhead', 'จองล่วงหน้าได้ไกลสุด (วัน)', 1, 365, 'max_days_ahead'],
  ['wbPend', 'ใบรอยืนยันต่อผู้ติดต่อต่อวัน', 1, 20, 'max_pending_per_contact_per_day'],
  ['wbHour', 'จองเว็บรวมต่อชั่วโมง', 1, 1000, 'max_web_bookings_per_hour'],
  ['wbStale', 'ซิงก์เก่าเกินกี่นาทีถือว่าใช้ไม่ได้', 5, 1440, 'sync_stale_minutes'],
];
</script>`;

// ───────── หน้า 1: แถบสถานะซิงก์ (เจ้าของ) ─────────
const T_STATUS = PRE + `<script>
async function runTests() {
  L('=== จองออนไลน์: ปุ่ม + แถบสถานะซิงก์ตารางสอน (เจ้าของ) ===');
  await login();
  showSection('booking');
  await sleep(100);

  // ── 1. ปุ่ม ──
  const btn = $('wbBtn');
  ok('มีปุ่ม "⚙ จองออนไลน์" ในหมวดจองห้อง ติดกับปุ่ม "+ จองห้องใหม่" (อยู่ก่อนหน้า)', !!btn && !!$('sec-booking').contains(btn) && btn.textContent.indexOf('จองออนไลน์') !== -1 && !!btn.nextElementSibling && btn.nextElementSibling.textContent.indexOf('จองห้องใหม่') !== -1);
  ok('ยังไม่เปิดหน้าต่างเอง · ยังไม่โหลดอะไรจนกว่าจะกด', !dlg.open && wbSelects() === 0, 'selects=' + wbSelects());

  // ── 2. ซิงก์ปกติ ──
  await openDlg();
  const st = $('wbStatus');
  ok('กดปุ่ม: หน้าต่างเปิด · โหลดตั้งค่า (select *) + สถานะซิงก์ ตารางละ 1 ครั้ง', dlg.open && wbSelects() === 2 && CALLS.some(c => c.table === 'booking_settings' && c.cols === '*') && CALLS.some(c => c.table === 'room_blocks_state'), 'selects=' + wbSelects());
  const okBadge = Array.prototype.find.call(st.querySelectorAll('.st'), e => e.textContent.indexOf('ปกติ') !== -1);
  ok('ซิงก์ 3 นาทีที่แล้ว (เกณฑ์ 30): ป้าย "ปกติ" สีเขียว · บอก "สำเร็จล่าสุด … 3 นาทีที่แล้ว"', !!okBadge && okBadge.classList.contains('st-ok') && st.textContent.indexOf('3 นาทีที่แล้ว') !== -1 && st.textContent.indexOf('สำเร็จล่าสุด') !== -1, st.textContent);
  ok('บอกจำนวนที่ซิงก์ได้: เห็นนัดในปฏิทิน 12 นัด · ช่วงที่ห้องไม่ว่าง 5 ช่วง', st.textContent.indexOf('12 นัด') !== -1 && st.textContent.indexOf('5 ช่วง') !== -1, st.textContent);
  ok('บอกว่ารับจองออนไลน์ เปิดอยู่', st.textContent.indexOf('เปิดอยู่') !== -1, st.textContent);
  ok('ซิงก์ปกติ: ไม่มีคำเตือนแดง · ไม่มีข้อผิดพลาด', !st.querySelector('.wk-red') && st.textContent.indexOf('เว็บรับจองไม่ได้') === -1 && st.textContent.indexOf('ข้อผิดพลาดล่าสุด') === -1, st.innerHTML);
  ok('บอกว่าบอทซิงก์เองทุก ~5 นาที · ไม่มีปุ่ม "ซิงก์ตอนนี้" (หัวหน้าเลือกแบบ A)', st.textContent.indexOf('~5 นาที') !== -1 && !Array.prototype.some.call(dlg.querySelectorAll('button'), b => b.textContent.indexOf('ซิงก์') !== -1), st.textContent);
  const small = Array.prototype.filter.call(dlg.querySelectorAll('*'), el => el.offsetParent !== null && Array.prototype.some.call(el.childNodes, n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(el).fontSize) < 14).map(el => el.tagName + '.' + el.className);
  ok('ตัวหนังสือทุกชิ้นในหน้าต่าง ≥ 14px', small.length === 0, small.join(' '));

  // ── 3. ซิงก์เก่าเกิน ──
  STATE.last_ok_at = ago(45); STATE.last_try_at = ago(45);
  await openDlg();
  const red = st.querySelector('.wk-red');
  ok('ซิงก์ 45 นาทีที่แล้ว (เกณฑ์ 30) + เปิดตารางสอน: ป้าย "เก่าเกิน 30 นาที" · ไม่ใช่ "ปกติ"', st.textContent.indexOf('เก่าเกิน 30 นาที') !== -1 && st.textContent.indexOf('ปกติ') === -1 && st.textContent.indexOf('45 นาทีที่แล้ว') !== -1, st.textContent);
  ok('บอกผลกระทบเป็นคำเตือนแดงตัวหนา: เว็บรับจองไม่ได้ตอนนี้ (ไม่พึ่งสีอย่างเดียว)', !!red && red.textContent.indexOf('เว็บรับจองไม่ได้ตอนนี้') !== -1 && bold(red) && isRed(red), red && red.textContent);

  SETTINGS.sync_stale_minutes = 15; STATE.last_ok_at = ago(20); STATE.last_try_at = ago(20);
  await openDlg();
  ok('เกณฑ์ตั้งเป็น 15 นาที ซิงก์ 20 นาทีที่แล้ว: ป้ายบอกเกณฑ์ที่ตั้งจริง "เก่าเกิน 15 นาที" (ไม่ตายตัว 30)', st.textContent.indexOf('เก่าเกิน 15 นาที') !== -1 && st.textContent.indexOf('เก่าเกิน 30') === -1, st.textContent);
  STATE.last_ok_at = ago(12);
  await openDlg();
  ok('เกณฑ์ 15 นาที ซิงก์ 12 นาทีที่แล้ว: ยัง "ปกติ" (ใช้เกณฑ์ที่ตั้ง ไม่ใช่ 10 หรือ 30)', st.textContent.indexOf('ปกติ') !== -1 && st.textContent.indexOf('เก่าเกิน') === -1, st.textContent);
  SETTINGS.sync_stale_minutes = 30;
  STATE.last_ok_at = ago(45); STATE.last_try_at = ago(45);

  // ── 4. ไม่เคยซิงก์ ──
  STATE.last_ok_at = null; STATE.last_try_at = null;
  await openDlg();
  ok('ไม่เคยซิงก์สำเร็จ: ป้าย "ยังไม่เคยซิงก์" · ไม่มีบรรทัด "สำเร็จล่าสุด" · ไม่โชว์จำนวนนัด', st.textContent.indexOf('ยังไม่เคยซิงก์') !== -1 && st.textContent.indexOf('สำเร็จล่าสุด') === -1 && st.textContent.indexOf('นัดในปฏิทิน') === -1, st.textContent);
  ok('ไม่เคยซิงก์ + เปิดตารางสอน: คำเตือนแดงตัวหนา "เว็บรับจองไม่ได้ตอนนี้" (ตรงกับ booking_blocks_stale ของฐาน)', !!st.querySelector('.wk-red') && st.querySelector('.wk-red').textContent.indexOf('เว็บรับจองไม่ได้ตอนนี้') !== -1 && bold(st.querySelector('.wk-red')));

  STATE.last_ok_at = null; STATE.last_try_at = ago(2); STATE.last_error = 'ต่อปฏิทินไม่ได้';
  await openDlg();
  ok('ไม่เคยซิงก์สำเร็จแต่ลองแล้วล้ม (กรณีตั้งระบบใหม่): เห็นทั้ง "ลองซิงก์ล่าสุด" และ "ข้อผิดพลาดล่าสุด"', st.textContent.indexOf('ลองซิงก์ล่าสุด') !== -1 && st.textContent.indexOf('ข้อผิดพลาดล่าสุด') !== -1 && st.textContent.indexOf('ต่อปฏิทินไม่ได้') !== -1, st.textContent);
  STATE.last_try_at = null; STATE.last_error = null;

  // ── 5. ปิดสวิตช์ตารางสอน ──
  SETTINGS.room_blocks_enabled = false;
  await openDlg();
  const syncBadge = () => Array.prototype.find.call(st.querySelectorAll('.st'), e => e.textContent.indexOf('ไม่ได้ใช้') !== -1 || e.textContent.indexOf('ยังไม่เคยซิงก์') !== -1 || e.textContent.indexOf('เก่าเกิน') !== -1 || e.textContent.indexOf('ปกติ') !== -1);
  ok('ปิดสวิตช์ตารางสอน + ไม่เคยซิงก์: ป้ายซิงก์เป็นสีกลาง "ไม่ได้ใช้ (ปิดอยู่)" (ไม่ใช่เหลือง "ยังไม่เคยซิงก์" — เจ้าของเคยเข้าใจว่ายังมีปัญหา) · ไม่มีป้ายเหลืองเลย', !!syncBadge() && syncBadge().textContent.indexOf('ไม่ได้ใช้ (ปิดอยู่)') !== -1 && syncBadge().classList.contains('st-off') && !st.querySelector('.st-warn') && st.textContent.indexOf('ยังไม่เคยซิงก์') === -1, st.innerHTML);
  ok('ปิดสวิตช์ตารางสอน + ไม่เคยซิงก์: ไม่ขึ้นว่าเว็บรับจองไม่ได้ (ฐานไม่สนตารางสอน) · อธิบายว่าสวิตช์ปิดอยู่', st.textContent.indexOf('เว็บรับจองไม่ได้') === -1 && st.textContent.indexOf('สวิตช์') !== -1 && st.textContent.indexOf('ไม่สนตารางสอน') !== -1 && !st.querySelector('.wk-red'), st.textContent);
  STATE.last_ok_at = ago(45);
  await openDlg();
  ok('ปิดสวิตช์ + ซิงก์เก่า: ป้ายสีกลางเหมือนกัน (ไม่เขียน "เก่าเกิน" เป็นเหลือง) แต่ยังบอกข้อเท็จจริงว่าสำเร็จล่าสุดเมื่อ 45 นาทีที่แล้ว · ไม่ขึ้นแดง', syncBadge().textContent.indexOf('ไม่ได้ใช้ (ปิดอยู่)') !== -1 && !st.querySelector('.st-warn') && st.textContent.indexOf('เก่าเกิน') === -1 && st.textContent.indexOf('45 นาทีที่แล้ว') !== -1 && !st.querySelector('.wk-red'), st.innerHTML);
  STATE.last_ok_at = ago(3);
  await openDlg();
  ok('ปิดสวิตช์ + ซิงก์สดใหม่: ป้ายสีกลาง "ไม่ได้ใช้ (ปิดอยู่)" ไม่ใช่เขียว "ปกติ" (ตอนปิดไม่ได้ใช้ ไม่ควรดูเหมือนระบบทำงานให้)', syncBadge().textContent.indexOf('ไม่ได้ใช้ (ปิดอยู่)') !== -1 && syncBadge().classList.contains('st-off') && st.textContent.indexOf('ปกติ') === -1, st.innerHTML);
  SETTINGS.room_blocks_enabled = true;
  STATE.last_ok_at = ago(45); STATE.last_try_at = ago(45);

  // ── 6. ข้อผิดพลาดล่าสุด / ลองล่าสุด ──
  STATE.last_ok_at = ago(10); STATE.last_try_at = ago(2); STATE.last_error = '<img src=x onerror="window.XSS=1">boom';
  await openDlg();
  const er = Array.prototype.find.call(st.querySelectorAll('.wk-red'), e => e.textContent.indexOf('boom') !== -1);
  ok('last_error แสดงเป็นแดงตัวหนา · ข้อความตรงตามที่เก็บ', !!er && bold(er) && isRed(er) && er.textContent === '<img src=x onerror="window.XSS=1">boom', er && er.textContent);
  ok('last_error มาจากฐาน (บอทเขียน) — แสดงเป็นข้อความ ไม่ใช่ HTML (ไม่มี img · สคริปต์ไม่รัน)', !st.querySelector('img') && window.XSS === undefined);
  ok('ลองซิงก์ล่าสุดใหม่กว่าสำเร็จล่าสุด (ลองแล้วล้ม): โชว์บรรทัด "ลองซิงก์ล่าสุด"', st.textContent.indexOf('ลองซิงก์ล่าสุด') !== -1, st.textContent);
  STATE.last_error = null; STATE.last_try_at = STATE.last_ok_at;
  await openDlg();
  ok('ลองล่าสุด = สำเร็จล่าสุด: ไม่โชว์บรรทัดซ้ำ · ไม่มีข้อผิดพลาด', st.textContent.indexOf('ลองซิงก์ล่าสุด') === -1 && st.textContent.indexOf('ข้อผิดพลาดล่าสุด') === -1, st.textContent);

  // ── 7. ไม่มีแถวสถานะเลย ──
  const keepState = STATE; STATE = null;
  await openDlg();
  ok('ไม่มีแถว room_blocks_state: ถือว่ายังไม่เคยซิงก์ (ไม่พัง)', st.textContent.indexOf('ยังไม่เคยซิงก์') !== -1 && !$('wbNote').offsetParent, st.textContent);
  STATE = keepState; STATE.last_ok_at = ago(3); STATE.last_try_at = ago(3);

  // ── 8. รีเฟรช ──
  await openDlg();
  const n0 = wbSelects();
  SETTINGS.max_hours_per_booking = 7; STATE.events_seen = 99;
  $('wbReload').click(); await sleep(40);
  ok('กด ↻ รีเฟรช: โหลดใหม่ทั้งสองตาราง · เห็นค่าล่าสุด (99 นัด · ชั่วโมงสูงสุด 7)', wbSelects() === n0 + 2 && $('wbStatus').textContent.indexOf('99 นัด') !== -1 && $('wbMaxHours').value === '7', 'selects +' + (wbSelects() - n0));
  SETTINGS.max_hours_per_booking = 4; STATE.events_seen = 12;

  // ── 9. ตรรกะล้วน ──
  const T0 = 1700000000000, iso = ms => new Date(ms).toISOString(), S = { sync_stale_minutes: 30, room_blocks_enabled: true };
  ok('wbSync: เก่าพอดีเกณฑ์ 30 นาที = ยังไม่เก่า (ฐานเทียบ ">" เทียบเป็นมิลลิวินาที)', wbSync(S, { last_ok_at: iso(T0) }, T0 + 30 * 60000).old === false);
  ok('wbSync: เกินเกณฑ์ 1 มิลลิวินาที = เก่า + บล็อกเว็บ', wbSync(S, { last_ok_at: iso(T0) }, T0 + 30 * 60000 + 1).old === true && wbSync(S, { last_ok_at: iso(T0) }, T0 + 30 * 60000 + 1).blocking === true);
  ok('wbSync: ไม่เคยซิงก์ (ไม่มีแถว/ค่าว่าง) = never + บล็อกเมื่อเปิดสวิตช์', wbSync(S, null, T0).never === true && wbSync(S, { last_ok_at: null }, T0).blocking === true);
  ok('wbSync: ปิดสวิตช์ตารางสอน = ไม่บล็อกเลยแม้ไม่เคยซิงก์/เก่า', wbSync({ sync_stale_minutes: 30, room_blocks_enabled: false }, null, T0).blocking === false && wbSync({ sync_stale_minutes: 30, room_blocks_enabled: false }, { last_ok_at: iso(T0 - 9e9) }, T0).blocking === false);
  ok('wbSync: ซิงก์สดใหม่ = ไม่บล็อก · เวลาในอนาคต (นาฬิกาเครื่องเพี้ยน) ไม่ติดลบ', wbSync(S, { last_ok_at: iso(T0) }, T0 + 1000).blocking === false && wbSync(S, { last_ok_at: iso(T0 + 5000) }, T0).ageMin === 0);
  ok('wbAgo: 0 · 1 · 59 · 60 · 61 · 1439 · 1440 · 2200 · 2900', [0, 1, 59, 60, 61, 1439, 1440, 2200, 2900].map(wbAgo).join('|') === 'เมื่อสักครู่|1 นาทีที่แล้ว|59 นาทีที่แล้ว|1 ชม.ที่แล้ว|1 ชม. 1 นาทีที่แล้ว|23 ชม. 59 นาทีที่แล้ว|1 วันที่แล้ว|1 วันที่แล้ว|2 วันที่แล้ว', [0, 1, 59, 60, 61, 1439, 1440, 2200, 2900].map(wbAgo).join('|'));
  ok('wbSync: อายุปัดลงเป็นนาทีเต็ม (3 นาที 40 วินาที = 3 ไม่ใช่ 4) · 59 วินาที = 0', wbSync(S, { last_ok_at: iso(T0) }, T0 + 3 * 60000 + 40000).ageMin === 3 && wbSync(S, { last_ok_at: iso(T0) }, T0 + 59000).ageMin === 0, wbSync(S, { last_ok_at: iso(T0) }, T0 + 3 * 60000 + 40000).ageMin);
  ok('wbWhen: ค่าเสีย = "-" (ไม่ขึ้น Invalid Date)', wbWhen('ไม่ใช่วันที่') === '-' && wbWhen('2026-10-06T05:15:00Z').indexOf('12:15') !== -1, wbWhen('2026-10-06T05:15:00Z'));

  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

// ───────── หน้า 2: ฟอร์มตั้งค่า + บันทึก (เจ้าของ) ─────────
const T_FORM = PRE + `<script>
const ALLOWED = ['web_booking_enabled', 'room_blocks_enabled', 'room_block_keywords', 'open_time', 'close_time', 'max_hours_per_booking', 'min_lead_minutes', 'max_days_ahead', 'max_pending_per_contact_per_day', 'max_web_bookings_per_hour', 'sync_stale_minutes', 'anonymize_after_months', 'auto_anonymize_enabled', 'updated_by', 'updated_at'];
const keys = u => Object.keys(u.payload).sort().join(',');
async function runTests() {
  L('=== จองออนไลน์: ฟอร์มตั้งค่า + บันทึก (เจ้าของ) ===');
  await login();
  showSection('booking');
  await sleep(100);

  // ── 1. ฟอร์มขึ้นตามค่าในฐาน ──
  await openDlg();
  ok('เจ้าของ: เห็นฟอร์มตั้งค่า + ปุ่มบันทึก · ไม่มีข้อความ "ดูอย่างเดียว"', shown($('wbSettings')) && shown($('wbSave')) && !shown($('wbRo')));
  ok('ติ๊ก 2 ช่อง + คำค้นตามฐาน', $('wbEnabled').checked === true && $('wbBlocks').checked === true && $('wbKeywords').value === 'ห้องซ้อม', $('wbKeywords').value);
  ok('เวลาเปิด/ปิดตัด :00 วินาทีออก (ช่องเวลา HH:MM)', $('wbOpen').value === '12:00' && $('wbClose').value === '20:00', $('wbOpen').value + ' ' + $('wbClose').value);
  ok('ตัวเลขทั้ง 6 ช่องตามฐาน (4 · 60 · 30 · 2 · 10 · 30)', ['wbMaxHours', 'wbLead', 'wbAhead', 'wbPend', 'wbHour', 'wbStale'].map(i => $(i).value).join(',') === '4,60,30,2,10,30', ['wbMaxHours', 'wbLead', 'wbAhead', 'wbPend', 'wbHour', 'wbStale'].map(i => $(i).value).join(','));
  ok('ไม่มีช่องราคา/แต้ม/ชุดอุปกรณ์/ช่องทางที่มาในแผงนี้ (เจ้าของสั่งไม่รวม)', !/ราคา|แต้ม|ชุดอุปกรณ์|equipment|ช่องทางที่มา/.test(dlg.textContent), dlg.textContent.slice(0, 200));
  ok('เจ้าของเห็นส่วน "ข้อมูลส่วนตัวของลูกค้าที่จองจากเว็บ" · เก็บ 12 เดือน · บอทล้างเองปิดอยู่', shown($('wbOwner')) && $('wbMonths').value === '12' && $('wbAuto').checked === false, $('wbMonths').value);

  // ── 2. ไม่เปลี่ยนอะไร ──
  const sub = new Event('submit', { cancelable: true });
  $('wbForm').dispatchEvent(sub);
  await sleep(20);
  ok('ส่งฟอร์ม (Enter/ปุ่มบันทึก): กันเบราว์เซอร์ส่งฟอร์มเอง (preventDefault) — ไม่งั้นหน้าคอนโซลโหลดใหม่ · และทำงานบันทึกจริง', sub.defaultPrevented === true && !dlg.open && toast() === 'ไม่มีอะไรเปลี่ยน', 'prevented=' + sub.defaultPrevented + ' open=' + dlg.open);
  await openDlg();
  $('wbCancel').click();
  ok('ปุ่ม "ปิด (Esc)": ปิดหน้าต่าง ไม่เขียนฐาน', !dlg.open && updates().length === 0, 'open=' + dlg.open);
  await openDlg();
  await wbSave();
  ok('กดบันทึกโดยไม่แก้อะไร: ไม่เขียนฐาน · ปิดหน้าต่าง · บอก "ไม่มีอะไรเปลี่ยน" (ช่องเวลาที่ฐานเก็บ HH:MM:SS ไม่ถูกมองว่าเปลี่ยน)', updates().length === 0 && !dlg.open && toast() === 'ไม่มีอะไรเปลี่ยน', 'updates=' + updates().length + ' toast=' + toast());

  // ── 3. แก้ช่องเดียว ──
  await openDlg();
  $('wbMaxHours').value = '6';
  await wbSave();
  const u1 = updates()[0];
  ok('แก้ชั่วโมงสูงสุด 4→6: เขียนครั้งเดียว ตาราง booking_settings แถว id=true', updates().length === 1 && u1.table === 'booking_settings' && u1.eq.id === true, JSON.stringify(u1));
  ok('ส่งเฉพาะช่องที่เปลี่ยน (เป็นตัวเลข) + ผู้แก้/เวลาแก้ — ไม่ส่งช่องอื่น', !!u1 && keys(u1) === 'max_hours_per_booking,updated_at,updated_by' && u1.payload.max_hours_per_booking === 6 && u1.payload.updated_by === 'u1' && typeof u1.payload.updated_at === 'string', u1 && keys(u1));
  ok('บันทึกสำเร็จ: ปิดหน้าต่าง · แจ้งว่าอะไรเปลี่ยน (ชั่วโมงสูงสุดต่อใบจอง 4 → 6)', !dlg.open && toast().indexOf('✅') === 0 && toast().indexOf('ชั่วโมงสูงสุดต่อใบจอง 4 → 6') !== -1, toast());
  await openDlg();
  ok('เปิดใหม่: เห็นค่าที่บันทึกแล้ว (6)', $('wbMaxHours').value === '6', $('wbMaxHours').value);

  // ── 4. เปลี่ยนหลายช่อง ──
  $('wbEnabled').checked = false; $('wbBlocks').checked = false;
  $('wbOpen').value = '11:00'; $('wbClose').value = '21:30';
  $('wbKeywords').value = ' ห้องซ้อม , Studio ,ห้องซ้อม, studio';
  $('wbLead').value = '120'; $('wbStale').value = '15';
  await wbSave();
  const u2 = updates()[1];
  ok('เปลี่ยนหลายช่อง: ส่งครบเฉพาะที่เปลี่ยน (สวิตช์ 2 ตัว · เวลาเปิด/ปิด · คำค้น · ล่วงหน้า · เกณฑ์ซิงก์)', !!u2 && keys(u2) === 'close_time,min_lead_minutes,open_time,room_block_keywords,room_blocks_enabled,sync_stale_minutes,updated_at,updated_by,web_booking_enabled', u2 && keys(u2));
  ok('ค่าถูกชนิด: bool · เวลา "HH:MM" · คำค้นเป็นอาร์เรย์ไม่ซ้ำ (ไม่สนตัวพิมพ์) ตัดช่องว่าง · ตัวเลขเป็น number', !!u2 && u2.payload.web_booking_enabled === false && u2.payload.room_blocks_enabled === false && u2.payload.open_time === '11:00' && u2.payload.close_time === '21:30' && JSON.stringify(u2.payload.room_block_keywords) === JSON.stringify(['ห้องซ้อม', 'Studio']) && u2.payload.min_lead_minutes === 120 && u2.payload.sync_stale_minutes === 15, JSON.stringify(u2 && u2.payload));
  ok('แจ้งผลบอกสวิตช์ที่ปิด', toast().indexOf('เปิดรับจองออนไลน์: ปิด') !== -1 && toast().indexOf('ตารางสอนทำให้ห้องเต็ม: ปิด') !== -1, toast());
  ok('แจ้งผลบอกค่าเดิม → ค่าใหม่ ของเวลา/คำค้น/ตัวเลข', toast().indexOf('เวลาเปิดรับจอง 12:00 → 11:00') !== -1 && toast().indexOf('เวลาปิด 20:00 → 21:30') !== -1 && toast().indexOf('คำที่บอกว่านัดใช้ห้องซ้อม ห้องซ้อม → ห้องซ้อม,Studio') !== -1 && toast().indexOf('จองล่วงหน้าอย่างน้อย (นาที) 60 → 120') !== -1, toast());
  await openDlg();
  ok('เปิดใหม่: สวิตช์ปิดอยู่ · เวลา 11:00–21:30 · คำค้นคั่นด้วยจุลภาค', $('wbEnabled').checked === false && $('wbBlocks').checked === false && $('wbOpen').value === '11:00' && $('wbClose').value === '21:30' && $('wbKeywords').value === 'ห้องซ้อม, Studio', $('wbKeywords').value);
  ok('สถานะในแผงตามค่าใหม่: ปิดอยู่', $('wbStatus').textContent.indexOf('ปิดอยู่') !== -1, $('wbStatus').textContent);

  // ── 5. ตัวเลขนอกช่วง/ไม่ใช่จำนวนเต็ม ──
  let bad = 0, badMsg = [];
  for (const [id, lbl, mn, mx] of INTS) {
    for (const v of ['', String(mn - 1), String(mx + 1), '4.5', '1e1']) {
      await openDlg();
      $(id).value = v; $('wbErr').hidden = true;
      const before = updates().length;
      await wbSave();
      const e = $('wbErr');
      if (!(updates().length === before && !e.hidden && dlg.open && e.textContent.indexOf(lbl) !== -1 && e.textContent.indexOf(mn + ' ถึง ' + mx) !== -1)) { bad++; badMsg.push(id + '=' + v + ' → ' + e.textContent + ' hidden=' + e.hidden + ' updates+' + (updates().length - before)); }
    }
  }
  ok('ตัวเลขทั้ง 6 ช่อง × 5 ค่าเสีย (ว่าง · ต่ำกว่า · สูงกว่า · ทศนิยม · 1e1): ไม่เขียนฐาน · หน้าต่างค้าง · ข้อความบอกชื่อช่อง + ช่วงที่ถูก', bad === 0, badMsg.slice(0, 3).join(' || '));
  await openDlg();
  $(INTS[0][0]).value = '0'; $('wbErr').hidden = true; await wbSave();
  ok('ข้อความผิดพลาดเป็นแดงตัวหนา (ไม่พึ่งสีอย่างเดียว)', !$('wbErr').hidden && bold($('wbErr')), getComputedStyle($('wbErr')).fontWeight);

  // ── 6. ขอบช่วงที่ถูกต้อง: ต่ำสุด/สูงสุดต้องผ่าน ──
  let okEdge = 0, edgeBad = [];
  for (const [id, lbl, mn, mx, key] of INTS) {
    for (const v of [mn, mx]) {
      await openDlg();
      $(id).value = String(v);
      const n = updates().length;
      await wbSave();
      const u = updates()[n];
      if (updates().length === n + 1 && u.payload[key] === v && !dlg.open) okEdge++; else edgeBad.push(key + '=' + v);
    }
  }
  ok('ขอบช่วงที่ถูก (ต่ำสุด/สูงสุดของแต่ละช่อง = 12 ค่า) บันทึกผ่านทุกค่า', okEdge === 12, edgeBad.join(','));

  // ── 7. เวลา ──
  await openDlg();
  $('wbOpen').value = '20:00'; $('wbClose').value = '12:00'; $('wbErr').hidden = true;
  let n = updates().length; await wbSave();
  ok('เวลาปิดก่อนเวลาเปิด: ไม่เขียนฐาน · ข้อความ "เวลาปิดต้องหลังเวลาเปิด"', updates().length === n && !$('wbErr').hidden && $('wbErr').textContent.indexOf('เวลาปิดต้องหลังเวลาเปิด') !== -1, $('wbErr').textContent);
  $('wbOpen').value = '12:00'; $('wbClose').value = '12:00'; $('wbErr').hidden = true; await wbSave();
  ok('เวลาปิดเท่าเวลาเปิด: ไม่ผ่านเหมือนกัน (ฐาน check close_time > open_time)', updates().length === n && !$('wbErr').hidden, $('wbErr').textContent);
  $('wbOpen').value = ''; $('wbClose').value = '20:00'; $('wbErr').hidden = true; await wbSave();
  ok('เวลาเปิดว่าง: ไม่เขียนฐาน · บอกให้กรอกให้ครบ', updates().length === n && !$('wbErr').hidden && $('wbErr').textContent.indexOf('เวลาเปิดรับจอง') !== -1, $('wbErr').textContent);
  $('wbOpen').value = '12:00'; $('wbClose').value = ''; $('wbErr').hidden = true; await wbSave();
  ok('เวลาปิดว่าง: ไม่เขียนฐาน · บอกให้กรอกให้ครบ', updates().length === n && !$('wbErr').hidden && $('wbErr').textContent.indexOf('เวลาปิด') !== -1, $('wbErr').textContent);
  $('wbOpen').value = '12:00'; $('wbClose').value = '12:01'; await wbSave();
  ok('เวลาปิดหลังเวลาเปิดแค่ 1 นาที: ผ่าน (ขอบ)', updates().length === n + 1 && updates()[n].payload.close_time === '12:01', JSON.stringify(updates()[n]));

  // ── 8. คำค้นตารางสอน ──
  await openDlg();
  $('wbKeywords').value = ''; $('wbErr').hidden = true; n = updates().length; await wbSave();
  ok('คำค้นว่าง: ไม่เขียนฐาน · บอกให้ใส่อย่างน้อย 1 คำ (หรือปิดสวิตช์ตารางสอน)', updates().length === n && !$('wbErr').hidden && $('wbErr').textContent.indexOf('อย่างน้อย 1 คำ') !== -1, $('wbErr').textContent);
  $('wbKeywords').value = ' , ,  ,'; $('wbErr').hidden = true; await wbSave();
  ok('คำค้นเป็นจุลภาค/ช่องว่างล้วน: ถือว่าว่าง', updates().length === n && !$('wbErr').hidden, $('wbErr').textContent);
  $('wbKeywords').value = 'Studio A,Studio B , ห้องซ้อม'; await wbSave();
  ok('คำค้นหลายคำคั่นด้วยจุลภาค: ตัดช่องว่างหัวท้าย เก็บช่องว่างกลางคำ (Studio A)', updates().length === n + 1 && JSON.stringify(updates()[n].payload.room_block_keywords) === JSON.stringify(['Studio A', 'Studio B', 'ห้องซ้อม']), JSON.stringify(updates()[n] && updates()[n].payload));

  // ── 9. ฐานปฏิเสธ ──
  await openDlg();
  MODE.denyUpdate = true;
  $('wbMaxHours').value = '9';
  const toast0 = toast();                 // ข้อความลอยของรอบที่สำเร็จก่อนหน้ายังค้างอยู่ — ต้องไม่ถูกเขียนทับด้วยข้อความสำเร็จของรอบนี้
  n = updates().length; await wbSave();
  ok('RLS ปฏิเสธเงียบ ๆ (0 แถว): ไม่ขึ้นว่าสำเร็จ — หน้าต่างค้าง · แถบแดงตัวหนาบอกว่าฐานไม่ได้บันทึก', updates().length === n + 1 && dlg.open && !$('wbErr').hidden && $('wbErr').textContent.indexOf('ไม่ได้บันทึก') !== -1 && bold($('wbErr')) && toast() === toast0, $('wbErr').textContent + ' | ' + toast());
  MODE.denyUpdate = false;
  MODE.updateError = { code: '23514', message: 'new row violates check constraint "booking_settings_open_close_check"' };
  await wbSave();
  ok('ฐานปฏิเสธด้วย check (23514): แถบแดงบอกว่าไม่ผ่านเงื่อนไขของฐาน · หน้าต่างค้าง', dlg.open && !$('wbErr').hidden && $('wbErr').textContent.indexOf('ไม่ผ่านเงื่อนไขของฐานข้อมูล') !== -1, $('wbErr').textContent);
  MODE.updateError = { code: '42501', message: 'permission denied for table booking_settings' };
  await wbSave();
  ok('ฐานปฏิเสธสิทธิ์ (42501): บอกว่าไม่มีสิทธิ์ (เป็นภาษาไทย)', dlg.open && $('wbErr').textContent.indexOf('ไม่มีสิทธิ์') !== -1, $('wbErr').textContent);
  MODE.updateError = { message: 'เครือข่ายล่ม' };
  await wbSave();
  ok('error อื่น: แสดงข้อความจริงให้เห็น (ไม่กลืน)', dlg.open && $('wbErr').textContent.indexOf('เครือข่ายล่ม') !== -1, $('wbErr').textContent);
  MODE.updateError = null;
  await wbSave();
  ok('แก้เหตุแล้วกดบันทึกอีกครั้ง: สำเร็จ · ปิดหน้าต่าง · แถบแดงหาย', !dlg.open && toast().indexOf('✅') === 0, toast());
  await openDlg();
  ok('เปิดหน้าต่างใหม่: ไม่มีข้อความผิดพลาดของรอบก่อนค้าง', $('wbErr').hidden === true, String($('wbErr').hidden));

  // ── 10. ปุ่มบันทึกระหว่างรอ ──
  let rel; MODE.holdUpdate = new Promise(r => { rel = r; });
  $('wbMaxHours').value = '5';
  const pSave = wbSave(); await sleep(20);
  ok('ระหว่างรอฐานตอบ: ปุ่มบันทึกถูกปิด (กดซ้ำไม่ได้)', $('wbSave').disabled === true);
  rel(); await pSave; MODE.holdUpdate = null;
  ok('ฐานตอบแล้ว: ปุ่มกลับมาใช้ได้ · บันทึกสำเร็จ', $('wbSave').disabled === false && !dlg.open);

  // ── 11. ออกจากระบบ/สลับบัญชีระหว่างรอบันทึก ──
  await openDlg();
  MODE.holdUpdate = new Promise(r => { rel = r; });
  $('wbMaxHours').value = '8';
  const toastBefore = toast();
  const pSave2 = wbSave(); await sleep(20);
  wbReset();
  MODE.denyUpdate = true;                 // ผลที่มาทีหลังเป็น "ฐานไม่ได้บันทึก" — ถ้าไม่ทิ้ง จะไปขึ้นแถบแดงในหน้าจอคนใหม่
  rel(); await pSave2; MODE.holdUpdate = null; MODE.denyUpdate = false;
  ok('สลับบัญชีระหว่างรอบันทึก: ผลที่มาถึงทีหลังถูกทิ้ง ไม่ขึ้นแถบผิดพลาด/ข้อความสำเร็จในหน้าจอคนใหม่', $('wbErr').hidden === true && toast() === toastBefore, 'err.hidden=' + $('wbErr').hidden + ' toast=' + toast());

  // ── 12. ทุกคำสั่งเขียนใช้เฉพาะช่องที่อนุญาต ──
  const all = updates();
  const stray = [];
  all.forEach(u => Object.keys(u.payload).forEach(k => { if (ALLOWED.indexOf(k) === -1) stray.push(k); }));
  ok('ทุกคำสั่งเขียน (' + all.length + ' ครั้ง) แตะเฉพาะช่องในแผง — ไม่มีราคา/แต้ม/ชุดอุปกรณ์/ช่องทางที่มา/ล้างตัวตน', stray.length === 0 && all.every(u => u.table === 'booking_settings' && u.eq.id === true), stray.join(','));

  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

// ───────── หน้า 2b: เปิดสวิตช์ตารางสอนทั้งที่ซิงก์ยังไม่ผ่าน = ถามก่อน (เหตุการณ์จริง 6 ต.ค. 69: เปิดแล้วเว็บรับจองไม่ได้ ~3 นาที) ─────────
const T_BLOCKS = PRE + `<script>
const CONF = () => $('confirmDialog');
const only = u => Object.keys(u.payload).sort().join(',');
async function tick(on, extra) {          // เปิดแผง → ตั้งช่องติ๊ก (+ ช่องอื่นถ้าส่งมา) → กดบันทึก
  await openDlg();
  $('wbBlocks').checked = on;
  if (extra) extra();
  await wbSave(); await sleep(20);
}
async function runTests() {
  L('=== จองออนไลน์: เปิด "ตารางสอนทำให้ห้องเต็ม" ทั้งที่ซิงก์ยังไม่ผ่าน ===');
  await login();
  showSection('booking');
  await sleep(100);
  // อีเวนต์ close ของ <dialog> ใน Chrome headless + งบเวลาเสมือนยิงตอนสิ้นงบ — onclose="confirmFn = null" ของรอบก่อนจะมาทับรอบใหม่ → ถอดในเทสต์เท่านั้น (ดูหมายเหตุใน T_ANON)
  CONF().onclose = null;

  const hint = $('wbBlocks').closest('.field').querySelector('.hint .wk-red');
  ok('ข้อความเตือนใต้ช่องติ๊ก: แดงตัวหนา "เว็บจะรับจองไม่ได้ทันที" (ไม่ใช่ตัวอักษรเทาธรรมดา)', !!hint && hint.textContent.indexOf('เว็บจะรับจองไม่ได้ทันที') !== -1 && bold(hint) && isRed(hint), hint && hint.textContent);

  // ── ไม่เคยซิงก์ + ติ๊กเปิด ──
  SETTINGS.room_blocks_enabled = false; STATE.last_ok_at = null; STATE.last_try_at = null;
  await tick(true);
  const box = $('confirmBody').querySelector('.alert-red');
  ok('ปิด→เปิด ตอนยังไม่เคยซิงก์: ขึ้นหน้าต่างยืนยัน — ยังไม่เขียนฐาน · หน้าต่างตั้งค่ายังเปิดอยู่', CONF().open && updates().length === 0 && dlg.open, 'confirm=' + CONF().open + ' updates=' + updates().length);
  ok('คำเตือนแดงตัวหนา: เว็บจะรับจองไม่ได้ทันที · บอทยังไม่เคยซิงก์สำเร็จเลย · ลูกค้าถูกขอให้ทักร้านแทน', !!box && bold(box) && box.textContent.indexOf('เว็บจะรับจองไม่ได้ทันที') !== -1 && box.textContent.indexOf('บอทยังไม่เคยซิงก์ตารางสอนสำเร็จเลย') !== -1 && box.textContent.indexOf('ทักร้านแทน') !== -1, box && box.textContent);
  ok('ปุ่มยืนยันบอกตรง ๆ "เปิดทั้งที่ซิงก์ยังไม่ผ่าน" (ไม่ใช่ "ตกลง")', $('confirmOkBtn').textContent === 'เปิดทั้งที่ซิงก์ยังไม่ผ่าน', $('confirmOkBtn').textContent);
  CONF().close(); await sleep(10);
  ok('ปิดหน้าต่างยืนยัน (ไม่เปิด): ไม่เขียนฐาน · หน้าต่างตั้งค่ายังอยู่ ช่องยังติ๊กอยู่ (แก้ต่อได้)', updates().length === 0 && dlg.open && $('wbBlocks').checked === true, 'updates=' + updates().length);
  await wbSave(); await sleep(10);
  $('confirmOkBtn').click(); await sleep(40);
  ok('กดยืนยัน: เขียนฐานเฉพาะ room_blocks_enabled=true (+ ผู้แก้/เวลา) · ปิดหน้าต่างยืนยันและหน้าต่างตั้งค่า · แจ้งสำเร็จ', updates().length === 1 && only(updates()[0]) === 'room_blocks_enabled,updated_at,updated_by' && updates()[0].payload.room_blocks_enabled === true && !CONF().open && !dlg.open && toast().indexOf('✅') === 0, JSON.stringify(updates().map(u => u.payload)) + ' conf=' + CONF().open);

  // ── ซิงก์เก่าเกินเกณฑ์ ──
  SETTINGS.room_blocks_enabled = false; STATE.last_ok_at = ago(45); STATE.last_try_at = ago(45);
  let n = updates().length;
  await tick(true);
  ok('ซิงก์เก่าเกินเกณฑ์ (45 นาที เกณฑ์ 30): ถามเหมือนกัน · บอกอายุจริง "ซิงก์ล่าสุดเมื่อ 45 นาทีที่แล้ว เก่าเกินเกณฑ์"', CONF().open && updates().length === n && $('confirmBody').textContent.indexOf('ซิงก์ล่าสุดเมื่อ 45 นาทีที่แล้ว เก่าเกินเกณฑ์') !== -1 && $('confirmBody').textContent.indexOf('ยังไม่เคยซิงก์') === -1, $('confirmBody').textContent);
  CONF().close(); await sleep(10);
  $('wbStale').value = '60';
  await wbSave(); await sleep(40);
  ok('ติ๊กเปิดพร้อมขยายเกณฑ์เป็น 60 นาทีในครั้งเดียวกัน (45 < 60 ไม่เก่าแล้ว): ไม่ต้องถาม — ตัดสินจากค่าที่จะบันทึก ไม่ใช่ค่าเดิม · เขียนทั้งสองช่อง', !CONF().open && updates().length === n + 1 && only(updates()[n]) === 'room_blocks_enabled,sync_stale_minutes,updated_at,updated_by', JSON.stringify(updates()[n] && updates()[n].payload));
  SETTINGS.sync_stale_minutes = 30;

  // ── กรณีที่ไม่ต้องถาม ──
  SETTINGS.room_blocks_enabled = false; STATE.last_ok_at = ago(3); STATE.last_try_at = ago(3);
  n = updates().length;
  await tick(true);
  ok('ซิงก์ปกติ (3 นาที): ติ๊กเปิดได้เลย ไม่ถาม', !CONF().open && updates().length === n + 1 && updates()[n].payload.room_blocks_enabled === true, 'conf=' + CONF().open);
  SETTINGS.room_blocks_enabled = true; STATE.last_ok_at = null; STATE.last_try_at = null;
  n = updates().length;
  await tick(true, () => { $('wbMaxHours').value = '5'; });
  ok('เปิดอยู่แล้วและยังไม่เคยซิงก์ แก้ช่องอื่น: ไม่ถาม (ไม่ได้เป็นคนเปิดตอนนี้ — แถบแดงบนหน้าบอกอยู่แล้ว)', !CONF().open && updates().length === n + 1 && only(updates()[n]) === 'max_hours_per_booking,updated_at,updated_by', JSON.stringify(updates()[n] && updates()[n].payload));
  SETTINGS.room_blocks_enabled = true;
  n = updates().length;
  await tick(false);
  ok('ปิดสวิตช์ (เปิด→ปิด) ตอนยังไม่เคยซิงก์: ไม่ถาม — ปิดเป็นการแก้ปัญหา', !CONF().open && updates().length === n + 1 && updates()[n].payload.room_blocks_enabled === false, 'conf=' + CONF().open);
  SETTINGS.room_blocks_enabled = false;
  n = updates().length;
  await tick(false, () => { $('wbMaxHours').value = '6'; });
  ok('สวิตช์ปิดอยู่และไม่แตะ แก้ช่องอื่นตอนยังไม่เคยซิงก์: ไม่ถาม', !CONF().open && updates().length === n + 1 && only(updates()[n]) === 'max_hours_per_booking,updated_at,updated_by', JSON.stringify(updates()[n] && updates()[n].payload));

  // ── ออกจากระบบ/เปลี่ยนผู้ใช้/กดซ้ำระหว่างหน้าต่างยืนยันเปิด ──
  SETTINGS.room_blocks_enabled = false; STATE.last_ok_at = null; STATE.last_try_at = null;
  n = updates().length;
  await tick(true);
  wbReset();
  $('confirmOkBtn').click(); await sleep(40);
  ok('ล้างแผง (ออกจากระบบ/สลับบัญชี) ตอนหน้าต่างยืนยันค้างอยู่ แล้วมีคนกดยืนยัน: ไม่เขียนฐาน · หน้าต่างยืนยันปิด', updates().length === n && !CONF().open, 'updates+' + (updates().length - n) + ' conf=' + CONF().open);
  await tick(true);
  currentUserId = 'u-someone-else';
  $('confirmOkBtn').click(); await sleep(40);
  currentUserId = 'u1';
  ok('เปลี่ยนผู้ใช้ตอนหน้าต่างยืนยันค้างอยู่ แล้วกดยืนยัน: ไม่เขียนฐานในนามคนใหม่ · หน้าต่างยืนยันปิด', updates().length === n && !CONF().open, 'updates+' + (updates().length - n));
  await tick(true);
  let rel; MODE.holdUpdate = new Promise(r => { rel = r; });
  $('confirmOkBtn').click(); $('confirmOkBtn').click(); await sleep(20);
  rel(); await sleep(40); MODE.holdUpdate = null;
  ok('กดยืนยันรัว ๆ: เขียนฐานครั้งเดียว', updates().length === n + 1, 'updates+' + (updates().length - n));

  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

// ───────── หน้า 3: พนักงาน (ดูได้ ตั้งค่าไม่ได้) + ผู้ดูแล (ตั้งค่าได้) ─────────
const T_STAFF = PRE + `<script>
async function runTests() {
  L('=== จองออนไลน์: สิทธิ์ตามตำแหน่ง ===');
  await login();
  showSection('booking');
  await sleep(100);
  const role = currentAdmin && currentAdmin.role;
  ok('ตำแหน่งที่ทดสอบ = ' + CFG.role, role === CFG.role, String(role));
  ok('ทุกคนในทีมเห็นปุ่ม "⚙ จองออนไลน์"', shown($('wbBtn')));
  await openDlg();
  ok('ทุกตำแหน่งเห็นแถบสถานะซิงก์', shown($('wbStatus')) && $('wbStatus').textContent.indexOf('ปกติ') !== -1, $('wbStatus').textContent);
  ok('ส่วน "ข้อมูลส่วนตัวของลูกค้า / ล้างข้อมูล" ไม่โชว์ (เฉพาะเจ้าของ แม้ผู้ดูแลก็ไม่เห็น)', !shown($('wbOwner')) && $('wbOwner').hidden === true);
  await wbAnonCheck();
  wb.anon = { count: 3, before: '2025-01-01' }; wbAnonConfirm();
  await sleep(10);
  ok('เรียกฟังก์ชันตรวจ/ยืนยันล้างข้อมูลตรง ๆ (ข้ามปุ่มที่ซ่อน): ไม่เรียกฐาน ไม่เปิดหน้าต่างยืนยัน', CALLS.filter(c => c.op === 'rpc' && c.name === 'booking_anonymize_expired').length === 0 && !$('confirmDialog').open, 'open=' + $('confirmDialog').open);
  if (CFG.role === 'staff') {
    ok('พนักงาน: ไม่เห็นฟอร์มตั้งค่า · ไม่เห็นปุ่มบันทึก · เห็นข้อความว่าตั้งค่าได้เฉพาะเจ้าของร้านหรือผู้ดูแล', !shown($('wbSettings')) && !shown($('wbSave')) && shown($('wbRo')) && $('wbRo').textContent.indexOf('เจ้าของร้านหรือผู้ดูแล') !== -1);
    ok('ช่องตั้งค่าไม่ถูกเติมค่า (ไม่รั่วค่าให้พนักงานอ่านจากช่องที่ซ่อน)', $('wbKeywords').value === '' && $('wbMaxHours').value === '', $('wbKeywords').value + '|' + $('wbMaxHours').value);
    wbFill(); $('wbMaxHours').value = '9';     // เติมฟอร์มที่ซ่อนให้ครบและแก้ค่า — ถ้ามีแค่ช่องว่างจะตกที่การตรวจฟอร์มก่อนถึงด่านสิทธิ์ (ผลเท่ากัน)
    await wbSave();
    ok('พนักงานเรียก wbSave ตรง ๆ (ข้ามปุ่มที่ซ่อน แม้ฟอร์มครบและมีการแก้): ไม่เขียนฐาน', updates().length === 0, 'updates=' + updates().length);
    ok('พนักงานกด Enter ส่งฟอร์มไม่ได้เขียนฐาน', (() => { $('wbForm').dispatchEvent(new Event('submit', { cancelable: true })); return updates().length === 0; })());
    MODE.settingsError = { message: 'boom' };
    $('wbReload').click(); await sleep(40);
    ok('พนักงาน + โหลดล้ม: ไม่ขึ้นข้อความ "ตั้งค่าได้เฉพาะเจ้าของร้าน" (ข้อความนั้นเฉพาะตอนโหลดสำเร็จ)', $('wbRo').hidden === true && $('wbStatus').textContent.indexOf('boom') !== -1, $('wbStatus').textContent);
    MODE.settingsError = null;
  } else {
    ok('ผู้ดูแล (admin): เห็นฟอร์ม + ปุ่มบันทึก (ตรงกับ RLS booking_settings_admin_write ที่ให้ owner/admin)', shown($('wbSettings')) && shown($('wbSave')) && !shown($('wbRo')));
    $('wbMaxHours').value = '9';
    await wbSave();
    ok('ผู้ดูแลบันทึกได้ — ส่งเฉพาะช่องที่แก้ ไม่ติดช่องของเจ้าของ (เก็บกี่เดือน/ล้างเอง)', updates().length === 1 && updates()[0].payload.max_hours_per_booking === 9 && !dlg.open && Object.keys(updates()[0].payload).sort().join(',') === 'max_hours_per_booking,updated_at,updated_by', 'updates=' + updates().length + ' ' + JSON.stringify(updates()[0] && updates()[0].payload));
  }
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

// ───────── หน้า 4: ยังไม่รัน migration 041 ─────────
const T_NO041 = PRE + `<script>
async function runTests() {
  L('=== จองออนไลน์: ฐานที่ยังไม่รัน migration 041 ===');
  // ฐานจริงที่ยังไม่รัน 041: ไม่มีตาราง room_blocks_state (PostgREST ตอบ PGRST205) + แถวตั้งค่าไม่มีคอลัมน์เว็บ
  MODE.stateError = { code: 'PGRST205', message: 'Could not find the table public.room_blocks_state in the schema cache' };
  await login();
  showSection('booking');
  await sleep(100);
  await openDlg();
  const note = $('wbNote');
  ok('แถบเหลืองบอกให้รัน migration 041 (ไม่ใช่ error แดง)', shown(note) && note.classList.contains('alert-warn') && note.textContent.indexOf('041') !== -1, note.textContent);
  ok('ไม่มีแถบสถานะ · ไม่มีฟอร์ม · ไม่มีปุ่มบันทึก (ไม่มีอะไรให้ตั้ง)', !shown($('wbStatus')) && !shown($('wbSettings')) && !shown($('wbSave')));
  ok('ไม่มีข้อความแดง ไม่มีแถบผิดพลาดบนหน้าจอ (ฐานเก่ายังใช้งานปกติ) — ตารางสถานะที่ยังไม่มีไม่ถูกนับเป็น error', $('wbErr').hidden === true && !$('fatalError') && !visibleRed(), 'fatal=' + !!$('fatalError'));
  ok('หมวดจองห้องยังทำงานปกติ (ตั้งค่าเดิมโหลดได้)', typeof settings === 'object' && settings.pricePerHour === 800, JSON.stringify(settings));
  $('wbReload').click(); await sleep(40);
  ok('กดรีเฟรชบนฐานเก่า: ยังเป็นแถบเหลืองเดิม ไม่เปลี่ยนเป็นข้อผิดพลาด', shown(note) && !visibleRed());
  $('wbForm').dispatchEvent(new Event('submit', { cancelable: true }));
  await sleep(20);
  ok('ส่งฟอร์มตอนยังไม่มีข้อมูลตั้งค่า (ไม่ได้โหลด/ยังไม่รัน 041): ไม่เขียนฐาน ไม่มี error หลุดในหน้า (ตัวรันเทสต์ตรวจ error ที่ไม่ถูกดักให้เอง)', updates().length === 0, 'updates=' + updates().length);
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

// ───────── หน้า 5: โหลดล้ม · ผลที่มาช้า · ออกจากระบบ/สลับบัญชี ─────────
const T_EDGE = PRE + `<script>
async function runTests() {
  L('=== จองออนไลน์: โหลดล้ม · ผลที่มาช้า · ออกจากระบบ/สลับบัญชี ===');
  await login();
  showSection('booking');
  await sleep(100);
  const st = $('wbStatus');

  // ── โหลดล้ม: ต้องบอกตามจริง (กฎข้อ 8) ──
  MODE.settingsError = { message: 'boom-settings <img src=x onerror="window.XSS2=1">' };      // ข้อความ error มาจากฐาน/เครือข่าย — ต้องแสดงเป็นข้อความ ไม่ใช่ HTML
  await openDlg();
  ok('โหลดตั้งค่าล้ม: ข้อความแดงตัวหนาบอกสาเหตุจริง · ไม่มีฟอร์ม/ปุ่มบันทึก', !!st.querySelector('.wk-red') && st.textContent.indexOf('โหลดตั้งค่าการจองไม่สำเร็จ: boom-settings') !== -1 && bold(st.querySelector('.wk-red')) && isRed(st.querySelector('.wk-red')) && !shown($('wbSettings')) && !shown($('wbSave')), st.textContent);
  ok('ข้อความ error แสดงเป็นข้อความ (ไม่มี img · สคริปต์ไม่รัน)', !st.querySelector('img') && window.XSS2 === undefined);
  ok('โหลดล้ม ≠ ยังไม่รัน 041: ไม่ขึ้นแถบเหลือง', !shown($('wbNote')));
  MODE.settingsError = null;
  MODE.stateError = { message: 'boom-state <img src=x onerror="window.XSS3=1">', code: 'XX000' };
  $('wbReload').click(); await sleep(40);
  ok('โหลดสถานะซิงก์ล้ม (ฐานรัน 041 แล้ว): ข้อความแดงตัวหนาบอกสาเหตุ · ไม่แสดงสถานะครึ่งเดียว · ไม่มีฟอร์ม', st.textContent.indexOf('โหลดสถานะซิงก์ตารางสอนไม่สำเร็จ: boom-state') !== -1 && st.textContent.indexOf('ปกติ') === -1 && !shown($('wbSettings')) && !st.querySelector('img') && window.XSS3 === undefined, st.textContent);
  MODE.stateError = null;
  $('wbReload').click(); await sleep(40);
  ok('หายเสียแล้วกด ↻ รีเฟรช: กลับมาปกติ · ฟอร์มกลับมา · ข้อความผิดพลาดหาย', st.textContent.indexOf('ปกติ') !== -1 && shown($('wbSettings')) && st.textContent.indexOf('boom') === -1, st.textContent);

  // ── ผลที่มาช้า ──
  let rel; MODE.hold = new Promise(r => { rel = r; });
  await openDlg();
  ok('ระหว่างรอฐานตอบ: ขึ้น "กำลังโหลด…" · ยังไม่มีฟอร์ม', st.textContent.indexOf('กำลังโหลด') !== -1 && $('wbSettings').hidden === true, st.textContent);
  currentUserId = 'u-someone-else';
  rel(); await sleep(40); MODE.hold = null;
  ok('เปลี่ยนผู้ใช้ก่อนผลมา (หน้าต่างยังเปิดอยู่): ผลของคนเดิมถูกทิ้ง ไม่วาด', dlg.open && st.textContent.indexOf('รับจองออนไลน์') === -1 && $('wbSettings').hidden === true, st.textContent);
  currentUserId = 'u1';
  ok('(ตรวจตัวทดสอบเอง) ไม่ได้เปลี่ยนผู้ใช้ แล้วผลมาถึงปกติ = วาดจริง', await (async () => { MODE.hold = new Promise(r => { rel = r; }); $('wbReload').click(); await sleep(10); rel(); await sleep(40); MODE.hold = null; return st.textContent.indexOf('รับจองออนไลน์') !== -1 && $('wbSettings').hidden === false; })());
  await openDlg();

  // ── ออกจากระบบ/สลับบัญชีระหว่างโหลด (ผู้ใช้ยังเป็นคนเดิมในตัวแปร — เหลือตัวนับรอบเป็นตัวกัน) ──
  MODE.hold = new Promise(r => { rel = r; });
  $('wbReload').click(); await sleep(20);
  wbReset();
  rel(); await sleep(40); MODE.hold = null;
  ok('สลับบัญชี/ออกจากระบบกลางทางโหลด: ผลที่มาถึงทีหลังถูกทิ้ง (สถานะว่าง หน้าต่างไม่ถูกวาด)', st.textContent === '' && !dlg.open, st.textContent);
  await openDlg();

  // ── สลับบัญชี ──
  $('wbKeywords').value = 'ห้องซ้อม, ลับเฉพาะเจ้าของ'; $('wbMaxHours').value = '11'; $('wbEnabled').checked = false;
  onAccountSwitched();
  await sleep(20);
  ok('สลับบัญชี: หน้าต่างปิด · สถานะว่าง (ค่าตั้งของร้านไม่ค้างให้คนใหม่เห็น)', !dlg.open && st.textContent === '', st.textContent);
  ok('สลับบัญชี: ทุกช่องในฟอร์มถูกล้าง (กรอกค้าง/ค่าจากฐานไม่รอดข้ามคน)', $('wbKeywords').value === '' && $('wbMaxHours').value === '' && $('wbOpen').value === '' && $('wbEnabled').checked === false && $('wbBlocks').checked === false, $('wbKeywords').value + '|' + $('wbMaxHours').value);
  wbFill(); $('wbMaxHours').value = '9';       // ฟอร์มกลับมาเต็มและมีการแก้ — จำลองการเรียกบันทึกหลังล้างแผง
  await wbSave();
  ok('หลังล้างแผง: wbSave (เรียกตรง ๆ แม้ฟอร์มครบและมีการแก้) ไม่เขียนฐาน', updates().length === 0, 'updates=' + updates().length);
  await openDlg();
  ok('หลังสลับ เปิดใหม่ = โหลดใหม่จากฐาน (ไม่ใช้ค่าค้างของคนเดิม) · ไม่มีข้อความผิดพลาดค้างจากรอบก่อน', st.textContent.indexOf('ปกติ') !== -1 && $('wbKeywords').value === 'ห้องซ้อม' && $('wbMaxHours').value === '4' && $('wbErr').hidden === true, $('wbKeywords').value + '|' + $('wbMaxHours').value);

  // ── ออกจากระบบ ──
  await db.auth.signOut();
  await sleep(100);
  ok('ออกจากระบบ: หน้าต่างปิด · สถานะว่าง · ฟอร์มถูกล้าง', !dlg.open && st.textContent === '' && $('wbKeywords').value === '' && $('wbMaxHours').value === '' && $('wbOpen').value === '');

  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

// ───────── หน้า 6: ล้างข้อมูลส่วนตัวครบกำหนด (เจ้าของ) — ก้อนที่ 2 ─────────
const T_ANON = PRE + `<script>
const anonCalls = () => CALLS.filter(c => c.op === 'rpc' && c.name === 'booking_anonymize_expired');
const realCalls = () => anonCalls().filter(c => c.args.p_dry === false);
const BEFORE = '2025-10-06';
const dryOk = n => ({ data: { ok: true, dry: true, count: n, before: BEFORE }, error: null });
const GO = () => $('wbAnonGo'), OUT = () => $('wbAnon'), CONF = () => $('confirmDialog');
let loads = 0, renders = 0;
async function openConfirm() { GO().click(); await sleep(20); }
async function runTests() {
  L('=== จองออนไลน์: ล้างข้อมูลส่วนตัวครบกำหนด (เจ้าของ) ===');
  await login();
  showSection('booking');
  await sleep(100);
  // อีเวนต์ close ของ <dialog> ใน Chrome headless + งบเวลาเสมือนยิงตอนมี frame เท่านั้น (เห็นว่ามาตอนสิ้นงบ) ไม่ใช่ตอนปิด — onclose="confirmFn = null" ของรอบก่อนจะมาทับ confirmFn ของรอบใหม่
  // (ของจริงยิงทันทีก่อนผู้ใช้กดอะไรได้) → ถอดตัวฟังนี้ในเทสต์เท่านั้น: askConfirm ตั้ง confirmFn ใหม่ทุกครั้งอยู่แล้ว โค้ดของแผงไม่เกี่ยว
  CONF().onclose = null;
  const origLoad = window.loadBookings;
  window.loadBookings = async () => { loads++; return origLoad(); };
  const origRender = window.renderBookings;
  window.renderBookings = function () { renders++; return origRender.apply(this, arguments); };
  MODE.anon = a => a.p_dry ? dryOk(7) : { data: { ok: true, dry: false, anonymized: 6 }, error: null };

  // ── ตรวจจำนวน (dry-run) ──
  await openDlg();
  ok('เปิดหน้าต่าง: ยังไม่เรียกฟังก์ชันล้างข้อมูลเลย (ไม่ตรวจเอง ไม่ล้างเอง)', anonCalls().length === 0 && GO().hidden === true && OUT().textContent === '', 'calls=' + anonCalls().length);
  $('wbAnonCheck').click(); await sleep(20);
  ok('กด "ตรวจจำนวน": เรียก booking_anonymize_expired ด้วย p_dry=true อย่างเดียว (ไม่มี p_expected)', anonCalls().length === 1 && JSON.stringify(anonCalls()[0].args) === JSON.stringify({ p_dry: true }), JSON.stringify(anonCalls().map(c => c.args)));
  const red = OUT().querySelector('.wk-red');
  ok('ผลตรวจ: แดงตัวหนาบอก 7 ใบ · วันตัดรอบเป็นวันไทย พ.ศ. · ตรวจอย่างเดียวไม่ล้าง', !!red && red.textContent.indexOf('7 ใบ') !== -1 && bold(red) && isRed(red) && OUT().textContent.indexOf('2568') !== -1 && realCalls().length === 0, OUT().textContent);
  ok('มีปุ่มล้างข้อมูล (ขอบแดง) บอกจำนวน 7 ใบ', shown(GO()) && GO().textContent.indexOf('7 ใบ') !== -1 && GO().classList.contains('btn-danger'), GO().textContent);

  // ── ขั้นยืนยัน ──
  await openConfirm();
  const alertBox = $('confirmBody').querySelector('.alert-red');
  ok('กดปุ่มล้าง: เปิดหน้าต่างยืนยัน — ยังไม่ล้างจริง', CONF().open && realCalls().length === 0, 'open=' + CONF().open);
  ok('คำเตือนแดงตัวหนา: จำนวน · ย้อนกลับไม่ได้ · ของที่ถูกลบ/ที่ยังอยู่ · ไม่แตะใบที่พนักงานบันทึก', !!alertBox && bold(alertBox) && alertBox.textContent.indexOf('7 ใบ') !== -1 && alertBox.textContent.indexOf('ย้อนกลับไม่ได้') !== -1 && alertBox.textContent.indexOf('เบอร์โทร อีเมล LINE') !== -1 && alertBox.textContent.indexOf('วัน เวลา ชั่วโมง ราคา ยังอยู่') !== -1 && alertBox.textContent.indexOf('พนักงานบันทึกไม่ถูกแตะ') !== -1, alertBox && alertBox.textContent);
  ok('ปุ่มยืนยันระบุจำนวน "ล้างข้อมูล 7 ใบ"', $('confirmOkBtn').textContent === 'ล้างข้อมูล 7 ใบ', $('confirmOkBtn').textContent);
  CONF().close(); await sleep(10);
  ok('ปิดหน้าต่างยืนยัน (ไม่ทำ): ไม่ล้าง · ผลตรวจยังอยู่ให้กดใหม่ได้', realCalls().length === 0 && shown(GO()), 'real=' + realCalls().length);

  // ── ตรวจใหม่แล้วไม่มีใบครบกำหนด (ผลเก่ายังโชว์ปุ่มล้างอยู่ — ปุ่ม/ผลเก่าต้องหายทันที) ──
  MODE.anon = a => dryOk(0);
  $('wbAnonCheck').click(); await sleep(20);
  ok('ไม่มีใบครบกำหนด: บอกว่าไม่มี · ไม่มีปุ่มล้าง · ไม่แดง', OUT().textContent.indexOf('ไม่มีการจองจากเว็บที่ครบกำหนดล้าง') !== -1 && GO().hidden === true && !OUT().querySelector('.wk-red'), OUT().textContent);
  ok('กดยืนยันไม่ได้เมื่อไม่มีใบ (ผลตรวจเดิม 7 ใบถูกลืม)', (() => { wbAnonConfirm(); return !CONF().open; })());
  MODE.anon = a => a.p_dry ? dryOk(7) : { data: { ok: true, dry: false, anonymized: 6 }, error: null };
  $('wbAnonCheck').click(); await sleep(20);

  // ── ล้างจริง ──
  const l0 = loads, t0 = toast(), rd0 = renders;
  await openConfirm();
  $('confirmOkBtn').click(); await sleep(40);
  ok('ยืนยัน: เรียกล้างจริงครั้งเดียว ส่ง p_dry=false + p_expected = จำนวนที่เห็น (7)', realCalls().length === 1 && JSON.stringify(realCalls()[0].args) === JSON.stringify({ p_dry: false, p_expected: 7 }), JSON.stringify(realCalls().map(c => c.args)));
  ok('สำเร็จ: ปิดหน้าต่างยืนยัน · แจ้ง "ล้างข้อมูลส่วนตัวแล้ว 6 ใบ" ตามจำนวนที่ฐานรายงานว่าล้างจริง (ที่เห็นก่อนล้าง 7) · ซ่อนปุ่มล้าง · โหลดรายการจองใหม่', !CONF().open && OUT().textContent.indexOf('✅ ล้างข้อมูลส่วนตัวแล้ว 6 ใบ') !== -1 && toast() !== t0 && toast().indexOf('6 ใบ') !== -1 && GO().hidden === true && loads === l0 + 1 && renders > rd0, OUT().textContent + ' | loads+' + (loads - l0) + ' renders+' + (renders - rd0));
  GO().hidden = false; wbAnonConfirm();
  await sleep(10);
  ok('ล้างแล้วใช้ผลตรวจเดิมกดยืนยันซ้ำไม่ได้ (ต้องตรวจใหม่)', !CONF().open && realCalls().length === 1, 'open=' + CONF().open);

  // ── ตรวจล้ม ──
  MODE.anon = a => ({ data: null, error: { message: 'เฉพาะเจ้าของเท่านั้น <img src=x onerror="window.XSS4=1">' } });
  $('wbAnonCheck').click(); await sleep(20);
  ok('ตรวจจำนวนล้ม: แดงตัวหนาบอกสาเหตุจริง (แสดงเป็นข้อความ ไม่ใช่ HTML) · ไม่มีปุ่มล้าง', !!OUT().querySelector('.wk-red') && OUT().textContent.indexOf('ตรวจจำนวนไม่สำเร็จ: เฉพาะเจ้าของเท่านั้น') !== -1 && !OUT().querySelector('img') && window.XSS4 === undefined && GO().hidden === true, OUT().textContent);
  MODE.anon = a => ({ data: { ok: false, error: 'disabled' }, error: null });
  $('wbAnonCheck').click(); await sleep(20);
  ok('ฐานตอบ ok=false (เช่น ไม่มีแถวตั้งค่า): บอกรหัสสาเหตุ ไม่ขึ้นว่า "ไม่มีใบ"', OUT().textContent.indexOf('ตรวจจำนวนไม่สำเร็จ: disabled') !== -1 && GO().hidden === true, OUT().textContent);

  // ── จำนวนเปลี่ยนระหว่างรอ ──
  let n = 0;
  MODE.anon = a => a.p_dry ? dryOk(n++ === 0 ? 7 : 9) : { data: { ok: false, error: 'count_changed', count: 9 }, error: null };
  $('wbAnonCheck').click(); await sleep(20);
  await openConfirm();
  const r0 = realCalls().length, d0 = anonCalls().filter(c => c.args.p_dry).length;
  $('confirmOkBtn').click(); await sleep(60);
  ok('จำนวนเปลี่ยน (count_changed): ปิดหน้าต่างยืนยัน · บอกแดงตัวหนาว่ายังไม่ได้ล้างอะไร · ตรวจใหม่อัตโนมัติ เห็น 9 ใบ · ปุ่มล้างเป็น 9 ใบ (ไม่ล้างให้เอง)', !CONF().open && realCalls().length === r0 + 1 && anonCalls().filter(c => c.args.p_dry).length === d0 + 1 && OUT().textContent.indexOf('ยังไม่ได้ล้างอะไร') !== -1 && !!OUT().querySelector('.wk-red') && bold(OUT().querySelector('.wk-red')) && OUT().textContent.indexOf('9 ใบ') !== -1 && shown(GO()) && GO().textContent.indexOf('9 ใบ') !== -1 && OUT().textContent.indexOf('✅') === -1, OUT().textContent);

  // ── ล้างจริงล้ม ──
  MODE.anon = a => a.p_dry ? dryOk(3) : { data: null, error: { message: 'boom-anon' } };
  $('wbAnonCheck').click(); await sleep(20);
  await openConfirm();
  const t1 = toast(), l1 = loads;
  $('confirmOkBtn').click(); await sleep(40);
  const fe = $('fatalError');
  ok('ล้างจริงล้ม: แถบแดงบอกสาเหตุ + อาจล้างไปบางส่วน · ปิดหน้าต่างยืนยัน · ไม่ขึ้นว่าสำเร็จ · ซ่อนปุ่ม (ต้องตรวจใหม่) · ไม่โหลดรายการจองใหม่ทับ', !!fe && fe.textContent.indexOf('ล้างข้อมูลไม่สำเร็จ: boom-anon') !== -1 && fe.textContent.indexOf('บางส่วน') !== -1 && !CONF().open && toast() === t1 && OUT().textContent === '' && GO().hidden === true && wb.anon === null && loads === l1, fe && fe.textContent + ' | out=' + OUT().textContent);
  if (fe) fe.remove();
  MODE.anon = a => a.p_dry ? dryOk(3) : { data: { ok: false, error: 'disabled' }, error: null };
  $('wbAnonCheck').click(); await sleep(20);
  await openConfirm();
  $('confirmOkBtn').click(); await sleep(40);
  const fe2 = $('fatalError');
  ok('ฐานตอบ ok=false ตอนล้างจริง: แถบแดงบอกรหัสสาเหตุ · ไม่ขึ้นว่าสำเร็จ', !!fe2 && fe2.textContent.indexOf('ล้างข้อมูลไม่สำเร็จ: disabled') !== -1 && OUT().textContent.indexOf('✅') === -1, fe2 && fe2.textContent);
  if (fe2) fe2.remove();

  // ── กดซ้ำ ──
  MODE.anon = a => a.p_dry ? dryOk(5) : { data: { ok: true, dry: false, anonymized: 5 }, error: null };
  $('wbAnonCheck').click(); await sleep(20);
  await openConfirm();
  let rel; MODE.holdRpc = new Promise(r => { rel = r; });
  const r1 = realCalls().length;
  $('confirmOkBtn').click(); $('confirmOkBtn').click(); await sleep(20);
  rel(); await sleep(40); MODE.holdRpc = null;
  ok('กดยืนยันรัว ๆ ระหว่างรอฐานตอบ: เรียกล้างจริงครั้งเดียว', realCalls().length === r1 + 1, 'real +' + (realCalls().length - r1));

  // ── ออกจากระบบ/สลับบัญชีระหว่างทาง ──
  MODE.anon = a => a.p_dry ? dryOk(4) : { data: { ok: true, dry: false, anonymized: 4 }, error: null };
  await openDlg();
  MODE.holdRpc = new Promise(r => { rel = r; });
  $('wbAnonCheck').click(); await sleep(20);
  ok('ระหว่างรอฐานตอบ: ขึ้น "กำลังตรวจ…" · ไม่มีปุ่มล้าง', OUT().textContent === 'กำลังตรวจ…' && GO().hidden === true, OUT().textContent);
  wbReset();
  rel(); await sleep(40); MODE.holdRpc = null;
  ok('สลับบัญชีระหว่างตรวจจำนวน: ผลที่มาทีหลังถูกทิ้ง (ไม่โผล่ปุ่มล้างให้คนใหม่)', GO().hidden === true && wb.anon === null, 'anon=' + JSON.stringify(wb.anon));
  await openDlg();
  $('wbAnonCheck').click(); await sleep(20);
  await openConfirm();
  const t2 = toast(), l2 = loads, r2 = realCalls().length;
  MODE.holdRpc = new Promise(r => { rel = r; });
  $('confirmOkBtn').click(); await sleep(20);
  wbReset();
  rel(); await sleep(40); MODE.holdRpc = null;
  ok('สลับบัญชีระหว่างล้างจริง: ปิดหน้าต่างยืนยัน · ไม่ขึ้นข้อความสำเร็จ · ไม่โหลดรายการจองใหม่ในหน้าจอคนใหม่', !CONF().open && toast() === t2 && OUT().textContent.indexOf('✅') === -1 && loads === l2 && realCalls().length === r2 + 1, 'open=' + CONF().open + ' loads+' + (loads - l2));
  await openDlg();
  $('wbAnonCheck').click(); await sleep(20);
  await openConfirm();
  const t3 = toast(), l3 = loads;
  MODE.holdRpc = new Promise(r => { rel = r; });
  $('confirmOkBtn').click(); await sleep(20);
  currentUserId = 'u-someone-else';
  rel(); await sleep(40); MODE.holdRpc = null;
  currentUserId = 'u1';
  ok('เปลี่ยนผู้ใช้ระหว่างล้างจริง (หน้าต่างยังเปิดอยู่): ปิดหน้าต่างยืนยัน · ไม่ขึ้นข้อความสำเร็จ · ไม่โหลดรายการจองใหม่', !CONF().open && toast() === t3 && OUT().textContent.indexOf('✅') === -1 && loads === l3, 'open=' + CONF().open + ' loads+' + (loads - l3));
  await openDlg();
  MODE.holdRpc = new Promise(r => { rel = r; });
  $('wbAnonCheck').click(); await sleep(20);
  currentUserId = 'u-someone-else';
  rel(); await sleep(40); MODE.holdRpc = null;
  currentUserId = 'u1';
  ok('เปลี่ยนผู้ใช้ระหว่างตรวจจำนวน (หน้าต่างยังเปิด): ผลของคนเดิมถูกทิ้ง ไม่โผล่ปุ่มล้าง', GO().hidden === true && wb.anon === null, JSON.stringify(wb.anon));

  // ── ผลตรวจค้างข้ามการโหลดใหม่/ล้างแผง ──
  await openDlg();
  MODE.anon = a => a.p_dry ? dryOk(2) : { data: { ok: true, dry: false, anonymized: 2 }, error: null };
  $('wbAnonCheck').click(); await sleep(20);
  $('wbReload').click(); await sleep(40);
  ok('กด ↻ รีเฟรช: ผลตรวจเดิมหาย (ปุ่มล้างซ่อน · กดยืนยันไม่ได้) — ต้องตรวจใหม่', GO().hidden === true && OUT().textContent === '' && wb.anon === null && (() => { wbAnonConfirm(); return !CONF().open; })());
  $('wbAnonCheck').click(); await sleep(20);
  wbReset();
  wbAnonConfirm(); await sleep(10);
  ok('ล้างแผง (ออกจากระบบ/สลับบัญชี): ผลตรวจที่ค้างถูกลืม — กดยืนยันโดยตรงไม่เปิดหน้าต่าง', wb.anon === null && !CONF().open);

  // ── ตั้งค่าเก็บข้อมูล/ล้างอัตโนมัติ ──
  await openDlg();
  const up0 = updates().length;
  $('wbMonths').value = '24'; $('wbAuto').checked = true;
  await wbSave();
  const u = updates()[up0];
  ok('แก้ "เก็บกี่เดือน" + ติ๊ก "บอทล้างเอง": ส่งเฉพาะสองช่องนี้ (เป็นตัวเลข/บูลีน) + ผู้แก้', !!u && Object.keys(u.payload).sort().join(',') === 'anonymize_after_months,auto_anonymize_enabled,updated_at,updated_by' && u.payload.anonymize_after_months === 24 && u.payload.auto_anonymize_enabled === true, JSON.stringify(u && u.payload));
  ok('แจ้งผลบอกค่าเดิม → ค่าใหม่', toast().indexOf('เก็บข้อมูลลูกค้าเว็บกี่เดือนหลังวันจอง 12 → 24') !== -1 && toast().indexOf('ให้บอทล้างข้อมูลส่วนตัวเองวันละครั้ง: เปิด') !== -1, toast());
  let badM = [];
  for (const v of ['', '0', '121', '4.5', '1e1']) {
    await openDlg(); $('wbMonths').value = v; $('wbErr').hidden = true;
    const n2 = updates().length; await wbSave();
    if (!(updates().length === n2 && !$('wbErr').hidden && $('wbErr').textContent.indexOf('เก็บข้อมูลลูกค้าเว็บกี่เดือนหลังวันจอง') !== -1 && $('wbErr').textContent.indexOf('1 ถึง 120') !== -1)) badM.push(v);
  }
  ok('จำนวนเดือน: ว่าง · 0 · 121 · ทศนิยม · 1e1 ถูกปฏิเสธ (ช่วง 1–120 ตรง check ของฐาน)', badM.length === 0, badM.join(','));
  let okM = 0;
  for (const v of [1, 120]) { await openDlg(); $('wbMonths').value = String(v); const n3 = updates().length; await wbSave(); if (updates().length === n3 + 1 && updates()[n3].payload.anonymize_after_months === v) okM++; }
  ok('ขอบช่วง 1 และ 120 เดือนบันทึกผ่าน', okM === 2, 'ok=' + okM);

  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

const pages = [
  ['แถบสถานะซิงก์ (เจ้าของ)', { role: 'owner', v041: true }, T_STATUS],
  ['ฟอร์มตั้งค่า + บันทึก (เจ้าของ)', { role: 'owner', v041: true }, T_FORM],
  ['เปิดสวิตช์ตารางสอนทั้งที่ซิงก์ยังไม่ผ่าน (เจ้าของ)', { role: 'owner', v041: true }, T_BLOCKS],
  ['พนักงาน (ดูอย่างเดียว)', { role: 'staff', v041: true }, T_STAFF],
  ['ผู้ดูแล (ตั้งค่าได้)', { role: 'admin', v041: true }, T_STAFF],
  ['ฐานยังไม่รัน 041', { role: 'owner', v041: false }, T_NO041],
  ['โหลดล้ม · ผลที่มาช้า · สลับบัญชี/ออกจากระบบ', { role: 'owner', v041: true }, T_EDGE],
  ['ล้างข้อมูลส่วนตัวครบกำหนด (เจ้าของ)', { role: 'owner', v041: true }, T_ANON],
];
let allOk = true;
for (const [name, cfg, tests] of pages) {
  console.log('\n--- ' + name + ' ---');
  const res = runPage({ root, file: 'desk.html', mock: mockFor(cfg), tests });
  allOk = allOk && res.ok;
}
process.exit(allOk ? 0 : 1);
