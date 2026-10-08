/**
 * ฐานข้อมูล + Storage + tus ปลอมของหมวด "โอนไฟล์" (transfer_files · transfer_tags · transfer_requests · transfer_events · ฟังก์ชัน transfer_* · ถัง internal-transfer — migration 049 + 050)
 * วางต่อท้าย MOCK ของ desk-home3 — จำลองกติกาของ 049/050 ที่หน้าเว็บต้องรับมือ (ตัวจริงตรวจกับ Postgres จริงแยกไว้: 076 + 122 ข้อ — ชุดนี้ตรวจฝั่งหน้าเว็บ):
 *   · ตารางอ่านได้อย่างเดียว (ทีมงานที่ยังใช้งาน) · insert/update/delete ตรง ๆ = permission denied · แถวไฟล์ที่เห็น: ready / deleted / expired
 *   · transfer_begin: กลุ่มไฟล์ตัดสินที่ฐาน · ออกพาธ <กลุ่ม>/<id>.<นามสกุล> · ไฟล์ว่าง/เกิน 1 GB ปฏิเสธ · Tag ต้องเป็นทีมงานที่ใช้งาน (ไม่ซ้ำ ไม่นับตัวเอง ≤ 30)
 *     p_keep: เจ้าของ/ผู้ดูแลเท่านั้น · ไฟล์ถาวรต้อง ≤ 500 MB และรวมทั้งร้านไม่เกิน 20 GB (ปฏิเสธก่อนอัปโหลด)
 *   · transfer_commit(p_id, p_thumb): คืนข้อความเตือน (ตั้งถาวรไม่ได้) หรือ null · รูปตัวอย่างที่ไม่ผ่านเกณฑ์ถูกทิ้ง ไม่ทำให้ล้ม
 *     เจ้าของ + keep = ตั้งถาวรทันที · ผู้ดูแล + keep = ยื่นคำขอ (เจ้าของอนุมัติ)
 *   · Storage upload / tus: อัปได้เฉพาะพาธที่ transfer_begin ออกให้ของตัวเอง · createSignedUrl: ต้องมีสิทธิ์อ่านที่ transfer_open ออกให้ (2 นาที)
 *     remove: ต้องมีสิทธิ์ลบที่ transfer_delete / transfer_sweep / transfer_request_decide ออกให้ (5 นาที) และแถวต้องตายแล้ว
 *   · transfer_open: ไฟล์ถาวรไม่หมดอายุ · ทำเครื่องหมาย "เปิดแล้ว" ให้คนที่ถูก Tag
 *   · transfer_delete: ไฟล์ปกติ = ผู้อัปโหลดหรือเจ้าของ · ไฟล์ถาวร = เจ้าของเท่านั้น · transfer_sweep: ครบ 30 วัน → expired (ไฟล์ถาวรไม่) + คำขอที่ค้างของไฟล์ตายถูก void
 *   · transfer_set_permanent (เจ้าของ) · transfer_request_keep / request_delete (ผู้ดูแล) · transfer_request_decide (เจ้าของ · ปฏิเสธต้องมีเหตุผล · ไฟล์ตายแล้ว = void)
 *     transfer_request_withdraw (ผู้ยื่น) · transfer_set_tags (ผู้อัปโหลด/เจ้าของ) · transfer_unseen_count / transfer_pending_count (ตัวเลขข้างเมนู)
 * ตัวควบคุมจากเทสต์: window.TRN.seed() ใส่ข้อมูลตั้งต้น · TRN.fail = { select, rpc_<ชื่อ>, upload, remove, sign } · TRN.missing (ยังไม่รัน 049) · TRN.v1 (รัน 049 แล้วแต่ยังไม่รัน 050) · TRN.v2 (รัน 050 แล้วแต่ยังไม่รัน 051 — ไม่มี folder_path/p_folder) · TRN.v3 (รัน 051 แล้วแต่ยังไม่รัน 052 — ไม่มีตาราง transfer_folders) · TRN.folders = ตัวหมายโฟลเดอร์ · TRN.noBucket
 *   TRN.gateSelect / TRN.gateUpload / TRN.gateTus = Promise ที่ค้างคำตอบ · TRN.tus = { mode: 'ok' | 'hang' | 'error:<สถานะ>', body } · TRN.tusCalls / tusHeaders / tusAborts = ร่องรอยของตัวอัปโหลดแบบต่อได้
 *   TRN.writes = ความพยายามเขียนตารางตรง ๆ · TRN.uploads / TRN.signed / TRN.removed = ร่องรอยฝั่ง Storage
 * ผู้ใช้ (ล็อกอินด้วยชื่อขึ้นต้น): tibass=เจ้าของ(u1) · zen/nutty=พนักงาน(u2/u3) · nui=ผู้ดูแล(u4) · evil=พนักงานชื่อมี HTML(u8) · ghost=พนักงานที่ถูกปิด(u7)
 */
