/**
 * verify-i18n-strict.mjs — negative test cho scripts/i18n-scan-strict.mjs.
 *
 * Dung SCANNER THAT tren file that tam nam trong `src/` — khong mock. Mock
 * chi chung minh duoc regex cua script, khong chung minh duoc gate co that
 * bat loi hay khong. (Lan truoc toi viet ban mock roi thay ban do khong co
 * tac dung.)
 *
 * Case: `t('k', { defaultValue: 'x' as string })` — esprima (parser JS thuan)
 * loi tai options, scanner in `i18next-scanner: Unable to parse code "..."`
 * roi VAN exit 0. Do la loai loi duy nhat gate nay cam ket bat.
 *
 *   node tools/opencode-global/verify-i18n-strict.mjs
 * Exit 0 = gate bat dung. Exit 1 = gate rong hoac hong.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, rmSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const STRICT = join(REPO, "scripts", "i18n-scan-strict.mjs");
const WEB = join(REPO, "packages", "web");
const PROBE = join(WEB, "src", "__i18n_strict_probe_tmp.js");

function run(extra = []) {
  const r = spawnSync(process.execPath, [STRICT, ...extra], { cwd: REPO, encoding: "utf8" });
  return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
}

let failed = 0;
function check(name, want, got, extra = "") {
  const pass = want === got;
  if (!pass) failed += 1;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}  (can ${want}, nhan ${got})`);
  if (!pass && extra) console.log(`    ${extra.slice(0, 300)}`);
}

console.log("verify-i18n-strict — negative test voi scanner that\n");

try {
  // 1. file sach -> 0
  writeFileSync(PROBE, "export const ok = 1;\n", "utf8");
  const clean = run();
  check("code sach -> 0", 0, clean.code, clean.out);

  // 2. TS `as` trong options cua t() -> 1
  //    Phai DUNG HINH DANG lời gọi `t(...)` có dấu phẩy: chi nhanh `endsWithComma`
  //    trong parseFuncFromString (parser.js:499) moi parse options bang esprima.
  //    Object literal trần cap module khong di qua nhanh do.
  writeFileSync(PROBE, "export const k = t('probe.key', { defaultValue: 'x' as string });\n", "utf8");
  const bad = run();
  check("TS 'as string' trong t() options -> 1", 1, bad.code, bad.out);

  // 3. --warn -> 0 du co loi
  const warn = run(["--warn"]);
  check("--warn -> 0", 0, warn.code, warn.out);
} finally {
  rmSync(PROBE, { force: true });
  if (existsSync(PROBE)) console.log("  CANH BAO: probe file chua xoa");
}

console.log("");
console.log(failed ? `  ${failed} FAIL` : "  gate bat dung loai loi cam ket bat");
process.exit(failed ? 1 : 0);
