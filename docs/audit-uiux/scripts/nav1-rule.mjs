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
 * WAVE 10 (2026-10-10): 3 dong tren ** deu chấp nhận generic `<…>`** giua ten
 * hook va `(`. Truoc do chi `useUrlRecord` co — 2 hook con lai giu nguyen
 * `…<hook>\s*\(` nen call site co generic khong khop. Do duoc bang self-test
 * `T12` (`useUrlValue<T>`) + `T13` (`useUrlState<T>`).
 * **Mot dong moi mot regex** — call site viet xuong dong moi (vi du
 * `AdminAuditPage.tsx:43-44`: `const [{…}, setUrlState] =` roi `useUrlState(` o
 * dong sau) thi KHONG nhan dien ⇒ bien do van bi bao loi. Hieu qua hien tai:
 * `AdminAuditPage` co **0** ung vien NAV-1 (destructure ban ghi khong khop
 * `NAME_RE`) nen khong lam lech so dem — nhung day la **han so biet**, khong
 * phai cam on. `nav1-report.mjs --why` in ra tung bien bi bo qua va vi sao.
 *
 * ⚠ **KHONG dung regex nay de "giam so"** — nghĩa la KHONG cat nhanh tu khoa
 * (bo `|q`) de con so giam. Wave 5 (2026-10-09) da lam **dung** chuyen nay mot
 * lan: nhánh `|q` rong bat **false positive** nen da sua thanh `q` phai la tu
 * doc lap (`Q_STANDALONE`), va them escape `useSearchParams` — **khong cat
 * hanh vi**. Self-test `T6`+`T7`+`T8` khoa ca hai chieu: sua rule phai loai
 * duoc `quantity`/`queueTiers`/`searchParams` **va van bat** `q` that +
 * `statusFilter`.
 */

/**
 * Dieu kien khop `const [ten, ...` — CHI KHI ten chua mot trong 6 tu khoa THAT:
 * filter | search | sort | page | tab | query
 *
 * ⚠ **KHONG dua `q` vao regex nay.** Regex nay co co `i` ⇒ bat buoc moi
 * character class deu case-insensitive, nen `q(?![a-z])` se khop `qValue` mot
 * cach SAI (do `[a-z]` khop ca chu hoa). Nhanh `q` xu ly bang ham
 * `isQueryToken` ben duoi — case-sensitive that su.
 */