export const TRANSFER_MOCK = `<script>
const TRN = { files: [], tags: [], reqs: [], events: [], grants: [], objects: new Map(), uploads: [], signed: [], removed: [], writes: [], fail: {}, missing: false, v1: false, v2: false, v3: false, folders: [], noBucket: false,
  gateSelect: null, gateUpload: null, gateTus: null, tus: { mode: 'ok', body: '' }, tusCalls: [], tusHeaders: [], tusAborts: [], main: null, seq: 0, tick: 0 };
(function () {
  FAKE.admins.push({ id: 'u4', full_name: 'Nui', role: 'admin', is_active: true }, { id: 'u7', full_name: 'Ghost', role: 'staff', is_active: false },
    { id: 'u8', full_name: 'Evil <i>Name</i>', role: 'staff', is_active: true });
  const DAY = 86400000, MB = 1048576, LIMIT = 1024 * MB, PERM_FILE = 500 * MB, PERM_POOL = 20 * 1024 * MB;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const iso = ms => new Date(ms).toISOString();
  const stamp = () => iso(Date.now() + (TRN.tick++));
  const active = id => FAKE.admins.find(a => a.id === id && a.is_active);
  const role = id => { const a = active(id); return a ? a.role : null; };
  const isOwner = id => role(id) === 'owner';
  const nameOf = id => (FAKE.admins.find(a => a.id === id) || {}).full_name;
  const E = (m, code) => ({ data: null, error: { message: m, code: code || null } });
  const OK = d => ({ data: d === undefined ? null : d, error: null });
  const NOAUTH = 'ไม่มีสิทธิ์ใช้งาน (ต้องเป็นทีมงานที่ยังใช้งานอยู่)';
  const THUMB_OK = /^data:image\\/(jpeg|png|webp);base64,[A-Za-z0-9+\\/]+=*$/;
  const EXT = { video: 'mp4 mov m4v avi mkv mpg mpeg wmv flv 3gp mts m2ts mxf', audio: 'mp3 wav aif aiff flac m4a aac ogg oga opus wma alac mid midi caf',
    photo: 'jpg jpeg png gif webp heic heif tif tiff bmp svg avif raw cr2 cr3 nef arw dng orf rw2', design: 'psd psb ai indd idml eps fig sketch xd afdesign afphoto kra',
    doc: 'pdf doc docx xls xlsx ppt pptx txt csv rtf md odt ods odp pages numbers key epub', archive: 'zip rar 7z tar gz tgz bz2 xz zst' };
  function classify(name, mime) {
    const m = /\\.([A-Za-z0-9]{1,10})$/.exec(name || ''), e = m ? m[1].toLowerCase() : '', t = String(mime || '').toLowerCase();
    if (e === 'webm') return t.indexOf('audio/') === 0 ? 'audio' : 'video';
    for (const k of Object.keys(EXT)) if (EXT[k].split(' ').indexOf(e) >= 0) return k;
    if (t.indexOf('video/') === 0) return 'video';
    if (t.indexOf('audio/') === 0) return 'audio';
    if (t.indexOf('image/') === 0) return 'photo';
    if (t === 'application/pdf' || t.indexOf('text/') === 0) return 'doc';
    if (t === 'application/zip') return 'archive';
    return 'other';
  }
  const ev = (f, kind, actor) => TRN.events.push({ id: ++TRN.seq, file_id: f.id, kind, actor_id: actor || null, created_at: stamp() });
  const grant = (me, path, purpose, ms) => TRN.grants.push({ admin_id: me, object_path: path, purpose, expires_at: Date.now() + ms });
  const hasGrant = (me, path, purpose) => TRN.grants.some(g => g.admin_id === me && g.object_path === path && g.expires_at > Date.now() && (!purpose || g.purpose === purpose));
  const find = id => TRN.files.find(f => f.id === id);
  const clone = o => JSON.parse(JSON.stringify(o));
  const alive = f => f.status === 'ready' && (f.is_permanent || Date.parse(f.expires_at) > Date.now());
  const sz = n => (n / MB).toFixed(1);
  function permCheck(size, exceptId) {
    if (size > PERM_FILE) return 'ไฟล์ถาวรต้องไม่เกิน 500 MB ต่อไฟล์ (ไฟล์นี้ ' + sz(size) + ' MB)';
    const used = TRN.files.filter(f => f.is_permanent && f.status === 'ready' && f.id !== exceptId).reduce((n, f) => n + f.size_bytes, 0);
    if (used + size > PERM_POOL) return 'พื้นที่ไฟล์ถาวรเต็ม (ใช้แล้ว ' + (used / 1073741824).toFixed(1) + ' GB จาก 20 GB) — ลบไฟล์ถาวรเก่าก่อน';
    return null;
  }
  function cleanTags(tags, self) {          // คืน { ids } หรือ { err }
    if (tags == null) return { ids: [] };
    const want = [...new Set(tags.filter(x => x && x !== self))];
    if (want.length > 30) return { err: 'Tag พนักงานได้ไม่เกิน 30 คนต่อไฟล์' };
    if (want.some(id => !active(id))) return { err: 'Tag ไม่ได้: มีพนักงานที่ไม่พบหรือถูกปิดการใช้งาน' };
    return { ids: want };
  }
  const voidReqs = (fileId, kind) => TRN.reqs.forEach(q => { if (q.file_id === fileId && q.status === 'pending' && (!kind || q.kind === kind)) { q.status = 'void'; q.decided_at = stamp(); } });
  const mkReq = (fileId, kind, by) => { const q = { id: 'q' + (++TRN.seq), file_id: fileId, kind, status: 'pending', requester_id: by, decided_by: null, decision_note: null, created_at: stamp(), decided_at: null }; TRN.reqs.push(q); return q; };

  TRN.seed = () => {
    TRN.files = []; TRN.tags = []; TRN.reqs = []; TRN.events = []; TRN.grants = []; TRN.objects = new Map(); TRN.uploads = []; TRN.signed = []; TRN.removed = []; TRN.writes = [];
    TRN.fail = {}; TRN.missing = false; TRN.v1 = false; TRN.v2 = false; TRN.v3 = false; TRN.folders = []; TRN.noBucket = false; TRN.gateSelect = null; TRN.gateUpload = null; TRN.gateTus = null; TRN.tus = { mode: 'ok', body: '' };
    TRN.tusCalls = []; TRN.tusHeaders = []; TRN.tusAborts = []; TRN.seq = 0; TRN.tick = 0;
    const add = (id, cat, name, by, daysLeft, extra) => {
      const f = Object.assign({ id, status: 'ready', category: cat, file_name: name, mime_type: null, size_bytes: 2 * MB, note: null, object_path: cat + '/' + id + '.bin', thumb: null, folder_path: null,
        is_permanent: false, permanent_at: null, permanent_by: null, keep_wanted: false,
        uploaded_by: by, created_at: iso(Date.now() - 5 * DAY), uploaded_at: iso(Date.now() - (30 - daysLeft) * DAY), expires_at: iso(Date.now() + daysLeft * DAY),
        deleted_at: null, deleted_by: null, purged_at: null }, extra || {});
      TRN.files.push(f); TRN.objects.set(f.object_path, { size: f.size_bytes }); ev(f, 'upload', by); return f;
    };
    TRN.add = add;                                   // เทสต์เติมไฟล์เองหลัง seed (เช่นไฟล์ในโฟลเดอร์ — extra.folder_path)
    add('f1', 'video', 'คลิปรีวิว FLX4.mp4', 'u2', 10, { size_bytes: 120 * MB, note: 'ตัดต่อรอบสุดท้าย' });
    add('f2', 'audio', 'mix-oct.wav', 'u3', 25);
    add('f3', 'photo', 'poster.png', 'u2', 2);
    add('f4', 'photo', 'logo.svg', 'u3', 20);
    add('f5', 'doc', 'memo.pdf', 'u1', 28, { size_bytes: 300 * 1024, is_permanent: true, permanent_at: iso(Date.now() - DAY), permanent_by: 'u1' });
    add('f6', 'archive', 'stems.zip', 'u4', 15);
    add('f7', 'design', 'banner.psd', 'u2', 12);
    add('f8', 'other', 'library.rbox', 'u3', 9);
    add('f9', 'video', '<img src=x onerror=window.XSS=1>.mp4', 'u8', 14, { note: '<b>หมายเหตุ</b><script>window.XSS=2<\\/script>' });
    // หมดอายุแล้วแต่ยังไม่ถูกกวาด (status ยัง ready) → หน้าต้องซ่อน
    add('fx', 'doc', 'old-expired.pdf', 'u2', -1);
    // ตายแล้ว (ไม่อยู่ในรายการ แต่ยังอยู่ในประวัติ)
    const d = add('fd', 'audio', 'deleted-by-zen.mp3', 'u2', 5); d.status = 'deleted'; d.deleted_at = iso(Date.now() - DAY); d.deleted_by = 'u2'; ev(d, 'delete', 'u2');
    const x = add('fe', 'photo', 'expired-photo.jpg', 'u3', -2); x.status = 'expired'; x.deleted_at = iso(Date.now() - DAY); ev(x, 'expire', null);
    ev(find('f1'), 'view', 'u3'); ev(find('f1'), 'download', 'u1'); ev(find('f5'), 'view', 'u2');
    // Tag: f1 ถึง Nutty (ยังไม่เปิด) กับ TiBass (เปิดแล้ว)
    TRN.tags.push({ file_id: 'f1', admin_id: 'u3', seen_at: null }, { file_id: 'f1', admin_id: 'u1', seen_at: iso(Date.now() - 3600000) });
    // คำขอที่รอเจ้าของ: Nui ขอเก็บถาวร stems.zip
    mkReq('f6', 'keep', 'u4'); ev(find('f6'), 'request_keep', 'u4');
  };
  TRN.seed();

  // ── ตาราง (อ่านอย่างเดียว) ──
  const VISIBLE = ['ready', 'deleted', 'expired'];
  function builder(c, table) {
    const me = c.session && c.session.user.id;
    const q = { _eq: [], _order: null, _from: 0, _to: 1e9, _write: false, _cols: '' };
    q.select = cols => { q._cols = String(cols || ''); return q; };
    q.eq = (k, v) => { q._eq.push([k, v]); return q; };
    q.order = (k, o) => { q._order = [k, o && o.ascending === false ? -1 : 1]; return q; };
    q.limit = n => { q._to = n - 1; return q; }; q.range = (a, b) => { q._from = a; q._to = b; return q; };
    q.insert = q.update = q.delete = q.upsert = function () { q._write = true; return q; };
    async function run() {
      if (q._write) { TRN.writes.push({ table }); return E('permission denied for table ' + table, '42501'); }
      CALLS.push({ op: 'select', table, where: q._eq.slice(), who: me, range: [q._from, q._to], cols: q._cols });
      if (TRN.gateSelect) await TRN.gateSelect;
      if (TRN.missing) return E('relation "public.' + table + '" does not exist', '42P01');
      if (TRN.v1 && table === 'transfer_requests') return E('relation "public.transfer_requests" does not exist', '42P01');
      if (TRN.v1 && table === 'transfer_files' && /thumb|is_permanent|transfer_tags/.test(q._cols)) return E('column transfer_files.thumb does not exist', '42703');
      if ((TRN.v1 || TRN.v2) && table === 'transfer_files' && /folder_path/.test(q._cols)) return E('column transfer_files.folder_path does not exist', '42703');      // ยังไม่รัน 051
      if (TRN.fail.select) return E(TRN.fail.select);
      if (!active(me)) return OK([]);
      if (table === 'transfer_folders' && (TRN.v1 || TRN.v2 || TRN.v3)) return E('Could not find the table \\'public.transfer_folders\\' in the schema cache', 'PGRST205');      // ยังไม่รัน 052
      let rows = table === 'transfer_files' ? TRN.files.filter(f => VISIBLE.indexOf(f.status) >= 0) : table === 'transfer_requests' ? TRN.reqs.slice() : table === 'transfer_folders' ? TRN.folders.filter(k => !k.deleted_at) : TRN.events.slice();
      q._eq.forEach(e => { rows = rows.filter(r => r[e[0]] === e[1]); });
      if (q._order) rows = rows.slice().sort((a, b) => (a[q._order[0]] < b[q._order[0]] ? -1 : a[q._order[0]] > b[q._order[0]] ? 1 : 0) * q._order[1]);
      rows = rows.slice(q._from, q._to + 1).map(r => {
        const o = clone(r);
        if (table === 'transfer_files') {
          if (TRN.v1 || TRN.v2) delete o.folder_path;
          if (TRN.v1) ['thumb', 'is_permanent', 'permanent_at', 'permanent_by', 'keep_wanted'].forEach(k => { delete o[k]; });      // ฐานที่ยังไม่รัน 050 ไม่มีคอลัมน์เหล่านี้
          o.uploader = r.uploaded_by ? { full_name: nameOf(r.uploaded_by) } : null;
          if (/transfer_tags/.test(q._cols)) o.tags = TRN.tags.filter(t => t.file_id === r.id).map(t => ({ admin_id: t.admin_id, seen_at: t.seen_at, who: { full_name: nameOf(t.admin_id) } }));
        } else if (table === 'transfer_folders') {
          o.creator = r.created_by ? { full_name: nameOf(r.created_by) } : null;
        } else if (table === 'transfer_requests') {
          const f = find(r.file_id);
          o.file = f ? { file_name: f.file_name, category: f.category, size_bytes: f.size_bytes, status: f.status, is_permanent: f.is_permanent, expires_at: f.expires_at } : null;
          o.requester = { full_name: nameOf(r.requester_id) }; o.decider = r.decided_by ? { full_name: nameOf(r.decided_by) } : null;
        } else {
          const f = find(r.file_id); o.file = f && VISIBLE.indexOf(f.status) >= 0 ? { file_name: f.file_name, category: f.category, size_bytes: f.size_bytes } : null; o.actor = r.actor_id ? { full_name: nameOf(r.actor_id) } : null;
        }
        return o;
      });
      return OK(rows);
    }
    q.then = (res, rej) => run().then(res, rej);
    return q;
  }

  // ── ฟังก์ชัน (สำเนาพฤติกรรมของ 049 + 050) ──
  const cleanFolder = p => {                          // สำเนา transfer_clean_folder ของ 051
    if (p == null) return { v: null };
    const segs = String(p).replace(/\\\\/g, '/').split('/').map(x => x.replace(/[\\u0000-\\u001f\\u007f]+/g, ' ').trim()).filter(x => x && x !== '.' && x !== '..').map(x => x.slice(0, 120));
    if (!segs.length) return { v: null };
    if (segs.length > 12) return { err: 'โฟลเดอร์ซ้อนลึกเกิน 12 ชั้น' };
    const j = segs.join('/');
    return j.length > 400 ? { err: 'ชื่อโฟลเดอร์ยาวเกิน 400 ตัวอักษร' } : { v: j };
  };
  const lc = x => String(x || '').toLowerCase();
  const markFolder = (me, path) => {                // สำเนา transfer_folder_mark ของ 052
    const fl = cleanFolder(path); if (fl.err) return { err: fl.err };
    if (fl.v == null) return { err: 'ชื่อโฟลเดอร์ไม่ถูกต้อง' };
    if (TRN.folders.some(k => !k.deleted_at && lc(k.path) === lc(fl.v))) return { v: fl.v, created: false };
    if (TRN.folders.filter(k => !k.deleted_at).length >= 2000) return { err: 'สร้างโฟลเดอร์ได้ไม่เกิน 2,000 โฟลเดอร์ — ลบโฟลเดอร์ที่ไม่ใช้ก่อน' };
    TRN.folders.push({ id: 'k' + (++TRN.seq), path: fl.v, created_by: me, created_at: stamp(), deleted_at: null, deleted_by: null });
    return { v: fl.v, created: true };
  };
  const RPC = {
    transfer_folder_create(me, a) {
      if (!role(me)) return E(NOAUTH, '42501');
      const r = markFolder(me, a.p_path); return r.err ? E(r.err) : OK(r.v);
    },
    transfer_folder_create_many(me, a) {
      if (!role(me)) return E(NOAUTH, '42501');
      const ps = a.p_paths || []; if (ps.length > 200) return E('สร้างโฟลเดอร์ได้ไม่เกิน 200 โฟลเดอร์ต่อครั้ง');
      let n = 0; for (const p of ps) { const r = markFolder(me, p); if (r.err) return E(r.err); if (r.created) n++; }
      return OK(n);
    },
    transfer_folder_delete(me, a) {
      const rl = role(me); if (!rl) return E(NOAUTH, '42501');
      const fl = cleanFolder(a.p_path); if (fl.err || fl.v == null) return E(fl.err || 'ชื่อโฟลเดอร์ไม่ถูกต้อง');
      const hit = TRN.folders.filter(k => !k.deleted_at && (lc(k.path) === lc(fl.v) || lc(k.path).indexOf(lc(fl.v) + '/') === 0));
      let del = 0; hit.forEach(k => { if (rl === 'owner' || k.created_by === me) { k.deleted_at = stamp(); k.deleted_by = me; del++; } });
      return OK([{ r_deleted: del, r_kept: hit.length - del }]);
    },
    transfer_begin(me, a) {
      const rl = role(me);
      if (!rl) return E(NOAUTH, '42501');
      let nm = String(a.p_file_name || '').replace(/^.*[\\\\/]/, '').replace(/[\\u0000-\\u001f\\u007f]+/g, ' ').trim().slice(0, 200);
      if (!nm) return E('ไฟล์ไม่มีชื่อ');
      if (!(a.p_size > 0)) return E('ไฟล์ว่างเปล่า (0 ไบต์)');
      if (TRN.noBucket) return E('ยังไม่มีถัง internal-transfer — รัน migration 049 ให้ครบก่อน');
      if (a.p_size > LIMIT) return E('ไฟล์ใหญ่เกิน 1.00 GB (ไฟล์นี้ ' + sz(a.p_size) + ' MB)');
      if (a.p_keep) {
        if (rl !== 'owner' && rl !== 'admin') return E('เก็บถาวรได้เฉพาะเจ้าของร้าน (ผู้ดูแลขออนุมัติได้) — พนักงานทั่วไปตั้งไม่ได้', '42501');
        const pe = permCheck(a.p_size); if (pe) return E(pe);
      }
      const fl = cleanFolder(a.p_folder); if (fl.err) return E(fl.err);
      const tg = cleanTags(a.p_tags, me); if (tg.err) return E(tg.err);
      const cat = classify(nm, a.p_mime), m = /\\.([A-Za-z0-9]{1,10})$/.exec(nm), id = 'n' + (++TRN.seq);
      const f = { id, status: 'pending', category: cat, file_name: nm, mime_type: a.p_mime || null, size_bytes: a.p_size, note: a.p_note ? String(a.p_note).trim().slice(0, 300) || null : null, thumb: null, folder_path: fl.v,
        is_permanent: false, permanent_at: null, permanent_by: null, keep_wanted: !!a.p_keep,
        object_path: cat + '/' + id + (m ? '.' + m[1].toLowerCase() : ''), uploaded_by: me, created_at: stamp(), uploaded_at: null, expires_at: null, deleted_at: null, deleted_by: null, purged_at: null };
      TRN.files.push(f);
      tg.ids.forEach(t => TRN.tags.push({ file_id: id, admin_id: t, seen_at: null }));
      return OK([{ r_id: id, r_path: f.object_path, r_category: cat }]);
    },
    transfer_commit(me, a) {
      const rl = role(me);
      if (!rl) return E(NOAUTH, '42501');
      const f = find(a.p_id);
      if (!f || f.status !== 'pending' || f.uploaded_by !== me) return E('ไม่พบรายการที่รออัปโหลด');
      const o = TRN.objects.get(f.object_path);
      if (!o) return E('ไม่พบไฟล์ในที่เก็บ — การอัปโหลดไม่สำเร็จ');
      Object.assign(f, { status: 'ready', size_bytes: o.size, uploaded_at: stamp(), expires_at: iso(Date.now() + 30 * DAY), thumb: a.p_thumb && THUMB_OK.test(a.p_thumb) && a.p_thumb.length <= 40000 ? a.p_thumb : null });
      ev(f, 'upload', me);
      let warn = null;
      if (f.keep_wanted) {
        if (rl === 'owner') {
          const pe = permCheck(o.size, f.id);
          if (pe) warn = 'อัปโหลดแล้ว แต่ตั้งถาวรไม่ได้: ' + pe + ' — ไฟล์นี้เก็บ 30 วันตามปกติ';
          else { Object.assign(f, { is_permanent: true, permanent_at: stamp(), permanent_by: me }); ev(f, 'pin', me); }
        } else if (rl === 'admin') { mkReq(f.id, 'keep', me); ev(f, 'request_keep', me); }
      }
      return OK(warn);
    },
    transfer_abort(me, a) {
      if (!active(me)) return E(NOAUTH, '42501');
      const f = find(a.p_id);
      if (f && f.status === 'pending' && f.uploaded_by === me) f.status = 'aborted';
      return OK();
    },
    transfer_open(me, a) {
      if (!active(me)) return E(NOAUTH, '42501');
      if (a.p_purpose !== 'view' && a.p_purpose !== 'download') return E('ชนิดการเปิดไม่ถูกต้อง');
      const f = find(a.p_id);
      if (!f || !alive(f)) return E('ไฟล์นี้เปิดไม่ได้แล้ว (ถูกลบ หรือครบ 30 วัน)');
      ev(f, a.p_purpose, me);
      TRN.tags.forEach(t => { if (t.file_id === f.id && t.admin_id === me && !t.seen_at) t.seen_at = stamp(); });
      grant(me, f.object_path, 'read', 120000);
      return OK([{ r_path: f.object_path, r_name: f.file_name, r_mime: f.mime_type, r_category: f.category }]);
    },
    transfer_delete(me, a) {
      if (!active(me)) return E(NOAUTH, '42501');
      const f = find(a.p_id);
      if (!f || f.status !== 'ready') return E('ไม่พบไฟล์นี้ หรือถูกลบไปแล้ว');
      if (f.is_permanent) { if (!isOwner(me)) return E('ไฟล์ถาวรลบได้เฉพาะเจ้าของร้าน — ผู้ดูแลกด "ขอลบ" เพื่อให้เจ้าของอนุมัติ', '42501'); }
      else if (f.uploaded_by !== me && !isOwner(me)) return E('ลบได้เฉพาะคนที่อัปโหลดไฟล์นี้ หรือเจ้าของร้านเท่านั้น', '42501');
      Object.assign(f, { status: 'deleted', deleted_at: stamp(), deleted_by: me, thumb: null });
      voidReqs(f.id);
      ev(f, 'delete', me); grant(me, f.object_path, 'remove', 300000);
      return OK(f.object_path);
    },
    transfer_sweep(me) {
      if (!active(me)) return E(NOAUTH, '42501');
      TRN.files.forEach(f => { if (f.status === 'ready' && !f.is_permanent && Date.parse(f.expires_at) <= Date.now()) { f.status = 'expired'; f.deleted_at = stamp(); f.thumb = null; ev(f, 'expire', null); } });
      TRN.files.forEach(f => { if (f.status === 'pending' && Date.parse(f.created_at) < Date.now() - 6 * 3600000) { f.status = 'aborted'; f.thumb = null; } });
      TRN.reqs.forEach(q => { const f = find(q.file_id); if (q.status === 'pending' && f && f.status !== 'ready') { q.status = 'void'; q.decided_at = stamp(); } });
      const pick = TRN.files.filter(f => ['deleted', 'expired', 'aborted'].indexOf(f.status) >= 0 && !f.purged_at).slice(0, 50);
      pick.forEach(f => grant(me, f.object_path, 'remove', 300000));
      return OK(pick.map(f => ({ r_id: f.id, r_path: f.object_path })));
    },
    transfer_mark_purged(me, a) {
      if (!active(me)) return E(NOAUTH, '42501');
      let n = 0;
      TRN.files.forEach(f => { if ((a.p_ids || []).indexOf(f.id) >= 0 && ['deleted', 'expired', 'aborted'].indexOf(f.status) >= 0 && !f.purged_at && !TRN.objects.has(f.object_path)) { f.purged_at = stamp(); n++; } });
      return OK(n);
    },
    transfer_set_tags(me, a) {
      if (!active(me)) return E(NOAUTH, '42501');
      const f = find(a.p_id);
      if (!f || f.status !== 'ready') return E('ไม่พบไฟล์นี้ หรือถูกลบไปแล้ว');
      if (f.uploaded_by !== me && !isOwner(me)) return E('แก้ Tag ได้เฉพาะคนที่อัปโหลดไฟล์นี้ หรือเจ้าของร้านเท่านั้น', '42501');
      const tg = cleanTags(a.p_tags, f.uploaded_by); if (tg.err) return E(tg.err);
      TRN.tags = TRN.tags.filter(t => t.file_id !== f.id || tg.ids.indexOf(t.admin_id) >= 0);
      tg.ids.forEach(id => { if (!TRN.tags.some(t => t.file_id === f.id && t.admin_id === id)) TRN.tags.push({ file_id: f.id, admin_id: id, seen_at: null }); });
      ev(f, 'tag', me);
      return OK();
    },
    transfer_set_permanent(me, a) {
      if (!isOwner(me)) return E('ตั้ง/ปลดไฟล์ถาวรได้เฉพาะเจ้าของร้าน', '42501');
      const f = find(a.p_id);
      if (!f || !alive(f)) return E('ไม่พบไฟล์นี้ หรือถูกลบ/หมดอายุไปแล้ว');
      if (a.p_on) {
        if (f.is_permanent) return OK();
        const pe = permCheck(f.size_bytes, f.id); if (pe) return E(pe);
        Object.assign(f, { is_permanent: true, permanent_at: stamp(), permanent_by: me });
        TRN.reqs.forEach(q => { if (q.file_id === f.id && q.kind === 'keep' && q.status === 'pending') Object.assign(q, { status: 'approved', decided_by: me, decided_at: stamp(), decision_note: 'เจ้าของตั้งถาวรเอง' }); });
        ev(f, 'pin', me);
      } else {
        if (!f.is_permanent) return OK();
        Object.assign(f, { is_permanent: false, permanent_at: null, permanent_by: null, expires_at: iso(Date.now() + 30 * DAY) });
        voidReqs(f.id, 'delete'); ev(f, 'unpin', me);
      }
      return OK();
    },
    transfer_request_keep(me, a) {
      if (role(me) !== 'admin') return E('ขอเก็บถาวรได้เฉพาะผู้ดูแล (เจ้าของตั้งถาวรได้เอง)', '42501');
      const f = find(a.p_id);
      if (!f || !alive(f) || f.is_permanent && false) return E('ไม่พบไฟล์นี้ หรือถูกลบ/หมดอายุไปแล้ว');
      if (f.uploaded_by !== me) return E('ขอเก็บถาวรได้เฉพาะไฟล์ที่ตัวเองอัปโหลด', '42501');
      if (f.is_permanent) return E('ไฟล์นี้เป็นไฟล์ถาวรอยู่แล้ว');
      if (f.size_bytes > PERM_FILE) return E('ไฟล์ถาวรต้องไม่เกิน 500 MB ต่อไฟล์ (ไฟล์นี้ ' + sz(f.size_bytes) + ' MB)');
      if (TRN.reqs.some(q => q.file_id === f.id && q.kind === 'keep' && q.status === 'pending')) return E('มีคำขอเก็บถาวรของไฟล์นี้รอเจ้าของตัดสินอยู่แล้ว');
      mkReq(f.id, 'keep', me); ev(f, 'request_keep', me);
      return OK();
    },
    transfer_request_delete(me, a) {
      if (role(me) !== 'admin') return E('ขอลบไฟล์ถาวรได้เฉพาะผู้ดูแล (เจ้าของลบได้เอง)', '42501');
      const f = find(a.p_id);
      if (!f || f.status !== 'ready') return E('ไม่พบไฟล์นี้ หรือถูกลบไปแล้ว');
      if (!f.is_permanent) return E('ขอลบได้เฉพาะไฟล์ถาวร — ไฟล์ปกติที่ตัวเองอัปโหลดลบได้เอง');
      if (TRN.reqs.some(q => q.file_id === f.id && q.kind === 'delete' && q.status === 'pending')) return E('มีคำขอลบไฟล์นี้รอเจ้าของตัดสินอยู่แล้ว');
      mkReq(f.id, 'delete', me); ev(f, 'request_delete', me);
      return OK();
    },
    transfer_request_decide(me, a) {
      if (!isOwner(me)) return E('ตัดสินคำขอได้เฉพาะเจ้าของร้าน', '42501');
      const q = TRN.reqs.find(x => x.id === a.p_request);
      if (!q) return E('ไม่พบคำขอนี้');
      if (q.status !== 'pending') return E('คำขอนี้ปิดไปแล้ว (' + q.status + ')');
      const f = find(q.file_id), note = String(a.p_note || '').trim().slice(0, 300) || null;
      if (f.status !== 'ready' || (q.kind === 'keep' && !f.is_permanent && Date.parse(f.expires_at) <= Date.now())) { q.status = 'void'; q.decided_at = stamp(); return OK([{ r_kind: 'void', r_path: null }]); }
      if (!a.p_approve) {
        if (!note) return E('ปฏิเสธต้องใส่เหตุผล');
        Object.assign(q, { status: 'rejected', decided_by: me, decided_at: stamp(), decision_note: note }); ev(f, 'reject', me);
        return OK([{ r_kind: q.kind, r_path: null }]);
      }
      if (q.kind === 'keep') {
        if (!f.is_permanent) { const pe = permCheck(f.size_bytes, f.id); if (pe) return E(pe); Object.assign(f, { is_permanent: true, permanent_at: stamp(), permanent_by: me }); ev(f, 'pin', me); }
        Object.assign(q, { status: 'approved', decided_by: me, decided_at: stamp(), decision_note: note });
        return OK([{ r_kind: 'keep', r_path: null }]);
      }
      Object.assign(f, { status: 'deleted', deleted_at: stamp(), deleted_by: me, thumb: null });
      Object.assign(q, { status: 'approved', decided_by: me, decided_at: stamp(), decision_note: note });
      voidReqs(f.id); ev(f, 'delete', me); grant(me, f.object_path, 'remove', 300000);
      return OK([{ r_kind: 'delete', r_path: f.object_path }]);
    },
    transfer_request_withdraw(me, a) {
      if (!active(me)) return E(NOAUTH, '42501');
      const q = TRN.reqs.find(x => x.id === a.p_request);
      if (!q || q.requester_id !== me) return E('ไม่พบคำขอนี้ หรือไม่ใช่คำขอของคุณ');
      if (q.status !== 'pending') return E('ถอนได้เฉพาะคำขอที่ยังรอตัดสิน (สถานะตอนนี้: ' + q.status + ')');
      Object.assign(q, { status: 'withdrawn', decided_at: stamp() }); ev(find(q.file_id), 'withdraw', me);
      return OK();
    },
    transfer_unseen_count(me) { return OK(!active(me) ? 0 : TRN.tags.filter(t => t.admin_id === me && !t.seen_at && alive(find(t.file_id))).length); },
    transfer_pending_count(me) { return OK(!isOwner(me) ? 0 : TRN.reqs.filter(q => q.status === 'pending' && find(q.file_id).status === 'ready').length); },
  };
  const V2_FN = ['transfer_set_tags', 'transfer_set_permanent', 'transfer_request_keep', 'transfer_request_delete', 'transfer_request_decide', 'transfer_request_withdraw', 'transfer_unseen_count', 'transfer_pending_count'];

  // ── ถัง internal-transfer (อัปโหลดธรรมดา + tus ใช้กติกาเดียวกัน) ──
  function putObject(me, path, file, type) {
    const f = TRN.files.find(x => x.object_path === path && x.status === 'pending' && x.uploaded_by === me);
    if (!f || !active(me)) return E('new row violates row-level security policy');
    if (TRN.objects.has(path)) return E('The resource already exists');
    if (file.size > LIMIT) return E('The object exceeded the maximum allowed size');
    TRN.objects.set(path, { size: file.size, type });
    return OK({ path });
  }
  const BUCKET = {
    async upload(c, path, file, opts) {
      const me = c.session && c.session.user.id;
      TRN.uploads.push({ path, size: file.size, type: opts && opts.contentType, upsert: !!(opts && opts.upsert), who: me });
      if (TRN.gateUpload) await TRN.gateUpload;
      if (TRN.noBucket) return E('Bucket not found');
      if (TRN.fail.upload) return E(TRN.fail.upload);
      return putObject(me, path, file, opts && opts.contentType);
    },
    async remove(c, paths) {
      const me = c.session && c.session.user.id;
      TRN.removed.push({ paths: paths.slice(), who: me });
      if (TRN.fail.remove) return E(TRN.fail.remove);
      const gone = paths.filter(p => { const f = TRN.files.find(x => x.object_path === p); return f && ['deleted', 'expired', 'aborted'].indexOf(f.status) >= 0 && hasGrant(me, p, 'remove') && TRN.objects.has(p); });
      gone.forEach(p => TRN.objects.delete(p));
      return OK(gone.map(name => ({ name })));
    },
    async createSignedUrl(c, path, secs, opts) {
      const me = c.session && c.session.user.id;
      TRN.signed.push({ path, secs, download: opts && opts.download, who: me });
      if (TRN.fail.sign || !active(me) || !hasGrant(me, path, 'read') || !TRN.objects.has(path)) return E('Object not found');
      return OK({ signedUrl: 'https://files.example/sign/' + path + '?token=t' + (opts && opts.download ? '&download=' + encodeURIComponent(opts.download) : '') });
    },
  };

  // ── tus-js-client ปลอม (ไม่ต้องโหลดจาก CDN) ──
  window.tus = { Upload: function (file, opts) {
    const self = this;
    self.file = file; self.opts = opts; self.aborted = false; self.started = false;
    TRN.tusCalls.push(self);
    self.start = function () {
      self.started = true;
      (async () => {
        const me = TRN.main && TRN.main.session && TRN.main.session.user.id;
        if (opts.onBeforeRequest) await opts.onBeforeRequest({ setHeader: (k, v) => TRN.tusHeaders.push([k, v]) });
        if (TRN.tus.mode === 'hang') return;
        const total = file.size;
        for (const frac of [0.25, 0.6, 1]) { await sleep(40); if (self.aborted) return; if (opts.onProgress) opts.onProgress(Math.floor(total * frac), total); }
        if (TRN.gateTus) await TRN.gateTus;
        if (self.aborted) return;
        if (TRN.tus.mode.indexOf('error:') === 0) { const st = Number(TRN.tus.mode.slice(6)); return opts.onError({ message: 'tus: unexpected response while creating upload', originalResponse: { getStatus: () => st, getBody: () => TRN.tus.body || '' } }); }
        const r = putObject(me, opts.metadata.objectName, file, opts.metadata.contentType);
        if (r.error) return opts.onError({ message: 'tus: unexpected response', originalResponse: { getStatus: () => 403, getBody: () => r.error.message } });
        opts.onSuccess();
      })();
    };
    self.abort = async function (del) { self.aborted = true; TRN.tusAborts.push({ del: !!del }); };
  } };

  const create = window.supabase.createClient;
  window.supabase.createClient = (u, k, o) => {
    const c = create(u, k, o), from = c.from, rpc = c.rpc;
    if (c.isMain) TRN.main = c;
    c.from = t => (t === 'transfer_files' || t === 'transfer_events' || t === 'transfer_requests' || t === 'transfer_folders') ? builder(c, t) : from(t);
    c.rpc = async (fn, args) => {
      if (!RPC[fn]) return rpc(fn, args);
      const me = c.session && c.session.user.id;
      CALLS.push({ op: 'rpc', fn, args, who: me, main: c.isMain });
      if (TRN.fail['rpc_' + fn]) return E(TRN.fail['rpc_' + fn]);
      if (TRN.missing) return E('Could not find the function public.' + fn + ' in the schema cache', 'PGRST202');
      const a = args || {};
      if (TRN.v1 && (V2_FN.indexOf(fn) >= 0 || (fn === 'transfer_begin' && ('p_tags' in a || 'p_keep' in a || 'p_folder' in a)) || (fn === 'transfer_commit' && 'p_thumb' in a))) {
        return E('Could not find the function public.' + fn + ' in the schema cache', 'PGRST202');
      }
      if ((TRN.v1 || TRN.v2 || TRN.v3) && /^transfer_folder_(create|create_many|delete)$/.test(fn)) return E('Could not find the function public.' + fn + ' in the schema cache', 'PGRST202');
      if (TRN.v2 && fn === 'transfer_begin' && 'p_folder' in a) return E('Could not find the function public.transfer_begin in the schema cache', 'PGRST202');
      return RPC[fn](me, a);
    };
    c.storage = { from: bucket => bucket === 'internal-transfer' ? {
      upload: (p, f, o) => BUCKET.upload(c, p, f, o),
      remove: ps => BUCKET.remove(c, ps),
      createSignedUrl: (p, s, o) => BUCKET.createSignedUrl(c, p, s, o),
    } : { upload: async () => E('Bucket not found'), remove: async () => E('Bucket not found'), createSignedUrl: async () => E('Bucket not found') } };
    return c;
  };
})();
</script>`;
