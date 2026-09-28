/**
 * deny-extract.mjs — trich danh sach deny list tu bang markdown trong
 * AGENT_PROTOCOL.md / AGENTS.md / CLAUDE.md.
 *
 * Tách riêng khoi agent-preflight.mjs de:
 *   (1) co bang chung do duoc (verify-deny-extract.mjs)
 *   (2) hai noi dung cung mot quy tac — bao dam preflight va probe khong lech.
 *
 * BA cua regex goc (chi trich duoc 4/11 muc §2, do chay true 2026-09-27):
 *   (a) CELL NHIEU PATH: `| \`pyproject.toml\`, \`requirements.txt\` |`
 *       regex cu yeu cau `|` ngay sau path dau nen bo ca cell.
 *   (b) GLOB: `docker-compose*.yml`, `.env*` — dau `*` khong nam trong
 *       lop ky tu `[A-Za-z0-9_./-]` nen fail.
 *   (c) DUOI IT: chi nhan md|json|yml|yaml|txt|lock — thieu toml, sh, py, ts...
 *
 * Mac dinh 16 file dang che phan bi lo, nen co che doc-tai-lieu yeu hon quang
 * cao nhung van du 11/11 — do bi cam bang mac dinh, KHONG phai do doc dung.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Duoi file duoc cong nhan. Moi them duoi o day phai them vao KNOWN o probe. */
const EXT = "md|json|jsonc|yml|yaml|toml|txt|lock|sh|bash|ps1|ts|tsx|js|mjs|cjs|cfg|ini";

/**
 * LAY NGUYEN CELL DAU cua dong bang `| ... |`, roi tach moi path ben trong.
 * Cach nay khong phu thuoc vao noi dung phia sau, nen:
 *   - cell nhieu path tach bang `,` / `;` van ra het
 *   - `*` trong glob giu nguyen
 */
const ROW_RE = /^\|([^|]+)\|/gm;
const CODE_RE = new RegExp("`([^`]+)`", "g");
/**
 * Path hop le. Ba nhom:
 *   1. co duoi file keu: `packages/web/package.json`, `pyproject.toml`
 *   2. co duoi + glob:  `docker-compose*.yml`
 *   3. KHONG co duoi ma la ten an (bat dau `.`) co glob: `.env*`, `.env.example`
 *      `.env*` co dau `*` o CUOI nen khong khop nhom 1 hay 2 — truong hop nay
 *      chinh la ly do protocol ghi `.env*` ma regex duoi file bo sot.
 */
const PATH_RE = new RegExp(
  "^(?:" +
    `[A-Za-z0-9_./-]+\\.(?:${EXT})` + // co duoi keu: `packages/web/package.json`
    "|" +
    `[A-Za-z0-9_./*-]*\\.(?:${EXT})\\*?` + // glob: `*` o STEM va/hoac sau duoi
    "|" +
    `\\.[A-Za-z0-9_.*-]+` + // ten an: .env* / .env.example / .github
  ")$",
);

/**
 * Tach mot doan trong backtick thanh NHIEU path.
 *
 * Cac dang gap that trong AGENT_PROTOCOL.md §2 (2026-09-27):
 *   - `pyproject.toml`, `requirements.txt`          → nhieu path, tach bang dau phay
 *   - `docker-compose*.yml`, `.env*`                 → glob, `*` phai giu nguyen
 *   - `packages/web/package.json`                    → co tien to duong dan
 *   - `docker-compose*.yml: dung chung`              → co giai thich sau dau hai cham
 * Khong tach dau hai cham thi se sinh ten file sai va regex khong match.
 */
function splitPaths(frag) {
  return frag
    .split(/[,;]/)
    .map((s) => s.split(":")[0]) // bo giai thich sau dau hai cham
    .map((s) => s.replace(/^["']|["']$/g, "").replace(/^\.\//, "").trim())
    .filter(Boolean);
}

export function extractFromTable(text) {
  const out = new Set();
  for (const row of text.matchAll(ROW_RE)) {
    // Bo qua dong tieu de va dong phan cach `| --- | --- |`
    const cell = row[1].trim();
    if (!cell || /^:?-{2,}/.test(cell)) continue;
    // Lay moi doan trong backtick; cell co the chua nhieu path tach bang dau phay
    const inner = [...cell.matchAll(CODE_RE)].flatMap((m) => splitPaths(m[1]));
    const candidates = inner.length ? inner : splitPaths(cell);
    for (const path of candidates) {
      if (PATH_RE.test(path)) out.add(path);
    }
  }
  return [...out];
}

/** Nạp deny list: mặc định + bảng trong docs (file đầu tiên có bảng là chính). */
export function loadDenyList(REPO, defaultList, appendOnlyList) {
  const appendOnly = new Set(appendOnlyList);
  const set = new Set();
  for (const f of defaultList) if (!appendOnly.has(f)) set.add(f);

  for (const name of ["docs/AGENT_PROTOCOL.md", "AGENT_PROTOCOL.md", "AGENTS.md", "CLAUDE.md"]) {
    const p = join(REPO, name);
    if (!existsSync(p)) continue;
    const found = extractFromTable(readFileSync(p, "utf8"));
    let added = 0;
    for (const path of found) {
      if (appendOnly.has(path)) continue;
      set.add(path);
      added += 1;
    }
    if (added) break; // file đầu tiên có bảng là nguồn chính
  }
  return [...set];
}
