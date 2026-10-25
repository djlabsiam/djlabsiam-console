/**
 * เทสต์ "สถานะซิงก์ทะเบียนสมาชิกจาก Google Sheet" ในการ์ดทะเบียนสมาชิกของ desk.html (หมวดลูกค้า · migration 071)
 *   รัน: node tests/desk-member-sync.mjs
 *   ทดสอบหน้าฉบับอื่น (mutation): MSYNC_ROOT=<โฟลเดอร์ที่มี desk.html> node tests/desk-member-sync.mjs
 *
 * ที่มา: สมาชิกที่มีในชีตแต่หาไม่เจอในคอนโซล — Apps Script ซิงก์ทีละแถวตอนแก้เท่านั้น พลาดเงียบ ๆ ได้
 * (แก้เกิน 50 แถว · สคริปต์เขียนเอง · ส่งไม่สำเร็จ) 071 เพิ่มการตรวจทั้งชีตทุก 10 นาทีและบันทึกผลที่ members_sync_state
 * การ์ดนี้บอกผู้ใช้ว่าข้อมูลตรงกับชีตหรือยัง ไม่ให้ต้องเจอว่าหาชื่อไม่เจอเอง
 *
 *  1. สดใหม่ → "✓ ตรงกับ Google Sheet" + อายุ + จำนวนรายชื่อ · ไม่มีแถบเตือน (ขอบเขต 30 นาที: 30 = สด · 31 = เก่า)
 *  2. เก่าเกิน/ไม่เคยรัน/ยังไม่รัน 071/อ่านล้ม → เตือนเป็นคำ ไม่ใช่แถบแดงทั้งหน้า (ยกเว้นอ่านล้มจริง = แดงในการ์ด)
 *  3. รายละเอียด: แถวที่ฐานรับไม่ได้ · รหัสซ้ำ · หายจากชีต · ตามไปหน้าลูกค้าไม่สำเร็จ
 *  4. ข้อความจากชีต (ชื่อ/เหตุผล) แสดงเป็นข้อความ ไม่ถูกตีความ
 *  5. โหลดตอนล็อกอิน/เปิดหมวด · ไม่เขียนตารางตรง ๆ
 *  6. ออกจากระบบ/สลับบัญชี: ไม่เหลือในหน้า · ผลที่มาช้าถูกทิ้ง
 */

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HARNESS } from './lib/page-test.mjs';
import { runCdpPage } from './lib/cdp-page.mjs';
import { MSYNC_MOCK } from './lib/member-sync-mock.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { MOCK: MOCK3 } = await import(pathToFileURL(join(root, 'tests/desk-home3.mjs')).href);
const pageRoot = process.env.MSYNC_ROOT || root;

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
const card = () => $('memberSync');
const cardText = () => card().textContent.replace(/\\s+/g, ' ').trim();
const alerts = cls => [...card().querySelectorAll('.alert' + (cls ? '.' + cls : ''))];
const fatalText = () => (document.getElementById('fatalError') || {}).textContent || '';
const reload = async () => { await loadMemberSync(); await sleep(50); };

