import { createElement, useCallback, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { useToast } from "../../components/ShellToast.js";
import { useConfirm } from "../../components/ConfirmModal.js";
import { SocConfigPreviewModal } from "./SocConfigPreviewModal.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { downloadSocCsv } from "../../pages/admin/socCsv.js";
import { CommercialTable } from "../commercial/primitives/CommercialTable.js";
import styles from "./soc.module.css";

const e = createElement;

interface BrokerEntry {
  enabled?: boolean;
  routing_order?: number;
  max_retries?: number;
  requests_per_minute?: number;
  burst_limit?: number;
  purpose_allowlist?: string[];
}

interface BrokerConfig {
  entries?: Record<string, BrokerEntry>;
  kill_switch_write?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  [key: string]: unknown;
}

interface BrokerCredential {
  provider?: string;
  allowed_purposes?: string[];
  is_verified?: boolean;
  last_verified_at?: string | null;
  last_check?: Record<string, unknown>;
  preview?: Record<string, unknown>;
  needs_verification?: boolean;
  stale_reason?: string;
}

interface BrokerLaneLastRun {
  status?: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration_s?: number | null;
  error?: string;
}

interface BrokerLane {
  last_run?: BrokerLaneLastRun | null;
  runs_24h?: { succeeded?: number; failed?: number; pending?: number; running?: number; total?: number };
  error_rate_24h?: number;
  avg_latency_s_24h?: number | null;
  unresolved_issues?: { info?: number; warning?: number; error?: number; total?: number };
  top_errors?: Array<{ code?: string; count?: number }>;
  consecutive_failures?: number;
  retries_configured?: number;
}

interface BrokerProviderHealth {
  provider?: unknown;
  enabled?: boolean;
  credential_present?: boolean;
  is_verified?: boolean;
  needs_verification?: boolean;
  stale_reason?: string;
  lane?: BrokerLane;
  queue_depth?: number;
  [key: string]: unknown;
}

interface BrokerHealth {
  kill_switch_write?: boolean;
  providers?: BrokerProviderHealth[];
  queues?: Record<string, number>;
  top_errors?: Array<{ code?: string; count?: number }>;
}

interface BrokerAudit {
  action?: string;
  actor?: string;
  change_summary?: string;
  timestamp?: string;
  request_id?: string;
}

const socBrokerAdapter = defaultCoreApiAdapter as unknown as {
  getSocBrokerConfig: () => Promise<{ config?: BrokerConfig }>;
  applySocBrokerConfig: (config: BrokerConfig, reason: string) => Promise<{ ok?: boolean; change_summary?: string[] }>;
  previewSocBrokerConfig: (config: BrokerConfig) => Promise<{
    before?: Record<string, unknown>; after?: Record<string, unknown>;
    change_summary?: string[]; validation_errors?: string[];
  }>;
  getSocBrokerAudit: (limit?: number) => Promise<{ audits?: BrokerAudit[] }>;
  getSocBrokerHealth: () => Promise<BrokerHealth>;
  getSocBrokerCredentials: () => Promise<{ credentials?: BrokerCredential[] }>;
  saveSocBrokerCredential: (provider: string, secrets: Record<string, unknown>, purposes: string[]) => Promise<unknown>;
  deleteSocBrokerCredential: (provider: string) => Promise<unknown>;
  testSocBrokerConnection: (provider: string) => Promise<{ job_id?: string }>;
};

const PROVIDERS = ["dnse", "ssi", "tcbs"];
const PURPOSES = ["backfill", "snapshot", "signal"];

/** Nhan hien thi cho muc dich su dung (gia tri BE la tieng Anh). */
const PURPOSE_LABELS: Record<string, string> = {
  backfill: "soc.broker.purpose_backfill",
  snapshot: "soc.broker.purpose_snapshot",
  signal: "soc.broker.purpose_signal",
};

function formatTime(iso?: string | null, locale = "vi-VN"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(locale);
}

export function SocBrokerPanel() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [config, setConfig] = useState<BrokerConfig>({});
  const [reason, setReason] = useState("");
  const [health, setHealth] = useState<BrokerHealth>({});
  const [creds, setCreds] = useState<BrokerCredential[]>([]);
  const [audits, setAudits] = useState<BrokerAudit[]>([]);
  const [preview, setPreview] = useState<{
    before: Record<string, unknown> | null; after: Record<string, unknown> | null;
    changeSummary: string[]; validationErrors: string[];
  } | null>(null);
  const [applying, setApplying] = useState(false);
  const [loadedKill, setLoadedKill] = useState(false);
  const [credProvider, setCredProvider] = useState("dnse");
  const [credSecrets, setCredSecrets] = useState("{}");
  const [credPurposes, setCredPurposes] = useState<string[]>(["backfill"]);
  const [testing, setTesting] = useState("");

  const wv = (key: string, defaultValue: string) => t(`brokerWave4.ops.${key}`, { defaultValue });
  const fmtNum = (v: number | null | undefined) => (v === null || v === undefined ? "—" : String(v));
  const fmtPct = (v: number | null | undefined) =>
    (v === null || v === undefined ? "—" : `${(Number(v) * 100).toFixed(1)}%`);

  function expiryBadge(reason?: string) {
    if (!reason) {
      return e("span", { className: `${styles.brokerBadge} ${styles.brokerBadgeOk}` },
        wv("verifiedOk", "Đã xác minh"));
    }
    const label = reason === "chua_cau_hinh"
      ? wv("staleNoCred", "Chưa cấu hình credential")
      : reason === "qua_han_30_ngay"
        ? wv("staleExpired", "Quá 30 ngày chưa xác minh lại")
        : wv("staleUnverified", "Chưa xác minh kết nối");
    return e("span", { className: `${styles.brokerBadge} ${styles.brokerBadgeWarn}` },
      `${wv("needsVerify", "Cần xác minh")}: ${label}`);
  }

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cfg, hlth, cr, au] = await Promise.all([
        socBrokerAdapter.getSocBrokerConfig(),
        socBrokerAdapter.getSocBrokerHealth(),
        socBrokerAdapter.getSocBrokerCredentials(),
        socBrokerAdapter.getSocBrokerAudit(50),
      ]);
      setConfig(cfg.config || {});
      setLoadedKill(!!cfg.config?.kill_switch_write);
      setHealth(hlth);
      setCreds(cr.credentials || []);
      setAudits(au.audits || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("soc.broker.load_fail"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { reload(); }, [reload]);

  function updateEntry(provider: string, patch: Partial<BrokerEntry>) {
    setConfig((c) => ({
      ...c,
      entries: { ...(c.entries || {}), [provider]: { ...(c.entries || {})[provider], ...patch } },
    }));
  }

  function togglePurpose(provider: string, purpose: string) {
    const cur = config.entries?.[provider]?.purpose_allowlist || [];
    const next = cur.includes(purpose) ? cur.filter((p) => p !== purpose) : [...cur, purpose];
    updateEntry(provider, { purpose_allowlist: next });
  }

  async function handlePreview() {
    try {
      const res = await socBrokerAdapter.previewSocBrokerConfig(config);
      setPreview({
        before: res.before || null,
        after: res.after || null,
        changeSummary: res.change_summary || [],
        validationErrors: res.validation_errors || [],
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("soc.broker.load_fail"));
    }
  }

  async function handleApply() {
    // B4.3 kill-switch 2 buoc (O-4): preview modal (buoc 1) + confirm destructive (buoc 2).
    if (!!config.kill_switch_write !== loadedKill) {
      const turningOn = !!config.kill_switch_write;
      const ok = await confirm({
        title: t("brokerWave4.ops.killTitle", { defaultValue: "Xác nhận kill-switch ghi" }),
        message: turningOn
          ? t("brokerWave4.ops.killOnBody", { defaultValue: "BẬT kill-switch: mọi lệnh ghi order/sync sẽ trả 503. Tiếp tục?" })
          : t("brokerWave4.ops.killOffBody", { defaultValue: "TẮT kill-switch: cho phép ghi trở lại. Tiếp tục?" }),
        confirmText: t("brokerWave4.ops.killConfirm", { defaultValue: "Xác nhận kill-switch" }),
        variant: "destructive",
      });
      if (!ok) return;
    }
    setApplying(true);
    try {
      const res = await socBrokerAdapter.applySocBrokerConfig(config, reason);
      setPreview(null);
      toast.success(t("soc.broker.apply_ok"));
      setReason("");
      await reload();
      void res;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("soc.broker.apply_fail"));
    } finally {
      setApplying(false);
    }
  }

  async function handleSaveCred() {
    let secrets: Record<string, unknown>;
    try {
      secrets = JSON.parse(credSecrets);
    } catch {
      setError(t("soc.broker.cred_json_invalid"));
      return;
    }
    try {
      await socBrokerAdapter.saveSocBrokerCredential(credProvider, secrets, credPurposes);
      toast.success(t("soc.broker.cred_saved"));
      setCredSecrets("{}");
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("soc.broker.apply_fail"));
    }
  }

  async function handleDeleteCred(provider: string) {
    const ok = await confirm({
      title: t("soc.broker.cred_delete"),
      message: t("soc.broker.cred_delete") + ` ${provider}?`,
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await socBrokerAdapter.deleteSocBrokerCredential(provider);
      toast.success(t("soc.broker.cred_deleted"));
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("soc.broker.apply_fail"));
    }
  }

  async function handleTest(provider: string) {
    setTesting(provider);
    try {
      await socBrokerAdapter.testSocBrokerConnection(provider);
      toast.success(t("soc.broker.test_queued"));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("soc.broker.apply_fail"));
    } finally {
      setTesting("");
    }
  }

  async function handleExportCsv() {
    // B4.3: CSV tu may chu (scope service, ≤5000 dong) thay vi dung client-side.
    try {
      await downloadSocCsv("/operator/soc/broker/audit/", { limit: 5000 }, "soc-broker-audit.csv");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("brokerWave4.ops.csvFail", {
        defaultValue: "Không tải được CSV từ máy chủ.",
      }));
    }
  }

  if (loading) {
    return e("div", { className: styles.glassPanel }, t("soc.broker.loading"));
  }

  const tag = locale === "en" ? "en-US" : "vi-VN";
  const entries = config.entries || {};

  return e("div", null,
    e("div", { className: styles.glassPanel },
      e("p", { className: styles.metricLabel }, "SOC / " + t("soc.broker.eyebrow")),
      e("h2", { className: styles.sectionCardTitle }, t("soc.broker.title")),
      e("p", { className: styles.metricLabel }, t("soc.broker.subtitle")),
    ),
    error ? e("p", { className: styles.inlineError }, error) : null,

    e("div", { className: styles.sectionCard },
      e("h3", { className: styles.sectionCardTitle }, t("soc.broker.config_title")),
      e(CommercialTable, {
        caption: t("soc.broker.table_caption"),
        columns: [
          { key: "provider", label: t("soc.broker.col_provider"), rowHeader: true },
          { key: "enabled", label: t("soc.broker.enabled") },
          { key: "routing", label: t("soc.broker.routing") },
          { key: "rpm", label: t("soc.broker.rpm") },
          { key: "purposes", label: t("soc.broker.purposes") },
        ],
        rows: PROVIDERS.map((p) => {
          const en = entries[p] || {};
          return {
            id: p,
            testId: `soc-broker-provider-${p}`,
            cells: {
              provider: e("strong", null, p.toUpperCase()),
              enabled: e("input", {
                type: "checkbox",
                checked: !!en.enabled,
                "aria-label": `${t("soc.broker.enabled")} — ${p.toUpperCase()}`,
                onChange: (ev: { target: { checked: boolean } }) => updateEntry(p, { enabled: ev.target.checked }),
              }),
              routing: e("input", {
                type: "number", min: 0, max: 9, value: en.routing_order ?? 0,
                "aria-label": `${t("soc.broker.routing")} — ${p.toUpperCase()}`,
                onChange: (ev: { target: { value: string } }) => updateEntry(p, { routing_order: Number(ev.target.value) }),
                className: styles.searchInput,
              }),
              rpm: e("input", {
                type: "number", min: 1, value: en.requests_per_minute ?? 60,
                "aria-label": `${t("soc.broker.rpm")} — ${p.toUpperCase()}`,
                onChange: (ev: { target: { value: string } }) => updateEntry(p, { requests_per_minute: Number(ev.target.value) }),
                className: styles.searchInput,
              }),
              purposes: e("span", { className: styles.brokerTileBadges },
                PURPOSES.map((pu) => e("label", { key: pu, className: styles.metricLabel },
                  e("input", {
                    type: "checkbox",
                    checked: (en.purpose_allowlist || []).includes(pu),
                    onChange: () => togglePurpose(p, pu),
                  }), " " + t(PURPOSE_LABELS[pu] || pu)))),
            },
          };
        }),
      }),

      e("div", { className: styles.brokerPolicyRow },
        e("label", { className: styles.metricLabel },
          e("input", {
            type: "checkbox", checked: !!config.kill_switch_write,
            onChange: (ev: { target: { checked: boolean } }) => setConfig((c) => ({ ...c, kill_switch_write: ev.target.checked })),
          }), " " + t("soc.broker.kill_switch")),
        e("span", { className: styles.metricLabel }, t("soc.broker.quiet") + " ",
          e("input", {
            type: "time", value: config.quiet_hours_start || "",
            placeholder: "17:00",
            "aria-label": `${t("soc.broker.quiet")} (bắt đầu)`,
            onChange: (ev: { target: { value: string } }) => setConfig((c) => ({ ...c, quiet_hours_start: ev.target.value })),
            className: styles.searchInput,
          }), " – ",
          e("input", {
            type: "time", value: config.quiet_hours_end || "",
            placeholder: "08:30",
            "aria-label": `${t("soc.broker.quiet")} (kết thúc)`,
            onChange: (ev: { target: { value: string } }) => setConfig((c) => ({ ...c, quiet_hours_end: ev.target.value })),
            className: styles.searchInput,
          })),
        e("input", {
          type: "text", value: reason, placeholder: t("soc.broker.reason_ph"),
          "aria-label": t("soc.broker.reason_ph"),
          onChange: (ev: { target: { value: string } }) => setReason(ev.target.value),
          className: styles.searchInput,
        }),
        e("div", { className: styles.brokerPolicyActions },
          e("button", { type: "button", className: styles.actionBtn, onClick: handlePreview },
            t("soc.broker.preview_btn")),
          e("button", { type: "button", className: styles.actionBtn, disabled: applying, onClick: handleApply },
            applying ? t("soc.broker.applying") : t("soc.broker.apply_btn")),
        ),
      ),
    ),

    e("div", { className: styles.sectionCard },
      e("h3", { className: styles.sectionCardTitle }, t("soc.broker.health_title")),
      e("div", { className: styles.metricGrid },
        (health.providers || []).map((p) => {
          const lane = p.lane || {};
          const runs = lane.runs_24h || {};
          const issues = lane.unresolved_issues || {};
          const last = lane.last_run;
          return e("div", { key: String(p.provider), className: styles.metricCard },
            e("p", { className: styles.metricLabel }, e("strong", null, String(p.provider).toUpperCase())),
            e("p", { className: styles.metricValue },
              (p.enabled ? "● " : "○ ") + (p.is_verified ? t("soc.broker.verified") : t("soc.broker.unverified"))),
            // Chi hien badge khi NOI them thong tin: "Chua xac minh" + badge "Chua xac minh ket noi" la LAP.
            p.needs_verification && (p.is_verified || p.stale_reason === "chua_cau_hinh")
              ? e("span", null, " ", expiryBadge(p.stale_reason))
              : null,
            e("p", { className: styles.metricLabel },
              `${wv("lastRun", "Lần chạy cuối")}: `,
              last
                ? `${last.status || "?"}${last.error ? ` — ${last.error}` : ""}`
                : wv("noRuns", "Chưa có lần chạy nào trong 24h.")),
            e("div", { className: styles.brokerLaneCard },
              e("div", { className: styles.brokerLaneRow },
                e("span", null, wv("runs24h", "Số lần chạy 24h")),
                e("span", null, `${fmtNum(runs.total)} (${wv("succeeded", "Thành công")} ${fmtNum(runs.succeeded)} / ${wv("failed", "Thất bại")} ${fmtNum(runs.failed)})`)),
              e("div", { className: styles.brokerLaneRow },
                e("span", null, wv("errorRate", "Tỉ lệ lỗi")),
                e("span", null, fmtPct(lane.error_rate_24h))),
              e("div", { className: styles.brokerLaneRow },
                e("span", null, wv("avgLatency", "Độ trễ TB")),
                e("span", null, lane.avg_latency_s_24h === null || lane.avg_latency_s_24h === undefined
                  ? "—" : `${Number(lane.avg_latency_s_24h).toFixed(1)}s`)),
              e("div", { className: styles.brokerLaneRow },
                e("span", null, wv("retriesCfg", "Retry cấu hình")),
                e("span", null, fmtNum(lane.retries_configured))),
              e("div", { className: styles.brokerLaneRow },
                e("span", null, wv("consecFails", "Lỗi liên tiếp")),
                e("span", null, fmtNum(lane.consecutive_failures))),
              e("div", { className: styles.brokerLaneRow },
                e("span", null, wv("unresolved", "Chưa xử lý")),
                e("span", null, `${fmtNum(issues.total)} (lỗi ${fmtNum(issues.error)})`)),
              e("div", { className: styles.brokerLaneRow },
                e("span", null, wv("queueDepth", "Độ sâu hàng đợi")),
                e("span", null, fmtNum(p.queue_depth)))),
            (lane.top_errors || []).length > 0
              ? e("p", { className: styles.metricLabel },
                  `${wv("topErrors", "Lỗi hàng đầu")}: `,
                  (lane.top_errors || []).map((te) => `${te.code} ×${te.count}`).join(" · "))
              : null,
            e("button", {
              type: "button", className: styles.actionBtn,
              disabled: testing === String(p.provider),
              onClick: () => handleTest(String(p.provider)),
            }, testing === String(p.provider) ? t("soc.broker.testing") : t("soc.broker.test_btn")),
          );
        })),
      Object.keys(health.queues || {}).length > 0
        ? e("div", { className: styles.metricCard },
            e("p", { className: styles.metricLabel }, e("strong", null, wv("queuesTitle", "Hàng đợi Celery"))),
            Object.entries(health.queues || {}).map(([q, d]) =>
              e("div", { key: q, className: styles.brokerLaneRow },
                e("span", null, q), e("span", null, fmtNum(d)))),
          )
        : e("div", { className: styles.metricCard },
            e("p", { className: styles.metricLabel }, e("strong", null, wv("queuesTitle", "Hàng đợi Celery"))),
            e("p", { className: styles.metricLabel }, t("soc.broker.no_queues")),
          ),
      (health.top_errors || []).length > 0
        ? e("div", { className: styles.metricCard },
            e("p", { className: styles.metricLabel }, e("strong", null, wv("topErrors", "Lỗi hàng đầu"))),
            (health.top_errors || []).map((te) =>
              e("div", { key: te.code || "", className: styles.brokerLaneRow },
                e("span", null, te.code || ""), e("span", null, `×${fmtNum(te.count)}`))),
          )
        : null,
    ),

    e("div", { className: styles.sectionCard },
      e("h3", { className: styles.sectionCardTitle }, t("soc.broker.cred_title")),
      creds.map((c) => e("div", { key: c.provider || "", className: styles.metricCard },
        e("p", { className: styles.metricLabel },
          e("strong", null, (c.provider || "").toUpperCase()), " · ",
          (c.allowed_purposes || []).map((pu) => t(PURPOSE_LABELS[pu] || pu)).join(", "), " · ",
          (c.is_verified ? t("soc.broker.verified") : t("soc.broker.unverified")), " · ",
          formatTime(c.last_verified_at, tag), " ",
          expiryBadge(c.needs_verification ? c.stale_reason : undefined)),
        e("p", { className: styles.metricLabel },
          Object.entries(c.preview || {}).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")),
        e("button", {
          type: "button", className: styles.actionBtn, onClick: () => handleDeleteCred(c.provider || ""),
        }, t("soc.broker.cred_delete")),
      )),
      e("div", { className: styles.metricCard },
        e("label", { className: styles.metricLabel }, t("soc.broker.cred_provider") + " ",
          e("select", {
            value: credProvider,
            onChange: (ev: { target: { value: string } }) => setCredProvider(ev.target.value),
          }, PROVIDERS.map((p) => e("option", { key: p, value: p }, p)))),
        e("textarea", {
          value: credSecrets,
          onChange: (ev: { target: { value: string } }) => setCredSecrets(ev.target.value),
          className: styles.configEditor, rows: 3,
        }),
        e("div", { className: styles.metricLabel }, t("soc.broker.purposes") + ": ",
          PURPOSES.map((pu) => e("label", { key: pu },
            e("input", {
              type: "checkbox", checked: credPurposes.includes(pu),
              onChange: () => setCredPurposes((cur) =>
                cur.includes(pu) ? cur.filter((x) => x !== pu) : [...cur, pu]),
            }), " " + pu + " "))),
        e("button", { type: "button", className: styles.actionBtn, onClick: handleSaveCred },
          t("soc.broker.cred_save")),
      ),
    ),

    e("div", { className: styles.sectionCard },
      e("h3", { className: styles.sectionCardTitle }, wv("auditTableTitle", "Nhật ký audit")),
      e("button", { type: "button", className: styles.actionBtn, onClick: handleExportCsv },
        wv("csvServer", "Tải CSV từ máy chủ (≤5000)")),
      audits.length === 0
        ? e("p", { className: styles.metricLabel }, t("soc.broker.audit_empty"))
        : e("table", null,
            e("thead", null, e("tr", null,
              e("th", null, wv("colTime", "Thời gian")),
              e("th", null, wv("colActor", "Người thực hiện")),
              e("th", null, wv("colAction", "Hành động")),
              e("th", null, wv("colSummary", "Tóm tắt thay đổi")),
              e("th", null, wv("colRequest", "Mã yêu cầu")))),
            e("tbody", null, audits.map((a, i) => e("tr", { key: i },
              e("td", null, formatTime(a.timestamp, tag)),
              e("td", null, a.actor || ""),
              e("td", null, a.action || ""),
              e("td", null, a.change_summary || ""),
              e("td", null, a.request_id || ""))))),
    ),

    preview ? e(SocConfigPreviewModal, {
      before: preview.before,
      after: preview.after,
      changeSummary: preview.changeSummary,
      validationErrors: preview.validationErrors,
      onConfirm: handleApply,
      onCancel: () => setPreview(null),
      loading: applying,
    }) : null,
  );
}

