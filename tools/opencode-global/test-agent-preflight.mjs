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
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
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
  //    Ly do: preflight chi bat loi khi `keys.size > 0` — tuc chi khi CLAIMS.md DA
  //    biet toi bang chinh branch. Neu chi co dong nguoi khac thi keys rong va
  //    check2 im lang; CHECK 4 chan truoc do (xem NEG4).
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

  // 6b. (XOA - xem NEG4) Truoc day: "chi dong nguoi khac -> 0 (keys rong)".
  //     DO la hanh vi SAI duoc gan ten la quy tac. Do la fail-open: preflight
  //     im lang cho phep append dong claim cua nguoi khac, va khong bao gi.
  //     Nay la hanh vi moi — xem NEG4.

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

  // 8b. REGRESSION — TU KHOA COMMIT CUA CHINH MINH (loi that, 2026-09-28)
  //     Branch `feat/probe`, dong claim ten agent `core-team` (khac ten branch).
  //     Truoc day `myClaimKeys` khop bang `branch.includes(agent)` => KHONG khop
  //     => keys rong => dong cua MINH bi coi la cua nguoi khac => check3 chan
  //     file ma ban vua khai claim. Nay KHONG phai edge case: mau trong
  //     MANDATORY_WORKFLOW_GUIDE dong 50 (`ten-agent` + `feat/ten-slice`) chinh
  //     la mau gay loi nay.
  //     Nay: khop qua COT BRANCH (quy tac b) => phai 0.
  {
    setClaims("\n| `core-team` | `feat/probe` | t | `docs/mine.md` | in-progress | 2026-09-27 | t |\n");
    const r = preflight(["--for", MINE_REL.split("\\").join("/")]);
    check("POS4 ten agent khac ten branch, cot branch khop -> 0 (het tu khoa)", 0, r.code, r.out);
    check("POS4b canh bao TEN bat len", true, /\[claim-name\]/.test(r.out), r.out);
  }

  // 8c. REGRESSION — FALSE NEGATIVE DO `branch.includes(agent)` (loi that)
  //     Agent ten `ob` la CHUOI CON cua branch `feat/probe`. Ban doan
  //     `branch.includes("ob")` = true => keys chua `ob` => check3 BO QUA canh
  //     bao "file dang bi agent khac giu". Do la fail-open im lang: cho phep sua
  //     file cua nguoi khac ma khong bao gi.
  //     Nay bo hoan toan `branch.includes` => phai 1.
  {
    setClaims(
      CLAIM_MINE + "\n| `ob` | `feat/other` | t | `docs/mine.md` | in-progress | 2026-09-27 | t |\n",
    );
    const r = preflight(["--for", MINE_REL.split("\\").join("/")]);
    check("NEG5 ten agent la chuoi con cua branch -> 1 (het bo qua hazard)", 1, r.code, r.out);
  }

  // 8d. HOP DONG MOI — khong xac dinh duoc dong nao la cua minh
  //     Chi co dong cua agent KHAC, khong co dong nao khop branch `feat/probe`,
  //     va staged file cham mot trong cac file no giu `in-progress`.
  //     Truoc day: keys rong => fail-open => 0. Nay: CHECK 4 chan va noi ro
  //     nguyen nhan. Thay doi hanh vi CO CHU DICH, khong phai regression.
  //     Luu y: staged phai la file thuoc claim, KHONG phai `docs/CLAIMS.md` —
  //     registry duoc mien trong check3 (POS8) va check4 bo qua no.
  {
    setClaims(
      "\n| `zz-foreign-agent` | `feat/other` | t | `docs/mine.md` | in-progress | 2026-09-27 | t |\n",
    );
    writeFileSync(join(FIX, MINE_REL), "noi dung doi\n", "utf8");
    git(["add", "-A"], FIX);
    const r = preflight(["--staged"]);
    check("NEG4 khong xac dinh duoc danh tinh claim -> 1 (thay fail-open)", 1, r.code, r.out);
    check("NEG4b bao ro CHINH check nao", true, /\[claim-identity\]/.test(r.out), r.out);
    resetIndex();
  }

  // 8e. CHECK 4 phai IM LANG khi khong co claim nao (guide §6: mot minh, mot repo)
  {
    setClaims("\n| Trạng thái | Ý nghĩa |\n|---|---|\n| in-progress | Đang sửa |\n| done | Xong, chưa merge |\n");
    const r = preflight(["--for", MINE_REL.split("\\").join("/")]);
    check("POS5 chi bang chu giai trang thai, khong co claim -> 0 (khong hoang loi)", 0, r.code, r.out);
  }

  // 8f. DANH TINH — trade-off DA BIET, ghim lai de khong quen
  //     Dong STALE cua agent da chet tren CUNG branch se duoc quy (b) gan vao
  //     "cua minh" => file no giu khong con bi bao ve. Chon dung doi nay vi
  //     (b) la thu giup self-block ma khong doan; hanh dong giu phai tach
  //     `in-progress` -> `done` truoc khi ban nhan viec.
  //     Test nay PHAI doi neu mot ngay nao quyet dinh doi quy tac.
  {
    setClaims(CLAIM_MINE + "\n| `zz-stale` | `feat/probe` | t | `docs/mine.md` | in-progress | 2026-09-27 | t |\n");
    const r = preflight(["--for", MINE_REL.split("\\").join("/")]);
    check("KNOWN1 dong stale cung branch -> 0 (trade-off da biet, co canh bao)", 0, r.code, r.out);
    check("KNOWN1b canh bao van bat len de agent doi ten dong stale", true, /zz-stale/.test(r.out), r.out);
  }

  // 8g. REGRESSION — chen LF khi CLAIMS.md khong ket thuc bang LF (gap that o
  //     PR #20/#23/#31). Git ghi dong cuoi cua file thanh 1 dong `-` + 1 dong `+`
  //     voi NOI DUNG GIONG HET nhau. Check2 phai bo qua, neu khong preflight chan
  //     chinh thao tac sua ma guide §1 bat buoc.
  //     Do bo bang: commit noi dung giong het dong truoc do.
  {
    writeFileSync(join(FIX, CLAIMS_REL), CLAIMS_BASE + CLAIM_MINE); // khong LF cuoi
    git(["add", "-A"], FIX);
    git(["commit", "-q", "-m", "claim khong LF cuoi"], FIX);
    writeFileSync(join(FIX, CLAIMS_REL), CLAIMS_BASE + CLAIM_MINE + "\n"); // chen LF
    git(["add", CLAIMS_REL], FIX);
    const r = preflight(["--staged"]);
    check("POS7 chen LF cuoi file -> 0 (khong phai foreign-claim)", 0, r.code, r.out);
    resetIndex();
  }

  // 8h. REGRESSION — registry CLAIMS.md dang bi agent KHAC giu in-progress
  //     Thi moi agent deu phai append dong claim cua minh vao chinh file nay. Neu
  //     check3 chan no, thi khong agent nao khai claim duoc. Da gap that: claim
  //     `portfolio-exec-plan` giu `docs/CLAIMS.md` o trang thai in-progress.
  //     Dong cua agent khac phai da COMMIT (khong nam trong diff) neu khong thoi
  //     check2 bat dung — dung no de kiem tra rieng check3.
  {
    const HELD_REGISTRY =
      "\n| `zz-holder` | `feat/other` | t | `docs/CLAIMS.md` | in-progress | 2026-09-27 | t |\n";
    writeFileSync(join(FIX, CLAIMS_REL), CLAIMS_BASE + HELD_REGISTRY);
    git(["add", "-A"], FIX);
    git(["commit", "-q", "-m", "foreign row claims the registry"], FIX);
    setClaims(CLAIM_MINE + HELD_REGISTRY);
    git(["add", CLAIMS_REL], FIX);
    const r = preflight(["--staged"]);
    check("POS8 registry dang bi agent khac giu -> 0 (van append duoc)", 0, r.code, r.out);
    resetIndex();
  }

  // 8i. PHAI CHAN — sua NOI DUNG that cua dong cua agent KHAC
  //     Noi dung doi that nen KHONG con trong `removed` => check2 phai bat.
  //     Day la bien canh cua POS7: POS7 bo qua khi noi dung GIONG HET, 8i bat
  //     khi noi dung KHAC. Khong co 8i thi POS7 co the che doan sai.
  {
    const cur = readFileSync(join(FIX, CLAIMS_REL), "utf8");
    writeFileSync(join(FIX, CLAIMS_REL), cur.replace("`docs/CLAIMS.md`", "`docs/STEALEN.md`"));
    git(["add", CLAIMS_REL], FIX);
    const r = preflight(["--staged"]);
    check("NEG6 sua noi dung that cua dong NGUOI KHAC -> 1", 1, r.code, r.out);
    check("NEG6b bat dung bang foreign-claim", true, /\[foreign-claim\]/.test(r.out), r.out);
    resetIndex();
    git(["checkout", "--", CLAIMS_REL], FIX);
  }

  // 8j. POSITIVE — sua noi dung dong cua CHINH MINH van duoc phep
  {
    const cur = readFileSync(join(FIX, CLAIMS_REL), "utf8");
    writeFileSync(join(FIX, CLAIMS_REL), cur.replace("`docs/mine.md`", "`docs/mine2.md`"));
    git(["add", CLAIMS_REL], FIX);
    const r = preflight(["--staged"]);
    check("POS9 sua noi dung dong cua MINH -> 0", 0, r.code, r.out);
    resetIndex();
    git(["checkout", "--", CLAIMS_REL], FIX);
  }

  // 8k. REGRESSION — branch KHONG co dong claim nen phai im lang
  //     Do that: khi chay pre-push gate tren branch moi (chi docs, khong co dong
  //     claim nao khop branch) ma repo co dang claim `in-progress` cua agent khac,
  //     check 4 bao `claim-identity` va CHAN — chan ca commit hop le.
  //     Gate lo ra bang test `hook-mode` trong verify-hook-mode.mjs (FAIL 1/13).
  //     Doan sai chi huong khi file staged thuc su cham claim in-progress.
  {
    setClaims(
      "\n| `zz-holder` | `feat/other` | t | `docs/NEVER_STAGED.md` | in-progress | 2026-09-27 | t |\n",
    );
    git(["add", CLAIMS_REL], FIX);
    const r = preflight(["--for", "README.md"]);
    check("POS10 branch khong co claim, staged file khong bi giu gi -> 0", 0, r.code, r.out);
    resetIndex();
  }

  // 8l. NHUNG van phai chan khi co that — bien canh cua POS10
  {
    setClaims(
      "\n| `zz-holder` | `feat/other` | t | `docs/held.md` | in-progress | 2026-09-27 | t |\n",
    );
    const r = preflight(["--for", "docs/held.md"]);
    // keys rong (branch `feat/probe` khong co dong nao) + file cham claim giữ
    // => phai bao `claim-identity`, khong duoc im lang.
    check("NEG7 branch khong co claim NHUNG staged file bi giu -> 1", 1, r.code, r.out);
    check("NEG7b bao dung claim-identity", true, /\[claim-identity\]/.test(r.out), r.out);
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
