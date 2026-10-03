/**
 * i18n-scan-strict.mjs — đóng lỗ hổng "gate báo lỗi rồi exit 0".
 *
 * ── CƠ CHẾ (đọc từ i18next-scanner/lib/parser.js, đo trước khi viết) ────────
 * `parseFuncFromString` (parser.js:449) trích key `t('...')` bằng REGEX, không
 * dùng parser cho phần key. Chỉ khi lời gọi kết thúc bằng dấu phẩy thì phần
 * options mới được `esprimaNext.parse('(' + code + ')')` (parser.js:508) trong
 * try/catch, và lỗi đi qua `this.error(...)` ⇒ in ra stderr với tiền tố
 * `i18next-scanner:` — RỒI VẪN exit 0.
 *
 * Nên lỗi thật, có thể tái hiện, là cú pháp TypeScript trong options:
 *     t('saving', { defaultValue: 'Đang lưu...' as string })
 *                         ^^^^^^^^^^^^^^^^^^^^^ esprima không hiểu `as`
 *
 * ── PHẠM VI: gate này KHÔNG bắt được gì ngoài case trên ────────────────────
 * (1) File .js/.jsx/.ts/.tsx KHÔNG parse được: scanner dùng regex nên không bao
 *     giờ parse cả file — nó chỉ không khớp regex và bỏ qua, in KHÔNG một dòng
 *     nào. Đã đo: tiêm `export const broken = ;` vào src/components/ui/index.js
 *     ⇒ scanner im lặng, exit 0, không có thông điệp nào để grep.
 *     Muốn bắt case này phải parse bằng chính parser của scanner — hiện chưa làm.
 * (2) `parseTransFromString` cũng có nhánh báo lỗi, nhưng config đặt
 *     `trans: false` (i18next-scanner.config.cjs) nên nhánh đó không chạy.
 *
 * Không được mô tả gate này là "bắt lỗi cú pháp nói chung" — nó bắt đúng một
 * loại. Xem tools/opencode-global/verify-i18n-strict.mjs để có negative test.
 *
 *   node scripts/i18n-scan-strict.mjs            # fail nếu scanner báo lỗi parse
 *   node scripts/i18n-scan-strict.mjs --warn     # chỉ in, luôn exit 0 (quan sát)
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
    '[i18n-strict] Nguyên nhân thường gặp: cú pháp TypeScript trong options\n' +
    "[i18n-strict] của lời gọi dịch — esprima là parser JS thuần, không hiểu `as`/type.\n" +
    '[i18n-strict] Tính giá trị ra NGOÀI lời gọi dịch. Xem AGENTS.md mục Progress.',
);

if (WARN_ONLY) {
  console.error('[i18n-strict] --warn: exit 0');
  process.exit(0);
}
process.exit(1);
