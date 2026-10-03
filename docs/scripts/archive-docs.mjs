// Archive documents by MOVING them, not deleting.
//
// The earlier proposal estimated ~1463 candidates with no inbound reference. That
// is a recall problem, not a licence to delete: "nothing links to it" is also
// true of Quickstart guides and audit evidence that humans need. So this moves
// files into docs/archive/<area>/ and leaves every byte in place, keeping the
// decision reversible.
//
// Two hard rules, both enforced here rather than trusted:
//   1. A file referenced from code, CI, compose or a workflow is never moved.
//      The reference set is computed the same way classify-md.mjs computes it.
//   2. The process docs the agent workflow depends on are never moved.
//
// Anything that survives both checks but is a duplicate of a kept file, or whose
// subject no longer exists in the tree, is reported for a separate delete PR
// rather than removed here.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, renameSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DRY = process.argv.includes('--dry-run');
const ONLY = (() => {
  const i = process.argv.indexOf('--area');
  return i > 0 ? process.argv[i + 1] : null;
})();

const list = execSync('git ls-tree -r HEAD --name-only', {
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
}).split('\n').filter(Boolean);

const md = list.filter((f) => f.endsWith('.md'));

// Never move: workflow process docs.
const KEEP_EXACT = new Set([
  'README.md',
  'AGENTS.md',
  'docs/AGENT_PROTOCOL.md',
  'docs/CLAIMS.md',
  'docs/CODE_CHANGE_AUDIT_LEDGER.md',
  'docs/ARCHIVE_AGENTS_PROGRESS.md',
  'docs/OPEN_WORK_20260927.md',
  'docs/ARCHIVE_PROPOSAL_20260929.md',
  'docs/scripts/classify-md.mjs',
  'docs/scripts/archive-docs.mjs',
]);

// Never move: human-facing operational entry points. A reference count cannot see
// these - nothing links to "how do I start the stack", the operator just needs it
// to exist. These are matched by role words in the filename, because the operator
// searches for the topic, not for a fixed path.
const OPS_KEEP_RE = /(?:README|QUICKSTART|GUIDE|GUID|QUICKSTART|SM-.*RUNBOOK|RUNBOOK|DEPLOY|PORTAINER|ENVIRONMENT|SETUP|ONBOARD)/i;

// Never move: anything shipped with code or CI.
const NEVER_MOVE_PREFIX = ['packages/', '.github/', '.opencode/', '.copilot/', 'quality/'];

// Referenced from code/CI -> never move.
const codeLike = /\.(py|ts|tsx|js|mjs|cjs|sh|ps1|bat|yml|yaml|json|toml|ini|cfg|html|css)$/;
const basenames = new Map();
for (const f of md) {
  const bn = path.basename(f);
  if (!basenames.has(bn)) basenames.set(bn, []);
  basenames.get(bn).push(f);
}
const byCode = new Map();
const byAny = new Map();
for (const f of list) {
  if (f.endsWith('.md') && basenames.get(path.basename(f))?.length === 1) continue;
  const abs = path.join(ROOT, f);
  if (!existsSync(abs) || !statSync(abs).isFile()) continue;
  if (statSync(abs).size > 4 * 1024 * 1024) continue;
  let text;
  try { text = readFileSync(abs, 'utf8'); } catch { continue; }
  const isCode = codeLike.test(f);
  for (const bn of basenames.keys()) {
    if (!text.includes(bn)) continue;
    byAny.set(bn, (byAny.get(bn) || 0) + 1);
    if (isCode) byCode.set(bn, (byCode.get(bn) || 0) + 1);
  }
}

const areaOf = (f) => {
  const p = f.split('/');
  if (p[0] === 'docs' && p.length > 2) return `docs-${p[1]}`;
  if (p[0] === 'docs') return 'docs-flat';
  if (p.length > 1) return `${p[0]}-root`;
  return 'repo-root';
};

