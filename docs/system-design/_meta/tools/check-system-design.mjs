#!/usr/bin/env node
/**
 * check-system-design.mjs — cổng giữ bộ hồ sơ đúng với code.
 * ---------------------------------------------------------------------------
 * MỤC ĐÍCH
 *   5 kiểm tra trên `docs/system-design/`: (1) danh mục cây tài liệu khớp
 *   `inventory.json`, (2) liên kết tương đối không chết, (3) citation
 *   `path:line` tồn tại + nằm trong bounds, (4) không trùng chủ đề,
 *   (5) tuyên bố viết tay trong `claims.json` khớp số đo từ code.
 *
 *   Port có chọn lọc từ `vninvestcharts-widget` (check-doc-links,
 *   check-duplicate-topics — giữ cả self-test chứng minh gate BẮT được lỗi)
 *   + `vnsaas` (sổ claims đối chiếu). Adapt cho Django/Python + quy mô vninvest:
 *   thêm họ `.py`, gốc resolve BE (`packages/core/backend/src`), bỏ gốc engine.
 *
 * CÁCH CHẠY (từ gốc repo)
 *   node docs/system-design/_meta/tools/check-system-design.mjs --check
 *   node docs/system-design/_meta/tools/check-system-design.mjs --write
 *   node docs/system-design/_meta/tools/check-system-design.mjs --self-test
 *
 * NGUYÊN TẮC
 *   - Chỉ ĐỌC ở --check/--self-test. --write chỉ ghi 2 file máy sinh
 *     (`inventory.json`, `freshness-report.md`), không sửa tài liệu viết tay.
 *   - Exit 0 = sạch, 1 = có drift, 2 = không verify được.
 *   - So sánh NỘI DUNG (chuẩn hóa CRLF, bỏ BOM, token thời gian), không so byte.
 *   - `_meta/` là vùng máy sinh, ra khỏi vòng quét tài liệu viết tay (có vòng so
 *     riêng cho `inventory.json` và `freshness-report.md`).
 *
 * GIỚI HẠN ĐÃ BIẾT
 *   - Chỉ bắt trùng TÊN/TIÊU ĐỀ, không bắt trùng nội dung.
 *   - Chỉ bắt tuyên bố ĐÃ KHAI trong claims.json.
 *   - Số biến động nhanh (routes, web files, tổng docs) chỉ hiển thị ở bảng
 *     VOLATILE, không chặn (xem 00.03 §7).
 */

import {
  readFileSync, readdirSync, existsSync, writeFileSync,
  mkdtempSync, mkdirSync, rmSync,
} from 'node:fs';
import { join, relative, resolve, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const ROOT = process.cwd();
const ARGS = process.argv.slice(2);
const SELF_TEST = ARGS.includes('--self-test');
const DO_WRITE = ARGS.includes('--check') ? false : ARGS.includes('--write');

let SD = join(ROOT, 'docs', 'system-design');
{
  const i = ARGS.indexOf('--dir');
  if (i >= 0 && ARGS[i + 1]) SD = resolve(ARGS[i + 1]);
}
const META = join(SD, '_meta');
const SRC = join(ROOT, 'packages', 'core', 'backend', 'src');

const rel = (p) => {
  const r = relative(ROOT, p).split(/[\\/]/).join('/');
  if (r.startsWith('..')) return relative(SD, p).split(/[\\/]/).join('/');
  return r;
};
const norm = (t) => t.replace(/\r\n/g, '\n').replace(/^﻿/, '');
const BT = String.fromCharCode(96);

/* ------------------------------------------------------------- scanutils */

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', 'coverage', '.git', '.venv', '.next',
  '.opencode', '__pycache__', '.pytest_cache',
]);

function walk(dir, exts = null, skipMeta = false) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    if (skipMeta && e.isDirectory() && e.name === '_meta') continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, exts, skipMeta));
    else if (!exts || exts.some((x) => e.name.endsWith(x))) out.push(full);
  }
  return out;
}

function lineCount(abs) {
  try {
    return norm(readFileSync(abs, 'utf8')).split('\n').length;
  } catch {
    return 0;
  }
}

