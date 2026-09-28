/**
 * split-agents-md.mjs — Phase 5: tách AGENTS.md (729 -> ~212 dong), chi cat LICH SU.
 *
 * Dung Node de doc/ghi UTF-8 tuong minh. KHONG dung PowerShell ReadAllLines/WriteAllLines
 * tren file khong-ASCII: doc sai decoder roi ghi lai se lam hong that file
 * (da xay 1 lan trong phien 2026-09-27 — mat 28 ky tu).
 *
 *   node scripts/split-agents-md.mjs --dry-run   # chi bao cao
 *   node scripts/split-agents-md.mjs             # thuc hien
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(REPO, "AGENTS.md");
const OUT = resolve(REPO, "docs", "ARCHIVE_AGENTS_PROGRESS.md");

const text = readFileSync(SRC, "utf8");
const lines = text.split("\n");

// ranh giới: khối `## Progress` chứa 54 mục `### Done` lịch sử, xen giữa 5 mục
// `### OPEN P0` còn sống và 2 mục mốc. Cắt từ `### Done` ĐẦU TIÊN.
const firstDone = lines.findIndex((l) => /^###\s+Done/.test(l));
const progressStart = lines.findIndex((l) => /^##\s+Progress/.test(l));

if (firstDone < 0 || progressStart < 0) {
  console.error("khong tim thay moc — bo qua, khong sua file");
  process.exit(2);
}

// `## Progress` kết thúc ngay trước khối kế tiếp cùng cấp `## `
let progressEnd = lines.length;
for (let i = firstDone; i < lines.length; i += 1) {
  if (/^##\s+/.test(lines[i])) {
    progressEnd = i;
    break;
  }
}

// GIỮ: từ đầu file tới HẾT khối `## Progress` nhưng DỪNG TRƯỚC `### Done` đầu tiên.
// Nghĩa là giữ luôn `## Progress` + các mục mốc + các mục `### OPEN P0` còn sống.
// BUG ĐÃ SỬA: lần đầu dùng `lines[0..progressStart]` => XOÁ LUÔN 62 dòng nội dung sống
// (5 OPEN P0 + 2 mục mốc). Phải dùng `firstDone` làm mốc dừng.
const keep = [...lines.slice(0, firstDone), ...lines.slice(progressEnd)];
const cut = lines.slice(firstDone, progressEnd);

// `cut` = các mục ### Done. Giữ lại tiêu đề `## Progress` trong archive cho dễ đọc.
const banner = [
  "",
  "<!-- LƯU TRỮ: phần lịch sử đã cắt khỏi AGENTS.md ngày 2026-09-27 (Phase 5 của",
  "     docs/IMPLEMENTATION_PLAN_MANDATORY_AGENT_WORKFLOW_20260927.md).",
  "     Chỉ chứa các mục '### Done' — tức việc ĐÃ HOÀN THÀNH, không còn tác dụng",
  "     điều hành. File này KHÔNG được nạp vào ngữ cảnh mỗi session.",
  "     Nguồn sự thật hiện tại: docs/CLAIMS.md + git log. -->",
  "",
].join("\n");

const archive = [
  "# Lưu trữ — AGENTS.md phần `## Progress` (đã tách 2026-09-27)",
  "",
  "> 54 mục `### Done` được chuyển từ `AGENTS.md` sang đây. Xem `AGENTS.md` cho quy trình",
  "> và trạng thái còn sống; xem `docs/CLAIMS.md` + `git log` cho trạng thái thực tế.",
  "",
].join("\n") + cut.join("\n") + "\n";

const dryRun = process.argv.includes("--dry-run");
console.log(`  AGENTS.md : ${lines.length} -> ${keep.length} dong`);
console.log(`  archive   : ${cut.length} dong -> docs/ARCHIVE_AGENTS_PROGRESS.md`);
console.log(`  cat       : ${firstDone + 1}..${progressEnd} (${cut.length} dong)`);

if (dryRun) {
  console.log("  --dry-run: khong ghi file");
  process.exit(0);
}

writeFileSync(OUT, archive, "utf8");
writeFileSync(SRC, keep.join("\n"), "utf8");
console.log("  da ghi. KIEM TRA BANG: git diff --numstat AGENTS.md");
