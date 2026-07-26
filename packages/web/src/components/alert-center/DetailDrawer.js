import React from "react";
import { useI18n } from "../../context/LangContext.js";
import styles from "../../pages/AlertCenterPage.module.css";

const { createElement } = React;
const e = createElement;

export function DetailDrawer({ activeAlertId, activeDetail, activeContext, appliedSymbol, onClose }) {
  const { t } = useI18n();
  if (!activeDetail) return null;

  return e("section", { className: `${styles.acDrawer}` }, [
    e("div", { key: "title-row", className: styles.acDrawerTitleRow }, [
      e("h3", { key: "title" }, t("alertCenter.detailTitle", { id: activeAlertId })),
      e("button", { key: "close", type: "button", className: styles.acCloseBtn, onClick: onClose }, "✕"),
    ]),

    e("div", { key: "grid", className: styles.acDetailGrid }, [
      e("div", { key: "detail", className: styles.acDetailSection }, [
        e("h4", { key: "h" }, t("alertCenter.detailContent")),
        e("p", { key: "t" }, activeDetail?.title || t("alertCenter.detailNoTitle")),
        e("p", { key: "s", className: styles.acDetailMuted }, activeDetail?.summary || activeDetail?.body || t("alertCenter.cardNoSummary")),
      ]),

      activeContext ? e("div", { key: "context", className: styles.acDetailSection }, [
        e("h4", { key: "h" }, t("alertCenter.detailContext", { symbol: activeContext.symbol || appliedSymbol })),
        e("div", { className: styles.acDetailFlex }, [
          e("div", { key: "tot" }, [t("alertCenter.detailTotal"), ": ", e("strong", null, String(activeContext.total || 0))]),
          e("div", { key: "un" }, [t("alertCenter.detailUnseen"), ": ", e("strong", { style: { color: "var(--accent-amber, #ff9100)" } }, String(activeContext.unseen || 0))]),
          e("div", { key: "avg" }, [t("alertCenter.detailAvgSeverity"), ": ", e("strong", null, activeContext.average_severity || "medium")]),
          e("div", { key: "thr" }, [t("alertCenter.detailThreshold"), ": ", e("strong", null, activeContext.threshold_strategy || "default")]),
        ]),
      ]) : null,
    ]),
  ]);
}