/* ----------------------------------------------------------------- facts */
// Định nghĩa đếm COPY từ docs/architecture/tools/measure_repo.py (không phát
// minh lại): apps = thư mục có models.py/apps.py/migrations/0*.py, trừ
// vninvest_core và _*; models = ^class ... models.Model; migrations =
// migrations/0*.py; compose = root + 3 packages; beat = key 4-space trong
// CELERY_BEAT_SCHEDULE.

const FACTS = {
  djangoApps() {
    let n = 0;
    let entries;
    try {
      entries = readdirSync(SRC, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('_') || e.name === 'vninvest_core') continue;
      const d = join(SRC, e.name);
      if (
        existsSync(join(d, 'models.py')) || existsSync(join(d, 'apps.py')) ||
        walk(join(d, 'migrations'), ['.py']).some((f) => /^0/.test(basename(f)))
      ) n += 1;
    }
    return n;
  },
  models() {
    let total = 0;
    const re = /^class\s+\w+\([^)]*models\.Model/gm;
    for (const f of walk(SRC, ['models.py'])) {
      const r = relative(SRC, f).split(/[\\/]/).join('/');
      if (r.startsWith('vninvest_core/') || r.includes('/migrations/')) continue;
      let txt;
      try {
        txt = norm(readFileSync(f, 'utf8'));
      } catch {
        return null;
      }
      total += (txt.match(re) || []).length;
    }
    return total;
  },
  migrations() {
    return walk(SRC, ['.py'])
      .filter((f) => {
        const r = relative(SRC, f).split(/[\\/]/).join('/');
        return /\/migrations\/0[^/]*\.py$/.test('/' + r) &&
          !r.startsWith('vninvest_core/');
      }).length;
  },
  composeStacks() {
    let n = 0;
    try {
      for (const e of readdirSync(ROOT)) {
        if (/^docker-compose.*\.yml$/.test(e)) n += 1;
      }
      for (const pkg of ['packages/core', 'packages/opencore', 'packages/vip-app']) {
        const d = join(ROOT, pkg);
        if (!existsSync(d)) continue;
        for (const e of readdirSync(d)) {
          if (/^docker-compose.*\.yml$/.test(e)) n += 1;
        }
      }
    } catch {
      return null;
    }
    return n;
  },
  beatEntries() {
    let txt;
    try {
      txt = norm(readFileSync(join(SRC, 'vninvest_core', 'settings.py'), 'utf8'));
    } catch {
      return null;
    }
    const m = /\bCELERY_BEAT_SCHEDULE\s*=\s*\{(.*?)\n\}/s.exec(txt);
    if (!m) return 0;
    return (m[1].match(/^\s{4}["']/gm) || []).length;
  },
  systemDesignFiles() {
    if (!existsSync(SD)) return null;
    return walk(SD, ['.md'], true).length;
  },
};

/* ------------------------------------------------------- volatile (info) */

const VOLATILE_STATIC = [
  '| routes_total | 1473 | Đo 2026-10-14 bằng `docs/architecture/tools/measure_repo.py` (cần Django runtime, không nằm trong gate này) |',
  '| routes_core_v1 | 615 | Như trên |',
];

function volatileLive() {
  let web = 'n/a';
  try {
    const out = execFileSync('git', ['-C', ROOT, 'ls-files', 'packages/web/src'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    web = String(out.split('\n').filter((x) => x.trim()).length);
  } catch { /* không có git ⇒ n/a, không phải lỗi */ }
  let docs = 'n/a';
  try {
    docs = String(walk(join(ROOT, 'docs'), ['.md']).length);
  } catch { /* n/a */ }
  return [
    `| web_src_tracked | ${web} | \`git ls-files packages/web/src\` lúc sinh báo cáo |`,
    `| docs_md_total | ${docs} | Đếm \`docs/**.md\` lúc sinh báo cáo |`,
  ];
}

/* ------------------------------------------------------------- inventory */

function docTitle(abs) {
  let txt;
  try {
    txt = norm(readFileSync(abs, 'utf8'));
  } catch {
    return null;
  }
  const m = /^#\s+(.+)$/m.exec(txt);
  return m ? m[1].trim().slice(0, 120) : null;
}

function buildInventory() {
  const files = walk(SD, ['.md'], true).map((f) => rel(f)).sort();
  return {
    generatedAt: '@@GENERATED_AT@@',
    root: 'docs/system-design',
    files: files.map((p) => ({
      path: p,
      lines: lineCount(join(ROOT, p)),
      title: docTitle(join(ROOT, p)),
    })),
  };
}

function stableJson(obj) {
  const strip = (o) => Array.isArray(o)
    ? o.map(strip)
    : (o && typeof o === 'object'
      ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, strip(o[k])]))
      : o);
  return JSON.stringify(strip(obj), null, 2).replace(/\r\n/g, '\n') + '\n';
}

function buildFreshness(measured, claimRows) {
  const L = [];
  L.push('# freshness-report — Ảnh Chụp Số Liệu (Máy Sinh, Không Sửa Tay)');
  L.push('');
  L.push('> Sinh lúc: @@GENERATED_AT@@ · Tool: `docs/system-design/_meta/tools/check-system-design.mjs`');
  L.push('> So sánh khi `--check`: chuẩn hóa CRLF, bỏ khối VOLATILE, token thời gian.');
  L.push('');
  L.push('## 1. Số liệu kiến trúc (fail-closed)');
  L.push('');
  L.push('| Fact | Đo được | Claims khớp |');
  L.push('|---|---|---|');
  for (const [k, v] of Object.entries(measured)) {
    const rows = claimRows.filter((c) => c.fact === k).map((c) => c.id).join(', ');
    L.push(`| ${k} | ${v} | ${rows || '—'} |`);
  }
  L.push('');
  L.push('## 2. VOLATILE — biến động nhanh (thông tin, không chặn)');
  L.push('');
  L.push('<!-- VOLATILE-START -->');
  L.push('| Fact | Giá trị | Cách đo |');
  L.push('|---|---|---|');
  for (const row of [...VOLATILE_STATIC, ...volatileLive()]) L.push(row);
  L.push('<!-- VOLATILE-END -->');
  L.push('');
  return L.join('\n');
}

const stripVolatile = (t) =>
  norm(t).replace(/<!-- VOLATILE-START -->[\s\S]*?<!-- VOLATILE-END -->/, '<!-- VOLATILE -->');
const stripTime = (t) => norm(t).replace(/@@GENERATED_AT@@/g, '@@T@@')
  .replace(/Sinh lúc: .*? · Tool/, 'Sinh lúc: @@T@@ · Tool');

/* ---------------------------------------------------- links + citations */

const LINK_RE = /\]\(([^)\s]+)\)/g;
const CITE_RE = new RegExp(
  BT + '([A-Za-z0-9_][A-Za-z0-9_/.-]*\\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|py|css|html|sh|ps1|yml|yaml|toml|txt|csv|sql))(?::(\\d[\\d,-]*))?' + BT,
  'g'
);

