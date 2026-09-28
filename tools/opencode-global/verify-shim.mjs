/**
 * verify-shim.mjs — chứng minh scripts/agent-preflight.mjs (shim) THẬT SỰ
 * chạy bản canonical, không phải một bản sao riêng.
 *
 * ── VÌ SAO BẢN PROBE CŨ SAI ────────────────────────────────────────────────
 * Bản cũ sửa hằng `TRAILER` trong canonical rồi kiểm tra shim có in ra hằng đó
 * không. Điều đó chỉ đúng khi đồng thời có: (1) canonical còn dùng hằng đó để
 * quyết định, (2) đang có file deny-list staged để in ra phần `fix`.
 * Sau khi đổi sang `TRAILER_RE` và sau khi commit xong, cả hai điều kiện hết —
 * shim vẫn chạy canonical đúng nhưng probe báo FAIL. Tức probe ĐO SAI THỨ
 * cần đo. (Bản cũ từng "PASS" cũng chỉ nhờ may mắn có file deny staged.)
 *
 * ── CÁCH ĐO MỚI, TẤT ĐỊNH ────────────────────────────────────────────────
 * Dời canonical đi một chút, chạy shim, kỳ vọng exit 3 + thông điệp
 * "khong tim thay ban canonical". Shim nào có bản sao riêng sẽ chạy bình thường
 * ⇒ FAIL. Không phụ thuộc nội dung log, không phụ thuộc file nào đang staged.
 *
 *   node tools/opencode-global/verify-shim.mjs
 */
import { renameSync, existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const CANONICAL = resolve(HERE, "agent-preflight.mjs");
const HIDDEN = resolve(HERE, ".agent-preflight.hidden.mjs");
const SHIM = resolve(REPO, "scripts", "agent-preflight.mjs");

let failed = 0;
function check(label, pass, extra = "") {
  if (!pass) failed += 1;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass && extra) console.log(`    ${extra}`);
}

console.log("verify-shim — scripts/agent-preflight.mjs co chay canonical that khong\n");

// 1. canonical phai ton tai
check("canonical agent-preflight.mjs ton tai", existsSync(CANONICAL), CANONICAL);
if (!existsSync(CANONICAL)) process.exit(1);

try {
  // 2. dời canonical đi — shim phải BÁO THIẾU chứ không tự chạy bản sao
  renameSync(CANONICAL, HIDDEN);
  const r = spawnSync(process.execPath, [SHIM, "--staged"], { cwd: REPO, encoding: "utf8" });
  const out = `${r.stdout || ""}${r.stderr || ""}`;

  check("dời canonical đi -> shim exit 3 (khong tu fallback)", r.status === 3, `nhan ${r.status}`);
  check(
    "thong diep bao 'khong tim thay ban canonical'",
    /khong tim thay ban canonical/.test(out),
    out.slice(0, 200),
  );
  check(
    "thong diep noi ro khong fallback ve ban hardcoded",
    /hardcoded/.test(out),
    out.slice(0, 200),
  );
} finally {
  // 3. hoàn nguyên luôn, kể cả khi probe vừa ném lỗi
  if (existsSync(HIDDEN) && !existsSync(CANONICAL)) renameSync(HIDDEN, CANONICAL);
  else if (existsSync(HIDDEN)) rmSync(HIDDEN, { force: true });
}

check("canonical da hoan nguyen", existsSync(CANONICAL));

// 4. sanity: co canonical thi shim chay duoc va tro ve ma cua canonical
const ok = spawnSync(process.execPath, [SHIM, "--staged"], { cwd: REPO, encoding: "utf8" });
check("co canonical -> shim chay duoc (exit 0 hoac 1)", ok.status === 0 || ok.status === 1, `nhan ${ok.status}`);

console.log("");
console.log(failed ? `  ${failed} FAIL` : "  shim chay canonical that");
process.exit(failed ? 1 : 0);
