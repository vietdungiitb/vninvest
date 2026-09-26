#!/usr/bin/env node
/**
 * check:multi-agent — multi-agent safety gate for VNInvest.
 *
 * Companion to check-ai-cc-dag. Turns the conventions in docs/AGENT_PROTOCOL.md
 * into checks that FAIL. The conventions alone did not prevent 4 real conflicts in
 * one session (2026-09-26); this gate makes the two that break the build
 * (duplicate migration numbers, multiple leaf nodes) impossible to miss.
 *
 * Deliberately NOT wired into check:shell — that script is shared, and adding a
 * multi-agent check there would make unrelated agents fail for a condition that
 * only exists during parallel work. See AGENT_PROTOCOL.md §8.
 *
 * Usage:  node packages/web/scripts/check-multi-agent.mjs [--verbose]
 * Exit:   0 = all invariants hold, 1 = at least one broken
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// this file lives at packages/web/scripts/ → repo root is three levels up
const REPO = path.resolve(__dirname, "..", "..", "..");
const VERBOSE = process.argv.includes("--verbose");

/** docs/AGENT_PROTOCOL.md §2 — files no agent may edit during parallel work. */
const DENY_LIST = [
  "AGENTS.md",
  "docs/CODE_CHANGE_AUDIT_LEDGER.md",
  "packages/web/package.json",
  "pyproject.toml",
  "requirements.txt",
  "package-lock.json",
  "docker-compose.yml",
  "docker-compose.dev.yml",
  "docker-compose.prod.yml",
  ".env",
  ".env.example",
];

/** append-only files that are legitimately agent-writable despite being shared. */
const DENY_EXEMPT = new Set(["docs/CLAIMS.md"]);

const VALID_STATUS = new Set([
  "proposed",
  "in-progress",
  "blocked",
  "done",
  "released",
]);

function fail(msg) {
  console.error(`check:multi-agent - FAIL: ${msg}`);
  process.exit(1);
}

const errors = [];
const warn = [];
const note = [];

// ── 1 + 2. Migration numbering: duplicate numbers and multiple leaf nodes ──────
// Both produce "Conflicting migrations detected; multiple leaf nodes" and block
// `migrate`. RSK-17 in the plan records this happening for real.
const migrationsRoot = path.join(REPO, "packages", "core", "backend", "src");
const apps = fs
  .readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => fs.existsSync(path.join(migrationsRoot, name, "migrations")));

