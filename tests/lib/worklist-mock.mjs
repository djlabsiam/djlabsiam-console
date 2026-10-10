/**
 * ฐานข้อมูลปลอมของ "งานของฉัน" (work_tasks / work_task_events / work_requests · migration 037 + 038) — วางต่อท้าย MOCK ของ desk-home3
 *
 * จำลองฝั่งฐานข้อมูลตาม 038 (ตัวจริงมีชุดเทสต์ของตัวเองที่ Console/sql-tests/test038.mjs · ที่นี่จำลองไว้ให้หน้าเว็บเจอพฤติกรรมจริงที่ต้องรับมือ):
 *   · เบราว์เซอร์อ่านได้อย่างเดียว (RLS): ผู้รับเห็นใบตัวเอง · ผู้สั่งเห็นใบที่ตัวเองสั่ง · เจ้าของ/ผู้ดูแลเห็นทุกใบ · ประวัติเห็นตามใบ ·
 *     คำขอเห็นเฉพาะผู้ยื่น/คนที่ถูกระบุ/คนในกลุ่มผู้รับ/เจ้าของ · insert/update/delete ตรง ๆ = permission denied
 *   · ฟังก์ชัน work_create / submit / review / edit / reassign / cancel / close + work_request_create / decide / withdraw ใช้ตารางสิทธิ์เดียวกับ 038
 *     (สั่งงาน: เจ้าของทุกคน · ผู้ดูแล=ผู้ดูแล+พนักงาน · พนักงาน=พนักงาน · ตรวจ: เจ้าของทุกใบ · ผู้ดูแลเฉพาะงานของพนักงาน · แก้/ย้าย/ยกเลิก: เจ้าของ/ผู้สั่ง/ผู้ดูแลกับใบของพนักงาน)
 *     + งานรูป/วิดีโอที่ระบุช่องทาง 2 ขั้น (phase content → final) + ปฏิเสธคำขอต้องมีเหตุผล · ใครตัดสินก่อนเป็นผู้ตัดสิน
 *   · ถังรูป work-evidence: อัปได้เฉพาะผู้รับตอน open/changes · ชื่อไฟล์ <task_id>/... · ซ้ำไม่ได้ (ไม่มี policy แก้ไฟล์) · ลิงก์ชั่วคราวเฉพาะคนที่เห็นใบนั้น
 * ตัวควบคุมจากเทสต์: window.WORK.seed() ใส่ข้อมูลตั้งต้น · WORK.fail = { select, rpc_<ชื่อฟังก์ชัน>, upload, sign } · WORK.missing (ยังไม่รัน 037) · WORK.noReq (ยังไม่รัน 038)
 *   WORK.gate = Promise ที่ค้างคำตอบ select · WORK.subs = ตัวฟัง Realtime · WORK.fireRt(table) ยิง Realtime · WORK.uploads / WORK.signed / WORK.files = ร่องรอยฝั่งถังรูป
 * ผู้ใช้ (ล็อกอินด้วยชื่อขึ้นต้น): tibass=เจ้าของ(u1) · nui/fah=ผู้ดูแล(u4/u5) · zen/nutty/pran=พนักงาน(u2/u3/u6) · ghost=พนักงานที่ถูกปิด(u7)
 */
