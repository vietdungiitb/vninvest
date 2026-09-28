/**
 * verify-global-config.mjs — phat hien DRIFT giua ban canonical (trong git) va
 * ban da trien khai (~/.opencode/).
 *
 * VY DO TON TAI (audit RISK-HIGH, 2026-09-27):
 *   Toan bo ~/.opencode/ — opencode.json, hooks, MANDATORY-WORKFLOW.md,
 *   agent-preflight.mjs — nằm NGOAI mọi git remote. Không có bản sao nao trong
 *   repo. Mat may la mat toan bo enforcement, va khong ai duoc biet noi dung
 *   hien tai la gi.
 *
 *   Ban mirror thong thuong se DRIFT: commit canonical, quen deploy, vai ngay
 *   sau hai ban khac nhau. Nen ban nay so SACH, khong chi ton tai mirror.
 *
 * Dung:  node scripts/verify-global-config.mjs
 * Exit 0 = khop het. Exit 1 = co drift (in bang canh bao).
 * Deploy: node tools/opencode-global/deploy.mjs
 */
import { readFileSync, existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CANON = resolve(HERE, "..", "tools", "opencode-global");
const HOME = join(homedir(), ".opencode");

/** canonical (trong git) -> noi dung da trien khai tren may nay */
const PAIRS = [
  ["agent-preflight.mjs", join("scripts", "agent-preflight.mjs")],
  // Phai khop agent-preflight.mjs. Xem ghi chu o deploy.mjs.
  ["deny-extract.mjs", join("scripts", "deny-extract.mjs")],
  ["test-agent-preflight.mjs", join("scripts", "test-agent-preflight.mjs")],
  ["MANDATORY-WORKFLOW.md", join("instructions", "MANDATORY-WORKFLOW.md")],
  ["pre-bash-agent-preflight.js", join("scripts", "hooks", "pre-bash-agent-preflight.js")],
  ["scripts-package.json", join("scripts", "package.json")],
];

let drift = 0;
let ok = 0;
let missing = 0;

for (const [canonName, deployedRel] of PAIRS) {
  const canonPath = join(CANON, canonName);
  const deployedPath = join(HOME, deployedRel);
  const label = relative(HERE, canonPath).split("\\").join("/");

  if (!existsSync(canonPath)) {
    console.log(`  MISS   ${label} — khong ton tai trong repo`);
    missing += 1;
    continue;
  }
  if (!existsSync(deployedPath)) {
    console.log(`  MISS   ~/.opencode/${deployedRel.split("\\").join("/")} — chua deploy`);
    missing += 1;
    continue;
  }

  const a = readFileSync(canonPath, "utf8");
  const b = readFileSync(deployedPath, "utf8");
  if (a === b) {
    console.log(`  OK     ${label}`);
    ok += 1;
  } else {
    const al = a.split("\n").length;
    const bl = b.split("\n").length;
    const firstDiff = (() => {
      const x = a.split("\n");
      const y = b.split("\n");
      for (let i = 0; i < Math.max(x.length, y.length); i += 1) if (x[i] !== y[i]) return i + 1;
      return -1;
    })();
    console.log(`  DRIFT  ${label}`);
    console.log(`         canonical  ${al} dong · deployed ${bl} dong · khop nhau den dong ${firstDiff}`);
    drift += 1;
  }
}

console.log("");

// ── SMOKE TEST BẢN DEPLOYED ────────────────────────────────────────────────
// So byte KHÔNG đủ: 5019e3e0 thêm `deny-extract.mjs` vào canonical, mọi file
// mirror đều khớp byte 5/5, nhưng bản deployed `agent-preflight.mjs` import
// file đó chạy `await import("./deny-extract.mjs")` — file KHÔNG được deploy
// ⇒ ERR_MODULE_NOT_FOUND ⇒ hook block mặc định chặn MỌI git commit ở MỌI
// repo khác vninvest. Vỡ ngoài vninvest nên gate trong repo này vẫn xanh.
//
// Nên: chạy THẬT bản deployed trong một repo fixture trần (không có shim,
// tức đúng đường fallback của hook). Bắt được mọi dependency thiếu, không
// chỉ cái tôi đang biết — kể cả của lần deploy sau.
const deployed = join(HOME, "scripts", "agent-preflight.mjs");
if (existsSync(deployed)) {
  const fx = mkdtempSync(join(tmpdir(), "verify-deploy-"));
  try {
    mkdirSync(join(fx, ".git"), { recursive: true });
    const r = spawnSync(process.execPath, [deployed, "--staged"], { cwd: fx, encoding: "utf8" });
    const out = `${r.stdout || ""}${r.stderr || ""}`;
    if (/ERR_MODULE_NOT_FOUND|Cannot find module|ERR_UNSUPPORTED_ESM_URL_SCHEME/.test(out)) {
      missing += 1;
      console.log(`  FAIL  smoke-test ban deployed khong chay duoc (dependency thieu)`);
      for (const line of out.split("\n").filter((l) => /ERR_|Cannot find/.test(l)).slice(0, 3)) {
        console.log("          " + line.trim().slice(0, 150));
      }
      console.log(`          lenh sua: node tools/opencode-global/deploy.mjs`);
    } else {
      ok += 1;
      console.log(`  OK     smoke-test ban deployed chay duoc (exit ${r.status}, duong fallback)`);
    }
  } finally {
    rmSync(fx, { recursive: true, force: true });
  }
} else {
  missing += 1;
  console.log("  MISS   ban deployed agent-preflight.mjs — chua deploy");
}

console.log("");
if (drift || missing) {
  console.log(`verify-global-config: ${drift} DRIFT + ${missing} MISS / ${ok} OK — lenh deploy:`);
  console.log(`  node tools/opencode-global/deploy.mjs`);
  process.exit(1);
}
console.log(`verify-global-config: ${ok} OK / ${PAIRS.length} caph doi byte + 1 smoke test — ~/.opencode/ dung ban canonical`);
process.exit(0);
