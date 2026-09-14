import { createElement } from "react";
import { useI18n } from "../../context/LangContext.js";
import styles from "./soc.module.css";

interface SocConfigPreviewModalProps {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changeSummary?: string[];
  impactWarnings?: string[];
  validationErrors?: string[];
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function SocConfigPreviewModal({ before, after, changeSummary, impactWarnings, validationErrors, onConfirm, onCancel, loading }: SocConfigPreviewModalProps) {
  const { t } = useI18n();

  return createElement(
    "div",
    {
      className: styles.drawerOverlay,
      onClick: onCancel,
    },
    createElement(
      "div",
      {
        className: styles.glassPanel,
        
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
      },
      createElement(
        "div",
        { },
        createElement("h3", { }, t("soc.config_preview.title")),
        createElement(
          "button",
          {
            onClick: onCancel,
            },
          "\u2715",
        ),
      ),

      validationErrors && validationErrors.length > 0
        ? createElement(
            "div",
            { className: styles.inlineError,  },
            createElement("div", { }, t("soc.config_preview.validation_errors")),
            validationErrors.map((err, i) => createElement("div", { key: i, }, `\u2022 ${err}`)),
          )
        : null,

      impactWarnings && impactWarnings.length > 0
        ? createElement(
            "div",
            { className: styles.inlineError,  },
            createElement("div", { }, t("soc.config_preview.impact_warnings")),
            impactWarnings.map((w, i) => createElement("div", { key: i, }, `\u26A0 ${w}`)),
          )
        : null,

      changeSummary && changeSummary.length > 0
        ? createElement(
            "div",
            { },
            createElement("div", { }, t("soc.config_preview.changes")),
            createElement(
              "div",
              { },
              changeSummary.map((c, i) => createElement("div", { key: i, }, c)),
            ),
          )
        : null,

      createElement(
        "div",
        { },
        createElement(
          "div",
          null,
          createElement("div", { }, t("soc.config_preview.before")),
          createElement("pre", { className: styles.jsonBlock }, JSON.stringify(before || {}, null, 2)),
        ),
        createElement(
          "div",
          null,
          createElement("div", { }, t("soc.config_preview.after")),
          createElement("pre", { className: styles.jsonBlock }, JSON.stringify(after || {}, null, 2)),
        ),
      ),
      createElement(
        "div",
        { },
        createElement(
          "button",
          {
            onClick: onCancel,
            disabled: loading,
            className: styles.actionBtn,
            
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
