// @ts-check
import React from "react";
import { useI18n } from "../../context/LangContext.js";
import styles from "../../pages/AlertCenterPage.module.css";
import shell from "../../components/ShellPageTemplate.module.css";
import soc from "../../components/soc/soc.module.css";

const { createElement } = React;
const e = createElement;

/**
 * @typedef {Object} AlertCardProps
 * @property {Record<string, any>} alert
 * @property {string} [lane]
 * @property {string | number} [busyAlertId]
 * @property {boolean} [isEvidenceExpanded]
 * @property {(alertId: string) => void} toggleEvidence
 * @property {(alert: Record<string, any>) => void} handleLoadDetail
 * @property {(alert: Record<string, any>) => void} handleAcknowledge
 * @property {(alert: Record<string, any>) => void} handleMuteSymbol
 * @property {(value: unknown) => string} formatAlertValue
 * @property {(value: unknown) => string} formatAlertTimestamp
 * @property {import("react").CSSProperties} [style]
 */

/**
 * @param {Record<string, any>} evidence
 * @param {(key: string, vars?: Record<string, unknown>) => string} t
 */
function renderEvidenceList(evidence, t) {
  const entries = Object.entries(evidence || {}).filter(([, value]) => value != null && value !== "");
  if (entries.length === 0) {
    return e("ul", { key: "evidence-list", className: styles.acEvidenceList }, e("li", null, t("alertCenter.evidenceEmpty")));
  }

  return e(
    "ul",
    { key: "evidence-list", className: styles.acEvidenceList },
    entries.map(([key, value]) =>
      e("li", { key }, `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    )
  );
}

export const AlertCard = React.memo(function AlertCard(/** @type {AlertCardProps} */ props) {
  const {
    alert,
    lane,
    busyAlertId,
    isEvidenceExpanded,
    toggleEvidence,
    handleLoadDetail,
    handleAcknowledge,
    handleMuteSymbol,
    formatAlertValue,
    formatAlertTimestamp,
    style,
  } = props;
  const { t } = useI18n();
  const directionClass =
    String(alert?.direction || "").toLowerCase().includes("buy") || String(alert?.direction || "") === "mua"
      ? "direction-buy"
      : String(alert?.direction || "").toLowerCase().includes("sell") || String(alert?.direction || "") === "bán"
      ? "direction-sell"
      : "";

  const severity = alert.severity || "medium";

  return e("article", { className: `${styles.acCard} ${styles[`acCard${String(severity).charAt(0).toUpperCase() + String(severity).slice(1)}`] || ""}`.trim(), style: style || undefined }, [
    e("div", { key: "card-top", className: styles.acCardTop }, [
      e("div", { key: "meta-container" }, [
        e("h3", { key: "title", className: styles.acCardTitle }, alert.title || t("alertCenter.cardTitle")),
        e("p", { key: "meta", className: styles.acCardMeta }, [
          e("span", { key: "symbol", className: `${soc.statusBadge} ${styles.acSymbolBadge}` }, alert.symbol || "—"),
          e("span", { key: "family-lane" }, `· ${alert.alert_family || alert.alert_type || "—"} · Lane: ${alert.lane || lane}`),
        ]),
      ]),
      e(
        "span",
        { key: "severity", className: `${soc.statusBadge} ${styles[`acSev${String(severity).charAt(0).toUpperCase() + String(severity).slice(1)}`] || styles.acSevMedium}` },
        severity
      ),
    ]),
    e("p", { key: "summary", className: styles.acCardSummary }, alert.summary || alert.body || t("alertCenter.cardNoSummary")),

    alert._optimistic
      ? e(
          "span",
          { key: "opt-badge", className: styles.acPendingBadge },
          alert.acknowledged ? t("alertCenter.pendingAck") : t("alertCenter.pendingMute"),
        )
      : null,

    e("div", { key: "metrics", className: styles.acCardMetrics }, [
      e("span", { key: "val" }, [t("alertCenter.labelValue"), ": ", e("strong", null, `${formatAlertValue(alert.value)} VND`)]),
      e("span", { key: "dir" }, [t("alertCenter.labelDirection"), ": ", e("strong", { className: directionClass }, alert.direction || "—")]),
      e("span", { key: "conf" }, [t("alertCenter.labelConfidence"), ": ", e("strong", null, alert.confidence != null ? `${alert.confidence}` : "—")]),
      e("span", { key: "fresh" }, [t("alertCenter.labelFreshness"), ": ", e("strong", null, alert.freshness_state || "—")]),
      e("span", { key: "sess" }, [t("alertCenter.labelSession"), ": ", e("strong", null, alert.session_date || "—")]),
      e("span", { key: "time" }, [
        alert.executed_at ? t("alertCenter.labelExecuted") : t("alertCenter.labelTime"), ": ",
        e("strong", null, alert.executed_at ? formatAlertTimestamp(alert.executed_at) : formatAlertTimestamp(alert.triggered_at)),
      ]),
    ]),

    alert.evidence && Object.keys(alert.evidence).length > 0 ? e("div", { key: "evidence-wrapper" }, [
      e(
        "button",
        { key: "evidence-hdr", type: "button", className: styles.acEvidenceHeader, onClick: () => toggleEvidence(alert.alert_id) },
        [
          e("span", { key: "lbl" }, t("alertCenter.evidenceView")),
          e("span", { key: "icon" }, isEvidenceExpanded ? t("alertCenter.evidenceHide") : t("alertCenter.evidenceShow")),
        ]
      ),
      isEvidenceExpanded ? renderEvidenceList(alert.evidence, t) : null,
    ]) : null,

    e("div", { key: "actions", className: styles.acCardActions }, [
      e(
        "button",
        {
          key: "btn-detail",
          type: "button",
        className: `${shell.buttonPrimary} ${styles.acBtn}`,
        disabled: busyAlertId === alert.alert_id,
        onClick: () => handleLoadDetail(alert),
      },
      busyAlertId === alert.alert_id ? t("alertCenter.btnDetailLoading") : t("alertCenter.btnDetail")
    ),
    lane === "main"
      ? e(
          "button",
          {
            key: "btn-ack",
            type: "button",
            className: `${shell.buttonSecondary} ${styles.acBtn}`,
            disabled: busyAlertId === alert.alert_id,
            onClick: () => handleAcknowledge(alert),
          },
          t("alertCenter.btnAck")
        )
      : null,
    e(
      "button",
      {
        key: "btn-mute",
        type: "button",
        className: `${shell.buttonSecondary} ${styles.acBtn}`,
          disabled: busyAlertId === (alert.alert_id || alert.symbol),
          onClick: () => handleMuteSymbol(alert),
        },
        t("alertCenter.btnMute")
      ),
    ]),
  ]);
});
