/**
 * ฐานข้อมูลปลอมของ "คอร์สเรียน" (enrollment_overview · student_profiles · class_sessions · enrollment_extension_requests · ฟังก์ชัน my_teacher_id · migration 047)
 * วางต่อท้าย MOCK ของ desk-home3 (เหมือน WORK_MOCK) — ตัวจริงมีชุดเทสต์ SQL ของตัวเอง (console-workspace/sql-tests/test047.mjs)
 * ที่นี่จำลองเฉพาะสิ่งที่หน้าจอพึ่ง: ใครเห็นแถวไหน · my_teacher_id · view ที่ไม่มีคอลัมน์เงิน · ล้ม/ยังไม่รัน 047 · ค้างคำตอบ (สลับบัญชีกลางโหลด)
 *
 * ก้อน B เพิ่ม: courses · course_teachers · teachers · members · customers (insert) + ฟังก์ชัน teach_student_find / teach_enroll_create / teach_session_backfill / teach_payment_record (สำเนากติกาของ 047 เท่าที่หน้าจอพึ่ง)
 *   TEACH.created / sessions_bf / payments / newCust = สิ่งที่ถูกเขียน · TEACH.gateRpc = ค้างคำตอบของฟังก์ชัน · TEACH.fail.rpc_<ชื่อฟังก์ชัน> = ทำให้ฟังก์ชันนั้นล้ม
 * ตัวควบคุมจากเทสต์: TEACH.seed() ใส่ข้อมูลตั้งต้น (สัมพัทธ์กับวันนี้ เวลาไทย) · TEACH.fail = { select, rpc } · TEACH.missing (ยังไม่รัน 047)
 *   TEACH.gate = Promise ที่ค้างคำตอบของ enrollment_overview · TEACH.subs = ตัวฟัง Realtime [{ name, table, cb }] · TEACH.status = { ชื่อช่อง: ตัวฟังสถานะ }
 *   TEACH.fireRt(table) ยิง Realtime · TEACH.loads = จำนวนครั้งที่ enrollment_overview ถูกอ่าน
 * ผู้ใช้ (ล็อกอินด้วยชื่อขึ้นต้น): tibass=เจ้าของ (u1 · เป็นครู t1 ด้วย) · nui=ผู้ดูแล (u4) · zen=พนักงาน (u2 · ไม่ใช่ครู) · nutty=พนักงาน (u3 · เป็นครู t2)
 *   maniac = บัญชีครูล้วน (ไม่มีแถว admins · my_teacher_id = t3) · ghost = บัญชีที่ไม่มีแถว admins และไม่ใช่ครู
 */