const NON_CITATION = new Set([
  'apps.py', 'models.py', 'urls.py', 'views.py',
  // ví dụ quy ước đặt tên trong 00.02 / adr/README (không phải khẳng định tồn tại)
  'NN.NN-ten-chu-de.md', 'ADR-NNN-ten-ngan.md',
]);

function citationRoots(cRel, base = SD) {
  return [
    join(base, cRel),
    join(ROOT, cRel),
    join(ROOT, 'docs', cRel),
    join(SRC, cRel),
    join(ROOT, 'packages', 'web', 'src', cRel),
    join(ROOT, 'packages', 'web', cRel),
    join(ROOT, 'scripts', cRel),
    join(SD, cRel),
    join(META, 'tools', cRel),
  ];
}

let BASENAME_INDEX = null;
function buildIndex() {
  const byName = new Map();
  const add = (abs) => {
    const name = abs.split(/[\\/]/).pop();
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(abs);
  };
  const scan = (d, depth = 0) => {
    if (depth > 8) return;
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (SKIP_DIRS.has(e.name)) continue;
      const full = join(d, e.name);
      if (e.isDirectory()) scan(full, depth + 1);
      else if (/\.(ts|tsx|js|jsx|mjs|cjs|json|md|py|css|html|yml|yaml)$/.test(e.name)) add(full);
    }
  };
  scan(ROOT);
  return byName;
}

