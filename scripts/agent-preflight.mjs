/**
 * scripts/agent-preflight.mjs — SHIM, KHÔNG PHẢI BẢN TRIỂN KHAI.
 *
 * Lý do shim này tồn tại (audit C-1, 2026-09-27):
 *   Hook ưu tiên bản trong repo trước bản user-level. Trước đây bản repo là một
 *   bản riêng hardcode 12 file deny list, còn bản user-level đọc deny list động
 *   từ AGENT_PROTOCOL/AGENTS/CLAUDE (16 file mặc định). Hai bản lệch nhau và
 *   HAI BẢN ĐỀU CHẠY:
 *     - Ở repo KHÔNG có protocol → chạy bản user-level (động).
 *     - Ở vninvest (repo DUY NHẤT có protocol) → chạy bản repo (hardcode),
 *       tức logic "tự thích ứng" mà cả phiên này xây không bao giờ chạy.
 *   Mọi cải tiến sau này cho bản user-level sẽ im lặng vô hiệu tại đây.
 *
 * Cách sửa: MỘT nguồn triển khai duy nhất nằm trong git tại
 *   tools/opencode-global/agent-preflight.mjs
 * Shim này chuyển tiếp (argv, stdio, exit code) sang bản đó. Hook ở repo nào
 * có file này cũng chạy đúng một code.
 *
 * Vì sao re-exec chứ không phải `import` rồi re-export:
 *   Bản canonical KHÔNG có `export` nào — nó là CLI tự chạy khi được nạp.
 *   `import` rồi destructure sẽ cho `undefined` (namespace object không ném
 *   lỗi khi thiếu tên) — tức một API bịa ra không kiểm chứng được. Re-exec
 *   không phụ thuộc hình dạng export và truyền đúng exit code.
 *
 * Kiểm tra drift: node scripts/verify-global-config.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CANONICAL = resolve(HERE, "..", "tools", "opencode-global", "agent-preflight.mjs");

if (!existsSync(CANONICAL)) {
  console.error(
    `agent-preflight (shim): khong tim thay ban canonical\n` +
      `  ${relative(process.cwd(), CANONICAL)}\n` +
      `  Ban canonical phai nam trong git. Khong fallback ve ban hardcoded — ` +
      `do chinh la nguon goc cua drift C-1.`
  );
  process.exit(3);
}

const r = spawnSync(process.execPath, [CANONICAL, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: process.cwd(),
});

if (r.error) {
  console.error(`agent-preflight (shim): khong chay duoc canonical — ${r.error.message}`);
  process.exit(3);
}
process.exit(typeof r.status === "number" ? r.status : 3);
