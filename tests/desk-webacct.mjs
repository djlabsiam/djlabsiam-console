/**
 * เทสต์หมวด "บัญชีเว็บ" ของ desk.html (ก้อน 5 ของงาน "บัญชีเว็บ 2 ระดับ" · migration 083) — รัน: node tests/desk-webacct.mjs
 *
 * วิธีเดียวกับชุดอื่น: ไฟล์จริงทุกบรรทัด สลับเฉพาะแท็ก Supabase เป็นตัวปลอม · ตัวปลอม "ตัดสินสิทธิ์ ณ ตอนส่งคำขอ" (ไม่ใช่ตอนตอบ) เหมือนฐานจริง (web_admin_gate)
 * ตรวจ: ผู้รับข่าวสาร (ไม่แสดงฟิลด์อื่นนอกที่กำหนด · ปิดบังอีเมล · escape) · ชื่อเล่น (ค้น/ซ่อน/ยืนยัน/escape/คีย์มีเครื่องหมายคำพูด) ·
 *       ลบบัญชีที่ไม่ใช้ + เก็บกวาดกำพร้า (เจ้าของคนเดียว · นับก่อน→ยืนยัน→ส่งจำนวนที่เห็น · count_changed · ล้มต้องบอก) · ผู้ดูแล/พนักงาน · ออกจากระบบ/สลับบัญชี
 *   WA_ROOT=<โฟลเดอร์ที่มี desk.html อีกฉบับ> node tests/desk-webacct.mjs   ใช้ทำ mutation (console-workspace/ui-mutation/mut-webacct.mjs)
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPage, HARNESS } from './lib/page-test.mjs';

const root = process.env.WA_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');

const mockFor = cfg => `<script>
const CFG = ${JSON.stringify(cfg)};
const CALLS = [];
const MODE = { fail: {}, noFn: false, hold: null, holdName: null, hideMissing: false, role: CFG.role };
const NOW0 = Date.now();
const iso = min => new Date(NOW0 - min * 60000).toISOString();
const SUMMARY = { users: 57, line: 40, google: 20, members: 3, marketing: 120, analytics: 10, withdrawn: 4, nicknames: 3 };
// ฟิลด์ล่อ (id/อีเมลเต็ม/sub) — ฐานจริงไม่ส่งมา แต่ถ้าฐานเผลอส่ง หน้าเว็บต้องไม่เอาขึ้นจอ
const MK = Array.from({ length: 120 }, (_, i) => ({
  providers: i % 3 === 0 ? ['google', 'line'] : ['line'],
  email: i === 0 ? '<i id="xssmk">x</i>***@evil.test' : (i % 2 ? 'a***@gmail.com' : null),
  consent_at: iso(10 + i), last_active: iso(5 + i), is_member: i % 10 === 0,
  web_user_id: 'SECRET-WU-' + i, email_full: 'secret' + i + '@leak.test', provider_sub: 'SECRET-SUB-' + i }));
let NK = [
  { key: 'alpha one', nickname: 'Alpha One', kind: 'web', levels: 2, updated_at: iso(30) },
  { key: 'a\\'b"c', nickname: '<img id="xssimg" src=x onerror="window.__xss=1">', kind: 'member', levels: 5, updated_at: iso(60) },
  { key: 'delta', nickname: 'Delta', kind: 'web', levels: 0, updated_at: iso(90) },
];
let INACTIVE = { count: 3, with_email: 1, no_channel: 2, members_skipped: 1, months: 24, before: new Date(NOW0 - 24 * 30 * 86400000).toISOString() };
let ORPHANS = { count: 2 };
const FAKE = { admins: [{ id: 'u1', full_name: 'คนทดสอบ', role: CFG.role, is_active: true }] };
const clone = o => o && JSON.parse(JSON.stringify(o));
const denied = owner => ({ data: null, error: { code: '42501', message: owner ? 'เฉพาะเจ้าของเท่านั้น' : 'เฉพาะเจ้าของหรือผู้ดูแลเท่านั้น' } });
function builder(table) {
  const q = { _eq: {} };
  const rows = () => FAKE[table] || [];
  const match = () => rows().filter(r => Object.keys(q._eq).every(c => r[c] === q._eq[c]));
  const exec = async single => { const hit = match().map(clone); return single ? { data: hit[0] || null, error: null } : { data: hit, error: null, count: hit.length }; };
  Object.assign(q, {
    select() { return q; }, eq(c, v) { q._eq[c] = v; return q; },
    is() { return q; }, contains() { return q; }, order() { return q; }, gte() { return q; }, lt() { return q; }, lte() { return q; },
    limit() { return q; }, range() { return q; }, or() { return q; }, ilike() { return q; }, in() { return q; },
    single() { return exec(true); }, maybeSingle() { return exec(true); }, then(res, rej) { return exec(false).then(res, rej); },
    insert() { return q; }, update() { return q; }, upsert() { return q; }, delete() { return q; },
  });
  return q;
}
async function rpcImpl(name, args) {
  if (!/^web_admin_/.test(name)) return { data: null, error: null };
  CALLS.push({ op: 'rpc', name, args: clone(args) });
  if (MODE.hold && (!MODE.holdName || MODE.holdName === name)) await MODE.hold;
  if (MODE.noFn) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.' + name + ' in the schema cache' } };
  const ownerOnly = name === 'web_admin_inactive' || name === 'web_admin_orphans';
  const r = MODE.role;                                              // ตัดสินสิทธิ์ ณ ตอนส่งคำขอ (เหมือน web_admin_gate ที่ฐาน)
  if (ownerOnly ? r !== 'owner' : !(r === 'owner' || r === 'admin')) return denied(ownerOnly);
  if (MODE.fail[name]) return { data: null, error: { message: MODE.fail[name] } };
  args = args || {};
  if (name === 'web_admin_summary') return { data: clone(SUMMARY), error: null };
  if (name === 'web_admin_marketing') return { data: { total: MK.length, with_email: 59, rows: clone(MK.slice(args.p_offset || 0, (args.p_offset || 0) + (args.p_limit || 100))) }, error: null };
  if (name === 'web_admin_nicknames') {
    const q = (args.p_q || '').toLowerCase();
    return { data: { rows: clone(NK.filter(x => !q || x.nickname.toLowerCase().includes(q)).slice(0, args.p_limit || 50)) }, error: null };
  }
  if (name === 'web_admin_nickname_hide') {
    if (MODE.hideMissing || !NK.some(x => x.key === args.p_key)) return { data: { ok: false, reason: 'not_found' }, error: null };
    const hit = NK.find(x => x.key === args.p_key); NK = NK.filter(x => x.key !== args.p_key);
    return { data: { ok: true, nickname: hit.nickname }, error: null };
  }
  if (name === 'web_admin_inactive') {
    if (args.p_dry) return { data: Object.assign({ ok: true, dry: true }, clone(INACTIVE)), error: null };
    if (args.p_expected !== INACTIVE.count) return { data: { ok: false, error: 'count_changed', count: INACTIVE.count }, error: null };
    const n = INACTIVE.count; INACTIVE.count = 0; return { data: { ok: true, dry: false, deleted: n, kept: MODE.kept || 0 }, error: null };
  }
  if (name === 'web_admin_orphans') {
    if (args.p_dry) return { data: { ok: true, dry: true, count: ORPHANS.count }, error: null };
    if (args.p_expected !== ORPHANS.count) return { data: { ok: false, error: 'count_changed', count: ORPHANS.count }, error: null };
    const n = ORPHANS.count; ORPHANS.count = 0; return { data: { ok: true, dry: false, deleted: n }, error: null };
  }
  return { data: null, error: { message: 'no mock' } };
}
let SESSION = null, authCb = null;
window.supabase = {
  createClient: () => ({
    from: builder,
    rpc: rpcImpl,
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    storage: { from: () => ({ async upload() { return { error: null }; }, async remove() { return { error: null }; }, async createSignedUrl() { return { data: { signedUrl: 'data:,' }, error: null }; }, getPublicUrl: () => ({ data: { publicUrl: 'data:,' } }) }) },
    auth: {
      async getSession() { return { data: { session: SESSION } }; },
      async getUser() { return { data: { user: SESSION && SESSION.user } }; },
      onAuthStateChange(cb) { authCb = cb; },
      async signInWithPassword() { SESSION = { user: { id: 'u1' } }; setTimeout(() => authCb && authCb('SIGNED_IN', SESSION)); return { data: {}, error: null }; },
      async signOut() { SESSION = null; setTimeout(() => authCb && authCb('SIGNED_OUT', null)); return { error: null }; },
    },
  }),
};
</script>`;

const PRE = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${HARNESS}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);
const toast = () => $('toast').textContent;
const rpcs = name => CALLS.filter(c => c.op === 'rpc' && (!name || c.name === name));
const WA = () => rpcs().length;
async function login() { $('loginEmail').value = 'owner@djlabsiam.com'; $('loginPassword').value = 'x'; await doLogin(); await sleep(400); }
const shown = el => !!el && !el.hidden && el.offsetParent !== null;
const redOf = () => { const t = document.createElement('span'); t.style.color = 'var(--red)'; document.body.appendChild(t); const c = getComputedStyle(t).color; t.remove(); return c; };
const isRed = el => getComputedStyle(el).color === redOf();
const bold = el => parseInt(getComputedStyle(el).fontWeight, 10) >= 700;
const visibleRed = root => Array.prototype.some.call(root.querySelectorAll('.wk-red'), e => e.offsetParent !== null && isRed(e) && bold(e));
const navItem = () => document.querySelector('.nav-item[data-s="webacct"]');
const mkRows = () => $('waMkRows').querySelectorAll('tr');
const nkRows = () => $('waNkRows').querySelectorAll('tr');
const nkNames = () => Array.prototype.map.call($('waNkRows').querySelectorAll('tr td:first-child'), td => td.textContent);
const fatal = () => { const f = $('fatalError'); return f ? f.textContent : ''; };     // แถบแดง (showFatalError) — เทสต์ลบทิ้งทุกครั้งที่ตรวจเสร็จ ไม่ปล่อยให้ข้อความเก่าปนรอบถัดไป
// หน้าต่างยืนยัน: ในเบราว์เซอร์ headless แบบเวลาเสมือน เหตุการณ์ close ของ <dialog> มาช้าได้ (บางครั้งมาหลังเปิดหน้าต่างรอบใหม่แล้ว) แล้ว onclose="confirmFn = null" ของแอปจะไปล้างคำสั่งของรอบใหม่
// เบราว์เซอร์จริงส่ง close ทันที จึงไม่เกิด — เทสต์เปลี่ยนตัวฟังให้ล้างเฉพาะเมื่อหน้าต่าง "ปิดอยู่จริง" ตอนที่เหตุการณ์มาถึง (ผลเท่ากันในเบราว์เซอร์จริง)
(() => { const d = document.getElementById('confirmDialog'); d.removeAttribute('onclose'); d.addEventListener('close', () => { if (!d.open) confirmFn = null; }); })();
async function clickOk() { $('confirmOkBtn').click(); await sleep(450); }
async function cancelDlg() { $('confirmDialog').close(); await sleep(80); }
async function openSec() { showSection('webacct'); await sleep(450); }
</script>`;

// ───────── หน้า 1: เจ้าของ ─────────
const T_OWNER = PRE + `<script>
async function runTests() {
  L('=== บัญชีเว็บ: เจ้าของร้าน ===');
  await login();
  ok('เจ้าของเห็นเมนู "บัญชีเว็บ" (กลุ่มบัญชีและระบบ)', !!navItem() && /บัญชีเว็บ/.test(navItem().textContent));
  ok('ยังไม่เปิดหมวด = ยังไม่ยิงฟังก์ชันของหมวดนี้เลย', WA() === 0, WA());
  ok('มีคีย์ลัด Alt+W ในคำอธิบายเมนู/ทะเบียน', SECTIONS.find(s => s.id === 'webacct').key === 'W' && SECTIONS.find(s => s.id === 'webacct').manager === true);
  await openSec();
  ok('เปิดหมวดได้ · ชื่อหน้า · hash', !$('sec-webacct').hidden && $('pageTitle').textContent === 'บัญชีเว็บ' && location.hash === '#webacct');
  ok('โหลด 3 อย่างพร้อมกัน: ภาพรวม · ผู้รับข่าวสาร (50 แถวแรก) · ชื่อเล่น (ไม่กรอง)',
    rpcs('web_admin_summary').length === 1 && JSON.stringify(rpcs('web_admin_marketing')[0].args) === JSON.stringify({ p_limit: 50, p_offset: 0 }) &&
    JSON.stringify(rpcs('web_admin_nicknames')[0].args) === JSON.stringify({ p_q: null, p_limit: 50 }), JSON.stringify(rpcs().map(c => [c.name, c.args])));
  ok('ภาพรวม: 57 · 120 · 3 · 4', $('waStatUsers').textContent === '57' && $('waStatMarketing').textContent === '120' && $('waStatNick').textContent === '3' && $('waStatWithdrawn').textContent === '4');
  ok('แยกตามผู้ให้บริการ/สมาชิก', /LINE 40/.test($('waBreak').textContent) && /Google 20/.test($('waBreak').textContent) && /สมาชิกร้านแล้ว 3/.test($('waBreak').textContent), $('waBreak').textContent);
  ok('ขึ้นเวลาอัปเดตล่าสุด · ปุ่มรีเฟรชกลับมากดได้', /^อัปเดตล่าสุด \\d\\d:\\d\\d:\\d\\d$/.test($('waStamp').textContent) && !$('waRefresh').disabled && $('waRefresh').textContent === '↻ รีเฟรช', $('waStamp').textContent);

  // ── ผู้รับข่าวสาร ──
  ok('ตารางแสดง 50 แถว · ตัวนับ "แถว 1–50 จาก 120"', mkRows().length === 50 && $('waMkPager').textContent === 'แถว 1–50 จาก 120', $('waMkPager').textContent + ' / ' + mkRows().length);
  ok('หัวคอลัมน์ตรงข้อมูล: "บันทึกความยินยอมล่าสุดเมื่อ" (ไม่ใช่ "ติ๊กรับข่าวสารเมื่อ")', /บันทึกความยินยอมล่าสุดเมื่อ/.test(document.querySelector('#sec-webacct thead').textContent) && !/ติ๊กรับข่าวสารเมื่อ/.test($('sec-webacct').textContent));
  ok('วันที่ในตารางผู้รับข่าวสารแสดงเป็นวัน (ฐานปัดเป็นวันแล้ว — ไม่มีเวลา)', Array.prototype.every.call($('waMkRows').querySelectorAll('tr'), tr => !/:/.test(tr.children[2].textContent + tr.children[3].textContent) && tr.children[2].textContent.trim().length > 0), $('waMkRows').querySelector('tr').textContent);
  ok('ข้อความกำกับ: อีเมลปิดบัง ส่งจริงทำนอกคอนโซล — แดงตัวหนา', visibleRed($('waMkInfo')) && /ปิดบัง/.test($('waMkInfo').textContent));
  const body = $('waMkRows').innerHTML + $('waMkRows').textContent;
  ok('ไม่มีฟิลด์ล่อ (id / อีเมลเต็ม / sub) ขึ้นจอ', !/SECRET|leak\\.test|secret\\d/.test(body), body.slice(0, 200));
  ok('อีเมลที่ฐานปิดบังแล้วแสดงตามนั้น · คนไม่มีอีเมลเห็น "ไม่มีอีเมล"', /a\\*\\*\\*@gmail\\.com/.test($('waMkRows').textContent) && /ไม่มีอีเมล/.test($('waMkRows').textContent));
  ok('ค่าจากฐานถูก escape: ไม่เกิดแท็ก <i> ในตาราง', !document.getElementById('xssmk') && /<i id="xssmk">/.test($('waMkRows').textContent));
  ok('ผู้ให้บริการ "Google + LINE" กับธง "✓ สมาชิก"', /Google \\+ LINE/.test($('waMkRows').textContent) && /✓ สมาชิก/.test($('waMkRows').textContent));
  ok('หน้าแรก: ปุ่ม "ก่อนหน้า" กดไม่ได้ · "ถัดไป" กดได้', $('waMkPrev').disabled && !$('waMkNext').disabled);
  $('waMkNext').click(); await sleep(350);
  ok('ถัดไป: ขอ p_offset 50 · "แถว 51–100 จาก 120"', rpcs('web_admin_marketing').pop().args.p_offset === 50 && $('waMkPager').textContent === 'แถว 51–100 จาก 120', $('waMkPager').textContent);
  $('waMkNext').click(); await sleep(350);
  ok('หน้าสุดท้าย 101–120 (20 แถว) · "ถัดไป" กดไม่ได้', $('waMkPager').textContent === 'แถว 101–120 จาก 120' && mkRows().length === 20 && $('waMkNext').disabled && !$('waMkPrev').disabled, $('waMkPager').textContent);
  $('waMkPrev').click(); await sleep(350); $('waMkPrev').click(); await sleep(350);
  ok('ย้อนกลับถึงหน้าแรก ไม่ติดลบ', rpcs('web_admin_marketing').pop().args.p_offset === 0 && $('waMkPrev').disabled);
  // ปุ่มถูกปิดที่หน้าแรกอยู่แล้ว แต่ตัวจัดการต้องกันเองด้วย (คลิกซ้อนจากหน้าที่ยังไม่วาดใหม่) — บังคับปลดปุ่มแล้วกด
  $('waMkPrev').disabled = false; $('waMkPrev').click(); await sleep(350);
  { // กดรัวระหว่างโหลด: ไปหน้าถัดไปแค่ครั้งเดียว ไม่ข้ามหน้า
    const nM = rpcs('web_admin_marketing').length; let relP; MODE.hold = new Promise(r => { relP = r; });
    $('waMkNext').click(); await sleep(60); $('waMkNext').click(); await sleep(60); $('waMkNext').click(); await sleep(60);
    relP(); MODE.hold = null; await sleep(450);
    ok('กดถัดไปรัว 3 ครั้งระหว่างโหลด: ขอแค่ครั้งเดียว · อยู่หน้า 2 (ไม่ข้ามหน้า)', rpcs('web_admin_marketing').length === nM + 1 && $('waMkPager').textContent === 'แถว 51–100 จาก 120', rpcs('web_admin_marketing').length - nM + ' / ' + $('waMkPager').textContent);
    const nP = rpcs('web_admin_marketing').length; MODE.hold = new Promise(r => { relP = r; });
    $('waMkPrev').click(); await sleep(60); $('waMkPrev').click(); await sleep(60);
    relP(); MODE.hold = null; await sleep(450);
    ok('กดย้อนรัว 2 ครั้งระหว่างโหลด: ขอแค่ครั้งเดียว · กลับหน้าแรก', rpcs('web_admin_marketing').length === nP + 1 && $('waMkPager').textContent === 'แถว 1–50 จาก 120', rpcs('web_admin_marketing').length - nP + ' / ' + $('waMkPager').textContent);
  }
  ok('กดย้อนซ้ำที่หน้าแรก (บังคับปลดปุ่ม): ขอ offset 0 ไม่ใช่ติดลบ', rpcs('web_admin_marketing').pop().args.p_offset === 0 && mkRows().length === 50, String(rpcs('web_admin_marketing').pop().args.p_offset));

  // ── ชื่อเล่น ──
  ok('ชื่อเล่นบนกระดาน 3 ชื่อ · มีปุ่ม "ซ่อน" ทุกแถว', nkRows().length === 3 && $('waNkRows').querySelectorAll('button[data-wa-hide]').length === 3);
  ok('ชื่อเล่นจากผู้เล่นถูก escape: ไม่เกิด <img> · สคริปต์ไม่รัน', !document.getElementById('xssimg') && !window.__xss && /<img id="xssimg"/.test($('waNkRows').textContent));
  ok('บอกชนิด สมาชิก/ผู้ใช้ทั่วไป · จำนวนด่าน', /สมาชิก/.test(nkRows()[1].textContent) && /ผู้ใช้ทั่วไป/.test(nkRows()[0].textContent) && /5/.test(nkRows()[1].textContent));
  $('waNkSearch').value = '  alpha '; $('waNkSearch').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await sleep(350);
  ok('ค้น (Enter): ส่ง p_q ตัดช่องว่าง · เหลือ 1 ชื่อ', rpcs('web_admin_nicknames').pop().args.p_q === 'alpha' && JSON.stringify(nkNames()) === '["Alpha One"]', JSON.stringify(nkNames()));
  ok('ค้นแล้วข้อความบอกคำค้น', /alpha/.test($('waNkInfo').textContent));
  $('waNkSearch').value = 'zzzz'; $('waNkGo').click(); await sleep(350);
  ok('ค้นไม่เจอ: บอกว่าไม่พบ', /ไม่พบชื่อเล่นที่ตรงกัน/.test($('waNkRows').textContent));
  $('waNkSearch').value = 'x'.repeat(100); $('waNkGo').click(); await sleep(350);
  ok('คำค้นยาวเกินถูกตัดที่ 40 ตัว', rpcs('web_admin_nicknames').pop().args.p_q.length === 40);
  $('waNkSearch').value = ''; $('waNkGo').click(); await sleep(350);
  { // คำขอแรก (alpha) ค้างอยู่ คำขอที่สอง (delta) เสร็จก่อน แล้วค่อยปล่อยคำขอแรก — ผลสุดท้ายต้องเป็นของคำขอที่สอง
    let relA; MODE.hold = new Promise(r => { relA = r; }); MODE.holdName = 'web_admin_nicknames';
    $('waNkSearch').value = 'alpha'; $('waNkGo').click(); await sleep(60);
    MODE.hold = null; MODE.holdName = null;
    $('waNkSearch').value = 'delta'; $('waNkGo').click(); await sleep(350);
    relA(); await sleep(350);
    ok('ค้นสองครั้งติดกัน คำขอเก่ากลับมาทีหลัง: ผลสุดท้ายเป็นของคำค้นล่าสุด (Delta) ไม่ถูกทับด้วย Alpha', JSON.stringify(nkNames()) === '["Delta"]' && /delta/.test($('waNkInfo').textContent), JSON.stringify(nkNames()));
    $('waNkSearch').value = ''; $('waNkGo').click(); await sleep(350);
  }
  { // คำขอเก่าจบก่อนคำขอใหม่: ปุ่มรีเฟรชต้องยังเป็น "กำลังโหลด…" จนกว่าคำขอใหม่จะจบ (คำขอเก่าไม่แตะปุ่ม)
    let relA, relB; MODE.hold = new Promise(r => { relA = r; }); MODE.holdName = 'web_admin_nicknames';
    $('waNkSearch').value = 'alpha'; $('waNkGo').click(); await sleep(60);
    MODE.hold = new Promise(r => { relB = r; });
    $('waNkSearch').value = 'delta'; $('waNkGo').click(); await sleep(60);
    MODE.hold = null; MODE.holdName = null;
    relA(); await sleep(250);
    ok('คำขอเก่าจบก่อนคำขอใหม่: ปุ่มรีเฟรชยัง "กำลังโหลด…" (คำขอใหม่ยังไม่จบ) · ผลเก่าไม่ขึ้นหน้า', $('waRefresh').disabled && $('waRefresh').textContent === 'กำลังโหลด…' && nkNames().length === 3, $('waRefresh').textContent + ' / ' + JSON.stringify(nkNames()));
    relB(); await sleep(350);
    ok('คำขอใหม่จบ: ปุ่มกลับมา · ผลเป็นของคำค้นล่าสุด (Delta)', !$('waRefresh').disabled && JSON.stringify(nkNames()) === '["Delta"]', JSON.stringify(nkNames()));
    $('waNkSearch').value = ''; $('waNkGo').click(); await sleep(350);
  }
  ok('ล้างคำค้น: ส่ง p_q = null · กลับมา 3 ชื่อ', rpcs('web_admin_nicknames').pop().args.p_q === null && nkRows().length === 3);

  // ── ซ่อนชื่อเล่น ──
  const hideBtn = key => Array.prototype.find.call($('waNkRows').querySelectorAll('button[data-wa-hide]'), b => b.dataset.waHide === key);
  const nHide0 = rpcs('web_admin_nickname_hide').length;
  hideBtn('a\\'b"c').click(); await sleep(150);
  ok('กดซ่อน: ขึ้นหน้าต่างยืนยัน ระบุชื่อ (escape) · ยังไม่ซ่อน', $('confirmDialog').open && $('confirmTitle').textContent === 'ซ่อนชื่อเล่น' &&
    /<img id="xssimg"/.test($('confirmBody').textContent) && !document.getElementById('xssimg') && rpcs('web_admin_nickname_hide').length === nHide0);
  ok('คำเตือนในหน้าต่างยืนยันเป็นแดงตัวหนา', visibleRed($('confirmBody')) || Array.prototype.some.call($('confirmBody').querySelectorAll('.alert-red'), e => bold(e)));
  await cancelDlg();
  ok('ยกเลิก: ไม่เรียกฟังก์ชันซ่อน · ชื่อยังอยู่', rpcs('web_admin_nickname_hide').length === nHide0 && nkRows().length === 3);
  hideBtn('a\\'b"c').click(); await sleep(150); await clickOk();
  const hc = rpcs('web_admin_nickname_hide').pop();
  ok('ยืนยัน: ส่งคีย์ตรงเป๊ะ (มีเครื่องหมายคำพูดเดี่ยว/คู่) ครั้งเดียว', rpcs('web_admin_nickname_hide').length === nHide0 + 1 && hc.args.p_key === 'a\\'b"c', JSON.stringify(hc));
  ok('ซ่อนแล้ว: หน้าต่างปิด · รายการโหลดใหม่ ชื่อหายไป · ขึ้นข้อความสำเร็จ', !$('confirmDialog').open && nkRows().length === 2 && !/xssimg/.test($('waNkRows').textContent) && /ซ่อนชื่อเล่น/.test(toast()), toast());
  ok('ปุ่มซ่อนคีย์ธรรมดาทำงานด้วย (alpha one)', !!hideBtn('alpha one'));
  hideBtn('delta').click(); await sleep(150);
  MODE.hideMissing = true; await clickOk(); MODE.hideMissing = false;
  ok('ซ่อนชื่อที่ไม่มีแล้ว (not_found): บอกว่าไม่พบ ไม่ขึ้นว่าสำเร็จ · โหลดใหม่', /ไม่พบชื่อเล่นนี้แล้ว/.test(toast()) && !/✅/.test(toast()), toast());
  hideBtn('delta').click(); await sleep(150);
  MODE.fail.web_admin_nickname_hide = 'พังจำลอง'; await clickOk();
  ok('ฐานล้มตอนซ่อน: แถบแดงบอกเหตุ ไม่ขึ้นว่าสำเร็จ · ชื่อยังอยู่', /ซ่อนชื่อเล่นไม่สำเร็จ: พังจำลอง/.test(fatal()) && nkNames().includes('Delta'), fatal());
  MODE.fail.web_admin_nickname_hide = null; if ($('fatalError')) $('fatalError').remove();

  // ── ลบบัญชีที่ไม่ใช้ (เจ้าของเท่านั้น) ──
  ok('เจ้าของเห็นส่วนลบบัญชีที่ไม่ใช้/เก็บกวาด', shown($('waOwner')));
  ok('คำเตือน "ไม่ส่งแจ้งเตือนก่อนลบ" แดงตัวหนา มองเห็นตลอด', Array.prototype.some.call($('waOwner').querySelectorAll('.alert-red'), e => e.offsetParent !== null && /ไม่ส่งแจ้งเตือนก่อนลบ/.test(e.textContent) && bold(e)));
  ok('ยังไม่กดตรวจ = ยังไม่ยิงฟังก์ชันลบ/นับ', rpcs('web_admin_inactive').length === 0 && rpcs('web_admin_orphans').length === 0 && $('waInactiveGo').hidden);
  $('waInactiveCheck').click(); await sleep(350);
  ok('ตรวจ: ส่ง p_dry true + 24 เดือน', JSON.stringify(rpcs('web_admin_inactive')[0].args) === JSON.stringify({ p_dry: true, p_months: 24 }), JSON.stringify(rpcs('web_admin_inactive')[0]));
  ok('ผลตรวจ: 3 บัญชี · มีอีเมล 1 · ไม่มีช่องทาง 2 · ข้ามสมาชิก 1 — จำนวนเป็นแดงตัวหนา', /3 บัญชี/.test($('waInactive').textContent) && /มีอีเมลในระบบ 1/.test($('waInactive').textContent) && /หน้านี้ดูอีเมลเต็มไม่ได้ · ร้านไม่มีระบบแจ้งก่อนลบ/.test($('waInactive').textContent) && !/ติดต่อทางอื่นได้/.test($('waInactive').textContent) && /ไม่มีช่องทางติดต่อเลย 2/.test($('waInactive').textContent) && /ข้ามบัญชีที่เป็นสมาชิกร้านแล้ว 1/.test($('waInactive').textContent) && visibleRed($('waInactive')), $('waInactive').textContent);
  ok('ปุ่มลบขึ้น "ลบ 3 บัญชี…" (btn-danger)', shown($('waInactiveGo')) && $('waInactiveGo').textContent === 'ลบ 3 บัญชี…' && $('waInactiveGo').classList.contains('btn-danger'));
  ok('ตรวจเฉย ๆ ไม่ลบอะไร (ไม่มี dry=false)', rpcs('web_admin_inactive').every(c => c.args.p_dry === true));
  $('waInactiveGo').click(); await sleep(150);
  ok('กดลบ: หน้าต่างยืนยัน ระบุจำนวน/ผลที่ตามมา/ไม่แจ้งล่วงหน้า — แดงตัวหนา · ยังไม่ลบ', $('confirmDialog').open && /3 บัญชี/.test($('confirmBody').textContent) && /ไม่ได้รับแจ้งล่วงหน้า/.test($('confirmBody').textContent) && visibleRed($('confirmBody')) && rpcs('web_admin_inactive').every(c => c.args.p_dry === true));
  await cancelDlg();
  ok('ยกเลิก: ไม่ลบ', rpcs('web_admin_inactive').every(c => c.args.p_dry === true) && INACTIVE.count === 3);
  // จำนวนเปลี่ยนระหว่างรอ
  INACTIVE.count = 5; MODE.kept = 1;
  $('waInactiveGo').click(); await sleep(150); await clickOk();
  const del1 = rpcs('web_admin_inactive').filter(c => c.args.p_dry === false)[0];
  ok('ยืนยัน: ส่ง p_expected = จำนวนที่เห็นตอนตรวจ (3) + 24 เดือน', JSON.stringify(del1.args) === JSON.stringify({ p_dry: false, p_expected: 3, p_months: 24 }), JSON.stringify(del1));
  ok('จำนวนเปลี่ยน (count_changed): ไม่ลบ · บอกให้รู้ · ตรวจจำนวนใหม่ให้ (5 บัญชี) · ปุ่มลบอัปเดตเป็น 5', INACTIVE.count === 5 && /จำนวนเปลี่ยนไปประหว่างรอ/.test($('waInactive').textContent.replace('ระหว่าง', 'ประหว่าง')) && /5 บัญชี/.test($('waInactive').textContent) && $('waInactiveGo').textContent === 'ลบ 5 บัญชี…' && !$('confirmDialog').open, $('waInactive').textContent);
  $('waInactiveGo').click(); await sleep(150); await clickOk();
  ok('ฐานรายงานว่าข้ามผู้ที่เพิ่งกลับมาใช้งาน 1 บัญชี: ข้อความบอกจำนวนที่ข้าม', /ข้าม 1 บัญชีที่เพิ่งกลับมาใช้งาน/.test($('waInactive').textContent), $('waInactive').textContent); MODE.kept = 0;
  ok('ยืนยันรอบสอง (ส่ง 5): ลบสำเร็จ · ข้อความ ✅ ลบบัญชีแล้ว 5 บัญชี · ปุ่มลบหาย', INACTIVE.count === 0 && /✅ ลบบัญชีแล้ว 5 บัญชี/.test($('waInactive').textContent) && $('waInactiveGo').hidden && /ลบบัญชีแล้ว 5/.test(toast()), $('waInactive').textContent);
  $('waInactiveCheck').click(); await sleep(350);
  ok('ตรวจอีกครั้ง = 0: บอกว่าไม่มี · ไม่มีปุ่มลบ', /ไม่มีบัญชีที่ไม่ใช้เกิน 24 เดือน/.test($('waInactive').textContent) && $('waInactiveGo').hidden, $('waInactive').textContent);
  INACTIVE.count = 2;
  MODE.fail.web_admin_inactive = 'พังจำลอง'; $('waInactiveCheck').click(); await sleep(350);
  ok('ตรวจแล้วฐานล้ม: ข้อความแดงบอกเหตุ · ไม่มีปุ่มลบ', /ตรวจจำนวนไม่สำเร็จ: พังจำลอง/.test($('waInactive').textContent) && $('waInactiveGo').hidden && visibleRed($('waInactive')));
  MODE.fail.web_admin_inactive = null; $('waInactiveCheck').click(); await sleep(350);
  $('waInactiveGo').click(); await sleep(150);
  MODE.fail.web_admin_inactive = 'พังจำลอง'; await clickOk(); MODE.fail.web_admin_inactive = null;
  ok('ลบแล้วฐานล้ม: แถบแดงบอกเหตุ · ไม่ขึ้นว่าลบแล้ว · ปุ่มลบหาย (ต้องตรวจใหม่ก่อนสั่งซ้ำ)', /ลบบัญชีที่ไม่ใช้ไม่สำเร็จ: พังจำลอง/.test(fatal()) && !/✅/.test($('waInactive').textContent) && $('waInactiveGo').hidden && INACTIVE.count === 2, fatal());
  if ($('fatalError')) $('fatalError').remove();

  // ── เก็บกวาดกำพร้า ──
  $('waOrphanCheck').click(); await sleep(350);
  ok('ตรวจกำพร้า: p_dry true · 2 บัญชี · ปุ่ม "ลบบัญชี Auth ที่ค้าง 2 บัญชี…"', JSON.stringify(rpcs('web_admin_orphans')[0].args) === JSON.stringify({ p_dry: true }) && /2 บัญชี/.test($('waOrphan').textContent) && /2 บัญชี…/.test($('waOrphanGo').textContent) && shown($('waOrphanGo')), $('waOrphanGo').textContent);
  $('waOrphanGo').click(); await sleep(150); await clickOk();
  const dg = rpcs('web_admin_orphans').filter(c => c.args.p_dry === false)[0];
  ok('ยืนยัน: ส่ง p_expected 2 · ลบสำเร็จ · ข้อความ ✅', JSON.stringify(dg.args) === JSON.stringify({ p_dry: false, p_expected: 2 }) && ORPHANS.count === 0 && /✅ ลบบัญชี Auth ที่ค้างแล้ว 2 บัญชี/.test($('waOrphan').textContent), JSON.stringify(dg));
  $('waOrphanCheck').click(); await sleep(350);
  ok('ตรวจซ้ำ = 0: บอกว่าไม่มี', /ไม่มีบัญชี Auth ที่ค้าง/.test($('waOrphan').textContent) && $('waOrphanGo').hidden);

  // ── รีเฟรช/ล้มเหลว/ยังไม่ติดตั้ง ──
  $('waRefresh').click();
  ok('กดรีเฟรช: ปุ่ม "กำลังโหลด…" กดซ้ำไม่ได้', $('waRefresh').disabled && $('waRefresh').textContent === 'กำลังโหลด…');
  await sleep(350);
  ok('รีเฟรชเสร็จ: ปุ่มกลับมา', !$('waRefresh').disabled && $('waRefresh').textContent === '↻ รีเฟรช');
  MODE.fail.web_admin_summary = 'พังจำลอง'; $('waRefresh').click(); await sleep(400);
  ok('โหลดล้ม: กล่องแดงตัวหนา + แถบแดง · ปุ่มกลับมากดได้', /โหลดข้อมูลบัญชีเว็บไม่สำเร็จ: พังจำลอง/.test($('waAlert').textContent) && bold($('waAlert').querySelector('.alert-red')) && /โหลดข้อมูลบัญชีเว็บไม่สำเร็จ/.test(fatal()) && !$('waRefresh').disabled, $('waAlert').textContent);
  MODE.fail.web_admin_summary = null; if ($('fatalError')) $('fatalError').remove();
  MODE.noFn = true; $('waRefresh').click(); await sleep(400); MODE.noFn = false;
  ok('ยังไม่รัน 083: บอกให้รัน migration (เตือนเหลือง) ไม่ใช่ error ดิบ/แถบแดง', /ต้องรัน migration 080–083/.test($('waAlert').textContent) && !!$('waAlert').querySelector('.alert-warn') && fatal() === '', $('waAlert').textContent);
  $('waRefresh').click(); await sleep(400);
  ok('รีเฟรชแล้วกลับมาปกติ: ข้อความเตือนหาย', $('waAlert').innerHTML === '' && mkRows().length === 50);
  const origRpc = db.rpc; db.rpc = () => { throw new Error('เน็ตหลุดจำลอง'); };
  $('waRefresh').click(); await sleep(400); db.rpc = origRpc;
  ok('คำขอล้มทั้งก้อน (throw): แจ้งแถบแดง ไม่เงียบ · ปุ่มกลับมา', /เน็ตหลุดจำลอง/.test(fatal()) && !$('waRefresh').disabled, fatal());
  if ($('fatalError')) $('fatalError').remove();
  { // คำขอเก่าที่ถูกคำขอใหม่แทนที่แล้วค่อยล้ม (throw): ต้องไม่ขึ้นแถบแดงหลอก (ผู้ใช้เห็นผลของคำขอใหม่ที่สำเร็จอยู่แล้ว)
    let rejA; const pA = new Promise((_, rej) => { rejA = rej; }); const origRpc2 = db.rpc; db.rpc = () => pA;
    $('waRefresh').click(); await sleep(60);
    db.rpc = origRpc2;
    $('waNkSearch').value = ''; $('waNkGo').click(); await sleep(350);
    rejA(new Error('เก่า-ล้ม')); await sleep(250);
    ok('คำขอเก่าที่ถูกแทนที่ล้มทีหลัง (throw): ไม่ขึ้นแถบแดงหลอก · ตารางยังเป็นผลของคำขอใหม่', !/เก่า-ล้ม/.test(fatal()) && !$('waRefresh').disabled && mkRows().length === 50, fatal());
    if ($('fatalError')) $('fatalError').remove();
  }

  // ── ตัวหนังสือ ≥ 14px ──
  const small = [];
  $('sec-webacct').querySelectorAll('*').forEach(el => { if (el.offsetParent !== null && Array.prototype.some.call(el.childNodes, n => n.nodeType === 3 && n.textContent.trim())) { const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 14) small.push(el.tagName + '.' + el.className + ':' + fs); } });
  ok('ตัวหนังสือทุกชิ้นในหมวดไม่เล็กกว่า 14px', small.length === 0, small.join(', '));

  // ── ออกจากระบบ/สลับบัญชี/ผลที่มาช้า ──
  $('waInactiveCheck').click(); await sleep(350);
  $('waInactiveGo').click(); await sleep(150);
  ok('ก่อนสลับ: หน้าต่างยืนยันค้างอยู่พร้อมข้อมูล', $('confirmDialog').open && $('confirmBody').textContent.length > 0);
  onAccountSwitched(); await sleep(100);
  ok('สลับบัญชี: หน้าต่างยืนยันปิด+ล้างเนื้อหา · รายการ/ภาพรวม/ผลตรวจล้างหมด · ส่วนเจ้าของซ่อน',
    !$('confirmDialog').open && $('confirmBody').innerHTML === '' && mkRows().length === 0 && nkRows().length === 0 && $('waStatUsers').textContent === '0' &&
    $('waInactive').textContent === '' && $('waInactiveGo').hidden && $('waOwner').hidden && $('waMkInfo').textContent === '' && $('waNkSearch').value === '');
  await openSec();
  ok('เปิดหมวดใหม่หลังสลับ: โหลดข้อมูลใหม่', mkRows().length === 50 && $('waStatUsers').textContent === '57');

  // ── waReset() เดี่ยว ๆ: ตัวล้างของหมวดอื่นที่ถูกเรียกต่อกัน (opsReset/catReset…) ล้างหน้าต่างยืนยันซ้ำให้อยู่แล้ว จึงต้องตรวจสัญญาของ waReset เอง ──
  $('waMkNext').click(); await sleep(350);
  $('waNkSearch').value = 'alpha'; $('waNkGo').click(); await sleep(350);
  $('waInactiveCheck').click(); await sleep(350);
  $('waInactiveGo').click(); await sleep(150);
  ok('ก่อน waReset: หน้าต่างยืนยันค้าง · มีผลตรวจค้าง · อยู่หน้า 2 · มีคำค้น', $('confirmDialog').open && !!wa.jobs.inactive && wa.mkOff === 50 && wa.nkQ === 'alpha', JSON.stringify(wa));
  waReset(); await sleep(100);
  ok('waReset เดี่ยว ๆ: ปิดหน้าต่างยืนยัน · ล้างชื่อเรื่อง/เนื้อหา (ชื่อเล่นไม่ค้าง)', !$('confirmDialog').open && $('confirmBody').innerHTML === '' && $('confirmTitle').textContent === 'ยืนยัน');
  ok('waReset เดี่ยว ๆ: ล้างสถานะหน้า/คำค้น/ผลตรวจที่ค้างทั้งสองงาน', wa.mkOff === 0 && wa.nkQ === '' && wa.jobs.inactive === null && wa.jobs.orphans === null, JSON.stringify(wa));
  waConfirm('inactive'); await sleep(100);
  ok('หลัง waReset: waConfirm ที่ค้างไม่เปิดหน้าต่าง (ไม่ลบในนามผลตรวจของคนเดิม)', !$('confirmDialog').open);
  // ผู้ใช้เดิมแต่เลขรอบเปลี่ยน (waReset) ระหว่างโหลด: ผลเก่าต้องถูกทิ้งด้วยเลขรอบ ไม่ใช่เพราะ uid เปลี่ยน
  let rel1; MODE.hold = new Promise(r => { rel1 = r; });
  $('waRefresh').click(); await sleep(100);
  waReset();
  rel1(); MODE.hold = null; await sleep(400);
  ok('ผลโหลดที่มาช้าหลัง waReset (ผู้ใช้เดิม): ถูกทิ้งด้วยเลขรอบ · ตารางว่าง · ปุ่มรีเฟรชกลับมา', mkRows().length === 0 && nkRows().length === 0 && $('waStatUsers').textContent === '0' && !$('waRefresh').disabled);
  await openSec();
  ok('เปิดหมวดอีกครั้งหลัง waReset: กลับมาโหลดปกติ (หน้าแรก ไม่มีคำค้น)', mkRows().length === 50 && rpcs('web_admin_marketing').pop().args.p_offset === 0 && rpcs('web_admin_nicknames').pop().args.p_q === null);

  // ออกจากระบบขณะอยู่หมวดนี้ แล้วเข้าใหม่: ต้องมีข้อมูลกลับมา (ไม่ใช่ตัวเลข 0/ตารางว่างที่หลอกเจ้าของ)
  await db.auth.signOut(); await sleep(300);
  ok('ออกจากระบบ: หน้าว่างเปล่า (ล้างแล้ว)', mkRows().length === 0 && $('waStatUsers').textContent === '0');
  await login();
  ok('เข้าสู่ระบบใหม่ขณะ hash ยังเป็นหมวดนี้: โหลดข้อมูลกลับมาเอง (ตาราง 50 แถว · ภาพรวม 57 · ส่วนเจ้าของโผล่)', mkRows().length === 50 && $('waStatUsers').textContent === '57' && shown($('waOwner')), $('waStatUsers').textContent + ' / ' + mkRows().length);
  // สลับบัญชีด้วย PIN เจ้าของ → ผู้ดูแล ขณะอยู่หมวดนี้: ข้อมูลโหลดกลับ แต่ส่วนเจ้าของคนเดียวต้องหาย
  FAKE.admins = [{ id: 'u2', full_name: 'ผู้ดูแลทดสอบ', role: 'admin', is_active: true }]; MODE.role = 'admin'; SESSION = { user: { id: 'u2' } };
  onAccountSwitched(); authCb('SIGNED_IN', SESSION); await sleep(600);
  ok('สลับ PIN เจ้าของ→ผู้ดูแล ขณะอยู่หมวดนี้: โหลดข้อมูลกลับ (50 แถว · 57) · ส่วนเจ้าของซ่อน', !$('sec-webacct').hidden && mkRows().length === 50 && $('waStatUsers').textContent === '57' && !shown($('waOwner')), $('waStatUsers').textContent + ' / ' + mkRows().length + ' / ' + shown($('waOwner')));
  FAKE.admins = [{ id: 'u1', full_name: 'คนทดสอบ', role: 'owner', is_active: true }]; MODE.role = 'owner'; SESSION = { user: { id: 'u1' } };
  onAccountSwitched(); authCb('SIGNED_IN', SESSION); await sleep(600);
  ok('สลับกลับเป็นเจ้าของ: ส่วนเจ้าของกลับมา · ข้อมูลครบ', mkRows().length === 50 && shown($('waOwner')));

  // ผลที่มาช้าหลังออกจากระบบต้องถูกทิ้ง
  let release; MODE.hold = new Promise(r => { release = r; });
  $('waRefresh').click(); await sleep(100);
  await db.auth.signOut(); await sleep(300);
  release(); MODE.hold = null; await sleep(400);
  ok('ผลที่มาช้าหลังออกจากระบบ: ถูกทิ้ง ไม่ขึ้นหน้า (ตาราง/ภาพรวมว่าง)', mkRows().length === 0 && nkRows().length === 0 && $('waStatUsers').textContent === '0', mkRows().length);
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

// ───────── หน้า 2: ผู้ดูแล (admin) ─────────
const T_ADMIN = PRE + `<script>
async function runTests() {
  L('=== บัญชีเว็บ: ผู้ดูแล (admin) ===');
  await login();
  ok('ผู้ดูแลเห็นเมนู "บัญชีเว็บ"', !!navItem());
  await openSec();
  ok('เปิดหมวดได้ · โหลดภาพรวม/ผู้รับข่าวสาร/ชื่อเล่น', !$('sec-webacct').hidden && mkRows().length === 50 && nkRows().length === 3 && $('waStatUsers').textContent === '57');
  ok('ส่วนลบบัญชีที่ไม่ใช้/เก็บกวาด ซ่อนอยู่ (เจ้าของคนเดียว)', !shown($('waOwner')) && $('waOwner').hidden);
  const n0 = WA();
  $('waInactiveCheck').click(); $('waOrphanCheck').click(); await sleep(250);
  ok('แม้สั่งตรง ๆ: ไม่ยิงฟังก์ชันตรวจ/ลบของเจ้าของ (หน้าเว็บกันไว้ · ฐานตัดสินซ้ำ)', WA() === n0 && rpcs('web_admin_inactive').length === 0 && rpcs('web_admin_orphans').length === 0, WA() - n0);
  waConfirm('inactive'); waConfirm('orphans'); await sleep(100);
  ok('ไม่มีหน้าต่างยืนยันขึ้น', !$('confirmDialog').open);
  // มีผลตรวจค้างอยู่ในหน่วยความจำ (เช่นโค้ดส่วนอื่นเผลอตั้ง) — ผู้ดูแลก็ต้องยืนยันลบไม่ได้ ด่านเจ้าของของ waConfirm ต้องกันเอง
  wa.jobs.inactive = { count: 3, with_email: 0, no_channel: 3, members_skipped: 0, months: 24 };
  waConfirm('inactive'); await sleep(100);
  ok('ผู้ดูแลมีผลตรวจค้าง: waConfirm ก็ไม่เปิดหน้าต่างยืนยัน (ด่านเจ้าของของมันเอง)', !$('confirmDialog').open && rpcs('web_admin_inactive').length === 0);
  wa.jobs.inactive = null;
  // ผู้ดูแลซ่อนชื่อเล่นได้
  Array.prototype.find.call($('waNkRows').querySelectorAll('button[data-wa-hide]'), b => b.dataset.waHide === 'delta').click(); await sleep(150); await clickOk();
  ok('ผู้ดูแลซ่อนชื่อเล่นได้', rpcs('web_admin_nickname_hide').length === 1 && !nkNames().includes('Delta'));
  // ฐานตัดสินซ้ำ: ถ้าหน้าเว็บพลาดเรียก ฐานปฏิเสธ
  const direct = await db.rpc('web_admin_inactive', { p_dry: true, p_months: 24 });
  ok('ฐานปฏิเสธผู้ดูแลที่เรียกฟังก์ชันของเจ้าของตรง ๆ (42501)', direct.error && direct.error.code === '42501' && direct.data === null, JSON.stringify(direct));
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

// ───────── หน้า 3: พนักงาน (staff) ─────────
const T_STAFF = PRE + `<script>
async function runTests() {
  L('=== บัญชีเว็บ: พนักงาน (staff) ===');
  await login();
  ok('พนักงานไม่เห็นเมนู "บัญชีเว็บ"', !navItem() || navItem().hidden || navItem().offsetParent === null);
  const r = showSection('webacct'); await sleep(300);
  ok('เปิดหมวดตรง ๆ ไม่ได้: ปฏิเสธ + บอกเหตุ', r === false && $('sec-webacct').hidden && /เจ้าของร้านหรือผู้ดูแล/.test(toast()), toast());
  ok('ไม่มีการยิงฟังก์ชันของหมวดนี้เลย', WA() === 0, WA());
  await waLoad(); await sleep(100);
  ok('สั่งโหลดตรง ๆ ก็ไม่ยิง (guard isManager)', WA() === 0);
  location.hash = '#webacct'; await sleep(400);
  ok('พิมพ์ #webacct ตรง ๆ: ถูกส่งกลับหน้าแรก (หมวดจำกัดสิทธิ์) · ยังไม่ยิงฟังก์ชัน', $('sec-webacct').hidden && WA() === 0 && location.hash !== '#webacct', location.hash);
  const direct = await db.rpc('web_admin_summary');
  ok('ฐานปฏิเสธพนักงานที่เรียกตรง ๆ (42501)', direct.error && direct.error.code === '42501', JSON.stringify(direct));
  L('RESULT:' + (fail ? 'FAIL' : 'PASS') + ' pass=' + pass + ' fail=' + fail);
}
</script>`;

let allOk = true;
for (const [name, cfg, tests] of [['เจ้าของ', { role: 'owner' }, T_OWNER], ['ผู้ดูแล', { role: 'admin' }, T_ADMIN], ['พนักงาน', { role: 'staff' }, T_STAFF]]) {
  console.log('\n── ' + name + ' ──');
  // งบเวลาเสมือนเริ่มต้น 15 วิ ไม่พอสำหรับหน้าเจ้าของ (ไล่ครบทุกส่วน + ผลที่มาช้า) — ค่าท้ายสุดของสวิตช์ชนะ
  const r = runPage({ root, file: 'desk.html', mock: mockFor(cfg), tests, flags: ['--virtual-time-budget=45000'] });
  if (!r.ok) allOk = false;
}
console.log(allOk ? '\nผ่านทั้งหมด' : '\nมีข้อที่ไม่ผ่าน');
process.exit(allOk ? 0 : 1);
