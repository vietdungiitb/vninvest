import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";

interface BackfillRun {
  run_id: string;
  status: string;
  dataset: string;
  progress: number;
  started_at: string;
  [key: string]: unknown;
}

interface InventoryData {
  summary: {
    total_rows: number;
    total_symbols: number;
    earliest_date: string | null;
    latest_date: string | null;
    calendar_days: number;
  };
  by_year: { year: string; rows: number; symbols: number }[];
  by_group: {
    id: string; name: string; type: string;
    symbol_count: number; covered_symbols: number; recent_symbols: number;
    total_rows: number; earliest_date: string | null; latest_date: string | null;
    calendar_days: number;
  }[];
  data_types: {
    name: string; label: string;
    total_rows: number; symbols: number;
    earliest_date: string | null; latest_date: string | null;
  }[];
  [key: string]: unknown;
}

interface CoverageData {
  [key: string]: unknown;
}



interface DataOpsState {
  activeSubTab: string;
  runs: BackfillRun[];
  inventory: InventoryData | null;
  coverage: CoverageData | null;
  loading: Record<string, boolean>;
  error: string | null;
}

interface DataOpsActions {
  setActiveSubTab: (tab: string) => void;
  refreshInventory: () => Promise<void>;
  refreshRuns: () => Promise<void>;
  refreshCoverage: () => Promise<void>;
  triggerBackfill: (payload: Record<string, unknown>) => Promise<string>;
  abortRun: (runId: string) => Promise<void>;
}

interface DataOpsContextValue {
  state: DataOpsState;
  actions: DataOpsActions;
}

const DataOpsContext = createContext<DataOpsContextValue | null>(null);

const adapter = defaultCoreApiAdapter as unknown as {
  getSocDataOpsInventory: () => Promise<InventoryData>;
  getSocBackfillRuns: (params?: { status?: string; limit?: number }) => Promise<{ runs?: BackfillRun[] }>;
  getSocDataOpsCoverage: () => Promise<CoverageData>;
  runSocDataOpsPlanner: (payload: Record<string, unknown>) => Promise<{ run_id?: string }>;
  abortSocDataOpsPlannerRun: (runId: string) => Promise<void>;
};

export function DataOpsProvider({ children }: { children: React.ReactNode }) {
  const [activeSubTab, setActiveSubTab] = useState("inventory");
  const [runs, setRuns] = useState<BackfillRun[]>([]);
  const [inventory, setInventory] = useState<InventoryData | null>(null);
  const [coverage, setCoverage] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({ inventory: true, runs: true, coverage: true });
  const [contextError, setContextError] = useState<string | null>(null);

  const refreshInventory = useCallback(async () => {
    setLoading((prev) => ({ ...prev, inventory: true }));
    setContextError(null);
    try {
      const data = await adapter.getSocDataOpsInventory();
      setInventory(data);
    } catch (err: unknown) {
      setContextError(err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : 'Không thể tải dữ liệu DataOps Inventory.');
    }
    finally {
      setLoading((prev) => ({ ...prev, inventory: false }));
    }
  }, []);

  const refreshRuns = useCallback(async () => {
    setLoading((prev) => ({ ...prev, runs: true }));
    setContextError(null);
    try {
      const data = await adapter.getSocBackfillRuns({ limit: 20 });
      setRuns(data.runs || []);
    } catch (err: unknown) {
      setContextError(err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : 'Không thể tải backfill runs.');
    }
    finally {
      setLoading((prev) => ({ ...prev, runs: false }));
    }
  }, []);

  const refreshCoverage = useCallback(async () => {
    setLoading((prev) => ({ ...prev, coverage: true }));
    setContextError(null);
    try {
      const data = await adapter.getSocDataOpsCoverage();
      setCoverage(data);
    } catch (err: unknown) {
      setContextError(err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : 'Không thể tải coverage.');
    }
    finally {
      setLoading((prev) => ({ ...prev, coverage: false }));
    }
  }, []);

  const triggerBackfill = useCallback(async (payload: Record<string, unknown>): Promise<string> => {
    const result = await adapter.runSocDataOpsPlanner(payload);
    await refreshRuns();
    return result.run_id || "";
  }, [refreshRuns]);

  const abortRun = useCallback(async (runId: string): Promise<void> => {
    await adapter.abortSocDataOpsPlannerRun(runId);
    await refreshRuns();
  }, [refreshRuns]);

  useEffect(() => {
    refreshInventory();
    refreshRuns();
    refreshCoverage();
  }, [refreshInventory, refreshRuns, refreshCoverage]);

  const actions = useMemo<DataOpsActions>(() => ({
    setActiveSubTab,
    refreshInventory,
    refreshRuns,
    refreshCoverage,
    triggerBackfill,
    abortRun
  }), [setActiveSubTab, refreshInventory, refreshRuns, refreshCoverage, triggerBackfill, abortRun]);

  const value = useMemo<DataOpsContextValue>(() => ({
    state: { activeSubTab, runs, inventory, coverage, loading, error: contextError },
    actions,
  }), [activeSubTab, runs, inventory, coverage, loading, contextError, actions]);

  return createElement(DataOpsContext.Provider, { value }, children);
}

export function useDataOps(): DataOpsContextValue {
  const context = useContext(DataOpsContext);
  if (!context) {
    throw new Error("useDataOps must be used within a DataOpsProvider");
  }
  return context;
}
