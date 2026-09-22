import { createElement, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { useConfirm } from "../../components/ConfirmModal.js";
import { ShellPanel } from "../../components/ShellPageTemplate.js";
import { SocSchedulerBoard } from "./SocSchedulerBoard.js";
import { SocConfigPreviewModal } from "./SocConfigPreviewModal.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { toneColor } from "./socStatusColors.js";
import styles from "./soc.module.css";

interface PrefetchConfig {
  active_profile?: string;
  pre_open_interval_seconds?: number;
  market_open_interval_seconds?: number;
  lunch_break_interval_seconds?: number;
  pre_close_interval_seconds?: number;
  post_close_interval_seconds?: number;
  offhours_interval_seconds?: number;
  batch_size?: number;
  max_concurrent_workers?: number;
  universe_group_ids?: string[];
  cache_ttl_seconds?: number;
  enabled?: boolean;
  skip_non_trading_days?: boolean;
  batch_size_legacy?: number;
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
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inlineError, setInlineError] = useState("");
  const [inlineSuccess, setInlineSuccess] = useState("");
  const [config, setConfig] = useState<PrefetchConfig | null>(null);
  const [cacheStatus, setCacheStatus] = useState<PrefetchCacheStatus | null>(null);
  const [universeGroups, setUniverseGroups] = useState<any[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [universeMode, setUniverseMode] = useState("");
  const [hintGroupIds, setHintGroupIds] = useState<string[]>([]);
  const [editConfig, setEditConfig] = useState("");
  const [previewModal, setPreviewModal] = useState<{
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    preview?: unknown;
    validationErrors?: string[];
    changeSummary?: string[];
  } | null>(null);
  const [applying, setApplying] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        getSocPrefetchConfig: () => Promise<PrefetchConfig>;
        getSocPrefetchCacheStatus: () => Promise<PrefetchCacheStatus>;
        getSocPrefetchUniverseGroups: () => Promise<{ groups?: any[]; universe_mode?: string; hint_group_ids?: string[] }>;
      };

      const [cfg, cache, groups] = await Promise.all([
        adapter.getSocPrefetchConfig(),
        adapter.getSocPrefetchCacheStatus(),
        adapter.getSocPrefetchUniverseGroups(),
      ]);

      setConfig(cfg);
      setCacheStatus(cache);
      const groupsList = groups.groups || [];
      setUniverseGroups(groupsList);
      setUniverseMode(groups.universe_mode || "");
      setHintGroupIds(Array.isArray(groups.hint_group_ids) ? groups.hint_group_ids : []);
      // P0-3: reconcile universe_group_ids vào textarea ngay từ lần tải đầu,
      // tránh mâu thuẫn "Đã chọn 2/4 nhóm" nhưng JSON vẫn `"universe_group_ids": []`.
      const flagged = groupsList.filter((g: any) => g.selected).map((g: any) => g.id);
      const initial = selectedGroups.length > 0
        ? selectedGroups
        : (flagged.length > 0 ? flagged : groupsList.map((g: any) => g.id).slice(0, 2));
      setSelectedGroups(initial);
      setEditConfig(JSON.stringify({ ...(cfg as Record<string, unknown> || {}), universe_group_ids: initial }, null, 2));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load prefetch data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEditConfig = () => {
    setEditConfig(JSON.stringify({ ...(config as Record<string, unknown> || {}), universe_group_ids: selectedGroups }, null, 2));
  };

  const handlePreview = async () => {
    setInlineError(""); setInlineSuccess("");
    let parsed: PrefetchConfig;
    try {
      parsed = { ...(JSON.parse(editConfig) as PrefetchConfig), universe_group_ids: selectedGroups } as PrefetchConfig;
    } catch {
      setInlineError(t("soc.prefetch.invalid_json"));
      return;
    }
    try {
      const adapter = defaultCoreApiAdapter as unknown as { previewSocPrefetchConfig: (cfg: PrefetchConfig) => Promise<unknown> };
      if (typeof adapter.previewSocPrefetchConfig === "function") {
        const preview = (await adapter.previewSocPrefetchConfig(parsed)) as {
          errors?: unknown;
          change_summary?: unknown;
        } | null;
        const validationErrors = Array.isArray(preview?.errors)
          ? (preview.errors as unknown[]).map((e) => String(e))
          : [];
        const changeSummary = Array.isArray(preview?.change_summary)
          ? (preview.change_summary as unknown[]).map((c) => String(c))
          : [];
        setPreviewModal({ before: config || {}, after: parsed, preview, validationErrors, changeSummary });
      } else {
        setPreviewModal({ before: config || {}, after: parsed });
      }
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : t("soc.prefetch.preview_failed", { defaultValue: "Preview failed." }));
    }
  };

  const handleApply = async () => {
    setInlineError(""); setInlineSuccess("");
    try {
      const parsed = { ...(JSON.parse(editConfig) as PrefetchConfig), universe_group_ids: selectedGroups } as PrefetchConfig;
      setApplying(true);
      const adapter = defaultCoreApiAdapter as unknown as { applySocPrefetchConfig: (cfg: PrefetchConfig) => Promise<void> };
      await adapter.applySocPrefetchConfig(parsed);
      setPreviewModal(null);
      setInlineSuccess(t("soc.prefetch.apply_success", { defaultValue: "Applied successfully." }));
      await fetchData();
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Apply failed.");
    } finally {
      setApplying(false);
    }
  };

  const handleWarmNow = async () => {
    setInlineError(""); setInlineSuccess("");
    try {
      const adapter = defaultCoreApiAdapter as unknown as { warmSocPrefetchNow: (mode: string, opts?: Record<string, unknown>) => Promise<void> };
      await adapter.warmSocPrefetchNow("async", { groups: selectedGroups });
      setInlineSuccess(t("soc.prefetch.warm_success"));
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Warm failed.");
    }
  };

  const handlePurgeCache = async () => {
    const ok = await confirm({
      title: t("common.confirmTitle"),
      message: t("soc.prefetch.purge_confirm"),
      variant: "destructive",
    });
    if (!ok) return;
    setInlineError(""); setInlineSuccess("");
    try {
      const adapter = defaultCoreApiAdapter as unknown as { purgeSocPrefetchCache: () => Promise<void> };
      await adapter.purgeSocPrefetchCache();
      setInlineSuccess(t("soc.prefetch.purge_success"));
      await fetchData();
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Purge failed.");
    }
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroups((prev) => {
      const next = prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId];
      // keep editConfig in sync so textarea reflects universe_group_ids (COC-36)
      try {
        const parsed = JSON.parse(editConfig) as PrefetchConfig;
        (parsed as Record<string, unknown>).universe_group_ids = next;
        setEditConfig(JSON.stringify(parsed, null, 2));
      } catch {
        // ignore JSON parse errors — merge will happen on preview/apply
      }
      return next;
    });
  };

  const renderMetricCard = (label: string, value: string | number, color?: string) => {
    return createElement(
      "div",
      { className: styles.metricCard },
      createElement("div", { className: styles.metricLabel }, label),
      createElement("div", { className: styles.metricValue, style: { color: color || "var(--text-primary, #f1f5f9)" } }, value),
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
              inlineError ? createElement("div", { className: styles.inlineError, style: { marginBottom: "0.75rem" } }, inlineError) : null,
              inlineSuccess ? createElement("div", { className: styles.inlineSuccess, style: { marginBottom: "0.75rem" } }, inlineSuccess) : null,
              createElement("div", { className: styles.sectionGrid },
                createElement(
                  "div",
                  { className: styles.sectionCard },
                  createElement("div", { className: styles.sectionCardTitle }, t("soc.prefetch.universe_groups_title")),
                  createElement(
                    "div",
                    { },
                    universeGroups.map((group) => {
                      const active = selectedGroups.includes(group.id);
                      return createElement(
                        "button",
                        {
                          key: group.id,
                          onClick: () => toggleGroup(group.id),
                          className: `${styles.filterBtn} ${active ? styles.filterBtnActive : styles.filterBtnInactive}`,
                          style: { display: "inline-flex", alignItems: "center", gap: "0.35rem" },
                        },
                        active ? createElement("span", { style: { width: "8px", height: "8px", borderRadius: "50%", background: "var(--soc-c-34d399)", display: "inline-block" } }) : createElement("span", { style: { width: "8px", height: "8px", borderRadius: "50%", border: "1px solid var(--soc-c-94a3b8)", display: "inline-block" } }),
                        group.name || group.id,
                      );
                    }),
                  ),
                  createElement("div", { },
                    t("soc.prefetch.groups_summary", { count: selectedGroups.length, total: universeGroups.length }),
                  ),
                  createElement("div", { },
                    t("soc.prefetch.universe_groups_hint"),
                  ),
                  universeMode === "registry_first"
                    ? createElement("div", { }, t("soc.prefetch.universe_groups_registry_first"))
                    : null,
                  hintGroupIds.length > 0
                    ? createElement("div", { }, `${t("soc.prefetch.hint_group_ids_label")}: ${hintGroupIds.join(", ")}`)
                    : null,
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
                    { },
                    createElement(
                      "button",
                      { onClick: handlePreview, className: styles.actionBtn,  },
                      t("soc.actions.preview"),
                    ),
                    createElement(
                      "button",
                      { onClick: handleEditConfig, className: styles.actionBtn,  },
                      t("soc.actions.edit"),
                    ),
                  ),
                ),
              ),
              createElement("div", { className: styles.metricGrid,  },
                renderMetricCard(t("soc.prefetch.hit_rate"), `${cacheStatus?.hit_rate ?? 0}%`, toneColor("success")),
                renderMetricCard(t("soc.prefetch.cache_size"), `${cacheStatus?.size_mb ?? 0} MB`, "var(--accent-cyan, #06b6d4)"),
                renderMetricCard(t("soc.prefetch.cache_ttl"), `${cacheStatus?.ttl_minutes ?? 0} min`, toneColor("warning")),
              ),
              createElement(
                "div",
                { },
                createElement(
                  "button",
                  { onClick: handleWarmNow, className: styles.actionBtn,  },
                  t("soc.prefetch.warm_now"),
                ),
                createElement(
                  "button",
                  { onClick: handlePurgeCache, className: styles.actionBtn,  },
                  t("soc.prefetch.purge_cache"),
                ),
              ),
              createElement("div", { },
                createElement(SocSchedulerBoard, { domain: "prefetch" }),
              ),
            ),
    ),
    previewModal
      ? createElement(SocConfigPreviewModal, {
          before: previewModal.before,
          after: previewModal.after,
          changeSummary: previewModal.changeSummary,
          validationErrors: previewModal.validationErrors,
          onConfirm: handleApply,
          onCancel: () => setPreviewModal(null),
          loading: applying,
        })
      : null,
  );
}