function loadRetired(dir) {
  for (const p of [join(dir, '_meta', 'retired-citations.json'), join(META, 'retired-citations.json')]) {
    if (!existsSync(p)) continue;
    let raw;
    try {
      raw = JSON.parse(norm(readFileSync(p, 'utf8')));
    } catch {
      return { error: `FAIL: READ ${rel(p)} khong parse duoc JSON - KHONG verify duoc.` };
    }
    const map = new Map();
    for (const e of raw.retired ?? []) {
      if (!e || typeof e.path !== 'string') {
        return { error: `FAIL: READ ${rel(p)} co muc khong co "path" - KHONG verify duoc.` };
      }
      if (!e.removedOn || !e.why || !e.ledger) {
        return { error: `FAIL: READ ${rel(p)} muc "${e.path}" thieu removedOn/why/ledger - KHONG verify duoc.` };
      }
      map.set(e.path, e);
      for (const a of e.aliases ?? []) map.set(a, e);
    }
    return { map };
  }
  return { map: new Map() };
}

function checkLinksCites(dir = SD) {
  const files = walk(dir, ['.md'], true);
  if (!existsSync(dir)) return { code: 2, out: [`FAIL: READ khong tim thay ${rel(dir)}`] };
  if (!files.length) return { code: 2, out: [`FAIL: READ ${rel(dir)} khong co file .md`] };
  const ret = loadRetired(dir);
  if (ret.error) return { code: 2, out: [ret.error] };
  const deadLinks = [], deadCites = [];
  let linkCount = 0, citeCount = 0;
  for (const f of files) {
    const text = norm(readFileSync(f, 'utf8'));
    const from = rel(f);
    for (const m of text.matchAll(LINK_RE)) {
      const target = m[1];
      if (/^(https?:|mailto:|#)/.test(target) || target.includes('://')) continue;
      const abs = resolve(dirname(f), target);
      if (existsSync(abs)) linkCount++;
      else deadLinks.push({ from, target });
    }
    for (const m of text.matchAll(CITE_RE)) {
      const cRel = m[1], spec = m[2];
      let abs = citationRoots(cRel, dir).find((p) => existsSync(p));
      if (!abs) {
        if (!cRel.includes('/')) {
          const name = cRel;
          if (NON_CITATION.has(name)) continue;
          BASENAME_INDEX ??= buildIndex();
          const hits = BASENAME_INDEX.get(name) ?? [];
          if (hits.length === 1) abs = hits[0];
          else if (hits.length > 1) {
            deadCites.push({ from, cite: cRel, why: `mo ho - ${hits.length} file cung ten, hay viet day du duong dan` });
            continue;
          }
        }
      }
      if (!abs) {
        const tomb = ret.map.get(cRel);
        if (!tomb) deadCites.push({ from, cite: cRel, why: 'file khong ton tai' });
        continue;
      }
      if (ret.map.get(cRel)) {
        deadCites.push({ from, cite: cRel, why: 'da khai retired nhung file VAN TON TAI' });
        continue;
      }
      if (!spec) {
        citeCount++;
        continue;
      }
      const total = lineCount(abs);
      const nums = spec.split(',').map(Number).filter(Number.isFinite);
      const oob = nums.filter((n) => n > total);
      if (oob.length) {
        deadCites.push({ from, cite: `${cRel}:${oob.join(',')}`, why: `vuot gioi han (file chi co ${total} dong)` });
      } else citeCount++;
    }
  }
  const out = [];
  for (const d of deadLinks) out.push(`  LINK     ${d.from} -> ${d.target}`);
  for (const c of deadCites) out.push(`  CITATION ${c.from} -> ${c.cite}  (${c.why})`);
  if (deadLinks.length + deadCites.length) {
    out.push(`check-doc-links: ${deadLinks.length + deadCites.length} loi.`);
    return { code: 1, out };
  }
  out.push(`check-doc-links: ${files.length} file · ${linkCount} lien ket · ${citeCount} citation — sach.`);
  return { code: 0, out };
}

/* --------------------------------------------------------------- duplicates */

function topicKey(file) {
  const stem = basename(file, '.md');
  if (stem === 'README') return null;
  return stem.replace(/^\d+\.\d+-/, '');
}
function headingOf(text) {
  const m = /^#\s+(.+)$/m.exec(norm(text));
  if (!m) return null;
  return m[1].replace(/^\d+\.\d+\s*[—–-]\s*/, '').replace(/[*_`]/g, '').trim().toLowerCase();
}

function checkDuplicates(dir = SD) {
  if (!existsSync(dir)) return { code: 2, out: [`FAIL: READ khong tim thay ${rel(dir)}`] };
  const files = walk(dir, ['.md'], true);
  if (!files.length) return { code: 2, out: [`FAIL: READ ${rel(dir)} khong co file .md`] };
  const byKey = new Map(), byHeading = new Map();
  for (const f of files) {
    const key = topicKey(f);
    if (key !== null) {
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(rel(f));
    }
    const h = headingOf(readFileSync(f, 'utf8'));
    if (!h) continue;
    const hk = `${dirname(rel(f))}::${h}`;
    if (!byHeading.has(hk)) byHeading.set(hk, []);
    byHeading.get(hk).push(rel(f));
  }
  const problems = [];
  for (const [key, paths] of byKey) {
    if (paths.length > 1) problems.push(`TRUNG TEN chu de "${key}": ${paths.join(' | ')}`);
  }
  for (const [hk, paths] of byHeading) {
    if (paths.length > 1) problems.push(`TRUNG TIEU DE "${hk.split('::')[1]}": ${paths.join(' | ')}`);
  }
  if (problems.length) {
    return { code: 1, out: problems.map((p) => '  ' + p) };
  }
  return { code: 0, out: [`check-duplicate-topics: ${files.length} file · ${byKey.size} chu de — khong trung.`] };
}

/* ------------------------------------------------------------------ claims */

function checkClaims(dir = SD) {
  const claimFile = join(dir, '_meta', 'claims.json');
  if (!existsSync(claimFile)) return { code: 2, out: [`FAIL: READ khong thay ${rel(claimFile)}`] };
  let raw;
  try {
    raw = JSON.parse(norm(readFileSync(claimFile, 'utf8')));
  } catch {
    return { code: 2, out: [`FAIL: READ ${rel(claimFile)} khong parse duoc JSON`] };
  }
  const problems = [];
  const rows = [];
  for (const c of raw.claims ?? []) {
    if (!c.id || !c.doc || !c.docQuote || !c.fact || c.expected === undefined) {
      problems.push(`  CLAIMS muc thieu truong (id/doc/docQuote/fact/expected): ${JSON.stringify(c).slice(0, 100)}`);
      continue;
    }
    let docAbs = join(ROOT, c.doc);
    if (!existsSync(docAbs)) docAbs = join(dir, c.doc);
    if (!existsSync(docAbs)) {
      problems.push(`  CLAIMS ${c.id}: doc khong ton tai: ${c.doc}`);
      continue;
    }
    const text = norm(readFileSync(docAbs, 'utf8'));
    if (!text.includes(c.docQuote)) {
      problems.push(`  CLAIMS ${c.id}: TRICH_DAN_BI_XOA — khong tim thay nguyen van trong ${c.doc}`);
      continue;
    }
    const fn = FACTS[c.fact];
    if (!fn) {
      problems.push(`  CLAIMS ${c.id}: fact khong co ham do: ${c.fact}`);
      continue;
    }
    const got = fn();
    if (got === null || got === undefined) {
      problems.push(`  CLAIMS ${c.id}: KHONG do duoc fact ${c.fact} — KHONG verify duoc`);
      continue;
    }
    rows.push({ fact: c.fact, id: c.id });
    if (got !== c.expected) {
      problems.push(`  CLAIMS ${c.id}: SAI — doc noi ${c.expected}, code do duoc ${got} (sua TAI LIEU, dung sua claims de xanh)`);
    }
  }
  if (problems.length) {
    problems.push(`check-claims: ${problems.length} van de.`);
    return { code: 1, out: problems, rows };
  }
  return { code: 0, out: [`check-claims: ${(raw.claims ?? []).length} tuyen bo — khop code.`], rows };
}

/* ------------------------------------------------------------------- modes */

function runCheck(dir = SD) {
  let code = 0;
  const all = [];
  // 1. inventory
  const invPath = join(dir, '_meta', 'inventory.json');
  if (!existsSync(invPath)) {
    all.push('FAIL: READ khong thay inventory.json — chay --write truoc.');
    code = 2;
  } else {
    let committed;
    try {
      committed = JSON.parse(norm(readFileSync(invPath, 'utf8')));
    } catch {
      all.push('FAIL: READ inventory.json khong parse duoc.');
      code = 2;
    }
    if (committed) {
      const fresh = buildInventory();
      const a = stableJson({ ...committed, generatedAt: '@@T@@' });
      const b = stableJson({ ...fresh, generatedAt: '@@T@@' });
      if (a !== b) {
        all.push('FAIL: INVENTORY cay tai lieu lech inventory.json — chay --write roi --check lai.');
        code = 1;
      } else {
        all.push(`check-inventory: ${fresh.files.length} file — khop.`);
      }
    }
  }
  // 2. freshness
  const frPath = join(dir, '_meta', 'freshness-report.md');
  if (existsSync(frPath) && code === 0) {
    const measured = Object.fromEntries(Object.keys(FACTS).map((k) => [k, FACTS[k]()]));
    const claimRows = (checkClaims(dir).rows || []);
    const fresh = stripTime(stripVolatile(buildFreshness(measured, claimRows)));
    const disk = stripTime(stripVolatile(readFileSync(frPath, 'utf8')));
    if (fresh !== disk) {
      all.push('FAIL: FRESHNESS freshness-report.md lech ban sinh — chay --write roi --check lai.');
      const fa = fresh.split('\n'), da = disk.split('\n');
      for (let i = 0; i < Math.max(fa.length, da.length); i++) {
        if (fa[i] !== da[i]) {
          all.push(`  dong ${i + 1} sinh: ${fa[i] ?? '(thieu)'} | dia: ${da[i] ?? '(thieu)'}`);
          break;
        }
      }
      code = 1;
    } else {
      all.push('check-freshness: khop ban sinh.');
    }
  }
  // 3. links + cites
  const lc = checkLinksCites(dir);
  all.push(...lc.out);
  if (lc.code !== 0) code = Math.max(code, lc.code);
  // 4. duplicates
  const dp = checkDuplicates(dir);
  all.push(...dp.out);
  if (dp.code !== 0) code = Math.max(code, dp.code);
  // 5. claims
  const cl = checkClaims(dir);
  all.push(...cl.out);
  if (cl.code !== 0) code = Math.max(code, cl.code);
  for (const line of all) {
    if (/^FAIL/.test(line)) console.error(line);
    else console.log(line.startsWith('  ') ? line : '  ' + line);
  }
  const tag = code === 0 ? 'SACH — exit 0' : (code === 1 ? 'CO DRIFT — exit 1' : 'KHONG VERIFY DUOC — exit 2');
  console.log(`\ncheck-system-design --check: ${tag}`);
  return code;
}

function runWrite(dir = SD) {
  if (!existsSync(dir)) {
    console.error(`FAIL: READ khong tim thay ${rel(dir)}`);
    return 2;
  }
  const inv = buildInventory();
  const stamp = new Date().toISOString().slice(0, 10);
  inv.generatedAt = stamp;
  writeFileSync(join(dir, '_meta', 'inventory.json'), stableJson(inv), 'utf8');
  const measured = Object.fromEntries(Object.keys(FACTS).map((k) => [k, FACTS[k]()]));
  const claimRows = (checkClaims(dir).rows || []);
  const fresh = buildFreshness(measured, claimRows).replaceAll('@@GENERATED_AT@@', stamp);
  writeFileSync(join(dir, '_meta', 'freshness-report.md'), fresh.replace(/\r\n/g, '\n'), 'utf8');
  console.log(`check-system-design --write: inventory ${inv.files.length} file + freshness-report (ngay ${stamp}).`);
  return 0;
}

/* -------------------------------------------------------------- self-test */

function selfTest() {
  console.log('check-system-design SELF-TEST — fixture tam, assert gate BAT\n');
  let failures = 0;
  const build = (files) => {
    const d = mkdtempSync(join(tmpdir(), 'check-sysdesign-'));
    for (const [name, body] of Object.entries(files)) {
      const target = join(d, name);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, typeof body === 'string' ? body : JSON.stringify(body, null, 2), 'utf8');
    }
    return d;
  };
  const probe = (name, files, args, expect) => {
    const d = build(files);
    // Hai pha: --write tao inventory+freshness trong fixture, --check moi assert.
    // (Tren repo that, --write cung la buoc bat buoc truoc --check lan dau.)
    spawnSync(process.execPath, [SELF, '--dir', d, '--write'], {
      encoding: 'utf8', shell: false, windowsHide: true,
    });
    const r = spawnSync(process.execPath, [SELF, '--dir', d, ...args], {
      encoding: 'utf8', shell: false, windowsHide: true,
    });
    rmSync(d, { recursive: true, force: true });
    const out = (r.stdout ?? '') + (r.stderr ?? '');
    const ok = expect === null ? r.status === 0 : r.status !== 0 && out.includes(expect);
    if (ok) console.log(`  ok   ${name}  exit=${r.status}`);
    else {
      failures++;
      console.error(`  FAIL  ${name}\n        expected ${expect}, got exit=${r.status}\n${out.trim().slice(0, 600)}`);
    }
  };
  const BT2 = String.fromCharCode(96);

  probe('CONTROL: sach thi exit 0', {
    'a.md': '# Alpha\n\n[x](./b.md)\n',
    'b.md': '# Beta\n',
    '_meta/claims.json': { claims: [] },
    '_meta/retired-citations.json': { retired: [] },
  }, ['--check'], null);

  probe('TRUNG TEN: hai file cung chu de', {
    '02.01-module-map.md': '# Module map\n',
    '02.03-module-map.md': '# Module map\n',
    '_meta/claims.json': { claims: [] },
    '_meta/retired-citations.json': { retired: [] },
  }, ['--check'], 'TRUNG TEN');

  probe('LINK: tro toi file khong ton tai', {
    'a.md': '# A\n\n[x](./khong-co.md)\n',
    '_meta/claims.json': { claims: [] },
    '_meta/retired-citations.json': { retired: [] },
  }, ['--check'], 'LINK');

  probe('CITATION: vuot so dong', {
    'a.md': `# A\n\n${BT2}b.md:99${BT2}\n`,
    'b.md': '# b\n',
    '_meta/claims.json': { claims: [] },
    '_meta/retired-citations.json': { retired: [] },
  }, ['--check'], 'vuot gioi han');

  // claims hermetic: fact systemDesignFiles dem .md trong --dir;
  // doc resolve thu join(ROOT) roi join(--dir) (xem checkClaims).
  probe('CLAIMS: SAI thi BAT', {
    'a.md': '# A\n\nCo 1 file trong bo.\n',
    '_meta/claims.json': { claims: [{ id: 'C-T', doc: 'a.md', docQuote: 'Co 1 file trong bo.', fact: 'systemDesignFiles', expected: 99 }] },
    '_meta/retired-citations.json': { retired: [] },
  }, ['--check'], 'SAI');

  if (failures > 0) {
    console.error(`\nSELF-TEST FAILED: ${failures} case. Gate khong duoc tin.`);
    process.exit(1);
  }
  console.log('\nSELF-TEST PASS: 5 case (1 control + 4 bat loi).');
}

/* ------------------------------------------------------------------ main */

if (SELF_TEST) {
  selfTest();
} else if (DO_WRITE) {
  process.exit(runWrite());
} else {
  process.exit(runCheck());
}
