/**
 * verify-hook-mode.mjs — kiem tra 3 muc cua hook agent-preflight khi chay THAT
 * tren may nay (khong phai don doc ma nguon):
 *   1. mac dinh = CHAN (exit 2)
 *   2. AGENT_PREFLIGHT_MODE=warn = canh bao (exit 0)
 *   3. trailer Claim-Deny-List THAT o dau dong = cho qua; chi NHAC = van chan
 *
 * Canh bao: bo qua khi khong tim thay hook da deploy (chua chay deploy.mjs).
 *   node tools/opencode-global/verify-hook-mode.mjs
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const HOOK = join(homedir(), ".opencode", "scripts", "hooks", "pre-bash-agent-preflight.js");
const AGENTS = join(REPO, "AGENTS.md");

if (!existsSync(HOOK)) {
  console.log("  SKIP  khong tim thay hook da deploy — chay: node tools/opencode-global/deploy.mjs");
  process.exit(0);
}

const orig = readFileSync(AGENTS, "utf8");
let failed = 0;

/**
 * WAVE 7 (2026-10-10) — env cho lenh git tao FIXTURE.
 *
 * Ly do: script nay chay duoi `pre-push` hook, git truyen `GIT_DIR` (tro ve
 * repo THAT) cho tien trinh con va `spawnSync` ke thua env do. `git init` o
 * thu muc tam **khong tao `.git` cuc bo** ma re-init vao repo THAT, roi ghi
 * `core.bare=true` vao `.git/config` cua vninvest ⇒ `git status/add/restore`
 * loi `this operation must be run in a work tree` ⇒ **chan push**.
 *
 * Do la cung class bug da o `verify-trailer-bypass.mjs` va
 * `test-agent-preflight.mjs`; 2 file do da sua, file nay bi BO SOT.
 * Luan doan trong session truoc ("no chay hook trong repo that nen can giu
 * `GIT_DIR`") chi dung MOT PHAN — file nay co 2 lo lenh git:
 *
 *   1. Tao fixture tam   (`:58` `git init`)      ⇒ PHAI bo `GIT_*`  ← sua o day
 *   2. Do tren repo that (`:83` `git add`, `:108` `git restore`)
 *                                                 ⇒ PHAI giu `GIT_DIR`
 *
 * Sua lo 1, giu nguyen lo 2. Bang chung lan 2 doc lai: dat
 * `GIT_DIR=<repo>/.git` roi chay file nay, `core.bare` doi `false -> true`;
 * `verify-hook-mode` FAIL 3/8. Sau khi sua: 8/8 PASS, `core.bare` giu `false`.
 */
const FIXTURE_ENV = { ...process.env };
for (const k of Object.keys(FIXTURE_ENV)) {
  if (k.startsWith("GIT_")) delete FIXTURE_ENV[k];
}

function run(cmd, mode) {
  const payload = JSON.stringify({ tool: "bash", tool_input: { command: cmd } });
  const env = { ...process.env };
  if (mode === null) delete env.AGENT_PREFLIGHT_MODE;
  else env.AGENT_PREFLIGHT_MODE = mode;
  const r = spawnSync(process.execPath, [HOOK], { input: payload, encoding: "utf8", env });
  return r.status;
}

function check(label, want, got) {
  const pass = want === got;
  if (!pass) failed += 1;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}  (can ${want}, nhan ${got})`);
}

console.log("verify-hook-mode — chay hook that tren may nay\n");

// ── DUONG FALLBACK: repo khong co shim ─────────────────────────────────────
// Test ben tren CHAY TRONG REPO VNINV, noi `scripts/agent-preflight.mjs` la
// shim nen hook luon dung ban do. Do la ly do bug 5019e3e0 (canonical import
// `deny-extract.mjs` nhung file do khong deploy) LOOT QUA gate 13/13: duong
// fallback — thuoc ve MOI repo khac vninvest — chua bao gio duoc chay.
//
// Case nay chay hook trong fixture git TRAN (khong co scripts/), dung chinh
// duong fallback, va phai tra exit 0 cho mot commit binh thuong.
{
  const fx = mkdtempSync(join(tmpdir(), "hook-fallback-"));
  try {
    // FIXTURE: bo moi `GIT_*` — xem `FIXTURE_ENV` o tren. `env` phai truyen
    // `explicit`; bo qua no thi `spawnSync` ke thua `process.env` va lenh
    // re-init vao repo that.
    spawnSync("git", ["init", "-q", "-b", "main"], { cwd: fx, env: FIXTURE_ENV, encoding: "utf8" });
    spawnSync("git", ["config", "user.email", "p@t.local"], { cwd: fx, env: FIXTURE_ENV, encoding: "utf8" });
    spawnSync("git", ["config", "user.name", "p"], { cwd: fx, env: FIXTURE_ENV, encoding: "utf8" });
    writeFileSync(join(fx, "README.md"), "# x\n", "utf8");
    spawnSync("git", ["add", "-A"], { cwd: fx, env: FIXTURE_ENV, encoding: "utf8" });

    const payload = JSON.stringify({ tool: "bash", tool_input: { command: 'git commit -m "commit binh thuong"' } });
    const env = { ...process.env };
    delete env.AGENT_PREFLIGHT_MODE;
    const r = spawnSync(process.execPath, [HOOK], { input: payload, encoding: "utf8", env, cwd: fx });
    const out = `${r.stdout || ""}${r.stderr || ""}`;
    check("REPO TRAN (duong fallback): commit binh thuong -> khong chan", 0, r.status, out.slice(0, 240));
    if (/ERR_MODULE_NOT_FOUND|Cannot find module/.test(out)) {
      check("REPO TRAN: ban deployed khong thieu dependency", true, false, out.slice(0, 240));
    } else {
      check("REPO TRAN: ban deployed khong thieu dependency", true, true);
    }
  } finally {
    rmSync(fx, { recursive: true, force: true });
  }
}

try {
  // stage AGENTS.md (deny list) — commit nao cung vi pham truoc khi co trailer
  writeFileSync(AGENTS, orig + "\n<!-- probe hook mode -->\n", "utf8");
  spawnSync("git", ["add", "AGENTS.md"], { cwd: REPO, encoding: "utf8" });

  check("mac dinh (khong set env) + khong trailer -> CHAN", 2, run('git commit -m "probe"', null));
  check("mode=warn + khong trailer -> canh bao", 0, run('git commit -m "probe"', "warn"));
  check("mode=block + khong trailer -> CHAN", 2, run('git commit -m "probe"', "block"));
  check(
    "trailer THAT o dau dong -> cho qua",
    0,
    run('git commit -m "chore: x" -m "Claim-Deny-List: coordinator da duyet"', null),
  );
  check(
    "chi NHAC chuoi trailer trong body -> van CHAN",
    2,
    run('git commit -m "chore: ghi chu ve Claim-Deny-List: trong quy trinh"', null),
  );
  check(
    "AGENT_PREFLIGHT=0 -> tat hoan toan",
    0,
    (() => {
      const payload = JSON.stringify({ tool: "bash", tool_input: { command: 'git commit -m "probe"' } });
      const env = { ...process.env, AGENT_PREFLIGHT: "0" };
      return spawnSync(process.execPath, [HOOK], { input: payload, encoding: "utf8", env }).status;
    })(),
  );
} finally {
  spawnSync("git", ["restore", "--staged", "AGENTS.md"], { cwd: REPO, encoding: "utf8" });
  writeFileSync(AGENTS, orig, "utf8");
}

console.log("");
console.log(failed ? `  ${failed} FAIL` : "  hook block/warn/trailer deu dung");
process.exit(failed ? 1 : 0);
