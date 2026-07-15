import { useCallback, useEffect, useState } from "react";
import { defaultCoreApiAdapter } from "../adapters/coreApiAdapter.js";

export interface SymbolGroup {
  slug: string;
  group_id: string;
  name: string;
  symbol_count: number | null;
  category?: string;
  group_code?: string;
  source_provider?: string;
  synced_at?: string;
  type: "index" | "exchange" | "etf" | "other" | "custom";
  is_active: boolean;
  is_predefined: boolean;
}

interface SymbolGroupsResponse {
  predefined: SymbolGroup[];
  custom: SymbolGroup[];
}

const adapter = defaultCoreApiAdapter as unknown as {
  getSocSymbolGroups: () => Promise<SymbolGroupsResponse>;
  syncSocSymbolGroups?: (payload?: { source?: string }) => Promise<{
    synced: number;
    deactivated: number;
    source: string;
  }>;
};

export function useSymbolGroups() {
  const [predefined, setPredefined] = useState<SymbolGroup[]>([]);
  const [custom, setCustom] = useState<SymbolGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adapter.getSocSymbolGroups();
      setPredefined(data.predefined || []);
      setCustom(data.custom || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load groups");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sync = useCallback(
    async (source?: string) => {
      if (!adapter.syncSocSymbolGroups) return;
      await adapter.syncSocSymbolGroups(source ? { source } : undefined);
      await load();
    },
    [load],
  );

  return {
    predefined,
    custom,
    allGroups: [...predefined, ...custom],
    loading,
    error,
    sync,
    reload: load,
  };
}
