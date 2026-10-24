/**
 * ลำดับ "ออกจากระบบจากหน้าครู → ไปหน้าเข้าสู่ระบบของคอนโซล" แบบเปิดหน้าต่อกันจริง (ไม่ดักการเด้ง)
 *   รัน: node tests/teacher-logout.mjs · ทดสอบหน้าฉบับอื่น (mutation): CHAIN_ROOT=<โฟลเดอร์ที่มี desk.html + teacher.html + teacher-profile.html> · ทีละชุด: CHAIN_ONLY=<regex ชื่อชุด>
 *
 * ทำไมต้องมี: tests/teacher.mjs · tests/teacher-profile.mjs ดักการเด้งไว้ (ของจริงพาหน้าออกจากไฟล์ที่ทดสอบ) จึงพิสูจน์ไม่ได้ว่า desk.html ที่เจอ session ของครูล้วนจะไม่พากลับหน้าครูวน
 * ที่นี่เปิด desk.html → ล็อกอินด้วยบัญชีครูล้วน (ไม่มีแถว admins) → desk พาไป teacher.html เอง → ออกจากระบบ → ต้องจบที่ loginOverlay ของ desk.html
 *   ชุด A "ออกที่หน้าครู":        desk → teacher.html → [ออก] → desk
 *   ชุด B "ออกที่โปรไฟล์ครู":      desk → teacher.html → (กดลิงก์ "โปรไฟล์ของฉัน") teacher-profile.html → [ออก] → desk
 * session เก็บใน localStorage ร่วมกันทุกหน้า (ตัวเลียนแบบ supabase-js) · บันทึกลำดับหน้าที่เปิดไว้ตรวจว่าเป็นไปตามลำดับแล้วหยุด
 * URL เริ่มต้นและหน้าที่กดออกแนบ query/hash ที่เป็นอันตราย (?next=https://evil…) — ปลายทางต้องเป็น desk.html เปล่า ๆ ในโฟลเดอร์เดียวกัน
 */

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HARNESS } from './lib/page-test.mjs';
import { runCdpPage } from './lib/cdp-page.mjs';
import { TEACH_MOCK } from './lib/teach-mock.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { MOCK: MOCK3 } = await import(pathToFileURL(join(root, 'tests/desk-home3.mjs')).href);
const pageRoot = process.env.CHAIN_ROOT || root;
const ONLY = process.env.CHAIN_ONLY ? new RegExp(process.env.CHAIN_ONLY) : null;

// session ของ client หลักเก็บใน localStorage (เหมือน supabase-js) — ให้ทุกหน้าเห็นร่วมกันข้ามการเปิดหน้าใหม่
// client แยกของคอนโซล (persistSession: false) ไม่แตะ · ตาราง teacher_profiles (หน้าโปรไฟล์ครู) ใส่แถวของ Maniac แถวเดียว
const PERSIST = `<script>
(() => {
  const KEY = 'chain.session', create = window.supabase.createClient;
  window.supabase.createClient = (u, k, o) => {
    const c = create(u, k, o);
    if (o && o.auth && o.auth.persistSession === false) return c;
    let cur = null;
    try { cur = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* ไม่มี */ }
    Object.defineProperty(c, 'session', { configurable: true, get: () => cur,
      set: v => { cur = v; try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch (e) { /* เก็บไม่ได้ */ } } });
    const from = c.from;
    c.from = t => {
      if (t !== 'teacher_profiles') return from(t);
      const q = { select() { return q; }, order() { return q; },
        then(res, rej) { return Promise.resolve({ data: [{ id: 't3', slug: 'maniac', bio: '', highlights: [], socials: {}, video_id: '', portfolio: [], is_hidden: false, publish_ack_at: '2026-01-01T00:00:00+00:00', rev: 1, updated_at: '2026-01-01T00:00:00+00:00' }], error: null }).then(res, rej); } };
      return q;
    };
    return c;
  };
})();
</script>`;

