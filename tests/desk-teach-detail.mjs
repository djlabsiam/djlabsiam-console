/**
 * เทสต์หมวด "คอร์สเรียน" ก้อน C ของ desk.html (#teach · migration 047): แผงรายละเอียดการลงเรียน + แท็บ "รอบเรียน"
 *   รัน: node tests/desk-teach-detail.mjs            (ทั้ง 7 หน้า) · รันทีละหน้า: TEACH_ONLY=<regex ชื่อหน้า>
 *   ถ่ายภาพ: TEACH_SHOTS=<โฟลเดอร์> node tests/desk-teach-detail.mjs
 *
 * ฐานปลอม tests/lib/teach-mock.mjs (ก้อน C) จำลองสิทธิ์อ่าน (RLS) + ฟังก์ชัน teach_* ตามกติกา 047 · ตัวจริงตรวจที่ console-workspace/sql-tests/test047.mjs
 * ที่นี่ตรวจฝั่งหน้าจอ: ใครเห็น/ไม่เห็นอะไร (ตรวจ DOM + ตรวจว่าไม่ดึงข้อมูลที่สิทธิ์ไม่ถึง) · ฟอร์มส่งอะไรให้ฟังก์ชัน ·
 *   ปุ่มล็อกระหว่างส่ง · request_id ใช้ซ้ำ · คำเตือนแดงตัวหนา · ข้อความผิดพลาดไม่มียอด · XSS · ล้างตอนออกจากระบบ · ผลโหลดช้าถูกทิ้ง
 *
 *  1. เจ้าของ: แผง · ยอดเงิน · บันทึกชำระ · คืนเงิน · แก้/ลบรายการชำระ
 *  2. เจ้าของ: นัดรอบ (+คำเตือน) · สอนแล้ว · ยกเลิก/ไม่มา (แจ้งช้า) · บันทึกการสอน · ผูก/ถอดนัดปฏิทิน
 *  3. เจ้าของ: แก้การลงเรียน · ปิด/เปิดกลับ · ขยายอายุ (ขยายเอง/อนุมัติ/ปฏิเสธ)
 *  4. พนักงานที่ไม่ใช่ครู (Zen): ไม่เห็นเงิน/บันทึก/ขยายอายุ · ทำอะไรได้บ้าง
 *  5. พนักงานที่เป็นครู (Nutty) · ผู้ดูแล (Nui)
 *  6. แท็บรอบเรียน · Realtime · โหลดล้ม · ออกจากระบบ · สลับบัญชีกลางโหลด · XSS
 *  7. iPhone (390px)
 */

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { HARNESS } from './lib/page-test.mjs';
import { runCdpPage } from './lib/cdp-page.mjs';
import { TEACH_MOCK } from './lib/teach-mock.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { MOCK: MOCK3 } = await import(pathToFileURL(join(root, 'tests/desk-home3.mjs')).href);
const SHOTS = process.env.TEACH_SHOTS || null;
const ONLY = process.env.TEACH_ONLY ? new RegExp(process.env.TEACH_ONLY) : null;
const pageRoot = process.env.TEACH_ROOT || root;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const COMMON = `
${HARNESS}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);
const E = $;
const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
async function login(name) { $('loginEmail').value = name + '@x'; $('loginPassword').value = 'x'; await doLogin(); await sleep(500); }
async function logout() { await db.auth.signOut(); await sleep(400); }
async function shot(name) { await frames(); await sleep(150); await new Promise(r => { window.__shot = r; console.log('[SHOT] ' + name); }); }
const isRed = el => !!el && getComputedStyle(el).color === 'rgb(204, 0, 26)' && Number(getComputedStyle(el).fontWeight) >= 600;      // --red #CC001A ตัวหนา
const day = n => { const x = new Date(TODAY + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const body = () => $('teBody');
const tab = n => { document.querySelector('#teTabs .mail-tab[data-tab="' + n + '"]').click(); };
const row = id => body().querySelector('.te-row[data-id="' + id + '"]');
const settle = ms => sleep(ms || 300);
async function open() { showSection('teach'); await sleep(500); }
const D = () => $('teDet');
const dt = () => D() ? D().textContent : '';
const dact = (a, extra) => { const b = D().querySelector('[data-act="' + a + '"]' + (extra || '')); if (!b) throw new Error('ไม่พบปุ่ม ' + a + (extra || '')); b.click(); };
const has = (a, extra) => !!D() && !!D().querySelector('[data-act="' + a + '"]' + (extra || ''));
const dfill = (name, v) => { const e = $('teD_' + name); if (!e) throw new Error('ไม่พบช่อง ' + name); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
const submit = k => dact('submit', '[data-k="' + k + '"]');
const openForm = (k, sid) => dact('open', '[data-k="' + k + '"]' + (sid ? '[data-sid="' + sid + '"]' : ''));
const rpcCalls = fn => CALLS.filter(c => c.op === 'rpc' && c.fn === fn);
const lastArgs = fn => { const l = rpcCalls(fn); return l.length ? l[l.length - 1].args : null; };
const ss = id => D().querySelector('.te-ss[data-sid="' + id + '"]');
const ssIds = () => [...D().querySelectorAll('.te-ss')].map(e => e.dataset.sid);
const detOk = () => (E('teDetOk') || {}).textContent || '';
const detErr = () => (E('teDetErr') || {}).textContent || '';
const detWarn = () => (E('teDetWarn') || {}).textContent || '';
async function openEnroll(tabName, id) { tab(tabName); await sleep(150); row(id).click(); await settle(500); }
const sessByStart = (d, hm) => TEACH.sessions.find(x => x.starts_at === day(d) + 'T' + hm + ':00+07:00');
const J = o => JSON.stringify(o);
const confirmOpen = () => $('confirmDialog').open;
const confirmOk = async () => { $('confirmOkBtn').click(); await settle(500); };
`;

// ── 1. เจ้าของ: แผง · เงิน · ชำระ · คืนเงิน · แก้/ลบรายการชำระ ──
const T1 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== คอร์สเรียน ก้อน C (1/7): เจ้าของ — แผงรายละเอียด · เงิน · ชำระ · คืนเงิน ===');
  TEACH.seed();
  await login('TiBass');
  await open();
  tab('active'); await sleep(150);
  ok('ก่อนคลิกแถว: ไม่มีแผงรายละเอียดของคอร์สเรียน', $('detail').hidden === true && !D());
  row('e-active').click(); await settle(600);
  ok('คลิกแถว: แผงขวาเปิด · หัวแผง = ชื่อนักเรียน', $('detail').hidden === false && !!D() && $('detailTitle').textContent === 'สมชาย ใจดี', $('detailTitle').textContent);
  ok('สรุป: คอร์ส · ครู · เรียนแล้ว 3/6 · แนวที่เลือก/สถานะ', /Basic DJ Class/.test(dt()) && /Tibass/.test(dt()) && /3\\/6/.test(dt()) && /กำลังเรียน/.test(dt()), dt().slice(0, 200));
  ok('รอบเรียนของนักเรียนคนนี้ 4 รอบ: เรียงตามวัน (สอนแล้ว 3 + นัดไว้ 1)', ssIds().join() === 's-d1,s-d2,s-d3,s1', ssIds().join());
  ok('รอบที่นัดไว้บอกห้อง + ผูกปฏิทินแล้ว ✓', /ห้องใหญ่/.test(ss('s1').textContent) && /ผูกปฏิทินแล้ว ✓/.test(ss('s1').textContent));
  ok('เจ้าของเห็นราคาที่ตกลง 20,000 · ชำระสะสม 20,000 · คงเหลือ 0 + รายการชำระ 1 แถว', /ราคาที่ตกลง20,000฿/.test(E("teMoney").textContent.replace(/\\s/g, '')) && /ชำระสะสม/.test(dt()) && /คงเหลือ 0/.test(dt())
    && D().querySelectorAll('.te-prow[data-pid]').length === 1, E('teMoney') && E('teMoney').textContent);
  const selects = CALLS.filter(c => c.op === 'select');
  ok('ดึงเฉพาะตารางของการลงเรียนนี้ (eq enrollment_id) · ไม่ดึงคอลัมน์ slip_path', selects.some(c => c.table === 'enrollment_payments' && c.eq.some(e => e[0] === 'enrollment_id' && e[1] === 'e-active'))
    && !selects.some(c => /slip_path/.test(c.cols || '')) && !CALLS.some(c => /course-slips|storage/.test(J(c))));
  ok('ข้อความ "แนบสลิป: ยังไม่เปิดใช้" ขึ้นเสมอ · ไม่มีช่องเลือกไฟล์', /แนบสลิป: ยังไม่เปิดใช้/.test(dt()) && !D().querySelector('input[type="file"]'));
  await shot('c1-detail-owner');
  ok('ส่วนการชำระ (เจ้าของ): มีปุ่ม "ปรับราคาที่ตกลง (ส่วนลด)" + คำอธิบายให้ปรับก่อนบันทึกชำระ', !!D().querySelector('#teDetPay [data-act="open"][data-k="fix"]') && !!E('tePriceAdjustHint') && /ก่อนบันทึกชำระ/.test(E('tePriceAdjustHint').textContent));
  D().querySelector('#teDetPay [data-act="open"][data-k="fix"]').click(); await settle(150);
  ok('กดแล้วเปิดฟอร์มแก้ข้อมูลการลงเรียนที่มีช่อง "ราคาที่ตกลง" (ส่ง price_agreed ผ่าน teach_enroll_fix)', !!E('teFormFix') && !!E('teD_price'));
  dact('close-form'); await settle(100);

  // ── บันทึกชำระ ──
  openForm('pay'); await settle(100);
  ok('ฟอร์มชำระ: ข้อความแดงตัวหนาก่อนกด (ผู้ที่เห็นยอด: แก้/ลบเองไม่ได้ทันที)', isRed(E('teDetPayWarn')) && /แก้[/]ลบเองไม่ได้ทันที/.test(E('teDetPayWarn').textContent), E('teDetPayWarn') && E('teDetPayWarn').textContent);
  ok('วันที่ตั้งต้น = วันนี้ · วิธีตั้งต้น = โอน', $('teD_date').value === day(0) && $('teD_method').value === 'transfer');
  const np = rpcCalls('teach_payment_record').length;
  submit('pay'); await settle(100);
  ok('ไม่ใส่ยอด: ไม่ส่งฐาน · ข้อความแดง', /ใส่ยอดชำระ/.test(detErr()) && rpcCalls('teach_payment_record').length === np);
  dfill('amount', '2500.50'); dfill('method', 'cash'); dfill('note', 'ค่ามัดจำเพิ่ม');
  TEACH.fail.rpc_teach_payment_record = 'วิธีชำระไม่ถูกต้อง';
  submit('pay'); await settle(300);
  const req1 = lastArgs('teach_payment_record').p_request_id;
  ok('ฐานปฏิเสธ: ข้อความแดงตัวหนา · ไม่มียอดเงินในข้อความ · ฟอร์มยังเปิดค้างพร้อมค่าที่กรอก', /ไม่สำเร็จ/.test(detErr()) && !/2500|2,500/.test(detErr()) && !!E('teFormPay') && $('teD_amount').value === '2500.50', detErr());
  ok('ส่ง request_id (uuid) + ไม่มีสลิป', /^[0-9a-f-]{36}$/.test(req1) && lastArgs('teach_payment_record').p_slip_path === null && lastArgs('teach_payment_record').p_amount === 2500.5);
  TEACH.fail = {};
  let release; TEACH.gateRpc = new Promise(r => { release = r; });
  submit('pay'); await sleep(80);
  const sb = D().querySelector('[data-act="submit"][data-k="pay"]');
  ok('ระหว่างส่ง: ปุ่มล็อก + "กำลังบันทึก…" · ปุ่มอื่นในแผงล็อกด้วย', sb.disabled === true && /กำลังบันทึก/.test(sb.textContent) && [...D().querySelectorAll('button[data-act]')].every(b => b.disabled), sb.textContent);
  sb.click(); sb.click(); await sleep(50);
  TEACH.gateRpc = null; release(); await settle(700);
  const pcs = rpcCalls('teach_payment_record');
  ok('กดซ้ำระหว่างส่ง + ลองใหม่หลังล้ม: request_id เดิมทุกครั้ง · เพิ่มแถวเดียวในฐาน', pcs.length === 2 && pcs[1].args.p_request_id === req1 && TEACH.pay.filter(p => p.request_id === req1).length === 1, pcs.length + '');
  ok('สำเร็จ: ข้อความเขียว (ไม่มียอด) · ฟอร์มปิด · รายการ 2 แถว · ยอดสะสม 22,500.5', /บันทึกการชำระแล้ว/.test(detOk()) && !/2500|2,500/.test(detOk()) && !E('teFormPay') && D().querySelectorAll('.te-prow[data-pid]').length === 2
    && /22,500[.]5/.test(E('teMoney').textContent), E('teMoney').textContent);
  ok('รายการหลักโหลดใหม่เอง: ป้าย "บันทึก 2 งวด" ที่แถวนักเรียน', /บันทึก 2 งวด/.test(row('e-active').textContent), row('e-active').textContent.slice(0, 160));

  // ── คืนเงิน ──
  openForm('refund'); await settle(100);
  ok('ฟอร์มคืนเงิน: ข้อความแดงตัวหนา ย้อนกลับไม่ได้', isRed(E('teFormRefund').querySelector('.wk-red')) && /ย้อนกลับไม่ได้/.test(E('teFormRefund').textContent));
  dfill('amount', '99999');
  const nr0 = rpcCalls('teach_payment_refund').length;
  submit('refund'); await settle(100);
  ok('คืนเกินยอดสะสม: ไม่ส่งฐาน · ข้อความแดง', /ยอดคืนเกินยอดที่ชำระสะสม/.test(detErr()) && rpcCalls('teach_payment_refund').length === nr0);
  dfill('amount', '500'); dfill('note', 'คืนบางส่วน');
  submit('refund'); await settle(600);
  ok('คืนเงิน 500: ส่งยอดเป็นบวก + request_id · แถวคืนเงินขึ้น "คืนเงิน −500" แดง', lastArgs('teach_payment_refund').p_amount === 500 && /^[0-9a-f-]{36}$/.test(lastArgs('teach_payment_refund').p_request_id)
    && [...D().querySelectorAll('.te-prow strong.wk-red')].some(e => /คืนเงิน −500/.test(e.textContent)), dt().slice(0, 300));
  ok('ยอดสะสมสุทธิ 22,000.5', /22,000[.]5/.test(E('teMoney').textContent), E('teMoney').textContent);

  // ── แก้ / ลบรายการชำระ (เจ้าของ/ผู้ดูแล) ──
  dact('open', '[data-k="payfix"][data-sid="p1"]'); await settle(100);
  ok('ฟอร์มแก้: ค่าเดิมถูกใส่ไว้ · คำเตือนแดงตัวหนา', $('teD_amount').value === '20000' && $('teD_method').value === 'transfer' && isRed(E('teFormPayFix').querySelector('.wk-red')));
  dfill('amount', '18000');
  submit('payfix'); await settle(600);
  ok('แก้ยอด 20000 → 18000: ส่ง p_payment + ค่าใหม่ · ยอดสะสมเปลี่ยนเป็น 20,000.5', lastArgs('teach_payment_fix').p_payment === 'p1' && lastArgs('teach_payment_fix').p_amount === 18000 && lastArgs('teach_payment_fix').p_delete === false
    && /20,000[.]5/.test(E('teMoney').textContent), E('teMoney').textContent);
  dact('open', '[data-k="payfix"][data-sid="p1"]'); await settle(100);
  dact('delpay', '[data-sid="p1"]'); await settle(200);
  ok('ลบรายการ: ต้องยืนยันก่อน (หน้าต่างยืนยัน · คำเตือนแดงตัวหนา) · ยังไม่ส่งฐาน', confirmOpen() && isRed($('confirmBody').querySelector('.wk-red')) && lastArgs('teach_payment_fix').p_delete === false);
  await confirmOk();
  ok('ยืนยันแล้ว: ส่ง p_delete true · แถวหาย · ยอดสะสม 2,000.5', lastArgs('teach_payment_fix').p_delete === true && !D().querySelector('.te-prow[data-pid="p1"]') && /2,000[.]5/.test(E('teMoney').textContent), E('teMoney').textContent);
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

