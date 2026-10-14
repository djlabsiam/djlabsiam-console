/**
 * เทสต์หน้าครู teacher.html (P1b · migration 047) — ครูที่ไม่มีแถวใน admins ดูนักเรียน/รอบเรียนของตัวเอง
 *   รัน: node tests/teacher.mjs · ทีละหน้า: TEACHER_ONLY=<regex ชื่อหน้า> · ถ่ายภาพ: TEACHER_SHOTS=<โฟลเดอร์> · ทดสอบหน้าฉบับอื่น (mutation): TEACHER_ROOT=<โฟลเดอร์>
 *
 * ฐานปลอม tests/lib/teach-mock.mjs จำลองสิทธิ์อ่าน (RLS) + teach_my_students ตามกติกา 047 · ตัวจริงตรวจที่ console-workspace/sql-tests/test047.mjs ([11] เมทริกซ์สิทธิ์ครูล้วน)
 * ที่นี่ตรวจฝั่งหน้าจอ: หน้านี้ "ไม่ดึง" และ "ไม่วาด" ส่วนที่ไม่ใช่ของครู (เงิน/ลูกค้า/นักเรียนครูอื่น/เบอร์เต็ม/ปิดคอร์ส) ·
 *   ฟอร์มส่งอะไรให้ฟังก์ชัน · ปุ่มล็อกระหว่างส่ง · คำเตือนแดงตัวหนา · ข้อความผิดพลาดไม่มียอด · XSS · ล้างตอนออกจากระบบ/สลับบัญชี · ผลโหลดช้าถูกทิ้ง
 *
 *  1. เข้าสู่ระบบ · บัญชีที่ไม่ใช่ครู · ขอบเขตข้อมูล (ไม่ดึง/ไม่วาด) · ข้อมูลติดต่อ
 *  2. ทำงาน: สอนแล้ว · ยกเลิก/ไม่มา · บันทึกการสอน · นัดรอบ · ขอขยายอายุ
 *  3. ตารางสอน · Realtime · ออกจากระบบ · สลับบัญชีกลางโหลด · ครูที่เป็นพนักงาน · XSS
 *  4. iPhone (390px)
 *  5. เพิ่มนักเรียนเอง · ผูกนัดปฏิทิน (060)
 *  6. เพิ่มนักเรียนย้อนหลัง (062): สวิตช์ · วันที่เรียน · ส่งลงเรียน→ลงรอบ · ล้มกลางทางแล้วทำต่อ · ครูที่เป็นพนักงานโดนฐานปฏิเสธ
 */

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { HARNESS } from './lib/page-test.mjs';
import { runCdpPage } from './lib/cdp-page.mjs';
import { TEACH_MOCK } from './lib/teach-mock.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { MOCK: MOCK3 } = await import(pathToFileURL(join(root, 'tests/desk-home3.mjs')).href);
const SHOTS = process.env.TEACHER_SHOTS || null;
const ONLY = process.env.TEACHER_ONLY ? new RegExp(process.env.TEACHER_ONLY) : null;
const pageRoot = process.env.TEACHER_ROOT || root;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const COMMON = `
${HARNESS}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);
const settle = ms => sleep(ms || 300);
const isRed = el => !!el && getComputedStyle(el).color === 'rgb(204, 0, 26)' && Number(getComputedStyle(el).fontWeight) >= 600;      // --red #CC001A ตัวหนา
const day = n => { const x = new Date(TODAY + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const J = o => JSON.stringify(o);
async function signIn(name) {
  $('lgEmail').value = name + '@x';
  $('lgPass').value = 'x';
  $('loginForm').requestSubmit();
  await sleep(900);
}
async function signOut() { $('logoutBtn').click(); await sleep(500); }
const txt = () => $('app').textContent;
const html = () => $('app').innerHTML;
const cards = () => [...$('app').querySelectorAll('.card.click[data-eid]')];
const names = () => cards().map(c => c.querySelector('.name').firstChild.textContent.trim());
const card = id => $('app').querySelector('.card.click[data-eid="' + id + '"]');
const rpcCalls = fn => CALLS.filter(c => c.op === 'rpc' && c.fn === fn);
const lastArgs = fn => { const l = rpcCalls(fn); return l.length ? l[l.length - 1].args : null; };
const tabTo = n => { $('app').querySelector('#tabs [data-tab="' + n + '"]').click(); };
const dact = (a, extra) => { const b = $('app').querySelector('[data-act="' + a + '"]' + (extra || '')); if (!b) throw new Error('ไม่พบปุ่ม ' + a + (extra || '')); b.click(); };
const has = (a, extra) => !!$('app').querySelector('[data-act="' + a + '"]' + (extra || ''));
const fillf = (k, v) => { const e = $('f_' + k); if (!e) throw new Error('ไม่พบช่อง ' + k); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
const submitK = k => dact('submit', '[data-k="' + k + '"]');
const oform = (k, sid) => dact('open', '[data-k="' + k + '"]' + (sid ? '[data-sid="' + sid + '"]' : ''));
const sc = id => $('app').querySelector('#sessions .card[data-sid="' + id + '"]');
const scIds = () => [...$('app').querySelectorAll('#sessions .card[data-sid]')].map(e => e.dataset.sid);
const okText = () => ($('detOk') || {}).textContent || '';
const errTxt = () => ($('detErr') || {}).textContent || '';
const warnTxt = () => ($('detWarn') || {}).textContent || '';
async function ostu(id) { card(id).click(); await settle(500); }
// ข้อมูลสมมติของครู Maniac (t3): e-month (วีระ · กำลังเรียน) + e-m2 (ผู้เยาว์ ดวงดาว) + e-m3 (รอคิว) · ตั้งเบอร์เต็มของวีระเพื่อตรวจว่าไม่โผล่
function seedManiac() {
  TEACH.seed();
  FAKE.customers.find(c => c.id === 'c3').phone = '0812345678';
  const base = TEACH.rows.find(r => r.id === 'e-month');
  TEACH.rows.push(Object.assign({}, base, { id: 'e-m2', customer_id: 'c7', teacher_id: 't3', teacher_name: 'Maniac', state: 'active', sessions_done: 1, sessions_used: 1, sessions_remaining: 5,
    started_on: day(-20), expires_on: day(70), effective_expiry: day(70), next_session_at: null }));
  TEACH.rows.push(Object.assign({}, base, { id: 'e-m3', customer_id: 'c4', teacher_id: 't3', teacher_name: 'Maniac', state: 'queued', sessions_done: 0, sessions_used: 0, sessions_remaining: 6,
    started_on: null, expires_on: null, effective_expiry: null, next_session_at: null }));
}
`;

