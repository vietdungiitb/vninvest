import { createElement } from "react";
import { useI18n } from "../../context/LangContext.js";
import styles from "./soc.module.css";

interface SocConfigPreviewModalProps {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  validationErrors?: string[];
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function SocConfigPreviewModal({ before, after, validationErrors, onConfirm, onCancel, loading }: SocConfigPreviewModalProps) {
  const { t } = useI18n();

  return createElement(
    "div",
    {
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
      },
      onClick: onCancel,
    },
    createElement(
      "div",
      {
        className: styles.glassPanel,
        style: {
          width: "90%",
          maxWidth: "720px",
          maxHeight: "80vh",
          overflow: "auto",
          position: "relative",
        },
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
      },
      createElement(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" } },
        createElement("h3", { style: { margin: 0, fontSize: "1.1rem", fontWeight: 700 } }, t("soc.config_preview.title")),
        createElement(
          "button",
          {
            onClick: onCancel,
            style: {
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              fontSize: "1.2rem",
              cursor: "pointer",
              padding: "0.25rem 0.5rem",
            },
          },
          "\u2715",
        ),
      ),
      validationErrors && validationErrors.length > 0
        ? createElement(
            "div",
            { className: styles.inlineError, style: { marginBottom: "1rem" } },
            createElement("div", { style: { fontWeight: 700, marginBottom: "0.25rem" } }, t("soc.config_preview.validation_errors")),
            validationErrors.map((err, i) => createElement("div", { key: i, style: { fontSize: "0.75rem" } }, `\u2022 ${err}`)),
          )
        : null,
      createElement(
        "div",
        { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" } },
        createElement(
          "div",
          null,
          createElement("div", { style: { fontWeight: 700, fontSize: "0.8rem", marginBottom: "0.5rem", color: "var(--text-muted)" } }, t("soc.config_preview.before")),
          createElement("pre", { className: styles.jsonBlock }, JSON.stringify(before || {}, null, 2)),
        ),
        createElement(
          "div",
          null,
          createElement("div", { style: { fontWeight: 700, fontSize: "0.8rem", marginBottom: "0.5rem", color: "var(--accent-cyan)" } }, t("soc.config_preview.after")),
          createElement("pre", { className: styles.jsonBlock }, JSON.stringify(after || {}, null, 2)),
        ),
      ),
      createElement(
        "div",
        { style: { display: "flex", justifyContent: "flex-end", gap: "0.75rem" } },
        createElement(
          "button",
          {
            onClick: onCancel,
            disabled: loading,
            className: styles.actionBtn,
            style: { background: "rgba(100, 116, 139, 0.15)", color: "var(--text-muted)" },
          },
          t("soc.actions.cancel"),
        ),
        createElement(
          "button",
          {
            onClick: onConfirm,
            disabled: loading,
            className: styles.actionBtn,
            style: {
              background: "rgba(22, 215, 160, 0.2)",
              color: "var(--accent-emerald)",
              cursor: loading ? "not-allowed" : "pointer",
            },
          },
          loading ? t("soc.actions.saving") : t("soc.config_preview.confirm_apply"),
        ),
      ),
    ),
  );
}
