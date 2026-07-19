import React from "react";
import { useI18n } from "../../context/LangContext.js";
import styles from "../../pages/AlertCenterPage.module.css";

const { createElement } = React;
const e = createElement;

function renderEvidenceList(evidence) {
  const entries = Object.entries(evidence || {}).filter(([, value]) => value != null && value !== "");
  if (entries.length === 0) {
    return e("ul", { key: "evidence-list", className: styles["core-alert-center-evidence-list"] }, e("li", null, t("alertCenter.evidenceEmpty")));
  }

  return e(
    "ul",
    { key: "evidence-list", className: styles["core-alert-center-evidence-list"] },
    entries.map(([key, value]) =>
      e("li", { key }, `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    )
  );
}

export function AlertCard({
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
}) {
  const { t } = useI18n();
  const directionClass =
    String(alert?.direction || "").toLowerCase().includes("buy") || String(alert?.direction || "") === "mua"
      ? "direction-buy"
      : String(alert?.direction || "").toLowerCase().includes("sell") || String(alert?.direction || "") === "bán"
      ? "direction-sell"
      : "";

  return e("article", { className: `${styles["core-alert-center-card"]} severity-${alert.severity || "medium"}` }, [
    e("div", { key: "card-top", className: styles["core-alert-center-card-top"] }, [
      e("div", { key: "meta-container" }, [
        e("h3", { key: "title", className: styles["core-alert-center-card-title"] }, alert.title || t("alertCenter.cardTitle")),
        e("p", { key: "meta", className: styles["core-alert-center-card-meta"] }, [
          e("span", { key: "symbol", className: styles["core-alert-symbol-badge"] }, alert.symbol || "—"),
          e("span", { key: "family-lane" }, `· ${alert.alert_family || alert.alert_type || "—"} · Lane: ${alert.lane || lane}`),
        ]),
      ]),
      e(
        "span",
        { key: "severity", className: `${styles["core-alert-center-badge"]} severity-${alert.severity || "medium"}` },
        alert.severity || "medium"
      ),
    ]),
    e("p", { key: "summary", className: styles["core-alert-center-card-summary"] }, alert.summary || alert.body || t("alertCenter.cardNoSummary")),
    
    // Key metrics strip
    e("div", { key: "metrics", className: styles["core-alert-center-card-metrics"] }, [
      e("span", { key: "val" }, [
        t("alertCenter.labelValue"), ": ", 
        e("strong", null, `${formatAlertValue(alert.value)} VND`)
      ]),
      e("span", { key: "dir" }, [
        t("alertCenter.labelDirection"), ": ", 
        e("strong", { className: directionClass }, alert.direction || "—")
      ]),
      e("span", { key: "conf" }, [
        t("alertCenter.labelConfidence"), ": ", 
        e("strong", null, alert.confidence != null ? `${alert.confidence}` : "—")
      ]),
      e("span", { key: "fresh" }, [
        t("alertCenter.labelFreshness"), ": ", 
        e("strong", null, alert.freshness_state || "—")
      ]),
      e("span", { key: "sess" }, [
        t("alertCenter.labelSession"), ": ", 
        e("strong", null, alert.session_date || "—")
      ]),
      e("span", { key: "time" }, [
        alert.executed_at ? t("alertCenter.labelExecuted") : t("alertCenter.labelTime"), ": ", 
        e("strong", null, alert.executed_at ? formatAlertTimestamp(alert.executed_at) : formatAlertTimestamp(alert.triggered_at))
      ]),
    ]),

    // Expandable Evidence list
    alert.evidence && Object.keys(alert.evidence).length > 0 ? e("div", { key: "evidence-wrapper" }, [
      e(
        "div",
        { key: "evidence-hdr", className: styles["core-evidence-header"], onClick: () => toggleEvidence(alert.alert_id) },
        [
          e("span", { key: "lbl" }, t("alertCenter.evidenceView")),
          e("span", { key: "icon" }, isEvidenceExpanded ? t("alertCenter.evidenceHide") : t("alertCenter.evidenceShow"))
        ]
      ),
      isEvidenceExpanded ? renderEvidenceList(alert.evidence) : null
    ]) : null,

    // Action Buttons Footer
    e("div", { key: "actions", className: styles["core-alert-card-actions"] }, [
      e(
        "button",
        {
          key: "btn-detail",
          type: "button",
          className: "is-primary",
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
          disabled: busyAlertId === (alert.alert_id || alert.symbol),
          onClick: () => handleMuteSymbol(alert),
        },
        t("alertCenter.btnMute")
      ),
    ]),
  ]);
}
