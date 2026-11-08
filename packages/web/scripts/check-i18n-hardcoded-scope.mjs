#!/usr/bin/env node
/**
 * B4 `uiux-i18n-gate-scope` — baseline-lock cho gate
 * `check-i18n-hardcoded.mjs` (gate gốc chỉ quét 5 path ở `package.json`).
 *
 * Cách dùng:
 *   node scripts/check-i18n-hardcoded-scope.mjs                 # scope B3 (8 file, baseline 0)
 *   node scripts/check-i18n-hardcoded-scope.mjs --all           # toàn src/pages + src/components (baseline)
 *   node scripts/check-i18n-hardcoded-scope.mjs <file/dir> ...  # scope tùy ý (baseline)
 *   node scripts/check-i18n-hardcoded-scope.mjs --write-baseline --all
 *   node scripts/check-i18n-hardcoded-scope.mjs --self-test     # kiểm chứng gate BẮT lỗi thật
 *
 * Quy ước (khớp các gate UI khác trong `scripts/pre-push-gate.mjs`):
 *   - Chỉ khoá VI PHẠM MỚI: số chuỗi Việt của file/dir không được vượt
 *     baseline đã ghi; giảm thì OK (nên ghi lại baseline mới).
 *   - File ngoài baseline mà có > 0 vi phạm => FAIL (file mới/sửa chứa chuỗi Việt).
 *   - `--self-test` tạo file tạm có chuỗi Việt và chứng minh wrapper exit 1.
 *
 * Baseline: `scripts/i18n-hardcoded-baseline.json` (beside this file).
 * Không sửa `package.json` (deny-list) — gate được gọi từ `scripts/pre-push-gate.mjs`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const BASELINE_PATH = join(HERE, 'i18n-hardcoded-baseline.json');
const ORIGINAL_GATE = join(HERE, 'check-i18n-hardcoded.mjs');

const B3_SCOPE = [
  'src/pages/admin/ShellMailConfigPage.tsx',
  'src/pages/vip/VipLocalControlPage.tsx',
  'src/pages/broker/BrokerHubPage.tsx',
  'src/pages/TransactionsPage.tsx',
  'src/pages/system/ShellAiCommandCenterPage.tsx',
  'src/pages/system/ShellSettingsPage.tsx',
  'src/pages/system/ShellSupportPage.tsx',
  'src/pages/portfolio/PortfolioWorkspacePage.tsx',
];

function parseGateCounts(out) {
  const counts = {};
  for (const line of String(out).split('\n')) {
    const m = line.trim().match(/^(.+\.[tj]sx?)\s*\((\d+)\)\s*$/);
    if (m) counts[m[1].replace(/\\/g, '/')] = Number(m[2]);
  }
  return counts;
}

function runOriginalGate(targets) {
  const r = spawnSync(process.execPath, [ORIGINAL_GATE, ...targets], {
    cwd: WEB,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = (r.stdout || '') + (r.stderr || '');
  return { code: r.status === null ? null : r.status, out, counts: parseGateCounts(out) };
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function main() {
  const argv = process.argv.slice(2);
  const all = argv.includes('--all');
  const writeBaseline = argv.includes('--write-baseline');
  const selfTest = argv.includes('--self-test');
  const targets = argv.filter((a) => !a.startsWith('--'));

  if (selfTest) {
    const tmpDir = join(HERE, '.self-test');
    mkdirSync(tmpDir, { recursive: true });
    const tmpFile = join(tmpDir, 'probe.ts');
    writeFileSync(tmpFile, 'const x = "Chuỗi tiếng Việt hardcode để kiểm chứng gate.";\nexport default x;\n', 'utf8');
    const r = runOriginalGate([tmpFile]);
    const rel = relative(WEB, tmpFile).replace(/\\/g, '/');
    const ok1 = r.code === 1 && (r.counts[rel] ?? 0) >= 1;
    rmSync(tmpDir, { recursive: true, force: true });
    if (ok1) {
      console.log('check-i18n-hardcoded-scope --self-test: PASS (1/1, gate bat loi that)');
      process.exit(0);
    }
    console.log('check-i18n-hardcoded-scope --self-test: FAIL (gate khong bat duoc chuoi Viet)');
    process.exit(1);
  }

  const scope = targets.length > 0 ? targets : all ? ['src/pages', 'src/components'] : B3_SCOPE;

  if (writeBaseline) {
    const r = runOriginalGate(scope);
    const baseline = { scope, counts: r.counts, generatedFrom: 'check-i18n-hardcoded.mjs' };
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
    console.log(`check-i18n-hardcoded-scope --write-baseline: ghi ${Object.keys(r.counts).length} file vao baseline`);
    process.exit(0);
  }

  const baseline = loadBaseline();
  const r = runOriginalGate(scope);
  if (r.code === null) {
    console.log('check-i18n-hardcoded-scope: CHUA CHAY (khong spawn duoc gate goc)');
    process.exit(0);
  }

  if (!baseline) {
    console.log('check-i18n-hardcoded-scope: CHUA CHAY (thieu baseline json, hay chay --write-baseline)');
    process.exit(0);
  }

  const baselineCounts = baseline.counts && typeof baseline.counts === 'object' ? baseline.counts : {};
  const problems = [];
  const seen = new Set();
  for (const [file, n] of Object.entries(r.counts)) {
    seen.add(file);
    const base = baselineCounts[file];
    if (base === undefined) {
      problems.push(`${file}: ${n} vi pham (ngoai baseline)`);
    } else if (n > base) {
      problems.push(`${file}: ${n} > baseline ${base} (${n - base} moi)`);
    }
  }
  const total = Object.values(r.counts).reduce((a, b) => a + b, 0);
  const baseTotal = Object.values(baselineCounts).reduce((a, b) => a + b, 0);

  if (problems.length > 0) {
    console.log('check-i18n-hardcoded-scope: FAIL (vi pham moi)');
    for (const p of problems.slice(0, 20)) console.log('  - ' + p);
    console.log(`  tong hien tai ${total} / baseline ${baseTotal}`);
    process.exit(1);
  }

  console.log(`PASS check-i18n-hardcoded-scope: khong co vi pham MOI (hien tai ${total} / baseline ${baseTotal})`);
  process.exit(0);
}

main();
