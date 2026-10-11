/**
 * เทสต์หมวด "คอร์สเรียน" ของ desk.html (#teach · Alt+L · migration 047) — ก้อน A: อ่านอย่างเดียว
 *   รัน: node tests/desk-teach.mjs
 *   ถ่ายภาพ: TEACH_SHOTS=<โฟลเดอร์> node tests/desk-teach.mjs
 *
 * ตัวรัน CDP เดียวกับ desk-worklist · ฐานข้อมูลปลอมอยู่ที่ tests/lib/teach-mock.mjs · ชุดตรวจของ SQL ตัวจริงอยู่ที่ console-workspace/sql-tests/test047.mjs
 * ที่นี่ตรวจฝั่งหน้าจอ: ใครเห็นเมนู/ตัวกรอง · ตัวเลขการ์ดสรุป · แต่ละแท็บแสดงถูกกลุ่ม · แดงตัวหนาเมื่อใกล้หมดอายุ/หมดอายุ · ไม่วาดเงิน ·
 *   ข้อความผู้ใช้เป็นข้อความ (XSS) · ล้างหน้าตอนออกจากระบบ/สลับบัญชี · ผลที่มาช้าถูกทิ้ง · Realtime + เก็บตก · ยังไม่รัน 047 · โหลดล้ม ·
 *   บัญชีครูล้วน (ไม่มีแถว admins) เปิดคอนโซลแล้วไม่พัง + บอกชัดว่ายังไม่มีหน้าจอ · iPhone เรียงเป็นการ์ด
 *
 *  1. เมนู/สิทธิ์ (พนักงานที่ไม่ใช่ครู · ผู้ดูแล · เจ้าของที่เป็นครู · พนักงานที่เป็นครู)
 *  2. แท็บสรุป · รอคิว · กำลังเรียน · หมดอายุ/จบ + ตัวกรอง "ทุกคน/ของฉัน" + ค้นหา
 *  3. ความปลอดภัยของข้อมูลที่แสดง (ไม่มีเงิน · XSS · ฟอนต์ ≥ 14px)
 *  4. ออกจากระบบ/สลับบัญชี · ผลโหลดช้า · Realtime · ยังไม่รัน 047 · โหลดล้ม
 *  5. บัญชีครูล้วน / บัญชีไม่มีสิทธิ์
 *  6. iPhone (390px)
 */

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { HARNESS } from './lib/page-test.mjs';
import { runCdpPage } from './lib/cdp-page.mjs';
import { TEACH_MOCK } from './lib/teach-mock.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { MOCK: MOCK3 } = await import(pathToFileURL(join(root, 'tests/desk-home3.mjs')).href);
const SHOTS = process.env.TEACH_SHOTS || null;
const pageRoot = process.env.TEACH_ROOT || root;   // ทดสอบหน้าฉบับอื่น (mutation) ได้
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const COMMON = `
${HARNESS}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);
const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
async function login(name) {
  $('loginEmail').value = name + '@x';
  $('loginPassword').value = 'x';
  await doLogin();
  await sleep(500);
}
async function logout() { await db.auth.signOut(); await sleep(400); }
async function shot(name) {
  await frames(); await sleep(150);
  await new Promise(r => { window.__shot = r; console.log('[SHOT] ' + name); });
}
const isRed = el => !!el && getComputedStyle(el).color === 'rgb(204, 0, 26)' && Number(getComputedStyle(el).fontWeight) >= 600;      // --red #CC001A ตัวหนา
const body = () => $('teBody');
const rowIds = (root) => [...(root || body()).querySelectorAll('.te-row[data-id]')].map(e => e.dataset.id);
const groups = () => [...body().querySelectorAll('.wk-group')].map(g => ({ title: g.querySelector('h3 > span').firstChild.textContent.trim(), ids: [...g.querySelectorAll('.te-row[data-id]')].map(e => e.dataset.id) }));
const tab = n => { document.querySelector('#teTabs .mail-tab[data-tab="' + n + '"]').click(); };
const row = id => body().querySelector('.te-row[data-id="' + id + '"]');
const stat = i => body().querySelectorAll('.stats .stat')[i];
const statVal = i => stat(i).querySelector('.stat-value').textContent;
const setSearch = v => { const e = $('teSearch'); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
const altKey = code => document.dispatchEvent(new KeyboardEvent('keydown', { code: code, key: code.replace('Key', '').toLowerCase(), altKey: true, bubbles: true, cancelable: true }));
const fatalText = () => (document.getElementById('fatalError') || {}).textContent || '';
const navItem = () => document.querySelector('#navList .nav-item[data-s="teach"]');
const ALL10 = ['e-active', 'e-soon', 'e-month', 'e-queued', 'e-wait', 'e-expired', 'e-backfill', 'e-done', 'e-closed', 'e-xss'];
async function open() { showSection('teach'); await sleep(500); }
`;

