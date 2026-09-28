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
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
// Tu absolute Windows path phai qua file:// — ESM loader tu cho loi
// ERR_UNSUPPORTED_ESM_URL_SCHEME neu dua thang "C:\..." vao import().
const { extractFromTable, loadDenyListWithReport } = await import(
  pathToFileURL(join(HERE, "deny-extract.mjs")).href
);

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

// ── NEGATIVE TEST CUA CHINH PROBE (bat bien §7) ───────────────────────────
// Probe o tren chi chay tren repo THAT nen luon xanh. Neu khong co negative
// test, khong co ai biet `loadDenyList` co im lang bo qua tai lieu hoac troi sang
// tai lieu khac khi trich duoc 0 path.
console.log("\n  negative test (temp fixture):");
const selfTests = [];
function selfCheck(name, want, got, extra = "") {
  const pass = want === got;
  selfTests.push({ name, pass, extra });
  console.log(`    ${pass ? "PASS" : "FAIL"}  ${name}${pass ? "" : `  (can ${want}, nhan ${got})`}`);
}

const FIX = mkdtempSync(join(tmpdir(), "deny-extract-fix-"));
try {
  mkdirSync(join(FIX, "docs"), { recursive: true });
  // Bang co cot STT o tai lieu UU TIEN CAO HON: trich 0 path.
  writeFileSync(
    join(FIX, "docs", "AGENT_PROTOCOL.md"),
    "| STT | File | Vi sao |\n|---|---|---|\n| 1 | `secret-a.txt` | x |\n",
  );
  // Bang DUNG o tai lieu thap hon: phai duoc bo qua vi tai lieu tren da co bang.
  writeFileSync(
    join(FIX, "AGENTS.md"),
    "| File | Vi sao |\n|---|---|\n| `secret-b.txt` | y |\n",
  );

  const r = loadDenyListWithReport(FIX, ["DEFAULT1.txt"], []);

  selfCheck("bang cot STT -> trich 0 path", 0, extractFromTable(readFileSync(join(FIX, "docs", "AGENT_PROTOCOL.md"), "utf8")).length);
  selfCheck("bao cao 1 note (tai lieu bi bo qua)", 1, r.notes.length, r.notes.join(" | "));
  selfCheck("mac dinh van duoc giu", true, r.list.includes("DEFAULT1.txt"));
  selfCheck("KHONG dung secret-a.txt (tai lieu uu tien)", false, r.list.includes("secret-a.txt"));
  selfCheck("KHONG roi sang secret-b.txt (tai lieu thap hon)", false, r.list.includes("secret-b.txt"), `source=${r.source}`);
  selfCheck("note nen noi ro cot dau tien la cot File", true, /cot `File`/.test(r.notes[0] || ""), r.notes[0] || "");

  // Bang DUNG o tai lien UU TIEN CAO: phai duoc dung lam nguon chinh.
  const FIX2 = mkdtempSync(join(tmpdir(), "deny-extract-fix2-"));
  try {
    writeFileSync(join(FIX2, "AGENTS.md"), "| File | Vi sao |\n|---|---|\n| `secret-b.txt` | y |\n");
    const r2 = loadDenyListWithReport(FIX2, ["DEFAULT1.txt"], []);
    selfCheck("bang dung -> 0 note", 0, r2.notes.length, r2.notes.join(" | "));
    selfCheck("bang dung -> dung path do", true, r2.list.includes("secret-b.txt"));
    selfCheck("bang dung -> source = AGENTS.md", "AGENTS.md", r2.source);
  } finally {
    rmSync(FIX2, { recursive: true, force: true });
  }
} finally {
  rmSync(FIX, { recursive: true, force: true });
}

const selfFailed = selfTests.filter((t) => !t.pass);
if (selfFailed.length) {
  console.log(`\n  ${selfFailed.length}/${selfTests.length} negative test FAIL`);
  process.exit(1);
}
console.log(`\n  ${selfTests.length}/${selfTests.length} negative test dat`);
process.exit(0);
