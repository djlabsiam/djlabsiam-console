/**
 * ฐานข้อมูลปลอมของ "สถานะซิงก์ทะเบียนสมาชิก" (ตาราง members_sync_state · migration 071)
 * วางซ้อนท้าย MOCK ของ desk-home3 — ตารางอื่นส่งต่อให้ชั้นก่อนหน้า
 *
 * ตัวจริงของ SQL ตรวจกับ Postgres จริงแยก (071: 36 ข้อ) — ที่นี่ตรวจเฉพาะฝั่งหน้าเว็บว่าอ่านแล้วบอกผู้ใช้ถูก
 * ตัวควบคุมจากเทสต์:
 *   MSYNC.set({ minsAgo, rows_seen, error_count, errors, duplicate_count, orphan_count, orphan_sample, customers_result })
 *     ตั้งแถวสถานะ (minsAgo = ซิงก์ล่าสุดกี่นาทีก่อน · null = ยังไม่เคยรัน)
 *   MSYNC.missing = true   ตาราง/มุมมองยังไม่มี (ยังไม่รัน 071) → PGRST205
 *   MSYNC.error = '...'    select ล้มด้วยข้อความดิบ
 *   MSYNC.gate = Promise   ค้างคำตอบ select ไว้จนกว่าจะ resolve (ทดสอบผลที่มาช้าหลังออกจากระบบ)
 *   MSYNC.reads            จำนวนครั้งที่ select ตาราง
 *   MSYNC.writes           จำนวนครั้งที่พยายามเขียนตรง ๆ (ต้องเป็น 0 เสมอ — เขียนได้เฉพาะฟังก์ชันของ Apps Script)
 */
export const MSYNC_MOCK = `<script>
const MSYNC = { row: null, missing: false, error: '', gate: null, reads: 0, writes: 0 };
(function () {
  MSYNC.set = o => {
    o = o || {};
    MSYNC.row = {
      id: true,
      last_run_at: o.minsAgo == null ? null : new Date(Date.now() - o.minsAgo * 60000).toISOString(),
      rows_seen: o.rows_seen == null ? 764 : o.rows_seen,
      inserted: 0, updated: 0, unchanged: 0,
      duplicate_count: o.duplicate_count || 0,
      error_count: o.error_count || 0,
      errors: o.errors || [],
      orphan_count: o.orphan_count || 0,
      orphan_sample: o.orphan_sample || [],
      customers_result: o.customers_result || null,
    };
  };
  MSYNC.reset = () => { MSYNC.row = null; MSYNC.missing = false; MSYNC.error = ''; MSYNC.gate = null; MSYNC.reads = 0; MSYNC.writes = 0; };
  const E = (m, code) => ({ data: null, error: { message: m, code: code || null } });
  function builder(c) {
    const q = { _write: false, _lim: 1e9 };
    q.select = () => q;
    q.limit = n => { q._lim = n; return q; };
    q.insert = q.update = q.delete = q.upsert = function () { q._write = true; return q; };
    async function run() {
      CALLS.push({ op: q._write ? 'write' : 'select', table: 'members_sync_state' });
      if (q._write) { MSYNC.writes++; return E('permission denied for table members_sync_state', '42501'); }
      MSYNC.reads++;
      const gate = MSYNC.gate;
      if (gate) await gate;
      if (MSYNC.missing) return E('Could not find the table \\'public.members_sync_state\\' in the schema cache', 'PGRST205');
      if (MSYNC.error) return E(MSYNC.error);
      return { data: MSYNC.row ? [JSON.parse(JSON.stringify(MSYNC.row))] : [], error: null };
    }
    q.then = (res, rej) => run().then(res, rej);
    return q;
  }
  const create = window.supabase.createClient;
  window.supabase.createClient = (u, k, o) => {
    const c = create(u, k, o), from = c.from;
    c.from = t => t === 'members_sync_state' ? builder(c) : from(t);
    return c;
  };
})();
</script>`;