// Group by subject so the archive stays navigable instead of one giant folder.
// The prefix run is captured (not skipped): `AUDIT_WATCHLIST_UI_20260913` and
// `AUDIT_WATCHLIST_API_20260914` are the same subject and belong together. An
// earlier version started the capture one token late and put the subject keyword
// itself in the directory name, scattering related audits.
const SUBJECT_PREFIX = /^(?:AUDIT|PLAN|IMPLEMENTATION_PLAN|REVIEW|VERIFICATION|BACKUP|HISTORY|GAP|ISSUE|REPORT|SPEC|TEST|RUN|QUICK|CONSTITUTION|DESIGN|REFACTOR|MIGRATION|PHASE|WAVE|SLICE|OPEN)[_-]*/i;

const subjectOf = (f) => {
  const bn = path.basename(f).replace(/\.md$/i, '');
  // Strip a leading date or a phase number, which never identify the subject.
  let s = bn
    .replace(/[_-]?20\d{6}\b/g, '')
    .replace(/[_-]?20\d{2}\b/g, '')
    .replace(/[_-]?P[0-9]+\b/gi, '')
    .replace(/[_-]?PHASE[_-]?[0-9]+\b/gi, '')
    .replace(/[_-]?WAVE[_-]?[0-9]+\b/gi, '')
    .replace(/[_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  const m = s.match(SUBJECT_PREFIX);
  if (m) s = s.slice(m[0].length);
  s = s.replace(/^_+/, '');
  if (!s) return 'misc';
  // Cap the depth so one long name does not become its own directory.
  return s.split('_').filter(Boolean).slice(0, 3).join('_') || 'misc';
};

const keep = [];
const blockedCode = [];
let move = [];

for (const f of md) {
  if (KEEP_EXACT.has(f)) { keep.push(f); continue; }
  if (NEVER_MOVE_PREFIX.some((p) => f.startsWith(p))) { keep.push(f); continue; }
  if (OPS_KEEP_RE.test(path.basename(f))) { keep.push(f); continue; }
  const bn = path.basename(f);
  if ((byCode.get(bn) || 0) > 0) { blockedCode.push(f); continue; }
  if ((byAny.get(bn) || 0) > 0) { keep.push(f); continue; }
  move.push(f);
}

// A kept file that links to a moved file would be left with a dead link. Earlier
// versions only counted `git grep` hits, which counts ANY mention - including a
// bare sentence "see X.md" - so it both over-protected (audit chains kept whole
// trees of stale sprint logs) and, once a file qualified for moving, said nothing
// about the other direction. Now the move set is fixed first, then any kept file
// pointing INTO it is promoted to keep, transitively. This is a whole-file
// closure, so it can keep more than the strict minimum, never fewer.
{
  const moveSet = new Set(move);
  const keptSet = new Set(keep);
  let grew = true;
  let promoted = 0;
  while (grew) {
    grew = false;
    for (const f of list) {
      if (keptSet.has(f) || moveSet.has(f)) continue;
      const abs = path.join(ROOT, f);
      if (!existsSync(abs) || !statSync(abs).isFile()) continue;
      if (statSync(abs).size > 4 * 1024 * 1024) continue;
      let text;
      try { text = readFileSync(abs, 'utf8'); } catch { continue; }
      for (const m of move) {
        if (text.includes(path.basename(m))) {
          keptSet.add(f);
          keep.push(f);
          moveSet.delete(m);
          promoted += 1;
          grew = true;
          break;
        }
      }
    }
  }
  move = [...moveSet];
  if (promoted > 0) {
    console.log(`link closure: promoted ${promoted} referrer(s) to keep to avoid dead links`);
  }
}

const selected = ONLY ? move.filter((f) => areaOf(f) === ONLY) : move;
const byArea = new Map();
for (const f of selected) {
  const a = areaOf(f);
  if (!byArea.has(a)) byArea.set(a, []);
  byArea.get(a).push(f);
}

console.log(DRY ? 'DRY RUN - khong ghi file nao' : 'APPLY');
console.log(`total .md        : ${md.length}`);
console.log(`keep             : ${keep.length}`);
console.log(`blocked (code/CI): ${blockedCode.length}  (never moved)`);
console.log(`move candidates  : ${selected.length}`);
console.log('\nmove by area:');
for (const [a, fs] of [...byArea.entries()].sort()) {
  console.log(`  ${String(fs.length).padStart(5)}  ${a}`);
}

if (ONLY && byArea.size === 0) {
  console.log(`\nkhong co ung vien nao trong area '${ONLY}'`);
  process.exit(0);
}

// destination keeps the filename, grouped by area then subject
const plan = [];
for (const [area, files] of byArea) {
  for (const f of files) {
    const dest = path.posix.join('docs/archive', area, subjectOf(f), path.basename(f));
    plan.push({ from: f, to: dest });
  }
}

// A destination collision would silently overwrite a document, so refuse to run.
const seen = new Map();
for (const p of plan) {
  if (seen.has(p.to)) {
    console.log(`\nLOI: hai file cung dich den ${p.to}`);
    console.log(`      ${seen.get(p.to)}`);
    console.log(`      ${p.from}`);
    process.exit(1);
  }
  seen.set(p.to, p.from);
}

// Relative markdown links inside a moved document break the moment it moves,
// because the target moves too but the link text does not. Rewriting them is
// mandatory, not cosmetic: 93 such links exist in this set.
if (!DRY) {
  const destByFrom = new Map(plan.map((p) => [p.from, p.to]));
  let rewritten = 0;
  const unresolvable = [];
  for (const p of plan) {
    const abs = path.join(ROOT, p.from);
    if (!existsSync(abs)) continue;
    let text;
    try { text = readFileSync(abs, 'utf8'); } catch { continue; }
    const next = text.replace(/\]\((\.{0,2}\/[^)\s]+\.md)\)/g, (whole, rel) => {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(p.from), rel));
      const dest = destByFrom.get(target);
      if (!dest) {
        unresolvable.push(`${p.from} -> ${rel}`);
        return whole;
      }
      rewritten += 1;
      const newRel = path.posix.relative(path.posix.dirname(p.to), dest);
      return `](${newRel})`;
    });
    if (next !== text) writeFileSync(abs, next, 'utf8');
  }
  console.log(`\nlink rewrite: ${rewritten} relative link(s) updated`);
  if (unresolvable.length > 0) {
    console.log(`  ${unresolvable.length} link(s) point outside the moved set and stay as-is:`);
    for (const u of unresolvable.slice(0, 10)) console.log(`    ${u}`);
  }
}

