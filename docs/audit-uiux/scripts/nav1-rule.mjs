/**
 * NAV-1 — "bo loc/sap xep/phan trang khong dong bo URL".
 *
 * Tach rieng thanh module de 3 noi dung CHUNG mot mo hinh:
 *   1. `scan-ui-guidelines.mjs`  — gate chay trong CI/hook
 *   2. `nav1-report.mjs`         — bao cao chi tiet (dung de lap ke hoach)
 *   3. `--self-test` cua scanner — chung minh am
 *
 * ⚠ **LY DO TACH RA (WAVE 4, S4 / Major 1)** — ban "escape" cua rule la **CAP
 * FILE**: `fileHasUrlSync` quet TOAN BO noi dung file, ke ca COMMENT. Hai he qu
 * do, ca hai deu da xay ra that:
 *
 *   (a) MOT DONG COMMENT chua `useSearchParams` lam **ca file** duoc coi la da
 *       dong bo URL ⇒ **moi hit NAV-1 trong file bien mat khoi gate**. Da xay
 *       ra 1 lan trong wave 3 (3 hit bien mat oan).
 *   (b) Escape cap file che luon **cac bien CHUA sync** trong cung file. Rule
 *       manh hon thi hit it hon ⇒ gate yeu hon ma khong ai bao gi.
 *
 * Ban sua: escape **CAP BIEN**, va chi chap nhan bang chung **tren dong code**.
 *
 * CHUNG MINH escape cap file VO DUNG (do bang `nav1-report.mjs --why`):
 * 7 file goi `useUrlState` deu destructure **ban ghi** —
 *   `const [{ activeTab, pageSize }, setUrlState] = useUrlState(...)`
 * nen regex NAV-1 (`const [ <ten> ,`) **khong khop** ⇒ 0 hit NAV-1 trong ca 7 file
 * ⇒ **khong file nao da sua can escape**. 7 file bi escape cap file che deu
 * `hasHook=false` (khong goi hook nao) ⇒ escape chi che, khong giup gi.
 *
 * ⚠ **HAN SO BIET — sua regex nay thi dem lai `uiux-baseline.json`.** Chi cac
 * call site co **literal** duoc nhan dien:
 *   - `const [x, setX] = useUrlValue("tenThamSo", …)`   → khoa `x`
 *   - `const [{ a, b }, setS] = useUrlState(`           → khoa `a`, `b`
 *   - `const [rec, setRec] = useUrlRecord<…>(`          → khoa `rec`
 * **Mot dong moi mot regex** — call site viet xuong dong moi (vi du
 * `AdminAuditPage.tsx:43-44`: `const [{…}, setUrlState] =` roi `useUrlState(` o
 * dong sau) thi KHONG nhan dien ⇒ bien do van bi bao loi. Hieu qua hien tai:
 * `AdminAuditPage` co **0** ung vien NAV-1 (destructure ban ghi khong khop
 * `NAME_RE`) nen khong lam lech so dem — nhung day la **han so biet**, khong
 * phai cam on. `nav1-report.mjs --why` in ra tung bien bi bo qua va vi sao.
 *
 * ⚠ **KHONG dung regex nay de "giam so"**. Ha `|q` trong `NAME_RE` se xoa
 * `quantity` / `quota` / `quotesBySymbol` — nhung cai do **la false positive
 * cua rule**, va xoa chung de giam count la lam yeu gate (dung lesson
 * `HANDOFF_UIUX_WAVE3_20261008.md` §4.2 dong 1). No giu nguyen, ghi vao bao
 * cao de can tiep tuc sua **rule**, khong sua **so**.
 */

/**
 * Dieu kien khop `const [ten, ...` — CHI KHI ten chua mot trong:
 * filter | search | sort | page | tab | query | q
 *
 * Giu nguyen y nghia cua wave 2 (ke ca nhánh `q` rong) de khong doi hanh vi
 * gate ngoai y dinh nghia cua chinh minh.
 */
