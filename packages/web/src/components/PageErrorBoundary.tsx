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
      console.error(error, info);
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
        { role: "alert", "aria-live": "assertive", className: "page-error-boundary" },
        e("h2", null, this.props.fallbackTitle || "Something went wrong"),
        e("p", null, this.props.errorMessage || this.state.error?.message || "An error occurred."),
        e(
          "button",
          {
            type: "button",
            onClick: this.handleRetry,
          },
          this.props.retryLabel || "Retry"
        )
      );
    }
    return this.props.children;
  }
}
