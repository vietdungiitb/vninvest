import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Mirror of the demo blueprint's build provenance: health.json must prove the
// exact commit and a clean tree. `git status --porcelain` returns "" when clean.
const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
const dirty = status.length > 0;
const out = resolve(process.cwd(), 'dist/health.json');
mkdirSync(resolve(process.cwd(), 'dist'), { recursive: true });
writeFileSync(out, `${JSON.stringify({ ok: true, commit, dirty }, null, 2)}\n`);
console.log(`health.json: commit=${commit} dirty=${dirty}`);
if (dirty) process.exitCode = 1;
