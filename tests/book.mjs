/**
 * เทสต์หน้าจองของลูกค้าเดิม book.html (LIFF) — เวลาเริ่ม/จำนวนชั่วโมงต้องอยู่ในเวลาเปิดทำการที่อ่านจากฐาน
 *   รัน: node tests/book.mjs      (BOOK_ROOT=<โฟลเดอร์> ทดสอบหน้าฉบับอื่น — ใช้ทำ mutation)
 *
 * ที่มา (6 ต.ค. 69): ใบทดสอบ LIFF จอง 10:00 ได้ทั้งที่ร้านเปิด 12:00 — เดิมช่องเวลาเป็น <input type="time"> ค่าตั้งต้น 10:00 และตัวเลือกชั่วโมงไป 8
 * ตอนนี้เป็น select รายชั่วโมงในเวลาเปิด (open_time/close_time/max_hours_per_booking จาก booking_settings — ไม่ตายตัวในหน้า) +
 * แยกข้อความตอนฐานปฏิเสธ (RLS 42501) กับเน็ตล่ม · ฐานยังไม่กัน (migration 042 ตามหลังเมื่อหน้านี้ขึ้นเว็บและพ้นช่วงแคชแล้ว)
 *
 * วิธีเดียวกับชุดอื่น: ไฟล์จริงทุกบรรทัด สลับเฉพาะแท็ก Supabase เป็นตัวปลอม · LIFF ปลอมไว้ในตัวปลอมเดียวกัน (กันดึง SDK จริงจากเน็ต)
 * ⚠️ เขียนโดยไม่ใช้แบ็กสแลช/แบ็กทิกในสตริงเทมเพลตของไฟล์นี้
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPage, HARNESS } from './lib/page-test.mjs';

const root = process.env.BOOK_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const ROW = { price_per_hour: 800, points_per_hour: 1, open_time: '12:00:00', close_time: '20:00:00', max_hours_per_booking: 4 };

const mock = cfg => `<script>
const CALLS = [];
const CFG = ${JSON.stringify(cfg)};
// CFG.now = เวลาปัจจุบันปลอม (ISO · UTC) — คุมวัน "วันนี้" ของหน้า (ตอน 00:00–07:00 เวลาไทย วัน UTC ยังเป็นเมื่อวาน)
if (CFG.now) { const RD = Date, T = new RD(CFG.now).getTime(); window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(T); } static now() { return T; } }; }
window.liff = { init: async () => {}, isLoggedIn: () => false, getProfile: async () => ({ userId: 'U' + '0'.repeat(32) }) };
window.supabase = { createClient: () => ({
  from: table => {
    const q = {
      select(cols) { q._cols = typeof cols === 'string' ? cols.split(',').map(s => s.trim()) : null; return q; },
      insert(p) { CALLS.push({ op: 'insert', table, payload: p }); q._ins = p; return q; },
      async single() {
        // ฐานจริงคืนเฉพาะคอลัมน์ที่ขอ — หน้าที่ลืมขอคอลัมน์เวลาเปิดต้องได้ค่าว่าง (ไม่ใช่ได้ครบเพราะตัวปลอมใจดี)
        if (table === 'booking_settings') return CFG.settings === null ? { data: null, error: { message: 'boom' } }
          : { data: q._cols ? Object.fromEntries(q._cols.filter(c => c in CFG.settings).map(c => [c, CFG.settings[c]])) : CFG.settings, error: null };
        if (q._ins) {
          if (CFG.insert === 'rls-code') return { data: null, error: { code: '42501', message: 'permission denied for table room_bookings' } };
          if (CFG.insert === 'rls') return { data: null, error: { code: '42501', message: 'new row violates row-level security policy for table "room_bookings"' } };
          if (CFG.insert === 'rls-msg') return { data: null, error: { message: 'new row violates row-level security policy' } };
          if (CFG.insert === 'net') return { data: null, error: { message: 'TypeError: Failed to fetch' } };
          return { data: Object.assign({ id: 'new1' }, q._ins), error: null };
        }
        return { data: null, error: null };
      },
    };
    return q;
  },
  auth: { async signInAnonymously() { return { error: null }; }, async getUser() { return { data: { user: { id: 'anon1' } } }; } },
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
}) };
</script>`;

const tests = body => `<script>
window.addEventListener('load', () => setTimeout(runTests, 700));
${HARNESS}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);
const opts = id => [...$(id).options].map(o => o.value);
const setTime = v => { $('bookTime').value = v; $('bookTime').dispatchEvent(new Event('change', { bubbles: true })); };
const setHours = v => { $('bookHours').value = String(v); $('bookHours').dispatchEvent(new Event('change', { bubbles: true })); };
const J = JSON.stringify;
const fillForm = () => { $('bookName').value = 'สมชาย ใจดี'; $('bookContact').value = '0812345678'; };
async function runTests() {
  ${body}
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

const results = [];
const run = (label, cfg, body) => { console.log('\n=== ' + label + ' ==='); results.push(runPage({ root, file: 'book.html', mock: mock(cfg), tests: tests(body) })); };

run('เวลาเปิด 12:00–20:00 · ≤ 4 ชม. (ค่าจริงของร้านตอนนี้)', { settings: ROW }, `
  ok('ช่องเวลาเริ่มเป็น select (ไม่ใช่ input time ค่าตั้งต้น 10:00)', $('bookTime').tagName === 'SELECT' && !document.querySelector('input[type=time]'));
  ok('ตัวเลือกเวลา = ชั่วโมงเต็มในเวลาเปิด 12:00…19:00 (8 ตัว) ไม่มี 10:00/11:00/20:00', J(opts('bookTime')) === J(['12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00']), J(opts('bookTime')));
  ok('ข้อความที่ลูกค้าเห็นในตัวเลือก: "12:00 น." … "19:00 น." · ชั่วโมงเป็น "n ชั่วโมง"', [...$('bookTime').options].map(o => o.textContent).join('|') === ['12','13','14','15','16','17','18','19'].map(h => h + ':00 น.').join('|') && [...$('bookHours').options].map(o => o.textContent).join('|') === '1 ชั่วโมง|2 ชั่วโมง|3 ชั่วโมง|4 ชั่วโมง', [...$('bookTime').options].map(o => o.textContent).join('|'));
  ok('ค่าตั้งต้นคือชั่วโมงแรกที่เปิด (12:00) ไม่ใช่ 10:00', $('bookTime').value === '12:00', $('bookTime').value);
  ok('ข้อความเวลาเปิดอ่านจากฐาน: 12:00–20:00 · ไม่เกิน 4 ชั่วโมง', $('timeHint').textContent.indexOf('12:00–20:00') !== -1 && $('timeHint').textContent.indexOf('ไม่เกิน 4 ชั่วโมง') !== -1, $('timeHint').textContent);
  ok('ตัวเลือกชั่วโมงที่ 12:00 = 1–4 (ไม่มี 5/6/8)', J(opts('bookHours')) === J(['1','2','3','4']), J(opts('bookHours')));
  setTime('16:00'); ok('เริ่ม 16:00 → ชั่วโมง 1–4 (เหลือ 4 ชม. ก่อนปิด)', J(opts('bookHours')) === J(['1','2','3','4']));
  setTime('17:00'); ok('เริ่ม 17:00 → ชั่วโมง 1–3', J(opts('bookHours')) === J(['1','2','3']), J(opts('bookHours')));
  setTime('18:00'); ok('เริ่ม 18:00 → ชั่วโมง 1–2', J(opts('bookHours')) === J(['1','2']));
  setTime('19:00'); ok('เริ่ม 19:00 → ชั่วโมง 1 เท่านั้น (จบ 20:00 พอดี)', J(opts('bookHours')) === J(['1']));
  setTime('12:00'); setHours(3); setTime('14:00');
  ok('เปลี่ยนเวลาเริ่มแล้วคงจำนวนชั่วโมงเดิมไว้ถ้ายังจองได้ (3 ชม. ที่ 14:00)', $('bookHours').value === '3', $('bookHours').value);
  setTime('18:00');
  ok('เลือก 3 ชม. แล้วย้ายไป 18:00 (เหลือ 2) → ปรับเป็น 1 ชม. และค่าใช้จ่ายตามจริง', $('bookHours').value === '1' && $('costAmount').textContent.indexOf('800') !== -1 && $('costAmount').textContent.indexOf('1 ชม.') !== -1, $('bookHours').value + ' / ' + $('costAmount').textContent);
  setTime('12:00'); setHours(2); setTime('18:00');
  ok('เลือก 2 ชม. แล้วย้ายไป 18:00 (เหลือพอดี 2) → คง 2 ชม. ไว้ (ขอบ: เท่ากับที่เหลือยังจองได้)', $('bookHours').value === '2', $('bookHours').value);
  setTime('12:00'); setHours(4);
  ok('ค่าใช้จ่ายอัปเดตตามชั่วโมง (4 ชม. = 3,200 บาท)', $('costAmount').textContent.indexOf('3,200') !== -1 && $('costAmount').textContent.indexOf('4 ชม.') !== -1, $('costAmount').textContent);
  // ส่งจอง: payload เหมือนเดิมทุกคอลัมน์ (เวลา/ชั่วโมงมาจากช่องเลือก)
  setTime('17:00'); setHours(3); fillForm();
  CALLS.length = 0;
  await submitBooking(); await sleep(100);
  const ins = CALLS.find(c => c.op === 'insert' && c.table === 'room_bookings');
  ok('ส่งจอง: เวลาเริ่ม 17:00 · 3 ชม. · ราคา/แต้มคิดจากฐาน', !!ins && ins.payload.start_time === '17:00' && ins.payload.hours === 3 && ins.payload.cost === 2400 && ins.payload.points_earned === 3, ins && J(ins.payload));
  ok('ส่งจอง: คอลัมน์ที่เขียนเหมือนเดิมทุกตัว (ไม่มีคอลัมน์ใหม่ที่หน้าเดิมไม่รู้จัก)', !!ins && J(Object.keys(ins.payload).sort()) === J(['confirmed','contact','cost','customer_name','customer_uid','date','equip','hours','line_user_id','note','points_earned','room','room_model','source','start_time','status']), ins && Object.keys(ins.payload).join());
  ok('ส่งจอง: สถานะรอยืนยัน · ช่องทางเว็บ (ไม่มี LINE) · ผู้ใช้นิรนาม', !!ins && ins.payload.status === 'upcoming' && ins.payload.confirmed === false && ins.payload.source === 'online_web' && ins.payload.customer_uid === 'anon1' && ins.payload.line_user_id === null);
`);

run('เวลาเปิดอื่น 10:00–22:00 · ≤ 6 ชม. (ต้องตามฐาน ไม่ตายตัว 12–20)', { settings: Object.assign({}, ROW, { open_time: '10:00:00', close_time: '22:00:00', max_hours_per_booking: 6 }) }, `
  ok('ตัวเลือกเวลา 10:00…21:00 ตามเวลาเปิดที่ฐานบอก', J(opts('bookTime')) === J(['10','11','12','13','14','15','16','17','18','19','20','21'].map(h => h + ':00')), J(opts('bookTime')));
  ok('ที่ 10:00 เลือกได้ 1–6 ชม. (ตามเพดานของฐาน)', J(opts('bookHours')) === J(['1','2','3','4','5','6']), J(opts('bookHours')));
  setTime('21:00'); ok('ที่ 21:00 เหลือ 1 ชม.', J(opts('bookHours')) === J(['1']));
  ok('ข้อความเวลาเปิดเป็น 10:00–22:00 · ไม่เหลือ 12:00–20:00 ตายตัวทั้งหน้า', $('timeHint').textContent.indexOf('10:00–22:00') !== -1 && $('timeHint').textContent.indexOf('ไม่เกิน 6 ชั่วโมง') !== -1 && document.body.innerText.indexOf('12:00–20:00') === -1, $('timeHint').textContent);
`);

run('เวลาเปิดมีนาที 12:30–19:30 (ชั่วโมงแรกปัดขึ้น · ชั่วโมงสุดท้ายต้องจบทันเวลาปิด)', { settings: Object.assign({}, ROW, { open_time: '12:30:00', close_time: '19:30:00' }) }, `
  ok('ตัวเลือกเวลา 13:00…18:00 (ไม่มี 12:00 ที่เริ่มก่อนเปิด · ไม่มี 19:00 ที่จบเกินปิด)', J(opts('bookTime')) === J(['13:00','14:00','15:00','16:00','17:00','18:00']), J(opts('bookTime')));
  ok('ที่ 13:00 เลือกได้ 1–4 ชม. · ที่ 18:00 เหลือ 1 ชม. (จบ 19:00 ไม่เกิน 19:30)', J(opts('bookHours')) === J(['1','2','3','4']) && (setTime('18:00'), J(opts('bookHours')) === J(['1'])), J(opts('bookHours')));
  ok('ข้อความเวลาเปิดบอก 12:30–19:30 ตามที่ฐานเก็บ', $('timeHint').textContent.indexOf('12:30–19:30') !== -1, $('timeHint').textContent);
`);

run('โหลดเวลาเปิดจากฐานไม่สำเร็จ → ไม่เดาเวลา · ไม่ให้กดส่ง', { settings: null }, `
  ok('บอกลูกค้าว่าโหลดเวลาเปิดทำการไม่สำเร็จ', $('toast').textContent.indexOf('โหลดเวลาเปิดทำการไม่สำเร็จ') !== -1, $('toast').textContent);
  ok('ช่องเวลาไม่มีตัวเลือกให้เลือกเอง (ไม่มี 10:00 ตัวเดิม)', J(opts('bookTime')) === J(['']) && $('bookTime').value === '', J(opts('bookTime')));
  ok('ข้อความใต้ช่องบอกว่าโหลดไม่สำเร็จ', $('timeHint').textContent.indexOf('โหลดเวลาเปิดทำการไม่สำเร็จ') !== -1);
  fillForm(); CALLS.length = 0; $('toast').textContent = '';
  await submitBooking();
  ok('กดส่งแล้วไม่มีการเขียนฐาน · บอกให้รอเชื่อมต่อ', CALLS.filter(c => c.op === 'insert').length === 0 && $('toast').textContent.indexOf('กำลังเชื่อมต่อ') !== -1, $('toast').textContent);
`);

run('ฐานปฏิเสธ (RLS 42501) ≠ เน็ตล่ม — ข้อความต้องต่างกัน', { settings: ROW, insert: 'rls' }, `
  fillForm(); await submitBooking(); await sleep(100);
  const t = $('toast').textContent;
  ok('ฐานปฏิเสธ: บอกให้เลือกวัน/เวลา/ชั่วโมงใหม่ในเวลาเปิดทำการ หรือทักร้าน (ไม่ใช่ "ตรวจอินเทอร์เน็ต")', t.indexOf('ร้านรับจอง') !== -1 && t.indexOf('เวลาเปิดทำการ') !== -1 && t.indexOf('อินเทอร์เน็ต') === -1, t);
  ok('ปุ่มส่งกลับมากดได้อีกครั้ง · ฟอร์มยังอยู่ (ลูกค้าเลือกใหม่ได้)', $('submitBtn').disabled === false && $('formCard').style.display !== 'none');
`);
run('ฐานปฏิเสธที่ไม่มีรหัส 42501 แต่ข้อความบอก row-level security ก็นับเป็นถูกปฏิเสธ', { settings: ROW, insert: 'rls-msg' }, `
  fillForm(); await submitBooking(); await sleep(100);
  const t = $('toast').textContent;
  ok('ข้อความแบบถูกปฏิเสธ (ไม่ใช่เน็ตล่ม)', t.indexOf('ร้านรับจอง') !== -1 && t.indexOf('อินเทอร์เน็ต') === -1, t);
`);
run('ฐานปฏิเสธด้วยรหัส 42501 อย่างเดียว (ข้อความไม่บอก row-level security)', { settings: ROW, insert: 'rls-code' }, `
  fillForm(); await submitBooking(); await sleep(100);
  const t = $('toast').textContent;
  ok('นับเป็นถูกปฏิเสธจากรหัส 42501 (ไม่ใช่เน็ตล่ม)', t.indexOf('ร้านรับจอง') !== -1 && t.indexOf('อินเทอร์เน็ต') === -1, t);
`);
run('ส่งไม่ถึงฐาน (เน็ตล่ม)', { settings: ROW, insert: 'net' }, `
  fillForm(); await submitBooking(); await sleep(100);
  const t = $('toast').textContent;
  ok('เน็ตล่ม: บอกให้ตรวจอินเทอร์เน็ตแล้วลองใหม่ (ไม่ใช่ว่าร้านไม่รับจอง)', t.indexOf('อินเทอร์เน็ต') !== -1 && t.indexOf('ร้านรับจอง') === -1, t);
  ok('ปุ่มส่งกลับมากดได้อีกครั้ง', $('submitBtn').disabled === false);
`);
// วันที่ของหน้า = วันตามเวลาไทย (ไม่ใช่วัน UTC): 06:30 น. ไทย 3 มี.ค. = 23:30 UTC 2 มี.ค. → เดิมหน้าขึ้น "2 มี.ค." และเลือกจองย้อนหลังได้
for (const [label, now, want] of [
  ['06:30 น. ไทย 3 มี.ค. (วัน UTC ยังเป็น 2 มี.ค.)', '2026-03-02T23:30:00Z', '2026-03-03'],
  ['00:00 น. ไทยพอดี (17:00 UTC)', '2026-03-03T17:00:00Z', '2026-03-04'],
  ['23:59 น. ไทย 2 มี.ค. (16:59 UTC) ยังเป็นวันเดิม', '2026-03-02T16:59:00Z', '2026-03-02'],
  ['เที่ยงวันไทย (วัน UTC = วันไทย)', '2026-03-03T05:00:00Z', '2026-03-03'],
]) run('วันที่ตั้งต้น/ขั้นต่ำเป็นวันไทย — ' + label, { settings: ROW, now }, `
  ok('ค่าตั้งต้นของช่องวันที่ = ${want}', $('bookDate').value === '${want}', $('bookDate').value);
  ok('จองย้อนหลังไม่ได้: ขั้นต่ำของช่องวันที่ = ${want} (ไม่ใช่วัน UTC)', $('bookDate').min === '${want}', $('bookDate').min);
`);

run('ฟอร์มเดิม: ไม่กรอกชื่อ/ติดต่อ → ไม่ส่ง', { settings: ROW }, `
  CALLS.length = 0; await submitBooking();
  ok('ไม่กรอกชื่อ/ข้อมูลติดต่อ → ไม่มีการเขียนฐาน · บอกให้กรอกให้ครบ', CALLS.filter(c => c.op === 'insert').length === 0 && $('toast').textContent.indexOf('กรอกข้อมูลที่จำเป็นให้ครบ') !== -1, $('toast').textContent);
  ok('ตัวหนังสือของข้อความแนะนำเวลาเปิด ≥ 14px', parseFloat(getComputedStyle($('timeHint')).fontSize) >= 14, getComputedStyle($('timeHint')).fontSize);
`);

process.exit(results.every(r => r.ok) ? 0 : 1);
