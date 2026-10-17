#!/usr/bin/env node
/**
 * Chuan hoa line-ending cho cac file DA THAY DOI, theo dang co trong git.
 *
 * ── Vay sao can script nay ───────────────────────────────────────────────
 * Tren Windows, `Edit` tool va moi script ghi file deu xu ly xong ky tu
 * CRLF/LF. Repo `vninvest` **hon tap**: mot so file luu LF, so khac luu CRLF
 * (`vnadmin.css` la CRLF-native - ledger Entry 273 §7). `core.autocrlf=false`
 * va `.gitattributes` KHONG co quy tac chung cho file nguon, nen git so san
 * byte-for-byte ⇒ doi 1 file tu LF sang CRLF se lam **toan bo file** hien
 * trong diff.
 *
 * Da gap **14 lan** trong 2 phiên (ledger Entry 282 §9, L-T01):
 *   workspace.js            +762/-750  cho sua ~10 dong  -> that la +15/-3
 *   routeCatalog.js         +681/-658  cho sua ~23 dong  -> that la +23/-0
 *   DNSEConnectionPanel.css +334/-294  cho them ~40 dong -> that la +40/-0
 *   LangContext.js          +136/-116  cho sua ~22 dong  -> that la +42/-22
 *
 * ── Cach dung ────────────────────────────────────────────────────────────
 *   node scripts/normalize-eol.mjs            # kiem tra + bao cao
 *   node scripts/normalize-eol.mjs --fix      # sua ve dang blob cu
 *
 * ⚠ CHAY TRUOC `git add`. Sau khi stage thi cot `i/` cua `git ls-files --eol`
 * da bi chinh dua blob moi vao ⇒ khong con biet dang GOC la gi.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FIX = process.argv.includes("--fix");

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
}

/** File dang thay doi so voi HEAD, chua stage. */
function changedFiles() {
  const out = git(["diff", "--name-only", "HEAD"]);
  return out ? out.split("\n").filter(Boolean) : [];
}

/**
 * Doc dang EOL cua blob trong HEAD — day moi la "chuan", KHONG phai dang
 * hien tai trong working tree.
 */
function headEol(file) {
  try {
    const buf = execFileSync("git", ["cat-file", "blob", `HEAD:${file}`], {
      maxBuffer: 64 * 1024 * 1024,
    });
    let crlf = 0;
    let lf = 0;
    for (let i = 0; i < buf.length; i += 1) {
      if (buf[i] === 10) {
        if (i > 0 && buf[i - 1] === 13) crlf += 1;
        else lf += 1;
      }
    }
    if (crlf > 0 && lf > 0) return "mixed";
    if (crlf > 0) return "crlf";
    if (lf > 0) return "lf";
    return "none";
  } catch {
    return "new"; // file moi, HEAD chua co
  }
}

function worktreeEol(file) {
  // File da bi `git rm` (co trong index, khong con tren dia) ⇒ skip. Khong co
  // guard nay, hook `pre-commit` chet voi ENOENT **moi khi xoa file**, va thong
  // bao L-T01 sai lam nguoi doc tu cho la file do lech line-ending.
  if (!existsSync(file)) return "none";
  const buf = readFileSync(file);
  let crlf = 0;
  let lf = 0;
  for (let i = 0; i < buf.length; i += 1) {
    if (buf[i] === 10) {
      if (i > 0 && buf[i - 1] === 13) crlf += 1;
      else lf += 1;
    }
  }
  if (crlf > 0 && lf > 0) return "mixed";
  if (crlf > 0) return "crlf";
  if (lf > 0) return "lf";
  return "none";
}

function toEol(text, eol) {
  const lf = text.replace(/\r\n/g, "\n");
  if (eol === "crlf") return lf.replace(/\n/g, "\r\n");
  if (eol === "lf") return lf;
  // mixed: giu nguyen het cac ky tu khac, chi chuan hoa the LF de an toan
  return lf;
}

const targets = changedFiles();
const mismatched = [];

for (const file of targets) {
  // File da bi xoa (`git rm`): van con trong index nhung khong con tren dia.
  // Khong co noi dung de chuan hoa ⇒ bo qua. Khong co guard nay, hook
  // `pre-commit` chet voi ENOENT **moi khi xoa file**, va thong bao L-T01
  // sai lam nguoi doc tu cho la file do lech line-ending.
  if (!existsSync(file)) continue;
  const want = headEol(file);
  const have = worktreeEol(file);
  if (want === "new" || want === "none") continue;
  if (want === have) continue;
  mismatched.push({ file, want, have });
}

if (mismatched.length === 0) {
  console.log(`normalize-eol — OK (${targets.length} file thay doi, tat ca khop dang blob goc)`);
  process.exit(0);
}

console.log(`normalize-eol — ${mismatched.length} file lech dang:`);
for (const m of mismatched) {
  console.log(`  ${m.file}\n      HEAD=${m.want}  worktree=${m.have}`);
}

if (!FIX) {
  console.log("\nChay them voi --fix de chuan hoa ve dang blob goc.");
  process.exit(1);
}

for (const m of mismatched) {
  const text = readFileSync(m.file, "utf8");
  writeFileSync(m.file, toEol(text, m.want), "utf8");
  console.log(`  da sua ${m.file} -> ${m.want}`);
}
console.log("\nDa chuan hoa. KIEM TRA LAI bang `git diff --numstat` truoc khi stage.");