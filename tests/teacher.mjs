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
  ok('นักเรียนผู้ใหญ่: เห็น LINE · Instagram · เบอร์โทรเห็นแค่ 4 ตัวท้าย', /wee[.]line/.test(ct) && /wee_ig/.test(ct) && /•••-•••-5678/.test(ct), ct);
  ok('เบอร์เต็ม/เลขเต็มไม่อยู่ใน DOM เลย (ทั้งข้อความและ HTML)', !/0812345678|081-234-5678|081 234 5678|812345678/.test(html()) && !/[0-9]{9,}/.test(html().replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, '')), '');
  ok('ไม่มีอีเมล/ที่อยู่/หมายเหตุพนักงาน ในหน้า', !/@|ที่อยู่/.test(txt().replace(/[0-9a-z_.]+@x/gi, '')) );
  dact('back'); await settle(100);
  await ostu('e-m2');
  const ct2 = $('contact').textContent;
  ok('ผู้เยาว์: เห็นผู้ปกครอง + ช่องทางของผู้ปกครอง · ไม่เห็น LINE/IG/เบอร์ของตัวเด็ก', /คุณแม่ของดาว/.test(ct2) && /LINE/.test(ct2) && /mom-dao-line/.test(ct2) && /ติดต่อผ่านผู้ปกครอง/.test(ct2)
    && !/child-line-must-not-show|child_ig_must_not_show/.test(html()) && !/•••/.test(ct2), ct2);
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
  oform('sched'); fillf('date', day(1)); fillf('start', '09:00'); fillf('end', '11:00'); fillf('room', 'ห้องเล็ก');
  submitK('sched'); await settle(700);
  const near = TEACH.sessions.find(x => x.starts_at === day(1) + 'T09:00:00+07:00');
  const as = lastArgs('teach_session_schedule');
  ok('นัดรอบ: ส่งครูเป็นตัวเอง (t3) · เวลาไทย +07:00 · ห้อง · ชั่วโมงว่าง (ฐานคิดตามคอร์ส)', as.p_teacher === 't3' && as.p_starts === day(1) + 'T09:00:00+07:00' && as.p_ends === day(1) + 'T11:00:00+07:00' && as.p_room === 'ห้องเล็ก' && as.p_hours === null && as.p_enrollment === 'e-month' && !!near, J(as));
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

const mock = MOCK3 + '\n' + TEACH_MOCK;
let allOk = true;
for (const [label, tests, opts] of [
  ['1 เข้าสู่ระบบ · ขอบเขตข้อมูล · ข้อมูลติดต่อ', T1, { width: 1100, height: 900, coarse: false }],
  ['2 ทำงาน: สอนแล้ว · ยกเลิก · บันทึก · นัด · ขอขยาย', T2, { width: 1100, height: 900, coarse: false }],
  ['3 ตารางสอน · realtime · สลับบัญชี · XSS', T3, { width: 1100, height: 900, coarse: false }],
  ['4 iPhone 390×844', T4, { width: 390, height: 844, coarse: true }],
]) {
  if (ONLY && !ONLY.test(label)) continue;
  console.log('\n--- ' + label + ' ---');
  const res = await runCdpPage({ root: pageRoot, file: 'teacher.html', mock, tests, hash: '', shotDir: SHOTS, ...opts });
  if (!res.ok) allOk = false;
}
console.log('\n=== teacher: ' + (allOk ? 'ผ่าน' : 'ไม่ผ่านหรือไม่ได้รันจนจบ') + ' ===');
process.exit(allOk ? 0 : 1);