async function runTests() {
  L('=== สถานะซิงก์ทะเบียนสมาชิก (071) ===');
  MSYNC.reset();
  MSYNC.set({ minsAgo: 5 });
  await login('zen');
  showSection('customers'); await sleep(300);

  // ── 1. สดใหม่ ──────────────────────────────────────────────────
  ok('ล็อกอิน + เปิดหมวดลูกค้า: โหลดสถานะซิงก์แล้ว', MSYNC.reads >= 1, 'reads=' + MSYNC.reads);
  ok('สด: "✓ ตรงกับ Google Sheet" · "5 นาทีที่แล้ว" · "764 รายชื่อ"', /ตรงกับ Google Sheet/.test(cardText()) && /5 นาทีที่แล้ว/.test(cardText()) && /764 รายชื่อ/.test(cardText()), cardText());
  ok('สด: ไม่มีแถบเตือนใด ๆ', alerts().length === 0, card().innerHTML);
  ok('สด: การ์ดอยู่ในหมวดลูกค้า ใต้คำอธิบายทะเบียน (เห็นได้จริง)', !!card().closest('#sec-customers') && card().getClientRects().length > 0);
  MSYNC.set({ minsAgo: 30 }); await reload();
  ok('ขอบเขต: 30 นาที = ยังสด', /ตรงกับ Google Sheet/.test(cardText()) && alerts().length === 0, cardText());
  MSYNC.set({ minsAgo: 31 }); await reload();
  ok('ขอบเขต: 31 นาที = เก่า (แถบเตือน · ไม่มีคำว่า "ตรงกับ")', alerts('alert-warn').length === 1 && !/ตรงกับ Google Sheet/.test(cardText()), cardText());
  ok('เก่า: บอกอายุเป็นคำ + บอกว่าสมาชิกที่เพิ่งแก้อาจยังไม่เข้า + ชี้ไปดู SyncLog', /31 นาทีที่แล้ว/.test(cardText()) && /ยังไม่เข้าระบบ/.test(cardText()) && /SyncLog/.test(cardText()), cardText());
  MSYNC.set({ minsAgo: 200 }); await reload();
  ok('เก่ามาก: อายุเป็น ชม. (ไม่ใช่ตัวเลขนาทีดิบ)', /3 ชม\\./.test(cardText()), cardText());

  // ── 2. สถานะที่ไม่ใช่ "สด" ─────────────────────────────────────
  MSYNC.set({ minsAgo: null }); await reload();
  ok('ไม่เคยรัน: เตือน "ยังไม่เคยตรวจทั้งชีต" + บอกให้ติดตั้ง installReconcileTrigger', alerts('alert-warn').length === 1 && /ยังไม่เคยตรวจทั้งชีต/.test(cardText()) && /installReconcileTrigger/.test(cardText()), cardText());
  MSYNC.row = null; await reload();
  ok('ไม่มีแถวสถานะเลย: ถือเป็น "ยังไม่เคยตรวจ" ไม่พัง', /ยังไม่เคยตรวจทั้งชีต/.test(cardText()), cardText());
  MSYNC.missing = true; await reload();
  ok('ยังไม่รัน 071: แถบเหลืองบอกให้รัน migration 071 (ไม่ใช่ error แดง · ไม่มีแถบแดงทั้งหน้า)', alerts('alert-warn').length === 1 && /071/.test(cardText()) && alerts('alert-red').length === 0 && !/ไม่สำเร็จ/.test(fatalText()), cardText() + ' | ' + fatalText());
  MSYNC.missing = false;
  MSYNC.error = 'JWT expired';
  await reload();
  ok('อ่านล้มจริง: แถบแดงในการ์ดพร้อมข้อความจริง (ไม่หลอกว่าปกติ)', alerts('alert-red').length === 1 && /อ่านสถานะซิงก์ไม่สำเร็จ: JWT expired/.test(cardText()) && !/ตรงกับ Google Sheet/.test(cardText()), cardText());
  MSYNC.error = '';

  // ── 3. รายละเอียดปัญหา ─────────────────────────────────────────
  MSYNC.set({ minsAgo: 2, error_count: 2, errors: [
    { row: 17, message: 'date/time field value out of range: "31/02/2025"' },
    { row: 40, message: 'duplicate key value violates unique constraint "idx_members_code"' } ] });
  await reload();
  ok('แถวที่ฐานรับไม่ได้: แถบแดง บอกจำนวน + เลขแถวในชีต + เหตุผล', alerts('alert-red').length === 1 && /รับข้อมูลจากชีตไม่ได้ 2 แถว/.test(cardText()) && /แถว 17: date\\/time field value out of range/.test(cardText()) && /แถว 40:/.test(cardText()), cardText());
  ok('ยังบอกว่าตรวจล่าสุดเมื่อไรด้วย (ซิงก์ทำงาน แต่มีบางแถวเข้าไม่ได้)', /ตรวจล่าสุด 2 นาทีที่แล้ว/.test(cardText()), cardText());
  MSYNC.set({ minsAgo: 2, duplicate_count: 3 }); await reload();
  ok('รหัสซ้ำในชีต: แถบเตือน "3 แถว" + บอกว่าใช้แถวแรก', alerts('alert-warn').length === 1 && /รหัสซ้ำในชีต 3 แถว/.test(cardText()) && /ใช้แถวแรก/.test(cardText()), cardText());
  MSYNC.set({ minsAgo: 2, orphan_count: 7, orphan_sample: [
    { code: '25020', name: 'ภัมณัช' }, { code: null, name: 'ลูกค้า Shopee' }, { code: '25031', name: 'A' }, { code: '25032', name: 'B' }, { code: '25033', name: 'C' }, { code: '25034', name: 'D' } ] });
  await reload();
  ok('หายจากชีต: บอกจำนวน + ย้ำว่าไม่ลบอัตโนมัติ + ตัวอย่างไม่เกิน 5 (มีรหัสนำหน้า)', /ไม่อยู่ในชีตแล้ว 7 รายชื่อ \\(ไม่ลบอัตโนมัติ\\)/.test(cardText()) && /#25020 ภัมณัช/.test(cardText()) && /ลูกค้า Shopee/.test(cardText()) && !/D$/.test(cardText()) && alerts().length === 0, cardText());
  MSYNC.set({ minsAgo: 2, customers_result: { error: 'permission denied for table customers' } }); await reload();
  ok('ตามไปหน้าลูกค้าไม่สำเร็จ: แถบแดงพร้อมเหตุผล', alerts('alert-red').length === 1 && /ตามข้อมูลสมาชิกไปหน้าลูกค้าไม่สำเร็จ: permission denied/.test(cardText()), cardText());
  MSYNC.set({ minsAgo: 2, customers_result: { linked: 1, created: 4 } }); await reload();
  ok('ซิงก์ลูกค้าสำเร็จ: ไม่มีแถบเตือน', alerts().length === 0, cardText());

  // ── 4. ข้อความจากชีตไม่ถูกตีความ ───────────────────────────────
  window.__xss = 0;
  MSYNC.set({ minsAgo: 2, error_count: 1, errors: [{ row: '<img src=x onerror="window.__xss=1">', message: '<script>window.__xss=2<\\/script><b>x</b>' }],
              orphan_count: 1, orphan_sample: [{ code: '<i>1</i>', name: '<img src=x onerror="window.__xss=3">' }] });
  await reload(); await sleep(100);
  ok('ชื่อ/เหตุผล/เลขแถวที่มี HTML: แสดงเป็นข้อความ ไม่มี <img> <script> <b> <i> ในการ์ด · ไม่มีสคริปต์รัน',
    card().querySelectorAll('img, script, b, i').length === 0 && window.__xss === 0 && /<img src=x/.test(cardText()), card().innerHTML);

  // ── 5. การโหลด · ไม่เขียนตรง ๆ · ตัวอักษร ≥ 14px ───────────────
  MSYNC.set({ minsAgo: 1 }); await reload();
  const before = MSYNC.reads;
  showSection('home'); await sleep(50); showSection('customers'); await sleep(200);
  ok('เปิดหมวดลูกค้าใหม่: โหลดสถานะซ้ำ (อายุ "ตรวจล่าสุด" นับใหม่)', MSYNC.reads > before, before + ' → ' + MSYNC.reads);
  const b2 = MSYNC.reads; await loadAll(); await sleep(200);
  ok('loadAll (เช่น กลับมาที่แท็บ/เน็ตกลับมา): โหลดสถานะซ้ำด้วย', MSYNC.reads > b2, b2 + ' → ' + MSYNC.reads);
  ok('หน้าหลักไม่เขียน members_sync_state ตรง ๆ (เขียนได้เฉพาะฟังก์ชันของ Apps Script)', MSYNC.writes === 0 && !CALLS.some(c => c.op !== 'select' && c.table === 'members_sync_state'));
  MSYNC.set({ minsAgo: 99, error_count: 1, errors: [{ row: 3, message: 'x' }], duplicate_count: 1, orphan_count: 1, orphan_sample: [{ code: '1', name: 'n' }] }); await reload();
  const small = [...card().querySelectorAll('*')].filter(e => e.childElementCount === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 14);
  ok('ตัวหนังสือในการ์ดไม่เล็กกว่า 14px (กฎข้อ 6)', small.length === 0, small.map(e => e.tagName + ':' + getComputedStyle(e).fontSize).join());

  // ── 6. ออกจากระบบ / สลับบัญชี ─────────────────────────────────
  MSYNC.set({ minsAgo: 1, orphan_count: 1, orphan_sample: [{ code: '25020', name: 'ภัมณัช' }] }); await reload();
  ok('ก่อนออกจากระบบ: เห็นชื่อสมาชิกที่หายจากชีต', /ภัมณัช/.test(cardText()));
  doLogout(); await sleep(500);
  ok('ออกจากระบบ: การ์ดว่าง ไม่เหลือชื่อสมาชิกในหน้า', card().innerHTML === '' && !/ภัมณัช/.test(document.body.innerText), card().innerHTML);
  // ผลที่มาช้า: ค้างคำตอบ → ออกจากระบบ → ปล่อยคำตอบ = ต้องถูกทิ้ง
  await login('zen'); showSection('customers'); await sleep(300);
  let release; MSYNC.gate = new Promise(r => { release = r; });
  const slow = loadMemberSync();
  await sleep(80);
  doLogout(); await sleep(400);
  release(); await slow; await sleep(100);
  ok('คำตอบมาช้าหลังออกจากระบบ: ถูกทิ้ง (การ์ดยังว่าง)', card().innerHTML === '' && !msync.loaded, card().innerHTML);
  MSYNC.gate = null;
  // สลับบัญชีด้วย PIN ใช้ onAccountSwitched เดียวกัน — ล้างการ์ดของคนเดิม
  await login('zen'); showSection('customers'); await sleep(300);
  ok('ล็อกอินใหม่: โหลดสถานะอีกครั้ง การ์ดกลับมา', /ตรงกับ Google Sheet/.test(cardText()) || alerts().length > 0, cardText());
  onAccountSwitched(); await sleep(50);
  ok('สลับบัญชี: การ์ดของคนเดิมถูกล้าง (โหลดใหม่ให้คนใหม่ตอน loadAll)', card().innerHTML === '' && msync.loaded === false);
  done();
}
function done() {
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

const net = '--host-resolver-rules=MAP * ~NOTFOUND';
const res = await runCdpPage({ root: pageRoot, file: 'desk.html', mock: MOCK3 + MSYNC_MOCK, tests: TESTS, width: 1440, height: 900, coarse: false, flags: [net] });
console.log('\n=== desk-member-sync: ' + (res.ok ? 'ผ่าน' : 'ไม่ผ่านหรือไม่ได้รันจนจบ') + ' ===');
process.exit(res.ok ? 0 : 1);
