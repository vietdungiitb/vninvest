/**
 * test-agent-preflight.mjs — negative test cho scripts/agent-preflight.mjs
 *
 * BẤT BIẾN (kế hoạch §7): "mọi gate mới phải qua negative test trước khi bật chặn".
 * Một gate chỉ chạy được trên input sạch thì là một gate chưa được kiểm thử.
 *
 *   node scripts/test-agent-preflight.mjs
 *
 * Exit 0 = tất cả đạt. Không sửa file nguồn; khôi phục git index về nguyên trạng.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const CLAIMS = join(REPO, "docs", "CLAIMS.md");
const EDITMSG = join(REPO, ".git", "COMMIT_EDITMSG");

function git(args) {
  const r = spawnSync("git", args, { cwd: REPO, encoding: "utf8" });
  return { code: r.status, out: (r.stdout || "").trim() };
}

function preflight(args, env = {}) {
  const r = spawnSync(process.execPath, [join(REPO, "scripts", "agent-preflight.mjs"), ...args], {
    cwd: REPO,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
}

const results = [];
function check(name, want, got, extra = "") {
  const pass = want === got;
  results.push({ name, want, got, pass, extra });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${pass ? "" : `  (cần ${want}, nhận ${got})`}`);
}

function staged() {
  return git(["diff", "--cached", "--name-only"]).out.split("\n").map((s) => s.trim()).filter(Boolean);
}

function resetIndex() {
  const s = staged();
  if (s.length) git(["restore", "--staged", ...s]);
}

// ── 0. khôi phục trước khi bắt đầu ───────────────────────────────────────
resetIndex();

const claimsBackup = readFileSync(CLAIMS, "utf8");
const editmsgBackup = existsSync(EDITMSG) ? readFileSync(EDITMSG, "utf8") : null;

console.log("agent-preflight — negative test\n");

// ── 1. FALSE POSITIVE: repo sạch, không staged gì ─────────────────────────
{
  const r = preflight(["--staged"]);
  check("sạch + không staged -> 0", 0, r.code, r.out);
}

// ── 2. FALSE POSITIVE: file thường, không ai giữ ──────────────────────────
{
  const r = preflight(["--for", "packages/web/src/i18n/vi.js"]);
  check("sạch + file thường -> 0", 0, r.code, r.out);
}

// ── 3. KILL-SWITCH ──────────────────────────────────────────────────────
{
  // ngay cả khi có vi phạm, kill-switch phải thoát 0
  writeFileSync(CLAIMS, claimsBackup + "\n| `zz-kill-test` | `feat/zz` | t | `AGENTS.md` | in-progress | 2026-09-27 | t |\n");
  const r = preflight(["--for", "AGENTS.md"], { AGENT_PREFLIGHT: "0" });
  check("kill-switch -> 0 dù có vi phạm", 0, r.code, r.out);
  writeFileSync(CLAIMS, claimsBackup);
}

// ── 4. NEGATIVE 1: stage file deny list, commit không có trailer ──────────
// LƯU Ý: phải TẠO THAY ĐỔI THẬT. `git add AGENTS.md` khi file trùng HEAD thì
// không stage được gì -> preflight thấy "không staged" -> OK -> test PASS SAI.
{
  const ag = join(REPO, "AGENTS.md");
  const agBackup = readFileSync(ag, "utf8");
  writeFileSync(EDITMSG, "feat: probe commit khong co trailer\n");
  writeFileSync(ag, agBackup + "\n<!-- preflight probe -->\n");
  git(["add", "AGENTS.md"]);
  const r = preflight(["--staged"]);
  check("NEG1 deny-list không trailer -> 1", 1, r.code, r.out + ` (staged: ${staged().join(",") || "RONG"})`);
  resetIndex();
  writeFileSync(ag, agBackup);
}

// ── 5. POSITIVE của check 1: CÓ trailer thì được qua ─────────────────────
{
  const ag = join(REPO, "AGENTS.md");
  const agBackup = readFileSync(ag, "utf8");
  writeFileSync(EDITMSG, `feat: probe\n\n${"Claim-Deny-List: vi du ly do"}\n`);
  writeFileSync(ag, agBackup + "\n<!-- preflight probe -->\n");
  git(["add", "AGENTS.md"]);
  const r = preflight(["--staged"]);
  check("POS1 deny-list CÓ trailer -> 0", 0, r.out.includes("rỗng") ? 0 : r.code, r.out);
  resetIndex();
  writeFileSync(ag, agBackup);
}

// ── 6. NEGATIVE 2: staged CLAIMS.md chứa dòng của agent khác ─────────────
{
  writeFileSync(EDITMSG, "docs: probe\n");
  // dòng của agent khác, không phải branch hiện tại
  writeFileSync(CLAIMS, claimsBackup + "\n| `zz-foreign-agent` | `feat/other` | t | `docs/x.md` | in-progress | 2026-09-27 | t |\n");
  git(["add", "docs/CLAIMS.md"]);
  const r = preflight(["--staged"]);
  check("NEG2 dòng claim người khác -> 1", 1, r.code, r.out);
  resetIndex();
  writeFileSync(CLAIMS, claimsBackup);
}

// ── 7. NEGATIVE 3: file đang bị agent khác giữ in-progress ───────────────
{
  writeFileSync(CLAIMS, claimsBackup + "\n| `zz-holder` | `feat/held` | t | `docs/held-by-zz.md` | in-progress | 2026-09-27 | t |\n");
  const r = preflight(["--for", "docs/held-by-zz.md"]);
  check("NEG3 file bị giữ in-progress -> 1", 1, r.code, r.out);
  writeFileSync(CLAIMS, claimsBackup);
}

// ── 8. POSITIVE của check 3: claim của chính mình thì không bị chặn ──────
{
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]).out;
  const key = branch.replace(/^feat\//, "").replace(/^fix\//, "").replace(/^docs\//, "").replace(/^chore\//, "");
  writeFileSync(CLAIMS, claimsBackup + `\n| \`${key}\` | \`${branch}\` | t | \`docs/mine.md\` | in-progress | 2026-09-27 | t |\n`);
  const r = preflight(["--for", "docs/mine.md"]);
  check("POS3 claim của chính mình -> 0", 0, r.code, r.out);
  writeFileSync(CLAIMS, claimsBackup);
}

// ── 9. CHECK 2 phải chạy (mode bắt buộc) ────────────────────────────────
{
  const r = preflight([]);
  check("không có --staged/--for -> 2", 2, r.code, r.out);
}

// ── khôi phục ───────────────────────────────────────────────────────────
resetIndex();
writeFileSync(CLAIMS, claimsBackup);
if (editmsgBackup === null) rmSync(EDITMSG, { force: true });
else writeFileSync(EDITMSG, editmsgBackup);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} đạt`);
if (failed.length) {
  console.log("\nCHI TIẾT FAIL:");
  for (const f of failed) console.log(`  ${f.name}\n${f.extra}`);
}
const leftover = staged();
if (leftover.length) console.log(`\nCẢNH BÁO: còn staged sót: ${leftover.join(", ")}`);
process.exit(failed.length ? 1 : 0);
