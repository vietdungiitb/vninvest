import { Component, createElement, ReactNode } from "react";

interface PageErrorBoundaryProps {
  children?: ReactNode;
  fallbackTitle?: string;
  errorMessage?: string;
  retryLabel?: string;
  onRetry?: () => void;
}

interface PageErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const e = createElement;

export class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  constructor(props: PageErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    if (typeof console !== "undefined") {
      console.error("[StockDetailPage]", error, info);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return e(
        "div",
        { className: "sdp-page sdp-error-state" },
        e("div", { className: "sdp-error-icon" }, "⚠️"),
        e("p", { className: "sdp-error-text" }, this.state.error?.message || this.props.errorMessage || "Lỗi không xác định."),
        e(
          "button",
          {
            className: "sdp-retry-btn",
            type: "button",
            onClick: this.handleRetry,
          },
          this.props.retryLabel || "Thử lại"
        )
      );
    }
    return this.props.children;
  }
}