// สคริปต์เทสต์เดียวกันฝังทุกหน้า — ทำงานตามหน้า/ขั้นที่ถึง (หน้าถูกแทนที่ทุกครั้งที่พากันไป จึงเก็บลำดับกับผลไว้ใน localStorage)
const tests = variant => `<script>
${HARNESS}
const VARIANT = ${JSON.stringify(variant)};
const SEQ = VARIANT === 'profile' ? ['desk', 'teacher', 'profile', 'desk'] : ['desk', 'teacher', 'desk'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);
const PAGE = /[/]teacher-profile[.]html$/.test(location.pathname) ? 'profile' : /[/]teacher[.]html$/.test(location.pathname) ? 'teacher' : 'desk';
const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const NAV = get('chain.nav', []).concat(PAGE + ' ' + location.pathname.split('/').pop());
put('chain.nav', NAV);
const chk = (name, cond, extra) => { ok(name, cond, extra); put(cond ? 'chain.pass' : 'chain.fail', get(cond ? 'chain.pass' : 'chain.fail', 0) + 1); };
const waitFor = async (f, ms) => { for (let t = 0; t < (ms || 6000); t += 100) { if (f()) return true; await sleep(100); } return f(); };
const finish = () => L('RESULT:' + (get('chain.fail', 0) ? 'FAIL' : 'PASS') + ' pass=' + get('chain.pass', 0) + ' fail=' + get('chain.fail', 0));
const HOSTILE = '?next=https://evil.example/x&redirect=//evil.example/y#https://evil.example/z';

window.addEventListener('load', () => setTimeout(async () => {
  const step = NAV.length;
  L('--- หน้าที่ ' + step + ': ' + NAV[step - 1] + ' ---');
  if (step === 1) {
    localStorage.clear();
    put('chain.nav', NAV);
    TEACH.seed();
    chk('เริ่มที่ desk.html ที่แนบ query/hash อันตราย: ยังไม่ล็อกอิน → ขึ้นหน้าเข้าสู่ระบบของคอนโซล', PAGE === 'desk' && $('loginOverlay').style.display !== 'none' && /next=/.test(location.search));
    $('loginEmail').value = 'maniac@x'; $('loginPassword').value = 'x';
    await doLogin();                                  // บัญชีครูล้วน: desk พาไป teacher.html เอง (location.replace จริง ไม่ดัก)
    await sleep(8000);
    chk('desk ต้องพาไปหน้าครูเอง (ไม่ควรมาถึงบรรทัดนี้)', false, location.href);
    finish();
  } else if (PAGE === 'teacher') {
    chk('desk พาบัญชีครูล้วนมาหน้าครู: เป็นหน้าครู ไม่มี query/hash ตามมา', location.search === '' && location.hash === '', location.href);
    const inMain = await waitFor(() => $('logoutBtn') && !$('logoutBtn').hidden && /ครู Maniac/.test($('who').textContent));
    chk('หน้าครูใช้ session เดิมต่อได้ (ไม่ต้องกรอกซ้ำ): เห็นชื่อครู + ปุ่มออกจากระบบ', inMain, $('who').textContent);
    if (VARIANT === 'profile') {
      chk('มีลิงก์ "โปรไฟล์ของฉัน" ไปหน้าโปรไฟล์ครู', !$('profileLink').hidden && $('profileLink').getAttribute('href') === 'teacher-profile.html');
      $('profileLink').click();                       // เปิดหน้าโปรไฟล์ครูจริง (session เดิมต่อ)
      await sleep(8000);
      chk('ต้องไปหน้าโปรไฟล์ครู (ไม่ควรมาถึงบรรทัดนี้)', false, location.href);
      finish();
    } else {
      history.replaceState(null, '', location.pathname + HOSTILE);   // หน้าครูถูกเปิดด้วยลิงก์อันตราย — ปลายทางต้องไม่ตามไป
      $('logoutBtn').click();                         // ออกจากระบบจริง → ต้องพาไป desk.html เอง
      await sleep(8000);
      chk('หน้าครูต้องพาไปหน้าเข้าสู่ระบบของคอนโซลเอง (ไม่ควรมาถึงบรรทัดนี้)', false, location.href);
      finish();
    }
  } else if (PAGE === 'profile') {
    chk('เปิดหน้าโปรไฟล์ครูได้จากลิงก์: ไม่มี query/hash ตามมา', location.search === '' && location.hash === '', location.href);
    const inMain = await waitFor(() => $('logoutBtn') && !$('logoutBtn').hidden && /ครู Maniac/.test($('who').textContent) && !!$('f_bio'));
    chk('หน้าโปรไฟล์ครูใช้ session เดิมต่อได้ (ไม่ต้องกรอกซ้ำ): เห็นชื่อครู + ฟอร์ม + ปุ่มออกจากระบบ', inMain, $('who').textContent);
    history.replaceState(null, '', location.pathname + HOSTILE);       // หน้าโปรไฟล์ถูกเปิดด้วยลิงก์อันตราย — ปลายทางต้องไม่ตามไป
    $('logoutBtn').click();
    await sleep(8000);
    chk('หน้าโปรไฟล์ครูต้องพาไปหน้าเข้าสู่ระบบของคอนโซลเอง (ไม่ควรมาถึงบรรทัดนี้)', false, location.href);
    finish();
  } else if (step === SEQ.length) {
    const here = location.pathname.split('/').pop();
    // #home = หมวดตั้งต้นที่ desk ตั้งเอง (replaceState) ไม่ใช่ค่าที่ติดมาจากหน้าครู
    chk('ออกจากระบบแล้วมาที่ desk.html เปล่า ๆ (พาธคงที่ ไม่มี query/hash จากที่อื่นติดมา)', here === 'desk.html' && location.search === '' && /^(#home)?$/.test(location.hash), location.href);
    chk('session ถูกเอาออกจริง (กัน desk เจอ session ครูล้วนแล้วเด้งกลับ)', get('chain.session', null) === null);
    await sleep(3500);                                // ถ้าวนจะเปิดหน้าครูซ้ำภายในช่วงนี้ → หน้านี้ถูกแทนที่ก่อนถึงบรรทัดข้างล่าง
    chk('จบที่ loginOverlay ของ desk ไม่วน: ยังเป็นหน้า desk เดิม แสดงฟอร์มเข้าสู่ระบบ', $('loginOverlay').style.display !== 'none' && $('loginEmail') !== null, String($('loginOverlay').style.display));
    chk('ลำดับหน้าที่เปิด = ' + SEQ.join(' → ') + ' แล้วหยุด (ไม่มีรอบเกิน)', NAV.length === SEQ.length && NAV.every((n, i) => n.startsWith(SEQ[i] + ' ')), NAV.join(' | '));
    finish();
  } else {
    chk('มีหน้าถูกเปิดเกินลำดับ = วน', false, NAV.join(' | '));
    finish();
  }
}, 300));
</script>`;

const mock = MOCK3 + '\n' + TEACH_MOCK + '\n' + PERSIST;
const hash = '?next=https://evil.example/x&redirect=//evil.example/y#https://evil.example/z';
let allOk = true;
for (const [label, variant] of [['A ออกที่หน้าครู: desk → teacher.html → ออก → desk', 'teacher'], ['B ออกที่โปรไฟล์ครู: desk → teacher.html → teacher-profile.html → ออก → desk', 'profile']]) {
  if (ONLY && !ONLY.test(label)) continue;
  console.log('\n--- ' + label + ' (เปิดหน้าต่อกันจริง) ---');
  const t = tests(variant);
  const siblings = ['desk.html', 'teacher.html', 'teacher-profile.html'].map(file => ({ file, mock, tests: t }));
  const res = await runCdpPage({ root: pageRoot, file: 'desk.html', mock, tests: t, hash, width: 1366, height: 768, coarse: false, siblings });
  if (!res.ok) allOk = false;
}
console.log('\n=== teacher-logout: ' + (allOk ? 'ผ่าน' : 'ไม่ผ่านหรือไม่ได้รันจนจบ') + ' ===');
process.exit(allOk ? 0 : 1);