// ── 2. เจ้าของ: รอบเรียน ──
const T2 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== คอร์สเรียน ก้อน C (2/7): เจ้าของ — นัดรอบ · สอนแล้ว · ยกเลิก/ไม่มา · บันทึกการสอน · ผูกปฏิทิน ===');
  TEACH.seed();
  await login('TiBass');
  await open();
  await openEnroll('active', 'e-active');
  await sleep(300);

  // ── นัดรอบ ──
  openForm('sched'); await settle(300);
  ok('ฟอร์มนัด: ครูตั้งต้น = ครูรับผิดชอบ · ตัวเลือกครู = ครูที่เปิดสอนคอร์สนี้ (ไม่มีครูที่ปิดใช้งาน)', $('teD_teacher').value === 't1'
    && [...$('teD_teacher').options].map(o => o.textContent).sort().join() === 'Alldayz,Leonie,Maniac,Nutty,Tibass', [...$('teD_teacher').options].map(o => o.textContent).join());
  const ns0 = rpcCalls('teach_session_schedule').length;
  submit('sched'); await settle(100);
  ok('ไม่กรอกวัน/เวลา: ไม่ส่งฐาน · ข้อความแดง', /ใส่วันที่ เวลาเริ่ม และเวลาจบ/.test(detErr()) && rpcCalls('teach_session_schedule').length === ns0);
  dfill('date', day(9)); dfill('start', '12:00'); dfill('end', '10:00');
  submit('sched'); await settle(100);
  ok('เวลาจบก่อนเริ่ม: ไม่ส่งฐาน', /เวลาจบต้องหลังเวลาเริ่ม/.test(detErr()) && rpcCalls('teach_session_schedule').length === ns0);
  dfill('start', '10:00'); dfill('end', '12:00'); dfill('room', 'ห้องใหญ่');
  submit('sched'); await settle(600);
  const a1 = lastArgs('teach_session_schedule');
  ok('นัดสำเร็จ: ส่งเวลาไทย (+07:00) · ครู · ห้อง · ชั่วโมงว่าง (ฐานคิดตามคอร์ส)', a1.p_starts === day(9) + 'T10:00:00+07:00' && a1.p_ends === day(9) + 'T12:00:00+07:00' && a1.p_teacher === 't1' && a1.p_room === 'ห้องใหญ่' && a1.p_hours === null && a1.p_enrollment === 'e-active', J(a1));
  ok('มี 5 รอบ · ไม่มีคำเตือน · ฟอร์มปิด · ข้อความเขียว', ssIds().length === 5 && !E('teDetWarn') && !E('teFormSched') && /นัดรอบเรียนแล้ว/.test(detOk()), ssIds().join());
  openForm('sched'); await settle(100);
  dfill('date', day(9)); dfill('start', '11:00'); dfill('end', '13:00');
  submit('sched'); await settle(500);
  ok('ครูมีนัดซ้อนกัน: ฐานปฏิเสธ · ข้อความแดงตัวหนา · ไม่เพิ่มรอบ', /ซ้อนกัน/.test(detErr()) && isRed(E('teDetErr')) && ssIds().length === 5);
  dfill('date', day(10)); dfill('start', '10:00'); dfill('end', '12:00');
  submit('sched'); await settle(500);
  ok('นัดที่ 2 (รวมใช้สิทธิ์+นัดไว้ 5 จาก 6): ไม่มีคำเตือน', ssIds().length === 6 && !E('teDetWarn'));
  openForm('sched'); dfill('date', day(11)); dfill('start', '10:00'); dfill('end', '12:00');
  submit('sched'); await settle(500);
  ok('นัดที่ 3 (ครบจำนวนครั้ง): บันทึกให้ + คำเตือนแดงตัวหนา "เกินจำนวนครั้ง" (ไม่บล็อก)', ssIds().length === 7 && isRed(E('teDetWarn').querySelector('.wk-red')) && /เกินจำนวนครั้งของคอร์ส/.test(detWarn()), detWarn());
  openForm('sched'); dfill('date', day(55)); dfill('start', '10:00'); dfill('end', '12:00');
  submit('sched'); await settle(500);
  ok('นัดหลังวันหมดอายุ: คำเตือนแดงตัวหนา "หลังวันหมดอายุ" ด้วย (ไม่บล็อก)', ssIds().length === 8 && /หลังวันหมดอายุ/.test(detWarn()) && /เกินจำนวนครั้ง/.test(detWarn()), detWarn());
  const room = '<img src=x onerror="window.__xss=4">';
  openForm('sched'); dfill('date', day(12)); dfill('start', '10:00'); dfill('end', '12:00');
  submit('sched'); await settle(500);
  TEACH.sessions.filter(x => x.status === 'scheduled').slice(-1)[0].room = room;      // ห้องในฐานเป็นข้อความอิสระ (ข้อมูลเก่า/ลงตรง ๆ) — ต้องแสดงเป็นข้อความ
  TEACH.fireRt('class_sessions'); await settle(700);
  ok('ชื่อห้องที่เป็น HTML แสดงเป็นข้อความ (XSS)', !D().querySelector('img') && /<img src=x/.test(dt()) && !window.__xss);

  // ── ทำเครื่องหมายสอนแล้ว ──
  ok('รอบที่นัดไว้ที่ยังไม่ถึง: มีปุ่ม "ทำเครื่องหมายสอนแล้ว" (เจ้าของ)', has('open', '[data-k="done"][data-sid="s1"]'));
  openForm('done', 's1'); await settle(100);
  ok('วันที่ตั้งต้น = วันนี้ (ไม่เกินวันนี้ แม้นัดไว้ล่วงหน้า)', $('teD_date').value === day(0), $('teD_date').value);
  dfill('date', day(1));
  const nd0 = rpcCalls('teach_session_done').length;
  submit('done'); await settle(100);
  ok('วันที่เกินวันนี้: ไม่ส่งฐาน', /ไม่เกินวันนี้/.test(detErr()) && rpcCalls('teach_session_done').length === nd0);
  dfill('date', day(0)); dfill('hours', '1.5');
  submit('done'); await settle(600);
  ok('สอนแล้ว: ส่ง p_held_on + p_hours · รอบเปลี่ยนเป็น "สอนแล้ว" · เรียนแล้ว 4/6', lastArgs('teach_session_done').p_session === 's1' && lastArgs('teach_session_done').p_held_on === day(0) && lastArgs('teach_session_done').p_hours === 1.5
    && /สอนแล้ว/.test(ss('s1').textContent) && !has('open', '[data-k="done"][data-sid="s1"]') && /4\\/6/.test(D().querySelector('#teDetHead').textContent), ss('s1').textContent);

  // ── ยกเลิก / ไม่มา ──
  openForm('sched'); dfill('date', day(1)); dfill('start', '09:00'); dfill('end', '11:00');
  submit('sched'); await settle(500);
  const near = sessByStart(1, '09:00');
  openForm('cancel', near.id); await settle(150);
  ok('ฟอร์มยกเลิก: ตั้งต้น ยกเลิก · นักเรียน · แจ้งวันนี้ → แจ้งช้า (< 3 วัน) ตัวอย่างผลเป็นแดงตัวหนา', $('teD_as').value === 'cancelled' && $('teD_by').value === 'student' && $('teD_notified').value === day(0)
    && isRed(E('teCancelPrev').querySelector('.wk-red')) && /นับเป็นครั้งที่ใช้ไป/.test(E('teCancelPrev').textContent), E('teCancelPrev').textContent);
  dfill('by', 'teacher'); await settle(100);
  ok('ครูยกเลิก: ไม่มีช่องวันแจ้ง · ตัวอย่างผลไม่แดง "ไม่นับ"', !$('teD_notified') && !E('teCancelPrev').querySelector('.wk-red') && /ไม่นับเป็นครั้งที่ใช้ไป/.test(E('teCancelPrev').textContent));
  dfill('as', 'no_show'); await settle(100);
  ok('นักเรียนไม่มา: ไม่มีช่องใครยกเลิก · แดงตัวหนา "นับเป็นครั้งที่ใช้ไปเสมอ"', !$('teD_by') && isRed(E('teCancelPrev').querySelector('.wk-red')) && /เสมอ/.test(E('teCancelPrev').textContent));
  dfill('as', 'cancelled'); dfill('by', 'student'); await settle(100);
  dfill('reason', 'ติดธุระด่วน');
  submit('cancel'); await settle(600);
  const ca = lastArgs('teach_session_cancel');
  ok('ยกเลิกโดยนักเรียนแจ้งวันนี้: ส่ง cancelled/student · p_notified_at ว่าง (ฐานใช้เวลาปัจจุบัน) · เหตุผล', ca.p_session === near.id && ca.p_as === 'cancelled' && ca.p_by === 'student' && ca.p_notified_at === null && ca.p_reason === 'ติดธุระด่วน', J(ca));
  ok('ผล: ข้อความบอก "นับเป็นครั้งที่ใช้ไป" · แถวมีป้ายแจ้งช้าแดงตัวหนา', /นับเป็นครั้งที่ใช้ไป/.test(detOk()) && isRed(ss(near.id).querySelector('.wk-red')) && /แจ้งช้า/.test(ss(near.id).textContent), ss(near.id).textContent);
  const far = sessByStart(9, '10:00');
  openForm('cancel', far.id); await settle(100);
  ok('นัดอีก 9 วัน: แจ้งวันนี้ = ล่วงหน้า ตัวอย่างผลไม่แดง', !E('teCancelPrev').querySelector('.wk-red') && /ล่วงหน้า/.test(E('teCancelPrev').textContent));
  dfill('notified', day(-2));
  submit('cancel'); await settle(600);
  ok('แจ้งล่วงหน้า: ส่งวันที่แจ้ง (เที่ยงเวลาไทย) · ผล "ไม่นับเป็นครั้งที่ใช้ไป" · ไม่แดง', lastArgs('teach_session_cancel').p_notified_at === day(-2) + 'T12:00:00+07:00' && /ไม่นับเป็นครั้งที่ใช้ไป/.test(detOk())
    && !ss(far.id).querySelector('.wk-red'), lastArgs('teach_session_cancel').p_notified_at);
  const ns2 = sessByStart(10, '10:00');
  openForm('cancel', ns2.id); dfill('as', 'no_show'); await settle(100);
  submit('cancel'); await settle(600);
  ok('ไม่มา: ส่ง no_show · by ว่าง · แถว "ไม่มา" + แดงตัวหนา "นับเป็นครั้งที่ใช้ไป"', lastArgs('teach_session_cancel').p_as === 'no_show' && lastArgs('teach_session_cancel').p_by === null
    && /ไม่มา/.test(ss(ns2.id).textContent) && isRed(ss(ns2.id).querySelector('.wk-red')));

  // ── บันทึกการสอน ──
  ok('บันทึกการสอนที่มีอยู่ขึ้นที่รอบ s-d3 (เจ้าของเห็น)', /ฝึกสแครชเบสิกครั้งที่ 3/.test(ss('s-d3').textContent));
  openForm('note', 's-d3'); await settle(100);
  ok('ฟอร์มบันทึก: ใส่ข้อความเดิมไว้ · บอกว่าเห็นเฉพาะเจ้าของและครูของนักเรียนคนนี้', $('teD_text').value.indexOf('ฝึกสแครช') === 0 && /เห็นเฉพาะเจ้าของและครูของนักเรียน/.test(E('teFormNote').textContent));
  dfill('text', 'ซ้อมจังหวะ <b onmouseover=window.__xss=5>ตัวหนา</b>\\nบรรทัดสอง');
  submit('note'); await settle(600);
  ok('บันทึก: ส่งข้อความตามที่พิมพ์ · แสดงเป็นข้อความ (ไม่มีแท็ก b) · ข้อความเขียว', lastArgs('teach_note_save').p_session === 's-d3' && /<b onmouseover/.test(lastArgs('teach_note_save').p_note)
    && !ss('s-d3').querySelector('b') && /บันทึกการสอนแล้ว/.test(detOk()) && !window.__xss);
  openForm('note', 's-d3'); dfill('text', '   ');
  submit('note'); await settle(600);
  ok('ข้อความว่าง = ลบบันทึก: ส่งฐาน · บันทึกหายจากรอบ · ข้อความ "ลบบันทึกการสอนแล้ว"', /ลบบันทึกการสอนแล้ว/.test(detOk()) && !ss('s-d3').querySelector('.te-note') && TEACH.notes.every(n => n.session_id !== 's-d3'));

  // ── ผูก/ถอดนัดปฏิทิน ──
  const target = sessByStart(11, '10:00');
  FN.gcal = () => ({ events: [
    { uid: 'g-1', title: '[ห้องใหญ่] BASIC/สมชาย — TiBass', start: day(11) + 'T10:00', end: day(11) + 'T12:00', all_day: false },
    { uid: 'g-2', title: '[ห้องเล็ก] SCRATCH — Nutty', start: day(11) + 'T10:00', end: day(11) + 'T12:00', all_day: false },
    { uid: 'g-3', title: 'วันหยุดร้าน', start: day(11) + 'T00:00', end: day(11) + 'T23:59', all_day: true },
  ] });
  openForm('link', target.id); await settle(500);
  ok('ผูกนัด: ดึงปฏิทินของวันนั้นวันเดียว · แสดงเฉพาะนัดของครูคนเดียวกัน (ไม่สนตัวพิมพ์) + ป้าย "เวลาตรง"', CALLS.some(c => c.op === 'fn' && c.name === 'gcal' && c.body.from === day(11) && c.body.to === day(11))
    && D().querySelectorAll('#teFormLink .te-prow').length === 1 && /เวลาตรง/.test(E('teFormLink').textContent) && /BASIC/.test(E('teFormLink').textContent), E('teFormLink') && E('teFormLink').textContent);
  dact('link-pick'); await settle(600);
  ok('เลือกนัด: ส่ง uid + เวลาเริ่ม (เวลาไทย) · รอบบอก "ผูกปฏิทินแล้ว ✓" · มีปุ่มถอดนัด', lastArgs('teach_gcal_link').p_uid === 'g-1' && lastArgs('teach_gcal_link').p_start === day(11) + 'T10:00:00+07:00'
    && /ผูกปฏิทินแล้ว ✓/.test(ss(target.id).textContent) && has('unlink', '[data-sid="' + target.id + '"]'), J(lastArgs('teach_gcal_link')));
  dact('unlink', '[data-sid="' + target.id + '"]'); await settle(600);
  ok('ถอดนัด: เรียก teach_gcal_unlink · รอบกลับเป็น "ยังไม่ผูกปฏิทิน"', lastArgs('teach_gcal_unlink').p_session === target.id && /ยังไม่ผูกปฏิทิน/.test(ss(target.id).textContent));
  FN.gcal = () => ({ events: [{ uid: 'g-2', title: '[ห้องเล็ก] SCRATCH — Nutty', start: day(11) + 'T10:00', end: day(11) + 'T12:00', all_day: false }] });
  openForm('link', target.id); await settle(500);
  ok('ไม่มีนัดของครูคนนี้ในวันนั้น: คำเตือนแดงตัวหนา + แสดงนัดทั้งวันให้เลือก', isRed(E('teFormLink').querySelector('.hint.wk-red')) && D().querySelectorAll('#teFormLink .te-prow').length === 1);
  dact('close-form'); await settle(100);
  FN.gcal = () => ({ error: { code: 'not_configured', message: 'ยังไม่ได้ใส่ที่อยู่ปฏิทิน Google' } });
  openForm('link', target.id); await settle(500);
  ok('ยังไม่เชื่อมปฏิทิน Google: ข้อความแดงตัวหนาบอกวิธี (ไม่ใช่ error ดิบ)', isRed(E('teFormLink').querySelector('.wk-red')) && /ยังไม่ได้เชื่อมปฏิทิน Google/.test(E('teFormLink').textContent));
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

