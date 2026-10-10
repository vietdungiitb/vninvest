import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  useUrlState, intCodec, boolCodec,
  type UrlStateCodec,
} from "./useUrlState";

type AlertSorting = "latest" | "largestValue";
type StatsSortKey = "count" | "value" | "time";
type StatsSortDir = "asc" | "desc";
type Lane = "main" | "ai";
type Timeframe = "5m" | "15m" | "1h" | "session" | "5d";

/**
 * WAVE 10 / NAV-1 — bộ lọc + sắp xếp + phân trang của trang Alert Center nằm
 * trong RAM nên link gửi cho người khác thì họ thấy màn hình CHƯA lọc, và F5 là
 * mất toàn bộ. Chuyển sang `useUrlState` (patch) để MỘT lần bấm = MỘT history
 * entry.
 *
 * ⚠ **WAVE 11 — bổ sung 4 trường URL còn nằm local.** Bản wave 10 chỉ chuyển
 * `severity/family/sorting/searchTermStats/pageStats/statsSort*`, còn
 * `lane/appliedSymbol/sessionDate/timeframe` vẫn `useState` và được **đọc URL
 * bằng tay** ở `AlertCenterPage.tsx` (effect mount `new URLSearchParams(window.
 * location.search)` + effect ghi `window.history.replaceState`).
 *
 * Hai effect đó là **chủ sở hữu URL thứ hai**: nó bypass React Router nên
 * `useSearchParams` không bao giờ thấy thay đổi của chính nó. Xoá chúng (đúng
 * NAV-1) mà không chuyển 4 trường này sang đây ⇒ **mất deep-link** `?lane=ai
 * &symbol=VIC`. Vì vậy 4 trường nằm chung một `useUrlState`.
 *
 * ⚠ **`symbolDraft` van giu o local** (AC-4): no la O DANG SOAN, dong bo no se
 * day 1 history entry cho MOI KY TU va gay `useEffect` loop. Chi `appliedSymbol`
 * (sau `applySymbol`) moi la trang thai da ap dung.
 *
 * ⚠ **Ten tham so URL giong het** `AlertCenterPage.tsx` cu (effect da xoa):
 * `lane` · `symbol` · `severity` · `family` · `timeframe` · `session_date`.
 * Deep-link cu gan nhat mot moi giong het truoc.
 */
type AlertUrlState = {
  lane: Lane;
  symbol: string;
  severity: string[];
  family: string[];
  timeframe: Timeframe;
  sessionDate: string;
  sorting: AlertSorting;
  searchTermStats: string;
  pageStats: number;
  statsSortKey: StatsSortKey;
  statsSortDir: StatsSortDir;
};

const DEFAULT_SORT: { key: StatsSortKey; dir: StatsSortDir } = { key: "count", dir: "desc" };

/**
 * ⚠ **`session_date` — KHOA URL PHAI giữ nguyen ten `session_date`, KHONG doi
 * thanh `sessionDate`.** `FilterBar` + effect cu ghi `session_date`; doi ten thi
 * link da chia se cu khong con doc duoc.
 */
type AlertUrlSpec = { [K in keyof AlertUrlState]: UrlStateCodec<AlertUrlState[K]> };

const SESSION_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Danh sach phan tach bang dau phay. Mang rong ⇒ `undefined` ⇒ xoa khoi URL. */
const listCodec: UrlStateCodec<string[]> = {
  parse: (raw) =>
    raw == null || raw === ""
      ? undefined
      : raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  serialize: (v) => (v.length ? v.join(",") : undefined),
};

/**
 * Trang 1 la MAC DINH ⇒ `serialize` tra `undefined` cho 1 ⇒ `?pageStats=1` khong
 * duoc ghi. `parse` chan `?pageStats=0` / `?pageStats=-2` (URL do nguoi sua tay).
 */
const pageStatsCodec: UrlStateCodec<number> = {
  parse: (raw) => {
    const n = intCodec.parse(raw);
    return n === undefined || n < 1 ? undefined : n;
  },
  serialize: (v) => (v === 1 ? undefined : intCodec.serialize(v)),
};

/** Union 2/3 gia tri: `?lane=xyz` bi bo qua, khong render ban sai. */
function unionCodec<T extends string>(all: readonly T[], def: T): UrlStateCodec<T> {
  return {
    parse: (raw) => (all as readonly string[]).includes(raw ?? "") ? (raw as T) : undefined,
    serialize: (v) => (v === def ? undefined : v),
  };
}

/**
 * Ma o chieu chuan hoa. `normalizeSymbol` cua `AlertCenterPage.tsx:86-88` la
 * `String(v||"").trim().toUpperCase()` ⇒ giu dung quy tac do, va CHAN rong
 * (chuoi rong ⇒ `undefined` ⇒ xoa tham so).
 */
