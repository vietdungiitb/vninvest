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
    e(AIAgentFederationPanel, null),
  );
}
