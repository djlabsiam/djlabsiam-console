/**
 * เทสต์หมวด Ops Board ของ desk.html (#ops · เฉพาะเจ้าของร้าน · 033)
 *   รัน: node tests/desk-ops.mjs
 *   ถ่ายภาพ: OPS_SHOTS=<โฟลเดอร์> node tests/desk-ops.mjs
 *
 * ตัวรัน CDP เดียวกับ desk-ipad/desk-iphone · ฐานข้อมูลปลอมอยู่ที่ tests/lib/ops-mock.mjs (จำลอง RLS: เฉพาะ owner เห็น/เขียนได้ ·
 * delete ที่ถูกปฏิเสธ "สำเร็จแต่ไม่ลบอะไร" ไม่มี error · ทริกเกอร์ done_at)
 *
 * 1. เจ้าของร้าน: เมนู · สรุปตัวเลข · กลุ่มตามความเร่งด่วน · เรียงลำดับ · กรอง/ค้นหา · เปลี่ยนสถานะ · เพิ่ม/แก้/ลบ · ข้อความแสดงตามจริงเมื่อฐานข้อมูลล้ม
 * 2. admin / staff: ไม่เห็นเมนู · เปิดไม่ได้ · ไม่มีคำขอไปถึงตาราง
 * 1b. ช่วยคิด (ปุ่ม "ช่วยคิด" → Edge Function ai): ปุ่มเฉพาะงานที่ไม่ใช่หมวดระบบ · หน้าต่าง · คำตอบเก่า · ส่งแค่ {task_id, kind} · กดซ้ำ ·
 *     XSS · คัดลอก · quota / ยังไม่ตั้งค่า / ล้ม · ปิดหน้าต่างกลางคำขอ · โหลดประวัติไม่ได้ (ฟังก์ชันตัวจริงมีเทสต์แยกที่ Stock App/scripts/test-ai-function.mjs)
 * 1c. สั่ง Claude ทำงานต่อ (ปุ่ม "สั่ง Claude" → คิว ops_task_orders · 034): ปุ่มเฉพาะงานที่ยังไม่เสร็จและไม่มีคำสั่งค้าง · ส่งแค่ {task_id, instruction, ai_answer_id} ·
 *     สถานะเป็นคำ (รอรับ/รับแล้ว/ทำแล้ว/ทำไม่สำเร็จ/ยกเลิกแล้ว) + ผลที่ Claude เขียนกลับ (XSS) · ยกเลิกตอน queued/picked · ยกเลิกแต่ Claude ทำเสร็จไปแล้ว (ไม่หลอกว่าสำเร็จ) ·
 *     สั่งซ้ำจากอีกเครื่อง · ฐานข้อมูลล้ม · ยังไม่ได้รัน 034 (ซ่อนเงียบ ๆ)
 * 3. สลับบัญชีจากเจ้าของเป็นพนักงาน: เนื้อหา Ops Board (รวมคำตอบช่วยคิดและคำขอที่ค้างอยู่) ต้องไม่ค้างอยู่ในหน้า
 */

