/**
 * เทสต์ "สแกน QR สมาชิก" (desk.html — 3 พ.ย. 69 เจ้าของสั่ง · RPC member_qr_redeem ของ migration 076)
 *   รัน: node tests/desk-memberqr.mjs      (MQ_ROOT=<โฟลเดอร์ที่มี desk.html ฉบับอื่น> ใช้ทำ mutation)
 *
 * สัญญา: QR = ข้อความ "DJLM1.<base32>" · RPC คืน { ok:true, member_id, member_code } หรือ { ok:false, reason: expired|used|invalid }
 *   สแกนแล้วต้อง "ระบุตัวสมาชิกอย่างเดียว" — ห้ามเขียนอะไร (ราคา/ส่วนลด/ตะกร้า/ลูกค้าในบิล/สถานะ) · ห้ามเก็บ/log/ขึ้นจอ token
 * ฐานปลอมจำลองทุกสถานะ: ok (ผูกลูกค้า · ไม่ผูก · ไม่มีในทะเบียน) · expired · used · invalid · ถูกจำกัดอัตรา (reason + error) ·
 *   ยังไม่รัน 076 (PGRST202) · เครือข่ายล่ม · ช้า (ใช้ทดสอบออกจากระบบกลางทาง)
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPage, HARNESS } from './lib/page-test.mjs';

const root = process.env.MQ_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');

const MOCK = `<script>
const CALLS = [];
window.CONSOLE_LOGS = [];                                   // ทุกอย่างที่หน้าเขียนลง console (log/error/warn) — token ห้ามอยู่ในนี้
['log', 'error', 'warn', 'info'].forEach(k => { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('[WEDGE]')) return o(...a); try { window.CONSOLE_LOGS.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')); } catch (e) {} o(...a); }; });
const FAKE = {
  admins: [{ id: 'u1', full_name: 'เจ้าของร้าน', role: 'owner', is_active: true }, { id: 'u2', full_name: 'พนักงาน', role: 'staff', is_active: true }],
  products: [{ id: 'p1', sku: 'PIO-DDJ-FLX4', name: 'DDJ-FLX4', brand: 'Pioneer DJ', category: 'controller', barcode_ean13: '619659216054', sell_price: 12900, cost_price: 9000, reorder_point: 1, is_active: true, image_path: null }],
  product_brands: [{ name: 'Pioneer DJ', is_active: true, sort_order: 20 }],
  product_stock_levels: [{ product_id: 'p1', current_qty: 5 }],
  product_units: [], stock_movements: [], sales: [], sale_items: [],
  customers: [
    { id: 'c1', full_name: 'สมาชิก หนึ่ง', phone: '0811111111', line_id: null, email: null, note: null, tags: ['สมาชิก'], created_at: '2026-10-26T01:00:00Z', created_by: null, admins: null, member_id: 'm1', members: { code: '125093' } },
    { id: 'c3', full_name: 'ลูกค้า ทั่วไป', phone: '0833333333', line_id: null, email: null, note: null, tags: [], created_at: '2026-10-26T01:00:00Z', created_by: null, admins: null, member_id: null, members: null },
  ],
  members: [
    { id: 'm1', code: '125093', is_member: true, full_name: 'สมาชิก หนึ่ง', phone: '0811111111', phone_normalized: ['0811111111'], email: null, address: null, note: null, member_type: 'นักเรียน Zlex', register_date: '2025-01-01', line_user_id: null },
    { id: 'm2', code: '25001', is_member: true, full_name: 'ทะเบียน เท่านั้น', phone: '0899999999', phone_normalized: ['0899999999'], email: null, address: null, note: null, member_type: null, register_date: '2025-02-01', line_user_id: null },
  ],
};
// ผลของ RPC ต่อ token (ค่าอื่น = invalid)
const QR = {
  'DJLM1.GOODLINKED':   { data: { ok: true, member_id: 'm1', member_code: '125093' }, error: null },
  'DJLM1.GOODUNLINKED': { data: { ok: true, member_id: 'm2', member_code: '25001' }, error: null },
  'DJLM1.GHOSTMEMBER':  { data: { ok: true, member_id: 'm9', member_code: '99999' }, error: null },
  'DJLM1.EXPIRED':      { data: { ok: false, reason: 'expired' }, error: null },
  'DJLM1.USED':         { data: { ok: false, reason: 'used' }, error: null },
  'DJLM1.INVALID':      { data: { ok: false, reason: 'invalid' }, error: null },
  'DJLM1.RATEREASON':   { data: { ok: false, reason: 'rate_limited' }, error: null },
  'DJLM1.RATEERROR':    { data: null, error: { code: 'P0001', message: 'สแกน QR ไม่ผ่านบ่อยเกินไป กรุณารอ 10 นาที หรือค้นสมาชิกด้วยรหัสแทน' } },   // ข้อความจริงของ 076
  'DJLM1.RATEENGLISH':  { data: null, error: { code: 'P0001', message: 'rate_limited: too many failed attempts' } },
  'DJLM1.NOTSTAFF':     { data: null, error: { code: '42501', message: 'สแกน QR สมาชิกได้เฉพาะทีมงานที่ใช้งานอยู่' } },
  'DJLM1.NOFUNCTION':   { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.member_qr_redeem(p_token) in the schema cache' } },
  'DJLM1.WEIRDERROR':   { data: null, error: { code: 'XX000', message: 'boom DJLM1.WEIRDERROR secret detail' } },
};
function builder(table) {
  const q = {
    _rows: (FAKE[table] || []).slice(),
    select() { return q; },
    eq(col, val) { q._rows = q._rows.filter(r => r[col] === val); return q; },
    in(col, vals) { q._rows = q._rows.filter(r => vals.includes(r[col])); return q; },
    is() { return q; }, neq() { return q; }, not() { return q; }, or() { return q; }, ilike() { return q; },
    order() { return q; }, gte() { return q; }, lte() { return q; }, lt() { return q; }, gt() { return q; },
    limit() { return q; }, range() { return q; }, contains() { return q; },
    async maybeSingle() { return { data: q._rows[0] || null, error: null }; },
    async single() { return { data: q._rows[0] || null, error: null }; },
    then(res, rej) { return Promise.resolve({ data: q._rows, error: null, count: q._rows.length }).then(res, rej); },
    insert(payload) { CALLS.push({ op: 'insert', table, payload }); return q; },
    update(payload) { CALLS.push({ op: 'update', table, payload }); return q; },
    upsert(payload) { CALLS.push({ op: 'upsert', table, payload }); return q; },
    delete() { CALLS.push({ op: 'delete', table }); return q; },
  };
  return q;
}
let SESSION = null, authCb = null;
window.MEMBERS_FAIL = false;                                 // ทำให้อ่านทะเบียนสมาชิกล้ม (RPC ผ่านแต่โหลดรายละเอียดไม่ได้)
window.supabase = {
  createClient: () => ({
    from: t => { const q = builder(t); if (t === 'members' && window.MEMBERS_FAIL) { q.then = (res, rej) => Promise.resolve({ data: null, error: { code: '500', message: 'x' } }).then(res, rej); } return q; },
    rpc: async (fn, args) => {
      CALLS.push({ op: 'rpc', fn, args: JSON.parse(JSON.stringify(args || {})) });
      if (fn !== 'member_qr_redeem') return { data: null, error: null };
      const t = args && args.p_token;
      if (t === 'DJLM1.NETWORKFAIL') throw new Error('network down');
      if (t === 'DJLM1.SLOWERR') { await new Promise(r => setTimeout(r, 500)); return QR['DJLM1.EXPIRED']; }
      if (t === 'DJLM1.SLOW') { await new Promise(r => setTimeout(r, 500)); return QR['DJLM1.GOODLINKED']; }
      return QR[t] || { data: { ok: false, reason: 'invalid' }, error: null };
    },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    functions: { async invoke(name) { return { data: name === 'mail' ? { messages: [], total: 0, unseen: 0, counts: {} } : {}, error: null }; } },
    storage: { from: bucket => ({ getPublicUrl(path) { return { data: { publicUrl: 'https://img.test/' + bucket + '/' + path } }; }, async createSignedUrl() { return { data: { signedUrl: 'data:,' }, error: null }; } }) },
    auth: {
      async getSession() { return { data: { session: SESSION } }; },
      async getUser() { return { data: { user: SESSION && SESSION.user } }; },
      onAuthStateChange(cb) { authCb = cb; },
      async signInWithPassword({ email }) { SESSION = { user: { id: email.startsWith('owner') ? 'u1' : 'u2' } }; setTimeout(() => authCb && authCb('SIGNED_IN', SESSION)); return { data: {}, error: null }; },
      async signOut() { SESSION = null; setTimeout(() => authCb && authCb('SIGNED_OUT', null)); return { error: null }; },
    },
  }),
};
// กล้องปลอม = ภาพจาก canvas จริง · ZXing ปลอมอ่านได้ตามที่เทสต์ตั้ง __code · ไม่มี BarcodeDetector (เหมือน Safari บน iPad → ต้องตกไป ZXing ที่มี QR_CODE)
delete window.BarcodeDetector;
window.__code = null;
window.ZXing = {
  DecodeHintType: { POSSIBLE_FORMATS: 2, TRY_HARDER: 3 },
  BarcodeFormat: { CODE_128: 4, CODE_39: 2, EAN_13: 7, QR_CODE: 11 },
  MultiFormatReader: function () { this.setHints = h => { this.hints = h; }; this.reset = () => {};
    this.decode = () => { if (window.__code) { const c = window.__code; window.__code = null; return { getText: () => c }; } throw new Error('NotFound'); }; },
  HTMLCanvasElementLuminanceSource: function () {}, BinaryBitmap: function () {}, HybridBinarizer: function () {},
};
if (!navigator.mediaDevices) navigator.mediaDevices = {};
// กล้องปลอมแบบกำหนดผลได้แน่นอน: เฟรมวิดีโอจริงของ captureStream เดินตามเวลาจริง แต่ตัวรันใช้เวลาเสมือน (timer เร็วกว่าเฟรม) จึงไม่นิ่ง
// → stream ปลอม + videoWidth/Height คงที่ 1280×720 + rAF ผ่าน timer · ตรรกะที่เทสต์ (ROI · โหมด · ZXing · ปิดกล้องจริง) ยังเป็นโค้ดจริงของหน้า
window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);
const STREAMS = [];
Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { configurable: true, get() { return this.__so || null; }, set(v) { this.__so = v; } });
HTMLMediaElement.prototype.play = async function () {};
Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get() { return 1280; } });
Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get() { return 720; } });
navigator.mediaDevices.getUserMedia = async () => {
  const track = { readyState: 'live', stop() { this.readyState = 'ended'; }, getCapabilities: () => ({}), getSettings: () => ({ width: 1280, height: 720 }) };
  const st = { getTracks: () => [track], getVideoTracks: () => [track] };
  STREAMS.push(st);
  return st;
};
</script>`;

const page = part => `<script>
const PART = '${part}';
window.addEventListener('load', () => setTimeout(runTests, 300));
${HARNESS}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);
async function login(email) { $('loginEmail').value = email; $('loginPassword').value = 'x'; await doLogin(); await sleep(400); }
const codesOf = s => s.split('').map(ch => /[0-9]/.test(ch) ? 'Digit' + ch : ch === '.' ? 'Period' : 'Key' + ch.toUpperCase());
const rpcCalls = () => CALLS.filter(c => c.op === 'rpc' && c.fn === 'member_qr_redeem');
const writes = () => CALLS.filter(c => c.op !== 'rpc');
const dlgOpen = () => $('mqDialog').open;
const txt = () => $('mqBody').textContent;
const domHtml = () => { const c = document.documentElement.cloneNode(true); c.querySelectorAll('script,style').forEach(e => e.remove()); return c.outerHTML; };   // DOM จริงที่ผู้ใช้เห็น (ไม่นับสคริปต์ทดสอบที่มีข้อความ token อยู่เอง)
const live = () => STREAMS.filter(s => s.getTracks().some(t => t.readyState === 'live')).length;
const vis = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
const footBtn = label => [...$('mqFoot').querySelectorAll('button')].find(b => b.textContent.includes(label));
async function waitFor(fn, ms) { for (let t = 0; t < (ms || 3000); t += 50) { if (fn()) return true; await sleep(50); } return !!fn(); }
async function gun(token) { burst(codesOf(token)); await sleep(200); }                   // เครื่องยิง: ตัวอักษรห่าง 6ms ปิดท้าย Enter
async function reopen() { if (dlgOpen()) $('mqDialog').close(); await sleep(30); clock += 5000; }
async function read(code) { clock += 5000; window.__code = code; for (let i = 0; i < 30 && window.__code; i++) await sleep(50); await sleep(400); }

const unhandled = [];
async function runTests() {
  L('=== สแกน QR สมาชิก (' + window.innerWidth + 'px) ===');
  try { localStorage.clear(); } catch (e) {}
  window.addEventListener('unhandledrejection', e => unhandled.push(String(e.reason)));
  await login('owner@djlabsiam.com');

  showSection('customers'); await sleep(200);
  const bCust = [...document.querySelectorAll('#sec-customers .toolbar .btn')].find(b => b.textContent.includes('สแกน QR สมาชิก'));
  if (PART === 'A') await partA(bCust);
  else await partB(bCust);
  ok('ไม่มี unhandled rejection', unhandled.length === 0, unhandled.join(' | '));
  ok('ไม่มีแถบข้อผิดพลาดแดงบนจอ', !$('fatalError'), $('fatalError') && $('fatalError').textContent);
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}

async function partA(bCust) {
  // ── 1. ปุ่ม ─────────────────────────────────────────────────────────────────────
  showSection('pos'); await sleep(200);
  const bPos = [...document.querySelectorAll('#sec-pos .btn')].find(b => b.textContent.includes('สแกน QR สมาชิก'));
  ok('มีปุ่ม "สแกน QR สมาชิก" ที่หน้าลูกค้าและหน้าขาย', !!bCust && !!bPos);
  showSection('customers'); await sleep(100);
  ok('ปุ่มหน้าลูกค้าเห็นอยู่ในจอ (ไม่ล้น) และตัวหนังสือ ≥ 14px', vis(bCust) && bCust.getBoundingClientRect().right <= innerWidth + 1 && parseFloat(getComputedStyle(bCust).fontSize) >= 14);

  // ── 2. เครื่องยิง: ยิงที่หมวดลูกค้า (ปกติ wrongpage) → ได้การ์ดสมาชิกที่ผูกลูกค้า ──────
  const seen = []; const origScanned = window.onScanned; window.onScanned = async (c, g) => { seen.push(c); return origScanned(c, g); };
  await gun('DJLM1.GOODLINKED');
  ok('ยิง QR ที่หมวดลูกค้า → เรียก member_qr_redeem ครั้งเดียว ด้วย token ตรงตัว', rpcCalls().length === 1 && rpcCalls()[0].args.p_token === 'DJLM1.GOODLINKED', JSON.stringify(rpcCalls()));
  ok('หน้าต่างผลเปิด โชว์ชื่อ + รหัสสมาชิก + ✓', dlgOpen() && /พบสมาชิก/.test(txt()) && txt().includes('สมาชิก หนึ่ง') && txt().includes('125093'), txt());
  ok('โชว์ประเภทสมาชิกจากทะเบียน (นักเรียน Zlex)', txt().includes('นักเรียน Zlex'), txt());
  ok('QR ไม่ไปเป็นบาร์โค้ดสินค้า (onScanned ไม่ถูกเรียก) และไม่มีแถบ "wrongpage"', seen.length === 0 && !/เครื่องยิงบาร์โค้ดใช้ได้ในหมวด/.test($('toast').textContent), JSON.stringify(seen));
  ok('ไม่มีการเขียนฐานใด ๆ นอกจาก RPC (ไม่ insert/update/upsert/delete)', writes().length === 0, JSON.stringify(writes()));
  ok('token ไม่อยู่ในจอเลย (DOM ทั้งหน้า)', !domHtml().includes('GOODLINKED'));
  ok('token ไม่อยู่ใน console', !window.CONSOLE_LOGS.some(l => l.includes('GOODLINKED')), window.CONSOLE_LOGS.join(' | '));
  ok('ปุ่ม "ใส่ในบิลขาย" โผล่ (ลูกค้าผูกสมาชิกนี้อยู่) + "เปิดโปรไฟล์สมาชิก" + "สแกนคนถัดไป"', !!footBtn('ใส่ในบิลขาย') && !!footBtn('เปิดโปรไฟล์สมาชิก') && !!footBtn('สแกนคนถัดไป'));

  const inside = () => { const d = $('mqDialog').getBoundingClientRect(); return [...$('mqFoot').querySelectorAll('button')].every(b => { const r = b.getBoundingClientRect(); return r.left >= d.left - 1 && r.right <= d.right + 1 && r.width > 0; }) && d.left >= 0 && d.right <= innerWidth + 1; };
  ok('ปุ่มท้ายการ์ดอยู่ในหน้าต่างและในจอครบทุกปุ่ม (ไม่ถูกตัดขอบ แม้จอแคบ)', inside(), JSON.stringify([...$('mqFoot').querySelectorAll('button')].map(b => Math.round(b.getBoundingClientRect().left) + '-' + Math.round(b.getBoundingClientRect().right))) + ' dlg ' + JSON.stringify($('mqDialog').getBoundingClientRect()));

  // ── 3. ปุ่มเปิดโปรไฟล์ / ใส่ในบิล ─────────────────────────────────────────────────
  footBtn('เปิดโปรไฟล์สมาชิก').click(); await sleep(300);
  ok('"เปิดโปรไฟล์สมาชิก" → ปิดหน้าต่าง ไปหมวดลูกค้า เปิดแผงของลูกค้าที่ผูก', !dlgOpen() && current === 'customers' && $('detailTitle').textContent.includes('สมาชิก หนึ่ง'), current + ' / ' + $('detailTitle').textContent);
  await reopen(); await gun('DJLM1.GOODLINKED');
  ok('สแกน QR ที่ใช้แล้วซ้ำ (ฐานตอบ ok เพราะจำลอง) ผ่านเมื่อพ้นช่วงหน่วง', rpcCalls().length === 2 && dlgOpen());
  ok('ก่อนกด: บิลยังไม่มีลูกค้า (สแกนไม่ใส่ให้เอง)', selectedCustomer === null);
  footBtn('ใส่ในบิลขาย').click(); await sleep(200);
  ok('"ใส่ในบิลขาย" → ไปหน้าขาย ลูกค้าของบิล = ผู้ผูกสมาชิก (เหมือนเลือกเอง)', current === 'pos' && selectedCustomer && selectedCustomer.id === 'c1' && !dlgOpen());
  ok('การใส่ลูกค้าในบิลไม่เขียนฐาน (ราคา/ส่วนลดไม่ถูกแตะ)', writes().length === 0 && $('discountInput').value === '');
  clearSelectedCustomer();

  // ── 4. สมาชิกที่ไม่มีลูกค้าผูก · ไม่มีในทะเบียน · โหลดทะเบียนล้ม ───────────────────────
  showSection('customers'); await sleep(100);
  await reopen(); await gun('DJLM1.GOODUNLINKED');
  ok('สมาชิกที่ยังไม่มีลูกค้าผูก → โชว์ชื่อจากทะเบียน + รหัส · ไม่มีปุ่มใส่ในบิล', dlgOpen() && txt().includes('ทะเบียน เท่านั้น') && txt().includes('25001') && !footBtn('ใส่ในบิลขาย'), txt());
  footBtn('เปิดโปรไฟล์สมาชิก').click(); await sleep(250);
  ok('เปิดโปรไฟล์ → แผงรายละเอียดสมาชิกของทะเบียน (ใช้ openMemberDetail เดิม)', $('detailTitle').textContent.includes('ทะเบียน เท่านั้น') && /เบอร์โทร/.test($('detailBody').textContent));
  await reopen(); await gun('DJLM1.GHOSTMEMBER');
  ok('RPC ok แต่ไม่พบในทะเบียน → แสดงรหัส + เตือน ไม่พัง', dlgOpen() && txt().includes('99999') && /ไม่พบสมาชิกรหัสนี้ในทะเบียน/.test(txt()), txt());
  await reopen(); window.MEMBERS_FAIL = true; await gun('DJLM1.GOODLINKED'); window.MEMBERS_FAIL = false;
  ok('RPC ok แต่โหลดทะเบียนล้ม → แจ้งแดงตามจริง + ยังเห็นรหัส (ไม่หลอกว่าครบ)', dlgOpen() && /โหลดข้อมูลสมาชิกจากทะเบียนไม่สำเร็จ/.test(txt()) && txt().includes('125093') && !!$('mqBody').querySelector('.alert-red'), txt());

  // ── 5. ข้อความผิดพลาดทุกแบบ ────────────────────────────────────────────────────────
  const cases = [
    ['DJLM1.EXPIRED', /QR หมดอายุ ให้สมาชิกกดขอ QR ใหม่/, 'expired'],
    ['DJLM1.USED', /QR นี้ถูกใช้แล้ว/, 'used'],
    ['DJLM1.INVALID', /ไม่ใช่ QR สมาชิกของร้าน/, 'invalid'],
    ['DJLM1.RATEREASON', /จำกัดชั่วคราว — รอสักครู่/, 'rate (reason)'],
    ['DJLM1.RATEERROR', /สแกน QR ไม่ผ่านบ่อยเกินไป กรุณารอ 10 นาที หรือค้นสมาชิกด้วยรหัสแทน/, 'rate (ข้อความไทยของฐาน)'],
    ['DJLM1.RATEENGLISH', /จำกัดชั่วคราว — รอสักครู่/, 'rate (error อังกฤษ)'],
    ['DJLM1.NOTSTAFF', /บัญชีนี้ไม่มีสิทธิ์สแกน QR สมาชิก/, 'ไม่ใช่ทีมงาน 42501'],
    ['DJLM1.NOFUNCTION', /ยังไม่เปิดใช้ในฐานข้อมูล.*076/, 'ยังไม่รัน 076'],
    ['DJLM1.NETWORKFAIL', /สแกนไม่สำเร็จ \\(รหัสข้อผิดพลาด NETWORK\\)/, 'เครือข่ายล่ม'],
    ['DJLM1.WEIRDERROR', /สแกนไม่สำเร็จ \\(รหัสข้อผิดพลาด XX000\\)/, 'error แปลก'],
  ];
  for (const [tok, re, name] of cases) {
    await reopen(); await gun(tok);
    ok('ผลผิดพลาด ' + name + ' → ข้อความอ่านง่าย: ' + re.source.slice(0, 28), dlgOpen() && re.test(txt()) && !!footBtn('สแกนใหม่'), txt());
  }
  ok('ข้อความจาก error ของฐานไม่ถูกเอาขึ้นจอ (กัน token/รายละเอียดภายในรั่ว)', !/boom|secret detail|rate_limited: too many/.test(domHtml()));
  ok('ผลผิดพลาดทุกแบบไม่ใช่การ์ด "พบสมาชิก" และไม่เขียนฐาน', !/พบสมาชิก/.test(txt()) && writes().length === 0);
  ok('ไม่มี token ใด ๆ ใน console หรือบนจอ (ทุกแบบ)', !window.CONSOLE_LOGS.some(l => /DJLM1\\./.test(l)) && !/DJLM1\\.[A-Z]/.test(document.body.innerText),
     window.CONSOLE_LOGS.filter(l => /DJLM1\\./.test(l)).join(' | '));
  ok('error ที่ log มีเฉพาะรหัส (XX000) ไม่มีข้อความดิบของฐาน', window.CONSOLE_LOGS.some(l => l.includes('XX000')) && !window.CONSOLE_LOGS.some(l => /secret detail|boom/.test(l)));

  // ── 6. พิมพ์รหัสเอง (ทางสำรอง) ───────────────────────────────────────────────────
  await reopen(); await gun('DJLM1.EXPIRED');
  const n0 = rpcCalls().length;
  $('mqCode').value = 'ab'; mqManual(); await sleep(50);
  ok('พิมพ์รหัสสั้นเกิน → เตือนในช่อง ไม่ยิงฐาน', /อย่างน้อย 3 ตัว/.test($('mqManualErr').textContent));
  $('mqCode').value = '000000'; mqManual(); await sleep(200);
  ok('รหัสที่ไม่มีในทะเบียน → ข้อความว่าไม่พบ (ไม่ปิดหน้าต่าง)', dlgOpen() && /ไม่พบรหัสสมาชิกนี้ในทะเบียน/.test($('mqManualErr').textContent));
  $('mqCode').value = '125093'; mqManual(); await sleep(250);
  ok('พิมพ์รหัส 125093 → การ์ดสมาชิกเดียวกับสแกน (ผูกลูกค้า) โดยไม่เรียก RPC ใช้ token', dlgOpen() && /พบสมาชิก/.test(txt()) && txt().includes('สมาชิก หนึ่ง') && !!footBtn('ใส่ในบิลขาย') && rpcCalls().length === n0, txt());
  ok('การ์ดจากการพิมพ์ไม่เขียนว่า "ตรวจ QR สำเร็จ" (ไม่หลอกว่าสแกน)', !/ตรวจ QR สำเร็จ/.test(txt()));

  // ── 7. สแกนซ้ำเสี้ยววินาที ──────────────────────────────────────────────────────────
  await reopen();
  const n1 = rpcCalls().length;
  const p1 = memberQrScan('DJLM1.GOODLINKED'), p2 = memberQrScan('DJLM1.GOODLINKED');
  await Promise.all([p1, p2]); await sleep(50);
  ok('เรียกซ้อนสองครั้งติดกัน (ระหว่างรอ RPC) → ยิงฐานครั้งเดียว', rpcCalls().length === n1 + 1, String(rpcCalls().length - n1));
  await memberQrScan('DJLM1.GOODLINKED');
  ok('สแกนซ้ำทันทีหลังเสร็จ (ภายใน 1.5 วิ) → ข้าม ไม่ยิงฐานอีก', rpcCalls().length === n1 + 1);
  clock += 2000; await memberQrScan('DJLM1.GOODLINKED'); await sleep(50);
  ok('พ้น 1.5 วิแล้วสแกนได้ใหม่', rpcCalls().length === n1 + 2);

  // ── 7b. ส่งให้ฐานเป็นตัวพิมพ์ใหญ่ ไม่มีช่องว่าง (ฐานตรวจ ^DJLM1\.[A-Z2-7]{26}$ ไม่แปลงให้) ──
  await reopen();
  const nn = rpcCalls().length;
  await memberQrScan('  djlm1.goodlinked \\n'); await sleep(50);
  ok('token พิมพ์เล็ก/มีช่องว่าง → ส่งฐานเป็นตัวพิมพ์ใหญ่ตัดช่องว่าง (ได้การ์ดสมาชิก)', rpcCalls().length === nn + 1 && rpcCalls()[nn].args.p_token === 'DJLM1.GOODLINKED' && /พบสมาชิก/.test(txt()), JSON.stringify(rpcCalls()[nn]));

  // ── 8. QR ไม่ไปปนกับของเดิม ─────────────────────────────────────────────────────────
  await reopen();
  showSection('pos'); cart.length = 0; renderCart(); await sleep(100);
  const w0 = rpcCalls().length;
  await gun('DJLM1.GOODLINKED');
  ok('ยิง QR ที่หน้าขาย → ได้การ์ดสมาชิก ตะกร้าไม่ขยับ ไม่มีบิล', dlgOpen() && /พบสมาชิก/.test(txt()) && cart.length === 0 && selectedCustomer === null && rpcCalls().length === w0 + 1);
  await reopen();
  await gun('619659216054');
  ok('บาร์โค้ดสินค้ายังลงตะกร้าตามเดิม (ไม่กระทบ)', cart.length === 1 && cart[0].name === 'DDJ-FLX4' && !dlgOpen());
  ok('ลงตะกร้าตามเดิมโดยไม่เรียก RPC สมาชิก', rpcCalls().length === w0 + 1);
  // ผนังสต็อกโหมดรับเข้า: QR ต้องไม่เข้าถาดรับเข้าเป็นซีเรียลแปลก ๆ
  showSection('products'); setWallMode('receive'); await sleep(100);
  await gun('DJLM1.GOODLINKED');
  ok('ยิง QR ตอนผนังโหมดรับเข้า → การ์ดสมาชิก ไม่เข้าถาดรับเข้า', dlgOpen() && rcvTotal() === 0 && !document.querySelector('dialog#codeDialog[open]'));
  await reopen(); setWallMode('find');
  // มีหน้าต่างอื่นเปิดค้าง → บอกให้ปิดก่อน ไม่ทำเงียบ
  const nb = rpcCalls().length;
  $('codeDialog').showModal();
  await gun('DJLM1.GOODLINKED');
  ok('มีหน้าต่างอื่นเปิดค้างอยู่ → ไม่ยิงฐาน ขึ้นข้อความให้ปิดก่อน', rpcCalls().length === nb && /ปิดหน้าต่างที่เปิดค้างอยู่ก่อน/.test($('toast').textContent));
  $('codeDialog').close(); await sleep(60);
  // ยิง QR ใหม่ได้ขณะหน้าต่างสมาชิกเปิดอยู่
  showSection('customers'); await sleep(100); clock += 5000;
  closeCam(); document.documentElement.classList.remove('can-cam');          // จำลองคอมหน้าเคาน์เตอร์ที่ไม่มีกล้อง (เครื่องทดสอบอาจนับว่ามีกล้อง)
  mqStart(); await sleep(100);
  ok('ไม่มีกล้อง: ปุ่มเปิดหน้าต่าง "พร้อมยิง" (ข้อความบอกให้ยิงได้เลย + ช่องพิมพ์รหัส)', dlgOpen() && /ยิงด้วยเครื่องยิงบาร์โค้ดได้เลย/.test(txt()) && !!$('mqCode'));
  const nr = rpcCalls().length;
  await gun('DJLM1.GOODUNLINKED');
  ok('หน้าต่างพร้อมยิงเปิดอยู่ → ยิง QR เข้าได้ (ไม่ถูกบล็อกด้วยหน้าต่างตัวเอง)', rpcCalls().length === nr + 1 && txt().includes('ทะเบียน เท่านั้น'));

}

async function partB(bCust) {
  // ── 9. ออกจากระบบ / สลับบัญชี ────────────────────────────────────────────────────────
  await reopen();
  clock += 5000;
  const slow = memberQrScan('DJLM1.SLOW');
  await sleep(100);
  ok('ระหว่างรอ RPC หน้าต่างขึ้น "กำลังตรวจ"', dlgOpen() && /กำลังตรวจ/.test(txt()));
  doLogout(); await sleep(800); await slow;
  ok('ออกจากระบบกลางทาง → หน้าต่างปิด ผลที่มาช้าถูกทิ้ง ไม่โผล่หลังออก', !dlgOpen() && $('mqBody').innerHTML === '' && mq.view === null, $('mqBody').innerHTML);
  await login('staff@djlabsiam.com');
  await gun('DJLM1.GOODLINKED');
  ok('ล็อกอินใหม่แล้วสแกนได้ตามปกติ (สถานะไม่ค้าง)', dlgOpen() && /พบสมาชิก/.test(txt()));
  onAccountSwitched(); await sleep(80);
  ok('สลับบัญชีด้วย PIN ตอนการ์ดเปิด → การ์ดชื่อ/รหัสสมาชิกของคนเดิมหายจากจอ', !dlgOpen() && $('mqBody').innerHTML === '' && mq.view === null, $('mqBody').innerHTML);
  await gun('DJLM1.GOODLINKED');
  doLogout(); await sleep(400);
  ok('ออกจากระบบตอนการ์ดเปิด → การ์ดชื่อ/รหัสสมาชิกหายจาก DOM', !dlgOpen() && $('mqBody').innerHTML === '' && $('mqFoot').innerHTML === '');
  const nx = rpcCalls().length;
  await gun('DJLM1.GOODLINKED');
  ok('ยังไม่ล็อกอิน → ยิง QR ไม่เรียกฐาน', rpcCalls().length === nx && !dlgOpen());
  await login('owner@djlabsiam.com');
  clock += 5000;
  const slowE = memberQrScan('DJLM1.SLOWERR'); await sleep(100);
  doLogout(); await sleep(800); await slowE;
  ok('ผลผิดพลาดที่มาช้าหลังออกจากระบบถูกทิ้ง ไม่โผล่หน้าต่างหลังออก', !dlgOpen() && $('mqBody').innerHTML === '');
  await login('owner@djlabsiam.com');

  // ── 10. กล้องโหมดสมาชิก ─────────────────────────────────────────────────────────────
  document.documentElement.classList.add('can-cam');        // เหมือนเครื่องที่มีกล้อง/จอสัมผัส
  showSection('customers'); await sleep(150);
  clock += 5000;
  const nc = rpcCalls().length, cartN = cart.length;
  bCust.click(); await waitFor(() => camCanvas.width === Math.round(1280 * (SCAN_ROI_QR.right - SCAN_ROI_QR.left)), 4000);
  ok('เครื่องมีกล้อง: ปุ่มเปิดแผงกล้องโหมดสมาชิกทันที (ไม่ผ่านหน้าต่าง)', !$('camPanel').hidden && !dlgOpen() && live() === 1 && $('camMode').textContent === 'QR สมาชิก', $('camMode').textContent);
  ok('กรอบแดงเป็นกรอบ QR (คลาส qr) และปุ่ม "พิมพ์รหัสแทน" โผล่', $('camWrap').classList.contains('qr') && vis($('camMqManual')) && cam.memberOnly === true);
  ok('อ่านเฉพาะกรอบ QR (SCAN_ROI_QR) ไม่ใช่แถบบาร์โค้ด', camCanvas.width === Math.round(1280 * (SCAN_ROI_QR.right - SCAN_ROI_QR.left)) && camCanvas.height === Math.round(720 * (SCAN_ROI_QR.bottom - SCAN_ROI_QR.top)),
     camCanvas.width + 'x' + camCanvas.height);
  ok('ตกไปใช้ ZXing ที่รองรับ QR_CODE เมื่อไม่มี BarcodeDetector', !!cam.reader && !cam.detector && cam.reader.hints.get(2).includes(11));
  const rc = $('camPanel').getBoundingClientRect();
  ok('แผงกล้องอยู่ในจอทั้งแผง และปุ่มในแผงสูง ≥ 36px', rc.left >= 0 && rc.right <= innerWidth + 1 && [...$('camPanel').querySelectorAll('button')].filter(vis).every(b => b.getBoundingClientRect().height >= 30),
     JSON.stringify(rc) + ' ' + [...$('camPanel').querySelectorAll('button')].filter(vis).map(b => b.textContent + ':' + Math.round(b.getBoundingClientRect().height)).join(','));
  await read('619659216054');
  ok('กล้องโหมดสมาชิกอ่านบาร์โค้ดสินค้า → บอก "ไม่ใช่ QR สมาชิกของร้าน" ไม่ยิงฐาน ไม่ลงตะกร้า กล้องยังเปิด',
     /ไม่ใช่ QR สมาชิกของร้าน/.test($('camHint').textContent) && rpcCalls().length === nc && cart.length === cartN && !$('camPanel').hidden && live() === 1, $('camHint').textContent);
  await sleep(700);
  await read('DJLM1.GOODLINKED');
  ok('อ่าน QR สมาชิกได้ → เรียก RPC ครั้งเดียว เปิดการ์ด แล้วปิดกล้องจริง', rpcCalls().length === nc + 1 && dlgOpen() && /พบสมาชิก/.test(txt()) && $('camPanel').hidden && live() === 0 && !cam.stream);
  ok('กล้องไม่จำ token (cam.last ว่าง) และไม่ขึ้นบนแผง/จอ', cam.last === '' && !domHtml().includes('GOODLINKED') && !/DJLM1/.test($('camHint').textContent));
  ok('ปิดกล้องแล้วคืนโหมด (memberOnly false · กรอบ qr หาย · ปุ่มพิมพ์รหัสซ่อน)', cam.memberOnly === false && !$('camWrap').classList.contains('qr') && $('camMqManual').hidden);
  // "สแกนคนถัดไป" บนเครื่องมีกล้อง = เปิดกล้องใหม่
  clock += 5000;
  footBtn('สแกนคนถัดไป').click(); await sleep(700);
  ok('"สแกนคนถัดไป" → ปิดการ์ด เปิดกล้องโหมดสมาชิกอีกรอบ', !dlgOpen() && !$('camPanel').hidden && cam.memberOnly === true && live() === 1);
  // ทางสำรอง: พิมพ์รหัสแทน
  $('camMqManual').click(); await sleep(150);
  ok('"พิมพ์รหัสแทน" → ปิดกล้องจริง เปิดหน้าต่างพร้อมช่องพิมพ์รหัส', $('camPanel').hidden && live() === 0 && dlgOpen() && !!$('mqCode'));
  // กล้องปกติ (จากปุ่มกล้องของหน้าขาย) ยังเป็นแถบบาร์โค้ดเดิม
  await reopen();
  showSection('pos'); await sleep(100);
  document.querySelector('#sec-pos .cam-btn').click(); await waitFor(() => camCanvas.width === Math.round(1280 * (SCAN_ROI.right - SCAN_ROI.left)), 4000);
  ok('กล้องปกติของหน้าขายไม่ถูกกระทบ: ไม่ใช่โหมดสมาชิก กรอบบาร์โค้ดเดิม ไม่มีปุ่มพิมพ์รหัส',
     !$('camPanel').hidden && cam.memberOnly === false && !$('camWrap').classList.contains('qr') && $('camMqManual').hidden &&
     camCanvas.width === Math.round(1280 * (SCAN_ROI.right - SCAN_ROI.left)) && camCanvas.height === Math.round(720 * (SCAN_ROI.bottom - SCAN_ROI.top)), camCanvas.width + 'x' + camCanvas.height);
  closeCam();

}
</script>`;

let bad = 0;
// ส่วน A = ปุ่ม/เครื่องยิง/ข้อผิดพลาด/พิมพ์รหัส/ไม่ปนของเดิม · ส่วน B = ออกจากระบบ/สลับบัญชี/กล้อง (แยกเพราะงบเวลาเสมือน 15 วิของตัวรัน)
for (const part of ['A', 'B']) {
  for (const [name, flags] of [['คอม 1400px', ['--window-size=1400,900']], ['จอแคบแบบมือถือ 500px', ['--window-size=500,900']]]) {
    console.log('\n--- สแกน QR สมาชิก · ส่วน ' + part + ' · ' + name + ' ---');
    const r = runPage({ root, file: 'desk.html', mock: MOCK, tests: page(part), flags });
    if (!r.ok) bad++;
  }
}
process.exit(bad ? 1 : 0);
