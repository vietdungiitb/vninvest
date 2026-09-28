/**
 * Chứng minh scripts/agent-preflight.mjs (shim) THẬT SỰ chạy bản canonical —
 * không phải một bản sao riêng. Đây là bằng chứng cho audit C-1.
 *
 * Cách: sửa một hằng trong canonical, chạy shim, xem shim có in ra hằng mới
 * không. Sau đó hoàn nguyên.
 *
 *   node tools/opencode-global/verify-shim.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const CANONICAL = resolve(HERE, "agent-preflight.mjs");
const SHIM = resolve(REPO, "scripts", "agent-preflight.mjs");

const orig = readFileSync(CANONICAL, "utf8");
const from = 'TRAILER = "Claim-Deny-List:"';
const to = 'TRAILER = "ZZ-MARKER-DELEGATE-9X:"';

if (!orig.includes(from)) {
  console.log("  FAIL  khong tim thay hang TRAILER trong canonical — can cap nhat probe nay");
  process.exit(1);
}

let pass = false;
try {
  writeFileSync(CANONICAL, orig.replace(from, to), "utf8");
  const r = spawnSync(process.execPath, [SHIM, "--for", "AGENTS.md"], {
    cwd: REPO,
    encoding: "utf8",
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  pass = out.includes("ZZ-MARKER-DELEGATE-9X");
  console.log(`  ${pass ? "PASS" : "FAIL"}  shim chay canonical (marker moi xuat hien: ${pass ? "CO" : "KHONG"})`);
  if (!pass) console.log(`  output: ${out.slice(0, 300)}`);
} finally {
  writeFileSync(CANONICAL, orig, "utf8");
}

const back = readFileSync(CANONICAL, "utf8") === orig;
console.log(`  ${back ? "PASS" : "FAIL"}  canonical da hoan nguyen`);
process.exit(pass && back ? 0 : 1);
