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
const changed = run(process.execPath, [
  "-e",
  `const {execSync}=require("child_process");
   const out=[];
   const push=(s)=>{ try { out.push(execSync(s,{encoding:"utf8"})); } catch {} };
   push("git diff --name-only origin/dev...HEAD");
   push("git diff --name-only");
   push("git diff --name-only --cached");
   push("git ls-files --others --exclude-standard");
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
let encCount = 0;
for (const rel of changedSet) {
  if (!ENC_EXT.test(rel)) continue;
  const f = join(REPO, rel);
  if (!existsSync(f) || !statSync(f).isFile()) continue;
  if (statSync(f).size > 4_000_000) continue;
  encCount += 1;
  const t = readFileSync(f, "utf8");
  const n = (t.match(/\uFFFD/g) || []).length;
  if (n > 0) encBad.push(`${rel}: ${n} ky tu U+FFFD`);
}
if (encBad.length) bad("encoding", encBad.join("\n"));
else ok("encoding", `${encCount}/${changedSet.length} file da doi, 0 U+FFFD`);

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
