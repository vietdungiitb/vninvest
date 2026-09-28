/**
 * pre-push gate — bù cho việc bỏ PR (Copilot hết quota PR).
 *
 * Push thẳng vào `dev` mất điểm review ở GitHub, nên toàn bộ kiểm tra phải
 * chuyển về chạy cục bộ và FAIL-CLOSED: script chỉ exit 0 khi TẤT CẢ gate
 * xanh. Bỏ qua (skip) được thì gate đó coi như KHÔNG chạy, không phải PASS.
 *
 * Mọi gate đều là negative probe: nếu gate đó pass kể cả khi mã sai thì nó
 * đang hỏng, nên ta kiểm tra ngược — xem nó có thật sự bắt lỗi không.
 *
 * Dùng:  node scripts/pre-push-gate.mjs
 * Kill:  SKIP_PRE_PUSH_GATE=1
 *
 * ── HÀNH VI KHI CHẠY Ở REPO KHÔNG PHẢI vninvest ────────────────────────────
 * Mọi gate đều có existsSync-guard, nên ở repo lạ chúng SKIP (không phải PASS)
 * và thoát 0. Đã đo: repo git trắng chỉ chứa gate này → 2 PASS / 7 SKIP / exit 0.
 * Nghĩa là gate PORTABLE (không phụ thuộc vninvest) nhưng ở repo khác gần như
 * không kiểm gì. Đó là hệ quả tất yếu của nguyên tắc SKIP ≠ PASS: thiếu
 * config phải báo "chưa có" chứ không báo "xanh". Muốn có tầng thật ở repo
 * khác thì copy `tools/opencode-global/` + `.husky/pre-push` sang, không phải
 * chỉ copy file gate này.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(fileURLToPath(import.meta.url), "../..");

if (process.env.SKIP_PRE_PUSH_GATE === "1") {
  console.log("pre-push-gate: SKIP_PRE_PUSH_GATE=1 — BO QUA (khong phai PASS)");
  process.exit(0);
}

let failed = 0;
let passed = 0;
let skipped = 0;

const ok = (name, note = "") => {
  passed += 1;
  console.log(`  PASS  ${name}${note ? " — " + note : ""}`);
};
const bad = (name, detail) => {
  failed += 1;
  console.log(`  FAIL  ${name}`);
  for (const line of String(detail).split("\n")) {
    if (line.trim()) console.log("          " + line.trim().slice(0, 160));
  }
};
const skip = (name, why) => {
  skipped += 1;
  console.log(`  SKIP  ${name} — ${why}`);
};

const IS_WIN = process.platform === "win32";

/**
 * `npx`/`npm` tren Windows la shim `.cmd`, khong phai executable that — goi
 * spawnSync voi shell:false se tra ENOENT va `status === null`.
 *
 * KHONG duoc bao gio report "0 loi" khi `status === null`: do la "chua chay
 * duoc", khong phai "chay roi khong thay loi". Da gap that — gate bao FAIL
 * "0 loi" va chan moi push tren Windows trong khi lenh chua chay bao gio.
 */
