import { createElement } from "react";
import { Link } from "react-router-dom";
import styles from "../components/aiSettings.module.css";
import { useI18n } from "../context/LangContext.js";
import { AIAgentFederationPanel } from "../components/AIAgentFederationPanel.js";

const e = createElement;

interface AIAgentFederationPageProps {
  className?: string;
}

export function AIAgentFederationPage({ className = "" }: AIAgentFederationPageProps) {
  const { t } = useI18n();
  return e("div", { className: `${styles.page} ${className}` },
    e(Link, { to: "/settings/ai", className: styles.hubBackLink },
      t("aiCommandCenter.backToHub")
    ),
    // FU-02c: trang nay khong co <h1> => screen reader khong tim thay tieu de trang.
    // Pattern giong AICommandCenterPage.tsx:172 (styles.pageTitle + key i18n).
    e("h1", { className: styles.pageTitle }, t("routes.aiAgentFederation")),
    e(AIAgentFederationPanel, null),
  );
}
