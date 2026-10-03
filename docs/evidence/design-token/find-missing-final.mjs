// Authoritative: evaluate every referenced key against BOTH dicts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const refs = new Set();
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) { walk(p); continue; }
    if (!/\.(tsx?|js)$/.test(p) || p.includes('__tests__') || p.includes('.test.')) continue;
    const txt = fs.readFileSync(p, 'utf8');
    const re = /t\("(aiCommandCenter|aiUsageAnalytics|aiAgentFederation|aiAdvisoryWarning)\.([A-Za-z0-9_]+)"/g;
    let m;
    while ((m = re.exec(txt))) refs.add(`${m[1]}.${m[2]}`);
  }
}
walk('packages/web/src');
const root = path.dirname(fileURLToPath(new URL('.', import.meta.url)));
const vi = (await import(`file://${root}/../../packages/web/src/i18n/vi.js`)).default;
const en = (await import(`file://${root}/../../packages/web/src/i18n/en.js`)).default;
const get = (o, k) => String(k).split('.').reduce((a, x) => (a && typeof a === 'object' ? a[x] : undefined), o);
const out = { referenced: refs.size, missingVi: [], missingEn: [], missingBoth: [] };
for (const k of [...refs].sort()) {
  const mv = get(vi, k) === undefined, me = get(en, k) === undefined;
  if (mv) out.missingVi.push(k);
  if (me) out.missingEn.push(k);
  if (mv && me) out.missingBoth.push(k);
}
console.log(JSON.stringify(out, null, 1));
