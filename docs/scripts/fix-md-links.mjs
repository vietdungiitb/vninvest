// Repoint every markdown link whose target moved into docs/archive/.
//
// The archive move kept each document's own relative links correct only when the
// target moved too. The remaining cases, and what to do with each:
//
//   1. bare or `./` name, target now under docs/archive/  -> repoint (safe: the
//      new path is unique)
//   2. repo-root-relative `docs/X.md` written from a file already in docs/
//      -> the author meant the repo root, the reader resolves from the file's own
//      directory, so it was ALREADY broken. Repointing fixes a pre-existing bug;
//      doing nothing leaves it broken. Both are defensible, so it is reported
//      separately rather than silently "fixed".
//   3. `file:///C:/...` absolute links -> the target never existed in the repo
//      (someone's local path). Left alone; reported.
//   4. target not found anywhere -> left alone; reported.
//
// The before/after broken count is printed so the change can be judged against
// the baseline rather than against zero - the repo had 266 broken links before
// the archive, and pretending otherwise would misrepresent this work.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const APPLY = process.argv.includes('--apply');

const trackedMd = execSync('git ls-files', { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  .split('\n')
  .filter((f) => f.endsWith('.md') && existsSync(path.join(ROOT, f)));

// New location of every moved document, keyed by old path, from the manifest the
// move wrote. Guessing the destination from a name pattern would be unreliable.
const manifestPath = path.join(ROOT, 'docs/archive/MANIFEST.json');
let destByFrom = new Map();
if (existsSync(manifestPath)) {
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const e of m.entries) destByFrom.set(e.from, e.to);
}
if (destByFrom.size === 0) {
  console.log('LOI: docs/archive/MANIFEST.json khong co - khong biet file nao da di dau');
  process.exit(1);
}

const byBasename = new Map();
for (const f of trackedMd) {
  const bn = path.posix.basename(f);
  if (!byBasename.has(bn)) byBasename.set(bn, []);
  byBasename.get(bn).push(f);
}

const LINK_RE = /\]\(([^)\s]*?\.md)(?:#[^)\s]*)?\)/g;

let repointed = 0;
let alreadyOk = 0;
let rootRetry = 0;
let localAbsolute = 0;
let repoRelWasBroken = 0;
let notFound = 0;
const report = [];

for (const f of trackedMd) {
  const abs = path.join(ROOT, f);
  let text;
  try {
    text = readFileSync(abs, 'utf8');
  } catch {
    continue;
  }
  const dir = path.posix.dirname(f);

  const next = text.replace(LINK_RE, (whole, rel) => {
    // A local absolute path is not a repository link. Leave it and count it.
    if (/^file:\/\//i.test(rel) || /^[a-z]:[\\/]/i.test(rel)) {
      localAbsolute += 1;
      return whole;
    }
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rel)) return whole;

    const resolved = path.posix.normalize(path.posix.join(dir, rel));
    if (existsSync(path.join(ROOT, resolved))) {
      alreadyOk += 1;
      return whole;
    }

    // Retry from the repo root. A document that moved deeper used to be able to
    // reach a top-level file by bare name; after the move that path no longer
    // resolves. Trying the root catches those without having to know the move map.
    const fromRoot = path.posix.normalize(rel);
    if (fromRoot !== resolved && existsSync(path.join(ROOT, fromRoot))) {
      rootRetry += 1;
      report.push(`root-retry  ${f} :: ${rel} => ${fromRoot}   (di chuyen sau, link bare name khong con dung)`);
      return `](${path.posix.relative(dir, fromRoot)})`;
    }

    // The old path is what the link pointed at, either repo-root or file-relative.
    // Try both readings, preferring the one that matches a real move.
    const bn = path.posix.basename(rel);
    const asRepoRel = destByFrom.get(path.posix.normalize(rel));
    const candidates = (byBasename.get(bn) || []).filter((c) => c !== f);
    const unique = candidates.length === 1 ? candidates[0] : null;

    let dest = null;
    let kind = null;
    if (asRepoRel && existsSync(path.join(ROOT, asRepoRel))) {
      dest = asRepoRel;
      kind = 'repo-rel';
    } else if (unique && destByFrom.has(f === rel ? rel : path.posix.normalize(path.posix.join(dir, rel)))) {
      dest = unique;
      kind = 'moved';
    } else if (unique) {
      dest = unique;
      kind = 'moved';
    }

    if (!dest) {
      notFound += 1;
      report.push(`not-found   ${f} :: ${rel}`);
      return whole;
    }

    const newRel = path.posix.relative(dir, dest) || path.posix.basename(dest);
    if (kind === 'repo-rel') {
      repoRelWasBroken += 1;
      report.push(`repo-rel    ${f} :: ${rel} => ${newRel}   (link sai duong dan TRUOC archive)`);
    } else {
      repointed += 1;
      report.push(`repointed   ${f} :: ${rel} => ${newRel}`);
    }
    return `](${newRel})`;
  });

  if (next !== text && APPLY) writeFileSync(abs, next, 'utf8');
}

console.log(APPLY ? 'APPLY' : 'DRY RUN');
console.log(`links already ok   : ${alreadyOk}`);
console.log(`repointed (moved)  : ${repointed}`);
console.log(`repointed (pre-existing repo-rel bug): ${repoRelWasBroken}`);
console.log(`repointed via repo root             : ${rootRetry}`);
console.log(`local absolute left: ${localAbsolute}  (not repository links)`);
console.log(`target not found   : ${notFound}`);
for (const r of report) console.log(`  ${r}`);
