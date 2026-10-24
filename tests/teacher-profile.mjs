/**
 * เทสต์หน้า "โปรไฟล์ของฉัน" teacher-profile.html (migration 068) — ครูแก้โปรไฟล์ตัวเองในคอนโซล ขึ้นเว็บทันที
 *   รัน: node tests/teacher-profile.mjs   (TPROF_ROOT=<โฟลเดอร์> ทดสอบหน้าฉบับอื่น — ใช้ทำ mutation)
 *
 * ไฟล์จริงทุกบรรทัด สลับเฉพาะแท็ก Supabase เป็นตัวปลอม · ฐานปลอมจำลองกติกาของ 068: ครู/ผู้ดูแลเห็น-แก้เฉพาะแถวตัวเอง · เจ้าของแก้ทุกแถว · is_hidden เฉพาะเจ้าของ · ครูต้องติ๊กยืนยันเผยแพร่ (publish_ack_at) ก่อนแก้เนื้อหาครั้งแรก ·
 * สิทธิ์ระดับคอลัมน์ · เทียบ rev (แถวไม่ตรง = 0 แถว) · อัปโหลดถัง teacher-portfolio — ตัวจริงตรวจที่ console-workspace/sql-tests/test068.mjs
 * ที่นี่ตรวจฝั่งหน้าจอ: ใครเห็นอะไร · ตัวตรวจซ้ำ = เวกเตอร์ชุดเดียวกับฐาน (tests/lib/teacher-profile-vectors.json) · ส่งอะไรให้ฐานบ้าง (ไม่ส่ง is_hidden/slug/id/rev/updated_*) ·
 * ล้มเหลวทุกแบบแจ้งตามจริง (0 แถว/ฐานปฏิเสธ/อัปโหลดล้ม) · ย่อรูป ≤1 MB · ไม่ลบไฟล์ในถัง · ข้อมูลครูไม่ถูกตีความเป็น HTML · คำเตือนแดงตัวหนา ≥14px
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPage, HARNESS } from './lib/page-test.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pageRoot = process.env.TPROF_ROOT || root;
const VECTORS = readFileSync(join(root, 'tests/lib/teacher-profile-vectors.json'), 'utf8');

const MOCK = `<script>
const CALLS = [];
const SLUGS = ['alldayz', 'leonie', 'maniac', 'nutty', 'tibass', 'zlex'];
const NAMES = { alldayz: 'Alldayz', leonie: 'Leonie', maniac: 'Maniac', nutty: 'Nutty', tibass: 'Tibass', zlex: 'Zlex' };
const TID = s => 't-' + s;
// บัญชี: อีเมลขึ้นต้น = ผู้ใช้ · zlex=เจ้าของ+ครู · tibass=ผู้ดูแล+ครู · nutty=พนักงาน+ครู · maniac/alldayz=ครูล้วน (ไม่มีแถว admins) · staff=พนักงานไม่ใช่ครู · ghost=ไม่มีอะไรเลย
const USERS = { zlex: { id: 'u-zlex', role: 'owner', t: 'zlex' }, tibass: { id: 'u-tibass', role: 'admin', t: 'tibass' }, nutty: { id: 'u-nutty', role: 'staff', t: 'nutty' },
                maniac: { id: 'u-maniac', role: null, t: 'maniac' }, alldayz: { id: 'u-alldayz', role: null, t: 'alldayz' }, staff: { id: 'u-staff', role: 'staff', t: null }, adminOnly: { id: 'u-adminonly', role: 'admin', t: null }, ghost: { id: 'u-ghost', role: null, t: null } };
const userById = id => Object.values(USERS).find(u => u.id === id);
const FAKE = { rows: [], noTable: false, hidePageRowFor: null };
const FAIL = { update: null, upload: null, throwUpdate: false };
const mkRow = s => ({ id: TID(s), slug: s, bio: '', highlights: [], socials: {}, video_id: null, portfolio: [], is_hidden: false, publish_ack_at: '2026-10-18T09:00:00+00:00', rev: 1, updated_at: '2026-10-19T10:00:00.123456+00:00' });
FAKE.reset = () => {
  FAKE.rows = SLUGS.map(mkRow);
  FAKE.rows.find(r => r.slug === 'maniac').bio = 'ประวัติเดิมของ Maniac';
  FAKE.rows.find(r => r.slug === 'maniac').highlights = ['รางวัล A', 'รางวัล B'];
  FAKE.rows.find(r => r.slug === 'maniac').socials = { instagram: 'https://www.instagram.com/maniac' };
  FAKE.rows.find(r => r.slug === 'zlex').bio = 'ประวัติของ Zlex';
  FAKE.rows.find(r => r.slug === 'nutty').is_hidden = true;
  FAKE.rows.find(r => r.slug === 'alldayz').publish_ack_at = null;      // ครูที่ยังไม่เคยติ๊กยืนยันเผยแพร่ (ที่เหลือติ๊กแล้ว)
  FAKE.noTable = false; FAKE.noRowFor = null;
  FAIL.update = null; FAIL.upload = null; FAIL.throwUpdate = false;
  CALLS.length = 0;
};
FAKE.reset();
let SESSION = null, authCb = null;
const visible = u => !u ? [] : (u.role ? FAKE.rows : FAKE.rows.filter(r => r.id === TID(u.t)));       // is_active_admin() หรือ id = my_teacher_id()
const ALLOWED_COLS = ['bio', 'highlights', 'socials', 'video_id', 'portfolio', 'is_hidden', 'publish_ack_at'];
const CONTENT_COLS = ['bio', 'highlights', 'socials', 'video_id', 'portfolio'];
function builder(table) {
  const proj = rows => q._cols ? rows.map(r => Object.fromEntries(q._cols.map(c => [c, r[c]]))) : rows;       // ฐานจริงคืนเฉพาะคอลัมน์ที่ขอ
  const q = { _f: [], _upd: null, _sel: false, _cols: null,
    select(c) { q._sel = true; q._cols = typeof c === 'string' ? c.split(',').map(x => x.trim()) : null; return q; },
    eq(c, v) { q._f.push([c, v]); return q; },
    order() { return q; }, limit() { return q; },
    update(p) { q._upd = p; CALLS.push({ op: 'update', table, payload: JSON.parse(JSON.stringify(p)), filters: q._f }); return q; },
    insert(p) { CALLS.push({ op: 'insert', table, payload: p }); return q; },
    delete() { CALLS.push({ op: 'delete', table }); return q; },
    upsert(p) { CALLS.push({ op: 'upsert', table, payload: p }); return q; },
    async maybeSingle() { const r = await q.then(x => x); return { data: r.data && r.data[0] || null, error: r.error }; },
    then(res, rej) {
      return Promise.resolve().then(async () => {
        const u = userById(SESSION && SESSION.user && SESSION.user.id);
        if (table === 'admins') {
          const rows = (u && u.role) ? [{ id: u.id, role: u.role, is_active: true }] : [];
          return { data: rows.filter(r => q._f.every(([c, v]) => r[c] === v)), error: null };
        }
        if (table === 'teachers') return { data: SLUGS.map(s => ({ id: TID(s), display_name: NAMES[s] })), error: null };
        if (table === 'teacher_profiles') {
          if (FAKE.noTable) return { data: null, error: { code: '42P01', message: 'relation "public.teacher_profiles" does not exist' } };
          if (!q._upd) { CALLS.push({ op: 'select', table }); return { data: proj(JSON.parse(JSON.stringify(visible(u))).filter(r => FAKE.noRowFor !== r.id)), error: null }; }
          if (FAIL.throwUpdate) throw new Error('Failed to fetch');
          if (FAIL.update) return { data: null, error: FAIL.update };
          const bad = Object.keys(q._upd).find(k => !ALLOWED_COLS.includes(k));
          if (bad) return { data: null, error: { code: '42501', message: 'permission denied for table teacher_profiles' } };
          const owner = !!u && u.role === 'owner';
          const mine = r => r.id === TID(u && u.t);
          const hit = visible(u).filter(r => q._f.every(([c, v]) => r[c] === v) && (owner || mine(r)));       // ผู้ดูแล = เหมือนครู: แก้ได้เฉพาะแถวตัวเอง
          if ('is_hidden' in q._upd && hit.some(r => r.is_hidden !== q._upd.is_hidden) && !owner) return { data: null, error: { code: '42501', message: 'เฉพาะเจ้าของร้านซ่อนหรือแสดงโปรไฟล์บนเว็บได้' } };
          if ('publish_ack_at' in q._upd && hit.some(r => r.publish_ack_at || !mine(r))) return { data: null, error: { code: '42501', message: 'ยืนยันเผยแพร่ได้เฉพาะครูเจ้าของโปรไฟล์เอง และตั้งได้ครั้งเดียว' } };
          if (!('publish_ack_at' in q._upd) && hit.some(r => mine(r) && !r.publish_ack_at && CONTENT_COLS.some(k => k in q._upd && JSON.stringify(q._upd[k]) !== JSON.stringify(r[k])))) return { data: null, error: { code: '42501', message: 'ต้องติ๊กยืนยันการเผยแพร่ก่อนบันทึกครั้งแรก' } };
          hit.forEach(r => { Object.assign(r, JSON.parse(JSON.stringify(q._upd))); if ('publish_ack_at' in q._upd) r.publish_ack_at = '2026-10-19T11:00:00+00:00'; r.rev += 1; r.updated_at = '2026-10-19T11:00:00.' + String(100000 + r.rev) + '+00:00'; });
          return { data: proj(JSON.parse(JSON.stringify(hit))), error: null };
        }
        return { data: [], error: null };
      }).then(res, rej);
    },
  };
  return q;
}
window.supabase = {
  createClient: () => ({
    from: builder,
    rpc: async fn => { CALLS.push({ op: 'rpc', fn }); const u = userById(SESSION && SESSION.user && SESSION.user.id); return fn === 'my_teacher_id' ? { data: u && u.t ? TID(u.t) : null, error: null } : { data: null, error: null }; },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel() {},
    storage: { from: bucket => ({
      async upload(path, blob, opts) {
        const call = { op: 'upload', bucket, path, size: blob.size, type: blob.type, opts };
        CALLS.push(call);
        try { const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(blob); }); call.w = im.width; call.h = im.height; } catch (e) { call.w = call.h = -1; }
        return FAIL.upload ? { data: null, error: FAIL.upload } : { data: { path }, error: null };
      },
      async remove(paths) { CALLS.push({ op: 'remove', bucket, paths }); return { data: [], error: null }; },
    }) },
    auth: {
      async getSession() { return { data: { session: SESSION } }; },
      async signInWithPassword({ email }) {
        const k = email.split('@')[0];
        if (!USERS[k]) return { data: null, error: { message: 'invalid' } };
        SESSION = { user: { id: USERS[k].id } };
        setTimeout(() => authCb && authCb('SIGNED_IN', SESSION));
        return { data: {}, error: null };
      },
      onAuthStateChange(cb) { authCb = cb; },
      async signOut() { SESSION = null; setTimeout(() => authCb && authCb('SIGNED_OUT', null)); return { error: null }; },
    },
  }),
};
</script>`;

const TESTS = `<script>
window.addEventListener('load', () => setTimeout(runTests, 300));
${HARNESS}
const VEC = ${VECTORS};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);
const X = v => Array.isArray(v) ? v.map(X) : v && typeof v === 'object' ? (('r' in v && 'n' in v && Object.keys(v).length === 2) ? v.r.repeat(v.n) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, X(x)]))) : v;
const isRed = el => !!el && getComputedStyle(el).color === 'rgb(204, 0, 26)' && Number(getComputedStyle(el).fontWeight) >= 600;
const fs = el => parseFloat(getComputedStyle(el).fontSize);
const writes = () => CALLS.filter(c => ['insert', 'update', 'delete', 'upsert'].includes(c.op));
const updates = () => CALLS.filter(c => c.op === 'update');
const fatal = () => ($('fatalError') ? $('fatalError').textContent : '');
function clearFatal() { const f = $('fatalError'); if (f) f.remove(); }
async function signIn(name) { $('lgEmail').value = name + '@x'; $('lgPass').value = 'x'; $('loginForm').requestSubmit(); await sleep(200); }
async function signOut() { $('logoutBtn').click(); await sleep(120); }
// ดักการเด้งไป desk.html หลังออกจากระบบ (ของจริง = location.replace ซึ่งพาหน้านี้ออกจากไฟล์ที่ทดสอบ) · เก็บโค้ดจริงไว้ตรวจว่าไม่อ่านพาธจาก URL
const GO_SRC = goConsoleLogin.toString();
let GOLOGIN = 0;
goConsoleLogin = () => { GOLOGIN++; };
const fill = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
const clickAct = (a, i) => { const b = $('app').querySelector('[data-act="' + a + '"]' + (i !== undefined ? '[data-i="' + i + '"]' : '')); if (!b) throw new Error('ไม่พบปุ่ม ' + a); b.click(); };
const row = s => FAKE.rows.find(r => r.slug === s);
const T = id => ($(id) ? $(id).textContent : '');
async function doSave() { clickAct('save'); await sleep(80); }
function fileOf(w, h, noise, type) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  if (noise) { const d = x.createImageData(w, h); for (let i = 0; i < d.data.length; i += 4) { d.data[i] = Math.random() * 255; d.data[i + 1] = Math.random() * 255; d.data[i + 2] = Math.random() * 255; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); }
  else { x.fillStyle = '#3366cc'; x.fillRect(0, 0, w, h); }
  const url = c.toDataURL(type || 'image/png', 1), bin = atob(url.slice(url.indexOf(',') + 1)), b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return new File([b], 'pic.' + (type === 'image/jpeg' ? 'jpg' : 'png'), { type: type || 'image/png' });
}

async function runTests() {
  L('=== โปรไฟล์ของฉัน teacher-profile.html ===');
  try { localStorage.clear(); } catch (e) {}
  await sleep(80);
  window.confirm = () => true;               // กล่องยืนยันจริงค้างเบราว์เซอร์ headless — เทสต์ตอบ "ตกลง"
  ok('ยังไม่ล็อกอิน: เห็นฟอร์มเข้าสู่ระบบ ไม่ยิงอะไรไปฐาน', !!$('loginForm') && CALLS.length === 0);

  // ── 1. ตัวตรวจฝั่งหน้าจอ = เวกเตอร์ชุดเดียวกับฐาน ──────────────────────
  const chk = { bio: v => TP.bio(v), highlights: v => TP.highlights(v), socials: v => TP.socials(v), video_id: v => TP.video(v), portfolio: v => TP.portfolio(v, 'zlex') };
  for (const c of Object.keys(chk)) {
    const goods = X(VEC[c].ok), bads = X(VEC[c].bad);
    const gx = goods.filter(v => chk[c](v) !== '').map(v => JSON.stringify(v).slice(0, 60) + ' → ' + chk[c](v));
    const bx = bads.filter(v => chk[c](v) === '').map(v => JSON.stringify(v).slice(0, 60));
    ok('เวกเตอร์ ' + c + ': ค่าที่ถูกต้องผ่านครบ (' + goods.length + ')', gx.length === 0, gx.join(' | '));
    ok('เวกเตอร์ ' + c + ': ค่าที่ผิดถูกปฏิเสธครบ (' + bads.length + ')', bx.length === 0, bx.join(' | '));
  }

  // ── 2. ตัวทำความสะอาด ──────────────────────────────────────────────
  ok('normSocial: ตัด ? # · เติม https · โฮสต์ตัวพิมพ์เล็ก · เก็บตัวพิมพ์ใน path',
    normSocial('instagram.com/Dj.Lab?hl=th') === 'https://instagram.com/Dj.Lab' && normSocial('HTTP://WWW.INSTAGRAM.COM/x#a') === 'https://www.instagram.com/x' && normSocial('  ') === '' &&
    normSocial('https://youtube.com/@DJZlex?si=1') === 'https://youtube.com/@DJZlex', [normSocial('instagram.com/Dj.Lab?hl=th'), normSocial('HTTP://WWW.INSTAGRAM.COM/x#a')].join(' | '));
  ok('normSocial: โฮสต์ปลอมไม่ถูก "ซ่อม" ให้ผ่าน', TP.socials({ instagram: normSocial('https://instagram.com.evil.com/x') }) !== '' && TP.socials({ instagram: normSocial('https://instagram.com@evil.com/x') }) !== '');
  ok('ytId: ลิงก์ watch / youtu.be / shorts / embed / รหัสตรง · อ่านไม่ออก = undefined · ว่าง = null',
    ytId('https://www.youtube.com/watch?v=dQw4w9WgXcQ') === 'dQw4w9WgXcQ' && ytId('https://youtu.be/dQw4w9WgXcQ?t=5') === 'dQw4w9WgXcQ' && ytId('https://youtube.com/shorts/dQw4w9WgXcQ') === 'dQw4w9WgXcQ' &&
    ytId('https://www.youtube.com/embed/dQw4w9WgXcQ') === 'dQw4w9WgXcQ' && ytId('dQw4w9WgXcQ') === 'dQw4w9WgXcQ' && ytId('https://evil.com/watch?v=dQw4w9WgXcQ') === undefined && ytId('hello') === undefined && ytId('') === null);
  const ct = cleanText('ก\\u200bข\\u202eค\\r\\nง\\rจ', true);
  ok('cleanText: ตัดตัวล่องหน/ทิศทางออกและนับ · CRLF → LF', ct.text === 'กขค\\nง\\nจ' && ct.removed === 2, JSON.stringify(ct));

  // ── 3. ครูล้วน (Maniac): เห็นอะไร ────────────────────────────────────
  await signIn('maniac');
  ok('ครูล้วนเข้าหน้าได้ เห็นฟอร์มของตัวเอง ชื่อบนหัว "ครู Maniac"', !!$('f_bio') && $('who').textContent === 'ครู Maniac' && !$('logoutBtn').hidden, $('who').textContent);
  ok('ครูล้วนไม่เห็นตัวเลือกครู/สวิตช์ซ่อน', !$('tsel') && !$('hideChk') && !$('hiddenBanner'));
  ok('ค่าในฟอร์มตรงแถวตัวเอง (bio · จุดเด่น 2 · IG)', $('f_bio').value === 'ประวัติเดิมของ Maniac' && document.querySelectorAll('[data-hl]').length === 2 && $('f_soc_instagram').value === 'https://www.instagram.com/maniac', $('f_bio').value);
  ok('ตัวนับ bio ทำงาน', /21 \\/ 1,200|\\d+ \\/ 1,200/.test($('cnt_bio').textContent), $('cnt_bio').textContent);
  ok('ไม่ได้ดึงข้อมูลแถวครูคนอื่น (ฐานให้เห็นเฉพาะแถวตัวเอง)', document.querySelectorAll('#preview h3').length === 1 && $('preview').querySelector('h3').textContent === 'Maniac');
  ok('คำเตือนแดงตัวหนา: ขึ้นเว็บทันที · โลโก้/ผลิตภัณฑ์ Pioneer/AlphaTheta/NEO · ใบหน้านักเรียน/ผู้เยาว์/ข้อมูลลูกค้า · ลิงก์เฉพาะช่องโซเชียล',
    [...$('warnBox').querySelectorAll('.wk-red')].length === 4 && [...$('warnBox').querySelectorAll('.wk-red')].every(isRed) && /ขึ้นเว็บสาธารณะทันที/.test($('warnBox').textContent) && /Pioneer DJ.*AlphaTheta.*NEO by OYAIDE/.test($('warnBox').textContent) && /ผู้เยาว์/.test($('warnBox').textContent));
  const web = $('webLink');
  ok('ปุ่ม "ดูหน้าเว็บจริง" ชี้ djlabsiam.com/teachers/maniac/ เปิดแท็บใหม่ noopener', web.getAttribute('href') === 'https://djlabsiam.com/teachers/maniac/' && web.target === '_blank' && /noopener/.test(web.rel));
  ok('ลิงก์กลับของครูล้วน = teacher.html', $('backLink').getAttribute('href') === 'teacher.html', $('backLink').getAttribute('href'));
  ok('ตัวอักษร ≥ 14px ทุกช่อง/ปุ่ม/ป้าย', [...document.querySelectorAll('#app label, #app input, #app textarea, #app button, #app .hint, #app .cnt, #app h2, #app .alert, #app li')].every(e => fs(e) >= 14), [...document.querySelectorAll('#app label, #app input, #app textarea, #app button, #app .hint, #app .cnt, #app h2, #app .alert, #app li')].filter(e => fs(e) < 14).map(e => e.tagName + '.' + e.className + ':' + fs(e)).slice(0, 5).join());

  // ── 4. ตรวจก่อนส่ง: ไม่ผ่าน = ไม่ยิงฐาน แถบแดงบอกข้อ ───────────────────
  CALLS.length = 0;
  fill($('f_bio'), 'ก'.repeat(1201));
  ok('bio เกิน: ตัวนับเป็นแดง', isRed($('cnt_bio')), $('cnt_bio').textContent);
  await doSave();
  ok('bio เกิน 1,200: ไม่ยิงอะไรไปฐาน · แถบแดงบอก "ประวัติ: ยาวเกิน 1200"', writes().length === 0 && /ประวัติ: ยาวเกิน 1200/.test(T('errBox')) && [...$('errBox').querySelectorAll('li')].every(isRed), $('errBox') && T('errBox'));
  fill($('f_bio'), 'ดูที่ https://evil.com');
  await doSave();
  ok('ลิงก์ในข้อความ: ไม่ส่ง · บอกให้ใส่ลิงก์เฉพาะช่องโซเชียล', writes().length === 0 && /ใส่ลิงก์ได้เฉพาะช่องโซเชียล/.test(T('errBox')), $('errBox') && T('errBox'));
  fill($('f_bio'), 'ปกติ'); fill($('f_soc_instagram'), 'https://evil.com/x');
  await doSave();
  ok('โซเชียลผิดโฮสต์: ไม่ส่ง · แถบแดง', writes().length === 0 && /ลิงก์ instagram ไม่ถูกต้อง/.test(T('errBox')), $('errBox') && T('errBox'));
  fill($('f_soc_instagram'), 'https://www.instagram.com/maniac'); fill($('f_video'), 'hello');
  ok('วิดีโออ่านไม่ออก: คำใบ้ใต้ช่องเป็นแดง', isRed($('videoHint')), $('videoHint').textContent);
  await doSave();
  ok('วิดีโออ่านไม่ออก: ไม่ส่ง · แถบแดง', writes().length === 0 && /วิดีโอ: อ่านรหัสจากลิงก์ไม่ได้/.test(T('errBox')));
  fill($('f_video'), '');

  // ── 5. บันทึกสำเร็จ: ส่งอะไรให้ฐาน ────────────────────────────────────
  fill($('f_bio'), '  สวัสดี\\u200bครับ  \\r\\nบรรทัดสอง');
  fill($('f_soc_facebook'), 'facebook.com/Some-Page-123?ref=x');
  fill($('f_soc_tiktok'), ' ');
  fill($('f_video'), 'https://youtu.be/dQw4w9WgXcQ');
  fill(document.querySelector('[data-hl="1"]'), '   ');
  clickAct('hl-add');
  fill(document.querySelector('[data-hl="2"]'), 'รางวัล C');
  CALLS.length = 0;
  await doSave();
  const u1 = updates();
  ok('บันทึก: update teacher_profiles ครั้งเดียว กรอง id ของตัวเอง + rev ที่โหลดมา', u1.length === 1 && u1[0].table === 'teacher_profiles' && JSON.stringify(u1[0].filters) === JSON.stringify([['id', 't-maniac'], ['rev', 1]]), JSON.stringify(u1[0] && u1[0].filters));
  const p = u1[0] && u1[0].payload;
  ok('payload มีเฉพาะ 5 คอลัมน์โปรไฟล์ (ไม่มี is_hidden / slug / id / rev / updated_*)', !!p && Object.keys(p).sort().join() === 'bio,highlights,portfolio,socials,video_id', p && Object.keys(p).join());
  ok('ค่าที่ส่งสะอาด: bio ตัดตัวล่องหน/ช่องว่างหัวท้าย-ท้ายบรรทัด/CRLF', p && p.bio === 'สวัสดีครับ\\nบรรทัดสอง', p && JSON.stringify(p.bio));
  ok('ไฮไลต์/โซเชียล/วิดีโอในคำขอ', p && JSON.stringify(p.highlights) === JSON.stringify(['รางวัล A', 'รางวัล C']) && JSON.stringify(p.socials) === JSON.stringify({ instagram: 'https://www.instagram.com/maniac', facebook: 'https://facebook.com/Some-Page-123' }) && p.video_id === 'dQw4w9WgXcQ', p && JSON.stringify([p.highlights, p.socials, p.video_id]));
  ok('บันทึกแล้วขึ้น "ขึ้นเว็บแล้ว" · แจ้งว่าตัดตัวล่องหนให้ · แถวในฐานเปลี่ยนจริง rev 1 → 2', /ขึ้นเว็บแล้ว/.test(T('flash')) && /ตัดตัวอักษรล่องหนออก 1 ตัว/.test(T('notesBox')) && row('maniac').rev === 2 && row('maniac').video_id === 'dQw4w9WgXcQ', $('flash') && T('flash'));
  ok('หลังบันทึก ฟอร์มโหลดค่าที่บันทึกแล้ว (จุดเด่น 2 · วิดีโอเป็นรหัส) ไม่มีแถบ error', document.querySelectorAll('[data-hl]').length === 2 && $('f_video').value === 'dQw4w9WgXcQ' && !fatal() && !$('errBox'));
  const pl = [...document.querySelectorAll('#preview .links a')];
  ok('ลิงก์โซเชียลในตัวอย่าง: เปิดแท็บใหม่ noopener noreferrer · href เป็น https ที่ผ่านตัวตรวจเท่านั้น', pl.length === 2 && pl.every(a => a.target === '_blank' && /noopener/.test(a.rel) && /noreferrer/.test(a.rel) && a.href.startsWith('https://')), pl.map(a => a.href + ' ' + a.rel).join(' | '));
  ok('ไม่มี insert/delete/upsert · ไม่มีอะไรลบไฟล์ในถัง', writes().every(c => c.op === 'update') && !CALLS.some(c => c.op === 'remove'));

  // ── 6. ชนกัน (0 แถว) / ฐานปฏิเสธ / เน็ตล่ม: แจ้งตามจริง ───────────────────
  fill($('f_bio'), 'แก้รอบสอง');
  row('maniac').rev += 5;                                     // มีคนแก้ (เช่น เจ้าของย้อน/ซ่อน) ระหว่างที่ครูพิมพ์
  await doSave();
  ok('rev ไม่ตรง (0 แถว): แถบแดง "มีคนแก้…" ไม่ขึ้นสำเร็จหลอก · ข้อความที่พิมพ์ยังอยู่', /บันทึกไม่สำเร็จ — มีคนแก้หรือซ่อน/.test(fatal()) && !$('flash') && $('f_bio').value === 'แก้รอบสอง', fatal());
  clearFatal();
  FAIL.update = { code: '23514', message: 'new row for relation "teacher_profiles" violates check constraint "tp_bio_ok"' };
  await doSave();
  ok('ฐานปฏิเสธ (CHECK): แถบแดงบอกให้ตรวจความยาว/ลิงก์ ไม่ขึ้นสำเร็จ · ปุ่มกดได้อีก', /ข้อมูลไม่ผ่านกติกาของฐานข้อมูล/.test(fatal()) && !$('flash') && !$('saveBtn').disabled, fatal());
  clearFatal();
  FAIL.update = { code: '42501', message: 'permission denied for table teacher_profiles' };
  await doSave();
  ok('ไม่มีสิทธิ์: "ไม่มีสิทธิ์ทำรายการนี้"', /ไม่มีสิทธิ์ทำรายการนี้/.test(fatal()), fatal());
  clearFatal();
  FAIL.update = null; FAIL.throwUpdate = true;
  await doSave();
  ok('เน็ตล่ม: แถบแดง ปุ่มไม่ค้างเป็น "กำลังบันทึก"', /บันทึกโปรไฟล์ไม่สำเร็จ/.test(fatal()) && !$('saveBtn').disabled && $('saveBtn').textContent === 'บันทึกและขึ้นเว็บ', fatal() + ' / ' + $('saveBtn').textContent);
  clearFatal(); FAIL.throwUpdate = false;
  clickAct('reload'); await sleep(100);
  ok('โหลดข้อมูลล่าสุด: ฟอร์มกลับเป็นค่าในฐาน', $('f_bio').value === 'สวัสดีครับ\\nบรรทัดสอง' && row('maniac').rev >= 7, $('f_bio').value);

  // ── 7. จุดเด่น: เพิ่ม/ลบ/เลื่อน · เพดาน 6 ───────────────────────────────
  while (document.querySelectorAll('[data-hl]').length < 6) clickAct('hl-add');
  ok('ครบ 6 รายการ: ปุ่มเพิ่มถูกปิด', $('app').querySelector('[data-act="hl-add"]').disabled && $('cnt_hl').textContent === '6/6');
  fill(document.querySelector('[data-hl="0"]'), 'หนึ่ง'); fill(document.querySelector('[data-hl="1"]'), 'สอง');
  clickAct('hl-dn', 0);
  ok('เลื่อนลง: ลำดับสลับ', document.querySelector('[data-hl="0"]').value === 'สอง' && document.querySelector('[data-hl="1"]').value === 'หนึ่ง');
  clickAct('hl-del', 0);
  ok('ลบ: เหลือ 5 · ปุ่มเพิ่มกลับมา', document.querySelectorAll('[data-hl]').length === 5 && !$('app').querySelector('[data-act="hl-add"]').disabled);
  clickAct('reload'); await sleep(80);

  // ── 8. รูป Portfolio: ย่อ + อัปโหลด + alt บังคับ ──────────────────────
  CALLS.length = 0;
  const big = fileOf(2400, 1600, true, 'image/jpeg');
  await addPhoto(big);
  const up = CALLS.filter(c => c.op === 'upload');
  ok('อัปโหลด: ถัง teacher-portfolio · path = maniac/<hex 12>.webp|jpg · ชนิดภาพ · ไม่ทับไฟล์เดิม (upsert false)', up.length === 1 && up[0].bucket === 'teacher-portfolio' && /^maniac\\/[0-9a-f]{12}\\.(webp|jpg)$/.test(up[0].path) && /^image\\/(webp|jpeg)$/.test(up[0].type) && up[0].opts.upsert === false, JSON.stringify(up[0]));
  ok('รูปใหญ่ (JPEG 2400×1600 สัญญาณรบกวนล้วน) ถูกย่อให้ ≤ 1 MB และด้านยาว ≤ 1600px', up.length === 1 && up[0].size <= 1000000 && up[0].size > 1000 && Math.max(up[0].w, up[0].h) <= 1600 && Math.max(up[0].w, up[0].h) > 100, JSON.stringify(up[0] && [up[0].size, up[0].w, up[0].h]));
  ok('อัปโหลดด้วย contentType ตรงกับไฟล์ที่ย่อแล้ว', up.length === 1 && up[0].opts.contentType === up[0].type, JSON.stringify(up[0] && up[0].opts));
  ok('เพิ่มเข้ารายการแล้ว alt ว่าง · มีข้อความบอกให้กรอก alt', document.querySelectorAll('.pf').length === 1 && !!document.querySelector('[data-alt="0"]') && document.querySelector('[data-alt="0"]').value === '' && /กรอกคำอธิบายรูป/.test(T('flash')));
  ok('ไม่ได้บันทึกอัตโนมัติ (ยังไม่มี update)', updates().length === 0);
  await doSave();
  ok('alt ว่าง: บันทึกไม่ได้ · แถบแดงบอก "คำอธิบายรูป (alt) ต้องกรอก" · ไม่ยิงฐาน', updates().length === 0 && /รูปที่ 1: คำอธิบายรูป \\(alt\\) ต้องกรอก/.test(T('errBox')), $('errBox') && T('errBox'));
  fill(document.querySelector('[data-alt="0"]'), 'ผมกำลังสแครชบนเวที');
  await doSave();
  ok('กรอก alt แล้วบันทึกได้ · portfolio ในคำขอ = [{path, alt}] เท่านั้น', updates().length === 1 && updates()[0].payload.portfolio.length === 1 && Object.keys(updates()[0].payload.portfolio[0]).sort().join() === 'alt,path' && updates()[0].payload.portfolio[0].path === up[0].path, JSON.stringify(updates()[0] && updates()[0].payload.portfolio));
  CALLS.length = 0;
  await addPhoto(fileOf(3000, 2000, false, 'image/png'));
  const upFlat = CALLS.filter(c => c.op === 'upload');
  ok('รูปแบนขนาดใหญ่ (PNG 3000×2000 ไฟล์เล็ก) ถูกจำกัดด้านยาวที่ 1600px แม้ขนาดไฟล์ไม่เกิน 1 MB', upFlat.length === 1 && Math.max(upFlat[0].w, upFlat[0].h) === 1600 && upFlat[0].size <= 1000000, JSON.stringify(upFlat[0] && [upFlat[0].size, upFlat[0].w, upFlat[0].h]));
  clickAct('pf-del', 1);
  const small = fileOf(400, 300, false, 'image/png');
  CALLS.length = 0;
  await addPhoto(small);
  const up2 = CALLS.filter(c => c.op === 'upload');
  ok('รูปเล็ก (PNG) ก็แปลงเป็น WebP/JPEG แล้วอัปโหลด · ชื่อไม่ซ้ำกับรูปแรก', up2.length === 1 && /^image\\/(webp|jpeg)$/.test(up2[0].type) && up2[0].path !== up[0].path);
  clickAct('pf-del', 1);
  ok('เอารูปออกจากรายการ: ไม่มีคำสั่งลบไฟล์ในถัง (ให้เจ้าของ undo ย้อนรูปได้)', document.querySelectorAll('.pf').length === 1 && !CALLS.some(c => c.op === 'remove'));
  // เพดาน 8 รูป
  st.f.pf = Array.from({ length: 8 }, (_, i) => ({ path: 'maniac/p' + i + '.webp', alt: 'รูป ' + i })); render();
  ok('ครบ 8 รูป: ปุ่มเพิ่มรูปถูกปิด', $('pfile').disabled && $('pfileLbl').getAttribute('aria-disabled') === 'true');
  CALLS.length = 0;
  await addPhoto(small);
  ok('เรียกเพิ่มรูปตรง ๆ ตอนครบ 8: ไม่อัปโหลด · แจ้งแดง', !CALLS.some(c => c.op === 'upload') && /ไม่เกิน 8 รูป/.test(fatal()), fatal());
  clearFatal();
  clickAct('reload'); await sleep(80);
  FAIL.upload = { message: 'The object exceeded the maximum allowed size', statusCode: 413 };
  CALLS.length = 0;
  await addPhoto(small);
  ok('อัปโหลดล้มเหลว: แถบแดง · ไม่เพิ่มเข้ารายการ · ปุ่มไม่ค้าง', /อัปโหลดรูปไม่สำเร็จ/.test(fatal()) && document.querySelectorAll('.pf').length === 1 && !$('pfile').disabled, fatal());
  clearFatal(); FAIL.upload = null;
  CALLS.length = 0;
  await addPhoto(new File([new Uint8Array([1, 2, 3])], 'x.png', { type: 'image/png' }));
  ok('ไฟล์ที่ไม่ใช่รูป: แจ้งแดง ไม่อัปโหลด', /เพิ่มรูปไม่สำเร็จ/.test(fatal()) && !CALLS.some(c => c.op === 'upload'), fatal());
  clearFatal();

  // ── 9. XSS: ข้อมูลครูไม่ถูกตีความเป็น HTML ─────────────────────────────
  row('maniac').bio = '</textarea><img src=x onerror="window.__xss=4"><img src=x onerror="window.__xss=1">เนื้อหา'; row('maniac').highlights = ['"><img src=x onerror="window.__xss=5">', '<b onmouseover="window.__xss=2">x</b>'];
  row('maniac').portfolio = [{ path: 'maniac/a.webp', alt: '"><img src=x onerror=window.__xss=3>' }];
  clickAct('reload'); await sleep(100);
  ok('bio/จุดเด่น/alt ที่มีแท็ก: แสดงเป็นข้อความ ไม่รันสคริปต์', !window.__xss && !document.querySelector('#preview img[onerror]') && !document.querySelector('#app img[onerror]') && $('f_bio').value.indexOf('</textarea>') === 0 && document.querySelectorAll('[data-hl]').length === 2 && document.querySelector('[data-hl="0"]').value.indexOf('"><img') === 0 && $('preview').textContent.indexOf('<img') !== -1, String(window.__xss));
  row('maniac').bio = 'ประวัติเดิมของ Maniac'; row('maniac').highlights = ['รางวัล A']; row('maniac').portfolio = [];

  // ── 10. เจ้าของ: เลือกครูได้ · ซ่อนได้ ───────────────────────────────
  await signOut();
  await signIn('zlex');
  ok('เจ้าของ: เห็นตัวเลือกครู 6 คน · ตั้งต้นที่แถวตัวเอง (Zlex) · ลิงก์กลับ desk.html', !!$('tsel') && $('tsel').options.length === 6 && $('tsel').value === 't-zlex' && $('f_bio').value === 'ประวัติของ Zlex' && $('backLink').getAttribute('href') === 'desk.html', $('tsel') && $('tsel').value);
  ok('ตัวเลือกบอก "(ซ่อนจากเว็บ)" ของ Nutty', [...$('tsel').options].find(o => o.value === 't-nutty').textContent === 'Nutty (ซ่อนจากเว็บ)');
  ok('แถวของตัวเอง: ไม่มีคำเตือน "แก้ของคนอื่น"', !/ไม่ใช่ของคุณ/.test($('app').textContent));
  $('tsel').value = 't-maniac'; $('tsel').dispatchEvent(new Event('change', { bubbles: true }));
  ok('สลับไปแก้ครูคนอื่น: โหลดแถวนั้น · ป้ายแดง "กำลังแก้โปรไฟล์ของ Maniac (ไม่ใช่ของคุณ)" · ลิงก์เว็บเปลี่ยนตาม', $('f_bio').value === 'ประวัติเดิมของ Maniac' && isRed(document.querySelector('#app .hint.wk-red')) && /กำลังแก้โปรไฟล์ของ Maniac/.test($('app').textContent) && $('webLink').getAttribute('href') === 'https://djlabsiam.com/teachers/maniac/', $('f_bio').value);
  fill($('f_bio'), 'เจ้าของแก้แทน');
  CALLS.length = 0;
  await doSave();
  ok('เจ้าของบันทึกแถวครูอื่นได้ (กรอง id ของ maniac) · payload ไม่มี is_hidden', updates().length === 1 && updates()[0].filters[0][1] === 't-maniac' && !('is_hidden' in updates()[0].payload) && row('maniac').bio === 'เจ้าของแก้แทน', JSON.stringify(updates()[0] && updates()[0].filters));
  CALLS.length = 0;
  $('hideChk').checked = true; $('hideChk').dispatchEvent(new Event('change', { bubbles: true })); await sleep(80);
  ok('ติ๊กซ่อน: update {is_hidden: true} อย่างเดียว กรอง id + rev · แสดงผล · ตัวเลือกครูมี "(ซ่อนจากเว็บ)"', updates().length === 1 && JSON.stringify(updates()[0].payload) === '{"is_hidden":true}' && updates()[0].filters.length === 2 && row('maniac').is_hidden === true && /ซ่อนโปรไฟล์จากเว็บแล้ว/.test(T('flash')) && [...$('tsel').options].find(o => o.value === 't-maniac').textContent === 'Maniac (ซ่อนจากเว็บ)', JSON.stringify(updates()[0]));
  fill($('f_bio'), 'พิมพ์ค้างระหว่างสลับซ่อน');
  $('hideChk').checked = false; $('hideChk').dispatchEvent(new Event('change', { bubbles: true })); await sleep(80);
  ok('ยกเลิกซ่อน: แสดงกลับ · ข้อความที่พิมพ์ค้างไม่หาย', row('maniac').is_hidden === false && $('f_bio').value === 'พิมพ์ค้างระหว่างสลับซ่อน', $('f_bio').value);
  row('maniac').rev += 3;
  $('hideChk').checked = true; $('hideChk').dispatchEvent(new Event('change', { bubbles: true })); await sleep(80);
  ok('ซ่อนตอน rev ไม่ตรง (0 แถว): แถบแดง ไม่ขึ้นสำเร็จ', /เปลี่ยนสถานะซ่อนไม่สำเร็จ/.test(fatal()) && row('maniac').is_hidden === false, fatal());
  clearFatal();

  // ── 11. ผู้ดูแล + พนักงานที่เป็นครู ───────────────────────────────────
  await signOut();
  await signIn('tibass');
  ok('ผู้ดูแล (Tibass เป็นครูด้วย): เหมือนครูทั่วไป — เห็นฟอร์มของตัวเองอย่างเดียว ไม่มีตัวเลือกครู/สวิตช์ซ่อน', !$('tsel') && !$('hideChk') && !!$('f_bio') && $('who').textContent === 'ครู Tibass' && document.querySelectorAll('#preview h3').length === 1 && $('preview').querySelector('h3').textContent === 'Tibass', $('who').textContent);
  CALLS.length = 0;
  await setHidden(true);
  ok('ผู้ดูแลเรียก setHidden ตรง ๆ: ไม่ยิงฐาน (ซ่อนได้เฉพาะเจ้าของ)', updates().length === 0);
  fill($('f_bio'), 'ผู้ดูแลแก้ของตัวเอง');
  await doSave();
  ok('ผู้ดูแลบันทึกโปรไฟล์ตัวเองได้ · กรอง id ของตัวเอง · ไม่มี is_hidden / publish_ack_at (ติ๊กไว้แล้ว)', updates().length === 1 && updates()[0].filters[0][1] === 't-tibass' && Object.keys(updates()[0].payload).sort().join() === 'bio,highlights,portfolio,socials,video_id' && row('tibass').bio === 'ผู้ดูแลแก้ของตัวเอง', JSON.stringify(updates()[0]));
  await signOut();
  await signIn('adminOnly');
  ok('ผู้ดูแลที่ไม่ใช่ครู: "หน้านี้สำหรับครู" ไม่ดึงโปรไฟล์ ไม่โชว์ฟอร์ม/ตัวเลือกครู (แก้แทนคนอื่นเฉพาะเจ้าของ)', !!$('notAllowed') && !$('f_bio') && !$('tsel'), $('app').textContent.slice(0, 80));
  await signOut();
  await signIn('nutty');
  ok('พนักงานที่เป็นครู (Nutty): เห็นเฉพาะแถวตัวเอง · ไม่มีตัวเลือกครู/สวิตช์ซ่อน · เห็นป้าย "ถูกซ่อน" (แถวของเขาถูกซ่อน)', !$('tsel') && !$('hideChk') && !!$('hiddenBanner') && /ถูกซ่อน/.test(T('hiddenBanner')) && $('who').textContent === 'ครู Nutty' && $('backLink').getAttribute('href') === 'desk.html', $('who').textContent);
  ok('Nutty (พนักงาน) เห็นแค่ตัวเอง แม้ฐานจริงให้พนักงานอ่านได้ทุกแถว — หน้านี้ไม่เปิดตัวเลือกแก้คนอื่น', document.querySelectorAll('#preview h3').length === 1 && $('preview').querySelector('h3').textContent === 'Nutty');
  CALLS.length = 0;
  await setHidden(false);
  ok('เรียก setHidden ตรง ๆ โดยไม่ใช่เจ้าของ/ผู้ดูแล: ไม่ยิงฐาน', updates().length === 0);
  fill($('f_bio'), 'แก้โดย Nutty');
  await doSave();
  ok('Nutty แก้ของตัวเองได้ (แม้ถูกซ่อน) · ข้อความบอก "(แต่โปรไฟล์นี้ถูกซ่อนจากเว็บอยู่)"', row('nutty').bio === 'แก้โดย Nutty' && /ถูกซ่อนจากเว็บอยู่/.test(T('flash')), $('flash') && T('flash'));
  ok('ไม่รั่วข้อมูลบัญชีก่อนหน้า (ข้อความ bio ของ Maniac/Zlex ไม่อยู่ในหน้า)', $('app').textContent.indexOf('เจ้าของแก้แทน') === -1 && $('app').textContent.indexOf('ประวัติของ Zlex') === -1);

  // ── 12. บัญชีที่ไม่ใช่ครู / ไม่มีตัวตน / ฐานยังไม่รัน / ไม่มีแถว ─────────
  await signOut();
  CALLS.length = 0;
  await signIn('staff');
  ok('พนักงานที่ไม่ใช่ครู: "หน้านี้สำหรับครู" ไม่ดึงโปรไฟล์ ไม่โชว์ฟอร์ม', !!$('notAllowed') && !$('f_bio') && !CALLS.some(c => c.table === 'teacher_profiles'), $('app').textContent.slice(0, 80));
  await signOut();
  await signIn('ghost');
  ok('บัญชีที่ไม่มีแถว admins และไม่ใช่ครู: ข้อความเดียวกัน', !!$('notAllowed') && !$('f_bio'));
  await signOut();
  FAKE.noTable = true;
  await signIn('maniac');
  ok('ฐานยังไม่รัน 068: บอกตรง ๆ ว่าต้องรัน migration 068 · ไม่มีฟอร์ม', !!$('missing') && /migration 068/.test(T('missing')) && !$('f_bio'), $('app').textContent.slice(0, 100));
  await signOut();
  FAKE.noTable = false; FAKE.noRowFor = 't-maniac';
  await signIn('maniac');
  ok('ครูที่ยังไม่มีแถวโปรไฟล์: ข้อความให้แจ้งเจ้าของร้าน · ไม่มีฟอร์ม', !!$('noRow') && /แจ้งเจ้าของร้าน/.test(T('noRow')) && !$('f_bio'));
  FAKE.noRowFor = null;
  await signOut();
  ok('ออกจากระบบ: ล้างทุกอย่าง กลับหน้าล็อกอิน', !!$('loginForm') && !$('f_bio') && $('who').textContent === '' && $('logoutBtn').hidden);

  // ── 13. ยืนยันเผยแพร่ (publish_ack_at) ───────────────────────────────
  await signOut();
  await signIn('alldayz');
  ok('ครูที่ยังไม่ติ๊ก: เห็นกล่องยืนยันเผยแพร่ (แดงตัวหนา) · ช่องติ๊กยังไม่ติ๊ก · เป้ากด ≥ 44px', !!$('ackBox') && !$('ackChk').checked && isRed($('ackBox').querySelector('.wk-red')) && /ยืนยันให้เผยแพร่/.test(T('ackBox')) && $('ackChk').closest('label').getBoundingClientRect().height >= 44, $('ackBox') && T('ackBox'));
  CALLS.length = 0;
  fill($('f_bio'), 'ประวัติของ Alldayz');
  await doSave();
  ok('ยังไม่ติ๊ก: บันทึกไม่ได้ · ไม่ยิงฐาน · แถบแดงบอกให้ติ๊ก', writes().length === 0 && /ต้องติ๊กยืนยันการเผยแพร่ก่อนบันทึกครั้งแรก/.test(T('errBox')) && [...$('errBox').querySelectorAll('li')].every(isRed), $('errBox') && T('errBox'));
  $('ackChk').checked = true; $('ackChk').dispatchEvent(new Event('change', { bubbles: true }));
  await doSave();
  const ua = updates();
  ok('ติ๊กแล้วบันทึก: ส่ง publish_ack_at (เวลา ISO) มาพร้อมเนื้อหา ครั้งเดียว · แถวในฐานมีเวลายืนยัน', ua.length === 1 && typeof ua[0].payload.publish_ack_at === 'string' && !isNaN(Date.parse(ua[0].payload.publish_ack_at)) && Object.keys(ua[0].payload).sort().join() === 'bio,highlights,portfolio,publish_ack_at,socials,video_id' && !!row('alldayz').publish_ack_at && row('alldayz').bio === 'ประวัติของ Alldayz', JSON.stringify(ua[0] && ua[0].payload));
  ok('หลังบันทึก: กล่องยืนยันหาย · ขึ้นบรรทัด "ยืนยันให้เผยแพร่แล้ว" · ขึ้นเว็บแล้ว', !$('ackBox') && !!$('ackDone') && /ยืนยันให้เผยแพร่แล้ว/.test(T('ackDone')) && /ขึ้นเว็บแล้ว/.test(T('flash')), $('ackDone') && T('ackDone'));
  CALLS.length = 0;
  fill($('f_bio'), 'แก้รอบสอง');
  await doSave();
  ok('บันทึกครั้งต่อไปไม่ส่ง publish_ack_at ซ้ำ (ติ๊กครั้งเดียว)', updates().length === 1 && !('publish_ack_at' in updates()[0].payload), JSON.stringify(updates()[0] && updates()[0].payload));
  row('alldayz').publish_ack_at = null; clickAct('reload'); await sleep(100);
  ok('ฐานบอกว่ายังไม่ยืนยัน (เช่นโหลดใหม่): กล่องยืนยันกลับมา ช่องติ๊กรีเซ็ต', !!$('ackBox') && !$('ackChk').checked);
  // ครูที่ติ๊กแล้ว (Maniac) ไม่เห็นกล่อง
  await signOut();
  await signIn('maniac');
  ok('ครูที่ติ๊กแล้ว: ไม่มีกล่องยืนยัน · เห็นบรรทัดยืนยันแล้ว', !$('ackBox') && !!$('ackDone'));
  // เจ้าของดูโปรไฟล์ครูที่ยังไม่ติ๊ก: ไม่มีช่องติ๊ก มีคำเตือน · บันทึกแทนได้ ไม่ส่ง publish_ack_at
  await signOut();
  await signIn('zlex');
  $('tsel').value = 't-alldayz'; $('tsel').dispatchEvent(new Event('change', { bubbles: true }));
  ok('เจ้าของดูครูที่ยังไม่ติ๊ก: ไม่มีช่องติ๊ก · มีคำเตือนว่าครูต้องติ๊กเอง', !$('ackChk') && !$('ackBox') && !!$('ackNone') && /ครูต้องติ๊กเอง/.test(T('ackNone')), $('app').textContent.slice(0, 60));
  fill($('f_bio'), 'เจ้าของแก้แทน Alldayz');
  CALLS.length = 0;
  await doSave();
  ok('เจ้าของบันทึกแทนครูที่ยังไม่ติ๊กได้ · ไม่ส่ง publish_ack_at · ครูยังไม่ถูกถือว่ายืนยัน', updates().length === 1 && !('publish_ack_at' in updates()[0].payload) && row('alldayz').bio === 'เจ้าของแก้แทน Alldayz' && row('alldayz').publish_ack_at === null, JSON.stringify(updates()[0] && updates()[0].payload));
  // เจ้าของที่เป็นครูเอง ยังไม่ติ๊ก → ต้องติ๊กเหมือนครูทั่วไป
  row('zlex').publish_ack_at = null; clickAct('reload'); await sleep(100);
  $('tsel').value = 't-zlex'; $('tsel').dispatchEvent(new Event('change', { bubbles: true }));
  ok('เจ้าของดูแถวตัวเองที่ยังไม่ติ๊ก: เห็นกล่องยืนยันเหมือนครู', !!$('ackBox') && !!$('ackChk'));
  await signOut();

  // ── 14. ออกจากระบบ → หน้าเข้าสู่ระบบของคอนโซล (ลำดับเปิดหน้าต่อกันจริงอยู่ที่ tests/teacher-logout.mjs) ──
  const src = GO_SRC.replace(/\\s+/g, ' ');
  ok('ปลายทางเป็นพาธคงที่ desk.html: ไม่อ่าน query · hash · referrer · URL · โดเมนใด ๆ (กัน open redirect)', src === "function goConsoleLogin() { location.replace('desk.html'); }", src);
  const g0 = GOLOGIN;                           // ท้ายหัวข้อ 13 ออกจากระบบไว้แล้ว → ตอนนี้อยู่หน้าเข้าสู่ระบบ
  history.replaceState(null, '', location.pathname + '?next=https://evil.example/x&redirect=//evil.example/y#https://evil.example/z');
  authCb('SIGNED_OUT', null); await sleep(150);
  ok('ยังไม่เคยล็อกอินในหน้านี้: ได้ SIGNED_OUT ก็ไม่เด้ง · ค้างที่ฟอร์มเข้าสู่ระบบ', GOLOGIN === g0 && !!$('loginForm'), String(GOLOGIN));
  $('lgEmail').value = 'unknown@x'; $('lgPass').value = 'bad'; $('loginForm').requestSubmit(); await sleep(200);
  ok('รหัสผิด: ไม่เด้ง', GOLOGIN === g0 && !!$('loginErr'), String(GOLOGIN));
  await signIn('maniac');
  ok('เข้าสำเร็จ: ไม่เด้ง · เห็นฟอร์มโปรไฟล์', GOLOGIN === g0 && !!$('f_bio'), GOLOGIN + ' ' + !!$('f_bio'));
  authCb('TOKEN_REFRESHED', SESSION); await sleep(150);
  ok('ต่ออายุ token (TOKEN_REFRESHED): ไม่เด้ง ไม่ล้างหน้า', GOLOGIN === g0 && !!$('f_bio'));
  const realSignOut = db.auth.signOut;
  db.auth.signOut = async () => ({ error: { message: 'Failed to fetch', code: 'x' } });
  clearFatal();
  $('logoutBtn').click(); await sleep(200);
  ok('signOut ล้ม: ไม่เด้ง · ยังอยู่หน้าโปรไฟล์พร้อมฟอร์ม · session ยังอยู่ · แถบแดงบอกว่าออกไม่สำเร็จ', GOLOGIN === g0 && !!$('f_bio') && !!SESSION && /ออกจากระบบไม่สำเร็จ/.test(fatal()), GOLOGIN + ' ' + fatal());
  clearFatal();
  db.auth.signOut = realSignOut;
  await signOut();
  ok('ลองใหม่สำเร็จ: เด้งไปหน้าเข้าสู่ระบบของคอนโซล 1 ครั้ง · session หาย · หน้าไม่เหลือฟอร์ม/ชื่อ', GOLOGIN === g0 + 1 && !SESSION && !$('f_bio') && $('who').textContent === '' && $('logoutBtn').hidden, GOLOGIN + ' ' + !!SESSION);
  await signIn('maniac');
  ok('เข้าอีกรอบ: ไม่เด้งเพิ่ม', GOLOGIN === g0 + 1 && !!$('f_bio'));
  SESSION = null; authCb('SIGNED_OUT', null); await sleep(200);
  ok('session หายเอง (SIGNED_OUT จากที่อื่น): เด้งไปหน้าเข้าสู่ระบบของคอนโซล 1 ครั้ง · ล้างฟอร์มออกจากหน้า', GOLOGIN === g0 + 2 && !$('f_bio') && $('who').textContent === '', String(GOLOGIN));
  await signIn('maniac');
  SESSION = { user: { id: USERS.nutty.id } }; authCb('SIGNED_IN', SESSION); await sleep(250);
  ok('สลับบัญชีกลางหน้า (SIGNED_IN คนใหม่): ไม่เด้ง · เปลี่ยนเป็นของ Nutty', GOLOGIN === g0 + 2 && /Nutty/.test($('who').textContent), GOLOGIN + ' ' + $('who').textContent);

  L('=== สรุป: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  L(fail ? 'RESULT:FAIL' : 'RESULT:PASS');
}
</script>`;

const res = runPage({ root: pageRoot, file: 'teacher-profile.html', mock: MOCK, tests: TESTS, flags: ['--window-size=1280,900', '--force-prefers-reduced-motion'] });
process.exit(res.ok ? 0 : 1);