export const TEACH_MOCK = `<script>
const TEACH = { rows: [], profiles: [], sessions: [], ext: [], subs: [], status: {}, fail: {}, missing: false, gate: null, loads: 0, seq: 0 };
(function () {
  FAKE.admins.push({ id: 'u4', full_name: 'Nui', role: 'admin', is_active: true });
  FAKE.customers.push(...[['c1', 'สมชาย ใจดี'], ['c2', 'มานี มีนา'], ['c3', 'วีระ ชูใจ'], ['c4', 'ปิติ สุขสันต์'], ['c5', 'ชูใจ รักเรียน'], ['c6', 'นภา ฟ้าใส'],
    ['c7', 'ดวงดาว เด็กน้อย'], ['c8', 'John Smith'], ['c9', '<img src=x onerror="window.__xss=1">ชื่อแปลก'], ['c10', 'อารี ปิดคอร์ส'], ['c11', 'จบแล้ว คนเก่ง']]
    .map(([id, full_name]) => ({ id, full_name, phone: '0800000000', line_id: null, email: null, note: null, tags: [], created_at: '2026-01-01T00:00:00Z', created_by: 'u1', admins: { full_name: 'TiBass' } })));
  const TID = { u1: 't1', u3: 't2', 'u-maniac': 't3' };           // บัญชี → ครู
  const NAME = { t1: 'Tibass', t2: 'Nutty', t3: 'Maniac', t4: 'Zlex' };
  const clone = o => JSON.parse(JSON.stringify(o));
  const E = m => ({ data: null, error: { message: m } });
  const OK = d => ({ data: d === undefined ? null : d, error: null });
  const day = n => { const d = new Date(TODAY + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const at = (n, hm) => new Date(day(n) + 'T' + hm + ':00+07:00').toISOString();
  const isTeam = id => { const a = FAKE.admins.find(x => x.id === id && x.is_active); return !!a; };

  // แถวของ view enrollment_overview (ไม่มีคอลัมน์เงินเลย) — สถานะ state คำนวณมาจากฐานแล้ว
  const R = (id, o) => Object.assign({
    id, customer_id: 'c1', course_id: 'basic-dj-class', course_title: 'Basic DJ Class', teacher_id: 't1', teacher_name: 'Tibass', teach_lang: 'th',
    track: null, equipment: null, sessions_total: 6, hours_total: '12.00', practice_hours_total: '20.0', valid_months: 3, list_price: '20000.00',
    started_on: null, expires_on: null, extended_until: null, extension_note: null, effective_expiry: null, closed_on: null, closed_reason: null,
    paid_unknown: false, source: 'console', note: null, created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    sessions_done: 0, sessions_used: 0, hours_done: '0', sessions_remaining: 6, last_session_on: null, next_session_at: null,
    paid_in_full: true, payment_count: 1, state: 'queued' }, o);
  TEACH.seed = () => {
    TEACH.fail = {}; TEACH.missing = false; TEACH.gate = null; TEACH.loads = 0;
    TEACH.rows = [
      // กำลังเรียน: เหลือ 50 วัน · 3/6
      R('e-active', { customer_id: 'c1', state: 'active', started_on: day(-40), expires_on: day(50), effective_expiry: day(50), sessions_done: 3, sessions_used: 3, sessions_remaining: 3,
        last_session_on: day(-3), next_session_at: at(2, '14:00') }),
      // ใกล้หมดอายุ 5 วัน (Nutty)
      R('e-soon', { customer_id: 'c2', teacher_id: 't2', teacher_name: 'Nutty', course_id: 'adv-scratch-class', course_title: 'Advance Scratch Class', state: 'active', started_on: day(-85), expires_on: day(5), effective_expiry: day(5),
        sessions_done: 5, sessions_used: 5, sessions_remaining: 1, payment_count: 2 }),
      // หมดอายุใน 25 วัน (อยู่ในการ์ด 30 วัน แต่ไม่แดง)
      R('e-month', { customer_id: 'c3', teacher_id: 't3', teacher_name: 'Maniac', state: 'active', started_on: day(-65), expires_on: day(25), effective_expiry: day(25), sessions_done: 2, sessions_used: 3, sessions_remaining: 3,
        next_session_at: at(5, '10:00') }),
      // รอคิว: ชำระแล้ว ยังไม่เริ่ม · ลงมา 10 วัน
      R('e-queued', { customer_id: 'c4', teacher_id: 't2', teacher_name: 'Nutty', state: 'queued', created_at: new Date(Date.now() - 10 * 86400000).toISOString() }),
      // รอชำระ: ยังไม่ครบ
      R('e-wait', { customer_id: 'c5', state: 'waiting_payment', paid_in_full: false, payment_count: 1, created_at: new Date(Date.now() - 3 * 86400000).toISOString() }),
      // หมดอายุ: เกินวัน ยังเหลือ 2 ครั้ง
      R('e-expired', { customer_id: 'c6', teacher_id: 't2', teacher_name: 'Nutty', state: 'expired', started_on: day(-100), expires_on: day(-10), effective_expiry: day(-10), sessions_done: 4, sessions_used: 4, sessions_remaining: 2 }),
      // กรอกย้อนหลัง + ชำระครบไม่ทราบวัน + ชื่อเล่น + ผู้เยาว์ + สอนอังกฤษ
      R('e-backfill', { customer_id: 'c7', teacher_id: 't2', teacher_name: 'Nutty', teach_lang: 'en', state: 'active', source: 'backfill', paid_unknown: true, payment_count: 0, started_on: day(-30), expires_on: day(60), effective_expiry: day(60),
        sessions_done: 1, sessions_used: 1, sessions_remaining: 5 }),
      // จบ: ใช้สิทธิ์ครบ (ไม่มา 1 ครั้ง นับเป็นใช้ → used 6 > done 5)
      R('e-done', { customer_id: 'c8', state: 'completed', started_on: day(-120), expires_on: day(-30), effective_expiry: day(-30), sessions_done: 5, sessions_used: 6, sessions_remaining: 0 }),
      // ปิดแล้ว: คืนเงิน
      R('e-closed', { customer_id: 'c10', state: 'closed', closed_on: day(-4), closed_reason: 'refund', paid_in_full: false, payment_count: 1 }),
      // ชื่อแปลก (XSS) ของผู้ใช้ — ต้องเป็นข้อความ
      R('e-xss', { customer_id: 'c9', course_title: '<b onmouseover=window.__xss=2>คอร์สแปลก</b>', teacher_name: '<i>ครู</i>', teacher_id: 't4', state: 'active', started_on: day(-10), expires_on: day(80), effective_expiry: day(80), sessions_done: 1, sessions_used: 1, sessions_remaining: 5 }),
    ];
    TEACH.profiles = [{ customer_id: 'c7', nickname: 'น้องดาว', is_minor: true }, { customer_id: 'c1', nickname: 'ชาย', is_minor: false }];
    TEACH.sessions = [
      { id: 's1', enrollment_id: 'e-active', teacher_id: 't1', status: 'scheduled', starts_at: at(2, '14:00'), ends_at: at(2, '16:00'), room: 'ห้องใหญ่', gcal_uid: 'uid-1' },
      { id: 's2', enrollment_id: 'e-month', teacher_id: 't3', status: 'scheduled', starts_at: at(5, '10:00'), ends_at: at(5, '12:00'), room: 'ห้องเล็ก 1', gcal_uid: null },
      { id: 's3', enrollment_id: 'e-soon', teacher_id: 't2', status: 'scheduled', starts_at: at(20, '10:00'), ends_at: at(20, '12:00'), room: null, gcal_uid: null },   // เกิน 7 วัน
    ];
    TEACH.ext = [{ id: 'x1', enrollment_id: 'e-soon', status: 'pending' }, { id: 'x2', enrollment_id: 'e-expired', status: 'pending' }];
    if (TEACH.seedB) TEACH.seedB();
  };
  TEACH.seed();

  const who = c => c.session && c.session.user.id;
  const myTid = id => TID[id] || null;
  function builder(client, table) {
    const st = { eq: [], gte: [], lte: [], order: null, limit: null, op: 'select', payload: null };
    const q = {
      select() { return q; },
      eq(c, v) { st.eq.push([c, v]); return q; }, gte(c, v) { st.gte.push([c, v]); return q; }, lte(c, v) { st.lte.push([c, v]); return q; },
      order(c, o) { st.order = { c, asc: !(o && o.ascending === false) }; return q; }, limit(n) { st.limit = n; return q; },
      insert(p) { st.op = 'insert'; st.payload = p; return q; }, update(p) { st.op = 'update'; st.payload = p; return q; }, delete() { st.op = 'delete'; return q; },
      then(res, rej) { return run().then(res, rej); },
    };
    async function run() {
      const me = who(client);
      CALLS.push({ op: st.op, table, payload: st.payload, who: me, eq: st.eq });
      if (TEACH.gate && table === 'enrollment_overview') await TEACH.gate;
      if (st.op !== 'select') return E('permission denied for table ' + table);
      if (table === 'enrollment_overview') TEACH.loads++;
      if (TEACH.fail.select && table === 'enrollment_overview') return E(TEACH.fail.select);
      if (TEACH.missing) return E('relation "public.' + table + '" does not exist');
      // RLS: ทีมงานที่ใช้งานอยู่เห็นทุกแถวของการลงเรียน/รอบเรียน/โปรไฟล์ · ครูล้วนเห็นเฉพาะของตัวเอง · คนอื่นไม่เห็นอะไร
      const team = isTeam(me), tid = myTid(me), owner = (FAKE.admins.find(a => a.id === me) || {}).role === 'owner';
      let rows;
      if (table === 'enrollment_overview') rows = TEACH.rows.filter(r => team || (tid && r.teacher_id === tid));
      else if (table === 'class_sessions') rows = TEACH.sessions.filter(s => team || (tid && s.teacher_id === tid));
      else if (table === 'student_profiles') rows = team ? TEACH.profiles : [];
      else if (table === 'enrollment_extension_requests') rows = owner ? TEACH.ext : [];
      else rows = [];
      rows = clone(rows);
      st.eq.forEach(([c, v]) => { rows = rows.filter(r => r[c] === v); });
      st.gte.forEach(([c, v]) => { rows = rows.filter(r => String(r[c]) >= String(v)); });
      st.lte.forEach(([c, v]) => { rows = rows.filter(r => String(r[c]) <= String(v)); });
      if (st.order) rows.sort((a, b) => String(a[st.order.c]).localeCompare(String(b[st.order.c])) * (st.order.asc ? 1 : -1));
      if (st.limit != null) rows = rows.slice(0, st.limit);
      return OK(rows);
    }
    return q;
  }
  const TEACH_TABLES = ['enrollment_overview', 'student_profiles', 'class_sessions', 'enrollment_extension_requests'];
  TEACH.fireRt = table => TEACH.subs.filter(s => s.table === table).forEach(s => s.cb({}));

  // ── ก้อน B: แคตตาล็อก · ทะเบียนสมาชิก · ค้นนักเรียน · ลงเรียน (สำเนากติกาของ 047 เท่าที่หน้าจอพึ่ง) ──
  TEACH.seedB = () => {
    TEACH.courses = [
      { id: 'basic-dj-class', title: 'Basic DJ Class', list_price: '20000.00', sessions_total: 6, hours_per_session: '2.00', practice_hours: '20.0', valid_months: 3, tracks: [], is_active: true },
      { id: 'adv-scratch-class', title: 'Advance Scratch Class', list_price: '20000.00', sessions_total: 6, hours_per_session: '2.00', practice_hours: null, valid_months: 3,
        tracks: [{ name: 'Scratch for Mixing', detail: '' }, { name: 'Scratch for Battle', detail: '' }], is_active: true },
      { id: 'old-course', title: 'คอร์สเลิกสอนแล้ว', list_price: '9999.00', sessions_total: 3, hours_per_session: '1.00', practice_hours: null, valid_months: 1, tracks: [], is_active: false },
    ];
    TEACH.teachers = [
      { id: 't1', display_name: 'Tibass', is_active: true }, { id: 't2', display_name: 'Nutty', is_active: true }, { id: 't3', display_name: 'Maniac', is_active: true },
      { id: 't4', display_name: 'Zlex', is_active: true }, { id: 't5', display_name: 'Leonie', is_active: true }, { id: 't6', display_name: 'Alldayz', is_active: true },
      { id: 't7', display_name: 'ครูที่ลาออก', is_active: false },
    ];
    TEACH.links = [['basic-dj-class', 't1'], ['basic-dj-class', 't2'], ['basic-dj-class', 't3'], ['basic-dj-class', 't5'], ['basic-dj-class', 't6'], ['basic-dj-class', 't7'],
      ['adv-scratch-class', 't1'], ['adv-scratch-class', 't2'], ['adv-scratch-class', 't4']].map(([course_id, teacher_id]) => ({ course_id, teacher_id }));
    // ทะเบียนสมาชิก (ข้อมูลสมมติ) — ป้าย "นักเรียน <ชื่อเล่นครู>" อยู่ที่ member_type หรือ membership (สลับช่องกันได้)
    TEACH.members = [
      { id: 'm1', full_name: 'ผู้สมัครทดสอบ หนึ่ง', phone: '081-000-0011', code: '230101', member_type: 'นักเรียน เบส', membership: 'Member' },
      { id: 'm2', full_name: 'ผู้สมัครทดสอบ สอง', phone: '0800000012', code: '230102', member_type: null, membership: 'นักเรียน หนุ่ย' },
      { id: 'm3', full_name: 'ผู้สมัครทดสอบ สาม', phone: '0800000013', code: '230103', member_type: 'นักเรียน โหน่ง', membership: 'Member' },
      { id: 'm4', full_name: 'ผู้สมัครทดสอบ สี่', phone: '0800000014', code: '230104', member_type: 'นักเรียน ครูใหม่', membership: 'Member' },
      { id: 'm5', full_name: 'สมาชิกไม่มีป้าย', phone: '0800000015', code: '230105', member_type: 'ลูกค้า SHOPEE', membership: 'Member' },
      { id: 'm6', full_name: 'ผู้สมัครที่ลงเรียนแล้ว', phone: '0800000016', code: '230106', member_type: 'นักเรียน นัตตี้', membership: 'Member' },
      { id: 'm7', full_name: '<img src=x onerror="window.__xss=3">ผู้สมัครชื่อแปลก', phone: '0800000017', code: '230107', member_type: 'นักเรียน เบส', membership: 'Member' },
    ];
    TEACH.custLinks = [{ id: 'c1', member_id: 'm6' }];       // c1 (สมชาย ใจดี) = สมาชิก m6 · มีการลงเรียนแล้ว (e-active)
    if (TEACH.baseCust == null) TEACH.baseCust = FAKE.customers.length;
    FAKE.customers.length = TEACH.baseCust;
    TEACH.gateRpc = null;
    TEACH.created = []; TEACH.sessions_bf = []; TEACH.payments = []; TEACH.newCust = [];
  };
  TEACH.seedB();
  const digits = s => String(s || '').replace(/\\D/g, '');
  const norm = s => { let d = digits(s); if (d.startsWith('0066')) d = d.slice(4); if (d.startsWith('66') && d.length >= 10) d = '0' + d.slice(2); if (d.length === 9 && '689'.includes(d[0])) d = '0' + d; return d; };
  const LOGIN = 'ต้องเข้าสู่ระบบด้วยบัญชีทีมงานที่ยังใช้งานอยู่';
  const roleOf = id => { const a = FAKE.admins.find(x => x.id === id && x.is_active); return a ? a.role : null; };
  const RPC = {
    teach_student_find(me, a) {
      if (!roleOf(me)) return E(LOGIN);
      const q = String(a.p_query || '').trim();
      if (q.length < 2) return OK([]);
      const cnt = cid => TEACH.rows.filter(r => r.customer_id === cid).length + TEACH.created.filter(x => x.customer_id === cid).length;
      const memberOf = cid => (TEACH.custLinks.find(l => l.id === cid) || {}).member_id || null;
      let out = [];
      if (digits(q).length >= 9) {
        const n = norm(q);
        const memPhones = id => TEACH.members.filter(m => m.id === id).map(m => norm(m.phone));
        FAKE.customers.forEach(c => { const mid = memberOf(c.id); if (norm(c.phone) === n || (mid && memPhones(mid).includes(n))) out.push({ customer_id: c.id, member_id: mid, full_name: c.full_name, phone: c.phone, enrollment_count: cnt(c.id), matched_by: 'phone' }); });
        TEACH.members.forEach(m => { if (norm(m.phone) === n && !TEACH.custLinks.some(l => l.member_id === m.id)) out.push({ customer_id: null, member_id: m.id, full_name: m.full_name, phone: m.phone, enrollment_count: 0, matched_by: 'member_only' }); });
      } else {
        const lq = q.toLowerCase();
        FAKE.customers.forEach(c => {
          const nick = (TEACH.profiles.find(p => p.customer_id === c.id) || {}).nickname || '';
          if (String(c.full_name).toLowerCase().includes(lq) || nick.toLowerCase().includes(lq)) out.push({ customer_id: c.id, member_id: memberOf(c.id), full_name: c.full_name, phone: c.phone, enrollment_count: cnt(c.id), matched_by: 'name' });
        });
      }
      return OK(out.slice(0, 20));
    },
    teach_enroll_create(me, a) {
      const role = roleOf(me);
      if (!role) return E(LOGIN);
      const lang = a.p_teach_lang || 'th', source = a.p_source || 'console';
      if (['console', 'backfill'].indexOf(source) < 0) return E('แหล่งที่มาของการลงเรียนไม่ถูกต้อง');
      const cust = FAKE.customers.find(c => c.id === a.p_customer);
      if (!cust) return E('ไม่พบนักเรียน (ลูกค้า) คนนี้');
      const course = TEACH.courses.find(c => c.id === a.p_course && c.is_active);
      if (!course) return E('ไม่พบคอร์สนี้ หรือคอร์สถูกปิดใช้งาน');
      const teacher = TEACH.teachers.find(t => t.id === a.p_teacher && t.is_active);
      if (!teacher || !TEACH.links.some(l => l.course_id === course.id && l.teacher_id === teacher.id)) return E('ครูคนนี้ไม่ได้เปิดสอนคอร์สนี้ หรือถูกปิดใช้งาน');
      let list = Number(course.list_price);
      if (lang === 'en') {
        if (role !== 'owner' && role !== 'admin') return E('คอร์สภาษาอังกฤษตั้งราคาตั้งได้เฉพาะเจ้าของหรือผู้ดูแล');
        if (a.p_list_price == null || a.p_list_price < 0) return E('ต้องระบุราคาตั้งของคอร์สภาษาอังกฤษ (ไม่อยู่ในไฟล์คอร์ส)');
        list = a.p_list_price;
      } else if (a.p_list_price != null) return E('ตั้งราคาตั้งเองได้เฉพาะคอร์สภาษาอังกฤษ');
      if (a.p_price_agreed == null && source !== 'backfill') return E('ต้องระบุราคาที่ตกลง');
      if (a.p_price_agreed != null && a.p_price_agreed < 0) return E('ราคาที่ตกลงต้องไม่ติดลบ');
      if (source !== 'backfill' && (a.p_started_on || a.p_paid_unknown)) return E('วันเริ่มเรียนและ "ชำระครบ (ไม่ทราบวันที่)" ใช้ได้เฉพาะการกรอกย้อนหลัง');
      if (a.p_started_on && a.p_started_on > TODAY) return E('วันเริ่มเรียนต้องไม่เกินวันนี้');
      const id = 'new-e' + (++TEACH.seq);
      const row = R(id, { customer_id: a.p_customer, course_id: course.id, course_title: course.title, teacher_id: teacher.id, teacher_name: teacher.display_name, teach_lang: lang,
        sessions_total: course.sessions_total, list_price: String(list), started_on: a.p_started_on || null, source, paid_unknown: !!a.p_paid_unknown, note: a.p_note || null,
        track: a.p_track || null, equipment: a.p_equipment || null, paid_in_full: !!a.p_paid_unknown, payment_count: 0, created_at: new Date().toISOString(),
        state: a.p_started_on ? 'active' : (a.p_paid_unknown ? 'queued' : 'waiting_payment') });
      if (a.p_started_on) { const d = new Date(a.p_started_on + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + course.valid_months); row.expires_on = row.effective_expiry = d.toISOString().slice(0, 10); }
      TEACH.rows.unshift(row);
      TEACH.created.push({ id, customer_id: a.p_customer, args: clone(a), role });
      return OK(id);
    },
    teach_session_backfill(me, a) {
      if (!roleOf(me)) return E(LOGIN);
      const e = TEACH.rows.find(r => r.id === a.p_enrollment);
      if (!e) return E('ไม่พบการลงเรียนนี้');
      if (e.source !== 'backfill') return E('ลงรอบย้อนหลังได้เฉพาะการลงเรียนที่กรอกย้อนหลัง');
      const ds = a.p_dates || [];
      if (!ds.length) return E('ต้องใส่วันที่เรียนอย่างน้อย 1 วัน');
      if (e.sessions_used + ds.length > e.sessions_total) return E('จำนวนครั้งที่เรียนรวมเกินจำนวนครั้งของคอร์ส (' + e.sessions_total + ' ครั้ง)');
      if (ds.some(d => !d || d > TODAY)) return E('วันที่เรียนต้องไม่ว่างและไม่เกินวันนี้');
      e.sessions_done += ds.length; e.sessions_used += ds.length; e.sessions_remaining = Math.max(0, e.sessions_total - e.sessions_used);
      if (!e.started_on) { e.started_on = ds.slice().sort()[0]; const d = new Date(e.started_on + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 3); e.expires_on = e.effective_expiry = d.toISOString().slice(0, 10); e.state = 'active'; }
      TEACH.sessions_bf.push({ enrollment: a.p_enrollment, dates: ds.slice() });
      return OK(ds.length);
    },
    teach_payment_record(me, a) {
      if (!roleOf(me)) return E(LOGIN);
      if (!a.p_request_id) return E('ต้องมีรหัสคำขอ (ใช้กันบันทึกซ้ำ)');
      const dup = TEACH.payments.find(p => p.request_id === a.p_request_id);
      const e = TEACH.rows.find(r => r.id === a.p_enrollment);
      if (!e) return E('ไม่พบการลงเรียนนี้');
      if (dup) return OK({ ok: true, duplicate: true, paid_in_full: e.paid_in_full, payment_count: e.payment_count });
      if (a.p_amount == null || a.p_amount <= 0) return E('ยอดชำระต้องมากกว่า 0');
      if (!a.p_paid_on || a.p_paid_on > TODAY) return E('วันที่ชำระต้องไม่ว่างและไม่เกินวันนี้');
      if (['transfer', 'cash', 'card', 'promptpay', 'other'].indexOf(a.p_method) < 0) return E('วิธีชำระไม่ถูกต้อง');
      TEACH.payments.push({ request_id: a.p_request_id, enrollment: a.p_enrollment, amount: a.p_amount, paid_on: a.p_paid_on, slip: a.p_slip_path });
      e.payment_count++; e.paid_in_full = true; if (!e.started_on) e.state = 'queued';
      return OK({ ok: true, duplicate: false, paid_in_full: true, payment_count: e.payment_count });
    },
  };
  // ตารางที่ก้อน B อ่าน/เขียน (ฐานปลอมแบบเรียบ: ไม่จำลอง RLS ละเอียด — ตัวจริงตรวจที่ test047.mjs)
  const plain = (client, table, rowsFn, onInsert) => {
    const st = { op: 'select', notCol: null, order: null };
    const q = {
      select() { return q; }, order() { return q; }, limit() { return q; }, eq() { return q; }, contains() { return q; }, or() { return q; }, ilike() { return q; },
      not(c) { st.notCol = c; return q; },
      insert(p) { st.op = 'insert'; st.payload = p; return q; },
      async single() { const r = await run(); return { data: (r.data || [])[0] || null, error: r.error }; },
      async maybeSingle() { const r = await run(); return { data: (r.data || [])[0] || null, error: r.error }; },
      then(res, rej) { return run().then(res, rej); },
    };
    async function run() {
      CALLS.push({ op: st.op, table, who: who(client), payload: st.payload ? { keys: Object.keys(st.payload) } : null });       // ไม่เก็บค่า (ชื่อ/เบอร์) ลงบันทึกเรียก
      if (TEACH.fail['from_' + table]) return E(TEACH.fail['from_' + table]);
      if (TEACH.missing) return E('relation "public.' + table + '" does not exist');
      if (st.op === 'insert') return onInsert ? onInsert(st.payload, client) : E('permission denied for table ' + table);
      return OK(clone(rowsFn(st)));
    }
    return q;
  };
  const B_TABLES = {
    courses: c => plain(c, 'courses', () => TEACH.courses),
    course_teachers: c => plain(c, 'course_teachers', () => TEACH.links),
    teachers: c => plain(c, 'teachers', () => TEACH.teachers),
    members: c => plain(c, 'members', () => TEACH.members),
    customers: c => plain(c, 'customers', st => st.notCol === 'member_id' ? TEACH.custLinks : FAKE.customers, (p, client) => {
      if (!roleOf(who(client))) return E('new row violates row-level security policy for table "customers"');
      const id = 'c-new-' + (++TEACH.seq);
      const row = { id, full_name: p.full_name, phone: p.phone || null, line_id: null, email: null, note: null, tags: [], created_at: new Date().toISOString(), created_by: p.created_by, admins: null };
      FAKE.customers.push(row);
      if (p.member_id) TEACH.custLinks.push({ id, member_id: p.member_id });
      TEACH.newCust.push({ id, member_id: p.member_id || null });
      return OK([row]);
    }),
  };
  const create = window.supabase.createClient;
  window.supabase.createClient = (u, k, o) => {
    const c = create(u, k, o), from = c.from, rpc = c.rpc, ch0 = c.channel, signIn = c.auth.signInWithPassword;
    c.from = t => TEACH_TABLES.indexOf(t) >= 0 ? builder(c, t) : (B_TABLES[t] ? B_TABLES[t](c) : from(t));
    c.rpc = async (fn, args) => {
      if (RPC[fn]) {
        CALLS.push({ op: 'rpc', fn, args: clone(args || {}), who: who(c) });
        if (TEACH.gateRpc) await TEACH.gateRpc;
        if (TEACH.fail['rpc_' + fn]) return E(TEACH.fail['rpc_' + fn]);
        if (TEACH.missing) return E('Could not find the function public.' + fn + ' in the schema cache');
        return RPC[fn](who(c), args || {});
      }
      if (fn !== 'my_teacher_id') return rpc(fn, args);
      CALLS.push({ op: 'rpc', fn, args, who: who(c) });
      if (TEACH.fail.rpc) return E(TEACH.fail.rpc);
      return OK(myTid(who(c)));
    };
    // บัญชีที่ไม่มีแถว admins: ครูล้วน (maniac) / คนทั่วไป (ghost) — ของจริงล็อกอินผ่านแต่ไม่มีสิทธิ์อะไร
    c.auth.signInWithPassword = async function (a) {
      const em = String((a && a.email) || '').toLowerCase();
      if (em.startsWith('maniac') || em.startsWith('ghost')) {
        const id = em.startsWith('maniac') ? 'u-maniac' : 'u-ghost';
        c.session = { user: { id }, access_token: 'at-' + id, refresh_token: 'rt-' + id };
        setTimeout(() => c.cbs.forEach(cb => cb('SIGNED_IN', c.session)));
        return { data: { session: c.session }, error: null };
      }
      return signIn.apply(c.auth, arguments);
    };
    c.channel = function (name) {
      const ch = ch0.apply(c, arguments), on0 = ch.on, sub0 = ch.subscribe;
      ch.on = function (ev, f, cb) { TEACH.subs.push({ name, table: f && f.table, cb }); return on0.apply(ch, arguments); };
      ch.subscribe = function (cb) { TEACH.status[name] = cb; return sub0.apply(ch, arguments); };
      return ch;
    };
    return c;
  };
})();
</script>`;