export const NAME_RE = /const\s*\[\s*(\w*(filter|search|sort|page|tab|query|q)\w*)\s*,/i;

/** Lay ten hook that tu `const [x, setX] = <hook>(...)`. */
const HOOK_RE = /const\s*\[\s*(\w+)\s*,\s*\w+\s*\]\s*=\s*(\w+)/;

/** `const [ten, setTen] = useUrlValue("k", …)` — khoa chinh laxac `ten`. */
const USE_URL_VALUE_RE =
  /const\s*\[\s*(\w+)\s*,\s*\w+\s*\]\s*=\s*useUrlValue\s*\(\s*['"`]([^'"`]+)['"`]/g;

/** `const [{ a, b }, setS] = useUrlState(` — khoa la cac key ben trong `{}`. */
const USE_URL_STATE_RE =
  /const\s*\[\s*\{([^}]*)\}\s*,\s*\w+\s*\]\s*=\s*useUrlState\s*\(/g;

/**
 * `const [filters, setFilters] = useUrlRecord<JobFilters>(` (WAVE 4 / S4).
 *
 * ⚠ Phai cho phep **generic type** `<…>` chen giua ten hook va `(` — bo qua thi
 * rule khong nhan dien call site nao va `filters` van bi bao loi *sau khi da
 * sua xong*. Do la thu tu: sua code truoc, sua regex sau — neu nguoc lai, gate
 // bao loi ve mot thu da dung.
 */
const USE_URL_RECORD_RE =
  /const\s*\[\s*(\w+)\s*,\s*(\w+)\s*\]\s*=\s*useUrlRecord\s*(?:<[^>]*>)?\s*\(/g;

/**
 * Tap `ten bien` -> `ten tham so URL` cho cac bien **that su** doc/ghi URL.
 *
 * ⚠ **TU LOAI COMMENT TRONG CHINH NHA (defensive).** Scanner truyen san mang
 * da loc, nhung ham nay duoc `export` cho `nav1-report.mjs` va cho tuong lai.
 * Do lai 2026-10-09: khi cho no doc **text thuc** co comment, no van nhan ra
 * hook call nam trong comment ⇒ mot caller trong tuong lai truyen `txt.split()`
 * la gate lai quay ve dung loi (a) ma wave 4 vua sua. Test `T5` cua scanner
 * khoa lai dung hanh vi nay.
 *
 * Loc 2 lan la idempotent: mang da loi roi thì khong còn comment nào để bỏ.
 *
 * @param {string[]} lines dong code (uoc tinh da loai comment)
 * @returns {Map<string,string>} tenBien -> tenThamSo
 */
export function urlSyncedVars(lines) {
  const state = { inBlock: false };
  const code = lines.filter((l) => !isCommentLine(l, state));
  const out = new Map();
  for (const line of code) {
    USE_URL_VALUE_RE.lastIndex = 0;
    let m;
    while ((m = USE_URL_VALUE_RE.exec(line)) !== null) {
      out.set(m[1], m[2]);
    }
    USE_URL_STATE_RE.lastIndex = 0;
    while ((m = USE_URL_STATE_RE.exec(line)) !== null) {
      for (const part of m[1].split(",")) {
        const name = part.split(":")[0].trim().replace(/^\.\.\./, "");
        if (/^[A-Za-z_$][\w$]*$/.test(name)) out.set(name, name);
      }
    }
    USE_URL_RECORD_RE.lastIndex = 0;
    while ((m = USE_URL_RECORD_RE.exec(line)) !== null) {
      out.set(m[1], m[1]);
    }
  }
  return out;
}

/**
 * Kiem tra 1 dong co phai ung vien NAV-1 khong.
 *
 * @param {string} line
 * @param {Map<string,string>} synced tu `urlSyncedVars`
 * @returns {{name:string, hook:string}|null}
 */
export function nav1Candidate(line, synced) {
  const m = line.match(NAME_RE);
  if (!m) return null;
  const name = m[1];
  // Escape CAP BIEN: bien nay co that su la key cua hook URL thi bo qua.
  if (synced.has(name)) return null;
  const hook = HOOK_RE.exec(line);
  return { name, hook: hook ? hook[2] : "useState" };
}

/**
 * Loc dong comment — giong ban scanner cu nhung dung chung de 3 noi khong lech.
 * @param {string} line
 * @param {{inBlock:boolean}} state doi truc, phai truyen lai giua cac dong
 */
export function isCommentLine(line, state) {
  const t = line.trim();
  if (state.inBlock) {
    if (t.includes("*/")) state.inBlock = false;
    return true;
  }
  if (t.startsWith("//") || t.startsWith("<!--")) return true;
  if (t.startsWith("/*")) {
    if (!t.includes("*/")) state.inBlock = true;
    return true;
  }
  if (t.startsWith("*")) return true;
  if (/^https?:\/\//.test(t)) return true;
  return false;
}

/**
 * Tach file thanh 2 mang song song: dong code + so dong THAT.
 *
 * @param {string} txt
 * @returns {{lines:string[], trueLine:number[]}}
 */
export function codeLines(txt) {
  const raw = txt.split(/\r?\n/);
  const state = { inBlock: false };
  const kept = [];
  raw.forEach((l, idx) => {
    if (!isCommentLine(l, state)) kept.push({ t: l, n: idx + 1 });
  });
  return { lines: kept.map((k) => k.t), trueLine: kept.map((k) => k.n) };
}