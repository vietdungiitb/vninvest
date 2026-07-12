import { createElement } from "react";
import styles from "../components/aiSettings.module.css";
import { useI18n } from "../context/LangContext.js";
import { AIAgentFederationPanel } from "../components/AIAgentFederationPanel.js";

const e = createElement;

interface AIAgentFederationPageProps {
  className?: string;
}

export function AIAgentFederationPage({ className = "" }: AIAgentFederationPageProps) {
  useI18n();
  return e("div", { className: `${styles.page} ${className}` },
    e(AIAgentFederationPanel, null),
  );
}
