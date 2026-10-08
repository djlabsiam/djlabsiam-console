/**
 * เทสต์หมวด "โอนไฟล์" ของ desk.html (#transfer · Alt+U · migration 049) — ถังโอนถ่ายไฟล์ภายในร้าน
 *   รัน: node tests/desk-transfer.mjs      (TRANSFER_ROOT=<โฟลเดอร์ที่มี desk.html ฉบับอื่น> ใช้ทำ mutation)
 *
 * ฐานข้อมูล + Storage ปลอม (tests/lib/transfer-mock.mjs) จำลองกติกาของ 049: ตารางอ่านอย่างเดียว · เขียนผ่านฟังก์ชัน transfer_* เท่านั้น ·
 * อัปโหลดได้เฉพาะพาธที่ transfer_begin ออกให้ · เปิด/โหลดต้องผ่าน transfer_open · ลบได้เฉพาะผู้อัปโหลดหรือเจ้าของ · ครบ 30 วันถูกกวาด
 * (ตัวจริงของ SQL ตรวจกับ Postgres จริงแยกไว้ — ชุดนี้ตรวจฝั่งหน้าเว็บ: ลำดับการเรียก ผลบนจอ ข้อความบอกผู้ใช้ ความปลอดภัยของ DOM)
 *
 * หมายเหตุ: ไม่มีตัวบอกความคืบหน้าอัปโหลด (fetch ไม่มี progress) — หน้าบอกสถานะ "กำลังอัปโหลด…" เป็นคำ
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
const logRows = () => [...document.querySelectorAll('#trLog .tr-ev')].map(e => e.textContent.replace(/\\s+/g, ' ').trim());
const idle = async () => { for (let i = 0; i < 150 && tr.uploading; i++) await sleep(30); await sleep(120); };
const mkFile = (name, type, body) => new File([body === undefined ? 'data-' + name : body], name, { type: type });
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
const openPage = async () => { showSection('transfer'); await sleep(450); };

async function runTests() {
  L('=== โอนไฟล์ (#transfer · migration 049): เมนู · กลุ่มไฟล์ · อัปโหลด · เปิด/โหลด · ลบ · ประวัติ · เก็บกวาด · ล้างเมื่อออกจากระบบ ===');
  TRN.seed();

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
  ok('ชิปกลุ่มมีจำนวนและคำกำกับ: ทั้งหมด 9 · วิดีโอ 2 · เอกสาร 1', [...document.querySelectorAll('#trChips .tr-chip')].map(c => c.textContent.replace(/\\s+/g, ' ').trim()).join('|') === 'ทั้งหมด 9|วิดีโอ 2|เสียง 1|รูปภาพ 2|งานดีไซน์ 1|เอกสาร 1|ไฟล์บีบอัด 1|อื่น ๆ 1');
  ok('หัวกลุ่มมีคำอังกฤษกำกับ (VDO / AUDIO / PHOTO / DOC)', /VDO/.test(txt('trList')) && /AUDIO/.test(txt('trList')) && /PHOTO/.test(txt('trList')) && /DOC/.test(txt('trList')));
  ok('ป้ายเวลาที่เหลือเป็นคำ: 10 วัน = "เหลือ 10 วัน" · 2 วัน = "เหลือ 2 วัน · ใกล้หมดอายุ" (แดง)', /เหลือ 10 วัน/.test(rowOf('f1').textContent) && !/ใกล้หมดอายุ/.test(rowOf('f1').textContent) && /เหลือ 2 วัน · ใกล้หมดอายุ/.test(rowOf('f3').textContent) && rowOf('f3').querySelector('.st-bad'));
  ok('แถวแสดงขนาด ผู้อัปโหลด หมายเหตุ ตามจริง', /120\\.0 MB/.test(rowOf('f1').textContent) && /ลงโดย Zen/.test(rowOf('f1').textContent) && /หมายเหตุ: ตัดต่อรอบสุดท้าย/.test(rowOf('f1').textContent));
  ok('ปุ่ม "เปิดดู" มีเฉพาะไฟล์ที่เบราว์เซอร์เปิดได้ (วิดีโอ เสียง รูป PDF) — SVG · zip · psd · อื่น ๆ โหลดอย่างเดียว', ['f1', 'f2', 'f3', 'f5', 'f9'].every(i => btn(i, 'view')) && ['f4', 'f6', 'f7', 'f8'].every(i => !btn(i, 'view') && btn(i, 'download')));
  ok('ทุกแถวมีปุ่ม "ดาวน์โหลด" และ "ประวัติ"', rows().every(r => r.querySelector('[data-act="download"]') && r.querySelector('[data-act="hist"]')));
  // ความปลอดภัยของ DOM: ชื่อไฟล์/หมายเหตุ/ชื่อคน มาจากผู้ใช้
  ok('ชื่อไฟล์ที่เป็น HTML แสดงเป็นข้อความ ไม่รันสคริปต์ ไม่สร้างแท็กจริง', window.XSS === undefined && rowOf('f9').querySelector('.tr-name').textContent === '<img src=x onerror=window.XSS=1>.mp4' && !rowOf('f9').querySelector('img'));
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
  $('trMine').checked = false; $('trMine').dispatchEvent(new Event('change', { bubbles: true })); await sleep(50);
  ok('เอาตัวกรองออก → กลับมา 9 ไฟล์', rows().length === 9);

  // ── 4. สิทธิ์ลบ (ปุ่มตามตำแหน่ง · ฐานบังคับซ้ำ) ──
  ok('พนักงาน (Zen) เห็นปุ่ม "ลบ" เฉพาะไฟล์ที่ตัวเองอัปโหลด', deletable() === 'f1,f3,f7', deletable());
  await relogin('nui'); await openPage();
  ok('ผู้ดูแล (Nui) เห็นปุ่ม "ลบ" เฉพาะไฟล์ของตัวเอง — ลบของคนอื่นไม่ได้ (ต่างจากเจ้าของ)', deletable() === 'f6', deletable());
  await relogin('tibass'); await openPage();
  ok('เจ้าของร้าน (TiBass) เห็นปุ่ม "ลบ" ทุกไฟล์', deletable() === ids().sort().join(), deletable());

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
  POP.blocked = true; btn('f2', 'view').click(); await sleep(300);
  ok('เบราว์เซอร์บล็อกป๊อปอัป → แจ้งให้อนุญาตแล้วกดใหม่ (ไม่เงียบ ไม่ error)', /บล็อก/.test(txt('toast')) && !fatal());
  POP.blocked = false;
  // ไฟล์เปิดไม่ได้ (ถูกลบ/ครบอายุ ระหว่างที่หน้าเปิดค้าง)
  const f4row = TRN.files.find(f => f.id === 'f4'); f4row.expires_at = new Date(Date.now() - 1000).toISOString();
  const n0 = CALLS.filter(c => c.op === 'select' && c.table === 'transfer_files').length, pop0 = POP.opened.length;
  btn('f4', 'download').click(); await sleep(450);
  ok('ไฟล์ที่ฐานปฏิเสธการเปิด → แถบแดงบอกเหตุเป็นไทย + ดึงรายการใหม่ (ไฟล์หายจากรายการ)', !!fatal() && /เปิดไม่ได้แล้ว/.test(fatal().textContent) && !rowOf('f4') && CALLS.filter(c => c.op === 'select' && c.table === 'transfer_files').length > n0);
  clearFatal();
  btn('f2', 'view').click(); TRN.fail.sign = true; await sleep(0);
  await sleep(300);
  ok('ขอลิงก์ไม่สำเร็จ → แถบแดง และปิดแท็บเปล่าที่เปิดไว้', !!fatal() && POP.opened[POP.opened.length - 1].closed === true);
  TRN.fail.sign = false; clearFatal();

  // ── 6. ประวัติ (ความเคลื่อนไหว) ──
  document.querySelector('#trTabs .mail-tab[data-tab="log"]').click(); await sleep(100);
  ok('แท็บ "ความเคลื่อนไหว" แสดงประวัติ และซ่อนรายการไฟล์', !$('trLogPane').hidden && $('trFilesPane').hidden && document.querySelector('#trTabs .mail-tab[data-tab="log"]').getAttribute('aria-selected') === 'true');
  const L1 = logRows();
  ok('ประวัติบอก ใคร · ทำอะไร (เป็นคำ) · ไฟล์ไหน — Zen เปิดดู คลิปรีวิว FLX4.mp4', L1.some(r => /Zen/.test(r) && /เปิดดู/.test(r) && /คลิปรีวิว FLX4\\.mp4/.test(r)), L1.slice(0, 3).join(' / '));
  ok('ประวัติมีทั้ง อัปโหลด · เปิดดู · ดาวน์โหลด · ลบ ครบ', ['อัปโหลด', 'เปิดดู', 'ดาวน์โหลด', 'ลบ'].every(w => L1.some(r => r.indexOf(w) >= 0)));
  ok('ประวัติไฟล์ที่ลบแล้ว (deleted-by-zen.mp3) ยังอยู่ พร้อมชื่อไฟล์', L1.some(r => /Zen/.test(r) && /ลบ/.test(r) && /deleted-by-zen\\.mp3/.test(r)));
  ok('ไฟล์ครบ 30 วันที่ระบบลบ = ผู้ทำ "ระบบ" + คำว่า "ครบ 30 วัน"', L1.some(r => /ระบบ/.test(r) && /ครบ 30 วัน/.test(r) && /expired-photo\\.jpg/.test(r)), L1.join(' / '));
  ok('ชื่อไฟล์/ชื่อคนที่เป็น HTML ในประวัติแสดงเป็นข้อความ', window.XSS === undefined && !document.querySelector('#trLog img, #trLog script, #trLog b'));
  $('trEvAct').value = 'view'; $('trEvAct').dispatchEvent(new Event('change', { bubbles: true })); await sleep(250);
  ok('กรอง "เปิดดู" → ถามฐานด้วย kind = view และเห็นเฉพาะแถวเปิดดู', CALLS.some(c => c.op === 'select' && c.table === 'transfer_events' && c.where.some(w => w[0] === 'kind' && w[1] === 'view')) && logRows().length > 0 && logRows().every(r => /เปิดดู/.test(r)));
  $('trEvAct').value = ''; $('trEvAct').dispatchEvent(new Event('change', { bubbles: true })); await sleep(250);
  $('trEvSearch').value = 'Nutty'; $('trEvSearch').dispatchEvent(new Event('input', { bubbles: true })); await sleep(80);
  ok('ค้นชื่อคนในประวัติ "Nutty" → เห็นเฉพาะแถวของ Nutty', logRows().length > 0 && logRows().every(r => /Nutty/.test(r)));
  $('trEvSearch').value = ''; $('trEvSearch').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#trTabs .mail-tab[data-tab="files"]').click(); await sleep(50);
  btn('f1', 'hist').click(); await sleep(300);
  ok('ปุ่ม "ประวัติ" ของไฟล์ → ไปแท็บความเคลื่อนไหว ถามฐานด้วย file_id ของไฟล์นั้น เห็นเฉพาะไฟล์นั้น', !$('trLogPane').hidden && CALLS.some(c => c.op === 'select' && c.table === 'transfer_events' && c.where.some(w => w[0] === 'file_id' && w[1] === 'f1')) && logRows().length >= 3 && logRows().every(r => /คลิปรีวิว FLX4\\.mp4/.test(r)) && /คลิปรีวิว FLX4/.test(txt('trEvFile')));
  document.querySelector('#trEvFile [data-act="ev-all"]').click(); await sleep(300);
  ok('"ดูประวัติทั้งหมด" → เลิกกรองไฟล์ เห็นประวัติของไฟล์อื่นด้วย', logRows().some(r => /memo\\.pdf/.test(r)) && txt('trEvFile') === '');
  // แบ่งหน้า 200 รายการ
  for (let i = 0; i < 440; i++) TRN.events.push({ id: 1000 + i, file_id: 'f2', kind: 'view', actor_id: 'u3', created_at: new Date(Date.now() - 86400000 * 3 - i * 1000).toISOString() });
  $('trReload').click(); await sleep(450);
  ok('ประวัติเกิน 200 รายการ → โหลดทีละ 200 มีปุ่ม "โหลดเพิ่ม"', logRows().length === 200 && !$('trLogMore').hidden, logRows().length);
  $('trLogMore').click(); await sleep(300);
  ok('โหลดเพิ่ม → ขอช่วง 200–399 ต่อท้าย ได้ 400 รายการ', logRows().length === 400 && CALLS.some(c => c.op === 'select' && c.table === 'transfer_events' && c.range[0] === 200 && c.range[1] === 399));
  $('trLogMore').click(); await sleep(300);
  ok('หน้าสุดท้าย (น้อยกว่า 200) → ปุ่ม "โหลดเพิ่ม" หายไป', logRows().length > 400 && $('trLogMore').hidden);
  TRN.events = TRN.events.filter(e => e.id < 1000);
  document.querySelector('#trTabs .mail-tab[data-tab="files"]').click();

  // ── 7. อัปโหลด ──
  $('trReload').click(); await sleep(450);
  const b0 = rpcs('transfer_begin').length;
  $('trNote').value = 'คลิปรีวิว รอบสอง';
  const f1 = mkFile('Live Set.mp4', 'video/mp4');
  Object.defineProperty($('trFile'), 'files', { value: [f1], configurable: true });
  $('trFile').dispatchEvent(new Event('change', { bubbles: true })); await idle();
  const call = rpcs('transfer_begin')[b0];
  ok('อัปโหลดด้วยปุ่มเลือกไฟล์: transfer_begin ส่งชื่อ ชนิด ขนาด และหมายเหตุ', !!call && call.args.p_file_name === 'Live Set.mp4' && call.args.p_mime === 'video/mp4' && call.args.p_size === f1.size && call.args.p_note === 'คลิปรีวิว รอบสอง', JSON.stringify(call && call.args));
  const up = TRN.uploads[TRN.uploads.length - 1];
  ok('ไฟล์ขึ้นถังที่พาธที่ฐานออกให้ (video/…) · ชนิดตรงกลุ่ม · ไม่ใช้ upsert', !!up && /^video\\/n\\d+\\.mp4$/.test(up.path) && up.type === 'video/mp4' && up.upsert === false, JSON.stringify(up));
  const issued = TRN.files.find(f => f.object_path === up.path);
  ok('ลำดับ: begin → upload → commit ด้วยรหัสรายการที่ฐานออกให้ (commit สำเร็จได้ก็ต่อเมื่อไฟล์ขึ้นถังแล้ว)', !!issued && lastRpc('transfer_commit').args.p_id === issued.id && issued.status === 'ready' && TRN.objects.has(up.path));
  ok('หลังอัปโหลด: ไฟล์ใหม่อยู่ในกลุ่มวิดีโอ มีหมายเหตุ และเริ่มนับ 30 วัน', !!document.querySelector('#trList .tr-row .tr-name') && rows().some(r => /Live Set\\.mp4/.test(r.textContent) && /หมายเหตุ: คลิปรีวิว รอบสอง/.test(r.textContent) && /เหลือ 30 วัน/.test(r.textContent)));
  ok('คิวแสดง "อัปโหลดแล้ว" + กลุ่มที่เก็บ · ช่องหมายเหตุถูกล้าง (ชุดถัดไปไม่เผลอใช้ซ้ำ) · มีประวัติ "อัปโหลด" โดย Zen', /อัปโหลดแล้ว/.test(txt('trQueue')) && /เก็บในกลุ่ม วิดีโอ/.test(txt('trQueue')) && $('trNote').value === '' && TRN.events.some(e => e.kind === 'upload' && e.actor_id === 'u2' && TRN.files.find(f => f.id === e.file_id).file_name === 'Live Set.mp4'));
  ok('ปุ่มไม่ส่งซ้ำ/ไม่มีข้อผิดพลาดแดง', !fatal());
  // หลายไฟล์ + ลากวาง + ชนิดไม่ตรง
  const dropA = mkFile('mix.wav', 'audio/wav'), dropB = mkFile('evil.png', 'text/html', '<script>alert(1)<\\/script>'), dropC = mkFile('notes', 'application/octet-stream');
  drop([dropA, dropB, dropC]); await idle();
  const ups = TRN.uploads.slice(-3);
  ok('ลากวางหลายไฟล์ → อัปทีละไฟล์ตามลำดับ ทั้ง 3 ไฟล์', ups.length === 3 && /^audio\\//.test(ups[0].path) && /^photo\\//.test(ups[1].path) && /^other\\//.test(ups[2].path), JSON.stringify(ups.map(u => u.path)));
  ok('ชนิดไฟล์ที่ส่งขึ้นถัง: ชื่อ .png ที่ประกาศเป็น text/html ถูกบังคับเป็น octet-stream (กันถูกเปิดเป็นเว็บ) · wav ได้ audio/wav', ups[0].type === 'audio/wav' && ups[1].type === 'application/octet-stream' && ups[2].type === 'application/octet-stream', JSON.stringify(ups.map(u => u.type)));
  ok('ชิปกลุ่มนับไฟล์ใหม่ (เสียง 2 · รูปภาพ 2 · อื่น ๆ 2)', /เสียง 2/.test(txt('trChips')) && /รูปภาพ 2/.test(txt('trChips')) && /อื่น ๆ 2/.test(txt('trChips')), txt('trChips'));
  ok('trSafeType: SVG / html / ชนิดไม่ตรงกลุ่ม = octet-stream · pdf และสื่อจริงคงชนิดเดิม', trSafeType('photo', 'a.svg', 'image/svg+xml') === 'application/octet-stream' && trSafeType('other', 'a.html', 'text/html') === 'application/octet-stream'
    && trSafeType('doc', 'a.pdf', 'application/pdf') === 'application/pdf' && trSafeType('video', 'a.mp4', 'video/mp4') === 'video/mp4' && trSafeType('audio', 'a.mp3', 'video/mp4') === 'application/octet-stream');
  // ไฟล์ที่ไม่ควรผ่าน
  const rb = rpcs('transfer_begin').length;
  const big = mkFile('huge.mov', 'video/quicktime'); Object.defineProperty(big, 'size', { value: 600 * 1048576 });
  drop([big, mkFile('empty.txt', 'text/plain', '')]); await idle();
  ok('ไฟล์ใหญ่เกิน 500 MB และไฟล์ว่าง ถูกปฏิเสธที่หน้า พร้อมเหตุ · ไม่เรียกฐาน', rpcs('transfer_begin').length === rb && /ใหญ่เกิน 500\\.0 MB/.test(txt('trQueue')) && /ว่างเปล่า/.test(txt('trQueue')), txt('trQueue'));
  document.querySelector('#trQueue [data-act="q-clear"]').click(); await sleep(50);
  ok('"ล้างรายการที่เสร็จแล้ว" เคลียร์คิว', txt('trQueue') === '');
  // ล้มเหลว
  TRN.fail.rpc_transfer_begin = 'ไฟล์ใหญ่เกิน 20 MB (ไฟล์นี้ 30 MB)'; const ub = TRN.uploads.length;
  drop([mkFile('a.mp4', 'video/mp4')]); await idle();
  ok('ฐานปฏิเสธตอนขอพื้นที่ → ไม่อัปโหลด · แถบแดงบนจอ + บอกเหตุในคิว (ข้อความไทยของฐานตามจริง)', TRN.uploads.length === ub && !!fatal() && /ใหญ่เกิน 20 MB/.test(fatal().textContent) && /ไม่สำเร็จ/.test(txt('trQueue')) && /ใหญ่เกิน 20 MB/.test(txt('trQueue')));
  clearFatal(); delete TRN.fail.rpc_transfer_begin;
  TRN.fail.upload = 'Payload too large'; const ab = rpcs('transfer_abort').length, cb = rpcs('transfer_commit').length;
  drop([mkFile('b.mp4', 'video/mp4')]); await idle();
  ok('อัปโหลดขึ้นถังไม่สำเร็จ → ไม่ commit · ยกเลิกรายการที่ขอไว้ (transfer_abort) · แถบแดงบอกเรื่องขนาดไฟล์', rpcs('transfer_commit').length === cb && rpcs('transfer_abort').length === ab + 1 && !!fatal() && /ใหญ่เกินที่ระบบเก็บไฟล์รับได้/.test(fatal().textContent), fatal() && fatal().textContent);
  clearFatal(); delete TRN.fail.upload;
  TRN.fail.rpc_transfer_commit = 'ไม่พบไฟล์ในที่เก็บ — การอัปโหลดไม่สำเร็จ'; const ab2 = rpcs('transfer_abort').length;
  drop([mkFile('c.mp4', 'video/mp4')]); await idle();
  ok('commit ไม่สำเร็จ → ยกเลิกรายการ (abort) · ไม่ขึ้นว่าสำเร็จ', rpcs('transfer_abort').length === ab2 + 1 && /ไม่สำเร็จ/.test(txt('trQueue')) && !!fatal());
  clearFatal(); delete TRN.fail.rpc_transfer_commit;
  document.querySelector('#trQueue [data-act="q-clear"]').click();
  // ไฟล์ติดกันต้องทีละไฟล์
  let gate; TRN.gateUpload = new Promise(r => { gate = r; }); const sb = rpcs('transfer_begin').length;
  drop([mkFile('s1.mp3', 'audio/mpeg'), mkFile('s2.mp3', 'audio/mpeg')]); await sleep(300);
  ok('ไฟล์แรกยังอัปโหลดไม่เสร็จ → ไฟล์ที่สองยังไม่ขอพื้นที่ (ทีละไฟล์) · คิวบอก "กำลังอัปโหลด…" และ "รอคิว"', rpcs('transfer_begin').length === sb + 1 && /กำลังอัปโหลด…/.test(txt('trQueue')) && /รอคิว/.test(txt('trQueue')));
  gate(); TRN.gateUpload = null; await idle();
  ok('ปล่อยไฟล์แรกแล้ว ไฟล์ที่สองตามมา — ทั้งคู่สำเร็จ', rpcs('transfer_begin').length === sb + 2 && (txt('trQueue').match(/อัปโหลดแล้ว/g) || []).length >= 2);
  document.querySelector('#trQueue [data-act="q-clear"]').click();

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
  // ฐานปฏิเสธ (ไม่ใช่ผู้อัปโหลด / ไม่ใช่เจ้าของ)
  const nd = rpcs('transfer_delete').length;
  ok('ไฟล์ของคนอื่นไม่มีปุ่มลบ · เรียก trAskDelete ตรง ๆ ก็ไม่ถามยืนยัน', !btn('f2', 'delete') && (trAskDelete('f2'), !$('confirmDialog').open));
  await trDelete('f2'); await sleep(300);
  ok('บังคับเรียกลบไฟล์ของคนอื่น → ฐานปฏิเสธ แถบแดงบอกเหตุ ไฟล์ยังอยู่ ตัวไฟล์ในถังยังอยู่', rpcs('transfer_delete').length === nd + 1 && !!fatal() && /เฉพาะคนที่อัปโหลด/.test(fatal().textContent) && !!rowOf('f2') && TRN.objects.has('audio/f2.bin'));
  clearFatal();
  // ลบแล้วตัวไฟล์ลบไม่สำเร็จ → ไม่ถือว่าล้มเหลว (กวาดรอบหน้า)
  TRN.fail.remove = 'storage down'; btn('f7', 'delete').click(); await sleep(100); $('confirmOkBtn').click(); await sleep(450);
  ok('ลบตัวไฟล์ในถังไม่สำเร็จ → รายการถูกลบแล้ว (ทุกคนเปิดไม่ได้) · บอกว่าตัวไฟล์จะถูกกวาดรอบหน้า ไม่ทำเป็นสำเร็จเงียบ ๆ', !rowOf('f7') && /เก็บกวาด/.test(txt('toast')) && !TRN.files.find(f => f.id === 'f7').purged_at && !fatal());
  delete TRN.fail.remove;
  await relogin('tibass'); await openPage();
  btn('f6', 'delete').click(); await sleep(100); $('confirmOkBtn').click(); await sleep(450);
  ok('เจ้าของร้านลบไฟล์ของคนอื่น (Nui) ได้ · ประวัติ "ลบ" โดย TiBass', !rowOf('f6') && TRN.events.some(e => e.file_id === 'f6' && e.kind === 'delete' && e.actor_id === 'u1'));

  // ── 9. เก็บกวาด ──
  await relogin('zen');
  TRN.seed(); TRN.files.find(f => f.id === 'fx').expires_at = new Date(Date.now() - 1000).toISOString();
  const sw0 = rpcs('transfer_sweep').length, rm0 = TRN.removed.length;
  await openPage(); await sleep(400);
  ok('เปิดหน้า → เรียก transfer_sweep หนึ่งครั้ง → ลบตัวไฟล์ที่ครบ 30 วัน/ที่ถูกลบ ทั้งชุดในถัง → แจ้งฐานว่าลบแล้ว', rpcs('transfer_sweep').length === sw0 + 1 && TRN.removed.length === rm0 + 1 && ['doc/fx.bin', 'photo/fe.bin', 'audio/fd.bin'].every(p => TRN.removed[TRN.removed.length - 1].paths.indexOf(p) >= 0) && !TRN.objects.has('doc/fx.bin') && !TRN.objects.has('photo/fe.bin') && !TRN.objects.has('audio/fd.bin'));
  ok('...ทุกแถวที่กวาดถูกทำเครื่องหมาย purged · fx กลายเป็น expired · มีประวัติ "ระบบ" ครบ 30 วัน', ['fx', 'fe', 'fd'].every(i => !!TRN.files.find(f => f.id === i).purged_at) && TRN.files.find(f => f.id === 'fx').status === 'expired' && TRN.events.some(e => e.file_id === 'fx' && e.kind === 'expire' && e.actor_id === null));
  ok('...รายการไฟล์ยังเหมือนเดิม (ไฟล์ที่หมดอายุไม่อยู่) · ไม่มีแถบแดง/เหลือง', groups().indexOf('เอกสาร:1') >= 0 && !fatal() && !document.querySelector('#trAlert .alert'));
  const sw1 = rpcs('transfer_sweep').length;
  TRN.fail.rpc_transfer_sweep = 'boom'; $('trReload').click(); await sleep(450);
  ok('กวาดไม่สำเร็จ → แถบเหลืองบอกตามจริง (ไม่ใช่แดง ไม่ขวางการใช้งาน) · รายการไฟล์ยังใช้ได้', rpcs('transfer_sweep').length === sw1 + 1 && /เก็บกวาดไฟล์ที่หมดอายุไม่สำเร็จ: boom/.test(txt('trAlert')) && !!document.querySelector('#trAlert .alert-warn') && !fatal() && rows().length > 0);
  delete TRN.fail.rpc_transfer_sweep;
  TRN.fail.select = 'connection reset'; $('trReload').click(); await sleep(450);
  ok('โหลดรายการไม่สำเร็จ → แถบแดงบอกเหตุ + แถบบนจอ · รายการเดิมที่โหลดไว้ยังอยู่ (ไม่ล้างจอเปล่า) · ไม่กวาดต่อ', /โหลดข้อมูลโอนไฟล์ไม่สำเร็จ: connection reset/.test(txt('trAlert')) && !!document.querySelector('#trAlert .alert-red') && !!fatal() && rows().length > 0 && rpcs('transfer_sweep').length === sw1 + 1);
  clearFatal(); delete TRN.fail.select;
  $('trReload').click(); await sleep(450);
  ok('กดรีเฟรชอีกครั้งสำเร็จ → แถบแดงหาย', txt('trAlert') === '' || !document.querySelector('#trAlert .alert-red'));

  // ── 10. ยังไม่รัน migration ──
  TRN.missing = true; const sw2 = rpcs('transfer_sweep').length;
  $('trReload').click(); await sleep(450);
  ok('ยังไม่รัน 049 → แถบเหลืองบอกให้รัน (ไม่ใช่ error แดง) · ซ่อนช่องอัปโหลด · ไม่เรียกฟังก์ชันเก็บกวาด', /migration 049/.test(txt('trAlert')) && !!document.querySelector('#trAlert .alert-warn') && !fatal() && $('trUpload').hidden && rpcs('transfer_sweep').length === sw2 && rows().length === 0);
  TRN.missing = false; $('trReload').click(); await sleep(450);
  ok('รันแล้วกดรีเฟรช → ใช้งานได้ปกติ ช่องอัปโหลดกลับมา', !$('trUpload').hidden && rows().length > 0 && txt('trAlert') === '');

  // ── 11. ออกจากระบบ/สลับบัญชี ──
  ok('ทุกการเขียนผ่านฟังก์ชัน transfer_* — ไม่มี insert/update/delete ตารางตรง ๆ', TRN.writes.length === 0 && CALLS.every(c => !(['insert', 'update', 'delete', 'upsert'].indexOf(c.op) >= 0 && /^transfer_/.test(c.table || ''))));
  onAccountSwitched(); await sleep(100);
  ok('สลับบัญชี → รายการ ประวัติ คิว ถูกล้าง (ไม่ค้างให้อีกคนเห็น)', rows().length === 0 && txt('trList') === '' && txt('trLog') === '' && tr.files.length === 0 && tr.events.length === 0 && tr.queue.length === 0 && $('trNote').value === '');
  await openPage();
  ok('เปิดหน้าอีกครั้งหลังสลับ → โหลดใหม่ตามสิทธิ์ของบัญชีปัจจุบัน', rows().length > 0);
  let rel; TRN.gateSelect = new Promise(r => { rel = r; });
  loadTransfer(); await sleep(100);
  doLogout(); await sleep(500);
  rel(); TRN.gateSelect = null; await sleep(300);
  ok('ออกจากระบบ: DOM ของหน้านี้ว่างเปล่า ไม่มีชื่อไฟล์/ชื่อคนค้างอยู่', !/mix-oct|memo\\.pdf|คลิปรีวิว|Zen|Nutty/.test($('sec-transfer').textContent.replace(/ความเคลื่อนไหว/g, '')) && rows().length === 0 && txt('trLog') === '');
  ok('ผลโหลดที่มาถึงทีหลังการออกจากระบบถูกทิ้ง (ไม่วาดทับหน้าที่ล้างแล้ว)', rows().length === 0 && tr.files.length === 0 && tr.loaded === false);
  // อัปโหลดค้างตอนออกจากระบบ
  await login('zen'); await openPage();
  TRN.gateUpload = new Promise(r => { gate = r; }); const cm0 = rpcs('transfer_commit').length;
  drop([mkFile('late.mp3', 'audio/mpeg')]); await sleep(300);
  doLogout(); await sleep(500);
  gate(); TRN.gateUpload = null; await sleep(400);
  ok('ออกจากระบบกลางการอัปโหลด → ไม่ commit ในนามคนอื่น · คิวถูกทิ้ง', rpcs('transfer_commit').length === cm0 && tr.queue.length === 0 && txt('trQueue') === '');
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