// ── 3. เจ้าของ: แก้ · ปิด/เปิดกลับ · ขยายอายุ ──
const T3 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== คอร์สเรียน ก้อน C (3/7): เจ้าของ — แก้การลงเรียน · ปิด/เปิดกลับ · ขยายอายุ ===');
  TEACH.seed();
  await login('TiBass');
  await open();

  // ── แก้การลงเรียน ──
  await openEnroll('active', 'e-active');
  openForm('fix'); await settle(300);
  ok('ฟอร์มแก้: ค่าเดิมถูกใส่ไว้ (ครู · ราคา 20000) · มีข้อความแดงตัวหนาบอกว่าถูกบันทึกประวัติ', $('teD_teacher').value === 't1' && $('teD_price').value === '20000' && isRed(E('teFormFix').querySelector('.wk-red')));
  const nf0 = rpcCalls('teach_enroll_fix').length;
  submit('fix'); await settle(100);
  ok('ยังไม่แก้อะไรแล้วกดบันทึก: ไม่ส่งฐาน · ข้อความ "ยังไม่ได้แก้อะไร"', /ยังไม่ได้แก้อะไร/.test(detErr()) && rpcCalls('teach_enroll_fix').length === nf0);
  dfill('note', 'หมายเหตุใหม่ของนักเรียน'); dfill('equip', 'Controller');
  submit('fix'); await settle(600);
  ok('แก้หมายเหตุ+อุปกรณ์: ส่งเฉพาะช่องที่เปลี่ยน (patch) · สรุปในแผงเปลี่ยนตาม', J(lastArgs('teach_enroll_fix')) === J({ p_id: 'e-active', p_patch: { equipment: 'Controller', note: 'หมายเหตุใหม่ของนักเรียน' } })
    && /หมายเหตุใหม่ของนักเรียน/.test($('teDetHead').textContent) && /Controller/.test($('teDetHead').textContent), J(lastArgs('teach_enroll_fix')));
  openForm('fix'); await settle(100);
  dfill('price', '19000');
  submit('fix'); await settle(600);
  ok('แก้ราคาที่ตกลง 19000: patch มี price_agreed ตัวเลข · ยอดเงินในแผงเปลี่ยน · คงเหลือไม่ติดลบ', lastArgs('teach_enroll_fix').p_patch.price_agreed === 19000 && /19,000 ฿/.test(E('teMoney').textContent) && /คงเหลือ 0/.test(dt()), E('teMoney').textContent);
  openForm('fix'); await settle(100);
  dfill('started', '');
  submit('fix'); await settle(500);
  ok('ล้างวันเริ่มเรียนทั้งที่มีรอบที่สอนแล้ว: ฐานปฏิเสธ · ข้อความไทยของฐานแสดงตามจริง · ฟอร์มยังเปิด', /ล้างวันเริ่มเรียนไม่ได้/.test(detErr()) && !!E('teFormFix'), detErr());
  dact('close-form'); await settle(100);
  await openEnroll('active', 'e-backfill');
  openForm('fix'); await settle(300);
  ok('การลงเรียนที่กรอกย้อนหลัง: มีช่อง "ชำระครบ (ไม่ทราบวันที่/ยอด)" ติ๊กอยู่ · ราคาว่าง', $('teD_unknown') && $('teD_unknown').checked === true && $('teD_price').value === '');
  $('teD_unknown').checked = false; $('teD_unknown').dispatchEvent(new Event('change', { bubbles: true })); await settle(100);
  submit('fix'); await settle(600);
  ok('ยกเลิกติ๊ก: patch มี paid_unknown false เท่านั้น', J(lastArgs('teach_enroll_fix')) === J({ p_id: 'e-backfill', p_patch: { paid_unknown: false } }), J(lastArgs('teach_enroll_fix')));

  // ── ปิดคอร์ส ──
  await openEnroll('active', 'e-month');
  ok('ก่อนปิด: มีปุ่ม "ปิดคอร์ส" · ไม่มีปุ่ม "เปิดคอร์สกลับ"', has('open', '[data-k="close"]') && !has('reopen'));
  openForm('close'); await settle(100);
  ok('ฟอร์มปิด: แดงตัวหนาบอกจำนวนรอบที่นัดค้าง 2 รอบจะถูกยกเลิกโดยร้าน', isRed(E('teCloseWarn')) && /2 รอบ/.test(E('teCloseWarn').textContent) && /ยกเลิกโดยร้าน/.test(E('teCloseWarn').textContent), E('teCloseWarn').textContent);
  submit('close'); await settle(100);
  ok('ไม่เลือกเหตุผล: ไม่เปิดหน้าต่างยืนยัน · ข้อความแดง', /เลือกเหตุผล/.test(detErr()) && !confirmOpen());
  dfill('reason', 'quit');
  submit('close'); await settle(200);
  ok('เลือกเหตุผลแล้ว: ต้องยืนยันก่อน (แจ้ง 2 รอบจะถูกยกเลิกโดยร้านแดงตัวหนา) · ยังไม่ส่งฐาน', confirmOpen() && isRed($('teCloseConfirmN')) && /2 รอบ/.test($('teCloseConfirmN').textContent) && rpcCalls('teach_enroll_close').length === 0);
  await confirmOk();
  ok('ยืนยัน: ส่ง id + เหตุผล + วันที่ปิด · สถานะ "ปิดแล้ว" · รอบที่ค้างถูกยกเลิกโดยร้าน', J(lastArgs('teach_enroll_close')) === J({ p_id: 'e-month', p_reason: 'quit', p_closed_on: day(0) })
    && /ปิดแล้ว/.test($('teDetHead').textContent) && /ยกเลิก [(]ร้าน[)]/.test(ss('s2').textContent) && /ปิดคอร์ส/.test(ss('s2').textContent), ss('s2').textContent);
  ok('ปิดแล้ว: ไม่มีปุ่มนัดรอบ/บันทึกชำระ/ปิดคอร์ส · มีคำอธิบาย · มีปุ่มเปิดกลับ (เจ้าของ)', !has('open', '[data-k="sched"]') && !has('open', '[data-k="pay"]') && !has('open', '[data-k="close"]') && has('reopen')
    && /ปิดแล้ว — นัดรอบใหม่ไม่ได้/.test(dt()) && /ปิดแล้ว — บันทึกชำระเพิ่มไม่ได้/.test(dt()));

  // ── เปิดกลับ ──
  dact('reopen'); await settle(200);
  ok('เปิดกลับ: ต้องยืนยัน · แดงตัวหนาบอกว่ารอบที่ยกเลิก (2 รอบ) ไม่ถูกคืนอัตโนมัติ', confirmOpen() && isRed($('teReopenWarn')) && /ไม่ถูกคืนให้อัตโนมัติ/.test($('teReopenWarn').textContent) && /2 รอบ/.test($('teReopenWarn').textContent));
  await confirmOk();
  ok('ยืนยัน: เรียก teach_enroll_reopen · กลับเป็นกำลังเรียน · ข้อความ+คำเตือนแดงบอกว่าไม่ถูกคืน 2 รอบ', lastArgs('teach_enroll_reopen').p_id === 'e-month' && /กำลังเรียน/.test($('teDetHead').textContent)
    && /ไม่ถูกคืน/.test(detOk()) && isRed(E('teDetWarn').querySelector('.wk-red')) && /2 รอบ/.test(detWarn()), detOk());

  // ── ขยายอายุ: เจ้าของขยายเอง ──
  openForm('ext'); await settle(100);
  ok('ฟอร์มขยายเอง: ข้างช่องหมายเหตุมีข้อความแดงตัวหนา "ทั้งทีมเห็น"', isRed(E('teExtNoteWarn')) && /ทั้งทีมเห็น/.test(E('teExtNoteWarn').textContent));
  dfill('until', day(20));
  submit('ext'); await settle(100);
  ok('วันที่ไม่เกินวันหมดอายุเดิม: ไม่ส่งฐาน', /ต้องเกินวันหมดอายุปัจจุบัน/.test(detErr()) && rpcCalls('teach_enroll_extend').length === 0);
  dfill('until', day(40)); dfill('note', 'ขยายตามที่ตกลงกับนักเรียน');
  submit('ext'); await settle(600);
  ok('ขยายเอง: ส่งวัน+หมายเหตุ · แผงโชว์ "หมายเหตุขยายอายุ … (ทั้งทีมเห็น)" · มีประวัติ "เจ้าของขยายเอง"', J(lastArgs('teach_enroll_extend')) === J({ p_id: 'e-month', p_until: day(40), p_note: 'ขยายตามที่ตกลงกับนักเรียน' })
    && /ขยายตามที่ตกลงกับนักเรียน/.test($('teDetHead').textContent) && /ทั้งทีมเห็น/.test($('teDetHead').textContent) && /เจ้าของขยายเอง/.test($('teDetExt').textContent), $('teDetHead').textContent.slice(0, 300));

  // ── ขยายอายุ: ตัดสินคำขอของครู ──
  await openEnroll('active', 'e-soon');
  ok('มีคำขอรอตัดสิน: แถบแดงตัวหนา · เหตุผลของครู · ปุ่มตัดสิน · ไม่มีปุ่มขยายเอง (ตัดสินใบที่รออยู่ก่อน)', isRed(E('teExtPending')) && /นักเรียนป่วยหลายสัปดาห์/.test($('teDetExt').textContent) && has('open', '[data-k="decide"]') && !has('open', '[data-k="ext"]'));
  openForm('decide', 'x1'); await settle(100);
  ok('ฟอร์มตัดสิน: วันที่ตั้งต้น = ที่ครูขอ · หมายเหตุเจ้าของเก็บที่ใบคำขอ (ทีมอื่นไม่เห็น)', $('teD_until').value === day(35) && /เห็นเฉพาะเจ้าของและครูผู้ขอ/.test(E('teFormDecide').textContent));
  dfill('until', day(30)); dfill('note', 'อนุมัติครั้งเดียว');
  dact('decide-yes'); await settle(600);
  ok('อนุมัติ (แก้วันเป็น +30): ส่ง request + approve true + วันที่ + หมายเหตุ · แผงโชว์ขยายแล้ว · ประวัติ "อนุมัติแล้ว"', J(lastArgs('teach_extend_decide')) === J({ p_request: 'x1', p_approve: true, p_until: day(30), p_note: 'อนุมัติครั้งเดียว' })
    && /ขยายอายุแล้ว/.test($('teDetHead').textContent) && /อนุมัติแล้ว/.test($('teDetExt').textContent) && !E('teExtPending'), $('teDetExt').textContent.slice(0, 200));
  await openEnroll('ended', 'e-expired');
  openForm('decide', 'x2'); await settle(100);
  dfill('note', 'ไม่อนุมัติ');
  dact('decide-no'); await settle(600);
  ok('ปฏิเสธ: approve false · until ว่าง · ประวัติ "ปฏิเสธ"', J(lastArgs('teach_extend_decide')) === J({ p_request: 'x2', p_approve: false, p_until: null, p_note: 'ไม่อนุมัติ' }) && /ปฏิเสธ/.test($('teDetExt').textContent));

  // ── ปิดแล้ว: แก้ได้เฉพาะเจ้าของ · แสดงเหตุผล ──
  await openEnroll('ended', 'e-closed');
  ok('คอร์สที่ปิดแล้ว (เจ้าของ): บอกเหตุผลที่ปิด · มีปุ่มแก้ + เปิดกลับ · คืนเงินแสดงเป็นรายการแดง', /ปิดแล้ว · คืนเงิน/.test($('teDetHead').textContent) && has('open', '[data-k="fix"]') && has('reopen')
    && [...D().querySelectorAll('.te-prow strong.wk-red')].some(e => /คืนเงิน −20,000/.test(e.textContent)));
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

