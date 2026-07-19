import React from "react";
import { useI18n } from "../../context/LangContext.js";
import styles from "../../pages/AlertCenterPage.module.css";

const { createElement } = React;
const e = createElement;

export function DetailDrawer({ activeAlertId, activeDetail, activeContext, appliedSymbol, onClose }) {
  const { t } = useI18n();
  if (!activeDetail) return null;

  return e("section", { className: styles.detailDrawer }, [
    e("div", { key: "title-row", className: styles.titleRow }, [
      e("h3", null, t("alertCenter.detailTitle", "Kính lúp kiểm tra pháp y: {id}", { id: activeAlertId })),
      e("button", { className: styles.closeBtn, onClick: onClose }, "✕"),
    ]),
    
    e("div", { key: "grid", className: styles.detailGrid }, [
      e("div", { key: "detail", className: styles.detailSection }, [
        e("h4", null, t("alertCenter.detailContent")),
        e("p", null, activeDetail?.title || t("alertCenter.detailNoTitle")),
        e("p", { className: styles.marginTop8 + " " + styles.fontSize85remColorMuted }, activeDetail?.summary || activeDetail?.body || t("alertCenter.cardNoSummary")),
      ]),
      
      activeContext ? e("div", { key: "context", className: styles.detailSection }, [
        e("h4", null, t("alertCenter.detailContext", "Bối cảnh mã {symbol}", { symbol: activeContext.symbol || appliedSymbol })),
        e("div", { className: styles.flexColGap8 }, [
          e("div", null, [t("alertCenter.detailTotal"), ": ", e("strong", null, String(activeContext.total || 0))]),
          e("div", null, [t("alertCenter.detailUnseen"), ": ", e("strong", { style: { color: "var(--accent-amber, #ff9100)" } }, String(activeContext.unseen || 0))]),
          e("div", null, [t("alertCenter.detailAvgSeverity"), ": ", e("strong", null, activeContext.average_severity || "medium")]),
          e("div", null, [t("alertCenter.detailThreshold"), ": ", e("strong", null, activeContext.threshold_strategy || "default")]),
        ])
      ]) : null,
    ])
  ]);
}
