import { Component, createElement, ReactNode } from "react";
import styles from "./aiSettings.module.css";

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
      return e("div", { className: styles.alert + " " + styles.alertError }, [
        e("p", { key: "title", className: "font-semibold" }, this.props.fallbackTitle || "Đã xảy ra lỗi"),
        e("p", { key: "msg", className: "mt-1 text-xs opacity-80" }, this.state.error?.message || this.props.errorMessage || "Lỗi không xác định."),
        e("button", {
          key: "retry",
          type: "button",
          onClick: this.handleRetry,
          className: styles.btn + " " + styles.btnDanger + " " + styles.btnSm,
        }, this.props.retryLabel || "Thử lại"),
      ]);
    }
    return this.props.children;
  }
}