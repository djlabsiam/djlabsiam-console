/**
 * ฐานข้อมูล + Storage ปลอมของหมวด "โอนไฟล์" (transfer_files · transfer_events · ฟังก์ชัน transfer_* · ถัง internal-transfer — migration 049)
 * วางต่อท้าย MOCK ของ desk-home3 — จำลองกติกาของ 049 ที่หน้าเว็บต้องรับมือ (ตัวจริงตรวจกับ Postgres จริงแยกไว้ที่ชุดเทสต์ SQL ของ 049):
 *   · ตารางอ่านได้อย่างเดียว (ทีมงานที่ยังใช้งาน) · insert/update/delete ตรง ๆ = permission denied · แถวที่เห็น: ready / deleted / expired
 *   · transfer_begin: กลุ่มไฟล์ตัดสินที่ฐาน (นามสกุลก่อน แล้ว mime) · ออกพาธ <กลุ่ม>/<id>.<นามสกุล> · ไฟล์ว่าง/ใหญ่เกินปฏิเสธ
 *   · Storage upload: อัปได้เฉพาะพาธที่ transfer_begin ออกให้ของตัวเอง (pending) · createSignedUrl: ต้องมีสิทธิ์อ่านที่ transfer_open ออกให้ (2 นาที)
 *     remove: ต้องมีสิทธิ์ลบที่ transfer_delete / transfer_sweep ออกให้ (5 นาที) และแถวต้องตายแล้ว (deleted/expired/aborted)
 *   · transfer_delete: เฉพาะผู้อัปโหลดหรือเจ้าของ (role owner) — ผู้ดูแล (admin) ลบของคนอื่นไม่ได้ · transfer_sweep: ครบ 30 วัน → expired + ประวัติ "ระบบ"
 * ตัวควบคุมจากเทสต์: window.TRN.seed() ใส่ข้อมูลตั้งต้น · TRN.fail = { select, rpc_<ชื่อ>, upload, remove, sign } · TRN.missing (ยังไม่รัน 049) · TRN.noBucket
 *   TRN.gateSelect / TRN.gateUpload = Promise ที่ค้างคำตอบ · TRN.writes = ความพยายามเขียนตารางตรง ๆ · TRN.uploads / TRN.signed / TRN.removed = ร่องรอยฝั่ง Storage
 * ผู้ใช้ (ล็อกอินด้วยชื่อขึ้นต้น): tibass=เจ้าของ(u1) · zen/nutty=พนักงาน(u2/u3) · nui=ผู้ดูแล(u4) · evil=พนักงานชื่อมี HTML(u8) · ghost=พนักงานที่ถูกปิด(u7)
 */
