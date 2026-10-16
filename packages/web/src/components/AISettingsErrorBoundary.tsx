import { Component, createElement, ReactNode } from "react";
import styles from "./aiSettings.module.css";
import { createTranslator, normalizeLocale } from "../i18n/index.js";

interface AISettingsErrorBoundaryProps {
  children?: ReactNode;
  fallbackTitle?: string;
  errorMessage?: string;
  retryLabel?: string;
}

interface AISettingsErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const e = createElement;

export class AISettingsErrorBoundary extends Component<AISettingsErrorBoundaryProps, AISettingsErrorBoundaryState> {
  constructor(props: AISettingsErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AISettingsErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    if (typeof console !== "undefined") {
      console.error("[AISettingsErrorBoundary]", error, info);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // R1.3: class component không dùng được hook useI18n — dịch qua stored locale.
      let te: (key: string) => string = (key) => key;
      try {
        const stored = typeof localStorage !== "undefined" ? localStorage.getItem("lang") : null;
        te = createTranslator(normalizeLocale(stored || "vi"));
      } catch { te = (key: string) => key; }
      return e("div", { className: styles.alert + " " + styles.alertError }, [
        e("p", { key: "title", className: "font-semibold" }, this.props.fallbackTitle || te("aiCommandCenter.errorBoundaryTitle")),
        e("p", { key: "msg", className: "mt-1 text-xs opacity-80" }, this.state.error?.message || this.props.errorMessage || te("aiCommandCenter.unknownError")),
        e("button", {
          key: "retry",
          type: "button",
          onClick: this.handleRetry,
          className: styles.btn + " " + styles.btnDanger + " " + styles.btnSm,
        }, this.props.retryLabel || te("aiCommandCenter.retryButton")),
      ]);
    }
    return this.props.children;
  }
}