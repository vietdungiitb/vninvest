// Classify the .md files for archiving. Nothing is deleted here - this only
// produces a proposal for the owner to review.
//
// Reference detection loads every tracked text file once and builds a set of
// mentioned basenames, instead of running one `git grep` per .md file (1697
// subprocess calls took minutes).
//
// KNOWN LIMITATION: references are counted by BASENAME. When two .md files share
// a name, both are treated as referenced even if only the other one is. That is
// deliberately conservative - it can only ever keep too much, never delete too
// much. It also means "no inbound reference" is NOT evidence that a document is
// worthless: human-facing guides (Quickstart, deploy runbooks) have no code
// pointing at them by design.
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DEV = 'origin/dev';

const list = execSync(`git ls-tree -r ${DEV} --name-only`, {
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
}).split('\n').filter(Boolean);

const md = list.filter((f) => f.endsWith('.md'));

// Always keep: the process docs the agent workflow depends on, plus the entry
// points a human needs. Chosen by role, not by a name pattern.
const KEEP_EXACT = new Set([
  'README.md',
  'AGENTS.md',
  'docs/AGENT_PROTOCOL.md',
  'docs/CLAIMS.md',
  'docs/CODE_CHANGE_AUDIT_LEDGER.md',
  'docs/ARCHIVE_AGENTS_PROGRESS.md',
  'docs/OPEN_WORK_20260927.md',
]);

// Referenced from code, CI or compose -> must keep; deleting breaks something.
const codeLike = /\.(py|ts|tsx|js|mjs|cjs|sh|ps1|bat|yml|yaml|json|toml|ini|cfg|html|css)$/;

const basenames = new Map();
for (const f of md) {
  const bn = path.basename(f);
  if (!basenames.has(bn)) basenames.set(bn, []);
  basenames.get(bn).push(f);
}

const mentionedByCode = new Map();
const mentionedByAny = new Map();

for (const f of list) {
  if (f.endsWith('.md') && basenames.get(path.basename(f))?.length === 1) continue;
  const abs = path.join(ROOT, f);
  if (!existsSync(abs) || !statSync(abs).isFile()) continue;
  if (statSync(abs).size > 4 * 1024 * 1024) continue;
  let text;
  try {
    text = readFileSync(abs, 'utf8');
  } catch {
    continue;
  }
  const isCode = codeLike.test(f);
  for (const bn of basenames.keys()) {
    if (!text.includes(bn)) continue;
    mentionedByAny.set(bn, (mentionedByAny.get(bn) || 0) + 1);
    if (isCode) mentionedByCode.set(bn, (mentionedByCode.get(bn) || 0) + 1);
  }
}

const keep = [];
const archive = [];
const blocked = [];

for (const f of md) {
  const bn = path.basename(f);
  if (KEEP_EXACT.has(f)) {
    keep.push({ f, why: 'process doc' });
    continue;
  }
  if (f.startsWith('packages/') || f.startsWith('.github/')) {
    keep.push({ f, why: 'ships with code' });
    continue;
  }
  if ((mentionedByCode.get(bn) || 0) > 0) {
    blocked.push({ f, why: `referenced from code/CI x${mentionedByCode.get(bn)}` });
    continue;
  }
  if ((mentionedByAny.get(bn) || 0) > 0) {
    keep.push({ f, why: 'referenced by another doc' });
    continue;
  }
  archive.push({ f, why: 'no inbound reference' });
}

const bucket = (dir) => {
  const p = dir.split('/');
  if (p[0] === 'docs' && p.length > 2) return `docs/${p[1]}`;
  if (p[0] === 'docs') return 'docs/ (flat)';
  if (p.length > 1) return `${p[0]}/`;
  return '(root)';
};

const byBucket = new Map();
for (const a of archive) {
  const b = bucket(a.f);
  byBucket.set(b, (byBucket.get(b) || 0) + 1);
}

console.log(`total .md      : ${md.length}`);
console.log(`keep           : ${keep.length}`);
console.log(`blocked (code) : ${blocked.length}   <- never delete without reading`);
console.log(`archive cand.  : ${archive.length}   <- no inbound reference, owner must approve`);
console.log('\narchive candidates by area:');
for (const [b, n] of [...byBucket.entries()].sort((a, c) => c[1] - a[1])) {
  console.log(`  ${String(n).padStart(5)}  ${b}`);
}

// Last-touched date, one `git log` over the whole tree instead of one per file.
// Passing all 1463 paths on the command line exceeded the Windows command-line
// limit (ENAMETOOLONG), so the pass is bounded and filtered afterwards. stderr is
// captured too: git prints a path containing spaces or a leading dash as a
// warning and still exits 0, so an uncaptured stream can look empty.
// git quotes paths containing spaces in --name-only output, so a document in
// "docs/audit reports/" would never match the candidate set. Strip the quotes.
const norm = (s) => s.trim().replace(/^"|"$/g, '');

const stamps = new Map();
{
  const out = execSync('git log --format="c %cs" --name-only origin/dev -- docs "*.md"', {
    encoding: 'utf8',
    cwd: ROOT,
    maxBuffer: 512 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const want = new Set(archive.map((a) => a.f));
  let cur = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('c ')) {
      cur = line.slice(2, 12);
    } else if (cur && line.trim()) {
      const f = norm(line);
      if (want.has(f) && !stamps.has(f)) stamps.set(f, cur);
    }
  }
}

// `git log --name-only` prints the old path then the new path on a rename, so
// `stamps` keeps the first (oldest commit) date it sees for each path.
const byYear = new Map();
let undated = 0;
for (const a of archive) {
  // `a` is {f, why}; the map is keyed by path, so it has to be a.f here. Passing
  // the object made every lookup miss, which is why the year table came out empty
  // with all 1463 counted as undated.
  const t = stamps.get(a.f);
  if (!t) {
    undated += 1;
    continue;
  }
  const y = t.slice(0, 4);
  byYear.set(y, (byYear.get(y) || 0) + 1);
}

console.log('\narchive candidates by last-modified year:');
for (const [y, n] of [...byYear.entries()].sort()) {
  console.log(`  ${y}  ${String(n).padStart(5)}`);
}
if (undated > 0) {
  console.log(`  (no git log entry: ${undated})`);
}

const oldest = archive
  .filter((a) => stamps.has(a.f))
  .sort((a, b) => stamps.get(a.f).localeCompare(stamps.get(b.f)))
  .slice(0, 15);
console.log('\noldest 15 candidates:');
for (const a of oldest) {
  console.log(`  ${stamps.get(a.f)}  ${a.f}`);
}
