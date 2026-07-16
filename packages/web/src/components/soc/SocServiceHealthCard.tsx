import { createElement } from "react";
import { useI18n } from "../../context/LangContext.js";
import { getStatusBadgeStyle } from "./socStatusColors.js";
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
      { },
      createElement(
        "div",
        null,
        createElement("h4", { }, service.name),
        createElement("p", { },
          `${service.service_key} \u2022 ${service.domain}`,
        ),
      ),
      createElement(
        "span",
        {
          className: styles.statusBadge,
          style: { ...getStatusBadgeStyle(service.status) },
        },
        statusLabel,
      ),
    ),
    createElement(
      "div",
      { },
      createElement(
        "div",
        { },
        createElement("div", { }, t("soc.health.latency_label")),
        createElement("div", { }, latency),
      ),
      createElement(
        "div",
        { },
        createElement("div", { }, t("soc.health.last_check_label")),
        createElement("div", { }, lastCheck),
      ),
    ),
  );
}
