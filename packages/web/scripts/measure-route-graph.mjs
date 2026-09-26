/**
 * Đo load graph THẬT của route trên `dist/` sau khi build.
 *
 * Vì sao cần đo thay vì đọc log build: `manualChunks` chỉ TÁCH file, không
 * ngăn trình duyệt tải. Import tĩnh vẫn khiến Vite phát `modulepreload` cho
 * chunk đó. Nên "đã tách chunk" ≠ "không tải". Cách duy nhất biết chắc là BFS
 * từ entry của route theo cạnh import thật trong code đã build.
 *
 * Cách chạy: node scripts/measure-route-graph.mjs <route-entry-substring>
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const DIST = resolve('dist');
const ASSETS = join(DIST, 'assets');

function listJs(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listJs(full));
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = listJs(ASSETS);
const byBase = new Map();
for (const f of files) byBase.set(f.split(/[\\/]/).pop(), f);

/** Trích dependency TĨNH. `import()` động bị loại có chủ đích — xem giải thích dưới. */
function staticDepsOf(absFile) {
  const src = readFileSync(absFile, 'utf8');
  const found = new Set();
  // `from "x"` và `import "x"` là EAGER: luôn nằm trong module graph tải lần đầu.
  const patterns = [
    /\bfrom\s*["'](\.\.?\/[^"']+)["']/g,
    /\bimport\s*["'](\.\.?\/[^"']+)["']/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(src))) {
      const target = resolve(dirname(absFile), m[1]);
      if (existsSync(target) && target.endsWith('.js')) found.add(target);
      else if (existsSync(target + '.js')) found.add(target + '.js');
    }
  }
  return [...found];
}

/** Trích dependency ĐỘNG — chỉ tải khi thật sự gọi tới, KHÔNG thuộc tải lần đầu. */
function dynamicDepsOf(absFile) {
  const src = readFileSync(absFile, 'utf8');
  const found = new Set();
  const re = /import\s*\(\s*["'](\.\.?\/[^"']+)["']\s*\)/g;
  let m;
  while ((m = re.exec(src))) {
    const target = resolve(dirname(absFile), m[1]);
    const hit = existsSync(target) && target.endsWith('.js') ? target
      : existsSync(target + '.js') ? target + '.js' : null;
    if (hit) found.add(hit);
  }
  return [...found];
}

const target = process.argv[2] || 'WhaleAdvisoryPage';
const entry = files.find((f) => f.includes(target));
if (!entry) {
  console.error(`KHONG TIM THAY entry: ${target}`);
  console.error('Ung vien:', files.filter((f) => f.includes(target.slice(0, 6))).map((f) => f.split(/[\\/]/).pop()));
  process.exit(1);
}

/*
 * BFS từ entry của route, CHỈ theo cạnh import tĩnh.
 *
 * Bản đầu tiên của script này cảm ơn `import()` động vào cùng đồ thị, nên nó
 * báo 94 chunk / 6,1 MB và kéo theo `ScreenerPage`, `ShellOperationsCenterPage`
 * — những route mà người dùng CHƯA mở. Đó là đo sai, không phải bundle nặng.
 * Đó cũng chính là lý do `manualChunks` không đồng nghĩa với "không tải":
 * tách file chỉ có tác dụng nếu cạnh vào nó là `import()` động.
 */
function bfs(root, edgeFn) {
  const seen = new Set([root]);
  const queue = [root];
  while (queue.length) {
    const cur = queue.shift();
    for (const d of edgeFn(cur)) {
      if (!seen.has(d)) { seen.add(d); queue.push(d); }
    }
  }
  return seen;
}

const initial = bfs(entry, staticDepsOf);
const lazy = bfs(entry, dynamicDepsOf);

let total = 0;
const rows = [...initial]
  .map((f) => ({ name: f.split(/[\\/]/).pop(), size: statSync(f).size }))
  .sort((a, b) => b.size - a.size);
for (const r of rows) total += r.size;

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log(`\n=== TAI LAN DAU khi mo route "${target}" ===`);
console.log(`${initial.size} chunk, tong ${kb(total)} (KHONG gzip)\n`);
for (const r of rows.slice(0, 10)) console.log(`  ${kb(r.size).padStart(10)}  ${r.name}`);

const lazyRows = [...lazy]
  .filter((f) => !initial.has(f))
  .map((f) => ({ name: f.split(/[\\/]/).pop(), size: statSync(f).size }))
  .sort((a, b) => b.size - a.size);
console.log(`\n=== CHI TAI KHI CAN (import() dong) — KHONG tinh vao tai dau ===`);
console.log(`${lazyRows.length} chunk\n`);
for (const r of lazyRows.slice(0, 6)) console.log(`  ${kb(r.size).padStart(10)}  ${r.name}`);

const heavy = rows.filter((r) => /echarts|xlsx|widget|recharts|zod|lodash|moment/i.test(r.name));
console.log('\n=== CHUNK NANG BI KEOM TRONG TAI DAU ===');
if (!heavy.length) console.log('  (khong co)');
for (const r of heavy) console.log(`  ${kb(r.size).padStart(10)}  ${r.name}`);

const echartsInInitial = rows.filter((r) => /echarts|xlsx/i.test(r.name));
console.log(`\nKET LUAN: ${echartsInInitial.length ? 'CO' : 'KHONG CO'} echarts/xlsx trong tai dau cua route.`);
if (echartsInInitial.length) {
  console.log('  -> Se tim cach tiet kiem bang cach cat import TINH (manualChunks khong du).');
}