// ── 1. เข้าสู่ระบบ · ขอบเขตข้อมูล ──
const T1 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== หน้าครู (1/4): เข้าสู่ระบบ · ขอบเขตข้อมูล · ข้อมูลติดต่อ ===');
  seedManiac();
  await sleep(300);
  ok('ยังไม่ล็อกอิน: ขึ้นฟอร์มเข้าสู่ระบบ · ไม่เรียกฐานข้อมูลของคอร์สเรียน', !!$('loginForm') && !CALLS.some(c => c.op === 'rpc' || (c.table && /class_sessions|enrollment/.test(c.table))), J(CALLS.map(c => c.fn || c.table)));
  $('lgEmail').value = 'unknown@x'; $('lgPass').value = 'bad'; $('loginForm').requestSubmit(); await sleep(600);
  ok('อีเมล/รหัสผิด: ข้อความแดงตัวหนา · ไม่มีข้อความอังกฤษดิบ', isRed($('loginErr')) && /เข้าสู่ระบบไม่สำเร็จ/.test($('loginErr').textContent) && !/Invalid/.test(txt()));

  // ── บัญชีที่ไม่ใช่ครู ──
  await signIn('ghost');
  ok('บัญชีที่ไม่ใช่ครู: ข้อความบอกชัด · มีลิงก์ไปคอนโซลร้าน · ไม่ดึงนักเรียน/รอบเรียนเลย', !!$('notTeacher') && /ยังไม่ได้ผูกกับครู/.test(txt()) && !!$('app').querySelector('a[href="desk.html"]')
    && rpcCalls('teach_my_students').length === 0 && !CALLS.some(c => c.table === 'class_sessions'), J(CALLS.map(c => c.fn || c.table)));
  await signOut();
  ok('ออกจากระบบ: กลับหน้าเข้าสู่ระบบ · ไม่มีข้อความของบัญชีเดิม', !!$('loginForm') && !$('notTeacher'));

  // ── ครู Maniac (ไม่มีแถว admins) ──
  await signIn('maniac');
  ok('เข้าสำเร็จ: แถบบนบอก "ครู Maniac" · ปุ่มออกจากระบบโผล่', /ครู Maniac/.test($('who').textContent) && !$('logoutBtn').hidden, $('who').textContent);
  ok('นักเรียนของฉัน: เห็นเฉพาะ 3 การลงเรียนของ Maniac (วีระ · ดวงดาว · ปิติ) — ไม่มีนักเรียนของครูคนอื่น',
    cards().map(c => c.dataset.eid).sort().join() === 'e-m2,e-m3,e-month' && !/สมชาย|มานี|นภา|John/.test(txt()), cards().map(c => c.dataset.eid).join());
  ok('จัดกลุ่มตามสถานะ: กำลังเรียน 2 · รอคิว 1', /กำลังเรียน 2 คน/.test(txt()) && /รอคิว [(]ชำระแล้ว ยังไม่เริ่ม[)] 1 คน/.test(txt()), txt().slice(0, 300));
  const c1 = card('e-month');
  ok('การ์ดบอก ความคืบหน้า · ครั้งที่เหลือ · อายุคอร์ส · ครั้งถัดไป', /เรียนแล้ว 2\\/6/.test(c1.textContent) && /เหลือ 3 ครั้ง/.test(c1.textContent) && /หมดอายุ/.test(c1.textContent) && /ครั้งถัดไป/.test(c1.textContent), c1.textContent.slice(0, 200));
  ok('การ์ดของวีระ: ครบเกณฑ์ใกล้หมดอายุ? (หมดอายุอีก 25 วัน = ยังไม่แดง) · ผู้เยาว์มีป้าย', !/ใกล้หมดอายุ/.test(c1.textContent) && /ผู้เยาว์/.test(card('e-m2').textContent));
  ok('สถิติ: กำลังเรียน 2 · รอคิว 1 · ใกล้หมดอายุ 0 · รอบใน 7 วัน 1 (s2)', J([...$('app').querySelectorAll('.stat-v')].map(e => e.textContent)) === J(['2', '1', '0', '1']), J([...$('app').querySelectorAll('.stat-v')].map(e => e.textContent)));

  // ── ขอบเขตข้อมูล: ไม่ดึง · ไม่วาด ──
  const tables = new Set(CALLS.filter(c => c.table).map(c => c.table));
  ok('ตารางที่หน้านี้อ่าน = class_sessions · enrollment_extension_requests · teachers เท่านั้น (ไม่มี customers · members · admins · เงิน · enrollments)', [...tables].every(t => /^(class_sessions|enrollment_extension_requests|teachers|session_notes)$/.test(t)), [...tables].join());
  const fns = new Set(CALLS.filter(c => c.op === 'rpc').map(c => c.fn));
  ok('ฟังก์ชันที่เรียก = my_teacher_id · teach_my_students (ยังไม่มีการเขียนใด ๆ)', [...fns].every(f => /^(my_teacher_id|teach_my_students)$/.test(f)), [...fns].join());
  ok('ไม่มีการเขียนตารางตรง ๆ ตลอดการเข้าใช้ (insert/update/delete)', !CALLS.some(c => c.op === 'insert' || c.op === 'update' || c.op === 'delete' || c.op === 'upsert'));
  ok('ไม่วาดเงิน/สลิป/การขายใด ๆ ในหน้า (ไม่มี ฿ · บาท · ราคา · คืนเงิน · สลิป)', !/฿|บาท|ราคา|คืนเงิน|สลิป|ยอดชำระ/.test(txt()), txt().slice(0, 200));
  ok('ไม่มีปุ่มปิดคอร์ส · ขยายอายุเอง · แก้ข้อมูลการลงเรียน · บันทึกชำระ · คืนเงิน', !/ปิดคอร์ส|ขยายอายุเอง|แก้ข้อมูลการลงเรียน|บันทึกชำระ/.test(txt()));
  await shot('t1-list');

  // ── ข้อมูลติดต่อ ──
  await ostu('e-month');
  const ct = $('contact').textContent;
  ok('นักเรียนผู้ใหญ่: เห็น LINE · Instagram · เบอร์โทรเต็ม (เจ้าของตัดสิน 12 ต.ค. 69) ไม่ปิดบังเลข', /wee[.]line/.test(ct) && /wee_ig/.test(ct) && /0812345678/.test(ct) && !/•••/.test(ct), ct);
  ok('ไม่มีอีเมล/ที่อยู่/หมายเหตุพนักงาน ในหน้า', !/@|ที่อยู่/.test(txt().replace(/[0-9a-z_.]+@x/gi, '')) );
  dact('back'); await settle(100);
  ok('หน้ารายการ/การ์ดไม่แสดงเบอร์ของใคร (เบอร์อยู่เฉพาะแผงติดต่อของนักเรียนที่เปิด)', !/0812345678|0800000000/.test($('app').textContent), '');
  await ostu('e-m2');
  const ct2 = $('contact').textContent;
  ok('ผู้เยาว์: เห็นผู้ปกครอง + ช่องทางของผู้ปกครอง · ไม่เห็น LINE/IG/เบอร์ของตัวเด็ก', /คุณแม่ของดาว/.test(ct2) && /LINE/.test(ct2) && /mom-dao-line/.test(ct2) && /ติดต่อผ่านผู้ปกครอง/.test(ct2)
    && !/child-line-must-not-show|child_ig_must_not_show/.test(html()) && !/0800000000/.test(html()) && !/โทรศัพท์/.test(ct2), ct2);
  dact('back'); await settle(100);
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
async function shot(name) { await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); await sleep(150); await new Promise(r => { window.__shot = r; console.log('[SHOT] ' + name); }); }
</script>`;

// ── 2. ทำงาน ──
const T2 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== หน้าครู (2/4): สอนแล้ว · ยกเลิก/ไม่มา · บันทึกการสอน · นัดรอบ · ขอขยายอายุ ===');
  seedManiac();
  await sleep(300);
  await signIn('maniac');
  await ostu('e-month');
  ok('รอบเรียนของวีระ 5 รอบ เรียงตามวัน: สอนแล้ว 2 · ไม่มา 1 · นัดไว้เลยเวลา 1 · นัดไว้ล่วงหน้า 1', scIds().join() === 's-m1,s-m2,s-m3,s-over,s2', scIds().join());
  ok('รอบที่เลยเวลานัด: แดงตัวหนา "เลยเวลานัดแล้ว ยังไม่ได้ทำเครื่องหมาย"', isRed(sc('s-over').querySelector('.wk-red')));
  ok('บันทึกการสอนของรอบตัวเองขึ้นให้ (s-m2) · โหลดเฉพาะรอบของนักเรียนคนนี้', /บันทึกของครู Maniac/.test(sc('s-m2').textContent)
    && CALLS.some(c => c.table === 'session_notes'));

  // ── สอนแล้ว ──
  oform('done', 's2'); await settle(100);
  ok('ฟอร์มสอนแล้ว: วันที่ตั้งต้น = วันนี้ (นัดไว้ล่วงหน้า) · มีคำอธิบายเรื่องวันเริ่มเรียน', $('f_date').value === day(0) && /ระบบตั้งวันเริ่มเรียน/.test($('formDone').textContent));
  fillf('date', day(1));
  const nd = rpcCalls('teach_session_done').length;
  submitK('done'); await settle(100);
  ok('วันที่เกินวันนี้: ไม่ส่งฐาน · ข้อความแดง', /ไม่เกินวันนี้/.test(errTxt()) && rpcCalls('teach_session_done').length === nd);
  fillf('date', day(0)); fillf('hours', '1.5');
  let release; TEACH.gateRpc = new Promise(r => { release = r; });
  submitK('done'); await sleep(80);
  const sb = $('app').querySelector('[data-act="submit"][data-k="done"]');
  ok('ระหว่างส่ง: ปุ่มล็อก "กำลังบันทึก…" · ปุ่มอื่นล็อกด้วย', sb.disabled && /กำลังบันทึก/.test(sb.textContent) && [...$('app').querySelectorAll('button[data-act]')].every(b => b.disabled));
  sb.click(); sb.click(); await sleep(50);
  TEACH.gateRpc = null; release(); await settle(700);
  ok('กดซ้ำระหว่างส่ง: ส่งฐานครั้งเดียว · ส่งวันที่+ชั่วโมงตามที่กรอก · รอบเปลี่ยนเป็นสอนแล้ว',
    rpcCalls('teach_session_done').length === nd + 1 && lastArgs('teach_session_done').p_session === 's2' && lastArgs('teach_session_done').p_held_on === day(0) && lastArgs('teach_session_done').p_hours === 1.5
    && /สอนแล้ว/.test(sc('s2').textContent) && /ทำเครื่องหมายสอนแล้ว ✓/.test(okText()), sc('s2').textContent);
  ok('ตัวนับเปลี่ยนตามฐาน: เรียนแล้ว 3/6 ที่หัวแผง', /3\\/6/.test($('head').textContent), $('head').textContent);

  // ── ยกเลิก / ไม่มา ──
  oform('sched'); fillf('date', day(1)); fillf('start', '09:00'); fillf('end', '11:00'); fillf('room', 'ห้องเล็ก1');
  submitK('sched'); await settle(700);
  const near = TEACH.sessions.find(x => x.starts_at === day(1) + 'T09:00:00+07:00');
  const as = lastArgs('teach_session_schedule');
  ok('นัดรอบ: ส่งครูเป็นตัวเอง (t3) · เวลาไทย +07:00 · ห้อง · ชั่วโมงว่าง (ฐานคิดตามคอร์ส)', as.p_teacher === 't3' && as.p_starts === day(1) + 'T09:00:00+07:00' && as.p_ends === day(1) + 'T11:00:00+07:00' && as.p_room === 'ห้องเล็ก1' && as.p_hours === null && as.p_enrollment === 'e-month' && !!near, J(as));
  oform('cancel', near.id); await settle(100);
  ok('ฟอร์มยกเลิก: นักเรียนแจ้งวันนี้ ก่อนนัด 1 วัน → ตัวอย่างผลแดงตัวหนา "นับเป็นครั้งที่ใช้ไป"', isRed($('cancelPrev').querySelector('.wk-red')) && /นับเป็นครั้งที่ใช้ไป/.test($('cancelPrev').textContent));
  fillf('by', 'teacher'); await settle(100);
  ok('ครูยกเลิกเอง: ตัวอย่างผลไม่แดง "ไม่นับ"', !$('cancelPrev').querySelector('.wk-red') && /ไม่นับเป็นครั้งที่ใช้ไป/.test($('cancelPrev').textContent));
  fillf('as', 'no_show'); await settle(100);
  ok('ไม่มา: ไม่มีช่องใครยกเลิก · แดงตัวหนา "นับเป็นครั้งที่ใช้ไปเสมอ"', !$('f_by') && isRed($('cancelPrev').querySelector('.wk-red')));
  fillf('as', 'cancelled'); fillf('by', 'student'); await settle(100);
  fillf('reason', 'ติดธุระ');
  submitK('cancel'); await settle(700);
  const ca = lastArgs('teach_session_cancel');
  ok('ยกเลิกโดยนักเรียนแจ้งช้า: ส่ง cancelled/student · p_notified_at ว่าง (ฐานใช้เวลาปัจจุบัน) · เหตุผล · ผล "นับเป็นครั้งที่ใช้ไป" แดง', ca.p_as === 'cancelled' && ca.p_by === 'student' && ca.p_notified_at === null && ca.p_reason === 'ติดธุระ'
    && /นับเป็นครั้งที่ใช้ไป/.test(okText()) && isRed(sc(near.id).querySelector('.wk-red')), J(ca));
  oform('cancel', 's-over'); fillf('as', 'no_show'); await settle(100);
  submitK('cancel'); await settle(700);
  ok('ไม่มา: ส่ง no_show · by ว่าง · แถว "ไม่มา"', lastArgs('teach_session_cancel').p_as === 'no_show' && lastArgs('teach_session_cancel').p_by === null && /ไม่มา/.test(sc('s-over').textContent));

  // ── บันทึกการสอน ──
  oform('note', 's-m1'); await settle(100);
  ok('ฟอร์มบันทึก: บอกว่าเห็นเฉพาะเจ้าของร้านและครูของนักเรียนคนนี้', /เห็นเฉพาะเจ้าของร้านและครู/.test($('formNote').textContent));
  fillf('text', 'ซ้อมจังหวะ <b onmouseover=window.__xss=7>ตัวหนา</b>\\nบรรทัดสอง');
  submitK('note'); await settle(700);
  ok('บันทึก: ส่งข้อความตามที่พิมพ์ · แสดงเป็นข้อความ (ไม่มีแท็ก b) · ข้อความเขียว', lastArgs('teach_note_save').p_session === 's-m1' && /<b onmouseover/.test(lastArgs('teach_note_save').p_note) && !sc('s-m1').querySelector('b') && !window.__xss && /บันทึกการสอนแล้ว/.test(okText()));
  oform('note', 's-m1'); fillf('text', '   ');
  submitK('note'); await settle(700);
  ok('ข้อความว่าง = ลบบันทึก: บันทึกหายจากรอบ · ข้อความ "ลบบันทึกการสอนแล้ว"', /ลบบันทึกการสอนแล้ว/.test(okText()) && !sc('s-m1').querySelector('.note'));

  // ── นัดซ้อน · คำเตือน ──
  oform('sched'); fillf('date', day(3)); fillf('start', '10:00'); fillf('end', '12:00');
  submitK('sched'); await settle(700);
  ok('นัดรอบวันที่ 3 สำเร็จ ไม่มีคำเตือน (ก่อนวันหมดอายุ)', /นัดรอบเรียนแล้ว/.test(okText()) && !$('detWarn') || /เกินจำนวนครั้ง/.test(warnTxt()), okText() + warnTxt());
  oform('sched'); fillf('date', day(3)); fillf('start', '11:00'); fillf('end', '13:00');
  submitK('sched'); await settle(600);
  ok('นัดซ้อนกับรอบเดิมของครูคนนี้: ฐานปฏิเสธ · ข้อความไทยแดงตัวหนา · ฟอร์มยังเปิด', /ซ้อนกัน/.test(errTxt()) && isRed($('detErr')) && !!$('formSched'));
  fillf('date', day(80)); fillf('start', '10:00'); fillf('end', '12:00');
  submitK('sched'); await settle(700);
  ok('นัดหลังวันหมดอายุ: บันทึกให้ + คำเตือนแดงตัวหนา (ไม่บล็อก)', /หลังวันหมดอายุ/.test(warnTxt()) && isRed($('detWarn').querySelector('.wk-red')), warnTxt());

  // ── ขอขยายอายุ ──
  ok('ส่วนขอขยายอายุ: มีแค่ปุ่ม "ขอขยายอายุ" + ข้อความว่าครูขยายเองไม่ได้ · ไม่มีปุ่มขยายเอง/อนุมัติ', has('open', '[data-k="ext"]') && /ครูไม่ขยายเองได้/.test($('ext').textContent) && !has('open', '[data-k="decide"]'));
  oform('ext'); await settle(100);
  const nq = rpcCalls('teach_extend_request').length;
  fillf('until', day(40));
  submitK('ext'); await settle(100);
  ok('ไม่ใส่เหตุผล: ไม่ส่งฐาน', /ใส่เหตุผล/.test(errTxt()) && rpcCalls('teach_extend_request').length === nq);
  fillf('until', day(20)); fillf('reason', 'นักเรียนติดสอบ');
  submitK('ext'); await settle(100);
  ok('วันที่ไม่เกินวันหมดอายุเดิม: ไม่ส่งฐาน', /ต้องเกินวันหมดอายุปัจจุบัน/.test(errTxt()) && rpcCalls('teach_extend_request').length === nq);
  fillf('until', day(40));
  submitK('ext'); await settle(700);
  ok('ยื่นคำขอ: ส่งวัน+เหตุผล · ขึ้น "รอเจ้าของร้านตัดสิน" · ปุ่มขอหาย (ยื่นซ้ำไม่ได้)', J(lastArgs('teach_extend_request')) === J({ p_enrollment: 'e-month', p_until: day(40), p_reason: 'นักเรียนติดสอบ' })
    && !!$('extPending') && /รอเจ้าของร้านตัดสิน/.test($('extPending').textContent) && !has('open', '[data-k="ext"]'), $('ext').textContent);
  ok('ตลอดการทำงาน: ไม่มียอดเงิน · ไม่เรียกฟังก์ชันที่ครูทำไม่ได้ (ชำระ/ปิด/ขยายเอง/ตัดสิน/แก้)', !/฿|บาท/.test(txt())
    && !CALLS.some(c => c.op === 'rpc' && /^teach_(payment_|enroll_(close|reopen|fix|extend)|extend_decide|gcal|student_)/.test(c.fn)));
  // ── คอร์สที่ปิดแล้ว: นัดรอบ/ขอขยายอายุไม่ได้ ──
  dact('back'); await settle(100);
  TEACH.rows.find(r => r.id === 'e-month').state = 'closed';
  $('reload').click(); await settle(600);
  await ostu('e-month');
  ok('คอร์สที่ปิดแล้ว: ไม่มีปุ่มนัดรอบ/ขอขยายอายุ · บอกเหตุผล · ยังบันทึกการสอนได้', !has('open', '[data-k="sched"]') && !has('open', '[data-k="ext"]') && /ปิดแล้ว — นัดรอบใหม่ไม่ได้/.test(txt()) && /ปิดแล้ว — ขอขยายอายุไม่ได้/.test(txt()) && has('open', '[data-k="note"]'));
  ok('ข้อความผิดพลาดทุกข้อความไม่มียอดเงิน/เบอร์', !/[0-9]{4,}/.test((errTxt() + warnTxt() + okText()).replace(/\\d{4}-\\d{2}-\\d{2}/g, '')));
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

// ── 3. ตารางสอน · Realtime · สลับบัญชี · ครูที่เป็นพนักงาน ──
const T3 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== หน้าครู (3/4): ตารางสอน · Realtime · ออกจากระบบ · สลับบัญชี · ครูที่เป็นพนักงาน · XSS ===');
  seedManiac();
  await sleep(300);
  await signIn('maniac');
  tabTo('schedule'); await settle(100);
  const grp = [...$('app').querySelectorAll('.grp')].map(g => g.firstChild.textContent.trim());
  ok('ตารางสอน: กลุ่ม "เลยเวลานัด" 1 (s-over) · "สัปดาห์นี้" 1 (s2) · "ที่จะถึง" 0', grp.length === 3 && /เลยเวลานัดแล้ว/.test(grp[0]) && /สัปดาห์นี้/.test(grp[1]) && /ที่จะถึง/.test(grp[2])
    && cards().length === 2 && cards().every(c => c.dataset.eid === 'e-month'), grp.join('|') + ' ' + cards().length);
  ok('รอบเรียนบอกเวลา · นักเรียน · คอร์ส · ห้อง · เลยเวลาแดงตัวหนา', /วีระ ชูใจ/.test(cards()[0].textContent) && /Basic DJ Class/.test(cards()[0].textContent) && isRed(cards()[0].querySelector('.wk-red')));
  cards()[1].click(); await settle(500);
  ok('คลิกรอบ: เปิดแผงของนักเรียนนั้น + เลื่อนไปที่รอบ', !!$('head') && /วีระ ชูใจ/.test($('head').textContent) && !!sc('s2'));
  dact('back'); await settle(100);

  // ── Realtime ──
  const loads0 = rpcCalls('teach_my_students').length;
  TEACH.sessions.push({ id: 's-rt', enrollment_id: 'e-month', teacher_id: 't3', status: 'scheduled', starts_at: new Date(Date.now() + 9 * 86400000).toISOString(), ends_at: new Date(Date.now() + 9 * 86400000 + 7200000).toISOString(),
    held_on: null, hours: '2.00', room: 'ห้อง Realtime', cancel_by: null, notified_at: null, late_cancel: false, cancel_reason: null, gcal_uid: null, gcal_start: null, created_at: new Date().toISOString() });
  TEACH.fireRt('class_sessions'); await sleep(900);
  ok('Realtime: รอบใหม่จากที่อื่นโผล่ในตารางสอนเอง · โหลดใหม่', rpcCalls('teach_my_students').length > loads0 && cards().some(c => c.dataset.sid === 's-rt'), String(cards().length));
  ok('ตั้งช่อง Realtime ครอบ 3 ตาราง (รอบเรียน · การลงเรียน · คำขอขยายอายุ) — ไม่ฟังตารางเงิน', TEACH.subs.map(s => s.table).sort().join() === 'class_sessions,enrollment_extension_requests,enrollments', TEACH.subs.map(s => s.table).join());

  // ── ออกจากระบบ: ข้อมูลไม่ค้าง ──
  await ostu('e-month');
  ok('ก่อนออก: แผงมีชื่อนักเรียนและบันทึกการสอน', /วีระ ชูใจ/.test(txt()) && /บันทึกของครู Maniac/.test(txt()));
  await signOut();
  ok('ออกจากระบบ: DOM ของหน้าไม่เหลือข้อมูลนักเรียน/บันทึก/ติดต่อ · แถบบนว่าง · ปุ่มออกซ่อน', !/วีระ|ดวงดาว|บันทึกของครู|wee/.test($('app').innerHTML) && $('who').textContent === '' && $('logoutBtn').hidden && !!$('loginForm'));

  // ── สลับบัญชีกลางโหลด: ผลของ Maniac ต้องไม่โผล่ให้ Alldayz ──
  let release; TEACH.gateRpc = new Promise(r => { release = r; });
  await signIn('maniac');
  await sleep(200);
  TEACH.gateRpc = null;                         // บัญชีถัดไปโหลดทันที — ผลของ Maniac ที่ค้างอยู่จะมาถึงทีหลังสุด (กรณีที่อันตรายที่สุด)
  await signOut();
  await signIn('alldayz');
  await sleep(500);
  release(); await sleep(900);
  ok('ผลโหลดช้าของ Maniac ที่มาถึงหลังสลับเป็น Alldayz: ไม่โผล่ · Alldayz ไม่มีนักเรียน', !/วีระ|ดวงดาว|ปิติ/.test(txt()) && /ยังไม่มีนักเรียนที่ลงเรียนกับครู Alldayz/.test(txt()) && cards().length === 0, txt().slice(0, 200));
  // รอบสอนแทน: Alldayz สอนรอบของนักเรียน Maniac — เห็นแถวรอบ แต่ไม่รู้ชื่อนักเรียน (ไม่ใช่ลูกศิษย์ตัวเอง) → ไม่ขึ้นในตารางสอน
  TEACH.sessions.push({ id: 's-sub', enrollment_id: 'e-m3', teacher_id: 't6', status: 'scheduled', starts_at: new Date(Date.now() + 2 * 86400000).toISOString(), ends_at: new Date(Date.now() + 2 * 86400000 + 7200000).toISOString(),
    held_on: null, hours: '2.00', room: null, cancel_by: null, notified_at: null, late_cancel: false, cancel_reason: null, gcal_uid: null, gcal_start: null, created_at: new Date().toISOString() });
  $('reload').click(); await settle(600);
  tabTo('schedule'); await settle(100);
  ok('รอบสอนแทน (นักเรียนของ Maniac): ไม่แสดงชื่อ/ข้อมูลนักเรียนของครูอื่นในตารางของ Alldayz', cards().length === 0 && !/ปิติ|ดวงดาว/.test(txt()), txt().slice(0, 160));
  await signOut();

  // ── ครูที่เป็นพนักงาน (Nutty = staff + ครู t2) ──
  await signIn('nutty');
  ok('ครูที่เป็นพนักงาน (มีแถว admins): ใช้หน้านี้ได้ · เห็นเฉพาะนักเรียนของตัวเอง (t2)', /ครู Nutty/.test($('who').textContent) && cards().length >= 1 && cards().every(c => ['e-soon', 'e-queued', 'e-expired', 'e-backfill'].includes(c.dataset.eid)), cards().map(c => c.dataset.eid).join());
  ok('Nutty ไม่เห็นเงินของนักเรียนตัวเองในหน้านี้ (หน้าครูไม่แสดงเงินแม้ฐานให้ครูอ่านได้)', !/฿|บาท|ราคา|ชำระครบ/.test(txt()) && !CALLS.some(c => /^enrollment_(money|payments)$/.test(c.table || '')));
  ok('การ์ดที่หมดอายุแล้วเหลือครั้ง: แดงตัวหนา', isRed(card('e-expired').querySelector('.wk-red')) && /หมดอายุแล้ว เหลือ 2 ครั้ง/.test(card('e-expired').textContent));
  ok('การ์ดใกล้หมดอายุ (5 วัน): แดงตัวหนา', isRed(card('e-soon').querySelector('.wk-red')) && /ใกล้หมดอายุ/.test(card('e-soon').textContent));
  await signOut();

  // ── XSS ──
  FAKE.customers.find(c => c.id === 'c9').full_name = '<img src=x onerror="window.__xss=9">ชื่อแปลก';
  TEACH.rows.find(r => r.id === 'e-xss').teacher_id = 't3';
  TEACH.rows.find(r => r.id === 'e-xss').teacher_name = 'Maniac';
  await signIn('maniac');
  ok('ชื่อนักเรียน/คอร์ส ที่เป็น HTML แสดงเป็นข้อความ (XSS)', !$('app').querySelector('img') && !$('app').querySelector('b') && /<img src=x/.test(txt()) && !window.__xss);
  await ostu('e-xss');
  ok('แผงรายละเอียด: ชื่อ/คอร์สที่เป็น HTML ก็เป็นข้อความ', !$('app').querySelector('img') && !$('app').querySelector('b') && /<b onmouseover/.test(txt()) && !window.__xss);
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

// ── 4. iPhone 390 ──
const T4 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== หน้าครู (4/4): iPhone 390px ===');
  seedManiac();
  await sleep(300);
  await signIn('maniac');
  ok('iPhone: หน้ารายชื่อไม่ล้นจอ · การ์ดสูง ≥ 44px · แท็บ/ปุ่มรีเฟรช/ช่องค้นหาสูง ≥ 44px', document.documentElement.scrollWidth <= window.innerWidth + 1 && cards().every(c => c.getBoundingClientRect().height >= 44)
    && [...$('app').querySelectorAll('#tabs button, #reload, #q')].every(e => e.getBoundingClientRect().height >= 43.5), document.documentElement.scrollWidth + '>' + window.innerWidth);
  ok('iPhone: ตัวหนังสือทุกตัวในหน้า ≥ 14px', [...$('app').querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim()).every(e => parseFloat(getComputedStyle(e).fontSize) >= 14),
    [...$('app').querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 14).map(e => e.textContent.slice(0, 20)).join());
  await shot('t4-phone-list');
  await ostu('e-month');
  oform('cancel', 's-over'); await settle(150);
  ok('iPhone: แผงรายละเอียด+ฟอร์มไม่ล้นจอ', document.documentElement.scrollWidth <= window.innerWidth + 1, document.documentElement.scrollWidth + '>' + window.innerWidth);
  const els = [...$('app').querySelectorAll('#formCancel input.input, #formCancel select.input, #formCancel button, .back button, #sessions .acts button')];
  ok('iPhone: ช่องกรอก/ปุ่มทุกตัวสูง ≥ 44px', els.length > 5 && els.every(e => e.getBoundingClientRect().height >= 43.5), els.map(e => Math.round(e.getBoundingClientRect().height)).join());
  ok('iPhone: ช่องกรอกตัวหนังสือ ≥ 16px (iOS ไม่ซูมเอง)', [...$('app').querySelectorAll('input.input, select.input, textarea.input')].every(e => parseFloat(getComputedStyle(e).fontSize) >= 16));
  ok('iPhone: ข้อความแดงตัวหนาไม่ถูกตัด', isRed($('cancelPrev').querySelector('.wk-red')) && $('cancelPrev').getBoundingClientRect().right <= window.innerWidth + 1);
  await shot('t4-phone-detail');
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
async function shot(name) { await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); await sleep(150); await new Promise(r => { window.__shot = r; console.log('[SHOT] ' + name); }); }
</script>`;

