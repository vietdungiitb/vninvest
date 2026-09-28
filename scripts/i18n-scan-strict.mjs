/**
 * i18n-scan-strict.mjs — đóng lỗ hổng "gate báo lỗi rồi exit 0".
 *
 * VÌ SAO: `i18next-scanner` gặp cú pháp không parse được thì in
 *   i18next-scanner: Unable to parse code "..."
 *   i18next-scanner: Error: Line N: ...
 * rồi **vẫn exit 0**. Người đọc log thấy lỗi nhưng CI xanh ⇒ cảm giác an toàn giả.
 * Đây là loại hỏng tệ hơn không có gate (docs/evidence/gate-audit/baseline.md §2).
 *
 * Bọc scanner và chuyển "đã in lỗi" thành exit khác 0.
 *
 *   node scripts/i18n-scan-strict.mjs            # fail nếu scanner báo lỗi
 *   node scripts/i18n-scan-strict.mjs --warn     # chỉ in, luôn exit 0 (quan sát)
 *
 * Ghi chú: KHÔNG nối vào check:shell từ đây — `packages/web/package.json` thuộc
 * deny list §2, cần coordinator thêm `check:i18n-strict` vào chuỗi đó.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(REPO, 'packages', 'web');
const CFG = join(WEB, 'i18next-scanner.config.cjs');
const BIN = join(WEB, 'node_modules', 'i18next-scanner', 'bin', 'cli.js');
const WARN_ONLY = process.argv.includes('--warn');

if (!existsSync(BIN)) {
  console.error('[i18n-strict] khong tim thay i18next-scanner — bo qua (chua cai)');
  process.exit(0);
}

const res = spawnSync(process.execPath, [BIN, '--config', CFG], {
  cwd: WEB,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const all = `${res.stdout || ''}\n${res.stderr || ''}`;

// giữ nguyên output gốc để không mất cảnh báo "different default value"
if (res.stdout) process.stdout.write(res.stdout);
if (res.stderr) process.stderr.write(res.stderr);

const PARSE_ERR = /i18next-scanner:\s*(Unable to parse|Error: Line \d+:)/;

if (!PARSE_ERR.test(all)) {
  process.exit(res.status === 0 ? 0 : 1);
}

const n = (all.match(/i18next-scanner:\s*Unable to parse/g) || []).length;
console.error(
  `\n[i18n-strict] scanner BÁO LỖI PARSE (${n} chỗ) nhưng vẫn exit 0.\n` +
    '[i18n-strict] Nguyên nhân thường gặp: cú pháp TypeScript trong default value\n' +
    '[i18n-strict] của lời gọi dịch — esprima là parser JS thuần, không hiểu `as`/type.\n' +
    '[i18n-strict] Tính giá trị ra NGOÀI lời gọi dịch. Xem AGENTS.md mục Progress.',
);

if (WARN_ONLY) {
  console.error('[i18n-strict] --warn: exit 0');
  process.exit(0);
}
process.exit(1);
