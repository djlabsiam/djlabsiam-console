/**
 * ฐานข้อมูลปลอมของ "คอร์สเรียน" (enrollment_overview · student_profiles · class_sessions · enrollment_extension_requests · ฟังก์ชัน my_teacher_id · migration 047)
 * วางต่อท้าย MOCK ของ desk-home3 (เหมือน WORK_MOCK) — ตัวจริงมีชุดเทสต์ SQL ของตัวเอง (console-workspace/sql-tests/test047.mjs)
 * ที่นี่จำลองเฉพาะสิ่งที่หน้าจอพึ่ง: ใครเห็นแถวไหน · my_teacher_id · view ที่ไม่มีคอลัมน์เงิน · ล้ม/ยังไม่รัน 047 · ค้างคำตอบ (สลับบัญชีกลางโหลด)
 *
 * ก้อน B เพิ่ม: courses · course_teachers · teachers · members · customers (insert) + ฟังก์ชัน teach_student_find / teach_enroll_create / teach_session_backfill / teach_payment_record (สำเนากติกาของ 047 เท่าที่หน้าจอพึ่ง)
 *   TEACH.created / sessions_bf / payments / newCust = สิ่งที่ถูกเขียน · TEACH.gateRpc = ค้างคำตอบของฟังก์ชัน · TEACH.fail.rpc_<ชื่อฟังก์ชัน> = ทำให้ฟังก์ชันนั้นล้ม
 * ก้อน C เพิ่ม: enrollment_money · enrollment_payments · session_notes (RLS: เงิน = เจ้าของ/ผู้ดูแล/ครูของนักเรียน · บันทึกการสอน = เจ้าของ/ครูของรอบ · คำขอขยายอายุ = เจ้าของ/ครูผู้ขอ)
 *   + ฟังก์ชัน teach_session_schedule/done/cancel · teach_note_save · teach_payment_refund/fix · teach_enroll_fix/close/reopen · teach_extend_request/decide · teach_enroll_extend · teach_gcal_link/unlink
 *   TEACH.pay / money / notes / ext / sessions = ตารางจริงของฐานปลอม (RPC เขียนลงนี้ แล้ว recalc ตัวนับของ enrollment_overview ให้) · เทสต์ดักคำสั่งเขียนด้วย CALLS (op:'rpc')
 * P1b (หน้าครู teacher.html) เพิ่ม: rpc teach_my_students (สำเนากติกา 047: เฉพาะนักเรียนของครูผู้เรียก · ผู้เยาว์ = ผู้ปกครองแทนช่องทางของเด็ก · ไม่มีอีเมล/ที่อยู่/เงิน) ·
 *   บัญชีครูล้วนเพิ่ม alldayz (u-alldayz = ครู t6 · ไม่มีแถว admins) · class_sessions: ครูเห็นรอบที่ตัวเองสอน + รอบของนักเรียนตัวเอง · TEACH.contacts = LINE/IG ของนักเรียน (ข้อมูลสมมติ)
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
  const TID = { u1: 't1', u3: 't2', 'u-maniac': 't3', 'u-alldayz': 't6' };           // บัญชี → ครู
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
    TEACH.fail = {}; TEACH.missing = false; TEACH.noSource = false; TEACH.noCourseWrite = false; TEACH.priceWrites = []; TEACH.gate = null; TEACH.loads = 0;
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
    TEACH.profiles = [{ customer_id: 'c7', nickname: 'น้องดาว', is_minor: true, guardian_name: 'คุณแม่ของดาว', guardian_contact: 'mom-dao-line', guardian_contact_kind: 'line' },
      { customer_id: 'c1', nickname: 'ชาย', is_minor: false }];
    TEACH.contacts = { c1: { line: 'somchai.line', ig: 'somchai_ig' }, c3: { line: 'wee.line', ig: 'wee_ig' }, c7: { line: 'child-line-must-not-show', ig: 'child_ig_must_not_show' } };
    TEACH.ext = [
      { id: 'x1', enrollment_id: 'e-soon', requested_by: 't2', requested_until: day(35), reason: 'นักเรียนป่วยหลายสัปดาห์', status: 'pending', decision_note: null, approved_until: null, decided_at: null, created_at: new Date(Date.now() - 86400000).toISOString() },
      { id: 'x2', enrollment_id: 'e-expired', requested_by: 't2', requested_until: day(20), reason: 'ติดสอบ', status: 'pending', decision_note: null, approved_until: null, decided_at: null, created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
      { id: 'x0', enrollment_id: 'e-active', requested_by: 't1', requested_until: day(60), reason: 'เดินทางต่างประเทศ', status: 'approved', decision_note: 'อนุมัติครั้งเดียว', approved_until: day(55), decided_at: new Date(Date.now() - 20 * 86400000).toISOString(), created_at: new Date(Date.now() - 22 * 86400000).toISOString() },
    ];
    // ก้อน C: ยอดเงิน/รายการชำระ (ไม่อยู่ใน view enrollment_overview) · รอบเรียนเต็มคอลัมน์ · บันทึกการสอน
    TEACH.money = { 'e-active': 20000, 'e-soon': 18000, 'e-wait': 20000, 'e-queued': 20000, 'e-closed': 20000 };
    const P = (id, enrollment_id, paid_on, amount, kind, method, note) => ({ id, enrollment_id, paid_on, amount, kind, method, note: note || null, request_id: 'rq-' + id, slip_path: null, created_at: paid_on + 'T05:00:00Z' });
    TEACH.pay = [P('p1', 'e-active', day(-41), 20000, 'payment', 'transfer', 'งวดเดียว'), P('p2', 'e-soon', day(-86), 10000, 'payment', 'cash'), P('p3', 'e-soon', day(-60), 8000, 'payment', 'promptpay'),
      P('p4', 'e-wait', day(-3), 5000, 'payment', 'transfer'), P('p5', 'e-queued', day(-9), 20000, 'payment', 'transfer'), P('p6', 'e-closed', day(-30), 20000, 'payment', 'card'), P('p7', 'e-closed', day(-4), -20000, 'refund', 'other', 'คืนเต็มจำนวน')];
    const S = (id, enrollment_id, teacher_id, status, o) => Object.assign({ id, enrollment_id, teacher_id, status, starts_at: null, ends_at: null, held_on: null, hours: '2.00', room: null, cancel_by: null, notified_at: null,
      late_cancel: false, cancel_reason: null, gcal_uid: null, gcal_start: null, created_at: '2026-01-01T00:00:00Z' }, o);
    TEACH.sessions = [
      S('s-d1', 'e-active', 't1', 'done', { held_on: day(-40), starts_at: at(-40, '14:00'), ends_at: at(-40, '16:00') }),
      S('s-d2', 'e-active', 't1', 'done', { held_on: day(-20), starts_at: at(-20, '14:00'), ends_at: at(-20, '16:00') }),
      S('s-d3', 'e-active', 't1', 'done', { held_on: day(-3), starts_at: at(-3, '14:00'), ends_at: at(-3, '16:00') }),
      S('s1', 'e-active', 't1', 'scheduled', { starts_at: at(2, '14:00'), ends_at: at(2, '16:00'), room: 'ห้องใหญ่', gcal_uid: 'uid-1', gcal_start: at(2, '14:00') }),
      S('s-m1', 'e-month', 't3', 'done', { held_on: day(-60), starts_at: at(-60, '10:00'), ends_at: at(-60, '12:00') }),
      S('s-m2', 'e-month', 't3', 'done', { held_on: day(-30), starts_at: at(-30, '10:00'), ends_at: at(-30, '12:00') }),
      S('s-m3', 'e-month', 't3', 'no_show', { starts_at: at(-15, '10:00'), ends_at: at(-15, '12:00'), cancel_by: 'student' }),
      S('s2', 'e-month', 't3', 'scheduled', { starts_at: at(5, '10:00'), ends_at: at(5, '12:00'), room: 'ห้องเล็ก 1' }),
      S('s-over', 'e-month', 't3', 'scheduled', { starts_at: at(-1, '10:00'), ends_at: at(-1, '12:00') }),
      S('s3', 'e-soon', 't2', 'scheduled', { starts_at: at(20, '10:00'), ends_at: at(20, '12:00') }),
      S('s-x1', 'e-done', 't1', 'cancelled', { starts_at: at(-50, '10:00'), ends_at: at(-50, '12:00'), cancel_by: 'student', late_cancel: true, cancel_reason: 'ป่วยกะทันหัน', notified_at: at(-50, '08:00') }),
      S('s-x2', 'e-done', 't1', 'cancelled', { starts_at: at(-40, '10:00'), ends_at: at(-40, '12:00'), cancel_by: 'teacher', cancel_reason: 'ครูติดธุระ' }),
      S('s-x3', 'e-closed', 't1', 'cancelled', { starts_at: at(-3, '10:00'), ends_at: at(-3, '12:00'), cancel_by: 'shop', cancel_reason: 'ปิดคอร์ส' }),
    ];
    TEACH.notes = [{ session_id: 's-d3', note: 'ฝึกสแครชเบสิกครั้งที่ 3 — ต้องซ้อมจังหวะเพิ่ม', written_by: 'u1' }, { session_id: 's-m2', note: 'บันทึกของครู Maniac เห็นเฉพาะเจ้าของและ Maniac', written_by: 'u-maniac' }];
    if (TEACH.seedB) TEACH.seedB();
  };
  TEACH.seed();

  const who = c => c.session && c.session.user.id;
  const myTid = id => TID[id] || null;
  function builder(client, table) {
    const st = { eq: [], gte: [], lte: [], inn: [], order: null, limit: null, op: 'select', payload: null, cols: '' };
    const q = {
      select(c) { st.cols = c || ''; return q; }, in(c, v) { st.inn.push([c, v]); return q; },
      eq(c, v) { st.eq.push([c, v]); return q; }, gte(c, v) { st.gte.push([c, v]); return q; }, lte(c, v) { st.lte.push([c, v]); return q; },
      order(c, o) { st.order = { c, asc: !(o && o.ascending === false) }; return q; }, limit(n) { st.limit = n; return q; },
      insert(p) { st.op = 'insert'; st.payload = p; return q; }, update(p) { st.op = 'update'; st.payload = p; return q; }, delete() { st.op = 'delete'; return q; },
      then(res, rej) { return run().then(res, rej); },
    };
    async function run() {
      const me = who(client);
      CALLS.push({ op: st.op, table, payload: st.payload, who: me, eq: st.eq, cols: st.cols });
      const snapSess = table === 'class_sessions' ? clone(TEACH.sessions) : null;      // ข้อมูล ณ ตอนส่งคำขอ (ไม่ใช่ตอนตอบ)
      if (TEACH.gate && table === 'enrollment_overview') await TEACH.gate;
      if (TEACH.gateSess && table === 'class_sessions') await TEACH.gateSess;
      if (st.op !== 'select') return E('permission denied for table ' + table);
      if (table === 'enrollment_overview') TEACH.loads++;
      if (TEACH.fail.select && table === 'enrollment_overview') return E(TEACH.fail.select);
      if (TEACH.fail.detail_sessions && table === 'class_sessions' && st.eq.some(([c]) => c === 'enrollment_id')) return E(TEACH.fail.detail_sessions);   // ล้มเฉพาะตอนโหลดรอบของแผงรายละเอียด
      if (TEACH.missing) return E('relation "public.' + table + '" does not exist');
      // RLS: ทีมงานที่ใช้งานอยู่เห็นทุกแถวของการลงเรียน/รอบเรียน/โปรไฟล์ · ครูล้วนเห็นเฉพาะของตัวเอง · คนอื่นไม่เห็นอะไร
      const team = isTeam(me), tid = myTid(me), owner = (FAKE.admins.find(a => a.id === me) || {}).role === 'owner';
      let rows;
      if (table === 'enrollment_overview') rows = TEACH.rows.filter(r => team || (tid && r.teacher_id === tid));
      else if (table === 'class_sessions') rows = (snapSess || TEACH.sessions).filter(s => team || (tid && (s.teacher_id === tid || (TEACH.rows.find(r => r.id === s.enrollment_id) || {}).teacher_id === tid)));
      else if (table === 'student_profiles') rows = team ? TEACH.profiles : [];
      else if (table === 'enrollment_extension_requests') rows = owner ? TEACH.ext : TEACH.ext.filter(x => tid && x.requested_by === tid);
      else if (table === 'enrollment_money' || table === 'enrollment_payments') {
        const role = (FAKE.admins.find(a => a.id === me && a.is_active) || {}).role;
        const visible = en => role === 'owner' || role === 'admin' || (tid && (TEACH.rows.find(r => r.id === en) || {}).teacher_id === tid);
        rows = table === 'enrollment_money' ? Object.keys(TEACH.money).filter(visible).map(en => ({ enrollment_id: en, price_agreed: TEACH.money[en] })) : TEACH.pay.filter(p => visible(p.enrollment_id));
      } else if (table === 'session_notes') {
        rows = TEACH.notes.filter(n => { const ss = TEACH.sessions.find(x => x.id === n.session_id), e = ss && TEACH.rows.find(r => r.id === ss.enrollment_id); return owner || (tid && ss && (ss.teacher_id === tid || (e && e.teacher_id === tid))); });
      } else rows = [];
      rows = clone(rows);
      st.eq.forEach(([c, v]) => { rows = rows.filter(r => r[c] === v); });
      st.inn.forEach(([c, v]) => { rows = rows.filter(r => v.indexOf(r[c]) >= 0); });
      st.gte.forEach(([c, v]) => { rows = rows.filter(r => String(r[c]) >= String(v)); });
      st.lte.forEach(([c, v]) => { rows = rows.filter(r => String(r[c]) <= String(v)); });
      if (st.order) rows.sort((a, b) => String(a[st.order.c]).localeCompare(String(b[st.order.c])) * (st.order.asc ? 1 : -1));
      if (st.limit != null) rows = rows.slice(0, st.limit);
      return OK(rows);
    }
    return q;
  }
  const TEACH_TABLES = ['enrollment_overview', 'student_profiles', 'class_sessions', 'enrollment_extension_requests', 'enrollment_money', 'enrollment_payments', 'session_notes'];
  TEACH.fireRt = table => TEACH.subs.filter(s => s.table === table).forEach(s => s.cb({}));

  // ── ก้อน B: แคตตาล็อก · ทะเบียนสมาชิก · ค้นนักเรียน · ลงเรียน (สำเนากติกาของ 047 เท่าที่หน้าจอพึ่ง) ──
  TEACH.seedB = () => {
    TEACH.courses = [
      { id: 'basic-dj-class', title: 'Basic DJ Class', list_price: '20000.00', source_price: '20000.00', sessions_total: 6, hours_per_session: '2.00', practice_hours: '20.0', valid_months: 3, tracks: [], is_active: true },
      { id: 'adv-scratch-class', title: 'Advance Scratch Class', list_price: '20000.00', source_price: '20000.00', sessions_total: 6, hours_per_session: '2.00', practice_hours: null, valid_months: 3,
        tracks: [{ name: 'Scratch for Mixing', detail: '' }, { name: 'Scratch for Battle', detail: '' }], is_active: true },
      { id: 'old-course', title: 'คอร์สเลิกสอนแล้ว', list_price: '9999.00', source_price: '9999.00', sessions_total: 3, hours_per_session: '1.00', practice_hours: null, valid_months: 1, tracks: [], is_active: false },
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
      // 060: ครูล้วน (ไม่มีแถว admins) ค้นได้ด้วยเบอร์เต็มเท่านั้น → ชื่อ + เบอร์ปิดเหลือ 4 ตัวท้าย · ไม่คืน member_id/จำนวนลงเรียน
      const team = !!roleOf(me);
      if (!team && !myTid(me)) return E('ต้องเข้าสู่ระบบด้วยบัญชีทีมงานหรืออาจารย์ที่ยังใช้งานอยู่');
      const q = String(a.p_query || '').trim();
      if (q.length < 2) return OK([]);
      const cnt = cid => TEACH.rows.filter(r => r.customer_id === cid).length + TEACH.created.filter(x => x.customer_id === cid).length;
      const memberOf = cid => (TEACH.custLinks.find(l => l.id === cid) || {}).member_id || null;
      let out = [];
      if (!team) {
        if (digits(q).length < 9 || !/^[0-9+()\\-. ]+$/.test(q)) return OK([]);
        const n = norm(q), mask = p => '******' + digits(p).slice(-4);
        const memPhones = id => TEACH.members.filter(m => m.id === id).map(m => norm(m.phone));
        FAKE.customers.forEach(c => { const mid = memberOf(c.id); if (norm(c.phone) === n || (mid && memPhones(mid).includes(n))) out.push({ customer_id: c.id, member_id: null, full_name: c.full_name, phone: mask(c.phone), enrollment_count: null, matched_by: 'phone' }); });
        TEACH.members.forEach(m => { if (norm(m.phone) === n && !TEACH.custLinks.some(l => l.member_id === m.id)) out.push({ customer_id: null, member_id: null, full_name: m.full_name, phone: mask(m.phone), enrollment_count: null, matched_by: 'member_only' }); });
        return OK(out.slice(0, 20));
      }
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
      // 060: เจ้าของ/ผู้ดูแล = เดิม · พนักงาน = ราคาที่ตกลงต้องเท่าราคาตั้ง + ไม่มีย้อนหลัง · ครูล้วน = ครูเป็นตัวเอง · ราคาบังคับ = ราคาตั้ง
      const role = roleOf(me), tid = myTid(me), priv = role === 'owner' || role === 'admin', tonly = !role && !!tid;
      if (!role && !tid) return E('ต้องเข้าสู่ระบบด้วยบัญชีทีมงานหรืออาจารย์ที่ยังใช้งานอยู่');
      const lang = a.p_teach_lang || 'th', source = a.p_source || 'console';
      if (['console', 'backfill'].indexOf(source) < 0) return E('แหล่งที่มาของการลงเรียนไม่ถูกต้อง');
      if (source === 'backfill' && !priv) return E('กรอกย้อนหลังได้เฉพาะเจ้าของหรือผู้ดูแล');
      if (tonly && a.p_teacher !== tid) return E('อาจารย์ลงเรียนได้เฉพาะให้ตัวเองเป็นครู');
      const cust = FAKE.customers.find(c => c.id === a.p_customer);
      if (!cust) return E('ไม่พบนักเรียน (ลูกค้า) คนนี้');
      const course = TEACH.courses.find(c => c.id === a.p_course && c.is_active);
      if (!course) return E('ไม่พบคอร์สนี้ หรือคอร์สถูกปิดใช้งาน');
      const teacher = TEACH.teachers.find(t => t.id === a.p_teacher && t.is_active);
      if (!teacher || !TEACH.links.some(l => l.course_id === course.id && l.teacher_id === teacher.id)) return E('ครูคนนี้ไม่ได้เปิดสอนคอร์สนี้ หรือถูกปิดใช้งาน');
      let list = Number(course.list_price);
      if (lang === 'en') {
        if (!priv) return E('คอร์สภาษาอังกฤษตั้งราคาตั้งได้เฉพาะเจ้าของหรือผู้ดูแล');
        if (a.p_list_price == null || a.p_list_price < 0) return E('ต้องระบุราคาตั้งของคอร์สภาษาอังกฤษ (ไม่อยู่ในไฟล์คอร์ส)');
        list = a.p_list_price;
      } else if (a.p_list_price != null) return E('ตั้งราคาตั้งเองได้เฉพาะคอร์สภาษาอังกฤษ');
      let agreed = a.p_price_agreed;
      if (tonly) agreed = list;
      else if (!priv && agreed != null && agreed !== list) return E('ราคาแก้ได้เฉพาะเจ้าของหรือผู้ดูแล');
      if (agreed == null && source !== 'backfill') return E('ต้องระบุราคาที่ตกลง');
      if (agreed != null && agreed < 0) return E('ราคาที่ตกลงต้องไม่ติดลบ');
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
      if (!isMgr(roleOf(me))) return E('ลงรอบย้อนหลังได้เฉพาะเจ้าของหรือผู้ดูแล');
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
      if (!isMgr(roleOf(me))) return E('บันทึกชำระได้เฉพาะเจ้าของหรือผู้ดูแล');
      if (!a.p_request_id) return E('ต้องมีรหัสคำขอ (ใช้กันบันทึกซ้ำ)');
      const dup = TEACH.payments.find(p => p.request_id === a.p_request_id);
      const e = TEACH.rows.find(r => r.id === a.p_enrollment);
      if (!e) return E('ไม่พบการลงเรียนนี้');
      if (dup) return OK({ ok: true, duplicate: true, paid_in_full: e.paid_in_full, payment_count: e.payment_count });
      if (a.p_amount == null || a.p_amount <= 0) return E('ยอดชำระต้องมากกว่า 0');
      if (!a.p_paid_on || a.p_paid_on > TODAY) return E('วันที่ชำระต้องไม่ว่างและไม่เกินวันนี้');
      if (['transfer', 'cash', 'card', 'promptpay', 'other'].indexOf(a.p_method) < 0) return E('วิธีชำระไม่ถูกต้อง');
      TEACH.payments.push({ request_id: a.p_request_id, enrollment: a.p_enrollment, amount: a.p_amount, paid_on: a.p_paid_on, slip: a.p_slip_path });
      TEACH.pay.push({ id: 'np' + (++TEACH.seq), enrollment_id: e.id, paid_on: a.p_paid_on, amount: a.p_amount, kind: 'payment', method: a.p_method, note: a.p_note || null, request_id: a.p_request_id, slip_path: a.p_slip_path || null, created_at: new Date().toISOString() });
      if (e.closed_on) return E('การลงเรียนนี้ปิดแล้ว บันทึกชำระเพิ่มไม่ได้');
      recalc(e);
      return OK({ ok: true, duplicate: false, paid_in_full: e.paid_in_full, payment_count: e.payment_count });
    },
  };
  // ── P1b ──
  Object.assign(RPC, {
    teach_my_students(me) {
      const t = myTid(me);
      if (!t) return OK([]);
      return OK(TEACH.rows.filter(r => r.teacher_id === t).map(r => {
        const c = FAKE.customers.find(x => x.id === r.customer_id) || {}, p = TEACH.profiles.find(x => x.customer_id === r.customer_id) || {}, k = (TEACH.contacts || {})[r.customer_id] || {};
        const minor = !!p.is_minor;
        return { enrollment_id: r.id, customer_id: r.customer_id, student_name: c.full_name, nickname: p.nickname || null, is_minor: minor,
          contact_line: minor ? null : (k.line || null), contact_ig: minor ? null : (k.ig || null), contact_phone: minor ? null : (c.phone || null),
          guardian_name: minor ? (p.guardian_name || null) : null, guardian_contact: minor ? (p.guardian_contact || null) : null, guardian_contact_kind: minor ? (p.guardian_contact_kind || null) : null,
          course_title: r.course_title, teach_lang: r.teach_lang, state: r.state, sessions_total: r.sessions_total, sessions_used: r.sessions_used, sessions_done: r.sessions_done,
          sessions_remaining: r.sessions_remaining, started_on: r.started_on, effective_expiry: r.effective_expiry, next_session_at: r.next_session_at };
      }));
    },
  });
  // ── ก้อน C ──
  function recalc(e) {
    const ss = TEACH.sessions.filter(x => x.enrollment_id === e.id), ps = TEACH.pay.filter(p => p.enrollment_id === e.id);
    const used = x => x.status === 'done' || x.status === 'no_show' || (x.status === 'cancelled' && x.late_cancel);
    const doneRows = ss.filter(x => x.status === 'done');
    if (ss.length || e.__touchedSess) {
      e.sessions_done = doneRows.length; e.sessions_used = ss.filter(used).length;
      e.hours_done = String(doneRows.reduce((a, x) => a + Number(x.hours), 0)); e.sessions_remaining = Math.max(0, e.sessions_total - e.sessions_used);
      const sc = ss.filter(x => x.status === 'scheduled' && Date.parse(x.starts_at) >= Date.now()).map(x => x.starts_at).sort();
      e.next_session_at = sc[0] || null;
      e.last_session_on = doneRows.map(x => x.held_on).sort().pop() || null;
      if (!e.started_on && doneRows.length) { e.started_on = doneRows.map(x => x.held_on).sort()[0]; const d = new Date(e.started_on + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + e.valid_months); e.expires_on = d.toISOString().slice(0, 10); }
    }
    e.effective_expiry = e.extended_until || e.expires_on || null;
    if (ps.length) {
      e.payment_count = ps.filter(p => p.kind === 'payment').length;
      const price = TEACH.money[e.id], net = ps.reduce((a, p) => a + Number(p.amount), 0);
      e.paid_in_full = !!e.paid_unknown || (price != null ? net >= price : true);
    } else if (e.paid_unknown) e.paid_in_full = true;
    e.state = e.closed_on ? 'closed' : e.sessions_used >= e.sessions_total ? 'completed' : !e.started_on && e.paid_in_full ? 'queued' : !e.started_on ? 'waiting_payment'
      : TODAY <= e.effective_expiry ? 'active' : 'expired';
  }
  TEACH.recalc = recalc;
  const isMgr = r => r === 'owner' || r === 'admin';
  const enr = id => TEACH.rows.find(r => r.id === id);
  const mySess = (me, s) => { const e = enr(s.enrollment_id), t = myTid(me); return !!t && (s.teacher_id === t || (e && e.teacher_id === t)); };
  const bkkYmd = iso => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const dayDiff = (a, b) => Math.round((Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) - Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10))) / 86400000);
  const addMonths = (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
  Object.assign(RPC, {
    teach_session_schedule(me, a) {
      const role = roleOf(me), e = enr(a.p_enrollment), t = myTid(me);
      if (!role && !(e && t && e.teacher_id === t)) return E('นัดรอบเรียนได้เฉพาะทีมงานหรือครูของนักเรียนคนนี้');
      if (!e) return E('ไม่พบการลงเรียนนี้');
      if (e.closed_on) return E('การลงเรียนนี้ปิดแล้ว นัดรอบใหม่ไม่ได้');
      // 060: ต้องชำระครบก่อน (ทุกตำแหน่ง) · ยกเว้นใบย้อนหลังที่ไม่มีราคาที่ตกลง (ตัดสินไม่ได้)
      if (!e.paid_in_full && !(e.source === 'backfill' && TEACH.money[e.id] == null)) return E('ยังไม่ชำระครบ — นัดรอบเรียนได้หลังเจ้าของหรือผู้ดูแลบันทึกชำระครบแล้ว');
      if (!TEACH.teachers.some(x => x.id === a.p_teacher && x.is_active)) return E('ครูไม่ถูกต้องหรือถูกปิดใช้งาน');
      if (!a.p_starts || !a.p_ends || Date.parse(a.p_ends) <= Date.parse(a.p_starts)) return E('เวลาเริ่ม/จบไม่ถูกต้อง (เวลาจบต้องหลังเวลาเริ่ม)');
      const hours = a.p_hours != null ? a.p_hours : Math.round(Number(e.hours_total) / e.sessions_total * 100) / 100;
      if (hours <= 0 || hours > 12) return E('ชั่วโมงต่อครั้งต้องมากกว่า 0 และไม่เกิน 12');
      const ss = TEACH.sessions.filter(x => x.enrollment_id === e.id);
      const used = ss.filter(x => x.status === 'done' || x.status === 'no_show' || (x.status === 'cancelled' && x.late_cancel)).length, sched = ss.filter(x => x.status === 'scheduled').length;
      const warnings = [];
      if (used + sched >= e.sessions_total) warnings.push('over_sessions');
      const exp = e.extended_until || e.expires_on;
      if (exp && bkkYmd(a.p_starts) > exp) warnings.push('after_expiry');
      const s0 = Date.parse(a.p_starts), e0 = Date.parse(a.p_ends);
      if (TEACH.sessions.some(x => x.teacher_id === a.p_teacher && x.status === 'scheduled' && Date.parse(x.starts_at) < e0 && Date.parse(x.ends_at) > s0)) return E('ครูคนนี้มีนัดซ้อนกันในช่วงเวลานี้');
      const id = 'ns' + (++TEACH.seq);
      TEACH.sessions.push({ id, enrollment_id: e.id, teacher_id: a.p_teacher, status: 'scheduled', starts_at: a.p_starts, ends_at: a.p_ends, held_on: null, hours: String(hours), room: a.p_room || null, cancel_by: null,
        notified_at: null, late_cancel: false, cancel_reason: null, gcal_uid: null, gcal_start: null, created_at: new Date().toISOString() });
      e.__touchedSess = true; recalc(e);
      return OK({ id, warnings });
    },
    teach_session_done(me, a) {
      const s = TEACH.sessions.find(x => x.id === a.p_session);
      if (!s) return E('ไม่พบรอบเรียนนี้');
      if (!isMgr(roleOf(me)) && !mySess(me, s)) return E('ทำเครื่องหมายสอนแล้วได้เฉพาะครูของรอบนี้ เจ้าของ หรือผู้ดูแล');
      if (s.status !== 'scheduled') return E('รอบนี้ไม่ได้อยู่ในสถานะนัดไว้ (ตอนนี้: ' + s.status + ')');
      if (!a.p_held_on || a.p_held_on > TODAY) return E('วันที่สอนต้องไม่ว่างและไม่เกินวันนี้');
      if (a.p_hours != null && (a.p_hours <= 0 || a.p_hours > 12)) return E('ชั่วโมงต้องมากกว่า 0 และไม่เกิน 12');
      s.status = 'done'; s.held_on = a.p_held_on; if (a.p_hours != null) s.hours = String(a.p_hours);
      const e = enr(s.enrollment_id); e.__touchedSess = true; recalc(e);
      return OK({ ok: true, started_on: e.started_on });
    },
    teach_session_cancel(me, a) {
      const s = TEACH.sessions.find(x => x.id === a.p_session);
      if (!s) return E('ไม่พบรอบเรียนนี้');
      if (!roleOf(me) && !mySess(me, s)) return E('ยกเลิกรอบได้เฉพาะทีมงานหรือครูของรอบนี้');
      if (s.status !== 'scheduled') return E('รอบนี้ไม่ได้อยู่ในสถานะนัดไว้ (ตอนนี้: ' + s.status + ')');
      if (['cancelled', 'no_show'].indexOf(a.p_as) < 0) return E('ต้องเป็น cancelled หรือ no_show');
      let by = 'student', notified = null, late = false;
      if (a.p_as === 'cancelled') {
        by = a.p_by;
        if (['student', 'teacher', 'shop'].indexOf(by) < 0) return E('ต้องระบุว่าใครยกเลิก (student / teacher / shop)');
        if (by === 'student') { notified = a.p_notified_at || new Date().toISOString(); late = dayDiff(bkkYmd(s.starts_at), a.p_notified_at ? bkkYmd(a.p_notified_at) : TODAY) < 3; }
      }
      s.status = a.p_as; s.cancel_by = by; s.notified_at = notified; s.late_cancel = late; s.cancel_reason = a.p_reason || null;
      const e = enr(s.enrollment_id); e.__touchedSess = true; recalc(e);
      return OK({ ok: true, late_cancel: late, counted: a.p_as === 'no_show' || late });
    },
    teach_note_save(me, a) {
      const s = TEACH.sessions.find(x => x.id === a.p_session);
      if (!s) return E('ไม่พบรอบเรียนนี้');
      if (roleOf(me) !== 'owner' && !mySess(me, s)) return E('บันทึกการสอนได้เฉพาะเจ้าของหรือครูของนักเรียนคนนี้');
      TEACH.notes = TEACH.notes.filter(n => n.session_id !== s.id);
      if (!String(a.p_note || '').trim()) return OK(false);
      TEACH.notes.push({ session_id: s.id, note: a.p_note, written_by: me });
      return OK(true);
    },
    teach_payment_refund(me, a) {
      if (!isMgr(roleOf(me))) return E('คืนเงินได้เฉพาะเจ้าของหรือผู้ดูแล');
      if (!a.p_request_id) return E('ต้องมีรหัสคำขอ (ใช้กันบันทึกซ้ำ)');
      const e = enr(a.p_enrollment);
      if (!e) return E('ไม่พบการลงเรียนนี้');
      if (TEACH.pay.some(p => p.request_id === a.p_request_id)) return OK({ ok: true, duplicate: true });
      if (a.p_amount == null || a.p_amount <= 0) return E('ยอดคืนต้องมากกว่า 0 (ใส่เป็นบวก)');
      if (!a.p_paid_on || a.p_paid_on > TODAY) return E('วันที่คืนเงินต้องไม่ว่างและไม่เกินวันนี้');
      const net = TEACH.pay.filter(p => p.enrollment_id === e.id).reduce((x, p) => x + Number(p.amount), 0);
      if (a.p_amount > net) return E('ยอดคืนเกินยอดที่ชำระสะสม');
      TEACH.pay.push({ id: 'nr' + (++TEACH.seq), enrollment_id: e.id, paid_on: a.p_paid_on, amount: -a.p_amount, kind: 'refund', method: 'other', note: a.p_note || null, request_id: a.p_request_id, slip_path: null, created_at: new Date().toISOString() });
      recalc(e);
      return OK({ ok: true, duplicate: false });
    },
    teach_payment_fix(me, a) {
      if (!isMgr(roleOf(me))) return E('แก้ยอดชำระได้เฉพาะเจ้าของหรือผู้ดูแล');
      const p = TEACH.pay.find(x => x.id === a.p_payment);
      if (!p) return E('ไม่พบรายการชำระนี้');
      const e = enr(p.enrollment_id);
      if (a.p_delete) { TEACH.pay = TEACH.pay.filter(x => x !== p); recalc(e); return OK({ ok: true, deleted: true, slip_path: p.slip_path }); }
      if (a.p_amount != null && a.p_amount <= 0) return E('ยอดต้องมากกว่า 0 (ใส่เป็นบวก — ระบบใส่เครื่องหมายตามชนิดรายการ)');
      if (a.p_paid_on != null && a.p_paid_on > TODAY) return E('วันที่ต้องไม่เกินวันนี้');
      if (a.p_method != null && ['transfer', 'cash', 'card', 'promptpay', 'other'].indexOf(a.p_method) < 0) return E('วิธีชำระไม่ถูกต้อง');
      if (a.p_paid_on != null) p.paid_on = a.p_paid_on;
      if (a.p_amount != null) p.amount = p.kind === 'refund' ? -a.p_amount : a.p_amount;
      if (a.p_method != null) p.method = a.p_method;
      if (a.p_note != null) p.note = String(a.p_note).trim() || null;
      recalc(e);
      return OK({ ok: true, deleted: false });
    },
    teach_enroll_fix(me, a) {
      const role = roleOf(me), e = enr(a.p_id), p = a.p_patch;
      if (!isMgr(role)) return E('แก้การลงเรียนได้เฉพาะเจ้าของหรือผู้ดูแล');
      if (!p || typeof p !== 'object' || !Object.keys(p).length) return E('ไม่มีช่องที่จะแก้');
      const bad = Object.keys(p).find(k => ['teacher_id', 'started_on', 'track', 'equipment', 'note', 'paid_unknown', 'price_agreed'].indexOf(k) < 0);
      if (bad) return E('แก้ช่อง "' + bad + '" ไม่ได้ (แก้ได้: teacher_id started_on track equipment note paid_unknown price_agreed)');
      if (!e) return E('ไม่พบการลงเรียนนี้');
      if (e.closed_on && role !== 'owner') return E('การลงเรียนนี้ปิดแล้ว แก้ได้เฉพาะเจ้าของ');
      if ('teacher_id' in p) {
        if (!TEACH.links.some(l => l.course_id === e.course_id && l.teacher_id === p.teacher_id) || !TEACH.teachers.some(t => t.id === p.teacher_id && t.is_active)) return E('ครูคนนี้ไม่ได้เปิดสอนคอร์สนี้ หรือถูกปิดใช้งาน');
      }
      if ('started_on' in p && p.started_on === null && TEACH.sessions.some(x => x.enrollment_id === e.id && x.status === 'done')) return E('ล้างวันเริ่มเรียนไม่ได้ เพราะมีรอบที่สอนแล้ว (แก้เป็นวันอื่นแทน)');
      if ('started_on' in p && p.started_on && p.started_on > TODAY) return E('วันเริ่มเรียนต้องไม่เกินวันนี้');
      if ('paid_unknown' in p && p.paid_unknown && e.source !== 'backfill') return E('"ชำระครบ (ไม่ทราบวันที่)" ใช้ได้เฉพาะการลงเรียนที่กรอกย้อนหลัง');
      if ('price_agreed' in p && p.price_agreed === null && e.source !== 'backfill') return E('ต้องมีราคาที่ตกลง (ล้างเป็นว่างได้เฉพาะการลงเรียนที่กรอกย้อนหลัง)');
      if ('teacher_id' in p) { e.teacher_id = p.teacher_id; e.teacher_name = (TEACH.teachers.find(t => t.id === p.teacher_id) || {}).display_name; }
      if ('started_on' in p) { e.started_on = p.started_on; e.expires_on = p.started_on ? addMonths(p.started_on, e.valid_months) : null; }
      if ('track' in p) e.track = p.track; if ('equipment' in p) e.equipment = p.equipment; if ('note' in p) e.note = p.note;
      if ('paid_unknown' in p) e.paid_unknown = p.paid_unknown;
      if ('price_agreed' in p) { if (p.price_agreed === null) delete TEACH.money[e.id]; else TEACH.money[e.id] = p.price_agreed; }
      recalc(e);
      return OK({ ok: true, changed: Object.keys(p).sort() });
    },
    teach_enroll_close(me, a) {
      if (!isMgr(roleOf(me))) return E('ปิดคอร์สได้เฉพาะเจ้าของหรือผู้ดูแล');
      if (['refund', 'quit', 'transfer', 'cancelled'].indexOf(a.p_reason) < 0) return E('เหตุผลการปิดต้องเป็น refund / quit / transfer / cancelled');
      const on = a.p_closed_on || TODAY;
      if (on > TODAY) return E('วันที่ปิดต้องไม่เกินวันนี้');
      const e = enr(a.p_id);
      if (!e) return E('ไม่พบการลงเรียนนี้');
      if (e.closed_on) return E('การลงเรียนนี้ปิดไปแล้ว');
      e.closed_on = on; e.closed_reason = a.p_reason;
      TEACH.sessions.filter(x => x.enrollment_id === e.id && x.status === 'scheduled').forEach(x => { x.status = 'cancelled'; x.cancel_by = 'shop'; x.late_cancel = false; x.cancel_reason = 'ปิดคอร์ส'; });
      e.__touchedSess = true; recalc(e);
      return OK(true);
    },
    teach_enroll_reopen(me, a) {
      if (roleOf(me) !== 'owner') return E('เปิดคอร์สที่ปิดแล้วได้เฉพาะเจ้าของ');
      const e = enr(a.p_id);
      if (!e) return E('ไม่พบการลงเรียนนี้');
      if (!e.closed_on) return E('การลงเรียนนี้ยังไม่ได้ปิด');
      e.closed_on = null; e.closed_reason = null; recalc(e);
      return OK({ ok: true, auto_cancelled_sessions: TEACH.sessions.filter(x => x.enrollment_id === e.id && x.status === 'cancelled' && x.cancel_by === 'shop' && x.cancel_reason === 'ปิดคอร์ส').length });
    },
    teach_extend_request(me, a) {
      const t = myTid(me), e = enr(a.p_enrollment);
      if (!t || !e || e.teacher_id !== t) return E('ยื่นขอขยายอายุได้เฉพาะครูของนักเรียนคนนี้');
      if (e.closed_on) return E('การลงเรียนนี้ปิดแล้ว ขอขยายอายุไม่ได้');
      if (!e.expires_on) return E('ยังไม่มีวันหมดอายุ (ยังไม่เริ่มเรียน) ขอขยายอายุไม่ได้');
      if (!a.p_until || a.p_until <= (e.extended_until || e.expires_on)) return E('วันที่ขอต้องเกินวันหมดอายุปัจจุบัน');
      if (!String(a.p_reason || '').trim() || a.p_reason.length > 500) return E('ต้องใส่เหตุผล (ไม่เกิน 500 ตัวอักษร)');
      if (TEACH.ext.some(x => x.enrollment_id === e.id && x.status === 'pending')) return E('มีคำขอรอตัดสินอยู่แล้ว');
      const id = 'nx' + (++TEACH.seq);
      TEACH.ext.push({ id, enrollment_id: e.id, requested_by: t, requested_until: a.p_until, reason: a.p_reason.trim(), status: 'pending', decision_note: null, approved_until: null, decided_at: null, created_at: new Date().toISOString() });
      return OK(id);
    },
    teach_extend_decide(me, a) {
      if (roleOf(me) !== 'owner') return E('ตัดสินคำขอขยายอายุได้เฉพาะเจ้าของ');
      const r = TEACH.ext.find(x => x.id === a.p_request);
      if (!r) return E('ไม่พบคำขอนี้');
      if (r.status !== 'pending') return E('คำขอนี้ตัดสินไปแล้ว');
      if (a.p_approve) {
        const e = enr(r.enrollment_id), until = a.p_until || r.requested_until;
        if (e.closed_on) return E('การลงเรียนนี้ปิดแล้ว');
        if (!e.expires_on || until <= (e.extended_until || e.expires_on)) return E('วันที่อนุมัติต้องเกินวันหมดอายุปัจจุบัน');
        e.extended_until = until; e.extension_note = 'ขยายอายุ (เจ้าของอนุมัติ)'; recalc(e);
        Object.assign(r, { status: 'approved', decided_at: new Date().toISOString(), decision_note: a.p_note || null, approved_until: until });
        return OK({ ok: true, approved_until: until });
      }
      Object.assign(r, { status: 'rejected', decided_at: new Date().toISOString(), decision_note: a.p_note || null });
      return OK({ ok: true, approved_until: null });
    },
    teach_enroll_extend(me, a) {
      if (roleOf(me) !== 'owner') return E('ขยายอายุได้เฉพาะเจ้าของ');
      const e = enr(a.p_id), why = String(a.p_note || '').trim() || 'เจ้าของขยายอายุ';
      if (why.length > 500) return E('หมายเหตุยาวเกิน 500 ตัวอักษร');
      if (!e) return E('ไม่พบการลงเรียนนี้');
      if (e.closed_on) return E('การลงเรียนนี้ปิดแล้ว');
      if (!e.expires_on) return E('ยังไม่มีวันหมดอายุ (ยังไม่มีวันเริ่มเรียน) — ใส่วันเริ่มเรียนก่อน');
      if (!a.p_until || a.p_until <= (e.extended_until || e.expires_on)) return E('วันที่ต้องเกินวันหมดอายุปัจจุบัน');
      if (TEACH.ext.some(x => x.enrollment_id === e.id && x.status === 'pending')) return E('มีคำขอรอตัดสินอยู่ — ตัดสินคำขอนั้นแทน');
      e.extended_until = a.p_until; e.extension_note = why; recalc(e);
      TEACH.ext.push({ id: 'nx' + (++TEACH.seq), enrollment_id: e.id, requested_by: null, requested_until: a.p_until, reason: why, status: 'approved', decision_note: null, approved_until: a.p_until, decided_at: new Date().toISOString(), created_at: new Date().toISOString() });
      return OK(true);
    },
    teach_gcal_link(me, a) {
      const s = TEACH.sessions.find(x => x.id === a.p_session);
      if (!roleOf(me) && !(s && mySess(me, s))) return E('ผูกนัดได้เฉพาะทีมงานหรือครูของรอบนี้');
      if (!s) return E('ไม่พบรอบเรียนนี้');
      if (!String(a.p_uid || '').trim() || !a.p_start) return E('ต้องมีรหัสนัด (uid) และเวลาเริ่มของนัดในปฏิทิน');
      if (TEACH.sessions.some(x => x !== s && x.gcal_uid === a.p_uid && x.gcal_start === a.p_start)) return E('นัดนี้ในปฏิทินถูกผูกกับรอบเรียนอื่นแล้ว');
      s.gcal_uid = a.p_uid; s.gcal_start = a.p_start;
      return OK(true);
    },
    teach_gcal_unlink(me, a) {
      const s = TEACH.sessions.find(x => x.id === a.p_session);
      if (!roleOf(me) && !(s && mySess(me, s))) return E('ถอดนัดได้เฉพาะทีมงานหรือครูของรอบนี้');
      if (!s) return OK(false);
      s.gcal_uid = null; s.gcal_start = null;
      return OK(true);
    },
  });
  // ตารางที่ก้อน B อ่าน/เขียน (ฐานปลอมแบบเรียบ: ไม่จำลอง RLS ละเอียด — ตัวจริงตรวจที่ test047.mjs)
  const plain = (client, table, rowsFn, onInsert, onUpdate) => {
    const st = { op: 'select', notCol: null, order: null, cols: '' };
    const q = {
      select(c) { st.cols = c || ''; return q; }, order() { return q; }, limit() { return q; },
      update(p) { st.op = 'update'; st.payload = p; return q; }, eq(c, v) { st.eqs = (st.eqs || []).concat([[c, v]]); return q; }, contains() { return q; }, or() { return q; }, ilike() { return q; },
      not(c) { st.notCol = c; return q; },
      insert(p) { st.op = 'insert'; st.payload = p; return q; },
      async single() { const r = await run(); return { data: (r.data || [])[0] || null, error: r.error }; },
      async maybeSingle() { const r = await run(); return { data: (r.data || [])[0] || null, error: r.error }; },
      then(res, rej) { return run().then(res, rej); },
    };
    async function run() {
      CALLS.push({ op: st.op, table, who: who(client), cols: st.cols, eqs: st.eqs || [], payload: st.payload ? { keys: Object.keys(st.payload) } : null,
        vals: table === 'courses' && st.payload ? clone(st.payload) : undefined });       // ไม่เก็บค่า (ชื่อ/เบอร์) ลงบันทึกเรียก — ยกเว้นราคาคอร์ส (ไม่ใช่ข้อมูลส่วนตัว)
      if (TEACH.fail['from_' + table]) return E(TEACH.fail['from_' + table]);
      if (TEACH.missing) return E('relation "public.' + table + '" does not exist');
      if (st.op === 'insert') return onInsert ? onInsert(st.payload, client) : E('permission denied for table ' + table);
      if (st.op === 'update') return onUpdate ? onUpdate(st, client) : E('permission denied for table ' + table);
      if (table === 'courses' && TEACH.noSource && /source_price/.test(st.cols)) return E('column courses.source_price does not exist');   // ยังไม่รัน 061
      return OK(clone(rowsFn(st)).filter(r => (st.eqs || []).every(([c, v]) => r[c] === v)));
    }
    return q;
  };
  const B_TABLES = {
    // update: เจ้าของ/ผู้ดูแลเท่านั้น (060 · courses_owner_admin_write) — คนอื่นโดน RLS กรองเงียบ ๆ = 0 แถว (ไม่มี error) · TEACH.noCourseWrite = ยังไม่รัน 060 (ไม่มี policy เขียน = 0 แถวเหมือนกัน)
    courses: c => plain(c, 'courses', st => TEACH.courses.map(r => {
      if (!TEACH.noSource) return r;
      const { source_price: _s, ...rest } = r; return rest;                                 // ฐานที่ยังไม่รัน 061: ไม่มีคอลัมน์นี้ในแถวด้วย
    }), null, (st, client) => {
      const role = roleOf(who(client));
      if ((role !== 'owner' && role !== 'admin') || TEACH.noCourseWrite) return OK([]);
      const hit = TEACH.courses.filter(r => (st.eqs || []).every(([k, v]) => r[k] === v));
      hit.forEach(r => { if ('list_price' in st.payload) r.list_price = Number(st.payload.list_price).toFixed(2); });
      TEACH.priceWrites = (TEACH.priceWrites || []).concat(hit.map(r => ({ id: r.id, list_price: r.list_price, by: who(client) })));
      return OK(clone(hit));
    }),
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
        const caller = who(c);                         // ตัวตนของผู้เรียก ณ ตอนส่งคำขอ (ไม่ใช่ตอนตอบ — สลับบัญชีกลางทางไม่เปลี่ยนผลที่ฐานตอบ)
        CALLS.push({ op: 'rpc', fn, args: clone(args || {}), who: caller });
        if (TEACH.gateRpc) await TEACH.gateRpc;
        if (TEACH.fail['rpc_' + fn]) return E(TEACH.fail['rpc_' + fn]);
        if (TEACH.missing) return E('Could not find the function public.' + fn + ' in the schema cache');
        return RPC[fn](caller, args || {});
      }
      if (fn !== 'my_teacher_id') return rpc(fn, args);
      CALLS.push({ op: 'rpc', fn, args, who: who(c) });
      if (TEACH.fail.rpc) return E(TEACH.fail.rpc);
      return OK(myTid(who(c)));
    };
    // บัญชีที่ไม่มีแถว admins: ครูล้วน (maniac) / คนทั่วไป (ghost) — ของจริงล็อกอินผ่านแต่ไม่มีสิทธิ์อะไร
    c.auth.signInWithPassword = async function (a) {
      const em = String((a && a.email) || '').toLowerCase();
      if (em.startsWith('maniac') || em.startsWith('ghost') || em.startsWith('alldayz')) {
        const id = em.startsWith('maniac') ? 'u-maniac' : em.startsWith('alldayz') ? 'u-alldayz' : 'u-ghost';
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