// ── 4. พนักงานที่ไม่ใช่ครู (Zen) ──
const T4 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== คอร์สเรียน ก้อน C (4/7): พนักงานที่ไม่ใช่ครู — ไม่วาด/ไม่ดึง เงิน · บันทึกการสอน · ขยายอายุ ===');
  TEACH.seed();
  { const bf = TEACH.rows.find(r => r.id === 'e-backfill'); bf.paid_unknown = false; bf.paid_in_full = false; delete TEACH.money['e-backfill']; }   // ใบย้อนหลังที่ไม่ใช่ชำระครบ (ตั้งก่อนหน้าโหลด)
  await login('Zen');
  await open();
  await openEnroll('active', 'e-active');
  ok('พนักงานเปิดแผงได้ · เห็นสรุป + ✓ชำระครบ + "บันทึก 1 งวด"', !!D() && /Basic DJ Class/.test(dt()) && /✓ ชำระครบ/.test(dt()) && /บันทึก 1 งวด/.test(dt()));
  ok('ไม่วาดส่วนเงิน: ไม่มีราคา/ยอดสะสม/คงเหลือ/รายการชำระ/ปุ่มคืนเงิน/ปุ่มแก้', !E('teMoney') && !D().querySelector('.te-prow[data-pid]') && !/20,000|คงเหลือ|ชำระสะสม|ราคาที่ตกลง/.test(dt()) && !has('open', '[data-k="refund"]') && !has('open', '[data-k="payfix"]'));
  ok('ไม่วาดบันทึกการสอน: ไม่มีเนื้อบันทึก · ไม่มีปุ่ม · ไม่มีช่องข้อความ', !D().querySelector('.te-note') && !/ฝึกสแครช/.test(dt()) && !has('open', '[data-k="note"]') && !D().querySelector('textarea'));
  ok('ไม่วาดขยายอายุ/จัดการ: ไม่มีส่วนขยายอายุ · ไม่มีปุ่มแก้/ปิด/เปิดกลับ', !E('teDetExt') && !has('open', '[data-k="fix"]') && !has('open', '[data-k="close"]') && !has('reopen') && !/ขอขยายอายุ|ขยายอายุเอง/.test(dt()));
  const sel = CALLS.filter(c => c.op === 'select' && c.who === 'u2');
  ok('ไม่ดึงข้อมูลที่สิทธิ์ไม่ถึงเลย (เงิน · ยอดตกลง · บันทึกการสอน · คำขอขยายอายุ)', !sel.some(c => /^(enrollment_payments|enrollment_money|session_notes|enrollment_extension_requests)$/.test(c.table)), sel.map(c => c.table).join());
  ok('รอบนัดไว้: ไม่มีปุ่ม "ทำเครื่องหมายสอนแล้ว" (ไม่ใช่ครูของรอบ) · มีปุ่มยกเลิก/ไม่มา · ถอดนัดปฏิทิน', !has('open', '[data-k="done"]') && has('open', '[data-k="cancel"][data-sid="s1"]') && has('unlink', '[data-sid="s1"]'));
  await shot('c4-detail-staff');

  // บันทึกชำระ (060): เจ้าของ/ผู้ดูแลเท่านั้น — พนักงานทั่วไปไม่มีปุ่ม ไม่มีฟอร์ม
  ok('พนักงานทั่วไป: ไม่มีปุ่ม "+ บันทึกชำระ"/คืนเงิน · มีข้อความ "บันทึกชำระได้เฉพาะเจ้าของหรือผู้ดูแล"', !has('open', '[data-k="pay"]') && !has('open', '[data-k="refund"]') && !!E('teDetPayOnlyMgr') && /เฉพาะเจ้าของหรือผู้ดูแล/.test(E('teDetPayOnlyMgr').textContent));
  ok('ยังเห็น ✓ชำระครบ + "บันทึก 1 งวด" (สถานะ ไม่ใช่ยอด) · ไม่ส่งบันทึกชำระ', /✓ ชำระครบ/.test(dt()) && /บันทึก 1 งวด/.test(dt()) && rpcCalls('teach_payment_record').length === 0);
  // นัดรอบ: ทำได้เมื่อชำระครบ (ทีมงานทุกตำแหน่ง)
  openForm('sched'); await settle(300);
  dfill('date', day(8)); dfill('start', '10:00'); dfill('end', '12:00');
  submit('sched'); await settle(600);
  ok('พนักงานนัดรอบได้เมื่อชำระครบ (ทีมงานทุกตำแหน่ง)', rpcCalls('teach_session_schedule').length === 1 && ssIds().length === 5 && !E('teSchedBlocked'));
  // ใบย้อนหลังที่ไม่ใช่ชำระครบ (ราคาอาจว่าง): ฐานไม่บล็อก → หน้าไม่ขึ้นคำเตือนแดงเอง (ปล่อยให้ฐานตัดสิน)
  await openEnroll('active', 'e-backfill');
  ok('ใบย้อนหลังที่ยังไม่ชำระ: ไม่ขึ้นคำเตือน "ยังนัดไม่ได้" ฝั่งหน้า (ฐานตัดสินเองเพราะราคาอาจว่าง)', !E('teSchedBlocked'));
  // ใบที่ยังไม่ชำระ (e-wait): คำเตือนแดง + ฐานปฏิเสธเป็นข้อความไทย
  await openEnroll('queue', 'e-wait');
  ok('ใบที่ยังไม่ชำระ: ขึ้นคำเตือนแดงตัวหนา "ยังไม่ชำระครบ — นัดรอบเรียนได้หลังเจ้าของหรือผู้ดูแลบันทึกชำระครบ"', isRed(E('teSchedBlocked')) && /ยังไม่ชำระครบ/.test(E('teSchedBlocked').textContent));
  openForm('sched'); await settle(300);
  dfill('date', day(9)); dfill('start', '10:00'); dfill('end', '12:00');
  submit('sched'); await settle(600);
  ok('นัดรอบของใบที่ยังไม่ชำระ: ส่งฐาน → ฐานปฏิเสธ · แถบแดงข้อความไทยจากฐาน (ไม่ใช่ error ดิบ)', rpcCalls('teach_session_schedule').length === 2 && /ยังไม่ชำระครบ/.test(detErr()) && !/permission|violates|42501/.test(detErr()), detErr());
  // ผู้ดูแล: ปิดคอร์สไม่ได้
  ok('ไม่เรียกถังสลิป/Storage ตลอดการใช้งาน', !CALLS.some(c => /course-slips|storage/.test(J(c))));
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

