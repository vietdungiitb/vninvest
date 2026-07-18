import { Component, createElement, ReactNode } from "react";

interface TenantAdminErrorBoundaryProps {
  children?: ReactNode;
}

interface TenantAdminErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const e = createElement;

export class TenantAdminErrorBoundary extends Component<
  TenantAdminErrorBoundaryProps,
  TenantAdminErrorBoundaryState
> {
  constructor(props: TenantAdminErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): TenantAdminErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    if (typeof console !== "undefined") {
      console.error("[TenantAdminErrorBoundary]", error, info);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return e(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "400px",
            padding: "32px",
            textAlign: "center",
          },
        },
        [
          e(
            "div",
            {
              key: "icon",
              style: {
                fontSize: "48px",
                marginBottom: "16px",
                opacity: 0.6,
              },
            },
            "\u26A0\uFE0F"
          ),
          e(
            "h2",
            {
              key: "title",
              style: {
                fontSize: "18px",
                fontWeight: 600,
                color: "#f1f5f9",
                margin: "0 0 8px",
              },
            },
            "L\u1ED7i truy c\u1EADp trang qu\u1EA3n tr\u1ECB"
          ),
          e(
            "p",
            {
              key: "msg",
              style: {
                fontSize: "14px",
                color: "#94a3b8",
                margin: "0 0 24px",
                maxWidth: "400px",
              },
            },
            this.state.error?.message ||
              "Kh\u00F4ng th\u1EC3 t\u1EA3i trang qu\u1EA3n tr\u1ECB. Vui l\u00F9ng th\u1EED l\u1EA1i."
          ),
          e(
            "button",
            {
              key: "retry",
              type: "button",
              onClick: this.handleRetry,
              style: {
                padding: "10px 24px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#fff",
                background: "linear-gradient(135deg, #f97316, #ea580c)",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              },
            },
            "Th\u1EED l\u1EA1i"
          ),
        ]
      );
    }
    return this.props.children;
  }
}
