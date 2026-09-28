/**
 * audit-status-claims.mjs — Phase 6: chống tài liệu tự thối.
 *
 * VÌ SAO CẦN: ngày 2026-09-27 cả phiên làm việc kết luận sai rằng 6 slice
 * `tenantreg-*` "chưa có code" — chỉ vì đọc 1 dòng stale trong `AGENTS.md` mà không
 * đối chiếu `docs/CLAIMS.md` (nơi cả 6 dòng đều `released`).
 *
 * Không chặn gì. Chỉ báo cáo, để có số liệu trước khi cân nhắc siết.
 *
 *   node scripts/audit-status-claims.mjs          # báo cáo
 *   node scripts/audit-status-claims.mjs --strict # exit 1 nếu có dòng thiếu verified
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = ["AGENTS.md"];
const CLAIMS = "docs/CLAIMS.md";

/**
 * CHỈ soi `## Progress`.
 *
 * Lý do: quy tắc ("Không chạy npm install", "Bắt buộc dùng i18n") là mệnh lệnh
 * vĩnh viễn, không bao giờ thối — đòi thêm mốc verified cho chúng là vô nghĩa.
 * Chỉ khẳng định TRẠNG THÁI trong `## Progress` mới già theo thời gian, và đó
 * chính là chỗ đã làm tôi kết luận sai ngày 2026-09-27.
 */
const SCOPE_SECTION = /^##\s+Progress\b/;
const SKIP_SECTION = /^##\s+(?!Progress\b)/;

/** Dòng khẳng định trạng thái: có "đã/còn/chưa/merge/PASS/..." */
const STATUS_RE = /(đã|chưa|còn|hoàn thành|merge|released|PASS|FAIL|CHƯA CHẠY|blocker|tồn đọng|sống|chết|còn sống)/i;
/** Mốc để người đọc biết khẳng định được kiểm chứng lúc nào. */
const MARKER_RE = /verified\s*:|@ ?[0-9a-f]{7,40}\b|\(20\d\d-\d\d-\d\d\)|Entry \d+|`[0-9a-f]{7,40}`/i;
/** Dòng mang tính mệnh lệnh, không phải trạng thái. */
const RULE_RE = /^\s*[-*]\s*\*\*(Không|Bắt buộc|Phải|Quy tắc|Nguyên tắc|Cách|Hoàn nguyên|Cấm)\b/;

const SKIP_RE = /^\s*(#|>|\||```|---)/;

function auditFile(rel) {
  const f = resolve(REPO, rel);
  if (!existsSync(f)) return null;
  const lines = readFileSync(f, "utf8").split("\n");
  const rows = [];
  let inScope = false;
  lines.forEach((line, i) => {
    if (SKIP_SECTION.test(line)) inScope = false;
    if (SCOPE_SECTION.test(line)) inScope = true;
    if (!inScope) return;
    if (SKIP_RE.test(line)) return;
    if (RULE_RE.test(line)) return;
    if (line.length < 25) return;
    if (!STATUS_RE.test(line)) return;
    if (MARKER_RE.test(line)) return;
    rows.push({ line: i + 1, text: line.trim().slice(0, 110) });
  });
  return rows;
}

// đối chiếu chéo: claim nào `in-progress` trong CLAIMS.md?
function openClaims() {
  const f = resolve(REPO, CLAIMS);
  if (!existsSync(f)) return [];
  const out = [];
  for (const line of readFileSync(f, "utf8").split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const c = line.split("|").map((x) => x.trim());
    const agent = (c[1] || "").replace(/`/g, "");
    const status = (c[5] || "").toLowerCase();
    if (status === "in-progress" || status === "proposed") out.push(`${agent} (${status})`);
  }
  return out;
}

console.log("audit-status-claims — chống tài liệu tự thối\n");
let total = 0;
for (const t of TARGETS) {
  const rows = auditFile(t);
  if (!rows) {
    console.log(`  ${t}: KHÔNG ĐỌC ĐƯỢC`);
    continue;
  }
  total += rows.length;
  console.log(`  ${t}: ${rows.length} dòng khẳng định trạng thái thiếu mốc "verified"`);
  for (const r of rows.slice(0, 8)) console.log(`    L${r.line}: ${r.text}`);
  if (rows.length > 8) console.log(`    … còn ${rows.length - 8} dòng`);
}

const open = openClaims();
console.log(`\n  CLAIMS.md đang mở: ${open.length}`);
for (const o of open) console.log(`    ${o}`);

if (total === 0) {
  console.log("\n  → mọi khẳng định trạng thái đều có mốc. KHÔNG cần thay đổi gì.");
  process.exit(0);
}

console.log(`\n  → ${total} dòng nên thêm "verified: <YYYY-MM-DD> @ <sha>".`);
console.log("  Sửa tay các dòng quan trọng; đừng siết thành gate cho tới khi còn = 0.");
if (process.argv.includes("--strict")) process.exit(1);
process.exit(0);