// ── 5. เพิ่มนักเรียนเอง · ผูกนัดปฏิทิน (060 · เจ้าของสั่ง 14 ต.ค. 69) ──
const T5 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
const add = id => $('addStu') && $('addStu').querySelector('#' + id);
const aact = (a, extra) => { const b = $('app').querySelector('[data-act="' + a + '"]' + (extra || '')); if (!b) throw new Error('ไม่พบปุ่ม ' + a + (extra || '')); b.click(); };
const typePhone = v => { const e = $('a_phone'); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
const findCalls = () => rpcCalls('teach_student_find');
async function runTests() {
  L('=== หน้าครู (5/5): เพิ่มนักเรียนเอง · ผูกนัดปฏิทิน ===');
  seedManiac();
  FAKE.customers.find(c => c.id === 'c2').phone = '0877772222';
  FAKE.customers.find(c => c.id === 'c4').phone = '0899991111';
  await sleep(300);
  await signIn('maniac');
  ok('มีปุ่ม "+ เพิ่มนักเรียน" ที่หน้ารายชื่อ (≥ 44px) · ยังไม่โหลดคอร์ส/ไม่เรียกค้นหา', !!$('addOpen') && $('addOpen').getBoundingClientRect().height >= 43.5
    && !CALLS.some(c => c.table === 'courses' || c.table === 'course_teachers') && findCalls().length === 0);
  $('addOpen').click(); await settle(300);
  ok('เปิดฟอร์ม: มีช่องเบอร์ + ปุ่มค้นหา · โหลดเฉพาะคอร์สที่ตัวเองสอน (courses + course_teachers) · ยังไม่เรียกค้นหา',
    !!$('a_phone') && !!$('app').querySelector('[data-act="add-find"]') && CALLS.some(c => c.table === 'courses') && CALLS.some(c => c.table === 'course_teachers') && findCalls().length === 0);
  ok('ฟอร์มบอกว่าค้นด้วยชื่อไม่ได้ · แสดงเฉพาะชื่อกับเบอร์ 4 ตัวท้าย', /ค้นด้วยชื่อไม่ได้/.test($('addStu').textContent) && /4 ตัวท้าย/.test($('addStu').textContent));
  // ค้นด้วยชื่อ/เบอร์ไม่ครบ: ไม่ยิงฐาน
  typePhone('ปิติ'); aact('add-find'); await settle(200);
  ok('พิมพ์ชื่อแทนเบอร์: ไม่ส่งฐาน · ข้อความแดงตัวหนา', findCalls().length === 0 && isRed($('addErr')) && /ค้นด้วยชื่อไม่ได้/.test($('addErr').textContent), $('addErr') && $('addErr').textContent);
  typePhone('08777'); aact('add-find'); await settle(200);
  ok('เบอร์ไม่ครบ 9 หลัก: ไม่ส่งฐาน', findCalls().length === 0 && isRed($('addErr')));
  typePhone('0877772222 มานี'); aact('add-find'); await settle(200);
  ok('เบอร์ปนตัวอักษร: ไม่ส่งฐาน', findCalls().length === 0);
  // ค้นด้วยเบอร์เต็ม
  typePhone('087-777-2222'); aact('add-find'); await settle(400);
  ok('ค้นเบอร์เต็ม: ส่งตามที่พิมพ์ให้ฐานตัดสิน · เห็นชื่อ + เบอร์ปิด (4 ตัวท้าย) · ไม่เห็นเบอร์เต็ม/รหัสสมาชิก',
    findCalls().length === 1 && findCalls()[0].args.p_query === '087-777-2222' && /มานี มีนา/.test($('addStu').textContent) && /[*]{6}2222/.test($('addStu').textContent)
    && !/877772222|0877/.test($('addStu').textContent), $('addStu').textContent.slice(0, 160));
  aact('add-pick', '[data-i="0"]'); await settle(200);
  ok('เลือกแล้ว: ขึ้นฟอร์มคอร์ส · ตัวเลือกคอร์สมีเฉพาะที่ Maniac สอน (Basic DJ — ไม่มี Advance Scratch/คอร์สที่ปิด)', !!$('a_course')
    && [...$('a_course').options].map(o => o.textContent).join('|') === '— เลือกคอร์ส —|Basic DJ Class', [...$('a_course').options].map(o => o.textContent).join('|'));
  ok('ปุ่มลงเรียนปิดอยู่จนกว่าจะเลือกคอร์ส · มีแค่สวิตช์ "ย้อนหลัง" (ปิดอยู่) — ไม่มีช่องกรอกราคา/ชำระ/วันเริ่มจนกว่าจะเปิดสวิตช์', $('app').querySelector('[data-act="add-submit"]').disabled === true
    && [...$('addStu').querySelectorAll('input, textarea')].map(e => e.id).join() === 'a_phone,a_back' && $('a_back').checked === false && !$('backForm') && !$('a_started') && !$('a_paid'));
  $('a_course').value = 'basic-dj-class'; $('a_course').dispatchEvent(new Event('change', { bubbles: true })); await settle(150);
  ok('เลือกคอร์ส: เห็นราคาตั้ง 20,000 บาท อ่านอย่างเดียว · จำนวนครั้ง/อายุ · ข้อความแดงตัวหนา "ต้องรอเจ้าของ/ผู้ดูแลบันทึกชำระ"',
    /20,000 บาท/.test($('coursePrice').textContent) && /แก้ไม่ได้/.test($('coursePrice').textContent) && isRed($('payNote')) && /บันทึกชำระ/.test($('payNote').textContent)
    && $('app').querySelector('[data-act="add-submit"]').disabled === false);
  await shot('t5-add-form');
  // ฐานปฏิเสธ → ข้อความไทยของฐาน / ข้อความอังกฤษไม่หลุด
  TEACH.fail.rpc_teach_enroll_create = 'ครูคนนี้ไม่ได้เปิดสอนคอร์สนี้ หรือถูกปิดใช้งาน';
  aact('add-submit'); await settle(400);
  ok('ฐานปฏิเสธเป็นข้อความไทย: แสดงตามที่ฐานตอบ · ฟอร์มยังอยู่ (ลองใหม่ได้)', /ครูคนนี้ไม่ได้เปิดสอนคอร์สนี้/.test($('addErr').textContent) && !!$('a_course') && isRed($('addErr')));
  TEACH.fail.rpc_teach_enroll_create = 'duplicate key value violates unique constraint "e" DETAIL: Key (customer)=(c2) already exists';
  aact('add-submit'); await settle(400);
  ok('ข้อความอังกฤษดิบของฐานไม่ถูกแสดง (กันค่าในแถวหลุด)', /ฐานข้อมูลตอบกลับผิดปกติ/.test($('addErr').textContent) && !/duplicate|customer\\)=/.test($('addErr').textContent));
  TEACH.fail = {};
  const nE = rpcCalls('teach_enroll_create').length;
  let release; TEACH.gateRpc = new Promise(r => { release = r; });
  aact('add-submit'); await sleep(60);
  ok('ระหว่างส่ง: ปุ่มลงเรียนถูกล็อก · ข้อความ "กำลังลงเรียน…"', $('app').querySelector('[data-act="add-submit"]').disabled === true && /กำลังลงเรียน/.test($('app').textContent));
  $('app').querySelector('[data-act="add-submit"]').click(); $('app').querySelector('[data-act="add-submit"]').click();
  TEACH.gateRpc = null; release(); await settle(800);
  const ea = lastArgs('teach_enroll_create');
  ok('กดซ้ำระหว่างส่ง: ลงเรียนครั้งเดียว · ค่าที่ส่ง = ตัวเอง(t3) · console · th · ราคา = ราคาตั้ง · ไม่มีย้อนหลัง/ชำระครบไม่ทราบวันที่/ราคาตั้งเอง',
    rpcCalls('teach_enroll_create').length === nE + 1 && ea.p_customer === 'c2' && ea.p_course === 'basic-dj-class' && ea.p_teacher === 't3' && ea.p_price_agreed === 20000 && ea.p_source === 'console'
    && ea.p_teach_lang === 'th' && ea.p_started_on === null && ea.p_paid_unknown === false && ea.p_list_price === null, J(ea));
  ok('สำเร็จ: กลับหน้ารายชื่อ · แถบเขียวบอกว่ารอเจ้าของ/ผู้ดูแลบันทึกชำระก่อนนัดคาบ · นักเรียนใหม่ขึ้นในกลุ่ม "รอชำระ"',
    !$('addStu') && /รอเจ้าของ\\/ผู้ดูแลบันทึกชำระก่อน จึงนัดรอบเรียนได้/.test(($('flash') || {}).textContent || '') && /รอชำระ [0-9]+ คน/.test(txt()) && !!cards().find(c => /มานี มีนา/.test(c.textContent)), ($('flash') || {}).textContent);
  // สมาชิกที่ยังไม่มีแถวลูกค้า / ไม่พบ
  $('addOpen').click(); await settle(300);
  typePhone('081-000-0011'); aact('add-find'); await settle(400);
  ok('เบอร์ที่มีแต่ในทะเบียนสมาชิก: เห็นชื่อ + เบอร์ปิด · ข้อความแดง "ให้ทีมงานสร้างลูกค้าก่อน" · ไม่มีปุ่มเลือก',
    /ผู้สมัครทดสอบ หนึ่ง/.test($('addStu').textContent) && /[*]{6}0011/.test($('addStu').textContent) && /ให้ทีมงานสร้างลูกค้าก่อน/.test($('addStu').textContent)
    && !$('app').querySelector('[data-act="add-pick"]') && isRed($('addStu').querySelector('.wk-red')));
  typePhone('0800000099'); aact('add-find'); await settle(400);
  ok('ไม่พบ: บอกตรง ๆ ว่าให้ทีมงานสร้างลูกค้า (อาจารย์สร้างลูกค้าใหม่เองไม่ได้) · ไม่มีปุ่มสร้างลูกค้า', !!$('addNone') && /สร้างลูกค้าใหม่เองไม่ได้/.test($('addNone').textContent) && !$('app').querySelector('[data-act="newToggle"], [data-act="newCreate"]'));
  ok('ไม่เขียนตารางตรง ๆ ตลอดการเพิ่มนักเรียน (customers/enrollments) · ฟังก์ชันที่เขียน = teach_enroll_create เท่านั้น',
    !CALLS.some(c => c.op === 'insert' || c.op === 'update' || c.op === 'delete' || c.op === 'upsert') && [...new Set(CALLS.filter(c => c.op === 'rpc').map(c => c.fn))].every(f => /^(my_teacher_id|teach_my_students|teach_student_find|teach_enroll_create)$/.test(f)));
  aact('add-back'); await settle(100);

  // ── นักเรียนที่ยังไม่ชำระ: ป้าย + ปุ่มนัดคาบ แสดงข้อความไทยจากฐาน ──
  const newCard = cards().find(c => /มานี มีนา/.test(c.textContent));
  ok('นักเรียนใหม่: การ์ดมีป้าย "รอชำระ"', !!newCard && /รอชำระ/.test(newCard.querySelector('.pills').textContent));
  newCard.click(); await settle(500);
  ok('แผงนักเรียนที่ยังไม่ชำระ: ข้อความ "รอชำระ — รอเจ้าของ/ผู้ดูแลบันทึกชำระ จึงจะนัดรอบเรียนได้" (แดง)', !!$('payWait') && isRed($('payWait').querySelector('.wk-red')) && /รอเจ้าของ\\/ผู้ดูแลบันทึกชำระ/.test($('payWait').textContent));
  oform('sched'); await settle(100);
  fillf('date', day(4)); fillf('start', '10:00'); fillf('end', '12:00');
  submitK('sched'); await settle(500);
  ok('นัดรอบของคนที่ยังไม่ชำระ: ฐานปฏิเสธ · แถบแดงข้อความไทยจากฐาน "ยังไม่ชำระครบ…" (ไม่ใช่ error ดิบ) · ไม่เกิดรอบ', /ยังไม่ชำระครบ/.test(errTxt()) && isRed($('detErr')) && !/permission|violates|42501/.test(errTxt()));
  ok('ในแผงยังไม่มียอดเงิน/ราคาที่ตกลง/สลิปใด ๆ (ขอบเขตเดิมของหน้าครู)', !/฿|ราคาที่ตกลง|สลิป|ชำระสะสม|คงเหลือ/.test($('app').textContent.replace(/รอเจ้าของ[^ ]*บันทึกชำระ/g, '')));
  dact('back'); await settle(100);

  // ── ผูกนัดปฏิทิน ──
  await ostu('e-month');
  ok('รอบที่นัดไว้ยังไม่ผูก: ขึ้น "ยังไม่ผูกกับนัดในปฏิทิน" + ปุ่ม "ผูกนัดปฏิทิน" (≥ 44px)', !!sc('s2').querySelector('[data-cal="none"]') && has('open', '[data-k="link"][data-sid="s2"]')
    && $('app').querySelector('[data-act="open"][data-k="link"][data-sid="s2"]').getBoundingClientRect().height >= 43.5);
  const d5 = day(5);
  window.FN.gcal = () => ({ events: [
    { uid: 'g-m1', title: 'Basic DJ — Maniac', start: d5 + 'T10:00', end: d5 + 'T12:00', all_day: false, location: 'ห้องเล็ก 1' },
    { uid: 'g-m2', title: '[ห้อง A] Mixing - maniac', start: d5 + 'T16:00', end: d5 + 'T18:00', all_day: false, location: '' },
    { uid: 'g-n1', title: 'Scratch — Nutty', start: d5 + 'T10:00', end: d5 + 'T12:00', all_day: false, location: '' },
    { uid: 'g-ad', title: 'วันหยุดร้าน — Maniac', start: d5 + 'T00:00', end: d5 + 'T23:59', all_day: true, location: '' },
  ], color: null, teacher_colors: {} });
  const ng = CALLS.filter(c => c.op === 'fn' && c.name === 'gcal').length;
  oform('link', 's2'); await settle(500);
  const gc = CALLS.filter(c => c.op === 'fn' && c.name === 'gcal');
  ok('ผูกนัด: เรียก gcal ครั้งเดียว ด้วยวันของรอบเดียวกัน (from = to = วันนั้น)', gc.length === ng + 1 && gc[gc.length - 1].body.from === d5 && gc[gc.length - 1].body.to === d5, J(gc[gc.length - 1]));
  const evs = [...$('formLink').querySelectorAll('[data-ev]')].map(e => e.dataset.ev);
  ok('ตัวเลือก = เฉพาะนัดของครู Maniac (ไม่สนตัวพิมพ์ · มี [ห้อง] นำหน้า) · ไม่มีนัดของครูอื่น/นัดทั้งวัน · นัดที่เวลาตรงขึ้นก่อนพร้อมป้าย "เวลาตรง"',
    evs.join() === 'g-m1,g-m2' && /เวลาตรง/.test($('formLink').querySelector('[data-ev="g-m1"]').textContent) && !/เวลาตรง/.test($('formLink').querySelector('[data-ev="g-m2"]').textContent), evs.join());
  const pb = $('formLink').querySelector('[data-act="link-pick"]');
  ok('ปุ่ม "ผูกนัดนี้" สูง ≥ 44px', pb.getBoundingClientRect().height >= 43.5);
  const nL = rpcCalls('teach_gcal_link').length;
  pb.click(); await settle(500);
  const la = lastArgs('teach_gcal_link');
  ok('ผูกแล้ว: teach_gcal_link ด้วยรหัสนัด + เวลาเริ่ม (+07:00) · ข้อความ "ผูกนัดปฏิทินแล้ว" · รอบขึ้น "ผูกกับนัดในปฏิทินแล้ว"',
    rpcCalls('teach_gcal_link').length === nL + 1 && la.p_session === 's2' && la.p_uid === 'g-m1' && la.p_start === d5 + 'T10:00:00+07:00' && /ผูกนัดปฏิทินแล้ว/.test(okText()) && !!sc('s2').querySelector('[data-cal="linked"]'), J(la));
  ok('รอบที่ผูกแล้ว: มีปุ่ม "ถอดนัดปฏิทิน" แทนปุ่มผูก', has('unlink', '[data-sid="s2"]') && !has('open', '[data-k="link"][data-sid="s2"]'));
  const nU = rpcCalls('teach_gcal_unlink').length;
  dact('unlink', '[data-sid="s2"]'); await settle(500);
  ok('ถอด: teach_gcal_unlink · กลับเป็นยังไม่ผูก · ข้อความ "ถอดนัดปฏิทินแล้ว"', rpcCalls('teach_gcal_unlink').length === nU + 1 && !!sc('s2').querySelector('[data-cal="none"]') && /ถอดนัดปฏิทินแล้ว/.test(okText()));
  // ปฏิทินล้ม/ไม่ตั้งค่า/ไม่พบนัด
  window.FN.gcal = () => ({ error: { code: 'not_configured', message: 'x' } });
  oform('link', 's2'); await settle(400);
  ok('ปฏิทินยังไม่ตั้งค่า: ข้อความแดงตัวหนาเป็นภาษาไทย', /ยังไม่ได้เชื่อมปฏิทิน Google/.test($('linkErr').textContent) && isRed($('linkErr')));
  dact('close-form'); await settle(100);
  window.FN.gcal = () => ({ events: [{ uid: 'g-n2', title: 'Scratch — Nutty', start: d5 + 'T10:00', end: d5 + 'T12:00', all_day: false, location: '' }] });
  oform('link', 's2'); await settle(400);
  ok('ไม่มีนัดของครูคนนี้ในวันนั้น: ข้อความ "ไม่พบนัดของครู Maniac" (ไม่แสดงนัดของคนอื่นให้เลือก)', /ไม่พบนัดของครู Maniac/.test($('linkNone').textContent) && !$('formLink').querySelector('[data-ev]'));
  dact('close-form'); await settle(100);
  window.FN.gcal = () => { throw new Error('boom'); };
  oform('link', 's2'); await settle(400);
  ok('ปฏิทินล้มกลางทาง: ข้อความแดงไทย ไม่ใช่ข้อความดิบ', /ดึงปฏิทินไม่สำเร็จ/.test($('linkErr').textContent) && !/boom/.test($('linkErr').textContent));
  dact('close-form'); await settle(100);
  // ผู้เรียกที่ gcal ยังเป็นเวอร์ชันเก่า (403 forbidden)
  window.FN.gcal = () => ({ error: { code: 'forbidden', message: 'บัญชีนี้ไม่ได้อยู่ในทีมงาน' } });
  oform('link', 's2'); await settle(400);
  ok('gcal ตอบ forbidden (ยังไม่ได้ deploy เวอร์ชันใหม่): ข้อความไทยบอกให้แจ้งเจ้าของ', /ติดตั้งฟังก์ชันปฏิทินเวอร์ชันล่าสุด/.test($('linkErr').textContent));
  dact('close-form'); await settle(100);
  ok('ตลอดการใช้งาน: ไม่ดึงตารางเงิน/สลิป/ลูกค้า/สมาชิก (หน้าครูยังไม่เห็นยอด)', !CALLS.some(c => /^(enrollment_money|enrollment_payments|customers|members|admins)$/.test(c.table || '')));
  // ออกจากระบบกลางฟอร์ม: ล้างหมด
  dact('back'); await settle(100);
  $('addOpen').click(); await settle(300);
  typePhone('0877772222'); aact('add-find'); await settle(300);
  await signOut();
  ok('ออกจากระบบกลางฟอร์มเพิ่มนักเรียน: ล้างฟอร์ม/ผลค้น/เบอร์ที่พิมพ์ออกจากหน้า (DOM)', !!$('loginForm') && !$('addStu') && !/มานี|2222|0877/.test($('app').innerHTML));
  await signIn('maniac');
  ok('เข้าใหม่: ฟอร์มเพิ่มนักเรียนไม่ค้าง · ไม่มีแถบเขียวของเดิม', !$('addStu') && !$('flash') && !!$('addOpen'));
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
async function shot(name) { await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); await sleep(150); await new Promise(r => { window.__shot = r; console.log('[SHOT] ' + name); }); }
</script>`;

const T6 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
const aact = (a, extra) => { const b = $('app').querySelector('[data-act="' + a + '"]' + (extra || '')); if (!b) throw new Error('ไม่พบปุ่ม ' + a + (extra || '')); b.click(); };
const typePhone = v => { const e = $('a_phone'); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
const setCourse = v => { $('a_course').value = v; $('a_course').dispatchEvent(new Event('change', { bubbles: true })); };
const tick = id => { const e = $(id); e.checked = !e.checked; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
const setDate = (i, v) => { const e = $('app').querySelector('[data-ad="' + i + '"]'); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
const setStarted = v => { const e = $('a_started'); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
const addDate = () => aact('add-adddate');
const enrolls = () => rpcCalls('teach_enroll_create'), backs = () => rpcCalls('teach_session_backfill');
const errT = () => ($('addErr') || {}).textContent || '';
async function openForm(phone, cid) {
  $('addOpen').click(); await settle(300);
  typePhone(phone); aact('add-find'); await settle(400);
  aact('add-pick', '[data-i="0"]'); await settle(200);
  setCourse('basic-dj-class'); await settle(150);
}
async function runTests() {
  L('=== หน้าครู (6\/6): เพิ่มนักเรียนย้อนหลัง (062) ===');
  seedManiac();
  FAKE.customers.find(c => c.id === 'c2').phone = '0877772222';
  FAKE.customers.find(c => c.id === 'c4').phone = '0899991111';
  FAKE.customers.find(c => c.id === 'c5').phone = '0866665555';
  await sleep(300);
  await signIn('maniac');

  \/\/ ── 1. สวิตช์ + ฟอร์มย้อนหลัง ──
  await openForm('0877772222');
  ok('มีสวิตช์ "นักเรียนเรียนไปแล้ว (กรอกย้อนหลัง)" ปิดอยู่ · สูง ≥ 44px · ยังไม่มีช่องวันเริ่ม\/ชำระ\/วันที่เรียน · ข้อความเดิม "รอเจ้าของ\/ผู้ดูแลบันทึกชำระก่อน"',
    !!$('a_back') && $('a_back').checked === false && $('a_back').closest('label').getBoundingClientRect().height >= 43.5 && !$('backForm') && \/รอเจ้าของ\\/ผู้ดูแลบันทึกชำระก่อน จึงนัดรอบเรียนได้\/.test($('payNote').textContent));
  ok('คำอธิบายใต้สวิตช์: ลงให้ตัวเองเท่านั้น · ไม่ต้องกรอกราคา · ครูที่เป็นพนักงานลงย้อนหลังที่หน้านี้ไม่ได้', \/ลงให้ตัวเองเป็นครูเท่านั้น\/.test($('addForm').textContent) && \/ไม่ต้องกรอกราคา\/.test($('addForm').textContent) && \/ครูที่เป็นพนักงานด้วยลงย้อนหลังที่หน้านี้ไม่ได้\/.test($('addForm').textContent));
  tick('a_back'); await settle(100);
  ok('เปิดสวิตช์: ขึ้นวันเริ่มเรียน (max = วันนี้) · ติ๊กชำระครบ · วันที่เรียนไปแล้ว 0 ครั้ง · ปุ่ม "+ เพิ่มวันที่เรียน" · ปุ่มส่งเป็น "ลงเรียนย้อนหลัง"',
    !!$('backForm') && $('a_started').max === TODAY && $('a_paid').checked === false && \/0\\/6 ครั้ง\/.test($('datesN').textContent) && !!$('app').querySelector('[data-act="add-adddate"]')
    && \/ลงเรียนย้อนหลัง\/.test($('app').querySelector('[data-act="add-submit"]').textContent), $('addForm').textContent.slice(0, 200));
  ok('ไม่มีช่องกรอกราคา\/ยอดชำระ\/สลิปเลย (ราคาที่ตกลงว่างไว้ให้เจ้าของ\/ผู้ดูแล)', ![...$('addStu').querySelectorAll('input')].some(e => \/price|amount|slip|baht|ราคา|ยอด\/i.test(e.id + ' ' + (e.getAttribute('aria-label') || '') + ' ' + (e.placeholder || ''))) && !\/สลิป\/.test($('addStu').textContent));
  ok('ยังไม่ติ๊กชำระ: ข้อความแดงตัวหนา "สถานะจะเป็นรอชำระ… ยังนัดรอบเรียนได้"', isRed($('payNote')) && \/รอชำระ\/.test($('payNote').textContent) && \/ยังนัดรอบเรียนได้\/.test($('payNote').textContent));
  tick('a_paid'); await settle(100);
  ok('ติ๊กชำระครบ: ข้อความเปลี่ยนเป็น "ไม่ต้องรอบันทึกชำระ" (ไม่แดง)', !isRed($('payNote')) && \/ไม่ต้องรอบันทึกชำระ\/.test($('payNote').textContent) && $('a_paid').checked === true);
  tick('a_paid'); await settle(100);
  ok('ติ๊กออก: กลับเป็นข้อความแดงอีกครั้ง', isRed($('payNote')) && $('a_paid').checked === false);
  await shot('t6-back-form');

  \/\/ ── 2. วันที่เรียนไปแล้ว: เพิ่ม\/เอาออก\/เพดาน ──
  addDate(); await settle(60);
  ok('เพิ่มวันที่: ช่องวันที่ 1 ช่อง (max = วันนี้) · ปุ่ม "เอาออก" สูง ≥ 44px', $('app').querySelectorAll('[data-ad]').length === 1 && $('app').querySelector('[data-ad="0"]').max === TODAY
    && $('app').querySelector('[data-act="add-deldate"]').getBoundingClientRect().height >= 43.5);
  const nE0 = enrolls().length;
  aact('add-submit'); await settle(100);
  ok('วันที่ว่างอยู่: ไม่ส่งฐาน · แดงตัวหนา "ใส่วันที่เรียนให้ครบทุกช่อง"', enrolls().length === nE0 && isRed($('addErr')) && \/ใส่วันที่เรียนให้ครบทุกช่อง\/.test(errT()), errT());
  setDate(0, day(2));
  aact('add-submit'); await settle(100);
  ok('วันที่เรียนในอนาคต (ใส่ผ่านโค้ด ข้ามขีดจำกัดของช่อง): ไม่ส่งฐาน · "ต้องไม่เกินวันนี้"', enrolls().length === nE0 && \/วันที่เรียนต้องไม่เกินวันนี้\/.test(errT()), errT());
  setDate(0, day(-10));
  setStarted(day(3));
  aact('add-submit'); await settle(100);
  ok('วันเริ่มเรียนในอนาคต: ไม่ส่งฐาน · "วันเริ่มเรียนต้องไม่เกินวันนี้"', enrolls().length === nE0 && \/วันเริ่มเรียนต้องไม่เกินวันนี้\/.test(errT()), errT());
  setStarted('');
  for (let i = 1; i < 6; i++) { addDate(); await settle(30); setDate(i, day(-10 - i)); }
  ok('ครบ 6 ครั้ง (= จำนวนครั้งของคอร์ส): ปุ่ม "+ เพิ่มวันที่เรียน" หายไป', $('app').querySelectorAll('[data-ad]').length === 6 && !$('app').querySelector('[data-act="add-adddate"]') && \/6\\/6 ครั้ง\/.test($('datesN').textContent));
  aact('add-deldate', '[data-i="5"]'); await settle(60);
  ok('เอาออก: เหลือ 5 ช่อง · ปุ่มเพิ่มกลับมา · ค่าที่กรอกไว้ของช่องอื่นไม่หาย', $('app').querySelectorAll('[data-ad]').length === 5 && !!$('app').querySelector('[data-act="add-adddate"]')
    && $('app').querySelector('[data-ad="0"]').value === day(-10) && $('app').querySelector('[data-ad="3"]').value === day(-13));

  \/\/ ── 3. ส่งสำเร็จ: ลงเรียน (backfill) → ลงรอบ ──
  \/\/ (จัดสถานะให้ชัด: เอาออกทั้งหมดแล้วใส่ 2 วัน)
  // เกินจำนวนครั้งของคอร์ส (ปุ่มเพิ่มหยุดที่ 6 อยู่แล้ว — ดันค่าเข้า state ตรง ๆ เพื่อตรวจด่านตอนส่ง)
  st.add.dates.push(day(-3), day(-4)); render(); await settle(60);
  const nE9 = enrolls().length;
  aact('add-submit'); await settle(100);
  ok('วันที่เรียน 7 ครั้งเกินจำนวนครั้งของคอร์ส (6): ไม่ส่งฐาน · แดงตัวหนา "เกินจำนวนครั้งของคอร์ส (6 ครั้ง)"', enrolls().length === nE9 && isRed($('addErr')) && /เกินจำนวนครั้งของคอร์ส \\(6 ครั้ง\\)/.test(errT()), errT());
  st.add.dates.splice(5, 2); render(); await settle(60);
  while ($('app').querySelector('[data-act="add-deldate"]')) { aact('add-deldate', '[data-i="0"]'); await settle(20); }
  addDate(); addDate(); await settle(60);
  setDate(0, day(-20)); setDate(1, day(-10));
  setStarted(day(-30));
  if (!$('a_paid').checked) tick('a_paid');
  await settle(100);
  const nB0 = backs().length;
  aact('add-submit'); await settle(800);
  const ce = enrolls()[enrolls().length - 1].args, cb = backs()[backs().length - 1];
  ok('ส่ง: teach_enroll_create ครั้งเดียว · ตัวเอง(t3) · source backfill · th · ราคาที่ตกลงว่าง (null) · วันเริ่ม · ชำระครบไม่ทราบวันที่ · ไม่มีราคาตั้งเอง',
    enrolls().length === nE0 + 1 && ce.p_teacher === 't3' && ce.p_source === 'backfill' && ce.p_teach_lang === 'th' && ce.p_price_agreed === null && ce.p_started_on === day(-30)
    && ce.p_paid_unknown === true && ce.p_list_price === null && ce.p_customer === 'c2' && ce.p_course === 'basic-dj-class', J(ce));
  ok('แล้ว teach_session_backfill ครั้งเดียว · ใบที่เพิ่งสร้าง · วันที่ตามที่กรอก · ไม่ระบุครู\/ชั่วโมง (ใช้ตัวเอง\/ค่าตั้งต้น)',
    backs().length === nB0 + 1 && cb.args.p_enrollment === TEACH.created[TEACH.created.length - 1].id && J(cb.args.p_dates) === J([day(-20), day(-10)]) && cb.args.p_teacher === null && cb.args.p_hours === null, J(cb.args));
  ok('ลำดับ: ลงเรียนก่อนแล้วจึงลงรอบ', CALLS.indexOf(enrolls()[enrolls().length - 1]) < CALLS.indexOf(cb));
  ok('สำเร็จ: กลับหน้ารายชื่อ · แถบเขียวบอกลงเรียนย้อนหลัง + ลงรอบ 2 ครั้ง · (ติ๊กชำระแล้ว) ไม่ขึ้นเตือนรอชำระ',
    !$('addStu') && \/ลงเรียนย้อนหลังให้ มานี มีนา\/.test(($('flash') || {}).textContent) && \/ลงรอบที่เรียนไปแล้ว 2 ครั้ง\/.test($('flash').textContent) && !\/ยังไม่ได้ติ๊กชำระครบ\/.test($('flash').textContent), ($('flash') || {}).textContent);
  const made = TEACH.rows.find(r => r.id === TEACH.created[TEACH.created.length - 1].id);
  ok('ผลในฐานปลอม: ใบ source backfill · ครู Maniac · ชำระครบ (paid_unknown) · เริ่มเรียนแล้ว (active) · นับ 2 ครั้ง', !!made && made.source === 'backfill' && made.teacher_id === 't3' && made.paid_unknown === true && made.sessions_used === 2 && made.state === 'active', J(made));

  \/\/ ── 4. ไม่ติ๊กอะไร \/ ไม่ใส่วันที่: ไม่เรียกลงรอบ ──
  await openForm('0899991111');
  tick('a_back'); await settle(100);
  const nE1 = enrolls().length, nB1 = backs().length;
  aact('add-submit'); await settle(700);
  const c2 = enrolls()[enrolls().length - 1].args;
  ok('ย้อนหลังแบบไม่ใส่อะไรเลย: ส่งลงเรียน backfill (ไม่มีวันเริ่ม · ไม่ชำระครบ · ราคาว่าง) · ไม่เรียก teach_session_backfill',
    enrolls().length === nE1 + 1 && backs().length === nB1 && c2.p_source === 'backfill' && c2.p_started_on === null && c2.p_paid_unknown === false && c2.p_price_agreed === null, J(c2));
  ok('แถบเขียวเตือนว่ายังไม่ได้ติ๊กชำระครบ · รอเจ้าของ\/ผู้ดูแลบันทึก', \/ยังไม่ได้ติ๊กชำระครบ\/.test(($('flash') || {}).textContent || '') && !\/ลงรอบที่เรียนไปแล้ว\/.test($('flash').textContent), ($('flash') || {}).textContent);

  \/\/ ── 5. ลงเรียนสำเร็จแต่ลงรอบล้ม → กดซ้ำทำต่อเฉพาะขั้นที่ค้าง (ไม่สร้างใบซ้ำ) ──
  await openForm('0866665555');
  tick('a_back'); await settle(100); tick('a_paid'); await settle(50);
  addDate(); await settle(40); setDate(0, day(-8));
  TEACH.fail.rpc_teach_session_backfill = 'จำนวนครั้งที่เรียนรวมเกินจำนวนครั้งของคอร์ส (6 ครั้ง)';
  const nE2 = enrolls().length, nB2 = backs().length;
  aact('add-submit'); await settle(700);
  ok('ลงรอบล้ม: ลงเรียนไปแล้ว 1 ใบ · ข้อความแดง "ลงเรียนแล้ว แต่ลงรอบย้อนหลังไม่สำเร็จ" + ข้อความไทยของฐาน · ฟอร์มยังอยู่',
    enrolls().length === nE2 + 1 && backs().length === nB2 + 1 && isRed($('addErr')) && \/ลงเรียนแล้ว แต่ลงรอบย้อนหลังไม่สำเร็จ\/.test(errT()) && \/เกินจำนวนครั้งของคอร์ส\/.test(errT()) && !!$('addForm'), errT());
  ok('หลังสร้างใบแล้ว: ล็อกคอร์ส\/สวิตช์\/วันเริ่ม\/ชำระ (กันเปลี่ยนค่าที่ส่งไปแล้ว) · ปุ่มเป็น "ลงรอบย้อนหลังที่ค้างอีกครั้ง"',
    $('a_course').disabled && $('a_back').disabled && $('a_started').disabled && $('a_paid').disabled && \/ลงรอบย้อนหลังที่ค้างอีกครั้ง\/.test($('app').querySelector('[data-act="add-submit"]').textContent));
  TEACH.fail = {};
  aact('add-submit'); await settle(700);
  ok('กดซ้ำ: ไม่สร้างใบซ้ำ (teach_enroll_create ยังเท่าเดิม) · ลงรอบอีก 1 ครั้งเรียกด้วยใบเดิม · สำเร็จ',
    enrolls().length === nE2 + 1 && backs().length === nB2 + 2 && backs()[backs().length - 1].args.p_enrollment === backs()[backs().length - 2].args.p_enrollment && !$('addStu') && \/ลงเรียนย้อนหลังให้\/.test(($('flash') || {}).textContent || ''));

  \/\/ ── 6. ฐานปฏิเสธ (ครูที่เป็นพนักงาน = ใช้กติกาพนักงาน) ──
  await signOut();
  await signIn('nutty');
  await openForm('0877772222');
  tick('a_back'); await settle(80);
  const nE3 = enrolls().length;
  aact('add-submit'); await settle(600);
  ok('ครูที่เป็นพนักงาน: ฐานปฏิเสธ · ข้อความไทยของฐานแสดงตามจริง · ไม่มีใบเกิด · ไม่ลงรอบ · ฟอร์มยังอยู่',
    enrolls().length === nE3 + 1 && \/ลงเรียนไม่สำเร็จ: กรอกย้อนหลังได้เฉพาะเจ้าของ ผู้ดูแล\/.test(errT()) && !TEACH.created.some(x => x.args.p_teacher === 't2' && x.args.p_source === 'backfill') && !!$('addForm') && backs().length === nB2 + 2, errT());
  await signOut();

  \/\/ ── 7. ไม่ดึง\/ไม่วาดของที่ไม่ใช่ของครู ──
  ok('ตลอดการใช้งาน: เขียนผ่านฟังก์ชันเท่านั้น (ลงเรียน\/ลงรอบย้อนหลัง) · ไม่แตะตารางตรง ๆ · ไม่ดึงเงิน\/ลูกค้า\/สมาชิก',
    !CALLS.some(c => c.op === 'insert' || c.op === 'update' || c.op === 'delete' || c.op === 'upsert')
    && [...new Set(CALLS.filter(c => c.op === 'rpc').map(c => c.fn))].every(f => \/^(my_teacher_id|teach_my_students|teach_student_find|teach_enroll_create|teach_session_backfill)$\/.test(f))
    && !CALLS.some(c => \/^(enrollment_money|enrollment_payments|customers|members)$\/.test(c.table || '')));
  ok('ออกจากระบบ: ฟอร์ม\/วันที่\/สวิตช์ ไม่ค้างใน DOM', !!$('loginForm') && !$('addStu') && !$('backForm') && !$('a_back'));
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
async function shot(name) { await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); await sleep(150); await new Promise(r => { window.__shot = r; console.log('[SHOT] ' + name); }); }
<\/script>`;