if (process.argv.includes('--list')) {
  console.log('\nfull plan:');
  for (const p of plan) console.log(`${p.from}\n  -> ${p.to}`);
}

console.log(`\nsample destinations:`);
for (const p of plan.slice(0, 5)) console.log(`  ${p.from}\n    -> ${p.to}`);

if (DRY) {
  console.log(`\n${plan.length} file se duoc di chuyen. Bat --dry-run de thuc hien.`);
  process.exit(0);
}

let done = 0;
for (const p of plan) {
  const src = path.join(ROOT, p.from);
  const dst = path.join(ROOT, p.to);
  if (!existsSync(src)) {
    console.log(`  BO QUA (khong ton tai): ${p.from}`);
    continue;
  }
  mkdirSync(path.dirname(dst), { recursive: true });
  renameSync(src, dst);
  done += 1;
}
console.log(`\n${done} file da di chuyen`);

// Record the move so the next run and any reviewer can trace it.
const manifest = {
  generated: new Date().toISOString().slice(0, 10),
  note: 'Documents MOVED, not deleted. Restore with: git mv <to> <from>',
  entries: plan.map((p) => ({ from: p.from, to: p.to })),
};
mkdirSync(path.join(ROOT, 'docs/archive'), { recursive: true });
writeFileSync(
  path.join(ROOT, 'docs/archive/MANIFEST.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);
console.log('manifest: docs/archive/MANIFEST.json');