// ── 5. พนักงานที่เป็นครู (Nutty) · ผู้ดูแล (Nui) ──
const T5 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== คอร์สเรียน ก้อน C (5/7): พนักงานที่เป็นครู (Nutty) · ผู้ดูแล (Nui) ===');
  TEACH.seed();
  TEACH.notes.push({ session_id: 's3', note: 'โน้ตของครูนัตตี้ถึง e-soon', written_by: 'u3' });
  await login('Nutty');
  await open();
  await openEnroll('active', 'e-soon');
  ok('ครูเห็นเงินของนักเรียนตัวเอง: ราคา 18,000 · ชำระสะสม 18,000 · 2 รายการ', /ราคาที่ตกลง18,000฿/.test(E("teMoney").textContent.replace(/\\s/g, '')) && D().querySelectorAll('.te-prow[data-pid]').length === 2 && /คงเหลือ 0/.test(dt()), E('teMoney') && E('teMoney').textContent);
  ok('ครูที่เป็นพนักงาน: ไม่มีปุ่มคืนเงิน/แก้รายการ/แก้ข้อมูล/ปิดคอร์ส', !has('open', '[data-k="refund"]') && !has('open', '[data-k="payfix"]') && !has('open', '[data-k="fix"]') && !has('open', '[data-k="close"]'));
  ok('ครูเห็นบันทึกการสอนของรอบตัวเอง (s3)', /โน้ตของครูนัตตี้/.test(ss('s3').textContent) && has('open', '[data-k="note"][data-sid="s3"]'));
  ok('ครูเห็นคำขอขยายอายุของตัวเอง (รอเจ้าของตัดสิน) · ไม่มีปุ่มตัดสิน · ยื่นซ้ำไม่ได้', /รอเจ้าของตัดสิน/.test($('teDetExt').textContent) && /นักเรียนป่วยหลายสัปดาห์/.test($('teDetExt').textContent) && !has('open', '[data-k="decide"]') && !has('open', '[data-k="extreq"]') && !has('open', '[data-k="ext"]'));
  ok('ครูทำเครื่องหมายสอนแล้วได้เฉพาะรอบของตัวเอง', has('open', '[data-k="done"][data-sid="s3"]'));
  openForm('done', 's3'); await settle(100);
  submit('done'); await settle(600);
  ok('ครูทำเครื่องหมายสอนแล้ว: ส่งฟังก์ชัน · รอบเปลี่ยนเป็นสอนแล้ว', lastArgs('teach_session_done').p_session === 's3' && /สอนแล้ว/.test(ss('s3').textContent));
  await openEnroll('active', 'e-backfill');
  ok('การลงเรียนของครูที่ยังไม่มีคำขอ: มีปุ่ม "ขอขยายอายุ" (ไม่มีปุ่มขยายเอง)', has('open', '[data-k="extreq"]') && !has('open', '[data-k="ext"]'));
  openForm('extreq'); await settle(100);
  ok('ฟอร์มขอ: บอกว่าเหตุผลเห็นเฉพาะเจ้าของและครูผู้ขอ', /เห็นเฉพาะเจ้าของและครูผู้ขอ/.test(E('teFormExtReq').textContent));
  const nq0 = rpcCalls('teach_extend_request').length;
  dfill('until', day(70));
  submit('extreq'); await settle(100);
  ok('ไม่ใส่เหตุผล: ไม่ส่งฐาน', /ใส่เหตุผล/.test(detErr()) && rpcCalls('teach_extend_request').length === nq0);
  dfill('reason', 'ต้องการเวลาเพิ่ม');
  submit('extreq'); await settle(600);
  ok('ยื่นคำขอ: ส่งวัน+เหตุผล · ขึ้น "รอเจ้าของตัดสิน" · ฟอร์ม/ปุ่มหาย', J(lastArgs('teach_extend_request')) === J({ p_enrollment: 'e-backfill', p_until: day(70), p_reason: 'ต้องการเวลาเพิ่ม' }) && /รอเจ้าของตัดสิน/.test($('teDetExt').textContent) && !has('open', '[data-k="extreq"]'));
  // นักเรียนของครูคนอื่น (ครูที่เป็นพนักงานตั้งต้นที่ "ของฉัน" — สลับเป็นทุกคนก่อน)
  document.querySelector('#teWho button[data-who="all"]').click(); await sleep(100);
  await openEnroll('active', 'e-active');
  ok('นักเรียนของครูคนอื่น (Tibass): ไม่เห็นเงิน · ไม่เห็นบันทึกการสอน · ไม่มีส่วนขยายอายุ · ไม่มีปุ่มสอนแล้วของรอบนั้น', !E('teMoney') && !D().querySelector('.te-note') && !E('teDetExt') && !has('open', '[data-k="note"]') && !has('open', '[data-k="done"]'));
  const sel = CALLS.filter(c => c.op === 'select' && c.who === 'u3' && (c.eq || []).some(e => e[1] === 'e-active'));
  ok('ไม่ดึงเงิน/บันทึก/คำขอของนักเรียนที่ไม่ใช่ลูกศิษย์ตัวเอง', !sel.some(c => /^(enrollment_payments|enrollment_money|session_notes|enrollment_extension_requests)$/.test(c.table)), sel.map(c => c.table).join());
  await logout();

  // ── ผู้ดูแล (Nui) ──
  await login('Nui');
  await open();
  await openEnroll('active', 'e-active');
  ok('ผู้ดูแลเห็นเงินทุกคน: ราคา · รายการ · ปุ่มคืนเงิน/แก้รายการ/แก้ข้อมูล/ปิดคอร์ส', !!E('teMoney') && /20,000/.test(E('teMoney').textContent) && has('open', '[data-k="refund"]') && has('open', '[data-k="payfix"]') && has('open', '[data-k="fix"]') && has('open', '[data-k="close"]'));
  ok('ผู้ดูแล: ไม่เห็นบันทึกการสอน (ไม่ใช่ครูของนักเรียนคนนี้) · ไม่เห็นส่วนขยายอายุ (เจ้าของ+ครูผู้ขอเท่านั้น)', !D().querySelector('.te-note') && !has('open', '[data-k="note"]') && !E('teDetExt'));
  ok('ผู้ดูแลทำเครื่องหมายสอนแล้วได้ (ผู้ดูแลทุกรอบ)', has('open', '[data-k="done"][data-sid="s1"]'));
  const sel2 = CALLS.filter(c => c.op === 'select' && c.who === 'u4' && (c.eq || []).some(e => e[1] === 'e-active'));
  ok('ผู้ดูแลไม่ดึงบันทึกการสอนและคำขอขยายอายุ', !sel2.some(c => /^(session_notes|enrollment_extension_requests)$/.test(c.table)), sel2.map(c => c.table).join());
  await openEnroll('ended', 'e-closed');
  ok('คอร์สที่ปิดแล้ว: ผู้ดูแลแก้ไม่ได้ ไม่มีปุ่มเปิดกลับ (เจ้าของเท่านั้น)', !has('open', '[data-k="fix"]') && !has('reopen') && /ปิดแล้ว/.test($('teDetHead').textContent));
  await openEnroll('active', 'e-soon');
  ok('ผู้ดูแลไม่เห็นคำขอขยายอายุของครูแม้มีใบรอตัดสิน · เห็นเฉพาะวันหมดอายุ', !E('teDetExt') && !/นักเรียนป่วย/.test(dt()) && !has('open', '[data-k="decide"]'));
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