export const TRANSFER_MOCK = `<script>
const TRN = { files: [], events: [], grants: [], objects: new Map(), uploads: [], signed: [], removed: [], writes: [], fail: {}, missing: false, noBucket: false, gateSelect: null, gateUpload: null, seq: 0, tick: 0 };
(function () {
  FAKE.admins.push({ id: 'u4', full_name: 'Nui', role: 'admin', is_active: true }, { id: 'u7', full_name: 'Ghost', role: 'staff', is_active: false },
    { id: 'u8', full_name: 'Evil <i>Name</i>', role: 'staff', is_active: true });
  const DAY = 86400000, MB = 1048576, LIMIT = 500 * MB;
  const iso = ms => new Date(ms).toISOString();
  const stamp = () => iso(Date.now() + (TRN.tick++));
  const active = id => FAKE.admins.find(a => a.id === id && a.is_active);
  const isOwner = id => { const a = active(id); return !!a && a.role === 'owner'; };
  const nameOf = id => (FAKE.admins.find(a => a.id === id) || {}).full_name;
  const E = (m, code) => ({ data: null, error: { message: m, code: code || null } });
  const OK = d => ({ data: d === undefined ? null : d, error: null });
  const NOAUTH = 'ไม่มีสิทธิ์ใช้งาน (ต้องเป็นทีมงานที่ยังใช้งานอยู่)';
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

  TRN.seed = () => {
    TRN.files = []; TRN.events = []; TRN.grants = []; TRN.objects = new Map(); TRN.uploads = []; TRN.signed = []; TRN.removed = []; TRN.writes = [];
    TRN.fail = {}; TRN.missing = false; TRN.noBucket = false; TRN.gateSelect = null; TRN.gateUpload = null; TRN.seq = 0; TRN.tick = 0;
    const add = (id, cat, name, by, daysLeft, extra) => {
      const f = Object.assign({ id, status: 'ready', category: cat, file_name: name, mime_type: null, size_bytes: 2 * MB, note: null, object_path: cat + '/' + id + '.bin',
        uploaded_by: by, created_at: iso(Date.now() - 5 * DAY), uploaded_at: iso(Date.now() - (30 - daysLeft) * DAY), expires_at: iso(Date.now() + daysLeft * DAY),
        deleted_at: null, deleted_by: null, purged_at: null }, extra || {});
      TRN.files.push(f); TRN.objects.set(f.object_path, { size: f.size_bytes }); ev(f, 'upload', by); return f;
    };
    add('f1', 'video', 'คลิปรีวิว FLX4.mp4', 'u2', 10, { size_bytes: 120 * MB, note: 'ตัดต่อรอบสุดท้าย' });
    add('f2', 'audio', 'mix-oct.wav', 'u3', 25);
    add('f3', 'photo', 'poster.png', 'u2', 2);
    add('f4', 'photo', 'logo.svg', 'u3', 20);
    add('f5', 'doc', 'memo.pdf', 'u1', 28, { size_bytes: 300 * 1024 });
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
  };
  TRN.seed();

  // ── ตาราง (อ่านอย่างเดียว) ──
  const VISIBLE = ['ready', 'deleted', 'expired'];
  function builder(c, table) {
    const me = c.session && c.session.user.id;
    const q = { _eq: [], _order: null, _from: 0, _to: 1e9, _write: false };
    q.select = () => q; q.eq = (k, v) => { q._eq.push([k, v]); return q; };
    q.order = (k, o) => { q._order = [k, o && o.ascending === false ? -1 : 1]; return q; };
    q.limit = n => { q._to = n - 1; return q; }; q.range = (a, b) => { q._from = a; q._to = b; return q; };
    q.insert = q.update = q.delete = q.upsert = function () { q._write = true; return q; };
    async function run() {
      if (q._write) { TRN.writes.push({ table }); return E('permission denied for table ' + table, '42501'); }
      CALLS.push({ op: 'select', table, where: q._eq.slice(), who: me, range: [q._from, q._to] });
      if (TRN.gateSelect) await TRN.gateSelect;
      if (TRN.missing) return E('relation "public.' + table + '" does not exist', '42P01');
      if (TRN.fail.select) return E(TRN.fail.select);
      if (!active(me)) return OK([]);
      let rows = table === 'transfer_files' ? TRN.files.filter(f => VISIBLE.indexOf(f.status) >= 0) : TRN.events.slice();
      q._eq.forEach(e => { rows = rows.filter(r => r[e[0]] === e[1]); });
      if (q._order) rows = rows.slice().sort((a, b) => (a[q._order[0]] < b[q._order[0]] ? -1 : a[q._order[0]] > b[q._order[0]] ? 1 : 0) * q._order[1]);
      rows = rows.slice(q._from, q._to + 1).map(r => {
        const o = clone(r);
        if (table === 'transfer_files') o.uploader = r.uploaded_by ? { full_name: nameOf(r.uploaded_by) } : null;
        else { const f = find(r.file_id); o.file = f && VISIBLE.indexOf(f.status) >= 0 ? { file_name: f.file_name, category: f.category, size_bytes: f.size_bytes } : null; o.actor = r.actor_id ? { full_name: nameOf(r.actor_id) } : null; }
        return o;
      });
      return OK(rows);
    }
    q.then = (res, rej) => run().then(res, rej);
    return q;
  }

  // ── ฟังก์ชัน (สำเนาพฤติกรรมของ 049) ──
  const RPC = {
    transfer_begin(me, a) {
      if (!active(me)) return E(NOAUTH, '42501');
      let nm = String(a.p_file_name || '').replace(/^.*[\\\\/]/, '').replace(/[\\u0000-\\u001f\\u007f]+/g, ' ').trim().slice(0, 200);
      if (!nm) return E('ไฟล์ไม่มีชื่อ');
      if (!(a.p_size > 0)) return E('ไฟล์ว่างเปล่า (0 ไบต์)');
      if (TRN.noBucket) return E('ยังไม่มีถัง internal-transfer — รัน migration 049 ให้ครบก่อน');
      if (a.p_size > LIMIT) return E('ไฟล์ใหญ่เกิน 500 MB (ไฟล์นี้ ' + (a.p_size / MB).toFixed(1) + ' MB)');
      const cat = classify(nm, a.p_mime), m = /\\.([A-Za-z0-9]{1,10})$/.exec(nm), id = 'n' + (++TRN.seq);
      const f = { id, status: 'pending', category: cat, file_name: nm, mime_type: a.p_mime || null, size_bytes: a.p_size, note: a.p_note ? String(a.p_note).trim().slice(0, 300) || null : null,
        object_path: cat + '/' + id + (m ? '.' + m[1].toLowerCase() : ''), uploaded_by: me, created_at: stamp(), uploaded_at: null, expires_at: null, deleted_at: null, deleted_by: null, purged_at: null };
      TRN.files.push(f);
      return OK([{ r_id: id, r_path: f.object_path, r_category: cat }]);
    },
    transfer_commit(me, a) {
      if (!active(me)) return E(NOAUTH, '42501');
      const f = find(a.p_id);
      if (!f || f.status !== 'pending' || f.uploaded_by !== me) return E('ไม่พบรายการที่รออัปโหลด');
      const o = TRN.objects.get(f.object_path);
      if (!o) return E('ไม่พบไฟล์ในที่เก็บ — การอัปโหลดไม่สำเร็จ');
      Object.assign(f, { status: 'ready', size_bytes: o.size, uploaded_at: stamp(), expires_at: iso(Date.now() + 30 * DAY) });
      ev(f, 'upload', me);
      return OK();
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
      if (!f || f.status !== 'ready' || Date.parse(f.expires_at) <= Date.now()) return E('ไฟล์นี้เปิดไม่ได้แล้ว (ถูกลบ หรือครบ 30 วัน)');
      ev(f, a.p_purpose, me); grant(me, f.object_path, 'read', 120000);
      return OK([{ r_path: f.object_path, r_name: f.file_name, r_mime: f.mime_type, r_category: f.category }]);
    },
    transfer_delete(me, a) {
      if (!active(me)) return E(NOAUTH, '42501');
      const f = find(a.p_id);
      if (!f || f.status !== 'ready') return E('ไม่พบไฟล์นี้ หรือถูกลบไปแล้ว');
      if (f.uploaded_by !== me && !isOwner(me)) return E('ลบได้เฉพาะคนที่อัปโหลดไฟล์นี้ หรือเจ้าของร้านเท่านั้น', '42501');
      Object.assign(f, { status: 'deleted', deleted_at: stamp(), deleted_by: me });
      ev(f, 'delete', me); grant(me, f.object_path, 'remove', 300000);
      return OK(f.object_path);
    },
    transfer_sweep(me) {
      if (!active(me)) return E(NOAUTH, '42501');
      TRN.files.forEach(f => { if (f.status === 'ready' && Date.parse(f.expires_at) <= Date.now()) { f.status = 'expired'; f.deleted_at = stamp(); ev(f, 'expire', null); } });
      TRN.files.forEach(f => { if (f.status === 'pending' && Date.parse(f.created_at) < Date.now() - 6 * 3600000) f.status = 'aborted'; });
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
  };

  // ── ถัง internal-transfer ──
  const BUCKET = {
    async upload(c, path, file, opts) {
      const me = c.session && c.session.user.id;
      TRN.uploads.push({ path, size: file.size, type: opts && opts.contentType, upsert: !!(opts && opts.upsert), who: me });
      if (TRN.gateUpload) await TRN.gateUpload;
      if (TRN.noBucket) return E('Bucket not found');
      if (TRN.fail.upload) return E(TRN.fail.upload);
      const f = TRN.files.find(x => x.object_path === path && x.status === 'pending' && x.uploaded_by === me);
      if (!f || !active(me)) return E('new row violates row-level security policy');
      if (TRN.objects.has(path)) return E('The resource already exists');
      TRN.objects.set(path, { size: file.size, type: opts && opts.contentType });
      return OK({ path });
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

  const create = window.supabase.createClient;
  window.supabase.createClient = (u, k, o) => {
    const c = create(u, k, o), from = c.from, rpc = c.rpc;
    c.from = t => (t === 'transfer_files' || t === 'transfer_events') ? builder(c, t) : from(t);
    c.rpc = async (fn, args) => {
      if (!RPC[fn]) return rpc(fn, args);
      const me = c.session && c.session.user.id;
      CALLS.push({ op: 'rpc', fn, args, who: me, main: c.isMain });
      if (TRN.fail['rpc_' + fn]) return E(TRN.fail['rpc_' + fn]);
      if (TRN.missing) return E('Could not find the function public.' + fn + ' in the schema cache', 'PGRST202');
      return RPC[fn](me, args || {});
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
