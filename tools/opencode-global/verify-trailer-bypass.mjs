/**
 * verify-trailer-bypass.mjs — bang chung cho loi "trailer substring".
 *
 * Lỗi: check1 dùng `msg.includes("Claim-Deny-List:")` (agent-preflight.mjs:153).
 * Một commit body CHỈ NHẮC TỚI chuỗi đó — không phải trailer thật — sẽ bypass
 * được check deny-list. Không phải lý thuyết: audit vòng 2 đã dựng được, và
 * probe này dựng lại độc lập.
 *
 * Test này chạy trên TEMP FIXTURE, không chạm file thật.
 *
 *   node tools/opencode-global/verify-trailer-bypass.mjs
 * Exit 0 = bypass ĐÃ Bị chặn (fix còn hiệu lực). Exit 1 = bypass còn sống.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PREFLIGHT = join(HERE, "agent-preflight.mjs");

const FIX = mkdtempSync(join(tmpdir(), "trailer-probe-"));

function git(args) {
  const r = spawnSync("git", args, { cwd: FIX, encoding: "utf8" });
  return (r.stdout || "").trim();
}

function run(msg) {
  writeFileSync(join(FIX, ".git", "COMMIT_EDITMSG"), msg);
  const r = spawnSync(process.execPath, [PREFLIGHT, "--staged"], { cwd: FIX, encoding: "utf8" });
  return r.status;
}

const cases = [
  {
    name: "bypass: commit body CHI NHAC trailer, khong phai trailer that",
    msg: "docs: ghi chu ban ve Claim-Deny-List: trong cuoc hop nay\n\nKhong phai trailer.\n",
    want: 1,
  },
  {
    name: "bypass 2: nhac trong bullet giua commit body",
    msg: "chore: don dep\n\n- xem lai quy tac Claim-Deny-List: cho coordinator\n- them tai lieu\n",
    want: 1,
  },
  {
    name: "hop le: trailer THAT o dong dau, co ly do",
    msg: "chore: sua package.json\n\nClaim-Deny-List: doi ten 1 script, coordinator da duyet\n",
    want: 0,
  },
];

let failed = 0;
console.log("verify-trailer-bypass — probe bypass trailer\n");

try {
  git(["init", "-q", "-b", "feat/probe"]);
  git(["config", "user.email", "p@t.local"]);
  git(["config", "user.name", "p"]);
  mkdirSync(join(FIX, "docs"), { recursive: true });
  writeFileSync(join(FIX, "AGENTS.md"), "# a\n");
  writeFileSync(join(FIX, "docs", "CLAIMS.md"), "| agent | branch |\n| --- | --- |\n");
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "base"]);

  for (const c of cases) {
    // stage thay doi that tren AGENTS.md (deny list) — git add file trung HEAD
    // thi khong stage duoc, preflight se thay "khong staged" va pass SAI.
    writeFileSync(join(FIX, "AGENTS.md"), "# a\n<!-- probe -->\n");
    git(["add", "AGENTS.md"]);
    const got = run(c.msg);
    const pass = got === c.want;
    if (!pass) failed += 1;
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${c.name}  (can ${c.want}, nhan ${got})`);
    git(["restore", "--staged", "AGENTS.md"]);
  }
} finally {
  rmSync(FIX, { recursive: true, force: true });
}

console.log(`\n${cases.length - failed}/${cases.length} dat`);
if (failed) {
  console.log("  => BYPASS VAN SONG. check1 van dung `includes()` — can chuyen sang regex /^Claim-Deny-List:.+/m");
} else {
  console.log("  => bypass da bi chan.");
}
process.exit(failed ? 1 : 0);
