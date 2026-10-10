/**
 * เทสต์ "แนบไฟล์จากคลังไฟล์" ของ desk.html (migration 053) — ใบงาน (ตอนสั่ง/ส่งงาน) · คำขอ · ข้อความบนกระดาน
 *   รัน: node tests/desk-attach.mjs
 *   ทดสอบหน้าฉบับอื่น (mutation): ATTACH_ROOT=<โฟลเดอร์ที่มี desk.html> node tests/desk-attach.mjs
 *
 * ซ้อนฐานปลอม 4 ชั้น: desk-home3 (กระดาน) + WORK_MOCK (ใบงาน/คำขอ) + TRANSFER_MOCK (คลังไฟล์/ถัง) + ATT_MOCK (transfer_attachments + transfer_attach/detach ตามกติกา 053)
 * ตัวจริงของ SQL ตรวจกับ Postgres จริงแยก (053: 54 ข้อ) — ที่นี่ตรวจฝั่งหน้าจอ: ใครเห็นปุ่มอะไร · ส่งอะไรไปที่ฟังก์ชัน · แนบหลังบันทึกสำเร็จเท่านั้น · ล้มแล้วบอกตามจริง · ล้างหน้าตอนออกจากระบบ · ยังไม่รัน 053
 *
 *  1. ส่งงาน (Zen): ช่องแนบโผล่ · เลือกจากคลัง → รอแนบ (ยังไม่ส่งอะไรออก) · ไฟล์จากคลังไม่นับเป็นหลักฐาน · ส่งสำเร็จ → transfer_attach ctx submit:N
 *  2. หน้าต่างเลือกไฟล์: ไฟล์หมดอายุ/ถูกลบไม่ขึ้น · ค้นหา · เฉพาะถาวร · โฟลเดอร์ · แนบแล้วเลือกซ้ำไม่ได้ · เพดาน 20 · ชื่อไฟล์เป็นข้อความ (XSS)
 *  3. สั่งงาน (หลายผู้รับ = แนบทุกใบ) · แก้ใบ (ถอด+แนบ ตอนกดบันทึก · มีแต่ไฟล์ที่เปลี่ยนก็บันทึกได้)
 *  4. คำขอ · กระดาน: แนบตอนเขียน · เห็นชิป · สิทธิ์แนบ/ถอดของแต่ละตำแหน่ง · แนบทีหลัง/ถอดทันทีจากหน้ารายละเอียด
 *  5. เปิดดู/ดาวน์โหลดผ่าน transfer_open · ไฟล์หมดอายุ/ถูกลบ
 *  6. ล้ม: แนบไม่ผ่านหลังบันทึกสำเร็จ · โหลดล้ม · ยังไม่รัน 053 (ซ่อนเงียบ ๆ)
 *  7. ออกจากระบบ/สลับบัญชี: ไม่มีอะไรค้าง
 */

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { HARNESS } from './lib/page-test.mjs';
import { runCdpPage } from './lib/cdp-page.mjs';
import { WORK_MOCK } from './lib/worklist-mock.mjs';
import { TRANSFER_MOCK } from './lib/transfer-mock.mjs';
import { ATT_MOCK } from './lib/attach-mock.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { MOCK: MOCK3 } = await import(pathToFileURL(join(root, 'tests/desk-home3.mjs')).href);
const pageRoot = process.env.ATTACH_ROOT || root;
const SHOTS = process.env.ATTACH_SHOTS || null;       // ถ่ายภาพหน้าจอเก็บไว้ดู: ATTACH_SHOTS=<โฟลเดอร์> node tests/desk-attach.mjs
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const TESTS = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${HARNESS}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);
const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
const SHOTS_ON = ${SHOTS ? 'true' : 'false'};
async function shot(name) {
  if (!SHOTS_ON) return;
  await frames(); await sleep(150);
  await new Promise(r => { window.__shot = r; console.log('[SHOT] ' + name); });
}
async function login(name) {
  $('loginEmail').value = name + '@x';
  $('loginPassword').value = 'x';
  await doLogin();
  await sleep(500);
}
const rpcs = fn => CALLS.filter(c => c.op === 'rpc' && c.fn === fn);
const lastRpc = fn => rpcs(fn)[rpcs(fn).length - 1];
const txt = id => $(id).textContent;
const vis = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
const toast = () => $('toast').textContent;
const fatalText = () => (document.getElementById('fatalError') || {}).textContent || '';
const setVal = (id, v) => { const e = $(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
const closeAll = () => document.querySelectorAll('dialog[open]').forEach(d => d.close());
const dlgOpen = id => $(id).open;
const tab = n => document.querySelector('#workTabs .mail-tab[data-tab="' + n + '"]').click();
const taskOnServer = id => WORK.tasks.find(t => t.id === id);
const names = host => [...$(host).querySelectorAll('.att-chip .att-name')].map(e => e.textContent);
const hostBtn = (host, act) => $(host).querySelector('[data-att-act="' + act + '"]');
const hostVisible = host => { const w = $(host).closest('.att-field'); return !!w && !w.hidden && vis(w); };
const pickRows = () => [...$('attList').querySelectorAll('.att-prow')];
const pickFiles = () => [...$('attList').querySelectorAll('.att-prow input[type=checkbox]')].map(c => c.dataset.id);
const pickDirs = () => [...$('attList').querySelectorAll('.att-dir .att-name')].map(e => e.textContent);
const tick = (id) => { const c = $('attList').querySelector('input[data-id="' + id + '"]'); if (!c) return false; c.checked = !c.checked; c.dispatchEvent(new Event('change', { bubbles: true })); return true; };
async function openPicker(host) { hostBtn(host, 'h-add').click(); await sleep(250); }
const attRows = (kind, target, ctx) => ATT.rows.filter(r => r.target_kind === kind && r.target_id === target && (ctx == null || r.ctx === ctx)).map(r => r.file_id).sort().join(',');
const lastEv = (id, kind) => WORK.events.filter(e => e.task_id === id && (!kind || e.kind === kind)).pop();
const submitRounds = id => WORK.events.filter(e => e.task_id === id && e.kind === 'submitted').length;
const openWorkDlg = async id => { workOpenDetail(id); await sleep(150); };
const detailChips = () => [...$('workDlgBody').querySelectorAll('.att-chip .att-name')].map(e => e.textContent);
const reset = () => { WORK.seed(); TRN.seed(); ATT.reset(); closeAll(); };

async function runTests() {
  L('=== แนบไฟล์จากคลังไฟล์ (053) ===');
  reset();
  const POP = [];
  window.open = () => { const w = { _href: '', closed: false, opener: 'x', location: { set href(v) { w._href = v; }, get href() { return w._href; } }, close() { w.closed = true; } }; POP.push(w); return w; };
  const DL = [];
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="https://files.example"]'); if (a) { e.preventDefault(); DL.push(a.href); } }, true);
  await login('zen'); showSection('tasks'); await sleep(300);

  // ── 1. ส่งงาน ─────────────────────────────────────────────────
  workSubOpen('a4'); await sleep(150);
  ok('ส่งงาน: ช่อง "ไฟล์จากคลังไฟล์" โผล่ในหน้าต่างส่งงาน · ปุ่ม "+ แนบจากคลังไฟล์" มี · บอกว่าแนบเสริมไม่นับเป็นหลักฐาน', hostVisible('workSubAtt') && !!hostBtn('workSubAtt', 'h-add') && /ไม่นับเป็นหลักฐาน/.test($('workSubAtt').closest('.att-field').textContent));
  await openPicker('workSubAtt');
  ok('กด "+ แนบจากคลังไฟล์": หน้าต่างเลือกไฟล์เปิด (ซ้อนบนหน้าต่างส่งงาน)', dlgOpen('attDlg') && dlgOpen('workSubDialog'));
  const rootIds = pickFiles().sort().join(',');
  ok('รายการในคลัง: ไฟล์ที่ยังเปิดได้ครบ (f1-f9) — ไม่มีไฟล์หมดอายุ (fx) ไม่มีไฟล์ที่ถูกลบ/หมดอายุแล้ว (fd, fe)', rootIds === 'f1,f2,f3,f4,f5,f6,f7,f8,f9', rootIds);
  ok('ชื่อไฟล์ที่เป็น HTML แสดงเป็นข้อความ ไม่ถูกตีความ (ไม่มี <img>/<script> ในรายการ · window.XSS ไม่ถูกตั้ง)', !$('attList').querySelector('img, script') && !window.XSS && $('attList').textContent.indexOf('<img src=x onerror=window.XSS=1>.mp4') >= 0);
  ok('ปุ่ม "แนบไฟล์" ปิดอยู่จนกว่าจะเลือก · บอกเพดาน "แนบเพิ่มได้อีก 20 ไฟล์"', $('attDlgOk').disabled && /แนบเพิ่มได้อีก 20 ไฟล์/.test(txt('attPickN')));
  tick('f1'); tick('f3');
  await shot('01-picker-root');
  ok('เลือก 2 ไฟล์: ปุ่มเปลี่ยนเป็น "แนบ 2 ไฟล์" · นับ "เลือกแล้ว 2 ไฟล์ · แนบเพิ่มได้อีก 18"', !$('attDlgOk').disabled && txt('attDlgOk') === 'แนบ 2 ไฟล์' && /เลือกแล้ว 2 ไฟล์ · แนบเพิ่มได้อีก 18/.test(txt('attPickN')));
  $('attDlgOk').click(); await sleep(100);
  ok('กดแนบ: หน้าต่างเลือกปิด · ชิป 2 ไฟล์ขึ้นในฟอร์มพร้อมป้าย "จะแนบเมื่อกดบันทึก" · ยังไม่เรียกฐานเลย', !dlgOpen('attDlg') && names('workSubAtt').join() === 'คลิปรีวิว FLX4.mp4,poster.png' && /จะแนบเมื่อกดบันทึก/.test(txt('workSubAtt')) && rpcs('transfer_attach').length === 0 && ATT.rows.length === 0);
  await shot('02-submit-form-staged');
  ok('ไฟล์จากคลังไม่นับเป็นหลักฐาน: ยังไม่ใส่ลิงก์ Facebook → ปุ่มส่งงานยังกดไม่ได้', $('workSubGo').disabled);
  hostBtn('workSubAtt', 'h-rm').click();
  ok('"เอาออก" ที่ชิปรอแนบ: เหลือ 1 ไฟล์ (poster.png)', names('workSubAtt').join() === 'poster.png');
  setVal('workSubC-facebook', 'https://www.facebook.com/PioneerDjLabSiam/posts/9');
  ok('ใส่ลิงก์ครบ: ปุ่มส่งงานกดได้', !$('workSubGo').disabled);
  $('workSubGo').click(); await sleep(600);
  const sa = lastRpc('transfer_attach');
  ok('ส่งงานสำเร็จแล้วค่อยแนบ: work_submit ก่อน → transfer_attach(task, a4, submit:1, [f3])', taskOnServer('a4').status === 'submitted' && !!sa && sa.args.p_kind === 'task' && sa.args.p_target === 'a4' && sa.args.p_ctx === 'submit:1' && sa.args.p_files.join() === 'f3', JSON.stringify(sa && sa.args));
  ok('ลำดับ: work_submit มาก่อน transfer_attach', CALLS.findIndex(c => c.fn === 'work_submit') < CALLS.findIndex(c => c.fn === 'transfer_attach'));
  ok('ฐานมีแถวแนบ 1 แถว ctx submit:1 · หน้าต่างส่งงานปิด · ช่องแนบถูกล้าง', attRows('task', 'a4', 'submit:1') === 'f3' && !dlgOpen('workSubDialog') && $('workSubAtt').innerHTML === '');
  await openWorkDlg('a4');
  ok('เปิดรายละเอียดใบ a4: เห็นหัว "ไฟล์จากคลังไฟล์ที่แนบมากับการส่งครั้งที่ 1" + ชิป poster.png', /ไฟล์จากคลังไฟล์ที่แนบมากับการส่งครั้งที่ 1/.test(txt('workDlgBody')) && detailChips().join() === 'poster.png');
  closeAll();

  // ── 2. หน้าต่างเลือกไฟล์ ─────────────────────────────────────────────
  TRN.add('g1', 'photo', 'cover-end.png', 'u2', 5, { folder_path: 'End credit/2026' });
  TRN.add('g2', 'video', 'ep1.mp4', 'u3', 6, { folder_path: 'End credit' });
  ATT.add('f2', 'task', 'a1', 'brief', 'u4'); ATT.add('f4', 'task', 'a1', 'brief', 'u4');
  workFormOpen('a1'); await sleep(0); closeAll();
  $('workNew').click(); await sleep(0); closeAll();
  tab('assign'); await frames(); $('workNew').click(); await sleep(200);
  await openPicker('workfAtt');
  ok('โหมดเรียกดู: โฟลเดอร์ขึ้นก่อน (End credit) · ไฟล์ที่ชั้นบนสุดไม่รวมไฟล์ในโฟลเดอร์ (g1, g2 ไม่โผล่ที่ราก)', pickDirs().join() === 'End credit' && pickFiles().indexOf('g1') < 0 && pickFiles().indexOf('g2') < 0 && pickFiles().indexOf('f1') >= 0);
  $('attList').querySelector('.att-dir').click(); await sleep(80);
  ok('คลิกโฟลเดอร์: เข้าไปชั้นถัดไป · แถบเส้นทาง "คลังไฟล์ › End credit" · เห็น ep1.mp4 + โฟลเดอร์ย่อย 2026', pickFiles().join() === 'g2' && pickDirs().join() === '2026' && /End credit/.test(txt('attCrumbs')));
  $('attList').querySelector('.att-dir').click(); await sleep(80);
  ok('เข้าโฟลเดอร์ย่อย: เห็น cover-end.png', pickFiles().join() === 'g1');
  $('attCrumbs').querySelector('[data-path=""]').click(); await sleep(80);
  ok('คลิก "คลังไฟล์" ใน breadcrumb: กลับราก', pickDirs().join() === 'End credit' && pickFiles().indexOf('f1') >= 0);
  setVal('attQ', 'cover');
  ok('ค้นหา: ผลลัพธ์แบนจากทุกโฟลเดอร์ + แสดงพาธนำหน้า · ไม่มีโฟลเดอร์ให้คลิก', pickFiles().join() === 'g1' && pickDirs().length === 0 && /End credit\\/2026\\//.test($('attList').textContent) && /ทุกโฟลเดอร์/.test(txt('attCrumbs')));
  setVal('attQ', 'ไม่มีไฟล์ชื่อนี้แน่นอน');
  ok('ค้นไม่เจอ: ข้อความ "ไม่พบไฟล์ที่ตรงกับการค้นหา"', /ไม่พบไฟล์ที่ตรงกับการค้นหา/.test(txt('attList')));
  setVal('attQ', '');
  $('attPerm').checked = true; $('attPerm').dispatchEvent(new Event('change', { bubbles: true }));
  ok('เฉพาะไฟล์ถาวร: เหลือ memo.pdf (f5) ไฟล์เดียว · ขึ้นป้าย "ถาวร"', pickFiles().join() === 'f5' && /ถาวร/.test(txt('attList')));
  $('attPerm').checked = false; $('attPerm').dispatchEvent(new Event('change', { bubbles: true }));
  tick('f1'); $('attDlgOk').click(); await sleep(80);
  ok('ฟอร์มสั่งงาน: ชิปรอแนบ 1 ไฟล์ — ยังไม่เรียกฐาน', names('workfAtt').join() === 'คลิปรีวิว FLX4.mp4' && rpcs('transfer_attach').length === 1 /* ของข้อ 1 */);
  await openPicker('workfAtt');
  ok('เปิดเลือกอีกครั้ง: ไฟล์ที่เลือกไว้แล้วในฟอร์ม (f1) เลือกซ้ำไม่ได้ ขึ้น "แนบแล้ว"', $('attList').querySelector('input[data-id="f1"]').disabled && /แนบแล้ว/.test($('attList').querySelector('label.used').textContent) && /แนบเพิ่มได้อีก 19/.test(txt('attPickN')));
  $('attDlgCancel').click(); await sleep(60);
  ok('ยกเลิกหน้าต่างเลือก: ไม่เปลี่ยนรายการในฟอร์ม', !dlgOpen('attDlg') && names('workfAtt').join() === 'คลิปรีวิว FLX4.mp4');
  await openPicker('workfAtt'); tick('f2');
  $('attDlg').close(); await sleep(120);
  ok('ปิดหน้าต่างเลือกด้วย Esc/close ตรง ๆ: สถานะเลือกถูกล้าง (att.pick = null) · เปิดใหม่ได้ ไม่ติดสถานะเก่า', !att.pick && names('workfAtt').join() === 'คลิปรีวิว FLX4.mp4');
  await openPicker('workfAtt');
  ok('เปิดใหม่หลังปิดด้วย Esc: รายการโหลดใหม่ · ยังไม่ได้เลือกอะไร (f2 ที่ติ๊กไว้รอบก่อนไม่ค้าง)', dlgOpen('attDlg') && pickFiles().length >= 8 && att.pick.sel.size === 0 && !$('attList').querySelector('input[data-id="f2"]').checked);
  $('attDlgCancel').click(); await sleep(60);

  // เพดาน 20 ไฟล์
  for (let i = 0; i < 17; i++) TRN.add('m' + i, 'doc', 'many-' + i + '.pdf', 'u2', 8);
  await openPicker('workfAtt');
  for (let i = 0; i < 17; i++) tick('m' + i);
  ok('เลือกจน 18 ไฟล์ (รวม f1 ที่รอแนบ) แนบได้อีก 2: ช่องที่เหลือยังกดได้', /แนบเพิ่มได้อีก 2 ไฟล์/.test(txt('attPickN')) && !$('attList').querySelector('input[data-id="f2"]').disabled);
  tick('f2'); tick('f3');
  ok('เลือกครบเพดาน 20: ช่องที่ยังไม่ติ๊กถูกปิดทั้งหมด · บอก "แนบเพิ่มได้อีก 0"', $('attList').querySelector('input[data-id="f4"]').disabled && /แนบเพิ่มได้อีก 0/.test(txt('attPickN')));
  tick('f4');
  ok('บังคับเพดานที่ตัวจัดการด้วย (ไม่พึ่งแค่การปิดช่อง): ติ๊กเกินเพดานตรง ๆ = ไม่ถูกนับ (ยัง 19 ไฟล์) · ช่องกลับเป็นไม่ติ๊ก · ขึ้นเตือน "แต่ละรายการแนบได้ไม่เกิน 20 ไฟล์"', att.pick.sel.size === 19 && !$('attList').querySelector('input[data-id="f4"]').checked && /แต่ละรายการแนบได้ไม่เกิน 20 ไฟล์/.test(toast()), String(att.pick.sel.size) + ' | ' + toast());
  tick('f2');
  ok('ติ๊กออก 1 ไฟล์: ช่องอื่นกลับมากดได้', !$('attList').querySelector('input[data-id="f4"]').disabled);
  $('attDlgCancel').click(); await sleep(60);
  closeAll();

  // ── 3. สั่งงาน ─────────────────────────────────────────────────
  tab('assign'); await frames(); $('workNew').click(); await sleep(200);
  setVal('workfTitle', 'ถ่ายรูปชุดสายใหม่');
  document.querySelector('#workfKind button[data-kind="other"]').click();
  const pickP = name => { const l = [...document.querySelectorAll('#workfPeople label')].find(x => x.textContent.indexOf(name) >= 0); l.querySelector('input').click(); };
  pickP('Nutty'); pickP('Pran');
  await openPicker('workfAtt'); tick('f3'); tick('f7'); $('attDlgOk').click(); await sleep(80);
  $('workfSave').click(); await sleep(700);
  const made = WORK.tasks.filter(t => t.title === 'ถ่ายรูปชุดสายใหม่');
  ok('สั่งงาน 2 ใบ: ฐานสร้าง 2 ใบ · ฟอร์มปิด', made.length === 2 && !dlgOpen('workFormDialog'));
  ok('แนบ brief ให้ทั้ง 2 ใบ ใบละ [f3, f7] (transfer_attach 2 ครั้ง ctx brief)', made.every(t => attRows('task', t.id, 'brief') === 'f3,f7') && rpcs('transfer_attach').slice(-2).every(c => c.args.p_ctx === 'brief' && c.args.p_kind === 'task'));
  ok('ฟอร์มสั่งงานสั่งแล้วถูกล้างช่องแนบ', $('workfAtt').innerHTML === '');

  // แก้ใบ: ถอดตัวเก่า + แนบตัวใหม่ ตอนกดบันทึก
  const mine = made[0];
  workFormOpen(mine.id); await sleep(200);
  ok('แก้ใบ: ชิปที่แนบไว้แล้วขึ้นในฟอร์ม (poster.png, banner.psd) พร้อมปุ่ม "ถอดออก"', names('workfAtt').join() === 'poster.png,banner.psd' && $('workfAtt').querySelectorAll('[data-att-act="h-rmx"]').length === 2);
  $('workfAtt').querySelector('[data-att-act="h-rmx"]').click();
  ok('กด "ถอดออก": ชิปขีดฆ่า + ป้าย "จะถอดเมื่อกดบันทึก" · ยังไม่ลบจากฐาน · มีปุ่ม "ไม่ถอดแล้ว"', $('workfAtt').querySelector('.att-chip.removed') && /จะถอดเมื่อกดบันทึก/.test(txt('workfAtt')) && attRows('task', mine.id, 'brief') === 'f3,f7' && !!hostBtn('workfAtt', 'h-undo'));
  hostBtn('workfAtt', 'h-undo').click();
  ok('"ไม่ถอดแล้ว": กลับเป็นปกติ', !$('workfAtt').querySelector('.att-chip.removed'));
  $('workfAtt').querySelector('[data-att-act="h-rmx"]').click();
  await openPicker('workfAtt');
  ok('ไฟล์ที่ติ๊กถอดไว้ (f3) เลือกใหม่ได้ · ไฟล์ที่แนบอยู่ (f7) เลือกซ้ำไม่ได้', !$('attList').querySelector('input[data-id="f3"]').disabled && $('attList').querySelector('input[data-id="f7"]').disabled);
  tick('f6'); $('attDlgOk').click(); await sleep(80);
  const nDet = rpcs('transfer_detach').length;
  $('workfSave').click(); await sleep(700);
  ok('แก้ใบโดยเปลี่ยนแค่ไฟล์แนบ (ไม่แก้ฟิลด์อื่น): บันทึกได้ ไม่ขึ้น "ไม่มีอะไรเปลี่ยน" · ไม่เรียก work_edit', !dlgOpen('workFormDialog') && rpcs('work_edit').length === 0);
  ok('ฐาน: ถอด poster.png แนบ stems.zip → เหลือ f6,f7 · เรียก transfer_detach 1 ครั้ง', attRows('task', mine.id, 'brief') === 'f6,f7' && rpcs('transfer_detach').length === nDet + 1);
  ok('ใบของคนอื่น (อีกใบที่สั่งพร้อมกัน) ไม่ถูกแตะ', attRows('task', made[1].id, 'brief') === 'f3,f7');

  // ผู้รับเห็นไฟล์ตัวอย่างในหน้าต่างส่งงาน
  doLogout(); await sleep(400);
  await login('nutty'); showSection('tasks'); await sleep(300);
  const nuttyTask = made.find(t => t.assignee_id === 'u3');
  workSubOpen(nuttyTask.id); await sleep(150);
  ok('ผู้รับ (Nutty) เปิดหน้าต่างส่งงาน: เห็น "ไฟล์ตัวอย่างจากผู้สั่ง" พร้อมชิป · ไม่มีปุ่มถอด (แนบไม่ใช่ของตัวเอง)', /ไฟล์ตัวอย่างจากผู้สั่ง/.test(txt('workSubTask')) && $('workSubTask').querySelectorAll('.att-chip').length === 2 && !$('workSubTask').querySelector('[data-att-act="detach"]'));
  closeAll();

  // ── 4. คำขอ ─────────────────────────────────────────────────
  tab('req'); await frames(); $('workReqNew').click(); await sleep(200);
  ok('ฟอร์มคำขอ: มีช่องแนบจากคลัง', hostVisible('workrAtt'));
  setVal('workrBody', 'ขอให้ช่วยดูไฟล์ตัวอย่างนี้หน่อยครับ');
  await openPicker('workrAtt'); tick('f8'); $('attDlgOk').click(); await sleep(80);
  document.querySelector('#workrGroups button').click();
  $('workrGo').click(); await sleep(700);
  const req = WORK.reqs.find(r => r.body === 'ขอให้ช่วยดูไฟล์ตัวอย่างนี้หน่อยครับ');
  ok('ยื่นคำขอสำเร็จ: ฐานมีคำขอ · แนบ f8 กับคำขอนั้น (kind request ctx ว่าง)', !!req && attRows('request', req.id, '') === 'f8' && lastRpc('transfer_attach').args.p_kind === 'request' && lastRpc('transfer_attach').args.p_ctx === '');
  await sleep(150);
  const reqCard = document.querySelector('#workReqList [data-id="' + req.id + '"]'); reqCard.click(); await sleep(150);
  await shot('04-request-detail');
  ok('รายละเอียดคำขอ (ผู้ยื่น): เห็นหัว "ไฟล์แนบจากคลังไฟล์ (1)" + ชิป library.rbox + ปุ่ม "ถอด" + ปุ่ม "+ แนบไฟล์จากคลังไฟล์"', /ไฟล์แนบจากคลังไฟล์ \\(1\\)/.test(txt('workReqDetail')) && !!$('workReqDetail').querySelector('.att-chip [data-att-act="detach"]') && !!$('workReqDetail').querySelector('[data-att-act="add"]'));
  // ถอดทันทีจากหน้ารายละเอียด (ต้องยืนยัน)
  $('workReqDetail').querySelector('[data-att-act="detach"]').click(); await sleep(150);
  ok('กด "ถอด": ขึ้นหน้าต่างยืนยัน บอกว่าไฟล์ยังอยู่ในคลัง · ยังไม่เรียกฐาน', dlgOpen('confirmDialog') && /ไฟล์ยังอยู่ในคลังไฟล์ตามเดิม/.test(txt('confirmBody')) && attRows('request', req.id, '') === 'f8');
  $('confirmOkBtn').click(); await sleep(500);
  ok('ยืนยันแล้ว: ฐานถอดแถว · หน้าวาดใหม่ไม่มีชิป', attRows('request', req.id, '') === '' && !$('workReqDetail').querySelector('.att-chip'));
  // แนบทีหลัง
  $('workReqDetail').querySelector('[data-att-act="add"]').click(); await sleep(250);
  ok('"+ แนบไฟล์จากคลังไฟล์" ในรายละเอียด: เปิดหน้าต่างเลือก', dlgOpen('attDlg'));
  tick('f2'); tick('f4');
  $('attDlgOk').click(); await sleep(700);
  ok('แนบทีหลัง: เรียก transfer_attach ทันที [f2,f4] · ชิป 2 ไฟล์ขึ้นในรายละเอียดหลังโหลดใหม่', attRows('request', req.id, '') === 'f2,f4' && $('workReqDetail').querySelectorAll('.att-chip').length === 2 && /แนบไฟล์แล้ว 2 ไฟล์/.test(toast()));

  // ผู้ที่ไม่ใช่ผู้ยื่น (ผู้ดูแล Nui รับคำขอกลุ่ม admin) เห็นไฟล์ แต่แนบ/ถอดไม่ได้
  doLogout(); await sleep(400);
  await login('nui'); showSection('tasks'); await sleep(300);
  tab('req'); await frames();
  const reqNui = document.querySelector('#workReqList [data-id="' + req.id + '"]');
  ok('ผู้ดูแล (Nui) เห็นคำขอที่ส่งถึงกลุ่มผู้ดูแล', !!reqNui);
  if (reqNui) { reqNui.click(); await sleep(150); }
  ok('Nui เห็นไฟล์แนบ 2 ไฟล์ในคำขอ แต่ไม่มีปุ่มถอด/แนบ (ไม่ใช่ผู้ยื่น ไม่ใช่เจ้าของ)', $('workReqDetail').querySelectorAll('.att-chip').length === 2 && !$('workReqDetail').querySelector('[data-att-act="detach"]') && !$('workReqDetail').querySelector('[data-att-act="add"]'));
  doLogout(); await sleep(400);
  await login('tibass'); showSection('tasks'); await sleep(300);
  tab('req'); await frames();
  const reqOwner = document.querySelector('#workReqList [data-id="' + req.id + '"]'); if (reqOwner) { reqOwner.click(); await sleep(150); }
  ok('เจ้าของร้านเห็นปุ่ม "ถอด" ของไฟล์แนบในคำขอของคนอื่น และปุ่ม "+ แนบไฟล์" (เจ้าของแนบได้ทุกคำขอ)', !!$('workReqDetail').querySelector('[data-att-act="detach"]') && !!$('workReqDetail').querySelector('[data-att-act="add"]'));

  // ── 5. ใบงาน: สิทธิ์ตามตำแหน่ง ─────────────────────────────────────
  ATT.add('f1', 'task', 'c1', 'brief', 'u1'); ATT.add('f5', 'task', 'c1', 'submit:1', 'u4');
  await loadWork(); await sleep(150);
  await openWorkDlg('c1');
  ok('เจ้าของเปิดใบ c1 (ผู้รับ = ผู้ดูแล Nui): เห็นไฟล์ brief + ไฟล์ส่งงานครั้งที่ 1 · มีปุ่มแนบเพิ่มทั้งสองส่วน', /ไฟล์ตัวอย่างจากผู้สั่ง/.test(txt('workDlgBody')) && /ส่งครั้งที่ 1/.test(txt('workDlgBody')) && $('workDlgBody').querySelectorAll('[data-att-act="add"]').length === 2);
  closeAll();
  doLogout(); await sleep(400);
  await login('fah'); showSection('tasks'); await sleep(300);
  tab('assign'); await frames();
  await openWorkDlg('c1');
  ok('ผู้ดูแลอีกคน (Fah) เปิดใบ c1 ของผู้ดูแลด้วยกัน: เห็นไฟล์ แต่แนบ brief ไม่ได้ (ผู้ดูแลแนบ brief ได้เฉพาะใบของพนักงาน) และแนบส่งงานไม่ได้', detailChips().length === 2 && $('workDlgBody').querySelectorAll('[data-att-act="add"]').length === 0);
  closeAll();
  await openWorkDlg('a1');
  ok('Fah เปิดใบ a1 (ผู้รับ = พนักงาน Zen): แนบ brief ได้ (ปุ่มแนบ 1 ปุ่ม) แต่ไม่ใช่ผู้รับ จึงไม่มีปุ่มแนบฝั่งส่งงาน', $('workDlgBody').querySelectorAll('[data-att-act="add"][data-ctx="brief"]').length === 1);
  closeAll();

  // ── 6. กระดานข้อความ ─────────────────────────────────────────────
  doLogout(); await sleep(400);
  await login('zen'); showSection('board'); await sleep(300);
  openBoardForm(null); await sleep(150);
  ok('ฟอร์มเขียนข้อความ: มีช่องแนบจากคลัง', hostVisible('bfAtt'));
  setVal('bfTitle', 'ของเข้าพรุ่งนี้');
  await openPicker('bfAtt'); tick('f1'); tick('f5'); $('attDlgOk').click(); await sleep(80);
  ok('เลือกแล้ว: ชิปรอแนบ 2 ไฟล์ · ยังไม่แนบจนกว่าจะบันทึก', names('bfAtt').length === 2 && ATT.rows.filter(r => r.target_kind === 'board').length === 0);
  const nb0 = rpcs('transfer_attach').length;
  $('bfSaveBtn').click(); await sleep(700);
  const bIns = CALLS.filter(c => c.op === 'insert' && c.table === 'board_messages').pop();
  const bnew = bIns && bIns.q._rows[0].id;
  ok('บันทึกข้อความ: insert board_messages ก่อน แล้ว transfer_attach(board, <id ใหม่>, ctx ว่าง, [f1,f5])', rpcs('transfer_attach').length === nb0 + 1 && lastRpc('transfer_attach').args.p_kind === 'board' && lastRpc('transfer_attach').args.p_target === bnew && lastRpc('transfer_attach').args.p_ctx === '' && attRows('board', bnew, '') === 'f1,f5', JSON.stringify(lastRpc('transfer_attach').args));
  ok('ฟอร์มกระดานปิด · ช่องแนบถูกล้าง', !dlgOpen('boardDialog') && $('bfAtt').innerHTML === '');
  FAKE.board_messages.push({ id: bnew, author_id: 'u2', refers_to: TODAY, title: 'ของเข้าพรุ่งนี้', body: '', pinned: false, target_admin_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });     // ฐานปลอมของ desk-home3 ไม่เก็บแถว insert — ใส่เองให้เหมือนฐานจริง
  // ข้อความ m1 ของ Nutty — วางแนบตรง ๆ ในฐานแล้วเปิดดูในฐานะ Zen (ไม่ใช่คนเขียน ไม่ใช่ผู้ดูแล)
  ATT.add('f2', 'board', 'm1', '', 'u3');
  await loadBoard(); renderBoardAll(); await sleep(100);
  ok('ตารางกระดาน: แถว m1 ขึ้น "แนบไฟล์ 1 ไฟล์"', /แนบไฟล์ 1 ไฟล์/.test(txt('boardRows')));
  await openBoardMsg('m1'); await sleep(150);
  ok('Zen (ไม่ใช่คนเขียน/ผู้ดูแล) เปิดข้อความ m1: เห็นชิป mix-oct.wav · ไม่มีปุ่มถอด/แนบ', /ไฟล์แนบจากคลังไฟล์ \\(1\\)/.test(txt('detailBody')) && !$('detailBody').querySelector('[data-att-act="detach"]') && !$('detailBody').querySelector('[data-att-act="add"]'));
  // ข้อความของ Zen เอง: ถอดได้ แนบเพิ่มได้
  await openBoardMsg(bnew); await sleep(150);
  ok('Zen เปิดข้อความที่ตัวเองเขียน: เห็นชิป 2 ไฟล์ + ปุ่มถอด + ปุ่มแนบเพิ่ม', $('detailBody').querySelectorAll('.att-chip').length === 2 && !!$('detailBody').querySelector('[data-att-act="detach"]') && !!$('detailBody').querySelector('[data-att-act="add"]'));
  // แก้ข้อความ: เห็นไฟล์ที่แนบ ถอดตอนบันทึก
  openBoardForm(bnew); await sleep(150);
  ok('แก้ข้อความ: ช่องแนบแสดงชิปที่แนบไว้ 2 ไฟล์', names('bfAtt').length === 2);
  $('bfAtt').querySelector('[data-att-act="h-rmx"]').click();
  $('bfSaveBtn').click(); await sleep(700);
  ok('แก้แล้วบันทึก: ถอดไฟล์ที่ติ๊กไว้ (เหลือ 1 ไฟล์) ', attRows('board', bnew, '').split(',').length === 1);
  // เปิด/ดาวน์โหลด
  closeDetail();
  await openBoardMsg(bnew); await sleep(150);
  const nOpen = rpcs('transfer_open').length;
  const chipOf = name => [...$('detailBody').querySelectorAll('.att-chip')].find(c => c.textContent.indexOf(name) >= 0);
  const left = [...$('detailBody').querySelectorAll('.att-chip .att-name')].map(e => e.textContent).join();
  ok('ชิปที่เหลือมีปุ่ม "ดาวน์โหลด" (memo.pdf เปิดดูได้ · คลิป FLX4 เปิดดูได้)', !!$('detailBody').querySelector('[data-att-act="download"]'), left);
  $('detailBody').querySelector('[data-att-act="download"]').click(); await sleep(400);
  ok('ดาวน์โหลด: เรียก transfer_open (purpose download) แล้วขอลิงก์ที่ถังด้วยชื่อไฟล์ — ลงประวัติเหมือนหน้าโอนไฟล์ · ไม่เปิดแท็บ', rpcs('transfer_open').length === nOpen + 1 && lastRpc('transfer_open').args.p_purpose === 'download' && TRN.signed.length > 0 && !!TRN.signed[TRN.signed.length - 1].download && DL.length === 1 && POP.length === 0);
  ok('ดาวน์โหลดแล้วประวัติ "download" ของ Zen ถูกบันทึกที่ฐาน', TRN.events.some(e => e.kind === 'download' && e.actor_id === 'u2'));
  const viewB = $('detailBody').querySelector('[data-att-act="view"]');
  ok('ชิปรูป/PDF/วิดีโอมีปุ่ม "เปิดดู"', !!viewB);
  if (viewB) { viewB.click(); await sleep(400); }
  ok('เปิดดู: transfer_open (view) → แท็บใหม่ชี้ลิงก์ชั่วคราว (opener ถูกตัด)', lastRpc('transfer_open').args.p_purpose === 'view' && POP.length === 1 && /files.example/.test(POP[0]._href) && POP[0].opener === null);
  closeAll();

  // ── 7. ไฟล์หมดอายุ / ถูกลบ ─────────────────────────────────────
  ATT.add('fx', 'board', 'm1', '', 'u3'); ATT.add('fd', 'board', 'm1', '', 'u3'); ATT.add('fe', 'board', 'm1', '', 'u3'); ATT.add('f9', 'board', 'm1', '', 'u3'); ATT.add('f6', 'board', 'm1', '', 'u3');
  await loadBoard(); renderBoardAll(); await openBoardMsg('m1'); await sleep(150);
  const chipByName = n => [...$('detailBody').querySelectorAll('.att-chip')].find(c => c.querySelector('.att-name').textContent === n);
  const cx = chipByName('old-expired.pdf'), cd = chipByName('deleted-by-zen.mp3');
  await shot('03-board-detail-chips');
  ok('ไฟล์ที่ครบ 30 วัน (ยังไม่ถูกกวาด): ขึ้น "หมดอายุแล้ว" · ไม่มีปุ่มเปิด/ดาวน์โหลด', !!cx && /หมดอายุแล้ว/.test(cx.textContent) && !cx.querySelector('[data-att-act="view"], [data-att-act="download"]'));
  ok('ไฟล์ที่ถูกลบจากคลังแล้ว: ขึ้น "ไฟล์ถูกลบแล้ว" · ไม่มีปุ่มเปิด', !!cd && /ไฟล์ถูกลบแล้ว/.test(cd.textContent) && !cd.querySelector('[data-att-act="view"], [data-att-act="download"]'));
  ok('ชื่อไฟล์ที่เป็น HTML ในชิป: แสดงเป็นข้อความ (ไม่มี <img>/<script> ในส่วนไฟล์แนบ · window.XSS ไม่ถูกตั้ง)', !!chipByName('<img src=x onerror=window.XSS=1>.mp4') && !$('detailBody').querySelector('.att-list img, .att-list script') && !window.XSS);
  const cz = chipByName('stems.zip');
  ok('ไฟล์ที่เบราว์เซอร์เปิดดูไม่ได้ (zip): มีแต่ "ดาวน์โหลด" ไม่มี "เปิดดู" · ไฟล์เสียงมีทั้งสองปุ่ม', !!cz && !!cz.querySelector('[data-att-act="download"]') && !cz.querySelector('[data-att-act="view"]') && !!chipByName('mix-oct.wav').querySelector('[data-att-act="view"]'));
  const cf = chipByName('mix-oct.wav');
  ok('ไฟล์ปกติบอกอายุ "เหลือ … วัน" · ไฟล์ถาวรบอก "ถาวร"', !!cf && /เหลือ \\d+ วัน/.test(cf.textContent));
  closeAll();

  // ── 7b. เรียกแนบตรง ๆ โดยไม่มีสิทธิ์ ──
  const nDlg = rpcs('transfer_attach').length;
  attDirectAdd('board', 'm1', ''); await sleep(150);
  ok('Zen (ไม่ใช่คนเขียน/ผู้ดูแล) เรียกแนบกับข้อความ m1 ตรง ๆ: ไม่เปิดหน้าต่างเลือก · บอกว่าแนบไม่ได้ · ไม่เรียกฐาน', !dlgOpen('attDlg') && /แนบไฟล์กับรายการนี้ไม่ได้แล้ว/.test(toast()) && rpcs('transfer_attach').length === nDlg);

  // ── 8. ล้ม ──────────────────────────────────────────────────────
  // แนบไม่ผ่านหลังบันทึกกระดานสำเร็จ
  openBoardForm(null); await sleep(150);
  setVal('bfTitle', 'ทดสอบแนบล้ม');
  await openPicker('bfAtt'); tick('f6'); $('attDlgOk').click(); await sleep(80);
  ATT.fail.rpc_transfer_attach = 'แนบไฟล์ไม่ได้ — ทดสอบล้ม';
  const nMsgs = FAKE.board_messages.length;
  $('bfSaveBtn').click(); await sleep(700);
  ok('แนบล้ม: ข้อความยังถูกบันทึก (insert สำเร็จ) · แถบแดงบอก "บันทึกข้อความแล้ว แต่แนบไฟล์…ไม่สำเร็จ" พร้อมเหตุผล · ฟอร์มปิด', CALLS.filter(c => c.op === 'insert' && c.table === 'board_messages').length >= 2 && /บันทึกข้อความแล้ว แต่แนบไฟล์จากคลังไฟล์ไม่สำเร็จ.*ทดสอบล้ม/.test(fatalText()) && !dlgOpen('boardDialog'));
  delete ATT.fail.rpc_transfer_attach;
  // ส่งงานสำเร็จแต่แนบล้ม
  ATT.fail.rpc_transfer_attach = 'ล้มตอนแนบส่งงาน';
  workSubOpen('a1'); await sleep(150);
  await openPicker('workSubAtt'); tick('f7'); $('attDlgOk').click(); await sleep(80);
  setVal('workSubLink', 'https://drive.google.com/file/d/1/view');
  $('workSubGo').click(); await sleep(700);
  ok('ส่งงานแล้วแนบล้ม: งานเป็น submitted (ไม่ย้อน) · แถบแดงบอกตามจริง · หน้าต่างส่งงานปิด', taskOnServer('a1').status === 'submitted' && /ส่งงานแล้ว แต่แนบไฟล์จากคลังไฟล์ไม่สำเร็จ.*ล้มตอนแนบส่งงาน/.test(fatalText()) && !dlgOpen('workSubDialog'));
  delete ATT.fail.rpc_transfer_attach;
  // โหลดคลังล้ม
  TRN.fail.select = 'คลังล่ม';
  workSubOpen('b3'); closeAll();
  openBoardForm(null); await sleep(150);
  await openPicker('bfAtt');
  ok('โหลดคลังไฟล์ไม่ได้: หน้าต่างเลือกขึ้นแดง "โหลดคลังไฟล์ไม่สำเร็จ" · เลือกอะไรไม่ได้', !$('attDlgErr').hidden && /โหลดคลังไฟล์ไม่สำเร็จ/.test(txt('attDlgErr')) && pickFiles().length === 0 && $('attDlgOk').disabled);
  $('attDlgCancel').click(); await sleep(60); closeAll();
  delete TRN.fail.select;
  // โหลดไฟล์แนบล้ม (ไม่ใช่ตารางหาย)
  ATT.fail.select = 'ตารางแนบล่ม';
  fatalClear();
  await loadWork(); await sleep(100);
  ok('โหลดไฟล์แนบล้มด้วยเหตุอื่น: แถบแดงบอก "โหลดไฟล์แนบไม่สำเร็จ" (ไม่เงียบ) แต่งานยังโหลดได้', /โหลดไฟล์แนบไม่สำเร็จ/.test(fatalText()) && work.tasks.length > 0);
  delete ATT.fail.select;

  // โหลดไฟล์แนบโยน error ดิบ (เครือข่ายล่ม): งานยังโหลดได้ · บอกตามจริง
  ATT.throws = true; fatalClear();
  await loadWork(); await sleep(100);
  ok('โหลดไฟล์แนบโยน error (เครือข่าย): ใบงานยังโหลดและวาดได้ · แถบแดง "โหลดไฟล์แนบไม่สำเร็จ"', work.tasks.length > 0 && /โหลดไฟล์แนบไม่สำเร็จ/.test(fatalText()));
  ATT.throws = false; fatalClear();

  // ฟังก์ชันสร้างงาน/คำขอไม่คืนรหัส → หน้าหาใบที่เพิ่งสร้างจากผลต่างก่อน/หลังเอง
  const origCreate = WORK.rpc.work_create, origReq = WORK.rpc.work_request_create;
  WORK.rpc.work_create = (me, a) => { origCreate(me, a); return { data: null, error: null }; };
  WORK.rpc.work_request_create = (me, a) => { origReq(me, a); return { data: null, error: null }; };
  tab('assign'); await frames(); $('workNew').click(); await sleep(200);
  setVal('workfTitle', 'งานที่ฐานไม่คืนรหัส'); document.querySelector('#workfKind button[data-kind="other"]').click();
  { const l = [...document.querySelectorAll('#workfPeople label')].find(x => x.textContent.indexOf('Pran') >= 0); l.querySelector('input').click(); }
  await openPicker('workfAtt'); tick('f6'); $('attDlgOk').click(); await sleep(80);
  $('workfSave').click(); await sleep(900);
  const nr = WORK.tasks.find(t => t.title === 'งานที่ฐานไม่คืนรหัส');
  ok('work_create ไม่คืนรหัส: หน้าหาใบที่เพิ่งสร้างเองแล้วแนบ brief ให้ถูกใบ', !!nr && attRows('task', nr.id, 'brief') === 'f6');
  tab('req'); await frames(); $('workReqNew').click(); await sleep(200);
  setVal('workrBody', 'คำขอที่ฐานไม่คืนรหัส'); document.querySelector('#workrGroups button').click();
  await openPicker('workrAtt'); tick('f7'); $('attDlgOk').click(); await sleep(80);
  $('workrGo').click(); await sleep(900);
  const nq = WORK.reqs.find(r => r.body === 'คำขอที่ฐานไม่คืนรหัส');
  ok('work_request_create ไม่คืนรหัส: หน้าหาคำขอที่เพิ่งยื่นเองแล้วแนบให้ถูกใบ', !!nq && attRows('request', nq.id, '') === 'f7');
  WORK.rpc.work_create = origCreate; WORK.rpc.work_request_create = origReq;
  closeAll();

  // หน้าต่างเลือกไฟล์: ปิดระหว่างรอโหลด → คำตอบที่มาทีหลังถูกทิ้ง (ไม่วาดทับ ไม่ error)
  openBoardForm(null); await sleep(150);
  let rel; TRN.gateSelect = new Promise(r => { rel = r; });
  hostBtn('bfAtt', 'h-add').click(); await sleep(120);
  ok('ระหว่างรอโหลดคลัง: หน้าต่างเลือกขึ้น "กำลังโหลดคลังไฟล์…" · ปุ่มแนบกดไม่ได้', dlgOpen('attDlg') && /กำลังโหลดคลังไฟล์/.test(txt('attList')) && $('attDlgOk').disabled);
  $('attDlgCancel').click(); await sleep(60);
  rel(); TRN.gateSelect = null; await sleep(300);
  ok('ปิดก่อนโหลดเสร็จ แล้วคำตอบมา: ไม่วาดรายการลงหน้าต่างที่ปิดแล้ว · ไม่มีสถานะเลือกค้าง', !att.pick && !/memo\.pdf/.test(txt('attList')));
  closeAll();

  // ── 9. ยังไม่รัน 053 ───────────────────────────────────────────────
  ATT.missing = true; fatalClear();
  await loadWork(); await loadBoard(); renderBoardAll(); await sleep(150);
  ok('ยังไม่รัน 053 (ไม่มีตาราง): ไม่ขึ้นแถบแดง', fatalText() === '' || !/ไฟล์แนบ/.test(fatalText()), fatalText());
  openBoardForm(null); await sleep(150);
  ok('ยังไม่รัน 053: ช่องแนบในฟอร์มกระดานซ่อน', !hostVisible('bfAtt'));
  const nAtt053 = rpcs('transfer_attach').length, nIns053 = CALLS.filter(c => c.op === 'insert' && c.table === 'board_messages').length;
  setVal('bfTitle', 'ไม่มีไฟล์แนบ'); $('bfSaveBtn').click(); await sleep(600);
  ok('ยังไม่รัน 053: บันทึกข้อความปกติ (insert สำเร็จ ฟอร์มปิด) และไม่เรียก transfer_attach', !dlgOpen('boardDialog') && CALLS.filter(c => c.op === 'insert' && c.table === 'board_messages').length === nIns053 + 1 && rpcs('transfer_attach').length === nAtt053);
  closeAll();
  await openBoardMsg('m1'); await sleep(150);
  ok('ยังไม่รัน 053: รายละเอียดข้อความไม่มีส่วนไฟล์แนบ · ไม่มีปุ่มแนบ', !/ไฟล์แนบจากคลังไฟล์/.test(txt('detailBody')) && !$('detailBody').querySelector('[data-att-act]'));
  tab('assign'); await frames(); $('workNew').click(); await sleep(200);
  ok('ยังไม่รัน 053: ฟอร์มสั่งงานไม่มีช่องแนบ', !hostVisible('workfAtt'));
  closeAll();
  ok('ไม่มีการเขียนตาราง transfer_attachments ตรง ๆ จากหน้าเว็บเลย (ทุกการเขียนผ่านฟังก์ชัน)', ATT.writes.length === 0 && !CALLS.some(c => c.op === 'write'));

  // ── 10. ออกจากระบบ / สลับบัญชี ─────────────────────────────────────
  ATT.reset(); ATT.add('f1', 'board', 'm1', '', 'u3');
  await loadBoard(); await loadWork();
  openBoardForm(null); await sleep(150);
  await openPicker('bfAtt'); tick('f1');
  ok('ก่อนออกจากระบบ: หน้าต่างเลือกเปิดอยู่ · เลือกไว้ 1 ไฟล์', dlgOpen('attDlg') && att.pick && att.pick.sel.size === 1);
  doLogout(); await sleep(500);
  ok('ออกจากระบบ: หน้าต่างเลือกปิด · สถานะเลือกถูกทิ้ง · รายการแนบว่าง · ช่องแนบทุกฟอร์มว่างและซ่อน', !dlgOpen('attDlg') && !att.pick && att.list.length === 0 && Object.keys(attHosts).length === 0 &&
    ['workfAtt', 'workSubAtt', 'workrAtt', 'bfAtt'].every(h => $(h).innerHTML === '' && !hostVisible(h)) && $('attList').innerHTML === '');
  ok('ออกจากระบบ: ไม่เหลือชื่อไฟล์ในหน้า (กระดาน/ใบงาน/คำขอ/ตัวเลือก)', ['detailBody', 'workDlgBody', 'workReqDetail', 'workDetail', 'attList', 'boardRows'].every(id => $(id).textContent.indexOf('.mp4') < 0 && $('attList').textContent.indexOf('.pdf') < 0));
  // ผลโหลดที่มาทีหลังออกจากระบบถูกทิ้ง
  ATT.reset(); ATT.add('f1', 'board', 'm1', '', 'u3');
  await login('zen'); showSection('board'); await sleep(300);
  let release; ATT.gate = new Promise(r => { release = r; });
  const slow = loadBoard();
  await sleep(100);
  doLogout(); await sleep(400);
  release(); await slow; await sleep(100);
  ok('โหลดไฟล์แนบค้าง → ออกจากระบบ → คำตอบมาทีหลัง: ถูกทิ้ง (รายการแนบยังว่าง)', att.list.length === 0);
  ATT.gate = null;
  done();
}
function fatalClear() { const e = document.getElementById('fatalError'); if (e) e.remove(); }
function done() {
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

const net = '--host-resolver-rules=MAP * ~NOTFOUND';
const res = await runCdpPage({ root: pageRoot, file: 'desk.html', mock: MOCK3 + WORK_MOCK + TRANSFER_MOCK + ATT_MOCK, tests: TESTS, width: 1440, height: 900, coarse: false, shotDir: SHOTS, flags: [net] });
console.log('\n=== desk-attach: ' + (res.ok ? 'ผ่าน' : 'ไม่ผ่านหรือไม่ได้รันจนจบ') + ' ===');
process.exit(res.ok ? 0 : 1);
