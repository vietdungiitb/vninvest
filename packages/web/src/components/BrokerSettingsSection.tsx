/**
 * mbw3 FE-MERGE: bề mặt cấu hình broker cũ (form DNSE/SSI/TCBS tại chỗ).
 *
 * Kể từ Wave 3, cấu hình broker hợp nhất về `/broker` (Broker Hub — một bề
 * mặt duy nhất); `UserSettingsPage` chỉ còn khối dẫn link
 * (`brokerWave3.settings.*`), không còn form thứ 2. Component này GIỮ NGUYÊN
 * hành vi (không xoá — test `BrokerSettingsSection.component.test.tsx` khoá)
 * và không còn được mount ở route app nào; redirect cũ
 * `/portfolios/manage/broker` → `/broker` giữ trong `main.tsx`.
 */
import { ChangeEvent, FormEvent, createElement, useCallback, useEffect, useRef, useState } from "react";
import styles from "./aiSettings.module.css";

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useI18n } from "../context/LangContext.js";
import { useConfirm } from "./ConfirmModal.js";

const e = createElement;

interface BrokerProviderItem {
  id: string;
  status: string;
  is_configured: boolean;
}

interface BrokerField {
  key: string;
  type: string;
  required: boolean;
  secret: boolean;
  label_i18n: string;
  placeholder?: string;
  help_i18n?: string;
}

interface BrokerSchema {
  provider: string;
  test_connection_kind: string;
  fields: BrokerField[];
}

interface BrokerConfigState {
  is_configured: boolean;
  provider?: string;
  label?: string;
  status?: string;
  preview?: Record<string, unknown>;
  last_verified_at?: string | null;
  last_error?: string;
}

interface BrokerApi {
  getBrokerProviders: () => Promise<{ providers?: BrokerProviderItem[] }>;
  getBrokerSchema: (provider: string) => Promise<BrokerSchema>;
  getBrokerConfig: (provider: string) => Promise<BrokerConfigState>;
  saveBrokerConfig: (provider: string, data: Record<string, string>) => Promise<BrokerConfigState>;
  deleteBrokerConfig: (provider: string) => Promise<unknown>;
  testBrokerConnection: (provider: string) => Promise<{ job_id?: string }>;
  getBrokerJob: (jobId: string) => Promise<{ state?: string; result?: Record<string, unknown>; error?: string }>;
}

const brokerAdapter = coreApiAdapter as unknown as BrokerApi;

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_TRIES = 15;

function formatTime(iso?: string | null, locale = "vi-VN"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(locale);
}