export const WORK_MOCK = `<script>
const WORK = { tasks: [], events: [], reqs: [], files: new Map(), uploads: [], signed: [], subs: [], fail: {}, missing: false, noReq: false, gate: null, seq: 0, tick: 0 };
(function () {
  FAKE.admins.push({ id: 'u4', full_name: 'Nui', role: 'admin', is_active: true }, { id: 'u5', full_name: 'Fah', role: 'admin', is_active: true },
    { id: 'u6', full_name: 'Pran', role: 'staff', is_active: true }, { id: 'u7', full_name: 'Ghost', role: 'staff', is_active: false });
  const clone = o => JSON.parse(JSON.stringify(o));
  const iso = ms => new Date(ms).toISOString();
  const nowIso = () => iso(Date.now() + (WORK.tick++));          // เรียงลำดับเวลาให้ต่างกันทุกเหตุการณ์ แม้เกิดในมิลลิวินาทีเดียวกัน
  const ago = h => iso(Date.now() - h * 3600000);
  const role = id => { const a = FAKE.admins.find(x => x.id === id && x.is_active); return a ? a.role : null; };
  const nameOf = id => (FAKE.admins.find(x => x.id === id) || {}).full_name;
  const E = m => ({ data: null, error: { message: m } });
  const OK = d => ({ data: d === undefined ? null : d, error: null });
  const LOGIN = 'ต้องเข้าสู่ระบบด้วยบัญชีทีมงานที่ยังใช้งานอยู่';

  // ── สิทธิ์ (สำเนาของ work_can_* ใน 038) ──
  const canAssign = (me, a) => { const m = role(me), r = role(a); return m === 'owner' ? !!r : m === 'admin' ? (r === 'admin' || r === 'staff') : m === 'staff' ? r === 'staff' : false; };
  const canReview = (me, a) => { const m = role(me); return m === 'owner' || (m === 'admin' && role(a) === 'staff'); };
  const canManage = (me, creator, a) => { const m = role(me); if (!m) return false; if (m === 'owner') return true; if (creator === me) return true; return m === 'admin' && role(a) === 'staff'; };
  const phaseFor = (kind, ch) => ((kind === 'photo' || kind === 'video') && ch.length > 0) ? 'content' : 'final';
  const taskVisible = (me, t) => { const m = role(me); return !!m && (t.assignee_id === me || t.created_by === me || m === 'owner' || m === 'admin'); };
  const reqVisible = (me, r) => { const m = role(me); return !!m && (r.requester_id === me || r.to_user_id === me || r.to_group === m || m === 'owner'); };
  const hasContentOk = id => WORK.events.some(e => e.task_id === id && e.kind === 'content_approved');
  const HOSTS = { facebook: ['facebook.com', 'fb.com', 'fb.me', 'fb.watch'], instagram: ['instagram.com'], tiktok: ['tiktok.com'], youtube: ['youtube.com', 'youtu.be'] };
  const NAMES = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' };
  const linkOk = l => {
    if (!l || typeof l.url !== 'string' || l.url.length > 500 || l.url.indexOf('https://') !== 0) return false;
    const host = l.url.slice(8).split(/[/?#]/)[0].toLowerCase();
    if (!host || host.indexOf('@') >= 0 || host.indexOf(' ') >= 0) return false;
    return !l.channel || (HOSTS[l.channel] || []).some(d => host === d || host.endsWith('.' + d));
  };
  const ev = (task, kind, actor, note, extra) => WORK.events.push(Object.assign({ id: 'e' + (++WORK.seq), task_id: task.id, kind, actor_id: actor, note: note || '', links: [], image_paths: [],
    phase: task.phase, created_at: nowIso() }, extra || {}));

  // ── ข้อมูลตั้งต้น (สัมพัทธ์กับตอนนี้) ──
  const mkTask = (id, o) => Object.assign({ id, title: id, detail: '', kind: 'other', channels: [], ref_links: [], assignee_id: 'u2', created_by: 'u4', due_at: null, status: 'open', phase: 'final', batch_id: null,
    submitted_at: null, closed_at: null, created_at: ago(30), updated_at: ago(2) }, o);
  WORK.seed = () => {
    WORK.tasks = []; WORK.events = []; WORK.reqs = []; WORK.files = new Map(); WORK.uploads = []; WORK.signed = []; WORK.fail = {}; WORK.missing = false; WORK.noReq = false; WORK.gate = null; WORK.signGate = null;
    const T = (id, o) => { const t = mkTask(id, o); WORK.tasks.push(t); ev(t, 'created', t.created_by, '', { created_at: t.created_at }); return t; };
    const submitted = (t, note, links, imgs, phase, h) => { t.status = 'submitted'; t.submitted_at = ago(h || 1); ev(t, 'submitted', t.assignee_id, note, { links: links || [], image_paths: imgs || [], phase: phase || t.phase, created_at: ago(h || 1) }); };
    // ใบของ Zen (พนักงาน)
    T('a1', { title: 'ถ่ายรูปสินค้า DDJ-FLX4 ลง Instagram', kind: 'photo', channels: ['instagram'], phase: 'content', due_at: ago(2.3), created_by: 'u4' });
    const a2 = T('a2', { title: 'ตัดคลิปรีวิว HDJ-CUE1 ลง Facebook และ TikTok', kind: 'video', channels: ['facebook', 'tiktok'], phase: 'content', due_at: iso(Date.now() + 20 * 3600000), created_by: 'u4' });
    submitted(a2, 'ส่งไฟล์รอบแรก', [{ url: 'https://drive.google.com/file/d/1AbC/view' }], [], 'content');
    a2.status = 'changes'; ev(a2, 'changes_requested', 'u4', 'เสียงเบาไป ช่วยมิกซ์ใหม่แล้วส่งไฟล์อีกรอบ', { phase: 'content' });
    const a3 = T('a3', { title: 'ถ่ายรูปสินค้าใหม่ DDJ-GRV6 ลง Instagram และ Facebook', kind: 'photo', channels: ['facebook', 'instagram'], phase: 'content', due_at: iso(Date.now() + 30 * 3600000), created_by: 'u1' });
    submitted(a3, 'ไฟล์ตัดเสร็จแล้ว', [{ url: 'https://drive.google.com/file/d/1GRV6/view' }], [], 'content');
    a3.status = 'open'; a3.phase = 'final'; ev(a3, 'content_approved', 'u5', 'ไฟล์ผ่าน ลงโซเชียลได้เลย', { phase: 'content' });
    T('a4', { title: 'โพสต์โปร Starter Pack ลงเพจ Facebook', kind: 'social_post', channels: ['facebook'], due_at: iso(Date.now() + 26 * 3600000), created_by: 'u4' });
    const a5 = T('a5', { title: 'ตรวจนับสาย XLR ที่ตู้หลังร้าน', created_by: 'u4' });
    submitted(a5, 'นับแล้ว 42 เส้น', [], [], null, 3);
    const a6 = T('a6', { title: 'งานที่ผ่านแล้วเมื่อ 5 วันก่อน', created_by: 'u4' });
    submitted(a6, 'เสร็จ'); a6.status = 'approved'; a6.closed_at = ago(120); ev(a6, 'approved', 'u4', '', { created_at: ago(120) });
    // ใบของ Nutty (พนักงาน)
    const b1 = T('b1', { title: 'จัดชั้นวางหูฟังหน้าร้านใหม่', assignee_id: 'u3', created_by: 'u4', due_at: ago(5) });
    submitted(b1, 'จัดเสร็จแล้ว', [], [], null, 2.5);
    const b2 = T('b2', { title: 'ถ่ายรูปชุดหูฟัง HDJ-X7 ลง Facebook', kind: 'photo', channels: ['facebook'], phase: 'content', assignee_id: 'u3', created_by: 'u1' });
    submitted(b2, 'ไฟล์พร้อมแล้ว', [{ url: 'https://drive.google.com/file/d/1HDJX7/view' }], [], 'content', 2);
    T('b3', { title: 'นับสต็อกสายแจ็คที่ตู้หน้าร้าน', assignee_id: 'u3', created_by: 'u3' });
    T('d1', { title: 'ช่วยเก็บกล่องที่หลังร้าน (Zen สั่ง Nutty)', assignee_id: 'u3', created_by: 'u2' });
    // ใบของผู้ดูแล / คนอื่น
    const c1 = T('c1', { title: 'อัปเดตรายการราคาหูฟังในแดชบอร์ด', assignee_id: 'u4', created_by: 'u1' });
    submitted(c1, 'อัปเดตเสร็จ', [], [], null, 1.5);
    T('e1', { title: 'เช็กอุปกรณ์ห้องซ้อม (ของ Pran)', assignee_id: 'u6', created_by: 'u1' });
    // คำขอ
    const R = (id, o) => { WORK.reqs.push(Object.assign({ id, requester_id: 'u2', to_user_id: null, to_group: null, task_id: null, body: id, status: 'pending', decided_by: null, decision_note: '', closed_at: null, created_at: ago(3), updated_at: ago(3) }, o)); };
    R('q1', { requester_id: 'u2', to_group: 'admin', task_id: 'a1', body: 'ช่วยย้ายงานถ่ายรูป DDJ-FLX4 ไปให้ Nutty ได้มั้ยครับ ตอนนี้ติดงานตัดคลิปอยู่', created_at: ago(5) });
    R('q2', { requester_id: 'u3', to_user_id: 'u4', body: 'ขอเลื่อนกำหนดโพสต์โปรไปพรุ่งนี้บ่ายได้ไหมครับ', created_at: ago(4) });
    R('q3', { requester_id: 'u2', to_user_id: 'u4', body: 'ขอลาครึ่งวันศุกร์', status: 'rejected', decided_by: 'u4', decision_note: 'ศุกร์มีคอร์สสองคลาส ต้องมีคนอยู่หน้าร้าน', closed_at: ago(20), created_at: ago(26) });
    R('q4', { requester_id: 'u4', to_group: 'owner', body: 'ขออนุมัติซื้อไมค์สำหรับห้องซ้อมเพิ่ม 1 ตัว', created_at: ago(2) });
    R('q5', { requester_id: 'u6', to_group: 'owner', body: 'ขอหยุดวันจันทร์หน้า', created_at: ago(1) });
    R('q6', { requester_id: 'u2', to_group: 'admin', body: 'ขอให้ช่วยตรวจรูปปกช่อง YouTube ก่อนส่ง', status: 'approved', decided_by: 'u5', decision_note: 'เดี๋ยวเข้าไปดูให้ที่ใบงาน', closed_at: ago(40), created_at: ago(48) });
  };

  // ── เบราว์เซอร์อ่านได้อย่างเดียว ──
  function builder(client, table) {
    const st = { op: 'select', order: null, limit: null, payload: null };
    const me = () => client.session && client.session.user.id;
    const q = {
      select() { return q; }, order(c, o) { st.order = { c, asc: !(o && o.ascending === false) }; return q; }, limit(n) { st.limit = n; return q; },
      insert(p) { st.op = 'insert'; st.payload = p; return q; }, update(p) { st.op = 'update'; st.payload = p; return q; }, delete() { st.op = 'delete'; return q; }, eq() { return q; },
      then(res, rej) { return run().then(res, rej); },
    };
    async function run() {
      const who = me();
      CALLS.push({ op: st.op, table, payload: st.payload, who });
      if (WORK.gate) await WORK.gate;
      if (st.op !== 'select') return E('permission denied for table ' + table);
      if (WORK.fail.select) return E(WORK.fail.select);
      if (WORK.missing || (WORK.noReq && table === 'work_requests')) return E('relation "public.' + table + '" does not exist');
      let rows = table === 'work_tasks' ? WORK.tasks.filter(t => taskVisible(who, t))
        : table === 'work_task_events' ? WORK.events.filter(e => taskVisible(who, WORK.tasks.find(t => t.id === e.task_id) || {}))
        : WORK.reqs.filter(r => reqVisible(who, r));
      rows = rows.map(clone);
      if (st.order) rows.sort((a, b) => String(a[st.order.c]).localeCompare(String(b[st.order.c])) * (st.order.asc ? 1 : -1));
      if (st.limit != null) rows = rows.slice(0, st.limit);
      return OK(rows);
    }
    return q;
  }

  // ── ฟังก์ชัน work_* (ทางเขียนเดียว) ──
  const find = id => WORK.tasks.find(t => t.id === id);
  const RPC = {
    work_create(me, a) {
      if (!role(me)) return E(LOGIN);
      if (!String(a.p_title || '').trim()) return E('ต้องใส่หัวข้องาน');
      const ass = [...new Set(a.p_assignees || [])];
      if (!ass.length) return E('ต้องเลือกผู้รับงานอย่างน้อย 1 คน');
      for (const x of ass) {
        if (!x || !role(x)) return E('ผู้รับงานต้องเป็นทีมงานที่ยังใช้งานอยู่');
        if (!canAssign(me, x)) return E('สั่งงานให้ ' + nameOf(x) + ' ไม่ได้ — เจ้าของสั่งได้ทุกคน · ผู้ดูแลสั่งได้เฉพาะผู้ดูแลและพนักงาน · พนักงานสั่งได้เฉพาะพนักงาน');
      }
      const ch = [...new Set(a.p_channels || [])].sort(), kind = a.p_kind || 'other', phase = phaseFor(kind, ch), batch = 'batch' + (++WORK.seq), ids = [];
      for (const x of ass) {
        const t = mkTask('w' + (++WORK.seq), { title: String(a.p_title).trim(), detail: a.p_detail || '', kind, channels: ch, ref_links: a.p_ref_links || [], assignee_id: x, created_by: me, due_at: a.p_due_at || null,
          status: 'open', phase, batch_id: batch, created_at: nowIso(), updated_at: nowIso() });
        WORK.tasks.push(t); ev(t, 'created', me, ''); ids.push(t.id);
      }
      return OK(ids);
    },
    work_submit(me, a) {
      const t = find(a.p_task);
      if (!role(me)) return E(LOGIN);
      if (!t || t.assignee_id !== me) return E('ไม่พบงานนี้ หรือไม่ใช่งานของคุณ');
      if (t.status !== 'open' && t.status !== 'changes') return E('ส่งงานได้เฉพาะงานที่ยังไม่ส่งหรือถูกส่งกลับแก้ (สถานะตอนนี้: ' + t.status + ')');
      const links = a.p_links || [], paths = a.p_image_paths || [], note = String(a.p_note || '').trim();
      if (links.length > 10 || !links.every(linkOk)) return E('ลิงก์ที่แนบไม่ถูกต้อง — ต้องขึ้นต้น https:// ไม่เกิน 10 ลิงก์ และลิงก์ของช่องไหนต้องเป็นโดเมนของช่องนั้น');
      if (paths.length > 6 || new Set(paths).size !== paths.length || paths.some(p => p.indexOf(t.id + '/') !== 0)) return E('รูปที่แนบไม่ถูกต้อง — ไม่เกิน 6 รูป ห้ามซ้ำ และต้องอัปไว้ในโฟลเดอร์ของงานนี้');
      if (paths.some(p => !WORK.files.has(p))) return E('ไม่พบไฟล์รูปในที่เก็บ — อัปโหลดให้เสร็จก่อนกดส่ง');
      if (t.phase === 'final') {
        const miss = t.channels.slice().sort().find(c => !links.some(l => l.channel === c));
        if (miss) return E('ยังไม่ได้แนบลิงก์ของช่อง ' + NAMES[miss]);
      }
      if (!links.length && !paths.length && (t.kind !== 'other' || !note)) return E('ต้องแนบหลักฐานก่อนส่งงาน (ลิงก์หรือรูป)');
      t.status = 'submitted'; t.submitted_at = nowIso(); t.updated_at = nowIso();
      ev(t, 'submitted', me, note, { links: clone(links), image_paths: paths.slice() });
      return OK();
    },
    work_review(me, a) {
      const m = role(me);
      if (m !== 'owner' && m !== 'admin') return E('ตรวจงานได้เฉพาะเจ้าของร้านและผู้ดูแลระบบ');
      if (a.p_verdict !== 'approve' && a.p_verdict !== 'changes') return E('ผลการตรวจต้องเป็น approve (ผ่าน) หรือ changes (ส่งกลับแก้)');
      const t = find(a.p_task), note = String(a.p_note || '').trim();
      if (!t) return E('ไม่พบงานนี้');
      if (t.status !== 'submitted') return E('ตรวจได้เฉพาะงานที่ส่งแล้วและรอตรวจ (สถานะตอนนี้: ' + t.status + ')');
      if (!canReview(me, t.assignee_id)) return E('ตรวจงานนี้ไม่ได้ — เจ้าของตรวจได้ทุกใบ · ผู้ดูแลตรวจได้เฉพาะงานของพนักงาน (งานของผู้ดูแลเจ้าของตรวจ)');
      if (a.p_verdict === 'changes' && !note) return E('ส่งกลับแก้ต้องมีความเห็น');
      t.updated_at = nowIso();
      if (a.p_verdict === 'changes') { t.status = 'changes'; ev(t, 'changes_requested', me, note); }
      else if (t.phase === 'content') { t.phase = 'final'; t.status = 'open'; ev(t, 'content_approved', me, note, { phase: 'content' }); }
      else { t.status = 'approved'; t.closed_at = nowIso(); ev(t, 'approved', me, note); }
      return OK();
    },
    work_edit(me, a) {
      if (!role(me)) return E(LOGIN);
      const t = find(a.p_task), title = String(a.p_title || '').trim();
      if (!title) return E('ต้องใส่หัวข้องาน');
      if (!t) return E('ไม่พบงานนี้');
      if (!canManage(me, t.created_by, t.assignee_id)) return E('แก้ใบงานนี้ไม่ได้ — เจ้าของแก้ได้ทุกใบ · ผู้ดูแลแก้ใบของพนักงาน · ผู้สั่งแก้ใบที่ตัวเองสั่ง');
      if (['open', 'changes', 'submitted'].indexOf(t.status) < 0) return E('แก้ได้เฉพาะงานที่ยังไม่ผ่านและไม่ถูกยกเลิก (สถานะตอนนี้: ' + t.status + ')');
      const ch = [...new Set(a.p_channels || [])].sort(), kind = a.p_kind || 'other', phase = hasContentOk(t.id) ? 'final' : phaseFor(kind, ch);
      const same = title === t.title && (a.p_detail || '') === t.detail && kind === t.kind && JSON.stringify(ch) === JSON.stringify(t.channels) && JSON.stringify(a.p_ref_links || []) === JSON.stringify(t.ref_links) &&
        (a.p_due_at ? Date.parse(a.p_due_at) : null) === (t.due_at ? Date.parse(t.due_at) : null) && phase === t.phase;
      if (same) return E('ไม่มีอะไรเปลี่ยน');
      Object.assign(t, { title, detail: a.p_detail || '', kind, channels: ch, ref_links: a.p_ref_links || [], due_at: a.p_due_at || null, phase, updated_at: nowIso() });
      ev(t, 'edited', me, 'แก้ใบงาน' + (a.p_note ? ' — ' + a.p_note : ''));
      return OK();
    },
    work_reassign(me, a) {
      if (!role(me)) return E(LOGIN);
      const t = find(a.p_task);
      if (!t) return E('ไม่พบงานนี้');
      if (!canManage(me, t.created_by, t.assignee_id)) return E('ย้ายผู้รับงานนี้ไม่ได้ — เจ้าของย้ายได้ทุกใบ · ผู้ดูแลย้ายใบของพนักงาน · ผู้สั่งย้ายใบที่ตัวเองสั่ง');
      if (t.status !== 'open' && t.status !== 'changes') return E('ย้ายผู้รับได้เฉพาะงานที่ยังไม่ส่ง (สถานะตอนนี้: ' + t.status + ')');
      if (!a.p_assignee || !role(a.p_assignee)) return E('ผู้รับงานต้องเป็นทีมงานที่ยังใช้งานอยู่');
      if (a.p_assignee === t.assignee_id) return E('ผู้รับงานคนเดิม');
      if (!canAssign(me, a.p_assignee)) return E('ย้ายงานไปให้คนนี้ไม่ได้ — ผู้รับใหม่ต้องอยู่ในขอบเขตที่คุณสั่งงานได้');
      const from = nameOf(t.assignee_id); t.assignee_id = a.p_assignee; t.updated_at = nowIso();
      ev(t, 'reassigned', me, 'ย้ายผู้รับ: ' + from + ' → ' + nameOf(a.p_assignee));
      return OK();
    },
    work_cancel(me, a) {
      if (!role(me)) return E(LOGIN);
      const t = find(a.p_task);
      if (!t) return E('ไม่พบงานนี้');
      if (!canManage(me, t.created_by, t.assignee_id)) return E('ยกเลิกงานนี้ไม่ได้ — เจ้าของยกเลิกได้ทุกใบ · ผู้ดูแลยกเลิกใบของพนักงาน · ผู้สั่งยกเลิกใบที่ตัวเองสั่ง');
      if (['open', 'changes', 'submitted'].indexOf(t.status) < 0) return E('ยกเลิกได้เฉพาะงานที่ยังไม่ผ่าน (สถานะตอนนี้: ' + t.status + ')');
      t.status = 'cancelled'; t.closed_at = nowIso(); t.updated_at = nowIso(); ev(t, 'cancelled', me, String(a.p_note || ''));
      return OK();
    },
    work_close(me, a) {
      const m = role(me);
      if (m !== 'owner' && m !== 'admin') return E('ปิดงานได้เฉพาะเจ้าของร้านและผู้ดูแลระบบ');
      const t = find(a.p_task);
      if (!t) return E('ไม่พบงานนี้');
      if (!canReview(me, t.assignee_id)) return E('ปิดงานนี้ไม่ได้ — ต้องเป็นผู้ที่ตรวจงานนี้ได้');
      if (['open', 'changes'].indexOf(t.status) < 0 || t.phase !== 'final' || t.channels.length > 0 || !hasContentOk(t.id)) return E('ปิดงานตรงนี้ได้เฉพาะงานที่ผ่านขั้นไฟล์แล้ว รอลงโซเชียล และไม่มีช่องโซเชียลเหลือให้ลง');
      t.status = 'approved'; t.closed_at = nowIso(); t.updated_at = nowIso(); ev(t, 'approved', me, 'ปิดงาน — ไม่ต้องลงโซเชียลแล้ว');
      return OK();
    },
    work_request_create(me, a) {
      const m = role(me), body = String(a.p_body || '').trim();
      if (!m) return E(LOGIN);
      if (m === 'owner') return E('เจ้าของร้านยื่นคำขอไม่ได้ — สั่งงานหรือย้ายงานได้เลย');
      if (!body) return E('ต้องใส่ข้อความคำขอ');
      if (body.length > 1000) return E('ข้อความคำขอยาวเกิน 1000 ตัวอักษร');
      if ((a.p_to_user == null) === (a.p_to_group == null)) return E('ต้องเลือกผู้รับคำขอ: คนใดคนหนึ่ง หรือทั้งกลุ่ม (เจ้าของ / ผู้ดูแล) อย่างใดอย่างหนึ่ง');
      const allowed = m === 'admin' ? ['owner'] : ['owner', 'admin'];
      let to;
      if (a.p_to_group != null) { if (['owner', 'admin'].indexOf(a.p_to_group) < 0) return E('กลุ่มผู้รับต้องเป็น owner (เจ้าของ) หรือ admin (ผู้ดูแล)'); to = a.p_to_group; } else to = role(a.p_to_user);
      if (!to || allowed.indexOf(to) < 0) return E('ยื่นคำขอถึงคนนี้ไม่ได้ — ผู้รับต้องเป็นทีมงานที่ยังใช้งานอยู่ · ผู้ดูแลยื่นถึงเจ้าของได้ · พนักงานยื่นถึงเจ้าของหรือผู้ดูแลได้');
      if (a.p_task != null) { const t = find(a.p_task); if (!t || !(t.assignee_id === me || t.created_by === me || m === 'admin')) return E('แนบใบงานนี้ไม่ได้ — แนบได้เฉพาะใบที่คุณเป็นผู้รับหรือผู้สั่ง'); }
      const r = { id: 'r' + (++WORK.seq), requester_id: me, to_user_id: a.p_to_user || null, to_group: a.p_to_group || null, task_id: a.p_task || null, body, status: 'pending', decided_by: null, decision_note: '',
        closed_at: null, created_at: nowIso(), updated_at: nowIso() };
      WORK.reqs.push(r);
      return OK(r.id);
    },
    work_request_decide(me, a) {
      const m = role(me), note = String(a.p_note || '').trim();
      if (m !== 'owner' && m !== 'admin') return E('ตัดสินคำขอได้เฉพาะเจ้าของร้านและผู้ดูแลระบบ');
      if (a.p_verdict !== 'approve' && a.p_verdict !== 'reject') return E('ผลการตัดสินต้องเป็น approve (อนุมัติ) หรือ reject (ปฏิเสธ)');
      const r = WORK.reqs.find(x => x.id === a.p_request);
      if (!r) return E('ไม่พบคำขอนี้ หรือไม่ได้ส่งถึงคุณ');
      if (r.requester_id === me) return E('ตัดสินคำขอของตัวเองไม่ได้');
      if (!(m === 'owner' || r.to_user_id === me || r.to_group === m)) return E('ไม่พบคำขอนี้ หรือไม่ได้ส่งถึงคุณ');
      if (r.status !== 'pending') return E('คำขอนี้ปิดไปแล้ว (' + (r.status === 'withdrawn' ? 'ผู้ยื่นถอนแล้ว' : (r.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว') + 'โดย ' + nameOf(r.decided_by)) + ')');
      if (a.p_verdict === 'reject' && !note) return E('ปฏิเสธต้องใส่เหตุผล');
      Object.assign(r, { status: a.p_verdict === 'approve' ? 'approved' : 'rejected', decided_by: me, decision_note: note, closed_at: nowIso(), updated_at: nowIso() });
      return OK();
    },
    work_request_withdraw(me, a) {
      if (!role(me)) return E(LOGIN);
      const r = WORK.reqs.find(x => x.id === a.p_request);
      if (!r || r.requester_id !== me) return E('ไม่พบคำขอนี้ หรือไม่ใช่คำขอของคุณ');
      if (r.status !== 'pending') return E('ถอนได้เฉพาะคำขอที่ยังรอตัดสิน (สถานะตอนนี้: ' + r.status + ')');
      Object.assign(r, { status: 'withdrawn', closed_at: nowIso(), updated_at: nowIso() });
      return OK();
    },
  };

  // ── ถังรูป work-evidence ──
  const BUCKET = {
    async upload(c, path, file, opts) {
      const me = c.session && c.session.user.id;
      WORK.uploads.push({ path, size: file.size, type: opts && opts.contentType, upsert: !!(opts && opts.upsert), who: me });
      if (WORK.fail.upload) return E(WORK.fail.upload);
      const t = find(String(path).split('/')[0]);
      if (!t || t.assignee_id !== me || (t.status !== 'open' && t.status !== 'changes')) return E('new row violates row-level security policy');
      if (!opts || ['image/webp', 'image/jpeg'].indexOf(opts.contentType) < 0) return E('mime type not supported');
      if (file.size > 5 * 1024 * 1024) return E('The object exceeded the maximum allowed size');
      if (WORK.files.has(path)) return E('The resource already exists');
      WORK.files.set(path, { size: file.size, type: opts.contentType });
      return OK({ path });
    },
    async remove(c, paths) {
      const me = c.session && c.session.user.id;
      WORK.uploads.push({ removed: paths.slice(), who: me });
      const gone = paths.filter(p => { const t = find(String(p).split('/')[0]); return t && t.assignee_id === me && (t.status === 'open' || t.status === 'changes') && !WORK.events.some(e => e.image_paths.indexOf(p) >= 0) && WORK.files.delete(p); });
      return OK(gone.map(name => ({ name })));
    },
    async createSignedUrl(c, path, secs) {
      const me = c.session && c.session.user.id;
      WORK.signed.push({ path, secs, who: me });
      if (WORK.signGate) await WORK.signGate;          // ค้างคำตอบลิงก์รูปไว้ (เทสต์ออกจากระบบกลางทาง)
      const t = find(String(path).split('/')[0]);
      if (WORK.fail.sign || !t || !taskVisible(me, t) || !WORK.files.has(path)) return E('Object not found');
      return OK({ signedUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7#' + encodeURIComponent(path) });
    },
  };

  WORK.rpc = RPC; WORK.role = role; WORK.canReview = canReview;
  WORK.fireRt = table => WORK.subs.filter(s => s.table === table).forEach(s => s.cb({}));
  const create = window.supabase.createClient;
  window.supabase.createClient = (u, k, o) => {
    const c = create(u, k, o), from = c.from, rpc = c.rpc, ch0 = c.channel;
    c.from = t => (t === 'work_tasks' || t === 'work_task_events' || t === 'work_requests') ? builder(c, t) : from(t);
    c.rpc = async (fn, args) => {
      if (!RPC[fn]) return rpc(fn, args);
      const me = c.session && c.session.user.id;
      CALLS.push({ op: 'rpc', fn, args, who: me, main: c.isMain });
      if (WORK.gate) await WORK.gate;
      if (WORK.fail['rpc_' + fn]) return E(WORK.fail['rpc_' + fn]);
      if (WORK.missing) return E('Could not find the function public.' + fn + ' in the schema cache');
      return RPC[fn](me, args || {});
    };
    const st0 = c.storage;          // ชุดเทสต์ที่ซ้อนหลายฐานปลอม (เช่น แนบไฟล์จากคลัง) — ถังของชั้นอื่นส่งต่อให้ชั้นนั้น
    c.storage = { from: bucket => (st0 && bucket !== 'work-evidence') ? st0.from(bucket) : ({
      upload: (p, f, o) => bucket === 'work-evidence' ? BUCKET.upload(c, p, f, o) : Promise.resolve(E('Bucket not found')),
      remove: ps => BUCKET.remove(c, ps),
      createSignedUrl: (p, s) => BUCKET.createSignedUrl(c, p, s),
    }) };
    c.channel = function (name) {
      const ch = ch0.apply(c, arguments), on0 = ch.on;
      ch.on = function (ev2, f, cb) { WORK.subs.push({ name, table: f && f.table, cb }); return on0.apply(ch, arguments); };
      return ch;
    };
    return c;
  };
})();
</script>`;
