import { ChangeEvent, FormEvent, createElement, useCallback, useEffect, useRef, useState } from "react";
import styles from "./aiSettings.module.css";

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useI18n } from "../context/LangContext.js";

const e = createElement;

interface DnseCredentialState {
  is_configured: boolean;
  data?: {
    client_id_preview?: string;
    is_active?: boolean;
    last_sync_at?: string | null;
  };
}

interface DnseFormState {
  client_id: string;
  client_secret: string;
}

function formatSyncTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN");
}

export function DNSECredentialsSection({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [credential, setCredential] = useState<DnseCredentialState | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DnseFormState>({ client_id: "", client_secret: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: DnseCredentialState = await coreApiAdapter.getDNSEConfig();
      if (!mountedRef.current) return;
      setCredential(res);
      if (res.is_configured) {
        setShowForm(false);
      }
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setError(err && typeof err === "object" && "message" in err ? (err as Error).message : "Không thể tải cấu hình DNSE.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    reload();
    return () => { mountedRef.current = false; };
  }, [reload]);

  function handleChange(ev: ChangeEvent<HTMLInputElement>) {
    const { name, value } = ev.target;
    setForm((f) => ({ ...f, [name]: value } as DnseFormState));
  }

  async function handleSave(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      await coreApiAdapter.updateDNSEConfig(form);
      setMsg(t("settings.dnseSaved"));
      setForm({ client_id: "", client_secret: "" });
      await reload();
    } catch (err: unknown) {
      setError(err && typeof err === "object" && "message" in err ? (err as Error).message : "Không thể lưu credentials DNSE.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (typeof window !== "undefined" && !window.confirm(t("settings.dnseDeleteBtn") + "?")) return;
    setDeleting(true);
    setError(null);
    setMsg(null);
    try {
      await coreApiAdapter.deleteDNSEConfig();
      setMsg(t("settings.dnseDeleted"));
      await reload();
    } catch (err: unknown) {
      setError(err && typeof err === "object" && "message" in err ? (err as Error).message : "Không thể xoá credentials DNSE.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return e("div", { className: styles.panel + " " + className },
      e("p", { className: styles.loading }, "Đang tải cấu hình DNSE...")
    );
  }

  const isConfigured = !!credential?.is_configured;
  const isActive = !!credential?.data?.is_active;
  const syncTime = formatSyncTime(credential?.data?.last_sync_at);

  return e("section", { className: styles.panel + " " + className },
    e("h2", { className: styles.panelTitle }, t("settings.dnseTitle")),
    e("p", { className: styles.panelSubtitle }, t("settings.dnseDescription")),

    error ? e("p", { className: styles.alert + " " + styles.alertError }, error) : null,
    msg ? e("p", { className: styles.alert + " " + styles.alertSuccess }, msg) : null,

    isConfigured && !showForm
      ? e("div", { className: styles.metricGrid },
          e("div", { className: styles.metricCard }, [
            e("span", {
              key: "badge",
              className: styles.badge + " " + (isActive ? styles.badgeActive : styles.badgeInactive),
            }, isActive ? t("settings.dnseActive") : t("settings.dnseInactive")),
          ]),
          credential?.data?.client_id_preview
            ? e("p", { className: styles.metricLabel, key: "preview" },
                e("strong", null, t("settings.dnseClientIdPreview") + ": "),
                credential.data.client_id_preview,
              )
            : null,
          syncTime
            ? e("p", { className: styles.metricLabel, key: "sync" },
                e("strong", null, t("settings.dnseLastSync") + ": "),
                syncTime,
              )
            : e("p", { className: styles.metricLabel, key: "sync" }, t("settings.dnseNeverSynced")),
          e("div", { className: styles.toolbar, key: "actions" },
            e("button", {
              type: "button",
              className: styles.btn + " " + styles.btnPrimary,
              onClick: () => setShowForm(true),
            }, t("settings.dnseSaveBtn")),
            e("button", {
              type: "button",
              className: styles.btn + " " + styles.btnDanger,
              disabled: deleting,
              onClick: handleDelete,
            }, deleting ? t("settings.dnseDeleting") : t("settings.dnseDeleteBtn")),
          ),
        )
      : e("form", { className: styles.formGrid, onSubmit: handleSave }, [
          e("div", { className: styles.field, key: "client-id" },
            e("label", { className: styles.label }, t("settings.dnseClientId")),
            e("input", {
              name: "client_id",
              type: "text",
              autoComplete: "off",
              className: styles.input,
              value: form.client_id,
              onChange: handleChange,
              placeholder: "xxxxxxxx-xxxx-xxxx",
            }),
          ),
          e("div", { className: styles.field, key: "client-secret" },
            e("label", { className: styles.label }, t("settings.dnseClientSecret")),
            e("input", {
              name: "client_secret",
              type: "password",
              autoComplete: "new-password",
              className: styles.input,
              value: form.client_secret,
              onChange: handleChange,
            }),
          ),
          e("p", { className: styles.helpText, key: "notice" }, t("settings.dnseManageNotice")),
          e("div", { className: styles.toolbar, key: "actions" }, [
            e("button", {
              type: "submit",
              className: styles.btn + " " + styles.btnPrimary,
              disabled: saving,
            }, saving ? t("settings.dnseSaving") : t("settings.dnseSaveBtn")),
            isConfigured
              ? e("button", {
                  type: "button",
                  className: styles.btn + " " + styles.btnGhost,
                  onClick: () => setShowForm(false),
                }, "Huỷ")
              : null,
          ]),
        ],
      )
  );
}