const TESTS_MAIN = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== คอร์สเรียน (#teach · ก้อน A อ่านอย่างเดียว) ===');
  TEACH.seed();

  // ── 1. พนักงานที่ไม่ใช่ครู (Zen) ───────────────────────────────────────────
  await login('Zen');
  ok('เมนู "คอร์สเรียน" ขึ้นในกลุ่มใหม่ "การสอน"', !!navItem() && navItem().closest('.nav-group').querySelector('.nav-group-title').textContent === 'การสอน'
    && navItem().querySelector('.lbl').textContent === 'คอร์สเรียน', navItem() && navItem().textContent);
  ok('คีย์ลัด Alt+L แสดงข้างเมนู', navItem().querySelector('.kbd').textContent === 'Alt+L');
  ok('พนักงานทุกคนเห็นเมนูนี้ (ไม่ใช่เมนูเฉพาะผู้ดูแล)', !!navItem());
  altKey('KeyL'); await sleep(500);
  ok('Alt+L เปิดหมวดคอร์สเรียน (hash #teach · หัวหน้าจอ)', current === 'teach' && location.hash === '#teach' && $('pageTitle').textContent === 'คอร์สเรียน', current + ' ' + location.hash);
  ok('โหลดจาก view enrollment_overview (select *) ไม่ใช่ตารางเงิน', CALLS.some(c => c.table === 'enrollment_overview' && c.op === 'select')
    && !CALLS.some(c => /^enrollment_(money|payments)$/.test(c.table || '')), CALLS.map(c => c.table).join());
  ok('ไม่เรียกฟังก์ชัน/ตารางสลิป (ปิดไว้หลัง feature flag)', !CALLS.some(c => /course-slips|teach_slip/.test(JSON.stringify(c))) && TE_SLIPS_ENABLED === false);
  ok('พนักงานที่ไม่ใช่ครู: ไม่มีตัวกรอง "ทุกคน/ของฉัน"', $('teWho').hidden === true);
  ok('แท็บเริ่มที่ "สรุป" · แท็บมี 6 อัน: สรุป รอคิว กำลังเรียน รอบเรียน หมดอายุ/จบ ลงเรียน/ย้อนหลัง', document.querySelector('#teTabs .mail-tab[aria-selected="true"]').dataset.tab === 'summary'
    && [...document.querySelectorAll('#teTabs .mail-tab')].map(b => b.dataset.tab).join() === 'summary,queue,active,sessions,ended,enroll');
  ok('ไม่มีแท็บ "ค่าสอน" (เลื่อนไป 048)', !/ค่าสอน/.test($('teTabs').textContent));

  // ── 2. สรุป ───────────────────────────────────────────────────────────────
  ok('การ์ดสรุป: กำลังเรียน 5 · รอคิว 1 · ใกล้หมดอายุ/หมดอายุ 3 · รอบเรียนใน 7 วัน 2', [0, 1, 2, 3].map(statVal).join() === '5,1,3,2', [0, 1, 2, 3].map(statVal).join());
  ok('การ์ด "ใกล้หมดอายุ/หมดอายุแล้ว" เป็นแดงตัวหนา (มีตัวเลข > 0 · มีคำกำกับ)', isRed(stat(2).querySelector('.stat-value')) && /หมดอายุ/.test(stat(2).textContent));
  ok('พนักงานไม่เห็นป้าย "คำขอขยายอายุรอตัดสิน" (เห็นเฉพาะเจ้าของ)', !/คำขอขยายอายุ/.test(body().textContent));
  const g0 = groups();
  ok('สรุป: กลุ่ม "ใกล้หมดอายุ" มี e-expired · e-soon (5 วัน) · e-month (25 วัน) เรียงตามวันหมดอายุ (หมดแล้วขึ้นก่อน)', g0[0].ids.join() === 'e-expired,e-soon,e-month', g0[0].ids.join());
  ok('สรุป: รอบเรียนที่จะถึงมี 2 รอบ (เกิน 7 วันไม่ขึ้น)', body().querySelectorAll('.te-srow').length === 2);
  ok('รอบเรียนบอกว่าผูกปฏิทินแล้ว/ยัง', /ผูกปฏิทินแล้ว ✓/.test(body().textContent) && /ยังไม่ผูกปฏิทิน/.test(body().textContent));
  ok('รอบเรียนบอกห้อง', /ห้องใหญ่/.test(body().textContent) && /ห้องเล็ก 1/.test(body().textContent));
  await shot('01-summary');

  // ── แท็บรอคิว ──
  tab('queue'); await sleep(100);
  const gq = groups();
  ok('รอคิว: กลุ่ม "รอคิว" มี e-queued · กลุ่ม "รอชำระ" มี e-wait', gq.length === 2 && gq[0].ids.join() === 'e-queued' && gq[1].ids.join() === 'e-wait', J(gq));
  ok('ตัวเลขข้างแท็บรอคิว = รอคิว + รอชำระ = 2', $('teQueueN').textContent === '2', $('teQueueN').textContent);
  const eq = row('e-queued'), ew = row('e-wait');
  ok('รอคิว: ป้าย ✓ ชำระครบ + บันทึก 1 งวด (ตัวเลขล้วน ไม่มียอด)', /✓ ชำระครบ/.test(eq.textContent) && /บันทึก 1 งวด/.test(eq.textContent));
  ok('รอชำระ: ป้าย "ยังไม่ครบ"', /ยังไม่ครบ/.test(ew.textContent));
  ok('ยังไม่เริ่มเรียน: วันหมดอายุเป็น "ยังไม่เริ่มเรียน" ไม่ใช่วันที่', /ยังไม่เริ่มเรียน/.test(eq.textContent));

  // ── แท็บกำลังเรียน ──
  tab('active'); await sleep(100);
  const ga = groups();
  ok('กำลังเรียน: 5 คน เรียงใกล้หมดอายุก่อน', ga[0].ids.join() === 'e-soon,e-month,e-active,e-backfill,e-xss', J(ga));
  ok('ใกล้หมดอายุ (≤ 14 วัน): แดงตัวหนา + คำ "ใกล้หมดอายุ (5 วัน)"', isRed(row('e-soon').querySelector('.wk-red')) && /ใกล้หมดอายุ \\(5 วัน\\)/.test(row('e-soon').textContent), row('e-soon').textContent);
  ok('หมดอายุอีก 25 วัน: ไม่แดง', !row('e-month').querySelector('.wk-red') && !/ใกล้หมดอายุ/.test(row('e-month').textContent));
  ok('แถบ/ตัวเลข "เรียนแล้ว x/y" ตัวเลขเสมอ (3/6)', /3\\/6/.test(row('e-active').textContent) && row('e-active').querySelector('.te-prog i').style.width === '50%');
  ok('แถบความคืบหน้าวัดจากสิทธิ์ที่ใช้ไป (3/6 = 50%) ไม่ใช่เรียนจริง (2/6)', row('e-month').querySelector('.te-prog i').style.width === '50%');
  ok('นับใช้สิทธิ์แยกจากเรียนจริง: e-month เรียนจริง 2 ใช้สิทธิ์ 3', /2\\/6/.test(row('e-month').textContent) && /ใช้สิทธิ์ 3 ครั้ง/.test(row('e-month').textContent));
  ok('ครั้งถัดไปแสดงวัน/เวลา (เวลาไทย)', /14:00/.test(row('e-active').textContent));
  const bf = row('e-backfill');
  ok('กรอกย้อนหลัง: ป้าย "ข้อมูลอาจไม่ครบ" · "ชำระครบ (ไม่ทราบวันที่)" · ผู้เยาว์ · ชื่อเล่น · สอนภาษาอังกฤษ',
    /กรอกย้อนหลัง · ข้อมูลอาจไม่ครบ/.test(bf.textContent) && /ชำระครบ \\(ไม่ทราบวันที่\\)/.test(bf.textContent) && /ผู้เยาว์/.test(bf.textContent)
    && /ชื่อเล่น น้องดาว/.test(bf.textContent) && /สอนภาษาอังกฤษ/.test(bf.textContent), bf.textContent);
  ok('กรอกย้อนหลังที่ไม่มีงวด: ไม่ขึ้น "บันทึก 0 งวด"', !/บันทึก 0 งวด/.test(bf.textContent));
  ok('ขยายอายุ/หมดอายุที่นี่ไม่มีเลขเงิน: ไม่มี ฿ · บาท · ยอด', !/฿|บาท|ยอดชำระ|price/.test(body().textContent));
  await shot('02-active');

  // ── แท็บหมดอายุ/จบ ──
  tab('ended'); await sleep(100);
  const ge = groups();
  ok('หมดอายุ/จบ: e-closed · e-done · e-expired (ใหม่สุดก่อน)', ge[0].ids.length === 3 && ge[0].ids.slice().sort().join() === 'e-closed,e-done,e-expired', J(ge));
  ok('หมดอายุแล้วยังเหลือครั้ง: แดงตัวหนา "หมดอายุแล้ว เหลือ 2 ครั้ง"', isRed(row('e-expired').querySelector('.wk-red')) && /หมดอายุแล้ว เหลือ 2 ครั้ง/.test(row('e-expired').textContent));
  ok('จบ (ใช้สิทธิ์ครบ): ป้ายสถานะ + เรียนจริง 5/6 แต่ใช้สิทธิ์ 6', /จบ \\(ใช้สิทธิ์ครบ\\)/.test(row('e-done').textContent) && /ใช้สิทธิ์ 6 ครั้ง/.test(row('e-done').textContent));
  ok('ปิดแล้ว: บอกเหตุผล (คืนเงิน)', /ปิดแล้ว · คืนเงิน/.test(row('e-closed').textContent));

  // ── ค้นหา + ตัวกรอง ──
  tab('active'); await sleep(50);
  setSearch('nutty'); await sleep(50);
  ok('ค้นหาชื่อครู (ไม่สนตัวพิมพ์): เหลือ e-soon · e-backfill', groups()[0].ids.join() === 'e-soon,e-backfill', J(groups()));
  setSearch('น้องดาว'); await sleep(50);
  ok('ค้นหาชื่อเล่น: เจอ e-backfill', groups()[0].ids.join() === 'e-backfill');
  setSearch('สมชาย'); await sleep(50);
  ok('ค้นหาชื่อนักเรียน: เจอ e-active', groups()[0].ids.join() === 'e-active');
  setSearch('ไม่มีคนนี้'); await sleep(50);
  ok('ค้นแล้วไม่เจอ: ขึ้นข้อความว่าง ไม่ใช่หน้าว่าง', /ไม่มีนักเรียนที่กำลังเรียน/.test(body().textContent));
  setSearch(''); await sleep(50);
  ok('ล้างช่องค้นหา: กลับมาครบ 5 คน', groups()[0].ids.length === 5);

  // ── 3. ความปลอดภัยของข้อมูลที่แสดง ─────────────────────────────────────────
  const xr = row('e-xss');
  ok('ชื่อ/คอร์ส/ครูที่เป็น HTML แสดงเป็นข้อความ ไม่ถูกแปลเป็นแท็ก (XSS)', !!xr && !xr.querySelector('img, b') && [...xr.querySelectorAll('i')].every(i => i.parentElement.classList.contains('te-prog')) && /<img src=x/.test(xr.textContent) && /<b onmouseover/.test(xr.textContent) && !window.__xss, xr && xr.innerHTML);
  const small = [...body().querySelectorAll('.te-row *')].filter(e => e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 14);
  ok('ตัวหนังสือทุกชิ้นในรายการ ≥ 14px', small.length === 0, small.slice(0, 3).map(e => e.textContent + ':' + getComputedStyle(e).fontSize).join('|'));
  ok('แท็บสูง ≥ 44px', [...document.querySelectorAll('#teTabs .mail-tab')].every(e => e.getBoundingClientRect().height >= 44));

  // ── 4. เจ้าของที่เป็นครู (TiBass) ──────────────────────────────────────────
  await logout();
  ok('ออกจากระบบ: รายการนักเรียนถูกล้างออกจากหน้า (DOM ไม่ใช่แค่ซ่อน)', rowIds().length === 0 && !/สมชาย|มานี|วีระ/.test(document.getElementById('sec-teach').textContent), document.getElementById('sec-teach').textContent.slice(0, 80));
  ok('ออกจากระบบ: ช่องค้นหาถูกล้าง · แท็บกลับ "สรุป"', $('teSearch').value === '' && document.querySelector('#teTabs .mail-tab[aria-selected="true"]').dataset.tab === 'summary');
  await login('TiBass');
  await open();
  ok('เจ้าของที่เป็นครู: เห็นตัวกรอง "ทุกคน/ของฉัน" · ตั้งต้น "ทุกคน"', $('teWho').hidden === false && $('teWho').querySelector('[aria-pressed="true"]').dataset.who === 'all');
  ok('เจ้าของเห็นป้ายคำขอขยายอายุรอตัดสิน 2 ใบ (แดงตัวหนา)', /คำขอขยายอายุรอตัดสิน 2 ใบ/.test(body().textContent) && isRed(body().querySelector('.alert.wk-red')));
  $('teWho').querySelector('[data-who="mine"]').click(); await sleep(80);
  ok('"ของฉัน": การ์ดนับเฉพาะนักเรียนของครู Tibass (กำลังเรียน 1 · รอคิว 0 · ใกล้หมดอายุ 0 · รอบ 1)', [0, 1, 2, 3].map(statVal).join() === '1,0,0,1', [0, 1, 2, 3].map(statVal).join());
  tab('queue'); await sleep(50);
  ok('"ของฉัน" แท็บรอคิว: เหลือเฉพาะ e-wait ของ Tibass (ไม่มี e-queued ของ Nutty)', groups()[0].ids.length === 0 && groups()[1].ids.join() === 'e-wait', J(groups()));
  $('teWho').querySelector('[data-who="all"]').click(); await sleep(80);
  ok('กลับ "ทุกคน": ครบอีกครั้ง', groups()[0].ids.join() === 'e-queued');

  // ── พนักงานที่เป็นครู (Nutty): ตั้งต้น "ของฉัน" ──
  await logout();
  await login('Nutty');
  await open();
  ok('พนักงานที่เป็นครู: ตั้งต้น "ของฉัน" · เห็นตัวกรอง', $('teWho').hidden === false && $('teWho').querySelector('[aria-pressed="true"]').dataset.who === 'mine');
  tab('active'); await sleep(50);
  ok('Nutty "ของฉัน" กำลังเรียน: e-soon · e-backfill (ไม่เห็นของครูคนอื่น)', groups()[0].ids.join() === 'e-soon,e-backfill', J(groups()));
  $('teWho').querySelector('[data-who="all"]').click(); await sleep(80);
  ok('Nutty สลับเป็น "ทุกคน": เห็นครบ 5 คน', groups()[0].ids.length === 5);
  tab('summary'); await sleep(50);
  ok('Nutty (พนักงาน): สรุปไม่มีป้ายคำขอขยายอายุ', !/คำขอขยายอายุรอตัดสิน/.test(body().textContent));

  // ผู้ดูแล (Nui): ไม่ใช่ครู · ไม่เห็นป้ายคำขอ (เจ้าของเท่านั้น)
  await logout();
  await login('Nui');
  await open();
  ok('ผู้ดูแล: ไม่มีตัวกรอง (ไม่ใช่ครู) · ไม่เห็นคำขอขยายอายุ (เจ้าของตัดสินคนเดียว)', $('teWho').hidden === true && !/คำขอขยายอายุรอตัดสิน/.test(body().textContent));

  // ── 5. ผลโหลดช้าตอนสลับบัญชี ถูกทิ้ง ─────────────────────────────────────────
  await logout();
  let release;
  TEACH.gate = new Promise(r => { release = r; });
  await login('Zen');
  showSection('teach'); await sleep(200);
  ok('โหลดค้างอยู่: ขึ้นข้อความกำลังโหลด (ยังไม่มีแถว)', /กำลังโหลด/.test(body().textContent) && rowIds().length === 0);
  await logout();
  TEACH.gate = null;                           // คำขอใหม่ไม่ค้าง
  await login('Nui');
  await open();
  tab('active'); await sleep(50);
  const before = groups()[0].ids.join();
  TEACH.rows = [Object.assign({}, TEACH.rows[0], { id: 'e-late', customer_id: 'c11' })];       // คำตอบที่มาช้า (ของ Zen) จะได้แถวนี้
  release(); await sleep(400);
  ok('ผลของคนก่อนที่มาช้าหลังสลับบัญชี ถูกทิ้ง (ไม่ทับหน้าของคนปัจจุบัน)', groups()[0].ids.join() === before && !rowIds().includes('e-late') && before.indexOf('e-active') >= 0, groups()[0].ids.join());

  // ── Realtime + เก็บตก ──
  TEACH.seed();
  await logout();
  await login('TiBass');
  await open();
  const rt = TEACH.subs.filter(s => s.name === 'desk-teach').map(s => s.table).sort().join();
  ok('ฟัง Realtime 4 ตารางในช่องเดียว desk-teach', rt === 'class_sessions,enrollment_extension_requests,enrollment_payments,enrollments', rt);
  ok('ช่อง desk-teach มีตัวฟังสถานะ (rtWatch)', typeof TEACH.status['desk-teach'] === 'function');
  const n0 = TEACH.loads;
  TEACH.fireRt('enrollments'); TEACH.fireRt('class_sessions'); TEACH.fireRt('enrollment_payments');
  await sleep(900);
  ok('Realtime หลายเหตุการณ์ติดกัน: โหลดใหม่รอบเดียว', TEACH.loads === n0 + 1, TEACH.loads + ' vs ' + n0);
  TEACH.rows.push(Object.assign({}, TEACH.rows[0], { id: 'e-new', customer_id: 'c11', state: 'queued' }));
  TEACH.fireRt('enrollments'); await sleep(900);
  tab('queue'); await sleep(50);
  ok('Realtime: แถวใหม่โผล่ในแท็บรอคิวโดยไม่ต้องรีเฟรช', groups()[0].ids.includes('e-new'), J(groups()));
  const n1 = TEACH.loads;
  TEACH.status['desk-teach']('CLOSED'); await sleep(50);
  TEACH.status['desk-teach']('SUBSCRIBED'); await sleep(900);
  ok('ช่องหลุดแล้วต่อใหม่ (CLOSED → SUBSCRIBED): เก็บตกโหลดใหม่ขณะอยู่หมวดนี้', TEACH.loads > n1, TEACH.loads + ' vs ' + n1);

  // ── ยังไม่รัน 047 / โหลดล้ม ──
  TEACH.missing = true;
  $('teReload').click(); await sleep(500);
  ok('ยังไม่รัน 047: แถบเหลืองบอกให้รัน (ไม่ใช่ error แดง)', !!$('teAlert').querySelector('.alert-warn') && /migration 047/.test($('teAlert').textContent) && !$('teAlert').querySelector('.alert-red'));
  ok('ยังไม่รัน 047: ไม่มีรายการ · ไม่ขึ้นแถบแดงบนจอ', rowIds().length === 0 && !fatalText());
  TEACH.missing = false;
  TEACH.fail.select = 'connection reset';
  $('teReload').click(); await sleep(500);
  ok('โหลดล้มจริง: ข้อความแดง + แถบ fatal บนจอ (กฎข้อ 8) — ไม่แสดงรายการเก่าที่ค้าง', !!$('teAlert').querySelector('.alert-red') && /connection reset/.test(fatalText()) && rowIds().length === 0, fatalText());
  TEACH.fail = {};
  $('teReload').click(); await sleep(500);
  ok('โหลดสำเร็จครั้งถัดไป: แถบแดงหายและรายการกลับมา', !$('teAlert').querySelector('.alert-red') && rowIds().length > 0);

  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
const J = o => JSON.stringify(o);
</script>`;

// บัญชีครูล้วน / บัญชีไม่มีสิทธิ์ — เข้าคอนโซลไม่ได้ ต้องไม่พังและบอกตรง ๆ
const TESTS_NOACCESS = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== คอร์สเรียน: บัญชีที่ไม่มีแถว admins ===');
  TEACH.seed();
  await login('Maniac');
  const err = $('loginError').textContent;
  ok('บัญชีครูล้วน: เปิดคอนโซลแล้วไม่พัง · ยังอยู่หน้าเข้าสู่ระบบ', $('loginOverlay').style.display !== 'none' && !fatalText(), fatalText());
  ok('ข้อความบอกชัดว่าเป็นบัญชีครู ยังไม่มีหน้าจอสำหรับครู', /บัญชีนี้เป็นบัญชีครู/.test(err) && /ยังไม่เปิดให้ใช้งาน/.test(err), err);
  ok('บัญชีครูล้วน: ไม่ได้ดึงรายการนักเรียนของร้านเลย', TEACH.loads === 0 && !CALLS.some(c => c.table === 'enrollment_overview'));
  ok('บัญชีครูล้วน: ไม่ได้เข้าระบบ (ไม่มี currentAdmin/currentUserId) · ไม่มีรายการค้างในหน้า', currentAdmin === null && currentUserId === null && rowIds().length === 0);
  ok('ถามว่าเป็นครูผ่าน my_teacher_id (ฟังก์ชันของฐาน) ไม่เดาจากชื่อ', CALLS.some(c => c.op === 'rpc' && c.fn === 'my_teacher_id'));
  await sleep(200);
  $('loginError').textContent = '';
  await login('Ghost');
  const err2 = $('loginError').textContent;
  ok('บัญชีที่ไม่ใช่ครูและไม่มีแถว admins: ข้อความเดิม "ยังไม่ได้รับสิทธิ์" (ไม่ใช่ข้อความบัญชีครู)', /ยังไม่ได้รับสิทธิ์/.test(err2) && !/บัญชีครู/.test(err2), err2);
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

// iPhone (390px): ตารางเป็นการ์ด · หัวตารางหาย · ป้ายคอลัมน์โผล่หน้าค่า
const TESTS_PHONE = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
const fillv = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
async function runTests() {
  L('=== คอร์สเรียน: iPhone ===');
  TEACH.seed();
  await login('Zen');
  await open();
  tab('active'); await sleep(100);
  const head = body().querySelector('.te-head');
  ok('iPhone: หัวตารางถูกซ่อน (เรียงเป็นการ์ด)', !head || getComputedStyle(head).display === 'none');
  const r = row('e-active');
  ok('iPhone: แถวเป็นคอลัมน์เดียว (การ์ด) ไม่ล้นจอ', getComputedStyle(r).gridTemplateColumns.split(' ').length === 1 && document.documentElement.scrollWidth <= window.innerWidth + 1,
    getComputedStyle(r).gridTemplateColumns + ' ' + document.documentElement.scrollWidth + '>' + window.innerWidth);
  ok('iPhone: ป้ายคอลัมน์โผล่หน้าค่า (คอร์ส: …)', getComputedStyle(r.querySelector('[data-l="คอร์ส"]'), '::before').content.indexOf('คอร์ส') >= 0);
  ok('iPhone: ตัวหนังสือในการ์ด ≥ 14px', [...r.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim()).every(e => parseFloat(getComputedStyle(e).fontSize) >= 14));
  ok('iPhone: แท็บ/ปุ่มรีเฟรช/ช่องค้นหาสูง ≥ 44px', [...document.querySelectorAll('#teTabs .mail-tab, #teReload, #teSearch')].every(e => e.getBoundingClientRect().height >= 44));
  await shot('10-phone-active');
  // ก้อน B บน iPhone: ฟอร์มลงเรียนเรียงลงเป็นคอลัมน์เดียว ไม่ล้นจอ ปุ่ม/ช่องกรอกสูง ≥ 44px
  tab('enroll'); await sleep(600);
  const pn = $('teEnrollBody');
  pn.querySelector('#teCands').open = true;
  pn.querySelector('[data-act="cand"][data-mid="m1"]').click(); await sleep(200);
  fillv('teCourse', 'basic-dj-class'); await sleep(200);
  ok('iPhone: ฟอร์มลงเรียนไม่ล้นจอ (ไม่มีแถบเลื่อนแนวนอน)', document.documentElement.scrollWidth <= window.innerWidth + 1, document.documentElement.scrollWidth + '>' + window.innerWidth);
  ok('iPhone: ปุ่มบันทึก · ช่องกรอก · ปุ่มเลือกโหมด สูง ≥ 44px', [...pn.querySelectorAll('#teSave, select.input, input.input, .te-seg button')].every(e => e.getBoundingClientRect().height >= 43.5),
    [...pn.querySelectorAll('#teSave, select.input, input.input, .te-seg button')].map(e => Math.round(e.getBoundingClientRect().height)).join());
  ok('iPhone: ช่องกรอกตัวหนังสือ ≥ 16px (iOS ไม่ซูมเอง)', [...pn.querySelectorAll('select.input, input.input, textarea.input')].every(e => parseFloat(getComputedStyle(e).fontSize) >= 16));
  await shot('11-phone-enroll');
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

// ก้อน B: แท็บ "ลงเรียน / ย้อนหลัง" — ค้นนักเรียน · ลงเรียนใหม่ · กรอกย้อนหลัง · ทางลัดผู้สมัคร · ปุ่มล็อกระหว่างส่ง · ข้อความผิดพลาดไม่มียอด/เบอร์
const TESTS_ENROLL = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
const day = n => { const x = new Date(TODAY + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const E = id => document.getElementById(id);
const pane = () => E('teEnrollBody');
const fill = (id, v) => { const e = E(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
const act = (a, extra) => { const b = pane().querySelector('[data-act="' + a + '"]' + (extra || '')); if (!b) throw new Error('ไม่พบปุ่ม ' + a + (extra || '')); b.click(); };
const settle = (ms) => sleep(ms || 250);
const studentCard = () => [...pane().querySelectorAll('.card .te-name')].find(e => !e.closest('#teCands')) || null;
const chk = () => { const c = pane().querySelector('[data-act="paychk"]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); };
const errText = () => (E('teFormErr') || {}).textContent || '';
const okText = () => (E('teFormOk') || {}).textContent || '';
const rpcCalls = fn => CALLS.filter(c => c.op === 'rpc' && c.fn === fn);
const lastArgs = fn => { const l = rpcCalls(fn); return l.length ? l[l.length - 1].args : null; };
const candRows = () => [...pane().querySelectorAll('#teCands .te-frow')].map(r => r.textContent);
const findRows = () => [...pane().querySelectorAll('.te-list > .te-frow')].filter(r => !r.closest('#teCands'));
async function findBy(q) { fill('teFindQ', q); act('find'); await settle(300); }
async function pickCourse(id) { fill('teCourse', id); await settle(80); }

async function runTests() {
  L('=== คอร์สเรียน ก้อน B: ลงเรียน / ย้อนหลัง ===');
  TEACH.seed();
  await login('Zen');
  await open();
  tab('enroll'); await settle(500);

  // ── 1. แผง/แท็บ ──
  ok('แท็บ "ลงเรียน / ย้อนหลัง" มี · เปิดแล้วแผงรายการซ่อน แผงลงเรียนขึ้น', !!document.querySelector('#teTabs [data-tab="enroll"]') && E('teListPane').hidden === true && E('teEnrollPane').hidden === false
    && document.querySelector('#teTabs .mail-tab[aria-selected="true"]').dataset.tab === 'enroll');
  ok('พนักงานทั่วไป (ไม่ใช่ผู้ดูแล) เปิดแท็บนี้ได้', !!E('teFindQ'));
  ok('โหลดรายการคอร์ส/ครู/ทะเบียนสมาชิกตอนเปิดแท็บ (courses · course_teachers · teachers · members)', ['courses', 'course_teachers', 'teachers', 'members'].every(t => CALLS.some(c => c.table === t)));
  ok('ไม่เรียกถังสลิป/ฟังก์ชันสลิปเลย (ปิดไว้)', !CALLS.some(c => /course-slips|teach_slip/.test(JSON.stringify(c))));
  ok('ยังไม่เลือกนักเรียน: ไม่มีฟอร์มรายละเอียด · มีทางลัดผู้สมัครกรอกย้อนหลัง', !E('teCourse') && !!E('teCands'));
  tab('active'); await settle(100);
  ok('กลับไปแท็บรายการ: แผงรายการขึ้น แผงลงเรียนซ่อน', E('teListPane').hidden === false && E('teEnrollPane').hidden === true);
  tab('enroll'); await settle(100);

  // ── 2. ทางลัดผู้สมัครจากป้าย "นักเรียน <ชื่อเล่น>" ──
  const sum = E('teCands').querySelector('summary').textContent;
  ok('ทางลัด: นับเฉพาะคนที่มีป้าย "นักเรียน …" (6 คน · ยังไม่มีการลงเรียน 5) — สมาชิกที่ป้ายอื่นไม่ถูกนับ', /ยังไม่มีการลงเรียน 5 จาก 6 คน/.test(sum), sum);
  ok('ชื่อผู้สมัครที่เป็น HTML แสดงเป็นข้อความ (XSS)', !E('teCands').querySelector('img') && /<img src=x/.test(E('teCands').textContent) && !window.__xss);
  const c0 = candRows();
  ok('ทางลัด: คนที่ลงเรียนแล้วอยู่ท้ายสุด · ป้ายสลับช่อง (membership) ก็นับ', c0.length === 6 && /ผู้สมัครที่ลงเรียนแล้ว/.test(c0[5]) && /มีการลงเรียนแล้ว/.test(c0[5]) && c0.some(t => /ผู้สมัครทดสอบ สอง/.test(t)), c0.join('|'));
  ok('ทางลัดบอกครูจากชื่อเล่น: เบส→Tibass · หนุ่ย→Zlex · โหน่ง→Alldayz · ชื่อที่ไม่รู้จัก = "ยังไม่รู้ว่าครูคนไหน"',
    c0.some(t => /นักเรียน เบส → ครู Tibass/.test(t)) && c0.some(t => /นักเรียน หนุ่ย → ครู Zlex/.test(t)) && c0.some(t => /นักเรียน โหน่ง → ครู Alldayz/.test(t)) && c0.some(t => /ยังไม่รู้ว่าครูคนไหน/.test(t)), c0.join('|'));
  ok('ข้อความกำกับ: ป้ายนี้ไม่ใช่ข้อมูลการเรียนจริง · กรอกเฉพาะคนที่ยังมีสิทธิ์เหลือ', /ไม่ใช่ข้อมูลการเรียนจริง/.test(E('teCands').textContent) && /ยังมีสิทธิ์เหลืออยู่/.test(E('teCands').textContent));
  fill('teCandQ', 'หนุ่ย'); await settle(100);
  ok('กรองผู้สมัครตามชื่อเล่น/ครู: เหลือ 1 คน', candRows().length === 1 && /ผู้สมัครทดสอบ สอง/.test(candRows()[0]), candRows().join('|'));
  fill('teCandQ', ''); await settle(100);

  // ── 3. กรอกย้อนหลังจากทางลัด (member_only → สร้างลูกค้าตอนบันทึก) ──
  act('cand', '[data-mid="m2"]'); await settle(100);
  ok('เลือกผู้สมัคร: เห็นชื่อ · บอกว่าจะสร้างเป็นลูกค้าตอนบันทึก · เข้าโหมดกรอกย้อนหลังอัตโนมัติ',
    studentCard().textContent === 'ผู้สมัครทดสอบ สอง' && /จะสร้างเป็นลูกค้าตอนบันทึก/.test(pane().textContent) && pane().querySelector('[data-act="mode"][data-v="backfill"]').getAttribute('aria-pressed') === 'true');
  ok('โหมดกรอกย้อนหลัง: ข้อความช่วย "ยังมีสิทธิ์เหลืออยู่" · ช่องวันเริ่ม/จำนวนครั้ง · ตัวเลือก "ชำระครบ (ไม่ทราบวันที่)"',
    /ยังมีสิทธิ์เหลืออยู่/.test(pane().textContent) && !!E('teStarted') && !!E('teSessN') && /ชำระครบแล้ว \\(ไม่ทราบวันที่\\)/.test(pane().textContent));
  await pickCourse('adv-scratch-class');
  ok('ครูถูกเลือกล่วงหน้าตามชื่อเล่นเมื่อเลือกคอร์สที่ครูคนนั้นสอน (หนุ่ย = Zlex)', E('teTeacher').selectedOptions[0].textContent === 'Zlex', E('teTeacher').selectedOptions[0].textContent);
  const teachOpts = [...E('teTeacher').options].map(o => o.textContent);
  ok('รายชื่อครู = ครูที่เปิดสอนคอร์สนั้นเท่านั้น (Advance Scratch: Tibass · Nutty · Zlex)', teachOpts.slice(1).sort().join() === 'Nutty,Tibass,Zlex', teachOpts.join());
  await pickCourse('basic-dj-class');
  const opts2 = [...E('teTeacher').options].map(o => o.textContent);
  ok('คอร์ส Basic DJ: ครูที่ปิดใช้งาน (ครูที่ลาออก) ไม่อยู่ในตัวเลือก · มี Leonie และ Alldayz', !opts2.includes('ครูที่ลาออก') && opts2.includes('Leonie') && opts2.includes('Alldayz'), opts2.join());
  ok('เลือกคอร์สอื่นแล้วครูที่เลือกล่วงหน้าไม่ค้างผิดคอร์ส (หนุ่ย ไม่สอน Basic DJ → ว่าง)', E('teTeacher').value === '', E('teTeacher').value);
  await pickCourse('adv-scratch-class');
  ok('คอร์สที่ปิดใช้งาน (คอร์สเลิกสอนแล้ว) ไม่อยู่ในตัวเลือก', ![...E('teCourse').options].some(o => /เลิกสอน/.test(o.textContent)));
  ok('ราคาที่ตกลงตั้งต้น = ราคาตั้งของคอร์ส · แสดงราคาตั้งเป็นคำใบ้', E('tePrice').value === '20000.00' || E('tePrice').value === '20000', E('tePrice').value);
  ok('คอร์สมีแนว (track): เลือกแนวได้', !!E('teTrack') && [...E('teTrack').options].length === 3);
  // ตรวจความถูกต้องก่อนส่ง (ไม่ยิงฐาน)
  const before = rpcCalls('teach_enroll_create').length;
  fill('teSessN', '3'); await settle(100);
  ok('กรอกจำนวนครั้ง 3: มีช่องวันที่ 3 ช่อง', pane().querySelectorAll('[data-sd]').length === 3);
  fill('teStarted', day(-20)); await settle(100);
  ok('ใส่วันเริ่มเรียน: ช่องวันที่ว่างเติมให้ด้วยวันเริ่ม (แก้ได้)', [...pane().querySelectorAll('[data-sd]')].every(i => i.value === day(-20)));
  pane().querySelectorAll('[data-sd]')[1].value = ''; pane().querySelectorAll('[data-sd]')[1].dispatchEvent(new Event('input', { bubbles: true }));
  act('save'); await settle(100);
  ok('วันที่เรียนครั้งใดว่าง: ไม่ส่งฐาน · ข้อความแดงบอกครั้งที่', /ใส่วันที่เรียนครั้งที่ 2/.test(errText()) && isRed(E('teFormErr')) && rpcCalls('teach_enroll_create').length === before, errText());
  pane().querySelectorAll('[data-sd]')[1].value = day(-10); pane().querySelectorAll('[data-sd]')[1].dispatchEvent(new Event('input', { bubbles: true }));
  fill('teSessN', '9'); await settle(100);
  ok('จำนวนครั้งเกินของคอร์ส (6): ถูกบีบเหลือ 6', E('teSessN').value === '6' && pane().querySelectorAll('[data-sd]').length === 6);
  fill('teSessN', '2'); await settle(100);
  ok('ไม่มีสลิปในฟอร์ม: ขึ้นข้อความ "ยังไม่เปิดใช้" แทนช่องอัปโหลด', /ยังไม่เปิดใช้/.test(pane().textContent) && !pane().querySelector('input[type="file"]'));
  act('pay', '[data-v="unknown"]'); await settle(100);
  ok('เลือก "ชำระครบแล้ว (ไม่ทราบวันที่)": ไม่มีช่องวัน/ยอด', !E('tePayDate') && !E('tePayAmount') && /ไม่เก็บวัน\\/ยอด/.test(pane().textContent));
  fill('tePrice', ''); await settle(50);
  act('save'); await settle(600);
  const a = lastArgs('teach_enroll_create');
  ok('ส่งฟังก์ชันลงเรียนด้วยค่า backfill: source · วันเริ่ม · paid_unknown · ราคาว่าง · ไม่ส่งราคาตั้ง', a && a.p_source === 'backfill' && a.p_started_on === day(-20) && a.p_paid_unknown === true && a.p_price_agreed === null && a.p_list_price === null
    && a.p_course === 'adv-scratch-class' && a.p_teacher === 't4' && a.p_teach_lang === 'th', J(a));
  ok('ผู้สมัครที่ไม่มีแถวลูกค้า: สร้างลูกค้าโดยผูก member_id ก่อนลงเรียน', TEACH.newCust.length === 1 && TEACH.newCust[0].member_id === 'm2' && a.p_customer === TEACH.newCust[0].id, J(TEACH.newCust));
  const bf = lastArgs('teach_session_backfill');
  ok('ลงรอบที่เรียนไปแล้ว 2 ครั้งด้วย teach_session_backfill (วันตามที่กรอก · ของการลงเรียนที่เพิ่งสร้าง)', !!bf && bf.p_dates.join() === day(-20) + ',' + day(-10) && bf.p_enrollment === TEACH.created[0].id, J(bf));
  ok('ไม่ส่งชำระ (เลือกชำระครบไม่ทราบวัน)', rpcCalls('teach_payment_record').length === 0);
  ok('สำเร็จ: ข้อความเขียว · ฟอร์มถูกล้าง · ไม่มีข้อความแดง', /บันทึกแล้ว ✓ ผู้สมัครทดสอบ สอง/.test(okText()) && !E('teCourse') && !E('teFormErr'), okText());
  await sleep(300);
  tab('active'); await settle(100);
  const created = TEACH.created[0];
  const nr = document.querySelector('#teBody .te-row[data-id="' + created.id + '"]');
  ok('รายการใหม่โผล่ในแท็บกำลังเรียนทันที (โหลดใหม่หลังบันทึก) พร้อมป้ายกรอกย้อนหลัง/ชำระครบไม่ทราบวันที่', !!nr && /กรอกย้อนหลัง · ข้อมูลอาจไม่ครบ/.test(nr.textContent) && /ชำระครบ \\(ไม่ทราบวันที่\\)/.test(nr.textContent) && /2\\/6/.test(nr.textContent), nr && nr.textContent);
  tab('enroll'); await settle(100);

  // ── 4. ค้นนักเรียน (เบอร์ไทยหลายรูปแบบ · ชื่อ · ซ้ำ) ──
  await findBy('+66 81 000 0011');
  ok('ค้นเบอร์ +66 81 000 0011: เจอสมาชิกที่เก็บ 081-000-0011 (ไม่สนรูปแบบ) และบอกว่ายังไม่มีในทะเบียนลูกค้า',
    findRows().length === 1 && /ผู้สมัครทดสอบ หนึ่ง/.test(findRows()[0].textContent) && /ยังไม่มีในทะเบียนลูกค้า/.test(findRows()[0].textContent), findRows().map(r => r.textContent).join('|'));
  ok('ส่งคำค้นตามที่พิมพ์ให้ฐานตัดสิน (ไม่ตัดเบอร์เองฝั่งหน้า)', lastArgs('teach_student_find').p_query === '+66 81 000 0011');
  await findBy('สมชาย');
  ok('ค้นชื่อ: เจอลูกค้าเดิม + จำนวนการลงเรียนที่มีอยู่', findRows().length === 1 && /มีการลงเรียนแล้ว 1 รายการ/.test(findRows()[0].textContent), findRows().map(r => r.textContent).join('|'));
  await findBy('ก');
  ok('คำค้นสั้นเกิน: ไม่ยิงฐาน · ข้อความแดง', /อย่างน้อย 2 ตัวอักษร/.test(errText()) && lastArgs('teach_student_find').p_query === 'สมชาย');
  await findBy('ไม่มีใครชื่อนี้เลย');
  ok('ไม่พบ: บอกตรง ๆ และมีปุ่มสร้างลูกค้าใหม่', /ไม่พบนักเรียน/.test(pane().textContent) && !!pane().querySelector('[data-act="newToggle"]'));
  act('newToggle'); await settle(100);
  fill('teNewName', 'ลูกค้าทดสอบใหม่'); fill('teNewPhone', '081 000 0011');
  act('newCreate'); await settle(400);
  ok('สร้างลูกค้าใหม่ด้วยเบอร์ที่มีในระบบแล้ว: ไม่สร้างซ้ำ · บอกให้เลือกคนเดิม', /เบอร์นี้มีอยู่ในระบบแล้ว/.test(errText()) && TEACH.newCust.length === 1, errText());
  act('newToggle'); await settle(100);
  fill('teNewName', 'ลูกค้าทดสอบใหม่'); fill('teNewPhone', '0800000099');
  act('newCreate'); await settle(400);
  ok('สร้างลูกค้าใหม่ (เบอร์ไม่ซ้ำ): ได้แถวลูกค้า · ถูกเลือกเป็นนักเรียนทันที', TEACH.newCust.length === 2 && studentCard() && studentCard().textContent === 'ลูกค้าทดสอบใหม่' && /มีในทะเบียนลูกค้าแล้ว/.test(pane().textContent), pane().textContent.slice(0, 80));
  ok('บันทึกการเรียกฐาน: ไม่เก็บค่าชื่อ/เบอร์ลง CALLS (เก็บเฉพาะชื่อคอลัมน์)', CALLS.filter(c => c.table === 'customers' && c.op === 'insert').every(c => !/0800000099|ลูกค้าทดสอบใหม่/.test(JSON.stringify(c))));

  // ── 5. ลงเรียนใหม่ (พนักงาน) ──
  await pickCourse('basic-dj-class');
  ok('ลงเรียนใหม่ตั้งต้น: โหมด "ลงเรียนใหม่" · ไม่มีช่องวันเริ่ม/รอบย้อนหลัง · มีช่องชำระแบบติ๊ก', pane().querySelector('[data-act="mode"][data-v="console"]').getAttribute('aria-pressed') === 'true' && !E('teStarted') && !!pane().querySelector('[data-act="paychk"]'));
  ok('พนักงานทั่วไป: ปุ่ม "อังกฤษ (International)" ปิดอยู่ + ข้อความอธิบายว่าต้องให้ผู้ดูแลลง', pane().querySelector('[data-act="lang"][data-v="en"]').disabled === true && /ให้ผู้ดูแลลงให้/.test(pane().textContent));
  fill('teTeacher', 't2'); await settle(50);
  fill('tePrice', '18000'); await settle(100);
  ok('ราคาที่ตกลงต่างจากราคาตั้ง: คำเตือนแดงตัวหนา ให้ใส่หมายเหตุ', isRed(E('tePriceWarn')) && /ต้องใส่หมายเหตุ/.test(E('tePriceWarn').textContent));
  const n0 = rpcCalls('teach_enroll_create').length;
  act('save'); await settle(100);
  ok('ราคาต่างโดยไม่ใส่หมายเหตุ: ไม่ส่งฐาน · ข้อความแดง', /ใส่หมายเหตุบอกเหตุผล/.test(errText()) && rpcCalls('teach_enroll_create').length === n0);
  fill('teNote', 'ส่วนลดตามที่ตกลงกับเจ้าของ');
  chk(); await settle(100);
  ok('ติ๊ก "ชำระแล้ว": มีช่องวันที่/ยอด/วิธี · ข้อความแดงตัวหนา "บันทึกแล้วจะไม่แสดงยอดนี้อีก" (พนักงาน)', !!E('tePayDate') && !!E('tePayAmount') && !!E('tePayMethod') && isRed(E('tePayWarn')) && /ไม่แสดงยอดนี้อีก/.test(E('tePayWarn').textContent));
  fill('tePayDate', day(0)); fill('tePayAmount', '25000'); await settle(50);
  act('save'); await settle(100);
  ok('ยอดชำระเกินราคาที่ตกลง: ไม่ส่งฐาน', /ยอดชำระเกินราคาที่ตกลง/.test(errText()) && rpcCalls('teach_enroll_create').length === n0);
  fill('tePayAmount', '10000'); await settle(50);
  // กดซ้ำระหว่างส่ง = ส่งครั้งเดียว
  let release; TEACH.gateRpc = new Promise(r => { release = r; });
  act('save'); await sleep(50);
  ok('ระหว่างส่ง: ปุ่มบันทึกถูกล็อก + ข้อความ "กำลังบันทึก…"', E('teSave').disabled === true && /กำลังบันทึก/.test(E('teSave').textContent));
  E('teSave').click(); E('teSave').click(); await sleep(50);
  TEACH.gateRpc = null; release(); await settle(700);
  ok('กดซ้ำระหว่างส่ง: ส่งลงเรียนครั้งเดียว · บันทึกชำระครั้งเดียว', rpcCalls('teach_enroll_create').length === n0 + 1 && rpcCalls('teach_payment_record').length === 1, rpcCalls('teach_enroll_create').length + ' ' + rpcCalls('teach_payment_record').length);
  const a2 = lastArgs('teach_enroll_create'), p2 = lastArgs('teach_payment_record');
  ok('ค่าที่ส่ง: console · ราคาที่ตกลง 18000 · หมายเหตุ · ไม่มีวันเริ่ม/paid_unknown · ผู้สอน Nutty', a2.p_source === 'console' && a2.p_price_agreed === 18000 && a2.p_note === 'ส่วนลดตามที่ตกลงกับเจ้าของ' && a2.p_started_on === null && a2.p_paid_unknown === false && a2.p_teacher === 't2', J(a2));
  ok('บันทึกชำระ: ยอด/วัน/วิธี + request_id (uuid) + ไม่มีสลิป', p2.p_amount === 10000 && p2.p_paid_on === day(0) && p2.p_method === 'transfer' && /^[0-9a-f-]{36}$/.test(p2.p_request_id) && p2.p_slip_path === null, J(p2));
  ok('สำเร็จ: ข้อความเขียว (ไม่มียอดเงิน) · ฟอร์มถูกล้าง', /บันทึกแล้ว ✓ ลูกค้าทดสอบใหม่ · Basic DJ Class/.test(okText()) && !/10000|18000/.test(okText()), okText());

  // ── 6. ล้มกลางทาง: ลงเรียนแล้วแต่ชำระล้ม → กดซ้ำทำต่อ ไม่สร้างซ้ำ ──
  await findBy('วีระ');
  act('pick', '[data-i="0"]'); await settle(100);
  await pickCourse('basic-dj-class'); fill('teTeacher', 't1'); await settle(50);
  chk(); await settle(100);
  fill('tePayDate', day(0)); fill('tePayAmount', '5000'); await settle(50);
  TEACH.fail.rpc_teach_payment_record = 'วิธีชำระไม่ถูกต้อง';
  const nc = TEACH.created.length;
  act('save'); await settle(700);
  ok('ชำระล้มหลังลงเรียนสำเร็จ: บอกว่าลงเรียนแล้ว · ขั้นไหนค้าง · ข้อความแดง', /ลงเรียนเรียบร้อยแล้ว แต่ขั้น "บันทึกการชำระ" ไม่สำเร็จ/.test(errText()) && TEACH.created.length === nc + 1 && isRed(E('teFormErr')), errText());
  ok('ข้อความผิดพลาดไม่มียอดเงิน', !/5000|5,000/.test(errText()));
  const reqA = lastArgs('teach_payment_record').p_request_id;
  TEACH.fail = {};
  act('save'); await settle(700);
  ok('กดบันทึกอีกครั้ง: ไม่สร้างการลงเรียนซ้ำ · ชำระใช้ request_id เดิม', TEACH.created.length === nc + 1 && lastArgs('teach_payment_record').p_request_id === reqA && /บันทึกแล้ว ✓/.test(okText()), TEACH.created.length + ' ' + okText());

  // ── 7. ข้อความผิดพลาดของฐานที่เป็นอังกฤษ (อาจมีค่าในแถว) ไม่แสดง ──
  await findBy('ชูใจ');
  act('pick', '[data-i="0"]'); await settle(100);
  await pickCourse('basic-dj-class'); fill('teTeacher', 't1'); fill('tePrice', '20000'); await settle(50);
  TEACH.fail.rpc_teach_enroll_create = 'duplicate key value violates unique constraint "x" DETAIL: Key (phone)=(0800000001) already exists';
  act('save'); await settle(400);
  ok('ข้อความอังกฤษของฐานไม่ถูกแสดง (กันเบอร์/ค่าในแถวหลุด) — ขึ้นข้อความทั่วไปแทน', /ฐานข้อมูลตอบกลับผิดปกติ/.test(errText()) && !/0800000001|duplicate key/.test(pane().textContent), errText());
  ok('ลงเรียนล้ม (ยังไม่สร้าง): ข้อความไม่อ้างว่า "ลงเรียนแล้ว"', !/ลงเรียนเรียบร้อยแล้ว/.test(errText()));
  TEACH.fail = {};
  TEACH.fail.rpc_teach_enroll_create = 'ราคาที่ตกลงต้องไม่ติดลบ';
  act('save'); await settle(400);
  ok('ข้อความไทยของฟังก์ชันฐานแสดงตามที่ฐานตอบ', /ราคาที่ตกลงต้องไม่ติดลบ/.test(errText()));
  TEACH.fail = {};

  // ── 8. XSS ในผลค้น · ล้างตอนออกจากระบบ ──
  act('unpick'); await settle(100);
  await findBy('แปลก');
  ok('ชื่อลูกค้าที่เป็น HTML ในผลค้นแสดงเป็นข้อความ', findRows().length === 1 && !pane().querySelector('img') && /<img src=x/.test(findRows()[0].textContent) && !window.__xss);
  act('pick', '[data-i="0"]'); await settle(100);
  ok('ชื่อนักเรียนที่เลือกแสดงเป็นข้อความ (ไม่แปลเป็นแท็ก)', !pane().querySelector('img') && /<img src=x/.test(studentCard().textContent));
  await logout();
  ok('ออกจากระบบ: ฟอร์มลงเรียนและนักเรียนที่เลือกถูกล้างจาก DOM', pane().innerHTML === '' && !/แปลก/.test(document.getElementById('sec-teach').textContent));
  await login('Zen');
  await open();
  ok('เข้าใหม่: ฟอร์มสะอาด (ไม่มีนักเรียนค้าง · อยู่แท็บสรุป)', !studentCard() && document.querySelector('#teTabs .mail-tab[aria-selected="true"]').dataset.tab === 'summary');

  // ── 9. เจ้าของ/ผู้ดูแล: คอร์สภาษาอังกฤษ ──
  await logout();
  await login('Nui');
  await open();
  tab('enroll'); await settle(400);
  await findBy('นภา');
  act('pick', '[data-i="0"]'); await settle(100);
  await pickCourse('basic-dj-class'); fill('teTeacher', 't1'); await settle(50);
  ok('ผู้ดูแล: ปุ่มภาษาอังกฤษใช้ได้', pane().querySelector('[data-act="lang"][data-v="en"]').disabled === false);
  act('lang', '[data-v="en"]'); await settle(100);
  ok('เลือกภาษาอังกฤษ: ช่องราคาตั้งโผล่ (กรอกเอง — ไม่อยู่ในไฟล์คอร์ส)', !!E('teListPrice') && /ไม่อยู่ในไฟล์คอร์ส/.test(pane().textContent));
  fill('tePrice', '28000'); await settle(50);
  act('save'); await settle(100);
  ok('ไม่ใส่ราคาตั้งของคอร์สอังกฤษ: ไม่ส่งฐาน', /ใส่ราคาตั้งของคอร์สภาษาอังกฤษ/.test(errText()));
  fill('teListPrice', '28000'); await settle(50);
  chk(); await settle(100);
  fill('tePayDate', day(0)); fill('tePayAmount', '28000'); await settle(50);
  const payWarnSeen = !!E('tePayWarn');
  const ne = rpcCalls('teach_enroll_create').length;
  act('save'); await settle(600);
  const a3 = lastArgs('teach_enroll_create');
  ok('ผู้ดูแลลงคอร์สอังกฤษ: ส่งภาษา en + ราคาตั้ง 28000', rpcCalls('teach_enroll_create').length === ne + 1 && a3.p_teach_lang === 'en' && a3.p_list_price === 28000 && a3.p_price_agreed === 28000, J(a3));
  ok('ผู้ดูแล/เจ้าของที่ติ๊กชำระ: ไม่ขึ้นข้อความเตือน "ไม่แสดงยอดนี้อีก" (เห็นยอดได้อยู่แล้ว) · บันทึกชำระได้', rpcCalls('teach_payment_record').length >= 1 && lastArgs('teach_payment_record').p_amount === 28000 && payWarnSeen === false);

  // ── 10. ยังไม่รัน 047 / โหลดแคตตาล็อกล้ม ──
  await logout(); await login('Zen');
  TEACH.fail.from_courses = 'connection reset';
  await open();
  tab('enroll'); await settle(500);
  await findBy('สมชาย');
  act('pick', '[data-i="0"]'); await settle(300);
  ok('โหลดรายการคอร์สล้ม: ข้อความแดง · แถบ fatal (กฎข้อ 8) · ไม่เปิดฟอร์มปลอม ๆ', /โหลดรายการคอร์ส\\/ครูไม่สำเร็จ/.test(pane().textContent) && /โหลดรายการคอร์ส/.test(fatalText()) && !E('teSave'), pane().textContent.slice(0, 120));
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
const J = o => JSON.stringify(o);
</script>`;

const mock = MOCK3 + '\n' + TEACH_MOCK;
let allOk = true;
for (const [label, tests, opts] of [
  ['จอคอม 1366×768', TESTS_MAIN, { width: 1366, height: 768, coarse: false }],
  ['ลงเรียน / ย้อนหลัง (ก้อน B)', TESTS_ENROLL, { width: 1366, height: 900, coarse: false }],
  ['บัญชีครูล้วน/ไม่มีสิทธิ์', TESTS_NOACCESS, { width: 1366, height: 768, coarse: false }],
  ['iPhone 390×844', TESTS_PHONE, { width: 390, height: 844, coarse: true }],
]) {
  console.log('\n--- ' + label + ' ---');
  const res = await runCdpPage({ root: pageRoot, file: 'desk.html', mock, tests, hash: '', shotDir: SHOTS, ...opts });
  if (!res.ok) allOk = false;
}
console.log('\n=== desk-teach: ' + (allOk ? 'ผ่าน' : 'ไม่ผ่านหรือไม่ได้รันจนจบ') + ' ===');
process.exit(allOk ? 0 : 1);
