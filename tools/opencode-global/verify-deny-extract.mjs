/**
 * verify-deny-extract.mjs — do xem regex co trich DUOC BAO NHIEU muc trong
 * bang deny list §2 cua AGENT_PROTOCOL.md.
 *
 * Muc dich: "doc deny list tu docs" la co che tu thich ung, nhung regex cu
 * rat yeu — chi trich duoc mot phan. Mac dinh 16 file dang CHE phan bi lo, nen
 * yeu cau khong lo duoc chan do "van chay" ma khong phai do "doc dung".
 *
 *   node tools/opencode-global/verify-deny-extract.mjs
 * Exit 0 = trich het cac muc trong bang. Exit 1 = con muc rơi.
 */
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
// Tu absolute Windows path phai qua file:// — ESM loader tu cho loi
// ERR_UNSUPPORTED_ESM_URL_SCHEME neu dua thang "C:\..." vao import().
const { extractFromTable } = await import(pathToFileURL(join(HERE, "deny-extract.mjs")).href);

// Muc §2 trong AGENT_PROTOCOL.md: cac file doc trong code nhay cam.
// Ghi nguyen van ban protocol, KHONG sua — neu protocol doi hinh thuc thi
// probe phai bao loi thay vi "tu sua thanh xanh".
const KNOWN = [
  "AGENTS.md",
  "docs/CLAIMS.md",
  "docs/CODE_CHANGE_AUDIT_LEDGER.md",
  "pyproject.toml",
  "requirements.txt",
  "package-lock.json",
  "docker-compose*.yml",
  ".env*",
  "packages/web/package.json",
];

const doc = ["docs/AGENT_PROTOCOL.md", "AGENT_PROTOCOL.md", "AGENTS.md", "CLAUDE.md"]
  .map((n) => join(REPO, n))
  .find((p) => existsSync(p));

if (!doc) {
  console.log("  khong tim thay AGENT_PROTOCOL.md / AGENTS.md / CLAUDE.md — skip");
  process.exit(0);
}

const text = readFileSync(doc, "utf8");
const got = extractFromTable(text);
const gotSet = new Set(got);
const missing = KNOWN.filter((f) => !gotSet.has(f));

console.log(`verify-deny-extract — ${doc.replace(REPO, ".")}\n`);
console.log(`  trich duoc ${KNOWN.filter((f) => gotSet.has(f)).length}/${KNOWN.length} muc §2 (tong ${got.length} path trich ra):`);
for (const f of KNOWN) {
  console.log(`    ${gotSet.has(f) ? "OK  " : "ROT "} ${f}`);
}
if (gotSet.has("CLAIMS.md") && !gotSet.has("docs/CLAIMS.md")) {
  console.log("  ghi chu: trich ra 'CLAIMS.md' (khong co tien to docs/)");
}

console.log("");
if (missing.length) {
  console.log(`  ${missing.length} muc CHUA trich duoc:`);
  for (const f of missing) console.log(`    - ${f}`);
  process.exit(1);
}
console.log(`  trich het ${KNOWN.length}/${KNOWN.length}`);
process.exit(0);
