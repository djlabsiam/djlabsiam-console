/**
 * ฐานข้อมูลปลอมของ "แนบไฟล์จากคลังไฟล์" (transfer_attachments · transfer_attach · transfer_detach · migration 053)
 * วางซ้อนท้าย MOCK ของ desk-home3 + WORK_MOCK + TRANSFER_MOCK — ใช้ใบงาน/คำขอของ WORK, ข้อความกระดานของ MOCK3 (FAKE.board_messages), ไฟล์ในคลังของ TRN
 *
 * จำลองกติกาของ 053 (ตัวจริงตรวจกับ Postgres จริงแยก):
 *   · ตารางอ่านได้อย่างเดียว (insert/update/delete ตรง ๆ = permission denied) · เห็นเฉพาะที่ยังเห็นเป้าหมาย: ใบงาน (ผู้รับ/ผู้สั่ง/เจ้าของ/ผู้ดูแล) · คำขอ (ผู้ยื่น/ผู้รับ/กลุ่ม/เจ้าของ) · ข้อความบนกระดาน
 *   · transfer_attach_ok: กระดาน = คนเขียน/เจ้าของ/ผู้ดูแล · คำขอ = ผู้ยื่น/เจ้าของ · ใบงาน brief = ผู้สั่ง/เจ้าของ/ผู้ดูแล(ใบของพนักงาน) · submit:N = ผู้รับ/เจ้าของ · ใบที่ยกเลิกแล้วแนบไม่ได้
 *   · transfer_attach: แนบได้เฉพาะไฟล์ ready ที่ยังไม่หมดอายุ (หรือถาวร) · ≤ 20 ต่อเป้าหมาย/ctx · แนบซ้ำข้ามให้ · คืนจำนวนที่เพิ่มจริง
 *   · transfer_detach: คนที่แนบเอง หรือคนที่แนบได้ตามข้างบน
 * ตัวควบคุมจากเทสต์: ATT.throws (select โยน error ดิบ เช่น เครือข่ายล่ม) · ATT.rows (แถวที่แนบ) · ATT.fail = { select, rpc_transfer_attach, rpc_transfer_detach } · ATT.missing (ยังไม่รัน 053) · ATT.writes = ความพยายามเขียนตารางตรง ๆ
 *   ATT.add(fileId, kind, target, ctx, by) ใส่แถวตั้งต้น · ATT.gate = Promise ที่ค้างคำตอบ select
 */
