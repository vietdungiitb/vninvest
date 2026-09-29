// Count broken markdown links, separating pre-existing breakage from what this
// archive change introduced.
//
// The repo already had broken links before the move (266 of 485). Reporting a
// single "broken: N" number would make it impossible to tell whether the archive
// helped or hurt, so the baseline is measured in a throwaway worktree of the
// pre-archive commit and the two sets are diffed.
//
//   only-after  -> broken BECAUSE of the move. Must reach 0.
//   both        -> already broken before. Reported, not this change's doing.
//   only-before -> the move fixed these.
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const LINK_RE = /\]\(([^)\s]*?\.md)(?:#[^)\s]*)?\)/g;

function brokenIn(dir) {
  const out = new Set();
  let localAbs = 0;
  let files;
  try {
    files = execSync('git ls-files', { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, cwd: dir })
      .split('\n')
      .filter((f) => f.endsWith('.md') && existsSync(path.join(dir, f)));
  } catch {
    return out;
  }
  const absPrefix = dir.toLowerCase();
  for (const f of files) {
    let text;
    try {
      text = readFileSync(path.join(dir, f), 'utf8');
    } catch {
      continue;
    }
    const d = path.posix.dirname(f);
    for (const m of text.matchAll(LINK_RE)) {
      const rel = m[1];
      if (/^file:\/\//i.test(rel) || /^[a-z]:[\\/]/i.test(rel)) {
        // Local absolute path written by whoever authored the document. Not a
        // repository link: it was already invalid in a fresh clone. Counted apart
        // and never attributed to the archive.
        localAbs += 1;
        continue;
      }
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rel)) continue;
      const resolved = path.posix.normalize(path.posix.join(d, rel));
      // Key on the BASENAME of the source, not its path: the archive moved 1368
      // documents, and keying on the full path made every one of their links look
      // like a new breakage.
      if (!existsSync(path.join(dir, resolved))) {
        out.add(`${path.posix.basename(f)} :: ${rel}`);
      }
    }
  }
  return { out, localAbs };
}

const before = (() => {
  const wt = mkdtempSync(path.join(tmpdir(), 'md-base-'));
  try {
    execSync(`git worktree add --detach "${wt}" HEAD`, { stdio: 'ignore' });
    return brokenIn(wt).out;
  } catch {
    return new Set();
  } finally {
    try {
      execSync(`git worktree remove --force "${wt}"`, { stdio: 'ignore' });
      rmSync(wt, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
})();

const afterResult = brokenIn(ROOT);
const after = afterResult.out;

const onlyAfter = [...after].filter((x) => !before.has(x));
const onlyBefore = [...before].filter((x) => !after.has(x));
const both = [...after].filter((x) => before.has(x));

console.log(`broken before archive : ${before.size}`);
console.log(`broken after archive  : ${after.size}`);
console.log(`NEWLY broken (ours)   : ${onlyAfter.length}`);
console.log(`FIXED by archive      : ${onlyBefore.length}`);
console.log(`broken in both        : ${both.length}   (pre-existing, unrelated to this change)`);
console.log(`local file:// links   : ${afterResult.localAbs}   (not repository links; already invalid in a fresh clone)`);

if (onlyAfter.length > 0) {
  console.log('\nNEWLY broken:');
  for (const x of onlyAfter.slice(0, 40)) console.log(`  ${x}`);
  if (onlyAfter.length > 40) console.log(`  ...and ${onlyAfter.length - 40} more`);
}

process.exit(onlyAfter.length === 0 ? 0 : 1);
