/**
 * เทสต์หน้า member.html (LIFF "เช็คสิทธิ์สมาชิก") หลังปิดช่องโหว่ claim_membership (ก้อน 0 · 14 พ.ย. 69)
 *   รัน: node tests/member-claim.mjs      (MEMBER_ROOT=<โฟลเดอร์> ทดสอบหน้าฉบับอื่น — ใช้ทำ mutation)
 *
 * ที่มา: เดิมหน้านี้เรียก rpc('claim_membership', { p_phone, p_line_user_id }) ตรง ๆ โดยส่ง userId ที่ liff.getProfile() ให้มา
 * → ใครมี publishable key ก็ปลอม userId/ไล่เดาเบอร์ได้ · ตอนนี้ส่ง id_token สด ๆ ให้ Edge Function `line-claim` (ฟังก์ชันให้ LINE ยืนยันเอง)
 *   ผูกกับ migration 079 ที่ถอน execute ของ claim_membership จาก anon — ถ้าหน้านี้ยังเรียก rpc ตรงจะใช้ไม่ได้ทันทีหลังรัน 079
 *
 * วิธีเดียวกับชุดอื่น: ไฟล์จริงทุกบรรทัด สลับเฉพาะแท็ก Supabase เป็นตัวปลอม + liff ปลอม
 * ⚠️ เขียนโดยไม่ใช้แบ็กสแลช/แบ็กทิกในสตริงเทมเพลตของไฟล์นี้
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { runPage, HARNESS } from './lib/page-test.mjs';

const root = process.env.MEMBER_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
let staticFail = 0;
const sok = (name, cond) => { console.log('  ' + (cond ? '[PASS] ' : '[FAIL] ') + name); if (!cond) staticFail++; };

console.log('\n=== ตรวจซอร์ส (ไม่ต้องเปิดเบราว์เซอร์) ===');
{
  const src = readFileSync(join(root, 'member.html'), 'utf8');
  sok('ไม่มีการเรียก claim_membership ตรงจากหน้าเว็บอีก', !/claim_membership/.test(src));
  sok('ไม่เรียก liff.getProfile() (ไม่เชื่อ userId จากเบราว์เซอร์)', !/getProfile/.test(src));
  sok('ไม่มีตัวแปร lineUserId/p_line_user_id ในหน้า', !/lineUserId|p_line_user_id/.test(src));
  sok('เรียกผ่านฟังก์ชัน line-claim', /functions\.invoke\('line-claim'/.test(src));
  sok('ไม่ตั้งชื่อตัวแปรว่า supabase (กฎข้อ 1)', !/(const|let|var)\s+supabase\b/.test(src));
}

const mock = cfg => `<script>
const CALLS = [];
const CFG = ${JSON.stringify(cfg)};
let TOKEN_I = 0;
window.liff = {
  init: async () => { CALLS.push({ op: 'liff.init' }); },
  isLoggedIn: () => !!CFG.inLine,
  getProfile: async () => { CALLS.push({ op: 'getProfile' }); return { userId: 'U' + 'e'.repeat(32) }; },
  getIDToken: () => {
    CALLS.push({ op: 'getIDToken' });
    if (CFG.token === 'throw') throw new Error('boom');
    if (Array.isArray(CFG.tokens)) return CFG.tokens[Math.min(TOKEN_I++, CFG.tokens.length - 1)];
    return CFG.token === undefined ? 'ID-TOKEN-1' : CFG.token;
  },
};
window.supabase = { createClient: () => ({
  from: table => { CALLS.push({ op: 'from', table }); throw new Error('หน้านี้ไม่ควรแตะตารางตรง'); },
  rpc: (name, args) => { CALLS.push({ op: 'rpc', name, args }); return Promise.resolve({ data: null, error: { message: 'permission denied' } }); },
  auth: { async signInAnonymously() { return { error: CFG.authFail ? { message: 'x' } : null }; } },
  functions: {
    async invoke(name, opts) {
      CALLS.push({ op: 'invoke', name, body: opts && opts.body });
      const r = CFG.invoke;
      if (r === 'throw') throw new Error('network');
      if (r && r.err) return { data: null, error: { name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code', context: { json: async () => r.err } } };
      if (r && r.errNoJson) return { data: null, error: { name: 'FunctionsFetchError', message: 'Failed to send a request to the Edge Function' } };
      return { data: r && r.data, error: null };
    },
  },
}) };
</script>`;

const tests = body => `<script>
window.addEventListener('load', () => setTimeout(runTests, 700));
${HARNESS}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);
const invokes = () => CALLS.filter(c => c.op === 'invoke');
const txt = () => document.body.innerText;
async function submit(phone) { $('phone').value = phone === undefined ? '0812345678' : phone; await check(); await sleep(30); }
async function runTests() {
  ${body}
  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

const results = [];
const run = (label, cfg, body) => { console.log('\n=== ' + label + ' ==='); results.push(runPage({ root, file: 'member.html', mock: mock(cfg), tests: tests(body) })); };

run('เปิดใน LINE · ผูกสำเร็จ — ส่ง id_token + เบอร์ให้ line-claim เท่านั้น', { inLine: true, invoke: { data: { status: 'linked', full_name: 'สมชาย ใจดี', code: '25145', is_member: true, member_type: 'นักเรียน' } } }, `
  ok('เปิดหน้า: ไม่เรียก getProfile (ไม่ใช้ userId จากเบราว์เซอร์)', !CALLS.some(c => c.op === 'getProfile'));
  ok('เปิดหน้า: ยังไม่ขอ id_token/ยังไม่เรียกฟังก์ชัน', !CALLS.some(c => c.op === 'getIDToken') && invokes().length === 0);
  ok('ปุ่มเช็คสิทธิ์กดได้ (เปิดใน LINE)', $('checkBtn').disabled === false);
  await submit();
  ok('เรียก line-claim ครั้งเดียว', invokes().length === 1 && invokes()[0].name === 'line-claim', invokes().length);
  const b = invokes()[0].body;
  ok('body = { id_token, phone } ตรงตัว ไม่มีคีย์อื่น', JSON.stringify(Object.keys(b).sort()) === JSON.stringify(['id_token', 'phone']), Object.keys(b));
  ok('id_token เป็นค่าสดจาก liff.getIDToken()', b.id_token === 'ID-TOKEN-1');
  ok('เบอร์ส่งตามที่พิมพ์', b.phone === '0812345678');
  ok('ไม่มีการเรียก rpc ตรง · ไม่แตะตารางตรง · ไม่เรียก getProfile', !CALLS.some(c => c.op === 'rpc' || c.op === 'from' || c.op === 'getProfile'));
  ok('แสดงผลสำเร็จ: ชื่อ + รหัสสมาชิก + ข้อความผูกเรียบร้อย', txt().indexOf('สมชาย ใจดี') !== -1 && txt().indexOf('25145') !== -1 && txt().indexOf('ผูกบัญชี LINE นี้กับข้อมูลของท่านเรียบร้อยแล้ว') !== -1, txt().slice(0, 200));
  ok('ฟอร์มเดิมถูกซ่อน · การ์ดผลขึ้น', $('formCard').style.display === 'none' && $('resultCard').style.display !== 'none');
`);

run('เช็คซ้ำขอ id_token ใหม่ทุกครั้ง (ไม่จำ token เก่า)', { inLine: true, tokens: ['TOK-A', 'TOK-B'], invoke: { data: { status: 'not_found' } } }, `
  await submit('0812345678');
  again(); await sleep(20);
  await submit('0899999999');
  ok('เรียกฟังก์ชัน 2 ครั้ง', invokes().length === 2, invokes().length);
  ok('ครั้งแรกใช้ TOK-A · ครั้งที่สองใช้ TOK-B (ขอสดทุกครั้ง)', invokes()[0].body.id_token === 'TOK-A' && invokes()[1].body.id_token === 'TOK-B', invokes().map(c => c.body.id_token).join());
`);

const STATUS = [
  ['already_linked', { status: 'already_linked', full_name: 'สมหญิง', code: '230001', is_member: true }, ['บัญชี LINE นี้ผูกกับข้อมูลของท่านอยู่แล้ว', '230001']],
  ['not_found', { status: 'not_found' }, ['ไม่พบเบอร์นี้ในทะเบียน']],
  ['line_used_by_other', { status: 'line_used_by_other', full_name: 'เจ้าของเดิม' }, ['บัญชี LINE นี้ถูกผูกไว้แล้ว', 'เจ้าของเดิม']],
  ['already_linked_other', { status: 'already_linked_other', full_name: 'เจ้าของเดิม' }, ['บัญชี LINE นี้ถูกผูกไว้แล้ว']],
  ['member_has_other_line', { status: 'member_has_other_line' }, ['เบอร์นี้ผูกกับ LINE อื่นไว้แล้ว']],
  ['bad_phone', { status: 'bad_phone' }, ['รูปแบบเบอร์โทรไม่ถูกต้อง']],
  ['no_line_id', { status: 'no_line_id' }, ['ไม่พบบัญชี LINE ของท่าน']],
  ['ค่าที่ไม่รู้จัก', { status: 'อะไรก็ไม่รู้' }, ['เกิดข้อผิดพลาดที่ไม่คาดคิด']],
];
for (const [label, data, expect] of STATUS) {
  run('แสดงผล status = ' + label, { inLine: true, invoke: { data } }, `
    await submit();
    ${expect.map(e => `ok('แสดง "${e}"', txt().indexOf(${JSON.stringify(e)}) !== -1, txt().slice(0, 160));`).join('\n    ')}
    ok('ไม่ขึ้นแถบแดงข้อผิดพลาดเชื่อมต่อ', txt().indexOf('ติดต่อระบบไม่สำเร็จ') === -1);
  `);
}

run('ไม่มี id_token (ไม่ได้เปิดสิทธิ์ openid / token หมดอายุ) → ไม่ยอมถอยไปทางเดิม', { inLine: true, token: null }, `
  await submit();
  ok('บอกให้ปิดแล้วเปิดหน้าจากเมนูในแชท LINE ใหม่', $('formError').textContent.indexOf('ยืนยันบัญชี LINE ไม่สำเร็จ') !== -1, $('formError').textContent);
  ok('ไม่เรียกฟังก์ชัน · ไม่เรียก rpc ตรง (ไม่มีทางเก่า)', invokes().length === 0 && !CALLS.some(c => c.op === 'rpc'));
  ok('ปุ่มยังกดซ้ำได้ ฟอร์มยังอยู่', $('checkBtn').disabled === false && $('formCard').style.display !== 'none');
`);
run('liff.getIDToken() โยน error → ข้อความเดียวกัน ไม่พังเงียบ', { inLine: true, token: 'throw' }, `
  await submit();
  ok('บอกให้เปิดหน้าใหม่', $('formError').textContent.indexOf('ยืนยันบัญชี LINE ไม่สำเร็จ') !== -1);
  ok('ไม่เรียกฟังก์ชัน', invokes().length === 0);
`);

run('เปิดนอก LINE → ปุ่มปิด · บอกเหตุ · กดไม่ได้เรียกอะไรเลย', { inLine: false, invoke: { data: { status: 'linked' } } }, `
  ok('ปุ่มเช็คสิทธิ์ถูกปิด', $('checkBtn').disabled === true);
  ok('มีข้อความบอกให้เปิดจากเมนูในแชท LINE ของร้าน', $('formError').textContent.indexOf('เปิดจากเมนูในแชท LINE') !== -1, $('formError').textContent);
  await submit();
  ok('เรียก check() ตรง ๆ ก็ไม่ส่งอะไร (ไม่มี id_token ให้ส่ง)', invokes().length === 0 && !CALLS.some(c => c.op === 'getIDToken' || c.op === 'rpc'));
  ok('ไม่เรียก getProfile', !CALLS.some(c => c.op === 'getProfile'));
`);

run('เบอร์สั้นเกิน → ไม่ส่ง', { inLine: true, invoke: { data: { status: 'linked' } } }, `
  await submit('081');
  ok('ขึ้นข้อความให้กรอกเบอร์ให้ครบ', $('formError').textContent.indexOf('กรุณากรอกเบอร์โทรให้ครบ') !== -1);
  ok('ไม่ขอ id_token · ไม่เรียกฟังก์ชัน', invokes().length === 0 && !CALLS.some(c => c.op === 'getIDToken'));
`);

run('ฟังก์ชันตอบผิด (429 ลองบ่อยเกินไป) → แสดงข้อความไทยของฟังก์ชัน', { inLine: true, invoke: { err: { error: { code: 'rate_limited', message: 'ลองบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' } } } }, `
  await submit();
  ok('แสดงข้อความไทยจากฟังก์ชัน', $('formError').textContent.indexOf('ลองบ่อยเกินไป กรุณารอสักครู่') !== -1, $('formError').textContent);
  ok('ปุ่มกลับมากดได้ · ข้อความปุ่มกลับเป็นปกติ', $('checkBtn').disabled === false && $('checkBtn').textContent === 'เช็คสิทธิ์สมาชิก');
  ok('ไม่ขึ้นหน้าผลสำเร็จ', $('resultCard').style.display === 'none');
`);
run('ฟังก์ชันตอบผิดด้วยข้อความอังกฤษ → ไม่โชว์ข้อความดิบ ใช้ข้อความไทยมาตรฐาน', { inLine: true, invoke: { err: { error: { code: 'unavailable', message: 'internal db error: relation members' } } } }, `
  await submit();
  ok('ไม่แสดงข้อความดิบของระบบ', $('formError').textContent.indexOf('relation') === -1 && $('formError').textContent.indexOf('internal') === -1, $('formError').textContent);
  ok('แสดงข้อความไทยมาตรฐาน', $('formError').textContent.indexOf('ตรวจสอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง') !== -1);
`);
run('ต่อฟังก์ชันไม่ได้ (ไม่มีเนื้อตอบ) → ข้อความไทยมาตรฐาน', { inLine: true, invoke: { errNoJson: true } }, `
  await submit();
  ok('แสดงข้อความไทยมาตรฐาน · ไม่ใช่ข้อความอังกฤษของไลบรารี', $('formError').textContent.indexOf('ตรวจสอบไม่สำเร็จ') !== -1 && $('formError').textContent.indexOf('Edge Function') === -1, $('formError').textContent);
`);
run('invoke โยน exception → แจ้งติดต่อระบบไม่สำเร็จ · ปุ่มกลับมา', { inLine: true, invoke: 'throw' }, `
  await submit();
  ok('ขึ้นข้อความติดต่อระบบไม่สำเร็จ', $('formError').textContent.indexOf('ติดต่อระบบไม่สำเร็จ') !== -1);
  ok('ปุ่มกลับมากดได้', $('checkBtn').disabled === false && $('checkBtn').textContent === 'เช็คสิทธิ์สมาชิก');
`);

run('ชื่อจากฐานมี HTML → ต้องถูก escape (ไม่รันสคริปต์)', { inLine: true, invoke: { data: { status: 'linked', full_name: '<img src=x onerror="window.PWNED=1">', code: '<b>1</b>', is_member: true } } }, `
  await submit(); await sleep(80);
  ok('ไม่มี <img> ที่เกิดจากชื่อ ไม่มี <b> จากรหัส', !$('resultCard').querySelector('img') && !$('resultCard').querySelector('b'));
  ok('สคริปต์ไม่ทำงาน', window.PWNED === undefined);
  ok('แสดงเป็นตัวหนังสือตามที่ฐานให้', $('resultCard').textContent.indexOf('<img src=x') !== -1);
`);

run('ปุ่มระหว่างรอ: ล็อกกันกดซ้ำ ข้อความ "กำลังตรวจสอบ..."', { inLine: true, invoke: { data: { status: 'not_found' } } }, `
  $('phone').value = '0812345678';
  const p = check();
  ok('ทันทีหลังกด: ปุ่มถูกล็อกและบอกกำลังตรวจสอบ', $('checkBtn').disabled === true && $('checkBtn').textContent.indexOf('กำลังตรวจสอบ') !== -1, $('checkBtn').textContent);
  await p; await sleep(20);
  ok('เสร็จแล้วปุ่มกลับมา', $('checkBtn').disabled === false);
`);

const bad = results.filter(r => !r.ok).length;
console.log('\n' + (staticFail || bad ? 'FAIL' : 'PASS') + ' — ตรวจซอร์สตก ' + staticFail + ' · หน้าตก ' + bad + ' จาก ' + results.length);
process.exit(staticFail || bad ? 1 : 0);
