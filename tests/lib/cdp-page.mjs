/**
 * ตัวรันเทสต์แบบคุม Chrome ผ่าน DevTools Protocol — ใช้กับชุด iPad (tests/desk-ipad.mjs)
 *
 * ทำไมไม่ใช้ runPage (--dump-dom) อย่างชุดอื่น: เทสต์ iPad ต้อง "หมุนจอ" กลางเทสต์ (แนวตั้ง → แนวนอน)
 * ซึ่งหน้าเว็บเปลี่ยนขนาดจอตัวเองไม่ได้ และ iframe ใน headless ไม่ส่ง resize/ResizeObserver ให้ —
 * ต้องสั่งจากนอกหน้าเว็บด้วย Emulation.setDeviceMetricsOverride (ตัวเดียวกับโหมดอุปกรณ์ของ DevTools)
 *
 * ไฟล์ที่ถูกทดสอบยังเป็นของจริงทุกบรรทัด (writePatched ตัวเดียวกับ runPage — สลับแค่แท็ก Supabase)
 * หน้าเว็บคุยกับตัวรันผ่าน console:
 *   [WEDGE] ...           = ผลเทสต์ (รูปแบบเดียวกับชุดอื่น) · มี RESULT:PASS/FAIL = จบ
 *   [ROTATE] 1180x820     = เปลี่ยนขนาดจอ แล้วตัวรันเรียก window.__rotated()
 *   [SHOT] ชื่อไฟล์.png    = ถ่ายภาพหน้าจอลง shotDir (ถ้าให้มา) แล้วเรียก window.__shot()
 * ใช้ WebSocket ของ Node เอง (Node ≥ 22) ไม่ต้องลงแพ็กเกจเพิ่ม
 */

import { mkdtempSync, readFileSync, existsSync, writeFileSync, rmSync, readdirSync, copyFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CHROME, writePatched } from './page-test.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// coarse = จอสัมผัส: pointer: coarse + hover: none (ค่าเดียวกับ iPad ที่ไม่ได้ต่อแทร็กแพด)
// siblings = [{ file, mock, tests }] หน้าอื่นที่ต้องอยู่ข้างกัน ใช้ชื่อไฟล์จริง (เช่น desk.html) — ให้ทดสอบหน้าที่พากันไปมา (location.replace('teacher.html')) ด้วยการเปิดหน้าต่อกันจริง
export async function runCdpPage({ root, file, mock, tests, hash, width, height, coarse = true, shotDir = null, flags = [], siblings = [] }) {
  const target = writePatched({ root, file, mock, tests });
  if (!target) return { ran: false, ok: false, lines: [] };
  for (const s of siblings) {
    const t = writePatched({ root, file: s.file, mock: s.mock, tests: s.tests });
    if (!t) return { ran: false, ok: false, lines: [] };
    copyFileSync(t, join(dirname(target), s.file));
  }
  // โลโก้/ไอคอนของหน้า (ไฟล์ .png ที่รากรีโป) ไปไว้ข้างไฟล์ที่ทดสอบ — ภาพหน้าจอจะได้ไม่มีรูปแตก
  for (const f of readdirSync(root)) if (f.endsWith('.png')) copyFileSync(join(root, f), join(dirname(target), f));

  const profile = mkdtempSync(join(tmpdir(), 'djlab-cdp-'));
  const chrome = spawn(CHROME, [
    '--headless', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars',                        // แถบเลื่อนของ iPad ลอยทับ ไม่กินที่ — ให้วัดความกว้างได้ตรงกับเครื่องจริง
    '--remote-debugging-port=0', '--user-data-dir=' + profile,
    ...(coarse ? ['--touch-events=enabled',
      '--blink-settings=primaryPointerType=2,availablePointerTypes=2,primaryHoverType=1,availableHoverTypes=1'] : []),
    ...flags, 'about:blank',
  ], { stdio: 'ignore' });

  const lines = [], errors = [];
  let ws = null, done = false;
  try {
    // Chrome เขียนพอร์ตที่สุ่มได้ลงไฟล์นี้เมื่อพร้อม
    const portFile = join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 200 && !existsSync(portFile); i++) await sleep(50);
    const [port] = readFileSync(portFile, 'utf8').split('\n');
    const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    const page = list.find(t => t.type === 'page');
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    let seq = 0;
    const pending = new Map();
    const send = (method, params = {}) => new Promise((res, rej) => {
      const id = ++seq;
      pending.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const metrics = (w, h) => send('Emulation.setDeviceMetricsOverride', {
      width: w, height: h, deviceScaleFactor: 1, mobile: false,
      screenOrientation: w > h ? { type: 'landscapePrimary', angle: 90 } : { type: 'portraitPrimary', angle: 0 },
    });
    let finish;
    const finished = new Promise(r => { finish = r; });

    ws.onmessage = async ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id); pending.delete(m.id);
        if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result);
        return;
      }
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails;
        const msg = 'Uncaught ' + ((d.exception && d.exception.description) || d.text);
        errors.push(msg);
        if (/SyntaxError/.test(msg)) finish();     // สคริปต์ทั้งก้อนไม่ได้รัน — ไม่ต้องรอจนหมดเวลา
        return;
      }
      if (m.method !== 'Runtime.consoleAPICalled') return;
      const text = m.params.args.map(a => a.value !== undefined ? String(a.value) : (a.description || '')).join(' ');
      if (text.startsWith('[WEDGE] ')) {
        const t = text.slice(8);
        lines.push(t);
        console.log('  ' + t);
        if (t.includes('RESULT:')) { done = true; finish(); }
      } else if (text.startsWith('[ROTATE] ')) {
        const [w, h] = text.slice(9).split('x').map(Number);
        await metrics(w, h);
        await send('Runtime.evaluate', { expression: 'window.__rotated && window.__rotated()' });
      } else if (text.startsWith('[SHOT] ')) {
        if (shotDir) {
          const r = await send('Page.captureScreenshot', { format: 'png' });
          writeFileSync(join(shotDir, text.slice(7).trim()), Buffer.from(r.data, 'base64'));
        }
        await send('Runtime.evaluate', { expression: 'window.__shot && window.__shot()' });
      }
    };

    await send('Runtime.enable');
    await send('Page.enable');
    await metrics(width, height);
    if (coarse) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Page.navigate', { url: pathToFileURL(target).href + (hash || '') });
    await Promise.race([finished, sleep(240000)]);
    if (!done) console.log('  เทสต์ไม่ได้รันจนจบภายใน 4 นาที — นับว่าไม่ผ่าน');
  } catch (e) {
    console.log('  คุม Chrome ไม่สำเร็จ: ' + e.message);
  } finally {
    try { ws && ws.close(); } catch (e) { /* ปิดไปแล้ว */ }
    chrome.kill();
    await sleep(300);
    try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* Chrome ยังถือไฟล์อยู่ — โฟลเดอร์ชั่วคราว ปล่อยไว้ได้ */ }
  }
  if (errors.length) {
    console.log('\n  มี error ในหน้าเว็บ:');
    errors.slice(0, 5).forEach(l => console.log('    ' + l));
  }
  const ok = done && lines.some(l => l.includes('RESULT:PASS')) && !errors.length;
  return { ran: done, ok, lines };
}
