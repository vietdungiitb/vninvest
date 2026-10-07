/**
 * Khoi phuc DURATION goc cua tung rule tu `dev`.
 *
 * Script `propose-transition-props.mjs` khi sua chua khoi phuc duoc 45 rule deu
 * gan `0.2s`. Nhung ban goc khac nhau: 0.15s / 0.18s / 0.2s / 0.3s. Gan het
 * 0.2s la doi cam giac UI so voi thiet bi da chon truoc day.
 * ⇒ Doc `dev` theo selector roi gan LAI dung gia tri goc.
 *
 * Chay:
 *   node docs/audit-uiux/scripts/restore-durations.mjs
 *   node docs/audit-uiux/scripts/restore-durations.mjs --apply
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const APPLY = process.argv.includes("--apply");
const DEV = process.argv[2] ?? "dev";

function cssFiles(root) {
  const out = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (["node_modules", "__tests__", "tests"].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith(".css")) out.push(p);
    }
  };
  walk(root);
  return out;
}

/** { selector -> "duration easing" } tu noi dung CSS. */
function durationMap(txt) {
  const map = new Map();
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(txt)) !== null) {
    const sel = m[1].trim().replace(/\s+/g, " ");
    const t = /transition\s*:\s*all\b([^;]*);/.exec(m[2]);
    if (t && t[1].trim()) map.set(sel, t[1].trim());
  }
  return map;
}

let fixed = 0;
let missed = 0;
const files = cssFiles("packages/web/src");

for (const f of files) {
  const rel = f.replace(/\\/g, "/");
  let devTxt;
  try {
    devTxt = execFileSync("git", ["show", `${DEV}:${rel}`], { encoding: "utf8" });
  } catch {
    continue; // file moi, khong co o dev
  }
  const map = durationMap(devTxt);
  if (map.size === 0) continue;

  const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
  let dirty = false;

  // rebuild block -> selector de khop
  let buf = [];
  for (let i = 0; i < lines.length; i += 1) {
    const ln = lines[i];
    const mm = /^(\s*)transition\s*:\s*([a-zA-Z-]+(?:\s*,\s*[a-zA-Z-]+)+)\s+([\d.]+m?s)\s*;\s*$/.exec(ln);
    if (mm) {
      // selector = dong ke tren chua `{` (hoac dong dau block)
      let sel = "";
      for (let j = i - 1; j >= 0 && j >= i - 40; j -= 1) {
        const cand = lines[j];
        if (cand.includes("{") && !cand.includes("}")) {
          sel = cand.replace(/\{.*$/, "").trim().replace(/\s+/g, " ");
          break;
        }
      }
      const dur = map.get(sel);
      if (dur && dur !== mm[3]) {
        lines[i] = `${mm[1]}transition: ${mm[2]} ${dur};`;
        fixed += 1;
        dirty = true;
      } else if (!dur) {
        missed += 1;
      }
    }
    buf.push(lines[i]);
  }
  if (dirty && APPLY) fs.writeFileSync(f, lines.join("\n"), "utf8");
}

console.log(`khoi phuc duration goc tu ${DEV}: ${fixed} rule${APPLY ? " (da ghi file)" : " (chua ghi - them --apply)"}`);
console.log(`khong tim thay selector o ${DEV}: ${missed} rule (giu nguyen gia tri hien tai)`);
