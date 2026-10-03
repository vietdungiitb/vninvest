import { createElement, useCallback, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { useToast } from "../../components/ShellToast.js";
import { useConfirm } from "../../components/ConfirmModal.js";
import { SocConfigPreviewModal } from "./SocConfigPreviewModal.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
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
  getSocBrokerHealth: () => Promise<{
    kill_switch_write?: boolean; providers?: Array<Record<string, unknown>>;
  }>;
  getSocBrokerCredentials: () => Promise<{ credentials?: BrokerCredential[] }>;
  saveSocBrokerCredential: (provider: string, secrets: Record<string, unknown>, purposes: string[]) => Promise<unknown>;
  deleteSocBrokerCredential: (provider: string) => Promise<unknown>;
  testSocBrokerConnection: (provider: string) => Promise<{ job_id?: string }>;
};

const PROVIDERS = ["dnse", "ssi", "tcbs"];
const PURPOSES = ["backfill", "snapshot", "signal"];

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
  const [health, setHealth] = useState<{ kill_switch_write?: boolean; providers?: Array<Record<string, unknown>> }>({});
  const [creds, setCreds] = useState<BrokerCredential[]>([]);
  const [audits, setAudits] = useState<BrokerAudit[]>([]);
  const [preview, setPreview] = useState<{
    before: Record<string, unknown> | null; after: Record<string, unknown> | null;
    changeSummary: string[]; validationErrors: string[];
  } | null>(null);
  const [applying, setApplying] = useState(false);
  const [credProvider, setCredProvider] = useState("dnse");
  const [credSecrets, setCredSecrets] = useState("{}");
  const [credPurposes, setCredPurposes] = useState<string[]>(["backfill"]);
  const [testing, setTesting] = useState("");

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

  function handleExportCsv() {
    const rows: string[][] = [["time", "actor", "action", "summary"],
      ...audits.map((a) => [a.timestamp || "", a.actor || "", a.action || "",
        (a.change_summary || "").replace(/[\r\n]+/g, " ")])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "soc-broker-audit.csv";
    link.click();
    URL.revokeObjectURL(url);
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
      PROVIDERS.map((p) => {
        const en = entries[p] || {};
        return e("div", { key: p, className: styles.metricCard },
          e("p", { className: styles.metricLabel }, e("strong", null, p.toUpperCase())),
          e("label", { className: styles.metricLabel },
            e("input", {
              type: "checkbox", checked: !!en.enabled,
              onChange: (ev: { target: { checked: boolean } }) => updateEntry(p, { enabled: ev.target.checked }),
            }), " " + t("soc.broker.enabled")),
          e("label", { className: styles.metricLabel }, t("soc.broker.routing") + " ",
            e("input", {
              type: "number", min: 0, max: 9, value: en.routing_order ?? 0,
              onChange: (ev: { target: { value: string } }) => updateEntry(p, { routing_order: Number(ev.target.value) }),
              className: styles.searchInput,
            })),
          e("label", { className: styles.metricLabel }, t("soc.broker.rpm") + " ",
            e("input", {
              type: "number", min: 1, value: en.requests_per_minute ?? 60,
              onChange: (ev: { target: { value: string } }) => updateEntry(p, { requests_per_minute: Number(ev.target.value) }),
              className: styles.searchInput,
            })),
          e("div", { className: styles.metricLabel }, t("soc.broker.purposes") + ": ",
            PURPOSES.map((pu) => e("label", { key: pu },
              e("input", {
                type: "checkbox",
                checked: (en.purpose_allowlist || []).includes(pu),
                onChange: () => togglePurpose(p, pu),
              }), " " + pu + " "))),
        );
      }),
      e("label", { className: styles.metricLabel },
        e("input", {
          type: "checkbox", checked: !!config.kill_switch_write,
          onChange: (ev: { target: { checked: boolean } }) => setConfig((c) => ({ ...c, kill_switch_write: ev.target.checked })),
        }), " " + t("soc.broker.kill_switch")),
      e("div", { className: styles.metricLabel },
        t("soc.broker.quiet") + " ",
        e("input", {
          type: "text", value: config.quiet_hours_start || "",
          onChange: (ev: { target: { value: string } }) => setConfig((c) => ({ ...c, quiet_hours_start: ev.target.value })),
          className: styles.searchInput,
        }), " – ",
        e("input", {
          type: "text", value: config.quiet_hours_end || "",
          onChange: (ev: { target: { value: string } }) => setConfig((c) => ({ ...c, quiet_hours_end: ev.target.value })),
          className: styles.searchInput,
        })),
      e("input", {
        type: "text", value: reason, placeholder: t("soc.broker.reason_ph"),
        onChange: (ev: { target: { value: string } }) => setReason(ev.target.value),
        className: styles.searchInput,
      }),
      e("div", null,
        e("button", { type: "button", className: styles.actionBtn, onClick: handlePreview },
          t("soc.broker.preview_btn")),
        e("button", { type: "button", className: styles.actionBtn, disabled: applying, onClick: handleApply },
          applying ? t("soc.broker.applying") : t("soc.broker.apply_btn")),
      ),
    ),

    e("div", { className: styles.sectionCard },
      e("h3", { className: styles.sectionCardTitle }, t("soc.broker.health_title")),
      e("div", { className: styles.metricGrid },
        (health.providers || []).map((p) => e("div", { key: String(p.provider), className: styles.metricCard },
          e("p", { className: styles.metricLabel }, e("strong", null, String(p.provider).toUpperCase())),
          e("p", { className: styles.metricValue },
            (p.enabled ? "● " : "○ ") + (p.is_verified ? t("soc.broker.verified") : t("soc.broker.unverified"))),
          e("button", {
            type: "button", className: styles.actionBtn,
            disabled: testing === String(p.provider),
            onClick: () => handleTest(String(p.provider)),
          }, testing === String(p.provider) ? t("soc.broker.testing") : t("soc.broker.test_btn")),
        ))),
    ),

    e("div", { className: styles.sectionCard },
      e("h3", { className: styles.sectionCardTitle }, t("soc.broker.cred_title")),
      creds.map((c) => e("div", { key: c.provider || "", className: styles.metricCard },
        e("p", { className: styles.metricLabel },
          e("strong", null, (c.provider || "").toUpperCase()), " · ",
          (c.allowed_purposes || []).join(","), " · ",
          (c.is_verified ? t("soc.broker.verified") : t("soc.broker.unverified")), " · ",
          formatTime(c.last_verified_at, tag)),
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
      e("h3", { className: styles.sectionCardTitle }, t("soc.broker.audit_title")),
      e("button", { type: "button", className: styles.actionBtn, onClick: handleExportCsv },
        t("soc.broker.export_csv")),
      audits.length === 0
        ? e("p", { className: styles.metricLabel }, t("soc.broker.audit_empty"))
        : e("table", null,
            e("tbody", null, audits.map((a, i) => e("tr", { key: i },
              e("td", null, formatTime(a.timestamp, tag)),
              e("td", null, a.actor || ""),
              e("td", null, a.change_summary || ""))))),
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

