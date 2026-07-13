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
      className: "s5_0_SocConfigPreviewModal", 
      onClick: onCancel,
    },
    createElement(
      "div",
      {
        className: `styles.glassPanel s5_1_SocConfigPreviewModal`,
        
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
      },
      createElement(
        "div",
        { className: "s5_2_SocConfigPreviewModal",  },
        createElement("h3", { className: "s5_3_SocConfigPreviewModal",  }, t("soc.config_preview.title")),
        createElement(
          "button",
          {
            onClick: onCancel,
            className: "s5_4_SocConfigPreviewModal", 
          },
          "\u2715",
        ),
      ),

      validationErrors && validationErrors.length > 0
        ? createElement(
            "div",
            { className: `styles.inlineError s5_5_SocConfigPreviewModal`,  },
            createElement("div", { className: "s5_6_SocConfigPreviewModal",  }, t("soc.config_preview.validation_errors")),
            validationErrors.map((err, i) => createElement("div", { key: i, className: "s5_7_SocConfigPreviewModal",  }, `\u2022 ${err}`)),
          )
        : null,

      impactWarnings && impactWarnings.length > 0
        ? createElement(
            "div",
            { className: `styles.inlineError s5_8_SocConfigPreviewModal`,  },
            createElement("div", { className: "s5_9_SocConfigPreviewModal",  }, t("soc.config_preview.impact_warnings")),
            impactWarnings.map((w, i) => createElement("div", { key: i, className: "s5_10_SocConfigPreviewModal",  }, `\u26A0 ${w}`)),
          )
        : null,

      changeSummary && changeSummary.length > 0
        ? createElement(
            "div",
            { className: "s5_11_SocConfigPreviewModal",  },
            createElement("div", { className: "s5_12_SocConfigPreviewModal",  }, t("soc.config_preview.changes")),
            createElement(
              "div",
              { className: "s5_13_SocConfigPreviewModal",  },
              changeSummary.map((c, i) => createElement("div", { key: i, className: "s5_14_SocConfigPreviewModal",  }, c)),
            ),
          )
        : null,

      createElement(
        "div",
        { className: "s5_15_SocConfigPreviewModal",  },
        createElement(
          "div",
          null,
          createElement("div", { className: "s5_16_SocConfigPreviewModal",  }, t("soc.config_preview.before")),
          createElement("pre", { className: styles.jsonBlock }, JSON.stringify(before || {}, null, 2)),
        ),
        createElement(
          "div",
          null,
          createElement("div", { className: "s5_17_SocConfigPreviewModal",  }, t("soc.config_preview.after")),
          createElement("pre", { className: styles.jsonBlock }, JSON.stringify(after || {}, null, 2)),
        ),
      ),
      createElement(
        "div",
        { className: "s5_18_SocConfigPreviewModal",  },
        createElement(
          "button",
          {
            onClick: onCancel,
            disabled: loading,
            className: `styles.actionBtn s5_19_SocConfigPreviewModal`,
            
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