export const NAME_RE =
  /const\s*\[\s*(\w*(filter|search|sort|page|tab|query)\w*)\s*,/i;

/**
 * WAVE 5 (2026-10-09) — nhanh `q` tach khoi regex.
 *
 * Ban goc viet nhanh `|q` rong ⇒ khop BAT KY ten nao co chu `q`:
 * `quantity` · `orderQuantity` · `quota` · `quotas` · `quotesBySymbol` ·
 * `queueTiers` · `selectedRequestId` (khop `Req`+`q`+`uest`).
 * Do dem bang `nav1-classify.mjs` tren `packages/web/src`: **12/104 hit la false
 * positive loai nay**.
 *
 * Quy tac: `q` chi la **ten bien** khi no la ky tu dau tien va het bien, hoac
 * camelCase (`q` + chu Hoa / so). `q` + chu thuong là tiep mot **tu tieng Anh
 * khac** ⇒ khong phai bien tim kiem.
 *
 *   q ✓ · qValue ✓ · qFilter ✓ · query ✓
 *   quantity ✗ · quote ✗ · queueTiers ✗ · quotas ✗ · orderQuantity ✗
 */
/**
 * Bat `const [ten, ...` ma KHONG dieu kien tu khoa nao — chi dung de lay ten
 * cho nhanh `q` (xem `isQueryToken`). Khong dung de quyet dinh la hit.
 */
const ANY_DESTRUCTURE_RE = /const\s*\[\s*(\w+)\s*,/;

export function isQueryToken(name) {
  if (!/^q/i.test(name)) return false;
  if (name.length === 1) return true;
  // Phan biet HOA/so (camelCase) voi chu thuong (tu tieng Anh).
  return /[A-Z0-9_]/.test(name[1]);
}

/** Lay ten hook that tu `const [x, setX] = <hook>(...)`. */
const HOOK_RE = /const\s*\[\s*(\w+)\s*,\s*\w+\s*\]\s*=\s*(\w+)/;

/**
 * `const [ten, setTen] = useUrlValue("k", …)` — khoa chinh laxac `ten`.
 *
 * ⚠ WAVE 10: cho phep **generic type** `<…>` chen giua ten hook va `(`.
 * Ly do — hook nay la generic: `useUrlValue<T>("k", codec, default)`. Ban regex
 * cuoi bang `useUrlValue\s*\(` nen call site co generic KHONG khop ⇒ rule khong
 * dang ky bien ⇒ **bao loi oan** cho mot bien DA dong bo URL that.
 * Do ghi nhanh 2026-10-09 tai `TenantUsageSummaryPage.tsx:48`:
 *   const [tab, setTab] = useUrlValue<UsageTab>("tab", usageTabCodec, DEFAULT_TAB);
 * Day KHONG phai "gate do sai" ma la "gate chua doc het nguon chung" — sua
 * regex de nhan dien het call site, KHONG phai noi rule "ten chua Tab thi bo qua".
 */
const USE_URL_VALUE_RE =
  /const\s*\[\s*(\w+)\s*,\s*\w+\s*\]\s*=\s*useUrlValue\s*(?:<[^>]*>)?\s*\(\s*['"`]([^'"`]+)['"`]/g;

/**
 * `const [{ a, b }, setS] = useUrlState(` — khoa la cac key ben trong `{}`.
 *
 * ⚠ WAVE 10: cung ly do voi `USE_URL_VALUE_RE` — cho phep generic `<…>`.
 * ⚠ Hien tai loi nay **AN**: dong dang ky co dang destructure BAN GHI
 * `const [{…}, setS] =` nen `NAME_RE` khong khop ⇒ `nav1Candidate` tra null
 * vi ly do KHAC HANG, khong phai vi regex. Do la phien ban AN cua cung loai
 * bug (escape "may manh" nham loi nguyen nhan that).
 */
const USE_URL_STATE_RE =
  /const\s*\[\s*\{([^}]*)\}\s*,\s*\w+\s*\]\s*=\s*useUrlState\s*(?:<[^>]*>)?\s*\(/g;

/**
 * `const [filters, setFilters] = useUrlRecord<JobFilters>(` (WAVE 4 / S4).
 *
 * ⚠ Phai cho phep **generic type** `<…>` chen giua ten hook va `(` — bo qua thi
 * rule khong nhan dien call site nao va `filters` van bi bao loi *sau khi da
 * sua xong*. Do la thu tu: sua code truoc, sua regex sau — neu nguoc lai, gate
 * // bao loi ve mot thu da dung.
 *
 * ⚠ WAVE 10: `useUrlValue` va `useUrlState` **da** cho phep generic o tren.
 * Wave 4 chi sua 1 trong 3 hook ⇒ 2 hook con lai giu nguyen loi. Khac phai
 * 3 regex rieng co cung mot loi — sua chung mot lan cho ca 3.
 */
const USE_URL_RECORD_RE =
  /const\s*\[\s*(\w+)\s*,\s*(\w+)\s*\]\s*=\s*useUrlRecord\s*(?:<[^>]*>)?\s*\(/g;

/**
 * WAVE 5 (2026-10-09) — `useSearchParams` / `useRouterSearchParams` (react-router).
 *
 * Bien `searchParams` tu hook nay **CHINH LA URL** — no la nguon doc trang thai
 * deep-link, khong phai mot bo loc chua dong bo. Truoc wave 5 rule bao loi o
 * 3 file: `ShellOperationsCenterPage.tsx:40` · `ScreenerPage.tsx:158` ·
 * `SupportPage.tsx:47`. Self-test `T8` khoa lai hanh vi nay.
 *
 * ⚠ Chua them `useUrlSearchParams`/hook tu thu vien khac — chua gap o repo nay.
 * Khi gap, them vao day chu them regex, KHONG sua choi regex khac.
 */
const USE_SEARCH_PARAMS_RE =
  /const\s*\[\s*(\w+)\s*,\s*\w+\s*\]\s*=\s*use(?:Router)?SearchParams\s*\(/g;

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
    USE_SEARCH_PARAMS_RE.lastIndex = 0;
    while ((m = USE_SEARCH_PARAMS_RE.exec(line)) !== null) {
      out.set(m[1], "searchParams");
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
/**
 * WAVE 9 — escape "bien cache du lieu", KHONG phai "tab dang chon".
 *
 * `SocSignalsPanel.tsx:359-361` co 4 bien:
 *   const [configTab, setConfigTab] = useState<SignalTabData<...>>(emptyTab());
 * Ten chua chu `Tab` nen rule bat nham — nhung chung **khong phai tab**:
 * `SignalTabData<T>` = `{ loading, loaded, error, data }` la **cache du lieu**
 * lazy-load. Tab thuc su la `subTab` (`:346`).
 *
 * Vì sao khong noi rule "ten chua `Tab` thi bo qua": wave 5 da hoc bai —
 * noi rule bat rong se lam yeu gate, va `WhaleBubbleChart.wb_tab` /
 * `WorkstationLayout.ws_tab` la tab THAT, phai van bi bat.
 *
 * Vì sao khong escape theo ten: 4 ten nay chi ngau nhiem mot lan, them ten
 * vao den blacklist se **lan manh** khi file doi. Escape theo **hinh dang khai
 * bao**, dung cho ca 4 va moi bien cung kieu.
 *
 * Phai co **bang chung tren dong code** (khong phai ten ham): dong khai bao
 * phai co `useState` **kem kieu du lieu** (generic) — `useState('all')` hay
 * `useState(0)` la gia tri don, van phai bi bat nhu truoc.
 *
 * ⚠ Regex chi kiem tra **ten kieu ngay sau `useState<`** chu khong phai noi
 * dung ca generic. Ly do: `SignalTabData<{ config: Record<string, unknown> }>`
 * co generic LONG NHAU, nen `[^>]*` dung o dau tien `>` va khong khop.
 * (Do duoi day — ban regex dau tien KHONG bat T9, va chinh self-test T9 bat
 * duoc, chu khong phai test doc ma vua them.)
 */
export const DATA_CACHE_RE =
  /const\s*\[\s*(\w+)\s*,\s*\w+\s*\]\s*=\s*useState\s*<\s*(\w*(?:Data|Cache|Collection)\w*)/;

export function nav1Candidate(line, synced) {
  const m = line.match(NAME_RE);
  if (!m && !line.match(ANY_DESTRUCTURE_RE)) return null;
  const name = m ? m[1] : ANY_DESTRUCTURE_RE.exec(line)[1];
  if (!m && !isQueryToken(name)) return null;
  // Escape CAP BIEN: bien nay co that su la key cua hook URL thi bo qua.
  if (synced.has(name)) return null;
  // Escape CACHE DU LIEU: `useState<SignalTabData<T>>(...)` — gia tri co kieu,
  // khong phai tab/filter dang chon. KHONG phai moi ten chua "Tab".
  const cache = line.match(DATA_CACHE_RE);
  if (cache && cache[1] === name) return null;
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