function run(cmd, args, cwd = REPO) {
  const exe = IS_WIN && /^(npm|npx|yarn|pnpm)$/.test(cmd) ? cmd + ".cmd" : cmd;
  const r = spawnSync(exe, args, { cwd, encoding: "utf8", shell: false, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) {
    return { code: null, out: "", launchError: `${r.error.code || "ERR"}: ${r.error.message}` };
  }
  if (r.status === null) {
    return { code: null, out: (r.stdout || "") + (r.stderr || ""), launchError: `tiet truc ${exe}, khong co exit code` };
  }
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

// ---------------------------------------------------------------- syntax gate
// `node --check` trên mọi script .mjs đã sửa — chặn lỗi require/ESM (đã xảy ra
// 1 lần trong phiên 2026-09-27: file .mjs dùng require => ReferenceError).
function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(mjs|js)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const SCRIPT_DIRS = ["scripts", join("packages", "web", "scripts")];
const targets = SCRIPT_DIRS.flatMap((d) => walk(join(REPO, d)));
if (targets.length === 0) {
  bad("syntax", "khong tim thay file .mjs/.js nao de check");
} else {
  const broken = [];
  for (const f of targets) {
    const r = run(process.execPath, ["--check", f]);
    if (r.code !== 0) broken.push(`${relative(REPO, f)}: ${r.out.split("\n").find((l) => /Error/.test(l)) || "syntax error"}`);
  }
  if (broken.length) bad("syntax", broken.join("\n"));
  else ok("syntax", `${targets.length} file .mjs/.js`);
}

// ------------------------------------------------------------ encoding gate
// Hazard 5 (ghi trong AGENTS.md): lỗi encoding/parse la nguyen nhan so 1
// lam test FAIL o phien nay. U+FFFD trong file van la ky tu thay the.
//
// CHỈ quét file ĐÃ ĐỔI trong lần push này. Quét toàn repo se chặn vĩnh viễn
// vi no gay cua cac commit khac (da do la 7 file docs/ co U+FFFD truoc day) —
// debt khong phai cua commit dang push thi khong duoc gan vao gate nay.
const ENC_EXT = /\.(mjs|js|md|json|ts|tsx|css|yml|yaml)$/;
// `git diff` KHONG thay file untracked — va untracked chinh la file moi vua
// viet, lech loai de sinh U+FFFD nhat. Phai lay them bang `ls-files --others`.
// Bo phan nay thi gate im lang bo qua dung file can bao ve.
//
// KHONG hardcode `origin/dev`: repo khac dung base branch khac (main/master/
// trunk…) se bo sot moi thay da commit. Audit vòng 2 da chi ra caveat nay.
//
// CHON MOT BASE, KHONG UNION: truoc day quet ca 4 base branch, `origin/main`
// o day lech 1014 file voi `dev` (release line khac) => quet 1018 file thay vi
// vai, cham hon va lan theo no se bao loi cua nguoi khac. Thu `HEAD` truoc,
// roi dung base dau tien that su ton tai, roi moi den phan chua commit.
const changed = run(process.execPath, [
  "-e",
  `const {execSync}=require("child_process");
   const out=[];
   const sh=(c)=>{ try { return execSync(c,{encoding:"utf8",stdio:["ignore","pipe","ignore"]}); } catch { return null; } };
   sh("git diff --name-only HEAD...@{upstream}");
   for (const b of ["origin/dev","origin/main","origin/master","origin/trunk"]) {
     const r = sh("git diff --name-only "+b+"...HEAD");
     if (r !== null) { out.push(r); break; }   // CHI base dau tien ton tai
   }
   out.push(sh("git diff --name-only") || "");
   out.push(sh("git diff --name-only --cached") || "");
   out.push(sh("git ls-files --others --exclude-standard") || "");
   process.stdout.write(out.join("\\n"));`,
]);
const changedSet = [
  ...new Set(
    changed.out
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  ),
];
const encBad = [];
const encAllowed = [];
let encCount = 0;

// File CÓ U+FFFD mot cach CO Y (tai lieu trich dan mojibake lam bang chung).
// Van duoc in ra hang ALLOW — khong bao gio im lang bo qua. Danh sach kem LY DO;
// bo mot file khoi danh sach trong khi file do con U+FFFD thi gate FAIL, tuc
// danh sach khong the dung de giu mot loi that.
const ALLOW_FILE = join(REPO, "tools/opencode-global/encoding-allowlist.txt");
const allow = new Set();
if (existsSync(ALLOW_FILE)) {
  for (const raw of readFileSync(ALLOW_FILE, "utf8").split("\n")) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const p = line.split("|")[0].trim();
    if (p) allow.add(p.split("\\").join("/"));
  }
}

for (const rel of changedSet) {
  if (!ENC_EXT.test(rel)) continue;
  const f = join(REPO, rel);
  if (!existsSync(f) || !statSync(f).isFile()) continue;
  if (statSync(f).size > 4_000_000) continue;
  encCount += 1;
  const t = readFileSync(f, "utf8");
  const n = (t.match(/\uFFFD/g) || []).length;
  if (n === 0) continue;
  if (allow.has(rel)) encAllowed.push(`${rel}: ${n} U+FFFD (CO Y — xem encoding-allowlist.txt)`);
  else encBad.push(`${rel}: ${n} ky tu U+FFFD`);
}
if (encBad.length) bad("encoding", encBad.join("\n"));
for (const a of encAllowed) console.log(`  ALLOW encoding — ${a}`);
if (!encBad.length) ok("encoding", `${encCount}/${changedSet.length} file da doi, 0 U+FFFD ngoai allowlist`);

// --------------------------------------------------------- i18n fail-closed
// Scanner in loi roi van exit 0. Wrapper bat scanner va phai fail-closed.
if (existsSync(join(REPO, "scripts/i18n-scan-strict.mjs"))) {
  const r = run(process.execPath, ["scripts/i18n-scan-strict.mjs"]);
  if (r.code !== 0) bad("i18n-strict", r.out);
  else ok("i18n-strict", "code sach, exit 0");
} else skip("i18n-strict", "khong co scripts/i18n-scan-strict.mjs");

// ----------------------------------------------------- status claim freshness
if (existsSync(join(REPO, "scripts/audit-status-claims.mjs"))) {
  const r = run(process.execPath, ["scripts/audit-status-claims.mjs", "--strict"]);
  if (r.code !== 0) bad("audit-status", r.out);
  else ok("audit-status", "0 dong thieu verified, --strict exit 0");
} else skip("audit-status", "khong co scripts/audit-status-claims.mjs");

// ------------------------------------------------- preflight self-test (11/11)
// Gate co that su bat loi khong? Chay negative test cua chinh no.
// Ban nay dung TEMP FIXTURE nen khong cham file that cua repo.
const preTest = join(REPO, "tools/opencode-global/test-agent-preflight.mjs");
if (existsSync(preTest)) {
  const r = run(process.execPath, [preTest]);
  if (r.code !== 0) bad("preflight-selftest", r.out);
  else ok("preflight-selftest", (r.out.match(/(\d+)\/\d+/) || ["?"])[0] + " negative test");
} else skip("preflight-selftest", "khong tim thay tools/opencode-global/test-agent-preflight.mjs");

// ------------------------------------------------- drift ~/.opencode/ vs git
// Canonical trong git la su that khu 1; ~/.opencode/ la ban deploy. Khong so
// sanh thi mirror se tro thanh "drift cho den khi ai do phat hien".
if (existsSync(join(REPO, "scripts/verify-global-config.mjs"))) {
  const r = run(process.execPath, ["scripts/verify-global-config.mjs"]);
  if (r.code !== 0) bad("global-config-drift", r.out);
  else ok("global-config-drift", (r.out.match(/(\d+)\/\d+ khop het/) || ["?"])[0]);
} else skip("global-config-drift", "khong co scripts/verify-global-config.mjs");

// ------------------------------------------------------------- shim delegate
// scripts/agent-preflight.mjs phai THAT SU chay ban canonical. Neu no la mot
// ban sao rieng, logic "tu thich ung" o repo co protocol se khong bao gio
// chay — dung chinh hang drift C-1. Gate nay chung minh bang cach sua mot
// hang trong canonical roi xem shim co in ra hang do khong.
const shimCheck = join(REPO, "tools/opencode-global/verify-shim.mjs");
if (existsSync(shimCheck)) {
  const r = run(process.execPath, [shimCheck]);
  if (r.code !== 0) bad("shim-delegate", r.out);
  else ok("shim-delegate", "scripts/agent-preflight.mjs chay canonical that");
} else skip("shim-delegate", "khong co tools/opencode-global/verify-shim.mjs");

// ------------------------------------------------------- preflight probes
// Hai probe sau KHONG phai gate cua repo nay — chung la bang chung cho
// preflight co that su chay dung hay khong. Chay o repo nao co canonical.
for (const [id, f, note] of [
  ["preflight-trailer", "verify-trailer-bypass.mjs", "bypass noi chuoi Claim-Deny-List"],
  ["preflight-deny-extract", "verify-deny-extract.mjs", "trich duoc het muc §2 tu docs"],
  ["hook-mode", "verify-hook-mode.mjs", "block/warn/trailer tren may nay"],
  ["i18n-strict-selftest", "verify-i18n-strict.mjs", "bat loi parse cua scanner that"],
]) {
  const p = join(REPO, "tools/opencode-global", f);
  if (existsSync(p)) {
    const r = run(process.execPath, [p]);
    if (r.code !== 0) bad(id, r.out);
    else ok(id, note);
  } else skip(id, `khong co tools/opencode-global/${f}`);
}

// ------------------------------------------------------------- type-check
// tsc --noEmit re (~giay) nen dua vao pre-push. Full test suite (jest/vitest)
// qua cham — nam o agent-sync.ps1, khong dua vao day.
const WEB = join(REPO, "packages", "web");
const TSC_ENTRY = join("node_modules", "typescript", "bin", "tsc");
if (existsSync(join(WEB, "tsconfig.json"))) {
  // Ba loi phai tranh, deu da gap that tren Windows:
  //   (a) `run` mac dinh cwd = RE nen `-p tsconfig.json` tro toi tsconfig goc.
  //   (b) tu repo root `npx tsc` resolve dung package `tsc` DEPRECATED
  //       ("not the tsc command you are looking for", exit 1, KHONG in loi).
  //   (c) `npx` la shim `.cmd`; Node >=18.20/20.12/22 chan spawn .cmd/.bat
  //       khi shell:false (CVE-2024-27980) → EINVAL.
  // Giai quyet ca ba: goi thang entry JS cua TypeScript bang `node`, khong shell.
  const r = existsSync(join(WEB, TSC_ENTRY))
    ? run(process.execPath, [TSC_ENTRY, "--noEmit", "-p", "tsconfig.json"], WEB)
    : { code: null, out: "", launchError: `khong tim thay ${TSC_ENTRY}` };
  if (r.launchError) {
    bad("tsc --noEmit", `CHUA CHAY DUOC — ${r.launchError}`);
  } else if (r.code !== 0) {
    const n = (r.out.match(/error TS\d+/g) || []).length;
    bad("tsc --noEmit", `${n} loi\n${r.out.split("\n").filter(Boolean).slice(0, 12).join("\n")}`);
  } else ok("tsc --noEmit", "0 loi (node <typescript>/bin/tsc, khong qua npx)");
} else skip("tsc --noEmit", "khong co packages/web/tsconfig.json");

// ---------------------------------------------------------- multi-agent gate
const maGate = join(REPO, "packages/web/scripts/check-multi-agent.mjs");
if (existsSync(maGate)) {
  const r = run(process.execPath, [maGate]);
  if (r.code !== 0) bad("check-multi-agent", r.out);
  else ok("check-multi-agent", (r.out.match(/PASS.*/) || ["PASS"])[0]);
} else skip("check-multi-agent", "khong co packages/web/scripts/check-multi-agent.mjs");

// ------------------------------------------------------------------ tong ket
console.log("");
if (failed > 0) {
  console.log(`pre-push-gate: ${failed} FAIL / ${passed} PASS / ${skipped} SKIP — CHAN PUSH`);
  process.exit(1);
}
console.log(`pre-push-gate: ${passed} PASS / ${skipped} SKIP / 0 FAIL — cho phep push`);
process.exit(0);
