/**
 * test-agent-preflight.mjs — negative test cho agent-preflight.mjs
 *
 * BAT BIEN (ke hoach §7): "moi gate moi phai qua negative test truoc khi bat chan".
 * Mot gate chi chay duoc tren input sach thi la mot gate CHUA DUOC KIEM THU.
 * Gate chay exit 0 ma khong inject loi de kiem la gate rong.
 *
 *   node scripts/test-agent-preflight.mjs
 *
 * Exit 0 = tat ca dat.
 *
 * ── VI SAO DUNG TEMP FIXTURE, KHONG SUA FILE THAT ─────────────────────────
 * Ban dau bo nay sua TRUC TIEP file that cua repo dang chay:
 *   docs/CLAIMS.md, AGENTS.md, .git/COMMIT_EDITMSG
 * Hai hau qua that:
 *   1. RACE: neu ai `git add -A` dung luc test dang chay, dong probe
 *      (`zz-foreign-agent`, `zz-holder`) loot vao commit that.
 *   2. Test khong chay duoc o repo khong co CLAIMS.md — nen ban preflight
 *      trong repo phai HARDCODE danh sach deny list, tach fork khoi ban
 *      canonical (audit C-1: hai ban drift, logic tu thich ung o repo co
 *      protocol la duy nhat lai khong bao gio chay).
 * Fixture temp giai quyet ca hai: khong cham file that, va canonical duoc
 * kiem chung o BAT KY repo nao.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Script preflight can test nam canh ban canonical (tools/), khong nam trong scripts/
const PREFLIGHT = resolve(__dirname, "..", "opencode-global", "agent-preflight.mjs");

function git(args, cwd) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { code: r.status, out: (r.stdout || "").trim() };
}

// ── tao fixture: git repo toi thieu co CLAIMS.md + AGENTS.md ──────────────
const FIX = mkdtempSync(join(tmpdir(), "preflight-fix-"));
const CLAIMS_REL = join("docs", "CLAIMS.md");
const AGENTS_REL = "AGENTS.md";
const HELD_REL = join("docs", "held-by-zz.md");
const MINE_REL = join("docs", "mine.md");

const CLAIMS_BASE = [
  "| agent | branch | task | files | status | date | note |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  "",
].join("\n");

function resetFixture() {
  rmSync(join(FIX, ".git"), { recursive: true, force: true });
  rmSync(join(FIX, "docs"), { recursive: true, force: true });
  rmSync(join(FIX, AGENTS_REL), { force: true });
  git(["init", "-q", "-b", "feat/probe"], FIX);
  git(["config", "user.email", "probe@test.local"], FIX);
  git(["config", "user.name", "probe"], FIX);
  mkdirSync(join(FIX, "docs"), { recursive: true });
  writeFileSync(join(FIX, AGENTS_REL), "# probe\n");
  writeFileSync(join(FIX, CLAIMS_REL), CLAIMS_BASE);
  git(["add", "-A"], FIX);
  git(["commit", "-q", "-m", "fixture base"], FIX);
}

function setClaims(body) {
  writeFileSync(join(FIX, CLAIMS_REL), CLAIMS_BASE + body);
}
function commitMsg(text) {
  writeFileSync(join(FIX, ".git", "COMMIT_EDITMSG"), text);
}
function preflight(args, env = {}) {
  const r = spawnSync(process.execPath, [PREFLIGHT, ...args], {
    cwd: FIX,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
}
function staged() {
  return git(["diff", "--cached", "--name-only"], FIX).out.split("\n").filter(Boolean);
}
function resetIndex() {
  const s = staged();
  if (s.length) git(["restore", "--staged", ...s], FIX);
}

const results = [];
function check(name, want, got, extra = "") {
  const pass = want === got;
  results.push({ name, want, got, pass, extra });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${pass ? "" : `  (can ${want}, nhan ${got})`}`);
}

const CLAIM_MINE = "\n| `probe` | `feat/probe` | t | `docs/mine.md` | in-progress | 2026-09-27 | t |\n";

console.log("agent-preflight — negative test (temp fixture)\n");

try {
  resetFixture();

  // 1. FALSE POSITIVE: repo sach, khong staged gi
  check("sach + khong staged -> 0", 0, preflight(["--staged"]).code);

  // 2. FALSE POSITIVE: file thuong, khong ai giu
  check("sach + file thuong -> 0", 0, preflight(["--for", "docs/mine.md"]).code);

  // 3. KILL-SWITCH: co vi pham nhung AGENT_PREFLIGHT=0 van 0
  setClaims(CLAIM_MINE);
  check("kill-switch -> 0 du co vi pham", 0, preflight(["--for", "AGENTS.md"], { AGENT_PREFLIGHT: "0" }).code);

  // 4. NEGATIVE 1: stage file deny list, commit khong co trailer
  //    Phai TAO THAY DOI THAT: `git add` file trung HEAD thi khong stage duoc
  //    -> preflight thay "khong staged" -> OK -> test PASS SAI.
  {
    writeFileSync(join(FIX, AGENTS_REL), "# probe\n<!-- probe -->\n");
    commitMsg("feat: probe khong co trailer\n");
    git(["add", AGENTS_REL], FIX);
    const r = preflight(["--staged"]);
    check("NEG1 deny-list khong trailer -> 1", 1, r.code, `${r.out} (staged: ${staged().join(",") || "RONG"})`);
    resetIndex();
  }

  // 5. POSITIVE check 1: CO trailer thi duoc qua
  {
    writeFileSync(join(FIX, AGENTS_REL), "# probe\n<!-- probe2 -->\n");
    commitMsg("feat: probe\n\nClaim-Deny-List: vi du ly do\n");
    git(["add", AGENTS_REL], FIX);
    const r = preflight(["--staged"]);
    check("POS1 deny-list CO trailer -> 0", 0, r.code, r.out);
    resetIndex();
  }

  // 6. NEGATIVE 2: staged CLAIMS.md chua dong cua agent khac
  //    Phai co CA 2 dong: dong cua chinh minh + dong nguoi khac.
  //    Ly do: preflight chi bat loi khi `keys.size > 0` (agent-preflight.mjs:187)
  //    — tuc chi khi CLAIMS.md DA biet toi bang chinh branch. Neu chi co dong
  //    nguoi khac thi keys rong va check im lang.
  //    Test cu chay tren repo THAT pass tinh co: CLAIMS.md that da co san dong
    //    khop branch hien tai, nen `keys` khong rong. Day la false pass do
  //    moi truong, khong phai vi logic sai — va la ly do phai co fixture.
  {
    setClaims(CLAIM_MINE + "\n| `zz-foreign-agent` | `feat/other` | t | `docs/x.md` | in-progress | 2026-09-27 | t |\n");
    commitMsg("docs: probe\n");
    git(["add", CLAIMS_REL], FIX);
    const r = preflight(["--staged"]);
    check("NEG2 dong claim nguoi khac -> 1", 1, r.code, r.out);
    resetIndex();
  }

  // 6b. NEGATIVE 2b: chi dong nguoi khac, khong co dong cua minh -> 0
  //     (phai im lang, dung quy tac keys.size)
  {
    setClaims("\n| `zz-foreign-agent` | `feat/other` | t | `docs/x.md` | in-progress | 2026-09-27 | t |\n");
    git(["add", CLAIMS_REL], FIX);
    const r = preflight(["--staged"]);
    check("NEG2b chi dong nguoi khac -> 0 (keys rong)", 0, r.code, r.out);
    resetIndex();
  }

  // 7. NEGATIVE 3: file dang bi agent khac giu in-progress
  {
    setClaims(`\n| \`zz-holder\` | \`feat/held\` | t | \`${HELD_REL.split("\\").join("/")}\` | in-progress | 2026-09-27 | t |\n`);
    const r = preflight(["--for", HELD_REL.split("\\").join("/")]);
    check("NEG3 file bi giu in-progress -> 1", 1, r.code, r.out);
  }

  // 8. POSITIVE check 3: claim cua chinh minh thi khong bi chan
  {
    setClaims(CLAIM_MINE);
    const r = preflight(["--for", MINE_REL.split("\\").join("/")]);
    check("POS3 claim cua chinh minh -> 0", 0, r.code, r.out);
  }

  // 9. CHECK 2 phai chay (mode bat buoc)
  check("khong co --staged/--for -> 2", 2, preflight([]).code);

  // 10. REPO KHONG CO CLAIMS.md — phai chay 2/3 va im lang (khong that bai)
  {
    rmSync(join(FIX, CLAIMS_REL), { force: true });
    git(["add", "-A"], FIX);
    git(["commit", "-q", "-m", "drop claims"], FIX);
    writeFileSync(join(FIX, "README.md"), "# x\n");
    commitMsg("docs: probe\n");
    git(["add", "README.md"], FIX);
    const r = preflight(["--staged"]);
    check("repo khong co CLAIMS.md + file thuong -> 0", 0, r.code, r.out);
    resetIndex();
  }
} finally {
  rmSync(FIX, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} dat`);
if (failed.length) {
  console.log("\nCHI TIET FAIL:");
  for (const f of failed) console.log(`  ${f.name}\n${f.extra}`);
}
if (existsSync(join(FIX, "docs"))) console.log("\nCANH BAO: fixture chua duoc xoa");
process.exit(failed.length ? 1 : 0);
