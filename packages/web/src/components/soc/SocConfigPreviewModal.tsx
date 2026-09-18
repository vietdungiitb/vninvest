import { createElement } from "react";
import { useI18n } from "../../context/LangContext.js";
import { changedLeafKeys, type DiffRow } from "../../lib/diffUtil.js";
import styles from "./soc.module.css";

interface SocConfigPreviewModalProps {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changeSummary?: string[];
  impactWarnings?: string[];
  validationErrors?: string[];
  diff?: DiffRow[];
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

function impactClass(impact: DiffRow["impact"]): string {
  if (impact === "invalid") return `${styles.impactBadge} ${styles.impactInvalid}`;
  if (impact === "runtime_risk") return `${styles.impactBadge} ${styles.impactRisk}`;
  return styles.impactBadge;
}

function renderJson(
  value: Record<string, unknown> | null | undefined,
  changedLeaves: Set<string>,
  side: "before" | "after",
) {
  const raw = JSON.stringify(value || {}, null, 2);
  const lines = raw.split("\n");
  return createElement(
    "pre",
    { className: styles.jsonBlock },
    lines.map((line, i) => {
      const match = line.match(/"([^"]+)"\s*:/);
      const changed = match ? changedLeaves.has(match[1]) : false;
      const lineClass = changed
        ? side === "before"
          ? styles.jsonLineBefore
          : styles.jsonLineAfter
        : undefined;
      return createElement("div", { key: i, className: lineClass }, line);
    }),
  );
}

export function SocConfigPreviewModal({ before, after, changeSummary, impactWarnings, validationErrors, diff, onConfirm, onCancel, loading }: SocConfigPreviewModalProps) {
  const { t } = useI18n();
  const changedLeaves = diff ? changedLeafKeys(diff) : new Set<string>();

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
            { className: styles.inlineError, role: "alert" },
            createElement("div", { }, `\u26A0 ${t("soc.config_preview.validation_errors")}`),
            validationErrors.map((err, i) => createElement("div", { key: i, }, `\u2022 ${err}`)),
          )
        : null,

      impactWarnings && impactWarnings.length > 0
        ? createElement(
            "div",
            { className: styles.inlineError, role: "alert" },
            createElement("div", { }, `\u26A0 ${t("soc.config_preview.impact_warnings")}`),
            impactWarnings.map((w, i) => createElement("div", { key: i, }, `\u26A0 ${w}`)),
          )
        : null,

      diff && diff.length > 0
        ? createElement(
            "div",
            { className: styles.diffTableWrap },
            createElement("div", { className: styles.diffTableHeader }, t("soc.config_preview.changes")),
            createElement(
              "table",
              { className: styles.diffTable },
              createElement(
                "thead",
                null,
                createElement(
                  "tr",
                  null,
                  createElement("th", null, t("soc.config_preview.col_field")),
                  createElement("th", null, t("soc.config_preview.col_before_after")),
                  createElement("th", null, t("soc.config_preview.col_impact")),
                ),
              ),
              createElement(
                "tbody",
                null,
                diff.map((row) =>
                  createElement(
                    "tr",
                    { key: row.key },
                    createElement("td", { className: styles.diffCellKey }, row.key),
                    createElement(
                      "td",
                      null,
                      createElement("span", { className: styles.diffBefore }, row.before),
                      " \u2192 ",
                      createElement("span", { className: styles.diffAfter }, row.after),
                    ),
                    createElement(
                      "td",
                      null,
                      row.impact === "none"
                        ? "\u2014"
                        : createElement(
                            "span",
                            { className: impactClass(row.impact) },
                            row.impact === "invalid" ? t("soc.config_preview.impact_invalid") : t("soc.config_preview.impact_runtime_risk"),
                          ),
                    ),
                  ),
                ),
              ),
            ),
          )
        : changeSummary && changeSummary.length > 0
          ? createElement(
              "div",
              { },
              createElement("div", { }, t("soc.config_preview.changes")),
              createElement(
                "div",
                { },
                changeSummary.map((c, i) => createElement("div", { key: i }, c)),
              ),
            )
          : null,

      createElement(
        "div",
        { className: styles.diffJsonGrid },
        createElement(
          "div",
          null,
          createElement("div", { }, t("soc.config_preview.before")),
          renderJson(before, changedLeaves, "before"),
        ),
        createElement(
          "div",
          null,
          createElement("div", { }, t("soc.config_preview.after")),
          renderJson(after, changedLeaves, "after"),
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