import { dirname, join, } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { HARNESS } from './lib/page-test.mjs';
import { runCdpPage } from './lib/cdp-page.mjs';
import { OPS_MOCK } from './lib/ops-mock.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { MOCK: MOCK3 } = await import(pathToFileURL(join(root, 'tests/desk-home3.mjs')).href);
const SHOTS = process.env.OPS_SHOTS || null;
const pageRoot = process.env.OPS_ROOT || root;   // ทดสอบหน้าฉบับอื่น (mutation) ได้
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const TESTS = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
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
async function shot(name) {
  await frames(); await sleep(150);
  await new Promise(r => { window.__shot = r; console.log('[SHOT] ' + name); });
}
const vis = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
const titles = () => [...document.querySelectorAll('#opsBoard .ops-title')].map(e => e.textContent);
const groups = () => [...document.querySelectorAll('#opsBoard .ops-group h3')].map(h => h.firstChild.textContent.trim());
const card = id => document.querySelector('#opsBoard .ops-task[data-id="' + id + '"]');
const opsCalls = (op) => CALLS.filter(c => /^ops_/.test(c.table || '') && (!op || c.op === op));
const setFilter = f => document.querySelector('#opsFilter button[data-filter="' + f + '"]').click();
const stat = id => $(id).textContent;
const fatalText = () => (document.querySelector('.fatal-error, #fatalError, .fatal') || {}).textContent || document.body.innerText;
function changeStatus(id, v) { const s = card(id).querySelector('select[data-act="status"]'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }
function fillForm(o) {
  const map = { title: 'opsfTitle', detail: 'opsfDetail', action: 'opsfAction', sev: 'opsfSev', status: 'opsfStatus', area: 'opsfArea', due: 'opsfDue', owner: 'opsfOwner', source: 'opsfSource' };
  for (const [k, v] of Object.entries(o)) $(map[k]).value = v;
}
async function submitForm() { $('opsForm').requestSubmit(); await sleep(200); }

async function runTests() {
  L('=== Ops Board (#ops) ===');
  // ── 1. เจ้าของร้าน ─────────────────────────────────────────────────────
  await login('tibass');
  const nav = document.querySelector('#navList .nav-item[data-s="ops"]');
  ok('เจ้าของร้านเห็นเมนู Ops Board ในกลุ่ม "บัญชีและระบบ"', !!nav && /Ops Board/.test(nav.textContent) && nav.closest('.nav-group').querySelector('.nav-group-title').textContent === 'บัญชีและระบบ');
  ok('ยังไม่เปิดหมวด = ยังไม่มีคำขอไปที่ตาราง ops_*', opsCalls().length === 0, JSON.stringify(opsCalls()));
  ok('showSection("ops") สำเร็จ · hash = #ops · หัวหน้า = Ops Board', showSection('ops') === true && location.hash === '#ops' && $('pageTitle').textContent === 'Ops Board' && !$('sec-ops').hidden);
  await sleep(300); await frames();
  ok('โหลดงานจาก ops_tasks และ ops_board_meta ตอนเปิดหมวด', opsCalls('select').some(c => c.table === 'ops_tasks') && opsCalls('select').some(c => c.table === 'ops_board_meta'));

  ok('สรุป: ด่วนค้าง 2 · จับตาค้าง 2 · เลยกำหนด/ใกล้ครบ 2 · เสร็จใน 7 วัน 1', stat('opsStatRed') === '2' && stat('opsStatAmber') === '2' && stat('opsStatDue') === '2' && stat('opsStatDone') === '1',
    [stat('opsStatRed'), stat('opsStatAmber'), stat('opsStatDue'), stat('opsStatDone')].join('/'));
  ok('ตัวกรองเริ่มต้น "ยังไม่เสร็จ": 6 งาน ไม่มีงานที่เสร็จแล้ว', titles().length === 6 && !titles().some(t => /เสร็จ/.test(t)), titles().join(' | '));
  ok('กลุ่มเรียง ด่วน → จับตา → ติดตาม และบอกเป็นคำ (ไม่ใช้สีอย่างเดียว)', groups().join(',') === 'ด่วน,จับตา,ติดตาม', groups().join(','));
  ok('หัวกลุ่มบอกจำนวนงาน', /2 งาน/.test(document.querySelector('#opsBoard .ops-group h3').textContent));
  const redTitles = [...document.querySelectorAll('#opsBoard .ops-group:first-child .ops-title')].map(e => e.textContent);
  ok('ในกลุ่ม: งานเลยกำหนดขึ้นก่อนงานที่ครบทีหลัง', redTitles[0].includes('มหาจักร') && redTitles[1].includes('Serato'), redTitles.join(' | '));
  ok('งานเลยกำหนด: ป้ายบอก "เลยกำหนด 3 วัน" (st-bad)', /เลยกำหนด 3 วัน/.test(card('t1').textContent) && !!card('t1').querySelector('.st-bad'));
  ok('งานครบใน 2 วัน: ป้าย "อีก 2 วัน" (st-warn)', /อีก 2 วัน/.test(card('t2').textContent) && !!card('t2').querySelector('.st-warn'));
  ok('งานกำหนดไกล: ป้าย "กำหนด …" (st-off)', !!card('t3').querySelector('.st-off') && /กำหนด /.test(card('t3').textContent));
  ok('งานที่มีรายละเอียด/ทำต่อ/ที่มา แสดงครบ', /ค้างมาตั้งแต่ต้นเดือน/.test(card('t1').textContent) && /ทำต่อ:/.test(card('t1').textContent) && /ที่มา: Gmail/.test(card('t1').textContent));
  ok('ชื่อที่มีแท็ก HTML ถูกแสดงเป็นข้อความ ไม่ถูกรัน (กัน XSS)', !window.__xss && !document.querySelector('#opsBoard img') && /<img src=x/.test(card('t8').querySelector('.ops-title').textContent));
  ok('ช่องสถานะของแต่ละงานเป็นค่าจริงของงาน (กำลังทำ/รอคนอื่น)', card('t2').querySelector('select[data-act=status]').value === 'doing' && card('t4').querySelector('select[data-act=status]').value === 'waiting');
  ok('ปุ่ม แก้ไข / ลบ มีทุกงาน', [...document.querySelectorAll('#opsBoard .ops-task')].every(t => t.querySelector('[data-act=edit]') && t.querySelector('[data-act=del]')));
  ok('แผงขวา: รอบถัดไป · แหล่งข้อมูล 3 · รายงาน 1 · "ยังไม่มีรอบที่รันแล้ว"', /รอบถัดไป/.test($('opsRail').textContent) && document.querySelectorAll('#opsRail .ops-src').length === 3 && /sample-report-2026/.test($('opsRail').textContent) && /ยังไม่มีรอบที่รันแล้ว/.test($('opsRail').textContent));
  ok('แหล่งข้อมูล: สถานะบอกเป็นคำ ใช้ได้ / บางส่วน / ยังไม่มี', ['ใช้ได้', 'บางส่วน', 'ยังไม่มี'].every(w => $('opsRail').textContent.includes(w)));
  if (${JSON.stringify(!!SHOTS)}) await shot('ops-owner-1440.png');

  // กรอง
  setFilter('done'); await frames();
  ok('กรอง "เสร็จแล้ว": เห็นเฉพาะ 2 งานที่เสร็จ ขีดฆ่า และอยู่นอกกลุ่ม "ติดตาม"', titles().length === 2 && !!card('t6') && !!card('t7') && card('t6').classList.contains('done'));
  setFilter('all'); await frames();
  ok('กรอง "ทั้งหมด": 8 งาน · งานเสร็จอยู่ท้ายกลุ่มของมัน', titles().length === 8);
  const amber = [...document.querySelectorAll('#opsBoard .ops-group')].find(g => /จับตา/.test(g.querySelector('h3').textContent));
  const amberOrder = [...amber.querySelectorAll('.ops-task')].map(t => t.dataset.id);
  ok('ในกลุ่มจับตา งานที่เสร็จแล้วอยู่ท้ายสุด', amberOrder[amberOrder.length - 1] === 't6', amberOrder.join(','));
  setFilter('open');
  $('opsArea').value = 'ads'; $('opsArea').dispatchEvent(new Event('change', { bubbles: true })); await frames();
  ok('กรองหมวด "แอด" + ยังไม่เสร็จ: เหลืองาน t2 งานเดียว', titles().length === 1 && !!card('t2'), titles().join('|'));
  $('opsArea').value = 'all'; $('opsArea').dispatchEvent(new Event('change', { bubbles: true }));
  $('opsSearch').value = 'serato'; $('opsSearch').dispatchEvent(new Event('input', { bubbles: true })); await frames();
  ok('ค้นหา "serato" (ไม่สนตัวพิมพ์): เจอ t2 งานเดียว', titles().length === 1 && !!card('t2'));
  $('opsSearch').value = 'ไม่มีทางเจอ'; $('opsSearch').dispatchEvent(new Event('input', { bubbles: true })); await frames();
  ok('ค้นหาไม่เจอ: ขึ้นข้อความบอก ไม่ใช่หน้าว่าง', /ไม่มีงานที่ตรงกับตัวกรอง/.test($('opsBoard').textContent));
  $('opsSearch').value = ''; $('opsSearch').dispatchEvent(new Event('input', { bubbles: true })); await frames();

  // เปลี่ยนสถานะ
  const nUp = opsCalls('update').length;
  changeStatus('t1', 'done'); await sleep(200);
  ok('เปลี่ยนสถานะ → ส่ง update เฉพาะ {status} ที่งานนั้น', opsCalls('update').length === nUp + 1 && JSON.stringify(opsCalls('update').pop().payload) === '{"status":"done"}' && opsCalls('update').pop().filters[0].join('=') === 'id=t1');
  ok('งานที่เสร็จหายจาก "ยังไม่เสร็จ" · สรุปเลื่อน: ด่วนค้าง 1 · เลยกำหนด/ใกล้ครบ 1 · เสร็จ 7 วัน 2 (done_at จากฐานข้อมูล)',
    !card('t1') && stat('opsStatRed') === '1' && stat('opsStatDue') === '1' && stat('opsStatDone') === '2', [stat('opsStatRed'), stat('opsStatDue'), stat('opsStatDone')].join('/'));
  setFilter('done'); await frames();
  ok('งานที่เพิ่งปิดไปอยู่ในแท็บ "เสร็จแล้ว" ขีดฆ่า', !!card('t1') && card('t1').classList.contains('done'));
  changeStatus('t1', 'doing'); await sleep(200);
  setFilter('open'); await frames();
  ok('เปิดงานกลับ → กลับมาในรายการค้าง (done_at ถูกล้างโดยฐานข้อมูล)', !!card('t1') && OPS.tasks.find(t => t.id === 't1').done_at === null);

  // เพิ่ม
  const nIns = opsCalls('insert').length;
  $('opsAdd').click(); await sleep(100);
  ok('กด "+ เพิ่มงาน": เปิดหน้าต่างฟอร์ม · ค่าเริ่มต้น จับตา/ยังไม่เริ่ม/งานร้าน/เจ้าของร้าน', $('opsDialog').open && $('opsFormTitle').textContent === 'เพิ่มงานใหม่' && $('opsfSev').value === 'amber' && $('opsfStatus').value === 'todo' && $('opsfArea').value === 'shop' && $('opsfOwner').value === 'เจ้าของร้าน');
  await submitForm();
  ok('ไม่ใส่ชื่องาน: ขึ้นข้อความในหน้าต่าง ไม่ส่งอะไรไปฐานข้อมูล ไม่ปิดหน้าต่าง', $('opsDialog').open && !$('opsFormErr').hidden && /ชื่องาน/.test($('opsFormErr').textContent) && opsCalls('insert').length === nIns);
  fillForm({ title: '  งานใหม่จากคอนโซล  ', detail: 'รายละเอียด', action: 'ทำต่อ', sev: 'red', status: 'doing', area: 'ads', due: '2026-12-31', owner: 'Claude', source: 'ทดสอบ' });
  await submitForm();
  const ins = opsCalls('insert').pop();
  ok('บันทึก: insert ครบทุกฟิลด์ · ตัดช่องว่างหน้าหลัง · due เป็นวันที่ · id ขึ้นต้น m', opsCalls('insert').length === nIns + 1 && ins.payload.title === 'งานใหม่จากคอนโซล' && ins.payload.severity === 'red' && ins.payload.status === 'doing' && ins.payload.area === 'ads' && ins.payload.due === '2026-12-31' && /^m[a-z0-9]+$/.test(ins.payload.id), JSON.stringify(ins.payload));
  ok('หน้าต่างปิด · งานใหม่ขึ้นในกลุ่ม "ด่วน" · ไม่ส่ง created_by/done_at เอง (ฐานข้อมูลเติม)', !$('opsDialog').open && !!document.querySelector('#opsBoard .ops-title') && titles().includes('งานใหม่จากคอนโซล') && !('created_by' in ins.payload) && !('done_at' in ins.payload));
  $('opsAdd').click(); await sleep(50); fillForm({ title: 'ปิดงานแล้วตอนสร้าง', status: 'done' }); await submitForm();
  ok('สร้างงานเป็น "เสร็จแล้ว" ตั้งแต่แรก → ฐานข้อมูลเติม done_at ให้', OPS.tasks.find(t => t.title === 'ปิดงานแล้วตอนสร้าง').done_at !== null);

  // แก้
  const tid = OPS.tasks.find(t => t.title === 'งานใหม่จากคอนโซล').id;
  card(tid).querySelector('[data-act=edit]').click(); await sleep(100);
  ok('แก้ไข: หน้าต่างขึ้นพร้อมค่าเดิมครบ', $('opsFormTitle').textContent === 'แก้ไขงาน' && $('opsfTitle').value === 'งานใหม่จากคอนโซล' && $('opsfSev').value === 'red' && $('opsfDue').value === '2026-12-31' && $('opsfSource').value === 'ทดสอบ');
  const nUpd = opsCalls('update').length;
  fillForm({ title: 'ชื่อที่แก้แล้ว', sev: 'green' }); await submitForm();
  ok('บันทึกการแก้: update ที่งานเดิม (ไม่สร้างใหม่) · ชื่อและกลุ่มเปลี่ยนตาม', opsCalls('update').length === nUpd + 1 && opsCalls('update').pop().filters[0].join('=') === 'id=' + tid && opsCalls('insert').length === nIns + 2 && titles().includes('ชื่อที่แก้แล้ว') && card(tid).closest('.ops-group').querySelector('h3').textContent.includes('ติดตาม'));

  // ลบ
  card('t3').querySelector('[data-act=del]').click(); await sleep(100);
  ok('กดลบ: ขึ้นหน้าต่างยืนยันที่ระบุชื่องาน ยังไม่ลบ', $('confirmDialog').open && /เช็กรีวิวใหม่/.test($('confirmBody').textContent) && !!card('t3') && opsCalls('delete').length === 0);
  $('confirmDialog').close(); await sleep(50);
  ok('ยกเลิกการลบ: งานยังอยู่ ไม่มีคำสั่งลบ', !!card('t3') && opsCalls('delete').length === 0);
  card('t3').querySelector('[data-act=del]').click(); await sleep(100); $('confirmOkBtn').click(); await sleep(250);
  ok('ยืนยันลบ: delete ที่ id นั้น (ขอแถวกลับมานับ) · งานหายจากหน้าและฐานข้อมูล', opsCalls('delete').length === 1 && opsCalls('delete')[0].filters[0].join('=') === 'id=t3' && !card('t3') && !OPS.tasks.some(t => t.id === 't3') && !$('confirmDialog').open);
  OPS.denyDelete = true;
  card('t4').querySelector('[data-act=del]').click(); await sleep(100); $('confirmOkBtn').click(); await sleep(250);
  ok('ฐานข้อมูลไม่ลบให้ (RLS ปฏิเสธเงียบๆ ไม่มี error): หน้าไม่ขึ้นว่าลบแล้ว · งานยังอยู่ · แจ้งความล้มเหลว', !!card('t4') && OPS.tasks.some(t => t.id === 't4') && /ลบงานไม่สำเร็จ/.test(document.body.innerText), document.body.innerText.slice(0, 200));
  OPS.denyDelete = false;

  // ฐานข้อมูลล้ม
  OPS.fail.update = 'พังจำลอง';
  changeStatus('t5', 'doing'); await sleep(250);
  ok('เปลี่ยนสถานะไม่สำเร็จ: แจ้งความล้มเหลว · ช่องเลือกกลับเป็นสถานะจริง (ไม่หลอกว่าสำเร็จ)', /เปลี่ยนสถานะงานไม่สำเร็จ/.test(document.body.innerText) && card('t5').querySelector('select[data-act=status]').value === 'todo');
  OPS.fail.update = null;
  OPS.fail.insert = 'พังจำลอง';
  $('opsAdd').click(); await sleep(50); fillForm({ title: 'งานที่บันทึกไม่ได้' }); await submitForm();
  ok('เพิ่มงานไม่สำเร็จ: แจ้งในหน้าต่าง · หน้าต่างไม่ปิด (ไม่ทำข้อมูลที่พิมพ์ไว้หาย) · ปุ่มบันทึกกดซ้ำได้', $('opsDialog').open && /บันทึกไม่สำเร็จ/.test($('opsFormErr').textContent) && $('opsfSave').disabled === false && $('opsfTitle').value === 'งานที่บันทึกไม่ได้');
  $('opsDialog').close(); OPS.fail.insert = null;
  OPS.fail.select = 'พังจำลอง'; $('opsRefresh').click(); await sleep(300);
  ok('โหลดไม่สำเร็จ: ขึ้นข้อความแดงในหน้าและแถบเตือน', /โหลดงานไม่สำเร็จ/.test($('opsAlert').textContent) && /โหลด Ops Board ไม่สำเร็จ/.test(document.body.innerText));
  OPS.fail.select = null; OPS.missing = true; $('opsRefresh').click(); await sleep(300);
  ok('ยังไม่ได้รัน 033 (ไม่มีตาราง): บอกให้รัน migration ไม่ใช่ error ดิบ', /ต้องรัน migration 033/.test($('opsAlert').textContent));
  OPS.missing = false; $('opsRefresh').click(); await sleep(300);
  ok('รีเฟรชแล้วกลับมาปกติ: ข้อความเตือนหาย งานกลับมา', $('opsAlert').textContent === '' && titles().length > 0);

  // ── รีเฟรช/อัปเดตเอง: ต้องเห็นผลเสมอ (14 ต.ค. 69 "กดรีเฟรชแล้วไม่มีอะไรเกิดขึ้น") ──
  const selOps = () => opsCalls('select').filter(c => c.table === 'ops_tasks').length;
  $('opsStamp').textContent = '';
  $('opsRefresh').click();
  ok('กดรีเฟรช: ปุ่มเป็น "กำลังโหลด…" และกดซ้ำไม่ได้ระหว่างโหลด', $('opsRefresh').disabled === true && /กำลังโหลด/.test($('opsRefresh').textContent));
  await sleep(300);
  ok('รีเฟรชเสร็จ: ปุ่มกลับมากดได้ · ขึ้น "อัปเดตล่าสุด HH:MM:SS · N งาน" ทั้งที่ข้อมูลเท่าเดิม',
    $('opsRefresh').disabled === false && $('opsRefresh').textContent.trim() === '↻ รีเฟรช' &&
    /^อัปเดตล่าสุด \\d\\d:\\d\\d:\\d\\d · \\d+ งาน$/.test($('opsStamp').textContent), $('opsStamp').textContent);
  const origFrom = db.from;
  db.from = () => { throw new Error('เน็ตหลุดจำลอง'); };
  $('opsStamp').textContent = '';
  $('opsRefresh').click(); await sleep(300);
  db.from = origFrom;
  ok('คำขอล้มทั้งก้อน (reject/throw): แจ้งแถบแดง ไม่เงียบ · ปุ่มกลับมากดได้ · ไม่ขึ้นเวลา "อัปเดตล่าสุด" หลอก',
    /โหลด Ops Board ไม่สำเร็จ: เน็ตหลุดจำลอง/.test(document.body.innerText) && $('opsRefresh').disabled === false && $('opsStamp').textContent === '', document.body.innerText.slice(0, 160));
  $('opsRefresh').click(); await sleep(300);
  OPS.tasks.push({ ...OPS.tasks[0], id: 'tpoll', title: 'งานใหม่ที่ผู้จัดการเพิ่มเอง' });
  const selBefore = selOps();
  OPS_POLL_MS = 150; opsPollSchedule();
  await sleep(700);
  ok('โพลล์เบาตอนเปิดหมวด OPS: งานที่ฝั่งผู้จัดการเขียนโผล่เองโดยไม่ต้องกดรีเฟรช', selOps() > selBefore && titles().includes('งานใหม่ที่ผู้จัดการเพิ่มเอง'), titles().join(' | '));
  showSection('home'); await sleep(100);
  const selAway = selOps();
  await sleep(600);
  ok('ไม่ได้อยู่หมวด OPS: โพลล์ไม่ยิงคำขอไปที่ ops_tasks', selOps() === selAway, selAway + ' → ' + selOps());
  OPS_POLL_MS = 60000; opsPollSchedule();
  showSection('ops'); await sleep(300);
  const selR = selOps();
  OPS.tasks = OPS.tasks.filter(t => t.id !== 'tpoll');
  await resyncAll(); await sleep(300);
  ok('กลับมาที่แท็บ/เน็ตกลับมา (resyncAll) ตอนอยู่หมวด OPS: โหลด OPS ใหม่ งานที่ถูกลบหายจากหน้า', selOps() > selR && !titles().includes('งานใหม่ที่ผู้จัดการเพิ่มเอง'));
  ok('ป้ายอัปเดตล่าสุดอยู่ในกรอบตัวหนังสือ ≥ 14px', parseFloat(getComputedStyle($('opsStamp')).fontSize) >= 13.95);
  ok('ตัวหนังสือทุกส่วนของหมวด ≥ 14px', [...document.querySelectorAll('#sec-ops *')].filter(e => e.children.length === 0 && e.textContent.trim() && vis(e)).every(e => parseFloat(getComputedStyle(e).fontSize) >= 13.95),
    [...new Set([...document.querySelectorAll('#sec-ops *')].filter(e => e.children.length === 0 && e.textContent.trim() && vis(e) && parseFloat(getComputedStyle(e).fontSize) < 13.95).map(e => e.className + ' ' + getComputedStyle(e).fontSize))].join(' | '));
  ok('ทุกมุมเป็นเหลี่ยม (border-radius 0) ในหมวด', [...document.querySelectorAll('#sec-ops .ops-task, #sec-ops .ops-group h3, #sec-ops .btn, #sec-ops .st, #sec-ops select')].every(e => getComputedStyle(e).borderRadius === '0px'));

  // ── 1b. ช่วยคิด (Claude) — ปุ่มบนงาน · หน้าต่าง · คำตอบเก่า · ข้อผิดพลาด · ปิดกลางทาง ──────────────
  const aiBtn = id => card(id).querySelector('[data-act=ai]');
  const aiFn = () => CALLS.filter(c => c.op === 'fn' && c.name === 'ai');
  const aiWrites = () => opsCalls().filter(c => c.table === 'ops_task_ai' && c.op !== 'select');
  const aiAnswers = () => [...document.querySelectorAll('#opsAiList .ops-ai-ans')];
  const askBtns = () => [$('opsAiDraft'), $('opsAiSteps')];
  const aiOut = i => aiAnswers()[i].querySelector('.ops-ai-out').textContent;
  let release;
  ok('ปุ่ม "ช่วยคิด" มีในงานทั่วไป (อีเมล / คอนเทนต์)', !!aiBtn('t1') && !!aiBtn('t8'));
  ok('งานหมวด "ระบบ/บอท": ไม่มีปุ่ม + บอกเหตุผลสั้น ๆ บนการ์ด', !aiBtn('t5') && /ตัวช่วยคิดไม่รับงานหมวดนี้/.test(card('t5').textContent));
  const nBefore = CALLS.length;
  openOpsAi('t5'); await sleep(100);
  ok('เรียก openOpsAi กับงานหมวดระบบตรง ๆ: หน้าต่างไม่เปิด · ไม่มีคำขอไปที่ฟังก์ชัน ai หรือตาราง ops_task_ai', !$('opsAiDialog').open && CALLS.slice(nBefore).filter(c => c.name === 'ai' || c.table === 'ops_task_ai').length === 0);
  ok('ยังไม่กดอะไร = ยังไม่มีคำขอไปที่ฟังก์ชัน ai', aiFn().length === 0);

  aiBtn('t1').click(); await sleep(250);
  ok('กด "ช่วยคิด": เปิดหน้าต่าง · แสดงชื่องาน', $('opsAiDialog').open && $('opsAiTask').textContent === 'ตอบอีเมลมหาจักรเรื่องรายงานแอด');
  ok('บอกก่อนใช้: เนื้องานถูกส่งไป Claude ของ Anthropic · เป็นร่างให้ตรวจเอง · โควตาวันละ 20 ครั้ง', /Anthropic/.test($('opsAiDialog').textContent) && /ร่างให้ตรวจเอง/.test($('opsAiDialog').textContent) && /วันละ 20 ครั้ง/.test($('opsAiDialog').textContent));
  ok('เปิดหน้าต่างแล้วยังไม่ยิง ai เอง · โหลดคำตอบเก่า 2 รายการ จาก ops_task_ai เฉพาะงานนี้', aiFn().length === 0 && aiAnswers().length === 2 &&
    opsCalls('select').some(c => c.table === 'ops_task_ai' && c.filters.some(f => f.join('=') === 'task_id=t1')), aiAnswers().length + ' · ' + JSON.stringify(opsCalls('select').filter(c => c.table === 'ops_task_ai').map(c => c.filters)));
  const metas = () => aiAnswers().map(a => a.querySelector('.ops-ai-meta span').textContent);
  ok('คำตอบเก่าเรียงใหม่สุดก่อน (ขั้นตอน เมื่อวาน → ร่างข้อความ เมื่อ 2 วันก่อน)', /^ขั้นตอน/.test(metas()[0]) && /^ร่างข้อความ/.test(metas()[1]), metas().join(' | '));
  ok('เนื้อคำตอบเก่าแสดงเป็นข้อความ (แท็ก <b> ไม่ถูกตีความ) · คงบรรทัดใหม่ (pre-wrap)', /<b>ฉบับเก่า<\\/b>/.test(aiOut(1)) && !document.querySelector('#opsAiList b') && /\\n/.test(aiOut(1)) &&
    getComputedStyle(aiAnswers()[1].querySelector('.ops-ai-out')).whiteSpace === 'pre-wrap');

  release = null; OPS.aiGate = new Promise(r => { release = r; });
  $('opsAiDraft').click(); await sleep(100);
  ok('กด "ร่างข้อความ": ส่งไป ai ด้วย {task_id, kind} เท่านั้น (ไม่มี prompt ใด ๆ จากหน้าเว็บ)', aiFn().length === 1 && JSON.stringify(aiFn()[0].body) === '{"task_id":"t1","kind":"draft"}', JSON.stringify(aiFn().map(c => c.body)));
  ok('ระหว่างรอ: บอกว่ากำลังคิด · ปุ่มเลือกแบบคำขอกดซ้ำไม่ได้', /กำลังให้ Claude คิด/.test($('opsAiStatus').textContent) && askBtns().every(b => b.disabled));
  $('opsAiSteps').click(); opsAiAsk('steps'); await sleep(100);   // ไม่ await — ถ้าไม่มีตัวกันกดซ้ำ คำขอที่สองจะค้างรอ gate เดียวกัน เทสต์ต้องตกที่ข้อนับ ไม่ใช่ค้างทั้งชุด
  ok('กดซ้ำ / เรียกซ้ำระหว่างรอ: ไม่ยิงฟังก์ชันซ้ำ (ไม่กินโควตาเพิ่ม)', aiFn().length === 1, aiFn().length);
  OPS.aiGate = null; release(); await sleep(250);
  ok('ได้คำตอบ: ขึ้นบนสุด ติดป้าย "ใหม่" · รวม 3 รายการ · ปุ่มกลับมากดได้ · แจ้งโควตา "3 \/ 20"', aiAnswers().length === 3 && aiAnswers()[0].classList.contains('fresh') && /^ร่างข้อความ · .*ใหม่/.test(metas()[0]) &&
    !askBtns().some(b => b.disabled) && /วันนี้ใช้แล้ว 3 \\/ 20 ครั้ง/.test($('opsAiStatus').textContent), metas().join(' | ') + ' · ' + $('opsAiStatus').textContent);
  ok('คำตอบที่มีแท็ก HTML ถูกแสดงเป็นข้อความ ไม่ถูกรัน (กัน XSS)', !window.__xss && !document.querySelector('#opsAiList img') && /<img src=x/.test(aiOut(0)));
  ok('หน้าเว็บไม่เขียน ops_task_ai เอง (ฟังก์ชันฝั่งเซิร์ฟเวอร์เป็นคนบันทึก)', aiWrites().length === 0, JSON.stringify(aiWrites()));
  let copied = null;
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { copied = t; } }, configurable: true });
  aiAnswers()[0].querySelector('[data-act=copy]').click(); await sleep(100);
  ok('ปุ่ม "คัดลอก": ได้เนื้อคำตอบนั้นทั้งก้อน (ไม่รวมหัวป้าย) · มีข้อความยืนยัน', copied === aiOut(0) && /ตัวอย่างร่าง/.test(copied) && !/ใหม่/.test(copied) && /คัดลอกคำตอบแล้ว/.test($('toast').textContent), copied);
  if (${JSON.stringify(!!SHOTS)}) await shot('ops-ai-dialog-1440.png');
  ok('หน้าต่างช่วยคิด: ตัวหนังสือ ≥ 14px ทุกส่วน', [...document.querySelectorAll('#opsAiDialog *')].filter(e => e.children.length === 0 && e.textContent.trim() && vis(e)).every(e => parseFloat(getComputedStyle(e).fontSize) >= 13.95),
    [...new Set([...document.querySelectorAll('#opsAiDialog *')].filter(e => e.children.length === 0 && e.textContent.trim() && vis(e) && parseFloat(getComputedStyle(e).fontSize) < 13.95).map(e => e.className + ' ' + getComputedStyle(e).fontSize))].join(' | '));
  ok('หน้าต่างช่วยคิด: ทุกมุมเป็นเหลี่ยม · ไม่ล้นจอ', [...document.querySelectorAll('#opsAiDialog .btn, #opsAiDialog .ops-ai-ans, #opsAiDialog .alert')].every(e => getComputedStyle(e).borderRadius === '0px') &&
    $('opsAiDialog').getBoundingClientRect().right <= innerWidth && $('opsAiDialog').getBoundingClientRect().bottom <= innerHeight);

  for (const [mode, re, cls] of [['not_configured', /ANTHROPIC_API_KEY/, 'alert-warn'], ['quota', /พรุ่งนี้/, 'alert-warn'], ['fail', /ไม่ว่างชั่วคราว/, 'alert-red']]) {
    OPS.aiMode = mode;
    const n = aiAnswers().length, nc = aiFn().length;
    $('opsAiSteps').click(); await sleep(200);
    const al = $('opsAiStatus').querySelector('.alert');
    ok('ฟังก์ชันตอบ ' + mode + ': ข้อความภาษาไทยบอกวิธีไปต่อ (' + cls + ') · คำตอบเดิมไม่หาย · ปุ่มกลับมากดได้',
      aiFn().length === nc + 1 && !!al && al.classList.contains(cls) && re.test(al.textContent) && aiAnswers().length === n && !askBtns().some(b => b.disabled), al && al.className + ' | ' + al.textContent);
  }
  OPS.aiMode = 'warn'; $('opsAiSteps').click(); await sleep(200);
  ok('ฟังก์ชันตอบได้แต่บันทึกไม่สำเร็จ: ยังแสดงคำตอบ + เตือนให้คัดลอกเก็บไว้ก่อน', aiAnswers().length === 4 && /คัดลอกเก็บไว้ก่อน/.test($('opsAiStatus').textContent) && !!$('opsAiStatus').querySelector('.alert-warn'));
  OPS.aiMode = 'ok';
  ok('ตลอดชุดนี้ หน้าเว็บไม่เคยเขียน ops_task_ai เอง', aiWrites().length === 0);

  $('opsAiClose').click(); await sleep(50);
  ok('ปุ่ม "ปิด" ปิดหน้าต่าง · ล้างสถานะหน้าต่าง', !$('opsAiDialog').open && opsAi === null);
  OPS.fail.aiHistory = 'พังจำลอง';
  aiBtn('t1').click(); await sleep(250);
  ok('โหลดคำตอบเก่าไม่สำเร็จ: เตือนในหน้าต่าง ไม่ล้มทั้งหน้า · ยังกดถามได้', $('opsAiDialog').open && /โหลดคำตอบเก่าไม่สำเร็จ: พังจำลอง/.test($('opsAiStatus').textContent) && !askBtns().some(b => b.disabled));
  OPS.fail.aiHistory = null; OPS.missing = true; $('opsAiClose').click(); aiBtn('t1').click(); await sleep(250);
  ok('ยังไม่ได้รัน 033 (ไม่มีตาราง ops_task_ai): บอกให้รัน migration ไม่ใช่ error ดิบ', /ต้องรัน migration 033/.test($('opsAiStatus').textContent));
  OPS.missing = false; $('opsAiClose').click(); await sleep(50);

  aiBtn('t1').click(); await sleep(250);
  const nHist = OPS.aiRows.filter(r => r.task_id === 't1').length;
  ok('เปิดใหม่: ประวัติตรงกับฐานข้อมูล (คำตอบที่บันทึกแล้วทุกอัน · ไม่มีป้าย "ใหม่" ค้าง)', aiAnswers().length === nHist && !document.querySelector('#opsAiList .fresh') && $('opsAiStatus').textContent === '', aiAnswers().length + ' vs ' + nHist);
  release = null; OPS.aiGate = new Promise(r => { release = r; });
  $('opsAiDraft').click(); await sleep(100);
  $('opsAiClose').click(); await sleep(50);
  OPS.aiGate = null; release(); await sleep(250);
  ok('ปิดหน้าต่างระหว่างรอคำตอบ: คำตอบที่มาทีหลังไม่ถูกวาดลงหน้า · ไม่มี error', !$('opsAiDialog').open && !document.querySelector('#opsAiList .fresh') && !/วันนี้ใช้แล้ว/.test($('opsAiStatus').textContent));
  aiBtn('t1').click(); await sleep(250);
  ok('เปิดใหม่หลังนั้น: เห็นคำตอบที่ฟังก์ชันบันทึกไว้ในประวัติ (ไม่เสียของ)', aiAnswers().length === nHist + 1 && !document.querySelector('#opsAiList .fresh'), aiAnswers().length + ' vs ' + (nHist + 1));
  $('opsAiClose').click(); await sleep(50);

  // ── 1c. สั่ง Claude ทำงานต่อ (034) — คำสั่งเข้าคิว · สถานะ · ผลที่ Claude เขียนกลับ · ยกเลิก · ยังไม่ได้รัน 034 ─────────────
  setFilter('open'); await frames();
  const ordBtn = (id, a) => card(id) && card(id).querySelector('[data-act=' + a + ']');
  const ordCalls = () => opsCalls().filter(c => c.table === 'ops_task_orders');
  const ordWrites = () => ordCalls().filter(c => c.op !== 'select');
  const submitOrder = async () => { $('opsOrdForm').requestSubmit(); await sleep(300); };
  const orderOf = id => OPS.orders.filter(o => o.task_id === id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  const refresh = async () => { $('opsRefresh').click(); await sleep(350); };
  ok('โหลดคำสั่งพร้อมงาน: select ops_task_orders (ใหม่สุดก่อน)', ordCalls().some(c => c.op === 'select'));
  ok('t2 Claude รับแล้ว: ป้ายเป็นคำ "Claude รับแล้ว กำลังทำ" + รับโดย session · มีปุ่ม "ยกเลิกคำสั่ง" · ไม่มีปุ่ม "สั่ง Claude"',
    /Claude รับแล้ว กำลังทำ/.test(card('t2').textContent) && /รับโดย session-พนักงาน-1/.test(card('t2').textContent) && !!ordBtn('t2', 'ordcancel') && !ordBtn('t2', 'order'));
  ok('t4 คำสั่งล้มเหลว: ป้าย "ทำไม่สำเร็จ" (st-bad) + ผลที่ Claude เขียนกลับแสดงครบ · คิวว่างแล้ว = มีปุ่ม "สั่ง Claude" ใหม่',
    !!card('t4').querySelector('.ops-order .st-bad') && /ปฏิเสธ: ต้องเข้าบัญชีโฆษณา/.test(card('t4').querySelector('.ops-order-res').textContent) && !!ordBtn('t4', 'order') && !ordBtn('t4', 'ordcancel'));
  ok('งานที่ยังไม่เคยสั่ง (t1 · t8) และงานหมวดระบบ (t5): มีปุ่ม "สั่ง Claude" · ไม่มีกล่องคำสั่ง (คำสั่งไป Claude ใน session ขององค์กร ไม่ใช่ไป API ภายนอก จึงไม่กันหมวดระบบเหมือนช่วยคิด)',
    !!ordBtn('t1', 'order') && !!ordBtn('t8', 'order') && !!ordBtn('t5', 'order') && !card('t1').querySelector('.ops-order'));
  setFilter('done'); await frames();
  ok('งานที่เสร็จแล้ว: ไม่มีปุ่ม "สั่ง Claude"', !!card('t6') && !ordBtn('t6', 'order') && !ordBtn('t7', 'order'));
  setFilter('open'); await frames();

  const latestAi = OPS.aiRows.filter(r => r.task_id === 't1').sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0].id;
  const aiN = OPS.aiRows.filter(r => r.task_id === 't1').length;
  ordBtn('t1', 'order').click(); await sleep(300);
  ok('กด "สั่ง Claude": เปิดหน้าต่าง · แสดงชื่องาน · บอกว่าเข้าคิวแล้วผู้จัดการข้อมูลภายในรับไปให้ Claude · งานออกนอกร้านต้องถามเจ้าของก่อน',
    $('opsOrderDialog').open && $('opsOrdTask').textContent === 'ตอบอีเมลมหาจักรเรื่องรายงานแอด' && /ผู้จัดการข้อมูลภายใน/.test($('opsOrderDialog').textContent) && /ถามเจ้าของยืนยัน/.test($('opsOrderDialog').textContent));
  const aiOpts = [...$('opsOrdAi').options].map(o => o.textContent);
  ok('ตัวเลือกแนบคำตอบช่วยคิด: "ไม่แนบ" + ของงานนี้ทุกอัน · ใหม่สุดเป็นค่าเริ่มต้น (สั่งต่อจากที่เพิ่งช่วยคิดได้ในคลิกเดียว)', aiOpts[0] === 'ไม่แนบ' && aiOpts.length === 1 + aiN && $('opsOrdAi').value === latestAi, aiOpts.length + ' vs ' + (1 + aiN) + ' · ' + $('opsOrdAi').value + ' vs ' + latestAi);
  await submitOrder();
  ok('ไม่พิมพ์คำสั่ง: ขึ้นข้อความในหน้าต่าง · ไม่ส่งอะไรไปฐานข้อมูล · หน้าต่างไม่ปิด', $('opsOrderDialog').open && !$('opsOrdErr').hidden && /ให้ทำอะไร/.test($('opsOrdErr').textContent) && ordWrites().length === 0);
  $('opsOrdText').value = '  ตอบอีเมลฉบับนี้ตามร่างที่แนบ  '; await submitOrder();
  const insO = ordWrites().pop();
  ok('ส่งเข้าคิว: insert เฉพาะ {task_id, instruction (ตัดช่องว่าง), ai_answer_id} — ไม่ส่ง status / result / created_by เอง',
    !!insO && insO.op === 'insert' && JSON.stringify(Object.keys(insO.payload).sort()) === '["ai_answer_id","instruction","task_id"]' && insO.payload.task_id === 't1' &&
    insO.payload.instruction === 'ตอบอีเมลฉบับนี้ตามร่างที่แนบ' && insO.payload.ai_answer_id === latestAi, JSON.stringify(ins && insO.payload));
  ok('หน้าต่างปิด · การ์ด t1 มีกล่อง "รอ Claude รับ" + คำสั่ง · ปุ่ม "สั่ง Claude" กลายเป็น "ยกเลิกคำสั่ง" · มีข้อความยืนยัน',
    !$('opsOrderDialog').open && /รอ Claude รับ/.test(card('t1').querySelector('.ops-order').textContent) && /ตอบอีเมลฉบับนี้ตามร่างที่แนบ/.test(card('t1').querySelector('.ops-order-text').textContent) &&
    !ordBtn('t1', 'order') && !!ordBtn('t1', 'ordcancel') && /ส่งเข้าคิวแล้ว/.test($('toast').textContent));
  if (${JSON.stringify(!!SHOTS)}) await shot('ops-order-1440.png');

  // ฝั่ง Claude เดินสถานะ (ผ่านฟังก์ชันในฐานข้อมูล) — หน้าเว็บเห็นหลังรีเฟรช
  const o1 = orderOf('t1');
  OPS.agent(o1.id, 'picked', null, 'session-พนักงาน-2'); await refresh();
  ok('Claude รับแล้ว (หลังรีเฟรช): ป้าย "Claude รับแล้ว กำลังทำ" + รับโดย session-พนักงาน-2 · ยังมีปุ่มยกเลิก', /Claude รับแล้ว กำลังทำ/.test(card('t1').textContent) && /รับโดย session-พนักงาน-2/.test(card('t1').textContent) && !!ordBtn('t1', 'ordcancel'));
  OPS.agent(o1.id, 'done', 'ร่างพร้อม รอเจ้าของยืนยัน\\n<img src=x onerror="window.__xss=3">'); await refresh();
  ok('Claude ทำแล้ว: ป้าย "Claude ทำแล้ว" (st-ok) · ผลแสดงเป็นข้อความคงบรรทัดใหม่ ไม่รันสคริปต์ (กัน XSS) · ปุ่ม "สั่ง Claude" กลับมา · ไม่มีปุ่มยกเลิก',
    !!card('t1').querySelector('.ops-order .st-ok') && !window.__xss && !card('t1').querySelector('.ops-order img') && /<img src=x/.test(card('t1').querySelector('.ops-order-res').textContent) &&
    getComputedStyle(card('t1').querySelector('.ops-order-res')).whiteSpace === 'pre-wrap' && !!ordBtn('t1', 'order') && !ordBtn('t1', 'ordcancel'));

  // ยกเลิก: ตอน queued (t5) · ตอน picked (t2) · สถานะเปลี่ยนไปแล้วระหว่างรอ (t8)
  ordBtn('t5', 'order').click(); await sleep(300);
  ok('งานที่ไม่มีคำตอบช่วยคิด (t5): ตัวเลือกแนบมีแค่ "ไม่แนบ"', $('opsOrdAi').options.length === 1);
  $('opsOrdText').value = 'ไล่จัดโฟลเดอร์ไดรฟ์ตามหมวด'; await submitOrder();
  const i5 = ordWrites().pop();
  ok('สั่งงานหมวดระบบได้ · insert ไม่มี ai_answer_id (ไม่แนบ = ไม่ส่งคีย์นี้)', i5.payload.task_id === 't5' && !('ai_answer_id' in i5.payload) && /รอ Claude รับ/.test(card('t5').textContent));
  ordBtn('t5', 'ordcancel').click(); await sleep(150);
  ok('กด "ยกเลิกคำสั่ง" (queued): ขึ้นหน้าต่างยืนยันที่ระบุคำสั่ง · บอกว่ายังไม่มีใครรับ · ยังไม่ยิงอะไร',
    $('confirmDialog').open && /ไล่จัดโฟลเดอร์ไดรฟ์/.test($('confirmBody').textContent) && /ยังไม่มีใครรับ/.test($('confirmBody').textContent) && !ordWrites().some(c => c.op === 'update'));
  $('confirmOkBtn').click(); await sleep(300);
  const u5 = ordWrites().pop();
  ok('ยืนยัน: update เฉพาะ {status: cancelled} ที่ id นั้น + เงื่อนไข status อยู่ใน queued/picked · การ์ดเป็น "ยกเลิกแล้ว" · ปุ่ม "สั่ง Claude" กลับมา · ไม่มีคำสั่งลบ',
    u5.op === 'update' && JSON.stringify(u5.payload) === '{"status":"cancelled"}' && u5.filters[0][1] === orderOf('t5').id && JSON.stringify(u5.ins[0]) === '["status",["queued","picked"]]' &&
    /ยกเลิกแล้ว/.test(card('t5').textContent) && !!ordBtn('t5', 'order') && !ordCalls().some(c => c.op === 'delete'), JSON.stringify(u5));

  ordBtn('t2', 'ordcancel').click(); await sleep(150);
  ok('ยกเลิกตอน Claude รับแล้ว (t2): หน้าต่างยืนยันเตือนว่าไม่ย้อนสิ่งที่ Claude ทำไปแล้ว', $('confirmDialog').open && /ไม่ย้อนสิ่งที่ Claude ทำไปแล้ว/.test($('confirmBody').textContent) && /หาราคา Serato/.test($('confirmBody').textContent));
  const nU = ordWrites().length;
  $('confirmDialog').close(); await sleep(50);
  ok('ปิดหน้าต่างยืนยัน = ไม่ยกเลิก (คำสั่งยังอยู่ ไม่มีคำสั่งใหม่ไปฐานข้อมูล)', ordWrites().length === nU && /Claude รับแล้ว กำลังทำ/.test(card('t2').textContent));
  ordBtn('t2', 'ordcancel').click(); await sleep(150); $('confirmOkBtn').click(); await sleep(300);
  ok('ยืนยันยกเลิกตอน picked: การ์ดเป็น "ยกเลิกแล้ว" (session ที่รับไปตายกลางทาง เจ้าของไม่ติดค้าง)', /ยกเลิกแล้ว/.test(card('t2').textContent) && !!ordBtn('t2', 'order'));

  // สั่งซ้ำตอนมีคำสั่งค้างอยู่ในฐานข้อมูลแต่หน้ายังไม่รู้ (เปิดสองเครื่อง) — unique ของฐานข้อมูลกัน หน้าเว็บบอกชัด
  ordBtn('t8', 'order').click(); await sleep(250);
  OPS.orders.push({ id: 'o-other', task_id: 't8', instruction: 'สั่งจากอีกเครื่อง', ai_answer_id: null, status: 'queued', result: null, picked_by: null, created_by: 'u1', created_at: new Date().toISOString(), picked_at: null, finished_at: null });
  $('opsOrdText').value = 'สั่งซ้ำ'; await submitOrder();
  ok('งานนี้มีคำสั่งค้างอยู่แล้ว (สั่งจากอีกเครื่อง): หน้าต่างบอกชัดเจน ไม่ปิด · โหลดใหม่ให้เห็นคำสั่งเดิมบนการ์ด', $('opsOrderDialog').open && /มีคำสั่งค้างอยู่แล้ว/.test($('opsOrdErr').textContent) && $('opsOrdSave').disabled === false, $('opsOrdErr').textContent);
  await sleep(300);
  ok('การ์ด t8 แสดงคำสั่งที่ค้างอยู่จริง (สั่งจากอีกเครื่อง)', /สั่งจากอีกเครื่อง/.test(card('t8').textContent) && !!ordBtn('t8', 'ordcancel'));
  $('opsOrderDialog').close(); await sleep(50);
  // กดยกเลิกในหน้า แต่ระหว่างรอยืนยัน Claude รับและทำเสร็จไปแล้ว → ฐานข้อมูลไม่ยอม (ไม่โดนแถวไหน) หน้าต้องไม่หลอกว่ายกเลิกสำเร็จ
  ordBtn('t8', 'ordcancel').click(); await sleep(150);
  OPS.agent('o-other', 'picked', null, 'session-พนักงาน-1'); OPS.agent('o-other', 'done', 'ทำเสร็จก่อนยกเลิก');
  $('confirmOkBtn').click(); await sleep(400);
  ok('ยกเลิกแต่ Claude ทำเสร็จไปแล้ว: ฐานข้อมูลไม่โดนแถวไหน → บอกว่าสถานะเปลี่ยนไปแล้ว · โหลดใหม่ให้เห็น "Claude ทำแล้ว" + ผล (ไม่หลอกว่ายกเลิกสำเร็จ)',
    /เปลี่ยนสถานะไปแล้ว/.test($('toast').textContent) && /Claude ทำแล้ว/.test(card('t8').textContent) && /ทำเสร็จก่อนยกเลิก/.test(card('t8').textContent) && OPS.orders.find(o => o.id === 'o-other').status === 'done');

  // ฐานข้อมูลล้ม
  OPS.fail.orders_insert = 'พังจำลอง';
  ordBtn('t4', 'order').click(); await sleep(250); $('opsOrdText').value = 'คำสั่งที่ส่งไม่ได้'; await submitOrder();
  ok('ส่งเข้าคิวไม่สำเร็จ: แจ้งในหน้าต่าง · หน้าต่างไม่ปิด · ข้อความที่พิมพ์ไม่หาย · ปุ่มกดซ้ำได้', $('opsOrderDialog').open && /ส่งเข้าคิวไม่สำเร็จ: พังจำลอง/.test($('opsOrdErr').textContent) && $('opsOrdText').value === 'คำสั่งที่ส่งไม่ได้' && $('opsOrdSave').disabled === false);
  OPS.fail.orders_insert = null; await submitOrder();
  ok('กดส่งซ้ำหลังฐานข้อมูลกลับมา: เข้าคิวได้ (t4)', !$('opsOrderDialog').open && /รอ Claude รับ/.test(card('t4').textContent));
  OPS.fail.orders_update = 'พังจำลอง';
  ordBtn('t4', 'ordcancel').click(); await sleep(150); $('confirmOkBtn').click(); await sleep(300);
  ok('ยกเลิกไม่สำเร็จ: แจ้งความล้มเหลว · คำสั่งยังอยู่ในสถานะเดิม (ไม่หลอกว่าสำเร็จ)', /ยกเลิกคำสั่งไม่สำเร็จ/.test(document.body.innerText) && /รอ Claude รับ/.test(card('t4').textContent));
  OPS.fail.orders_update = null;
  OPS.fail.orders_select = 'พังจำลอง'; await refresh();
  ok('โหลดคำสั่งไม่สำเร็จ: เตือนในแถบ แต่รายการงานยังใช้ได้ (ไม่ทำให้ทั้งบอร์ดล้ม)', /โหลดคำสั่งถึง Claude ไม่สำเร็จ: พังจำลอง/.test($('opsAlert').textContent) && titles().length > 0);
  OPS.fail.orders_select = null;
  OPS.noOrders = true; await refresh();
  ok('ยังไม่ได้รัน 034 (หน้าเว็บขึ้นก่อนตาราง): ซ่อนปุ่ม/กล่องคำสั่งเงียบ ๆ · ไม่มีข้อความ error · งานและปุ่ม "ช่วยคิด" ใช้ได้ตามปกติ',
    !document.querySelector('#opsBoard [data-act=order], #opsBoard [data-act=ordcancel], #opsBoard .ops-order') && $('opsAlert').textContent.trim() === '' && titles().length > 0 && !!ordBtn('t1', 'ai'));
  openOpsOrder('t1'); await sleep(100);
  ok('เรียก openOpsOrder ตอนยังไม่มี 034 ตรง ๆ: หน้าต่างไม่เปิด · บอกให้รัน migration 034', !$('opsOrderDialog').open && /รัน migration 034/.test($('toast').textContent));
  OPS.noOrders = false; await refresh();
  ok('รัน 034 แล้วรีเฟรช: ปุ่มและกล่องคำสั่งกลับมา', !!document.querySelector('#opsBoard [data-act=order]') && !!document.querySelector('#opsBoard .ops-order'));
  ok('งานที่เคยสั่งหลายรอบ (t4: ล้มเหลว แล้วสั่งใหม่): หลังโหลดใหม่ การ์ดแสดงคำสั่ง "ล่าสุด" (รอ Claude รับ) ไม่ใช่รอบเก่า (ทำไม่สำเร็จ)',
    /รอ Claude รับ/.test(card('t4').querySelector('.ops-order').textContent) && !/ทำไม่สำเร็จ/.test(card('t4').querySelector('.ops-order').textContent));

  // ปิดหน้าต่างระหว่างส่ง: คำสั่งเข้าฐานข้อมูลไปแล้ว ต้องขึ้นบนการ์ด (ไม่ใช่ปล่อยหน้าว่า "ไม่มีคำสั่ง" ทั้งที่ Claude กำลังจะมารับ)
  ordBtn('t1', 'order').click(); await sleep(250);
  $('opsOrdText').value = 'สั่งแล้วปิดหน้าต่างก่อนเสร็จ';
  let rel2 = null; OPS.ordGate = new Promise(r => { rel2 = r; });
  $('opsOrdForm').requestSubmit(); await sleep(100);
  $('opsOrderDialog').close(); await sleep(50);
  OPS.ordGate = null; rel2(); await sleep(300);
  ok('ปิดหน้าต่างระหว่างส่ง: คำสั่งที่เข้าฐานข้อมูลแล้วยังขึ้นบนการ์ด (รอ Claude รับ + ปุ่มยกเลิก) · หน้าต่างยังปิดอยู่ · ไม่มี error',
    !$('opsOrderDialog').open && /สั่งแล้วปิดหน้าต่างก่อนเสร็จ/.test(card('t1').textContent) && /รอ Claude รับ/.test(card('t1').querySelector('.ops-order').textContent) && !!ordBtn('t1', 'ordcancel'));
  ordBtn('t1', 'ordcancel').click(); await sleep(150); $('confirmOkBtn').click(); await sleep(300);   // คืนงาน t1 ให้ว่าง (ส่วนที่ 3 ใช้ต่อ)
  ok('ยกเลิกคำสั่งที่เพิ่งสั่ง: t1 กลับมาสั่งใหม่ได้', /ยกเลิกแล้ว/.test(card('t1').querySelector('.ops-order').textContent) && !!ordBtn('t1', 'order'));
  ok('คำสั่งถึง Claude: ตัวหนังสือ ≥ 14px ทุกส่วน · ทุกมุมเป็นเหลี่ยม · หน้าเว็บไม่เคยลบแถวใน ops_task_orders',
    [...document.querySelectorAll('#opsBoard .ops-order *, #opsOrderDialog *')].filter(e => e.children.length === 0 && e.textContent.trim() && vis(e)).every(e => parseFloat(getComputedStyle(e).fontSize) >= 13.95) &&
    [...document.querySelectorAll('#opsBoard .ops-order, #opsBoard .ops-order .st, #opsBoard .ops-order-res')].every(e => getComputedStyle(e).borderRadius === '0px') && !ordCalls().some(c => c.op === 'delete'));

  // ── 2. admin / staff ─────────────────────────────────────────────────
  for (const [who, label] of [['nui', 'admin (ผู้ดูแลระบบ)'], ['zen', 'staff (พนักงาน)']]) {
    doLogout(); await sleep(400);
    CALLS.length = 0;
    await login(who);
    ok(label + ': ไม่เห็นเมนู Ops Board', !document.querySelector('#navList .nav-item[data-s="ops"]'));
    const r = showSection('ops');
    ok(label + ': showSection("ops") ถูกปฏิเสธ + แจ้งว่าเฉพาะเจ้าของร้าน', r === false && /เฉพาะเจ้าของร้าน/.test($('toast').textContent) && $('sec-ops').hidden);
    await loadOps(); await sleep(150);
    ok(label + ': ไม่มีคำขอไปที่ตาราง ops_* เลย (แม้เรียก loadOps ตรงๆ)', opsCalls().length === 0, JSON.stringify(opsCalls()));
    ok(label + ': ไม่มีเนื้อหางานในหน้า', !/มหาจักร|Serato|เช็กรีวิว/.test(document.body.innerText) && ops.tasks.length === 0);
    const keyCombo = new KeyboardEvent('keydown', { code: 'KeyO', key: 'o', altKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(keyCombo); await sleep(100);
    ok(label + ': Alt+O ไม่พาเข้า Ops Board', $('sec-ops').hidden && current !== 'ops');
  }

  // ── 3. สลับบัญชีจากเจ้าของเป็นพนักงานบนเครื่องเดิม ──────────────────────
  doLogout(); await sleep(400);
  await login('tibass');
  showSection('ops'); await sleep(300);
  ok('(ตั้งต้น) เจ้าของเปิด Ops Board แล้วเห็นงาน', titles().length > 0 && /มหาจักร|Serato/.test(document.body.innerText));
  aiBtn('t1').click(); await sleep(250);
  release = null; OPS.aiGate = new Promise(r => { release = r; });
  $('opsAiDraft').click(); await sleep(100);
  ok('(ตั้งต้น) หน้าต่างช่วยคิดเปิดอยู่ มีคำตอบเก่า และกำลังรอคำตอบใหม่', $('opsAiDialog').open && aiAnswers().length > 0 && /กำลังให้ Claude คิด/.test($('opsAiStatus').textContent));
  ordBtn('t1', 'order').click(); await sleep(250);          // ซ้อนทับหน้าต่างช่วยคิดที่ยังเปิดอยู่ — ออกจากระบบต้องปิดทั้งสองบาน
  $('opsOrdText').value = 'ข้อความคำสั่งที่พิมพ์ค้างไว้ก่อนออกจากระบบ';
  ok('(ตั้งต้น) หน้าต่างสั่ง Claude เปิดอยู่พร้อมข้อความที่พิมพ์ไว้', $('opsOrderDialog').open && $('opsOrdText').value.length > 0);
  let rel3 = null; OPS.ordGate = new Promise(r => { rel3 = r; });
  $('opsOrdForm').requestSubmit(); await sleep(100);                  // กดส่งแล้วค้างรอฐานข้อมูล แล้วออกจากระบบ
  doLogout(); await sleep(400);
  OPS.ordGate = null; rel3(); await sleep(300);                       // คำตอบ "ส่งสำเร็จ" มาถึงหลังออกจากระบบแล้ว — ต้องไม่ถูกวาดลงหน้า
  OPS.aiGate = null; release(); await sleep(300);          // คำตอบมาถึงหลังออกจากระบบแล้ว — ต้องไม่ถูกวาดลงหน้า
  ok('ออกจากระบบกลางหน้าต่างสั่ง Claude: หน้าต่างปิด · ข้อความที่พิมพ์ค้างหาย · ชื่องานในหน้าต่างหาย · ไม่มีคำสั่งในหน่วยความจำ',
    !$('opsOrderDialog').open && opsOrd === null && $('opsOrdText').value === '' && $('opsOrdTask').textContent === '' && ops.orders.length === 0 && $('opsOrdAi').options.length === 1);
  ok('ออกจากระบบกลางคำขอช่วยคิด: หน้าต่างปิด · สถานะหน้าต่างว่าง · ไม่มีคำตอบ/ชื่องานค้างในหน้าต่าง แม้คำตอบมาทีหลัง',
    !$('opsAiDialog').open && opsAi === null && $('opsAiList').innerHTML === '' && $('opsAiTask').textContent === '' && $('opsAiStatus').innerHTML === '');
  const leakRe = /ข้อความคำสั่งที่พิมพ์ค้างไว้|ตอบอีเมลฉบับนี้ตามร่างที่แนบ|ร่างพร้อม รอเจ้าของยืนยัน|หาราคา Serato DJ Pro|session-พนักงาน|ไล่จัดโฟลเดอร์ไดรฟ์|สั่งจากอีกเครื่อง|ปฏิเสธ: ต้องเข้าบัญชีโฆษณา|ฉบับเก่า|ตัวอย่างร่าง|ขั้นแรก|รายงานแอด ก\.ย\.|ตอบอีเมลมหาจักร|ต่อ Serato|เช็กรีวิวใหม่|ไดรฟ์งานคอนเทนต์|รอยืนยันบัญชีโฆษณา|งานใหม่จากคอนโซล|ชื่อที่แก้แล้ว/;   // ข้อความเฉพาะของงานจริง (รายชื่อผู้รับผิดชอบเป็นค่าคงที่ ไม่นับ)
  const leakAt = [...document.querySelectorAll('body *')].filter(e => !/^(SCRIPT|STYLE)$/.test(e.tagName) && e.children.length === 0 && leakRe.test(e.textContent + (e.value || ''))).map(e => (e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + e.className));
  ok('ออกจากระบบ: Ops Board ถูกล้างออกจากหน้า (DOM + หน่วยความจำ)', !leakAt.length && ops.tasks.length === 0 && $('opsBoard').innerHTML.indexOf('ops-task') === -1, 'ค้างที่: ' + leakAt.join(', ') + ' · tasks=' + ops.tasks.length);
  await login('zen');
  ok('ล็อกอินเป็นพนักงานต่อ: เปิดหน้าแล้วไม่มีเนื้อหางานของเจ้าของ · ไม่ค้างอยู่หมวด Ops Board', current !== 'ops' && !/มหาจักร|Serato|เช็กรีวิว/.test(document.body.innerText));
  done();
}
function done() {
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

const net = '--host-resolver-rules=MAP * ~NOTFOUND';
const res = await runCdpPage({ root: pageRoot, file: 'desk.html', mock: MOCK3 + OPS_MOCK, tests: TESTS, width: 1440, height: 900, coarse: false, shotDir: SHOTS, flags: [net] });
console.log('\n=== desk-ops: ' + (res.ok ? 'ผ่าน' : 'ไม่ผ่านหรือไม่ได้รันจนจบ') + ' ===');
process.exit(res.ok ? 0 : 1);
