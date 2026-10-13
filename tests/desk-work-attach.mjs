/**
 * เทสต์ "แนบไฟล์จากคลังโอนไฟล์" ในหมวด "งานของฉัน" ของ desk.html (migration 053 · เฟส 1: ไฟล์เดี่ยว)
 *   รัน: node tests/desk-work-attach.mjs
 *   ทำ mutation: WATT_ROOT=<โฟลเดอร์ที่มี desk.html ฉบับอื่น> node tests/desk-work-attach.mjs
 *
 * ฐานปลอมคือ tests/lib/worklist-mock.mjs (เพิ่มตาราง transfer_attachments/transfer_files + ฟังก์ชัน transfer_attach/detach/open ตามกติกา 053 —
 * ตัวจริงของ SQL ตรวจที่ฝั่งฐาน) — ที่นี่ตรวจฝั่งหน้าจอ:
 *  1. ฟอร์มสั่งงาน: เลือกไฟล์จากคลัง (ตัวเลือก · ค้นหา · ไฟล์หมดอายุ/ถูกลบไม่ขึ้น) · เก็บไว้ก่อนไม่แนบจนกว่าจะสั่งสำเร็จ · เตือนไฟล์หมดอายุก่อนกำหนดส่ง ·
 *     สั่งหลายคน = แนบทีละใบ (ctx brief) · ใบหนึ่งแนบล้ม = บอกตรง ๆ ไม่ขึ้นสำเร็จทั้งก้อน · แก้ใบเดิมไม่มีช่องแนบ
 *  2. รายละเอียดงาน: ไฟล์แนบจากผู้สั่ง/ผู้รับแต่ละครั้งที่ส่ง · ปุ่มตามสิทธิ์ · ไฟล์หมดอายุ/ถูกลบ = บอกเป็นคำ ไม่มีปุ่มเปิด · เตือนหมดอายุก่อนกำหนดส่ง
 *  3. เปิดดู/ดาวน์โหลด: ผ่าน transfer_open เสมอ (ไม่ขอ signed URL ตรง) · ไฟล์เพิ่งหมดอายุ = แจ้งตามจริง
 *  4. แนบเพิ่ม/ถอดจากรายละเอียด · เพดาน 20 · ฐานปฏิเสธบอกในหน้าต่าง
 *  5. ส่งงาน: แนบหลังส่งสำเร็จ (ctx submit:N ตามรอบ) · ส่งล้ม = ไม่แนบ · แนบล้มหลังส่ง = บอกว่าส่งไปแล้ว · ไฟล์ในคลังไม่นับเป็นหลักฐาน
 *  6. ยังไม่รัน 053 / โหลดไฟล์แนบล้ม / ไม่มี folder_path (051) · ออกจากระบบล้างหมด · XSS
 */

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HARNESS } from './lib/page-test.mjs';
import { runCdpPage } from './lib/cdp-page.mjs';
import { WORK_MOCK } from './lib/worklist-mock.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { MOCK: MOCK3 } = await import(pathToFileURL(join(root, 'tests/desk-home3.mjs')).href);
const pageRoot = process.env.WATT_ROOT || root;   // ทดสอบหน้าฉบับอื่น (mutation) ได้

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
const rpcs = fn => CALLS.filter(c => c.op === 'rpc' && c.fn === fn);
const lastRpc = fn => rpcs(fn)[rpcs(fn).length - 1];
const tab = n => document.querySelector('#workTabs .mail-tab[data-tab="' + n + '"]').click();
const txt = id => $(id).textContent;
const toast = () => $('toast').textContent;
const fatalText = () => (document.getElementById('fatalError') || {}).textContent || '';
const clearFatal = () => { const f = document.getElementById('fatalError'); if (f) f.remove(); };
const dlgOpen = id => $(id).open;
const setVal = (id, v) => { const e = $(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
const closeAll = () => document.querySelectorAll('dialog[open]').forEach(d => d.close());
const isRed = el => !!el && getComputedStyle(el).color === 'rgb(204, 0, 26)' && Number(getComputedStyle(el).fontWeight) >= 600;
const flat = s => String(s).replace(/\\s+/g, ' ').trim();
const taskOnServer = id => WORK.tasks.find(t => t.id === id);
const vis = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

// หน้าต่างเปิดไฟล์/ดาวน์โหลดปลอม (เหมือนเทสต์โอนไฟล์)
const POP = { opened: [] };
window.open = function () {
  const w = { _href: '', opener: 'x', closed: false, location: { set href(v) { w._href = v; }, get href() { return w._href; } }, close() { w.closed = true; } };
  POP.opened.push(w);
  return w;
};
const DL = [];
document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="data:text/plain"]'); if (a) { e.preventDefault(); DL.push(a.href); } }, true);

const NOW = Date.now(), H = 3600000, D = 24 * H;
const iso = ms => new Date(ms).toISOString();
const ymd = ms => new Date(ms).toISOString().slice(0, 10);
const XSS = '<img src=x onerror="window.__xss=1">.png';
const F = (id, o) => Object.assign({ id, category: 'photo', file_name: id, size_bytes: 2097152, note: '', uploaded_by: 'u2', uploaded_at: iso(NOW - D), expires_at: iso(NOW + 10 * D), is_permanent: false, status: 'ready', folder_path: '' }, o);
function seedLib() {
  WORK.lib = [
    F('L1', { category: 'video', file_name: 'รีวิว HDJ-CUE1.mp4', size_bytes: 83886080, note: 'คลิปตัวเต็ม', expires_at: iso(NOW + 20 * D), folder_path: 'End credit/2026' }),
    F('L2', { category: 'photo', file_name: 'ภาพสินค้า FLX4.png', expires_at: iso(NOW + 5 * D), thumb: 'data:image/png;base64,iVBORw0KGgo=' }),
    F('L3', { category: 'doc', file_name: 'โปรโมชัน ตุลาคม.pdf', is_permanent: true, expires_at: iso(NOW - D) }),          // ถาวร — ไม่สน expires_at
    F('L4', { category: 'photo', file_name: 'หมดอายุแล้ว.png', expires_at: iso(NOW - 2 * H) }),                              // ครบ 30 วันแล้วแต่ยังไม่ถูกเก็บกวาด (status ยัง ready)
    F('L5', { category: 'doc', file_name: 'ถูกลบ.pdf', status: 'deleted' }),
    F('L6', { category: 'photo', file_name: 'ใกล้หมด.png', expires_at: iso(NOW + 30 * H) }),
    F('L7', { category: 'photo', file_name: XSS }),
    F('L8', { category: 'doc', file_name: 'ไฟล์ที่ฉันไม่มีสิทธิ์เห็น.pdf', hidden: true }),
  ];
}
let attSeq = 0;
const A = (file, target, ctx, by) => WORK.att.push({ id: 'X' + (++attSeq), file_id: file, target_kind: 'task', target_id: target, ctx, attached_by: by, attached_at: iso(NOW - H) });
const pickBox = id => document.querySelector('#workPickList input[value="' + id + '"]');
const pickIds = () => [...document.querySelectorAll('#workPickList input')].map(i => i.value);
const pickClick = id => pickBox(id).click();
const detBtn = (act, key) => document.querySelector('#workDlgBody [data-act="' + act + '"]' + (key ? '[' + key + ']' : ''));
const detHeads = () => [...document.querySelectorAll('#workDlgBody h4.wk-sec-h')].map(h => flat(h.textContent));
const detRow = name => [...document.querySelectorAll('#workDlgBody .wk-link')].find(r => r.querySelector('strong') && r.querySelector('strong').textContent === name);
const stagedNames = id => [...$(id).querySelectorAll('.wk-link strong')].map(s => s.textContent);
const pickPerson = name => { const l = [...document.querySelectorAll('#workfPeople label')].find(x => x.textContent.indexOf(name) >= 0); l.querySelector('input').click(); };
async function openForm() { tab('assign'); await frames(); $('workNew').click(); await sleep(150); }
async function openPicker(btnId) { $(btnId).click(); await sleep(250); }

async function runTests() {
  L('=== แนบไฟล์จากคลังโอนไฟล์ (งานของฉัน · 053 เฟส 1) ===');

  // ── 1. ฟอร์มสั่งงาน (เจ้าของ) ─────────────────────────────────────────
  WORK.seed(); seedLib();
  await login('tibass'); showSection('tasks'); await sleep(300);
  ok('ล็อกอินแล้วโหลดไฟล์แนบ (transfer_attachments) พร้อมชุดงาน · ตารางมี 053 = ไม่ขึ้นแถบเตือน', CALLS.some(c => c.op === 'select' && c.table === 'transfer_attachments') && work.attMissing === false && fatalText() === '');
  await openForm();
  ok('ฟอร์มสั่งงานใหม่: มีช่อง "ไฟล์จากคลังไฟล์" + ปุ่ม "+ แนบจากคลังไฟล์" · ยังไม่มีไฟล์ที่เลือก', !$('workfFilesField').hidden && vis($('workfPick')) && stagedNames('workfFiles').length === 0 && /ไม่ถูกก๊อปซ้ำ/.test($('workfFilesField').textContent));
  await openPicker('workfPick');
  ok('เปิดตัวเลือก: โหลดจากตาราง transfer_files เฉพาะที่ status ready · ขอคอลัมน์ folder_path ด้วย',
    dlgOpen('workPickDlg') && CALLS.some(c => c.op === 'select' && c.table === 'transfer_files'));
  ok('รายการในตัวเลือก: เห็น L1 L2 L3 L6 L7 · ไม่เห็นไฟล์ที่หมดอายุแล้ว (L4) · ไฟล์ที่ถูกลบ (L5) · ไฟล์ที่ไม่มีสิทธิ์เห็น (L8)', ['L1', 'L2', 'L3', 'L6', 'L7'].every(i => pickIds().includes(i)) && ['L4', 'L5', 'L8'].every(i => !pickIds().includes(i)), pickIds().join());
  ok('ชื่อไฟล์ที่เป็นแท็ก HTML (L7) ในตัวเลือก: แสดงเป็นข้อความ ไม่สร้างองค์ประกอบ ไม่รันสคริปต์', /<img src=x/.test(txt('workPickList')) && !document.querySelector('#workPickList img') && window.__xss === undefined);
  ok('ตัวเลือกจัดกลุ่มตามชนิดไฟล์ + บอกจำนวน · แสดงโฟลเดอร์นำหน้าชื่อ · ขนาดไฟล์ · เหลือกี่วัน/ถาวร',
    /วิดีโอ \\(1\\)/.test(txt('workPickList')) && /รูปภาพ \\(3\\)/.test(txt('workPickList')) && /End credit\\/2026\\/รีวิว HDJ-CUE1\\.mp4/.test(flat(txt('workPickList'))) && /80\\.0 MB/.test(txt('workPickList')) && /เหลือ 20 วัน/.test(txt('workPickList')) && /ถาวร/.test(pickBox('L3').closest('label').textContent));
  ok('ยังไม่เลือกอะไร: ปุ่ม "แนบไฟล์ที่เลือก" ปิด · บอก "เลือกแล้ว 0 ไฟล์ · แนบได้อีก 20"', $('workPickGo').disabled && /เลือกแล้ว 0 ไฟล์ · แนบได้อีก 20/.test(txt('workPickMsg')), txt('workPickMsg'));
  setVal('workPickQ', 'cue1');
  ok('ค้นหา "cue1" (ไม่สนตัวพิมพ์): เหลือ L1 อย่างเดียว', pickIds().join() === 'L1', pickIds().join());
  setVal('workPickQ', 'end credit');
  ok('ค้นด้วยชื่อโฟลเดอร์ได้: เจอ L1', pickIds().join() === 'L1', pickIds().join());
  setVal('workPickQ', 'zzzไม่มี');
  ok('ค้นไม่เจอ: บอก "ไม่พบไฟล์ที่ตรงกับคำค้น"', /ไม่พบไฟล์ที่ตรงกับคำค้น/.test(txt('workPickList')));
  setVal('workPickQ', '');
  pickClick('L1'); setVal('workPickQ', 'โปรโมชัน'); pickClick('L3');
  ok('เลือกข้ามการค้นหา: L1 ที่เลือกไว้ก่อนค้นยังนับ · เลือกแล้ว 2 ไฟล์ · ปุ่มแนบเปิด', /เลือกแล้ว 2 ไฟล์/.test(txt('workPickMsg')) && !$('workPickGo').disabled, txt('workPickMsg'));
  $('workPickGo').click(); await sleep(150);
  ok('กด "แนบไฟล์ที่เลือก" ในฟอร์มสั่งงาน: ตัวเลือกปิด · เก็บไว้ในฟอร์ม 2 ไฟล์ · ยังไม่เรียก transfer_attach (ใบงานยังไม่ถูกสร้าง)', !dlgOpen('workPickDlg') && stagedNames('workfFiles').join('|') === 'รีวิว HDJ-CUE1.mp4|โปรโมชัน ตุลาคม.pdf' && rpcs('transfer_attach').length === 0, stagedNames('workfFiles').join('|'));
  ok('รายการที่เก็บไว้: บอกชนิด+ขนาด · ไฟล์ไม่ถาวรบอกเหลือกี่วัน · ถาวรบอก "ถาวร · Asset"', /วิดีโอ · 80\\.0 MB/.test(txt('workfFiles')) && /เหลือ 20 วัน/.test(txt('workfFiles')) && /ถาวร · Asset/.test(txt('workfFiles')));
  await openPicker('workfPick');
  ok('เปิดตัวเลือกซ้ำ: ไฟล์ที่เก็บไว้แล้วเป็น "แนบแล้ว" เลือกซ้ำไม่ได้', pickBox('L1').disabled && pickBox('L3').disabled && /แนบแล้ว/.test(pickBox('L1').closest('label').textContent) && !pickBox('L2').disabled);
  $('workPickCancel').click(); await sleep(100);
  ok('ไม่มีกำหนดส่ง: ยังไม่เตือนเรื่องอายุไฟล์', !/หมดอายุก่อนกำหนดส่งงาน/.test(txt('workfFiles')));
  setVal('workfDate', ymd(NOW + 40 * D)); setVal('workfTime', '12:00');
  ok('ตั้งกำหนดส่ง 40 วันข้างหน้า (ไฟล์ L1 หมดอายุใน 20 วัน): เตือน "หมดอายุก่อนกำหนดส่งงาน" เป็นแดงตัวหนา — เฉพาะไฟล์ที่ไม่ถาวร (L3 ไม่เตือน)',
    $('workfFiles').querySelectorAll('.wk-red').length === 1 && isRed($('workfFiles').querySelector('.wk-red')) && /หมดอายุก่อนกำหนดส่งงาน/.test(txt('workfFiles')) && !/หมดอายุก่อนกำหนดส่งงาน/.test(detRowText('โปรโมชัน ตุลาคม.pdf')));
  document.querySelector('#workFormDialog [data-quick="today"]').click();
  ok('กดปุ่มตั้งวันด่วน "วันนี้ 18:00": เตือนหายทันที (ตามกำหนดใหม่ — ไฟล์ L1 ยังไม่หมดก่อนวันนี้)', $('workfFiles').querySelectorAll('.wk-red').length === 0);
  $('workfFiles').querySelector('[data-act="stg-rm"][data-i="0"]').click();
  ok('"เอาออก": เหลือ L3 ไฟล์เดียว · ปุ่มแนบยังกดได้', stagedNames('workfFiles').join('|') === 'โปรโมชัน ตุลาคม.pdf' && !$('workfPick').disabled);
  await openPicker('workfPick'); pickClick('L1'); pickClick('L2'); pickClick('L6'); $('workPickGo').click(); await sleep(150);
  ok('เลือกเพิ่ม L1 L2 L6 (รวม 4 ไฟล์): เอาออกตำแหน่งที่ 4 (L6) → เหลือ L3 L1 L2 ตามลำดับ (ไม่ใช่ลบตัวแรก)', stagedNames('workfFiles').join('|') === 'โปรโมชัน ตุลาคม.pdf|รีวิว HDJ-CUE1.mp4|ภาพสินค้า FLX4.png|ใกล้หมด.png' && ($('workfFiles').querySelector('[data-act="stg-rm"][data-i="3"]').click(), stagedNames('workfFiles').join('|') === 'โปรโมชัน ตุลาคม.pdf|รีวิว HDJ-CUE1.mp4|ภาพสินค้า FLX4.png'), stagedNames('workfFiles').join('|'));
  setVal('workfTitle', 'ตัดคลิปรีวิวลง YouTube'); pickPerson('Nui'); pickPerson('Pran');
  const t0 = CALLS.length;
  $('workfSave').click(); await sleep(700);
  const made = WORK.tasks.filter(t => t.title === 'ตัดคลิปรีวิวลง YouTube');
  const att = rpcs('transfer_attach');
  ok('สั่ง 2 ใบ: work_create 1 ครั้ง แล้ว transfer_attach 2 ครั้ง (ใบละครั้ง · ctx brief · kind task · ไฟล์ครบ 3)',
    made.length === 2 && att.length === 2 && att.every(c => c.args.p_kind === 'task' && c.args.p_ctx === 'brief' && c.args.p_files.length === 3 && ['L1', 'L2', 'L3'].every(i => c.args.p_files.includes(i))) && new Set(att.map(c => c.args.p_target)).size === 2 && att.every(c => made.some(t => t.id === c.args.p_target)),
    JSON.stringify(att.map(c => c.args)));
  const idxCreate = CALLS.findIndex((c, i) => i >= t0 && c.op === 'rpc' && c.fn === 'work_create'), idxAtt = CALLS.findIndex((c, i) => i >= t0 && c.op === 'rpc' && c.fn === 'transfer_attach');
  ok('ลำดับ: สร้างใบก่อนแล้วค่อยแนบ · ฐานมีไฟล์แนบ 6 แถว (2 ใบ × 3) ผู้แนบ = เจ้าของ · ฟอร์มปิด · ข้อความบอกจำนวนไฟล์ · ไม่มีแถบแดง', idxCreate >= 0 && idxAtt > idxCreate && WORK.att.length === 6 && WORK.att.every(a => a.attached_by === 'u1' && a.ctx === 'brief') && !dlgOpen('workFormDialog') && /สั่งงานแล้ว 2 ใบ · แนบไฟล์ 3 ไฟล์/.test(toast()) && fatalText() === '', toast());
  await openForm();
  ok('เปิดฟอร์มใหม่หลังสั่ง: ไม่มีไฟล์ค้างจากรอบก่อน', stagedNames('workfFiles').length === 0 && workForm.files.length === 0);
  closeAll(); await sleep(100);

  // ── 1b. สั่งหลายคน ใบหนึ่งแนบล้ม — บอกตรง ๆ ไม่ขึ้นสำเร็จทั้งก้อน ──
  await openForm();
  await openPicker('workfPick'); pickClick('L2'); $('workPickGo').click(); await sleep(150);
  setVal('workfTitle', 'ถ่ายรูปหน้าร้านลงเพจ'); pickPerson('Nui'); pickPerson('Pran');
  const origAttach = WORK.rpc.transfer_attach; let nAtt = 0;
  WORK.rpc.transfer_attach = (me, a) => (++nAtt === 2 ? { data: null, error: { message: 'แนบไฟล์ไม่ได้ — ไม่มีสิทธิ์กับรายการนี้ หรือรายการถูกลบ/ยกเลิกไปแล้ว' } } : origAttach(me, a));
  const nCreate0 = rpcs('work_create').length;
  $('workfSave').click(); await sleep(700);
  WORK.rpc.transfer_attach = origAttach;
  const made2 = WORK.tasks.filter(t => t.title === 'ถ่ายรูปหน้าร้านลงเพจ'), got = made2.filter(t => WORK.att.some(a => a.target_id === t.id)), lost = made2.filter(t => !WORK.att.some(a => a.target_id === t.id));
  ok('ใบหนึ่งแนบล้ม: สร้างครบ 2 ใบ (work_create ครั้งเดียว) · แนบสำเร็จ 1 ใบ ล้ม 1 ใบ · ฟอร์มปิด (ไม่ให้กดสั่งซ้ำจนได้ใบซ้ำ)', rpcs('work_create').length - nCreate0 === 1 && made2.length === 2 && got.length === 1 && lost.length === 1 && !dlgOpen('workFormDialog') && workForm === null);
  ok('แถบแดงบอกตรง ๆ: สั่งแล้ว 2 ใบ แต่แนบไม่สำเร็จ 1 ใบ · ชื่อผู้รับของใบที่ล้ม · เหตุผลจากฐาน · บอกวิธีแนบซ้ำ — ไม่ขึ้นว่า "แนบไฟล์" สำเร็จ',
    /สั่งงานแล้ว 2 ใบ แต่แนบไฟล์จากคลังไม่สำเร็จ 1 ใบ/.test(fatalText()) && fatalText().indexOf(lost[0].assignee_id === 'u4' ? 'Nui' : 'Pran') >= 0 && /ไม่มีสิทธิ์กับรายการนี้/.test(fatalText()) && /ซ้ำได้/.test(fatalText()) && !/แนบไฟล์ 1 ไฟล์/.test(toast()), fatalText() + ' | ' + toast());
  clearFatal();
  // แนบซ้ำให้ใบที่ล้มจากหน้ารายละเอียดงาน (เจ้าของ)
  tab('assign'); await frames();
  workOpenDetail(lost[0].id); await sleep(250);
  ok('ใบที่แนบล้ม: รายละเอียดงานมีปุ่ม "+ แนบจากคลังไฟล์" (ผู้สั่ง) ให้แนบซ้ำ', !!detBtn('att-add', 'data-which="brief"') && detHeads().some(h => /ไฟล์แนบจากคลังไฟล์ · ผู้สั่ง/.test(h)));
  detBtn('att-add', 'data-which="brief"').click(); await sleep(250);
  pickClick('L2'); $('workPickGo').click(); await sleep(500);
  ok('แนบซ้ำจากรายละเอียด: transfer_attach (ctx brief) → ฐานมีไฟล์แนบของใบนั้น · ตัวเลือกปิด · รายละเอียดวาดใหม่เห็นไฟล์', !dlgOpen('workPickDlg') && WORK.att.some(a => a.target_id === lost[0].id && a.file_id === 'L2') && !!detRow('ภาพสินค้า FLX4.png'));
  closeAll(); await sleep(100);

  // ── 1c. แก้ใบเดิม: ไม่มีช่องแนบในฟอร์ม (แนบ/ถอดทำที่รายละเอียดงานทันที) ──
  workFormOpen(lost[0].id); await sleep(150);
  ok('ฟอร์มแก้ใบเดิม: ซ่อนช่อง "ไฟล์จากคลังไฟล์" (ไม่ให้เกิด 2 ทางสับสน)', $('workfFilesField').hidden === true);
  closeAll(); await sleep(100);
  doLogout(); await sleep(400);

  // ── 2. รายละเอียดงาน: ผู้รับ (Zen · พนักงาน) ──────────────────────────
  WORK.seed(); seedLib(); attSeq = 0;
  A('L1', 'a5', 'brief', 'u4'); A('L4', 'a5', 'brief', 'u4'); A('L2', 'a5', 'submit:1', 'u2'); A('L8', 'a5', 'brief', 'u4'); A('L7', 'a5', 'submit:1', 'u2'); A('L5', 'a5', 'brief', 'u4');
  WORK.att.push({ id: 'XB', file_id: 'L6', target_kind: 'board', target_id: 'a5', ctx: 'brief', attached_by: 'u4', attached_at: iso(NOW - H) });          // ไฟล์แนบของข้อความกระดานที่ id ชนกับใบงาน — ต้องไม่ขึ้นในใบงาน
  await login('zen'); showSection('tasks'); await sleep(300);
  workOpenDetail('a5'); await sleep(300);
  ok('รายละเอียดใบ a5 (ผู้รับ): หัวข้อ "ไฟล์แนบจากคลังไฟล์ · ผู้สั่ง" และ "ผู้รับ ส่งครั้งที่ 1"', detHeads().filter(h => /^ไฟล์แนบจากคลังไฟล์/.test(h)).join('|') === 'ไฟล์แนบจากคลังไฟล์ · ผู้สั่ง|ไฟล์แนบจากคลังไฟล์ · ผู้รับ ส่งครั้งที่ 1', detHeads().join('|'));
  const rL1 = detRow('รีวิว HDJ-CUE1.mp4'), rL4 = detRow('หมดอายุแล้ว.png'), rL2 = detRow('ภาพสินค้า FLX4.png');
  ok('ไฟล์ใช้ได้ (L1 วิดีโอ): มี "เปิดดู" + "ดาวน์โหลด" · บอกผู้แนบ/ชนิด/ขนาด · เหลือกี่วัน', !!rL1 && !!rL1.querySelector('[data-act="att-view"]') && !!rL1.querySelector('[data-act="att-dl"]') && /Nui/.test(rL1.textContent) && /80\\.0 MB/.test(rL1.textContent) && /เหลือ 20 วัน/.test(rL1.textContent), rL1 && flat(rL1.textContent));
  ok('ไฟล์ที่ครบ 30 วันแล้ว (L4): บอก "หมดอายุแล้ว" เป็นแดงตัวหนา · ไม่มีปุ่มเปิดดู/ดาวน์โหลด (ไม่ใช่ error เงียบ)', !!rL4 && /หมดอายุแล้ว/.test(rL4.textContent) && isRed(rL4.querySelector('.wk-red')) && !rL4.querySelector('[data-act="att-view"],[data-act="att-dl"]'), rL4 && flat(rL4.textContent));
  ok('ไฟล์แนบของรายการชนิดอื่น (board) ที่ target_id ชนกับใบงาน: ไม่ขึ้นในใบงาน (ดึงเฉพาะ target_kind = task)', !detRow('ใกล้หมด.png'));
  const rDel = detRow('ถูกลบ.pdf');
  ok('ไฟล์ที่ถูกลบออกจากคลัง (L5 status deleted): บอก "ไฟล์ถูกลบออกจากคลังแล้ว" เป็นแดงตัวหนา · ไม่มีปุ่มเปิด', !!rDel && /ไฟล์ถูกลบออกจากคลังแล้ว/.test(rDel.textContent) && isRed(rDel.querySelector('.wk-red')) && !rDel.querySelector('[data-act="att-view"],[data-act="att-dl"]'));
  const rHid = [...document.querySelectorAll('#workDlgBody .wk-link')].find(r => /ไฟล์ไม่พร้อมใช้งาน/.test(r.textContent));
  ok('ไฟล์ที่ฐานไม่ให้เห็น (ถูกลบจากคลัง/ไม่มีสิทธิ์): ขึ้น "ไฟล์ไม่พร้อมใช้งาน" · ไม่มีปุ่มเปิด', !!rHid && isRed(rHid.querySelector('.wk-red')) && !rHid.querySelector('[data-act="att-view"],[data-act="att-dl"]'));
  ok('สิทธิ์ของผู้รับ (Zen): ถอดได้เฉพาะไฟล์ที่ตัวเองแนบ (L2) — ไฟล์ของผู้สั่ง (L1 L4) ไม่มีปุ่มถอด · ไม่มีปุ่ม "แนบ" ของผู้สั่ง · มีปุ่มแนบของครั้งที่ส่ง', !!rL2.querySelector('[data-act="att-rm"]') && !rL1.querySelector('[data-act="att-rm"]') && !rL4.querySelector('[data-act="att-rm"]') && !detBtn('att-add', 'data-which="brief"') && !!detBtn('att-add', 'data-which="submit"'));
  const xr = detRow(XSS);
  ok('ชื่อไฟล์ที่เป็นแท็ก HTML แสดงเป็นข้อความ (ไม่สร้างองค์ประกอบ · ไม่รันสคริปต์)', !!xr && !document.querySelector('#workDlgBody img[src="x"]') && window.__xss === undefined);
  // รูปตัวอย่าง: อ่าน thumb จากคลังโดยตรง (ไม่เปิดไฟล์จริง = ไม่ลงประวัติ/ไม่ทำเครื่องหมายเปิดแล้ว)
  ok('รูปตัวอย่างไฟล์แนบ: L2 (มี thumb) ขึ้นเป็นรูปจากคลัง · ปุ่มรูปกดเปิดดูได้ · L1 (ไม่มี thumb) ขึ้นไอคอน · ไฟล์หมดอายุไม่มีรูป · ยังไม่เรียก transfer_open',
    !!rL2.querySelector('button.tr-thumb[data-act="att-view"] img[src^="data:image/png"]') && !!rL1.querySelector('.tr-thumb svg') && !rL1.querySelector('.tr-thumb img') && !rL4.querySelector('.tr-thumb') && WORK.opens.length === 0, rL2.innerHTML.slice(0, 200));
  // เปิดดู/ดาวน์โหลด — ผ่าน transfer_open เสมอ
  const nUnseen = rpcs('transfer_unseen_count').length;
  rL1.querySelector('[data-act="att-view"]').click(); await sleep(400);
  ok('เปิดไฟล์ที่ถูก Tag ผ่านใบงานแล้ว: โหลดตัวเลขแดงของเมนู "โอนไฟล์" ใหม่ (ฐานทำเครื่องหมาย "เปิดแล้ว" ให้)', rpcs('transfer_unseen_count').length === nUnseen + 1);
  ok('เปิดดู: เรียก transfer_open (purpose view) → ขอลิงก์ถังโอนไฟล์ 60 วินาที ด้วยพาธที่ฐานให้ → เปิดแท็บใหม่ (opener = null)', WORK.opens.length === 1 && WORK.opens[0].id === 'L1' && WORK.opens[0].purpose === 'view' && WORK.tsigned.length === 1 && WORK.tsigned[0].path === 'video/L1.bin' && WORK.tsigned[0].secs === 60 && POP.opened.length === 1 && /^data:text\\/plain/.test(POP.opened[0]._href) && POP.opened[0].opener === null, JSON.stringify(WORK.tsigned));
  rL1.querySelector('[data-act="att-dl"]').click(); await sleep(400);
  ok('ดาวน์โหลด: transfer_open (purpose download) → ลิงก์พร้อมชื่อไฟล์เดิม · ไม่เปิดแท็บ', WORK.opens.length === 2 && WORK.opens[1].purpose === 'download' && WORK.tsigned[1].opts && WORK.tsigned[1].opts.download === 'รีวิว HDJ-CUE1.mp4' && DL.length === 1 && POP.opened.length === 1);
  ok('ไม่มีทางขอลิงก์ไฟล์ตรง ๆ: ทุกครั้งที่ขอลิงก์ มี transfer_open นำหน้า (นับเท่ากัน)', WORK.tsigned.length === WORK.opens.length);
  // ไฟล์เพิ่งหมดอายุระหว่างที่หน้าเปิดอยู่
  WORK.lib.find(f => f.id === 'L2').expires_at = iso(NOW - H);
  detRow('ภาพสินค้า FLX4.png').querySelector('[data-act="att-view"]').click(); await sleep(500);
  ok('ไฟล์เพิ่งหมดอายุ: ฐานปฏิเสธ → แถบแดงบอกตามจริง + ปิดแท็บเปล่าที่เปิดไว้ · ไม่ขอลิงก์ถัง', /ไม่สำเร็จ/.test(fatalText()) && /ภาพสินค้า FLX4\\.png/.test(fatalText()) && POP.opened[POP.opened.length - 1].closed === true && WORK.tsigned.length === 2, fatalText());
  clearFatal(); await sleep(300);
  ok('โหลดใหม่หลังล้ม: แถวขึ้น "หมดอายุแล้ว" ไม่มีปุ่มเปิด', /หมดอายุแล้ว/.test(detRow('ภาพสินค้า FLX4.png').textContent) && !detRow('ภาพสินค้า FLX4.png').querySelector('[data-act="att-view"]'));
  // สิทธิ์ฝั่งหน้าจอ: ผู้รับแนบของผู้สั่งไม่ได้
  const nAttX = rpcs('transfer_attach').length;
  workAttAdd('a5', 'brief'); await sleep(150);
  ok('เรียกแนบ brief ทั้งที่ไม่ใช่ผู้สั่ง (หน้าจอล้าสมัย): ขึ้นข้อความ ไม่เปิดตัวเลือก ไม่เรียกฐาน', /แนบไฟล์ให้ใบงานนี้ไม่ได้แล้ว/.test(toast()) && !dlgOpen('workPickDlg') && rpcs('transfer_attach').length === nAttX);
  // ถอดไฟล์ของตัวเอง
  detRow('ภาพสินค้า FLX4.png').querySelector('[data-act="att-rm"]').click(); await sleep(150);
  ok('กด "ถอดออก": ถามยืนยัน — บอกชื่อไฟล์ · แดงตัวหนา "ตัวไฟล์ยังอยู่ในคลังไฟล์" · ยังไม่เรียกฐาน', dlgOpen('confirmDialog') && /ภาพสินค้า FLX4\\.png/.test(txt('confirmBody')) && isRed($('confirmBody').querySelector('.wk-red')) && /ตัวไฟล์ยังอยู่ในคลังไฟล์/.test(txt('confirmBody')) && rpcs('transfer_detach').length === 0);
  WORK.fail.rpc_transfer_detach = 'ฐานข้อมูลล่ม';
  $('confirmOkBtn').click(); await sleep(400);
  ok('ถอดแล้วฐานล้ม: แถบแดงบอกตามจริง · ไฟล์ยังแนบอยู่ที่ฐาน', /ถอดไฟล์แนบไม่สำเร็จ: ฐานข้อมูลล่ม/.test(fatalText()) && WORK.att.some(a => a.file_id === 'L2' && a.target_id === 'a5'));
  clearFatal(); delete WORK.fail.rpc_transfer_detach;
  detRow('ภาพสินค้า FLX4.png').querySelector('[data-act="att-rm"]').click(); await sleep(150);
  $('confirmOkBtn').click(); await sleep(500);
  ok('ถอดสำเร็จ: transfer_detach ได้ id ของไฟล์แนบ · แถวหาย · ตัวไฟล์ยังอยู่ในคลัง (lib ไม่ถูกแตะ) · ข้อความ', lastRpc('transfer_detach').args.p_id === 'X3' && !WORK.att.some(a => a.id === 'X3') && !detRow('ภาพสินค้า FLX4.png') && WORK.lib.some(f => f.id === 'L2') && /ถอดไฟล์แนบแล้ว/.test(toast()));
  closeAll(); await sleep(100);
  // พนักงานสั่งงานพนักงานด้วยกัน (d1: Zen สั่ง Nutty): ผู้สั่งแนบของผู้สั่งได้ แม้ไม่ใช่เจ้าของ/ผู้ดูแล · ใบที่ผู้รับยังไม่เคยส่ง ไม่มีส่วน/ปุ่มของ "ครั้งที่ส่ง"
  workOpenDetail('d1'); await sleep(300);
  ok('พนักงานที่เป็นผู้สั่ง (d1): มีปุ่มแนบของผู้สั่ง · ผู้รับ (Nutty) ยังไม่เคยส่ง → ไม่มีส่วน/ปุ่มของ "ส่งครั้งที่ N"', !!detBtn('att-add', 'data-which="brief"') && !detBtn('att-add', 'data-which="submit"') && !detHeads().some(h => /ส่งครั้งที่/.test(h)), detHeads().join('|'));
  closeAll(); await sleep(100);
  workOpenDetail('a4'); await sleep(300);
  ok('ใบของตัวเองที่ยังไม่เคยส่ง (a4): ไม่มีปุ่ม/ส่วนแนบของ "ส่งครั้งที่ N" (ยังไม่มีครั้งที่ให้แนบ)', !detBtn('att-add') && !detHeads().some(h => /ส่งครั้งที่/.test(h)), detHeads().join('|'));
  closeAll(); await sleep(100);
  doLogout(); await sleep(400);

  // ── 2b. ผู้สั่ง (Nui · ผู้ดูแล) และเจ้าของ: ปุ่มตามสิทธิ์ ──
  WORK.seed(); seedLib(); attSeq = 0;
  A('L1', 'a5', 'brief', 'u4'); A('L2', 'a5', 'submit:1', 'u2');
  await login('nui'); showSection('tasks'); await sleep(300);
  workOpenDetail('a5'); await sleep(300);
  ok('ผู้สั่ง (Nui ผู้ดูแล · ผู้รับเป็นพนักงาน): มีปุ่มแนบของผู้สั่ง · ถอดไฟล์ของตัวเองได้ · ถอดไฟล์ที่ผู้รับแนบไม่ได้ · ไม่มีปุ่มแนบของครั้งที่ส่ง', !!detBtn('att-add', 'data-which="brief"') && !!detRow('รีวิว HDJ-CUE1.mp4').querySelector('[data-act="att-rm"]') && !detRow('ภาพสินค้า FLX4.png').querySelector('[data-act="att-rm"]') && !detBtn('att-add', 'data-which="submit"'));
  WORK.tasks.push({ id: 'adm1', title: 'งานของ Fah (เจ้าของสั่ง)', detail: '', kind: 'other', channels: [], ref_links: [], assignee_id: 'u5', created_by: 'u1', due_at: null, status: 'open', phase: 'final', batch_id: null, submitted_at: null, closed_at: null, created_at: iso(NOW - 5 * H), updated_at: iso(NOW - H) });
  await loadWork(); await sleep(200);
  closeAll(); await sleep(80); workOpenDetail('adm1'); await sleep(300);
  ok('ผู้ดูแลกับใบของผู้ดูแลด้วยกัน (ผู้สั่งเป็นเจ้าของ): ไม่มีปุ่มแนบของผู้สั่ง (ฐานให้ผู้ดูแลแนบเฉพาะใบที่ผู้รับเป็นพนักงาน)', !detBtn('att-add'));
  closeAll(); await sleep(80); workOpenDetail('a5'); await sleep(300);
  // แนบเพิ่มจากรายละเอียด: ของที่แนบแล้วเลือกซ้ำไม่ได้ · ฐานปฏิเสธบอกในหน้าต่าง
  detBtn('att-add', 'data-which="brief"').click(); await sleep(250);
  ok('แนบเพิ่มจากรายละเอียด: ตัวเลือกเปิด · ไฟล์ที่แนบแล้ว (L1) เป็น "แนบแล้ว" เลือกไม่ได้ · ข้อความ "แนบไว้แล้ว 1" · (ก่อน 059) ไม่มีแท็บโฟลเดอร์', dlgOpen('workPickDlg') && pickBox('L1').disabled && /แนบไว้แล้ว 1/.test(txt('workPickMsg')) && $('workPickMode').hidden === true);
  pickClick('L3'); WORK.fail.rpc_transfer_attach = 'มีไฟล์ที่ไม่พบ ถูกลบ หรือหมดอายุแล้ว — เลือกใหม่จากคลังไฟล์';
  $('workPickGo').click(); await sleep(400);
  ok('ฐานปฏิเสธ: ตัวเลือกยังเปิด · บอกเหตุผลของฐานในหน้าต่าง · ไม่ขึ้นข้อความสำเร็จ · ที่เลือกไว้ไม่หาย · ปุ่มกลับมากดได้', dlgOpen('workPickDlg') && !$('workPickErr').hidden && /ถูกลบ หรือหมดอายุแล้ว/.test(txt('workPickErr')) && pickBox('L3').checked && !$('workPickGo').disabled && !/✅ แนบไฟล์แล้ว/.test(toast()));
  delete WORK.fail.rpc_transfer_attach;
  const nAttG = rpcs('transfer_attach').length; let relG = null; WORK.gate = new Promise(r => { relG = r; });
  $('workPickGo').click(); await sleep(60); workPickGo(); await sleep(60);
  const gBusy = $('workPickGo').disabled && workPick.busy === true;
  WORK.gate = null; relG(); await sleep(500);
  ok('กดแนบซ้ำระหว่างรอฐาน (เรียกซ้ำตรง ๆ ด้วย): ปุ่มถูกปิดทันที · transfer_attach ถูกเรียกครั้งเดียว', gBusy && rpcs('transfer_attach').length === nAttG + 1, gBusy + '/' + (rpcs('transfer_attach').length - nAttG));
  ok('กดซ้ำหลังฐานกลับมา: ctx brief ส่งเฉพาะไฟล์ที่เลือก (L3) · ปิดตัวเลือก · แถวใหม่ในรายละเอียด · ข้อความ "แนบไฟล์แล้ว 1 ไฟล์"', lastRpc('transfer_attach').args.p_ctx === 'brief' && lastRpc('transfer_attach').args.p_files.join() === 'L3' && !dlgOpen('workPickDlg') && !!detRow('โปรโมชัน ตุลาคม.pdf') && /แนบไฟล์แล้ว 1 ไฟล์/.test(toast()));
  closeAll(); await sleep(100);
  // เพดาน 20 ไฟล์
  for (let i = 0; i < 24; i++) WORK.lib.push(F('B' + i, { category: 'doc', file_name: 'เอกสาร-' + i + '.pdf' }));
  for (let i = 0; i < 18; i++) A('B' + i, 'a5', 'brief', 'u4');            // + L1 + L3 (แนบจากรอบก่อน) = 20 เต็มพอดี
  await loadWork(); await sleep(200);
  workOpenDetail('a5'); await sleep(300);
  detBtn('att-add', 'data-which="brief"').click(); await sleep(300);
  ok('แนบไว้แล้ว 20 ไฟล์ (L1 + L3 + B0-B17): ตัวเลือกบอก "แนบได้อีก 0" · ทุกช่องที่ยังไม่แนบเลือกไม่ได้ · ปุ่มแนบปิด', /แนบได้อีก 0/.test(txt('workPickMsg')) && pickBox('B20').disabled && pickBox('L2').disabled && $('workPickGo').disabled, txt('workPickMsg'));
  closeAll(); await sleep(100);
  WORK.att = WORK.att.filter(a => !(a.target_id === 'a5' && /^B/.test(a.file_id) && Number(a.file_id.slice(1)) >= 17));       // เหลือ B0-B16 = 17 + L1 + L3 = 19
  await loadWork(); await sleep(200);
  workOpenDetail('a5'); await sleep(300);
  detBtn('att-add', 'data-which="brief"').click(); await sleep(300);
  pickClick('B20');
  ok('แนบไว้ 19: เลือกได้อีก 1 — พอเลือก 1 ไฟล์ ช่องอื่นถูกปิดทั้งหมด (ไม่ให้เกินเพดาน)', pickBox('B20').checked && pickBox('B21').disabled && pickBox('L2').disabled && !pickBox('B20').disabled && /แนบได้อีก 0/.test(txt('workPickMsg')), txt('workPickMsg'));
  closeAll(); await sleep(100);
  doLogout(); await sleep(400);

  // ── 2c. ใบที่ยกเลิก · เจ้าของ ──
  WORK.seed(); seedLib(); attSeq = 0;
  A('L1', 'a5', 'brief', 'u4'); A('L2', 'a5', 'submit:1', 'u2');
  WORK.tasks.find(t => t.id === 'a6').status = 'cancelled';
  A('L1', 'a6', 'brief', 'u4'); A('L3', 'a6', 'brief', 'u1');
  await login('tibass'); showSection('tasks'); await sleep(300);
  workOpenDetail('a5'); await sleep(300);
  ok('เจ้าของ: มีปุ่มแนบทั้งของผู้สั่งและของครั้งที่ส่ง · ถอดไฟล์ได้ทุกไฟล์', !!detBtn('att-add', 'data-which="brief"') && !!detBtn('att-add', 'data-which="submit"') && document.querySelectorAll('#workDlgBody [data-act="att-rm"]').length === 2);
  closeAll(); await sleep(100);
  workOpenDetail('a6'); await sleep(300);
  ok('ใบที่ยกเลิกแล้ว: ไม่มีปุ่มแนบเพิ่มเลย · ถอดได้เฉพาะไฟล์ที่เจ้าของแนบเอง (L3) ส่วน L1 ของ Nui ถอดไม่ได้ (ฐานบังคับ)', !detBtn('att-add') && !!detRow('โปรโมชัน ตุลาคม.pdf').querySelector('[data-act="att-rm"]') && !detRow('รีวิว HDJ-CUE1.mp4').querySelector('[data-act="att-rm"]'));
  closeAll(); await sleep(100);
  // เตือนหมดอายุก่อนกำหนดส่งในรายละเอียด
  WORK.tasks.find(t => t.id === 'a5').due_at = iso(NOW + 25 * D);
  await loadWork(); await sleep(200);
  workOpenDetail('a5'); await sleep(300);
  ok('ใบที่กำหนดส่งหลังไฟล์หมดอายุ: L1 (หมดใน 20 วัน · กำหนด 25 วัน) เตือนแดงตัวหนา · L2 (หมดใน 5 วัน) เตือน', isRed(detRow('รีวิว HDJ-CUE1.mp4').querySelector('.wk-red')) && /หมดอายุก่อนกำหนดส่งงาน/.test(detRow('รีวิว HDJ-CUE1.mp4').textContent) && /หมดอายุก่อนกำหนดส่งงาน/.test(detRow('ภาพสินค้า FLX4.png').textContent));
  closeAll(); await sleep(100);
  // ผู้รับแนบหลังส่งงาน — ผู้ตรวจเห็นเมื่อเปิดรายละเอียด (ตารางแนบไม่มี Realtime)
  A('L3', 'a5', 'submit:1', 'u2');
  workOpenDetail('a5'); await sleep(500);
  ok('ไฟล์ที่ถูกแนบหลังโหลดหน้า: เปิดรายละเอียดแล้วโหลดไฟล์แนบใหม่ ขึ้นให้เห็นเอง (ไม่ต้องรีเฟรชหน้า)', !!detRow('โปรโมชัน ตุลาคม.pdf'));
  closeAll(); await sleep(100);
  doLogout(); await sleep(400);

  // ── 3. ส่งงาน (Zen) ───────────────────────────────────────────────────
  WORK.seed(); seedLib(); attSeq = 0;
  await login('zen'); showSection('tasks'); await sleep(300);
  const mineCard = id => document.querySelector('#workMineList .wk-task[data-id="' + id + '"]');
  mineCard('a4').click(); await sleep(200);
  ok('ฟอร์มส่งงาน (a4 โพสต์ขั้นเดียว): มีช่อง "ไฟล์จากคลังไฟล์" · คำเตือนแดงตัวหนา "ไฟล์จากคลังไม่นับเป็นหลักฐานแทนลิงก์หรือรูป"', !$('workSubLibField').hidden && isRed($('workSubLibField').querySelector('.wk-red')) && /ไม่นับเป็นหลักฐานแทนลิงก์หรือรูป/.test(txt('workSubLibField')));
  await openPicker('workSubLibPick');
  const nAttS = rpcs('transfer_attach').length;
  pickClick('L2'); pickClick('L6'); pickClick('L7'); $('workPickGo').click(); await sleep(150);
  ok('เลือกไฟล์ในฟอร์มส่งงาน: เก็บไว้ 3 ไฟล์ · ยังไม่แนบ · ไฟล์ L6 (เหลือ 2 วัน) บอก "ใกล้หมดอายุ" · ชื่อไฟล์ที่เป็นแท็ก HTML แสดงเป็นข้อความ', stagedNames('workSubFiles').join('|') === 'ภาพสินค้า FLX4.png|ใกล้หมด.png|' + XSS && !document.querySelector('#workSubFiles img') && window.__xss === undefined && rpcs('transfer_attach').length === nAttS && /ใกล้หมดอายุ/.test(txt('workSubFiles')));
  ok('มีแต่ไฟล์จากคลัง ไม่มีลิงก์โพสต์: ยังส่งไม่ได้ — ไฟล์จากคลังไม่ถูกนับเป็นหลักฐาน', $('workSubGo').disabled && /ลิงก์ Facebook/.test(txt('workSubNeed')));
  setVal('workSubC-facebook', 'https://www.facebook.com/PioneerDjLabSiam/posts/55');
  ok('ใส่ลิงก์ครบแล้ว: ปุ่มส่งเปิด', !$('workSubGo').disabled);
  $('workSubFiles').querySelector('[data-act="stg-rm"][data-i="2"]').click(); $('workSubFiles').querySelector('[data-act="stg-rm"][data-i="1"]').click();
  ok('เอาออกจากรายการที่เลือกไว้ (L7 แล้ว L6): เหลือ L2', stagedNames('workSubFiles').join('|') === 'ภาพสินค้า FLX4.png');
  const i0 = CALLS.length;
  $('workSubGo').click(); await sleep(800);
  const sub1 = CALLS.findIndex((c, i) => i >= i0 && c.op === 'rpc' && c.fn === 'work_submit'), att1 = CALLS.findIndex((c, i) => i >= i0 && c.op === 'rpc' && c.fn === 'transfer_attach');
  ok('ส่งงานสำเร็จแล้วค่อยแนบ: work_submit ก่อน → transfer_attach ctx "submit:1" (ส่งครั้งแรก) ของใบ a4 ไฟล์ L2 · ฐานมีไฟล์แนบ · ผู้แนบ = Zen',
    sub1 >= 0 && att1 > sub1 && lastRpc('transfer_attach').args.p_target === 'a4' && lastRpc('transfer_attach').args.p_ctx === 'submit:1' && lastRpc('transfer_attach').args.p_files.join() === 'L2' && WORK.att.some(a => a.target_id === 'a4' && a.ctx === 'submit:1' && a.file_id === 'L2' && a.attached_by === 'u2') && taskOnServer('a4').status === 'submitted', JSON.stringify(lastRpc('transfer_attach').args));
  ok('ก่อน 059: work_submit ไม่ได้รับ p_transfer_files (ฐานเดิมไม่มีพารามิเตอร์นี้) — ไฟล์คลังแนบหลังส่ง', !('p_transfer_files' in lastRpc('work_submit').args), JSON.stringify(lastRpc('work_submit').args));
  ok('ส่งแล้ว: หน้าต่างปิด · ข้อความบอกว่าแนบไฟล์จากคลัง 1 ไฟล์ · ไม่มีแถบแดง', !dlgOpen('workSubDialog') && /ส่งงานแล้ว — แนบไฟล์จากคลัง 1 ไฟล์/.test(toast()) && fatalText() === '', toast());
  // ส่งครั้งที่ 2 (a2: ถูกส่งกลับแก้ ส่งมาแล้ว 1 ครั้ง)
  mineCard('a2').click(); await sleep(200);
  await openPicker('workSubLibPick'); pickClick('L3'); $('workPickGo').click(); await sleep(150);
  setVal('workSubLink', 'https://drive.google.com/file/d/RETRY/view');
  $('workSubGo').click(); await sleep(800);
  ok('ส่งครั้งที่ 2 (a2 ถูกส่งกลับแก้): ctx ของไฟล์แนบ = "submit:2" ไม่ปนกับรอบแรก', lastRpc('transfer_attach').args.p_target === 'a2' && lastRpc('transfer_attach').args.p_ctx === 'submit:2' && lastRpc('transfer_attach').args.p_files.join() === 'L3', JSON.stringify(lastRpc('transfer_attach').args));
  // ส่งล้ม: ไม่แนบ · ไฟล์ที่เลือกไว้ยังอยู่ให้กดซ้ำ
  mineCard('a1').click(); await sleep(200);
  await openPicker('workSubLibPick'); pickClick('L2'); $('workPickGo').click(); await sleep(150);
  ok('ขั้นไฟล์ (a1) มีแต่ไฟล์จากคลัง ไม่มีลิงก์/รูป: ยังส่งไม่ได้ (ฐานเดิมไม่นับไฟล์คลังเป็นหลักฐาน) · บอกว่าขาดลิงก์ไฟล์หรือรูป', $('workSubGo').disabled && /ลิงก์ไฟล์หรือรูป/.test(txt('workSubNeed')), txt('workSubNeed'));
  setVal('workSubLink', 'https://drive.google.com/file/d/FLX4/view');
  const nAtt0 = rpcs('transfer_attach').length;
  WORK.fail.rpc_work_submit = 'ฐานข้อมูลล่ม';
  $('workSubGo').click(); await sleep(500);
  ok('ส่งงานล้ม: ไม่เรียก transfer_attach เลย · หน้าต่างยังเปิด · ข้อความผิดพลาด · ไฟล์ที่เลือกไว้ยังอยู่ให้กดซ้ำ', rpcs('transfer_attach').length === nAtt0 && dlgOpen('workSubDialog') && /ส่งงานไม่สำเร็จ: ฐานข้อมูลล่ม/.test(txt('workSubErr')) && stagedNames('workSubFiles').join() === 'ภาพสินค้า FLX4.png');
  delete WORK.fail.rpc_work_submit;
  // ส่งสำเร็จแต่แนบล้ม — บอกตรง ๆ ว่าส่งไปแล้ว
  WORK.fail.rpc_transfer_attach = 'ฐานข้อมูลแนบไฟล์ล่ม';
  $('workSubGo').click(); await sleep(800);
  ok('ส่งสำเร็จแต่แนบล้ม: แถบแดงบอก "ส่งงานแล้ว (ครั้งที่ 1) แต่แนบไฟล์จากคลังไม่สำเร็จ" + เหตุผล + วิธีแนบซ้ำ · ใบเป็น "รอตรวจ" ที่ฐาน · หน้าต่างปิด (ไม่ให้ส่งซ้ำ)',
    /ส่งงานแล้ว \\(ครั้งที่ 1\\) แต่แนบไฟล์จากคลังไม่สำเร็จ: ฐานข้อมูลแนบไฟล์ล่ม/.test(fatalText()) && /ซ้ำได้/.test(fatalText()) && taskOnServer('a1').status === 'submitted' && !dlgOpen('workSubDialog'), fatalText());
  clearFatal(); delete WORK.fail.rpc_transfer_attach;
  workOpenDetail('a1'); await sleep(300);
  ok('หลังแนบล้ม: รายละเอียดใบมีปุ่ม "+ แนบจากคลังไฟล์" ของครั้งที่ส่ง 1 ให้แนบซ้ำ', !!detBtn('att-add', 'data-which="submit"') && detHeads().some(h => /ผู้รับ ส่งครั้งที่ 1/.test(h)));
  detBtn('att-add', 'data-which="submit"').click(); await sleep(250); pickClick('L2'); $('workPickGo').click(); await sleep(500);
  ok('แนบซ้ำ: ctx submit:1 ของใบ a1', lastRpc('transfer_attach').args.p_target === 'a1' && lastRpc('transfer_attach').args.p_ctx === 'submit:1' && WORK.att.some(a => a.target_id === 'a1' && a.ctx === 'submit:1' && a.file_id === 'L2'));
  closeAll(); await sleep(100);
  // ขั้นลิงก์โพสต์ (a3) ไม่มีช่องแนบจากคลัง · ฟอร์มส่งงานรอบถัดไปไม่มีไฟล์ค้าง
  mineCard('a3').click(); await sleep(200);
  ok('ขั้นลิงก์โพสต์ (a3 ผ่านขั้นไฟล์แล้ว): ซ่อนช่องแนบจากคลัง (ขั้นนี้ส่งแต่ลิงก์โพสต์)', $('workSubLibField').hidden === true);
  closeAll(); await sleep(100);
  doLogout(); await sleep(400);

  // ── 4. ยังไม่รัน 053 · โหลดล้ม · ไม่มี folder_path (051) ───────────────
  WORK.seed(); seedLib(); attSeq = 0; WORK.noAtt = true;
  A('L1', 'a5', 'brief', 'u4');
  await login('tibass'); showSection('tasks'); await sleep(300);
  ok('ยังไม่รัน 053: ไม่ขึ้นแถบแดง (ไม่ใช่ error) · ตั้งสถานะ attMissing', work.attMissing === true && fatalText() === '' && work.attErr === '');
  await openForm();
  ok('ฟอร์มสั่งงาน: ซ่อนช่อง "ไฟล์จากคลังไฟล์" ทั้งช่อง', $('workfFilesField').hidden === true);
  setVal('workfTitle', 'งานโดยไม่แนบไฟล์'); pickPerson('Pran');
  const nAttN = rpcs('transfer_attach').length;
  $('workfSave').click(); await sleep(500);
  ok('สั่งงานได้ตามปกติ: work_create สำเร็จ · ไม่เรียก transfer_attach · ไม่มีแถบแดง', WORK.tasks.some(t => t.title === 'งานโดยไม่แนบไฟล์') && rpcs('transfer_attach').length === nAttN && fatalText() === '');
  workOpenDetail('a5'); await sleep(300);
  ok('รายละเอียดงาน: ไม่มีส่วนไฟล์แนบ ไม่มีปุ่มแนบ', !detHeads().some(h => /ไฟล์แนบจากคลังไฟล์/.test(h)) && !detBtn('att-add'));
  closeAll(); await sleep(100);
  doLogout(); await sleep(400);
  WORK.seed(); seedLib(); attSeq = 0;
  await login('zen'); showSection('tasks'); await sleep(300);
  WORK.noAtt = true; await loadWork(); await sleep(200);
  mineCard('a4').click(); await sleep(200);
  ok('ฟอร์มส่งงาน (ยังไม่รัน 053): ซ่อนช่องแนบจากคลัง', $('workSubLibField').hidden === true);
  closeAll(); await sleep(100);
  WORK.noAtt = false; WORK.fail.att = 'ฐานข้อมูลล่ม'; await loadWork(); await sleep(200);
  ok('โหลดไฟล์แนบล้ม (ไม่ใช่ "ยังไม่รัน"): ไม่ล้มทั้งหมวด — งานยังโหลดอยู่ · เก็บข้อความผิดพลาดไว้โชว์ในรายละเอียด', work.tasks.length > 0 && work.attMissing === false && /โหลดไฟล์แนบไม่สำเร็จ/.test(work.attErr));
  workOpenDetail('a5'); await sleep(300);
  ok('รายละเอียดงาน: ขึ้นกล่องแดง "โหลดไฟล์แนบไม่สำเร็จ" (บอกตามจริง ไม่เงียบ)', /โหลดไฟล์แนบไม่สำเร็จ/.test(txt('workDlgBody')) && !!$('workDlgBody').querySelector('.alert-red'));
  closeAll(); await sleep(100);
  delete WORK.fail.att; await loadWork(); await sleep(200);
  doLogout(); await sleep(400);
  // ไม่มี folder_path (ยังไม่รัน 051): ตัวเลือกถอยไปคอลัมน์ของ 050
  WORK.seed(); seedLib(); WORK.noFolder = true;
  await login('tibass'); showSection('tasks'); await sleep(300);
  await openForm(); await openPicker('workfPick');
  ok('ยังไม่รัน 051 (ไม่มีคอลัมน์ folder_path): ตัวเลือกลองใหม่โดยไม่ขอคอลัมน์นั้น · ยังโหลดรายการได้ · ไม่ขึ้นโฟลเดอร์', pickIds().includes('L1') && !/End credit/.test(txt('workPickList')) && CALLS.filter(c => c.op === 'select' && c.table === 'transfer_files').length >= 2 && $('workPickErr').hidden);
  closeAll(); await sleep(100);
  WORK.noFolder = false; WORK.fail.lib = 'ฐานข้อมูลล่ม';
  await openForm(); await openPicker('workfPick');
  ok('โหลดรายการไฟล์ในคลังล้ม: กล่องแดงบอกตามจริง · ไม่มีรายการ · ปุ่มแนบปิด', !$('workPickErr').hidden && /โหลดรายการไฟล์ในคลังไม่สำเร็จ/.test(txt('workPickErr')) && pickIds().length === 0 && $('workPickGo').disabled);
  closeAll(); await sleep(100); delete WORK.fail.lib;

  // ── 5. ออกจากระบบ/สลับบัญชี: ที่เลือกไว้และรายการไฟล์ไม่ค้างข้ามบัญชี ──
  await openForm(); await openPicker('workfPick'); pickClick('L1'); $('workPickGo').click(); await sleep(150);
  await openPicker('workfPick');
  ok('(ตั้งต้น) มีไฟล์ที่เลือกไว้ในฟอร์ม + ตัวเลือกเปิดค้างอยู่', stagedNames('workfFiles').length === 1 && dlgOpen('workPickDlg') && pickIds().length > 0);
  doLogout(); await sleep(500);
  ok('ออกจากระบบ: ตัวเลือก/ฟอร์มปิด · รายการที่เลือกไว้ + รายการไฟล์ในตัวเลือกถูกล้าง (ทั้ง DOM และหน่วยความจำ) · ไฟล์แนบที่โหลดไว้หาย', !dlgOpen('workPickDlg') && !dlgOpen('workFormDialog') && $('workfFiles').innerHTML === '' && $('workPickList').innerHTML === '' && $('workSubFiles').innerHTML === '' && workPick === null && work.att.length === 0);
  await login('nui'); showSection('tasks'); await sleep(300);
  await openForm();
  ok('บัญชีถัดไปเปิดฟอร์มใหม่: ไม่เห็นไฟล์ที่คนก่อนเลือกไว้', stagedNames('workfFiles').length === 0 && workForm.files.length === 0);
  closeAll(); await sleep(100);

  // ── 6. หลังรัน 059: ไฟล์จากคลังนับเป็นหลักฐานส่งงาน + ไปพร้อมการส่ง (transaction เดียว) ──
  doLogout(); await sleep(400);
  WORK.seed(); seedLib(); attSeq = 0; WORK.has059 = true;
  A('L2', 'a5', 'submit:1', 'u2'); A('L1', 'a5', 'brief', 'u4');
  await login('zen'); showSection('tasks'); await sleep(300);
  ok('ล็อกอินแล้วอ่านตาราง transfer_folder_attachments ได้ → ถือว่ารัน 059 แล้ว (ตรวจจากการอ่านตาราง ไม่ใช่เดา) · ไม่มีแถบแดง', CALLS.some(c => c.op === 'select' && c.table === 'transfer_folder_attachments') && work.f059 === true && fatalText() === '');
  mineCard('a1').click(); await sleep(200);
  ok('หลัง 059: ข้อความในช่อง "ไฟล์จากคลังไฟล์" เปลี่ยนเป็น "นับเป็นหลักฐานส่งงานได้" — ข้อความแดง "ไม่นับเป็นหลักฐาน" ถูกถอด · คำแนะนำบอก "ลิงก์ รูป หรือไฟล์จากคลัง"',
    /นับเป็นหลักฐานส่งงานได้/.test(txt('workSubLibHint')) && !/ไฟล์จากคลังไม่นับเป็นหลักฐาน/.test(txt('workSubLibField')) && !$('workSubLibField').querySelector('.wk-red') && /ไฟล์จากคลังอย่างน้อย 1 อย่าง/.test(txt('workSubLinkHint')), txt('workSubLibHint'));
  ok('ยังไม่มีหลักฐาน: ปุ่มส่งปิด · บอกว่าขาด "ลิงก์ไฟล์ รูป หรือไฟล์จากคลัง"', $('workSubGo').disabled && /ลิงก์ไฟล์ รูป หรือไฟล์จากคลัง/.test(txt('workSubNeed')), txt('workSubNeed'));
  await openPicker('workSubLibPick'); pickClick('L2'); $('workPickGo').click(); await sleep(150);
  ok('เลือกไฟล์คลัง (ไม่ถาวร) อย่างเดียว: ปุ่มส่งเปิดทันที (นับเป็นหลักฐาน) · ไม่บอกว่าขาดอะไร', !$('workSubGo').disabled && txt('workSubNeed') === '', txt('workSubNeed'));
  ok('ไฟล์ไม่ถาวรที่เป็นหลักฐาน: เตือนแดงตัวหนา "ไฟล์นี้จะหมดอายุ … หลักฐานจะเปิดไม่ได้หลังวันนั้น ตั้งเป็นไฟล์ถาวรในคลังถ้าต้องเก็บ"', isRed($('workSubFiles').querySelector('.wk-red')) && /ไฟล์นี้จะหมดอายุ/.test(txt('workSubFiles')) && /หลักฐานจะเปิดไม่ได้หลังวันนั้น/.test(txt('workSubFiles')) && /ตั้งเป็นไฟล์ถาวรในคลังถ้าต้องเก็บ/.test(txt('workSubFiles')));
  $('workSubFiles').querySelector('[data-act="stg-rm"]').click();
  ok('เอาไฟล์ออก: ปุ่มส่งกลับมาปิด (คำนวณใหม่ทันที ไม่ค้างสถานะเดิม)', $('workSubGo').disabled && /ไฟล์จากคลัง/.test(txt('workSubNeed')));
  await openPicker('workSubLibPick'); pickClick('L3'); $('workPickGo').click(); await sleep(150);
  ok('เลือกไฟล์ถาวร: ปุ่มส่งเปิด · ไม่มีคำเตือนหมดอายุ (ถาวรไม่หมด) แต่ยังมีป้าย "ถาวร · Asset"', !$('workSubGo').disabled && $('workSubFiles').querySelectorAll('.wk-red').length === 0 && /ถาวร · Asset/.test(txt('workSubFiles')));
  const nAttP = rpcs('transfer_attach').length;
  $('workSubGo').click(); await sleep(800);
  const sp = lastRpc('work_submit');
  ok('ส่ง: work_submit ได้ p_transfer_files = [L3] · ไม่มีลิงก์/รูป · ไม่เรียก transfer_attach แยก (แนบใน transaction เดียวกับการส่ง)', !!sp && sp.args.p_task === 'a1' && JSON.stringify(sp.args.p_transfer_files) === '["L3"]' && sp.args.p_links.length === 0 && sp.args.p_image_paths.length === 0 && rpcs('transfer_attach').length === nAttP, JSON.stringify(sp && sp.args));
  ok('ส่งสำเร็จ: ใบเป็น "รอตรวจ" · ฐานมีไฟล์แนบ submit:1 โดย Zen · หน้าต่างปิด · ข้อความ "แนบไฟล์จากคลัง 1 ไฟล์" · ไม่มีแถบแดง', taskOnServer('a1').status === 'submitted' && WORK.att.some(a => a.target_id === 'a1' && a.ctx === 'submit:1' && a.file_id === 'L3' && a.attached_by === 'u2') && !dlgOpen('workSubDialog') && /แนบไฟล์จากคลัง 1 ไฟล์/.test(toast()) && fatalText() === '', toast());
  // ขั้นสุดท้ายที่มีช่องทาง: ไฟล์คลังไม่แทนลิงก์โพสต์
  mineCard('a4').click(); await sleep(200);
  await openPicker('workSubLibPick'); pickClick('L3'); $('workPickGo').click(); await sleep(150);
  ok('งานโพสต์ขั้นเดียวที่มีช่อง Facebook: ไฟล์คลังอย่างเดียวยังส่งไม่ได้ — ต้องลิงก์โพสต์ Facebook (กฎเดิมไม่เปลี่ยน)', $('workSubGo').disabled && /ลิงก์ Facebook/.test(txt('workSubNeed')), txt('workSubNeed'));
  setVal('workSubC-facebook', 'https://www.facebook.com/PioneerDjLabSiam/posts/9');
  ok('ใส่ลิงก์ครบ + ไฟล์คลัง: ส่งได้', !$('workSubGo').disabled);
  closeAll(); await sleep(100);
  // งานชนิดอื่น ๆ: ไฟล์คลังอย่างเดียว (ไม่มีข้อความ)
  WORK.tasks.push({ id: 'oth1', title: 'งานทั่วไปของ Zen', detail: '', kind: 'other', channels: [], ref_links: [], assignee_id: 'u2', created_by: 'u4', due_at: null, status: 'open', phase: 'final', batch_id: null, submitted_at: null, closed_at: null, created_at: iso(NOW - 5 * H), updated_at: iso(NOW - H) });
  await loadWork(); await sleep(200);
  mineCard('oth1').click(); await sleep(200);
  const othBefore = $('workSubGo').disabled;
  await openPicker('workSubLibPick'); pickClick('L3'); $('workPickGo').click(); await sleep(150);
  ok('งานชนิด "อื่น ๆ" ยังไม่มีอะไร: ปุ่มส่งปิด · เลือกไฟล์คลังอย่างเดียว (ไม่มีข้อความ) → เปิด', othBefore && !$('workSubGo').disabled);
  closeAll(); await sleep(100);
  // ส่งไม่สำเร็จที่ฐาน (ไฟล์หมดอายุระหว่างเลือก): atomic — ไม่ส่ง ไม่แนบ ไฟล์ที่เลือกค้างให้แก้
  mineCard('a2').click(); await sleep(200);
  await openPicker('workSubLibPick'); pickClick('L2'); $('workPickGo').click(); await sleep(150);
  WORK.lib.find(f => f.id === 'L2').expires_at = iso(NOW - H);
  const nAttQ = WORK.att.length;
  $('workSubGo').click(); await sleep(700);
  ok('ไฟล์หมดอายุระหว่างเลือกกับกดส่ง: ฐานปฏิเสธทั้งก้อน — หน้าต่างยังเปิด · บอกเหตุผลของฐาน · ใบยัง "ส่งกลับแก้" · ไม่มีไฟล์แนบเพิ่ม · ไฟล์ที่เลือกยังอยู่', dlgOpen('workSubDialog') && /ส่งงานไม่สำเร็จ: มีไฟล์จากคลังที่ไม่พบ ถูกลบ หรือหมดอายุแล้ว/.test(txt('workSubErr')) && taskOnServer('a2').status === 'changes' && WORK.att.length === nAttQ && stagedNames('workSubFiles').length === 1, txt('workSubErr'));
  closeAll(); await sleep(100);
  // รายละเอียดงาน: ไฟล์ที่ผู้รับแนบ (submit:N) เตือนหมดอายุแบบหลักฐาน
  WORK.lib.find(f => f.id === 'L2').expires_at = iso(NOW + 5 * D);
  await loadWork(); await sleep(200);
  workOpenDetail('a5'); await sleep(300);
  ok('รายละเอียดงาน: ไฟล์ที่ผู้รับแนบตอนส่ง (ไม่ถาวร) เตือนแดงตัวหนา "หลักฐานจะเปิดไม่ได้หลังวันนั้น" (หลัง 059 นับเป็นหลักฐาน)', !!detRow('ภาพสินค้า FLX4.png') && /หลักฐานจะเปิดไม่ได้หลังวันนั้น/.test(detRow('ภาพสินค้า FLX4.png').textContent) && isRed(detRow('ภาพสินค้า FLX4.png').querySelector('.wk-red')));
  ok('ไฟล์ของผู้สั่ง (brief) ไม่ใช่หลักฐาน: ไม่ขึ้นคำเตือน "หลักฐานจะเปิดไม่ได้" (เตือนเฉพาะไฟล์ที่ผู้รับแนบตอนส่ง)', !!detRow('รีวิว HDJ-CUE1.mp4') && !/หลักฐานจะเปิดไม่ได้/.test(detRow('รีวิว HDJ-CUE1.mp4').textContent));
  closeAll(); await sleep(100);

  // ── 7. โฟลเดอร์ลิงก์สด (059) ──────────────────────────────────────────
  doLogout(); await sleep(400);
  WORK.seed(); seedLib(); attSeq = 0; WORK.has059 = true;
  WORK.lib.push(F('FE1', { category: 'video', file_name: 'ep1.mp4', folder_path: 'End credit/2026/ep1' }), F('FE2', { category: 'doc', file_name: 'ราก.pdf', folder_path: 'End credit' }),
    F('FP1', { category: 'doc', file_name: 'โปร.pdf', folder_path: 'Promo', is_permanent: true, expires_at: iso(NOW - D) }),
    F('FX1', { category: 'photo', file_name: XSS, folder_path: '<b>X</b>' }));
  WORK.markers.push({ id: 'mk1', path: 'Empty folder', created_by: 'u2', created_at: iso(NOW - D) });
  const folderBox = path => document.querySelector('#workPickList input[value="' + path + '"]');
  const folderTab = () => document.querySelector('#workPickMode button[data-mode="folder"]').click();
  const pickFolder = path => folderBox(path).click();
  const liveRed = () => isRed($('workPickLive').querySelector('.wk-red')) && /ลิงก์สด/.test(txt('workPickLive')) && /ผู้รับเห็นไฟล์ใหม่ด้วย/.test(txt('workPickLive'));
  await login('tibass'); showSection('tasks'); await sleep(300);
  await openForm();
  await openPicker('workfPick');
  ok('รัน 059 แล้ว: ตัวเลือกมีแท็บ "ไฟล์ | โฟลเดอร์ (ลิงก์สด)" · เริ่มที่แท็บไฟล์ · ยังไม่ขึ้นคำเตือนลิงก์สด', !$('workPickMode').hidden && document.querySelector('#workPickMode button[data-mode="file"]').getAttribute('aria-pressed') === 'true' && $('workPickLive').hidden);
  folderTab(); await sleep(100);
  ok('แท็บโฟลเดอร์: ขึ้นคำเตือนแดงตัวหนา "ลิงก์สด — ไฟล์ที่เพิ่ม/ลบในโฟลเดอร์นี้ภายหลังเปลี่ยนตามทันที ผู้รับเห็นไฟล์ใหม่ด้วย"', !$('workPickLive').hidden && liveRed(), txt('workPickLive'));
  const fp = [...document.querySelectorAll('#workPickList input')].map(i => i.value);
  ok('รายการโฟลเดอร์: รวมทุกชั้นบนของพาธไฟล์ + ตัวหมายโฟลเดอร์ว่าง (Empty folder) · ไม่มีไฟล์ที่หมดอายุ/ลบ (Old stuff ไม่มี)', ['End credit', 'End credit/2026', 'End credit/2026/ep1', 'Promo', 'Empty folder'].every(p => fp.includes(p)), fp.join('|'));
  const lblOf = path => flat(folderBox(path).closest('label').textContent);
  ok('จำนวนไฟล์นับรวมโฟลเดอร์ย่อย: End credit = 3 · End credit/2026 = 2 · ep1 = 1 · Empty folder = "โฟลเดอร์ว่าง"', /3 ไฟล์/.test(lblOf('End credit')) && /2 ไฟล์/.test(lblOf('End credit/2026')) && /1 ไฟล์/.test(lblOf('End credit/2026/ep1')) && /โฟลเดอร์ว่าง/.test(lblOf('Empty folder')), [lblOf('End credit'), lblOf('End credit/2026'), lblOf('Empty folder')].join(' | '));
  ok('ชื่อโฟลเดอร์ที่เป็นแท็ก HTML แสดงเป็นข้อความ (ไม่สร้างองค์ประกอบ)', fp.includes('<b>X</b>') && !document.querySelector('#workPickList b') && window.__xss === undefined);
  setVal('workPickQ', 'ep1');
  ok('ค้นหา "ep1" ในแท็บโฟลเดอร์: เหลือโฟลเดอร์ ep1', [...document.querySelectorAll('#workPickList input')].map(i => i.value).join() === 'End credit/2026/ep1');
  setVal('workPickQ', '');
  pickFolder('End credit/2026'); pickFolder('Empty folder');
  ok('เลือก 2 โฟลเดอร์: ข้อความ "เลือกแล้ว 0 ไฟล์ · 2 โฟลเดอร์" · ปุ่มแนบเปิด', /เลือกแล้ว 0 ไฟล์ · 2 โฟลเดอร์/.test(txt('workPickMsg')) && !$('workPickGo').disabled, txt('workPickMsg'));
  document.querySelector('#workPickMode button[data-mode="file"]').click(); await sleep(100);
  pickClick('L2');
  ok('สลับกลับแท็บไฟล์: ที่เลือกไว้ทั้งสองแท็บยังอยู่ (1 ไฟล์ · 2 โฟลเดอร์)', /เลือกแล้ว 1 ไฟล์ · 2 โฟลเดอร์/.test(txt('workPickMsg')) && $('workPickLive').hidden, txt('workPickMsg'));
  $('workPickGo').click(); await sleep(150);
  ok('ในฟอร์มสั่งงาน: รายการที่เลือกไว้มีทั้งไฟล์ (1) และโฟลเดอร์ (2) · โฟลเดอร์ขึ้น "ลิงก์สด" + คำเตือนแดงตัวหนาทุกโฟลเดอร์ · จำนวนไฟล์ ณ ตอนนี้',
    $('workfFiles').querySelectorAll('.wk-fold').length === 2 && $('workfFiles').querySelectorAll('.wk-red').length === 2 && [...$('workfFiles').querySelectorAll('.wk-fold .wk-red')].every(isRed) && /ลิงก์สด — ไฟล์ที่เพิ่ม\\/ลบในโฟลเดอร์นี้ภายหลังเปลี่ยนตามทันที/.test(txt('workfFiles')) && /2 ไฟล์ ณ ตอนนี้/.test(txt('workfFiles')) && /โฟลเดอร์ว่าง/.test(txt('workfFiles')), txt('workfFiles').slice(0, 200));
  ok('ยังไม่แนบจริง: ยังไม่เรียก transfer_attach / transfer_attach_folder (ใบงานยังไม่ถูกสร้าง)', rpcs('transfer_attach_folder').length === 0);
  await openPicker('workfPick'); folderTab(); await sleep(100);
  ok('เปิดตัวเลือกซ้ำ: โฟลเดอร์ที่เก็บไว้แล้วเป็น "แนบแล้ว" เลือกซ้ำไม่ได้ (ไม่สนตัวพิมพ์)', folderBox('End credit/2026').disabled && folderBox('Empty folder').disabled && /แนบแล้ว/.test(lblOf('End credit/2026')) && !folderBox('Promo').disabled);
  $('workPickCancel').click(); await sleep(100);
  // ลบโฟลเดอร์ที่เก็บไว้ (ตำแหน่ง 2 ของโฟลเดอร์ ตรวจว่าลบถูกตัว)
  $('workfFiles').querySelector('[data-act="stg-frm"][data-i="1"]').click();
  ok('เอาโฟลเดอร์ออกตามตำแหน่ง: ลบ "Empty folder" (ตำแหน่งที่ 2) เหลือ End credit/2026', $('workfFiles').querySelectorAll('.wk-fold').length === 1 && /End credit\\/2026/.test(txt('workfFiles')) && !/Empty folder/.test(txt('workfFiles')));
  await openPicker('workfPick'); folderTab(); await sleep(100); pickFolder('Empty folder'); pickFolder('Promo'); $('workPickGo').click(); await sleep(150);
  ok('เพิ่มกลับ: มี 3 โฟลเดอร์ (End credit/2026 · Empty folder · Promo)', $('workfFiles').querySelectorAll('.wk-fold').length === 3);
  setVal('workfTitle', 'งานแนบโฟลเดอร์'); pickPerson('Nui'); pickPerson('Pran');
  const nFA = rpcs('transfer_attach_folder').length;
  $('workfSave').click(); await sleep(900);
  const madeF = WORK.tasks.filter(t => t.title === 'งานแนบโฟลเดอร์');
  const fa = rpcs('transfer_attach_folder').slice(nFA);
  ok('สั่ง 2 ใบ × 3 โฟลเดอร์: transfer_attach_folder 6 ครั้ง (ใบละ 3 · ctx brief · kind task · พาธตรง) · ฐานมีลิงก์โฟลเดอร์ 6 แถว · ไฟล์เดี่ยว 1 ไฟล์ต่อใบด้วย',
    madeF.length === 2 && fa.length === 6 && fa.every(c => c.args.p_kind === 'task' && c.args.p_ctx === 'brief' && madeF.some(t => t.id === c.args.p_target)) && WORK.fatt.length === 6 && ['End credit/2026', 'Empty folder', 'Promo'].every(p => fa.some(c => c.args.p_path === p)) && WORK.att.filter(a => madeF.some(t => t.id === a.target_id)).length === 2, fa.map(c => c.args.p_path).join());
  ok('ข้อความ: "แนบไฟล์ 1 ไฟล์ · แนบโฟลเดอร์ 3 โฟลเดอร์" · ฟอร์มปิด · ไม่มีแถบแดง', /แนบไฟล์ 1 ไฟล์ · แนบโฟลเดอร์ 3 โฟลเดอร์/.test(toast()) && !dlgOpen('workFormDialog') && fatalText() === '', toast());
  // แนบล้มบางโฟลเดอร์ของบางใบ
  await openForm(); await openPicker('workfPick'); folderTab(); await sleep(100); pickFolder('Promo'); pickFolder('Empty folder'); $('workPickGo').click(); await sleep(150);
  setVal('workfTitle', 'งานโฟลเดอร์ล้ม'); pickPerson('Nui'); pickPerson('Pran');
  const origF = WORK.rpc.transfer_attach_folder; let nf2 = 0;
  WORK.rpc.transfer_attach_folder = (me, a) => (a.p_path === 'Empty folder' && ++nf2 === 2 ? { data: null, error: { message: 'โฟลเดอร์ "Empty folder" ไม่มีไฟล์ที่ใช้ได้อยู่เลย' } } : origF(me, a));
  $('workfSave').click(); await sleep(900);
  WORK.rpc.transfer_attach_folder = origF;
  const madeG = WORK.tasks.filter(t => t.title === 'งานโฟลเดอร์ล้ม');
  ok('โฟลเดอร์หนึ่งของใบหนึ่งแนบล้ม: สร้างครบ 2 ใบ · แถบแดงบอก "แนบไฟล์/โฟลเดอร์จากคลังไม่สำเร็จ 1 ใบ" + ชื่อโฟลเดอร์ + เหตุผล + แนบซ้ำได้ · ไม่ขึ้น "แนบโฟลเดอร์ 2 โฟลเดอร์"',
    madeG.length === 2 && /แต่แนบไฟล์\\/โฟลเดอร์จากคลังไม่สำเร็จ 1 ใบ/.test(fatalText()) && /โฟลเดอร์ "Empty folder"/.test(fatalText()) && /ซ้ำได้/.test(fatalText()) && !/แนบโฟลเดอร์ 2 โฟลเดอร์/.test(toast()), fatalText());
  clearFatal();

  // รายละเอียดงาน: ไฟล์สด
  tab('assign'); await frames();
  const tF = madeF[0].id;
  workOpenDetail(tF); await sleep(500);
  const fr = n => [...document.querySelectorAll('#workDlgBody .wk-fold')].find(x => x.querySelector('strong').textContent === n);
  ok('รายละเอียดงาน: ส่วน "ไฟล์แนบจากคลังไฟล์ · ผู้สั่ง" มีโฟลเดอร์ 3 อัน · แต่ละอันขึ้น "ลิงก์สด" + จำนวนไฟล์จริง ณ ตอนนี้', !!fr('End credit/2026') && !!fr('Empty folder') && !!fr('Promo') && /ลิงก์สด/.test(fr('Promo').textContent) && /2 ไฟล์ ณ ตอนนี้/.test(fr('End credit/2026').textContent) && /1 ไฟล์ ณ ตอนนี้/.test(fr('Promo').textContent), fr('End credit/2026') && flat(fr('End credit/2026').textContent));
  ok('โฟลเดอร์ที่ไม่มีไฟล์ (มีแต่ตัวหมาย): ขึ้น "โฟลเดอร์นี้ไม่มีไฟล์แล้ว" ไม่ใช่ error แดง', /โฟลเดอร์นี้ไม่มีไฟล์แล้ว/.test(fr('Empty folder').textContent) && !fr('Empty folder').querySelector('.alert-red'));
  ok('เรียกอ่านไฟล์สดด้วย transfer_folder_files ครั้งเดียวต่อรอบ (ส่งรหัสลิงก์ของใบนี้) · ไม่อ่านตาราง transfer_files เองเพื่อสร้างรายการ', lastRpc('transfer_folder_files').args.p_att.length === 3);
  const detOpen = fr('End credit/2026').querySelector('details');
  detOpen.open = true; detOpen.dispatchEvent(new Event('toggle')); await sleep(50);
  ok('ไฟล์ในโฟลเดอร์ (ขยายดู): ep1.mp4 + เปิด.mp4 + ปิด.mp4? (End credit/2026 รวมย่อย 2 ไฟล์: รีวิว HDJ-CUE1.mp4 + ep1.mp4) · มีปุ่มเปิดดู/ดาวน์โหลด', /รีวิว HDJ-CUE1\.mp4/.test(fr('End credit/2026').textContent) && /ep1\.mp4/.test(fr('End credit/2026').textContent) && !!fr('End credit/2026').querySelector('[data-act="att-dl"]'));
  const nOpen0 = WORK.opens.length;
  fr('End credit/2026').querySelector('[data-act="att-dl"]').click(); await sleep(400);
  ok('ดาวน์โหลดไฟล์ในโฟลเดอร์: ผ่าน transfer_open เสมอ (บันทึกประวัติ) · ลิงก์ 60 วินาที', WORK.opens.length === nOpen0 + 1 && WORK.opens[WORK.opens.length - 1].purpose === 'download' && WORK.tsigned[WORK.tsigned.length - 1].secs === 60, JSON.stringify(WORK.opens[WORK.opens.length - 1]));
  // สด: ไฟล์ใหม่ตามมาเอง · หมดอายุหายเอง
  WORK.lib.push(F('FE3', { category: 'video', file_name: 'ใหม่ทีหลัง.mp4', folder_path: 'End credit/2026/ep2' }));
  closeAll(); await sleep(80); workOpenDetail(tF); await sleep(500);
  ok('ไฟล์ที่อัปเข้าโฟลเดอร์ทีหลัง (End credit/2026/ep2) ตามมาเอง: จำนวนเพิ่มเป็น 3 ไฟล์ ณ ตอนนี้ (ลิงก์สด — ไม่ใช่ snapshot)', /3 ไฟล์ ณ ตอนนี้/.test(fr('End credit/2026').textContent) && /ใหม่ทีหลัง\.mp4/.test(fr('End credit/2026').textContent));
  ok('รายการที่ขยายไว้ยังขยายอยู่หลังวาดใหม่ (จำสถานะเปิด)', fr('End credit/2026').querySelector('details').open === true);
  WORK.lib.find(f => f.id === 'FE3').expires_at = iso(NOW - H);
  closeAll(); await sleep(80); workOpenDetail(tF); await sleep(500);
  ok('ไฟล์ที่หมดอายุ (ไม่ถาวร) หายเอง: กลับเป็น 2 ไฟล์', /2 ไฟล์ ณ ตอนนี้/.test(fr('End credit/2026').textContent) && !/ใหม่ทีหลัง/.test(fr('End credit/2026').textContent));
  WORK.lib.filter(f => (f.folder_path || '').indexOf('Promo') === 0).forEach(f => { f.status = 'deleted'; });
  closeAll(); await sleep(80); workOpenDetail(tF); await sleep(500);
  ok('โฟลเดอร์ที่ไฟล์ถูกลบหมด (Promo): ขึ้น "โฟลเดอร์นี้ไม่มีไฟล์แล้ว" ลิงก์ยังอยู่ (ไม่ error)', /โฟลเดอร์นี้ไม่มีไฟล์แล้ว/.test(fr('Promo').textContent) && !!fr('Promo').querySelector('[data-act="att-frm"]'));
  // ถอด
  fr('Promo').querySelector('[data-act="att-frm"]').click(); await sleep(150);
  ok('ถอดลิงก์โฟลเดอร์: ถามยืนยัน — ชื่อโฟลเดอร์ · แดงตัวหนา "โฟลเดอร์และไฟล์ในคลังไฟล์ไม่ถูกลบ" · ยังไม่เรียกฐาน', dlgOpen('confirmDialog') && /Promo/.test(txt('confirmBody')) && isRed($('confirmBody').querySelector('.wk-red')) && /ไม่ถูกลบ/.test(txt('confirmBody')) && rpcs('transfer_detach_folder').length === 0);
  const nLib = WORK.lib.length;
  $('confirmOkBtn').click(); await sleep(600);
  ok('ถอดสำเร็จ: transfer_detach_folder ได้ id ลิงก์ · แถวหาย · ไฟล์/โฟลเดอร์ในคลังไม่ถูกแตะ', rpcs('transfer_detach_folder').length === 1 && !fr('Promo') && WORK.lib.length === nLib && /ถอดลิงก์โฟลเดอร์แล้ว/.test(toast()));
  fr('End credit/2026').querySelector('[data-act="att-frm"]').click(); await sleep(150);
  WORK.fail.rpc_transfer_detach_folder = 'ฐานข้อมูลล่ม';
  $('confirmOkBtn').click(); await sleep(500);
  ok('ถอดลิงก์โฟลเดอร์แล้วฐานล้ม: แถบแดงบอกตามจริง · ลิงก์ยังอยู่', /ถอดลิงก์โฟลเดอร์ไม่สำเร็จ: ฐานข้อมูลล่ม/.test(fatalText()) && WORK.fatt.some(x => x.folder_path === 'End credit/2026' && x.target_id === tF));
  clearFatal(); delete WORK.fail.rpc_transfer_detach_folder;
  closeAll(); await sleep(80); workOpenDetail(tF); await sleep(500);
  // แนบเพิ่มจากรายละเอียด + เพดาน 5
  detBtn('att-add', 'data-which="brief"').click(); await sleep(300); folderTab(); await sleep(100);
  ok('แนบเพิ่มจากรายละเอียด: แท็บโฟลเดอร์ · โฟลเดอร์ที่แนบอยู่แล้ว (End credit/2026 · Empty folder) เป็น "แนบแล้ว" · ข้อความ "โฟลเดอร์ได้อีก 3"', folderBox('End credit/2026').disabled && folderBox('Empty folder').disabled && /โฟลเดอร์ได้อีก 3/.test(txt('workPickMsg')), txt('workPickMsg'));
  pickFolder('End credit'); $('workPickGo').click(); await sleep(600);
  ok('แนบโฟลเดอร์ "End credit" ทันที: transfer_attach_folder ctx brief ของใบนี้ · ปิดตัวเลือก · ข้อความ "แนบโฟลเดอร์แล้ว 1 โฟลเดอร์" · ขึ้นในรายละเอียด', lastRpc('transfer_attach_folder').args.p_target === tF && lastRpc('transfer_attach_folder').args.p_ctx === 'brief' && lastRpc('transfer_attach_folder').args.p_path === 'End credit' && !dlgOpen('workPickDlg') && /แนบโฟลเดอร์แล้ว 1 โฟลเดอร์/.test(toast()) && !!fr('End credit'));
  WORK.fatt.push({ id: 'fz1', folder_path: 'Promo', target_kind: 'task', target_id: tF, ctx: 'brief', attached_by: 'u1', attached_at: iso(NOW) }, { id: 'fz2', folder_path: 'Zeta', target_kind: 'task', target_id: tF, ctx: 'brief', attached_by: 'u1', attached_at: iso(NOW) });
  await loadWork(); await sleep(300);
  detBtn('att-add', 'data-which="brief"').click(); await sleep(300); folderTab(); await sleep(100);
  ok('ครบ 5 โฟลเดอร์ (End credit/2026 · Empty folder · End credit · Promo · Zeta): ข้อความ "โฟลเดอร์ได้อีก 0" · ทุกช่องที่ยังไม่แนบเลือกไม่ได้', /โฟลเดอร์ได้อีก 0/.test(txt('workPickMsg')) && folderBox('End credit/2026/ep1').disabled, txt('workPickMsg'));
  closeAll(); await sleep(100);
  // ฐานปฏิเสธโฟลเดอร์ (เช่นโฟลเดอร์ถูกลบก่อนกดแนบ) → ตัวเลือกยังเปิด บอกเหตุผล
  WORK.fatt = WORK.fatt.filter(a => a.id !== 'fz1' && a.id !== 'fz2');
  await loadWork(); await sleep(200);
  workOpenDetail(tF); await sleep(300);
  WORK.lib.filter(f => (f.folder_path || '').indexOf('Promo') === 0).forEach(f => { f.status = 'ready'; });          // กู้ไฟล์ Promo ให้โฟลเดอร์ขึ้นในตัวเลือก แล้วค่อยลบก่อนกดแนบ
  detBtn('att-add', 'data-which="brief"').click(); await sleep(300); folderTab(); await sleep(100);
  pickFolder('Promo');
  WORK.lib.filter(f => (f.folder_path || '').indexOf('Promo') === 0).forEach(f => { f.status = 'deleted'; });
  $('workPickGo').click(); await sleep(500);
  ok('โฟลเดอร์ไม่มีไฟล์ใช้ได้แล้วตอนกดแนบ (ฐานปฏิเสธ): ตัวเลือกยังเปิด · บอกเหตุผล "ไม่มีไฟล์ที่ใช้ได้อยู่เลย" · ไม่ขึ้นข้อความสำเร็จ', dlgOpen('workPickDlg') && /โฟลเดอร์ "Promo"/.test(txt('workPickErr')) && /ไม่มีไฟล์ที่ใช้ได้อยู่เลย/.test(txt('workPickErr')) && !WORK.fatt.some(x => x.folder_path === 'Promo' && x.target_id === tF), txt('workPickErr'));
  closeAll(); await sleep(100);
  // โฟลเดอร์ใหญ่เกิน 300 ไฟล์
  for (let i = 0; i < 305; i++) WORK.lib.push(F('BK' + i, { category: 'doc', file_name: 'bulk-' + String(i).padStart(3, '0') + '.pdf', folder_path: 'Bulk' }));
  WORK.fatt.push({ id: 'fb', folder_path: 'Bulk', target_kind: 'task', target_id: tF, ctx: 'brief', attached_by: 'u1', attached_at: iso(NOW) });
  await loadWork(); await sleep(300);
  closeAll(); await sleep(80); workOpenDetail(tF); await sleep(600);
  ok('โฟลเดอร์ใหญ่ 305 ไฟล์: ขึ้น "305 ไฟล์ ณ ตอนนี้" + แดงตัวหนา "แสดง 300 จาก 305 ไฟล์ — ดูทั้งหมดที่หน้า โอนไฟล์" (บอกตรง ๆ)', /305 ไฟล์ ณ ตอนนี้/.test(fr('Bulk').textContent) && /แสดง 300 จาก 305 ไฟล์/.test(fr('Bulk').textContent) && isRed(fr('Bulk').querySelector('.wk-red')), fr('Bulk') && flat(fr('Bulk').textContent).slice(0, 160));
  closeAll(); await sleep(100);
  doLogout(); await sleep(400);

  // ฟอร์มส่งงาน (Zen): แนบโฟลเดอร์ได้ — ไม่นับเป็นหลักฐาน · แนบหลังส่งสำเร็จ ctx submit:N
  WORK.seed(); seedLib(); attSeq = 0; WORK.has059 = true;
  WORK.lib.push(F('FE1', { category: 'video', file_name: 'ep1.mp4', folder_path: 'End credit/2026/ep1' }), F('FX1', { category: 'photo', file_name: 'x.png', folder_path: '<b>X</b>' }));
  await login('zen'); showSection('tasks'); await sleep(300);
  mineCard('a4').click(); await sleep(200);
  ok('ฟอร์มส่งงาน: ข้อความบอก "แนบโฟลเดอร์ (ลิงก์สด) ได้ที่แท็บ โฟลเดอร์ แต่ไม่นับเป็นหลักฐาน"', /แท็บ "โฟลเดอร์"/.test(txt('workSubLibHint')) && /ไม่นับเป็นหลักฐาน/.test(txt('workSubLibHint')), txt('workSubLibHint'));
  const nFS = rpcs('transfer_attach_folder').length;
  await openPicker('workSubLibPick'); folderTab(); await sleep(100); pickFolder('<b>X</b>'); pickFolder('End credit/2026'); $('workPickGo').click(); await sleep(150);
  ok('โฟลเดอร์ในฟอร์มส่งงาน: เก็บไว้ 2 · ขึ้นลิงก์สด + คำเตือนแดงตัวหนา · ชื่อที่เป็นแท็ก HTML แสดงเป็นข้อความ · ยังไม่เรียกฐาน', $('workSubFiles').querySelectorAll('.wk-fold').length === 2 && isRed($('workSubFiles').querySelector('.wk-fold .wk-red')) && !$('workSubFiles').querySelector('b') && rpcs('transfer_attach_folder').length === nFS);
  $('workSubFiles').querySelector('[data-act="stg-frm"][data-i="0"]').click();
  ok('เอาโฟลเดอร์ออกตามตำแหน่ง (ตัวแรก = <b>X</b>): เหลือ End credit/2026', $('workSubFiles').querySelectorAll('.wk-fold').length === 1 && txt('workSubFiles').indexOf('End credit/2026') >= 0 && txt('workSubFiles').indexOf('<b>X') < 0);
  ok('โฟลเดอร์ไม่นับเป็นหลักฐาน: งานโพสต์ Facebook มีแต่โฟลเดอร์ + ยังไม่ใส่ลิงก์ → ปุ่มส่งปิด', $('workSubGo').disabled && /ลิงก์ Facebook/.test(txt('workSubNeed')), txt('workSubNeed'));
  setVal('workSubC-facebook', 'https://www.facebook.com/PioneerDjLabSiam/posts/321');
  const nFB = rpcs('transfer_attach_folder').length;
  $('workSubGo').click(); await sleep(900);
  const fb = rpcs('transfer_attach_folder').slice(nFB);
  ok('ส่งงานแล้วแนบโฟลเดอร์: work_submit ก่อน → transfer_attach_folder ctx "submit:1" ใบ a4 พาธ "End credit/2026" · ฐานมีลิงก์ · ข้อความ "ส่งงานแล้ว — แนบโฟลเดอร์ 1 โฟลเดอร์"', fb.length === 1 && fb[0].args.p_ctx === 'submit:1' && fb[0].args.p_target === 'a4' && fb[0].args.p_path === 'End credit/2026' && WORK.fatt.some(a => a.target_id === 'a4' && a.ctx === 'submit:1') && /แนบโฟลเดอร์ 1 โฟลเดอร์/.test(toast()) && taskOnServer('a4').status === 'submitted', toast());
  // ผู้รับถอดลิงก์ของผู้สั่งไม่ได้
  WORK.fatt.push({ id: 'fq', folder_path: 'End credit', target_kind: 'task', target_id: 'a5', ctx: 'brief', attached_by: 'u4', attached_at: iso(NOW) });
  await loadWork(); await sleep(300);
  closeAll(); await sleep(80); workOpenDetail('a5'); await sleep(500);
  ok('ผู้รับ (Zen) เห็นโฟลเดอร์ของผู้สั่ง แต่ไม่มีปุ่มถอด/แนบของผู้สั่ง (ตามสิทธิ์ฐาน)', !!document.querySelector('#workDlgBody .wk-fold') && !document.querySelector('#workDlgBody [data-act="att-frm"]') && !detBtn('att-add', 'data-which="brief"'));
  closeAll(); await sleep(100);
  doLogout(); await sleep(400);

  // ก่อนรัน 059 / ยังไม่รัน 052 / ออกจากระบบ
  WORK.seed(); seedLib(); attSeq = 0; WORK.has059 = false;
  await login('tibass'); showSection('tasks'); await sleep(300);
  await openForm(); await openPicker('workfPick');
  ok('ยังไม่รัน 059: ตัวเลือกไม่มีแท็บโฟลเดอร์ · คำแนะนำเรื่องโฟลเดอร์ในฟอร์มว่าง', $('workPickMode').hidden === true && $('workfFoldHint').textContent === '');
  closeAll(); await sleep(100); doLogout(); await sleep(400);
  WORK.seed(); seedLib(); attSeq = 0; WORK.has059 = true; WORK.noMark = true;
  await login('tibass'); showSection('tasks'); await sleep(300);
  await openForm(); await openPicker('workfPick'); folderTab(); await sleep(150);
  ok('ยังไม่รัน 052 (ไม่มีตารางตัวหมาย): แท็บโฟลเดอร์ใช้ได้ตามปกติจากพาธไฟล์ · ไม่ขึ้นข้อความผิดพลาด', $('workPickErr').hidden && !!folderBox('End credit/2026') && !folderBox('Empty folder'));
  pickFolder('End credit/2026'); $('workPickGo').click(); await sleep(150);
  ok('(ตั้งต้น) มีโฟลเดอร์ที่เลือกไว้ในฟอร์ม', $('workfFiles').querySelectorAll('.wk-fold').length === 1);
  doLogout(); await sleep(500);
  ok('ออกจากระบบ: รายการที่เลือกไว้ (รวมโฟลเดอร์) ล้างหมด · ข้อมูลไฟล์สด/ลิงก์โฟลเดอร์ที่โหลดไว้หาย', $('workfFiles').innerHTML === '' && work.fatt.length === 0 && Object.keys(work.ff).length === 0);

  // ── 8. แนบเข้าคำขอ (request) และข้อความกระดาน (board) ───────────────────
  doLogout(); await sleep(400);
  WORK.seed(); seedLib(); attSeq = 0; WORK.has059 = true;
  WORK.lib.push(F('FE1', { category: 'video', file_name: 'ep1.mp4', folder_path: 'End credit/2026/ep1' }));
  const reqTab = () => tab('req');
  const detReq = () => $('workReqDetail');
  const reqRowBtn = (act, key) => detReq().querySelector('[data-act="' + act + '"]' + (key ? '[' + key + ']' : ''));
  const reqHeads = () => [...detReq().querySelectorAll('h4.wk-sec-h')].map(h => flat(h.textContent));
  await login('zen'); showSection('tasks'); await sleep(300); reqTab(); await frames();
  $('workReqNew').click(); await sleep(150);
  ok('ฟอร์มยื่นคำขอ: มีช่อง "ไฟล์จากคลังไฟล์" + ปุ่มแนบ · หลังรัน 059 มีคำแนะนำให้เลือกแท็บโฟลเดอร์', !$('workrFilesField').hidden && vis($('workrPick')) && /แท็บ "โฟลเดอร์"/.test(txt('workrFoldHint')) && stagedNames('workrFiles').length === 0);
  await openPicker('workrPick'); pickClick('L2'); folderTab(); await sleep(100); pickFolder('End credit/2026'); $('workPickGo').click(); await sleep(150);
  ok('เลือกไฟล์ 1 + โฟลเดอร์ 1 ในฟอร์มคำขอ: เก็บไว้ · โฟลเดอร์ขึ้น "ลิงก์สด" + คำเตือนแดงตัวหนา · ยังไม่เรียกฐาน', stagedNames('workrFiles').length === 2 && $('workrFiles').querySelectorAll('.wk-fold').length === 1 && isRed($('workrFiles').querySelector('.wk-fold .wk-red')) && rpcs('transfer_attach').filter(c => c.args.p_kind === 'request').length === 0, stagedNames('workrFiles').join('|'));
  await openPicker('workrPick');
  ok('ตัวเลือกในฟอร์มคำขอ: ไฟล์ที่เลือกไว้แล้ว (L2) เป็น "แนบแล้ว" เลือกซ้ำไม่ได้', pickBox('L2').disabled && !pickBox('L3').disabled);
  pickClick('L3'); $('workPickGo').click(); await sleep(150);
  $('workrFiles').querySelector('[data-act="stg-rm"][data-i="1"]').click();
  ok('เอาไฟล์ออกตามตำแหน่ง (ตำแหน่งที่ 2 = L3): เหลือ L2 + โฟลเดอร์', stagedNames('workrFiles').join('|') === 'ภาพสินค้า FLX4.png|End credit/2026', stagedNames('workrFiles').join('|'));
  document.querySelector('#workrGroups button[data-group="admin"]').click();
  setVal('workrBody', 'ขอตรวจไฟล์ประกอบก่อนอนุมัติ');
  const nReqA = rpcs('transfer_attach').length, nReqF = rpcs('transfer_attach_folder').length;
  $('workrGo').click(); await sleep(900);
  const newReq = WORK.reqs.find(r => r.body === 'ขอตรวจไฟล์ประกอบก่อนอนุมัติ');
  const ra = rpcs('transfer_attach').slice(nReqA), rf = rpcs('transfer_attach_folder').slice(nReqF);
  ok('ส่งคำขอ: work_request_create แล้ว transfer_attach (kind request · ctx ว่าง · ไฟล์ L2) + transfer_attach_folder (kind request · ctx ว่าง · พาธ End credit/2026) ที่ id ของคำขอใหม่',
    !!newReq && ra.length === 1 && ra[0].args.p_kind === 'request' && ra[0].args.p_ctx === '' && ra[0].args.p_target === newReq.id && ra[0].args.p_files.join() === 'L2' && rf.length === 1 && rf[0].args.p_kind === 'request' && rf[0].args.p_ctx === '' && rf[0].args.p_target === newReq.id && rf[0].args.p_path === 'End credit/2026', JSON.stringify(ra.concat(rf).map(c => c.args)));
  ok('คำขอสร้างสำเร็จ: ฟอร์มปิด · ข้อความ "แนบไฟล์ 1 ไฟล์ · โฟลเดอร์ 1 โฟลเดอร์" · ไม่มีแถบแดง · เลือกแสดงคำขอใหม่', !dlgOpen('workReqDialog') && /แนบไฟล์ 1 ไฟล์ · โฟลเดอร์ 1 โฟลเดอร์/.test(toast()) && fatalText() === '' && work.reqSel === newReq.id, toast());
  await sleep(300);
  ok('รายละเอียดคำขอ (ผู้ยื่น): ส่วน "ไฟล์แนบจากคลังไฟล์" มีไฟล์ ภาพสินค้า FLX4.png + โฟลเดอร์ End credit/2026 (ลิงก์สด) · ปุ่มแนบเพิ่ม/ถอด (คำขอยังรอตอบ)',
    reqHeads().includes('ไฟล์แนบจากคลังไฟล์') && /ภาพสินค้า FLX4\\.png/.test(detReq().textContent) && /End credit\\/2026/.test(detReq().textContent) && /ลิงก์สด/.test(detReq().textContent) && !!reqRowBtn('att-add', 'data-kind="request"') && !!reqRowBtn('att-rm') && !!reqRowBtn('att-frm'), flat(detReq().textContent).slice(0, 200));
  // แนบเพิ่มทันทีจากรายละเอียด
  reqRowBtn('att-add', 'data-kind="request"').click(); await sleep(300);
  ok('แนบเพิ่มจากรายละเอียดคำขอ: ตัวเลือกเปิด · ไฟล์ที่แนบแล้ว (L2) เป็น "แนบแล้ว"', dlgOpen('workPickDlg') && pickBox('L2').disabled);
  pickClick('L3'); $('workPickGo').click(); await sleep(600);
  ok('แนบ L3: transfer_attach kind request ctx ว่าง ที่คำขอนี้ · ปิดตัวเลือก · ขึ้นในรายละเอียด', lastRpc('transfer_attach').args.p_kind === 'request' && lastRpc('transfer_attach').args.p_target === newReq.id && lastRpc('transfer_attach').args.p_ctx === '' && !dlgOpen('workPickDlg') && /โปรโมชัน ตุลาคม\\.pdf/.test(detReq().textContent));
  // ถอดไฟล์
  const rmBtn = [...detReq().querySelectorAll('[data-act="att-rm"]')].pop();
  rmBtn.click(); await sleep(150); $('confirmOkBtn').click(); await sleep(600);
  ok('ถอดไฟล์ที่แนบเพิ่ม: transfer_detach · ตัวไฟล์ในคลังอยู่ครบ · ข้อความ "ถอดไฟล์แนบแล้ว"', rpcs('transfer_detach').length >= 1 && WORK.lib.some(f => f.id === 'L3') && /ถอดไฟล์แนบแล้ว/.test(toast()));
  // ผู้รับ (Nui · กลุ่มผู้ดูแล) เห็นไฟล์ เปิดได้ แต่ไม่มีปุ่มแนบ/ถอด
  doLogout(); await sleep(400);
  await login('nui'); showSection('tasks'); await sleep(300); reqTab(); await frames();
  document.querySelector('#workReqBoxes button[data-box="in"]').click(); await frames();
  document.querySelector('#workReqList [data-id="' + newReq.id + '"]').click(); await sleep(400);
  ok('ผู้รับคำขอ (ผู้ดูแล): เห็นไฟล์และโฟลเดอร์ที่แนบ · เปิดดู/ดาวน์โหลดได้ · ไม่มีปุ่มแนบเพิ่ม/ถอด (ไม่ใช่ผู้ยื่น)',
    /ภาพสินค้า FLX4\\.png/.test(detReq().textContent) && !!reqRowBtn('att-dl') && !reqRowBtn('att-add') && !reqRowBtn('att-rm') && !reqRowBtn('att-frm'));
  const nOpR = WORK.opens.length;
  reqRowBtn('att-dl', 'data-fid="L2"').click(); await sleep(400);
  ok('ผู้รับดาวน์โหลดไฟล์แนบของคำขอ: ผ่าน transfer_open (ลงประวัติ) · ลิงก์ 60 วินาที', WORK.opens.length === nOpR + 1 && WORK.opens[WORK.opens.length - 1].id === 'L2' && WORK.tsigned[WORK.tsigned.length - 1].secs === 60);
  // ไฟล์สดของโฟลเดอร์ในคำขอ
  WORK.lib.push(F('FE9', { category: 'doc', file_name: 'ใหม่ในโฟลเดอร์คำขอ.pdf', folder_path: 'End credit/2026' }));
  closeAll(); await sleep(80);
  document.querySelector('#workReqList [data-id="' + newReq.id + '"]').click(); await sleep(150);
  await workAttRefresh(); await sleep(500);
  ok('ไฟล์ที่อัปเข้าโฟลเดอร์ทีหลังตามมา: ผู้รับเห็นไฟล์เพิ่ม (ลิงก์สด) ในรายละเอียดคำขอ', /ใหม่ในโฟลเดอร์คำขอ\\.pdf/.test(detReq().textContent) || /3 ไฟล์ ณ ตอนนี้/.test(detReq().textContent), flat(detReq().textContent).slice(0, 300));
  // คำขอที่ตัดสินแล้ว (เจ้าของตัดสิน 14 ต.ค. 69): ผู้ยื่นแนบ/ถอดเพิ่มได้เหมือนตอนรอตอบ · คนอื่นที่ไม่ใช่ผู้ยื่นยังไม่ได้
  doLogout(); await sleep(400);
  newReq.status = 'approved'; newReq.decided_by = 'u4'; newReq.closed_at = new Date().toISOString();
  await login('zen'); showSection('tasks'); await sleep(300); reqTab(); await frames();
  document.querySelector('#workReqList [data-id="' + newReq.id + '"]').click(); await sleep(400);
  ok('คำขอที่อนุมัติแล้ว: ผู้ยื่นเห็นไฟล์ที่แนบ และยังมีปุ่มแนบเพิ่ม/ถอดไฟล์/ถอดโฟลเดอร์', /ภาพสินค้า FLX4\\.png/.test(detReq().textContent) && !!reqRowBtn('att-add', 'data-kind="request"') && !!reqRowBtn('att-rm') && !!reqRowBtn('att-frm'));
  workAttAdd(newReq.id, '', 'request'); await sleep(300);
  ok('แนบเพิ่มทั้งที่คำขอตัดสินแล้ว: ตัวเลือกไฟล์เปิด (ไม่ขึ้นข้อความห้าม)', dlgOpen('workPickDlg') && !/ไม่ได้แล้ว/.test(toast()));
  closeAll(); await sleep(100);
  // ยื่นคำขอ: แนบล้มบางส่วน
  $('workReqNew').click(); await sleep(150);
  await openPicker('workrPick'); pickClick('L1'); folderTab(); await sleep(100); pickFolder('End credit/2026'); $('workPickGo').click(); await sleep(150);
  document.querySelector('#workrGroups button[data-group="owner"]') ? document.querySelector('#workrGroups button[data-group="owner"]').click() : document.querySelector('#workrGroups button').click();
  setVal('workrBody', 'ขอเก็บถาวรไฟล์ — โฟลเดอร์ล้ม');
  const origRF = WORK.rpc.transfer_attach_folder;
  WORK.rpc.transfer_attach_folder = (me, a) => ({ data: null, error: { message: 'โฟลเดอร์ "End credit/2026" ไม่มีไฟล์ที่ใช้ได้อยู่เลย' } });
  $('workrGo').click(); await sleep(900);
  WORK.rpc.transfer_attach_folder = origRF;
  const req2 = WORK.reqs.find(r => r.body === 'ขอเก็บถาวรไฟล์ — โฟลเดอร์ล้ม');
  ok('โฟลเดอร์แนบล้ม (ไฟล์สำเร็จ): คำขอถูกสร้างแล้ว · ฟอร์มปิด (กันได้คำขอซ้ำ) · แถบแดงบอก "ส่งคำขอแล้ว แต่แนบไฟล์/โฟลเดอร์จากคลังไม่สำเร็จ" + เหตุผล + แนบซ้ำได้ · ไม่ขึ้น "แนบ…" ใน toast',
    !!req2 && !dlgOpen('workReqDialog') && /ส่งคำขอแล้ว แต่แนบไฟล์\\/โฟลเดอร์จากคลังไม่สำเร็จ/.test(fatalText()) && /ไม่มีไฟล์ที่ใช้ได้อยู่เลย/.test(fatalText()) && /ซ้ำได้/.test(fatalText()) && !/แนบไฟล์ 1/.test(toast()) && WORK.att.some(a => a.target_kind === 'request' && a.target_id === req2.id), fatalText());
  clearFatal();
  // ยังไม่รัน 053
  WORK.noAtt = true; await loadWork(); await sleep(200);
  $('workReqNew').click(); await sleep(150);
  ok('ยังไม่รัน 053: ฟอร์มคำขอซ่อนช่องไฟล์จากคลัง · ยื่นคำขอได้ตามปกติ', $('workrFilesField').hidden === true);
  closeAll(); await sleep(100); WORK.noAtt = false;
  doLogout(); await sleep(400);

  // ── กระดานข้อความ ──
  WORK.seed(); seedLib(); attSeq = 0; WORK.has059 = true;
  WORK.lib.push(F('FE1', { category: 'video', file_name: 'ep1.mp4', folder_path: 'End credit/2026/ep1' }));
  const bdetail = () => $('detailBody');
  const bBtn = (act, key) => bdetail().querySelector('[data-act="' + act + '"]' + (key ? '[' + key + ']' : ''));
  const fakeBoard = title => FAKE.board_messages.find(m => m.title === title);
  await login('nui'); await sleep(300);
  showSection('board'); await sleep(300);
  openBoardForm(null); await sleep(150);
  ok('ฟอร์มเขียนข้อความกระดาน: มีช่อง "ไฟล์จากคลังไฟล์" + ปุ่มแนบ · แท็บโฟลเดอร์ใช้ตัวเลือกเดียวกัน', !$('bfFilesField').hidden && vis($('bfPick')) && /แท็บ "โฟลเดอร์"/.test(txt('bfFilesHint')));
  await openPicker('bfPick'); pickClick('L1'); folderTab(); await sleep(100); pickFolder('End credit/2026'); $('workPickGo').click(); await sleep(150);
  ok('เลือกไฟล์ 1 + โฟลเดอร์ 1 ในฟอร์มกระดาน: เก็บไว้ · คำเตือนลิงก์สดแดงตัวหนา · ยังไม่แนบ', stagedNames('bfFiles').length === 2 && isRed($('bfFiles').querySelector('.wk-fold .wk-red')) && rpcs('transfer_attach').filter(c => c.args.p_kind === 'board').length === 0);
  setVal('bfTitle', 'แนบไฟล์ประกอบประชุม'); setVal('bfBody', 'ดูไฟล์แนบก่อนเข้าประชุม');
  const nBA = rpcs('transfer_attach').length, nBF = rpcs('transfer_attach_folder').length;
  await saveBoard(); await sleep(700);
  const bm = fakeBoard('แนบไฟล์ประกอบประชุม');
  const ba = rpcs('transfer_attach').slice(nBA), bf2 = rpcs('transfer_attach_folder').slice(nBF);
  ok('บันทึกข้อความ: insert board_messages แล้ว transfer_attach (kind board · ctx ว่าง · L1) + transfer_attach_folder (kind board · พาธ End credit/2026) ที่ id ข้อความใหม่',
    !!bm && ba.length === 1 && ba[0].args.p_kind === 'board' && ba[0].args.p_ctx === '' && ba[0].args.p_target === bm.id && ba[0].args.p_files.join() === 'L1' && bf2.length === 1 && bf2[0].args.p_kind === 'board' && bf2[0].args.p_target === bm.id && bf2[0].args.p_path === 'End credit/2026', JSON.stringify(ba.concat(bf2).map(c => c.args)));
  ok('บันทึกสำเร็จ: ฟอร์มปิด · ข้อความ "แนบไฟล์ 1 ไฟล์ · โฟลเดอร์ 1 โฟลเดอร์" · ไม่มีแถบแดง · ตารางกระดานขึ้น 📎 2', !dlgOpen('boardDialog') && /แนบไฟล์ 1 ไฟล์ · โฟลเดอร์ 1 โฟลเดอร์/.test(toast()) && fatalText() === '' && /📎 2/.test($('boardRows').textContent), $('boardRows').textContent.slice(0, 160));
  // เปิดอ่าน → ไฟล์แนบใต้ข้อความ
  await openBoardMsg(bm.id); await sleep(600);
  ok('รายละเอียดข้อความ: ส่วน "ไฟล์แนบจากคลังไฟล์" มีไฟล์ + โฟลเดอร์ลิงก์สด (ขึ้นจำนวนไฟล์จริง) · ผู้เขียนมีปุ่มแนบเพิ่ม/ถอด', /ไฟล์แนบจากคลังไฟล์/.test(bdetail().textContent) && /รีวิว HDJ-CUE1\\.mp4/.test(bdetail().textContent) && /ลิงก์สด/.test(bdetail().textContent) && /ไฟล์ ณ ตอนนี้/.test(bdetail().textContent) && !!bBtn('att-add', 'data-kind="board"') && !!bBtn('att-rm') && !!bBtn('att-frm'), flat(bdetail().textContent).slice(0, 260));
  // โหลดไฟล์แนบรวมครั้งเดียวทั้งกระดาน
  const nSel0 = CALLS.filter(c => c.op === 'select' && c.table === 'transfer_attachments').length;
  await refreshBoard(); await sleep(300);
  ok('รีเฟรชกระดาน (หลายข้อความ): โหลดไฟล์แนบรวมคำสั่งเดียว — ไม่ยิงต่อข้อความ', CALLS.filter(c => c.op === 'select' && c.table === 'transfer_attachments').length === nSel0 + 1 && FAKE.board_messages.length >= 2, String(CALLS.filter(c => c.op === 'select' && c.table === 'transfer_attachments').length - nSel0));
  // เปิดไฟล์
  const nOpB = WORK.opens.length;
  bBtn('att-dl', 'data-fid="L1"').click(); await sleep(400);
  ok('ดาวน์โหลดไฟล์ในข้อความ: ผ่าน transfer_open เสมอ', WORK.opens.length === nOpB + 1 && WORK.opens[WORK.opens.length - 1].id === 'L1');
  // แนบเพิ่มตอนแก้ข้อความ
  openBoardForm(bm.id); await sleep(150);
  ok('แก้ข้อความ: ฟอร์มบอก "แนบไว้แล้ว 2 รายการ" (ถอดที่รายละเอียดข้อความ) · เริ่มรายการที่เลือกไว้ว่าง', /แนบไว้แล้ว 2 รายการ/.test(txt('bfFilesHint')) && stagedNames('bfFiles').length === 0);
  await openPicker('bfPick');
  ok('ตัวเลือกตอนแก้: ไฟล์ที่แนบแล้ว (L1) เป็น "แนบแล้ว" เลือกซ้ำไม่ได้', pickBox('L1').disabled && !pickBox('L2').disabled);
  pickClick('L2'); $('workPickGo').click(); await sleep(150);
  await saveBoard(); await sleep(700);
  ok('บันทึกการแก้พร้อมแนบ L2: transfer_attach kind board ที่ข้อความเดิม (L2 อย่างเดียว) · ตารางขึ้น 📎 3', lastRpc('transfer_attach').args.p_target === bm.id && lastRpc('transfer_attach').args.p_files.join() === 'L2' && /📎 3/.test($('boardRows').textContent));
  // ถอด
  await openBoardMsg(bm.id); await sleep(500);
  const rmB = bdetail().querySelector('[data-act="att-rm"][data-aid]');
  rmB.click(); await sleep(150); $('confirmOkBtn').click(); await sleep(700);
  ok('ถอดไฟล์แนบของข้อความ: transfer_detach · กระดานโหลดใหม่ (📎 ลดลง) · ไฟล์ในคลังไม่ถูกลบ', rpcs('transfer_detach').length >= 1 && /📎 2/.test($('boardRows').textContent) && WORK.lib.some(f => f.id === 'L1' && f.status === 'ready'));
  // กดบันทึกซ้ำระหว่างแนบ: ปุ่มปิด — ข้อความถูกสร้างครั้งเดียว
  openBoardForm(null); await sleep(150);
  await openPicker('bfPick'); pickClick('L2'); $('workPickGo').click(); await sleep(150);
  setVal('bfTitle', 'กดบันทึกซ้ำ');
  let relBF = null; const nIns0 = CALLS.filter(c => c.op === 'insert' && c.table === 'board_messages').length;
  WORK.gate = new Promise(r => { relBF = r; });
  $('bfSaveBtn').click(); await sleep(150);
  const dis = $('bfSaveBtn').disabled;
  $('bfSaveBtn').click(); await sleep(80);
  WORK.gate = null; relBF(); await sleep(800);
  ok('กดบันทึกซ้ำระหว่างรอแนบ: ปุ่มถูกปิด · board_messages ถูก insert ครั้งเดียว (ไม่ได้ข้อความซ้ำ)', dis && CALLS.filter(c => c.op === 'insert' && c.table === 'board_messages').length === nIns0 + 1 && FAKE.board_messages.filter(m => m.title === 'กดบันทึกซ้ำ').length === 1);
  // แนบล้มบางส่วนตอนเขียนข้อความ
  openBoardForm(null); await sleep(150);
  await openPicker('bfPick'); pickClick('L3'); folderTab(); await sleep(100); pickFolder('End credit/2026'); $('workPickGo').click(); await sleep(150);
  setVal('bfTitle', 'ข้อความโฟลเดอร์ล้ม');
  const origBF = WORK.rpc.transfer_attach_folder;
  WORK.rpc.transfer_attach_folder = () => ({ data: null, error: { message: 'ฐานข้อมูลแนบโฟลเดอร์ล่ม' } });
  await saveBoard(); await sleep(700);
  WORK.rpc.transfer_attach_folder = origBF;
  const bm2 = fakeBoard('ข้อความโฟลเดอร์ล้ม');
  ok('โฟลเดอร์แนบล้ม: ข้อความถูกบันทึกแล้ว · ฟอร์มปิด (กันข้อความซ้ำ) · แถบแดง "บันทึกข้อความแล้ว แต่แนบไฟล์/โฟลเดอร์จากคลังไม่สำเร็จ" + เหตุผล + แนบซ้ำได้ · ไฟล์ที่แนบสำเร็จอยู่ครบ',
    !!bm2 && !dlgOpen('boardDialog') && /บันทึกข้อความแล้ว แต่แนบไฟล์\\/โฟลเดอร์จากคลังไม่สำเร็จ: .*ฐานข้อมูลแนบโฟลเดอร์ล่ม/.test(fatalText()) && /ซ้ำได้/.test(fatalText()) && WORK.att.some(a => a.target_kind === 'board' && a.target_id === bm2.id), fatalText());
  clearFatal();
  doLogout(); await sleep(400);

  // ผู้อ่านที่ไม่ใช่ผู้เขียน/ผู้ดูแล: เห็นไฟล์ เปิดได้ แต่ไม่มีปุ่มแนบ/ถอด
  await login('zen'); await sleep(300);
  showSection('board'); await sleep(300);
  await openBoardMsg(bm.id); await sleep(600);
  ok('พนักงานทั่วไป (ไม่ใช่ผู้เขียน): เห็นไฟล์แนบและเปิดได้ · ไม่มีปุ่มแนบเพิ่ม/ถอด', /รีวิว HDJ-CUE1|ภาพสินค้า FLX4/.test(bdetail().textContent) && !!bdetail().querySelector('[data-act="att-dl"]') && !bBtn('att-add') && !bBtn('att-rm') && !bBtn('att-frm'));
  const nPB = rpcs('transfer_attach').length;
  workAttAdd(bm.id, '', 'board'); await sleep(150);
  ok('เรียกแนบตรง ๆ โดยไม่ใช่ผู้เขียน/ผู้ดูแล: ขึ้นข้อความ · ไม่เรียกฐาน', /ไม่ได้แล้ว/.test(toast()) && rpcs('transfer_attach').length === nPB);
  // ข้อความถูกลบ → ไฟล์แนบที่ค้างไม่มีใครเห็น
  FAKE.board_messages = FAKE.board_messages.filter(m => m.id !== bm.id);
  await refreshBoard(); await sleep(300);
  ok('ข้อความถูกลบ: ลิงก์ไฟล์แนบที่ค้างอยู่ในฐานไม่ขึ้นที่ไหน (ตาราง/รายละเอียด) · ไม่ error', workAttFor('board', bm.id).length === 0 && fatalText() === '' && !/📎 3/.test($('boardRows').textContent));
  // ฟอร์มค้างตอนสลับบัญชี
  openBoardForm(null); await sleep(150);
  await openPicker('bfPick'); pickClick('L2'); $('workPickGo').click(); await sleep(150);
  doLogout(); await sleep(500);
  ok('ออกจากระบบตอนฟอร์มกระดานเปิดค้าง: ฟอร์ม/ตัวเลือกปิด · รายการที่เลือกไว้ถูกล้างหมด', !dlgOpen('boardDialog') && !dlgOpen('workPickDlg') && $('bfFiles').innerHTML === '' && boardForm.files.length === 0 && boardForm.folders.length === 0);

  // ยังไม่รัน 053 / ชื่อไฟล์เป็นแท็ก
  WORK.seed(); seedLib(); attSeq = 0; WORK.noAtt = true;
  await login('nui'); showSection('board'); await sleep(300);
  openBoardForm(null); await sleep(150);
  ok('ยังไม่รัน 053: ฟอร์มกระดานซ่อนช่องไฟล์จากคลัง · ตารางไม่ขึ้น 📎 · ไม่ขึ้นแถบแดง', $('bfFilesField').hidden === true && !/📎/.test($('boardRows').textContent) && fatalText() === '');
  closeAll(); await sleep(100);
  doLogout(); await sleep(400);
  WORK.seed(); seedLib(); attSeq = 0; WORK.has059 = true;
  await login('nui'); showSection('board'); await sleep(300);
  openBoardForm(null); await sleep(150);
  await openPicker('bfPick'); pickClick('L7'); $('workPickGo').click(); await sleep(150);
  ok('ชื่อไฟล์ที่เป็นแท็ก HTML ในฟอร์มกระดาน: แสดงเป็นข้อความ ไม่สร้างองค์ประกอบ', !$('bfFiles').querySelector('img') && /<img src=x/.test(txt('bfFiles')) && window.__xss === undefined);
  closeAll(); await sleep(100);

  done();
}
function detRowText(name) { const r = [...document.querySelectorAll('#workfFiles .wk-link')].find(x => x.querySelector('strong').textContent === name); return r ? r.textContent : ''; }
function done() {
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

const net = '--host-resolver-rules=MAP * ~NOTFOUND';
const res = await runCdpPage({ root: pageRoot, file: 'desk.html', mock: MOCK3 + WORK_MOCK, tests: TESTS, width: 1440, height: 900, coarse: false, shotDir: null, flags: [net] });
console.log('\n=== desk-work-attach: ' + (res.ok ? 'ผ่าน' : 'ไม่ผ่านหรือไม่ได้รันจนจบ') + ' ===');
process.exit(res.ok ? 0 : 1);
