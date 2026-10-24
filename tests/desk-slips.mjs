/**
 * เทสต์หน้าจอ "สลิปการชำระ" ของหมวดคอร์สเรียน (desk.html · migration 070 · แผน console-workspace/PLAN-course-sales-slips.md ส่วน B)
 *   รัน: node tests/desk-slips.mjs        ทีละหน้า: SLIPS_ONLY=<regex ชื่อหน้า>        ทำ mutation: SLIPS_ROOT=<โฟลเดอร์ที่มี desk.html ฉบับอื่น>
 *
 * สลิปอยู่หลังสวิตช์ window.DJLAB_SLIPS_ENABLED (หน้า 1–7 เปิดสวิตช์ · หน้า 8 ปิด = ต้องเหมือนเดิมทุกอย่าง ไม่แตะถังเลย)
 * ฐานปลอม tests/lib/teach-mock.mjs จำลอง RLS ของถัง course-slips + ฟังก์ชัน teach_payment_slip_set/clear/todo ตามกติกา 070 ·
 * ตัวจริงของ SQL/RLS ตรวจที่ console-workspace/sql-tests/test070.mjs (PGlite) — PGlite/ตัวปลอมไม่ใช่ Supabase Storage จริง
 *
 *  1. เจ้าของ: ช่องแนบ · ย่อรูป · ตรวจชนิดจากหัวไฟล์ · อัป→บันทึก · อัปล้ม · บันทึกล้ม · กดซ้ำ
 *  2. เจ้าของ: ดูสลิป · แนบให้แถวเดิม · ลบสลิป · ลบแถวที่มีสลิป · แถวคืนเงินไม่มีปุ่ม
 *  3. ฟอร์มลงเรียน (เจ้าของ): อัปหลังสร้างการลงเรียน · ลำดับ upload → record
 *  4. ผู้ดูแล: ดูได้ ลบสลิปไม่ได้ · ลบแถวแล้วไฟล์ค้างต้องบอกให้แจ้งเจ้าของ
 *  5. พนักงานทั่วไป: แนบได้ ดูไม่ได้ ไม่เห็นยอด · อัปนอกกติกาถูกปฏิเสธ · ยังไม่รัน 070
 *  6. พนักงานที่เป็นครู (Nutty): ดูสลิปของนักเรียนตัวเองได้ ของคนอื่นไม่ได้
 *  7. ความปลอดภัย: XSS ชื่อไฟล์ · ออกจากระบบ/สลับบัญชีล้างสถานะ · ไม่ฝัง URL ในหน้า · ยังไม่รัน 070 (เจ้าของ)
 *  8. สวิตช์ปิด: ไม่มีช่องแนบ ไม่เลือกคอลัมน์สลิป ไม่แตะถัง
 *  9. iPhone 390px
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HARNESS } from './lib/page-test.mjs';
import { runCdpPage } from './lib/cdp-page.mjs';
import { TEACH_MOCK } from './lib/teach-mock.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { MOCK: MOCK3 } = await import(pathToFileURL(join(root, 'tests/desk-home3.mjs')).href);
const ONLY = process.env.SLIPS_ONLY ? new RegExp(process.env.SLIPS_ONLY) : null;
const pageRoot = process.env.SLIPS_ROOT || root;

const COMMON = `
${HARNESS}
window.addEventListener('unhandledrejection', ev => { L('ข้อผิดพลาดที่ไม่ได้ดักในเทสต์: ' + (ev.reason && (ev.reason.stack || ev.reason.message) || ev.reason)); L('RESULT:FAIL'); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);
const E = $;
async function login(name) { $('loginEmail').value = name + '@x'; $('loginPassword').value = 'x'; await doLogin(); await sleep(500); }
async function logout() { await db.auth.signOut(); await sleep(400); }
const isRed = el => !!el && getComputedStyle(el).color === 'rgb(204, 0, 26)' && Number(getComputedStyle(el).fontWeight) >= 600;
const body = () => $('teBody');
const tab = n => { document.querySelector('#teTabs .mail-tab[data-tab="' + n + '"]').click(); };
const row = id => body().querySelector('.te-row[data-id="' + id + '"]');
const settle = ms => sleep(ms || 300);
async function openTeach() { showSection('teach'); await sleep(300); const t0 = Date.now(); while (!te.rows.length && Date.now() - t0 < 8000) await sleep(100); L('(โหลดรายการใช้เวลา ' + (Date.now() - t0 + 300) + ' ms, rows=' + te.rows.length + ')'); await sleep(200); }
const D = () => $('teDet');
const dt = () => D() ? D().textContent : '';
const J = o => JSON.stringify(o);
const dact = (a, extra) => { const b = D().querySelector('[data-act="' + a + '"]' + (extra || '')); if (!b) throw new Error('ไม่พบปุ่ม ' + a + (extra || '')); b.click(); };
const has = (a, extra) => !!D() && !!D().querySelector('[data-act="' + a + '"]' + (extra || ''));
const dfill = (name, v) => { const e = $('teD_' + name); if (!e) throw new Error('ไม่พบช่อง ' + name); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
const submit = k => dact('submit', '[data-k="' + k + '"]');
const openForm = (k, sid) => dact('open', '[data-k="' + k + '"]' + (sid ? '[data-sid="' + sid + '"]' : ''));
const rpcCalls = fn => CALLS.filter(c => c.op === 'rpc' && c.fn === fn);
const lastArgs = fn => { const l = rpcCalls(fn); return l.length ? l[l.length - 1].args : null; };
const detOk = () => (E('teDetOk') || {}).textContent || '';
const detErr = () => (E('teDetErr') || {}).textContent || '';
const detWarn = () => (E('teDetWarn') || {}).textContent || '';
async function openEnroll(tabName, id) { tab(tabName); await sleep(150); if (!row(id)) throw new Error('ไม่พบแถว ' + id + ' ในแท็บ ' + tabName + ' · te.rows=' + (te.rows || []).length + ' · fatal=' + (($('fatalError') || {}).textContent || '').slice(0, 200) + ' · body=' + body().textContent.slice(0, 200)); row(id).click(); await settle(500); }
const appText = () => ['detail', 'teBody', 'teEnrollBody'].map(id => ($(id) || {}).textContent || '').join(' ');      // เฉพาะข้อความของแอป (ไม่รวมสคริปต์เทสต์ที่ฝังในหน้า)
const attempts = () => CALLS.filter(c => c.op === 'storage.upload');            // ทุกครั้งที่ส่งไฟล์ (รวมที่ล้ม)
const uploads = () => attempts().filter(c => c.ok);                              // เฉพาะที่ถังรับจริง
const signs = () => CALLS.filter(c => c.op === 'storage.sign');
const removes = () => CALLS.filter(c => c.op === 'storage.remove');
const prow = pid => D().querySelector('.te-prow[data-pid="' + pid + '"]');
const hasBtn = (pid, act, extra) => !!prow(pid) && !!prow(pid).querySelector('[data-act="' + act + '"]' + (extra || ''));
const day = n => { const x = new Date(TODAY + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const clickBtn = (pid, act) => prow(pid).querySelector('[data-act="' + act + '"]').click();
const confirmOk = async () => { $('confirmOkBtn').click(); await settle(500); };
async function waitFor(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 3000)) { if (fn()) return true; await sleep(40); } return false; }

// ── ไฟล์ทดสอบ: รูปจริงจาก canvas (PNG) · PDF/ขยะ/HEIC แบบไบต์ล้วน ──
function pngFile(w, h, name) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.fillStyle = '#000'; x.font = Math.round(h / 12) + 'px sans-serif'; x.fillText('SLIP 1234.50', 40, Math.round(h / 4));
  for (let i = 0; i < 400; i++) { x.fillStyle = 'rgb(' + (i * 7 % 255) + ',' + (i * 13 % 255) + ',' + (i * 29 % 255) + ')'; x.fillRect((i * 37) % w, (i * 53) % h, 60, 8); }
  const url = c.toDataURL('image/png'), bin = atob(url.slice(url.indexOf(',') + 1)), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name || 'slip.png', { type: 'image/png' });
}
const bytesFile = (arr, name, type, pad) => { const b = new Uint8Array(Math.max(arr.length, pad || 0)); b.set(arr); return new File([b], name, { type: type || 'application/octet-stream' }); };
const pdfFile = (name, pad) => bytesFile([...'%PDF-1.4\\n'].map(c => c.charCodeAt(0)), name || 'slip.pdf', 'application/pdf', pad || 300);
async function pick(kind, file) {
  const inp = $('teSlipFile_' + kind); if (!inp) throw new Error('ไม่พบช่องเลือกไฟล์ ' + kind);
  const d = new DataTransfer(); d.items.add(file); inp.files = d.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
  await waitFor(() => !!$('teSlipSel_' + kind) || !!$('teSlipErr_' + kind), 4000); await sleep(80);
}
const imgSize = async blob => { try { const bm = await createImageBitmap(blob); return { w: bm.width, h: bm.height }; } catch (e) { return { w: 0, h: 0 }; } };
const tp = async f => { try { return await teSlipPrepare(f); } catch (e) { return { err: e.message, blob: new Blob([]), ext: '', type: '', pdf: false, bytes: 0 }; } };      // เตรียมไฟล์แบบไม่ throw
const la = fn => lastArgs(fn) || {};
const txt = id => (E(id) || {}).textContent || '';
const FAKEWIN = () => { const w = { closed: false, opener: 'x', _href: '', close() { this.closed = true; } }; Object.defineProperty(w, 'location', { value: { set href(v) { w._href = v; }, get href() { return w._href; } } }); return w; };
let OPENED = [];
window.open = function () { window.__openCount = (window.__openCount || 0) + 1; OPENED.push([...arguments]); return window.__nextWin === null ? null : (window.__nextWin = FAKEWIN()); };
`;

// ── 1. เจ้าของ: ช่องแนบ · ย่อรูป · ชนิดไฟล์ · อัป → บันทึก ──
const T1 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== สลิป (1/9): เจ้าของ — ช่องแนบ · ย่อรูป · ตรวจชนิดไฟล์ · อัปแล้วบันทึก ===');
  TEACH.seed();
  await login('TiBass');
  await openTeach();
  await openEnroll('active', 'e-active');
  const sel = CALLS.filter(c => c.op === 'select' && c.table === 'enrollment_payments');
  ok('สวิตช์เปิด: เลือกคอลัมน์ slip_path + request_id ของรายการชำระ', sel.some(c => /slip_path/.test(c.cols) && /request_id/.test(c.cols)), sel.map(c => c.cols).join('|'));
  ok('ข้อความความเป็นส่วนตัวแดงตัวหนา: เจ้าของ ผู้ดูแล ครูของนักเรียนเปิดดูได้ · พนักงานแนบได้แต่เปิดดูไม่ได้', isRed(E('teDetSlipNote')) && /เฉพาะเจ้าของ ผู้ดูแล และครูของนักเรียนคนนั้น/.test(txt('teDetSlipNote')) && /แนบได้แต่เปิดดูไม่ได้/.test(txt('teDetSlipNote')));
  ok('ไม่มีข้อความ "ยังไม่เปิดใช้" เมื่อสวิตช์เปิด', !/ยังไม่เปิดใช้/.test(dt()));
  ok('แถวชำระ p1: "ไม่มีสลิป" + ปุ่ม "แนบสลิป" · ไม่มีปุ่มดู/ลบ', /ไม่มีสลิป/.test(prow('p1').textContent) && hasBtn('p1', 'open') && !hasBtn('p1', 'slip-view') && !hasBtn('p1', 'slip-clear'));

  openForm('pay'); await settle(100);
  ok('ฟอร์มชำระมีช่องเลือกไฟล์สลิป (accept jpg/png/webp/pdf) + ข้อความความเป็นส่วนตัวแดงตัวหนา', !!E('teSlipFile_det') && /pdf/.test(E('teSlipFile_det').accept) && E('teSlipFile_det').type === 'file' && isRed(E('teSlipPrivacy_det')));
  ok('ช่องไฟล์ไม่ซ้ำ id กับช่องของฟอร์มลงเรียน (เปิดพร้อมกันได้)', document.querySelectorAll('[id^="teSlipFile_"]').length === 1);

  // ── ย่อรูปที่เครื่อง: ด้านยาว 1600px (สินค้า 800px) ──
  const big = pngFile(2400, 1500, 'สลิปใหญ่.png');
  const prep = await tp(big);
  const sz = await imgSize(prep.blob);
  ok('รูป 2400×1500 → ย่อเหลือด้านยาว 1600px (อ่านตัวเลขได้ ไม่ใช่ 800px)', Math.max(sz.w, sz.h) === 1600 && sz.w === 1600 && sz.h === 1000, J(sz));
  ok('ชนิดผลลัพธ์เป็น webp/jpeg · ไม่ใช่ PNG ใหญ่ · ขนาดไม่เกิน 5 MB', (prep.ext === 'webp' || prep.ext === 'jpg') && prep.blob.size > 0 && prep.blob.size < 5 * 1024 * 1024 && prep.blob.type.startsWith('image/'), prep.ext + ' ' + prep.blob.size);
  const small = await tp(pngFile(800, 500, 'เล็ก.png')); const ssz = await imgSize(small.blob);
  ok('รูปเล็กกว่า 1600px ไม่ถูกขยาย', ssz.w === 800 && ssz.h === 500, J(ssz));
  const pdf = await tp(pdfFile('ใบโอน.pdf', 2000));
  ok('PDF ไม่ถูกย่อ ส่งไฟล์เดิม · นามสกุล pdf', pdf.pdf === true && pdf.ext === 'pdf' && pdf.blob.size === 2000 && pdf.type === 'application/pdf');

  const toFile = (url, name, type) => { const bin = atob(url.slice(url.indexOf(',') + 1)), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return new File([b], name, { type }); };
  const cv = document.createElement('canvas'); cv.width = 400; cv.height = 300; cv.getContext('2d').fillRect(0, 0, 400, 300);
  const pj = await tp(toFile(cv.toDataURL('image/jpeg'), 'a.jpg', 'image/jpeg'));
  ok('JPEG จริงผ่านการตรวจหัวไฟล์และถูกย่อ/ส่งต่อ', pj.blob.size > 0 && pj.blob.type.startsWith('image/') && pj.pdf === false, pj.type);
  const wurl = cv.toDataURL('image/webp');
  if (wurl.startsWith('data:image/webp')) { const pw = await tp(toFile(wurl, 'a.webp', 'image/webp')); ok('WebP จริงผ่านการตรวจหัวไฟล์', pw.blob.size > 0 && pw.pdf === false); }
  const realShrink = shrinkPhoto;
  shrinkPhoto = async () => new Blob([new Uint8Array(6 * 1024 * 1024)], { type: 'image/webp' });
  let em = (await tp(pngFile(100, 100, 'o.png'))).err || '';
  ok('รูปหลังย่อยังเกิน 5 MB: ปฏิเสธ (ไม่ส่งไฟล์ที่ถังจะไม่รับ)', /ย่อยังใหญ่เกิน 5 MB/.test(em), em);
  shrinkPhoto = async () => new Blob([new Uint8Array(1000)], { type: 'image/jpeg' });
  const pjj = await tp(pngFile(100, 100, 'j.png'));
  ok('เบราว์เซอร์ย่อเป็น JPEG (WebP ไม่รองรับ) → นามสกุล jpg ชนิด image/jpeg', pjj.ext === 'jpg' && pjj.type === 'image/jpeg', pjj.ext + pjj.type);
  shrinkPhoto = realShrink;
  em = (await tp(bytesFile([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 'raw.png', 'image/png', 31 * 1024 * 1024))).err || '';
  ok('รูปดิบเกิน 30 MB: ปฏิเสธก่อนถอดรหัส (กันกินหน่วยความจำ)', /ใหญ่เกินไป/.test(em), em);
  const mapErr = async o => { TEACH.slipFail.upload = o; const p = await tp(pngFile(100, 100, 'm.png')); try { await teSlipUpload('e-active', 'rq-map', p); } catch (e) { return e.message; } finally { TEACH.slipFail = {}; } return ''; };
  ok('ถังตอบ 413: บอกว่าไฟล์ใหญ่เกิน 5 MB', /ไฟล์ใหญ่เกินที่ที่เก็บรับ/.test(await mapErr({ statusCode: 413, message: 'Payload too large' })));
  ok('ถังตอบ 409: บอกว่ามีไฟล์ชื่อนี้แล้ว ไม่ทับของเดิม', /มีไฟล์ชื่อนี้ในที่เก็บอยู่แล้ว/.test(await mapErr({ statusCode: 409, message: 'The resource already exists' })));
  ok('เน็ตหลุด (Failed to fetch): บอกให้ตรวจอินเทอร์เน็ต', /ตรวจอินเทอร์เน็ต/.test(await mapErr({ statusCode: 0, message: 'Failed to fetch' })));
  ok('ข้อผิดพลาดอื่น: ข้อความไทยกลาง ไม่โชว์ข้อความดิบ', /ที่เก็บไฟล์ไม่ยอมรับ/.test(await mapErr({ statusCode: 500, message: 'internal boom xyz' })) && !/xyz/.test(await mapErr({ statusCode: 500, message: 'internal boom xyz' })));
  ok('การลองข้างบนทั้งหมดไม่ทำให้ไฟล์ขึ้นถังจริง', Object.keys(TEACH.slipFiles).length === 0);

  // ── ตรวจชนิดจากหัวไฟล์ ไม่เชื่อนามสกุล/ชนิดที่เบราว์เซอร์บอก ──
  await pick('det', bytesFile([...'hello not an image'].map(c => c.charCodeAt(0)), 'evil.jpg', 'image/jpeg'));
  ok('ไฟล์ข้อความที่ตั้งชื่อ .jpg: ปฏิเสธ + ข้อความแดงตัวหนา · ไม่มีรายการไฟล์ที่เลือก', isRed(E('teSlipErr_det')) && /ไม่ใช่รูปหรือ PDF/.test(txt('teSlipErr_det')) && !E('teSlipSel_det'), (E('teSlipErr_det') || {}).textContent);
  await pick('det', bytesFile([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], 'photo.heic', 'image/heic', 200));
  ok('HEIC: ปฏิเสธ + บอกให้แชร์เป็น JPG', /HEIC/.test(txt('teSlipErr_det')) && !E('teSlipSel_det'));
  await pick('det', bytesFile([0x25, 0x50, 0x44, 0x46, 0x2D], 'huge.pdf', 'application/pdf', 5 * 1024 * 1024 + 10));
  ok('PDF เกิน 5 MB: ปฏิเสธ', /ใหญ่เกิน 5 MB/.test(txt('teSlipErr_det')) && !E('teSlipSel_det'));
  await pick('det', bytesFile([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 'broken.png', 'image/png', 64));
  ok('PNG เสีย (หัวถูกแต่ถอดรหัสไม่ได้): ข้อความไทยแดง ไม่ crash', isRed(E('teSlipErr_det')) && /[ก-๙]/.test(txt('teSlipErr_det')) && !E('teSlipSel_det'), (E('teSlipErr_det') || {}).textContent);
  ok('ยังไม่มีการอัปโหลดใด ๆ ขึ้นถัง (แค่เลือกไฟล์)', uploads().length === 0);

  // ── หัวไฟล์ PNG ต้องครบ 8 ไบต์ · ข้อผิดพลาดภาษาอังกฤษไม่หลุดถึงผู้ใช้ ──
  await pick('det', bytesFile([0x89, 0x50, 0, 0, 0, 0, 0, 0], 'fake.png', 'image/png', 64));
  ok('ไฟล์ที่ขึ้นต้นเหมือน PNG แค่ 2 ไบต์: ปฏิเสธ (ตรวจหัวไฟล์ครบ 8 ไบต์)', /ไม่ใช่รูปหรือ PDF/.test(txt('teSlipErr_det')) && !E('teSlipSel_det'), txt('teSlipErr_det'));
  const shrinkReal = shrinkPhoto;
  shrinkPhoto = async () => { throw new Error('weird english failure'); };
  await pick('det', pngFile(100, 100, 'e.png'));
  ok('ข้อผิดพลาดภาษาอังกฤษจากเบราว์เซอร์: แสดงข้อความไทยกลาง ไม่โชว์ข้อความดิบ', /เตรียมไฟล์สลิปไม่สำเร็จ/.test(txt('teSlipErr_det')) && !/weird/.test(txt('teSlipErr_det')), txt('teSlipErr_det'));
  shrinkPhoto = shrinkReal;
  const d800 = await shrinkPhoto(pngFile(2400, 1500, 'p.png')); const s800 = await imgSize(d800);
  ok('รูปสินค้า (shrinkPhoto เดิมไม่ส่งอาร์กิวเมนต์) ยังย่อเหลือด้านยาว 800px — ไม่ถูกสลิปเปลี่ยนค่าตั้งต้น', Math.max(s800.w, s800.h) === 800, J(s800));
  ok('ตรวจคำว่า "ไม่พบฟังก์ชัน 070" จากข้อความอย่างเดียว (ไม่มี code) ได้ · ข้อผิดพลาดสิทธิ์ไม่ใช่', teSlipMissing({ message: 'Could not find the function public.teach_payment_slip_set(p_payment, p_slip_path) in the schema cache' }) === true
    && teSlipMissing({ code: 'PGRST202' }) === true && teSlipMissing({ code: '42501', message: 'permission denied' }) === false && teSlipMissing(null) === false && teSlipMissing({ message: 'ฐานล่ม' }) === false);
  ok('เจ้าของ (เห็นรายการชำระอยู่แล้ว): ไม่เรียก teach_payment_slip_todo เลย', rpcCalls('teach_payment_slip_todo').length === 0);
  // ── ยกเลิกฟอร์ม / สลับฟอร์ม: ไฟล์ที่เลือกไว้ไม่ค้าง ──
  await pick('det', pngFile(300, 200, 'c.png'));
  dact('close-form'); await settle(100); openForm('pay'); await settle(100);
  ok('เลือกไฟล์แล้วกดยกเลิก เปิดฟอร์มชำระใหม่: ไม่มีไฟล์ค้าง', !E('teSlipSel_det') && !!E('teSlipFile_det'));
  await pick('det', pngFile(300, 200, 'd.png'));
  prow('p1').querySelector('[data-k="slipatt"]').click(); await settle(120);
  ok('เลือกไฟล์ในฟอร์มชำระแล้วสลับไปฟอร์มแนบสลิปของแถว: ไฟล์เดิมไม่ติดไปด้วย', !!E('teFormSlipAtt') && !E('teSlipSel_det') && !!E('teSlipFile_det'));
  dact('close-form'); await settle(100); openForm('pay'); await settle(100);

  // ── อัปล้ม = ไม่บันทึกชำระ ──
  await pick('det', pngFile(2000, 1200, 'สลิปโอน.png'));
  ok('เลือกรูปแล้ว: แสดงชื่อ · ขนาด · (ย่อแล้ว) · ปุ่มเอาออก', !!E('teSlipSel_det') && /สลิปโอน\\.png/.test(txt('teSlipSel_det')) && /ย่อแล้ว/.test(txt('teSlipSel_det')) && !!E('teSlipSel_det').querySelector('[data-act="slip-rm"]'));
  ((E('teSlipSel_det') || document.body).querySelector('[data-act="slip-rm"]') || { click() {} }).click(); await settle(100);
  ok('กด "เอาออก": รายการที่เลือกหาย · ช่องเลือกไฟล์กลับมา', !E('teSlipSel_det') && !!E('teSlipFile_det') && te.det.slip === null);
  await pick('det', pngFile(2000, 1200, 'สลิปโอน.png'));
  dfill('amount', '1500'); dfill('method', 'transfer');
  TEACH.slipFail.upload = { statusCode: 500, message: 'boom' };
  submit('pay'); await settle(500);
  ok('อัปล้ม: ข้อความแดงตัวหนา "ยังไม่ได้บันทึกอะไร" · ไม่เรียก teach_payment_record · ฟอร์มค้าง', isRed(E('teDetErr')) && /อัปโหลดสลิปไม่สำเร็จ \\(ยังไม่ได้บันทึกอะไร\\)/.test(detErr()) && rpcCalls('teach_payment_record').length === 0 && !!E('teFormPay'), detErr());
  ok('อัปล้ม: ไฟล์ที่เลือกยังอยู่ให้ลองใหม่ · ไม่มีไฟล์ในถัง', !!E('teSlipSel_det') && Object.keys(TEACH.slipFiles).length === 0);
  TEACH.slipFail = {};
  TEACH.slipFail.upload = { statusCode: 403, message: 'new row violates row-level security policy' };
  submit('pay'); await settle(400);
  ok('ถังปฏิเสธ (403): ข้อความไทยบอกสิทธิ์ · ไม่โชว์ข้อความอังกฤษ/พาธ', /ไม่มีสิทธิ์อัปสลิป/.test(detErr()) && !/violates|row-level/.test(detErr()) && !/e-active\\//.test(detErr()), detErr());
  TEACH.slipFail = {};

  // ── บันทึกล้มหลังอัปแล้ว: กดซ้ำใช้ไฟล์เดิม ไม่อัปซ้ำ ──
  TEACH.fail.rpc_teach_payment_record = 'วิธีชำระไม่ถูกต้อง';
  submit('pay'); await settle(500);
  const req1 = la('teach_payment_record').p_request_id, path1 = 'e-active/' + req1 + '.' + (((uploads()[uploads().length - 1]) || {}).type === 'image/webp' ? 'webp' : 'jpg');
  ok('อัปสำเร็จ แล้วบันทึกล้ม: พาธ = <การลงเรียน>/<request_id>.<นามสกุล> · ส่ง p_slip_path ตรงพาธ', uploads().length === 1 && uploads()[0].path === path1 && la('teach_payment_record').p_slip_path === path1 && uploads()[0].upsert === false && /^image[/](webp|jpeg)$/.test(uploads()[0].type), J(uploads()));
  ok('แจ้งแดงตัวหนา: บันทึกการชำระไม่สำเร็จ + ไฟล์สลิปอัปโหลดแล้ว กดอีกครั้งใช้ไฟล์เดิม', isRed(E('teDetErr')) && /ไฟล์สลิปอัปโหลดแล้ว กดบันทึกอีกครั้งจะใช้ไฟล์เดิม/.test(detErr()), detErr());
  ok('ฟอร์มล็อกไฟล์หลังอัปแล้ว: ไม่มีช่องเลือกไฟล์ใหม่ · ไม่มีปุ่มเอาออก · บอก "อัปโหลดแล้ว"', !E('teSlipFile_det') && /อัปโหลดแล้ว/.test(txt('teSlipSel_det')) && !E('teSlipSel_det').querySelector('[data-act="slip-rm"]'));
  TEACH.fail = {};
  submit('pay'); await settle(700);
  ok('กดซ้ำ: ไม่อัปไฟล์ซ้ำ (ยังอัปครั้งเดียว) · request_id/พาธเดิม · บันทึกสำเร็จ', uploads().length === 1 && rpcCalls('teach_payment_record').length === 2 && la('teach_payment_record').p_request_id === req1 && la('teach_payment_record').p_slip_path === path1 && /บันทึกการชำระแล้ว/.test(detOk()), detOk() + detErr());
  const np = TEACH.pay.find(x => x.request_id === req1);
  ok('แถวใหม่มี slip_path · แสดง "มีสลิป" + ปุ่มดู + ปุ่มลบ (เจ้าของ)', !!np && np.slip_path === path1 && hasBtn(np.id, 'slip-view') && hasBtn(np.id, 'slip-clear') && /มีสลิป/.test(prow(np.id).textContent));
  ok('ฟอร์มปิดแล้ว · สถานะไฟล์ที่เลือกล้าง (ฟอร์มถัดไปเริ่มว่าง)', !E('teFormPay') && te.det.slip === null);
  openForm('pay'); await settle(100);
  ok('เปิดฟอร์มชำระใหม่: ไม่มีไฟล์ค้างจากรอบก่อน', !E('teSlipSel_det') && !!E('teSlipFile_det'));
  dact('close-form'); await settle(100);

  // ── ไม่เลือกสลิปก็บันทึกชำระได้ตามเดิม (สลิปไม่บังคับ) ──
  openForm('pay'); await settle(100);
  dfill('amount', '700');
  submit('pay'); await settle(600);
  ok('ไม่แนบสลิป: บันทึกชำระได้ ส่ง p_slip_path = null · ไม่มีการอัปเพิ่ม', la('teach_payment_record').p_slip_path === null && uploads().length === 1 && /บันทึกการชำระแล้ว/.test(detOk()), detOk() + detErr());
  ok('ตลอดชุด: หน้าจอไม่เขียนตาราง enrollment_payments ตรง ๆ', !CALLS.some(c => ['insert', 'update', 'delete', 'upsert'].includes(c.op) && c.table === 'enrollment_payments'));
  ok('ตลอดชุด: ไม่เรียก createSignedUrl/remove โดยไม่ได้กด', signs().length === 0 && removes().length === 0);
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

// ── 2. เจ้าของ: ดู · แนบให้แถวเดิม · ลบสลิป · ลบแถว ──
const T2 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== สลิป (2/9): เจ้าของ — ดูสลิป · แนบให้แถวเดิม · ลบสลิป · ลบแถวที่มีสลิป ===');
  TEACH.seed();
  // แถวเดิมที่มีสลิปอยู่แล้ว (นักเรียนเก่าที่อัปไว้) + ไฟล์ในถัง
  TEACH.pay.find(x => x.id === 'p1').slip_path = 'e-active/rq-p1.webp'; TEACH.slipFiles['e-active/rq-p1.webp'] = { size: 100, type: 'image/webp', who: 'u1' };
  await login('TiBass');
  await openTeach();
  await openEnroll('active', 'e-active');
  ok('แถวที่มีสลิป: "มีสลิป" + ดูสลิป + ลบสลิป · ไม่มีปุ่มแนบ', /มีสลิป/.test(prow('p1').textContent) && hasBtn('p1', 'slip-view') && hasBtn('p1', 'slip-clear') && !hasBtn('p1', 'open', '[data-k="slipatt"]'));

  // ── ดูสลิป: เปิดแท็บเปล่าก่อน แล้วขอลิงก์ 60 วินาที ไม่ฝัง URL ──
  OPENED = []; window.__nextWin = FAKEWIN();
  clickBtn('p1', 'slip-view'); await settle(400);
  const w = window.__nextWin;
  ok('เปิดแท็บเปล่าในจังหวะกด (window.open ก่อนขอลิงก์)', OPENED.length === 1 && OPENED[0][0] === '' && OPENED[0][1] === '_blank', J(OPENED));
  ok('ขอลิงก์ตรงพาธของแถวนั้น อายุ 60 วินาที ถัง course-slips', signs().length === 1 && signs()[0].path === 'e-active/rq-p1.webp' && signs()[0].secs === 60 && signs()[0].bucket === 'course-slips', J(signs()));
  ok('เปิดแท็บเปล่าก่อนขอลิงก์ (ตอนขอลิงก์ window.open ถูกเรียกแล้ว 1 ครั้ง)', signs()[0].opens === 1, J(signs()[0]));
  ok('พาแท็บไปที่ลิงก์ · ตัดความสัมพันธ์กับหน้านี้ (opener = null)', /^https:\\/\\/signed\\.test\\/course-slips\\/e-active\\/rq-p1\\.webp/.test(w._href) && w.opener === null, w._href);
  ok('ไม่ฝัง URL ลงหน้า (DOM ของแอปไม่มีลิงก์ที่เซ็นแล้ว)', !$('detail').innerHTML.includes('signed.test') && ![...document.querySelectorAll('[href],[src]')].some(e => /signed[.]test/.test(e.getAttribute('href') || e.getAttribute('src') || '')));
  // ดูไม่ได้: ฐานปฏิเสธ → ปิดแท็บเปล่า + แจ้งแดง
  TEACH.slipFail.sign = true; window.__nextWin = FAKEWIN();
  clickBtn('p1', 'slip-view'); await settle(400);
  ok('ลิงก์ขอไม่ได้: ปิดแท็บเปล่า · แจ้งแดงตัวหนา (ไม่ค้างหน้าว่าง)', window.__nextWin.closed === true && isRed(E('teDetErr')) && /เปิดสลิปไม่สำเร็จ/.test(detErr()), detErr());
  TEACH.slipFail = {};
  // เบราว์เซอร์บล็อกป๊อปอัป
  window.__nextWin = null;
  clickBtn('p1', 'slip-view'); await settle(400);
  ok('ป๊อปอัปถูกบล็อก: เตือนให้อนุญาต ไม่ throw', /บล็อกหน้าต่างใหม่/.test(($('toast') || document.body).textContent));
  window.__nextWin = FAKEWIN();

  // ── แนบให้แถวเดิมที่ยังไม่มีสลิป (p2 ของ e-soon) ──
  await openEnroll('active', 'e-soon');
  ok('e-soon: p2 ไม่มีสลิป → มีปุ่มแนบ', hasBtn('p2', 'open'));
  clickBtn('p2', 'open'); await settle(150);
  ok('กดแนบ: ฟอร์มแนบสลิปขึ้นใต้แถว · มีช่องไฟล์ + ข้อความความเป็นส่วนตัวแดงตัวหนา', !!E('teFormSlipAtt') && !!E('teSlipFile_det') && isRed(E('teSlipPrivacy_det')) && !hasBtn('p2', 'open', '[data-k="slipatt"]'));
  const nUp = uploads().length;
  submit('slipatt'); await settle(150);
  ok('ไม่เลือกไฟล์: แจ้งแดง · ไม่อัป · ไม่เรียกฐาน', /เลือกไฟล์สลิปก่อน/.test(detErr()) && uploads().length === nUp && rpcCalls('teach_payment_slip_set').length === 0);
  await pick('det', pngFile(1800, 1000, 'โอน.png'));
  submit('slipatt'); await settle(600);
  const up = uploads()[uploads().length - 1];
  ok('อัปไฟล์ก่อน (พาธ <การลงเรียน>/<request_id ของแถว>.<ext> · ไม่ทับ) แล้วเรียก teach_payment_slip_set ด้วยพาธเดียวกัน', up.path.indexOf('e-soon/rq-p2.') === 0 && up.upsert === false && la('teach_payment_slip_set').p_payment === 'p2' && la('teach_payment_slip_set').p_slip_path === up.path, J(up) + J(lastArgs('teach_payment_slip_set')));
  ok('สำเร็จ: ข้อความเขียว · ฟอร์มปิด · แถว p2 มีปุ่มดู/ลบ', /แนบสลิปแล้ว/.test(detOk()) && !E('teFormSlipAtt') && hasBtn('p2', 'slip-view') && hasBtn('p2', 'slip-clear'), detOk() + detErr());

  // ── แนบแล้วผูกล้ม (ฐานปฏิเสธ): ไฟล์อัปแล้ว กดซ้ำใช้ไฟล์เดิม ──
  clickBtn('p3', 'open'); await settle(150);
  await pick('det', pngFile(900, 600, 'p3.png'));
  TEACH.fail.rpc_teach_payment_slip_set = 'รายการนี้มีสลิปอยู่แล้ว — เปลี่ยนสลิปไม่ได้ (ให้เจ้าของลบสลิปเดิมก่อน)';
  submit('slipatt'); await settle(500);
  const nUp2 = uploads().length;
  ok('ผูกล้ม: แจ้งแดง "อัปโหลดไฟล์แล้ว แต่ผูก…ไม่สำเร็จ" · ไฟล์ล็อก', isRed(E('teDetErr')) && /อัปโหลดไฟล์แล้ว แต่ผูกสลิป/.test(detErr()) && !E('teSlipFile_det'), detErr());
  TEACH.fail = {};
  submit('slipatt'); await settle(600);
  ok('กดซ้ำ: ไม่อัปซ้ำ · ผูกสำเร็จ', uploads().length === nUp2 && /แนบสลิปแล้ว/.test(detOk()) && hasBtn('p3', 'slip-view'), detOk() + detErr());

  // ── ลบสลิป (เจ้าของ) ──
  const before = Object.keys(TEACH.slipFiles).length;
  clickBtn('p2', 'slip-clear'); await settle(200);
  ok('กดลบสลิป: หน้าต่างยืนยันแดงตัวหนา ลบแล้วกู้คืนไม่ได้ · ยังไม่เรียกฐาน', $('confirmDialog').open && isRed($('confirmBody').querySelector('.wk-red')) && /กู้คืนไม่ได้/.test($('confirmBody').textContent) && rpcCalls('teach_payment_slip_clear').length === 0);
  await confirmOk();
  const rm = removes(); const p2slip = up.path;
  ok('ยืนยัน: เรียก teach_payment_slip_clear แล้วลบไฟล์ในถังตามพาธที่ฐานคืน', la('teach_payment_slip_clear').p_payment === 'p2' && rm.length === 1 && rm[0].paths[0] === p2slip && rm[0].bucket === 'course-slips', J(rm));
  ok('ไฟล์หายจากถัง · แถว p2 กลับเป็น "ไม่มีสลิป" มีปุ่มแนบ · แจ้งเขียว', !TEACH.slipFiles[p2slip] && Object.keys(TEACH.slipFiles).length === before - 1 && /ไม่มีสลิป/.test(prow('p2').textContent) && hasBtn('p2', 'open') && /ลบสลิปแล้ว/.test(detOk()), detOk() + detErr());
  { const nS = signs().length, nO = OPENED.length; await teSlipView('p2'); await sleep(120);
    ok('เรียกดูสลิปของแถวที่ไม่มีสลิป: ไม่เปิดแท็บ ไม่ขอลิงก์', signs().length === nS && OPENED.length === nO, signs().length + ' ' + OPENED.length); }
  // ลบไฟล์ล้ม = สลิปออกจากแถวแล้ว แต่ไฟล์ค้าง → แจ้งแดงตัวหนา
  TEACH.slipFail.remove = true;
  clickBtn('p3', 'slip-clear'); await settle(200); await confirmOk();
  ok('ลบไฟล์ในถังล้ม: แถวหลุดสลิปแล้ว แต่แจ้งแดงตัวหนา "ไฟล์สลิปยังค้างในที่เก็บ" พร้อมชื่อไฟล์', isRed((E('teDetWarn') || document.body).querySelector('.wk-red')) && /ไฟล์สลิปยังค้างในที่เก็บ/.test(detWarn()) && /ลบสลิปออกจากรายการแล้ว/.test(detOk()), detWarn() + detOk());
  TEACH.slipFail = {};

  // ── ลบแถวชำระที่มีสลิป (เจ้าของ → ลบไฟล์ตามให้) ──
  await openEnroll('active', 'e-active');
  clickBtn('p1', 'open');            // p1 มีสลิป → ปุ่ม open ในแถวคือ "แก้"
  await settle(150);
  dact('delpay', '[data-sid="p1"]'); await settle(200);
  ok('ยืนยันลบแถวที่มีสลิป: ข้อความแดงตัวหนา (เจ้าของ = ลบไฟล์ให้พร้อมกัน)', isRed(E('teDelSlipNote')) && /ระบบลบไฟล์สลิปให้พร้อมกัน/.test(txt('teDelSlipNote')));
  await confirmOk();
  ok('ลบแถวแล้ว: เรียก remove ด้วยพาธที่ฐานคืน · ไฟล์หาย · ไม่มีคำเตือนไฟล์ค้าง', removes().some(r => r.paths[0] === 'e-active/rq-p1.webp') && !TEACH.slipFiles['e-active/rq-p1.webp'] && !/ค้างในที่เก็บ/.test(detWarn()), detWarn());

  // ── สลิปในแถวแต่ไฟล์ไม่อยู่ในถังแล้ว (ถูกลบมือ): ถังตอบ 0 รายการ ไม่ใช่ error → ต้องแจ้งว่าลบไฟล์ไม่ได้ ไม่หลอกว่าสำเร็จ ──
  TEACH.pay.push({ id: 'px', enrollment_id: 'e-active', paid_on: day(-2), amount: 10, kind: 'payment', method: 'cash', note: null, request_id: 'rq-px', slip_path: 'e-active/rq-px.webp', created_at: day(-2) + 'T05:00:00Z' });
  await loadTeach(); await settle(500);
  clickBtn('px', 'slip-clear'); await settle(200); await confirmOk();
  ok('ถังลบให้ 0 รายการ (ไฟล์ไม่อยู่แล้ว): แจ้งแดงตัวหนา "ไฟล์สลิปยังค้างในที่เก็บ" ไม่ขึ้นว่าลบสำเร็จเฉย ๆ', /ไฟล์สลิปยังค้างในที่เก็บ/.test(detWarn()) && /ลบสลิปออกจากรายการแล้ว/.test(detOk()), detWarn() + detOk());

  // ── แถวคืนเงินไม่มีสลิป ──
  await openEnroll('ended', 'e-closed');
  ok('แถวคืนเงิน (p7): ไม่มี "ไม่มีสลิป"/แนบ/ดู/ลบ', !/สลิป/.test(prow('p7').textContent) && !hasBtn('p7', 'slip-view') && !hasBtn('p7', 'slip-clear') && !prow('p7').querySelector('[data-k="slipatt"]'));
  ok('แถวชำระของใบที่ปิดแล้ว (p6) ยังแนบสลิปย้อนหลังได้', hasBtn('p6', 'open'));
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

// ── 3. ฟอร์มลงเรียน (เจ้าของ): ลำดับ create → upload → record ──
const T3 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== สลิป (3/9): ฟอร์มลงเรียน — อัปหลังสร้างการลงเรียน ก่อนบันทึกชำระ ===');
  TEACH.seed();
  await login('TiBass');
  await openTeach();
  tab('enroll'); await sleep(500);
  const f = () => te.f;
  teSetStudent({ customer_id: 'c4', member_id: null, name: 'ปิติ สุขสันต์', phone: '0800000000' });
  f().courseId = 'basic-dj-class'; f().teacherId = 't1'; f().price = '20000'; f().pay = 'none'; teEnrollRender(); await sleep(100);
  ok('ยังไม่ติ๊กชำระ: ไม่มีช่องแนบสลิป', !E('teSlipFile_enr'));
  f().pay = 'paid'; f().payDate = day(0); f().payAmount = '20000'; f().payMethod = 'transfer'; teEnrollRender(); await sleep(100);
  ok('ติ๊กชำระ: มีช่องแนบสลิปในฟอร์มลงเรียน + ข้อความความเป็นส่วนตัวแดงตัวหนา', !!E('teSlipFile_enr') && isRed(E('teSlipPrivacy_enr')) && !/ยังไม่เปิดใช้/.test(txt('teEnrollBody')));
  await pick('enr', pngFile(2000, 1300, 'ลงเรียน.png'));
  ok('เลือกรูปแล้วโชว์ชื่อ/ขนาด/ย่อแล้ว', !!E('teSlipSel_enr') && /ลงเรียน\\.png/.test(txt('teSlipSel_enr')));
  ok('ช่องแนบของแผงรายละเอียดไม่ปนกัน (ไม่มี id ซ้ำ)', document.querySelectorAll('[id="teSlipFile_enr"]').length === 1 && document.querySelectorAll('[id^="teSlipFile_det"]').length === 0);
  E('teSlipSel_enr').querySelector('[data-act="slip-rm"]').click(); await sleep(100);
  ok('ฟอร์มลงเรียน: กด "เอาออก" แล้วไฟล์หาย ช่องเลือกไฟล์กลับมา', !E('teSlipSel_enr') && !!E('teSlipFile_enr') && te.f.slip === null);
  await pick('enr', pngFile(2000, 1300, 'ลงเรียน.png'));
  TEACH.slipFail.upload = { statusCode: 500, message: 'boom' };
  E('teSave').click(); await settle(700);
  ok('อัปล้ม: ลงเรียนสำเร็จแล้ว (1 ครั้ง) แต่ขั้นชำระล้ม · ไม่เรียก teach_payment_record · แจ้งแดงตัวหนา', TEACH.created.length === 1 && rpcCalls('teach_payment_record').length === 0 && isRed(E('teFormErr')) && /ลงเรียนเรียบร้อยแล้ว แต่ขั้น "บันทึกการชำระ" ไม่สำเร็จ/.test(txt('teFormErr')) && /อัปโหลดสลิปไม่สำเร็จ/.test(txt('teFormErr')), (E('teFormErr') || {}).textContent);
  TEACH.slipFail = {};
  E('teSave').click(); await settle(900);
  const cid = TEACH.created[0].id, req = la('teach_payment_record').p_request_id, up = uploads();
  ok('กดซ้ำ: ไม่สร้างการลงเรียนซ้ำ · อัป 1 ครั้งที่พาธ <การลงเรียนที่เพิ่งสร้าง>/<request_id>', TEACH.created.length === 1 && up.length === 1 && up[0].path.indexOf(cid + '/' + req + '.') === 0, J(up));
  ok('ลำดับ: create → upload → record · p_slip_path = พาธที่อัป', (() => { const seq = CALLS.filter(c => (c.op === 'rpc' && ['teach_enroll_create', 'teach_payment_record'].includes(c.fn)) || (c.op === 'storage.upload' && c.ok)).map(c => c.fn || c.op); return seq.join() === 'teach_enroll_create,storage.upload,teach_payment_record'; })() && la('teach_payment_record').p_slip_path === up[0].path, J(lastArgs('teach_payment_record')));
  ok('สำเร็จ: ข้อความเขียว · ฟอร์มรีเซ็ต (ไม่มีไฟล์ค้าง)', /บันทึกแล้ว/.test(body().textContent + $('teEnrollBody').textContent) && !E('teSlipSel_enr') && te.f.slip === null);
  // เปลี่ยนนักเรียนกลางทาง (กด "เปลี่ยนนักเรียน") → สลิปที่เลือกไว้ถูกทิ้ง
  teSetStudent({ customer_id: 'c4', member_id: null, name: 'ปิติ สุขสันต์', phone: '0800000000' });
  f().pay = 'paid'; f().payDate = day(0); f().payAmount = '5'; teEnrollRender(); await sleep(80);
  await pick('enr', pngFile(300, 200, 'u.png'));
  ok('(ตั้งต้น) มีสลิปเลือกไว้ในฟอร์ม', !!te.f.slip);
  $('teEnrollBody').querySelector('[data-act="unpick"]').click(); await sleep(80);
  ok('เปลี่ยนนักเรียน: สลิปที่เลือกไว้ถูกทิ้ง', te.f.slip === null && !E('teSlipSel_enr'));
  // ติ๊กชำระแล้วเปลี่ยนใจไม่ชำระ → สลิปไม่ถูกส่ง
  teSetStudent({ customer_id: 'c5', member_id: null, name: 'ชูใจ รักเรียน', phone: '0800000000' });
  f().courseId = 'basic-dj-class'; f().teacherId = 't1'; f().price = '20000'; f().pay = 'paid'; f().payDate = day(0); f().payAmount = '100'; teEnrollRender(); await sleep(80);
  await pick('enr', pngFile(300, 200, 'x.png'));
  f().pay = 'none'; teEnrollRender(); await sleep(80);
  const nU = uploads().length, nR = rpcCalls('teach_payment_record').length;
  E('teSave').click(); await settle(700);
  ok('เปลี่ยนใจไม่ชำระ: ไม่อัปสลิป ไม่บันทึกชำระ (สลิปที่เลือกไว้ถูกทิ้ง)', uploads().length === nU && rpcCalls('teach_payment_record').length === nR && TEACH.created.length === 2);
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

// ── 4. ผู้ดูแล ──
const T4 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== สลิป (4/9): ผู้ดูแล (Nui) — ดูได้ ลบสลิปไม่ได้ · ลบแถวแล้วไฟล์ค้างต้องแจ้งเจ้าของ ===');
  TEACH.seed();
  TEACH.pay.find(x => x.id === 'p1').slip_path = 'e-active/rq-p1.webp'; TEACH.slipFiles['e-active/rq-p1.webp'] = { size: 100, type: 'image/webp', who: 'u1' };
  await login('Nui');
  await openTeach();
  await openEnroll('active', 'e-active');
  ok('ผู้ดูแล: เห็นรายการชำระ · มีปุ่มดูสลิป · ไม่มีปุ่มลบสลิป', hasBtn('p1', 'slip-view') && !hasBtn('p1', 'slip-clear'));
  window.__nextWin = FAKEWIN();
  clickBtn('p1', 'slip-view'); await settle(400);
  ok('ผู้ดูแลดูสลิปได้', signs().length === 1 && /signed\\.test/.test(window.__nextWin._href));
  // บันทึกชำระพร้อมสลิป (ผู้ดูแลอัปได้ — 060)
  openForm('pay'); await settle(100);
  await pick('det', pngFile(1600, 900, 'a.png')); dfill('amount', '300');
  submit('pay'); await settle(700);
  ok('ผู้ดูแลอัปสลิปพร้อมบันทึกชำระได้', uploads().length === 1 && /บันทึกการชำระแล้ว/.test(detOk()) && !!la('teach_payment_record').p_slip_path, detOk() + detErr());
  // ลบแถวที่มีสลิป → ไฟล์ค้าง (ผู้ดูแลลบไฟล์ไม่ได้)
  dact('open', '[data-k="payfix"][data-sid="p1"]'); await settle(120);
  dact('delpay', '[data-sid="p1"]'); await settle(200);
  ok('ยืนยันลบ: ข้อความแดงตัวหนา "ไฟล์สลิปจะค้าง ต้องแจ้งเจ้าของ"', isRed(E('teDelSlipNote')) && /ไฟล์สลิปจะค้างในที่เก็บ/.test(txt('teDelSlipNote')) && /แจ้งเจ้าของ/.test(txt('teDelSlipNote')));
  await confirmOk();
  ok('ลบแถวแล้ว: ผู้ดูแลไม่พยายามลบไฟล์ (ไม่เรียก remove) · แจ้งแดงตัวหนา ไฟล์ค้าง แจ้งเจ้าของ', removes().length === 0 && isRed((E('teDetWarn') || document.body).querySelector('.wk-red')) && /ไฟล์สลิปของรายการนี้ยังค้างในที่เก็บ/.test(detWarn()) && /แจ้งเจ้าของ/.test(detWarn()), detWarn());
  ok('ไฟล์ยังอยู่ในถัง (ผู้ดูแลลบไม่ได้)', !!TEACH.slipFiles['e-active/rq-p1.webp']);
  // เรียกลบสลิปตรง ๆ ผ่านฟังก์ชันของหน้า = ไม่ทำอะไร
  TEACH.pay.push({ id: 'px', enrollment_id: 'e-active', paid_on: day(-1), amount: 10, kind: 'payment', method: 'cash', note: null, request_id: 'rq-px', slip_path: 'e-active/rq-px.webp', created_at: day(-1) + 'T05:00:00Z' });
  await loadTeach(); await settle(500);
  const nC = rpcCalls('teach_payment_slip_clear').length;
  teSlipClearAsk('px'); await sleep(150);
  ok('ผู้ดูแลเรียก teSlipClearAsk ตรง ๆ: หน้าต่างไม่เปิด · ไม่เรียกฐาน', !$('confirmDialog').open && rpcCalls('teach_payment_slip_clear').length === nC);
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

// ── 5. พนักงานทั่วไป ──
const T5 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== สลิป (5/9): พนักงานทั่วไป (Zen) — แนบได้ แต่เปิดดูไม่ได้ ไม่เห็นยอด ===');
  TEACH.seed();
  await login('Zen');
  await openTeach();
  await openEnroll('active', 'e-soon');
  ok('ไม่เห็นยอดรวม/ราคา (หลักเดิม): ไม่มีกล่องเงิน', !E('teMoney'));
  ok('ไม่มียอดเงินของนักเรียนในแผงเลย (10,000 · 8,000 · 18,000)', !/10,000|8,000|18,000/.test(dt()), dt().slice(0, 200));
  ok('ไม่ดึงตาราง enrollment_payments / enrollment_money (ดึงงวดผ่านฟังก์ชันเท่านั้น)', !CALLS.some(c => c.op === 'select' && (c.table === 'enrollment_payments' || c.table === 'enrollment_money')) && rpcCalls('teach_payment_slip_todo').length >= 1 && la('teach_payment_slip_todo').p_enrollment === 'e-soon');
  ok('บล็อกสลิปการชำระ: ข้อความแดงตัวหนา "แนบได้แต่เปิดดูไม่ได้ — ไม่เห็นยอดและไม่เห็นรูป"', !!E('teSlipTodo') && isRed(E('teSlipStaffNote')) && /แนบสลิปได้แต่เปิดดูไม่ได้/.test(txt('teSlipStaffNote')));
  const rows = [...E('teSlipTodo').querySelectorAll('.te-prow')];
  ok('รายการ 2 งวด: งวดที่ 1 · งวดที่ 2 (ยังไม่มีสลิป) แต่ละแถวมีปุ่มแนบ · ไม่มียอด/วันที่', rows.length === 2 && /งวดที่ 1/.test(rows[0].textContent) && /งวดที่ 2/.test(rows[1].textContent) && rows.every(r => /ยังไม่มีสลิป/.test(r.textContent) && !!r.querySelector('[data-k="slipatt"]') && !/[0-9]{1,3},[0-9]{3}|฿/.test(r.textContent)), rows.map(r => r.textContent).join('|'));
  ok('ไม่มีปุ่มดูสลิป/ลบสลิป/บันทึกชำระ/คืนเงิน/แก้', !has('slip-view') && !has('slip-clear') && !has('open', '[data-k="pay"]') && !has('open', '[data-k="refund"]') && !has('open', '[data-k="payfix"]') && !!E('teDetPayOnlyMgr'));

  // ── แนบงวดที่ 2 (p3) ──
  D().querySelectorAll('#teSlipTodo [data-k="slipatt"]')[1].click(); await settle(150);
  ok('ฟอร์มแนบ "งวดที่ 2" มีช่องไฟล์ + ข้อความความเป็นส่วนตัวแดงตัวหนา', !!E('teFormSlipAtt') && /งวดที่ 2/.test(txt('teFormSlipAtt')) && isRed(E('teSlipPrivacy_det')));
  await pick('det', pngFile(1700, 1100, 'จากไลน์.png'));
  submit('slipatt'); await settle(700);
  const up = uploads();
  ok('อัปที่พาธ <การลงเรียน>/<request_id ของงวดที่ 2> (rq-p3) แล้วเรียก teach_payment_slip_set (id=p3)', up.length === 1 && up[0].path.indexOf('e-soon/rq-p3.') === 0 && la('teach_payment_slip_set').p_payment === 'p3' && la('teach_payment_slip_set').p_slip_path === up[0].path && /แนบสลิปแล้ว/.test(detOk()), J(up) + detOk() + detErr());
  const rows2 = [...E('teSlipTodo').querySelectorAll('.te-prow')];
  ok('หลังแนบ: งวดที่ 2 เป็น "มีสลิปแล้ว" ไม่มีปุ่มแนบ/ดู · งวดที่ 1 ยังแนบได้', /มีสลิปแล้ว/.test(rows2[1].textContent) && !rows2[1].querySelector('button') && !!rows2[0].querySelector('[data-k="slipatt"]'));
  ok('พนักงานไม่เคยขอลิงก์เปิดสลิปเลย (ไม่เรียก createSignedUrl)', signs().length === 0 && removes().length === 0);
  ok('ข้อความผิดพลาดไม่มีพาธ/ยอด', !/rq-p/.test(detErr() + detWarn()));

  // ── อัปนอกกติกาถูกปฏิเสธ (ถังบังคับ) ──
  const bogus = await tp(pngFile(300, 200, 'b.png'));
  let msg = ''; try { await teSlipUpload('e-soon', 'rq-not-a-payment', bogus); } catch (e) { msg = e.message; }
  ok('พนักงานอัปไฟล์ที่ไม่มีรายการชำระรองรับ: ถังปฏิเสธ → ข้อความไทยแดง บอกเหตุ (ไม่โชว์ข้อความอังกฤษ)', /ไม่มีสิทธิ์อัปสลิป/.test(msg) && !/violates/.test(msg), msg);
  const bogus2 = await tp(pngFile(300, 200, 'b.png'));
  msg = ''; try { await teSlipUpload('e-active', 'rq-p1', bogus2); } catch (e) { msg = e.message; }
  ok('พนักงานอัปไฟล์ของรายการชำระ p1 ได้ (ยังไม่มีสลิป) — เป็นกติกา B-3', msg === '' && uploads().length === 2);
  msg = ''; const bogus3 = await tp(pngFile(300, 200, 'c.png')); try { await teSlipUpload('e-soon', 'rq-p3', bogus3); } catch (e) { msg = e.message; }
  ok('งวดที่มีสลิปแล้ว: พนักงานอัปไฟล์นามสกุลอื่นเพิ่มไม่ได้', /ไม่มีสิทธิ์อัปสลิป|มีไฟล์ชื่อนี้/.test(msg), msg);

  // ── ยังไม่รัน 070 ──
  TEACH.no070 = true;
  await loadTeach(); await settle(500);
  ok('ยังไม่รัน 070: บอกเป็นคำ (เทา) ไม่ขึ้นแถบแดง · ไม่มีรายการให้แนบ', !!E('teSlipTodoMissing') && /ยังไม่ได้รัน migration 070/.test(txt('teSlipTodoMissing')) && !isRed(E('teSlipTodoMissing')) && !E('teSlipTodoErr') && !E('teDetLoadErr'));
  TEACH.no070 = false; TEACH.fail.rpc_teach_payment_slip_todo = 'ฐานล่ม';
  await loadTeach(); await settle(500);
  ok('โหลดรายการแนบล้มจริง: แถบแดงตัวหนา (กฎข้อ 8) แต่ส่วนอื่นของแผงยังใช้ได้', !!E('teSlipTodoErr') && isRed(E('teSlipTodoErr')) && !E('teDetLoadErr') && !!D().querySelector('#teDetHead'), dt().slice(0, 200));
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

// ── 6. พนักงานที่เป็นครู (Nutty = พนักงาน + ครู t2) ──
const T6 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== สลิป (6/9): พนักงานที่เป็นครู (Nutty) — ดูสลิปของนักเรียนตัวเองได้ ของคนอื่นไม่ได้ ===');
  TEACH.seed();
  TEACH.pay.find(x => x.id === 'p3').slip_path = 'e-soon/rq-p3.webp'; TEACH.slipFiles['e-soon/rq-p3.webp'] = { size: 100, type: 'image/webp', who: 'u1' };
  TEACH.pay.find(x => x.id === 'p1').slip_path = 'e-active/rq-p1.webp'; TEACH.slipFiles['e-active/rq-p1.webp'] = { size: 100, type: 'image/webp', who: 'u1' };
  await login('Nutty');
  await openTeach();
  await openEnroll('active', 'e-soon');
  ok('นักเรียนของ Nutty (e-soon): เห็นรายการชำระ → มีปุ่มดูสลิปของแถวที่มีสลิป · ไม่มีปุ่มลบ', hasBtn('p3', 'slip-view') && !hasBtn('p3', 'slip-clear') && !hasBtn('p2', 'slip-view'));
  window.__nextWin = FAKEWIN();
  clickBtn('p3', 'slip-view'); await settle(400);
  ok('Nutty เปิดสลิปของนักเรียนตัวเองได้', signs().length === 1 && /signed\\.test/.test(window.__nextWin._href));
  ok('แถวที่ยังไม่มีสลิป (p2): แนบได้', hasBtn('p2', 'open'));
  document.querySelector('#teWho button[data-who="all"]').click(); await sleep(150);        // ครูที่เป็นพนักงานตั้งต้นที่ "ของฉัน" — สลับเป็นทุกคนก่อน
  await openEnroll('active', 'e-active');
  ok('นักเรียนของครูคนอื่น (e-active): ไม่เห็นรายการชำระ → ใช้รายการงวด (ไม่มีปุ่มดูสลิป)', !!E('teSlipTodo') && !has('slip-view') && !D().querySelector('.te-prow strong'));
  const rows = [...E('teSlipTodo').querySelectorAll('.te-prow')];
  ok('งวดที่มีสลิปอยู่แล้ว (e-active p1): "มีสลิปแล้ว" ไม่มีปุ่ม', rows.length === 1 && /มีสลิปแล้ว/.test(rows[0].textContent) && !rows[0].querySelector('button'));
  // เรียกดูตรง ๆ ผ่านฟังก์ชันของหน้า = ไม่ทำอะไร (ไม่มีแถวชำระในหน่วยความจำ)
  const ns = signs().length; await teSlipView('p1'); await sleep(100);
  ok('เรียก teSlipView กับแถวที่ไม่ได้โหลด: ไม่ขอลิงก์', signs().length === ns);
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

// ── 7. ความปลอดภัย: XSS · ออกจากระบบ · ไม่ฝัง URL · ยังไม่รัน 070 (เจ้าของ) ──
const T7 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== สลิป (7/9): ความปลอดภัย — XSS · ล้างสถานะตอนออกจากระบบ · ยังไม่รัน 070 ===');
  TEACH.seed();
  await login('TiBass');
  await openTeach();
  await openEnroll('active', 'e-active');
  openForm('pay'); await settle(100);
  const evil = pngFile(300, 200, '<img src=x onerror="window.__xss=9">.png');
  await pick('det', evil);
  ok('ชื่อไฟล์แปลกแสดงเป็นข้อความ ไม่ถูกตีความเป็น HTML', !window.__xss && !E('teSlipSel_det').querySelector('img') && /<img src=x/.test(txt('teSlipSel_det')));
  // ── ออกจากระบบกลางฟอร์มที่เลือกไฟล์ไว้ ──
  await logout();
  ok('ออกจากระบบ: แผงปิด · ไม่เหลือชื่อไฟล์/สถานะสลิปในหน้า', !D() && !appText().includes('onerror') && te.det === null);
  await login('Zen'); await openTeach();
  ok('เข้าบัญชีอื่น: ไม่เห็นไฟล์ที่เลือกไว้ของบัญชีเดิม', !appText().includes('onerror') && !E('teSlipFile_det'));
  await logout();

  // ── ผลเตรียมไฟล์ที่มาช้า ตอนสลับบัญชี ต้องถูกทิ้ง ──
  await login('TiBass'); await openTeach(); await openEnroll('active', 'e-active'); openForm('pay'); await settle(100);
  const inp = $('teSlipFile_det'); const d = new DataTransfer(); d.items.add(pngFile(2400, 1600, 'ช้า.png')); inp.files = d.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
  await logout();            // ออกก่อนการย่อรูปเสร็จ
  await sleep(700);
  await login('Zen'); await openTeach();
  ok('การย่อรูปที่ค้างตอนออกจากระบบ: ผลถูกทิ้ง ไม่โผล่ในบัญชีใหม่', !appText().includes('ช้า.png'));
  await logout();

  // ── ยังไม่รัน 070 (เจ้าของ): แนบ/ลบ → บอกเป็นคำ ──
  await login('TiBass'); await openTeach(); await openEnroll('active', 'e-soon');
  TEACH.no070 = true;
  clickBtn('p2', 'open'); await settle(120);
  await pick('det', pngFile(500, 300, 'n.png'));
  submit('slipatt'); await settle(600);
  ok('ยังไม่รัน 070: แจ้งแดงตัวหนา "ยังไม่ได้รัน migration 070" (ไม่ใช่ข้อความอังกฤษ/รหัส)', isRed(E('teDetErr')) && /ยังไม่ได้รัน migration 070/.test(detErr()) && !/schema cache|PGRST/.test(detErr()), detErr());
  TEACH.pay.find(x => x.id === 'p3').slip_path = 'e-soon/rq-p3.webp'; TEACH.slipFiles['e-soon/rq-p3.webp'] = { size: 1, type: 'x', who: 'u1' };
  TEACH.no070 = false; await loadTeach(); await settle(500);
  TEACH.no070 = true;
  clickBtn('p3', 'slip-clear'); await settle(200); await confirmOk();
  ok('ลบสลิปตอนยังไม่รัน 070: แจ้งเป็นคำ · ไม่ลบไฟล์ในถัง', /ยังไม่ได้รัน migration 070/.test(detErr()) && removes().length === 0 && !!TEACH.slipFiles['e-soon/rq-p3.webp'], detErr());
  TEACH.no070 = false;
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

// ── 8. สวิตช์ปิด ──
const T8 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== สลิป (8/9): สวิตช์ปิด — พฤติกรรมเดิมทุกอย่าง ไม่แตะถัง ===');
  ok('สวิตช์ปิด (ค่าตั้งต้น)', TE_SLIPS_ENABLED === false);
  TEACH.seed();
  TEACH.pay.find(x => x.id === 'p1').slip_path = 'e-active/rq-p1.webp';        // มีสลิปในฐานก็ไม่โชว์ปุ่ม (ปิดอยู่)
  await login('TiBass');
  await openTeach();
  await openEnroll('active', 'e-active');
  ok('ไม่เลือกคอลัมน์ slip_path/request_id', !CALLS.some(c => c.op === 'select' && /slip_path|request_id/.test(c.cols || '')));
  ok('ข้อความเดิม "แนบสลิป: ยังไม่เปิดใช้" · ไม่มีปุ่ม/ช่องไฟล์สลิป', /แนบสลิป: ยังไม่เปิดใช้/.test(dt()) && !D().querySelector('input[type="file"]') && !has('slip-view') && !has('slip-clear') && !D().querySelector('[data-k="slipatt"]'));
  openForm('pay'); await settle(100);
  ok('ฟอร์มชำระไม่มีช่องไฟล์', !D().querySelector('input[type="file"]') && !E('teSlipField_det'));
  dfill('amount', '100'); submit('pay'); await settle(600);
  ok('บันทึกชำระส่ง p_slip_path = null · ไม่แตะถัง', la('teach_payment_record').p_slip_path === null && uploads().length === 0 && signs().length === 0 && removes().length === 0);
  tab('enroll'); await sleep(300);
  teSetStudent({ customer_id: 'c4', member_id: null, name: 'ปิติ', phone: '0800000000' });
  te.f.pay = 'paid'; teEnrollRender(); await sleep(80);
  ok('ฟอร์มลงเรียน (ติ๊กชำระ): ไม่มีช่องไฟล์ · ข้อความเดิมยังอยู่', !$('teEnrollBody').querySelector('input[type="file"]') && /แนบสลิป: ยังไม่เปิดใช้/.test($('teSlipNote').textContent));
  await logout(); await login('Zen'); await openTeach(); await openEnroll('active', 'e-soon');
  ok('พนักงาน (สวิตช์ปิด): ไม่เรียกฟังก์ชันงวด ไม่มีบล็อกสลิป', rpcCalls('teach_payment_slip_todo').length === 0 && !E('teSlipTodo'));
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

// ── 9. iPhone ──
const T9 = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== สลิป (9/9): iPhone 390px — ขนาดปุ่ม · ไม่ล้นจอ ===');
  TEACH.seed();
  TEACH.pay.find(x => x.id === 'p3').slip_path = 'e-soon/rq-p3.webp'; TEACH.slipFiles['e-soon/rq-p3.webp'] = { size: 100, type: 'image/webp', who: 'u1' };
  await login('TiBass');
  await openTeach();
  await openEnroll('active', 'e-soon');
  openForm('pay'); await settle(150);
  await pick('det', pngFile(1200, 800, 'มือถือ.png'));
  const tall = el => el && el.getBoundingClientRect().height >= 44;
  ok('ช่องเลือกไฟล์สูง ≥ 44px · ตัวหนังสือ ≥ 16px (iOS ไม่ซูม)', tall(E('teSlipFile_det')) && parseFloat(getComputedStyle(E('teSlipFile_det')).fontSize) >= 16, E('teSlipFile_det').getBoundingClientRect().height + ' ' + getComputedStyle(E('teSlipFile_det')).fontSize);
  const btns = [...D().querySelectorAll('#teSlipField_det button, #teFormPay button, #teDetPay [data-act="slip-view"], #teDetPay [data-act="open"]')];
  ok('ปุ่มทุกตัวของส่วนสลิป/ชำระสูง ≥ 44px', btns.length > 3 && btns.every(tall), btns.filter(b => !tall(b)).map(b => b.textContent + b.getBoundingClientRect().height).join('|'));
  ok('ข้อความตัวหนังสือในส่วนสลิป ≥ 14px', [...D().querySelectorAll('#teSlipField_det *, #teDetSlipNote')].every(el => !el.textContent.trim() || parseFloat(getComputedStyle(el).fontSize) >= 14), 'เล็กเกิน');
  ok('ไม่ล้นจอแนวนอน', document.documentElement.scrollWidth <= window.innerWidth + 1, document.documentElement.scrollWidth + ' > ' + window.innerWidth);
  dact('close-form'); await settle(100);
  ok('แถวที่มีสลิป: ปุ่มดู/แนบอยู่ในจอ ไม่ถูกตัด', [...D().querySelectorAll('.te-prow button')].every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1; }));
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

const TFLAG = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${COMMON}
async function runTests() {
  L('=== สลิป (สวิตช์): ' + window.__LABEL + ' ===');
  ok('TE_SLIPS_ENABLED = ' + window.__EXPECT, TE_SLIPS_ENABLED === window.__EXPECT, String(TE_SLIPS_ENABLED));
  TEACH.seed();
  await login('TiBass'); await openTeach(); await openEnroll('active', 'e-active');
  openForm('pay'); await settle(100);
  ok('ฟอร์มชำระ' + (window.__EXPECT ? 'มี' : 'ไม่มี') + 'ช่องไฟล์สลิป · ข้อความ "ยังไม่เปิดใช้" ' + (window.__EXPECT ? 'หาย' : 'ยังอยู่'), !!D().querySelector('input[type="file"]') === window.__EXPECT && /ยังไม่เปิดใช้/.test(dt()) === !window.__EXPECT);
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;
const flagMock = (set, expect, label) => mockOff + '\n<script>' + set + ';window.__EXPECT = ' + expect + ';window.__LABEL = ' + JSON.stringify(label) + ';</script>';
const ON = '<script>window.DJLAB_SLIPS_ENABLED = true;</script>';
const mockOn = MOCK3 + '\n' + TEACH_MOCK + '\n' + ON, mockOff = MOCK3 + '\n' + TEACH_MOCK;
let allOk = true;
for (const [label, tests, mock, opts] of [
  ['1 เจ้าของ: ช่องแนบ · ย่อรูป · อัป→บันทึก', T1, mockOn, { width: 1366, height: 900, coarse: false }],
  ['2 เจ้าของ: ดู · แนบให้แถวเดิม · ลบ', T2, mockOn, { width: 1366, height: 900, coarse: false }],
  ['3 ฟอร์มลงเรียน', T3, mockOn, { width: 1366, height: 900, coarse: false }],
  ['4 ผู้ดูแล', T4, mockOn, { width: 1366, height: 900, coarse: false }],
  ['5 พนักงานทั่วไป', T5, mockOn, { width: 1366, height: 900, coarse: false }],
  ['6 พนักงานที่เป็นครู', T6, mockOn, { width: 1366, height: 900, coarse: false }],
  ['7 ความปลอดภัย · ยังไม่รัน 070', T7, mockOn, { width: 1366, height: 900, coarse: false }],
  ['8 สวิตช์ปิด', T8, mockOff, { width: 1366, height: 900, coarse: false }],
  ['9 iPhone 390×844', T9, mockOn, { width: 390, height: 844, coarse: true }],
  ['10 สวิตช์: ค่า "false"/เลข ไม่เปิด', TFLAG, flagMock('window.DJLAB_SLIPS_ENABLED = "false"', 'false', 'ค่าตั้งเป็นข้อความ "false"'), { width: 1366, height: 900, coarse: false }],
  ['11 สวิตช์: ค่าเลข 1 ไม่เปิด', TFLAG, flagMock('window.DJLAB_SLIPS_ENABLED = 1', 'false', 'ค่าตั้งเป็นเลข 1'), { width: 1366, height: 900, coarse: false }],
  ['12 สวิตช์ทดสอบ localStorage = 1 เปิดเฉพาะเครื่อง', TFLAG, flagMock('localStorage.setItem("djlab.slips.test.v1", "1")', 'true', 'localStorage djlab.slips.test.v1 = 1'), { width: 1366, height: 900, coarse: false }],
  ['14 สวิตช์ทดสอบ localStorage = 0 ไม่เปิด', TFLAG, flagMock('localStorage.setItem("djlab.slips.test.v1", "0")', 'false', 'localStorage = "0"'), { width: 1366, height: 900, coarse: false }],
  ['15 สวิตช์ทดสอบ: อ่าน localStorage ไม่ได้ (โหมดส่วนตัว) = ปิด หน้าไม่พัง', TFLAG, flagMock('const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { if (k === "djlab.slips.test.v1") throw new Error("denied"); return g.apply(this, arguments); }', 'false', 'localStorage อ่านแล้ว throw'), { width: 1366, height: 900, coarse: false }],
  ['13 สวิตช์ทดสอบ localStorage = true ไม่เปิด', TFLAG, flagMock('localStorage.setItem("djlab.slips.test.v1", "true")', 'false', 'localStorage = "true" (ต้องเป็น 1 เท่านั้น)'), { width: 1366, height: 900, coarse: false }],
]) {
  if (ONLY && !ONLY.test(label)) continue;
  console.log('\n--- ' + label + ' ---');
  const res = await runCdpPage({ root: pageRoot, file: 'desk.html', mock, tests, hash: '', shotDir: null, ...opts });
  if (!res.ok) allOk = false;
}
console.log('\n=== desk-slips: ' + (allOk ? 'ผ่าน' : 'ไม่ผ่านหรือไม่ได้รันจนจบ') + ' ===');
process.exit(allOk ? 0 : 1);