const symbolCodec: UrlStateCodec<string> = {
  parse: (raw) => {
    const v = (raw || "").trim().toUpperCase();
    return v === "" ? undefined : v;
  },
  serialize: (v) => {
    const s = (v || "").trim().toUpperCase();
    return s === "" ? undefined : s;
  },
};

/** `?session_date=abc` (nguoi sua tay) ⇒ bo qua, khong gui len BE. */
const sessionDateCodec: UrlStateCodec<string> = {
  parse: (raw) => (raw && SESSION_DATE_RE.test(raw) ? raw : undefined),
  serialize: (v) => (v && SESSION_DATE_RE.test(v) ? v : undefined),
};

const LANES = ["main", "ai"] as const satisfies readonly Lane[];
const TIMEFRAMES = ["5m", "15m", "1h", "session", "5d"] as const satisfies readonly Timeframe[];
const STATS_SORT_KEYS: readonly StatsSortKey[] = ["count", "value", "time"];
const STATS_SORT_DIRS: readonly StatsSortDir[] = ["asc", "desc"];

const ALERT_URL_SPEC: AlertUrlSpec = {
  lane: unionCodec<Lane>(LANES, "main"),
  symbol: symbolCodec,
  severity: listCodec,
  family: listCodec,
  timeframe: unionCodec<Timeframe>(TIMEFRAMES, "session"),
  sessionDate: sessionDateCodec,
  sorting: boolCodec<AlertSorting>("latest", "largestValue"),
  searchTermStats: { parse: (raw) => (raw == null || raw === "" ? undefined : raw), serialize: (v) => (v === "" ? undefined : v) },
  pageStats: pageStatsCodec,
  statsSortKey: unionCodec(STATS_SORT_KEYS, DEFAULT_SORT.key),
  statsSortDir: unionCodec(STATS_SORT_DIRS, DEFAULT_SORT.dir),
};

const ALERT_URL_DEFAULTS: AlertUrlState = {
  lane: "main",
  symbol: "",
  severity: [],
  family: [],
  timeframe: "session",
  sessionDate: "",
  sorting: "latest",
  searchTermStats: "",
  pageStats: 1,
  statsSortKey: DEFAULT_SORT.key,
  statsSortDir: DEFAULT_SORT.dir,
};

/**
 * ⚠⚠ **BAT BUOC o CAP MODULE — khong duoc truyen object literal trong render.**
 *
 * `keyMap` duoc `useUrlState` bo vao `useCallback([keyMap])` de tinh ten tham so.
 * Truyen literal ⇒ moi render lai doi identity ⇒ `useMemo` tinh `value` lai ⇒
 * `severityFilter` / `familyFilter` la **MANG MOI** moi render ⇒ effect
 * `[...filters.severityFilter, filters.familyFilter]` cua `AlertCenterPage.tsx`
 * chay lai vo han ⇒ **treo test**. Da gap that 2026-10-10 (treo >600s).
 * Cung ly do voi `ALERT_URL_SPEC`/`ALERT_URL_DEFAULTS` o tren.
 */
const ALERT_URL_KEYMAP = { sessionDate: "session_date" } as const;

