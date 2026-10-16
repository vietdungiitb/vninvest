import { createElement } from "react";
import styles from "../components/aiSettings.module.css";
import { useI18n } from "../context/LangContext.js";
import { AIAgentFederationPanel } from "../components/AIAgentFederationPanel.js";
import { AiHubNav } from "../components/AiHubNav.js";

const e = createElement;

interface AIAgentFederationPageProps {
  className?: string;
}

export function AIAgentFederationPage({ className = "" }: AIAgentFederationPageProps) {
  const { t } = useI18n();
  return e("div", { className: `${styles.page} ${className}` }, [
    e(AiHubNav, { key: "tabs" }),
    e("h1", { key: "title", className: styles.pageTitle }, t("routes.aiAgentFederation")),
    e("p", { key: "desc", className: styles.pageDesc }, t("aiAgentFederation.description")),
    e(AIAgentFederationPanel, { key: "panel" }),
  ]);
}
