import { useState, useEffect, useCallback, useRef, lazy, Suspense, memo, createElement } from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useI18n } from "../context/LangContext.js";
import { usePortfolio } from "../context/PortfolioContext.js";
import { AISettingsErrorBoundary } from "../components/AISettingsErrorBoundary.js";
import { ShellPanel } from "../components/ShellPageTemplate.js";
import styles from "../components/aiSettings.module.css";
import { providerLabelKey, aiSourceLabelKey } from "../shared/providerModels.js";
import {
  AICommandCenterForm,
  AISettings,
  AICommandCenterTransport,
  PromptConfigHistoryEntry,
} from "../components/AICommandCenterForm.js";
import { AiHubNav } from "../components/AiHubNav.js";
import { Breadcrumb } from "../components/Breadcrumb.js";

const e = createElement;

const LazyAuditLogsPanel = lazy(() =>
  import("../components/AIAuditLogsPanel.js").then((m) => ({ default: m.AIAuditLogsPanel }))
);

const SummaryCard = memo(function SummaryCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return e("div", { className: styles.summaryCard }, [
    e("p", { key: "title", className: styles.summaryLabel }, title),
    e("p", { key: "value", className: styles.summaryValue }, value),
    e("p", { key: "sub", className: styles.summarySub }, subtitle),
  ]);
});

const adapterTransport: AICommandCenterTransport = {
  getConfig: () => (coreApiAdapter as any).getAICommandCenterConfig(),
  updateConfig: (payload) => (coreApiAdapter as any).updateAICommandCenterConfig(payload),
  testConnection: (payload) => (coreApiAdapter as any).testAICommandCenterConnection(payload),
};

/**
 * R0.3: chi gui `ai_prompt_config` khi drawer that su dirty — luu thuong
 * khong mo drawer khong duoc ghi de config am tham (P0-2). Pure de test.
 */
export function shouldSendPromptConfig(
  promptConfig: Record<string, unknown> | null,
  dirty: boolean,
): boolean {
  return dirty && promptConfig != null;
}

interface AICommandCenterPageProps {
  className?: string;
}