export function useAlertCenterFilters() {
  // VAN O LOCAL (AC-4): o dang soan, khong bao gio vao URL.
  const [symbolDraft, setSymbolDraft] = useState("");

  const [url, setUrlFilters] = useUrlState<AlertUrlState>(
    ALERT_URL_SPEC,
    ALERT_URL_DEFAULTS,
    {},
    // ⚠ `sessionDate` (camelCase) ↔ `?session_date` (snake_case): giữ nguyên tên
    // tham số cũ để link đã chia sẻ không chết. Xem `useUrlState.ts` (`keyMap`).
    ALERT_URL_KEYMAP,
  );

  /**
   * ⚠⚠ **WAVE 11 — bat buoc: MOI thay doi ghi TOAN BO trang thai.**
   *
   * Do 2026-10-10 tren `react-router-dom@6.30.3`: 2 `setParams` trong cung mot
   * tick KHONG compose — `setParams(a=1)` roi `setParams(b=2)` cho `?b=2`.
   *
   * `AlertCenterPage.tsx` goi nhieu setter lien tiep trong mot handler (vi du
   * `:574` `setLane` + `resetStatsPage` + `setSessionDate`, `:582` `setSession-
   * Date` + `setTimeframe` + `resetStatsPage`). Neu moi setter chi ghi key cua
   * no, 2 trong 3 len goi se bi ghi de.
   *
   * ⇒ `stateRef` lai trang thai URL **va cap nhat ngay trong setter** (optimistic
   * ref). `write` ghep patch vao `stateRef` roi gui **toan bo** trang thai, nen
   * lan goi sau van mang ca thay doi cua lan truoc trong cung tick. Moi render
   * lai `stateRef.current = url` ⇒ nut Back / deep-link van la nguon su that.
   */
  const stateRef = useRef<AlertUrlState>(ALERT_URL_DEFAULTS);
  stateRef.current = url;

  const write = useCallback((patch: Partial<AlertUrlState>, replace = false) => {
    const next = { ...stateRef.current, ...patch };
    stateRef.current = next;
    setUrlFilters(next, { replace });
  }, [setUrlFilters]);

  // Giu TEN field cu cho `AlertCenterPage` (khong doi API public cua hook).
  const {
    lane, symbol: appliedSymbol, severity: severityFilter, family: familyFilter,
    timeframe, sessionDate, sorting, searchTermStats, pageStats,
    statsSortKey, statsSortDir,
  } = url;
  const symbolDraftValue = symbolDraft;

  /**
   * ⚠ **WAVE 11 — `symbolDraft` van phai HIEN thi gia tri deep-link.**
   *
   * Effect mount cu cua `AlertCenterPage` set ca `symbolDraft` **va**
   * `appliedSymbol` tu `?symbol=VIC`. Bo effect do thi `appliedSymbol=VIC` (bo
   * loc co that) nhung o nhap lai TRONG — nguoi dung thay minh co loc ma khong
   * thay dau gi.
   *
   * AC-4 van dung: chi COPY `URL -> o`, khong bao gio ghi nguoc. Va chi chay khi
   * `appliedSymbol` **doi** ⇒ goo tay vao o khong bi ghi de (dep `[appliedSymbol]`
   * ⇒ go "HPG" khong doi `appliedSymbol` ⇒ effect khong chay).
   */
  useEffect(() => {
    setSymbolDraft(appliedSymbol);
  }, [appliedSymbol]);
  const statsSort = useMemo(
    () => ({ key: statsSortKey, dir: statsSortDir }),
    [statsSortKey, statsSortDir],
  );

  const setLane = useCallback((val: string) => {
    write({ lane: (LANES as readonly string[]).includes(val) ? (val as Lane) : "main" });
  }, [write]);

  const setAppliedSymbol = useCallback((val: string) => {
    write({ symbol: val });
  }, [write]);

  const setTimeframe = useCallback((val: string) => {
    write({ timeframe: (TIMEFRAMES as readonly string[]).includes(val) ? (val as Timeframe) : "session" });
  }, [write]);

  const setSessionDate = useCallback((val: string) => {
    write({ sessionDate: val });
  }, [write]);

  const setSeverityFilter = useCallback((next: string[]) => {
    write({ severity: next, pageStats: 1 });
  }, [write]);

  const setFamilyFilter = useCallback((next: string[]) => {
    write({ family: next, pageStats: 1 });
  }, [write]);

  const setSorting = useCallback((next: AlertSorting) => {
    write({ sorting: next });
  }, [write]);

  /**
   * O tim kiem bat `onChange` truc tiep (`AlertCenterPage.tsx:750`) ⇒ `replace`.
   * Neu `push`, moi ky tu tao 1 history entry ⇒ nguoi dung phai bam Back hang
   * chuc lan moi ra khoi trang (`useUrlState.ts:27-36`).
   */
  const setSearchTermStats = useCallback((v: string) => {
    write({ searchTermStats: v }, true);
  }, [write]);

  const setPageStats = useCallback((v: number) => {
    write({ pageStats: v });
  }, [write]);

  const resetStatsPage = useCallback(() => write({ pageStats: 1 }), [write]);

  const cycleStatsSort = useCallback((key: StatsSortKey) => {
    const cur = stateRef.current;
    const dir: StatsSortDir = cur.statsSortKey === key
      ? (cur.statsSortDir === "desc" ? "asc" : "desc")
      : "desc";
    write({ statsSortKey: key, statsSortDir: dir, pageStats: 1 });
  }, [write]);

  // Doc `stateRef.current` (KHONG doc `severityFilter` tu closure): 2 toggle
  // trong cung mot tick phai thay tren cung gia tri da cap nhat.
  const toggleSeverity = useCallback((val: string) => {
    const cur = stateRef.current.severity;
    write({
      severity: cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val],
      pageStats: 1,
    });
  }, [write]);

  const toggleFamily = useCallback((val: string) => {
    const cur = stateRef.current.family;
    write({
      family: cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val],
      pageStats: 1,
    });
  }, [write]);

  const clearFilters = useCallback(() => {
    write({ severity: [], family: [], pageStats: 1 });
  }, [write]);

  const applySymbol = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    write({ symbol: symbolDraftValue, pageStats: 1 });
  }, [symbolDraftValue, write]);

  return {
    lane, setLane, symbolDraft: symbolDraftValue, setSymbolDraft, appliedSymbol,
    sessionDate, timeframe, setTimeframe,
    severityFilter, setSeverityFilter, familyFilter, setFamilyFilter,
    sorting, setSorting,
    searchTermStats, setSearchTermStats,
    pageStats, setPageStats, resetStatsPage,
    statsSort, cycleStatsSort,
    toggleSeverity, toggleFamily, clearFilters, applySymbol,
    setAppliedSymbol, setSessionDate,
  };
}