// ── 6. แท็บรอบเรียน · Realtime · โหลดล้ม · ออกจากระบบ · สลับบัญชีกลางโหลด · XSS ──
const T6 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
const groups = () => [...body().querySelectorAll('.wk-group')].map(g => ({ title: g.querySelector('h3 > span').firstChild.textContent.trim(), n: g.querySelectorAll('.te-row').length, sids: [...g.querySelectorAll('.te-row[data-sid]')].map(e => e.dataset.sid) }));
async function runTests() {
  L('=== คอร์สเรียน ก้อน C (6/7): แท็บรอบเรียน · Realtime · โหลดล้ม · ออกจากระบบ · สลับบัญชี · XSS ===');
  TEACH.seed();
  await login('TiBass');
  await open();

  // ── แท็บรอบเรียน ──
  tab('sessions'); await sleep(200);
  const g = groups();
  ok('แท็บรอบเรียน: 3 กลุ่ม — เลยเวลานัด 1 (s-over) · สัปดาห์นี้ 2 (s1, s2) · ที่จะถึง 1 (s3)', g.length === 3 && g[0].sids.join() === 's-over' && g[1].sids.join() === 's1,s2' && g[2].sids.join() === 's3', J(g));
  ok('รอบที่เลยเวลานัดแล้ว: แดงตัวหนา "เลยเวลานัดแล้ว ยังไม่ได้ทำเครื่องหมาย"', isRed(body().querySelector('.te-row[data-sid="s-over"] .wk-red')) && /เลยเวลานัดแล้ว/.test(body().querySelector('.te-row[data-sid="s-over"]').textContent));
  ok('ตัวกรอง "เฉพาะที่ยังไม่ผูกปฏิทิน (3)" มีจำนวน · รอบที่ผูกแล้ว s1 ไม่นับ', /ยังไม่ผูกปฏิทิน [(]3[)]/.test(body().textContent));
  $('teSchedOnly').checked = true; $('teSchedOnly').dispatchEvent(new Event('change', { bubbles: true })); await sleep(100);
  const g2 = groups();
  ok('เปิดตัวกรอง: เหลือเฉพาะที่ยังไม่ผูก (s-over · s2 · s3) — s1 หายไป', g2.map(x => x.sids.join()).join('|') === 's-over|s2|s3', J(g2));
  $('teSchedOnly').checked = false; $('teSchedOnly').dispatchEvent(new Event('change', { bubbles: true })); await sleep(100);
  document.querySelector('#teWho button[data-who="mine"]').click(); await sleep(100);
  ok('ตัวกรอง "ของฉัน" (Tibass = ครู t1): เหลือรอบของการลงเรียนที่เป็นของฉัน (s1)', groups().map(x => x.sids).flat().join() === 's1', J(groups()));
  document.querySelector('#teWho button[data-who="all"]').click(); await sleep(100);
  body().querySelector('.te-row[data-sid="s2"]').click(); await settle(600);
  ok('คลิกแถวรอบเรียน: เปิดแผงของการลงเรียนนั้น (e-month · ชื่อ วีระ ชูใจ)', !!D() && D().dataset.eid === 'e-month' && $('detailTitle').textContent === 'วีระ ชูใจ' && !!ss('s2'), $('detailTitle').textContent);
  closeDetail();
  const r0 = body().querySelector('.te-row[data-sid="s3"]');
  r0.focus(); r0.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await settle(600);
  ok('กด Enter ที่แถว (คีย์บอร์ด): เปิดแผงเช่นกัน (e-soon)', !!D() && D().dataset.eid === 'e-soon');

  // ── Realtime: รอบใหม่โผล่ในแผงที่เปิดอยู่ ──
  tab('active'); await sleep(150);
  row('e-active').click(); await settle(500);
  const loads0 = TEACH.loads;
  TEACH.sessions.push({ id: 's-rt', enrollment_id: 'e-active', teacher_id: 't1', status: 'scheduled', starts_at: new Date(Date.now() + 9 * 86400000).toISOString(), ends_at: new Date(Date.now() + 9 * 86400000 + 7200000).toISOString(),
    held_on: null, hours: '2.00', room: 'ห้อง Realtime', cancel_by: null, notified_at: null, late_cancel: false, cancel_reason: null, gcal_uid: null, gcal_start: null, created_at: new Date().toISOString() });
  TEACH.fireRt('class_sessions'); await sleep(900);
  ok('Realtime: รอบที่เพิ่มจากที่อื่นโผล่ในแผงที่เปิดอยู่เอง · รายการหลักโหลดใหม่', !!ss('s-rt') && TEACH.loads > loads0, ssIds().join());

  // ── ผลโหลดเก่าที่มาช้าต้องไม่ทับผลใหม่ (โหลดซ้อน) ──
  let relA; TEACH.gateSess = new Promise(r => { relA = r; });
  row('e-month').click(); await sleep(300);                 // โหลดครั้งที่ 1 ค้าง (ฐานปลอมถ่ายข้อมูล ณ ตอนนี้)
  TEACH.gateSess = null;
  TEACH.sessions.push({ id: 's-new2', enrollment_id: 'e-month', teacher_id: 't3', status: 'scheduled', starts_at: new Date(Date.now() + 12 * 86400000).toISOString(), ends_at: new Date(Date.now() + 12 * 86400000 + 7200000).toISOString(),
    held_on: null, hours: '2.00', room: null, cancel_by: null, notified_at: null, late_cancel: false, cancel_reason: null, gcal_uid: null, gcal_start: null, created_at: new Date().toISOString() });
  TEACH.fireRt('class_sessions'); await sleep(900);         // โหลดครั้งที่ 2 เสร็จ → เห็นรอบใหม่
  ok('โหลดซ้ำเสร็จ: เห็นรอบใหม่ (s-new2)', !!D() && !!ss('s-new2'), D() && ssIds().join());
  relA(); await sleep(600);                                 // ผลเก่ามาถึงทีหลัง
  ok('ผลโหลดเก่าที่มาช้าไม่ทับผลใหม่: รอบใหม่ยังอยู่', !!D() && !!ss('s-new2'), D() && ssIds().join());

  // ── โหลดรอบของแผงล้ม ──
  TEACH.fail.detail_sessions = 'connection reset by peer';
  row('e-month').click(); await settle(600);
  ok('โหลดรายละเอียดล้ม: แถบแดงตัวหนา "โหลดรายละเอียดไม่สำเร็จ" · ไม่มีข้อความอังกฤษดิบ · ยังเห็นสรุปจากรายการ', isRed(E('teDetLoadErr')) && /โหลดรายละเอียดไม่สำเร็จ/.test(dt()) && !/connection reset/.test(dt()) && /Basic DJ Class/.test(dt()), dt().slice(0, 200));
  TEACH.fail = {};

  // ── เปลี่ยนหมวด: แผงถูกปิด ไม่ค้างข้อมูล ──
  showSection('home'); await sleep(400);
  ok('ออกจากหมวดคอร์สเรียน: แผงปิด', $('detail').hidden === true);
  TEACH.fireRt('class_sessions'); await sleep(700);
  ok('Realtime ตอนอยู่หมวดอื่น: ไม่ error · ไม่เปิดแผงคืน', $('detail').hidden === true && !document.getElementById('fatalError'));
  await open(); tab('active'); await sleep(150);

  // ── ออกจากระบบ: ข้อมูลนักเรียน/ยอดเงินไม่ค้าง ──
  row('e-active').click(); await settle(600);
  ok('ก่อนออก: แผงมียอดเงิน', /20,000/.test(dt()));
  await logout();
  ok('ออกจากระบบ: แผงปิด · DOM ของแผงว่าง · หัวแผงว่าง', $('detail').hidden === true && $('detailBody').innerHTML === '' && $('detailTitle').textContent === '' && te.det === null);

  // ── สลับบัญชีระหว่างโหลดรอบของแผง: ผลเก่าถูกทิ้ง ──
  await login('TiBass');
  await open(); tab('active'); await sleep(150);
  let release; TEACH.gateSess = new Promise(r => { release = r; });
  row('e-active').click(); await sleep(300);
  ok('ระหว่างโหลดช้า: แผงเปิดโดยมีแค่สรุป + "กำลังโหลด…"', !!D() && /กำลังโหลด/.test(dt()));
  await logout();
  await login('Zen');
  TEACH.gateSess = null; release(); await sleep(700);
  ok('ผลที่มาช้าหลังสลับเป็นพนักงาน: ไม่โผล่ในแผง/หน้า (แผงปิด · ไม่มีรอบ/ยอดของคนเก่า)', $('detail').hidden === true && !D() && $('detailBody').innerHTML === '', $('detailBody').innerHTML.slice(0, 100));

  // ── XSS ──
  await open(); tab('active'); await sleep(150);
  row('e-xss').click(); await settle(500);
  ok('ชื่อ/คอร์ส/ครูที่เป็น HTML ในแผงแสดงเป็นข้อความ (XSS)', !D().querySelector('img') && !D().querySelector('b') && !D().querySelector('i') && /<b onmouseover/.test(dt()) && !window.__xss && /<img src=x/.test($('detailTitle').textContent));
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

// ── 7. iPhone 390 ──
const T7 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== คอร์สเรียน ก้อน C (7/7): iPhone 390px — แผงรายละเอียด ===');
  TEACH.seed();
  await login('TiBass');
  await open();
  tab('active'); await sleep(200);
  row('e-active').click(); await settle(700);
  ok('iPhone: แผงเปิด · ไม่ล้นจอ (ไม่มีแถบเลื่อนแนวนอน)', !!D() && document.documentElement.scrollWidth <= window.innerWidth + 1 && $('detail').getBoundingClientRect().width <= window.innerWidth + 1,
    document.documentElement.scrollWidth + '>' + window.innerWidth + ' · panel ' + $('detail').getBoundingClientRect().width);
  openForm('pay'); await settle(150);
  const els = [...D().querySelectorAll('.te-form input.input, .te-form select.input, .te-form button.btn')];
  ok('iPhone: ช่องกรอก/ปุ่มในฟอร์มสูง ≥ 44px', els.length > 4 && els.every(e => e.getBoundingClientRect().height >= 43.5), els.map(e => Math.round(e.getBoundingClientRect().height)).join());
  ok('iPhone: ช่องกรอกตัวหนังสือ ≥ 16px (iOS ไม่ซูมเอง)', [...D().querySelectorAll('input.input, select.input, textarea.input')].every(e => parseFloat(getComputedStyle(e).fontSize) >= 16));
  ok('iPhone: ตัวหนังสือในแผงทุกตัว ≥ 14px', [...D().querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim()).every(e => parseFloat(getComputedStyle(e).fontSize) >= 14),
    [...D().querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 14).map(e => e.textContent.slice(0, 20)).join());
  const btns = [...D().querySelectorAll('button[data-act]')];
  ok('iPhone: ปุ่มทุกตัวในแผงสูง ≥ 44px', btns.length > 5 && btns.every(b => b.getBoundingClientRect().height >= 43.5), btns.map(b => b.textContent.slice(0, 10) + ':' + Math.round(b.getBoundingClientRect().height)).join());
  ok('iPhone: ข้อความแดงตัวหนาของฟอร์มชำระมองเห็น (ไม่ถูกตัด)', isRed(E('teDetPayWarn')) && E('teDetPayWarn').getBoundingClientRect().right <= window.innerWidth + 1);
  await shot('c7-phone-detail');
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

const T8 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
const FNC = () => CALLS.filter(c => c.op === 'fn' && c.name === 'gcal-sync');
const FNA = a => FNC().filter(c => c.body.action === a);
const schedRoom = async (d, room, start = '10:00', end = '12:00') => {
  openForm('sched'); await settle(100);
  dfill('date', day(d)); dfill('start', start); dfill('end', end); dfill('room', room);
  submit('sched'); await settle(700);
};
async function runTests() {
  L('=== คอร์สเรียน ก้อน C (8/8): นัดสอนที่เดียว — ลงฐาน + Google Calendar (gcal-sync · 063) ===');
  TEACH.seed();
  await login('TiBass');
  await open();
  await openEnroll('active', 'e-active');
  await sleep(300);

  // ── 1. ฟอร์ม ──
  openForm('sched'); await settle(200);
  const opts = [...($('teD_room').options || [])].map(o => o.value);       // ช่องกลายเป็น input = ไม่มี options → ให้ข้อยืนยันข้างล่างตก ไม่ใช่ TypeError ทั้งหน้า
  ok('ช่องห้องเป็นตัวเลือก: ว่าง (ลงฐานอย่างเดียว) + ห้องใหญ่ · ห้องเล็ก1 · ห้องเล็ก2 · ห้องซ้อม', $('teD_room').tagName === 'SELECT' && J(opts) === J(['', 'ห้องใหญ่', 'ห้องเล็ก1', 'ห้องเล็ก2', 'ห้องซ้อม']), J(opts));
  ok('ข้อความใต้ฟอร์มบอกว่าห้องชนแล้วไม่สร้างนัด (ระบบตรวจกับปฏิทิน)', /ห้องชนนัดอื่น = ไม่สร้างนัด/.test(dt()));
  dact('close-form'); await settle(100);

  // ── 2. สำเร็จ: เช็ก → นัดฐาน → ลงปฏิทิน ──
  await schedRoom(20, 'ห้องเล็ก1');
  const ck = FNA('check')[0], up = FNA('upsert')[0], sc = lastArgs('teach_session_schedule');
  const made = sessByStart(20, '10:00');
  ok('ลำดับ: check ก่อน → teach_session_schedule → upsert', !!ck && !!up && CALLS.indexOf(ck) < CALLS.findIndex(c => c.op === 'rpc' && c.fn === 'teach_session_schedule' && c.args.p_starts === day(20) + 'T10:00:00+07:00') && CALLS.indexOf(up) > CALLS.findIndex(c => c.op === 'rpc' && c.fn === 'teach_session_schedule' && c.args.p_starts === day(20) + 'T10:00:00+07:00'));
  ok('check ส่งแค่ action + ห้อง + เวลา (+07:00) · upsert ส่งแค่ action + session_id (ไม่ส่ง title/เวลา/ห้อง)',
    J(Object.keys(ck.body).sort()) === J(['action', 'ends', 'room', 'starts']) && ck.body.room === 'ห้องเล็ก1' && ck.body.starts === day(20) + 'T10:00:00+07:00'
    && J(Object.keys(up.body).sort()) === J(['action', 'session_id']) && up.body.session_id === made.id, J([ck.body, up.body]));
  ok('นัดฐานส่งห้องเดียวกัน · ข้อความเขียว "นัดรอบเรียนแล้ว ✓ · ลงปฏิทินแล้ว ✓" · ไม่มีคำเตือน', sc.p_room === 'ห้องเล็ก1' && /นัดรอบเรียนแล้ว ✓ · ลงปฏิทินแล้ว ✓/.test(detOk()) && !E('teDetWarn'), detOk());
  ok('รอบขึ้น "ผูกปฏิทินแล้ว ✓" · ไม่มีปุ่ม "ลงปฏิทิน" (ผูกแล้ว)', /ผูกปฏิทินแล้ว ✓/.test(ss(made.id).textContent) && !ss(made.id).querySelector('[data-act="cal-sync"]'));
  ok('ฐานปลอมมี event เดียวของรอบนี้ (id คงที่ djlab…)', TEACH.cal.events.length === 1 && TEACH.cal.events[0].session === made.id && /^djlab/.test(TEACH.cal.events[0].id));

  // ── 3. ห้องชน: ไม่สร้างนัดเลย ──
  TEACH.cal.busy.push({ room: 'ห้องเล็ก2', start: day(21) + 'T09:30:00+07:00', end: day(21) + 'T11:30:00+07:00' });
  const nS = rpcCalls('teach_session_schedule').length, nSess = TEACH.sessions.length, nUp = FNA('upsert').length;
  await schedRoom(21, 'ห้องเล็ก2');
  ok('ห้องชนนัดในปฏิทิน: แถบแดงตัวหนาข้อความไทย "ไม่ว่าง" · ไม่เรียก teach_session_schedule · ไม่มีรอบเกิดในฐาน · ไม่เรียก upsert',
    isRed(E('teDetErr')) && /ไม่ว่าง/.test(detErr()) && rpcCalls('teach_session_schedule').length === nS && TEACH.sessions.length === nSess && FNA('upsert').length === nUp, detErr());
  ok('ฟอร์มยังเปิดค้างให้แก้เวลา/ห้อง', !!E('teFormSched'));
  dact('close-form'); await settle(100);
  await schedRoom(21, 'ห้องเล็ก2', '13:00', '15:00');
  ok('เปลี่ยนเวลาให้ไม่ชน → นัดและลงปฏิทินสำเร็จ', /ลงปฏิทินแล้ว ✓/.test(detOk()) && TEACH.cal.events.length === 2, detOk());

  // ── 4. ไม่ระบุห้อง = ลงฐานอย่างเดียว ──
  const nF = FNC().length;
  await schedRoom(22, '');
  ok('ไม่ระบุห้อง: ไม่เรียก gcal-sync เลย · นัดฐานสำเร็จ · ข้อความไม่พูดถึงปฏิทิน', FNC().length === nF && /นัดรอบเรียนแล้ว ✓/.test(detOk()) && !/ลงปฏิทิน/.test(detOk()) && !/ปฏิทิน/.test(detWarn()), detOk() + ' | ' + detWarn());

  // ── 5. ปฏิทินยังไม่ตั้งค่า (ขาด secret) → ถอยกลับลงฐานอย่างเดียว ไม่ขวางนัด ──
  TEACH.cal.mode = 'not_configured';
  const nUp2 = FNA('upsert').length;
  await schedRoom(23, 'ห้องใหญ่');
  const ncs = sessByStart(23, '10:00');
  ok('ยังไม่ตั้งค่าปฏิทิน: นัดฐานสำเร็จ · ไม่เรียก upsert · แถบแดงตัวหนา "ยังไม่ได้ลงปฏิทิน — ระบบปฏิทินยังไม่พร้อม"',
    !!ncs && FNA('upsert').length === nUp2 && isRed(D().querySelector('#teDetWarn .wk-red')) && /ยังไม่ได้ลงปฏิทิน — ระบบปฏิทินยังไม่พร้อม/.test(detWarn()), detWarn());
  ok('รอบนั้นขึ้นปุ่ม "ลงปฏิทิน" (ลองภายหลัง) + "ยังไม่ผูกปฏิทิน"', !!ss(ncs.id).querySelector('[data-act="cal-sync"]') && /ยังไม่ผูกปฏิทิน/.test(ss(ncs.id).textContent));
  TEACH.cal.mode = 'throw';
  await schedRoom(24, 'ห้องใหญ่');
  ok('ติดต่อฟังก์ชันไม่ได้ (เน็ต/ล่ม): ก็ลงฐานอย่างเดียว + แถบแดง ไม่ error ดิบ', !!sessByStart(24, '10:00') && /ยังไม่ได้ลงปฏิทิน/.test(detWarn()) && !/boom/.test(dt()), detWarn());
  TEACH.cal.mode = 'ok';

  // ── 6. ลงปฏิทินล้มหลังสร้างนัด → แดง + ปุ่มลองอีกครั้ง ──
  TEACH.cal.failUpsert = 'google_busy';
  await schedRoom(25, 'ห้องเล็ก1');
  const fs1 = sessByStart(25, '10:00');
  ok('ลงปฏิทินล้ม: นัดฐานอยู่ · แถบแดงตัวหนา "นัดบันทึกแล้ว แต่ลงปฏิทินไม่สำเร็จ" + เหตุผลไทย + "กดปุ่ม ลงปฏิทิน"',
    !!fs1 && isRed(D().querySelector('#teDetWarn .wk-red')) && /นัดบันทึกแล้ว แต่ลงปฏิทินไม่สำเร็จ/.test(detWarn()) && /กดปุ่ม "ลงปฏิทิน"/.test(detWarn()) && /ขัดข้องชั่วคราว/.test(detWarn()), detWarn());
  ok('รอบนั้นมีปุ่ม "ลงปฏิทิน" (≥ 44px บน touch ตามปุ่มเล็กทั่วไป) · ยังไม่ผูก', !!ss(fs1.id).querySelector('[data-act="cal-sync"]'));
  const evBefore = TEACH.cal.events.length;
  dact('cal-sync', '[data-sid="' + fs1.id + '"]'); await settle(600);
  ok('กดซ้ำตอนยังล้ม: แถบแดงบอกเหตุผล (ไม่เงียบ) · ไม่มี event เพิ่ม', /ขัดข้องชั่วคราว/.test(detErr()) && TEACH.cal.events.length === evBefore, detErr());
  TEACH.cal.failUpsert = null;
  dact('cal-sync', '[data-sid="' + fs1.id + '"]'); await settle(600);
  ok('กดลองอีกครั้งหลัง Google กลับมา: สำเร็จ "ลงปฏิทินแล้ว ✓" · ผูกแล้ว · ปุ่มหาย · event เพิ่มเดียว', /ลงปฏิทินแล้ว ✓/.test(detOk()) && /ผูกปฏิทินแล้ว ✓/.test(ss(fs1.id).textContent) && !ss(fs1.id).querySelector('[data-act="cal-sync"]') && TEACH.cal.events.length === evBefore + 1, detOk());
  // ── 7. ยกเลิกรอบ → ลบ event ตาม ──
  const nRm = FNA('remove').length;
  openForm('cancel', fs1.id); await settle(100);
  dfill('by', 'teacher');
  submit('cancel'); await settle(700);
  const rm = FNA('remove')[nRm];
  ok('ยกเลิกรอบที่ลงปฏิทินแล้ว: เรียก remove ด้วย session_id เดียว (ไม่ส่งอย่างอื่น) · ข้อความ "ลบนัดในปฏิทินแล้ว ✓" · event หาย · ลิงก์ถูกถอด',
    !!rm && J(Object.keys(rm.body).sort()) === J(['action', 'session_id']) && rm.body.session_id === fs1.id && /ลบนัดในปฏิทินแล้ว ✓/.test(detOk())
    && !TEACH.cal.events.some(e => e.session === fs1.id) && TEACH.sessions.find(x => x.id === fs1.id).gcal_uid === null, detOk());
  ok('ไม่มีแถบเตือน/ปุ่มค้างบนรอบที่ยกเลิก', !E('teDetWarn') && !ss(fs1.id).querySelector('[data-act="cal-remove"]') && !/ค้างในปฏิทิน/.test(ss(fs1.id).textContent));

  // ── 8. ยกเลิกรอบที่ผูกกับนัดจาก Discord (ไม่ใช่ของระบบ) → ไม่ลบ บอกให้ลบเอง ──
  openForm('cancel', 's1'); await settle(100);
  dfill('by', 'teacher');
  submit('cancel'); await settle(700);
  ok('ผูกกับนัดภายนอก (uid-1): ยกเลิกรอบแล้ว แต่ไม่ลบนัด · แถบแดงตัวหนา "ระบบไม่ลบให้ — ลบเองในปฏิทิน"', isRed(D().querySelector('#teDetWarn .wk-red')) && /ลบเองในปฏิทิน/.test(detWarn())
    && TEACH.sessions.find(x => x.id === 's1').gcal_uid === 'uid-1', detWarn());
  ok('รอบนั้นขึ้น "นัดนี้ยังค้างในปฏิทิน" แดงตัวหนา + ปุ่ม "ลบนัดในปฏิทิน"', isRed(ss('s1').querySelector('[data-cal="stale"]')) && !!ss('s1').querySelector('[data-act="cal-remove"]'));
  dact('cal-remove', '[data-sid="s1"]'); await settle(600);
  ok('กดลบซ้ำ: บอกว่าไม่มีนัดที่ระบบสร้างให้ลบ + แถบแดงบอกให้ลบเอง · ลิงก์เดิมยังอยู่', /ไม่มีนัดที่ระบบสร้างให้ลบ/.test(detOk()) && /ลบเองในปฏิทิน/.test(detWarn()) && TEACH.sessions.find(x => x.id === 's1').gcal_uid === 'uid-1');

  // ── 9. ลบ event ล้ม → แดง + ปุ่มลองอีกครั้ง ──
  await schedRoom(26, 'ห้องเล็ก2');
  const rs = sessByStart(26, '10:00');
  TEACH.cal.failRemove = 'google_busy';
  openForm('cancel', rs.id); await settle(100);
  dfill('by', 'shop');
  submit('cancel'); await settle(700);
  ok('ลบ event ล้ม: ยกเลิกรอบแล้ว · แถบแดงตัวหนา "ยกเลิกรอบแล้ว แต่ลบนัดในปฏิทินไม่สำเร็จ" + ปุ่ม "ลบนัดในปฏิทิน" · ลิงก์ยังอยู่ (ลองใหม่ได้)',
    TEACH.sessions.find(x => x.id === rs.id).status === 'cancelled' && isRed(D().querySelector('#teDetWarn .wk-red')) && /ยกเลิกรอบแล้ว แต่ลบนัดในปฏิทินไม่สำเร็จ/.test(detWarn())
    && !!ss(rs.id).querySelector('[data-act="cal-remove"]') && !!TEACH.sessions.find(x => x.id === rs.id).gcal_uid, detWarn());
  TEACH.cal.failRemove = null;
  dact('cal-remove', '[data-sid="' + rs.id + '"]'); await settle(600);
  ok('ลองอีกครั้ง: ลบสำเร็จ · ถอดลิงก์ · ปุ่มหาย', /ลบนัดในปฏิทินแล้ว ✓/.test(detOk()) && TEACH.sessions.find(x => x.id === rs.id).gcal_uid === null && !ss(rs.id).querySelector('[data-act="cal-remove"]'), detOk());

  // ── 10. ชนตอน upsert (แข่งกัน): นัดบันทึกแล้ว + แดงชัด + ยกเลิกรอบได้ ──
  TEACH.cal.raceConflict = true;
  await schedRoom(27, 'ห้องใหญ่');
  const rc = sessByStart(27, '10:00');
  ok('ห้องชนตอนลงปฏิทิน (มีคนแทรกระหว่างสองจังหวะ): นัดอยู่ในฐาน · แถบแดงตัวหนา "ลงปฏิทินไม่สำเร็จ" บอก "ไม่ว่าง" · ปุ่มลองใหม่',
    !!rc && isRed(D().querySelector('#teDetWarn .wk-red')) && /นัดบันทึกแล้ว แต่ลงปฏิทินไม่สำเร็จ/.test(detWarn()) && /ไม่ว่าง/.test(detWarn()) && !!ss(rc.id).querySelector('[data-act="cal-sync"]'), detWarn());
  const nRm2 = FNA('remove').length;
  openForm('cancel', rc.id); await settle(100);
  dfill('by', 'shop');
  submit('cancel'); await settle(700);
  ok('ยกเลิกรอบที่ลงปฏิทินไม่ได้ได้ตามปกติ · ไม่เรียก remove (ไม่มีลิงก์)', TEACH.sessions.find(x => x.id === rc.id).status === 'cancelled' && FNA('remove').length === nRm2 && /ยกเลิกรอบแล้ว/.test(detOk()), detOk());
  TEACH.cal.raceConflict = false;

  // ── 11. สิทธิ์/ไม่ดึงข้อมูลนักเรียนไปปฏิทิน ──
  ok('คำขอทุกครั้งไปยัง gcal-sync ไม่มีชื่อนักเรียน/เบอร์/ราคา/ยอดชำระ', !/สมชาย|08\d{8}|price|amount|20000/.test(J(FNC().map(c => c.body))));
  ok('คำสั่งที่ส่งมีแค่ check · upsert · remove', FNC().every(c => ['check', 'upsert', 'remove'].includes(c.body.action)));
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

const mock = MOCK3 + '\n' + TEACH_MOCK;
let allOk = true;
for (const [label, tests, opts] of [
  ['1 เจ้าของ: แผง · เงิน', T1, { width: 1366, height: 900, coarse: false }],
  ['2 เจ้าของ: รอบเรียน', T2, { width: 1366, height: 900, coarse: false }],
  ['3 เจ้าของ: แก้ · ปิด · ขยายอายุ', T3, { width: 1366, height: 900, coarse: false }],
  ['4 พนักงานที่ไม่ใช่ครู', T4, { width: 1366, height: 900, coarse: false }],
  ['5 ครู + ผู้ดูแล', T5, { width: 1366, height: 900, coarse: false }],
  ['6 แท็บรอบเรียน · realtime · ความปลอดภัย', T6, { width: 1366, height: 900, coarse: false }],
  ['7 iPhone 390×844', T7, { width: 390, height: 844, coarse: true }],
  ['8 นัดสอนที่เดียว: ลงฐาน + Google Calendar (063)', T8, { width: 1366, height: 900, coarse: false }],
]) {
  if (ONLY && !ONLY.test(label)) continue;
  console.log('\n--- ' + label + ' ---');
  const res = await runCdpPage({ root: pageRoot, file: 'desk.html', mock, tests, hash: '', shotDir: SHOTS, ...opts });
  if (!res.ok) allOk = false;
}
// ── ห้องที่ลงปฏิทินได้ในหน้าจอ = ฟังก์ชัน gcal-sync = บอท /schedule (ตัวอักษรต่อตัวอักษร) ──
if (!ONLY) {
  const lit = (src, re) => { const m = src.match(re); return m ? JSON.stringify(eval(m[1])) : null; };
  const desk = readFileSync(join(pageRoot, 'desk.html'), 'utf8'), tch = readFileSync(join(pageRoot, 'teacher.html'), 'utf8');
  const fnPath = join(root, '../stock-app/supabase/functions/gcal-sync/index.ts');
  const botIdx = join(root, '../../bots/bot/index.js'), botCal = join(root, '../../bots/bot/roomsync/calendar.js');
  const dRooms = lit(desk, /^const TE_ROOMS = (\[[^\]]*\]);/m), tRooms = lit(tch, /^const CAL_ROOMS = (\[[^\]]*\]);/m);
  let ok1 = !!dRooms && dRooms === tRooms, why = 'desk=' + dRooms + ' teacher=' + tRooms;
  if (existsSync(fnPath)) {
    const fn = readFileSync(fnPath, 'utf8');
    const fr = lit(fn, /^export const ROOMS = (\[[^\]]*\]);/m), fp = (fn.match(/^export const ROOM_PRACTICE = '([^']*)'/m) || [])[1];
    ok1 = ok1 && JSON.stringify([...JSON.parse(fr), fp]) === dRooms; why += ' fn=' + fr + '+' + fp;
  }
  if (existsSync(botIdx) && existsSync(botCal)) {
    const br = lit(readFileSync(botIdx, 'utf8'), /^const ROOMS = (\[[^\]]*\]);/m), bp = (readFileSync(botCal, 'utf8').match(/^const ROOM_PRACTICE = '([^']*)'/m) || [])[1];
    ok1 = ok1 && JSON.stringify([...JSON.parse(br), bp]) === dRooms; why += ' bot=' + br + '+' + bp;
  }
  console.log('\n' + (ok1 ? '  [PASS] ' : '  [FAIL] ') + 'รายชื่อห้องที่ลงปฏิทินได้ตรงกันทั้ง desk.html · teacher.html · gcal-sync · บอท /schedule' + (ok1 ? '' : ' — ' + why));
  if (!ok1) allOk = false;
}
console.log('\n=== desk-teach-detail: ' + (allOk ? 'ผ่าน' : 'ไม่ผ่านหรือไม่ได้รันจนจบ') + ' ===');
process.exit(allOk ? 0 : 1);
