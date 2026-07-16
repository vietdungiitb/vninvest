import { createElement, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { statusColor, getStatusBadgeStyle } from "./socStatusColors.js";
import styles from "./soc.module.css";

interface MatrixCycle {
  cycle_id: string;
  status: string;
  started_at: string;
  progress: number;
  total_cells: number;
  completed_cells: number;
  [key: string]: unknown;
}

interface MatrixProvider {
  key: string;
  name: string;
  status: string;
  [key: string]: unknown;
}

interface ScrapeMonitorCache {
  cycles: MatrixCycle[];
  providers: MatrixProvider[];
  lastFetched?: number;
}

const monitorCache: ScrapeMonitorCache = {
  cycles: [],
  providers: [],
};

export function SocMatrixScrapeMonitor() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(!monitorCache.lastFetched);
  const [error, setError] = useState("");
  const [cycles, setCycles] = useState<MatrixCycle[]>(monitorCache.cycles);
  const [providers, setProviders] = useState<MatrixProvider[]>(monitorCache.providers);

  const fetchData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        getSocMatrixMonitor: (cycleId?: string) => Promise<{ cycles?: MatrixCycle[] }>;
        getSocMatrixProviders: () => Promise<{ providers?: MatrixProvider[] }>;
      };
      const [monitor, prov] = await Promise.all([
        adapter.getSocMatrixMonitor(),
        adapter.getSocMatrixProviders(),
      ]);
      const nextCycles = monitor.cycles || [];
      const nextProviders = prov.providers || [];
      setCycles(nextCycles);
      setProviders(nextProviders);
      monitorCache.cycles = nextCycles;
      monitorCache.providers = nextProviders;
      monitorCache.lastFetched = Date.now();
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load matrix monitor data.");
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    const hasCache = !!monitorCache.lastFetched;
    fetchData(hasCache);
    const interval = setInterval(() => fetchData(true), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAbort = async (cycleId: string) => {
    if (!window.confirm(t("soc.matrix.abort_confirm"))) return;
    try {
      const adapter = defaultCoreApiAdapter as unknown as { abortSocMatrixCycle: (id: string) => Promise<void> };
      await adapter.abortSocMatrixCycle(cycleId);
      await fetchData();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Abort failed."}`);
    }
  };

  const handleStartCycle = async () => {
    try {
      const adapter = defaultCoreApiAdapter as unknown as { startSocMatrixCycle: (payload: Record<string, unknown>) => Promise<void> };
      await adapter.startSocMatrixCycle({});
      alert(t("soc.matrix.cycle_started"));
      await fetchData();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Start failed."}`);
    }
  };

  const getStatusColor = (status: string): string => statusColor(status);

  return createElement(
    "div",
    { className: styles.glassPanel },
    createElement(
      "div",
      { },
      createElement("h3", { }, t("soc.matrix.title")),
      createElement(
        "button",
        {
          onClick: handleStartCycle,
          className: `styles.actionBtn`,
          
        },
        t("soc.matrix.start_cycle"),
      ),
    ),
    loading
      ? createElement("p", { className: styles.emptyState }, t("soc.matrix.loading"))
      : error
        ? createElement("div", { className: styles.inlineError }, error)
        : createElement(
            "div",
            { },
            createElement(
              "div",
              { className: styles.sectionCard },
              createElement("div", { className: styles.sectionCardTitle }, t("soc.matrix.recent_cycles")),
              cycles.length === 0
                ? createElement("p", { className: styles.emptyState }, t("soc.matrix.no_cycles"))
                : createElement(
                    "div",
                    { },
                    cycles.slice(0, 10).map((cycle) =>
                      createElement(
                        "div",
                        {
                          key: cycle.cycle_id,
                          },
                        createElement(
                          "div",
                          { },
                          createElement("div", { },
                            `Cycle: ${cycle.cycle_id.slice(0, 8)}...`,
                          ),
                          createElement("div", { },
                            `${cycle.completed_cells || 0}/${cycle.total_cells || 0} cells \u2022 ${cycle.started_at?.split("T")[0] || "N/A"}`,
                          ),
                          cycle.progress != null
                            ? createElement(
                                "div",
                                { },
                                createElement("div", {
                                  style: {
                                    height: "100%",
                                    width: `${cycle.progress}%`,
                                    borderRadius: "2px",
                                    background: getStatusColor(cycle.status),
                                    transition: "width 0.3s ease",
                                  },
                                }),
                              )
                            : null,
                        ),
                        createElement(
                          "span",
                          {
                          className: styles.statusBadge,
                          style: { ...getStatusBadgeStyle(cycle.status) },
                          },
                          cycle.status,
                        ),
                        cycle.status === "running"
                          ? createElement(
                              "button",
                              {
                                onClick: () => handleAbort(cycle.cycle_id),
                                className: `styles.actionBtn`,
                                
                              },
                              t("soc.matrix.abort"),
                            )
                          : null,
                      ),
                    ),
                  ),
            ),
            providers.length > 0
              ? createElement(
                  "div",
                  { className: styles.sectionCard },
                  createElement("div", { className: styles.sectionCardTitle }, t("soc.matrix.providers")),
                  createElement(
                    "div",
                    { },
                    providers.map((p) =>
                      createElement(
                        "span",
                        {
                          key: p.key,
                           className: styles.statusBadge,
                           style: {
                             ...getStatusBadgeStyle(p.status),
                           },
                        },
                        `${p.name} (${p.status})`,
                      ),
                    ),
                  ),
                )
              : null,
          ),
  );
}
