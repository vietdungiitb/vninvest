import { useState, useCallback } from "react";

export function useAlertCenterFilters() {
  const [lane, setLane] = useState("main");
  const [symbolDraft, setSymbolDraft] = useState("");
  const [appliedSymbol, setAppliedSymbol] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [timeframe, setTimeframe] = useState("session");
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [familyFilter, setFamilyFilter] = useState<string[]>([]);
  const [sorting, setSorting] = useState<"latest" | "largestValue">("latest");
  const [searchTermStats, setSearchTermStats] = useState("");
  const [pageStats, setPageStats] = useState(1);
  const [statsSort, setStatsSortState] = useState<{ key: "count" | "value" | "time"; dir: "asc" | "desc" }>({
    key: "count",
    dir: "desc",
  });

  const resetStatsPage = useCallback(() => setPageStats(1), []);
  const cycleStatsSort = useCallback((key: "count" | "value" | "time") => {
    setStatsSortState((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" },
    );
    setPageStats(1);
  }, []);
  const toggleSeverity = useCallback((val: string) => {
    setSeverityFilter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
    setPageStats(1);
  }, []);
  const toggleFamily = useCallback((val: string) => {
    setFamilyFilter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
    setPageStats(1);
  }, []);
  const clearFilters = useCallback(() => {
    setSeverityFilter([]);
    setFamilyFilter([]);
    setPageStats(1);
  }, []);
  const applySymbol = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSymbol(symbolDraft.trim().toUpperCase());
    setPageStats(1);
  }, [symbolDraft]);

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