export function AICommandCenterPage({ className = "" }: AICommandCenterPageProps) {
  const { t, localeTag } = useI18n();
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [pageError, setPageError] = useState("");
  const [pageNotice, setPageNotice] = useState("");

  const [aiReady, setAiReady] = useState(false);
  // R0.9 AC8: lop B he thong chi staff thay (pattern AdminAnalyticsPage).
  const { userIdentity } = usePortfolio() as any;
  const isStaffViewer = Boolean(userIdentity?.isStaff || userIdentity?.isSuperuser);
  // R1.4 AC1: null = chưa có data (không hiện số giả 24/24/5000); có data mới hiện.
  const [overviewLoaded, setOverviewLoaded] = useState(false);
  const [maxAutoRefreshes, setMaxAutoRefreshes] = useState<number | null>(null);
  const [eventGateEnabled, setEventGateEnabled] = useState<boolean | null>(null);
  const [eventGateSaving, setEventGateSaving] = useState(false);

  const [effectiveSource, setEffectiveSource] = useState("command_center");
  const [effectiveProvider, setEffectiveProvider] = useState("");
  const [effectiveModel, setEffectiveModel] = useState("");

  const [promptHistory, setPromptHistory] = useState<PromptConfigHistoryEntry[]>([]);
  const [promptConfig, setPromptConfig] = useState<Record<string, unknown> | null>(null);
  // R0.3: chi drawer edit danh dau dirty — load/save echo KHONG gui lai config.
  const [promptConfigDirty, setPromptConfigDirty] = useState(false);
  const [rollbackBusy, setRollbackBusy] = useState(false);
  // R1.4 AC5: refresh audit imperative (giữ filter + page), không remount.
  const auditRef = useRef<{ refresh: () => void } | null>(null);
  // R1.4 AC3: dirty từ form (form báo qua onFieldsDirtyChange).
  const [formFieldsDirty, setFormFieldsDirty] = useState(false);
  // R1.4 AC4/AC6: timer notice có cleanup khi unmount.
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleNoticeClear = useCallback(() => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setPageNotice(""), 3000);
  }, []);
  useEffect(() => () => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
  }, []);

  // R1.4 AC3: rời trang khi còn thay đổi chưa lưu ⇒ trình duyệt hỏi xác nhận.
  useEffect(() => {
    if (!(promptConfigDirty || formFieldsDirty)) return;
    const handler = (ev: BeforeUnloadEvent) => {
      ev.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [promptConfigDirty, formFieldsDirty]);

  const applySettingsToOverview = useCallback((data: AISettings) => {
    setSettings(data);
    setOverviewLoaded(true);
    setEffectiveSource((data as any).effective_ai_source || "command_center");
    setEffectiveProvider((data as any).effective_ai_provider || data.ai_provider || "openclaw");
    setEffectiveModel((data as any).effective_ai_model || data.ai_model || "");
    setAiReady((data as any).ai_ready ?? false);
    setMaxAutoRefreshes(Number((data as any).advisory_max_auto_refreshes_per_day) || 24);
    const history = (data as any).ai_prompt_config_history;
    setPromptHistory(Array.isArray(history) ? history : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const userConfig = await (coreApiAdapter as any).getUserConfig();
        if (cancelled) return;
        const prefs = userConfig?.preferences || {};
        setEventGateEnabled(prefs.advisory_whale_signal_enabled !== false);
      } catch {
        /* silent — event gate optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFormSettingsChange = useCallback(
    (data: AISettings) => {
      applySettingsToOverview(data);
      if (data.ai_prompt_config) setPromptConfig(data.ai_prompt_config);
    },
    [applySettingsToOverview]
  );

  const handleFormSaved = useCallback(
    (data: AISettings) => {
      applySettingsToOverview(data);
      setPromptConfigDirty(false);
      setFormFieldsDirty(false);
      auditRef.current?.refresh();
    },
    [applySettingsToOverview]
  );

  const handlePromptConfigEdited = useCallback(() => {
    setPromptConfigDirty(true);
  }, []);

  const handleFormNotice = useCallback((message: string) => {
    setPageNotice(message);
    setPageError("");
    scheduleNoticeClear();
  }, [scheduleNoticeClear]);

  const handleFormError = useCallback((message: string) => {
    setPageError(message);
    setPageNotice("");
  }, []);

  const handleEventGateToggle = async () => {
    if (eventGateEnabled === null || eventGateSaving) return;
    setEventGateSaving(true);
    setPageError("");
    try {
      const next = !(eventGateEnabled as boolean);
      const res = await (coreApiAdapter as any).updateUserConfig({ advisory_whale_signal_enabled: next });
      setEventGateEnabled(res?.advisory_whale_signal_enabled ?? next);
    } catch (err: unknown) {
      setPageError(
        (err && typeof err === "object" && "message" in err ? (err as Error).message : "") ||
          t("aiCommandCenter.errorEventGate")
      );
    } finally {
      setEventGateSaving(false);
    }
  };

  const handleRollbackPromptConfig = async (version: number) => {
    if (rollbackBusy) return;
    setRollbackBusy(true);
    setPageError("");
    try {
      const res = await (coreApiAdapter as any).rollbackAICommandCenterPromptConfig(version);
      if (res?.ai_prompt_config) setPromptConfig(res.ai_prompt_config);
      if (Array.isArray(res?.ai_prompt_config_history)) setPromptHistory(res.ai_prompt_config_history);
      setPageNotice(t("aiCommandCenter.promptHistoryRestored", { version }));
      scheduleNoticeClear();
      auditRef.current?.refresh();
    } catch (err: unknown) {
      setPageError(
        (err && typeof err === "object" && "message" in err ? (err as Error).message : "") ||
          t("aiCommandCenter.promptHistoryRestoreError")
      );
    } finally {
      setRollbackBusy(false);
    }
  };

  const formTransport = adapterTransport;

  return e(AISettingsErrorBoundary, {
      fallbackTitle: t("aiCommandCenter.errorBoundaryTitle"),
      errorMessage: t("aiCommandCenter.unknownError"),
      retryLabel: t("aiCommandCenter.retryButton")
    },
    e("div", { className: `shellPage ${styles.hubPage} ${className}` }, [
      e("header", { className: styles.pageHeader },
        e("div", null, [
          // S4 (2026-10-19): đã bỏ eyebrow "Cài đặt". Nó trùng khái niệm với breadcrumb
          // "Cài đặt tài khoản" ngay trên màn hình đó, khiến người dùng tưởng đang
          // đọc hướng dẫn của trang cài đặt chứ không phải trung tâm điều hành AI.
          e("h1", { key: "title", className: styles.pageTitle }, t("aiCommandCenter.title")),
          e("p", { key: "desc", className: styles.pageDesc }, t("aiCommandCenter.description")),
        ])
      ),

      // R4.4 AC2: breadcrumb 3 mức /settings -> /settings/ai -> tab con.
      e(Breadcrumb, { key: "breadcrumb" }),
      // R1.8: tab route dùng chung AiHubNav.
      //
      // S1 (2026-10-19): trang **không còn** nav anchor thứ 2 (`#overview` / `#runtime` /
      // `#audit`). Lý do — nó dùng **cùng** bộ class `styles.hubNav` + **cùng**
      // `aria-label` với `AiHubNav` nên trông **giống hệt**, và lúc vừa tải
      // (`location.hash === ""`) **hai** ô "Tổng quan" đều tô sáng.
      // Ba mục đó cũng không bổ sung gì: `#overview` là đầu trang, `#audit` trùng
      // nghiệp vụ với route `/settings/ai/audit`, `#runtime` là panel thứ 3 cùng trang.
      // Hệ điều hướng duy nhất của trang là 5 tab route của `AiHubNav`.
      e(AiHubNav, { key: "hub-tabs" }),

      // Summary Cards
      // S3 (2026-10-19): `effective_ai_provider` / `effective_ai_source` là **enum**, không
      // phải nhãn. Trước S3 render thẳng chuỗi thô ⇒ người dùng thấy `gemini` và
      // `command_center` (bằng chứng: ảnh chụp màn hình thật trên staging).
      e("div", { key: "overview-anchor", id: "overview" },
        e(ShellPanel, { title: t("aiCommandCenter.overview") },
          e("div", { className: styles.summaryGrid }, [
            e(SummaryCard, {
              key: "card-provider",
              title: t("aiCommandCenter.effectiveProvider"),
              value: effectiveProvider ? t(providerLabelKey(effectiveProvider)) : "—",
              subtitle: t("aiCommandCenter.effectiveProviderDesc"),
            }),
            e(SummaryCard, { key: "card-model", title: t("aiCommandCenter.effectiveModel"), value: effectiveModel || t("aiCommandCenter.needsConfig"), subtitle: t("aiCommandCenter.effectiveModelDesc") }),
            e(SummaryCard, {
              key: "card-source",
              title: t("aiCommandCenter.effectiveSource"),
              value: t(aiSourceLabelKey(effectiveSource)),
              subtitle: t("aiCommandCenter.effectiveSourceDesc"),
            }),
            e(SummaryCard, { key: "card-status", title: t("aiCommandCenter.runtimeStatus"), value: aiReady ? t("aiCommandCenter.ready") : t("aiCommandCenter.needsConfig"), subtitle: aiReady ? t("aiCommandCenter.readyDesc") : t("aiCommandCenter.needsConfigDesc") }),
          ])
        )
      ),

      // Policy Section
      //
      // S2 (2026-10-19): panel này CHỈ còn giá trị cấp HỆ THỐNG.
      //  - Đã bỏ `advisory_refresh_interval_hours` + `advisory_max_tokens_per_day`: chúng
      //    hiện chỉ đọc ở đây nhưng sửa được trong form ngay dưới, với tên khác nhau
      //    ("Khoảng làm mới" vs "Khoảng làm mới tự động (giờ)"). Số trùng ở 2 nơi làm
      //    người dùng không biết sửa ở đâu.
      //  - `advisory_max_auto_refreshes_per_day` được giữ lại vì **không có `<input>` nào**
      //    trên toàn FE (đo đệ quy 581 file: 10 hit, 0 file tạo input) ⇒ gắn nhãn
      //    "Chỉ đọc" để không ai tưởng là sửa được.
      //  - `eventGate` đã chuyển sang panel "Tuỳ chọn cá nhân" phía dưới.
      e(ShellPanel, { key: "policy", title: t("aiCommandCenter.operationPolicy") },
        e("div", { className: styles.metricGridAuto, "aria-busy": !overviewLoaded }, [
          e("div", { key: "pol-auto", className: styles.metricCard }, [
            e("p", { key: "l", className: styles.metricLabel }, t("aiCommandCenter.autoRefreshPerDay")),
            e("p", { key: "v", className: styles.metricValue, "data-testid": "auto-refresh-value" },
              maxAutoRefreshes == null ? "—" : `${maxAutoRefreshes}`),
            e("span", { key: "badge", className: styles.metricBadge, "data-testid": "auto-refresh-readonly" },
              t("aiCommandCenter.readOnlyBadge")),
          ]),
        ]),
      ),

      // S2: tùy chọn CÁ NHÂN — endpoint/kho lưu riêng (`updateUserConfig`), không phải
      // cấu hình trung tâm AI. Tách riêng để hết hiện tượng "lẫn lộn cài đặt tài khoản
      // với cấu hình trung tâm AI".
      e(ShellPanel, {
        key: "personal",
        title: t("aiCommandCenter.personalPrefs"),
        subtitle: t("aiCommandCenter.personalPrefsDesc"),
      },
        e("div", { className: styles.metricGridAuto }, [
          e("div", { key: "personal-gate", className: styles.metricCard }, [
            // `<label>` bao CẢ nhãn lẫn control: trước đây nhãn nằm ở `<p>` anh em,
            // nên checkbox chỉ có accessible name là trạng thái ("Bật"/"Tắt") — mọi
            // toggle trên trang đều đọc giống nhau với trình đọc màn hình.
            e("label", { key: "v", className: styles.toggleRow, htmlFor: "ai-personal-event-gate" }, [
              e("input", {
                id: "ai-personal-event-gate",
                type: "checkbox",
                className: styles.checkbox,
                checked: eventGateEnabled === true,
                disabled: eventGateEnabled === null || eventGateSaving,
                onChange: handleEventGateToggle,
                "data-testid": "personal-event-gate",
              }),
              e("span", { key: "name" }, t("aiCommandCenter.eventGate")),
              e("span", { key: "state", className: styles.metricLabel },
                eventGateEnabled === null
                  ? t("aiCommandCenter.gateUnknown")
                  : eventGateEnabled
                    ? t("aiCommandCenter.gateEnabled")
                    : t("aiCommandCenter.gateDisabled")),
            ]),
          ]),
        ]),
      ),

      pageNotice ? e("div", { key: "notice-banner", className: styles.alert + " " + styles.alertSuccess }, pageNotice) : null,
      pageError ? e("div", { key: "error-banner", className: styles.alert + " " + styles.alertError }, pageError) : null,

      // Runtime config form — shared F8 component
      e("div", { key: "runtime-anchor", id: "runtime" },
        e(ShellPanel, { title: t("aiCommandCenter.runtimeConfig") },
          e(AICommandCenterForm, {
            key: "ai-cc-form",
            transport: formTransport,
            onSettingsChange: handleFormSettingsChange,
            onSettingsSaved: handleFormSaved,
            onError: handleFormError,
            onNotice: handleFormNotice,
            onPromptConfigChange: setPromptConfig,
            onPromptConfigEdited: handlePromptConfigEdited,
            externalDirty: promptConfigDirty,
            onFieldsDirtyChange: setFormFieldsDirty,
            getExtraPayload: () =>
              shouldSendPromptConfig(promptConfig, promptConfigDirty)
                ? { ai_prompt_config: promptConfig }
                : {},
          })
        )
      ),

      settings && settings.fallback_quota_max != null && settings.fallback_quota_max > 0 &&
        ((settings as any).ai_provider !== "openclaw" && (settings as any).ai_provider !== "local")
        ? (() => {
            const quotaRemaining = settings.fallback_quota_remaining ?? 0;
            const quotaMax = settings.fallback_quota_max || 1;
            // R1.10 AC2: nhãn đúng nghĩa — còn lại / đã dùng (không "5 lượt / 5 lượt").
            const quotaUsedToday = (settings as any).fallback_quota_used_today
              ?? Math.max(0, quotaMax - quotaRemaining);
            const quotaSource = (settings as any).fallback_quota_source === "personal_key"
              ? t("aiCommandCenter.quotaSourcePersonal")
              : t("aiCommandCenter.quotaSourceSystem");
            // R1.10 AC3: đếm ngược tới nửa đêm (reset quota ngày).
            const now = new Date();
            const midnight = new Date(now);
            midnight.setHours(24, 0, 0, 0);
            const msLeft = Math.max(0, midnight.getTime() - now.getTime());
            const resetIn = t("aiCommandCenter.quotaResetIn", {
              h: Math.floor(msLeft / 3600000),
              m: Math.floor((msLeft % 3600000) / 60000),
            });
            return e(ShellPanel, { key: "quota", title: t("aiCommandCenter.fallbackTitle") },
            e("div", { className: styles.toolbar }, [
              e("div", {
                key: "quota-bar",
                className: styles.quotaBar
              }, [
                e("div", {
                  style: {
                    width: `${quotaMax > 0
                      ? (quotaRemaining / quotaMax) * 100
                      : 0}%`
                  } as React.CSSProperties,
                  className: styles.quotaFill + " " + (quotaRemaining > 0 ? "" : styles.quotaFillEmpty)
                })
              ]),
              e("span", { className: styles.metricLabel },
                `${t("aiCommandCenter.quotaLine", {
                  remaining: quotaRemaining,
                  max: quotaMax,
                  used: quotaUsedToday,
                })} · ${resetIn} · ${quotaSource}`
              )
            ]),
            settings.fallback_quota_reset
              ? e("p", { className: styles.helpText },
                  `${t("aiCommandCenter.fallbackReset")}: ${new Date(settings.fallback_quota_reset).toLocaleDateString(localeTag)}`)
              : null,
            quotaRemaining === 0
              ? e("p", { className: styles.alert + " " + styles.alertError },
                  t("aiCommandCenter.fallbackExhausted"))
              : e("p", { className: styles.helpText },
                  t("aiCommandCenter.fallbackInfo"))
          );
          })()
        : null,

      // System prompt template viewer (F5) — R0.9 AC8: chi staff thay template;
      // user thuong thay thong bao "do nen tang quan ly".
      settings
        ? e(ShellPanel, {
            key: "system-prompt-panel",
            title: t("aiCommandCenter.systemPromptTitle"),
            subtitle: t("aiCommandCenter.systemPromptDesc"),
          },
            isStaffViewer
              ? (settings.system_prompt_template
                ? e("pre", {
                    key: "template",
                    "data-testid": "system-prompt-template",
                    className: styles.promptViewer,
                  }, settings.system_prompt_template)
                : e("p", { key: "empty", className: styles.empty, "data-testid": "system-prompt-empty" },
                    t("aiCommandCenter.systemPromptEmpty")))
              : e("p", { key: "managed", className: styles.helpText, "data-testid": "system-prompt-managed" },
                  t("aiCommandCenter.systemManagedByPlatform"))
          )
        : null,

      // F7: prompt config version history + rollback
      e(ShellPanel, {
        key: "prompt-history-panel",
        title: t("aiCommandCenter.promptHistoryTitle"),
        subtitle: t("aiCommandCenter.promptHistoryDesc"),
      },
        promptHistory.length === 0
          ? e("p", { key: "empty", className: styles.empty, "data-testid": "prompt-history-empty" },
              t("aiCommandCenter.promptHistoryEmpty"))
          : e("div", { key: "list", className: styles.helpText, "data-testid": "prompt-history-list" },
              [...promptHistory].reverse().map((entry) => {
                const saved = entry.saved_at ? new Date(entry.saved_at) : null;
                const savedLabel = saved && !Number.isNaN(saved.getTime())
                  ? saved.toLocaleString(localeTag)
                  : "";
                return e("div", {
                  key: String(entry.version),
                  className: styles.historyRow,
                }, [
                  e("span", { key: "meta" },
                    `${t("aiCommandCenter.promptHistoryVersion", { version: entry.version })}`
                    + (entry.source ? ` · ${t(aiSourceLabelKey(entry.source))}` : "")
                    + (savedLabel ? ` · ${savedLabel}` : "")
                  ),
                  e("button", {
                    key: "restore",
                    type: "button",
                    className: styles.btn + " " + styles.btnGhost,
                    disabled: rollbackBusy,
                    "data-testid": `prompt-history-restore-${entry.version}`,
                    onClick: () => handleRollbackPromptConfig(entry.version),
                  }, rollbackBusy
                    ? t("aiCommandCenter.promptHistoryRestoring")
                    : t("aiCommandCenter.promptHistoryRestore"))
                ]);
              })
            )
      ),

      // Audit Logs Section
      e("div", { key: "audit-anchor", id: "audit" },
        e(ShellPanel, {
            title: t("aiCommandCenter.auditLogsTitle"),
            subtitle: t("aiCommandCenter.auditLogsDesc"),
          },
          e(Suspense, { key: "audit-suspense", fallback: e("p", { className: styles.loading }, t("aiCommandCenter.auditLogsLoading")) },
            e(LazyAuditLogsPanel, { key: "audit-panel", ref: auditRef })
          )
        )
      ),
    ])
  );
}
