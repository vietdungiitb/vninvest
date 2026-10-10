import { useState, useCallback, useMemo } from "react";
import {
  useUrlState, intCodec, stringCodec, boolCodec,
  type UrlStateCodec, type UrlStateOptions,
} from "./useUrlState";

type AlertSorting = "latest" | "largestValue";
type StatsSortKey = "count" | "value" | "time";
type StatsSortDir = "asc" | "desc";

/**
 * WAVE 10 / NAV-1 — 6 bo loc/sap xep/phan trang cua trang Alert Center nam trong
 * RAM nen link gui cho nguoi khoc thi ho thay man hinh CHUA loc, va F5 la mat
 * toan bo. Chuyen sang `useUrlState` (patch) de MOT lan bam = MOT history entry.
 *
 * ⚠ **`symbolDraft` van giu o local** (AC-4): no la O DANG SOAN, dong bo no se
 * day 1 history entry cho MOI KY TU va gay `useEffect` loop. Chi `appliedSymbol`
 * (sau `applySymbol`) moi la trang thai da ap dung.
 *
 * ⚠ **`severity` / `family` dung TEN TRUNG voi `AlertCenterPage.tsx:126-127`**
 * de deep-link cu `?severity=high` giong het sau khi sua trang do.
 */
type AlertUrlState = {
  severity: string[];
  family: string[];
  sorting: AlertSorting;
  searchTermStats: string;
  pageStats: number;
  statsSortKey: StatsSortKey;
  statsSortDir: StatsSortDir;
};

const DEFAULT_SORT: { key: StatsSortKey; dir: StatsSortDir } = { key: "count", dir: "desc" };

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

const STATS_SORT_KEYS: readonly StatsSortKey[] = ["count", "value", "time"];
const STATS_SORT_DIRS: readonly StatsSortDir[] = ["asc", "desc"];

/** Union 2/3 gia tri: `?statsSortKey=xyz` bi bo qua, khong render ban sai. */
function unionCodec<T extends string>(all: readonly T[], def: T): UrlStateCodec<T> {
  return {
    parse: (raw) => (all as readonly string[]).includes(raw ?? "") ? (raw as T) : undefined,
    serialize: (v) => (v === def ? undefined : v),
  };
}

const ALERT_URL_SPEC: { [K in keyof AlertUrlState]: UrlStateCodec<AlertUrlState[K]> } = {
  severity: listCodec,
  family: listCodec,
  sorting: boolCodec<AlertSorting>("latest", "largestValue"),
  searchTermStats: stringCodec,
  pageStats: pageStatsCodec,
  statsSortKey: unionCodec(STATS_SORT_KEYS, DEFAULT_SORT.key),
  statsSortDir: unionCodec(STATS_SORT_DIRS, DEFAULT_SORT.dir),
};

const ALERT_URL_DEFAULTS: AlertUrlState = {
  severity: [],
  family: [],
  sorting: "latest",
  searchTermStats: "",
  pageStats: 1,
  statsSortKey: DEFAULT_SORT.key,
  statsSortDir: DEFAULT_SORT.dir,
};

// ⚠ `options` o CAP MODULE. `useUrlState` memo hoa `setValue` theo `replaceKeys`
// (`useUrlState.ts:187`) ⇒ literal trong render ⇒ moi `useCallback` booc no doi
// identity moi render. `searchTermStats` la o nhap van ban (AlertCenterPage:750)
// ⇒ `replace`, neu khong moi ky tu la 1 history entry.
const ALERT_URL_OPTIONS: UrlStateOptions = { replaceKeys: ["searchTermStats"] };

export function useAlertCenterFilters() {
  // VAN O LOCAL (AC-4): o dang soan, khong bao gio vao URL.
  const [lane, setLane] = useState("main");
  const [symbolDraft, setSymbolDraft] = useState("");
  const [appliedSymbol, setAppliedSymbol] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [timeframe, setTimeframe] = useState("session");

  const [{ severity, family, sorting, searchTermStats, pageStats, statsSortKey, statsSortDir }, setUrlFilters] =
    useUrlState(ALERT_URL_SPEC, ALERT_URL_DEFAULTS, ALERT_URL_OPTIONS);

  // Giu TEN field cu cho `AlertCenterPage` (khong doi API public cua hook).
  const severityFilter = severity;
  const familyFilter = family;
  const statsSort = useMemo(
    () => ({ key: statsSortKey, dir: statsSortDir }),
    [statsSortKey, statsSortDir],
  );

  // ⚠ MOT patch cho MOI thay doi ghep "gia tri" + "ve trang 1". Goi 2 lan
  // `setUrlFilters` trong cung mot tick KHONG compose — lan hai doc `prev` cu va
  // ghi de ket qua lan mot (`useUrlState.ts:161-165`). `AlertCenterPage.tsx:494`
  // va `:504-508` dang goi `setSeverityFilter(...)` roi `resetStatsPage()` —
  // ghep vao day thi ca hai van dung ke ca khi caller chua doi.
  const setSeverityFilter = useCallback(
    (next: string[]) => setUrlFilters({ severity: next, pageStats: 1 }),
    [setUrlFilters],
  );
  const setFamilyFilter = useCallback(
    (next: string[]) => setUrlFilters({ family: next, pageStats: 1 }),
    [setUrlFilters],
  );
  const setSorting = useCallback(
    (next: AlertSorting) => setUrlFilters({ sorting: next }),
    [setUrlFilters],
  );
  const setSearchTermStats = useCallback(
    (v: string) => setUrlFilters({ searchTermStats: v }),
    [setUrlFilters],
  );
  const setPageStats = useCallback(
    (v: number) => setUrlFilters({ pageStats: v }),
    [setUrlFilters],
  );

  const resetStatsPage = useCallback(() => setUrlFilters({ pageStats: 1 }), [setUrlFilters]);

  const cycleStatsSort = useCallback((key: StatsSortKey) => {
    const dir: StatsSortDir = statsSortKey === key ? (statsSortDir === "desc" ? "asc" : "desc") : "desc";
    setUrlFilters({ statsSortKey: key, statsSortDir: dir, pageStats: 1 });
  }, [setUrlFilters, statsSortKey, statsSortDir]);

  // ⚠ Tinh `next` tu `severityFilter` hien tai, KHONG dung updater lambda cua
  // `useState`. Hai lan go trong CUNG mot tick se doc cung gia tri cu ⇒ lan hai
  // ghi de lan mot. `AlertCenterPage.tsx:108` goi `toggleSeverity` trong vong
  // `for` ⇒ `?severity=a,b` se ra `[b]` thay vi `[a,b]` — sua o trang do.
  const toggleSeverity = useCallback((val: string) => {
    const next = severityFilter.includes(val)
      ? severityFilter.filter((v) => v !== val)
      : [...severityFilter, val];
    setUrlFilters({ severity: next, pageStats: 1 });
  }, [setUrlFilters, severityFilter]);

  const toggleFamily = useCallback((val: string) => {
    const next = familyFilter.includes(val)
      ? familyFilter.filter((v) => v !== val)
      : [...familyFilter, val];
    setUrlFilters({ family: next, pageStats: 1 });
  }, [setUrlFilters, familyFilter]);

  const clearFilters = useCallback(() => {
    setUrlFilters({ severity: [], family: [], pageStats: 1 });
  }, [setUrlFilters]);

  const applySymbol = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSymbol(symbolDraft.trim().toUpperCase());
    setUrlFilters({ pageStats: 1 });
  }, [symbolDraft, setUrlFilters]);

  return {
    lane, setLane, symbolDraft, setSymbolDraft, appliedSymbol,
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