const T7 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
const FNC = () => CALLS.filter(c => c.op === 'fn' && c.name === 'gcal-sync');
const FNA = a => FNC().filter(c => c.body.action === a);
const aact = (a, extra) => { const b = $('app').querySelector('[data-act="' + a + '"]' + (extra || '')); if (!b) throw new Error('ไม่พบปุ่ม ' + a + (extra || '')); b.click(); };
const sessAt = (d, hm) => TEACH.sessions.find(x => x.starts_at === day(d) + 'T' + hm + ':00+07:00');
const schedRoom = async (d, room, start = '10:00', end = '12:00') => {
  oform('sched'); await settle(100);
  fillf('date', day(d)); fillf('start', start); fillf('end', end); fillf('room', room);
  submitK('sched'); await settle(700);
};
async function runTests() {
  L('=== หน้าครู (7/7): นัดสอนที่เดียว — ลงฐาน + Google Calendar (gcal-sync · 063) ===');
  seedManiac();
  TEACH.sessions.push(Object.assign({}, TEACH.sessions.find(x => x.id === 's-m1'), { id: 's-ext', status: 'scheduled', starts_at: day(30) + 'T10:00:00+07:00', ends_at: day(30) + 'T12:00:00+07:00',
    held_on: null, room: 'ห้องเล็ก1', gcal_uid: 'discord-made@google.com', gcal_start: day(30) + 'T10:00:00+07:00', hours: '2.00' }));
  await sleep(300);
  await signIn('maniac');
  await ostu('e-month');

  // ── 1. ฟอร์ม ──
  oform('sched'); await settle(150);
  const opts = [...($('f_room').options || [])].map(o => o.value);       // ช่องกลายเป็น input = ไม่มี options → ให้ข้อยืนยันข้างล่างตก ไม่ใช่ TypeError ทั้งหน้า
  ok('ช่องห้องเป็นตัวเลือก: ว่าง (ลงฐานอย่างเดียว) + ห้องใหญ่ · ห้องเล็ก1 · ห้องเล็ก2 · ห้องซ้อม', $('f_room').tagName === 'SELECT' && J(opts) === J(['', 'ห้องใหญ่', 'ห้องเล็ก1', 'ห้องเล็ก2', 'ห้องซ้อม']), J(opts));
  ok('ข้อความใต้ฟอร์มบอกว่าห้องชนแล้วไม่สร้างนัด', /ห้องชนนัดอื่น = ไม่สร้างนัด/.test(txt()));
  dact('close-form'); await settle(100);

  // ── 2. สำเร็จ ──
  await schedRoom(20, 'ห้องเล็ก1');
  const made = sessAt(20, '10:00'), ck = FNA('check')[0], up = FNA('upsert')[0];
  ok('ลำดับ: check → teach_session_schedule → upsert · check ส่งแค่ action/ห้อง/เวลา (+07:00) · upsert ส่งแค่ action + session_id',
    !!made && !!ck && !!up && J(Object.keys(ck.body).sort()) === J(['action', 'ends', 'room', 'starts']) && ck.body.starts === day(20) + 'T10:00:00+07:00'
    && J(Object.keys(up.body).sort()) === J(['action', 'session_id']) && up.body.session_id === made.id
    && CALLS.indexOf(ck) < CALLS.findIndex(c => c.op === 'rpc' && c.fn === 'teach_session_schedule' && c.args.p_starts === day(20) + 'T10:00:00+07:00') && CALLS.indexOf(up) > CALLS.indexOf(ck), J([ck && ck.body, up && up.body]));
  ok('ข้อความเขียว "นัดรอบเรียนแล้ว ✓ · ลงปฏิทินแล้ว ✓" · รอบขึ้น "ผูกกับนัดในปฏิทินแล้ว ✓" · ไม่มีปุ่ม "ลงปฏิทิน"', /นัดรอบเรียนแล้ว ✓ · ลงปฏิทินแล้ว ✓/.test(okText()) && !!sc(made.id).querySelector('[data-cal="linked"]') && !has('cal-sync', '[data-sid="' + made.id + '"]'), okText());

  // ── 3. ห้องชน ──
  TEACH.cal.busy.push({ room: 'ห้องเล็ก2', start: day(21) + 'T09:30:00+07:00', end: day(21) + 'T11:30:00+07:00' });
  const nS = rpcCalls('teach_session_schedule').length, nSess = TEACH.sessions.length;
  await schedRoom(21, 'ห้องเล็ก2');
  ok('ห้องชนนัดในปฏิทิน: แถบแดงตัวหนา "ไม่ว่าง" · ไม่สร้างนัดในฐาน · ไม่เรียก upsert เพิ่ม · ฟอร์มยังเปิด',
    isRed($('detErr')) && /ไม่ว่าง/.test(errTxt()) && rpcCalls('teach_session_schedule').length === nS && TEACH.sessions.length === nSess && FNA('upsert').length === 1 && !!$('formSched'), errTxt());
  dact('close-form'); await settle(100);

  // ── 4. ไม่ระบุห้อง ──
  const nF = FNC().length;
  await schedRoom(22, '');
  ok('ไม่ระบุห้อง: ไม่เรียก gcal-sync เลย · นัดฐานสำเร็จ', FNC().length === nF && /นัดรอบเรียนแล้ว ✓/.test(okText()) && !/ลงปฏิทิน/.test(okText()), okText());

  // ── 5. ยังไม่ตั้งค่า / ติดต่อไม่ได้ → ลงฐานอย่างเดียว ──
  TEACH.cal.mode = 'not_configured';
  const nUp = FNA('upsert').length;
  await schedRoom(23, 'ห้องใหญ่');
  const nc = sessAt(23, '10:00');
  ok('ยังไม่ตั้งค่าปฏิทิน: นัดฐานสำเร็จ · ไม่เรียก upsert · แถบแดงตัวหนา "ยังไม่ได้ลงปฏิทิน — ระบบปฏิทินยังไม่พร้อม" · มีปุ่ม "ลงปฏิทิน"',
    !!nc && FNA('upsert').length === nUp && isRed($('detWarn').querySelector('.wk-red')) && /ยังไม่ได้ลงปฏิทิน — ระบบปฏิทินยังไม่พร้อม/.test(warnTxt()) && has('cal-sync', '[data-sid="' + nc.id + '"]'), warnTxt());
  TEACH.cal.mode = 'throw';
  await schedRoom(24, 'ห้องใหญ่');
  ok('ติดต่อฟังก์ชันไม่ได้: ลงฐานอย่างเดียว + แถบแดง · ไม่หลุด error ดิบ', !!sessAt(24, '10:00') && /ยังไม่ได้ลงปฏิทิน/.test(warnTxt()) && !/boom/.test(txt()), warnTxt());
  TEACH.cal.mode = 'ok';

  // ── 6. ลงปฏิทินล้มหลังสร้างนัด ──
  TEACH.cal.failUpsert = 'google_busy';
  await schedRoom(25, 'ห้องเล็ก1');
  const fl = sessAt(25, '10:00');
  ok('ลงปฏิทินล้ม: นัดอยู่ในฐาน · แถบแดงตัวหนา "นัดบันทึกแล้ว แต่ลงปฏิทินไม่สำเร็จ" + เหตุผลไทย + ปุ่ม "ลงปฏิทิน"',
    !!fl && isRed($('detWarn').querySelector('.wk-red')) && /นัดบันทึกแล้ว แต่ลงปฏิทินไม่สำเร็จ/.test(warnTxt()) && /ขัดข้องชั่วคราว/.test(warnTxt()) && has('cal-sync', '[data-sid="' + fl.id + '"]'), warnTxt());
  const evN = TEACH.cal.events.length;
  dact('cal-sync', '[data-sid="' + fl.id + '"]'); await settle(600);
  ok('กดลองตอนยังล้ม: แถบแดงบอกเหตุผล (ไม่เงียบ) · ไม่มี event เพิ่ม', isRed($('detErr')) && /ขัดข้องชั่วคราว/.test(errTxt()) && TEACH.cal.events.length === evN, errTxt());
  TEACH.cal.failUpsert = null;
  dact('cal-sync', '[data-sid="' + fl.id + '"]'); await settle(600);
  ok('Google กลับมา กดลองอีกครั้ง: สำเร็จ · ผูกแล้ว · ปุ่มหาย · event เพิ่มเดียว', /ลงปฏิทินแล้ว ✓/.test(okText()) && !!sc(fl.id).querySelector('[data-cal="linked"]') && !has('cal-sync', '[data-sid="' + fl.id + '"]') && TEACH.cal.events.length === evN + 1, okText());

  // ── 7. ยกเลิกรอบ → ลบ event ตาม ──
  oform('cancel', fl.id); await settle(100);
  fillf('by', 'teacher');
  submitK('cancel'); await settle(700);
  const rm = FNA('remove').slice(-1)[0];
  ok('ยกเลิกรอบที่ลงปฏิทินแล้ว: remove ส่งแค่ action + session_id · "ลบนัดในปฏิทินแล้ว ✓" · event หาย · ลิงก์ถูกถอด',
    !!rm && J(Object.keys(rm.body).sort()) === J(['action', 'session_id']) && rm.body.session_id === fl.id && /ลบนัดในปฏิทินแล้ว ✓/.test(okText())
    && !TEACH.cal.events.some(e => e.session === fl.id) && TEACH.sessions.find(x => x.id === fl.id).gcal_uid === null, okText());

  // ── 8. ผูกกับนัดจาก Discord → ไม่ลบ ──
  oform('cancel', 's-ext'); await settle(100);
  fillf('by', 'teacher');
  submitK('cancel'); await settle(700);
  ok('นัดที่ลงจาก Discord: ยกเลิกรอบแล้วแต่ไม่ลบ · แถบแดงตัวหนา "ลบเองในปฏิทิน" · รอบขึ้น "นัดนี้ยังค้างในปฏิทิน" + ปุ่ม "ลบนัดในปฏิทิน"',
    isRed(($('detWarn') || document.createElement('i')).querySelector('.wk-red')) && /ลบเองในปฏิทิน/.test(warnTxt()) && TEACH.sessions.find(x => x.id === 's-ext').gcal_uid === 'discord-made@google.com'
    && isRed(sc('s-ext').querySelector('[data-cal="stale"]')) && has('cal-remove', '[data-sid="s-ext"]'), warnTxt());

  // ── 9. ลบ event ล้ม → แดง + ลองอีกครั้ง ──
  await schedRoom(26, 'ห้องเล็ก2');
  const rs = sessAt(26, '10:00');
  TEACH.cal.failRemove = 'google_busy';
  oform('cancel', rs.id); await settle(100);
  fillf('by', 'shop');
  submitK('cancel'); await settle(700);
  ok('ลบ event ล้ม: ยกเลิกรอบแล้ว · แถบแดงตัวหนา "ลบนัดในปฏิทินไม่สำเร็จ" + ปุ่ม "ลบนัดในปฏิทิน" · ลิงก์ยังอยู่',
    TEACH.sessions.find(x => x.id === rs.id).status === 'cancelled' && /ยกเลิกรอบแล้ว แต่ลบนัดในปฏิทินไม่สำเร็จ/.test(warnTxt()) && isRed($('detWarn').querySelector('.wk-red'))
    && has('cal-remove', '[data-sid="' + rs.id + '"]') && !!TEACH.sessions.find(x => x.id === rs.id).gcal_uid, warnTxt());
  TEACH.cal.failRemove = null;
  dact('cal-remove', '[data-sid="' + rs.id + '"]'); await settle(600);
  ok('ลองอีกครั้ง: ลบสำเร็จ · ปุ่มหาย · ลิงก์ถูกถอด', /ลบนัดในปฏิทินแล้ว ✓/.test(okText()) && !has('cal-remove', '[data-sid="' + rs.id + '"]') && TEACH.sessions.find(x => x.id === rs.id).gcal_uid === null, okText());

  // ── 10. ชนตอน upsert (แข่งกัน) ──
  TEACH.cal.raceConflict = true;
  await schedRoom(27, 'ห้องใหญ่');
  const rc = sessAt(27, '10:00');
  ok('ห้องชนตอนลงปฏิทิน: นัดอยู่ในฐาน · แถบแดงตัวหนา "ลงปฏิทินไม่สำเร็จ" บอก "ไม่ว่าง" · ปุ่มลองใหม่ · ยกเลิกรอบได้ตามปกติ',
    !!rc && /นัดบันทึกแล้ว แต่ลงปฏิทินไม่สำเร็จ/.test(warnTxt()) && /ไม่ว่าง/.test(warnTxt()) && has('cal-sync', '[data-sid="' + rc.id + '"]'), warnTxt());
  TEACH.cal.raceConflict = false;
  const nRm = FNA('remove').length;
  oform('cancel', rc.id); await settle(100);
  fillf('by', 'shop');
  submitK('cancel'); await settle(700);
  ok('ยกเลิกรอบที่ลงปฏิทินไม่ได้: สำเร็จ · ไม่เรียก remove (ไม่มีลิงก์)', TEACH.sessions.find(x => x.id === rc.id).status === 'cancelled' && FNA('remove').length === nRm, okText());

  // ── 11. ไม่ส่งข้อมูลนักเรียนไปปฏิทิน ──
  ok('คำขอทุกครั้งไป gcal-sync ไม่มีชื่อนักเรียน/เบอร์/ราคา · มีแค่ check/upsert/remove', FNC().every(c => ['check', 'upsert', 'remove'].includes(c.body.action)) && !/วีระ|0812345678|price|amount/.test(J(FNC().map(c => c.body))));
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

const mock = MOCK3 + '\n' + TEACH_MOCK;
let allOk = true;
for (const [label, tests, opts] of [
  ['1 เข้าสู่ระบบ · ขอบเขตข้อมูล · ข้อมูลติดต่อ', T1, { width: 1100, height: 900, coarse: false }],
  ['2 ทำงาน: สอนแล้ว · ยกเลิก · บันทึก · นัด · ขอขยาย', T2, { width: 1100, height: 900, coarse: false }],
  ['3 ตารางสอน · realtime · สลับบัญชี · XSS', T3, { width: 1100, height: 900, coarse: false }],
  ['4 iPhone 390×844', T4, { width: 390, height: 844, coarse: true }],
  ['5 เพิ่มนักเรียนเอง · ผูกนัดปฏิทิน (060)', T5, { width: 1100, height: 900, coarse: false }],
  ['6 เพิ่มนักเรียนย้อนหลัง (062)', T6, { width: 1100, height: 900, coarse: false }],
  ['7 นัดสอนที่เดียว: ลงฐาน + Google Calendar (063)', T7, { width: 1100, height: 900, coarse: false }],
]) {
  if (ONLY && !ONLY.test(label)) continue;
  console.log('\n--- ' + label + ' ---');
  const res = await runCdpPage({ root: pageRoot, file: 'teacher.html', mock, tests, hash: '', shotDir: SHOTS, ...opts });
  if (!res.ok) allOk = false;
}
console.log('\n=== teacher: ' + (allOk ? 'ผ่าน' : 'ไม่ผ่านหรือไม่ได้รันจนจบ') + ' ===');
process.exit(allOk ? 0 : 1);
