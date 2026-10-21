// Shared semantic status colors for SOC components.
// All values resolve to system CSS variables (tokens.css / index.css @theme),
// falling back to the legacy hex only when the variable is unavailable.
// This keeps DataOps / Operations Center consistent with the shell theme
// and removes ad-hoc hardcoded hex across SOC panels.

export type StatusTone = "success" | "info" | "warning" | "danger" | "muted" | "neutral";

export const STATUS_VAR: Record<StatusTone, string> = {
  success: "var(--soc-status-ok, var(--color-success-500, #34d399))",
  info: "var(--soc-status-info, var(--color-info-500, #60a5fa))",
  warning: "var(--soc-status-warn, var(--color-warning-500, #fbbf24))",
  danger: "var(--soc-status-danger, var(--color-danger-500, #f87171))",
  muted: "var(--soc-status-muted, var(--text-muted, #94a3b8))",
  neutral: "var(--text-secondary, #cbd5e1)",
};


// Translucent badge background keyed by tone (kept in sync with STATUS_VAR).
export const STATUS_BG_VAR: Record<StatusTone, string> = {
  success: "var(--soc-bg-success, rgba(16, 185, 129, 0.15))",
  info: "var(--soc-bg-info, rgba(59, 130, 246, 0.15))",
  warning: "var(--soc-bg-warning, rgba(251, 191, 36, 0.15))",
  danger: "var(--soc-bg-danger, rgba(239, 68, 68, 0.15))",
  muted: "var(--soc-bg-muted, rgba(148, 163, 184, 0.15))",
  neutral: "var(--soc-bg-muted, rgba(148, 163, 184, 0.15))",
};

export function toneColor(tone: StatusTone): string {
  return STATUS_VAR[tone];
}

// Map a run/job status string to a semantic tone.
export function statusTone(status: string | undefined): StatusTone {
  switch ((status || "").toLowerCase()) {
    case "running":
    case "active":
    case "success":
    case "completed":
    case "healthy":
    case "fresh":
    case "ready":
      return "success";
    case "queued":
    case "pending":
    case "warm":
    case "info":
    case "medium":
      return "info";
    case "partial":
    case "degraded":
    case "stale":
    case "blocked":
    case "maintenance":
    case "high":
      return "warning";
    case "failed":
    case "error":
    case "aborted":
    case "cancelled":
    case "critical":
    case "missing":
    case "unhealthy":
      return "danger";
    case "disabled":
    case "unknown":
    case "idle":
    case "low":
      return "muted";
    default:
      return "neutral";
  }
}

// Badge pill style (background + text color) for a given status.
export function getStatusBadgeStyle(status: string | undefined): React.CSSProperties {
  const tone = statusTone(status);
  return {
    background: STATUS_BG_VAR[tone],
    color: STATUS_VAR[tone],
  };
}

// Alias kept for call sites that referenced the shared implementation.
export const getStatusBadgeStyleShared = getStatusBadgeStyle;

// Bare text color for a status (for metric values, inline text).
export function statusColor(status: string | undefined): string {
  return STATUS_VAR[statusTone(status)];
}

// Add the translucent badge backgrounds as CSS variables on :root so they
// can be themed. Importing this module has no side effects; the variables
// live in soc.module.css :root block instead. Kept here for documentation.
