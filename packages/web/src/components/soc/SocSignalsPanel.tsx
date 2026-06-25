import { createElement, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { ShellPanel } from "../../components/ShellPageTemplate.js";
import { SocWriteGuardBanner } from "./SocWriteGuardBanner.js";
import { SocOwnershipBadge } from "./SocOwnershipBadge.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import styles from "./soc.module.css";

interface SignalConfig {
  [key: string]: unknown;
}

interface WhaleDetection {
  min_volume?: number;
  enabled?: boolean;
  [key: string]: unknown;
}

interface DarkPoolDetection {
  min_signal_count?: number;
  enabled?: boolean;
  [key: string]: unknown;
}

interface SignalMetrics {
  detection_rate?: number;
  false_positive?: number;
  avg_latency?: number;
  [key: string]: unknown;
}

interface SignalOwnership {
  owner?: string;
  writable?: boolean;
  team?: string;
  [key: string]: unknown;
}

export function SocSignalsPanel() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signalConfig, setSignalConfig] = useState<SignalConfig | null>(null);
  const [whaleDetection, setWhaleDetection] = useState<WhaleDetection | null>(null);
  const [darkPoolDetection, setDarkPoolDetection] = useState<DarkPoolDetection | null>(null);
  const [signalMetrics, setSignalMetrics] = useState<SignalMetrics | null>(null);
  const [signalOwnership, setSignalOwnership] = useState<SignalOwnership | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        getSocSignalConfig: () => Promise<SignalConfig>;
        getSocWhaleDetection: () => Promise<WhaleDetection>;
        getSocDarkPoolDetection: () => Promise<DarkPoolDetection>;
        getSocSignalMetrics: () => Promise<SignalMetrics>;
        getSocSignalOwnership: () => Promise<SignalOwnership>;
      };

      const [config, whale, darkPool, metrics, ownership] = await Promise.all([
        adapter.getSocSignalConfig(),
        adapter.getSocWhaleDetection(),
        adapter.getSocDarkPoolDetection(),
        adapter.getSocSignalMetrics(),
        adapter.getSocSignalOwnership(),
      ]);

      setSignalConfig(config);
      setWhaleDetection(whale);
      setDarkPoolDetection(darkPool);
      setSignalMetrics(metrics);
      setSignalOwnership(ownership);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load signal data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const renderJsonBlock = (data: Record<string, unknown> | null, title: string) => {
    return createElement(
      "div",
      { className: styles.sectionCard },
      createElement("div", { className: styles.sectionCardTitle }, title),
      createElement("pre", { className: styles.jsonBlock }, JSON.stringify(data || {}, null, 2)),
    );
  };

  const renderMetricCard = (label: string, value: string | number, color?: string) => {
    return createElement(
      "div",
      { className: styles.metricCard },
      createElement("div", { className: styles.metricLabel }, label),
      createElement("div", { className: styles.metricValue, style: { color: color || "var(--text-primary)" } }, value),
    );
  };

  return createElement(
    "div",
    { className: styles.glassPanel },
    createElement(SocWriteGuardBanner, {
      owner: "signals-team",
      writer: "signals-team",
      surface: "signals",
    }),
    createElement(
      ShellPanel,
      {
        title: t("soc.signals.title"),
        subtitle: t("soc.signals.subtitle"),
      },
      loading
        ? createElement("p", { className: styles.emptyState }, t("soc.signals.loading"))
        : error
          ? createElement("div", { className: styles.inlineError }, error)
          : createElement(
              "div",
              null,
              createElement("div", { className: styles.sectionGrid },
                renderJsonBlock(signalConfig, t("soc.signals.config_title")),
                renderJsonBlock(whaleDetection, t("soc.signals.whale_detection_title")),
                renderJsonBlock(darkPoolDetection, t("soc.signals.dark_pool_detection_title")),
              ),
              createElement("div", { className: styles.metricGrid, style: { marginTop: "1.25rem" } },
                renderMetricCard(t("soc.signals.detection_rate"), `${signalMetrics?.detection_rate ?? 0}%`, "#34d399"),
                renderMetricCard(t("soc.signals.false_positive"), `${signalMetrics?.false_positive ?? 0}%`, "#fbbf24"),
                renderMetricCard(t("soc.signals.avg_latency"), `${signalMetrics?.avg_latency ?? 0}ms`, "var(--accent-cyan)"),
              ),
              createElement("div", { style: { marginTop: "1.25rem" } },
                createElement(SocOwnershipBadge, {
                  team: signalOwnership?.team,
                  writable: signalOwnership?.writable,
                  accessLevel: "read-only",
                }),
              ),
            ),
    ),
  );
}
