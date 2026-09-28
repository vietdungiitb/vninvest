/**
 * deploy.mjs — trien khai ban canonical (trong git) sang ~/.opencode/ tren may nay.
 *
 * Chi can chay khi verify-global-config.mjs bao DRIFT. Ban canonical la su that
 * khu 1; ~/.opencode/ la ban deploy.
 *
 * Dung:  node tools/opencode-global/deploy.mjs
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CANON = dirname(fileURLToPath(import.meta.url));
const HOME = join(homedir(), ".opencode");

const PAIRS = [
  ["agent-preflight.mjs", join("scripts", "agent-preflight.mjs")],
  ["test-agent-preflight.mjs", join("scripts", "test-agent-preflight.mjs")],
  ["MANDATORY-WORKFLOW.md", join("instructions", "MANDATORY-WORKFLOW.md")],
  ["pre-bash-agent-preflight.js", join("scripts", "hooks", "pre-bash-agent-preflight.js")],
  ["scripts-package.json", join("scripts", "package.json")],
];

for (const [canonName, deployedRel] of PAIRS) {
  const from = join(CANON, canonName);
  const to = join(HOME, deployedRel);
  if (!existsSync(from)) {
    console.log(`  MISS   ${canonName} — khong co trong canonical`);
    process.exit(1);
  }
  mkdirSync(dirname(to), { recursive: true });
  const next = readFileSync(from, "utf8");
  const same = existsSync(to) && readFileSync(to, "utf8") === next;
  copyFileSync(from, to);
  console.log(`  ${same ? "SAME  " : "DEPLOY"} ~/.opencode/${deployedRel.split("\\").join("/")}`);
}
console.log("\nDeploy xong. Chay lai: node scripts/verify-global-config.mjs");
