import { useState, useCallback } from "react";

export function useAlertCenterFilters() {
  const [lane, setLane] = useState("main");
  const [symbolDraft, setSymbolDraft] = useState("");
  const [appliedSymbol, setAppliedSymbol] = useState("");
  const [sessionDate] = useState("");
  const [timeframe, setTimeframe] = useState("session");
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [familyFilter, setFamilyFilter] = useState<string[]>([]);
  const [sorting, setSorting] = useState<"latest" | "largestValue">("latest");
  const [searchTermStats, setSearchTermStats] = useState("");
  const [pageStats, setPageStats] = useState(1);

  const toggleSeverity = useCallback((val: string) => {
    setSeverityFilter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  }, []);
  const toggleFamily = useCallback((val: string) => {
    setFamilyFilter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  }, []);
  const clearFilters = useCallback(() => {
    setSeverityFilter([]);
    setFamilyFilter([]);
  }, []);
  const applySymbol = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSymbol(symbolDraft.trim().toUpperCase());
  }, [symbolDraft]);

  return {
    lane, setLane, symbolDraft, setSymbolDraft, appliedSymbol,
    sessionDate, timeframe, setTimeframe,
    severityFilter, familyFilter, sorting, setSorting,
    searchTermStats, setSearchTermStats,
    pageStats, setPageStats,
    toggleSeverity, toggleFamily, clearFilters, applySymbol,
  };
}