export function BrokerSettingsSection({ className = "" }: { className?: string }) {
  const { t, locale } = useI18n();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [providers, setProviders] = useState<BrokerProviderItem[]>([]);
  const [selected, setSelected] = useState("dnse");
  const [schema, setSchema] = useState<BrokerSchema | null>(null);
  const [config, setConfig] = useState<BrokerConfigState | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const mountedRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  const loadProviders = useCallback(async () => {
    try {
      const res = await brokerAdapter.getBrokerProviders();
      if (!mountedRef.current) return;
      setProviders(res.providers || []);
    } catch {
      if (mountedRef.current) setProviders([]);
    }
  }, []);

  const loadDetail = useCallback(async (provider: string) => {
    // NOTE: không setMsg/setError(null) ở đây — loadDetail còn được gọi refresh sau
    // test-connection/save/delete, và clear sẽ nuốt message vừa set (bug đã bắt bằng test).
    setLoading(true);
    try {
      const [sch, cfg] = await Promise.all([
        brokerAdapter.getBrokerSchema(provider),
        brokerAdapter.getBrokerConfig(provider),
      ]);
      if (!mountedRef.current) return;
      setSchema(sch);
      setConfig(cfg);
      const init: Record<string, string> = {};
      for (const f of sch.fields || []) init[f.key] = "";
      setForm(init);
      setFieldErrors({});
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setError(err && typeof err === "object" && "message" in err
        ? (err as Error).message
        : t("broker.load_failed"));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    mountedRef.current = true;
    loadProviders();
    return () => { mountedRef.current = false; };
  }, [loadProviders]);

  useEffect(() => {
    setError(null);
    setMsg(null);
    loadDetail(selected);
  }, [selected, loadDetail]);

  function handleChange(ev: ChangeEvent<HTMLInputElement>) {
    const { name, value } = ev.target;
    setForm((f) => ({ ...f, [name]: value }));
    setFieldErrors((fe) => ({ ...fe, [name]: false }));
  }

  async function handleSave(ev: FormEvent) {
    ev.preventDefault();
    if (!schema) return;
    const bad: Record<string, boolean> = {};
    for (const f of schema.fields) {
      if (f.required && !(form[f.key] || "").trim()) bad[f.key] = true;
    }
    setFieldErrors(bad);
    if (Object.keys(bad).length > 0) return;
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      await brokerAdapter.saveBrokerConfig(selected, form);
      if (!mountedRef.current) return;
      setMsg(t("broker.form_saved"));
      const init: Record<string, string> = {};
      for (const f of schema.fields) init[f.key] = "";
      setForm(init);
      await loadDetail(selected);
      await loadProviders();
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setError(err && typeof err === "object" && "message" in err
        ? (err as Error).message
        : t("broker.save_failed"));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: t("broker.confirm_delete_title"),
      message: t("broker.confirm_delete_title") + "?",
      variant: "destructive",
    });
    if (!ok) return;
    setDeleting(true);
    setError(null);
    setMsg(null);
    try {
      await brokerAdapter.deleteBrokerConfig(selected);
      if (!mountedRef.current) return;
      setMsg(t("broker.form_deleted"));
      await loadDetail(selected);
      await loadProviders();
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setError(err && typeof err === "object" && "message" in err
        ? (err as Error).message
        : t("broker.delete_failed"));
    } finally {
      if (mountedRef.current) setDeleting(false);
    }
  }

  async function handleTest() {
    stopPoll();
    setTesting(true);
    setError(null);
    setMsg(null);
    try {
      const started = await brokerAdapter.testBrokerConnection(selected);
      const jobId = started.job_id;
      if (!jobId) throw new Error(t("broker.test_failed"));
      let tries = 0;
      pollRef.current = setInterval(async () => {
        tries += 1;
        try {
          const job = await brokerAdapter.getBrokerJob(jobId);
          if (!mountedRef.current) return;
          if (job.state === "succeeded") {
            stopPoll();
            setTesting(false);
            const count = job.result && typeof job.result.account_count === "number"
              ? ` (${job.result.account_count})` : "";
            setMsg(t("broker.test_ok") + count);
            await loadDetail(selected);
            await loadProviders();
          } else if (job.state === "failed" || tries >= POLL_MAX_TRIES) {
            stopPoll();
            setTesting(false);
            setError(job.error || t("broker.poll_timeout"));
            await loadDetail(selected);
          }
        } catch {
          if (tries >= POLL_MAX_TRIES && mountedRef.current) {
            stopPoll();
            setTesting(false);
            setError(t("broker.poll_timeout"));
          }
        }
      }, POLL_INTERVAL_MS);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setTesting(false);
      setError(err && typeof err === "object" && "message" in err
        ? (err as Error).message
        : t("broker.test_failed"));
    }
  }

  const selectedInfo = providers.find((p) => p.id === selected);
  const selectable = providers.length > 0 ? providers : [
    { id: "dnse", status: "never_connected", is_configured: false },
    { id: "ssi", status: "not_supported_yet", is_configured: false },
    { id: "tcbs", status: "not_supported_yet", is_configured: false },
  ];

  return e("section", { className: styles.panel + " " + className },
    e("h2", { className: styles.panelTitle }, t("broker.title")),
    e("p", { className: styles.panelSubtitle }, t("broker.subtitle")),

    error ? e("p", { className: styles.alert + " " + styles.alertError }, error) : null,
    msg ? e("p", { className: styles.alert + " " + styles.alertSuccess }, msg) : null,

    e("div", { className: styles.toolbar, key: "tiles" },
      selectable.map((p) => {
        const pending = p.status === "not_supported_yet";
        return e("button", {
          type: "button",
          key: p.id,
          disabled: pending,
          className: styles.btn + " " + (selected === p.id ? styles.btnActive : styles.btnGhost),
          onClick: () => setSelected(p.id),
          title: pending ? t("broker.tile_coming_soon") : t("broker.name_" + p.id),
        }, t("broker.name_" + p.id) + (pending ? " (" + t("broker.tile_coming_soon") + ")" : ""));
      }),
    ),

    loading ? e("p", { className: styles.loading }, t("broker.loading")) : null,

    !loading && schema ? e("div", { key: "detail" },
      e("p", { className: styles.metricLabel },
        e("strong", null, t("broker.status_label") + ": "),
        t("broker.status_" + (config?.status || selectedInfo?.status || "never_connected")),
        config?.preview && Object.keys(config.preview).length > 0
          ? " — " + Object.entries(config.preview)
              .map(([k, v]) => `${k}: ${String(v)}`).join(" · ")
          : "",
      ),
      e("p", { className: styles.metricLabel },
        e("strong", null, t("broker.last_verified") + ": "),
        config?.last_verified_at
          ? formatTime(config.last_verified_at, locale === "en" ? "en-US" : "vi-VN")
          : t("broker.never_verified"),
      ),
      config?.last_error
        ? e("p", { className: styles.alert + " " + styles.alertError }, config.last_error)
        : null,

      e("form", { className: styles.formGrid, onSubmit: handleSave },
        schema.fields.map((f) =>
          e("div", { className: styles.field, key: f.key },
            e("label", { className: styles.label },
              t(f.label_i18n) + (f.required ? " *" : "")),
            e("input", {
              name: f.key,
              type: f.secret ? "password" : "text",
              autoComplete: f.secret ? "new-password" : "off",
              className: styles.input,
              value: form[f.key] || "",
              onChange: handleChange,
              placeholder: f.placeholder || "",
            }),
            f.help_i18n ? e("p", { className: styles.helpText }, t(f.help_i18n)) : null,
            fieldErrors[f.key]
              ? e("p", { className: styles.alert + " " + styles.alertError }, t("broker.field_required"))
              : null,
          ),
        ),
        e("div", { className: styles.toolbar, key: "actions" },
          e("button", {
            type: "submit",
            className: styles.btn + " " + styles.btnPrimary,
            disabled: saving,
          }, saving ? t("broker.form_saving") : t("broker.form_save")),
          e("button", {
            type: "button",
            className: styles.btn + " " + styles.btnGhost,
            disabled: testing,
            onClick: handleTest,
          }, testing ? t("broker.testing") : t("broker.test_button")),
          config?.is_configured
            ? e("button", {
                type: "button",
                className: styles.btn + " " + styles.btnDanger,
                disabled: deleting,
                onClick: handleDelete,
              }, deleting ? t("broker.form_deleting") : t("broker.form_delete"))
            : null,
        ),
      ),
    ) : null,
  );
}