export const ATT_MOCK = `<script>
const ATT = { rows: [], fail: {}, missing: false, writes: [], gate: null, seq: 0, tick: 0 };
(function () {
  FAKE.admins = FAKE.admins.filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i);     // WORK_MOCK กับ TRANSFER_MOCK ดัน u4/u7 ซ้ำกัน — คงอย่างละหนึ่ง
  const clone = o => JSON.parse(JSON.stringify(o));
  const stamp = () => new Date(Date.now() + (ATT.tick++)).toISOString();
  const role = id => { const a = FAKE.admins.find(x => x.id === id && x.is_active); return a ? a.role : null; };
  const E = (m, code) => ({ data: null, error: { message: m, code: code || null } });
  const OK = d => ({ data: d === undefined ? null : d, error: null });
  const task = id => WORK.tasks.find(t => t.id === id);
  const aliveFile = f => !!f && f.status === 'ready' && (f.is_permanent || Date.parse(f.expires_at) > Date.now());
  ATT.add = (fileId, kind, target, ctx, by) => { const r = { id: 'at' + (++ATT.seq), file_id: fileId, target_kind: kind, target_id: String(target), ctx: ctx || '', attached_by: by || null, attached_at: stamp() }; ATT.rows.push(r); return r; };
  ATT.reset = () => { ATT.rows = []; ATT.fail = {}; ATT.missing = false; ATT.throws = false; ATT.writes = []; ATT.gate = null; };

  // ข้อความกระดานที่เพิ่งเขียนผ่านหน้าเว็บ: ฐานปลอมของ desk-home3 ไม่เก็บแถว insert ลง FAKE — อ่านจากรอยเรียก insert แทน
  const boardMsg = id => FAKE.board_messages.find(b => b.id === id) || (CALLS.filter(c => c.op === 'insert' && c.table === 'board_messages' && c.q && c.q._rows[0] && c.q._rows[0].id === id).map(c => c.payload)[0] ? { id, author_id: CALLS.filter(c => c.op === 'insert' && c.table === 'board_messages' && c.q._rows[0].id === id)[0].payload.author_id } : null);
  function targetVisible(me, r) {
    const m = role(me);
    if (!m) return false;
    if (r.target_kind === 'task') { const t = task(r.target_id); return !!t && (t.assignee_id === me || t.created_by === me || m === 'owner' || m === 'admin'); }
    if (r.target_kind === 'request') { const q = WORK.reqs.find(x => x.id === r.target_id); return !!q && (q.requester_id === me || q.to_user_id === me || q.to_group === m || m === 'owner'); }
    return !!boardMsg(r.target_id);
  }
  function attachOk(me, kind, target, ctx) {
    const m = role(me);
    if (!m) return false;
    if (kind === 'board') { const x = boardMsg(target); return !!x && (x.author_id === me || m === 'owner' || m === 'admin'); }
    if (kind === 'request') { const x = WORK.reqs.find(q => q.id === target); return !!x && (x.requester_id === me || m === 'owner'); }
    const t = task(target);
    if (!t || t.status === 'cancelled') return false;
    if (ctx === 'brief') return t.created_by === me || m === 'owner' || (m === 'admin' && role(t.assignee_id) === 'staff');
    if (/^submit:[0-9]{1,3}$/.test(ctx)) return t.assignee_id === me || m === 'owner';
    return false;
  }
  const RPC = {
    transfer_attach(me, a) {
      if (!role(me)) return E('ไม่มีสิทธิ์ใช้งาน (ต้องเป็นทีมงานที่ยังใช้งานอยู่)', '42501');
      const kind = a.p_kind, ctx = a.p_ctx == null ? '' : a.p_ctx, target = a.p_target;
      if (['task', 'request', 'board'].indexOf(kind) < 0) return E('ชนิดรายการที่แนบไม่ถูกต้อง');
      if (kind === 'task' && !(ctx === 'brief' || /^submit:[0-9]{1,3}$/.test(ctx))) return E('ใบงานแนบได้เฉพาะตอนสั่ง (brief) หรือตอนส่งงาน (submit:N)');
      if (kind !== 'task' && ctx !== '') return E('ชนิดนี้ไม่มี ctx');
      if (!target || String(target).length > 64) return E('รหัสรายการไม่ถูกต้อง');
      if (!attachOk(me, kind, String(target), ctx)) return E('แนบไฟล์ไม่ได้ — ไม่มีสิทธิ์กับรายการนี้ หรือรายการถูกลบ/ยกเลิกไปแล้ว', '42501');
      const ids = [...new Set((a.p_files || []).filter(Boolean))];
      if (!ids.length) return OK(0);
      if (ids.length > 20) return E('แนบได้ไม่เกิน 20 ไฟล์ต่อครั้ง');
      if (ids.some(id => !aliveFile(TRN.files.find(f => f.id === id)))) return E('มีไฟล์ที่ไม่พบ ถูกลบ หรือหมดอายุแล้ว — เลือกใหม่จากคลังไฟล์');
      const mine = ATT.rows.filter(r => r.target_kind === kind && r.target_id === String(target) && r.ctx === ctx);
      const fresh = ids.filter(id => !mine.some(r => r.file_id === id));
      if (mine.length + fresh.length > 20) return E('แนบไฟล์ได้ไม่เกิน 20 ไฟล์ต่อรายการ (ตอนนี้มี ' + mine.length + ')');
      fresh.forEach(id => ATT.add(id, kind, String(target), ctx, me));
      return OK(fresh.length);
    },
    transfer_detach(me, a) {
      if (!role(me)) return E('ไม่มีสิทธิ์ใช้งาน', '42501');
      const r = ATT.rows.find(x => x.id === a.p_id);
      if (!r) return E('ไม่พบไฟล์แนบนี้ (อาจถูกถอดไปแล้ว)');
      if (r.attached_by !== me && !attachOk(me, r.target_kind, r.target_id, r.ctx)) return E('ถอดไฟล์แนบไม่ได้ — ถอดได้เฉพาะคนที่แนบ หรือผู้ที่แก้รายการนั้นได้', '42501');
      ATT.rows = ATT.rows.filter(x => x.id !== a.p_id);
      return OK();
    },
  };
  function builder(c) {
    const me = c.session && c.session.user.id;
    const q = { _in: null, _order: null, _lim: 1e9, _write: false };
    q.select = () => q;
    q.in = (k, v) => { q._in = [k, v]; return q; };
    q.order = (k, o) => { q._order = [k, o && o.ascending === false ? -1 : 1]; return q; };
    q.limit = n => { q._lim = n; return q; };
    q.eq = () => q;
    q.insert = q.update = q.delete = q.upsert = function () { q._write = true; return q; };
    async function run() {
      CALLS.push({ op: q._write ? 'write' : 'select', table: 'transfer_attachments', who: me });
      if (q._write) { ATT.writes.push({}); return E('permission denied for table transfer_attachments', '42501'); }
      if (ATT.gate) await ATT.gate;
      if (ATT.throws) throw new Error('Failed to fetch');
      if (ATT.missing) return E('Could not find the table \\'public.transfer_attachments\\' in the schema cache', 'PGRST205');
      if (ATT.fail.select) return E(ATT.fail.select);
      let rows = ATT.rows.filter(r => targetVisible(me, r));
      if (q._in) rows = rows.filter(r => q._in[1].indexOf(r[q._in[0]]) >= 0);
      if (q._order) rows = rows.slice().sort((a, b) => (a[q._order[0]] < b[q._order[0]] ? -1 : a[q._order[0]] > b[q._order[0]] ? 1 : 0) * q._order[1]);
      return OK(rows.slice(0, q._lim).map(r => {
        const o = clone(r), f = TRN.files.find(x => x.id === r.file_id);
        o.file = f ? { id: f.id, category: f.category, file_name: f.file_name, size_bytes: f.size_bytes, status: f.status, is_permanent: !!f.is_permanent, expires_at: f.expires_at } : null;
        return o;
      }));
    }
    q.then = (res, rej) => run().then(res, rej);
    return q;
  }
  const create = window.supabase.createClient;
  window.supabase.createClient = (u, k, o) => {
    const c = create(u, k, o), from = c.from, rpc = c.rpc;
    c.from = t => t === 'transfer_attachments' ? builder(c) : from(t);
    c.rpc = async (fn, args) => {
      if (!RPC[fn]) return rpc(fn, args);
      const me = c.session && c.session.user.id;
      CALLS.push({ op: 'rpc', fn, args, who: me, main: c.isMain });
      if (ATT.fail['rpc_' + fn]) return E(ATT.fail['rpc_' + fn]);
      if (ATT.missing) return E('Could not find the function public.' + fn + ' in the schema cache', 'PGRST202');
      return RPC[fn](me, args || {});
    };
    return c;
  };
})();
</script>`;
