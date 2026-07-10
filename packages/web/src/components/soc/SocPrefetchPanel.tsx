import { createElement, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { ShellPanel } from "../../components/ShellPageTemplate.js";
import { SocSchedulerBoard } from "./SocSchedulerBoard.js";
import { SocConfigPreviewModal } from "./SocConfigPreviewModal.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import styles from "./soc.module.css";

interface PrefetchConfig {
  batch_size?: number;
  symbol_limit?: number;
  max_retries?: number;
  rate_limit_cooldown?: number;
  cache_ttl?: number;
  close_history_days?: number;
  [key: string]: unknown;
}

interface PrefetchCacheStatus {
  hit_rate?: number;
  size_mb?: number;
  ttl_minutes?: number;
  [key: string]: unknown;
}

export function SocPrefetchPanel() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [config, setConfig] = useState<PrefetchConfig | null>(null);
  const [cacheStatus, setCacheStatus] = useState<PrefetchCacheStatus | null>(null);
  const [universeGroups, setUniverseGroups] = useState<any[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [editConfig, setEditConfig] = useState("");
  const [previewModal, setPreviewModal] = useState<{ before: Record<string, unknown>; after: Record<string, unknown> } | null>(null);
  const [applying, setApplying] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        getSocPrefetchConfig: () => Promise<PrefetchConfig>;
        getSocPrefetchCacheStatus: () => Promise<PrefetchCacheStatus>;
        getSocPrefetchUniverseGroups: () => Promise<{ groups?: any[] }>;
      };

      const [cfg, cache, groups] = await Promise.all([
        adapter.getSocPrefetchConfig(),
        adapter.getSocPrefetchCacheStatus(),
        adapter.getSocPrefetchUniverseGroups(),
      ]);

      setConfig(cfg);
      setEditConfig(JSON.stringify(cfg || {}, null, 2));
      setCacheStatus(cache);
      const groupsList = groups.groups || [];
      setUniverseGroups(groupsList);
      setSelectedGroups((prev) => {
        if (prev.length > 0) return prev;
        const initial = groupsList.filter((g: any) => g.selected).map((g: any) => g.id);
        return initial.length > 0 ? initial : groupsList.map((g: any) => g.id).slice(0, 2);
      });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load prefetch data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEditConfig = () => {
    setEditConfig(JSON.stringify(config || {}, null, 2));
  };

  const handlePreview = () => {
    try {
      const parsed = JSON.parse(editConfig) as PrefetchConfig;
      setPreviewModal({ before: config || {}, after: parsed });
    } catch {
      alert(t("soc.prefetch.invalid_json"));
    }
  };

  const handleApply = async () => {
    try {
      const parsed = JSON.parse(editConfig) as PrefetchConfig;
      setApplying(true);
      const adapter = defaultCoreApiAdapter as unknown as { applySocPrefetchConfig: (cfg: PrefetchConfig) => Promise<void> };
      await adapter.applySocPrefetchConfig(parsed);
      setPreviewModal(null);
      await fetchData();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Apply failed."}`);
    } finally {
      setApplying(false);
    }
  };

  const handleWarmNow = async () => {
    try {
      const adapter = defaultCoreApiAdapter as unknown as { warmSocPrefetchNow: (mode: string) => Promise<void> };
      await adapter.warmSocPrefetchNow("async");
      alert(t("soc.prefetch.warm_success"));
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Warm failed."}`);
    }
  };

  const handlePurgeCache = async () => {
    if (!window.confirm(t("soc.prefetch.purge_confirm"))) return;
    try {
      const adapter = defaultCoreApiAdapter as unknown as { purgeSocPrefetchCache: () => Promise<void> };
      await adapter.purgeSocPrefetchCache();
      alert(t("soc.prefetch.purge_success"));
      await fetchData();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Purge failed."}`);
    }
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroups((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
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
    createElement(
      ShellPanel,
      {
        title: t("soc.prefetch.title"),
        subtitle: t("soc.prefetch.subtitle"),
      },
      loading
        ? createElement("p", { className: styles.emptyState }, t("soc.prefetch.loading"))
        : error
          ? createElement("div", { className: styles.inlineError }, error)
          : createElement(
              "div",
              null,
              createElement("div", { className: styles.sectionGrid },
                createElement(
                  "div",
                  { className: styles.sectionCard },
                  createElement("div", { className: styles.sectionCardTitle }, t("soc.prefetch.universe_groups_title")),
                  createElement(
                    "div",
                    { style: { display: "flex", flexWrap: "wrap", gap: "0.5rem" } },
                    universeGroups.map((group) =>
                      createElement(
                        "button",
                        {
                          key: group.id,
                          onClick: () => toggleGroup(group.id),
                          className: `${styles.filterBtn} ${selectedGroups.includes(group.id) ? styles.filterBtnActive : styles.filterBtnInactive}`,
                        },
                        `${selectedGroups.includes(group.id) ? "\u2705" : "\u2B1C"} ${group.name || group.id}`,
                      ),
                    ),
                  ),
                  createElement("div", { style: { fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" } },
                    t("soc.prefetch.groups_summary", { count: selectedGroups.length, total: universeGroups.length }),
                  ),
                ),
                createElement(
                  "div",
                  { className: styles.sectionCard },
                  createElement("div", { className: styles.sectionCardTitle }, t("soc.prefetch.config_title")),
                  createElement(
                    "textarea",
                    {
                      value: editConfig,
                      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setEditConfig(e.target.value),
                      className: styles.configEditor,
                      rows: 8,
                    },
                  ),
                  createElement(
                    "div",
                    { style: { display: "flex", gap: "0.5rem", marginTop: "0.75rem" } },
                    createElement(
                      "button",
                      { onClick: handlePreview, className: styles.actionBtn, style: { background: "rgba(0, 180, 216, 0.15)", color: "var(--accent-cyan)" } },
                      t("soc.actions.preview"),
                    ),
                    createElement(
                      "button",
                      { onClick: handleEditConfig, className: styles.actionBtn, style: { background: "rgba(255, 191, 77, 0.15)", color: "var(--accent-amber)" } },
                      t("soc.actions.edit"),
                    ),
                  ),
                ),
              ),
              createElement("div", { className: styles.metricGrid, style: { marginTop: "1.25rem" } },
                renderMetricCard(t("soc.prefetch.hit_rate"), `${cacheStatus?.hit_rate ?? 0}%`, "#34d399"),
                renderMetricCard(t("soc.prefetch.cache_size"), `${cacheStatus?.size_mb ?? 0} MB`, "var(--accent-cyan)"),
                renderMetricCard(t("soc.prefetch.cache_ttl"), `${cacheStatus?.ttl_minutes ?? 0} min`, "#fbbf24"),
              ),
              createElement(
                "div",
                { style: { display: "flex", gap: "0.5rem", marginTop: "1rem" } },
                createElement(
                  "button",
                  { onClick: handleWarmNow, className: styles.actionBtn, style: { background: "rgba(16, 185, 129, 0.15)", color: "#34d399" } },
                  t("soc.prefetch.warm_now"),
                ),
                createElement(
                  "button",
                  { onClick: handlePurgeCache, className: styles.actionBtn, style: { background: "rgba(239, 68, 68, 0.15)", color: "#f87171" } },
                  t("soc.prefetch.purge_cache"),
                ),
              ),
              createElement("div", { style: { marginTop: "1.25rem" } },
                createElement(SocSchedulerBoard, { domain: "prefetch" }),
              ),
            ),
    ),
    previewModal
      ? createElement(SocConfigPreviewModal, {
          before: previewModal.before,
          after: previewModal.after,
          onConfirm: handleApply,
          onCancel: () => setPreviewModal(null),
          loading: applying,
        })
      : null,
  );
}
