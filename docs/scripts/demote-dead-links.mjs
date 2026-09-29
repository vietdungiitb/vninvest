// Mark the 9 dead links that predate the archive, so a link check reaches a
// clean state instead of carrying a permanent "known failures" list.
//
// These point at documents that were never committed (`TERMS_OF_SERVICE.md`,
// `SPRINT32_CODE_TEMPLATES.md`, `backend/CHANGELOG.md`, ...). An earlier pass
// correctly refused to guess a target and left the text alone, which is the right
// call for a link - but for a reference list in a historical plan it is noise: the
// reader is told a file is missing rather than that it was planned and never
// written. Rewriting the link into plain text preserves the intent and removes the
// false signal, and does not invent a path.
//
// Only a link whose target does not exist ANYWHERE is touched. Anything that can
// be repointed is handled by fix-md-links.mjs instead.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const APPLY = process.argv.includes('--apply');

const trackedMd = execSync('git ls-files', { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  .split('\n')
  .filter((f) => f.endsWith('.md') && existsSync(path.join(ROOT, f)));

const byBasename = new Map();
for (const f of trackedMd) {
  const bn = path.posix.basename(f);
  if (!byBasename.has(bn)) byBasename.set(bn, []);
  byBasename.get(bn).push(f);
}

const LINK_RE = /\[([^\]]+)\]\(([^)\s]*?\.md)(?:#[^)\s]*)?\)/g;

let demoted = 0;
let repointable = 0;
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

  const next = text.replace(LINK_RE, (whole, label, rel) => {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rel) || /^[a-z]:[\\/]/i.test(rel)) return whole;
    const resolved = path.posix.normalize(path.posix.join(dir, rel));
    if (existsSync(path.join(ROOT, resolved))) return whole;
    const fromRoot = path.posix.normalize(rel);
    if (fromRoot !== resolved && existsSync(path.join(ROOT, fromRoot))) {
      repointable += 1;
      report.push(`repointable ${f} :: ${rel} -> ${fromRoot}`);
      return whole;
    }
    const candidates = byBasename.get(path.posix.basename(rel)) || [];
    if (candidates.length > 0) {
      repointable += 1;
      report.push(`repointable ${f} :: ${rel} (exists as ${candidates[0]})`);
      return whole;
    }
    // Target exists nowhere: the document was planned and never written. Keep the
    // words, drop the link.
    demoted += 1;
    report.push(`demoted     ${f} :: [${label}](${rel})  ->  ${label} (khong ton tai, giu chu thoi)`);
    return `${label} _(khong ton tai)_`;
  });

  if (next !== text && APPLY) writeFileSync(abs, next, 'utf8');
}

console.log(APPLY ? 'APPLY' : 'DRY RUN');
console.log(`links demoted to plain text : ${demoted}   (target exists nowhere)`);
console.log(`still repointable          : ${repointable}   (fix-md-links.mjs should handle)`);
for (const r of report) console.log(`  ${r}`);
