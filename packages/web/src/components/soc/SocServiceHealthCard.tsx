import { createElement } from "react";
import { useI18n } from "../../context/LangContext.js";
import styles from "./soc.module.css";

interface SocServiceHealthCardProps {
  service: {
    service_key: string;
    name: string;
    domain: string;
    status: string;
    is_active: boolean;
    avg_response_ms?: number;
    last_check_at?: string;
    [key: string]: unknown;
  };
}

export function SocServiceHealthCard({ service }: SocServiceHealthCardProps) {
  const { t } = useI18n();

  const getStatusLabel = (status: string, isActive: boolean): string => {
    if (!isActive) return t("soc.health.status_unknown");
    switch (status) {
      case "healthy": return t("soc.health.status_healthy");
      case "degraded": return t("soc.health.status_degraded");
      case "unhealthy": return t("soc.health.status_critical");
      case "maintenance": return t("soc.health.status_maintenance");
      default: return t("soc.health.status_unknown");
    }
  };

  const getStatusColor = (status: string, isActive: boolean): string => {
    if (!isActive) return "#94a3b8";
    switch (status) {
      case "healthy": return "#34d399";
      case "degraded": return "#fbbf24";
      case "unhealthy": return "#f87171";
      case "maintenance": return "#38bdf8";
      default: return "#cbd5e1";
    }
  };

  const statusColor = getStatusColor(service.status, service.is_active);
  const statusLabel = getStatusLabel(service.status, service.is_active);
  const latency = service.is_active && service.avg_response_ms != null
    ? `${service.avg_response_ms.toFixed(0)}ms`
    : t("soc.health.unknown_value");
  const lastCheck = service.last_check_at
    ? service.last_check_at.split("T")[1]?.slice(0, 8) || t("soc.health.unknown_value")
    : t("soc.health.unknown_value");

  return createElement(
    "div",
    { className: styles.serviceCard },
    createElement(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
      createElement(
        "div",
        null,
        createElement("h4", { style: { margin: 0, fontWeight: 700, fontSize: "1rem" } }, service.name),
        createElement("p", { style: { margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)" } },
          `${service.service_key} \u2022 ${service.domain}`,
        ),
      ),
      createElement(
        "span",
        {
          className: styles.statusBadge,
          style: { background: `${statusColor}20`, color: statusColor },
        },
        statusLabel,
      ),
    ),
    createElement(
      "div",
      { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" } },
      createElement(
        "div",
        { style: { background: "rgba(2, 11, 35, 0.4)", padding: "0.5rem 0.75rem", borderRadius: "8px" } },
        createElement("div", { style: { fontSize: "0.65rem", color: "var(--text-muted, #94a3b8)", textTransform: "uppercase" } }, t("soc.health.latency_label")),
        createElement("div", { style: { fontWeight: 600, fontSize: "0.9rem", marginTop: "0.15rem" } }, latency),
      ),
      createElement(
        "div",
        { style: { background: "rgba(2, 11, 35, 0.4)", padding: "0.5rem 0.75rem", borderRadius: "8px" } },
        createElement("div", { style: { fontSize: "0.65rem", color: "var(--text-muted, #94a3b8)", textTransform: "uppercase" } }, t("soc.health.last_check_label")),
        createElement("div", { style: { fontWeight: 500, fontSize: "0.8rem", marginTop: "0.15rem" } }, lastCheck),
      ),
    ),
  );
}
