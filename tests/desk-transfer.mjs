/**
 * เทสต์หมวด "โอนไฟล์" ของ desk.html (#transfer · Alt+U · migration 049 + 050) — ถังโอนถ่ายไฟล์ภายในร้าน + คลัง Asset
 *   รัน: node tests/desk-transfer.mjs      (TRANSFER_ROOT=<โฟลเดอร์ที่มี desk.html ฉบับอื่น> ใช้ทำ mutation)
 *
 * ฐานข้อมูล + Storage + tus ปลอม (tests/lib/transfer-mock.mjs) จำลองกติกาของ 049/050: ตารางอ่านอย่างเดียว · เขียนผ่านฟังก์ชัน transfer_* เท่านั้น ·
 * อัปโหลดได้เฉพาะพาธที่ transfer_begin ออกให้ · เปิด/โหลดต้องผ่าน transfer_open · ลบได้เฉพาะผู้อัปโหลดหรือเจ้าของ (ไฟล์ถาวร = เจ้าของ) · ครบ 30 วันถูกกวาด
 * (ตัวจริงของ SQL ตรวจกับ Postgres จริงแยกไว้ — ชุดนี้ตรวจฝั่งหน้าเว็บ: ลำดับการเรียก ผลบนจอ ข้อความบอกผู้ใช้ ความปลอดภัยของ DOM)
 *
 * ครอบคลุม: เมนู · กลุ่มไฟล์ · รอยืนยันก่อนอัปโหลด · Tag พนักงาน + "เปิดแล้ว/ยังไม่เปิด" · รูปตัวอย่าง (รูปจริงผ่าน canvas) · เพดาน 1 GB ·
 * tus (ไฟล์ > 6 MB: พารามิเตอร์ · ความคืบหน้า · ผิดพลาด · ยกเลิก · โหลดไม่ได้ = ธรรมดา) · เก็บถาวร (เจ้าของ/ผู้ดูแลขอ/พนักงานไม่ได้) ·
 * คำขอ + อนุมัติ/ปฏิเสธ/ถอน/void · ตัวเลขข้างเมนู · ยังไม่รัน 050 (v1) · ออกจากระบบ/สลับบัญชี
 */

import { dirname, join, } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HARNESS } from './lib/page-test.mjs';
import { runCdpPage } from './lib/cdp-page.mjs';
import { TRANSFER_MOCK } from './lib/transfer-mock.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { MOCK: MOCK3 } = await import(pathToFileURL(join(root, 'tests/desk-home3.mjs')).href);
const pageRoot = process.env.TRANSFER_ROOT || root;

const TESTS = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${HARNESS}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);
const MB = 1048576;
async function login(name) {
  $('loginEmail').value = name + '@x';
  $('loginPassword').value = 'x';
  await doLogin();
  await sleep(500);
}
async function relogin(name) { doLogout(); await sleep(450); await login(name); }
const rpcs = fn => CALLS.filter(c => c.op === 'rpc' && c.fn === fn);
const lastRpc = fn => rpcs(fn)[rpcs(fn).length - 1];
const rows = () => [...document.querySelectorAll('#trList .tr-row')];
const rowOf = id => document.querySelector('#trList .tr-row[data-id="' + id + '"]');
const btn = (id, act) => { const r = rowOf(id); return r ? r.querySelector('[data-act="' + act + '"]') : null; };
const ids = () => rows().map(r => r.dataset.id);
const groups = () => [...document.querySelectorAll('#trList .tr-group')].map(g => g.getAttribute('aria-label') + ':' + g.querySelectorAll('.tr-row').length).join(',');
const deletable = () => rows().filter(r => r.querySelector('[data-act="delete"]')).map(r => r.dataset.id).sort().join(',');
const fatal = () => document.getElementById('fatalError');
const clearFatal = () => { const f = fatal(); if (f) f.remove(); };
const txt = id => $(id).textContent;
const flat = s => String(s).replace(/\\s+/g, ' ').trim();
const logRows = () => [...document.querySelectorAll('#trLog .tr-ev')].map(e => flat(e.textContent));
const idle = async () => { for (let i = 0; i < 200 && tr.uploading; i++) await sleep(30); await sleep(150); };
const mkFile = (name, type, body) => new File([body === undefined ? 'data-' + name : body], name, { type: type });
const bigFile = (name, type, size) => { const f = mkFile(name, type); Object.defineProperty(f, 'size', { value: size }); return f; };      // ไฟล์ที่ "ดูเหมือน" ใหญ่ (ไม่กินหน่วยความจำ)
const POP = { opened: [], blocked: false };
window.open = function () {
  if (POP.blocked) return null;
  const w = { _href: '', opener: 'x', closed: false, location: { set href(v) { w._href = v; }, get href() { return w._href; } }, close() { w.closed = true; } };
  POP.opened.push(w);
  return w;
};
const DL = [];
document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="https://files.example"]'); if (a) { e.preventDefault(); DL.push(a.href); } }, true);
const altKey = code => document.dispatchEvent(new KeyboardEvent('keydown', { code: code, key: code.replace('Key', '').toLowerCase(), altKey: true, bubbles: true, cancelable: true }));
const drop = files => { const dt = new DataTransfer(); files.forEach(f => dt.items.add(f)); $('sec-transfer').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); };
const stage = async files => { drop(files); await sleep(250); };                         // วางไฟล์ → รอยืนยัน (ยังไม่อัปโหลด)
const go = async () => { $('trConfirm').click(); await idle(); };                        // กดยืนยันอัปโหลด
const up = async files => { await stage(files); await go(); };
const openPage = async () => { showSection('transfer'); await sleep(450); };
const reload = async () => { $('trReload').click(); await sleep(450); };
const tabBtn = n => document.querySelector('#trTabs .mail-tab[data-tab="' + n + '"]');
const badge = () => { const b = $('navBadge-transfer'); return b && !b.hidden ? b.textContent : ''; };
const dlgOpen = id => $(id).open;
const pickTags = names => { const boxes = [...$('trTagPick').querySelectorAll('input')]; boxes.forEach(b => { const on = names.indexOf(flat(b.parentElement.textContent)) >= 0; if (b.checked !== on) { b.checked = on; b.dispatchEvent(new Event('change', { bubbles: true })); } }); };
const makePng = (w, h, name) => new Promise(res => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(w / 4, h / 4, w / 2, h / 2); c.toBlob(b => res(new File([b], name, { type: 'image/png' })), 'image/png'); });
const fileRow = name => rows().find(r => r.querySelector('.tr-name').textContent === name);
const fid = name => (TRN.files.find(f => f.file_name === name) || {}).id;
const clearQ = () => { const b = document.querySelector('#trQueue [data-act="q-clear"]'); if (b) b.click(); };

