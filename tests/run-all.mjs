/**
 * รันเทสต์ทั้งหมดของรีโปนี้ — node tests/run-all.mjs
 *
 * ต้องมี Google Chrome ในเครื่อง เพราะทุกชุดเปิดหน้าเว็บจริงด้วย Chrome headless
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const suites = ['wedge-scanner.mjs', 'wedge-scanner-sales.mjs', 'desk.mjs', 'desk-modules.mjs', 'desk-staff.mjs', 'desk-home3.mjs', 'desk-home4.mjs', 'stock-wall.mjs', 'stock-phone.mjs', 'desk-batch5.mjs', 'desk-discord.mjs', 'desk-polish.mjs', 'desk-ipad.mjs', 'desk-iphone.mjs', 'desk-ops.mjs', 'desk-worklist.mjs', 'stocked.mjs', 'catalog.mjs', 'catalog-pdf.mjs', 'desk-timer.mjs', 'old-app-redirect.mjs', 'desk-sw.mjs', 'desk-notify.mjs', 'book.mjs', 'desk-webbooking.mjs', 'desk-register.mjs', 'desk-brands.mjs'];

let failed = 0;
for (const s of suites) {
  const r = spawnSync(process.execPath, [join(here, s)], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
console.log(failed ? `\nมี ${failed} ชุดที่ไม่ผ่าน` : '\nผ่านทุกชุด');
process.exit(failed ? 1 : 0);