let migrationCount = 0;
for (const app of apps) {
  const dir = path.join(migrationsRoot, app, "migrations");
  const byNumber = new Map(); // "0012" -> [filenames]
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".py") || f === "__init__.py") continue;
    const m = f.match(/^(\d{4})_/);
    if (!m) {
      warn.push(`${app}/migrations/${f}: tên không đúng dạng NNNN_slug.py`);
      continue;
    }
    migrationCount += 1;
    const num = m[1];
    if (!byNumber.has(num)) byNumber.set(num, []);
    byNumber.get(num).push(f);
  }
  for (const [num, files] of byNumber) {
    if (files.length > 1) {
      errors.push(
        `TRÙNG SỐ MIGRATION app="${app}" số=${num}: ${files.join(" + ")} — ` +
          `migrate sẽ lỗi "multiple leaf nodes"`,
      );
    }
  }
  // Leaf-node sanity. Django declares dependencies as tuples:
  //   dependencies = [("advisory", "0010_advisorysession_unique_user_symbol_date"),]
  // so the referenced migration is the 2nd tuple element, and it matches the
  // filename minus the .py suffix. (`__latest__` is legal but not written to disk.)
  const declared = [];
  for (const f of fs.readdirSync(dir)) {
    if (!/^\d{4}_.+\.py$/.test(f)) continue;
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    const block = src.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
    const deps = block
      ? [...block[1].matchAll(/\(\s*['"][\w]+['"]\s*,\s*['"](\d{4}_\w+)['"]\s*\)/g)].map(
          (x) => x[1],
        )
      : [];
    declared.push({ file: f, deps });
  }
  const dependedOn = new Set(declared.flatMap((d) => d.deps));
  const leaves = declared.filter((d) => !dependedOn.has(d.file.replace(/\.py$/, "")));
  if (leaves.length > 1) {
    errors.push(
      `NHIỀU LEAF app="${app}": ${leaves.map((l) => l.file).join(", ")} — ` +
        `makemigrations sẽ lỗi "Conflicting migrations detected"`,
    );
  } else if (leaves.length === 0 && declared.length > 0) {
    warn.push(`app="${app}": không tìm thấy leaf nào — có thể cycle trong dependencies`);
  }
  if (VERBOSE) {
    note.push(
      `${app}: ${declared.length} migration, head=` +
        `${leaves.length === 1 ? leaves[0].file.slice(0, 4) : "???"}`,
    );
  }
}

// ── 3 + 4 + 5. CLAIMS.md consistency ──────────────────────────────────────────
const claimsPath = path.join(REPO, "docs", "CLAIMS.md");
let claimRows = 0;
if (!fs.existsSync(claimsPath)) {
  errors.push("docs/CLAIMS.md không tồn tại — agent mới sẽ không khai được claim");
} else {
  const lines = fs.readFileSync(claimsPath, "utf8").split(/\r?\n/);
  const heads = lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => /^\|\s*`?[a-z0-9_-]+`?\s*\|/.test(l) && l.includes("|"));
  for (const { l, i } of heads) {
    const cells = l.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 5) continue; // header/separator row
    if (cells[0] === "agent" || /^-+$/.test(cells[0])) continue;
    const [agent, branch, , files, status] = cells;
    if (!VALID_STATUS.has(status)) continue;
    claimRows += 1;

    // Any placeholder counts as "no files declared" — a claim that names no file
    // protects nothing, which is how two agents end up editing the same file.
    const PLACEHOLDERS = new Set(["", "—", "--", "-", "n/a", "na", "(none)", "không"]);
    const filesRaw = (files || "").replace(/`/g, "").trim();
    if (status === "in-progress" && PLACEHOLDERS.has(filesRaw.toLowerCase())) {
      errors.push(
        `CLAIMS.md dòng ${i + 1}: agent=${agent} status=in-progress nhưng cột ` +
          `files rỗng — phải khai file đang giữ`,
      );
    }

    // Split a cell into path patterns. A brace group like
    // `advisory/{views,models}.py` is ONE pattern, so commas inside braces must
    // not be treated as separators, and backticks are decoration not data.
    const raw = (files || "").replace(/`/g, "").trim();
    const patterns = /\{[^}]*\}/.test(raw)
      ? [raw]
      : raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);

    for (const pat of patterns) {
      const rel = pat.replace(/\/+$/, "");
      if (!rel || rel === "—") continue;
      if (DENY_EXEMPT.has(rel)) continue;
      if (DENY_LIST.includes(rel)) {
        errors.push(
          `CLAIMS.md dòng ${i + 1}: agent=${agent} claim file "${rel}" nằm trong ` +
            `SHARED-FILE DENY LIST (AGENT_PROTOCOL.md §2)`,
        );
        continue;
      }
      // Non-literal patterns cannot be existence-checked.
      if (/[*{]/.test(rel)) continue;
      if (!fs.existsSync(path.join(REPO, rel))) {
        warn.push(
          `CLAIMS.md dòng ${i + 1}: file "${rel}" không tồn tại trong worktree này ` +
            `(có thể agent khác đã xoá/đổi tên, hoặc claim ghi sai)`,
        );
      }
    }
  }
  if (claimRows === 0) {
    warn.push("CLAIMS.md không có claim nào ở trạng thái hợp lệ — kiểm tra định dạng bảng");
  }
}

// ── report ───────────────────────────────────────────────────────────────────
for (const n of note) console.log(`  · ${n}`);
console.log(
  `check:multi-agent - ${apps.length} app có migration, ${migrationCount} file, ` +
    `${claimRows} claim hợp lệ`,
);

if (warn.length) {
  console.log(`\n  CẢNH BÁO (${warn.length}) — không chặn:`);
  for (const w of warn) console.log(`  ! ${w}`);
}
if (errors.length) {
  console.error(`\n  LỖI (${errors.length}):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log("  0 lỗi, 0 trùng số migration — PASS");