async function runTests() {
  L('=== โอนไฟล์ (#transfer · migration 049 + 050) ===');
  TRN.seed();
  let gate;

  // ── 1. เมนู ──
  const sec = SECTIONS.find(s => s.id === 'transfer');
  ok('เมนูซ้าย: หมวด "โอนไฟล์" กลุ่มพนักงาน คีย์ Alt+U hash #transfer · ไม่จำกัดตำแหน่ง', !!sec && sec.group === 'พนักงาน' && sec.label === 'โอนไฟล์' && sec.key === 'U' && sec.hash === 'transfer' && !sec.manager && !sec.owner, JSON.stringify(sec));
  await login('zen');
  const nav = document.querySelector('.nav-item[data-s="transfer"]');
  ok('พนักงานทั่วไป (Zen) เห็นเมนู "โอนไฟล์" ในเมนูซ้าย และอยู่ก่อนกลุ่มสต็อก', !!nav && /โอนไฟล์/.test(nav.textContent) && !!(nav.compareDocumentPosition(document.querySelector('.nav-item[data-s="products"]')) & Node.DOCUMENT_POSITION_FOLLOWING));
  ok('ไอคอนเมนูเป็น SVG (ไม่ใช่อักขระ Unicode)', !!nav.querySelector('svg.ico-svg path'));
  altKey('KeyU'); await sleep(450);
  ok('Alt+U เปิดหมวดโอนไฟล์ · hash เป็น #transfer · ชื่อหน้า "โอนไฟล์"', current === 'transfer' && !$('sec-transfer').hidden && location.hash === '#transfer' && txt('pageTitle') === 'โอนไฟล์', current + ' ' + location.hash);
  ok('หน้าคีย์ลัด (?) มีบรรทัด Alt+U โอนไฟล์', /Alt[\\s\\S]*U[\\s\\S]*โอนไฟล์/.test($('helpDialog').textContent));
  ok('ไม่มีข้อผิดพลาดแดงบนจอตอนเปิดหน้า', !fatal(), fatal() && fatal().textContent);

  // ── 2. รายการ แยกกลุ่ม ──
  ok('ไฟล์แสดงแยกกลุ่มตามลำดับ วิดีโอ·เสียง·รูปภาพ·ดีไซน์·เอกสาร·ไฟล์บีบอัด·อื่น ๆ ไม่ปนกัน (ไฟล์ที่หมดอายุแล้วถูกซ่อน)', groups() === 'วิดีโอ:2,เสียง:1,รูปภาพ:2,งานดีไซน์:1,เอกสาร:1,ไฟล์บีบอัด:1,อื่น ๆ:1', groups());
  ok('ไฟล์ที่ครบ 30 วันแล้ว (fx) · ที่ลบแล้ว (fd) · ที่หมดอายุแล้ว (fe) ไม่อยู่ในรายการ', !rowOf('fx') && !rowOf('fd') && !rowOf('fe'));
  ok('ชิปกลุ่มมีจำนวนและคำกำกับ: ทั้งหมด 9 · วิดีโอ 2 · เอกสาร 1', [...document.querySelectorAll('#trChips .tr-chip')].map(c => flat(c.textContent)).join('|') === 'ทั้งหมด 9|วิดีโอ 2|เสียง 1|รูปภาพ 2|งานดีไซน์ 1|เอกสาร 1|ไฟล์บีบอัด 1|อื่น ๆ 1');
  ok('หัวกลุ่มมีคำอังกฤษกำกับ (VDO / AUDIO / PHOTO / DOC)', /VDO/.test(txt('trList')) && /AUDIO/.test(txt('trList')) && /PHOTO/.test(txt('trList')) && /DOC/.test(txt('trList')));
  ok('ป้ายเวลาที่เหลือเป็นคำ: 10 วัน = "เหลือ 10 วัน" · 2 วัน = "เหลือ 2 วัน · ใกล้หมดอายุ" (แดง)', /เหลือ 10 วัน/.test(rowOf('f1').textContent) && !/ใกล้หมดอายุ/.test(rowOf('f1').textContent) && /เหลือ 2 วัน · ใกล้หมดอายุ/.test(rowOf('f3').textContent) && rowOf('f3').querySelector('.st-bad'));
  ok('แถวแสดงขนาด ผู้อัปโหลด หมายเหตุ ตามจริง', /120\\.0 MB/.test(rowOf('f1').textContent) && /ลงโดย Zen/.test(rowOf('f1').textContent) && /หมายเหตุ: ตัดต่อรอบสุดท้าย/.test(rowOf('f1').textContent));
  ok('ปุ่ม "เปิดดู" มีเฉพาะไฟล์ที่เบราว์เซอร์เปิดได้ (วิดีโอ เสียง รูป PDF — ทั้งปุ่มและรูปตัวอย่างกดได้) — SVG · zip · psd · อื่น ๆ โหลดอย่างเดียว', ['f1', 'f2', 'f3', 'f5', 'f9'].every(i => rowOf(i).querySelectorAll('[data-act="view"]').length === 2) && ['f4', 'f6', 'f7', 'f8'].every(i => !btn(i, 'view') && btn(i, 'download')));
  ok('ทุกแถวมีปุ่ม "ดาวน์โหลด" และ "ประวัติ"', rows().every(r => r.querySelector('[data-act="download"]') && r.querySelector('[data-act="hist"]')));
  ok('ทุกแถวมีรูปตัวอย่าง/ไอคอนตามกลุ่ม (ไฟล์ที่ไม่มีรูปตัวอย่าง = ไอคอน SVG)', rows().every(r => r.querySelector('.tr-thumb svg, .tr-thumb img')));
  ok('ไฟล์ถาวร (memo.pdf) มีป้าย "ถาวร · Asset" และไม่มีป้ายนับถอยหลัง', /ถาวร · Asset/.test(rowOf('f5').textContent) && !/เหลือ/.test(rowOf('f5').textContent));
  ok('ไฟล์ที่มีคำขอเก็บถาวรค้าง (stems.zip) มีป้าย "รออนุมัติเก็บถาวร" และยังนับถอยหลัง', /รออนุมัติเก็บถาวร/.test(rowOf('f6').textContent) && /เหลือ 15 วัน/.test(rowOf('f6').textContent));
  ok('ไฟล์ที่ Tag แสดง "ถึง:" + ใคร + เปิดแล้ว/ยังไม่เปิด (เป็นคำ)', /ถึง:/.test(rowOf('f1').textContent) && /Nutty · ยังไม่เปิด/.test(rowOf('f1').textContent) && /TiBass · เปิดแล้ว/.test(rowOf('f1').textContent), flat(rowOf('f1').textContent));
  // ความปลอดภัยของ DOM: ชื่อไฟล์/หมายเหตุ/ชื่อคน มาจากผู้ใช้
  ok('ชื่อไฟล์ที่เป็น HTML แสดงเป็นข้อความ ไม่รันสคริปต์ ไม่สร้างแท็กจริง', window.XSS === undefined && rowOf('f9').querySelector('.tr-name').textContent === '<img src=x onerror=window.XSS=1>.mp4' && !rowOf('f9').querySelector('.tr-main img'));
  ok('หมายเหตุ/ชื่อผู้อัปโหลดที่เป็น HTML แสดงเป็นข้อความ', /<script>window\\.XSS=2<\\/script>/.test(rowOf('f9').textContent) && /Evil <i>Name<\\/i>/.test(rowOf('f9').textContent) && !rowOf('f9').querySelector('b, script, i'));

  // ── 3. กรอง ──
  document.querySelector('#trChips .tr-chip[data-cat="photo"]').click(); await sleep(50);
  ok('กดชิป "รูปภาพ" → เหลือ 2 ไฟล์ในกลุ่มเดียว · ชิปที่เลือกอยู่ aria-pressed', ids().sort().join() === 'f3,f4' && document.querySelector('#trChips .tr-chip[data-cat="photo"]').getAttribute('aria-pressed') === 'true' && document.querySelectorAll('#trList .tr-group').length === 1);
  document.querySelector('#trChips .tr-chip[data-cat=""]').click(); await sleep(50);
  $('trSearch').value = 'mix'; $('trSearch').dispatchEvent(new Event('input', { bubbles: true })); await sleep(50);
  ok('ค้นชื่อไฟล์ "mix" → เหลือ mix-oct.wav', ids().join() === 'f2');
  $('trSearch').value = 'nui'; $('trSearch').dispatchEvent(new Event('input', { bubbles: true })); await sleep(50);
  ok('ค้นชื่อผู้อัปโหลด "nui" → ไฟล์ของ Nui', ids().join() === 'f6');
  $('trSearch').value = ''; $('trSearch').dispatchEvent(new Event('input', { bubbles: true }));
  $('trMine').checked = true; $('trMine').dispatchEvent(new Event('change', { bubbles: true })); await sleep(50);
  ok('"เฉพาะไฟล์ของฉัน" (Zen) → f1 f3 f7', ids().sort().join() === 'f1,f3,f7');
  $('trMine').checked = false; $('trMine').dispatchEvent(new Event('change', { bubbles: true }));
  $('trPerm').checked = true; $('trPerm').dispatchEvent(new Event('change', { bubbles: true })); await sleep(50);
  ok('"เฉพาะไฟล์ถาวร (Asset)" → memo.pdf ไฟล์เดียว', ids().join() === 'f5');
  $('trPerm').checked = false; $('trPerm').dispatchEvent(new Event('change', { bubbles: true })); await sleep(50);
  ok('เอาตัวกรองออก → กลับมา 9 ไฟล์', rows().length === 9);

  // ── 4. สิทธิ์ลบ + ปุ่มถาวร/คำขอ ตามตำแหน่ง (ปุ่มเป็นสำเนาของกติกาฐาน) ──
  ok('พนักงาน (Zen) เห็นปุ่ม "ลบ" เฉพาะไฟล์ที่ตัวเองอัปโหลด · ไม่มีปุ่มถาวร/ขอ ใด ๆ', deletable() === 'f1,f3,f7' && !document.querySelector('#trList [data-act="pin"], #trList [data-act="unpin"], #trList [data-act="req-keep"], #trList [data-act="req-del"]'), deletable());
  await relogin('nui'); await openPage();
  ok('ผู้ดูแล (Nui) เห็นปุ่ม "ลบ" เฉพาะไฟล์ปกติของตัวเอง — ลบของคนอื่นและไฟล์ถาวรไม่ได้', deletable() === 'f6', deletable());
  ok('ผู้ดูแล: ไฟล์ถาวร (memo.pdf) มีปุ่ม "ขอลบ" · ไฟล์ของตัวเองที่มีคำขอค้างอยู่แล้วไม่มีปุ่ม "ขอเก็บถาวร" ซ้ำ · ไม่มีปุ่มตั้ง/ปลดถาวร', !!btn('f5', 'req-del') && !btn('f6', 'req-keep') && !document.querySelector('#trList [data-act="pin"], #trList [data-act="unpin"]'));
  await relogin('tibass'); await openPage();
  ok('เจ้าของร้าน (TiBass) เห็นปุ่ม "ลบ" ทุกไฟล์ (รวมไฟล์ถาวร) · ปุ่ม "ปลดถาวร" บนไฟล์ถาวร · "ตั้งเป็นไฟล์ถาวร" บนไฟล์ปกติ · ไม่มีปุ่มขอ', deletable() === ids().sort().join() && !!btn('f5', 'unpin') && !btn('f5', 'pin') && !!btn('f2', 'pin') && !btn('f2', 'unpin') && !document.querySelector('#trList [data-act="req-keep"], #trList [data-act="req-del"]'), deletable());

  // ── 5. เปิดดู / ดาวน์โหลด ──
  await relogin('zen'); await openPage();
  btn('f1', 'view').click(); await sleep(300);
  ok('เปิดดู: เรียก transfer_open (view) ก่อน แล้วค่อยขอลิงก์ 60 วินาที ไม่ใช่โหลด', lastRpc('transfer_open').args.p_purpose === 'view' && lastRpc('transfer_open').args.p_id === 'f1' && TRN.signed[TRN.signed.length - 1].secs === 60 && !TRN.signed[TRN.signed.length - 1].download);
  ok('เปิดดู: แท็บใหม่ไปที่ลิงก์ และตัดการเชื่อมกับหน้าคอนโซล (opener = null)', POP.opened.length === 1 && /^https:\\/\\/files\\.example\\/sign\\/video\\/f1\\.bin/.test(POP.opened[0]._href) && POP.opened[0].opener === null);
  ok('เปิดดูแล้ว ประวัติ "เปิดดู" ของ Zen ถูกบันทึกที่ฐาน', TRN.events.some(e => e.file_id === 'f1' && e.kind === 'view' && e.actor_id === 'u2'));
  btn('f3', 'download').click(); await sleep(300);
  ok('ดาวน์โหลด: transfer_open (download) → ลิงก์พร้อมชื่อไฟล์เดิม → ไม่เปิดแท็บ', lastRpc('transfer_open').args.p_purpose === 'download' && TRN.signed[TRN.signed.length - 1].download === 'poster.png' && DL.length === 1 && /download=poster\\.png/.test(DL[0]) && POP.opened.length === 1);
  ok('ดาวน์โหลดแล้ว ประวัติ "download" ของ Zen ถูกบันทึกที่ฐาน', TRN.events.some(e => e.file_id === 'f3' && e.kind === 'download' && e.actor_id === 'u2'));
  ok('ปุ่มไม่ค้างสถานะปิดหลังเปิดเสร็จ', !btn('f1', 'view').disabled && !btn('f3', 'download').disabled);
  btn('f5', 'view').click(); await sleep(300);
  ok('ไฟล์ถาวรเปิดดูได้ตามปกติ', lastRpc('transfer_open').args.p_id === 'f5' && POP.opened.length === 2);
  POP.blocked = true; btn('f2', 'view').click(); await sleep(300);
  ok('เบราว์เซอร์บล็อกป๊อปอัป → แจ้งให้อนุญาตแล้วกดใหม่ (ไม่เงียบ ไม่ error)', /บล็อก/.test(txt('toast')) && !fatal());
  POP.blocked = false;
  const f4row = TRN.files.find(f => f.id === 'f4'); f4row.expires_at = new Date(Date.now() - 1000).toISOString();
  const n0 = CALLS.filter(c => c.op === 'select' && c.table === 'transfer_files').length;
  btn('f4', 'download').click(); await sleep(450);
  ok('ไฟล์ที่ฐานปฏิเสธการเปิด → แถบแดงบอกเหตุเป็นไทย + ดึงรายการใหม่ (ไฟล์หายจากรายการ)', !!fatal() && /เปิดไม่ได้แล้ว/.test(fatal().textContent) && !rowOf('f4') && CALLS.filter(c => c.op === 'select' && c.table === 'transfer_files').length > n0);
  clearFatal();
  btn('f2', 'view').click(); TRN.fail.sign = true; await sleep(300);
  ok('ขอลิงก์ไม่สำเร็จ → แถบแดง และปิดแท็บเปล่าที่เปิดไว้', !!fatal() && POP.opened[POP.opened.length - 1].closed === true);
  TRN.fail.sign = false; clearFatal();

  // ── 6. ประวัติ (ความเคลื่อนไหว) ──
  tabBtn('log').click(); await sleep(100);
  ok('แท็บ "ความเคลื่อนไหว" แสดงประวัติ และซ่อนรายการไฟล์', !$('trLogPane').hidden && $('trFilesPane').hidden && tabBtn('log').getAttribute('aria-selected') === 'true');
  const L1 = logRows();
  ok('ประวัติบอก ใคร · ทำอะไร (เป็นคำ) · ไฟล์ไหน — Zen เปิดดู คลิปรีวิว FLX4.mp4', L1.some(r => /Zen/.test(r) && /เปิดดู/.test(r) && /คลิปรีวิว FLX4\\.mp4/.test(r)), L1.slice(0, 3).join(' / '));
  ok('ประวัติมีทั้ง อัปโหลด · เปิดดู · ดาวน์โหลด · ลบ · ขอเก็บถาวร ครบ', ['อัปโหลด', 'เปิดดู', 'ดาวน์โหลด', 'ลบ', 'ขอเก็บถาวร'].every(w => L1.some(r => r.indexOf(w) >= 0)));
  ok('ประวัติไฟล์ที่ลบแล้ว (deleted-by-zen.mp3) ยังอยู่ พร้อมชื่อไฟล์', L1.some(r => /Zen/.test(r) && /ลบ/.test(r) && /deleted-by-zen\\.mp3/.test(r)));
  const expRow = [...document.querySelectorAll('#trLog .tr-ev')].find(e => /expired-photo\\.jpg/.test(e.textContent));
  ok('ไฟล์ครบ 30 วันที่ระบบลบ = ช่องผู้ทำเป็น "ระบบ" (ไม่ใช่ "ไม่ทราบผู้ใช้") + ป้าย "ครบ 30 วัน"', !!expRow && expRow.querySelector('.tr-who').textContent === 'ระบบ' && /ครบ 30 วัน/.test(expRow.querySelector('.st').textContent), expRow && expRow.textContent);
  ok('ชื่อไฟล์/ชื่อคนที่เป็น HTML ในประวัติแสดงเป็นข้อความ (เห็นเป็นตัวอักษร ไม่กลายเป็นแท็ก)', window.XSS === undefined && !document.querySelector('#trLog img, #trLog script, #trLog b, #trLog i') && L1.some(r => r.indexOf('Evil <i>Name</i>') >= 0) && L1.some(r => r.indexOf('<img src=x onerror=window.XSS=1>.mp4') >= 0));
  $('trEvAct').value = 'view'; $('trEvAct').dispatchEvent(new Event('change', { bubbles: true })); await sleep(250);
  ok('กรอง "เปิดดู" → ถามฐานด้วย kind = view และเห็นเฉพาะแถวเปิดดู', CALLS.some(c => c.op === 'select' && c.table === 'transfer_events' && c.where.some(w => w[0] === 'kind' && w[1] === 'view')) && logRows().length > 0 && logRows().every(r => /เปิดดู/.test(r)));
  $('trEvAct').value = ''; $('trEvAct').dispatchEvent(new Event('change', { bubbles: true })); await sleep(250);
  $('trEvSearch').value = 'Nutty'; $('trEvSearch').dispatchEvent(new Event('input', { bubbles: true })); await sleep(80);
  ok('ค้นชื่อคนในประวัติ "Nutty" → เห็นเฉพาะแถวของ Nutty', logRows().length > 0 && logRows().every(r => /Nutty/.test(r)));
  $('trEvSearch').value = ''; $('trEvSearch').dispatchEvent(new Event('input', { bubbles: true }));
  tabBtn('files').click(); await sleep(50);
  btn('f1', 'hist').click(); await sleep(300);
  ok('ปุ่ม "ประวัติ" ของไฟล์ → ไปแท็บความเคลื่อนไหว ถามฐานด้วย file_id ของไฟล์นั้น เห็นเฉพาะไฟล์นั้น', !$('trLogPane').hidden && CALLS.some(c => c.op === 'select' && c.table === 'transfer_events' && c.where.some(w => w[0] === 'file_id' && w[1] === 'f1')) && logRows().length >= 3 && logRows().every(r => /คลิปรีวิว FLX4\\.mp4/.test(r)) && /คลิปรีวิว FLX4/.test(txt('trEvFile')));
  document.querySelector('#trEvFile [data-act="ev-all"]').click(); await sleep(300);
  ok('"ดูประวัติทั้งหมด" → เลิกกรองไฟล์ เห็นประวัติของไฟล์อื่นด้วย', logRows().some(r => /memo\\.pdf/.test(r)) && txt('trEvFile') === '');
  for (let i = 0; i < 440; i++) TRN.events.push({ id: 1000 + i, file_id: 'f2', kind: 'view', actor_id: 'u3', created_at: new Date(Date.now() - 86400000 * 3 - i * 1000).toISOString() });
  $('trReload').click(); await sleep(450);
  ok('ประวัติเกิน 200 รายการ → โหลดทีละ 200 มีปุ่ม "โหลดเพิ่ม"', logRows().length === 200 && !$('trLogMore').hidden, logRows().length);
  $('trLogMore').click(); await sleep(300);
  ok('โหลดเพิ่ม → ขอช่วง 200–399 ต่อท้าย ได้ 400 รายการ', logRows().length === 400 && CALLS.some(c => c.op === 'select' && c.table === 'transfer_events' && c.range[0] === 200 && c.range[1] === 399));
  $('trLogMore').click(); await sleep(300);
  ok('หน้าสุดท้าย (น้อยกว่า 200) → ปุ่ม "โหลดเพิ่ม" หายไป', logRows().length > 400 && $('trLogMore').hidden);
  TRN.events = TRN.events.filter(e => e.id < 1000);
  tabBtn('files').click();

  // ── 7. รอยืนยันก่อนอัปโหลด (วางไฟล์ > ยืนยัน > อัปโหลด) ──
  await reload();
  const sb = rpcs('transfer_begin').length, su = TRN.uploads.length;
  const sA = mkFile('stage-a.mp3', 'audio/mpeg'), sB = mkFile('stage-b.pdf', 'application/pdf'), sC = mkFile('stage-empty.txt', 'text/plain', '');
  ok('ก่อนวางไฟล์: ไม่มีกล่องรอยืนยัน', $('trStage').hidden);
  await stage([sA, sB, sC]);
  ok('วางไฟล์ → ขึ้นรายการ "รอยืนยัน" 3 ไฟล์ · ยังไม่เรียกฐาน · ยังไม่อัปโหลดอะไรเลย', !$('trStage').hidden && $('trStageList').querySelectorAll('.tr-row').length === 3 && rpcs('transfer_begin').length === sb && TRN.uploads.length === su && tr.queue.length === 0);
  ok('หัวรอยืนยันบอกจำนวนที่จะอัปโหลด (ไม่นับไฟล์ที่ไม่ผ่าน) และย้ำว่ายังไม่ได้อัปโหลด', /2 ไฟล์/.test(txt('trStageHead')) && /ยังไม่ได้อัปโหลด/.test(txt('trStageHead')), txt('trStageHead'));
  ok('ไฟล์ว่าง: ขึ้นเหตุผลสีแดงตัวหนา + "จะไม่ถูกอัปโหลด"', /ว่างเปล่า/.test(txt('trStageList')) && /จะไม่ถูกอัปโหลด/.test(txt('trStageList')) && !!document.querySelector('#trStageList .tr-bad'));
  ok('ปุ่ม "ยืนยันอัปโหลด 2 ไฟล์" กดได้ · มี "ยกเลิกทั้งหมด"', txt('trConfirm') === 'ยืนยันอัปโหลด 2 ไฟล์' && !$('trConfirm').disabled && !!$('trStageClear'));
  const be = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(be);
  ok('มีไฟล์รอยืนยันอยู่ ปิดแท็บ/รีเฟรช = เบราว์เซอร์เตือนก่อน (ไฟล์ที่เลือกไว้จะหาย)', be.defaultPrevented === true);
  document.querySelector('#trStageList [data-act="stage-rm"][data-sid="' + tr.stage[0].id + '"]').click(); await sleep(50);
  ok('กด "✕ เอาออก" ที่ไฟล์หนึ่ง → เหลือ 2 รายการ (ไฟล์ที่ผ่าน 1 ไฟล์) ยังไม่อัปโหลด', $('trStageList').querySelectorAll('.tr-row').length === 2 && txt('trConfirm') === 'ยืนยันอัปโหลด 1 ไฟล์' && TRN.uploads.length === su);
  $('trStageClear').click(); await sleep(50);
  ok('"ยกเลิกทั้งหมด" → กล่องรอยืนยันหาย · ไม่มีอะไรถูกอัปโหลดหรือเรียกฐาน · ปิดแท็บไม่เตือนแล้ว', $('trStage').hidden && tr.stage.length === 0 && rpcs('transfer_begin').length === sb && TRN.uploads.length === su && (() => { const e2 = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e2); return !e2.defaultPrevented; })());
  // วางใหม่ + ยืนยัน = อัปโหลดจริง (ไฟล์ที่ไม่ผ่านไปอยู่ในคิวเป็น "ไม่สำเร็จ" ให้เห็น)
  const f1 = mkFile('Live Set.mp4', 'video/mp4');
  Object.defineProperty($('trFile'), 'files', { value: [f1, mkFile('empty2.txt', 'text/plain', '')], configurable: true });
  $('trFile').dispatchEvent(new Event('change', { bubbles: true })); await sleep(250);
  ok('เลือกด้วยปุ่มเลือกไฟล์ก็เข้ารอยืนยันเหมือนกัน (ยังไม่อัปโหลด)', !$('trStage').hidden && rpcs('transfer_begin').length === sb && txt('trConfirm') === 'ยืนยันอัปโหลด 1 ไฟล์');
  $('trNote').value = 'คลิปรีวิว รอบสอง';
  await go();
  const call = rpcs('transfer_begin')[sb];
  ok('ยืนยันแล้ว: transfer_begin ส่งชื่อ ชนิด ขนาด และหมายเหตุ (1 ไฟล์ — ไฟล์ว่างไม่ถูกส่ง)', rpcs('transfer_begin').length === sb + 1 && !!call && call.args.p_file_name === 'Live Set.mp4' && call.args.p_mime === 'video/mp4' && call.args.p_size === f1.size && call.args.p_note === 'คลิปรีวิว รอบสอง' && !('p_tags' in call.args) && !('p_keep' in call.args), JSON.stringify(call && call.args));
  const upl = TRN.uploads[TRN.uploads.length - 1];
  ok('ไฟล์ขึ้นถังที่พาธที่ฐานออกให้ (video/…) · ชนิดตรงกลุ่ม · ไม่ใช้ upsert', !!upl && /^video\\/n\\d+\\.mp4$/.test(upl.path) && upl.type === 'video/mp4' && upl.upsert === false, JSON.stringify(upl));
  const issued = TRN.files.find(f => f.object_path === upl.path);
  ok('ลำดับ: begin → upload → commit ด้วยรหัสรายการที่ฐานออกให้ (commit สำเร็จได้ก็ต่อเมื่อไฟล์ขึ้นถังแล้ว)', !!issued && lastRpc('transfer_commit').args.p_id === issued.id && issued.status === 'ready' && TRN.objects.has(upl.path));
  ok('หลังอัปโหลด: ไฟล์ใหม่อยู่ในกลุ่มวิดีโอ มีหมายเหตุ และเริ่มนับ 30 วัน', rows().some(r => /Live Set\\.mp4/.test(r.textContent) && /หมายเหตุ: คลิปรีวิว รอบสอง/.test(r.textContent) && /เหลือ 30 วัน/.test(r.textContent)));
  ok('คิวแสดง "อัปโหลดแล้ว" + กลุ่มที่เก็บ · ไฟล์ว่างขึ้น "ไม่สำเร็จ" พร้อมเหตุ · กล่องรอยืนยันหาย · ช่องหมายเหตุถูกล้าง · มีประวัติ "อัปโหลด" โดย Zen',
    /อัปโหลดแล้ว/.test(txt('trQueue')) && /เก็บในกลุ่ม วิดีโอ/.test(txt('trQueue')) && /ไม่สำเร็จ/.test(txt('trQueue')) && /ว่างเปล่า/.test(txt('trQueue')) && $('trStage').hidden && $('trNote').value === '' && TRN.events.some(e => e.kind === 'upload' && e.actor_id === 'u2' && TRN.files.find(f => f.id === e.file_id).file_name === 'Live Set.mp4'));
  ok('ไม่มีข้อผิดพลาดแดง', !fatal());
  clearQ(); await sleep(50);
  // หลายไฟล์ + ลากวาง + ชนิดไม่ตรง
  const dropA = mkFile('mix.wav', 'audio/wav'), dropB = mkFile('evil.png', 'text/html', '<script>alert(1)<\\/script>'), dropC = mkFile('notes', 'application/octet-stream');
  await up([dropA, dropB, dropC]);
  const ups = TRN.uploads.slice(-3);
  ok('ลากวางหลายไฟล์ → ยืนยันครั้งเดียว → อัปทีละไฟล์ตามลำดับ ทั้ง 3 ไฟล์', ups.length === 3 && /^audio\\//.test(ups[0].path) && /^photo\\//.test(ups[1].path) && /^other\\//.test(ups[2].path), JSON.stringify(ups.map(u => u.path)));
  ok('ชนิดไฟล์ที่ส่งขึ้นถัง: ชื่อ .png ที่ประกาศเป็น text/html ถูกบังคับเป็น octet-stream (กันถูกเปิดเป็นเว็บ) · wav ได้ audio/wav', ups[0].type === 'audio/wav' && ups[1].type === 'application/octet-stream' && ups[2].type === 'application/octet-stream', JSON.stringify(ups.map(u => u.type)));
  ok('ชิปกลุ่มนับไฟล์ใหม่ (เสียง 2 · รูปภาพ 2 · อื่น ๆ 2)', /เสียง 2/.test(txt('trChips')) && /รูปภาพ 2/.test(txt('trChips')) && /อื่น ๆ 2/.test(txt('trChips')), txt('trChips'));
  ok('trSafeType: SVG / html / ชนิดไม่ตรงกลุ่ม = octet-stream · pdf และสื่อจริงคงชนิดเดิม', trSafeType('photo', 'a.svg', 'image/svg+xml') === 'application/octet-stream' && trSafeType('other', 'a.html', 'text/html') === 'application/octet-stream'
    && trSafeType('doc', 'a.pdf', 'application/pdf') === 'application/pdf' && trSafeType('video', 'a.mp4', 'video/mp4') === 'video/mp4' && trSafeType('audio', 'a.mp3', 'video/mp4') === 'application/octet-stream');
  clearQ(); await sleep(50);
  // เพดาน 1 GB
  await stage([bigFile('over.mov', 'video/quicktime', 1.2 * 1024 * MB), bigFile('old-limit.mov', 'video/quicktime', 600 * MB), bigFile('exact.mov', 'video/quicktime', 1024 * MB)]);
  ok('เพดาน 1 GB: ไฟล์ 1.2 GB ถูกปฏิเสธที่หน้า พร้อมเหตุ · 600 MB (เพดานเดิม) และ 1 GB พอดี ผ่านเข้ารอยืนยัน', /ใหญ่เกิน 1\\.00 GB/.test(txt('trStageList')) && /ไฟล์นี้ 1\\.20 GB/.test(txt('trStageList')) && tr.stage.filter(i => i.state === 'ok').length === 2 && txt('trConfirm') === 'ยืนยันอัปโหลด 2 ไฟล์', txt('trStageList'));
  ok('ข้อความบนกล่องวางไฟล์บอกเพดาน 1 GB (ไม่ใช่ 500 MB)', /1 GB/.test(txt('trDrop')) && !/500 MB/.test(txt('trDrop')));
  $('trStageClear').click(); await sleep(50);
  const rb = rpcs('transfer_begin').length;
  // ฐานปฏิเสธตอนขอพื้นที่ / อัปโหลดล้ม / commit ล้ม
  TRN.fail.rpc_transfer_begin = 'ไฟล์ใหญ่เกิน 20 MB (ไฟล์นี้ 30 MB)'; const ub = TRN.uploads.length;
  await up([mkFile('a.mp4', 'video/mp4')]);
  ok('ฐานปฏิเสธตอนขอพื้นที่ → ไม่อัปโหลด · แถบแดงบนจอ + บอกเหตุในคิว (ข้อความไทยของฐานตามจริง)', rpcs('transfer_begin').length === rb + 1 && TRN.uploads.length === ub && !!fatal() && /ใหญ่เกิน 20 MB/.test(fatal().textContent) && /ไม่สำเร็จ/.test(txt('trQueue')) && /ใหญ่เกิน 20 MB/.test(txt('trQueue')));
  clearFatal(); delete TRN.fail.rpc_transfer_begin;
  TRN.fail.upload = 'Payload too large'; const ab = rpcs('transfer_abort').length, cb = rpcs('transfer_commit').length;
  await up([mkFile('b.mp4', 'video/mp4')]);
  ok('อัปโหลดขึ้นถังไม่สำเร็จ → ไม่ commit · ยกเลิกรายการที่ขอไว้ (transfer_abort) · แถบแดงบอกเรื่องขนาดไฟล์', rpcs('transfer_commit').length === cb && rpcs('transfer_abort').length === ab + 1 && !!fatal() && /ใหญ่เกินที่ระบบเก็บไฟล์รับได้/.test(fatal().textContent), fatal() && fatal().textContent);
  clearFatal(); delete TRN.fail.upload;
  TRN.fail.rpc_transfer_commit = 'ไม่พบไฟล์ในที่เก็บ — การอัปโหลดไม่สำเร็จ'; const ab2 = rpcs('transfer_abort').length;
  await up([mkFile('c.mp4', 'video/mp4')]);
  ok('commit ไม่สำเร็จ → ยกเลิกรายการ (abort) · ไม่ขึ้นว่าสำเร็จ', rpcs('transfer_abort').length === ab2 + 1 && /ไม่สำเร็จ/.test(txt('trQueue')) && !!fatal());
  clearFatal(); delete TRN.fail.rpc_transfer_commit;
  clearQ();
  // ไฟล์ติดกันต้องทีละไฟล์ + ยกเลิกไฟล์ที่รอคิวได้
  TRN.gateUpload = new Promise(r => { gate = r; }); const sb2 = rpcs('transfer_begin').length;
  await stage([mkFile('s1.mp3', 'audio/mpeg'), mkFile('s2.mp3', 'audio/mpeg'), mkFile('s3.mp3', 'audio/mpeg')]);
  $('trConfirm').click(); await sleep(300);
  ok('ไฟล์แรกยังอัปโหลดไม่เสร็จ → ไฟล์ที่เหลือยังไม่ขอพื้นที่ (ทีละไฟล์) · คิวบอก "กำลังอัปโหลด…" และ "รอคิว"', rpcs('transfer_begin').length === sb2 + 1 && /กำลังอัปโหลด…/.test(txt('trQueue')) && /รอคิว/.test(txt('trQueue')));
  const cq = document.querySelector('#trQueue [data-act="q-cancel"]'); const cqName = cq && cq.closest('.tr-q').querySelector('.tr-name').textContent;
  ok('ไฟล์ที่ยังรอคิวมีปุ่ม "ยกเลิก" (ไฟล์ที่กำลังส่งแบบธรรมดายกเลิกไม่ได้)', !!cq && /s[23]\\.mp3/.test(cqName) && document.querySelectorAll('#trQueue [data-act="q-cancel"]').length === 2, cqName);
  cq.click(); await sleep(50);
  ok('กด "ยกเลิก" ไฟล์ที่รอคิว → หายจากคิว ไม่ถูกอัปโหลด', !/s2\\.mp3/.test(txt('trQueue')) && document.querySelectorAll('#trQueue [data-act="q-cancel"]').length === 1);
  gate(); TRN.gateUpload = null; await idle();
  ok('ปล่อยไฟล์แรกแล้ว ไฟล์ที่เหลือตามมา (s1 และ s3 สำเร็จ · s2 ที่ยกเลิกไม่ถูกส่ง)', rpcs('transfer_begin').length === sb2 + 2 && !TRN.files.some(f => f.file_name === 's2.mp3') && TRN.files.filter(f => /^s[13]\\.mp3$/.test(f.file_name) && f.status === 'ready').length === 2);
  clearQ(); await sleep(50);

  // ── 8. ลบ ──
  const fz = TRN.files.find(f => f.file_name === 'mix.wav');
  btn(fz.id, 'delete').click(); await sleep(100);
  ok('กด "ลบ" → ถามยืนยันก่อน แสดงชื่อไฟล์ ยังไม่เรียกฐาน', $('confirmDialog').open && /mix\\.wav/.test(txt('confirmBody')) && /กู้คืนไม่ได้/.test(txt('confirmBody')) && rpcs('transfer_delete').length === 0);
  closeConfirm(); await sleep(50);
  ok('ยกเลิกในหน้าต่างยืนยัน → ไม่ลบ', !!rowOf(fz.id) && rpcs('transfer_delete').length === 0);
  btn(fz.id, 'delete').click(); await sleep(100); $('confirmOkBtn').click(); await sleep(450);
  ok('ยืนยันลบ: transfer_delete → ลบตัวไฟล์ในถังตามพาธที่ฐานส่งกลับ → transfer_mark_purged', rpcs('transfer_delete').length === 1 && TRN.removed[TRN.removed.length - 1].paths[0] === fz.object_path && !TRN.objects.has(fz.object_path) && lastRpc('transfer_mark_purged').args.p_ids[0] === fz.id);
  ok('ลบแล้วไฟล์หายจากรายการ · หน้าต่างยืนยันปิด · แจ้งผล · ประวัติ "ลบ" โดย Zen', !rowOf(fz.id) && !$('confirmDialog').open && /ลบไฟล์แล้ว/.test(txt('toast')) && TRN.events.some(e => e.file_id === fz.id && e.kind === 'delete' && e.actor_id === 'u2'));
  ok('ลบเสร็จไม่มีแถบแดง · ตัวไฟล์ถูกทำเครื่องหมายว่าลบสะอาด (purged)', !fatal() && !!TRN.files.find(f => f.id === fz.id).purged_at);
  const nd = rpcs('transfer_delete').length;
  ok('ไฟล์ของคนอื่นไม่มีปุ่มลบ · เรียก trAskDelete ตรง ๆ ก็ไม่ถามยืนยัน', !btn('f2', 'delete') && (trAskDelete('f2'), !$('confirmDialog').open));
  await trDelete('f2'); await sleep(300);
  ok('บังคับเรียกลบไฟล์ของคนอื่น → ฐานปฏิเสธ แถบแดงบอกเหตุ ไฟล์ยังอยู่ ตัวไฟล์ในถังยังอยู่', rpcs('transfer_delete').length === nd + 1 && !!fatal() && /เฉพาะคนที่อัปโหลด/.test(fatal().textContent) && !!rowOf('f2') && TRN.objects.has('audio/f2.bin'));
  clearFatal();
  await trDelete('f5'); await sleep(300);
  ok('บังคับเรียกลบไฟล์ถาวรโดยพนักงาน → ฐานปฏิเสธ "เฉพาะเจ้าของร้าน" · ไฟล์ถาวรยังอยู่', !!fatal() && /ไฟล์ถาวรลบได้เฉพาะเจ้าของร้าน/.test(fatal().textContent) && !!rowOf('f5') && TRN.objects.has('doc/f5.bin'));
  clearFatal();
  TRN.fail.remove = 'storage down'; btn('f7', 'delete').click(); await sleep(100); $('confirmOkBtn').click(); await sleep(450);
  ok('ลบตัวไฟล์ในถังไม่สำเร็จ → รายการถูกลบแล้ว (ทุกคนเปิดไม่ได้) · บอกว่าตัวไฟล์จะถูกกวาดรอบหน้า ไม่ทำเป็นสำเร็จเงียบ ๆ', !rowOf('f7') && /เก็บกวาด/.test(txt('toast')) && !TRN.files.find(f => f.id === 'f7').purged_at && !fatal());
  delete TRN.fail.remove;
  await relogin('tibass'); await openPage();
  btn('f6', 'delete').click(); await sleep(100); $('confirmOkBtn').click(); await sleep(450);
  ok('เจ้าของร้านลบไฟล์ของคนอื่น (Nui) ได้ · ประวัติ "ลบ" โดย TiBass · คำขอเก็บถาวรที่ค้างของไฟล์นั้นถูกยกเลิก (void)', !rowOf('f6') && TRN.events.some(e => e.file_id === 'f6' && e.kind === 'delete' && e.actor_id === 'u1') && TRN.reqs.every(q => q.file_id !== 'f6' || q.status === 'void'));
  btn('f5', 'delete').click(); await sleep(100);
  ok('เจ้าของลบไฟล์ถาวร → หน้าต่างยืนยันเตือนตัวหนาว่าเป็นไฟล์ถาวรในคลัง Asset', $('confirmDialog').open && /ไฟล์ถาวร/.test(txt('confirmBody')) && /คลัง Asset/.test(txt('confirmBody')) && !!$('confirmBody').querySelector('strong'));
  closeConfirm(); await sleep(50);

  // ── 9. เก็บกวาด ──
  await relogin('zen');
  TRN.seed(); TRN.files.find(f => f.id === 'fx').expires_at = new Date(Date.now() - 1000).toISOString();
  const sw0 = rpcs('transfer_sweep').length, rm0 = TRN.removed.length;
  await openPage(); await sleep(400);
  ok('เปิดหน้า → เรียก transfer_sweep หนึ่งครั้ง → ลบตัวไฟล์ที่ครบ 30 วัน/ที่ถูกลบ ทั้งชุดในถัง → แจ้งฐานว่าลบแล้ว', rpcs('transfer_sweep').length === sw0 + 1 && TRN.removed.length === rm0 + 1 && ['doc/fx.bin', 'photo/fe.bin', 'audio/fd.bin'].every(p => TRN.removed[TRN.removed.length - 1].paths.indexOf(p) >= 0) && !TRN.objects.has('doc/fx.bin') && !TRN.objects.has('photo/fe.bin') && !TRN.objects.has('audio/fd.bin'));
  ok('...ทุกแถวที่กวาดถูกทำเครื่องหมาย purged · fx กลายเป็น expired · มีประวัติ "ระบบ" ครบ 30 วัน', ['fx', 'fe', 'fd'].every(i => !!TRN.files.find(f => f.id === i).purged_at) && TRN.files.find(f => f.id === 'fx').status === 'expired' && TRN.events.some(e => e.file_id === 'fx' && e.kind === 'expire' && e.actor_id === null));
  ok('...รายการไฟล์ยังเหมือนเดิม (ไฟล์ที่หมดอายุไม่อยู่) · ไม่มีแถบแดง/เหลือง', groups().indexOf('เอกสาร:1') >= 0 && !fatal() && !document.querySelector('#trAlert .alert'));
  const sw1 = rpcs('transfer_sweep').length;
  TRN.files.find(f => f.id === 'f8').expires_at = new Date(Date.now() - 1000).toISOString();     // ครบ 30 วันแล้วแต่ฐานยังไม่ถูกกวาด (status ยัง ready)
  TRN.fail.rpc_transfer_sweep = 'boom'; $('trReload').click(); await sleep(450);
  ok('ไฟล์ที่ครบ 30 วันแล้วแต่ยังไม่ถูกกวาด (กวาดไม่สำเร็จ) ถูกซ่อนจากรายการ — ไม่โชว์ไฟล์ที่เปิดไม่ได้แล้ว', TRN.files.find(f => f.id === 'f8').status === 'ready' && !rowOf('f8'));
  ok('กวาดไม่สำเร็จ → แถบเหลืองบอกตามจริง (ไม่ใช่แดง ไม่ขวางการใช้งาน) · รายการไฟล์ยังใช้ได้', rpcs('transfer_sweep').length === sw1 + 1 && /เก็บกวาดไฟล์ที่หมดอายุไม่สำเร็จ: boom/.test(txt('trAlert')) && !!document.querySelector('#trAlert .alert-warn') && !fatal() && rows().length > 0);
  delete TRN.fail.rpc_transfer_sweep;
  TRN.fail.select = 'connection reset'; $('trReload').click(); await sleep(450);
  ok('โหลดรายการไม่สำเร็จ → แถบแดงบอกเหตุ + แถบบนจอ · รายการเดิมที่โหลดไว้ยังอยู่ (ไม่ล้างจอเปล่า) · ไม่กวาดต่อ', /โหลดข้อมูลโอนไฟล์ไม่สำเร็จ: connection reset/.test(txt('trAlert')) && !!document.querySelector('#trAlert .alert-red') && !!fatal() && rows().length > 0 && rpcs('transfer_sweep').length === sw1 + 1);
  clearFatal(); delete TRN.fail.select;
  $('trReload').click(); await sleep(450);
  ok('กดรีเฟรชอีกครั้งสำเร็จ → แถบแดงหาย', txt('trAlert') === '' || !document.querySelector('#trAlert .alert-red'));

  // ── 10. ยังไม่รัน migration 049 ──
  TRN.missing = true; const sw2 = rpcs('transfer_sweep').length;
  $('trReload').click(); await sleep(450);
  ok('ยังไม่รัน 049 → แถบเหลืองบอกให้รัน (ไม่ใช่ error แดง) · ซ่อนช่องอัปโหลด · ไม่เรียกฟังก์ชันเก็บกวาด · แท็บคำขอซ่อน', /migration 049/.test(txt('trAlert')) && !!document.querySelector('#trAlert .alert-warn') && !fatal() && $('trUpload').hidden && rpcs('transfer_sweep').length === sw2 && rows().length === 0 && $('trReqTab').hidden);
  TRN.missing = false; $('trReload').click(); await sleep(450);
  ok('รันแล้วกดรีเฟรช → ใช้งานได้ปกติ ช่องอัปโหลดกลับมา', !$('trUpload').hidden && rows().length > 0 && txt('trAlert') === '' && !$('trReqTab').hidden);

  // ── 11. Tag พนักงาน ──
  await stage([mkFile('tagme.mp4', 'video/mp4')]);
  const people = [...$('trTagPick').querySelectorAll('label')].map(l => flat(l.textContent)).sort();
  ok('ตัวเลือก Tag = ทีมงานที่ใช้งานอยู่ ยกเว้นตัวเอง (Zen) และคนที่ถูกปิด (Ghost)', people.join('|') === ['Evil <i>Name</i>', 'Nui', 'Nutty', 'TiBass'].sort().join('|'), people.join('|'));
  ok('ชื่อคนที่เป็น HTML ในตัวเลือก Tag แสดงเป็นข้อความ (ไม่สร้างแท็ก)', !$('trTagPick').querySelector('i, b, script') && !$('trTagField').hidden);
  pickTags(['Nutty', 'Nui']); await sleep(50);
  ok('ติ๊ก Tag 2 คน → เก็บใน tr.stageTags เป็นรหัสพนักงาน', tr.stageTags.slice().sort().join() === 'u3,u4', tr.stageTags.join());
  await go();
  const tcall = lastRpc('transfer_begin');
  ok('transfer_begin ส่ง p_tags เป็นรหัสพนักงานที่ติ๊ก (ไม่ส่งชื่อ) · ไม่ส่ง p_keep เมื่อไม่ได้ติ๊ก', !!tcall && tcall.args.p_tags.slice().sort().join() === 'u3,u4' && !('p_keep' in tcall.args), JSON.stringify(tcall.args));
  ok('คิวบอก "Tag 2 คน" · แถวไฟล์แสดง "ถึง:" Nutty · Nui "ยังไม่เปิด"', /Tag 2 คน/.test(txt('trQueue')) && /ถึง:/.test(fileRow('tagme.mp4').textContent) && /Nutty · ยังไม่เปิด/.test(fileRow('tagme.mp4').textContent) && /Nui · ยังไม่เปิด/.test(fileRow('tagme.mp4').textContent), flat(fileRow('tagme.mp4').textContent));
  await stage([mkFile('tag2.mp3', 'audio/mpeg')]);
  ok('ชุดถัดไปไม่เผลอใช้ Tag เดิม (ตัวเลือกถูกล้าง)', tr.stageTags.length === 0 && [...$('trTagPick').querySelectorAll('input')].every(i => !i.checked));
  $('trStageClear').click(); await sleep(50);
  clearQ();
  // คนที่ถูก Tag
  await relogin('nutty');
  ok('ตัวเลขแดงข้างเมนู "โอนไฟล์" = ไฟล์ที่ Tag ถึงฉันและยังไม่เปิด (2) — แสดงตั้งแต่ล็อกอิน ก่อนเปิดหน้านี้', badge() === '2', badge());
  ok('ตัวเลขข้างเมนูอ่านออกเสียงได้ (aria-label)', /ถึงคุณ/.test($('navBadge-transfer').getAttribute('aria-label') || ''));
  await openPage();
  ok('หน้าโอนไฟล์ของคนที่ถูก Tag: แถวของเขาขึ้น "คุณ · ยังไม่เปิด" (แดง)', /คุณ · ยังไม่เปิด/.test(fileRow('tagme.mp4').textContent) && !!fileRow('tagme.mp4').querySelector('.tr-tagline .st-bad'));
  $('trToMe').checked = true; $('trToMe').dispatchEvent(new Event('change', { bubbles: true })); await sleep(50);
  ok('ตัวกรอง "ถึงฉัน" → เฉพาะไฟล์ที่ Tag ฉัน (f1 กับ tagme.mp4)', ids().length === 2 && !!fileRow('tagme.mp4') && !!rowOf('f1'), ids().join());
  $('trToMe').checked = false; $('trToMe').dispatchEvent(new Event('change', { bubbles: true }));
  const tid = fid('tagme.mp4');
  btn(tid, 'download').click(); await sleep(300);
  ok('เปิด/ดาวน์โหลดไฟล์ที่ Tag ถึงฉัน → ฐานทำเครื่องหมาย "เปิดแล้ว" · แถวเปลี่ยนเป็น "คุณ · เปิดแล้ว" · ตัวเลขข้างเมนูลดเป็น 1', TRN.tags.some(t => t.file_id === tid && t.admin_id === 'u3' && t.seen_at) && /คุณ · เปิดแล้ว/.test(rowOf(tid).textContent) && badge() === '1', badge());
  ok('ปุ่ม "แก้ Tag" ไม่มีสำหรับคนที่ไม่ใช่ผู้อัปโหลด/เจ้าของ', !btn(tid, 'tags'));
  await relogin('zen'); await openPage();
  ok('ผู้อัปโหลด (Zen) เห็นว่า Nutty เปิดแล้ว · Nui ยังไม่เปิด', /Nutty · เปิดแล้ว/.test(rowOf(tid).textContent) && /Nui · ยังไม่เปิด/.test(rowOf(tid).textContent), flat(rowOf(tid).textContent));
  ok('ผู้อัปโหลดมีปุ่ม "แก้ Tag"', !!btn(tid, 'tags'));
  btn(tid, 'tags').click(); await sleep(100);
  const dlgPeople = [...$('trTagDlgPick').querySelectorAll('label')].map(l => flat(l.textContent) + (l.querySelector('input').checked ? '✓' : '')).sort();
  ok('หน้าต่างแก้ Tag: ติ๊กคนที่ถูก Tag อยู่ (Nutty ✓ Nui ✓) · ไม่มีตัวผู้อัปโหลดเอง/คนที่ถูกปิด', dlgOpen('trTagDlg') && dlgPeople.join('|') === ['Evil <i>Name</i>', 'Nui✓', 'Nutty✓', 'TiBass'].sort().join('|') && /tagme\\.mp4/.test(txt('trTagDlgFile')), dlgPeople.join('|'));
  TRN.fail.rpc_transfer_set_tags = 'boom'; $('trTagDlgSave').click(); await sleep(200);
  ok('บันทึก Tag ไม่สำเร็จ → ข้อความแดงในหน้าต่าง (ไม่ปิด · ไม่ขึ้นว่าสำเร็จ)', dlgOpen('trTagDlg') && !$('trTagDlgErr').hidden && /boom/.test(txt('trTagDlgErr')));
  delete TRN.fail.rpc_transfer_set_tags;
  [...$('trTagDlgPick').querySelectorAll('input')].forEach(i => { const n = flat(i.parentElement.textContent); i.checked = (n === 'Nutty' || n === 'TiBass'); });
  $('trTagDlgSave').click(); await sleep(400);
  ok('บันทึก Tag: เอา Nui ออก เพิ่ม TiBass → transfer_set_tags ส่งรหัส · หน้าต่างปิด · แถวอัปเดต · Nutty ที่เปิดแล้วคงสถานะ "เปิดแล้ว" · TiBass เริ่ม "ยังไม่เปิด"',
    !dlgOpen('trTagDlg') && lastRpc('transfer_set_tags').args.p_tags.slice().sort().join() === 'u1,u3' && !/Nui/.test(rowOf(tid).textContent) && /Nutty · เปิดแล้ว/.test(rowOf(tid).textContent) && /TiBass · ยังไม่เปิด/.test(rowOf(tid).textContent), flat(rowOf(tid).textContent));
  ok('มีประวัติ "แก้ Tag" โดย Zen ที่ฐาน', TRN.events.some(e => e.file_id === tid && e.kind === 'tag' && e.actor_id === 'u2'));
  await relogin('tibass'); await openPage();
  ok('เจ้าของร้านแก้ Tag ของไฟล์คนอื่นได้ (มีปุ่ม)', !!btn(tid, 'tags') && !!btn('f2', 'tags'));
  await relogin('nui'); await openPage();
  ok('ผู้ดูแลแก้ Tag ได้เฉพาะไฟล์ที่ตัวเองอัปโหลด', !btn(tid, 'tags') && !btn('f2', 'tags'));
  await relogin('zen'); await openPage();
  const forced = await db.rpc('transfer_set_tags', { p_id: 'f2', p_tags: [] });       // บังคับแก้ Tag ของคนอื่นด้วยโค้ด (ไม่ผ่านปุ่ม) → ฐานต้องปฏิเสธ
  ok('บังคับแก้ Tag ไฟล์ของคนอื่นโดยพนักงาน → ฐานปฏิเสธ', !!forced.error && /เฉพาะคนที่อัปโหลด/.test(forced.error.message));

  // ── 12. รูปตัวอย่าง (thumbnail) ──
  const png = await makePng(300, 200, 'photo-thumb.png');
  await stage([png, mkFile('bad-image.png', 'image/png', 'ไม่ใช่รูปจริง'), mkFile('stems2.zip', 'application/zip')]);
  await sleep(500);
  const stImgs = [...$('trStageList').querySelectorAll('.tr-row')].map(r => !!r.querySelector('.tr-thumb img'));
  ok('ขั้นรอยืนยัน: รูปจริงมีรูปตัวอย่างให้ดูก่อนอัปโหลด · รูปเสีย/zip ใช้ไอคอน', stImgs.join() === 'true,false,false', stImgs.join());
  const stSrc = $('trStageList').querySelector('.tr-thumb img').getAttribute('src');
  ok('รูปตัวอย่างเป็น JPEG ย่อ ขนาดข้อมูลเล็ก (< 38,000 ตัวอักษร)', /^data:image\\/jpeg;base64,/.test(stSrc) && stSrc.length < 38000, String(stSrc).length);
  const dim = await new Promise(r => { const im = new Image(); im.onload = () => r([im.naturalWidth, im.naturalHeight]); im.onerror = () => r([0, 0]); im.src = stSrc; });
  ok('ขนาดจริงของรูปตัวอย่างอยู่ในกรอบ 192px และรักษาสัดส่วน 300×200 → 192×128', dim[0] === 192 && dim[1] === 128, dim.join('x'));
  await go();
  const cm1 = rpcs('transfer_commit').slice(-3);
  const withThumb = cm1.filter(c => 'p_thumb' in c.args);
  ok('commit ส่งรูปตัวอย่างเฉพาะไฟล์ที่ทำได้ (1 ไฟล์ — ตรงกับที่เห็นตอนรอยืนยัน) · รูปเสีย/zip ไม่ส่ง · อัปโหลดสำเร็จทั้ง 3', cm1.length === 3 && withThumb.length === 1 && withThumb[0].args.p_thumb === stSrc && txt('trQueue').match(/อัปโหลดแล้ว/g).length === 3, txt('trQueue'));
  ok('แถวไฟล์ในรายการแสดงรูปตัวอย่าง · รูปเสีย/zip แสดงไอคอนตามกลุ่ม', !!fileRow('photo-thumb.png').querySelector('.tr-thumb img[src^="data:image/jpeg"]') && !fileRow('bad-image.png').querySelector('.tr-thumb img') && !!fileRow('stems2.zip').querySelector('.tr-thumb svg'));
  ok('รูปตัวอย่างของรูปภาพกดเปิดดูได้ (ปุ่ม + ป้ายอ่านออกเสียง) · zip เป็นไอคอนเฉย ๆ ไม่ใช่ปุ่ม', !!fileRow('photo-thumb.png').querySelector('button.tr-thumb[aria-label^="เปิดดู"]') && !!fileRow('stems2.zip').querySelector('span.tr-thumb[aria-hidden="true"]'));
  fileRow('photo-thumb.png').querySelector('button.tr-thumb').click(); await sleep(300);
  ok('กดรูปตัวอย่าง = เปิดดู (transfer_open view) ไม่ข้ามประวัติ', lastRpc('transfer_open').args.p_purpose === 'view' && lastRpc('transfer_open').args.p_id === fid('photo-thumb.png'));
  clearQ();
  // รูปตัวอย่างอันตรายจากฐาน (ถูกแก้ตรงที่ฐาน/ไม่ผ่านเกณฑ์) ต้องไม่ถูกใส่เป็น src
  TRN.files.find(f => f.id === 'f2').thumb = 'javascript:alert(1)';
  TRN.files.find(f => f.id === 'f3').thumb = 'data:image/jpeg;base64,AAAA" onerror="window.XSS=3';
  TRN.files.find(f => f.id === 'f8').thumb = 'data:image/svg+xml;base64,PHN2Zz4=';
  await reload();
  ok('รูปตัวอย่างที่ไม่ผ่านรูปแบบ (javascript: · แทรกแอตทริบิวต์ · svg) ไม่ถูกใส่เป็น src — แสดงไอคอนแทน · ไม่รันสคริปต์', window.XSS === undefined && ['f2', 'f3'].every(i => !rowOf(i).querySelector('img') && !!rowOf(i).querySelector('.tr-thumb svg')));
  TRN.files.find(f => f.id === 'f2').thumb = null; TRN.files.find(f => f.id === 'f3').thumb = null; TRN.files.find(f => f.id === 'f8').thumb = null;
  // วิดีโอ (เฟรมแรก) — บันทึกวิดีโอจริงด้วย canvas.captureStream + MediaRecorder
  let webm = null;
  try {
    const cv = document.createElement('canvas'); cv.width = 160; cv.height = 90; const g = cv.getContext('2d');
    const rec = new MediaRecorder(cv.captureStream(15), { mimeType: 'video/webm' }); const parts = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
    const stopped = new Promise(r => { rec.onstop = r; });
    rec.start(); for (let i = 0; i < 16; i++) { g.fillStyle = 'hsl(' + (i * 22) + ',70%,45%)'; g.fillRect(0, 0, 160, 90); await sleep(60); }
    rec.stop(); await stopped; webm = new File(parts, 'clip.webm', { type: 'video/webm' });
  } catch (e) { webm = null; }
  ok('(เตรียมวิดีโอทดสอบจริงจากเบราว์เซอร์)', !!webm && webm.size > 0, 'ไม่ได้ไฟล์วิดีโอ');
  await stage([webm]); await sleep(900);
  const vimg = $('trStageList').querySelector('.tr-thumb img');
  ok('วิดีโอ: ได้รูปตัวอย่างจากเฟรมในไฟล์ (JPEG ย่อ) — ไม่ค้าง ไม่ error', !!vimg && /^data:image\\/jpeg;base64,/.test(vimg.getAttribute('src')) && !fatal(), String(vimg && vimg.getAttribute('src')).slice(0, 40));
  $('trStageClear').click(); await sleep(50);
  const t0 = performance.now();
  const badVid = await trMakeThumb(mkFile('broken.mp4', 'video/mp4', 'ไม่ใช่วิดีโอจริง'));
  ok('วิดีโอเสีย → ไม่มีรูปตัวอย่าง (null) โดยไม่ reject และเสร็จเร็ว (ไม่รอ timeout 12 วินาที)', badVid === null && performance.now() - t0 < 5000, String(performance.now() - t0));
  ok('ไฟล์ชนิดที่ไม่รองรับ (zip · เสียง · เอกสาร) ไม่ถูกส่งเข้าตัวสร้างรูปตัวอย่าง', (await trMakeThumb(mkFile('a.zip', 'application/zip'))) === null && (await trMakeThumb(mkFile('a.mp3', 'audio/mpeg'))) === null && (await trMakeThumb(mkFile('a.pdf', 'application/pdf'))) === null);

  // ── 13. อัปโหลดไฟล์ใหญ่ด้วย tus ──
  const big = new File([new Uint8Array(7 * MB)], 'big-clip.mp4', { type: 'video/mp4' });
  const tc0 = TRN.tusCalls.length, upl0 = TRN.uploads.length;
  TRN.gateTus = new Promise(r => { gate = r; });
  await stage([big]); $('trConfirm').click(); await sleep(700);
  ok('ไฟล์ > 6 MB: ใช้ tus (ไม่เรียกอัปโหลดแบบธรรมดา)', TRN.tusCalls.length === tc0 + 1 && TRN.uploads.length === upl0 && TRN.tusCalls[tc0].started === true);
  const to = TRN.tusCalls[tc0].opts;
  ok('พารามิเตอร์ tus ตรงกับที่ Supabase กำหนด: endpoint · chunk 6 MB · bucket/objectName/contentType · x-upsert false · ลองใหม่เมื่อเน็ตสะดุด · ลบ fingerprint เมื่อสำเร็จ',
    to.endpoint === SUPABASE_URL + '/storage/v1/upload/resumable' && to.chunkSize === 6 * MB && to.metadata.bucketName === 'internal-transfer' && /^video\\/n\\d+\\.mp4$/.test(to.metadata.objectName) && to.metadata.contentType === 'video/mp4'
    && to.headers['x-upsert'] === 'false' && !!to.headers.apikey && to.retryDelays.length >= 3 && to.uploadDataDuringCreation === true && to.removeFingerprintOnSuccess === true, JSON.stringify(to.metadata) + ' ' + to.endpoint);
  ok('โทเคนล็อกอินของผู้ใช้ถูกใส่ทุกคำขอ (onBeforeRequest → Authorization: Bearer …) — โทเคนหมุนระหว่างอัปโหลดนานก็ตามทัน', TRN.tusHeaders.some(h => h[0] === 'Authorization' && /^Bearer at-u2-/.test(h[1])), JSON.stringify(TRN.tusHeaders));
  const pb = document.querySelector('#trQueue [role="progressbar"]');
  ok('แถบความคืบหน้า: เปอร์เซ็นต์ + ขนาดที่ส่งไปแล้ว เป็นตัวหนังสือด้วย (ไม่พึ่งแถบอย่างเดียว) · aria-valuenow', !!pb && pb.getAttribute('aria-valuenow') === '100' && /100%/.test(txt('trQueue')) && /7\\.0 MB จาก 7\\.0 MB/.test(txt('trQueue')), txt('trQueue'));
  ok('ระหว่างส่งด้วย tus มีปุ่ม "ยกเลิก" ที่ไฟล์นั้น', !!document.querySelector('#trQueue [data-act="q-cancel"]'));
  gate(); TRN.gateTus = null; await idle();
  ok('tus สำเร็จ → commit (พาธที่ฐานออกให้) → ไฟล์อยู่ในรายการ · ไม่มีแถบแดง', !!fileRow('big-clip.mp4') && !fatal() && lastRpc('transfer_commit').args.p_id === TRN.files.find(f => f.file_name === 'big-clip.mp4').id && TRN.objects.has(to.metadata.objectName));
  clearQ();
  const tc1 = TRN.tusCalls.length;
  await up([mkFile('small.mp4', 'video/mp4', 'x'.repeat(2 * MB))]);
  ok('ไฟล์เล็ก (≤ 6 MB) ใช้อัปโหลดแบบธรรมดา ไม่เรียก tus', TRN.tusCalls.length === tc1 && /small\\.mp4/.test(txt('trList')));
  clearQ();
  const bigB = () => new File([new Uint8Array(7 * MB)], 'big-fail.mp4', { type: 'video/mp4' });
  TRN.tus = { mode: 'error:413', body: 'The object exceeded the maximum allowed size' }; const abx = rpcs('transfer_abort').length, cmx = rpcs('transfer_commit').length;
  await up([bigB()]);
  ok('tus ตอบ 413 → ไม่ commit · ยกเลิกรายการ (abort) · แถบแดงบอกเรื่องเพดานไฟล์/Global limit', rpcs('transfer_commit').length === cmx && rpcs('transfer_abort').length === abx + 1 && !!fatal() && /ใหญ่เกินที่ระบบเก็บไฟล์รับได้/.test(fatal().textContent) && /Global file size limit/.test(fatal().textContent), fatal() && fatal().textContent);
  clearFatal(); clearQ();
  TRN.tus = { mode: 'error:403', body: 'new row violates row-level security policy' };
  await up([bigB()]);
  ok('tus ตอบ 403 (RLS) → "ไม่มีสิทธิ์อัปโหลด…" เป็นภาษาไทย ไม่ใช่ข้อความดิบ', !!fatal() && /ไม่มีสิทธิ์อัปโหลดไฟล์นี้/.test(fatal().textContent) && !/row-level/.test(fatal().textContent), fatal() && fatal().textContent);
  clearFatal(); clearQ();
  TRN.tus = { mode: 'ok', body: '' }; const savedTus = window.tus; window.tus = undefined; const tc2 = TRN.tusCalls.length, up2 = TRN.uploads.length;
  await up([new File([new Uint8Array(7 * MB)], 'big-nocdn.mp4', { type: 'video/mp4' })]);
  window.tus = savedTus;
  ok('โหลดไลบรารี tus ไม่ได้ (CDN ล่ม/ออฟไลน์) → ถอยไปอัปโหลดแบบธรรมดา ไฟล์ยังขึ้นถังสำเร็จ', TRN.tusCalls.length === tc2 && TRN.uploads.length === up2 + 1 && !!fileRow('big-nocdn.mp4') && !fatal(), fatal() && fatal().textContent);
  clearQ();
  TRN.tus = { mode: 'hang', body: '' }; const abx2 = rpcs('transfer_abort').length, ta0 = TRN.tusAborts.length;
  await stage([new File([new Uint8Array(7 * MB)], 'big-cancel.mp4', { type: 'video/mp4' }), mkFile('after-cancel.mp3', 'audio/mpeg')]);
  $('trConfirm').click(); await sleep(500);
  const cancelBtn = document.querySelector('#trQueue [data-act="q-cancel"][data-qid="' + tr.queue[0].id + '"]');
  ok('ไฟล์ที่กำลังส่งด้วย tus มีปุ่ม "ยกเลิก"', !!cancelBtn && tr.queue[0].state === 'up');
  cancelBtn.click(); await idle();
  ok('กด "ยกเลิก" ระหว่างส่ง → สั่ง tus abort(true) (ลบส่วนที่ขึ้นไปแล้ว) · abort รายการที่ฐาน · ขึ้น "ยกเลิกโดยผู้ใช้" · ไม่ขึ้นแถบแดง · ไฟล์ถัดไปยังอัปโหลดต่อ',
    TRN.tusAborts.length === ta0 + 1 && TRN.tusAborts[ta0].del === true && rpcs('transfer_abort').length === abx2 + 1 && /ยกเลิกโดยผู้ใช้/.test(txt('trQueue')) && !fatal() && !!fileRow('after-cancel.mp3') && !fileRow('big-cancel.mp4'), txt('trQueue'));
  clearQ();
  TRN.tus = { mode: 'ok', body: '' };

  // ── 14. เก็บถาวร (คลัง Asset) ──
  await stage([mkFile('x.mp3', 'audio/mpeg')]);
  ok('พนักงานทั่วไป (Zen): ไม่มีช่องติ๊ก "เก็บถาวร" ในรอยืนยัน', $('trKeepField').hidden);
  $('trStageClear').click(); await sleep(50);
  await relogin('tibass'); await openPage();
  await stage([mkFile('logo-new.png', 'image/png')]);
  ok('เจ้าของ: มีช่องติ๊ก "เก็บถาวร (คลัง Asset)" · ไม่ได้ติ๊กตั้งต้น · บอกเพดานไฟล์ละ 500 MB', !$('trKeepField').hidden && !$('trKeep').checked && /^เก็บถาวร \\(คลัง Asset\\)/.test(txt('trKeepText')) && /500 MB/.test(txt('trKeepText')), txt('trKeepText'));
  $('trStageClear').click(); await sleep(50);
  await stage([bigFile('huge-asset.mp4', 'video/mp4', 600 * MB), mkFile('ok-asset.png', 'image/png')]);
  $('trKeep').click(); await sleep(80);
  ok('ติ๊กถาวรแล้วมีไฟล์เกิน 500 MB → ขึ้นเตือนแดงที่ไฟล์นั้น + ปุ่มยืนยันกดไม่ได้ (บอกให้เอาติ๊กออกหรือเอาไฟล์ออก)', /ใหญ่เกินเพดานไฟล์ถาวร/.test(txt('trStageList')) && $('trConfirm').disabled === true);
  document.querySelector('#trStageList [data-act="stage-rm"][data-sid="' + tr.stage[0].id + '"]').click(); await sleep(50);
  ok('เอาไฟล์ใหญ่ออก → ปุ่มยืนยันกดได้อีก', $('trConfirm').disabled === false && !/ใหญ่เกินเพดานไฟล์ถาวร/.test(txt('trStageList')));
  await go();
  const kcall = lastRpc('transfer_begin');
  ok('เจ้าของติ๊กถาวร → transfer_begin ส่ง p_keep = true · ฐานตั้งเป็นไฟล์ถาวรทันที · คิวบอก "ตั้งเป็นไฟล์ถาวรแล้ว"', kcall.args.p_keep === true && /ตั้งเป็นไฟล์ถาวรแล้ว/.test(txt('trQueue')) && TRN.files.find(f => f.file_name === 'ok-asset.png').is_permanent === true, JSON.stringify(kcall.args));
  ok('แถวไฟล์ถาวรใหม่: ป้าย "ถาวร · Asset" ไม่มีนับถอยหลัง · ไม่มีคำขอ', /ถาวร · Asset/.test(fileRow('ok-asset.png').textContent) && !/เหลือ/.test(fileRow('ok-asset.png').textContent) && !TRN.reqs.some(q => q.file_id === fid('ok-asset.png')));
  clearQ();
  btn('f2', 'pin').click(); await sleep(400);
  ok('ปุ่ม "ตั้งเป็นไฟล์ถาวร" → transfer_set_permanent(true) → ป้ายถาวร · แจ้งผล', lastRpc('transfer_set_permanent').args.p_on === true && /ถาวร · Asset/.test(rowOf('f2').textContent) && /ตั้งเป็นไฟล์ถาวรแล้ว/.test(txt('toast')) && !!btn('f2', 'unpin'));
  $('trPerm').checked = true; $('trPerm').dispatchEvent(new Event('change', { bubbles: true })); await sleep(50);
  ok('ตัวกรอง "เฉพาะไฟล์ถาวร (Asset)" → memo.pdf · mix-oct.wav · ok-asset.png', ids().length === 3 && !!rowOf('f5') && !!rowOf('f2') && !!fileRow('ok-asset.png'), ids().join());
  $('trPerm').checked = false; $('trPerm').dispatchEvent(new Event('change', { bubbles: true })); await sleep(50);
  TRN.files.find(f => f.file_name === 'ok-asset.png').expires_at = new Date(Date.now() - 86400000 * 3).toISOString();       // ไฟล์ถาวรเลยวันครบ 30 วันไปแล้ว — ต้องไม่หาย ไม่ถูกกวาด
  await reload();
  ok('ไฟล์ถาวรไม่หมดอายุ: แม้เลยวันครบ 30 วันก็ยังอยู่ในรายการ · เปิดดูได้ · ไม่ถูกกวาด', !!fileRow('ok-asset.png') && TRN.files.find(f => f.file_name === 'ok-asset.png').status === 'ready' && /ถาวร · Asset/.test(fileRow('ok-asset.png').textContent));
  btn('f2', 'unpin').click(); await sleep(100);
  ok('ปุ่ม "ปลดถาวร" → ถามยืนยันก่อน บอกว่าเริ่มนับ 30 วันใหม่ · ยังไม่เรียกฐาน', $('confirmDialog').open && /เริ่มนับ 30 วันใหม่/.test(txt('confirmBody')) && rpcs('transfer_set_permanent').length === 1);
  $('confirmOkBtn').click(); await sleep(450);
  ok('ยืนยันปลดถาวร → ไฟล์กลับเป็นไฟล์ปกติ มีนับถอยหลัง 30 วัน · ประวัติ "ปลดไฟล์ถาวร"', lastRpc('transfer_set_permanent').args.p_on === false && !/ถาวร · Asset/.test(rowOf('f2').textContent) && /เหลือ 30 วัน/.test(rowOf('f2').textContent) && TRN.events.some(e => e.file_id === 'f2' && e.kind === 'unpin' && e.actor_id === 'u1'));
  await relogin('nui'); await openPage();
  await stage([mkFile('endcredit.mp4', 'video/mp4')]);
  ok('ผู้ดูแล (Nui): ช่องติ๊กเป็น "ขอเก็บถาวร…" บอกว่าเจ้าของต้องอนุมัติก่อนครบ 30 วัน', !$('trKeepField').hidden && /^ขอเก็บถาวร/.test(txt('trKeepText')) && /เจ้าของต้องอนุมัติก่อนไฟล์ครบ 30 วัน/.test(txt('trKeepText')), txt('trKeepText'));
  $('trKeep').click(); await sleep(50); await go();
  const nq = TRN.reqs.find(q => q.file_id === fid('endcredit.mp4'));
  ok('ผู้ดูแลติ๊กถาวร → ไฟล์ยัง "ไม่ถาวร" + มีคำขอรอเจ้าของ · คิวบอก "ส่งคำขอเก็บถาวรถึงเจ้าของแล้ว"', !!nq && nq.status === 'pending' && nq.kind === 'keep' && nq.requester_id === 'u4' && TRN.files.find(f => f.file_name === 'endcredit.mp4').is_permanent === false && /ส่งคำขอเก็บถาวรถึงเจ้าของแล้ว/.test(txt('trQueue')), txt('trQueue'));
  ok('แถว: ป้าย "รออนุมัติเก็บถาวร" + ยังนับถอยหลัง 30 วัน (ไม่ทันก็หมดอายุตามปกติ) · ไม่มีปุ่ม "ขอเก็บถาวร" ซ้ำ', /รออนุมัติเก็บถาวร/.test(fileRow('endcredit.mp4').textContent) && /เหลือ 30 วัน/.test(fileRow('endcredit.mp4').textContent) && !btn(fid('endcredit.mp4'), 'req-keep'));
  clearQ();
  await up([mkFile('promo-oct.pdf', 'application/pdf')]);
  const prid = fid('promo-oct.pdf');
  ok('ไฟล์ของผู้ดูแลที่ไม่ได้ขอถาวรตอนอัปโหลด → มีปุ่ม "ขอเก็บถาวร" ที่แถว', !!btn(prid, 'req-keep'));
  btn(prid, 'req-keep').click(); await sleep(450);
  ok('กด "ขอเก็บถาวร" → transfer_request_keep → แจ้งว่าส่งถึงเจ้าของแล้ว + ต้องอนุมัติก่อนวันหมดอายุ · แถวขึ้น "รออนุมัติเก็บถาวร" · ปุ่มหาย', lastRpc('transfer_request_keep').args.p_id === prid && /ส่งคำขอเก็บถาวรถึงเจ้าของแล้ว/.test(txt('toast')) && /รออนุมัติเก็บถาวร/.test(rowOf(prid).textContent) && !btn(prid, 'req-keep'));
  ok('ผู้ดูแลลบไฟล์ปกติของตัวเองได้ (ยังมีปุ่ม "ลบ") แต่ไฟล์ถาวรของคนอื่นต้อง "ขอลบ"', !!btn(prid, 'delete') && !btn('f5', 'delete') && !!btn('f5', 'req-del'));
  btn('f5', 'req-del').click(); await sleep(100);
  ok('กด "ขอลบ" ไฟล์ถาวร → ถามยืนยัน บอกว่าเจ้าของต้องอนุมัติ ไฟล์ยังอยู่จนกว่าจะอนุมัติ', $('confirmDialog').open && /เฉพาะเจ้าของร้าน/.test(txt('confirmBody')) && /ยังอยู่จนกว่าเจ้าของจะอนุมัติ/.test(txt('confirmBody')) && rpcs('transfer_request_delete').length === 0);
  $('confirmOkBtn').click(); await sleep(450);
  ok('ยืนยัน → transfer_request_delete · แถวขึ้น "รอเจ้าของอนุมัติการลบ" · ไฟล์ยังอยู่ · ไม่มีปุ่ม "ขอลบ" ซ้ำ', lastRpc('transfer_request_delete').args.p_id === 'f5' && /รอเจ้าของอนุมัติการลบ/.test(rowOf('f5').textContent) && !btn('f5', 'req-del') && TRN.objects.has('doc/f5.bin') && TRN.files.find(f => f.id === 'f5').status === 'ready');
  tabBtn('req').click(); await sleep(100);
  ok('ผู้ดูแลไม่เห็นปุ่มอนุมัติ/ปฏิเสธ · เห็นปุ่ม "ถอนคำขอ" ของตัวเอง', !document.querySelector('#trReqPending [data-act="req-ok"], #trReqPending [data-act="req-no"]') && !!document.querySelector('#trReqPending [data-act="req-wd"]'));

  // ── 15. คำขอ: เจ้าของตัดสิน ──
  await relogin('tibass');
  ok('ตัวเลขแดงข้างเมนูของเจ้าของ = คำขอที่รอตัดสิน 4 (stems.zip · endcredit · promo-oct · ลบ memo) + ไฟล์ที่ Tag ถึงเจ้าของและยังไม่เปิด 1 = 5 — แสดงตั้งแต่ล็อกอิน ก่อนเปิดหน้านี้', badge() === '5', badge());
  TRN.reqs.forEach(q => { if (q.file_id === 'f6') q.status = 'void'; });                                  // เก็บกวาดข้อมูลตั้งต้น: คำขอของ stems.zip ออก
  TRN.tags.forEach(t => { if (t.admin_id === 'u1') t.seen_at = new Date().toISOString(); });             // ไฟล์ที่ Tag ถึงเจ้าของ: เปิดแล้ว
  await reload();
  ok('...เมื่อเหลือคำขอรอตัดสิน 3 (endcredit · promo-oct · ลบ memo) และไม่มี Tag ค้าง → ตัวเลขข้างเมนู = 3', badge() === '3', badge());
  await openPage(); tabBtn('req').click(); await sleep(100);
  const rq = () => [...document.querySelectorAll('#trReqPending .tr-row')].map(r => flat(r.textContent));
  ok('แท็บ "คำขอ": ตัวเลขบนแท็บ 3 · รายการรอตัดสินบอก ประเภทคำขอ · ไฟล์ · ผู้ขอ', txt('trReqN') === '3' && rq().length === 3 && rq().some(t => /ขอเก็บถาวร · endcredit\\.mp4/.test(t) && /ผู้ขอ Nui/.test(t)) && rq().some(t => /ขอลบไฟล์ถาวร · memo\\.pdf/.test(t)), rq().join(' / '));
  ok('คำขอเก็บถาวรบอกกำหนด "ต้องตัดสินก่อนไฟล์หมดอายุ" · เจ้าของเห็นปุ่ม อนุมัติ/ปฏิเสธ ทุกใบ', rq().some(t => /ต้องตัดสินก่อนไฟล์หมดอายุ/.test(t)) && document.querySelectorAll('#trReqPending [data-act="req-ok"]').length === 3 && document.querySelectorAll('#trReqPending [data-act="req-no"]').length === 3);
  const reqOf = name => [...document.querySelectorAll('#trReqPending .tr-row')].find(r => r.textContent.indexOf(name) >= 0);
  reqOf('promo-oct.pdf').querySelector('[data-act="req-no"]').click(); await sleep(100);
  const dec0 = rpcs('transfer_request_decide').length;
  $('trDecideGo').click(); await sleep(150);
  ok('ปฏิเสธ: หน้าต่างให้กรอกเหตุผล · ไม่กรอกแล้วกด → ข้อความแดง ไม่เรียกฐาน หน้าต่างยังเปิด', dlgOpen('trDecideDlg') && /promo-oct\\.pdf/.test(txt('trDecideFile')) && !$('trDecideErr').hidden && /ต้องใส่เหตุผล/.test(txt('trDecideErr')) && rpcs('transfer_request_decide').length === dec0);
  $('trDecideNote').value = 'ยังไม่ใช่ไฟล์ที่ใช้ซ้ำ'; $('trDecideGo').click(); await sleep(450);
  const lr = lastRpc('transfer_request_decide');
  ok('กรอกเหตุผล → transfer_request_decide(approve = false, note) → หน้าต่างปิด · คำขอย้ายไปส่วน "ปิดแล้ว" แสดง "ปฏิเสธ" + เหตุผล + ผู้ตัดสิน', !dlgOpen('trDecideDlg') && lr.args.p_approve === false && lr.args.p_note === 'ยังไม่ใช่ไฟล์ที่ใช้ซ้ำ' && /ปฏิเสธ/.test(txt('trReqDone')) && /ยังไม่ใช่ไฟล์ที่ใช้ซ้ำ/.test(txt('trReqDone')) && /โดย TiBass/.test(txt('trReqDone')) && rq().length === 2, txt('trReqDone'));
  ok('ปฏิเสธแล้วไฟล์ยังไม่ถาวร (หมดอายุตามปกติ) · ตัวเลขข้างเมนูลดเป็น 2', TRN.files.find(f => f.id === prid).is_permanent === false && badge() === '2', badge());
  reqOf('endcredit.mp4').querySelector('[data-act="req-ok"]').click(); await sleep(450);
  ok('อนุมัติเก็บถาวร → ไม่ถามซ้ำ · transfer_request_decide(approve = true) · ไฟล์เป็นถาวร · ย้ายไปส่วนปิดแล้ว "อนุมัติแล้ว" · ตัวเลขข้างเมนู 1', lastRpc('transfer_request_decide').args.p_approve === true && TRN.files.find(f => f.file_name === 'endcredit.mp4').is_permanent === true && /อนุมัติแล้ว/.test(txt('trReqDone')) && /ตั้งเป็นไฟล์ถาวรแล้ว/.test(txt('toast')) && badge() === '1', badge());
  reqOf('memo.pdf').querySelector('[data-act="req-ok"]').click(); await sleep(100);
  const rm1 = TRN.removed.length;
  ok('อนุมัติ "ลบไฟล์ถาวร" → ถามยืนยัน (ลบทันที กู้คืนไม่ได้) ยังไม่เรียกฐานตัดสิน', $('confirmDialog').open && /กู้คืนไม่ได้/.test(txt('confirmBody')) && /Nui/.test(txt('confirmBody')) && TRN.files.find(f => f.id === 'f5').status === 'ready');
  $('confirmOkBtn').click(); await sleep(500);
  ok('ยืนยัน → ฐานลบไฟล์ → หน้าลบตัวไฟล์ในถังตามพาธที่ฐานส่งกลับ → mark_purged · ไฟล์หายจากรายการ · ตัวเลขข้างเมนูหาย', TRN.files.find(f => f.id === 'f5').status === 'deleted' && TRN.removed.length === rm1 + 1 && TRN.removed[rm1].paths[0] === 'doc/f5.bin' && !TRN.objects.has('doc/f5.bin') && !!TRN.files.find(f => f.id === 'f5').purged_at && !rowOf('f5') && badge() === '', badge());
  ok('ไม่มีแถบแดงตลอดการตัดสินคำขอ', !fatal());
  await relogin('nui'); await openPage();
  btn(prid, 'req-keep').click(); await sleep(400);
  tabBtn('req').click(); await sleep(100);
  ok('ผู้ดูแลขอใหม่ได้หลังถูกปฏิเสธ (คำขอใหม่แยกจากใบเดิม) · เห็นเหตุผลที่ถูกปฏิเสธในส่วนปิดแล้ว', /รอเจ้าของตัดสิน/.test(txt('trReqPending')) && /ยังไม่ใช่ไฟล์ที่ใช้ซ้ำ/.test(txt('trReqDone')));
  [...document.querySelectorAll('#trReqPending .tr-row')].find(r => /promo-oct\\.pdf/.test(r.textContent)).querySelector('[data-act="req-wd"]').click(); await sleep(400);
  tabBtn('files').click(); await sleep(50);
  ok('ถอนคำขอ → transfer_request_withdraw → "ผู้ขอถอนแล้ว" · ไม่มีรายการรอตัดสิน · ปุ่ม "ขอเก็บถาวร" กลับมาที่แถวไฟล์', !!lastRpc('transfer_request_withdraw') && /ผู้ขอถอนแล้ว/.test(txt('trReqDone')) && /ไม่มีคำขอที่รอตัดสิน/.test(txt('trReqPending')) && !!btn(prid, 'req-keep'));
  btn(prid, 'req-keep').click(); await sleep(400);
  TRN.files.find(f => f.id === prid).expires_at = new Date(Date.now() - 1000).toISOString();         // ไฟล์หมดอายุก่อนเจ้าของตัดสิน
  await relogin('tibass'); await openPage(); tabBtn('req').click(); await sleep(100);
  const dec1 = rpcs('transfer_request_decide').length;
  const pending2 = document.querySelectorAll('#trReqPending [data-act="req-ok"]').length;
  ok('ไฟล์ที่หมดอายุแล้วแต่ยังไม่ถูกกวาด: คำขอของมันไม่ค้างในรายการรอตัดสิน (ถูก void ตอนกวาด)', pending2 === 0 && TRN.reqs.filter(q => q.file_id === prid).every(q => q.status !== 'pending'), pending2 + ' ' + JSON.stringify(TRN.reqs.filter(q => q.file_id === prid).map(q => q.status)));
  ok('ตัวเลขข้างเมนูของเจ้าของไม่นับคำขอของไฟล์ที่ตายแล้ว', badge() === '', badge());
  ok('ไม่มีปุ่มตัดสินที่ใช้ไม่ได้ (ไม่เรียกฐานโดยไม่จำเป็น)', rpcs('transfer_request_decide').length === dec1);

  // ── 16. ยังไม่รัน migration 050 (รันแค่ 049) ──
  await relogin('zen'); TRN.v1 = true; await openPage();
  ok('ยังไม่รัน 050 → แถบเหลืองบอกให้รัน 050 (ไม่ใช่แดง ไม่มี error บนจอ) · รายการไฟล์ยังขึ้นตามปกติ', /migration 050/.test(txt('trAlert')) && !!document.querySelector('#trAlert .alert-warn') && !document.querySelector('#trAlert .alert-red') && !fatal() && rows().length > 0, txt('trAlert'));
  ok('...ถามฐานด้วยคอลัมน์ของ 050 ก่อน ล้มแล้วถอยไปคอลัมน์ของ 049 (ไม่ล้างจอเปล่า)', CALLS.some(c => c.op === 'select' && c.table === 'transfer_files' && /thumb/.test(c.cols)) && CALLS.filter(c => c.op === 'select' && c.table === 'transfer_files' && !/thumb/.test(c.cols)).length > 0);
  const v1d = { reqTabHidden: $('trReqTab').hidden, btns: [...document.querySelectorAll('#trList [data-act="tags"], #trList [data-act="pin"], #trList [data-act="unpin"], #trList [data-act="req-keep"], #trList [data-act="req-del"]')].map(b => b.dataset.act), to: /ถึง:/.test(txt('trList')), perm: /ถาวร · Asset/.test(txt('trList')) };
  ok('...ซ่อนของ 050 ทั้งหมด: แท็บคำขอ · ปุ่มแก้ Tag/ถาวร/ขอ · ป้าย "ถึง:" · ป้ายถาวร', v1d.reqTabHidden && !v1d.btns.length && !v1d.to && !v1d.perm, JSON.stringify(v1d));
  await stage([mkFile('v1-plain.mp4', 'video/mp4'), await makePng(120, 80, 'v1-photo.png')]); await sleep(300);
  ok('...รอยืนยันไม่มีช่อง Tag/ถาวร', $('trTagField').hidden && $('trKeepField').hidden);
  await go();
  const v1b = rpcs('transfer_begin').slice(-2), v1c = rpcs('transfer_commit').slice(-2);
  ok('...อัปโหลดแบบเดิมยังใช้ได้ครบ: begin/commit ไม่ส่งพารามิเตอร์ของ 050 (p_tags · p_keep · p_thumb) — ไม่ชนฟังก์ชันเดิม · ไฟล์ขึ้นรายการ · ไม่มีแถบแดง', v1b.every(c => !('p_tags' in c.args) && !('p_keep' in c.args)) && v1c.every(c => !('p_thumb' in c.args)) && !!fileRow('v1-plain.mp4') && !!fileRow('v1-photo.png') && !fatal(), fatal() && fatal().textContent);
  clearQ();
  btn(fid('v1-plain.mp4'), 'delete').click(); await sleep(100); $('confirmOkBtn').click(); await sleep(450);
  ok('...ลบ/เปิดดูใช้ได้ตามเดิม', !rowOf(fid('v1-plain.mp4')) && !fatal());
  TRN.v1 = false; await reload();
  ok('รัน 050 แล้วกดรีเฟรช → ของ 050 กลับมาครบ (แถบเหลืองหาย · แท็บคำขอ · ป้าย Tag)', !/migration 050/.test(txt('trAlert')) && !$('trReqTab').hidden && /ถึง:/.test(txt('trList')));

  // ── 17. ออกจากระบบ/สลับบัญชี ──
  ok('ทุกการเขียนผ่านฟังก์ชัน transfer_* — ไม่มี insert/update/delete ตารางตรง ๆ', TRN.writes.length === 0 && CALLS.every(c => !(['insert', 'update', 'delete', 'upsert'].indexOf(c.op) >= 0 && /^transfer_/.test(c.table || ''))));
  await stage([mkFile('left-in-stage.mp3', 'audio/mpeg')]); tr.stageTags = ['u3']; tr.stageKeep = true;
  onAccountSwitched(); await sleep(100);
  ok('สลับบัญชี → รายการ ประวัติ คำขอ คิว และไฟล์รอยืนยันถูกล้าง (ไม่ค้างให้อีกคนเห็น) · ตัวเลือก Tag/ถาวรถูกรีเซ็ต', rows().length === 0 && txt('trList') === '' && txt('trLog') === '' && txt('trReqPending') === '' && tr.files.length === 0 && tr.events.length === 0 && tr.reqs.length === 0 && tr.queue.length === 0 && tr.stage.length === 0 && $('trStage').hidden && tr.stageTags.length === 0 && tr.stageKeep === false && $('trNote').value === '');
  await openPage();
  ok('เปิดหน้าอีกครั้งหลังสลับ → โหลดใหม่ตามสิทธิ์ของบัญชีปัจจุบัน', rows().length > 0);
  let rel; TRN.gateSelect = new Promise(r => { rel = r; });
  loadTransfer(); await sleep(100);
  doLogout(); await sleep(500);
  rel(); TRN.gateSelect = null; await sleep(300);
  ok('ออกจากระบบ: DOM ของหน้านี้ว่างเปล่า ไม่มีชื่อไฟล์/ชื่อคนค้างอยู่ · ตัวเลขข้างเมนูหาย', !/mix-oct|memo\\.pdf|คลิปรีวิว|Zen|Nutty|Nui|tagme/.test($('sec-transfer').textContent.replace(/ความเคลื่อนไหว/g, '')) && rows().length === 0 && txt('trLog') === '' && badge() === '');
  ok('ผลโหลดที่มาถึงทีหลังการออกจากระบบถูกทิ้ง (ไม่วาดทับหน้าที่ล้างแล้ว)', rows().length === 0 && tr.files.length === 0 && tr.loaded === false);
  await login('zen'); await openPage();
  TRN.gateUpload = new Promise(r => { gate = r; }); const cm0 = rpcs('transfer_commit').length;
  await stage([mkFile('late.mp3', 'audio/mpeg')]); $('trConfirm').click(); await sleep(300);
  doLogout(); await sleep(500);
  gate(); TRN.gateUpload = null; await sleep(400);
  ok('ออกจากระบบกลางการอัปโหลดแบบธรรมดา → ไม่ commit ในนามคนอื่น · คิวถูกทิ้ง', rpcs('transfer_commit').length === cm0 && tr.queue.length === 0 && txt('trQueue') === '');
  await login('zen'); await openPage();
  TRN.tus = { mode: 'hang', body: '' }; const ta1 = TRN.tusAborts.length, cm1b = rpcs('transfer_commit').length;
  await stage([new File([new Uint8Array(7 * MB)], 'tus-logout.mp4', { type: 'video/mp4' })]); $('trConfirm').click(); await sleep(500);
  doLogout(); await sleep(500);
  ok('ออกจากระบบกลางการส่งด้วย tus → สั่งหยุด tus ที่ค้างอยู่ (abort) · ไม่ commit · คิวถูกทิ้ง', TRN.tusAborts.length === ta1 + 1 && rpcs('transfer_commit').length === cm1b && tr.queue.length === 0);
  done();
}
function done() {
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

const net = '--host-resolver-rules=MAP * ~NOTFOUND';
const res = await runCdpPage({ root: pageRoot, file: 'desk.html', mock: MOCK3 + TRANSFER_MOCK, tests: TESTS, width: 1440, height: 900, coarse: false, flags: [net] });
console.log('\n=== desk-transfer: ' + (res.ok ? 'ผ่าน' : 'ไม่ผ่านหรือไม่ได้รันจนจบ') + ' ===');
process.exit(res.ok ? 0 : 1);
